'use strict';
const { db, tx, sentinelUserId } = require('../db');
const { HttpError } = require('../http');
const {
  hashPassword, verifyPassword, createSession, setSessionCookie, clearSessionCookie, sessionToken,
  publicUser, requireAuth, limit,
} = require('../auth');
const { createLimiter, sha256, MIN } = require('../util');
const { STATES, GRADES } = require('../subjects');
const config = require('../config');

const authLimiter = createLimiter(20, 15 * MIN);
const byIp = limit(authLimiter, (req) => req.ip, 'Too many attempts. Please wait a few minutes and try again.');

const RESERVED = new Set(['admin', 'administrator', 'moderator', 'support', 'system', 'deleted_user', 'studysprint', 'root']);

function validateProfile(state, grade) {
  if (state && !STATES.includes(state)) throw new HttpError(400, 'Choose your state from the list');
  if (grade && !GRADES.includes(grade)) throw new HttpError(400, 'Choose your class or level from the list');
}

function register(router) {
  router.post('/api/auth/register', byIp, async (req, res) => {
    const username = String(req.body.username ?? '').trim();
    const password = String(req.body.password ?? '');
    const state = String(req.body.state ?? '');
    const grade = String(req.body.grade ?? '');
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new HttpError(400, 'Username must be 3 to 20 letters, numbers or underscores');
    if (RESERVED.has(username.toLowerCase()) && !config.ADMIN_USERS.includes(username.toLowerCase())) throw new HttpError(400, 'That username is reserved');
    if (password.length < 8 || password.length > 72) throw new HttpError(400, 'Password must be 8 to 72 characters');
    if (password.toLowerCase() === username.toLowerCase()) throw new HttpError(400, 'Password must be different from your username');
    validateProfile(state, grade);

    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new HttpError(409, 'That username is taken. Try another one.');
    const hash = await hashPassword(password);
    let id;
    try {
      id = Number(db.prepare('INSERT INTO users(username, pass_hash, state, grade, created_at) VALUES(?,?,?,?,?)').run(username, hash, state, grade, Date.now()).lastInsertRowid);
    } catch (err) {
      if (/UNIQUE/i.test(err.message)) throw new HttpError(409, 'That username is taken. Try another one.');
      throw err;
    }
    setSessionCookie(res, createSession(id));
    res.json({ user: publicUser({ id, username, state, grade, isAdmin: config.ADMIN_USERS.includes(username.toLowerCase()) }) }, 201);
  });

  router.post('/api/auth/login', byIp, async (req, res) => {
    const username = String(req.body.username ?? '').trim();
    const password = String(req.body.password ?? '');
    const row = db.prepare('SELECT id, username, state, grade, pass_hash, banned FROM users WHERE username = ?').get(username);
    // Always run a hash comparison so response time does not reveal whether the username exists.
    const ok = await verifyPassword(password, row ? row.pass_hash : 's1$00$00');
    if (!row || !ok || row.banned) throw new HttpError(401, 'Username or password is incorrect');
    setSessionCookie(res, createSession(row.id));
    res.json({ user: publicUser({ ...row, isAdmin: config.ADMIN_USERS.includes(row.username.toLowerCase()) }) });
  });

  router.post('/api/auth/logout', (req, res) => {
    const token = sessionToken(req);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get('/api/auth/me', (req, res) => {
    res.json({ user: req.user ? publicUser(req.user) : null });
  });

  router.patch('/api/auth/profile', requireAuth, (req, res) => {
    const state = String(req.body.state ?? req.user.state);
    const grade = String(req.body.grade ?? req.user.grade);
    validateProfile(state, grade);
    db.prepare('UPDATE users SET state = ?, grade = ? WHERE id = ?').run(state, grade, req.user.id);
    res.json({ user: publicUser({ ...req.user, state, grade }) });
  });

  router.post('/api/auth/password', requireAuth, byIp, async (req, res) => {
    const current = String(req.body.current ?? '');
    const next = String(req.body.next ?? '');
    if (next.length < 8 || next.length > 72) throw new HttpError(400, 'New password must be 8 to 72 characters');
    const row = db.prepare('SELECT pass_hash FROM users WHERE id = ?').get(req.user.id);
    if (!(await verifyPassword(current, row.pass_hash))) throw new HttpError(403, 'Current password is incorrect');
    const hash = await hashPassword(next);
    const keep = sha256(sessionToken(req) || '');
    tx(() => {
      db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hash, req.user.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(req.user.id, keep); // sign out other devices
    });
    res.json({ ok: true });
  });

  // Account deletion: personal data is removed; forum posts and chat messages stay but lose their author.
  router.delete('/api/auth/account', requireAuth, byIp, async (req, res) => {
    const row = db.prepare('SELECT pass_hash FROM users WHERE id = ?').get(req.user.id);
    if (!(await verifyPassword(String(req.body.password ?? ''), row.pass_hash))) throw new HttpError(403, 'Password is incorrect');
    const ghost = sentinelUserId();
    const id = req.user.id;
    tx(() => {
      db.prepare('UPDATE doubts SET user_id = ? WHERE user_id = ?').run(ghost, id);
      db.prepare('UPDATE doubt_answers SET user_id = ? WHERE user_id = ?').run(ghost, id);
      db.prepare('UPDATE chat_messages SET user_id = ? WHERE user_id = ?').run(ghost, id);
      for (const t of ['votes', 'reports', 'answers', 'attempts', 'focus_sessions', 'sessions']) {
        db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(id);
      }
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    });
    clearSessionCookie(res);
    res.json({ ok: true });
  });
}

module.exports = { register };
