const { User, Book, Copy, Transaction, Reservation, Fine } = require('../models');
const redis = require('../config/redis');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /dashboard
 * admin+: all KPIs in one response
 * Runs all queries with Promise.all, cached in Redis for 5 minutes (key: 'analytics:dashboard')
 */
const getDashboardMetrics = asyncHandler(async (req, res) => {
  const cacheKey = 'analytics:dashboard';

  // 1. Check Redis cache
  try {
    console.log('ANALYTICS_REDIS_STATUS:', redis?.status);
    if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.status(200).json(
          new ApiResponse(200, JSON.parse(cached), 'Dashboard metrics retrieved (cached).')
        );
      }
    }
  } catch (cacheErr) {
    // Graceful Redis fallback if Redis is unavailable
  }

  const now = new Date();
  const { DateTime } = require('luxon');
  const localNow = DateTime.fromJSDate(now, { zone: process.env.LIBRARY_TIMEZONE || 'Asia/Karachi' });
  const startOfDay = localNow.startOf('day').toJSDate();
  const startOfMonth = localNow.startOf('month').toJSDate();

  // 2. Run all queries concurrently with Promise.all
  const [
    totalBooks,
    totalCopies,
    availableCopies,
    totalMembers,
    booksIssuedToday,
    booksReturnedToday,
    overdueCount,
    pendingReservations,
    finesCollectedRes,
    finesPendingRes,
    newMembersThisMonth,
    recentTransactions,
  ] = await Promise.all([
    // totalBooks (isActive: true)
    Book.countDocuments({ isActive: true }),

    // totalCopies
    Copy.countDocuments(),

    // availableCopies (status: available)
    Copy.countDocuments({ status: 'available' }),

    // totalMembers (role: student, isActive: true)
    User.countDocuments({ role: 'student', isActive: true }),

    // booksIssuedToday
    Transaction.countDocuments({ issueDate: { $gte: startOfDay } }),

    // booksReturnedToday
    Transaction.countDocuments({ returnDate: { $gte: startOfDay }, status: 'returned' }),

    // overdueCount (status: overdue)
    Transaction.countDocuments({ status: 'overdue' }),

    // pendingReservations (status: pending)
    Reservation.countDocuments({ status: 'pending' }),

    Fine.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.paidAt': { $gte: startOfMonth, $lte: now } } },
      { $group: { _id: null, total: { $sum: '$payments.amount' } } },
    ]),

    Fine.aggregate([
      { $group: { _id: null, total: { $sum: { $max: [0, { $subtract: ['$amount', { $add: [{ $ifNull: ['$paidAmount', 0] }, { $ifNull: ['$waivedAmount', 0] }] }] }] } } } },
    ]),

    // newMembersThisMonth (role: student, createdAt >= startOfMonth)
    User.countDocuments({ role: 'student', createdAt: { $gte: startOfMonth } }),

    // recentTransactions (last 10 with member name + book title)
    Transaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('member', 'name email memberId')
      .populate('book', 'title isbn coverImage')
      .select('member book issueDate dueDate returnDate status fineAmount createdAt')
      .lean(),
  ]);

  const finesCollectedThisMonth = finesCollectedRes[0]?.total || 0;
  const finesPendingTotal = finesPendingRes[0]?.total || 0;

  const dashboardData = {
    kpis: {
      totalBooks,
      totalCopies,
      availableCopies,
      totalMembers,
      booksIssuedToday,
      booksReturnedToday,
      overdueCount,
      pendingReservations,
      finesCollectedThisMonth,
      finesPendingTotal,
      newMembersThisMonth,
    },
    recentTransactions,
  };

  // 3. Cache response in Redis for 5 minutes (300 seconds)
  try {
    if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
      await redis.set(cacheKey, JSON.stringify(dashboardData), 'EX', 300);
    }
  } catch (setErr) {
    // Non-fatal cache write error
  }

  return res.status(200).json(
    new ApiResponse(200, dashboardData, 'Dashboard metrics retrieved.')
  );
});

/**
 * GET /circulation/trends
 * librarian+: daily issue/return counts, last 30 days
 * Groups Transaction by day ($dateToString on issueDate / returnDate) and fills missing days with 0
 */
const getCirculationTrends = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [issuedAggregation, returnedAggregation] = await Promise.all([
    Transaction.aggregate([
      {
        $match: {
          issueDate: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$issueDate' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Transaction.aggregate([
      {
        $match: {
          returnDate: { $gte: thirtyDaysAgo },
          status: 'returned',
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$returnDate' } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const issuedMap = {};
  issuedAggregation.forEach((item) => {
    issuedMap[item._id] = item.count;
  });

  const returnedMap = {};
  returnedAggregation.forEach((item) => {
    returnedMap[item._id] = item.count;
  });

  // Generate continuous 30-day sequence ending on today
  const trends = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    trends.push({
      date: dateStr,
      issued: issuedMap[dateStr] || 0,
      returned: returnedMap[dateStr] || 0,
    });
  }

  return res.status(200).json(
    new ApiResponse(200, trends, 'Circulation trends for the last 30 days.')
  );
});

/**
 * GET /books/popular
 * librarian+: top books by borrows this month + all-time
 */
const getPopularBooks = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [monthlyTop, allTimeTop] = await Promise.all([
    // This month's top borrowed books
    Transaction.aggregate([
      { $match: { issueDate: { $gte: startOfMonth } } },
      { $group: { _id: '$book', monthlyBorrows: { $sum: 1 } } },
      { $sort: { monthlyBorrows: -1 } },
      { $limit: 10 },
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
          title: '$book.title',
          isbn: '$book.isbn',
          authors: '$book.authors',
          coverImage: '$book.coverImage',
          categories: '$book.categories',
          availableCopies: '$book.availableCopies',
          totalCopies: '$book.totalCopies',
          borrowCount: '$book.borrowCount',
          monthlyBorrows: 1,
        },
      },
    ]),

    // All-time top books by borrowCount
    Book.find({ isActive: true })
      .sort({ borrowCount: -1, averageRating: -1 })
      .limit(10)
      .select('title isbn authors coverImage categories availableCopies totalCopies borrowCount averageRating')
      .lean(),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        thisMonth: monthlyTop,
        allTime: allTimeTop,
      },
      'Top popular books retrieved.'
    )
  );
});

/**
 * GET /books/inventory
 * librarian+: copy count per status
 */
const getBookInventory = asyncHandler(async (req, res) => {
  const [statusCounts, totalCopies, conditionCounts] = await Promise.all([
    Copy.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Copy.countDocuments(),
    Copy.aggregate([
      {
        $group: {
          _id: '$condition',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
  ]);

  const byStatus = {
    available: 0,
    issued: 0,
    reserved: 0,
    lost: 0,
    damaged: 0,
    in_repair: 0,
    retired: 0,
  };

  statusCounts.forEach((item) => {
    byStatus[item._id] = item.count;
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalCopies,
        byStatus,
        statusBreakdown: statusCounts.map((s) => ({ status: s._id, count: s.count })),
        conditionBreakdown: conditionCounts.map((c) => ({ condition: c._id, count: c.count })),
      },
      'Book copy inventory status summary.'
    )
  );
});

/**
 * GET /books/demand
 * admin: books with waitlist > 0, ordered by queue size + zero available copies
 */
const getBookDemand = asyncHandler(async (req, res) => {
  const [waitlistBooks, zeroAvailableBooks] = await Promise.all([
    Reservation.aggregate([
      { $match: { status: 'pending' } },
      {
        $group: {
          _id: '$book',
          waitlistCount: { $sum: 1 },
        },
      },
      { $sort: { waitlistCount: -1 } },
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
          title: '$book.title',
          isbn: '$book.isbn',
          authors: '$book.authors',
          coverImage: '$book.coverImage',
          availableCopies: '$book.availableCopies',
          totalCopies: '$book.totalCopies',
          borrowCount: '$book.borrowCount',
          waitlistCount: 1,
        },
      },
    ]),
    Book.find({ isActive: true, availableCopies: 0 })
      .sort({ borrowCount: -1 })
      .limit(20)
      .select('title isbn authors coverImage categories availableCopies totalCopies borrowCount')
      .lean(),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        waitlistBooks,
        zeroAvailableBooks,
      },
      'High-demand books report.'
    )
  );
});

/**
 * GET /books/idle
 * admin: 0 borrows in last 6 months
 */
const getIdleBooks = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Find all book IDs borrowed within the last 6 months
  const activeBookIds = await Transaction.distinct('book', {
    issueDate: { $gte: sixMonthsAgo },
  });

  const query = {
    isActive: true,
    _id: { $nin: activeBookIds },
  };

  const [docs, totalDocs] = await Promise.all([
    Book.find(query)
      .sort({ borrowCount: 1, createdAt: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select('title isbn authors publisher publishedYear coverImage categories availableCopies totalCopies borrowCount createdAt')
      .lean(),
    Book.countDocuments(query),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        docs,
        totalDocs,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalDocs / limitNum),
      },
      'Idle books with 0 borrows in the last 6 months.'
    )
  );
});

/**
 * GET /fines/summary
 * librarian+: collected/waived/pending by month (last 12 months)
 */
const getFinesSummary = asyncHandler(async (req, res) => {
  const now = new Date();
  const { DateTime } = require('luxon');
  const localNow = DateTime.fromJSDate(now, { zone: process.env.LIBRARY_TIMEZONE || 'Asia/Karachi' });
  const twelveMonthsAgo = localNow.startOf('month').minus({ months: 11 }).toJSDate();

  const rawAggregation = await Fine.aggregate([
    { $project: { entries: { $concatArrays: [
      { $map: { input: '$assessments', as: 'entry', in: { date: '$$entry.assessedAt', assessed: '$$entry.amount', collected: 0, waived: 0, count: 1 } } },
      { $map: { input: '$payments', as: 'entry', in: { date: '$$entry.paidAt', assessed: 0, collected: '$$entry.amount', waived: 0, count: 0 } } },
      { $map: { input: '$waivers', as: 'entry', in: { date: '$$entry.waivedAt', assessed: 0, collected: 0, waived: '$$entry.amount', count: 0 } } },
      [{ date: '$createdAt', assessed: 0, collected: 0, waived: 0, count: 0,
        pending: { $max: [0, { $subtract: ['$amount', { $add: [{ $ifNull: ['$paidAmount', 0] }, { $ifNull: ['$waivedAmount', 0] }] }] }] } }],
    ] } } },
    { $unwind: '$entries' },
    { $match: { 'entries.date': { $gte: twelveMonthsAgo, $lte: now } } },
    { $group: {
      _id: { $dateToString: { format: '%Y-%m', date: '$entries.date', timezone: process.env.LIBRARY_TIMEZONE || 'Asia/Karachi' } },
      collected: { $sum: '$entries.collected' }, waived: { $sum: '$entries.waived' },
      totalFineAmount: { $sum: '$entries.assessed' }, count: { $sum: '$entries.count' },
      pending: { $sum: { $ifNull: ['$entries.pending', 0] } },
    } },
    { $sort: { _id: 1 } },
  ]);

  const dataMap = {};
  rawAggregation.forEach((item) => {
    dataMap[item._id] = {
      month: item._id,
      collected: item.collected,
      waived: item.waived,
      pending: item.pending,
      totalFineAmount: item.totalFineAmount,
      count: item.count,
    };
  });

  // Generate complete 12-month sequence
  const monthlySummary = [];
  for (let i = 11; i >= 0; i--) {
    const mStr = localNow.minus({ months: i }).toFormat('yyyy-MM');
    monthlySummary.push(
      dataMap[mStr] || {
        month: mStr,
        collected: 0,
        waived: 0,
        pending: 0,
        totalFineAmount: 0,
        count: 0,
      }
    );
  }

  const totals = monthlySummary.reduce(
    (acc, m) => {
      acc.collected += m.collected;
      acc.waived += m.waived;
      acc.pending += m.pending;
      acc.total += m.totalFineAmount;
      acc.count += m.count;
      return acc;
    },
    { collected: 0, waived: 0, pending: 0, total: 0, count: 0 }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        monthly: monthlySummary,
        totals,
        pendingBasis: 'current_outstanding_by_fine_creation_month',
        countBasis: 'assessment_entries',
      },
      'Fines summary for the last 12 months.'
    )
  );
});

/**
 * GET /members/activity
 * librarian+: top 20 most active borrowers this month
 */
const getMemberActivity = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const activeMembers = await Transaction.aggregate([
    {
      $match: {
        issueDate: { $gte: startOfMonth },
      },
    },
    {
      $group: {
        _id: '$member',
        borrowCount: { $sum: 1 },
      },
    },
    { $sort: { borrowCount: -1 } },
    { $limit: 20 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'member',
      },
    },
    { $unwind: '$member' },
    {
      $project: {
        _id: '$member._id',
        name: '$member.name',
        email: '$member.email',
        memberId: '$member.memberId',
        role: '$member.role',
        membershipType: '$member.membershipType',
        department: '$member.department',
        avatar: '$member.avatar',
        borrowCount: 1,
      },
    },
  ]);

  return res.status(200).json(
    new ApiResponse(200, activeMembers, 'Top 20 most active borrowers this month.')
  );
});

/**
 * GET /categories/demand
 * public: borrow counts per category
 */
const getCategoryDemand = asyncHandler(async (req, res) => {
  const categoryDemand = await Transaction.aggregate([
    {
      $lookup: {
        from: 'books',
        localField: 'book',
        foreignField: '_id',
        as: 'bookDoc',
      },
    },
    { $unwind: '$bookDoc' },
    { $match: { 'bookDoc.isActive': true } },
    { $unwind: '$bookDoc.categories' },
    {
      $group: {
        _id: '$bookDoc.categories',
        borrowCount: { $sum: 1 },
      },
    },
    { $sort: { borrowCount: -1 } },
    {
      $project: {
        _id: 0,
        category: '$_id',
        borrowCount: 1,
      },
    },
  ]);

  return res.status(200).json(
    new ApiResponse(200, categoryDemand, 'Borrow counts per category.')
  );
});

module.exports = {
  getDashboardMetrics,
  getCirculationTrends,
  getPopularBooks,
  getBookInventory,
  getBookDemand,
  getIdleBooks,
  getFinesSummary,
  getMemberActivity,
  getCategoryDemand,
};
