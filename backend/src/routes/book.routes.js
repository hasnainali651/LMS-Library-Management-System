const express = require('express');
const { body, query } = require('express-validator');
const {
  getBooks,
  searchBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  isbnLookup,
  uploadCover,
  getBookCopies,
  addBookCopies,
  updateCopy,
  retireCopy,
  getBookReviews,
  addBookReview,
  moderateReview,
  getSimilarBooks,
} = require('../controllers/book.controller');

const { protect } = require('../middleware/auth');
const { isLibrarian, isAdmin, isMember } = require('../middleware/roles');
const { validate } = require('../middleware/validate');
const { logAction } = require('../middleware/auditLog');
const { uploadSingle, processImage } = require('../middleware/upload');
const { isValidISBN } = require('../utils/isbnValidator');

const router = express.Router();

const currentYear = new Date().getFullYear();

// Validation Rules
const createBookValidation = [
  body('isbn')
    .notEmpty()
    .withMessage('ISBN is required.')
    .custom((val) => {
      if (!isValidISBN(val)) {
        throw new Error('Invalid ISBN. Checksum failed (Modulo-11 for ISBN-10 or Modulo-10 for ISBN-13).');
      }
      return true;
    }),
  body('title')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Title is required and cannot exceed 500 characters.'),
  body('authors')
    .custom((authors) => {
      if (!Array.isArray(authors) || authors.length < 1 || authors.length > 10) {
        throw new Error('Authors must be an array of 1 to 10 names.');
      }
      if (!authors.every((a) => typeof a === 'string' && a.trim().length > 0)) {
        throw new Error('Each author name must be a non-empty string.');
      }
      return true;
    }),
  body('publishedYear')
    .optional()
    .isInt({ min: 1000, max: currentYear + 1 })
    .withMessage(`Published year must be an integer between 1000 and ${currentYear + 1}.`),
  validate,
];

const updateBookValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Title cannot exceed 500 characters.'),
  body('authors')
    .optional()
    .custom((authors) => {
      if (!Array.isArray(authors) || authors.length < 1 || authors.length > 10) {
        throw new Error('Authors must be an array of 1 to 10 names.');
      }
      return true;
    }),
  body('publishedYear')
    .optional()
    .isInt({ min: 1000, max: currentYear + 1 })
    .withMessage(`Published year must be between 1000 and ${currentYear + 1}.`),
  validate,
];

const addCopiesValidation = [
  body('count')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Copy count must be between 1 and 50.'),
  body('shelfLocation')
    .optional()
    .matches(/^[A-Z]{1,3}-\d{1,3}-\d{1,3}$/)
    .withMessage('Shelf location must match format like A-12-3 or CS-1-10.'),
  validate,
];

const updateCopyValidation = [
  body('shelfLocation')
    .optional()
    .matches(/^[A-Z]{1,3}-\d{1,3}-\d{1,3}$/)
    .withMessage('Shelf location must match format like A-12-3 or CS-1-10.'),
  validate,
];

const reviewValidation = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5.'),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Comment cannot exceed 1000 characters.'),
  validate,
];

const { cacheMiddleware } = require('../middleware/cache');

// --- 1. Collection & Search Routes (Defined before :id) ---
router.get(
  '/',
  cacheMiddleware(
    'books:list:default',
    120,
    (req) => !req.query || Object.keys(req.query).length === 0
  ),
  getBooks
);
router.get('/search', searchBooks);
router.post('/isbn-lookup', protect, isLibrarian, isbnLookup);
router.post('/', protect, isLibrarian, createBookValidation, logAction('CREATE_BOOK', 'Book'), createBook);

// --- 2. Single Book Operations ---
router.get('/:id', getBookById);
router.put('/:id', protect, isLibrarian, updateBookValidation, logAction('UPDATE_BOOK', 'Book'), updateBook);
router.delete('/:id', protect, isAdmin, logAction('DELETE_BOOK', 'Book'), deleteBook);

router.post(
  '/:id/cover',
  protect,
  isLibrarian,
  uploadSingle('cover'),
  processImage('books'),
  logAction('UPLOAD_BOOK_COVER', 'Book'),
  uploadCover
);

router.get('/:id/similar', getSimilarBooks);

// --- 3. Physical Copies Management ---
router.get('/:id/copies', protect, isLibrarian, getBookCopies);
router.post(
  '/:id/copies',
  protect,
  isLibrarian,
  addCopiesValidation,
  logAction('ADD_BOOK_COPIES', 'Copy'),
  addBookCopies
);
router.patch(
  '/:id/copies/:cid',
  protect,
  isLibrarian,
  updateCopyValidation,
  logAction('UPDATE_BOOK_COPY', 'Copy'),
  updateCopy
);
router.delete(
  '/:id/copies/:cid',
  protect,
  isAdmin,
  logAction('RETIRE_BOOK_COPY', 'Copy'),
  retireCopy
);

// --- 4. Reviews Management ---
router.get('/:id/reviews', getBookReviews);
router.post(
  '/:id/reviews',
  protect,
  isMember,
  reviewValidation,
  logAction('ADD_BOOK_REVIEW', 'Review'),
  addBookReview
);
router.patch(
  '/:id/reviews/:rid',
  protect,
  isLibrarian,
  logAction('MODERATE_BOOK_REVIEW', 'Review'),
  moderateReview
);

module.exports = router;
