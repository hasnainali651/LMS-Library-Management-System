const validateEnv = require('../src/utils/validateEnv');
const asyncHandler = require('../src/utils/asyncHandler');

const validEnv = () => ({
  NODE_ENV: 'production', MONGO_URI: 'mongodb://localhost:27017/library',
  REDIS_URL: 'redis://localhost:6379', JWT_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32),
  MAIL_HOST: 'smtp.example.org', MAIL_USER: 'sender@example.org', MAIL_PASS: 'test-only-password',
  FRONTEND_URL: 'https://library.example.org', GEMINI_API_KEY: 'test-only-key', GEMINI_MODEL: 'gemini-2.5-flash',
});

afterEach(() => jest.restoreAllMocks());

test('valid environment passes, including MongoDB replica-set and SRV URLs', () => {
  expect(() => validateEnv(validEnv())).not.toThrow();
  expect(() => validateEnv({ ...validEnv(), MONGO_URI: 'mongodb://host1:27017,host2:27017/library?replicaSet=rs0' })).not.toThrow();
  expect(() => validateEnv({ ...validEnv(), MONGO_URI: 'mongodb+srv://cluster.example.org/library' })).not.toThrow();
});

test('reports all missing names and throws the exact startup error', () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => validateEnv({})).toThrow('Server startup aborted: missing environment variables');
  expect(log.mock.calls.map(([message]) => message)).toEqual(
    Object.keys(validEnv()).map((name) => `Missing or invalid environment variable: ${name}`)
  );
});

test.each(Object.keys(validEnv()))('rejects blank %s', (name) => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => validateEnv({ ...validEnv(), [name]: '   ' })).toThrow('Server startup aborted: missing environment variables');
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenCalledWith(`Missing or invalid environment variable: ${name}`);
});

test('reports invalid names without exposing values', () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const invalid = {
    NODE_ENV: 'invalid-mode', MONGO_URI: 'invalid-mongo', REDIS_URL: 'https://wrong.example.org',
    JWT_SECRET: 'short-secret', JWT_REFRESH_SECRET: 'short-refresh-secret', FRONTEND_URL: 'ftp://wrong.example.org',
  };
  expect(() => validateEnv({ ...validEnv(), ...invalid })).toThrow('Server startup aborted: missing environment variables');
  expect(log).toHaveBeenCalledTimes(6);
  const output = log.mock.calls.flat().join('\n');
  Object.keys(invalid).forEach((name) => expect(output).toContain(name));
  Object.values(invalid).forEach((value) => expect(output).not.toContain(value));
});

test('startup validates after dotenv and before importing the app or connection modules', () => {
  const events = [];
  const failure = new Error('validation stopped startup');
  jest.doMock('dotenv', () => ({ config: jest.fn(() => events.push('dotenv')) }));
  jest.doMock('../src/utils/validateEnv', () => () => { events.push('validate'); throw failure; });
  jest.doMock('../src/app', () => { events.push('app'); return {}; });
  jest.doMock('../src/config/db', () => { events.push('database'); return {}; });
  jest.doMock('../src/config/redis', () => { events.push('redis'); return {}; });
  expect(() => jest.isolateModules(() => require('../src/server'))).toThrow(failure);
  expect(events).toEqual(['dotenv', 'dotenv', 'validate']);
});

test.each(['sync', 'async'])('async wrapper forwards %s failures exactly once', async (type) => {
  const error = new Error('handler failure');
  const handler = type === 'sync' ? () => { throw error; } : async () => { throw error; };
  const next = jest.fn();
  await asyncHandler(handler)({}, {}, next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith(error);
});

test('async wrapper preserves a successful handler result', async () => {
  const next = jest.fn();
  await expect(asyncHandler(async () => 'ok')({}, {}, next)).resolves.toBe('ok');
  expect(next).not.toHaveBeenCalled();
});

const lifecycle = (failureAt) => {
  const events = [];
  const step = (name) => jest.fn(async () => { events.push(name); if (failureAt === name) throw new Error(`${name} unavailable`); });
  const app = { locals: {} };
  const server = { listening: false, once: jest.fn(), removeListener: jest.fn(), address: () => ({ port: 5000 }),
    listen: jest.fn((_port, done) => { events.push('listen'); server.listening = true; done(); }),
    close: jest.fn((done) => { events.push('http-stop'); server.listening = false; done(); }), closeIdleConnections: jest.fn() };
  jest.doMock('dotenv', () => ({ config: jest.fn() }));
  jest.doMock('../src/utils/validateEnv', () => jest.fn());
  jest.doMock('http', () => ({ createServer: () => server }));
  jest.doMock('../src/app', () => app);
  jest.doMock('../src/config/redis', () => ({ prepare: step('redis-ready'), status: 'ready', quit: step('redis-stop') }));
  jest.doMock('../src/config/db', () => step('mongo-ready'));
  jest.doMock('mongoose', () => ({ connection: { close: step('mongo-stop') } }));
  jest.doMock('../src/models', () => ({ Notification: { createIndexes: step('indexes') } }));
  jest.doMock('../src/socket', () => ({ initSocket: step('socket-ready'), closeSocket: step('socket-stop') }));
  jest.doMock('../src/jobs/notificationProcessor', () => ({ initNotificationProcessor: step('worker-ready'), stopNotificationProcessor: step('worker-stop') }));
  jest.doMock('../src/jobs/cronJobs', () => ({ initCronJobs: step('cron-register'), startCronJobs: step('cron-start'), stopCronJobs: step('cron-stop'), reconcileStartup: step('cron-reconcile') }));
  jest.doMock('../src/services/notificationService', () => ({ reconcilePendingDeliveries: async () => { await step('delivery-reconcile')(); return { pending: 0 }; } }));
  let loaded; jest.isolateModules(() => { loaded = require('../src/server'); });
  return { loaded, events, app, server };
};
test('startup orders readiness, inactive registration, reconciliation and listening; shutdown drains once', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  const { loaded, events, app } = lifecycle();
  await loaded.startServer();
  expect(events).toEqual(['redis-ready', 'mongo-ready', 'cron-register', 'indexes', 'socket-ready', 'worker-ready', 'delivery-reconcile', 'cron-reconcile', 'cron-start', 'listen']);
  expect(app.locals.ready).toBe(true);
  await Promise.all([loaded.gracefulShutdown(), loaded.gracefulShutdown()]);
  expect(app.locals.ready).toBe(false);
  expect(events.slice(10)).toEqual(['http-stop', 'socket-stop', 'cron-stop', 'worker-stop', 'mongo-stop', 'redis-stop']);
});
test.each(['redis-ready', 'mongo-ready', 'worker-ready', 'delivery-reconcile', 'cron-reconcile'])('startup fails closed when %s fails and releases dependencies', async (failureAt) => {
  const { loaded, events, app, server } = lifecycle(failureAt);
  await expect(loaded.startServer()).rejects.toThrow(`${failureAt} unavailable`);
  expect(server.listen).not.toHaveBeenCalled(); expect(events).not.toContain('cron-start'); expect(app.locals.ready).toBe(false);
  expect(events.slice(-5)).toEqual(['socket-stop', 'cron-stop', 'worker-stop', 'mongo-stop', 'redis-stop']);
});
test('shutdown still closes database and Redis when worker drain fails', async () => {
  const { loaded, events } = lifecycle('worker-stop');
  await expect(loaded.gracefulShutdown()).rejects.toThrow('worker-stop unavailable');
  expect(events.slice(-2)).toEqual(['mongo-stop', 'redis-stop']);
});
test.each([
  [{ setName: 'rs0', logicalSessionTimeoutMinutes: 30 }, true],
  [{ msg: 'isdbgrid', logicalSessionTimeoutMinutes: 30 }, true],
  [{ logicalSessionTimeoutMinutes: 30 }, false],
])('MongoDB startup requires transaction-capable topology %j', async (hello, accepted) => {
  jest.dontMock('../src/config/db');
  const command = jest.fn().mockResolvedValue(hello);
  jest.doMock('mongoose', () => ({ connect: jest.fn().mockResolvedValue({ connection: { db: { admin: () => ({ command }) } } }) }));
  jest.spyOn(console, 'log').mockImplementation(() => {});
  let connect; jest.isolateModules(() => { connect = require('../src/config/db'); });
  if (accepted) await expect(connect()).resolves.toBeDefined();
  else await expect(connect()).rejects.toThrow('transaction support');
  expect(command).toHaveBeenCalledWith({ hello: 1 });
});
