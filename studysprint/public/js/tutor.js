// AI tutor: one shared conversation, shown in two places (the floating dock on every page and the full page at #/tutor).
// All text is built with h() / textContent, so model output can never inject HTML (the site's CSP is strict).
import { h, api, state, selectEl } from './lib.js';
import { t, subjName, getLang } from './i18n.js';
import { openAuth } from './auth.js';
import * as pomo from './pomodoro.js';

const KEY = 'ss_tutor_v1';
const MAX_KEPT = 30;
const MODES = ['explain', 'doubt', 'quiz', 'plan', 'notes', 'mistakes'];
const SEND_NOW = new Set(['quiz', 'mistakes']); // these start straight away; the others wait for the student's topic
const LANGS = ['auto', 'en', 'hi', 'hinglish'];

// ---------------------------------------------------------------- controller
const ctl = { messages: [], busy: false, subject: '', lang: 'auto', mode: 'free', status: null, draft: '', truncated: false, error: '' };
let owner = null;
let abort = null;
const subs = new Set();

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && Array.isArray(saved.messages)) {
    owner = saved.uid ?? null;
    ctl.messages = saved.messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-MAX_KEPT);
    if (LANGS.includes(saved.lang)) ctl.lang = saved.lang;
    if (typeof saved.subject === 'string') ctl.subject = saved.subject;
    if (MODES.includes(saved.mode)) ctl.mode = saved.mode;
  }
} catch { /* storage blocked or corrupt: start fresh */ }

function save() {
  try {
    const messages = ctl.messages.filter((m) => m.content).slice(-MAX_KEPT);
    localStorage.setItem(KEY, JSON.stringify({ uid: owner, messages, lang: ctl.lang, subject: ctl.subject, mode: ctl.mode }));
  } catch { /* ignore */ }
}

const emit = (kind = 'struct') => {
  for (const fn of subs) fn(kind);
  if (kind === 'struct') ctl.draft = ''; // a draft is handed to every view once, then forgotten
};
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

function resetChat() {
  if (abort) abort.abort();
  ctl.messages = [];
  ctl.mode = 'free';
  ctl.draft = '';
  ctl.error = '';
  ctl.truncated = false;
  ctl.busy = false;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  save();
  emit();
}

async function refreshStatus() {
  try { ctl.status = await api('/api/tutor/status'); } catch { ctl.status = null; }
  emit();
}

/** A different student (or a logged-out browser) must never see the previous student's chat. */
function syncOwner() {
  const uid = state.user ? state.user.id : null;
  if (owner !== uid) {
    owner = uid;
    resetChat();
  }
}

async function send(text, mode = ctl.mode) {
  text = String(text || '').trim();
  if (!text || ctl.busy) return;
  if (!state.user) { openAuth('login'); return; }
  if (ctl.status && !ctl.status.enabled) return;

  const history = [...ctl.messages, { role: 'user', content: text }].slice(-12);
  ctl.messages.push({ role: 'user', content: text }, { role: 'assistant', content: '' });
  ctl.busy = true;
  ctl.error = '';
  ctl.draft = '';
  ctl.truncated = false;
  emit();

  const run = pomo.getRun();
  abort = new AbortController();
  const mine = abort;
  const bot = ctl.messages[ctl.messages.length - 1];
  try {
    const res = await fetch('/api/tutor/chat', {
      method: 'POST',
      credentials: 'same-origin',
      signal: mine.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: history,
        mode,
        lang: ctl.lang,
        subject: ctl.subject || (run && run.subject && run.subject !== 'general' ? run.subject : ''),
        pomodoro: run ? { phase: run.phase, minutesLeft: pomo.remaining() / 60000 } : undefined,
      }),
    });
    if (!res.ok) {
      let msg = '';
      try { msg = (await res.json()).error; } catch { /* not JSON */ }
      throw new Error(msg || 'The tutor is not available right now. Please try again.');
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        let ev;
        try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.error) throw new Error(ev.error);
        if (ev.t) { bot.content += ev.t; emit('chunk'); }
        if (ev.done) {
          ctl.truncated = !!ev.truncated;
          if (ctl.status && typeof ev.left === 'number') ctl.status.left = ev.left;
        }
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') ctl.error = e.message || 'Something went wrong. Please try again.';
  } finally {
    if (abort === mine) {
      ctl.busy = false;
      abort = null;
      // Nothing came back: take the exchange out and give the question back to the student to resend.
      if (!bot.content && ctl.messages[ctl.messages.length - 1] === bot) {
        ctl.messages.splice(-2, 2);
        if (ctl.error) ctl.draft = text;
      }
      save();
      emit();
    }
  }
}

function stop() { if (abort) abort.abort(); }

function pickMode(m) {
  if (ctl.busy) return;
  if (ctl.mode === m) { ctl.mode = 'free'; save(); emit(); return; }
  ctl.mode = m;
  save();
  if (SEND_NOW.has(m)) {
    const s = state.meta?.subjects.find((x) => x.id === ctl.subject);
    send(t(`tutor.p.${m}`, { s: s ? subjName(s) : t('tutor.subject.any').toLowerCase() }), m);
  } else {
    ctl.draft = t(`tutor.p.${m}`);
    emit();
    emit('focus');
  }
}

// ---------------------------------------------------------------- safe Markdown (bold, code, lists, headings)
function inline(text) {
  const out = [];
  const re = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(tok[0] === '`' ? h('code', {}, tok.slice(1, -1)) : h('strong', {}, tok.slice(2, -2)));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderMd(src) {
  const root = h('div', { class: 'md' });
  src.split('```').forEach((part, i) => {
    if (i % 2) {
      root.append(h('pre', {}, h('code', {}, part.replace(/^[^\n]*\n/, '').replace(/\n+$/, ''))));
      return;
    }
    let para = [];
    let list = null;
    const flushPara = () => { if (para.length) { root.append(h('p', {}, inline(para.join(' ')))); para = []; } };
    const flushList = () => { if (list) { root.append(list); list = null; } };
    for (const raw of part.split('\n')) {
      const line = raw.trimEnd();
      let m;
      if (!line.trim()) { flushPara(); flushList(); continue; }
      if ((m = /^\s*#{1,4}\s+(.*)$/.exec(line))) { flushPara(); flushList(); root.append(h('p', { class: 'md-h' }, h('strong', {}, inline(m[1])))); continue; }
      if ((m = /^\s*[-*•]\s+(.*)$/.exec(line))) {
        flushPara();
        if (!list || list.tagName !== 'UL') { flushList(); list = h('ul'); }
        list.append(h('li', {}, inline(m[1])));
        continue;
      }
      if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
        flushPara();
        if (!list || list.tagName !== 'OL') { flushList(); list = h('ol'); }
        list.append(h('li', {}, inline(m[1])));
        continue;
      }
      flushList();
      para.push(line.trim());
    }
    flushPara();
    flushList();
  });
  return root;
}

// ---------------------------------------------------------------- views
let speakingBtn = null;
function listen(text, btn) {
  if (!('speechSynthesis' in window)) return;
  const wasThis = speakingBtn === btn;
  speechSynthesis.cancel();
  if (speakingBtn) { speakingBtn.textContent = t('tutor.listen'); speakingBtn = null; }
  if (wasThis) return;
  const plain = text.replace(/[*`#]/g, '');
  const u = new SpeechSynthesisUtterance(plain);
  u.lang = /[ऀ-ॿ]/.test(plain) ? 'hi-IN' : 'en-IN';
  u.onend = u.onerror = () => { if (speakingBtn === btn) { btn.textContent = t('tutor.listen'); speakingBtn = null; } };
  speakingBtn = btn;
  btn.textContent = t('tutor.listening');
  speechSynthesis.speak(u);
}

const FOLLOWUPS = ['simpler', 'example', 'quiz'];

/** Build one chat view. `page` = full page (h1, bigger), otherwise the compact dock panel. */
export function buildView({ page = false, onClose = null } = {}) {
  const log = h('div', { class: 'tutor-log', role: 'log', 'aria-live': 'polite', 'aria-label': t('tutor.title') });
  const chips = h('div', { class: 'tutor-modes' });
  const foot = h('div', { class: 'tutor-foot muted small' });
  const bottom = h('div', { class: 'tutor-bottom' });
  const input = h('textarea', { class: 'tutor-input', rows: 1, maxlength: 1500, placeholder: t('tutor.ph'), 'aria-label': t('tutor.ph') });
  const sendBtn = h('button', { class: 'btn primary', type: 'submit' }, t('tutor.send'));
  const stopBtn = h('button', { class: 'btn', type: 'button', onclick: stop }, t('tutor.stop'));
  // Voice typing (Web Speech API: Chrome, Edge, Safari). Hidden where the browser does not support it.
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  const mic = SR ? h('button', { class: 'btn ghost tutor-mic', type: 'button', 'aria-pressed': 'false', 'aria-label': t('tutor.mic'), title: t('tutor.mic') }, '🎤') : null;
  const micLang = () => ((ctl.lang === 'auto' ? getLang() : ctl.lang) === 'en' ? 'en-IN' : 'hi-IN');
  function stopMic() { if (rec) { try { rec.stop(); } catch { /* already stopped */ } } }
  function micUi(on) {
    if (!mic) return;
    mic.setAttribute('aria-pressed', String(on));
    mic.setAttribute('aria-label', on ? t('tutor.mic.stop') : t('tutor.mic'));
    mic.title = on ? t('tutor.mic.stop') : t('tutor.mic');
    mic.classList.toggle('on', on);
    input.placeholder = on ? t('tutor.mic.on') : t('tutor.ph');
  }
  function startMic() {
    if (!state.user) { openAuth('login'); return; }
    if (ctl.busy) return;
    if ('speechSynthesis' in window) speechSynthesis.cancel(); // do not let Sprint's voice feed back into the mic
    const r = new SR();
    rec = r;
    r.lang = micLang();
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    const base = input.value.trim();
    r.onresult = (e) => {
      let said = '';
      for (const res of e.results) said += res[0].transcript;
      input.value = (base ? `${base} ` : '') + said.trim();
      grow();
    };
    r.onerror = (e) => {
      const key = { 'not-allowed': 'denied', 'service-not-allowed': 'denied', 'no-speech': 'none', network: 'net', 'audio-capture': 'nomic' }[e.error];
      if (e.error !== 'aborted') { ctl.error = t(`tutor.mic.${key || 'fail'}`); emit(); }
    };
    r.onend = () => { if (rec === r) rec = null; micUi(false); input.focus(); };
    try { ctl.error = ''; r.start(); micUi(true); } catch { rec = null; micUi(false); }
  }
  if (mic) mic.addEventListener('click', () => (rec ? stopMic() : startMic()));

  const form = h('form', { class: 'tutor-form', onsubmit: (e) => { e.preventDefault(); stopMic(); const v = input.value; input.value = ''; grow(); send(v); } }, input, mic, sendBtn, stopBtn);
  const head = h('header', { class: 'tutor-h' });
  const root = h('section', { class: `tutor${page ? ' page' : ' compact'}`, 'aria-label': t('tutor.title') }, head, log, chips, bottom);

  function grow() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 140)}px`; }
  input.addEventListener('input', grow);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });

  const nearBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 90;
  const toBottom = () => { log.scrollTop = log.scrollHeight; };

  function botBody(m, last) {
    if (!m.content) return h('div', { class: 'typing', role: 'status', 'aria-label': t('tutor.thinking') }, h('i'), h('i'), h('i'));
    const body = renderMd(m.content);
    if (last && ctl.busy) body.classList.add('live');
    return body;
  }

  function msgNode(m, i) {
    const last = i === ctl.messages.length - 1;
    if (m.role === 'user') return h('div', { class: 'tmsg user' }, h('div', { class: 'tbody' }, m.content));
    const node = h('div', { class: 'tmsg bot' }, h('div', { class: 'tbody' }, botBody(m, last)));
    if (m.content && !(last && ctl.busy)) {
      const copy = h('button', { class: 'tact', type: 'button' }, t('tutor.copy'));
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(m.content); copy.textContent = t('tutor.copied'); setTimeout(() => { copy.textContent = t('tutor.copy'); }, 1400); } catch { /* clipboard blocked */ }
      });
      const acts = h('div', { class: 'tacts' }, copy);
      if ('speechSynthesis' in window) {
        const ls = h('button', { class: 'tact', type: 'button' }, t('tutor.listen'));
        ls.addEventListener('click', () => listen(m.content, ls));
        acts.append(ls);
      }
      node.append(acts);
    }
    return node;
  }

  function followups() {
    const lastMsg = ctl.messages[ctl.messages.length - 1];
    if (ctl.busy || !lastMsg || lastMsg.role !== 'assistant' || !lastMsg.content) return null;
    const row = h('div', { class: 'tutor-follow' });
    if (ctl.truncated) row.append(h('span', { class: 'muted small' }, t('tutor.cut')), h('button', { class: 'chip', type: 'button', onclick: () => send(t('tutor.p.f.more')) }, t('tutor.f.more')));
    for (const f of FOLLOWUPS) row.append(h('button', { class: 'chip', type: 'button', onclick: () => send(t(`tutor.p.f.${f}`)) }, t(`tutor.f.${f}`)));
    return row;
  }

  function renderHead() {
    const subjects = state.meta?.subjects || [];
    const subj = selectEl([['', t('tutor.subject.any')], ...subjects.map((s) => [s.id, subjName(s)])], ctl.subject, { 'aria-label': t('tutor.subject'), class: 'tutor-sel' });
    subj.addEventListener('change', () => { ctl.subject = subj.value; save(); });
    const lang = selectEl(LANGS.map((l) => [l, t(`tutor.lang.${l}`)]), ctl.lang, { 'aria-label': t('tutor.lang'), class: 'tutor-sel' });
    lang.addEventListener('change', () => { ctl.lang = lang.value; save(); });
    const title = page
      ? h('div', {}, h('h1', {}, t('tutor.title')), h('p', { class: 'muted' }, t('tutor.sub')))
      : h('div', { class: 'tutor-title' }, h('span', { class: 'tutor-dot', 'aria-hidden': 'true' }), h('strong', {}, t('tutor.title')));
    const tools = h('div', { class: 'tutor-tools' }, subj, lang,
      h('button', { class: 'btn small ghost', type: 'button', onclick: resetChat }, t('tutor.clear')),
      onClose ? h('button', { class: 'btn small ghost', type: 'button', 'aria-label': t('tutor.close'), onclick: onClose }, '✕') : null);
    head.replaceChildren(title, tools);
  }

  function renderChips() {
    chips.replaceChildren(...MODES.map((m) => h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(ctl.mode === m), disabled: ctl.busy, onclick: () => pickMode(m),
    }, t(`tutor.m.${m}`))));
  }

  function renderBottom() {
    const s = ctl.status;
    let main;
    if (s && !s.enabled) main = h('p', { class: 'err' }, t('tutor.off'));
    else if (!state.user) main = h('div', { class: 'tutor-login' }, h('p', { class: 'muted' }, t('tutor.login')), h('button', { class: 'btn primary', type: 'button', onclick: () => openAuth('login') }, t('auth.login')));
    else main = form;
    sendBtn.hidden = ctl.busy;
    stopBtn.hidden = !ctl.busy;
    sendBtn.disabled = false;
    foot.replaceChildren(...[
      ctl.error ? h('span', { class: 'err', role: 'alert' }, ctl.error) : null,
      state.user && s && s.enabled && typeof s.left === 'number' ? h('span', {}, t('tutor.left', { n: s.left })) : null,
      h('span', {}, t('tutor.note')),
    ].filter(Boolean)); // replaceChildren turns null into the text "null", so empty slots must be dropped
    bottom.replaceChildren(main, foot);
  }

  function renderLog() {
    const stick = nearBottom();
    const nodes = ctl.messages.length
      ? ctl.messages.map(msgNode)
      : [h('div', { class: 'tmsg bot' }, h('div', { class: 'tbody' }, h('p', {}, t('tutor.hello'))))];
    const f = followups();
    if (f) nodes.push(f);
    log.replaceChildren(...nodes);
    if (stick) toBottom();
  }

  let raf = 0;
  const unsub = subscribe((kind) => {
    if (kind === 'chunk') {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; renderLog(); });
      return;
    }
    if (kind === 'focus') { input.focus(); input.setSelectionRange(input.value.length, input.value.length); return; }
    if (ctl.busy) stopMic();
    renderHead(); renderChips(); renderLog(); renderBottom();
    if (ctl.draft) input.value = ctl.draft;
    grow();
  });
  root.cleanup = () => { unsub(); stopMic(); };

  renderHead(); renderChips(); renderLog(); renderBottom();
  if (ctl.draft) input.value = ctl.draft;
  queueMicrotask(toBottom);
  root.focusInput = () => input.focus();
  return root;
}

// ---------------------------------------------------------------- floating dock (every page except #/tutor)
export function initTutorDock() {
  if (document.getElementById('tutor-dock')) return;
  const fab = h('button', { id: 'tutor-fab', class: 'tutor-fab', type: 'button', 'aria-label': t('tutor.open'), 'aria-expanded': 'false', 'aria-controls': 'tutor-panel' },
    h('span', { 'aria-hidden': 'true' }, '✦'), h('span', { class: 'tutor-fab-t' }, t('nav.tutor')));
  const panel = h('div', { id: 'tutor-panel', class: 'tutor-panel', hidden: true, role: 'dialog', 'aria-label': t('tutor.title') });
  const dock = h('div', { id: 'tutor-dock' }, panel, fab);
  document.body.append(dock);

  let view = null;
  const close = () => { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); fab.focus(); };
  const open = () => {
    if (!view) { view = buildView({ onClose: close }); panel.append(view); }
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    view.focusInput();
  };
  fab.addEventListener('click', () => (panel.hidden ? open() : close()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden && panel.contains(document.activeElement)) close(); });
  window.addEventListener('langchange', () => {
    fab.setAttribute('aria-label', t('tutor.open'));
    fab.querySelector('.tutor-fab-t').textContent = t('nav.tutor');
    panel.setAttribute('aria-label', t('tutor.title'));
  });
}

// ---------------------------------------------------------------- wiring
window.addEventListener('authchange', () => { syncOwner(); refreshStatus(); });
window.addEventListener('langchange', () => emit());
refreshStatus();
