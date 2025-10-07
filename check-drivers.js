const mongoose = require('mongoose');
require('dotenv').config();

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  companyId: mongoose.Schema.Types.ObjectId,
  status: String
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function checkDrivers() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || 'flotix_test';
    const fullMongoUri = mongoUri.includes('/?')
      ? mongoUri.replace('/?', `/${dbName}?`)
      : mongoUri.replace('?', `/${dbName}?`);

    await mongoose.connect(fullMongoUri);
    console.log(`\nConnected to: ${dbName}\n`);

    const allUsers = await User.find({});
    
    console.log('ALL USERS IN DATABASE:');
    console.log('='.repeat(60));
    
    allUsers.forEach(user => {
      console.log(`Name: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.role}`);
      console.log(`CompanyId: ${user.companyId}`);
      console.log(`Status: ${user.status || 'ACTIVE'}`);
      console.log('-'.repeat(60));
    });

    const drivers = allUsers.filter(u => u.role === 'DRIVER');
    const admins = allUsers.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN');
    const others = allUsers.filter(u => u.role !== 'DRIVER' && u.role !== 'ADMIN' && u.role !== 'SUPER_ADMIN');

    console.log('\nSUMMARY:');
    console.log(`Total Users: ${allUsers.length}`);
    console.log(`Drivers: ${drivers.length}`);
    console.log(`Admins: ${admins.length}`);
    console.log(`Others (MANAGER/VIEWER): ${others.length}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDrivers();
