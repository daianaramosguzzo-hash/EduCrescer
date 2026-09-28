// O sobrevivente controlado (Arthur ou outro desbloqueado).
import * as THREE from '../../lib/three.module.min.js';
import { clamp, dampAngle, angleTo, angDiff, dist, R, bus } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { HumanModel } from './humanModel.js';
import { ArthurModel, hasArthurGlb } from './arthurModel.js';
import { CHARACTERS } from '../data/characters.js';
import { item } from '../data/items.js';
import { derived, weaponOf, countItem, removeItem } from '../systems/state.js';

export function makeCharacterModel(id) {
  const C = CHARACTERS[id];
  if (id === 'arthur' && hasArthurGlb()) return new ArthurModel();
  const look = { ...C.look };
  if (id === 'arthur') Object.assign(look, { shorts: true, socks: true, hood: true, sleeves: 'long', cuff: '#e0d0b0' });
  return new HumanModel(look, { height: look.kid ? 1.62 : look.big ? 1.82 : 1.74 });
}

const WALK = 3.3, RUN = 5.9;

export class Player {
  constructor(G, ch) {
    this.G = G;
    this.isPlayer = true;
    this.r = 0.38;
    this.setChar(ch);
  }
  setChar(ch) {
    const G = this.G;
    if (this.model) G.renderer.scene.remove(this.model.group);
    this.ch = ch;
    this.model = makeCharacterModel(ch.id);
    G.renderer.scene.add(this.model.group);
    this.x = ch.x; this.z = ch.z; this.rot = ch.rot || 0;
    this.vx = 0; this.vz = 0;
    this.state = 'normal'; this.action = null;
    this.cool = 0; this.target = null; this.stepT = 0; this.alt = false;
    this.dead = false; this.hurtCool = 0; this.regenT = 0;
    this.refreshEquip();
    this.place();
  }
  refreshEquip() {
    const w = weaponOf(this.ch);
    this.model.setWeapon(w.stack ? w.def : null);
    const e = this.ch.equip;
    const col = s => s ? item(s.id).color : null;
    this.model.setGear({ cabeca: e.cabeca && e.cabeca.id, cabecaColor: col(e.cabeca), torso: e.torso && e.torso.id, torsoColor: col(e.torso), mochila: e.mochila && e.mochila.id, mochilaColor: col(e.mochila) });
    this.stats = derived(this.ch);
  }
  place() {
    const G = this.G;
    this.model.group.position.set(this.x, G.world.heightAt(this.x, this.z), this.z);
    this.model.group.rotation.y = this.rot;
  }
  get busy() { return this.state !== 'normal'; }

  // ---------- ações com animação (coletar, vasculhar, comer...) ----------
  startAction(name, { anim, dur = null, loop = false, onHit = null, onEnd = null, face = null, prop = null, cancelOnMove = true, rate = 1 }) {
    if (this.dead) return false;
    this.state = 'action';
    if (face != null) this.rot = face;
    const a = this.model.anim.play(anim, { loop, dur, rate });
    this.action = { name, a, onHit, onEnd, loop, t: 0, dur: dur || (a ? a.dur : 0.5), cancelOnMove, total: 0 };
    if (prop) this.model.setProp(prop);
    return true;
  }
  cancelAction() {
    if (this.state !== 'action') return;
    const a = this.action;
    this.action = null; this.state = 'normal';
    this.model.anim.stop(); this.model.setProp(null);
    if (a && a.onCancel) a.onCancel();
    bus.emit('actionCancel');
  }
  endAction() {
    const a = this.action;
    this.action = null; this.state = 'normal';
    this.model.anim.stop(); this.model.setProp(null);
    if (a && a.onEnd) a.onEnd();
  }

  // ---------- combate ----------
  tryAttack() {
    const G = this.G;
    if (this.cool > 0 || this.busy || this.dead) return;
    const w = weaponOf(this.ch), wd = w.def.weapon;
    const st = this.stats;
    const range = wd.range;
    // mira automática no zumbi mais perto (à frente tem preferência)
    let best = null, bs = 1e9;
    for (const z of G.zombies.list) {
      if (z.dead) continue;
      const d = dist(this.x, this.z, z.x, z.z);
      if (d > range + (wd.kind === 'melee' ? 1.2 : 0) + z.r) continue;
      if (wd.kind !== 'melee' && G.world.col.lineBlocked(this.x, this.z, z.x, z.z)) continue;
      const a = Math.abs(angDiff(this.rot, angleTo(this.x, this.z, z.x, z.z)));
      const score = d + a * 1.5;
      if (score < bs) { bs = score; best = z; }
    }
    this.target = best;
    if (best) this.rot = angleTo(this.x, this.z, best.x, best.z);
    if (wd.kind === 'gun' || wd.kind === 'bow') {
      const s = w.stack;
      if (!s.a) { if (!this.reload()) { sfx('empty'); G.ui.toast(wd.kind === 'bow' ? 'Sem flechas!' : 'Sem munição!'); this.cool = 0.4; } return; }
    }
    // energia
    const cost = wd.energy;
    const tired = this.ch.energy < cost;
    this.ch.energy = Math.max(0, this.ch.energy - cost);
    const rate = tired ? 0.7 : 1;
    this.cool = wd.rate / rate;
    const anim = wd.anim === 'punch' ? 'punch' : wd.anim;
    this.alt = !this.alt;
    this.state = 'attack';
    this.model.anim.play(anim, { rate: Math.max(1, (ACT_DUR[anim] || 0.5) / wd.rate) * rate, alt: this.alt });
    this.attackInfo = { w, wd, tired, target: best };
    if (wd.kind === 'melee') sfx('swing', { x: this.x, z: this.z, vol: 0.7 });
  }
  reload() {
    const w = weaponOf(this.ch), wd = w.def.weapon;
    if (!wd.ammo || !w.stack) return false;
    const have = countItem(this.ch, wd.ammo);
    const need = wd.mag - (w.stack.a || 0);
    if (have <= 0 || need <= 0) return false;
    const k = Math.min(have, need);
    removeItem(this.ch, wd.ammo, k);
    w.stack.a = (w.stack.a || 0) + k;
    this.cool = Math.max(this.cool, wd.reload);
    if (wd.kind === 'gun') sfx('reload', { x: this.x, z: this.z });
    this.G.ui.refreshHud();
    return true;
  }
  // momento do golpe/tiro
  strike() {
    const G = this.G, info = this.attackInfo;
    if (!info) return;
    const { w, wd, tired } = info;
    const st = this.stats;
    const C = CHARACTERS[this.ch.id];
    const ranged = wd.kind !== 'melee';
    let dmg = wd.dmg * st.dmg * (ranged ? st.ranged : st.melee) * (tired ? 0.6 : 1);
    G.noise(this.x, this.z, wd.noise * (1 - st.stealth * (ranged ? 0 : 0.5)), 'attack');
    if (ranged) {
      w.stack.a -= 1;
      const hx = this.x + Math.sin(this.rot) * 0.6, hz = this.z + Math.cos(this.rot) * 0.6;
      if (wd.kind === 'gun') { G.fx.muzzle(hx, 1.3, hz); G.renderer.shake(wd.pellets ? 0.35 : 0.15); }
      sfx(wd.sound || 'bow', { x: this.x, z: this.z });
      const pellets = wd.pellets || 1;
      for (let i = 0; i < pellets; i++) {
        const spread = (wd.spread || 0.04) * (R() - 0.5) * 2;
        const ang = this.rot + spread;
        const t = info.target && !info.target.dead ? info.target : null;
        let hit = null, ex = this.x + Math.sin(ang) * wd.range, ez = this.z + Math.cos(ang) * wd.range;
        // acerta o primeiro zumbi na linha
        let bestD = wd.range;
        for (const z of G.zombies.list) {
          if (z.dead) continue;
          const dx = z.x - this.x, dz = z.z - this.z;
          const along = dx * Math.sin(ang) + dz * Math.cos(ang);
          if (along < 0 || along > bestD) continue;
          const perp = Math.abs(dx * Math.cos(ang) - dz * Math.sin(ang));
          if (perp < z.r + 0.25 + (t === z ? 0.35 : 0)) { if (!G.world.col.lineBlocked(this.x, this.z, z.x, z.z)) { bestD = along; hit = z; } }
        }
        if (hit) { ex = hit.x; ez = hit.z; const falloff = wd.pellets ? Math.max(0.35, 1 - bestD / wd.range) : 1; hit.damage(dmg * falloff, this, wd.knock || 0.4); }
        if (wd.kind === 'gun') G.fx.tracer(hx, 1.3, hz, ex, 1.2, ez);
      }
      this.wearWeapon(1);
    } else {
      // corpo a corpo: acerta quem está no arco à frente
      let any = false;
      for (const z of G.zombies.list) {
        if (z.dead) continue;
        const d = dist(this.x, this.z, z.x, z.z);
        if (d > wd.range + z.r) continue;
        const a = Math.abs(angDiff(this.rot, angleTo(this.x, this.z, z.x, z.z)));
        if (a > 1.0 && d > 0.9) continue;
        const crit = R() < 0.1;
        z.damage(dmg * (crit ? 1.8 : 1), this, wd.knock || 0.5, crit);
        any = true;
        if (wd.anim !== 'swing') break; // estocada acerta um só
      }
      if (any) { sfx('hit', { x: this.x, z: this.z }); G.renderer.shake(0.08); this.wearWeapon(1); }
      // bater em estruturas? não: sobrevivente não quebra a própria base
    }
    G.ui.refreshHud();
  }
  wearWeapon(n) {
    const s = this.ch.equip.arma;
    if (!s || s.d == null) return;
    const C = CHARACTERS[this.ch.id];
    if (C.special.durability && R() < C.special.durability) return;
    s.d -= n;
    if (s.d <= 0) {
      this.G.ui.toast(`${item(s.id).name} quebrou!`, 'bad');
      sfx('break', { x: this.x, z: this.z });
      this.ch.equip.arma = null;
      this.refreshEquip();
    }
  }
  // dano recebido
  damage(amount, from = null) {
    if (this.dead || this.G.godMode) return;
    const st = this.stats;
    const red = st.def / (st.def + 45);
    const dmg = Math.max(1, amount * (1 - red));
    this.ch.hp -= dmg;
    this.model.flash('#ff2a1a', 0.15);
    this.G.fx.burst(this.x, 1.2, this.z, 'blood', 8);
    if (R() < 0.5) this.G.fx.blood(this.x, this.z, 0.7);
    this.G.fx.text(this.x, 2.0, this.z, '-' + Math.round(dmg), 'dmg-player');
    sfx('hurt', { x: this.x, z: this.z });
    this.G.renderer.shake(0.25);
    this.G.ui.hurtFlash();
    // roupas se desgastam
    for (const k of ['cabeca', 'torso', 'pernas', 'pes', 'bracos']) { const s = this.ch.equip[k]; if (s && s.d != null && R() < 0.5) { s.d -= 1; if (s.d <= 0) { this.G.ui.toast(`${item(s.id).name} rasgou!`, 'bad'); this.ch.equip[k] = null; this.refreshEquip(); } } }
    if (this.state === 'action' && this.action && this.action.cancelOnMove) this.cancelAction();
    if (!this.busy && R() < 0.5) this.model.anim.play('hurt', { side: (R() - 0.5) });
    if (this.ch.hp <= 0) this.die();
  }
  die() {
    if (this.dead) return;
    this.dead = true; this.ch.hp = 0;
    this.state = 'dead'; this.action = null;
    this.model.setProp(null);
    this.model.anim.play('death', { forward: false });
    sfx('death');
    bus.emit('playerDied');
  }

  // ---------- consumir ----------
  consume(slotIndex, fromEquip = false) {
    const G = this.G, ch = this.ch;
    const s = ch.inv[slotIndex];
    if (!s) return;
    const d = item(s.id);
    if (!d.use) return;
    if (this.busy) return;
    const kind = d.cat === 'bebida' ? 'drink' : d.cat === 'medico' ? 'heal' : 'eat';
    const C = CHARACTERS[ch.id];
    this.startAction('consume', {
      anim: kind === 'heal' ? 'heal' : kind, prop: kind, cancelOnMove: true,
      onEnd: () => {
        // o item pode ter mudado de lugar; tira pelo id
        if (countItem(ch, s.id) <= 0) return;
        removeItem(ch, s.id, 1);
        const u = d.use, st = derived(ch);
        let heal = u.vida || 0;
        if (d.cat === 'medico' && C.special.heal) heal *= 1 + C.special.heal;
        ch.hp = clamp(ch.hp + heal, 0, st.maxHp);
        ch.hunger = clamp(ch.hunger + (u.fome || 0), 0, 100);
        ch.thirst = clamp(ch.thirst + (u.sede || 0), 0, 100);
        ch.energy = clamp(ch.energy + (u.energia || 0), 0, st.maxEnergy);
        if (u.cura) ch.sick = 0;
        const immune = (ch.skills.estomago || 0) >= 2 && s.id === 'agua_suja';
        if (u.doente && !immune && R() < u.doente) { ch.sick = Math.max(ch.sick, 60); G.ui.toast('Você está enjoado... (perde vida devagar)', 'bad'); }
        if (u.devolve) { const left = G.giveItem(u.devolve, 1, true); }
        sfx(kind === 'drink' ? 'drink' : kind === 'heal' ? 'heal' : 'eat', { x: this.x, z: this.z });
        const parts = [];
        if (u.fome > 0) parts.push(`+${u.fome} 🍖`); if (u.sede > 0) parts.push(`+${u.sede} 💧`); if (heal > 0) parts.push(`+${Math.round(heal)} ❤️`); if (u.energia > 0) parts.push(`+${u.energia} ⚡`);
        if (parts.length) G.fx.text(this.x, 2.1, this.z, parts.join(' '), 'good');
        bus.emit(d.cat === 'bebida' ? 'drink' : d.cat === 'medico' ? 'heal' : 'eat', { id: s.id });
        G.ui.refresh();
      },
    });
    sfx(kind === 'drink' ? 'drink' : 'eat', { x: this.x, z: this.z, vol: 0.001 });
  }

  // ---------- atualização ----------
  update(dt, inp) {
    const G = this.G, ch = this.ch;
    this.stats = derived(ch);
    const st = this.stats;
    const C = CHARACTERS[ch.id];
    if (this.cool > 0) this.cool -= dt;
    let gait = 0;
    if (!this.dead) {
      // movimento
      let mx = 0, mz = 0, running = false;
      const canMove = this.state === 'normal' || (this.state === 'attack') || (this.state === 'action' && this.action && this.action.cancelOnMove);
      if (inp && canMove) {
        const m = inp.move;
        if (m.len > 0.1) {
          if (this.state === 'action') this.cancelAction();
          running = inp.run && ch.energy > 1;
          const sp = (running ? RUN : WALK) * st.speed * (this.state === 'attack' ? 0.45 : 1) * (0.35 + 0.65 * m.len);
          mx = m.x * sp; mz = m.z * sp;
          if (this.state !== 'attack') this.rot = dampAngle(this.rot, Math.atan2(m.x, m.z), 14, dt);
          gait = (running ? 2 : 1) * (0.5 + 0.5 * m.len);
          if (this.state === 'attack') gait = 0.6;
        }
      }
      // aceleração suave
      this.vx += (mx - this.vx) * Math.min(1, dt * 12); this.vz += (mz - this.vz) * Math.min(1, dt * 12);
      if (Math.abs(this.vx) + Math.abs(this.vz) > 0.01) {
        const nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
        const res = G.world.col.resolve(nx, nz, this.r, this);
        this.x = res.x; this.z = res.z;
        // empurra e é empurrado pelos zumbis
        for (const zb of G.zombies.near(this.x, this.z, 2)) {
          if (zb.dead) continue;
          const dx = this.x - zb.x, dz = this.z - zb.z, d = Math.hypot(dx, dz), m = this.r + zb.r;
          if (d < m && d > 0.001) { const k = (m - d) * 0.5; this.x += dx / d * k; this.z += dz / d * k; }
        }
      }
      // passos e barulho
      const moving = gait > 0.2;
      if (moving) {
        this.stepT -= dt * (running ? 1.6 : 1) * gait;
        if (this.stepT <= 0) {
          this.stepT = 0.42;
          const surf = G.world.groundAt(this.x, this.z);
          sfx('step', { x: this.x, z: this.z, surface: G.world.inBuilding(this.x, this.z) ? 'wood' : surf, run: running, vol: 0.5 });
          if (running) G.noise(this.x, this.z, 9 * (1 - st.stealth), 'step');
          if (G.world.isWater(this.x, this.z)) G.fx.burst(this.x, 0.1, this.z, 'dust', 3, 0.5);
        }
      }
      // energia
      const regen = 11 * (1 + (C.special.energyRegen || 0)) * (ch.hunger < 20 || ch.thirst < 20 ? 0.5 : 1);
      if (running && moving) ch.energy = Math.max(0, ch.energy - dt * 9 * (1 - (ch.skills.corredor || 0) * 0.15));
      else if (this.state !== 'attack') ch.energy = Math.min(st.maxEnergy, ch.energy + dt * regen * (moving ? 0.6 : 1));
      // fome e sede
      const k = st.decay * (running && moving ? 1.8 : 1) * (G.inBaseSafe ? 0.8 : 1);
      ch.hunger = Math.max(0, ch.hunger - dt * 0.042 * k);
      ch.thirst = Math.max(0, ch.thirst - dt * 0.056 * k * (ch.sick > 0 ? 1.6 : 1));
      if (ch.hunger <= 0 || ch.thirst <= 0) { ch.hp -= dt * 0.6; if (ch.hp <= 0) this.die(); }
      if (ch.sick > 0) { ch.sick -= dt; ch.hp -= dt * 0.12; if (ch.hp <= 0) this.die(); }
      // regeneração quando bem alimentado
      if (ch.hunger > 55 && ch.thirst > 55 && ch.sick <= 0) ch.hp = Math.min(st.maxHp, ch.hp + dt * 0.25);
      if (ch.hp > st.maxHp) ch.hp = st.maxHp;
    }
    // ação em andamento
    const hit = this.model.update(dt, gait);
    if (this.state === 'attack') {
      if (hit) this.strike();
      if (!this.model.anim.action) { this.state = 'normal'; this.attackInfo = null; }
    } else if (this.state === 'action' && this.action) {
      const a = this.action;
      a.total += dt;
      if (hit && a.onHit) { const cont = a.onHit(); if (cont === false) { this.endAction(); } }
      if (this.action === a && (!this.model.anim.action || this.model.anim.action.name !== a.a?.name)) this.endAction();
    }
    this.place();
    ch.x = this.x; ch.z = this.z; ch.rot = this.rot;
  }
}

const ACT_DUR = { swing: 0.62, stab: 0.48, punch: 0.42, pistol: 0.3, rifle: 0.45, bow: 0.7 };
