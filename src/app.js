const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const config = require("./config/index");

function createApp(io) {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  // Authenticated JSON APIs: no ETags — a 304 (Not Modified) response has no
  // body and breaks clients that expect JSON on every call.
  app.disable("etag");

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());

  // Never let browsers/proxies cache API responses
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests" },
  });
  app.use("/auth", authLimiter);

  if (io) {
    app.set("socketio", io);
  }

  app.use("/auth", require("./routes/auth"));
  app.use("/api/twitch", require("./routes/twitch"));
  app.use("/api/raffle", require("./routes/raffle"));
  app.use("/api/ahorcado", require("./routes/ahorcado"));

  app.get("/", (req, res) => res.send("🚀🚀🚀🚀🚀"));

  return app;
}

module.exports = createApp;