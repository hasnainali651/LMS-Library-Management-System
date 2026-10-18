const { randomUUID } = require('crypto');
const { Transaction, Fine, User } = require('../models');
const ApiError = require('../utils/ApiError');
const notificationService = require('./notificationService');
const DAY = 86400000;
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const money = (value, allowZero = false) => {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') throw new ApiError(400, 'Amount must be a valid monetary value.');
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount === 0) || Math.abs(round(amount) - amount) > 0.000001) throw new ApiError(400, 'Amount must be positive with at most two decimal places.');
  return round(amount);
};
const accruedOverdue = (transaction, now) => {
  const policy = transaction.policySnapshot;
  if (!policy || !Number.isFinite(policy.finePerDay) || !Number.isFinite(policy.maxFinePerBook)) throw new ApiError(409, 'Loan policy snapshot is missing or invalid.');
  const overdueDays = Math.floor(Math.max(0, now.getTime() - new Date(transaction.dueDate).getTime()) / DAY);
  return { overdueDays, amount: round(Math.min(overdueDays * policy.finePerDay, policy.maxFinePerBook)) };
};
const outstanding = (fine) => round(fine.amount - fine.paidAmount - fine.waivedAmount);

const recordFineNotice = async (fine, delta, member, session, events) => {
  await notificationService.createNotification({
    userId: fine.member, type: 'fine_added', title: 'New Fine Assessment',
    message: `A ${fine.type} fine of PKR ${delta} was assessed. Outstanding balance: PKR ${member.fineBalance}.`,
    meta: { fineId: fine._id, amount: delta, balance: member.fineBalance }, channels: ['in_app', 'email'],
    session, dedupKey: `fine:${fine._id}:assessment:${fine.amount}`,
  }, { session, dedupKey: `fine:${fine._id}:assessment:${fine.amount}` });
  events.push({ rooms: [`user:${fine.member}`], name: 'fine:added', payload: { fine: fine.toObject(), newBalance: member.fineBalance } });
};

const addAssessment = async ({ member, transaction, amount, type, now = new Date() }, session, events) => {
  const charge = money(amount);
  const [fine] = await Fine.create([{ member, transaction, amount: charge, type, assessments: [{ amount: charge, assessedAt: now }] }], { session });
  const updated = await User.findByIdAndUpdate(member, { $inc: { fineBalance: charge } }, { new: true, session });
  if (!updated) throw new ApiError(404, 'Member not found.');
  await recordFineNotice(fine, charge, updated, session, events);
  return fine;
};

const assessOverdue = async (transaction, now, session, events) => {
  const accrual = accruedOverdue(transaction, now);
  let fine = await Fine.findOne({ transaction: transaction._id, type: 'overdue' }).session(session);
  const delta = round(Math.max(0, accrual.amount - (fine?.amount ?? 0)));
  if (delta > 0) {
    if (!fine) fine = new Fine({ member: transaction.member, transaction: transaction._id, type: 'overdue', amount: 0 });
    fine.amount = round(fine.amount + delta);
    fine.assessments.push({ amount: delta, assessedAt: now, overdueDays: accrual.overdueDays });
    await fine.save({ session });
    const member = await User.findByIdAndUpdate(transaction.member, { $inc: { fineBalance: delta } }, { new: true, session });
    if (!member) throw new ApiError(404, 'Member not found.');
    await recordFineNotice(fine, delta, member, session, events);
  }
  transaction.fineAmount = fine?.amount ?? 0;
  if (transaction.dueDate < now && transaction.status === 'active') transaction.status = 'overdue';
  await transaction.save({ session });
  return { fine, delta, overdueDays: accrual.overdueDays };
};

const computeOverdueFines = async (now = new Date()) => {
  const transactions = await Transaction.find({ status: { $in: ['active', 'overdue'] }, dueDate: { $lt: now } }).select('_id').lean();
  let processedCount = 0;
  let totalFinesCalculated = 0;
  for (const entry of transactions) {
    const result = await require('./circulationService').runAtomic(async (session, events) => {
      const transaction = await Transaction.findOne({ _id: entry._id, status: { $in: ['active', 'overdue'] } }).session(session);
      if (!transaction) return null;
      return assessOverdue(transaction, now, session, events);
    });
    if (result) { processedCount += 1; totalFinesCalculated = round(totalFinesCalculated + result.delta); }
  }
  return { processedCount, totalFinesCalculated };
};

const collectFines = ({ fineIds, amount, paymentMethod = 'cash', collectedBy, now = new Date() }) => {
  const payAmount = money(amount);
  if (!Array.isArray(fineIds) || !fineIds.length || new Set(fineIds.map(String)).size !== fineIds.length) throw new ApiError(400, 'fineIds must contain unique fine IDs.');
  if (!['cash', 'online'].includes(paymentMethod)) throw new ApiError(400, "paymentMethod must be 'cash' or 'online'.");
  const receiptNumber = `RCP-${randomUUID()}`;
  return require('./circulationService').runAtomic(async (session) => {
    const fines = await Fine.find({ _id: { $in: fineIds } }).sort({ createdAt: 1, _id: 1 }).session(session);
    if (fines.length !== fineIds.length || fines.some((fine) => outstanding(fine) <= 0)) throw new ApiError(400, 'Every selected fine must exist and have an outstanding balance.');
    const memberId = fines[0].member;
    if (fines.some((fine) => String(fine.member) !== String(memberId))) throw new ApiError(400, 'Cannot collect fines belonging to different members.');
    const total = round(fines.reduce((sum, fine) => sum + outstanding(fine), 0));
    if (payAmount > total) throw new ApiError(400, 'Payment exceeds the selected outstanding balance.');
    let remaining = payAmount;
    const settledFines = [];
    for (const fine of fines) {
      if (remaining <= 0) break;
      const allocation = round(Math.min(remaining, outstanding(fine)));
      fine.payments.push({ amount: allocation, paidAt: now, paymentMethod, receiptNumber, collectedBy });
      fine.paidAmount = round(fine.paidAmount + allocation);
      await fine.save({ session });
      settledFines.push(fine);
      remaining = round(remaining - allocation);
    }
    const member = await User.findOneAndUpdate({ _id: memberId, fineBalance: { $gte: payAmount } }, { $inc: { fineBalance: -payAmount } }, { new: true, session });
    if (!member) throw new ApiError(409, 'Member fine balance is inconsistent with the ledger.');
    return { receiptNumber, amountCollected: payAmount, paymentMethod, paidAt: now, remainingMemberBalance: member.fineBalance, settledFines };
  });
};

const waiveFine = ({ fineId, reason, waivedBy, now = new Date() }) => {
  if (typeof reason !== 'string' || reason.trim().length < 20) throw new ApiError(400, 'Waiver reason must be at least 20 characters long.');
  return require('./circulationService').runAtomic(async (session) => {
    const fine = await Fine.findById(fineId).session(session);
    if (!fine) throw new ApiError(404, 'Fine not found.');
    const amount = outstanding(fine);
    if (amount <= 0) throw new ApiError(409, 'Fine has no outstanding balance.');
    fine.waivedAmount = round(fine.waivedAmount + amount);
    fine.waivers.push({ amount, waivedAt: now, waivedBy, reason: reason.trim() });
    await fine.save({ session });
    const member = await User.findOneAndUpdate({ _id: fine.member, fineBalance: { $gte: amount } }, { $inc: { fineBalance: -amount } }, { new: true, session });
    if (!member) throw new ApiError(409, 'Member fine balance is inconsistent with the ledger.');
    return { fine, amountWaived: amount, remainingMemberBalance: member.fineBalance };
  });
};
module.exports = { money, accruedOverdue, outstanding, addAssessment, assessOverdue, computeOverdueFines, collectFines, waiveFine };
