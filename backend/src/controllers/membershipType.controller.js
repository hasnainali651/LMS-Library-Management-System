const { MembershipType, User } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const fields = ['name', 'displayName', 'maxBooks', 'loanDays', 'renewalLimit', 'finePerDay', 'maxFinePerBook', 'maxFineBalance', 'canBorrowReference', 'isActive'];
const validateInput = (body) => {
  if (Object.keys(body).some((key) => !fields.includes(key))) throw new ApiError(400, 'Unexpected membership policy field.');
  for (const key of ['name', 'displayName']) if (key in body && (typeof body[key] !== 'string' || !body[key].trim())) throw new ApiError(400, `${key} must be a nonempty string.`);
  for (const key of ['canBorrowReference', 'isActive']) if (key in body && typeof body[key] !== 'boolean') throw new ApiError(400, `${key} must be boolean.`);
  for (const key of ['maxBooks', 'loanDays', 'renewalLimit', 'finePerDay', 'maxFinePerBook', 'maxFineBalance']) if (key in body && (typeof body[key] !== 'number' || !Number.isFinite(body[key]))) throw new ApiError(400, `${key} must be a finite number.`);
  return { ...body, ...(body.name ? { name: body.name.toLowerCase().trim() } : {}) };
};
const getMembershipTypes = asyncHandler(async (req, res) => {
  const membershipTypes = await MembershipType.find(req.query.all === 'true' ? {} : { isActive: true }).sort('name').lean();
  return res.status(200).json(new ApiResponse(200, membershipTypes, 'Membership types retrieved successfully.'));
});
const getMembershipTypeById = asyncHandler(async (req, res) => {
  const membershipType = await MembershipType.findById(req.params.id);
  if (!membershipType) throw new ApiError(404, 'Membership type not found.');
  return res.status(200).json(new ApiResponse(200, membershipType, 'Membership type details retrieved.'));
});
const createMembershipType = asyncHandler(async (req, res) => {
  const input = validateInput(req.body);
  if (!input.name || !input.displayName) throw new ApiError(400, 'Name and display name are required.');
  if (await MembershipType.exists({ name: input.name })) throw new ApiError(409, 'Membership type already exists.');
  const membershipType = await MembershipType.create(input);
  return res.status(201).json(new ApiResponse(201, membershipType, 'Membership type created successfully.'));
});
const updateMembershipType = asyncHandler(async (req, res) => {
  const input = validateInput(req.body);
  const membershipType = await MembershipType.findById(req.params.id);
  if (!membershipType) throw new ApiError(404, 'Membership type not found.');
  if (input.name && input.name !== membershipType.name) throw new ApiError(400, 'Policy name is immutable; change the display name instead.');
  if (input.isActive === false && await User.exists({ membershipType: membershipType.name, isActive: true })) throw new ApiError(400, 'Policy is assigned to active patrons.');
  Object.assign(membershipType, input);
  await membershipType.save();
  return res.status(200).json(new ApiResponse(200, membershipType, 'Membership type updated successfully.'));
});
const deleteMembershipType = asyncHandler(async (req, res) => {
  const membershipType = await MembershipType.findById(req.params.id);
  if (!membershipType) throw new ApiError(404, 'Membership type not found.');
  if (await User.exists({ membershipType: membershipType.name, isActive: true })) throw new ApiError(400, 'Cannot deactivate a policy assigned to active patrons.');
  membershipType.isActive = false;
  await membershipType.save();
  return res.status(200).json(new ApiResponse(200, null, 'Membership type deactivated successfully.'));
});
module.exports = { getMembershipTypes, getMembershipTypeById, createMembershipType, updateMembershipType, deleteMembershipType };
