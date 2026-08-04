const { PHRASES } = require("../utils/ahorcadoEngine");

exports.getPhrases = (req, res) => {
  res.json({ status: "success", phrases: PHRASES });
};
