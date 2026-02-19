const mongoose = require('mongoose');

const doseRequirementSchema = new mongoose.Schema({
  vaccineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaccineProduct',
    required: [true, 'Vaccine ID is required']
  },
  doseNumber: {
    type: Number,
    required: [true, 'Dose number is required'],
    min: 1
  },
  doseName: {
    type: String,
    default: function() {
      return `Dose ${this.doseNumber}`;
    }
  },
  minAge: {
    value: { type: Number, required: true },
    unit: { 
      type: String, 
      enum: ['days', 'weeks', 'months', 'years'],
      default: 'months'
    }
  },
  maxAge: {
    value: Number,
    unit: {
      type: String,
      enum: ['days', 'weeks', 'months', 'years', null],
      default: null
    }
  },
  intervalFromPrevious: {
    minDays: { type: Number, default: 0 },
    maxDays: { type: Number, default: null },
    exactDays: { type: Number, default: null }
  },
  allowableDelay: {
    type: Number,
    default: 0,
    description: 'Grace period in days'
  },
  priority: {
    type: String,
    enum: ['routine', 'catchup', 'special'],
    default: 'routine'
  },
  status: {
    type: String,
    enum: ['active', 'superseded', 'pending'],
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
  notes: String,
  guidelines: [{
    authority: String,
    reference: String,
    url: String
  }]
}, {
  timestamps: true
});

// Compound index to ensure unique active doses per vaccine
doseRequirementSchema.index(
  { vaccineId: 1, doseNumber: 1, status: 1 }, 
  { unique: true, partialFilterExpression: { status: 'active' } }
);

// Index for finding doses by vaccine
doseRequirementSchema.index({ vaccineId: 1, status: 1 });

module.exports = mongoose.model('DoseRequirement', doseRequirementSchema);