require('dotenv').config();

const config = {
  // Server
  PORT: process.env.PORT || '3001',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/fleetflow',

  // JWT
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'your-access-secret-key',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  JWT_DRIVER_ACCESS_EXPIRES_IN: process.env.JWT_DRIVER_ACCESS_EXPIRES_IN || '30d',
  JWT_DRIVER_REFRESH_EXPIRES_IN: process.env.JWT_DRIVER_REFRESH_EXPIRES_IN || '90d',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',

  // Firebase
  FIREBASE_SERVICE_ACCOUNT_PATH: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json',
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || '',

  // CORS
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000', // Next.js web app
    'http://localhost:8081', // React Native dev server
    'https://flotix.listandsell.de', // Production frontend
    'https://www.flotix.listandsell.de', // Production frontend (www)
  ],

  // File Upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/jpg'],

  // Expense Settings
  EXPENSE_EDIT_TIME_LIMIT: parseInt(process.env.EXPENSE_EDIT_TIME_LIMIT || '604800000'), // 7 days in ms

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || (process.env.NODE_ENV === 'development' ? '1000' : '100')),

  // Company Limits
  DEFAULT_DRIVER_LIMIT: parseInt(process.env.DEFAULT_DRIVER_LIMIT || '50'),

  // Export Settings
  EXPORT_MAX_RECORDS: parseInt(process.env.EXPORT_MAX_RECORDS || '10000'),
};

const validateConfig = () => {
  const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

module.exports = { config, validateConfig };