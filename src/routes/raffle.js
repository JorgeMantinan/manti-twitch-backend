const express = require('express');
const router = express.Router();
const raffleController = require('../controllers/raffleController');
const verifyToken = require('../middleware/verifyToken');

router.post('/start', verifyToken, raffleController.startRaffle);
router.post('/stop', raffleController.stopRaffle);
router.post('/pick-winner', raffleController.pickWinner);

module.exports = router;