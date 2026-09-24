// Instâncias de Crescemon: status, experiência, golpes.
import { SPECIES, MOVES } from './data.js';

let uidCounter = 1;

export function xpForLevel(l) { return l <= 1 ? 0 : Math.floor(l * l * l * 0.8); }

export function calcStat(base, lvl, isHp) {
  const v = Math.floor((base * 2 * lvl) / 100);
  return isHp ? v + lvl + 10 : v + 5;
}

export function createCreature(sp, lvl) {
  const c = { uid: uidCounter++, sp, lvl, xp: xpForLevel(lvl), moves: [], nick: null };
  const learn = SPECIES[sp].learn.filter(([l]) => l <= lvl).map(([, m]) => m);
  const uniq = [...new Set(learn)].slice(-4);
  c.moves = uniq.map(id => ({ id, pp: MOVES[id].pp }));
  recalc(c);
  c.hp = c.maxhp;
  return c;
}

export function recalc(c) {
  const b = SPECIES[c.sp].base;
  const oldMax = c.maxhp || 0;
  c.maxhp = calcStat(b.hp, c.lvl, true);
  c.atk = calcStat(b.atk, c.lvl);
  c.def = calcStat(b.def, c.lvl);
  c.spd = calcStat(b.spd, c.lvl);
  if (oldMax && c.hp > 0) c.hp = Math.min(c.maxhp, c.hp + (c.maxhp - oldMax));
}

export function nameOf(c) { return c.nick || SPECIES[c.sp].name; }

export function healFull(c) {
  c.hp = c.maxhp;
  for (const m of c.moves) m.pp = MOVES[m.id].pp;
}

// Novos golpes aprendidos exatamente neste nível
export function movesAtLevel(sp, lvl) {
  return SPECIES[sp].learn.filter(([l]) => l === lvl).map(([, m]) => m);
}

export function reviveUid(c) { if (!c.uid || c.uid >= uidCounter) uidCounter = (c.uid || 0) + 1; }
