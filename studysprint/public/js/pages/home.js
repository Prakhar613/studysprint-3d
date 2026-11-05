import { h, api, state, fmtIST, countdown, subjectById, skeleton, ago, mmss } from '../lib.js';
import { timerCard } from '../timerui.js';
import { t, subjName, subjBlurb } from '../i18n.js';

const TOPICS = [['nobel', 'topic.nobel'], ['science', 'topic.science'], ['current', 'topic.current'], ['space', 'topic.space']];
const STOPS = [['s-hero', 'stop.start'], ['s-focus', 'stop.focus'], ['s-subjects', 'stop.subjects'], ['s-speed', 'stop.speed'],
  ['s-compete', 'stop.compete'], ['s-news', 'stop.news'], ['s-numbers', 'stop.numbers'], ['s-go', 'stop.go']];

const em = (txt) => h('em', {}, txt);
const rv = (i = 0, extra = '') => ({ class: `reveal ${extra}`.trim(), style: `--i:${i}` });
const chapLabel = (n, key) => h('p', { class: 'chap-n' }, h('b', {}, String(n).padStart(2, '0')), t(key));

/** The speed bonus drawn as a real curve: 150 points at 0 s falling to 100 at the deadline of a 30 s question. */
function chart() {
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg class="chart" viewBox="0 0 540 300">
    <defs>
      <linearGradient id="curveGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd08a"/><stop offset="1" stop-color="#e5532d"/></linearGradient>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".4"/><stop offset="1" stop-color="#e5532d" stop-opacity="0"/></linearGradient>
    </defs>
    <line class="gl" x1="56" x2="516" y1="40" y2="40"/><line class="gl" x1="56" x2="516" y1="140" y2="140"/>
    <line class="gl" x1="286" x2="286" y1="30" y2="240"/><line class="gl" x1="516" x2="516" y1="30" y2="240"/>
    <line class="axis" x1="56" x2="516" y1="240" y2="240"/><line class="axis" x1="56" x2="56" y1="30" y2="240"/>
    <path class="area" d="M56 40 L516 240 L56 240 Z"/>
    <path class="curve" pathLength="1" d="M56 40 L516 240"/>
    <circle class="pt" cx="56" cy="40" r="5"/><circle class="pt" cx="286" cy="140" r="5"/><circle class="pt" cx="516" cy="240" r="5"/>
    <text x="44" y="44" text-anchor="end">150</text><text x="44" y="144" text-anchor="end">125</text><text x="44" y="244" text-anchor="end">100</text>
    <text x="56" y="262" text-anchor="middle">0 s</text><text x="286" y="262" text-anchor="middle">15 s</text><text x="516" y="262" text-anchor="middle">30 s</text>
    <text class="lbl" id="c-bonus" x="72" y="32"></text>
    <text class="lbl" id="c-base" x="70" y="230"></text>
    <text id="c-cap" x="286" y="290" text-anchor="middle"></text>
  </svg>`;
  const svg = tpl.content.firstElementChild;
  svg.querySelector('#c-bonus').textContent = t('chart.bonus');
  svg.querySelector('#c-base').textContent = t('chart.base');
  svg.querySelector('#c-cap').textContent = t('chart.cap');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${t('chart.cap')}: 150 → 100`);
  return svg;
}

/** Pinned readout: the whole page is one 25 minute sprint, and scrolling spends it. */
function mountHud(ctx) {
  const hud = document.getElementById('hud');
  if (!hud) return;
  const read = h('b', {}, '00:00');
  const lis = STOPS.map(([id, key]) => h('li', {}, h('span', {}, t(key)), h('i')));
  hud.replaceChildren(h('span', { class: 'read' }, t('hud.sprint'), read), h('ul', { class: 'stops' }, lis));
  const els = STOPS.map(([id]) => document.getElementById(id));
  const upd = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const f = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    read.textContent = mmss(Math.round(f * 25 * 60) * 1000);
    let cur = 0;
    els.forEach((el, i) => { if (el && el.getBoundingClientRect().top < innerHeight * 0.45) cur = i; });
    lis.forEach((li, i) => { li.classList.toggle('on', i === cur); li.classList.toggle('past', i < cur); });
  };
  addEventListener('scroll', upd, { passive: true });
  addEventListener('resize', upd);
  ctx.onCleanup(() => { removeEventListener('scroll', upd); removeEventListener('resize', upd); hud.replaceChildren(); });
  upd();
}

export default async function home(ctx) {
  const subjects = state.meta.subjects;
  const total = subjects.reduce((n, s) => n + s.questions, 0);
  const maxQ = Math.max(1, ...subjects.map((s) => s.questions));

  // ---- data-driven pieces (load after first paint) ----
  const newsBox = h('div', {}, skeleton(4));
  const contestBox = h('div', { class: 'cards', style: 'margin-top:1.2rem;grid-template-columns:1fr' }, skeleton(3));
  const boardBox = h('div', {}, skeleton(3));
  let tab = 'nobel';
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': t('ch.news.b') });
  const paintChips = () => chips.replaceChildren(...TOPICS.map(([id, key]) =>
    h('button', { class: 'chip', 'aria-pressed': String(tab === id), onclick: () => { tab = id; paintChips(); loadNews(); } }, t(key))));

  async function loadNews() {
    newsBox.replaceChildren(skeleton(4));
    try {
      const d = await api(`/api/news?topic=${tab}`);
      const sources = h('ul', { class: 'list' }, d.sources.map((s) => h('li', {}, h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title))));
      if (!d.items.length) {
        newsBox.replaceChildren(h('div', { class: 'panel' }, h('p', {}, t('news.fail')), sources));
        return;
      }
      newsBox.replaceChildren(
        d.stale ? h('p', { class: 'note small' }, t('news.stale')) : null,
        h('ul', { class: 'news' }, d.items.slice(0, 8).map((n) => h('li', {},
          h('a', { href: n.url, target: '_blank', rel: 'noopener noreferrer' }, h('strong', {}, n.title)),
          h('div', { class: 'small muted' }, [n.source, n.time ? ago(n.time) : ''].filter(Boolean).join(', ')),
          n.summary ? h('div', { class: 'small' }, n.summary) : null))),
        h('details', {}, h('summary', { class: 'small' }, t('news.src')), sources));
    } catch (e) { newsBox.replaceChildren(h('p', { class: 'err' }, e.message)); }
  }

  async function loadSide() {
    try {
      const c = await api('/api/contests');
      const items = c.contests.slice(0, 4);
      const tick = () => items.forEach((it, i) => {
        const el = contestBox.querySelector(`[data-c="${i}"]`);
        if (!el) return;
        const left = it.start - (Date.now() + state.offset);
        el.textContent = left > 0 ? t('comp.starts', { t: countdown(left) }) : it.status === 'live' ? t('comp.live') : t('comp.closed');
      });
      contestBox.replaceChildren(...items.map((it, i) => {
        const s = subjectById(it.subject);
        return h('div', rv(i), h('a', { class: 'cc', href: `#/contest/${it.id}`, style: `--c:${s.color}` },
          h('strong', {}, t('comp.contest', { s: subjName(s) })), h('div', { class: 'when' }, fmtIST(it.start)), h('div', { class: 'cd', 'data-c': i })));
      }));
      if (!items.length) contestBox.replaceChildren(h('p', { class: 'muted' }, t('comp.err')));
      tick();
      ctx.every(1000, tick);
      contestBox.querySelectorAll('.reveal').forEach((n) => n.classList.add('in'));
    } catch { contestBox.replaceChildren(h('p', { class: 'muted' }, t('comp.err'))); }
    try {
      const b = await api('/api/leaderboard?scope=quiz&period=week');
      boardBox.replaceChildren(b.rows.length
        ? h('ol', { class: 'board' }, b.rows.slice(0, 5).map((r) => h('li', {},
          h('span', { class: 'r' }, String(r.rank).padStart(2, '0')),
          h('span', {}, h('strong', {}, r.username), ' ', h('span', { class: 'muted small' }, r.state)),
          h('span', { class: 's' }, r.score))))
        : h('p', { class: 'muted' }, t('comp.none')));
    } catch { boardBox.replaceChildren(h('p', { class: 'muted' }, t('comp.errb'))); }
  }

  paintChips();
  loadNews();
  loadSide();
  requestAnimationFrame(() => mountHud(ctx));

  // ---- layout ----
  const hero = h('section', { id: 's-hero', class: 'h-hero' },
    h('div', { class: 'wrap' },
      h('div', {},
        h('p', { class: 'eyebrow' }, t('home.eyebrow')),
        h('h1', { class: 'display' }, t('home.h1a'), ' ', em(t('home.h1b'))),
        h('p', { class: 'lede' }, t('home.lede')),
        h('div', { class: 'row' },
          h('a', { class: 'btn primary', href: '#/quiz' }, t('home.cta1')),
          h('a', { class: 'btn', href: '#/contests' }, t('home.cta2'))),
        h('p', { class: 'hero-meta' }, t('home.meta', { n: total.toLocaleString('en-IN'), s: subjects.length })),
        h('p', { class: 'hero-meta hint' }, t('home.drag'))),
      timerCard(ctx, { compact: true })),
    h('div', { class: 'cue', 'aria-hidden': 'true' }, h('span', {}, t('home.scroll')), h('i')));

  const focus = h('section', { id: 's-focus', class: 'chap' }, h('div', { class: 'wrap' },
    h('div', rv(), chapLabel(1, 'stop.focus')),
    h('div', { class: 'split side' },
      h('div', {},
        h('div', rv(1), h('h2', { class: 'statement' }, t('ch.focus.a'), ' ', em(t('ch.focus.b'))), h('p', {}, t('ch.focus.p'))),
        h('ul', { class: 'rules', style: 'margin-top:2rem' }, [1, 2, 3].map((n) => h('li', rv(n + 1), h('div', {}, h('strong', {}, t(`rule${n}.t`)), h('span', {}, t(`rule${n}.d`))))))),
      h('div', { class: 'void', 'aria-hidden': 'true' }))));

  const subjectsSec = h('section', { id: 's-subjects', class: 'chap' }, h('div', { class: 'wrap' },
    h('div', rv(), chapLabel(2, 'stop.subjects')),
    h('div', { class: 'split side' },
      h('div', {},
        h('div', rv(1), h('h2', { class: 'statement' }, t('ch.subj.a', { n: subjects.length }), ' ', em(t('ch.subj.b'))), h('p', {}, t('ch.subj.p'))),
        h('div', { class: 'strata' }, subjects.map((s, i) => h('div', rv(i), h('a', {
          class: 'layer', href: `#/quiz?subject=${encodeURIComponent(s.id)}`, 'data-sid': s.id, style: `--c:${s.color};--w:${(s.questions / maxQ).toFixed(3)}`,
        },
        h('span', { class: 'n' }, String(i + 1).padStart(2, '0')),
        h('span', {}, h('span', { class: 'name' }, subjName(s)), h('span', { class: 'blurb' }, subjBlurb(s))),
        h('span', { class: 'q' }, t('quiz.nq', { n: s.questions })),
        h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'),
        h('span', { class: 'bar' })))))),
      h('div', { class: 'void', 'aria-hidden': 'true' }))));

  const speed = h('section', { id: 's-speed', class: 'chap' }, h('div', { class: 'wrap' },
    h('div', rv(), chapLabel(3, 'stop.speed')),
    h('div', { class: 'split' },
      h('div', rv(1), h('h2', { class: 'statement' }, t('ch.speed.a'), ' ', em(t('ch.speed.b'))), h('p', {}, t('ch.speed.p')),
        h('ul', { class: 'facts' }, h('li', {}, t('speed.f1')), h('li', {}, t('speed.f2')))),
      h('div', rv(2, 'panel'), chart()))));

  const compete = h('section', { id: 's-compete', class: 'chap' }, h('div', { class: 'wrap' },
    h('div', rv(), chapLabel(4, 'stop.compete')),
    h('div', rv(1), h('h2', { class: 'statement' }, t('ch.comp.a'), ' ', em(t('ch.comp.b'))), h('p', {}, t('ch.comp.p'))),
    h('div', { class: 'split', style: 'margin-top:2.5rem' },
      h('div', {}, h('h3', {}, t('comp.next'), ' ', h('a', { class: 'small', href: '#/contests' }, t('comp.all'))), contestBox),
      h('div', rv(1), h('h3', {}, t('comp.top'), ' ', h('a', { class: 'small', href: '#/leaderboard' }, t('comp.full'))), h('div', { class: 'panel', style: 'margin-top:1.2rem' }, boardBox)))));

  const news = h('section', { id: 's-news', class: 'chap' }, h('div', { class: 'wrap' },
    h('div', rv(), chapLabel(5, 'stop.news')),
    h('div', rv(1), h('h2', { class: 'statement' }, t('ch.news.a'), ' ', em(t('ch.news.b')))),
    h('div', { style: 'max-width:820px' }, chips, newsBox)));

  const numbers = h('section', { id: 's-numbers', class: 'chap' }, h('div', { class: 'wrap' },
    h('div', rv(), chapLabel(6, 'stop.numbers')),
    h('h2', rv(1, 'statement'), t('num.title')),
    h('div', rv(2, 'nums'),
      [[total, 'num.q'], [subjects.length, 'num.s'], [25, 'num.m'], [150, 'num.p']].map(([n, key]) =>
        h('div', {}, h('b', { 'data-count': String(n) }, n.toLocaleString('en-IN')), h('span', {}, t(key)))))));

  const end = h('section', { id: 's-go', class: 'chap core' }, h('div', { class: 'wrap' },
    h('p', rv(0, 'eyebrow'), t('end.eyebrow')),
    h('h2', rv(1, 'statement'), t('end.a'), ' ', em(t('end.b'))),
    h('p', rv(2), t('end.p')),
    h('div', rv(3, 'row'),
      h('a', { class: 'btn primary', href: '#/focus' }, t('end.cta1')),
      h('a', { class: 'btn', href: '#/quiz' }, t('home.cta1')))));

  return h('div', { class: 'home' }, hero, focus, subjectsSec, speed, compete, news, numbers, end);
}
