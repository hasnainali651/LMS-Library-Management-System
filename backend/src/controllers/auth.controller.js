const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User, MembershipType } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const redis = require('../config/redis');
const notificationService = require('../services/notificationService');
const { templates } = require('../services/emailService');

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',
});

const sendRefreshTokenCookie = (res, token) =>
  res.cookie('refreshToken', token, { ...cookieOptions(), maxAge: 30 * 86400000 });

const clearRefreshTokenCookie = (res) =>
  res.clearCookie('refreshToken', cookieOptions());

const requireRedis = () => {
  if (redis.status !== 'ready')
    throw new ApiError(503, 'Authentication service temporarily unavailable.');
};

const queueEmail = (user, subject, html, key) =>
  notificationService.queueEmail({
    userId: user._id,
    to: user.email,
    subject,
    html,
    dedupKey: key,
  });

const committedEmail = async (...args) => {
  try {
    return await queueEmail(...args);
  } catch (error) {
    return {
      status: 'failed',
      message: 'Account change saved, but email could not be queued.',
    };
  }
};

const revokeRefresh = async (token) => {
  if (!token) return;
  const decoded = jwt.decode(token);
  if (decoded?.jti) await redis.set(`blacklist:${decoded.jti}`, '1', 'EX', 30 * 86400);
};

// -------------------------------------------------------------
// REDIS MULTI-STEP ONBOARDING
// -------------------------------------------------------------

/**
 * Step 1: Start onboarding session in Redis
 */
const startOnboarding = asyncHandler(async (req, res) => {
  requireRedis();
  const { name, email, password, phone, source = 'LOCAL', avatar } = req.body;

  if (!name || !email) {
    throw new ApiError(400, 'Full name and email address are required.');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, 'An account with this email address already exists. Please sign in instead.');
  }

  const normalizedSource = ['LOCAL', 'GOOGLE', 'FACEBOOK'].includes((source || '').toUpperCase())
    ? source.toUpperCase()
    : 'LOCAL';

  if (normalizedSource === 'LOCAL') {
    if (!password || password.length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters long.');
    }
  }

  const sessionId = crypto.randomUUID();
  const sessionData = {
    sessionId,
    source: normalizedSource,
    name: name.trim(),
    email: normalizedEmail,
    password: password || '',
    phone: phone ? phone.trim() : '',
    avatar: avatar ? avatar.trim() : '',
    step: 1,
    role: 'student',
    membershipType: 'student',
    createdAt: Date.now(),
  };

  await redis.set(`onboarding:${sessionId}`, JSON.stringify(sessionData), 'EX', 3600);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        sessionId,
        currentStep: 1,
        nextStep: 2,
        profile: {
          name: sessionData.name,
          email: sessionData.email,
          source: sessionData.source,
          phone: sessionData.phone,
        },
      },
      'Registration session created. Please proceed to academic details.'
    )
  );
});

/**
 * Step 2 & 3: Save intermediate step data into Redis session
 */
const updateOnboardingStep = asyncHandler(async (req, res) => {
  requireRedis();
  const { sessionId, step, data } = req.body;

  if (!sessionId) {
    throw new ApiError(400, 'Onboarding session ID is required.');
  }

  const raw = await redis.get(`onboarding:${sessionId}`);
  if (!raw) {
    throw new ApiError(404, 'Onboarding session has expired or is invalid. Please restart registration.');
  }

  const session = JSON.parse(raw);

  if (Number(step) === 2 && data) {
    const { patronType, institution, department, studentId } = data;
    if (institution) session.institution = String(institution).trim();
    if (department) session.department = String(department).trim();
    if (studentId) session.studentId = String(studentId).trim();

    if (patronType === 'staff' || patronType === 'librarian') {
      session.role = 'librarian';
      session.membershipType = 'student';
    } else {
      session.role = 'student';
      session.membershipType = patronType === 'faculty' ? 'student' : (patronType || 'student');
    }
    session.patronType = patronType || 'student';
    session.step = 2;
  } else if (Number(step) === 3 && data) {
    if (Array.isArray(data.interests)) {
      session.interests = data.interests.map((s) => String(s).trim()).filter(Boolean);
    }
    session.step = 3;
  }

  await redis.set(`onboarding:${sessionId}`, JSON.stringify(session), 'EX', 3600);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        sessionId,
        currentStep: session.step,
        nextStep: session.step + 1,
      },
      'Step progress successfully saved.'
    )
  );
});

/**
 * Final Step: Complete onboarding, create user in MongoDB, send verification if local
 */
const completeOnboarding = asyncHandler(async (req, res) => {
  requireRedis();
  const { sessionId, finalData } = req.body;

  if (!sessionId) {
    throw new ApiError(400, 'Onboarding session ID is required.');
  }

  const raw = await redis.get(`onboarding:${sessionId}`);
  if (!raw) {
    throw new ApiError(404, 'Onboarding session has expired or is invalid. Please restart registration.');
  }

  const session = JSON.parse(raw);

  if (finalData) {
    if (finalData.institution) session.institution = String(finalData.institution).trim();
    if (finalData.department) session.department = String(finalData.department).trim();
    if (finalData.studentId) session.studentId = String(finalData.studentId).trim();
    if (Array.isArray(finalData.interests)) {
      session.interests = finalData.interests.map((s) => String(s).trim()).filter(Boolean);
    }
    if (finalData.patronType) {
      if (finalData.patronType === 'staff' || finalData.patronType === 'librarian') {
        session.role = 'librarian';
      }
    }
  }

  // Final uniqueness check
  const existingUser = await User.findOne({ email: session.email });
  if (existingUser) {
    await redis.del(`onboarding:${sessionId}`);
    throw new ApiError(409, 'An account with this email address already exists. Please sign in.');
  }

  const isStaff = session.role === 'librarian';
  const isOauth = session.source === 'GOOGLE' || session.source === 'FACEBOOK';
  const isEmailVerified = Boolean(isOauth);
  const isStaffApproved = !isStaff; // Staff requires administrator approval

  const activeMembership = (await MembershipType.findOne({ isActive: true })) || { name: 'student' };

  const newUser = new User({
    name: session.name,
    email: session.email,
    password: session.password || crypto.randomBytes(32).toString('hex'),
    source: session.source || 'LOCAL',
    phone: session.phone || '',
    avatar: session.avatar || '',
    role: session.role || 'student',
    membershipType: activeMembership.name || 'student',
    institution: session.institution || '',
    department: session.department || '',
    studentId: session.studentId || '',
    interests: session.interests || [],
    isEmailVerified,
    isStaffApproved,
  });

  let delivery = null;
  if (!isEmailVerified) {
    const verifyToken = newUser.generateEmailVerifyToken();
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verifyToken}`;
    delivery = await committedEmail(
      newUser,
      'Verify your Library Account',
      templates.verifyEmail(newUser.name, verifyUrl),
      `verify:${newUser._id}:${newUser.emailVerifyToken}`
    );
  }

  const accessToken = newUser.generateJWT();
  const refreshToken = newUser.generateRefreshToken();
  newUser.refreshToken = refreshToken;
  await newUser.save();

  await redis.del(`onboarding:${sessionId}`);
  sendRefreshTokenCookie(res, refreshToken);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        user: await User.findById(newUser._id),
        accessToken,
        refreshToken,
        delivery,
        isStaffPending: isStaff && !isStaffApproved,
        isEmailPending: !isEmailVerified,
      },
      'Account created and profile configured successfully.'
    )
  );
});

// -------------------------------------------------------------
// THIRD-PARTY OAUTH SIGN IN (GOOGLE & FACEBOOK)
// -------------------------------------------------------------

/**
 * Handle Google and Facebook sign-in.
 * If user exists: logs them in directly.
 * If new user: starts a Redis onboarding session for Step 2 details.
 */
const oauthSignIn = asyncHandler(async (req, res) => {
  requireRedis();
  const { provider, email, name, avatar, oauthId } = req.body;

  if (!provider || !email) {
    throw new ApiError(400, 'Provider and email are required for third-party authentication.');
  }

  const normalizedProvider = provider.toUpperCase();
  if (!['GOOGLE', 'FACEBOOK'].includes(normalizedProvider)) {
    throw new ApiError(400, 'Unsupported third-party provider.');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select('+refreshToken');

  if (user) {
    if (!user.isActive) {
      throw new ApiError(403, 'Account is deactivated. Please contact library administration.');
    }

    if (avatar && (!user.avatar || user.source !== 'LOCAL')) {
      user.avatar = avatar;
    }
    user.lastLogin = new Date();
    const accessToken = user.generateJWT();
    const newRefreshToken = user.generateRefreshToken();
    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });
    sendRefreshTokenCookie(res, newRefreshToken);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          requiresOnboarding: false,
          user: await User.findById(user._id),
          accessToken,
          refreshToken: newRefreshToken,
        },
        `Signed in successfully with ${normalizedProvider}.`
      )
    );
  }

  // New OAuth user: Initialize Redis session and request academic profile
  const sessionId = crypto.randomUUID();
  const sessionData = {
    sessionId,
    source: normalizedProvider,
    name: (name || 'Library Patron').trim(),
    email: normalizedEmail,
    avatar: avatar ? avatar.trim() : '',
    oauthId: oauthId || '',
    phone: '',
    step: 2,
    role: 'student',
    membershipType: 'student',
    interests: [],
    createdAt: Date.now(),
  };

  await redis.set(`onboarding:${sessionId}`, JSON.stringify(sessionData), 'EX', 3600);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        requiresOnboarding: true,
        sessionId,
        step: 2,
        profile: {
          name: sessionData.name,
          email: sessionData.email,
          avatar: sessionData.avatar,
          source: sessionData.source,
        },
      },
      `Third-party authentication verified. Please complete your academic details.`
    )
  );
});

// -------------------------------------------------------------
// STANDARD AUTHENTICATION METHODS
// -------------------------------------------------------------

const register = asyncHandler(async (req, res) => {
  const { name, email, password, membershipType = 'student' } = req.body;
  if (await User.findOne({ email })) {
    throw new ApiError(409, 'An account with this email address already exists.');
  }
  if (!(await MembershipType.exists({ name: membershipType, isActive: true }))) {
    throw new ApiError(422, 'An active membership policy is required.');
  }

  const user = new User({ name, email, password, membershipType, role: 'student' });
  const token = user.generateEmailVerifyToken();
  await user.save();

  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  const delivery = await committedEmail(
    user,
    'Verify your Library Account',
    templates.verifyEmail(user.name, url),
    `verify:${user._id}:${user.emailVerifyToken}`
  );

  const accessToken = user.generateJWT();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  sendRefreshTokenCookie(res, refreshToken);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        user: await User.findById(user._id),
        tokens: { accessToken, refreshToken },
        delivery,
      },
      'Registration successful. Email delivery status is included.'
    )
  );
});

const login = asyncHandler(async (req, res) => {
  requireRedis();
  const email = req.body.email.toLowerCase().trim();
  const lockKey = `lock:login:${email}`;
  const failedKey = `failed:login:${email}`;

  if (await redis.get(lockKey)) {
    const minutes = Math.max(1, Math.ceil((await redis.ttl(lockKey)) / 60));
    throw new ApiError(423, `Account is temporarily locked. Please try again in ${minutes} minutes.`);
  }

  const user = await User.findOne({ email }).select('+password +refreshToken');
  if (!user || !(await user.comparePassword(req.body.password))) {
    const attempts = await redis.incr(failedKey);
    if (attempts === 1) await redis.expire(failedKey, 900);
    if (attempts >= 5) {
      await redis.set(lockKey, '1', 'EX', 3600);
      await redis.del(failedKey);
      if (user) {
        await committedEmail(
          user,
          'Security Alert: Account Temporarily Locked',
          templates.accountLocked(user.name, Date.now() + 3600000),
          `lock:${user._id}:${crypto.randomUUID()}`
        );
      }
      throw new ApiError(423, 'Account has been locked for 1 hour due to 5 consecutive failed login attempts.');
    }
    throw new ApiError(401, 'Invalid email or password.');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Account is deactivated. Please contact library administration.');
  }

  await redis.del(failedKey, lockKey);
  user.lastLogin = new Date();
  const accessToken = user.generateJWT();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  sendRefreshTokenCookie(res, refreshToken);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: await User.findById(user._id),
        accessToken,
        refreshToken,
      },
      'Logged in successfully.'
    )
  );
});

const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) throw new ApiError(401, 'Refresh token is required.');
  requireRedis();

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw new ApiError(401, 'Refresh token is expired or invalid.');
  }

  if (decoded.jti && (await redis.get(`blacklist:${decoded.jti}`))) {
    throw new ApiError(401, 'Refresh token has been revoked. Please log in again.');
  }

  const user = await User.findById(decoded._id).select('+refreshToken');
  if (!user || !user.isActive) {
    throw new ApiError(401, 'User no longer exists or is deactivated.');
  }

  if (user.refreshToken !== token) {
    throw new ApiError(401, 'Refresh token does not match active session.');
  }

  const accessToken = user.generateJWT();
  const newRefreshToken = user.generateRefreshToken();
  user.refreshToken = newRefreshToken;
  await user.save({ validateBeforeSave: false });
  sendRefreshTokenCookie(res, newRefreshToken);

  return res.status(200).json(
    new ApiResponse(
      200,
      { accessToken, refreshToken: newRefreshToken },
      'Access token refreshed successfully.'
    )
  );
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
  const user = await User.findOne({
    emailVerifyToken: hash,
    emailVerifyExpires: { $gt: Date.now() },
  });

  if (!user) throw new ApiError(400, 'Invalid or expired email verification token.');

  user.isEmailVerified = true;
  user.emailVerifyToken = undefined;
  user.emailVerifyExpires = undefined;
  await user.save({ validateBeforeSave: false });

  const delivery = await committedEmail(
    user,
    'Welcome to the Library Management System',
    templates.welcomeEmail(user.name, user.memberId),
    `welcome:${user._id}`
  );

  return res.status(200).json(new ApiResponse(200, { delivery }, 'Email verified successfully.'));
});

/**
 * Resend Verification: Explicitly verify user existence in DB before sending
 */
const resendVerification = asyncHandler(async (req, res) => {
  const email = (req.body.email || req.user?.email || '').toLowerCase().trim();
  if (!email) throw new ApiError(400, 'Email address is required.');

  // Pre-check user existence in database
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'No account found with this email address.');
  }

  if (user.isEmailVerified) {
    throw new ApiError(400, 'Your email address is already verified.');
  }

  requireRedis();
  const key = `resend_verify:${email}`;
  if (await redis.get(key)) {
    throw new ApiError(429, 'Please wait 5 minutes before requesting another verification email.');
  }

  const token = user.generateEmailVerifyToken();
  await user.save({ validateBeforeSave: false });
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

  await queueEmail(
    user,
    'Verify your Library Account',
    templates.verifyEmail(user.name, url),
    `verify:${user._id}:${user.emailVerifyToken}`
  );

  await redis.set(key, '1', 'EX', 300);
  return res.status(200).json(
    new ApiResponse(200, null, 'Verification email sent. Please check your inbox.')
  );
});

/**
 * Forgot Password: Explicitly verify user existence in DB before sending reset email
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const email = req.body.email ? req.body.email.toLowerCase().trim() : '';
  if (!email) throw new ApiError(400, 'Email address is required.');

  // Pre-check user existence in database
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'No account found with this email address. Please check your spelling or sign up.');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Account is deactivated. Please contact library administration.');
  }

  const token = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;

  await queueEmail(
    user,
    'Library Password Reset Request',
    templates.resetPassword(user.name, url),
    `password-reset:${user._id}:${user.passwordResetToken}`
  );

  return res.status(200).json(
    new ApiResponse(200, null, 'Password reset instructions have been sent to your registered email.')
  );
});

const resetPassword = asyncHandler(async (req, res) => {
  const hash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: hash,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+refreshToken');

  if (!user || !user.isActive) {
    throw new ApiError(400, 'Invalid or expired password reset token.');
  }

  requireRedis();
  await revokeRefresh(user.refreshToken);
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken = undefined;
  await user.save();
  clearRefreshTokenCookie(res);

  return res.status(200).json(
    new ApiResponse(200, null, 'Password reset successful. Please log in with your new password.')
  );
});

const getCurrentUser = asyncHandler(async (req, res) =>
  res.status(200).json(new ApiResponse(200, req.user, 'Current user profile retrieved.'))
);

/**
 * Update Profile: Supports editing name, phone, institution, department, studentId, interests, avatar
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, institution, department, studentId, interests } = req.body;
  const updates = {};

  if (name) updates.name = name.trim();
  if (phone !== undefined) updates.phone = phone.trim();
  if (institution !== undefined) updates.institution = institution.trim();
  if (department !== undefined) updates.department = department.trim();
  if (studentId !== undefined) updates.studentId = studentId.trim();

  if (interests !== undefined) {
    updates.interests = Array.isArray(interests)
      ? interests.map((s) => String(s).trim()).filter(Boolean)
      : typeof interests === 'string'
      ? interests.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  }

  if (req.file?.processed?.url) {
    updates.avatar = req.file.processed.url;
  } else if (req.body.avatar) {
    updates.avatar = req.body.avatar.trim();
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  return res.status(200).json(new ApiResponse(200, user, 'Profile updated successfully.'));
});

const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password +refreshToken');
  if (!user) throw new ApiError(404, 'User not found.');
  if (!(await user.comparePassword(req.body.oldPassword))) {
    throw new ApiError(400, 'Current password is incorrect.');
  }

  requireRedis();
  await revokeRefresh(user.refreshToken);
  user.password = req.body.newPassword;
  user.refreshToken = undefined;
  await user.save();
  clearRefreshTokenCookie(res);

  return res.status(200).json(new ApiResponse(200, null, 'Password changed successfully. Please log in again.'));
});

module.exports = {
  startOnboarding,
  updateOnboardingStep,
  completeOnboarding,
  oauthSignIn,
  register,
  login,
  refreshToken,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateProfile,
  changePassword,
};
