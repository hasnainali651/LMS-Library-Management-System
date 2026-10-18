const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const reviewSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book reference is required for review'],
      index: true,
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member reference is required for review'],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating value is required'],
      min: [1, 'Minimum rating is 1'],
      max: [5, 'Maximum rating is 5'],
    },
    comment: {
      type: String,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
      trim: true,
      default: '',
    },
    isApproved: {
      type: Boolean,
      default: false,
      index: true,
    },
    approvedBy: {
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

// Compound unique index: One review per member per book
reviewSchema.index({ book: 1, member: 1 }, { unique: true });

// Static method to recalculate book rating metrics via aggregation
reviewSchema.statics.calculateAverageRating = async function (bookId) {
  try {
    const stats = await this.aggregate([
      { $match: { book: bookId } },
      {
        $group: {
          _id: '$book',
          ratingCount: { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
    ]);

    const Book = mongoose.model('Book');
    if (stats.length > 0) {
      await Book.findByIdAndUpdate(bookId, {
        averageRating: Math.round(stats[0].averageRating * 10) / 10,
        ratingCount: stats[0].ratingCount,
      });
    } else {
      await Book.findByIdAndUpdate(bookId, {
        averageRating: 0,
        ratingCount: 0,
      });
    }
  } catch (error) {
    console.error('Error calculating average rating:', error.message);
  }
};

// Post-save hook to trigger aggregation recalculation
reviewSchema.post('save', async function () {
  await this.constructor.calculateAverageRating(this.book);
});

reviewSchema.plugin(mongoosePaginate);

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
