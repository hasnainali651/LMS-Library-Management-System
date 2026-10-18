const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { Book, Transaction, User } = require('../src/models');
const { buildSearchPipeline } = require('../src/services/searchService');
const {
  searchBooks,
  autocomplete,
  advancedSearch,
  getNewArrivals,
  getPopular,
  getRecommended,
  getCategories,
} = require('../src/controllers/search.controller');
const redis = require('../src/config/redis');

describe('Search and Discovery System Test Suite (/api/v1/search)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Search Service: buildSearchPipeline', () => {
    it('should build pipeline with AND logic across multiple fields', () => {
      const pipeline = buildSearchPipeline({
        logic: 'AND',
        title: 'Clean',
        author: 'Martin',
        category: 'Technology',
        yearFrom: 2008,
        yearTo: 2020,
        availableOnly: true,
        page: 2,
        limit: 15,
        sort: 'year',
      });

      expect(pipeline).toHaveLength(4);
      expect(pipeline[0].$match.isActive).toBe(true);
      expect(pipeline[0].$match.$and).toHaveLength(5);
      expect(pipeline[1].$sort).toEqual({ publishedYear: -1 });
      expect(pipeline[2].$facet.docs).toEqual([{ $skip: 15 }, { $limit: 15 }]);
    });

    it('should build pipeline with OR logic across fields', () => {
      const pipeline = buildSearchPipeline({
        logic: 'OR',
        title: 'Algorithms',
        author: 'Knuth',
        page: 1,
        limit: 10,
        sort: 'rating',
      });

      expect(pipeline[0].$match.$or).toHaveLength(2);
      expect(pipeline[1].$sort).toEqual({ averageRating: -1, ratingCount: -1 });
    });
  });

  describe('Search Controller & Endpoints', () => {
    it('GET /api/v1/search/books: should perform dynamic catalog search with pagination', async () => {
      const mockResult = {
        docs: [
          {
            _id: new mongoose.Types.ObjectId(),
            title: 'Clean Code',
            authors: ['Robert C. Martin'],
            categories: ['Technology'],
            availableCopies: 3,
            publishedYear: 2008,
          },
        ],
        totalDocs: 1,
        limit: 10,
        page: 1,
        totalPages: 1,
      };

      jest.spyOn(Book, 'paginate').mockResolvedValue(mockResult);

      const res = await request(app).get('/api/v1/search/books?q=clean&category=Technology&available=true&sort=popular');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.docs).toHaveLength(1);
      expect(res.body.data.docs[0].title).toBe('Clean Code');
      expect(Book.paginate).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          categories: { $in: ['Technology'] },
          availableCopies: { $gt: 0 },
        }),
        expect.objectContaining({
          page: 1,
          limit: 10,
          sort: { borrowCount: -1 },
        })
      );
    });

    it('keeps lean pagination when text search falls back to regex', async () => {
      jest.spyOn(Book, 'paginate')
        .mockRejectedValueOnce(new Error('Text index unavailable'))
        .mockResolvedValueOnce({ docs: [], totalDocs: 0 });
      const res = await request(app).get('/api/v1/search/books?q=clean');
      expect(res.status).toBe(200);
      expect(Book.paginate).toHaveBeenCalledTimes(2);
      Book.paginate.mock.calls.forEach(([, options]) => expect(options.lean).toBe(true));
      expect(Book.paginate.mock.calls[1][1].sort).toEqual({ borrowCount: -1, averageRating: -1 });
    });

    it('GET /api/v1/search/autocomplete: should return suggestions and cache via Redis', async () => {
      const mockSuggestions = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: 'Design Patterns',
          authors: ['Erich Gamma'],
          coverImage: 'cover.jpg',
        },
      ];

      jest.spyOn(Book, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockSuggestions),
          }),
        }),
      });

      const res = await request(app).get('/api/v1/search/autocomplete?q=design');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Design Patterns');
    });

    it('GET /api/v1/search/advanced: should execute aggregation pipeline', async () => {
      const mockAggResult = [
        {
          docs: [{ _id: 'b1', title: 'Refactoring' }],
          totalDocs: 1,
          page: 1,
          limit: 10,
        },
      ];

      jest.spyOn(Book, 'aggregate').mockResolvedValue(mockAggResult);

      const res = await request(app).get('/api/v1/search/advanced?title=Refactoring&logic=AND');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.docs).toHaveLength(1);
      expect(res.body.data.totalPages).toBe(1);
    });

    it('GET /api/v1/search/new-arrivals: should return books added in last 30 days', async () => {
      jest.spyOn(Book, 'paginate').mockResolvedValue({
        docs: [{ _id: 'new1', title: 'Modern JavaScript' }],
        totalDocs: 1,
        page: 1,
        limit: 10,
      });

      const res = await request(app).get('/api/v1/search/new-arrivals?page=1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.docs[0].title).toBe('Modern JavaScript');
      expect(Book.paginate).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          createdAt: expect.objectContaining({ $gte: expect.any(Date) }),
        }),
        expect.any(Object)
      );
    });

    it('GET /api/v1/search/popular: should return popular books', async () => {
      const mockPopular = [
        { _id: 'pop1', title: 'Sapiens', borrowCount: 150 },
      ];

      jest.spyOn(Transaction, 'aggregate').mockResolvedValue([]);
      jest.spyOn(Book, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockPopular) }),
          }),
        }),
      });

      const res = await request(app).get('/api/v1/search/popular');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Sapiens');
    });

    it('GET /api/v1/search/categories: should return categories with counts', async () => {
      const mockCategories = [
        { category: 'Technology', count: 45, availableCopies: 32, totalCopies: 50 },
        { category: 'Fiction', count: 30, availableCopies: 20, totalCopies: 35 },
      ];

      jest.spyOn(Book, 'aggregate').mockResolvedValue(mockCategories);

      const res = await request(app).get('/api/v1/search/categories');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].category).toBe('Technology');
    });
  });

  describe('Personalized Recommendations (/api/v1/search/recommended)', () => {
    it('should reject unauthenticated GET /api/v1/search/recommended with 401', async () => {
      const res = await request(app).get('/api/v1/search/recommended');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return personalized recommendations based on member reading history', async () => {
      const memberId = new mongoose.Types.ObjectId();
      const borrowedBookId = new mongoose.Types.ObjectId();

      const mockTransactions = [
        {
          _id: new mongoose.Types.ObjectId(),
          book: {
            _id: borrowedBookId,
            categories: ['Technology', 'Science'],
          },
        },
      ];

      const mockRecommended = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: 'Algorithms Unlocked',
          categories: ['Technology'],
          averageRating: 4.8,
        },
      ];

      jest.spyOn(Transaction, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockTransactions) }),
          }),
        }),
      });

      jest.spyOn(Book, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockRecommended) }),
          }),
        }),
      });

      const req = { user: { _id: memberId } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await getRecommended(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            label: 'Based on your reading history',
            categories: expect.arrayContaining(['Technology', 'Science']),
            books: mockRecommended,
          }),
        })
      );
    });

    it('should fall back to popular books when member has no borrowing history', async () => {
      const memberId = new mongoose.Types.ObjectId();

      jest.spyOn(Transaction, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
          }),
        }),
      });

      const mockPopular = [
        { _id: 'pop1', title: 'Popular Title', borrowCount: 99 },
      ];

      jest.spyOn(Book, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockPopular) }),
          }),
        }),
      });

      const req = { user: { _id: memberId } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await getRecommended(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            label: 'Popular in our library',
            books: mockPopular,
          }),
        })
      );
    });
  });
});
