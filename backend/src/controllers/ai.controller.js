const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { identifyBook, analyzeShelf } = require('../services/aiService');
const ShelfAudit = require('../models/ShelfAudit');

// ---------------------------------------------------------------------------
// POST /api/v1/ai/identify-book
// librarian+: upload cover/spine image → matched books
// ---------------------------------------------------------------------------
const identifyBookHandler = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'An image file is required. Upload a book cover or spine photo.');
  }

  const { buffer, mimetype } = req.file;

  // Validate MIME type (multer already filters, but double-check)
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(mimetype)) {
    throw new ApiError(400, `Unsupported image type '${mimetype}'. Use JPEG, PNG, or WebP.`);
  }

  const result = await identifyBook(buffer, mimetype);

  return res.status(200).json(
    new ApiResponse(200, {
      exactMatch: result.exactMatch,
      candidates: result.candidates,
      extracted: result.extracted,
      confidence: result.confidence,
    }, result.exactMatch
      ? 'Book identified with exact ISBN match.'
      : result.candidates.length > 0
        ? 'Book not exactly matched; candidates returned based on extracted metadata.'
        : 'Unable to identify book. No matches found in the catalog.'
    )
  );
});

// ---------------------------------------------------------------------------
// POST /api/v1/ai/shelf-audit
// librarian+: upload shelf photo → misplaced/missing report
// ---------------------------------------------------------------------------
const analyzeShelfHandler = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'A shelf image file is required.');
  }

  const { shelfLocation } = req.body;
  if (!shelfLocation || !shelfLocation.trim()) {
    throw new ApiError(400, 'shelfLocation is required in the request body (e.g. "A-12-3").');
  }

  const { buffer, mimetype } = req.file;

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(mimetype)) {
    throw new ApiError(400, `Unsupported image type '${mimetype}'. Use JPEG, PNG, or WebP.`);
  }

  // Build relative image URL if upload middleware saved a processed file
  let imageUrl = null;
  if (req.file.processed && req.file.processed.url) {
    imageUrl = req.file.processed.url;
  }

  const audit = await analyzeShelf(
    buffer,
    mimetype,
    shelfLocation.trim(),
    req.user._id.toString(),
    imageUrl
  );

  const statusCode = audit.status === 'failed' ? 502 : 200;
  const message =
    audit.status === 'failed'
      ? `Shelf audit failed: ${audit.errorMessage}`
      : `Shelf audit complete. Detected ${audit.detectedCount} book(s): ${audit.matchedCount} matched, ${audit.misplacedCount} misplaced, ${audit.unmatchedCount} unrecognized.`;

  return res.status(statusCode).json(new ApiResponse(statusCode, audit, message));
});

// ---------------------------------------------------------------------------
// GET /api/v1/ai/audit-history
// librarian+: recent audit results, paginated
// ---------------------------------------------------------------------------
const getAuditHistory = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    shelfLocation,
    status,
  } = req.query;

  const query = {};

  if (shelfLocation && shelfLocation.trim()) {
    query.shelfLocation = { $regex: shelfLocation.trim(), $options: 'i' };
  }

  if (status && ['completed', 'failed', 'processing'].includes(status)) {
    query.status = status;
  }

  const options = {
    page: Math.max(1, parseInt(page, 10) || 1),
    limit: Math.min(50, Math.max(1, parseInt(limit, 10) || 10)),
    sort: { createdAt: -1 },
    lean: true,
    populate: [
      { path: 'conductedBy', select: 'name email role' },
      { path: 'matchedBooks.dbBook', select: 'isbn title authors coverImage' },
    ],
    select:
      'conductedBy shelfLocation imageUrl status detectedCount matchedCount unmatchedCount misplacedCount report.summary createdAt updatedAt errorMessage',
  };

  const results = await ShelfAudit.paginate(query, options);

  return res.status(200).json(
    new ApiResponse(200, results, 'Shelf audit history retrieved.')
  );
});

module.exports = {
  identifyBookHandler,
  analyzeShelfHandler,
  getAuditHistory,
};
