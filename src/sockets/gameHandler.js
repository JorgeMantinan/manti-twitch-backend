const { getBingoRoom, drawNumber, checkLine, checkBingo } = require("../utils/bingoEngine");
const { getAhorcadoRoom, pickPhrase, drawLetter, isComplete, isLost } = require("../utils/ahorcadoEngine");

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
    socket.on("ahorcado:start", ({ index }) => {
      const streamer = socket.data?.ahorcado;
      if (!streamer) return;
      const room = getAhorcadoRoom(streamer);
      room.phrase = pickPhrase(index);
      room.drawnLetters = [];
      room.misses = 0;
      room.started = true;

      io.to(`ahorcado:${streamer}`).emit("ahorcado:started", { phrase: room.phrase });
    });

    socket.on("ahorcado:draw", () => {
      const streamer = socket.data?.ahorcado;
      if (!streamer) return;
      const room = getAhorcadoRoom(streamer);

      if (!room.started) return;

      const letter = drawLetter(room);
      if (!letter) return;

      io.to(`ahorcado:${streamer}`).emit("ahorcado:letter", {
        letter,
        misses: room.misses,
      });

      if (isComplete(room)) {
        io.to(`ahorcado:${streamer}`).emit("ahorcado:win", { phrase: room.phrase });
      } else if (isLost(room)) {
        io.to(`ahorcado:${streamer}`).emit("ahorcado:lost", { phrase: room.phrase });
      }
    });
  });
};