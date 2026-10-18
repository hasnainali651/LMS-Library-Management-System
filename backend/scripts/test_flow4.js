(async () => {
  const mongoose = require('mongoose');
  await mongoose.connect('mongodb://127.0.0.1:27018/lms_db?replicaSet=rs0');
  const reservationService = require('../src/services/reservationService');
  const { Book, Copy, User, Transaction, Reservation } = require('../src/models');

  // Login admin/librarian to get token
  const libLogin = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sarah.librarian@library.com', password: 'Librarian@123456' })
  });
  const libToken = (await libLogin.json()).data?.accessToken;

  // We have student 1: student@library.com
  const student1 = await User.findOne({ email: 'student@library.com' });
  // Create student 2:
  let student2 = await User.findOne({ email: 'student2@library.com' });
  if (!student2) {
    student2 = await User.create({
      name: 'Student Two',
      email: 'student2@library.com',
      password: 'Password@1234',
      role: 'student',
      membershipType: 'student',
      isEmailVerified: true
    });
  }

  // Pick a book
  const book = await Book.findOne({ isActive: true });
  console.log('TEST_BOOK:', book.title, 'COPIES:', book.totalCopies);

  // Set all copies of this book to issued so availableCopies = 0
  await Reservation.deleteMany({ book: book._id });
  await Copy.updateMany({ book: book._id }, { $set: { status: 'issued' } });
  await Book.updateOne({ _id: book._id }, { $set: { availableCopies: 0 } });

  // Student 1 reserves
  const r1 = await reservationService.createReservation({ bookId: book._id, memberId: student1._id });
  console.log('RESERVATION_1_CREATED:', r1.reservation.position === 1, 'POS:', r1.reservation.position);

  // Student 2 reserves
  const r2 = await reservationService.createReservation({ bookId: book._id, memberId: student2._id });
  console.log('RESERVATION_2_CREATED:', r2.reservation.position === 2, 'POS:', r2.reservation.position);

  // Librarian returns a copy
  const aCopy = await Copy.findOne({ book: book._id });
  // Create a dummy transaction for that copy so returnBook can be called
  const dummyTx = await Transaction.create({
    member: student1._id,
    book: book._id,
    copy: aCopy._id,
    issuedBy: student1._id,
    issueDate: new Date(Date.now() - 86400000),
    dueDate: new Date(Date.now() + 86400000),
    status: 'active',
    policySnapshot: {
      name: 'student',
      maxBooks: 3,
      loanDays: 14,
      renewalLimit: 2,
      finePerDay: 5,
      maxFinePerBook: 500,
      maxFineBalance: 2000,
      canBorrowReference: false
    }
  });

  const returnRes = await fetch('http://localhost:5000/api/v1/circulation/return', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${libToken}` },
    body: JSON.stringify({ transactionId: dummyTx._id })
  });
  console.log('RETURN_FOR_RESERVATION_STATUS:', returnRes.status);

  // Check Student 1 status
  const r1AfterReturn = await Reservation.findById(r1.reservation._id);
  console.log('STUDENT_1_AFTER_RETURN_STATUS:', r1AfterReturn.status, 'ASSIGNED_COPY:', !!r1AfterReturn.assignedCopy, 'EXPIRES_AT:', !!r1AfterReturn.expiresAt);

  // Student 2 is still pending at position 1
  const r2AfterReturn = await Reservation.findById(r2.reservation._id);
  console.log('STUDENT_2_QUEUE_POSITION:', r2AfterReturn.position);

  // Now simulate expiration of student 1 hold
  await Reservation.updateOne({ _id: r1.reservation._id }, { $set: { expiresAt: new Date(Date.now() - 3600000) } });

  const expiredCount = await reservationService.expireHolds();
  console.log('EXPIRED_HOLDS_COUNT:', expiredCount);

  const r1Expired = await Reservation.findById(r1.reservation._id);
  console.log('STUDENT_1_STATUS_AFTER_EXPIRY:', r1Expired.status);

  const r2Promoted = await Reservation.findById(r2.reservation._id);
  console.log('STUDENT_2_STATUS_AFTER_EXPIRY:', r2Promoted.status, 'ASSIGNED_COPY:', !!r2Promoted.assignedCopy);

  process.exit(0);
})().catch(err => {
  console.error('FLOW4_ERR:', err);
  process.exit(1);
});
