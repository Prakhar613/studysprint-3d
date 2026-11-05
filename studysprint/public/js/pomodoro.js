// Pomodoro engine. Lives outside any page, so the timer keeps running while a student browses.
import { api, state, toast } from './lib.js';

const RUN_KEY = 'ss_pomo_run_v1';
const SET_KEY = 'ss_pomo_set_v1';
const CYC_KEY = 'ss_pomo_cycle_v1';
const DEFAULTS = { focus: 25, short: 5, long: 15, every: 4, subject: 'general' };

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };

let settings = { ...DEFAULTS, ...read(SET_KEY, {}) };
let run = read(RUN_KEY, null);
let cyc = read(CYC_KEY, { day: '', n: 0 });
const subs = new Set();
let timer = null;
const baseTitle = document.title;

const today = () => new Date().toDateString();
if (cyc.day !== today()) cyc = { day: today(), n: 0 };

export const getSettings = () => settings;
export const getRun = () => run;
export const cyclesToday = () => cyc.n;
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export const remaining = () => (!run ? 0 : run.paused != null ? run.paused : Math.max(0, run.endsAt - Date.now()));
export const total = () => (run ? run.minutes * 60000 : settings.focus * 60000);

function emit() {
  write(RUN_KEY, run);
  document.title = run && run.paused == null ? `${fmt(remaining())} ${run.phase === 'focus' ? 'Focus' : 'Break'} · StudySprint` : baseTitle;
  for (const fn of subs) fn();
  if (run && run.paused == null && !timer) timer = setInterval(tick, 250);
  if ((!run || run.paused != null) && timer) { clearInterval(timer); timer = null; }
}
const fmt = (ms) => { const t = Math.ceil(ms / 1000); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

export function setSettings(p) {
  settings = { ...settings, ...p };
  write(SET_KEY, settings);
  emit();
}

export async function startFocus() {
  const minutes = settings.focus;
  const now = Date.now();
  run = { phase: 'focus', minutes, startedAt: now, endsAt: now + minutes * 60000, paused: null, sessionId: null, subject: settings.subject };
  emit();
  askNotify();
  if (state.user) {
    try {
      const r = await api('/api/focus/start', { method: 'POST', body: { minutes, subject: settings.subject } });
      if (run && run.startedAt === now) { run.sessionId = r.id; write(RUN_KEY, run); }
    } catch { /* keeps working offline; the session just won't be credited */ }
  }
}

function startBreak(long) {
  const minutes = long ? settings.long : settings.short;
  const now = Date.now();
  run = { phase: long ? 'long' : 'short', minutes, startedAt: now, endsAt: now + minutes * 60000, paused: null, sessionId: null, subject: settings.subject };
  emit();
}

export function pause() { if (run && run.paused == null) { run.paused = remaining(); emit(); } }
export function resume() { if (run && run.paused != null) { run.endsAt = Date.now() + run.paused; run.paused = null; emit(); } }
export function stop() { run = null; emit(); }
export function skipBreak() { if (run && run.phase !== 'focus') { run = null; emit(); } }

function tick() { if (run && run.paused == null && remaining() <= 0) finish(); else for (const fn of subs) fn(); document.title = run && run.paused == null ? `${fmt(remaining())} ${run.phase === 'focus' ? 'Focus' : 'Break'} · StudySprint` : baseTitle; }

async function finish() {
  const done = run;
  if (!done || done.finishing) return;
  done.finishing = true;
  beep();
  if (done.phase === 'focus') {
    cyc = { day: today(), n: cyc.n + 1 };
    write(CYC_KEY, cyc);
    const long = cyc.n % settings.every === 0;
    notify('Focus session complete', long ? 'Great work. Take a long break.' : 'Take a short break, or try a quick quiz.');
    startBreak(long);
    if (done.sessionId && state.user) {
      try {
        const r = await api(`/api/focus/${done.sessionId}/complete`, { method: 'POST' });
        toast(r.credited ? `+${r.credited} focus minutes added to your leaderboard score` : 'Daily focus limit reached, no more minutes counted today');
      } catch (e) { toast(e.message, 'bad'); }
    } else {
      toast(state.user ? 'Session finished' : 'Session finished. Log in to count focus minutes on the leaderboard.');
    }
  } else {
    notify('Break is over', 'Ready for the next focus session?');
    toast('Break is over. Ready for the next session?');
    run = null;
    emit();
  }
}

// If the page was closed while a timer ran, settle it on the next visit.
if (run && run.paused == null && run.endsAt <= Date.now()) {
  if (run.phase === 'focus' && Date.now() - run.startedAt < 12 * 3600e3) setTimeout(() => finish(), 800);
  else run = null;
}
emit();

function askNotify() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* unsupported */ } }
function notify(title, body) { try { if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: '/icon.svg' }); } catch { /* unsupported */ } }
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
    });
  } catch { /* audio blocked */ }
}
