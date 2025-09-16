import { Request, Response, NextFunction } from 'express';
import { MongoError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

export const createError = (message: string, statusCode: number): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
  error.isOperational = true;
  return error;
};

export const errorHandler = (
  error: AppError | MongoError | MongooseError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let details: any = undefined;

  // Handle different types of errors
  if ('statusCode' in error && error.statusCode) {
    statusCode = error.statusCode;
    message = error.message;
  }
  // MongoDB duplicate key error
  else if ('code' in error && error.code === 11000) {
    statusCode = 400;
    const field = Object.keys((error as any).keyPattern || {})[0] || 'field';
    message = `Duplicate value for ${field}. Please use a different value.`;
  }
  // MongoDB validation error
  else if (error.name === 'ValidationError') {
    statusCode = 400;
    const mongooseError = error as MongooseError.ValidationError;
    const errors = Object.values(mongooseError.errors).map(err => err.message);
    message = 'Validation error';
    details = { validationErrors: errors };
  }
  // MongoDB cast error (invalid ObjectId, etc.)
  else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
  }
  // JWT errors
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }
  // Generic error with message
  else if (error.message) {
    message = error.message;
  }

  // Log error for debugging (but don't expose sensitive info in production)
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      statusCode,
    });
  } else {
    // In production, only log non-operational errors
    const isOperational = 'isOperational' in error && error.isOperational;
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

  // Send error response
  const response: any = {
    success: false,
    message,
  };

  if (details) {
    response.details = details;
  }

  // In development, include stack trace
  if (process.env.NODE_ENV !== 'production') {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
};

// Async error handler wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = createError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};