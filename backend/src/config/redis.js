const Redis = require('ioredis');
const throttleLog = require('../utils/throttleLog');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 5000,
  commandTimeout: 5000,
  retryStrategy: (times) => Math.min(times * 1000, 10000),
});
redis.on('error', () => {
  throttleLog('redis:error', () => console.error('Redis connection unavailable'));
});

redis.prepare = async () => {
  if (process.env.REDIS_ENABLED === 'false') throw new Error('Redis is required');
  if (redis.status === 'wait' || redis.status === 'end') await redis.connect();
  if (redis.status !== 'ready') throw new Error('Redis is not ready');
  if (await redis.ping() !== 'PONG') throw new Error('Redis readiness check failed');
  return redis;
};

module.exports = redis;
