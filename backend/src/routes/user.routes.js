const express = require('express');
const { body, param, query } = require('express-validator');
const { getUsers, createUser, resetUserPassword, updateUserStatus } = require('../controllers/user.controller');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roles');
const { validate } = require('../middleware/validate');
const { logAction } = require('../middleware/auditLog');

const router = express.Router();
const roles = ['student', 'librarian', 'admin'];
const onlyFields = (allowed) => body().custom((value) => {
  if (!value || Array.isArray(value) || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error('Unexpected request fields.');
  }
  return true;
});
const idValidation = param('id').isMongoId().withMessage('A valid user ID is required.');
router.use(protect, isAdmin);
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString().isLength({ max: 100 }),
  query('role').optional().custom((value) => typeof value === 'string' && value.split(',').every((role) => roles.includes(role.trim()))),
  query('isActive').optional().isIn(['true', 'false']),
  validate,
], getUsers);
router.post('/', [
  onlyFields(['name', 'email', 'role', 'phone']),
  body('name').isString().trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['admin', 'librarian']),
  body('phone').optional().isString().matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/),
  validate,
], logAction('CREATE_STAFF', 'User'), createUser);
router.put('/:id/status', [
  idValidation, onlyFields(['role', 'isActive']),
  body().custom((value) => Object.keys(value).length > 0).withMessage('At least one status field is required.'),
  body('role').optional().isIn(roles),
  body('isActive').optional().isBoolean({ strict: true }),
  validate,
], logAction('UPDATE_STAFF_STATUS', 'User'), updateUserStatus);
router.post('/:id/reset-password', [idValidation, onlyFields([]), validate], logAction('RESET_STAFF_PASSWORD', 'User'), resetUserPassword);
module.exports = router;
