const express = require('express');
const router = express.Router();
const {
  getStoreProfile,
  updateStoreProfile,
  getDashboardKPIs,
  dbInspect
} = require('../controllers/storeController');

router.get('/profile', getStoreProfile);
router.put('/profile', updateStoreProfile);
router.get('/metrics', getDashboardKPIs);
router.get('/db-inspect', dbInspect);

module.exports = router;
