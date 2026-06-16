require('dotenv').config();
const http = require('http');
const { Server } = require("socket.io");
const config = require("./config/index");
const createApp = require('./app');

const io = new Server({
  cors: {
    origin: config.corsOrigins,
    methods: ["GET", "POST"]
  }
});

const app = createApp(io);
const server = http.createServer(app);
io.attach(server);

const { initTmi } = require('./services/tmiClient');
initTmi(io);

const setupBingoSockets = require('./sockets/gameHandler');
setupBingoSockets(io);

const PORT = config.port || 3000;
server.listen(PORT, () => console.log(`Backend Pro en puerto ${PORT}`));