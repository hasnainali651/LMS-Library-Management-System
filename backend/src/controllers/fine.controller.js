const { Fine } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const fineService = require('../services/fineService');
const getFines = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, member } = req.query;
  const query = {};
  if (status) query.status = status;
  if (member) query.member = member;
  const result = await Fine.paginate(query, { page: Math.max(1, parseInt(page, 10) || 1), limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 10)), sort: { createdAt: -1 }, lean: true,
    populate: [{ path: 'member', select: 'name email memberId' }, { path: 'payments.collectedBy', select: 'name' }, { path: 'waivers.waivedBy', select: 'name' }, { path: 'transaction', select: 'issueDate dueDate returnDate book', populate: { path: 'book', select: 'title isbn' } }],
  });
  return res.status(200).json(new ApiResponse(200, result, 'Fines records retrieved successfully.'));
});
const getMemberFines = asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  if (!['admin', 'librarian'].includes(req.user.role) && String(req.user._id) !== memberId) throw new ApiError(403, 'Unauthorized access to patron fine records.');
  const fines = await Fine.find({ member: memberId }).sort({ createdAt: -1 }).populate('transaction', 'issueDate dueDate returnDate fineAmount').lean();
  return res.status(200).json(new ApiResponse(200, fines, 'Member fines retrieved successfully.'));
});
const collectFines = asyncHandler(async (req, res) => {
  const { fineIds, amount, paymentMethod } = req.body;
  const result = await fineService.collectFines({ fineIds, amount, paymentMethod, collectedBy: req.user._id });
  return res.status(200).json(new ApiResponse(200, result, `Successfully recorded PKR ${result.amountCollected}. Receipt #${result.receiptNumber}.`));
});
const waiveFine = asyncHandler(async (req, res) => {
  if (!req.body.fineId) throw new ApiError(400, 'fineId is required.');
  const result = await fineService.waiveFine({ fineId: req.body.fineId, reason: req.body.reason, waivedBy: req.user._id });
  return res.status(200).json(new ApiResponse(200, result.fine, `Fine of PKR ${result.amountWaived} has been waived.`));
});
module.exports = { getFines, getMemberFines, collectFines, waiveFine };
