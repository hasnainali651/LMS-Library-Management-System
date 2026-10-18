const { IANAZone } = require("luxon");

const requiredVariables = [
  "NODE_ENV",
  "MONGO_URI",
  "REDIS_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "MAIL_HOST",
  "MAIL_USER",
  "MAIL_PASS",
  "FRONTEND_URL",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
];
const hasProtocol = (value, protocols) => {
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
};
const positiveInteger = (value) =>
  /^\d+$/.test(value) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0;
const validateEnv = (env = process.env) => {
  const validators = {
    NODE_ENV: (value) => ["development", "test", "production"].includes(value),
    MONGO_URI: (value) =>
      /^mongodb(?:\+srv)?:\/\/[^/\s]+(?:\/[^\s]*)?$/.test(value),
    REDIS_URL: (value) => hasProtocol(value, ["redis:", "rediss:"]),
    JWT_SECRET: (value) => value.trim().length >= 32,
    JWT_REFRESH_SECRET: (value) => value.trim().length >= 32,
    FRONTEND_URL: (value) => hasProtocol(value, ["http:", "https:"]),
    GEMINI_MODEL: (value) =>
      /^gemini-[\w.-]+$/.test(value) &&
      !/preview|latest|experimental/.test(value),
    LIBRARY_TIMEZONE: (value) => IANAZone.isValidZone(value),
    RESERVATION_HOLD_HOURS: (value) =>
      positiveInteger(value) && Number(value) <= 8760,
    MAIL_PORT: (value) => positiveInteger(value) && Number(value) <= 65535,
    PORT: (value) => positiveInteger(value) && Number(value) <= 65535,
  };
  const invalidVariables = requiredVariables.filter((name) => {
    const value = env[name];
    return (
      typeof value !== "string" ||
      !value.trim() ||
      /^(?:your_|replace-with)/i.test(value) ||
      (validators[name] && !validators[name](value))
    );
  });
  for (const name of [
    "LIBRARY_TIMEZONE",
    "RESERVATION_HOLD_HOURS",
    "MAIL_PORT",
    "PORT",
  ]) {
    if (env[name] !== undefined && !validators[name](env[name]))
      invalidVariables.push(name);
  }
  if (invalidVariables.length) {
    invalidVariables.forEach((name) =>
      console.error(`Missing or invalid environment variable: ${name}`),
    );
    throw new Error("Server startup aborted: missing environment variables");
  }
};
module.exports = validateEnv;
