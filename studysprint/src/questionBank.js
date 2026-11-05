'use strict';
const crypto = require('node:crypto');
const { db, getMeta, setMeta } = require('./db');
const config = require('./config');
const { shuffle, mulberry32, seedFrom, HOUR } = require('./util');
const { SUBJECT_IDS } = require('./subjects');
const SEED = require('./seedQuestions');

const hashOf = (subject, text) =>
  crypto.createHash('sha1').update(`${subject}|${String(text).trim().toLowerCase()}`).digest('hex');

/** Validates and inserts one question. Returns true if it was new. */
function addQuestion(q) {
  const { subject, text, options, correctIndex } = q;
  if (!SUBJECT_IDS.includes(subject)) throw new Error(`Unknown subject: ${subject}`);
  if (typeof text !== 'string' || text.trim().length < 5) throw new Error('Question text is too short');
  if (!Array.isArray(options) || options.length < 2 || options.length > 6 || options.some((o) => typeof o !== 'string' || !o.trim())) {
    throw new Error('Each question needs 2 to 6 non-empty options');
  }
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) throw new Error('correctIndex is out of range');
  const r = db
    .prepare(
      `INSERT OR IGNORE INTO questions(subject, text, options, correct_index, explanation, difficulty, source, hash)
       VALUES(?,?,?,?,?,?,?,?)`,
    )
    .run(subject, text.trim(), JSON.stringify(options.map((o) => o.trim())), correctIndex, q.explanation || '', q.difficulty || 'medium', q.source || 'local', hashOf(subject, text));
  return r.changes === 1;
}

function seedLocal() {
  let added = 0;
  for (const [subject, text, options, correctIndex, explanation, difficulty] of SEED) {
    if (addQuestion({ subject, text, options, correctIndex, explanation, difficulty, source: 'local' })) added++;
  }
  return added;
}

function counts() {
  const rows = db.prepare('SELECT subject, COUNT(*) AS n FROM questions WHERE active = 1 GROUP BY subject').all();
  return Object.fromEntries(rows.map((r) => [r.subject, r.n]));
}

/** Random questions for practice, preferring ones this student has answered least. */
function pickForPractice(subject, userId, n) {
  return db
    .prepare(
      `SELECT q.id FROM questions q
       WHERE q.subject = ? AND q.active = 1
       ORDER BY (SELECT COUNT(*) FROM answers a WHERE a.user_id = ? AND a.question_id = q.id) ASC, RANDOM()
       LIMIT ?`,
    )
    .all(subject, userId, n)
    .map((r) => r.id);
}

/** Every student in a contest gets the same questions. The set is fixed the first time anyone joins. */
function contestQuestions(subject, contestId, n) {
  const key = `contest:${contestId}`;
  let stored = getMeta(key);
  if (!stored) {
    const ids = db.prepare('SELECT id FROM questions WHERE subject = ? AND active = 1 ORDER BY id').all(subject).map((r) => r.id);
    const chosen = shuffle(ids, mulberry32(seedFrom(contestId))).slice(0, n);
    db.prepare('INSERT OR IGNORE INTO meta(key, value) VALUES(?, ?)').run(key, JSON.stringify(chosen));
    stored = getMeta(key);
  }
  return JSON.parse(stored);
}

// --------------------------------------------------------------- Open Trivia DB
// Free question API (https://opentdb.com), licensed CC BY-SA 4.0. Attribution is shown in the app footer.
const OPENTDB_CATEGORIES = { math: 19, cs: 18, history: 23, geography: 22 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return String(s); }
}

function mapOpenTdb(item, subject) {
  if (!item || item.type !== 'multiple' || !Array.isArray(item.incorrect_answers)) return null;
  const correct = safeDecode(item.correct_answer);
  const options = shuffle([correct, ...item.incorrect_answers.map(safeDecode)]);
  return {
    subject,
    text: safeDecode(item.question),
    options,
    correctIndex: options.indexOf(correct),
    explanation: `The correct answer is ${correct}.`,
    difficulty: item.difficulty || 'medium',
    source: 'opentdb',
  };
}

async function syncOpenTdb() {
  let added = 0;
  for (const [subject, category] of Object.entries(OPENTDB_CATEGORIES)) {
    try {
      const res = await fetch(`https://opentdb.com/api.php?amount=50&category=${category}&type=multiple&encode=url3986`, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'StudySprintIndia/1.0', Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.response_code === 0) {
        for (const item of data.results) {
          const q = mapOpenTdb(item, subject);
          if (q && addQuestion(q)) added++;
        }
      }
    } catch (err) {
      console.warn(`[questions] Open Trivia DB sync skipped for ${subject}: ${err.message}`);
    }
    await sleep(6000); // the API allows one request per 5 seconds per IP
  }
  setMeta('opentdb_last_sync', Date.now());
  if (added) console.log(`[questions] added ${added} questions from Open Trivia DB`);
  return added;
}

function startSync() {
  if (!config.SYNC_QUESTIONS) return;
  const EVERY = 12 * HOUR;
  const run = async () => {
    try { await syncOpenTdb(); } catch (err) { console.warn('[questions] sync failed:', err.message); }
    setTimeout(run, EVERY).unref();
  };
  const last = Number(getMeta('opentdb_last_sync') || 0);
  setTimeout(run, Math.max(5000, last + EVERY - Date.now())).unref();
}

module.exports = { addQuestion, seedLocal, counts, pickForPractice, contestQuestions, mapOpenTdb, syncOpenTdb, startSync };
