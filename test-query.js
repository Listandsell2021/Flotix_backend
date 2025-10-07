const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://harpreet_db_user:o5AQBpp7RYQQctFV@fleetcluster.hqzrisg.mongodb.net/flotix_test?retryWrites=true&w=majority&appName=FleetCluster')
  .then(async () => {
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');

    console.log('\n🔍 TESTING QUERY: { role: { $nin: ["ADMIN", "SUPER_ADMIN"] } }');
    const query = { role: { $nin: ['ADMIN', 'SUPER_ADMIN'] } };
    const users = await User.find(query).select('email role companyId');

    console.log('\n✅ Query Results:');
    console.log('Found users:', users.length);
    users.forEach(u => {
      console.log('  -', u.email, '| Role:', u.role, '| CompanyId:', u.companyId);
    });

    console.log('\n🔍 ALL USERS IN DATABASE:');
    const allUsers = await User.find({}).select('email role');
    allUsers.forEach(u => {
      console.log('  -', u.email, '| Role:', u.role);
    });

    mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
