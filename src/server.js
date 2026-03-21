// src/server.js
require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.corsOrigins,
    methods: ["GET", "POST"]
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

app.set("socketio", io);

// Init tmi to connect with twitchbot
const { initTmi } = require('./services/tmiClient');
initTmi(io);

// ROUTES
app.use('/auth', require('./routes/auth'));
app.use('/api/raffle', require('./routes/raffle'));
app.use('/api/twitch', require('./routes/twitch'));

// Socket logics bingo game
const setupBingoSockets = require('./sockets/gameHandler');
setupBingoSockets(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Backend Pro en puerto ${PORT}`));