const mongoose = require('mongoose');
require('dotenv').config();

// Role Schema
const RoleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    match: /^[A-Z_]+$/
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  permissions: [{
    type: String,
    enum: [
      'COMPANY_CREATE', 'COMPANY_READ', 'COMPANY_UPDATE', 'COMPANY_DELETE',
      'USER_CREATE', 'USER_READ', 'USER_UPDATE', 'USER_DELETE', 'USER_ASSIGN_ROLE',
      'DRIVER_CREATE', 'DRIVER_READ', 'DRIVER_UPDATE', 'DRIVER_DELETE',
      'VEHICLE_CREATE', 'VEHICLE_READ', 'VEHICLE_UPDATE', 'VEHICLE_DELETE', 'VEHICLE_ASSIGN',
      'EXPENSE_CREATE', 'EXPENSE_READ', 'EXPENSE_UPDATE', 'EXPENSE_DELETE', 'EXPENSE_APPROVE', 'EXPENSE_EXPORT',
      'REPORT_VIEW', 'REPORT_EXPORT', 'DASHBOARD_VIEW',
      'SYSTEM_SETTINGS', 'AUDIT_LOG_VIEW', 'ROLE_MANAGEMENT'
    ],
    required: true
  }],
  isSystem: {
    type: Boolean,
    default: false
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: false
  }
}, { timestamps: true });

const Role = mongoose.model('Role', RoleSchema);

// Define basic system roles
const systemRoles = [
  {
    name: 'SUPER_ADMIN',
    displayName: 'Super Administrator',
    description: 'Full system access - manages all companies, admins, and system settings',
    permissions: [
      'COMPANY_CREATE', 'COMPANY_READ', 'COMPANY_UPDATE', 'COMPANY_DELETE',
      'USER_CREATE', 'USER_READ', 'USER_UPDATE', 'USER_DELETE', 'USER_ASSIGN_ROLE',
      'DRIVER_CREATE', 'DRIVER_READ', 'DRIVER_UPDATE', 'DRIVER_DELETE',
      'VEHICLE_CREATE', 'VEHICLE_READ', 'VEHICLE_UPDATE', 'VEHICLE_DELETE', 'VEHICLE_ASSIGN',
      'EXPENSE_CREATE', 'EXPENSE_READ', 'EXPENSE_UPDATE', 'EXPENSE_DELETE', 'EXPENSE_APPROVE', 'EXPENSE_EXPORT',
      'REPORT_VIEW', 'REPORT_EXPORT', 'DASHBOARD_VIEW',
      'SYSTEM_SETTINGS', 'AUDIT_LOG_VIEW', 'ROLE_MANAGEMENT'
    ],
    isSystem: true,
    companyId: null
  },
  {
    name: 'ADMIN',
    displayName: 'Company Administrator',
    description: 'Manages company operations - drivers, vehicles, and expenses within their company',
    permissions: [
      'USER_READ', 'USER_UPDATE',
      'DRIVER_CREATE', 'DRIVER_READ', 'DRIVER_UPDATE', 'DRIVER_DELETE',
      'VEHICLE_CREATE', 'VEHICLE_READ', 'VEHICLE_UPDATE', 'VEHICLE_DELETE', 'VEHICLE_ASSIGN',
      'EXPENSE_READ', 'EXPENSE_UPDATE', 'EXPENSE_APPROVE', 'EXPENSE_EXPORT',
      'REPORT_VIEW', 'REPORT_EXPORT', 'DASHBOARD_VIEW',
      'AUDIT_LOG_VIEW'
    ],
    isSystem: true,
    companyId: null
  },
  {
    name: 'MANAGER',
    displayName: 'Fleet Manager',
    description: 'Manages vehicles and monitors driver expenses',
    permissions: [
      'DRIVER_READ',
      'VEHICLE_CREATE', 'VEHICLE_READ', 'VEHICLE_UPDATE', 'VEHICLE_ASSIGN',
      'EXPENSE_READ', 'EXPENSE_APPROVE',
      'REPORT_VIEW', 'DASHBOARD_VIEW'
    ],
    isSystem: true,
    companyId: null
  },
  {
    name: 'VIEWER',
    displayName: 'Report Viewer',
    description: 'View-only access to reports and dashboards',
    permissions: [
      'DRIVER_READ',
      'VEHICLE_READ',
      'EXPENSE_READ',
      'REPORT_VIEW', 'DASHBOARD_VIEW'
    ],
    isSystem: true,
    companyId: null
  },
  {
    name: 'DRIVER',
    displayName: 'Driver',
    description: 'Mobile app access - can create and manage own expenses',
    permissions: [
      'EXPENSE_CREATE', 'EXPENSE_READ', 'EXPENSE_UPDATE',
      'VEHICLE_READ'
    ],
    isSystem: true,
    companyId: null
  }
];

async function seedRoles(dbName) {
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

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const roleData of systemRoles) {
      const existingRole = await Role.findOne({ name: roleData.name });

      if (existingRole) {
        // Update existing role with new permissions
        existingRole.displayName = roleData.displayName;
        existingRole.description = roleData.description;
        existingRole.permissions = roleData.permissions;
        existingRole.isSystem = roleData.isSystem;
        await existingRole.save();
        console.log(`   ✏️  Updated: ${roleData.displayName} (${roleData.name})`);
        updatedCount++;
      } else {
        // Create new role
        const role = new Role(roleData);
        await role.save();
        console.log(`   ✅ Created: ${roleData.displayName} (${roleData.name})`);
        createdCount++;
      }
    }

    console.log(`\n📊 Summary for ${dbName}:`);
    console.log(`   ✅ Created: ${createdCount} roles`);
    console.log(`   ✏️  Updated: ${updatedCount} roles`);
    console.log(`   📝 Total system roles: ${systemRoles.length}`);

    await mongoose.disconnect();
    console.log(`🔌 Disconnected from ${dbName}\n`);

  } catch (error) {
    console.error(`❌ Error in ${dbName}:`, error.message);
    await mongoose.disconnect();
    throw error;
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('Seeding Basic System Roles in Both Databases');
  console.log('='.repeat(70));

  try {
    // Seed roles in flotix_test
    await seedRoles('flotix_test');

    // Seed roles in flotix_live
    await seedRoles('flotix_live');

    console.log('='.repeat(70));
    console.log('✅ System Roles Created Successfully in Both Databases!');
    console.log('='.repeat(70));
    console.log('\nRoles Created:');
    console.log('  1. SUPER_ADMIN - Full system access');
    console.log('  2. ADMIN - Company administrator');
    console.log('  3. MANAGER - Fleet manager');
    console.log('  4. VIEWER - Report viewer');
    console.log('  5. DRIVER - Mobile app user');
    console.log('\nDatabases Updated:');
    console.log('  - flotix_test');
    console.log('  - flotix_live');
    console.log('='.repeat(70) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to seed roles:', error);
    process.exit(1);
  }
}

main();
