const { Reservation, Book } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const reservationService = require('../services/reservationService');
const circulationService = require('../services/circulationService');
const createReservation = asyncHandler(async (req, res) => {
  if (!req.body.bookId) throw new ApiError(400, 'bookId is required.');
  const result = await reservationService.createReservation({ bookId: req.body.bookId, memberId: req.user._id });
  return res.status(201).json(new ApiResponse(201, { ...result.reservation.toObject(), delivery: result.delivery }, 'Reservation placed successfully.'));
});
const cancelReservation = asyncHandler(async (req, res) => {
  const result = await reservationService.closeReservation({ reservationId: req.params.id, user: req.user, reason: req.body.reason });
  return res.status(200).json(new ApiResponse(200, { ...result.reservation.toObject(), delivery: result.delivery }, 'Reservation cancelled successfully.'));
});
const getAllReservations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, book, member } = req.query;
  const query = {};
  if (status) query.status = status;
  if (book) query.book = book;
  if (member) query.member = member;
  const result = await Reservation.paginate(query, {
    page: Math.max(1, parseInt(page, 10) || 1), limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 10)),
    sort: { requestDate: -1 }, lean: true,
    populate: [{ path: 'book', select: 'title isbn coverImage' }, { path: 'member', select: 'name email memberId' },
      { path: 'assignedCopy', select: 'barcode copyNumber shelfLocation', transform: (copy) => copy && ({ ...copy, fullBarcode: `LMS-${copy._id}` }) }, { path: 'cancelledBy', select: 'name' }],
  });
  return res.status(200).json(new ApiResponse(200, result, 'Reservations retrieved successfully.'));
});
const getMyReservations = asyncHandler(async (req, res) => {
  const reservations = await Reservation.find({ member: req.user._id }).sort({ status: 1, requestDate: -1 }).populate('book', 'title isbn authors coverImage').populate({ path: 'assignedCopy', select: 'barcode copyNumber shelfLocation', transform: (copy) => copy && ({ ...copy, fullBarcode: `LMS-${copy._id}` }) }).lean();
  return res.status(200).json(new ApiResponse(200, reservations, 'My active and past reservations retrieved.'));
});
const getBookQueue = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.bookId);
  if (!book) throw new ApiError(404, 'Book not found.');
  const queue = await Reservation.find({ book: book._id, status: { $in: ['pending', 'ready'] } }).sort({ status: 1, position: 1, requestDate: 1 }).populate('member', 'name email memberId phone').populate('assignedCopy', 'barcode copyNumber').lean();
  return res.status(200).json(new ApiResponse(200, { book: { _id: book._id, title: book.title, isbn: book.isbn, totalCopies: book.totalCopies, availableCopies: book.availableCopies }, queueCount: queue.length, queue }, `Reservation queue for "${book.title}".`));
});
const getReservationById = asyncHandler(async (req, res) => {
  const reservation = await Reservation.findById(req.params.id).populate('book').populate('member', 'name email memberId phone').populate('assignedCopy').populate('cancelledBy', 'name email');
  if (!reservation) throw new ApiError(404, 'Reservation record not found.');
  return res.status(200).json(new ApiResponse(200, reservation, 'Reservation details retrieved.'));
});
const markCollected = asyncHandler(async (req, res) => {
  const result = await circulationService.pickupReservation({ reservationId: req.params.id, issuedBy: req.user._id, copyId: req.body.copyId });
  return res.status(200).json(new ApiResponse(200, result, 'Reserved copy issued successfully.'));
});
module.exports = { createReservation, cancelReservation, getAllReservations, getMyReservations, getBookQueue, getReservationById, markCollected };
