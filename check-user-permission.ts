import mongoose from 'mongoose';
import { User } from './src/models/User';
import dotenv from 'dotenv';

dotenv.config();

async function checkUserPermission() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || 'flotix_test';
    
    let fullMongoUri;
    if (mongoUri.includes('/?')) {
      fullMongoUri = mongoUri.replace('/?', `/${dbName}?`);
    } else if (mongoUri.includes('?')) {
      fullMongoUri = mongoUri.replace('?', `/${dbName}?`);
    } else if (mongoUri.endsWith('/')) {
      fullMongoUri = `${mongoUri}${dbName}`;
    } else {
      fullMongoUri = `${mongoUri}/${dbName}`;
    }
    
    await mongoose.connect(fullMongoUri);
    console.log('✅ Connected to MongoDB\n');

    const email = 'harpreetlistandsell@gmail.com';
    const user = await User.findOne({ email }).lean();

    if (!user) {
      console.log(`❌ User ${email} not found!`);
      console.log('\n📋 Available admin users:');
      const allUsers = await User.find({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } }).select('email name role status').lean();
      allUsers.forEach(u => {
        console.log(`   - ${u.email} (${u.role}) - Status: ${u.status}`);
      });
    } else {
      console.log('👤 User found:');
      console.log('   Email:', user.email);
      console.log('   Name:', user.name);
      console.log('   Role:', user.role);
      console.log('   Status:', user.status);
      console.log('   Company ID:', user.companyId);
      console.log('   User ID:', user._id);
      
      console.log('\n🎭 Dashboard Endpoint Requirements:');
      console.log('   Required roles: ADMIN, SUPER_ADMIN, MANAGER, or VIEWER');
      console.log('   User role:', user.role);
      
      const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'VIEWER'];
      if (allowedRoles.includes(user.role)) {
        console.log('   ✅ User HAS permission for dashboard');
      } else {
        console.log('   ❌ User DOES NOT have permission for dashboard');
        console.log('   Current role:', user.role);
        console.log('   Allowed roles:', allowedRoles.join(', '));
      }
      
      if (user.status !== 'ACTIVE') {
        console.log('\n   ⚠️ WARNING: User status is', user.status, '(should be ACTIVE)');
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUserPermission();
