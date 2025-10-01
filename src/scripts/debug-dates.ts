import { connectDB } from '../db/connection';
import { Expense } from '../models';
import mongoose from 'mongoose';

async function debugDates() {
  try {
    await connectDB();
    console.log('\nConnected to MongoDB\n');

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    console.log('Now:', now.toISOString(), '|', now.toString());
    console.log('This month:', thisMonth.toISOString(), '|', thisMonth.toString());

    // Get ALL expenses and show their dates
    const allExpenses = await Expense.find().sort({ date: -1 });
    console.log(`\n=== ALL EXPENSES (${allExpenses.length}) ===`);

    allExpenses.forEach((exp: any, idx: number) => {
      const isThisMonth = exp.date >= thisMonth;
      console.log(`${idx + 1}. ${exp._id}`);
      console.log(`   Date: ${exp.date.toISOString()} | ${exp.date.toString()}`);
      console.log(`   Amount: €${exp.amountFinal}, Type: ${exp.type}`);
      console.log(`   Is this month? ${isThisMonth ? '✅ YES' : '❌ NO'}`);
      console.log('');
    });

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugDates();
