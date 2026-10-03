const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      default: 'Ravi Sharma'
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false
    },
    role: {
      type: String,
      enum: ['owner', 'manager', 'staff', 'viewer'],
      default: 'owner'
    },
    phone: {
      type: String,
      default: '+91 98490 23145'
    },
    storeName: {
      type: String,
      default: 'Sharma Kirana Store'
    },
    storeCategory: {
      type: String,
      default: 'Grocery & FMCG'
    },
    address: {
      type: String,
      default: 'Shop #4, Near Hanuman Temple, KPHB Phase 3, Hyderabad, Telangana - 500072'
    },
    gstin: {
      type: String,
      default: ''
    },
    upiId: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate Signed JWT
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role, email: this.email },
    process.env.JWT_SECRET || 'shopsahayak_default_fallback_secret_key',
    { expiresIn: '30d' }
  );
};

module.exports = mongoose.model('User', UserSchema);
