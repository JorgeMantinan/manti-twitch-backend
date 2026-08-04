const { PHRASES } = require("../utils/ahorcadoEngine");
const { refreshTokens, getStreamerLogin } = require("../services/twitchAPI");

exports.getPhrases = (req, res) => {
  res.json({ status: "success", phrases: PHRASES });
};

exports.getChannel = async (req, res) => {
  const { accessToken, refreshToken } = req.user;

  try {
    let login;
    try {
      login = await getStreamerLogin(accessToken);
    } catch (err) {
      if (err.response?.status === 401) {
        const tokens = await refreshTokens(refreshToken);
        login = await getStreamerLogin(tokens.access_token);
      } else throw err;
    }

    res.json({ status: "success", channel: login });
  } catch (error) {
    res.status(500).json({ error: "No se pudo obtener el canal." });
  }
};
