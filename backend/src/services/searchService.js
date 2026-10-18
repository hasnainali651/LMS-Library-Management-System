/**
 * Build MongoDB aggregation pipeline for advanced multi-field search with AND/OR logic
 * @param {Object} filters
 * @returns {Array} MongoDB aggregation pipeline stages
 */
const buildSearchPipeline = (filters = {}) => {
  const {
    logic = 'AND',
    title,
    author,
    category,
    isbn,
    publisher,
    yearFrom,
    yearTo,
    language,
    availableOnly,
    page = 1,
    limit = 10,
    sort = 'title',
  } = filters;

  const matchClauses = [];

  if (title && title.trim()) {
    matchClauses.push({ title: { $regex: title.trim(), $options: 'i' } });
  }

  if (author && author.trim()) {
    matchClauses.push({ authors: { $regex: author.trim(), $options: 'i' } });
  }

  if (category && category.trim()) {
    matchClauses.push({ categories: { $in: [category.trim()] } });
  }

  if (isbn && isbn.trim()) {
    const cleaned = isbn.trim().replace(/[- ]/g, '');
    matchClauses.push({ isbn: { $regex: cleaned, $options: 'i' } });
  }

  if (publisher && publisher.trim()) {
    matchClauses.push({ publisher: { $regex: publisher.trim(), $options: 'i' } });
  }

  if (yearFrom || yearTo) {
    const yearQuery = {};
    if (yearFrom) yearQuery.$gte = parseInt(yearFrom, 10);
    if (yearTo) yearQuery.$lte = parseInt(yearTo, 10);
    matchClauses.push({ publishedYear: yearQuery });
  }

  if (language && language.trim()) {
    matchClauses.push({ language: { $regex: `^${language.trim()}$`, $options: 'i' } });
  }

  if (availableOnly === true || availableOnly === 'true') {
    matchClauses.push({ availableCopies: { $gt: 0 } });
  }

  const baseMatch = { isActive: true };
  let finalMatch = { ...baseMatch };

  if (matchClauses.length > 0) {
    const isOr = String(logic).toUpperCase() === 'OR';
    if (isOr) {
      finalMatch = {
        ...baseMatch,
        $or: matchClauses,
      };
    } else {
      finalMatch = {
        ...baseMatch,
        $and: matchClauses,
      };
    }
  }

  // Sort Stage mapping
  let sortStage = { title: 1 };
  if (sort === 'year') {
    sortStage = { publishedYear: -1 };
  } else if (sort === 'rating') {
    sortStage = { averageRating: -1, ratingCount: -1 };
  } else if (sort === 'popular') {
    sortStage = { borrowCount: -1 };
  } else if (sort === 'newest') {
    sortStage = { createdAt: -1 };
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
  const skip = (parsedPage - 1) * parsedLimit;

  const pipeline = [
    { $match: finalMatch },
    { $sort: sortStage },
    {
      $facet: {
        docs: [{ $skip: skip }, { $limit: parsedLimit }],
        totalCount: [{ $count: 'count' }],
      },
    },
    {
      $project: {
        docs: 1,
        totalDocs: { $ifNull: [{ $arrayElemAt: ['$totalCount.count', 0] }, 0] },
        page: { $literal: parsedPage },
        limit: { $literal: parsedLimit },
      },
    },
  ];

  return pipeline;
};

module.exports = {
  buildSearchPipeline,
};
