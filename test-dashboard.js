const axios = require('axios');

async function testDashboard() {
  try {
    console.log('🧪 Testing Dashboard API...\n');

    // Step 1: Login
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@democompany.com',
      password: 'password123'
    });

    if (loginResponse.data.success) {
      console.log('✅ Login successful');
      console.log('👤 User:', loginResponse.data.data.user.name);
      console.log('🎭 Role:', loginResponse.data.data.user.role);
      
      const token = loginResponse.data.data.tokens.accessToken;
      console.log('🔑 Token:', token.substring(0, 20) + '...\n');

      // Step 2: Test Dashboard
      console.log('2️⃣ Testing dashboard endpoint...');
      const dashboardResponse = await axios.get('http://localhost:3001/api/reports/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (dashboardResponse.data.success) {
        console.log('✅ Dashboard data retrieved successfully!');
        console.log('📊 Data:', JSON.stringify(dashboardResponse.data, null, 2));
      } else {
        console.log('❌ Dashboard failed:', dashboardResponse.data.message);
      }
    } else {
      console.log('❌ Login failed:', loginResponse.data.message);
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testDashboard();
