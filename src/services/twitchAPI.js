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

module.exports = { fetchAll, refreshTokens, twitchAPI, getStreamerLogin, getAvatars };