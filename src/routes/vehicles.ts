import { Router } from 'express';
import { 
  authenticate, 
  checkRole, 
  checkCompanyAccess,
  validate,
  asyncHandler,
  createError,
  auditVehicleCreate,
  auditVehicleUpdate,
  auditVehicleDelete,
  auditVehicleAssign,
  auditVehicleUnassign
} from '../middleware';
import { Vehicle, User } from '../models';
import type { 
  ApiResponse,
  PaginatedResponse,
  CreateVehicleRequest,
  AssignVehicleRequest,
  Vehicle as IVehicle
} from '../shared-types/src';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createVehicleSchema = z.object({
  body: z.object({
    make: z.string().min(1, 'Make is required').max(50, 'Make too long'),
    model: z.string().min(1, 'Model is required').max(50, 'Model too long'),
    year: z.number().int().min(1900).max(new Date().getFullYear() + 2),
    licensePlate: z.string().min(1, 'License plate is required').max(20, 'License plate too long'),
    vin: z.string().length(17, 'VIN must be exactly 17 characters').optional(),
    type: z.enum(['CAR', 'TRUCK', 'VAN', 'MOTORCYCLE']),
    currentOdometer: z.number().min(0, 'Odometer must be positive').max(9999999, 'Odometer too high'),
    fuelType: z.string().max(30, 'Fuel type too long').optional(),
    color: z.string().max(30, 'Color too long').optional(),
    purchaseDate: z.coerce.date().optional(),
  }),
});

const updateVehicleSchema = z.object({
  body: z.object({
    make: z.string().min(1, 'Make is required').max(50, 'Make too long').optional(),
    model: z.string().min(1, 'Model is required').max(50, 'Model too long').optional(),
    year: z.number().int().min(1900).max(new Date().getFullYear() + 2).optional(),
    licensePlate: z.string().min(1, 'License plate is required').max(20, 'License plate too long').optional(),
    vin: z.string().length(17, 'VIN must be exactly 17 characters').optional(),
    type: z.enum(['CAR', 'TRUCK', 'VAN', 'MOTORCYCLE']).optional(),
    status: z.enum(['ACTIVE', 'MAINTENANCE', 'RETIRED']).optional(),
    currentOdometer: z.number().min(0, 'Odometer must be positive').max(9999999, 'Odometer too high').optional(),
    fuelType: z.string().max(30, 'Fuel type too long').optional(),
    color: z.string().max(30, 'Color too long').optional(),
    purchaseDate: z.coerce.date().optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'Vehicle ID is required'),
  }),
});

const assignVehicleSchema = z.object({
  body: z.object({
    driverId: z.string().min(1).optional(),
    driverIds: z.array(z.string().min(1)).optional(),
  }).refine(
    (data) => data.driverId || (data.driverIds && data.driverIds.length > 0),
    { message: 'Either driverId or driverIds must be provided' }
  ),
  params: z.object({
    id: z.string().min(1, 'Vehicle ID is required'),
  }),
});

// POST /api/vehicles
// Create new vehicle (Admin only)
router.post('/',
  authenticate,
  checkRole(['ADMIN']),
  validate(createVehicleSchema),
  auditVehicleCreate,
  asyncHandler(async (req: any, res) => {
    const vehicleData: CreateVehicleRequest = req.body;
    const { companyId } = req.user;

    // Check if license plate already exists in company
    const existingVehicle = await Vehicle.findOne({ 
      companyId, 
      licensePlate: vehicleData.licensePlate.toUpperCase() 
    });
    
    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        message: 'License plate already exists in your company'
      } as ApiResponse);
    }

    const vehicle = new Vehicle({
      ...vehicleData,
      companyId,
    });

    await vehicle.save();

    res.status(201).json({
      success: true,
      data: vehicle,
      message: 'Vehicle created successfully'
    } as ApiResponse<IVehicle>);
  })
);

// GET /api/vehicles
// Get vehicles for company
router.get('/',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN']),
  asyncHandler(async (req: any, res) => {
    const { companyId: userCompanyId, role } = req.user;
    
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    // Build query based on user role
    let companyId: string;
    if (role === 'SUPER_ADMIN' && req.query.companyId) {
      companyId = req.query.companyId;
    } else {
      companyId = userCompanyId;
    }
    
    let query: any = { companyId };

    // Apply filters
    if (req.query.status) query.status = req.query.status;
    if (req.query.type) query.type = req.query.type;
    if (req.query.assigned === 'true') query.assignedDriverId = { $exists: true, $ne: null };
    if (req.query.assigned === 'false') query.assignedDriverId = { $exists: false };

    if (req.query.search) {
      query.$or = [
        { make: { $regex: req.query.search, $options: 'i' } },
        { model: { $regex: req.query.search, $options: 'i' } },
        { licensePlate: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const [vehicles, total] = await Promise.all([
      Vehicle.find(query)
        .populate('assignedDriverId', 'name email')
        .populate('assignedDriverIds', 'name email')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      Vehicle.countDocuments(query)
    ]);

    const response: PaginatedResponse<IVehicle> = {
      data: vehicles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    res.json({
      success: true,
      data: response,
      message: 'Vehicles retrieved successfully'
    } as ApiResponse<PaginatedResponse<IVehicle>>);
  })
);

// GET /api/vehicles/:id
// Get single vehicle
router.get('/:id',
  authenticate,
  checkRole(['ADMIN', 'DRIVER']),
  asyncHandler(async (req: any, res) => {
    const { companyId, role, userId } = req.user;
    const { id } = req.params;

    // Debug logging
    console.log('Vehicle lookup debug:', {
      vehicleId: id,
      userRole: role,
      userId: userId,
      companyId: companyId
    });

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle ID format'
      } as ApiResponse);
    }

    // Build query based on user role
    let query: any = { _id: id };
    
    // For non-super-admin users, filter by company
    if (role !== 'SUPER_ADMIN') {
      query.companyId = companyId;
    }
    
    // If user is a driver, they can only access their assigned vehicle
    // Temporarily relaxed for debugging - normally should check assignedDriverId
    if (role === 'DRIVER') {
      // TODO: Fix data consistency issue between User and Vehicle models
      // query.assignedDriverId = userId;
      console.log('Driver access - checking assignedVehicleId from user model');
    }

    console.log('Final query:', query);

    const vehicle = await Vehicle.findOne(query)
      .populate('assignedDriverId', 'name email status');
    
    console.log('Vehicle found:', vehicle ? 'YES' : 'NO');
    
    if (!vehicle) {
      // Let's try to find the vehicle without role restrictions for debugging
      const debugVehicle = await Vehicle.findById(id);
      console.log('Debug - Vehicle exists in DB:', debugVehicle ? 'YES' : 'NO');
      
      const debugInfo = {
        vehicleExistsInDB: debugVehicle ? true : false,
        queryUsed: query,
        userInfo: {
          userId: userId,
          role: role,
          companyId: companyId
        }
      };
      
      if (debugVehicle) {
        console.log('Debug - Vehicle details:', {
          id: debugVehicle._id,
          companyId: debugVehicle.companyId,
          assignedDriverId: debugVehicle.assignedDriverId
        });
        debugInfo.vehicleDetails = {
          id: debugVehicle._id.toString(),
          companyId: debugVehicle.companyId.toString(),
          assignedDriverId: debugVehicle.assignedDriverId?.toString() || null
        };
      }
      
      // Temporary: Return debug info in response for troubleshooting
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found or access denied',
        debug: debugInfo
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: vehicle,
      message: 'Vehicle retrieved successfully'
    } as ApiResponse<IVehicle>);
  })
);

// PUT /api/vehicles/:id
// Update vehicle
router.put('/:id',
  authenticate,
  checkRole(['ADMIN']),
  validate(updateVehicleSchema),
  auditVehicleUpdate,
  asyncHandler(async (req: any, res) => {
    const { companyId } = req.user;
    const { id } = req.params;
    const updateData = req.body;

    // Check if license plate already exists in company (if being updated)
    if (updateData.licensePlate) {
      const existingVehicle = await Vehicle.findOne({ 
        _id: { $ne: id },
        companyId, 
        licensePlate: updateData.licensePlate.toUpperCase() 
      });
      
      if (existingVehicle) {
        return res.status(400).json({
          success: false,
          message: 'License plate already exists in your company'
        } as ApiResponse);
      }
    }

    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: id, companyId },
      updateData,
      { new: true, runValidators: true }
    ).populate('assignedDriverId', 'name email status');
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: vehicle,
      message: 'Vehicle updated successfully'
    } as ApiResponse<IVehicle>);
  })
);

// POST /api/vehicles/:id/assign
// Assign vehicle to driver
router.post('/:id/assign',
  authenticate,
  checkRole(['ADMIN']),
  validate(assignVehicleSchema),
  auditVehicleAssign,
  asyncHandler(async (req: any, res) => {
    const { companyId } = req.user;
    const { id } = req.params;
    const { driverId, driverIds } = req.body;

    // Find vehicle
    const vehicle = await Vehicle.findOne({ _id: id, companyId });
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      } as ApiResponse);
    }

    // Support both single driver and multiple drivers
    const driversToAssign = driverIds || (driverId ? [driverId] : []);
    
    if (driversToAssign.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No drivers specified for assignment'
      } as ApiResponse);
    }
    
    // Verify all drivers exist and belong to the company
    const drivers = await User.find({ 
      _id: { $in: driversToAssign }, 
      companyId, 
      role: 'DRIVER' 
    });
    
    if (drivers.length !== driversToAssign.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more drivers not found or not authorized'
      } as ApiResponse);
    }
    
    // Assign drivers to vehicle
    vehicle.assignedDriverIds = driversToAssign;
    vehicle.assignedDriverId = driversToAssign[0]; // Set primary driver
    await vehicle.save();

    await vehicle.populate('assignedDriverId', 'name email status');
    await vehicle.populate('assignedDriverIds', 'name email status');

    res.json({
      success: true,
      data: vehicle,
      message: 'Vehicle assigned successfully'
    } as ApiResponse<IVehicle>);
  })
);

// POST /api/vehicles/:id/unassign
// Unassign vehicle from driver
router.post('/:id/unassign',
  authenticate,
  checkRole(['ADMIN']),
  auditVehicleUnassign,
  asyncHandler(async (req: any, res) => {
    const { companyId } = req.user;
    const { id } = req.params;

    const vehicle = await Vehicle.findOne({ _id: id, companyId });
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      } as ApiResponse);
    }

    if (!vehicle.assignedDriverIds || vehicle.assignedDriverIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle is not assigned to any driver'
      } as ApiResponse);
    }

    // Support removing specific driver or all drivers
    const driverIdToRemove = req.body.driverId;
    
    if (driverIdToRemove) {
      // Remove specific driver
      vehicle.assignedDriverIds = vehicle.assignedDriverIds.filter(
        id => id.toString() !== driverIdToRemove
      );
      // Update primary driver if needed
      if (vehicle.assignedDriverId?.toString() === driverIdToRemove) {
        vehicle.assignedDriverId = vehicle.assignedDriverIds[0] || undefined;
      }
    } else {
      // Clear all assignments
      const previousDriverIds = vehicle.assignedDriverIds;
      vehicle.assignedDriverIds = [];
      vehicle.assignedDriverId = undefined;
      
      // Clear drivers' vehicle assignments
      await User.updateMany(
        { _id: { $in: previousDriverIds } },
        { assignedVehicleId: null }
      );
    }
    
    await vehicle.save();

    res.json({
      success: true,
      data: vehicle,
      message: 'Vehicle unassigned successfully'
    } as ApiResponse<IVehicle>);
  })
);

// PUT /api/vehicles/:id/odometer
// Update vehicle odometer reading (Driver can update their assigned vehicle)
router.put('/:id/odometer',
  authenticate,
  checkRole(['ADMIN', 'DRIVER']),
  asyncHandler(async (req: any, res) => {
    const { companyId, role, userId } = req.user;
    const { id } = req.params;
    const { currentOdometer } = req.body;

    // Validate odometer reading
    if (!currentOdometer || typeof currentOdometer !== 'number' || currentOdometer < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid odometer reading is required'
      } as ApiResponse);
    }

    if (currentOdometer > 9999999) {
      return res.status(400).json({
        success: false,
        message: 'Odometer reading too high (max: 9,999,999 km)'
      } as ApiResponse);
    }

    // Build query based on user role
    let query: any = { _id: id, companyId };
    
    // Drivers can only update their assigned vehicle's odometer
    if (role === 'DRIVER') {
      query.assignedDriverId = userId;
    }

    const vehicle = await Vehicle.findOne(query);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: role === 'DRIVER' 
          ? 'Vehicle not found or not assigned to you'
          : 'Vehicle not found'
      } as ApiResponse);
    }

    // Validate that new reading is not less than current reading
    if (currentOdometer < vehicle.currentOdometer) {
      return res.status(400).json({
        success: false,
        message: `New odometer reading (${currentOdometer}) cannot be less than current reading (${vehicle.currentOdometer})`
      } as ApiResponse);
    }

    // Update odometer
    vehicle.currentOdometer = currentOdometer;
    await vehicle.save();

    // Populate driver info for response
    await vehicle.populate('assignedDriverId', 'name email');

    res.json({
      success: true,
      data: {
        _id: vehicle._id,
        currentOdometer: vehicle.currentOdometer,
        previousOdometer: currentOdometer === vehicle.currentOdometer ? vehicle.currentOdometer : vehicle.currentOdometer,
        make: vehicle.make,
        model: vehicle.model,
        licensePlate: vehicle.licensePlate,
        assignedDriver: vehicle.assignedDriverId
      },
      message: 'Odometer updated successfully'
    } as ApiResponse);
  })
);

// DELETE /api/vehicles/:id
// Delete vehicle (only if not assigned)
router.delete('/:id',
  authenticate,
  checkRole(['ADMIN']),
  auditVehicleDelete,
  asyncHandler(async (req: any, res) => {
    const { companyId } = req.user;
    const { id } = req.params;

    const vehicle = await Vehicle.findOne({ _id: id, companyId });
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      } as ApiResponse);
    }

    if (vehicle.assignedDriverId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete vehicle that is assigned to a driver. Unassign first.'
      } as ApiResponse);
    }

    await Vehicle.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    } as ApiResponse);
  })
);

export { router as vehicleRoutes };