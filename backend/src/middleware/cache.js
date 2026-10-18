const redis = require('../config/redis');

/**
 * Redis Cache Middleware Factory
 * @param {string | ((req: import('express').Request) => string)} keyGenerator Cache key string or function
 * @param {number} ttlSeconds Time-to-live in seconds
 * @param {((req: import('express').Request) => boolean) | null} condition Optional condition to evaluate before caching
 */
const cacheMiddleware = (keyGenerator, ttlSeconds = 60, condition = null) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check optional condition (e.g. only cache when no query parameters are present)
    if (condition && !condition(req)) {
      return next();
    }

    // Check if Redis is operational
    if (!redis || redis.status !== 'ready') {
      return next();
    }

    let cacheKey;
    try {
      cacheKey = typeof keyGenerator === 'function' ? keyGenerator(req) : keyGenerator;
    } catch (err) {
      return next();
    }

    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(JSON.parse(cachedData));
      }
    } catch (err) {
      console.warn(`[RedisCache] Cache lookup failed for ${cacheKey}:`, err.message);
    }

    res.setHeader('X-Cache', 'MISS');

    // Intercept res.json to store the response payload in Redis
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200 && redis && redis.status === 'ready') {
        try {
          redis.set(cacheKey, JSON.stringify(body), 'EX', ttlSeconds).catch(() => {});
        } catch (err) {
          // Non-blocking caching error
        }
      }
      return originalJson(body);
    };

    next();
  };
};

/**
 * Invalidate Redis cache keys or patterns
 * @param  {...string} patterns Cache keys or glob patterns (e.g. 'analytics:dashboard', 'books:list:*')
 */
const invalidateCache = async (...patterns) => {
  if (!redis || redis.status !== 'ready') return;

  for (const pattern of patterns) {
    try {
      if (pattern.includes('*')) {
        const keys = await redis.keys(pattern);
        if (keys && keys.length > 0) {
          await redis.del(...keys);
          console.log(`[RedisCache] Invalidated ${keys.length} keys matching pattern: ${pattern}`);
        }
      } else {
        await redis.del(pattern);
        console.log(`[RedisCache] Invalidated key: ${pattern}`);
      }
    } catch (err) {
      console.warn(`[RedisCache] Invalidation error for pattern "${pattern}":`, err.message);
    }
  }
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
};
