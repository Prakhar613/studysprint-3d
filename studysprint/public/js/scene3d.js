// The 3D world behind StudySprint (WebGL via three.js, hosted in /vendor/three).
//  - the Focus Core: a living, noise-displaced star. Drag it. It burns brighter while your timer runs,
//    and a ring around it fills as the session progresses.
//  - the 8 subjects as planets orbiting the core. Hover to light one up, click to open that subject's quiz.
//  - a star field, and speed streaks that stretch when you scroll fast.
//  - a camera that flies between the chapters of the home page as you scroll.
// If WebGL or the library is unavailable, initScene() returns null and the 2D background stays.
import * as pomo from './pomodoro.js';

const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const damp = (k, dt) => 1 - Math.exp(-k * dt);

export const THEME_ORDER = ['ember', 'aurora', 'nebula'];
const THEMES = {
  ember: { deep: [0.9, 0.33, 0.18], mid: [1.0, 0.54, 0.24], hot: [1.0, 0.88, 0.68] },
  aurora: { deep: [0.06, 0.62, 0.42], mid: [0.18, 0.88, 0.54], hot: [0.83, 1.0, 0.91] },
  nebula: { deep: [0.33, 0.23, 0.86], mid: [0.56, 0.42, 1.0], hot: [0.9, 0.86, 1.0] },
};

// camera position, look-at, sideways shift of the whole scene (fraction of screen width) and brightness, per chapter
// sx / sy: shift the whole scene right / up (fraction of screen); dim: overall brightness; pl: how bright the planets are
const KEYS = {
  's-hero': { p: [0, 0.6, 14], t: [0, 0, 0], sx: 0.3, sy: 0.12, dim: 1, pl: 0.4 },
  's-focus': { p: [2.2, 0.6, 7.6], t: [0, 0, 0], sx: 0.26, sy: 0, dim: 1, pl: 0.4 },
  's-subjects': { p: [0, 5.4, 18], t: [0, 0, 0], sx: 0.2, sy: 0, dim: 0.95, pl: 1 },
  's-speed': { p: [-9, 1.5, 6], t: [1, 0, -4], sx: 0.34, sy: 0, dim: 0.42, pl: 0.35 },
  's-compete': { p: [7, -3, 13], t: [0, 0, 0], sx: 0.34, sy: 0, dim: 0.42, pl: 0.3 },
  's-news': { p: [0, 7, 22], t: [0, 0, 0], sx: 0.2, sy: 0, dim: 0.32, pl: 0.3 },
  's-numbers': { p: [-6, 2, 24], t: [0, 0, 0], sx: 0, sy: 0, dim: 0.4, pl: 0.35 },
  's-go': { p: [0, 0.4, 6.6], t: [0, 0, 0], sx: 0, sy: 0, dim: 0.42, pl: 0.25 },
  idle: { p: [0, 2, 23], t: [0, 0, 0], sx: 0.2, sy: 0, dim: 0.35, pl: 0.45 },
};
const KEY_IDS = ['s-hero', 's-focus', 's-subjects', 's-speed', 's-compete', 's-news', 's-numbers', 's-go'];
// pointer over any of these means the person is using the page, not the 3D world
const BLOCK = 'a,button,input,select,textarea,summary,label,.panel,.sheet,.cc,.layer,.nums,.chart,.board,.news,p,h1,h2,h3,li,.chip,.plabel,.top,.foot,.modal,.backdrop';

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*snoise(p); p*=2.03; a*=.5; } return s; }
`;

const hexToRgb = (hex) => {
  const h = String(hex || '#ff8a3d').replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export async function initScene({ subjects = [], labelFn = () => ({ name: '', count: '' }), themeName = 'ember' } = {}) {
  let THREE;
  try { THREE = await import('/vendor/three/three.module.js'); } catch { return null; }
  const canvas = document.getElementById('gl');
  const labelsBox = document.getElementById('labels');
  if (!canvas || !labelsBox) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'default' });
  } catch { return null; }
  if (!renderer.getContext()) return null;

  const small = innerWidth < 760;
  let quality = small ? 1 : 2; // 2 = full, 1 = lighter, 0 = minimal
  const pixelRatioFor = (q) => Math.min(devicePixelRatio || 1, q === 2 ? 1.75 : q === 1 ? 1.25 : 1);
  renderer.setPixelRatio(pixelRatioFor(quality));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
  scene.add(camera);

  // ---------- shared uniforms ----------
  const theme = { deep: new THREE.Vector3(), mid: new THREE.Vector3(), hot: new THREE.Vector3() };
  const U = { uTime: { value: 0 }, uDim: { value: 1 }, uPl: { value: 1 }, uEnergy: { value: 0 }, uProgress: { value: 0 } };
  function setTheme(name) {
    const t = THEMES[name] || THEMES.ember;
    theme.deep.set(...t.deep); theme.mid.set(...t.mid); theme.hot.set(...t.hot);
    dirty = true;
  }
  let dirty = true;
  setTheme(themeName);

  // ---------- the Focus Core ----------
  const coreGroup = new THREE.Group();
  scene.add(coreGroup);
  const coreGeo = new THREE.SphereGeometry(1.6, small ? 96 : 176, small ? 64 : 112);
  const coreMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uDeep: { value: theme.deep }, uMid: { value: theme.mid }, uHot: { value: theme.hot }, uBump: { value: 0 }, uBumpDir: { value: new THREE.Vector3(0, 0, 1) } },
    vertexShader: `${NOISE}
      uniform float uTime,uEnergy,uBump; uniform vec3 uBumpDir;
      varying vec3 vN; varying vec3 vView; varying float vH;
      void main(){
        vec3 n0=normalize(position);
        float t=uTime*(.12+uEnergy*.14);
        float h=fbm(n0*1.35+vec3(0.,t,t*.6));
        float bump=pow(max(dot(n0,uBumpDir),0.),9.)*uBump;
        float disp=h*(.2+.1*uEnergy)+bump*.3;
        vH=h*.5+.5+bump*.45;
        vec4 mv=modelViewMatrix*vec4(position+n0*disp,1.);
        vN=normalize(normalMatrix*n0); vView=normalize(-mv.xyz);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `
      uniform vec3 uDeep,uMid,uHot; uniform float uDim,uEnergy;
      varying vec3 vN; varying vec3 vView; varying float vH;
      void main(){
        float f=pow(1.-max(dot(normalize(vN),normalize(vView)),0.),2.4);
        float h=clamp(vH,0.,1.);
        vec3 col=mix(uDeep*.32,uDeep,smoothstep(.15,.5,h));
        col=mix(col,uMid,smoothstep(.45,.75,h));
        col=mix(col,uHot,smoothstep(.72,1.,h)*(.7+.3*uEnergy));
        col+=uHot*f*(.5+.5*uEnergy)+uMid*f*.4;
        col*=(.78+.45*uEnergy)*uDim;
        gl_FragColor=vec4(col,1.);
      }`,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreGroup.add(coreMesh);

  const coronaMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uMid: { value: theme.mid }, uHot: { value: theme.hot } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; varying vec3 vView;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uMid,uHot; uniform float uDim,uEnergy; varying vec3 vN; varying vec3 vView;
      void main(){ float f=pow(1.-max(dot(normalize(vN),normalize(vView)),0.),2.6); vec3 c=mix(uMid,uHot,f);
        float a=f*(.75+.6*uEnergy)*uDim; gl_FragColor=vec4(c,a); }`,
  });
  coreGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1.86, 64, 48), coronaMat));

  // soft halo (texture drawn once on a small canvas)
  const haloTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.55)');
    gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
  halo.scale.set(13, 13, 1);
  scene.add(halo);

  // focus ring: fills as the Pomodoro progresses
  const progMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uMid: { value: theme.mid }, uHot: { value: theme.hot } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uMid,uHot; uniform float uProgress,uDim,uEnergy; varying vec3 vP;
      void main(){ float a=atan(vP.y,vP.x)/6.2831853+.5; float on=step(a,uProgress);
        float edge=smoothstep(uProgress-.03,uProgress,a)*on;
        vec3 c=mix(uMid,uHot,edge+.2); float al=(.1+on*(.55+.4*edge))*uDim*(.5+.5*uEnergy); gl_FragColor=vec4(c,al); }`,
  });
  const progRing = new THREE.Mesh(new THREE.RingGeometry(2.55, 2.63, 180, 1), progMat);
  progRing.rotation.x = Math.PI / 2 - 0.42; progRing.rotation.y = 0.12;
  coreGroup.add(progRing);

  // ---------- subject planets ----------
  const ringGroup = new THREE.Group();
  ringGroup.rotation.set(0.34, 0, -0.12);
  scene.add(ringGroup);
  const planetGeo = new THREE.SphereGeometry(1, small ? 40 : 64, small ? 30 : 48);
  const planets = [];
  const sprMapMat = (rgb) => new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 });
  subjects.forEach((s, i) => {
    const rgb = hexToRgb(s.color);
    const radius = 4.0 + (i % 3) * 0.5;
    const size = 0.5 + 0.11 * ((i * 3) % 5);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U, uColor: { value: new THREE.Vector3(...rgb) }, uHover: { value: 0 }, uSeed: { value: i * 7.13 } },
      vertexShader: `varying vec3 vP; varying vec3 vWN; varying vec3 vW;
        void main(){ vP=position; vWN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `${NOISE}
        uniform vec3 uColor; uniform float uHover,uDim,uPl,uSeed,uTime; varying vec3 vP; varying vec3 vWN; varying vec3 vW;
        void main(){
          float n=fbm(vP*2.3+uSeed);
          float b=sin(vP.y*7.+n*3.5+uSeed)*.5+.5;
          vec3 base=mix(uColor*.42,uColor*1.15,b*.55+n*.35+.2);
          vec3 L=normalize(-vW); vec3 V=normalize(cameraPosition-vW); vec3 N=normalize(vWN);
          float diff=max(dot(N,L),0.);
          float fres=pow(1.-max(dot(N,V),0.),3.);
          vec3 col=base*(.1+diff*1.15)+uColor*fres*(.55+uHover*1.3)+uColor*uHover*.28;
          gl_FragColor=vec4(col*uDim*(.25+.75*uPl),1.);
        }`,
    });
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(planetGeo, mat);
    mesh.scale.setScalar(size);
    mesh.userData.id = s.id;
    g.add(mesh);
    const spr = new THREE.Sprite(sprMapMat(rgb));
    spr.scale.setScalar(size * 4.4);
    g.add(spr);
    if (i % 3 === 0) { // a few get rings
      const rm = new THREE.Mesh(new THREE.RingGeometry(size * 1.5, size * 2.1, 72), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace), transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
      rm.rotation.x = Math.PI / 2 - 0.35; rm.rotation.y = 0.3;
      g.add(rm);
    }
    ringGroup.add(g);
    const orbit = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, k) => new THREE.Vector3(Math.cos((k / 128) * 6.2832) * radius, 0, Math.sin((k / 128) * 6.2832) * radius))),
      new THREE.LineBasicMaterial({ color: new THREE.Color().setRGB(1, 1, 1), transparent: true, opacity: 0.07, depthWrite: false }),
    );
    ringGroup.add(orbit);
    planets.push({ id: s.id, group: g, mesh, mat, spr, radius, angle: (i / subjects.length) * Math.PI * 2, speed: 0.05 + (i % 4) * 0.012, size, hover: 0, rgb });
  });

  // ---------- star field ----------
  const starCount = small ? 1300 : 3200, dustCount = small ? 160 : 520;
  const sPos = new Float32Array((starCount + dustCount) * 3), sSize = new Float32Array(starCount + dustCount), sPh = new Float32Array(starCount + dustCount), sMix = new Float32Array(starCount + dustCount);
  for (let i = 0; i < starCount + dustCount; i++) {
    const dust = i >= starCount;
    const r = dust ? 6 + Math.random() * 26 : 28 + Math.pow(Math.random(), 0.7) * 150;
    const th = Math.random() * 6.2832, ph = Math.acos(2 * Math.random() - 1);
    sPos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * (dust ? 0.5 : 1), r * Math.sin(ph) * Math.sin(th)], i * 3);
    sSize[i] = dust ? 2.2 + Math.random() * 3.4 : 0.6 + Math.random() * 1.6;
    sPh[i] = Math.random() * 6.28; sMix[i] = Math.random() < 0.3 ? 1 : 0;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(sPh, 1));
  starGeo.setAttribute('aMix', new THREE.BufferAttribute(sMix, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uPx: { value: renderer.getPixelRatio() }, uHot: { value: theme.hot }, uMid: { value: theme.mid } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSize; attribute float aPhase; attribute float aMix; uniform float uTime,uPx; varying float vA; varying float vM;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=clamp(aSize*uPx*(260./-mv.z),1.,26.);
        vA=.45+.55*sin(uTime*.8+aPhase); vM=aMix; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uHot,uMid; uniform float uDim; varying float vA; varying float vM;
      void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); a*=a;
        vec3 c=mix(vec3(.92,.94,1.),mix(uMid,uHot,.6),vM); gl_FragColor=vec4(c,a*vA*(.35+.65*uDim)); }`,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  // ---------- speed streaks (fly past the camera when you scroll fast) ----------
  const nStreak = small ? 160 : 420;
  const stPos = new Float32Array(nStreak * 6), stEnd = new Float32Array(nStreak * 2), stSeed = new Float32Array(nStreak * 2);
  for (let i = 0; i < nStreak; i++) {
    const r = 2.6 + Math.random() * 18, th = Math.random() * 6.2832, z0 = Math.random() * 90, sd = Math.random();
    for (let e = 0; e < 2; e++) { stPos.set([Math.cos(th) * r, Math.sin(th) * r, z0], (i * 2 + e) * 3); stEnd[i * 2 + e] = e; stSeed[i * 2 + e] = sd; }
  }
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(stPos, 3));
  streakGeo.setAttribute('aEnd', new THREE.BufferAttribute(stEnd, 1));
  streakGeo.setAttribute('aSeed', new THREE.BufferAttribute(stSeed, 1));
  const streakMat = new THREE.ShaderMaterial({
    uniforms: { uScroll: { value: 0 }, uLen: { value: 0 }, uWarp: { value: 0 }, uHot: { value: theme.hot } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aEnd; attribute float aSeed; uniform float uScroll,uLen,uWarp; varying float vA;
      void main(){ float z=-mod(position.z+uScroll,90.); vec4 mv=modelViewMatrix*vec4(position.xy,z-aEnd*uLen*(.5+aSeed),1.);
        vA=uWarp*(1.-clamp(-z/90.,0.,1.))*(1.-aEnd*.9); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uHot; varying float vA; void main(){ gl_FragColor=vec4(uHot,vA*.9); }`,
  });
  const streaks = new THREE.LineSegments(streakGeo, streakMat);
  streaks.frustumCulled = false;
  camera.add(streaks);

  // ---------- html labels over the planets ----------
  let labelEls = [];
  function refreshLabels() {
    labelsBox.replaceChildren();
    labelEls = planets.map((p) => {
      const info = labelFn(p.id) || {};
      const a = document.createElement('a');
      a.className = 'plabel'; a.href = `#/quiz?subject=${encodeURIComponent(p.id)}`;
      a.style.setProperty('--c', '#' + p.rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join(''));
      a.dataset.sid = p.id;
      const b = document.createElement('b'); b.textContent = info.name || p.id;
      const s = document.createElement('span'); s.textContent = info.count || '';
      a.append(b, s);
      a.addEventListener('pointerenter', () => { labelHover = p.id; });
      a.addEventListener('pointerleave', () => { if (labelHover === p.id) labelHover = null; });
      labelsBox.append(a);
      return a;
    });
  }
  let labelHover = null, rowHover = null, hoverId = null;
  refreshLabels();

  // ---------- state: layout, camera rig, input ----------
  let W = 1, H = 1, isHome = false, secs = [];
  const ndc = { x: 0, y: 0, on: false };
  const mouse = { x: 0, y: 0 }; // smoothed
  let lastTarget = null, svel = 0, lastScroll = scrollY, warp = 0, scrollAcc = 0;
  let coreHover = false, drag = null, spinVel = { x: 0, y: 0 }, pending = { x: 0, y: 0 };
  let subjectsWeight = 0;
  const cam = { p: new THREE.Vector3(...KEYS.idle.p), t: new THREE.Vector3(...KEYS.idle.t), sx: KEYS.idle.sx, sy: 0, dim: 0, pl: 0 };
  const tmp = new THREE.Vector3(), look = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const energy = { v: 0, p: 0 };

  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    dirty = true;
    measure();
  }
  function measure() {
    secs = KEY_IDS.map((id) => { const el = document.getElementById(id); if (!el) return null; const r = el.getBoundingClientRect(); return { id, top: r.top + scrollY, h: r.height }; }).filter(Boolean);
    dirty = true;
  }

  function rigTarget() {
    subjectsWeight = 0;
    if (!isHome || secs.length < 2) return KEYS.idle;
    const m = scrollY + innerHeight * 0.55;
    let i = 0;
    for (let k = 0; k < secs.length; k++) if (secs[k].top <= m) i = k;
    const a = secs[i], b = secs[i + 1];
    const ka = KEYS[a.id], kb = b ? KEYS[b.id] : ka;
    let t = 0;
    if (b) t = smooth(clamp(((m - a.top) / (b.top - a.top) - 0.45) / 0.55, 0, 1));
    if (a.id === 's-subjects') subjectsWeight += 1 - t;
    if (b && b.id === 's-subjects') subjectsWeight += t;
    return {
      p: [lerp(ka.p[0], kb.p[0], t), lerp(ka.p[1], kb.p[1], t), lerp(ka.p[2], kb.p[2], t)],
      t: [lerp(ka.t[0], kb.t[0], t), lerp(ka.t[1], kb.t[1], t), lerp(ka.t[2], kb.t[2], t)],
      sx: lerp(ka.sx, kb.sx, t), sy: lerp(ka.sy, kb.sy, t), dim: lerp(ka.dim, kb.dim, t), pl: lerp(ka.pl, kb.pl, t),
    };
  }

  const blocked = () => !!(lastTarget && lastTarget.closest && lastTarget.closest(BLOCK));

  function pick() {
    const fine = fineMQ.matches && ndc.on && !blocked() && isHome && !drag;
    let pid = null, ch = false;
    if (fine) {
      ray.setFromCamera(ndc, camera);
      if (subjectsWeight > 0.5) {
        const hit = ray.intersectObjects(planets.map((p) => p.mesh), false)[0];
        if (hit) pid = hit.object.userData.id;
      }
      if (!pid) ch = ray.intersectObject(coreMesh, false).length > 0;
    }
    hoverId = pid || (!blocked() ? null : null);
    coreHover = ch;
    document.body.dataset.planet = pid ? '1' : '';
    document.body.classList.toggle('core-hover', ch || !!drag);
    if (ch) {
      const hit = ray.intersectObject(coreMesh, false)[0];
      if (hit) { tmp.copy(hit.point); coreMesh.worldToLocal(tmp).normalize(); coreMat.uniforms.uBumpDir.value.copy(tmp); }
    }
  }

  function onMove(e) {
    ndc.x = (e.clientX / W) * 2 - 1; ndc.y = -(e.clientY / H) * 2 + 1; ndc.on = true; lastTarget = e.target;
    if (drag) { pending.x += e.clientX - drag.x; pending.y += e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0); }
    dirty = true;
  }
  function onDown(e) {
    lastTarget = e.target;
    if (e.pointerType === 'touch' || !coreHover || blocked()) return;
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    document.body.classList.add('dragging');
  }
  function onUp() { if (drag) { drag = null; document.body.classList.remove('dragging'); } }
  function onClick(e) {
    lastTarget = e.target;
    if (hoverId && !blocked()) { location.hash = `#/quiz?subject=${encodeURIComponent(hoverId)}`; }
  }
  function onLeave() { ndc.on = false; hoverId = null; coreHover = false; document.body.dataset.planet = ''; }
  function onRowOver(e) { const l = e.target.closest && e.target.closest('.layer[data-sid]'); rowHover = l ? l.dataset.sid : null; }

  addEventListener('resize', () => { clearTimeout(resize.t); resize.t = setTimeout(resize, 100); });
  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onDown, { passive: true });
  addEventListener('pointerup', onUp, { passive: true });
  addEventListener('click', onClick);
  document.addEventListener('pointerleave', onLeave);
  document.addEventListener('pointerover', onRowOver, { passive: true });
  const appEl = document.getElementById('app');
  if (appEl && 'ResizeObserver' in window) new ResizeObserver(() => measure()).observe(appEl);

  // ---------- frame loop ----------
  let last = 0, raf = 0, frames = 0, slow = 0, running = true;
  const reduce = () => reduceMQ.matches;
  resize();

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!last) last = ts;
    const dt = Math.min((ts - last) / 1000, 0.05); last = ts;
    const still = reduce();
    if (still && !dirty) return;
    const step = still ? 0.016 : dt;
    if (step <= 0) return;
    U.uTime.value += still ? 0 : step;

    // scroll velocity, warp
    const sy = scrollY;
    svel += (((sy - lastScroll) / Math.max(step, 0.001)) - svel) * damp(5, step); lastScroll = sy;
    warp += ((still ? 0 : clamp(Math.abs(svel) / 2400, 0, 1)) - warp) * damp(4, step);
    scrollAcc += (svel * 0.012 + (still ? 0 : 0.5)) * step;
    streakMat.uniforms.uScroll.value = scrollAcc;
    streakMat.uniforms.uWarp.value = quality === 0 ? 0 : warp;
    streakMat.uniforms.uLen.value = warp * 14;

    // pomodoro -> core energy + progress ring
    const r = pomo.getRun();
    let eT = 0, pT = 0;
    if (r) {
      const tot = r.minutes * 60000, rem = pomo.remaining();
      if (r.phase === 'focus') { eT = r.paused != null ? 0.4 : 1; pT = clamp((tot - rem) / tot, 0, 1); } else eT = 0.3;
    }
    energy.v += (eT - energy.v) * damp(2.2, step); energy.p += (pT - energy.p) * damp(3, step);
    U.uEnergy.value = energy.v; U.uProgress.value = energy.p;

    // camera rig
    const tg = rigTarget();
    const k = still ? 1 : damp(2.8, step);
    cam.p.x += (tg.p[0] - cam.p.x) * k; cam.p.y += (tg.p[1] - cam.p.y) * k; cam.p.z += (tg.p[2] - cam.p.z) * k;
    cam.t.x += (tg.t[0] - cam.t.x) * k; cam.t.y += (tg.t[1] - cam.t.y) * k; cam.t.z += (tg.t[2] - cam.t.z) * k;
    cam.sx += (tg.sx - cam.sx) * k; cam.sy += (tg.sy - cam.sy) * k; cam.dim += (tg.dim - cam.dim) * k; cam.pl += (tg.pl - cam.pl) * k;
    U.uDim.value = cam.dim; U.uPl.value = cam.pl;
    const mk = damp(3, step);
    mouse.x += ((ndc.on ? ndc.x : 0) - mouse.x) * mk; mouse.y += ((ndc.on ? ndc.y : 0) - mouse.y) * mk;
    const bob = still ? 0 : Math.sin(U.uTime.value * 0.25) * 0.14;
    camera.position.set(cam.p.x + mouse.x * 0.9, cam.p.y + mouse.y * 0.55 + bob, cam.p.z);
    look.set(cam.t.x, cam.t.y, cam.t.z);
    camera.lookAt(look);
    camera.setViewOffset(W, H, -cam.sx * W, cam.sy * H, W, H);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    // objects
    const t = U.uTime.value;
    if (!still) {
      ringGroup.rotation.y += step * 0.02;
      stars.rotation.y += step * 0.004;
      if (!drag) { coreGroup.rotation.y += step * (0.06 + energy.v * 0.1) + spinVel.y * step; coreGroup.rotation.x += spinVel.x * step; spinVel.x *= Math.exp(-step * 1.8); spinVel.y *= Math.exp(-step * 1.8); }
    }
    if (drag && (pending.x || pending.y)) {
      coreGroup.rotation.y += pending.x * 0.007; coreGroup.rotation.x += pending.y * 0.007;
      spinVel.y = (pending.x * 0.007) / Math.max(step, 0.008); spinVel.x = (pending.y * 0.007) / Math.max(step, 0.008);
      pending.x = pending.y = 0;
    }
    halo.material.opacity = (0.28 + energy.v * 0.4) * cam.dim;
    halo.material.color.setRGB(theme.mid.x, theme.mid.y, theme.mid.z);
    const want = hoverId || labelHover || rowHover;
    planets.forEach((p) => {
      if (!still) p.angle += p.speed * step * (want === p.id ? 0.25 : 1);
      p.group.position.set(Math.cos(p.angle) * p.radius, Math.sin(p.angle * 2 + p.size * 9) * 0.25, Math.sin(p.angle) * p.radius);
      p.hover += ((want === p.id ? 1 : 0) - p.hover) * damp(7, step);
      p.mat.uniforms.uHover.value = p.hover;
      p.mesh.scale.setScalar(p.size * (1 + p.hover * 0.28));
      p.spr.material.opacity = (0.32 + p.hover * 0.5) * cam.dim * cam.pl;
      p.mesh.rotation.y += step * 0.2;
    });
    pick();
    document.querySelectorAll('.layer.hot').forEach((el) => { if (el.dataset.sid !== want) el.classList.remove('hot'); });
    if (want) { const row = document.querySelector(`.layer[data-sid="${CSS.escape(want)}"]`); if (row) row.classList.add('hot'); }

    // labels
    const showLabels = subjectsWeight > 0.55 && innerWidth >= 1000 && isHome;
    const lo = clamp((subjectsWeight - 0.55) * 2.4, 0, 1);
    labelEls.forEach((el, i) => {
      const p = planets[i];
      if (!showLabels) { if (el.style.opacity !== '0') { el.style.opacity = '0'; el.classList.remove('on'); } return; }
      p.group.getWorldPosition(tmp);
      tmp.y += p.size * 1.35;
      tmp.project(camera);
      const vis = tmp.z < 1 && tmp.x > -1.1 && tmp.x < 1.1;
      el.style.transform = `translate(${((tmp.x * 0.5 + 0.5) * W).toFixed(1)}px,${((-tmp.y * 0.5 + 0.5) * H).toFixed(1)}px) translate(-50%,-100%)`;
      el.style.opacity = vis ? lo.toFixed(2) : '0';
      el.classList.toggle('on', vis && lo > 0.5);
      el.classList.toggle('hot', want === p.id);
    });

    renderer.render(scene, camera);
    dirty = false;

    // adapt quality to the device
    frames++;
    if (!still && frames > 40 && frames <= 220) { if (dt > 0.034) slow++; }
    if (frames === 220 && slow > 90 && quality > 0) {
      quality--; renderer.setPixelRatio(pixelRatioFor(quality)); starMat.uniforms.uPx.value = renderer.getPixelRatio(); resize();
      if (quality === 0) starGeo.setDrawRange(0, Math.floor((starCount + dustCount) * 0.5));
      frames = 0; slow = 0;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; running = false; } else if (!raf) { last = 0; running = true; raf = requestAnimationFrame(frame); }
  });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; document.documentElement.classList.remove('gl'); window.dispatchEvent(new CustomEvent('scenefail')); });
  raf = requestAnimationFrame(frame);

  return {
    setRoute(home) { isHome = !!home; dirty = true; measure(); },
    measure,
    refreshLabels,
    setTheme,
    get quality() { return quality; },
  };
}
