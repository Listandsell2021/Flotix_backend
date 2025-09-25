const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

// You need to replace this with your actual access token
const ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN_HERE';

async function testExpenseCreation() {
  try {
    // First, get the current user info to check if they have a vehicle
    const userResponse = await axios.get(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      }
    });

    console.log('Current user:', {
      id: userResponse.data.data._id,
      name: userResponse.data.data.name,
      role: userResponse.data.data.role,
      assignedVehicleId: userResponse.data.data.assignedVehicleId
    });

    // If user has a vehicle, get vehicle details
    if (userResponse.data.data.assignedVehicleId) {
      const vehicleResponse = await axios.get(
        `${API_URL}/vehicles/${userResponse.data.data.assignedVehicleId}`,
        {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`
          }
        }
      );

      console.log('Assigned vehicle:', {
        id: vehicleResponse.data.data._id,
        licensePlate: vehicleResponse.data.data.licensePlate,
        currentOdometer: vehicleResponse.data.data.currentOdometer
      });
    } else {
      console.log('WARNING: User has no assigned vehicle!');
    }

    // Create an expense with kilometers
    const expenseData = {
      type: 'FUEL',
      amountFinal: 85.50,
      merchant: 'Shell Gas Station',
      receiptUrl: 'https://example.com/receipt.jpg',
      kilometers: 150  // This should add 150km to the vehicle odometer
    };

    console.log('\nCreating expense with:', expenseData);

    const expenseResponse = await axios.post(
      `${API_URL}/expenses`,
      expenseData,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\nExpense created:', {
      id: expenseResponse.data.data._id,
      vehicleId: expenseResponse.data.data.vehicleId,
      kilometers: expenseResponse.data.data.kilometers
    });

    // Check vehicle odometer after expense creation
    if (userResponse.data.data.assignedVehicleId) {
      const vehicleAfterResponse = await axios.get(
        `${API_URL}/vehicles/${userResponse.data.data.assignedVehicleId}`,
        {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`
          }
        }
      );

      console.log('\nVehicle after expense:', {
        id: vehicleAfterResponse.data.data._id,
        licensePlate: vehicleAfterResponse.data.data.licensePlate,
        currentOdometer: vehicleAfterResponse.data.data.currentOdometer
      });
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Instructions
console.log('To test expense creation and vehicle odometer update:');
console.log('1. Get your access token by logging in through the web app');
console.log('2. Replace YOUR_ACCESS_TOKEN_HERE with your actual token');
console.log('3. Run: node test-expense.js');
console.log('\nNote: The script will check if the driver has an assigned vehicle');
console.log('and verify if the odometer updates after expense creation.');