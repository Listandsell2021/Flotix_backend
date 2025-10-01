import { connectDB } from '../db/connection';
import mongoose from 'mongoose';

async function checkDateIssue() {
  try {
    await connectDB();
    console.log('\nConnected to MongoDB\n');

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    console.log('Current date:', now.toISOString());
    console.log('This month start:', thisMonth.toISOString());
    console.log('Current month:', now.getMonth() + 1, 'Year:', now.getFullYear());

    console.log('\nNote: The issue is that your system date shows October 2025,');
    console.log('but all expenses are dated in September 2025.');
    console.log('The dashboard query filters for expenses >= October 1, 2025,');
    console.log('so it finds 0 expenses.');

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDateIssue();
