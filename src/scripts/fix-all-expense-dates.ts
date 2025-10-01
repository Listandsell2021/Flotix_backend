import { connectDB } from '../db/connection';
import { Expense } from '../models';
import mongoose from 'mongoose';

async function fixAllExpenseDates() {
  try {
    await connectDB();
    console.log('\nConnected to MongoDB\n');

    const now = new Date();
    console.log('Current date:', now.toISOString());
    console.log('Current local date:', now.toString());

    // Get all expenses
    const allExpenses = await Expense.find();
    console.log(`\nTotal expenses in database: ${allExpenses.length}`);

    // Update all expenses to have dates within the last 30 days
    const updates = [];

    for (let i = 0; i < allExpenses.length; i++) {
      // Create dates spread over the last 30 days
      const daysAgo = Math.floor(Math.random() * 25); // Random days between 0-24 days ago
      const newDate = new Date();
      newDate.setDate(newDate.getDate() - daysAgo);
      newDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues

      updates.push({
        updateOne: {
          filter: { _id: allExpenses[i]._id },
          update: { $set: { date: newDate } }
        }
      });
    }

    if (updates.length > 0) {
      console.log(`\nUpdating ${updates.length} expenses to dates within the last 30 days...`);
      const result = await Expense.bulkWrite(updates);
      console.log(`✅ Updated ${result.modifiedCount} expenses`);
    }

    // Verify the update - check for this month
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthExpenses = await Expense.countDocuments({ date: { $gte: thisMonth } });
    const totalSpend = await Expense.aggregate([
      { $match: { date: { $gte: thisMonth } } },
      { $group: { _id: null, total: { $sum: '$amountFinal' } } }
    ]);

    const fuelVsMisc = await Expense.aggregate([
      { $match: { date: { $gte: thisMonth } } },
      { $group: { _id: '$type', total: { $sum: '$amountFinal' } } }
    ]);

    console.log(`\n=== VERIFICATION ===`);
    console.log(`This month start: ${thisMonth.toISOString()}`);
    console.log(`Expenses this month: ${thisMonthExpenses}`);
    console.log(`Total spend this month: €${(totalSpend[0]?.total || 0).toFixed(2)}`);

    console.log('\nFuel vs Misc breakdown:');
    fuelVsMisc.forEach((item: any) => {
      console.log(`  ${item._id}: €${item.total.toFixed(2)}`);
    });

    // Show all updated expenses
    const allUpdatedExpenses = await Expense.find({ date: { $gte: thisMonth } })
      .sort({ date: -1 });

    console.log(`\nAll expenses this month (${allUpdatedExpenses.length}):`);
    allUpdatedExpenses.forEach((exp: any, idx: number) => {
      console.log(`${idx + 1}. Date: ${exp.date.toISOString()}, Amount: €${exp.amountFinal}, Type: ${exp.type}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAllExpenseDates();
