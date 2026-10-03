const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true
    },
    phone: {
      type: String,
      default: ''
    },
    type: {
      type: String,
      enum: ['Regular', 'Regular (Khata)', 'VIP Regular', 'Walk-in', 'Commercial Bulk'],
      default: 'Regular'
    },
    ordersCount: {
      type: Number,
      default: 0
    },
    totalSpend: {
      type: Number,
      default: 0
    },
    khataBalance: {
      type: Number,
      default: 0
    },
    lastPurchase: {
      type: String,
      default: 'Today'
    },
    favoriteCategory: {
      type: String,
      default: 'General'
    },
    aiInsight: {
      type: String,
      default: 'Regular shopper.'
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

CustomerSchema.index({ id: 1, userEmail: 1 });

module.exports = mongoose.model('Customer', CustomerSchema);
