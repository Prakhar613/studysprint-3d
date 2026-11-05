import { h, api, state, subjectName, go, toast, errorBox } from '../lib.js';

// The server owns the clock and the answer key. This page only draws the current question and sends the choice.
export default async function play(ctx) {
  if (!state.user) return h('div', { class: 'panel' }, h('h1', {}, 'Log in to play'), h('p', {}, 'Log in to continue your quiz.'), h('a', { class: 'btn primary', href: '#/quiz' }, 'Back to quiz'));
  const id = ctx.params.id;
  const root = h('div', { class: 'qwrap' });
  let timer = null, answered = false, keyHandler = null;
  const stop = () => { clearInterval(timer); timer = null; if (keyHandler) document.removeEventListener('keydown', keyHandler); keyHandler = null; };
  ctx.onCleanup(stop);

  async function refresh() {
    stop();
    try { show(await api(`/api/quiz/${id}`)); } catch (e) { root.replaceChildren(errorBox(e), h('a', { class: 'btn', href: '#/quiz' }, 'Back to quiz')); }
  }

  function show(st) {
    stop();
    if (st.status === 'done') return summary(st.summary);
    if (st.status === 'wait') return wait(st.waitMs, st.index, st.total);
    return question(st);
  }

  function wait(ms, index, total) {
    const end = Date.now() + ms;
    const t = h('strong', { class: 'clock' });
    root.replaceChildren(h('div', { class: 'panel' }, h('p', { class: 'muted' }, `Question ${index + 1} of ${total} starts in`), t));
    const tick = () => { const r = end - Date.now(); t.textContent = `${Math.max(0, Math.ceil(r / 1000))}s`; if (r <= 0) refresh(); };
    tick(); timer = setInterval(tick, 200);
  }

  function question(st) {
    answered = false;
    const q = st.question;
    const end = Date.now() + st.remainingMs;
    const limit = st.seconds * 1000;
    const bar = h('b'); const barWrap = h('div', { class: 'qbar', role: 'presentation' }, bar);
    const left = h('span');
    const fb = h('div', { 'aria-live': 'assertive' });
    const buttons = q.options.map((o, i) => h('button', { class: 'opt', onclick: () => submit(i) }, h('span', { class: 'b' }, 'ABCDEF'[i]), h('span', {}, o)));
    root.replaceChildren(
      h('div', { class: 'qmeta' }, h('span', {}, `${subjectName(st.subject)}${st.mode === 'contest' ? ' contest' : ''}, question ${st.index + 1} of ${st.total}`), h('span', {}, `${st.score} pts`)),
      h('div', { class: 'qmeta' }, left),
      barWrap,
      h('p', { class: 'qtext' }, q.text),
      h('div', { class: 'opts', role: 'group', 'aria-label': 'Answer options' }, buttons),
      fb);
    const tick = () => {
      const r = Math.max(0, end - Date.now());
      left.textContent = `${Math.ceil(r / 1000)}s left`;
      bar.style.width = `${(r / limit) * 100}%`;
      barWrap.classList.toggle('low', r < limit * 0.25);
      if (r <= 0 && !answered) submit(null);
    };
    tick(); timer = setInterval(tick, 100);
    keyHandler = (e) => { const n = Number(e.key); if (n >= 1 && n <= buttons.length && !answered) submit(n - 1); };
    document.addEventListener('keydown', keyHandler);

    async function submit(choice) {
      if (answered) return;
      answered = true; clearInterval(timer);
      buttons.forEach((b) => { b.disabled = true; });
      if (choice !== null) buttons[choice].classList.add('picked');
      let out;
      try {
        out = await api(`/api/quiz/${id}/answer`, { method: 'POST', body: { index: st.index, choice } });
      } catch (e) {
        if (e.status === 409) return refresh();
        toast(e.message, 'bad');
        answered = false; buttons.forEach((b) => { b.disabled = false; });
        timer = setInterval(tick, 100);
        return;
      }
      const r = out.result;
      const practice = st.mode === 'practice';
      if (practice && r.correctIndex != null) buttons[r.correctIndex]?.classList.add('right');
      if (practice && choice !== null && !r.correct) buttons[choice].classList.replace('picked', 'wrong');
      fb.replaceChildren(h('div', { class: `fb ${practice ? (r.correct ? 'good' : 'bad') : ''}` },
        h('strong', {}, !practice ? (r.timedOut ? 'Time is up. Answer locked.' : 'Answer locked.') : r.timedOut ? 'Time is up.' : r.correct ? `Correct! +${r.points} points` : 'Not quite.'),
        practice && r.explanation ? h('p', { style: { margin: '.4rem 0 0' } }, r.explanation) : null,
        !practice ? h('p', { class: 'small muted', style: { margin: '.4rem 0 0' } }, 'Answers are revealed after the contest window closes.') : null));
      if (r.done) {
        fb.append(h('button', { class: 'btn primary', style: { marginTop: '1rem' }, onclick: () => summary(out.summary) }, 'See results'));
        return;
      }
      const next = Date.now() + r.gapMs;
      const nb = h('button', { class: 'btn primary', style: { marginTop: '1rem' }, disabled: true });
      fb.append(nb);
      const nt = () => { const s = Math.ceil((next - Date.now()) / 1000); nb.textContent = `Next question in ${Math.max(0, s)}s`; if (s <= 0) { nb.textContent = 'Next question'; nb.disabled = false; nb.onclick = refresh; if (st.mode === 'contest') refresh(); } };
      nt(); timer = setInterval(nt, 250);
    }
  }

  function summary(s) {
    stop();
    const contest = s.mode === 'contest';
    root.replaceChildren(
      h('h1', {}, contest ? 'Contest finished' : 'Quiz finished'),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', {}, s.points), h('span', {}, 'points')),
        h('div', { class: 'stat' }, h('b', {}, `${s.correct}/${s.total}`), h('span', {}, 'correct')),
        h('div', { class: 'stat' }, h('b', {}, `${s.accuracy}%`), h('span', {}, 'accuracy')),
        h('div', { class: 'stat' }, h('b', {}, `${s.avgSeconds}s`), h('span', {}, 'average time'))),
      s.reviewLocked ? h('p', { class: 'note' }, 'Correct answers and explanations unlock when the contest window closes.') : null,
      s.review.length ? h('div', {}, h('h2', {}, 'Questions to revisit'), s.review.map((r) => h('div', { class: 'panel' },
        h('strong', {}, r.text), h('p', { style: { margin: '.4rem 0 0' } }, `Correct answer: ${r.correctAnswer}${r.timedOut ? ' (time ran out)' : ''}`),
        r.explanation ? h('p', { class: 'small muted', style: { margin: '.3rem 0 0' } }, r.explanation) : null))) : null,
      h('div', { class: 'row', style: { marginTop: '1.2rem' } },
        contest ? h('a', { class: 'btn primary', href: `#/contest/${s.contestId}` }, 'View contest leaderboard') : h('a', { class: 'btn primary', href: `#/quiz?subject=${s.subject}` }, 'Practice again'),
        h('a', { class: 'btn', href: '#/leaderboard' }, 'Leaderboard'),
        h('a', { class: 'btn ghost', href: '#/focus' }, 'Back to focus timer')));
  }

  await refresh();
  return root;
}
