const { config } = require('../config');

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
  error.isOperational = true;
  return error;
};

const errorHandler = (error, req, res, next) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let details = undefined;

  if (error.statusCode) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.code === 11000) {
    statusCode = 400;
    const field = Object.keys(error.keyPattern || {})[0] || 'field';
    message = `Duplicate value for ${field}. Please use a different value.`;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(error.errors).map(err => err.message);
    message = 'Validation error';
    details = { validationErrors: errors };
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (error.message) {
    message = error.message;
  }

  if (config.NODE_ENV !== 'production') {
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      statusCode,
    });
  } else {
    const isOperational = error.isOperational;
    if (!isOperational) {
      console.error('Unexpected error:', {
        name: error.name,
        message: error.message,
        url: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
      });
    }
  }

  const response = {
    success: false,
    message,
  };

  if (details) {
    response.details = details;
  }

  if (config.NODE_ENV !== 'production') {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = { createError, errorHandler, asyncHandler };