// Fabricação: descobre receitas, confere estação, nível e materiais
// (inventário + baús da base quando o jogador está na base).
import { R, bus } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { RECIPES, STATIONS } from '../data/recipes.js';
import { item } from '../data/items.js';
import { CHARACTERS } from '../data/characters.js';
import { SKILLS } from '../data/skills.js';
import { countItem, removeFromSlots, makeStack } from './state.js';
import { inBase } from '../data/regions.js';

export class Crafting {
  constructor(G) { this.G = G; }
  // baús da base (usados como estoque quando se está na base)
  baseStorage() {
    const G = this.G;
    if (!inBase(G.player.x, G.player.z, 4)) return [];
    return G.state.base.structures.filter(s => s.items);
  }
  available(id) {
    let n = countItem(this.G.player.ch, id);
    for (const s of this.baseStorage()) for (const it of s.items) if (it && it.id === id) n += it.n;
    return n;
  }
  // consome do inventário primeiro, depois dos baús
  consume(id, n) {
    const ch = this.G.player.ch;
    n = removeFromSlots(ch.inv, id, n);
    for (const s of this.baseStorage()) { if (n <= 0) break; n = removeFromSlots(s.items, id, n); }
    return n <= 0;
  }
  hasAll(cost) { return cost.every(([id, n]) => this.available(id) >= n); }
  pay(cost, allowSave = true) {
    const ch = this.G.player.ch, C = CHARACTERS[ch.id];
    const saveChance = allowSave ? (C.special.save || 0) + (ch.skills.engenhoso || 0) * SKILLS.engenhoso.save : 0;
    const saved = [];
    for (const [id, n] of cost) {
      let k = n;
      if (saveChance && R() < saveChance) { k = Math.max(0, n - Math.ceil(n * 0.5)); saved.push(item(id).name); }
      this.consume(id, k);
    }
    return saved;
  }
  // estações construídas perto do jogador
  stationsNear() {
    const G = this.G, set = new Set(['mao']);
    for (const s of G.state.base.structures) {
      const def = G.building.def(s);
      if (def.station && Math.hypot(s.x - G.player.x, s.z - G.player.z) < 5) set.add(def.station);
    }
    return set;
  }
  discovered(r) {
    const ch = this.G.player.ch;
    if (r.blueprint) {
      const key = r.blueprint === true ? r.out : r.blueprint;
      return ch.learned.includes(key);
    }
    return r.needs.every(([id]) => ch.seen[id]) || ch.learned.includes(r.out);
  }
  status(r, stations = this.stationsNear()) {
    const ch = this.G.player.ch;
    const known = this.discovered(r);
    const levelOk = ch.level >= r.level;
    const stationOk = stations.has(r.station);
    const mats = r.needs.map(([id, n]) => ({ id, n, have: this.available(id) }));
    const matsOk = mats.every(m => m.have >= m.n);
    return { known, levelOk, stationOk, mats, matsOk, can: known && levelOk && stationOk && matsOk };
  }
  craft(r) {
    const G = this.G, ch = G.player.ch;
    const st = this.status(r);
    if (!st.can) { sfx('denied'); return false; }
    const saved = this.pay(r.needs);
    const extra = {};
    const d = item(r.out);
    let dur = null;
    if (d.dur) dur = Math.round(d.dur * (1 + (ch.skills.artesao || 0) * SKILLS.artesao.dura));
    let left;
    if (dur) { left = 0; for (let i = 0; i < r.n; i++) left += G.giveItem(r.out, 1, true, { ...makeStack(r.out, 1), d: dur }); }
    else left = G.giveItem(r.out, r.n, true);
    sfx('craft');
    G.ui.toast(`Fabricado: ${d.icon} ${d.name}${r.n > 1 ? ' x' + r.n : ''}` + (saved.length ? ` (economizou ${saved.join(', ')})` : ''), 'good');
    G.addXp(6 + r.level * 3);
    G.state.stats.crafted++;
    bus.emit('craft', { id: r.out, n: r.n });
    G.player.model.anim.play('build', { dur: 0.6 });
    return true;
  }
  // ao ganhar um item novo, avisa sobre receitas descobertas
  checkDiscover(before) {
    const ch = this.G.player.ch;
    for (const r of RECIPES) {
      if (r.blueprint || ch.learned.includes(r.out)) continue;
      if (before.has(r.id)) continue;
      if (this.discovered(r)) { this.G.ui.toast(`📜 Receita descoberta: ${item(r.out).name}`, 'info'); before.add(r.id); }
    }
  }
  knownSet() { return new Set(RECIPES.filter(r => this.discovered(r)).map(r => r.id)); }
}
export { STATIONS };
