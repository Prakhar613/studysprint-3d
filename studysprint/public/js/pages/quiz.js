import { h, api, state, go } from '../lib.js';
import { needLogin } from '../auth.js';
import { t, subjName, subjBlurb } from '../i18n.js';

export default function quiz(ctx) {
  let subject = ctx.query.subject || '';
  let count = 10, seconds = 30;
  const subjBox = h('div', { class: 'subj', role: 'group', 'aria-label': t('quiz.subject') });
  const startBtn = h('button', { class: 'btn primary', onclick: begin }, t('quiz.start'));
  const err = h('p', { class: 'err', role: 'alert', hidden: true });

  const paint = () => {
    subjBox.replaceChildren(...state.meta.subjects.map((s) => h('button', { 'aria-pressed': String(subject === s.id), style: { borderLeftColor: s.color }, onclick: () => { subject = s.id; paint(); } },
      h('strong', {}, subjName(s)), h('span', { class: 'small muted' }, `${subjBlurb(s)}. ${t('quiz.nq', { n: s.questions })}`))));
    startBtn.disabled = !subject;
  };
  const choice = (label, opts, get, set) => h('div', { class: 'field' }, h('label', {}, label),
    h('div', { class: 'chips', role: 'group', 'aria-label': label }, opts.map(([v, tx]) => h('button', { class: 'chip', 'aria-pressed': String(get() === v), onclick: (e) => { set(v); e.currentTarget.parentNode.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); } }, tx))));

  function begin() {
    needLogin(async () => {
      err.hidden = true; startBtn.disabled = true;
      try {
        const r = await api('/api/quiz/start', { method: 'POST', body: { subject, count, seconds } });
        go(`#/quiz/play/${r.attemptId}`);
      } catch (e) { err.textContent = e.message; err.hidden = false; startBtn.disabled = false; }
    });
  }
  paint();
  return h('div', {},
    h('h1', {}, t('quiz.title')),
    h('p', {}, t('quiz.intro')),
    h('div', { class: 'field' }, h('label', {}, t('quiz.subject')), subjBox),
    h('div', { class: 'row', style: { alignItems: 'start' } },
      choice(t('quiz.count'), [[5, '5'], [10, '10'], [15, '15']], () => count, (v) => { count = v; }),
      choice(t('quiz.secs'), [[20, '20'], [30, '30'], [45, '45'], [60, '60']], () => seconds, (v) => { seconds = v; })),
    err, startBtn);
}
