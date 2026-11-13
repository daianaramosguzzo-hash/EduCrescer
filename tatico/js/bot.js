// Força Tática — inteligência dos bots: compra, rotas, mira, tiro e objetivos
import * as THREE from '../../lib/three.module.min.js';
import { DIFFICULTY, WEAPONS, RULES } from './config.js';
import * as MAP from './map.js';

const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const _e = new THREE.Vector3(), _d = new THREE.Vector3();
let CALLOUTS = false;
export function setCallouts(v) { CALLOUTS = v; }

function yawPitchTo(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))];
}

// Plano do time na rodada (o ataque escolhe um bomb; a defesa se divide)
function teamPlan(game) {
  if (game._planRound !== game.round) {
    game._planRound = game.round;
    const site = Math.random() < 0.5 ? 'A' : 'B';
    game._plan = { site, defPosts: ['A', 'B', 'A', 'B', 'mid'].sort(() => Math.random() - 0.5), defIdx: 0, atkIdx: 0, rotate: null };
  }
  return game._plan;
}

// A defesa gira para o bomb atacado (uma vez por rodada para cada bomb)
export function alertSite(game, site) {
  const plan = teamPlan(game);
  plan.alerted ||= {};
  if (plan.alerted[site] || game.bomb.state === 'planted') return;
  plan.alerted[site] = true;
  for (const o of game.agents) {
    if (!o.alive || !o.bot || o.team !== 'def' || o.bot.mode !== 'hold') continue;
    if (o.bot.post === site) continue;
    if (Math.random() < (o.bot.post === 'mid' ? 0.9 : 0.65)) { o.bot.post = site; o.bot.goHold(site); }
  }
}

const ROUTES = {
  A: [['long', 'longTop'], ['midT', 'short'], ['long', 'longTop']],
  B: [['tunnel', 'tunnelTop'], ['midT', 'conn', 'tunnelTop'], ['tunnel', 'tunnelTop']],
};

export class Bot {
  constructor(agent, game, diffKey) {
    this.a = agent;
    this.g = game;
    this.d = DIFFICULTY[diffKey] || DIFFICULTY.normal;
    this.path = null;
    this.pathIdx = 0;
    this.goal = null;
    this.mode = 'idle';
    this.target = null;
    this.thinkT = 0;
    this.lastSeen = null;
    this.lastSeenTime = -99;
    this.investigate = null;
    this.investigateTime = -99;
    this.lookAt = null;
    this.stuckT = 0;
    this.lastPos = new THREE.Vector3();
    this.strafeDir = 1;
    this.strafeT = 0;
    this.burst = 0;
    this.pauseUntil = 0;
    this.nextTap = 0;
  }

  get now() { return this.g.time; }

  // ------------------------------------------------ início da rodada e compra
  onRoundStart() {
    this.path = null;
    this.target = null;
    this.lastSeen = null;
    this.investigate = null;
    this.mode = 'idle';
    this.crouchHold = false;
    this.started = false;
    this.waitUntil = 0;
    this.buyGear();
  }

  buyGear() {
    const a = this.a, g = this.g;
    const buy = (id) => g.buy(a, id) === null;
    const pistolRound = g.round === 1 || g.round === g.half + 1;
    const team = g.teamAgents(a.team);
    const avg = team.reduce((s, x) => s + x.money, 0) / team.length;
    const rifle = a.team === 'atk' ? 'ak' : 'm4';
    const cheap = a.team === 'atk' ? 'galil' : 'famas';
    if (pistolRound) {
      const r = Math.random();
      if (r < 0.5) buy('kevlar');
      else if (r < 0.7) buy('deagle');
      else if (a.team === 'def') buy('kit');
      if (a.money >= 300 && Math.random() < 0.4) buy('he');
      return;
    }
    const eco = avg < 2400 && a.money < 3900;
    if (!a.slots.primary && !eco) {
      if (a.money >= WEAPONS.awp.price + 1000 && Math.random() < 0.18) buy('awp');
      else if (a.money >= WEAPONS[rifle].price + 650) buy(rifle);
      else if (a.money >= WEAPONS[cheap].price + 650) buy(cheap);
      else if (a.money >= 1900) buy(pick(['smg9', 'smg9', 'shotgun']));
    } else if (!a.slots.primary && eco && a.money >= 1400 && Math.random() < 0.4) {
      buy('deagle');
    }
    if (!eco || a.slots.primary) {
      if (a.money >= 1000 && !(a.armor >= 100 && a.helmet)) buy('helmet');
      else if (a.money >= 650 && a.armor < 100) buy('kevlar');
    }
    if (a.team === 'def' && !a.kit && a.money >= 400 && Math.random() < 0.55) buy('kit');
    if (a.money >= 300 && Math.random() < 0.6) buy('he');
    if (a.money >= 200 && Math.random() < 0.3) buy('flash');
  }

  // ------------------------------------------------ objetivos
  planRound() {
    const a = this.a, plan = teamPlan(this.g);
    this.started = true;
    if (a.team === 'atk') {
      const routes = ROUTES[plan.site];
      const route = routes[plan.atkIdx++ % routes.length];
      const via = route.map(k => MAP.pt(MAP.POINTS[k]));
      this.site = plan.site;
      this.mode = 'push';
      this.waitUntil = this.now + rnd(0, 6);
      this.setGoal(this.siteSpot(plan.site), via);
    } else {
      const post = plan.defPosts[plan.defIdx++ % plan.defPosts.length];
      this.post = post;
      this.goHold(post);
    }
  }

  siteSpot(site) {
    if (this.a.slots.bomb) return MAP.pt(pick(MAP.POINTS[site === 'A' ? 'plantA' : 'plantB']));
    const holds = MAP.POINTS[site === 'A' ? 'holdA' : 'holdB'];
    const h = pick(holds);
    return MAP.pt([h[0] + 0.5, h[1] + 0.5]);
  }

  goHold(post) {
    const key = post === 'A' ? 'holdA' : post === 'B' ? 'holdB' : 'holdMid';
    const h = pick(MAP.POINTS[key]);
    this.mode = 'hold';
    this.holdLook = MAP.pt([h[2], h[3]], 1.5);
    const spot = MAP.pt([h[0] + 0.5, h[1] + 0.5]);
    this.setGoal(spot);
    // entradas visíveis dali: a defesa alterna o olhar entre elas
    const eye = spot.clone().setY(1.6);
    const entries = MAP.POINTS[post === 'A' ? 'entriesA' : post === 'B' ? 'entriesB' : 'entriesMid'];
    this.looks = entries.map(e => MAP.pt(e, 1.5)).filter(p => MAP.segmentClear(eye, p));
    if (!this.looks.length) this.looks = [this.holdLook];
    this.lookIdx = 0;
    this.lookSwitch = 0;
    this.crouchHold = Math.random() < 0.5;
  }

  setGoal(goal, via = []) {
    this.goal = goal.clone();
    const pts = [this.a.pos.clone(), ...via, goal];
    this.path = [];
    for (let i = 0; i < pts.length - 1; i++) this.path.push(...MAP.findPath(pts[i], pts[i + 1]));
    this.pathIdx = 0;
    this.stuckT = 0;
  }

  onBombPlanted() {
    const a = this.a, b = this.g.bomb;
    if (!a.alive) return;
    if (a.team === 'def') {
      this.mode = 'retake';
      this.setGoal(b.pos);
    } else {
      this.mode = 'postplant';
      const ang = Math.random() * Math.PI * 2, r = rnd(4, 9);
      const spot = b.pos.clone().add(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
      const [cx, cz] = MAP.nearestWalkable(...MAP.cellOf(spot));
      this.setGoal(MAP.cellCenter(cx, cz));
      this.holdLook = b.pos.clone().setY(1.2);
    }
  }

  hear(pos, src, kind) {
    if (kind === 'defuse' && this.a.team === 'atk') {
      this.mode = 'stopDefuse';
      this.setGoal(pos);
    }
    if (this.target) return;
    // atenção ao som: vira para a direção dele
    if (!this.investigate || this.now - this.investigateTime > 1 || kind === 'shot') {
      this.investigate = pos.clone().setY(pos.y + 1.4);
      this.investigateTime = this.now;
    }
  }

  onDamaged(attacker) {
    if (!attacker || attacker === this.a || attacker.team === this.a.team) return;
    if (!this.target) {
      this.investigate = attacker.eye(new THREE.Vector3());
      this.investigateTime = this.now;
      this.reactAt = Math.min(this.reactAt || 0, this.now + this.d.reaction * 0.5);
    }
  }

  onFlashed(dur) {
    this.target = null;
    this.blindMoveUntil = this.now + dur * 0.6;
  }

  // ------------------------------------------------ percepção
  perceive() {
    const a = this.a, g = this.g;
    const eye = a.eye(_e);
    const blind = g.time < a.blindUntil && a.blindAmount > 0.35 && (a.blindUntil - g.time) > 0.8;
    let best = null, bestD = Infinity, bestPt = null;
    if (!blind) {
      for (const e of g.agents) {
        if (!e.alive || e.team === a.team) continue;
        const d = e.pos.distanceTo(a.pos);
        if (d > 95) continue;
        const [ty] = yawPitchTo(eye, e.pos);
        const inFov = Math.abs(wrap(ty - a.yaw)) < this.d.fov / 2 || d < 2.5 || e === this.target;
        if (!inFov) continue;
        for (const p of e.aimPoints()) {
          if (MAP.segmentClear(eye, p) && !g.smokeBlocks(eye, p)) {
            if (d < bestD) { best = e; bestD = d; bestPt = p; }
            break;
          }
        }
      }
    }
    if (best) {
      if (best !== this.target) {
        this.target = best;
        this.acquired = g.time;
        const alert = this.investigate && g.time - this.investigateTime < 2.5;
        const still = Math.hypot(a.vel.x, a.vel.z) < 1;
        this.reactAt = g.time + this.d.reaction * rnd(0.75, 1.3) * (alert ? 0.6 : 1) * (still ? 0.55 : 1);
        this.aimHead = Math.random() < this.d.head;
        const ang = Math.random() * Math.PI * 2;
        this.errDir = [Math.cos(ang), Math.sin(ang) * 0.6];
        this.burst = 0;
      }
      this.lastSeen = best.pos.clone();
      this.lastSeenTime = g.time;
      if (a.team === 'def') {
        for (const k of ['A', 'B']) if (best.pos.distanceTo(MAP.SITES[k].center) < 22) alertSite(g, k);
      }
      best.spottedUntil = g.time + 1.2;
      this.visiblePt = bestPt;
    } else {
      if (this.target && g.time - this.lastSeenTime > 0.35) this.target = null;
      if (this.target && !this.target.alive) this.target = null;
    }
  }

  // ------------------------------------------------ cada tick
  think(dt) {
    const a = this.a, g = this.g, inp = a.input;
    if (!a.alive || !inp) return;
    inp.mx = inp.mz = 0;
    inp.attack = false; inp.use = false; inp.duck = false; inp.walk = false;

    if (g.phase === 'freeze') {
      this.lookAround(dt, 0.6);
      return;
    }
    if (!this.started) this.planRound();
    if (g.phase === 'over') return;

    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.1 + Math.random() * 0.06;
      this.perceive();
      this.decide();
    }

    const t = g.time;
    const blinded = t < a.blindUntil && a.blindAmount > 0.4;
    if (this.target && this.target.alive) {
      this.combat(dt, blinded);
    } else {
      this.target = null;
      this.objective(dt);
    }
    if (blinded && this.blindMoveUntil > t) {
      // cego: anda para trás e mira sem rumo
      inp.mx = Math.sin(a.yaw); inp.mz = Math.cos(a.yaw);
      a.yaw += Math.sin(t * 3) * dt;
    }
  }

  // decide trocas de arma, recarga e granadas
  decide() {
    const a = this.a, g = this.g;
    // inimigo marcado no radar por um aliado: olha para lá
    if (CALLOUTS && !this.target && (!this.investigate || g.time - this.investigateTime > 1)) {
      let best = null, bd = 32;
      for (const e of g.agents) {
        if (!e.alive || e.team === a.team || !(e.spottedUntil > g.time)) continue;
        const d = e.pos.distanceTo(a.pos);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) { this.investigate = best.eye(new THREE.Vector3()); this.investigateTime = g.time; }
    }
    const empty = (k) => a.slots[k] && a.slots[k].def.mag && a.slots[k].mag + a.slots[k].reserve === 0;
    let want = this.mode === 'plant' ? 'bomb' : a.bestSlot();
    if (want === 'primary' && empty('primary')) want = a.slots.secondary && !empty('secondary') ? 'secondary' : 'knife';
    if (want === 'secondary' && empty('secondary')) want = 'knife';
    if (a.cur !== want && !(a.cur === 'he' && this.nadeTarget) && !a.throwAt) {
      if (a.has(want)) a.equip(want, g.time);
    }
    const item = a.curItem();
    if (!this.target && item && item.def.mag && !a.reloading && item.reserve > 0 && item.mag < item.def.mag * 0.5) a.input.reload = true;
    // granada: joga onde viu o inimigo pela última vez
    if (!this.target && a.nades.he > 0 && this.lastSeen && g.time - this.lastSeenTime < 3 && g.time - this.lastSeenTime > 0.6 && !this.nadeTarget) {
      const d = this.lastSeen.distanceTo(a.pos);
      if (d > 7 && d < 28 && Math.random() < 0.25) {
        this.nadeTarget = this.lastSeen.clone();
        a.equip('he', g.time);
      }
    }
  }

  lookAround(dt, speed) {
    const a = this.a;
    this.lookPhase = (this.lookPhase || Math.random() * 6) + dt * speed;
    a.yaw += Math.sin(this.lookPhase) * dt * 0.4;
    a.pitch += (0 - a.pitch) * Math.min(1, dt * 3);
  }

  turnTo(yaw, pitch, dt, speed) {
    const a = this.a;
    const dy = wrap(yaw - a.yaw), dp = pitch - a.pitch;
    const max = speed * dt;
    const k = Math.min(1, dt * 14);
    a.yaw = wrap(a.yaw + Math.max(-max, Math.min(max, dy * k)));
    a.pitch = Math.max(-1.4, Math.min(1.4, a.pitch + Math.max(-max, Math.min(max, dp * k))));
    return Math.hypot(dy, dp);
  }

  // ------------------------------------------------ combate
  combat(dt, blinded) {
    const a = this.a, g = this.g, inp = a.input, e = this.target, t = g.time;
    this.needRepath = true;
    const eye = a.eye(_e);
    const dist = e.pos.distanceTo(a.pos);
    const pts = e.aimPoints();
    let aim = this.aimHead ? pts[0] : pts[1];
    // se só parte do corpo aparece, mira nela
    if (this.visiblePt && !MAP.segmentClear(eye, aim)) aim = this.visiblePt;
    aim = aim.clone().addScaledVector(e.vel, 0.06);
    let [ty, tp] = yawPitchTo(eye, aim);
    const since = t - this.acquired;
    const err = (this.d.errMin + (this.d.err - this.d.errMin) * Math.exp(-since * 2.2)) * (blinded ? 6 : 1);
    const wob = Math.sin(t * 2.3 + this.a.id) * 0.5 + 0.5;
    const desY = ty + this.errDir[0] * err * (0.5 + wob) - a.recoilY * this.d.control;
    const desP = tp + this.errDir[1] * err * (0.5 + wob) - a.recoilP * this.d.control;
    const def = a.curDef();
    if (t < this.reactAt) {
      // ainda reagindo: começa a virar devagar
      this.turnTo(desY, desP, dt, this.d.turn * 0.35);
      this.objectiveMove(dt, true);
      return;
    }
    this.turnTo(desY, desP, dt, this.d.turn);

    // erro real entre onde a bala vai e o alvo
    const realY = wrap(a.yaw + a.recoilY - ty), realP = a.pitch + a.recoilP - tp;
    const angErr = Math.hypot(realY, realP);
    const size = Math.atan((this.aimHead ? 0.16 : 0.26) / Math.max(1, dist));
    const tol = size * (def.type === 'sniper' ? 1.2 : 1.6) + (dist > 20 ? 0.01 : 0.005);

    // movimento em combate
    const strafe = def.type === 'pistol' || def.type === 'smg' || def.type === 'shotgun' || def.type === 'knife' || dist < 7;
    if (strafe) {
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = rnd(0.25, 0.7); this.strafeDir = Math.random() < 0.5 ? -1 : 1; }
      const rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
      inp.mx = rx * this.strafeDir; inp.mz = rz * this.strafeDir;
      if (def.type === 'knife') { const f = a.forward(_d); inp.mx += f.x * 2; inp.mz += f.z * 2; }
    } else if ((dist > 18 && this.d.burst >= 5 && a.shotIndex > 2) || (this.mode === 'hold' && this.crouchHold)) inp.duck = true;

    if (def.type === 'grenade' || def.type === 'bomb') {
      if (a.has(a.bestSlot())) a.equip(a.bestSlot(), t);
      return;
    }
    if (def.type === 'knife') {
      if (dist < 1.8 && angErr < 0.3) inp.attack = true;
      return;
    }
    if (def.type === 'sniper' && !a.scope && dist > 6 && t >= a.drawEnd && !a.reloading && t >= a.nextAttack) {
      inp.attack2Pressed = true;
      return;
    }
    if (def.type === 'shotgun' && dist > 18) return;
    if (t < this.pauseUntil || angErr > tol) {
      if (angErr > tol * 3) this.burst = 0;
      // sem ângulo bom de longe: continua avançando enquanto mira
      if (!strafe && dist > 15 && t - this.reactAt > 1.2) this.objectiveMove(dt, true);
      return;
    }
    if (this.allyInLine(eye, dist)) { this.strafeT = 0; return; }
    // fuzis param antes de atirar (contra-strafe) se o alvo está longe
    const speed = Math.hypot(a.vel.x, a.vel.z);
    if (!strafe && speed > def.speed * 0.36 && dist > 10) return;
    if (def.auto) {
      inp.attack = true;
      this.burst++;
      const maxBurst = dist > 30 ? 2 : dist > 15 ? this.d.burst : 30;
      if (this.burst >= maxBurst * 6) { this.burst = 0; this.pauseUntil = t + rnd(0.25, 0.45); }
    } else if (t >= this.nextTap && t >= a.nextAttack) {
      inp.attackPressed = true;
      this.nextTap = t + (def.type === 'sniper' ? 0.05 : rnd(0.05, 0.18) + (def.id === 'deagle' ? 0.25 : 0));
    }
  }

  allyInLine(eye, dist) {
    const a = this.a;
    for (const o of this.g.agents) {
      if (o === a || !o.alive || o.team !== a.team) continue;
      if (o.pos.distanceTo(a.pos) > dist + 1) continue;
      // margem extra: testa o raio um pouco para os lados
      for (const off of [0, 0.03, -0.03]) {
        const yaw = a.yaw + a.recoilY + off, p = a.pitch + a.recoilP;
        const dx = -Math.sin(yaw) * Math.cos(p), dy = Math.sin(p), dz = -Math.cos(yaw) * Math.cos(p);
        if (o.rayHit(eye.x, eye.y, eye.z, dx, dy, dz, dist)) return true;
      }
    }
    return false;
  }

  // ------------------------------------------------ objetivo (sem inimigo à vista)
  objective(dt) {
    const a = this.a, g = this.g, t = g.time, inp = a.input;

    // granada armada: mira e joga
    if (this.nadeTarget && a.cur === 'he') {
      const eye = a.eye(_e);
      const dx = this.nadeTarget.x - eye.x, dz = this.nadeTarget.z - eye.z, dy = this.nadeTarget.y + 0.5 - eye.y;
      const x = Math.hypot(dx, dz), v = 16, gr = 9;
      const disc = v ** 4 - gr * (gr * x * x + 2 * dy * v * v);
      const ang = disc > 0 ? Math.atan((v * v - Math.sqrt(disc)) / (gr * x)) : 0.6;
      const err = this.turnTo(Math.atan2(-dx, -dz), ang - 0.12, dt, this.d.turn);
      if (err < 0.05 && t >= a.nextAttack && !a.throwAt) { inp.attackPressed = true; this.nadeTarget = null; }
      return;
    }
    if (this.nadeTarget && a.cur !== 'he' && !a.throwAt) this.nadeTarget = null;

    // ataque: alguém pega a bomba caída
    const b = g.bomb;
    if (a.team === 'atk' && b.state === 'dropped' && b.drop) {
      const mine = g.alive('atk').filter(x => x.bot).sort((p, q) => p.pos.distanceTo(b.drop.pos) - q.pos.distanceTo(b.drop.pos))[0] === a;
      if (mine && (!this.goal || this.goal.distanceTo(b.drop.pos) > 1)) { this.mode = 'getbomb'; this.setGoal(b.drop.pos); }
    }
    if (a.team === 'atk' && this.mode === 'getbomb' && b.state !== 'dropped') {
      this.mode = 'push';
      this.setGoal(this.siteSpot(this.site || teamPlan(g).site));
    }

    // defesa: retomar e desarmar
    if (a.team === 'def' && b.state === 'planted') {
      if (this.mode !== 'retake' && this.mode !== 'flee') this.onBombPlanted();
      const left = b.explodeAt - t;
      const need = a.kit ? RULES.defuseKitTime : RULES.defuseTime;
      const dist = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
      if (left < need - 0.3 && !a.defusing && this.mode !== 'flee') {
        // sem tempo: salva a arma longe da bomba
        this.mode = 'flee';
        this.setGoal(MAP.pt([19.5, 4.5]));
      }
      if (this.mode === 'retake' && dist < 1.3 && (!b.defuser || b.defuser === a)) {
        inp.use = true;
        inp.duck = Math.random() < 0.02 ? !inp.duck : true;
        this.turnTo(...yawPitchTo(a.eye(_e), b.pos), dt, 4);
        return;
      }
    }

    // plantar
    if (a.team === 'atk' && a.slots.bomb && g.phase === 'live') {
      const site = MAP.siteAt(a.pos);
      const atGoal = this.goal && Math.hypot(a.pos.x - this.goal.x, a.pos.z - this.goal.z) < 1.2;
      if (site && (atGoal || this.pathDone())) {
        this.mode = 'plant';
        if (a.cur !== 'bomb') a.equip('bomb', t);
        inp.attack = true;
        inp.duck = true;
        this.lookAround(dt, 1.5);
        return;
      }
    }
    if (this.mode === 'plant' && !a.slots.bomb) this.onBombPlanted();

    this.objectiveMove(dt, false);
  }

  pathDone() { return !this.path || this.pathIdx >= this.path.length; }

  objectiveMove(dt, reacting) {
    const a = this.a, g = this.g, t = g.time, inp = a.input;
    if (this.mode === 'push' && t < this.waitUntil) { this.lookAround(dt, 1); return; }
    // ao chegar no bomb, o ataque espera perto e vigia
    if (this.pathDone()) {
      if (this.mode === 'push' && a.team === 'atk' && !a.slots.bomb) {
        this.mode = 'siteHold';
        const s = MAP.SITES[this.site || 'A'];
        this.holdLook = s.center.clone().setY(1.4).add(new THREE.Vector3(0, 0, -6));
      }
      if (this.mode === 'hold' && this.looks && t > this.lookSwitch) {
        this.lookIdx = (this.lookIdx + 1) % this.looks.length;
        this.holdLook = this.looks[this.lookIdx];
        this.lookSwitch = t + rnd(1.5, 3.5);
      }
      if (this.mode === 'hold' && this.crouchHold) inp.duck = true;
      const look = (this.investigate && t - this.investigateTime < 3) ? this.investigate : this.holdLook;
      if (look && !reacting) {
        const [y, p] = yawPitchTo(a.eye(_e), look);
        this.turnTo(y + Math.sin(t * 0.7 + a.id) * 0.25, p, dt, 3);
      } else if (!reacting) this.lookAround(dt, 0.8);
      return;
    }
    if (this.needRepath && !reacting && this.goal) { this.needRepath = false; this.setGoal(this.goal); }
    const next = this.path[this.pathIdx];
    if (!next) return;
    const dx = next.x - a.pos.x, dz = next.z - a.pos.z;
    const d = Math.hypot(dx, dz);
    const last = this.pathIdx === this.path.length - 1;
    if (d < (last ? 0.5 : 1.1)) { this.pathIdx++; return; }
    inp.mx = dx / d; inp.mz = dz / d;
    // perto do objetivo, anda devagar (sem barulho)
    if (!reacting) {
      const toGoal = this.goal ? Math.hypot(this.goal.x - a.pos.x, this.goal.z - a.pos.z) : 99;
      inp.walk = this.mode === 'retake' && toGoal < 10 && g.bomb.explodeAt - t > 20;
      let ly, lp = 0;
      if (this.investigate && t - this.investigateTime < 2.5) [ly, lp] = yawPitchTo(a.eye(_e), this.investigate);
      else ly = Math.atan2(-dx, -dz);
      this.turnTo(ly, lp, dt, 5);
    }
    // travado? pula e recalcula
    this.stuckT += dt;
    if (this.stuckT > 0.8) {
      if (a.pos.distanceTo(this.lastPos) < 0.4) {
        inp.jump = true;
        if (this.goal) this.setGoal(this.goal);
        // empurrão aleatório para desenroscar
        inp.mx += (Math.random() - 0.5) * 2; inp.mz += (Math.random() - 0.5) * 2;
      }
      this.stuckT = 0;
      this.lastPos.copy(a.pos);
    }
  }
}

