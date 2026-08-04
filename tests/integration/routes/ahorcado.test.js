const request = require('supertest');
const jwt = require('jsonwebtoken');
const createApp = require('../../../src/app');

describe('Ahorcado routes', () => {
  const app = createApp();

  it('GET /api/ahorcado/phrases returns 401 without token', async () => {
    const res = await request(app).get('/api/ahorcado/phrases');
    expect(res.status).toBe(401);
  });

  it('GET /api/ahorcado/phrases returns the phrase list with a valid token', async () => {
    process.env.JWT_SECRET = 'test-secret';
    const token = jwt.sign({ scopes: [] }, process.env.JWT_SECRET);
    const res = await request(app)
      .get('/api/ahorcado/phrases')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('phrases');
    expect(Array.isArray(res.body.phrases)).toBe(true);
    expect(res.body.phrases).toContain('A una bala');
  });

  it('GET /api/ahorcado/channel returns 401 without token', async () => {
    const res = await request(app).get('/api/ahorcado/channel');
    expect(res.status).toBe(401);
  });
});
