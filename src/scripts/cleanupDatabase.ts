import { connectDB } from '../db/connection';
import { User, Company, Vehicle, Expense, AuditLog, RoleAssignment } from '../models';

async function cleanupDatabase() {
  try {
    console.log('🔗 Connecting to database...');
    await connectDB();
    console.log('✅ Connected to MongoDB');

    // Step 1: Delete all expenses
    console.log('\n🗑️  Deleting all expenses...');
    const expenseResult = await Expense.deleteMany({});
    console.log(`✅ Deleted ${expenseResult.deletedCount} expenses`);

    // Step 2: Delete all audit logs
    console.log('\n🗑️  Deleting all audit logs...');
    const auditResult = await AuditLog.deleteMany({});
    console.log(`✅ Deleted ${auditResult.deletedCount} audit logs`);

    // Step 3: Delete all vehicles
    console.log('\n🗑️  Deleting all vehicles...');
    const vehicleResult = await Vehicle.deleteMany({});
    console.log(`✅ Deleted ${vehicleResult.deletedCount} vehicles`);

    // Step 4: Delete all role assignments
    console.log('\n🗑️  Deleting all role assignments...');
    const roleAssignmentResult = await RoleAssignment.deleteMany({});
    console.log(`✅ Deleted ${roleAssignmentResult.deletedCount} role assignments`);

    // Step 5: Delete all driver users (keep only ADMIN and SUPER_ADMIN)
    console.log('\n🗑️  Deleting all driver users...');
    const driverResult = await User.deleteMany({
      role: { $nin: ['ADMIN', 'SUPER_ADMIN'] }
    });
    console.log(`✅ Deleted ${driverResult.deletedCount} driver/manager/viewer users`);

    // Step 6: Show remaining users
    console.log('\n👥 Remaining users:');
    const remainingUsers = await User.find({}, 'name email role companyId').populate('companyId', 'name');
    remainingUsers.forEach(user => {
      const company = user.companyId ? (user.companyId as any).name : 'No Company';
      console.log(`   - ${user.name} (${user.email}) - ${user.role} - ${company}`);
    });

    // Step 7: Show remaining companies
    console.log('\n🏢 Remaining companies:');
    const remainingCompanies = await Company.find({}, 'name status plan');
    remainingCompanies.forEach(company => {
      console.log(`   - ${company.name} - ${company.status} - ${company.plan}`);
    });

    console.log('\n🎉 Database cleanup completed successfully!');
    console.log('\nSummary:');
    console.log(`   • Expenses deleted: ${expenseResult.deletedCount}`);
    console.log(`   • Audit logs deleted: ${auditResult.deletedCount}`);
    console.log(`   • Vehicles deleted: ${vehicleResult.deletedCount}`);
    console.log(`   • Role assignments deleted: ${roleAssignmentResult.deletedCount}`);
    console.log(`   • Driver/Manager/Viewer users deleted: ${driverResult.deletedCount}`);
    console.log(`   • Admin/Super Admin users remaining: ${remainingUsers.length}`);
    console.log(`   • Companies remaining: ${remainingCompanies.length}`);

  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
  } finally {
    process.exit(0);
  }
}

// Run the cleanup
cleanupDatabase();