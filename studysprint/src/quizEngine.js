'use strict';
// Server-side quiz engine. The server owns the clock and the answer key:
// the browser only ever receives the current question, and every answer is timed on the server.
const { db, tx } = require('./db');
const { shuffle } = require('./util');
const { HttpError } = require('./http');
const { parseContestId, contestStatus } = require('./subjects');

const BASE_POINTS = 100;
const SPEED_BONUS = 50; // extra points for answering faster
const GRACE_MS = 2500; // network allowance on top of the time limit
const GAP_MS = { practice: 8000, contest: 3000 }; // pause between questions (time to read feedback)

function createAttempt({ userId, subject, mode, contestId = null, secondsPer, questionIds }) {
  const getOptions = db.prepare('SELECT options FROM questions WHERE id = ?');
  const plan = shuffle(questionIds).map((q) => {
    const n = JSON.parse(getOptions.get(q).options).length;
    return { q, perm: shuffle([...Array(n).keys()]) };
  });
  const now = Date.now();
  const r = db
    .prepare(
      `INSERT INTO attempts(user_id, subject, mode, contest_id, seconds_per, plan, idx, q_started_at, started_at)
       VALUES(?,?,?,?,?,?,0,?,?)`,
    )
    .run(userId, subject, mode, contestId, secondsPer, JSON.stringify(plan), now, now);
  return Number(r.lastInsertRowid);
}

function loadAttempt(id, userId) {
  const row = db.prepare('SELECT * FROM attempts WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) throw new HttpError(404, 'Quiz not found');
  row.plan = JSON.parse(row.plan);
  return row;
}

const scoreOf = (attemptId) =>
  db.prepare('SELECT COALESCE(SUM(points), 0) AS s FROM answers WHERE attempt_id = ?').get(attemptId).s;

function baseState(a) {
  return {
    attemptId: a.id,
    mode: a.mode,
    subject: a.subject,
    contestId: a.contest_id,
    index: a.idx,
    total: a.plan.length,
    seconds: a.seconds_per,
    score: scoreOf(a.id),
  };
}

function summarize(a) {
  const rows = db
    .prepare(
      `SELECT an.correct, an.timed_out, an.points, an.ms, q.text, q.options, q.correct_index, q.explanation, q.source
       FROM answers an JOIN questions q ON q.id = an.question_id
       WHERE an.attempt_id = ? ORDER BY an.id`,
    )
    .all(a.id);
  const total = rows.length;
  const correct = rows.reduce((s, r) => s + r.correct, 0);
  const points = rows.reduce((s, r) => s + r.points, 0);
  const ms = rows.reduce((s, r) => s + r.ms, 0);
  let reveal = a.mode === 'practice';
  if (a.mode === 'contest') {
    const c = parseContestId(a.contest_id);
    reveal = !!c && contestStatus(c.start) === 'ended'; // answers stay hidden while others can still join
  }
  return {
    attemptId: a.id,
    mode: a.mode,
    subject: a.subject,
    contestId: a.contest_id,
    total,
    correct,
    points,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    avgSeconds: total ? Math.round(ms / total / 100) / 10 : 0,
    reviewLocked: !reveal,
    review: reveal
      ? rows
          .filter((r) => !r.correct)
          .map((r) => ({
            text: r.text,
            correctAnswer: JSON.parse(r.options)[r.correct_index],
            explanation: r.explanation,
            timedOut: !!r.timed_out,
          }))
      : [],
  };
}

/** Current state of an attempt. Expired questions are marked as timed out here. */
function getState(attemptId, userId) {
  let a = loadAttempt(attemptId, userId);
  if (a.finished_at) return { status: 'done', summary: summarize(a) };
  const now = Date.now();
  const limit = a.seconds_per * 1000;

  if (now < a.q_started_at) return { status: 'wait', waitMs: a.q_started_at - now, ...baseState(a) };

  if (now - a.q_started_at > limit + GRACE_MS) {
    record(a, null, now);
    a = loadAttempt(attemptId, userId);
    return getState(attemptId, userId);
  }

  const entry = a.plan[a.idx];
  const q = db.prepare('SELECT id, text, options, source, difficulty FROM questions WHERE id = ?').get(entry.q);
  const opts = JSON.parse(q.options);
  return {
    status: 'question',
    ...baseState(a),
    remainingMs: Math.max(0, limit - (now - a.q_started_at)),
    question: {
      id: q.id,
      text: q.text,
      options: entry.perm.map((k) => opts[k]),
      source: q.source,
      difficulty: q.difficulty,
    },
  };
}

function record(a, choice, now) {
  const entry = a.plan[a.idx];
  const q = db.prepare('SELECT correct_index, explanation FROM questions WHERE id = ?').get(entry.q);
  const limit = a.seconds_per * 1000;
  const elapsed = Math.max(0, now - a.q_started_at);
  const timedOut = choice === null || elapsed > limit + GRACE_MS;
  let correct = 0;
  let points = 0;
  if (!timedOut && entry.perm[choice] === q.correct_index) {
    correct = 1;
    points = BASE_POINTS + Math.round((SPEED_BONUS * Math.max(0, limit - elapsed)) / limit);
  }
  const isLast = a.idx + 1 >= a.plan.length;

  tx(() => {
    // The WHERE clause makes a double-submit of the same question fail instead of counting twice.
    const upd = isLast
      ? db.prepare('UPDATE attempts SET idx = idx + 1, finished_at = ? WHERE id = ? AND idx = ? AND finished_at IS NULL').run(now, a.id, a.idx)
      : db.prepare('UPDATE attempts SET idx = idx + 1, q_started_at = ? WHERE id = ? AND idx = ? AND finished_at IS NULL').run(now + GAP_MS[a.mode], a.id, a.idx);
    if (upd.changes !== 1) throw new HttpError(409, 'That question was already answered');
    db.prepare(
      `INSERT INTO answers(attempt_id, user_id, subject, mode, contest_id, question_id, correct, timed_out, points, ms, created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(a.id, a.user_id, a.subject, a.mode, a.contest_id, entry.q, correct, timedOut ? 1 : 0, points, Math.min(elapsed, limit), now);
  });

  const hideKey = a.mode === 'contest';
  return {
    correct: !!correct,
    timedOut,
    points,
    correctIndex: hideKey ? null : entry.perm.indexOf(q.correct_index),
    explanation: hideKey ? '' : q.explanation,
    gapMs: isLast ? 0 : GAP_MS[a.mode],
    done: isLast,
  };
}

function submitAnswer(attemptId, userId, body) {
  const a = loadAttempt(attemptId, userId);
  if (a.finished_at) throw new HttpError(409, 'This quiz is already finished');
  const index = body.index;
  const choice = body.choice === undefined || body.choice === null ? null : body.choice;
  if (!Number.isInteger(index) || index !== a.idx) throw new HttpError(409, 'That question is no longer active');
  const now = Date.now();
  if (now < a.q_started_at) throw new HttpError(409, 'The next question has not started yet');
  if (choice !== null) {
    const n = a.plan[a.idx].perm.length;
    if (!Number.isInteger(choice) || choice < 0 || choice >= n) throw new HttpError(400, 'Choose one of the listed options');
  }
  const result = record(a, choice, now);
  const fresh = loadAttempt(attemptId, userId);
  return {
    result,
    score: scoreOf(a.id),
    summary: result.done ? summarize(fresh) : null,
  };
}

module.exports = { createAttempt, getState, submitAnswer, summarize, GAP_MS };
