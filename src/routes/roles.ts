import { Router } from 'express';
import { 
  authenticate, 
  checkRole, 
  checkCompanyAccess,
  validate,
  asyncHandler,
  createError
} from '../middleware';
import { Role, RoleAssignment, User } from '../models';
import { Permission, UserRole } from '@fleetflow/types';
import type { 
  ApiResponse,
  PaginatedResponse,
  CreateRoleRequest,
  Role as IRole
} from '@fleetflow/types';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createRoleSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Role name is required').regex(/^[A-Z_]+$/, 'Role name must be uppercase letters and underscores only'),
    displayName: z.string().min(1, 'Display name is required').max(100),
    description: z.string().min(1, 'Description is required').max(500),
    permissions: z.array(z.nativeEnum(Permission)).min(1, 'At least one permission is required'),
    companyId: z.string().optional()
  })
});

const updateRoleSchema = z.object({
  body: z.object({
    displayName: z.string().min(1).max(100).optional(),
    description: z.string().min(1).max(500).optional(),
    permissions: z.array(z.nativeEnum(Permission)).min(1).optional()
  }),
  params: z.object({
    id: z.string().min(1)
  })
});

const assignRoleSchema = z.object({
  body: z.object({
    userId: z.string().min(1, 'User ID is required'),
    roleId: z.string().min(1, 'Role ID is required'),
    expiresAt: z.string().datetime().optional()
  })
});

const assignMultipleRolesSchema = z.object({
  body: z.object({
    userId: z.string().min(1, 'User ID is required'),
    roleIds: z.array(z.string().min(1, 'Role ID is required')).min(1, 'At least one role ID is required'),
    expiresAt: z.string().datetime().optional()
  })
});

// GET /api/roles
// Get all roles (system roles + company-specific roles)
router.get('/',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN']),
  asyncHandler(async (req: any, res) => {
    const { role: userRole, companyId } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    let query: any = {};

    if (userRole === 'SUPER_ADMIN') {
      // Super admin can see all roles
      if (req.query.companyId) {
        query = { 
          $or: [
            { isSystem: true },
            { companyId: req.query.companyId }
          ]
        };
      } else if (req.query.systemOnly === 'true') {
        query = { isSystem: true };
      }
      // Default: show all roles
    } else {
      // Regular admin can only see system roles + their company roles
      query = {
        $or: [
          { isSystem: true },
          { companyId: companyId }
        ]
      };
    }

    const [roles, total] = await Promise.all([
      Role.find(query)
        .populate('companyId', 'name')
        .sort({ isSystem: -1, displayName: 1 })
        .skip(skip)
        .limit(limit),
      Role.countDocuments(query)
    ]);

    const response: PaginatedResponse<IRole> = {
      data: roles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    res.json({
      success: true,
      data: response,
      message: 'Roles retrieved successfully'
    } as ApiResponse<PaginatedResponse<IRole>>);
  })
);

// POST /api/roles
// Create a new role (Admin creates company-specific, Super Admin creates system roles)
router.post('/',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN']),
  validate(createRoleSchema),
  asyncHandler(async (req: any, res) => {
    const { role: userRole, companyId } = req.user;
    const roleData: CreateRoleRequest = req.body;

    // Validate permissions for role creation
    if (userRole === 'ADMIN') {
      // Admins can only create company-specific roles with limited permissions
      if (!roleData.companyId) {
        roleData.companyId = companyId;
      } else if (roleData.companyId !== companyId) {
        throw createError('You can only create roles for your company', 403);
      }

      // Restrict admin permissions for company roles
      const restrictedPermissions = [
        Permission.SYSTEM_SETTINGS,
        Permission.COMPANY_CREATE,
        Permission.COMPANY_DELETE,
        Permission.ROLE_MANAGEMENT
      ];

      const hasRestrictedPermissions = roleData.permissions.some(p => 
        restrictedPermissions.includes(p)
      );

      if (hasRestrictedPermissions) {
        throw createError('You cannot assign system-level permissions', 403);
      }
    } else if (userRole === 'SUPER_ADMIN') {
      // Super admin can create system roles (no companyId) or company-specific roles
      if (!roleData.companyId) {
        // This will be a system role
      }
    }

    // Check if role name already exists
    const existingRole = await Role.findOne({
      name: roleData.name,
      companyId: roleData.companyId || null
    });

    if (existingRole) {
      throw createError('Role name already exists', 400);
    }

    const role = new Role({
      name: roleData.name,
      displayName: roleData.displayName,
      description: roleData.description,
      permissions: roleData.permissions,
      companyId: roleData.companyId,
      // Only mark as system role if explicitly intended (companyId is null AND it's a super admin creating system-wide role)
      // For roles created through the UI, they should always have a companyId and be custom roles
      isSystem: false  // All roles created through the API are custom roles
    });

    await role.save();

    res.status(201).json({
      success: true,
      data: role,
      message: 'Role created successfully'
    } as ApiResponse<IRole>);
  })
);

// GET /api/roles/permissions
// Get all available permissions
router.get('/permissions',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN']),
  asyncHandler(async (req: any, res) => {
    const { role: userRole } = req.user;

    let permissions = Object.values(Permission);

    if (userRole === 'ADMIN') {
      // Filter out system-level permissions for admins
      const restrictedPermissions = [
        Permission.SYSTEM_SETTINGS,
        Permission.COMPANY_CREATE,
        Permission.COMPANY_DELETE,
        Permission.ROLE_MANAGEMENT
      ];

      permissions = permissions.filter(p => !restrictedPermissions.includes(p));
    }

    // Group permissions by category
    const groupedPermissions = {
      company: permissions.filter(p => p.startsWith('COMPANY_')),
      user: permissions.filter(p => p.startsWith('USER_')),
      driver: permissions.filter(p => p.startsWith('DRIVER_')),
      vehicle: permissions.filter(p => p.startsWith('VEHICLE_')),
      expense: permissions.filter(p => p.startsWith('EXPENSE_')),
      report: permissions.filter(p => p.startsWith('REPORT_') || p === Permission.DASHBOARD_VIEW),
      system: permissions.filter(p => p.startsWith('SYSTEM_') || p === Permission.AUDIT_LOG_VIEW || p === Permission.ROLE_MANAGEMENT)
    };

    res.json({
      success: true,
      data: {
        all: permissions,
        grouped: groupedPermissions
      },
      message: 'Permissions retrieved successfully'
    } as ApiResponse);
  })
);

// GET /api/roles/:id
// Get a specific role
router.get('/:id',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN']),
  asyncHandler(async (req: any, res) => {
    const { role: userRole, companyId } = req.user;
    const { id } = req.params;

    let query: any = { _id: id };

    if (userRole === 'ADMIN') {
      // Admins can only see system roles or their company roles
      query = {
        _id: id,
        $or: [
          { isSystem: true },
          { companyId: companyId }
        ]
      };
    }

    const role = await Role.findOne(query).populate('companyId', 'name');

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: role,
      message: 'Role retrieved successfully'
    } as ApiResponse<IRole>);
  })
);

// PUT /api/roles/:id
// Update a role (cannot update system roles unless super admin)
router.put('/:id',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN']),
  validate(updateRoleSchema),
  asyncHandler(async (req: any, res) => {
    const { role: userRole, companyId } = req.user;
    const { id } = req.params;
    const updateData = req.body;

    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      } as ApiResponse);
    }

    // Check permissions
    if (userRole === 'ADMIN') {
      if (role.isSystem) {
        throw createError('Cannot update system roles', 403);
      }
      if (role.companyId?.toString() !== companyId) {
        throw createError('Cannot update roles from other companies', 403);
      }

      // Check for restricted permissions
      if (updateData.permissions) {
        const restrictedPermissions = [
          Permission.SYSTEM_SETTINGS,
          Permission.COMPANY_CREATE,
          Permission.COMPANY_DELETE,
          Permission.ROLE_MANAGEMENT
        ];

        const hasRestrictedPermissions = updateData.permissions.some(p => 
          restrictedPermissions.includes(p)
        );

        if (hasRestrictedPermissions) {
          throw createError('You cannot assign system-level permissions', 403);
        }
      }
    }

    Object.assign(role, updateData);
    await role.save();

    res.json({
      success: true,
      data: role,
      message: 'Role updated successfully'
    } as ApiResponse<IRole>);
  })
);

// DELETE /api/roles/:id
// Delete a role (system roles cannot be deleted)
router.delete('/:id',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN']),
  asyncHandler(async (req: any, res) => {
    const { role: userRole, companyId } = req.user;
    const { id } = req.params;

    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      } as ApiResponse);
    }

    if (role.isSystem) {
      return res.status(400).json({
        success: false,
        message: 'System roles cannot be deleted'
      } as ApiResponse);
    }

    // Check permissions
    if (userRole === 'ADMIN' && role.companyId?.toString() !== companyId) {
      throw createError('Cannot delete roles from other companies', 403);
    }

    // Check if role is assigned to any users
    const assignmentCount = await RoleAssignment.countDocuments({ roleId: id });
    if (assignmentCount > 0) {
      // Check if force delete is requested (with cleanup of assignments)
      const forceDelete = req.query.force === 'true';

      if (forceDelete) {
        // Remove all assignments for this role
        await RoleAssignment.deleteMany({ roleId: id });
        console.log(`Removed ${assignmentCount} role assignments for role ${id}`);
      } else {
        return res.status(400).json({
          success: false,
          message: `Cannot delete role that is assigned to ${assignmentCount} user(s). Add ?force=true to delete anyway and remove all assignments.`
        } as ApiResponse);
      }
    }

    await Role.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Role deleted successfully'
    } as ApiResponse);
  })
);

// POST /api/roles/assign
// Assign a role to a user
router.post('/assign',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN']),
  validate(assignRoleSchema),
  asyncHandler(async (req: any, res) => {
    const { role: userRole, companyId, userId: assignerId } = req.user;
    const { userId, roleId, expiresAt } = req.body;

    // Verify user exists and check permissions
    const user = await User.findById(userId);
    if (!user) {
      throw createError('User not found', 404);
    }

    if (userRole === 'ADMIN' && user.companyId !== companyId) {
      throw createError('Cannot assign roles to users from other companies', 403);
    }

    // Verify role exists and check permissions
    const role = await Role.findById(roleId);
    if (!role) {
      throw createError('Role not found', 404);
    }

    if (userRole === 'ADMIN') {
      if (role.isSystem) {
        throw createError('Cannot assign system roles', 403);
      }
      if (role.companyId?.toString() !== companyId) {
        throw createError('Cannot assign roles from other companies', 403);
      }
    }

    // Check if assignment already exists
    const existingAssignment = await RoleAssignment.findOne({ userId, roleId });
    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'User already has this role assigned'
      } as ApiResponse);
    }

    // Create assignment
    const assignment = new RoleAssignment({
      userId,
      roleId,
      assignedBy: assignerId,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    });

    await assignment.save();

    res.status(201).json({
      success: true,
      data: assignment,
      message: 'Role assigned successfully'
    } as ApiResponse);
  })
);

// POST /api/roles/assign-multiple
// Assign multiple roles to a user (replaces existing assignments)
router.post('/assign-multiple',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN']),
  validate(assignMultipleRolesSchema),
  asyncHandler(async (req: any, res) => {
    const { role: userRole, companyId, userId: assignerId } = req.user;
    const { userId, roleIds, expiresAt } = req.body;

    // Verify user exists and check permissions
    const user = await User.findById(userId);
    if (!user) {
      throw createError('User not found', 404);
    }


    if (userRole === 'ADMIN' && user.companyId && user.companyId.toString() !== companyId) {
      throw createError('Cannot assign roles to users from other companies', 403);
    }

    // Verify all roles exist and check permissions
    const roles = await Role.find({ _id: { $in: roleIds } });
    if (roles.length !== roleIds.length) {
      throw createError('One or more roles not found', 404);
    }

    for (const role of roles) {
      if (userRole === 'ADMIN' && role.isSystem) {
        throw createError(`Cannot assign system role: ${role.displayName}`, 403);
      }

      if (userRole === 'ADMIN' && role.companyId && role.companyId.toString() !== companyId) {
        throw createError(`Cannot assign role from other company: ${role.displayName}`, 403);
      }
    }

    // Remove existing assignments
    await RoleAssignment.deleteMany({ userId });

    // Create new assignments
    const assignments = roleIds.map(roleId => ({
      userId,
      roleId,
      assignedBy: assignerId,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    }));

    const createdAssignments = await RoleAssignment.insertMany(assignments);

    res.status(201).json({
      success: true,
      data: createdAssignments,
      message: 'Roles assigned successfully'
    } as ApiResponse);
  })
);

// DELETE /api/roles/assign/:userId/:roleId
// Remove a role assignment
router.delete('/assign/:userId/:roleId',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN']),
  asyncHandler(async (req: any, res) => {
    const { role: userRole, companyId } = req.user;
    const { userId, roleId } = req.params;

    // Check permissions
    if (userRole === 'ADMIN') {
      const user = await User.findById(userId);
      if (!user || user.companyId !== companyId) {
        throw createError('Cannot manage role assignments for users from other companies', 403);
      }
    }

    const assignment = await RoleAssignment.findOne({ userId, roleId });
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Role assignment not found'
      } as ApiResponse);
    }

    await RoleAssignment.findByIdAndDelete(assignment._id);

    res.json({
      success: true,
      message: 'Role assignment removed successfully'
    } as ApiResponse);
  })
);

// GET /api/roles/user/:userId
// Get all roles assigned to a user
router.get('/user/:userId',
  authenticate,
  checkRole(['SUPER_ADMIN', 'ADMIN']),
  asyncHandler(async (req: any, res) => {
    const { role: userRole, companyId } = req.user;
    const { userId } = req.params;

    // Check permissions
    if (userRole === 'ADMIN') {
      const user = await User.findById(userId);
      if (!user || user.companyId !== companyId) {
        throw createError('Cannot view role assignments for users from other companies', 403);
      }
    }

    const assignments = await RoleAssignment.find({ userId })
      .populate('roleId')
      .populate('assignedBy', 'name email')
      .sort({ assignedAt: -1 });

    res.json({
      success: true,
      data: assignments,
      message: 'User role assignments retrieved successfully'
    } as ApiResponse);
  })
);


export { router as roleRoutes };