const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes - verifies JWT from Authorization header
 */
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this resource. Please provide a valid token.'
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'shopsahayak_default_fallback_secret_key'
    );
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.'
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Token is invalid or expired.'
    });
  }
};

/**
 * Grant access to specific RBAC roles (e.g. 'owner', 'manager')
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // If auth is enabled and user role is not allowed
    if (req.user && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to perform this operation.`
      });
    }
    next();
  };
};

/**
 * Optional authentication - sets req.user if token present, but does not block
 */
exports.optionalAuth = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'shopsahayak_default_fallback_secret_key'
      );
      req.user = await User.findById(decoded.id);
    } catch (e) {
      // Ignore token failure for public/demo endpoints
    }
  }
  next();
};
