'use strict';
// Focus (Pomodoro) sessions and per-student statistics.
const { db } = require('../db');
const { HttpError } = require('../http');
const { requireAuth, limit } = require('../auth');
const { SUBJECT_IDS } = require('../subjects');
const { createLimiter, istDayStart, istDayNumber, HOUR, DAY, MIN } = require('../util');

const startLimiter = createLimiter(30, HOUR);
const MAX_DAILY_MINUTES = 960; // 16 hours of credited focus per day is plenty
const MIN_COMPLETION = 0.95; // a session only counts once ~all of its time has really passed on the server clock

function streakFor(userId, now) {
  const rows = db
    .prepare(
      `SELECT d FROM (
         SELECT (created_at + 19800000) / 86400000 AS d FROM answers WHERE user_id = ?
         UNION
         SELECT (completed_at + 19800000) / 86400000 AS d FROM focus_sessions WHERE user_id = ? AND completed_at IS NOT NULL
       )`,
    )
    .all(userId, userId);
  const days = new Set(rows.map((r) => r.d));
  const today = istDayNumber(now);
  let cursor = days.has(today) ? today : today - 1;
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor--;
  }
  return streak;
}

function register(router) {
  router.post(
    '/api/focus/start',
    requireAuth,
    limit(startLimiter, (req) => req.user.id),
    (req, res) => {
      const minutes = req.body.minutes;
      const subject = String(req.body.subject ?? 'general');
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) throw new HttpError(400, 'Focus time must be between 5 and 120 minutes');
      if (subject !== 'general' && !SUBJECT_IDS.includes(subject)) throw new HttpError(400, 'Unknown subject');
      const r = db.prepare('INSERT INTO focus_sessions(user_id, subject, planned_min, started_at) VALUES(?,?,?,?)').run(req.user.id, subject, minutes, Date.now());
      res.json({ id: Number(r.lastInsertRowid) }, 201);
    },
  );

  router.post('/api/focus/:id/complete', requireAuth, (req, res) => {
    const row = db.prepare('SELECT * FROM focus_sessions WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
    if (!row) throw new HttpError(404, 'Focus session not found');
    if (row.completed_at) throw new HttpError(409, 'This session was already recorded');
    const now = Date.now();
    const elapsed = now - row.started_at;
    if (elapsed < row.planned_min * MIN * MIN_COMPLETION) throw new HttpError(400, 'This session is not finished yet');
    if (elapsed > 12 * HOUR) throw new HttpError(400, 'This session expired. Start a new one.');

    const doneToday = db
      .prepare('SELECT COALESCE(SUM(credited_min), 0) AS m FROM focus_sessions WHERE user_id = ? AND completed_at >= ?')
      .get(req.user.id, istDayStart(now)).m;
    const credited = Math.max(0, Math.min(row.planned_min, MAX_DAILY_MINUTES - doneToday));
    db.prepare('UPDATE focus_sessions SET completed_at = ?, credited_min = ? WHERE id = ? AND completed_at IS NULL').run(now, credited, row.id);
    res.json({ credited, today: doneToday + credited });
  });

  router.get('/api/me/stats', requireAuth, (req, res) => {
    const uid = req.user.id;
    const now = Date.now();
    const today0 = istDayStart(now);

    const focusTotal = db.prepare('SELECT COALESCE(SUM(credited_min), 0) AS m FROM focus_sessions WHERE user_id = ?').get(uid).m;
    const focusToday = db.prepare('SELECT COALESCE(SUM(credited_min), 0) AS m FROM focus_sessions WHERE user_id = ? AND completed_at >= ?').get(uid, today0).m;

    const byDay = new Map(
      db
        .prepare(
          `SELECT (completed_at + 19800000) / 86400000 AS d, SUM(credited_min) AS m
           FROM focus_sessions WHERE user_id = ? AND completed_at >= ? GROUP BY d`,
        )
        .all(uid, today0 - 6 * DAY)
        .map((r) => [r.d, r.m]),
    );
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const start = today0 - i * DAY;
      week.push({ date: start, minutes: byDay.get(istDayNumber(start)) || 0 });
    }

    const pointsTotal = db.prepare('SELECT COALESCE(SUM(points), 0) AS p FROM answers WHERE user_id = ?').get(uid).p;
    const points7 = db.prepare('SELECT COALESCE(SUM(points), 0) AS p FROM answers WHERE user_id = ? AND created_at >= ?').get(uid, now - 7 * DAY).p;
    const higher = points7
      ? db
          .prepare(
            `SELECT COUNT(*) AS n FROM (
               SELECT user_id FROM answers WHERE created_at >= ? GROUP BY user_id HAVING SUM(points) > ?
             )`,
          )
          .get(now - 7 * DAY, points7).n
      : null;

    const subjects = db
      .prepare('SELECT subject, COUNT(*) AS answered, SUM(correct) AS correct FROM answers WHERE user_id = ? GROUP BY subject ORDER BY answered DESC')
      .all(uid);

    const helper = db
      .prepare('SELECT COALESCE(SUM(accepted), 0) AS accepted, COUNT(*) AS answers FROM doubt_answers WHERE user_id = ? AND hidden = 0')
      .get(uid);

    res.json({
      focusToday, focusTotal, week,
      streak: streakFor(uid, now),
      points: { total: pointsTotal, last7: points7, weekRank: higher === null ? null : higher + 1 },
      subjects,
      helper,
      joinedAt: db.prepare('SELECT created_at FROM users WHERE id = ?').get(uid).created_at,
    });
  });
}

module.exports = { register };
