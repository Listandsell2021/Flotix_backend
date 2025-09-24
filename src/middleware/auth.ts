import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JWTPayload, UserRole } from '@fleetflow/types';
import { config } from '../config';
import { User } from '../models/User';

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
      const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as JWTPayload;
      
      // Verify user still exists and is active
      const user = await User.findById(decoded.userId);
      if (!user || user.status !== 'ACTIVE') {
        return res.status(401).json({ 
          success: false, 
          message: 'User not found or inactive' 
        });
      }

      // Update last active timestamp
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

export const checkRole = (allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
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

export const checkCompanyAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Super admins can access all companies
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Check if user has access to the company
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

export const generateTokens = (payload: JWTPayload) => {
  // Use longer expiry times for drivers using mobile app
  const isDriver = payload.role === 'DRIVER';
  
  const accessToken = jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: isDriver ? config.JWT_DRIVER_ACCESS_EXPIRES_IN : config.JWT_ACCESS_EXPIRES_IN,
  });
  
  const refreshToken = jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: isDriver ? config.JWT_DRIVER_REFRESH_EXPIRES_IN : config.JWT_REFRESH_EXPIRES_IN,
  });
  
  return { accessToken, refreshToken };
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as JWTPayload;
};