'use strict';
// AI tutor endpoints. Login is required (the model costs money), every student has a daily allowance,
// and only one reply streams per student at a time.
const config = require('../config');
const { HttpError } = require('../http');
const { requireAuth, limit } = require('../auth');
const { SUBJECT_IDS } = require('../subjects');
const { createLimiter, cleanText, istDayNumber } = require('../util');
const tutor = require('../tutor');

const burst = createLimiter(6, 60 * 1000); // 6 messages per minute
const usage = new Map(); // userId -> { day, n }
const inFlight = new Set();

const enabled = () => tutor.isEnabled();

function usedToday(userId) {
  const day = istDayNumber(Date.now());
  const u = usage.get(userId);
  return u && u.day === day ? u.n : 0;
}
function bump(userId) {
  const day = istDayNumber(Date.now());
  const u = usage.get(userId);
  usage.set(userId, u && u.day === day ? { day, n: u.n + 1 } : { day, n: 1 });
  if (usage.size > 5000) usage.delete(usage.keys().next().value);
}

function pomodoroLine(p) {
  if (!p || typeof p !== 'object') return '';
  const phase = { focus: 'a focus session', short: 'a short break', long: 'a long break' }[p.phase];
  if (!phase) return '';
  const mins = Number.isFinite(p.minutesLeft) ? Math.max(0, Math.min(180, Math.round(p.minutesLeft))) : null;
  return `the student is in ${phase}${mins != null ? ` with about ${mins} minutes left` : ''}`;
}

function register(router) {
  router.get('/api/tutor/status', (req, res) => {
    const limitN = config.TUTOR_DAILY_LIMIT;
    res.json({
      enabled: enabled(),
      limit: limitN,
      left: req.user ? Math.max(0, limitN - usedToday(req.user.id)) : null,
    });
  });

  router.post(
    '/api/tutor/chat',
    requireAuth,
    limit(burst, (req) => req.user.id, 'You are asking too fast. Wait a few seconds and try again.'),
    async (req, res) => {
      if (!enabled()) throw new HttpError(503, 'The AI tutor is not switched on for this site yet.');

      const body = req.body;
      if (!Array.isArray(body.messages) || !body.messages.length) throw new HttpError(400, 'Type a message first');
      const mode = tutor.MODES.includes(body.mode) ? body.mode : 'free';
      const lang = tutor.REPLY_LANGS.includes(body.lang) ? body.lang : 'auto';
      const subject = SUBJECT_IDS.includes(body.subject) ? body.subject : '';

      const messages = body.messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-12)
        .map((m) => ({ role: m.role, content: cleanText(m.content, m.role === 'user' ? 1500 : 4000) }))
        .filter((m) => m.content);
      while (messages.length && messages[0].role !== 'user') messages.shift();
      if (!messages.length || messages[messages.length - 1].role !== 'user') throw new HttpError(400, 'Type a message first');

      // Quizzes and contests are scored, so Sprint sits them out.
      if (tutor.inActiveAttempt(req.user.id)) {
        throw new HttpError(409, 'Sprint takes a break while a quiz or contest is running. Finish it and come back!');
      }
      if (inFlight.has(req.user.id)) throw new HttpError(429, 'Sprint is still answering your last message.');
      if (usedToday(req.user.id) >= config.TUTOR_DAILY_LIMIT) {
        throw new HttpError(429, `You have used today's ${config.TUTOR_DAILY_LIMIT} tutor messages. They reset at midnight IST.`);
      }

      const system = tutor.systemPrompt({
        lang,
        mode,
        subject,
        grade: req.user.grade,
        pomodoro: pomodoroLine(body.pomodoro),
        snapshot: mode === 'mistakes' ? tutor.buildSnapshot(req.user.id, subject) : '',
      });

      inFlight.add(req.user.id);
      bump(req.user.id);
      const ac = new AbortController();
      res.on('close', () => ac.abort());
      const signal = AbortSignal.any([ac.signal, AbortSignal.timeout(60000)]);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      const send = (obj) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`); };

      try {
        for await (const part of tutor.streamReply({ system, messages, signal })) {
          if (part.text) send({ t: part.text });
          else if (part.done) send({ done: true, truncated: part.truncated, left: Math.max(0, config.TUTOR_DAILY_LIMIT - usedToday(req.user.id)) });
        }
      } catch (e) {
        if (e.name === 'TimeoutError') send({ error: 'The tutor took too long. Please try again.' });
        else if (e.name !== 'AbortError') {
          if (!(e instanceof tutor.TutorError)) console.error('[tutor]', e);
          send({ error: e instanceof tutor.TutorError ? e.message : 'Something went wrong. Please try again.' });
        }
      } finally {
        inFlight.delete(req.user.id);
        res.end();
      }
    },
  );
}

module.exports = { register };
