const mongoose = require('mongoose');
const { getNotificationQueue, closeQueues } = require('../config/queue');
const notificationService = require('../services/notificationService');
let started = false;

const processNotificationJob = async (job) => {
  if (job.name !== 'deliver' || !job.data || Object.keys(job.data).length !== 1 || !mongoose.isValidObjectId(job.data.notificationId)) {
    throw new Error('Unsupported notification job type or data');
  }
  return notificationService.deliverNotification(job.data.notificationId, job.attemptsMade + 1, 3);
};
const initNotificationProcessor = async () => {
  if (started) return { ready: true };
  const queue = getNotificationQueue();
  await queue.isReady();
  queue.process('*', 5, processNotificationJob);
  started = true;
  return { ready: true };
};
const stopNotificationProcessor = async () => {
  await closeQueues();
  started = false;
  return { ready: false };
};
const isNotificationProcessorReady = () => started;
module.exports = { initNotificationProcessor, stopNotificationProcessor, isNotificationProcessorReady, processNotificationJob };
