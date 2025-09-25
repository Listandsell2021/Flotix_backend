const express = require('express');
const { Company } = require('../models');
const { asyncHandler, authenticate, checkRole } = require('../middleware');

const router = express.Router();

// GET /api/companies
router.get('/', authenticate, checkRole(['SUPER_ADMIN']), asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || '1');
  const limit = Math.min(parseInt(req.query.limit || '20'), 100);
  const skip = (page - 1) * limit;

  let query = {};
  if (req.query.status) {
    query.status = req.query.status;
  }

  const companies = await Company.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await Company.countDocuments(query);

  res.json({
    success: true,
    data: {
      data: companies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
    message: 'Companies retrieved successfully',
  });
}));

module.exports = router;