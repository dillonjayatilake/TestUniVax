const mongoose = require('mongoose');

const vaccineProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Vaccine name is required'],
    trim: true,
    unique: true
  },
  genericName: {
    type: String,
    required: [true, 'Generic name is required']
  },
  manufacturer: {
    type: String,
    required: [true, 'Manufacturer is required']
  },
  cvxCode: {
    type: String,
    required: [true, 'CVX code is required'],
    unique: true
  },
  description: {
    type: String,
    default: ''
  },
  presentation: {
    type: String,
    enum: ['vial', 'prefilled syringe', 'nasal spray', 'oral'],
    required: true
  },
  volume: {
    value: { type: Number, required: true },
    unit: { type: String, default: 'mL' }
  },
  storageRequirements: {
    minTemp: Number,
    maxTemp: Number,
    requiresRefrigeration: Boolean
  },
  totalDoses: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['active', 'discontinued', 'pending', 'archived'],
    default: 'active'
  },
  version: {
    type: Number,
    default: 1
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    default: null
  },
  updateReason: {
    type: String,
    default: 'Initial creation'
  },
  approvedRegions: [{
    country: String,
    approvalDate: Date,
    regulatoryBody: String
  }],
  contraindications: [{
    condition: String,
    severity: {
      type: String,
      enum: ['absolute', 'caution', 'none']
    },
    description: String
  }],
  createdBy: {
    type: String,
    default: 'system'
  },
  lastModifiedBy: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual populate for dose requirements
vaccineProductSchema.virtual('doseRequirements', {
  ref: 'DoseRequirement',
  localField: '_id',
  foreignField: 'vaccineId'
});

// Indexes for efficient queries
vaccineProductSchema.index({ status: 1, name: 1 });
vaccineProductSchema.index({ cvxCode: 1 });
vaccineProductSchema.index({ 'approvedRegions.country': 1 });

module.exports = mongoose.model('VaccineProduct', vaccineProductSchema);