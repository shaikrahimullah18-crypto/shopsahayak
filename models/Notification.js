const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    category: {
      type: String,
      enum: ['Inventory', 'AI Insights', 'Sales', 'Orders', 'Security'],
      default: 'Inventory'
    },
    severity: {
      type: String,
      enum: ['urgent', 'warning', 'info', 'success'],
      default: 'info'
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    time: {
      type: String,
      default: 'Just now'
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    action: {
      type: String,
      default: null
    },
    target: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Notification', NotificationSchema);
