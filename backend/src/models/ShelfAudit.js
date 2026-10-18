const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

/**
 * Detected book entry from shelf image analysis
 */
const detectedBookSchema = new mongoose.Schema(
  {
    detected: {
      title: { type: String, default: null },
      author: { type: String, default: null },
      position: { type: Number, required: true }, // left-to-right, top-to-bottom order
    },
    dbBook: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      default: null,
    },
    matchConfidence: {
      type: String,
      enum: ['certain', 'high', 'medium', 'unknown'],
      default: 'unknown',
    },
    misplaced: {
      type: Boolean,
      default: false,
    },
    expectedShelf: {
      type: String,
      default: null, // shelfLocation from Copy document
    },
  },
  { _id: false }
);

const shelfAuditSchema = new mongoose.Schema(
  {
    conductedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Audit must be associated with a librarian user'],
      index: true,
    },
    shelfLocation: {
      type: String,
      required: [true, 'Shelf location is required (e.g., A-12-3)'],
      trim: true,
      index: true,
    },
    imageUrl: {
      type: String,
      default: null, // stored relative URL of the shelf image
    },

    // AI-generated report
    report: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Aggregated metrics
    detectedCount: {
      type: Number,
      default: 0,
      min: [0, 'detectedCount cannot be negative'],
    },
    matchedCount: {
      type: Number,
      default: 0,
      min: [0, 'matchedCount cannot be negative'],
    },
    unmatchedCount: {
      type: Number,
      default: 0,
      min: [0, 'unmatchedCount cannot be negative'],
    },
    misplacedCount: {
      type: Number,
      default: 0,
      min: [0, 'misplacedCount cannot be negative'],
    },

    // Broken-out lists for easy querying
    matchedBooks: [detectedBookSchema],
    unmatchedBooks: [
      {
        title: { type: String, default: null },
        author: { type: String, default: null },
        position: { type: Number },
        _id: false,
      },
    ],

    status: {
      type: String,
      enum: ['completed', 'failed', 'processing'],
      default: 'completed',
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index for history queries
shelfAuditSchema.index({ conductedBy: 1, createdAt: -1 });
shelfAuditSchema.index({ shelfLocation: 1, createdAt: -1 });

shelfAuditSchema.plugin(mongoosePaginate);

const ShelfAudit = mongoose.model('ShelfAudit', shelfAuditSchema);
module.exports = ShelfAudit;
