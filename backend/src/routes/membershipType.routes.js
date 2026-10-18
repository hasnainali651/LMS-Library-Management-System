const express = require('express');
const { body } = require('express-validator');
const {
  getMembershipTypes,
  getMembershipTypeById,
  createMembershipType,
  updateMembershipType,
  deleteMembershipType,
} = require('../controllers/membershipType.controller');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roles');
const { validate } = require('../middleware/validate');
const { logAction } = require('../middleware/auditLog');

const router = express.Router();

const createMembershipTypeValidation = [
  body('name').trim().notEmpty().withMessage('Membership type identifier name is required.'),
  body('displayName').trim().notEmpty().withMessage('Display name is required.'),
  body('maxBooks').optional().isInt({ min: 1 }).withMessage('maxBooks must be at least 1.'),
  body('loanDays').optional().isInt({ min: 1 }).withMessage('loanDays must be at least 1.'),
  body('finePerDay').optional().isFloat({ min: 0 }).withMessage('finePerDay cannot be negative.'),
  validate,
];

router.get('/', getMembershipTypes);
router.get('/:id', getMembershipTypeById);

router.post(
  '/',
  protect,
  isAdmin,
  createMembershipTypeValidation,
  logAction('CREATE_MEMBERSHIP_TYPE', 'MembershipType'),
  createMembershipType
);

router.put(
  '/:id',
  protect,
  isAdmin,
  logAction('UPDATE_MEMBERSHIP_TYPE', 'MembershipType'),
  updateMembershipType
);

router.delete(
  '/:id',
  protect,
  isAdmin,
  logAction('DELETE_MEMBERSHIP_TYPE', 'MembershipType'),
  deleteMembershipType
);

module.exports = router;
