// Unidades (heróis, zumbis e NPCs), inventário e atributos derivados.
import { ITEMS } from '../data/items.js';
import { HEROES, PERKS } from '../data/heroes.js';
import { ZOMBIES } from '../data/zombies.js';
import { ZOMBIE_LOOKS } from '../sprites/looks.js';
import { rng, clamp } from '../util.js';

let UID = 1;
export function resetUid(v = 1) { UID = v; }
export function peekUid() { return UID; }

export class Unit {
  constructor(o) {
    this.uid = o.uid || UID++;
    if (this.uid >= UID) UID = this.uid + 1;
    this.id = o.id || null;
    this.kind = o.kind;            // hero | zombie | npc
    this.faction = o.faction;      // party | zombie | ally | neutral | hostile
    this.type = o.type || null;    // tipo de zumbi
    this.look = o.look;
    this.name = o.name || '';
    this.x = o.x; this.z = o.z;
    this.face = o.face ?? 0;
    this.hp = o.hp ?? 20; this.maxHp = o.maxHp ?? this.hp;
    this.ap = o.ap ?? 0; this.maxAp = o.maxAp ?? 6;
    this.stats = Object.assign({ forca: 5, velocidade: 5, precisao: 5, resistencia: 5, furtividade: 5, inteligencia: 5, sorte: 5 }, o.stats || {});
    this.st = o.st || {};          // estados: hidden, crouch, aim, defend, stun, bleed, burn, downed, panic, drunk...
    this.inv = o.inv || [];
    this.eq = o.eq || { mao: null, mao2: null, corpo: null, costas: null, cabeca: null };
    this.ai = o.ai || {};
    this.dead = !!o.dead;
    this.gone = !!o.gone;
    this.npc = o.npc || null;      // id do NPC (dados de diálogo)
    // heróis
    if (this.kind === 'hero') {
      this.lvl = o.lvl || 1; this.xp = o.xp || 0;
      this.pts = o.pts || 0; this.spts = o.spts || 0; this.perkPts = o.perkPts || 0;
      this.skills = o.skills || {}; this.perks = o.perks || [];
      this.cd = o.cd || {};
      this.need = o.need || { fome: 85, sede: 80, energia: 90, moral: 70, infeccao: 0 };
      this.wounds = o.wounds || [];
      this.kills = o.kills || 0;
      this.baseHp = o.baseHp || this.maxHp;
      this.flash = o.flash ?? true;
    }
  }
  get isHero() { return this.kind === 'hero'; }
  get alive() { return !this.dead && !this.gone; }
  weapon() { return this.eq.mao ? ITEMS[this.eq.mao.id] : null; }
  weaponStats() {
    const it = this.weapon();
    if (it && it.w) return it.w;
    if (this.kind === 'zombie') { const z = ZOMBIES[this.type]; return { tipo: 'corpo', classe: 'none', dano: z.dano, prec: z.prec, pa: 2, ruido: 1, alcance: z.alcance }; }
    return { tipo: 'corpo', classe: 'none', dano: [2, 4], prec: 85, pa: 2, ruido: 1, alcance: 1, soco: true };
  }
  holdClass() {
    if (this.kind === 'zombie') return 'none';
    const it = this.weapon();
    if (!it || !it.w) return 'none';
    if (it.w.tipo === 'arremesso') return 'none';
    return it.w.classe || 'none';
  }
  hasPerk(p) { return this.perks && this.perks.includes(p); }
  skill(s) { return this.skills ? (this.skills[s] || 0) : 0; }
}

// ------------------------------------------------------------ criação
export function makeHero(id, x, z) {
  const H = HEROES[id];
  const u = new Unit({ id, kind: 'hero', faction: 'party', look: H.look, name: H.nome, x, z, hp: H.hp, maxHp: H.hp, stats: { ...H.stats } });
  u.baseHp = H.hp;
  for (const s of H.skills) u.skills[s] = 1;
  for (const [slot, itemId] of Object.entries(H.eq)) u.eq[slot] = newItem(itemId);
  for (const [itemId, n] of H.inv) addItem(u, itemId, n);
  if (u.eq.mao && ITEMS[u.eq.mao.id].w?.pente) u.eq.mao.loaded = 0;
  recompute(u);
  u.ap = u.maxAp;
  return u;
}
export function makeZombie(type, x, z, extra = {}) {
  const Z = ZOMBIES[type];
  const looks = ZOMBIE_LOOKS[type] || ZOMBIE_LOOKS.comum;
  const look = extra.look || looks[Math.floor(rng.next() * looks.length)];
  const hp = Math.round(Z.hp * (extra.hpMul || 1));
  const u = new Unit({ kind: 'zombie', faction: 'zombie', type, look, name: Z.nome, x, z, hp, maxHp: hp, maxAp: Z.pa, face: rng.next() * 6.28 });
  u.ai = { state: 'idle', home: [x, z], wander: extra.wander ?? 5, ...extra.ai };
  if (Z.furtivo) u.st.hidden = true;
  return u;
}

// ------------------------------------------------------------ itens
export function newItem(id, n = 1) {
  const it = ITEMS[id];
  const o = { id, n };
  if (it.w && it.w.dur && it.w.dur < 999) o.dur = it.w.dur;
  if (it.w && it.w.pente) o.loaded = it.w.pente;
  if (it.carga) o.carga = it.carga;
  if (it.cargas) o.cargas = it.cargas;
  return o;
}
export function stackable(id) { const it = ITEMS[id]; return !it.w && !it.carga && !it.cargas && !it.equip; }
export function addItem(u, id, n = 1) {
  if (stackable(id)) {
    const e = u.inv.find(e => e.id === id);
    if (e) { e.n += n; return e; }
    const o = { id, n }; u.inv.push(o); return o;
  }
  let last;
  for (let i = 0; i < n; i++) { last = newItem(id); u.inv.push(last); }
  return last;
}
export function countItem(u, id) {
  let n = 0;
  for (const e of u.inv) if (e.id === id) n += e.n;
  for (const k of Object.keys(u.eq)) if (u.eq[k] && u.eq[k].id === id) n += u.eq[k].n || 1;
  return n;
}
export function removeItem(u, id, n = 1) {
  for (let i = u.inv.length - 1; i >= 0 && n > 0; i--) {
    const e = u.inv[i];
    if (e.id !== id) continue;
    const take = Math.min(n, e.n);
    e.n -= take; n -= take;
    if (e.n <= 0) u.inv.splice(i, 1);
  }
  return n === 0;
}
export function itemWeight(e) { return (ITEMS[e.id]?.peso || 0) * (e.n || 1); }
export function carried(u) {
  let w = 0;
  for (const e of u.inv) w += itemWeight(e);
  for (const k of Object.keys(u.eq)) if (u.eq[k]) w += itemWeight(u.eq[k]);
  return Math.round(w * 10) / 10;
}
export function capacity(u) {
  let c = 12 + u.stats.forca * 2;
  if (u.eq.costas) c += ITEMS[u.eq.costas.id].capacidade || 0;
  if (u.hasPerk && u.hasPerk('mula')) c += 6;
  if (u.lvl) c += (u.lvl - 1);
  return c;
}
export function armor(u) {
  let a = 0, bite = 0;
  for (const k of ['corpo', 'cabeca']) if (u.eq[k]) { const it = ITEMS[u.eq[k].id]; a += it.armadura || 0; bite += it.mordida || 0; }
  if (u.skill && u.skill('couro_grosso')) a += [0, 0.1, 0.2, 0.3][u.skill('couro_grosso')];
  return { dano: Math.min(0.7, a), mordida: Math.min(0.8, bite) };
}

// ------------------------------------------------------------ atributos derivados (heróis)
export function effStat(u, s) {
  let v = u.stats[s];
  if (u.kind !== 'hero') return v;
  if (s === 'furtividade') { v += u.skill('sumir'); if (u.eq.corpo && ITEMS[u.eq.corpo.id].furtiv) v += ITEMS[u.eq.corpo.id].furtiv; }
  if (s === 'sorte' && u.hasPerk('sortudo')) v += 2;
  const n = u.need;
  if (n.fome < 20 && (s === 'forca' || s === 'precisao')) v -= 1;
  if (n.energia < 20 && (s === 'precisao' || s === 'velocidade')) v -= 1;
  return clamp(v, 1, 14);
}
export function recompute(u) {
  if (u.kind !== 'hero') return;
  u.maxHp = u.baseHp + (u.lvl - 1) * 6 + (u.stats.resistencia - HEROES[u.id].stats.resistencia) * 4 + (u.hasPerk('casca_grossa') ? 15 : 0);
  u.hp = Math.min(u.hp, u.maxHp);
  let ap = 6 + Math.floor(u.stats.velocidade / 3);
  if (u.hasPerk('maratonista')) ap += 1;
  u.maxAp = ap;
}
// PA disponíveis no começo do turno (fome, sede, cansaço, peso, infecção)
export function turnAp(u) {
  let ap = u.maxAp;
  const n = u.need;
  if (n.sede < 20) ap -= 1;
  if (n.energia < 25) ap -= 1;
  if (n.energia < 10) ap -= 1;
  if (n.infeccao >= 25) ap -= 1;
  if (carried(u) > capacity(u)) ap -= 2;
  if (u.st.stun) ap -= 3;
  return Math.max(2, ap);
}
export function visionRange(u) {
  let r = 8 + Math.floor(effStat(u, 'inteligencia') / 3);
  if (u.hasPerk && u.hasPerk('olho_vivo')) r += 2;
  if (u.eq && u.eq.cabeca && u.eq.cabeca.id === 'capacete') r -= 1;
  return r;
}
