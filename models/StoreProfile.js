const mongoose = require('mongoose');

const StoreProfileSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
      default: 'Sharma Kirana Store'
    },
    tagline: {
      type: String,
      default: 'Quality Provisions & Daily Groceries'
    },
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      default: 'Ravi Sharma'
    },
    phone: {
      type: String,
      default: '+91 98490 23145'
    },
    email: {
      type: String,
      default: 'ravi.sharma@kiranaos.in'
    },
    gstin: {
      type: String,
      default: '36AABCS1429B1Z8'
    },
    address: {
      type: String,
      default: 'Shop #4, Near Hanuman Temple, KPHB Phase 3, Hyderabad, Telangana - 500072'
    },
    upiId: {
      type: String,
      default: 'sharmakirana@icici'
    },
    operatingHours: {
      type: String,
      default: '07:00 AM - 10:30 PM'
    },
    currencySymbol: {
      type: String,
      default: '₹'
    },
    posStatus: {
      type: String,
      default: 'Online • Synced'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('StoreProfile', StoreProfileSchema);
