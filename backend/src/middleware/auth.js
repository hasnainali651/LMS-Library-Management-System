const jwt = require('jsonwebtoken');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const redis = require('../config/redis');

/**
 * Protect route: Extract Bearer token or cookie, verify JWT, check Redis blacklist, fetch user
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(new ApiError(401, 'Not authorized to access this route. Token missing.'));
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return next(new ApiError(401, 'Not authorized. Token is invalid or expired.'));
    }

    // Check if token jti is blacklisted in Redis
    if (decoded.jti && redis && redis.status === 'ready') {
      try {
        const isBlacklisted = await redis.get(`blacklist:${decoded.jti}`);
        if (isBlacklisted) {
          return next(new ApiError(401, 'Token has been revoked. Please log in again.'));
        }
      } catch (redisErr) {
        // Continue if redis check encounters temporary issue
      }
    }

    // Fetch user
    const user = await User.findById(decoded._id);
    if (!user) {
      return next(new ApiError(401, 'User belonging to this token no longer exists.'));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new ApiError(403, 'Account is deactivated. Please contact the library administrator.'));
    }

    req.user = user;
    req.tokenJti = decoded.jti;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional Auth route: attach user if valid token exists, otherwise proceed as guest
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded._id);
      if (user && user.isActive) {
        req.user = user;
      } else {
        req.user = null;
      }
    } catch (err) {
      req.user = null;
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  protect,
  optionalAuth,
};
