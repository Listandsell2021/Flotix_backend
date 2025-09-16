import mongoose from 'mongoose';
import { Vehicle } from '../models';
import config from '@fleetflow/config';

async function migrateDriverAssignments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('📊 Connected to database');

    // Find all vehicles with assignedDriverId but no assignedDriverIds
    const vehicles = await Vehicle.find({
      assignedDriverId: { $exists: true, $ne: null },
      $or: [
        { assignedDriverIds: { $exists: false } },
        { assignedDriverIds: { $size: 0 } }
      ]
    });

    console.log(`Found ${vehicles.length} vehicles to migrate`);

    for (const vehicle of vehicles) {
      if (vehicle.assignedDriverId) {
        // Initialize assignedDriverIds array with the existing assignedDriverId
        vehicle.assignedDriverIds = [vehicle.assignedDriverId];
        await vehicle.save();
        console.log(`✅ Migrated vehicle ${vehicle.licensePlate}`);
      }
    }

    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateDriverAssignments();