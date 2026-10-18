const express = require('express');
const { protect } = require('../middleware/auth');
const { isAdmin, isLibrarian } = require('../middleware/roles');
const {
  getDashboardMetrics,
  getCirculationTrends,
  getPopularBooks,
  getBookInventory,
  getBookDemand,
  getIdleBooks,
  getFinesSummary,
  getMemberActivity,
  getCategoryDemand,
} = require('../controllers/analytics.controller');

const router = express.Router();

/**
 * Public routes
 */
// GET /api/v1/analytics/categories/demand — public: borrow counts per category
router.get('/categories/demand', getCategoryDemand);

/**
 * Librarian+ routes (librarian, admin)
 */
// GET /api/v1/analytics/circulation/trends — librarian+: daily issue/return counts, last 30 days
router.get('/circulation/trends', protect, isLibrarian, getCirculationTrends);

// GET /api/v1/analytics/books/popular — librarian+: top books by borrows this month + all-time
router.get('/books/popular', protect, isLibrarian, getPopularBooks);

// GET /api/v1/analytics/books/inventory — librarian+: copy count per status
router.get('/books/inventory', protect, isLibrarian, getBookInventory);

// GET /api/v1/analytics/fines/summary — librarian+: collected/waived/pending by month
router.get('/fines/summary', protect, isLibrarian, getFinesSummary);

// GET /api/v1/analytics/members/activity — librarian+: top 20 most active borrowers this month
router.get('/members/activity', protect, isLibrarian, getMemberActivity);

/**
 * Admin+ routes (admin)
 */
const { cacheMiddleware } = require('../middleware/cache');

// GET /api/v1/analytics/dashboard — admin+: all KPIs in one response
router.get('/dashboard', protect, isAdmin, cacheMiddleware('analytics:dashboard', 300), getDashboardMetrics);

// GET /api/v1/analytics/books/demand — admin: books with waitlist > 0, ordered by queue size
router.get('/books/demand', protect, isAdmin, getBookDemand);

// GET /api/v1/analytics/books/idle — admin: 0 borrows in last 6 months
router.get('/books/idle', protect, isAdmin, getIdleBooks);

module.exports = router;
