import { h, api, state, modal, selectEl, toast } from './lib.js';

export async function loadMe() {
  try { state.user = (await api('/api/auth/me')).user; } catch { state.user = null; }
  window.dispatchEvent(new Event('authchange'));
}

export async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* already out */ }
  state.user = null;
  window.dispatchEvent(new Event('authchange'));
  toast('You are logged out');
}

/** Opens the login / sign-up dialog. `then` runs after a successful login. */
export function openAuth(mode = 'login', then) {
  let m = mode;
  const body = h('div');
  let dlg;
  const render = () => {
    const err = h('p', { class: 'err', role: 'alert', hidden: true });
    const user = h('input', { id: 'a-user', autocomplete: 'username', maxlength: 20, required: true });
    const pass = h('input', { id: 'a-pass', type: 'password', autocomplete: m === 'login' ? 'current-password' : 'new-password', maxlength: 72, required: true });
    const state_ = selectEl([['', 'Choose your state']].concat(state.meta.states.map((s) => [s, s])), '', { id: 'a-state' });
    const grade = selectEl([['', 'Choose your class']].concat(state.meta.grades.map((s) => [s, s])), '', { id: 'a-grade' });
    const btn = h('button', { class: 'btn primary', type: 'submit', style: { width: '100%' } }, m === 'login' ? 'Log in' : 'Create account');
    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        err.hidden = true;
        btn.disabled = true;
        try {
          const payload = { username: user.value.trim(), password: pass.value };
          if (m === 'register') Object.assign(payload, { state: state_.value, grade: grade.value });
          const r = await api(`/api/auth/${m === 'login' ? 'login' : 'register'}`, { method: 'POST', body: payload });
          state.user = r.user;
          window.dispatchEvent(new Event('authchange'));
          dlg.close();
          toast(`Welcome, ${r.user.username}`);
          then?.();
        } catch (ex) {
          err.textContent = ex.message;
          err.hidden = false;
          btn.disabled = false;
        }
      },
    },
    err,
    h('div', { class: 'field' }, h('label', { for: 'a-user' }, 'Username'), user,
      m === 'register' ? h('div', { class: 'small muted' }, '3 to 20 letters, numbers or underscores. Use a nickname, not your real name.') : null),
    h('div', { class: 'field' }, h('label', { for: 'a-pass' }, 'Password'), pass,
      m === 'register' ? h('div', { class: 'small muted' }, 'At least 8 characters.') : null),
    m === 'register' ? h('div', { class: 'field' }, h('label', { for: 'a-state' }, 'State or union territory'), state_) : null,
    m === 'register' ? h('div', { class: 'field' }, h('label', { for: 'a-grade' }, 'Class or level'), grade) : null,
    btn);
    body.replaceChildren(form, h('p', { class: 'small', style: { marginTop: '1rem' } },
      m === 'login' ? 'New here? ' : 'Already have an account? ',
      h('button', { class: 'linkbtn', type: 'button', onclick: () => { m = m === 'login' ? 'register' : 'login'; render(); } }, m === 'login' ? 'Create an account' : 'Log in')));
    user.focus();
  };
  dlg = modal(m === 'login' ? 'Log in' : 'Join StudySprint', body);
  render();
}

/** Runs `fn` now if logged in, otherwise asks the student to log in first. */
export function needLogin(fn) {
  if (state.user) return fn();
  openAuth('login', fn);
}
