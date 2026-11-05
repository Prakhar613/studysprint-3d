'use strict';
// Headlines for the home page. We read public RSS feeds and show headline, source, date and a link back.
// Articles are never copied; readers click through to the publisher.

const gnews = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;

const TOPICS = {
  nobel: {
    label: 'Nobel Prize',
    feeds: [gnews('"Nobel Prize" when:30d')],
    sources: [
      { title: 'NobelPrize.org: all prizes and laureates', url: 'https://www.nobelprize.org/prizes/' },
      { title: 'NobelPrize.org: press releases and announcements', url: 'https://www.nobelprize.org/' },
    ],
  },
  science: {
    label: 'Science',
    feeds: [gnews('science discovery research when:7d'), 'https://www.sciencedaily.com/rss/top/science.xml'],
    sources: [
      { title: 'ScienceDaily', url: 'https://www.sciencedaily.com/' },
      { title: 'PIB: Ministry of Science and Technology', url: 'https://pib.gov.in/' },
    ],
  },
  current: {
    label: 'Current affairs',
    feeds: [
      'https://news.google.com/rss/headlines/section/topic/NATION?hl=en-IN&gl=IN&ceid=IN:en',
      gnews('India current affairs when:7d'),
    ],
    sources: [
      { title: 'PIB: Press Information Bureau', url: 'https://pib.gov.in/' },
      { title: 'PRS Legislative Research', url: 'https://prsindia.org/' },
    ],
  },
  space: {
    label: 'Space and technology',
    feeds: [gnews('ISRO OR NASA when:14d')],
    sources: [
      { title: 'ISRO', url: 'https://www.isro.gov.in/' },
      { title: 'NASA news', url: 'https://www.nasa.gov/news/' },
    ],
  },
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const stripTags = (s) => String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function tagText(block, name) {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  if (!m) return '';
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(m[1]);
  return cdata ? cdata[1] : m[1];
}

const isHttp = (u) => /^https?:\/\//i.test(u);

function parseRss(xml, limit = 20) {
  const items = [];
  for (const block of String(xml).match(/<item[\s>][\s\S]*?<\/item>/gi) || []) {
    let title = decodeEntities(stripTags(tagText(block, 'title'))).trim();
    const link = decodeEntities(tagText(block, 'link')).trim();
    if (!title || !isHttp(link)) continue;
    const source = decodeEntities(stripTags(tagText(block, 'source'))).trim();
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim();
    const time = Date.parse(tagText(block, 'pubDate')) || 0;
    let summary = decodeEntities(stripTags(decodeEntities(tagText(block, 'description')))).trim();
    if (summary.toLowerCase().startsWith(title.slice(0, 25).toLowerCase())) summary = ''; // aggregator repeats the headline
    if (summary.length > 180) summary = summary.slice(0, 177).trimEnd() + '...';
    items.push({ title, url: link, source, time, summary });
    if (items.length >= limit) break;
  }
  return items;
}

const cache = new Map(); // topic -> { at, items }
const TTL = 20 * 60 * 1000;

async function fetchFeed(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StudySprintIndia/1.0)', Accept: 'application/rss+xml, application/xml, text/xml' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseRss(await res.text());
}

async function getNews(topic) {
  const def = TOPICS[topic];
  if (!def) return null;
  const hit = cache.get(topic);
  if (hit && Date.now() - hit.at < TTL) return build(topic, hit.items, hit.at, false);

  const settled = await Promise.allSettled(def.feeds.map(fetchFeed));
  const merged = [];
  const seen = new Set();
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    for (const it of s.value) {
      const key = it.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(it);
    }
  }
  merged.sort((a, b) => b.time - a.time);
  if (merged.length) {
    const items = merged.slice(0, 14);
    cache.set(topic, { at: Date.now(), items });
    return build(topic, items, Date.now(), false);
  }
  if (hit) return build(topic, hit.items, hit.at, true); // serve older headlines rather than nothing
  return build(topic, [], 0, true);
}

const build = (topic, items, at, stale) => ({
  topic,
  label: TOPICS[topic].label,
  updatedAt: at,
  stale,
  items,
  sources: TOPICS[topic].sources,
});

module.exports = { TOPICS, getNews, parseRss, decodeEntities };
