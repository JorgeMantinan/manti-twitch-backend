const { fetchAll, twitchAPI, refreshTokens } = require("../services/twitchAPI");
const config = require("../config/index");

let subsCache = { data: null, timestamp: 0 };

exports.getSubs = async (req, res) => {
  try {
    const { accessToken, refreshToken, twitchId } = req.user;

    if (subsCache.data && Date.now() - subsCache.timestamp < 60000) {
      return res.json(subsCache.data);
    }

    const baseUrl = `/subscriptions?broadcaster_id=${twitchId}&first=100`;
    let allSubs;

    try {
      allSubs = await fetchAll(baseUrl, accessToken);
    } catch (err) {
      if (err.response?.status === 401) {
        const newTokens = await refreshTokens(refreshToken);
        allSubs = await fetchAll(baseUrl, newTokens.access_token);
      } else throw err;
    }

    const formattedSubs = allSubs.map((sub) => ({
      user_name: sub.user_name,
      tier: sub.tier,
      is_gift: sub.is_gift,
      gifter_name: sub.gifter_name || null,
    }));

    const responseData = { totalSubs: formattedSubs.length, subscribers: formattedSubs };
    subsCache = { data: responseData, timestamp: Date.now() };

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo subs" });
  }
};

exports.getSubsHistory = async (req, res) => {
  const { startDate, endDate, subType } = req.query;
  const { accessToken, twitchId } = req.user;

  try {
    const url = `/subscriptions?broadcaster_id=${twitchId}&first=100`;
    const allSubs = await fetchAll(url, accessToken);

    const start = new Date(startDate);
    const end = new Date(endDate);

    let filtered = allSubs.filter((s) => {
      const subDate = new Date(s.created_at);
      return subDate >= start && subDate <= end;
    });

    if (subType === "only_gifters") {
      const giftersMap = new Map();
      filtered.filter((s) => s.is_gift).forEach((s) => {
        const count = giftersMap.get(s.gifter_name) || 0;
        giftersMap.set(s.gifter_name, count + 1);
      });
      return res.json(Object.fromEntries(giftersMap));
    }

    if (subType === "non_gifted") filtered = filtered.filter((s) => !s.is_gift);
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: "Error processing sub data" });
  }
};

exports.getChatters = async (req, res) => {
  try {
    const { accessToken, twitchId } = req.user;
    const response = await twitchAPI.get("/chat/chatters", {
      params: { broadcaster_id: twitchId, moderator_id: twitchId },
      headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": config.twitch.clientId }
    });
    res.json({ chatters: response.data.data.map(u => u.user_login) });
  } catch (e) {
    res.status(500).json({ error: "No se pudo obtener la lista de chatters" });
  }
};

exports.getFollowers = async (req, res) => {
    const { startDate, endDate, streamerNick } = req.body;
    const { accessToken } = req.user;
    try {
        const userRes = await twitchAPI.get(`/users?login=${streamerNick}`, {
            headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": config.twitch.clientId }
        });
        const targetId = userRes.data.data[0]?.id;
        if (!targetId) return res.status(404).json({ error: "Streamer no encontrado" });

        const url = `/channels/followers?broadcaster_id=${targetId}&first=100`;
        const allFollowers = await fetchAll(url, accessToken);

        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();

        const filtered = allFollowers.filter(f => {
            const d = new Date(f.followed_at);
            return d >= start && d <= end;
        });
        res.json(filtered);
    } catch (e) {
        res.status(500).json({ error: "Error al consultar la API de Twitch" });
    }
};