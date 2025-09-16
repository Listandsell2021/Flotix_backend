import mongoose from 'mongoose';
import { config } from '../shared-config/src';
import { Vehicle, User } from '../models';

async function deleteAllVehicles() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('📊 Database connected successfully');

    // Find all vehicles
    const vehicles = await Vehicle.find({});
    console.log(`Found ${vehicles.length} vehicles to delete`);

    if (vehicles.length === 0) {
      console.log('No vehicles found in the database');
      await mongoose.disconnect();
      return;
    }

    // Get all vehicle IDs
    const vehicleIds = vehicles.map(vehicle => vehicle._id);

    // Clear vehicle assignments from all users
    console.log('Clearing vehicle assignments from users...');
    await User.updateMany(
      { assignedVehicleId: { $in: vehicleIds } },
      { $unset: { assignedVehicleId: "" } }
    );

    // Delete all vehicles
    console.log('Deleting all vehicles...');
    const result = await Vehicle.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.deletedCount} vehicles`);
    console.log('✅ User vehicle assignments have been cleared');

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('📊 Database disconnected');
  } catch (error) {
    console.error('❌ Error deleting vehicles:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
deleteAllVehicles();