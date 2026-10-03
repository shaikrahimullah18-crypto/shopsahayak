const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Customer = require('../models/Customer');

/**
 * @desc    Get all transactions / POS sales (filtered by user)
 * @route   GET /api/sales
 * @access  Public
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const userEmail = req.query.userEmail || req.headers['x-user-email'];
    const isNewUser = Boolean(userEmail && userEmail !== 'ravi' && userEmail !== 'ravi.sharma@kiranaos.in');
    const query = isNewUser ? { userEmail } : {};

    const transactions = await Transaction.find(query).sort({ createdAt: -1 }).limit(limit);

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Process new POS sale / billing
 * @route   POST /api/sales
 * @access  Public
 */
exports.createSale = async (req, res, next) => {
  try {
    const { customer, customerId, items, itemsSummary, amount, paymentMethod, userEmail: bodyEmail } = req.body;
    const effectiveUserEmail = bodyEmail || req.headers['x-user-email'] || 'ravi.sharma@kiranaos.in';

    const saleAmount = Number(amount);
    if (!saleAmount || saleAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Sale amount must be greater than 0'
      });
    }

    const orderId = req.body.id || `ORD-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    // 1. If line items are provided, decrement stock for each
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (item.productId && item.quantity) {
          const product = await Product.findOne({
            $or: [
              { id: item.productId, userEmail: effectiveUserEmail },
              { id: item.productId }
            ]
          });
          if (product) {
            product.stock = Math.max(0, product.stock - Number(item.quantity));
            await product.save();
          }
        }
      }
    }

    // 2. If payment is via Khata, update customer Khata ledger balance
    if (paymentMethod && paymentMethod.includes('Khata')) {
      const custQuery = customerId
        ? { id: customerId, userEmail: effectiveUserEmail }
        : { name: customer, userEmail: effectiveUserEmail };
      let cust = await Customer.findOne(custQuery);
      if (!cust && customerId) {
        cust = await Customer.findOne({ id: customerId });
      }
      if (cust) {
        cust.khataBalance += saleAmount;
        cust.totalSpend += saleAmount;
        cust.ordersCount += 1;
        cust.lastPurchase = 'Just now';
        await cust.save();
      }
    }

    // 3. Record transaction
    const transaction = await Transaction.create({
      id: orderId,
      time: 'Just now',
      customer: customer || 'Walk-in Customer',
      customerId,
      itemsCount: items ? items.length : (req.body.itemsCount || 1),
      itemsSummary: itemsSummary || 'Groceries & Daily Essentials',
      items: items || [],
      amount: saleAmount,
      paymentMethod: paymentMethod || 'Cash',
      status: 'Completed',
      userEmail: effectiveUserEmail
    });

    res.status(201).json({
      success: true,
      message: 'Sale transaction processed successfully',
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get sales analytics & payment mode breakdown (filtered by user)
 * @route   GET /api/sales/report
 * @access  Public
 */
exports.getSalesReport = async (req, res, next) => {
  try {
    const userEmail = req.query.userEmail || req.headers['x-user-email'];
    const isNewUser = Boolean(userEmail && userEmail !== 'ravi' && userEmail !== 'ravi.sharma@kiranaos.in');
    const query = isNewUser ? { userEmail } : {};

    const transactions = await Transaction.find(query);

    const paymentBreakdown = {
      upi: 0,
      cash: 0,
      khata: 0
    };

    let totalRevenue = 0;

    transactions.forEach((tx) => {
      const amt = tx.amount || 0;
      totalRevenue += amt;
      const method = (tx.paymentMethod || '').toLowerCase();

      if (method.includes('upi') || method.includes('gpay') || method.includes('phonepe') || method.includes('paytm')) {
        paymentBreakdown.upi += amt;
      } else if (method.includes('khata') || method.includes('ledger')) {
        paymentBreakdown.khata += amt;
      } else {
        paymentBreakdown.cash += amt;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalOrders: transactions.length,
        averageOrderValue: transactions.length ? Math.round(totalRevenue / transactions.length) : 0,
        paymentBreakdown,
        peakHours: transactions.length > 0 ? '06:00 PM - 08:30 PM' : 'No sales yet'
      }
    });
  } catch (error) {
    next(error);
  }
};
