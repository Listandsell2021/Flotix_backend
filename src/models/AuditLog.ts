import mongoose, { Schema, Document } from 'mongoose';
import type { 
  AuditLog as IAuditLog, 
  AuditAction, 
  AuditModule, 
  AuditStatus, 
  UserRole 
} from '@fleetflow/types';

export interface AuditLogDocument extends IAuditLog, Document {}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN', 'DRIVER'],
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: function (this: AuditLogDocument) {
        return this.role !== 'SUPER_ADMIN';
      },
    },
    action: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', 'LOGOUT'],
      required: true,
    },
    module: {
      type: String,
      enum: ['USER', 'COMPANY', 'EXPENSE', 'REPORT', 'AUTH', 'VEHICLE'],
      required: true,
    },
    referenceIds: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED'],
      required: true,
    },
    details: {
      type: String,
      maxlength: 1000,
    },
    ipAddress: {
      type: String,
      validate: {
        validator: function(v: string) {
          if (!v) return true; // Allow empty/undefined
          // IPv4 pattern
          const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
          // IPv6 patterns (including compressed forms like ::1)
          const ipv6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:)*::[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/;
          return ipv4.test(v) || ipv6.test(v) || v === 'unknown';
        },
        message: 'Invalid IP address format'
      },
    },
    userAgent: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: false, // We use our own timestamp field
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ companyId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, module: 1 });
auditLogSchema.index({ status: 1 });

// Compound indexes for filtering
auditLogSchema.index({ companyId: 1, module: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, action: 1, timestamp: -1 });

// TTL index to auto-delete old logs (optional - keep logs for 2 years)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 }); // 2 years

// Virtual for user info
auditLogSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

export const AuditLog = mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema);