import { h, api, state, ago, selectEl, modal, subjectById, dot, errorBox, skeleton, toast, go } from '../lib.js';
import { needLogin } from '../auth.js';

export default async function doubts(ctx) {
  const f = { subject: '', q: '', unsolved: false };
  let page = 0;
  const list = h('ul', { class: 'list' });
  const status = h('div');
  const moreBtn = h('button', { class: 'btn', hidden: true, onclick: () => load(true) }, 'Load more');

  async function load(append) {
    if (!append) { page = 0; list.replaceChildren(); status.replaceChildren(skeleton(3)); } else page++;
    try {
      const q = new URLSearchParams({ subject: f.subject, q: f.q, unsolved: f.unsolved ? '1' : '0', page });
      const d = await api(`/api/doubts?${q}`);
      status.replaceChildren();
      if (!d.items.length && !append) status.replaceChildren(h('p', { class: 'muted' }, 'No doubts here yet. Ask the first one and students from across India can help.'));
      d.items.forEach((x) => list.append(h('li', {},
        h('a', { href: `#/doubts/${x.id}` }, h('strong', {}, x.title)),
        h('div', { class: 'small muted' }, dot(subjectById(x.subject)?.color), `${subjectById(x.subject)?.name}, ${x.author.username}${x.author.state ? ` (${x.author.state})` : ''}, ${ago(x.createdAt)}`),
        h('div', { class: 'small' }, x.preview),
        h('div', { class: 'small' }, x.solved ? h('span', { class: 'badge good' }, 'Solved') : '', ` ${x.answers} answer${x.answers === 1 ? '' : 's'}, ${x.votes} vote${x.votes === 1 ? '' : 's'}`))));
      moreBtn.hidden = !d.hasMore;
    } catch (e) { status.replaceChildren(errorBox(e)); }
  }

  function ask() {
    needLogin(() => {
      const err = h('p', { class: 'err', hidden: true, role: 'alert' });
      const subj = selectEl(state.meta.subjects.map((s) => [s.id, s.name]), f.subject || 'physics', { id: 'd-s' });
      const title = h('input', { id: 'd-t', maxlength: 140, placeholder: 'Example: Why does a convex mirror always form a smaller image?' });
      const body = h('textarea', { id: 'd-b', maxlength: 3000, placeholder: 'Write what you tried and where you are stuck. Do not share phone numbers or personal details.' });
      const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Post doubt');
      const dlg = modal('Ask a doubt', h('form', { onsubmit: async (e) => {
        e.preventDefault(); btn.disabled = true; err.hidden = true;
        try { const r = await api('/api/doubts', { method: 'POST', body: { subject: subj.value, title: title.value, body: body.value } }); dlg.close(); go(`#/doubts/${r.id}`); }
        catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; }
      } }, err, h('div', { class: 'field' }, h('label', { for: 'd-s' }, 'Subject'), subj), h('div', { class: 'field' }, h('label', { for: 'd-t' }, 'Title'), title), h('div', { class: 'field' }, h('label', { for: 'd-b' }, 'Details'), body), btn));
    });
  }

  let t;
  const search = h('input', { type: 'search', placeholder: 'Search doubts', 'aria-label': 'Search doubts', oninput: (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value.trim(); load(); }, 350); } });
  const chips = h('div', { class: 'chips' });
  const paint = () => chips.replaceChildren(
    h('button', { class: 'chip', 'aria-pressed': String(!f.subject), onclick: () => { f.subject = ''; paint(); load(); } }, 'All'),
    ...state.meta.subjects.map((s) => h('button', { class: 'chip', 'aria-pressed': String(f.subject === s.id), onclick: () => { f.subject = s.id; paint(); load(); } }, s.name)),
    h('button', { class: 'chip', 'aria-pressed': String(f.unsolved), onclick: () => { f.unsolved = !f.unsolved; paint(); load(); } }, 'Unsolved only'));
  paint(); load();
  return h('div', {}, h('h1', {}, 'Doubts'),
    h('p', {}, 'Stuck on a problem? Post it here with what you tried. Students from every state can answer, and you pick the answer that helped most.'),
    h('div', { class: 'row', style: { marginBottom: '1rem' } }, h('div', { class: 'grow' }, search), h('button', { class: 'btn primary', onclick: ask }, 'Ask a doubt')),
    chips, status, list, moreBtn);
}
