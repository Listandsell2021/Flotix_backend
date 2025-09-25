const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  role: String,
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  action: { type: String, required: true },
  module: { type: String, required: true },
  referenceIds: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ['SUCCESS', 'FAILED'], required: true },
  details: String,
  ipAddress: String,
  userAgent: String,
});

// TTL index for audit logs (2 years)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

module.exports = mongoose.model('AuditLog', auditLogSchema);