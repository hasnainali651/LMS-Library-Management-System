const { AuditLog } = require('../models');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, action, search } = req.query;
  const query = {};
  if (action && action !== 'all') {
    query.action = action;
  }
  if (search) {
    query.$or = [
      { action: { $regex: search, $options: 'i' } },
      { ipAddress: { $regex: search, $options: 'i' } },
      { userAgent: { $regex: search, $options: 'i' } },
    ];
  }
  const result = await AuditLog.paginate(query, {
    page: Math.max(1, parseInt(page, 10)),
    limit: Math.min(200, Math.max(1, parseInt(limit, 10))),
    sort: { createdAt: -1 },
    populate: { path: 'performedBy', select: 'name email role' },
    lean: true,
  });
  return res.status(200).json(new ApiResponse(200, result, 'Audit logs retrieved successfully.'));
});

module.exports = { getAuditLogs };
