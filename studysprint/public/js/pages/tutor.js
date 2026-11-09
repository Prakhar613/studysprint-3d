import { h } from '../lib.js';
import { buildView } from '../tutor.js';

export default function tutorPage(ctx) {
  const view = buildView({ page: true });
  ctx.onCleanup(view.cleanup);
  return h('div', { class: 'tutor-wrap' }, view);
}
