import { connectDB } from '../db/connection';
import { Expense, User } from '../models';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

async function testDashboardApi() {
  try {
    await connectDB();
    console.log('\n🔍 Testing Dashboard API Logic\n');

    // Find an admin user
    const adminUser = await User.findOne({ role: 'ADMIN' }).populate('companyId');
    if (!adminUser) {
      console.log('❌ No ADMIN user found');
      return;
    }

    console.log('👤 Admin User:');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Company: ${(adminUser as any).companyId?.name || 'N/A'}`);
    console.log(`   Company ID: ${adminUser.companyId}`);

    // Simulate the dashboard query
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    console.log('\n📅 Date Information:');
    console.log(`   Now: ${now.toISOString()}`);
    console.log(`   This Month: ${thisMonth.toISOString()}`);
    console.log(`   Last Month: ${lastMonth.toISOString()}`);

    // Build query for this company
    const baseQuery = { companyId: new mongoose.Types.ObjectId(adminUser.companyId as any) };

    console.log('\n📊 Running Dashboard Queries...\n');

    // Total spend this month
    const totalSpendThisMonth = await Expense.aggregate([
      { $match: { ...baseQuery, date: { $gte: thisMonth } } },
      { $group: { _id: null, total: { $sum: '$amountFinal' } } }
    ]);

    // Last month spend
    const lastMonthSpend = await Expense.aggregate([
      { $match: { ...baseQuery, date: { $gte: lastMonth, $lt: thisMonth } } },
      { $group: { _id: null, total: { $sum: '$amountFinal' } } }
    ]);

    // Fuel vs Misc
    const fuelVsMiscSplit = await Expense.aggregate([
      { $match: { ...baseQuery, date: { $gte: thisMonth } } },
      { $group: { _id: '$type', total: { $sum: '$amountFinal' } } }
    ]);

    // Top Drivers
    const topDrivers = await Expense.aggregate([
      { $match: { ...baseQuery, date: { $gte: thisMonth } } },
      { $group: { _id: '$driverId', total: { $sum: '$amountFinal' } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'driver' } }
    ]);

    const currentTotal = totalSpendThisMonth[0]?.total || 0;
    const previousTotal = lastMonthSpend[0]?.total || 0;
    const percentageChange = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

    const fuelTotal = fuelVsMiscSplit.find(item => item._id === 'FUEL')?.total || 0;
    const miscTotal = fuelVsMiscSplit.find(item => item._id === 'MISC')?.total || 0;

    console.log('📈 DASHBOARD KPIs:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`💰 Total Spend This Month: €${currentTotal.toFixed(2)}`);
    console.log(`📊 Last Month Spend: €${previousTotal.toFixed(2)}`);
    console.log(`📈 Month-over-Month Change: ${percentageChange > 0 ? '+' : ''}${percentageChange.toFixed(2)}%`);
    console.log('');
    console.log(`⛽ Fuel: €${fuelTotal.toFixed(2)}`);
    console.log(`📋 Misc: €${miscTotal.toFixed(2)}`);
    console.log('');
    console.log(`👥 Top Drivers (${topDrivers.length}):`);
    topDrivers.forEach((driver: any, idx: number) => {
      const driverName = driver.driver[0]?.name || 'Unknown';
      console.log(`   ${idx + 1}. ${driverName}: €${driver.total.toFixed(2)}`);
    });

    console.log('\n✅ Dashboard query successful!');
    console.log('\nIf the frontend shows 0, the issue is likely:');
    console.log('  1. Frontend not connected to backend API');
    console.log('  2. Authentication token issue');
    console.log('  3. Frontend needs restart after .env change');

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testDashboardApi();
