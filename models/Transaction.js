const mongoose = require('mongoose');

const TransactionItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String
    },
    name: {
      type: String
    },
    quantity: {
      type: Number,
      default: 1
    },
    price: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const TransactionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    time: {
      type: String,
      default: () => 'Just now'
    },
    customer: {
      type: String,
      default: 'Walk-in Customer',
      index: true
    },
    customerId: {
      type: String
    },
    itemsCount: {
      type: Number,
      default: 1
    },
    itemsSummary: {
      type: String,
      default: 'Provisions & Groceries'
    },
    items: [TransactionItemSchema],
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'UPI (Google Pay)', 'UPI (PhonePe)', 'UPI (Paytm)', 'UPI', 'Khata / Ledger'],
      default: 'Cash'
    },
    status: {
      type: String,
      enum: ['Completed', 'Pending', 'Cancelled'],
      default: 'Completed'
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

module.exports = mongoose.model('Transaction', TransactionSchema);
