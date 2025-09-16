import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../models/User';

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fleetflow');
    console.log('Connected to MongoDB');
    
    const users = await User.find({}, 'name email role');
    console.log('\n=== USERS IN DATABASE ===');
    if (users.length === 0) {
      console.log('No users found in database');
    } else {
      users.forEach(user => {
        console.log(`- ${user.email} (${user.role})`);
      });
    }
    console.log('========================\n');
    
    // Check specific user
    const admin = await User.findOne({ email: 'admin@fleetflow.com' });
    if (admin) {
      console.log('✅ Super admin user found');
      console.log('Name:', admin.name);
      console.log('Email:', admin.email);
      console.log('Role:', admin.role);
    } else {
      console.log('❌ Super admin user NOT found');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUsers();