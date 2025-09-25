const express = require('express');
const { Vehicle } = require('../models');
const { asyncHandler, authenticate, checkRole, checkCompanyAccess } = require('../middleware');

const router = express.Router();

// GET /api/vehicles
router.get('/', authenticate, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER']), checkCompanyAccess, asyncHandler(async (req, res) => {
  const { role, companyId: userCompanyId } = req.user;
  const page = parseInt(req.query.page || '1');
  const limit = Math.min(parseInt(req.query.limit || '20'), 100);
  const skip = (page - 1) * limit;

  let query = {};
  if (role === 'SUPER_ADMIN' && req.query.companyId) {
    query.companyId = req.query.companyId;
  } else {
    query.companyId = userCompanyId;
  }

  if (req.query.type) {
    query.type = req.query.type;
  }

  if (req.query.status) {
    query.status = req.query.status;
  }

  const vehicles = await Vehicle.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await Vehicle.countDocuments(query);

  console.log('🚗 VEHICLES REQUEST:', {
    role,
    userCompanyId,
    query,
    vehicleCount: vehicles.length,
    timestamp: new Date().toISOString()
  });

  // Log currentOdometer values for debugging
  if (vehicles.length > 0) {
    console.log('🔧 VEHICLES ODOMETER DATA:', vehicles.map(v => ({
      id: v._id,
      make: v.make,
      model: v.model,
      currentOdometer: v.currentOdometer
    })));
  }

  res.json({
    success: true,
    data: {
      data: vehicles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
    message: 'Vehicles retrieved successfully',
  });
}));

// GET /api/vehicles/:id
router.get('/:id', authenticate, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER']), checkCompanyAccess, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, companyId: userCompanyId } = req.user;

  let query = { _id: id };
  if (role === 'SUPER_ADMIN' && req.query.companyId) {
    query.companyId = req.query.companyId;
  } else if (role !== 'SUPER_ADMIN') {
    query.companyId = userCompanyId;
  }

  console.log('🚗 SINGLE VEHICLE REQUEST:', {
    vehicleId: id,
    role,
    userCompanyId,
    query,
    timestamp: new Date().toISOString()
  });

  const vehicle = await Vehicle.findOne(query);

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found or access denied'
    });
  }

  console.log('🔧 SINGLE VEHICLE DATA:', {
    id: vehicle._id,
    make: vehicle.make,
    model: vehicle.model,
    currentOdometer: vehicle.currentOdometer
  });

  res.json({
    success: true,
    data: vehicle,
    message: 'Vehicle retrieved successfully',
  });
}));

module.exports = router;