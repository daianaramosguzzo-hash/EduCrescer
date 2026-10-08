// Força Tática — jogador/bot: movimento, colisão, inventário e hitboxes
import * as THREE from '../../lib/three.module.min.js';
import { PLAYER as P, WEAPONS, GRENADES } from './config.js';
import { overlapBox } from './map.js';

let nextId = 1;

export class Agent {
  constructor(name, team, isPlayer = false) {
    this.id = nextId++;
    this.name = name;
    this.team = team;
    this.isPlayer = isPlayer;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = true;
    this.duck = 0;
    this.ducking = false;
    this.walking = false;
    this.alive = false;
    this.hp = 100;
    this.armor = 0;
    this.helmet = false;
    this.kit = false;
    this.money = 800;
    this.kills = 0;
    this.deaths = 0;
    this.assists = 0;
    this.roundKills = 0;
    this.damageDealt = new Map(); // id da vítima → dano nesta rodada
    this.slots = { primary: null, secondary: null, knife: { def: WEAPONS.knife }, bomb: null };
    this.nades = { he: 0, flash: 0, smoke: 0 };
    this.cur = 'knife';
    this.prev = 'knife';
    // estado da arma
    this.nextAttack = 0;
    this.reloadEnd = 0;
    this.reloadStart = 0;
    this.reloading = false;
    this.drawEnd = 0;
    this.recoilP = 0;     // recuo atual (pitch) em rad
    this.recoilY = 0;
    this.shotIndex = 0;
    this.spreadAcc = 0;
    this.lastShot = -10;
    this.scope = 0;
    this.rescopeAt = 0;
    this.tagUntil = 0;
    this.blindUntil = 0;
    this.blindAmount = 0;
    this.blindStart = 0;
    this.throwAt = 0;
    this.stepDist = 0;
    this.landSlow = 0;
    this.lastHurt = -10;
    this.model = null;
  }

  get height() { return P.height + (P.crouchHeight - P.height) * this.duck; }
  get eyeH() { return P.eye + (P.crouchEye - P.eye) * this.duck; }

  eye(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + this.eyeH, this.pos.z);
  }

  forward(out = new THREE.Vector3(), withRecoil = false) {
    const p = this.pitch + (withRecoil ? this.recoilP : 0), y = this.yaw + (withRecoil ? this.recoilY : 0);
    return out.set(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
  }

  // ------------------------------------------------ inventário
  curDef() {
    if (GRENADES.includes(this.cur)) return WEAPONS[this.cur];
    const it = this.slots[this.cur];
    return it ? it.def : WEAPONS.knife;
  }

  curItem() {
    return GRENADES.includes(this.cur) ? null : this.slots[this.cur];
  }

  has(key) {
    if (GRENADES.includes(key)) return this.nades[key] > 0;
    return !!this.slots[key];
  }

  firstNade() {
    return GRENADES.find(g => this.nades[g] > 0) || null;
  }

  bestSlot() {
    if (this.slots.primary) return 'primary';
    if (this.slots.secondary) return 'secondary';
    return 'knife';
  }

  equip(key, now) {
    if (!this.has(key)) return false;
    if (key === this.cur) return false;
    if (!GRENADES.includes(this.cur) || !GRENADES.includes(key)) this.prev = this.cur;
    this.cur = key;
    this.drawEnd = now + this.curDef().deploy;
    this.nextAttack = Math.max(this.nextAttack, this.drawEnd);
    this.reloading = false;
    this.scope = 0;
    this.rescopeAt = 0;
    this.throwAt = 0;
    return true;
  }

  giveWeapon(id) {
    const def = WEAPONS[id];
    if (def.slot === 'grenade') { this.nades[id] = Math.min(def.max, this.nades[id] + 1); return; }
    if (def.slot === 'bomb') { this.slots.bomb = { def }; return; }
    this.slots[def.slot] = { def, mag: def.mag, reserve: def.reserve };
  }

  resetGear(team) {
    this.slots = { primary: null, secondary: null, knife: { def: WEAPONS.knife }, bomb: null };
    this.nades = { he: 0, flash: 0, smoke: 0 };
    this.giveWeapon(team === 'atk' ? 'p9' : 'p45');
    this.armor = 0;
    this.helmet = false;
    this.kit = false;
  }

  maxSpeed(now) {
    const def = this.curDef();
    let s = this.scope && def.scopedSpeed ? def.scopedSpeed : def.speed;
    if (now < this.tagUntil) s *= 0.6;
    return s;
  }

  // ------------------------------------------------ movimento (estilo Source)
  move(dt, now, wx, wz, jump, duck, walk, frozen) {
    this.walking = walk;
    // agachar
    const oldH = this.height;
    if (duck) this.duck = Math.min(1, this.duck + dt * P.crouchSpeed * (this.onGround ? 1 : 3));
    else if (this.duck > 0) {
      const R = P.radius - 0.01;
      const standY = this.onGround ? this.pos.y : this.pos.y - (P.height - oldH);
      if (!overlapBox(this.pos.x - R, Math.max(0, standY) + 0.01, this.pos.z - R, this.pos.x + R, Math.max(0, standY) + P.height, this.pos.z + R)) {
        this.duck = Math.max(0, this.duck - dt * P.crouchSpeed * (this.onGround ? 1 : 3));
      }
    }
    // no ar, agachar puxa as pernas (pulo agachado alcança caixas mais altas)
    if (!this.onGround) this.pos.y = Math.max(0, this.pos.y + (oldH - this.height));
    this.ducking = this.duck > 0.5;

    let max = this.maxSpeed(now);
    if (walk) max *= P.walkMul;
    if (this.ducking) max *= P.crouchMul;
    if (this.landSlow > 0) { max *= 1 - this.landSlow * 0.5; this.landSlow = Math.max(0, this.landSlow - dt * 2); }
    let len = Math.hypot(wx, wz);
    if (frozen) { wx = wz = 0; len = 0; jump = false; }
    if (len > 1) { wx /= len; wz /= len; len = 1; }
    const wishSpeed = max * len;
    const dx = len > 0 ? wx / len : 0, dz = len > 0 ? wz / len : 0;

    if (this.onGround) {
      if (jump && this.duck < 0.99) {
        this.vel.y = P.jump;
        this.onGround = false;
      } else {
        this.friction(dt);
        this.accelerate(dx, dz, wishSpeed, P.accel, dt);
        const sp = Math.hypot(this.vel.x, this.vel.z);
        if (sp > max && sp > 0) { this.vel.x *= max / sp; this.vel.z *= max / sp; }
      }
    }
    if (!this.onGround) {
      const ws = Math.min(wishSpeed, P.airWish);
      const cur = this.vel.x * dx + this.vel.z * dz;
      const add = ws - cur;
      if (add > 0 && len > 0) {
        const acc = Math.min(P.airAccel * wishSpeed * dt, add);
        this.vel.x += acc * dx;
        this.vel.z += acc * dz;
      }
      this.vel.y -= P.gravity * dt;
    }
    return this.collide(dt);
  }

  friction(dt) {
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp < 0.02) { this.vel.x = this.vel.z = 0; return; }
    const control = Math.max(sp, P.stopSpeed);
    const ns = Math.max(0, sp - control * P.friction * dt);
    this.vel.x *= ns / sp;
    this.vel.z *= ns / sp;
  }

  accelerate(dx, dz, wishSpeed, accel, dt) {
    const cur = this.vel.x * dx + this.vel.z * dz;
    const add = wishSpeed - cur;
    if (add <= 0) return;
    const acc = Math.min(accel * dt * wishSpeed, add);
    this.vel.x += acc * dx;
    this.vel.z += acc * dz;
  }

  overlapAt(x, y, z) {
    const R = P.radius;
    return overlapBox(x - R, y, z - R, x + R, y + this.height, z + R);
  }

  // Move eixo por eixo; sobe degraus baixos; devolve a velocidade da queda ao pousar
  collide(dt) {
    const R = P.radius, p = this.pos, v = this.vel;
    for (const [axis, ai] of [['x', 0], ['z', 2]]) {
      const amount = v[axis] * dt;
      if (!amount) continue;
      p[axis] += amount;
      for (let k = 0; k < 3; k++) {
        const b = this.overlapAt(p.x, p.y, p.z);
        if (!b) break;
        const top = b.max[1];
        if (this.onGround && top > p.y && top - p.y <= P.stepHeight + 1e-3 && !this.overlapAt(p.x, top + 0.001, p.z)) {
          p.y = top + 0.001;
          break;
        }
        p[axis] = amount > 0 ? b.min[ai] - R - 1e-4 : b.max[ai] + R + 1e-4;
        v[axis] = 0;
      }
    }
    let landed = 0;
    const fallV = v.y;
    p.y += v.y * dt;
    const b = this.overlapAt(p.x, p.y, p.z);
    if (b) {
      if (v.y <= 0) { p.y = b.max[1] + 0.0005; if (!this.onGround) landed = -fallV; this.onGround = true; }
      else p.y = b.min[1] - this.height - 1e-4;
      v.y = 0;
    } else if (p.y <= 0) {
      p.y = 0;
      if (!this.onGround) landed = -fallV;
      this.onGround = true;
      v.y = 0;
    } else if (v.y <= 0) {
      // ainda apoiado?
      const R2 = R - 0.01;
      const under = p.y <= 0.002 || overlapBox(p.x - R2, p.y - 0.06, p.z - R2, p.x + R2, p.y - 0.0001, p.z + R2);
      if (under && this.onGround) {
        if (under !== true && typeof under === 'object') p.y = under.max[1] + 0.0005;
        v.y = 0;
      } else this.onGround = false;
    } else this.onGround = false;
    if (landed > 6) this.landSlow = Math.min(1, (landed - 6) / 4 + 0.3);
    return landed;
  }

  // ------------------------------------------------ hitboxes
  // Devolve { t, group } do primeiro acerto do raio no corpo, ou null
  rayHit(ox, oy, oz, dx, dy, dz, maxT) {
    if (!this.alive) return null;
    const h = this.height, x = this.pos.x, y = this.pos.y, z = this.pos.z;
    // rejeição rápida pelo cilindro externo
    const bx = x - ox, bz = z - oz;
    const tc = bx * dx + bz * dz;
    const hl = Math.hypot(dx, dz) || 1e-6;
    const along = tc / (hl * hl);
    const cxp = ox + dx * along - x, czp = oz + dz * along - z;
    if (Math.hypot(cxp, czp) > 0.5 && Math.hypot(bx, bz) > 0.6) return null;
    let best = null;
    const test = (t, group) => { if (t !== null && t >= 0 && t < maxT && (!best || t < best.t)) best = { t, group }; };
    // cabeça
    const hy = y + h - 0.13;
    test(sphere(ox, oy, oz, dx, dy, dz, x, hy, z, 0.135), 'head');
    test(aabb(ox, oy, oz, dx, dy, dz, x - 0.22, y + h * 0.6, z - 0.17, x + 0.22, y + h - 0.25, z + 0.17), 'chest');
    test(aabb(ox, oy, oz, dx, dy, dz, x - 0.2, y + h * 0.45, z - 0.15, x + 0.2, y + h * 0.6, z + 0.15), 'stomach');
    test(aabb(ox, oy, oz, dx, dy, dz, x - 0.19, y, z - 0.14, x + 0.19, y + h * 0.45, z + 0.14), 'legs');
    return best;
  }

  // Pontos que os bots tentam enxergar (cabeça, peito, quadril)
  aimPoints() {
    const h = this.height;
    return [
      new THREE.Vector3(this.pos.x, this.pos.y + h - 0.13, this.pos.z),
      new THREE.Vector3(this.pos.x, this.pos.y + h * 0.72, this.pos.z),
      new THREE.Vector3(this.pos.x, this.pos.y + h * 0.45, this.pos.z),
    ];
  }
}

function sphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = ox - cx, ly = oy - cy, lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

function aabb(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = -Infinity, tmax = Infinity;
  const o = [ox, oy, oz], d = [dx, dy, dz], mn = [x0, y0, z0], mx = [x1, y1, z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < mn[a] || o[a] > mx[a]) return null; continue; }
    let t1 = (mn[a] - o[a]) / d[a], t2 = (mx[a] - o[a]) / d[a];
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin >= 0 ? tmin : null;
}
