const express = require('express');
const router = express.Router();
const { processQuery, getExecutiveSummary } = require('../controllers/aiController');

router.post('/query', processQuery);
router.get('/summary', getExecutiveSummary);

module.exports = router;
