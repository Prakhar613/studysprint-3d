import { h, api, state, ago, stream, go, errorBox, toast } from '../lib.js';
import { openAuth } from '../auth.js';

export default async function chat(ctx) {
  const room = ctx.params.room || 'general';
  const rooms = state.meta.rooms;
  const meta = rooms.find((r) => r.id === room);
  const groups = [...new Set(rooms.map((r) => r.group))];
  const list = h('nav', { class: 'rooms', 'aria-label': 'Chat rooms' }, groups.map((g) => [h('h3', {}, g), rooms.filter((r) => r.group === g).map((r) => h('a', { href: `#/chat/${r.id}`, 'aria-current': String(r.id === room) }, r.name))]));
  if (!meta) return h('div', { class: 'panel' }, h('h1', {}, 'Room not found'), h('a', { class: 'btn', href: '#/chat' }, 'Go to General'));
  if (!state.user) return h('div', {}, h('h1', {}, 'Live chat'), h('div', { class: 'panel' }, h('p', {}, 'Talk to students from every state, share a problem and help each other. Log in to join the conversation.'), h('button', { class: 'btn primary', onclick: () => openAuth('login') }, 'Log in to chat')));

  const msgs = h('div', { class: 'msgs', role: 'log', 'aria-live': 'polite', 'aria-label': `${meta.name} messages` });
  const online = h('span', { class: 'small muted' });
  const seen = new Set();
  let stick = true;
  const more = h('button', { class: 'btn small primary newmsg', hidden: true, onclick: () => { msgs.scrollTop = msgs.scrollHeight; } }, 'New messages');
  msgs.addEventListener('scroll', () => { stick = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 60; if (stick) more.hidden = true; });

  function add(m) {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    const mine = m.user.username === state.user.username;
    const el = h('div', { class: `msg ${mine ? 'mine' : ''}`, 'data-id': m.id },
      h('div', { class: 'who' }, `${m.user.username}${m.user.state ? `, ${m.user.state}` : ''} · ${ago(m.ts)} `,
        !mine ? h('button', { class: 'linkbtn act small', onclick: () => report(m, el) }, 'Report') : null,
        state.user.isAdmin ? h('button', { class: 'linkbtn act small', onclick: () => api(`/api/chat/messages/${m.id}`, { method: 'DELETE' }) }, 'Remove') : null),
      h('div', { class: 't' }, m.text));
    msgs.append(el);
    if (stick) msgs.scrollTop = msgs.scrollHeight; else more.hidden = false;
  }
  async function report(m, el) {
    if (!confirm('Report this message to moderators?')) return;
    try { await api('/api/report', { method: 'POST', body: { type: 'chat', id: m.id } }); toast('Thanks. Reported.'); } catch (e) { toast(e.message, 'bad'); }
  }

  const input = h('textarea', { rows: 1, maxlength: 500, placeholder: `Message #${meta.name}`, 'aria-label': 'Message', onkeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } } });
  const sendBtn = h('button', { class: 'btn primary', onclick: send }, 'Send');
  async function send() {
    const text = input.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    try { const r = await api(`/api/chat/rooms/${room}/messages`, { method: 'POST', body: { text } }); input.value = ''; stick = true; add(r.message); }
    catch (e) { toast(e.message, 'bad'); }
    finally { sendBtn.disabled = false; input.focus(); }
  }

  try {
    const hist = await api(`/api/chat/rooms/${room}/messages`);
    online.textContent = `${hist.online} online`;
    hist.messages.forEach(add);
  } catch (e) { return errorBox(e); }
  ctx.onCleanup(stream(`room:${room}`, {
    message: add,
    removed: ({ id }) => msgs.querySelector(`[data-id="${id}"]`)?.remove(),
    presence: (p) => { online.textContent = `${p.count} online`; },
  }));
  requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; });

  return h('div', {}, h('h1', { class: 'hidden' }, 'Live chat'),
    h('div', { class: 'chat' }, list,
      h('div', { class: 'pane' },
        h('div', { class: 'pane-h' }, h('strong', {}, `# ${meta.name}`), online, h('a', { class: 'small', href: '#/doubts' }, 'Post a detailed doubt')),
        msgs, more,
        h('div', { class: 'compose' }, input, sendBtn))));
}
