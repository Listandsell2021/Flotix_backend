import { Router } from 'express';
import { 
  authenticate, 
  checkRole, 
  checkCompanyAccess,
  validate,
  createUserSchema,
  updateUserSchema,
  paginationSchema,
  auditUserCreate,
  auditUserUpdate,
  auditUserDelete,
  asyncHandler,
  createError
} from '../middleware';
import { User, Company, Vehicle, RoleAssignment } from '../models';
import type { 
  UserRole, 
  ApiResponse,
  PaginatedResponse,
  CreateUserRequest,
  User as IUser
} from '../types';

const router = Router();

// POST /api/users
// Create user (Super Admin creates Admins, Admin creates Drivers)
router.post('/',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN']),
  validate(createUserSchema),
  auditUserCreate,
  asyncHandler(async (req: any, res) => {
    const userData: CreateUserRequest = req.body;
    const { role: currentUserRole, companyId: currentUserCompanyId } = req.user;

    // Validate role creation permissions
    if (currentUserRole === 'SUPER_ADMIN') {
      if (userData.role === 'ADMIN') {
        // Super Admin creating Admin - companyId required
        if (!userData.companyId) {
          throw createError('Company ID is required when creating Admin users', 400);
        }
        
        // Verify company exists
        const company = await Company.findById(userData.companyId);
        if (!company) {
          throw createError('Company not found', 404);
        }
      } else if (userData.role === 'SUPER_ADMIN') {
        throw createError('Cannot create another Super Admin user', 403);
      }
      // Super Admin can create any other role
    } else if (currentUserRole === 'ADMIN') {
      // Admin can create company-level users (DRIVER, MANAGER, VIEWER)
      if (['DRIVER', 'MANAGER', 'VIEWER'].includes(userData.role)) {
        // Use admin's company for all company-level users
        userData.companyId = currentUserCompanyId;
        
        // Check driver limit only for drivers
        if (userData.role === 'DRIVER') {
          const company = await Company.findById(currentUserCompanyId);
          if (!company) {
            throw createError('Company not found', 404);
          }
          
          const driverCount = await User.countDocuments({
            companyId: currentUserCompanyId,
            role: 'DRIVER',
            status: 'ACTIVE'
          });
          
          if (driverCount >= company.driverLimit) {
            throw createError('Driver limit reached for your company', 400);
          }
        }
      } else {
        throw createError('You are not authorized to create this type of user', 403);
      }
    } else {
      throw createError('You are not authorized to create users', 403);
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: userData.email.toLowerCase() });
    if (existingUser) {
      throw createError('Email already exists', 400);
    }

    // Validate vehicle assignment if provided
    if (userData.assignedVehicleId) {
      const vehicle = await Vehicle.findOne({
        _id: userData.assignedVehicleId,
        companyId: userData.companyId
      });
      
      if (!vehicle) {
        throw createError('Vehicle not found in your company', 404);
      }
      
      if (vehicle.status === 'RETIRED') {
        throw createError('Cannot assign retired vehicle to driver', 400);
      }
      
      // Check if vehicle has reached maximum driver limit (5 drivers)
      if (vehicle.assignedDriverIds && vehicle.assignedDriverIds.length >= 5) {
        throw createError('Vehicle already has maximum number of drivers assigned (5)', 400);
      }
    }

    // Create user
    const user = new User({
      name: userData.name,
      email: userData.email.toLowerCase(),
      passwordHash: userData.password, // Will be hashed by pre-save middleware
      role: userData.role,
      companyId: userData.companyId,
      assignedVehicleId: userData.assignedVehicleId,
    });

    await user.save();

    // Update vehicle assignment if needed
    if (userData.assignedVehicleId) {
      const vehicle = await Vehicle.findById(userData.assignedVehicleId);
      if (vehicle) {
        // Update both assignedDriverId and assignedDriverIds
        vehicle.assignedDriverId = user._id;
        if (!vehicle.assignedDriverIds) {
          vehicle.assignedDriverIds = [];
        }
        if (!vehicle.assignedDriverIds.includes(user._id)) {
          vehicle.assignedDriverIds.push(user._id);
        }
        await vehicle.save();
      }
    }

    res.status(201).json({
      success: true,
      data: user,
      message: 'User created successfully'
    } as ApiResponse<IUser>);
  })
);

// GET /api/users
// Get users (filtered by role and company access)
router.get('/',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER']),
  validate(paginationSchema),
  asyncHandler(async (req: any, res) => {
    const { role: currentUserRole, companyId: currentUserCompanyId } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const search = req.query.search;
    const status = req.query.status;
    const userRole = req.query.role;

    // Build query based on current user role
    let query: any = {};
    
    if (currentUserRole === 'SUPER_ADMIN') {
      // Super Admin can see users from any company if companyId is provided
      if (req.query.companyId) {
        query.companyId = req.query.companyId;
        if (userRole) query.role = userRole;
        // Allow super admin to query any role within a company
      } else {
        // Default behavior: show Admins from all companies
        if (userRole) query.role = userRole;
        else query.role = { $in: ['ADMIN'] }; 
      }
    } else if (currentUserRole === 'ADMIN') {
      // Admin can see all company-level users from their company
      query.companyId = currentUserCompanyId;
      if (userRole) {
        query.role = userRole;
      } else {
        // Show all company-level users (excluding other admins)
        query.role = { $in: ['DRIVER', 'MANAGER', 'VIEWER'] };
      }
    } else if (currentUserRole === 'MANAGER' || currentUserRole === 'VIEWER') {
      // Manager/Viewer can see company users but with limited scope
      query.companyId = currentUserCompanyId;
      if (userRole) {
        query.role = userRole;
      } else {
        // Show only drivers and viewers for managers/viewers
        query.role = { $in: ['DRIVER', 'VIEWER'] };
      }
    }

    // Apply filters
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const [users, total] = await Promise.all([
      User.find(query)
        .populate('companyId', 'name plan status')
        .populate('assignedVehicleId', 'licensePlate make model year status currentOdometer')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    // Populate assigned roles for each user
    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const roleAssignments = await RoleAssignment.find({ userId: user._id })
          .populate('roleId', 'name displayName description permissions');
        
        return {
          ...user.toObject(),
          assignedRoles: roleAssignments.map(assignment => assignment.roleId)
        };
      })
    );

    const response: PaginatedResponse<IUser> = {
      data: usersWithRoles,
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
      message: 'Users retrieved successfully'
    } as ApiResponse<PaginatedResponse<IUser>>);
  })
);

// GET /api/users/:id
// Get single user
router.get('/:id',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER']),
  checkCompanyAccess,
  asyncHandler(async (req: any, res) => {
    const { role: currentUserRole, companyId: currentUserCompanyId } = req.user;
    const { id } = req.params;

    let query: any = { _id: id };

    // Apply role-based access control
    if (currentUserRole === 'ADMIN') {
      query.companyId = currentUserCompanyId;
      query.role = 'DRIVER';
    } else if (currentUserRole === 'MANAGER' || currentUserRole === 'VIEWER') {
      query.companyId = currentUserCompanyId;
      // Managers and Viewers can only view drivers
      query.role = 'DRIVER';
    }

    const user = await User.findOne(query)
      .populate('companyId', 'name plan status')
      .populate('assignedVehicleId', 'licensePlate make model year status currentOdometer');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: user,
      message: 'User retrieved successfully'
    } as ApiResponse<IUser>);
  })
);

// PUT /api/users/:id
// Update user
router.put('/:id',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN']),
  validate(updateUserSchema),
  auditUserUpdate,
  asyncHandler(async (req: any, res) => {
    const { role: currentUserRole, companyId: currentUserCompanyId } = req.user;
    const { id } = req.params;
    const updateData = req.body;

    let query: any = { _id: id };

    // Apply role-based access control
    if (currentUserRole === 'ADMIN') {
      query.companyId = currentUserCompanyId;
      query.role = 'DRIVER';
    } else if (currentUserRole === 'MANAGER' || currentUserRole === 'VIEWER') {
      query.companyId = currentUserCompanyId;
      // Managers and Viewers can only view drivers
      query.role = 'DRIVER';
    }

    const user = await User.findOne(query);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      } as ApiResponse);
    }

    // Check email uniqueness if email is being updated
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await User.findOne({ 
        email: updateData.email.toLowerCase(),
        _id: { $ne: id }
      });
      if (existingUser) {
        throw createError('Email already exists', 400);
      }
      updateData.email = updateData.email.toLowerCase();
    }

    // Handle vehicle assignment changes
    if (updateData.hasOwnProperty('assignedVehicleId')) {
      const newVehicleId = updateData.assignedVehicleId;
      const currentVehicleId = user.assignedVehicleId?.toString();

      // If assigning a new vehicle
      if (newVehicleId && newVehicleId !== currentVehicleId) {
        const vehicle = await Vehicle.findOne({
          _id: newVehicleId,
          companyId: user.companyId
        });
        
        if (!vehicle) {
          throw createError('Vehicle not found in your company', 404);
        }
        
        if (vehicle.status === 'RETIRED') {
          throw createError('Cannot assign retired vehicle to driver', 400);
        }
        
        // Allow multiple drivers per vehicle - just warn if already has drivers
        if (vehicle.assignedDriverIds && vehicle.assignedDriverIds.length > 0) {
          const alreadyAssigned = vehicle.assignedDriverIds.some(
            dId => dId.toString() === id
          );
          if (!alreadyAssigned && vehicle.assignedDriverIds.length >= 5) {
            throw createError('Vehicle already has maximum drivers assigned', 400);
          }
        }
      }

      // Handle vehicle assignment/unassignment
      if (currentVehicleId && currentVehicleId !== newVehicleId) {
        // Clear old vehicle assignment
        const oldVehicle = await Vehicle.findById(currentVehicleId);
        if (oldVehicle) {
          // Remove from assignedDriverIds array
          oldVehicle.assignedDriverIds = oldVehicle.assignedDriverIds?.filter(
            dId => dId.toString() !== user._id.toString()
          ) || [];
          // Clear assignedDriverId if it matches
          if (oldVehicle.assignedDriverId?.toString() === user._id.toString()) {
            oldVehicle.assignedDriverId = oldVehicle.assignedDriverIds[0] || undefined;
          }
          await oldVehicle.save();
        }
      }
      
      if (newVehicleId) {
        // Set new vehicle assignment
        const newVehicle = await Vehicle.findById(newVehicleId);
        if (newVehicle) {
          // Add to assignedDriverIds array
          if (!newVehicle.assignedDriverIds) {
            newVehicle.assignedDriverIds = [];
          }
          if (!newVehicle.assignedDriverIds.some(dId => dId.toString() === user._id.toString())) {
            newVehicle.assignedDriverIds.push(user._id);
          }
          // Set as primary driver if no one else is assigned
          if (!newVehicle.assignedDriverId) {
            newVehicle.assignedDriverId = user._id;
          }
          await newVehicle.save();
        }
      }
    }

    // Update user
    Object.assign(user, updateData);
    user.updatedAt = new Date();
    await user.save();

    // Populate company info for response
    await user.populate('companyId', 'name plan status');

    res.json({
      success: true,
      data: user,
      message: 'User updated successfully'
    } as ApiResponse<IUser>);
  })
);

// DELETE /api/users/:id
// Delete/deactivate user
router.delete('/:id',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN']),
  auditUserDelete,
  asyncHandler(async (req: any, res) => {
    const { role: currentUserRole, companyId: currentUserCompanyId } = req.user;
    const { id } = req.params;

    let query: any = { _id: id };

    // Apply role-based access control
    if (currentUserRole === 'ADMIN') {
      query.companyId = currentUserCompanyId;
      query.role = 'DRIVER';
    } else if (currentUserRole === 'MANAGER' || currentUserRole === 'VIEWER') {
      query.companyId = currentUserCompanyId;
      // Managers and Viewers can only view drivers
      query.role = 'DRIVER';
    }

    const user = await User.findOne(query);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      } as ApiResponse);
    }

    // Check if hard delete is requested
    const hardDelete = req.query.hard === 'true';

    if (hardDelete) {
      // Clean up related data before deleting user
      // Remove role assignments
      await RoleAssignment.deleteMany({ userId: id });

      // Remove user from vehicles
      await Vehicle.updateMany(
        { assignedDriverIds: user._id },
        { $pull: { assignedDriverIds: user._id } }
      );
      await Vehicle.updateMany(
        { assignedDriverId: user._id },
        { $unset: { assignedDriverId: 1 } }
      );

      // Actually delete the user from database
      await User.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'User deleted permanently'
      } as ApiResponse);
    } else {
      // Soft delete - just deactivate the user
      user.status = 'INACTIVE';
      user.updatedAt = new Date();
      await user.save();

      res.json({
        success: true,
        message: 'User deactivated successfully'
      } as ApiResponse);
    }
  })
);

// GET /api/users/:id/expenses
// Get expenses for a specific driver (Admin only)
router.get('/:id/expenses',
  authenticate,
  checkRole(['ADMIN']),
  validate(paginationSchema),
  asyncHandler(async (req: any, res) => {
    const { companyId } = req.user;
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    // Verify driver exists and belongs to the company
    const driver = await User.findOne({
      _id: id,
      companyId,
      role: 'DRIVER'
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      } as ApiResponse);
    }

    // Get driver's expenses
    const { Expense } = await import('../models');
    
    const [expenses, total] = await Promise.all([
      Expense.find({ driverId: id, companyId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Expense.countDocuments({ driverId: id, companyId })
    ]);

    const response: PaginatedResponse<any> = {
      data: expenses,
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
      message: 'Driver expenses retrieved successfully'
    } as ApiResponse);
  })
);

export { router as userRoutes };