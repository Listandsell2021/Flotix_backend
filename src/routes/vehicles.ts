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
  auditVehicleUnassign,
  createVehicleSchema,
  updateVehicleSchema
} from '../middleware';
import { Vehicle, User } from '../models';
import {
  ApiResponse,
  PaginatedResponse,
  CreateVehicleRequest,
  AssignVehicleRequest,
  Vehicle as IVehicle,
  UserRole
} from '../types';
import { z } from 'zod';

const router: Router = Router();

// Assignment validation schema
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
// Create new vehicle (Admin and Manager only)
router.post('/',
  authenticate,
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(createVehicleSchema),
  auditVehicleCreate,
  asyncHandler(async (req: any, res:any) => {
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
  checkRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER ]),
  asyncHandler(async (req: any, res:any) => {
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


// GET /api/vehicles/my-vehicle
// Get driver's assigned vehicle (for drivers only)
router.get('/my-vehicle',
  authenticate,
  checkRole([UserRole.DRIVER]),
  asyncHandler(async (req: any, res: any) => {
    const { userId, companyId } = req.user;

    // Find the user and their assigned vehicle
    const user = await User.findOne({
      _id: userId,
      companyId,
      role: 'DRIVER'
    }).populate('assignedVehicleId', 'make model year licensePlate type status currentOdometer fuelType color purchaseDate');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      } as ApiResponse);
    }

    if (!user.assignedVehicleId) {
      return res.status(404).json({
        success: false,
        message: 'No vehicle assigned to this driver'
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: user.assignedVehicleId,
      message: 'Vehicle retrieved successfully'
    } as ApiResponse);
  })
);

// GET /api/vehicles/:id
// Get single vehicle
router.get('/:id',
  authenticate,
  checkRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.DRIVER, UserRole.VIEWER]),
  asyncHandler(async (req: any, res:any) => {
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

    // Build base query
    let query: any = { _id: id };

    // For non-super-admin users, filter by company
    if (role !== 'SUPER_ADMIN') {
      query.companyId = companyId;
    }

    console.log('Base query:', query);

    // First, find the vehicle
    const vehicle = await Vehicle.findOne(query)
      .populate('assignedDriverId', 'name email status')
      .populate('assignedDriverIds', 'name email status');

    console.log('Vehicle found:', vehicle ? 'YES' : 'NO');

    // If vehicle found and user is a driver, allow access to vehicles in their company
    if (vehicle && role === 'DRIVER') {
      console.log('✅ Driver access granted to vehicle in same company');
      // Drivers can access any vehicle in their company for now
      // This allows flexibility with vehicle assignments
    }

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found or access denied'
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
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(updateVehicleSchema),
  auditVehicleUpdate,
  asyncHandler(async (req: any, res:any) => {
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
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  validate(assignVehicleSchema),
  auditVehicleAssign,
  asyncHandler(async (req: any, res:any) => {
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
     // Check if any driver already has a vehicle assigned
   const alreadyAssigned = drivers.find(d => d.assignedVehicleId && d.assignedVehicleId.toString() !== vehicle._id.toString());
    if (alreadyAssigned) {
      return res.status(400).json({
        success: false,
        message: `Driver ${alreadyAssigned.name || alreadyAssigned._id} is already assigned to another vehicle`
      } as ApiResponse);
    }

    

    // Assign drivers to vehicle
    vehicle.assignedDriverIds = driversToAssign;
    vehicle.assignedDriverId = driversToAssign[0]; // Set primary driver
    await vehicle.save();

    // Update all users with the new assigned vehicle
    await User.updateMany(
      { _id: { $in: driversToAssign } },
      { $set: { assignedVehicleId: vehicle._id } }
    );


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
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  auditVehicleUnassign,
  asyncHandler(async (req: any, res:any) => {
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
  checkRole([UserRole.DRIVER, UserRole.ADMIN, UserRole.MANAGER]),
  asyncHandler(async (req: any, res:any) => {
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
  checkRole([UserRole.ADMIN, UserRole.MANAGER]),
  auditVehicleDelete,
  asyncHandler(async (req: any, res:any) => {
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