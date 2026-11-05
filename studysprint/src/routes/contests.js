'use strict';
const { db } = require('../db');
const { HttpError } = require('../http');
const { requireAuth, limit } = require('../auth');
const S = require('../subjects');
const bank = require('../questionBank');
const engine = require('../quizEngine');
const hub = require('../hub');
const { createLimiter, MIN, WEEK } = require('../util');

const joinLimiter = createLimiter(10, 10 * MIN);

function describe(slot, start, now, userId) {
  const id = S.contestId(slot.subject, start);
  const participants = db.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM answers WHERE contest_id = ?').get(id).n;
  const joined = db.prepare('SELECT COUNT(*) AS n FROM attempts WHERE contest_id = ?').get(id).n;
  let mine = null;
  if (userId) {
    const a = db.prepare('SELECT id, finished_at FROM attempts WHERE user_id = ? AND contest_id = ?').get(userId, id);
    if (a) mine = { attemptId: a.id, finished: !!a.finished_at };
  }
  return {
    id,
    subject: slot.subject,
    start,
    closesAt: start + S.JOIN_WINDOW_MS,
    status: S.contestStatus(start, now),
    questions: S.CONTEST_QUESTIONS,
    secondsPer: S.CONTEST_SECONDS,
    participants: Math.max(participants, joined),
    waiting: hub.count(`lobby:${id}`),
    mine,
  };
}

function leaderboard(contestId, limitRows = 50) {
  return db
    .prepare(
      `SELECT u.id AS userId, u.username, u.state,
              SUM(an.points) AS points, SUM(an.correct) AS correct, SUM(an.ms) AS ms, COUNT(*) AS answered,
              MAX(at.finished_at IS NOT NULL) AS finished
       FROM answers an
       JOIN users u ON u.id = an.user_id
       JOIN attempts at ON at.id = an.attempt_id
       WHERE an.contest_id = ?
       GROUP BY an.user_id
       ORDER BY points DESC, ms ASC, an.user_id ASC
       LIMIT ?`,
    )
    .all(contestId, limitRows)
    .map((r, i) => ({ rank: i + 1, ...r, finished: !!r.finished }));
}

function register(router) {
  router.get('/api/contests', (req, res) => {
    const now = Date.now();
    const userId = req.user?.id;
    const upcoming = S.SCHEDULE.map((slot) => describe(slot, S.currentContest(slot, now).start, now, userId)).sort((a, b) => a.start - b.start);

    // Last week's contests that have results
    const recent = S.SCHEDULE
      .map((slot) => describe(slot, S.currentContest(slot, now).previousStart, now, userId))
      .filter((c) => c.participants > 0)
      .sort((a, b) => b.start - a.start);
    res.json({ now, contests: upcoming, recent });
  });

  router.get('/api/contests/:id', (req, res) => {
    const c = S.parseContestId(req.params.id);
    if (!c) throw new HttpError(404, 'Contest not found');
    const now = Date.now();
    const info = describe(c.slot, c.start, now, req.user?.id);
    const rows = leaderboard(c.id);
    const me = req.user ? rows.find((r) => r.userId === req.user.id) || null : null;
    res.json({ now, contest: info, leaderboard: rows.map(({ userId, ...r }) => ({ ...r, isMe: !!req.user && userId === req.user.id })), me: me ? { rank: me.rank, points: me.points } : null });
  });

  router.post(
    '/api/contests/:id/join',
    requireAuth,
    limit(joinLimiter, (req) => req.user.id),
    (req, res) => {
      const c = S.parseContestId(req.params.id);
      if (!c) throw new HttpError(404, 'Contest not found');
      const now = Date.now();
      const existing = db.prepare('SELECT id FROM attempts WHERE user_id = ? AND contest_id = ?').get(req.user.id, c.id);
      if (existing) return res.json({ attemptId: existing.id, state: engine.getState(existing.id, req.user.id), resumed: true });

      const status = S.contestStatus(c.start, now);
      if (status === 'upcoming') throw new HttpError(409, 'This contest has not started yet');
      if (status === 'ended') throw new HttpError(409, 'The joining window for this contest has closed');

      const ids = bank.contestQuestions(c.subject, c.id, S.CONTEST_QUESTIONS);
      if (ids.length < S.CONTEST_QUESTIONS) throw new HttpError(503, 'This contest does not have enough questions yet');
      let id;
      try {
        id = engine.createAttempt({ userId: req.user.id, subject: c.subject, mode: 'contest', contestId: c.id, secondsPer: S.CONTEST_SECONDS, questionIds: ids });
      } catch (err) {
        if (/UNIQUE/i.test(err.message)) throw new HttpError(409, 'You have already joined this contest');
        throw err;
      }
      hub.publish(`contest:${c.id}`, 'update', { at: now });
      res.json({ attemptId: id, state: engine.getState(id, req.user.id) }, 201);
    },
  );
}

module.exports = { register, leaderboard };
