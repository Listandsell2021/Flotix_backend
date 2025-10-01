import { connectDB } from '../db/connection';
import { Expense } from '../models';
import mongoose from 'mongoose';

async function updateExpenseDates() {
  try {
    await connectDB();
    console.log('\nConnected to MongoDB\n');

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    console.log('Current date:', now.toISOString());
    console.log('This month start:', thisMonth.toISOString());

    // Get all expenses with dates before this month
    const oldExpenses = await Expense.find({
      date: { $lt: thisMonth }
    });

    console.log(`\nFound ${oldExpenses.length} expenses with dates before this month.`);

    if (oldExpenses.length > 0) {
      console.log('\nUpdating expense dates to this month...\n');

      for (const expense of oldExpenses) {
        const oldDate = new Date(expense.date);

        // Keep the same day of month but update to current month/year
        // If the day doesn't exist in current month (e.g., Sept 31), use last day of month
        const dayOfMonth = Math.min(oldDate.getDate(), new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
        const newDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);

        expense.date = newDate;
        await expense.save();

        console.log(`Updated expense ${expense._id}: ${oldDate.toDateString()} → ${newDate.toDateString()}`);
      }

      console.log(`\n✅ Successfully updated ${oldExpenses.length} expense dates to current month.`);
    } else {
      console.log('\n✅ All expenses are already in the current month.');
    }

    // Show summary
    const thisMonthExpenses = await Expense.countDocuments({ date: { $gte: thisMonth } });
    const totalSpend = await Expense.aggregate([
      { $match: { date: { $gte: thisMonth } } },
      { $group: { _id: null, total: { $sum: '$amountFinal' } } }
    ]);

    console.log(`\n=== SUMMARY ===`);
    console.log(`Expenses this month: ${thisMonthExpenses}`);
    console.log(`Total spend this month: €${totalSpend[0]?.total || 0}`);

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateExpenseDates();
