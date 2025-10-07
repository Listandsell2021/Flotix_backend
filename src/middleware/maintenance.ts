import { Request, Response, NextFunction } from 'express';
import { SystemSettings } from '../models';
import { UserRole } from '../types';

/**
 * Middleware to check if system is in maintenance mode
 * Super Admins can bypass maintenance mode
 * Note: This should be applied AFTER authentication middleware
 */
export const checkMaintenance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip maintenance check for login and health check endpoints
    if (req.path.includes('/auth/login') || req.path.includes('/health')) {
      return next();
    }

    // Get system settings
    const settings = await SystemSettings.findOne();

    // If no settings or maintenance mode is off, continue
    if (!settings || !settings.maintenanceMode) {
      return next();
    }

    // Check if user is authenticated and is Super Admin
    const user = (req as any).user;
    if (user && user.role === UserRole.SUPER_ADMIN) {
      // Super Admins can bypass maintenance mode
      console.log('🔓 Super Admin bypassing maintenance mode');
      return next();
    }

    // System is in maintenance mode - block access
    console.log('🚧 Maintenance mode active - blocking request');
    res.status(503).json({
      success: false,
      error: 'System Maintenance',
      message: settings.maintenanceMessage ||
        'The system is currently undergoing maintenance. Please check back soon.',
      maintenanceMode: true,
    });
  } catch (error) {
    console.error('Error checking maintenance mode:', error);
    // If there's an error checking maintenance, allow the request to proceed
    next();
  }
};
