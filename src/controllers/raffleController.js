const raffleManager = require("../services/raffleManager");
const { fetchAll, refreshTokens, twitchAPI } = require("../services/twitchAPI");
const { getClient } = require("../services/tmiClient");
const config = require("../config/index");

exports.startRaffle = async (req, res) => {
  const { streamer, twitchChannel, game, keyword, subMult, giftMult, startDate, endDate } = req.body;
  const { accessToken, refreshToken, twitchId } = req.user;
  const tmi = getClient();

  try {
    let streamerToJoin = twitchChannel;
    
    if (!streamerToJoin) {
      const userRes = await twitchAPI.get("/users", {
        headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": config.twitch.clientId }
      });
      streamerToJoin = userRes.data.data[0].login;
    }

    if (!tmi.getChannels().includes(`#${streamerToJoin}`)) {
      await tmi.join(streamerToJoin);
    }

    const baseUrl = `/subscriptions?broadcaster_id=${twitchId}&first=100`;
    let allSubs;
    try {
      allSubs = await fetchAll(baseUrl, accessToken);
    } catch (err) {
      if (err.response?.status === 401) {
        const tokens = await refreshTokens(refreshToken);
        allSubs = await fetchAll(baseUrl, tokens.access_token);
      } else throw err;
    }

    const cachedSubs = new Map();
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();

    allSubs.forEach((sub) => {
      const recipient = sub.user_name.toLowerCase();
      const subDate = new Date(sub.created_at);
      if (!cachedSubs.has(recipient)) cachedSubs.set(recipient, { isSub: true, giftsSent: 0 });
      else cachedSubs.get(recipient).isSub = true;

      if (sub.is_gift && sub.gifter_name && subDate >= start && subDate <= end) {
        const gifter = sub.gifter_name.toLowerCase();
        const gifterData = cachedSubs.get(gifter) || { isSub: false, giftsSent: 0 };
        gifterData.giftsSent += 1;
        cachedSubs.set(gifter, gifterData);
      }
    });

    raffleManager.reset({
      active: true,
      selectedStreamer: streamer,
      twitchChannel: streamerToJoin,
      game: game || "roulette",
      keyword,
      subMult: parseFloat(subMult) || 1,
      giftMult: parseFloat(giftMult) || 1,
      startDate: start,
      endDate: end,
      cachedSubs
    });

    res.json({ status: "success", totalSubs: allSubs.length });
  } catch (error) {
    res.status(500).json({ error: "No se pudo iniciar el sorteo." });
  }
};

exports.stopRaffle = (req, res) => {
  const data = raffleManager.stop();
  res.json({ status: "success", totalParticipants: data.length, data });
};

exports.pickWinner = (req, res) => {
  const participants = Array.from(raffleManager.state.participants.values());
  if (participants.length === 0) return res.status(400).json({ error: "No hay participantes" });

  const totalWeight = participants.reduce((acc, p) => acc + p.points, 0);
  let random = Math.random() * totalWeight;
  let winner = null;
  for (const p of participants) {
    if (random < p.points) { winner = p; break; }
    random -= p.points;
  }

  res.json({
    status: "success",
    winner,
    stats: {
      totalParticipants: participants.length,
      totalTicketsInUrn: totalWeight,
      probability: ((winner.points / totalWeight) * 100).toFixed(2) + "%",
    }
  });
};