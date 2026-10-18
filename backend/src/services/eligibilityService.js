const { User, MembershipType, Transaction } = require("../models");
const ApiError = require("../utils/ApiError");
const DAY = 86400000;

const withSession = (query, session = null) =>
  session && query && typeof query.session === "function"
    ? query.session(session)
    : query;

const getPolicy = async (member, session = null) => {
  const policy = await withSession(
    MembershipType.findOne({
    name: member.membershipType,
    isActive: true,
    }),
    session,
  );
  if (!policy)
    throw new ApiError(400, "Member has no active membership policy.");
  return policy;
};

const snapshotPolicy = (policy) =>
  Object.fromEntries(
    [
      "name",
      "maxBooks",
      "loanDays",
      "renewalLimit",
      "finePerDay",
      "maxFinePerBook",
      "maxFineBalance",
      "canBorrowReference",
    ].map((key) => [key, policy[key]]),
  );

const checkEligibility = async (
  memberId,
  { session = null, book = null, now = new Date(), ignoreQuota = false } = {},
) => {
  if (book && !book.isActive)
    return {
      eligible: false,
      reason: "Book is no longer available for borrowing.",
    };
  const member = await withSession(User.findById(memberId), session);
  if (!member || !member.isActive)
    return {
      eligible: false,
      reason:
        "Member account does not exist or is currently inactive/suspended.",
    };
  if (member.membershipExpiry && member.membershipExpiry <= now)
    return {
      eligible: false,
      reason: "Membership expired. Please renew your membership.",
    };
  const overdue = await withSession(Transaction.exists({
    member: memberId,
    status: { $in: ["active", "overdue"] },
    dueDate: { $lt: new Date(now.getTime() - 14 * DAY) },
  }), session);
  if (overdue)
    return {
      eligible: false,
      reason:
        "Borrowing privileges suspended due to prolonged overdue book (>14 days).",
    };
  const policy = await getPolicy(member, session);
  if (book?.categories?.includes("Reference") && !policy.canBorrowReference)
    return {
      eligible: false,
      reason: "Membership policy does not permit reference-book borrowing.",
    };
  const fineBalance = member.fineBalance ?? 0;
  if (fineBalance > policy.maxFineBalance)
    return {
      eligible: false,
      reason: `Unpaid fines exceed the maximum allowable threshold of PKR ${policy.maxFineBalance}.`,
      fineBalance,
    };
  const activeLoans = await withSession(Transaction.countDocuments({
    member: memberId,
    status: { $in: ["active", "overdue"] },
  }), session);
  if (!ignoreQuota && activeLoans >= policy.maxBooks)
    return {
      eligible: false,
      reason: `Member has reached the maximum borrowing quota of ${policy.maxBooks} books.`,
      activeLoans,
      maxBooks: policy.maxBooks,
      fineBalance,
    };
  return {
    eligible: true,
    reason: null,
    activeLoans,
    maxBooks: policy.maxBooks,
    fineBalance,
    member,
    policy,
  };
};

const resolveOverdueBlock = async (memberId, session, now = new Date()) => {
  const overdue = await withSession(Transaction.exists({
    member: memberId,
    status: { $in: ["active", "overdue"] },
    dueDate: { $lt: new Date(now.getTime() - 14 * DAY) },
  }), session);
  await User.updateOne(
    { _id: memberId },
    { $set: { overdueBlocked: Boolean(overdue) } },
    { session },
  );
  return Boolean(overdue);
};
module.exports = {
  checkEligibility,
  getPolicy,
  snapshotPolicy,
  resolveOverdueBlock,
};
