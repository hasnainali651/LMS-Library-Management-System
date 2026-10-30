const crypto = require('crypto');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');
const { templates } = require('../services/emailService');

const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, role, isActive } = req.query;
  const query = {};
  if (role) query.role = { $in: role.split(',').map((value) => value.trim()) };
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (search) {
    const literal = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = ['name', 'email'].map((field) => ({ [field]: { $regex: literal, $options: 'i' } }));
  }
  const users = await User.paginate(query, {
    page: Number(page), limit: Number(limit), sort: '-createdAt', lean: true,
    select: '-password -refreshToken -emailVerifyToken -emailVerifyExpires -passwordResetToken -passwordResetExpires',
  });
  return res.status(200).json(new ApiResponse(200, users, 'Users retrieved successfully'));
});

const queueReset = async (user) => {
  const token = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  return notificationService.queueEmail({
    userId: user._id, to: user.email, subject: 'Library account password setup / reset',
    html: templates.resetPassword(user.name, url), dedupKey: `password-reset:${user._id}:${user.passwordResetToken}`,
  });
};

const createUser = asyncHandler(async (req, res) => {
  const { name, email, role, phone } = req.body;
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists.');
  const user = new User({ name, email, role, ...(phone ? { phone } : {}),
    password: crypto.randomBytes(32).toString('hex'), isActive: true, isEmailVerified: false,
  });
  await user.save();
  let delivery;
  try {
    delivery = await queueReset(user);
  } catch (error) {
    delivery = { status: 'failed', message: 'Account created, but password setup email could not be queued. Use reset-password to retry.' };
  }
  const safeUser = await User.findById(user._id);
  return res.status(201).json(new ApiResponse(201, { user: safeUser, delivery }, 'Staff account created. Email delivery status is included.'));
});

const resetUserPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (!user.isActive) throw new ApiError(409, 'Activate the account before requesting a password reset.');
  const delivery = await queueReset(user);
  return res.status(202).json(new ApiResponse(202, { delivery }, 'Password reset email accepted for delivery.'));
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const { role, isActive } = req.body;
  if (req.params.id === String(req.user._id) && (isActive === false || (role && role !== 'admin'))) {
    throw new ApiError(409, 'You cannot deactivate or demote your own administrator account.');
  }
  const session = await User.startSession();
  let user;
  try {
    await session.withTransaction(async () => {
      // Serialize administrator changes, including concurrent cross-deactivation requests.
      await User.updateMany({ role: 'admin', isActive: true }, { $inc: { __v: 1 } }, { session });
      const actor = await User.findById(req.user._id).session(session);
      if (!actor?.isActive || actor.role !== 'admin') throw new ApiError(403, 'Administrator access is no longer active.');
      user = await User.findById(req.params.id).session(session);
      if (!user) throw new ApiError(404, 'User not found');
      if (user.role === 'admin' && user.isActive && (isActive === false || (role && role !== 'admin'))) {
        const count = await User.countDocuments({ role: 'admin', isActive: true }).session(session);
        if (count <= 1) throw new ApiError(409, 'The last active administrator cannot be removed.');
      }
      if (role !== undefined) user.role = role;
      if (isActive !== undefined) user.isActive = isActive;
      user.refreshToken = undefined;
      await user.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return res.status(200).json(new ApiResponse(200, user, 'User updated successfully'));
});

const approveStaffUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.role !== 'librarian') throw new ApiError(400, 'User does not have a staff/librarian role.');
  user.isStaffApproved = true;
  await user.save({ validateBeforeSave: false });
  return res.status(200).json(new ApiResponse(200, user, 'Staff credentials verified and approved successfully.'));
});

module.exports = { getUsers, createUser, resetUserPassword, updateUserStatus, approveStaffUser };
