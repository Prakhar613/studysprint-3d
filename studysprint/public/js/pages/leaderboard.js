import { h, api, state, selectEl, errorBox, skeleton } from '../lib.js';

const SCOPES = [['quiz', 'Quiz points'], ['focus', 'Focus minutes'], ['helpers', 'Top helpers']];
const PERIODS = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['all', 'All time']];

export default async function leaderboard(ctx) {
  const f = { scope: 'quiz', period: 'week', subject: '', state: '' };
  const box = h('div', {}, skeleton(5));
  const tabs = h('div', { class: 'chips', role: 'group', 'aria-label': 'Leaderboard type' });
  const sel = (key, opts, label) => h('div', { style: { minWidth: '170px' } }, h('label', { class: 'small' }, label), selectEl(opts, f[key], { onchange: (e) => { f[key] = e.target.value; load(); } }));

  const paintTabs = () => tabs.replaceChildren(...SCOPES.map(([v, t]) => h('button', { class: 'chip', 'aria-pressed': String(f.scope === v), onclick: () => { f.scope = v; paintTabs(); load(); } }, t)));

  async function load() {
    box.replaceChildren(skeleton(5));
    try {
      const q = new URLSearchParams(f).toString();
      const d = await api(`/api/leaderboard?${q}`);
      const unit = f.scope === 'quiz' ? 'Points' : f.scope === 'focus' ? 'Minutes' : 'Helper score';
      const extra = f.scope === 'quiz' ? ['Correct', (r) => r.correct] : f.scope === 'focus' ? ['Sessions', (r) => r.sessions] : ['Accepted', (r) => r.accepted];
      box.replaceChildren(
        d.me ? h('p', { class: 'note' }, `Your rank: ${d.me.rank} of ${d.total} with ${d.me.score}.`) : state.user ? h('p', { class: 'muted small' }, 'You are not on this board yet.') : h('p', { class: 'muted small' }, 'Log in to see your own rank.'),
        d.rows.length ? h('div', { class: 'tablewrap' }, h('table', {},
          h('thead', {}, h('tr', {}, h('th', {}, 'Rank'), h('th', {}, 'Student'), h('th', {}, 'State'), h('th', { class: 'num' }, unit), h('th', { class: 'num' }, extra[0]))),
          h('tbody', {}, d.rows.map((r) => h('tr', { class: r.isMe ? 'me' : '' }, h('td', {}, r.rank), h('td', {}, r.username), h('td', {}, r.state || 'N/A'), h('td', { class: 'num' }, r.score), h('td', { class: 'num' }, extra[1](r) ?? 0))))))
          : h('p', { class: 'muted' }, 'Nobody has scored here yet. Take a quiz or finish a focus session to get on the board.'),
        h('p', { class: 'small muted' }, 'Updated every few seconds. Showing the top 50.'));
    } catch (e) { box.replaceChildren(errorBox(e)); }
  }
  paintTabs(); load();
  return h('div', {}, h('h1', {}, 'Leaderboard'), tabs,
    h('div', { class: 'row', style: { marginBottom: '1rem', alignItems: 'end' } },
      sel('period', PERIODS, 'Period'),
      sel('subject', [['', 'All subjects']].concat(state.meta.subjects.map((s) => [s.id, s.name])), 'Subject'),
      sel('state', [['', 'All India']].concat(state.meta.states.map((s) => [s, s])), 'State')),
    box);
}
