// Caminhos: A* em 8 direções (sem cortar quinas) e alcance por PA (Dijkstra).
import { S } from '../world/tiles.js';

const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// opts: { occupied(x,z) → bool, passFriend(x,z) → dá para atravessar (aliado), allowDoors: abre portas fechadas (custa +1), maxCost, goalAdjacent }
export function passCost(map, x, z, opts) {
  if (!map.inb(x, z)) return -1;
  const i = map.idx(x, z);
  const s = map.struct[i];
  if (s === S.DOOR || s === S.GATE) {
    const d = map.doors.get(i);
    if (!d) return -1;
    if (d.barricade > 0) return opts.breakDoors ? 6 : -1;
    if (d.open) return 1;
    if (d.locked) return opts.breakDoors ? 6 : -1;
    return opts.allowDoors ? 2 : -1;
  }
  if (map.blocked(x, z)) return -1;
  if (map.fire.has(i) && opts.avoidFire) return 6;
  return 1;
}

class Heap {
  constructor() { this.a = []; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}

export function findPath(map, sx, sz, tx, tz, opts = {}) {
  const occ = opts.occupied || (() => false);
  const pass = opts.passFriend || (() => false);
  const W = map.W;
  const goalAdj = !!opts.goalAdjacent;
  const maxNodes = opts.maxNodes || 6000;
  const isGoal = (x, z) => goalAdj ? (Math.max(Math.abs(x - tx), Math.abs(z - tz)) <= 1 && !(x === tx && z === tz)) : (x === tx && z === tz);
  if (!goalAdj && passCost(map, tx, tz, opts) < 0) return null;
  if (goalAdj && Math.max(Math.abs(sx - tx), Math.abs(sz - tz)) <= 1 && !(sx === tx && sz === tz)) return [];
  const g = new Map(), came = new Map();
  const h = (x, z) => { const dx = Math.abs(x - tx), dz = Math.abs(z - tz); return Math.max(dx, dz) + 0.001 * Math.min(dx, dz); };
  const start = sz * W + sx;
  g.set(start, 0);
  const open = new Heap();
  open.push({ x: sx, z: sz, f: h(sx, sz) });
  let nodes = 0;
  while (open.size) {
    const cur = open.pop();
    const ci = cur.z * W + cur.x;
    if (isGoal(cur.x, cur.z) && ci !== start && !occ(cur.x, cur.z)) {
      const path = [];
      let k = ci;
      while (k !== start) { path.push([k % W, (k / W) | 0]); k = came.get(k); }
      return path.reverse();
    }
    if (++nodes > maxNodes) return null;
    const gc = g.get(ci);
    if (opts.maxCost && gc >= opts.maxCost) continue;
    for (const [dx, dz] of NB) {
      const nx = cur.x + dx, nz = cur.z + dz;
      const c = passCost(map, nx, nz, opts);
      if (c < 0) continue;
      if (dx && dz) { if (passCost(map, cur.x + dx, cur.z, opts) !== 1 || passCost(map, cur.x, cur.z + dz, opts) !== 1) continue; }
      if (occ(nx, nz) && !(nx === tx && nz === tz && goalAdj === false && opts.targetOccupiedOk) && !pass(nx, nz)) continue;
      const ni = nz * W + nx;
      const ng = gc + c + (dx && dz ? 0.0001 : 0);
      if (!g.has(ni) || ng < g.get(ni)) {
        g.set(ni, ng); came.set(ni, ci);
        open.push({ x: nx, z: nz, f: ng + h(nx, nz) });
      }
    }
  }
  return null;
}

// custo em PA de um caminho (portas fechadas custam 1 a mais)
export function pathCost(map, path, opts = {}) {
  let c = 0;
  for (const [x, z] of path) { const p = passCost(map, x, z, { allowDoors: true, ...opts }); c += p < 0 ? 99 : p; }
  return c;
}

// alcance: células atingíveis com até maxCost PA → Map(idx → custo)
export function reachable(map, sx, sz, maxCost, opts = {}) {
  const occ = opts.occupied || (() => false);
  const pass = opts.passFriend || (() => false);
  const W = map.W;
  const dist = new Map();
  const through = [];
  const start = sz * W + sx;
  dist.set(start, 0);
  const open = new Heap();
  open.push({ x: sx, z: sz, f: 0 });
  while (open.size) {
    const cur = open.pop();
    const ci = cur.z * W + cur.x;
    if (cur.f > dist.get(ci)) continue;
    for (const [dx, dz] of NB) {
      const nx = cur.x + dx, nz = cur.z + dz;
      const c = passCost(map, nx, nz, opts);
      if (c < 0) continue;
      if (dx && dz) { if (passCost(map, cur.x + dx, cur.z, opts) !== 1 || passCost(map, cur.x, cur.z + dz, opts) !== 1) continue; }
      if (occ(nx, nz)) { if (!pass(nx, nz)) continue; through.push(nz * W + nx); }
      const nd = cur.f + c;
      if (nd > maxCost) continue;
      const ni = nz * W + nx;
      if (!dist.has(ni) || nd < dist.get(ni)) { dist.set(ni, nd); open.push({ x: nx, z: nz, f: nd }); }
    }
  }
  // dá para passar por aliados, mas não parar em cima deles
  for (const i of through) dist.delete(i);
  return dist;
}
