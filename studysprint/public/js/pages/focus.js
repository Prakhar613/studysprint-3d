import { h, api, state, subjectName, selectEl, skeleton, errorBox } from '../lib.js';
import * as pomo from '../pomodoro.js';
import { timerCard } from '../timerui.js';
import { openAuth } from '../auth.js';

export default async function focus(ctx) {
  const s = pomo.getSettings();
  const num = (key, label, min, max) => h('div', { class: 'field', style: { flex: '1', minWidth: '110px' } },
    h('label', { for: `s-${key}` }, label),
    h('input', { id: `s-${key}`, type: 'number', min, max, value: s[key], onchange: (e) => {
      const v = Math.min(max, Math.max(min, parseInt(e.target.value, 10) || s[key]));
      e.target.value = v; pomo.setSettings({ [key]: v });
    } }));
  const stats = h('div', {}, skeleton(2));
  const root = h('div', {},
    h('h1', {}, 'Focus timer'),
    h('div', { class: 'grid g2' },
      timerCard(ctx, { full: true }),
      h('div', { class: 'panel' },
        h('h2', {}, 'How it works'),
        h('p', {}, 'Study without distractions until the bubbles fill. Then rest. After every fourth session you get a longer break. Keep this tab open or let it run in the background; the timer keeps going on other pages too.'),
        h('div', { class: 'row' }, num('focus', 'Focus (min)', 5, 120), num('short', 'Short break', 1, 30), num('long', 'Long break', 5, 60), num('every', 'Long break after', 2, 8)),
        h('p', { class: 'small muted' }, 'Changes apply to the next session. Only completed sessions count towards the focus leaderboard.'))),
    h('div', { class: 'section' }, h('h2', {}, 'Your progress'), stats));

  const draw = async () => {
    if (!state.user) {
      stats.replaceChildren(h('div', { class: 'panel' }, h('p', {}, 'Log in to count your focus minutes, keep a daily streak and appear on the leaderboard.'), h('button', { class: 'btn primary', onclick: () => openAuth('login') }, 'Log in')));
      return;
    }
    try {
      const d = await api('/api/me/stats');
      const max = Math.max(30, ...d.week.map((w) => w.minutes));
      stats.replaceChildren(
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('b', {}, d.focusToday), h('span', {}, 'minutes today')),
          h('div', { class: 'stat' }, h('b', {}, d.streak), h('span', {}, d.streak === 1 ? 'day streak' : 'day streak')),
          h('div', { class: 'stat' }, h('b', {}, Math.round(d.focusTotal / 60 * 10) / 10), h('span', {}, 'hours in total'))),
        h('div', { class: 'panel' }, h('h3', {}, 'Last 7 days (minutes)'),
          h('div', { class: 'bars', role: 'img', 'aria-label': 'Minutes focused per day for the last seven days' },
            d.week.map((w) => h('div', {}, h('span', {}, w.minutes), h('i', { style: { height: `${(w.minutes / max) * 80}%` } }), h('span', {}, new Date(w.date).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })))))));
    } catch (e) { stats.replaceChildren(errorBox(e)); }
  };
  draw();
  return root;
}
