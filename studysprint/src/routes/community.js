'use strict';
// Leaderboards, the doubts forum (questions and answers between students), votes and reports.
const { db, tx } = require('../db');
const { HttpError } = require('../http');
const { requireAuth, requireAdmin, limit } = require('../auth');
const { SUBJECT_IDS, STATES } = require('../subjects');
const hub = require('../hub');
const { createLimiter, cleanText, likeEscape, istDayStart, HOUR, DAY, MIN } = require('../util');

// ------------------------------------------------------------------ leaderboards
const SCOPES = ['quiz', 'focus', 'helpers'];
const boardCache = new Map();
const BOARD_TTL = 10 * 1000;

function periodStart(period, now) {
  switch (period) {
    case 'today': return istDayStart(now);
    case 'week': return now - 7 * DAY;
    case 'month': return now - 30 * DAY;
    default: return 0;
  }
}

function queryBoard(scope, since, subject, state) {
  const args = [since];
  let sql;
  if (scope === 'quiz') {
    sql = `SELECT u.id, u.username, u.state, SUM(a.points) AS score, SUM(a.correct) AS correct, COUNT(*) AS answered
           FROM answers a JOIN users u ON u.id = a.user_id
           WHERE a.created_at >= ? AND u.banned = 0`;
    if (subject) { sql += ' AND a.subject = ?'; args.push(subject); }
  } else if (scope === 'focus') {
    sql = `SELECT u.id, u.username, u.state, SUM(f.credited_min) AS score, COUNT(*) AS sessions
           FROM focus_sessions f JOIN users u ON u.id = f.user_id
           WHERE f.completed_at >= ? AND f.credited_min > 0 AND u.banned = 0`;
    if (subject) { sql += ' AND f.subject = ?'; args.push(subject); }
  } else {
    sql = `SELECT u.id, u.username, u.state, SUM(da.accepted) * 20 + SUM(da.votes) AS score, SUM(da.accepted) AS accepted
           FROM doubt_answers da JOIN users u ON u.id = da.user_id JOIN doubts d ON d.id = da.doubt_id
           WHERE da.created_at >= ? AND da.hidden = 0 AND u.banned = 0`;
    if (subject) { sql += ' AND d.subject = ?'; args.push(subject); }
  }
  if (state) { sql += ' AND u.state = ?'; args.push(state); }
  sql += ' GROUP BY u.id HAVING score > 0 ORDER BY score DESC, u.id ASC LIMIT 5000';
  return db.prepare(sql).all(...args);
}

// ------------------------------------------------------------------ doubts
const postLimiter = createLimiter(8, HOUR);
const answerLimiter = createLimiter(30, HOUR);
const voteLimiter = createLimiter(60, 10 * MIN);
const reportLimiter = createLimiter(20, HOUR);
const REPORTS_TO_HIDE = 3;

const author = (row) => ({ username: row.username, state: row.state });
const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'Not found');
  return id;
};

function register(router) {
  router.get('/api/leaderboard', (req, res) => {
    const scope = SCOPES.includes(req.query.scope) ? req.query.scope : 'quiz';
    const period = ['today', 'week', 'month', 'all'].includes(req.query.period) ? req.query.period : 'week';
    const subject = SUBJECT_IDS.includes(req.query.subject) ? req.query.subject : '';
    const state = STATES.includes(req.query.state) ? req.query.state : '';
    const now = Date.now();

    const key = [scope, period, subject, state].join('|');
    let hit = boardCache.get(key);
    if (!hit || now - hit.at > BOARD_TTL) {
      hit = { at: now, rows: queryBoard(scope, periodStart(period, now), subject, state) };
      boardCache.set(key, hit);
      if (boardCache.size > 300) boardCache.delete(boardCache.keys().next().value);
    }
    const rows = hit.rows;
    const myIndex = req.user ? rows.findIndex((r) => r.id === req.user.id) : -1;
    res.json({
      scope, period, subject, state,
      updatedAt: hit.at,
      total: rows.length,
      rows: rows.slice(0, 50).map((r, i) => {
        const { id, ...rest } = r;
        return { rank: i + 1, ...rest, isMe: !!req.user && id === req.user.id };
      }),
      me: myIndex >= 0 ? { rank: myIndex + 1, score: rows[myIndex].score } : null,
    });
  });

  // ---- doubts list
  router.get('/api/doubts', (req, res) => {
    const subject = SUBJECT_IDS.includes(req.query.subject) ? req.query.subject : '';
    const q = String(req.query.q ?? '').trim().slice(0, 80);
    const unsolved = req.query.unsolved === '1';
    const page = Math.max(0, Math.min(500, Number.parseInt(req.query.page, 10) || 0));
    const args = [];
    let where = 'd.hidden = 0';
    if (subject) { where += ' AND d.subject = ?'; args.push(subject); }
    if (unsolved) where += ' AND d.solved = 0';
    if (q) {
      where += " AND (d.title LIKE ? ESCAPE '\\' OR d.body LIKE ? ESCAPE '\\')";
      args.push(`%${likeEscape(q)}%`, `%${likeEscape(q)}%`);
    }
    const rows = db
      .prepare(
        `SELECT d.id, d.subject, d.title, substr(d.body, 1, 180) AS preview, d.votes, d.answers_count, d.solved, d.created_at,
                u.username, u.state
         FROM doubts d JOIN users u ON u.id = d.user_id
         WHERE ${where} ORDER BY d.id DESC LIMIT 21 OFFSET ?`,
      )
      .all(...args, page * 20);
    res.json({
      page,
      hasMore: rows.length > 20,
      items: rows.slice(0, 20).map((r) => ({
        id: r.id, subject: r.subject, title: r.title, preview: r.preview, votes: r.votes,
        answers: r.answers_count, solved: !!r.solved, createdAt: r.created_at, author: author(r),
      })),
    });
  });

  router.post(
    '/api/doubts',
    requireAuth,
    limit(postLimiter, (req) => req.user.id, 'You can post up to 8 doubts per hour. Please try again later.'),
    (req, res) => {
      const subject = String(req.body.subject ?? '');
      const title = cleanText(req.body.title, 140);
      const body = cleanText(req.body.body, 3000);
      if (!SUBJECT_IDS.includes(subject)) throw new HttpError(400, 'Pick a subject');
      if (title.length < 8) throw new HttpError(400, 'Write a title of at least 8 characters');
      if (body.length < 10) throw new HttpError(400, 'Describe your doubt in at least 10 characters');
      const r = db.prepare('INSERT INTO doubts(user_id, subject, title, body, created_at) VALUES(?,?,?,?,?)').run(req.user.id, subject, title, body, Date.now());
      res.json({ id: Number(r.lastInsertRowid) }, 201);
    },
  );

  router.get('/api/doubts/:id', (req, res) => {
    const id = idParam(req);
    const d = db
      .prepare(
        `SELECT d.*, u.username, u.state FROM doubts d JOIN users u ON u.id = d.user_id WHERE d.id = ? AND d.hidden = 0`,
      )
      .get(id);
    if (!d) throw new HttpError(404, 'This doubt was not found. It may have been removed.');
    const answers = db
      .prepare(
        `SELECT a.*, u.username, u.state FROM doubt_answers a JOIN users u ON u.id = a.user_id
         WHERE a.doubt_id = ? AND a.hidden = 0 ORDER BY a.accepted DESC, a.votes DESC, a.id ASC`,
      )
      .all(id);
    const uid = req.user?.id;
    const voted = new Set();
    if (uid) {
      for (const v of db.prepare("SELECT target_type, target_id FROM votes WHERE user_id = ? AND target_type IN ('doubt','answer')").all(uid)) {
        voted.add(`${v.target_type}:${v.target_id}`);
      }
    }
    res.json({
      doubt: {
        id: d.id, subject: d.subject, title: d.title, body: d.body, votes: d.votes, solved: !!d.solved,
        createdAt: d.created_at, author: author(d), mine: uid === d.user_id, voted: voted.has(`doubt:${d.id}`),
      },
      answers: answers.map((a) => ({
        id: a.id, body: a.body, votes: a.votes, accepted: !!a.accepted, createdAt: a.created_at,
        author: author(a), mine: uid === a.user_id, voted: voted.has(`answer:${a.id}`),
      })),
    });
  });

  router.post(
    '/api/doubts/:id/answers',
    requireAuth,
    limit(answerLimiter, (req) => req.user.id, 'You are answering very fast. Please wait a little.'),
    (req, res) => {
      const id = idParam(req);
      const body = cleanText(req.body.body, 3000);
      if (body.length < 2) throw new HttpError(400, 'Write your answer first');
      const out = tx(() => {
        const d = db.prepare('SELECT id FROM doubts WHERE id = ? AND hidden = 0').get(id);
        if (!d) throw new HttpError(404, 'This doubt was not found');
        const r = db.prepare('INSERT INTO doubt_answers(doubt_id, user_id, body, created_at) VALUES(?,?,?,?)').run(id, req.user.id, body, Date.now());
        db.prepare('UPDATE doubts SET answers_count = answers_count + 1 WHERE id = ?').run(id);
        return Number(r.lastInsertRowid);
      });
      res.json({ id: out }, 201);
    },
  );

  router.post('/api/doubts/:id/accept', requireAuth, (req, res) => {
    const id = idParam(req);
    const answerId = Number(req.body.answerId);
    tx(() => {
      const d = db.prepare('SELECT user_id FROM doubts WHERE id = ? AND hidden = 0').get(id);
      if (!d) throw new HttpError(404, 'This doubt was not found');
      if (d.user_id !== req.user.id) throw new HttpError(403, 'Only the student who asked can mark an answer as accepted');
      const a = db.prepare('SELECT id FROM doubt_answers WHERE id = ? AND doubt_id = ? AND hidden = 0').get(answerId, id);
      if (!a) throw new HttpError(404, 'Answer not found');
      db.prepare('UPDATE doubt_answers SET accepted = 0 WHERE doubt_id = ?').run(id);
      db.prepare('UPDATE doubt_answers SET accepted = 1 WHERE id = ?').run(answerId);
      db.prepare('UPDATE doubts SET solved = 1 WHERE id = ?').run(id);
    });
    res.json({ ok: true });
  });

  // ---- votes (toggle)
  router.post(
    '/api/votes',
    requireAuth,
    limit(voteLimiter, (req) => req.user.id),
    (req, res) => {
      const type = String(req.body.type ?? '');
      const id = Number(req.body.id);
      if (!['doubt', 'answer'].includes(type) || !Number.isInteger(id)) throw new HttpError(400, 'Invalid vote');
      const table = type === 'doubt' ? 'doubts' : 'doubt_answers';
      const out = tx(() => {
        const row = db.prepare(`SELECT user_id, votes FROM ${table} WHERE id = ? AND hidden = 0`).get(id);
        if (!row) throw new HttpError(404, 'Not found');
        if (row.user_id === req.user.id) throw new HttpError(400, 'You cannot vote on your own post');
        const had = db.prepare('SELECT 1 FROM votes WHERE user_id = ? AND target_type = ? AND target_id = ?').get(req.user.id, type, id);
        if (had) {
          db.prepare('DELETE FROM votes WHERE user_id = ? AND target_type = ? AND target_id = ?').run(req.user.id, type, id);
          db.prepare(`UPDATE ${table} SET votes = votes - 1 WHERE id = ?`).run(id);
        } else {
          db.prepare('INSERT INTO votes(user_id, target_type, target_id) VALUES(?,?,?)').run(req.user.id, type, id);
          db.prepare(`UPDATE ${table} SET votes = votes + 1 WHERE id = ?`).run(id);
        }
        return { voted: !had, votes: row.votes + (had ? -1 : 1) };
      });
      res.json(out);
    },
  );

  // ---- reports: three different students reporting a post hides it until a moderator looks
  router.post(
    '/api/report',
    requireAuth,
    limit(reportLimiter, (req) => req.user.id),
    (req, res) => {
      const type = String(req.body.type ?? '');
      const id = Number(req.body.id);
      const tables = { doubt: 'doubts', answer: 'doubt_answers', chat: 'chat_messages' };
      if (!tables[type] || !Number.isInteger(id)) throw new HttpError(400, 'Invalid report');
      const row = db.prepare(`SELECT user_id${type === 'chat' ? ', room' : ''} FROM ${tables[type]} WHERE id = ? AND hidden = 0`).get(id);
      if (!row) throw new HttpError(404, 'That post is already gone');
      if (row.user_id === req.user.id) throw new HttpError(400, 'You cannot report your own post');
      db.prepare('INSERT OR IGNORE INTO reports(target_type, target_id, user_id, created_at) VALUES(?,?,?,?)').run(type, id, req.user.id, Date.now());
      const n = db.prepare('SELECT COUNT(*) AS n FROM reports WHERE target_type = ? AND target_id = ?').get(type, id).n;
      let hidden = false;
      if (n >= REPORTS_TO_HIDE) {
        db.prepare(`UPDATE ${tables[type]} SET hidden = 1 WHERE id = ?`).run(id);
        hidden = true;
        if (type === 'chat') hub.publish(`room:${row.room}`, 'removed', { id });
      }
      res.json({ ok: true, hidden });
    },
  );

  // ---- admin removal
  router.delete('/api/doubts/:id', requireAdmin, (req, res) => {
    db.prepare('UPDATE doubts SET hidden = 1 WHERE id = ?').run(idParam(req));
    res.json({ ok: true });
  });
  router.delete('/api/doubt-answers/:id', requireAdmin, (req, res) => {
    const id = idParam(req);
    const a = db.prepare('SELECT doubt_id, hidden FROM doubt_answers WHERE id = ?').get(id);
    if (a && !a.hidden) {
      tx(() => {
        db.prepare('UPDATE doubt_answers SET hidden = 1, accepted = 0 WHERE id = ?').run(id);
        db.prepare('UPDATE doubts SET answers_count = MAX(0, answers_count - 1) WHERE id = ?').run(a.doubt_id);
      });
    }
    res.json({ ok: true });
  });
}

module.exports = { register };
