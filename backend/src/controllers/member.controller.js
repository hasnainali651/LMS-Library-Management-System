const crypto = require('crypto');
const { User, Transaction, Fine, Reservation, MembershipType } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { checkEligibility } = require('../services/eligibilityService');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

const queueAccountEmail = async (member, subject, html) => {
  try {
    return await notificationService.queueEmail({ userId: member._id, to: member.email, subject, html,
      dedupeKey: `account:${member._id}:${crypto.randomUUID()}` });
  } catch (error) {
    return { status: 'failed', message: 'Account change saved, but email could not be queued.' };
  }
};

/**
 * GET /
 * Librarian+: Paginated members list with role, membershipType, isActive, search filters
 */
const getMembers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    role,
    membershipType,
    isActive,
    search,
  } = req.query;

  const query = {};

  if (role) {
    query.role = role;
  }

  if (membershipType) {
    query.membershipType = membershipType;
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true' || isActive === true;
  }

  if (search) {
    const s = search.trim();
    query.$or = [
      { name: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
      { memberId: { $regex: s, $options: 'i' } },
    ];
  }

  const options = {
    page: Math.max(1, parseInt(page, 10)),
    limit: Math.max(1, parseInt(limit, 10)),
    sort: { createdAt: -1 },
    select: '-password',
    lean: true,
  };

  const result = await User.paginate(query, options);

  return res.status(200).json(
    new ApiResponse(200, result, 'Members list retrieved successfully.')
  );
});

/**
 * GET /:id
 * Librarian+: Full profile + loan count + fine balance + last 5 transactions + canBorrow eligibility
 */
const getMemberById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const member = await User.findById(id).select('-password');
  if (!member) {
    throw new ApiError(404, 'Member not found.');
  }

  // Active loan count
  const activeLoans = await Transaction.countDocuments({
    member: member._id,
    status: { $in: ['active', 'overdue'] },
  });

  // Last 5 circulation transactions
  const recentTransactions = await Transaction.find({ member: member._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('book', 'title isbn coverImage')
    .populate({
      path: 'copy',
      select: 'barcode copyNumber shelfLocation',
      transform: (copy) => copy && ({ ...copy, fullBarcode: `LMS-${copy._id}` }),
    })
    .lean();

  // Compute borrowing & reservation eligibility
  const eligibility = await checkEligibility(member._id);

  const responseData = {
    ...member.toObject(),
    booksCurrentlyBorrowed: activeLoans,
    fineBalance: member.fineBalance || 0,
    canBorrow: eligibility.eligible,
    eligibilityReason: eligibility.reason,
    maxBooksAllowed: eligibility.maxBooks ?? null,
    recentTransactions,
  };

  return res.status(200).json(
    new ApiResponse(200, responseData, 'Member profile details retrieved successfully.')
  );
});

/**
 * POST /
 * Librarian+: Create a new patron with auto-generated memberId & temp password
 */
const createMember = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    membershipType = 'student',
    membershipExpiry,
    department,
    studentId,
  } = req.body;

  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, 'A user with this email address is already registered.');
  }

  if (!await MembershipType.exists({ name: membershipType, isActive: true })) {
    throw new ApiError(422, 'An active membership policy is required.');
  }
  const tempPassword = crypto.randomBytes(32).toString('hex');

  const member = new User({
    name: name.trim(),
    email: normalizedEmail,
    password: tempPassword,
    ...(phone ? { phone: phone.trim() } : {}),
    role: 'student',
    membershipType,
    membershipExpiry: membershipExpiry ? new Date(membershipExpiry) : null,
    department: department ? department.trim() : '',
    studentId: studentId ? studentId.trim() : '',
    isActive: true,
    isEmailVerified: true, // Created directly by librarian
  });

  const token = member.generatePasswordResetToken();
  await member.save();
  const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  const delivery = await queueAccountEmail(member, 'Welcome to the Library - Set Your Password',
    emailService.templates.resetPassword(member.name, url));

  const safeMember = await User.findById(member._id).select('-password');

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        member: safeMember,
        delivery,
      },
      'Member account created. Password setup delivery status is included.'
    )
  );
});

/**
 * PUT /:id
 * Librarian+: Update member info (cannot modify email or role)
 */
const updateMember = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const member = await User.findById(id);
  if (!member) {
    throw new ApiError(404, 'Member not found.');
  }

  // Fields allowed for librarian edit
  const {
    name,
    phone,
    membershipType,
    membershipExpiry,
    department,
    studentId,
  } = req.body;

  if (name) member.name = name.trim();
  if (phone !== undefined) member.phone = phone ? phone.trim() : '';
  if (membershipType) {
    if (!await MembershipType.exists({ name: membershipType, isActive: true })) {
      throw new ApiError(422, 'An active membership policy is required.');
    }
    member.membershipType = membershipType;
  }
  if (membershipExpiry !== undefined) {
    member.membershipExpiry = membershipExpiry ? new Date(membershipExpiry) : null;
  }
  if (department !== undefined) member.department = department ? department.trim() : '';
  if (studentId !== undefined) member.studentId = studentId ? studentId.trim() : '';

  await member.save();

  const safeMember = await User.findById(member._id).select('-password');

  return res.status(200).json(
    new ApiResponse(200, safeMember, 'Member details updated successfully.')
  );
});

/**
 * PATCH /:id/activate
 * Admin: Reactivate member account and send email alert
 */
const activateMember = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const member = await User.findById(id);
  if (!member) {
    throw new ApiError(404, 'Member not found.');
  }

  member.isActive = true;
  await member.save();

  const delivery = await queueAccountEmail(member, 'Your Library Account Has Been Reactivated',
    emailService.templates.accountActivated(member.name));

  return res.status(200).json(
    new ApiResponse(200, { isActive: true, delivery }, 'Member account reactivated successfully.')
  );
});

/**
 * PATCH /:id/suspend
 * Admin: Suspend member account with required reason and email alert
 */
const suspendMember = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    throw new ApiError(400, 'A suspension reason is strictly required.');
  }

  const member = await User.findById(id);
  if (!member) {
    throw new ApiError(404, 'Member not found.');
  }

  if (member.role === 'admin') {
    throw new ApiError(400, 'Cannot suspend a system administrator account.');
  }

  member.isActive = false;
  await member.save();

  const delivery = await queueAccountEmail(member, 'Important Notice: Library Account Suspended',
    emailService.templates.accountSuspended(member.name, reason.trim()));

  return res.status(200).json(
    new ApiResponse(200, { isActive: false, reason: reason.trim(), delivery }, 'Member account suspended.')
  );
});

/**
 * PATCH /:id/role
 * Admin: Switch role student <-> librarian (cannot modify administrator accounts)
 */
const changeMemberRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!role || !['student', 'librarian'].includes(role)) {
    throw new ApiError(400, "Role must be explicitly 'student' or 'librarian'.");
  }

  const member = await User.findById(id);
  if (!member) {
    throw new ApiError(404, 'Member not found.');
  }

  if (member.role === 'admin') {
    throw new ApiError(400, 'Cannot modify the role of a system administrator.');
  }

  member.role = role;
  await member.save();

  return res.status(200).json(
    new ApiResponse(200, { _id: member._id, role: member.role }, `Member role updated to '${role}'.`)
  );
});

/**
 * GET /:id/transactions
 * Librarian+: Paginated circulation loan history for this member
 */
const getMemberTransactions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10, status } = req.query;

  const memberExists = await User.exists({ _id: id });
  if (!memberExists) {
    throw new ApiError(404, 'Member not found.');
  }

  const query = { member: id };
  if (status) {
    query.status = status;
  }

  const options = {
    page: Math.max(1, parseInt(page, 10)),
    limit: Math.max(1, parseInt(limit, 10)),
    sort: { createdAt: -1 },
    lean: true,
    populate: [
      { path: 'book', select: 'title isbn coverImage authors' },
      {
        path: 'copy',
        select: 'barcode copyNumber shelfLocation',
        transform: (copy) => copy && ({ ...copy, fullBarcode: `LMS-${copy._id}` }),
      },
    ],
  };

  const result = await Transaction.paginate(query, options);

  return res.status(200).json(
    new ApiResponse(200, result, 'Member transactions retrieved successfully.')
  );
});

/**
 * GET /:id/fines
 * Librarian+: All fine records for this member with optional status filtering
 */
const getMemberFines = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.query;

  const memberExists = await User.exists({ _id: id });
  if (!memberExists) {
    throw new ApiError(404, 'Member not found.');
  }

  const query = { member: id };
  if (status) {
    query.status = status;
  }

  const fines = await Fine.find(query)
    .sort({ createdAt: -1 })
    .populate('transaction', 'issueDate dueDate returnDate fineAmount')
    .lean();

  return res.status(200).json(
    new ApiResponse(200, fines, 'Member fines retrieved successfully.')
  );
});

/**
 * GET /:id/reservations
 * Librarian+: All reservations placed by this member
 */
const getMemberReservations = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const memberExists = await User.exists({ _id: id });
  if (!memberExists) {
    throw new ApiError(404, 'Member not found.');
  }

  const reservations = await Reservation.find({ member: id })
    .sort({ createdAt: -1 })
    .populate('book', 'title isbn coverImage')
    .populate({
      path: 'assignedCopy',
      select: 'barcode copyNumber shelfLocation',
      transform: (copy) => copy && ({ ...copy, fullBarcode: `LMS-${copy._id}` }),
    })
    .lean();

  return res.status(200).json(
    new ApiResponse(200, reservations, 'Member reservations retrieved successfully.')
  );
});

/**
 * POST /:id/avatar
 * Protected: Upload avatar image for patron (by own user or librarian+)
 */
const uploadMemberAvatar = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Authorization check: User must be editing their own avatar or be librarian/admin
  const isOwner = req.user._id.toString() === id;
  const isStaff = req.user.role === 'admin' || req.user.role === 'librarian';

  if (!isOwner && !isStaff) {
    throw new ApiError(403, 'You are not authorized to update another member’s avatar.');
  }

  const member = await User.findById(id);
  if (!member) {
    throw new ApiError(404, 'Member not found.');
  }

  if (!req.file || !req.file.processed) {
    throw new ApiError(400, 'Please upload a valid image file for the avatar.');
  }

  member.avatar = req.file.processed.url;
  await member.save();

  return res.status(200).json(
    new ApiResponse(200, { avatar: member.avatar }, 'Avatar uploaded and updated successfully.')
  );
});

module.exports = {
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  activateMember,
  suspendMember,
  changeMemberRole,
  getMemberTransactions,
  getMemberFines,
  getMemberReservations,
  uploadMemberAvatar,
};
