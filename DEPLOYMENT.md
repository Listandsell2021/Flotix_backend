# Flotix Backend Deployment Guide

## Overview
The new `server.js` file provides a production-ready entry point that runs your complete TypeScript backend with all API routes working.

## What's Included
✅ **All API Routes Working**: Auth, Users, Expenses, Vehicles, Companies, Reports, Audit, Roles
✅ **OCR Processing**: OpenAI GPT-4 Vision for receipt processing
✅ **File Uploads**: Firebase Storage integration
✅ **Authentication**: JWT with refresh tokens
✅ **Database**: MongoDB with Mongoose
✅ **CORS**: Configured for your production domains
✅ **Security**: Helmet, rate limiting, validation

## Quick Start

### Option 1: Using server.js (Recommended for Production)
```bash
# On your server
npm install
npm run start:server
```

### Option 2: Direct node command
```bash
# On your server
npm install
node server.js
```

### Option 3: With PM2 (Best for Production)
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name "flotix-backend"

# Save and setup auto-start
pm2 save
pm2 startup
```

## Environment Variables
Create a `.env` file with:

```bash
# Database (Required)
MONGODB_URI=mongodb+srv://harpreet_db_user:o5AQBpp7RYQQctFV@fleetcluster.hqzrisg.mongodb.net/?retryWrites=true&w=majority&appName=FleetCluster

# JWT Secrets (Required)
JWT_ACCESS_SECRET=your-super-secret-access-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production

# OpenAI (Required for OCR)
OPENAI_API_KEY=

# Firebase (Required for File Uploads)
FIREBASE_PROJECT_ID=fleet-aa1ec
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n[your-key]\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xyz@fleet-aa1ec.iam.gserviceaccount.com
FIREBASE_STORAGE_BUCKET=fleet-aa1ec.appspot.com

# Production Settings
NODE_ENV=production
PORT=3001

# CORS Origins (Optional - defaults include your domain)
ALLOWED_ORIGINS=https://flotix.listandsell.de,http://localhost:3000,http://localhost:8081
```

## How It Works

1. **server.js** checks for required dependencies and TypeScript files
2. **Automatically installs tsx** if not present
3. **Validates environment variables** before starting
4. **Runs your TypeScript backend** using tsx (same as `npm run start`)
5. **Handles graceful shutdown** and error recovery

## Features

### ✅ All API Endpoints Available:
- `POST /api/auth/login` - User authentication
- `GET /api/auth/me` - Get current user
- `POST /api/expenses` - Create expenses with OCR
- `GET /api/expenses` - List expenses
- `POST /api/expenses/signed-url` - File upload URLs
- `GET /api/users` - User management
- `GET /api/vehicles` - Vehicle management
- `GET /api/companies` - Company management
- `GET /api/reports` - Analytics and reports
- `GET /api/audit` - Audit logs
- `GET /api/roles` - Role management

### ✅ Production Features:
- MongoDB connection with connection pooling
- JWT authentication with automatic refresh
- OCR processing with OpenAI GPT-4 Vision
- Firebase file uploads with signed URLs
- Comprehensive error handling
- Security middleware (Helmet, CORS, Rate limiting)
- Request logging and monitoring

### ✅ CORS Configuration:
Automatically allows requests from:
- `https://flotix.listandsell.de` (your frontend)
- `https://api.flotix.listandsell.de` (your API domain)
- `http://localhost:3000` (development)
- `http://localhost:8081` (React Native dev)

## Verification

After starting the server, test these endpoints:

```bash
# Health check
curl http://localhost:3001/health

# API status
curl http://localhost:3001/api/status

# Test login (replace with real credentials)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

## Troubleshooting

### Server won't start:
1. Check environment variables in `.env`
2. Ensure MongoDB connection string is correct
3. Verify tsx is installed: `npm list tsx`

### CORS errors:
1. Check `ALLOWED_ORIGINS` environment variable
2. Verify your frontend domain is included
3. Check server logs for blocked origins

### API not responding:
1. Verify all TypeScript files exist in `src/`
2. Check for compilation errors: `npm run type-check`
3. Review server logs for specific errors

## Migration from npm run start

If you were using `npm run start` before:

```bash
# Old way
npm run start

# New way (same functionality)
node server.js
# or
npm run start:server
```

Both methods provide identical functionality. The new `server.js` just provides better production deployment experience.