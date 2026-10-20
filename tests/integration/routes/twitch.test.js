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

  it('GET /api/twitch/followings returns 401 without token', async () => {
    const res = await request(app).get('/api/twitch/followings');
    expect(res.status).toBe(401);
  });

  it('GET /api/twitch/followings returns the mapped list', async () => {
    process.env.JWT_SECRET = 'test-secret';
    vi.spyOn(twitchAPIService, 'getMyFollowings').mockResolvedValueOnce({
      rows: [{ login: 'other', name: 'Other' }],
      total: 1,
      truncated: false,
    });
    const token = jwt.sign({ twitchId: '123', scopes: [] }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    const res = await request(app)
      .get('/api/twitch/followings')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.truncated).toBe(false);
    expect(res.body.followings[0].login).toBe('other');
  });

  it('GET /api/twitch/followers returns 401 without token', async () => {
    const res = await request(app).get('/api/twitch/followers');
    expect(res.status).toBe(401);
  });

  it('GET /api/twitch/followers returns the mapped list', async () => {
    process.env.JWT_SECRET = 'test-secret';
    vi.spyOn(twitchAPIService, 'getMyFollowers').mockResolvedValueOnce({
      rows: [{ login: 'fan', name: 'Fan', at: '2026-01-01T00:00:00Z' }],
      total: 1,
      truncated: false,
    });
    const token = jwt.sign({ twitchId: '123', scopes: [] }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    const res = await request(app)
      .get('/api/twitch/followers')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.truncated).toBe(false);
    expect(res.body.followers[0].login).toBe('fan');
  });

  it('POST /api/twitch/unfollow returns 401 without token', async () => {
    const res = await request(app).post('/api/twitch/unfollow').send({ login: 'someone' });
    expect(res.status).toBe(401);
  });

  it('POST /api/twitch/unfollow returns 400 for invalid login', async () => {
    process.env.JWT_SECRET = 'test-secret';
    const token = jwt.sign({ scopes: 'user:edit:follows' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    const res = await request(app)
      .post('/api/twitch/unfollow')
      .set('Authorization', `Bearer ${token}`)
      .send({ login: 'bad!name' });
    expect(res.status).toBe(400);
  });

  it('POST /api/twitch/unfollow returns 403 when scope is missing', async () => {
    process.env.JWT_SECRET = 'test-secret';
    const token = jwt.sign(
      { twitchId: '123', scopes: 'moderator:read:followers' },
      process.env.JWT_SECRET,
      { algorithm: 'HS256' },
    );
    const res = await request(app)
      .post('/api/twitch/unfollow')
      .set('Authorization', `Bearer ${token}`)
      .send({ login: 'someone' });
    expect(res.status).toBe(403);
  });

  it('POST /api/twitch/unfollow returns 200 when the service succeeds', async () => {
    process.env.JWT_SECRET = 'test-secret';
    vi.spyOn(twitchAPIService, 'unfollowUser').mockResolvedValueOnce(true);
    const token = jwt.sign(
      { twitchId: '123', scopes: 'user:edit:follows' },
      process.env.JWT_SECRET,
      { algorithm: 'HS256' },
    );
    const res = await request(app)
      .post('/api/twitch/unfollow')
      .set('Authorization', `Bearer ${token}`)
      .send({ login: 'SomeUser' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, login: 'someuser' });
  });

  it('getMyFollowings retries once after a 429 and returns the list', async () => {
    const axios = require('axios');
    let calls = 0;
    const spy = vi.spyOn(axios, 'get').mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        const err = new Error('rate limited');
        err.response = {
          status: 429,
          headers: {
            get: (h) =>
              h === 'ratelimit-reset' ? String(Math.floor(Date.now() / 1000)) : null,
          },
        };
        throw err;
      }
      return {
        data: {
          total: 1,
          data: [{ broadcaster_login: 'retryx', broadcaster_name: 'RetryX' }],
          pagination: {},
        },
      };
    });

    const result = await twitchAPIService.getMyFollowings('7770001', 'tok', 2);
    expect(calls).toBe(2);
    expect(result.rows[0].login).toBe('retryx');
    expect(result.truncated).toBe(false);
    spy.mockRestore();
  }, 15000);
});
