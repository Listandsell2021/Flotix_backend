const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DRIVER', 'VIEWER'],
    required: true
  },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  assignedVehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);