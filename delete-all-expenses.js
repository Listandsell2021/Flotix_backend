const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://wadhwasawan01:Sid280405@cluster0.hqzrisg.mongodb.net/fleetflow?retryWrites=true&w=majority&appName=Cluster0';

async function deleteAllExpenses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the Expense model
    const Expense = mongoose.model('Expense', new mongoose.Schema({}, { strict: false }));

    // Count expenses before deletion
    const countBefore = await Expense.countDocuments();
    console.log(`📊 Found ${countBefore} expenses in database`);

    if (countBefore === 0) {
      console.log('ℹ️ No expenses to delete');
      await mongoose.connection.close();
      return;
    }

    // Confirm deletion
    console.log('⚠️  WARNING: This will delete ALL expenses from the database!');
    console.log('🚀 Proceeding with deletion...');

    // Delete all expenses
    const result = await Expense.deleteMany({});
    console.log(`🗑️  Deleted ${result.deletedCount} expenses`);

    // Verify deletion
    const countAfter = await Expense.countDocuments();
    console.log(`📊 Remaining expenses: ${countAfter}`);

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    console.log('✨ All expenses have been deleted successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the deletion
deleteAllExpenses();