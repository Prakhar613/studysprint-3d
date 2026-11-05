import { h, mmss, state, selectEl, subjectById } from './lib.js';
import * as pomo from './pomodoro.js';
import { t, subjName } from './i18n.js';

const subjLabel = (id) => (id === 'general' ? t('timer.general') : (subjectById(id) ? subjName(subjectById(id)) : id));

/** The focus timer: one ember per 1/25th of the session lights up as time passes. */
export function timerCard(ctx, { full = false, compact = false } = {}) {
  const bubbles = Array.from({ length: 25 }, () => h('i'));
  const clock = h('div', { class: 'clock', 'aria-hidden': 'true' });
  const sr = h('span', { class: 'hidden' });
  const phase = h('div', { class: 'phase' });
  const grid = h('div', { class: 'bubbles', 'aria-hidden': 'true' }, bubbles);
  const actions = h('div', { class: 'row' });
  const subj = selectEl(
    [['general', t('timer.general')]].concat(state.meta.subjects.map((s) => [s.id, subjName(s)])),
    pomo.getSettings().subject,
    { 'aria-label': t('timer.subject'), onchange: (e) => pomo.setSettings({ subject: e.target.value }), style: { maxWidth: '230px' } },
  );

  function paint() {
    const r = pomo.getRun();
    const rem = pomo.remaining();
    const tot = r ? r.minutes * 60000 : pomo.getSettings().focus * 60000;
    const filled = r ? Math.min(25, Math.floor(((tot - rem) / tot) * 25)) : 0;
    bubbles.forEach((b, i) => { b.className = i < filled ? 'on' : i === filled && r && r.paused == null ? 'now' : ''; });
    grid.classList.toggle('break', !!r && r.phase !== 'focus');
    clock.textContent = mmss(r ? rem : tot);
    phase.textContent = !r ? t('timer.ready') : r.phase === 'focus' ? t('timer.focusing', { s: subjLabel(r.subject) }) : r.phase === 'long' ? t('timer.long') : t('timer.short');
    if (r && r.paused != null) phase.textContent += ` (${t('timer.paused')})`;
    actions.replaceChildren(
      ...(!r
        ? [h('button', { class: 'btn primary', onclick: () => pomo.startFocus() }, t('timer.start', { n: pomo.getSettings().focus })), subj]
        : [
          r.paused != null
            ? h('button', { class: 'btn primary', onclick: pomo.resume }, t('timer.resume'))
            : h('button', { class: 'btn', onclick: pomo.pause }, t('timer.pause')),
          r.phase === 'focus'
            ? h('button', { class: 'btn ghost', onclick: () => { if (confirm(t('timer.confirm'))) pomo.stop(); } }, t('timer.stop'))
            : h('button', { class: 'btn ghost', onclick: pomo.skipBreak }, t('timer.skip')),
          r.phase !== 'focus' ? h('a', { class: 'btn', href: '#/quiz' }, t('timer.quizbreak')) : null,
        ]),
    );
  }
  let lastKey = '';
  const onTick = () => {
    const r = pomo.getRun();
    const key = r ? `${r.phase}|${r.paused != null}|${r.startedAt}` : 'idle';
    if (key !== lastKey) { lastKey = key; paint(); return; }
    const rem = pomo.remaining();
    const tot = r ? r.minutes * 60000 : pomo.getSettings().focus * 60000;
    clock.textContent = mmss(r ? rem : tot);
    const filled = r ? Math.min(25, Math.floor(((tot - rem) / tot) * 25)) : 0;
    bubbles.forEach((b, i) => { b.className = i < filled ? 'on' : i === filled && r && r.paused == null ? 'now' : ''; });
  };
  paint();
  ctx.onCleanup(pomo.subscribe(onTick));
  const n = pomo.cyclesToday();
  return h('div', { class: compact ? 'sheet compact' : 'sheet' }, h('div', { class: 'sheet-in' }, phase, clock, compact ? null : grid, actions,
    full ? h('p', { class: 'small muted', style: { marginTop: '.8rem' } }, t(n === 1 ? 'timer.done1' : 'timer.donen', { n, e: pomo.getSettings().every })) : null, sr));
}
