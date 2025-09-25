const express = require('express');
const { asyncHandler, authenticate, checkRole } = require('../middleware');

const router = express.Router();

// GET /api/roles
router.get('/', authenticate, checkRole(['SUPER_ADMIN', 'ADMIN']), asyncHandler(async (req, res) => {
  const systemRoles = [
    {
      _id: 'role_super_admin',
      name: 'SUPER_ADMIN',
      displayName: 'Super Admin',
      description: 'Full system access across all companies',
      permissions: ['COMPANY_CREATE', 'COMPANY_READ', 'COMPANY_UPDATE', 'COMPANY_DELETE', 'USER_CREATE', 'USER_READ', 'USER_UPDATE', 'USER_DELETE', 'USER_ASSIGN_ROLE', 'DRIVER_CREATE', 'DRIVER_READ', 'DRIVER_UPDATE', 'DRIVER_DELETE', 'VEHICLE_CREATE', 'VEHICLE_READ', 'VEHICLE_UPDATE', 'VEHICLE_DELETE', 'VEHICLE_ASSIGN', 'EXPENSE_CREATE', 'EXPENSE_READ', 'EXPENSE_UPDATE', 'EXPENSE_DELETE', 'EXPENSE_APPROVE', 'EXPENSE_EXPORT', 'REPORT_VIEW', 'REPORT_EXPORT', 'DASHBOARD_VIEW', 'SYSTEM_SETTINGS', 'AUDIT_LOG_VIEW', 'ROLE_MANAGEMENT'],
      isSystem: true,
      companyId: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z')
    },
    {
      _id: 'role_admin',
      name: 'ADMIN',
      displayName: 'Admin',
      description: 'Company administration and user management',
      permissions: ['USER_CREATE', 'USER_READ', 'USER_UPDATE', 'USER_DELETE', 'USER_ASSIGN_ROLE', 'DRIVER_CREATE', 'DRIVER_READ', 'DRIVER_UPDATE', 'DRIVER_DELETE', 'VEHICLE_CREATE', 'VEHICLE_READ', 'VEHICLE_UPDATE', 'VEHICLE_DELETE', 'VEHICLE_ASSIGN', 'EXPENSE_READ', 'EXPENSE_UPDATE', 'EXPENSE_DELETE', 'EXPENSE_APPROVE', 'EXPENSE_EXPORT', 'REPORT_VIEW', 'REPORT_EXPORT', 'DASHBOARD_VIEW', 'AUDIT_LOG_VIEW', 'ROLE_MANAGEMENT'],
      isSystem: true,
      companyId: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z')
    },
    {
      _id: 'role_manager',
      name: 'MANAGER',
      displayName: 'Manager',
      description: 'Fleet management and expense oversight',
      permissions: ['DRIVER_READ', 'VEHICLE_READ', 'VEHICLE_UPDATE', 'VEHICLE_ASSIGN', 'EXPENSE_READ', 'EXPENSE_APPROVE', 'EXPENSE_EXPORT', 'REPORT_VIEW', 'DASHBOARD_VIEW'],
      isSystem: true,
      companyId: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z')
    },
    {
      _id: 'role_driver',
      name: 'DRIVER',
      displayName: 'Driver',
      description: 'Mobile app access for expense submission',
      permissions: ['EXPENSE_CREATE', 'EXPENSE_READ', 'EXPENSE_UPDATE'],
      isSystem: true,
      companyId: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z')
    },
    {
      _id: 'role_viewer',
      name: 'VIEWER',
      displayName: 'Viewer',
      description: 'Read-only access to reports and data',
      permissions: ['EXPENSE_READ', 'REPORT_VIEW', 'DASHBOARD_VIEW'],
      isSystem: true,
      companyId: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z')
    },
  ];

  res.json({
    success: true,
    data: systemRoles,
    message: 'Roles retrieved successfully',
  });
}));

// GET /api/roles/permissions
router.get('/permissions', authenticate, checkRole(['SUPER_ADMIN', 'ADMIN']), asyncHandler(async (req, res) => {
  const allPermissions = [
    'COMPANY_CREATE', 'COMPANY_READ', 'COMPANY_UPDATE', 'COMPANY_DELETE',
    'USER_CREATE', 'USER_READ', 'USER_UPDATE', 'USER_DELETE', 'USER_ASSIGN_ROLE',
    'DRIVER_CREATE', 'DRIVER_READ', 'DRIVER_UPDATE', 'DRIVER_DELETE',
    'VEHICLE_CREATE', 'VEHICLE_READ', 'VEHICLE_UPDATE', 'VEHICLE_DELETE', 'VEHICLE_ASSIGN',
    'EXPENSE_CREATE', 'EXPENSE_READ', 'EXPENSE_UPDATE', 'EXPENSE_DELETE', 'EXPENSE_APPROVE', 'EXPENSE_EXPORT',
    'REPORT_VIEW', 'REPORT_EXPORT', 'DASHBOARD_VIEW',
    'SYSTEM_SETTINGS', 'AUDIT_LOG_VIEW', 'ROLE_MANAGEMENT'
  ];

  const groupedPermissions = {
    company: ['COMPANY_CREATE', 'COMPANY_READ', 'COMPANY_UPDATE', 'COMPANY_DELETE'],
    user: ['USER_CREATE', 'USER_READ', 'USER_UPDATE', 'USER_DELETE', 'USER_ASSIGN_ROLE'],
    driver: ['DRIVER_CREATE', 'DRIVER_READ', 'DRIVER_UPDATE', 'DRIVER_DELETE'],
    vehicle: ['VEHICLE_CREATE', 'VEHICLE_READ', 'VEHICLE_UPDATE', 'VEHICLE_DELETE', 'VEHICLE_ASSIGN'],
    expense: ['EXPENSE_CREATE', 'EXPENSE_READ', 'EXPENSE_UPDATE', 'EXPENSE_DELETE', 'EXPENSE_APPROVE', 'EXPENSE_EXPORT'],
    reports: ['REPORT_VIEW', 'REPORT_EXPORT', 'DASHBOARD_VIEW'],
    system: ['SYSTEM_SETTINGS', 'AUDIT_LOG_VIEW', 'ROLE_MANAGEMENT']
  };

  res.json({
    success: true,
    data: {
      all: allPermissions,
      grouped: groupedPermissions
    },
    message: 'Permissions retrieved successfully',
  });
}));

module.exports = router;