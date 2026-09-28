// Funções pequenas usadas no jogo inteiro.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
// aproximação suave que não depende do FPS
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
export const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));
// diferença de ângulo no intervalo [-PI, PI]
export const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const dampAngle = (a, b, k, dt) => a + angDiff(a, b) * (1 - Math.exp(-k * dt));
// ângulo de rotação (em Y) para olhar de (ax,az) para (bx,bz); 0 = +Z
export const angleTo = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az);

// gerador pseudoaleatório com semente (o mapa sai sempre igual)
export function rng(seed = 1) {
  let s = seed >>> 0;
  const r = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + r() * (b - a);
  r.int = (a, b) => Math.floor(a + r() * (b - a + 1));
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.chance = p => r() < p;
  return r;
}
export const R = rng(Date.now() & 0xffffffff); // aleatório comum (loot, combate)

// escolhe uma entrada pelo peso { w: 3, ... }
export function weighted(list, r = R) {
  let total = 0;
  for (const e of list) total += e.w ?? 1;
  let x = r() * total;
  for (const e of list) { x -= e.w ?? 1; if (x <= 0) return e; }
  return list[list.length - 1];
}

// ruído de valor 2D suave (para terreno e texturas)
export function makeNoise(seed = 7) {
  const r = rng(seed);
  const P = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const V = new Float32Array(256).map(() => r());
  const f = t => t * t * (3 - 2 * t);
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = V[P[P[xi & 255] + (yi & 255)]], b = V[P[P[(xi + 1) & 255] + (yi & 255)]];
    const c = V[P[P[xi & 255] + ((yi + 1) & 255)]], d = V[P[P[(xi + 1) & 255] + ((yi + 1) & 255)]];
    const u = f(xf), v = f(yf);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
  n2.fbm = (x, y, oct = 4) => { let s = 0, a = 0.5, fr = 1, n = 0; for (let i = 0; i < oct; i++) { s += n2(x * fr, y * fr) * a; n += a; a *= 0.5; fr *= 2; } return s / n; };
  return n2;
}

export const fmtTime = min => {
  const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// eventos simples entre sistemas
const listeners = {};
export const bus = {
  on(ev, fn) { (listeners[ev] ||= []).push(fn); return () => bus.off(ev, fn); },
  off(ev, fn) { const l = listeners[ev]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
  emit(ev, data) { const l = listeners[ev]; if (l) for (const fn of [...l]) fn(data); },
};

export const $ = (sel, root = document) => root.querySelector(sel);
export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
