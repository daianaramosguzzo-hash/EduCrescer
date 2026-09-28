// Estado do jogo (tudo que é salvo) e regras de inventário e atributos.
import { ITEMS, item } from '../data/items.js';
import { CHARACTERS, CHARACTER_ORDER } from '../data/characters.js';
import { SKILLS, xpForLevel } from '../data/skills.js';
import { START_POS } from '../data/regions.js';
import { FIRST_QUEST } from '../data/quests.js';

export const SAVE_VERSION = 1;

export function newCharState(id) {
  const C = CHARACTERS[id];
  const ch = {
    id, unlocked: !!C.unlocked, level: 1, xp: 0, points: 0, skills: {},
    hp: C.base.vida, energy: C.base.energia, hunger: 85, thirst: 80, sick: 0,
    inv: new Array(24).fill(null), equip: {}, seen: {}, learned: [],
    x: C.home[0], z: C.home[1], rot: 0,
  };
  if (C.start.arma) ch.equip.arma = makeStack(C.start.arma, 1);
  if (C.start.torso) ch.equip.torso = makeStack(C.start.torso, 1);
  for (const [it, n] of C.start.items) addItem(ch, it, n);
  for (const s of Object.values(ch.equip)) if (s) ch.seen[s.id] = true;
  return ch;
}

export function newGameState() {
  const chars = {};
  for (const id of CHARACTER_ORDER) chars[id] = newCharState(id);
  chars.arthur.x = START_POS.x; chars.arthur.z = START_POS.z; chars.arthur.rot = -Math.PI / 2;
  // Arthur acorda cansado, com fome e sede
  Object.assign(chars.arthur, { hp: 72, hunger: 55, thirst: 45, energy: 70 });
  return {
    version: SAVE_VERSION, created: Date.now(), active: 'arthur', chars,
    time: 8 * 60, day: 1, // minutos do jogo desde 00:00 do dia 1
    world: { nodes: {}, containers: {}, doors: {}, pickups: {}, discovered: ['bairro'], unlocked: ['bairro', 'mata', 'rio'], bossesDead: {}, fixedDead: {} },
    base: { structures: [], next: 1 },
    quests: { active: { [FIRST_QUEST]: { p: [] } }, done: [] },
    bags: [], flags: {}, stats: { kills: 0, crafted: 0, built: 0, deaths: 0 },
  };
}

// ---------------- pilhas de itens ----------------
export function makeStack(id, n = 1) {
  const d = item(id);
  const s = { id, n };
  if (d.dur) s.d = d.dur;
  if (d.weapon && d.weapon.mag) s.a = 0;
  return s;
}
export const cloneStack = s => s ? { ...s } : null;

// capacidade de espaços do inventário
export function capacity(ch) {
  const C = CHARACTERS[ch.id];
  let n = C.base.slots;
  const bag = ch.equip.mochila;
  if (bag) n += item(bag.id).stats.slots || 0;
  n += (ch.skills.mochileiro || 0) * SKILLS.mochileiro.slots;
  return Math.min(n, ch.inv.length);
}
export function countItem(ch, id) {
  let n = 0;
  for (const s of ch.inv) if (s && s.id === id) n += s.n;
  return n;
}
// adiciona; devolve quanto sobrou (não coube)
export function addToSlots(slots, cap, id, n, extra = null) {
  const d = item(id);
  if (!d) return n;
  if (d.stack > 1 && !extra) {
    for (let i = 0; i < cap && n > 0; i++) {
      const s = slots[i];
      if (s && s.id === id && s.n < d.stack) { const k = Math.min(n, d.stack - s.n); s.n += k; n -= k; }
    }
  }
  for (let i = 0; i < cap && n > 0; i++) {
    if (!slots[i]) {
      const k = Math.min(n, d.stack);
      slots[i] = extra ? { ...extra, id, n: k } : makeStack(id, k);
      n -= k;
    }
  }
  return n;
}
export function addItem(ch, id, n = 1, extra = null) {
  const left = addToSlots(ch.inv, capacity(ch), id, n, extra);
  if (n - left > 0) ch.seen[id] = true;
  return left;
}
export function removeFromSlots(slots, id, n) {
  for (let i = slots.length - 1; i >= 0 && n > 0; i--) {
    const s = slots[i];
    if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) slots[i] = null; }
  }
  return n;
}
export function removeItem(ch, id, n = 1) { return removeFromSlots(ch.inv, id, n) === 0; }
export function freeSlots(ch) { let k = 0; const c = capacity(ch); for (let i = 0; i < c; i++) if (!ch.inv[i]) k++; return k; }
// cabe tudo?
export function canFit(ch, id, n) {
  const copy = ch.inv.map(cloneStack);
  return addToSlots(copy, capacity(ch), id, n) === 0;
}
// junta pilhas e empurra itens que ficaram além da capacidade (quando tira a mochila)
export function compact(ch) {
  const cap = capacity(ch);
  const over = [];
  for (let i = cap; i < ch.inv.length; i++) if (ch.inv[i]) { over.push(ch.inv[i]); ch.inv[i] = null; }
  const left = [];
  for (const s of over) {
    const d = item(s.id);
    if (d.stack > 1) { const k = addToSlots(ch.inv, cap, s.id, s.n); if (k) left.push({ ...s, n: k }); }
    else { const i = ch.inv.findIndex((x, j) => j < cap && !x); if (i >= 0) ch.inv[i] = s; else left.push(s); }
  }
  return left; // o que não coube (vai para o chão)
}

// ---------------- atributos ----------------
export function derived(ch) {
  const C = CHARACTERS[ch.id], sk = ch.skills;
  const lv = ch.level - 1;
  const out = {
    maxHp: C.base.vida + lv * 5 + (sk.vitalidade || 0) * SKILLS.vitalidade.hp,
    maxEnergy: C.base.energia + lv * 2 + (sk.folego || 0) * SKILLS.folego.energy,
    def: C.base.defesa + (sk.couro || 0) * SKILLS.couro.def,
    dmg: C.base.dano * (1 + lv * 0.03),
    speed: C.base.velocidade * (1 + (sk.corredor || 0) * SKILLS.corredor.speed),
    slots: capacity(ch),
    melee: 1 + (sk.forca || 0) * SKILLS.forca.melee + (C.special.melee || 0),
    ranged: 1 + (sk.pontaria || 0) * SKILLS.pontaria.ranged,
    stealth: (sk.passos || 0) * SKILLS.passos.stealth,
    decay: 1 - (sk.estomago || 0) * SKILLS.estomago.decay,
  };
  for (const s of Object.values(ch.equip)) {
    if (!s) continue;
    const st = item(s.id).stats;
    if (!st) continue;
    out.def += st.def || 0;
    out.speed *= 1 + (st.speed || 0);
  }
  // fome e sede baixas enfraquecem
  if (ch.hunger < 20 || ch.thirst < 20) { out.speed *= 0.9; out.dmg *= 0.85; }
  if (ch.sick > 0) { out.speed *= 0.92; }
  return out;
}

export function weaponOf(ch) {
  const s = ch.equip.arma;
  return s ? { stack: s, def: item(s.id) } : { stack: null, def: ITEMS.punhos };
}

export function xpNeeded(ch) { return xpForLevel(ch.level); }
