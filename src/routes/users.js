const express = require('express');
const { User } = require('../models');
const { asyncHandler, authenticate, checkRole, checkCompanyAccess } = require('../middleware');

const router = express.Router();

// GET /api/users
router.get('/', authenticate, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), checkCompanyAccess, asyncHandler(async (req, res) => {
  const { role, companyId: userCompanyId } = req.user;
  const page = parseInt(req.query.page || '1');
  const limit = Math.min(parseInt(req.query.limit || '20'), 100);
  const skip = (page - 1) * limit;

  let query = {};
  if (role === 'SUPER_ADMIN' && req.query.companyId) {
    query.companyId = req.query.companyId;
  } else if (role !== 'SUPER_ADMIN') {
    query.companyId = userCompanyId;
  }

  if (req.query.role) {
    query.role = req.query.role;
  }

  if (req.query.status) {
    query.status = req.query.status;
  }

  const users = await User.find(query)
    .populate('companyId', 'name')
    .populate('assignedVehicleId', 'make model licensePlate currentOdometer')
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(query);

  console.log('👥 USERS REQUEST:', {
    role,
    userCompanyId,
    query,
    userCount: users.length,
    timestamp: new Date().toISOString()
  });

  // Log vehicle data for drivers to verify currentOdometer is populated
  const driversWithVehicles = users.filter(u => u.role === 'DRIVER' && u.assignedVehicleId);
  if (driversWithVehicles.length > 0) {
    console.log('🚗 DRIVER VEHICLE POPULATE DATA:', driversWithVehicles.map(d => ({
      driverId: d._id,
      driverName: d.name,
      vehicleId: d.assignedVehicleId?._id,
      vehicleMake: d.assignedVehicleId?.make,
      vehicleModel: d.assignedVehicleId?.model,
      currentOdometer: d.assignedVehicleId?.currentOdometer
    })));
  }

  res.json({
    success: true,
    data: {
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
    message: 'Users retrieved successfully',
  });
}));

// GET /api/users/:id
router.get('/:id', authenticate, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), checkCompanyAccess, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, companyId: userCompanyId } = req.user;

  let query = { _id: id };
  if (role !== 'SUPER_ADMIN') {
    query.companyId = userCompanyId;
  }

  const user = await User.findOne(query)
    .populate('companyId', 'name plan status')
    .populate('assignedVehicleId', 'make model year licensePlate type');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  res.json({
    success: true,
    data: user,
    message: 'User retrieved successfully',
  });
}));

module.exports = router;