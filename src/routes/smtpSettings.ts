import { Router, Request, Response } from 'express';
import { authenticate, checkRole, asyncHandler } from '../middleware';
import { SmtpSettings } from '../models';
import { EmailService } from '../modules';
import { UserRole, ApiResponse } from '../types';

const router = Router();

// GET /api/smtp-settings - Get current SMTP settings (Super Admin only)
router.get(
  '/smtp-settings',
  authenticate,
  checkRole([UserRole.SUPER_ADMIN]),
  asyncHandler(async (req: Request, res: Response) => {
    const settings = await SmtpSettings.findOne({ isActive: true });

    if (!settings) {
      return res.json({
        success: true,
        data: null,
        message: 'No SMTP settings configured',
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: settings,
    } as ApiResponse);
  })
);

// POST /api/smtp-settings - Create or update SMTP settings (Super Admin only)
router.post(
  '/smtp-settings',
  authenticate,
  checkRole([UserRole.SUPER_ADMIN]),
  asyncHandler(async (req: Request, res: Response) => {
    console.log('📧 POST /smtp-settings - Request body:', req.body);
    const { host, port, secure, username, password, fromEmail, fromName } = req.body;

    // Check if updating existing settings (password can be empty if updating)
    const existingSettings = await SmtpSettings.findOne({ isActive: true });

    // Validation - password is required only for new settings
    if (!host || !port || !username || !fromEmail || !fromName) {
      console.log('❌ Validation failed - missing required fields');
      return res.status(400).json({
        success: false,
        message: 'All fields are required: host, port, username, fromEmail, fromName',
      } as ApiResponse);
    }

    // Password validation - required for new, optional for updates
    if (!existingSettings && !password) {
      console.log('❌ Validation failed - password required for new settings');
      return res.status(400).json({
        success: false,
        message: 'Password is required when creating new SMTP settings',
      } as ApiResponse);
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fromEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
      } as ApiResponse);
    }

    // Port validation
    if (port < 1 || port > 65535) {
      return res.status(400).json({
        success: false,
        message: 'Port must be between 1 and 65535',
      } as ApiResponse);
    }

    let savedSettings;

    if (existingSettings) {
      // Update existing settings
      console.log('🔄 Updating existing SMTP settings...');

      existingSettings.host = host;
      existingSettings.port = port;
      existingSettings.secure = secure === true || secure === 'true';
      existingSettings.username = username;
      // Only update password if provided
      if (password) {
        existingSettings.password = password;
      }
      existingSettings.fromEmail = fromEmail;
      existingSettings.fromName = fromName;
      existingSettings.isActive = true;

      savedSettings = await existingSettings.save();
      console.log('✅ SMTP settings updated in database:', savedSettings._id);
    } else {
      // Create new settings (first time)
      console.log('💾 Creating new SMTP settings (first time)...');

      savedSettings = new SmtpSettings({
        host,
        port,
        secure: secure === true || secure === 'true',
        username,
        password,
        fromEmail,
        fromName,
        isActive: true,
      });

      await savedSettings.save();
      console.log('✅ SMTP settings created in database:', savedSettings._id);
    }

    res.json({
      success: true,
      data: savedSettings,
      message: 'SMTP settings saved successfully',
    } as ApiResponse);
  })
);

// PUT /api/smtp-settings/:id - Update existing SMTP settings (Super Admin only)
router.put(
  '/smtp-settings/:id',
  authenticate,
  checkRole([UserRole.SUPER_ADMIN]),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { host, port, secure, username, password, fromEmail, fromName } = req.body;

    const settings = await SmtpSettings.findById(id);

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'SMTP settings not found',
      } as ApiResponse);
    }

    // Update fields
    if (host) settings.host = host;
    if (port) settings.port = port;
    if (secure !== undefined) settings.secure = secure === true || secure === 'true';
    if (username) settings.username = username;
    if (password) settings.password = password;
    if (fromEmail) settings.fromEmail = fromEmail;
    if (fromName) settings.fromName = fromName;

    await settings.save();

    res.json({
      success: true,
      data: settings,
      message: 'SMTP settings updated successfully',
    } as ApiResponse);
  })
);

// POST /api/smtp-settings/test - Send test email (Super Admin only)
router.post(
  '/smtp-settings/test',
  authenticate,
  checkRole([UserRole.SUPER_ADMIN]),
  asyncHandler(async (req: Request, res: Response) => {
    const { testEmail } = req.body;

    if (!testEmail) {
      return res.status(400).json({
        success: false,
        message: 'Test email address is required',
      } as ApiResponse);
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
      } as ApiResponse);
    }

    try {
      await EmailService.sendTestEmail(testEmail);

      // Update test status
      await SmtpSettings.updateOne(
        { isActive: true },
        {
          testEmailSent: true,
          lastTestedAt: new Date(),
        }
      );

      res.json({
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
      } as ApiResponse);
    } catch (error: any) {
      console.error('Test email error:', error);
      res.status(500).json({
        success: false,
        message: `Failed to send test email: ${error.message}`,
      } as ApiResponse);
    }
  })
);

// DELETE /api/smtp-settings/:id - Delete SMTP settings (Super Admin only)
router.delete(
  '/smtp-settings/:id',
  authenticate,
  checkRole([UserRole.SUPER_ADMIN]),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const settings = await SmtpSettings.findByIdAndDelete(id);

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'SMTP settings not found',
      } as ApiResponse);
    }

    res.json({
      success: true,
      message: 'SMTP settings deleted successfully',
    } as ApiResponse);
  })
);

export const smtpSettingsRoutes = router;
export default router;
