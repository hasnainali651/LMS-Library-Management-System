const express = require('express');
const { body } = require('express-validator');
const {
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  activateMember,
  suspendMember,
  changeMemberRole,
  getMemberTransactions,
  getMemberFines,
  getMemberReservations,
  uploadMemberAvatar,
} = require('../controllers/member.controller');

const { protect } = require('../middleware/auth');
const { isLibrarian, isAdmin } = require('../middleware/roles');
const { validate } = require('../middleware/validate');
const { logAction } = require('../middleware/auditLog');
const { uploadSingle, processImage } = require('../middleware/upload');

const router = express.Router();

const createMemberValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters.'),
  body('email').isEmail().normalizeEmail().withMessage('A valid email address is required.'),
  body('membershipType').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Invalid membership type.'),
  validate,
];

const suspendMemberValidation = [
  body('reason').trim().notEmpty().withMessage('Suspension reason is required.'),
  validate,
];

const changeRoleValidation = [
  body('role').isIn(['student', 'librarian']).withMessage("Role must be 'student' or 'librarian'."),
  validate,
];

// All routes require protection
router.use(protect);

// 1. Members Management
router.get('/', isLibrarian, getMembers);
router.get('/:id', isLibrarian, getMemberById);
router.post('/', isLibrarian, createMemberValidation, logAction('CREATE_MEMBER', 'User'), createMember);
router.put('/:id', isLibrarian, logAction('UPDATE_MEMBER', 'User'), updateMember);

// 2. Administrative Status & Role Controls
router.patch('/:id/activate', isAdmin, logAction('ACTIVATE_MEMBER', 'User'), activateMember);
router.patch('/:id/suspend', isAdmin, suspendMemberValidation, logAction('SUSPEND_MEMBER', 'User'), suspendMember);
router.patch('/:id/role', isAdmin, changeRoleValidation, logAction('CHANGE_MEMBER_ROLE', 'User'), changeMemberRole);

// 3. Member Sub-Resources
router.get('/:id/transactions', isLibrarian, getMemberTransactions);
router.get('/:id/fines', isLibrarian, getMemberFines);
router.get('/:id/reservations', isLibrarian, getMemberReservations);

// 4. Avatar Upload (Self or Librarian+)
router.post(
  '/:id/avatar',
  uploadSingle('avatar'),
  processImage('avatars'),
  logAction('UPLOAD_MEMBER_AVATAR', 'User'),
  uploadMemberAvatar
);

module.exports = router;
