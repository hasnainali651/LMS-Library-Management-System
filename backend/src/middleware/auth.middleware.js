const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');

const verifyJWT = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token =
    req.cookies?.accessToken ||
    (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

  if (!token) {
    throw new ApiError(401, 'Unauthorized request: Token is missing');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check Redis blacklist if token jti is revoked
    const redis = require('../config/redis');
    if (decoded.jti && redis && redis.status === 'ready') {
      try {
        const isBlacklisted = await redis.get(`blacklist:${decoded.jti}`);
        if (isBlacklisted) {
          throw new ApiError(401, 'Token has been revoked. Please log in again.');
        }
      } catch (rErr) {
        if (rErr instanceof ApiError) throw rErr;
      }
    }

    const user = await User.findById(decoded._id).select('-password');

    if (!user) {
      throw new ApiError(401, 'Invalid Access Token: User no longer exists');
    }

    if (user.membershipStatus === 'suspended') {
      throw new ApiError(403, 'Account is suspended. Please contact the librarian.');
    }

    req.user = user;
    req.tokenJti = decoded.jti;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid or expired access token');
  }
});

module.exports = { verifyJWT };
