const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User, MembershipType } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const redis = require('../config/redis');
const notificationService = require('../services/notificationService');
const { templates } = require('../services/emailService');

const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });
const sendRefreshTokenCookie = (res, token) => res.cookie('refreshToken', token, { ...cookieOptions(), maxAge: 30 * 86400000 });
const clearRefreshTokenCookie = (res) => res.clearCookie('refreshToken', cookieOptions());
const requireRedis = () => {
  if (redis.status !== 'ready') throw new ApiError(503, 'Authentication service temporarily unavailable.');
};
const queueEmail = (user, subject, html, key) => notificationService.queueEmail({
  userId: user._id, to: user.email, subject, html, dedupeKey: key,
});
const committedEmail = async (...args) => {
  try { return await queueEmail(...args); }
  catch (error) { return { status: 'failed', message: 'Account change saved, but email could not be queued.' }; }
};
const revokeRefresh = async (token) => {
  if (!token) return;
  const decoded = jwt.decode(token);
  if (decoded?.jti) await redis.set(`blacklist:${decoded.jti}`, '1', 'EX', 30 * 86400);
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password, membershipType = 'student' } = req.body;
  if (await User.findOne({ email })) throw new ApiError(409, 'An account with this email address already exists.');
  if (!await MembershipType.exists({ name: membershipType, isActive: true })) throw new ApiError(422, 'An active membership policy is required.');
  const user = new User({ name, email, password, membershipType, role: 'student' });
  const token = user.generateEmailVerifyToken();
  await user.save();
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  const delivery = await committedEmail(user, 'Verify your Library Account', templates.verifyEmail(user.name, url), `verify:${user._id}:${user.emailVerifyToken}`);
  const accessToken = user.generateJWT();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  sendRefreshTokenCookie(res, refreshToken);
  return res.status(201).json(new ApiResponse(201, {
    user: await User.findById(user._id), tokens: { accessToken, refreshToken }, delivery,
  }, 'Registration successful. Email delivery status is included.'));
});

const login = asyncHandler(async (req, res) => {
  requireRedis();
  const email = req.body.email.toLowerCase().trim();
  const lockKey = `lock:login:${email}`;
  const failedKey = `failed:login:${email}`;
  if (await redis.get(lockKey)) {
    const minutes = Math.max(1, Math.ceil(await redis.ttl(lockKey) / 60));
    throw new ApiError(423, `Account is temporarily locked. Please try again in ${minutes} minutes.`);
  }
  const user = await User.findOne({ email }).select('+password +refreshToken');
  if (!user || !await user.comparePassword(req.body.password)) {
    const attempts = await redis.incr(failedKey);
    if (attempts === 1) await redis.expire(failedKey, 900);
    if (attempts >= 5) {
      await redis.set(lockKey, '1', 'EX', 3600);
      await redis.del(failedKey);
      if (user) await committedEmail(user, 'Security Alert: Account Temporarily Locked',
        templates.accountLocked(user.name, Date.now() + 3600000), `lock:${user._id}:${crypto.randomUUID()}`);
      throw new ApiError(423, 'Account has been locked for 1 hour due to 5 consecutive failed login attempts.');
    }
    throw new ApiError(401, 'Invalid email or password.');
  }
  if (!user.isActive) throw new ApiError(403, 'Account is deactivated. Please contact library administration.');
  await redis.del(failedKey, lockKey);
  user.lastLogin = new Date();
  const accessToken = user.generateJWT();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  sendRefreshTokenCookie(res, refreshToken);
  return res.status(200).json(new ApiResponse(200, { user: await User.findById(user._id), accessToken, refreshToken }, 'Logged in successfully.'));
});

const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) throw new ApiError(401, 'Refresh token is required.');
  requireRedis();
  let decoded;
  try { decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET); }
  catch (error) { throw new ApiError(401, 'Refresh token is expired or invalid.'); }
  if (decoded.jti && await redis.get(`blacklist:${decoded.jti}`)) throw new ApiError(401, 'Refresh token has been revoked. Please log in again.');
  const user = await User.findById(decoded._id).select('+refreshToken');
  if (!user || !user.isActive) throw new ApiError(401, 'User no longer exists or is deactivated.');
  if (user.refreshToken !== token) throw new ApiError(401, 'Refresh token does not match active session.');
  const accessToken = user.generateJWT();
  const newRefreshToken = user.generateRefreshToken();
  user.refreshToken = newRefreshToken;
  await user.save({ validateBeforeSave: false });
  sendRefreshTokenCookie(res, newRefreshToken);
  return res.status(200).json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, 'Access token refreshed successfully.'));
});

const logout = asyncHandler(async (req, res) => {
  requireRedis();
  const user = await User.findById(req.user._id).select('+refreshToken');
  await revokeRefresh(user?.refreshToken);
  if (req.tokenJti) await redis.set(`blacklist:${req.tokenJti}`, '1', 'EX', 30 * 86400);
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });
  clearRefreshTokenCookie(res);
  return res.status(200).json(new ApiResponse(200, null, 'Logged out successfully.'));
});

const verifyEmail = asyncHandler(async (req, res) => {
  const hash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ emailVerifyToken: hash, emailVerifyExpires: { $gt: Date.now() } });
  if (!user) throw new ApiError(400, 'Invalid or expired email verification token.');
  user.isEmailVerified = true;
  user.emailVerifyToken = undefined;
  user.emailVerifyExpires = undefined;
  await user.save({ validateBeforeSave: false });
  const delivery = await committedEmail(user, 'Welcome to the Library Management System', templates.welcomeEmail(user.name, user.memberId), `welcome:${user._id}`);
  return res.status(200).json(new ApiResponse(200, { delivery }, 'Email verified successfully.'));
});

const resendVerification = asyncHandler(async (req, res) => {
  const email = (req.body.email || req.user?.email || '').toLowerCase().trim();
  if (!email) throw new ApiError(400, 'Email address is required.');
  requireRedis();
  const key = `resend_verify:${email}`;
  if (await redis.get(key)) throw new ApiError(429, 'Please wait 5 minutes before requesting another verification email.');
  const user = await User.findOne({ email });
  if (user && !user.isEmailVerified) {
    const token = user.generateEmailVerifyToken();
    await user.save({ validateBeforeSave: false });
    const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    await queueEmail(user, 'Verify your Library Account', templates.verifyEmail(user.name, url), `verify:${user._id}:${user.emailVerifyToken}`);
  }
  await redis.set(key, '1', 'EX', 300);
  return res.status(202).json(new ApiResponse(202, null, 'If this email is registered and unverified, verification delivery has been requested.'));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase().trim() });
  if (user?.isActive) {
    const token = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });
    const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    await queueEmail(user, 'Library Password Reset Request', templates.resetPassword(user.name, url), `password-reset:${user._id}:${user.passwordResetToken}`);
  }
  return res.status(200).json(new ApiResponse(200, null, 'If an account associated with that email exists, password reset delivery has been requested.'));
});

const resetPassword = asyncHandler(async (req, res) => {
  const hash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ passwordResetToken: hash, passwordResetExpires: { $gt: Date.now() } }).select('+refreshToken');
  if (!user || !user.isActive) throw new ApiError(400, 'Invalid or expired password reset token.');
  requireRedis();
  await revokeRefresh(user.refreshToken);
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken = undefined;
  await user.save();
  clearRefreshTokenCookie(res);
  return res.status(200).json(new ApiResponse(200, null, 'Password reset successful. Please log in with your new password.'));
});

const getCurrentUser = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, req.user, 'Current user profile retrieved.')));
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const updates = {};
  if (name) updates.name = name.trim();
  if (phone) updates.phone = phone.trim();
  if (req.file?.processed?.url) updates.avatar = req.file.processed.url;
  else if (req.body.avatar) updates.avatar = req.body.avatar.trim();
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  return res.status(200).json(new ApiResponse(200, user, 'Profile updated successfully.'));
});
const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password +refreshToken');
  if (!user) throw new ApiError(404, 'User not found.');
  if (!await user.comparePassword(req.body.oldPassword)) throw new ApiError(400, 'Current password is incorrect.');
  requireRedis();
  await revokeRefresh(user.refreshToken);
  user.password = req.body.newPassword;
  user.refreshToken = undefined;
  await user.save();
  clearRefreshTokenCookie(res);
  return res.status(200).json(new ApiResponse(200, null, 'Password changed successfully. Please log in again.'));
});
module.exports = { register, login, refreshToken, logout, verifyEmail, resendVerification, forgotPassword, resetPassword, getCurrentUser, updateProfile, changePassword };
