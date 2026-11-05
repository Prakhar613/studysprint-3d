'use strict';
// Site data: subjects, news headlines, research search and free book sources.
const { HttpError } = require('../http');
const { limit } = require('../auth');
const S = require('../subjects');
const bank = require('../questionBank');
const news = require('../news');
const external = require('../external');
const library = require('../library');
const { createLimiter, MIN } = require('../util');

const outboundLimiter = createLimiter(40, 10 * MIN);
const byIp = limit(outboundLimiter, (req) => req.ip, 'Too many searches. Please wait a few minutes.');

function register(router) {
  router.get('/healthz', (req, res) => res.json({ ok: true }));

  router.get('/api/meta', (req, res) => {
    const counts = bank.counts();
    res.json({
      now: Date.now(),
      subjects: S.SUBJECTS.map((s) => ({ ...s, questions: counts[s.id] || 0 })),
      states: S.STATES,
      grades: S.GRADES,
      rooms: S.ROOMS,
      contest: { questions: S.CONTEST_QUESTIONS, secondsPer: S.CONTEST_SECONDS, joinWindowMin: S.JOIN_WINDOW_MS / 60000 },
    });
  });

  router.get('/api/news', byIp, async (req, res) => {
    const topic = String(req.query.topic ?? 'current');
    if (!news.TOPICS[topic]) throw new HttpError(400, 'Unknown news topic');
    res.json(await news.getNews(topic));
  });

  router.get('/api/research', byIp, async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2 || q.length > 200) throw new HttpError(400, 'Type 2 to 200 characters to search');
    try {
      res.json({ q, results: await external.searchPapers(q) });
    } catch {
      throw new HttpError(502, 'Paper search is unavailable right now. Try the Google Scholar button instead.');
    }
  });

  router.get('/api/library', (req, res) => {
    res.json({ items: library });
  });

  router.get('/api/library/books', byIp, async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2 || q.length > 200) throw new HttpError(400, 'Type 2 to 200 characters to search');
    try {
      res.json({ q, results: await external.searchBooks(q, req.query.free === '1') });
    } catch {
      throw new HttpError(502, 'Book search is unavailable right now. Try the sources listed on this page.');
    }
  });
}

module.exports = { register };
