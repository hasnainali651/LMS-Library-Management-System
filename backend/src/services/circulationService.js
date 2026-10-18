const mongoose = require('mongoose');
const { Transaction, Copy, Book, User, Reservation, Notification } = require('../models');
const ApiError = require('../utils/ApiError');
const { getIO } = require('../socket');
const eligibility = require('./eligibilityService');
const DAY = 86400000;

const runAtomic = async (operation) => {
  const session = await mongoose.startSession();
  let result;
  let events = [];
  try {
    await session.withTransaction(async () => {
      events = [];
      result = await operation(session, events);
    });
  } catch (error) {
    if (error.code === 11000 || error.code === 112) throw new ApiError(409, 'This item was changed by another request. Please refresh and retry.');
    throw error;
  } finally {
    await session.endSession();
  }
  let socketStatus = events.length ? 'sent' : 'not_required';
  try {
    const io = events.length ? getIO() : null;
    for (const event of events) io.to(event.rooms).emit(event.name, event.payload);
  } catch (error) {
    socketStatus = 'unavailable';
    console.warn('[Circulation] Committed changes; realtime delivery unavailable.');
  }
  return result && typeof result === 'object' ? Object.assign(result, { delivery: { notifications: events.some((event) => ['fine:added', 'reservation:ready', 'reservation:created', 'reservation:expired'].includes(event.name)) ? 'pending' : 'not_required', socket: socketStatus } }) : result;
};

const lockBook = async (bookId, session) => {
  const book = await Book.findOneAndUpdate({ _id: bookId }, { $inc: { __v: 1 } }, { new: true, session });
  if (!book) throw new ApiError(404, 'Book not found.');
  return book;
};

const moveCopy = async (copyId, bookId, from, to, session, condition) => {
  const update = { status: to };
  if (condition) update.condition = condition;
  const copy = await Copy.findOneAndUpdate({ _id: copyId, book: bookId, status: from }, { $set: update }, { new: true, session, runValidators: true });
  if (!copy) throw new ApiError(409, 'Copy state changed or is not eligible for this operation.');
  const delta = Number(to === 'available') - Number(from === 'available');
  if (delta) {
    const filter = { _id: bookId };
    if (delta < 0) filter.availableCopies = { $gte: 1 };
    const book = await Book.findOneAndUpdate(filter, { $inc: { availableCopies: delta } }, { session, new: true });
    if (!book) throw new ApiError(409, 'Inventory count is inconsistent with copy availability.');
  }
  return copy;
};

const populateTransaction = (id, session) => Transaction.findById(id).session(session)
  .populate('member', 'name email memberId').populate('book', 'title isbn authors coverImage')
  .populate('copy', 'barcode copyNumber shelfLocation');

const issueInSession = async ({ memberId, copyId, bookId, issuedBy, reservation, now = new Date() }, session, events) => {
  const copy = copyId ? await Copy.findById(copyId).session(session) : await Copy.findOne({ book: bookId, status: 'available' }).session(session);
  if (!copy) throw new ApiError(409, 'No available copy found.');
  if (bookId && String(copy.book) !== String(bookId)) throw new ApiError(400, 'Copy does not belong to requested book.');
  if (copy.status !== (reservation ? 'reserved' : 'available') || copy.condition === 'damaged') throw new ApiError(409, 'Copy is not eligible for checkout.');
  const book = await lockBook(copy.book, session);
  // Writing the member serializes concurrent checkouts against the same quota.
  const memberLock = await User.updateOne({ _id: memberId }, { $inc: { __v: 1 } }, { session });
  if (!memberLock.matchedCount) throw new ApiError(404, 'Member not found.');
  const eligible = await eligibility.checkEligibility(memberId, { session, book, now });
  if (!eligible.eligible) throw new ApiError(400, eligible.reason);
  if (await Transaction.exists({ member: memberId, book: copy.book, status: { $in: ['active', 'overdue'] } }).session(session)) throw new ApiError(409, 'Member already has this book checked out.');
  if (!reservation) {
    const next = await require('./reservationService').assignNextReservation(copy.book, copy._id, { session, events, now });
    if (next) return { reservation: next, issued: false, message: 'Copy assigned to the next eligible reservation; use reserved pickup.' };
  }
  await moveCopy(copy._id, copy.book, reservation ? 'reserved' : 'available', 'issued', session);
  const [transaction] = await Transaction.create([{
    member: memberId, book: copy.book, copy: copy._id, issuedBy,
    issueDate: now, dueDate: new Date(now.getTime() + eligible.policy.loanDays * DAY),
    policySnapshot: eligibility.snapshotPolicy(eligible.policy), status: 'active',
  }], { session });
  await User.updateOne({ _id: memberId }, { $inc: { totalBorrowed: 1 } }, { session });
  await Book.updateOne({ _id: copy.book }, { $inc: { borrowCount: 1 } }, { session });
  await eligibility.resolveOverdueBlock(memberId, session, now);
  if (reservation) {
    reservation.status = 'collected';
    reservation.collectedAt = now;
    reservation.transaction = transaction._id;
    await reservation.save({ session });
  }
  const populated = await populateTransaction(transaction._id, session);
  const bookTitle = populated.book?.title || 'Book';
  const dueDateStr = new Date(transaction.dueDate).toLocaleDateString('en-GB');

  if (Notification) {
    try {
      await Notification.create([{
        user: memberId,
        type: 'circulation',
        title: 'Book Issued',
        message: `"${bookTitle}" has been issued to you. Due date: ${dueDateStr}.`,
        channel: ['in_app'],
        delivery: { status: 'delivered' },
      }], { session });
    } catch (nErr) {
      // non-fatal notification record error
    }
  }

  events.push({
    rooms: ['role:librarian', 'role:admin'],
    name: 'book:issued',
    payload: { transaction: populated, member: populated.member, book: populated.book },
  });
  events.push({
    rooms: [`user:${memberId}`],
    name: 'notification:new',
    payload: {
      title: 'Book Issued',
      message: `"${bookTitle}" has been issued to you. Due date: ${dueDateStr}.`,
      type: 'circulation',
      link: '/dashboard/my-books',
    },
  });
  return { transaction: populated, ...(reservation ? { reservation } : {}) };
};

const issueBook = (input) => runAtomic((session, events) => issueInSession(input, session, events));
const pickupReservation = ({ reservationId, issuedBy, copyId, now = new Date() }) => runAtomic(async (session, events) => {
  const reservation = await Reservation.findById(reservationId).session(session);
  if (!reservation) throw new ApiError(404, 'Reservation not found.');
  if (reservation.status !== 'ready' || !reservation.expiresAt || reservation.expiresAt <= now) throw new ApiError(409, 'Reservation is not ready or its pickup window has expired.');
  if (!reservation.assignedCopy || (copyId && String(copyId) !== String(reservation.assignedCopy))) throw new ApiError(409, 'Incorrect reserved copy.');
  return issueInSession({ memberId: reservation.member, bookId: reservation.book, copyId: reservation.assignedCopy, issuedBy, reservation, now }, session, events);
});

const returnBook = ({ transactionId, returnedBy, condition, damageCharge = 0, damageNotes = '', lost = false, now = new Date() }) => runAtomic(async (session, events) => {
  const fineService = require('./fineService');
  const damageFee = fineService.money(damageCharge, true);
  if (typeof damageNotes !== 'string') throw new ApiError(400, 'Damage notes must be text.');
  if (damageFee > 0 && !damageNotes.trim()) throw new ApiError(400, 'Damage notes are required.');
  if (condition && !['new', 'good', 'fair', 'poor', 'damaged'].includes(condition)) throw new ApiError(400, 'Invalid copy condition.');
  const transaction = await Transaction.findById(transactionId).session(session);
  if (!transaction) throw new ApiError(404, 'Transaction not found.');
  if (!['active', 'overdue'].includes(transaction.status)) throw new ApiError(409, 'Loan has already been closed.');
  const book = await lockBook(transaction.book, session);
  const copy = await Copy.findById(transaction.copy).session(session);
  const assessment = await fineService.assessOverdue(transaction, now, session, events);
  const finesAdded = assessment.delta > 0 ? [assessment.fine] : [];
  let fineAdded = assessment.delta;
  const extraCharge = lost ? book.price : damageFee;
  if (extraCharge > 0) {
    const fine = await fineService.addAssessment({ member: transaction.member, transaction: transaction._id, amount: extraCharge, type: lost ? 'loss' : 'damage', now }, session, events);
    finesAdded.push(fine);
    fineAdded += extraCharge;
  }
  transaction.status = lost ? 'lost' : 'returned';
  transaction.returnDate = now;
  transaction.returnedBy = returnedBy;
  transaction.damageCharge += damageFee;
  transaction.damageNotes = damageNotes.trim();
  await transaction.save({ session });
  const damaged = condition === 'damaged' || copy?.condition === 'damaged';
  if (lost || damaged) {
    await moveCopy(transaction.copy, transaction.book, 'issued', lost ? 'lost' : 'damaged', session, damaged ? 'damaged' : condition);
  } else {
    const next = await require('./reservationService').assignNextReservation(transaction.book, transaction.copy, { session, events, now, fromStatus: 'issued' });
    if (!next) await moveCopy(transaction.copy, transaction.book, 'issued', 'available', session, condition);
    else if (condition) await Copy.updateOne({ _id: transaction.copy }, { $set: { condition } }, { session });
  }
  await eligibility.resolveOverdueBlock(transaction.member, session, now);
  const populated = await populateTransaction(transaction._id, session);
  events.push({ rooms: ['role:librarian', 'role:admin'], name: 'book:returned', payload: { transaction: populated, fineAdded } });
  return { transaction: populated, finesAdded, fineAdded, copyReturned: transaction.copy };
});

const renewLoan = ({ transactionId, user, now = new Date() }) => runAtomic(async (session) => {
  const transaction = await Transaction.findById(transactionId).session(session);
  if (!transaction) throw new ApiError(404, 'Transaction not found.');
  if (!['admin', 'librarian'].includes(user.role) && String(transaction.member) !== String(user._id)) throw new ApiError(403, 'Unauthorized renewal.');
  if (transaction.status !== 'active' || transaction.dueDate < now) throw new ApiError(400, 'Cannot renew an overdue or closed loan.');
  const book = await lockBook(transaction.book, session);
  const eligible = await eligibility.checkEligibility(transaction.member, { session, book, now, ignoreQuota: true });
  if (!eligible.eligible) throw new ApiError(400, eligible.reason);
  const policy = transaction.policySnapshot;
  if (!policy) throw new ApiError(409, 'Loan policy snapshot is missing.');
  if (transaction.renewalCount >= policy.renewalLimit) throw new ApiError(400, 'Maximum renewal limit reached.');
  if (await Reservation.exists({ book: transaction.book, status: 'pending' }).session(session)) throw new ApiError(400, 'Other patrons are waiting on reservations.');
  transaction.dueDate = new Date(Math.max(now.getTime(), transaction.dueDate.getTime()) + policy.loanDays * DAY);
  transaction.renewalCount += 1;
  await transaction.save({ session });
  return { transaction };
});
module.exports = { runAtomic, lockBook, moveCopy, issueInSession, issueBook, pickupReservation, returnBook, renewLoan };
