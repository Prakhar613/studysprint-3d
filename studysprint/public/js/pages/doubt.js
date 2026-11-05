import { h, api, state, ago, subjectById, errorBox, toast } from '../lib.js';
import { needLogin } from '../auth.js';

export default async function doubt(ctx) {
  const id = ctx.params.id;
  const root = h('div');
  async function load() {
    const d = await api(`/api/doubts/${id}`);
    const q = d.doubt;
    const voteBox = (type, item) => h('div', { class: 'vote' },
      h('button', { 'aria-pressed': String(item.voted), 'aria-label': item.voted ? 'Remove your vote' : 'Vote up', disabled: item.mine, onclick: () => needLogin(async () => { try { await api('/api/votes', { method: 'POST', body: { type, id: item.id } }); load(); } catch (e) { toast(e.message, 'bad'); } }) }, '▲'),
      item.votes);
    const report = (type, item) => state.user && !item.mine ? h('button', { class: 'linkbtn small', onclick: async () => { if (!confirm('Report this post to moderators?')) return; try { await api('/api/report', { method: 'POST', body: { type, id: item.id } }); toast('Thanks. Reported.'); load(); } catch (e) { toast(e.message, 'bad'); } } }, 'Report') : null;

    const text = h('textarea', { 'aria-label': 'Your answer', maxlength: 3000, placeholder: 'Explain the steps clearly so others can follow.' });
    const err = h('p', { class: 'err', hidden: true, role: 'alert' });
    const post = h('button', { class: 'btn primary', onclick: () => needLogin(async () => {
      err.hidden = true; post.disabled = true;
      try { await api(`/api/doubts/${id}/answers`, { method: 'POST', body: { body: text.value } }); load(); }
      catch (e) { err.textContent = e.message; err.hidden = false; post.disabled = false; }
    }) }, 'Post answer');

    root.replaceChildren(
      h('p', {}, h('a', { href: '#/doubts' }, 'All doubts')),
      h('div', { class: 'panel doubt' }, voteBox('doubt', q),
        h('div', {}, h('h1', { style: { fontSize: '1.8rem' } }, q.title),
          h('div', { class: 'small muted' }, `${subjectById(q.subject)?.name}, asked by ${q.author.username}${q.author.state ? ` (${q.author.state})` : ''}, ${ago(q.createdAt)} `, q.solved ? h('span', { class: 'badge good' }, 'Solved') : '', ' ', report('doubt', q)),
          h('p', { class: 'body' }, q.body))),
      h('h2', { style: { marginTop: '1.5rem' } }, `${d.answers.length} answer${d.answers.length === 1 ? '' : 's'}`),
      ...d.answers.map((a) => h('div', { class: `panel doubt ans ${a.accepted ? 'accepted' : ''}` }, voteBox('answer', a),
        h('div', {}, a.accepted ? h('span', { class: 'badge good' }, 'Accepted answer') : null,
          h('p', { class: 'body' }, a.body),
          h('div', { class: 'small muted' }, `${a.author.username}${a.author.state ? ` (${a.author.state})` : ''}, ${ago(a.createdAt)} `, report('answer', a),
            q.mine && !a.accepted ? h('button', { class: 'btn small', style: { marginLeft: '.5rem' }, onclick: async () => { try { await api(`/api/doubts/${id}/accept`, { method: 'POST', body: { answerId: a.id } }); load(); } catch (e) { toast(e.message, 'bad'); } } }, 'Accept this answer') : null)))),
      h('div', { class: 'panel' }, h('h3', {}, 'Your answer'), err, text, h('div', { style: { marginTop: '.7rem' } }, post)));
  }
  await load();
  return root;
}
