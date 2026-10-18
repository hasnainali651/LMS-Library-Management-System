const mockGenerate = jest.fn();
jest.mock('@google/genai', () => ({ GoogleGenAI: jest.fn(() => ({ models: { generateContent: mockGenerate } })) }));
jest.mock('../src/models', () => ({ Book: { find: jest.fn(), findOne: jest.fn() }, Copy: {} }));
jest.mock('../src/models/ShelfAudit', () => ({ create: jest.fn() }));
const { generateStructured, identifyBook } = require('../src/services/aiService');
const { lookupISBN } = require('../src/services/isbnLookupService');
const { Book } = require('../src/models');
const image = Buffer.from('unit image');
const extracted = { title: null, authors: [], isbn: null, confidence: 'low' };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_API_KEY = 'unit-test-only';
  process.env.GEMINI_MODEL = 'gemini-3.5-flash';
  global.fetch = jest.fn();
});

test('valid no-readable-book response remains an honest no-match', async () => {
  mockGenerate.mockResolvedValue({ text: JSON.stringify(extracted) });
  await expect(identifyBook(image, 'image/png')).resolves.toEqual({ exactMatch: null, candidates: [], extracted, confidence: 'low' });
  expect(Book.find).not.toHaveBeenCalled();
  expect(mockGenerate.mock.calls[0][0].config.responseMimeType).toBe('application/json');
});

test.each([
  [{ text: '' }, 'empty response'],
  [{ text: 'not json' }, 'malformed JSON'],
  [{ text: JSON.stringify({ title: 123 }) }, 'invalid result schema'],
  [{ text: '{}', promptFeedback: { blockReason: 'SAFETY' } }, 'blocked or incomplete'],
  [{ text: '{}', candidates: [{ finishReason: 'MAX_TOKENS' }] }, 'blocked or incomplete'],
])('rejects invalid AI result %#', async (response, message) => {
  mockGenerate.mockResolvedValue(response);
  await expect(generateStructured(image, 'image/png', 'book')).rejects.toThrow(message);
});

test.each([
  [429, 'quota'], [403, 'authentication'], [404, 'unavailable'], [504, 'timed out'], [500, 'provider request failed'],
])('propagates sanitized provider failure %s', async (status, message) => {
  mockGenerate.mockRejectedValue(Object.assign(new Error('provider private body'), { status }));
  await expect(identifyBook(image, 'image/png')).rejects.toThrow(message);
  expect(Book.find).not.toHaveBeenCalled();
});

test('shelf accepts actual empty detection but rejects malformed spines', async () => {
  mockGenerate.mockResolvedValueOnce({ text: '[]' }).mockResolvedValueOnce({ text: '[{"title":"Book","author":[],"position":0}]' });
  await expect(generateStructured(image, 'image/png', 'shelf')).resolves.toEqual([]);
  await expect(generateStructured(image, 'image/png', 'shelf')).rejects.toThrow('invalid result schema');
});

test('ISBN no-match requires successful empty responses from both providers', async () => {
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ totalItems: 0 }) });
  await expect(lookupISBN('9780306406157')).resolves.toBeNull();
});

test('ISBN provider errors cannot become fabricated successful metadata', async () => {
  global.fetch.mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ totalItems: 0 }) });
  await expect(lookupISBN('9780306406157')).rejects.toMatchObject({ statusCode: 502 });
});

test('ISBN successful fallback preserves unknown fields rather than inventing defaults', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ totalItems: 1, items: [{ volumeInfo: { title: 'Actual title' } }] }) });
  await expect(lookupISBN('9780306406157')).resolves.toMatchObject({ title: 'Actual title', authors: [], publishedYear: null, language: '', categories: [] });
});

test('ISBN invalid upstream schema is not a no-match', async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ unexpected: 'body' }) });
  await expect(lookupISBN('9780306406157')).rejects.toMatchObject({ statusCode: 502 });
});

test('ISBN validates checksum before network calls', async () => {
  await expect(lookupISBN('9780306406158')).rejects.toMatchObject({ statusCode: 400 });
  expect(global.fetch).not.toHaveBeenCalled();
});
