const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

// User Schema (simplified version matching your model)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['SUPER_ADMIN', 'ADMIN', 'DRIVER', 'MANAGER', 'VIEWER'], required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createSuperAdmin(dbName) {
  try {
    // Build MongoDB URI with database name
    const mongoUri = process.env.MONGODB_URI;
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

    console.log(`\n🔗 Connecting to database: ${dbName}...`);
    await mongoose.connect(fullMongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ Connected to ${dbName}`);

    // Check if super admin already exists
    const existingUser = await User.findOne({
      email: 'admin@listandsell.de',
      role: 'SUPER_ADMIN'
    });

    if (existingUser) {
      console.log(`⚠️  Super Admin already exists in ${dbName}`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Name: ${existingUser.name}`);
      console.log(`   Status: ${existingUser.status}`);

      // Update password if user wants
      const hashedPassword = await bcrypt.hash('123456', 12);
      existingUser.passwordHash = hashedPassword;
      existingUser.status = 'ACTIVE';
      await existingUser.save();
      console.log(`✅ Password updated for existing user in ${dbName}`);
    } else {
      // Create new super admin
      const hashedPassword = await bcrypt.hash('123456', 12);

      const superAdmin = new User({
        name: 'Super Admin',
        email: 'admin@listandsell.de',
        passwordHash: hashedPassword,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        companyId: undefined // Super admin has no company
      });

      await superAdmin.save();
      console.log(`✅ Super Admin created successfully in ${dbName}`);
      console.log(`   Email: admin@listandsell.de`);
      console.log(`   Password: 123456`);
      console.log(`   Role: SUPER_ADMIN`);
    }

    await mongoose.disconnect();
    console.log(`🔌 Disconnected from ${dbName}\n`);

  } catch (error) {
    console.error(`❌ Error in ${dbName}:`, error.message);
    await mongoose.disconnect();
    throw error;
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('Creating Super Admin User in Both Databases');
  console.log('='.repeat(60));

  try {
    // Create super admin in flotix_test
    await createSuperAdmin('flotix_test');

    // Create super admin in flotix_live
    await createSuperAdmin('flotix_live');

    console.log('='.repeat(60));
    console.log('✅ Super Admin created in both databases successfully!');
    console.log('='.repeat(60));
    console.log('\nLogin Credentials:');
    console.log('  Email: admin@listandsell.de');
    console.log('  Password: 123456');
    console.log('  Role: SUPER_ADMIN');
    console.log('\nDatabases Updated:');
    console.log('  - flotix_test');
    console.log('  - flotix_live');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to create super admin:', error);
    process.exit(1);
  }
}

main();
