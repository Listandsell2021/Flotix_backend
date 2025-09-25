const authRoutes = require('./auth');
const userRoutes = require('./users');
const companyRoutes = require('./companies');
const vehicleRoutes = require('./vehicles');
const expenseRoutes = require('./expenses');
const reportRoutes = require('./reports');
const auditRoutes = require('./audit');
const roleRoutes = require('./roles');

module.exports = {
  authRoutes,
  userRoutes,
  companyRoutes,
  vehicleRoutes,
  expenseRoutes,
  reportRoutes,
  auditRoutes,
  roleRoutes,
};