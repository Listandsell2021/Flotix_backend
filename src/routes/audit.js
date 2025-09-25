const express = require('express');
const { AuditLog } = require('../models');
const { asyncHandler, authenticate, checkRole, checkCompanyAccess } = require('../middleware');

const router = express.Router();

// GET /api/audit
router.get('/', authenticate, checkRole(['SUPER_ADMIN', 'ADMIN']), checkCompanyAccess, asyncHandler(async (req, res) => {
  const { role, companyId: userCompanyId } = req.user;
  const page = parseInt(req.query.page || '1');
  const limit = Math.min(parseInt(req.query.limit || '20'), 100);
  const skip = (page - 1) * limit;

  let query = {};
  if (role === 'SUPER_ADMIN' && req.query.companyId) {
    query.companyId = req.query.companyId;
  } else if (role !== 'SUPER_ADMIN') {
    query.companyId = userCompanyId;
  }

  if (req.query.action) query.action = req.query.action;
  if (req.query.module) query.module = req.query.module;
  if (req.query.status) query.status = req.query.status;
  if (req.query.userId) query.userId = req.query.userId;

  if (req.query.dateFrom || req.query.dateTo) {
    query.timestamp = {};
    if (req.query.dateFrom) query.timestamp.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) query.timestamp.$lte = new Date(req.query.dateTo);
  }

  const auditLogs = await AuditLog.find(query)
    .populate('userId', 'name email')
    .populate('companyId', 'name')
    .skip(skip)
    .limit(limit)
    .sort({ timestamp: -1 });

  const total = await AuditLog.countDocuments(query);

  res.json({
    success: true,
    data: {
      data: auditLogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
    message: 'Audit logs retrieved successfully',
  });
}));

module.exports = router;