const mongoose = require('mongoose');
const {
  User,
  Book,
  Copy,
  Transaction,
  Reservation,
  Fine,
  MembershipType,
  Notification,
  Review,
  AuditLog,
} = require('../src/models');

describe('Mongoose Models & Schema Validations', () => {
  it('should verify all 10 models integrate mongoose-paginate-v2', () => {
    const models = [
      User,
      Book,
      Copy,
      Transaction,
      Reservation,
      Fine,
      MembershipType,
      Notification,
      Review,
      AuditLog,
    ];

    models.forEach((model) => {
      expect(typeof model.paginate).toBe('function');
    });
  });

  describe('User Model', () => {
    it('should validate required fields and constraints on User', () => {
      const user = new User({});
      const err = user.validateSync();
      expect(err.errors.name).toBeDefined();
      expect(err.errors.email).toBeDefined();
      expect(err.errors.password).toBeDefined();
    });

    it('should reject invalid role in User', () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123!',
        role: 'invalid_role',
      });
      const err = user.validateSync();
      expect(err.errors.role).toBeDefined();
    });

    it('should have password reset and email verify token generation methods', () => {
      const user = new User({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
      });

      const resetToken = user.generatePasswordResetToken();
      expect(typeof resetToken).toBe('string');
      expect(user.passwordResetToken).toBeDefined();
      expect(user.passwordResetExpires).toBeDefined();

      const verifyToken = user.generateEmailVerifyToken();
      expect(typeof verifyToken).toBe('string');
      expect(user.emailVerifyToken).toBeDefined();
    });
  });

  describe('Book Model', () => {
    it('should reject invalid ISBN and require authors', () => {
      const book = new Book({
        title: 'Sample Book',
        isbn: '123', // invalid ISBN
        authors: [],
      });
      const err = book.validateSync();
      expect(err.errors.isbn).toBeDefined();
      expect(err.errors.authors).toBeDefined();
    });

    it('should accept valid 13-digit ISBN and valid category', () => {
      const book = new Book({
        title: 'Valid Clean Code',
        isbn: '9780132350884',
        authors: ['Robert C. Martin'],
        categories: ['Technology'],
        publishedYear: 2008,
      });
      const err = book.validateSync();
      expect(err).toBeUndefined();
    });

    it('should reject invalid category', () => {
      const book = new Book({
        title: 'Invalid Category Book',
        isbn: '9780132350884',
        authors: ['Author One'],
        categories: ['UnregisteredCategoryXYZ'],
      });
      const err = book.validateSync();
      expect(err.errors.categories).toBeDefined();
    });
  });

  describe('Copy Model', () => {
    it('should provide fullBarcode virtual property', () => {
      const copyId = new mongoose.Types.ObjectId();
      const copy = new Copy({
        _id: copyId,
        book: new mongoose.Types.ObjectId(),
        copyNumber: '9780132350884-001',
        barcode: 'BC-9780132350884-001',
        shelfLocation: 'A-12-1',
      });

      expect(copy.fullBarcode).toBe(`LMS-${copyId}`);
    });
  });

  describe('Transaction Model', () => {
    it('requires dueDate and policy snapshot without a fixed renewal cap', () => {
      const transaction = new Transaction({
        member: new mongoose.Types.ObjectId(),
        book: new mongoose.Types.ObjectId(),
        copy: new mongoose.Types.ObjectId(),
        renewalCount: 4,
      });
      const err = transaction.validateSync();
      expect(err.errors.dueDate).toBeDefined();
      expect(err.errors.policySnapshot).toBeDefined();
      expect(err.errors.renewalCount).toBeUndefined();
    });
  });

  describe('Ledger and policy invariants', () => {
    it('accepts legitimate zero policy values', () => {
      const policy = new MembershipType({ name: 'restricted', displayName: 'Restricted', maxBooks: 0, renewalLimit: 0, finePerDay: 0, maxFinePerBook: 0, maxFineBalance: 0 });
      expect(policy.validateSync()).toBeUndefined();
    });
    it('rejects fractional quotas and monetary precision beyond cents', () => {
      const policy = new MembershipType({ name: 'invalid', displayName: 'Invalid', maxBooks: 1.5, finePerDay: 0.001 });
      const error = policy.validateSync();
      expect(error.errors.maxBooks).toBeDefined();
      expect(error.errors.finePerDay).toBeDefined();
    });
    it('requires ledger sums to match stored totals', async () => {
      const fine = new Fine({ member: new mongoose.Types.ObjectId(), type: 'damage', amount: 10 });
      await expect(fine.validate()).rejects.toMatchObject({ errors: { assessments: expect.anything() } });
    });
    it('derives partial status and outstanding amount from auditable entries', async () => {
      const member = new mongoose.Types.ObjectId();
      const fine = new Fine({ member, type: 'damage', amount: 10, paidAmount: 3, waivedAmount: 2,
        assessments: [{ amount: 10, assessedAt: new Date() }],
        payments: [{ amount: 3, paidAt: new Date(), receiptNumber: 'RCP-test', paymentMethod: 'cash', collectedBy: member }],
        waivers: [{ amount: 2, waivedAt: new Date(), waivedBy: member, reason: 'Approved partial waiver' }],
      });
      await fine.validate();
      expect(fine.status).toBe('partial');
      expect(fine.outstandingAmount).toBe(5);
      expect(fine.toObject().receiptNumber).toBeUndefined();
    });
    it('defines database uniqueness for open loans, ready copies and overdue ledgers', () => {
      expect(Transaction.schema.indexes()).toEqual(expect.arrayContaining([
        [expect.objectContaining({ copy: 1 }), expect.objectContaining({ unique: true, partialFilterExpression: { status: { $in: ['active', 'overdue'] } } })],
      ]));
      expect(Fine.schema.indexes()).toEqual(expect.arrayContaining([
        [expect.objectContaining({ transaction: 1, type: 1 }), expect.objectContaining({ unique: true, partialFilterExpression: { type: 'overdue' } })],
      ]));
      expect(Reservation.schema.indexes().filter(([, options]) => options.unique)).toHaveLength(2);
    });
  });

  describe('Review Model', () => {
    it('should reject rating outside 1-5 range', () => {
      const review = new Review({
        book: new mongoose.Types.ObjectId(),
        member: new mongoose.Types.ObjectId(),
        rating: 6, // Max is 5
      });
      const err = review.validateSync();
      expect(err.errors.rating).toBeDefined();
    });
  });

  describe('AuditLog Model', () => {
    it('should verify TTL index configuration for 365 days', () => {
      const indexes = AuditLog.schema.indexes();
      const ttlIndex = indexes.find(
        (idx) => idx[0].createdAt === 1 && idx[1]?.expireAfterSeconds === 31536000
      );
      expect(ttlIndex).toBeDefined();
    });
  });
});
