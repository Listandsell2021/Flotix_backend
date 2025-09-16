import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '../models/User';

async function testLogin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fleetflow');
    console.log('Connected to MongoDB');
    
    const user = await User.findOne({ email: 'admin@fleetflow.com' });
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', user.email);
    
    // Test password comparison
    const testPassword = 'password123';
    const isMatch = await user.comparePassword(testPassword);
    console.log('Password test result:', isMatch);
    
    // Also test bcrypt directly
    const directCompare = await bcrypt.compare(testPassword, user.passwordHash);
    console.log('Direct bcrypt test:', directCompare);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testLogin();