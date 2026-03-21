const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      accessToken: decoded.twitchToken,
      refreshToken: decoded.refreshToken,
      twitchId: decoded.twitchId,
      scopes: decoded.scopes,
    };
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};