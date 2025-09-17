import { Router } from 'express';
import { 
  authenticate, 
  checkRole,
  checkCompanyAccess,
  validate,
  paginationSchema,
  asyncHandler
} from '../middleware';
import { AuditLog } from '../models';
import type { 
  UserRole, 
  ApiResponse,
  PaginatedResponse,
  AuditLog as IAuditLog
} from '@fleetflow/types';

const router = Router();

// GET /api/audit
router.get('/',
  authenticate,
  checkRole(['ADMIN', 'SUPER_ADMIN']),
  validate(paginationSchema),
  asyncHandler(async (req: any, res) => {
    const { role, companyId } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = (page - 1) * limit;

    // Build query based on role
    let query: any = {};
    
    if (role === 'ADMIN') {
      query.companyId = companyId;
    }

    // Apply filters
    if (req.query.action) query.action = req.query.action;
    if (req.query.module) query.module = req.query.module;
    if (req.query.status) query.status = req.query.status;
    if (req.query.userId) query.userId = req.query.userId;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('userId', 'name email')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(query)
    ]);

    const response: PaginatedResponse<IAuditLog> = {
      data: logs,
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
      message: 'Audit logs retrieved successfully'
    } as ApiResponse<PaginatedResponse<IAuditLog>>);
  })
);

export { router as auditRoutes };