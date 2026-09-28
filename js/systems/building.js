// Construção da base: escolher → prévia → posicionar → confirmar → gastar
// materiais → construir. Grade de 2 m no terreno da base. Paredes ficam nas
// bordas das células; pisos e móveis, dentro delas.
import * as THREE from '../../lib/three.module.min.js';
import { clamp, dist, R, bus } from '../core/util.js';
import { sfx } from '../core/audio.js';
import * as T from '../core/textures.js';
import { STRUCTURES, structTier } from '../data/recipes.js';
import { BASE, inBase } from '../data/regions.js';
import { item } from '../data/items.js';
import { SKILLS } from '../data/skills.js';
import { addToSlots } from './state.js';

const G2 = BASE.grid;
const NX = Math.round((BASE.x1 - BASE.x0) / G2), NZ = Math.round((BASE.z1 - BASE.z0) / G2);

let MAT = null;
function mats() {
  if (MAT) return MAT;
  const m = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  MAT = {
    wood: m({ map: T.woodTex(), color: '#b08a60' }), woodDark: m({ map: T.woodTex(), color: '#7a5a3a' }),
    plank: m({ map: T.woodTex(), color: '#c8a070' }), metal: m({ map: T.metalTex(), color: '#8a9096', metalness: 0.4, roughness: 0.5 }),
    rust: m({ map: T.metalTex(), color: '#8a6a5a', metalness: 0.3 }), stone: m({ map: T.concreteTex(), color: '#9a948a' }),
    stoneDark: m({ map: T.concreteTex(), color: '#6a6660' }), cloth: m({ color: '#c8b890' }), tarp: m({ color: '#3a5a7a', side: THREE.DoubleSide }),
    red: m({ color: '#b83a2a' }), white: m({ color: '#e8e8e4' }), black: m({ color: '#2a2a2a' }), rope: m({ color: '#b8a070' }),
    glow: new THREE.MeshBasicMaterial({ color: '#ff7a20' }), water: m({ color: '#4a7a9a', roughness: 0.1 }),
    ghostOk: new THREE.MeshBasicMaterial({ color: '#5cff7a', transparent: true, opacity: 0.4, depthWrite: false }),
    ghostBad: new THREE.MeshBasicMaterial({ color: '#ff4a3a', transparent: true, opacity: 0.4, depthWrite: false }),
  };
  return MAT;
}
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
const cyl = (r1, r2, h, mat, x = 0, y = 0, z = 0, seg = 8) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat); o.position.set(x, y, z); o.castShadow = true; return o; };

// modelos das construções (no espaço local: parede ao longo de X)
function makeMesh(type, tier = 0, S = null) {
  const M = mats(), g = new THREE.Group();
  const H = 2.3;
  switch (type) {
    case 'piso':
      g.add(box(2, 0.1, 2, tier ? M.stone : M.plank, 0, 0.05, 0));
      if (!tier) for (let i = -0.75; i <= 0.76; i += 0.5) g.add(box(0.02, 0.105, 2, M.woodDark, i, 0.05, 0));
      g.children.forEach(c => { c.castShadow = false; });
      break;
    case 'parede': {
      if (tier === 0) { for (let i = 0; i < 5; i++) g.add(box(0.38, H, 0.14, M.wood, -0.8 + i * 0.4, H / 2, 0)); for (const y of [0.5, 1.8]) g.add(box(2, 0.14, 0.1, M.woodDark, 0, y, 0.12)); }
      else if (tier === 1) { g.add(box(2, H, 0.18, M.wood, 0, H / 2, 0)); for (const y of [0.4, 1.15, 1.9]) g.add(box(2.02, 0.12, 0.22, M.rust, 0, y, 0)); }
      else if (tier === 2) { for (let row = 0; row < 5; row++) for (let c = 0; c < 3; c++) g.add(box(0.64, 0.44, 0.3, row % 2 ? M.stone : M.stoneDark, -0.66 + c * 0.66 + (row % 2) * 0.1 - 0.05, 0.23 + row * 0.46, 0)); }
      else { g.add(box(2, H, 0.24, M.metal, 0, H / 2, 0)); for (const x of [-0.95, 0.95]) g.add(box(0.12, H, 0.3, M.black, x, H / 2, 0)); g.add(box(2, 0.15, 0.3, M.black, 0, H - 0.08, 0)); }
      break;
    }
    case 'porta': {
      for (const x of [-0.95, 0.95]) g.add(box(0.14, H, 0.2, M.woodDark, x, H / 2, 0));
      g.add(box(2, 0.2, 0.2, M.woodDark, 0, H - 0.1, 0));
      const leaf = new THREE.Group(); leaf.position.set(-0.85, 0, 0);
      leaf.add(box(1.7, H - 0.25, 0.08, M.plank, 0.85, (H - 0.25) / 2, 0));
      for (const y of [0.4, 1.6]) leaf.add(box(1.7, 0.12, 0.1, M.woodDark, 0.85, y, 0.02));
      leaf.add(box(0.1, 0.1, 0.12, M.metal, 1.5, 1.05, 0.06));
      leaf.name = 'leaf'; g.add(leaf);
      break;
    }
    case 'janela':
      g.add(box(2, 0.9, 0.18, M.wood, 0, 0.45, 0)); g.add(box(2, 0.5, 0.18, M.wood, 0, H - 0.25, 0));
      for (const x of [-0.9, 0.9]) g.add(box(0.2, 0.9, 0.18, M.woodDark, x, 1.35, 0));
      for (let i = -0.5; i <= 0.51; i += 0.25) g.add(box(0.04, 0.9, 0.04, M.metal, i, 1.35, 0));
      break;
    case 'cerca':
      for (let i = 0; i < 6; i++) { const x = -0.85 + i * 0.34; g.add(cyl(0.07, 0.08, 1.2, M.wood, x, 0.6, 0, 6)); const c = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), M.wood); c.position.set(x, 1.3, 0); g.add(c); }
      g.add(box(2, 0.08, 0.06, M.woodDark, 0, 0.8, 0.08));
      break;
    case 'bau':
      g.add(box(1.1, 0.55, 0.65, M.wood, 0, 0.28, 0)); g.add(box(1.14, 0.14, 0.69, M.woodDark, 0, 0.62, 0));
      for (const x of [-0.53, 0.53]) g.add(box(0.06, 0.7, 0.7, M.metal, x, 0.35, 0));
      g.add(box(0.12, 0.14, 0.04, M.metal, 0, 0.5, 0.34));
      break;
    case 'armazem':
      g.add(box(1.3, 1.9, 0.7, M.metal, 0, 0.95, 0));
      g.add(box(0.02, 1.8, 0.02, M.black, 0, 0.95, 0.36));
      for (const x of [-0.08, 0.08]) g.add(box(0.04, 0.2, 0.04, M.black, x, 1.0, 0.37));
      break;
    case 'fogueira':
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), M.stone); s.position.set(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55); s.castShadow = true; g.add(s); }
      for (let i = 0; i < 4; i++) { const l = cyl(0.07, 0.07, 0.8, M.woodDark, 0, 0.18, 0, 6); l.rotation.z = Math.PI / 2 - 0.4; l.rotation.y = i * Math.PI / 2; g.add(l); }
      g.add(box(0.3, 0.1, 0.3, M.glow, 0, 0.12, 0));
      break;
    case 'bancada':
      g.add(box(1.8, 0.1, 0.9, M.plank, 0, 0.85, 0));
      for (const [x, z] of [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]]) g.add(box(0.1, 0.85, 0.1, M.woodDark, x, 0.42, z));
      g.add(box(1.7, 0.06, 0.8, M.woodDark, 0, 0.3, 0));
      g.add(box(0.25, 0.2, 0.2, M.metal, -0.6, 1.0, 0.2)); g.add(box(0.5, 0.03, 0.12, M.metal, 0.4, 0.92, 0.1));
      g.add(cyl(0.02, 0.02, 0.3, M.wood, 0.1, 0.93, -0.2)).rotation.z = Math.PI / 2;
      break;
    case 'fornalha':
      g.add(box(1.3, 1.1, 1.2, M.stoneDark, 0, 0.55, 0));
      g.add(box(1.1, 0.4, 1.0, M.stone, 0, 1.3, 0));
      g.add(cyl(0.18, 0.2, 1.2, M.stoneDark, 0.3, 2.0, -0.2));
      g.add(box(0.5, 0.4, 0.05, M.glow, 0, 0.45, 0.61));
      break;
    case 'cama':
      g.add(box(1.1, 0.3, 2.1, M.woodDark, 0, 0.2, 0)); g.add(box(1.0, 0.18, 1.95, M.white, 0, 0.42, 0));
      g.add(box(1.02, 0.12, 1.1, M.red, 0, 0.55, 0.35)); g.add(box(0.6, 0.12, 0.35, M.white, 0, 0.56, -0.7));
      break;
    case 'abrigo': {
      for (const x of [-1.6, 0, 1.6]) { g.add(cyl(0.06, 0.07, 2.2, M.wood, x, 1.1, -1.1, 6)); g.add(cyl(0.05, 0.05, 0.6, M.wood, x, 0.3, 1.2, 6)); }
      const tarp = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), M.tarp); tarp.rotation.x = -Math.PI / 2 + 0.58; tarp.position.set(0, 1.4, 0.05); tarp.castShadow = true; g.add(tarp);
      g.add(box(1.0, 0.08, 2.0, M.cloth, -0.6, 0.05, -0.1)); g.add(box(0.5, 0.1, 0.3, M.red, -0.6, 0.12, -0.8));
      for (let i = 0; i < 6; i++) g.add(cyl(0.05, 0.06, 1.5, M.woodDark, 0.8 + (i % 3) * 0.12, 0.08 + Math.floor(i / 3) * 0.1, -0.2, 5)).rotation.x = Math.PI / 2;
      break;
    }
    case 'oficina':
      g.add(box(3.6, 0.12, 1.0, M.plank, 0, 0.9, 0));
      for (const [x, z] of [[-1.7, -0.4], [1.7, -0.4], [-1.7, 0.4], [1.7, 0.4]]) g.add(box(0.12, 0.9, 0.12, M.metal, x, 0.45, z));
      g.add(box(3.5, 1.4, 0.08, M.woodDark, 0, 1.6, -0.48));
      g.add(box(0.5, 0.3, 0.3, M.black, 1.2, 1.1, 0)); g.add(box(0.3, 0.2, 0.2, M.metal, -1.0, 1.05, 0.2));
      for (let i = 0; i < 5; i++) g.add(box(0.05, 0.4, 0.05, M.metal, -1.4 + i * 0.25, 1.8, -0.42));
      break;
    case 'medica':
      g.add(box(1.0, 0.1, 2.0, M.white, -0.9, 0.7, 0)); for (const [x, z] of [[-1.35, -0.9], [-0.45, -0.9], [-1.35, 0.9], [-0.45, 0.9]]) g.add(box(0.06, 0.7, 0.06, M.metal, x, 0.35, z));
      g.add(box(1.0, 1.6, 0.6, M.white, 1.0, 0.8, 0)); g.add(box(0.4, 0.12, 0.02, M.red, 1.0, 1.2, 0.31)); g.add(box(0.12, 0.4, 0.02, M.red, 1.0, 1.2, 0.31));
      break;
    case 'coletor':
      g.add(cyl(0.4, 0.4, 0.9, M.water, 0, 0.45, 0, 12)); g.add(cyl(0.42, 0.42, 0.9, M.rust, 0, 0.45, 0, 12)).material = M.metal;
      { const c = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.5, 12, 1, true), M.tarp); c.rotation.x = Math.PI; c.position.y = 1.2; g.add(c); }
      for (const a of [0, 2.1, 4.2]) g.add(cyl(0.03, 0.03, 1.4, M.wood, Math.cos(a) * 0.7, 0.7, Math.sin(a) * 0.7, 5));
      break;
  }
  return g;
}

export class Building {
  constructor(G) {
    this.G = G;
    this.group = new THREE.Group(); G.renderer.scene.add(this.group);
    this.recs = new Map(); // id -> { s, mesh, col, obj, light }
    this.mode = null;
    this.occ = new Map();
  }
  def(s) { return STRUCTURES[s.type]; }
  cellCenter(i, j) { return [BASE.x0 + (i + 0.5) * G2, BASE.z0 + (j + 0.5) * G2]; }
  // chaves de ocupação
  keys(type, i, j, rot) {
    const D = STRUCTURES[type];
    if (D.kind === 'floor') return ['f:' + i + ':' + j];
    if (D.kind === 'wall') return [(rot % 2 ? 'v:' : 'h:') + i + ':' + j];
    const [w, d] = rot % 2 ? [D.size[1], D.size[0]] : D.size;
    const out = [];
    for (let a = 0; a < w; a++) for (let b = 0; b < d; b++) out.push('o:' + (i + a) + ':' + (j + b));
    return out;
  }
  // posição no mundo do centro da construção
  worldPos(type, i, j, rot) {
    const D = STRUCTURES[type];
    if (D.kind === 'wall') return rot % 2 ? [BASE.x0 + i * G2, BASE.z0 + (j + 0.5) * G2] : [BASE.x0 + (i + 0.5) * G2, BASE.z0 + j * G2];
    const [w, d] = rot % 2 ? [D.size[1], D.size[0]] : D.size;
    return [BASE.x0 + (i + w / 2) * G2, BASE.z0 + (j + d / 2) * G2];
  }
  snap(type, px, pz, rot) {
    const D = STRUCTURES[type];
    const fx = (px - BASE.x0) / G2, fz = (pz - BASE.z0) / G2;
    if (D.kind === 'wall') return rot % 2 ? [Math.round(fx), Math.floor(fz)] : [Math.floor(fx), Math.round(fz)];
    const [w, d] = rot % 2 ? [D.size[1], D.size[0]] : D.size;
    return [Math.floor(fx - (w - 1) / 2), Math.floor(fz - (d - 1) / 2)];
  }
  inGrid(type, i, j, rot) {
    const D = STRUCTURES[type];
    if (D.kind === 'wall') return rot % 2 ? (i >= 0 && i <= NX && j >= 0 && j < NZ) : (i >= 0 && i < NX && j >= 0 && j <= NZ);
    const [w, d] = rot % 2 ? [D.size[1], D.size[0]] : D.size;
    return i >= 0 && j >= 0 && i + w <= NX && j + d <= NZ;
  }
  collider(s) {
    const D = this.def(s);
    const [x, z] = [s.x, s.z];
    if (D.kind === 'floor') return null;
    if (D.kind === 'wall') {
      if (D.door && s.open) return null;
      const t = 0.16, h = G2 / 2;
      const b = s.rot % 2 ? { type: 'box', x0: x - t, x1: x + t, z0: z - h, z1: z + h } : { type: 'box', x0: x - h, x1: x + h, z0: z - t, z1: z + t };
      b.los = !(D.window || D.fence); b.low = !!D.fence;
      return b;
    }
    const [w, d] = s.rot % 2 ? [D.size[1], D.size[0]] : D.size;
    const m = 0.2;
    return { type: 'box', x0: x - w + m, x1: x + w - m, z0: z - d + m, z1: z + d - m, los: false, low: true };
  }

  // ---------------- colocar/tirar ----------------
  add(s, silent = false) {
    const G = this.G, D = this.def(s);
    const mesh = makeMesh(s.type, s.tier || 0, s);
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = -(s.rot || 0) * Math.PI / 2;
    this.group.add(mesh);
    const rec = { s, mesh };
    const c = this.collider(s);
    if (c) { c.struct = s; G.world.col.add(c); rec.col = c; }
    // interação (pisos não)
    if (D.kind !== 'floor') rec.obj = G.world.register({ kind: 'struct', x: s.x, z: s.z, r: D.kind === 'wall' ? 0.7 : 1.0 + (D.size[0] - 1) * 0.6, s });
    if (D.light) {
      const L = new THREE.PointLight('#ff9a40', 0, 9, 1.8); L.position.set(s.x, 1.2, s.z); G.renderer.scene.add(L); rec.light = L;
      rec.emit = G.fx.addEmitter(s.x, s.type === 'fornalha' ? 2.6 : 0.3, s.z, { fire: s.type === 'fogueira', rate: s.type === 'fogueira' ? 7 : 2, scale: s.type === 'fogueira' ? 1 : 0.8 });
    }
    if (D.door) this.applyDoor(rec);
    for (const k of this.keys(s.type, s.i, s.j, s.rot)) this.occ.set(k, s.id);
    this.recs.set(s.id, rec);
    if (!silent) {
      mesh.scale.setScalar(0.01); rec.grow = 0;
    }
    return rec;
  }
  remove(s) {
    const G = this.G, rec = this.recs.get(s.id);
    if (!rec) return;
    this.group.remove(rec.mesh);
    if (rec.col) G.world.col.remove(rec.col);
    if (rec.obj) G.world.unregister(rec.obj);
    if (rec.light) G.renderer.scene.remove(rec.light);
    if (rec.emit) rec.emit.on = false;
    for (const k of this.keys(s.type, s.i, s.j, s.rot)) this.occ.delete(k);
    this.recs.delete(s.id);
    const L = G.state.base.structures; const i = L.indexOf(s); if (i >= 0) L.splice(i, 1);
  }
  rebuild(s) { this.remove(s); this.G.state.base.structures.push(s); this.add(s, true); }
  loadAll() {
    for (const rec of [...this.recs.values()]) { this.group.remove(rec.mesh); if (rec.col) this.G.world.col.remove(rec.col); if (rec.obj) this.G.world.unregister(rec.obj); if (rec.light) this.G.renderer.scene.remove(rec.light); if (rec.emit) rec.emit.on = false; }
    this.recs.clear(); this.occ.clear();
    for (const s of this.G.state.base.structures) this.add(s, true);
  }
  applyDoor(rec) {
    const leaf = rec.mesh.getObjectByName('leaf');
    if (leaf) leaf.rotation.y = rec.s.open ? -Math.PI / 2 * 0.95 : 0;
    if (rec.col) { this.G.world.col.remove(rec.col); rec.col = null; }
    const c = this.collider(rec.s);
    if (c) { c.struct = rec.s; this.G.world.col.add(c); rec.col = c; }
  }

  // ---------------- modo construção ----------------
  enter(type) {
    const G = this.G;
    if (!inBase(G.player.x, G.player.z, 6)) { G.ui.toast('Só dá para construir no terreno da base.', 'bad'); sfx('denied'); return; }
    this.exit();
    const tier = 0;
    this.mode = { type, rot: 0, tier, valid: false, i: 0, j: 0 };
    const ghost = makeMesh(type, tier);
    ghost.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    this.mode.ghost = ghost;
    G.renderer.scene.add(ghost);
    // grade visível
    const pts = [];
    for (let i = 0; i <= NX; i++) pts.push(BASE.x0 + i * G2, 0.06, BASE.z0, BASE.x0 + i * G2, 0.06, BASE.z1);
    for (let j = 0; j <= NZ; j++) pts.push(BASE.x0, 0.06, BASE.z0 + j * G2, BASE.x1, 0.06, BASE.z0 + j * G2);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: '#f0e0a0', transparent: true, opacity: 0.22 }));
    G.renderer.scene.add(this.grid);
    G.ui.buildBar(type);
    G.renderer.cam.tzoom = 1.25;
  }
  exit() {
    const G = this.G;
    if (!this.mode) return;
    G.renderer.scene.remove(this.mode.ghost);
    if (this.grid) { G.renderer.scene.remove(this.grid); this.grid = null; }
    this.mode = null;
    G.ui.buildBar(null);
    G.renderer.cam.tzoom = G.settings.zoom || 1;
  }
  rotate() { if (this.mode) { this.mode.rot = (this.mode.rot + 1) % 4; sfx('ui'); } }
  cost(type, tier = 0) {
    const t = structTier(type, tier);
    return t.cost;
  }
  validate() {
    const G = this.G, m = this.mode, D = STRUCTURES[m.type];
    const t = structTier(m.type, 0);
    if (G.player.ch.level < t.level) return `Precisa do nível ${t.level}.`;
    if (!this.inGrid(m.type, m.i, m.j, m.rot)) return 'Fora do terreno da base.';
    for (const k of this.keys(m.type, m.i, m.j, m.rot)) if (this.occ.has(k)) return 'Já tem algo aqui.';
    const [x, z] = this.worldPos(m.type, m.i, m.j, m.rot);
    if (D.kind !== 'floor') {
      const c = this.collider({ type: m.type, x, z, rot: m.rot, open: false });
      const pad = 0.05;
      let blocked = false;
      G.world.col.query(c.x0, c.z0, c.x1, c.z1, s => {
        if (s.struct) return;
        const hit = s.type === 'box' ? (c.x0 < s.x1 - pad && c.x1 > s.x0 + pad && c.z0 < s.z1 - pad && c.z1 > s.z0 + pad)
          : (Math.max(c.x0, Math.min(s.x, c.x1)) - s.x) ** 2 + (Math.max(c.z0, Math.min(s.z, c.z1)) - s.z) ** 2 < (s.r - pad) ** 2;
        if (hit) { blocked = true; return false; }
      });
      if (blocked) return 'Tem um obstáculo no caminho.';
      const p = G.player;
      if (p.x + p.r > c.x0 && p.x - p.r < c.x1 && p.z + p.r > c.z0 && p.z - p.r < c.z1) return 'Saia de cima do lugar.';
    }
    if (!G.crafting.hasAll(t.cost)) return 'Faltam materiais.';
    return null;
  }
  updateMode(dt, pointer) {
    const G = this.G, m = this.mode;
    if (!m) return;
    const p = G.player;
    const D = STRUCTURES[m.type];
    const reach = 1.4 + (D.kind === 'object' ? Math.max(D.size[0], D.size[1]) * G2 / 2 : 0.6);
    let px = p.x + Math.sin(p.rot) * reach, pz = p.z + Math.cos(p.rot) * reach;
    if (pointer) { px = pointer.x; pz = pointer.z; }
    const [i, j] = this.snap(m.type, px, pz, m.rot);
    m.i = i; m.j = j;
    const [x, z] = this.worldPos(m.type, i, j, m.rot);
    m.ghost.position.set(x, 0.02, z);
    m.ghost.rotation.y = -m.rot * Math.PI / 2;
    const err = this.validate();
    m.err = err;
    const ok = !err;
    if (ok !== m.valid || !m.painted) {
      m.valid = ok; m.painted = true;
      const M = mats();
      m.ghost.traverse(o => { if (o.isMesh) o.material = ok ? M.ghostOk : M.ghostBad; });
    }
    G.ui.buildStatus(err);
  }
  confirm() {
    const G = this.G, m = this.mode;
    if (!m) return;
    const err = this.validate();
    if (err) { G.ui.toast(err, 'bad'); sfx('denied'); return; }
    const t = structTier(m.type, 0);
    const saved = G.crafting.pay(t.cost);
    const [x, z] = this.worldPos(m.type, m.i, m.j, m.rot);
    const D = STRUCTURES[m.type];
    const ch = G.player.ch;
    const hpMul = 1 + (ch.skills.construtor || 0) * SKILLS.construtor.build;
    const s = { id: 's' + (G.state.base.next++), type: m.type, tier: 0, i: m.i, j: m.j, rot: m.rot, x, z, hp: Math.round(t.hp * hpMul), maxHp: Math.round(t.hp * hpMul) };
    if (D.storage) s.items = new Array(D.storage).fill(null);
    if (D.door) s.open = false;
    if (D.collector) s.water = 0;
    G.state.base.structures.push(s);
    this.add(s);
    G.player.model.anim.play('build');
    sfx('build', { x, z });
    G.fx.burst(x, 0.3, z, 'dust', 14, 0.8);
    G.addXp(8);
    G.state.stats.built++;
    G.noise(x, z, 12);
    bus.emit('build', { type: m.type });
    if (saved.length) G.ui.toast('Economizou material: ' + saved.join(', '), 'info');
    if (D.bed) { G.state.base.spawn = s.id; }
    G.ui.refresh();
    G.requestSave();
    // continua no modo construção se ainda der
    if (!G.crafting.hasAll(t.cost)) this.exit();
  }

  // ---------------- interação ----------------
  label(o) {
    const s = o.s, D = this.def(s), t = structTier(s.type, s.tier || 0);
    if (D.storage) return { verb: 'ABRIR', name: D.name, icon: '📦' };
    if (D.station) return { verb: 'USAR', name: D.name, icon: '🛠️' };
    if (D.bed) return { verb: 'DESCANSAR', name: D.name, icon: '🛏️' };
    if (D.door) return { verb: s.open ? 'FECHAR' : 'ABRIR', name: D.name, icon: '🚪' };
    if (D.collector) return { verb: 'COLETAR', name: `${D.name} (${Math.floor(s.water || 0)}/3)`, icon: '💧' };
    return { verb: 'MEXER', name: t.name + ` (${Math.ceil(s.hp)}/${s.maxHp})`, icon: '🔨' };
  }
  use(o, face) {
    const G = this.G, s = o.s, D = this.def(s), p = G.player;
    if (D.storage) { p.startAction('open', { anim: 'interact', face, onHit: () => { sfx('open', { x: s.x, z: s.z }); G.ui.openStorage(s); } }); return; }
    if (D.door) { p.startAction('door', { anim: 'interact', face, onHit: () => { s.open = !s.open; this.applyDoor(this.recs.get(s.id)); sfx('door', { x: s.x, z: s.z }); } }); return; }
    if (D.station) { G.ui.openMenu('crafting', { station: D.station }); return; }
    if (D.bed) return this.rest(s);
    if (D.collector) {
      const n = Math.floor(s.water || 0);
      if (!n) { G.ui.toast('O coletor ainda está vazio. A água junta com o tempo.', 'info'); return; }
      const left = G.giveItem('agua_limpa', n);
      s.water = left; sfx('drink'); return;
    }
    // paredes, janelas, cercas: melhorar ou desmontar
    const opts = [];
    if (D.tiers && (s.tier || 0) < D.tiers.length - 1) {
      const nt = structTier(s.type, (s.tier || 0) + 1);
      const costTxt = nt.cost.map(([id, n]) => `${item(id).icon}${n}`).join(' ');
      opts.push({ label: `⬆️ Melhorar para ${nt.name} (${costTxt})`, fn: () => this.upgrade(s) });
    }
    if (s.hp < s.maxHp) opts.push({ label: `🔧 Consertar (${item('madeira').icon}2)`, fn: () => { if (!G.crafting.hasAll([['madeira', 2]])) { G.ui.toast('Faltam materiais.', 'bad'); return; } G.crafting.pay([['madeira', 2]], false); s.hp = s.maxHp; sfx('build', { x: s.x, z: s.z }); } });
    opts.push({ label: '🪓 Desmontar (devolve metade)', fn: () => this.demolish(s) });
    G.ui.choice(structTier(s.type, s.tier || 0).name, opts);
  }
  upgrade(s) {
    const G = this.G, D = this.def(s);
    const nt = structTier(s.type, (s.tier || 0) + 1);
    if (G.player.ch.level < nt.level) { G.ui.toast(`Precisa do nível ${nt.level}.`, 'bad'); sfx('denied'); return; }
    if (!G.crafting.hasAll(nt.cost)) { G.ui.toast('Faltam materiais.', 'bad'); sfx('denied'); return; }
    G.crafting.pay(nt.cost);
    s.tier = (s.tier || 0) + 1;
    const hpMul = 1 + (G.player.ch.skills.construtor || 0) * SKILLS.construtor.build;
    s.maxHp = Math.round(nt.hp * hpMul); s.hp = s.maxHp;
    this.rebuild(s);
    sfx('build', { x: s.x, z: s.z }); G.fx.burst(s.x, 1, s.z, 'dust', 12);
    G.addXp(10);
    bus.emit('build', { type: s.type, upgrade: true });
    G.ui.toast(`${nt.name} pronta!`, 'good');
  }
  demolish(s) {
    const G = this.G;
    const t = structTier(s.type, s.tier || 0);
    for (const [id, n] of t.cost) { const k = Math.floor(n / 2); if (k) G.giveItem(id, k, true); }
    if (s.items && s.items.some(Boolean)) G.dropBag(s.x, s.z, s.items.filter(Boolean), 'Itens do baú');
    this.remove(s);
    sfx('break', { x: s.x, z: s.z }); G.fx.burst(s.x, 0.5, s.z, 'wood', 14);
  }
  damageStruct(s, dmg) {
    const G = this.G, rec = this.recs.get(s.id);
    if (!rec) return;
    s.hp -= dmg;
    G.fx.burst(s.x, 1, s.z, s.tier >= 2 ? 'stone' : 'wood', 6);
    rec.shake = 0.3;
    if (s.hp <= 0) {
      G.ui.toast(`${structTier(s.type, s.tier || 0).name} foi destruída!`, 'bad');
      if (s.items && s.items.some(Boolean)) G.dropBag(s.x, s.z, s.items.filter(Boolean), 'Itens do baú');
      this.remove(s); sfx('break', { x: s.x, z: s.z });
    }
  }
  rest(s) {
    const G = this.G, ch = G.player.ch;
    G.state.base.spawn = s.id;
    const hour = (G.state.time / 60) % 24;
    const night = hour >= 19 || hour < 5;
    const danger = G.zombies.chasing > 0;
    if (danger) { G.ui.toast('Não dá para descansar com zumbis por perto!', 'bad'); return; }
    const opts = [];
    if (night) opts.push({ label: '🌙 Dormir até o amanhecer', fn: () => G.sleep(true) });
    opts.push({ label: '⏳ Descansar 1 hora', fn: () => G.sleep(false) });
    G.ui.choice(this.def(s).name + ' — ponto de renascimento salvo', opts);
  }
  // atualização (coletor, luzes, animação de crescer)
  update(dt) {
    const G = this.G;
    let lights = 0;
    const night = G.renderer.night;
    const recs = [...this.recs.values()].sort((a, b) => Math.hypot(a.s.x - G.player.x, a.s.z - G.player.z) - Math.hypot(b.s.x - G.player.x, b.s.z - G.player.z));
    for (const rec of recs) {
      if (rec.grow != null) { rec.grow = Math.min(1, rec.grow + dt * 4); const k = rec.grow; rec.mesh.scale.set(1, k * (2 - k), 1); rec.mesh.scale.x = rec.mesh.scale.z = 0.6 + 0.4 * k; if (k >= 1) { rec.grow = null; rec.mesh.scale.set(1, 1, 1); } }
      if (rec.shake > 0) { rec.shake -= dt; rec.mesh.position.x = rec.s.x + Math.sin(rec.shake * 60) * 0.03; if (rec.shake <= 0) rec.mesh.position.x = rec.s.x; }
      if (rec.light) {
        const on = lights < 3;
        rec.light.intensity = on ? (2 + night * 8) * (0.85 + Math.sin(G.clock * 13 + rec.s.x) * 0.1 + Math.sin(G.clock * 7.3) * 0.05) : 0;
        if (on) lights++;
      }
      if (rec.s.water != null) rec.s.water = Math.min(3, rec.s.water + dt / 90);
    }
  }
}
export { NX, NZ };
