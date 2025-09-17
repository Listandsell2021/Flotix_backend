import mongoose from 'mongoose';
import { config } from '../config';
import { Expense } from '../models';

async function deleteAllExpenses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('📊 Database connected successfully');

    // Find all expenses
    const expenses = await Expense.find({});
    console.log(`Found ${expenses.length} expenses to delete`);

    if (expenses.length === 0) {
      console.log('No expenses found in the database');
      await mongoose.disconnect();
      return;
    }

    // Delete all expenses
    console.log('Deleting all expenses...');
    const result = await Expense.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.deletedCount} expenses`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('📊 Database disconnected');
  } catch (error) {
    console.error('❌ Error deleting expenses:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
deleteAllExpenses();