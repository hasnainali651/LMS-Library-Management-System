const ApiError = require('../utils/ApiError');
const { isValidISBN } = require('../utils/isbnValidator');

const validCategories = [
  'Fiction', 'Non-Fiction', 'Science', 'Technology', 'Mathematics', 'History',
  'Biography', 'Literature', 'Philosophy', 'Psychology', 'Business', 'Arts',
  'Medicine', 'Law', 'Religion', 'Children', 'Reference', 'Comics', 'Travel', 'Cooking',
];
const strings = (values) => Array.isArray(values) ? values.filter((v) => typeof v === 'string') : [];
const categories = (values) => validCategories.filter((category) =>
  strings(values).some((value) => value.toLowerCase().split(/\s*\/\s*/).includes(category.toLowerCase()))
);
const year = (date) => Number(String(date || '').match(/\b\d{4}\b/)?.[0]) || null;
const text = (value) => typeof value === 'string' ? value : '';

const fetchJSON = async (url, provider) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'LibraryManagementSystem/1.0' } });
    if (!response.ok) throw new ApiError(502, `${provider} lookup failed (HTTP ${response.status})`);
    const json = await response.json();
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new ApiError(502, `${provider} returned an invalid response`);
    return json;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (['TimeoutError', 'AbortError'].includes(error.name)) throw new ApiError(504, `${provider} lookup timed out`);
    throw new ApiError(502, `${provider} lookup failed or returned malformed JSON`);
  }
};

const lookupISBN = async (rawIsbn) => {
  if (!isValidISBN(rawIsbn)) throw new ApiError(400, 'A valid ISBN-10 or ISBN-13 is required');
  const isbn = rawIsbn.replace(/[- ]/g, '').toUpperCase();
  const failures = [];
  try {
    const json = await fetchJSON(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=details&format=json`, 'Open Library');
    const item = json[`ISBN:${isbn}`];
    if (item) {
      const d = item.details;
      if (!d || !text(d.title).trim()) throw new ApiError(502, 'Open Library returned invalid book metadata');
      return {
        isbn, title: d.title,
        authors: strings(Array.isArray(d.authors) ? d.authors.map((a) => typeof a === 'string' ? a : a?.name) : []),
        publisher: text(Array.isArray(d.publishers) ? d.publishers[0] : d.publishers),
        publishedYear: year(d.publish_date), edition: text(d.edition_name),
        language: text(d.languages?.[0]?.key?.replace('/languages/', '')),
        description: text(typeof d.description === 'object' ? d.description?.value : d.description).slice(0, 5000),
        coverImage: text(item.thumbnail_url).replace('-S.', '-L.'),
        categories: categories(d.subjects), tags: strings(d.subjects).slice(0, 5),
      };
    }
    if (Object.keys(json).length) throw new ApiError(502, 'Open Library returned an unexpected response');
  } catch (error) { failures.push(error); }

  try {
    const json = await fetchJSON(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`, 'Google Books');
    if (!Number.isInteger(json.totalItems) || json.totalItems < 0 ||
        (json.totalItems > 0 && (!Array.isArray(json.items) || !json.items.length))) {
      throw new ApiError(502, 'Google Books returned an invalid response');
    }
    if (json.totalItems > 0) {
      const d = json.items[0]?.volumeInfo;
      if (!d || !text(d.title).trim()) throw new ApiError(502, 'Google Books returned invalid book metadata');
      return {
        isbn, title: d.title, authors: strings(d.authors), publisher: text(d.publisher),
        publishedYear: year(d.publishedDate), edition: '', language: text(d.language),
        description: text(d.description).slice(0, 5000),
        coverImage: text(d.imageLinks?.thumbnail).replace('http://', 'https://'),
        categories: categories(d.categories), tags: strings(d.categories).slice(0, 5),
      };
    }
  } catch (error) { failures.push(error); }
  if (failures.length) throw new ApiError(failures.every((e) => e.statusCode === 504) ? 504 : 502,
    `ISBN lookup incomplete: ${failures.map((e) => e.message).join('; ')}`);
  return null;
};

module.exports = { lookupISBN };
