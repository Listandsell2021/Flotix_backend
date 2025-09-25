const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { User } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);

      const user = await User.findById(decoded.userId);
      if (!user || user.status !== 'ACTIVE') {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      user.lastActive = new Date();
      await user.save();

      req.user = decoded;
      next();
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

const checkCompanyAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const requestedCompanyId = req.params.companyId || req.body.companyId || req.query.companyId;

    if (requestedCompanyId && req.user.companyId !== requestedCompanyId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this company'
      });
    }

    next();
  } catch (error) {
    console.error('Company access check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};

const generateTokens = (payload) => {
  const isDriver = payload.role === 'DRIVER';

  const accessToken = jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: isDriver ? config.JWT_DRIVER_ACCESS_EXPIRES_IN : config.JWT_ACCESS_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: isDriver ? config.JWT_DRIVER_REFRESH_EXPIRES_IN : config.JWT_REFRESH_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.JWT_REFRESH_SECRET);
};

module.exports = {
  authenticate,
  checkRole,
  checkCompanyAccess,
  generateTokens,
  verifyRefreshToken,
};