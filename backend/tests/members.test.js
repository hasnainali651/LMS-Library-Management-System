const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { checkEligibility } = require('../src/services/eligibilityService');
const { User, MembershipType, Transaction } = require('../src/models');

describe('Members API & Eligibility Service Test Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Eligibility Service (checkEligibility)', () => {
    it('should reject inactive or missing members', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(null);
      const res = await checkEligibility(new mongoose.Types.ObjectId());
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain('inactive/suspended');
    });

    it('should reject member with expired membership', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        isActive: true,
        membershipExpiry: pastDate,
      });

      const res = await checkEligibility(new mongoose.Types.ObjectId());
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain('expired');
    });

    it('should reject member with prolonged overdue loan (>14 days)', async () => {
      const memberId = new mongoose.Types.ObjectId();
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: memberId,
        isActive: true,
      });
      jest.spyOn(Transaction, 'exists').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      const res = await checkEligibility(memberId);
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain('prolonged overdue book');
    });

    it('should reject member exceeding fine balance limit', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        isActive: true,
        membershipType: 'student',
        fineBalance: 2500,
      });
      jest.spyOn(Transaction, 'exists').mockResolvedValue(null);
      jest.spyOn(MembershipType, 'findOne').mockResolvedValue({
        maxFineBalance: 2000,
        maxBooks: 3,
      });

      const res = await checkEligibility(new mongoose.Types.ObjectId());
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain('exceed the maximum allowable threshold');
    });

    it('should reject member who has reached maxBooks active loan quota', async () => {
      const memberId = new mongoose.Types.ObjectId();
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: memberId,
        isActive: true,
        membershipType: 'student',
        fineBalance: 50,
      });
      jest.spyOn(Transaction, 'exists').mockResolvedValue(null);
      jest.spyOn(MembershipType, 'findOne').mockResolvedValue({
        maxFineBalance: 2000,
        maxBooks: 3,
      });
      jest.spyOn(Transaction, 'countDocuments').mockResolvedValue(3);

      const res = await checkEligibility(memberId);
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain('maximum borrowing quota of 3 books');
    });

    it('should approve eligible member with active loans under limit and low fines', async () => {
      const memberId = new mongoose.Types.ObjectId();
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: memberId,
        isActive: true,
        membershipType: 'student',
        fineBalance: 10,
      });
      jest.spyOn(Transaction, 'exists').mockResolvedValue(null);
      jest.spyOn(MembershipType, 'findOne').mockResolvedValue({
        maxFineBalance: 2000,
        maxBooks: 3,
      });
      jest.spyOn(Transaction, 'countDocuments').mockResolvedValue(1);

      const res = await checkEligibility(memberId);
      expect(res.eligible).toBe(true);
      expect(res.reason).toBeNull();
      expect(res.activeLoans).toBe(1);
    });
  });

  describe('Membership Types Endpoints', () => {
    it('should list active membership types on GET /api/v1/membership-types', async () => {
      jest.spyOn(MembershipType, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { name: 'student', displayName: 'Student Membership', maxBooks: 3 },
            { name: 'faculty', displayName: 'Faculty Membership', maxBooks: 10 },
          ]),
        }),
      });

      const res = await request(app).get('/api/v1/membership-types');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('student');
    });

    it('should reject unauthenticated POST /api/v1/membership-types with 401', async () => {
      const res = await request(app)
        .post('/api/v1/membership-types')
        .send({ name: 'guest', displayName: 'Guest' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Members Management Endpoints', () => {
    it('should reject unauthenticated access to GET /api/v1/members with 401', async () => {
      const res = await request(app).get('/api/v1/members');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated POST /api/v1/members with 401', async () => {
      const res = await request(app)
        .post('/api/v1/members')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
        });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated PATCH /api/v1/members/:id/suspend with 401', async () => {
      const res = await request(app)
        .patch('/api/v1/members/user123/suspend')
        .send({ reason: 'Overdue loans' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
