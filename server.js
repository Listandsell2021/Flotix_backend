const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
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
      imgSrc: ["'self'", "data:", "https:", "https://storage.googleapis.com"],
      connectSrc: ["'self'", "https:", "wss:"],
    },
  },
}));

// CORS configuration - Allow multiple origins for Flotix
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:8081', // React Native development
  'https://flotix.listandsell.de',
  'https://api.flotix.listandsell.de',
  // Add any additional origins from environment
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log(`❌ CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(compression());
app.use(express.json({ limit: '50mb' })); // Larger limit for receipt images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Apply rate limiting only in production
if (process.env.NODE_ENV === 'production') {
  app.use('/api', limiter);
  console.log('🛡️ Rate limiting enabled for production');
}

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📝 ${timestamp} - ${req.method} ${req.path}`);
  next();
});

// Disable caching for API routes to prevent 304 issues
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Flotix Backend API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mode: 'production-ready with TypeScript routes',
    version: '1.0.0'
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    service: 'Flotix Fleet Expense Management API',
    timestamp: new Date().toISOString(),
    features: [
      'OCR Receipt Processing',
      'Firebase Storage Integration',
      'JWT Authentication',
      'Role-based Access Control',
      'Expense Management',
      'Vehicle Management',
      'Company Management',
      'Audit Logging'
    ],
    endpoints: {
      auth: '/api/auth/*',
      expenses: '/api/expenses/*',
      users: '/api/users/*',
      vehicles: '/api/vehicles/*',
      companies: '/api/companies/*',
      reports: '/api/reports/*',
      audit: '/api/audit/*',
      roles: '/api/roles/*'
    }
  });
});

// Debug Firebase Storage endpoint
app.get('/debug/firebase', (req, res) => {
  res.json({
    firebaseConfig: {
      projectId: process.env.FIREBASE_PROJECT_ID || 'Not configured',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'Not configured',
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

// Try to import the TypeScript routes using tsx
let useModularRoutes = false;
let routesModule = null;

console.log('🔍 Attempting to load Flotix routes...');

try {
  // Register tsx to handle TypeScript files
  const path = require('path');
  const tsxPath = path.join(__dirname, 'node_modules', 'tsx', 'dist', 'cjs', 'index.cjs');
  require(tsxPath);
  console.log('✅ tsx module loaded successfully');

  // Now import the TypeScript routes
  routesModule = require('./src/routes');
  console.log('✅ Successfully imported routes using tsx runtime (source TypeScript)');
  useModularRoutes = true;
} catch (error) {
  console.log('⚠️ Could not load TypeScript routes with tsx:', error.message);
  console.log('📦 Falling back to basic route definitions');
  console.log('💡 Make sure tsx is installed: npm install tsx');
}

// Use modular TypeScript routes if available
if (useModularRoutes && routesModule) {
  try {
    // Import individual route modules
    const {
      authRoutes,
      userRoutes,
      companyRoutes,
      vehicleRoutes,
      expenseRoutes,
      reportRoutes,
      auditRoutes,
      roleRoutes,
      registrationEmailRoutes,
      smtpSettingsRoutes,
      systemSettingsRoutes
    } = routesModule;

    // Set up individual routes
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/companies', companyRoutes);
    app.use('/api/vehicles', vehicleRoutes);
    app.use('/api/expenses', expenseRoutes);
    app.use('/api/reports', reportRoutes);
    app.use('/api/audit', auditRoutes);
    app.use('/api/roles', roleRoutes);

    // Add registration emails route
    if (registrationEmailRoutes) {
      app.use('/api', registrationEmailRoutes);
      console.log('✅ Registration emails route loaded');
    }

    // Add SMTP settings route
    if (smtpSettingsRoutes) {
      app.use('/api', smtpSettingsRoutes);
      console.log('✅ SMTP settings route loaded');
    }

    // Add system settings route
    if (systemSettingsRoutes) {
      app.use('/api', systemSettingsRoutes);
      console.log('✅ System settings route loaded');
    }

    console.log('🎯 Using full Flotix TypeScript routes');
    console.log('✅ All Flotix API endpoints available');
  } catch (error) {
    console.error('❌ Error setting up modular routes:', error);
    useModularRoutes = false;
  }
}

// Fallback basic routes if TypeScript compilation failed
if (!useModularRoutes) {
  console.log('🔄 Setting up fallback basic routes for Flotix');
  console.log('⚠️ Limited functionality - compile TypeScript for full features');

  // Basic test route
  app.get('/api/test', (req, res) => {
    res.json({
      message: 'Flotix Backend API is working with fallback routes!',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      note: 'Using fallback routes - run "npm run build" for full functionality'
    });
  });

  // Basic auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      // Demo credentials for fallback mode
      if (email === 'admin@democompany.com' && password === 'password123') {
        res.json({
          success: true,
          message: 'Login successful (fallback route)',
          data: {
            user: {
              _id: 'demo-admin-id',
              name: 'Demo Admin',
              email: 'admin@democompany.com',
              role: 'ADMIN',
              companyId: 'demo-company-id',
              status: 'ACTIVE'
            },
            tokens: {
              accessToken: 'demo-access-token',
              refreshToken: 'demo-refresh-token'
            }
          }
        });
      } else {
        res.status(401).json({
          success: false,
          error: 'Invalid credentials - use admin@democompany.com / password123'
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }
  });

  app.get('/api/auth/me', async (req, res) => {
    res.json({
      success: true,
      data: {
        _id: 'demo-admin-id',
        name: 'Demo Admin',
        email: 'admin@democompany.com',
        role: 'ADMIN',
        companyId: 'demo-company-id',
        status: 'ACTIVE'
      }
    });
  });

  // Basic Flotix routes
  app.get('/api/expenses', (req, res) => {
    res.json({
      success: true,
      data: { data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } },
      message: 'Fallback route - compile TypeScript for full expense management'
    });
  });

  app.get('/api/users', (req, res) => {
    res.json({
      success: true,
      data: [],
      message: 'Fallback route - compile TypeScript for full user management'
    });
  });

  app.get('/api/vehicles', (req, res) => {
    res.json({
      success: true,
      data: [],
      message: 'Fallback route - compile TypeScript for full vehicle management'
    });
  });

  app.get('/api/vehicles/my-vehicle', (req, res) => {
    res.json({
      success: true,
      data: {
        _id: 'demo-vehicle-id',
        make: 'Demo',
        model: 'Vehicle',
        year: 2023,
        licensePlate: 'DEMO-001',
        type: 'CAR',
        status: 'ACTIVE',
        currentOdometer: 45000,
        fuelType: 'GASOLINE',
        color: 'Blue'
      },
      message: 'Demo vehicle data - compile TypeScript for full functionality'
    });
  });

  app.get('/api/companies', (req, res) => {
    res.json({
      success: true,
      data: [],
      message: 'Fallback route - compile TypeScript for full company management'
    });
  });

  app.get('/api/reports', (req, res) => {
    res.json({
      success: true,
      data: [],
      message: 'Fallback route - compile TypeScript for full reporting'
    });
  });

  app.get('/api/audit', (req, res) => {
    res.json({
      success: true,
      data: [],
      message: 'Fallback route - compile TypeScript for full audit logging'
    });
  });

  app.get('/api/roles', (req, res) => {
    res.json({
      success: true,
      data: [],
      message: 'Fallback route - compile TypeScript for full role management'
    });
  });
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
    service: 'Flotix Backend API',
    mode: useModularRoutes ? 'full-typescript-routes' : 'fallback-routes',
    availableRoutes: useModularRoutes ? [
      'All Flotix TypeScript routes available:',
      'GET /health - Health check',
      'GET /api/status - API status',
      'POST /api/auth/login - Authentication',
      'GET /api/auth/me - User profile',
      'GET/POST/PUT/DELETE /api/expenses/* - Expense management',
      'GET/POST/PUT/DELETE /api/users/* - User management',
      'GET/POST/PUT/DELETE /api/vehicles/* - Vehicle management',
      'GET/POST/PUT/DELETE /api/companies/* - Company management',
      'GET /api/reports/* - Reporting and analytics',
      'GET /api/audit/* - Audit logs',
      'GET /api/roles/* - Role management'
    ] : [
      'Fallback routes available (limited functionality):',
      'GET /health - Health check',
      'GET /api/status - API status',
      'GET /api/test - Basic test',
      'POST /api/auth/login - Basic auth (admin@democompany.com/password123)',
      'GET /api/auth/me - Basic profile',
      'GET /api/expenses - Basic expenses (empty)',
      'GET /api/users - Basic users (empty)',
      'GET /api/vehicles - Basic vehicles (empty)',
      'GET /api/vehicles/my-vehicle - Driver vehicle info (requires TypeScript)',
      '💡 Run "npm run build" then restart for full functionality'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Database connection and server startup
const startServer = async () => {
  try {
    // MongoDB connection
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    // Add database name from .env
    const dbName = process.env.DB_NAME || 'flotix_test';
    // Check if URI already has a database name or ends with /
    let fullMongoUri;
    if (mongoUri.includes('/?')) {
      // URI like: mongodb+srv://user:pass@host.net/?params
      fullMongoUri = mongoUri.replace('/?', `/${dbName}?`);
    } else if (mongoUri.includes('?')) {
      // URI like: mongodb+srv://user:pass@host.net?params
      fullMongoUri = mongoUri.replace('?', `/${dbName}?`);
    } else if (mongoUri.endsWith('/')) {
      // URI ends with /
      fullMongoUri = `${mongoUri}${dbName}`;
    } else {
      // URI like: mongodb+srv://user:pass@host.net
      fullMongoUri = `${mongoUri}/${dbName}`;
    }

    console.log('🔗 Connecting to MongoDB for Flotix...');

    const connection = await mongoose.connect(fullMongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ Connected to MongoDB');
    console.log(`📊 Database: ${connection.connection.name}`);

    // Start the server
    const server = app.listen(PORT, () => {
      console.log('');
      console.log('🚀 Flotix Backend Server Started Successfully!');
      console.log('═'.repeat(50));
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Port: ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🧪 API status: http://localhost:${PORT}/api/status`);
      console.log(`🎯 Architecture: ${useModularRoutes ? 'Full TypeScript Routes' : 'Fallback CommonJS Routes'}`);
      console.log(`🌍 CORS Origins: ${allowedOrigins.join(', ')}`);

      if (useModularRoutes) {
        console.log('✅ All Flotix features available:');
        console.log('   • OCR Receipt Processing');
        console.log('   • Firebase Storage Integration');
        console.log('   • JWT Authentication');
        console.log('   • Role-based Access Control');
        console.log('   • Complete Expense Management');
        console.log('   • Vehicle & Company Management');
        console.log('   • Audit Logging & Reporting');
      } else {
        console.log('⚠️ Limited functionality - Fallback routes active');
        console.log('💡 Run "npm run build" then restart for full features');
        console.log('🔐 Demo login: admin@democompany.com / password123');
      }

      console.log('═'.repeat(50));
      console.log('🎉 Flotix Backend Ready for Fleet Expense Management!');
      console.log('');
    });

    // Graceful shutdown handlers
    const gracefulShutdown = (signal) => {
      console.log(`\n👋 ${signal} received, shutting down Flotix backend gracefully...`);
      server.close(() => {
        console.log('🔌 HTTP server closed');
        mongoose.connection.close(false, () => {
          console.log('📦 MongoDB connection closed');
          console.log('✅ Flotix backend shutdown complete');
          process.exit(0);
        });
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start Flotix backend server:', error);
    console.error('🔍 Check your environment variables and database connection');
    process.exit(1);
  }
};

// Start the Flotix backend
startServer();