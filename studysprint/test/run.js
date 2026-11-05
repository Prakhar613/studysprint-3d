'use strict';
// End-to-end and unit tests. Run with: npm test
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studysprint-test-'));
process.env.DATA_DIR = dir;
process.env.DB_PATH = path.join(dir, 'test.db');
process.env.SYNC_QUESTIONS = 'false';
process.env.ADMIN_USERS = 'modmina';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createServer } = require('../server');
const { db } = require('../src/db');
const S = require('../src/subjects');
const news = require('../src/news');
const external = require('../src/external');
const bank = require('../src/questionBank');
const { cleanText } = require('../src/util');

let server;
let base;

function client() {
  let cookie = '';
  const call = async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (sc.length) {
      const c = sc[0].split(';')[0];
      cookie = c.endsWith('=') ? '' : c;
    }
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, data, headers: res.headers };
  };
  call.cookie = () => cookie;
  return call;
}

before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections?.();
  server.close();
  setTimeout(() => process.exit(0), 100).unref();
});

const signup = async (name, extra = {}) => {
  const c = client();
  const r = await c('POST', '/api/auth/register', { username: name, password: 'correct-horse-9', state: 'Uttar Pradesh', grade: 'Class 12', ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return c;
};

/** Index of the correct option for the current question, read straight from the database (test only). */
function correctDisplayIndex(attemptId) {
  const a = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId);
  const plan = JSON.parse(a.plan);
  const q = db.prepare('SELECT correct_index FROM questions WHERE id = ?').get(plan[a.idx].q);
  return plan[a.idx].perm.indexOf(q.correct_index);
}
const skipGap = (attemptId) => db.prepare('UPDATE attempts SET q_started_at = ? WHERE id = ?').run(Date.now() - 50, attemptId);

describe('pure functions', () => {
  test('RSS parser handles CDATA, entities, source suffixes and unsafe links', () => {
    const xml = `<rss><channel>
      <item><title><![CDATA[Physics prize &amp; more - The Hindu]]></title><link>https://example.com/a</link>
        <pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate><source url="https://thehindu.com">The Hindu</source>
        <description>&lt;a href="x"&gt;Physics prize &amp;amp; more&lt;/a&gt;</description></item>
      <item><title>Bad link</title><link>javascript:alert(1)</link></item>
      <item><title>Second story</title><link>https://example.com/b</link><description>A short summary.</description></item>
    </channel></rss>`;
    const items = news.parseRss(xml);
    assert.equal(items.length, 2);
    assert.equal(items[0].title, 'Physics prize & more');
    assert.equal(items[0].source, 'The Hindu');
    assert.equal(items[0].summary, '');
    assert.equal(items[1].summary, 'A short summary.');
  });

  test('OpenAlex and Open Library mappers keep only safe fields', () => {
    const papers = external.mapOpenAlex({
      results: [{ id: 'W1', title: 'Graphene', publication_year: 2020, cited_by_count: 5, doi: 'https://doi.org/10.1/x',
        authorships: [{ author: { display_name: 'A. Kumar' } }], primary_location: { source: { display_name: 'Nature' } },
        open_access: { is_oa: true, oa_url: 'javascript:alert(1)' } }],
    });
    assert.equal(papers[0].authors[0], 'A. Kumar');
    assert.equal(papers[0].pdfUrl, '');
    const books = external.mapOpenLibrary({ docs: [{ key: '/works/OL1W', title: 'Physics', ia: ['physics00xx'], public_scan_b: true, cover_i: 7 }] });
    assert.equal(books[0].archiveUrl, 'https://archive.org/details/physics00xx');
    assert.equal(books[0].free, true);
  });

  test('Open Trivia DB mapper decodes text and keeps the right answer', () => {
    const q = bank.mapOpenTdb(
      { type: 'multiple', difficulty: 'easy', question: 'What%20is%202%2B2%3F', correct_answer: '4', incorrect_answers: ['3', '5', '22'] },
      'math',
    );
    assert.equal(q.text, 'What is 2+2?');
    assert.equal(q.options[q.correctIndex], '4');
  });

  test('contest schedule is computed in IST', () => {
    const slot = S.slotFor('math'); // Monday 19:00 IST = 13:30 UTC
    const from = Date.UTC(2026, 9, 10, 0, 0); // Saturday 10 Oct 2026
    const next = S.nextOccurrence(slot, from);
    const d = new Date(next);
    assert.equal(d.getUTCDay(), 1);
    assert.equal(d.getUTCHours(), 13);
    assert.equal(d.getUTCMinutes(), 30);
    assert.equal(S.currentContest(slot, next).status, 'live');
    assert.equal(S.currentContest(slot, next - 1).status, 'upcoming');
    assert.equal(S.currentContest(slot, next + S.JOIN_WINDOW_MS).start, next + 7 * 86400000);
    assert.ok(S.parseContestId(S.contestId('math', next)));
    assert.equal(S.parseContestId(S.contestId('math', next + 1000)), null);
    assert.equal(S.parseContestId('nonsense'), null);
  });

  test('user text hides phone numbers and e-mail addresses', () => {
    assert.equal(cleanText('call 98765 43210 now', 100), 'call [number hidden] now');
    assert.equal(cleanText('mail me a.b@c.in ok', 100), 'mail me [email hidden] ok');
    assert.equal(cleanText('I scored 95 in 12th, rank 4021', 100), 'I scored 95 in 12th, rank 4021');
  });
});

describe('api', () => {
  test('health, meta and security basics', async () => {
    const c = client();
    assert.equal((await c('GET', '/healthz')).status, 200);
    const meta = await c('GET', '/api/meta');
    assert.equal(meta.data.subjects.length, 8);
    assert.ok(meta.data.subjects.every((s) => s.questions >= 12));
    assert.equal((await c('POST', '/api/quiz/start', { subject: 'physics' })).status, 401);
    const evil = await c('POST', '/api/auth/login', { username: 'x', password: 'y' }, { Origin: 'https://evil.example' });
    assert.equal(evil.status, 403);
    const raw = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
    assert.equal(raw.status, 415);
    assert.ok((await c('GET', '/healthz')).headers.get('content-security-policy').includes("default-src 'self'"));
  });

  test('registration, login and logout', async () => {
    const c = client();
    assert.equal((await c('POST', '/api/auth/register', { username: 'a', password: 'longenough1' })).status, 400);
    assert.equal((await c('POST', '/api/auth/register', { username: 'riya_k', password: 'short' })).status, 400);
    assert.equal((await c('POST', '/api/auth/register', { username: 'admin', password: 'longenough1' })).status, 400);
    assert.equal((await c('POST', '/api/auth/register', { username: 'riya_k', password: 'longenough1', state: 'Atlantis' })).status, 400);
    const ok = await c('POST', '/api/auth/register', { username: 'riya_k', password: 'longenough1', state: 'Bihar', grade: 'Class 11' });
    assert.equal(ok.status, 201);
    assert.equal((await c('GET', '/api/auth/me')).data.user.username, 'riya_k');
    assert.equal((await client()('POST', '/api/auth/register', { username: 'RIYA_K', password: 'longenough1' })).status, 409);
    await c('POST', '/api/auth/logout');
    assert.equal((await c('GET', '/api/auth/me')).data.user, null);
    assert.equal((await c('POST', '/api/auth/login', { username: 'riya_k', password: 'wrong-password' })).status, 401);
    assert.equal((await c('POST', '/api/auth/login', { username: 'riya_k', password: 'longenough1' })).status, 200);
  });

  test('timed practice quiz: scoring, timeouts, double submit and leaderboard', async () => {
    const c = await signup('quiz_kid');
    const start = await c('POST', '/api/quiz/start', { subject: 'physics', count: 5, seconds: 20 });
    assert.equal(start.status, 201);
    const id = start.data.attemptId;
    assert.equal(start.data.state.status, 'question');
    assert.equal(start.data.state.question.options.length, 4);
    assert.equal(JSON.stringify(start.data).includes('correct'), false, 'answer key must never reach the client');

    // 1: correct
    let r = await c('POST', `/api/quiz/${id}/answer`, { index: 0, choice: correctDisplayIndex(id) });
    assert.equal(r.status, 200);
    assert.equal(r.data.result.correct, true);
    assert.ok(r.data.result.points >= 100 && r.data.result.points <= 150);
    assert.ok(r.data.result.explanation.length > 0);
    // next question is not available during the pause
    const wait = await c('GET', `/api/quiz/${id}`);
    assert.equal(wait.data.status, 'wait');
    assert.equal((await c('POST', `/api/quiz/${id}/answer`, { index: 1, choice: 0 })).status, 409);
    skipGap(id);
    // double submit of the old index
    assert.equal((await c('POST', `/api/quiz/${id}/answer`, { index: 0, choice: 0 })).status, 409);

    // 2: wrong
    const right = correctDisplayIndex(id);
    r = await c('POST', `/api/quiz/${id}/answer`, { index: 1, choice: (right + 1) % 4 });
    assert.equal(r.data.result.correct, false);
    assert.equal(r.data.result.points, 0);
    skipGap(id);

    // 3: invalid choice
    assert.equal((await c('POST', `/api/quiz/${id}/answer`, { index: 2, choice: 9 })).status, 400);
    // 3: timeout (server marks it after the limit passes, even if the browser never answers)
    db.prepare('UPDATE attempts SET q_started_at = ? WHERE id = ?').run(Date.now() - 60000, id);
    const after = await c('GET', `/api/quiz/${id}`);
    assert.equal(after.data.index, 3);
    skipGap(id);
    // 4: client reports time up
    r = await c('POST', `/api/quiz/${id}/answer`, { index: 3, choice: null });
    assert.equal(r.data.result.timedOut, true);
    skipGap(id);
    // 5: correct, finishes
    r = await c('POST', `/api/quiz/${id}/answer`, { index: 4, choice: correctDisplayIndex(id) });
    assert.equal(r.data.result.done, true);
    assert.equal(r.data.summary.total, 5);
    assert.equal(r.data.summary.correct, 2);
    assert.equal(r.data.summary.review.length, 3);
    assert.equal((await c('GET', `/api/quiz/${id}`)).data.status, 'done');

    // someone else cannot touch this attempt
    const other = await signup('snooper');
    assert.equal((await other('GET', `/api/quiz/${id}`)).status, 404);

    const lb = await c('GET', '/api/leaderboard?scope=quiz&period=week');
    assert.ok(lb.data.rows.some((row) => row.username === 'quiz_kid' && row.isMe));
    assert.equal(lb.data.me.rank >= 1, true);
    const filtered = await c('GET', '/api/leaderboard?scope=quiz&period=all&subject=chemistry');
    assert.equal(filtered.data.rows.length, 0);
  });

  test('pomodoro focus sessions are validated against the server clock', async () => {
    const c = await signup('focus_fan');
    const s = await c('POST', '/api/focus/start', { subject: 'math', minutes: 25 });
    assert.equal(s.status, 201);
    assert.equal((await c('POST', `/api/focus/${s.data.id}/complete`)).status, 400); // too early
    assert.equal((await c('POST', '/api/focus/start', { subject: 'math', minutes: 3 })).status, 400);
    db.prepare('UPDATE focus_sessions SET started_at = ? WHERE id = ?').run(Date.now() - 25 * 60000, s.data.id);
    const done = await c('POST', `/api/focus/${s.data.id}/complete`);
    assert.equal(done.status, 200);
    assert.equal(done.data.credited, 25);
    assert.equal((await c('POST', `/api/focus/${s.data.id}/complete`)).status, 409);
    const stats = await c('GET', '/api/me/stats');
    assert.equal(stats.data.focusToday, 25);
    assert.equal(stats.data.streak, 1);
    assert.equal(stats.data.week.length, 7);
    assert.equal(stats.data.week[6].minutes, 25);
    const lb = await c('GET', '/api/leaderboard?scope=focus&period=today');
    assert.equal(lb.data.rows[0].score >= 25, true);
  });

  test('weekly contest: waiting, joining inside the window, shared questions, leaderboard', async () => {
    const a = await signup('contest_a');
    const b = await signup('contest_b');
    const list = await a('GET', '/api/contests');
    assert.equal(list.data.contests.length, 8);
    const upcoming = list.data.contests.find((c) => c.subject === 'math');
    assert.equal((await a('POST', `/api/contests/${upcoming.id}/join`)).status, upcoming.status === 'live' ? 201 : 409);
    assert.equal((await a('POST', '/api/contests/math-123/join')).status, 404);

    // Move the clock one minute into the contest window for the rest of this test.
    const realNow = Date.now;
    const offset = upcoming.start + 60000 - realNow();
    Date.now = () => realNow() + offset;
    try {
      const live = (await a('GET', `/api/contests/${upcoming.id}`)).data.contest;
      assert.equal(live.status, 'live');
      const ja = await a('POST', `/api/contests/${upcoming.id}/join`);
      assert.ok([200, 201].includes(ja.status), JSON.stringify(ja.data));
      const jb = await b('POST', `/api/contests/${upcoming.id}/join`);
      const qa = db.prepare('SELECT plan FROM attempts WHERE id = ?').get(ja.data.attemptId).plan;
      const qb = db.prepare('SELECT plan FROM attempts WHERE id = ?').get(jb.data.attemptId).plan;
      const idsOf = (p) => JSON.parse(p).map((x) => x.q).sort((x, y) => x - y).join(',');
      assert.equal(idsOf(qa), idsOf(qb), 'everyone gets the same 10 questions');
      assert.equal((await a('POST', `/api/contests/${upcoming.id}/join`)).data.resumed, true);

      for (const [client_, attempt, wrongFrom] of [[a, ja.data.attemptId, 99], [b, jb.data.attemptId, 5]]) {
        for (let i = 0; i < 10; i++) {
          const right = correctDisplayIndex(attempt);
          const choice = i >= wrongFrom ? (right + 1) % 4 : right;
          const r = await client_('POST', `/api/quiz/${attempt}/answer`, { index: i, choice });
          assert.equal(r.status, 200, JSON.stringify(r.data));
          assert.equal(r.data.result.correctIndex, null, 'contest answers stay hidden while it is open');
          db.prepare('UPDATE attempts SET q_started_at = ? WHERE id = ?').run(Date.now() - 20, attempt);
        }
      }
      const board = (await a('GET', `/api/contests/${upcoming.id}`)).data;
      assert.equal(board.leaderboard.length, 2);
      assert.equal(board.leaderboard[0].username, 'contest_a');
      assert.equal(board.leaderboard[0].rank, 1);
      assert.equal(board.me.rank, 1);
      assert.equal(board.leaderboard[0].finished, true);
      const sum = await a('GET', `/api/quiz/${ja.data.attemptId}`);
      assert.equal(sum.data.summary.reviewLocked, true);
    } finally {
      Date.now = realNow;
    }
    // After the window closes joining is refused and the review unlocks
    const late = await signup('contest_late');
    const closedId = S.contestId('math', upcoming.start);
    Date.now = ((n) => () => n() + (upcoming.start + 3600000 - n()))(Date.now);
    try {
      assert.equal((await late('POST', `/api/contests/${closedId}/join`)).status, 409);
    } finally {
      Date.now = Date.now;
    }
  });

  test('doubts forum: ask, answer, accept, vote, report, moderate', async () => {
    const asker = await signup('asker_1');
    const helper = await signup('helper_1');
    const r1 = await signup('rep_1');
    const r2 = await signup('rep_2');
    const r3 = await signup('rep_3');
    const mod = await signup('modmina');

    assert.equal((await asker('POST', '/api/doubts', { subject: 'physics', title: 'short', body: 'x' })).status, 400);
    const created = await asker('POST', '/api/doubts', { subject: 'physics', title: 'Why does a convex mirror give a smaller image?', body: 'Call me on 9876543210 if you know! I do not get the ray diagram.' });
    assert.equal(created.status, 201);
    const id = created.data.id;
    const detail = (await helper('GET', `/api/doubts/${id}`)).data;
    assert.ok(detail.doubt.body.includes('[number hidden]'));

    const ans = await helper('POST', `/api/doubts/${id}/answers`, { body: 'Rays diverge after reflection, so the image forms behind the mirror and is diminished.' });
    assert.equal(ans.status, 201);
    assert.equal((await helper('POST', `/api/doubts/${id}/accept`, { answerId: ans.data.id })).status, 403);
    assert.equal((await asker('POST', `/api/doubts/${id}/accept`, { answerId: ans.data.id })).status, 200);
    assert.equal((await helper('POST', '/api/votes', { type: 'answer', id: ans.data.id })).status, 400); // own post
    const v = await asker('POST', '/api/votes', { type: 'answer', id: ans.data.id });
    assert.equal(v.data.votes, 1);
    assert.equal((await asker('POST', '/api/votes', { type: 'answer', id: ans.data.id })).data.votes, 0); // toggled off
    await asker('POST', '/api/votes', { type: 'answer', id: ans.data.id });

    const after = (await asker('GET', `/api/doubts/${id}`)).data;
    assert.equal(after.doubt.solved, true);
    assert.equal(after.answers[0].accepted, true);
    assert.equal((await asker('GET', '/api/doubts?unsolved=1')).data.items.some((d) => d.id === id), false);
    assert.equal((await asker('GET', '/api/doubts?q=convex')).data.items.length, 1);
    assert.equal((await asker('GET', '/api/doubts?q=%25')).data.items.length, 0); // wildcards are literal

    const helpers = await asker('GET', '/api/leaderboard?scope=helpers&period=all');
    assert.equal(helpers.data.rows[0].username, 'helper_1');
    assert.equal(helpers.data.rows[0].score, 21);

    // three different students reporting hides a post
    const bad = await asker('POST', '/api/doubts', { subject: 'math', title: 'Spam spam spam spam', body: 'Buy my notes at this place now now now' });
    assert.equal((await r1('POST', '/api/report', { type: 'doubt', id: bad.data.id })).data.hidden, false);
    assert.equal((await r1('POST', '/api/report', { type: 'doubt', id: bad.data.id })).data.hidden, false); // same reporter counts once
    await r2('POST', '/api/report', { type: 'doubt', id: bad.data.id });
    assert.equal((await r3('POST', '/api/report', { type: 'doubt', id: bad.data.id })).data.hidden, true);
    assert.equal((await asker('GET', `/api/doubts/${bad.data.id}`)).status, 404);

    // admin removal
    const another = await asker('POST', '/api/doubts', { subject: 'math', title: 'A normal question here', body: 'What is the derivative of sin x?' });
    assert.equal((await asker('DELETE', `/api/doubts/${another.data.id}`)).status, 403);
    assert.equal((await mod('DELETE', `/api/doubts/${another.data.id}`)).status, 200);
    assert.equal((await asker('GET', `/api/doubts/${another.data.id}`)).status, 404);
  });

  test('live chat: history, rate limits, PII masking and server-sent events', async () => {
    const a = await signup('chat_a');
    const b = await signup('chat_b');
    assert.equal((await client()('GET', '/api/chat/rooms/general/messages')).status, 401);
    assert.equal((await a('GET', '/api/chat/rooms/nope/messages')).status, 404);

    // open a live stream for student B
    const ctl = new AbortController();
    const res = await fetch(`${base}/api/stream?channel=room:general`, { headers: { cookie: b.cookie() }, signal: ctl.signal });
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').startsWith('text/event-stream'));
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let seen = '';
    const readUntil = async (needle) => {
      const deadline = Date.now() + 4000;
      while (!seen.includes(needle) && Date.now() < deadline) {
        const { value, done } = await Promise.race([reader.read(), new Promise((r) => setTimeout(() => r({ done: false, value: undefined }), 300))]);
        if (done) break;
        if (value) seen += dec.decode(value);
      }
      return seen.includes(needle);
    };
    assert.ok(await readUntil('event: presence'), 'presence event on connect');

    const sent = await a('POST', '/api/chat/rooms/general/messages', { text: 'Anyone from Prayagraj preparing for NEET? Text 98765 43210' });
    assert.equal(sent.status, 201);
    assert.ok(sent.data.message.text.includes('[number hidden]'));
    assert.ok(await readUntil('event: message'), 'message pushed to the other student');
    assert.ok(seen.includes('Prayagraj'));

    assert.equal((await a('POST', '/api/chat/rooms/general/messages', { text: 'Anyone from Prayagraj preparing for NEET? Text 98765 43210' })).status, 429); // duplicate
    let limited = 0;
    for (let i = 0; i < 8; i++) {
      const r = await a('POST', '/api/chat/rooms/general/messages', { text: `msg ${i}` });
      if (r.status === 429) limited++;
    }
    assert.ok(limited >= 3, 'burst limit kicks in');
    ctl.abort();

    const hist = await b('GET', '/api/chat/rooms/general/messages');
    assert.ok(hist.data.messages.length >= 1);
    assert.equal(hist.data.messages[0].user.username, 'chat_a');

    // missed messages are replayed after a reconnect (Last-Event-ID)
    const lastId = hist.data.messages[0].id;
    const ctl2 = new AbortController();
    const res2 = await fetch(`${base}/api/stream?channel=room:general`, { headers: { cookie: b.cookie(), 'last-event-id': String(lastId) }, signal: ctl2.signal });
    const r2 = res2.body.getReader();
    let got = '';
    const t = Date.now();
    while (!got.includes('event: message') && Date.now() - t < 3000) {
      const { value } = await Promise.race([r2.read(), new Promise((r) => setTimeout(() => r({}), 300))]);
      if (value) got += dec.decode(value);
    }
    ctl2.abort();
    assert.ok(got.includes('event: message'));
  });

  test('news and research endpoints degrade gracefully without internet', async () => {
    const c = client();
    const n = await c('GET', '/api/news?topic=nobel');
    assert.equal(n.status, 200);
    assert.equal(n.data.label, 'Nobel Prize');
    assert.ok(Array.isArray(n.data.items));
    assert.ok(n.data.sources.length >= 1);
    assert.equal((await c('GET', '/api/news?topic=zzz')).status, 400);
    assert.equal((await c('GET', '/api/research?q=x')).status, 400);
    const lib = await c('GET', '/api/library');
    assert.ok(lib.data.items.length > 20);
    assert.ok(lib.data.items.every((i) => /^https:\/\//.test(i.url)));
  });

  test('profile changes, password change and account deletion', async () => {
    const c = await signup('leaver');
    assert.equal((await c('PATCH', '/api/auth/profile', { state: 'Kerala' })).data.user.state, 'Kerala');
    assert.equal((await c('PATCH', '/api/auth/profile', { state: 'Nowhere' })).status, 400);
    assert.equal((await c('POST', '/api/auth/password', { current: 'bad', next: 'another-pass-1' })).status, 403);
    assert.equal((await c('POST', '/api/auth/password', { current: 'correct-horse-9', next: 'another-pass-1' })).status, 200);
    await c('POST', '/api/doubts', { subject: 'math', title: 'A question before leaving', body: 'Does this stay after I leave?' });
    assert.equal((await c('DELETE', '/api/auth/account', { password: 'wrong' })).status, 403);
    assert.equal((await c('DELETE', '/api/auth/account', { password: 'another-pass-1' })).status, 200);
    assert.equal((await c('GET', '/api/auth/me')).data.user, null);
    assert.equal((await client()('POST', '/api/auth/login', { username: 'leaver', password: 'another-pass-1' })).status, 401);
    const left = db.prepare("SELECT u.username FROM doubts d JOIN users u ON u.id = d.user_id WHERE d.title = 'A question before leaving'").get();
    assert.equal(left.username, 'deleted_user');
  });

  test('front end is served with caching headers and compression', async () => {
    const res = await fetch(base + '/', { headers: { 'accept-encoding': 'gzip' } });
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').startsWith('text/html'));
    assert.equal(res.headers.get('content-encoding'), 'gzip');
    const etag = res.headers.get('etag');
    assert.equal((await fetch(base + '/', { headers: { 'if-none-match': etag } })).status, 304);
    assert.equal((await fetch(base + '/../package.json')).status, 404);
    assert.equal((await fetch(base + '/%2e%2e/package.json')).status, 404);
    assert.equal((await fetch(base + '/nope.txt')).status, 404);
  });
});
