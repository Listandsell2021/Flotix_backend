import mongoose from 'mongoose';
import { config } from '../config';
import { User, Vehicle } from '../models';

async function deleteAllDrivers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('📊 Database connected successfully');

    // Find all drivers
    const drivers = await User.find({ role: 'DRIVER' });
    console.log(`Found ${drivers.length} drivers to delete`);

    if (drivers.length === 0) {
      console.log('No drivers found in the database');
      await mongoose.disconnect();
      return;
    }

    // Get all driver IDs
    const driverIds = drivers.map(driver => driver._id);

    // Clear vehicle assignments for all drivers
    console.log('Clearing vehicle assignments...');
    await Vehicle.updateMany(
      { 
        $or: [
          { assignedDriverId: { $in: driverIds } },
          { assignedDriverIds: { $in: driverIds } }
        ]
      },
      { 
        $unset: { assignedDriverId: "" },
        $pull: { assignedDriverIds: { $in: driverIds } }
      }
    );

    // Delete all drivers
    console.log('Deleting all drivers...');
    const result = await User.deleteMany({ role: 'DRIVER' });
    
    console.log(`✅ Successfully deleted ${result.deletedCount} drivers`);
    console.log('✅ Vehicle assignments have been cleared');

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('📊 Database disconnected');
  } catch (error) {
    console.error('❌ Error deleting drivers:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
deleteAllDrivers();