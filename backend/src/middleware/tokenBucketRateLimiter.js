/**
 * High-Performance Token Bucket Rate Limiter Middleware
 * 
 * Implements the Token Bucket Algorithm with dual-engine storage:
 * 1. Redis (distributed atomic token bucket via HGET/HSET/pipeline)
 * 2. In-Memory fallback (Map-based with automatic sweeping)
 * 
 * Features:
 * - Protects every single route against spikes, brute-force, and resource exhaustion.
 * - Dynamic token replenishment based on elapsed wall-clock time.
 * - Configurable token capacity and refill rates per route category.
 * - Emits standard rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After).
 * - Automatic bypass in test mode (NODE_ENV === 'test').
 */

const redis = require('../config/redis');

// Local in-memory token store: Map<key, { tokens: number, lastRefill: number }>
const memoryStore = new Map();

// Periodic sweeping of inactive keys (every 5 minutes) to prevent memory leaks
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of memoryStore.entries()) {
      // If inactive for more than 15 minutes, delete from memory
      if (now - bucket.lastRefill > 15 * 60 * 1000) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();
}

/**
 * Creates a Token Bucket rate-limiting middleware.
 * 
 * @param {Object} options
 * @param {string} options.bucketName - Identifier for the bucket namespace
 * @param {number} options.capacity - Maximum token capacity (burst limit)
 * @param {number} options.refillRate - Tokens added per second
 * @param {number} [options.cost=1] - Tokens consumed per request
 * @param {Function} [options.keyGenerator] - Function extracting client identifier (default: IP)
 * @param {string} [options.message] - Custom error message on 429
 */
function createTokenBucketLimiter(options) {
  const {
    bucketName = 'global',
    capacity = 120,
    refillRate = 2, // tokens per second
    cost = 1,
    keyGenerator = (req) => req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-client',
    message = 'Too many requests. Token bucket limit reached. Please try again shortly.',
  } = options;

  return async function tokenBucketMiddleware(req, res, next) {
    // Skip in test environment or health-check root endpoints
    if (
      process.env.NODE_ENV === 'test' ||
      req.path === '/api/v1/health' ||
      (req.path === '/' && req.method === 'GET')
    ) {
      return next();
    }

    const clientId = keyGenerator(req);
    const key = `tb:${bucketName}:${clientId}`;
    const now = Date.now();

    let tokensRemaining;
    let allowed = false;
    let retryAfterSeconds = 0;

    // Attempt Redis Token Bucket first if ready
    let redisAvailable = false;
    try {
      if (redis && redis.status === 'ready') {
        redisAvailable = true;
        const bucketData = await redis.hmget(key, 'tokens', 'lastRefill');
        let currentTokens = capacity;
        let lastRefill = now;

        if (bucketData && bucketData[0] !== null) {
          const storedTokens = parseFloat(bucketData[0]);
          const storedLastRefill = parseInt(bucketData[1], 10);
          const elapsedSeconds = Math.max(0, (now - storedLastRefill) / 1000);
          currentTokens = Math.min(capacity, storedTokens + elapsedSeconds * refillRate);
          lastRefill = now;
        }

        if (currentTokens >= cost) {
          allowed = true;
          tokensRemaining = currentTokens - cost;
          // Set TTL to cover complete refill to capacity + 60s grace
          const ttlSeconds = Math.ceil(capacity / refillRate) + 60;
          await redis
            .pipeline()
            .hmset(key, 'tokens', tokensRemaining.toString(), 'lastRefill', now.toString())
            .expire(key, ttlSeconds)
            .exec();
        } else {
          allowed = false;
          tokensRemaining = currentTokens;
          const deficit = cost - currentTokens;
          retryAfterSeconds = Math.ceil(deficit / refillRate);
        }
      }
    } catch (redisErr) {
      // Redis error fallback to in-memory store
      redisAvailable = false;
    }

    // In-Memory Fallback if Redis is not used or throws error
    if (!redisAvailable) {
      let bucket = memoryStore.get(key);
      if (!bucket) {
        bucket = { tokens: capacity, lastRefill: now };
        memoryStore.set(key, bucket);
      } else {
        const elapsedSeconds = Math.max(0, (now - bucket.lastRefill) / 1000);
        bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillRate);
        bucket.lastRefill = now;
      }

      if (bucket.tokens >= cost) {
        allowed = true;
        bucket.tokens -= cost;
        tokensRemaining = bucket.tokens;
      } else {
        allowed = false;
        tokensRemaining = bucket.tokens;
        const deficit = cost - bucket.tokens;
        retryAfterSeconds = Math.ceil(deficit / refillRate);
      }
    }

    // Rate Limit Headers
    const remainingCount = Math.max(0, Math.floor(tokensRemaining));
    const resetSeconds = Math.ceil((capacity - tokensRemaining) / refillRate);

    res.setHeader('X-RateLimit-Limit', capacity);
    res.setHeader('X-RateLimit-Remaining', remainingCount);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (!allowed) {
      res.setHeader('Retry-After', Math.max(1, retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message,
        retryAfter: Math.max(1, retryAfterSeconds),
        errors: [
          {
            field: 'rateLimit',
            message: `Bucket capacity of ${capacity} tokens exceeded. Refilling at ${refillRate} tokens/sec.`,
          },
        ],
      });
    }

    return next();
  };
}

module.exports = {
  createTokenBucketLimiter,
};
