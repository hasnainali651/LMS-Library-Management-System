const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const validCategories = [
  'Fiction',
  'Non-Fiction',
  'Science',
  'Technology',
  'Mathematics',
  'History',
  'Biography',
  'Literature',
  'Philosophy',
  'Psychology',
  'Business',
  'Arts',
  'Medicine',
  'Law',
  'Religion',
  'Children',
  'Reference',
  'Comics',
  'Travel',
  'Cooking',
];

const isbnRegex = /^(?:ISBN(?:-1[03])?:?\s*)?(?=[-0-9X]{10,17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/i;

const bookSchema = new mongoose.Schema(
  {
    isbn: {
      type: String,
      required: [true, 'ISBN is required'],
      unique: true,
      trim: true,
      uppercase: true,
      validate: {
        validator: function (v) {
          const cleaned = v.replace(/[- ]/g, '');
          return /^(?:\d{9}[\dX]|\d{13})$/i.test(cleaned);
        },
        message: (props) => `${props.value} is not a valid 10 or 13-digit ISBN format`,
      },
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true,
      minlength: [1, 'Title must be at least 1 character long'],
      maxlength: [500, 'Title cannot exceed 500 characters'],
    },
    authors: {
      type: [String],
      required: [true, 'At least one author is required'],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length > 0 && val.every((a) => typeof a === 'string' && a.trim().length > 0);
        },
        message: 'Book must have at least one valid author name',
      },
    },
    publisher: {
      type: String,
      trim: true,
      default: '',
    },
    publishedYear: {
      type: Number,
      min: [1000, 'Published year must be 1000 or later'],
      max: [2100, 'Published year cannot exceed 2100'],
    },
    edition: {
      type: String,
      trim: true,
      default: '',
    },
    language: {
      type: String,
      default: 'English',
      trim: true,
    },
    description: {
      type: String,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
      trim: true,
      default: '',
    },
    coverImage: {
      type: String,
      default: '',
      trim: true,
    },
    categories: {
      type: [String],
      validate: {
        validator: function (cats) {
          if (!Array.isArray(cats)) return false;
          return cats.every((c) => validCategories.includes(c));
        },
        message: (props) => `One or more categories are invalid. Allowed: ${validCategories.join(', ')}`,
      },
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    deweyDecimal: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      min: [0, 'Price cannot be negative'],
      default: 0,
    },
    totalCopies: {
      type: Number,
      default: 0,
      min: [0, 'Total copies cannot be negative'],
    },
    availableCopies: {
      type: Number,
      default: 0,
      min: [0, 'Available copies cannot be negative'],
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: [0, 'View count cannot be negative'],
    },
    borrowCount: {
      type: Number,
      default: 0,
      min: [0, 'Borrow count cannot be negative'],
    },
    averageRating: {
      type: Number,
      default: 0,
      min: [0, 'Average rating cannot be less than 0'],
      max: [5, 'Average rating cannot exceed 5'],
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: [0, 'Rating count cannot be negative'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound and search indexes
bookSchema.index(
  {
    title: 'text',
    authors: 'text',
    tags: 'text',
    description: 'text',
  },
  {
    weights: {
      title: 10,
      authors: 8,
      tags: 5,
      description: 1,
    },
    name: 'BookTextIndex',
  }
);

bookSchema.index({ isActive: 1, availableCopies: 1 });
bookSchema.index({ isActive: 1, availableCopies: 1, borrowCount: -1 });

bookSchema.plugin(mongoosePaginate);

const Book = mongoose.model('Book', bookSchema);
module.exports = Book;
