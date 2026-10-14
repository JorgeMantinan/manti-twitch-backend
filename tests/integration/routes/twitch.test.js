const request = require('supertest');
const jwt = require('jsonwebtoken');
const createApp = require('../../../src/app');
const twitchAPIService = require('../../../src/services/twitchAPI');

describe('Twitch routes', () => {
  const app = createApp();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/twitch/avatars returns 401 without token', async () => {
    const res = await request(app).get('/api/twitch/avatars');
    expect(res.status).toBe(401);
  });

  it('GET /api/twitch/avatars returns 400 for invalid logins param', async () => {
    process.env.JWT_SECRET = 'test-secret';
    const token = jwt.sign({ scopes: [] }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    const res = await request(app)
      .get('/api/twitch/avatars?logins=bad!name')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid logins' });
  });

  it('GET /api/twitch/avatars returns 400 when logins param is missing', async () => {
    process.env.JWT_SECRET = 'test-secret';
    const token = jwt.sign({ scopes: [] }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    const res = await request(app)
      .get('/api/twitch/avatars')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid logins' });
  });

  it('GET /api/twitch/avatars returns 200 with empty avatars object', async () => {
    process.env.JWT_SECRET = 'test-secret';
    vi.spyOn(twitchAPIService, 'getAvatars').mockResolvedValueOnce({});
    const token = jwt.sign({ scopes: [] }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    const res = await request(app)
      .get('/api/twitch/avatars?logins=testuser')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ avatars: {} });
  });

  it('GET /api/twitch/avatars returns 200 with an avatars object for a valid login', async () => {
    process.env.JWT_SECRET = 'test-secret';
    vi.spyOn(twitchAPIService, 'getAvatars').mockResolvedValueOnce({ testuser: 'https://example.com/avatar.png' });
    const token = jwt.sign({ scopes: [] }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    const res = await request(app)
      .get('/api/twitch/avatars?logins=testuser')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('avatars');
    expect(typeof res.body.avatars).toBe('object');
  });
});
