const request = require('supertest');
const app = require('../src/app');
const { isValidISBN } = require('../src/utils/isbnValidator');
const { Book } = require('../src/models');

describe('Books API & Validation Test Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ISBN Checksum Validator (Modulo-11 & Modulo-10)', () => {
    it('should validate valid ISBN-10 with numeric check digit', () => {
      // Clean Code ISBN-10
      expect(isValidISBN('0132350882')).toBe(true);
    });

    it('should validate valid ISBN-10 with X check digit', () => {
      // 080442957X
      expect(isValidISBN('080442957X')).toBe(true);
    });

    it('should validate valid ISBN-13', () => {
      // Clean Code ISBN-13
      expect(isValidISBN('978-0-13-235088-4')).toBe(true);
      expect(isValidISBN('9780132350884')).toBe(true);
    });

    it('should reject invalid ISBN with wrong checksum', () => {
      // Altered last digit
      expect(isValidISBN('9780132350889')).toBe(false);
      expect(isValidISBN('0132350889')).toBe(false);
      expect(isValidISBN('12345')).toBe(false);
    });
  });

  describe('Shelf Location Format Validation', () => {
    const shelfRegex = /^[A-Z]{1,3}-\d{1,3}-\d{1,3}$/;

    it('should match valid shelf location formats', () => {
      expect(shelfRegex.test('A-12-3')).toBe(true);
      expect(shelfRegex.test('CS-1-10')).toBe(true);
      expect(shelfRegex.test('LIB-100-999')).toBe(true);
    });

    it('should reject invalid shelf location formats', () => {
      expect(shelfRegex.test('a-12-3')).toBe(false);
      expect(shelfRegex.test('12-3-4')).toBe(false);
      expect(shelfRegex.test('CS-A-B')).toBe(false);
      expect(shelfRegex.test('TOOLONG-1-1')).toBe(false);
    });
  });

  describe('Books API Endpoints', () => {
    it('should return paginated list on GET /api/v1/books', async () => {
      jest.spyOn(Book, 'paginate').mockResolvedValue({
        docs: [
          {
            _id: 'book123',
            title: 'Clean Code',
            isbn: '9780132350884',
            authors: ['Robert C. Martin'],
            availableCopies: 4,
          },
        ],
        totalDocs: 1,
        limit: 10,
        page: 1,
        totalPages: 1,
      });

      const res = await request(app).get('/api/v1/books?category=Technology&available=true');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.docs).toHaveLength(1);
      expect(res.body.data.docs[0].title).toBe('Clean Code');
    });

    it('should reject search query with less than 2 characters with 400', async () => {
      const res = await request(app).get('/api/v1/books/search?q=a');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('at least 2 characters');
    });

    it('should reject unauthenticated POST /api/v1/books with 401', async () => {
      const res = await request(app)
        .post('/api/v1/books')
        .send({
          title: 'Unauthorized Book',
          isbn: '9780132350884',
        });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated POST /api/v1/books/isbn-lookup with 401', async () => {
      const res = await request(app)
        .post('/api/v1/books/isbn-lookup')
        .send({ isbn: '9780132350884' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated POST /api/v1/books/:id/copies with 401', async () => {
      const res = await request(app)
        .post('/api/v1/books/book123/copies')
        .send({ count: 5 });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
