const mongoose = require('mongoose');
const { config } = require('../config');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  address: String,
  plan: { type: String, enum: ['FREE', 'BASIC', 'PREMIUM'], default: 'FREE' },
  driverLimit: { type: Number, default: config.DEFAULT_DRIVER_LIMIT },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Company', companySchema);