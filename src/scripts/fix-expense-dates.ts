import { connectDB } from '../db/connection';
import { Expense } from '../models';
import mongoose from 'mongoose';

async function fixExpenseDates() {
  try {
    await connectDB();
    console.log('\nConnected to MongoDB\n');

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    console.log('Current date:', now.toISOString());
    console.log('This month start:', thisMonth.toISOString());

    // Get all expenses
    const allExpenses = await Expense.find();
    console.log(`\nTotal expenses in database: ${allExpenses.length}`);

    // Update all expenses to have dates within this month (spread throughout the month)
    const updates = [];
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    for (let i = 0; i < allExpenses.length; i++) {
      const expense = allExpenses[i];

      // Spread expenses throughout the month
      const dayOfMonth = Math.min((i % daysInMonth) + 1, daysInMonth);
      const newDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);

      // Make sure it's not in the future
      const safeDate = newDate > now ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : newDate;

      updates.push({
        updateOne: {
          filter: { _id: expense._id },
          update: { $set: { date: safeDate } }
        }
      });
    }

    if (updates.length > 0) {
      console.log(`\nUpdating ${updates.length} expenses to current month using bulk operation...`);
      const result = await Expense.bulkWrite(updates);
      console.log(`✅ Updated ${result.modifiedCount} expenses`);
    }

    // Verify the update
    const thisMonthExpenses = await Expense.countDocuments({ date: { $gte: thisMonth } });
    const totalSpend = await Expense.aggregate([
      { $match: { date: { $gte: thisMonth } } },
      { $group: { _id: null, total: { $sum: '$amountFinal' } } }
    ]);

    console.log(`\n=== VERIFICATION ===`);
    console.log(`Expenses this month: ${thisMonthExpenses}`);
    console.log(`Total spend this month: €${(totalSpend[0]?.total || 0).toFixed(2)}`);

    // Show sample updated expenses
    const sampleExpenses = await Expense.find({ date: { $gte: thisMonth } })
      .limit(3)
      .sort({ date: -1 });

    console.log('\nSample updated expenses:');
    sampleExpenses.forEach((exp: any, idx: number) => {
      console.log(`${idx + 1}. Date: ${exp.date.toDateString()}, Amount: €${exp.amountFinal}, Type: ${exp.type}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixExpenseDates();
