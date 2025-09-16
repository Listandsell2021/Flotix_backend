import { Request, Response, NextFunction } from 'express';
import { 
  AuditAction, 
  AuditModule, 
  AuditStatus 
} from '../shared-types/src';
import { AuditLog } from '../models/AuditLog';
import type { AuthRequest } from './auth';

export interface AuditOptions {
  action: AuditAction;
  module: AuditModule;
  getReferenceIds?: (req: AuthRequest, res: Response) => Record<string, string>;
  getDetails?: (req: AuthRequest, res: Response) => string;
}

export const auditLog = (options: AuditOptions) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    let responseBody: any;
    let auditStatus: AuditStatus = AuditStatus.SUCCESS;

    // Capture response body
    res.send = function (body: any) {
      responseBody = body;
      
      // Determine audit status based on response
      if (res.statusCode >= 400) {
        auditStatus = AuditStatus.FAILED;
      }
      
      return originalSend.call(this, body);
    };

    // Continue with the request
    next();

    // Log the audit after response
    res.on('finish', async () => {
      try {
        if (!req.user) return;

        const referenceIds = options.getReferenceIds 
          ? options.getReferenceIds(req, res) 
          : {};

        // Add common reference IDs
        if (req.params.id) referenceIds.resourceId = req.params.id;
        if (req.params.companyId) referenceIds.companyId = req.params.companyId;
        if (req.params.userId) referenceIds.userId = req.params.userId;

        const details = options.getDetails 
          ? options.getDetails(req, res) 
          : undefined;

        await AuditLog.create({
          timestamp: new Date(),
          userId: req.user.userId,
          role: req.user.role,
          companyId: req.user.companyId,
          action: options.action,
          module: options.module,
          referenceIds,
          status: auditStatus,
          details,
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'],
        });
      } catch (error) {
        console.error('Audit logging failed:', error);
        // Don't throw - audit logging failure shouldn't affect the main request
      }
    });
  };
};

export const getClientIP = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded 
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0])
    : req.connection.remoteAddress || req.socket.remoteAddress;
    
  return typeof ip === 'string' ? ip.trim() : 'unknown';
};

// Predefined audit decorators for common operations
export const auditUserCreate = auditLog({
  action: AuditAction.CREATE,
  module: AuditModule.USER,
  getReferenceIds: (req) => ({
    email: req.body.email,
    role: req.body.role,
  }),
  getDetails: (req) => `Created ${req.body.role} user: ${req.body.email}`,
});

export const auditUserUpdate = auditLog({
  action: AuditAction.UPDATE,
  module: AuditModule.USER,
  getReferenceIds: (req) => ({
    userId: req.params.id,
  }),
  getDetails: (req) => `Updated user: ${req.params.id}`,
});

export const auditUserDelete = auditLog({
  action: AuditAction.DELETE,
  module: AuditModule.USER,
  getReferenceIds: (req) => ({
    userId: req.params.id,
  }),
  getDetails: (req) => `Deleted user: ${req.params.id}`,
});

export const auditExpenseCreate = auditLog({
  action: AuditAction.CREATE,
  module: AuditModule.EXPENSE,
  getReferenceIds: (req) => ({
    type: req.body.type,
    amount: req.body.amountFinal.toString(),
  }),
  getDetails: (req) => `Created ${req.body.type} expense: $${req.body.amountFinal}`,
});

export const auditExpenseUpdate = auditLog({
  action: AuditAction.UPDATE,
  module: AuditModule.EXPENSE,
  getReferenceIds: (req) => ({
    expenseId: req.params.id,
  }),
  getDetails: (req) => `Updated expense: ${req.params.id}`,
});

export const auditExpenseDelete = auditLog({
  action: AuditAction.DELETE,
  module: AuditModule.EXPENSE,
  getReferenceIds: (req) => ({
    expenseId: req.params.id,
  }),
  getDetails: (req) => `Deleted expense: ${req.params.id}`,
});

export const auditReportExport = auditLog({
  action: AuditAction.EXPORT,
  module: AuditModule.REPORT,
  getReferenceIds: (req) => ({
    format: req.query.format as string || 'unknown',
    dateRange: `${req.query.dateFrom}-${req.query.dateTo}`,
  }),
  getDetails: (req) => `Exported ${req.query.format || 'report'} for ${req.query.dateFrom}-${req.query.dateTo}`,
});

export const auditCompanyCreate = auditLog({
  action: AuditAction.CREATE,
  module: AuditModule.COMPANY,
  getReferenceIds: (req) => ({
    companyName: req.body.name,
  }),
  getDetails: (req) => `Created company: ${req.body.name}`,
});

export const auditCompanyUpdate = auditLog({
  action: AuditAction.UPDATE,
  module: AuditModule.COMPANY,
  getReferenceIds: (req) => ({
    companyId: req.params.id,
  }),
  getDetails: (req) => `Updated company: ${req.params.id}`,
});

// Vehicle audit decorators
export const auditVehicleCreate = auditLog({
  action: AuditAction.CREATE,
  module: AuditModule.VEHICLE,
  getReferenceIds: (req) => ({
    licensePlate: req.body.licensePlate,
    make: req.body.make,
    model: req.body.model,
  }),
  getDetails: (req) => `Created vehicle: ${req.body.make} ${req.body.model} (${req.body.licensePlate})`,
});

export const auditVehicleUpdate = auditLog({
  action: AuditAction.UPDATE,
  module: AuditModule.VEHICLE,
  getReferenceIds: (req) => ({
    vehicleId: req.params.id,
  }),
  getDetails: (req) => `Updated vehicle: ${req.params.id}`,
});

export const auditVehicleDelete = auditLog({
  action: AuditAction.DELETE,
  module: AuditModule.VEHICLE,
  getReferenceIds: (req) => ({
    vehicleId: req.params.id,
  }),
  getDetails: (req) => `Deleted vehicle: ${req.params.id}`,
});

export const auditVehicleAssign = auditLog({
  action: AuditAction.UPDATE,
  module: AuditModule.VEHICLE,
  getReferenceIds: (req) => ({
    vehicleId: req.params.id,
    driverId: req.body.driverId,
  }),
  getDetails: (req) => `Assigned vehicle ${req.params.id} to driver ${req.body.driverId}`,
});

export const auditVehicleUnassign = auditLog({
  action: AuditAction.UPDATE,
  module: AuditModule.VEHICLE,
  getReferenceIds: (req) => ({
    vehicleId: req.params.id,
  }),
  getDetails: (req) => `Unassigned vehicle: ${req.params.id}`,
});