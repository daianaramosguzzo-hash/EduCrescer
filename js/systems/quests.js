// Missões, desbloqueio de regiões e descoberta de áreas.
import { dist, bus } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { QUESTS } from '../data/quests.js';
import { REGIONS, regionAt, DANGER, inBase } from '../data/regions.js';
import { CHARACTERS } from '../data/characters.js';
import { item } from '../data/items.js';
import { countItem } from './state.js';

export class Quests {
  constructor(G) {
    this.G = G;
    const on = (ev, fn) => bus.on(ev, d => { if (this.G.state) fn(d); });
    on('craft', d => this.event('craft', d));
    on('build', d => this.event('build', d));
    on('drink', d => this.event('drink', d));
    on('eat', d => this.event('eat', d));
    on('loot', d => this.event('loot', d));
    on('zombieKilled', z => this.event('kill', z));
    this.checkT = 0;
  }
  get S() { return this.G.state.quests; }
  active() { return Object.keys(this.S.active).map(id => QUESTS[id]).filter(Boolean); }
  // progresso: número (contadores) ou true
  prog(qid, i) { const a = this.S.active[qid]; return a ? a.p[i] : null; }
  setProg(qid, i, v) { const a = this.S.active[qid]; if (!a) return; if (a.p[i] === v) return; a.p[i] = v; this.G.ui.refreshQuests(); }
  objDone(q, i) {
    const o = q.objectives[i], G = this.G, ch = G.player.ch;
    const p = this.prog(q.id, i);
    switch (o.type) {
      case 'have': return p === true || countItem(ch, o.item) >= o.n;
      case 'level': return ch.level >= o.n || Object.values(G.state.chars).some(c => c.unlocked && c.level >= o.n);
      case 'lore': return o.items.every(id => Object.values(G.state.chars).some(c => countItem(c, id) > 0) || G.state.flags['lore_' + id]);
      case 'craft': case 'build': case 'kill': case 'loot': return (p || 0) >= (o.n || 1);
      default: return p === true;
    }
  }
  objText(q, i) {
    const o = q.objectives[i], p = this.prog(q.id, i) || 0, ch = this.G.player.ch;
    if (o.type === 'have') return `${o.text} (${p === true ? o.n : Math.min(countItem(ch, o.item), o.n)}/${o.n})`;
    if (['craft', 'build', 'kill', 'loot'].includes(o.type) && (o.n || 1) > 1) return `${o.text} (${Math.min(p, o.n)}/${o.n})`;
    if (o.type === 'lore') { const n = o.items.filter(id => Object.values(this.G.state.chars).some(c => countItem(c, id) > 0) || this.G.state.flags['lore_' + id]).length; return `${o.text} (${n}/${o.items.length})`; }
    return o.text;
  }
  event(type, d) {
    for (const q of this.active()) {
      q.objectives.forEach((o, i) => {
        if (this.objDone(q, i)) return;
        const inc = () => this.setProg(q.id, i, (this.prog(q.id, i) || 0) + (d && d.n && type === 'craft' ? d.n : 1));
        if (type === 'craft' && o.type === 'craft' && d.id === o.item) inc();
        else if (type === 'build' && o.type === 'build' && d.type === o.struct && !d.upgrade) inc();
        else if (type === 'drink' && o.type === 'drink') this.setProg(q.id, i, true);
        else if (type === 'eat' && o.type === 'eat') this.setProg(q.id, i, true);
        else if (type === 'loot' && o.type === 'loot' && (!o.container || o.container === d.type)) {
          if (o.poi) { const P = this.G.world.pois[o.poi]; if (dist(P.x, P.z, this.G.player.x, this.G.player.z) > P.r + 4) return; }
          inc();
        }
        else if (type === 'kill' && o.type === 'kill' && (!o.zombie || o.zombie === d.type)) {
          // se o objetivo tem um lugar, a morte precisa ser lá
          const P = o.target && o.target.startsWith('poi:') ? this.G.world.pois[o.target.slice(4)] : null;
          if (P && dist(P.x, P.z, d.x, d.z) > P.r + 10) return;
          inc();
        }
        else if (type === 'rescue' && o.type === 'rescue' && o.who === d.who) this.setProg(q.id, i, true);
      });
    }
    this.check();
  }
  // o objetivo "rescue" precisa que os anteriores estejam feitos
  canRescue(who) {
    for (const q of this.active()) {
      const i = q.objectives.findIndex(o => o.type === 'rescue' && o.who === who);
      if (i < 0) continue;
      return q.objectives.slice(0, i).every((_, k) => this.objDone(q, k));
    }
    return false;
  }
  check() {
    const G = this.G;
    for (const q of this.active()) {
      const all = q.objectives.every((_, i) => this.objDone(q, i));
      if (all) this.complete(q);
    }
    this.checkRegions();
    G.ui.refreshQuests();
  }
  complete(q) {
    const G = this.G, S = this.S;
    delete S.active[q.id];
    S.done.push(q.id);
    sfx('quest');
    const rw = q.reward || {};
    const lines = [{ name: '✅ Missão concluída: ' + q.title, text: (q.doneText || []).join('\n\n') }];
    if (rw.items) for (const [id, n] of rw.items) G.giveItem(id, n, true);
    if (rw.unlockChar) { G.state.chars[rw.unlockChar].unlocked = true; G.survivors.refresh(); }
    const rtxt = [];
    if (rw.xp) rtxt.push(`+${rw.xp} XP`);
    if (rw.items) rtxt.push(...rw.items.map(([id, n]) => `${item(id).icon} ${item(id).name}${n > 1 ? ' x' + n : ''}`));
    if (rw.unlockChar) rtxt.push(`👥 ${CHARACTERS[rw.unlockChar].name} entrou para a comunidade`);
    if (rtxt.length) lines[0].text += '\n\nRecompensa: ' + rtxt.join(' · ');
    for (const n of q.next || []) if (!S.done.includes(n) && !S.active[n]) S.active[n] = { p: [] };
    // missões de resgate novas colocam o sobrevivente no mapa
    G.survivors.refresh();
    G.ui.dialog(lines, () => { if (rw.xp) G.addXp(rw.xp); this.check(); });
    G.requestSave();
  }
  // regiões liberadas por nível, missão ou item
  checkRegions() {
    const G = this.G, W = G.state.world;
    const maxLevel = Math.max(...Object.values(G.state.chars).filter(c => c.unlocked).map(c => c.level));
    let changed = false;
    for (const R of REGIONS) {
      if (W.unlocked.includes(R.id)) continue;
      const u = R.unlock || {};
      const ok = (!u.level || maxLevel >= u.level) && (!u.quest || this.S.done.includes(u.quest)) && (!u.item || Object.values(G.state.chars).some(c => countItem(c, u.item) > 0));
      if (ok) {
        W.unlocked.push(R.id); changed = true;
        G.ui.toast(`🔓 Nova área liberada: ${R.name} ${DANGER[R.danger].icon}`, 'good', 5);
        sfx('quest');
      }
    }
    if (changed) G.applyLocks();
  }
  // o que falta para liberar uma região (para o mapa)
  lockReason(R) {
    const u = R.unlock || {}, out = [];
    const G = this.G;
    const maxLevel = Math.max(...Object.values(G.state.chars).filter(c => c.unlocked).map(c => c.level));
    if (u.level) out.push({ ok: maxLevel >= u.level, text: `Nível ${u.level}` });
    if (u.quest) out.push({ ok: this.S.done.includes(u.quest), text: `Missão "${QUESTS[u.quest].title}"` });
    if (u.item) out.push({ ok: Object.values(G.state.chars).some(c => countItem(c, u.item) > 0), text: `Ter: ${item(u.item).name}` });
    return out;
  }
  update(dt) {
    const G = this.G, p = G.player;
    this.checkT -= dt;
    if (this.checkT > 0) return;
    this.checkT = 0.5;
    // visitas
    for (const q of this.active()) q.objectives.forEach((o, i) => {
      if (o.type === 'have' && this.prog(q.id, i) !== true && countItem(p.ch, o.item) >= o.n) this.setProg(q.id, i, true);
      if (o.type === 'visit' && !this.objDone(q, i)) {
        const P = G.world.pois[o.poi];
        if (P && dist(P.x, P.z, p.x, p.z) < P.r) { this.setProg(q.id, i, true); sfx('pickup'); G.ui.toast(`📍 ${P.name}`, 'info'); }
      }
    });
    // descoberta de regiões
    const R = regionAt(p.x, p.z);
    if (R && !G.state.world.discovered.includes(R.id)) {
      G.state.world.discovered.push(R.id);
      G.ui.toast(`🗺️ Área descoberta: ${R.name} ${DANGER[R.danger].icon}`, 'info', 4);
      G.addXp(30);
    }
    this.check();
  }
  // objetivo atual (para a dica e a bússola)
  current() {
    const main = this.active().find(q => q.main) || this.active()[0];
    if (!main) return null;
    const i = main.objectives.findIndex((_, k) => !this.objDone(main, k));
    if (i < 0) return null;
    return { q: main, o: main.objectives[i], i };
  }
}
