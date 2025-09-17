import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';
import type { User as IUser, UserRole, UserStatus } from '@fleetflow/types';

export interface UserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<UserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN', 'DRIVER'],
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: function (this: UserDocument) {
        return this.role !== 'SUPER_ADMIN';
      },
    },
    assignedVehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
    },
    lastActive: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ companyId: 1, role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ assignedVehicleId: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();

  try {
    const saltRounds = 12;
    this.passwordHash = await bcrypt.hash(this.passwordHash, saltRounds);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Validation middleware
userSchema.pre('validate', function (next) {
  // Super admins should not have companyId
  if (this.role === 'SUPER_ADMIN' && this.companyId) {
    this.companyId = undefined;
  }
  next();
});

export const User = mongoose.model<UserDocument>('User', userSchema);