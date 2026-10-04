const request = require('supertest');
const jwt = require('jsonwebtoken');
const createApp = require('../../../src/app');

describe('Raffle routes', () => {
  const app = createApp();

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  const authHeader = () => {
    const token = jwt.sign({ scopes: [] }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    return `Bearer ${token}`;
  };

  it('POST /api/raffle/start returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/raffle/start')
      .send({ streamer: 'test' });
    expect(res.status).toBe(401);
  });

  it('POST /api/raffle/stop returns 401 without token', async () => {
    const res = await request(app).post('/api/raffle/stop');
    expect(res.status).toBe(401);
  });

  it('POST /api/raffle/stop returns participants with a valid token', async () => {
    const res = await request(app)
      .post('/api/raffle/stop')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('POST /api/raffle/pick-winner returns 401 without token', async () => {
    const res = await request(app).post('/api/raffle/pick-winner');
    expect(res.status).toBe(401);
  });

  it('POST /api/raffle/pick-winner returns 400 when no participants', async () => {
    const res = await request(app)
      .post('/api/raffle/pick-winner')
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET / returns hello', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('🚀');
  });
});
