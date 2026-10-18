const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const integer = (minimum) => ({ validator: (value) => Number.isInteger(value) && value >= minimum, message: `Must be an integer of at least ${minimum}` });
const currency = { validator: (value) => Number.isFinite(value) && Math.abs(Math.round(value * 100) - value * 100) < 0.000001, message: 'Must have at most two decimal places' };
const membershipTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  displayName: { type: String, required: true, trim: true },
  maxBooks: { type: Number, default: 3, min: 0, validate: integer(0) },
  loanDays: { type: Number, default: 14, min: 1, validate: integer(1) },
  renewalLimit: { type: Number, default: 2, min: 0, validate: integer(0) },
  finePerDay: { type: Number, default: 5, min: 0, validate: currency },
  maxFinePerBook: { type: Number, default: 500, min: 0, validate: currency },
  maxFineBalance: { type: Number, default: 2000, min: 0, validate: currency },
  canBorrowReference: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });
membershipTypeSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('MembershipType', membershipTypeSchema);
