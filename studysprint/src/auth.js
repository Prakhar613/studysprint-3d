'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const config = require('./config');
const { db } = require('./db');
const { sha256, DAY } = require('./util');
const { HttpError } = require('./http');

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'ss_session';

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `s1$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [v, saltHex, keyHex] = String(stored).split('$');
  if (v !== 's1' || !saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(keyHex, 'hex');
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO sessions(token_hash, user_id, created_at, expires_at) VALUES(?,?,?,?)').run(
    sha256(token), userId, now, now + config.SESSION_DAYS * DAY,
  );
  return token;
}

function setSessionCookie(res, token) {
  const parts = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${config.SESSION_DAYS * 86400}`];
  if (config.COOKIE_SECURE) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const parts = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (config.COOKIE_SECURE) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function sessionToken(req) {
  return parseCookies(req.headers.cookie)[COOKIE] || null;
}

function userFromRequest(req) {
  const token = sessionToken(req);
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.state, u.grade FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.banned = 0`,
    )
    .get(sha256(token), Date.now());
  if (!row) return null;
  return { ...row, isAdmin: config.ADMIN_USERS.includes(row.username.toLowerCase()) };
}

const publicUser = (u) => ({ id: u.id, username: u.username, state: u.state, grade: u.grade, isAdmin: !!u.isAdmin });

function requireAuth(req) {
  if (!req.user) throw new HttpError(401, 'Please log in to continue');
}

function requireAdmin(req) {
  requireAuth(req);
  if (!req.user.isAdmin) throw new HttpError(403, 'Admins only');
}

/** Returns a handler that rejects with 429 when `key(req)` exceeds the limiter. */
function limit(take, keyFn, message = 'Too many requests. Please wait a moment and try again.') {
  return (req) => {
    if (!take(keyFn(req))) throw new HttpError(429, message);
  };
}

function cleanupSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

module.exports = {
  hashPassword, verifyPassword, createSession, setSessionCookie, clearSessionCookie, sessionToken,
  userFromRequest, publicUser, requireAuth, requireAdmin, limit, cleanupSessions,
};
