const twitchAPIService = require("../services/twitchAPI");
const { fetchAll, twitchAPI, refreshTokens } = twitchAPIService;
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

exports.getAvatars = async (req, res) => {
  const { logins } = req.query;
  if (typeof logins !== "string" || !logins) return res.status(400).json({ error: "Invalid logins" });

  const list = logins.split(",");
  if (list.length > 100 || !list.every((l) => /^[a-zA-Z0-9_]{1,25}$/.test(l))) {
    return res.status(400).json({ error: "Invalid logins" });
  }

  try {
    res.json({ avatars: await twitchAPIService.getAvatars(list) });
  } catch (e) {
    res.status(500).json({ error: "Error obteniendo avatares" });
  }
};

const followApiError = (res, e) => {
  const status = e.response?.status;
  if (status === 401) return res.status(401).json({ error: "Token expirado" });
  if (status === 403) {
    return res
      .status(403)
      .json({ error: "Falta permiso de Twitch — vuelve a iniciar sesión" });
  }
  console.error("twitch follows error:", e.message);
  return res.status(500).json({ error: "Error al consultar la API de Twitch" });
};

exports.getMyFollowings = async (req, res) => {
  const { twitchId, accessToken } = req.user;
  try {
    const followings = await twitchAPIService.getMyFollowings(twitchId, accessToken, 10);
    res.json({ followings, total: followings.length });
  } catch (e) {
    followApiError(res, e);
  }
};

exports.getMyFollowers = async (req, res) => {
  const { twitchId, accessToken } = req.user;
  try {
    const followers = await twitchAPIService.getMyFollowers(twitchId, accessToken, 30);
    res.json({ followers, total: followers.length });
  } catch (e) {
    followApiError(res, e);
  }
};

exports.unfollow = async (req, res) => {
  const { login } = req.body || {};
  if (typeof login !== "string" || !/^[a-zA-Z0-9_]{1,25}$/.test(login)) {
    return res.status(400).json({ error: "Login inválido" });
  }

  const scopesRaw = req.user.scopes;
  const scopes = Array.isArray(scopesRaw)
    ? scopesRaw
    : String(scopesRaw || "").split(" ");
  if (!scopes.includes("user:edit:follows")) {
    return res
      .status(403)
      .json({ error: "Falta el permiso user:edit:follows — vuelve a iniciar sesión" });
  }

  try {
    await twitchAPIService.unfollowUser(req.user.twitchId, login, req.user.accessToken);
    res.json({ ok: true, login: login.toLowerCase() });
  } catch (e) {
    if (e.code === "NOT_FOUND") {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    const status = e.response?.status;
    if (status === 429) {
      return res.status(429).json({ error: "Límite de Twitch alcanzado, espera unos segundos" });
    }
    if (status === 401) return res.status(401).json({ error: "Token expirado" });
    if (status === 403) {
      return res.status(403).json({ error: "Twitch rechazó la operación" });
    }
    console.error("unfollow error:", e.message);
    res.status(500).json({ error: "No se pudo dejar de seguir" });
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