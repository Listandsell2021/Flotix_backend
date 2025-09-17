const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const sql = require('mssql');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
});

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration - allow multiple origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://167.235.34.48',
  'http://167.235.34.48:3000',
  'http://167.235.34.48:3001',
  'https://flotix.de',
  'https://www.flotix.de'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS: Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // Cache preflight response for 24 hours
}));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(204);
});

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'production') {
  app.use('/api', limiter);
}

// Basic User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'employee' },
  permissions: [String],
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Settings Schema for storing configuration data
const settingsSchema = new mongoose.Schema({
  category: { type: String, required: true, unique: true }, // 'smtp', 'wawi', 'stripe', 'general'
  settings: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);

// Basic routes
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

// Login route (basic implementation)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // For demo purposes, create admin user if it doesn't exist
    let user = await User.findOne({ email });

    if (!user && email === 'admin@example.com') {
      user = new User({
        username: 'admin',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
        permissions: ['admin_access'],
      });
      await user.save();
      console.log('✅ Demo admin user created');
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      isActive: user.isActive,
    };

    res.json({
      message: 'Login successful',
      user: userResponse,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
app.get('/api/auth/me', async (req, res) => {
  try {
    // For demo, return admin user
    const user = await User.findOne({ email: 'admin@example.com' });
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      isActive: user.isActive,
    };

    res.json({ user: userResponse });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ error: 'Authentication check failed' });
  }
});

// Logout route
app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

// ===== SETTINGS ROUTES =====

// Generic settings routes
const getSettings = async (category, defaultSettings = {}) => {
  try {
    const settings = await Settings.findOne({ category });
    return settings ? settings.settings : defaultSettings;
  } catch (error) {
    console.error(`Error getting ${category} settings:`, error);
    return defaultSettings;
  }
};

const saveSettings = async (category, settingsData) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { category },
      { settings: settingsData },
      { upsert: true, new: true }
    );
    return settings;
  } catch (error) {
    console.error(`Error saving ${category} settings:`, error);
    throw error;
  }
};

// WAWI Database Settings Routes
app.get('/api/settings/wawi', async (req, res) => {
  try {
    const defaultSettings = {
      server: '',
      database: '',
      username: '',
      password: '',
      port: '1433',
      trustServerCertificate: true,
    };

    const settings = await getSettings('wawi', defaultSettings);
    res.json({ settings });
  } catch (error) {
    console.error('Error fetching WAWI settings:', error);
    res.status(500).json({ error: 'Failed to fetch WAWI settings' });
  }
});

app.put('/api/settings/wawi', async (req, res) => {
  try {
    const { server, database, username, password, port, trustServerCertificate } = req.body;

    // Basic validation
    if (!server || !database || !username || !password || !port) {
      return res.status(400).json({ error: 'All WAWI settings fields are required' });
    }

    const settingsData = {
      server,
      database,
      username,
      password,
      port,
      trustServerCertificate: Boolean(trustServerCertificate),
    };

    await saveSettings('wawi', settingsData);
    res.json({ message: 'WAWI settings saved successfully', settings: settingsData });
  } catch (error) {
    console.error('Error saving WAWI settings:', error);
    res.status(500).json({ error: 'Failed to save WAWI settings' });
  }
});

// MSSQL Connection Test Route
app.post('/api/settings/test/mssql', async (req, res) => {
  try {
    // Get current WAWI settings
    const wawiSettings = await getSettings('wawi');

    if (!wawiSettings.server || !wawiSettings.database) {
      return res.status(400).json({ error: 'WAWI settings are not configured' });
    }

    const config = {
      server: wawiSettings.server,
      port: parseInt(wawiSettings.port) || 1433,
      database: wawiSettings.database,
      user: wawiSettings.username,
      password: wawiSettings.password,
      options: {
        encrypt: false, // Use true for Azure SQL
        trustServerCertificate: wawiSettings.trustServerCertificate,
        connectTimeout: 10000,
        requestTimeout: 10000,
      },
      pool: {
        max: 1,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };

    console.log('Testing MSSQL connection to:', `${config.server}:${config.port}/${config.database}`);

    // Create connection pool and test
    const pool = new sql.ConnectionPool(config);
    await pool.connect();

    // Test with a simple query
    const result = await pool.request().query('SELECT @@VERSION as version, DB_NAME() as database');

    await pool.close();

    res.json({
      success: true,
      message: 'MSSQL connection test successful',
      connectionInfo: {
        server: `${config.server}:${config.port}`,
        database: config.database,
        version: result.recordset[0]?.version?.substring(0, 50) + '...' || 'Unknown',
        connectedDatabase: result.recordset[0]?.database || 'Unknown',
      },
    });
  } catch (error) {
    console.error('MSSQL connection test failed:', error);

    let errorMessage = 'MSSQL connection test failed';
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused - check server address and port';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Server not found - check server address';
    } else if (error.code === 'ELOGIN') {
      errorMessage = 'Login failed - check username and password';
    } else if (error.code === 'ETIMEOUT') {
      errorMessage = 'Connection timeout - check server availability';
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(400).json({ error: errorMessage, code: error.code });
  }
});

// SMTP Settings Routes
app.get('/api/settings/smtp', async (req, res) => {
  try {
    const defaultSettings = {
      host: '',
      port: '587',
      username: '',
      password: '',
      secure: false,
      fromName: 'LS Contract Management',
      fromEmail: 'noreply@listandsell.de',
    };

    const settings = await getSettings('smtp', defaultSettings);
    res.json({ settings });
  } catch (error) {
    console.error('Error fetching SMTP settings:', error);
    res.status(500).json({ error: 'Failed to fetch SMTP settings' });
  }
});

app.put('/api/settings/smtp', async (req, res) => {
  try {
    const { host, port, username, password, secure, fromName, fromEmail } = req.body;

    const settingsData = {
      host: host || '',
      port: port || '587',
      username: username || '',
      password: password || '',
      secure: Boolean(secure),
      fromName: fromName || 'LS Contract Management',
      fromEmail: fromEmail || 'noreply@listandsell.de',
    };

    await saveSettings('smtp', settingsData);
    res.json({ message: 'SMTP settings saved successfully', settings: settingsData });
  } catch (error) {
    console.error('Error saving SMTP settings:', error);
    res.status(500).json({ error: 'Failed to save SMTP settings' });
  }
});

// Stripe Settings Routes
app.get('/api/settings/stripe', async (req, res) => {
  try {
    const defaultSettings = {
      publishableKey: '',
      secretKey: '',
      webhookSecret: '',
      currency: 'eur',
      enabled: false,
      testMode: true,
    };

    const settings = await getSettings('stripe', defaultSettings);
    res.json({ settings });
  } catch (error) {
    console.error('Error fetching Stripe settings:', error);
    res.status(500).json({ error: 'Failed to fetch Stripe settings' });
  }
});

app.put('/api/settings/stripe', async (req, res) => {
  try {
    const { publishableKey, secretKey, webhookSecret, currency, enabled, testMode } = req.body;

    const settingsData = {
      publishableKey: publishableKey || '',
      secretKey: secretKey || '',
      webhookSecret: webhookSecret || '',
      currency: currency || 'eur',
      enabled: Boolean(enabled),
      testMode: Boolean(testMode),
    };

    await saveSettings('stripe', settingsData);
    res.json({ message: 'Stripe settings saved successfully', settings: settingsData });
  } catch (error) {
    console.error('Error saving Stripe settings:', error);
    res.status(500).json({ error: 'Failed to save Stripe settings' });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Database connection and server startup
const startServer = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ls-contract-management';
    console.log('🔗 Connecting to MongoDB...');

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
      console.log(`🔐 Demo login: admin@example.com / password123`);
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