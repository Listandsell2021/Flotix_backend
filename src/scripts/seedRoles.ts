import mongoose from 'mongoose';
import { config, validateConfig } from '../config';
import { Role } from '../models/Role';
import { Permission, UserRole } from '@fleetflow/types';

validateConfig();

const DEFAULT_ROLES = [
  {
    name: 'SYSTEM_SUPER_ADMIN',
    displayName: 'System Super Admin',
    description: 'Full system access with all permissions',
    permissions: Object.values(Permission),
    isSystem: true,
    userRole: UserRole.SUPER_ADMIN
  },
  {
    name: 'SYSTEM_ADMIN',
    displayName: 'System Admin',
    description: 'Company administrator with full company management permissions',
    permissions: [
      Permission.COMPANY_READ,
      Permission.COMPANY_UPDATE,
      Permission.USER_CREATE,
      Permission.USER_READ,
      Permission.USER_UPDATE,
      Permission.USER_DELETE,
      Permission.USER_ASSIGN_ROLE,
      Permission.DRIVER_CREATE,
      Permission.DRIVER_READ,
      Permission.DRIVER_UPDATE,
      Permission.DRIVER_DELETE,
      Permission.VEHICLE_CREATE,
      Permission.VEHICLE_READ,
      Permission.VEHICLE_UPDATE,
      Permission.VEHICLE_DELETE,
      Permission.VEHICLE_ASSIGN,
      Permission.EXPENSE_CREATE,
      Permission.EXPENSE_READ,
      Permission.EXPENSE_UPDATE,
      Permission.EXPENSE_DELETE,
      Permission.EXPENSE_APPROVE,
      Permission.EXPENSE_EXPORT,
      Permission.REPORT_VIEW,
      Permission.REPORT_EXPORT,
      Permission.DASHBOARD_VIEW,
      Permission.AUDIT_LOG_VIEW,
      Permission.ROLE_MANAGEMENT
    ],
    isSystem: true,
    userRole: UserRole.ADMIN
  },
  {
    name: 'SYSTEM_MANAGER',
    displayName: 'System Manager',
    description: 'Fleet manager with driver and vehicle management permissions',
    permissions: [
      Permission.DRIVER_READ,
      Permission.DRIVER_UPDATE,
      Permission.VEHICLE_READ,
      Permission.VEHICLE_UPDATE,
      Permission.VEHICLE_ASSIGN,
      Permission.EXPENSE_READ,
      Permission.EXPENSE_APPROVE,
      Permission.EXPENSE_EXPORT,
      Permission.REPORT_VIEW,
      Permission.REPORT_EXPORT,
      Permission.DASHBOARD_VIEW
    ],
    isSystem: true,
    userRole: UserRole.MANAGER
  },
  {
    name: 'SYSTEM_VIEWER',
    displayName: 'System Viewer',
    description: 'Read-only access to fleet data and reports',
    permissions: [
      Permission.DRIVER_READ,
      Permission.VEHICLE_READ,
      Permission.EXPENSE_READ,
      Permission.REPORT_VIEW,
      Permission.DASHBOARD_VIEW
    ],
    isSystem: true,
    userRole: UserRole.VIEWER
  },
  {
    name: 'SYSTEM_DRIVER',
    displayName: 'System Driver',
    description: 'Driver with expense management permissions',
    permissions: [
      Permission.EXPENSE_CREATE,
      Permission.EXPENSE_READ,
      Permission.EXPENSE_UPDATE,
      Permission.EXPENSE_DELETE,
      Permission.VEHICLE_READ
    ],
    isSystem: true,
    userRole: UserRole.DRIVER
  }
];

async function seedRoles() {
  try {
    console.log('🌱 Connecting to database...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to database');

    console.log('🔄 Seeding default system roles...');
    
    for (const roleData of DEFAULT_ROLES) {
      const existingRole = await Role.findOne({ name: roleData.name });
      
      if (existingRole) {
        console.log(`⚠️  Role ${roleData.name} already exists, updating permissions...`);
        
        existingRole.permissions = roleData.permissions;
        existingRole.displayName = roleData.displayName;
        existingRole.description = roleData.description;
        await existingRole.save();
        
        console.log(`✅ Updated role: ${roleData.displayName}`);
      } else {
        const newRole = new Role({
          name: roleData.name,
          displayName: roleData.displayName,
          description: roleData.description,
          permissions: roleData.permissions,
          isSystem: roleData.isSystem
        });
        
        await newRole.save();
        console.log(`✅ Created role: ${roleData.displayName}`);
      }
    }

    console.log('🎉 Default roles seeded successfully!');
    console.log(`📊 Total system roles: ${DEFAULT_ROLES.length}`);
    
    const allRoles = await Role.find({ isSystem: true });
    console.log('📋 System roles in database:');
    allRoles.forEach(role => {
      console.log(`   - ${role.displayName} (${role.permissions.length} permissions)`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding roles:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  }
}

if (require.main === module) {
  seedRoles();
}

export { seedRoles };