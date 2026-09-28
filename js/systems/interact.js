// Interação com o mundo: escolhe o objeto mais próximo à frente do jogador e
// executa a ação certa (coletar, vasculhar, abrir porta, beber água, conversar...).
import { dist, angleTo, angDiff, R, bus } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { NODES, CONTAINERS, LOOT } from '../data/loot.js';
import { ITEMS, item } from '../data/items.js';
import { CHARACTERS } from '../data/characters.js';
import { SKILLS } from '../data/skills.js';
import { STRUCTURES } from '../data/recipes.js';
import { LORE } from '../data/quests.js';
import { countItem, removeItem, makeStack } from './state.js';

// sorteia o conteúdo de um recipiente
export function rollLoot(tableId, bonus = 0) {
  const T = LOOT[tableId];
  if (!T) return [];
  if (T.empty && R() < T.empty) return [];
  const n = T.rolls[0] + Math.floor(R() * (T.rolls[1] - T.rolls[0] + 1)) + (R() < bonus ? 1 : 0);
  const out = [];
  let total = 0;
  for (const e of T.table) total += e.w ?? 1;
  for (let i = 0; i < n; i++) {
    let x = R() * total, pick = T.table[0];
    for (const e of T.table) { x -= e.w ?? 1; if (x <= 0) { pick = e; break; } }
    const cnt = (pick.min || 1) + Math.floor(R() * ((pick.max || pick.min || 1) - (pick.min || 1) + 1));
    const d = item(pick.item);
    const ex = out.find(s => s.id === pick.item && d.stack > 1);
    if (ex) ex.n = Math.min(d.stack, ex.n + cnt);
    else {
      const s = makeStack(pick.item, Math.min(cnt, d.stack));
      if (s.d) s.d = Math.round(s.d * (0.4 + R() * 0.6)); // achados vêm usados
      if (s.a != null && d.weapon.mag > 1) s.a = Math.floor(R() * d.weapon.mag * 0.5);
      out.push(s);
    }
  }
  return out;
}

export class Interact {
  constructor(G) { this.G = G; this.current = null; this.lockedMsgT = 0; }

  // melhor ferramenta do personagem para um tipo de coleta
  bestTool(kind) {
    const ch = this.G.player.ch;
    let best = null, bp = 0;
    const consider = (s, where, idx) => {
      if (!s) return;
      const t = item(s.id).tool;
      if (t && t[kind] && t[kind] > bp) { bp = t[kind]; best = { s, where, idx }; }
    };
    consider(ch.equip.arma, 'equip');
    ch.inv.forEach((s, i) => consider(s, 'inv', i));
    return best ? { ...best, power: bp } : null;
  }

  // objeto interativo mais próximo
  find() {
    const G = this.G, p = G.player;
    let best = null, bs = 1e9;
    const fx = p.x + Math.sin(p.rot) * 0.5, fz = p.z + Math.cos(p.rot) * 0.5;
    G.world.nearby(fx, fz, 2.2, o => {
      if (!this.available(o)) return;
      const d = dist(p.x, p.z, o.x, o.z) - (o.r || 0) * 0.6;
      const a = Math.abs(angDiff(p.rot, angleTo(p.x, p.z, o.x, o.z)));
      const s = d + a * 0.6;
      if (s < bs) { bs = s; best = o; }
    });
    // água
    if (!best && G.world.waterNear(p.x, p.z, 1.4)) best = { kind: 'water', x: p.x + Math.sin(p.rot), z: p.z + Math.cos(p.rot) };
    this.current = best;
    return best;
  }
  available(o) {
    const G = this.G, t = G.state.time;
    switch (o.kind) {
      case 'node': return !(o.depletedUntil > t);
      case 'pickup': return !o.taken;
      case 'corpse': return o.zombie && o.zombie.deadT > 0.8 && (!o.items || o.items.length > 0);
      case 'bag': return o.items && o.items.length > 0;
      case 'npc': return o.visible !== false;
      default: return true;
    }
  }
  label(o) {
    if (!o) return null;
    const G = this.G;
    switch (o.kind) {
      case 'node': { const d = NODES[o.type]; return { verb: d.verb, name: d.name, icon: { chop: '🪓', mine: '⛏️', pick: '✋', pickHigh: '✋' }[d.anim] || '✋' }; }
      case 'container': { const d = CONTAINERS[o.type]; const empty = o.items && o.items.length === 0 && !(o.respawnAt <= G.state.time); return { verb: o.items ? 'ABRIR' : d.verb, name: o.name + (empty ? ' (vazio)' : ''), icon: '🔍' }; }
      case 'corpse': return { verb: 'REVISTAR', name: o.name, icon: '🔍' };
      case 'door': return { verb: o.open ? 'FECHAR' : 'ABRIR', name: 'Porta', icon: '🚪' };
      case 'pickup': return { verb: 'PEGAR', name: item(o.item).name, icon: '📄' };
      case 'water': return { verb: 'BEBER', name: 'Água', icon: '💧' };
      case 'bag': return { verb: 'ABRIR', name: o.name || 'Mochila', icon: '🎒' };
      case 'struct': return G.building.label(o);
      case 'npc': return { verb: 'CONVERSAR', name: o.name, icon: '💬' };
      default: return { verb: 'USAR', name: '', icon: '✋' };
    }
  }

  // executa (chamado quando aperta INTERAGIR)
  use(o) {
    const G = this.G, p = G.player;
    if (!o || p.busy || p.dead) return;
    const face = angleTo(p.x, p.z, o.x, o.z);
    switch (o.kind) {
      case 'node': return this.gather(o, face);
      case 'container': case 'corpse': return this.search(o, face);
      case 'door':
        p.startAction('door', { anim: 'interact', face, onHit: () => { G.world.setDoor(o, !o.open); sfx('door', { x: o.x, z: o.z }); G.noise(o.x, o.z, 4); G.saveWorldDoor(o); } });
        return;
      case 'pickup':
        p.startAction('pickup', { anim: 'pick', face, onEnd: () => this.takePickup(o) });
        return;
      case 'water': return this.water();
      case 'bag':
        p.startAction('bag', { anim: 'search', face, dur: 0.8, onEnd: () => G.ui.openLoot(o) });
        sfx('search', { x: o.x, z: o.z });
        return;
      case 'struct': return G.building.use(o, face);
      case 'npc': return G.survivors.talk(o);
    }
  }

  gather(o, face) {
    const G = this.G, p = G.player, ch = p.ch;
    const def = NODES[o.type];
    let tool = null, power = 1;
    if (def.tool) {
      tool = this.bestTool(def.tool);
      if (tool) power = tool.power;
      else if (def.needTool) {
        const need = def.tool === 'ore' || def.tool === 'stone' ? 'uma picareta' : 'uma ferramenta';
        G.ui.toast(`Você precisa de ${need} para isso.`, 'bad'); sfx('denied');
        return;
      }
    }
    // mostra a ferramenta na mão enquanto coleta
    const shown = tool && tool.where === 'inv' ? tool.s : null;
    if (shown) p.model.setWeapon(item(shown.id));
    const C = CHARACTERS[ch.id];
    const once = def.pickup;
    const onHit = () => {
      if (o.depletedUntil > G.state.time) return false;
      if (dist(p.x, p.z, o.x, o.z) > (o.r || 1) + 2.5) return false;
      if (def.sound) sfx(def.sound, { x: o.x, z: o.z });
      const fxType = def.tool === 'wood' ? 'wood' : def.tool === 'stone' || def.tool === 'ore' ? 'stone' : def.tool === 'scrap' ? 'metal' : 'leaf';
      G.fx.burst(o.x, def.tool === 'wood' ? 1.1 : 0.5, o.z, fxType, 7, 0.8);
      if (o.tree) G.world.shakeTree(o.handle);
      G.noise(o.x, o.z, def.tool ? 10 * (1 - (p.stats.stealth || 0) * 0.5) : 3);
      let swings = once ? o.hits : Math.min(o.hits, power);
      const gained = {};
      for (let k = 0; k < swings; k++) {
        for (const [id, a, b] of def.yield) gained[id] = (gained[id] || 0) + a + Math.floor(R() * (b - a + 1));
        for (const [id, ch2] of def.bonus || []) if (R() < ch2) gained[id] = (gained[id] || 0) + 1;
        // habilidades e especial
        const skill = def.tool === 'wood' ? (ch.skills.lenhador || 0) * SKILLS.lenhador.wood : (def.tool === 'stone' || def.tool === 'ore') ? (ch.skills.minerador || 0) * SKILLS.minerador.stone : 0;
        if (R() < skill + (C.special.gather || 0)) { const id0 = def.yield[0][0]; gained[id0] = (gained[id0] || 0) + 1; }
      }
      o.hits -= swings;
      let full = false;
      for (const [id, n] of Object.entries(gained)) { const left = G.giveItem(id, n); if (left) full = true; }
      G.addXp(def.xp * swings, true);
      if (tool) { tool.s.d -= 1; if (tool.s.d <= 0) { G.ui.toast(`${item(tool.s.id).name} quebrou!`, 'bad'); sfx('break'); if (tool.where === 'equip') { ch.equip.arma = null; p.refreshEquip(); } else ch.inv[tool.idx] = null; tool = null; } }
      bus.emit('gather', { type: o.type });
      if (o.hits <= 0) { this.deplete(o); return false; }
      if (full) { G.ui.toast('Inventário cheio.', 'bad'); return false; }
      return true;
    };
    const ok = p.startAction('gather', { anim: def.anim, face, loop: !once, onHit, onEnd: () => { if (shown) p.refreshEquip(); } });
    if (ok) p.action.onCancel = () => { if (shown) p.refreshEquip(); };
  }
  deplete(o) {
    const G = this.G;
    const def = NODES[o.type];
    o.depletedUntil = G.state.time + def.respawn;
    o.hits = def.hits || 1;
    G.state.world.nodes[o.id] = o.depletedUntil;
    this.applyNodeVisual(o, false);
    if (o.tree && ['arvore', 'pinheiro'].includes(o.type)) { sfx('treeFall', { x: o.x, z: o.z }); G.fx.burst(o.x, 2.5, o.z, 'leaf', 25, 1.2); }
  }
  applyNodeVisual(o, full) {
    const G = this.G;
    const def = NODES[o.type];
    if (o.tree) {
      const fruit = ['goiabeira', 'bananeira', 'mangueira'].includes(o.type);
      G.world.trees.setState(o.handle, full ? 'full' : fruit ? 'nofruit' : 'stump');
      if (o.col && !fruit) { /* toco continua bloqueando */ }
    } else if (o.handle && o.handle.pool) {
      o.handle.pool.set(o.handle.i, { visible: full });
      if (o.col) { if (full && !o.col._cells) G.world.col.add(o.col); else if (!full) G.world.col.remove(o.col); }
    }
  }
  // restaura os recursos cujo tempo passou
  respawnTick() {
    const G = this.G, t = G.state.time;
    for (const o of G.world.nodes) {
      if (o.depletedUntil && o.depletedUntil <= t) {
        // não reaparece embaixo do jogador
        if (dist(o.x, o.z, G.player.x, G.player.z) < 3) continue;
        o.depletedUntil = 0; delete G.state.world.nodes[o.id];
        this.applyNodeVisual(o, true);
      }
    }
  }

  search(o, face) {
    const G = this.G, p = G.player;
    const def = o.kind === 'corpse' ? { time: 1.4 } : CONTAINERS[o.type];
    // já aberto e com itens: abre direto
    const fresh = !o.items || (o.respawnAt && o.respawnAt <= G.state.time && o.items.length === 0);
    if (!fresh) { G.ui.openLoot(o); sfx('open', { x: o.x, z: o.z, vol: 0.5 }); return; }
    sfx('search', { x: o.x, z: o.z });
    G.noise(o.x, o.z, 5 * (1 - (p.stats.stealth || 0)));
    p.startAction('search', {
      anim: 'search', face, dur: def.time,
      onEnd: () => {
        const bonus = (p.ch.skills.catador || 0) * SKILLS.catador.loot;
        o.items = rollLoot(o.kind === 'corpse' ? o.loot : def.loot, bonus);
        if (o.kind === 'container') { o.respawnAt = G.state.time + def.respawn; G.saveContainer(o); }
        G.addXp(3, true);
        bus.emit('loot', { type: o.type, kind: o.kind });
        sfx('open', { x: o.x, z: o.z, vol: 0.6 });
        G.ui.openLoot(o);
      },
    });
    G.ui.progress(def.time);
  }
  takePickup(o) {
    const G = this.G;
    if (o.taken) return;
    const left = G.giveItem(o.item, o.n);
    if (left) return;
    o.taken = true; o.mesh.visible = false;
    G.state.world.pickups[o.id] = true;
    sfx('pickup');
    const d = item(o.item);
    if (d.lore && LORE[d.lore]) G.ui.dialog([{ name: '📄 ' + LORE[d.lore].title, text: LORE[d.lore].text }]);
    G.addXp(25);
  }
  water() {
    const G = this.G, p = G.player, ch = p.ch;
    const bottles = countItem(ch, 'garrafa_vazia'), cantil = countItem(ch, 'cantil');
    const drink = () => p.startAction('drink', {
      anim: 'pick', onEnd: () => {
        const clean = G.world.pois.lagoa && dist(p.x, p.z, G.world.pois.lagoa.x, G.world.pois.lagoa.z) < 20 ? 0.15 : 0.25;
        ch.thirst = Math.min(100, ch.thirst + 22);
        sfx('drink');
        G.fx.text(p.x, 2, p.z, '+22 💧', 'good');
        const immune = (ch.skills.estomago || 0) >= 2;
        if (!immune && R() < clean) { ch.sick = Math.max(ch.sick, 40); G.ui.toast('A água do rio te deixou enjoado...', 'bad'); }
        bus.emit('drink', { id: 'rio' });
      },
    });
    const fill = () => p.startAction('fill', {
      anim: 'pick', onEnd: () => {
        const nb = countItem(ch, 'garrafa_vazia'), nc = countItem(ch, 'cantil');
        if (nb) { removeItem(ch, 'garrafa_vazia', nb); G.giveItem('agua_suja', nb); }
        if (nc) { removeItem(ch, 'cantil', nc); G.giveItem('cantil_cheio', nc); }
        sfx('drink');
        bus.emit('getWater');
      },
    });
    if (bottles + cantil > 0) G.ui.choice('Água', [{ label: '💧 Beber direto', fn: drink }, { label: `🍾 Encher recipientes (${bottles + cantil})`, fn: fill }]);
    else drink();
  }

  update(dt) {
    const G = this.G, p = G.player;
    if (p.dead) { this.current = null; return; }
    this.find();
  }
}
