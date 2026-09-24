// Ambiente 3D: céu, terreno pintado, árvores e mato com vento, água animada,
// texturas procedurais e partículas (borboletas, vaga-lumes, folhas, poeira).
import * as THREE from '../lib/three.module.min.js';
import { GRADIENT } from './models.js';

// uniforms compartilhados pelos shaders (tempo e posição do herói)
export const shared = { time: { value: 0 }, player: { value: new THREE.Vector3(0, -99, 0) } };
const OUTLINE_COLOR = '#1a1410';
let ANISO = 4;
export function setAnisotropy(n) { ANISO = n; }

// ------------------------------------------------ climas / horários
export const SKIES = {
  day: {
    top: '#3f8fe6', horizon: '#cfeeff', bottom: '#b8dff0', fog: '#c8e8f8', fogNear: 22, fogFar: 60,
    sunDir: [0.55, 0.78, 0.35], sunGlow: '#fff1d0', sunLight: '#fff4e0', sunI: 1.75,
    hemiSky: '#e6f4ff', hemiGround: '#7a9a55', hemiI: 1.05,
    grass: '#6dbb4f', grassDark: '#4f9a3c', grassLight: '#86cc5c', tall: '#3f9038',
    path: '#dcbc8c', pathEdge: '#b48c5c', sand: '#eedb9f', bank: '#c8b07a',
    waterShallow: '#7fd0d4', waterDeep: '#2a78ac', water: '#3a9ee0',
    trunk: '#7a4e2a', pine: ['#2e7a44', '#3f944f', '#58b05c'], leaf: ['#4aa246', '#62ba52', '#7ccc62'], palm: '#4fae4a',
    mountain: '#6f9c8a', snow: true, clouds: true, cloud: '#ffffff', cloudShade: '#a8c4e0',
    kinds: { round: 0.55, pine: 0.45 }, butterflies: true,
  },
  beach: {
    top: '#2c9aea', horizon: '#d8f6ff', bottom: '#c0e8f4', fog: '#d0f0fa', fogNear: 24, fogFar: 64,
    sunDir: [0.4, 0.8, 0.45], sunGlow: '#fff6dc', sunLight: '#fff8ea', sunI: 1.85,
    hemiSky: '#e8f8ff', hemiGround: '#b0a070', hemiI: 1.1,
    grass: '#78c257', grassDark: '#5aa545', grassLight: '#92d468', tall: '#4a9a3c',
    path: '#e2c894', pathEdge: '#bf9c68', sand: '#f2e2ac', bank: '#e6d096',
    waterShallow: '#8ae6e0', waterDeep: '#1f7ab8', water: '#2fb2e6',
    trunk: '#8a5a32', pine: ['#2e7a44', '#3f944f', '#58b05c'], leaf: ['#4aa84a', '#66c054', '#80d066'], palm: '#4cb44a',
    mountain: '#7fb0b0', snow: false, clouds: true, cloud: '#ffffff', cloudShade: '#b0d4ea',
    kinds: { palm: 0.6, round: 0.4 }, butterflies: true,
  },
  forest: {
    top: '#1f3d33', horizon: '#6a9a7c', bottom: '#4a705c', fog: '#56806a', fogNear: 9, fogFar: 34,
    sunDir: [0.3, 0.9, 0.25], sunGlow: '#e0f0c0', sunLight: '#e8f4d0', sunI: 0.95,
    hemiSky: '#b0d8b8', hemiGround: '#3a5a30', hemiI: 0.8,
    grass: '#3f8a3e', grassDark: '#2c6a30', grassLight: '#4f9c46', tall: '#2c7a30',
    path: '#b89a6e', pathEdge: '#8a6e48', sand: '#c8b080', bank: '#8a7a50',
    waterShallow: '#5aa0a0', waterDeep: '#1f5a70', water: '#2a7aa0',
    trunk: '#5e3c22', pine: ['#1f5a34', '#2a6e3e', '#3a8448'], leaf: ['#2e7a36', '#3e8e40', '#58a44c'], palm: '#3a8a3a',
    mountain: '#2f5a45', snow: false, clouds: false,
    kinds: { pine: 0.75, round: 0.25 }, fireflies: true, leaves: true,
  },
  sunset: {
    top: '#2d2f6e', horizon: '#ffb27a', bottom: '#d08a70', fog: '#eaa888', fogNear: 20, fogFar: 58,
    sunDir: [0.35, 0.16, -0.92], sunGlow: '#ffcf8a', sunLight: '#ffb878', sunI: 1.5,
    hemiSky: '#ffd4b8', hemiGround: '#6a5a4a', hemiI: 0.95,
    grass: '#8aae4e', grassDark: '#6a9040', grassLight: '#a4c260', tall: '#6a9a38',
    path: '#dcb488', pathEdge: '#b08458', sand: '#e8cc98', bank: '#b89a6a',
    waterShallow: '#e0a890', waterDeep: '#5a4a8a', water: '#8a78c0',
    trunk: '#6a4028', pine: ['#3a6a3a', '#4a7e42', '#62924a'], leaf: ['#d8702a', '#e8a030', '#c84a2a'], palm: '#8aa040',
    mountain: '#6a5a8a', snow: true, clouds: true, cloud: '#ffd8c8', cloudShade: '#b07890',
    kinds: { round: 0.6, pine: 0.4 }, motes: true,
  },
  storm: {
    top: '#1c2036', horizon: '#6a6c8c', bottom: '#4a4a62', fog: '#5c5e7c', fogNear: 14, fogFar: 46,
    sunDir: [0.2, 0.9, 0.3], sunGlow: '#9098c0', sunLight: '#c8d0ff', sunI: 1.0,
    hemiSky: '#b0b8e0', hemiGround: '#4a4a52', hemiI: 0.85,
    grass: '#6a8a5a', grassDark: '#4a6a44', grassLight: '#88a070', tall: '#4a7a44',
    path: '#a89a88', pathEdge: '#7a6e62', sand: '#b8ae98', bank: '#8a8070',
    waterShallow: '#6a8aa0', waterDeep: '#2a3a5a', water: '#4a6a8a',
    trunk: '#5a4030', pine: ['#2a4a3a', '#34584a', '#446a56'], leaf: ['#3a5a3a', '#4a6a44', '#5a7a4c'], palm: '#4a6a44',
    mountain: '#4a4a6a', snow: true, clouds: true, cloud: '#8a8aa8', cloudShade: '#3a3a5a',
    kinds: { pine: 1 }, lightning: true, motes: true,
  },
};

export function hash(x, z) {
  let h = (x * 374761393 + z * 668265263) ^ 0x5bd1e995;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = ANISO;
  return t;
}
function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ------------------------------------------------ vento (shader)
// Balança a parte de cima da geometria e, opcionalmente, afasta o mato do herói.
export function windify(mat, { base = 0.5, amp = 0.05, push = 0 } = {}) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = shared.time;
    sh.uniforms.uPlayer = shared.player;
    sh.vertexShader = 'uniform float uTime;\nuniform vec3 uPlayer;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 wpos = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        wpos = instanceMatrix * wpos;
      #endif
      wpos = modelMatrix * wpos;
      float hf = max(0.0, transformed.y - ${base.toFixed(3)});
      float sway = sin(uTime * 1.7 + wpos.x * 0.45 + wpos.z * 0.3) + 0.5 * sin(uTime * 2.9 + wpos.z * 0.8 + wpos.x * 0.2);
      wpos.x += sway * hf * ${amp.toFixed(4)};
      wpos.z += sway * hf * ${(amp * 0.6).toFixed(4)};
      ${push ? `
      vec2 dxz = wpos.xz - uPlayer.xz;
      float dd = length(dxz);
      float pf = smoothstep(0.9, 0.1, dd) * hf * ${push.toFixed(3)};
      wpos.xz += (dxz / max(dd, 0.001)) * pf;
      wpos.y -= pf * 0.6;` : ''}
      vec4 mvPosition = viewMatrix * wpos;
      gl_Position = projectionMatrix * mvPosition;
    `);
  };
  mat.customProgramCacheKey = () => `wind-${base}-${amp}-${push}-${mat.type}`;
  return mat;
}

// ------------------------------------------------ céu
export function makeSky(p) {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(p.top) }, horizon: { value: new THREE.Color(p.horizon) },
      bottom: { value: new THREE.Color(p.bottom) }, sunColor: { value: new THREE.Color(p.sunGlow) },
      sunDir: { value: new THREE.Vector3(...p.sunDir).normalize() },
    },
    vertexShader: `varying vec3 vDir;
      void main() { vDir = normalize(position); vec4 q = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = q.xyww; }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunColor; uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizon, bottom, pow(clamp(-h, 0.0, 1.0), 0.35));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunColor * (smoothstep(0.9975, 0.999, s) * 1.4 + pow(s, 28.0) * 0.35 + pow(s, 5.0) * 0.1);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  g.add(dome);
  if (p.clouds) {
    const clouds = makeClouds(p);
    g.add(clouds);
    g.userData.clouds = clouds;
  }
  return g;
}

function makeClouds(p) {
  const r = rng(42);
  const puffs = [];
  for (let c = 0; c < 11; c++) {
    const a = r() * Math.PI * 2, dist = 62 + r() * 22, y = 14 + r() * 16;
    const cx = Math.cos(a) * dist, cz = Math.sin(a) * dist;
    const n = 4 + Math.floor(r() * 4), sz = 3 + r() * 3;
    for (let i = 0; i < n; i++) {
      const ox = (i - n / 2) * sz * 0.7 + (r() - 0.5) * sz;
      puffs.push([cx + ox * Math.sin(a), y + (r() - 0.3) * sz * 0.5, cz - ox * Math.cos(a), sz * (0.7 + r() * 0.6)]);
    }
  }
  const mat = new THREE.MeshLambertMaterial({ color: p.cloud, emissive: p.cloudShade, emissiveIntensity: 0.55, fog: false });
  const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat, puffs.length);
  const m4 = new THREE.Matrix4();
  puffs.forEach(([x, y, z, s], i) => {
    m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.62, s));
    im.setMatrixAt(i, m4);
  });
  im.frustumCulled = false;
  return im;
}

// Montanhas e colinas distantes, suavizadas pela neblina
export function makeMountains(cx, cz, radius, p, seed = 1) {
  const g = new THREE.Group();
  const r = rng(seed * 97 + 13);
  const mat = new THREE.MeshToonMaterial({ color: p.mountain, gradientMap: GRADIENT });
  const hill = new THREE.MeshToonMaterial({ color: p.grassDark, gradientMap: GRADIENT });
  const snow = new THREE.MeshToonMaterial({ color: '#f4f8ff', gradientMap: GRADIENT });
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + r() * 0.2;
    const d = radius + 6 + r() * 14;
    const h = 7 + r() * 13, rad = 5 + r() * 7;
    const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 6 + Math.floor(r() * 3)), mat);
    m.position.set(cx + Math.cos(a) * d, h / 2 - 1.5, cz + Math.sin(a) * d);
    m.rotation.y = r() * 3;
    g.add(m);
    if (p.snow && h > 15) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.3, h * 0.3, m.geometry.parameters.radialSegments), snow);
      cap.position.set(m.position.x, h - 1.5 - h * 0.15 + 0.02, m.position.z);
      cap.rotation.y = m.rotation.y;
      g.add(cap);
    }
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + r();
    const d = radius + r() * 6;
    const s = 4 + r() * 5;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), hill);
    m.scale.set(s * 1.4, s * 0.45, s);
    m.position.set(cx + Math.cos(a) * d, -0.5, cz + Math.sin(a) * d);
    g.add(m);
  }
  return g;
}

// ------------------------------------------------ padrões de textura
const patCache = new Map();
function pattern(name, draw, size = 64) {
  if (patCache.has(name)) return patCache.get(name);
  const c = makeCanvas(size, size);
  draw(c.getContext('2d'), size, rng(name.length * 131 + 7));
  patCache.set(name, c);
  return c;
}
const grassPat = () => pattern('grass', (g, s, r) => {
  for (let i = 0; i < 140; i++) {
    const x = r() * s, y = r() * s, len = 2.5 + r() * 5, ang = -Math.PI / 2 + (r() - 0.5) * 0.9;
    g.strokeStyle = r() < 0.55 ? 'rgba(20,60,10,0.20)' : 'rgba(230,255,170,0.16)';
    g.lineWidth = 1 + r() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
  }
});
const pebblePat = () => pattern('pebble', (g, s, r) => {
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(90,60,30,${0.05 + r() * 0.12})`; g.fillRect(r() * s, r() * s, 1.5, 1.5); }
  for (let i = 0; i < 16; i++) {
    const x = r() * s, y = r() * s, w = 1.5 + r() * 2.5;
    g.fillStyle = r() < 0.5 ? 'rgba(120,100,80,0.45)' : 'rgba(255,245,220,0.5)';
    g.beginPath(); g.ellipse(x, y, w, w * 0.7, r() * 3, 0, Math.PI * 2); g.fill();
  }
});
const sandPat = () => pattern('sand', (g, s, r) => {
  for (let i = 0; i < 300; i++) { g.fillStyle = r() < 0.5 ? 'rgba(160,120,60,0.12)' : 'rgba(255,255,240,0.2)'; g.fillRect(r() * s, r() * s, 1.2, 1.2); }
  for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(255,250,240,0.6)'; g.beginPath(); g.arc(r() * s, r() * s, 1.2, 0, 7); g.fill(); }
});

// ------------------------------------------------ terreno
// Uma malha única com textura pintada à mão (trilhas com bordas suaves,
// margens de água, sombra perto das casas) e colinas fora do mapa.
export function buildTerrain({ W, H, PAD, tileExt, preset: p, buildings = [], isBuilding }) {
  const TW = W + 2 * PAD, TH = H + 2 * PAD, PX = 32;
  const isW = (x, z) => tileExt(x, z) === 'W';

  function heightAt(vx, vz) {
    const near = v => Math.abs(v - Math.round(v)) < 0.01 ? [Math.round(v)] : [Math.floor(v), Math.floor(v) + 1];
    let allW = true;
    for (const x of near(vx)) for (const z of near(vz)) if (!isW(x, z)) allW = false;
    let h = allW ? -0.5 - vnoise(vx * 0.7, vz * 0.7) * 0.18 : 0;
    const dx = Math.max(-0.5 - vx, vx - (W - 0.5), 0), dz = Math.max(-0.5 - vz, vz - (H - 0.5), 0);
    const dOut = Math.hypot(dx, dz);
    if (dOut > 0 && !allW) h += smooth(1.5, PAD, dOut) * (0.7 + vnoise(vx * 0.13 + 5, vz * 0.13 + 9) * 2.8);
    return h;
  }

  // 1) cores base em baixa resolução (1 pixel por quadrado), ampliadas com suavização
  const vc = makeCanvas(TW, TH), vg = vc.getContext('2d');
  const C = hex => new THREE.Color(hex);
  const cGrass = C(p.grass), cDark = C(p.grassDark), cLight = C(p.grassLight), cTall = C(p.tall);
  const cBank = C(p.bank), cShallow = C(p.waterShallow), cDeep = C(p.waterDeep), cAO = C(p.grassDark).multiplyScalar(0.55);
  const img = vg.createImageData(TW, TH);
  const tmp = new THREE.Color();
  for (let z = -PAD; z < H + PAD; z++) for (let x = -PAD; x < W + PAD; x++) {
    const t = tileExt(x, z);
    const v = hash(x * 3 + 1, z * 7 + 2);
    tmp.copy(cGrass).lerp(v < 0.5 ? cDark : cLight, Math.abs(v - 0.5) * 0.7);
    if (t === 'T') tmp.lerp(cDark, 0.55);
    if (t === 'G') tmp.lerp(cTall, 0.55);
    if (t === 'W') {
      let deep = true;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!isW(x + dx, z + dz)) deep = false;
      tmp.copy(deep ? cDeep : cShallow);
    } else if (isW(x + 1, z) || isW(x - 1, z) || isW(x, z + 1) || isW(x, z - 1)) tmp.lerp(cBank, 0.6);
    if (isBuilding && isBuilding(x, z)) tmp.copy(cAO);
    const i = ((z + PAD) * TW + (x + PAD)) * 4;
    img.data[i] = tmp.r * 255; img.data[i + 1] = tmp.g * 255; img.data[i + 2] = tmp.b * 255; img.data[i + 3] = 255;
  }
  vg.putImageData(img, 0, 0);
  const c = makeCanvas(TW * PX, TH * PX), g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(vc, 0, 0, c.width, c.height);
  g.fillStyle = g.createPattern(grassPat(), 'repeat');
  g.fillRect(0, 0, c.width, c.height);

  const X = x => (x + PAD) * PX, Z = z => (z + PAD) * PX;
  // 2) camadas de areia e de trilha com bordas arredondadas
  // máscara em 1 pixel por quadrado, ampliada com suavização e cortada num limiar:
  // gera contornos lisos com cantos arredondados e uma borda mais escura
  const rgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const layer = (match, edge, fill, pat) => {
    const mc = makeCanvas(TW, TH), mg = mc.getContext('2d');
    const md = mg.createImageData(TW, TH);
    let any = false;
    for (let z = -PAD; z < H + PAD; z++) for (let x = -PAD; x < W + PAD; x++) {
      const i = ((z + PAD) * TW + (x + PAD)) * 4;
      const v = match(tileExt(x, z)) ? 255 : 0;
      if (v) any = true;
      md.data[i] = md.data[i + 1] = md.data[i + 2] = v; md.data[i + 3] = 255;
    }
    if (!any) return;
    mg.putImageData(md, 0, 0);
    const lc = makeCanvas(c.width, c.height), lg = lc.getContext('2d');
    lg.imageSmoothingEnabled = true;
    lg.imageSmoothingQuality = 'high';
    lg.drawImage(mc, 0, 0, lc.width, lc.height);
    const d = lg.getImageData(0, 0, lc.width, lc.height), a = d.data;
    const E = rgb(edge), F = rgb(fill);
    for (let i = 0; i < a.length; i += 4) {
      const m = a[i] / 255;
      const ae = smooth(0.34, 0.43, m);
      if (ae <= 0) { a[i + 3] = 0; continue; }
      const am = smooth(0.46, 0.52, m);
      a[i] = E[0] + (F[0] - E[0]) * am; a[i + 1] = E[1] + (F[1] - E[1]) * am; a[i + 2] = E[2] + (F[2] - E[2]) * am;
      a[i + 3] = ae * 255;
    }
    lg.putImageData(d, 0, 0);
    lg.globalCompositeOperation = 'source-atop';
    lg.fillStyle = lg.createPattern(pat(), 'repeat');
    lg.fillRect(0, 0, lc.width, lc.height);
    g.drawImage(lc, 0, 0);
  };
  layer(t => t === '=', p.bank, p.sand, sandPat);
  layer(t => t === ',', p.pathEdge, p.path, pebblePat);
  // 3) florzinhas pintadas
  const flowerCols = ['#f05a7a', '#ffd23a', '#ffffff', '#b07af0', '#ff8a3a'];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const t = tileExt(x, z);
    const n = t === 'f' ? 14 : (t === '.' && hash(x * 5, z * 11) < 0.12 ? 3 : 0);
    const r = rng(x * 928 + z * 71 + 3);
    for (let i = 0; i < n; i++) {
      g.fillStyle = flowerCols[Math.floor(r() * flowerCols.length)];
      g.beginPath(); g.arc(X(x) + r() * PX, Z(z) + r() * PX, 1.4 + r(), 0, 7); g.fill();
    }
  }
  void buildings;
  const texture = canvasTex(c, false);

  // 4) malha
  const SEG = 2, nx = TW * SEG, nz = TH * SEG;
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2);
  let k = 0, u = 0;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const vx = -PAD - 0.5 + i / SEG, vz = -PAD - 0.5 + j / SEG;
    pos[k++] = vx; pos[k++] = heightAt(vx, vz); pos[k++] = vz;
    uv[u++] = i / nx; uv[u++] = 1 - j / nz;
  }
  const idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, cc = a + nx + 1, d = cc + 1;
    idx.push(a, cc, b, b, cc, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ map: texture, gradientMap: GRADIENT }));
  mesh.receiveShadow = true;
  return { mesh, heightAt };
}

// ------------------------------------------------ água
export function waterMaterial(color, opacity = 0.82) {
  const m = new THREE.MeshToonMaterial({ color, transparent: true, opacity, gradientMap: GRADIENT });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = shared.time;
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp4 = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wp4 = instanceMatrix * wp4;
      #endif
      vWPos = (modelMatrix * wp4).xyz;`);
    sh.fragmentShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 wp = vWPos.xz;
      float t = uTime;
      float w1 = sin(wp.x * 1.6 + t * 1.3 + sin(wp.y * 1.2 + t * 0.8) * 1.4);
      float w2 = sin(wp.y * 1.9 - t * 1.1 + sin(wp.x * 0.9 - t * 0.6) * 1.2);
      float band = smoothstep(0.45, 0.8, w1 * w2);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.92, 1.0), band * 0.55);
      float sp = smoothstep(0.9, 0.99, sin(wp.x * 5.3 + t * 2.1) * sin(wp.y * 4.7 - t * 1.7));
      diffuseColor.rgb += sp * 0.6;
      diffuseColor.a = min(1.0, diffuseColor.a + band * 0.1);`);
  };
  m.customProgramCacheKey = () => 'water-toon';
  return m;
}

// ------------------------------------------------ árvores e mato (instanciados)
function merge(parts) {
  const geos = parts.map(pt => {
    const g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo.clone();
    g.applyMatrix4(pt.m);
    return { g, col: new THREE.Color(pt.color) };
  });
  const n = geos.reduce((s, x) => s + x.g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const { g, col: cc } of geos) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < c; i++) { col[(o + i) * 3] = cc.r; col[(o + i) * 3 + 1] = cc.g; col[(o + i) * 3 + 2] = cc.b; }
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

function treeParts(kind, p) {
  const parts = [];
  if (kind === 'pine') {
    parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.15, 0.8, 6), m: M(0, 0.4, 0), color: p.trunk });
    parts.push({ geo: new THREE.ConeGeometry(0.72, 1.1, 7), m: M(0, 1.0, 0), color: p.pine[0] });
    parts.push({ geo: new THREE.ConeGeometry(0.56, 0.95, 7), m: M(0, 1.5, 0, 0, 0.4), color: p.pine[1] });
    parts.push({ geo: new THREE.ConeGeometry(0.36, 0.75, 7), m: M(0, 1.95, 0, 0, 0.9), color: p.pine[2] });
  } else if (kind === 'round') {
    parts.push({ geo: new THREE.CylinderGeometry(0.09, 0.15, 1.0, 6), m: M(0, 0.5, 0), color: p.trunk });
    parts.push({ geo: new THREE.CylinderGeometry(0.04, 0.06, 0.5, 5), m: M(0.2, 0.95, 0, 0, 0, -0.7), color: p.trunk });
    parts.push({ geo: new THREE.IcosahedronGeometry(0.64, 0), m: M(0, 1.38, 0, 0.3, 0.2), color: p.leaf[0] });
    parts.push({ geo: new THREE.IcosahedronGeometry(0.46, 0), m: M(0.38, 1.16, 0.18, 0.5), color: p.leaf[1] });
    parts.push({ geo: new THREE.IcosahedronGeometry(0.47, 0), m: M(-0.34, 1.2, -0.14, 0.1, 0.7), color: p.leaf[1] });
    parts.push({ geo: new THREE.IcosahedronGeometry(0.4, 0), m: M(0.06, 1.8, 0.06, 0.9), color: p.leaf[2] });
  } else if (kind === 'palm') {
    let x = 0, y = 0.2;
    for (let i = 0; i < 6; i++) {
      parts.push({ geo: new THREE.CylinderGeometry(0.075, 0.1, 0.46, 6), m: M(x, y, 0, 0, 0, -0.1 - i * 0.03), color: i % 2 ? p.trunk : '#a8784a' });
      x += 0.05 + i * 0.012; y += 0.42;
    }
    const top = [x, y - 0.1];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), -0.35, Math.sin(a)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(top[0] + dir.x * 0.55, top[1] + dir.y * 0.55, dir.z * 0.55), q, new THREE.Vector3(1, 1, 0.3));
      parts.push({ geo: new THREE.ConeGeometry(0.2, 1.15, 4), m, color: i % 2 ? p.palm : p.leaf[1] });
    }
    for (let i = 0; i < 3; i++) parts.push({ geo: new THREE.SphereGeometry(0.08, 6, 5), m: M(top[0] + Math.cos(i * 2.1) * 0.1, top[1] - 0.1, Math.sin(i * 2.1) * 0.1), color: '#6a4424' });
  }
  return parts;
}

const treeCache = new Map();
function treeGeometry(kind, p) {
  const key = kind + p.trunk + p.leaf.join() + p.pine.join() + p.palm;
  if (treeCache.has(key)) return treeCache.get(key);
  const parts = treeParts(kind, p);
  const main = merge(parts);
  // contorno: cada parte levemente ampliada em torno do próprio centro
  const outline = merge(parts.map(pt => {
    pt.geo.computeBoundingSphere();
    const f = 1 + Math.min(0.2, 0.045 / Math.max(0.05, pt.geo.boundingSphere.radius));
    return { geo: pt.geo, m: pt.m.clone().multiply(new THREE.Matrix4().makeScale(f, f, f)), color: OUTLINE_COLOR };
  }));
  const r = { main, outline };
  treeCache.set(key, r);
  return r;
}

// list: [{ x, y, z, s, r, kind }]
export function plantTrees(list, p, { shadows = true } = {}) {
  const g = new THREE.Group();
  const byKind = {};
  for (const t of list) (byKind[t.kind] = byKind[t.kind] || []).push(t);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  for (const [kind, items] of Object.entries(byKind)) {
    const { main, outline } = treeGeometry(kind, p);
    const mat = windify(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT }), { base: 0.7, amp: 0.045 });
    const omat = windify(new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }), { base: 0.7, amp: 0.045 });
    const im = new THREE.InstancedMesh(main, mat, items.length);
    const io = new THREE.InstancedMesh(outline, omat, items.length);
    items.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.r);
      m4.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.s, t.s * (0.92 + hash(t.x * 5, t.z) * 0.2), t.s));
      im.setMatrixAt(i, m4);
      io.setMatrixAt(i, m4);
      const v = hash(t.x * 13 + 1, t.z * 17 + 3);
      col.setRGB(0.86 + v * 0.14, 0.88 + hash(t.z, t.x) * 0.12, 0.84 + v * 0.1);
      im.setColorAt(i, col);
    });
    im.castShadow = shadows; im.receiveShadow = true;
    im.frustumCulled = io.frustumCulled = false;
    g.add(im, io);
  }
  return g;
}

// Tufo de capim: lâminas curvas com degradê da base escura até a ponta clara
const tuftCache = new Map();
export function tuftGeometry(height, blades, base, tip) {
  const key = height + '|' + blades + base + tip;
  if (tuftCache.has(key)) return tuftCache.get(key);
  const r = rng(Math.floor(height * 1000) + blades);
  const pos = [], col = [], nor = [];
  const cb = new THREE.Color(base), ct = new THREE.Color(tip), cm = cb.clone().lerp(ct, 0.5);
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2, d = r() * 0.16;
    const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
    const h = height * (0.7 + r() * 0.45), w = 0.035 + r() * 0.025;
    const la = a + (r() - 0.5) * 1.2, lean = 0.08 + r() * 0.14;
    const lx = Math.cos(la) * lean, lz = Math.sin(la) * lean;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    const b1 = [bx - px, 0, bz - pz], b2 = [bx + px, 0, bz + pz];
    const m1 = [bx - px * 0.6 + lx * 0.35, h * 0.55, bz - pz * 0.6 + lz * 0.35], m2 = [bx + px * 0.6 + lx * 0.35, h * 0.55, bz + pz * 0.6 + lz * 0.35];
    const t = [bx + lx, h, bz + lz];
    const tri = (a1, a2, a3, c1, c2, c3) => { pos.push(...a1, ...a2, ...a3); col.push(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b, c3.r, c3.g, c3.b); };
    tri(b1, b2, m2, cb, cb, cm); tri(b1, m2, m1, cb, cm, cm); tri(m1, m2, t, cm, cm, ct);
  }
  for (let i = 0; i < pos.length / 3; i++) nor.push(0, 1, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  tuftCache.set(key, g);
  return g;
}

// list: [{ x, y, z, s, r }]
export function plantTufts(list, geo, { push = 0, shadows = false, amp = 0.12 } = {}) {
  const mat = windify(new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide, gradientMap: GRADIENT }), { base: 0.0, amp, push });
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  list.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.r);
    m4.compose(new THREE.Vector3(t.x, t.y || 0, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
    im.setMatrixAt(i, m4);
    const v = hash(Math.floor(t.x * 10), Math.floor(t.z * 10));
    col.setRGB(0.85 + v * 0.15, 0.9 + v * 0.1, 0.85);
    im.setColorAt(i, col);
  });
  im.castShadow = shadows;
  im.receiveShadow = true;
  im.frustumCulled = false;
  return im;
}

// ------------------------------------------------ texturas de construção
const texCache = new Map();
function cachedTex(name, w, h, draw, repeat = true) {
  if (texCache.has(name)) return texCache.get(name);
  const c = makeCanvas(w, h);
  draw(c.getContext('2d'), w, h, rng(name.length * 977 + w));
  const t = canvasTex(c, repeat);
  texCache.set(name, t);
  return t;
}
export const TEX = {
  // 1 unidade do mundo = 1 repetição
  siding: () => cachedTex('siding', 128, 128, (g, w, h, r) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(0, y + 13, w, 3);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, y, w, 2);
      for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.04})`; g.fillRect(r() * w, y + 3, 20 + r() * 40, 9); }
    }
  }),
  brick: () => cachedTex('brick', 128, 128, (g, w, h, r) => {
    g.fillStyle = '#cfc8c0'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) for (let i = -1; i < 4; i++) {
      const x = i * 32 + (row % 2 ? 16 : 0);
      const l = 0.82 + r() * 0.18;
      g.fillStyle = `rgb(${255 * l | 0},${245 * l | 0},${235 * l | 0})`;
      g.fillRect(x + 2, row * 16 + 2, 28, 12);
    }
  }),
  stone: () => cachedTex('stone', 128, 128, (g, w, h, r) => {
    g.fillStyle = '#a8a098'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) for (let i = -1; i < 3; i++) {
      const x = i * 64 + (row % 2 ? 32 : 0);
      const l = 0.8 + r() * 0.2;
      g.fillStyle = `rgb(${250 * l | 0},${246 * l | 0},${240 * l | 0})`;
      rr(g, x + 3, row * 32 + 3, 58, 26, 5); g.fill();
    }
    for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(r() * w, r() * h, 2, 2); }
  }),
  plaster: () => cachedTex('plaster', 128, 128, (g, w, h, r) => {
    g.fillStyle = '#f6f6f6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.07})`; g.fillRect(r() * w, r() * h, 3, 3); }
  }),
  shingle: () => cachedTex('shingle', 128, 128, (g, w, h, r) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) {
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, row * 16 + 13, w, 3);
      for (let i = -1; i < 5; i++) {
        const x = i * 28 + (row % 2 ? 14 : 0);
        g.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.2})`; g.fillRect(x + 2, row * 16 + 1, 24, 8);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, row * 16, 2, 14);
      }
    }
  }),
  planks: () => cachedTex('planks', 128, 128, (g, w, h, r) => {
    for (let i = 0; i < 4; i++) {
      const l = 0.82 + r() * 0.18;
      g.fillStyle = `rgb(${255 * l | 0},${240 * l | 0},${220 * l | 0})`;
      g.fillRect(0, i * 32, w, 32);
      g.fillStyle = 'rgba(60,30,10,0.35)'; g.fillRect(0, i * 32 + 30, w, 2);
      const cut = r() * w; g.fillRect(cut, i * 32, 2, 30);
      for (let k = 0; k < 5; k++) { g.strokeStyle = `rgba(90,50,20,${0.08 + r() * 0.1})`; g.beginPath(); const y = i * 32 + 4 + r() * 24; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + r() * 4 - 2, w * 0.6, y + r() * 4 - 2, w, y); g.stroke(); }
    }
  }),
  // piso quadriculado: 2x2 unidades por repetição
  checker: (a, b) => cachedTex('checker' + a + b, 128, 128, (g, w, h) => {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * 64, j * 64, 64, 64); }
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2;
    for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(4, 4, 30, 6); g.fillRect(68, 68, 30, 6);
  }),
  poolTile: () => cachedTex('poolTile', 128, 128, (g, w, h, r) => {
    g.fillStyle = '#cfe3f2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const l = 0.92 + r() * 0.08; g.fillStyle = `rgb(${235 * l | 0},${245 * l | 0},${255 * l | 0})`; g.fillRect(i * 32 + 2, j * 32 + 2, 28, 28); }
  }),
  // parede interna: papel de parede em cima, lambri embaixo, rodapé escuro (altura inteira = 1 face)
  wallpaper: (top, stripe, panel) => cachedTex('wall' + top + stripe + panel, 64, 256, (g, w, h) => {
    g.fillStyle = top; g.fillRect(0, 0, w, h);
    g.fillStyle = stripe; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 6, h * 0.62);
    g.fillStyle = panel; g.fillRect(0, h * 0.62, w, h * 0.38);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, h * 0.62, w, 5);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, h * 0.62 + 5, w, 3); g.fillRect(w / 2 - 1, h * 0.66, 2, h * 0.28);
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, h - 12, w, 12);
  }, true),
  awning: (c) => cachedTex('awning' + c, 64, 64, (g, w, h) => {
    for (let x = 0; x < w; x += 16) { g.fillStyle = (x / 16) % 2 ? '#ffffff' : c; g.fillRect(x, 0, 16, h); }
  }),
  blob: () => cachedTex('blob', 64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, false),
  grassTile: (p) => cachedTex('grassTile' + p.grass, 128, 128, (g, w, h, r) => {
    g.fillStyle = p.grass; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { g.fillStyle = r() < 0.5 ? p.grassDark : p.grassLight; g.globalAlpha = 0.25; g.beginPath(); g.arc(r() * w, r() * h, 8 + r() * 16, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    g.fillStyle = g.createPattern(grassPat(), 'repeat'); g.fillRect(0, 0, w, h);
  }),
  sandTile: (p) => cachedTex('sandTile' + p.sand, 128, 128, (g, w, h) => {
    g.fillStyle = p.sand; g.fillRect(0, 0, w, h);
    g.fillStyle = g.createPattern(sandPat(), 'repeat'); g.fillRect(0, 0, w, h);
  }),
};

const matCache = new Map();
export function texMat(t, color = '#ffffff', extra = {}) {
  const key = t.uuid + color;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ map: t, color, gradientMap: GRADIENT });
  matCache.set(key, m);
  return m;
}

// Caixa com UV em unidades do mundo (a textura repete 1x por unidade)
export function boxW(w, h, d, scale = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0] * scale, uv.getY(i) * dims[f][1] * scale);
  }
  return g;
}

export function blobShadow(size = 0.9) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: TEX.blob(), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.renderOrder = 1;
  m.userData.noOutline = true;
  return m;
}

// ------------------------------------------------ partículas ambientes
export class Ambient {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.butterflies = [];
    this.leaves = null;
    this.points = null;
    this.puffs = [];
    const pg = new THREE.SphereGeometry(1, 6, 4);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }));
      m.visible = false;
      m.userData = { life: 0 };
      scene.add(m);
      this.puffs.push(m);
    }
  }

  setup(p, bounds) {
    this.scene.remove(this.group);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.butterflies = [];
    this.leaves = null;
    this.points = null;
    this.bounds = bounds;
    if (!p) return;
    if (p.butterflies) {
      const colors = ['#ffd23a', '#ffffff', '#f08ab0', '#8ab0ff', '#ffa040'];
      for (let i = 0; i < 7; i++) {
        const b = new THREE.Group();
        const wm = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide });
        const wg = new THREE.CircleGeometry(0.075, 6);
        const l = new THREE.Mesh(wg, wm), r = new THREE.Mesh(wg, wm);
        l.position.x = -0.07; r.position.x = 0.07;
        const lp = new THREE.Group(), rp = new THREE.Group();
        lp.add(l); rp.add(r);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 4), new THREE.MeshBasicMaterial({ color: '#2a2020' }));
        body.rotation.x = Math.PI / 2;
        b.add(lp, rp, body);
        b.position.set(bounds.x0 + Math.random() * (bounds.x1 - bounds.x0), 0.8, bounds.z0 + Math.random() * (bounds.z1 - bounds.z0));
        b.userData = { lp, rp, target: b.position.clone(), phase: Math.random() * 10 };
        this.group.add(b);
        this.butterflies.push(b);
      }
    }
    if (p.fireflies || p.motes) {
      const n = p.fireflies ? 80 : 60;
      const pos = new Float32Array(n * 3), ph = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos[i * 3] = Math.random() * 28; pos[i * 3 + 1] = 0.3 + Math.random() * 2.6; pos[i * 3 + 2] = Math.random() * 28; ph[i] = Math.random() * 20; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: shared.time, uCenter: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(p.fireflies ? '#d8ff7a' : '#ffe0a8') }, uSize: { value: p.fireflies ? 70 : 45 }, uBlink: { value: p.fireflies ? 1 : 0 } },
        vertexShader: `uniform float uTime; uniform vec3 uCenter; uniform float uSize; uniform float uBlink; attribute float phase; varying float vA;
          void main() {
            vec3 q = position;
            q.x = uCenter.x + mod(q.x - uCenter.x + 14.0, 28.0) - 14.0;
            q.z = uCenter.z + mod(q.z - uCenter.z + 14.0, 28.0) - 14.0;
            q += vec3(sin(uTime * 0.6 + phase) * 0.5, sin(uTime * 0.9 + phase * 1.3) * 0.25, cos(uTime * 0.5 + phase) * 0.5);
            vec4 mv = modelViewMatrix * vec4(q, 1.0);
            vA = mix(0.7, 0.5 + 0.5 * sin(uTime * 2.5 + phase * 3.0), uBlink);
            gl_PointSize = uSize / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `uniform vec3 uColor; varying float vA;
          void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(uColor * (1.0 + a), a);
          #include <colorspace_fragment>
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      this.points = new THREE.Points(geo, mat);
      this.points.frustumCulled = false;
      this.group.add(this.points);
    }
    if (p.leaves) {
      const n = 36;
      const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
      const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.08), mat, n);
      const cols = [p.leaf[0], p.leaf[2], '#c8a040', '#a86a2a'];
      im.userData.items = [];
      for (let i = 0; i < n; i++) {
        im.setColorAt(i, new THREE.Color(cols[i % cols.length]));
        im.userData.items.push({ p: new THREE.Vector3(Math.random() * 24 - 12, Math.random() * 5, Math.random() * 24 - 12), rot: Math.random() * 6, spin: 1 + Math.random() * 3, speed: 0.3 + Math.random() * 0.4 });
      }
      im.frustumCulled = false;
      this.leaves = im;
      this.group.add(im);
    }
  }

  puff(x, y, z, color, n = 5, spread = 0.5) {
    for (let i = 0; i < n; i++) {
      const m = this.puffs.find(q => !q.visible);
      if (!m) return;
      m.visible = true;
      m.material.color.set(color);
      m.position.set(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3);
      m.userData = { life: 0.6, max: 0.6, vel: new THREE.Vector3((Math.random() - 0.5) * spread * 2, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * spread * 2), size: 0.05 + Math.random() * 0.05 };
    }
  }

  update(dt, center) {
    const t = shared.time.value;
    for (const b of this.butterflies) {
      const u = b.userData;
      if (b.position.distanceTo(u.target) < 0.3 || Math.random() < 0.004) {
        const bd = this.bounds;
        u.target.set(
          Math.max(bd.x0, Math.min(bd.x1, center.x + (Math.random() - 0.5) * 14)),
          0.5 + Math.random() * 1.2,
          Math.max(bd.z0, Math.min(bd.z1, center.z + (Math.random() - 0.5) * 14)));
      }
      const dir = u.target.clone().sub(b.position);
      const len = dir.length();
      if (len > 0.01) b.position.addScaledVector(dir, Math.min(1, dt * 0.9 / len) * 1);
      b.position.y += Math.sin(t * 6 + u.phase) * 0.004;
      b.rotation.y = Math.atan2(dir.x, dir.z);
      const f = Math.sin(t * 22 + u.phase) * 1.1;
      u.lp.rotation.z = f; u.rp.rotation.z = -f;
    }
    if (this.points) this.points.material.uniforms.uCenter.value.copy(center);
    if (this.leaves) {
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1);
      this.leaves.userData.items.forEach((L, i) => {
        L.p.y -= L.speed * dt;
        L.p.x += Math.sin(t * 1.3 + i) * dt * 0.5;
        L.rot += L.spin * dt;
        if (L.p.y < 0.05 || Math.abs(L.p.x) > 13 || Math.abs(L.p.z) > 13) { L.p.set(Math.random() * 24 - 12, 3 + Math.random() * 3, Math.random() * 24 - 12); }
        e.set(L.rot, L.rot * 0.7, L.rot * 0.3);
        q.setFromEuler(e);
        m4.compose(new THREE.Vector3(center.x + L.p.x, L.p.y, center.z + L.p.z), q, s);
        this.leaves.setMatrixAt(i, m4);
      });
      this.leaves.instanceMatrix.needsUpdate = true;
    }
    for (const m of this.puffs) {
      if (!m.visible) continue;
      const u = m.userData;
      u.life -= dt;
      if (u.life <= 0) { m.visible = false; continue; }
      m.position.addScaledVector(u.vel, dt);
      u.vel.y -= dt * 2;
      const k = u.life / u.max;
      m.scale.setScalar(u.size * (1.6 - k));
      m.material.opacity = k * 0.8;
    }
  }
}
