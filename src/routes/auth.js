const express = require('express');
const { User, AuditLog } = require('../models');
const { asyncHandler, authenticate, generateTokens, verifyRefreshToken } = require('../middleware');
const { getClientIP } = require('../utils/helpers');

const router = express.Router();

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
    });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user || user.status !== 'ACTIVE') {
    try {
      if (user && user.status !== 'ACTIVE') {
        await AuditLog.create({
          timestamp: new Date(),
          userId: user._id,
          role: user.role,
          companyId: user.companyId,
          action: 'LOGIN',
          module: 'AUTH',
          referenceIds: { email: email.toLowerCase() },
          status: 'FAILED',
          details: `Failed login attempt: ${email.toLowerCase()} - Account inactive`,
          ipAddress: getClientIP(req),
          userAgent: req.headers['user-agent'],
        });
      }
    } catch (error) {
      console.error('Failed login audit logging failed:', error);
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid credentials or account inactive',
    });
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    try {
      await AuditLog.create({
        timestamp: new Date(),
        userId: user._id,
        role: user.role,
        companyId: user.companyId,
        action: 'LOGIN',
        module: 'AUTH',
        referenceIds: { email: user.email },
        status: 'FAILED',
        details: `Failed login attempt: ${user.email} - Invalid password`,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'],
      });
    } catch (error) {
      console.error('Failed password audit logging failed:', error);
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  const tokenPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    companyId: user.companyId?.toString(),
  };

  const tokens = generateTokens(tokenPayload);

  user.lastActive = new Date();
  await user.save();

  try {
    await AuditLog.create({
      timestamp: new Date(),
      userId: user._id,
      role: user.role,
      companyId: user.companyId,
      action: 'LOGIN',
      module: 'AUTH',
      referenceIds: { email: user.email },
      status: 'SUCCESS',
      details: `User login: ${user.email}`,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
    });
  } catch (error) {
    console.error('Login audit logging failed:', error);
  }

  const userData = user.toObject();
  delete userData.passwordHash;

  res.json({
    success: true,
    data: {
      user: userData,
      tokens,
    },
    message: 'Login successful',
  });
}));

// POST /api/auth/refresh
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token is required',
    });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);

    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      companyId: user.companyId?.toString(),
    };

    const tokens = generateTokens(tokenPayload);

    user.lastActive = new Date();
    await user.save();

    res.json({
      success: true,
      data: tokens,
      message: 'Token refreshed successfully',
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
    });
  }
}));

// GET /api/auth/me
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).populate('companyId', 'name plan status');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  res.json({
    success: true,
    data: user,
    message: 'User data retrieved successfully',
  });
}));

// POST /api/auth/logout
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  try {
    await AuditLog.create({
      timestamp: new Date(),
      userId: req.user.userId,
      role: req.user.role,
      companyId: req.user.companyId,
      action: 'LOGOUT',
      module: 'AUTH',
      referenceIds: { userId: req.user.userId },
      status: 'SUCCESS',
      details: `User logout: ${req.user.email}`,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'],
    });
  } catch (error) {
    console.error('Logout audit logging failed:', error);
  }

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
}));

module.exports = router;