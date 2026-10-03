const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const User = require('../models/User');
const { recordDataInUserTable } = require('../utils/dynamicTableManager');

/**
 * @desc    Get all suppliers (filtered by user)
 * @route   GET /api/suppliers
 * @access  Public
 */
exports.getSuppliers = async (req, res, next) => {
  try {
    const userEmail = req.query.userEmail || req.headers['x-user-email'];
    const isNewUser = Boolean(userEmail && userEmail !== 'ravi' && userEmail !== 'ravi.sharma@kiranaos.in');
    const query = isNewUser ? { userEmail } : {};

    const suppliers = await Supplier.find(query).sort({ totalPurchased: -1 });
    res.status(200).json({
      success: true,
      count: suppliers.length,
      data: suppliers
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new supplier
 * @route   POST /api/suppliers
 * @access  Public
 */
exports.createSupplier = async (req, res, next) => {
  try {
    const userEmail = req.body.userEmail || req.headers['x-user-email'] || 'ravi.sharma@kiranaos.in';
    const id = req.body.id || `SUP-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const supplier = await Supplier.create({
      ...req.body,
      id,
      userEmail,
      pendingOrders: Number(req.body.pendingOrders) || 0,
      totalPurchased: Number(req.body.totalPurchased) || 0,
      status: req.body.status || 'Active'
    });

    // Record in user's dedicated dynamic collection in MongoDB Atlas
    try {
      let userPhone = req.body.userPhone;
      if (!userPhone && userEmail) {
        const userRec = await User.findOne({ email: userEmail });
        if (userRec) userPhone = userRec.phone;
      }
      if (userPhone) {
        await recordDataInUserTable(userPhone, 'suppliers', supplier.toObject ? supplier.toObject() : supplier);
      }
    } catch (e) {
      console.warn('⚠️ [SupplierController] User table sync warning:', e.message);
    }

    res.status(201).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update supplier
 * @route   PUT /api/suppliers/:id
 * @access  Public
 */
exports.updateSupplier = async (req, res, next) => {
  try {
    const userEmail = req.body.userEmail || req.headers['x-user-email'];
    const filter = { id: req.params.id };
    if (userEmail) filter.userEmail = userEmail;

    const supplier = await Supplier.findOneAndUpdate(filter, req.body, {
      new: true,
      runValidators: true
    });

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    res.status(200).json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete supplier
 * @route   DELETE /api/suppliers/:id
 * @access  Public
 */
exports.deleteSupplier = async (req, res, next) => {
  try {
    const userEmail = req.query.userEmail || req.headers['x-user-email'];
    const filter = { id: req.params.id };
    if (userEmail) filter.userEmail = userEmail;

    await Supplier.findOneAndDelete(filter);
    res.status(200).json({ success: true, message: 'Supplier deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all purchase orders
 * @route   GET /api/suppliers/purchase-orders
 * @access  Public
 */
exports.getPurchaseOrders = async (req, res, next) => {
  try {
    const userEmail = req.query.userEmail || req.headers['x-user-email'];
    const isNewUser = Boolean(userEmail && userEmail !== 'ravi' && userEmail !== 'ravi.sharma@kiranaos.in');
    const query = isNewUser ? { userEmail } : {};

    const pos = await PurchaseOrder.find(query).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: pos.length,
      data: pos
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create and confirm Purchase Order
 * @route   POST /api/suppliers/purchase-orders
 * @access  Public
 */
exports.createPurchaseOrder = async (req, res, next) => {
  try {
    const { productId, productName, quantity, unit, supplierId, supplierName, unitPrice, totalAmount, userEmail: bodyEmail } = req.body;
    const userEmail = bodyEmail || req.headers['x-user-email'] || 'ravi.sharma@kiranaos.in';

    const count = await PurchaseOrder.countDocuments({ userEmail });
    const poNumber = req.body.poNumber || `PO-${8831 + count}`;

    const po = await PurchaseOrder.create({
      poNumber,
      productId: productId || 'PROD-001',
      productName: productName || 'Bulk Inventory Item',
      quantity: Number(quantity) || 1,
      unit: unit || 'units',
      supplierId: supplierId || 'SUP-001',
      supplierName: supplierName || 'Direct Wholesale',
      unitPrice: Number(unitPrice) || 0,
      totalAmount: Number(totalAmount) || 0,
      status: 'approved',
      securityConfirmed: true,
      userEmail
    });

    // Update supplier pending orders
    const supplier = await Supplier.findOne({ name: po.supplierName, userEmail });
    if (supplier) {
      supplier.pendingOrders += 1;
      supplier.totalPurchased += po.totalAmount;
      supplier.lastOrderDate = 'Today';
      await supplier.save();
    }

    res.status(201).json({
      success: true,
      message: `Purchase Order ${po.poNumber} created and approved`,
      data: po
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update purchase order status
 * @route   PATCH /api/suppliers/purchase-orders/:id/status
 * @access  Public
 */
exports.updatePOStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const po = await PurchaseOrder.findOneAndUpdate(
      { poNumber: req.params.id },
      { status },
      { new: true }
    );

    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase Order not found' });
    }

    res.status(200).json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};
