const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '../..');
const localPath = path.join(root, '.env.docker.local');
dotenv.config({ path: localPath });
dotenv.config({ path: path.join(root, 'backend/.env') });
dotenv.config({ path: path.join(root, '.env') });
const sharp = require('sharp');
const { getGenAI, generateStructured, providerError } = require('../src/services/aiService');

const main = async () => {
  const ai = getGenAI();
  const configured = process.env.GEMINI_MODEL;
  if (configured && (!/^gemini-[\w.-]+$/.test(configured) || /preview|latest|experimental/.test(configured))) {
    throw new Error('GEMINI_MODEL must be an exact stable model ID');
  }
  const listed = await ai.models.list({ config: { pageSize: 1000 } });
  const available = [];
  for await (const model of listed) {
    if (model.name && model.supportedActions?.includes('generateContent')) available.push(model.name.replace(/^models\//, ''));
  }
  // Ordered stable, non-Lite Flash models verified against Google's model documentation.
  const candidates = configured ? [configured] : ['gemini-3.5-flash', 'gemini-2.5-flash'];
  const model = candidates.find((candidate) => available.includes(candidate));
  if (!model) throw new Error('No configured/documented stable Flash model with generateContent is available');
  process.env.GEMINI_MODEL = model;
  console.log(JSON.stringify({ node: process.version, sdk: '2.29.0', model, listing: 'passed' }));
  const response = await ai.models.generateContent({ model, contents: 'Reply with exactly LMS_OK.', config: { maxOutputTokens: 128 } });
  if (response.promptFeedback?.blockReason || response.text?.trim() !== 'LMS_OK') throw new Error('Text smoke check failed');
  console.log('Text generation: passed');
  const svg = '<svg width="1000" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="1000" height="600" fill="white"/><rect x="30" y="30" width="940" height="540" fill="#eeeeee" stroke="black"/><text x="90" y="210" font-family="sans-serif" font-size="70">SYNTHETIC TEST BOOK</text><text x="90" y="330" font-family="sans-serif" font-size="50">Alex Example</text><text x="90" y="440" font-family="sans-serif" font-size="34">ISBN 9780306406157</text></svg>';
  const image = await sharp(Buffer.from(svg)).png().toBuffer();
  const book = await generateStructured(image, 'image/png', 'book');
  if (!/synthetic test book/i.test(book.title || '') || !book.authors.some((a) => /alex example/i.test(a))) throw new Error('Book image recognition smoke check failed');
  console.log('Book image + validated JSON: passed');
  const shelf = await generateStructured(image, 'image/png', 'shelf');
  if (!shelf.some((b) => /synthetic test book/i.test(b.title))) throw new Error('Shelf image recognition smoke check failed');
  console.log('Shelf image + validated JSON: passed');
  if (process.argv.includes('--persist-model')) {
    const existing = fs.existsSync(localPath) ? fs.readFileSync(localPath, 'utf8') : '';
    const content = /^GEMINI_MODEL=/m.test(existing)
      ? existing.replace(/^GEMINI_MODEL=.*$/m, `GEMINI_MODEL=${model}`)
      : `${existing.trimEnd()}\nGEMINI_MODEL=${model}\n`;
    fs.writeFileSync(localPath, content, { mode: 0o600 });
    console.log('Verified model persisted in ignored local Docker configuration');
  }
};

main().catch((error) => {
  const safe = error.name === 'ApiError' || error.status || /fetch|timeout|abort/i.test(error.message)
    ? providerError(error).message : error.message;
  console.error(`AI check failed: ${safe}`);
  process.exitCode = 1;
});
