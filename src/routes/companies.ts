import { Router } from 'express';
import { startSession } from 'mongoose';
import {
  authenticate,
  checkRole,
  validate,
  createCompanySchema,
  updateCompanySchema,
  paginationSchema,
  auditCompanyCreate,
  auditCompanyUpdate,
  asyncHandler,
  createError
} from '../middleware';
import { Company, User } from '../models';
import { EmailService } from '../modules';
import type {
  UserRole,
  ApiResponse,
  PaginatedResponse,
  Company as ICompany
} from '../types';

const router = Router();

// POST /api/companies/create-with-admin
// Atomically create company and admin user together
router.post('/create-with-admin',
  authenticate,
  checkRole(['SUPER_ADMIN']),
  asyncHandler(async (req: any, res) => {
    const { company: companyData, admin: adminData } = req.body;

    // Validate required fields
    if (!companyData || !adminData) {
      throw createError('Company and admin data are required', 400);
    }

    if (!adminData.email || !adminData.password || !adminData.name) {
      throw createError('Admin name, email, and password are required', 400);
    }

    // Check if email already exists BEFORE starting transaction
    const existingUser = await User.findOne({ email: adminData.email.toLowerCase() });
    if (existingUser) {
      throw createError(`Email "${adminData.email}" is already registered. Please use a different email.`, 400);
    }

    // Start MongoDB transaction session
    const session = await startSession();
    session.startTransaction();

    try {
      // Create company within transaction
      const company = new Company(companyData);
      await company.save({ session });

      // Create admin user within transaction
      const user = new User({
        name: adminData.name,
        email: adminData.email.toLowerCase(),
        passwordHash: adminData.password, // Will be hashed by pre-save middleware
        role: 'ADMIN',
        companyId: company._id,
        status: 'ACTIVE'
      });
      await user.save({ session });

      // Commit the transaction - both created successfully
      await session.commitTransaction();

      // Send welcome email (after transaction commits, so we don't send if it fails)
      try {
        await EmailService.sendWelcomeEmail(
          user.email,
          user.name,
          user.role,
          adminData.password, // Original password before hashing
          company.name
        );
        console.log(`✅ Welcome email sent to ${user.email}`);
      } catch (emailError: any) {
        // Log email error but don't fail - company and user already created
        console.error('Failed to send welcome email:', emailError.message);
      }

      res.status(201).json({
        success: true,
        data: {
          company: company.toObject(),
          admin: user.toObject()
        },
        message: 'Company and admin created successfully'
      } as ApiResponse);
    } catch (error: any) {
      // Rollback transaction if anything fails
      await session.abortTransaction();

      // Re-throw error to be handled by error middleware
      throw error;
    } finally {
      // End session
      session.endSession();
    }
  })
);

// POST /api/companies
router.post('/',
  authenticate,
  checkRole(['SUPER_ADMIN']),
  validate(createCompanySchema),
  auditCompanyCreate,
  asyncHandler(async (req: any, res) => {
    const companyData = req.body;

    const company = new Company(companyData);
    await company.save();

    res.status(201).json({
      success: true,
      data: company,
      message: 'Company created successfully'
    } as ApiResponse<ICompany>);
  })
);

// GET /api/companies
router.get('/',
  authenticate,
  checkRole(['SUPER_ADMIN']),
  validate(paginationSchema),
  asyncHandler(async (req: any, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [companies, total] = await Promise.all([
      Company.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Company.countDocuments()
    ]);

    const response: PaginatedResponse<ICompany> = {
      data: companies,
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
      message: 'Companies retrieved successfully'
    } as ApiResponse<PaginatedResponse<ICompany>>);
  })
);

// GET /api/companies/:id
// Get company details (Super Admin can access any, others only their own)
router.get('/:id',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN', 'DRIVER', 'MANAGER', 'VIEWER']),
  asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const { role, companyId: userCompanyId } = req.user;

    // Super Admin can access any company, others only their own
    if (role !== 'SUPER_ADMIN' && id !== userCompanyId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own company details.'
      } as ApiResponse);
    }

    const company = await Company.findById(id);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      } as ApiResponse);
    }

    // Get additional company statistics
    const [userStats, vehicleStats] = await Promise.all([
      // User statistics
      User.aggregate([
        { $match: { companyId: company._id } },
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
            active: { 
              $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] }
            }
          }
        }
      ]),
      // Vehicle statistics (if Vehicle model exists)
      Company.aggregate([
        { $match: { _id: company._id } },
        {
          $lookup: {
            from: 'vehicles',
            localField: '_id',
            foreignField: 'companyId',
            as: 'vehicles'
          }
        },
        {
          $project: {
            totalVehicles: { $size: '$vehicles' },
            activeVehicles: {
              $size: {
                $filter: {
                  input: '$vehicles',
                  cond: { $eq: ['$$this.status', 'ACTIVE'] }
                }
              }
            },
            assignedVehicles: {
              $size: {
                $filter: {
                  input: '$vehicles',
                  cond: { $ne: ['$$this.assignedDriverId', null] }
                }
              }
            }
          }
        }
      ])
    ]);

    // Format user statistics
    const userSummary = {
      total: 0,
      admins: 0,
      drivers: 0,
      activeUsers: 0
    };

    userStats.forEach(stat => {
      userSummary.total += stat.count;
      userSummary.activeUsers += stat.active;
      
      if (stat._id === 'ADMIN') {
        userSummary.admins = stat.count;
      } else if (stat._id === 'DRIVER') {
        userSummary.drivers = stat.count;
      }
    });

    // Format vehicle statistics
    const vehicleSummary = vehicleStats[0] || {
      totalVehicles: 0,
      activeVehicles: 0,
      assignedVehicles: 0
    };

    // Build response based on user role
    let responseData;
    
    if (role === 'DRIVER') {
      // Driver gets limited company info relevant to them
      responseData = {
        _id: company._id,
        name: company.name,
        plan: company.plan,
        status: company.status,
        info: {
          totalDrivers: userSummary.drivers,
          totalVehicles: vehicleSummary.totalVehicles,
          activeVehicles: vehicleSummary.activeVehicles
        },
        contact: {
          // Add company contact info here if available
          supportAvailable: true
        }
      };
    } else {
      // Admin and Super Admin get full enhanced data
      responseData = {
        ...company.toObject(),
        statistics: {
          users: userSummary,
          vehicles: vehicleSummary,
          utilization: {
            driverLimitUsed: userSummary.drivers,
            driverLimitRemaining: company.driverLimit - userSummary.drivers,
            vehicleUtilization: vehicleSummary.totalVehicles > 0 
              ? Math.round((vehicleSummary.assignedVehicles / vehicleSummary.totalVehicles) * 100)
              : 0
          }
        },
        health: {
          status: company.status,
          renewalDate: company.renewalDate,
          daysToRenewal: Math.ceil((company.renewalDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
          isNearRenewal: company.renewalDate.getTime() - new Date().getTime() < (30 * 24 * 60 * 60 * 1000) // 30 days
        }
      };
    }

    res.json({
      success: true,
      data: responseData,
      message: 'Company details retrieved successfully'
    } as ApiResponse);
  })
);

// PUT /api/companies/:id
router.put('/:id',
  authenticate,
  checkRole(['SUPER_ADMIN']),
  validate(updateCompanySchema),
  auditCompanyUpdate,
  asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const company = await Company.findByIdAndUpdate(id, updateData, { 
      new: true,
      runValidators: true 
    });
    
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: company,
      message: 'Company updated successfully'
    } as ApiResponse<ICompany>);
  })
);

export { router as companyRoutes };