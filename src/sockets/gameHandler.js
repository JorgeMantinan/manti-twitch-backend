const { getBingoRoom, drawNumber, checkLine, checkBingo } = require("../utils/bingoEngine");

module.exports = (io) => {
  io.on("connection", (socket) => {
    
    socket.on("joinRoom", ({ game, streamer }) => {
      const room = `${game}:${streamer}`;
      socket.join(room);
      socket.data = socket.data || {};
      socket.data[game] = streamer;
      
      if (game === "bingo") getBingoRoom(streamer);
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
  });
};