const express = require("express");
const cors = require("cors");
const config = require("./config/index");

const app = express();

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

// ROUTES
app.use("/auth", require("./routes/auth"));
app.use("/api/twitch", require("./routes/twitch"));
app.use("/api/raffle", require("./routes/raffle"));

app.get("/", (req, res) => res.send("🚀🚀🚀🚀🚀"));

module.exports = app;