const express = require('express');
const { body } = require('express-validator');
const {
  createReservation,
  cancelReservation,
  getAllReservations,
  getMyReservations,
  getBookQueue,
  getReservationById,
  markCollected,
} = require('../controllers/reservation.controller');

const { protect } = require('../middleware/auth');
const { isLibrarian, requireVerifiedEmail } = require('../middleware/roles');
const { validate } = require('../middleware/validate');
const { logAction } = require('../middleware/auditLog');

const router = express.Router();

const createReservationValidation = [
  body('bookId').notEmpty().withMessage('bookId is required to place a reservation.'),
  validate,
];

// All routes require authentication
router.use(protect);

// 1. Create & Cancel & Collect
router.post('/', requireVerifiedEmail, createReservationValidation, logAction('CREATE_RESERVATION', 'Reservation'), createReservation);
router.delete('/:id', logAction('CANCEL_RESERVATION', 'Reservation'), cancelReservation);
router.patch('/:id/collect', isLibrarian, logAction('COLLECT_RESERVATION', 'Reservation'), markCollected);

// 2. Queue views (Named routes defined before :id parameter)
router.get('/', isLibrarian, getAllReservations);
router.get('/my', getMyReservations);
router.get('/book/:bookId', isLibrarian, getBookQueue);

// 3. Single reservation detail
router.get('/:id', isLibrarian, getReservationById);

module.exports = router;
