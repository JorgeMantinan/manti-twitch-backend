const axios = require("axios");

const twitchAPI = axios.create({
  baseURL: "https://api.twitch.tv/helix",
});

async function fetchAll(endpoint, token) {
  let allData = [];
  let cursor = "";
  
  const fullUrl = endpoint.startsWith("http") 
    ? endpoint 
    : `https://api.twitch.tv/helix${endpoint}`;

  do {
    const separator = fullUrl.includes("?") ? "&" : "?";
    const urlWithCursor = `${fullUrl}${cursor ? `${separator}after=${cursor}` : ""}`;
    
    const response = await axios.get(urlWithCursor, {
      headers: { 
        Authorization: `Bearer ${token}`, 
        "Client-Id": process.env.TWITCH_CLIENT_ID 
      },
    });
    
    allData.push(...response.data.data);
    cursor = response.data.pagination?.cursor;
  } while (cursor);
  
  return allData;
}

async function refreshTokens(refreshToken) {
  const res = await axios.post("https://id.twitch.tv/oauth2/token", null, {
    params: {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
  });
  return res.data;
}

async function getStreamerLogin(token) {
    const res = await axios.get("https://api.twitch.tv/helix/users", {
        headers: { 
            Authorization: `Bearer ${token}`, 
            "Client-Id": process.env.TWITCH_CLIENT_ID 
        }
    });
    return res.data.data[0].login;
}

const AVATAR_TTL = 10 * 60 * 1000;
const LOGIN_RE = /^[a-zA-Z0-9_]{1,25}$/;
const avatarCache = new Map();

async function getAvatars(logins) {
  const valid = [];
  const seen = new Set();
  for (const raw of Array.isArray(logins) ? logins : []) {
    if (typeof raw !== "string" || !LOGIN_RE.test(raw)) continue;
    const login = raw.toLowerCase();
    if (seen.has(login)) continue;
    seen.add(login);
    valid.push(login);
    if (valid.length >= 100) break;
  }
  if (!valid.length) return {};

  if (avatarCache.size > 5000) avatarCache.clear();

  const now = Date.now();
  const missing = valid.filter((login) => {
    const cached = avatarCache.get(login);
    return !cached || now - cached.at >= AVATAR_TTL;
  });

  if (missing.length) {
    const res = await axios.get("https://api.twitch.tv/helix/users", {
      params: { login: missing },
      headers: {
        Authorization: `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`,
        "Client-Id": process.env.TWITCH_CLIENT_ID,
      },
    });
    const got = new Set(res.data.data.map((u) => u.login.toLowerCase()));
    for (const user of res.data.data) {
      avatarCache.set(user.login.toLowerCase(), { url: user.profile_image_url, at: Date.now() });
    }
    // Negative cache: unknown logins count as fresh misses for the TTL
    for (const login of missing) {
      if (!got.has(login)) avatarCache.set(login, { url: null, at: Date.now() });
    }
  }

  const result = {};
  for (const login of valid) {
    const cached = avatarCache.get(login);
    if (cached && cached.url) result[login] = cached.url;
  }
  return result;
}

const FOLLOW_LIST_TTL = 5 * 60 * 1000;
const followListCache = new Map();

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// GET with Twitch rate-limit (429) backoff: wait until Ratelimit-Reset (unix
// seconds) or a growing fallback, up to `retries` times.
async function helixGet(url, token, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Client-Id": process.env.TWITCH_CLIENT_ID,
        },
      });
    } catch (err) {
      const status = err.response?.status;
      if (status === 429 && attempt < retries) {
        const headers = err.response?.headers;
        const resetRaw =
          (typeof headers?.get === "function" && headers.get("ratelimit-reset")) ??
          headers?.["ratelimit-reset"];
        const resetAt = Number(resetRaw);
        const nowSec = Date.now() / 1000;
        const waitMs =
          Number.isFinite(resetAt) && resetAt > nowSec
            ? Math.min((resetAt - nowSec) * 1000 + 1000, 65000)
            : 2000 * (attempt + 1);
        await sleepMs(waitMs);
        continue;
      }
      throw err;
    }
  }
}

async function fetchCapped(path, token, maxPages) {
  let all = [];
  let cursor = "";
  let pages = 0;
  let total = null;
  do {
    const url = `https://api.twitch.tv/helix${path}${cursor ? `&after=${cursor}` : ""}`;
    const res = await helixGet(url, token);
    if (total === null) total = typeof res.data.total === "number" ? res.data.total : null;
    all.push(...(res.data.data || []));
    cursor = res.data.pagination?.cursor;
    pages++;
    // Small pacing so big lists don't trip the per-minute quota mid-fetch
    if (cursor && pages < maxPages) await sleepMs(150);
  } while (cursor && pages < maxPages);
  return {
    rows: all,
    total,
    truncated: total !== null && all.length < total,
  };
}

function cachedFollowList(key, loader) {
  const cached = followListCache.get(key);
  if (cached && Date.now() - cached.at < FOLLOW_LIST_TTL) return cached.rows;

  if (followListCache.size > 100) {
    for (const [k, v] of followListCache) {
      if (Date.now() - v.at >= FOLLOW_LIST_TTL) followListCache.delete(k);
    }
  }

  return loader().then((rows) => {
    followListCache.set(key, { rows, at: Date.now() });
    return rows;
  });
}

// Who the user follows (needs user:read:follows scope)
async function getMyFollowings(twitchId, token, maxPages = 50) {
  return cachedFollowList(`fol:${twitchId}`, async () => {
    const { rows, total, truncated } = await fetchCapped(
      `/channels/followed?user_id=${twitchId}&first=100`,
      token,
      maxPages,
    );
    return {
      rows: rows.map((r) => ({
        login: (r.broadcaster_login || "").toLowerCase(),
        name: r.broadcaster_name || r.broadcaster_login,
      })),
      total,
      truncated,
    };
  });
}

// Who follows the user (needs moderator:read:followers scope on own channel)
async function getMyFollowers(twitchId, token, maxPages = 100) {
  return cachedFollowList(`frs:${twitchId}`, async () => {
    const { rows, total, truncated } = await fetchCapped(
      `/channels/followers?broadcaster_id=${twitchId}&first=100`,
      token,
      maxPages,
    );
    return {
      rows: rows.map((r) => ({
        login: (r.user_login || "").toLowerCase(),
        name: r.user_name || r.user_login,
        at: r.followed_at,
      })),
      total,
      truncated,
    };
  });
}

// Unfollow a channel as the authenticated user (needs user:edit:follows scope)
async function unfollowUser(myId, targetLogin, token) {
  const login = String(targetLogin || "").toLowerCase();
  if (!LOGIN_RE.test(login)) {
    const err = new Error("invalid login");
    err.code = "INVALID_LOGIN";
    throw err;
  }

  const userRes = await axios.get("https://api.twitch.tv/helix/users", {
    params: { login },
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID,
    },
  });
  const target = userRes.data.data[0];
  if (!target) {
    const err = new Error("user not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  try {
    await axios.delete("https://api.twitch.tv/helix/channels/follow", {
      params: { broadcaster_id: target.id, user_id: myId },
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": process.env.TWITCH_CLIENT_ID,
      },
    });
  } catch (delErr) {
    // Wrap the DELETE error so the controller can inspect status/data
    const err = new Error(delErr.message);
    err.code = "UPSTREAM_DELETE";
    err.response = delErr.response;
    throw err;
  }

  return true;
}

module.exports = { fetchAll, refreshTokens, twitchAPI, getStreamerLogin, getAvatars, getMyFollowings, getMyFollowers, unfollowUser };