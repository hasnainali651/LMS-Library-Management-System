const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '../..');
const target = path.join(root, '.env.docker.local');
const readEnv = (file) => fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
const existing = readEnv(target);
const source = { ...readEnv(path.join(root, '.env')), ...readEnv(path.join(root, 'backend/.env')), ...process.env };
let password = existing.REDIS_PASSWORD || source.REDIS_PASSWORD;
if (!password && source.REDIS_URL) {
  try { password = decodeURIComponent(new URL(source.REDIS_URL).password); } catch { throw new Error('Invalid REDIS_URL'); }
}
password ||= crypto.randomBytes(32).toString('hex');
if (/[\r\n]/.test(password)) throw new Error('Redis password cannot contain line breaks');
const settings = {
  ...existing,
  REDIS_PASSWORD: password,
  REDIS_URL: `redis://:${encodeURIComponent(password)}@redis:6379`,
  FRONTEND_URL: existing.FRONTEND_URL || source.FRONTEND_URL || 'http://localhost:3000',
  LIBRARY_TIMEZONE: existing.LIBRARY_TIMEZONE || source.LIBRARY_TIMEZONE || 'Asia/Karachi',
  RESERVATION_HOLD_HOURS: existing.RESERVATION_HOLD_HOURS || source.RESERVATION_HOLD_HOURS || '48',
};
if (!settings.GEMINI_MODEL && source.GEMINI_MODEL) settings.GEMINI_MODEL = source.GEMINI_MODEL;
fs.writeFileSync(target, Object.entries(settings).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
console.log('Prepared ignored .env.docker.local; real environment files unchanged. No model selected without a successful live check.');
