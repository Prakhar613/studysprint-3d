import { h, api, state, errorBox, skeleton } from '../lib.js';

export default async function library(ctx) {
  const { items } = await api('/api/library');
  let subject = 'all', kind = '';
  const kinds = [...new Set(items.map((i) => i.kind))];
  const grid = h('div', { class: 'grid g3' });
  const chips = h('div', { class: 'chips' }), kchips = h('div', { class: 'chips' });
  const subjOpts = [['all', 'All'], ['exams', 'Exams']].concat(state.meta.subjects.map((s) => [s.id, s.name]));

  function paint() {
    chips.replaceChildren(...subjOpts.map(([v, t]) => h('button', { class: 'chip', 'aria-pressed': String(subject === v), onclick: () => { subject = v; paint(); } }, t)));
    kchips.replaceChildren(h('button', { class: 'chip', 'aria-pressed': String(!kind), onclick: () => { kind = ''; paint(); } }, 'Any type'),
      ...kinds.map((k) => h('button', { class: 'chip', 'aria-pressed': String(kind === k), onclick: () => { kind = k; paint(); } }, k)));
    const shown = items.filter((i) => (subject === 'all' || i.tags.includes(subject) || i.tags.includes('all') && subject !== 'exams') && (!kind || i.kind === kind));
    grid.replaceChildren(...shown.map((i) => h('div', { class: 'panel' },
      h('span', { class: 'badge' }, i.kind), h('h3', { style: { marginTop: '.5rem' } }, i.title), h('p', { class: 'small' }, i.desc),
      h('a', { class: 'btn small', href: i.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open'))));
    if (!shown.length) grid.replaceChildren(h('p', { class: 'muted' }, 'Nothing matches those filters.'));
  }

  const q = h('input', { type: 'search', id: 'bq', maxlength: 200, placeholder: 'Example: organic chemistry, Indian history, calculus' });
  const free = h('input', { type: 'checkbox', id: 'bfree', checked: true, style: { width: 'auto', minHeight: 'auto' } });
  const out = h('div');
  async function find(e) {
    e.preventDefault();
    if (q.value.trim().length < 2) return;
    out.replaceChildren(skeleton(4));
    try {
      const d = await api(`/api/library/books?q=${encodeURIComponent(q.value.trim())}&free=${free.checked ? 1 : 0}`);
      out.replaceChildren(d.results.length ? h('div', { class: 'grid g3' }, d.results.map((b) => h('div', { class: 'panel' },
        b.cover ? h('img', { src: b.cover, alt: '', loading: 'lazy', width: 80, style: { float: 'right', marginLeft: '.6rem', borderRadius: '4px' } }) : null,
        h('strong', {}, b.title), h('div', { class: 'small muted' }, [b.authors.join(', '), b.year].filter(Boolean).join(', ')),
        h('div', { class: 'row', style: { marginTop: '.6rem' } },
          b.archiveUrl ? h('a', { class: 'btn small primary', href: b.archiveUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Read or download') : null,
          h('a', { class: 'btn small ghost', href: b.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open Library page'))))) : h('p', { class: 'muted' }, 'No books found. Untick "free only" or try other words.'));
    } catch (ex) { out.replaceChildren(errorBox(ex)); }
  }
  paint();
  return h('div', {},
    h('h1', {}, 'Free books and PDFs'),
    h('p', {}, 'Every link goes to the official publisher or an open library, so downloads are free and legal. Start with NCERT for school and OpenStax for college-level books.'),
    h('div', { class: 'field' }, h('label', {}, 'Subject'), chips), kchips, grid,
    h('div', { class: 'section' }, h('h2', {}, 'Search millions of books'),
      h('form', { class: 'row', onsubmit: find }, h('div', { class: 'grow' }, h('label', { class: 'hidden', for: 'bq' }, 'Book search'), q),
        h('label', { for: 'bfree', style: { display: 'flex', gap: '.4rem', alignItems: 'center', margin: 0 } }, free, 'Free to read only'),
        h('button', { class: 'btn primary', type: 'submit' }, 'Search books')),
      h('div', { style: { marginTop: '1rem' } }, out)));
}
