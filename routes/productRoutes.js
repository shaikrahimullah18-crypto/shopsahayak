const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  restockProduct,
  getLowStockProducts
} = require('../controllers/productController');

router.get('/', getProducts);
router.get('/low-stock', getLowStockProducts);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.post('/:id/restock', restockProduct);

module.exports = router;
