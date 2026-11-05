import { h, api, state, fmtIST, countdown, subjectById, dot, serverNow, skeleton } from '../lib.js';

export default async function contests(ctx) {
  const d = await api('/api/contests');
  const live = [];
  const card = (c) => {
    const s = subjectById(c.subject);
    const when = h('div', { class: 'small', 'data-t': c.start });
    live.push({ c, when });
    return h('div', { class: 'panel', style: { borderLeft: `10px solid ${s.color}` } },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { style: { margin: 0 } }, `${s.name} contest`), h('span', { class: `badge ${c.status === 'live' ? 'live' : ''}` }, c.status === 'live' ? 'Live now' : 'Upcoming')),
      h('p', { class: 'muted small', style: { margin: '.4rem 0' } }, `${fmtIST(c.start)}. ${c.questions} questions, ${c.secondsPer} seconds each.`),
      when,
      h('p', { class: 'small muted' }, `${c.participants} joined${c.waiting ? `, ${c.waiting} waiting now` : ''}`),
      h('a', { class: `btn ${c.status === 'live' ? 'primary' : ''}`, href: `#/contest/${c.id}` }, c.status === 'live' ? (c.mine ? 'Continue' : 'Join now') : c.mine ? 'You are in' : 'Enter waiting room'));
  };
  const tick = () => live.forEach(({ c, when }) => {
    const now = serverNow();
    when.textContent = now < c.start ? `Starts in ${countdown(c.start - now)}` : now < c.closesAt ? `Joining closes in ${countdown(c.closesAt - now)}` : 'Joining closed';
  });
  const root = h('div', {},
    h('h1', {}, 'Weekly contests'),
    h('p', {}, `Every contest runs at a fixed time in Indian Standard Time. Arrive early, wait in the lobby, and start within ${state.meta.contest.joinWindowMin} minutes of the start time. Everyone gets the same ${state.meta.contest.questions} questions.`),
    h('div', { class: 'grid g2' }, d.contests.map(card)),
    d.recent.length ? h('div', { class: 'section' }, h('h2', {}, 'Last week\'s results'),
      h('ul', { class: 'list' }, d.recent.map((c) => h('li', {}, h('a', { href: `#/contest/${c.id}` }, dot(subjectById(c.subject).color), `${subjectById(c.subject).name}, ${fmtIST(c.start)}`), h('span', { class: 'muted small' }, ` ${c.participants} students`))))) : null);
  tick(); ctx.every(1000, tick);
  return root;
}
