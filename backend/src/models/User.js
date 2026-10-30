const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoosePaginate = require('mongoose-paginate-v2');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address',
      ],
      index: true,
    },
    password: {
      type: String,
      required: [
        function () {
          return this.source === 'LOCAL';
        },
        'Password is required for local accounts',
      ],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false,
    },
    source: {
      type: String,
      enum: {
        values: ['LOCAL', 'GOOGLE', 'FACEBOOK'],
        message: '{VALUE} is not a valid auth source',
      },
      default: 'LOCAL',
      uppercase: true,
    },
    institution: {
      type: String,
      trim: true,
      default: '',
    },
    interests: {
      type: [String],
      default: [],
    },
    isStaffApproved: {
      type: Boolean,
      default: function () {
        return this.role !== 'librarian';
      },
    },
    oauthId: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['student', 'librarian', 'admin'],
        message: '{VALUE} is not a valid role',
      },
      default: 'student',
    },
    memberId: {
      type: String,
      unique: true,
      default: () => `LIB-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, 'Please provide a valid phone number'],
    },
    avatar: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    overdueBlocked: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifyToken: {
      type: String,
      select: false,
    },
    emailVerifyExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    membershipType: {
      type: String,
      trim: true,
      default: 'student',
    },
    membershipExpiry: {
      type: Date,
    },
    department: {
      type: String,
      trim: true,
    },
    studentId: {
      type: String,
      trim: true,
    },
    fineBalance: {
      type: Number,
      default: 0,
      min: [0, 'Fine balance cannot be negative'],
    },
    totalBorrowed: {
      type: Number,
      default: 0,
      min: [0, 'Total borrowed cannot be negative'],
    },
    refreshToken: {
      type: String,
      select: false,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ role: 1, isActive: 1 });

// Virtual: SOURCE alias for source
userSchema.virtual('SOURCE')
  .get(function () {
    return this.source;
  })
  .set(function (val) {
    this.source = val;
  });

// Pre-save hook: Hash password and ensure memberId
userSchema.pre('save', async function (next) {
  if (!this.memberId) {
    this.memberId = `LIB-${Date.now()}`;
  }

  if (!this.isModified('password') || !this.password) {
    return next();
  }

  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate Access Token (JWT)
userSchema.methods.generateJWT = function (customJti) {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      role: this.role,
      memberId: this.memberId,
      name: this.name,
      source: this.source,
      isEmailVerified: this.isEmailVerified,
      isStaffApproved: this.isStaffApproved,
      institution: this.institution,
      department: this.department,
      studentId: this.studentId,
      interests: this.interests,
      jti: customJti || crypto.randomUUID(),
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    }
  );
};

// Generate Refresh Token
userSchema.methods.generateRefreshToken = function (customJti) {
  return jwt.sign(
    {
      _id: this._id,
      jti: customJti || crypto.randomUUID(),
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    }
  );
};

// Generate Password Reset Token (30 minutes expiry)
userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 30 * 60 * 1000; // 30 minutes

  return resetToken;
};

// Generate Email Verify Token (24 hours expiry)
userSchema.methods.generateEmailVerifyToken = function () {
  const verifyToken = crypto.randomBytes(32).toString('hex');

  this.emailVerifyToken = crypto
    .createHash('sha256')
    .update(verifyToken)
    .digest('hex');

  this.emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verifyToken;
};

userSchema.plugin(mongoosePaginate);

const User = mongoose.model('User', userSchema);
module.exports = User;
