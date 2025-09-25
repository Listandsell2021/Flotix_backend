import { Schema, model, Document } from 'mongoose';
import { Permission } from '../types';

export interface RoleDocument extends Document {
  name: string;
  displayName: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  companyId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<RoleDocument>({
  name: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    match: /^[A-Z_]+$/
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  permissions: [{
    type: String,
    enum: [
      'COMPANY_CREATE', 'COMPANY_READ', 'COMPANY_UPDATE', 'COMPANY_DELETE',
      'USER_CREATE', 'USER_READ', 'USER_UPDATE', 'USER_DELETE', 'USER_ASSIGN_ROLE',
      'DRIVER_CREATE', 'DRIVER_READ', 'DRIVER_UPDATE', 'DRIVER_DELETE',
      'VEHICLE_CREATE', 'VEHICLE_READ', 'VEHICLE_UPDATE', 'VEHICLE_DELETE', 'VEHICLE_ASSIGN',
      'EXPENSE_CREATE', 'EXPENSE_READ', 'EXPENSE_UPDATE', 'EXPENSE_DELETE', 'EXPENSE_APPROVE', 'EXPENSE_EXPORT',
      'REPORT_VIEW', 'REPORT_EXPORT', 'DASHBOARD_VIEW',
      'SYSTEM_SETTINGS', 'AUDIT_LOG_VIEW', 'ROLE_MANAGEMENT'
    ],
    required: true
  }],
  isSystem: {
    type: Boolean,
    default: false
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: false
  }
}, {
  timestamps: true
});

// Index for efficient querying
RoleSchema.index({ companyId: 1 });
RoleSchema.index({ isSystem: 1 });
RoleSchema.index({ name: 1, companyId: 1 }, { unique: true });

// Prevent deletion of system roles
RoleSchema.pre('deleteOne', { document: true, query: false }, function() {
  if (this.isSystem) {
    throw new Error('System roles cannot be deleted');
  }
});

RoleSchema.pre('findOneAndDelete', function() {
  this.where({ isSystem: { $ne: true } });
});

export const Role = model<RoleDocument>('Role', RoleSchema);