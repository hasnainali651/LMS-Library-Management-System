const express = require('express');
const { body } = require('express-validator');
const {
  startOnboarding,
  updateOnboardingStep,
  completeOnboarding,
  oauthSignIn,
  register,
  login,
  refreshToken,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateProfile,
  changePassword,
} = require('../controllers/auth.controller');
const { protect, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logAction } = require('../middleware/auditLog');
const { uploadSingle, processImage } = require('../middleware/upload');

const router = express.Router();

// Password complexity regex: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^_\-])[A-Za-z\d@$!%*?&#^_\-]{8,}$/;

// Validation rules
const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters long.'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('A valid email address is required.'),
  body('password')
    .matches(strongPasswordRegex)
    .withMessage(
      'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
    ),
  body('membershipType')
    .optional()
    .isString().trim().isLength({ min: 1, max: 100 })
    .withMessage('Invalid membership type specified.'),
  body('role').optional().equals('student').withMessage('Public registration cannot assign staff roles.'),
  validate,
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('A valid email address is required.'),
  body('password')
    .notEmpty()
    .withMessage('Password cannot be empty.'),
  validate,
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('A valid email address is required.'),
  validate,
];

const resetPasswordValidation = [
  body('password')
    .matches(strongPasswordRegex)
    .withMessage(
      'New password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
    ),
  validate,
];

const changePasswordValidation = [
  body('oldPassword')
    .notEmpty()
    .withMessage('Old password is required.'),
  body('newPassword')
    .matches(strongPasswordRegex)
    .withMessage(
      'New password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
    ),
  validate,
];

// Route definitions
router.post('/onboarding/start', logAction('ONBOARDING_START', 'User'), startOnboarding);
router.patch('/onboarding/step', logAction('ONBOARDING_STEP', 'User'), updateOnboardingStep);
router.post('/onboarding/complete', logAction('ONBOARDING_COMPLETE', 'User'), completeOnboarding);
router.post('/oauth', logAction('OAUTH_SIGNIN', 'User'), oauthSignIn);

router.post('/register', registerValidation, logAction('USER_REGISTER', 'User'), register);
router.post('/login', loginValidation, logAction('USER_LOGIN', 'User'), login);
router.post('/refresh-token', refreshToken);
router.post('/logout', protect, logAction('USER_LOGOUT', 'User'), logout);
router.post('/verify-email/:token', logAction('VERIFY_EMAIL', 'User'), verifyEmail);
router.post('/resend-verification', optionalAuth, logAction('RESEND_VERIFICATION', 'User'), resendVerification);
router.post('/forgot-password', forgotPasswordValidation, logAction('FORGOT_PASSWORD', 'User'), forgotPassword);
router.post('/reset-password/:token', resetPasswordValidation, logAction('RESET_PASSWORD', 'User'), resetPassword);

router.get('/me', protect, getCurrentUser);
router.patch(
  '/me',
  protect,
  uploadSingle('avatar'),
  processImage('avatars'),
  logAction('UPDATE_PROFILE', 'User'),
  updateProfile
);
router.patch(
  '/change-password',
  protect,
  changePasswordValidation,
  logAction('CHANGE_PASSWORD', 'User'),
  changePassword
);

module.exports = router;
