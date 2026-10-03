const User = require('../models/User');
const StoreProfile = require('../models/StoreProfile');
const { createUserTable } = require('../utils/dynamicTableManager');
const { sendRegistrationSMS } = require('../utils/smsService');

/**
 * @desc    Register a new store user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      storeName,
      storeCategory,
      address,
      gstin,
      upiId
    } = req.body;

    if (!name || !email || !password || !storeName) {
      return res.status(400).json({
        success: false,
        message: 'Owner name, store name, email and password are required'
      });
    }

    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A store account is already registered with this email address'
      });
    }

    const userPhone = phone || '+91 98490 23145';

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'owner',
      phone: userPhone,
      storeName,
      storeCategory: storeCategory || 'Grocery & FMCG',
      address: address || '',
      gstin: gstin || '',
      upiId: upiId || ''
    });

    // Create or update store profile for this user
    let storeProfile = await StoreProfile.findOne({ email });
    if (!storeProfile) {
      storeProfile = await StoreProfile.create({
        storeName: user.storeName,
        tagline: `${user.storeCategory || 'Quality Provisions'} & Daily Essentials`,
        ownerName: user.name,
        phone: user.phone,
        email: user.email,
        gstin: user.gstin || '',
        address: user.address || '',
        upiId: user.upiId || ''
      });
    }

    // 1. DYNAMIC TABLE CREATION IN MONGODB ATLAS:
    // Create dedicated collection/table for this user named after their mobile & name
    let userTableMeta = null;
    try {
      userTableMeta = await createUserTable(user);
    } catch (tblErr) {
      console.warn('⚠️ [Register] Dynamic table creation warning:', tblErr.message);
    }

    // 2. MOBILE MESSAGE DISPATCH:
    // Send welcome SMS / WhatsApp notification to the user's mobile number & log to MongoDB Atlas
    let smsResult = null;
    try {
      smsResult = await sendRegistrationSMS({
        phone: user.phone,
        name: user.name,
        storeName: user.storeName,
        email: user.email
      });
    } catch (smsErr) {
      console.warn('⚠️ [Register] SMS dispatch warning:', smsErr.message);
    }

    const token = user.getSignedJwtToken();

    res.status(201).json({
      success: true,
      message: `Store registered successfully! Welcome message dispatched to mobile ${user.phone}.`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeName: user.storeName,
        storeCategory: user.storeCategory,
        phone: user.phone,
        address: user.address,
        gstin: user.gstin,
        upiId: user.upiId
      },
      storeProfile,
      tableCreated: userTableMeta ? userTableMeta.tableName : null,
      sms: smsResult ? {
        status: smsResult.status,
        phone: smsResult.recipientPhone,
        messageId: smsResult.messageId,
        content: smsResult.content,
        whatsappUrl: smsResult.whatsappUrl
      } : null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user & get JWT token
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = user.getSignedJwtToken();
    const storeProfile = await StoreProfile.findOne({ email });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeName: user.storeName,
        storeCategory: user.storeCategory,
        phone: user.phone,
        address: user.address,
        gstin: user.gstin,
        upiId: user.upiId
      },
      storeProfile: storeProfile || null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};
