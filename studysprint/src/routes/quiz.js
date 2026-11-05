'use strict';
const { db } = require('../db');
const { HttpError } = require('../http');
const { requireAuth, limit } = require('../auth');
const { SUBJECT_IDS } = require('../subjects');
const bank = require('../questionBank');
const engine = require('../quizEngine');
const hub = require('../hub');
const { createLimiter, istDayStart, MIN } = require('../util');

const startLimiter = createLimiter(12, 10 * MIN);
const answerLimiter = createLimiter(120, MIN);
const MAX_PRACTICE_PER_DAY = 30;

const attemptId = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'Quiz not found');
  return id;
};

function register(router) {
  router.post(
    '/api/quiz/start',
    requireAuth,
    limit(startLimiter, (req) => req.user.id),
    (req, res) => {
      const subject = String(req.body.subject ?? '');
      const count = req.body.count === undefined ? 10 : req.body.count;
      const seconds = req.body.seconds === undefined ? 30 : req.body.seconds;
      if (!SUBJECT_IDS.includes(subject)) throw new HttpError(400, 'Pick a subject');
      if (![5, 10, 15].includes(count)) throw new HttpError(400, 'Choose 5, 10 or 15 questions');
      if (![20, 30, 45, 60].includes(seconds)) throw new HttpError(400, 'Choose 20, 30, 45 or 60 seconds per question');

      const today = db
        .prepare("SELECT COUNT(*) AS n FROM attempts WHERE user_id = ? AND mode = 'practice' AND started_at >= ?")
        .get(req.user.id, istDayStart(Date.now())).n;
      if (today >= MAX_PRACTICE_PER_DAY) throw new HttpError(429, 'You have reached today\'s limit of 30 practice quizzes. Come back tomorrow, or join a contest.');

      const ids = bank.pickForPractice(subject, req.user.id, count);
      if (ids.length < 5) throw new HttpError(503, 'This subject does not have enough questions yet. Try another subject.');
      const id = engine.createAttempt({ userId: req.user.id, subject, mode: 'practice', secondsPer: seconds, questionIds: ids });
      res.json({ attemptId: id, state: engine.getState(id, req.user.id) }, 201);
    },
  );

  router.get('/api/quiz/:id', requireAuth, (req, res) => {
    res.json(engine.getState(attemptId(req), req.user.id));
  });

  router.post(
    '/api/quiz/:id/answer',
    requireAuth,
    limit(answerLimiter, (req) => req.user.id),
    (req, res) => {
      const out = engine.submitAnswer(attemptId(req), req.user.id, req.body);
      const a = db.prepare('SELECT contest_id FROM attempts WHERE id = ?').get(attemptId(req));
      if (a && a.contest_id) hub.publish(`contest:${a.contest_id}`, 'update', { at: Date.now() });
      res.json(out);
    },
  );
}

module.exports = { register };
