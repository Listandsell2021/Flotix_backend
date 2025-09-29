import mongoose, { Schema, Document } from 'mongoose';
import type { Vehicle as IVehicle } from '../types';
import { VehicleType, VehicleStatus } from '../types';

export interface VehicleDocument extends Omit<Document, 'model'> {
  companyId: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string;
  type: VehicleType;
  status: VehicleStatus;
  currentOdometer: number;
  assignedDriverId?: string;
  assignedDriverIds?: string[];
  fuelType?: string;
  color?: string;
  purchaseDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const vehicleSchema = new Schema<VehicleDocument>(
  {
    companyId: {
      type: String,
      required: true,
    },
    make: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    model: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    year: {
      type: Number,
      required: true,
      min: 1900,
      max: new Date().getFullYear() + 2,
    },
    licensePlate: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    vin: {
      type: String,
      trim: true,
      maxlength: 17,
      sparse: true, // Allows multiple null values but enforces uniqueness for non-null values
    },
    type: {
      type: String,
      enum: Object.values(VehicleType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(VehicleStatus),
      required: true,
      default: VehicleStatus.ACTIVE,
    },
    currentOdometer: {
      type: Number,
      required: true,
      min: 0,
      max: 9999999, // 9.9M km max
    },
    // Single driver assignment (keeping for backward compatibility)
    assignedDriverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
    },
    // Multiple drivers assignment
    assignedDriverIds: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    fuelType: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    color: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    purchaseDate: {
      type: Date,
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
vehicleSchema.index({ companyId: 1, status: 1 });
vehicleSchema.index({ companyId: 1, licensePlate: 1 }, { unique: true });
vehicleSchema.index({ assignedDriverId: 1 });
vehicleSchema.index({ companyId: 1, type: 1 });
vehicleSchema.index({ companyId: 1, make: 1, model: 1 });

// Compound indexes for filtering
vehicleSchema.index({ companyId: 1, status: 1, type: 1 });
vehicleSchema.index({ companyId: 1, assignedDriverId: 1 });

// Virtual for assigned driver info (single)
vehicleSchema.virtual('assignedDriver', {
  ref: 'User',
  localField: 'assignedDriverId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for assigned drivers info (multiple)
vehicleSchema.virtual('assignedDrivers', {
  ref: 'User',
  localField: 'assignedDriverIds',
  foreignField: '_id',
});

// Pre-validate middleware
vehicleSchema.pre('validate', function (next) {
  // Normalize license plate to uppercase
  if (this.licensePlate) {
    this.licensePlate = this.licensePlate.toUpperCase();
  }
  
  // VIN validation removed - accept any length
  
  // Ensure current year is reasonable
  const currentYear = new Date().getFullYear();
  if (this.year > currentYear + 2) {
    return next(new Error('Vehicle year cannot be more than 2 years in the future'));
  }
  
  next();
});

// Pre-save middleware to sync single and multiple driver assignments
vehicleSchema.pre('save', async function (next) {
  try {
    // Sync assignedDriverId with assignedDriverIds
    if (this.isModified('assignedDriverId')) {
      if (this.assignedDriverId) {
        // Add to assignedDriverIds if not already there
        if (!this.assignedDriverIds) {
          this.assignedDriverIds = [];
        }
        const driverIdStr = this.assignedDriverId.toString();
        const driverExists = this.assignedDriverIds.some(
          id => id.toString() === driverIdStr
        );
        if (!driverExists) {
          this.assignedDriverIds.push(this.assignedDriverId);
        }
      }
    }
    
    // If assignedDriverIds is modified and has drivers, set first as primary
    if (this.isModified('assignedDriverIds') && this.assignedDriverIds && this.assignedDriverIds.length > 0) {
      this.assignedDriverId = this.assignedDriverIds[0];
    }
    
    // Clear assignedDriverId if no drivers
    if (this.assignedDriverIds && this.assignedDriverIds.length === 0) {
      this.assignedDriverId = undefined;
    }
  } catch (error) {
    return next(error as Error);
  }
  next();
});

export const Vehicle = mongoose.model<VehicleDocument>('Vehicle', vehicleSchema);