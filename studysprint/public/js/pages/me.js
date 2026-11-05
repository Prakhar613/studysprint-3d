import { h, api, state, subjectName, selectEl, toast, go, errorBox } from '../lib.js';
import { openAuth, logout } from '../auth.js';

export default async function me(ctx) {
  if (!state.user) return h('div', { class: 'panel' }, h('h1', {}, 'Your profile'), h('p', {}, 'Log in to see your progress.'), h('button', { class: 'btn primary', onclick: () => openAuth('login') }, 'Log in'));
  const d = await api('/api/me/stats');
  const st = selectEl([['', 'Not set']].concat(state.meta.states.map((s) => [s, s])), state.user.state, { id: 'p-s' });
  const gr = selectEl([['', 'Not set']].concat(state.meta.grades.map((s) => [s, s])), state.user.grade, { id: 'p-g' });
  const cur = h('input', { type: 'password', id: 'p-c', autocomplete: 'current-password' });
  const nxt = h('input', { type: 'password', id: 'p-n', autocomplete: 'new-password' });
  const wrap = (fn) => async () => { try { await fn(); } catch (e) { toast(e.message, 'bad'); } };
  return h('div', {},
    h('h1', {}, state.user.username),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, d.streak), h('span', {}, 'day streak')),
      h('div', { class: 'stat' }, h('b', {}, d.points.total), h('span', {}, 'quiz points')),
      h('div', { class: 'stat' }, h('b', {}, d.points.weekRank ?? 'N/A'), h('span', {}, 'rank this week')),
      h('div', { class: 'stat' }, h('b', {}, d.focusTotal), h('span', {}, 'focus minutes')),
      h('div', { class: 'stat' }, h('b', {}, d.helper.accepted), h('span', {}, 'accepted answers'))),
    h('div', { class: 'panel' }, h('h2', {}, 'Accuracy by subject'),
      d.subjects.length ? d.subjects.map((s) => { const p = Math.round((s.correct / s.answered) * 100); return h('div', { style: { margin: '.6rem 0' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', {}, subjectName(s.subject)), h('span', { class: 'muted small' }, `${p}% of ${s.answered}`)), h('div', { class: 'meter' }, h('b', { style: { width: `${p}%` } }))); })
        : h('p', { class: 'muted' }, 'Take a quiz to see your accuracy here.')),
    h('div', { class: 'grid g2', style: { marginTop: '1rem' } },
      h('div', { class: 'panel' }, h('h2', {}, 'Profile'), h('div', { class: 'field' }, h('label', { for: 'p-s' }, 'State'), st), h('div', { class: 'field' }, h('label', { for: 'p-g' }, 'Class or level'), gr),
        h('button', { class: 'btn primary', onclick: wrap(async () => { const r = await api('/api/auth/profile', { method: 'PATCH', body: { state: st.value, grade: gr.value } }); state.user = r.user; toast('Profile saved'); }) }, 'Save profile')),
      h('div', { class: 'panel' }, h('h2', {}, 'Password'), h('div', { class: 'field' }, h('label', { for: 'p-c' }, 'Current password'), cur), h('div', { class: 'field' }, h('label', { for: 'p-n' }, 'New password (8 or more characters)'), nxt),
        h('button', { class: 'btn', onclick: wrap(async () => { await api('/api/auth/password', { method: 'POST', body: { current: cur.value, next: nxt.value } }); cur.value = nxt.value = ''; toast('Password changed. Other devices were logged out.'); }) }, 'Change password'))),
    h('div', { class: 'panel', style: { marginTop: '1rem' } }, h('h2', {}, 'Account'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: logout }, 'Log out'),
        h('button', { class: 'btn ghost', onclick: wrap(async () => { const pw = prompt('Enter your password to permanently delete your account. Your posts stay but lose your name.'); if (!pw) return; await api('/api/auth/account', { method: 'DELETE', body: { password: pw } }); state.user = null; window.dispatchEvent(new Event('authchange')); go('#/'); toast('Account deleted'); }) }, 'Delete account'))));
}
