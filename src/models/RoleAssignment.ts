import { Schema, model, Document } from 'mongoose';

export interface RoleAssignmentDocument extends Document {
  userId: string;
  roleId: string;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

const RoleAssignmentSchema = new Schema<RoleAssignmentDocument>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roleId: {
    type: Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },
  assignedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
RoleAssignmentSchema.index({ userId: 1 });
RoleAssignmentSchema.index({ roleId: 1 });
RoleAssignmentSchema.index({ userId: 1, roleId: 1 }, { unique: true });
RoleAssignmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Automatically deactivate expired assignments
RoleAssignmentSchema.pre('find', function() {
  this.where({
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ],
    isActive: true
  });
});

RoleAssignmentSchema.pre('findOne', function() {
  this.where({
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ],
    isActive: true
  });
});

export const RoleAssignment = model<RoleAssignmentDocument>('RoleAssignment', RoleAssignmentSchema);