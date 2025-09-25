#!/bin/bash

echo "🚀 Flotix Backend Health Check"
echo "=============================="

# Check if PM2 process is running
echo "📋 Checking PM2 status..."
pm2 status | grep flotix-backend

# Check if port is listening
echo -e "\n🌐 Checking if port 3001 is listening..."
if sudo lsof -i :3001 > /dev/null; then
    echo "✅ Port 3001 is listening"
else
    echo "❌ Port 3001 is not listening"
fi

# Test health endpoint
echo -e "\n🏥 Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3001/health)
if [[ $HEALTH_RESPONSE == *"ok"* ]]; then
    echo "✅ Health endpoint working"
    echo "Response: $HEALTH_RESPONSE"
else
    echo "❌ Health endpoint failed"
    echo "Response: $HEALTH_RESPONSE"
fi

# Test API endpoint
echo -e "\n🔧 Testing API endpoint..."
API_RESPONSE=$(curl -s http://localhost:3001/api/test)
if [[ $API_RESPONSE == *"Backend API is working"* ]]; then
    echo "✅ API endpoint working"
    echo "Response: $API_RESPONSE"
else
    echo "❌ API endpoint failed"
    echo "Response: $API_RESPONSE"
fi

# Check recent logs for errors
echo -e "\n📝 Recent logs (last 10 lines)..."
pm2 logs flotix-backend --lines 10 --nostream

# System resources
echo -e "\n💻 System Resources..."
echo "Memory usage:"
free -h | grep "Mem:"
echo "Disk usage:"
df -h | grep -E "/$|/home"

echo -e "\n✨ Health check completed!"