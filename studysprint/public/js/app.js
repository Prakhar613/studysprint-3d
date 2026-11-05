import { h, api, state, errorBox, skeleton, subjectById } from './lib.js';
import { loadMe, openAuth, logout } from './auth.js';
import * as pomo from './pomodoro.js';
import { t, getLang, setLang, applyI18n, subjName } from './i18n.js';
import { initFx, scan, refresh, setBackground2D } from './fx.js';
import { initScene, THEME_ORDER } from './scene3d.js';

// ---- colour theme (ember / aurora / nebula) and the 3D world ----
let scene = null;
const THEME_KEY = 'ss_theme';
const THEME_BAR = { ember: '#0c0907', aurora: '#050c09', nebula: '#080611' };
function savedTheme() {
  try { const s = localStorage.getItem(THEME_KEY); if (THEME_ORDER.includes(s)) return s; } catch { /* ignore */ }
  return 'ember';
}
function applyTheme(name) {
  document.documentElement.dataset.theme = name;
  try { localStorage.setItem(THEME_KEY, name); } catch { /* ignore */ }
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', THEME_BAR[name]);
  if (scene) scene.setTheme(name);
}
applyTheme(savedTheme());

const app = document.getElementById('app');
const ROUTES = [
  ['', 'home'], ['focus', 'focus'], ['quiz', 'quiz'], ['quiz/play/:id', 'play'],
  ['contests', 'contests'], ['contest/:id', 'contest'], ['leaderboard', 'leaderboard'],
  ['chat', 'chat'], ['chat/:room', 'chat'], ['doubts', 'doubts'], ['doubts/:id', 'doubt'],
  ['research', 'research'], ['library', 'library'], ['me', 'me'],
].map(([path, page]) => {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  return { re, keys, page };
});

let cleanups = [];
let navToken = 0;

function parse() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { path: path.replace(/\/$/, ''), query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

async function route() {
  const token = ++navToken;
  cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  cleanups = [];
  const { path, query } = parse();
  document.body.classList.toggle('route-home', path === '');
  const hit = ROUTES.map((r) => ({ r, m: r.re.exec(path) })).find((x) => x.m);
  const ctx = {
    query,
    params: hit ? Object.fromEntries(hit.r.keys.map((k, i) => [k, decodeURIComponent(hit.m[i + 1])])) : {},
    onCleanup: (fn) => cleanups.push(fn),
    every: (ms, fn) => { const tm = setInterval(fn, ms); cleanups.push(() => clearInterval(tm)); return tm; },
  };
  const top = path.split('/')[0];
  document.querySelectorAll('#nav a').forEach((a) => {
    if (a.dataset.r === top) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  app.replaceChildren(skeleton(4));
  try {
    if (!hit) {
      app.replaceChildren(h('div', { class: 'panel' }, h('h1', {}, t('nf.title')), h('p', {}, t('nf.body')), h('a', { class: 'btn primary', href: '#/' }, t('nf.home'))));
      return;
    }
    const mod = await import(`./pages/${hit.r.page}.js`);
    const node = await mod.default(ctx);
    if (token !== navToken) return; // student navigated away while this page was loading
    app.replaceChildren(node);
    window.scrollTo(0, 0);
    scan(app);
    refresh();
    if (scene) scene.setRoute(path === '');
    const title = node.querySelector?.('h1')?.textContent;
    document.title = title ? `${title} · StudySprint` : 'StudySprint India';
  } catch (e) {
    if (token !== navToken) return;
    app.replaceChildren(errorBox(e), h('button', { class: 'btn', onclick: route }, t('common.retry')));
  }
}

function renderUser() {
  const box = document.getElementById('userbox');
  const u = state.user;
  box.replaceChildren(...(u
    ? [h('a', { class: 'btn small ghost', href: '#/me' }, u.username), h('button', { class: 'btn small', onclick: logout }, t('auth.logout'))]
    : [h('button', { class: 'btn small', onclick: () => openAuth('login') }, t('auth.login')), h('button', { class: 'btn small primary', onclick: () => openAuth('register') }, t('auth.signup'))]));
}

function renderPill() {
  const pill = document.getElementById('pomo-pill');
  const r = pomo.getRun();
  if (!r) { pill.hidden = true; return; }
  const secs = Math.ceil(pomo.remaining() / 1000);
  pill.hidden = false;
  pill.textContent = `${r.phase === 'focus' ? t('pill.focus') : t('pill.break')} ${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}${r.paused != null ? ` (${t('pill.paused')})` : ''}`;
}

async function boot() {
  applyI18n();
  initFx();
  document.getElementById('lang').addEventListener('click', () => setLang(getLang() === 'en' ? 'hi' : 'en'));
  document.querySelectorAll('.js-theme').forEach((b) => b.addEventListener('click', () => {
    const i = THEME_ORDER.indexOf(document.documentElement.dataset.theme);
    applyTheme(THEME_ORDER[(i + 1) % THEME_ORDER.length]);
  }));
  window.addEventListener('scenefail', () => { scene = null; setBackground2D(true); });
  window.addEventListener('langchange', () => {
    renderUser();
    renderPill();
    if (scene) scene.refreshLabels();
    // Do not rebuild a quiz or contest that is in progress; its text updates on the next screen.
    if (!/^(quiz\/play|contest\/)/.test(parse().path)) route();
  });
  try {
    state.meta = await api('/api/meta');
  } catch (e) {
    app.replaceChildren(errorBox(e), h('button', { class: 'btn', onclick: () => location.reload() }, t('common.reload')));
    return;
  }
  // The 3D world loads in the background; the page is usable before (or without) it.
  initScene({
    subjects: state.meta.subjects,
    themeName: document.documentElement.dataset.theme,
    labelFn: (id) => { const s = subjectById(id); return s ? { name: subjName(s), count: t('quiz.nq', { n: s.questions }) } : {}; },
  }).then((ctl) => {
    if (!ctl) return;
    scene = ctl;
    document.documentElement.classList.add('gl');
    setBackground2D(false);
    scene.setRoute(parse().path === '');
  }).catch(() => { /* keep the 2D background */ });
  await loadMe();
  pomo.subscribe(renderPill);
  renderPill();
  window.addEventListener('hashchange', route);
  let first = true;
  window.addEventListener('authchange', () => { renderUser(); if (!first) route(); });
  renderUser();
  first = false;
  route();
}
boot();
