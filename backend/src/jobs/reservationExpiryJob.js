const reservationService = require('../services/reservationService');
const notificationService = require('../services/notificationService');

const runReservationExpiryJob = async () => {
  const expiredCount = await reservationService.expireHolds();
  const delivery = await notificationService.reconcilePendingDeliveries();
  if (delivery.pending) throw new Error('Pending notification delivery could not be enqueued');
  return { success: true, expiredCount, delivery };
};
module.exports = { runReservationExpiryJob };
