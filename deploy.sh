#!/bin/bash

echo "🚀 Deploying Flotix Backend (JavaScript)..."
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
fi

print_status "Node.js version: $(node --version)"
print_status "npm version: $(npm --version)"

# Install dependencies
echo "📦 Installing dependencies..."
if npm install; then
    print_status "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
fi

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Copying from .env.example"
    if [ -f .env.example ]; then
        cp .env.example .env
        print_warning "Please edit .env file with your configuration before running the server"
    else
        print_error ".env.example file not found"
    fi
fi

# Create logs directory
mkdir -p logs
print_status "Logs directory created"

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 globally..."
    if npm install -g pm2; then
        print_status "PM2 installed successfully"
    else
        print_error "Failed to install PM2"
    fi
fi

# Start with PM2
echo "🎯 Starting server with PM2..."
if pm2 start ecosystem.config.js --env production; then
    print_status "Server started with PM2"
    pm2 save
    print_status "PM2 configuration saved"
else
    print_warning "PM2 start failed, trying direct node start..."
    if node server.js &; then
        print_status "Server started with Node.js"
    else
        print_error "Failed to start server"
    fi
fi

# Display status
echo ""
echo "🎉 Deployment completed!"
echo "=============================="
echo "Backend API: http://localhost:3001"
echo "Health check: http://localhost:3001/health"
echo "API test: http://localhost:3001/api/test"
echo ""
echo "📋 Useful commands:"
echo "  pm2 status          - Check server status"
echo "  pm2 logs            - View logs"
echo "  pm2 restart all     - Restart server"
echo "  pm2 stop all        - Stop server"
echo ""
echo "🔧 Configuration:"
echo "  Edit .env file for environment variables"
echo "  Check logs/ directory for application logs"
