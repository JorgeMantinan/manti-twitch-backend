const request = require('supertest');
const jwt = require('jsonwebtoken');
const createApp = require('../../../src/app');

describe('Auth routes', () => {
  const app = createApp();

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  const makeToken = (overrides = {}, options = {}) =>
    jwt.sign({
      twitchToken: 't-access',
      refreshToken: 't-refresh',
      twitchId: '123',
      login: 'testuser',
      scopes: [],
      ...overrides,
    }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1d', ...options });

  it('POST /auth/refresh returns 401 without token', async () => {
    const res = await request(app).post('/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('POST /auth/refresh issues a new token when the current one is valid', async () => {
    const token = makeToken();
    const res = await request(app)
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();

    const decoded = jwt.verify(res.body.token, 'test-secret', { algorithms: ['HS256'] });
    expect(decoded.login).toBe('testuser');
    expect(decoded.refreshToken).toBe('t-refresh');
    expect(decoded.scopes).toEqual([]);
  });

  it('POST /auth/refresh returns 401 for an expired token', async () => {
    const token = makeToken({}, { expiresIn: '-1s' });
    const res = await request(app)
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('POST /auth/refresh returns 401 for a token signed with another secret', async () => {
    const token = jwt.sign({ login: 'testuser' }, 'other-secret', { algorithm: 'HS256' });
    const res = await request(app)
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('POST /auth/exchange returns 400 for a missing code', async () => {
    const res = await request(app).post('/auth/exchange').send({});
    expect(res.status).toBe(400);
  });

  it('POST /auth/exchange returns 400 for an unknown code', async () => {
    const res = await request(app).post('/auth/exchange').send({ code: 'does-not-exist' });
    expect(res.status).toBe(400);
  });

  it('GET /auth/twitch redirects to Twitch with a state parameter', async () => {
    const res = await request(app).get('/auth/twitch');
    expect([301, 302]).toContain(res.status);
    expect(res.headers.location).toContain('id.twitch.tv/oauth2/authorize');
    expect(res.headers.location).toContain('&state=');
  });

  it('GET /auth/twitch/callback returns 400 without state', async () => {
    const res = await request(app).get('/auth/twitch/callback?code=abc');
    expect(res.status).toBe(400);
  });
});
