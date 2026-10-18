const mongoose = require('mongoose');
const { AuditLog } = require('../models');

/**
 * Audit log middleware factory
 * Automatically records an AuditLog entry when the response status code is 2xx.
 * @param {string} action Action description (e.g., 'USER_REGISTER', 'USER_LOGIN', 'CHANGE_PASSWORD')
 * @param {string} targetModel Model name being manipulated (e.g., 'User', 'Book')
 */
const logAction = (action, targetModel) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        process.nextTick(async () => {
          try {
            let targetId = res.locals.targetId || req.params.id || null;
            if (!targetId && body && typeof body === 'object') {
              if (body.data && body.data._id) {
                targetId = body.data._id;
              } else if (body.data && body.data.user && body.data.user._id) {
                targetId = body.data.user._id;
              } else if (body._id) {
                targetId = body._id;
              }
            }

            // Remove sensitive fields from recorded changes
            const sanitizedChanges = { ...req.body };
            delete sanitizedChanges.password;
            delete sanitizedChanges.oldPassword;
            delete sanitizedChanges.newPassword;
            delete sanitizedChanges.confirmPassword;
            delete sanitizedChanges.refreshToken;

            // Only write to AuditLog if database connection is active
            if (mongoose.connection.readyState === 1) {
              await AuditLog.create({
                performedBy: req.user?._id || (body?.data?.user?._id ? body.data.user._id : null),
                action,
                targetModel: targetModel || 'System',
                targetId: targetId || null,
                changes: sanitizedChanges,
                ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
                userAgent: req.headers['user-agent'] || '',
              });
            }
          } catch (auditErr) {
            console.error('Audit logging error:', auditErr.message);
          }
        });
      }

      return originalJson(body);
    };

    next();
  };
};

module.exports = {
  logAction,
};
