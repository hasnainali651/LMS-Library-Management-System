const Queue = require('bull');
const redis = require('./redis');

const defaultJobOptions = Object.freeze({
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 500,
});
let notificationQueue;

const getNotificationQueue = () => {
  if (process.env.REDIS_ENABLED === 'false' || redis.status !== 'ready') {
    throw new Error('Notification queue requires a ready Redis connection');
  }
  if (!notificationQueue) {
    notificationQueue = new Queue('notifications', process.env.REDIS_URL, {
      defaultJobOptions,
      redis: { maxRetriesPerRequest: null, enableReadyCheck: false },
    });
    notificationQueue.on('error', () => console.error('[Queue:notifications] Redis connection failure'));
  }
  return notificationQueue;
};

const closeQueues = async () => {
  if (notificationQueue) {
    await notificationQueue.close();
    notificationQueue = null;
  }
};

module.exports = { getNotificationQueue, closeQueues, defaultJobOptions };
