const axios = require("axios");

const twitchAPI = axios.create({
  baseURL: "https://api.twitch.tv/helix",
});

// Helper para paginación masiva
async function fetchAll(url, token) {
  let allData = [];
  let cursor = "";
  do {
    const response = await axios.get(`${url}${cursor ? `&after=${cursor}` : ""}`, {
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

module.exports = { fetchAll, refreshTokens, twitchAPI , getStreamerLogin};