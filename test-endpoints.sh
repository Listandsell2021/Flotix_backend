#!/bin/bash

echo "=== Testing Backend Endpoints ==="
echo ""

# Test trends endpoint
echo "1️⃣ Testing GET /api/reports/trends"
echo "Response:"
curl -s http://localhost:3001/api/reports/trends?months=6 \
  -H "Content-Type: application/json" | head -50
echo ""
echo ""

# Test comparison endpoint
echo "2️⃣ Testing GET /api/reports/comparison"
echo "Response:"
curl -s "http://localhost:3001/api/reports/comparison?period1Start=2024-09-01&period1End=2024-09-30&period2Start=2024-10-01&period2End=2024-10-31" \
  -H "Content-Type: application/json" | head -50
