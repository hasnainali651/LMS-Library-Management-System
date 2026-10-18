const { Reservation, Copy, Transaction } = require('../models');
const ApiError = require('../utils/ApiError');
const notificationService = require('./notificationService');
const { checkEligibility } = require('./eligibilityService');
const circulation = () => require('./circulationService');

const recomputeQueuePositions = async (bookId, session = null) => {
  const pending = await Reservation.find({ book: bookId, status: 'pending' }).sort({ requestDate: 1, createdAt: 1, _id: 1 }).session(session);
  for (let i = 0; i < pending.length; i += 1) {
    if (pending[i].position !== i + 1) {
      pending[i].position = i + 1;
      await pending[i].save({ session });
    }
  }
  return pending.length;
};

const assignNextReservation = async (bookId, copyId, options = {}) => {
  if (!options.session) return circulation().runAtomic((session, events) => assignNextReservation(bookId, copyId, { ...options, session, events }));
  const { session, events = [], now = new Date(), fromStatus = 'available' } = options;
  const book = await circulation().lockBook(bookId, session);
  if (!book.isActive) return null;
  const copy = await Copy.findById(copyId).session(session);
  if (!copy || String(copy.book) !== String(bookId) || !['available', 'reserved', 'issued'].includes(copy.status) || (fromStatus && copy.status !== fromStatus)) throw new ApiError(409, 'Copy cannot be assigned to a reservation.');
  const pending = await Reservation.find({ book: bookId, status: 'pending' }).sort({ requestDate: 1, createdAt: 1, _id: 1 }).session(session);
  let next = null;
  for (const candidate of pending) {
    let eligible;
    try {
      eligible = await checkEligibility(candidate.member, { session, book, now });
    } catch (error) {
      if (error.statusCode !== 400) throw error;
      continue;
    }
    if (!eligible.eligible) continue;
    if (await Transaction.exists({ member: candidate.member, book: bookId, status: { $in: ['active', 'overdue'] } }).session(session)) continue;
    next = candidate;
    break;
  }
  if (!next) return null;
  const holdHours = Number(process.env.RESERVATION_HOLD_HOURS ?? 48);
  if (!Number.isFinite(holdHours) || holdHours <= 0) throw new ApiError(500, 'RESERVATION_HOLD_HOURS must be a positive number.');
  next.status = 'ready';
  next.assignedCopy = copyId;
  next.notifiedAt = now;
  next.expiresAt = new Date(now.getTime() + holdHours * 3600000);
  next.position = null;
  await next.save({ session });
  await circulation().moveCopy(copyId, bookId, copy.status, 'reserved', session);
  await notificationService.createNotification({
    userId: next.member, type: 'reservation_ready', title: 'Reserved Book Ready for Pickup',
    message: `"${book.title}" is ready for pickup until ${next.expiresAt.toISOString()}.`,
    channels: ['in_app', 'email'], meta: { reservationId: next._id, bookId, expiresAt: next.expiresAt },
    session, dedupKey: `reservation:${next._id}:ready:${next.expiresAt.toISOString()}`,
  }, { session, dedupKey: `reservation:${next._id}:ready:${next.expiresAt.toISOString()}` });
  events.push({ rooms: [`user:${next.member}`], name: 'reservation:ready', payload: { reservation: next.toObject(), book: { _id: book._id, title: book.title, isbn: book.isbn }, expiresAt: next.expiresAt } });
  await recomputeQueuePositions(bookId, session);
  return next;
};

const createReservation = ({ bookId, memberId, now = new Date() }) => circulation().runAtomic(async (session, events) => {
  const book = await circulation().lockBook(bookId, session);
  const eligible = await checkEligibility(memberId, { session, book, now });
  if (!eligible.eligible) throw new ApiError(400, eligible.reason);
  if (await Reservation.exists({ member: memberId, book: bookId, status: { $in: ['pending', 'ready'] } }).session(session)) throw new ApiError(409, 'You already have an active reservation for this book.');
  if (await Transaction.exists({ member: memberId, book: bookId, status: { $in: ['active', 'overdue'] } }).session(session)) throw new ApiError(409, 'You currently have this book checked out.');
  if (book.availableCopies > 0) throw new ApiError(400, 'Copies are available; please borrow directly.');
  const position = await Reservation.countDocuments({ book: bookId, status: 'pending' }).session(session) + 1;
  const [reservation] = await Reservation.create([{ member: memberId, book: bookId, requestDate: now, status: 'pending', position }], { session });
  await notificationService.createNotification({ userId: memberId, type: 'account', title: 'Reservation Placed', message: `You are #${position} in queue for "${book.title}".`, channels: ['in_app'], session, dedupKey: `reservation:${reservation._id}:created` }, { session, dedupKey: `reservation:${reservation._id}:created` });
  const populated = await Reservation.findById(reservation._id).session(session).populate('book', 'title isbn authors coverImage').populate('member', 'name email memberId');
  events.push({ rooms: ['role:librarian', 'role:admin'], name: 'reservation:created', payload: { reservation: populated } });
  return { reservation: populated };
});

const closeReservation = ({ reservationId, user, reason, expire = false, now = new Date() }) => circulation().runAtomic(async (session, events) => {
  const reservation = await Reservation.findById(reservationId).session(session);
  if (!reservation) throw new ApiError(404, 'Reservation not found.');
  if (expire && (reservation.status !== 'ready' || !reservation.expiresAt || reservation.expiresAt > now)) return null;
  if (!expire) {
    const owner = String(reservation.member) === String(user._id);
    const staff = ['admin', 'librarian'].includes(user.role);
    if (!owner && !staff) throw new ApiError(403, 'You are not authorized to cancel this reservation.');
    if (reason != null && typeof reason !== 'string') throw new ApiError(400, 'Cancellation reason must be text.');
    if (!owner && (typeof reason !== 'string' || !reason.trim())) throw new ApiError(400, 'A cancellation reason is required.');
    if (!['pending', 'ready'].includes(reservation.status)) throw new ApiError(409, 'Reservation has already been closed.');
  }
  const book = await circulation().lockBook(reservation.book, session);
  const wasReady = reservation.status === 'ready';
  reservation.status = expire ? 'expired' : 'cancelled';
  reservation.position = null;
  if (!expire) { reservation.cancelledBy = user._id; reservation.cancelReason = reason?.trim() || 'Cancelled by member'; }
  await reservation.save({ session });
  if (wasReady && reservation.assignedCopy) {
    const next = await assignNextReservation(reservation.book, reservation.assignedCopy, { session, events, now, fromStatus: 'reserved' });
    if (!next) await circulation().moveCopy(reservation.assignedCopy, reservation.book, 'reserved', 'available', session);
  }
  await recomputeQueuePositions(reservation.book, session);
  if (expire) {
    await notificationService.createNotification({ userId: reservation.member, type: 'account', title: 'Reservation Pickup Expired', message: `Your pickup window for "${book.title}" has expired.`, channels: ['in_app', 'email'], session, dedupKey: `reservation:${reservation._id}:expired` }, { session, dedupKey: `reservation:${reservation._id}:expired` });
    events.push({ rooms: [`user:${reservation.member}`], name: 'reservation:expired', payload: { reservation: reservation.toObject() } });
  }
  return { reservation };
});
const expireHolds = async (now = new Date()) => {
  const reservations = await Reservation.find({ status: 'ready', expiresAt: { $lte: now } }).select('_id').lean();
  let count = 0;
  for (const reservation of reservations) {
    if (await closeReservation({ reservationId: reservation._id, expire: true, now })) count += 1;
  }
  return count;
};
module.exports = { recomputeQueuePositions, assignNextReservation, createReservation, closeReservation, expireHolds, processExpiredReservations: expireHolds };
