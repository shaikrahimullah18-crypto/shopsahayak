const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    recipientPhone: {
      type: String,
      required: [true, 'Recipient phone number is required'],
      trim: true,
      index: true
    },
    recipientName: {
      type: String,
      required: true,
      trim: true
    },
    storeName: {
      type: String,
      default: ''
    },
    userEmail: {
      type: String,
      default: '',
      index: true
    },
    type: {
      type: String,
      enum: ['WELCOME_SMS', 'KHATA_REMINDER', 'ORDER_NOTIFICATION', 'OTP', 'PROMOTIONAL'],
      default: 'WELCOME_SMS'
    },
    channel: {
      type: String,
      enum: ['SMS', 'WhatsApp', 'Multi-Channel'],
      default: 'Multi-Channel'
    },
    content: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['SENT', 'DELIVERED', 'SIMULATED', 'FAILED'],
      default: 'SENT'
    },
    gateway: {
      type: String,
      default: 'ShopSahayak SMS Dispatcher'
    },
    whatsappUrl: {
      type: String,
      default: ''
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Message', MessageSchema);
