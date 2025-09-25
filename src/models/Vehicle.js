const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  make: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
  licensePlate: { type: String, required: true },
  type: { type: String, enum: ['CAR', 'TRUCK', 'VAN', 'MOTORCYCLE'], required: true },
  color: String,
  currentOdometer: { type: Number, default: 0 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'], default: 'ACTIVE' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Vehicle', vehicleSchema);