import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config, validateConfig } from './config';
import { connectDB } from './db/connection';
import { errorHandler } from './middleware/errorHandler';
import { checkMaintenance } from './middleware';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { companyRoutes } from './routes/companies';
import { vehicleRoutes } from './routes/vehicles';
import { expenseRoutes } from './routes/expenses';
import { reportRoutes } from './routes/reports';
import { auditRoutes } from './routes/audit';
import { roleRoutes } from './routes/roles';
import registrationEmailRoutes from './routes/registrationEmails';
import { smtpSettingsRoutes } from './routes/smtpSettings';
import { systemSettingsRoutes } from './routes/systemSettings';

const app = express();

// Validate environment variables
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

// Rate limiting - DISABLED FOR DEVELOPMENT
// const limiter = rateLimit({
//   windowMs: config.RATE_LIMIT_WINDOW_MS,
//   max: config.RATE_LIMIT_MAX_REQUESTS,
//   message: 'Too many requests from this IP, please try again later.'
// });
// app.use('/api', limiter);

// Logging
app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check (bypass maintenance mode)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', checkMaintenance, userRoutes);
app.use('/api/companies', checkMaintenance, companyRoutes);
app.use('/api/vehicles', checkMaintenance, vehicleRoutes);
app.use('/api/expenses', checkMaintenance, expenseRoutes);
app.use('/api/reports', checkMaintenance, reportRoutes);
app.use('/api/audit', checkMaintenance, auditRoutes);
app.use('/api/roles', checkMaintenance, roleRoutes);
app.use('/api', checkMaintenance, registrationEmailRoutes);
app.use('/api', checkMaintenance, smtpSettingsRoutes);
app.use('/api', checkMaintenance, systemSettingsRoutes);

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
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;