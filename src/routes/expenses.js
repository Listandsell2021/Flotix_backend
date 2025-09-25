const express = require('express');
const mongoose = require('mongoose');
const { User, Vehicle, Expense } = require('../models');
const { asyncHandler, authenticate, checkRole, checkCompanyAccess, createError } = require('../middleware');

const router = express.Router();

// GET /api/expenses
router.get('/', authenticate, checkRole(['SUPER_ADMIN', 'ADMIN', 'DRIVER', 'MANAGER', 'VIEWER']), checkCompanyAccess, asyncHandler(async (req, res) => {
  const { role, userId, companyId: userCompanyId } = req.user;
  const page = parseInt(req.query.page || '1');
  const limit = Math.min(parseInt(req.query.limit || '20'), 100);
  const skip = (page - 1) * limit;
  const sortBy = req.query.sortBy || 'date';
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

  console.log('💰 EXPENSES REQUEST:', {
    role,
    userId,
    userCompanyId,
    query: req.query,
    page,
    limit,
    skip,
    sortBy,
    sortOrder,
    timestamp: new Date().toISOString()
  });

  let companyId;
  if (role === 'SUPER_ADMIN' && req.query.companyId) {
    companyId = req.query.companyId;
  } else {
    companyId = userCompanyId;
  }

  let query = { companyId };
  if (role === 'DRIVER') {
    query.driverId = userId;
  }

  if (req.query.type) query.type = req.query.type;
  if (req.query.driverId && role !== 'DRIVER') query.driverId = req.query.driverId;
  if (req.query.category) query.category = req.query.category;

  if (req.query.dateFrom || req.query.dateTo) {
    query.date = {};
    if (req.query.dateFrom) query.date.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) query.date.$lte = new Date(req.query.dateTo);
  }

  let mongoOr = [];
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    const matchingUsers = await User.find({ name: searchRegex }, '_id');
    const matchingUserIds = matchingUsers.map(u => u._id);
    mongoOr = [
      { merchant: searchRegex },
      { type: searchRegex },
      { category: searchRegex },
      { notes: searchRegex },
      ...(matchingUserIds.length > 0 ? [{ driverId: { $in: matchingUserIds } }] : []),
    ];
    query.$or = mongoOr;
  }

  let expenses = await Expense.find(query)
    .populate('driverId', 'name email')
    .populate('vehicleId', 'make model year licensePlate type color status currentOdometer');

  let statsResponse = {
    totalExpenses: expenses.length,
    totalAmount: 0,
    byType: {},
  };

  for (const exp of expenses) {
    const type = exp.type;
    const amount = exp.amountFinal || 0;

    statsResponse.totalAmount += amount;

    if (!statsResponse.byType[type]) {
      statsResponse.byType[type] = { count: 0, amount: 0 };
    }

    statsResponse.byType[type].count += 1;
    statsResponse.byType[type].amount += amount;
  }

  if (req.query.search) {
    const searchLower = req.query.search.toLowerCase();
    expenses = expenses.filter(exp => {
      const driverName = typeof exp.driverId === 'object' && exp.driverId?.name
        ? exp.driverId.name.toLowerCase()
        : '';
      return (
        (exp.merchant || '').toLowerCase().includes(searchLower) ||
        driverName.includes(searchLower) ||
        (exp.type || '').toLowerCase().includes(searchLower) ||
        (exp.category || '').toLowerCase().includes(searchLower) ||
        (exp.notes || '').toLowerCase().includes(searchLower)
      );
    });
  }

  expenses.sort((a, b) => {
    let aValue, bValue;
    switch (sortBy) {
      case 'date':
        aValue = new Date(a.date);
        bValue = new Date(b.date);
        break;
      case 'amount':
        aValue = a.amountFinal || 0;
        bValue = b.amountFinal || 0;
        break;
      case 'merchant':
        aValue = (a.merchant || '').toLowerCase();
        bValue = (b.merchant || '').toLowerCase();
        break;
      case 'driver':
        aValue = typeof a.driverId === 'object' && a.driverId?.name
          ? a.driverId.name.toLowerCase()
          : '';
        bValue = typeof b.driverId === 'object' && b.driverId?.name
          ? b.driverId.name.toLowerCase()
          : '';
        break;
      default:
        aValue = new Date(a.date);
        bValue = new Date(b.date);
    }
    if (sortOrder === 1) {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const total = expenses.length;
  const paginatedExpenses = expenses.slice(skip, skip + limit);

  console.log('📊 EXPENSES STATS:', {
    totalExpenses: expenses.length,
    paginatedCount: paginatedExpenses.length,
    statsResponse,
    companyId,
    mongoQuery: JSON.stringify(query),
  });

  const responseData = {
    success: true,
    data: {
      data: paginatedExpenses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
    stats: statsResponse,
    message: 'Expenses retrieved successfully',
  };

  console.log('📤 EXPENSES RESPONSE SUMMARY:', {
    success: responseData.success,
    dataCount: responseData.data.data.length,
    pagination: responseData.data.pagination,
    statsTotal: responseData.stats.totalAmount,
    message: responseData.message
  });

  res.json(responseData);
}));

// POST /api/expenses
router.post('/', authenticate, checkRole(['DRIVER', 'ADMIN', 'MANAGER']), asyncHandler(async (req, res) => {
  const expenseData = req.body;
  const { userId, companyId, role } = req.user;

  if (!expenseData.date || !expenseData.type || !expenseData.amountFinal) {
    return res.status(400).json({
      success: false,
      message: 'Date, type, and amount are required',
    });
  }

  let driverId, targetDriver;

  if (role === 'DRIVER') {
    driverId = userId;
    targetDriver = await User.findOne({
      _id: userId,
      companyId,
      role: 'DRIVER',
    });
    if (!targetDriver) {
      throw createError('Driver not found or unauthorized', 403);
    }
  } else if (role === 'ADMIN' || role === 'MANAGER') {
    if (!expenseData.driverId) {
      throw createError('Driver ID is required when admin/manager creates expense', 400);
    }
    driverId = expenseData.driverId;
    targetDriver = await User.findOne({
      _id: driverId,
      companyId,
      role: 'DRIVER',
    });
    if (!targetDriver) {
      throw createError('Driver not found or not in your company', 404);
    }
  } else {
    throw createError('Unauthorized role', 403);
  }

  const expenseDataWithVehicle = {
    ...expenseData,
    driverId,
    companyId,
    vehicleId: targetDriver.assignedVehicleId || undefined,
  };

  const expense = new Expense(expenseDataWithVehicle);
  await expense.save();

  if (targetDriver.assignedVehicleId && (expenseData.odometerReading || expenseData.kilometers)) {
    try {
      const vehicle = await Vehicle.findOne({
        _id: targetDriver.assignedVehicleId,
        companyId,
      });

      if (vehicle) {
        let newOdometerReading;

        if (expenseData.odometerReading && expenseData.odometerReading > 0) {
          newOdometerReading = expenseData.odometerReading;
          expense.kilometers = expenseData.odometerReading;
          await expense.save();
        } else if (expenseData.kilometers && expenseData.kilometers > 0) {
          newOdometerReading = vehicle.currentOdometer + expenseData.kilometers;
          expense.odometerReading = newOdometerReading;
          await expense.save();
        }

        if (newOdometerReading !== undefined && newOdometerReading > vehicle.currentOdometer) {
          vehicle.currentOdometer = newOdometerReading;
          await vehicle.save();
        }
      }
    } catch (error) {
      console.error('Error updating vehicle odometer:', error);
    }
  }

  await expense.populate('driverId', 'name email');
  await expense.populate('vehicleId', 'make model year licensePlate type color status currentOdometer');

  res.status(201).json({
    success: true,
    data: expense,
    message: 'Expense created successfully',
  });
}));

module.exports = router;