// Shared helpers. All dynamic text goes through textContent (via h()), so user content can never inject HTML.
export const state = { user: null, meta: null, offset: 0 };

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (['value', 'checked', 'selected', 'disabled'].includes(k)) el[k] = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const e = new Error('No internet connection. Check your network and try again.');
    e.status = 0;
    throw e;
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const e = new Error(data?.error || 'Something went wrong. Please try again.');
    e.status = res.status;
    throw e;
  }
  if (data && typeof data.now === 'number') state.offset = data.now - Date.now();
  return data;
}

export const serverNow = () => Date.now() + state.offset;
export const subjectById = (id) => state.meta?.subjects.find((s) => s.id === id);
export const subjectName = (id) => subjectById(id)?.name || (id === 'general' ? 'General study' : id);

const istFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
export const fmtIST = (ms) => `${istFmt.format(ms)} IST`;

export function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function mmss(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function countdown(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(t / 86400), hr = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  if (d) return `${d}d ${hr}h ${m}m`;
  if (hr) return `${hr}h ${m}m ${String(s).padStart(2, '0')}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function toast(msg, kind = '') {
  const el = h('div', { class: `toast ${kind}` }, msg);
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), 4500);
}

export function modal(title, content) {
  const prev = document.activeElement;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const back = h('div', { class: 'backdrop', onclick: (e) => { if (e.target === back) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-h' }, h('h2', {}, title), h('button', { class: 'btn ghost small', 'aria-label': 'Close', onclick: close }, 'Close')),
      content));
  document.body.append(back);
  document.addEventListener('keydown', onKey);
  back.querySelector('input,select,textarea,button.btn.primary')?.focus();
  return { close };
}

export function dot(color) { return h('span', { class: 'dot', style: { background: color } }); }
export function skeleton(n = 3) { return h('div', {}, Array.from({ length: n }, () => h('div', { class: 'skeleton' }))); }
export function errorBox(e) { return h('p', { class: 'err', role: 'alert' }, e.message || String(e)); }
export const go = (hash) => { location.hash = hash; };

/** Subscribe to a server-sent-events channel. Returns a close function. */
export function stream(channel, handlers) {
  const es = new EventSource(`/api/stream?channel=${encodeURIComponent(channel)}`);
  for (const [ev, fn] of Object.entries(handlers)) {
    es.addEventListener(ev, (e) => { try { fn(JSON.parse(e.data), e); } catch { /* ignore bad frame */ } });
  }
  return () => es.close();
}

export function selectEl(options, value, props = {}) {
  return h('select', props, options.map((o) => {
    const [v, label] = Array.isArray(o) ? o : [o, o];
    return h('option', { value: v, selected: v === value }, label);
  }));
}
