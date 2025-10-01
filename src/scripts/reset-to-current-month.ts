import { connectDB } from '../db/connection';
import { Expense } from '../models';
import mongoose from 'mongoose';

async function resetToCurrentMonth() {
  try {
    await connectDB();
    console.log('\n🔄 Resetting expenses to actual current month\n');

    const actualNow = new Date();

    console.log('📅 System Information:');
    console.log('Current date:', actualNow.toISOString());
    console.log('Current local:', actualNow.toString());
    console.log('Month:', actualNow.getMonth() + 1, '(1=Jan, 12=Dec)');
    console.log('Year:', actualNow.getFullYear());

    // Get all expenses
    const allExpenses = await Expense.find();
    console.log(`\n📊 Total expenses in DB: ${allExpenses.length}`);

    // Update all expenses to be within the current actual month
    // Distribute them across the month so far
    const updates = [];
    const currentMonth = actualNow.getMonth();
    const currentYear = actualNow.getFullYear();
    const currentDay = actualNow.getDate();

    console.log(`\n🔧 Distributing ${allExpenses.length} expenses across ${currentMonth + 1}/${currentYear} (days 1-${currentDay})`);

    for (let i = 0; i < allExpenses.length; i++) {
      // Distribute expenses across the days of the current month up to today
      const dayOfMonth = (i % currentDay) + 1; // Days 1 to current day

      // Create date in current month/year
      const newDate = new Date(currentYear, currentMonth, dayOfMonth, 12, 0, 0, 0);

      updates.push({
        updateOne: {
          filter: { _id: allExpenses[i]._id },
          update: { $set: { date: newDate } }
        }
      });
    }

    if (updates.length > 0) {
      const result = await Expense.bulkWrite(updates);
      console.log(`✅ Updated ${result.modifiedCount} expenses`);
    }

    // Verify the results
    const thisMonth = new Date(actualNow.getFullYear(), actualNow.getMonth(), 1);
    const thisMonthExpenses = await Expense.find({ date: { $gte: thisMonth } }).sort({ date: 1 });

    const aggregation = await Expense.aggregate([
      { $match: { date: { $gte: thisMonth } } },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountFinal' },
          count: { $sum: 1 }
        }
      }
    ]);

    const fuelVsMisc = await Expense.aggregate([
      { $match: { date: { $gte: thisMonth } } },
      { $group: { _id: '$type', total: { $sum: '$amountFinal' } } }
    ]);

    const topDrivers = await Expense.aggregate([
      { $match: { date: { $gte: thisMonth } } },
      { $group: { _id: '$driverId', total: { $sum: '$amountFinal' } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'driver' } }
    ]);

    console.log('\n📈 Current Month Dashboard Data:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Month: ${thisMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
    console.log(`Total Expenses: ${aggregation[0]?.count || 0}`);
    console.log(`Total Spend: €${(aggregation[0]?.total || 0).toFixed(2)}`);

    console.log('\n💰 Breakdown by Type:');
    fuelVsMisc.forEach((item: any) => {
      const percentage = aggregation[0]?.total > 0
        ? ((item.total / aggregation[0].total) * 100).toFixed(1)
        : 0;
      console.log(`  ${item._id}: €${item.total.toFixed(2)} (${percentage}%)`);
    });

    console.log('\n👥 Top Drivers:');
    topDrivers.forEach((driver: any, idx: number) => {
      const driverName = driver.driver[0]?.name || 'Unknown';
      console.log(`  ${idx + 1}. ${driverName}: €${driver.total.toFixed(2)}`);
    });

    console.log('\n📋 Sample Expenses (first 5):');
    thisMonthExpenses.slice(0, 5).forEach((exp: any, idx: number) => {
      console.log(`  ${idx + 1}. ${exp.date.toLocaleDateString()} - €${exp.amountFinal} (${exp.type})`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    console.log('\n🎉 Done! Dashboard should now show current month data.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetToCurrentMonth();
