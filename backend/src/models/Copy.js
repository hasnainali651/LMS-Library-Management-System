const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const copySchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book reference is required for each copy'],
      index: true,
    },
    copyNumber: {
      type: String,
      required: true,
      trim: true,
    },
    barcode: {
      type: String,
      required: [true, 'Barcode is required'],
      unique: true,
      trim: true,
      index: true,
    },
    condition: {
      type: String,
      enum: {
        values: ['new', 'good', 'fair', 'poor', 'damaged'],
        message: '{VALUE} is not a valid copy condition',
      },
      default: 'good',
    },
    status: {
      type: String,
      enum: {
        values: ['available', 'issued', 'reserved', 'lost', 'damaged', 'in_repair', 'retired'],
        message: '{VALUE} is not a valid copy status',
      },
      default: 'available',
      index: true,
    },
    shelfLocation: {
      type: String,
      required: [true, 'Shelf location is required (e.g., A-12-3)'],
      trim: true,
      index: true,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    purchasePrice: {
      type: Number,
      min: [0, 'Purchase price cannot be negative'],
      default: 0,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: fullBarcode = 'LMS-' + this._id
copySchema.virtual('fullBarcode').get(function () {
  return `LMS-${this._id}`;
});

// Indexes
copySchema.index({ book: 1, status: 1 });

copySchema.plugin(mongoosePaginate);

const Copy = mongoose.model('Copy', copySchema);
module.exports = Copy;
