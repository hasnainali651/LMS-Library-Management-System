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

const isAdmin = authorize('admin');
const isLibrarian = authorize('admin', 'librarian');
const isMember = authorize('admin', 'librarian', 'student');

module.exports = {
  authorize,
  isAdmin,
  isLibrarian,
  isMember,
};
