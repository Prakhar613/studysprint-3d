import { h, api, errorBox, skeleton } from '../lib.js';

const OTHER = [
  ['Semantic Scholar', 'https://www.semanticscholar.org/search?q='],
  ['arXiv (physics, maths, CS)', 'https://arxiv.org/search/?searchtype=all&query='],
  ['PubMed (biology, medicine)', 'https://pubmed.ncbi.nlm.nih.gov/?term='],
  ['CORE open access', 'https://core.ac.uk/search?q='],
  ['Shodhganga (Indian theses)', 'https://shodhganga.inflibnet.com/simple-search?query='],
  ['DOAJ open journals', 'https://doaj.org/search/articles?ref=homepage-box&source=%7B%22query%22%3A%7B%22query_string%22%3A%7B%22query%22%3A%22'],
];
const scholar = (q) => `https://scholar.google.com/scholar?hl=en&q=${encodeURIComponent(q)}`;
const ext = (href, text, cls = 'btn small') => h('a', { class: cls, href, target: '_blank', rel: 'noopener noreferrer' }, text);

export default function research(ctx) {
  const input = h('input', { type: 'search', id: 'rq', placeholder: 'Example: photosynthesis efficiency, quantum computing, monsoon prediction', maxlength: 200 });
  const out = h('div'), links = h('div');
  async function search(e) {
    e?.preventDefault();
    const q = input.value.trim();
    if (q.length < 2) { out.replaceChildren(h('p', { class: 'err' }, 'Type at least 2 characters.')); return; }
    links.replaceChildren(h('div', { class: 'row', style: { margin: '1rem 0' } },
      ext(scholar(q), 'Search on Google Scholar', 'btn primary'),
      OTHER.map(([t, u]) => ext(u + encodeURIComponent(q) + (t.startsWith('DOAJ') ? '%22%7D%7D%7D' : ''), t, 'btn small ghost'))));
    out.replaceChildren(skeleton(4));
    try {
      const d = await api(`/api/research?q=${encodeURIComponent(q)}`);
      out.replaceChildren(d.results.length ? h('ul', { class: 'list' }, d.results.map((p) => h('li', {},
        h('strong', {}, p.title),
        h('div', { class: 'small muted' }, [p.authors.join(', '), p.venue, p.year, `${p.citations} citations`].filter(Boolean).join(' · ')),
        h('div', { class: 'row', style: { marginTop: '.4rem' } },
          p.pdfUrl ? ext(p.pdfUrl, 'Free PDF / full text') : null,
          p.doi ? ext(p.doi, 'Publisher page', 'btn small ghost') : null,
          ext(scholar(p.title), 'Find on Google Scholar', 'btn small ghost'),
          p.openAccess ? h('span', { class: 'badge good' }, 'Open access') : null)))) : h('p', { class: 'muted' }, 'No papers found. Try broader keywords.'));
    } catch (ex) { out.replaceChildren(errorBox(ex)); }
  }
  return h('div', {},
    h('h1', {}, 'Research'),
    h('p', {}, 'Search research papers for projects, science fairs and college prep. Google Scholar does not allow other sites to embed it, so the button opens it in a new tab with your search ready. Results below come from OpenAlex and show which papers are free to read.'),
    h('form', { class: 'row', onsubmit: search }, h('div', { class: 'grow' }, h('label', { class: 'hidden', for: 'rq' }, 'Search'), input), h('button', { class: 'btn primary', type: 'submit' }, 'Search papers')),
    links,
    h('p', { class: 'note small' }, 'Tip: start with a review article, then follow its references. Check the year, the journal and how often a paper is cited before you rely on it.'),
    out);
}
