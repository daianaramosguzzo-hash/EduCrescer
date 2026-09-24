// Inteligência artificial: zumbis (vagar, ouvir, caçar, arrombar portas, especiais)
// e humanos (neutros, hostis e aliados que seguem o grupo).
import { ZOMBIES } from '../data/zombies.js';
import { NPCS } from '../data/npcs.js';
import { ITEMS } from '../data/items.js';
import { los } from './vision.js';
import { findPath } from './path.js';
import { hitChance, rollDamage, zombieWound, inRange, cheb, dist } from './combat.js';
import { effStat } from './units.js';
import { rng, bus, clamp, wait } from '../util.js';
import { S } from '../world/tiles.js';

let pending = [];

export async function runAI(g) {
  pending = [];
  const heroes = g.liveHeroes;
  const nearest = u => { let d = 999; for (const h of heroes) d = Math.min(d, Math.hypot(h.x - u.x, h.z - u.z)); return d; };
  const list = g.units.filter(u => u.alive && u.kind !== 'hero').map(u => ({ u, d: nearest(u) })).sort((a, b) => a.d - b.d);
  for (const { u, d } of list) {
    if (!u.alive || g.phase === 'over') continue;
    g.aiCurrent = u; // ajuda a depurar turnos travados
    try {
      if (u.kind === 'zombie') await zombieTurn(g, u, d);
      else await npcTurn(g, u, d);
    } catch (e) { console.error('IA', e); }
  }
  g.aiCurrent = 'pending';
  await Promise.all(pending);
  g.aiCurrent = null;
  g.updateVision();
  g.updateMode();
}

// passo de movimento (anima se estiver à vista)
function step(g, u, x, z, anim = 'walk') {
  const from = [u.x, u.z];
  u.face = Math.atan2(x - u.x, z - u.z);
  u.x = x; u.z = z;
  const view = g.S.units;
  const seen = g.visible.has(g.map.idx(from[0], from[1])) || g.visible.has(g.map.idx(x, z));
  if (seen) pending.push(view.moveTo(u, x, z, anim === 'run' ? 6 : 3.4, anim));
  else view.snap(u);
  if (u.kind === 'zombie' && g.map.gas.has(g.map.idx(x, z))) { /* zumbi não liga para gás */ }
}

// ------------------------------------------------------------ percepção
function perceive(g, z) {
  const Z = ZOMBIES[z.type];
  const night = g.isNight();
  let best = null, bestScore = 1e9;
  // provocação do Pablício
  const prot = g.liveHeroes.find(h => h.st.protetor && Math.hypot(h.x - z.x, h.z - z.z) <= 4.5);
  if (prot && los(g.map, z.x, z.z, prot.x, prot.z)) return prot;
  for (const t of g.units) {
    if (!t.alive || t.kind === 'zombie' || t.gone) continue;
    // sobreviventes longe do grupo "se viram sozinhos" (não morrem fora da tela)
    if (t.kind === 'npc' && t.faction !== 'ally' && !g.liveHeroes.some(h => Math.hypot(h.x - t.x, h.z - t.z) < 14)) continue;
    const d = Math.hypot(t.x - z.x, t.z - z.z);
    let sight = Z.visao;
    if (night) sight = Math.max(3, sight * 0.55);
    if (g.state.weather.chuva) sight -= 1.5;
    const lit = g.lightLevel(t.x, t.z);
    if (night && lit > 0.5) sight += 4;
    if (t.kind === 'hero' && night && g.flashlightOn(t)) sight += 5;
    if (d > sight + 0.5) continue;
    if (!los(g.map, z.x, z.z, t.x, t.z)) continue;
    let notice = z.ai.state === 'hunt' && z.ai.target === t.uid;
    if (!notice) {
      if (t.st.hidden && d > 1.5) { if (rng.next() > 0.06) continue; }
      const furt = t.kind === 'hero' ? effStat(t, 'furtividade') : 4;
      let ch = 0.92 - (furt - 3) * 0.07 + (sight - d) * 0.05;
      if (t.st.ran) ch += 0.3;
      if (t.st.hidden) ch -= 0.35;
      if (!night && lit < 0.4) ch -= 0.1;
      if (d <= 1.5) ch = 0.97;
      notice = rng.next() < clamp(ch, 0.05, 0.97);
      if (!notice) { z.ai.state = 'investigate'; z.ai.noise = { x: t.x, z: t.z, turn: g.state.turn }; }
    }
    if (!notice) continue;
    const score = d + (t.st.downed ? -1 : 0) + (t.kind === 'npc' ? 1.5 : 0);
    if (score < bestScore) { bestScore = score; best = t; }
  }
  return best;
}

// ------------------------------------------------------------ zumbis
async function zombieTurn(g, z, nearD) {
  const Z = ZOMBIES[z.type];
  const map = g.map;
  z.ap = Z.pa + (g.isNight() ? 1 : 0) - (g.hour() >= 12 && g.hour() < 15 ? 1 : 0);
  if (z.st.stun) { z.st.stun--; return; }
  if (z.st.burn) {
    z.st.burn--;
    g.damage(z, rng.int(4, 7), null, { noBlood: true });
    if (!z.alive) return;
  }
  // zumbis longe demais ficam "dormindo"
  if (nearD > 42 && z.ai.state !== 'hunt' && z.ai.state !== 'investigate') {
    if (rng.next() < 0.15) wander(g, z, 1);
    return;
  }
  const target = perceive(g, z);
  if (target) {
    if (z.ai.state !== 'hunt' || z.ai.target !== target.uid) {
      if (g.unitVisible(z)) g.S.units.floatText(z.x, z.z, '❗', 'alert');
      if (target.kind === 'hero' && g.unitVisible(z) && rng.next() < 0.25) g.log(`👁️ ${Z.nome} avistou <b>${target.name}</b>!`, 'alerta');
    }
    z.ai.state = 'hunt'; z.ai.target = target.uid; z.ai.last = [target.x, target.z]; z.ai.lost = 0;
    if (z.st.hidden && cheb(z, target) <= 3) { z.st.hidden = false; z.ai.ambush = true; }
  } else if (z.ai.state === 'hunt') {
    z.ai.lost = (z.ai.lost || 0) + 1;
    if (z.ai.lost > 3) { z.ai.state = 'wander'; z.ai.last = null; }
  }
  // ---------------- especiais
  if (z.type === 'pamonheiro' && target) {
    z.ai.cd = (z.ai.cd || 0) - 1;
    if (z.ai.cd <= 0 && z.ap >= 3) {
      z.ai.cd = 4; z.ap -= 3;
      await g.S.units.whenIdle(z);
      g.S.units.say(z, rng.pick(['PAMONHA, PAMONHA, PAMONHA!', 'Olha a pamonha fresquinha!', 'É PAMONHA DE PIRACICA... DE AIMORÉS!', 'Pamonha caseeeeira!']));
      await g.S.units.play(z, 'attack');
      g.noise(z.x, z.z, Z.grito, z);
      for (const o of g.units) if (o.kind === 'zombie' && o.alive && o !== z && Math.hypot(o.x - z.x, o.z - z.z) < Z.grito) { o.ai.state = 'hunt'; o.ai.target = target.uid; o.ai.last = [target.x, target.z]; }
      g.log('📢 O Zumbi Pamonheiro gritou no megafone! Zumbis da região estão vindo!', 'perigo');
      g.S.shake = 0.3;
    }
    // mantém distância
    if (cheb(z, target) <= 2 && z.ap > 0) { fleeStep(g, z, target); z.ap--; }
  }
  if (z.type === 'matriz' && target) {
    z.ai.cd = (z.ai.cd || 0) - 1;
    if (z.ai.cd <= 0) {
      z.ai.cd = Z.brotos;
      let n = 0;
      for (const [dx, dz] of rng.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]])) {
        const nx = z.x + dx, nz = z.z + dz;
        if (n < 2 && !map.blocked(nx, nz) && !g.unitAt(nx, nz)) { const b = g.spawnZombie('comum', nx, nz, { look: 'z_comum_a' }); b.name = 'Broto da Matriz'; b.maxHp = b.hp = 14; b.ai.state = 'hunt'; b.ai.target = target.uid; n++; }
      }
      if (n) { g.S.units.say(z, 'CRESÇAM... CRESÇAAAM!'); g.log('🌱 A Matriz fez brotar novos zumbis do chão!', 'perigo'); }
    }
    const d = dist(z, target);
    if (d > 1.5 && d <= Z.raizes + 0.5 && z.ap >= 3 && los(map, z.x, z.z, target.x, target.z)) {
      z.ap -= 3;
      await g.S.units.whenIdle(z);
      z.face = Math.atan2(target.x - z.x, target.z - z.z);
      await g.S.units.play(z, 'attack');
      g.S.units.burst(target.x, target.z, '#7cc24a', 2);
      if (rng.next() * 100 < 70) {
        g.damage(target, rng.int(8, 13), z);
        target.st.stun = Math.max(target.st.stun || 0, 1);
        g.log(`🌿 Raízes brotaram do chão e prenderam <b>${target.name}</b>!`, 'perigo');
      } else g.S.units.floatText(target.x, target.z, 'Desviou!', 'miss');
    }
  }
  if (Z.furtivo && !target && z.ai.state !== 'investigate') {
    // fica à espreita no escuro
    z.st.hidden = true;
    return;
  }
  // ---------------- ações
  let guard = 12;
  while (z.ap > 0 && z.alive && guard-- > 0) {
    let t = target && target.alive && !target.gone ? target : null;
    if (t && cheb(z, t) <= 1) {
      if (z.ap < 2) break;
      await zombieAttack(g, z, t);
      z.ap -= 2;
      if (!t.alive || (t.kind === 'hero' && t.dead)) break;
      continue;
    }
    let goal = null;
    if (t) goal = [t.x, t.z];
    else if (z.ai.state === 'hunt' && z.ai.last) goal = z.ai.last;
    else if (z.ai.state === 'investigate' && z.ai.noise) goal = [z.ai.noise.x, z.ai.noise.z];
    if (!goal) { if (rng.next() < 0.4) wander(g, z, Math.min(2, z.ap)); break; }
    if (Math.max(Math.abs(z.x - goal[0]), Math.abs(z.z - goal[1])) <= (t ? 1 : 0)) {
      if (!t) { z.ai.state = 'wander'; z.ai.noise = null; z.ai.last = null; }
      break;
    }
    const path = findPath(map, z.x, z.z, goal[0], goal[1], { goalAdjacent: !!t, occupied: g.occupied, maxNodes: 1400, breakDoors: true });
    if (!path || !path.length) {
      // tenta um passo "burro" na direção do alvo
      const sx = Math.sign(goal[0] - z.x), sz = Math.sign(goal[1] - z.z);
      const opts = [[sx, sz], [sx, 0], [0, sz]].filter(([a, b]) => a || b);
      let moved = false;
      for (const [dx, dz] of opts) {
        const nx = z.x + dx, nz = z.z + dz;
        const door = map.doors.get(map.idx(nx, nz));
        if (door && (!door.open || door.barricade)) { await bashDoor(g, z, door); z.ap -= 2; moved = true; break; }
        if (!map.blocked(nx, nz) && !g.unitAt(nx, nz)) { step(g, z, nx, nz); z.ap--; moved = true; break; }
      }
      if (!moved) { if (!t) { z.ai.state = 'wander'; z.ai.noise = null; } break; }
      continue;
    }
    const [nx, nz] = path[0];
    const di = map.idx(nx, nz);
    const door = map.doors.get(di);
    if (door && (!door.open || door.barricade > 0)) { await bashDoor(g, z, door); z.ap -= 2; continue; }
    if (map.struct[di] === S.WINDOW) { const w = map.windows.get(di); if (w && !w.broken) { await breakWindow(g, z, w); z.ap -= 2; continue; } }
    if (g.unitAt(nx, nz)) break;
    step(g, z, nx, nz, Z.corre && t ? 'run' : 'walk');
    z.ap -= 1;
  }
}

function wander(g, z, n) {
  const home = z.ai.home || [z.x, z.z];
  const R = z.ai.wander ?? 5;
  for (let i = 0; i < n; i++) {
    const opts = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = z.x + dx, nz = z.z + dz;
      if (g.map.blocked(nx, nz) || g.unitAt(nx, nz)) continue;
      if (Math.hypot(nx - home[0], nz - home[1]) > R + 0.5) continue;
      if (g.map.floor[g.map.idx(nx, nz)] === 12) continue;
      opts.push([nx, nz]);
    }
    if (!opts.length) return;
    const [nx, nz] = rng.pick(opts);
    step(g, z, nx, nz);
  }
}
function fleeStep(g, u, from) {
  let best = null, bd = -1;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const nx = u.x + dx, nz = u.z + dz;
    if (g.map.blocked(nx, nz) || g.unitAt(nx, nz)) continue;
    const d = Math.hypot(nx - from.x, nz - from.z);
    if (d > bd) { bd = d; best = [nx, nz]; }
  }
  if (best) step(g, u, best[0], best[1], 'run');
}

async function zombieAttack(g, z, t) {
  const Z = ZOMBIES[z.type];
  const view = g.S.units;
  await view.whenIdle(z);
  z.face = Math.atan2(t.x - z.x, t.z - z.z);
  const w = z.weaponStats();
  const seen = g.unitVisible(z) || t.kind === 'hero';
  if (seen) await view.play(z, 'attack');
  const ch = hitChance(g, z, t, w);
  g.noise(z.x, z.z, 3, z);
  if (rng.next() * 100 < ch) {
    const r = rollDamage(g, z, t, w, { ambush: z.ai.ambush });
    z.ai.ambush = false;
    g.damage(t, r.dmg, z, r);
    if (t.kind === 'hero' && !t.dead) {
      const wnd = zombieWound(g, z, t);
      if (wnd === 'mordida') { g.log(`🩸 <b>${t.name}</b> levou uma mordida! A infecção começou.`, 'perigo'); view.floatText(t.x, t.z, 'MORDIDA!', 'bite'); }
      else if (wnd === 'arranhão') g.log(`${Z.nome} arranhou <b>${t.name}</b> (${r.dmg}).`, 'alerta');
      else g.log(`${Z.nome} acertou <b>${t.name}</b> (${r.dmg}).`, 'alerta');
      t.need.moral = Math.max(0, t.need.moral - 4);
      if (Z.empurra) knockback(g, t, z);
    }
  } else {
    view.floatText(t.x, t.z, 'Esquivou!', 'miss');
  }
  if (seen) await wait(90 / (g.speed || 1));
}
function knockback(g, t, from) {
  const dx = Math.sign(t.x - from.x), dz = Math.sign(t.z - from.z);
  const nx = t.x + dx, nz = t.z + dz;
  if (!g.map.blocked(nx, nz) && !g.unitAt(nx, nz)) { t.x = nx; t.z = nz; pending.push(g.S.units.moveTo(t, nx, nz, 7, 'hurt')); g.S.units.floatText(t.x, t.z, 'Empurrão!', 'miss'); }
}
async function bashDoor(g, z, door) {
  const Z = ZOMBIES[z.type];
  await g.S.units.whenIdle(z);
  z.face = Math.atan2(door.x - z.x, door.z - z.z);
  const near = g.liveHeroes.some(h => Math.hypot(h.x - door.x, h.z - door.z) < 12);
  if (g.visible.has(g.map.idx(z.x, z.z))) await g.S.units.play(z, 'attack');
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
      g.updateVision();
    }
  }
  g.noise(door.x, door.z, 7, z);
  if (near && rng.next() < 0.3) g.log('💥 <i>BAM! BAM!</i> Alguma coisa está esmurrando uma porta...', 'alerta');
}
async function breakWindow(g, z, w) {
  w.broken = true;
  bus.emit('sfx', 'glass', w.x, w.z);
  g.map.version++;
  const b = g.map.building[g.map.idx(w.x, w.z)];
  if (b >= 0) g.S.world.buildBuilding(g.map.buildings[b]);
  g.noise(w.x, w.z, 8, z);
  if (g.liveHeroes.some(h => Math.hypot(h.x - w.x, h.z - w.z) < 12)) g.log('🪟 Vidro estilhaçado! Um zumbi quebrou uma janela.', 'alerta');
}

// ------------------------------------------------------------ humanos
async function npcTurn(g, u, nearD) {
  u.ap = u.maxAp;
  if (u.st.stun) { u.st.stun--; return; }
  if (u.st.fled) return;
  const map = g.map;
  const view = g.S.units;
  if (u.ai.alert > 0) u.ai.alert--;
  if (u.faction === 'hostile') return hostileTurn(g, u);
  // zumbis colados
  const zs = g.units.filter(z => z.alive && z.kind === 'zombie' && cheb(z, u) <= (u.faction === 'ally' ? 6 : 1) && g.unitVisibleTo(u, z));
  if (u.faction === 'ally') {
    // aliado: ataca zumbis perto ou segue o grupo
    const leader = g.selected && !g.selected.dead ? g.selected : g.liveHeroes[0];
    let guard = 8;
    while (u.ap > 0 && guard-- > 0) {
      const z = zs.filter(z => z.alive).sort((a, b) => dist(a, u) - dist(b, u))[0];
      const w = u.weaponStats();
      if (z && inRange(g, u, z, w) && u.ap >= (w.pa || 2) && (w.tipo !== 'distancia' || (u.eq.mao && u.eq.mao.loaded > 0))) { await humanAttack(g, u, z); u.ap -= w.pa || 2; continue; }
      if (z && dist(z, u) < 5 && w.tipo === 'corpo') {
        const p = findPath(map, u.x, u.z, z.x, z.z, { goalAdjacent: true, occupied: g.occupied, maxNodes: 600 });
        if (p && p.length) { step(g, u, p[0][0], p[0][1]); u.ap--; continue; }
      }
      if (leader && cheb(u, leader) > 2) {
        const p = findPath(map, u.x, u.z, leader.x, leader.z, { goalAdjacent: true, occupied: g.occupied, maxNodes: 1500, allowDoors: true });
        if (p && p.length) {
          const [nx, nz] = p[0];
          const d = map.doors.get(map.idx(nx, nz));
          if (d && !d.open && !d.locked) { d.open = true; g.S.world.refreshDoor(map.idx(nx, nz)); g.map.version++; u.ap--; continue; }
          step(g, u, nx, nz); u.ap--; continue;
        }
      }
      break;
    }
    return;
  }
  // neutro: defende-se ou fica parado
  const adj = zs.find(z => cheb(z, u) <= 1);
  if (adj) {
    const w = u.weaponStats();
    if (u.eq.mao && u.ap >= (w.pa || 2)) { await humanAttack(g, u, adj); return; }
    fleeStep(g, u, adj);
    return;
  }
  if (u.ai.comport === 'vaga' && rng.next() < 0.3) wander(g, u, 1);
}

async function hostileTurn(g, u) {
  const map = g.map;
  const w = u.weaponStats();
  const targets = g.units.filter(t => t.alive && (t.kind === 'hero' || t.faction === 'ally') && !t.gone && dist(t, u) <= 13 && los(map, u.x, u.z, t.x, t.z));
  if (u.hp < u.maxHp * 0.3 && !u.ai.boss) {
    // foge
    const t = targets[0];
    if (t) { fleeStep(g, u, t); fleeStep(g, u, t); if (rng.next() < 0.5) g.log(`🏃 ${u.name} está fugindo!`, 'info'); }
    return;
  }
  let t = targets.sort((a, b) => dist(a, u) - dist(b, u))[0];
  if (!t) {
    // procura quem atacou
    const hero = g.liveHeroes.sort((a, b) => dist(a, u) - dist(b, u))[0];
    if (hero && dist(hero, u) < 20) {
      const p = findPath(map, u.x, u.z, hero.x, hero.z, { goalAdjacent: true, occupied: g.occupied, maxNodes: 1500, allowDoors: true });
      if (p) for (let i = 0; i < Math.min(p.length, u.ap); i++) { const [nx, nz] = p[i]; if (map.blocked(nx, nz) || g.unitAt(nx, nz)) break; step(g, u, nx, nz); }
    }
    return;
  }
  let guard = 8;
  while (u.ap > 0 && guard-- > 0 && t.alive) {
    const ranged = w.tipo === 'distancia';
    if (ranged && u.eq.mao && u.eq.mao.loaded <= 0) { u.eq.mao.loaded = ITEMS[u.eq.mao.id].w.pente; u.ap -= 2; g.log(`${u.name} recarrega a arma.`, 'info'); continue; }
    if (inRange(g, u, t, w) && u.ap >= (w.pa || 2)) { await humanAttack(g, u, t); u.ap -= (w.pa || 2); continue; }
    const p = findPath(map, u.x, u.z, t.x, t.z, { goalAdjacent: true, occupied: g.occupied, maxNodes: 1200 });
    if (!p || !p.length) break;
    step(g, u, p[0][0], p[0][1], 'run'); u.ap--;
  }
}

async function humanAttack(g, u, t) {
  const view = g.S.units;
  const w = u.weaponStats();
  await view.whenIdle(u);
  u.face = Math.atan2(t.x - u.x, t.z - u.z);
  const seen = g.unitVisible(u) || t.kind === 'hero';
  if (seen) await view.play(u, w.tipo === 'distancia' ? 'shoot' : 'attack');
  if (w.tipo === 'distancia') { if (u.eq.mao) u.eq.mao.loaded--; view.tracer(u.x, u.z, t.x, t.z); }
  g.noise(u.x, u.z, w.ruido || 2, u);
  const ch = hitChance(g, u, t, w);
  if (rng.next() * 100 < ch) {
    const r = rollDamage(g, u, t, w);
    g.damage(t, r.dmg, u, r);
    if (t.kind === 'hero') g.log(`🔫 ${u.name} acertou <b>${t.name}</b> (${r.dmg}).`, 'perigo');
  } else view.floatText(t.x, t.z, 'Errou!', 'miss');
  if (seen) await wait(80);
}
