import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import type { 
  UserRole, 
  UserStatus, 
  CompanyPlan, 
  CompanyStatus,
  ExpenseType,
  ExpenseCategory 
} from '@fleetflow/types';

export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors,
        });
      }
      next(error);
    }
  };
};

// Auth schemas
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

// User schemas
export const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'DRIVER', 'MANAGER', 'VIEWER']),
    companyId: z.string().optional(),
    assignedVehicleId: z.string().optional(),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
    email: z.string().email('Invalid email format').optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    assignedVehicleId: z.string().optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
});

// Company schemas
export const createCompanySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Company name is required').max(100, 'Company name too long'),
    plan: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
    driverLimit: z.number().int().min(1, 'Driver limit must be at least 1').max(10000, 'Driver limit too high').optional(),
  }),
});

export const updateCompanySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Company name is required').max(100, 'Company name too long').optional(),
    plan: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED']).optional(),
    driverLimit: z.number().int().min(1, 'Driver limit must be at least 1').max(10000, 'Driver limit too high').optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'Company ID is required'),
  }),
});

// Expense schemas
export const createExpenseSchema = z.object({
  body: z.object({
    driverId: z.string().optional(), // Optional: used when admin creates expense for a driver
    type: z.enum(['FUEL', 'MISC']),
    amountFinal: z.number().min(0, 'Amount must be positive').max(100000, 'Amount too large'),
    currency: z.string().regex(/^[A-Z]{3}$/, 'Currency must be a valid 3-letter ISO code'),
    receiptUrl: z.string().url('Invalid receipt URL'),
    category: z.enum(['TOLL', 'PARKING', 'REPAIR', 'OTHER']).optional(),
    notes: z.string().max(500, 'Notes too long').optional(),
    kilometers: z.number().min(0, 'Kilometers must be positive').max(9999999, 'Kilometers cannot exceed 9,999,999').optional(),
    date: z.coerce.date().max(new Date(), 'Date cannot be in the future'),
  }),
});

export const updateExpenseSchema = z.object({
  body: z.object({
    amountFinal: z.number().min(0, 'Amount must be positive').max(100000, 'Amount too large').optional(),
    category: z.enum(['TOLL', 'PARKING', 'REPAIR', 'OTHER']).optional(),
    notes: z.string().max(500, 'Notes too long').optional(),
    kilometers: z.number().min(0, 'Kilometers must be positive').max(9999999, 'Kilometers cannot exceed 9,999,999').optional(),
    date: z.coerce.date().max(new Date(), 'Date cannot be in the future').optional(),
  }),
  params: z.object({
    id: z.string().min(1, 'Expense ID is required'),
  }),
});

export const expenseFiltersSchema = z.object({
  query: z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    type: z.enum(['FUEL', 'MISC']).optional(),
    driverId: z.string().optional(),
    category: z.enum(['TOLL', 'PARKING', 'REPAIR', 'OTHER']).optional(),
    amountMin: z.coerce.number().min(0).optional(),
    amountMax: z.coerce.number().min(0).optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
    sortBy: z.enum(['date', 'amount', 'createdAt']).default('createdAt').optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
  }),
});

// Report schemas
export const reportFiltersSchema = z.object({
  query: z.object({
    dateFrom: z.string().min(1, 'Start date is required'),
    dateTo: z.string().min(1, 'End date is required'),
    driverId: z.string().optional(),
    type: z.enum(['FUEL', 'MISC']).optional(),
    category: z.enum(['TOLL', 'PARKING', 'REPAIR', 'OTHER']).optional(),
    groupBy: z.enum(['driver', 'category', 'month', 'type']).optional(),
  }),
});

// Pagination schema
export const paginationSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  }),
});

// File upload schema
export const fileUploadSchema = z.object({
  file: z.object({
    mimetype: z.enum(['image/jpeg', 'image/png', 'image/jpg'], {
      errorMap: () => ({ message: 'Only JPEG and PNG files are allowed' }),
    }),
    size: z.number().max(5 * 1024 * 1024, 'File size must be less than 5MB'),
  }),
});