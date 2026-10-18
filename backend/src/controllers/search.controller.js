const { Book, Transaction } = require('../models');
const redis = require('../config/redis');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { buildSearchPipeline } = require('../services/searchService');

/**
 * GET /books
 * Public: Main search with text/regex fallback, filters, sorting, and pagination
 */
const searchBooks = asyncHandler(async (req, res) => {
  const {
    q,
    category,
    language,
    yearFrom,
    yearTo,
    author,
    available,
    sort = 'relevance',
    page = 1,
    limit = 10,
  } = req.query;

  const query = { isActive: true };

  // 1. Text & Regex Query Construction
  if (q && q.trim()) {
    const qTrim = q.trim();
    const regex = new RegExp(qTrim.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');

    query.$or = [
      { $text: { $search: qTrim } },
      { title: regex },
      { authors: regex },
    ];
  }

  // 2. Additional Filters
  if (category && category.trim()) {
    query.categories = { $in: [category.trim()] };
  }

  if (language && language.trim()) {
    query.language = { $regex: `^${language.trim()}$`, $options: 'i' };
  }

  if (author && author.trim()) {
    query.authors = { $regex: author.trim(), $options: 'i' };
  }

  if (available === 'true' || available === true) {
    query.availableCopies = { $gt: 0 };
  } else if (available === 'false' || available === false) {
    query.availableCopies = 0;
  }

  if (yearFrom || yearTo) {
    query.publishedYear = {};
    if (yearFrom) query.publishedYear.$gte = parseInt(yearFrom, 10);
    if (yearTo) query.publishedYear.$lte = parseInt(yearTo, 10);
  }

  // 3. Sort mapping
  let sortOption = { title: 1 };
  if (sort === 'title') {
    sortOption = { title: 1 };
  } else if (sort === 'year') {
    sortOption = { publishedYear: -1 };
  } else if (sort === 'rating') {
    sortOption = { averageRating: -1, ratingCount: -1 };
  } else if (sort === 'popular') {
    sortOption = { borrowCount: -1 };
  } else if (sort === 'relevance' && q && q.trim()) {
    sortOption = { score: { $meta: 'textScore' }, borrowCount: -1 };
  } else if (sort === 'newest') {
    sortOption = { createdAt: -1 };
  }

  const paginationOptions = {
    page: Math.max(1, parseInt(page, 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 10)),
    sort: sortOption,
    lean: true,
    select: 'isbn title authors publisher publishedYear edition language coverImage categories availableCopies totalCopies borrowCount averageRating ratingCount',
  };

  let results;
  try {
    results = await Book.paginate(query, paginationOptions);
  } catch (err) {
    // If $text inside $or or text index produces an issue, fallback to pure regex search
    if (q && q.trim()) {
      const qTrim = q.trim();
      const regex = new RegExp(qTrim.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      query.$or = [{ title: regex }, { authors: regex }, { description: regex }];
      if (sortOption.score) {
        paginationOptions.sort = { borrowCount: -1, averageRating: -1 };
      }
      results = await Book.paginate(query, paginationOptions);
    } else {
      throw err;
    }
  }

  return res.status(200).json(
    new ApiResponse(200, results, 'Books catalog search results.')
  );
});

/**
 * GET /autocomplete
 * Public: 8 title + author suggestions for partial query cached in Redis for 60s
 */
const autocomplete = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || !q.trim()) {
    return res.status(200).json(new ApiResponse(200, [], 'Empty query suggestions.'));
  }

  const q_lc = q.trim().toLowerCase();
  const cacheKey = `autocomplete:${q_lc}`;

  // 1. Check Redis cache
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.status(200).json(
          new ApiResponse(200, JSON.parse(cached), 'Autocomplete suggestions (cached).')
        );
      }
    }
  } catch (cacheErr) {
    // Graceful Redis fallback
  }

  // 2. Query MongoDB
  const escaped = q_lc.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');

  const suggestions = await Book.find({
    isActive: true,
    $or: [{ title: regex }, { authors: regex }],
  })
    .select('_id title authors coverImage')
    .limit(8)
    .lean();

  // 3. Cache in Redis for 60 seconds
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      await redis.set(cacheKey, JSON.stringify(suggestions), 'EX', 60);
    }
  } catch (setErr) {}

  return res.status(200).json(
    new ApiResponse(200, suggestions, 'Autocomplete suggestions.')
  );
});

/**
 * GET /advanced
 * Public: Multi-field AND/OR search via aggregation pipeline
 */
const advancedSearch = asyncHandler(async (req, res) => {
  const pipeline = buildSearchPipeline(req.query);
  const aggregateResult = await Book.aggregate(pipeline);

  const data = aggregateResult[0] || {
    docs: [],
    totalDocs: 0,
    page: parseInt(req.query.page, 10) || 1,
    limit: parseInt(req.query.limit, 10) || 10,
  };

  const limit = data.limit || 10;
  const totalDocs = data.totalDocs || 0;
  const totalPages = Math.ceil(totalDocs / limit);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        docs: data.docs,
        totalDocs,
        limit,
        page: data.page,
        totalPages,
      },
      'Advanced search results.'
    )
  );
});

/**
 * GET /new-arrivals
 * Public: Books added in the last 30 days, paginated
 */
const getNewArrivals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const query = {
    isActive: true,
    createdAt: { $gte: thirtyDaysAgo },
  };

  const options = {
    page: Math.max(1, parseInt(page, 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 10)),
    sort: { createdAt: -1 },
    lean: true,
    select: 'isbn title authors coverImage categories publishedYear availableCopies averageRating createdAt',
  };

  const results = await Book.paginate(query, options);

  return res.status(200).json(
    new ApiResponse(200, results, 'New arrivals (last 30 days).')
  );
});

/**
 * GET /popular
 * Public: Top 20 books by borrowCount this month
 */
const getPopular = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 1. Attempt to aggregate top monthly borrowed books
  try {
    const monthlyBorrows = await Transaction.aggregate([
      { $match: { issueDate: { $gte: startOfMonth } } },
      { $group: { _id: '$book', monthlyCount: { $sum: 1 } } },
      { $sort: { monthlyCount: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'books',
          localField: '_id',
          foreignField: '_id',
          as: 'book',
        },
      },
      { $unwind: '$book' },
      { $match: { 'book.isActive': true } },
      {
        $project: {
          _id: '$book._id',
          isbn: '$book.isbn',
          title: '$book.title',
          authors: '$book.authors',
          coverImage: '$book.coverImage',
          categories: '$book.categories',
          availableCopies: '$book.availableCopies',
          averageRating: '$book.averageRating',
          borrowCount: '$book.borrowCount',
          monthlyBorrows: '$monthlyCount',
        },
      },
    ]);

    if (monthlyBorrows.length >= 5) {
      return res.status(200).json(
        new ApiResponse(200, monthlyBorrows, 'Top 20 popular books this month.')
      );
    }
  } catch (err) {
    // Proceed to fallback
  }

  // 2. Default fallback: Top 20 overall by borrowCount
  const fallbackPopular = await Book.find({ isActive: true })
    .sort({ borrowCount: -1, averageRating: -1 })
    .limit(20)
    .select('isbn title authors coverImage categories availableCopies averageRating borrowCount')
    .lean();

  return res.status(200).json(
    new ApiResponse(200, fallbackPopular, 'Top 20 popular books.')
  );
});

/**
 * GET /recommended
 * Protected: Personalized recommendations based on patron's last 10 completed transactions
 */
const getRecommended = asyncHandler(async (req, res) => {
  const memberId = req.user._id;

  // 1. Fetch user's last 10 completed transactions
  const userTransactions = await Transaction.find({
    member: memberId,
    status: { $in: ['returned', 'active', 'overdue'] },
  })
    .sort({ issueDate: -1 })
    .limit(10)
    .populate('book', 'categories _id')
    .lean();

  const borrowedBookIds = [];
  const categoriesSet = new Set();

  for (const tx of userTransactions) {
    if (tx.book) {
      borrowedBookIds.push(tx.book._id || tx.book);
      if (Array.isArray(tx.book.categories)) {
        tx.book.categories.forEach((cat) => categoriesSet.add(cat));
      }
    }
  }

  const preferredCategories = Array.from(categoriesSet);

  // 2. If categories found, recommend unborrowed books in those categories
  if (preferredCategories.length > 0) {
    const recommendedBooks = await Book.find({
      isActive: true,
      _id: { $nin: borrowedBookIds },
      categories: { $in: preferredCategories },
    })
      .sort({ averageRating: -1, borrowCount: -1 })
      .limit(12)
      .select('isbn title authors coverImage categories availableCopies averageRating borrowCount')
      .lean();

    if (recommendedBooks.length > 0) {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            label: 'Based on your reading history',
            categories: preferredCategories,
            books: recommendedBooks,
          },
          'Personalized book recommendations.'
        )
      );
    }
  }

  // 3. Fallback if no history or no unborrowed category books
  const popularFallback = await Book.find({ isActive: true })
    .sort({ borrowCount: -1, averageRating: -1 })
    .limit(12)
    .select('isbn title authors coverImage categories availableCopies averageRating borrowCount')
    .lean();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        label: 'Popular in our library',
        categories: [],
        books: popularFallback,
      },
      'Popular recommendations.'
    )
  );
});

/**
 * GET /categories
 * Public: All categories with book counts and availability breakdown
 */
const getCategories = asyncHandler(async (req, res) => {
  const categoriesWithCounts = await Book.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$categories' },
    {
      $group: {
        _id: '$categories',
        count: { $sum: 1 },
        availableCopies: { $sum: '$availableCopies' },
        totalCopies: { $sum: '$totalCopies' },
      },
    },
    { $sort: { count: -1, _id: 1 } },
    {
      $project: {
        category: '$_id',
        count: 1,
        availableCopies: 1,
        totalCopies: 1,
        _id: 0,
      },
    },
  ]);

  return res.status(200).json(
    new ApiResponse(200, categoriesWithCounts, 'All book categories with counts.')
  );
});

module.exports = {
  searchBooks,
  autocomplete,
  advancedSearch,
  getNewArrivals,
  getPopular,
  getRecommended,
  getCategories,
};
