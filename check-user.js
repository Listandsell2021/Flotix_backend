const mongoose = require('mongoose');
require('dotenv').config();

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  companyId: mongoose.Schema.Types.ObjectId
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function checkUser() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || 'flotix_test';
    const fullMongoUri = mongoUri.includes('/?')
      ? mongoUri.replace('/?', `/${dbName}?`)
      : mongoUri.replace('?', `/${dbName}?`);

    await mongoose.connect(fullMongoUri);
    console.log(`Connected to: ${dbName}\n`);

    const user = await User.findOne({ email: 'harpreetlistandsell@gmail.com' });
    
    if (user) {
      console.log('User found:');
      console.log('  Name:', user.name);
      console.log('  Email:', user.email);
      console.log('  Role:', user.role);
      console.log('  CompanyId:', user.companyId);
    } else {
      console.log('User harpreetlistandsell@gmail.com NOT found');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();
