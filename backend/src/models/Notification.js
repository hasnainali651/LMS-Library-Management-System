const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const hidePrivate = (_doc, value) => {
  delete value.delivery;
  delete value.dedupKey;
  return value;
};
const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, enum: ['due_reminder', 'overdue', 'reservation_ready', 'fine_added', 'fine_paid', 'membership_expiry', 'new_arrival', 'account', 'system'] },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  isRead: { type: Boolean, default: false, index: true },
  readAt: Date,
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  channel: { type: [String], enum: ['in_app', 'email'], default: ['in_app'] },
  dedupKey: { type: String, required: true, select: false },
  delivery: {
    type: new mongoose.Schema({
      status: { type: String, enum: ['pending', 'queued', 'delivering', 'sent', 'failed'], default: 'pending' },
      html: String,
      cc: [String],
      attempts: { type: Number, default: 0 },
      enqueuedAt: Date,
      attemptedAt: Date,
      sentAt: Date,
      inAppAt: Date,
      messageId: String,
      error: String,
    }, { _id: false }),
    select: false,
    default: () => ({ status: 'pending' }),
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true, transform: hidePrivate },
  toObject: { virtuals: true, transform: hidePrivate },
});
notificationSchema.index({ dedupKey: 1 }, { unique: true, partialFilterExpression: { dedupKey: { $type: 'string' } } });
notificationSchema.index({ 'delivery.status': 1, createdAt: 1 });
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Notification', notificationSchema);
