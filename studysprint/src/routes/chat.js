'use strict';
// Live chat rooms and the shared server-sent-events stream (chat, waiting-room presence, contest updates).
const { db } = require('../db');
const { HttpError } = require('../http');
const { requireAuth, requireAdmin, limit } = require('../auth');
const { ROOM_IDS, parseContestId } = require('../subjects');
const hub = require('../hub');
const { createLimiter, cleanText } = require('../util');

const burstLimiter = createLimiter(5, 10 * 1000); // 5 messages per 10 seconds
const lastMessage = new Map(); // userId -> { text, at }

const shape = (r) => ({ id: r.id, room: r.room, text: r.text, ts: r.created_at, user: { username: r.username, state: r.state } });

function roomOr404(req) {
  if (!ROOM_IDS.includes(req.params.room)) throw new HttpError(404, 'Chat room not found');
  return req.params.room;
}

function history(room, afterId, max) {
  if (afterId) {
    return db
      .prepare(
        `SELECT m.id, m.room, m.text, m.created_at, u.username, u.state FROM chat_messages m JOIN users u ON u.id = m.user_id
         WHERE m.room = ? AND m.hidden = 0 AND m.id > ? ORDER BY m.id ASC LIMIT ?`,
      )
      .all(room, afterId, max)
      .map(shape);
  }
  return db
    .prepare(
      `SELECT m.id, m.room, m.text, m.created_at, u.username, u.state FROM chat_messages m JOIN users u ON u.id = m.user_id
       WHERE m.room = ? AND m.hidden = 0 ORDER BY m.id DESC LIMIT ?`,
    )
    .all(room, max)
    .reverse()
    .map(shape);
}

function register(router) {
  router.get('/api/chat/rooms/:room/messages', requireAuth, (req, res) => {
    const room = roomOr404(req);
    const after = Number.parseInt(req.query.after, 10) || 0;
    res.json({ room, messages: history(room, after, after ? 100 : 60), online: hub.count(`room:${room}`) });
  });

  router.post(
    '/api/chat/rooms/:room/messages',
    requireAuth,
    limit(burstLimiter, (req) => req.user.id, 'You are sending messages too fast. Wait a few seconds.'),
    (req, res) => {
      const room = roomOr404(req);
      const text = cleanText(req.body.text, 500);
      if (!text) throw new HttpError(400, 'Type a message first');
      const prev = lastMessage.get(req.user.id);
      const now = Date.now();
      if (prev && prev.text === text && now - prev.at < 15000) throw new HttpError(429, 'You just sent that. Try saying something new.');
      lastMessage.set(req.user.id, { text, at: now });
      if (lastMessage.size > 5000) lastMessage.delete(lastMessage.keys().next().value);

      const r = db.prepare('INSERT INTO chat_messages(room, user_id, text, created_at) VALUES(?,?,?,?)').run(room, req.user.id, text, now);
      const msg = shape({ id: Number(r.lastInsertRowid), room, text, created_at: now, username: req.user.username, state: req.user.state });
      hub.publish(`room:${room}`, 'message', msg, msg.id);
      res.json({ message: msg }, 201);
    },
  );

  router.delete('/api/chat/messages/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT room FROM chat_messages WHERE id = ?').get(id);
    if (row) {
      db.prepare('UPDATE chat_messages SET hidden = 1 WHERE id = ?').run(id);
      hub.publish(`room:${row.room}`, 'removed', { id });
    }
    res.json({ ok: true });
  });

  // One stream endpoint for all live channels:
  //   room:<id>      chat room (login required)
  //   lobby:<id>     contest waiting room, reports how many students are waiting (login required)
  //   contest:<id>   contest leaderboard changed (public)
  router.get('/api/stream', (req, res) => {
    const channel = String(req.query.channel ?? '');
    const [kind, ...rest] = channel.split(':');
    const key = rest.join(':');
    let presence = false;
    let replay = [];

    if (kind === 'room') {
      requireAuth(req);
      if (!ROOM_IDS.includes(key)) throw new HttpError(404, 'Chat room not found');
      presence = true;
      const last = Number.parseInt(req.headers['last-event-id'], 10);
      if (last) replay = history(key, last, 100).map((m) => ({ event: 'message', data: m, id: m.id }));
    } else if (kind === 'lobby') {
      requireAuth(req);
      if (!parseContestId(key)) throw new HttpError(404, 'Contest not found');
      presence = true;
    } else if (kind === 'contest') {
      if (!parseContestId(key)) throw new HttpError(404, 'Contest not found');
    } else {
      throw new HttpError(400, 'Unknown channel');
    }

    const who = req.user ? req.user.id : `ip:${req.ip}`;
    if (!hub.subscribe(channel, req, res, who, { presence, replay })) {
      throw new HttpError(429, 'Too many live connections open. Close another tab and try again.');
    }
  });
}

module.exports = { register };
