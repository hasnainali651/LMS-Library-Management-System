const express = require('express');
const {
  searchBooks,
  autocomplete,
  advancedSearch,
  getNewArrivals,
  getPopular,
  getRecommended,
  getCategories,
} = require('../controllers/search.controller');

const { protect } = require('../middleware/auth');

const { cacheMiddleware } = require('../middleware/cache');

const router = express.Router();

// 1. Public Search & Discovery Endpoints
router.get('/books', searchBooks);
router.get(
  '/autocomplete',
  cacheMiddleware(
    (req) => `search:autocomplete:${(req.query.q || req.query.query || '').toString().toLowerCase().trim()}`,
    60
  ),
  autocomplete
);
router.get('/advanced', advancedSearch);
router.get('/new-arrivals', getNewArrivals);
router.get('/popular', getPopular);
router.get('/categories', cacheMiddleware('search:categories', 3600), getCategories);

// 2. Protected Recommendation Endpoint
router.get('/recommended', protect, getRecommended);

module.exports = router;
