// Mundo 3D: construção dos mapas, movimento em grade, NPCs e câmera.
import * as THREE from '../lib/three.module.min.js';
import { makeHuman, makeCreature, makeOrb, toon, textTexture, LOOKS, addOutline, shade as shadeHex } from './models.js';
import { SPECIES } from './data.js';
import { sfx } from './audio.js';
import {
  SKIES, shared, setAnisotropy, makeSky, makeMountains, buildTerrain, waterMaterial, plantTrees, plantTufts,
  tuftGeometry, TEX, texMat, boxW, blobShadow, Ambient, hash as ehash,
  scatterDecor, rockGeometry, rockMaterial, hullGeometry, hasProp, plantPropRocks, plantPropGrass,
} from './env.js';

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const ROT = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };
const BLOCK_TILES = new Set(['T', 'W', 'F', 'S', '#', 'C', 'R']);
const STEP_TIME = 0.24;

function hash(x, z) {
  let h = (x * 374761393 + z * 668265263) ^ 0x5bd1e995;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

class Actor {
  constructor(world, model, x, z, dir) {
    this.world = world;
    this.model = model;
    this.x = x; this.z = z; this.dir = dir || 'down';
    this.moving = false;
    this.from = new THREE.Vector3(); this.to = new THREE.Vector3();
    this.t = 0; this.speed = 1;
    this.visible = true;
    this.group = model.group;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = ROT[this.dir];
    this.resolveStep = null;
    if (!model.noBlob) {
      const blob = blobShadow(model.blobSize || 0.85);
      this.group.add(blob);
    }
  }
  face(dir) { this.dir = dir; this.targetRot = ROT[dir]; return Promise.resolve(); }
  startMove(dir, speed = 1) {
    const [dx, dz] = DIRS[dir];
    this.dir = dir;
    this.targetRot = ROT[dir];
    this.from.set(this.x, 0, this.z);
    this.x += dx; this.z += dz;
    this.to.set(this.x, 0, this.z);
    this.t = 0; this.moving = true; this.speed = speed;
    return new Promise(r => { this.resolveStep = r; });
  }
  update(dt) {
    if (this.targetRot !== undefined) {
      let d = this.targetRot - this.group.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.group.rotation.y += d * Math.min(1, dt * 18);
    }
    if (this.moving) {
      this.t += dt / (STEP_TIME / this.speed);
      if (this.t >= 1) {
        this.t = 1; this.moving = false;
        this.group.position.copy(this.to);
        const r = this.resolveStep; this.resolveStep = null;
        if (r) r();
      } else this.group.position.lerpVectors(this.from, this.to, this.t);
    }
    if (this.model.update) this.model.update(dt, this.moving, this.speed);
  }
  async walk(dirs, ignoreBlock = true) {
    for (const d of dirs) await this.startMove(d, 1);
  }
  place(x, z, dir) {
    this.x = x; this.z = z;
    this.group.position.set(x, 0, z);
    if (dir) { this.dir = dir; this.group.rotation.y = ROT[dir]; this.targetRot = ROT[dir]; }
  }
  show() { this.visible = true; this.group.visible = true; }
  hide() { this.visible = false; this.group.visible = false; }
  emote(ch = '!') {
    const tex = textTexture([ch], { w: 64, h: 64, bg: '#ffffff', fg: '#d02020', size: 52 });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.scale.set(0.45, 0.45, 1);
    sp.position.set(0, 1.75, 0);
    sp.renderOrder = 999;
    this.group.add(sp);
    return new Promise(r => setTimeout(() => { this.group.remove(sp); r(); }, 800));
  }
}

export class World {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.hemi = new THREE.HemisphereLight(0xdff2ff, 0x5a7a3a, 1.1);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
    this.sun.castShadow = true;
    const lowEnd = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.sun.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 70;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
    this.ambient = new Ambient(this.scene);
    this.sky = null;
    this.preset = SKIES.day;
    this.sunDir = new THREE.Vector3(0.5, 0.8, 0.3).normalize();
    this.roomLight = new THREE.PointLight('#ffe2b8', 0, 18, 1.4);
    this.scene.add(this.roomLight);
    // luz de preenchimento vinda do lado oposto ao sol: simula a luz que
    // rebate no chão e no céu, clareando as sombras sem deixá-las chapadas
    this.fill = new THREE.DirectionalLight('#bcd8ff', 0.35);
    this.scene.add(this.fill, this.fill.target);
    this.quality = { density: 1, shadow: 2048 };
    this.gradeName = 'day';
    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);
    this.npcs = new Map();
    this.player = null;
    this.camPos = new THREE.Vector3();
    this.time = 0;
    this.animated = [];
    this.wilds = [];
    this.camMode = 'terceira';
    this.camPitch = 0.55;
    this.camZoom = 1;
    this.resetYawOnLoad = true;
    this.onWildContact = null;
  }

  setQuality(Q) {
    this.quality = Q;
    const sz = Q.shadow;
    if (this.sun.shadow.mapSize.x !== sz) {
      this.sun.shadow.mapSize.set(sz, sz);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
  }

  setPlayerModel(model) {
    this.player = new Actor(this, model, 0, 0, 'down');
    this.scene.add(this.player.group);
    this.player.group.traverse(o => { if (o.isMesh) o.castShadow = !o.userData.noOutline; });
  }

  // ------------------------------------------------ construção do mapa
  load(map, G) {
    this.map = map;
    this.W = map.rows[0].length;
    this.H = map.rows.length;
    // limpa (libera a textura pintada do terreno anterior)
    if (this.terrain) {
      this.terrain.geometry.dispose();
      this.terrain.material.map.dispose();
      this.terrain.material.dispose();
      this.terrain = null;
    }
    this.scene.remove(this.mapGroup);
    this.mapGroup.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);
    for (const n of this.npcs.values()) this.scene.remove(n.group);
    this.npcs.clear();
    this.animated = [];
    this.blockExtra = new Set();

    const outdoor = !map.interior;
    if (this.sky) { this.scene.remove(this.sky); this.sky = null; }
    if (outdoor) {
      const pr = SKIES[map.sky || (map.dark ? 'forest' : 'day')] || SKIES.day;
      this.preset = pr;
      this.scene.background = new THREE.Color(pr.fog);
      this.scene.fog = new THREE.Fog(pr.fog, pr.fogNear, pr.fogFar);
      this.hemi.color.set(pr.hemiSky); this.hemi.groundColor.set(pr.hemiGround); this.hemi.intensity = pr.hemiI;
      this.sun.color.set(pr.sunLight); this.sun.intensity = pr.sunI;
      this.sunDir.set(...pr.sunDir).normalize();
      if (this.sunDir.y < 0.35) this.sunDir.y = 0.35;
      this.sunDir.normalize();
      this.roomLight.intensity = 0;
      this.sky = makeSky(pr);
      this.scene.add(this.sky);
      this.gradeName = map.sky || (map.dark ? 'forest' : 'day');
      this.fill.color.set(pr.hemiSky); this.fill.intensity = pr.sunI * 0.22;
      this.buildOutdoor(map);
      this.ambient.setup(pr, { x0: 0, x1: this.W - 1, z0: 0, z1: this.H - 1 });
    } else {
      this.preset = null;
      this.scene.background = new THREE.Color(0x0e0c12);
      this.scene.fog = null;
      this.hemi.color.set('#fff6ea'); this.hemi.groundColor.set('#8a7a6a'); this.hemi.intensity = 1.05;
      this.sun.color.set('#fff0dc'); this.sun.intensity = 1.0;
      this.sunDir.set(0.45, 0.85, 0.35).normalize();
      this.roomLight.position.set((this.W - 1) / 2, 2.8, (this.H - 1) / 2);
      this.roomLight.intensity = 9;
      this.roomLight.color.set('#ffe2b8');
      if (map.floor === 'cave') {
        this.hemi.color.set('#8aa0d0'); this.hemi.groundColor.set('#2a2a3a'); this.hemi.intensity = 0.7;
        this.sun.intensity = 0.5;
        this.roomLight.color.set('#6ac8ff');
        this.roomLight.intensity = 14;
      }
      // cor da luz de cada ginásio temático
      const GYM_LIGHT = { lava: ['#ffa060', 12], metal: ['#c8d4ff', 11], jungle: ['#e0ffc8', 10], dark: ['#b080ff', 12] };
      if (GYM_LIGHT[map.floor]) {
        this.roomLight.color.set(GYM_LIGHT[map.floor][0]);
        this.roomLight.intensity = GYM_LIGHT[map.floor][1];
        if (map.floor === 'dark') { this.hemi.color.set('#8a7ac8'); this.hemi.groundColor.set('#1a1428'); this.hemi.intensity = 0.6; this.sun.intensity = 0.45; }
      }
      this.gradeName = map.floor === 'cave' || map.floor === 'dark' ? 'cave' : 'indoor';
      this.fill.color.set('#ffe8d0'); this.fill.intensity = 0.3;
      this.buildInterior(map);
      this.ambient.setup(null);
    }
    for (const b of map.buildings || []) this.buildBuilding(b);
    for (const s of map.signs || []) if (map.rows[s.z][s.x] === 'S') this.buildSign(s.x, s.z);
    for (const it of map.items || []) {
      if (G.flag('it_' + it.id)) continue;
      const orb = makeOrb(it.item === 'superorbe' ? '#3a6ad0' : '#e03a3a');
      orb.position.set(it.x, 0.14, it.z);
      orb.userData.item = it;
      this.mapGroup.add(orb);
      this.blockExtra.add(it.x + ',' + it.z);
      it._mesh = orb;
    }
    for (const def of map.npcs || []) this.addNpc(def, G);
    this.refreshNpcs(G);
    this.initWilds();
    this.snapCamera = true;
    this.resetYawOnLoad = true;
  }

  addNpc(def, G) {
    let model;
    if (def.orb) {
      const g = makeOrb();
      g.position.y = 0.92;
      const wrap = new THREE.Group();
      wrap.add(g);
      model = { group: wrap, noBlob: true };
    } else if (def.creature) {
      model = makeCreature(SPECIES[def.creature].model);
      model.blobSize = 1.6;
      if (SPECIES[def.creature].legendary) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: '#ffe070', transparent: true, opacity: 0.8 }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.06;
        const ring2 = ring.clone();
        ring2.scale.setScalar(0.7);
        const glow = new THREE.PointLight('#ffe8a0', 3, 5, 1.5);
        glow.position.y = 1.2;
        model.group.add(ring, ring2, glow);
        const baseUpdate = model.update;
        let tt = 0;
        model.update = (dt, ...rest) => {
          tt += dt;
          baseUpdate(dt, ...rest);
          ring.rotation.z += dt * 0.8;
          ring.scale.setScalar(1 + Math.sin(tt * 2) * 0.08);
          ring2.material.opacity = 0.4 + Math.sin(tt * 3) * 0.3;
          glow.intensity = 2.5 + Math.sin(tt * 2) * 1;
        };
      }
    } else {
      model = makeHuman(LOOKS[def.look] || {});
    }
    const a = new Actor(this, model, def.x, def.z, def.dir);
    a.def = def;
    a.id = def.id;
    a.home = { x: def.x, z: def.z };
    a.wanderT = 1 + Math.random() * 3;
    this.scene.add(a.group);
    this.npcs.set(def.id, a);
    if (def.hidden) a.hide();
  }

  refreshNpcs(G) {
    for (const a of this.npcs.values()) {
      if (a.def.cond) {
        const v = !!a.def.cond(G);
        if (v) a.show(); else a.hide();
      }
    }
    for (const it of this.map.items || []) {
      if (it._mesh && G.flag('it_' + it.id)) {
        this.mapGroup.remove(it._mesh);
        this.blockExtra.delete(it.x + ',' + it.z);
        it._mesh = null;
      }
    }
  }

  tile(x, z) {
    if (x < 0 || z < 0 || x >= this.W || z >= this.H) return 'T';
    return this.map.rows[z][x];
  }

  buildingAt(x, z) {
    for (const b of this.map.buildings || []) if (x >= b.x && x < b.x + b.w && z >= b.z && z < b.z + b.d) return b;
    return null;
  }

  isDoor(x, z) {
    const b = this.buildingAt(x, z);
    return b && b.to && x === b.x + b.door && z === b.z + b.d - 1 ? b : null;
  }

  npcAt(x, z) {
    for (const a of this.npcs.values()) if (a.visible && a.x === x && a.z === z) return a;
    return null;
  }

  blocked(x, z, self) {
    const m = this.map;
    if (m.exit && m.exit.x === x && m.exit.z === z) return false;
    if (x < 0 || z < 0 || x >= this.W || z >= this.H) return true;
    if (BLOCK_TILES.has(this.tile(x, z))) return true;
    const b = this.buildingAt(x, z);
    if (b && !this.isDoor(x, z)) return true;
    for (const f of m.furniture || []) {
      if (f.walk) continue;
      if (x >= f.x && x < f.x + (f.w || 1) && z >= f.z && z < f.z + (f.d || 1)) return true;
    }
    if (this.blockExtra.has(x + ',' + z)) return true;
    const n = this.npcAt(x, z);
    if (n && n !== self) return true;
    const w = this.wildAt(x, z);
    if (w && w !== self) return true;
    if (self && self !== this.player && this.player.x === x && this.player.z === z) return true;
    return false;
  }

  // ------------------------------------------------ geometria exterior
  tileExt(x, z) {
    const inside = x >= 0 && z >= 0 && x < this.W && z < this.H;
    if (inside) return this.tile(x, z);
    const t = this.map.rows[Math.max(0, Math.min(this.H - 1, z))][Math.max(0, Math.min(this.W - 1, x))];
    return (t === '.' || t === 'G' || t === 'f' || t === 'S' || t === 'F' || t === 'R') ? 'T' : t;
  }

  buildOutdoor(map) {
    const PAD = 10, pr = this.preset;
    const tileExt = (x, z) => this.tileExt(x, z);
    const { mesh: terrain, heightAt } = buildTerrain({
      W: this.W, H: this.H, PAD, tileExt, preset: pr,
      isBuilding: (x, z) => !!this.buildingAt(x, z),
    });
    this.mapGroup.add(terrain);
    this.terrain = terrain;
    this.heightAt = heightAt;
    // plano de fundo: mar (mapas com água até a borda) ou gramado
    const hasSea = map.rows.some(r => r[0] === 'W' || r[r.length - 1] === 'W') || map.rows[0].includes('W') || map.rows[map.rows.length - 1].includes('W');
    const hasWater = map.rows.some(r => r.includes('W'));
    const base = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), hasSea ? waterMaterial(pr.water, 1) : new THREE.MeshToonMaterial({ color: pr.grassDark }));
    base.rotation.x = -Math.PI / 2;
    base.position.set(this.W / 2, hasSea ? -0.14 : -0.4, this.H / 2);
    this.mapGroup.add(base);
    // montanhas no horizonte (não sobre o mar)
    const R = Math.max(this.W, this.H) / 2 + PAD + 4;
    const mts = makeMountains((this.W - 1) / 2, (this.H - 1) / 2, R, pr, this.W * 31 + this.H);
    mts.children = mts.children.filter(m => {
      const tx = Math.round(Math.max(-PAD, Math.min(this.W + PAD - 1, m.position.x)));
      const tz = Math.round(Math.max(-PAD, Math.min(this.H + PAD - 1, m.position.z)));
      return tileExt(tx, tz) !== 'W';
    });
    this.mapGroup.add(mts);

    const trees = [], tall = [], tallBK = [], fences = [], rocks = [];
    const kinds = Object.entries(pr.kinds);
    const pickKind = (x, z) => {
      let r = ehash(x * 7 + 3, z * 5 + 1);
      for (const [k, w] of kinds) { r -= w; if (r <= 0) return k; }
      return kinds[0][0];
    };
    const density = (this.quality && this.quality.density) || 1;
    for (let z = -PAD; z < this.H + PAD; z++) {
      for (let x = -PAD; x < this.W + PAD; x++) {
        const t = tileExt(x, z);
        const inside = x >= 0 && z >= 0 && x < this.W && z < this.H;
        const dOut = inside ? 0 : Math.max(-x, x - this.W + 1, -z, z - this.H + 1, 0);
        const h = ehash(x * 13 + 7, z * 29 + 3);
        if (t === 'T') {
          if (dOut > 4 && h < 0.35) continue;
          const j = inside ? 0.12 : 0.3;
          let kind = pickKind(x, z);
          if (kind === 'round' && pr === SKIES.day && ehash(x * 5, z * 9) < 0.12) kind = 'birch';
          trees.push({
            x: x + (ehash(x, z * 3) - 0.5) * j * 2, y: heightAt(x, z) - 0.02, z: z + (ehash(x * 3, z) - 0.5) * j * 2,
            s: 0.8 + h * 0.5, r: h * 6.28, kind, lo: dOut > 2,
          });
        } else if (t === 'G') {
          // com a touceira do BlenderKit, cada quadrado ganha uma e menos tufos procedurais
          if (hasProp('grass')) tallBK.push({ x: x + (ehash(x * 3, z * 7) - 0.5) * 0.2, z: z + (ehash(x * 7, z * 3) - 0.5) * 0.2, s: 1.05 + h * 0.2, sy: 2.4 + h * 0.4, r: h * 6.28 });
          const n = hasProp('grass') ? Math.max(3, Math.round(4 * density)) : Math.max(4, Math.round(7 * density));
          for (let k = 0; k < n; k++) {
            tall.push({ x: x + (ehash(x * 7 + k, z) - 0.5) * 0.9, z: z + (ehash(x, z * 5 + k) - 0.5) * 0.9, s: 0.8 + ehash(k, x + z) * 0.45, r: ehash(x + k, z) * 6.28, v: k % 2 });
          }
        } else if (t === 'F') fences.push([x, z]);
        else if (t === 'R') rocks.push([x, z]);
      }
    }
    if (trees.length) this.mapGroup.add(plantTrees(trees, pr));
    if (tall.length) {
      const dark = new THREE.Color(pr.tall).multiplyScalar(0.65).getStyle();
      const gA = tuftGeometry(0.7, 12, dark, pr.grassLight, 0.18, 4);
      const gB = tuftGeometry(0.6, 10, dark, new THREE.Color(pr.grassLight).lerp(new THREE.Color('#e8e090'), 0.25).getStyle(), 0.2, 5);
      this.mapGroup.add(plantTufts(tall.filter(t => !t.v), gA, { push: 0.55, shadows: true, amp: 0.13, fade: 0 }));
      this.mapGroup.add(plantTufts(tall.filter(t => t.v), gB, { push: 0.55, shadows: true, amp: 0.15, fade: 0 }));
      this.mapGroup.add(plantPropGrass(tallBK, pr.tall, { push: 0.25, amp: 0.12, fade: 0 }));
    }
    // vegetação espalhada: capim baixo e seco, flores, plantas, samambaias,
    // arbustos, folhas caídas, gravetos, pedrinhas e rochas
    this.mapGroup.add(scatterDecor({
      W: this.W, H: this.H, PAD, tileExt, heightAt, p: pr, density,
      isBuilding: (x, z) => !!this.buildingAt(x, z) || this.tile(x, z) === 'S',
    }));
    const m4 = new THREE.Matrix4();
    if (fences.length) {
      const wood = texMat(TEX.planks(), '#f4ece0');
      const post = new THREE.InstancedMesh(boxW(0.13, 0.62, 0.13), wood, fences.length);
      const cap = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.12, 4), toon('#f4ece0'), fences.length);
      const rail = new THREE.InstancedMesh(boxW(1, 0.08, 0.05), wood, fences.length * 2);
      fences.forEach(([x, z], i) => {
        m4.makeTranslation(x, 0.31, z); post.setMatrixAt(i, m4);
        m4.makeTranslation(x, 0.68, z); cap.setMatrixAt(i, m4);
        const horiz = this.tile(x - 1, z) === 'F' || this.tile(x + 1, z) === 'F';
        const r = new THREE.Matrix4().makeRotationY(horiz ? 0 : Math.PI / 2);
        m4.makeTranslation(x, 0.45, z).multiply(r); rail.setMatrixAt(i * 2, m4);
        m4.makeTranslation(x, 0.24, z).multiply(r); rail.setMatrixAt(i * 2 + 1, m4);
      });
      post.castShadow = rail.castShadow = true;
      this.mapGroup.add(post, cap, rail);
    }
    if (rocks.length && hasProp('rocks')) {
      // rochas com musgo do BlenderKit: uma grande e uma pequena por quadrado
      const l = [];
      rocks.forEach(([x, z]) => {
        l.push({ x: x - 0.06, y: -0.03, z, s: 1.05, sy: 1.25, r: ehash(z, x) * 6.28 });
        l.push({ x: x + 0.3, y: -0.02, z: z + 0.28, s: 0.45, r: ehash(x, z) * 6.28 });
      });
      this.mapGroup.add(plantPropRocks(l));
    } else if (rocks.length) {
      // rochas irregulares com rachaduras e musgo, em três formatos
      const items = [[], [], []];
      rocks.forEach(([x, z]) => {
        const v = Math.floor(ehash(x * 3, z * 7) * 3);
        items[v].push({ x: x - 0.08, y: 0.12, z, s: 0.5, sy: 0.55, r: ehash(z, x) * 6.28 });
        items[(v + 1) % 3].push({ x: x + 0.3, y: 0.05, z: z + 0.26, s: 0.24, r: ehash(x, z) * 6.28 });
      });
      items.forEach((l, v) => {
        const geo = rockGeometry(20 + v);
        this.mapGroup.add(plantTufts(l, geo, { material: rockMaterial(), outline: hullGeometry(geo), shadows: true }));
      });
    }
    // espuma nas margens: mapa de proximidade da terra para o shader da água
    if (hasWater) {
      const TW = this.W + 2 * PAD, TH = this.H + 2 * PAD;
      const d = new Uint8Array(TW * TH * 4);
      for (let z = -PAD; z < this.H + PAD; z++) for (let x = -PAD; x < this.W + PAD; x++) {
        const t = tileExt(x, z);
        let v = t === 'W' ? 0 : 255;
        if (t === 'W' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => tileExt(x + dx, z + dz) !== 'W')) v = 90;
        const i = ((z + PAD) * TW + (x + PAD)) * 4;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
      const tex = new THREE.DataTexture(d, TW, TH, THREE.RGBAFormat);
      tex.magFilter = tex.minFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      const shore = { tex, x0: -PAD - 0.5, z0: -PAD - 0.5, w: TW, h: TH };
      const wp = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), waterMaterial(pr.water, 0.84, shore));
      wp.rotation.x = -Math.PI / 2;
      wp.position.set((this.W - 1) / 2, -0.125, (this.H - 1) / 2);
      this.mapGroup.add(wp);
    }
  }

  buildSign(x, z) {
    const g = new THREE.Group();
    const wood = texMat(TEX.planks(), '#c8904a');
    for (const px of [-0.28, 0.28]) {
      const post = new THREE.Mesh(boxW(0.08, 0.8, 0.08), texMat(TEX.planks(), '#8a5a30'));
      post.position.set(px, 0.4, 0);
      g.add(post);
    }
    const board = new THREE.Mesh(boxW(0.78, 0.42, 0.07), wood);
    board.position.y = 0.66;
    const lines = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.24), new THREE.MeshBasicMaterial({ map: textTexture(['≡'], { w: 64, h: 32, bg: '#c8904a', fg: '#5a3418', size: 28 }) }));
    lines.position.set(0, 0.66, 0.04);
    lines.userData.noOutline = true;
    g.add(board, lines);
    addOutline(g, 0.01);
    g.position.set(x, 0, z);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.mapGroup.add(g);
  }

  buildBuilding(b) {
    const g = new THREE.Group();
    const cx = b.x + (b.w - 1) / 2, cz = b.z + (b.d - 1) / 2;
    g.position.set(cx, 0, cz);
    if (b.style === 'cave') {
      const W = b.w, D = b.d;
      const main = new THREE.Mesh(rockGeometry(7, '#8a8478', '#6a9a4a', 2), rockMaterial());
      main.scale.set(W * 0.58, 2.9, D * 0.58);
      main.position.set(0, 0.9, -0.1);
      g.add(main);
      for (const [x, z, s] of [[-W * 0.4, 0.3, 0.8], [W * 0.42, 0.2, 0.9], [W * 0.1, -D * 0.3, 1.1], [-W * 0.2, D * 0.35, 0.5]]) {
        const r = new THREE.Mesh(rockGeometry(11 + Math.round(s * 10), '#9a948a', '#6a9a4a', 1), rockMaterial());
        r.scale.set(s, s * 1.4, s);
        r.position.set(x, s * 0.45, z);
        g.add(r);
      }
      const doorX = b.door - (b.w - 1) / 2;
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#05060c' }));
      hole.scale.set(1, 1.6, 1);
      hole.position.set(doorX, 0.02, D / 2 + 0.35);
      hole.userData.noOutline = true;
      const holeBox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 0.6), new THREE.MeshBasicMaterial({ color: '#05060c' }));
      holeBox.position.set(doorX, 0.5, D / 2 + 0.05);
      holeBox.userData.noOutline = true;
      g.add(hole, holeBox);
      for (let i = 0; i < 4; i++) {
        const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), toon('#7af0ff', { emissive: '#3ab0ff', emissiveIntensity: 0.8 }));
        cr.position.set(doorX + (i - 1.5) * 0.45, 1.25 + (i % 2) * 0.15, D / 2 + 0.25);
        g.add(cr);
      }
      addOutline(g, 0.015);
      g.traverse(o => { if (o.isMesh && !o.userData.noOutline) { o.castShadow = true; o.receiveShadow = true; } });
      this.mapGroup.add(g);
      return;
    }
    const ST = {
      house: { wall: '#f6ead4', tex: 'siding', h: 1.55, roof: b.roof || '#d84a3a', roofH: 0.95, kind: 'gable', trim: '#ffffff' },
      lab: { wall: '#f2f4f8', tex: 'plaster', h: 1.8, roof: '#8a9aaa', kind: 'flat', trim: '#6a8ab0' },
      center: { wall: '#fbf7f2', tex: 'plaster', h: 1.8, roof: '#e04a4a', roofH: 0.9, kind: 'gable', trim: '#e04a4a' },
      shop: { wall: '#f7f7fb', tex: 'plaster', h: 1.7, roof: '#3a7ad8', roofH: 0.85, kind: 'gable', trim: '#3a7ad8' },
      gym: { wall: '#ddd4c4', tex: 'stone', h: 2.4, roof: b.roof || '#8a7a6a', kind: 'flat', trim: '#5a5048' },
      liga: { wall: '#f4ecdc', tex: 'stone', h: 3.0, roof: '#e0b038', roofH: 1.8, kind: 'hip', trim: '#d8a830' },
    };
    const st = ST[b.style] || ST.house;
    const W = b.w - 0.1, D = b.d - 0.1, front = D / 2;
    const wallMat = texMat(TEX[st.tex](), st.wall);
    const trim = toon(st.trim);
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
      g.add(m);
      return m;
    };
    add(boxW(W + 0.18, 0.22, D + 0.18), texMat(TEX.stone(), '#a09890'), 0, 0.11, 0);
    add(boxW(W, st.h, D), wallMat, 0, st.h / 2 + 0.02, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.12, st.h, 0.12), trim, sx * W / 2, st.h / 2 + 0.02, sz * D / 2);
    add(new THREE.BoxGeometry(W + 0.1, 0.1, D + 0.1), trim, 0, st.h, 0);

    // telhado
    const roofMat = texMat(TEX.shingle(), st.roof);
    if (st.kind === 'gable') {
      const o = 0.28, rh = st.roofH, half = D / 2 + o, L = Math.hypot(half, rh), ang = Math.atan2(rh, half);
      for (const sgn of [1, -1]) add(boxW(W + 2 * o, 0.1, L), roofMat, 0, st.h + rh / 2 + 0.05, sgn * half / 2, sgn * ang, 0, 0);
      const tri = new THREE.Shape();
      tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, rh); tri.closePath();
      for (const sgn of [1, -1]) {
        const gm = add(new THREE.ShapeGeometry(tri), wallMat, sgn * W / 2, st.h + 0.05, 0, 0, sgn * Math.PI / 2, 0);
        gm.userData.noOutline = true;
      }
      add(new THREE.CylinderGeometry(0.07, 0.07, W + 2 * o, 8), toon(shadeHex(st.roof, -0.15)), 0, st.h + rh + 0.07, 0, 0, 0, Math.PI / 2);
      if (b.style === 'house') {
        add(boxW(0.34, 1.1, 0.34), texMat(TEX.brick(), '#c86a4a'), W * 0.28, st.h + 0.75, -D * 0.18);
        add(new THREE.BoxGeometry(0.42, 0.08, 0.42), toon('#6a4a3a'), W * 0.28, st.h + 1.32, -D * 0.18);
      }
      if (b.style === 'center') {
        const orb = makeOrb();
        orb.scale.setScalar(2.6);
        orb.position.set(0, st.h + rh + 0.38, 0);
        g.add(orb);
      }
    } else if (st.kind === 'flat') {
      add(new THREE.BoxGeometry(W + 0.2, 0.16, D + 0.2), toon(st.roof), 0, st.h + 0.08, 0);
      for (const sz of [-1, 1]) add(new THREE.BoxGeometry(W + 0.2, 0.28, 0.1), trim, 0, st.h + 0.3, sz * (D / 2 + 0.05));
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.1, 0.28, D + 0.2), trim, sx * (W / 2 + 0.05), st.h + 0.3, 0);
      if (b.style === 'lab') {
        add(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), toon('#8a8a9a'), -W * 0.3, st.h + 0.45, -D * 0.1);
        const dish = add(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), toon('#f4f4f8', { side: THREE.DoubleSide }), -W * 0.3, st.h + 0.85, -D * 0.1, -0.9, 0, 0);
        dish.scale.y = 0.5;
        for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.8, 0.05, 0.5), toon('#2a3a6a'), W * 0.05 + i * 0.9 - 0.4, st.h + 0.35, -D * 0.15, -0.35, 0, 0);
        add(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4), toon('#8a8a9a'), W * 0.38, st.h + 0.6, D * 0.2);
        add(new THREE.SphereGeometry(0.06, 8, 6), toon('#ff4a3a', { emissive: '#ff2a1a', emissiveIntensity: 0.8 }), W * 0.38, st.h + 1.07, D * 0.2);
      }
      if (b.style === 'gym') {
        const em = add(new THREE.OctahedronGeometry(0.55, 0), toon('#e8c040', { emissive: '#8a6010', emissiveIntensity: 0.3 }), 0, st.h + 0.85, front - 0.1);
        em.scale.set(1, 1.3, 0.35);
        const doorX = b.to ? b.door - (b.w - 1) / 2 : 0;
        for (const sx of [-1, 1]) {
          add(new THREE.CylinderGeometry(0.16, 0.2, st.h, 10), texMat(TEX.stone(), '#c8c0b0'), doorX + sx * 0.85, st.h / 2, front + 0.15);
          add(new THREE.PlaneGeometry(0.42, 0.9), toon(st.roof, { side: THREE.DoubleSide }), doorX + sx * 1.6, st.h * 0.62, front + 0.02).userData.noOutline = true;
        }
      }
    } else {
      const roof = add(new THREE.ConeGeometry(1, st.roofH, 4), texMat(TEX.shingle(), st.roof), 0, st.h + st.roofH / 2, 0, 0, Math.PI / 4, 0);
      roof.scale.set((W + 0.6) / Math.SQRT2, 1, (D + 0.6) / Math.SQRT2);
      for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        add(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), toon('#8a7a6a'), fx * W / 2, st.h + 0.6, fz * D / 2);
        add(new THREE.PlaneGeometry(0.5, 0.3), toon(fx > 0 ? '#c83a3a' : '#3a6ad0', { side: THREE.DoubleSide }), fx * W / 2 + 0.26, st.h + 1.02, fz * D / 2).userData.noOutline = true;
      }
      add(new THREE.OctahedronGeometry(0.3, 0), toon('#ffd84a', { emissive: '#a07010', emissiveIntensity: 0.4 }), 0, st.h + st.roofH + 0.35, 0);
    }

    // janelas
    const glass = toon('#a8dcf4', { emissive: '#4a8ab0', emissiveIntensity: 0.25 });
    const doorX = b.to ? b.door - (b.w - 1) / 2 : 0;
    const windowAt = (x, y, z, ry) => {
      const w = new THREE.Group();
      w.position.set(x, y, z); w.rotation.y = ry;
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.56, 0.06), toon('#ffffff'));
      const gl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.44, 0.07), glass);
      const mv = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.44, 0.08), toon('#ffffff'));
      const mh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.035, 0.08), toon('#ffffff'));
      const sill = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.14), toon('#e8e0d4'));
      sill.position.set(0, -0.3, 0.04);
      w.add(fr, gl, mv, mh, sill);
      if (b.style === 'house') {
        for (const sx of [-1, 1]) {
          const sh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.54, 0.04), toon(st.roof));
          sh.position.set(sx * 0.41, 0, 0.02);
          w.add(sh);
        }
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.14), toon('#8a5a3a'));
        box.position.set(0, -0.39, 0.08);
        w.add(box);
        const fc = ['#f05a7a', '#ffd23a', '#ffffff', '#b07af0'];
        for (let i = 0; i < 5; i++) {
          const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), toon(fc[i % 4]));
          f.position.set(-0.24 + i * 0.12, -0.3, 0.1);
          w.add(f);
        }
      }
      g.add(w);
    };
    const wy = st.h * 0.58;
    const nWin = Math.max(1, Math.floor(b.w / 2));
    for (let i = 0; i < nWin; i++) {
      const wx = -W / 2 + (i + 0.5) * (W / nWin);
      if (b.to && Math.abs(wx - doorX) < 0.75) continue;
      windowAt(wx, wy, front + 0.02, 0);
    }
    if (b.d >= 4) for (const sx of [-1, 1]) windowAt(sx * (W / 2 + 0.02), wy, 0, sx * Math.PI / 2);

    // porta, degrau, toldo e poste de luz
    const glassDoor = b.style === 'center' || b.style === 'shop';
    add(new THREE.BoxGeometry(0.88, 1.2, 0.07), trim, doorX, 0.72, front + 0.02);
    add(new THREE.BoxGeometry(0.72, 1.06, 0.08), glassDoor ? glass : texMat(TEX.planks(), '#8a5430'), doorX, 0.68, front + 0.03);
    if (!glassDoor) add(new THREE.SphereGeometry(0.035, 8, 6), toon('#e8c040'), doorX + 0.24, 0.66, front + 0.09);
    else add(new THREE.BoxGeometry(0.02, 1.06, 0.09), toon('#ffffff'), doorX, 0.68, front + 0.03);
    add(boxW(1.0, 0.08, 0.36), texMat(TEX.stone(), '#b8b0a4'), doorX, 0.04, front + 0.2);
    if (b.style === 'center' || b.style === 'shop') {
      const aw = add(boxW(1.5, 0.06, 0.6), texMat(TEX.awning(st.trim), '#ffffff'), doorX, 1.42, front + 0.26, 0.35, 0, 0);
      aw.castShadow = true;
    }
    if (b.style !== 'house') {
      const lx = doorX + (b.w > 5 ? 1.5 : 1.15);
      add(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6), toon('#3a3a44'), lx, 0.75, front + 0.55);
      add(new THREE.SphereGeometry(0.12, 10, 8), toon('#fff4c0', { emissive: '#ffd070', emissiveIntensity: 0.6 }), lx, 1.55, front + 0.55);
    }
    if (b.label) {
      const colors = { center: ['#e04a4a', '#fff'], shop: ['#3a7ad8', '#fff'], gym: ['#3a3a3a', '#ffd23a'], lab: ['#4a5a6a', '#fff'], liga: ['#8a1a1a', '#ffd23a'] };
      const [bg, fg] = colors[b.style] || ['#333', '#fff'];
      const tex = textTexture([b.label], { w: 256, h: 64, bg, fg, size: 40 });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(Math.min(2.4, W * 0.6), 0.4, 0.06), [toon(bg), toon(bg), toon(bg), toon(bg), new THREE.MeshBasicMaterial({ map: tex }), toon(bg)]);
      const sy = glassDoor ? 1.75 : Math.max(1.5, st.h - 0.35);
      sign.position.set(doorX, sy, front + 0.05);
      g.add(sign);
    }
    if (b.style === 'liga') {
      for (const px of [-W / 2 + 0.4, W / 2 - 0.4, -1.4, 1.4]) {
        add(new THREE.CylinderGeometry(0.2, 0.24, st.h, 12), texMat(TEX.plaster(), '#ffffff'), px, st.h / 2, front + 0.25);
        add(new THREE.BoxGeometry(0.5, 0.12, 0.5), trim, px, st.h - 0.05, front + 0.25);
      }
      add(new THREE.BoxGeometry(W + 0.2, 0.2, 0.7), trim, 0, st.h + 0.05, front + 0.2);
    }
    addOutline(g, 0.015);
    g.traverse(o => { if (o.isMesh && !o.userData.noOutline) { o.castShadow = true; o.receiveShadow = true; } });
    this.mapGroup.add(g);
  }

  // ------------------------------------------------ interiores
  buildInterior(map) {
    const FL = {
      wood: { tex: () => TEX.planks(), color: '#e0b080', s: 1, wall: ['#f4e8d2', '#ebdcc0', '#a8744a'] },
      tile: { tex: () => TEX.checker('#f6f8fc', '#d8e0ee'), color: '#ffffff', s: 0.5, wall: ['#eef4fa', '#e2ebf4', '#7aa6cc'] },
      stone: { tex: () => TEX.stone(), color: '#b8b0a2', s: 1, wall: null },
      pool: { tex: () => TEX.poolTile(), color: '#ffffff', s: 1, wall: ['#dcecf8', '#cce2f2', '#3a88c4'] },
      liga: { tex: () => TEX.checker('#f4ead4', '#d8c8a0'), color: '#ffffff', s: 0.5, wall: ['#c84444', '#b83a3a', '#5a1a1a'] },
      cave: { tex: () => TEX.stone(), color: '#6a6c7a', s: 1, wall: null, wallColor: '#5a5c6a' },
      // ginásios novos
      lava: { tex: () => TEX.stone(), color: '#c8785a', s: 1, wall: null, wallColor: '#8a4a36' },
      metal: { tex: () => TEX.checker('#c8ccd8', '#8a90a4'), color: '#ffffff', s: 0.5, wall: ['#5a6078', '#4e5470', '#f0c830'] },
      jungle: { tex: () => TEX.planks(), color: '#9ac080', s: 1, wall: ['#5a8a4a', '#4e7e42', '#3a5a2a'] },
      dark: { tex: () => TEX.stone(), color: '#5a5070', s: 1, wall: null, wallColor: '#3a3450' },
    };
    const fl = FL[map.floor] || FL.wood;
    const floor = new THREE.Mesh(boxW(this.W, 0.2, this.H, fl.s), texMat(fl.tex(), fl.color));
    floor.position.set((this.W - 1) / 2, -0.1, (this.H - 1) / 2);
    floor.receiveShadow = true;
    this.mapGroup.add(floor);
    const walls = [], counters = [], water = [];
    for (let z = 0; z < this.H; z++) for (let x = 0; x < this.W; x++) {
      const t = this.tile(x, z);
      if (t === '#') walls.push([x, z]);
      else if (t === 'W') water.push([x, z]);
      else if (t === 'C') counters.push([x, z]);
    }
    const wallMat = fl.wall ? texMat(TEX.wallpaper(...fl.wall), '#ffffff') : texMat(TEX.stone(), fl.wallColor || '#a89c8c');
    const exit = map.exit;
    for (const [x, z] of walls) {
      const south = z === this.H - 1;
      const h = south ? 0.25 : 2.2;
      const geo = fl.wall && !south ? new THREE.BoxGeometry(1, h, 1) : boxW(1, h, 1);
      const wm = new THREE.Mesh(geo, south ? toon(fl.wall ? fl.wall[2] : '#8a7e70') : wallMat);
      wm.position.set(x, h / 2, z);
      wm.receiveShadow = true;
      this.mapGroup.add(wm);
      // janelas e estandartes na parede do fundo
      if (z === 0 && x > 0 && x < this.W - 1 && x % 3 === 1 && map.floor !== 'cave') {
        const g = new THREE.Group();
        g.position.set(x, 1.4, 0.52);
        if (map.floor === 'stone' || map.floor === 'liga') {
          const ban = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.1), toon(map.floor === 'liga' ? '#e0b038' : '#8a3a3a', { side: THREE.DoubleSide }));
          const em = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), toon('#ffffff'));
          em.position.z = 0.01;
          g.add(ban, em);
        } else {
          const fr = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.62, 0.05), toon('#ffffff'));
          const gl = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.06), new THREE.MeshBasicMaterial({ color: '#bfe8ff' }));
          const cv = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.07), toon('#ffffff'));
          g.add(fr, gl, cv);
          for (const sx of [-1, 1]) {
            const cu = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.72, 0.05), toon(map.floor === 'wood' ? '#d86a5a' : '#6a9ad0'));
            cu.position.set(sx * 0.4, -0.02, 0.04);
            g.add(cu);
          }
        }
        this.mapGroup.add(g);
      }
    }
    const mat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.9), toon('#c83a3a'));
    mat.position.set(exit.x, 0.02, exit.z);
    this.mapGroup.add(mat);
    for (const [x, z] of counters) {
      const c = new THREE.Mesh(boxW(1, 0.8, 0.8), texMat(TEX.planks(), '#e87a6a'));
      c.position.set(x, 0.4, z);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.9), toon('#f8f8f8'));
      top.position.set(x, 0.84, z);
      c.castShadow = true; c.receiveShadow = true;
      this.mapGroup.add(c, top);
    }
    if (water.length) {
      const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 1), waterMaterial('#3aa6f0', 0.9), water.length);
      const m4 = new THREE.Matrix4();
      water.forEach(([x, z], i) => { m4.makeTranslation(x, 0.02, z); wm.setMatrixAt(i, m4); });
      this.mapGroup.add(wm);
    }
    for (const f of map.furniture || []) this.buildFurniture(f);
    // oclusão de ambiente "assada": escurece o piso encostado nas paredes
    const aoTex = TEX.aoStrip();
    const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, color: '#000000' });
    const addStrip = (x, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.7), aoMat);
      m.rotation.set(-Math.PI / 2, 0, ry);
      m.position.set(x, 0.012, z);
      m.renderOrder = 1;
      this.mapGroup.add(m);
    };
    for (let z = 1; z < this.H - 1; z++) for (let x = 1; x < this.W - 1; x++) {
      const t = this.tile(x, z);
      if (t === '#' || t === 'W') continue;
      if (this.tile(x, z - 1) === '#') addStrip(x, z - 0.15, 0);
      if (this.tile(x - 1, z) === '#') addStrip(x - 0.15, z, Math.PI / 2);
      if (this.tile(x + 1, z) === '#') addStrip(x + 0.15, z, -Math.PI / 2);
    }
  }

  buildFurniture(f) {
    const g = new THREE.Group();
    const w = f.w || 1, d = f.d || 1;
    g.position.set(f.x + (w - 1) / 2, 0, f.z + (d - 1) / 2);
    const add = (geo, color, pos, extra = {}) => {
      const m = new THREE.Mesh(geo, toon(color, extra));
      m.position.set(...pos);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      return m;
    };
    switch (f.type) {
      case 'table':
        add(new THREE.BoxGeometry(w - 0.1, 0.1, d - 0.1), '#a0643a', [0, 0.7, 0]);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.08, 0.7, 0.08), '#7a4a2a', [sx * (w / 2 - 0.15), 0.35, sz * (d / 2 - 0.15)]);
        break;
      case 'tv':
        add(new THREE.BoxGeometry(0.8, 0.4, 0.5), '#6a4a3a', [0, 0.2, 0]);
        add(new THREE.BoxGeometry(0.7, 0.5, 0.35), '#2a2a2a', [0, 0.65, 0]);
        add(new THREE.BoxGeometry(0.55, 0.38, 0.02), '#6ad0f0', [0, 0.66, 0.18], { emissive: '#3a90c0', emissiveIntensity: 0.5 });
        break;
      case 'bed':
        add(new THREE.BoxGeometry(0.9, 0.35, d - 0.1), '#8a5a3a', [0, 0.18, 0]);
        add(new THREE.BoxGeometry(0.85, 0.12, d - 0.2), '#e85a5a', [0, 0.41, 0.1]);
        add(new THREE.BoxGeometry(0.6, 0.12, 0.3), '#ffffff', [0, 0.45, -d / 2 + 0.3]);
        break;
      case 'shelf':
        add(new THREE.BoxGeometry(w - 0.05, 1.8, 0.5), '#8a5a3a', [0, 0.9, -0.2]);
        for (let i = 0; i < 3; i++) for (let j = 0; j < w * 3; j++) {
          const colors = ['#d04a4a', '#4a7ad0', '#4ab04a', '#e0b030', '#9a5ad0'];
          add(new THREE.BoxGeometry(0.22, 0.35, 0.3), colors[(i * 7 + j * 3) % 5], [-w / 2 + 0.2 + j * 0.3, 0.35 + i * 0.55, 0.02]);
        }
        break;
      case 'plant':
        add(new THREE.CylinderGeometry(0.18, 0.14, 0.35, 10), '#c8683a', [0, 0.18, 0]);
        add(new THREE.SphereGeometry(0.32, 10, 8), '#3a9a4a', [0, 0.6, 0]);
        break;
      case 'pc':
        add(new THREE.BoxGeometry(0.8, 0.7, 0.6), '#d8d8e0', [0, 0.35, 0]);
        add(new THREE.BoxGeometry(0.6, 0.45, 0.4), '#3a3a4a', [0, 0.95, 0]);
        add(new THREE.BoxGeometry(0.5, 0.35, 0.02), '#5af07a', [0, 0.95, 0.21], { emissive: '#2aa04a', emissiveIntensity: 0.6 });
        break;
      case 'machine':
        add(new THREE.BoxGeometry(w - 0.1, 0.9, 0.8), '#e0e0e8', [0, 0.45, 0]);
        for (let i = 0; i < 6; i++) add(new THREE.SphereGeometry(0.1, 10, 8), '#e03a3a', [-w / 2 + 0.25 + (i % 3) * ((w - 0.4) / 2), 0.98, -0.15 + Math.floor(i / 3) * 0.3]);
        break;
      case 'bench':
        add(new THREE.BoxGeometry(w - 0.1, 0.12, 0.6), '#c8904a', [0, 0.45, 0]);
        add(new THREE.BoxGeometry(w - 0.2, 0.45, 0.1), '#7a5a3a', [0, 0.22, 0]);
        break;
      case 'rug': case 'carpet':
        add(new THREE.BoxGeometry(w - 0.05, 0.03, d - 0.05), f.type === 'carpet' ? '#c02a2a' : '#5a8ad0', [0, 0.015, 0]);
        g.children[0].castShadow = false;
        break;
      case 'boulder':
        add(new THREE.DodecahedronGeometry(0.45, 0), '#8a8074', [0, 0.35, 0]);
        break;
      case 'brazier': {
        // braseiro com chama que tremula
        add(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 8), '#4a3a34', [0, 0.35, 0]);
        add(new THREE.CylinderGeometry(0.3, 0.18, 0.2, 10), '#6a4a3a', [0, 0.8, 0]);
        const fl = new THREE.Group(); fl.position.set(0, 0.9, 0);
        for (const [c, r, h] of [['#ff5a1a', 0.2, 0.55], ['#ffa02a', 0.14, 0.4], ['#ffe25a', 0.08, 0.25]]) {
          const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.92 }));
          m.position.y = h / 2; m.userData.noOutline = true; fl.add(m);
        }
        g.add(fl);
        const seed = Math.random() * 10;
        this.animated.push(t => { fl.scale.set(1 + Math.sin(t * 17 + seed) * 0.1, 1 + Math.sin(t * 13 + seed) * 0.2, 1 + Math.cos(t * 15 + seed) * 0.1); });
        break;
      }
      case 'coil': {
        // bobina elétrica com esfera que pisca
        add(new THREE.CylinderGeometry(0.22, 0.28, 0.25, 10), '#5a5e70', [0, 0.12, 0]);
        add(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 8), '#b8bcc8', [0, 0.75, 0]);
        for (let i = 0; i < 4; i++) add(new THREE.TorusGeometry(0.16 - i * 0.02, 0.025, 6, 16), '#c88a3a', [0, 0.45 + i * 0.18, 0]).rotation.x = Math.PI / 2;
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: '#fff080' }));
        orb.position.y = 1.4; orb.userData.noOutline = true; g.add(orb);
        const seed = Math.random() * 10;
        this.animated.push(t => { const k = Math.sin(t * 9 + seed) > 0.6 ? 1.35 : 1; orb.scale.setScalar(k); orb.material.color.set(k > 1 ? '#ffffff' : '#fff080'); });
        break;
      }
      case 'tree': {
        // árvore dentro do ginásio de planta
        add(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 8), '#6a4a2e', [0, 0.6, 0]);
        add(new THREE.IcosahedronGeometry(0.55, 1), '#2e8a3a', [0, 1.45, 0]);
        add(new THREE.IcosahedronGeometry(0.38, 1), '#48a848', [0.3, 1.25, 0.15]);
        add(new THREE.IcosahedronGeometry(0.34, 1), '#3a9a40', [-0.28, 1.3, -0.1]);
        break;
      }
      case 'lantern': {
        // lanterna de cristal roxo que pulsa
        add(new THREE.CylinderGeometry(0.1, 0.14, 0.9, 6), '#2a2438', [0, 0.45, 0]);
        const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: '#b080ff', transparent: true, opacity: 0.9 }));
        cr.position.y = 1.15; cr.userData.noOutline = true; g.add(cr);
        const seed = Math.random() * 10;
        this.animated.push(t => { cr.rotation.y = t * 0.8 + seed; cr.position.y = 1.15 + Math.sin(t * 2 + seed) * 0.06; cr.material.opacity = 0.65 + Math.sin(t * 3 + seed) * 0.25; });
        break;
      }
      case 'cactus':
        add(new THREE.CylinderGeometry(0.2, 0.18, 0.3, 10), '#c8683a', [0, 0.15, 0]);
        add(new THREE.CylinderGeometry(0.12, 0.14, 0.8, 8), '#4f8a44', [0, 0.7, 0]);
        add(new THREE.CylinderGeometry(0.07, 0.07, 0.35, 6), '#4f8a44', [0.18, 0.8, 0]).rotation.z = 0.6;
        break;
      case 'statue':
        add(new THREE.BoxGeometry(0.6, 0.4, 0.6), '#8a8a8a', [0, 0.2, 0]);
        add(new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8), '#b0b0b0', [0, 0.7, 0]);
        add(new THREE.SphereGeometry(0.28, 12, 10), '#e03a3a', [0, 1.15, 0]);
        break;
    }
    if (f.type !== 'rug' && f.type !== 'carpet') {
      const blob = blobShadow(1);
      blob.scale.set(w * 1.15, d * 1.15, 1);
      blob.position.y = 0.014;
      g.add(blob);
    }
    addOutline(g, 0.012);
    this.mapGroup.add(g);
  }

  // ------------------------------------------------ atualização
  update(dt, busy) {
    this.time += dt;
    shared.time.value = this.time;
    for (const fn of this.animated) fn(this.time);
    if (this.player) {
      this.player.update(dt);
      shared.player.value.copy(this.player.group.position);
      const key = this.player.x + ',' + this.player.z;
      if (this.lastTile && key !== this.lastTile && this.preset) {
        const [ox, oz] = this.lastTile.split(',').map(Number);
        if (this.tile(this.player.x, this.player.z) === 'G') this.ambient.puff(this.player.x, 0.35, this.player.z, this.preset.tall, 6, 0.7);
        else if (this.player.speed > 1.5) this.ambient.puff(ox, 0.06, oz, this.tile(ox, oz) === ',' ? this.preset.path : this.preset.grassLight, 3, 0.3);
      }
      this.lastTile = key;
      this.ambient.update(dt, this.player.group.position);
    }
    for (const a of this.npcs.values()) {
      a.update(dt);
      if (a.def.wander && a.visible && !busy && !a.moving) {
        a.wanderT -= dt;
        if (a.wanderT <= 0) {
          a.wanderT = 1.5 + Math.random() * 3;
          const dirs = Object.keys(DIRS);
          const d = dirs[Math.floor(Math.random() * 4)];
          const [dx, dz] = DIRS[d];
          const nx = a.x + dx, nz = a.z + dz;
          if (Math.random() < 0.5 && Math.abs(nx - a.home.x) <= 2 && Math.abs(nz - a.home.z) <= 2 && !this.blocked(nx, nz, a) && this.tile(nx, nz) !== 'G' && !this.isDoor(nx, nz)) a.startMove(d, 0.7);
          else a.face(d);
        }
      }
    }
    this.updateWilds(dt, busy);
    // câmera
    if (this.player) {
      const p = this.player.group.position;
      if (this.camMode === 'cima') {
        const off = this.map && this.map.interior ? new THREE.Vector3(0, 7.8, 6.0) : new THREE.Vector3(0, 8.4, 7.0);
        const target = p.clone().add(off);
        if (this.snapCamera) { this.camPos.copy(target); this.snapCamera = false; }
        this.camPos.lerp(target, Math.min(1, dt * 6));
        this.camera.position.copy(this.camPos);
        this.camera.lookAt(this.camPos.x, p.y + 0.4, this.camPos.z - off.z);
      } else {
        // terceira pessoa em órbita: o jogador gira a câmera com o mouse/dedo
        if (this.camYaw === undefined || this.snapCamera) {
          if (this.camYaw === undefined || this.resetYawOnLoad) this.camYaw = ROT[this.player.dir];
          this.resetYawOnLoad = false;
          this.camYawSmooth = this.camYaw;
        }
        let d = this.camYaw - this.camYawSmooth;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.camYawSmooth += d * Math.min(1, dt * 14);
        const yaw = this.camYawSmooth;
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const interior = this.map && this.map.interior;
        // se houver árvore ou parede logo atrás, aproxima e eleva a câmera
        let wall = false;
        for (let i = 1; i <= 3; i++) {
          const tx = Math.round(p.x - fx * i), tz = Math.round(p.z - fz * i);
          const t = this.tile(tx, tz);
          if (t === 'T' || t === '#' || this.buildingAt(tx, tz)) { wall = true; break; }
        }
        const baseR = (interior ? 4.0 : 5.4) * this.camZoom;
        const R = wall ? Math.min(baseR, interior ? 2.8 : 3.4) : baseR;
        const pitch = wall ? Math.max(this.camPitch, 0.95) : this.camPitch;
        if (this.camDist === undefined || this.snapCamera) { this.camDist = R; this.camPitchS = pitch; }
        const k = Math.min(1, dt * 5);
        this.camDist += (R - this.camDist) * k;
        this.camPitchS += (pitch - this.camPitchS) * k;
        const horiz = Math.cos(this.camPitchS) * this.camDist;
        const up = Math.sin(this.camPitchS) * this.camDist + 0.6;
        // leve deslocamento lateral (visão por cima do ombro)
        const side = interior ? 0.35 : 0.7;
        const target = new THREE.Vector3(p.x - fx * horiz + fz * side, p.y + up, p.z - fz * horiz - fx * side);
        if (this.snapCamera) { this.camPos.copy(target); this.snapCamera = false; }
        this.camPos.lerp(target, Math.min(1, dt * 12));
        this.camera.position.copy(this.camPos);
        const ahead = 2.2 * Math.max(0, 1 - this.camPitchS / 1.5);
        this.camera.lookAt(p.x + fx * ahead + fz * 0.25, p.y + 0.6, p.z + fz * ahead - fx * 0.25);
      }
      this.sun.position.set(p.x + this.sunDir.x * 30, this.sunDir.y * 30, p.z + this.sunDir.z * 30);
      this.fill.position.set(p.x - this.sunDir.x * 20, 12, p.z - this.sunDir.z * 20);
      this.fill.target.position.set(p.x, 0, p.z);
      this.sun.target.position.set(p.x, 0, p.z);
      if (this.preset && this.preset.lightning) {
        this.boltT = (this.boltT === undefined ? 5 : this.boltT) - dt;
        if (this.boltT <= 0) { this.boltT = 5 + Math.random() * 8; this.flash = 1; setTimeout(() => sfx('thunder'), 300 + Math.random() * 600); }
        this.flash = Math.max(0, (this.flash || 0) - dt * 3.5);
        this.hemi.intensity = this.preset.hemiI + this.flash * 2.6;
      }
      if (this.sky) {
        this.sky.position.copy(this.camera.position);
        if (this.sky.userData.clouds) this.sky.userData.clouds.rotation.y += dt * 0.004;
      }
    }
  }

  // controle de câmera pelo mouse / toque
  rotateCam(dx, dy) {
    if (this.camMode === 'cima') return;
    if (this.camYaw === undefined) this.camYaw = ROT[this.player.dir];
    this.camYaw -= dx * 0.005;
    this.camPitch = Math.max(0.12, Math.min(1.35, this.camPitch + dy * 0.004));
  }
  zoomCam(delta) {
    if (this.camMode === 'cima') return;
    this.camZoom = Math.max(0.5, Math.min(1.8, this.camZoom * (delta > 0 ? 1.1 : 1 / 1.1)));
  }
  // direção do mapa mais próxima de "para onde a câmera olha" (+ giro opcional)
  camDir(offset = 0) {
    let y = (this.camYaw === undefined ? ROT[this.player.dir] : this.camYaw) + offset;
    let best = 'down', bestD = 9;
    for (const [dir, r] of Object.entries(ROT)) {
      let d = Math.abs(((y - r) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (d < bestD) { bestD = d; best = dir; }
    }
    return best;
  }

  // ------------------------------------------------ criaturas selvagens no mapa
  initWilds() {
    this.wilds = [];
    this.grassTiles = [];
    if (!this.map.encounters) return;
    for (let z = 0; z < this.H; z++) for (let x = 0; x < this.W; x++) if (this.tile(x, z) === 'G') this.grassTiles.push([x, z]);
    this.wildTimer = 0.3;
    // já começa com alguns no mato
    const start = Math.min(3, this.wildCap());
    for (let i = 0; i < start; i++) this.spawnWild(true);
  }

  wildCap() { return Math.min(7, Math.max(2, Math.floor(this.grassTiles.length / 10))); }

  wildAt(x, z) { return this.wilds.find(w => w.x === x && w.z === z) || null; }

  spawnWild(instant) {
    const enc = this.map.encounters;
    if (!enc || !this.grassTiles.length) return;
    const p = this.player;
    for (let tries = 0; tries < 25; tries++) {
      const [x, z] = this.grassTiles[Math.floor(Math.random() * this.grassTiles.length)];
      if (Math.abs(x - p.x) + Math.abs(z - p.z) < 3 || this.blocked(x, z)) continue;
      const total = enc.list.reduce((a, e) => a + e[3], 0);
      let r = Math.random() * total, pick = enc.list[0];
      for (const e of enc.list) { r -= e[3]; if (r <= 0) { pick = e; break; } }
      const lvl = pick[1] + Math.floor(Math.random() * (pick[2] - pick[1] + 1));
      const sp = pick[0];
      const variant = Math.random();
      const model = makeCreature(SPECIES[sp].model, variant);
      const dirs = Object.keys(DIRS);
      const a = new Actor(this, model, x, z, dirs[Math.floor(Math.random() * 4)]);
      a.sp = sp; a.lvl = lvl; a.variant = variant;
      a.life = 40 + Math.random() * 40;
      a.moveT = 0.5 + Math.random() * 2;
      a.spawnT = instant ? 1 : 0;
      a.scaleBase = 0.95;
      a.hopT = Math.random() * 2;
      a.group.scale.setScalar(a.scaleBase * a.spawnT + 0.001);
      const tex = textTexture([`${SPECIES[sp].name}  Nv.${lvl}`], { w: 320, h: 64, bg: '#1e1a24', fg: '#ffffff', size: 30 });
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9, depthTest: false }));
      label.renderOrder = 998;
      label.scale.set(1.5, 0.3, 1);
      label.position.y = model.height + 0.55;
      label.visible = false;
      a.label = label;
      a.group.add(label);
      this.mapGroup.add(a.group);
      this.wilds.push(a);
      return a;
    }
    return null;
  }

  removeWild(w) {
    const i = this.wilds.indexOf(w);
    if (i >= 0) this.wilds.splice(i, 1);
    this.mapGroup.remove(w.group);
  }

  updateWilds(dt, busy) {
    if (!this.wilds || !this.grassTiles || !this.grassTiles.length) return;
    const p = this.player;
    if (!busy) {
      this.wildTimer -= dt;
      if (this.wildTimer <= 0) {
        this.wildTimer = 2 + Math.random() * 4;
        if (this.wilds.length < this.wildCap()) this.spawnWild(false);
      }
    }
    for (const w of [...this.wilds]) {
      w.update(dt);
      const s = w.scaleBase * (w.spawnT < 1 ? w.spawnT : 1);
      if (w.spawnT < 1) { w.spawnT = Math.min(1, w.spawnT + dt * 2.5); }
      w.group.scale.setScalar(Math.max(0.001, w.despawn ? w.scaleBase * Math.max(0, w.despawn) : s));
      // pulinhos para aparecer acima do mato alto
      w.hopT += dt;
      const idleHop = (w.hopT % 1.8) < 0.35 ? Math.sin(((w.hopT % 1.8) / 0.35) * Math.PI) * 0.35 : 0;
      w.group.position.y = w.moving ? Math.sin(w.t * Math.PI) * 0.3 : idleHop;
      const dist = Math.abs(w.x - p.x) + Math.abs(w.z - p.z);
      w.label.visible = dist <= 4;
      if (w.despawn !== undefined) {
        w.despawn -= dt * 2.5;
        if (w.despawn <= 0) this.removeWild(w);
        continue;
      }
      if (busy) continue;
      if (w.cooldown > 0) w.cooldown -= dt;
      w.life -= dt;
      if (w.life <= 0 && dist > 3 && !w.moving) { w.despawn = 1; continue; }
      if (w.moving) continue;
      w.moveT -= dt;
      if (w.moveT > 0) continue;
      w.moveT = 1 + Math.random() * 2.2;
      // se o herói estiver perto, a criatura fica curiosa e se aproxima
      let d;
      if (dist <= 3 && Math.random() < 0.6) {
        const dx = p.x - w.x, dz = p.z - w.z;
        d = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : (dz > 0 ? 'down' : 'up');
      } else d = Object.keys(DIRS)[Math.floor(Math.random() * 4)];
      const [dx, dz] = DIRS[d];
      const nx = w.x + dx, nz = w.z + dz;
      if (nx === p.x && nz === p.z) {
        w.face(d);
        if (!p.moving && !(w.cooldown > 0) && this.onWildContact) this.onWildContact(w);
        continue;
      }
      if (this.tile(nx, nz) === 'G' && !this.blocked(nx, nz, w)) w.startMove(d, 0.6);
      else w.face(d);
    }
  }

  // Linha de visão dos treinadores
  trainerSpotting(G) {
    const px = this.player.x, pz = this.player.z;
    for (const a of this.npcs.values()) {
      const d = a.def;
      if (!a.visible || !d.trainer || !d.sight || G.flag('tr_' + d.id)) continue;
      const [dx, dz] = DIRS[a.dir];
      for (let i = 1; i <= d.sight; i++) {
        const x = a.x + dx * i, z = a.z + dz * i;
        if (x === px && z === pz) return a;
        if (this.blocked(x, z, a)) break;
      }
    }
    return null;
  }
}
