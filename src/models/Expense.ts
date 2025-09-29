import mongoose, { Schema, Document } from 'mongoose';
import type { Expense as IExpense } from '../types';
import { ExpenseType, ExpenseCategory } from '../types';
import { config } from '../config';

export interface ExpenseDocument extends Omit<IExpense, '_id'>, Document {}

const expenseSchema = new Schema<ExpenseDocument>(
  {
    driverId: {
      type: String,
      required: true,
    },
    companyId: {
      type: String,
      required: true,
    },
    vehicleId: {
      type: String,
    },
    type: {
      type: String,
      enum: Object.values(ExpenseType),
      required: true,
    },
    amountExtracted: {
      type: Number,
      min: 0,
    },
    amountFinal: {
      type: Number,
      required: true,
      min: 0,
      max: 100000, // $100k max per expense
    },
    currency: {
      type: String,
      required: true,
      default: 'EUR',
      enum: ['EUR'],
      validate: {
        validator: function(v: string) {
          return v === 'EUR';
        },
        message: 'Currency must be EUR'
      }
    },
    receiptUrl: {
      type: String,
      required: true,
      match: [/^https?:\/\/.+/, 'Receipt URL must be a valid HTTP(S) URL'],
    },
    category: {
      type: String,
      enum: Object.values(ExpenseCategory),
      required: function (this: ExpenseDocument) {
        return this.type === ExpenseType.MISC;
      },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    merchant: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    kilometers: {
      type: Number,
      min: 0,
      max: 9999999, // Same as vehicle odometer max
      validate: {
        validator: function(v: number) {
          return v === null || v === undefined || (v >= 0 && v <= 9999999);
        },
        message: 'Kilometers must be between 0 and 9,999,999'
      }
    },
    odometerReading: {
      type: Number,
      min: 0,
      max: 9999999, // 9.9M km max
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        // Add canEdit field based on time limit
        const now = new Date();
        const timeDiff = now.getTime() - new Date(ret.createdAt).getTime();
        ret.canEdit = timeDiff <= config.EXPENSE_EDIT_TIME_LIMIT;
        
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
expenseSchema.index({ driverId: 1, createdAt: -1 });
expenseSchema.index({ companyId: 1, createdAt: -1 });
expenseSchema.index({ vehicleId: 1, createdAt: -1 });
expenseSchema.index({ date: -1 });
expenseSchema.index({ type: 1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ kilometers: 1 });
expenseSchema.index({ merchant: 'text', notes: 'text' });

// Compound indexes for filtering
expenseSchema.index({ companyId: 1, type: 1, date: -1 });
expenseSchema.index({ companyId: 1, driverId: 1, date: -1 });
expenseSchema.index({ companyId: 1, vehicleId: 1, date: -1 });

// Virtual for driver info
expenseSchema.virtual('driver', {
  ref: 'User',
  localField: 'driverId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for vehicle info
expenseSchema.virtual('vehicle', {
  ref: 'Vehicle',
  localField: 'vehicleId',
  foreignField: '_id',
  justOne: true,
});

// Pre-validate middleware
expenseSchema.pre('validate', function (next) {
  // Ensure MISC expenses have a category
  if (this.type === ExpenseType.MISC && !this.category) {
    this.category = ExpenseCategory.OTHER;
  }
  
  // Ensure date is not in the future
  if (this.date > new Date()) {
    return next(new Error('Expense date cannot be in the future'));
  }
  
  next();
});

export const Expense = mongoose.model<ExpenseDocument>('Expense', expenseSchema);