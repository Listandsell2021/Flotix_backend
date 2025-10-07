require('dotenv').config();
const mongoose = require('mongoose');

async function cleanupDuplicates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const SmtpSettings = mongoose.model('SmtpSettings', new mongoose.Schema({}, { strict: false }));

    // Get all SMTP settings
    const allSettings = await SmtpSettings.find({});
    console.log(`📊 Found ${allSettings.length} SMTP settings documents`);

    if (allSettings.length > 1) {
      // Keep the most recent one, delete the rest
      const sortedSettings = allSettings.sort((a, b) =>
        new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
      );

      const toKeep = sortedSettings[0];
      const toDelete = sortedSettings.slice(1);

      console.log(`🔒 Keeping most recent: ${toKeep._id}`);
      console.log(`🗑️  Deleting ${toDelete.length} duplicate(s)...`);

      // Delete duplicates
      for (const doc of toDelete) {
        await SmtpSettings.deleteOne({ _id: doc._id });
        console.log(`   ✅ Deleted: ${doc._id}`);
      }

      // Ensure the kept one is active
      await SmtpSettings.updateOne({ _id: toKeep._id }, { isActive: true });
      console.log('✅ Cleanup complete! Only one SMTP settings document remains.');
    } else if (allSettings.length === 1) {
      console.log('✅ Only one SMTP settings document found - no cleanup needed');
    } else {
      console.log('ℹ️  No SMTP settings found');
    }

    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanupDuplicates();
