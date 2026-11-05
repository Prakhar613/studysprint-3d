import { h, api, state, fmtIST, countdown, subjectById, serverNow, stream, go, errorBox } from '../lib.js';
import { needLogin } from '../auth.js';

export default async function contest(ctx) {
  const id = ctx.params.id;
  let d = await api(`/api/contests/${id}`);
  const s = subjectById(d.contest.subject);
  const head = h('div'), boardBox = h('div'), lobby = h('span');
  const err = h('p', { class: 'err', role: 'alert', hidden: true });

  function status() { const c = d.contest, n = serverNow(); return n < c.start ? 'upcoming' : n < c.closesAt ? 'live' : 'ended'; }
  let lastStatus = status();

  function paintHead() {
    const c = d.contest, st = status(), n = serverNow();
    const btn = c.mine
      ? h('a', { class: 'btn primary', href: `#/quiz/play/${c.mine.attemptId}` }, c.mine.finished ? 'See your result' : 'Continue contest')
      : st === 'live' ? h('button', { class: 'btn primary', onclick: join }, 'Start contest now')
        : h('button', { class: 'btn', disabled: true }, st === 'upcoming' ? 'Opens at start time' : 'Joining closed');
    head.replaceChildren(
      h('div', { class: 'panel', style: { borderLeft: `10px solid ${s.color}` } },
        h('p', { class: 'muted', style: { margin: 0 } }, fmtIST(c.start)),
        h('div', { class: 'clock' }, st === 'upcoming' ? countdown(c.start - n) : st === 'live' ? `Open for ${countdown(c.closesAt - n)}` : 'Finished'),
        h('p', { class: 'small muted' }, `${c.questions} questions, ${c.secondsPer} seconds each. Faster correct answers score more. Answers are revealed after the window closes.`),
        err, h('div', { class: 'row' }, btn, h('span', { class: 'small muted' }, st !== 'ended' ? ['Waiting in lobby: ', lobby] : ''))));
  }

  async function join() {
    needLogin(async () => {
      err.hidden = true;
      try { const r = await api(`/api/contests/${id}/join`, { method: 'POST' }); go(`#/quiz/play/${r.attemptId}`); }
      catch (e) { err.textContent = e.message; err.hidden = false; }
    });
  }

  function paintBoard() {
    boardBox.replaceChildren(d.leaderboard.length
      ? h('div', { class: 'tablewrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Rank', 'Student', 'State', 'Points', 'Correct'].map((t, i) => h('th', { class: i > 2 ? 'num' : '' }, t)))),
        h('tbody', {}, d.leaderboard.map((r) => h('tr', { class: r.isMe ? 'me' : '' }, h('td', {}, r.rank), h('td', {}, r.username, r.finished ? '' : h('span', { class: 'muted small' }, ' (playing)')), h('td', {}, r.state), h('td', { class: 'num' }, r.points), h('td', { class: 'num' }, r.correct))))))
      : h('p', { class: 'muted' }, 'No scores yet. Be the first one on the board.'));
  }

  let refreshing = false;
  const refresh = async () => {
    if (refreshing) return; refreshing = true;
    try { d = await api(`/api/contests/${id}`); paintBoard(); paintHead(); } catch { /* keep the last data */ } finally { setTimeout(() => { refreshing = false; }, 3000); }
  };

  paintHead(); paintBoard();
  ctx.every(1000, () => { const st = status(); if (st !== lastStatus) { lastStatus = st; refresh(); } paintHead(); });
  ctx.onCleanup(stream(`contest:${id}`, { update: refresh }));
  if (state.user && status() !== 'ended') ctx.onCleanup(stream(`lobby:${id}`, { presence: (p) => { lobby.textContent = p.count; } }));
  else lobby.textContent = state.user ? '0' : 'log in to join the lobby';

  return h('div', {}, h('p', {}, h('a', { href: '#/contests' }, 'All contests')), h('h1', {}, `${s.name} contest`), head,
    h('div', { class: 'section' }, h('h2', {}, 'Live leaderboard'), boardBox));
}
