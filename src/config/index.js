require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET,
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    accessToken: process.env.TWITCH_ACCESS_TOKEN,
    redirectUri: process.env.TWITCH_REDIRECT_URI.trim(),
  },
  corsOrigins: [
    "https://manti-twitch.vercel.app",
    "https://jorgemantinan.github.io",
  ],
  frontendUrl: process.env.FRONTEND_URL || "https://manti-twitch.vercel.app",
};