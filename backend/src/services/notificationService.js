const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { Notification, User } = require('../models');
const emailService = require('./emailService');
const ApiError = require('../utils/ApiError');
const { getNotificationQueue, defaultJobOptions } = require('../config/queue');
const { getIO } = require('../socket');

const id = (value) => String(value?._id || value);
const instant = (value) => new Date(value).toISOString();
const publicNotification = (notification) => {
  const value = notification.toObject ? notification.toObject() : { ...notification };
  delete value.delivery;
  delete value.dedupKey;
  return value;
};

const notificationService = {
  createNotification: async ({ userId, type, title, message, meta = {}, channels = ['in_app'], session, dedupKey, emailHtml, cc }, options = {}) => {
    channels = Array.isArray(channels) ? channels : [channels];
    if (channels.includes('sms')) throw new ApiError(503, 'SMS delivery is not configured');
    if (!channels.length || channels.some((channel) => !['in_app', 'email'].includes(channel))) throw new ApiError(400, 'Unsupported notification channel');
    session = options.session || session;
    dedupKey = options.dedupKey || dedupKey || randomUUID();
    const rawUserId = userId?._id || userId;
    const user = await User.findById(rawUserId).session(session || null);
    if (!user) throw new ApiError(404, 'Notification recipient not found');
    if (channels.includes('email') && !user.email) throw new ApiError(400, 'Notification recipient has no email address');
    const safeMeta = { ...meta };
    const html = emailHtml || safeMeta.emailHtml || `<h2>${emailService.escapeHtml(title)}</h2><p>${emailService.escapeHtml(message)}</p>`;
    delete safeMeta.emailHtml;
    delete safeMeta.password;
    delete safeMeta.tempPassword;
    delete safeMeta.token;
    const data = { user: rawUserId, type, title, message, meta: safeMeta, channel: channels,
      dedupKey, delivery: { status: 'pending', html: channels.includes('email') ? html : undefined, cc } };
    let notification;
    try {
      notification = await Notification.findOneAndUpdate({ dedupKey }, { $setOnInsert: data }, {
        upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true, session,
      }).select('+delivery +dedupKey');
    } catch (error) {
      if (error.code !== 11000 || session) throw error;
      notification = await Notification.findOne({ dedupKey }).select('+delivery +dedupKey');
    }
    // Transactional callers leave work pending until commit; reconciliation never sees uncommitted records.
    const deliveryStatus = session ? notification.delivery.status : (await notificationService.enqueueNotification(notification)).status;
    const result = publicNotification(notification);
    result.deliveryStatus = deliveryStatus;
    return result;
  },

  enqueueNotification: async (notification) => {
    if (['sent', 'failed'].includes(notification.delivery.status)) return { status: notification.delivery.status };
    try {
      const queue = getNotificationQueue();
      const jobId = `notification-${notification._id}`;
      const existing = await queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (state === 'failed') {
          await Notification.updateOne({ _id: notification._id, 'delivery.status': { $ne: 'sent' } }, { $set: { 'delivery.status': 'failed', 'delivery.error': 'Delivery attempts exhausted' } });
          return { status: 'failed' };
        }
        if (state === 'completed') await existing.remove();
      }
      await queue.add('deliver', { notificationId: id(notification) }, { ...defaultJobOptions, jobId });
      await Notification.updateOne({ _id: notification._id, 'delivery.status': 'pending' }, {
        $set: { 'delivery.status': 'queued', 'delivery.enqueuedAt': new Date() }, $unset: { 'delivery.error': 1 },
      });
      return { status: 'queued' };
    } catch (error) {
      console.error('[ENQUEUE_ERR]:', error);
      await Notification.updateOne({ _id: notification._id, 'delivery.status': { $in: ['pending', 'queued'] } }, {
        $set: { 'delivery.error': 'Queue unavailable; delivery remains pending' },
      });
      return { status: 'pending' };
    }
  },

  reconcilePendingDeliveries: async () => {
    let queued = 0;
    let pending = 0;
    const cursor = Notification.find({ 'delivery.status': { $in: ['pending', 'queued', 'delivering'] } }).select('+delivery').cursor();
    for await (const notification of cursor) {
      const result = await notificationService.enqueueNotification(notification);
      if (result.status === 'queued') queued++;
      if (result.status === 'pending') pending++;
    }
    return { queued, pending };
  },

  deliverNotification: async (notificationId, attempt = 1, maxAttempts = 3) => {
    if (!mongoose.isValidObjectId(notificationId)) throw new ApiError(400, 'Invalid notification reference');
    const notification = await Notification.findById(notificationId).select('+delivery');
    if (!notification) throw new ApiError(404, 'Notification not found');
    if (notification.delivery.status === 'sent') return { status: 'sent', alreadyDelivered: true };
    if (notification.delivery.status === 'failed') throw new ApiError(409, 'Notification delivery is terminally failed');
    const retryHtml = notification.delivery.html;
    const retryCc = notification.delivery.cc;
    try {
      notification.delivery.status = 'delivering';
      notification.delivery.attempts = attempt;
      notification.delivery.attemptedAt = new Date();
      await notification.save();
      const user = await User.findById(notification.user);
      if (!user) throw new ApiError(404, 'Notification recipient not found');
      if (notification.channel.includes('in_app') && !notification.delivery.inAppAt) {
        const io = getIO();
        if (io) io.to(`user:${id(user)}`).emit('notification:new', { notification: publicNotification(notification) });
        notification.delivery.inAppAt = new Date();
        await notification.save();
      }
      let result = null;
      if (notification.channel.includes('email')) {
        result = await emailService.sendEmail(user.email, notification.title, notification.delivery.html, notification.delivery.cc?.length ? notification.delivery.cc : null);
      }
      // SMTP is at-least-once: a crash after acceptance but before this save can resend.
      notification.delivery.status = 'sent';
      notification.delivery.sentAt = new Date();
      notification.delivery.messageId = result?.messageId;
      notification.delivery.error = undefined;
      notification.delivery.html = undefined;
      notification.delivery.cc = undefined;
      await notification.save();
      return { status: 'sent', messageId: result?.messageId };
    } catch (error) {
      notification.delivery.html = retryHtml;
      notification.delivery.cc = retryCc;
      notification.delivery.sentAt = undefined;
      notification.delivery.messageId = undefined;
      notification.delivery.status = attempt >= maxAttempts ? 'failed' : 'queued';
      notification.delivery.error = attempt >= maxAttempts ? 'Delivery attempts exhausted' : 'Delivery attempt failed';
      await notification.save();
      throw error;
    }
  },

  getDeliveryDiagnostics: async () => Notification.aggregate([
    { $group: { _id: '$delivery.status', count: { $sum: 1 } } },
  ]),

  queueEmail: async ({ userId, subject, html, dedupKey, cc = [], meta = {}, type = 'account', title, message }, options = {}) => {
    if (!subject || typeof html !== 'string') throw new ApiError(400, 'Email subject and HTML are required');
    return notificationService.createNotification({
      userId,
      type,
      title: title || subject,
      message: message || 'An email has been requested for your account.',
      meta,
      emailHtml: html,
      cc,
      channels: ['email'],
      dedupKey,
      ...options,
    });
  },

  sendDueReminder: async (transaction, daysLeft, options = {}) => notificationService.createNotification({
    userId: transaction.member, type: 'due_reminder', title: 'Due Date Reminder',
    message: `"${transaction.book?.title || 'Borrowed book'}" is due in ${daysLeft} days.`,
    meta: { transactionId: transaction._id, bookId: transaction.book?._id || transaction.book, dueDate: transaction.dueDate, daysLeft },
    emailHtml: emailService.templates.dueReminder(transaction.member?.name, transaction.book?.title, transaction.dueDate, daysLeft),
    channels: ['in_app', 'email'], dedupKey: `due:${id(transaction)}:${instant(transaction.dueDate)}:${daysLeft}`, ...options,
  }),

  sendOverdueAlert: async (transaction, milestoneOrOptions = {}, options = {}) => {
    const milestone = typeof milestoneOrOptions === 'number' ? milestoneOrOptions : (milestoneOrOptions.milestone || 1);
    if (typeof milestoneOrOptions === 'object') options = milestoneOrOptions;
    return notificationService.createNotification({
      userId: transaction.member, type: 'overdue', title: 'Overdue Book Notice',
      message: `"${transaction.book?.title || 'Borrowed book'}" is overdue. Current accrued fine: PKR ${transaction.fineAmount ?? 0}.`,
      meta: { transactionId: transaction._id, dueDate: transaction.dueDate, milestone },
      emailHtml: emailService.templates.overdueAlert(transaction.member?.name, transaction.book?.title, transaction.dueDate, transaction.fineAmount),
      channels: ['in_app', 'email'], dedupKey: `overdue:${id(transaction)}:${instant(transaction.dueDate)}:${milestone}`, ...options,
    });
  },

  sendReservationReady: async (reservation, book, options = {}) => notificationService.createNotification({
    userId: reservation.member, type: 'reservation_ready', title: 'Reserved Book Ready for Pickup',
    message: `"${book?.title || reservation.book?.title || 'Reserved book'}" is ready for pickup until ${instant(reservation.expiresAt)}.`,
    meta: { reservationId: reservation._id, bookId: book?._id || reservation.book?._id || reservation.book, expiresAt: reservation.expiresAt },
    emailHtml: emailService.templates.reservationReady(reservation.member?.name, book?.title || reservation.book?.title, reservation.expiresAt),
    channels: ['in_app', 'email'], dedupKey: `hold:${id(reservation)}:${instant(reservation.expiresAt)}`, ...options,
  }),

  sendFineAdded: async (member, fine, options = {}) => notificationService.createNotification({
    userId: member, type: 'fine_added', title: 'New Fine Assessed',
    message: `A fine of PKR ${fine.amount} was assessed. Outstanding balance: PKR ${member.fineBalance ?? fine.amount}.`,
    meta: { fineId: fine._id, amount: fine.amount, balance: member.fineBalance ?? fine.amount, reason: fine.reason },
    emailHtml: emailService.templates.fineAdded(member.name, fine.amount, member.fineBalance ?? fine.amount, fine.reason),
    channels: ['in_app', 'email'], dedupKey: `fine:${id(fine)}:${fine.amount}`, ...options,
  }),

  sendMembershipExpiring: async (member, daysLeft, options = {}) => notificationService.createNotification({
    userId: member, type: 'membership_expiry', title: `Membership Expiring in ${daysLeft} Days`,
    message: `Your library membership expires in ${daysLeft} days. Please renew your membership.`,
    meta: { expiryDate: member.membershipExpiry, daysLeft },
    emailHtml: emailService.templates.membershipExpiring(member.name, daysLeft, member.membershipExpiry),
    channels: ['in_app', 'email'], dedupKey: `membership:${id(member)}:${instant(member.membershipExpiry)}:${daysLeft}`, ...options,
  }),

  sendWelcome: async (member, tempPassword, options = {}) => notificationService.createNotification({
    userId: member, type: 'account', title: 'Welcome to the Library System',
    message: `Welcome to the library! Your Member ID is ${member.memberId || ''}.`, meta: { memberId: member.memberId },
    emailHtml: tempPassword ? emailService.templates.welcomeMemberWithCredentials(member.name, member.memberId, member.email, tempPassword) : emailService.templates.welcomeEmail(member.name, member.memberId),
    channels: ['in_app', 'email'], dedupKey: `welcome:${id(member)}`, ...options,
  }),

  sendAccountSuspended: async (member, reason, options = {}) => notificationService.createNotification({
    userId: member, type: 'account', title: 'Account Suspended', message: `Your account is suspended. Reason: ${reason || 'Administrative review'}.`,
    emailHtml: emailService.templates.accountSuspended(member.name, reason), channels: ['in_app', 'email'], ...options,
  }),

  sendAccountActivated: async (member, options = {}) => notificationService.createNotification({
    userId: member, type: 'account', title: 'Account Reactivated', message: 'Your account has been reactivated.',
    emailHtml: emailService.templates.accountActivated(member.name), channels: ['in_app', 'email'], ...options,
  }),

  sendAccountEmail: async (user, subject, html, options = {}) => notificationService.createNotification({
    userId: user, type: 'account', title: subject, message: 'An account email has been requested.',
    emailHtml: html, channels: ['email'], ...options,
  }),

  sendWeeklyReport: async (admin, stats, weekStart, options = {}) => notificationService.createNotification({
    userId: admin, type: 'system', title: 'Weekly Library Executive Operations Report',
    message: 'The previous calendar week library report is available by email.',
    emailHtml: emailService.templates.weeklyLibraryReport(stats), channels: ['email'],
    dedupKey: `report:${instant(weekStart)}:${id(admin)}`, ...options,
  }),
};
module.exports = notificationService;
