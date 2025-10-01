import { connectDB } from '../db/connection';
import { Expense } from '../models';
import mongoose from 'mongoose';

async function moveExpensesToOctober() {
  try {
    await connectDB();
    console.log('\nConnected to MongoDB\n');

    const now = new Date();
    console.log('Current date:', now.toISOString());

    // Get all expenses
    const allExpenses = await Expense.find();
    console.log(`Total expenses: ${allExpenses.length}`);

    // Update all expenses to October dates (spread them across October 1-30)
    const updates = [];

    for (let i = 0; i < allExpenses.length; i++) {
      // Create dates in October, spread across the month
      const dayInOctober = (i % 30) + 1; // Days 1-30
      const octoberDate = new Date(2025, 9, dayInOctober, 12, 0, 0, 0); // October is month 9 (0-indexed)

      // Make sure it's not in the future
      const safeDate = octoberDate > now
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0)
        : octoberDate;

      updates.push({
        updateOne: {
          filter: { _id: allExpenses[i]._id },
          update: { $set: { date: safeDate } }
        }
      });
    }

    if (updates.length > 0) {
      console.log(`\nUpdating ${updates.length} expenses to October 2025...`);
      const result = await Expense.bulkWrite(updates);
      console.log(`✅ Modified: ${result.modifiedCount}, Matched: ${result.matchedCount}`);
    }

    // Verify
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthExpenses = await Expense.find({ date: { $gte: thisMonth } }).sort({ date: 1 });
    const totalSpend = await Expense.aggregate([
      { $match: { date: { $gte: thisMonth } } },
      { $group: { _id: null, total: { $sum: '$amountFinal' } } }
    ]);

    const fuelVsMisc = await Expense.aggregate([
      { $match: { date: { $gte: thisMonth } } },
      { $group: { _id: '$type', total: { $sum: '$amountFinal' } } }
    ]);

    console.log(`\n=== OCTOBER 2025 EXPENSES ===`);
    console.log(`Count: ${thisMonthExpenses.length}`);
    console.log(`Total spend: €${(totalSpend[0]?.total || 0).toFixed(2)}`);

    console.log('\nBreakdown by type:');
    fuelVsMisc.forEach((item: any) => {
      console.log(`  ${item._id}: €${item.total.toFixed(2)}`);
    });

    console.log(`\nSample expenses:`);
    thisMonthExpenses.slice(0, 5).forEach((exp: any, idx: number) => {
      console.log(`${idx + 1}. ${exp.date.toDateString()} - €${exp.amountFinal} (${exp.type})`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

moveExpensesToOctober();
