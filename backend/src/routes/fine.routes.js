const express = require('express');
const { body } = require('express-validator');
const {
  getFines,
  getMemberFines,
  collectFines,
  waiveFine,
} = require('../controllers/fine.controller');

const { protect } = require('../middleware/auth');
const { isLibrarian, isAdmin } = require('../middleware/roles');
const { validate } = require('../middleware/validate');
const { logAction } = require('../middleware/auditLog');

const router = express.Router();

const collectValidation = [
  body('fineIds').isArray({ min: 1 }).withMessage('fineIds must be a non-empty array of IDs.'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be greater than 0.'),
  body('paymentMethod').optional().isIn(['cash', 'online']).withMessage("paymentMethod must be 'cash' or 'online'."),
  validate,
];

const waiveValidation = [
  body('fineId').notEmpty().withMessage('fineId is required.'),
  body('reason')
    .trim()
    .isLength({ min: 20 })
    .withMessage('Waiver justification reason must be at least 20 characters long.'),
  validate,
];

// All routes require authentication
router.use(protect);

router.get('/', isLibrarian, getFines);
router.get('/member/:memberId', getMemberFines);
router.post('/collect', isLibrarian, collectValidation, logAction('COLLECT_FINE', 'Fine'), collectFines);
router.post('/waive', isAdmin, waiveValidation, logAction('WAIVE_FINE', 'Fine'), waiveFine);

module.exports = router;
