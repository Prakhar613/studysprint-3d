'use strict';
// Usage: npm run import-questions -- path/to/questions.json
// File format: [{ "subject": "physics", "text": "...", "options": ["a","b","c","d"], "correctIndex": 1,
//                 "explanation": "...", "difficulty": "easy|medium|hard" }, ...]
const fs = require('node:fs');
const bank = require('../src/questionBank');

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run import-questions -- <questions.json>');
  process.exit(1);
}
const items = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(items)) {
  console.error('The file must contain a JSON array of questions.');
  process.exit(1);
}
let added = 0;
let skipped = 0;
let invalid = 0;
items.forEach((q, i) => {
  try {
    if (bank.addQuestion({ ...q, source: q.source || 'import' })) added++;
    else skipped++;
  } catch (err) {
    invalid++;
    console.error(`Question #${i + 1}: ${err.message}`);
  }
});
console.log(`Imported ${added}, skipped ${skipped} duplicates, ${invalid} invalid.`);
