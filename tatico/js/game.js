// Força Tática — regras da partida: rodadas, economia, tiros, granadas e bomba
import * as THREE from '../../lib/three.module.min.js';
import { WEAPONS, GRENADES, RULES, REWARD, EQUIP, PLAYER, BOT_NAMES, TEAM_LONG } from './config.js';
import * as MAP from './map.js';
import { Agent } from './agent.js';
import { buildSoldier, buildGun, animateSoldier } from './models.js';
import { Bot, alertSite } from './bot.js';
import * as SND from './audio.js';

const HIT_MULT = { head: 4, chest: 1, stomach: 1.25, legs: 0.75 };
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

export class Game {
  constructor(scene, fx, opts) {
    this.scene = scene;
    this.fx = fx;
    this.opts = opts;
    this.time = 0;
    this.phase = 'freeze';
    this.phaseEnd = 0;
    this.round = 0;
    this.half = opts.halfRounds || 12;
    this.winsNeeded = this.half + 1;
    this.score = { atk: 0, def: 0 };
    this.lossCount = { atk: 0, def: 0 };
    this.agents = [];
    this.player = null;
    this.grenades = [];
    this.smokes = [];
    this.drops = [];
    this.bomb = { state: 'none', pos: new THREE.Vector3(), mesh: null };
    this.listeners = {};
    this.history = [];
    this.createAgents();
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...args) { for (const fn of this.listeners[ev] || []) fn(...args); }

  createAgents() {
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const n = this.opts.teamSize;
    for (const team of ['atk', 'def']) {
      for (let i = 0; i < n; i++) {
        const isPlayer = this.opts.team === team && i === 0;
        const a = new Agent(isPlayer ? this.opts.playerName : 'BOT ' + names.pop(), team, isPlayer);
        a.money = RULES.startMoney;
        a.resetGear(team);
        if (isPlayer) this.player = a;
        else a.bot = new Bot(a, this, this.opts.difficulty);
        this.agents.push(a);
      }
    }
    for (const a of this.agents) this.buildModel(a);
  }

  buildModel(a) {
    if (a.model) this.scene.remove(a.model.root);
    a.model = buildSoldier(a.team);
    a.model.root.visible = !a.isPlayer;
    this.scene.add(a.model.root);
  }

  teamAgents(team) { return this.agents.filter(a => a.team === team); }
  alive(team) { return this.agents.filter(a => a.alive && (!team || a.team === team)); }

  // ------------------------------------------------ rodadas
  startRound() {
    this.round++;
    this.fx.clearAll();
    for (const g of this.grenades) this.scene.remove(g.mesh);
    for (const d of this.drops) this.scene.remove(d.mesh);
    if (this.bomb.mesh) this.scene.remove(this.bomb.mesh);
    this.grenades = []; this.smokes = []; this.drops = [];
    this.bomb = { state: 'carried', pos: new THREE.Vector3(), mesh: null, carrier: null, site: null };

    for (const team of ['atk', 'def']) {
      const spots = MAP.randomSpawns(team, this.teamAgents(team).length);
      this.teamAgents(team).forEach((a, i) => {
        if (!a.alive || this.round === 1) a.resetGear(team);
        else {
          // quem sobreviveu mantém o equipamento, com munição cheia
          for (const k of ['primary', 'secondary']) if (a.slots[k]) { a.slots[k].mag = a.slots[k].def.mag; a.slots[k].reserve = a.slots[k].def.reserve; }
        }
        a.slots.bomb = null;
        a.alive = true;
        a.hp = 100;
        a.pos.copy(spots[i] || spots[0]);
        a.vel.set(0, 0, 0);
        a.yaw = team === 'atk' ? 0 : Math.PI;
        a.pitch = 0;
        a.duck = 0; a.onGround = true;
        a.recoilP = a.recoilY = 0; a.shotIndex = 0; a.spreadAcc = 0;
        a.blindUntil = 0; a.blindAmount = 0;
        a.scope = 0; a.reloading = false; a.planting = false; a.defusing = false;
        a.roundKills = 0; a.damageDealt.clear(); a.throwAt = 0;
        a.cur = 'knife';
        a.equip(a.bestSlot(), this.time);
        a.drawEnd = this.time;
        a.input = blankInput();
        if (a.model) { a.model.deadT = 0; a.model.root.visible = !a.isPlayer; }
      });
    }
    const atks = this.teamAgents('atk');
    const carrier = atks[(Math.random() * atks.length) | 0];
    carrier.slots.bomb = { def: WEAPONS.bomb };
    this.bomb.carrier = carrier;

    this.phase = 'freeze';
    this.phaseEnd = this.time + RULES.freeze;
    this.buyEnd = this.time + RULES.freeze + RULES.buyTime;
    this.roundEnd = this.time + RULES.freeze + RULES.roundTime;
    for (const a of this.agents) if (a.bot) a.bot.onRoundStart();
    this.emit('roundStart', this.round);
  }

  canBuy(a) {
    return a.alive && (this.phase === 'freeze' || (this.phase === 'live' && this.time < this.buyEnd)) && MAP.inSpawn(a.team, a.pos);
  }

  priceOf(a, id) {
    if (id === 'helmet' && a.armor >= 100 && !a.helmet) return 350;
    return (EQUIP[id] || WEAPONS[id]).price;
  }

  buy(a, id) {
    if (!this.canBuy(a)) return 'Fora da zona ou do tempo de compra';
    const eq = EQUIP[id], w = WEAPONS[id];
    const item = eq || w;
    if (item.team && item.team !== a.team) return 'Arma do outro time';
    const price = this.priceOf(a, id);
    if (a.money < price) return 'Dinheiro insuficiente';
    if (id === 'kevlar') {
      if (a.armor >= 100) return 'Você já tem colete';
      a.armor = 100;
    } else if (id === 'helmet') {
      if (a.armor >= 100 && a.helmet) return 'Você já tem colete e capacete';
      a.armor = 100; a.helmet = true;
    } else if (id === 'kit') {
      if (a.kit) return 'Você já tem o kit';
      a.kit = true;
    } else if (w.slot === 'grenade') {
      const total = GRENADES.reduce((s, g) => s + a.nades[g], 0);
      if (a.nades[id] >= w.max) return 'Limite dessa granada';
      if (total >= 4) return 'Limite de granadas';
      a.nades[id]++;
    } else {
      const old = a.slots[w.slot];
      if (old && old.def.id === id) return 'Você já tem essa arma';
      if (old) this.dropItem(a, w.slot, false);
      a.giveWeapon(id);
      a.cur = 'knife';
      a.equip(w.slot, this.time);
    }
    a.money -= price;
    if (a.isPlayer) SND.ui('buy');
    return null;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    if (this.phase === 'freeze' && t >= this.phaseEnd) {
      this.phase = 'live';
      this.emit('live');
    }
    if (this.phase === 'post' && t >= this.phaseEnd) this.nextRound();
    if (this.phase === 'over') return;

    for (const a of this.agents) if (a.bot) a.bot.think(dt);
    for (const a of this.agents) this.updateAgent(a, dt);
    this.separate();
    this.updateGrenades(dt);
    this.updateDrops(dt);
    this.updateBomb(dt);
    if (this.phase === 'live' && t >= this.roundEnd && this.bomb.state !== 'planted') this.endRound('def', 'time');
  }

  nextRound() {
    if (this.score.atk >= this.winsNeeded || this.score.def >= this.winsNeeded || this.round >= this.half * 2) {
      this.phase = 'over';
      const w = this.score.atk > this.score.def ? 'atk' : this.score.def > this.score.atk ? 'def' : null;
      this.emit('matchEnd', w);
      return;
    }
    if (this.round === this.half) {
      // troca de lados: todo mundo recomeça com $800 e a pistola do novo time
      for (const a of this.agents) {
        a.team = a.team === 'atk' ? 'def' : 'atk';
        a.money = RULES.startMoney;
        a.alive = false;
        this.buildModel(a);
      }
      this.score = { atk: this.score.def, def: this.score.atk };
      this.lossCount = { atk: 0, def: 0 };
      this.emit('halftime');
    }
    this.startRound();
  }

  endRound(winner, reason) {
    if (this.phase !== 'live' && this.phase !== 'freeze') return;
    this.phase = 'post';
    this.phaseEnd = this.time + RULES.postRound;
    const loser = winner === 'atk' ? 'def' : 'atk';
    this.score[winner]++;
    const winMoney = { elim: REWARD.winElim, time: REWARD.winTime, bomb: REWARD.winBomb, defuse: REWARD.winDefuse }[reason];
    this.lossCount[loser] = Math.min(REWARD.lossMaxSteps + 1, this.lossCount[loser] + 1);
    const lossMoney = REWARD.lossBase + REWARD.lossStep * Math.min(REWARD.lossMaxSteps, this.lossCount[loser] - 1);
    this.lossCount[winner] = Math.max(0, this.lossCount[winner] - 1);
    for (const a of this.agents) {
      if (a.team === winner) this.addMoney(a, winMoney);
      else {
        // ataque que sobrevive sem plantar quando o tempo acaba não ganha nada
        if (loser === 'atk' && reason === 'time' && a.alive) continue;
        this.addMoney(a, lossMoney + (loser === 'atk' && this.bomb.planted ? REWARD.plantTeamBonus : 0));
      }
    }
    this.history.push(winner);
    this.emit('roundEnd', winner, reason, { winMoney, lossMoney });
  }

  addMoney(a, v) {
    a.money = Math.max(0, Math.min(RULES.maxMoney, a.money + v));
  }

  checkElimination() {
    if (this.phase !== 'live') return;
    const atk = this.alive('atk').length, def = this.alive('def').length;
    if (def === 0) this.endRound('atk', 'elim');
    else if (atk === 0 && this.bomb.state !== 'planted') this.endRound('def', 'elim');
  }

  // ------------------------------------------------ agente por tick
  updateAgent(a, dt) {
    const inp = a.input || (a.input = blankInput());
    if (!a.alive) { a.vel.set(0, 0, 0); return; }
    const t = this.time;
    const frozen = this.phase === 'freeze' || a.planting || a.defusing;
    const landed = a.move(dt, t, inp.mx, inp.mz, inp.jump, inp.duck, inp.walk, frozen);
    inp.jump = false;
    if (landed > 4.5) this.footstep(a, true);

    // passos (andar devagar ou agachado não faz barulho)
    const sp = Math.hypot(a.vel.x, a.vel.z);
    if (a.onGround && sp > 3.45) {
      a.stepDist += sp * dt;
      if (a.stepDist > 1.9) { a.stepDist = 0; this.footstep(a, false); }
    }

    this.updateWeapon(a, inp, dt);
    this.updateObjective(a, inp);

    inp.attackPressed = false; inp.attack2Pressed = false; inp.reload = false; inp.usePressed = false; inp.drop = false;
  }

  footstep(a, land) {
    if (!a.isPlayer || land) SND.step(_v.copy(a.pos), land);
    else if (Math.random() < 0.9) SND.step(null, false);
    this.noise(a.pos, land ? 14 : 20, a, 'step');
  }

  // Bots inimigos por perto escutam o som
  noise(pos, radius, src, kind) {
    for (const b of this.agents) {
      if (!b.bot || !b.alive || b.team === src.team) continue;
      if (b.pos.distanceTo(pos) < radius) b.bot.hear(pos, src, kind);
    }
  }

  inaccuracy(a, def) {
    const s = def.spread;
    if (!s) return 0;
    const sp = Math.hypot(a.vel.x, a.vel.z);
    const max = def.speed;
    const moveFrac = Math.max(0, Math.min(1, (sp - max * 0.34) / (max * 0.66)));
    let inacc = (a.ducking ? s.crouch : s.stand) + s.move * moveFrac + (a.onGround ? 0 : s.air) + a.spreadAcc;
    if (def.type === 'sniper' && !a.scope) inacc += def.noScope;
    return inacc;
  }

  updateWeapon(a, inp, dt) {
    const t = this.time;
    const def = a.curDef();
    // o recuo volta ao centro quando para de atirar
    if (t - a.lastShot > (def.interval || 0.1) + 0.04) {
      const k = Math.exp(-dt * 9);
      a.recoilP *= k; a.recoilY *= k;
      a.shotIndex *= Math.exp(-dt * 7);
      if (a.shotIndex < 0.3) a.shotIndex = 0;
    }
    a.spreadAcc *= Math.exp(-dt * 5);

    if (inp.drop) this.dropCurrent(a);
    // no congelamento do começo da rodada não dá para atacar
    if (this.phase === 'freeze') return;
    if (inp.usePressed && a.isPlayer) this.trySwap(a);

    const item = a.curItem();
    if (a.reloading) {
      const prog = (t - a.reloadStart) / (a.reloadEnd - a.reloadStart);
      if (!a.reloadClick1 && prog > 0.3) { a.reloadClick1 = true; SND.reloadSound(_v.copy(a.pos).setY(a.pos.y + 1.2), 0); }
      if (!a.reloadClick2 && prog > 0.8) { a.reloadClick2 = true; SND.reloadSound(_v.copy(a.pos).setY(a.pos.y + 1.2), 1); }
      if (t >= a.reloadEnd) {
        const need = item.def.mag - item.mag;
        const take = Math.min(need, item.reserve);
        item.mag += take; item.reserve -= take;
        a.reloading = false;
      }
    }
    if (a.rescopeAt && t >= a.rescopeAt) { if (def.scope && !a.reloading) a.scope = a.scopeWas; a.rescopeAt = 0; }

    if (def.type === 'grenade') {
      if (!a.throwAt && t >= a.nextAttack && (inp.attackPressed || inp.attack2Pressed)) {
        a.throwAt = t + 0.22;
        a.throwStrong = inp.attackPressed;
        a.lastAttack = t;
      }
      if (a.throwAt && t >= a.throwAt) {
        this.throwGrenade(a, def.id, a.throwStrong);
        a.throwAt = 0;
        a.nades[def.id]--;
        const next = a.nades[def.id] > 0 ? def.id : a.firstNade();
        const back = a.prev && a.has(a.prev) ? a.prev : a.bestSlot();
        a.cur = 'knife';
        a.equip(next || back, t);
        if (a.cur === 'knife' && back !== 'knife') a.equip(back, t);
      }
      return;
    }
    if (def.type === 'knife') {
      if (t >= a.nextAttack && (inp.attack || inp.attack2Pressed)) {
        const strong = !inp.attack && inp.attack2Pressed;
        a.nextAttack = t + (strong ? def.altInterval : def.interval);
        a.lastAttack = t; a.lastAttackStrong = strong;
        this.knifeAttack(a, def, strong);
      }
      return;
    }
    if (def.type === 'bomb' || !item) return;

    if (inp.reload && !a.reloading && item.mag < def.mag && item.reserve > 0) this.startReload(a, item);
    if (inp.attack2Pressed && def.scope && !a.reloading && t >= a.drawEnd) {
      a.scope = (a.scope + 1) % (def.scope.length + 1);
      a.rescopeAt = 0;
      a.nextAttack = Math.max(a.nextAttack, t + 0.1);
    }
    const wants = def.auto ? inp.attack : inp.attackPressed;
    if (wants && t >= a.nextAttack && !a.reloading && t >= a.drawEnd) {
      if (item.mag <= 0) {
        if (inp.attackPressed && a.isPlayer) SND.dryFire();
        if (item.reserve > 0) this.startReload(a, item);
        a.nextAttack = t + 0.2;
      } else {
        this.fire(a, def, item);
        if (item.mag === 0 && item.reserve > 0) a.autoReloadAt = t + def.interval;
      }
    }
    if (a.autoReloadAt && t >= a.autoReloadAt) {
      a.autoReloadAt = 0;
      if (a.curItem() === item && item.mag === 0 && item.reserve > 0 && !a.reloading) this.startReload(a, item);
    }
  }

  startReload(a, item) {
    a.reloading = true;
    a.reloadStart = this.time;
    a.reloadEnd = this.time + item.def.reload;
    a.reloadClick1 = a.reloadClick2 = false;
    if (a.scope) a.scope = 0;
    a.rescopeAt = 0;
    this.noise(a.pos, 9, a, 'reload');
  }

  fire(a, def, item) {
    const t = this.time;
    item.mag--;
    a.nextAttack = t + def.interval;
    const eye = a.eye(_v3.set(0, 0, 0)).clone();
    const inacc = this.inaccuracy(a, def);
    const n = def.pellets || 1;
    let end = null;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      let r = inacc * Math.random();
      if (def.pellets) r = inacc * Math.random() + def.pelletSpread * Math.sqrt(Math.random());
      const p = a.pitch + a.recoilP + Math.sin(ang) * r;
      const y = a.yaw + a.recoilY + Math.cos(ang) * r;
      const dir = new THREE.Vector3(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
      const e = this.fireBullet(a, eye, dir, def);
      if (i === 0) end = e;
    }
    // recuo pelo padrão da arma
    const pat = def.recoil;
    const i0 = Math.min(Math.floor(a.shotIndex), pat.length - 1), i1 = Math.min(i0 + 1, pat.length - 1);
    let dp = pat[i1][0] - pat[i0][0], dy = pat[i1][1] - pat[i0][1];
    if (i0 === i1) { dp = pat[1][0] * 0.15 * Math.random(); dy = (Math.random() - 0.5) * pat[1][0] * 0.6; }
    const crouchMul = a.ducking ? 0.85 : 1;
    a.recoilP += dp * crouchMul;
    a.recoilY += dy * crouchMul;
    a.shotIndex += 1;
    a.spreadAcc = Math.min(def.spread.max, a.spreadAcc + def.spread.shot);
    a.lastShot = t;
    a.lastAttack = t;
    if (def.type === 'sniper' && a.scope) { a.scopeWas = a.scope; a.scope = 0; a.rescopeAt = t + def.interval * 0.85; }

    // som, clarão e traçante
    SND.gunshot(def, a.isPlayer ? null : eye);
    const muzzle = this.muzzlePos(a);
    if (!a.isPlayer) this.fx.muzzle(muzzle, def.type === 'sniper' || def.type === 'shotgun' ? 1.6 : 1);
    if (end && (!a.isPlayer || Math.random() < 0.35)) this.fx.tracer(a.isPlayer ? eye.clone().addScaledVector(a.forward(_v2, true), 1.5).add(_v.set(0, -0.12, 0)) : muzzle, end);
    this.noise(a.pos, def.type === 'pistol' ? 40 : 55, a, 'shot');
    this.emit('shot', a, def);
  }

  muzzlePos(a) {
    const f = a.forward(new THREE.Vector3());
    const right = _v2.set(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
    return a.eye(new THREE.Vector3()).addScaledVector(f, 0.75).addScaledVector(right, 0.12).add(_v.set(0, -0.2, 0));
  }

  fireBullet(a, origin, dir, def) {
    const o = origin.clone();
    let dmg = def.damage, traveled = 0, pens = def.pen2 || 0, wallbang = false;
    const maxRange = def.type === 'sniper' ? 250 : def.type === 'shotgun' ? 60 : 160;
    for (let iter = 0; iter < 4; iter++) {
      const left = maxRange - traveled;
      const h = MAP.raycast(o.x, o.y, o.z, dir.x, dir.y, dir.z, left);
      const wallT = h ? h.t : left;
      const wall = h ? { t: h.t, exit: h.exit, box: h.box, normal: h.normal.clone() } : null;
      let best = null, bestT = wallT, bestHit = null;
      for (const b of this.agents) {
        if (b === a || !b.alive) continue;
        const r = b.rayHit(o.x, o.y, o.z, dir.x, dir.y, dir.z, bestT);
        if (r) { best = b; bestT = r.t; bestHit = r; }
      }
      if (best) {
        const dist = traveled + bestT;
        const d = dmg * Math.pow(def.rangeMod, dist / 12.7);
        const point = o.clone().addScaledVector(dir, bestT);
        this.fx.blood(point, dir, bestHit.group === 'head');
        this.damage(best, a, d, bestHit.group, def, dir, wallbang);
        return point;
      }
      if (!wall) return o.clone().addScaledVector(dir, left);
      const point = o.clone().addScaledVector(dir, wall.t);
      const kind = wall.box ? wall.box.kind : 'floor';
      this.fx.impact(point, wall.normal, kind);
      if (Math.random() < 0.3) SND.impact(point, kind === 'metal');
      if (pens > 0 && wall.box && wall.box.pen && wall.exit - wall.t < 2.7) {
        dmg *= def.type === 'sniper' ? 0.75 : 0.55;
        pens--;
        wallbang = true;
        traveled += wall.exit + 0.01;
        o.addScaledVector(dir, wall.exit + 0.01);
        this.fx.burst(o, dir, 0x8a5a2a, 4, 2, 8, 0.4);
        continue;
      }
      return point;
    }
    return null;
  }

  knifeAttack(a, def, strong) {
    const eye = a.eye(new THREE.Vector3());
    const dir = a.forward(new THREE.Vector3());
    const range = strong ? def.altRange : def.range;
    let best = null, bestT = range;
    const wall = MAP.raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, range);
    if (wall) bestT = wall.t;
    // a faca acerta numa área um pouco maior que a mira
    for (const off of [0, 0.08, -0.08]) {
      const d = dir.clone().applyAxisAngle(_v.set(0, 1, 0), off);
      for (const b of this.agents) {
        if (b === a || !b.alive) continue;
        const r = b.rayHit(eye.x, eye.y, eye.z, d.x, d.y, d.z, bestT);
        if (r) { best = b; bestT = r.t; }
      }
    }
    SND.knifeSwing(a.isPlayer ? null : eye, !!best || !!wall);
    if (best) {
      // pelas costas causa muito mais dano
      const behind = Math.cos(best.yaw - a.yaw) > 0.5;
      const dmg = (strong ? def.altDamage : def.damage) * (behind ? (strong ? 3 : 1.6) : 1);
      const point = eye.clone().addScaledVector(dir, bestT);
      this.fx.blood(point, dir, false);
      this.damage(best, a, dmg, 'chest', def, dir, false, true);
    } else if (wall) {
      const point = eye.clone().addScaledVector(dir, wall.t);
      this.fx.impact(point, wall.normal.clone(), wall.box ? wall.box.kind : 'floor');
    }
  }

  damage(victim, attacker, dmg, group, def, dir, wallbang = false, flat = false) {
    if (!victim.alive) return;
    if (!flat) dmg *= HIT_MULT[group] || 1;
    if (attacker && attacker !== victim && attacker.team === victim.team) dmg *= RULES.ffMul;
    const pen = def.type === 'grenade' ? 0.5 : def.type === 'bomb' ? 0.5 : def.type === 'knife' ? 0.85 : def.pen;
    const armored = victim.armor > 0 && (group === 'head' ? victim.helmet : group !== 'legs');
    let hp = dmg;
    if (armored) {
      hp = dmg * pen;
      let armorD = (dmg - hp) * 0.5;
      if (armorD > victim.armor) { hp += (armorD - victim.armor) * 2; armorD = victim.armor; }
      victim.armor = Math.max(0, Math.round(victim.armor - armorD));
      if (victim.armor === 0) victim.helmet = false;
    }
    hp = Math.max(1, Math.floor(hp));
    victim.hp -= hp;
    victim.lastHurt = this.time;
    if (def.type !== 'grenade' && def.type !== 'bomb') victim.tagUntil = this.time + 0.35;
    if (attacker && attacker !== victim) {
      attacker.damageDealt.set(victim.id, (attacker.damageDealt.get(victim.id) || 0) + Math.min(hp, hp + victim.hp));
    }
    if (victim.bot) victim.bot.onDamaged(attacker);
    if (attacker && attacker.isPlayer && attacker !== victim && victim.hp > 0) {
      SND.hitSound(group === 'head' ? (armored ? 'helmet' : 'head') : 'body');
    }
    this.emit('damage', victim, attacker, hp, group, dir);
    if (victim.hp <= 0) this.kill(victim, attacker, def.id, group === 'head' && def.type !== 'knife', wallbang, dir);
  }

  kill(victim, killer, weaponId, headshot, wallbang, dir) {
    victim.alive = false;
    victim.hp = 0;
    victim.deaths++;
    victim.reloading = false;
    victim.planting = false;
    victim.defusing = false;
    if (this.bomb.defuser === victim) this.bomb.defuser = null;
    victim.scope = 0;
    if (victim.model) {
      const f = victim.forward(_v);
      victim.model.deadDir = dir && (dir.x * f.x + dir.z * f.z) < 0 ? 1 : -1;
    }
    // larga a melhor arma e a bomba
    if (victim.slots.primary) this.dropItem(victim, 'primary', true);
    else if (victim.slots.secondary) this.dropItem(victim, 'secondary', true);
    if (victim.slots.bomb) this.dropItem(victim, 'bomb', true);
    if (killer && killer !== victim) {
      if (killer.team === victim.team) {
        killer.kills--;
        this.addMoney(killer, REWARD.teamkill);
      } else {
        killer.kills++;
        killer.roundKills++;
        this.addMoney(killer, WEAPONS[weaponId].reward || 300);
        for (const o of this.agents) {
          if (o !== killer && o.team === killer.team && (o.damageDealt.get(victim.id) || 0) >= 41) o.assists++;
        }
      }
      if (killer.isPlayer) SND.hitSound(headshot ? 'helmet' : 'kill');
    }
    // defensor caído perto de um bomb chama reforço
    if (victim.team === 'def') {
      for (const k of ['A', 'B']) if (victim.pos.distanceTo(MAP.SITES[k].center) < 24) alertSite(this, k);
    }
    this.emit('kill', killer, victim, weaponId, headshot, wallbang);
    this.checkElimination();
  }

  // ------------------------------------------------ itens no chão
  dropItem(a, slot, death) {
    const item = a.slots[slot];
    if (!item) return;
    a.slots[slot] = null;
    const isBomb = slot === 'bomb';
    const mesh = buildGun(item.def.model, item.def.color);
    mesh.scale.setScalar(isBomb ? 1.4 : 1.3);
    this.scene.add(mesh);
    const f = a.forward(new THREE.Vector3());
    const pos = a.eye(new THREE.Vector3()).addScaledVector(f, 0.4);
    if (death) pos.y = a.pos.y + 0.9;
    const vel = death ? new THREE.Vector3((Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2) : f.multiplyScalar(5).add(new THREE.Vector3(0, 1.5, 0)).add(a.vel);
    const d = { item, pos, vel, mesh, isBomb, owner: a, ownerUntil: this.time + 1.2, settled: false, spin: (Math.random() - 0.5) * 8 };
    this.drops.push(d);
    if (isBomb) {
      this.bomb.state = 'dropped';
      this.bomb.carrier = null;
      this.bomb.drop = d;
      this.emit('bombDropped', a);
    }
    if (a.cur === slot) { a.cur = 'knife'; a.equip(a.bestSlot(), this.time); }
  }

  dropCurrent(a) {
    if (GRENADES.includes(a.cur) || a.cur === 'knife') return;
    this.dropItem(a, a.cur, false);
  }

  pickUp(a, d) {
    if (d.isBomb) {
      a.slots.bomb = d.item;
      this.bomb.state = 'carried';
      this.bomb.carrier = a;
      this.bomb.drop = null;
      this.emit('bombPicked', a);
    } else {
      a.slots[d.item.def.slot] = d.item;
      if (a.bot && d.item.def.slot === 'primary') { a.cur = 'knife'; a.equip('primary', this.time); }
    }
    this.scene.remove(d.mesh);
    this.drops.splice(this.drops.indexOf(d), 1);
    if (a.isPlayer) SND.ui('pickup');
  }

  // Arma no chão para onde o jogador está olhando (para trocar com E)
  lookDrop(a) {
    const eye = a.eye(new THREE.Vector3()), f = a.forward(new THREE.Vector3());
    let best = null, bestScore = 0.9;
    for (const d of this.drops) {
      if (d.isBomb) continue;
      const to = d.pos.clone().sub(eye);
      const dist = to.length();
      if (dist > 2.6) continue;
      const s = to.normalize().dot(f);
      if (s > bestScore) { best = d; bestScore = s; }
    }
    return best;
  }

  trySwap(a) {
    const d = this.lookDrop(a);
    if (!d) return;
    const slot = d.item.def.slot;
    if (a.slots[slot]) this.dropItem(a, slot, false);
    this.pickUp(a, d);
    a.cur = 'knife';
    a.equip(slot, this.time);
  }

  updateDrops(dt) {
    for (const d of [...this.drops]) {
      if (!d.settled) {
        this.physics(d, dt, 0.12, 0.3);
        d.mesh.rotation.y += d.spin * dt;
        if (d.pos.y <= 0.13 && d.vel.lengthSq() < 0.05) d.settled = true;
      }
      d.mesh.position.copy(d.pos);
      d.mesh.rotation.z = Math.PI / 2 * (d.isBomb ? 0 : 1);
      if (!d.settled) continue;
      for (const a of this.agents) {
        if (!a.alive || (a === d.owner && this.time < d.ownerUntil)) continue;
        // a bomba em cima de uma caixa ainda dá para pegar encostando nela
        const reach = d.isBomb && d.pos.y - a.pos.y > 0.8 ? 1.9 : 1.0;
        if (Math.hypot(a.pos.x - d.pos.x, a.pos.z - d.pos.z) > reach || Math.abs(a.pos.y - d.pos.y) > (d.isBomb ? 2.8 : 1.6)) continue;
        if (d.isBomb ? a.team === 'atk' && !a.slots.bomb : !a.slots[d.item.def.slot]) { this.pickUp(a, d); break; }
      }
    }
  }

  // física simples de objeto quicando (granadas e armas no chão)
  physics(o, dt, r, bounce) {
    const steps = 2;
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      o.vel.y -= 9.0 * h;
      let hitAny = false;
      for (const axis of ['x', 'y', 'z']) {
        const old = o.pos[axis];
        o.pos[axis] += o.vel[axis] * h;
        const b = MAP.overlapBox(o.pos.x - r, o.pos.y - r, o.pos.z - r, o.pos.x + r, o.pos.y + r, o.pos.z + r);
        const floor = axis === 'y' && o.pos.y < r;
        if (b || floor) {
          o.pos[axis] = floor && !b ? r : old;
          const v = Math.abs(o.vel[axis]);
          o.vel[axis] = -o.vel[axis] * bounce;
          if (axis === 'y') {
            o.vel.x *= 0.7; o.vel.z *= 0.7;
            if (Math.abs(o.vel.y) < 0.6) o.vel.y = 0;
          } else { o.vel.y *= 0.85; }
          if (v > 1.5) hitAny = true;
        }
      }
      if (o.pos.y <= r + 0.001 && o.vel.y === 0) { o.vel.x *= Math.exp(-h * 4); o.vel.z *= Math.exp(-h * 4); }
      if (hitAny && o.onBounce) o.onBounce();
    }
  }

  // ------------------------------------------------ granadas
  throwGrenade(a, type, strong) {
    const def = WEAPONS[type];
    const f = a.forward(new THREE.Vector3());
    // o arremesso sai um pouco acima da mira
    const p = a.pitch + 0.12;
    const dir = new THREE.Vector3(-Math.sin(a.yaw) * Math.cos(p), Math.sin(p), -Math.cos(a.yaw) * Math.cos(p));
    const speed = strong ? 16 : 7.5;
    const pos = a.eye(new THREE.Vector3()).addScaledVector(f, 0.3);
    if (MAP.overlapBox(pos.x - 0.07, pos.y - 0.07, pos.z - 0.07, pos.x + 0.07, pos.y + 0.07, pos.z + 0.07)) pos.copy(a.eye(new THREE.Vector3()));
    const vel = dir.multiplyScalar(speed).addScaledVector(a.vel, 0.9);
    const mesh = buildGun('grenade', def.color);
    mesh.scale.setScalar(1.6);
    this.scene.add(mesh);
    const g = { type, pos, vel, owner: a, born: this.time, mesh, onBounce: () => SND.bounce(g.pos) };
    this.grenades.push(g);
    SND.knifeSwing(a.isPlayer ? null : pos, false);
    this.emit('throw', a, type);
  }

  updateGrenades(dt) {
    for (const g of [...this.grenades]) {
      this.physics(g, dt, 0.07, 0.45);
      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += dt * 8 * Math.min(1, g.vel.length() / 3);
      const age = this.time - g.born;
      const def = WEAPONS[g.type];
      let boom = false;
      if (g.type === 'smoke') boom = (age > 1.0 && g.vel.lengthSq() < 0.1) || age > 3.5;
      else boom = age >= def.fuse;
      if (!boom) continue;
      this.scene.remove(g.mesh);
      this.grenades.splice(this.grenades.indexOf(g), 1);
      if (g.type === 'he') this.explodeHE(g);
      else if (g.type === 'flash') this.explodeFlash(g);
      else this.explodeSmoke(g);
    }
    this.smokes = this.smokes.filter(s => s.end > this.time);
  }

  explodeHE(g) {
    this.fx.explosion(g.pos);
    SND.explosion(g.pos);
    this.noise(g.pos, 40, g.owner, 'shot');
    const R = 9.5;
    for (const a of this.agents) {
      if (!a.alive) continue;
      const c = a.pos.clone().setY(a.pos.y + a.height * 0.6);
      const d = c.distanceTo(g.pos);
      if (d > R) continue;
      if (!MAP.segmentClear(g.pos.clone().setY(g.pos.y + 0.2), c)) continue;
      const dmg = 98 * Math.pow(1 - d / R, 1.3);
      if (dmg < 1) continue;
      this.damage(a, g.owner, dmg, 'chest', WEAPONS.he, c.clone().sub(g.pos).normalize(), false, true);
    }
    this.emit('explosion', g.pos, 1);
  }

  explodeFlash(g) {
    this.fx.flashBurst(g.pos);
    SND.flashPop(g.pos);
    for (const a of this.agents) {
      if (!a.alive) continue;
      const eye = a.eye(new THREE.Vector3());
      const d = eye.distanceTo(g.pos);
      if (d > 45 || !MAP.segmentClear(g.pos, eye) || this.smokeBlocks(g.pos, eye)) continue;
      const to = g.pos.clone().sub(eye).normalize();
      const dot = to.dot(a.forward(_v));
      const facing = dot > 0.6 ? 1 : dot > 0.1 ? 0.7 : dot > -0.4 ? 0.45 : 0.2;
      const distF = d < 8 ? 1 : Math.max(0, 1 - (d - 8) / 37);
      const amount = facing * distF;
      if (amount < 0.05) continue;
      const dur = 0.6 + 4.4 * amount;
      if (this.time + dur > a.blindUntil) {
        a.blindUntil = this.time + dur;
        a.blindStart = this.time;
        a.blindAmount = Math.min(1, amount * 1.4);
      }
      if (a.isPlayer) SND.flashRing(amount);
      if (a.bot) a.bot.onFlashed(dur);
    }
    this.emit('explosion', g.pos, 0);
  }

  explodeSmoke(g) {
    const s = { pos: g.pos.clone().setY(0), start: this.time, end: this.time + 18 };
    this.smokes.push(s);
    this.fx.addSmoke(s);
    SND.smokePop(g.pos);
  }

  // A fumaça bloqueia a visão entre a e b?
  smokeBlocks(a, b) {
    for (const s of this.smokes) {
      const age = this.time - s.start;
      if (age < 0.6 || s.end - this.time < 1.5) continue;
      const r = 3.0 * Math.min(1, age / 1.3);
      const c = _v2.set(s.pos.x, 1.7, s.pos.z);
      const ab = _v.copy(b).sub(a);
      const len = ab.length();
      ab.divideScalar(len);
      const t = Math.max(0, Math.min(len, c.clone().sub(a).dot(ab)));
      const closest = a.clone().addScaledVector(ab, t);
      // elipsoide mais achatada em altura
      const dx = closest.x - c.x, dy = (closest.y - c.y) * 1.4, dz = closest.z - c.z;
      if (dx * dx + dy * dy + dz * dz < r * r) return true;
    }
    return false;
  }

  // ------------------------------------------------ bomba
  updateObjective(a, inp) {
    const t = this.time;
    const def = a.curDef();
    // plantar
    if (def.type === 'bomb' && a.slots.bomb && this.phase === 'live') {
      const site = MAP.siteAt(a.pos);
      const want = (inp.attack || inp.use) && site && a.onGround;
      if (want && !a.planting) {
        a.planting = true; a.plantEnd = t + RULES.plantTime; a.plantStart = t; a.nextPlantTick = t;
        this.noise(a.pos, 12, a, 'plant');
      }
      if (a.planting && !want) a.planting = false;
      if (a.planting) {
        if (t >= a.nextPlantTick) { SND.plantTick(a.isPlayer ? null : a.pos); a.nextPlantTick = t + 0.45; }
        if (t >= a.plantEnd) this.plantBomb(a, site);
      }
    } else a.planting = false;

    // desarmar
    if (a.team === 'def' && this.bomb.state === 'planted' && this.phase === 'live') {
      const near = Math.hypot(a.pos.x - this.bomb.pos.x, a.pos.z - this.bomb.pos.z) < 1.7 && Math.abs(a.pos.y - this.bomb.pos.y) < 1.5;
      const want = inp.use && near && a.onGround && (!this.bomb.defuser || this.bomb.defuser === a);
      if (want && !a.defusing) {
        a.defusing = true;
        this.bomb.defuser = a;
        this.bomb.defuseStart = t;
        this.bomb.defuseEnd = t + (a.kit ? RULES.defuseKitTime : RULES.defuseTime);
        this.bomb.nextTick = t;
        this.noise(a.pos, 14, a, 'defuse');
        this.emit('defuseStart', a);
      }
      if (a.defusing && !want) { a.defusing = false; this.bomb.defuser = null; }
      if (a.defusing) {
        if (t >= this.bomb.nextTick) { SND.defuseTick(a.isPlayer ? null : this.bomb.pos); this.bomb.nextTick = t + 0.3; }
        if (t >= this.bomb.defuseEnd && t < this.bomb.explodeAt) this.defuseBomb(a);
      }
    } else if (a.defusing) { a.defusing = false; if (this.bomb.defuser === a) this.bomb.defuser = null; }
  }

  plantBomb(a, site) {
    a.planting = false;
    a.slots.bomb = null;
    this.bomb.state = 'planted';
    this.bomb.planted = true;
    this.bomb.site = site;
    this.bomb.planter = a;
    this.bomb.pos.copy(a.pos);
    this.bomb.plantedAt = this.time;
    this.bomb.explodeAt = this.time + RULES.bombTimer;
    this.bomb.nextBeep = this.time;
    this.bomb.defuser = null;
    this.bomb.carrier = null;
    const mesh = buildGun('bomb');
    mesh.scale.setScalar(1.8);
    mesh.position.copy(a.pos).setY(a.pos.y + 0.09);
    mesh.rotation.y = a.yaw;
    this.scene.add(mesh);
    this.bomb.mesh = mesh;
    this.addMoney(a, REWARD.plant);
    a.cur = 'knife';
    a.equip(a.bestSlot(), this.time);
    // o tempo do round vira o tempo da bomba
    this.roundEnd = this.bomb.explodeAt;
    this.noise(a.pos, 200, a, 'planted');
    for (const b of this.agents) if (b.bot) b.bot.onBombPlanted();
    this.emit('bombPlanted', site, a);
  }

  defuseBomb(a) {
    a.defusing = false;
    this.bomb.state = 'defused';
    this.addMoney(a, REWARD.defuse);
    this.emit('bombDefused', a);
    this.endRound('def', 'defuse');
  }

  updateBomb() {
    const b = this.bomb;
    if (b.state === 'carried' && b.carrier && !b.carrier.slots.bomb) b.carrier = null;
    if (b.state !== 'planted') return;
    const t = this.time;
    if (b.mesh) {
      const led = b.mesh.getObjectByName('led');
      if (led) led.visible = t - b.lastBeep < 0.08;
    }
    if (t >= b.nextBeep) {
      const left = b.explodeAt - t;
      SND.bombBeep(b.pos, left < 10);
      b.lastBeep = t;
      b.nextBeep = t + Math.max(0.12, Math.min(1, 0.1 + left / 40 * 0.95));
    }
    if (t >= b.explodeAt) {
      b.state = 'exploded';
      this.scene.remove(b.mesh);
      const p = b.pos.clone().setY(0.6);
      this.fx.explosion(p);
      this.fx.explosion(p.clone().add(new THREE.Vector3(1.5, 1, 0)));
      this.fx.explosion(p.clone().add(new THREE.Vector3(-1, 2, 1)));
      SND.explosion(null);
      const sigma = 14.8;
      for (const a of this.agents) {
        if (!a.alive) continue;
        const d = a.pos.distanceTo(b.pos);
        const dmg = 500 * Math.exp(-(d * d) / (2 * sigma * sigma));
        if (dmg >= 1) this.damage(a, null, dmg, 'chest', { id: 'bomb', type: 'bomb', reward: 0 }, a.pos.clone().sub(b.pos).normalize(), false, true);
      }
      this.emit('bombExploded');
      if (this.phase === 'live') this.endRound('atk', 'bomb');
    }
  }

  // empurra quem está muito perto (jogadores não se atravessam)
  separate() {
    const list = this.alive();
    const minD = PLAYER.radius * 2;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      if (d >= minD || d < 1e-4 || Math.abs(a.pos.y - b.pos.y) > 1.5) continue;
      const push = (minD - d) / 2;
      const nx = dx / d, nz = dz / d;
      for (const [ag, s] of [[a, -1], [b, 1]]) {
        const ox = ag.pos.x, oz = ag.pos.z;
        ag.pos.x += nx * push * s; ag.pos.z += nz * push * s;
        if (ag.overlapAt(ag.pos.x, ag.pos.y + 0.01, ag.pos.z)) { ag.pos.x = ox; ag.pos.z = oz; }
      }
    }
  }

  // ------------------------------------------------ visual dos soldados
  animate(dt) {
    for (const a of this.agents) {
      const m = a.model;
      if (!m) continue;
      m.root.position.copy(a.pos);
      m.root.rotation.y = a.yaw;
      const def = a.curDef();
      m.setGun(a.alive ? def.model : null, def.color);
      animateSoldier(m, a, dt);
    }
  }

  winnerText(w) { return `${TEAM_LONG[w]} VENCEU`; }
}

export function blankInput() {
  return {
    mx: 0, mz: 0, jump: false, duck: false, walk: false,
    attack: false, attackPressed: false, attack2Pressed: false,
    reload: false, use: false, usePressed: false, drop: false,
  };
}
