// Sistema de batalha por turnos com cena 3D.
import * as THREE from '../lib/three.module.min.js';
import { SPECIES, MOVES, ITEMS, TYPES, typeMult } from './data.js';
import { createCreature, recalc, nameOf, xpForLevel, movesAtLevel } from './creature.js';
import { makeCreature, makeHuman, makeOrb, toon, LOOKS, HERO_LOOK, GRADIENT } from './models.js';
import { SKIES, shared, makeSky, makeMountains, plantTrees, plantTufts, tuftGeometry, waterMaterial, TEX, texMat, boxW, hash as ehash } from './env.js';
import { say, ask, list, hideDialog, hpColor, partyScreen, bagScreen, typeBadge } from './ui.js';
import { sfx, playMusic } from './audio.js';

const $ = s => document.querySelector(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
function animate(ms, fn) {
  return new Promise(res => {
    const t0 = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / ms);
      fn(t);
      if (t < 1) requestAnimationFrame(tick); else res();
    };
    requestAnimationFrame(tick);
  });
}
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const ALLY_POS = new THREE.Vector3(-1.5, 0, 2.0);
const FOE_POS = new THREE.Vector3(1.6, 0, -1.3);
const ALLY_ROT = 2.55;
const FOE_ROT = -0.55;

const BGS = {
  grass: { sky: 0xa8dcf8, ground: '#6ab85a', plat: '#8ad070', far: '#4a9a4a' },
  forest: { sky: 0x4a7a5a, ground: '#3a7a3a', plat: '#5a9a4a', far: '#2a5a3a' },
  beach: { sky: 0xb0e0ff, ground: '#f0dca0', plat: '#e8cc88', far: '#3a9ae0' },
  gym: { sky: 0x3a3430, ground: '#9a9084', plat: '#b8ae9e', far: '#6a6054' },
  pool: { sky: 0x2a4a6a, ground: '#bcd8ee', plat: '#e0ecf6', far: '#3aa0f0' },
  liga: { sky: 0x2a1a2a, ground: '#c89a4a', plat: '#e8c870', far: '#8a1a1a' },
  indoor: { sky: 0x303040, ground: '#c8b89a', plat: '#e0d4bc', far: '#8a7a6a' },
  cave: { sky: 0x0a0c16, ground: '#4a4c5a', plat: '#6a6c7a', far: '#2a2c3a' },
};

export class BattleScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.baseCam = new THREE.Vector3(0.2, 1.9, 6.4);
    this.lookTarget = new THREE.Vector3(0.3, 0.7, 0);
    this.camera.position.copy(this.baseCam);
    this.camera.lookAt(this.lookTarget);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x6a7a5a, 1.2);
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(3, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    this.scene.add(hemi, sun);
    this.env = new THREE.Group();
    this.scene.add(this.env);
    this.ally = null; this.foe = null;
    this.fx = new THREE.Group();
    this.scene.add(this.fx);
    this.shake = 0;
  }

  setup(bgName, skyName) {
    const bg = BGS[bgName] || BGS.grass;
    const outdoor = bgName === 'grass' || bgName === 'forest' || bgName === 'beach';
    this.scene.remove(this.env);
    this.env = new THREE.Group();
    this.scene.add(this.env);
    const hemi = this.scene.children.find(o => o.isHemisphereLight);
    const sun = this.scene.children.find(o => o.isDirectionalLight);
    if (outdoor) {
      const pr = SKIES[skyName] || SKIES[bgName === 'forest' ? 'forest' : bgName === 'beach' ? 'beach' : 'day'];
      this.scene.background = new THREE.Color(pr.fog);
      this.scene.fog = new THREE.Fog(pr.fog, 16, 70);
      hemi.color.set(pr.hemiSky); hemi.groundColor.set(pr.hemiGround); hemi.intensity = pr.hemiI * 1.1;
      sun.color.set(pr.sunLight); sun.intensity = pr.sunI;
      const sd = new THREE.Vector3(...pr.sunDir).normalize();
      if (sd.y < 0.4) sd.y = 0.4;
      sd.normalize();
      sun.position.set(sd.x * 12, sd.y * 12, Math.abs(sd.z) * 12 + 2);
      this.env.add(makeSky(pr));
      // chão com textura repetida
      const beach = bgName === 'beach';
      const t = (beach ? TEX.sandTile(pr) : TEX.grassTile(pr)).clone();
      t.repeat.set(26, 26);
      t.needsUpdate = true;
      const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshToonMaterial({ map: t, gradientMap: GRADIENT }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this.env.add(ground);
      if (beach) {
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 80), waterMaterial(pr.water, 1));
        sea.rotation.x = -Math.PI / 2;
        sea.position.set(0, 0.03, -48);
        this.env.add(sea);
      }
      // árvores ao fundo e nas laterais
      const trees = [];
      for (let i = 0; i < 46; i++) {
        const a = -2.5 + (i / 45) * 5 + (ehash(i, 3) - 0.5) * 0.1;
        const r = 10 + ehash(i, 7) * 9 + (Math.abs(a) > 1.4 ? -2 : 0);
        const x = Math.sin(a) * r, z = -Math.cos(a) * r * 0.75 - 3;
        if (beach && z < -8) continue;
        const kinds = Object.entries(pr.kinds);
        let rr = ehash(i * 5, 11), kind = kinds[0][0];
        for (const [k, w] of kinds) { rr -= w; if (rr <= 0) { kind = k; break; } }
        trees.push({ x, y: 0, z, s: 1.1 + ehash(i, 1) * 0.6, r: ehash(i, 2) * 6, kind });
      }
      this.env.add(plantTrees(trees, pr, { shadows: false }));
      const tufts = [];
      for (let i = 0; i < 160; i++) {
        const x = (ehash(i, 21) - 0.5) * 22, z = (ehash(i, 37) - 0.5) * 16 - 1;
        if (Math.hypot(x - ALLY_POS.x, z - ALLY_POS.z) < 1.5 || Math.hypot(x - FOE_POS.x, z - FOE_POS.z) < 1.4) continue;
        if (z > 0.8) continue;
        tufts.push({ x, z, s: 0.8 + ehash(i, 5) * 0.8, r: ehash(i, 9) * 6 });
      }
      if (!beach) this.env.add(plantTufts(tufts, tuftGeometry(0.34, 7, pr.grassDark, pr.grassLight), { amp: 0.12 }));
      this.env.add(makeMountains(0, -6, 26, pr, 7));
    } else {
      this.scene.background = new THREE.Color(bg.sky);
      this.scene.fog = new THREE.Fog(bg.sky, 14, 40);
      hemi.color.set('#fff6ea'); hemi.groundColor.set('#6a5a4a'); hemi.intensity = 1.2;
      sun.color.set('#fff0dc'); sun.intensity = 1.4;
      sun.position.set(3, 8, 5);
      const floorTex = bgName === 'pool' ? TEX.poolTile() : bgName === 'liga' ? TEX.checker('#f4ead4', '#d8c8a0') : TEX.stone();
      const floor = new THREE.Mesh(boxW(40, 0.2, 30, bgName === 'liga' ? 0.5 : 1), texMat(floorTex, bgName === 'gym' ? '#b8ae9e' : '#ffffff'));
      floor.position.set(0, -0.1, -5);
      floor.receiveShadow = true;
      this.env.add(floor);
      const wall = new THREE.Mesh(boxW(40, 9, 1), texMat(TEX.stone(), bgName === 'liga' ? '#b84a4a' : bgName === 'pool' ? '#9ac8e8' : bgName === 'cave' ? '#4a4c5c' : '#9a9084'));
      wall.position.set(0, 4.5, -11);
      this.env.add(wall);
      for (let i = -4; i <= 4; i++) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 9, 14), texMat(TEX.plaster(), bgName === 'liga' ? '#f4e2b0' : '#c8c0b0'));
        col.position.set(i * 4.2, 4.5, -10.2);
        this.env.add(col);
        if (i % 2 === 0 && i !== 0) {
          const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.2), toon(bgName === 'liga' ? '#e0b038' : bgName === 'pool' ? '#3a8ad0' : '#8a3a3a', { side: THREE.DoubleSide }));
          ban.position.set(i * 4.2 + 2.1, 5.5, -10.45);
          const em = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), toon('#ffffff'));
          em.position.set(i * 4.2 + 2.1, 5.9, -10.4);
          this.env.add(ban, em);
        }
      }
      if (bgName === 'pool') {
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(26, 6), waterMaterial('#3aa6f0', 0.95));
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(0, 0.02, -7);
        this.env.add(pool);
      }
      if (bgName === 'liga') {
        const carpet = new THREE.Mesh(new THREE.BoxGeometry(3, 0.03, 30), toon('#b82a2a'));
        carpet.position.set(0.1, 0.015, -3);
        this.env.add(carpet);
      }
      for (const sx of [-1, 1]) {
        const lamp = new THREE.PointLight('#ffe0b0', 20, 20, 1.5);
        lamp.position.set(sx * 6, 5, -4);
        this.env.add(lamp);
      }
    }
    for (const [pp, r] of [[ALLY_POS, 1.25], [FOE_POS, 1.15]]) {
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.06, 0.14, 40), outdoor ? toon(bg.plat) : texMat(TEX.stone(), '#d8d0c4'));
      plat.position.set(pp.x, 0.07, pp.z);
      plat.receiveShadow = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 48), toon('#ffffff'));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(pp.x, 0.14, pp.z);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(r * 0.55, 0.025, 6, 40), toon('#ffffff'));
      inner.rotation.x = Math.PI / 2;
      inner.position.set(pp.x, 0.145, pp.z);
      this.env.add(plat, ring, inner);
    }
    this.clear();
  }

  clear() {
    for (const k of ['ally', 'foe', 'trainerModel', 'heroModel']) {
      if (this[k]) { this.scene.remove(this[k].group); this[k] = null; }
    }
    this.fx.clear();
  }

  placeCreature(side, c) {
    if (this[side]) this.scene.remove(this[side].group);
    const m = makeCreature(SPECIES[c.sp].model);
    const p = side === 'ally' ? ALLY_POS : FOE_POS;
    m.group.position.set(p.x, 0.12, p.z);
    m.group.rotation.y = side === 'ally' ? ALLY_ROT : FOE_ROT;
    // criaturas muito grandes (lendários) são reduzidas para caber na tela
    const h = new THREE.Box3().setFromObject(m.group).getSize(new THREE.Vector3()).y;
    m.group.userData.baseScale = side === 'ally' ? Math.min(0.85, 1.9 / h) : Math.min(1.2, 2.2 / h);
    m.group.scale.setScalar(m.group.userData.baseScale);
    this.scene.add(m.group);
    this[side] = m;
    return m;
  }

  update(dt) {
    shared.time.value += dt;
    for (const k of ['ally', 'foe', 'trainerModel', 'heroModel']) if (this[k] && this[k].update) this[k].update(dt, false);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      this.camera.position.set(this.baseCam.x + (Math.random() - 0.5) * this.shake * 0.5, this.baseCam.y + (Math.random() - 0.5) * this.shake * 0.3, this.baseCam.z);
    } else this.camera.position.copy(this.baseCam);
    this.camera.lookAt(this.lookTarget);
    for (const p of [...this.fx.children]) {
      if (p.userData.vel) {
        p.position.addScaledVector(p.userData.vel, dt);
        p.userData.life -= dt;
        p.material.opacity = Math.max(0, p.userData.life);
        if (p.userData.life <= 0) this.fx.remove(p);
      }
    }
  }

  async introTrainer(look) {
    const t = makeHuman(LOOKS[look] || {});
    t.group.position.set(FOE_POS.x + 0.2, 0.12, FOE_POS.z);
    t.group.rotation.y = -0.4;
    t.group.scale.setScalar(1.25);
    this.scene.add(t.group);
    this.trainerModel = t;
    await animate(500, k => { t.group.position.x = FOE_POS.x + 6 * (1 - ease(k)); });
  }

  async trainerLeave() {
    const t = this.trainerModel;
    if (!t) return;
    await animate(400, k => { t.group.position.x = FOE_POS.x + 0.2 + k * 5; });
    this.scene.remove(t.group);
    this.trainerModel = null;
  }

  async trainerReturn() {
    if (!this.lastTrainerLook) return;
    await this.introTrainer(this.lastTrainerLook);
  }

  async introHero() {
    const h = makeHuman(HERO_LOOK);
    h.group.position.set(ALLY_POS.x - 0.3, 0.12, ALLY_POS.z + 0.6);
    h.group.rotation.y = ALLY_ROT;
    h.group.scale.setScalar(1.3);
    this.scene.add(h.group);
    this.heroModel = h;
    await animate(450, k => { h.group.position.x = ALLY_POS.x - 0.3 - 5 * (1 - ease(k)); });
  }

  async heroLeave() {
    const h = this.heroModel;
    if (!h) return;
    h.pose('throw');
    await wait(150);
    h.pose('rest');
    await animate(350, k => { h.group.position.x = ALLY_POS.x - 0.3 - k * 5; });
    this.scene.remove(h.group);
    this.heroModel = null;
  }

  async sendOut(side, c) {
    const p = side === 'ally' ? ALLY_POS : FOE_POS;
    const orb = makeOrb();
    const from = side === 'ally' ? new THREE.Vector3(p.x - 1.5, 1.2, p.z + 1.2) : new THREE.Vector3(p.x + 1.2, 1.4, p.z - 0.5);
    this.fx.add(orb);
    sfx('throw');
    await animate(350, k => {
      orb.position.lerpVectors(from, new THREE.Vector3(p.x, 0.4, p.z), k);
      orb.position.y += Math.sin(k * Math.PI) * 1.2;
      orb.rotation.x = k * 10;
    });
    this.fx.remove(orb);
    this.burst(new THREE.Vector3(p.x, 0.5, p.z), '#ffffff', 14);
    const m = this.placeCreature(side, c);
    m.group.scale.setScalar(0.01);
    const bsc = m.group.userData.baseScale || 1;
    await animate(280, k => m.group.scale.setScalar(Math.max(0.01, ease(k) * bsc)));
    sfx('cry');
  }

  async recall(side) {
    const m = this[side];
    if (!m) return;
    const bsc = m.group.userData.baseScale || 1;
    await animate(250, k => m.group.scale.setScalar(Math.max(0.01, (1 - k) * bsc)));
    this.scene.remove(m.group);
    this[side] = null;
  }

  burst(pos, color, n = 10, up = false) {
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color, transparent: true }));
      p.position.copy(pos);
      const v = up ? new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.5 + Math.random(), (Math.random() - 0.5) * 0.8)
        : new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3);
      p.userData = { vel: v, life: 0.8 };
      this.fx.add(p);
    }
  }

  async attackAnim(side, move) {
    const me = this[side], target = this[side === 'ally' ? 'foe' : 'ally'];
    if (!me) return;
    const from = me.group.position.clone();
    const to = (side === 'ally' ? FOE_POS : ALLY_POS).clone();
    const mv = MOVES[move];
    const projTypes = ['fogo', 'agua', 'planta', 'eletrico', 'sombra', 'pedra'];
    if (mv.cat === 'status') {
      await animate(300, k => { me.group.position.y = 0.12 + Math.sin(k * Math.PI) * 0.3; });
      return;
    }
    if (projTypes.includes(mv.type)) {
      await animate(160, k => { me.group.position.lerpVectors(from, from.clone().lerp(to, 0.12), Math.sin(k * Math.PI)); });
      const col = TYPES[mv.type].color;
      const n = mv.pow >= 80 ? 6 : 3;
      const shots = [];
      for (let i = 0; i < n; i++) {
        const b = new THREE.Mesh(mv.type === 'pedra' ? new THREE.DodecahedronGeometry(0.16, 0) : new THREE.SphereGeometry(0.14, 10, 8),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95 }));
        this.fx.add(b);
        shots.push(b);
      }
      const start = from.clone().add(new THREE.Vector3(0, 0.6, 0));
      const end = to.clone().add(new THREE.Vector3(0, 0.6, 0));
      await animate(380, k => {
        shots.forEach((b, i) => {
          const kk = Math.max(0, Math.min(1, k * 1.3 - i * 0.06));
          b.position.lerpVectors(start, end, kk);
          b.position.y += Math.sin(kk * Math.PI) * (mv.type === 'pedra' ? 1 : 0.3) + Math.sin(i * 2 + k * 20) * 0.08;
          b.visible = kk > 0 && kk < 1;
        });
      });
      shots.forEach(b => this.fx.remove(b));
      this.burst(end, col, 12);
    } else {
      await animate(260, k => { me.group.position.lerpVectors(from, from.clone().lerp(to, 0.7), Math.sin(k * Math.PI)); });
    }
    me.group.position.copy(from);
    if (target) void 0;
  }

  async hitAnim(side, strong) {
    const m = this[side];
    if (!m) return;
    sfx(strong === 2 ? 'superhit' : strong === 0 ? 'weakhit' : 'hit');
    this.shake = strong === 2 ? 0.5 : 0.25;
    for (let i = 0; i < 4; i++) { m.group.visible = false; await wait(60); m.group.visible = true; await wait(60); }
  }

  async faintAnim(side) {
    const m = this[side];
    if (!m) return;
    sfx('faint');
    const y0 = m.group.position.y;
    const bsc = m.group.userData.baseScale || 1;
    await animate(500, k => { m.group.position.y = y0 - k * 1.2; m.group.scale.setScalar(Math.max(0.01, (1 - k * 0.6) * bsc)); });
    this.scene.remove(m.group);
    this[side] = null;
  }

  async statAnim(side, up) {
    const m = this[side];
    if (!m) return;
    sfx(up ? 'stat' : 'statdown');
    const p = m.group.position.clone();
    for (let i = 0; i < 3; i++) {
      this.burst(p.clone().add(new THREE.Vector3(0, up ? 0.1 : 1.4, 0)), up ? '#ff8a3a' : '#5a8aff', 8, up);
      await wait(120);
    }
  }

  async healAnim(side) {
    const m = this[side];
    if (!m) return;
    sfx('heal');
    this.burst(m.group.position.clone().add(new THREE.Vector3(0, 0.2, 0)), '#7af0a0', 16, true);
    await wait(500);
  }

  async throwBall(color, shakes, success) {
    const orb = makeOrb(color);
    this.fx.add(orb);
    const from = new THREE.Vector3(-2.5, 1, 3.5);
    const top = FOE_POS.clone().add(new THREE.Vector3(0, 1.2, 0));
    sfx('throw');
    await animate(500, k => {
      orb.position.lerpVectors(from, top, k);
      orb.position.y += Math.sin(k * Math.PI) * 1.5;
      orb.rotation.x = k * 12;
    });
    orb.rotation.set(0, FOE_ROT, 0);
    const m = this.foe;
    this.burst(top, '#ffffff', 16);
    const bsc = m ? (m.group.userData.baseScale || 1) : 1;
    if (m) await animate(300, k => { m.group.scale.setScalar(Math.max(0.01, (1 - k) * bsc)); m.group.position.y = 0.12 + k * 1.1; });
    if (m) m.group.visible = false;
    await animate(300, k => { orb.position.y = 1.32 - k * 1.2 + Math.abs(Math.sin(k * Math.PI * 2)) * 0.2 * (1 - k); });
    for (let i = 0; i < shakes; i++) {
      await wait(350);
      sfx('shake');
      await animate(400, k => { orb.rotation.z = Math.sin(k * Math.PI * 2) * 0.5; });
    }
    await wait(300);
    if (success) {
      sfx('catch');
      this.burst(orb.position.clone(), '#ffe04a', 12, true);
      await wait(600);
      this.orbLeft = orb;
      return;
    }
    this.fx.remove(orb);
    this.burst(orb.position.clone(), '#ffffff', 16);
    if (m) {
      m.group.visible = true;
      m.group.position.y = 0.12;
      await animate(250, k => m.group.scale.setScalar(Math.max(0.01, k * bsc)));
    }
  }
}

// ======================================================= LÓGICA
const STAGE = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
const STAT_NAMES = { atk: 'O ATAQUE', def: 'A DEFESA', spd: 'A VELOCIDADE' };

export class Battle {
  constructor(G, bs) {
    this.G = G;
    this.bs = bs;
  }

  hudHtml(side, c, showNums) {
    const p = Math.max(0, c.hp / c.maxhp);
    const next = xpForLevel(c.lvl + 1), cur = xpForLevel(c.lvl);
    const xp = Math.max(0, Math.min(1, (c.xp - cur) / Math.max(1, next - cur)));
    return `<div class="hud-name">${nameOf(c)}${this.G.state.caught[c.sp] && side === 'foe' && !this.trainer ? ' <span class="caught">●</span>' : ''}<span>Nv. ${c.lvl}</span></div>
      <div class="hpwrap"><b>PV</b><div class="hpbar"><i style="width:${p * 100}%;background:${hpColor(p)}"></i></div></div>
      ${showNums ? `<div class="hpnum">${Math.max(0, Math.ceil(c.hp))} / ${c.maxhp}</div><div class="xpbar"><i style="width:${xp * 100}%"></i></div>` : ''}`;
  }

  renderHud() {
    const f = $('#hud-foe'), a = $('#hud-ally');
    if (this.foe && this.foeShown) { f.innerHTML = this.hudHtml('foe', this.foe, false); f.classList.remove('hidden'); } else f.classList.add('hidden');
    if (this.ally && this.allyShown) { a.innerHTML = this.hudHtml('ally', this.ally, true); a.classList.remove('hidden'); } else a.classList.add('hidden');
    const balls = $('#hud-balls');
    if (this.trainer) {
      balls.innerHTML = this.foeParty.map(c => `<i class="${c.hp > 0 ? '' : 'out'}"></i>`).join('');
      balls.classList.remove('hidden');
    } else balls.classList.add('hidden');
  }

  async animateHp(c, to) {
    const from = c.hp;
    to = Math.max(0, Math.min(c.maxhp, to));
    const ms = Math.min(900, 200 + Math.abs(from - to) * 25);
    await animate(ms, k => { c.hp = from + (to - from) * k; this.renderHud(); });
    c.hp = Math.round(to);
    this.renderHud();
  }

  msg(t, name) { return say(t, name, { fast: false }); }

  // opts: { wild: creature } ou { trainer: {name, look, party:[creature], money, lose, winText, canLose} }
  async run(opts) {
    const G = this.G, bs = this.bs;
    this.trainer = opts.trainer || null;
    this.legendary = !!opts.legendary;
    this.foeParty = this.trainer ? this.trainer.party : [opts.wild];
    this.foe = this.foeParty[0];
    this.party = G.state.party;
    this.ally = this.party.find(c => c.hp > 0);
    this.stages = { ally: { atk: 0, def: 0, spd: 0 }, foe: { atk: 0, def: 0, spd: 0 } };
    this.participants = new Set();
    this.foeShown = false; this.allyShown = false;
    this.escapes = 0;
    this.pendingEvos = G.pendingEvos || new Set();

    bs.setup(G.battleBg(), G.battleSky ? G.battleSky() : null);
    bs.lastTrainerLook = this.trainer ? this.trainer.look : null;
    playMusic(this.trainer ? (this.trainer.leader || this.trainer.rival ? 'gym' : 'trainer') : 'battle');
    $('#battle-ui').classList.remove('hidden');
    this.renderHud();

    // introdução
    if (this.trainer) {
      await bs.introTrainer(this.trainer.look);
      await bs.introHero();
      await this.msg(`${this.trainer.name} quer batalhar!`);
      await bs.trainerLeave();
      await this.msg(`${this.trainer.name} enviou ${nameOf(this.foe)}!`);
      await bs.sendOut('foe', this.foe);
    } else {
      bs.placeCreature('foe', this.foe);
      sfx('cry');
      await bs.introHero();
      await this.msg(this.legendary ? `O lendário ${nameOf(this.foe)} apareceu!` : `Um ${nameOf(this.foe)} selvagem apareceu!`);
    }
    G.seen(this.foe.sp);
    this.foeShown = true;
    this.renderHud();
    await this.msg(`Vai, ${nameOf(this.ally)}!`);
    await bs.heroLeave();
    await bs.sendOut('ally', this.ally);
    this.allyShown = true;
    this.participants.add(this.ally);
    this.renderHud();

    let result = null;
    while (!result) result = await this.turn();

    // fim
    hideDialog();
    await this.finish(result);
    $('#battle-ui').classList.add('hidden');
    $('#battle-menu').classList.add('hidden');
    bs.clear();
    return result;
  }

  async finish(result) {
    const G = this.G;
    if (result === 'win' && this.trainer) {
      playMusic('victory');
      await this.bs.trainerReturn();
      await this.msg(`Você venceu ${this.trainer.name}!`);
      if (this.trainer.lose) await this.msg(this.trainer.lose, this.trainer.name);
      const money = this.trainer.money || 100;
      G.state.money += money;
      await this.msg(`{N} ganhou ₢${money} pela vitória!`);
    } else if (result === 'win') {
      playMusic('victory');
    } else if (result === 'lose') {
      if (this.trainer && this.trainer.winText) await this.msg(this.trainer.winText, this.trainer.name);
      if (!(this.trainer && this.trainer.canLose)) {
        await this.msg('{N} não tem mais Crescemon em condições de lutar!');
        const lost = Math.floor(G.state.money / 2);
        G.state.money -= lost;
        await this.msg(`{N} entrou em pânico e perdeu ₢${lost}... Tudo ficou escuro!`);
      }
    }
    // evoluções
    for (const c of this.party) {
      if (c.hp <= 0) continue;
      const evo = SPECIES[c.sp].evo;
      if (evo && c.lvl >= evo.lvl && this.pendingEvos.has(c.uid)) await this.evolve(c, evo.to);
    }
    this.pendingEvos.clear();
  }

  async evolve(c, to) {
    const bs = this.bs, G = this.G;
    bs.clear();
    $('#hud-foe').classList.add('hidden');
    $('#hud-ally').classList.add('hidden');
    $('#hud-balls').classList.add('hidden');
    const oldName = nameOf(c);
    await this.msg(`O quê? ${oldName} está evoluindo!`);
    sfx('evolve');
    const center = new THREE.Vector3(0, 0.12, 1.2);
    const a = makeCreature(SPECIES[c.sp].model);
    const b = makeCreature(SPECIES[to].model);
    for (const m of [a, b]) { m.group.position.copy(center); m.group.rotation.y = -0.3; bs.scene.add(m.group); }
    b.group.visible = false;
    bs.ally = a;
    for (let i = 0; i < 14; i++) {
      const d = Math.max(60, 320 - i * 20);
      a.group.visible = i % 2 === 0; b.group.visible = !a.group.visible;
      if (i % 3 === 0) bs.burst(center.clone().add(new THREE.Vector3(0, 0.8, 0)), '#ffffff', 6);
      await wait(d);
    }
    bs.scene.remove(a.group);
    b.group.visible = true;
    bs.ally = b;
    bs.burst(center.clone().add(new THREE.Vector3(0, 0.8, 0)), '#ffe060', 24, true);
    c.sp = to;
    recalc(c);
    G.seen(to); G.caught(to);
    sfx('fanfare');
    await this.msg(`Parabéns! ${oldName} evoluiu para ${SPECIES[to].name}!`);
    for (const mv of movesAtLevel(to, c.lvl)) await this.learnMove(c, mv);
    bs.scene.remove(b.group);
    bs.ally = null;
  }

  // ---------------------------------------------- turno
  async turn() {
    const action = await this.chooseAction();
    if (action.type === 'run') {
      if (this.trainer) { await this.msg('Não dá para fugir de uma batalha de treinador!'); return null; }
      this.escapes++;
      const chance = this.legendary ? 0.5 : (this.ally.spd * 32 / Math.max(1, this.foe.spd) + 30 * this.escapes) / 255 + 0.35;
      if (Math.random() < chance) {
        sfx('run');
        await this.msg('Você fugiu em segurança!');
        return 'fled';
      }
      await this.msg('Não conseguiu fugir!');
      return await this.foeOnly();
    }
    if (action.type === 'switch') {
      await this.msg(`${nameOf(this.ally)}, volte!`);
      await this.bs.recall('ally');
      this.ally = action.target;
      this.stages.ally = { atk: 0, def: 0, spd: 0 };
      this.participants.add(this.ally);
      await this.msg(`Vai, ${nameOf(this.ally)}!`);
      await this.bs.sendOut('ally', this.ally);
      this.renderHud();
      return await this.foeOnly();
    }
    if (action.type === 'item') {
      const r = await this.useItem(action.item, action.target);
      if (r) return r;
      return await this.foeOnly();
    }
    // golpes
    const foeMove = this.aiMove();
    const am = MOVES[action.move], fm = MOVES[foeMove];
    const ap = am.pri || 0, fp = fm.pri || 0;
    const aspd = this.ally.spd * STAGE(this.stages.ally.spd), fspd = this.foe.spd * STAGE(this.stages.foe.spd);
    const allyFirst = ap !== fp ? ap > fp : (aspd !== fspd ? aspd > fspd : Math.random() < 0.5);
    const order = allyFirst ? [['ally', action.move], ['foe', foeMove]] : [['foe', foeMove], ['ally', action.move]];
    for (const [side, mv] of order) {
      const user = side === 'ally' ? this.ally : this.foe;
      if (user.hp <= 0) continue;
      await this.doMove(side, mv);
      const r = await this.checkFaints();
      if (r === 'end') return this.endResult;
      if (r === 'switched') break;
    }
    return null;
  }

  async foeOnly() {
    await this.doMove('foe', this.aiMove());
    const r = await this.checkFaints();
    return r === 'end' ? this.endResult : null;
  }

  async chooseAction() {
    const menu = $('#battle-menu');
    while (true) {
      hideDialog();
      const opts = ['LUTAR', 'BOLSA', 'EQUIPE', 'FUGIR'].map(t => ({ html: t, cls: 'act' }));
      const r = await list(menu, opts, { cols: 2, cancel: false, start: this.lastAct || 0, title: `O que ${nameOf(this.ally)} vai fazer?` });
      this.lastAct = r;
      if (r === 0) {
        const usable = this.ally.moves.filter(m => m.pp > 0);
        if (!usable.length) {
          await this.msg(`${nameOf(this.ally)} não tem mais PP!`);
          return { type: 'move', move: 'desesperada' };
        }
        const items = this.ally.moves.map(m => {
          const mv = MOVES[m.id];
          return { html: `<b>${mv.name}</b><small>${TYPES[mv.type].name} · PP ${m.pp}/${mv.pp}</small>`, disabled: m.pp <= 0, cls: 'mvbtn', style: `--tc:${TYPES[mv.type].color}` };
        });
        const mi = await list(menu, items, {
          cols: 2, title: 'Escolha um golpe',
          desc: i => {
            const mv = MOVES[this.ally.moves[i].id];
            if (mv.cat === 'status') return `${typeBadge(mv.type)} Golpe de status`;
            const eff = typeMult(mv.type, SPECIES[this.foe.sp].types);
            const t = eff > 1 ? '<b class="se">Super eficaz!</b>' : eff < 1 ? (eff === 0 ? 'Sem efeito' : 'Pouco eficaz') : '';
            return `${typeBadge(mv.type)} Poder ${mv.pow} · Precisão ${mv.acc}% ${t}`;
          },
        });
        if (mi < 0) continue;
        const slot = this.ally.moves[mi];
        slot.pp--;
        hideDialog();
        return { type: 'move', move: slot.id };
      }
      if (r === 1) {
        hideDialog();
        const id = await bagScreen(this.G.state.bag, id => ITEMS[id].use !== 'key');
        if (!id) continue;
        const it = ITEMS[id];
        if (it.use === 'ball') {
          if (this.trainer) { await this.msg('Não é possível capturar o Crescemon de outro treinador!'); continue; }
          return { type: 'item', item: id };
        }
        const t = await partyScreen(this.party, { title: `Usar ${it.name} em...`, hint: 'Escolha um Crescemon.' });
        if (t < 0) continue;
        const target = this.party[t];
        if (it.use === 'heal' && (target.hp <= 0 || target.hp >= target.maxhp)) { await this.msg('Não vai ter efeito.'); continue; }
        if (it.use === 'revive' && target.hp > 0) { await this.msg('Não vai ter efeito.'); continue; }
        return { type: 'item', item: id, target };
      }
      if (r === 2) {
        hideDialog();
        const t = await partyScreen(this.party, { title: 'Trocar Crescemon', hint: 'Escolha quem vai entrar.' });
        if (t < 0) continue;
        const c = this.party[t];
        if (c === this.ally) { await this.msg(`${nameOf(c)} já está lutando!`); continue; }
        if (c.hp <= 0) { await this.msg(`${nameOf(c)} não tem energia para lutar!`); continue; }
        return { type: 'switch', target: c };
      }
      if (r === 3) { hideDialog(); return { type: 'run' }; }
    }
  }

  async useItem(id, target) {
    const G = this.G, it = ITEMS[id];
    G.state.bag[id]--;
    if (it.use === 'ball') {
      await this.msg(`{N} jogou uma ${it.name}!`);
      const f = this.foe;
      const rate = SPECIES[f.sp].catch;
      const a = ((3 * f.maxhp - 2 * f.hp) * rate * it.bonus) / (3 * f.maxhp);
      const p = Math.min(1, a / 255);
      const success = Math.random() < p;
      const shakes = success ? 3 : Math.floor(Math.random() * (p > 0.3 ? 4 : 2));
      await this.bs.throwBall(id === 'ultraorbe' ? '#f0c030' : id === 'superorbe' ? '#3a6ad0' : '#e03a3a', Math.min(3, shakes), success);
      if (success) {
        await this.msg(`Isso! ${nameOf(f)} foi capturado!`);
        G.caught(f.sp);
        this.foeShown = false;
        this.renderHud();
        await this.gainXp(true);
        const where = G.addCreature(f);
        if (where === 'box') await this.msg(`Sua equipe está cheia. ${nameOf(f)} foi enviado para o computador.`);
        this.bs.fx.clear();
        return 'caught';
      }
      const msgs = ['Ah, não! Ele escapou!', 'Quase! Parecia que tinha pegado!', 'Droga! Foi por pouco!', 'Aaah! Estava quase!'];
      await this.msg(msgs[Math.min(shakes, 3)]);
      return null;
    }
    if (it.use === 'heal') {
      const before = target.hp;
      if (target === this.ally) { await this.animateHp(target, target.hp + it.amount); await this.bs.healAnim('ally'); }
      else target.hp = Math.min(target.maxhp, target.hp + it.amount);
      await this.msg(`${nameOf(target)} recuperou ${Math.round(target.hp - before)} PV!`);
    } else if (it.use === 'revive') {
      target.hp = Math.floor(target.maxhp / 2);
      await this.msg(`${nameOf(target)} foi reanimado!`);
    } else if (it.use === 'pp') {
      for (const m of target.moves) m.pp = MOVES[m.id].pp;
      await this.msg(`Os PP de ${nameOf(target)} foram restaurados!`);
    }
    return null;
  }

  aiMove() {
    const f = this.foe;
    const avail = f.moves.filter(m => m.pp > 0);
    if (!avail.length) return 'desesperada';
    const allyTypes = SPECIES[this.ally.sp].types;
    const smart = !!this.trainer;
    let best = null, bestScore = -1;
    for (const m of avail) {
      const mv = MOVES[m.id];
      let s;
      if (mv.cat === 'status') {
        if (mv.heal) s = f.hp < f.maxhp * 0.4 ? 120 : 0;
        else {
          const who = mv.eff.who === 'self' ? 'foe' : 'ally';
          const cur = this.stages[who][mv.eff.stat];
          s = Math.abs(cur) >= 2 ? 5 : 35;
        }
      } else {
        const stab = SPECIES[f.sp].types.includes(mv.type) ? 1.5 : 1;
        s = mv.pow * typeMult(mv.type, allyTypes) * stab * mv.acc / 100;
      }
      s *= smart ? (0.8 + Math.random() * 0.4) : (0.3 + Math.random() * 1.4);
      if (s > bestScore) { bestScore = s; best = m; }
    }
    best.pp--;
    return best.id;
  }

  async doMove(side, moveId) {
    const user = side === 'ally' ? this.ally : this.foe;
    const target = side === 'ally' ? this.foe : this.ally;
    const tside = side === 'ally' ? 'foe' : 'ally';
    const mv = MOVES[moveId];
    const prefix = side === 'foe' ? (this.trainer ? `${nameOf(user)} inimigo` : `${nameOf(user)} selvagem`) : nameOf(user);
    await this.msg(`${prefix} usou ${mv.name}!`);
    // precisão
    if (Math.random() * 100 >= mv.acc) {
      await this.msg(`${prefix} errou o ataque!`);
      return;
    }
    await this.bs.attackAnim(side, moveId);
    if (mv.cat === 'status') {
      if (mv.heal) {
        if (user.hp >= user.maxhp) { await this.msg('Mas não teve efeito!'); return; }
        await this.animateHp(user, user.hp + user.maxhp * mv.heal);
        await this.bs.healAnim(side);
        await this.msg(`${prefix} recuperou energia!`);
        return;
      }
      const e = mv.eff;
      const who = e.who === 'self' ? side : tside;
      const whoC = e.who === 'self' ? user : target;
      const whoName = who === 'foe' ? (this.trainer ? `${nameOf(whoC)} inimigo` : `${nameOf(whoC)} selvagem`) : nameOf(whoC);
      const cur = this.stages[who][e.stat];
      const nv = Math.max(-6, Math.min(6, cur + e.n));
      if (nv === cur) { await this.msg(`${STAT_NAMES[e.stat]} de ${whoName} não vai mais ${e.n > 0 ? 'aumentar' : 'diminuir'}!`); return; }
      this.stages[who][e.stat] = nv;
      await this.bs.statAnim(who, e.n > 0);
      await this.msg(`${STAT_NAMES[e.stat]} de ${whoName} ${e.n > 0 ? 'aumentou' : 'diminuiu'}${Math.abs(e.n) > 1 ? ' muito' : ''}!`);
      return;
    }
    // dano
    const ttypes = SPECIES[target.sp].types;
    const eff = typeMult(mv.type, ttypes);
    if (eff === 0) { await this.msg(`Não afeta ${nameOf(target)}...`); return; }
    const A = user.atk * STAGE(this.stages[side].atk);
    const D = target.def * STAGE(this.stages[tside].def);
    let dmg = Math.floor(Math.floor((2 * user.lvl / 5 + 2) * mv.pow * A / D) / 50) + 2;
    if (SPECIES[user.sp].types.includes(mv.type)) dmg *= 1.5;
    dmg *= eff;
    const crit = Math.random() < 1 / 16;
    if (crit) dmg *= 1.5;
    dmg *= 0.85 + Math.random() * 0.15;
    dmg = Math.max(1, Math.floor(dmg));
    const hp0 = target.hp;
    await this.bs.hitAnim(tside, eff > 1 ? 2 : eff < 1 ? 0 : 1);
    await this.animateHp(target, target.hp - dmg);
    const dealt = hp0 - target.hp;
    if (crit) await this.msg('Um golpe crítico!');
    if (eff > 1) await this.msg('É super eficaz!');
    else if (eff < 1) await this.msg('Não é muito eficaz...');
    if (mv.drain && dealt > 0 && user.hp < user.maxhp) {
      await this.animateHp(user, user.hp + Math.max(1, Math.floor(dealt * mv.drain)));
      await this.msg(`${nameOf(target)} teve a energia drenada!`);
    }
    if (mv.recoil) {
      await this.animateHp(user, user.hp - Math.max(1, Math.floor(user.maxhp * mv.recoil)));
      await this.msg(`${prefix} se machucou com o impacto!`);
    }
  }

  // retorna 'end' | 'switched' | null
  async checkFaints() {
    let switched = false;
    if (this.foe.hp <= 0) {
      await this.bs.faintAnim('foe');
      await this.msg(this.trainer ? `${nameOf(this.foe)} inimigo desmaiou!` : `${nameOf(this.foe)} selvagem desmaiou!`);
      this.foeShown = false;
      this.renderHud();
      if (this.ally.hp > 0) await this.gainXp(false);
      const next = this.foeParty.find(c => c.hp > 0);
      if (!next) {
        if (this.ally.hp <= 0 && !this.party.some(c => c.hp > 0)) { this.endResult = 'lose'; return 'end'; }
        this.endResult = 'win';
        return 'end';
      }
      this.foe = next;
      this.stages.foe = { atk: 0, def: 0, spd: 0 };
      this.participants = new Set(this.ally.hp > 0 ? [this.ally] : []);
      if (this.ally.hp > 0) {
        await this.msg(`${this.trainer.name} vai enviar ${nameOf(next)}.`);
      }
      await this.bs.sendOut('foe', next);
      this.G.seen(next.sp);
      this.foeShown = true;
      this.renderHud();
      switched = true;
    }
    if (this.ally.hp <= 0) {
      await this.bs.faintAnim('ally');
      await this.msg(`${nameOf(this.ally)} desmaiou!`);
      this.allyShown = false;
      this.renderHud();
      this.participants.delete(this.ally);
      if (!this.party.some(c => c.hp > 0)) { this.endResult = 'lose'; return 'end'; }
      if (!this.trainer) {
        const r = await ask('Usar o próximo Crescemon?', ['Sim', 'Fugir']);
        if (r === 1) {
          const chance = (this.ally.spd * 32 / Math.max(1, this.foe.spd) + 30) / 255 + 0.3;
          if (Math.random() < chance) { await this.msg('Você fugiu em segurança!'); this.endResult = 'fled'; return 'end'; }
          await this.msg('Não conseguiu fugir!');
        }
      }
      let idx = -1;
      while (idx < 0) {
        idx = await partyScreen(this.party, { title: 'Escolha o próximo Crescemon', cancel: false, disable: c => c.hp <= 0 });
      }
      this.ally = this.party[idx];
      this.stages.ally = { atk: 0, def: 0, spd: 0 };
      this.participants.add(this.ally);
      await this.msg(`Vai, ${nameOf(this.ally)}!`);
      await this.bs.sendOut('ally', this.ally);
      this.allyShown = true;
      this.renderHud();
      switched = true;
    }
    return switched ? 'switched' : null;
  }

  async gainXp(caught) {
    const f = this.foe;
    const base = Math.floor(SPECIES[f.sp].xp * f.lvl / 6 * (this.trainer ? 1.5 : 1));
    const parts = [...this.participants].filter(c => c.hp > 0);
    const share = Math.max(1, Math.floor(base / Math.max(1, parts.length)));
    for (const c of parts) {
      await this.msg(`${nameOf(c)} ganhou ${share} pontos de experiência!`);
      await this.addXp(c, share);
    }
    const others = this.party.filter(c => c.hp > 0 && !parts.includes(c));
    if (others.length) {
      const half = Math.max(1, Math.floor(base / 2));
      for (const c of others) await this.addXp(c, half, true);
      await this.msg(`O resto da equipe ganhou ${half} de experiência com a Exp. Compartilhada!`);
    }
  }

  async addXp(c, amount, silent = false) {
    c.xp += amount;
    while (c.lvl < 100 && c.xp >= xpForLevel(c.lvl + 1)) {
      c.lvl++;
      const oldMax = c.maxhp;
      recalc(c);
      if (c === this.ally) this.renderHud();
      sfx('levelup');
      await this.msg(`${nameOf(c)} subiu para o nível ${c.lvl}!`);
      if (c.hp <= 0) c.hp = 0;
      for (const mv of movesAtLevel(c.sp, c.lvl)) await this.learnMove(c, mv);
      const evo = SPECIES[c.sp].evo;
      if (evo && c.lvl >= evo.lvl) this.pendingEvos.add(c.uid);
      void oldMax;
    }
    if (c === this.ally) {
      // anima a barra de exp.
      this.renderHud();
    }
    void silent;
  }

  async learnMove(c, id) {
    if (c.moves.some(m => m.id === id)) return;
    const mv = MOVES[id];
    if (c.moves.length < 4) {
      c.moves.push({ id, pp: mv.pp });
      sfx('fanfare');
      await this.msg(`${nameOf(c)} aprendeu ${mv.name}!`);
      return;
    }
    await this.msg(`${nameOf(c)} quer aprender ${mv.name}, mas já conhece 4 golpes.`);
    const r = await ask(`Esquecer um golpe para aprender ${mv.name}?`, ['Sim', 'Não']);
    if (r === 0) {
      const opts = c.moves.map(m => MOVES[m.id].name).concat([`Não aprender ${mv.name}`]);
      const i = await list($('#choice'), opts, { title: 'Esquecer qual golpe?' });
      if (i >= 0 && i < 4) {
        const old = MOVES[c.moves[i].id].name;
        c.moves[i] = { id, pp: mv.pp };
        await this.msg(`1, 2 e... Pronto! ${nameOf(c)} esqueceu ${old} e aprendeu ${mv.name}!`);
        return;
      }
    }
    await this.msg(`${nameOf(c)} não aprendeu ${mv.name}.`);
  }
}

export function buildTrainerParty(spec) {
  return spec.map(([sp, lvl]) => createCreature(sp, lvl));
}
