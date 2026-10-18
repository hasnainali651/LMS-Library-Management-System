require('./providerIsolation');
jest.mock('../src/socket', () => ({ getIO: jest.fn() }));
jest.mock('../src/services/eligibilityService', () => ({ checkEligibility: jest.fn() }));
jest.mock('../src/services/notificationService', () => ({ createNotification: jest.fn() }));
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { Reservation, Book, Copy, Transaction } = require('../src/models');
const service = require('../src/services/reservationService');
const eligibility = require('../src/services/eligibilityService');
const notices = require('../src/services/notificationService');
const { getIO } = require('../src/socket');
const query = (value) => {
  const chain = {};
  for (const name of ['session', 'sort', 'select', 'populate', 'lean']) chain[name] = jest.fn(() => chain);
  chain.then = (resolve, reject) => Promise.resolve(value).then(resolve, reject);
  return chain;
};
const now = new Date('2026-10-13T12:00:00Z');
const id = () => new mongoose.Types.ObjectId();
let session;
let book;
let copy;
let emit;
const hold = (values = {}) => {
  const result = { _id: id(), member: id(), book: book._id, status: 'pending', position: 1, save: jest.fn().mockResolvedValue(), ...values };
  result.toObject = () => ({ ...result });
  return result;
};
beforeEach(() => {
  session = { withTransaction: jest.fn(async (callback) => callback()), endSession: jest.fn().mockResolvedValue() };
  jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
  book = { _id: id(), isActive: true, availableCopies: 0, title: 'Test book' };
  copy = { _id: id(), book: book._id, status: 'issued' };
  jest.spyOn(Book, 'findOneAndUpdate').mockResolvedValue(book);
  jest.spyOn(Copy, 'findById').mockReturnValue(query(copy));
  jest.spyOn(Copy, 'findOneAndUpdate').mockResolvedValue(copy);
  jest.spyOn(Transaction, 'exists').mockReturnValue(query(null));
  jest.spyOn(Reservation, 'exists').mockReturnValue(query(null));
  jest.spyOn(Reservation, 'find').mockReturnValue(query([]));
  eligibility.checkEligibility.mockResolvedValue({ eligible: true });
  notices.createNotification.mockResolvedValue({ deliveryStatus: 'pending' });
  emit = jest.fn();
  getIO.mockReturnValue({ to: jest.fn(() => ({ emit })) });
});
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

describe('FIFO handoff', () => {
  it('skips ineligible members and assigns the first eligible member without decrementing unavailable stock', async () => {
    const first = hold();
    const next = hold({ position: 2 });
    Reservation.find.mockReturnValueOnce(query([first, next])).mockReturnValue(query([first]));
    eligibility.checkEligibility.mockResolvedValueOnce({ eligible: false }).mockResolvedValueOnce({ eligible: true });
    const events = [];
    const assigned = await service.assignNextReservation(book._id, copy._id, { session, events, now, fromStatus: 'issued' });
    expect(assigned).toBe(next);
    expect(next.status).toBe('ready');
    expect(next.expiresAt.getTime() - now.getTime()).toBe(Number(process.env.RESERVATION_HOLD_HOURS ?? 48) * 3600000);
    expect(next.save).toHaveBeenCalledWith({ session });
    expect(Book.findOneAndUpdate.mock.calls.some((call) => call[1].$inc.availableCopies)).toBe(false);
    expect(Copy.findOneAndUpdate).toHaveBeenCalledWith({ _id: copy._id, book: book._id, status: 'issued' }, { $set: { status: 'reserved' } }, expect.objectContaining({ session }));
    expect(events[0]).toMatchObject({ rooms: [`user:${next.member}`], name: 'reservation:ready', payload: { reservation: expect.any(Object), book: expect.objectContaining({ title: book.title }), expiresAt: next.expiresAt } });
    expect(Object.keys(events[0].payload).sort()).toEqual(['book', 'expiresAt', 'reservation']);
    expect(notices.createNotification).toHaveBeenCalledWith(expect.objectContaining({ session }), expect.objectContaining({ session, dedupKey: expect.stringContaining(String(next._id)) }));
    expect(emit).not.toHaveBeenCalled();
  });
  it('requires explicit source state for an unavailable copy', async () => {
    await expect(service.assignNextReservation(book._id, copy._id, { session })).rejects.toMatchObject({ statusCode: 409 });
  });
  it('returns null when no eligible pending reservation exists', async () => {
    expect(await service.assignNextReservation(book._id, copy._id, { session, fromStatus: 'issued' })).toBeNull();
    expect(Copy.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('recomputes sequential queue positions within the session', async () => {
    const entries = [hold({ position: 3 }), hold({ position: 5 })];
    Reservation.find.mockReturnValue(query(entries));
    expect(await service.recomputeQueuePositions(book._id, session)).toBe(2);
    expect(entries.map((entry) => entry.position)).toEqual([1, 2]);
    entries.forEach((entry) => expect(entry.save).toHaveBeenCalledWith({ session }));
  });
});

describe('Reservation creation', () => {
  it('rejects shelf availability', async () => {
    book.availableCopies = 1;
    await expect(service.createReservation({ bookId: book._id, memberId: id() })).rejects.toMatchObject({ statusCode: 400 });
  });
  it('rejects duplicate active reservations', async () => {
    Reservation.exists.mockReturnValue(query({ _id: id() }));
    await expect(service.createReservation({ bookId: book._id, memberId: id() })).rejects.toMatchObject({ statusCode: 409 });
  });
  it('rejects an existing loan of the same book', async () => {
    Transaction.exists.mockReturnValue(query({ _id: id() }));
    await expect(service.createReservation({ bookId: book._id, memberId: id() })).rejects.toMatchObject({ statusCode: 409 });
  });
  it('creates at count + 1 and emits the exact staff payload after commit', async () => {
    const created = hold({ position: 3 });
    jest.spyOn(Reservation, 'countDocuments').mockReturnValue(query(2));
    jest.spyOn(Reservation, 'create').mockResolvedValue([created]);
    jest.spyOn(Reservation, 'findById').mockReturnValue(query(created));
    await service.createReservation({ bookId: book._id, memberId: created.member, now });
    expect(Reservation.create).toHaveBeenCalledWith([expect.objectContaining({ position: 3, requestDate: now })], { session });
    expect(emit).toHaveBeenCalledWith('reservation:created', { reservation: created });
  });
});

describe('Cancellation and actual expiry', () => {
  it('releases a ready hold once and rejects repeated cancellation', async () => {
    copy.status = 'reserved';
    const reservation = hold({ status: 'ready', assignedCopy: copy._id });
    jest.spyOn(Reservation, 'findById').mockReturnValue(query(reservation));
    const input = { reservationId: reservation._id, user: { _id: reservation.member, role: 'student' } };
    await service.closeReservation(input);
    expect(reservation.status).toBe('cancelled');
    expect(Book.findOneAndUpdate).toHaveBeenCalledWith({ _id: book._id }, { $inc: { availableCopies: 1 } }, expect.objectContaining({ session }));
    await expect(service.closeReservation(input)).rejects.toMatchObject({ statusCode: 409 });
    expect(Copy.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
  it('hands a cancelled ready hold directly to the next member without releasing stock', async () => {
    copy.status = 'reserved';
    const reservation = hold({ status: 'ready', assignedCopy: copy._id });
    const next = hold();
    jest.spyOn(Reservation, 'findById').mockReturnValue(query(reservation));
    Reservation.find.mockReturnValueOnce(query([next])).mockReturnValue(query([]));
    await service.closeReservation({ reservationId: reservation._id, user: { _id: reservation.member, role: 'student' }, now });
    expect(next.status).toBe('ready');
    expect(Book.findOneAndUpdate.mock.calls.some((call) => call[1].$inc.availableCopies)).toBe(false);
  });
  it.each([['student', 403], ['librarian', 400]])('rejects unauthorized or reasonless %s cancellation', async (role, statusCode) => {
    jest.spyOn(Reservation, 'findById').mockReturnValue(query(hold()));
    await expect(service.closeReservation({ reservationId: id(), user: { _id: id(), role } })).rejects.toMatchObject({ statusCode });
  });
  it('allows staff cancellation with a reason', async () => {
    const reservation = hold();
    jest.spyOn(Reservation, 'findById').mockReturnValue(query(reservation));
    await service.closeReservation({ reservationId: reservation._id, user: { _id: id(), role: 'librarian' }, reason: 'Member requested cancellation' });
    expect(reservation).toMatchObject({ status: 'cancelled', cancelReason: 'Member requested cancellation' });
  });
  it('expires only at expiresAt and repeated expiry is a no-op', async () => {
    copy.status = 'reserved';
    const reservation = hold({ status: 'ready', assignedCopy: copy._id, expiresAt: now });
    jest.spyOn(Reservation, 'findById').mockReturnValue(query(reservation));
    expect(await service.closeReservation({ reservationId: reservation._id, expire: true, now: new Date(now.getTime() - 1) })).toBeNull();
    await service.closeReservation({ reservationId: reservation._id, expire: true, now });
    expect(reservation.status).toBe('expired');
    expect(await service.closeReservation({ reservationId: reservation._id, expire: true, now })).toBeNull();
    expect(Copy.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(notices.createNotification).toHaveBeenCalledTimes(1);
  });
  it('queries all expired ready IDs for reconciliation', async () => {
    expect(await service.expireHolds(now)).toBe(0);
    expect(Reservation.find).toHaveBeenCalledWith({ status: 'ready', expiresAt: { $lte: now } });
    expect(service.processExpiredReservations).toBe(service.expireHolds);
  });
});

describe('Reservation route guards', () => {
  it.each(['', '/my', '/book/book123', '/res123'])('rejects unauthenticated GET %s', async (path) => {
    expect((await request(app).get(`/api/v1/reservations${path}`)).status).toBe(401);
  });
  it('rejects unauthenticated create and cancellation', async () => {
    expect((await request(app).post('/api/v1/reservations').send({ bookId: 'book123' })).status).toBe(401);
    expect((await request(app).delete('/api/v1/reservations/res123')).status).toBe(401);
  });
});
