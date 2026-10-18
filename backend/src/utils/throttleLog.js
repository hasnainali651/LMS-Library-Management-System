const lastLogAt = new Map();

const throttleLog = (key, fn, intervalMs = 30000) => {
  const now = Date.now();
  const last = lastLogAt.get(key) || 0;
  if (now - last < intervalMs) {
    return;
  }
  lastLogAt.set(key, now);
  fn();
};

module.exports = throttleLog;
