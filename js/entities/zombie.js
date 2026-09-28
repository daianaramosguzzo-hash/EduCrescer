// Zumbi com IA de estados:
// IDLE → PATRULHA → OUVIR → DETECTAR → PERSEGUIR → ATACAR → PERDER O ALVO → RETORNAR
import * as THREE from '../../lib/three.module.min.js';
import { clamp, dampAngle, angleTo, angDiff, dist, dist2, R, rng, bus } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { HumanModel } from './humanModel.js';
import { ZOMBIES } from '../data/zombies.js';

let seedN = 1;
export class Zombie {
  constructor(G, type, x, z, { home = null, fixed = null, wake = false } = {}) {
    this.G = G; this.type = type; this.def = ZOMBIES[type];
    const D = this.def;
    const r = rng(seedN++ * 977);
    const L = D.look;
    const look = { ...L, zombie: true, shirt: r.pick(L.shirt), pants: r.pick(L.pants), hair: r.pick(L.hair), skin: L.skin, eyeColor: D.eyes || null };
    this.model = new HumanModel(look, { kind: 'zombie', seed: seedN, height: 1.76 * D.scale });
    this.model.anim.cadence = type === 'rapido' ? 1 : 0.75;
    G.renderer.scene.add(this.model.group);
    if (D.eyes) {
      // olhos que brilham
      const eg = new THREE.Group();
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 5), new THREE.MeshBasicMaterial({ color: D.eyes })); e.position.set(s * 0.045, 0.005, 0.107); eg.add(e); }
      this.model.headMount.add(eg);
    }
    this.x = x; this.z = z; this.rot = R() * Math.PI * 2;
    this.r = 0.34 * D.scale;
    this.hp = D.hp; this.maxHp = D.hp;
    this.home = home || { x, z };
    this.fixed = fixed;
    this.state = 'idle'; this.stT = 1 + R() * 3;
    this.tx = x; this.tz = z;
    this.speed = 0; this.dead = false; this.deadT = 0;
    this.cool = 0; this.seeT = 0; this.lastSeen = null;
    this.groanT = 2 + R() * 8;
    this.stuckT = 0; this.lastX = x; this.lastZ = z;
    this.knockX = 0; this.knockZ = 0;
    this.specialCool = 6;
    this.id = 'z' + seedN;
    if (wake) this.alert(G.player);
    this.place();
  }
  place() {
    const g = this.model.group;
    g.position.set(this.x, this.G.world.heightAt(this.x, this.z) - (this.dead ? Math.max(0, this.deadT - 50) * 0.02 : 0), this.z);
    g.rotation.y = this.rot;
  }
  setState(s, t = 0) { this.state = s; this.stT = t; }
  alert(p) {
    if (this.dead) return;
    if (this.state === 'chase' || this.state === 'attack') return;
    this.setState('detect', 0.45 + R() * 0.3);
    this.lastSeen = { x: p.x, z: p.z };
    this.rot = angleTo(this.x, this.z, p.x, p.z);
    if (this.def.boss || R() < 0.7) sfx(this.def.boss ? 'boss' : this.type === 'rapido' ? 'zScream' : 'zGroan', { x: this.x, z: this.z, pitch: this.def.pitch });
    if (this.type === 'agressivo' || this.def.boss) this.model.anim.play('zscream', { dur: 0.7 });
  }
  // ouviu um barulho
  hear(x, z, loud) {
    if (this.dead || this.state === 'chase' || this.state === 'attack' || this.state === 'detect') return;
    this.setState('listen', 8 + R() * 4);
    this.tx = x + (R() - 0.5) * 3; this.tz = z + (R() - 0.5) * 3;
    if (R() < 0.4) sfx('zGroan', { x: this.x, z: this.z, pitch: this.def.pitch });
  }
  damage(amount, from, knock = 0.5, crit = false) {
    if (this.dead) return;
    const G = this.G;
    this.hp -= amount;
    this.model.flash('#ffffff', 0.08);
    G.fx.burst(this.x, 1.1 * this.def.scale, this.z, 'blood', crit ? 16 : 9, crit ? 1.3 : 1);
    if (R() < 0.6) G.fx.blood(this.x, this.z, 0.8 * this.def.scale);
    G.fx.text(this.x, 2.1 * this.def.scale, this.z, (crit ? '💥 ' : '') + Math.round(amount), crit ? 'dmg crit' : 'dmg');
    const kr = 1 - (this.def.knockResist || 0);
    if (from) { const a = angleTo(from.x, from.z, this.x, this.z); this.knockX += Math.sin(a) * knock * 4 * kr; this.knockZ += Math.cos(a) * knock * 4 * kr; }
    G.ui.setTarget(this);
    if (this.hp <= 0) { this.die(from); return; }
    // cambaleia (chefes só às vezes)
    if (!this.def.boss || R() < 0.25) {
      if (this.state === 'attack') this.cool = Math.max(this.cool, 0.4);
      this.model.anim.play('zhurt', { side: (R() - 0.5) * 0.8 });
      this.staggerT = 0.35 * kr;
    }
    if (from && from.isPlayer) this.alert(from);
  }
  die(from) {
    const G = this.G;
    this.dead = true; this.deadT = 0; this.state = 'dead';
    this.model.anim.play('death', { forward: R() < 0.5 });
    sfx('zDie', { x: this.x, z: this.z, pitch: this.def.pitch });
    G.fx.burst(this.x, 1, this.z, 'blood', 18, 1.2);
    G.fx.blood(this.x, this.z, 1.4 * this.def.scale);
    bus.emit('zombieKilled', this);
    // o corpo pode ser revistado
    this.corpse = G.world.register({ kind: 'corpse', x: this.x, z: this.z, r: 1.0, zombie: this, name: this.def.name, loot: this.def.loot, items: null });
  }

  update(dt, far) {
    const G = this.G, D = this.def, p = G.player;
    if (this.dead) {
      this.deadT += dt;
      if (!far) this.model.update(dt, 0);
      this.place();
      return;
    }
    this.cool -= dt; this.stT -= dt; this.groanT -= dt;
    if (this.staggerT > 0) this.staggerT -= dt;
    const dP = p && !p.dead ? dist(this.x, this.z, p.x, p.z) : 1e9;
    // percepção: visão (cone à frente, ou muito perto) e linha de visão
    if (p && !p.dead && this.state !== 'chase' && this.state !== 'attack' && this.state !== 'detect') {
      const night = G.renderer.night > 0.6 ? 0.7 : 1;
      const stealth = 1 - (p.stats ? p.stats.stealth : 0) * 0.6;
      const moving = Math.hypot(p.vx, p.vz) > 0.5;
      const sight = D.sight * night * stealth * (moving ? 1 : 0.75) * (G.inBaseSafe ? 0.7 : 1);
      if (dP < sight) {
        const inCone = Math.abs(angDiff(this.rot, angleTo(this.x, this.z, p.x, p.z))) < 1.25 || dP < 3.2;
        if (inCone && !G.world.col.lineBlocked(this.x, this.z, p.x, p.z)) {
          this.seeT += dt * (dP < sight * 0.5 ? 3 : 1.4);
          if (this.seeT > 0.35) { this.seeT = 0; this.alert(p); }
        } else this.seeT = Math.max(0, this.seeT - dt);
      }
    }
    let goX = null, goZ = null, speed = 0;
    switch (this.state) {
      case 'idle':
        if (this.stT <= 0) {
          const a = R() * Math.PI * 2, d = 3 + R() * 9;
          this.tx = this.home.x + Math.cos(a) * d; this.tz = this.home.z + Math.sin(a) * d;
          this.setState('patrol', 12);
        }
        break;
      case 'patrol':
        goX = this.tx; goZ = this.tz; speed = D.walk * 0.8;
        if (dist(this.x, this.z, this.tx, this.tz) < 0.8 || this.stT <= 0) this.setState('idle', 2 + R() * 5);
        break;
      case 'listen':
        goX = this.tx; goZ = this.tz; speed = D.walk * 1.4;
        if (dist(this.x, this.z, this.tx, this.tz) < 1.2) this.setState('search', 3 + R() * 2);
        else if (this.stT <= 0) this.setState('return', 30);
        break;
      case 'detect':
        // para, encara e rosna antes de correr
        if (p) this.rot = dampAngle(this.rot, angleTo(this.x, this.z, p.x, p.z), 10, dt);
        if (this.stT <= 0) { this.setState('chase', 0); this.lostT = 0; }
        break;
      case 'chase': {
        if (!p || p.dead) { this.setState('return', 30); break; }
        const visible = dP < D.sight * 1.6 && !G.world.col.lineBlocked(this.x, this.z, p.x, p.z);
        if (visible) { this.lastSeen = { x: p.x, z: p.z }; this.lostT = 0; }
        else this.lostT += dt;
        if (this.lostT > D.chaseTime || dP > D.sight * 3.2) { this.setState('lost', 4); break; }
        goX = visible ? p.x : this.lastSeen.x; goZ = visible ? p.z : this.lastSeen.z;
        this.useFlow = !visible || G.world.col.lineBlocked(this.x, this.z, p.x, p.z);
        speed = D.run;
        if (dP < D.atkRange + p.r && this.cool <= 0 && visible) {
          this.setState('attack', 0);
          this.startAttack();
        }
        // habilidades de chefe
        if (D.special && (this.specialCool -= dt) <= 0 && dP < 8) this.special();
        break;
      }
      case 'attack':
        if (p) this.rot = dampAngle(this.rot, angleTo(this.x, this.z, p.x, p.z), 6, dt);
        break;
      case 'lost':
        // procura no último lugar onde viu
        if (this.lastSeen) { goX = this.lastSeen.x; goZ = this.lastSeen.z; speed = D.walk * 1.3; }
        if (this.stT <= 0 || (this.lastSeen && dist(this.x, this.z, this.lastSeen.x, this.lastSeen.z) < 1)) this.setState('search', 3);
        break;
      case 'search':
        this.rot += Math.sin(this.stT * 3) * dt * 1.5;
        if (this.stT <= 0) this.setState('return', 40);
        break;
      case 'return':
        goX = this.home.x; goZ = this.home.z; speed = D.walk;
        if (dist(this.x, this.z, this.home.x, this.home.z) < 2 || this.stT <= 0) this.setState('idle', 2 + R() * 4);
        break;
    }
    // ataque em andamento
    let hit = false;
    if (this.staggerT > 0) speed = 0;
    // movimento
    let gait = 0;
    if (goX != null && speed > 0 && !(this.model.anim.action && ['zattack', 'zslam', 'zscream'].includes(this.model.anim.action.name))) {
      let dx = goX - this.x, dz = goZ - this.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.3) {
        dx /= d; dz /= d;
        if (this.state === 'chase' && this.useFlow) {
          const f = G.world.flow.dir(this.x, this.z);
          if (f) { dx = f.x; dz = f.z; }
        }
        // desvia quando empaca
        if (this.stuckT > 0.8) { const a = Math.atan2(dx, dz) + (this.id.length % 2 ? 1.3 : -1.3); dx = Math.sin(a); dz = Math.cos(a); }
        this.rot = dampAngle(this.rot, Math.atan2(dx, dz), 7, dt);
        const sp = speed * (this.state === 'chase' ? 1 : 1);
        this.x += dx * sp * dt; this.z += dz * sp * dt;
        gait = speed > D.walk * 1.5 ? 1 + clamp((speed - D.walk) / (D.run - D.walk + 0.01), 0, 1) : clamp(speed / Math.max(0.5, D.walk), 0.4, 1);
      }
    }
    // empurrão
    if (this.knockX || this.knockZ) {
      this.x += this.knockX * dt; this.z += this.knockZ * dt;
      this.knockX *= Math.exp(-dt * 8); this.knockZ *= Math.exp(-dt * 8);
      if (Math.abs(this.knockX) + Math.abs(this.knockZ) < 0.05) this.knockX = this.knockZ = 0;
    }
    // separação dos outros zumbis
    for (const o of G.zombies.near(this.x, this.z, 1.2)) {
      if (o === this || o.dead) continue;
      const dx = this.x - o.x, dz = this.z - o.z, d = Math.hypot(dx, dz), m = this.r + o.r;
      if (d < m && d > 0.001) { const k = (m - d) * 0.5; this.x += dx / d * k; this.z += dz / d * k; }
    }
    const res = G.world.col.resolve(this.x, this.z, this.r, this);
    // empacado contra algo durante a perseguição: ataca construções da base
    const moved = Math.hypot(res.x - this.lastX, res.z - this.lastZ);
    if (goX != null && speed > 0 && moved < speed * dt * 0.3) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
    this.lastX = res.x; this.lastZ = res.z;
    this.x = res.x; this.z = res.z;
    if (this.state === 'chase' && this.stuckT > 1.2 && res.hit && res.hit.struct && this.cool <= 0) {
      this.structTarget = res.hit.struct;
      this.setState('attack', 0); this.startAttack();
    }
    // gemidos
    if (this.groanT <= 0 && !far) { this.groanT = 5 + R() * 10; if (dP < 30) sfx('zGroan', { x: this.x, z: this.z, pitch: this.def.pitch, vol: 0.6 }); }
    if (!far) hit = this.model.update(dt, gait);
    else this.model.anim.update(dt, gait);
    if (this.state === 'attack') {
      if (hit) this.resolveAttack();
      if (!this.model.anim.action || !['zattack', 'zslam'].includes(this.model.anim.action.name)) { this.setState('chase', 0); this.structTarget = null; }
    }
    this.place();
  }
  startAttack() {
    const slam = this.def.special === 'pancada' && R() < 0.35;
    this.attackKind = slam ? 'zslam' : 'zattack';
    this.model.anim.play(this.attackKind, { rate: this.type === 'rapido' ? 1.4 : 1 });
    this.cool = this.def.atkRate;
    if (R() < 0.5) sfx('zAttack', { x: this.x, z: this.z, pitch: this.def.pitch });
  }
  resolveAttack() {
    const G = this.G, p = G.player, D = this.def;
    if (this.structTarget) { G.building.damageStruct(this.structTarget, D.dmg * 1.2); sfx('hitHard', { x: this.x, z: this.z }); return; }
    if (!p || p.dead) return;
    const d = dist(this.x, this.z, p.x, p.z);
    if (this.attackKind === 'zslam') {
      G.renderer.shake(0.6);
      G.fx.burst(this.x + Math.sin(this.rot) * 1.5, 0.1, this.z + Math.cos(this.rot) * 1.5, 'dust', 26, 1.4);
      sfx('hitHard', { x: this.x, z: this.z });
      if (d < 3.4) p.damage(D.dmg * 1.4, this);
      return;
    }
    const a = Math.abs(angDiff(this.rot, angleTo(this.x, this.z, p.x, p.z)));
    if (d < D.atkRange + p.r + 0.35 && a < 1.2) { p.damage(D.dmg, this); sfx('hitHard', { x: p.x, z: p.z, vol: 0.7 }); }
  }
  special() {
    const G = this.G;
    this.specialCool = 9 + R() * 5;
    if (this.def.special === 'grito') {
      // grito: chama zumbis e acelera
      this.model.anim.play('zscream');
      sfx('zScream', { x: this.x, z: this.z, pitch: 0.7 });
      G.noise(this.x, this.z, 40, 'scream');
      G.zombies.spawnNear(this.x, this.z, 2, 'comum', true);
      G.ui.toast('O Plantonista chamou reforços!', 'bad');
    }
  }
  remove() { this.G.renderer.scene.remove(this.model.group); this.model.dispose(); if (this.corpse) this.G.world.unregister(this.corpse); }
}
