const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const multer = require('multer');

// Import configuration and database connection
const { config, validateConfig } = require('./src/config');
const { connectDB } = require('./src/config/database');

// Import middleware
const { errorHandler } = require('./src/middleware');

// Import routes
const {
  authRoutes,
  userRoutes,
  companyRoutes,
  vehicleRoutes,
  expenseRoutes,
  reportRoutes,
  auditRoutes,
  roleRoutes,
} = require('./src/routes');

const app = express();

// Validate configuration on startup
try {
  validateConfig();
} catch (error) {
  console.error('Configuration validation failed:', error);
  process.exit(1);
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.ALLOWED_ORIGINS,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000)
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks and in test environment
    return req.path === '/health' || config.NODE_ENV === 'test';
  }
});
app.use('/api', limiter);

// Compression and parsing middleware
app.use(compression());
app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configure multer for file uploads (ready for future use)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (config.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG images are allowed.'));
    }
  },
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database debug endpoint (temporary for testing)
app.get('/debug/db', async (req, res) => {
  try {
    const { User, Company, Vehicle, Expense, AuditLog } = require('./src/models');

    const stats = {
      users: await User.countDocuments(),
      companies: await Company.countDocuments(),
      vehicles: await Vehicle.countDocuments(),
      expenses: await Expense.countDocuments(),
      auditLogs: await AuditLog.countDocuments(),
      timestamp: new Date().toISOString()
    };

    // Get sample data
    const sampleUser = await User.findOne().lean();
    const sampleExpense = await Expense.findOne().populate('driverId', 'name email').populate('vehicleId', 'make model').lean();
    const sampleCompany = await Company.findOne().lean();
    const sampleVehicle = await Vehicle.findOne().lean();

    res.json({
      success: true,
      stats,
      samples: {
        user: sampleUser,
        expense: sampleExpense,
        company: sampleCompany,
        vehicle: sampleVehicle
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/roles', roleRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handling
app.use(errorHandler);

// Database connection and server start
const startServer = async () => {
  try {
    await connectDB();
    console.log('📊 Database connected successfully');

    app.listen(config.PORT, () => {
      console.log(`🚀 Server running on port ${config.PORT}`);
      console.log(`🔗 Environment: ${config.NODE_ENV}`);
      console.log(`🌐 API available at: http://localhost:${config.PORT}/api`);
      console.log(`❤️  Health check: http://localhost:${config.PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;