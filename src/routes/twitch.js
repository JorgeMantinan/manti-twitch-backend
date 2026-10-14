const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const twitchController = require('../controllers/twitchController');
const verifyToken = require('../middleware/verifyToken');

const avatarLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

router.post("/subs", verifyToken, twitchController.getSubs);
router.get("/subs-history", verifyToken, twitchController.getSubsHistory);
router.get("/chatters", verifyToken, twitchController.getChatters);
router.post("/followers-between-dates", verifyToken, twitchController.getFollowers);
router.get("/avatars", avatarLimiter, verifyToken, twitchController.getAvatars);

module.exports = router;