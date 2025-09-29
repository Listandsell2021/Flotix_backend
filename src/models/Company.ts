import mongoose, { Schema, Document } from 'mongoose';
import type { Company as ICompany } from '../types';
import { CompanyStatus, CompanyPlan } from '../types';
import { config } from '../config';

export interface CompanyDocument extends Omit<ICompany, '_id'>, Document {}

const companySchema = new Schema<CompanyDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    plan: {
      type: String,
      enum: Object.values(CompanyPlan),
      default: CompanyPlan.STARTER,
    },
    status: {
      type: String,
      enum: Object.values(CompanyStatus),
      default: CompanyStatus.ACTIVE,
    },
    driverLimit: {
      type: Number,
      default: config.DEFAULT_DRIVER_LIMIT,
      min: 1,
      max: 10000,
    },
    renewalDate: {
      type: Date,
      default: function () {
        const date = new Date();
        date.setFullYear(date.getFullYear() + 1); // 1 year from now
        return date;
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
companySchema.index({ status: 1 });
companySchema.index({ renewalDate: 1 });
companySchema.index({ name: 1 });

// Virtual for active drivers count
companySchema.virtual('activeDriversCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'companyId',
  count: true,
  match: { role: 'DRIVER', status: 'ACTIVE' },
});

export const Company = mongoose.model<CompanyDocument>('Company', companySchema);