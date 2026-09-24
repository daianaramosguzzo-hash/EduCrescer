// Plantas baixas: grade de caracteres que vira paredes, portas, janelas, cômodos e móveis.
//
// Estruturas:  #  parede    =  janela    +  porta    !  porta de entrada    $  porta trancada
//              &  porta aberta    %  muro    |  grade    /  portão    ^  cerca
// Cômodos (minúsculas) marcam o tipo do cômodo; "." é piso comum do cômodo.
// Maiúsculas e outros símbolos são móveis (conforme a legenda). Dígitos são marcas.
import { S, F, PROPS } from './tiles.js';

export const ROOMS = {
  s: { nome: 'Sala', floor: 'madeira' },
  c: { nome: 'Cozinha', floor: 'ceramica' },
  q: { nome: 'Quarto', floor: 'madeira' },
  b: { nome: 'Banheiro', floor: 'banheiro', loot: 'banheiro' },
  r: { nome: 'Corredor', floor: 'granilite' },
  a: { nome: 'Área de serviço', floor: 'cimento' },
  o: { nome: 'Escritório', floor: 'madeira', loot: 'escritorio' },
  d: { nome: 'Depósito', floor: 'cimento' },
  x: { nome: 'Garagem', floor: 'cimento', loot: 'garagem' },
  l: { nome: 'Salão da loja', floor: 'ceramica' },
  e: { nome: 'Estoque', floor: 'cimento' },
  k: { nome: 'Cozinha', floor: 'ceramica' },
  u: { nome: 'Sala de aula', floor: 'granilite', loot: 'escola_sala' },
  i: { nome: 'Biblioteca', floor: 'madeira' },
  h: { nome: 'Sala dos professores', floor: 'granilite', loot: 'escola_secretaria' },
  n: { nome: 'Secretaria', floor: 'granilite', loot: 'escola_secretaria' },
  m: { nome: 'Salão do mercado', floor: 'mercado' },
  j: { nome: 'Nave', floor: 'ladrilho' },
  z: { nome: 'Laboratório', floor: 'lab', loot: 'laboratorio' },
  w: { nome: 'Sala fria', floor: 'lab', loot: 'laboratorio' },
  g: { nome: 'Galpão', floor: 'cimento' },
  t: { nome: 'Saguão', floor: 'granilite' },
  v: { nome: 'Varanda', floor: 'ceramica' },
  y: { nome: 'Quintal', floor: 'grama', out: true, loot: 'quintal' },
  f: { nome: 'Jardim', floor: 'ceramica', out: true },
  p: { nome: 'Pátio', floor: 'cimento', out: true },
  '~': { nome: 'Terreno', floor: 'terra', out: true },
  '_': { nome: 'Quadra', floor: 'quadra', out: true },
  ',': { nome: 'Gramado', floor: 'grama', out: true },
  ';': { nome: 'Estacionamento', floor: 'estacionamento', out: true },
  ':': { nome: 'Calçada', floor: 'calcada', out: true },
  '"': { nome: 'Praça', floor: 'pedra', out: true },
};

const STRUCT_CH = { '#': S.WALL, '=': S.WINDOW, '+': S.DOOR, '!': S.DOOR, '$': S.DOOR, '&': S.DOOR, '%': S.MURO, '|': S.GRADE, '/': S.GATE, '^': S.FENCE };

// Planta montada por código (para prédios grandes)
export class BP {
  constructor(w, h, ch = ' ') { this.w = w; this.h = h; this.g = Array.from({ length: h }, () => Array(w).fill(ch)); }
  set(x, z, ch) { if (x >= 0 && z >= 0 && x < this.w && z < this.h) this.g[z][x] = ch; return this; }
  fill(x0, z0, x1, z1, ch) { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(x, z, ch); return this; }
  outline(x0, z0, x1, z1, ch) { for (let x = x0; x <= x1; x++) { this.set(x, z0, ch); this.set(x, z1, ch); } for (let z = z0; z <= z1; z++) { this.set(x0, z, ch); this.set(x1, z, ch); } return this; }
  hline(z, x0, x1, ch) { for (let x = x0; x <= x1; x++) this.set(x, z, ch); return this; }
  vline(x, z0, z1, ch) { for (let z = z0; z <= z1; z++) this.set(x, z, ch); return this; }
  text(x, z, str) { for (let i = 0; i < str.length; i++) if (str[i] !== ' ') this.set(x + i, z, str[i]); return this; }
  rows() { return this.g.map(r => r.join('')); }
}

// gira a planta k vezes 90° no sentido horário (a frente, embaixo, vai para a esquerda)
export function rotateRows(rows, k) {
  k = ((k % 4) + 4) % 4;
  let r = rows;
  for (let i = 0; i < k; i++) {
    const h = r.length, w = r[0].length;
    const out = [];
    for (let x = 0; x < w; x++) {
      let s = '';
      for (let z = h - 1; z >= 0; z--) s += r[z][x];
      out.push(s);
    }
    r = out;
  }
  return r;
}
export function mirrorRows(rows) { return rows.map(r => [...r].reverse().join('')); }
// frente da planta (embaixo) voltada para: S (padrão), W, N, E
export function orient(rows, facing = 'S', mirror = false) {
  const k = { S: 0, W: 1, N: 2, E: 3 }[facing] || 0;
  return rotateRows(mirror ? mirrorRows(rows) : rows, k);
}

const FACE = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // rot 0 sul, 1 leste, 2 norte, 3 oeste

// Carimba a planta no mapa. Retorna informações do prédio criado.
// opts: { name, type, legend, roof, wall, trim, marks: {digito: nome}, lootMap: {tipoProp: tabela}, doorLocks: {x,z: chave}, outdoorOnly }
export function stamp(map, rows, ox, oz, opts = {}) {
  const h = rows.length, w = rows[0].length;
  for (const r of rows) if (r.length !== w) console.warn('planta com linhas de tamanhos diferentes:', opts.name, r);
  const legend = opts.legend || {};
  const ch = (x, z) => (x < 0 || z < 0 || x >= w || z >= h) ? ' ' : rows[z][x];
  const isStruct = c => c in STRUCT_CH;
  // --- regiões (cômodos) por flood fill
  const region = Array.from({ length: h }, () => new Int32Array(w).fill(-1));
  const regions = [];
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const c = ch(x, z);
    if (c === ' ' || isStruct(c) || region[z][x] >= 0) continue;
    const id = regions.length;
    const cells = [], markers = [];
    const st = [[x, z]]; region[z][x] = id;
    while (st.length) {
      const [cx, cz] = st.pop();
      cells.push([cx, cz]);
      const cc = ch(cx, cz);
      if (ROOMS[cc]) markers.push([cx, cz, cc]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= h || region[nz][nx] >= 0) continue;
        const nc = ch(nx, nz);
        if (nc === ' ' || isStruct(nc)) continue;
        region[nz][nx] = id; st.push([nx, nz]);
      }
    }
    regions.push({ cells, markers });
  }
  // tipo de cômodo de cada célula: marcador mais próximo da região
  const cellRoom = Array.from({ length: h }, () => Array(w).fill(null));
  for (const reg of regions) {
    for (const [x, z] of reg.cells) {
      let best = null, bd = 1e9;
      for (const [mx, mz, mc] of reg.markers) { const d = Math.abs(mx - x) + Math.abs(mz - z); if (d < bd) { bd = d; best = mc; } }
      cellRoom[z][x] = best || opts.defaultRoom || ',';
    }
  }
  // --- prédio
  const hasIndoor = regions.some(r => r.cells.some(([x, z]) => !ROOMS[cellRoom[z][x]]?.out));
  let bld = null;
  if (hasIndoor && !opts.outdoorOnly) {
    bld = { id: map.buildings.length, name: opts.name || 'Casa', type: opts.type || 'casa', roof: opts.roof || 'telha',
      wall: opts.wall || '#e8d8b0', trim: opts.trim || '#b86a3a', roofColor: opts.roofColor || null,
      x0: 1e9, z0: 1e9, x1: -1, z1: -1, doors: [], rooms: [], lootMap: opts.lootMap || {}, info: opts.info || {} };
    map.buildings.push(bld);
  }
  // cômodos no mapa (um por marcador dominante de cada região)
  const roomIds = new Map();
  const roomOf = (reg, rc) => {
    const key = reg + '|' + rc;
    if (!roomIds.has(key)) {
      const info = ROOMS[rc] || ROOMS[','];
      const room = { id: map.rooms.length, type: rc, nome: info.nome, out: !!info.out, building: info.out ? -1 : (bld ? bld.id : -1) };
      map.rooms.push(room);
      roomIds.set(key, room.id);
      if (bld && !info.out) bld.rooms.push(room.id);
    }
    return roomIds.get(key);
  };
  // --- células
  const propCells = new Map(); // letra → células
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const c = ch(x, z);
    if (c === ' ') continue;
    const mx = ox + x, mz = oz + z;
    if (!map.inb(mx, mz)) continue;
    const i = map.idx(mx, mz);
    map.propAt[i] = -1;
    if (isStruct(c)) {
      map.struct[i] = STRUCT_CH[c];
      if (c === '%' || c === '|' || c === '^' || c === '/') map.floor[i] = F[opts.muroFloor || 'calcada'];
      if (STRUCT_CH[c] === S.DOOR || STRUCT_CH[c] === S.GATE) {
        const horiz = isStruct(ch(x - 1, z)) || isStruct(ch(x + 1, z));
        const d = { x: mx, z: mz, open: c === '&', locked: c === '$', key: null, hp: c === '/' ? 30 : 22, maxHp: c === '/' ? 30 : 22, barricade: 0,
          gate: c === '/', axis: horiz ? 'x' : 'z', entrance: c === '!', building: -1 };
        const lk = opts.doorLocks && opts.doorLocks[`${x},${z}`];
        if (lk) { d.locked = true; d.key = lk; }
        map.doors.set(i, d);
      }
      if (STRUCT_CH[c] === S.WINDOW) {
        const horiz = isStruct(ch(x - 1, z)) || isStruct(ch(x + 1, z));
        map.windows.set(i, { x: mx, z: mz, broken: false, barricade: 0, axis: horiz ? 'x' : 'z' });
      }
      continue;
    }
    map.struct[i] = S.NONE;
    const rid = region[z][x];
    const rc = cellRoom[z][x];
    const info = ROOMS[rc] || ROOMS[','];
    map.floor[i] = F[(opts.floorOverride && opts.floorOverride[rc]) || info.floor];
    map.room[i] = roomOf(rid, rc);
    if (bld && !info.out) {
      map.building[i] = bld.id;
      bld.x0 = Math.min(bld.x0, mx); bld.z0 = Math.min(bld.z0, mz); bld.x1 = Math.max(bld.x1, mx); bld.z1 = Math.max(bld.z1, mz);
    } else map.building[i] = -1;
    if (/[0-9]/.test(c)) {
      const name = (opts.marks && opts.marks[c]) || ((opts.name || 'bp') + c);
      (map.marks[name] ||= []).push([mx, mz]);
    } else if (c !== '.' && !ROOMS[c]) {
      if (!propCells.has(c)) propCells.set(c, []);
      propCells.get(c).push([x, z]);
    }
  }
  // paredes, portas e janelas do prédio (vizinhas de células internas)
  if (bld) {
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
      const c = ch(x, z);
      if (!isStruct(c) || c === '%' || c === '|' || c === '^' || c === '/') continue;
      let touches = false;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        const nc = ch(nx, nz);
        if (nc !== ' ' && !isStruct(nc) && !ROOMS[cellRoom[nz][nx]]?.out) touches = true;
      }
      if (!touches) continue;
      const mx = ox + x, mz = oz + z;
      if (!map.inb(mx, mz)) continue;
      const i = map.idx(mx, mz);
      map.building[i] = bld.id;
      bld.x0 = Math.min(bld.x0, mx); bld.z0 = Math.min(bld.z0, mz); bld.x1 = Math.max(bld.x1, mx); bld.z1 = Math.max(bld.z1, mz);
      const d = map.doors.get(i);
      if (d) { d.building = bld.id; bld.doors.push(i); }
    }
    bld.rects = roofRects(map, bld);
  }
  // --- móveis
  const placed = [];
  for (const [c, cells] of propCells) {
    let type = legend[c];
    if (!type) { console.warn('letra sem legenda', c, opts.name); continue; }
    const comps = components(cells);
    for (const comp of comps) {
      let t = type;
      if (t === 'cama' && comp.length === 4) t = 'cama_casal';
      for (const piece of splitComponent(comp, PROPS[t].size)) {
        const p = placeProp(map, t, piece, ox, oz, rows, opts);
        if (p) placed.push(p);
      }
    }
  }
  // loot conforme cômodo e prédio
  for (const p of placed) {
    const r = map.roomAt(p.x, p.z);
    if (bld && bld.lootMap[p.type]) p.lootTable = bld.lootMap[p.type];
    else if (bld && bld.lootMap['*'] && p.lootTable) p.lootTable = bld.lootMap['*'];
    else if (r && ROOMS[r.type]?.loot && p.lootTable && !['geladeira', 'armario', 'pia', 'armarinho'].includes(p.type)) p.lootTable = ROOMS[r.type].loot;
    if (bld) p.building = bld.id;
  }
  return { bld, props: placed, w, h };
}

function components(cells) {
  const set = new Set(cells.map(([x, z]) => x + ',' + z));
  const out = [];
  while (set.size) {
    const first = set.values().next().value;
    set.delete(first);
    const comp = [], st = [first.split(',').map(Number)];
    while (st.length) {
      const [x, z] = st.pop(); comp.push([x, z]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = (x + dx) + ',' + (z + dz);
        if (set.has(k)) { set.delete(k); st.push([x + dx, z + dz]); }
      }
    }
    out.push(comp);
  }
  return out;
}
// divide um grupo de células em peças do tamanho do móvel
function splitComponent(comp, size) {
  const [sw, sd] = size;
  const set = new Set(comp.map(([x, z]) => x + ',' + z));
  const sorted = comp.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const pieces = [];
  const fits = (x, z, w, d) => { for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) if (!set.has((x + dx) + ',' + (z + dz))) return false; return true; };
  for (const [x, z] of sorted) {
    if (!set.has(x + ',' + z)) continue;
    let dims = null;
    // prefere a orientação que cobre o grupo inteiro
    const minX = Math.min(...comp.map(c => c[0])), maxX = Math.max(...comp.map(c => c[0]));
    const horizontalGroup = (maxX - minX + 1) >= sw;
    const opts = horizontalGroup ? [[sw, sd], [sd, sw]] : [[sd, sw], [sw, sd]];
    for (const [w, d] of opts) if (fits(x, z, w, d)) { dims = [w, d]; break; }
    if (!dims) { set.delete(x + ',' + z); continue; }
    for (let dz = 0; dz < dims[1]; dz++) for (let dx = 0; dx < dims[0]; dx++) set.delete((x + dx) + ',' + (z + dz));
    pieces.push({ x, z, w: dims[0], d: dims[1] });
  }
  return pieces;
}
function placeProp(map, type, piece, ox, oz, rows, opts) {
  const def = PROPS[type];
  const [sw, sd] = def.size;
  const x = ox + piece.x, z = oz + piece.z;
  let rots;
  if (sw === sd) rots = [0, 1, 2, 3];
  else if (piece.w === sw && piece.d === sd) rots = [0, 2];
  else rots = [1, 3];
  // escolhe a rotação com as costas na parede
  const solid = (cx, cz) => { const s = map.structAt(cx, cz); return s === S.WALL || s === S.WINDOW || s === S.MURO; };
  let best = rots[0], bestScore = -1;
  for (const r of rots) {
    const [fx, fz] = FACE[r];
    let score = 0;
    for (let dz = 0; dz < piece.d; dz++) for (let dx = 0; dx < piece.w; dx++) {
      const bx = x + dx - fx, bz = z + dz - fz;
      if ((bx < x || bx >= x + piece.w || bz < z || bz >= z + piece.d) && solid(bx, bz)) score++;
      const ffx = x + dx + fx, ffz = z + dz + fz;
      if ((ffx < x || ffx >= x + piece.w || ffz < z || ffz >= z + piece.d) && solid(ffx, ffz)) score -= 0.5;
    }
    if (score > bestScore) { bestScore = score; best = r; }
  }
  if (opts.forceRot && opts.forceRot[type] !== undefined) best = opts.forceRot[type];
  const p = map.addProp(type, x, z, piece.w, piece.d, best);
  if (def.lootChance === undefined) p.lootTable = null;
  return p;
}

// divide as células do prédio em retângulos (para os telhados)
function roofRects(map, bld) {
  const W = bld.x1 - bld.x0 + 1, H = bld.z1 - bld.z0 + 1;
  const mask = Array.from({ length: H }, (_, z) => Array.from({ length: W }, (_, x) => map.building[map.idx(bld.x0 + x, bld.z0 + z)] === bld.id));
  const rects = [];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (!mask[z][x]) continue;
    let w = 0; while (x + w < W && mask[z][x + w]) w++;
    let h = 1;
    outer: while (z + h < H) { for (let k = 0; k < w; k++) if (!mask[z + h][x + k]) break outer; h++; }
    for (let dz = 0; dz < h; dz++) for (let k = 0; k < w; k++) mask[z + dz][x + k] = false;
    rects.push({ x0: bld.x0 + x, z0: bld.z0 + z, x1: bld.x0 + x + w - 1, z1: bld.z0 + z + h - 1 });
  }
  return rects;
}
