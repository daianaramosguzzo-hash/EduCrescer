// Utilidades gerais: números aleatórios com semente, matemática e eventos.

export function mulberry32(seed) {
  let s = seed >>> 0;
  const f = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.state = () => s;
  f.setState = v => { s = v >>> 0; };
  return f;
}

// gerador global do jogo (salvo junto com o jogo)
let R = mulberry32(12345);
export const rng = {
  seed(v) { R = mulberry32(v); },
  state() { return R.state(); },
  setState(v) { R.setState(v); },
  next() { return R(); },
  int(a, b) { return a + Math.floor(R() * (b - a + 1)); },
  chance(p) { return R() < p; },
  pick(arr) { return arr[Math.floor(R() * arr.length)]; },
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
  weighted(list) { // [[valor, peso], ...]
    let tot = 0; for (const [, w] of list) tot += w;
    let r = R() * tot;
    for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
    return list[list.length - 1][0];
  },
};

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const cheb = (ax, az, bx, bz) => Math.max(Math.abs(ax - bx), Math.abs(az - bz));
export const smooth = t => t * t * (3 - 2 * t);
export const wait = ms => new Promise(r => setTimeout(r, ms));

// 8 direções no mapa (x → leste, z → sul)
export const DIR8 = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];

// barramento simples de eventos
const handlers = new Map();
export const bus = {
  on(ev, fn) { if (!handlers.has(ev)) handlers.set(ev, new Set()); handlers.get(ev).add(fn); return () => handlers.get(ev).delete(fn); },
  emit(ev, ...args) { const h = handlers.get(ev); if (h) for (const fn of [...h]) fn(...args); },
};

export function fmtTime(min) {
  const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
