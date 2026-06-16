const express = require("express");
const cors = require("cors");
const config = require("./config/index");

function createApp(io) {
  const app = express();

  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());

  if (io) {
    app.set("socketio", io);
  }

  app.use("/auth", require("./routes/auth"));
  app.use("/api/twitch", require("./routes/twitch"));
  app.use("/api/raffle", require("./routes/raffle"));

  app.get("/", (req, res) => res.send("🚀🚀🚀🚀🚀"));

  return app;
}

module.exports = createApp;