const Customer = require('../models/Customer');

/**
 * @desc    Get all customers (filtered by user)
 * @route   GET /api/customers
 * @access  Public
 */
exports.getCustomers = async (req, res, next) => {
  try {
    const userEmail = req.query.userEmail || req.headers['x-user-email'];
    const isNewUser = Boolean(userEmail && userEmail !== 'ravi' && userEmail !== 'ravi.sharma@kiranaos.in');
    const query = isNewUser ? { userEmail } : {};

    const customers = await Customer.find(query).sort({ khataBalance: -1 });
    res.status(200).json({
      success: true,
      count: customers.length,
      data: customers
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get customer by ID
 * @route   GET /api/customers/:id
 * @access  Public
 */
exports.getCustomerById = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ id: req.params.id });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.status(200).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new customer
 * @route   POST /api/customers
 * @access  Public
 */
exports.createCustomer = async (req, res, next) => {
  try {
    const userEmail = req.body.userEmail || req.headers['x-user-email'] || 'ravi.sharma@kiranaos.in';
    const id = req.body.id || `CUST-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const customer = await Customer.create({
      ...req.body,
      id,
      userEmail,
      ordersCount: Number(req.body.ordersCount) || 0,
      totalSpend: Number(req.body.totalSpend) || 0,
      khataBalance: Number(req.body.khataBalance) || 0
    });

    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update customer
 * @route   PUT /api/customers/:id
 * @access  Public
 */
exports.updateCustomer = async (req, res, next) => {
  try {
    const userEmail = req.body.userEmail || req.headers['x-user-email'];
    const filter = { id: req.params.id };
    if (userEmail) filter.userEmail = userEmail;

    const customer = await Customer.findOneAndUpdate(filter, req.body, {
      new: true,
      runValidators: true
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.status(200).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete customer
 * @route   DELETE /api/customers/:id
 * @access  Public
 */
exports.deleteCustomer = async (req, res, next) => {
  try {
    const userEmail = req.query.userEmail || req.headers['x-user-email'];
    const filter = { id: req.params.id };
    if (userEmail) filter.userEmail = userEmail;

    await Customer.findOneAndDelete(filter);
    res.status(200).json({ success: true, message: 'Customer deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update customer Khata balance (Payment received or new credit)
 * @route   PATCH /api/customers/:id/khata
 * @access  Public
 */
exports.updateKhataBalance = async (req, res, next) => {
  try {
    const { amount, action, storeName, upiId } = req.body;
    const val = Number(amount);

    const customer = await Customer.findOne({ id: req.params.id });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    if (action === 'payment') {
      customer.khataBalance = Math.max(0, customer.khataBalance - val);
    } else {
      customer.khataBalance += val;
    }

    await customer.save();

    const storeLabel = storeName || 'Kirana Store';
    const upiInfo = upiId ? ` You can pay via UPI to ${upiId}.` : '';

    const whatsappMessage = encodeURIComponent(
      `Namaste ${customer.name}, this is a gentle reminder from ${storeLabel}. Your current Khata ledger balance is ₹${customer.khataBalance}.${upiInfo} Thank you!`
    );

    res.status(200).json({
      success: true,
      message: `Khata updated for ${customer.name}`,
      data: {
        customer,
        whatsappReminderUrl: `https://wa.me/${(customer.phone || '').replace(/[^0-9]/g, '')}?text=${whatsappMessage}`
      }
    });
  } catch (error) {
    next(error);
  }
};
