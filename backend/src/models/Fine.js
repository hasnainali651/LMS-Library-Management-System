const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const ref = (model, required = false) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, required });
const entryAmount = { type: Number, required: true, min: 0.01 };
const fineSchema = new mongoose.Schema({
  member: ref('User', true), transaction: ref('Transaction'),
  amount: { type: Number, required: true, min: 0 },
  type: { type: String, required: true, enum: ['overdue', 'damage', 'loss', 'processing'] },
  status: { type: String, enum: ['pending', 'paid', 'waived', 'partial'], default: 'pending', index: true },
  paidAmount: { type: Number, min: 0, default: 0 },
  waivedAmount: { type: Number, min: 0, default: 0 },
  assessments: [{ amount: entryAmount, assessedAt: { type: Date, required: true }, overdueDays: Number }],
  payments: [{ amount: entryAmount, paidAt: { type: Date, required: true }, receiptNumber: { type: String, required: true }, paymentMethod: { type: String, enum: ['cash', 'online'], required: true }, collectedBy: ref('User', true) }],
  waivers: [{ amount: entryAmount, waivedAt: { type: Date, required: true }, waivedBy: ref('User', true), reason: { type: String, required: true } }],
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });
fineSchema.virtual('outstandingAmount').get(function () {
  return Math.round((this.amount - this.paidAmount - this.waivedAmount) * 100) / 100;
});
fineSchema.pre('validate', function (next) {
  const sum = (entries) => Math.round(entries.reduce((total, entry) => total + entry.amount, 0) * 100) / 100;
  if (this.paidAmount + this.waivedAmount > this.amount + 0.000001) this.invalidate('paidAmount', 'Paid and waived amounts cannot exceed assessment');
  if (sum(this.assessments) !== this.amount) this.invalidate('assessments', 'Assessment ledger must equal amount');
  if (sum(this.payments) !== this.paidAmount) this.invalidate('payments', 'Payment ledger must equal paid amount');
  if (sum(this.waivers) !== this.waivedAmount) this.invalidate('waivers', 'Waiver ledger must equal waived amount');
  this.status = this.outstandingAmount > 0 ? (this.paidAmount || this.waivedAmount ? 'partial' : 'pending') : (this.waivedAmount ? 'waived' : 'paid');
  next();
});
fineSchema.index({ member: 1, status: 1 });
fineSchema.index({ transaction: 1, type: 1 }, { unique: true, partialFilterExpression: { type: 'overdue' }, name: 'one_overdue_ledger_per_transaction' });
fineSchema.index({ 'payments.receiptNumber': 1 });
fineSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Fine', fineSchema);
