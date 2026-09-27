// Inteligência em tempo real: zumbis (vagar, ouvir barulho, caçar, arrombar portas, especiais),
// sobreviventes (neutros, aliados, hostis) e os companheiros da turma que seguem quem você controla.
import { ZOMBIES } from '../data/zombies.js';
import { ITEMS } from '../data/items.js';
import { los } from './vision.js';
import { findPath } from './path.js';
import { hitChance, rollDamage, zombieWound } from './combat.js';
import { effStat } from './units.js';
import { rng, bus, clamp } from '../util.js';
import { S, PROPS } from '../world/tiles.js';

const ACTIVE = 42;              // zumbis mais longe que isso do grupo ficam "dormindo"
const d2 = (a, b) => Math.hypot(a.px - b.px, a.pz - b.pz);

export function updateAI(g, dt) {
  const heroes = g.liveHeroes;
  if (!heroes.length) return;
  for (const u of g.units) {
    if (!u.alive || u === g.selected) continue;
    if (u.px === undefined || u.px === null) g.rtPlace(u);
    if (u.st.stun > 0) { u.st.stun = Math.max(0, u.st.stun - dt / 2); u.rtAnim = null; continue; }
    if (u.kind === 'hero') { if (!u.st.downed) companion(g, u, dt); else u.rtAnim = null; continue; }
    let near = 999;
    for (const h of heroes) { const d = Math.abs(h.x - u.x) + Math.abs(h.z - u.z); if (d < near) near = d; }
    if (u.kind === 'zombie') {
      if (near > ACTIVE * 1.4 && u.ai.state !== 'hunt') { u.rtAnim = null; continue; }
      zombie(g, u, dt, near);
    } else npc(g, u, dt, near);
  }
}

// ------------------------------------------------------------ movimento dos NPCs e zumbis
function aiGoto(g, u, x, z, adjacent = false, maxNodes = 900) {
  const path = findPath(g.map, u.x, u.z, x, z, { goalAdjacent: adjacent, occupied: (px, pz) => { const o = g.unitAt(px, pz); return !!o && o !== u && !(o.kind === 'hero' && u.kind !== 'zombie'); }, maxNodes, breakDoors: u.kind === 'zombie', allowDoors: u.kind !== 'zombie' });
  if (!path || !path.length) { u.nav = null; return false; }
  u.nav = { path, i: 0, x, z, adjacent, stuck: 0, repath: 2 };
  return true;
}
// segue o caminho; devolve true se andou
function follow(g, u, dt, speedMul = 1) {
  if (!u.nav) return false;
  const dir = g.navStep(u);
  if (!dir) return false;
  const sp = g.speedOf(u) * speedMul;
  const k = Math.min(1, (dir[2] + 0.05) / (sp * dt));
  const hit = g.moveBody(u, dir[0] * sp * dt * k, dir[1] * sp * dt * k);
  if (hit && hit.cell) obstacle(g, u, hit.cell, dt);
  u.rtAnim = speedMul > 1.2 ? 'run' : 'walk';
  return true;
}
// anda direto na direção de um ponto (para os últimos passos, sem caminho)
function steer(g, u, tx, tz, dt, speedMul = 1) {
  const dx = tx - u.px, dz = tz - u.pz, d = Math.hypot(dx, dz);
  if (d < 0.05) return false;
  const sp = g.speedOf(u) * speedMul;
  const st = Math.min(sp * dt, d);
  const hit = g.moveBody(u, dx / d * st, dz / d * st);
  if (hit && hit.cell) obstacle(g, u, hit.cell, dt);
  u.rtAnim = speedMul > 1.2 ? 'run' : 'walk';
  return true;
}
// esbarrou em porta, janela ou barricada da base
function obstacle(g, u, cell, dt) {
  const [cx, cz] = cell;
  const m = g.map, i = m.idx(cx, cz);
  const door = m.doors.get(i);
  if (u.kind !== 'zombie') {
    if (door && !door.open && !door.locked && !(door.barricade > 0)) g.tryOpenAhead(u, { cell });
    return;
  }
  u.bashT = (u.bashT ?? 0.6) - dt;
  if (u.bashT > 0) return;
  u.bashT = 1.3;
  if (door && (!door.open || door.barricade > 0)) return bashDoor(g, u, door);
  if (m.struct[i] === S.WINDOW) { const w = m.windows.get(i); if (w && !w.broken) return breakWindow(g, u, w); }
  const p = m.prop(cx, cz);
  if (p && p.extra && p.extra.built && p.extra.hp > 0 && (u.ai.state === 'hunt' || u.ai.raid)) return bashBuilt(g, u, p);
}

// ------------------------------------------------------------ percepção
function perceive(g, z) {
  const Z = ZOMBIES[z.type];
  const night = g.isNight();
  let best = null, bestScore = 1e9;
  const prot = g.liveHeroes.find(h => h.st.protetor && d2(h, z) <= 4.5);
  if (prot && los(g.map, z.x, z.z, prot.x, prot.z)) return prot;
  for (const t of g.units) {
    if (!t.alive || t.kind === 'zombie' || t.gone || t.px === undefined) continue;
    if (t.kind === 'npc' && t.faction !== 'ally' && !g.liveHeroes.some(h => Math.hypot(h.x - t.x, h.z - t.z) < 14)) continue;
    const d = d2(t, z);
    let sight = Z.visao;
    if (night) sight = Math.max(3, sight * 0.55);
    if (g.state.weather.chuva) sight -= 1.5;
    const lit = g.lightLevel(t.x, t.z);
    if (night && lit > 0.5) sight += 4;
    if (t.kind === 'hero' && night && g.flashlightOn(t)) sight += 5;
    if (t.st.sneak) sight -= 2;
    if (d > sight + 0.5) continue;
    if (!los(g.map, z.x, z.z, t.x, t.z)) continue;
    let notice = z.ai.state === 'hunt' && z.ai.target === t.uid;
    if (!notice) {
      if (t.st.hidden && d > 1.5) { if (rng.next() > 0.02) continue; }
      const furt = t.kind === 'hero' ? effStat(t, 'furtividade') : 4;
      let ch = 0.92 - (furt - 3) * 0.07 + (sight - d) * 0.05;
      if (t.st.ran) ch += 0.3;
      if (t.st.sneak) ch -= 0.3;
      if (!night && lit < 0.4) ch -= 0.1;
      if (d <= 1.4) ch = 0.97;
      // checa ~3 vezes por segundo: chance por checagem
      const per = 1 - Math.pow(1 - clamp(ch, 0.03, 0.97), 0.35);
      notice = rng.next() < per;
      if (!notice && rng.next() < 0.15 && z.ai.state !== 'hunt') { z.ai.state = 'investigate'; z.ai.noise = { x: t.x, z: t.z, turn: g.state.turn }; }
    }
    if (!notice) continue;
    const score = d + (t.st.downed ? -1 : 0) + (t.kind === 'npc' ? 1.5 : 0);
    if (score < bestScore) { bestScore = score; best = t; }
  }
  return best;
}

// ------------------------------------------------------------ zumbis
function zombie(g, z, dt, near) {
  const Z = ZOMBIES[z.type];
  z.thinkT = (z.thinkT ?? rng.next() * 0.3) - dt;
  let target = z.ai.target ? g.units.find(o => o.uid === z.ai.target && o.alive) : null;
  if (z.thinkT <= 0) {
    z.thinkT = 0.28 + rng.next() * 0.1;
    const seen = near < 26 ? perceive(g, z) : null;
    if (seen) {
      if (z.ai.state !== 'hunt' || z.ai.target !== seen.uid) {
        if (g.unitVisible(z)) g.S.units.floatText(z.x, z.z, '❗', 'alert');
        if (seen.kind === 'hero' && g.unitVisible(z) && rng.next() < 0.2) g.log(`👁️ ${Z.nome} avistou <b>${seen.name}</b>!`, 'alerta');
        z.nav = null;
      }
      z.ai.state = 'hunt'; z.ai.target = seen.uid; z.ai.last = [seen.x, seen.z]; z.ai.lostT = 0;
      if (z.st.hidden && d2(z, seen) <= 3.5) { z.st.hidden = false; z.ai.ambush = true; }
      target = seen;
    } else if (z.ai.state === 'hunt') {
      z.ai.lostT = (z.ai.lostT || 0) + 0.3;
      if (z.ai.lostT > 4) { z.ai.state = z.ai.last ? 'investigate' : 'wander'; z.ai.noise = z.ai.last ? { x: z.ai.last[0], z: z.ai.last[1] } : null; z.ai.target = null; target = null; }
    }
  }
  if (z.ai.state !== 'hunt') target = null;
  // ---------------- especiais
  if (z.type === 'pamonheiro' && target) {
    z.ai.cdT = (z.ai.cdT ?? 3) - dt;
    if (z.ai.cdT <= 0) {
      z.ai.cdT = 12;
      g.S.units.say(z, rng.pick(['PAMONHA, PAMONHA, PAMONHA!', 'Olha a pamonha fresquinha!', 'É PAMONHA DE PIRACICA... DE AIMORÉS!', 'Pamonha caseeeeira!']));
      g.S.units.play(z, 'attack');
      g.noise(z.x, z.z, Z.grito, z);
      for (const o of g.units) if (o.kind === 'zombie' && o.alive && o !== z && Math.hypot(o.x - z.x, o.z - z.z) < Z.grito) { o.ai.state = 'hunt'; o.ai.target = target.uid; o.ai.last = [target.x, target.z]; }
      g.log('📢 O Zumbi Pamonheiro gritou no megafone! Zumbis da região estão vindo!', 'perigo');
      g.S.shake = 0.3;
    }
    if (d2(z, target) < 2.6) { steer(g, z, z.px * 2 - target.px, z.pz * 2 - target.pz, dt, 1); return; }
  }
  if (z.type === 'matriz' && target) {
    z.ai.cdT = (z.ai.cdT ?? 8) - dt;
    if (z.ai.cdT <= 0) {
      z.ai.cdT = Z.brotos * 6;
      let n = 0;
      for (const [dx, dz] of rng.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]])) {
        const nx = z.x + dx, nz = z.z + dz;
        if (n < 2 && !g.map.blocked(nx, nz) && !g.unitAt(nx, nz)) { const b = g.spawnZombie('comum', nx, nz, { look: 'z_comum_a' }); g.rtPlace(b); b.name = 'Broto da Matriz'; b.maxHp = b.hp = 14; b.ai.state = 'hunt'; b.ai.target = target.uid; n++; }
      }
      if (n) { g.S.units.say(z, 'CRESÇAM... CRESÇAAAM!'); g.log('🌱 A Matriz fez brotar novos zumbis do chão!', 'perigo'); }
    }
    z.ai.rootT = (z.ai.rootT ?? 3) - dt;
    const d = d2(z, target);
    if (z.ai.rootT <= 0 && d > 1.6 && d <= Z.raizes + 0.5 && los(g.map, z.x, z.z, target.x, target.z)) {
      z.ai.rootT = 5;
      z.face = Math.atan2(target.px - z.px, target.pz - z.pz);
      g.S.units.play(z, 'attack');
      g.later(0.4, () => {
        if (!target.alive) return;
        g.S.units.burst(target.x, target.z, '#7cc24a', 2);
        if (rng.next() * 100 < 70) { g.damage(target, rng.int(8, 13), z); target.st.stun = Math.max(target.st.stun || 0, 1.5); g.log(`🌿 Raízes brotaram do chão e prenderam <b>${target.name}</b>!`, 'perigo'); }
        else g.S.units.floatText(target.x, target.z, 'Desviou!', 'miss');
      });
    }
  }
  if (Z.furtivo && !target && z.ai.state !== 'investigate') { z.st.hidden = true; z.rtAnim = null; return; }
  // ---------------- ataque e perseguição
  if (target) {
    const d = d2(z, target);
    const reach = 1.12;
    if (d <= reach) {
      z.nav = null; z.rtAnim = null;
      z.face = Math.atan2(target.px - z.px, target.pz - z.pz);
      if (z.atkCd <= 0) zombieAttack(g, z, target);
      return;
    }
    const fast = Z.corre ? 1.35 : 1;
    if (d < 2.2 && los(g.map, z.x, z.z, target.x, target.z)) { z.nav = null; steer(g, z, target.px, target.pz, dt, fast); return; }
    z.repathT = (z.repathT ?? 0) - dt;
    if (!z.nav || z.repathT <= 0) { z.repathT = 0.6 + rng.next() * 0.3; if (!aiGoto(g, z, target.x, target.z, true, 1400)) { steer(g, z, target.px, target.pz, dt, fast); return; } }
    follow(g, z, dt, fast);
    return;
  }
  if (z.ai.state === 'investigate' && z.ai.noise) {
    const n = z.ai.noise;
    if (Math.max(Math.abs(z.x - n.x), Math.abs(z.z - n.z)) <= 1) { z.ai.state = 'wander'; z.ai.noise = null; z.nav = null; z.idleT = 2 + rng.next() * 3; return; }
    if (!z.nav || z.nav.x !== n.x || z.nav.z !== n.z) { if (!aiGoto(g, z, n.x, n.z, false, 1200)) { z.ai.state = 'wander'; z.ai.noise = null; return; } }
    if (!follow(g, z, dt)) { z.ai.state = 'wander'; z.ai.noise = null; }
    return;
  }
  // vagando perto de casa
  if (z.nav) { if (!follow(g, z, dt, 0.6)) z.nav = null; return; }
  z.rtAnim = null;
  z.idleT = (z.idleT ?? rng.next() * 4) - dt;
  if (z.idleT <= 0) {
    z.idleT = 3 + rng.next() * 5;
    const home = z.ai.home || [z.x, z.z];
    const R = z.ai.wander ?? 5;
    for (let t = 0; t < 6; t++) {
      const x = home[0] + rng.int(-R, R), zz = home[1] + rng.int(-R, R);
      if (!g.map.inb(x, zz) || g.map.blocked(x, zz) || g.map.floor[g.map.idx(x, zz)] === 12) continue;
      if (aiGoto(g, z, x, zz, false, 300)) break;
    }
  }
}

function zombieAttack(g, z, t) {
  const Z = ZOMBIES[z.type];
  const view = g.S.units;
  z.atkCd = Z.corre ? 0.9 : z.type === 'resistente' ? 1.6 : 1.3;
  view.play(z, 'attack');
  g.noise(z.x, z.z, 3, z);
  g.later(0.35, () => {
    if (!z.alive || !t.alive || z.st.stun > 0) return;
    if (d2(z, t) > 1.7) { view.floatText(t.x, t.z, 'Esquivou!', 'miss'); return; }
    const w = z.weaponStats();
    if (rng.next() * 100 < hitChance(g, z, t, w)) {
      const r = rollDamage(g, z, t, w, { ambush: z.ai.ambush });
      z.ai.ambush = false;
      g.damage(t, r.dmg, z, r);
      if (t.kind === 'hero' && !t.dead) {
        const wnd = zombieWound(g, z, t);
        if (wnd === 'mordida') { g.log(`🩸 <b>${t.name}</b> levou uma mordida! A infecção começou.`, 'perigo'); view.floatText(t.x, t.z, 'MORDIDA!', 'bite'); }
        else if (wnd === 'arranhão') g.log(`${Z.nome} arranhou <b>${t.name}</b> (${r.dmg}).`, 'alerta');
        t.need.moral = Math.max(0, t.need.moral - 3);
        if (Z.empurra && t.alive) g.knockback(t, z, 1);
      }
    } else view.floatText(t.x, t.z, 'Esquivou!', 'miss');
  });
}

function bashDoor(g, z, door) {
  const Z = ZOMBIES[z.type];
  z.face = Math.atan2(door.x + 0.5 - z.px, door.z + 0.5 - z.pz);
  const near = g.liveHeroes.some(h => Math.hypot(h.x - door.x, h.z - door.z) < 12);
  if (g.visible.has(g.map.idx(z.x, z.z))) g.S.units.play(z, 'attack');
  const dmg = rng.int(2, 5) * (Z.porta || 1);
  if (near) bus.emit('sfx', 'bang', door.x, door.z);
  if (door.barricade > 0) {
    door.bhp = (door.bhp ?? 30) - dmg;
    if (door.bhp <= 0) { door.barricade = 0; door.bhp = undefined; g.S.world.refreshDoor(g.map.idx(door.x, door.z)); if (near) g.log('🪵 A barricada foi arrebentada!', 'perigo'); }
  } else {
    door.hp -= dmg;
    if (door.hp <= 0) {
      door.open = true; door.locked = false; door.broken = true;
      g.map.version++;
      g.S.world.refreshDoor(g.map.idx(door.x, door.z));
      if (near) g.log('🚪 Uma porta foi arrombada pelos zumbis!', 'perigo');
      g.visionDirty = true;
    }
  }
  g.noise(door.x, door.z, 7, z);
}
function breakWindow(g, z, w) {
  w.broken = true;
  bus.emit('sfx', 'glass', w.x, w.z);
  g.map.version++;
  const b = g.map.building[g.map.idx(w.x, w.z)];
  if (b >= 0) g.S.world.buildBuilding(g.map.buildings[b]);
  g.noise(w.x, w.z, 8, z);
  if (g.liveHeroes.some(h => Math.hypot(h.x - w.x, h.z - w.z) < 12)) g.log('🪟 Vidro estilhaçado! Um zumbi quebrou uma janela.', 'alerta');
}
// peças construídas na base (paredes, portões) aguentam pancada até quebrar
function bashBuilt(g, z, p) {
  const Z = ZOMBIES[z.type];
  if (g.visible.has(g.map.idx(z.x, z.z))) g.S.units.play(z, 'attack');
  p.extra.hp -= rng.int(2, 5) * (Z.porta || 1);
  bus.emit('sfx', 'bang', p.x, p.z);
  const def = PROPS[p.type];
  if (def.fere) g.damage(z, def.fere, null);
  if (p.extra.hp <= 0) g.destroyBuilt?.(p);
}

// ------------------------------------------------------------ sobreviventes
function npc(g, u, dt, near) {
  if (u.st.fled) { u.rtAnim = null; return; }
  if (u.faction === 'hostile') return hostile(g, u, dt);
  if (u.faction === 'ally') return fighterFollow(g, u, dt, g.selected);
  // neutro: se defende de quem encosta, senão fica na dele
  if (near > 30) { u.rtAnim = null; return; }
  const z = closestHostile(g, u, 1.6);
  if (z) {
    const w = u.weaponStats();
    if (u.eq.mao && u.atkCd <= 0) humanAttack(g, u, z);
    else if (!u.eq.mao) steer(g, u, u.px * 2 - z.px, u.pz * 2 - z.pz, dt, 1.2);
    return;
  }
  if (u.nav) { if (!follow(g, u, dt, 0.7)) u.nav = null; return; }
  u.rtAnim = null;
  if (u.ai.comport === 'vaga') {
    u.idleT = (u.idleT ?? 4) - dt;
    if (u.idleT <= 0) { u.idleT = 5 + rng.next() * 6; const h = u.ai.home || [u.x, u.z]; aiGoto(g, u, h[0] + rng.int(-3, 3), h[1] + rng.int(-3, 3), false, 200); }
  }
}
function closestHostile(g, u, maxD) {
  let best = null, bd = maxD;
  for (const o of g.units) {
    if (!o.alive || o.px === undefined) continue;
    const enemy = u.faction === 'hostile' ? (o.kind === 'hero' || o.faction === 'ally') : (o.kind === 'zombie' || o.faction === 'hostile');
    if (!enemy) continue;
    const d = d2(o, u);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
// companheiros da turma e aliados: seguem quem você controla e brigam com o que chegar perto
function companion(g, u, dt) {
  if (u.st.stay) { const z = closestHostile(g, u, 5); if (z) return engage(g, u, z, dt); u.rtAnim = null; return; }
  fighterFollow(g, u, dt, g.selected);
}
function fighterFollow(g, u, dt, leader) {
  const z = closestHostile(g, u, 6.5);
  if (z && g.unitVisible(z) && (!leader || d2(z, leader) < 9)) return engage(g, u, z, dt);
  if (!leader || !leader.alive) { u.rtAnim = null; return; }
  const d = d2(u, leader);
  if (d > 12 && !g.unitVisible(u) && u.kind === 'hero') {
    // ficou muito para trás: alcança o grupo
    const [x, z2] = g.freeNear(leader.x, leader.z);
    u.x = x; u.z = z2; u.px = x + 0.5; u.pz = z2 + 0.5; u.nav = null;
    return;
  }
  if (d > 2.4) {
    u.repathT = (u.repathT ?? 0) - dt;
    if (!u.nav || u.repathT <= 0) { u.repathT = 0.8; aiGoto(g, u, leader.x, leader.z, true, 1500); }
    if (!follow(g, u, dt, d > 5 ? 1.5 : 1)) steer(g, u, leader.px, leader.pz, dt, 1);
    return;
  }
  u.nav = null; u.rtAnim = null;
}
function engage(g, u, z, dt) {
  const w = u.weaponStats();
  const ranged = w.tipo === 'distancia';
  if (ranged && u.eq.mao && w.pente > 1 && (u.eq.mao.loaded || 0) <= 0) {
    // sem bala no pente: recarrega se tiver, senão vai no braço
    if (u.kind === 'hero' && (u.inv || []).some(e => e.id === w.municao)) { g.rtReload(u); return; }
    if (u.kind !== 'hero') { u.eq.mao.loaded = ITEMS[u.eq.mao.id].w.pente; u.atkCd = 1.5; return; }
  }
  const reach = g.reachOf(w);
  const d = d2(u, z);
  if (d <= reach && (!ranged || los(g.map, u.x, u.z, z.x, z.z))) {
    u.nav = null; u.rtAnim = null;
    u.face = Math.atan2(z.px - u.px, z.pz - u.pz);
    if (u.atkCd <= 0) { if (u.kind === 'hero') g.rtStrike(u, z); else humanAttack(g, u, z); }
    return;
  }
  u.repathT = (u.repathT ?? 0) - dt;
  if (d < 2.2) { u.nav = null; steer(g, u, z.px, z.pz, dt, 1.2); return; }
  if (!u.nav || u.repathT <= 0) { u.repathT = 0.6; aiGoto(g, u, z.x, z.z, true, 800); }
  if (!follow(g, u, dt, 1.2)) steer(g, u, z.px, z.pz, dt, 1.2);
}
function hostile(g, u, dt) {
  const w = u.weaponStats();
  let t = null, bd = 13;
  for (const o of g.units) {
    if (!o.alive || !(o.kind === 'hero' || o.faction === 'ally') || o.px === undefined) continue;
    const d = d2(o, u);
    if (d < bd && los(g.map, u.x, u.z, o.x, o.z)) { bd = d; t = o; }
  }
  if (u.hp < u.maxHp * 0.3 && !u.ai.boss && t) {
    if (!u.ai.fleeMsg) { u.ai.fleeMsg = true; g.log(`🏃 ${u.name} está fugindo!`, 'info'); }
    steer(g, u, u.px * 2 - t.px, u.pz * 2 - t.pz, dt, 1.4);
    return;
  }
  if (!t) {
    const hero = g.liveHeroes.slice().sort((a, b) => d2(a, u) - d2(b, u))[0];
    if (hero && d2(hero, u) < 20) { u.repathT = (u.repathT ?? 0) - dt; if (!u.nav || u.repathT <= 0) { u.repathT = 1; aiGoto(g, u, hero.x, hero.z, true, 1200); } follow(g, u, dt, 1.2); }
    else u.rtAnim = null;
    return;
  }
  engage(g, u, t, dt);
}
function humanAttack(g, u, t) {
  const view = g.S.units;
  const w = u.weaponStats();
  u.atkCd = g.atkCooldown(u, w) * 1.4;
  u.face = Math.atan2(t.px - u.px, t.pz - u.pz);
  view.play(u, w.tipo === 'distancia' ? 'shoot' : 'attack');
  if (w.tipo === 'distancia') { if (u.eq.mao) u.eq.mao.loaded = Math.max(0, (u.eq.mao.loaded || 0) - 1); view.tracer(u.x, u.z, t.x, t.z); }
  g.noise(u.x, u.z, w.ruido || 2, u);
  const ch = hitChance(g, u, t, w);
  g.later(0.15, () => {
    if (!t.alive || !u.alive) return;
    if (rng.next() * 100 < ch) {
      const r = rollDamage(g, u, t, w);
      g.damage(t, r.dmg, u, r);
      if (t.kind === 'hero' && u.faction === 'hostile') g.log(`🔫 ${u.name} acertou <b>${t.name}</b> (${r.dmg}).`, 'perigo');
      if (t.kind === 'zombie' && t.alive) { t.ai.state = 'hunt'; t.ai.target = u.uid; }
    } else view.floatText(t.x, t.z, 'Errou!', 'miss');
  });
}
