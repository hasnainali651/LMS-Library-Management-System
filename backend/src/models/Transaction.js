const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const ref = (model, required = false) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, required });
const nonnegative = { type: Number, min: 0, default: 0 };
const policySchema = new mongoose.Schema({
  name: { type: String, required: true },
  maxBooks: { type: Number, required: true, min: 0 },
  loanDays: { type: Number, required: true, min: 1 },
  renewalLimit: { type: Number, required: true, min: 0 },
  finePerDay: { type: Number, required: true, min: 0 },
  maxFinePerBook: { type: Number, required: true, min: 0 },
  maxFineBalance: { type: Number, required: true, min: 0 },
  canBorrowReference: { type: Boolean, required: true },
}, { _id: false });
const transactionSchema = new mongoose.Schema({
  member: ref('User', true), copy: ref('Copy', true), book: ref('Book', true),
  issuedBy: ref('User'), returnedBy: ref('User'),
  issueDate: { type: Date, default: Date.now, required: true },
  dueDate: { type: Date, required: true, index: true }, returnDate: Date,
  policySnapshot: { type: policySchema, required: true },
  renewalCount: nonnegative,
  status: { type: String, enum: ['active', 'returned', 'overdue', 'lost'], default: 'active', index: true },
  fineAmount: nonnegative, finePaid: { type: Boolean, default: false }, finePaidAt: Date,
  fineWaivedBy: ref('User'), waiverReason: { type: String, trim: true, default: '' },
  damageCharge: nonnegative, damageNotes: { type: String, trim: true, default: '' },
  remindersSent: [{ type: { type: String, trim: true }, sentAt: { type: Date, default: Date.now } }],
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });
transactionSchema.index({ member: 1, status: 1 });
transactionSchema.index({ copy: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['active', 'overdue'] } }, name: 'one_outstanding_loan_per_copy' });
transactionSchema.index({ status: 1, dueDate: 1 });
transactionSchema.index({ member: 1, status: 1, issueDate: -1 });
transactionSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Transaction', transactionSchema);
