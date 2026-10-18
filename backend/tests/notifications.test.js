jest.mock('../src/config/redis', () => ({ status: 'ready', set: jest.fn(), eval: jest.fn(), get: jest.fn() }));
jest.mock('bull', () => jest.fn());
jest.mock('node-cron', () => ({ schedule: jest.fn(() => ({ start: jest.fn(), stop: jest.fn() })) }));
jest.mock('../src/socket', () => ({ getIO: jest.fn(), disconnectUser: jest.fn() }));
const mongoose = require('mongoose');
const { Notification, User, Transaction, Fine } = require('../src/models');
const service = require('../src/services/notificationService');
const email = require('../src/services/emailService');
const transporter = require('../src/config/mail');
const redis = require('../src/config/redis');
const Queue = require('bull');
const queues = require('../src/config/queue');
const worker = require('../src/jobs/notificationProcessor');
const cron = require('node-cron');
const jobs = require('../src/jobs/cronJobs');
const fineService = require('../src/services/fineService');
const reservations = require('../src/services/reservationService');
const { getIO } = require('../src/socket');
const controller = require('../src/controllers/notification.controller');
const originalEnv = { ...process.env };
const objectId = () => new mongoose.Types.ObjectId();
let queue;
const query = (value) => ({ select: jest.fn().mockResolvedValue(value), session: jest.fn().mockResolvedValue(value), populate: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(value) }) });

beforeEach(() => {
  process.env.LIBRARY_TIMEZONE = 'Asia/Karachi';
  process.env.REDIS_ENABLED = 'true';
  redis.status = 'ready';
  redis.set.mockResolvedValue('OK');
  redis.eval.mockResolvedValue(1);
  queue = { on: jest.fn(), getJob: jest.fn().mockResolvedValue(null), add: jest.fn().mockResolvedValue({ id: 'actual-job' }), close: jest.fn().mockResolvedValue(), isReady: jest.fn().mockResolvedValue(), process: jest.fn() };
  Queue.mockImplementation(() => queue);
});
afterEach(async () => {
  await worker.stopNotificationProcessor();
  await jobs.stopCronJobs();
  jest.restoreAllMocks();
  jest.clearAllMocks();
  process.env = { ...originalEnv };
});

const notification = (overrides = {}) => ({
  _id: objectId(), user: objectId(), type: 'account', title: 'Notice', message: 'Body', channel: ['in_app', 'email'], meta: {},
  delivery: { status: 'pending', html: '<p>private template</p>', attempts: 0 }, save: jest.fn().mockResolvedValue(), ...overrides,
});

it('constructs one lazy canonical queue and applies the exact retry policy', () => {
  expect(Queue).not.toHaveBeenCalled();
  expect(queues.getNotificationQueue()).toBe(queue);
  expect(queues.getNotificationQueue()).toBe(queue);
  expect(Queue).toHaveBeenCalledTimes(1);
  expect(Queue).toHaveBeenCalledWith('notifications', process.env.REDIS_URL, expect.objectContaining({ defaultJobOptions: expect.objectContaining({ attempts: 3, backoff: { type: 'exponential', delay: 5000 } }) }));
});
it('rejects disabled or unavailable Redis instead of fabricating a queue', () => {
  redis.status = 'end';
  expect(queues.getNotificationQueue).toThrow('ready Redis');
  redis.status = 'ready'; process.env.REDIS_ENABLED = 'false';
  expect(queues.getNotificationQueue).toThrow('ready Redis');
  expect(Queue).not.toHaveBeenCalled();
});
it('rejects SMS before recipient reads or writes', async () => {
  const read = jest.spyOn(User, 'findById');
  const write = jest.spyOn(Notification, 'findOneAndUpdate');
  await expect(service.createNotification({ userId: objectId(), channels: ['email', 'sms'] })).rejects.toMatchObject({ statusCode: 503 });
  expect(read).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
});
it('persists private email HTML and queues only the notification ID without SMTP in producer', async () => {
  const doc = notification();
  jest.spyOn(User, 'findById').mockReturnValue(query({ _id: doc.user, email: 'reader@example.org' }));
  const insert = jest.spyOn(Notification, 'findOneAndUpdate').mockReturnValue(query(doc));
  jest.spyOn(Notification, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
  const smtp = jest.spyOn(email, 'sendEmail');
  const result = await service.createNotification({ userId: doc.user, type: 'account', title: 'Notice', message: 'Body', meta: { emailHtml: 'private', tempPassword: 'secret', bookId: 'book' }, channels: ['email'], dedupKey: 'occurrence' });
  expect(insert.mock.calls[0][1].$setOnInsert.meta).toEqual({ bookId: 'book' });
  expect(insert.mock.calls[0][1].$setOnInsert.delivery.html).toBe('private');
  expect(queue.add).toHaveBeenCalledWith('deliver', { notificationId: String(doc._id) }, expect.objectContaining({ attempts: 3, backoff: { type: 'exponential', delay: 5000 }, jobId: `notification-${doc._id}` }));
  expect(result.deliveryStatus).toBe('queued');
  expect(result.delivery).toBeUndefined(); expect(result.dedupKey).toBeUndefined(); expect(smtp).not.toHaveBeenCalled();
});
it('participates in the supplied transaction and never enqueues uncommitted work', async () => {
  const doc = notification(); const session = {};
  jest.spyOn(User, 'findById').mockReturnValue(query({ email: 'reader@example.org' }));
  const insert = jest.spyOn(Notification, 'findOneAndUpdate').mockReturnValue(query(doc));
  const enqueue = jest.spyOn(service, 'enqueueNotification');
  const result = await service.createNotification({ userId: doc.user, type: 'account', title: 'Notice', message: 'Body', session, dedupKey: 'atomic' });
  expect(insert).toHaveBeenCalledWith({ dedupKey: 'atomic' }, expect.any(Object), expect.objectContaining({ session }));
  expect(enqueue).not.toHaveBeenCalled(); expect(result.deliveryStatus).toBe('pending');
});
it('returns pending rather than rollback/success when enqueue fails after persistence', async () => {
  queue.add.mockRejectedValue(new Error('offline'));
  jest.spyOn(Notification, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
  expect(await service.enqueueNotification(notification())).toEqual({ status: 'pending' });
});
it('reconciles pending records and retains canonical job IDs', async () => {
  const doc = notification();
  jest.spyOn(Notification, 'find').mockReturnValue({ select: () => ({ cursor: async function* () { yield doc; } }) });
  jest.spyOn(Notification, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
  expect(await service.reconcilePendingDeliveries()).toEqual({ queued: 1, pending: 0 });
  expect(queue.add.mock.calls[0][2].jobId).toBe(`notification-${doc._id}`);
});
it('marks terminal Bull failures without re-enqueueing an exhausted job', async () => {
  queue.getJob.mockResolvedValue({ getState: async () => 'failed' });
  const update = jest.spyOn(Notification, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
  expect(await service.enqueueNotification(notification())).toEqual({ status: 'failed' });
  expect(queue.add).not.toHaveBeenCalled();
  expect(update.mock.calls[0][1].$set['delivery.status']).toBe('failed');
});
it('delivers only to the database owner room and marks sent after SMTP acceptance', async () => {
  const doc = notification(); const emit = jest.fn(); const to = jest.fn(() => ({ emit }));
  getIO.mockReturnValue({ to });
  jest.spyOn(Notification, 'findById').mockReturnValue(query(doc));
  jest.spyOn(User, 'findById').mockResolvedValue({ _id: doc.user, email: 'reader@example.org' });
  jest.spyOn(email, 'sendEmail').mockImplementation(async () => {
    expect(doc.delivery.status).toBe('delivering'); return { messageId: 'provider-id', accepted: ['reader@example.org'] };
  });
  expect(await service.deliverNotification(String(doc._id))).toEqual({ status: 'sent', messageId: 'provider-id' });
  expect(to).toHaveBeenCalledTimes(1); expect(to).toHaveBeenCalledWith(`user:${doc.user}`);
  expect(emit.mock.calls[0][1].notification.delivery).toBeUndefined();
  expect(doc.delivery.html).toBeUndefined(); expect(doc.delivery.status).toBe('sent');
});
it('retries SMTP errors, persists terminal failure and does not duplicate a sent record', async () => {
  const doc = notification({ channel: ['email'] });
  jest.spyOn(Notification, 'findById').mockReturnValue(query(doc));
  jest.spyOn(User, 'findById').mockResolvedValue({ email: 'reader@example.org' });
  const smtp = jest.spyOn(email, 'sendEmail').mockRejectedValue(new Error('provider error with private contents'));
  await expect(service.deliverNotification(String(doc._id), 1)).rejects.toThrow();
  expect(doc.delivery.status).toBe('queued'); expect(doc.delivery.error).not.toContain('private');
  await expect(service.deliverNotification(String(doc._id), 3)).rejects.toThrow();
  expect(doc.delivery.status).toBe('failed'); expect(doc.delivery.attempts).toBe(3);
  doc.delivery.status = 'sent'; smtp.mockClear();
  expect(await service.deliverNotification(String(doc._id))).toMatchObject({ alreadyDelivered: true });
  expect(smtp).not.toHaveBeenCalled();
});
it('documents the at-least-once SMTP crash window: unsaved delivery can resend', async () => {
  const doc = notification({ channel: ['email'], delivery: { status: 'delivering', html: 'persisted body' } });
  jest.spyOn(Notification, 'findById').mockReturnValue(query(doc));
  jest.spyOn(User, 'findById').mockResolvedValue({ email: 'reader@example.org' });
  const smtp = jest.spyOn(email, 'sendEmail').mockResolvedValue({ messageId: 'provider-acceptance' });
  await service.deliverNotification(String(doc._id), 2);
  expect(smtp).toHaveBeenCalledTimes(1);
});
it('retains retry material when SMTP accepted but the sent-state write fails', async () => {
  const doc = notification({ channel: ['email'], delivery: { status: 'pending', html: 'retry body', cc: ['staff@example.org'] } });
  doc.save.mockResolvedValueOnce().mockRejectedValueOnce(new Error('write failed')).mockResolvedValueOnce();
  jest.spyOn(Notification, 'findById').mockReturnValue(query(doc));
  jest.spyOn(User, 'findById').mockResolvedValue({ email: 'reader@example.org' });
  jest.spyOn(email, 'sendEmail').mockResolvedValue({ messageId: 'provider-acceptance' });
  await expect(service.deliverNotification(String(doc._id))).rejects.toThrow('write failed');
  expect(doc.delivery).toMatchObject({ status: 'queued', html: 'retry body', cc: ['staff@example.org'] });
  expect(doc.delivery.sentAt).toBeUndefined(); expect(doc.delivery.messageId).toBeUndefined();
});
it('private delivery/template fields are excluded by query defaults and JSON serialization', () => {
  const doc = new Notification({ user: objectId(), type: 'account', title: 'Title', message: 'Body', dedupKey: 'secret', delivery: { html: 'password', status: 'pending' } });
  expect(doc.toJSON().delivery).toBeUndefined(); expect(doc.toObject().dedupKey).toBeUndefined();
  expect(Notification.schema.path('delivery').options.select).toBe(false);
  expect(Notification.schema.indexes()).toContainEqual([{ dedupKey: 1 }, expect.objectContaining({ unique: true })]);
});
it('worker validates job type/data and invokes delivery rather than recursive creation', async () => {
  await expect(worker.processNotificationJob({ name: 'unknown', data: {} })).rejects.toThrow('Unsupported');
  await expect(worker.processNotificationJob({ name: 'deliver', data: { notificationId: String(objectId()), html: 'untrusted' } })).rejects.toThrow('Unsupported');
  const deliver = jest.spyOn(service, 'deliverNotification').mockResolvedValue({ status: 'sent' });
  const notificationId = String(objectId());
  await worker.processNotificationJob({ name: 'deliver', data: { notificationId }, attemptsMade: 1 });
  expect(deliver).toHaveBeenCalledWith(notificationId, 2, 3);
  await worker.initNotificationProcessor(); await worker.initNotificationProcessor();
  expect(queue.process).toHaveBeenCalledTimes(1);
});
it('uses occurrence-specific keys across renewals, milestones, holds, fines, memberships and reports', async () => {
  const create = jest.spyOn(service, 'createNotification').mockResolvedValue({});
  const member = { _id: objectId(), membershipExpiry: new Date('2026-11-01'), fineBalance: 5 };
  const loan = { _id: objectId(), member, book: { title: '<script>book</script>' }, dueDate: new Date('2026-10-15') };
  await service.sendDueReminder(loan, 3); const first = create.mock.calls.at(-1)[0].dedupKey;
  await service.sendDueReminder(loan, 1); expect(create.mock.calls.at(-1)[0].dedupKey).not.toBe(first);
  loan.dueDate = new Date('2026-10-18'); await service.sendDueReminder(loan, 3); expect(create.mock.calls.at(-1)[0].dedupKey).not.toBe(first);
  await service.sendOverdueAlert(loan, 14); expect(create.mock.calls.at(-1)[0].dedupKey).toContain(':14');
  await service.sendReservationReady({ _id: objectId(), member, expiresAt: new Date('2026-10-18') }, loan.book);
  await service.sendFineAdded(member, { _id: objectId(), amount: 5 });
  await service.sendMembershipExpiring(member, 7);
  await service.sendWelcome(member, 'private-password'); expect(create.mock.calls.at(-1)[0].message).not.toContain('private-password');
  await service.sendAccountSuspended(member, 'review'); await service.sendAccountActivated(member);
  await service.sendWeeklyReport(member, { newMembers: 0, newIssues: 0, finesCollected: 0, totalFinesAssessed: 0, topBooks: [] }, new Date('2026-10-05'));
  expect(create.mock.calls.at(-1)[0].dedupKey).toContain(String(member._id));
});
it('escapes every untrusted template value and refuses unsafe links', () => {
  expect(email.templates.dueReminder('<script>', '"<&', new Date(), 3)).not.toContain('<script>');
  expect(email.templates.weeklyLibraryReport({ topBooks: [{ title: '<script>', count: 1 }] })).not.toContain('<script>');
  expect(() => email.templates.resetPassword('Name', 'javascript:alert(1)')).toThrow();
});
it('SMTP returns the provider result and throws for missing config, rejected recipients and transport errors', async () => {
  const send = jest.spyOn(transporter, 'sendMail');
  delete process.env.MAIL_PASS;
  await expect(email.sendEmail('reader@example.org', 'Title', 'Body')).rejects.toMatchObject({ statusCode: 503 });
  expect(send).not.toHaveBeenCalled();
  Object.assign(process.env, { MAIL_HOST: 'smtp.example.org', MAIL_USER: 'sender', MAIL_PASS: 'test-only' });
  send.mockResolvedValue({ messageId: 'real', accepted: ['reader@example.org'], rejected: [] });
  await expect(email.sendEmail('reader@example.org', 'Title', 'Body')).resolves.toMatchObject({ messageId: 'real' });
  send.mockResolvedValue({ accepted: [], rejected: ['reader@example.org'] });
  await expect(email.sendEmail('reader@example.org', 'Title', 'Body')).rejects.toMatchObject({ statusCode: 502 });
  send.mockRejectedValue(new Error('private provider detail'));
  await expect(email.sendEmail('reader@example.org', 'Title', 'Body')).rejects.toThrow('SMTP delivery failed');
});

it('calculates Karachi calendar bounds and DST-safe next-day ranges', () => {
  expect(jobs.calendarRange(new Date('2026-10-12T20:00:00Z'), 1)).toEqual({ $gte: new Date('2026-10-13T19:00:00Z'), $lt: new Date('2026-10-14T19:00:00Z') });
  process.env.LIBRARY_TIMEZONE = 'America/New_York';
  const range = jobs.calendarRange(new Date('2026-03-08T12:00:00Z'));
  expect(range.$lt - range.$gte).toBe(23 * 3600000);
});
it('queries +3/+1 local days rather than approximate elapsed-hour windows', async () => {
  const tx = { member: { _id: objectId() } };
  const find = jest.spyOn(Transaction, 'find').mockReturnValue(query([tx]));
  const sender = jest.spyOn(service, 'sendDueReminder').mockResolvedValue({ deliveryStatus: 'queued' });
  expect(await jobs.processDueReminders(new Date('2026-10-12T20:00:00Z'))).toEqual({ count3d: 1, count1d: 1 });
  expect(find.mock.calls[0][0].dueDate).toEqual(jobs.calendarRange(new Date('2026-10-12T20:00:00Z'), 3));
  expect(sender.mock.calls.map((args) => args[1])).toEqual([3, 1]);
});
it('overdue scan chooses the highest applicable warning and propagates assessment errors', async () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const compute = jest.spyOn(fineService, 'computeOverdueFines').mockResolvedValue({});
  jest.spyOn(Transaction, 'updateMany').mockResolvedValue({});
  jest.spyOn(Transaction, 'find').mockReturnValue(query([{ member: {}, dueDate: new Date('2026-10-01') }]));
  const send = jest.spyOn(service, 'sendOverdueAlert').mockResolvedValue({ deliveryStatus: 'queued' });
  getIO.mockReturnValue(null);
  expect(await jobs.processOverdueTransactions(now)).toMatchObject({ countAlerts: 1 });
  expect(send).toHaveBeenCalledWith(expect.any(Object), 14);
  compute.mockRejectedValue(new Error('assessment failed'));
  await expect(jobs.processOverdueTransactions(now)).rejects.toThrow('assessment failed');
});
it('weekly report uses Monday-to-Monday local bounds and dated ledger entries', async () => {
  const members = jest.spyOn(User, 'countDocuments').mockResolvedValue(2);
  jest.spyOn(Transaction, 'countDocuments').mockResolvedValue(4);
  const fines = jest.spyOn(Fine, 'aggregate').mockResolvedValue([{ total: 5 }]);
  jest.spyOn(Transaction, 'aggregate').mockResolvedValue([{ book: { title: 'Book' }, count: 4 }]);
  jest.spyOn(User, 'find').mockReturnValue({ select: async () => [{ _id: objectId() }] });
  const report = jest.spyOn(service, 'sendWeeklyReport').mockResolvedValue({ deliveryStatus: 'queued' });
  expect(await jobs.generateWeeklyLibraryReport(new Date('2026-10-13T05:00:00Z'))).toMatchObject({ success: true, stats: { newMembers: 2, newIssues: 4, finesCollected: 5 } });
  const range = { $gte: new Date('2026-10-04T19:00:00Z'), $lt: new Date('2026-10-11T19:00:00Z') };
  expect(members.mock.calls[0][0].createdAt).toEqual(range);
  expect(fines.mock.calls[0][0][1]).toEqual({ $match: { 'payments.paidAt': range } });
  expect(fines.mock.calls[1][0][1]).toEqual({ $match: { 'assessments.assessedAt': range } });
  expect(report).toHaveBeenCalledTimes(1);
});
it('registers exactly six inactive timezone schedules, records failure, respects leases and restarts', async () => {
  const compute = jest.spyOn(fineService, 'computeOverdueFines').mockRejectedValue(new Error('private error'));
  jobs.initCronJobs(); jobs.initCronJobs();
  expect(cron.schedule).toHaveBeenCalledTimes(6);
  expect(cron.schedule.mock.calls.map(([expression]) => expression)).toEqual(['0 8 * * *', '0 9 * * *', '0 10 * * *', '*/30 * * * *', '0 23 * * *', '0 7 * * 1']);
  cron.schedule.mock.calls.forEach(([, , options]) => expect(options).toEqual({ scheduled: false, timezone: 'Asia/Karachi' }));
  expect(jobs.getCronStatus().every((job) => !job.scheduled)).toBe(true);
  jobs.startCronJobs();
  await expect(jobs.runCronJob('overdueTransactions')).rejects.toThrow('private error');
  expect(jobs.getCronStatus().find((job) => job.name === 'overdueTransactions')).toMatchObject({ running: false, lastError: 'Job execution failed', lastSuccessAt: null, lastFailureAt: expect.any(String) });
  expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("redis.call('del'"), 1, 'cron:lease:overdueTransactions', expect.any(String));
  compute.mockClear(); redis.set.mockResolvedValue(null);
  expect(await jobs.runCronJob('overdueTransactions')).toEqual({ skipped: true }); expect(compute).not.toHaveBeenCalled();
  await jobs.stopCronJobs(); jobs.startCronJobs(); expect(jobs.getCronStatus().every((job) => job.scheduled)).toBe(true);
});
it('renews leases, prevents local overlap and waits for active callbacks during stop', async () => {
  jest.useFakeTimers();
  try {
    let finish;
    jest.spyOn(reservations, 'expireHolds').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    jest.spyOn(service, 'reconcilePendingDeliveries').mockResolvedValue({ queued: 0, pending: 0 });
    jobs.initCronJobs(); jobs.startCronJobs();
    const running = jobs.runCronJob('reservationExpiry');
    await jest.advanceTimersByTimeAsync(20000);
    expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining('pexpire'), 1, 'cron:lease:reservationExpiry', expect.any(String), 60000);
    expect(await jobs.runCronJob('reservationExpiry')).toEqual({ skipped: true });
    let stopped = false; const stopping = jobs.stopCronJobs().then(() => { stopped = true; });
    await Promise.resolve(); expect(stopped).toBe(false);
    finish(2); await running; await stopping; expect(stopped).toBe(true);
  } finally { jest.useRealTimers(); }
});
it('reports lease-renewal loss as failure instead of a successful run', async () => {
  jest.useFakeTimers();
  try {
    let finish;
    jest.spyOn(reservations, 'expireHolds').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    jest.spyOn(service, 'reconcilePendingDeliveries').mockResolvedValue({ pending: 0 });
    jobs.startCronJobs();
    redis.eval.mockResolvedValue(0);
    const running = jobs.runCronJob('reservationExpiry');
    const rejected = expect(running).rejects.toThrow('Cron lease lost');
    await jest.advanceTimersByTimeAsync(20000);
    finish(0); await rejected;
    expect(jobs.getCronStatus().find((job) => job.name === 'reservationExpiry')).toMatchObject({ running: false, lastError: 'Job execution failed', lastFailureAt: expect.any(String) });
  } finally { jest.useRealTimers(); }
});
it('escalates strictly beyond 14 days atomically and retries do not inflate counts', async () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const member = { _id: objectId(), name: 'Reader' }; const loan = { _id: objectId(), member, book: { title: 'Book' }, dueDate: new Date('2026-10-01') };
  const session = { withTransaction: async (callback) => { await callback(); await callback(); }, endSession: jest.fn() };
  jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
  jest.spyOn(User, 'find').mockReturnValueOnce(query([{ _id: objectId() }])).mockReturnValueOnce(query([member]));
  const find = jest.spyOn(Transaction, 'find').mockReturnValue(query([loan]));
  jest.spyOn(Transaction, 'exists').mockReturnValueOnce(query(true)).mockReturnValueOnce(query(true)).mockReturnValue(query(null));
  const update = jest.spyOn(User, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
  const create = jest.spyOn(service, 'createNotification').mockResolvedValue({ deliveryStatus: 'pending' });
  jest.spyOn(service, 'reconcilePendingDeliveries').mockResolvedValue({ pending: 0 });
  expect(await jobs.processOverdueEscalations(now)).toMatchObject({ blockedCount: 1 });
  expect(find.mock.calls[0][0].dueDate).toEqual({ $lt: new Date('2026-10-06T12:00:00Z') });
  expect(create.mock.calls[0][0]).toMatchObject({ session, channels: ['in_app', 'email'] });
  expect(create.mock.calls[0][0].dedupKey).toBe(create.mock.calls[2][0].dedupKey);
  expect(update.mock.calls.at(-1)[1]).toEqual({ $set: { overdueBlocked: false } });
  expect(session.endSession).toHaveBeenCalledTimes(2);
});
it('membership queries never deactivate staff/admin and alerts only eligible calendar periods', async () => {
  const find = jest.spyOn(User, 'find').mockResolvedValue([]);
  jest.spyOn(service, 'reconcilePendingDeliveries').mockResolvedValue({ pending: 0 });
  expect(await jobs.processMembershipExpirations()).toEqual({ deactivatedCount: 0, noticeCount: 0 });
  expect(find).toHaveBeenCalledTimes(3);
  find.mock.calls.forEach(([filter]) => { expect(filter.role.$in).not.toContain('admin'); expect(filter.role.$in).not.toContain('librarian'); });
});

it('notification list/read/count/delete operations preserve ownership', async () => {
  const owner = objectId(); const other = objectId();
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }; const next = jest.fn();
  jest.spyOn(Notification, 'paginate').mockResolvedValue({ docs: [], totalDocs: 0 });
  await controller.getNotifications({ user: { _id: owner }, query: {} }, res, next);
  expect(Notification.paginate).toHaveBeenCalledWith({ user: owner }, expect.objectContaining({ lean: true }));
  jest.spyOn(Notification, 'countDocuments').mockResolvedValue(3);
  await controller.getUnreadCount({ user: { _id: owner } }, res, next);
  expect(res.json.mock.calls.at(-1)[0].data).toEqual({ unreadCount: 3 });
  const doc = { _id: objectId(), user: owner, isRead: false, save: jest.fn() };
  jest.spyOn(Notification, 'findById').mockResolvedValue(doc);
  await controller.markAsRead({ user: { _id: other }, params: { id: doc._id } }, res, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 })); expect(doc.save).not.toHaveBeenCalled();
  next.mockClear();
  await controller.markAsRead({ user: { _id: owner }, params: { id: doc._id } }, res, next);
  expect(doc.isRead).toBe(true); expect(doc.save).toHaveBeenCalled();
  jest.spyOn(Notification, 'updateMany').mockResolvedValue({ modifiedCount: 2 });
  await controller.markAllAsRead({ user: { _id: owner } }, res, next);
  expect(Notification.updateMany.mock.calls[0][0]).toEqual({ user: owner, isRead: false });
  const remove = jest.spyOn(Notification, 'findByIdAndDelete').mockResolvedValue(doc);
  await controller.deleteNotification({ user: { _id: other }, params: { id: doc._id } }, res, next);
  expect(remove).not.toHaveBeenCalled();
  await controller.deleteNotification({ user: { _id: owner }, params: { id: doc._id } }, res, next);
  expect(remove).toHaveBeenCalledWith(doc._id);
});
