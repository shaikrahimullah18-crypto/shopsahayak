const mongoose = require('mongoose');
const StoreProfile = require('../models/StoreProfile');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const { storeProfileData, productsData, transactionsData, customersData } = require('../utils/seedData');

/**
 * @desc    Get store profile
 * @route   GET /api/store/profile
 * @access  Public
 */
exports.getStoreProfile = async (req, res, next) => {
  try {
    const userEmail = req.query.userEmail || req.headers['x-user-email'];

    if (mongoose.connection.readyState === 1) {
      const query = userEmail ? { email: userEmail } : {};
      let profile = await StoreProfile.findOne(query);
      if (profile) return res.status(200).json({ success: true, data: profile });
    }
    res.status(200).json({ success: true, data: storeProfileData });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update store profile
 * @route   PUT /api/store/profile
 * @access  Private (Owner/Manager)
 */
exports.updateStoreProfile = async (req, res, next) => {
  try {
    const userEmail = req.body.email || req.query.userEmail || req.headers['x-user-email'];

    if (mongoose.connection.readyState === 1) {
      const query = userEmail ? { email: userEmail } : {};
      let profile = await StoreProfile.findOne(query);
      if (!profile) {
        profile = await StoreProfile.create(req.body);
      } else {
        profile = await StoreProfile.findByIdAndUpdate(profile._id, req.body, {
          new: true,
          runValidators: true
        });
      }
      return res.status(200).json({ success: true, data: profile });
    }
    res.status(200).json({ success: true, data: { ...storeProfileData, ...req.body } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get live calculated Dashboard KPIs and Metrics
 * @route   GET /api/store/metrics
 * @access  Public
 */
exports.getDashboardKPIs = async (req, res, next) => {
  try {
    const userEmail = req.query.userEmail || req.headers['x-user-email'];
    const isNewUser = Boolean(userEmail && userEmail !== 'ravi' && userEmail !== 'ravi.sharma@kiranaos.in');

    let products = [];
    let transactions = [];
    let customerCount = 0;

    if (mongoose.connection.readyState === 1) {
      try {
        const query = isNewUser ? { userEmail } : {};
        products = await Product.find(query);
        transactions = await Transaction.find(query);
        customerCount = await Customer.countDocuments(query);
      } catch (e) {
        // Fall back to seed data if demo
        if (!isNewUser) {
          products = productsData;
          transactions = transactionsData;
          customerCount = customersData.length;
        }
      }
    } else {
      if (!isNewUser) {
        products = productsData;
        transactions = transactionsData;
        customerCount = customersData.length;
      }
    }

    let lowStockCount = 0;
    let healthyStockCount = 0;
    let outOfStockCount = 0;

    products.forEach((p) => {
      if (p.stock === 0) outOfStockCount++;
      else if (p.stock <= p.minStock) lowStockCount++;
      else healthyStockCount++;
    });

    const todayRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const todayOrders = transactions.length;
    const estimatedProfit = Math.round(todayRevenue * 0.22);

    res.status(200).json({
      success: true,
      data: {
        todayRevenue,
        todayOrders,
        estimatedProfit,
        activeCustomers: customerCount,
        lowStockCount,
        healthyStockCount,
        outOfStockCount,
        totalProducts: products.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Inspect live MongoDB Atlas collections & documents directly
 * @route   GET /api/store/db-inspect
 * @access  Public
 */
exports.dbInspect = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const result = {};
    for (const c of collections) {
      const count = await db.collection(c.name).countDocuments();
      const items = await db.collection(c.name).find({}, { projection: { password: 0 } }).limit(20).toArray();
      result[c.name] = { count, items };
    }

    res.status(200).json({
      success: true,
      status: 'Connected to MongoDB Atlas',
      clusterHost: mongoose.connection.host,
      databaseName: mongoose.connection.name,
      totalCollections: collections.length,
      collections: result
    });
  } catch (error) {
    next(error);
  }
};
