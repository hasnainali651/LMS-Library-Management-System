const express = require('express');
const { body } = require('express-validator');
const {
  issueBook,
  returnBook,
  renewLoan,
  getActiveLoans,
  getOverdueLoans,
  getTransactionById,
  getMemberLoans,
  markLost,
  addDamageCharge,
  sendOverdueReminder,
} = require('../controllers/circulation.controller');

const { protect } = require('../middleware/auth');
const { isLibrarian, requireVerifiedEmail } = require('../middleware/roles');
const { validate } = require('../middleware/validate');
const { logAction } = require('../middleware/auditLog');

const router = express.Router();

const issueValidation = [
  body('memberId').notEmpty().withMessage('memberId is required.'),
  body().custom((body) => {
    if (!body.copyId && !body.bookId) {
      throw new Error('Either copyId or bookId must be provided.');
    }
    return true;
  }),
  validate,
];

const returnValidation = [
  body('transactionId').notEmpty().withMessage('transactionId is required.'),
  body('condition')
    .optional()
    .isIn(['new', 'good', 'fair', 'poor', 'damaged'])
    .withMessage('Invalid copy condition.'),
  validate,
];

const renewValidation = [
  body('transactionId').notEmpty().withMessage('transactionId is required.'),
  validate,
];

const damageChargeValidation = [
  body('damageCharge').isFloat({ min: 0.01 }).withMessage('damageCharge must be a positive number.'),
  body('damageNotes').trim().notEmpty().withMessage('damageNotes are strictly required.'),
  validate,
];

// All routes require authentication
router.use(protect);

// 1. Issue, Return, Renew Operations
router.post('/issue', isLibrarian, issueValidation, logAction('ISSUE_BOOK', 'Transaction'), issueBook);
router.post('/return', isLibrarian, returnValidation, logAction('RETURN_BOOK', 'Transaction'), returnBook);
router.post('/renew', requireVerifiedEmail, renewValidation, logAction('RENEW_LOAN', 'Transaction'), renewLoan);
router.patch('/renew', requireVerifiedEmail, renewValidation, logAction('RENEW_LOAN', 'Transaction'), renewLoan);

// 2. Active & Overdue Queries
router.get('/active', isLibrarian, getActiveLoans);
router.get('/overdue', isLibrarian, getOverdueLoans);

// 3. Member & Transaction Specific Endpoints
router.get('/member/:memberId', getMemberLoans);
router.get('/:transactionId', isLibrarian, getTransactionById);

// 4. Lost & Damage Management
router.post('/:transactionId/mark-lost', isLibrarian, logAction('MARK_LOST', 'Transaction'), markLost);
router.post('/:transactionId/remind', isLibrarian, sendOverdueReminder);
router.patch(
  '/:transactionId/damage-charge',
  isLibrarian,
  damageChargeValidation,
  logAction('DAMAGE_CHARGE', 'Transaction'),
  addDamageCharge
);

module.exports = router;
