const request = require('supertest');
const app = require('../src/app');

describe('API Health and Root Endpoints', () => {
  it('should return 200 and API status on root endpoint', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.version).toBe('v1');
  });

  it('should report dependency readiness on health check endpoint', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(503);
    expect(res.body.status.toLowerCase()).toBe('unavailable');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('mongodb');
    expect(res.body).toHaveProperty('redis');
    expect(res.body).toHaveProperty('worker');
    expect(res.body).toHaveProperty('version');
  });

  it('should return 404 with structured JSON for unknown routes', async () => {
    const res = await request(app).get('/non-existent-route-123');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('not found');
  });

  it('should validate auth input and return 422 with errors array on invalid login', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'invalid-email', password: '' });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});
