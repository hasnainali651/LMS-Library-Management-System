const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const { isLibrarian } = require('../middleware/roles');
const { uploadSingle, validateFileMagicBytes } = require('../middleware/upload');
const {
  identifyBookHandler,
  analyzeShelfHandler,
  getAuditHistory,
} = require('../controllers/ai.controller');

const router = express.Router();

// ---------------------------------------------------------------------------
// Rate Limiter: 20 requests / hour per IP for all AI routes
// ---------------------------------------------------------------------------
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: {
    success: false,
    message:
      'AI rate limit exceeded. You may make up to 20 AI requests per hour. Please try again later.',
    errors: [],
  },
  skip: (req) =>
    process.env.NODE_ENV === 'test', // skip limiter in test environment
});

// Apply rate limiter to ALL routes in this router
router.use(aiRateLimiter);

// All AI routes require authentication + librarian (or admin) role
router.use(protect, isLibrarian);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/ai/identify-book
 * Upload a cover or spine image → AI-extracted metadata + DB match(es)
 */
router.post(
  '/identify-book',
  uploadSingle('image'),
  validateFileMagicBytes,
  identifyBookHandler
);

/**
 * POST /api/v1/ai/shelf-audit
 * Upload a shelf photo + shelfLocation in body → full misplaced/missing report
 */
router.post(
  '/shelf-audit',
  uploadSingle('image'),
  validateFileMagicBytes,
  analyzeShelfHandler
);

/**
 * GET /api/v1/ai/audit-history
 * Paginated list of past shelf audits; filter by shelfLocation, status
 */
router.get('/audit-history', getAuditHistory);

module.exports = router;
