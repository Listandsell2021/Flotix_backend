import { Router, Request, Response } from 'express';
import { authenticate, checkRole, asyncHandler } from '../middleware';
import { SystemSettings } from '../models';
import { UserRole, ApiResponse } from '../types';

const router = Router();

// GET /api/system-settings - Get system settings (Super Admin only)
router.get(
  '/system-settings',
  authenticate,
  checkRole([UserRole.SUPER_ADMIN]),
  asyncHandler(async (req: Request, res: Response) => {
    let settings = await SystemSettings.findOne();

    // Create default settings if none exist
    if (!settings) {
      settings = new SystemSettings({});
      await settings.save();
    }

    res.json({
      success: true,
      data: settings,
    } as ApiResponse);
  })
);

// PUT /api/system-settings - Update system settings (Super Admin only)
router.put(
  '/system-settings',
  authenticate,
  checkRole([UserRole.SUPER_ADMIN]),
  asyncHandler(async (req: Request, res: Response) => {
    console.log('⚙️ PUT /system-settings - Request body:', req.body);
    let settings = await SystemSettings.findOne();

    if (!settings) {
      console.log('💾 Creating new system settings...');
      settings = new SystemSettings(req.body);
    } else {
      console.log('🔄 Updating existing system settings...');
      // Update fields
      Object.assign(settings, req.body);
    }

    await settings.save();
    console.log('✅ System settings saved to database:', settings._id);

    res.json({
      success: true,
      data: settings,
      message: 'System settings updated successfully',
    } as ApiResponse);
  })
);

// PATCH /api/system-settings/maintenance - Toggle maintenance mode (Super Admin only)
router.patch(
  '/system-settings/maintenance',
  authenticate,
  checkRole([UserRole.SUPER_ADMIN]),
  asyncHandler(async (req: Request, res: Response) => {
    const { enabled, message } = req.body;

    let settings = await SystemSettings.findOne();

    if (!settings) {
      settings = new SystemSettings({});
    }

    settings.maintenanceMode = enabled === true;
    if (message !== undefined) {
      settings.maintenanceMessage = message;
    }

    await settings.save();

    res.json({
      success: true,
      data: {
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
      },
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
    } as ApiResponse);
  })
);

export const systemSettingsRoutes = router;
export default router;
