const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true
    },
    category: {
      type: String,
      default: 'General Wholesale'
    },
    contactPerson: {
      type: String,
      default: ''
    },
    phone: {
      type: String,
      default: ''
    },
    email: {
      type: String,
      default: ''
    },
    pendingOrders: {
      type: Number,
      default: 0
    },
    totalPurchased: {
      type: Number,
      default: 0
    },
    lastOrderDate: {
      type: String,
      default: 'Recently'
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    },
    userEmail: {
      type: String,
      default: 'ravi.sharma@kiranaos.in',
      index: true
    }
  },
  {
    timestamps: true
  }
);

SupplierSchema.index({ id: 1, userEmail: 1 });

module.exports = mongoose.model('Supplier', SupplierSchema);
