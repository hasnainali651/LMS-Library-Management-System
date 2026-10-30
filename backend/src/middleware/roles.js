const ApiError = require('../utils/ApiError');

/**
 * Role authorization middleware factory
 * @param  {...string} roles Allowed user roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'User authentication required.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Forbidden: User role '${req.user.role}' is not authorized to access this resource.`
        )
      );
    }

    next();
  };
};

/**
 * Ensures user has verified their email address for sensitive operations
 * (e.g. borrowing books, placing reservations, paying fines)
 */
const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'User authentication required.'));
  }

  // Admins always bypass, but all other patron/staff roles require email verification
  if (req.user.role !== 'admin' && !req.user.isEmailVerified) {
    return next(
      new ApiError(
        403,
        'Email verification required. Please verify your email address to borrow books, reserve items, or make payments.',
        { requiresEmailVerification: true }
      )
    );
  }

  next();
};

/**
 * Ensures staff (librarian) accounts have been verified and approved by an administrator
 */
const requireStaffApproval = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'User authentication required.'));
  }

  if (req.user.role === 'librarian' && !req.user.isStaffApproved) {
    return next(
      new ApiError(
        403,
        'Staff account pending administrator approval. An administrator must verify your staff credentials before granting circulation and management access.',
        { requiresStaffApproval: true }
      )
    );
  }

  next();
};

const isAdmin = authorize('admin');

// isLibrarian checks both role authorization AND administrator staff approval
const isLibrarian = (req, res, next) => {
  authorize('admin', 'librarian')(req, res, (err) => {
    if (err) return next(err);
    return requireStaffApproval(req, res, next);
  });
};

const isMember = authorize('admin', 'librarian', 'student');

module.exports = {
  authorize,
  requireVerifiedEmail,
  requireStaffApproval,
  isAdmin,
  isLibrarian,
  isMember,
};
