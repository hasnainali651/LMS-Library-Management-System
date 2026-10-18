const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const reservationSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  requestDate: { type: Date, default: Date.now, required: true },
  status: { type: String, enum: ['pending', 'ready', 'collected', 'expired', 'cancelled'], default: 'pending', index: true },
  notifiedAt: Date, expiresAt: { type: Date, index: true },
  position: { type: Number, min: 1 },
  assignedCopy: { type: mongoose.Schema.Types.ObjectId, ref: 'Copy' },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  collectedAt: Date,
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelReason: { type: String, trim: true, default: '' },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });
reservationSchema.index({ book: 1, status: 1, requestDate: 1 });
reservationSchema.index({ member: 1, status: 1 });
reservationSchema.index({ status: 1, expiresAt: 1 });
reservationSchema.index({ member: 1, book: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['pending', 'ready'] } }, name: 'one_live_reservation_per_member_book' });
reservationSchema.index({ assignedCopy: 1 }, { unique: true, partialFilterExpression: { status: 'ready' }, name: 'one_ready_hold_per_copy' });
reservationSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Reservation', reservationSchema);
