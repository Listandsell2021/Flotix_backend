import { Request, Response, NextFunction } from 'express';
import { Role, RoleAssignment } from '../models';
import { Permission, UserRole } from '../types';
import { createError } from './errorHandler';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    role: UserRole;
    companyId?: string;
  };
}

// Default permissions for system roles (backward compatibility)
const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    // Super Admin has all permissions
    ...Object.values(Permission)
  ],
  [UserRole.ADMIN]: [
    Permission.COMPANY_READ,
    Permission.COMPANY_UPDATE,
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.DRIVER_CREATE,
    Permission.DRIVER_READ,
    Permission.DRIVER_UPDATE,
    Permission.DRIVER_DELETE,
    Permission.VEHICLE_CREATE,
    Permission.VEHICLE_READ,
    Permission.VEHICLE_UPDATE,
    Permission.VEHICLE_DELETE,
    Permission.VEHICLE_ASSIGN,
    Permission.EXPENSE_CREATE,
    Permission.EXPENSE_READ,
    Permission.EXPENSE_UPDATE,
    Permission.EXPENSE_DELETE,
    Permission.EXPENSE_APPROVE,
    Permission.EXPENSE_EXPORT,
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
    Permission.DASHBOARD_VIEW,
    Permission.AUDIT_LOG_VIEW
  ],
  [UserRole.MANAGER]: [
    Permission.DRIVER_READ,
    Permission.DRIVER_UPDATE,
    Permission.VEHICLE_READ,
    Permission.VEHICLE_UPDATE,
    Permission.VEHICLE_ASSIGN,
    Permission.EXPENSE_READ,
    Permission.EXPENSE_APPROVE,
    Permission.EXPENSE_EXPORT,
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
    Permission.DASHBOARD_VIEW
  ],
  [UserRole.VIEWER]: [
    Permission.DRIVER_READ,
    Permission.VEHICLE_READ,
    Permission.EXPENSE_READ,
    Permission.REPORT_VIEW,
    Permission.DASHBOARD_VIEW
  ],
  [UserRole.DRIVER]: [
    Permission.EXPENSE_CREATE,
    Permission.EXPENSE_READ,
    Permission.EXPENSE_UPDATE,
    Permission.EXPENSE_DELETE,
    Permission.VEHICLE_READ
  ]
};

// Cache for user permissions to avoid repeated database queries
const permissionCache = new Map<string, { permissions: Permission[], timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get all permissions for a user (default role permissions + custom role permissions)
 */
export async function getUserPermissions(userId: string, userRole: UserRole): Promise<Permission[]> {
  // Check cache first
  const cached = permissionCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.permissions;
  }

  // Start with default permissions for the user's primary role
  const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[userRole] || [];
  let allPermissions = new Set(defaultPermissions);

  try {
    // Get custom role assignments
    const assignments = await RoleAssignment.find({ userId })
      .populate('roleId')
      .exec();

    // Add permissions from custom roles
    for (const assignment of assignments) {
      const role = assignment.roleId as any;
      if (role && role.permissions) {
        role.permissions.forEach((permission: Permission) => {
          allPermissions.add(permission);
        });
      }
    }
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    // Return default permissions if custom role lookup fails
  }

  const permissions = Array.from(allPermissions);
  
  // Cache the result
  permissionCache.set(userId, {
    permissions,
    timestamp: Date.now()
  });

  return permissions;
}

/**
 * Clear permission cache for a user (call when roles are assigned/unassigned)
 */
export function clearUserPermissionCache(userId: string) {
  permissionCache.delete(userId);
}

/**
 * Clear all permission cache (call when roles are modified)
 */
export function clearAllPermissionCache() {
  permissionCache.clear();
}

/**
 * Middleware to check if user has specific permissions
 */
export function checkPermission(requiredPermissions: Permission | Permission[]) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw createError('Authentication required', 401);
      }

      const { userId, role } = req.user;
      const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

      // Get user's permissions
      const userPermissions = await getUserPermissions(userId, role);

      // Check if user has all required permissions
      const hasPermissions = permissions.every(permission => 
        userPermissions.includes(permission)
      );

      if (!hasPermissions) {
        throw createError(`Missing required permissions: ${permissions.join(', ')}`, 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Utility to check permissions without middleware (for conditional logic)
 */
export async function hasPermission(userId: string, userRole: UserRole, permission: Permission): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId, userRole);
  return userPermissions.includes(permission);
}

/**
 * Utility to check multiple permissions
 */
export async function hasPermissions(userId: string, userRole: UserRole, permissions: Permission[]): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId, userRole);
  return permissions.every(permission => userPermissions.includes(permission));
}

/**
 * Utility to get permissions that a user is missing from a required set
 */
export async function getMissingPermissions(userId: string, userRole: UserRole, requiredPermissions: Permission[]): Promise<Permission[]> {
  const userPermissions = await getUserPermissions(userId, userRole);
  return requiredPermissions.filter(permission => !userPermissions.includes(permission));
}