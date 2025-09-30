import { Router } from 'express';
import { RegistrationEmail } from '../models';
import { authenticate, checkRole } from '../middleware';
import { auditLog } from '../middleware/audit';
import { UserRole } from '../types';

const router = Router();

// Public endpoint to register an email
router.post('/register-email', async (req, res) => {
  try {
    // Manual validation
    const { email, company, message } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (company && (typeof company !== 'string' || company.length > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Company name must be less than 100 characters'
      });
    }

    if (message && (typeof message !== 'string' || message.length > 1000)) {
      return res.status(400).json({
        success: false,
        message: 'Message must be less than 1000 characters'
      });
    }

    // Check if email already exists
    const existingEmail = await RegistrationEmail.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'This email has already been registered'
      });
    }

    // Create new registration email
    const registrationEmail = new RegistrationEmail({
      email,
      company,
      message
    });

    await registrationEmail.save();

    res.status(201).json({
      success: true,
      message: 'Registration email submitted successfully'
    });
  } catch (error) {
    console.error('Error saving registration email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit registration email'
    });
  }
});

// Protected endpoint for super admin to get all registration emails
router.get('/registration-emails',
  authenticate,
  checkRole([UserRole.SUPER_ADMIN]),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;
      const status = req.query.status as string;

      let filter: any = {};
      if (status && ['pending', 'contacted', 'converted'].includes(status)) {
        filter.status = status;
      }

      const total = await RegistrationEmail.countDocuments(filter);
      const emails = await RegistrationEmail.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      res.json({
        success: true,
        data: {
          emails,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching registration emails:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch registration emails'
      });
    }
  }
);

// Protected endpoint to update registration email status
router.patch('/registration-emails/:id',
  authenticate,
  checkRole([UserRole.SUPER_ADMIN]),
  auditLog('registration_email', 'update'),
  async (req, res) => {
    try {
      const { status } = req.body;

      if (!status || !['pending', 'contacted', 'converted'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be pending, contacted, or converted'
        });
      }

      const { id } = req.params;

      const email = await RegistrationEmail.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      );

      if (!email) {
        return res.status(404).json({
          success: false,
          message: 'Registration email not found'
        });
      }

      res.json({
        success: true,
        data: email
      });
    } catch (error) {
      console.error('Error updating registration email:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update registration email'
      });
    }
  }
);

export default router;