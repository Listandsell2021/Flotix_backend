const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// JWT configuration
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-key-change-this-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-this-in-production';
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Security middleware
app.use(helmet());

// CORS configuration - allow multiple origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://167.235.34.48',
  'http://167.235.34.48:3000',
  'http://167.235.34.48:3001',
  'https://flotix.de',
  'https://www.flotix.de',
  'https://fleetflow.vercel.app'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  },
  passwordHash: {
    type: String,
    required: true,
    minlength: 6,
  },
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN', 'DRIVER'],
    required: true,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: function() {
      return this.role !== 'SUPER_ADMIN';
    },
  },
  assignedVehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
    default: 'ACTIVE',
  },
  lastActive: {
    type: Date,
  },
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.passwordHash;
      delete ret.__v;
      return ret;
    },
  },
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ companyId: 1, role: 1 });
userSchema.index({ status: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();

  try {
    const saltRounds = 12;
    this.passwordHash = await bcrypt.hash(this.passwordHash, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);

// Company Schema
const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  plan: {
    type: String,
    enum: ['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE'],
    default: 'BASIC',
  },
  driverLimit: {
    type: Number,
    default: 5,
    min: 1,
    max: 500,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRIAL'],
    default: 'ACTIVE',
  },
  trialEndsAt: Date,
  billingCycle: {
    type: String,
    enum: ['MONTHLY', 'YEARLY'],
    default: 'MONTHLY',
  },
}, {
  timestamps: true,
});

const Company = mongoose.model('Company', companySchema);

// Helper function to generate tokens
const generateTokens = (payload) => {
  const accessToken = jwt.sign(
    payload,
    JWT_ACCESS_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    payload,
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
};

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend API is working!',
    timestamp: new Date().toISOString()
  });
});

// Login route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or account inactive'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      companyId: user.companyId?.toString(),
    };

    const tokens = generateTokens(tokenPayload);

    // Update last active
    user.lastActive = new Date();
    await user.save();

    // Return user data without password
    const userData = user.toObject();
    delete userData.passwordHash;

    res.json({
      success: true,
      data: {
        user: userData,
        tokens
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// Refresh token route
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    // Check if user still exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Generate new tokens
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      companyId: user.companyId?.toString(),
    };

    const tokens = generateTokens(tokenPayload);

    // Update last active
    user.lastActive = new Date();
    await user.save();

    res.json({
      success: true,
      data: tokens,
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

// Middleware to verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
    req.user = decoded;

    // Check if user exists
    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Get current user
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate('companyId', 'name plan status');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user,
      message: 'User data retrieved successfully'
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user data'
    });
  }
});

// Logout route
app.post('/api/auth/logout', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Create demo admin user if it doesn't exist
const createDemoUser = async () => {
  try {
    const existingUser = await User.findOne({ email: 'admin@fleetflow.com' });

    if (!existingUser) {
      // Create demo company first
      let company = await Company.findOne({ email: 'admin@fleetflow.com' });

      if (!company) {
        company = new Company({
          name: 'Demo Company',
          email: 'admin@fleetflow.com',
          plan: 'PREMIUM',
          driverLimit: 50,
          status: 'ACTIVE',
        });
        await company.save();
        console.log('✅ Demo company created');
      }

      const user = new User({
        name: 'Admin User',
        email: 'admin@fleetflow.com',
        passwordHash: 'password123', // Will be hashed by pre-save hook
        role: 'ADMIN',
        companyId: company._id,
        status: 'ACTIVE',
      });

      await user.save();
      console.log('✅ Demo admin user created');
      console.log('📧 Email: admin@fleetflow.com');
      console.log('🔑 Password: password123');
    }

    // Create super admin if doesn't exist
    const superAdmin = await User.findOne({ email: 'superadmin@fleetflow.com' });
    if (!superAdmin) {
      const user = new User({
        name: 'Super Admin',
        email: 'superadmin@fleetflow.com',
        passwordHash: 'superpass123', // Will be hashed by pre-save hook
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      });

      await user.save();
      console.log('✅ Super admin user created');
      console.log('📧 Email: superadmin@fleetflow.com');
      console.log('🔑 Password: superpass123');
    }
  } catch (error) {
    console.error('Error creating demo user:', error);
  }
};

// Expense Schema
const expenseSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
  },
  type: {
    type: String,
    enum: ['FUEL', 'MISC'],
    required: true,
  },
  amountExtracted: {
    type: Number,
    min: 0,
  },
  amountFinal: {
    type: Number,
    required: true,
    min: 0,
    max: 100000,
  },
  currency: {
    type: String,
    required: true,
    default: 'EUR',
  },
  receiptUrl: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['TOLL', 'PARKING', 'REPAIR', 'OTHER'],
    required: function() {
      return this.type === 'MISC';
    },
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  ocrData: {
    vendor: String,
    address: String,
    extractedDate: Date,
    confidence: Number,
    rawText: String,
  },
  isEditable: {
    type: Boolean,
    default: true,
  },
  createdByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  editedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

const Expense = mongoose.model('Expense', expenseSchema);

// Vehicle Schema
const vehicleSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  licensePlate: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  make: {
    type: String,
    required: true,
    trim: true,
  },
  model: {
    type: String,
    required: true,
    trim: true,
  },
  year: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'],
    default: 'ACTIVE',
  },
}, {
  timestamps: true,
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

// EXPENSE ROUTES

// GET /api/expenses - Get all expenses (with filters)
app.get('/api/expenses', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, driverId, vehicleId, startDate, endDate } = req.query;

    // Build query
    const query = {};

    // For non-super admins, filter by company
    if (req.user.role !== 'SUPER_ADMIN') {
      query.companyId = req.user.companyId;
    }

    // For drivers, only show their expenses
    if (req.user.role === 'DRIVER') {
      query.driverId = req.user.userId;
    }

    // Apply filters
    if (type) query.type = type;
    if (driverId && req.user.role !== 'DRIVER') query.driverId = driverId;
    if (vehicleId) query.vehicleId = vehicleId;

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(query)
      .populate('driverId', 'name email')
      .populate('vehicleId', 'licensePlate make model')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Expense.countDocuments(query);

    res.json({
      success: true,
      data: {
        expenses,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / limit),
        },
      },
      message: 'Expenses retrieved successfully'
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve expenses'
    });
  }
});

// POST /api/expenses - Create new expense
app.post('/api/expenses', authenticate, async (req, res) => {
  try {
    const expenseData = {
      ...req.body,
      driverId: req.user.userId,
      companyId: req.user.companyId,
      createdByUserId: req.user.userId,
    };

    const expense = new Expense(expenseData);
    await expense.save();

    await expense.populate('driverId', 'name email');
    await expense.populate('vehicleId', 'licensePlate make model');

    res.status(201).json({
      success: true,
      data: expense,
      message: 'Expense created successfully'
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create expense'
    });
  }
});

// GET /api/expenses/:id - Get single expense
app.get('/api/expenses/:id', authenticate, async (req, res) => {
  try {
    const query = { _id: req.params.id };

    // For non-super admins, ensure expense belongs to their company
    if (req.user.role !== 'SUPER_ADMIN') {
      query.companyId = req.user.companyId;
    }

    // For drivers, ensure it's their expense
    if (req.user.role === 'DRIVER') {
      query.driverId = req.user.userId;
    }

    const expense = await Expense.findOne(query)
      .populate('driverId', 'name email')
      .populate('vehicleId', 'licensePlate make model');

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      data: expense,
      message: 'Expense retrieved successfully'
    });
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve expense'
    });
  }
});

// PUT /api/expenses/:id - Update expense
app.put('/api/expenses/:id', authenticate, async (req, res) => {
  try {
    const query = { _id: req.params.id };

    // For non-super admins, ensure expense belongs to their company
    if (req.user.role !== 'SUPER_ADMIN') {
      query.companyId = req.user.companyId;
    }

    // For drivers, ensure it's their expense and it's editable
    if (req.user.role === 'DRIVER') {
      query.driverId = req.user.userId;
      query.isEditable = true;
    }

    const expense = await Expense.findOne(query);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found or not editable'
      });
    }

    // Update expense
    Object.assign(expense, req.body);
    expense.editedByUserId = req.user.userId;

    await expense.save();
    await expense.populate('driverId', 'name email');
    await expense.populate('vehicleId', 'licensePlate make model');

    res.json({
      success: true,
      data: expense,
      message: 'Expense updated successfully'
    });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expense'
    });
  }
});

// DELETE /api/expenses/:id - Delete expense
app.delete('/api/expenses/:id', authenticate, async (req, res) => {
  try {
    const query = { _id: req.params.id };

    // Only admins and super admins can delete
    if (req.user.role === 'DRIVER') {
      return res.status(403).json({
        success: false,
        message: 'Drivers cannot delete expenses'
      });
    }

    // For admins, ensure expense belongs to their company
    if (req.user.role === 'ADMIN') {
      query.companyId = req.user.companyId;
    }

    const expense = await Expense.findOneAndDelete(query);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete expense'
    });
  }
});

// COMPANY ROUTES (Basic implementation)
app.get('/api/companies', authenticate, async (req, res) => {
  try {
    const query = req.user.role === 'SUPER_ADMIN' ? {} : { _id: req.user.companyId };
    const companies = await Company.find(query);

    res.json({
      success: true,
      data: companies,
      message: 'Companies retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve companies'
    });
  }
});

// USER ROUTES (Basic implementation)
app.get('/api/users', authenticate, async (req, res) => {
  try {
    const query = {};

    if (req.user.role !== 'SUPER_ADMIN') {
      query.companyId = req.user.companyId;
    }

    const users = await User.find(query).select('-passwordHash');

    res.json({
      success: true,
      data: users,
      message: 'Users retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users'
    });
  }
});

// VEHICLE ROUTES (Basic implementation)
app.get('/api/vehicles', authenticate, async (req, res) => {
  try {
    const query = {};

    if (req.user.role !== 'SUPER_ADMIN') {
      query.companyId = req.user.companyId;
    }

    const vehicles = await Vehicle.find(query);

    res.json({
      success: true,
      data: vehicles,
      message: 'Vehicles retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve vehicles'
    });
  }
});

// REPORTS ROUTES (Basic implementation)
app.get('/api/reports/dashboard', authenticate, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get monthly totals
    const monthlyTotal = await Expense.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountFinal' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        monthlyTotal: monthlyTotal[0]?.total || 0,
        currentMonth: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      },
      message: 'Dashboard data retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard data'
    });
  }
});

// Empty route handlers for other endpoints (to prevent 404s)
app.use('/api/roles', authenticate, (req, res) => {
  res.json({ success: true, data: [], message: 'Roles endpoint' });
});

app.use('/api/audit', authenticate, (req, res) => {
  res.json({ success: true, data: [], message: 'Audit endpoint' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

// Database connection and server startup
const startServer = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fleetflow';
    console.log('🔗 Connecting to MongoDB...');

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ Connected to MongoDB');

    // Create demo user after connection
    await createDemoUser();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();