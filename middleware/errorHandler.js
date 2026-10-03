/**
 * Centralized Error Handler Middleware
 * Normalizes Mongoose errors, CastErrors, ValidationErrors, Duplicate keys
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for developers in console
  console.error('[API Error]', {
    message: err.message,
    name: err.name,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // Mongoose bad ObjectId / CastError
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = { status: 404, message };
  }

  // Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const message = `Duplicate value entered for ${field}. Please use another value.`;
    error = { status: 400, message };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    error = { status: 400, message };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = { status: 401, message: 'Invalid authentication token' };
  }
  if (err.name === 'TokenExpiredError') {
    error = { status: 401, message: 'Authentication token has expired' };
  }

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
