const { Transaction, Copy, Book, User } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const circulation = require('../services/circulationService');
const fineService = require('../services/fineService');

const issueBook = asyncHandler(async (req, res) => {
  const { memberId, copyId, bookId } = req.body;
  if (!memberId || (!copyId && !bookId)) throw new ApiError(400, 'memberId and either copyId or bookId are required.');
  const result = await circulation.issueBook({ memberId, copyId, bookId, issuedBy: req.user._id });
  if (result.issued === false) return res.status(200).json(new ApiResponse(200, result, result.message));
  return res.status(201).json(new ApiResponse(201, { ...result.transaction.toObject(), delivery: result.delivery }, 'Book successfully issued.'));
});
const returnBook = asyncHandler(async (req, res) => {
  const { transactionId, condition, damageCharge, damageNotes } = req.body;
  if (!transactionId) throw new ApiError(400, 'transactionId is required.');
  const result = await circulation.returnBook({ transactionId, condition, damageCharge, damageNotes, returnedBy: req.user._id });
  return res.status(200).json(new ApiResponse(200, result, 'Book return processed successfully.'));
});
const renewLoan = asyncHandler(async (req, res) => {
  if (!req.body.transactionId) throw new ApiError(400, 'transactionId is required.');
  const result = await circulation.renewLoan({ transactionId: req.body.transactionId, user: req.user });
  return res.status(200).json(new ApiResponse(200, result.transaction, 'Loan successfully renewed.'));
});
const pagination = (query) => ({
  page: Math.max(1, parseInt(query.page, 10) || 1), limit: Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10)), sort: { dueDate: 1 }, lean: true, populate: [
    { path: 'member', select: 'name email memberId' }, { path: 'book', select: 'title isbn authors coverImage' },
    { path: 'copy', select: 'barcode copyNumber shelfLocation', transform: (copy) => copy && ({ ...copy, fullBarcode: `LMS-${copy._id}` }) },
  ]
});
const getActiveLoans = asyncHandler(async (req, res) => {
  const { overdue, dueToday, member, book, search } = req.query;
  const query = { status: { $in: ['active', 'overdue'] } };
  const now = new Date();
  if (overdue === 'true') query.dueDate = { $lt: now };
  if (dueToday === 'true') {
    const { DateTime } = require('luxon');
    const zone = process.env.LIBRARY_TIMEZONE || 'Asia/Karachi';
    const start = DateTime.fromJSDate(now, { zone }).startOf('day');
    query.dueDate = { $gte: start.toJSDate(), $lt: start.plus({ days: 1 }).toJSDate() };
  }
  if (member) query.member = member;
  if (book) query.book = book;
  if (search) {
    if (typeof search !== 'string' || search.length > 100) throw new ApiError(400, 'Search must be at most 100 characters.');
    const pattern = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const [members, books, copies] = await Promise.all([
      User.find({ $or: [{ name: pattern }, { memberId: pattern }, { email: pattern }] }).select('_id').limit(100).lean(),
      Book.find({ $or: [{ title: pattern }, { isbn: pattern }] }).select('_id').limit(100).lean(),
      Copy.find({ barcode: pattern }).select('_id').limit(100).lean(),
    ]);
    query.$or = [{ member: { $in: members.map((item) => item._id) } }, { book: { $in: books.map((item) => item._id) } }, { copy: { $in: copies.map((item) => item._id) } }];
  }
  const result = await Transaction.paginate(query, pagination(req.query));
  return res.status(200).json(new ApiResponse(200, result, 'Active loans retrieved successfully.'));
});
const getOverdueLoans = asyncHandler(async (req, res) => {
  const result = await Transaction.paginate({ status: { $in: ['active', 'overdue'] }, dueDate: { $lt: new Date() } }, pagination(req.query));
  return res.status(200).json(new ApiResponse(200, result, 'Overdue loans retrieved successfully.'));
});
const getTransactionById = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.transactionId).populate('member', 'name email memberId phone').populate('book').populate('copy').populate('issuedBy', 'name email').populate('returnedBy', 'name email');
  if (!transaction) throw new ApiError(404, 'Transaction not found.');
  return res.status(200).json(new ApiResponse(200, transaction, 'Transaction details retrieved.'));
});
const getMemberLoans = asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  if (!['admin', 'librarian'].includes(req.user.role) && String(req.user._id) !== memberId) throw new ApiError(403, 'Unauthorized access to patron records.');
  const loans = await Transaction.find({ member: memberId }).sort({ createdAt: -1 }).populate('book', 'title isbn coverImage authors').populate('copy', 'barcode copyNumber shelfLocation').lean();
  return res.status(200).json(new ApiResponse(200, loans, 'Member loans retrieved successfully.'));
});
const markLost = asyncHandler(async (req, res) => {
  const result = await circulation.returnBook({ transactionId: req.params.transactionId, returnedBy: req.user._id, lost: true });
  return res.status(200).json(new ApiResponse(200, result, 'Book marked lost and replacement charge posted.'));
});
const addDamageCharge = asyncHandler(async (req, res) => {
  const { damageCharge, damageNotes } = req.body;
  const amount = fineService.money(damageCharge);
  if (typeof damageNotes !== 'string' || !damageNotes.trim()) throw new ApiError(400, 'Damage notes are strictly required.');
  const result = await circulation.runAtomic(async (session, events) => {
    const transaction = await Transaction.findById(req.params.transactionId).session(session);
    if (!transaction) throw new ApiError(404, 'Transaction not found.');
    transaction.damageCharge += amount;
    transaction.damageNotes = [transaction.damageNotes, damageNotes.trim()].filter(Boolean).join(' | ');
    await transaction.save({ session });
    const fine = await fineService.addAssessment({ member: transaction.member, transaction: transaction._id, amount, type: 'damage' }, session, events);
    return { transaction, fine };
  });
  return res.status(200).json(new ApiResponse(200, result, 'Damage fee added successfully.'));
});
const sendOverdueReminder = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.transactionId)
    .populate('member')
    .populate('book');
  if (!transaction) throw new ApiError(404, 'Transaction not found.');
  if (transaction.status === 'returned') throw new ApiError(400, 'Cannot send reminder for a returned loan.');
  const notificationService = require('../services/notificationService');
  await notificationService.sendOverdueAlert(transaction, 1);
  return res.status(200).json(new ApiResponse(200, null, 'Overdue reminder notice dispatched.'));
});
module.exports = { issueBook, returnBook, renewLoan, getActiveLoans, getOverdueLoans, getTransactionById, getMemberLoans, markLost, addDamageCharge, sendOverdueReminder };
