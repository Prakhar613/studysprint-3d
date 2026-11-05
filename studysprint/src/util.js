'use strict';
const crypto = require('node:crypto');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const IST_OFFSET = 330 * MIN; // India has no daylight saving time

/** Start of the IST calendar day containing `ms`, as a UTC timestamp. */
const istDayStart = (ms) => Math.floor((ms + IST_OFFSET) / DAY) * DAY - IST_OFFSET;
/** Integer day number in IST (used to group activity by day). */
const istDayNumber = (ms) => Math.floor((ms + IST_OFFSET) / DAY);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rnd() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedFrom = (str) => crypto.createHash('sha256').update(String(str)).digest().readUInt32LE(0);

function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Escape LIKE wildcards so user search text is matched literally. */
const likeEscape = (s) => String(s).replace(/[\\%_]/g, (c) => '\\' + c);

/**
 * Remove control characters, trim, and hide phone numbers / e-mail addresses.
 * Students may be minors, so personal contact details never reach other users.
 */
function cleanText(input, max) {
  let s = String(input ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email hidden]');
  s = s.replace(/\+?\d(?:[\s().-]?\d){9,}/g, '[number hidden]');
  return s.length > max ? s.slice(0, max) : s;
}

/** Fixed-window in-memory limiter. Returns true when the call is allowed. */
function createLimiter(max, windowMs) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, arr] of hits) {
      const fresh = arr.filter((t) => now - t < windowMs);
      if (fresh.length) hits.set(k, fresh);
      else hits.delete(k);
    }
  }, Math.max(windowMs, 30000));
  timer.unref();
  return function take(key) {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      hits.set(key, arr);
      return false;
    }
    arr.push(now);
    hits.set(key, arr);
    return true;
  };
}

module.exports = {
  MIN, HOUR, DAY, WEEK, IST_OFFSET,
  istDayStart, istDayNumber, mulberry32, seedFrom, shuffle, sha256, clamp, likeEscape, cleanText, createLimiter,
};
