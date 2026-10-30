require('./providerIsolation');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { User, Book, Copy, Transaction, Reservation, Fine } = require('../src/models');
const redis = require('../src/config/redis');
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
} = require('../src/controllers/analytics.controller');

describe('Analytics API Test Suite (/api/v1/analytics)', () => {
  const jwtSecret =
    process.env.JWT_SECRET || 'default_jwt_secret_key_minimum_64_characters_placeholder_key';

  const createAuthToken = (userObj) => {
    return jwt.sign({ _id: userObj._id, role: userObj.role }, jwtSecret, { expiresIn: '1h' });
  };

  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Admin User',
    email: 'admin@library.com',
    role: 'admin',
    isActive: true,
  };

  const librarianUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Librarian User',
    email: 'librarian@library.com',
    role: 'librarian',
    isActive: true,
    isStaffApproved: true,
  };

  const studentUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Student User',
    email: 'student@library.com',
    role: 'student',
    isActive: true,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Route Access Control & RBAC Guards', () => {
    it('GET /api/v1/analytics/categories/demand should be publicly accessible without authentication', async () => {
      jest.spyOn(Transaction, 'aggregate').mockResolvedValue([
        { category: 'Fiction', borrowCount: 15 },
        { category: 'Science', borrowCount: 9 },
      ]);

      const res = await request(app).get('/api/v1/analytics/categories/demand');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].category).toBe('Fiction');
    });

    it('GET /api/v1/analytics/dashboard should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/analytics/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/analytics/dashboard should reject non-admin users with 403', async () => {
      const studentToken = createAuthToken(studentUser);
      jest.spyOn(User, 'findById').mockResolvedValue(studentUser);

      const res = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('GET /api/v1/analytics/circulation/trends should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/analytics/circulation/trends');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/analytics/circulation/trends should allow librarian access', async () => {
      const librarianToken = createAuthToken(librarianUser);
      jest.spyOn(User, 'findById').mockResolvedValue(librarianUser);
      jest.spyOn(Transaction, 'aggregate').mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/analytics/circulation/trends')
        .set('Authorization', `Bearer ${librarianToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(30);
    });

    it('GET /api/v1/analytics/books/demand should reject non-admin with 403', async () => {
      const librarianToken = createAuthToken(librarianUser);
      jest.spyOn(User, 'findById').mockResolvedValue(librarianUser);

      const res = await request(app)
        .get('/api/v1/analytics/books/demand')
        .set('Authorization', `Bearer ${librarianToken}`);

      expect(res.status).toBe(403);
    });

    it('GET /api/v1/analytics/books/idle should reject non-admin with 403', async () => {
      const librarianToken = createAuthToken(librarianUser);
      jest.spyOn(User, 'findById').mockResolvedValue(librarianUser);

      const res = await request(app)
        .get('/api/v1/analytics/books/idle')
        .set('Authorization', `Bearer ${librarianToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Dashboard Metrics Controller & Redis Caching', () => {
    it('should aggregate all dashboard KPIs concurrently with Promise.all and return structured response', async () => {
      // Mock Redis get to return null (cache miss)
      if (redis.get) jest.spyOn(redis, 'get').mockResolvedValue(null);
      if (redis.set) jest.spyOn(redis, 'set').mockResolvedValue('OK');

      jest.spyOn(Book, 'countDocuments').mockResolvedValue(150);
      jest.spyOn(Copy, 'countDocuments').mockImplementation((filter) => {
        if (filter?.status === 'available') return Promise.resolve(210);
        return Promise.resolve(300);
      });
      jest.spyOn(User, 'countDocuments').mockImplementation((filter) => {
        if (filter?.createdAt) return Promise.resolve(12); // newMembersThisMonth
        return Promise.resolve(85); // totalMembers
      });
      jest.spyOn(Transaction, 'countDocuments').mockImplementation((filter) => {
        if (filter?.issueDate) return Promise.resolve(14); // booksIssuedToday
        if (filter?.returnDate) return Promise.resolve(8); // booksReturnedToday
        if (filter?.status === 'overdue') return Promise.resolve(5); // overdueCount
        return Promise.resolve(0);
      });
      jest.spyOn(Reservation, 'countDocuments').mockResolvedValue(7);
      jest.spyOn(Fine, 'aggregate').mockImplementation((pipeline) => {
        if (pipeline[0].$unwind === '$payments') return Promise.resolve([{ _id: null, total: 3400 }]);
        if (pipeline[0].$group) return Promise.resolve([{ _id: null, total: 1200 }]);
        return Promise.resolve([]);
      });

      const mockRecentTx = [
        {
          _id: new mongoose.Types.ObjectId(),
          member: { name: 'John Doe', email: 'john@example.com' },
          book: { title: 'Clean Architecture' },
          status: 'active',
          issueDate: new Date(),
        },
      ];
      jest.spyOn(Transaction, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockRecentTx),
      });

      const req = { user: adminUser };
      let resJson = null;
      const res = {
        status: (code) => {
          expect(code).toBe(200);
          return {
            json: (payload) => {
              resJson = payload;
              return payload;
            },
          };
        },
      };

      await getDashboardMetrics(req, res, () => {});

      expect(resJson).toBeDefined();
      expect(resJson.success).toBe(true);
      expect(resJson.data.kpis).toEqual({
        totalBooks: 150,
        totalCopies: 300,
        availableCopies: 210,
        totalMembers: 85,
        booksIssuedToday: 14,
        booksReturnedToday: 8,
        overdueCount: 5,
        pendingReservations: 7,
        finesCollectedThisMonth: 3400,
        finesPendingTotal: 1200,
        newMembersThisMonth: 12,
      });
      expect(resJson.data.recentTransactions).toHaveLength(1);
      expect(resJson.data.recentTransactions[0].book.title).toBe('Clean Architecture');
    });

    it('should serve cached dashboard data from Redis when available', async () => {
      const originalStatus = redis.status;
      redis.status = 'ready';
      const cachedPayload = {
        kpis: { totalBooks: 999, totalCopies: 2000 },
        recentTransactions: [],
      };
      jest.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(cachedPayload));

      const req = { user: adminUser };
      let resJson = null;
      const res = {
        status: (code) => {
          expect(code).toBe(200);
          return {
            json: (payload) => {
              resJson = payload;
              return payload;
            },
          };
        },
      };

      try {
        await getDashboardMetrics(req, res, () => {});
      } finally {
        redis.status = originalStatus;
      }

      expect(resJson.data.kpis.totalBooks).toBe(999);
      expect(resJson.message).toContain('cached');
    });
  });

  describe('Circulation Trends', () => {
    it('should aggregate daily issue and return counts and populate full 30-day sequence with 0s', async () => {
      const today = new Date().toISOString().split('T')[0];

      jest.spyOn(Transaction, 'aggregate').mockImplementation((pipeline) => {
        const match = pipeline[0].$match;
        if (match?.issueDate) {
          return Promise.resolve([{ _id: today, count: 5 }]);
        }
        if (match?.returnDate) {
          return Promise.resolve([{ _id: today, count: 3 }]);
        }
        return Promise.resolve([]);
      });

      const req = {};
      let resJson = null;
      const res = {
        status: (code) => {
          expect(code).toBe(200);
          return {
            json: (payload) => {
              resJson = payload;
              return payload;
            },
          };
        },
      };

      await getCirculationTrends(req, res, () => {});

      expect(resJson.data).toHaveLength(30);
      const todayEntry = resJson.data.find((d) => d.date === today);
      expect(todayEntry).toBeDefined();
      expect(todayEntry.issued).toBe(5);
      expect(todayEntry.returned).toBe(3);

      const otherEntry = resJson.data.find((d) => d.date !== today);
      expect(otherEntry.issued).toBe(0);
      expect(otherEntry.returned).toBe(0);
    });
  });

  describe('Books Popular & Inventory', () => {
    it('GET /books/popular should return both thisMonth and allTime top lists', async () => {
      const mockMonthly = [
        { title: 'The Pragmatic Programmer', monthlyBorrows: 8, borrowCount: 50 },
      ];
      const mockAllTime = [
        { title: 'Clean Code', borrowCount: 120 },
      ];

      jest.spyOn(Transaction, 'aggregate').mockResolvedValue(mockMonthly);
      jest.spyOn(Book, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockAllTime),
      });

      const req = {};
      let resJson = null;
      const res = {
        status: () => ({
          json: (payload) => {
            resJson = payload;
          },
        }),
      };

      await getPopularBooks(req, res, () => {});

      expect(resJson.data.thisMonth).toHaveLength(1);
      expect(resJson.data.thisMonth[0].title).toBe('The Pragmatic Programmer');
      expect(resJson.data.allTime).toHaveLength(1);
      expect(resJson.data.allTime[0].title).toBe('Clean Code');
    });

    it('GET /books/inventory should aggregate copies per status and condition', async () => {
      jest.spyOn(Copy, 'aggregate').mockImplementation((pipeline) => {
        const groupField = pipeline[0].$group._id;
        if (groupField === '$status') {
          return Promise.resolve([
            { _id: 'available', count: 120 },
            { _id: 'issued', count: 45 },
            { _id: 'damaged', count: 3 },
          ]);
        }
        if (groupField === '$condition') {
          return Promise.resolve([
            { _id: 'new', count: 100 },
            { _id: 'good', count: 68 },
          ]);
        }
        return Promise.resolve([]);
      });
      jest.spyOn(Copy, 'countDocuments').mockResolvedValue(168);

      const req = {};
      let resJson = null;
      const res = {
        status: () => ({
          json: (payload) => {
            resJson = payload;
          },
        }),
      };

      await getBookInventory(req, res, () => {});

      expect(resJson.data.totalCopies).toBe(168);
      expect(resJson.data.byStatus.available).toBe(120);
      expect(resJson.data.byStatus.issued).toBe(45);
      expect(resJson.data.byStatus.damaged).toBe(3);
      expect(resJson.data.byStatus.retired).toBe(0);
    });
  });

  describe('Demand and Idle Books Analysis', () => {
    it('GET /books/demand should return books with pending waitlist and zero-available copies', async () => {
      const mockWaitlist = [
        { title: 'Designing Data-Intensive Applications', waitlistCount: 4, availableCopies: 0 },
      ];
      const mockOutOfStock = [
        { title: 'Refactoring', borrowCount: 30, availableCopies: 0 },
      ];

      jest.spyOn(Reservation, 'aggregate').mockResolvedValue(mockWaitlist);
      jest.spyOn(Book, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOutOfStock),
      });

      const req = {};
      let resJson = null;
      const res = {
        status: () => ({
          json: (payload) => {
            resJson = payload;
          },
        }),
      };

      await getBookDemand(req, res, () => {});

      expect(resJson.data.waitlistBooks).toHaveLength(1);
      expect(resJson.data.waitlistBooks[0].waitlistCount).toBe(4);
      expect(resJson.data.zeroAvailableBooks).toHaveLength(1);
      expect(resJson.data.zeroAvailableBooks[0].title).toBe('Refactoring');
    });

    it('GET /books/idle should find books with 0 borrows in last 6 months', async () => {
      const activeBookId = new mongoose.Types.ObjectId();
      const idleBook = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Legacy Pascal Guide',
        borrowCount: 0,
      };

      jest.spyOn(Transaction, 'distinct').mockResolvedValue([activeBookId]);
      jest.spyOn(Book, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([idleBook]),
      });
      jest.spyOn(Book, 'countDocuments').mockResolvedValue(1);

      const req = { query: { page: 1, limit: 10 } };
      let resJson = null;
      const res = {
        status: () => ({
          json: (payload) => {
            resJson = payload;
          },
        }),
      };

      await getIdleBooks(req, res, () => {});

      expect(resJson.data.docs).toHaveLength(1);
      expect(resJson.data.docs[0].title).toBe('Legacy Pascal Guide');
      expect(resJson.data.totalDocs).toBe(1);
    });
  });

  describe('Fines Summary & Member Activity', () => {
    it('GET /fines/summary should aggregate last 12 months with collected, waived, and pending totals', async () => {
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      jest.spyOn(Fine, 'aggregate').mockResolvedValue([
        {
          _id: currentMonthStr,
          collected: 1500,
          waived: 200,
          pending: 800,
          totalFineAmount: 2500,
          count: 10,
        },
      ]);

      const req = {};
      let resJson = null;
      const res = {
        status: () => ({
          json: (payload) => {
            resJson = payload;
          },
        }),
      };

      await getFinesSummary(req, res, () => {});

      expect(resJson.data.monthly).toHaveLength(12);
      const currentMonth = resJson.data.monthly.find((m) => m.month === currentMonthStr);
      expect(currentMonth).toBeDefined();
      expect(currentMonth.collected).toBe(1500);
      expect(currentMonth.waived).toBe(200);
      expect(currentMonth.pending).toBe(800);
      expect(resJson.data.totals.collected).toBe(1500);
      const pipeline = Fine.aggregate.mock.calls[0][0];
      const serialized = JSON.stringify(pipeline);
      expect(serialized).toContain('$$entry.paidAt');
      expect(serialized).toContain('$$entry.assessedAt');
      expect(serialized).toContain('$$entry.waivedAt');
      expect(serialized).not.toContain('$status');
      expect(pipeline).toContainEqual({ $unwind: '$entries' });
    });

    it('GET /members/activity should return top 20 active borrowers for current month', async () => {
      const mockActiveMembers = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'Avid Reader',
          email: 'reader@uni.edu',
          borrowCount: 9,
        },
      ];

      jest.spyOn(Transaction, 'aggregate').mockResolvedValue(mockActiveMembers);

      const req = {};
      let resJson = null;
      const res = {
        status: () => ({
          json: (payload) => {
            resJson = payload;
          },
        }),
      };

      await getMemberActivity(req, res, () => {});

      expect(resJson.data).toHaveLength(1);
      expect(resJson.data[0].name).toBe('Avid Reader');
      expect(resJson.data[0].borrowCount).toBe(9);
    });
  });
});
