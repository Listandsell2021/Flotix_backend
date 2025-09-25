const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  date: { type: Date, required: true },
  merchant: String,
  type: { type: String, enum: ['FUEL', 'MAINTENANCE', 'PARKING', 'TOLL', 'OTHER'], required: true },
  category: String,
  amountOriginal: Number,
  amountFinal: { type: Number, required: true },
  currency: { type: String, default: 'EUR' },
  kilometers: Number,
  odometerReading: Number,
  receiptUrl: String,
  notes: String,
  ocrData: {
    confidence: Number,
    extractedText: String,
    extractedAmount: Number,
    extractedMerchant: String,
    extractedDate: Date,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Expense', expenseSchema);