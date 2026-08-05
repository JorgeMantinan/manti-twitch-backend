const jwt = require("jsonwebtoken");
const { getBingoRoom, drawNumber, checkLine, checkBingo } = require("../utils/bingoEngine");
const { getAhorcadoRoom, pickPhrase, drawLetter, isComplete, setActiveGame, clearActiveGame } = require("../utils/ahorcadoEngine");
const { getClient } = require("../services/tmiClient");
const { getStreamerLogin, refreshTokens } = require("../services/twitchAPI");

const resolveChannelFromToken = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.login) return decoded.login;
  try {
    return await getStreamerLogin(decoded.twitchToken);
  } catch (err) {
    if (err.response?.status === 401) {
      const tokens = await refreshTokens(decoded.refreshToken);
      return await getStreamerLogin(tokens.access_token);
    }
    throw err;
  }
};

module.exports = (io) => {
  io.on("connection", (socket) => {
    
    socket.on("joinRoom", ({ game, streamer }) => {
      const room = `${game}:${streamer}`;
      socket.join(room);
      socket.data = socket.data || {};
      socket.data[game] = streamer;
      
      if (game === "bingo") getBingoRoom(streamer);
      if (game === "ahorcado") getAhorcadoRoom(streamer);
    });

    // Bingo game
    socket.on("bingo:start", ({ cards }) => {
      const streamer = socket.data?.bingo;
      if (!streamer) return;
      const room = getBingoRoom(streamer);
      room.cards = cards;
      room.drawn = [];
      room.started = true;
      room.lineWinner = null;
      room.bingoWinner = null;
    });

    socket.on("bingo:draw", () => {
      const streamer = socket.data?.bingo;
      if (!streamer) return;
      const room = getBingoRoom(streamer);

      if (!room.started) return;

      const n = drawNumber(room);
      if (!n) return;

      io.to(`bingo:${streamer}`).emit("bingo:number", n);

      for (const player in room.cards) {
        const card = room.cards[player];

        if (!room.lineWinner && checkLine(card, room.drawn)) {
          room.lineWinner = player;
          io.to(`bingo:${streamer}`).emit("bingo:line", player);
        }

        if (!room.bingoWinner && checkBingo(card, room.drawn)) {
          room.bingoWinner = player;
          io.to(`bingo:${streamer}`).emit("bingo:bingo", player);
        }
      }
    });

    // Ships game
    socket.on("ships:action", (data) => {
        const streamer = socket.data?.ships;
        if (streamer) io.to(`ships:${streamer}`).emit("ships:update", data);
    });

    // Ahorcado game
    socket.on("ahorcado:start", async ({ streamer, twitchChannel, subsOnly, token }) => {
      const activeStreamer = socket.data?.ahorcado;
      if (!activeStreamer) return;

      let channel = twitchChannel;
      if (!channel && token) {
        try {
          channel = await resolveChannelFromToken(token);
        } catch (err) {
          console.error("Ahorcado: no se pudo resolver el canal:", err.message);
        }
      }

      const room = getAhorcadoRoom(activeStreamer);
      room.phrase = pickPhrase();
      room.drawnLetters = [];
      room.misses = 0;
      room.started = true;
      room.guessed = false;
      room.players = {};
      room.subsOnly = !!subsOnly;
      room.twitchChannel = channel || null;

      if (channel) {
        const tmi = getClient();
        if (tmi && !tmi.getChannels().includes(`#${channel.toLowerCase()}`)) {
          tmi.join(channel).catch(() => {});
        }
        setActiveGame(activeStreamer, channel, room.phrase, room.subsOnly);
      }

      io.to(`ahorcado:${activeStreamer}`).emit("ahorcado:started", { phrase: room.phrase });
    });

    socket.on("ahorcado:draw", () => {
      const streamer = socket.data?.ahorcado;
      if (!streamer) return;
      const room = getAhorcadoRoom(streamer);

      if (!room.started || room.guessed) return;

      const letter = drawLetter(room);
      if (!letter) return;

      io.to(`ahorcado:${streamer}`).emit("ahorcado:letter", {
        letter,
        misses: room.misses,
      });

      if (isComplete(room)) {
        clearActiveGame(room.twitchChannel);
        io.to(`ahorcado:${streamer}`).emit("ahorcado:win", { phrase: room.phrase });
      }
    });
  });
};