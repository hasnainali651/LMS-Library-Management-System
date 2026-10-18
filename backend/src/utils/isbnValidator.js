/**
 * Validates ISBN-10 (modulo-11) and ISBN-13 (modulo-10) checksums
 * @param {string} isbn
 * @returns {boolean}
 */
const isValidISBN = (isbn) => {
  if (!isbn || typeof isbn !== 'string') return false;

  const cleaned = isbn.replace(/[- ]/g, '').toUpperCase();

  // Validate ISBN-10
  if (cleaned.length === 10) {
    if (!/^\d{9}[\dX]$/.test(cleaned)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned[i], 10) * (10 - i);
    }
    const checkDigit = cleaned[9] === 'X' ? 10 : parseInt(cleaned[9], 10);
    sum += checkDigit;

    return sum % 11 === 0;
  }

  // Validate ISBN-13
  if (cleaned.length === 13) {
    if (!/^\d{13}$/.test(cleaned)) return false;

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(cleaned[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return parseInt(cleaned[12], 10) === checkDigit;
  }

  return false;
};

module.exports = {
  isValidISBN,
};
