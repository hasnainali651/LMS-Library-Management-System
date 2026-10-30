const request = require('supertest');
const app = require('../src/app');
const { User } = require('../src/models');
const { templates } = require('../src/services/emailService');
const { isAdmin, isLibrarian, isMember } = require('../src/middleware/roles');

describe('Auth System Integration & Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Email Templates (Inline CSS, No <img> tags)', () => {
    it('should generate verifyEmail template without img tags', () => {
      const html = templates.verifyEmail('John Doe', 'http://localhost:3000/verify-email?token=123');
      expect(html).toContain('John Doe');
      expect(html).toContain('http://localhost:3000/verify-email?token=123');
      expect(html).not.toContain('<img');
    });

    it('should generate resetPassword template with urgency notice and no img tags', () => {
      const html = templates.resetPassword('John Doe', 'http://localhost:3000/reset-password?token=456');
      expect(html).toContain('URGENCY NOTICE');
      expect(html).toContain('30 minutes');
      expect(html).not.toContain('<img');
    });

    it('should generate welcomeEmail template with memberId and no img tags', () => {
      const html = templates.welcomeEmail('Jane Doe', 'LIB-123456');
      expect(html).toContain('LIB-123456');
      expect(html).not.toContain('<img');
    });

    it('should generate accountLocked template with 1 hour security alert and no img tags', () => {
      const html = templates.accountLocked('Alex', Date.now() + 3600000);
      expect(html).toContain('5 consecutive failed login attempts');
      expect(html).not.toContain('<img');
    });
  });

  describe('Role Authorization Middleware', () => {
    it('should forbid unauthorized roles with 403', () => {
      const req = { user: { role: 'student' } };
      let errorPassed = null;
      const next = (err) => {
        errorPassed = err;
      };

      isAdmin(req, {}, next);
      expect(errorPassed).toBeDefined();
      expect(errorPassed.statusCode).toBe(403);
    });

    it('should allow authorized roles', () => {
      const req = { user: { role: 'admin' } };
      let calledNext = false;
      const next = () => {
        calledNext = true;
      };

      isAdmin(req, {}, next);
      expect(calledNext).toBe(true);
    });

    it('should allow student in isMember', () => {
      const req = { user: { role: 'student' } };
      let calledNext = false;
      const next = () => {
        calledNext = true;
      };

      isMember(req, {}, next);
      expect(calledNext).toBe(true);
    });
  });

  describe('Authentication Endpoints Validation', () => {
    it('should reject weak password during registration with 422', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Weak User',
          email: 'weak@example.com',
          password: 'password', // Missing uppercase, number, special char
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'password' }),
        ])
      );
    });

    it('should fail explicitly when the authentication service is unavailable', async () => {
      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent-user-12345@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Authentication service temporarily unavailable.');
    });

    it('should reject forgot-password with 404 if email does not exist in database', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: 'nonexistent-user-xyz@example.com',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('No account found with this email address');
    });

    it('should protect /me and reject requests without Bearer token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
