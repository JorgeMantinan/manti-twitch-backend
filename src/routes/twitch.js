const express = require('express');
const router = express.Router();
const twitchController = require('../controllers/twitchController');
const verifyToken = require('../middleware/verifyToken');

router.post("/subs", verifyToken, twitchController.getSubs);
router.get("/subs-history", verifyToken, twitchController.getSubsHistory);
router.get("/chatters", verifyToken, twitchController.getChatters);
router.post("/followers-between-dates", verifyToken, twitchController.getFollowers);

module.exports = router;