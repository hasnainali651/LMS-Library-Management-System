/**
 * Sanitization Middleware
 * 1. Recursively strips HTML tags (<[^>]*> → '') and null bytes (\0 → '') from all string fields in req.body.
 * 2. Scans query/body for objects with '$' keys → removes them & logs a security warning (prevents NoSQL injection like { $gt: '' }).
 */

const stripHtmlAndNull = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').replace(/\0/g, '');
};

const hasDollarKey = (obj) => {
  if (!obj || typeof obj !== 'object') return false;
  return Object.keys(obj).some((k) => k.startsWith('$') || k.includes('$'));
};

const sanitizeData = (input, path = 'body', isBody = true) => {
  if (input === null || input === undefined) return input;

  if (typeof input === 'string') {
    return isBody ? stripHtmlAndNull(input) : stripHtmlAndNull(input);
  }

  if (Array.isArray(input)) {
    return input.map((item, idx) => sanitizeData(item, `${path}[${idx}]`, isBody));
  }

  if (typeof input === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      // 1. Direct key starting with '$' or containing '$' (e.g. { "$gt": "" })
      if (key.startsWith('$') || key.includes('$')) {
        console.warn(
          `[SECURITY WARNING] Potential NoSQL injection attempt blocked in ${path}. Removed key: "${key}"`
        );
        continue;
      }

      // 2. Value is an object with '$' keys (e.g. { username: { $gt: "" } })
      if (value && typeof value === 'object' && !Array.isArray(value) && hasDollarKey(value)) {
        console.warn(
          `[SECURITY WARNING] Potential NoSQL injection attempt blocked in ${path}.${key}. Removed object with '$' operator keys.`
        );
        continue;
      }

      sanitized[key] = sanitizeData(value, `${path}.${key}`, isBody);
    }
    return sanitized;
  }

  return input;
};

const sanitize = (req, res, next) => {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeData(req.body, 'body', true);
    }

    if (req.query && typeof req.query === 'object') {
      const sanitizedQuery = sanitizeData(req.query, 'query', false);
      try {
        req.query = sanitizedQuery;
      } catch {
        for (const k of Object.keys(req.query)) delete req.query[k];
        Object.assign(req.query, sanitizedQuery);
      }
    }

    if (req.params && typeof req.params === 'object') {
      const sanitizedParams = sanitizeData(req.params, 'params', false);
      try {
        req.params = sanitizedParams;
      } catch {
        for (const k of Object.keys(req.params)) delete req.params[k];
        Object.assign(req.params, sanitizedParams);
      }
    }

    next();
  } catch (error) {
    console.error('[SECURITY ERROR] Sanitization middleware failure:', error.message);
    next(error);
  }
};

module.exports = sanitize;
