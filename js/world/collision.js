// Colisão 2D (no plano X/Z): caixas e círculos estáticos numa grade espacial,
// linha de visão e uma grade de navegação de 1 m para os zumbis contornarem obstáculos.
import { clamp } from '../core/util.js';

const CELL = 4;
export const NAV_HALF = 170;          // a grade cobre [-170, 170]
export const NAV_N = NAV_HALF * 2;    // células de 1 m

export class Collision {
  constructor() {
    this.cells = new Map();
    this.nav = new Uint8Array(NAV_N * NAV_N); // quantos obstáculos cobrem cada célula
    this.blockers = []; // regras extras (regiões trancadas)
    this.qid = 0;
  }
  key(cx, cz) { return cx * 73856093 ^ cz * 19349663; }
  bounds(s) {
    return s.type === 'box' ? [s.x0, s.z0, s.x1, s.z1] : [s.x - s.r, s.z - s.r, s.x + s.r, s.z + s.r];
  }
  // shape: { type:'box', x0,z0,x1,z1 } ou { type:'circle', x,z,r }; opções: los (bloqueia visão), low (baixo: não bloqueia visão)
  add(s) {
    s.los = s.los ?? true;
    s._q = 0;
    const [a, b, c, d] = this.bounds(s);
    s._cells = [];
    for (let cx = Math.floor(a / CELL); cx <= Math.floor(c / CELL); cx++)
      for (let cz = Math.floor(b / CELL); cz <= Math.floor(d / CELL); cz++) {
        const k = this.key(cx, cz);
        let arr = this.cells.get(k);
        if (!arr) this.cells.set(k, arr = []);
        arr.push(s); s._cells.push(k);
      }
    if (!s.noNav) this.rasterize(s, 1);
    return s;
  }
  remove(s) {
    if (!s || !s._cells) return;
    for (const k of s._cells) { const arr = this.cells.get(k); if (arr) { const i = arr.indexOf(s); if (i >= 0) arr.splice(i, 1); } }
    s._cells = null;
    if (!s.noNav) this.rasterize(s, -1);
  }
  rasterize(s, d) {
    const [a, b, c, e] = this.bounds(s);
    const pad = 0.3;
    for (let ix = Math.floor(a - pad + NAV_HALF); ix <= Math.floor(c + pad + NAV_HALF); ix++)
      for (let iz = Math.floor(b - pad + NAV_HALF); iz <= Math.floor(e + pad + NAV_HALF); iz++) {
        if (ix < 0 || iz < 0 || ix >= NAV_N || iz >= NAV_N) continue;
        const cx = ix - NAV_HALF + 0.5, cz = iz - NAV_HALF + 0.5;
        let inside;
        if (s.type === 'box') inside = cx > s.x0 - pad && cx < s.x1 + pad && cz > s.z0 - pad && cz < s.z1 + pad;
        else inside = (cx - s.x) ** 2 + (cz - s.z) ** 2 < (s.r + pad) ** 2;
        if (inside) { const i = iz * NAV_N + ix; this.nav[i] = clamp(this.nav[i] + d, 0, 255); }
      }
  }
  navBlocked(ix, iz) { return ix < 0 || iz < 0 || ix >= NAV_N || iz >= NAV_N || this.nav[iz * NAV_N + ix] > 0; }
  // percorre formas perto de um retângulo (sem repetir)
  query(a, b, c, d, fn) {
    const q = ++this.qid;
    for (let cx = Math.floor(a / CELL); cx <= Math.floor(c / CELL); cx++)
      for (let cz = Math.floor(b / CELL); cz <= Math.floor(d / CELL); cz++) {
        const arr = this.cells.get(this.key(cx, cz));
        if (!arr) continue;
        for (const s of arr) { if (s._q === q) continue; s._q = q; if (fn(s) === false) return; }
      }
  }
  // empurra um círculo para fora dos obstáculos; devolve {x,z,hit}
  resolve(x, z, r, ent = null) {
    let hit = null;
    for (let it = 0; it < 3; it++) {
      let moved = false;
      this.query(x - r, z - r, x + r, z + r, s => {
        if (s.ignore && s.ignore(ent)) return;
        if (s.type === 'box') {
          const nx = clamp(x, s.x0, s.x1), nz = clamp(z, s.z0, s.z1);
          let dx = x - nx, dz = z - nz;
          const d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (r - d) / d; x += dx * k; z += dz * k; }
            else {
              // centro dentro da caixa: sai pelo lado mais perto
              const l = x - s.x0, rr = s.x1 - x, t = z - s.z0, bb = s.z1 - z, m = Math.min(l, rr, t, bb);
              if (m === l) x = s.x0 - r; else if (m === rr) x = s.x1 + r; else if (m === t) z = s.z0 - r; else z = s.z1 + r;
            }
            moved = true; hit = s;
          }
        } else {
          const dx = x - s.x, dz = z - s.z, d2 = dx * dx + dz * dz, R = r + s.r;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) || 1e-4, k = (R - d) / d;
            x += dx * k; z += dz * k; moved = true; hit = s;
          }
        }
      });
      if (!moved) break;
    }
    for (const b of this.blockers) { const p = b(x, z, r, ent); if (p) { x = p.x; z = p.z; hit = hit || { blocker: true }; } }
    return { x, z, hit };
  }
  // há algo entre os dois pontos que bloqueia a visão/tiro?
  lineBlocked(x0, z0, x1, z1, ignoreLow = true) {
    const dx = x1 - x0, dz = z1 - z0;
    let blocked = false;
    this.query(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), s => {
      if (!s.los || (ignoreLow && s.low)) return;
      if (s.type === 'box') {
        let t0 = 0, t1 = 1;
        for (const [p, d, lo, hi] of [[x0, dx, s.x0, s.x1], [z0, dz, s.z0, s.z1]]) {
          if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return; }
          else {
            let a = (lo - p) / d, b = (hi - p) / d;
            if (a > b) [a, b] = [b, a];
            t0 = Math.max(t0, a); t1 = Math.min(t1, b);
            if (t0 > t1) return;
          }
        }
        if (t0 > 0.02 && t0 < 0.98) { blocked = true; return false; }
      } else {
        const fx = x0 - s.x, fz = z0 - s.z;
        const a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - s.r * s.r;
        const disc = b * b - 4 * a * c;
        if (disc < 0) return;
        const t = (-b - Math.sqrt(disc)) / (2 * a);
        if (t > 0.02 && t < 0.98) { blocked = true; return false; }
      }
    });
    return blocked;
  }
}

// Campo de fluxo: distâncias até o jogador numa janela da grade de navegação.
// Zumbis sem linha reta até o alvo descem por esse campo para contornar paredes.
export class FlowField {
  constructor(col, R = 34) {
    this.col = col; this.R = R; this.S = R * 2 + 1;
    this.dist = new Uint16Array(this.S * this.S);
    this.ox = 0; this.oz = 0; this.tx = null; this.tz = null;
    this.queue = new Int32Array(this.S * this.S);
  }
  update(x, z) {
    const tx = Math.floor(x + NAV_HALF), tz = Math.floor(z + NAV_HALF);
    if (tx === this.tx && tz === this.tz) return;
    this.tx = tx; this.tz = tz;
    const S = this.S, R = this.R;
    this.ox = tx - R; this.oz = tz - R;
    const D = this.dist; D.fill(65535);
    const Q = this.queue; let h = 0, t = 0;
    const start = R * S + R;
    D[start] = 0; Q[t++] = start;
    const col = this.col;
    while (h < t) {
      const i = Q[h++], cx = i % S, cz = (i / S) | 0, d = D[i] + 1;
      for (let k = 0; k < 4; k++) {
        const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0), nz = cz + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || nz < 0 || nx >= S || nz >= S) continue;
        const j = nz * S + nx;
        if (D[j] <= d) continue;
        if (col.navBlocked(nx + this.ox, nz + this.oz) && j !== start) continue;
        D[j] = d; Q[t++] = j;
      }
    }
  }
  // direção sugerida (vetor unitário) a partir de (x,z), ou null
  dir(x, z) {
    const S = this.S;
    const cx = Math.floor(x + NAV_HALF) - this.ox, cz = Math.floor(z + NAV_HALF) - this.oz;
    if (cx < 1 || cz < 1 || cx >= S - 1 || cz >= S - 1) return null;
    let best = this.dist[cz * S + cx], bx = 0, bz = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const d = this.dist[(cz + dz) * S + cx + dx];
      // diagonal só se as duas laterais estiverem livres
      if (dx && dz && (this.dist[cz * S + cx + dx] === 65535 || this.dist[(cz + dz) * S + cx] === 65535)) continue;
      if (d < best) { best = d; bx = dx; bz = dz; }
    }
    if (!bx && !bz) return null;
    const l = Math.hypot(bx, bz);
    return { x: bx / l, z: bz / l };
  }
}
