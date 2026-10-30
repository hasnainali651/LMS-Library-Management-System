const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
require('./utils/validateEnv')();

const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');
const redis = require('./config/redis');
const { initSocket, closeSocket } = require('./socket');
const { initCronJobs, startCronJobs, stopCronJobs, reconcileStartup } = require('./jobs/cronJobs');
const { initNotificationProcessor, stopNotificationProcessor } = require('./jobs/notificationProcessor');
const notificationService = require('./services/notificationService');
const { Notification } = require('./models');
const server = http.createServer(app);
let shutdown;

const gracefulShutdown = async () => {
  if (shutdown) return shutdown;
  app.locals.ready = false;
  shutdown = (async () => {
    const httpClosed = new Promise((resolve, reject) => {
      if (!server.listening) return resolve();
      server.close((error) => error ? reject(error) : resolve());
      server.closeIdleConnections?.();
    });
    const results = await Promise.allSettled([httpClosed, closeSocket(), stopCronJobs()]);
    const cleanup = async (operation) => {
      try { await operation(); } catch (reason) { results.push({ status: 'rejected', reason }); }
    };
    await cleanup(stopNotificationProcessor);
    await cleanup(() => mongoose.connection.close(false));
    await cleanup(async () => {
      if (redis.status === 'ready') {
        try {
          await redis.quit();
        } catch {
          redis.disconnect();
        }
      } else {
        redis.disconnect();
      }
    });
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
  })();
  return shutdown;
};

const startServer = async () => {
  shutdown = null;
  app.locals.ready = false;
  try {
    await redis.prepare();
    await connectDB();
    initCronJobs();
    await Notification.createIndexes();
    initSocket(server);
    await initNotificationProcessor();
    const delivery = await notificationService.reconcilePendingDeliveries();
    if (delivery.pending) throw new Error('Notification reconciliation failed');
    await reconcileStartup();
    startCronJobs();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(process.env.PORT || 5000, () => { server.removeListener('error', reject); resolve(); });
    });
    app.locals.ready = true;
    console.log(`LMS API listening on port ${server.address().port}`);
    return server;
  } catch (error) {
    try {
      await gracefulShutdown();
    } catch (shutdownErr) {
      // Avoid masking the original startup failure
    }
    throw error;
  }
};

if (require.main === module) {
  startServer().catch((err) => { console.error('Server startup failed:', err); process.exitCode = 1; });
  const stop = () => {
    const timeout = setTimeout(() => { console.error('Shutdown drain timed out'); process.exit(1); }, 60000);
    timeout.unref();
    gracefulShutdown().then(() => { clearTimeout(timeout); process.exitCode = 0; }, () => { clearTimeout(timeout); process.exitCode = 1; });
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}
module.exports = server;
module.exports.startServer = startServer;
module.exports.gracefulShutdown = gracefulShutdown;
