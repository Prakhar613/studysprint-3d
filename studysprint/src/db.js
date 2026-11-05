'use strict';
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

const db = new DatabaseSync(config.DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  PRAGMA synchronous = NORMAL;
`);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '',
  grade TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  banned INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  text TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  source TEXT NOT NULL DEFAULT 'local',
  hash TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject, active);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  mode TEXT NOT NULL,
  contest_id TEXT,
  seconds_per INTEGER NOT NULL,
  plan TEXT NOT NULL,
  idx INTEGER NOT NULL DEFAULT 0,
  q_started_at INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attempt_contest ON attempts(user_id, contest_id) WHERE contest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attempt_user ON attempts(user_id, started_at);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  mode TEXT NOT NULL,
  contest_id TEXT,
  question_id INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  timed_out INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL,
  ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_answers_user ON answers(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_answers_contest ON answers(contest_id);
CREATE INDEX IF NOT EXISTS idx_answers_time ON answers(created_at);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  planned_min INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  credited_min INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_focus_user ON focus_sessions(user_id, completed_at);

CREATE TABLE IF NOT EXISTS doubts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  solved INTEGER NOT NULL DEFAULT 0,
  votes INTEGER NOT NULL DEFAULT 0,
  answers_count INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_doubts_list ON doubts(hidden, id);

CREATE TABLE IF NOT EXISTS doubt_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doubt_id INTEGER NOT NULL REFERENCES doubts(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  votes INTEGER NOT NULL DEFAULT 0,
  accepted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_answers_doubt ON doubt_answers(doubt_id);

CREATE TABLE IF NOT EXISTS votes (
  user_id INTEGER NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room, id);

CREATE TABLE IF NOT EXISTS reports (
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (target_type, target_id, user_id)
);
`);

/** Run `fn` inside an immediate transaction; rolls back if it throws. */
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
    throw err;
  }
}

const getMeta = (key) => db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value ?? null;
const setMeta = (key, value) =>
  db.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));

/** Placeholder owner for content whose author deleted their account. */
function sentinelUserId() {
  const row = db.prepare("SELECT id FROM users WHERE username = 'deleted_user'").get();
  if (row) return row.id;
  const r = db
    .prepare("INSERT INTO users(username, pass_hash, created_at, banned) VALUES('deleted_user', '!', ?, 1)")
    .run(Date.now());
  return Number(r.lastInsertRowid);
}

module.exports = { db, tx, getMeta, setMeta, sentinelUserId };
