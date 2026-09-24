// Regras de combate: chance de acerto, cobertura, dano, críticos, ataque surpresa,
// mordidas, sangramento e infecção.
import { ZOMBIES } from '../data/zombies.js';
import { effStat, armor } from './units.js';
import { los } from './vision.js';
import { rng, clamp } from '../util.js';

export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

// cobertura do alvo contra o atacante (0, 1 = meia, 2 = total)
export function coverBetween(map, att, def) {
  if (cheb(att, def) <= 1) return 0;
  const sx = Math.sign(att.x - def.x), sz = Math.sign(att.z - def.z);
  let c = 0;
  const cells = sx && sz ? [[def.x + sx, def.z], [def.x, def.z + sz], [def.x + sx, def.z + sz]] : [[def.x + sx, def.z + sz]];
  for (const [x, z] of cells) {
    if (x === att.x && z === att.z) continue;
    c = Math.max(c, Math.min(1, map.cover(x, z)));
  }
  // parede inteira colada só protege meio corpo (dá para mirar pela quina)
  return c;
}

// alvo "desprevenido" (ataque surpresa)
export function unaware(att, def) {
  if (def.kind === 'zombie') return def.ai.state !== 'hunt' || def.ai.target !== att.uid;
  if (def.kind === 'npc') return def.ai.state === 'idle' && !def.ai.alert;
  return false;
}

export function hitChance(g, att, def, w) {
  const d = dist(att, def);
  let p = w.prec;
  if (att.kind === 'hero') {
    const pre = effStat(att, 'precisao');
    if (w.tipo === 'corpo') p += (pre - 5) * 2 + (effStat(att, 'forca') - 5) * 1.5;
    else p += (pre - 5) * 4;
    if (w.classe === 'sling' || w.tipo === 'arremesso') p += [0, 15, 25, 35][att.skill('estilingada')];
    if (w.tipo === 'distancia' && w.classe !== 'sling' && att.hasPerk('mao_firme')) p += 10;
    if (att.st.aim) p += 15 * att.st.aim;
    if (att.need.energia < 20) p -= 10;
    if (att.st.drunk) p -= 15;
    if (att.st.panic) p -= 15;
    if (att.st.ran) p -= 10;
  }
  if (w.tipo !== 'corpo') {
    const opt = Math.max(1.5, (w.alcance || 6) * 0.5);
    if (d > opt) p -= (d - opt) * (w.classe === 'shotgun' ? 10 : 4);
    const cov = coverBetween(g.map, att, def);
    p -= cov === 1 ? 20 : cov >= 2 ? 40 : 0;
    if (g.isNight() && g.lightLevel(def.x, def.z) < 0.25) p -= 15;
  }
  if (def.kind === 'zombie') p -= ZOMBIES[def.type].esquiva || 0;
  if (def.st.stun) p += 20;
  if (def.st.hidden && def.kind !== 'zombie') p -= 20;
  if (def.st.defend) p -= 15;
  if (def.st.downed) p += 30;
  return clamp(Math.round(p), 5, 95);
}

export function inRange(g, att, def, w) {
  if (w.tipo === 'corpo') return cheb(att, def) <= (w.alcance || 1);
  if (dist(att, def) > (w.alcance || 6) + 0.5) return false;
  return los(g.map, att.x, att.z, def.x, def.z);
}

export function rollDamage(g, att, def, w, opts = {}) {
  let d = rng.int(w.dano[0], w.dano[1]);
  const melee = w.tipo === 'corpo';
  let crit = false, sneak = false;
  if (att.kind === 'hero') {
    if (melee) d += effStat(att, 'forca') - 5 + (att.hasPerk('acougueiro') ? 2 : 0);
    if (melee && att.st.surto) d *= 1.5;
    if (melee && att.id === 'pablicio' && att.hp < att.maxHp * 0.4) d *= 1.25;
    const critCh = 3 + effStat(att, 'sorte') * 1.5 + (opts.aimed ? 5 : 0);
    if (rng.next() * 100 < critCh) { crit = true; d *= 1.8; }
    if (melee && unaware(att, def)) { sneak = true; d *= (w.furtivo || 1.6); }
  } else if (att.kind === 'zombie') {
    const Z = ZOMBIES[att.type];
    if (Z.emboscada && opts.ambush) { d *= Z.emboscada; sneak = true; }
    if (g.isNight()) d *= 1.1;
    d *= g.diff.zdmg;
    if (rng.next() < 0.05) { crit = true; d *= 1.5; }
  } else {
    if (rng.next() < 0.06) { crit = true; d *= 1.6; }
  }
  if (def.kind === 'hero') {
    const ar = armor(def);
    d *= (1 - ar.dano);
    if (def.need.moral < 20) d *= 1.1;
  }
  if (def.st.defend) d *= 0.5;
  if (def.st.protetor && def.kind === 'hero') d *= 0.85;
  return { dmg: Math.max(1, Math.round(d)), crit, sneak };
}

// ferimentos causados por zumbis
export function zombieWound(g, z, hero) {
  const Z = ZOMBIES[z.type];
  const ar = armor(hero);
  const bite = rng.next() < Z.mordida * (1 - ar.mordida) * (1 - (hero.stats.resistencia - 5) * 0.04);
  if (bite) {
    hero.wounds.push({ tipo: 'mordida', grav: 2, tratado: false });
    hero.st.infected = true;
    hero.need.infeccao = Math.min(100, hero.need.infeccao + 12);
    return 'mordida';
  }
  if (rng.next() < 0.35) {
    hero.wounds.push({ tipo: 'arranhão', grav: 1, tratado: false });
    if (rng.next() < 0.5) hero.st.bleed = Math.max(hero.st.bleed || 0, 1);
    if (rng.next() < 0.15) { hero.st.infected = true; hero.need.infeccao = Math.min(100, hero.need.infeccao + 4); }
    return 'arranhão';
  }
  return null;
}
