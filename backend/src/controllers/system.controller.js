const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const redis = require('../config/redis');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getLibrarySettings } = require('../config/library');
const { getNotificationQueue } = require('../config/queue');
const { isNotificationProcessorReady } = require('../jobs/notificationProcessor');
const { getCronStatus } = require('../jobs/cronJobs');
const { getActiveSocketConnections } = require('../socket/socketManager');
const notificationService = require('../services/notificationService');

const bounded = async (operation, milliseconds = 2000) => {
  let timeout;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((resolve, reject) => { timeout = setTimeout(() => reject(new Error('Dependency check timed out')), milliseconds); }),
    ]);
  } finally { clearTimeout(timeout); }
};
const probe = async (available, operation) => {
  if (!available) return 'disconnected';
  try { return await bounded(operation) ? 'connected' : 'disconnected'; }
  catch (error) { return 'disconnected'; }
};
const getReadiness = asyncHandler(async (req, res) => {
  const [mongodb, redisStatus] = await Promise.all([
    probe(mongoose.connection.readyState === 1, async () => (await mongoose.connection.db.admin().ping({ maxTimeMS: 1500 })).ok === 1),
    probe(redis.status === 'ready', async () => await redis.ping() === 'PONG'),
  ]);
  const worker = isNotificationProcessorReady() ? 'ready' : 'not_ready';
  const ready = mongodb === 'connected' && redisStatus === 'connected' && worker === 'ready';
  res.set('Cache-Control', 'no-store');
  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'unavailable', uptime: process.uptime(), mongodb, redis: redisStatus, worker, version: '1.0.0',
  });
});
const countUploads = async (directory) => {
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
  const counts = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? countUploads(path.join(directory, entry.name)) : Number(entry.isFile())));
  return counts.reduce((total, count) => total + count, 0);
};
const getQueueStats = async () => {
  try {
    if (redis.status !== 'ready' || !isNotificationProcessorReady()) return { status: 'unavailable', counts: null };
    const counts = await bounded(() => getNotificationQueue().getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused'));
    return { status: 'ready', counts };
  } catch (error) { return { status: 'unavailable', counts: null }; }
};
const getPublicSettings = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, getLibrarySettings(), 'Public library settings.')));
const getSystemStatus = asyncHandler(async (req, res) => {
  const [totalUploads, notifications, delivery] = await Promise.all([
    countUploads(path.resolve(__dirname, '../../uploads')),
    getQueueStats(),
    bounded(() => notificationService.getDeliveryDiagnostics()),
  ]);
  return res.status(200).json(new ApiResponse(200, {
    totalUploads, queueStats: { notifications }, delivery,
    cronStatus: getCronStatus(), activeSocketConnections: getActiveSocketConnections(),
  }, 'System runtime status.'));
});
module.exports = { getPublicSettings, getSystemStatus, getReadiness };
