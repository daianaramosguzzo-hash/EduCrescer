// Mapa do jogo: pisos, estruturas, prédios, cômodos, portas, objetos e itens no chão.
import { S, STRUCT_INFO, PROPS, FLOORS } from './tiles.js';

export class GameMap {
  constructor(W, H) {
    this.W = W; this.H = H;
    const N = W * H;
    this.floor = new Uint8Array(N);
    this.struct = new Uint8Array(N);
    this.building = new Int16Array(N).fill(-1);
    this.room = new Int16Array(N).fill(-1);
    this.propAt = new Int32Array(N).fill(-1);
    this.explored = new Uint8Array(N);
    this.lit = new Float32Array(N);         // luz fixa (postes, fogo), 0..1
    this.doors = new Map();                 // idx → porta
    this.windows = new Map();               // idx → janela
    this.props = [];
    this.buildings = [];
    this.rooms = [];
    this.lights = [];
    this.decals = [];
    this.labels = [];                       // nomes de ruas e lugares no mapa
    this.marks = {};                        // pontos nomeados (spawns, NPCs, missões)
    this.piles = new Map();                 // idx → [{id, n}]
    this.fire = new Map();                  // idx → turnos restantes
    this.gas = new Map();                   // idx → turnos (gás tóxico)
    this.blood = [];                        // manchas de sangue (efeito visual)
    this.version = 0;                       // muda quando algo que afeta a visão/passagem muda
  }
  idx(x, z) { return z * this.W + x; }
  inb(x, z) { return x >= 0 && z >= 0 && x < this.W && z < this.H; }

  structAt(x, z) { return this.inb(x, z) ? this.struct[this.idx(x, z)] : S.ROCK; }
  door(x, z) { return this.doors.get(this.idx(x, z)); }
  prop(x, z) { if (!this.inb(x, z)) return null; const p = this.propAt[this.idx(x, z)]; return p >= 0 ? this.props[p] : null; }

  // bloqueia a passagem (sem contar unidades)
  blocked(x, z) {
    if (!this.inb(x, z)) return true;
    const i = this.idx(x, z);
    const s = this.struct[i];
    if (s === S.DOOR || s === S.GATE) {
      const d = this.doors.get(i);
      return !d || !d.open || d.barricade > 0;
    }
    if (s === S.WINDOW) return true;
    if (s && STRUCT_INFO[s]?.blocks) return true;
    const p = this.propAt[i];
    if (p >= 0 && this.props[p].blocks) return true;
    return false;
  }
  // bloqueia a visão
  opaque(x, z) {
    if (!this.inb(x, z)) return true;
    const i = this.idx(x, z);
    const s = this.struct[i];
    if (s === S.DOOR || s === S.GATE) {
      const d = this.doors.get(i);
      if (s === S.GATE) return false;
      return !d || !d.open || d.barricade > 1;
    }
    if (s === S.WINDOW) { const w = this.windows.get(i); return !!(w && w.barricade > 1); }
    if (s && STRUCT_INFO[s]?.opaque) return true;
    const p = this.propAt[i];
    if (p >= 0 && this.props[p].opaque) return true;
    return false;
  }
  // cobertura (0 nenhuma, 1 meia, 2 total) oferecida pela célula
  cover(x, z) {
    if (!this.inb(x, z)) return 2;
    const i = this.idx(x, z);
    const s = this.struct[i];
    if (s === S.DOOR || s === S.GATE) { const d = this.doors.get(i); return d && d.open ? 0 : 2; }
    if (s) return STRUCT_INFO[s]?.cover || 0;
    const p = this.propAt[i];
    return p >= 0 ? this.props[p].cover || 0 : 0;
  }
  indoor(x, z) { return this.inb(x, z) && this.building[this.idx(x, z)] >= 0 && this.struct[this.idx(x, z)] === 0; }
  buildingAt(x, z) { if (!this.inb(x, z)) return null; const b = this.building[this.idx(x, z)]; return b >= 0 ? this.buildings[b] : null; }
  roomAt(x, z) { if (!this.inb(x, z)) return null; const r = this.room[this.idx(x, z)]; return r >= 0 ? this.rooms[r] : null; }
  floorName(x, z) { return FLOORS[this.floor[this.idx(x, z)]]?.nome || ''; }

  addProp(type, x, z, fw, fd, rot = 0, extra = {}) {
    const def = PROPS[type];
    if (!def) throw new Error('prop desconhecido: ' + type);
    const p = Object.assign({
      id: this.props.length, type, x, z, w: fw, d: fd, rot,
      nome: def.nome, blocks: !!def.blocks, opaque: !!def.opaque, cover: def.cover || 0,
      loot: null, searched: false, lootTable: def.loot || null,
    }, extra);
    this.props.push(p);
    for (let dz = 0; dz < fd; dz++) for (let dx = 0; dx < fw; dx++) {
      if (this.inb(x + dx, z + dz)) this.propAt[this.idx(x + dx, z + dz)] = p.id;
    }
    return p;
  }
  removeProp(p) {
    for (let dz = 0; dz < p.d; dz++) for (let dx = 0; dx < p.w; dx++) {
      const i = this.idx(p.x + dx, p.z + dz);
      if (this.propAt[i] === p.id) this.propAt[i] = -1;
    }
    p.removed = true;
    this.version++;
  }
  // células livres de um objeto (para interagir: fica ao lado)
  propCells(p) {
    const out = [];
    for (let dz = 0; dz < p.d; dz++) for (let dx = 0; dx < p.w; dx++) out.push([p.x + dx, p.z + dz]);
    return out;
  }

  // itens no chão
  addPile(x, z, id, n = 1) {
    const i = this.idx(x, z);
    let pile = this.piles.get(i);
    if (!pile) { pile = []; this.piles.set(i, pile); }
    const e = pile.find(e => e.id === id);
    if (e) e.n += n; else pile.push({ id, n });
    this.version++;
  }
  pileAt(x, z) { return this.piles.get(this.idx(x, z)) || null; }
}
