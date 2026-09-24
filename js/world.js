// Mundo 3D: construção dos mapas, movimento em grade, NPCs e câmera.
import * as THREE from '../lib/three.module.min.js';
import { makeHuman, makeCreature, makeOrb, toon, textTexture, LOOKS, addOutline } from './models.js';
import { SPECIES } from './data.js';

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
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 50;
    this.sun.shadow.bias = -0.0015;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);
    this.npcs = new Map();
    this.player = null;
    this.camPos = new THREE.Vector3();
    this.time = 0;
    this.animated = [];
    this.wilds = [];
    this.camMode = 'terceira';
    this.onWildContact = null;
  }

  setPlayerModel(model) {
    this.player = new Actor(this, model, 0, 0, 'down');
    this.scene.add(this.player.group);
    this.player.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }

  // ------------------------------------------------ construção do mapa
  load(map, G) {
    this.map = map;
    this.W = map.rows[0].length;
    this.H = map.rows.length;
    // limpa
    this.scene.remove(this.mapGroup);
    this.mapGroup.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);
    for (const n of this.npcs.values()) this.scene.remove(n.group);
    this.npcs.clear();
    this.animated = [];
    this.blockExtra = new Set();

    const outdoor = !map.interior;
    if (outdoor) {
      const dark = map.dark;
      this.scene.background = new THREE.Color(dark ? 0x2a4a3a : 0x9fd8f5);
      this.scene.fog = new THREE.Fog(dark ? 0x2a4a3a : 0x9fd8f5, 16, 34);
      this.hemi.intensity = dark ? 0.75 : 1.1;
      this.sun.intensity = dark ? 0.9 : 1.6;
      this.buildOutdoor(map);
    } else {
      this.scene.background = new THREE.Color(0x0e0e14);
      this.scene.fog = null;
      this.hemi.intensity = 1.2;
      this.sun.intensity = 1.1;
      this.buildInterior(map);
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
  }

  addNpc(def, G) {
    let model;
    if (def.orb) {
      const g = makeOrb();
      g.position.y = 0.92;
      const wrap = new THREE.Group();
      wrap.add(g);
      model = { group: wrap };
    } else if (def.creature) {
      model = makeCreature(SPECIES[def.creature].model);
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
  buildOutdoor(map) {
    const PAD = 10;
    const ground = [], grass = [], trees = [], water = [], flowers = [], fences = [], rocks = [];
    const edgeTile = (x, z) => this.tile(Math.max(0, Math.min(this.W - 1, x)), Math.max(0, Math.min(this.H - 1, z)));
    for (let z = -PAD; z < this.H + PAD; z++) {
      for (let x = -PAD; x < this.W + PAD; x++) {
        const inside = x >= 0 && z >= 0 && x < this.W && z < this.H;
        let t = inside ? this.tile(x, z) : edgeTile(x, z);
        if (!inside && (t === '.' || t === 'G' || t === 'f' || t === 'S' || t === 'F' || t === 'R')) t = 'T';
        if (t === 'W') { water.push([x, z]); continue; }
        ground.push([x, z, t]);
        if (t === 'T') trees.push([x, z]);
        else if (t === 'G') grass.push([x, z]);
        else if (t === 'f') flowers.push([x, z]);
        else if (t === 'F') fences.push([x, z]);
        else if (t === 'R') rocks.push([x, z]);
      }
    }
    const dark = map.dark;
    const base = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), toon(dark ? '#24503a' : '#4f9a48'));
    base.rotation.x = -Math.PI / 2;
    base.position.set(this.W / 2, -0.32, this.H / 2);
    this.mapGroup.add(base);
    // chão
    const gGeo = new THREE.BoxGeometry(1, 0.3, 1);
    const gm = new THREE.InstancedMesh(gGeo, toon('#ffffff'), ground.length);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    ground.forEach(([x, z, t], i) => {
      m4.makeTranslation(x, -0.15, z);
      gm.setMatrixAt(i, m4);
      const v = hash(x, z) * 0.06;
      if (t === ',') col.setHSL(0.09, 0.45, 0.66 + v);
      else if (t === '=') col.setHSL(0.13, 0.55, 0.78 + v);
      else col.setHSL(dark ? 0.3 : 0.27, 0.5, (dark ? 0.32 : 0.47) + v);
      gm.setColorAt(i, col);
    });
    gm.receiveShadow = true;
    this.mapGroup.add(gm);

    // árvores
    if (trees.length) {
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 7), toon('#7a4e2a'), trees.length);
      const leaf1 = new THREE.InstancedMesh(new THREE.ConeGeometry(0.62, 1.1, 8), toon(dark ? '#2a6a3a' : '#3f9a48'), trees.length);
      const leaf2 = new THREE.InstancedMesh(new THREE.ConeGeometry(0.45, 0.9, 8), toon(dark ? '#357a44' : '#56b35a'), trees.length);
      const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      trees.forEach(([x, z], i) => {
        const h = hash(x + 11, z * 3);
        const sc = 0.85 + h * 0.35;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h * 6);
        s.set(sc, sc, sc);
        p.set(x, 0.35 * sc, z); m4.compose(p, q, s); trunk.setMatrixAt(i, m4);
        p.set(x, 1.05 * sc, z); m4.compose(p, q, s); leaf1.setMatrixAt(i, m4);
        p.set(x, 1.6 * sc, z); m4.compose(p, q, s); leaf2.setMatrixAt(i, m4);
      });
      for (const im of [trunk, leaf1, leaf2]) { im.castShadow = true; im.receiveShadow = true; this.mapGroup.add(im); }
    }
    // mato alto
    if (grass.length) {
      const per = 9;
      const gi = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.6, 5), toon(dark ? '#2e7a2e' : '#2f8f38'), grass.length * per);
      let k = 0;
      const q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
      for (const [x, z] of grass) for (let j = 0; j < per; j++) {
        const hx = hash(x * 7 + j, z) - 0.5, hz = hash(x, z * 5 + j) - 0.5;
        p.set(x + hx * 0.85, 0.27, z + hz * 0.85);
        q.setFromEuler(new THREE.Euler(hx * 0.4, 0, hz * 0.4));
        s.set(1, 0.8 + hash(j, x + z) * 0.5, 1);
        m4.compose(p, q, s); gi.setMatrixAt(k++, m4);
      }
      gi.castShadow = true;
      this.mapGroup.add(gi);
      this.grassMesh = gi;
    }
    // água
    if (water.length) {
      const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.1, 1), new THREE.MeshToonMaterial({ color: 0x3a9ae0, transparent: true, opacity: 0.88 }), water.length);
      const bed = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.1, 1), toon('#2a5a8a'), water.length);
      water.forEach(([x, z], i) => {
        m4.makeTranslation(x, -0.12, z); wm.setMatrixAt(i, m4);
        m4.makeTranslation(x, -0.35, z); bed.setMatrixAt(i, m4);
      });
      this.mapGroup.add(bed, wm);
      this.waterMat = wm.material;
      this.waterMesh = wm;
      this.waterTiles = water;
    }
    if (flowers.length) {
      const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 5), toon('#ffffff'), flowers.length * 4);
      let k = 0;
      const colors = ['#f05a7a', '#ffd23a', '#ffffff', '#b07af0'];
      for (const [x, z] of flowers) for (let j = 0; j < 4; j++) {
        m4.makeTranslation(x + (hash(x + j, z) - 0.5) * 0.7, 0.08, z + (hash(x, z + j) - 0.5) * 0.7);
        fl.setMatrixAt(k, m4);
        fl.setColorAt(k++, new THREE.Color(colors[(x + z + j) % 4]));
      }
      this.mapGroup.add(fl);
    }
    if (fences.length) {
      const post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), toon('#e8e0d0'), fences.length);
      const rail = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.08, 0.06), toon('#e8e0d0'), fences.length * 2);
      fences.forEach(([x, z], i) => {
        m4.makeTranslation(x, 0.3, z); post.setMatrixAt(i, m4);
        const horiz = this.tile(x - 1, z) === 'F' || this.tile(x + 1, z) === 'F';
        const r = new THREE.Matrix4().makeRotationY(horiz ? 0 : Math.PI / 2);
        m4.makeTranslation(x, 0.42, z).multiply(r); rail.setMatrixAt(i * 2, m4);
        m4.makeTranslation(x, 0.22, z).multiply(r); rail.setMatrixAt(i * 2 + 1, m4);
      });
      post.castShadow = rail.castShadow = true;
      this.mapGroup.add(post, rail);
    }
    if (rocks.length) {
      const rm = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.45, 0), toon('#9a9088', { flatShading: true }), rocks.length);
      rocks.forEach(([x, z], i) => { m4.makeTranslation(x, 0.3, z); rm.setMatrixAt(i, m4); });
      rm.castShadow = true;
      this.mapGroup.add(rm);
    }
  }

  buildSign(x, z) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), toon('#7a4e2a'));
    post.position.y = 0.3;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.08), toon('#c8904a'));
    board.position.y = 0.65;
    g.add(post, board);
    addOutline(g, 0.01);
    g.position.set(x, 0, z);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.mapGroup.add(g);
  }

  buildBuilding(b) {
    const g = new THREE.Group();
    const cx = b.x + (b.w - 1) / 2, cz = b.z + (b.d - 1) / 2;
    g.position.set(cx, 0, cz);
    const styles = {
      house: { wall: '#f4e8d0', h: 1.5, roof: b.roof || '#d84a3a', roofH: 1.2 },
      lab: { wall: '#f4f4f8', h: 1.7, roof: '#7a8a9a', roofH: 0.8 },
      center: { wall: '#fafafa', h: 1.7, roof: '#e04a4a', roofH: 1.0 },
      shop: { wall: '#fafafa', h: 1.6, roof: '#3a7ad8', roofH: 0.9 },
      gym: { wall: '#c8c0b0', h: 2.2, roof: b.roof || '#8a7a6a', roofH: 0.9 },
      liga: { wall: '#f0e8d8', h: 3.0, roof: '#d8a830', roofH: 1.8 },
    };
    const st = styles[b.style] || styles.house;
    const W = b.w - 0.1, D = b.d - 0.1;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(W, st.h, D), toon(st.wall));
    walls.position.y = st.h / 2;
    g.add(walls);
    const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.2, D + 0.1), toon('#8a8078'));
    base.position.y = 0.1;
    g.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1, st.roofH, 4), toon(st.roof, { flatShading: true }));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set((W + 0.5) / Math.SQRT2, 1, (D + 0.5) / Math.SQRT2);
    roof.position.y = st.h + st.roofH / 2;
    g.add(roof);
    const front = D / 2 + 0.01;
    // janelas
    const winMat = toon('#9ad0f0');
    const nWin = Math.max(1, Math.floor(b.w / 2));
    for (let i = 0; i < nWin; i++) {
      const wx = -W / 2 + (i + 0.5) * (W / nWin);
      const doorX = b.to ? (b.door - (b.w - 1) / 2) : 99;
      if (Math.abs(wx - doorX) < 0.7) continue;
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.05), winMat);
      win.position.set(wx, st.h * 0.6, front);
      g.add(win);
    }
    // porta
    const doorX = b.to ? b.door - (b.w - 1) / 2 : 0;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.05, 0.06), toon(b.style === 'center' || b.style === 'shop' ? '#6ab0e0' : '#6a4228'));
    door.position.set(doorX, 0.72, front);
    g.add(door);
    if (b.style === 'liga') {
      for (const px of [-W / 2 + 0.4, W / 2 - 0.4, -1.4, 1.4]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, st.h, 10), toon('#ffffff'));
        col.position.set(px, st.h / 2, front + 0.2);
        g.add(col);
      }
    }
    if (b.label) {
      const colors = { center: ['#e04a4a', '#fff'], shop: ['#3a7ad8', '#fff'], gym: ['#3a3a3a', '#ffd23a'], lab: ['#4a5a6a', '#fff'], liga: ['#8a1a1a', '#ffd23a'] };
      const [bg, fg] = colors[b.style] || ['#333', '#fff'];
      const tex = textTexture([b.label], { w: 256, h: 64, bg, fg, size: 40 });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(Math.min(2.4, W * 0.6), 0.4, 0.06), [toon(bg), toon(bg), toon(bg), toon(bg), new THREE.MeshBasicMaterial({ map: tex }), toon(bg)]);
      sign.position.set(doorX, 1.45 + (st.h - 1.5) * 0.6, front + 0.04);
      g.add(sign);
    }
    addOutline(g, 0.015);
    g.traverse(o => { if (o.isMesh && !o.userData.noOutline) { o.castShadow = true; o.receiveShadow = true; } });
    this.mapGroup.add(g);
  }

  // ------------------------------------------------ interiores
  buildInterior(map) {
    const floors = {
      wood: ['#c8945e', '#b88450'], tile: ['#eef0f6', '#d6dcea'], stone: ['#a09484', '#8e8474'],
      pool: ['#e6eef6', '#d0dfee'], liga: ['#e8dcc0', '#d8c8a8'],
    };
    const [fa, fb] = floors[map.floor] || floors.wood;
    const tiles = [], walls = [], counters = [], water = [];
    for (let z = 0; z < this.H; z++) for (let x = 0; x < this.W; x++) {
      const t = this.tile(x, z);
      if (t === '#') walls.push([x, z]);
      else if (t === 'W') water.push([x, z]);
      else { tiles.push([x, z]); if (t === 'C') counters.push([x, z]); }
    }
    const m4 = new THREE.Matrix4();
    const fm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.2, 1), toon('#ffffff'), tiles.length);
    const ca = new THREE.Color(fa), cb = new THREE.Color(fb);
    tiles.forEach(([x, z], i) => { m4.makeTranslation(x, -0.1, z); fm.setMatrixAt(i, m4); fm.setColorAt(i, (x + z) % 2 ? ca : cb); });
    fm.receiveShadow = true;
    this.mapGroup.add(fm);
    // paredes
    const wallCol = { wood: '#e8d8b8', tile: '#dfe8f0', stone: '#7a7064', pool: '#bcd8ee', liga: '#b83a3a' }[map.floor] || '#e8d8b8';
    const exit = map.exit;
    for (const [x, z] of walls) {
      const south = z === this.H - 1;
      const h = south ? 0.25 : 2.2;
      const wmesh = new THREE.Mesh(new THREE.BoxGeometry(1, h, 1), toon(wallCol));
      wmesh.position.set(x, h / 2, z);
      wmesh.receiveShadow = true;
      this.mapGroup.add(wmesh);
    }
    // tapete de saída
    const mat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.9), toon('#c83a3a'));
    mat.position.set(exit.x, 0.02, exit.z);
    this.mapGroup.add(mat);
    for (const [x, z] of counters) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 0.8), toon('#e86a6a'));
      c.position.set(x, 0.4, z);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.9), toon('#f4f4f4'));
      top.position.set(x, 0.84, z);
      c.castShadow = true;
      this.mapGroup.add(c, top);
    }
    if (water.length) {
      const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.1, 1), new THREE.MeshToonMaterial({ color: 0x3aa0f0, transparent: true, opacity: 0.85 }), water.length);
      water.forEach(([x, z], i) => { m4.makeTranslation(x, -0.15, z); wm.setMatrixAt(i, m4); });
      this.mapGroup.add(wm);
      this.waterMat = wm.material;
    }
    for (const f of map.furniture || []) this.buildFurniture(f);
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
        add(new THREE.DodecahedronGeometry(0.45, 0), '#8a8074', [0, 0.35, 0], { flatShading: true });
        break;
      case 'statue':
        add(new THREE.BoxGeometry(0.6, 0.4, 0.6), '#8a8a8a', [0, 0.2, 0]);
        add(new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8), '#b0b0b0', [0, 0.7, 0]);
        add(new THREE.SphereGeometry(0.28, 12, 10), '#e03a3a', [0, 1.15, 0]);
        break;
    }
    addOutline(g, 0.012);
    this.mapGroup.add(g);
  }

  // ------------------------------------------------ atualização
  update(dt, busy) {
    this.time += dt;
    if (this.player) this.player.update(dt);
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
    if (this.waterMat) {
      const s = Math.sin(this.time * 1.5) * 0.5 + 0.5;
      this.waterMat.color.setHSL(0.57, 0.7, 0.52 + s * 0.06);
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
        // terceira pessoa: a câmera fica atrás do herói e acompanha para onde ele olha
        const targetYaw = ROT[this.player.dir];
        if (this.camYaw === undefined || this.snapCamera) this.camYaw = targetYaw;
        let d = targetYaw - this.camYaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.camYaw += d * Math.min(1, dt * 5);
        const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
        const interior = this.map && this.map.interior;
        // se houver árvore ou parede logo atrás, aproxima e eleva a câmera
        let wall = false;
        for (let i = 1; i <= 3; i++) {
          const tx = Math.round(p.x - fx * i), tz = Math.round(p.z - fz * i);
          const t = this.tile(tx, tz);
          if (t === 'T' || t === '#' || this.buildingAt(tx, tz)) { wall = true; break; }
        }
        const dist = wall ? (interior ? 2.4 : 2.8) : (interior ? 3.4 : 4.6);
        const h = wall ? 4.4 : (interior ? 3.6 : 3.4);
        if (this.camDist === undefined || this.snapCamera) { this.camDist = dist; this.camH = h; }
        const k = Math.min(1, dt * 4);
        this.camDist += (dist - this.camDist) * k;
        this.camH += (h - this.camH) * k;
        // leve deslocamento lateral (visão por cima do ombro) para não esconder o que está à frente
        const side = interior ? 0.4 : 0.8;
        const target = new THREE.Vector3(p.x - fx * this.camDist + fz * side, p.y + this.camH, p.z - fz * this.camDist - fx * side);
        if (this.snapCamera) { this.camPos.copy(target); this.snapCamera = false; }
        this.camPos.lerp(target, Math.min(1, dt * 8));
        this.camera.position.copy(this.camPos);
        this.camera.lookAt(p.x + fx * 2.4 + fz * 0.3, p.y + 0.5, p.z + fz * 2.4 - fx * 0.3);
      }
      this.sun.position.set(p.x + 6, 14, p.z + 5);
      this.sun.target.position.set(p.x, 0, p.z);
    }
  }

  // ------------------------------------------------ Crescemon selvagens no mapa
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
      const model = makeCreature(SPECIES[sp].model);
      const dirs = Object.keys(DIRS);
      const a = new Actor(this, model, x, z, dirs[Math.floor(Math.random() * 4)]);
      a.sp = sp; a.lvl = lvl;
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
      // se o herói estiver perto, o Crescemon fica curioso e se aproxima
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
