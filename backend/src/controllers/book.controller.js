const { Book, Copy, Transaction, Review } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { lookupISBN } = require('../services/isbnLookupService');
const { invalidateCache } = require('../middleware/cache');

/**
 * GET /
 * Public: Paginated list of active books with multi-field filtering & sorting
 */
const getBooks = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    language,
    yearFrom,
    yearTo,
    author,
    available,
    sort,
  } = req.query;

  const query = { isActive: true };

  // Category filter
  if (category) {
    query.categories = category;
  }

  // Language filter
  if (language) {
    query.language = language;
  }

  // Publication year range
  if (yearFrom || yearTo) {
    query.publishedYear = {};
    if (yearFrom) query.publishedYear.$gte = parseInt(yearFrom, 10);
    if (yearTo) query.publishedYear.$lte = parseInt(yearTo, 10);
  }

  // Author filter
  if (author) {
    query.authors = { $regex: author, $options: 'i' };
  }

  // Availability filter (bool)
  if (available !== undefined) {
    if (available === 'true' || available === true) {
      query.availableCopies = { $gt: 0 };
    } else if (available === 'false' || available === false) {
      query.availableCopies = 0;
    }
  }

  // Sorting options: title | year | rating | borrowCount
  let sortOption = { createdAt: -1 };
  if (sort === 'title') {
    sortOption = { title: 1 };
  } else if (sort === 'year') {
    sortOption = { publishedYear: -1 };
  } else if (sort === 'rating') {
    sortOption = { averageRating: -1 };
  } else if (sort === 'borrowCount') {
    sortOption = { borrowCount: -1 };
  }

  const options = {
    page: Math.max(1, parseInt(page, 10)),
    limit: Math.max(1, parseInt(limit, 10)),
    sort: sortOption,
    lean: true,
  };

  const result = await Book.paginate(query, options);

  return res.status(200).json(
    new ApiResponse(200, result, 'Books catalog retrieved successfully.')
  );
});

/**
 * GET /search
 * Public: Full-text search with textScore ranking
 */
const searchBooks = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 10 } = req.query;

  if (!q || q.trim().length < 2) {
    throw new ApiError(400, 'Search query must be at least 2 characters long.');
  }

  const query = {
    $text: { $search: q.trim() },
    isActive: true,
  };

  const options = {
    page: Math.max(1, parseInt(page, 10)),
    limit: Math.max(1, parseInt(limit, 10)),
    projection: { score: { $meta: 'textScore' } },
    sort: { score: { $meta: 'textScore' } },
    lean: true,
  };

  const result = await Book.paginate(query, options);

  return res.status(200).json(
    new ApiResponse(200, result, `Search results for "${q}".`)
  );
});

/**
 * GET /:id
 * Public: Single book details + copy status breakdown + increments viewCount
 */
const getBookById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Increment viewCount atomically
  const book = await Book.findByIdAndUpdate(
    id,
    { $inc: { viewCount: 1 } },
    { new: true }
  ).populate('addedBy', 'name');

  if (!book || !book.isActive) {
    throw new ApiError(404, 'Book not found or is currently inactive.');
  }

  // Aggregate copy status metrics
  const copyStatusAggregation = await Copy.aggregate([
    { $match: { book: book._id } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const copyStatuses = {
    available: 0,
    issued: 0,
    reserved: 0,
    lost: 0,
    damaged: 0,
    in_repair: 0,
    retired: 0,
  };

  copyStatusAggregation.forEach((item) => {
    if (copyStatuses.hasOwnProperty(item._id)) {
      copyStatuses[item._id] = item.count;
    }
  });

  const responseData = {
    ...book.toObject(),
    copyStatuses,
  };

  return res.status(200).json(
    new ApiResponse(200, responseData, 'Book details retrieved successfully.')
  );
});

/**
 * POST /
 * Librarian+: Create a new book. 409 if ISBN exists.
 */
const createBook = asyncHandler(async (req, res) => {
  const {
    isbn,
    title,
    authors,
    publisher,
    publishedYear,
    edition,
    language,
    description,
    categories,
    tags,
    deweyDecimal,
    price,
  } = req.body;

  const cleanedIsbn = isbn.replace(/[- ]/g, '').toUpperCase();

  const existingBook = await Book.findOne({ isbn: cleanedIsbn });
  if (existingBook) {
    throw new ApiError(409, `Book with ISBN ${cleanedIsbn} already exists in catalog.`);
  }

  const book = await Book.create({
    isbn: cleanedIsbn,
    title: title.trim(),
    authors: Array.isArray(authors) ? authors : [authors],
    publisher,
    publishedYear,
    edition,
    language: language || 'English',
    description,
    categories: Array.isArray(categories) ? categories : [categories],
    tags: Array.isArray(tags) ? tags : [],
    deweyDecimal,
    price: price || 0,
    addedBy: req.user._id,
    totalCopies: 0,
    availableCopies: 0,
  });

  // Invalidate cached dashboard and books lists
  await invalidateCache('analytics:dashboard', 'books:list:*');

  return res.status(201).json(
    new ApiResponse(201, book, 'Book created successfully.')
  );
});

/**
 * PUT /:id
 * Librarian+: Update book (no ISBN change allowed)
 */
const updateBook = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const book = await Book.findById(id);
  if (!book) {
    throw new ApiError(404, 'Book not found.');
  }

  // Prevent modifying ISBN
  const updates = { ...req.body };
  delete updates.isbn;
  delete updates.addedBy;
  delete updates.totalCopies;
  delete updates.availableCopies;

  const updatedBook = await Book.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  // Invalidate cached dashboard and books lists
  await invalidateCache('analytics:dashboard', 'books:list:*');

  return res.status(200).json(
    new ApiResponse(200, updatedBook, 'Book updated successfully.')
  );
});

/**
 * DELETE /:id
 * Admin: Soft delete (isActive = false). Rejects if copies are currently issued or reserved.
 */
const deleteBook = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const book = await Book.findById(id);
  if (!book) {
    throw new ApiError(404, 'Book not found.');
  }

  // Check if any copy is issued or reserved
  const hasActiveCopies = await Copy.exists({
    book: id,
    status: { $in: ['issued', 'reserved'] },
  });

  if (hasActiveCopies) {
    throw new ApiError(
      400,
      'Cannot delete book while copies are currently issued or reserved by patrons.'
    );
  }

  book.isActive = false;
  await book.save();

  // Invalidate cached dashboard and books lists
  await invalidateCache('analytics:dashboard', 'books:list:*');

  return res.status(200).json(
    new ApiResponse(200, null, 'Book deactivated successfully.')
  );
});

/**
 * POST /isbn-lookup
 * Librarian+: Fetch metadata preview from Open Library, fallback to Google Books
 */
const isbnLookup = asyncHandler(async (req, res) => {
  const { isbn } = req.body;

  if (!isbn) {
    throw new ApiError(400, 'ISBN is required for lookup.');
  }

  const preview = await lookupISBN(isbn);

  return res.status(200).json(
    new ApiResponse(200, preview, 'ISBN metadata preview fetched successfully.')
  );
});

/**
 * POST /:id/cover
 * Librarian+: Upload single cover image, process with Sharp to 800x1200 WebP
 */
const uploadCover = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const book = await Book.findById(id);
  if (!book) {
    throw new ApiError(404, 'Book not found.');
  }

  if (!req.file || !req.file.processed) {
    throw new ApiError(400, 'Please upload a valid image file for the book cover.');
  }

  book.coverImage = req.file.processed.url;
  await book.save();

  return res.status(200).json(
    new ApiResponse(200, book, 'Book cover uploaded and processed successfully.')
  );
});

/**
 * GET /:id/copies
 * Librarian+: All copies of this book with current borrower name if issued
 */
const getBookCopies = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const book = await Book.findById(id);
  if (!book) {
    throw new ApiError(404, 'Book not found.');
  }

  const copies = await Copy.find({ book: id }).sort('copyNumber').lean();

  // Find active borrowers for issued copies
  const issuedCopyIds = copies.filter((c) => c.status === 'issued').map((c) => c._id);

  let borrowerMap = {};
  if (issuedCopyIds.length > 0) {
    const activeTransactions = await Transaction.find({
      copy: { $in: issuedCopyIds },
      status: 'active',
    }).populate('member', 'name email memberId').lean();

    activeTransactions.forEach((tx) => {
      borrowerMap[tx.copy.toString()] = tx.member?.name || 'Unknown Borrower';
    });
  }

  const enrichedCopies = copies.map((c) => ({
    ...c,
    fullBarcode: `LMS-${c._id}`,
    currentBorrower: borrowerMap[c._id.toString()] || null,
  }));

  return res.status(200).json(
    new ApiResponse(200, enrichedCopies, 'Book copies retrieved successfully.')
  );
});

/**
 * POST /:id/copies
 * Librarian+: Add N copies (max 50), auto-generate copyNumber & barcode, increment book totals
 */
const addBookCopies = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { count = 1, shelfLocation = 'A-1-1', condition = 'new', purchasePrice } = req.body;

  const numCopies = parseInt(count, 10);
  if (isNaN(numCopies) || numCopies < 1 || numCopies > 50) {
    throw new ApiError(400, 'Count must be an integer between 1 and 50.');
  }

  const book = await Book.findById(id);
  if (!book) {
    throw new ApiError(404, 'Book not found.');
  }

  // Find highest existing copy sequence number for this book
  const existingCount = await Copy.countDocuments({ book: id });

  const copiesToInsert = [];
  for (let i = 1; i <= numCopies; i++) {
    const seq = String(existingCount + i).padStart(3, '0');
    copiesToInsert.push({
      book: book._id,
      copyNumber: `${book.isbn}-${seq}`,
      barcode: `BC-${book.isbn}-${seq}`,
      condition: condition || 'new',
      status: 'available',
      shelfLocation: shelfLocation || 'A-1-1',
      purchaseDate: new Date(),
      purchasePrice: purchasePrice !== undefined ? purchasePrice : book.price || 0,
      addedBy: req.user._id,
    });
  }

  const createdCopies = await Copy.insertMany(copiesToInsert);

  // Update book copies counts
  book.totalCopies += numCopies;
  book.availableCopies += numCopies;
  await book.save();

  return res.status(201).json(
    new ApiResponse(201, createdCopies, `Successfully created ${numCopies} copies.`)
  );
});

/**
 * PATCH /:id/copies/:cid
 * Librarian+: Update copy status, condition, shelfLocation, notes
 */
const updateCopy = asyncHandler(async (req, res) => {
  const { id, cid } = req.params;
  const { status, condition, shelfLocation } = req.body;

  const book = await Book.findById(id);
  if (!book) {
    throw new ApiError(404, 'Book not found.');
  }

  const copy = await Copy.findOne({ _id: cid, book: id });
  if (!copy) {
    throw new ApiError(404, 'Book copy not found.');
  }

  const oldStatus = copy.status;

  if (status) copy.status = status;
  if (condition) copy.condition = condition;
  if (shelfLocation) copy.shelfLocation = shelfLocation;

  await copy.save();

  // Adjust book availableCopies if status transitioned to/from 'available'
  if (status && status !== oldStatus) {
    if (oldStatus === 'available' && status !== 'available') {
      book.availableCopies = Math.max(0, book.availableCopies - 1);
      await book.save();
    } else if (oldStatus !== 'available' && status === 'available') {
      book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
      await book.save();
    }
  }

  return res.status(200).json(
    new ApiResponse(200, copy, 'Book copy updated successfully.')
  );
});

/**
 * DELETE /:id/copies/:cid
 * Admin: Retire copy (status: retired). Reject if copy is currently issued.
 */
const retireCopy = asyncHandler(async (req, res) => {
  const { id, cid } = req.params;

  const book = await Book.findById(id);
  if (!book) {
    throw new ApiError(404, 'Book not found.');
  }

  const copy = await Copy.findOne({ _id: cid, book: id });
  if (!copy) {
    throw new ApiError(404, 'Book copy not found.');
  }

  if (copy.status === 'issued') {
    throw new ApiError(400, 'Cannot retire a copy that is currently issued to a patron.');
  }

  if (copy.status === 'retired') {
    throw new ApiError(400, 'Copy has already been retired.');
  }

  if (copy.status === 'available') {
    book.availableCopies = Math.max(0, book.availableCopies - 1);
  }

  copy.status = 'retired';
  await copy.save();
  await book.save();

  return res.status(200).json(
    new ApiResponse(200, copy, 'Book copy retired successfully.')
  );
});

/**
 * GET /:id/reviews
 * Public: Paginated list of approved reviews for book
 */
const getBookReviews = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const query = { book: id, isApproved: true };
  const options = {
    page: Math.max(1, parseInt(page, 10)),
    limit: Math.max(1, parseInt(limit, 10)),
    sort: { createdAt: -1 },
    populate: { path: 'member', select: 'name avatar' },
    lean: true,
  };

  const reviews = await Review.paginate(query, options);

  return res.status(200).json(
    new ApiResponse(200, reviews, 'Approved book reviews retrieved successfully.')
  );
});

/**
 * POST /:id/reviews
 * Student/Member: Submit review. Must have completed transaction for this book.
 */
const addBookReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  const book = await Book.findById(id);
  if (!book || !book.isActive) {
    throw new ApiError(404, 'Book not found.');
  }

  // Verify that the member has borrowed and returned this book
  const hasReturned = await Transaction.exists({
    member: req.user._id,
    book: id,
    status: 'returned',
  });

  if (!hasReturned) {
    throw new ApiError(
      403,
      'You are only eligible to review books you have previously borrowed and returned.'
    );
  }

  // Check for existing review
  const existingReview = await Review.findOne({
    book: id,
    member: req.user._id,
  });

  if (existingReview) {
    throw new ApiError(409, 'You have already submitted a review for this book.');
  }

  const review = await Review.create({
    book: id,
    member: req.user._id,
    rating,
    comment: comment || '',
    isApproved: false, // Requires librarian approval
  });

  return res.status(201).json(
    new ApiResponse(
      201,
      review,
      'Review submitted successfully. It will be publicly visible upon librarian approval.'
    )
  );
});

/**
 * PATCH /:id/reviews/:rid
 * Librarian+: Approve or reject review
 */
const moderateReview = asyncHandler(async (req, res) => {
  const { id, rid } = req.params;
  const { isApproved } = req.body;

  if (typeof isApproved !== 'boolean') {
    throw new ApiError(400, 'isApproved boolean status is required.');
  }

  const review = await Review.findOne({ _id: rid, book: id });
  if (!review) {
    throw new ApiError(404, 'Review not found.');
  }

  review.isApproved = isApproved;
  review.approvedBy = req.user._id;
  await review.save();

  // Recalculate rating metrics
  await Review.calculateAverageRating(id);

  return res.status(200).json(
    new ApiResponse(
      200,
      review,
      `Review ${isApproved ? 'approved' : 'rejected'} successfully.`
    )
  );
});

/**
 * GET /:id/similar
 * Public: Returns up to 8 similar books matching categories, sorted by borrowCount desc
 */
const getSimilarBooks = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const book = await Book.findById(id);
  if (!book) {
    throw new ApiError(404, 'Book not found.');
  }

  const similarBooks = await Book.find({
    _id: { $ne: book._id },
    categories: { $in: book.categories },
    isActive: true,
  })
    .sort({ borrowCount: -1, averageRating: -1 })
    .limit(8)
    .lean();

  return res.status(200).json(
    new ApiResponse(200, similarBooks, 'Similar books retrieved successfully.')
  );
});

module.exports = {
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
};
