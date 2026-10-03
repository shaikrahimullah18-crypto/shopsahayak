const mongoose = require('mongoose');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { recordDataInUserTable } = require('../utils/dynamicTableManager');
const { productsData } = require('../utils/seedData');

let memoryProducts = JSON.parse(JSON.stringify(productsData));

/**
 * @desc    Get all products with optional search, category, and status filter
 * @route   GET /api/products
 * @access  Public
 */
exports.getProducts = async (req, res, next) => {
  try {
    const { category, status, search, userEmail } = req.query;
    const isNewUser = Boolean(userEmail && userEmail !== 'ravi' && userEmail !== 'ravi.sharma@kiranaos.in');

    if (mongoose.connection.readyState === 1) {
      let query = {};
      if (isNewUser) {
        query.userEmail = userEmail;
      }
      if (category && category !== 'all' && category !== 'All') {
        query.category = category;
      }
      if (status && status !== 'all' && status !== 'All') {
        query.status = status;
      }
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } }
        ];
      }

      const products = await Product.find(query).sort({ stock: 1 });
      return res.status(200).json({
        success: true,
        count: products.length,
        data: products
      });
    }

    // In-memory fallback
    let filtered = [...memoryProducts];
    if (category && category !== 'all' && category !== 'All') {
      filtered = filtered.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
    if (status && status !== 'all' && status !== 'All') {
      filtered = filtered.filter((p) => p.status === status);
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s));
    }

    res.status(200).json({
      success: true,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single product by ID or custom ID (e.g. PROD-001)
 * @route   GET /api/products/:id
 * @access  Public
 */
exports.getProductById = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const product = await Product.findOne({
        $or: [{ id: req.params.id }, { sku: req.params.id }]
      });

      if (product) return res.status(200).json({ success: true, data: product });
    }

    const prod = memoryProducts.find((p) => p.id === req.params.id || p.sku === req.params.id);
    if (!prod) {
      return res.status(404).json({ success: false, message: `Product '${req.params.id}' not found` });
    }
    res.status(200).json({ success: true, data: prod });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add new product SKU
 * @route   POST /api/products
 * @access  Private (Owner/Manager)
 */
exports.createProduct = async (req, res, next) => {
  try {
    const id = req.body.id || `PROD-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const sku = req.body.sku || `SKU-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const effectiveUserEmail = req.body.userEmail || req.headers['x-user-email'] || 'ravi.sharma@kiranaos.in';

    const newItem = {
      ...req.body,
      id,
      sku,
      userEmail: effectiveUserEmail,
      stock: Number(req.body.stock) || 0,
      minStock: Number(req.body.minStock) || 10,
      purchasePrice: Number(req.body.purchasePrice) || 0,
      sellingPrice: Number(req.body.sellingPrice) || 0,
      status: Number(req.body.stock) <= Number(req.body.minStock || 10) ? 'low' : 'healthy'
    };

    if (mongoose.connection.readyState === 1) {
      const product = await Product.create(newItem);

      // Record in user's dedicated dynamic collection in MongoDB Atlas
      try {
        let userPhone = req.body.userPhone;
        if (!userPhone && effectiveUserEmail) {
          const userRec = await User.findOne({ email: effectiveUserEmail });
          if (userRec) userPhone = userRec.phone;
        }
        if (userPhone) {
          await recordDataInUserTable(userPhone, 'products', product.toObject ? product.toObject() : newItem);
        }
      } catch (e) {
        console.warn('⚠️ [ProductController] User table sync warning:', e.message);
      }

      return res.status(201).json({ success: true, data: product });
    }

    memoryProducts.unshift(newItem);
    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update product details
 * @route   PUT /api/products/:id
 * @access  Private (Owner/Manager)
 */
exports.updateProduct = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      let product = await Product.findOne({ id: req.params.id });
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      product = await Product.findOneAndUpdate({ id: req.params.id }, req.body, {
        new: true,
        runValidators: true
      });
      return res.status(200).json({ success: true, data: product });
    }

    const idx = memoryProducts.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    memoryProducts[idx] = { ...memoryProducts[idx], ...req.body };
    res.status(200).json({ success: true, data: memoryProducts[idx] });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete product
 * @route   DELETE /api/products/:id
 * @access  Private (Owner)
 */
exports.deleteProduct = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Product.findOneAndDelete({ id: req.params.id });
      return res.status(200).json({ success: true, message: 'Product deleted' });
    }
    memoryProducts = memoryProducts.filter((p) => p.id !== req.params.id);
    res.status(200).json({ success: true, message: 'Product deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Restock product quantity and log Purchase Order / Supplier entry
 * @route   POST /api/products/:id/restock
 * @access  Public
 */
exports.restockProduct = async (req, res, next) => {
  try {
    const { quantity, supplierName } = req.body;
    const userEmail = req.body.userEmail || req.headers['x-user-email'];
    const addQty = Number(quantity);

    if (!addQty || addQty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid restocking quantity greater than 0'
      });
    }

    if (mongoose.connection.readyState === 1) {
      const prodQuery = { id: req.params.id };
      if (userEmail) prodQuery.userEmail = userEmail;
      let product = await Product.findOne(prodQuery);
      if (!product) {
        product = await Product.findOne({ id: req.params.id });
      }
      if (product) {
        const previousStock = product.stock;
        product.stock += addQty;
        await product.save();

        const effectiveUserEmail = product.userEmail || userEmail || 'ravi.sharma@kiranaos.in';
        const supplierToUse = supplierName || product.supplierName;
        const supplier = await Supplier.findOne({ name: supplierToUse, userEmail: effectiveUserEmail }) || await Supplier.findOne({ name: supplierToUse });
        const totalCost = product.purchasePrice * addQty;

        if (supplier) {
          supplier.pendingOrders += 1;
          supplier.totalPurchased += totalCost;
          await supplier.save();
        }

        const po = await PurchaseOrder.create({
          poNumber: `PO-${8830 + Math.floor(Math.random() * 900)}`,
          productId: product.id,
          productName: product.name,
          quantity: addQty,
          unit: product.unit,
          supplierId: product.supplierId,
          supplierName: supplierToUse,
          unitPrice: product.purchasePrice,
          totalAmount: totalCost,
          status: 'approved',
          userEmail: effectiveUserEmail
        });

        return res.status(200).json({
          success: true,
          message: `Successfully restocked ${product.name}`,
          data: { product, previousStock, newStock: product.stock, purchaseOrder: po }
        });
      }
    }

    // Memory fallback
    const memProd = memoryProducts.find((p) => p.id === req.params.id);
    if (!memProd) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const previousStock = memProd.stock;
    memProd.stock += addQty;
    memProd.status = memProd.stock <= memProd.minStock ? 'low' : 'healthy';

    res.status(200).json({
      success: true,
      message: `Successfully restocked ${memProd.name}`,
      data: {
        product: memProd,
        previousStock,
        newStock: memProd.stock,
        purchaseOrder: {
          poNumber: 'PO-8831',
          productName: memProd.name,
          quantity: addQty,
          totalAmount: memProd.purchasePrice * addQty
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all products below safety stock
 * @route   GET /api/products/low-stock
 * @access  Public
 */
exports.getLowStockProducts = async (req, res, next) => {
  try {
    const userEmail = req.query.userEmail || req.headers['x-user-email'];
    const isNewUser = Boolean(userEmail && userEmail !== 'ravi' && userEmail !== 'ravi.sharma@kiranaos.in');

    if (mongoose.connection.readyState === 1) {
      const query = { $expr: { $lte: ['$stock', '$minStock'] } };
      if (isNewUser) query.userEmail = userEmail;

      const lowStock = await Product.find(query).sort({ stock: 1 });
      return res.status(200).json({ success: true, count: lowStock.length, data: lowStock });
    }

    const lowStock = memoryProducts.filter((p) => p.stock <= p.minStock);
    res.status(200).json({ success: true, count: lowStock.length, data: lowStock });
  } catch (error) {
    next(error);
  }
};
