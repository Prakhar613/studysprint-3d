// Atmosphere and interaction layer. Canvas + CSS variables, no libraries.
//  - #fx canvas: flowing ember trails (flow field) and floating motes with depth, reacting to cursor and scroll
//  - CSS blobs/rays in #atmos drift and shift with the pointer (see css/fx.css)
//  - cursor ring + light, spotlight on hovered cards, 3D tilt, magnetic buttons, click ripples
//  - scroll: --depth / --sy variables, reveal-on-scroll, count-up numbers
const root = document.documentElement;
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const mod = (v, m) => ((v % m) + m) % m;

const SPOT = '.panel,.stat,.cc,.layer,.sheet,.opt,.subj button,.nums>div,.rooms,.pane,.chip,.btn';
const TILT = '.cc,.sheet';
const MAG = '.btn,.chip,.lang,.brand';
const INTERACTIVE = 'a,button,[role=button],.opt,input,select,textarea,summary,label';

// ---------- state ----------
const M = { x: -9999, y: -9999, sx: 0, sy: 0, nx: 0, ny: 0, on: false };
let cv, ctx, atmos, ring, glow;
let W = 0, H = 0, dpr = 1;
let elapsed = 0, last = 0, raf = 0;
let scrollY = 0, lastScrollY = 0, svel = 0, depth = -1;
let rx = 0, ry = 0, gx = 0, gy = 0;
let flows = [], motes = [];
let bg2d = true;
export function setBackground2D(on) {
  bg2d = on;
  if (!on && ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }
}
const TRAIL = 20, STEP = 0.09;
const COLORS = ['255,226,170', '255,170,90', '255,120,60'];
let sprites = [];

// ---------- helpers ----------
function makeSprite(rgb) {
  const s = 64, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.2, `rgba(${rgb},.8)`);
  grad.addColorStop(0.55, `rgba(${rgb},.16)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return c;
}

const MOTE_LAYERS = [
  { share: 0.55, size: [1.2, 2.2], speed: [3, 8], alpha: [0.25, 0.55], scroll: 0.06, mouse: 6 },
  { share: 0.33, size: [2.0, 3.4], speed: [7, 15], alpha: [0.25, 0.6], scroll: 0.16, mouse: 16 },
  { share: 0.12, size: [5, 9], speed: [12, 24], alpha: [0.1, 0.26], scroll: 0.38, mouse: 36 },
];

function mkMote() {
  const r = Math.random();
  const li = r < 0.55 ? 0 : r < 0.88 ? 1 : 2;
  const L = MOTE_LAYERS[li];
  return {
    l: li, c: Math.floor(Math.random() * COLORS.length), x: Math.random() * (W + 80), y: Math.random() * (H + 80),
    a: Math.random() * Math.PI * 2, av: rand(-0.25, 0.25), sp: rand(L.speed[0], L.speed[1]),
    sz: rand(L.size[0], L.size[1]), al: rand(L.alpha[0], L.alpha[1]), ph: Math.random() * 6.28, phs: rand(0.25, 0.9),
  };
}

function spawnFlow(p) {
  p.x = Math.random() * W; p.y = Math.random() * H;
  p.age = 0; p.life = rand(5, 11); p.dead = 0; p.acc = 0;
  p.cls = Math.random() < 0.5 ? 0 : Math.random() < 0.6 ? 1 : 2;
  p.sp = rand(34, 70);
  for (let i = 0; i < TRAIL; i++) { p.hx[i] = p.x; p.hy[i] = p.y; }
  return p;
}
const mkFlow = () => spawnFlow({ hx: new Float32Array(TRAIL), hy: new Float32Array(TRAIL) });

function resize() {
  W = innerWidth; H = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 1.5);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const small = W < 700;
  const nf = clamp(Math.round((W * H) / 20000 * (small ? 0.55 : 1)), 22, 70);
  const nm = clamp(Math.round((W * H) / 16000 * (small ? 0.6 : 1)), 24, 70);
  while (flows.length < nf) flows.push(mkFlow());
  flows.length = nf;
  while (motes.length < nm) motes.push(mkMote());
  motes.length = nm;
  if (!M.on) { M.x = M.sx = rx = gx = W / 2; M.y = M.sy = ry = gy = H / 2; }
  if (reduceMQ.matches) drawFrame(0, true);
}

// ---------- simulation + drawing ----------
function stepFlow(p, dt, speedMul) {
  if (p.dead > 0) {
    p.dead -= dt;
    if (p.dead <= 0) { spawnFlow(p); return; }
  } else {
    const t = elapsed;
    const ang = (Math.sin(p.x * 0.0019 + t * 0.11) + Math.cos(p.y * 0.0024 - t * 0.08) + Math.sin((p.x + p.y) * 0.0011 + t * 0.05)) * 1.15 - 0.35;
    let vx = Math.cos(ang) * p.sp;
    let vy = Math.sin(ang) * p.sp - 12; // slight upward drift, like heat rising
    if (M.on) {
      const dx = p.x - M.x, dy = p.y - M.y, d2 = dx * dx + dy * dy, R = 170;
      if (d2 < R * R) {
        const d = Math.sqrt(d2) || 1, k = (1 - d / R);
        const push = 170 * k * k;
        vx += (dx / d) * push + (-dy / d) * push * 0.6; // push away + a little swirl
        vy += (dy / d) * push + (dx / d) * push * 0.6;
      }
    }
    p.x += vx * dt * speedMul; p.y += vy * dt * speedMul;
    p.age += dt;
    if (p.age > p.life || p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) p.dead = TRAIL * STEP + 0.1;
  }
  p.acc += dt;
  if (p.acc >= STEP) {
    p.acc -= STEP;
    p.hx.copyWithin(0, 1); p.hy.copyWithin(0, 1);
    p.hx[TRAIL - 1] = p.x; p.hy[TRAIL - 1] = p.y;
  }
}

const FLOW_STYLE = [
  { rgb: '255,196,120', a: 0.34 },
  { rgb: '255,236,205', a: 0.22 },
  { rgb: '255,128,66', a: 0.3 },
];

function drawFlows() {
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.15;
  for (let c = 0; c < 3; c++) {
    const st = FLOW_STYLE[c];
    for (let k = 0; k < TRAIL; k++) {
      const al = st.a * Math.pow((k + 1) / TRAIL, 1.7);
      if (al < 0.004) continue;
      ctx.strokeStyle = `rgba(${st.rgb},${al.toFixed(3)})`;
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < flows.length; i++) {
        const p = flows[i];
        if (p.cls !== c) continue;
        const x0 = p.hx[k], y0 = p.hy[k];
        const x1 = k + 1 < TRAIL ? p.hx[k + 1] : p.x;
        const y1 = k + 1 < TRAIL ? p.hy[k + 1] : p.y;
        if (x0 === x1 && y0 === y1) continue;
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); any = true;
      }
      if (any) ctx.stroke();
    }
  }
}

function drawMotes(dt, still) {
  const boost = clamp(Math.abs(svel) / 1500, 0, 1);
  for (let i = 0; i < motes.length; i++) {
    const p = motes[i], L = MOTE_LAYERS[p.l];
    if (!still) {
      p.av = clamp(p.av + (Math.random() - 0.5) * 0.35 * dt, -0.45, 0.45);
      p.a += p.av * dt;
      p.x = mod(p.x + Math.cos(p.a) * p.sp * (1 + boost * 1.5) * dt, W + 80);
      p.y = mod(p.y + Math.sin(p.a) * p.sp * (1 + boost * 1.5) * dt, H + 80);
      p.ph += p.phs * dt;
    }
    let x = p.x - 40 - M.nx * L.mouse;
    let y = mod(p.y - scrollY * L.scroll, H + 80) - 40 - M.ny * L.mouse;
    let glowK = 1;
    if (!still && M.on) {
      const dx = x - M.sx, dy = y - M.sy, d2 = dx * dx + dy * dy;
      if (d2 < 22500) { const t = 1 - Math.sqrt(d2) / 150; glowK = 1 + 0.9 * t; }
    }
    const a = p.al * (0.55 + 0.45 * Math.sin(p.ph)) * glowK * (1 + boost * 0.35);
    const dia = p.sz * (p.l === 2 ? 5 : 3.2);
    ctx.globalAlpha = a > 1 ? 1 : a;
    ctx.drawImage(sprites[p.c], x - dia / 2, y - dia / 2, dia, dia);
  }
  ctx.globalAlpha = 1;
}

function drawFrame(dt, still) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  if (!still) {
    const speedMul = 1 + clamp(Math.abs(svel) / 1800, 0, 1) * 1.2;
    for (let i = 0; i < flows.length; i++) stepFlow(flows[i], dt, speedMul);
    drawFlows();
  }
  drawMotes(dt, still);
  ctx.globalCompositeOperation = 'source-over';
}

function frame(ts) {
  raf = requestAnimationFrame(frame);
  if (!last) last = ts;
  const dt = Math.min((ts - last) / 1000, 0.05);
  last = ts;
  if (dt <= 0) return;
  elapsed += dt;

  svel += (((scrollY - lastScrollY) / dt) - svel) * (1 - Math.exp(-dt * 5));
  lastScrollY = scrollY;

  const k = 1 - Math.exp(-dt * 5);
  M.sx += (M.x - M.sx) * k; M.sy += (M.y - M.sy) * k;
  const tx = M.on ? (M.x / W - 0.5) * 2 : 0, ty = M.on ? (M.y / H - 0.5) * 2 : 0;
  const k3 = 1 - Math.exp(-dt * 3);
  M.nx += (tx - M.nx) * k3; M.ny += (ty - M.ny) * k3;
  atmos.style.setProperty('--px', M.nx.toFixed(3));
  atmos.style.setProperty('--py', M.ny.toFixed(3));

  if (fineMQ.matches) {
    rx += (M.x - rx) * (1 - Math.exp(-dt * 14)); ry += (M.y - ry) * (1 - Math.exp(-dt * 14));
    gx += (M.x - gx) * (1 - Math.exp(-dt * 4)); gy += (M.y - gy) * (1 - Math.exp(-dt * 4));
    ring.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0) translate(-50%,-50%)`;
    glow.style.transform = `translate3d(${(gx - 260).toFixed(1)}px,${(gy - 260).toFixed(1)}px,0)`;
  }
  if (bg2d) drawFrame(dt, false);
}

// ---------- scroll ----------
let scrollTick = 0;
function onScroll() {
  if (scrollTick) return;
  scrollTick = requestAnimationFrame(() => {
    scrollTick = 0;
    scrollY = window.scrollY || 0;
    const max = root.scrollHeight - innerHeight;
    const d = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
    if (Math.abs(d - depth) > 0.0008) { depth = d; root.style.setProperty('--depth', d.toFixed(4)); }
    root.style.setProperty('--sy', scrollY.toFixed(0));
  });
}

// ---------- pointer: hover effects ----------
let lastMove = null, hraf = 0, curTilt = null, curMag = null;

function resetTilt() { if (curTilt) { curTilt.style.transform = ''; curTilt.classList.remove('tilting'); curTilt = null; } }
function resetMag() { if (curMag) { curMag.style.transform = ''; curMag = null; } }

function hoverFrame() {
  hraf = 0;
  const e = lastMove;
  if (!e || !(e.target instanceof Element)) return;
  const el = e.target, x = e.clientX, y = e.clientY;
  const fx = !reduceMQ.matches;

  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.matches(SPOT)) {
      const r = n.getBoundingClientRect();
      n.style.setProperty('--mx', (x - r.left).toFixed(1) + 'px');
      n.style.setProperty('--my', (y - r.top).toFixed(1) + 'px');
    }
  }

  const it = el.closest(INTERACTIVE);
  ring.dataset.s = it ? (it.matches('input,textarea,select') ? 'text' : 'link') : (document.body.dataset.planet ? 'link' : '');

  const tl = fx ? el.closest(TILT) : null;
  if (tl !== curTilt) { resetTilt(); curTilt = tl; if (tl) tl.classList.add('tilting'); }
  if (tl) {
    const r = tl.getBoundingClientRect();
    const px = (x - r.left) / r.width, py = (y - r.top) / r.height;
    const m = tl.classList.contains('sheet') ? 3.5 : 7;
    tl.style.transform = `perspective(900px) rotateX(${((0.5 - py) * 2 * m).toFixed(2)}deg) rotateY(${((px - 0.5) * 2 * m).toFixed(2)}deg) translateY(-4px)`;
  }

  const mg = fx ? el.closest(MAG) : null;
  if (mg !== curMag) { resetMag(); curMag = mg && !mg.disabled ? mg : null; }
  if (curMag) {
    const r = curMag.getBoundingClientRect();
    curMag.style.transform = `translate(${((x - (r.left + r.width / 2)) * 0.18).toFixed(1)}px,${((y - (r.top + r.height / 2)) * 0.28).toFixed(1)}px)`;
  }
}

function onMove(e) {
  M.x = e.clientX; M.y = e.clientY; M.on = true;
  if (e.pointerType === 'touch' || !fineMQ.matches) return;
  document.body.classList.add('has-cursor');
  lastMove = e;
  if (!hraf) hraf = requestAnimationFrame(hoverFrame);
}

function onLeave() {
  M.on = false; lastMove = null;
  resetTilt(); resetMag();
  document.body.classList.remove('has-cursor');
}

function onDown(e) {
  if (ring) ring.classList.add('down');
  const b = e.target instanceof Element ? e.target.closest('.btn,.chip,.opt,.subj button,.layer') : null;
  if (!b || b.disabled || reduceMQ.matches) return;
  const r = b.getBoundingClientRect();
  const d = Math.max(r.width, r.height) * 2.2;
  const s = document.createElement('span');
  s.className = 'ripple';
  s.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px;width:${d}px;height:${d}px`;
  b.append(s);
  s.addEventListener('animationend', () => s.remove(), { once: true });
}

// ---------- reveal + count-up (call scan(node) after rendering a page) ----------
let io = null;
function countUp(el) {
  const target = Number(el.dataset.count) || 0;
  if (reduceMQ.matches) { el.textContent = target.toLocaleString('en-IN'); return; }
  const t0 = performance.now(), dur = 1700;
  const tick = (now) => {
    const k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(target * e).toLocaleString('en-IN');
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function scan(scope = document) {
  const items = scope.querySelectorAll('.reveal:not(.in)');
  scope.querySelectorAll('[data-count]').forEach((el) => { if (!el.dataset.ready) { el.dataset.ready = '1'; el.textContent = '0'; } });
  if (!('IntersectionObserver' in window) || reduceMQ.matches) {
    items.forEach((n) => { n.classList.add('in'); n.querySelectorAll('[data-count]').forEach(countUp); });
    return;
  }
  if (!io) {
    io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        en.target.classList.add('in');
        en.target.querySelectorAll('[data-count]').forEach(countUp);
        io.unobserve(en.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  }
  items.forEach((n) => io.observe(n));
}

export function refresh() { depth = -1; onScroll(); }

// ---------- boot ----------
export function initFx() {
  cv = document.getElementById('fx');
  atmos = document.getElementById('atmos');
  ring = document.getElementById('cur');
  glow = document.getElementById('glow');
  if (!cv || !atmos || !ring || !glow) return;
  ctx = cv.getContext('2d');
  sprites = COLORS.map(makeSprite);
  resize();
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); refresh(); }, 120); });
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });
  addEventListener('pointerup', () => ring.classList.remove('down'), { passive: true });
  document.addEventListener('pointerleave', onLeave);
  addEventListener('blur', onLeave);
  document.addEventListener('visibilitychange', () => {
    if (reduceMQ.matches) return;
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
  });
  onScroll();
  if (!reduceMQ.matches) raf = requestAnimationFrame(frame);
}
