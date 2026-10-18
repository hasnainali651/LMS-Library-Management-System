// Explicit provider isolation for unit suites. Live integration scripts must not load this file.
process.env.JWT_SECRET = 'unit-test-access-secret-not-for-deployment';
process.env.JWT_REFRESH_SECRET = 'unit-test-refresh-secret-not-for-deployment';
process.env.REDIS_ENABLED = 'true';
jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  status: 'ready', on: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1), incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1), ttl: jest.fn().mockResolvedValue(3600),
  ping: jest.fn().mockResolvedValue('PONG'), keys: jest.fn().mockResolvedValue([]),
  connect: jest.fn().mockResolvedValue(), quit: jest.fn().mockResolvedValue(), disconnect: jest.fn(),
})));
jest.mock('bull', () => jest.fn().mockImplementation(() => ({
  client: { status: 'ready' }, on: jest.fn().mockReturnThis(), process: jest.fn(),
  add: jest.fn().mockRejectedValue(new Error('Unit test must explicitly mock queue submission')),
  close: jest.fn().mockResolvedValue(), getJobCounts: jest.fn().mockResolvedValue({ waiting: 0 }),
})));
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({
  sendMail: jest.fn().mockRejectedValue(new Error('Unit test must explicitly mock SMTP delivery')),
  verify: jest.fn().mockRejectedValue(new Error('SMTP disabled in unit tests')),
})) }));
jest.mock('@google/generative-ai', () => ({ GoogleGenerativeAI: jest.fn(() => {
  throw new Error('Gemini disabled in unit tests');
}) }), { virtual: true });
jest.mock('@google/genai', () => ({ GoogleGenAI: jest.fn(() => {
  throw new Error('Gemini disabled in unit tests');
}) }), { virtual: true });
global.fetch = jest.fn().mockRejectedValue(new Error('Unit test must explicitly mock HTTP providers'));
