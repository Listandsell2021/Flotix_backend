const express = require('express');
const mongoose = require('mongoose');
const { User, Vehicle, Expense } = require('../models');
const { asyncHandler, authenticate, checkRole, checkCompanyAccess } = require('../middleware');

const router = express.Router();

// GET /api/reports/dashboard
router.get('/dashboard', authenticate, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), checkCompanyAccess, asyncHandler(async (req, res) => {
  const { role, companyId: userCompanyId } = req.user;

  console.log('🔍 DASHBOARD REQUEST:', {
    role,
    userCompanyId,
    queryCompanyId: req.query.companyId,
    timestamp: new Date().toISOString()
  });

  let companyId;
  if (role === 'SUPER_ADMIN' && req.query.companyId) {
    companyId = req.query.companyId;
  } else {
    companyId = userCompanyId;
  }

  console.log('🏢 Using companyId:', companyId);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const currentMonthExpenses = await Expense.find({
    companyId,
    date: { $gte: startOfMonth },
  });

  const lastMonthExpenses = await Expense.find({
    companyId,
    date: { $gte: startOfLastMonth, $lte: endOfLastMonth },
  });

  const totalDrivers = await User.countDocuments({ companyId, role: 'DRIVER' });
  const totalVehicles = await Vehicle.countDocuments({ companyId });

  const currentMonthTotal = currentMonthExpenses.reduce((sum, exp) => sum + (exp.amountFinal || 0), 0);
  const lastMonthTotal = lastMonthExpenses.reduce((sum, exp) => sum + (exp.amountFinal || 0), 0);

  const monthlyGrowth = lastMonthTotal > 0 ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;

  const expensesByType = currentMonthExpenses.reduce((acc, exp) => {
    acc[exp.type] = (acc[exp.type] || 0) + (exp.amountFinal || 0);
    return acc;
  }, {});

  const topDrivers = await Expense.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), date: { $gte: startOfMonth } } },
    { $group: { _id: '$driverId', totalSpent: { $sum: '$amountFinal' }, expenseCount: { $sum: 1 } } },
    { $sort: { totalSpent: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'driver' } },
    { $unwind: '$driver' },
    { $project: { driverName: '$driver.name', totalSpent: 1, expenseCount: 1 } },
  ]);

  console.log('📊 DASHBOARD DATA:', {
    currentMonthExpenses: currentMonthExpenses.length,
    lastMonthExpenses: lastMonthExpenses.length,
    totalDrivers,
    totalVehicles,
    currentMonthTotal,
    lastMonthTotal,
    monthlyGrowth,
    expensesByType,
    topDriversCount: topDrivers.length
  });

  const responseData = {
    success: true,
    data: {
      totalSpendThisMonth: currentMonthTotal,
      fuelVsMiscSplit: {
        fuel: expensesByType['FUEL'] || 0,
        misc: expensesByType['MISC'] || 0,
      },
      topDriversBySpend: topDrivers.map(driver => ({
        driverId: driver._id.toString(),
        driverName: driver.driverName,
        totalSpend: driver.totalSpent,
      })),
      monthOverMonthTrend: {
        currentMonth: currentMonthTotal,
        previousMonth: lastMonthTotal,
        percentageChange: monthlyGrowth,
      },
    },
    message: 'Dashboard data retrieved successfully',
  };

  console.log('📤 DASHBOARD RESPONSE:', JSON.stringify(responseData, null, 2));

  res.json(responseData);
}));

module.exports = router;