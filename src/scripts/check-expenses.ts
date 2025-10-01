import { connectDB } from '../db/connection';
import { Expense, User, Company } from '../models';
import mongoose from 'mongoose';

async function checkExpenses() {
  try {
    await connectDB();
    console.log('\nConnected to MongoDB\n');

    // Count total expenses
    const totalExpenses = await Expense.countDocuments();
    console.log(`=== EXPENSES IN DATABASE ===`);
    console.log(`Total expenses: ${totalExpenses}\n`);

    if (totalExpenses > 0) {
      // Get sample expenses
      const sampleExpenses = await Expense.find()
        .populate('driverId', 'name email')
        .populate('companyId', 'name')
        .sort({ createdAt: -1 })
        .limit(5);

      console.log('Sample expenses:');
      sampleExpenses.forEach((expense: any, idx: number) => {
        console.log(`\n${idx + 1}. Expense ID: ${expense._id}`);
        console.log(`   Driver: ${expense.driverId?.name || 'Unknown'} (${expense.driverId?.email || 'N/A'})`);
        console.log(`   Company: ${expense.companyId?.name || 'Unknown'}`);
        console.log(`   Amount: €${expense.amountFinal}`);
        console.log(`   Type: ${expense.type}`);
        console.log(`   Date: ${expense.date}`);
        console.log(`   Created: ${expense.createdAt}`);
      });

      // Get expenses by month
      const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const expensesThisMonth = await Expense.countDocuments({ date: { $gte: thisMonth } });
      console.log(`\n\nExpenses this month: ${expensesThisMonth}`);

      // Get total spend this month
      const totalSpend = await Expense.aggregate([
        { $match: { date: { $gte: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$amountFinal' } } }
      ]);
      console.log(`Total spend this month: €${totalSpend[0]?.total || 0}`);
    }

    // Check companies
    const companies = await Company.find();
    console.log(`\n\n=== COMPANIES ===`);
    console.log(`Total companies: ${companies.length}`);
    companies.forEach((company: any) => {
      console.log(`- ${company.name} (ID: ${company._id})`);
    });

    await mongoose.connection.close();
    console.log('\n\nDatabase connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkExpenses();
