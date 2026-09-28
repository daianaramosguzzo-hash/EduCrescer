// O mundo: monta o mapa de Aimorés (regiões, ruas, construções, mata, rio),
// registra tudo que pode ser coletado, vasculhado ou aberto, e cuida das
// partes que mudam (portas, árvores cortadas, telhados que somem ao entrar).
import * as THREE from '../../lib/three.module.min.js';
import { rng, clamp, dist2, bus } from '../core/util.js';
import { Collision, FlowField } from './collision.js';
import { Batch, boxGeo, cylGeo, materials } from './batch.js';
import { Splat, makeGround, makeWater, heightAt, isWater, isDeepWater, RIVER_Z, POND, EXTENT } from './terrain.js';
import * as P from './props.js';
import { building, F } from './buildings.js';
import * as T from '../core/textures.js';
import { REGIONS, regionAt, BASE, WORLD_HALF, START_POS, inBase } from '../data/regions.js';
import { NODES, CONTAINERS } from '../data/loot.js';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group(); scene.add(this.root);
    this.staticGroup = new THREE.Group(); this.root.add(this.staticGroup);
    this.dynGroup = new THREE.Group(); this.root.add(this.dynGroup);
    this.col = new Collision();
    this.flow = new FlowField(this.col, 34);
    this.batch = new Batch(55);
    this.rnd = rng(20260928);
    this.buildings = [];
    this.nodes = []; this.containers = []; this.doors = []; this.pickups = [];
    this.pois = {}; this.spawns = {}; this.fixedSpawns = [];
    this.interactGrid = new Map();
    this.barriers = {};
    this.lockedRegions = new Set();
    this.shaking = [];
    this.nextId = 1;
    this.fires = [];
    this.lights = [];
  }

  // ---------------- registro de interativos ----------------
  gridKey(x, z) { return (Math.floor(x / 8) * 4099) ^ Math.floor(z / 8); }
  register(o) {
    o.id = o.id || 'o' + (this.nextId++);
    const k = this.gridKey(o.x, o.z);
    let a = this.interactGrid.get(k); if (!a) this.interactGrid.set(k, a = []);
    a.push(o); o._k = k;
    return o;
  }
  unregister(o) { const a = this.interactGrid.get(o._k); if (a) { const i = a.indexOf(o); if (i >= 0) a.splice(i, 1); } }
  nearby(x, z, r, fn) {
    for (let gx = Math.floor((x - r) / 8); gx <= Math.floor((x + r) / 8); gx++)
      for (let gz = Math.floor((z - r) / 8); gz <= Math.floor((z + r) / 8); gz++) {
        const a = this.interactGrid.get((gx * 4099) ^ gz);
        if (a) for (const o of a) if (dist2(x, z, o.x, o.z) < (r + (o.r || 0)) ** 2) fn(o);
      }
  }
  addContainer(type, x, z, { ry = 0, r = 1.0, name = null } = {}) {
    const def = CONTAINERS[type];
    return this.containers[this.containers.push(this.register({ kind: 'container', type, x, z, r, ry, name: name || def.name, items: null, respawnAt: 0 })) - 1];
  }
  addNode(type, x, z, handle, r = 0.9, extra = {}) {
    const def = NODES[type];
    const n = this.register({ kind: 'node', type, x, z, r, handle, hits: def.hits || 1, depletedUntil: 0, ...extra });
    this.nodes.push(n);
    return n;
  }
  addPickup(item, x, z, n = 1) {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.26), new THREE.MeshStandardMaterial({ color: '#efe6c8', emissive: '#6a5a20', emissiveIntensity: 0.5 }));
    paper.position.y = 0.9; paper.rotation.y = 0.4;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glowTex(), color: '#ffd76a', transparent: true, depthWrite: false, opacity: 0.8 }));
    glow.scale.setScalar(1.2); glow.position.y = 1.0;
    g.add(paper, glow); g.position.set(x, heightAt(x, z), z);
    this.dynGroup.add(g);
    const p = this.register({ kind: 'pickup', item, n, x, z, r: 0.9, mesh: g, taken: false });
    this.pickups.push(p);
    return p;
  }
  addPOI(id, x, z, r, name) { this.pois[id] = { id, x, z, r, name }; }
  addDoor(x, z, side, w, open) {
    const along = side === 'n' || side === 's' ? 'x' : 'z';
    const ry0 = along === 'x' ? 0 : -Math.PI / 2;
    const i = this.doorPool.add(x, 0, z, { ry: ry0, color: this.rnd.pick(['#8a5a3a', '#5a3a2a', '#3a5a6a', '#7a2a2a', '#d8d0c0']) });
    const L = w;
    const cx = along === 'x' ? x + L / 2 : x, cz = along === 'x' ? z : z + L / 2;
    const box = along === 'x' ? { type: 'box', x0: x, x1: x + L, z0: z - 0.12, z1: z + 0.12 } : { type: 'box', x0: x - 0.12, x1: x + 0.12, z0: z, z1: z + L };
    const d = this.register({ kind: 'door', x: cx, z: cz, r: 0.9, hx: x, hz: z, along, ry0, open: false, i, box, w: L, side });
    this.doors.push(d);
    this.setDoor(d, open, true);
    return d;
  }
  setDoor(d, open, silent = false) {
    d.open = open;
    this.doorPool.set(d.i, { ry: d.ry0 + (open ? (d.side === 's' || d.side === 'w' ? -1 : 1) * Math.PI / 2 * 0.95 : 0) });
    if (open) this.col.remove(d.box); else if (!d.box._cells) this.col.add(d.box);
  }
  decal(type, x, z, size) {
    const g = new THREE.PlaneGeometry(size, size); g.rotateX(-Math.PI / 2);
    this.batch.add(g, type, { x, y: heightAt(x, z) + 0.03, z, ry: this.rnd() * 6.28, shadow: false });
  }

  groundAt(x, z) {
    if (!this.splatData) return 'grass';
    const S = this.splat.size, k = S / (EXTENT * 2);
    const px = clamp(Math.floor((x + EXTENT) * k), 0, S - 1), pz = clamp(Math.floor((z + EXTENT) * k), 0, S - 1);
    const i = (pz * S + px) * 4, d = this.splatData;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (b > 128) return 'road';
    if (g > 128) return 'dirt';
    if (r > 128) return 'grass';
    return 'sand';
  }
  heightAt(x, z) { return heightAt(x, z); }
  isWater(x, z) { return isWater(x, z); }
  // perto de água para beber/encher?
  waterNear(x, z, r = 1.8) {
    for (let a = 0; a < 8; a++) if (isWater(x + Math.cos(a * 0.785) * r, z + Math.sin(a * 0.785) * r)) return true;
    return isWater(x, z);
  }

  // ------------------------------------------------------------------
  async build(progress = () => {}) {
    const W = this, r = this.rnd;
    const M = materials();
    // portas instanciadas
    const doorG = P.merged([
      [boxGeo(1.1, 2.3, 0.07, 1), '#ffffff', P.M4(0.55, 1.15, 0)],
      [new THREE.SphereGeometry(0.05, 6, 5), '#c8b870', P.M4(0.95, 1.1, 0.07)],
      [new THREE.SphereGeometry(0.05, 6, 5), '#c8b870', P.M4(0.95, 1.1, -0.07)],
    ]);
    this.doorPool = new P.Pool(doorG, new THREE.MeshStandardMaterial({ map: T.woodTex(), vertexColors: true, roughness: 0.8 }), 200);
    this.dynGroup.add(this.doorPool.mesh);
    this.trees = new P.Trees(this.dynGroup);
    this.nature = new P.Nature(this.dynGroup);
    // móveis desmontáveis (instanciados para poderem sumir)
    this.furnPool = new P.Pool(P.merged([
      [boxGeo(1.3, 0.06, 0.8, 1), '#8a6a44', P.M4(0, 0.76, 0)],
      [boxGeo(0.06, 0.76, 0.06), '#6a4a2a', P.M4(-0.58, 0.38, -0.33)], [boxGeo(0.06, 0.76, 0.06), '#6a4a2a', P.M4(0.58, 0.38, -0.33)],
      [boxGeo(0.06, 0.76, 0.06), '#6a4a2a', P.M4(-0.58, 0.38, 0.33)], [boxGeo(0.06, 0.76, 0.06), '#6a4a2a', P.M4(0.58, 0.38, 0.33)],
      [boxGeo(0.45, 0.05, 0.45), '#7a5a3a', P.M4(0, 0.46, 0.75)], [boxGeo(0.45, 0.5, 0.05), '#7a5a3a', P.M4(0, 0.72, 0.97)],
      [boxGeo(0.45, 0.05, 0.45), '#7a5a3a', P.M4(0.1, 0.02, -0.9, 0, 0.3, 1.4)],
    ]), new THREE.MeshStandardMaterial({ map: T.woodTex(), vertexColors: true, roughness: 0.85 }), 200);
    this.pewPool = new P.Pool(P.merged([
      [boxGeo(3.2, 0.08, 0.5, 1), '#7a5236', P.M4(0, 0.48, 0)], [boxGeo(3.2, 0.55, 0.06, 1), '#7a5236', P.M4(0, 0.8, -0.24)],
      [boxGeo(0.08, 0.48, 0.5), '#5a3a26', P.M4(-1.5, 0.24, 0)], [boxGeo(0.08, 0.48, 0.5), '#5a3a26', P.M4(1.5, 0.24, 0)],
    ]), new THREE.MeshStandardMaterial({ map: T.woodTex(), vertexColors: true, roughness: 0.85 }), 60);
    this.deskPool = new P.Pool(P.merged([
      [boxGeo(0.7, 0.05, 0.5), '#b89a70', P.M4(0, 0.72, 0)], [boxGeo(0.05, 0.72, 0.05), '#555', P.M4(-0.3, 0.36, -0.2)], [boxGeo(0.05, 0.72, 0.05), '#555', P.M4(0.3, 0.36, 0.2)],
      [boxGeo(0.05, 0.72, 0.05), '#555', P.M4(0.3, 0.36, -0.2)], [boxGeo(0.05, 0.72, 0.05), '#555', P.M4(-0.3, 0.36, 0.2)],
      [boxGeo(0.4, 0.04, 0.4), '#3a6a9a', P.M4(0, 0.44, 0.45)], [boxGeo(0.4, 0.4, 0.04), '#3a6a9a', P.M4(0, 0.66, 0.65)],
    ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), 80);
    // carcaças de carro desmontáveis
    this.wreckPool = new P.Pool(P.merged([
      [boxGeo(1.8, 0.6, 4.1, 1), '#6a5448', P.M4(0, 0.45, 0, 0, 0, 0.06)], [boxGeo(1.55, 0.5, 1.9, 1), '#5a4a40', P.M4(0, 0.98, -0.3, 0, 0, 0.06)],
      [boxGeo(1.7, 0.1, 1.2, 1), '#3a2e28', P.M4(0, 0.8, 1.4, -0.4, 0, 0)],
    ]), new THREE.MeshStandardMaterial({ map: T.metalTex(), vertexColors: true, roughness: 0.7, metalness: 0.3 }), 60);
    this.dynGroup.add(this.furnPool.mesh, this.pewPool.mesh, this.deskPool.mesh, this.wreckPool.mesh);

    const splat = this.splat = new Splat(1024);
    progress(0.1, 'Traçando as ruas...');
    await tick();
    this.layoutRoads(splat);
    progress(0.2, 'Levantando as casas de Aimorés...');
    await tick();
    this.buildBairro();
    this.buildCentro();
    progress(0.35, 'Montando o comércio...');
    await tick();
    this.buildAvenida();
    this.buildFerrovia();
    this.buildSaude();
    progress(0.5, 'Plantando a mata...');
    await tick();
    this.buildFazenda();
    this.buildPedreira();
    this.buildMata();
    this.buildRio();
    this.buildBase();
    progress(0.65, 'Espalhando a vegetação...');
    await tick();
    // chão
    const stex = splat.finish();
    this.splatData = splat.ctx.getImageData(0, 0, splat.size, splat.size).data;
    const ground = makeGround(stex);
    this.root.add(ground);
    this.water = makeWater(); this.root.add(this.water);
    this.scatterGrass();
    this.edgeForest();
    progress(0.8, 'Juntando tudo...');
    await tick();
    this.batch.build(this.staticGroup);
    this.trees.finish(); this.nature.finish(); this.doorPool.finish();
    for (const p of [this.furnPool, this.pewPool, this.deskPool, this.wreckPool]) p.finish();
    this.makeSpawns();
    // limites do mapa
    const E = WORLD_HALF;
    this.col.add({ type: 'box', x0: -E - 5, x1: -E, z0: -E - 5, z1: E + 5, noNav: true });
    this.col.add({ type: 'box', x0: E, x1: E + 5, z0: -E - 5, z1: E + 5, noNav: true });
    this.col.add({ type: 'box', x0: -E - 5, x1: E + 5, z0: -E - 5, z1: -E, noNav: true });
    this.col.add({ type: 'box', x0: -E - 5, x1: E + 5, z0: E - 3, z1: E + 5, noNav: true });
    // água funda bloqueia
    this.col.blockers.push((x, z, rr) => {
      if (isDeepWater(x, z)) {
        // volta na direção da margem mais próxima (norte para o rio; centro para a lagoa)
        const dp = Math.hypot(x - POND.x, z - POND.z);
        if (dp < POND.r + 4) { const k = (POND.r - 1.2) / dp; return { x: POND.x + (x - POND.x) * Math.max(k, 1), z: POND.z + (z - POND.z) * Math.max(k, 1) }; }
        let zz = z; while (isDeepWater(x, zz) && zz > RIVER_Z - 10) zz -= 0.1;
        return { x, z: zz };
      }
      return null;
    });
    // regiões trancadas (só o jogador é barrado)
    this.col.blockers.push((x, z, rr, ent) => {
      if (!ent || !ent.isPlayer) return null;
      for (const id of this.lockedRegions) {
        const R = REGIONS.find(q => q.id === id);
        const m = rr + 0.3;
        if (x > R.x0 - m && x < R.x1 + m && z > R.z0 - m && z < R.z1 + m) {
          const dl = x - (R.x0 - m), dr = (R.x1 + m) - x, dt = z - (R.z0 - m), db = (R.z1 + m) - z;
          const mn = Math.min(dl, dr, dt, db);
          bus.emit('lockedRegion', R);
          if (mn === dl) return { x: R.x0 - m, z }; if (mn === dr) return { x: R.x1 + m, z };
          if (mn === dt) return { x, z: R.z0 - m }; return { x, z: R.z1 + m };
        }
      }
      return null;
    });
    progress(1, 'Pronto');
  }

  // ------------------------------------------------------------------
  // Ruas (pintura + calçadas + faixas)
  layoutRoads(S) {
    const r = this.rnd, W = this;
    // variação natural do chão
    S.blotches(-165, -165, 165, 165, 'dirt', 900, 1, 5, 0.35, r);
    S.blotches(-165, -165, -55, -55, 'mud', 300, 2, 6, 0.4, r);
    // base: terra batida
    S.rect(BASE.x0 - 2, BASE.z0 - 2, BASE.x1 + 2, BASE.z1 + 2, 'dirt', 0.85);
    S.blotches(BASE.x0, BASE.z0, BASE.x1, BASE.z1, 'grass', 40, 1, 3, 0.5, r);
    // praia do rio
    S.rect(-170, RIVER_Z - 14, 170, 170, 'sand');
    S.blotches(-170, RIVER_Z - 20, 170, RIVER_Z - 12, 'sand', 200, 2, 5, 0.7, r);
    S.circle(POND.x, POND.z, POND.r + 4, 'mud', 0.9); S.circle(POND.x, POND.z, POND.r + 1, 'sand');
    // pedreira: cascalho
    S.rect(58, 58, 170, RIVER_Z - 10, 'dirt', 0.9);
    S.blotches(58, 58, 165, 120, 'sand', 150, 2, 7, 0.6, r);
    this.roads = [];
    const road = (x0, z0, x1, z1, w, walk = true) => {
      S.line([[x0, z0], [x1, z1]], w, 'road');
      this.roads.push({ x0, z0, x1, z1, w });
      const alongX = Math.abs(z1 - z0) < 0.1;
      // faixa central tracejada
      const L = Math.hypot(x1 - x0, z1 - z0);
      for (let t = 2; t < L - 2; t += 6) {
        const x = x0 + (x1 - x0) * t / L, z = z0 + (z1 - z0) * t / L;
        if (r() < 0.15) continue;
        this.batch.add(boxGeo(alongX ? 2.2 : 0.15, 0.02, alongX ? 0.15 : 2.2), 'plain', { x, y: 0.03, z, color: '#d8c86a', shadow: false });
      }
      if (walk) {
        // meio-fio e calçada
        for (const s of [-1, 1]) {
          const off = (w / 2 + 1.1) * s;
          if (alongX) {
            this.batch.add(boxGeo(L, 0.14, 2.2, 2), 'concrete', { x: (x0 + x1) / 2, y: 0.07, z: z0 + off, color: '#b8b2a6', shadow: false });
          } else {
            this.batch.add(boxGeo(2.2, 0.14, L, 2), 'concrete', { x: x0 + off, y: 0.07, z: (z0 + z1) / 2, color: '#b8b2a6', shadow: false });
          }
        }
      }
    };
    const dirt = (pts, w) => { S.line(pts, w, 'dirt'); S.line(pts, w * 0.5, 'dirt'); };
    // avenida principal (Av. Rio Doce)
    road(-116, 0, 168, 0, 9);
    // centro
    road(-28, -58, -28, 58, 7); road(28, -104, 28, 58, 7);
    road(-55, -40, 55, -40, 7); road(-55, 40, 55, 40, 7);
    road(0, 40, 0, 64, 7);
    // estradas de terra
    dirt([[-86, -60], [-86, 112]], 6);
    dirt([[-110, 30], [-60, 30]], 5);
    dirt([[-86, -60], [-95, -80], [-100, -95], [-106, -106]], 4);
    dirt([[100, -5], [100, -60], [102, -100], [104, -150]], 6);
    dirt([[102, -100], [80, -104], [70, -120]], 4);
    dirt([[120, 5], [120, 58], [118, 110]], 7);
    dirt([[-150, 8], [-150, 30], [-120, 60], [-100, 90], [-100, 114]], 3.5);
    // praça: terra clara com grama
    S.rect(-24, -36, 24, -4, 'dirt', 0.8);
    S.blotches(-22, -34, 22, -6, 'grass', 30, 2, 4, 0.8, r);
    // pátio da estação e do posto de saúde
    S.rect(-16, 56, 16, 66, 'road'); S.rect(-8, -104, 40, -96, 'road');
    S.rect(66, -26, 98, -6, 'road');
    S.rect(100, -30, 120, -6, 'road');
  }

  // ------------------------------------------------------------------
  house(x, z, door = 's', opts = {}) {
    const r = this.rnd;
    const w = opts.w || r.pick([8, 9, 10]), d = opts.d || r.pick([7, 8]);
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const colors = ['#e8d8a8', '#a8c8d8', '#e0b0a0', '#b8d0a0', '#e8e0d0', '#d8b8d0', '#f0c890', '#c8c0e0'];
    const bands = ['#7a5a4a', '#5a6a7a', '#8a4a3a', '#4a6a4a', '#6a6a6a'];
    const L = door === 'n' || door === 's' ? w : d;
    const dAt = L * (0.3 + r() * 0.2);
    // interior em coordenadas da casa: u atravessa a fachada, v vai da porta (0) ao fundo (1)
    const m = 0.85;
    const toW = (u, v) => {
      if (door === 's') return [x0 + m + u * (w - 2 * m), z1 - m - v * (d - 2 * m)];
      if (door === 'n') return [x0 + m + u * (w - 2 * m), z0 + m + v * (d - 2 * m)];
      if (door === 'e') return [x1 - m - v * (w - 2 * m), z0 + m + u * (d - 2 * m)];
      return [x0 + m + v * (w - 2 * m), z0 + m + u * (d - 2 * m)];
    };
    const face = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[door];
    const ud = dAt / L;
    const left = ud > 0.5; // móveis grandes do lado oposto à porta
    const U = k => left ? k : 1 - k;
    const partitions = [];
    if (L >= 9) {
      // divisória no fundo (quarto | cozinha), encostada na parede do fundo
      let [ax, az] = toW(U(0.55), 0.42), [bx, bz] = toW(U(0.55), 1.0);
      if (door === 's') bz = z0; else if (door === 'n') bz = z1; else if (door === 'e') bx = x0; else bx = x1;
      partitions.push([ax, az, bx, bz]);
    }
    const graffiti = [];
    if (r() < 0.22) graffiti.push({ side: door, at: L * 0.75, text: r.pick(['SOCORRO', 'NÃO ENTRE', 'ELES OUVEM', 'VAZIO', 'FAMÍLIA SILVA → RIO', 'VACINA = MORTE', '3 MORTOS DENTRO']), color: r.pick(['#b31d1d', '#1d1d1d', '#1d4ab3']) });
    const b = building(this, {
      x0, z0, x1, z1, h: 3, color: opts.color || r.pick(colors), band: r.pick(bands), roof: 'gable', roofColor: r.pick(['#b8664a', '#a85a40', '#9a5a48', '#6a6a6a']),
      doors: [{ side: door, at: dAt, w: 1.2 }, ...(opts.backDoor ? [{ side: { s: 'n', n: 's', e: 'w', w: 'e' }[door], at: L * 0.7, w: 1.2 }] : [])],
      graffiti, name: 'Casa', floor: r() < 0.5 ? 'wood' : 'tile', partitions,
    });
    let [fx, fz] = toW(U(0.02), 0.62); F.wardrobe(this, fx, fz, face + Math.PI / 2 * (left ? 1 : -1));
    if (r() < 0.85) { [fx, fz] = toW(U(0.26), 0.86); F.bed(this, fx, fz, face); }
    [fx, fz] = toW(U(0.97), 0.98); F.fridge(this, fx, fz, face);
    [fx, fz] = toW(U(0.76), 0.99); F.kitchen(this, fx, fz, face);
    if (r() < 0.7) { [fx, fz] = toW(U(0.78), 0.55); const t = this.furnPool.add(fx, 0, fz, { ry: r() * 6.28, color: '#ffffff' }); this.addNode('movel', fx, fz, { pool: this.furnPool, i: t }, 0.9); }
    if (r() < 0.5) { [fx, fz] = toW(U(0.2), 0.3); F.sofa(this, fx, fz, face + Math.PI / 2 * (left ? 1 : -1)); }
    F.rug(this, x, z, 2.2, 1.6, r.pick(['#7a3a2a', '#3a4a6a', '#6a5a3a']));
    if (r() < 0.25) { [fx, fz] = toW(0.5, 0.45); P.corpse(this, fx, fz, r() * 6); this.addContainer('cadaver', fx, fz); }
    if (r() < 0.3) this.decal('blood', x + (r() - 0.5) * 3, z + (r() - 0.5) * 3, 1.2 + r());
    this.decal('debris', x + (r() - 0.5) * 3, z + (r() - 0.5) * 3, 2 + r() * 2);
    return b;
  }
  // lote com muro/cerca em volta da casa
  lot(x, z, door, opts = {}) {
    const r = this.rnd;
    const b = this.house(x, z, door, opts);
    const m = 2.2;
    const x0 = b.x0 - m, x1 = b.x1 + m, z0 = b.z0 - m, z1 = b.z1 + m;
    const kind = r() < 0.5 ? 'wall' : 'fence';
    const seg = (a, bb, c, d) => kind === 'wall' ? P.lowWall(this, a, bb, c, d, { h: 1.1 + r() * 0.4 }) : P.fence(this, a, bb, c, d);
    // portão na frente
    if (door === 's') { seg(x0, z1, x - 1.5, z1); seg(x + 1.5, z1, x1, z1); seg(x0, z0, x1, z0); seg(x0, z0, x0, z1); seg(x1, z0, x1, z1); }
    else if (door === 'n') { seg(x0, z0, x - 1.5, z0); seg(x + 1.5, z0, x1, z0); seg(x0, z1, x1, z1); seg(x0, z0, x0, z1); seg(x1, z0, x1, z1); }
    else if (door === 'e') { seg(x1, z0, x1, z - 1.5); seg(x1, z + 1.5, x1, z1); seg(x0, z0, x0, z1); seg(x0, z0, x1, z0); seg(x0, z1, x1, z1); }
    else { seg(x0, z0, x0, z - 1.5); seg(x0, z + 1.5, x0, z1); seg(x1, z0, x1, z1); seg(x0, z0, x1, z0); seg(x0, z1, x1, z1); }
    // quintal
    if (r() < 0.6) this.addTree(r.pick(['goiabeira', 'bananeira', 'arvore', 'mangueira']), x0 + 1 + r() * (x1 - x0 - 2), door === 's' ? z0 + 0.8 : z1 - 0.8);
    if (r() < 0.4) this.addContainer('lixeira', door === 's' ? x1 - 0.8 : x0 + 0.8, door === 's' ? z1 + 1.4 : z0 - 1.4);
    return b;
  }
  addTree(sp, x, z, s = null) {
    const r = this.rnd;
    s = s ?? (0.8 + r() * 0.45);
    const tint = { arvore: ['#5f8a34', '#6f9a3a', '#7a8a30', '#4f7a34'], pinheiro: ['#5a7a4a', '#6a8a50'], mangueira: ['#3f6a2a', '#4a7a30'], goiabeira: ['#6a9a3a', '#7aa040'], bananeira: ['#7aa84a', '#8ab04a'], palmeira: ['#6a9a3a'] }[sp];
    const h = this.trees.add(sp, x, heightAt(x, z) - 0.05, z, s, r() * 6.28, r.pick(tint));
    const type = { arvore: 'arvore', pinheiro: 'pinheiro', mangueira: 'mangueira', goiabeira: 'goiabeira', bananeira: 'bananeira', palmeira: 'arvore' }[sp];
    const trunkR = { arvore: 0.35, pinheiro: 0.3, mangueira: 0.45, goiabeira: 0.2, bananeira: 0.22, palmeira: 0.25 }[sp] * s;
    const colShape = this.col.add({ type: 'circle', x, z, r: trunkR, los: false });
    return this.addNode(type, x, z, h, 1.0 + trunkR, { col: colShape, tree: true });
  }
  addRock(x, z, s = 1, ore = false) {
    const r = this.rnd;
    const pool = ore ? this.nature.ore : (r() < 0.5 ? this.nature.rock : this.nature.rock2);
    const i = pool.add(x, heightAt(x, z) - 0.1, z, { ry: r() * 6.28, s, color: ore ? '#ffffff' : r.pick(['#9a948a', '#8a8680', '#a8a296', '#7a7670']) });
    const colShape = this.col.add({ type: 'circle', x, z, r: 0.85 * s, low: s < 1.2 });
    return this.addNode(ore ? 'minerio' : 'rocha', x, z, { pool, i }, 0.9 * s + 0.4, { col: colShape });
  }
  addBigRock(x, z, s) { // rocha de enfeite (não coleta)
    const pool = this.rnd() < 0.5 ? this.nature.rock : this.nature.rock2;
    pool.add(x, heightAt(x, z) - 0.3 * s, z, { ry: this.rnd() * 6.28, s, color: this.rnd.pick(['#8a857e', '#7a766e', '#948e84']) });
    this.col.add({ type: 'circle', x, z, r: 0.85 * s });
  }
  addPebbles(x, z) { const i = this.nature.pebble.add(x, heightAt(x, z), z, { ry: this.rnd() * 6.28 }); return this.addNode('seixo', x, z, { pool: this.nature.pebble, i }, 0.8); }
  addSticks(x, z) { const i = this.nature.stick.add(x, heightAt(x, z), z, { ry: this.rnd() * 6.28 }); return this.addNode('galho', x, z, { pool: this.nature.stick, i }, 0.8); }
  addTall(x, z) { const i = this.nature.tall.add(x, heightAt(x, z), z, { ry: this.rnd() * 6.28, s: 0.8 + this.rnd() * 0.4, color: this.rnd.pick(['#9ab050', '#a8b85a', '#8aa048']) }); return this.addNode('capim', x, z, { pool: this.nature.tall, i }, 0.8); }
  addBush(x, z, s = 1) { this.nature.bush.add(x, heightAt(x, z), z, { ry: this.rnd() * 6.28, s, color: this.rnd.pick(['#4f7a34', '#5a8a3a', '#6a8a3a']) }); }
  // espalha recursos pequenos numa área (evitando obstáculos)
  scatter(x0, z0, x1, z1, n, fn) {
    for (let i = 0; i < n; i++) {
      const x = x0 + this.rnd() * (x1 - x0), z = z0 + this.rnd() * (z1 - z0);
      if (this.blockedAt(x, z, 1.2) || isWater(x, z) || this.onRoad(x, z)) continue;
      fn(x, z);
    }
  }
  blockedAt(x, z, rr) { let b = false; this.col.query(x - rr, z - rr, x + rr, z + rr, s => { if (s.type === 'box' ? (x > s.x0 - rr && x < s.x1 + rr && z > s.z0 - rr && z < s.z1 + rr) : (dist2(x, z, s.x, s.z) < (s.r + rr) ** 2)) { b = true; return false; } }); return b; }
  onRoad(x, z) { for (const q of this.roads) { const alongX = Math.abs(q.z1 - q.z0) < 0.1; if (alongX ? (Math.abs(z - q.z0) < q.w / 2 + 2.5 && x > Math.min(q.x0, q.x1) - 2 && x < Math.max(q.x0, q.x1) + 2) : (Math.abs(x - q.x0) < q.w / 2 + 2.5 && z > Math.min(q.z0, q.z1) - 2 && z < Math.max(q.z0, q.z1) + 2)) return true; } return false; }
  inBuilding(x, z, m = 0) { return this.buildings.some(b => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m); }

  roadCars(x0, z0, x1, z1, n, burnedChance = 0.2) {
    const r = this.rnd;
    const L = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(z1 - z0) < 0.1;
    for (let i = 0; i < n; i++) {
      const t = r();
      const side = r() < 0.5 ? -1 : 1;
      const x = x0 + (x1 - x0) * t + (alongX ? 0 : side * (1.5 + r() * 1.5)), z = z0 + (z1 - z0) * t + (alongX ? side * (1.5 + r() * 1.5) : 0);
      if (this.blockedAt(x, z, 2.4)) continue;
      const ry = (alongX ? Math.PI / 2 : 0) + (r() < 0.5 ? Math.PI : 0) + (r() - 0.5) * 0.6;
      if (r() < 0.25) {
        const k = this.wreckPool.add(x, 0, z, { ry, color: '#ffffff' });
        this.col.add({ type: 'circle', x, z, r: 1.2, low: true });
        this.addNode('sucata_carro', x, z, { pool: this.wreckPool, i: k }, 1.8);
      } else {
        const burned = r() < burnedChance;
        P.car(this, x, z, ry, { burned });
        if (!burned) this.addContainer('carro', x, z, { r: 2.2 });
      }
    }
  }

  // ------------------------------------------------------------------
  buildBase() {
    const r = this.rnd;
    this.addPOI('base', (BASE.x0 + BASE.x1) / 2, (BASE.z0 + BASE.z1) / 2, 20, 'Terreno da base');
    // cerca velha e quebrada em volta do terreno
    const fenceSeg = (a, b, c, d) => { const L = Math.hypot(c - a, d - b), n = Math.floor(L / 4); for (let i = 0; i < n; i++) if (r() < 0.55) P.fence(this, a + (c - a) * i / n, b + (d - b) * i / n, a + (c - a) * (i + 0.85) / n, b + (d - b) * (i + 0.85) / n, { h: 1.1, color: '#6a5540', collide: false }); };
    fenceSeg(BASE.x0, BASE.z0, BASE.x1, BASE.z0); fenceSeg(BASE.x0, BASE.z1, BASE.x1, BASE.z1); fenceSeg(BASE.x0, BASE.z0, BASE.x0, BASE.z1);
    // placa
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshStandardMaterial({ map: T.signTex('TERRENO À VENDA', { bg: '#e8e0c8', fg: '#8a2020' }), roughness: 0.8 }));
    sign.position.set(BASE.x1 + 1.5, 1.6, -6); sign.rotation.y = Math.PI / 2; this.staticGroup.add(sign);
    this.batch.add(boxGeo(0.1, 1.6, 0.1), 'wood', { x: BASE.x1 + 1.45, y: 0.8, z: -6.8, color: '#6a5038' });
    this.batch.add(boxGeo(0.1, 1.6, 0.1), 'wood', { x: BASE.x1 + 1.45, y: 0.8, z: -5.2, color: '#6a5038' });
    // recursos iniciais por perto
    for (const [x, z] of [[-121, -24], [-150, -26], [-152, 4], [-126, 5], [-112, -22], [-108, 12]]) this.addTree(r.pick(['arvore', 'arvore', 'mangueira']), x, z);
    this.addTree('goiabeira', -115, 14); this.addTree('bananeira', -110, -18);
    for (let i = 0; i < 7; i++) this.addSticks(-128 + r() * 24 - 6, -20 + r() * 34);
    for (let i = 0; i < 6; i++) this.addPebbles(-126 + r() * 22 - 4, -24 + r() * 36);
    for (let i = 0; i < 5; i++) this.addTall(-150 + r() * 30, -28 + r() * 34);
    this.addRock(-146, -24, 1.1); this.addRock(-122, 4, 0.9);
    P.woodPile(this, -152, -14);
    P.tires(this, -120, -27);
  }

  buildBairro() {
    const r = this.rnd;
    // casas ao longo da avenida
    for (const x of [-104, -72, -62]) { this.lot(x, -12, 's'); this.lot(x, 13, 'n'); }
    // ao longo da rua de terra
    for (const z of [-26, -40]) { this.lot(-96, z, 'e'); this.lot(-76, z, 'w'); }
    for (const z of [22, 40, 56]) { this.lot(-96, z, 'e'); if (z !== 22) this.lot(-76, z, 'w'); }
    // mercearia do bairro
    building(this, { x0: -80, z0: 18, x1: -68, z1: 27, h: 3.4, color: '#e8c878', band: '#6a4a3a', roof: 'flat', doors: [{ side: 'n', at: 6, w: 2.2, kind: 'open' }], sign: { text: 'MERCEARIA SÃO JOSÉ', bg: '#f0e0b0', fg: '#8a2a1a' }, name: 'Mercearia' });
    F.shelf(this, -74, 22.5, 0); F.counter(this, -79.5, 19, -77.5, 21.5);
    // igreja do bairro? ponto de ônibus
    P.busStop(this, -92, -6.2, 0);
    this.roadCars(-110, 0, -58, 0, 6, 0.25);
    this.roadCars(-86, -50, -86, 100, 5, 0.3);
    for (let x = -108; x < -56; x += 16) P.utilityPole(this, x, -6.5);
    // lixo e barricadas improvisadas
    P.trashPile(this, -84, -8); P.trashPile(this, -66, 7);
    P.woodBarricade(this, -86, 60, 0, 4);
    this.addContainer('caixa', -88, -10); this.addContainer('caixa', -58, 8);
    P.corpse(this, -80, 3, 1.2); this.addContainer('cadaver', -80, 3);
    P.corpse(this, -92, 34, 3.8); this.addContainer('cadaver', -92, 34);
    this.decal('blood', -70, -2, 2.4); this.decal('blood', -98, 1, 1.8);
    // natureza nos terrenos vazios
    this.scatter(-165, -55, -55, 55, 70, (x, z) => { if (!inBase(x, z, 3) && !this.inBuilding(x, z, 2)) this.addTree(r.pick(['arvore', 'arvore', 'mangueira', 'goiabeira', 'bananeira', 'pinheiro']), x, z); });
    this.scatter(-165, -55, -55, 55, 50, (x, z) => { if (!this.inBuilding(x, z, 1)) this.addSticks(x, z); });
    this.scatter(-165, -55, -55, 55, 40, (x, z) => { if (!this.inBuilding(x, z, 1)) this.addPebbles(x, z); });
    this.scatter(-165, -55, -55, 55, 50, (x, z) => { if (!this.inBuilding(x, z, 1)) this.addTall(x, z); });
    this.scatter(-165, -55, -55, 55, 60, (x, z) => { if (!this.inBuilding(x, z, 1)) this.addBush(x, z, 0.7 + r() * 0.6); });
    this.scatter(-165, -55, -55, 55, 8, (x, z) => { if (!this.inBuilding(x, z, 2) && !inBase(x, z, 2)) this.addRock(x, z, 0.9 + r() * 0.4); });
  }

  buildCentro() {
    const r = this.rnd;
    // ---- Igreja Matriz ----
    const ig = building(this, { x0: -8, z0: -55, x1: 8, z1: -44, h: 7, color: '#f2eee4', band: '#3a6a9a', roof: 'gable', roofColor: '#9a5a40', ridge: 3,
      doors: [{ side: 's', at: 8, w: 2.4 }], winStep: 2.6, winChance: 0.9, name: 'Igreja Matriz', floor: 'tile',
      graffiti: [{ side: 's', at: 12.5, text: 'ABRIGO AQUI', color: '#1d4ab3' }] });
    // torre do sino
    this.batch.add(boxGeo(3.2, 12, 3.2), 'plaster', { x: 10, y: 6, z: -46, color: '#f2eee4' });
    this.batch.add(new THREE.ConeGeometry(2.4, 3, 4), 'roof', { x: 10, y: 13.5, z: -46, ry: Math.PI / 4, color: '#9a5a40' });
    this.batch.add(boxGeo(3.3, 1.1, 3.3), 'plaster', { x: 10, y: 10, z: -46, color: '#3a6a9a' });
    this.col.add({ type: 'box', x0: 8.4, x1: 11.6, z0: -47.6, z1: -44.4 });
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const x = s * 3.8, z = -52 + i * 2; const k = this.pewPool.add(x, 0, z, { color: '#ffffff' }); this.addNode('movel', x, z, { pool: this.pewPool, i: k }, 1.4); this.col.add({ type: 'box', x0: x - 1.6, x1: x + 1.6, z0: z - 0.3, z1: z + 0.3, low: true, los: false }); }
    this.batch.add(boxGeo(3, 1.0, 1.2), 'wood', { x: 0, y: 0.5, z: -54, color: '#e8e0d0' });
    this.addPOI('igreja', 0, -49, 13, 'Igreja Matriz');
    this.rescueSites = { carol: { x: 0, z: -52.5, poi: 'igreja' } };
    // ---- Praça ----
    P.coreto(this, 0, -20);
    for (const [x, z] of [[-18, -30], [18, -30], [-18, -10], [18, -10], [-8, -32], [8, -8]]) this.addTree(r.pick(['mangueira', 'arvore', 'palmeira']), x, z, 1.0);
    for (const [x, z] of [[-20, -20], [20, -20], [0, -33], [-12, -6]]) this.addTree('palmeira', x, z, 1.1);
    // caminhos
    this.batch.add(boxGeo(46, 0.05, 2.4, 2), 'concrete', { x: 0, y: 0.03, z: -20, color: '#c8c0b0', shadow: false });
    this.batch.add(boxGeo(2.4, 0.05, 30, 2), 'concrete', { x: 0, y: 0.03, z: -20, color: '#c8c0b0', shadow: false });
    for (const [x, z, ry] of [[-10, -18.2, 0], [10, -18.2, 0], [-10, -21.8, Math.PI], [10, -21.8, Math.PI], [-1.8, -28, -Math.PI / 2], [1.8, -12, Math.PI / 2]]) P.bench(this, x, z, ry);
    for (const [x, z] of [[-23, -35], [23, -35], [-23, -5], [23, -5]]) P.lampPost(this, x, z);
    P.kiosk(this, 16, -10, 0, '#2a5a3a');
    this.addPickup('pista_jornal', 16, -8.4);
    this.addPOI('banca', 16, -10, 4, 'Banca de jornal');
    // barricada da polícia e ônibus batido
    P.sandbags(this, -14, -2, 0, 4); P.sandbags(this, 14, -2, 0, 4);
    P.car(this, 5, 1.5, 1.7, { kind: 'bus', color: '#e8c23a' });
    P.car(this, -30, -8, 0.1, { kind: 'police' }); this.addContainer('militar', -30, -8, { r: 2.2, name: 'Viatura da polícia' });
    // ---- Escola ----
    building(this, { x0: -54, z0: -34, x1: -34, z1: -8, h: 3.6, color: '#f0e8d0', band: '#2a6a4a', roof: 'gable', roofColor: '#a86048', winStep: 2.8,
      doors: [{ side: 'e', at: 13, w: 2.2 }, { side: 'w', at: 8, w: 1.2 }], sign: { text: 'E. E. PROFESSOR AIMORÉS', bg: '#e8f0e0', fg: '#1a4a2a', side: 'e', w: 8 }, name: 'Escola Estadual', floor: 'tile',
      partitions: [[-54, -21, -34, -21, [-40, -38]]], inner: '#f0e8d0' });
    for (let row = 0; row < 3; row++) for (let c = 0; c < 4; c++) for (const zz of [-30, -17]) {
      const x = -51 + c * 3.2, z = zz + row * 2.4;
      const k = this.deskPool.add(x, 0, z, { ry: Math.PI, color: '#ffffff' });
      this.addNode('movel', x, z, { pool: this.deskPool, i: k }, 0.7);
      this.col.add({ type: 'circle', x, z, r: 0.45, low: true, los: false });
    }
    F.blackboard(this, -44, -33.8, 0, 'ESTAMOS NA IGREJA DA PRAÇA. NÃO VÃO AO POSTO DE SAÚDE! — Carol');
    F.blackboard(this, -44, -20.9, 0, 'Aula de hoje: CIÊNCIAS');
    for (const [x, z, ry] of [[-35, -32, -Math.PI / 2], [-35, -27, -Math.PI / 2], [-35, -12, -Math.PI / 2], [-53, -12, Math.PI / 2], [-53, -24, Math.PI / 2]]) F.lockers(this, x, z, ry);
    this.addPOI('escola', -44, -21, 12, 'Escola Estadual');
    // ---- Farmácia ----
    building(this, { x0: 33, z0: -22, x1: 45, z1: -10, h: 3.6, color: '#e8f0e8', band: '#2a8a4a', roof: 'flat', doors: [{ side: 'w', at: 6, w: 1.6, kind: 'open' }],
      sign: { text: '✚ FARMÁCIA POPULAR', bg: '#2a8a4a', fg: '#ffffff', side: 'w', w: 7 }, name: 'Farmácia', floor: 'tile', windows: false });
    F.shelf(this, 40, -19.5, 0, 'farmacia', '#e0e4e8'); F.shelf(this, 40, -14.5, 0, 'farmacia', '#e0e4e8');
    F.counter(this, 35, -21, 37, -18);
    this.addPickup('pista_relatorio', 43.5, -12);
    this.addPOI('farmacia', 39, -16, 7, 'Farmácia');
    building(this, { x0: 34, z0: -34, x1: 50, z1: -26, h: 3.4, color: '#e8d098', band: '#6a4a2a', roof: 'flat', doors: [{ side: 'w', at: 4, w: 1.4, kind: 'open' }], sign: { text: 'CORREIOS', bg: '#f0d020', fg: '#1a3a8a', side: 'w' }, name: 'Correios' });
    this.addContainer('caixa', 40, -31); this.addContainer('caixa', 46, -28);
    // ---- Supermercado ----
    building(this, { x0: 31, z0: 6, x1: 54, z1: 30, h: 4.6, color: '#e8e4dc', band: '#c83a2a', roof: 'flat', windows: false,
      doors: [{ side: 'n', at: 11, w: 3.2, kind: 'open' }], sign: { text: 'SUPERMERCADO BOM PREÇO', bg: '#c83a2a', fg: '#ffffff', w: 14, side: 'n', onRoof: false }, name: 'Supermercado', floor: 'tile',
      partitions: [[31, 22, 54, 22, [47, 54]]], inner: '#d8d4cc' });
    for (const z of [12, 16.5]) for (const x of [37, 45]) F.shelf(this, x, z, 0, 'prateleira');
    for (const x of [35, 39]) F.counter(this, x - 0.5, 7.5, x + 0.5, 9.5, '#5a5a6a');
    // estoque nos fundos (divisória está no prédio)
    for (const [x, z] of [[34, 26], [36, 28], [40, 27], [44, 28.5], [50, 26]]) P.crate(this, x, z, r() * 0.5, 1.1);
    this.addContainer('caixa', 34, 26); this.addContainer('caixa', 44, 28.5); this.addContainer('prateleira', 50, 26, { name: 'Pallet de mercadorias' });
    this.addPOI('supermercado', 42, 16, 12, 'Supermercado Bom Preço');
    this.fixedSpawns.push({ id: 'fs_mercado', type: 'forte', x: 40, z: 26, region: 'centro', respawn: 2880 });
    // ---- Lojas da avenida (sul) ----
    const shops = [['PADARIA PÃO QUENTE', '#f0d8a0', '#8a4a1a'], ['LOJA DO SEU ZÉ', '#a0c8e0', '#1a3a6a'], ['BAR DO TONHO', '#e0a0a0', '#6a1a1a'], ['ARMARINHO', '#d0e0a0', '#3a5a1a']];
    shops.forEach(([t, bg, fg], i) => {
      const x0 = -24 + i * 12.2;
      building(this, { x0, z0: 6, x1: x0 + 11, z1: 16, h: 3.6, color: bg, band: '#5a5a5a', roof: 'flat', doors: [{ side: 'n', at: 5.5, w: 2.4, kind: 'open' }], sign: { text: t, bg: '#f4f0e6', fg }, name: t, floor: 'tile' });
      F.shelf(this, x0 + 5.5, 12.5, 0, i === 0 ? 'cozinha' : 'prateleira');
      F.counter(this, x0 + 1, 8, x0 + 3, 10);
    });
    for (const x of [-18, -4, 10]) this.lot(x, 29, 'n', { w: 9, d: 7 });
    // casas nos outros quarteirões
    for (const z of [12, 26]) this.lot(-44, z, z === 12 ? 'n' : 'e', { w: 9, d: 8 });
    for (const x of [-44, 22, 38, 48]) if (x !== 48) this.lot(x, 49, 'n', { w: 9, d: 7 });
    for (const x of [-18, 18]) this.lot(x, 49, 'n', { w: 8, d: 7 });
    this.lot(-44, -48, 's', { w: 9, d: 7 }); this.lot(30, -49, 's', { w: 9, d: 7 }); this.lot(44, -49, 's', { w: 9, d: 7 });
    // carros e poste
    this.roadCars(-55, 0, 55, 0, 5, 0.3);
    this.roadCars(-28, -55, -28, 55, 4, 0.2); this.roadCars(28, -55, 28, 55, 4, 0.2);
    this.roadCars(-55, -40, 55, -40, 3, 0.2); this.roadCars(-55, 40, 55, 40, 3, 0.2);
    for (let x = -50; x < 55; x += 18) { P.lampPost(this, x, -6); P.lampPost(this, x + 9, 6); }
    P.dumpster(this, 30, 33, 0.2); this.addContainer('lixeira', 30, 33);
    P.dumpster(this, -30, 33, 1.5); this.addContainer('lixeira', -30, 33);
    for (let i = 0; i < 6; i++) { const x = -50 + r() * 100, z = -50 + r() * 100; if (!this.blockedAt(x, z, 1) && !this.inBuilding(x, z, 1)) { P.corpse(this, x, z, r() * 6); this.addContainer('cadaver', x, z); } }
    for (let i = 0; i < 14; i++) this.decal('blood', -50 + r() * 100, -50 + r() * 100, 1.5 + r() * 2);
    for (let i = 0; i < 20; i++) this.decal('debris', -50 + r() * 100, -50 + r() * 100, 2 + r() * 3);
    this.scatter(-55, -55, 55, 55, 25, (x, z) => { if (!this.inBuilding(x, z, 1)) this.addBush(x, z, 0.6 + r() * 0.5); });
  }

  buildAvenida() {
    const r = this.rnd;
    // posto de gasolina
    this.batch.add(boxGeo(18, 0.5, 12), 'metal', { x: 77, y: 5, z: -16, color: '#e8e8e8' });
    this.batch.add(boxGeo(18.1, 0.6, 12.1), 'plain', { x: 77, y: 4.6, z: -16, color: '#c82a2a' });
    for (const [x, z] of [[70, -20], [84, -20], [70, -12], [84, -12]]) { this.batch.add(cylGeo(0.2, 0.2, 4.6, 8), 'metal', { x, y: 2.3, z, color: '#d8d8d8' }); this.col.add({ type: 'circle', x, z, r: 0.25 }); }
    for (const x of [73, 81]) for (const z of [-18, -14]) P.gasPump(this, x, z);
    const sgn = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.2), new THREE.MeshStandardMaterial({ map: T.signTex('AUTO POSTO RIO DOCE', { bg: '#c82a2a', fg: '#ffffff' }) }));
    sgn.position.set(77, 4.6, -9.9); this.staticGroup.add(sgn);
    building(this, { x0: 88, z0: -26, x1: 97, z1: -12, h: 3.4, color: '#f0f0f0', band: '#c82a2a', roof: 'flat', doors: [{ side: 's', at: 4.5, w: 1.6, kind: 'open' }], sign: { text: 'CONVENIÊNCIA', bg: '#c82a2a', fg: '#fff' }, name: 'Loja de conveniência', floor: 'tile' });
    F.shelf(this, 92.5, -20, 0); F.shelf(this, 92.5, -16.5, 0);
    this.addPOI('posto', 80, -16, 12, 'Auto Posto Rio Doce');
    // oficina da Daiana
    building(this, { x0: 102, z0: -28, x1: 120, z1: -8, h: 4.8, color: '#c8c0b0', band: '#4a4a52', roof: 'flat', brick: true,
      doors: [{ side: 's', at: 9, w: 5.5, kind: 'gap', gapH: 3.6 }], sign: { text: 'OFICINA DA DAIANA — MECÂNICA EM GERAL', bg: '#2a2a32', fg: '#f0c020', w: 12 }, name: 'Oficina', floor: 'concrete', windows: false });
    P.car(this, 111, -19, 0.05, { color: '#3a5a8a' });
    for (const [x, z, ry] of [[104, -25, Math.PI / 2], [104, -15, Math.PI / 2], [118, -24, -Math.PI / 2], [118, -14, -Math.PI / 2]]) F.toolbox(this, x, z, ry);
    P.tires(this, 106, -10.5); P.tires(this, 116, -10.5);
    this.addPOI('oficina', 111, -18, 12, 'Oficina da Daiana');
    this.rescueSites.daiana = { x: 111, z: -25.5, poi: 'oficina' };
    // materiais de construção
    building(this, { x0: 64, z0: 8, x1: 90, z1: 28, h: 5, color: '#d8d0b8', band: '#8a6a2a', roof: 'flat', doors: [{ side: 'n', at: 13, w: 4.5, kind: 'gap', gapH: 4 }],
      sign: { text: 'CASA DO CONSTRUTOR', bg: '#f0a020', fg: '#2a1a0a', w: 11, side: 'n' }, name: 'Materiais de construção', floor: 'concrete', windows: false });
    for (const [x, z] of [[68, 13], [68, 20], [86, 13], [86, 20]]) F.toolbox(this, x, z, 0);
    for (let i = 0; i < 6; i++) { P.crate(this, 70 + i * 3, 25.5, r() * 0.3, 1.2); }
    this.addContainer('caixa', 73, 25.5); this.addContainer('caixa', 79, 25.5);
    P.woodPile(this, 77, 17);
    // casas e lojas
    for (const x of [130, 142, 154]) { this.lot(x, -20, 's', { w: 9, d: 8 }); this.lot(x, 22, 'n', { w: 9, d: 8 }); }
    this.lot(100, 22, 'n');
    building(this, { x0: 123, z0: -44, x1: 137, z1: -32, h: 3.6, color: '#d0c8e8', band: '#5a4a7a', roof: 'flat', doors: [{ side: 's', at: 7, w: 2, kind: 'open' }], sign: { text: 'LOJA DE ROUPAS', bg: '#f0e8f8', fg: '#5a2a7a' }, name: 'Loja de roupas', floor: 'tile' });
    F.wardrobe(this, 126, -40, 0); F.wardrobe(this, 130, -40, 0); F.wardrobe(this, 134, -40, 0);
    // saída da cidade
    P.car(this, 150, -3, 0.3, { kind: 'police' }); this.addContainer('militar', 150, -3, { r: 2.2, name: 'Viatura da polícia' });
    P.sandbags(this, 160, -2, Math.PI / 2, 8);
    P.car(this, 138, 2, 1.4, { kind: 'truck', color: '#2a4a7a' }); this.addContainer('carro', 138, 2, { r: 3, name: 'Caminhão baú' });
    const sg2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.3), new THREE.MeshStandardMaterial({ map: T.signTex('BR-259 → FECHADA', { bg: '#1a5a2a', fg: '#fff' }) }));
    sg2.position.set(158, 2.8, -6); sg2.rotation.y = -Math.PI / 2; this.staticGroup.add(sg2);
    this.batch.add(cylGeo(0.08, 0.08, 3, 6), 'metal', { x: 158.2, y: 1.5, z: -6, color: '#888' });
    this.roadCars(58, 0, 165, 0, 8, 0.25);
    for (let x = 60; x < 165; x += 18) P.utilityPole(this, x, -6.5);
    for (let i = 0; i < 4; i++) { const x = 60 + r() * 100, z = -50 + r() * 100; if (!this.blockedAt(x, z, 1) && !this.inBuilding(x, z, 1)) { P.corpse(this, x, z, r() * 6); this.addContainer('cadaver', x, z); } }
    for (let i = 0; i < 12; i++) this.decal('blood', 58 + r() * 105, -50 + r() * 100, 1.5 + r() * 2);
    this.scatter(55, -55, 165, 55, 45, (x, z) => { if (!this.inBuilding(x, z, 2)) this.addTree(r.pick(['arvore', 'mangueira', 'pinheiro', 'bananeira']), x, z); });
    this.scatter(55, -55, 165, 55, 25, (x, z) => { if (!this.inBuilding(x, z, 1)) this.addSticks(x, z); });
    this.scatter(55, -55, 165, 55, 30, (x, z) => { if (!this.inBuilding(x, z, 1)) this.addBush(x, z, 0.6 + r() * 0.6); });
  }

  buildFerrovia() {
    const r = this.rnd;
    P.railway(this, -168, 168, 96);
    // estação
    building(this, { x0: -14, z0: 66, x1: 14, z1: 80, h: 4.2, color: '#e8d8b0', band: '#7a3a2a', roof: 'gable', roofColor: '#8a4a3a', doors: [{ side: 'n', at: 14, w: 2.4 }, { side: 's', at: 8, w: 1.4 }, { side: 's', at: 20, w: 1.4 }],
      sign: { text: 'ESTAÇÃO AIMORÉS — E.F. VITÓRIA A MINAS', bg: '#f0e8d0', fg: '#5a2a1a', side: 'n', w: 16 }, name: 'Estação Ferroviária', floor: 'wood' });
    this.batch.add(boxGeo(40, 0.5, 8, 2), 'concrete', { x: 0, y: 0.25, z: 86, color: '#a8a296' });
    this.batch.add(boxGeo(40, 0.2, 7, 2), 'metal', { x: 0, y: 4.2, z: 85, color: '#6a5a4a' });
    for (let x = -18; x <= 18; x += 6) { this.batch.add(cylGeo(0.15, 0.15, 4, 6), 'metal', { x, y: 2, z: 88.5, color: '#4a3a2a' }); this.col.add({ type: 'circle', x, z: 88.5, r: 0.2 }); }
    for (const x of [-8, 8]) P.bench(this, x, 83, Math.PI);
    F.counter(this, -12, 68, -6, 70); F.wardrobe(this, 12, 72, -Math.PI / 2);
    this.addPickup('pista_diario', -10, 69);
    this.addPOI('estacao', 0, 73, 12, 'Estação Ferroviária');
    // vagões
    const wc = ['#7a3a2a', '#3a4a6a', '#6a6a3a', '#5a3a4a'];
    for (const x of [-40, -26, 24, 38]) { P.wagon(this, x, 96, r.pick(wc)); this.addContainer('vagao', x, 93.6, { r: 2.4 }); }
    // armazém
    building(this, { x0: 22, z0: 60, x1: 46, z1: 80, h: 5.5, color: '#b8b0a0', band: '#5a4a3a', roof: 'gable', roofColor: '#7a7a7a', brick: true, doors: [{ side: 'w', at: 10, w: 4, kind: 'gap', gapH: 4 }],
      sign: { text: 'ARMAZÉM GERAL', bg: '#e0d8c0', fg: '#3a2a1a', side: 'w' }, name: 'Armazém', floor: 'concrete', windows: false });
    for (let i = 0; i < 8; i++) P.crate(this, 26 + (i % 4) * 4.5, 63 + Math.floor(i / 4) * 12, r() * 0.4, 1.3);
    this.addContainer('caixa', 30.5, 63); this.addContainer('caixa', 39.5, 75); this.addContainer('ferramentas', 44, 70, { name: 'Bancada do armazém' });
    for (const x of [-40, -20]) this.lot(x, 70, 'n', { w: 9, d: 8 });
    this.roadCars(0, 44, 0, 62, 2, 0.1);
    for (let i = 0; i < 5; i++) { const x = -50 + r() * 100, z = 58 + r() * 50; if (!this.blockedAt(x, z, 1.5) && !this.inBuilding(x, z, 1)) { P.corpse(this, x, z, r() * 6); this.addContainer('cadaver', x, z); } }
    this.scatter(-55, 55, 55, RIVER_Z - 6, 35, (x, z) => { if (!this.inBuilding(x, z, 2) && Math.abs(z - 96) > 3) this.addTree(r.pick(['arvore', 'mangueira', 'pinheiro']), x, z); });
    this.scatter(-55, 100, 55, RIVER_Z - 4, 30, (x, z) => this.addTall(x, z));
    this.scatter(-55, 55, 55, RIVER_Z, 20, (x, z) => { if (!this.inBuilding(x, z, 1) && Math.abs(z - 96) > 3) this.addPebbles(x, z); });
  }

  buildSaude() {
    const r = this.rnd;
    building(this, { x0: -6, z0: -132, x1: 36, z1: -104, h: 4.4, color: '#f0f4f4', band: '#3a8a9a', roof: 'flat', doors: [{ side: 's', at: 21, w: 2.6 }, { side: 'n', at: 10, w: 1.4 }],
      sign: { text: 'POSTO DE SAÚDE MUNICIPAL — AIMORÉS', bg: '#f0f4f4', fg: '#1a5a6a', w: 16 }, name: 'Posto de Saúde', floor: 'tile', winStep: 3.4,
      graffiti: [{ side: 's', at: 8, text: 'NÃO ENTRE', color: '#b31d1d' }, { side: 's', at: 34, text: 'QUARENTENA', color: '#b31d1d' }],
      partitions: [[12, -132, 12, -118], [24, -132, 24, -118]], inner: '#e8eeee' });
    for (let i = 0; i < 4; i++) { F.bed(this, -3 + i * 3.4, -128, 0); F.bed(this, 27 + (i % 3) * 3, -128, 0); }
    F.shelf(this, 18, -130.5, 0, 'farmacia', '#e0e4e8'); F.shelf(this, 18, -126, 0, 'farmacia', '#e0e4e8');
    F.counter(this, 14, -110, 22, -108, '#c8d8d8');
    // freezer da vacina
    this.batch.add(boxGeo(1.6, 1.0, 0.8), 'metal', { x: 34, y: 0.5, z: -112, color: '#dfe8ee' });
    this.addPOI('posto_saude', 15, -114, 16, 'Posto de Saúde');
    this.fixedSpawns.push({ id: 'fs_plantonista', type: 'enfermeiro', x: 18, z: -118, region: 'saude', respawn: 99999, boss: true });
    // pátio: ambulâncias, tendas de triagem, sacos de areia
    P.car(this, 4, -98, 1.5, { kind: 'ambulance' }); this.addContainer('farmacia', 4, -98, { r: 2.6, name: 'Ambulância' });
    P.car(this, 30, -97, 1.7, { kind: 'ambulance' }); this.addContainer('farmacia', 30, -97, { r: 2.6, name: 'Ambulância' });
    for (const [x, z] of [[-24, -110], [-24, -122], [46, -112]]) { P.tent(this, x, z, 0, '#e8e8e0'); this.addContainer('farmacia', x, z + 2, { name: 'Tenda de triagem' }); }
    P.sandbags(this, 15, -90, 0, 10); P.sandbags(this, -10, -92, 0.3, 5);
    this.addContainer('militar', 24, -91, { name: 'Caixa do exército' });
    for (let i = 0; i < 8; i++) { const x = -30 + r() * 80, z = -150 + r() * 60; if (!this.blockedAt(x, z, 1.5) && !this.inBuilding(x, z, 1)) { P.corpse(this, x, z, r() * 6); this.addContainer('cadaver', x, z); } }
    for (let i = 0; i < 16; i++) this.decal('blood', -30 + r() * 80, -150 + r() * 60, 1.5 + r() * 2.5);
    // cerca alta com portão
    P.fence(this, -40, -88, 10, -88, { h: 2.2, color: '#8a8a8a' }); P.fence(this, 18, -88, 50, -88, { h: 2.2, color: '#8a8a8a' });
    for (const x of [-40, 50]) P.fence(this, x, -88, x, -150, { h: 2.2, color: '#8a8a8a' });
    P.fence(this, -40, -150, 50, -150, { h: 2.2, color: '#8a8a8a' });
    for (const x of [-50, -40]) this.lot(x, -70, 's', { w: 8, d: 7 });
    this.scatter(-55, -165, 55, -55, 40, (x, z) => { if (!this.inBuilding(x, z, 2) && !(x > -42 && x < 52 && z > -152 && z < -86)) this.addTree(r.pick(['arvore', 'pinheiro', 'pinheiro', 'mangueira']), x, z); });
    this.scatter(-55, -165, 55, -55, 25, (x, z) => { if (!this.inBuilding(x, z, 1)) this.addBush(x, z); });
  }

  buildFazenda() {
    const r = this.rnd;
    building(this, { x0: 76, z0: -114, x1: 92, z1: -100, h: 3.2, color: '#f0e8d8', band: '#3a6a3a', roof: 'gable', roofColor: '#a85a3a', doors: [{ side: 's', at: 8, w: 1.4 }, { side: 'n', at: 5, w: 1.2 }], name: 'Casa da fazenda' });
    F.wardrobe(this, 77.5, -110, Math.PI / 2); F.fridge(this, 90.5, -112.5); F.kitchen(this, 87, -112.8); F.bed(this, 80, -104, 0); F.table(this, 85, -106);
    this.batch.add(boxGeo(16, 0.2, 3), 'wood', { x: 84, y: 0.1, z: -98.5, color: '#8a6a44' });
    // celeiro
    building(this, { x0: 110, z0: -126, x1: 132, z1: -104, h: 5.5, color: '#9a3a2a', band: '#6a2a1a', roof: 'gable', roofColor: '#5a5a5a', ridge: 3.2, doors: [{ side: 's', at: 11, w: 5, kind: 'gap', gapH: 4.2 }, { side: 'n', at: 11, w: 1.4 }], name: 'Celeiro', floor: 'dirt', windows: false });
    for (const [x, z] of [[113, -123], [116, -123], [113, -120], [128, -123], [128, -119]]) P.hayBale(this, x, z, r() * 0.3);
    this.addContainer('celeiro', 125, -123); this.addContainer('celeiro', 113, -110); this.addContainer('ferramentas', 130, -112, { name: 'Bancada do celeiro' });
    this.addPOI('celeiro', 121, -114, 14, 'Celeiro da Boa Vista');
    this.rescueSites.pablicio = { x: 121, z: -122, poi: 'celeiro' };
    P.silo(this, 138, -110);
    P.car(this, 100, -88, 0.2, { kind: 'truck', color: '#6a8a3a' }); this.addContainer('carro', 100, -88, { r: 3, name: 'Caminhonete' });
    // pasto cercado e plantações
    P.fence(this, 66, -94, 96, -94); P.fence(this, 66, -94, 66, -64); P.fence(this, 66, -64, 96, -64);
    for (let z = -150; z < -130; z += 2) for (let x = 68; x < 108; x += 2.2) if (r() < 0.85) this.addTall(x + r() * 0.5, z + r() * 0.5);
    for (let z = -152; z < -134; z += 4.5) for (let x = 132; x < 160; x += 4.5) this.addTree('bananeira', x + r(), z + r(), 0.9 + r() * 0.3);
    for (let z = -92; z < -66; z += 7) for (let x = 138; x < 160; x += 7) this.addTree(r() < 0.5 ? 'goiabeira' : 'mangueira', x + r() * 2, z + r() * 2, 0.9);
    for (let i = 0; i < 6; i++) P.hayBale(this, 70 + r() * 25, -90 + r() * 22, r() * 3);
    P.woodPile(this, 94, -118);
    this.scatter(55, -165, 165, -55, 45, (x, z) => { if (!this.inBuilding(x, z, 3) && !(x > 64 && x < 110 && z < -126)) this.addTree(r.pick(['arvore', 'mangueira', 'pinheiro']), x, z); });
    this.scatter(55, -165, 165, -55, 30, (x, z) => { if (!this.inBuilding(x, z, 1)) this.addSticks(x, z); });
    this.scatter(55, -165, 165, -55, 25, (x, z) => { if (!this.inBuilding(x, z, 1)) this.addPebbles(x, z); });
    this.scatter(55, -165, 165, -55, 10, (x, z) => { if (!this.inBuilding(x, z, 2)) this.addRock(x, z, 0.9 + r() * 0.4); });
  }

  buildPedreira() {
    const r = this.rnd;
    // paredões de rocha nas bordas
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      this.addBigRock(160 + r() * 6, 60 + t * 60, 3 + r() * 3);
      if (i % 2 === 0) this.addBigRock(62 + t * 96, 60 + r() * 3, 2.5 + r() * 2.5);
    }
    for (let i = 0; i < 12; i++) this.addBigRock(80 + r() * 70, 90 + r() * 25, 2 + r() * 3);
    for (let i = 0; i < 26; i++) { const x = 70 + r() * 88, z = 66 + r() * 50; if (!this.blockedAt(x, z, 2)) this.addRock(x, z, 0.9 + r() * 0.5, r() < 0.55); }
    // barracões
    building(this, { x0: 70, z0: 70, x1: 82, z1: 80, h: 3.4, color: '#a8a8a0', band: '#5a5a5a', roof: 'gable', roofColor: '#6a6a6a', doors: [{ side: 'e', at: 5, w: 1.4 }], name: 'Barracão', floor: 'concrete' });
    F.toolbox(this, 72, 72, 0); F.toolbox(this, 80, 78, Math.PI);
    building(this, { x0: 140, z0: 68, x1: 154, z1: 78, h: 3.4, color: '#a8a8a0', band: '#5a5a5a', roof: 'flat', doors: [{ side: 'w', at: 5, w: 1.4 }], name: 'Escritório da pedreira', floor: 'concrete' });
    F.wardrobe(this, 152, 70, -Math.PI / 2); F.counter(this, 142, 75, 146, 77);
    P.car(this, 100, 72, 0.4, { kind: 'truck', color: '#d8a020' }); this.addContainer('carro', 100, 72, { r: 3, name: 'Caminhão da pedreira' });
    P.car(this, 132, 100, 2.2, { kind: 'truck', color: '#d8a020', burned: true });
    // portão e placa
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.4), new THREE.MeshStandardMaterial({ map: T.signTex('PEDREIRA VELHA — PERIGO', { bg: '#e8c020', fg: '#1a1a1a' }) }));
    sg.position.set(120, 3.4, 58.2); this.staticGroup.add(sg);
    for (const x of [116, 124]) { this.batch.add(boxGeo(0.4, 4, 0.4), 'metal', { x, y: 2, z: 58, color: '#555' }); }
    // covil do Colosso
    this.addPOI('pedreira', 118, 108, 22, 'Pedreira Velha');
    this.fixedSpawns.push({ id: 'fs_colosso', type: 'chefe', x: 118, z: 110, region: 'pedreira', respawn: 99999, boss: true });
    this.addContainer('militar', 112, 116, { name: 'Caixa de explosivos' });
    for (let i = 0; i < 5; i++) { const x = 90 + r() * 50, z = 90 + r() * 25; if (!this.blockedAt(x, z, 1.5)) { P.corpse(this, x, z, r() * 6); this.addContainer('cadaver', x, z); } }
    for (let i = 0; i < 10; i++) this.decal('blood', 90 + r() * 50, 90 + r() * 25, 2 + r() * 2);
    this.scatter(55, 55, 165, RIVER_Z - 6, 14, (x, z) => { if (!this.inBuilding(x, z, 2)) this.addTree('pinheiro', x, z); });
    this.scatter(55, 55, 165, RIVER_Z, 30, (x, z) => { if (!this.inBuilding(x, z, 1)) this.addPebbles(x, z); });
  }

  buildMata() {
    const r = this.rnd;
    // acampamento abandonado
    const cx = -104, cz = -98;
    P.tent(this, cx - 3, cz - 2, 0.4, '#3a6a4a'); P.tent(this, cx + 3, cz - 3, -0.3, '#6a4a2a'); P.tent(this, cx + 1, cz + 3.5, 1.8, '#3a4a7a');
    P.campfireRing(this, cx, cz);
    this.addContainer('mochila_largada', cx + 1.5, cz + 0.5, { name: 'Mochila abandonada' });
    this.addContainer('caixa', cx - 4, cz + 2);
    P.corpse(this, cx - 1, cz + 5, 2.2); this.addContainer('cadaver', cx - 1, cz + 5);
    this.addPOI('acampamento', cx, cz, 8, 'Acampamento abandonado');
    // mata fechada
    this.scatter(-165, -165, -55, -55, 380, (x, z) => { if (Math.hypot(x - cx, z - cz) > 7 && Math.hypot(x - POND.x, z - POND.z) > POND.r + 2.5) this.addTree(r() < 0.3 ? 'pinheiro' : r() < 0.08 ? 'mangueira' : 'arvore', x, z, 0.85 + r() * 0.5); });
    this.scatter(-165, -165, -55, -55, 60, (x, z) => this.addSticks(x, z));
    this.scatter(-165, -165, -55, -55, 45, (x, z) => this.addPebbles(x, z));
    this.scatter(-165, -165, -55, -55, 25, (x, z) => this.addRock(x, z, 0.9 + r() * 0.6, r() < 0.12));
    this.scatter(-165, -165, -55, -55, 50, (x, z) => this.addTall(x, z));
    this.scatter(-165, -165, -55, -55, 160, (x, z) => this.addBush(x, z, 0.7 + r() * 0.8));
    this.scatter(-165, -165, -55, -55, 12, (x, z) => this.addTree(r() < 0.5 ? 'goiabeira' : 'bananeira', x, z));
    this.addPOI('lagoa', POND.x, POND.z, POND.r + 3, 'Lagoa da mata');
  }

  buildRio() {
    const r = this.rnd;
    // píer e barcos
    this.batch.add(boxGeo(3, 0.25, 16, 2), 'wood', { x: -100, y: 0.2, z: RIVER_Z + 2, color: '#8a6a44' });
    for (let z = RIVER_Z - 5; z < RIVER_Z + 10; z += 3) for (const s of [-1.3, 1.3]) this.batch.add(cylGeo(0.12, 0.12, 2.4, 6), 'wood', { x: -100 + s, y: -0.6, z, color: '#5a4a34' });
    P.boat(this, -96, RIVER_Z + 3, 0.2); P.boat(this, -122, RIVER_Z - 4, 1.2); P.boat(this, -66, RIVER_Z - 3, 2.6);
    // barracos de pescador
    building(this, { x0: -128, z0: 96, x1: -120, z1: 103, h: 2.8, color: '#a88a6a', band: '#5a4a3a', roof: 'gable', roofColor: '#6a6a6a', doors: [{ side: 's', at: 4, w: 1.2 }], name: 'Rancho de pescador', floor: 'wood', brick: false });
    F.wardrobe(this, -126.5, 98, Math.PI / 2); F.kitchen(this, -122, 97, 0);
    building(this, { x0: -80, z0: 98, x1: -72, z1: 105, h: 2.8, color: '#c8a88a', band: '#5a4a3a', roof: 'gable', roofColor: '#6a6a6a', doors: [{ side: 's', at: 4, w: 1.2 }], name: 'Rancho', floor: 'wood' });
    F.fridge(this, -73, 99.5); F.bed(this, -78, 101, 0);
    this.addPOI('prainha', -100, RIVER_Z - 6, 12, 'Prainha do Rio Doce');
    for (const x of [-140, -110, -70]) this.lot(x, 72, 'n', { w: 8, d: 7 });
    this.scatter(-165, 55, -55, RIVER_Z - 10, 60, (x, z) => { if (!this.inBuilding(x, z, 2) && Math.abs(z - 96) > 3) this.addTree(r.pick(['arvore', 'mangueira', 'bananeira', 'goiabeira', 'pinheiro']), x, z); });
    this.scatter(-165, 55, -55, RIVER_Z - 4, 50, (x, z) => this.addTall(x, z));
    this.scatter(-165, 55, -55, RIVER_Z, 30, (x, z) => this.addPebbles(x, z));
    this.scatter(-165, 55, -55, RIVER_Z - 6, 30, (x, z) => this.addSticks(x, z));
    this.scatter(-165, 55, -55, RIVER_Z - 6, 60, (x, z) => this.addBush(x, z));
    for (let i = 0; i < 3; i++) { const x = -150 + r() * 90, z = 60 + r() * 50; if (!this.blockedAt(x, z, 1.5) && !this.inBuilding(x, z, 1)) { P.corpse(this, x, z, r() * 6); this.addContainer('cadaver', x, z); } }
  }

  // capim decorativo onde o chão é grama
  scatterGrass() {
    const r = this.rnd, N = this.nature.grass;
    let n = 0;
    for (let i = 0; i < 26000 && n < 8800; i++) {
      const x = -168 + r() * 336, z = -168 + r() * 336;
      if (this.groundAt(x, z) !== 'grass' || isWater(x, z)) continue;
      if (this.inBuilding(x, z, 0.3)) continue;
      N.add(x, heightAt(x, z), z, { ry: r() * 6.28, s: 0.7 + r() * 0.8, color: r.pick(['#8aa050', '#9ab058', '#7a9448', '#a8a860']) });
      n++;
    }
  }
  // mata densa além das bordas do mapa (só visual)
  edgeForest() {
    const r = this.rnd;
    for (let i = 0; i < 520; i++) {
      const side = i % 4;
      const t = -185 + r() * 370, d = WORLD_HALF + 2 + r() * 22;
      let x, z;
      if (side === 0) { x = t; z = -d; } else if (side === 1) { x = -d; z = t; } else if (side === 2) { x = d; z = t; } else { continue; }
      if (z > RIVER_Z - 6) continue;
      this.trees.add(r() < 0.35 ? 'pinheiro' : 'arvore', x, heightAt(x, z) - 0.1, z, 0.9 + r() * 0.6, r() * 6, r.pick(['#4f7a34', '#5f8a34', '#56783a']));
    }
  }

  // pontos de nascimento de zumbis por região (fora de construções e da base)
  makeSpawns() {
    const r = this.rnd;
    for (const R of REGIONS) {
      const list = this.spawns[R.id] = [];
      let tries = 0;
      while (list.length < 70 && tries++ < 900) {
        const x = R.x0 + 4 + r() * (R.x1 - R.x0 - 8), z = R.z0 + 4 + r() * (R.z1 - R.z0 - 8);
        if (inBase(x, z, 14) || isWater(x, z) || this.blockedAt(x, z, 0.8)) continue;
        list.push({ x, z, inside: this.inBuilding(x, z, -0.5) });
      }
    }
  }

  // ------------------------------------------------------------------
  // Barreiras visuais das regiões trancadas
  setLocked(ids) {
    for (const R of REGIONS) {
      const locked = ids.includes(R.id);
      if (locked) this.lockedRegions.add(R.id); else this.lockedRegions.delete(R.id);
      if (locked && !this.barriers[R.id]) this.makeBarrier(R);
      if (!locked && this.barriers[R.id]) { this.root.remove(this.barriers[R.id]); this.barriers[R.id] = null; }
    }
  }
  makeBarrier(R) {
    const saveBatch = this.batch, saveCol = this.col;
    const b = new Batch(55);
    this.batch = b;
    // colisões das barreiras não entram (o bloqueio é pela região)
    this.col = { add: () => ({}), remove() {}, query() {} };
    const r = rng(R.col * 31 + R.row * 7);
    const edges = [];
    if (R.col > 0) edges.push([R.x0, R.z0, R.x0, R.z1]);
    if (R.col < 2) edges.push([R.x1, R.z0, R.x1, R.z1]);
    if (R.row > 0) edges.push([R.x0, R.z0, R.x1, R.z0]);
    if (R.row < 2) edges.push([R.x0, R.z1, R.x1, R.z1]);
    const W = { batch: b, col: this.col, rnd: r, decal: () => {} };
    for (const [x0, z0, x1, z1] of edges) {
      const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.abs(z1 - z0) < 0.1 ? 0 : Math.PI / 2;
      for (let t = 1; t < L; t += 3.2) {
        const x = x0 + (x1 - x0) * t / L, z = z0 + (z1 - z0) * t / L;
        if (z > RIVER_Z - 2) continue;
        const k = r();
        if (this.onRoad(x, z) && k < 0.4) P.car(W, x, z, ry + Math.PI / 2 + (r() - 0.5) * 0.4, { burned: r() < 0.5 });
        else if (k < 0.45) P.sawhorse(W, x, z, ry);
        else if (k < 0.7) P.concreteBlock(W, x, z, ry);
        else if (k < 0.85) P.woodBarricade(W, x, z, ry, 3);
        else P.tires(W, x, z);
      }
      // fita zebrada contínua
      for (let t = 0; t < L; t += 8) {
        const len = Math.min(8, L - t);
        const x = x0 + (x1 - x0) * (t + len / 2) / L, z = z0 + (z1 - z0) * (t + len / 2) / L;
        if (z > RIVER_Z - 2) continue;
        b.add(boxGeo(ry ? 0.02 : len, 0.12, ry ? len : 0.02, 1), 'tape', { x, y: 1.05, z, color: '#ffffff', shadow: false });
      }
    }
    const g = new THREE.Group();
    b.build(g);
    this.root.add(g);
    this.barriers[R.id] = g;
    this.batch = saveBatch; this.col = saveCol;
  }

  // ------------------------------------------------------------------
  update(dt, px, pz) {
    if (this.water) this.water.userData.update(dt);
    // telhado some e paredes baixam quando o jogador está dentro
    for (const b of this.buildings) {
      const inside = px > b.x0 - 0.1 && px < b.x1 + 0.1 && pz > b.z0 - 0.1 && pz < b.z1 + 0.1;
      const target = inside ? 0.36 : 1;
      if (Math.abs(b.cut - target) > 0.001) {
        b.cut += (target - b.cut) * Math.min(1, dt * 10);
        if (Math.abs(b.cut - target) < 0.01) b.cut = target;
        b.walls.scale.y = b.cut;
        b.roof.visible = b.cut > 0.9;
      }
    }
    // árvores balançando
    for (let i = this.shaking.length - 1; i >= 0; i--) {
      const s = this.shaking[i];
      s.t += dt;
      const a = Math.sin(s.t * 30) * Math.exp(-s.t * 6) * 0.08;
      this.trees.shake(s.h, a);
      if (s.t > 0.8) { this.trees.shake(s.h, 0); this.shaking.splice(i, 1); }
    }
    // itens especiais girando
    for (const p of this.pickups) if (!p.taken && p.mesh.visible) p.mesh.children[0].rotation.y += dt;
  }
  shakeTree(h) { this.shaking.push({ h, t: 0 }); }
}

const tick = () => new Promise(r => setTimeout(r, 0));
