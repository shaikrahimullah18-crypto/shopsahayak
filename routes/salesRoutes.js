const express = require('express');
const router = express.Router();
const {
  getTransactions,
  createSale,
  getSalesReport
} = require('../controllers/salesController');

router.get('/', getTransactions);
router.post('/', createSale);
router.get('/report', getSalesReport);

module.exports = router;
