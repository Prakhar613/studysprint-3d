'use strict';
// Server-sent events hub: one-way live updates (chat messages, presence, contest leaderboards).
// Clients send data with normal POST requests, so this works through any HTTP proxy and needs no WebSocket library.

const channels = new Map(); // channel -> Set<{ res, userId }>
const perUser = new Map(); // userId -> open stream count
const MAX_STREAMS_PER_USER = 6;

function count(channel) {
  return channels.get(channel)?.size || 0;
}

function write(res, event, data, id) {
  let frame = '';
  if (id !== undefined && id !== null) frame += `id: ${id}\n`;
  frame += `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  res.write(frame);
}

function publish(channel, event, data, id) {
  const set = channels.get(channel);
  if (!set) return;
  for (const c of set) {
    try { write(c.res, event, data, id); } catch { /* connection is closing */ }
  }
}

/** Opens an event stream. Returns false if the user already has too many open. */
function subscribe(channel, req, res, userId, { presence = false, replay = [] } = {}) {
  const open = perUser.get(userId) || 0;
  if (open >= MAX_STREAMS_PER_USER) return false;
  perUser.set(userId, open + 1);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');

  const client = { res, userId };
  if (!channels.has(channel)) channels.set(channel, new Set());
  channels.get(channel).add(client);

  for (const item of replay) write(res, item.event, item.data, item.id);
  if (presence) publish(channel, 'presence', { count: count(channel) });

  const heartbeat = setInterval(() => {
    try { res.write(': keep-alive\n\n'); } catch { /* closing */ }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const set = channels.get(channel);
    if (set) {
      set.delete(client);
      if (!set.size) channels.delete(channel);
    }
    const left = (perUser.get(userId) || 1) - 1;
    if (left <= 0) perUser.delete(userId);
    else perUser.set(userId, left);
    if (presence) publish(channel, 'presence', { count: count(channel) });
  });
  return true;
}

function closeAll() {
  for (const set of channels.values()) for (const c of set) { try { c.res.end(); } catch { /* ignore */ } }
  channels.clear();
}

module.exports = { publish, subscribe, count, closeAll };
