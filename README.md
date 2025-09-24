# Flotix Backend - Standalone Deployment

A complete fleet management backend API that can be deployed independently on any server. This package contains both the production-ready JavaScript version and the full TypeScript source code.

## 📁 Package Contents

```
backend-deploy/
├── server.js                 # Production-ready JavaScript server
├── firebase-service.js       # Firebase integration service
├── firebase-config.json      # Firebase credentials
├── package.json              # Dependencies and scripts
├── ecosystem.config.js       # PM2 configuration
├── deploy.sh                 # Automated deployment script
├── .env.example              # Environment variables template
├── README.md                 # This documentation
├── tsconfig.json             # TypeScript configuration
└── src/                      # Full TypeScript source code
    ├── config.ts
    ├── server.ts
    ├── models/               # Database models
    ├── routes/               # API routes
    ├── middleware/           # Express middleware
    ├── modules/              # Business logic modules
    └── types/                # TypeScript type definitions
```

## 🚀 Quick Deployment Options

### Option 1: JavaScript Production Server (Recommended)
Uses the pre-compiled `server.js` file for immediate deployment.

**Prerequisites:**
- Node.js 18+
- npm or yarn
- MongoDB database (local or cloud)
- PM2 (will be installed automatically)

**One-Command Deployment:**
```bash
chmod +x deploy.sh
./deploy.sh
```

### Option 2: TypeScript Development/Custom Build
Compile from TypeScript source for development or customization.

**Prerequisites:**
- Node.js 18+
- npm or yarn
- MongoDB database
- TypeScript knowledge for customization

**Manual Build & Deploy:**
```bash
# Install dependencies (includes dev dependencies)
npm install

# Build from TypeScript source
npm run build

# Start built version
npm run start:ts
```

## 📋 Manual Deployment Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
nano .env
```

### 3. Build & Start

**Option A: Use JavaScript Server (Recommended for Production)**
```bash
# Start with PM2 (recommended for production)
npm run start:pm2

# Or start with Node.js directly
npm start
```

**Option B: Build from TypeScript Source**
```bash
# Build TypeScript to dist/ directory
npm run build

# Start compiled TypeScript version
npm run start:ts

# Or build and watch for changes (development)
npm run build:watch
```

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start JavaScript server (production) |
| `npm run dev` | Start JavaScript server (development) |
| `npm run build` | Compile TypeScript source to `dist/` |
| `npm run build:watch` | Watch and compile TypeScript changes |
| `npm run start:ts` | Build and start TypeScript version |
| `npm run start:pm2` | Start with PM2 process manager |
| `npm run deploy` | Run automated deployment script |

## 🔧 Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/flotix` |
| `JWT_ACCESS_SECRET` | JWT access token secret | `your-secret-key` |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | `your-refresh-key` |
| `ALLOWED_ORIGINS` | Frontend URLs (CORS) | `https://app.yourdomain.com` |
| `OPENAI_API_KEY` | OpenAI API key for OCR | `sk-...` |
| `FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `your-project.firebasestorage.app` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `production` | Environment mode |
| `MAX_FILE_SIZE` | `5242880` | Max upload size (5MB) |
| `DEFAULT_DRIVER_LIMIT` | `50` | Default driver limit per company |

### Firebase Configuration

The application uses Firebase for file storage. The Firebase credentials are configured in the `firebase-config.json` file:

1. **Create Firebase Service Account:**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file

2. **Update firebase-config.json:**
   ```json
   {
     "type": "service_account",
     "project_id": "your-project-id",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
     // ... rest of the service account JSON
   }
   ```

3. **Firebase Storage Setup:**
   - Enable Firebase Storage in your Firebase project
   - Set up storage rules for your bucket
   - Update the `FIREBASE_STORAGE_BUCKET` in .env file

**Note:** If `firebase-config.json` is not present, the server will start but file upload features will be disabled.

## 🌐 API Endpoints

### Health & Status
- `GET /health` - Health check
- `GET /api/test` - API test endpoint

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Companies (Super Admin)
- `GET /api/companies` - List companies
- `POST /api/companies` - Create company
- `GET /api/companies/:id` - Get company details
- `PUT /api/companies/:id` - Update company

### Users & Drivers
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Vehicles
- `GET /api/vehicles` - List vehicles
- `POST /api/vehicles` - Create vehicle
- `GET /api/vehicles/:id` - Get vehicle details
- `PUT /api/vehicles/:id` - Update vehicle
- `DELETE /api/vehicles/:id` - Delete vehicle
- `POST /api/vehicles/:id/assign` - Assign vehicle to driver
- `POST /api/vehicles/:id/unassign` - Unassign vehicle

### Expenses
- `GET /api/expenses` - List expenses
- `POST /api/expenses` - Create expense
- `GET /api/expenses/:id` - Get expense details
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense
- `POST /api/expenses/upload-receipt` - Upload receipt with OCR

### File Upload
- `POST /api/upload/receipt` - Upload receipt image to Firebase
- `GET /api/firebase/status` - Check Firebase service status

## 🛠️ Server Management

### PM2 Commands
```bash
# Check status
pm2 status

# View logs
pm2 logs flotix-backend

# Restart server
pm2 restart flotix-backend

# Stop server
pm2 stop flotix-backend

# Monitor resources
pm2 monit
```

### Direct Node Commands
```bash
# Development mode
npm run dev

# Production build and start
npm run build && npm start
```

## 🔍 Health Check & Testing

### Test Endpoints
```bash
# Health check
curl http://localhost:3001/health

# API test
curl http://localhost:3001/api/test

# Login test
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

## 📁 Project Structure
```
backend-standalone/
├── src/
│   ├── controllers/     # Route controllers
│   ├── models/         # Database models
│   ├── middleware/     # Express middleware
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── types/          # TypeScript types
│   └── index.ts        # Application entry point
├── dist/               # Compiled JavaScript (after build)
├── logs/               # Application logs
├── .env                # Environment variables
├── package.json        # Dependencies & scripts
├── tsconfig.json       # TypeScript configuration
├── ecosystem.config.js # PM2 configuration
└── deploy.sh           # Deployment script
```

## 🚨 Troubleshooting

### Common Issues

1. **Port 3001 already in use**
   ```bash
   # Find process using port
   lsof -i :3001
   # Kill process
   kill -9 <PID>
   ```

2. **MongoDB connection failed**
   - Check MongoDB URI in `.env`
   - Verify MongoDB server is running
   - Check network connectivity

3. **Permission denied for deploy.sh**
   ```bash
   chmod +x deploy.sh
   ```

4. **Build failures**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

## 🔐 Security Considerations

- Change all default secrets in `.env`
- Use HTTPS in production
- Configure firewall rules
- Regular security updates
- Monitor logs for suspicious activity

## 📞 Support

For issues or questions:
- Check logs: `pm2 logs flotix-backend`
- Review configuration in `.env`
- Test endpoints with health check
- Monitor system resources