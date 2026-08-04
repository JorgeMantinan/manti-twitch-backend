const express = require('express');
const router = express.Router();
const ahorcadoController = require('../controllers/ahorcadoController');
const verifyToken = require('../middleware/verifyToken');

router.get('/phrases', verifyToken, ahorcadoController.getPhrases);
router.get('/channel', verifyToken, ahorcadoController.getChannel);

module.exports = router;
