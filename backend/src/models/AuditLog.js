const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const auditLogSchema = new mongoose.Schema(
  {
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Action identifier is required'],
      trim: true,
    },
    targetModel: {
      type: String,
      trim: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      trim: true,
      default: '',
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// TTL index: expire documents after 365 days (365 * 24 * 60 * 60 seconds)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

// Compound and lookup indexes
auditLogSchema.index({ createdAt: -1, action: 1 });

auditLogSchema.plugin(mongoosePaginate);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
