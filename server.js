// Production server entry point with full API functionality
// This file runs your TypeScript backend in production using tsx

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if tsx is installed
try {
  execSync('npx tsx --version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ Error: tsx is not installed. Installing...');
  try {
    execSync('npm install tsx', { stdio: 'inherit' });
    console.log('✅ tsx installed successfully');
  } catch (installError) {
    console.error('❌ Failed to install tsx. Please run: npm install tsx');
    process.exit(1);
  }
}

// Check if TypeScript source files exist
const srcPath = path.join(__dirname, 'src', 'index.ts');
if (!fs.existsSync(srcPath)) {
  console.error('❌ Error: TypeScript source files not found in src/');
  console.error('Make sure your src/index.ts file exists');
  process.exit(1);
}

// Load environment variables
require('dotenv').config();

// Validate critical environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please set these in your .env file');
  process.exit(1);
}

// Set production environment
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Add production domains to CORS if not set
if (!process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:8081',
    'https://flotix.listandsell.de',
    'https://api.flotix.listandsell.de'
  ].join(',');
}

console.log('🚀 Starting Flotix Backend Server...');
console.log('🔗 Environment:', process.env.NODE_ENV);
console.log('🌐 Port:', process.env.PORT || '3001');
console.log('🌐 CORS Origins:', process.env.ALLOWED_ORIGINS);

// Start the TypeScript server using tsx
try {
  const { spawn } = require('child_process');

  const serverProcess = spawn('npx', ['tsx', 'src/index.ts'], {
    stdio: 'inherit',
    env: process.env,
    cwd: __dirname
  });

  // Handle process events
  serverProcess.on('error', (error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });

  serverProcess.on('exit', (code, signal) => {
    if (code !== 0) {
      console.error(`❌ Server exited with code ${code}, signal ${signal}`);
      process.exit(code || 1);
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    serverProcess.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    serverProcess.kill('SIGTERM');
  });

} catch (error) {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}