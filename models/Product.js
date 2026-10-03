const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    sku: {
      type: String,
      required: [true, 'SKU code is required'],
      trim: true,
      index: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      default: 'General Groceries',
      index: true
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: 0
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: 0
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    minStock: {
      type: Number,
      required: true,
      default: 10,
      min: 0
    },
    unit: {
      type: String,
      default: 'units'
    },
    supplierId: {
      type: String,
      default: 'SUP-001'
    },
    supplierName: {
      type: String,
      default: 'Direct Wholesale'
    },
    velocityDaily: {
      type: Number,
      default: 1.0
    },
    status: {
      type: String,
      enum: ['healthy', 'low', 'out'],
      default: 'healthy',
      index: true
    },
    trend: {
      type: String,
      default: 'Stable'
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

ProductSchema.index({ id: 1, userEmail: 1 });
ProductSchema.index({ sku: 1, userEmail: 1 });

// Auto-evaluate stock status before saving
ProductSchema.pre('save', function (next) {
  if (this.stock === 0) {
    this.status = 'out';
  } else if (this.stock <= this.minStock) {
    this.status = 'low';
  } else {
    this.status = 'healthy';
  }
  next();
});

module.exports = mongoose.model('Product', ProductSchema);
