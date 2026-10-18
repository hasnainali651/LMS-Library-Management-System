jest.mock('../src/config/queue', () => ({
  getNotificationQueue: jest.fn(() => ({ getJobCounts: jest.fn() })),
}));
jest.mock('../src/jobs/notificationProcessor', () => ({ isNotificationProcessorReady: jest.fn(() => true) }));
jest.mock('node-cron', () => ({ schedule: jest.fn(() => ({ start: jest.fn(), stop: jest.fn() })) }));
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: 'test', accepted: ['reader@example.org'], rejected: [] }) })) }));
jest.mock('../src/config/redis', () => ({ status: 'ready', get: jest.fn(), set: jest.fn(), eval: jest.fn() }));
jest.mock('socket.io', () => ({ Server: jest.fn() }));

const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const app = require('../src/app');
const models = require('../src/models');
const { User } = models;
const redis = require('../src/config/redis');
const { getNotificationQueue } = require('../src/config/queue');
const { initCronJobs, startCronJobs, getCronStatus, stopCronJobs } = require('../src/jobs/cronJobs');
const fineService = require('../src/services/fineService');
const notificationService = require('../src/services/notificationService');
const { getSystemStatus } = require('../src/controllers/system.controller');
const { getLibrarySettings, getLibraryEmailFooter } = require('../src/config/library');
const emailService = require('../src/services/emailService');
const transporter = require('../src/config/mail');
const sockets = require('../src/socket/socketManager');
const { Server } = require('socket.io');
const originalEnv = { ...process.env };
const counts = { waiting: 3, active: 2, completed: 7, failed: 1, delayed: 4, paused: 0 };
let notificationQueue;

beforeEach(() => {
  process.env.JWT_SECRET = 'integration-test-secret-with-32-characters';
  Object.assign(process.env, {
    LIBRARY_NAME: 'Central & Community Library', LIBRARY_ADDRESS: '10 Main Street',
    LIBRARY_HOURS: 'Mon–Fri 09:00–17:00', LIBRARY_CONTACT: 'library@example.org', LIBRARY_TIMEZONE: 'Asia/Karachi',
  });
  notificationQueue = { getJobCounts: jest.fn().mockResolvedValue(counts) };
  getNotificationQueue.mockReturnValue(notificationQueue);
  redis.status = 'ready'; redis.get.mockResolvedValue(null); redis.set.mockResolvedValue('OK'); redis.eval.mockResolvedValue(1);
  jest.spyOn(notificationService, 'getDeliveryDiagnostics').mockResolvedValue([{ _id: 'pending', count: 2 }]);
});
afterEach(async () => {
  await sockets.closeSocket();
  process.env = { ...originalEnv };
  jest.restoreAllMocks(); jest.clearAllMocks(); jest.useRealTimers();
});
const authorize = (role) => {
  const user = { _id: '507f1f77bcf86cd799439011', role, isActive: true };
  jest.spyOn(User, 'findById').mockResolvedValue(user);
  return jwt.sign({ _id: user._id, jti: 'test-session' }, process.env.JWT_SECRET, { expiresIn: '1h' });
};
const entry = (name, type) => ({ name, isDirectory: () => type === 'directory', isFile: () => type === 'file' });
const paginatedLists = [
  ['book', 'getBooks', models.Book], ['book', 'searchBooks', models.Book], ['book', 'getBookReviews', models.Review],
  ['search', 'searchBooks', models.Book], ['search', 'getNewArrivals', models.Book],
  ['member', 'getMembers', models.User], ['member', 'getMemberTransactions', models.Transaction],
  ['circulation', 'getActiveLoans', models.Transaction], ['circulation', 'getOverdueLoans', models.Transaction],
  ['user', 'getUsers', models.User], ['notification', 'getNotifications', models.Notification],
  ['fine', 'getFines', models.Fine], ['reservation', 'getAllReservations', models.Reservation], ['ai', 'getAuditHistory', models.ShelfAudit],
];
test.each(paginatedLists)('%s.%s uses lean pagination without changing response metadata', async (controller, handler, model) => {
  const result = { docs: [{ _id: 'record' }], totalDocs: 1, page: 2, limit: 5, totalPages: 1 };
  jest.spyOn(model, 'paginate').mockResolvedValue(result);
  jest.spyOn(User, 'exists').mockResolvedValue({ _id: 'member' });
  const req = { query: { q: 'book', page: '2', limit: '5' }, params: { id: 'member' }, user: { _id: 'member' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }; const next = jest.fn();
  await require(`../src/controllers/${controller}.controller`)[handler](req, res, next);
  expect(next).not.toHaveBeenCalled();
  expect(model.paginate).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ lean: true, page: 2, limit: 5 }));
  expect(res.json.mock.calls[0][0].data).toBe(result);
  const { populate } = model.paginate.mock.calls[0][1];
  const copyPopulation = Array.isArray(populate) && populate.find(({ path }) => ['copy', 'assignedCopy'].includes(path));
  if (copyPopulation) {
    const copy = { _id: new models.Copy()._id, barcode: 'BC-1' };
    expect(copyPopulation.transform(copy)).toEqual({ ...copy, fullBarcode: `LMS-${copy._id}` });
    expect(copyPopulation.transform(null)).toBeNull();
  }
});
const leanListQuery = (rows) => ({ sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(rows) });
test.each([
  ['book', 'getSimilarBooks', models.Book], ['member', 'getMemberFines', models.Fine], ['member', 'getMemberReservations', models.Reservation],
  ['circulation', 'getMemberLoans', models.Transaction], ['fine', 'getMemberFines', models.Fine],
  ['reservation', 'getMyReservations', models.Reservation], ['reservation', 'getBookQueue', models.Reservation], ['membershipType', 'getMembershipTypes', models.MembershipType],
])('%s.%s returns lean list rows and retains populated copy barcodes', async (controller, handler, model) => {
  const rows = [{ _id: 'record' }]; const query = leanListQuery(rows);
  jest.spyOn(model, 'find').mockReturnValue(query); jest.spyOn(User, 'exists').mockResolvedValue({ _id: 'member' });
  jest.spyOn(models.Book, 'findById').mockResolvedValue({ _id: 'book', categories: ['Fiction'], title: 'Book' });
  const req = { query: {}, params: { id: 'member', memberId: 'member', bookId: 'book' }, user: { _id: 'member', role: 'student' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }; const next = jest.fn();
  await require(`../src/controllers/${controller}.controller`)[handler](req, res, next);
  expect(next).not.toHaveBeenCalled(); expect(query.lean).toHaveBeenCalledTimes(1);
  const { data } = res.json.mock.calls[0][0]; expect(handler === 'getBookQueue' ? data.queue : data).toBe(rows);
  query.populate.mock.calls.forEach(([options]) => {
    if (options.transform) { const copy = { _id: 'copy', barcode: 'BC-1' }; expect(options.transform(copy)).toEqual({ ...copy, fullBarcode: 'LMS-copy' }); expect(options.transform(null)).toBeNull(); }
  });
});
test('member profile uses lean recent transactions while retaining the profile document', async () => {
  const member = new User({ name: 'Reader', email: 'reader@example.org', isActive: true, membershipType: 'student' });
  jest.spyOn(User, 'findById').mockReturnValue({ select: () => member, session: async () => member, then: (resolve) => resolve(member) });
  jest.spyOn(models.MembershipType, 'findOne').mockReturnValue({ session: async () => ({ maxBooks: 3, maxFineBalance: 2000 }) });
  jest.spyOn(models.Transaction, 'exists').mockReturnValue({ session: async () => null });
  jest.spyOn(models.Transaction, 'countDocuments').mockReturnValue({ session: async () => 0, then: (resolve) => resolve(0) });
  const query = leanListQuery([{ _id: 'transaction' }]); jest.spyOn(models.Transaction, 'find').mockReturnValue(query);
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }; const next = jest.fn();
  await require('../src/controllers/member.controller').getMemberById({ params: { id: member._id } }, res, next);
  expect(next).not.toHaveBeenCalled(); expect(query.lean).toHaveBeenCalledTimes(1);
  expect(res.json.mock.calls[0][0].data).toEqual(expect.objectContaining({ name: 'Reader', recentTransactions: [{ _id: 'transaction' }] }));
});
test('copy lists preserve the computed barcode and current borrower with lean reads', async () => {
  const copy = { _id: 'copy', status: 'issued' }; jest.spyOn(models.Book, 'findById').mockResolvedValue({ _id: 'book' });
  const copies = leanListQuery([copy]); const transactions = leanListQuery([{ copy: 'copy', member: { name: 'Reader' } }]);
  jest.spyOn(models.Copy, 'find').mockReturnValue(copies); jest.spyOn(models.Transaction, 'find').mockReturnValue(transactions);
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }; const next = jest.fn();
  await require('../src/controllers/book.controller').getBookCopies({ params: { id: 'book' } }, res, next);
  expect(next).not.toHaveBeenCalled(); expect(copies.lean).toHaveBeenCalledTimes(1); expect(transactions.lean).toHaveBeenCalledTimes(1);
  expect(res.json.mock.calls[0][0].data).toEqual([{ ...copy, fullBarcode: 'LMS-copy', currentBorrower: 'Reader' }]);
});
test('fine collection delegates payment persistence to the transactional ledger service', async () => {
  const result = { amountCollected: 20, receiptNumber: 'receipt', fineBalance: 0 };
  jest.spyOn(fineService, 'collectFines').mockResolvedValue(result);
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }; const next = jest.fn();
  await require('../src/controllers/fine.controller').collectFines({ body: { fineIds: ['fine'], amount: 20, paymentMethod: 'cash' }, user: { _id: 'staff' } }, res, next);
  expect(next).not.toHaveBeenCalled(); expect(fineService.collectFines).toHaveBeenCalledWith({ fineIds: ['fine'], amount: 20, paymentMethod: 'cash', collectedBy: 'staff' });
  expect(res.json.mock.calls[0][0].data).toBe(result);
});
test('public settings require no authentication and expose only the four public strings', async () => {
  const response = await request(app).get('/api/v1/settings/public'); expect(response.status).toBe(200);
  expect(response.body.data).toEqual(getLibrarySettings()); expect(Object.keys(response.body.data)).toEqual(['libraryName', 'address', 'hours', 'contact']);
  Object.values(response.body.data).forEach((value) => expect(typeof value).toBe('string'));
});
test('canonical mail service uses public settings and escapes configured HTML', async () => {
  Object.assign(process.env, { MAIL_HOST: 'smtp.example.org', MAIL_USER: 'sender@example.org', MAIL_PASS: 'test-only', LIBRARY_ADDRESS: '<script>address</script>' }); delete process.env.MAIL_FROM;
  await emailService.sendEmail('reader@example.org', 'Notice', '<p>Body</p>');
  const options = transporter.sendMail.mock.calls[0][0];
  expect(options.from).toEqual({ name: getLibrarySettings().libraryName, address: 'sender@example.org' });
  expect(options.html).toBe(`<p>Body</p>${getLibraryEmailFooter()}`); expect(options.html).toContain('&lt;script&gt;address&lt;/script&gt;'); expect(options.html).not.toContain('<script>');
});
test.each(['/api/v1/admin/system', '/api/v1/notifications'])('%s rejects anonymous callers', async (url) => { expect((await request(app).get(url)).status).toBe(401); });
test.each(['student', 'librarian'])('system endpoint rejects %s callers', async (role) => {
  const response = await request(app).get('/api/v1/admin/system').set('Authorization', `Bearer ${authorize(role)}`);
  expect(response.status).toBe(403); expect(notificationQueue.getJobCounts).not.toHaveBeenCalled();
});
test('admin metrics count nested files and report only the actual canonical queue and delivery state', async () => {
  const token = authorize('admin'); const root = path.resolve(__dirname, '../uploads');
  jest.spyOn(fs, 'readdir').mockImplementation(async (directory) => directory === root ? [entry('cover.webp', 'file'), entry('avatars', 'directory'), entry('link', 'symlink')] : [entry('avatar.webp', 'file')]);
  const response = await request(app).get('/api/v1/admin/system').set('Authorization', `Bearer ${token}`);
  expect(response.status).toBe(200); expect(response.body.data).toEqual({ totalUploads: 2, queueStats: { notifications: { status: 'ready', counts } }, delivery: [{ _id: 'pending', count: 2 }], cronStatus: [], activeSocketConnections: 0 });
  expect(notificationQueue.getJobCounts).toHaveBeenCalledWith('waiting', 'active', 'completed', 'failed', 'delayed', 'paused'); expect(sockets.getActiveSocketConnections()).toBe(0);
});
test('missing uploads report zero and failed queue queries report unavailable', async () => {
  jest.spyOn(fs, 'readdir').mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' })); notificationQueue.getJobCounts.mockRejectedValue(new Error('offline'));
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }; const next = jest.fn(); await getSystemStatus({}, res, next);
  expect(next).not.toHaveBeenCalled(); expect(res.json.mock.calls[0][0].data.totalUploads).toBe(0); expect(res.json.mock.calls[0][0].data.queueStats.notifications).toEqual({ status: 'unavailable', counts: null });
});
test('queue metrics time out instead of holding the request open', async () => {
  jest.useFakeTimers(); jest.spyOn(fs, 'readdir').mockResolvedValue([]); notificationQueue.getJobCounts.mockImplementation(() => new Promise(() => {}));
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }; const next = jest.fn(); const response = getSystemStatus({}, res, next);
  await jest.advanceTimersByTimeAsync(2000); await response; expect(next).not.toHaveBeenCalled(); expect(res.json.mock.calls[0][0].data.queueStats.notifications).toEqual({ status: 'unavailable', counts: null });
});
test('filesystem failures reach the error middleware', async () => {
  const error = Object.assign(new Error('denied'), { code: 'EACCES' }); jest.spyOn(fs, 'readdir').mockRejectedValue(error);
  const next = jest.fn(); await getSystemStatus({}, {}, next); expect(next).toHaveBeenCalledWith(error);
});
test('cron status reflects inactive registration, running work and drained shutdown', async () => {
  let finish; jest.spyOn(fineService, 'computeOverdueFines').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  jest.spyOn(models.Transaction, 'updateMany').mockResolvedValue({ modifiedCount: 0 });
  jest.spyOn(models.Transaction, 'find').mockReturnValue({ populate: () => ({ populate: async () => [] }) });
  initCronJobs(); initCronJobs(); expect(cron.schedule).toHaveBeenCalledTimes(6);
  expect(getCronStatus()).toHaveLength(6); expect(getCronStatus().every((job) => !job.scheduled && !job.running && job.lastStartedAt === null)).toBe(true);
  startCronJobs(); expect(getCronStatus().every((job) => job.scheduled)).toBe(true);
  const execution = cron.schedule.mock.calls.find(([schedule]) => schedule === '0 9 * * *')[1]();
  await Promise.resolve(); expect(getCronStatus().find((job) => job.name === 'overdueTransactions').running).toBe(true);
  finish(); await execution;
  expect(getCronStatus().find((job) => job.name === 'overdueTransactions')).toEqual(expect.objectContaining({ running: false, lastStartedAt: expect.any(String), lastFinishedAt: expect.any(String), lastSuccessAt: expect.any(String), lastError: null }));
  await stopCronJobs(); expect(getCronStatus().every((job) => !job.scheduled)).toBe(true);
  cron.schedule.mock.results.forEach(({ value }) => expect(value.stop).toHaveBeenCalledTimes(1));
});

describe('socket sessions and room authorization', () => {
  let io; let socket;
  beforeEach(() => {
    jest.useFakeTimers();
    io = { use: jest.fn(), on: jest.fn(), in: jest.fn().mockReturnThis(), disconnectSockets: jest.fn(), close: jest.fn((done) => done()), of: jest.fn(() => ({ sockets: new Map() })) };
    Server.mockImplementation(() => io);
    socket = { handshake: { auth: {} }, join: jest.fn(), emit: jest.fn(), disconnect: jest.fn(), use: jest.fn(), on: jest.fn() };
  });
  const connect = async (token) => {
    sockets.initSocket({}); socket.handshake.auth = { token, room: 'role:admin', userId: 'victim' };
    const next = jest.fn(); await io.use.mock.calls[0][0](socket, next); return next;
  };
  test('uninitialized export is safe and anonymous, revoked, inactive and offline sessions fail closed', async () => {
    expect(sockets.getIO()).toBeNull(); expect(sockets.getActiveSocketConnections()).toBe(0);
    expect((await connect()).mock.calls[0][0]).toBeInstanceOf(Error);
    const token = authorize('student'); redis.get.mockResolvedValue('revoked'); expect((await connect(token)).mock.calls[0][0]).toBeInstanceOf(Error);
    redis.get.mockResolvedValue(null); User.findById.mockResolvedValue({ _id: '507f1f77bcf86cd799439011', role: 'student', isActive: false });
    expect((await connect(token)).mock.calls[0][0]).toBeInstanceOf(Error);
    redis.status = 'reconnecting'; expect((await connect(token)).mock.calls[0][0]).toBeInstanceOf(Error); expect(socket.join).not.toHaveBeenCalled();
  });
  test('only database identity rooms are assigned; arbitrary client room events have no listeners', async () => {
    authorize('student'); const token = jwt.sign({ _id: '507f1f77bcf86cd799439011', jti: 'session', role: 'admin', memberId: 'victim' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    expect((await connect(token)).mock.calls[0]).toEqual([]); io.on.mock.calls.find(([event]) => event === 'connection')[1](socket);
    expect(socket.join.mock.calls).toEqual([['user:507f1f77bcf86cd799439011'], ['role:student']]);
    expect(socket.on.mock.calls.map(([event]) => event)).toEqual(['disconnect']);
    sockets.disconnectUser('507f1f77bcf86cd799439011'); expect(io.in).toHaveBeenCalledWith('user:507f1f77bcf86cd799439011'); expect(io.disconnectSockets).toHaveBeenCalledWith(true);
    User.findById.mockResolvedValue({ _id: '507f1f77bcf86cd799439011', role: 'admin', isActive: true });
    const next = jest.fn(); await socket.use.mock.calls[0][0](['join_room', 'role:admin'], next);
    expect(socket.disconnect).toHaveBeenCalledWith(true); expect(next).toHaveBeenCalledWith(expect.any(Error));
    socket.on.mock.calls[0][1]();
  });
  test('revocation is rechecked without client traffic and expiry disconnects', async () => {
    const token = authorize('student'); await connect(token); io.on.mock.calls.find(([event]) => event === 'connection')[1](socket);
    redis.get.mockResolvedValue('revoked'); await jest.advanceTimersByTimeAsync(15000); expect(socket.disconnect).toHaveBeenCalledWith(true);
    socket.on.mock.calls[0][1](); socket.disconnect.mockClear();
    redis.get.mockResolvedValue(null); socket.sessionAuth.expiresAt = Date.now() + 1000;
    io.on.mock.calls.find(([event]) => event === 'connection')[1](socket); await jest.advanceTimersByTimeAsync(1000); expect(socket.disconnect).toHaveBeenCalledWith(true);
    socket.on.mock.calls.at(-1)[1]();
  });
});
