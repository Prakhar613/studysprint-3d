'use strict';
// Research papers (OpenAlex) and free books (Open Library). Both are free, open APIs with no key.
// Google Scholar has no public API and does not allow embedding, so the app links out to it instead.
const config = require('./config');

const cache = new Map();
const TTL = 60 * 60 * 1000;

async function getJson(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(9000),
    headers: { 'User-Agent': 'StudySprintIndia/1.0', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await loader();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return value;
}

const httpOnly = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '');

function mapOpenAlex(data) {
  return (data?.results || [])
    .filter((w) => w && w.title)
    .map((w) => ({
      id: w.id,
      title: w.title,
      year: w.publication_year || null,
      citations: w.cited_by_count || 0,
      authors: (w.authorships || []).slice(0, 4).map((a) => a?.author?.display_name).filter(Boolean),
      venue: w.primary_location?.source?.display_name || '',
      doi: httpOnly(w.doi),
      openAccess: !!w.open_access?.is_oa,
      pdfUrl: httpOnly(w.open_access?.oa_url) || httpOnly(w.primary_location?.pdf_url),
    }));
}

function searchPapers(q) {
  const key = `papers:${q.toLowerCase()}`;
  return cached(key, async () => {
    const mailto = config.CONTACT_EMAIL ? `&mailto=${encodeURIComponent(config.CONTACT_EMAIL)}` : '';
    const url =
      `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=12` +
      `&select=id,doi,title,publication_year,cited_by_count,authorships,primary_location,open_access${mailto}`;
    return mapOpenAlex(await getJson(url));
  });
}

function mapOpenLibrary(data) {
  return (data?.docs || [])
    .filter((d) => d && d.title && d.key)
    .map((d) => ({
      title: d.title,
      authors: (d.author_name || []).slice(0, 3),
      year: d.first_publish_year || null,
      cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${encodeURIComponent(d.cover_i)}-M.jpg` : '',
      url: `https://openlibrary.org${d.key}`,
      archiveUrl: d.ia && d.ia[0] ? `https://archive.org/details/${encodeURIComponent(d.ia[0])}` : '',
      free: !!d.public_scan_b,
    }));
}

function searchBooks(q, freeOnly) {
  const key = `books:${freeOnly ? 1 : 0}:${q.toLowerCase()}`;
  return cached(key, async () => {
    const url =
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12` +
      `&fields=key,title,author_name,first_publish_year,ia,has_fulltext,public_scan_b,cover_i` +
      (freeOnly ? '&has_fulltext=true&public_scan_b=true' : '');
    return mapOpenLibrary(await getJson(url));
  });
}

module.exports = { searchPapers, searchBooks, mapOpenAlex, mapOpenLibrary };
