const mongoose = require('mongoose');

const PurchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: true,
      index: true
    },
    productId: {
      type: String,
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unit: {
      type: String,
      default: 'units'
    },
    supplierId: {
      type: String,
      required: true
    },
    supplierName: {
      type: String,
      required: true
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'dispatched', 'delivered', 'cancelled'],
      default: 'approved'
    },
    approvedBy: {
      type: String,
      default: 'Store Owner'
    },
    securityConfirmed: {
      type: Boolean,
      default: true
    },
    notes: {
      type: String,
      default: 'Generated via ShopSahayak AI Agentic Order Engine'
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

PurchaseOrderSchema.index({ poNumber: 1, userEmail: 1 });

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
