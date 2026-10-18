require('./providerIsolation');
jest.mock('../src/socket', () => ({ getIO: jest.fn() }));
jest.mock('../src/services/notificationService', () => ({ createNotification: jest.fn() }));
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const circulation = require('../src/services/circulationService');
const fineService = require('../src/services/fineService');
const eligibility = require('../src/services/eligibilityService');
const reservations = require('../src/services/reservationService');
const notices = require('../src/services/notificationService');
const { getIO } = require('../src/socket');
const { Transaction, Fine, User, Book, Copy, Reservation, MembershipType } = require('../src/models');
const query = (value) => {
  const chain = {};
  for (const name of ['session', 'sort', 'select', 'limit', 'populate', 'lean']) chain[name] = jest.fn(() => chain);
  chain.then = (resolve, reject) => Promise.resolve(value).then(resolve, reject);
  return chain;
};
const now = new Date('2026-10-13T12:00:00Z');
const policy = { name: 'student', maxBooks: 3, loanDays: 14, renewalLimit: 5, finePerDay: 5, maxFinePerBook: 500, maxFineBalance: 2000, canBorrowReference: false };
const id = () => new mongoose.Types.ObjectId();
let session;
let emit;
beforeEach(() => {
  session = { withTransaction: jest.fn(async (callback) => callback()), endSession: jest.fn().mockResolvedValue() };
  jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
  emit = jest.fn();
  getIO.mockReturnValue({ to: jest.fn(() => ({ emit })) });
  notices.createNotification.mockResolvedValue({ deliveryStatus: 'pending' });
});
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

describe('Atomic circulation boundary', () => {
  it('emits only after commit and session cleanup', async () => {
    const order = [];
    session.withTransaction.mockImplementation(async (callback) => { await callback(); order.push('commit'); });
    session.endSession.mockImplementation(async () => { order.push('end'); });
    emit.mockImplementation(() => order.push('emit'));
    await circulation.runAtomic(async (activeSession, events) => {
      expect(activeSession).toBe(session);
      events.push({ rooms: ['role:librarian', 'role:admin'], name: 'book:issued', payload: { transaction: {}, member: {}, book: {} } });
      expect(emit).not.toHaveBeenCalled();
      return {};
    });
    expect(order).toEqual(['commit', 'end', 'emit']);
  });
  it('discards events on rollback and maps database conflicts', async () => {
    await expect(circulation.runAtomic(async (_, events) => {
      events.push({ name: 'book:issued' });
      throw Object.assign(new Error('duplicate'), { code: 11000 });
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(emit).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
  it('resets the event buffer when MongoDB retries a transaction', async () => {
    session.withTransaction.mockImplementation(async (callback) => { await callback(); await callback(); });
    await circulation.runAtomic(async (_, events) => { events.push({ rooms: ['user:1'], name: 'fine:added', payload: { fine: {}, newBalance: 5 } }); return {}; });
    expect(emit).toHaveBeenCalledTimes(1);
  });
  it('reports committed results when realtime delivery is unavailable', async () => {
    getIO.mockImplementation(() => { throw new Error('offline'); });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await circulation.runAtomic(async (_, events) => { events.push({ name: 'book:returned' }); return { saved: true }; });
    expect(result).toMatchObject({ saved: true, delivery: { socket: 'unavailable', notifications: 'not_required' } });
  });
  it.each([['issued', 'reserved', 0], ['reserved', 'reserved', 0], ['reserved', 'issued', 0], ['issued', 'available', 1], ['available', 'issued', -1]])('accounts only availability boundaries: %s -> %s', async (from, to, delta) => {
    jest.spyOn(Copy, 'findOneAndUpdate').mockResolvedValue({ status: to });
    jest.spyOn(Book, 'findOneAndUpdate').mockResolvedValue({});
    await circulation.moveCopy('copy', 'book', from, to, session);
    expect(Copy.findOneAndUpdate).toHaveBeenCalledWith({ _id: 'copy', book: 'book', status: from }, { $set: { status: to } }, expect.objectContaining({ session }));
    if (delta) expect(Book.findOneAndUpdate).toHaveBeenCalledWith(expect.any(Object), { $inc: { availableCopies: delta } }, expect.objectContaining({ session }));
    else expect(Book.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects a competing copy transition', async () => {
    jest.spyOn(Copy, 'findOneAndUpdate').mockResolvedValue(null);
    await expect(circulation.moveCopy('copy', 'book', 'available', 'issued', session)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('rejects an already closed return without another assessment', async () => {
    jest.spyOn(Transaction, 'findById').mockReturnValue(query({ status: 'returned' }));
    jest.spyOn(fineService, 'assessOverdue');
    await expect(circulation.returnBook({ transactionId: id(), now })).rejects.toMatchObject({ statusCode: 409 });
    expect(fineService.assessOverdue).not.toHaveBeenCalled();
  });
});

describe('Shared checkout and reserved pickup', () => {
  const setup = (status = 'available') => {
    const copy = { _id: id(), book: id(), status, condition: 'good' };
    jest.spyOn(Copy, 'findById').mockReturnValue(query(copy));
    jest.spyOn(Book, 'findOneAndUpdate').mockResolvedValue({ _id: copy.book, isActive: true });
    jest.spyOn(User, 'updateOne').mockResolvedValue({ matchedCount: 1 });
    jest.spyOn(eligibility, 'checkEligibility').mockResolvedValue({ eligible: true, policy });
    jest.spyOn(eligibility, 'resolveOverdueBlock').mockResolvedValue(false);
    jest.spyOn(Transaction, 'exists').mockReturnValue(query(null));
    jest.spyOn(reservations, 'assignNextReservation').mockResolvedValue(null);
    return copy;
  };
  it('does not increment successful borrow totals for FIFO handoff alone', async () => {
    const copy = setup();
    reservations.assignNextReservation.mockResolvedValue({ _id: id() });
    const result = await circulation.issueBook({ copyId: copy._id, memberId: id(), now });
    expect(result.issued).toBe(false);
    expect(User.updateOne).toHaveBeenCalledTimes(1);
    expect(User.updateOne.mock.calls[0][1]).toEqual({ $inc: { __v: 1 } });
  });
  it('rejects an issued copy before attempting hold assignment', async () => {
    const copy = setup('issued');
    await expect(circulation.issueBook({ copyId: copy._id, memberId: id(), now })).rejects.toMatchObject({ statusCode: 409 });
    expect(reservations.assignNextReservation).not.toHaveBeenCalled();
  });
  it('creates a loan with policy snapshot and collects the actual assigned hold', async () => {
    const copy = setup('reserved');
    const hold = { _id: id(), book: copy.book, member: id(), assignedCopy: copy._id, status: 'ready', expiresAt: new Date(now.getTime() + 1000), save: jest.fn().mockResolvedValue() };
    jest.spyOn(Reservation, 'findById').mockReturnValue(query(hold));
    jest.spyOn(Copy, 'findOneAndUpdate').mockResolvedValue(copy);
    const loan = { _id: id(), member: { name: 'Member' }, book: { title: 'Book' } };
    jest.spyOn(Transaction, 'create').mockResolvedValue([loan]);
    jest.spyOn(Transaction, 'findById').mockReturnValue(query(loan));
    jest.spyOn(Book, 'updateOne').mockResolvedValue({});
    const result = await circulation.pickupReservation({ reservationId: hold._id, issuedBy: id(), now });
    expect(Transaction.create).toHaveBeenCalledWith([expect.objectContaining({ policySnapshot: policy, dueDate: new Date(now.getTime() + 14 * 86400000), member: hold.member })], { session });
    expect(hold).toMatchObject({ status: 'collected', transaction: loan._id, collectedAt: now });
    expect(hold.save).toHaveBeenCalledWith({ session });
    expect(result.transaction).toBe(loan);
    expect(emit).toHaveBeenCalledWith('book:issued', { transaction: loan, member: loan.member, book: loan.book });
    expect(reservations.assignNextReservation).not.toHaveBeenCalled();
  });
  it('rejects pickup at the expiry instant', async () => {
    jest.spyOn(Reservation, 'findById').mockReturnValue(query({ status: 'ready', expiresAt: now }));
    await expect(circulation.pickupReservation({ reservationId: id(), now })).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('Return, loss and renewal transitions', () => {
  const setup = (condition = 'good') => {
    const tx = { _id: id(), member: id(), book: id(), copy: id(), status: 'active', dueDate: new Date(now.getTime() + 86400000), damageCharge: 0, policySnapshot: policy, renewalCount: 4, save: jest.fn().mockResolvedValue() };
    jest.spyOn(Transaction, 'findById').mockReturnValue(query(tx));
    jest.spyOn(Book, 'findOneAndUpdate').mockResolvedValue({ _id: tx.book, isActive: true, price: 0 });
    jest.spyOn(Copy, 'findById').mockReturnValue(query({ status: 'issued', condition }));
    jest.spyOn(Copy, 'findOneAndUpdate').mockResolvedValue({});
    jest.spyOn(fineService, 'assessOverdue').mockResolvedValue({ delta: 0, fine: null });
    jest.spyOn(fineService, 'addAssessment').mockResolvedValue({});
    jest.spyOn(eligibility, 'resolveOverdueBlock').mockResolvedValue(false);
    jest.spyOn(reservations, 'assignNextReservation').mockResolvedValue(null);
    return tx;
  };
  it('returns a loan and emits exactly transaction and fineAdded after commit', async () => {
    const tx = setup();
    await circulation.returnBook({ transactionId: tx._id, returnedBy: id(), now });
    expect(tx.status).toBe('returned');
    expect(tx.save).toHaveBeenCalledWith({ session });
    expect(Copy.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'issued' }), { $set: { status: 'available' } }, expect.objectContaining({ session }));
    expect(emit).toHaveBeenCalledWith('book:returned', { transaction: tx, fineAdded: 0 });
  });
  it('does not restock damaged copies even if a caller supplies a good condition', async () => {
    const tx = setup('damaged');
    await circulation.returnBook({ transactionId: tx._id, condition: 'good', now });
    expect(Copy.findOneAndUpdate).toHaveBeenCalledWith(expect.any(Object), { $set: { status: 'damaged', condition: 'damaged' } }, expect.any(Object));
    expect(reservations.assignNextReservation).not.toHaveBeenCalled();
  });
  it('honors a zero replacement price without inventing a loss charge', async () => {
    const tx = setup();
    await circulation.returnBook({ transactionId: tx._id, lost: true, now });
    expect(tx.status).toBe('lost');
    expect(fineService.addAssessment).not.toHaveBeenCalled();
    expect(Copy.findOneAndUpdate).toHaveBeenCalledWith(expect.any(Object), { $set: { status: 'lost' } }, expect.any(Object));
  });
  it('uses snapshot renewal limits above three and snapshot duration', async () => {
    const tx = setup();
    jest.spyOn(eligibility, 'checkEligibility').mockResolvedValue({ eligible: true, policy: { ...policy, renewalLimit: 1, loanDays: 1 } });
    jest.spyOn(Reservation, 'exists').mockReturnValue(query(null));
    const originalDue = tx.dueDate.getTime();
    await circulation.renewLoan({ transactionId: tx._id, user: { _id: tx.member, role: 'student' }, now });
    expect(tx.renewalCount).toBe(5);
    expect(tx.dueDate.getTime()).toBe(originalDue + 14 * 86400000);
    await expect(circulation.renewLoan({ transactionId: tx._id, user: { _id: tx.member, role: 'student' }, now })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('Active-loan search', () => {
  it('escapes regex input and bounds reference lookups and pagination', async () => {
    const memberQuery = query([{ _id: 'member' }]);
    jest.spyOn(User, 'find').mockReturnValue(memberQuery);
    jest.spyOn(Book, 'find').mockReturnValue(query([]));
    jest.spyOn(Copy, 'find').mockReturnValue(query([]));
    jest.spyOn(Transaction, 'paginate').mockResolvedValue({ docs: [] });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await require('../src/controllers/circulation.controller').getActiveLoans({ query: { search: 'A.*', limit: 1000 } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(User.find.mock.calls[0][0].$or[0].name.test('A.*')).toBe(true);
    expect(User.find.mock.calls[0][0].$or[0].name.test('Another title')).toBe(false);
    expect(memberQuery.limit).toHaveBeenCalledWith(100);
    expect(Transaction.paginate).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.arrayContaining([{ member: { $in: ['member'] } }]) }), expect.objectContaining({ limit: 100, lean: true }));
  });
});

describe('Overdue ledger and payment rules', () => {
  it.each([[0, 0], [86399999, 0], [86400000, 5], [172800000, 10]])('charges completed 24-hour periods (%i ms)', (elapsed, amount) => {
    expect(fineService.accruedOverdue({ dueDate: new Date(now.getTime() - elapsed), policySnapshot: policy }, now).amount).toBe(amount);
  });
  it.each([{ ...policy, finePerDay: 0 }, { ...policy, maxFinePerBook: 0 }])('honors a zero rate or cap', (snapshot) => {
    expect(fineService.accruedOverdue({ dueDate: new Date(0), policySnapshot: snapshot }, now).amount).toBe(0);
  });
  it('rejects missing policy snapshots rather than guessing a historical policy', () => {
    expect(() => fineService.accruedOverdue({ dueDate: now }, now)).toThrow('snapshot');
  });
  it('accrues only a delta on a previously paid/waived ledger and is idempotent', async () => {
    const member = id();
    const ledger = new Fine({ member, transaction: id(), type: 'overdue', amount: 10, paidAmount: 5, waivedAmount: 5, assessments: [{ amount: 10, assessedAt: now }] });
    jest.spyOn(ledger, 'save').mockResolvedValue(ledger);
    jest.spyOn(Fine, 'findOne').mockReturnValue(query(ledger));
    jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({ fineBalance: 5 });
    const tx = { _id: ledger.transaction, member, dueDate: new Date(now.getTime() - 3 * 86400000), policySnapshot: policy, status: 'active', save: jest.fn().mockResolvedValue() };
    const events = [];
    expect((await fineService.assessOverdue(tx, now, session, events)).delta).toBe(5);
    expect((await fineService.assessOverdue(tx, now, session, events)).delta).toBe(0);
    expect(ledger.amount).toBe(15);
    expect(fineService.outstanding(ledger)).toBe(5);
    expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(notices.createNotification).toHaveBeenCalledWith(expect.objectContaining({ session }), expect.objectContaining({ session, dedupKey: expect.any(String) }));
    expect(events[0]).toMatchObject({ rooms: [`user:${member}`], name: 'fine:added', payload: { newBalance: 5 } });
    expect(emit).not.toHaveBeenCalled();
  });
  const ledger = (member, amount) => ({ _id: id(), member, amount, paidAmount: 0, waivedAmount: 0, payments: [], waivers: [], save: jest.fn().mockResolvedValue() });
  it('rejects mixed-member collections without saving', async () => {
    const fines = [ledger(id(), 20), ledger(id(), 30)];
    jest.spyOn(Fine, 'find').mockReturnValue(query(fines));
    await expect(fineService.collectFines({ fineIds: fines.map((fine) => fine._id), amount: 10 })).rejects.toMatchObject({ statusCode: 400 });
    expect(fines[0].save).not.toHaveBeenCalled();
  });
  it('rejects overpayment', async () => {
    const fine = ledger(id(), 10);
    jest.spyOn(Fine, 'find').mockReturnValue(query([fine]));
    await expect(fineService.collectFines({ fineIds: [fine._id], amount: 11 })).rejects.toMatchObject({ statusCode: 400 });
  });
  it('allocates partial payments using one receipt and atomic balance decrement', async () => {
    const member = id();
    const fines = [ledger(member, 10), ledger(member, 20)];
    jest.spyOn(Fine, 'find').mockReturnValue(query(fines));
    jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ fineBalance: 15 });
    const result = await fineService.collectFines({ fineIds: fines.map((fine) => fine._id), amount: 15, collectedBy: id(), now });
    expect(fines.map((fine) => fine.paidAmount)).toEqual([10, 5]);
    expect(fines.map((fine) => fine.payments[0].receiptNumber)).toEqual([result.receiptNumber, result.receiptNumber]);
    expect(User.findOneAndUpdate).toHaveBeenCalledWith({ _id: member, fineBalance: { $gte: 15 } }, { $inc: { fineBalance: -15 } }, { new: true, session });
  });
  it('waives only the unpaid remainder and records an auditable entry', async () => {
    const fine = ledger(id(), 20);
    fine.paidAmount = 5;
    jest.spyOn(Fine, 'findById').mockReturnValue(query(fine));
    jest.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ fineBalance: 0 });
    const result = await fineService.waiveFine({ fineId: fine._id, reason: 'Approved hardship waiver for this member', waivedBy: id(), now });
    expect(result.amountWaived).toBe(15);
    expect(fine.waivers[0]).toMatchObject({ amount: 15, waivedAt: now });
    expect(fine.save).toHaveBeenCalledWith({ session });
  });
  it.each([-1, 0, '', NaN, Infinity, 1.001, {}, true])('rejects invalid payment %p', (amount) => {
    expect(() => fineService.money(amount)).toThrow();
  });
});

describe('Membership eligibility', () => {
  it('honors zero quota and fine threshold and disallows reference books', async () => {
    jest.spyOn(User, 'findById').mockReturnValue(query({ isActive: true, membershipType: 'student', fineBalance: 0 }));
    jest.spyOn(Transaction, 'exists').mockReturnValue(query(null));
    jest.spyOn(Transaction, 'countDocuments').mockReturnValue(query(0));
    jest.spyOn(MembershipType, 'findOne').mockReturnValue(query({ ...policy, maxBooks: 0, maxFineBalance: 0 }));
    expect((await eligibility.checkEligibility(id())).eligible).toBe(false);
    expect((await eligibility.checkEligibility(id(), { book: { isActive: true, categories: ['Reference'] } })).reason).toContain('reference');
  });
});

describe('Authentication guards', () => {
  it.each(['/circulation/issue', '/circulation/return', '/circulation/renew', '/fines/collect', '/fines/waive'])('rejects unauthenticated POST %s', async (path) => {
    expect((await request(app).post(`/api/v1${path}`).send({})).status).toBe(401);
  });
  it.each(['/circulation/active', '/fines'])('rejects unauthenticated GET %s', async (path) => {
    expect((await request(app).get(`/api/v1${path}`)).status).toBe(401);
  });
});
