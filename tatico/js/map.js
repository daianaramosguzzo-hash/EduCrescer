// Força Tática — mapa "Vila Poeira": grade, colisão, tiros (raycast) e navegação
import * as THREE from '../../lib/three.module.min.js';
import { CELL, WALL_H } from './config.js';
import * as TX from './textures.js';

export const W = 40, H = 40;

// Áreas do mapa (retângulos de chão em coordenadas de célula, inclusive)
export const ZONES = [
  { name: 'Base da Defesa', r: [15, 2, 24, 7], tint: 0xdfe3e6 },
  { name: 'Bomb A', r: [28, 1, 37, 10], tint: 0xffe8c2, site: 'A' },
  { name: 'Bomb B', r: [2, 1, 11, 10], tint: 0xf3dcc0, site: 'B' },
  { name: 'Lado A', r: [24, 3, 28, 6], tint: 0xe9e2d4 },
  { name: 'Lado B', r: [11, 3, 15, 6], tint: 0xe9e2d4 },
  { name: 'Meio', r: [18, 7, 21, 31], tint: 0xf6e2bf },
  { name: 'Base do Ataque', r: [14, 31, 25, 37], tint: 0xffdcae },
  { name: 'Saída Longo', r: [25, 33, 35, 36], tint: 0xffe2b8 },
  { name: 'Longo A', r: [32, 11, 35, 36], tint: 0xffe6c0 },
  { name: 'Saída Túnel', r: [4, 33, 14, 35], tint: 0xd8c2a0 },
  { name: 'Túnel B', r: [4, 11, 7, 35], tint: 0xc7b08c },
  { name: 'Curto A', r: [22, 13, 29, 15], tint: 0xf0dcbc },
  { name: 'Curto A', r: [28, 11, 29, 13], tint: 0xf0dcbc },
  { name: 'Conector B', r: [8, 20, 17, 22], tint: 0xeadabf },
];

// Paredes extras dentro das áreas (estreitamentos e portas)
const BLOCKS = [
  [18, 9], [21, 9],          // portas do meio
  [32, 27], [33, 27],        // portas do longo
  [4, 18], [5, 18],          // estreitamento do túnel
  [24, 7], [15, 7],          // cantos da base da defesa
  [25, 3], [25, 4],          // corredor da defesa para o A (quebra a linha reta)
  [13, 5], [13, 6],          // corredor da defesa para o B
];

// Vigas por cima das passagens (só visual + colisão alta)
const LINTELS = [
  [19, 9, 20, 9],
  [34, 27, 35, 27],
  [6, 18, 7, 18],
];

// Caixas: [célula x, célula z, tipo]  x = baixa (dá para pular), y = média
// (precisa pular agachado), X = alta (duas caixas empilhadas)
const CRATES = [
  // Bomb A
  [33, 4, 'X'], [34, 4, 'x'], [30, 8, 'y'], [36, 8, 'x'], [29, 2, 'x'], [33, 7, 'm'],
  // Bomb B
  [6, 4, 'X'], [7, 4, 'x'], [9, 7, 'y'], [3, 8, 'x'], [10, 2, 'X'], [4, 2, 'm'],
  // Longo
  [34, 30, 'x'], [32, 20, 'y'], [35, 13, 'm'],
  // Meio
  [20, 16, 'x'], [18, 26, 'x'], [19, 12, 'm'],
  // Bases
  [16, 33, 'x'], [23, 35, 'x'], [16, 3, 'x'], [23, 6, 'x'],
  // Curto, túnel e conector
  [25, 14, 'x'], [6, 25, 'x'], [12, 21, 'y'],
];

const CRATE_H = { x: 1.1, y: 1.6, X: 2.6, m: 2.0 };

export const SITES = {
  A: { min: [29 * CELL, 1 * CELL], max: [38 * CELL, 10 * CELL], center: new THREE.Vector3(32.5 * CELL, 0, 5.5 * CELL) },
  B: { min: [2 * CELL, 1 * CELL], max: [11 * CELL, 10 * CELL], center: new THREE.Vector3(6.5 * CELL, 0, 6 * CELL) },
};

export const SPAWN_RECT = { def: [16, 3, 23, 6], atk: [15, 32, 24, 36] };

// Pontos usados pelos bots (em células)
export const POINTS = {
  // caminhos do ataque
  long: [33.5, 24], longTop: [33.5, 12], short: [24, 14], midT: [19.5, 24], tunnel: [5.5, 26], tunnelTop: [5.5, 12], conn: [12, 21],
  // onde plantar
  plantA: [[31, 5], [35, 6], [32, 2], [36, 3]],
  plantB: [[5, 6], [8, 5], [4, 4], [8, 9]],
  // posições de espera da defesa: [x, z, olhar x, olhar z]
  holdA: [[30, 3, 33.5, 14], [36, 2, 33.5, 14], [31, 9, 28.5, 13], [37, 6, 33.5, 14], [29, 6, 28.5, 13]],
  holdB: [[3, 3, 5.5, 14], [9, 3, 5.5, 14], [10, 9, 5.5, 14], [3, 6, 5.5, 14], [8, 2, 5.5, 14]],
  holdMid: [[19, 5, 19.5, 20], [21, 4, 19.5, 20], [22, 7, 19.5, 20]],
  // entradas de cada bomb (para onde a defesa olha)
  entriesA: [[33.5, 12], [28.5, 12], [26, 5]],
  entriesB: [[5.5, 12], [12, 4], [10.5, 10]],
  entriesMid: [[19.5, 20], [19.5, 12]],
};

export const grid = new Uint8Array(W * H);     // 0 parede, 1 chão
export const zoneOf = new Int8Array(W * H).fill(-1);
export const navBlocked = new Uint8Array(W * H);

for (let i = 0; i < ZONES.length; i++) {
  const [x0, z0, x1, z1] = ZONES[i].r;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    grid[z * W + x] = 1;
    if (zoneOf[z * W + x] < 0) zoneOf[z * W + x] = i;
  }
}
for (const [x, z] of BLOCKS) grid[z * W + x] = 0;

export function isFloor(cx, cz) {
  return cx >= 0 && cz >= 0 && cx < W && cz < H && grid[cz * W + cx] === 1;
}

export function zoneName(x, z) {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  if (cx < 0 || cz < 0 || cx >= W || cz >= H) return '';
  const i = zoneOf[cz * W + cx];
  return i >= 0 ? ZONES[i].name : '';
}

// ---------------------------------------------------------------- caixas de colisão
// box: { min:[x,y,z], max:[x,y,z], kind, pen }
export const boxes = [];
const cellBoxes = Array.from({ length: W * H }, () => []);

function addBox(minx, miny, minz, maxx, maxy, maxz, kind, pen = false) {
  const b = { min: [minx, miny, minz], max: [maxx, maxy, maxz], kind, pen, stamp: 0 };
  const i = boxes.length;
  boxes.push(b);
  const cx0 = Math.max(0, Math.floor(minx / CELL)), cx1 = Math.min(W - 1, Math.floor((maxx - 1e-4) / CELL));
  const cz0 = Math.max(0, Math.floor(minz / CELL)), cz1 = Math.min(H - 1, Math.floor((maxz - 1e-4) / CELL));
  for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) cellBoxes[z * W + x].push(i);
  return b;
}

const wallCells = [];
for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
  if (grid[z * W + x]) continue;
  let edge = false;
  for (let dz = -1; dz <= 1 && !edge; dz++) for (let dx = -1; dx <= 1; dx++) if (isFloor(x + dx, z + dz)) { edge = true; break; }
  if (!edge) continue;
  wallCells.push([x, z]);
  addBox(x * CELL, 0, z * CELL, (x + 1) * CELL, WALL_H, (z + 1) * CELL, 'wall');
}

export const crates = [];
const CRATE_W = 2.4;
for (const [cx, cz, t] of CRATES) {
  const x = (cx + 0.5) * CELL, z = (cz + 0.5) * CELL, h = CRATE_H[t];
  const metal = t === 'm';
  const b = addBox(x - CRATE_W / 2, 0, z - CRATE_W / 2, x + CRATE_W / 2, h, z + CRATE_W / 2, metal ? 'metal' : 'crate', !metal);
  crates.push({ x, z, h, t, box: b });
  navBlocked[cz * W + cx] = 1;
}

for (const [x0, z0, x1, z1] of LINTELS) {
  addBox(x0 * CELL, 3.4, z0 * CELL, (x1 + 1) * CELL, WALL_H, (z1 + 1) * CELL, 'lintel');
}

let stampCounter = 1;

// Primeira caixa que encosta no volume dado (ou null)
export function overlapBox(minx, miny, minz, maxx, maxy, maxz) {
  const stamp = ++stampCounter;
  const cx0 = Math.max(0, Math.floor(minx / CELL)), cx1 = Math.min(W - 1, Math.floor(maxx / CELL));
  const cz0 = Math.max(0, Math.floor(minz / CELL)), cz1 = Math.min(H - 1, Math.floor(maxz / CELL));
  for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) {
    // fora do mapa jogável conta como parede
    for (const i of cellBoxes[z * W + x]) {
      const b = boxes[i];
      if (b.stamp === stamp) continue;
      b.stamp = stamp;
      if (minx < b.max[0] && maxx > b.min[0] && miny < b.max[1] && maxy > b.min[1] && minz < b.max[2] && maxz > b.min[2]) return b;
    }
  }
  return null;
}

// Interseção raio × caixa (slab). Devolve [tEntrada, eixo, tSaída] ou null
function slab(b, ox, oy, oz, dx, dy, dz) {
  let tmin = -Infinity, tmax = Infinity, axis = -1;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < b.min[a] || o[a] > b.max[a]) return null;
    } else {
      let t1 = (b.min[a] - o[a]) / d[a], t2 = (b.max[a] - o[a]) / d[a];
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      if (t1 > tmin) { tmin = t1; axis = a; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  return [tmin, axis, tmax];
}

const hit = { t: 0, box: null, normal: new THREE.Vector3(), exit: 0 };

// Raio pelo mapa (DDA na grade). Devolve o objeto `hit` reutilizado ou null.
export function raycast(ox, oy, oz, dx, dy, dz, maxT) {
  let cx = Math.floor(ox / CELL), cz = Math.floor(oz / CELL);
  const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tdx = Math.abs(dx) > 1e-9 ? Math.abs(CELL / dx) : Infinity;
  const tdz = Math.abs(dz) > 1e-9 ? Math.abs(CELL / dz) : Infinity;
  let tmx = Math.abs(dx) > 1e-9 ? (dx > 0 ? (cx + 1) * CELL - ox : ox - cx * CELL) / Math.abs(dx) : Infinity;
  let tmz = Math.abs(dz) > 1e-9 ? (dz > 0 ? (cz + 1) * CELL - oz : oz - cz * CELL) / Math.abs(dz) : Infinity;
  let best = maxT, bestBox = null, bestAxis = 0, bestExit = 0;
  const stamp = ++stampCounter;
  let tEnter = 0;
  while (tEnter <= best) {
    if (cx < 0 || cz < 0 || cx >= W || cz >= H) break;
    for (const i of cellBoxes[cz * W + cx]) {
      const b = boxes[i];
      if (b.stamp === stamp) continue;
      b.stamp = stamp;
      const s = slab(b, ox, oy, oz, dx, dy, dz);
      if (!s || s[0] < -1e-5 || s[0] >= best) continue;
      best = s[0]; bestBox = b; bestAxis = s[1]; bestExit = s[2];
    }
    if (tmx < tmz) { tEnter = tmx; tmx += tdx; cx += stepX; }
    else { tEnter = tmz; tmz += tdz; cz += stepZ; }
  }
  // chão
  if (dy < -1e-9) {
    const tf = -oy / dy;
    if (tf >= 0 && tf < best) {
      hit.t = tf; hit.box = null; hit.normal.set(0, 1, 0); hit.exit = tf;
      return hit;
    }
  }
  if (!bestBox) return null;
  hit.t = best; hit.box = bestBox; hit.exit = bestExit;
  const d = [dx, dy, dz];
  hit.normal.set(0, 0, 0).setComponent(bestAxis, d[bestAxis] > 0 ? -1 : 1);
  return hit;
}

export function segmentClear(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return true;
  return !raycast(a.x, a.y, a.z, dx / len, dy / len, dz / len, len);
}

// ---------------------------------------------------------------- navegação
export function walkable(cx, cz) {
  return isFloor(cx, cz) && !navBlocked[cz * W + cx];
}

export function cellOf(v) {
  return [Math.floor(v.x / CELL), Math.floor(v.z / CELL)];
}

export function cellCenter(cx, cz, y = 0) {
  return new THREE.Vector3((cx + 0.5) * CELL, y, (cz + 0.5) * CELL);
}

export function nearestWalkable(cx, cz) {
  if (walkable(cx, cz)) return [cx, cz];
  for (let r = 1; r < 6; r++) {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      if (walkable(cx + dx, cz + dz)) return [cx + dx, cz + dz];
    }
  }
  return [cx, cz];
}

const gScore = new Float32Array(W * H);
const came = new Int32Array(W * H);
const closed = new Uint8Array(W * H);

export function findPath(from, to) {
  const [sx, sz] = nearestWalkable(...cellOf(from));
  const [tx, tz] = nearestWalkable(...cellOf(to));
  const start = sz * W + sx, goal = tz * W + tx;
  gScore.fill(Infinity); came.fill(-1); closed.fill(0);
  gScore[start] = 0;
  const heap = [[0, start]];
  const hfn = (i) => { const x = i % W, z = (i / W) | 0; const ddx = Math.abs(x - tx), ddz = Math.abs(z - tz); return Math.max(ddx, ddz) + 0.414 * Math.min(ddx, ddz); };
  const push = (f, i) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
      }
    }
    return top;
  };
  let found = false;
  while (heap.length) {
    const [, cur] = pop();
    if (closed[cur]) continue;
    if (cur === goal) { found = true; break; }
    closed[cur] = 1;
    const x = cur % W, z = (cur / W) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = x + dx, nz = z + dz;
      if (!walkable(nx, nz)) continue;
      if (dx && dz && (!walkable(x + dx, z) || !walkable(x, z + dz))) continue;
      const ni = nz * W + nx;
      const g = gScore[cur] + (dx && dz ? 1.414 : 1);
      if (g < gScore[ni]) { gScore[ni] = g; came[ni] = cur; push(g + hfn(ni), ni); }
    }
  }
  if (!found) return [to.clone()];
  const cells = [];
  for (let c = goal; c !== -1; c = came[c]) cells.push(c);
  cells.reverse();
  const pts = cells.map(c => cellCenter(c % W, (c / W) | 0));
  pts[pts.length - 1] = to.clone().setY(0);
  // suaviza: pula pontos quando dá para andar em linha reta
  const out = [];
  let i = 0;
  const cur = from.clone().setY(0);
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !walkLine(cur, pts[j])) j--;
    out.push(pts[j]);
    cur.copy(pts[j]);
    i = j + 1;
  }
  return out;
}

// Dá para andar em linha reta de a até b sem esbarrar?
export function walkLine(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const n = Math.ceil(len / 0.5);
  const R = 0.55;
  for (let k = 0; k <= n; k++) {
    const t = n ? k / n : 0;
    const x = a.x + dx * t, z = a.z + dz * t;
    for (const [ox, oz] of [[R, R], [-R, R], [R, -R], [-R, -R]]) {
      if (!walkable(Math.floor((x + ox) / CELL), Math.floor((z + oz) / CELL))) return false;
    }
  }
  return true;
}

export function randomSpawns(team, n) {
  const [x0, z0, x1, z1] = SPAWN_RECT[team];
  const cells = [];
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (walkable(x, z)) cells.push([x, z]);
  for (let i = cells.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return cells.slice(0, n).map(([x, z]) => cellCenter(x, z).add(new THREE.Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5))));
}

export function inSpawn(team, pos) {
  const [x0, z0, x1, z1] = SPAWN_RECT[team];
  const cx = pos.x / CELL, cz = pos.z / CELL;
  return cx >= x0 - 1 && cx <= x1 + 2 && cz >= z0 - 1 && cz <= z1 + 2;
}

export function siteAt(pos) {
  for (const k of ['A', 'B']) {
    const s = SITES[k];
    if (pos.x >= s.min[0] && pos.x <= s.max[0] && pos.z >= s.min[1] && pos.z <= s.max[1]) return k;
  }
  return null;
}

export function pt(p, y = 0) {
  return new THREE.Vector3(p[0] * CELL, y, p[1] * CELL);
}

// ---------------------------------------------------------------- visual
export function buildMap(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // chão
  const floorTex = TX.floorTexture();
  floorTex.repeat.set(W / 2, H / 2);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W * CELL, H * CELL),
    new THREE.MeshLambertMaterial({ map: floorTex }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W * CELL / 2, 0, H * CELL / 2);
  floor.receiveShadow = true;
  group.add(floor);

  // piso de lajota na base da defesa
  const tile = TX.tileTexture();
  const [bx0, bz0, bx1, bz1] = ZONES[0].r;
  tile.repeat.set((bx1 - bx0 + 1) * CELL / 4, (bz1 - bz0 + 1) * CELL / 4);
  const tiles = new THREE.Mesh(
    new THREE.PlaneGeometry((bx1 - bx0 + 1) * CELL, (bz1 - bz0 + 1) * CELL),
    new THREE.MeshLambertMaterial({ map: tile, polygonOffset: true, polygonOffsetFactor: -1 }),
  );
  tiles.rotation.x = -Math.PI / 2;
  tiles.position.set((bx0 + bx1 + 1) / 2 * CELL, 0.005, (bz0 + bz1 + 1) / 2 * CELL);
  tiles.receiveShadow = true;
  group.add(tiles);

  // letras dos bombs
  for (const k of ['A', 'B']) {
    const s = SITES[k];
    const d = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshLambertMaterial({ map: TX.siteDecal(k), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    d.rotation.x = -Math.PI / 2;
    d.position.set(s.center.x, 0.01, s.center.z);
    d.receiveShadow = true;
    group.add(d);
  }

  // paredes (instanciadas)
  const wallGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
  const wallMat = new THREE.MeshLambertMaterial({ map: TX.wallTexture() });
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, wallCells.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  let seed = 5;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  wallCells.forEach(([x, z], i) => {
    m.makeTranslation((x + 0.5) * CELL, WALL_H / 2, (z + 0.5) * CELL);
    walls.setMatrixAt(i, m);
    let tint = 0xf0e0c0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (isFloor(x + dx, z + dz)) tint = ZONES[zoneOf[(z + dz) * W + x + dx]].tint;
    }
    const v = 0.9 + rnd() * 0.12;
    col.setHex(tint).multiplyScalar(v);
    walls.setColorAt(i, col);
  });
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // caixas
  const woodMat = new THREE.MeshLambertMaterial({ map: TX.crateTexture('wood') });
  const metalMat = new THREE.MeshLambertMaterial({ map: TX.crateTexture('metal') });
  for (const c of crates) {
    const mat = c.t === 'm' ? metalMat : woodMat;
    const parts = c.t === 'X' ? [[0, 1.3, CRATE_W], [1.3, 1.3, CRATE_W * 0.86]] : [[0, c.h, CRATE_W]];
    for (const [y0, h, w] of parts) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
      mesh.position.set(c.x, y0 + h / 2, c.z);
      if (c.t === 'X' && y0 > 0) mesh.rotation.y = 0.12;
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  // vigas das portas
  const beamMat = new THREE.MeshLambertMaterial({ map: TX.woodTexture() });
  for (const [x0, z0, x1, z1] of LINTELS) {
    const w = (x1 - x0 + 1) * CELL, d = (z1 - z0 + 1) * CELL;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H - 3.4, d), wallMat.clone());
    beam.material.color.setHex(0xe6d2a8);
    beam.position.set((x0 + x1 + 1) / 2 * CELL, (3.4 + WALL_H) / 2, (z0 + z1 + 1) / 2 * CELL);
    beam.castShadow = true;
    group.add(beam);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.25, d + 0.3), beamMat);
    trim.position.set(beam.position.x, 3.5, beam.position.z);
    group.add(trim);
  }

  // placas nas paredes
  const signs = [
    ['A →', 28, 33, 'n'], ['← B', 11, 33, 'n'], ['A', 35, 15, 'e'], ['B', 4, 15, 'w'],
    ['A →', 24, 13, 'n'], ['← B', 10, 20, 'n'], ['A →', 22, 2, 'n'], ['← B', 17, 2, 'n'],
    ['MEIO', 19, 30, 'w'],
  ];
  const dirs = { n: [0, -1, 0], s: [0, 1, Math.PI], e: [1, 0, -Math.PI / 2], w: [-1, 0, Math.PI / 2] };
  for (const [text, cx, cz, dir] of signs) {
    const [dx, dz, rot] = dirs[dir];
    if (isFloor(cx + dx, cz + dz)) continue;
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.2),
      new THREE.MeshLambertMaterial({ map: TX.signTexture(text), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    s.position.set((cx + 0.5 + dx * 0.5) * CELL - dx * 0.02, 2.4, (cz + 0.5 + dz * 0.5) * CELL - dz * 0.02);
    // a placa olha para dentro da área
    s.rotation.y = rot;
    group.add(s);
  }

  return group;
}

// Desenho do mapa para o radar (1 célula = s pixels)
export function radarImage(s = 6) {
  const c = document.createElement('canvas');
  c.width = W * s; c.height = H * s;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (!grid[z * W + x]) continue;
    g.fillStyle = 'rgba(205,190,160,0.75)';
    g.fillRect(x * s, z * s, s, s);
  }
  g.fillStyle = 'rgba(90,75,55,0.85)';
  for (const c2 of crates) g.fillRect(c2.x / CELL * s - s * 0.4, c2.z / CELL * s - s * 0.4, s * 0.8, s * 0.8);
  g.fillStyle = 'rgba(220,60,40,0.9)';
  g.font = `bold ${s * 3}px sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const k of ['A', 'B']) g.fillText(k, SITES[k].center.x / CELL * s, SITES[k].center.z / CELL * s);
  return c;
}
