// Ambiente 3D: céu, terreno pintado, árvores e mato com vento, água animada,
// texturas procedurais e partículas (borboletas, vaga-lumes, folhas, poeira).
import * as THREE from '../lib/three.module.min.js';
import { GRADIENT } from './models.js';
import { DETAIL_TEX, MAT_TEX, setTexAnisotropy } from './textures.js';
import { PROPS, propHull } from './props.js';

// uniforms compartilhados pelos shaders (tempo e posição do herói)
export const shared = { time: { value: 0 }, player: { value: new THREE.Vector3(0, -99, 0) } };
const OUTLINE_COLOR = '#1a1410';
let ANISO = 4;
export function setAnisotropy(n) { ANISO = n; setTexAnisotropy(n); }

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
    kinds: { round: 0.55, pine: 0.45 }, autumn: 0.16, butterflies: true,
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
    kinds: { pine: 0.75, round: 0.25 }, autumn: 0.25, fireflies: true, leaves: true,
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
    kinds: { round: 0.6, pine: 0.4 }, autumn: 0.3, motes: true,
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
  // caatinga: sol forte, chão de terra avermelhada, capim seco, mandacarus e árvores secas
  caatinga: {
    top: '#3a8ee0', horizon: '#ffe6b8', bottom: '#f0cf9a', fog: '#f4dcb0', fogNear: 24, fogFar: 66,
    sunDir: [0.5, 0.82, 0.3], sunGlow: '#fff0c0', sunLight: '#fff0d0', sunI: 1.95,
    hemiSky: '#fff2d8', hemiGround: '#a8784a', hemiI: 1.05,
    grass: '#b8a458', grassDark: '#8e7a3a', grassLight: '#d4c070', tall: '#a08a40',
    path: '#d89a62', pathEdge: '#a8663a', sand: '#e0a868', bank: '#b87a48',
    waterShallow: '#8ac8c0', waterDeep: '#2a6a8a', water: '#4a9ab0',
    trunk: '#8a6a4a', pine: ['#6a8a4a', '#7a9a52', '#8aa85a'], leaf: ['#9aa050', '#b0b060', '#c8b870'], palm: '#8aa050',
    mountain: '#c8845a', snow: false, clouds: true, cloud: '#fff8ec', cloudShade: '#e0c0a0',
    kinds: { cactus: 0.55, dead: 0.3, round: 0.15 }, motes: true,
  },
  // chapada: planalto de pedra sob tempestade elétrica, capim ralo e céu roxo
  chapada: {
    top: '#241c4a', horizon: '#8a78b0', bottom: '#5a4a7a', fog: '#6e6290', fogNear: 16, fogFar: 52,
    sunDir: [0.3, 0.88, 0.35], sunGlow: '#c8b8ff', sunLight: '#d8d0ff', sunI: 1.1,
    hemiSky: '#c0b8f0', hemiGround: '#5a4a52', hemiI: 0.9,
    grass: '#7a9a5a', grassDark: '#587a44', grassLight: '#96b070', tall: '#5a8a44',
    path: '#b8a08a', pathEdge: '#8a7462', sand: '#c8b098', bank: '#9a8470',
    waterShallow: '#7a90c0', waterDeep: '#2a2a6a', water: '#4a5a9a',
    trunk: '#5a4a40', pine: ['#3a5a4a', '#46685a', '#567a66'], leaf: ['#5a7a4a', '#6a8a52', '#7a9a5a'], palm: '#5a7a4a',
    mountain: '#6a5a8a', snow: false, clouds: true, cloud: '#9a8ac0', cloudShade: '#3a2e5a',
    kinds: { dead: 0.4, pine: 0.35, cactus: 0.25 }, lightning: true, motes: true,
  },
  // Amazônia: floresta densa e úmida, árvores gigantes com cipós, rios escuros
  amazonia: {
    top: '#2a7a70', horizon: '#b8e8c8', bottom: '#80c0a0', fog: '#9ad0b4', fogNear: 11, fogFar: 40,
    sunDir: [0.35, 0.9, 0.25], sunGlow: '#f0ffd0', sunLight: '#f4ffe0', sunI: 1.25,
    hemiSky: '#d0f4d8', hemiGround: '#2e5a2a', hemiI: 0.95,
    grass: '#3a9a3e', grassDark: '#257a30', grassLight: '#50b048', tall: '#2a8a34',
    path: '#a07a4e', pathEdge: '#7a5a34', sand: '#c8a878', bank: '#6a5a34',
    waterShallow: '#6a9a70', waterDeep: '#2a4a30', water: '#4a7a50',
    trunk: '#6a4a2e', pine: ['#1f6a34', '#2a7e3e', '#3a9448'], leaf: ['#1f7a34', '#2e9a3e', '#48b44c'], palm: '#2e9a3e',
    mountain: '#2f6a50', snow: false, clouds: true, cloud: '#f0fff4', cloudShade: '#a8d0b8',
    kinds: { jungle: 0.35, palm: 0.3, round: 0.35 }, butterflies: true, leaves: true,
  },
  // pântano noturno: névoa densa, água escura, árvores secas e vaga-lumes
  pantano: {
    top: '#0c0c24', horizon: '#3a3a64', bottom: '#22223e', fog: '#2c2c4a', fogNear: 8, fogFar: 30,
    sunDir: [-0.3, 0.8, 0.5], sunGlow: '#c8d0ff', sunLight: '#a8b4e8', sunI: 0.75,
    hemiSky: '#8890c8', hemiGround: '#1e2a24', hemiI: 0.75,
    grass: '#3a5a44', grassDark: '#2a4434', grassLight: '#4a6a50', tall: '#2e5040',
    path: '#6a6258', pathEdge: '#4a443c', sand: '#5a5a50', bank: '#3a3a30',
    waterShallow: '#3a5a5a', waterDeep: '#101a22', water: '#24383e',
    trunk: '#3a3030', pine: ['#1e3a30', '#284a3a', '#345a44'], leaf: ['#2a4a38', '#345a40', '#406a48'], palm: '#345a40',
    mountain: '#24243e', snow: false, clouds: false,
    kinds: { dead: 0.55, round: 0.25, jungle: 0.2 }, fireflies: true,
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
export function windify(mat, { base = 0.5, amp = 0.05, push = 0, fade = 0 } = {}) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = shared.time;
    sh.uniforms.uPlayer = shared.player;
    sh.vertexShader = 'uniform float uTime;\nuniform vec3 uPlayer;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      ${fade ? `
      // LOD: objetos pequenos encolhem até sumir longe da câmera (economiza pixels)
      vec4 org = vec4(0.0, 0.0, 0.0, 1.0);
      #ifdef USE_INSTANCING
        org = instanceMatrix * org;
      #endif
      org = modelMatrix * org;
      float fdist = distance(org.xyz, cameraPosition);
      transformed *= 1.0 - smoothstep(${(fade * 0.7).toFixed(1)}, ${fade.toFixed(1)}, fdist);` : ''}
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
  mat.customProgramCacheKey = () => `wind-${base}-${amp}-${push}-${fade}-${mat.type}`;
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
  for (let c = 0; c < 13; c++) {
    const a = r() * Math.PI * 2, dist = 60 + r() * 24, y = 14 + r() * 16;
    const cx = Math.cos(a) * dist, cz = Math.sin(a) * dist;
    const n = 5 + Math.floor(r() * 5), sz = 3 + r() * 3;
    for (let i = 0; i < n; i++) {
      const ox = (i - n / 2) * sz * 0.62 + (r() - 0.5) * sz;
      const big = 1 - Math.abs(i - n / 2) / n;
      puffs.push([cx + ox * Math.sin(a), y + (r() - 0.2) * sz * 0.45 + big * sz * 0.35, cz - ox * Math.cos(a), sz * (0.6 + r() * 0.5 + big * 0.4)]);
    }
  }
  // nuvem com topo claro e base azulada (volume sem custo)
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const cols = [];
  const top = new THREE.Color(p.cloud), bot = new THREE.Color(p.cloudShade).lerp(top, 0.35);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.smoothstep(pos.getY(i), -0.6, 0.7);
    const c = bot.clone().lerp(top, k);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const im = new THREE.InstancedMesh(geo, mat, puffs.length);
  const m4 = new THREE.Matrix4();
  puffs.forEach(([x, y, z, s], i) => {
    m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.6, s));
    im.setMatrixAt(i, m4);
  });
  im.frustumCulled = false;
  return im;
}

// Montanhas em camadas com relevo irregular, degradê de altura (base verde,
// rocha, neve) e colinas mais próximas. A neblina faz a perspectiva atmosférica.
function mountainGeometry(rad, h, seed, p, snowy) {
  const g = new THREE.ConeGeometry(rad, h, 9, 5, true);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = (v.y + h / 2) / h; // 0 base .. 1 pico
    if (k < 0.999) {
      const n = vnoise(v.x * 0.35 + seed, v.z * 0.35 - seed) - 0.5;
      const ang = Math.atan2(v.z, v.x);
      const ridge = Math.sin(ang * 3 + seed) * 0.12;
      const f = 1 + n * 0.5 + ridge;
      v.x *= f; v.z *= f;
      v.y += n * h * 0.12 * (1 - k);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  const cols = [];
  const cBase = new THREE.Color(p.grassDark), cRock = new THREE.Color(p.mountain), cSnow = new THREE.Color('#f4f8ff');
  const pp = ng.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const k = (pp.getY(i) + h / 2) / h;
    const c = cBase.clone().lerp(cRock, THREE.MathUtils.smoothstep(k, 0.05, 0.35));
    if (snowy) c.lerp(cSnow, THREE.MathUtils.smoothstep(k, 0.68, 0.8));
    c.multiplyScalar(0.92 + hash(i, seed | 0) * 0.12);
    cols.push(c.r, c.g, c.b);
  }
  ng.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return ng;
}

export function makeMountains(cx, cz, radius, p, seed = 1) {
  const g = new THREE.Group();
  const r = rng(seed * 97 + 13);
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT });
  // cordilheira distante (mais alta) e média
  for (const [count, dMin, dVar, hMin, hVar] of [[26, 22, 14, 14, 14], [22, 8, 8, 7, 9]]) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r() * 0.25;
      const d = radius + dMin + r() * dVar;
      const h = hMin + r() * hVar, rad = h * (0.55 + r() * 0.35);
      const m = new THREE.Mesh(mountainGeometry(rad, h, r() * 100, p, p.snow && h > 16), mat);
      m.position.set(cx + Math.cos(a) * d, h / 2 - 1.5, cz + Math.sin(a) * d);
      m.rotation.y = r() * 6;
      g.add(m);
    }
  }
  // colinas arredondadas
  const hill = new THREE.MeshToonMaterial({ color: p.grassDark, gradientMap: GRADIENT });
  const hg = new THREE.IcosahedronGeometry(1, 2);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + r();
    const d = radius + r() * 6;
    const sc = 4 + r() * 5;
    const m = new THREE.Mesh(hg, hill);
    m.scale.set(sc * 1.5, sc * 0.42, sc);
    m.rotation.y = r() * 3;
    m.position.set(cx + Math.cos(a) * d, -0.6, cz + Math.sin(a) * d);
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
  // mapa de mistura (1 pixel por quadrado): R=trilha, G=areia, B=chão de floresta, A=mato alto
  const sd = new Uint8Array(TW * TH * 4);
  for (let z = -PAD; z < H + PAD; z++) for (let x = -PAD; x < W + PAD; x++) {
    const t = tileExt(x, z);
    const row = TH - 1 - (z + PAD);
    const i = (row * TW + (x + PAD)) * 4;
    sd[i] = t === ',' ? 255 : 0;
    sd[i + 1] = (t === '=' || t === 'W') ? 255 : 0;
    let forest = t === 'T' ? 255 : 0;
    if (!forest) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tileExt(x + dx, z + dz) === 'T') forest = Math.max(forest, 110);
    if (p.leaves) forest = Math.max(forest, 150);
    sd[i + 2] = forest;
    sd[i + 3] = t === 'G' ? 255 : 0;
  }
  const splat = new THREE.DataTexture(sd, TW, TH, THREE.RGBAFormat);
  splat.magFilter = splat.minFilter = THREE.LinearFilter;
  splat.needsUpdate = true;
  const mesh = new THREE.Mesh(geo, terrainMaterial(texture, splat));
  mesh.receiveShadow = true;
  return { mesh, heightAt, splat };
}

// Material do terreno: a cor pintada recebe detalhes finos (capim, pedrinhas,
// raízes, areia, folhas secas) em escala do mundo + variação de cor em grande
// escala. Os detalhes somem aos poucos longe da câmera para evitar serrilhado.
function terrainMaterial(texture, splat) {
  const m = new THREE.MeshToonMaterial({ map: texture, gradientMap: GRADIENT });
  const u = {
    tSplat: { value: splat }, tGrassD: { value: DETAIL_TEX.grass() }, tDirtD: { value: DETAIL_TEX.dirt() },
    tSandD: { value: DETAIL_TEX.sand() }, tLeafD: { value: DETAIL_TEX.leaves() }, tMacro: { value: DETAIL_TEX.macro() },
  };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vTWPos;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vTWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = `uniform sampler2D tSplat; uniform sampler2D tGrassD; uniform sampler2D tDirtD; uniform sampler2D tSandD; uniform sampler2D tLeafD; uniform sampler2D tMacro;
      varying vec3 vTWPos;\n` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec4 sp = texture2D(tSplat, vMapUv);
        vec2 duv = vTWPos.xz * 0.5;
        float mac = texture2D(tMacro, vTWPos.xz * 0.035).r;
        float mac2 = texture2D(tMacro, vTWPos.xz * 0.11 + 0.37).r;
        float edgeN = (mac2 - 0.5) * 0.35;
        vec3 d = texture2D(tGrassD, duv).rgb;
        d = mix(d, texture2D(tLeafD, duv * 0.9).rgb, smoothstep(0.25, 0.75, sp.b + edgeN) * 0.85);
        d = mix(d, texture2D(tSandD, duv).rgb, smoothstep(0.35, 0.65, sp.g + edgeN));
        d = mix(d, texture2D(tDirtD, duv * 0.9).rgb, smoothstep(0.38, 0.62, sp.r + edgeN));
        float camD = distance(vTWPos, cameraPosition);
        d = mix(d, vec3(0.5), smoothstep(26.0, 48.0, camD) * 0.8);
        diffuseColor.rgb *= d * 2.0;
        diffuseColor.rgb *= 0.9 + mac * 0.2;
        diffuseColor.rgb *= 1.0 - sp.a * 0.08;
      }`);
  };
  m.customProgramCacheKey = () => 'terrain-detail';
  return m;
}

// ------------------------------------------------ água
export function waterMaterial(color, opacity = 0.82, shore = null) {
  const m = new THREE.MeshToonMaterial({ color, transparent: true, opacity, gradientMap: GRADIENT });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = shared.time;
    if (shore) {
      sh.uniforms.tShore = { value: shore.tex };
      sh.uniforms.uShoreO = { value: new THREE.Vector2(shore.x0, shore.z0) };
      sh.uniforms.uShoreS = { value: new THREE.Vector2(shore.w, shore.h) };
    }
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp4 = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wp4 = instanceMatrix * wp4;
      #endif
      vWPos = (modelMatrix * wp4).xyz;`);
    sh.fragmentShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' + (shore ? 'uniform sampler2D tShore; uniform vec2 uShoreO; uniform vec2 uShoreS;\n' : '') +
      sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 wp = vWPos.xz;
      float t = uTime;
      float w1 = sin(wp.x * 1.6 + t * 1.3 + sin(wp.y * 1.2 + t * 0.8) * 1.4);
      float w2 = sin(wp.y * 1.9 - t * 1.1 + sin(wp.x * 0.9 - t * 0.6) * 1.2);
      float band = smoothstep(0.45, 0.8, w1 * w2);
      float deep = 0.5 + 0.5 * sin(wp.x * 0.23 + wp.y * 0.31 + t * 0.2);
      diffuseColor.rgb *= 0.9 + deep * 0.15;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.92, 1.0), band * 0.5);
      float sp = smoothstep(0.9, 0.99, sin(wp.x * 5.3 + t * 2.1) * sin(wp.y * 4.7 - t * 1.7));
      diffuseColor.rgb += sp * 0.6;
      diffuseColor.a = min(1.0, diffuseColor.a + band * 0.1);
      ${shore ? `
      // espuma animada perto da margem
      float sh = texture2D(tShore, (wp - uShoreO) / uShoreS).r;
      float wave = 0.5 + 0.5 * sin(sh * 14.0 - t * 2.2 + sin(wp.x * 2.0 + wp.y) * 0.8);
      float foam = smoothstep(0.35, 0.9, sh) * smoothstep(0.55, 0.95, wave) + smoothstep(0.82, 1.0, sh);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.99, 1.0), clamp(foam, 0.0, 1.0) * 0.8);
      diffuseColor.a = max(diffuseColor.a, foam * 0.95);` : ''}`);
  };
  m.customProgramCacheKey = () => 'water-toon' + (shore ? '-shore' : '');
  return m;
}

// ------------------------------------------------ árvores e mato (instanciados)
// Junta várias peças numa geometria só, com cor por vértice. "shade" aplica
// sombreamento de volume barato: copa mais escura embaixo e clara em cima,
// ranhuras de casca no tronco e leve variação de cor por vértice.
function merge(parts) {
  const geos = parts.map(pt => {
    let g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo.clone();
    if (pt.bumpy) {
      const pos = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const n = vnoise(v.x * 3.1 + 7, v.y * 3.1 + v.z * 2.3) - 0.5;
        v.multiplyScalar(1 + n * pt.bumpy);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
    }
    g.computeBoundingBox();
    const bb = g.boundingBox.clone();
    g.applyMatrix4(pt.m);
    return { g, col: new THREE.Color(pt.color), shade: pt.shade, bb, m: pt.m };
  });
  const n = geos.reduce((s, x) => s + x.g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  const tmp = new THREE.Color(), local = new THREE.Vector3(), inv = new THREE.Matrix4();
  for (const { g, col: cc, shade, bb, m } of geos) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    inv.copy(m).invert();
    for (let i = 0; i < c; i++) {
      tmp.copy(cc);
      if (shade) {
        local.fromBufferAttribute(g.attributes.position, i).applyMatrix4(inv);
        const k = (local.y - bb.min.y) / Math.max(0.001, bb.max.y - bb.min.y);
        const jit = hash(Math.floor(local.x * 40 + i * 0.37), Math.floor(local.z * 40)) * 0.1 - 0.05;
        if (shade === 'canopy') tmp.multiplyScalar(0.7 + k * 0.45 + jit);
        else if (shade === 'trunk') {
          const ang = Math.atan2(local.z, local.x);
          tmp.multiplyScalar(0.78 + 0.16 * Math.abs(Math.sin(ang * 4 + local.y * 5)) + k * 0.12 + jit);
        } else if (shade === 'grad') tmp.multiplyScalar(0.8 + k * 0.3 + jit);
      }
      col[(o + i) * 3] = tmp.r; col[(o + i) * 3 + 1] = tmp.g; col[(o + i) * 3 + 2] = tmp.b;
    }
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

// tronco com base alargada e raízes aparentes
function trunkParts(p, h, r0, r1, color = p.trunk, lo = false) {
  const parts = [{ geo: new THREE.CylinderGeometry(r1, r0, h, lo ? 5 : 8, lo ? 1 : 3), m: M(0, h / 2, 0), color, shade: 'trunk' }];
  if (!lo) {
    parts.push({ geo: new THREE.ConeGeometry(r0 * 1.9, 0.22, 8, 1, true), m: M(0, 0.1, 0), color, shade: 'trunk' });
    for (let i = 0; i < 4; i++) {
      const a = i * 1.57 + 0.4;
      parts.push({ geo: new THREE.CylinderGeometry(0.02, r0 * 0.55, 0.42, 5), m: M(Math.cos(a) * r0 * 1.4, 0.06, Math.sin(a) * r0 * 1.4, Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25), color, shade: 'trunk' });
    }
  }
  return parts;
}

function treeParts(kind, variant, p, lo) {
  const parts = [];
  const leafDetail = lo ? 0 : 1;
  const blob = (r, x, y, z, color, rot = 0) => parts.push({ geo: new THREE.IcosahedronGeometry(r, leafDetail), m: M(x, y, z, rot, rot * 1.7, 0), color, shade: 'canopy', bumpy: lo ? 0 : 0.18 });
  if (kind === 'pine') {
    const tiers = variant === 1 ? 4 : 3;
    const tall = variant === 2 ? 1.2 : 1;
    parts.push(...trunkParts(p, 0.8, 0.15, 0.1, p.trunk, lo));
    for (let i = 0; i < tiers; i++) {
      const k = i / (tiers - 1);
      const rad = (0.78 - k * 0.45) * (variant === 1 ? 0.9 : 1);
      const hh = (1.15 - k * 0.35) * tall;
      const y = (0.95 + i * (tiers === 4 ? 0.42 : 0.5)) * tall;
      parts.push({ geo: new THREE.ConeGeometry(rad, hh, lo ? 6 : 9, lo ? 1 : 2), m: M(0, y, 0, 0, i * 0.7), color: p.pine[Math.min(2, i)], shade: 'canopy', bumpy: lo ? 0 : 0.08 });
    }
  } else if (kind === 'round') {
    parts.push(...trunkParts(p, 1.0, 0.15, 0.09, p.trunk, lo));
    if (!lo) {
      parts.push({ geo: new THREE.CylinderGeometry(0.035, 0.06, 0.55, 5), m: M(0.2, 0.95, 0, 0, 0, -0.75), color: p.trunk, shade: 'trunk' });
      parts.push({ geo: new THREE.CylinderGeometry(0.03, 0.05, 0.45, 5), m: M(-0.18, 1.0, 0.08, 0.3, 0, 0.8), color: p.trunk, shade: 'trunk' });
    }
    if (variant === 0) {
      blob(0.66, 0, 1.4, 0, p.leaf[0], 0.3); blob(0.48, 0.4, 1.16, 0.18, p.leaf[1], 0.5);
      blob(0.48, -0.36, 1.2, -0.14, p.leaf[1], 0.1); blob(0.42, 0.06, 1.84, 0.06, p.leaf[2], 0.9);
    } else if (variant === 1) {
      blob(0.74, 0, 1.5, 0, p.leaf[0], 0.2); blob(0.44, 0.46, 1.34, -0.2, p.leaf[1], 0.7);
      blob(0.4, -0.42, 1.42, 0.26, p.leaf[2], 0.4); blob(0.36, 0.1, 2.0, -0.1, p.leaf[2], 1.1);
      if (!lo) blob(0.3, -0.1, 1.1, 0.48, p.leaf[1], 0.5);
    } else {
      blob(0.56, 0.18, 1.3, 0.1, p.leaf[0], 0.6); blob(0.56, -0.24, 1.44, -0.12, p.leaf[1], 0.2);
      blob(0.46, 0.02, 1.92, 0, p.leaf[2], 0.8); blob(0.34, 0.5, 1.6, -0.2, p.leaf[1], 1.3);
    }
  } else if (kind === 'birch') {
    parts.push(...trunkParts(p, 1.4, 0.11, 0.07, '#ece8dc', lo));
    if (!lo) for (let i = 0; i < 5; i++) parts.push({ geo: new THREE.BoxGeometry(0.1, 0.035, 0.18), m: M(0, 0.25 + i * 0.24, 0, 0, i * 1.3, 0), color: '#2a2a2a' });
    blob(0.5, 0, 1.75, 0, p.leaf[2], 0.4); blob(0.4, 0.28, 1.5, 0.1, p.leaf[1], 0.8); blob(0.36, -0.24, 2.05, -0.1, p.leaf[2], 0.2);
  } else if (kind === 'palm') {
    let x = 0, y = 0.2;
    for (let i = 0; i < 6; i++) {
      parts.push({ geo: new THREE.CylinderGeometry(0.075, 0.1, 0.46, lo ? 5 : 7), m: M(x, y, 0, 0, 0, -0.1 - i * 0.03), color: i % 2 ? p.trunk : '#a8784a', shade: 'trunk' });
      x += 0.05 + i * 0.012; y += 0.42;
    }
    const top = [x, y - 0.1];
    const nLeaves = lo ? 6 : 9;
    for (let i = 0; i < nLeaves; i++) {
      const a = (i / nLeaves) * Math.PI * 2 + variant;
      const droop = -0.3 - (i % 3) * 0.12;
      const dir = new THREE.Vector3(Math.cos(a), droop, Math.sin(a)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const mm = new THREE.Matrix4().compose(new THREE.Vector3(top[0] + dir.x * 0.58, top[1] + dir.y * 0.58, dir.z * 0.58), q, new THREE.Vector3(1, 1, 0.28));
      parts.push({ geo: new THREE.ConeGeometry(0.21, 1.2, 4), m: mm, color: i % 2 ? p.palm : p.leaf[1], shade: 'grad' });
    }
    for (let i = 0; i < 3; i++) parts.push({ geo: new THREE.SphereGeometry(0.08, 6, 5), m: M(top[0] + Math.cos(i * 2.1) * 0.1, top[1] - 0.1, Math.sin(i * 2.1) * 0.1), color: '#6a4424' });
  } else if (kind === 'cactus') {
    // mandacaru: coluna com gomos e braços que sobem
    const col = '#4f8a44', dark = '#3a6e36';
    const H = variant === 1 ? 2.2 : 1.7;
    parts.push({ geo: new THREE.CylinderGeometry(0.2, 0.24, H, lo ? 6 : 10), m: M(0, H / 2, 0), color: col, shade: 'trunk' });
    parts.push({ geo: new THREE.SphereGeometry(0.2, lo ? 6 : 10, 6), m: M(0, H, 0), color: col });
    const arms = variant === 2 ? [[1, 0.7, 0.55]] : [[1, 0.8, 0.6], [-1, 1.1, 0.5]];
    for (const [sx, y, h] of arms) {
      parts.push({ geo: new THREE.CylinderGeometry(0.11, 0.11, 0.35, lo ? 5 : 8), m: M(sx * 0.3, y, 0, 0, 0, Math.PI / 2), color: col });
      parts.push({ geo: new THREE.CylinderGeometry(0.11, 0.12, h, lo ? 5 : 8), m: M(sx * 0.46, y + h / 2, 0), color: col, shade: 'trunk' });
      parts.push({ geo: new THREE.SphereGeometry(0.11, lo ? 5 : 8, 5), m: M(sx * 0.46, y + h, 0), color: col });
    }
    if (!lo) for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      parts.push({ geo: new THREE.BoxGeometry(0.03, H * 0.92, 0.03), m: M(Math.cos(a) * 0.215, H / 2, Math.sin(a) * 0.215, 0, -a, 0), color: dark });
    }
    if (!lo && variant !== 2) parts.push({ geo: new THREE.SphereGeometry(0.09, 8, 6), m: M(0, H + 0.14, 0, 0, 0, 0, 1, 0.5, 1), color: '#fff8f0' });
  } else if (kind === 'dead') {
    // árvore seca: tronco retorcido e galhos sem folhas (algumas folhinhas secas)
    parts.push(...trunkParts(p, 1.3, 0.13, 0.06, p.trunk, lo));
    const br = variant === 1 ? [[0.8, 0.9, 0.7], [-0.9, 1.1, 0.6], [0.2, 1.3, 0.55], [-0.3, 0.7, 0.45]] : [[0.9, 1.0, 0.65], [-0.7, 1.2, 0.6], [0.1, 1.35, 0.5]];
    for (const [a, y, l] of br) {
      const dir = new THREE.Vector3(Math.cos(a * 2), 0.9, Math.sin(a * 2)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const mm = new THREE.Matrix4().compose(new THREE.Vector3(dir.x * l * 0.5, y + dir.y * l * 0.5, dir.z * l * 0.5), q, new THREE.Vector3(1, 1, 1));
      parts.push({ geo: new THREE.CylinderGeometry(0.018, 0.045, l, lo ? 4 : 5), m: mm, color: p.trunk, shade: 'trunk' });
      if (!lo) {
        const tip = new THREE.Vector3(dir.x * l, y + dir.y * l, dir.z * l);
        parts.push({ geo: new THREE.IcosahedronGeometry(0.14, 0), m: M(tip.x, tip.y, tip.z, a, a, 0), color: p.leaf[2], shade: 'canopy' });
      }
    }
  } else if (kind === 'jungle') {
    // árvore gigante da floresta: sapopemas (raízes-tábua), copa em camadas e cipós
    parts.push(...trunkParts(p, 2.0, 0.24, 0.14, p.trunk, lo));
    if (!lo) for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.3;
      parts.push({ geo: new THREE.BoxGeometry(0.06, 0.7, 0.42), m: M(Math.cos(a) * 0.26, 0.3, Math.sin(a) * 0.26, 0, -a, 0), color: p.trunk, shade: 'trunk' });
    }
    blob(0.95, 0, 2.3, 0, p.leaf[0], 0.2); blob(0.7, 0.62, 2.05, 0.2, p.leaf[1], 0.6); blob(0.66, -0.6, 2.15, -0.2, p.leaf[1], 1.1);
    blob(0.55, 0.1, 2.85, 0.1, p.leaf[2], 0.4);
    if (variant === 1) blob(0.5, 0.2, 1.8, -0.62, p.leaf[2], 0.8);
    if (!lo) for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + variant;
      parts.push({ geo: new THREE.CylinderGeometry(0.012, 0.012, 1.3, 4), m: M(Math.cos(a) * 0.62, 1.55, Math.sin(a) * 0.62), color: '#3a6a2a' });
    }
  }
  return parts;
}

const treeCache = new Map();
function treeGeometry(kind, variant, p, lo) {
  const key = [kind, variant, lo ? 'lo' : 'hi', p.trunk, p.leaf.join(), p.pine.join(), p.palm].join('|');
  if (treeCache.has(key)) return treeCache.get(key);
  const parts = treeParts(kind, variant, p, lo);
  const main = merge(parts);
  // contorno só na versão próxima: cada peça ampliada em torno do próprio centro
  const outline = lo ? null : merge(parts.map(pt => {
    pt.geo.computeBoundingSphere();
    const f = 1 + Math.min(0.2, 0.045 / Math.max(0.05, pt.geo.boundingSphere.radius));
    return { geo: pt.geo, m: pt.m.clone().multiply(new THREE.Matrix4().makeScale(f, f, f)), color: OUTLINE_COLOR, bumpy: pt.bumpy };
  }));
  const r = { main, outline };
  treeCache.set(key, r);
  return r;
}
const VARIANTS = { pine: 3, round: 3, birch: 1, palm: 2, cactus: 3, dead: 2, jungle: 2 };

// list: [{ x, y, z, s, r, kind, lo }]  (lo = versão simplificada para longe)
export function plantTrees(list, p, { shadows = true } = {}) {
  const g = new THREE.Group();
  const groups = {};
  // parte das árvores redondas vira a árvore laranja do BlenderKit (onde o clima pede)
  if (p.autumn && PROPS.tree) {
    const autumn = [];
    list = list.filter(t => {
      if (t.kind !== 'round' || hash(Math.floor(t.x * 7) + 41, Math.floor(t.z * 5) + 17) >= p.autumn) return true;
      autumn.push(t);
      return false;
    });
    g.add(plantAutumnTrees(autumn, { shadows }));
  }
  for (const t of list) {
    const v = Math.floor(hash(Math.floor(t.x * 3) + 11, Math.floor(t.z * 3) + 5) * VARIANTS[t.kind]) % VARIANTS[t.kind];
    const key = t.kind + '|' + v + '|' + (t.lo ? 1 : 0);
    (groups[key] = groups[key] || []).push(t);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  for (const [key, items] of Object.entries(groups)) {
    const [kind, v, lo] = key.split('|');
    const { main, outline } = treeGeometry(kind, +v, p, lo === '1');
    const mat = windify(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT }), { base: 0.7, amp: 0.045 });
    const im = new THREE.InstancedMesh(main, mat, items.length);
    const io = outline ? new THREE.InstancedMesh(outline, windify(new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }), { base: 0.7, amp: 0.045 }), items.length) : null;
    items.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.r);
      m4.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.s, t.s * (0.9 + hash(t.x * 5, t.z) * 0.25), t.s));
      im.setMatrixAt(i, m4);
      if (io) io.setMatrixAt(i, m4);
      const hv = hash(Math.floor(t.x * 13) + 1, Math.floor(t.z * 17) + 3);
      col.setHSL(0.02 * (hv - 0.5), 0, 1);
      col.setRGB(0.84 + hv * 0.16, 0.86 + hash(Math.floor(t.z * 7), Math.floor(t.x * 7)) * 0.14, 0.82 + hv * 0.12);
      im.setColorAt(i, col);
    });
    im.castShadow = shadows && lo !== '1';
    im.receiveShadow = true;
    im.computeBoundingSphere();
    if (io) { io.computeBoundingSphere(); g.add(io); }
    g.add(im);
  }
  return g;
}

// Tufo de capim: lâminas curvas com degradê da base escura até a ponta clara
const tuftCache = new Map();
export function tuftGeometry(height, blades, base, tip, spread = 0.16, seed = 0) {
  const key = height + '|' + blades + base + tip + spread + '|' + seed;
  if (tuftCache.has(key)) return tuftCache.get(key);
  const r = rng(Math.floor(height * 1000) + blades + seed * 977);
  const pos = [], col = [], nor = [];
  const cb = new THREE.Color(base), ct = new THREE.Color(tip), cm = cb.clone().lerp(ct, 0.5);
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * spread;
    const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
    const h = height * (0.6 + r() * 0.6), w = 0.03 + r() * 0.03;
    const la = a + (r() - 0.5) * 1.4, lean = 0.06 + r() * 0.18;
    const lx = Math.cos(la) * lean, lz = Math.sin(la) * lean;
    const px = -Math.sin(la) * w, pz = Math.cos(la) * w;
    const tint = 0.9 + r() * 0.2;
    const c1 = cb.clone().multiplyScalar(tint), c2 = cm.clone().multiplyScalar(tint), c3 = ct.clone().multiplyScalar(tint);
    const b1 = [bx - px, 0, bz - pz], b2 = [bx + px, 0, bz + pz];
    const m1 = [bx - px * 0.65 + lx * 0.3, h * 0.5, bz - pz * 0.65 + lz * 0.3], m2 = [bx + px * 0.65 + lx * 0.3, h * 0.5, bz + pz * 0.65 + lz * 0.3];
    const t = [bx + lx, h, bz + lz];
    const tri = (a1, a2, a3, k1, k2, k3) => { pos.push(...a1, ...a2, ...a3); col.push(k1.r, k1.g, k1.b, k2.r, k2.g, k2.b, k3.r, k3.g, k3.b); };
    tri(b1, b2, m2, c1, c1, c2); tri(b1, m2, m1, c1, c2, c2); tri(m1, m2, t, c2, c2, c3);
  }
  for (let i = 0; i < pos.length / 3; i++) nor.push(0, 1, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  tuftCache.set(key, g);
  return g;
}

// Objetos instanciados divididos em blocos de 12x12 quadrados, para que o
// frustum culling descarte o que está fora da tela (ex.: atrás da câmera).
// list: [{ x, y, z, s, r, tint, color }] (color: cor exata da instância)
export function plantTufts(list, geo, { push = 0, shadows = false, amp = 0.12, fade = 34, double = true, material = null, base = 0.0, outline = null, chunk = 0 } = {}) {
  const g = new THREE.Group();
  if (!list.length) return g;
  const mat = material || windify(new THREE.MeshToonMaterial({ vertexColors: true, side: double ? THREE.DoubleSide : THREE.FrontSide, gradientMap: GRADIENT }), { base, amp, push, fade });
  const omat = outline ? windify(new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }), { base, amp, push, fade }) : null;
  // listas pequenas viram um único InstancedMesh (menos chamadas de desenho);
  // as grandes são divididas em blocos para o culling descartar o que está fora da tela
  const size = chunk || (list.length > 700 ? 12 : 1e6);
  const chunks = new Map();
  for (const t of list) {
    const k = Math.floor(t.x / size) + ',' + Math.floor(t.z / size);
    if (!chunks.has(k)) chunks.set(k, []);
    chunks.get(k).push(t);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), e = new THREE.Euler();
  for (const items of chunks.values()) {
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    const io = outline ? new THREE.InstancedMesh(outline, omat, items.length) : null;
    items.forEach((t, i) => {
      e.set(t.rx || 0, t.r, t.rz || 0);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(t.x, t.y || 0, t.z), q, new THREE.Vector3(t.s, t.sy || t.s, t.s));
      im.setMatrixAt(i, m4);
      if (io) io.setMatrixAt(i, m4);
      if (t.color) col.set(t.color);
      else {
        const v = t.tint !== undefined ? t.tint : hash(Math.floor(t.x * 10), Math.floor(t.z * 10));
        col.setRGB(0.84 + v * 0.18, 0.88 + v * 0.12, 0.84 + (1 - v) * 0.08);
      }
      im.setColorAt(i, col);
    });
    im.castShadow = shadows;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    im.boundingSphere.radius += 1;
    g.add(im);
    if (io) { io.computeBoundingSphere(); io.boundingSphere.radius += 1; g.add(io); }
  }
  return g;
}

// ------------------------------------------------ decoração: flores, plantas, arbustos, folhas, pedras
const decoCache = new Map();
function cachedGeo(key, build) {
  if (!decoCache.has(key)) decoCache.set(key, build());
  return decoCache.get(key);
}

// flor com caule, folhas e 5 pétalas (cor da pétala embutida nos vértices)
export function flowerGeometry(petal, center = '#ffd23a', leaf = '#3f9a3f') {
  return cachedGeo('flower' + petal + center, () => {
    const parts = [
      { geo: new THREE.CylinderGeometry(0.008, 0.012, 0.24, 4), m: M(0, 0.12, 0), color: leaf },
      { geo: new THREE.SphereGeometry(0.05, 6, 4), m: M(0.04, 0.07, 0, 0, 0, -0.9, 1, 0.25, 0.5), color: leaf, shade: 'grad' },
      { geo: new THREE.SphereGeometry(0.025, 6, 5), m: M(0, 0.25, 0), color: center },
    ];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      parts.push({ geo: new THREE.SphereGeometry(0.035, 6, 4), m: M(Math.cos(a) * 0.04, 0.245, Math.sin(a) * 0.04, 0, -a, 0, 1.2, 0.3, 0.7), color: petal, shade: 'grad' });
    }
    return merge(parts);
  });
}
// planta silvestre de folhas largas
export function plantGeometry(color) {
  return cachedGeo('plant' + color, () => {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + (i % 2) * 0.3;
      const tilt = 0.7 + (i % 3) * 0.2;
      parts.push({ geo: new THREE.SphereGeometry(0.1, 7, 4), m: M(Math.cos(a) * 0.08, 0.1 + (i % 2) * 0.03, Math.sin(a) * 0.08, Math.sin(a) * tilt, -a, -Math.cos(a) * tilt, 0.45, 0.12, 1.4), color, shade: 'grad' });
    }
    return merge(parts);
  });
}
// samambaia: folhas longas e arqueadas
export function fernGeometry(color) {
  return cachedGeo('fern' + color, () => {
    const parts = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      parts.push({ geo: new THREE.ConeGeometry(0.06, 0.55, 4), m: M(Math.cos(a) * 0.16, 0.14, Math.sin(a) * 0.16, Math.sin(a) * 1.05, 0, -Math.cos(a) * 1.05, 1, 1, 0.3), color, shade: 'grad' });
    }
    return merge(parts);
  });
}
// arbusto: bolhas de folhagem com volume
export function bushGeometry(p, seed = 0) {
  const key = 'bush' + p.leaf.join() + seed;
  if (decoCache.has(key)) return decoCache.get(key);
  const r = rng(seed * 31 + 5);
  const parts = [];
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = i === 0 ? 0 : 0.2 + r() * 0.12, rad = i === 0 ? 0.36 : 0.22 + r() * 0.1;
    parts.push({ geo: new THREE.IcosahedronGeometry(rad, 1), m: M(Math.cos(a) * d, rad * 0.8, Math.sin(a) * d, r(), r(), 0), color: p.leaf[i % 3], shade: 'canopy', bumpy: 0.2 });
  }
  const main = merge(parts);
  const outline = merge(parts.map(pt => {
    pt.geo.computeBoundingSphere();
    const f = 1 + 0.035 / pt.geo.boundingSphere.radius;
    return { ...pt, m: pt.m.clone().multiply(new THREE.Matrix4().makeScale(f, f, f)), color: OUTLINE_COLOR };
  }));
  const res = { main, outline };
  decoCache.set(key, res);
  return res;
}
// folha caída (plana, dupla face)
export function leafGeometry() {
  return cachedGeo('leaf', () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.06); shape.quadraticCurveTo(0.045, 0, 0, 0.06); shape.quadraticCurveTo(-0.045, 0, 0, -0.06);
    const g = new THREE.ShapeGeometry(shape, 3);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.012, 0);
    const n = g.attributes.position.count;
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3));
    return g;
  });
}
export function twigGeometry(color) {
  return cachedGeo('twig' + color, () => merge([
    { geo: new THREE.CylinderGeometry(0.012, 0.016, 0.34, 4), m: M(0, 0.015, 0, 0, 0, Math.PI / 2), color },
    { geo: new THREE.CylinderGeometry(0.007, 0.01, 0.12, 4), m: M(0.06, 0.02, 0.04, 0, -0.8, Math.PI / 2), color },
  ]));
}
// rocha irregular com rachaduras (cor por vértice) e topo levemente musgoso
export function rockGeometry(seed, base = '#a09a90', moss = '#6a9a4a', detail = 1) {
  return cachedGeo('rock' + seed + base + moss + detail, () => {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const pos = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = vnoise(v.x * 2.2 + seed, v.y * 2.2 + v.z * 1.7 - seed) - 0.5;
      v.multiplyScalar(1 + n * 0.45);
      v.y *= 0.62;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const cols = [];
    const cb = new THREE.Color(base), cm = new THREE.Color(moss);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), nY = g.attributes.normal.getY(i);
      const c = cb.clone().multiplyScalar(0.78 + (y + 0.6) * 0.25 + (hash(i, seed) - 0.5) * 0.12);
      if (moss && nY > 0.65) c.lerp(cm, 0.55);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return g;
  });
}
// cópia levemente ampliada para servir de contorno (casca invertida)
export function hullGeometry(geo, f = 1.07) {
  return cachedGeo(geo.uuid + 'hull' + f, () => geo.clone().scale(f, f, f));
}
export function rockMaterial() {
  return cachedGeo('rockMat', () => new THREE.MeshToonMaterial({ vertexColors: true, map: MAT_TEX.rock(), gradientMap: GRADIENT }));
}
export function rockOutlineMaterial() {
  return cachedGeo('rockOl', () => new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }));
}

// ------------------------------------------------ cenário do BlenderKit (js/props.js)
export function hasProp(name) { return !!PROPS[name]; }
const propMats = new Map();
function propMat(key, build) {
  if (!propMats.has(key)) propMats.set(key, build());
  return propMats.get(key);
}
// rochas com musgo; list: [{ x, y, z, s (largura), r, sy? }]
export function plantPropRocks(list, { shadows = true, outline = true, fade = 0, seed = 0 } = {}) {
  const g = new THREE.Group();
  if (!PROPS.rocks || !list.length) return g;
  const mat = propMat('rock' + fade, () => windify(new THREE.MeshToonMaterial({ map: PROPS.rocks[0].map, color: new THREE.Color('#ffffff').multiplyScalar(1.45), gradientMap: GRADIENT }), { amp: 0, fade }));
  const by = PROPS.rocks.map(() => []);
  for (const t of list) by[Math.floor(hash(Math.floor(t.x * 7) + seed, Math.floor(t.z * 11)) * by.length) % by.length].push(t);
  by.forEach((l, i) => {
    if (!l.length) return;
    const geo = PROPS.rocks[i].geo;
    g.add(plantTufts(l, geo, { material: mat, shadows, fade, outline: outline ? propHull(geo, 0.028) : null }));
  });
  return g;
}
// touceira de capim (cartões com transparência), tingida com a cor do bioma
export function plantPropGrass(list, color, { push = 0, amp = 0.35, fade = 30 } = {}) {
  if (!PROPS.grass || !list.length) return new THREE.Group();
  const c = new THREE.Color(color);
  const mat = propMat('grass' + c.getHexString() + push + amp + fade, () => windify(new THREE.MeshToonMaterial({
    map: PROPS.grass.map, color: c.multiplyScalar(2.6), alphaTest: 0.42, side: THREE.DoubleSide, gradientMap: GRADIENT,
  }), { base: 0, amp, push, fade }));
  return plantTufts(list, PROPS.grass.geo, { material: mat });
}
// árvore laranja (bordo de outono); list: [{ x, y, z, s, r, lo }]
export function plantAutumnTrees(list, { shadows = true } = {}) {
  const g = new THREE.Group();
  if (!PROPS.tree || !list.length) return g;
  const trunk = propMat('autumnTrunk', () => windify(new THREE.MeshToonMaterial({ map: PROPS.tree.trunkMap, color: '#e8dcd0', gradientMap: GRADIENT }), { base: 0.9, amp: 0.02 }));
  const leaves = propMat('autumnLeaves', () => windify(new THREE.MeshToonMaterial({ map: PROPS.tree.leafMap, alphaTest: 0.5, side: THREE.DoubleSide, gradientMap: GRADIENT }), { base: 0.6, amp: 0.03 }));
  for (const lo of [false, true]) {
    const l = list.filter(t => !!t.lo === lo).map(t => ({ ...t, sy: t.s * (0.9 + hash(t.x * 5, t.z) * 0.25) }));
    if (!l.length) continue;
    const set = lo ? PROPS.tree.lo : PROPS.tree.hi;
    g.add(plantTufts(l, set.trunk, { material: trunk, shadows: shadows && !lo }));
    g.add(plantTufts(l, set.leaves, { material: leaves, shadows: shadows && !lo }));
  }
  return g;
}

// Espalha decoração de forma natural (posições por hash com jitter, sem grade
// visível), respeitando o que pode ficar em cada tipo de quadrado.
// opts: { W, H, PAD, tileExt, heightAt, isBlockedDecor(x,z), p, density }
export function scatterDecor(o) {
  const { W, H, PAD, tileExt, heightAt, p, density = 1, isBuilding } = o;
  const g = new THREE.Group();
  const lists = { grass: [], grass2: [], dry: [], plant: [], fern: [], leaf: [], twig: [], pebble: [], rock: [], bush: [], lush: [], flowers: {} };
  const lush = !!PROPS.grass;
  const flowerCols = ['#f05a7a', '#ffd23a', '#ffffff', '#b07af0', '#ff8a3a', '#6ab0ff'];
  const R = (x, z, k) => hash(x * 73 + k * 19, z * 131 + k * 7);
  const near = (x, z, t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => tileExt(x + dx, z + dz) === t);
  for (let z = -PAD; z < H + PAD; z++) for (let x = -PAD; x < W + PAD; x++) {
    const t = tileExt(x, z);
    const inside = x >= 0 && z >= 0 && x < W && z < H;
    if (inside && isBuilding && isBuilding(x, z)) continue;
    const dOut = inside ? 0 : Math.max(-x, x - W + 1, -z, z - H + 1, 0);
    if (dOut > 6) continue;
    const y0 = (xx, zz) => inside ? 0 : heightAt(xx, zz);
    const pt = (k, spread = 0.9) => [x + (R(x, z, k) - 0.5) * spread, z + (R(x, z, k + 50) - 0.5) * spread];
    const byTree = near(x, z, 'T');
    if (t === '.' || t === 'f') {
      const nG = Math.round((2 + R(x, z, 1) * 4 + (byTree ? 2 : 0)) * density);
      for (let k = 0; k < nG; k++) {
        const [px, pz] = pt(k * 3 + 2);
        const list = R(x, z, k + 90) < 0.5 ? lists.grass : lists.grass2;
        list.push({ x: px, y: y0(px, pz), z: pz, s: 0.7 + R(x, z, k + 5) * 0.7, r: R(x, z, k + 9) * 6.28 });
      }
      if (R(x, z, 3) < 0.18 * density) { const [px, pz] = pt(31); lists.dry.push({ x: px, y: y0(px, pz), z: pz, s: 0.8 + R(x, z, 4) * 0.5, r: R(x, z, 8) * 6.28 }); }
      const nF = t === 'f' ? 6 : (R(x, z, 6) < 0.12 ? 1 + Math.floor(R(x, z, 7) * 3) : 0);
      const fc = flowerCols[Math.floor(R(x, z, 11) * flowerCols.length)];
      for (let k = 0; k < nF; k++) {
        const [px, pz] = pt(k * 5 + 40, 0.85);
        const col = t === 'f' ? flowerCols[Math.floor(R(x, z, k + 60) * flowerCols.length)] : fc;
        (lists.flowers[col] = lists.flowers[col] || []).push({ x: px, y: y0(px, pz), z: pz, s: 0.8 + R(x, z, k + 70) * 0.6, r: R(x, z, k + 80) * 6.28 });
      }
      if (R(x, z, 12) < (byTree ? 0.3 : 0.07) * density) { const [px, pz] = pt(13, 0.7); lists.plant.push({ x: px, y: y0(px, pz), z: pz, s: 0.8 + R(x, z, 14) * 0.7, r: R(x, z, 15) * 6.28 }); }
      if (byTree || p.leaves) {
        const nL = Math.round((p.leaves ? 5 : 3) * density);
        for (let k = 0; k < nL; k++) {
          const [px, pz] = pt(k * 7 + 100);
          lists.leaf.push({ x: px, y: y0(px, pz), z: pz, s: 0.8 + R(x, z, k + 120) * 0.8, r: R(x, z, k + 130) * 6.28, tint: R(x, z, k + 140) });
        }
        if (R(x, z, 16) < 0.25) { const [px, pz] = pt(17); lists.twig.push({ x: px, y: y0(px, pz), z: pz, s: 0.7 + R(x, z, 18) * 0.7, r: R(x, z, 19) * 6.28 }); }
      }
      // touceiras de capim do BlenderKit: perto das árvores e fora da área de andar
      if (lush && dOut < 4 && R(x, z, 62) < (dOut > 0 ? 0.16 : byTree ? 0.14 : 0.03) * density * density) { const [px, pz] = pt(63, 0.6); const s = 0.7 + R(x, z, 64) * 0.5; lists.lush.push({ x: px, y: y0(px, pz), z: pz, s, sy: s * 1.5, r: R(x, z, 65) * 6.28 }); }
      if (R(x, z, 20) < 0.1) { const [px, pz] = pt(21); lists.pebble.push({ x: px, y: y0(px, pz), z: pz, s: 0.05 + R(x, z, 22) * 0.06, r: R(x, z, 23) * 6.28, tint: R(x, z, 24) }); }
    } else if (t === ',') {
      const nP = Math.round((1 + R(x, z, 25) * 3) * density);
      for (let k = 0; k < nP; k++) { const [px, pz] = pt(k * 3 + 26); lists.pebble.push({ x: px, y: y0(px, pz), z: pz, s: 0.03 + R(x, z, k + 27) * 0.05, r: R(x, z, k + 28) * 6.28, tint: R(x, z, k + 29) }); }
      if (byTree && R(x, z, 30) < 0.4) { const [px, pz] = pt(32); lists.leaf.push({ x: px, y: 0, z: pz, s: 1, r: R(x, z, 33) * 6.28, tint: R(x, z, 34) }); }
      // capim nas bordas da trilha
      if (near(x, z, '.') && R(x, z, 35) < 0.6 * density) { const [px, pz] = pt(36); lists.grass.push({ x: px, y: y0(px, pz), z: pz, s: 0.5 + R(x, z, 37) * 0.4, r: R(x, z, 38) * 6.28 }); }
    } else if (t === '=') {
      if (R(x, z, 39) < 0.12) { const [px, pz] = pt(40); lists.pebble.push({ x: px, y: 0, z: pz, s: 0.04 + R(x, z, 41) * 0.05, r: R(x, z, 42) * 6.28, tint: 0.9 }); }
    } else if (t === 'T') {
      // sob as árvores: samambaias, arbustos e folhas (não bloqueiam a passagem)
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { const n = tileExt(x + dx, z + dz); return n !== 'T' && n !== 'W'; });
      if (edge && R(x, z, 43) < 0.55) { const [px, pz] = pt(44, 0.6); lists.bush.push({ x: px, y: y0(px, pz), z: pz, s: 0.8 + R(x, z, 45) * 0.6, r: R(x, z, 46) * 6.28 }); }
      if (R(x, z, 47) < 0.45 * density) { const [px, pz] = pt(48, 0.8); lists.fern.push({ x: px, y: y0(px, pz), z: pz, s: 0.8 + R(x, z, 49) * 0.6, r: R(x, z, 50) * 6.28 }); }
      for (let k = 0; k < 2; k++) { const [px, pz] = pt(k * 3 + 51); lists.leaf.push({ x: px, y: y0(px, pz), z: pz, s: 1 + R(x, z, k + 52) * 0.6, r: R(x, z, k + 53) * 6.28, tint: R(x, z, k + 54) }); }
      if (dOut > 2 && R(x, z, 55) < 0.06) { const [px, pz] = pt(56); lists.rock.push({ x: px, y: y0(px, pz) - 0.05, z: pz, s: 0.3 + R(x, z, 57) * 0.4, r: R(x, z, 58) * 6.28 }); }
    } else if (t === 'G') {
      if (R(x, z, 59) < 0.3 * density) { const [px, pz] = pt(60); lists.flowers['#ffffff'] = lists.flowers['#ffffff'] || []; lists.flowers['#ffffff'].push({ x: px, y: 0, z: pz, s: 0.9, r: R(x, z, 61) * 6.28 }); }
    }
  }
  const grassA = tuftGeometry(0.32, 7, p.grassDark, p.grassLight, 0.16, 1);
  const grassB = tuftGeometry(0.22, 9, p.grassDark, p.grassLight, 0.2, 2);
  const dry = tuftGeometry(0.34, 7, '#9a8a4a', '#e0cc80', 0.15, 3);
  g.add(plantTufts(lists.grass, grassA, { amp: 0.1, fade: 30 }));
  g.add(plantTufts(lists.grass2, grassB, { amp: 0.1, fade: 26 }));
  g.add(plantTufts(lists.dry, dry, { amp: 0.1, fade: 26 }));
  for (const [c, l] of Object.entries(lists.flowers)) g.add(plantTufts(l, flowerGeometry(c), { amp: 0.15, fade: 26, base: 0.1 }));
  g.add(plantTufts(lists.plant, plantGeometry(p.leaf[1]), { amp: 0.05, fade: 30 }));
  g.add(plantTufts(lists.fern, fernGeometry(p.pine[1]), { amp: 0.06, fade: 30 }));
  // folhas caídas: um só material, a cor de cada folha vai na instância
  const leafCols = [p.leaf[0], p.leaf[2], '#c8a040', '#a8642a', '#d88a3a'];
  const leafMat = windify(new THREE.MeshToonMaterial({ side: THREE.DoubleSide, gradientMap: GRADIENT }), { amp: 0, fade: 24 });
  g.add(plantTufts(lists.leaf.map(l => ({ ...l, color: leafCols[Math.floor(l.tint * leafCols.length) % leafCols.length] })), leafGeometry(), { material: leafMat }));
  g.add(plantTufts(lists.twig, twigGeometry(p.trunk), { material: windify(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT }), { amp: 0, fade: 22 }) }));
  const pebMat = windify(new THREE.MeshToonMaterial({ vertexColors: true, map: MAT_TEX.rock(), gradientMap: GRADIENT }), { amp: 0, fade: 24 });
  g.add(plantTufts(lists.pebble.map(q => ({ ...q, sy: q.s * 0.7 })), rockGeometry(3, '#b0a898', null, 0), { material: pebMat }));
  g.add(plantPropGrass(lists.lush, p.grass, { fade: 34 }));
  if (lists.rock.length && PROPS.rocks) g.add(plantPropRocks(lists.rock.map(q => ({ ...q, y: q.y + 0.02, s: q.s * 2.2 })), { seed: 3 }));
  else if (lists.rock.length) g.add(plantTufts(lists.rock, rockGeometry(9), { material: windify(new THREE.MeshToonMaterial({ vertexColors: true, map: MAT_TEX.rock(), gradientMap: GRADIENT }), { amp: 0 }), shadows: true, outline: hullGeometry(rockGeometry(9)) }));
  if (lists.bush.length) {
    const bA = bushGeometry(p, 1), bB = bushGeometry(p, 2);
    const half = Math.ceil(lists.bush.length / 2);
    g.add(plantTufts(lists.bush.slice(0, half), bA.main, { amp: 0.03, base: 0.2, double: false, shadows: true, outline: bA.outline, fade: 60 }));
    g.add(plantTufts(lists.bush.slice(half), bB.main, { amp: 0.03, base: 0.2, double: false, shadows: true, outline: bB.outline, fade: 60 }));
  }
  return g;
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
  // faixa de sombra suave (oclusão junto a paredes)
  aoStrip: () => cachedTex('aoStrip', 16, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, false),
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
