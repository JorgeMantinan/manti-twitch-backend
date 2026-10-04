require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not set");
  process.exit(1);
}

const http = require('http');
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const config = require("./config/index");
const createApp = require('./app');

const io = new Server({
  cors: {
    origin: config.corsOrigins,
    methods: ["GET", "POST"]
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
      socket.data.user = {
        login: decoded.login,
        twitchId: decoded.twitchId,
        scopes: decoded.scopes
      };
    } catch (err) {
      // invalid/expired token: stay anonymous (read-only rooms)
    }
  }
  next();
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