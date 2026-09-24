// Janelas: inventário, saque, troca, ficha, diário, mapa, fabricar, salvar/carregar, ajuda.
import { $, h, portraitOf, bar, pct } from './common.js';
import { HEROES, HERO_ORDER, SKILLS, PERKS, STAT_NAMES, STAT_DESC, XP_LEVELS } from '../data/heroes.js';
import { ITEMS, CATS } from '../data/items.js';
import { QUESTS } from '../data/quests.js';
import { NPCS } from '../data/npcs.js';
import { carried, capacity, countItem, recompute, addItem, removeItem, stackable } from '../game/units.js';
import { RECIPES } from '../game/actions.js';
import { rel, relKey } from '../game/story.js';
import { bus, clamp } from '../util.js';
import * as Save from '../game/save.js';

function win(title, body, opts = {}) {
  const w = h('div', { class: 'win' + (opts.small ? ' small' : '') },
    h('div', { class: 'win-head' }, h('h2', {}, title), h('button', { class: 'x', title: 'Fechar (Esc)', onclick: () => opts.close() }, '✕')),
    h('div', { class: 'win-body' }, body));
  return w;
}
const catClass = id => 'item cat-' + (ITEMS[id]?.cat || 'x');
function itemTile(e, onclick, sel = false) {
  const it = ITEMS[e.id];
  const t = h('div', { class: catClass(e.id) + (sel ? ' sel' : ''), title: `${it.nome}${e.n > 1 ? ' ×' + e.n : ''}\n${it.desc || ''}`, onclick },
    h('div', { class: 'ic' }, it.icon), h('div', {}, it.nome.length > 22 ? it.nome.slice(0, 21) + '…' : it.nome));
  if (e.n > 1) t.append(h('span', { class: 'n' }, '×' + e.n));
  if (e.dur !== undefined && it.w) t.append(h('div', { class: 'd' }, h('i', { style: { width: pct(e.dur, it.w.dur) + '%' } })));
  if (e.carga !== undefined) t.append(h('div', { class: 'd' }, h('i', { style: { width: pct(e.carga, 100) + '%', background: '#ffd24a' } })));
  if (e.loaded !== undefined && it.w?.pente > 1) t.append(h('span', { class: 'n', style: { left: '4px', right: 'auto', color: '#9ad8ff' } }, e.loaded));
  return t;
}
function heroTabs(g, cur, onPick) {
  const t = h('div', { class: 'hero-tabs' });
  for (const u of g.heroes) {
    if (u.dead) continue;
    t.append(h('button', { class: u === cur ? 'on' : '', onclick: () => onPick(u) }, h('span', { class: 'pic', style: { backgroundImage: `url(${portraitOf(u)})` } }), u.name));
  }
  return t;
}
function weightLine(u) {
  const c = carried(u), cap = capacity(u);
  return h('div', { class: 'weight' + (c > cap ? ' over' : '') }, `Peso: ${c.toFixed(1)} / ${cap} kg${c > cap ? ' — sobrecarga (−2 PA)' : ''}`, bar('', c, cap));
}

export class Panels {
  constructor(game, ui) { this.g = game; this.ui = ui; this.modal = $('#modal'); this.cur = null; }
  close() { this.modal.classList.add('hidden'); this.modal.innerHTML = ''; const cb = this.onClose; this.onClose = null; this.cur = null; if (cb) cb(); bus.emit('hud'); }
  show(el, name, onClose = null) {
    this.modal.innerHTML = '';
    this.modal.append(el);
    this.modal.classList.remove('hidden');
    this.cur = name; this.onClose = onClose;
    this.modal.onclick = e => { if (e.target === this.modal) this.close(); };
  }
  refresh() { if (this.cur && this[this.cur + 'Refresh']) this[this.cur + 'Refresh'](); }

  // ================================================================ INVENTÁRIO
  inv(hero = null, target = null) {
    const g = this.g;
    this.invHero = hero || g.selected || g.liveHeroes[0];
    this.invTarget = target;
    this.invSel = null; this.invCat = 'tudo';
    this.invRender();
  }
  invRender() {
    const g = this.g, u = this.invHero;
    if (!u) return;
    const body = h('div');
    body.append(heroTabs(g, u, x => { this.invHero = x; this.invSel = null; this.invRender(); }));
    // equipamento
    const slots = h('div', { class: 'slots' });
    for (const [k, nome] of [['mao', 'Mão'], ['mao2', 'Mão 2'], ['corpo', 'Corpo'], ['costas', 'Costas'], ['cabeca', 'Cabeça']]) {
      const e = u.eq[k];
      slots.append(h('div', { class: 'slot' + (e ? ' full' : ''), title: e ? 'Clique para desequipar' : 'Vazio', onclick: () => { if (e) { g.unequip(u, k); this.invRender(); } } },
        h('div', { class: 'ic' }, e ? ITEMS[e.id].icon : '＋'), e ? ITEMS[e.id].nome : nome, e && e.loaded !== undefined && ITEMS[e.id].w?.pente > 1 ? h('small', {}, `${e.loaded}/${ITEMS[e.id].w.pente}`) : null, e && e.carga !== undefined ? h('small', {}, `🔋${Math.round(e.carga)}%`) : null));
    }
    body.append(slots, weightLine(u));
    const tabs = h('div', { class: 'tabs' });
    for (const [k, v] of [['tudo', { nome: 'Tudo', icon: '📦' }], ...Object.entries(CATS)]) tabs.append(h('button', { class: this.invCat === k ? 'on' : '', onclick: () => { this.invCat = k; this.invRender(); } }, v.icon + ' ' + v.nome));
    body.append(tabs);
    const grid = h('div', { class: 'items' });
    u.inv.forEach((e, i) => {
      if (this.invCat !== 'tudo' && ITEMS[e.id].cat !== this.invCat) return;
      grid.append(itemTile(e, () => { this.invSel = i; this.invRender(); }, this.invSel === i));
    });
    if (!u.inv.length) grid.append(h('div', { style: { color: '#b3a5c4', padding: '10px' } }, 'Mochila vazia.'));
    body.append(grid);
    // detalhes
    const det = h('div', { class: 'detail box' });
    const e = u.inv[this.invSel];
    if (e) {
      const it = ITEMS[e.id];
      det.append(h('div', { class: 't' }, `${it.icon} ${it.nome}${e.n > 1 ? ' ×' + e.n : ''}`),
        h('div', { class: 'd' }, it.desc || ''),
        h('div', { class: 'd' }, this.itemStats(it, e)));
      const acts = h('div', { class: 'acts' });
      const near = g.liveHeroes.filter(o => o !== u && Math.max(Math.abs(o.x - u.x), Math.abs(o.z - u.z)) <= 1 && !o.dead);
      if (it.uso || ['pilhas', 'mapa', 'radio_pilha', 'apito'].includes(it.id)) {
        const verb = it.cat === 'comida' ? (it.uso?.sede && !it.uso?.fome ? 'Beber' : 'Comer') : it.cat === 'medicamento' || it.id === 'soro_r7' ? 'Usar em si' : 'Usar';
        acts.append(h('button', { class: 'btn primary', onclick: async () => { await g.useItem(u, this.invSel); this.invSel = null; this.invRender(); } }, `${verb}`));
        if (it.cat === 'medicamento' || it.id === 'soro_r7' || it.cat === 'comida') for (const o of near) acts.append(h('button', { class: 'btn', onclick: async () => { await g.useItem(u, this.invSel, o); this.invSel = null; this.invRender(); } }, `Dar a ${o.name}`));
        for (const o of g.liveHeroes.filter(o => o !== u && o.st.downed && Math.max(Math.abs(o.x - u.x), Math.abs(o.z - u.z)) <= 1)) acts.append(h('button', { class: 'btn gold', onclick: async () => { await g.revive(u, o); this.invRender(); } }, `Levantar ${o.name}`));
      }
      if (it.cat === 'arma' || it.equip) acts.append(h('button', { class: 'btn primary', onclick: () => { g.equip(u, this.invSel); this.invSel = null; this.invRender(); } }, 'Equipar'));
      if (it.nota) acts.append(h('button', { class: 'btn', onclick: () => this.note(it) }, 'Ler'));
      for (const o of near) acts.append(h('button', { class: 'btn', onclick: async () => { await g.giveItem(u, o, this.invSel); this.invSel = null; this.invRender(); } }, `Entregar para ${o.name}`));
      if (!it.quest) acts.append(h('button', { class: 'btn danger', onclick: () => { g.dropItem(u, this.invSel); this.invSel = null; this.invRender(); } }, 'Largar no chão'));
      det.append(acts);
    } else det.append(h('div', { class: 'd' }, 'Clique num item para ver detalhes. Comer, beber e usar remédios custam PA. Para dar itens a outra pessoa, fiquem lado a lado.'));
    body.append(det);
    this.show(win(`Inventário — ${u.name}`, body, { close: () => this.close() }), 'inv');
  }
  invRefresh() { this.invRender(); }
  itemStats(it, e) {
    const parts = [];
    if (it.w) {
      const w = it.w;
      parts.push(`Dano ${w.dano[0]}–${w.dano[1]}`, `Precisão ${w.prec}%`, `${w.pa} PA`, w.tipo === 'corpo' ? 'corpo a corpo' : `alcance ${w.alcance}`, `ruído ${w.ruido}`);
      if (w.pente > 1) parts.push(`pente ${w.pente} (${ITEMS[w.municao].nome.toLowerCase()})`);
      if (w.furtivo) parts.push(`ataque surpresa ×${w.furtivo}`);
      if (w.atordoar) parts.push(`atordoa ${Math.round(w.atordoar * 100)}%`);
      if (w.dur && w.dur < 999) parts.push(`durabilidade ${Math.ceil(e.dur ?? w.dur)}/${w.dur}`);
    }
    if (it.uso) { const u = it.uso; for (const [k, v] of Object.entries(u)) if (typeof v === 'number') parts.push(`${k} ${v > 0 ? '+' : ''}${v}`); if (u.estanca) parts.push('estanca sangramento'); if (u.trata) parts.push('trata ferimentos'); if (u.cura) parts.push('CURA a infecção'); }
    if (it.armadura) parts.push(`−${Math.round(it.armadura * 100)}% dano`);
    if (it.mordida) parts.push(`−${Math.round(it.mordida * 100)}% mordida`);
    if (it.capacidade) parts.push(`+${it.capacidade} kg`);
    parts.push(`${it.peso} kg`, `valor ${it.valor}`);
    return parts.join(' · ');
  }
  note(it) {
    const body = h('div', {}, h('div', { class: 'note-paper' }, it.desc));
    this.show(win(`${it.icon} ${it.nome}`, body, { small: true, close: () => this.close() }), 'note');
  }

  // ================================================================ SAQUE (vasculhar, chão, baú)
  loot(src, hero, stash = false) {
    this.lootSrc = src; this.lootHero = hero; this.lootStash = stash || src.stash || src.pile;
    this.lootRender();
  }
  lootRender() {
    const g = this.g, u = this.lootHero, src = this.lootSrc;
    const list = g.lootList(src);
    const name = src.pile ? 'Itens no chão' : src.nome || 'Recipiente';
    const left = h('div', { class: 'box' }, h('h3', {}, `${src.pile ? '📦' : '🗄️'} ${name}`));
    const grid = h('div', { class: 'items' });
    list.forEach((e, i) => grid.append(itemTile(e, () => { g.takeLoot(u, src, i, stackable(e.id) && e.n > 1 && window.event?.shiftKey ? 1 : null); this.lootRender(); })));
    if (!list.length) grid.append(h('div', { style: { color: '#b3a5c4', padding: '10px' } }, 'Vazio.'));
    left.append(grid, h('div', { style: { marginTop: '8px', display: 'flex', gap: '6px' } },
      h('button', { class: 'btn primary', onclick: () => { for (let i = list.length - 1; i >= 0; i--) g.takeLoot(u, src, i); this.lootRender(); } }, 'Pegar tudo'),
      h('small', { style: { color: '#b3a5c4', alignSelf: 'center' } }, 'Clique para pegar (Shift: só 1).')));
    const right = h('div', { class: 'box' }, heroTabs(g, u, x => { this.lootHero = x; this.lootRender(); }), weightLine(u));
    const g2 = h('div', { class: 'items' });
    u.inv.forEach((e, i) => g2.append(itemTile(e, () => { if (this.lootStash) { g.putLoot(u, src, i); this.lootRender(); } else { this.ui.toast('Só dá para guardar itens no baú ou no chão.'); } })));
    right.append(h('h3', {}, `🎒 ${u.name}`), g2, h('small', { style: { color: '#b3a5c4' } }, this.lootStash ? 'Clique num item seu para guardar aqui.' : ''));
    const body = h('div', { class: 'cols' }, left, right);
    this.show(win(src.stash ? 'Baú do esconderijo' : 'Vasculhando', body, { close: () => this.close() }), 'loot');
  }
  lootRefresh() { this.lootRender(); }

  // ================================================================ TROCA
  trade(npc, hero, done) {
    const g = this.g;
    const N = NPCS[npc.npc];
    g.state.shops ||= {};
    if (!g.state.shops[npc.npc]) g.state.shops[npc.npc] = (N.loja?.itens || []).map(([id, n]) => ({ id, n }));
    this.tr = { npc, hero, done, stock: g.state.shops[npc.npc], give: new Map(), take: new Map() };
    this.tradeRender();
  }
  priceMul() {
    const g = this.g;
    const dai = g.heroes.find(h => h.id === 'daiana' && !h.dead);
    let m = 1 - (dai ? [0, 0.15, 0.25, 0.35][dai.skill('negociadora')] : 0);
    if (this.tr.npc.npc === 'ze' && g.state.flags.ze_desconto) m -= 0.25;
    if (g.liveHeroes.some(h => h.hasPerk('labia'))) m -= 0.05;
    return Math.max(0.4, m);
  }
  valueOf(id, buying) {
    const N = NPCS[this.tr.npc.npc];
    let v = ITEMS[id].valor || 1;
    if (!buying && N.loja?.quer?.includes(id)) v *= 1.5;
    if (!buying) v *= 0.8;
    else v *= this.priceMul();
    return Math.max(1, Math.round(v));
  }
  tradeRender() {
    const g = this.g, T = this.tr, u = T.hero;
    const N = NPCS[T.npc.npc];
    let takeV = 0, giveV = 0;
    for (const [i, n] of T.take) takeV += this.valueOf(T.stock[i].id, true) * n;
    for (const [i, n] of T.give) giveV += this.valueOf(u.inv[i].id, false) * n;
    const left = h('div', { class: 'box' }, h('h3', {}, `🏪 ${T.npc.name}`), h('small', { style: { color: '#b3a5c4' } }, N.loja?.quer ? `Procura: ${N.loja.quer.map(i => ITEMS[i].nome).join(', ')}` : ''));
    const gl = h('div', { class: 'items', style: { marginTop: '8px' } });
    T.stock.forEach((e, i) => {
      if (e.n <= 0) return;
      const n = T.take.get(i) || 0;
      const tile = itemTile({ id: e.id, n: e.n - n }, () => { if (n < e.n) T.take.set(i, n + 1); this.tradeRender(); }, n > 0);
      tile.append(h('span', { class: 'n', style: { top: 'auto', bottom: '8px', color: '#b8f07a' } }, '$' + this.valueOf(e.id, true)));
      if (n) tile.append(h('span', { class: 'n', style: { left: '4px', right: 'auto', color: '#ffd24a' } }, '+' + n));
      gl.append(tile);
    });
    left.append(gl);
    const right = h('div', { class: 'box' }, heroTabs(g, u, x => { T.hero = x; T.give.clear(); this.tradeRender(); }), h('h3', {}, `🎒 ${u.name} oferece`));
    const gr = h('div', { class: 'items' });
    u.inv.forEach((e, i) => {
      if (ITEMS[e.id].quest) return;
      const n = T.give.get(i) || 0;
      const tile = itemTile({ ...e, n: e.n - n }, () => { if (n < e.n) T.give.set(i, n + 1); this.tradeRender(); }, n > 0);
      tile.append(h('span', { class: 'n', style: { top: 'auto', bottom: '8px', color: '#b8f07a' } }, '$' + this.valueOf(e.id, false)));
      if (n) tile.append(h('span', { class: 'n', style: { left: '4px', right: 'auto', color: '#ffd24a' } }, '−' + n));
      gr.append(tile);
    });
    right.append(gr);
    const ok = takeV > 0 && giveV >= takeV || (takeV === 0 && giveV > 0);
    const foot = h('div', { style: { gridColumn: '1 / -1' } },
      h('div', { class: 'trade-val' }, `Você recebe: ${takeV} · Você dá: `, h('span', { class: ok ? 'ok' : 'no' }, giveV), ok ? '  ✔ troca justa' : takeV > giveV ? '  — ofereça mais' : ''),
      h('div', { style: { display: 'flex', gap: '8px' } },
        h('button', { class: 'btn primary', disabled: !ok, onclick: () => this.doTrade() }, 'Trocar'),
        h('button', { class: 'btn', onclick: () => { T.give.clear(); T.take.clear(); this.tradeRender(); } }, 'Limpar'),
        h('small', { style: { color: '#b3a5c4', alignSelf: 'center' } }, `Preços ${Math.round((1 - this.priceMul()) * 100)}% mais baratos pela lábia do grupo.`)));
    const body = h('div', { class: 'cols' }, left, right, foot);
    this.show(win(`Negociar com ${T.npc.name}`, body, { close: () => { this.close(); } }), 'trade', () => { if (T.done) T.done(); });
  }
  doTrade() {
    const T = this.tr, u = T.hero;
    const giveIdx = [...T.give.entries()].sort((a, b) => b[0] - a[0]);
    for (const [i, n] of giveIdx) { const e = u.inv[i]; if (stackable(e.id)) { e.n -= n; if (e.n <= 0) u.inv.splice(i, 1); } else u.inv.splice(i, 1); }
    for (const [i, n] of T.take) { const e = T.stock[i]; e.n -= n; addItem(u, e.id, n); this.g.log(`🤝 Troca: ${ITEMS[e.id].icon} ${ITEMS[e.id].nome} ×${n}.`, 'bom'); }
    T.stock = T.stock.filter(e => e.n > 0); this.g.state.shops[T.npc.npc] = T.stock;
    T.give.clear(); T.take.clear();
    bus.emit('hud');
    this.tradeRender();
  }

  // ================================================================ FICHA
  char(hero = null) { this.chHero = hero || this.g.selected || this.g.liveHeroes[0]; this.charRender(); }
  charRender() {
    const g = this.g, u = this.chHero;
    const H = HEROES[u.id];
    const body = h('div');
    body.append(heroTabs(g, u, x => { this.chHero = x; this.charRender(); }));
    const next = XP_LEVELS[u.lvl] ?? u.xp;
    const prev = XP_LEVELS[u.lvl - 1] ?? 0;
    const left = h('div', { class: 'box' },
      h('div', { style: { display: 'flex', gap: '12px' } },
        h('div', { style: { width: '120px', height: '160px', borderRadius: '14px', border: '3px solid #0d0911', backgroundImage: `url(${H.arte})`, backgroundSize: 'cover', backgroundPosition: 'center top', flex: 'none' } }),
        h('div', {},
          h('h3', {}, `${H.nome} — ${H.papel}`),
          h('div', { style: { fontSize: '13px', color: '#ddd0ea', lineHeight: 1.4 } }, H.bio),
          h('div', { style: { marginTop: '8px', fontWeight: 900 } }, `Nível ${u.lvl} · XP ${u.xp}/${next}`), bar('', u.xp - prev, Math.max(1, next - prev), 'linear-gradient(#9ad8ff,#2a8ad8)'),
          h('div', { style: { marginTop: '6px', fontSize: '13px', fontWeight: 800 } }, `❤ ${Math.round(u.hp)}/${u.maxHp} · PA ${u.maxAp} · Carga ${carried(u)}/${capacity(u)} kg · Zumbis derrotados: ${u.kills}`))),
      h('h3', { style: { marginTop: '10px' } }, `Atributos ${u.pts ? `(${u.pts} ponto${u.pts > 1 ? 's' : ''} para distribuir)` : ''}`));
    for (const [k, nome] of Object.entries(STAT_NAMES)) {
      left.append(h('div', { class: 'stat-row', title: STAT_DESC[k] }, nome, bar('', u.stats[k], 12), h('span', {}, u.stats[k]),
        u.pts > 0 && u.stats[k] < 12 ? h('button', { onclick: () => { u.stats[k]++; u.pts--; recompute(u); if (k === 'resistencia') u.hp += 4; bus.emit('hud'); this.charRender(); } }, '+') : h('span')));
    }
    const right = h('div', { class: 'box' }, h('h3', {}, `Habilidades ${u.spts ? `(${u.spts} ponto${u.spts > 1 ? 's' : ''})` : ''}`));
    for (const sid of H.skills) {
      const sk = SKILLS[sid], r = u.skill(sid);
      right.append(h('div', { class: 'skill-card' },
        h('div', { class: 't' }, `${sk.icon} ${sk.nome} `, h('span', { class: 'r' }, '★'.repeat(r) + '☆'.repeat(3 - r)), sk.ativa ? h('small', { style: { color: '#9ad8ff' } }, ' ativa') : h('small', { style: { color: '#b3a5c4' } }, ' passiva'),
          u.spts > 0 && r < 3 ? h('button', { class: 'btn gold', style: { float: 'right', padding: '2px 8px' }, onclick: () => { u.skills[sid] = r + 1; u.spts--; bus.emit('hud'); this.charRender(); } }, 'Melhorar') : null),
        h('div', { class: 'd' }, sk.desc(Math.max(1, r)))));
    }
    right.append(h('h3', { style: { marginTop: '10px' } }, `Vantagens ${u.perkPts ? `(escolha ${u.perkPts})` : ''}`));
    if (u.perks.length) right.append(h('div', { style: { fontSize: '13px', marginBottom: '6px' } }, u.perks.map(p => `✔ ${PERKS[p].nome} — ${PERKS[p].desc}`).join('\n').split('\n').map(t => h('div', {}, t))));
    if (u.perkPts > 0) {
      const box = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } });
      for (const [pid, p] of Object.entries(PERKS)) if (!u.perks.includes(pid)) box.append(h('button', { class: 'btn', style: { fontSize: '12px', textAlign: 'left' }, title: p.desc, onclick: () => { u.perks.push(pid); u.perkPts--; recompute(u); if (pid === 'casca_grossa') u.hp += 15; bus.emit('hud'); this.charRender(); } }, `${p.nome}: ${p.desc}`));
      right.append(box);
    } else if (!u.perks.length) right.append(h('div', { style: { fontSize: '13px', color: '#b3a5c4' } }, 'Uma vantagem a cada 2 níveis.'));
    right.append(h('h3', { style: { marginTop: '10px' } }, 'Estado'));
    const st = [];
    if (u.st.infected) st.push(`🦠 Infecção ${Math.round(u.need.infeccao)}%${u.st.segura > 0 ? ' (contida pelo antibiótico)' : ''}`);
    if (u.st.bleed) st.push('🩸 Sangrando');
    for (const w of u.wounds) st.push(`${w.tipo === 'mordida' ? '🦷' : '🩹'} ${w.tipo}${w.tratado ? ' (tratado)' : ' (sem tratamento)'}`);
    if (u.st.dor > 0) st.push('💊 Sem dor (dipirona)');
    if (u.st.drunk > 0) st.push('🍶 Alegrinho (−15% mira)');
    right.append(h('div', { style: { fontSize: '13px' } }, st.length ? st.map(t => h('div', {}, t)) : 'Tudo certo, dentro do possível.'));
    body.append(h('div', { class: 'cols' }, left, right));
    this.show(win('Ficha do personagem', body, { close: () => this.close() }), 'char');
  }
  charRefresh() { this.charRender(); }

  // ================================================================ DIÁRIO
  journal(tab = 'missoes') { this.jTab = tab; this.journalRender(); }
  journalRender() {
    const g = this.g;
    const body = h('div');
    const tabs = h('div', { class: 'tabs' });
    for (const [k, n] of [['missoes', '📜 Missões'], ['pistas', '🔎 Pistas'], ['grupo', '👥 Grupo'], ['stats', '📊 Estatísticas']]) tabs.append(h('button', { class: this.jTab === k ? 'on' : '', onclick: () => { this.jTab = k; this.journalRender(); } }, n));
    body.append(tabs);
    if (this.jTab === 'missoes') {
      const qs = Object.entries(g.state.quests).sort((a, b) => (a[1].done - b[1].done) || (QUESTS[a[0]].tipo === 'principal' ? -1 : 1));
      if (!qs.length) body.append(h('p', {}, 'Nenhuma missão ainda.'));
      for (const [id, s] of qs) {
        const q = QUESTS[id];
        const ol = h('ol');
        q.passos.forEach((p, i) => { if (i <= s.step) ol.append(h('li', { class: i < s.step || s.done ? 'ok' : 'cur' }, p.desc)); });
        body.append(h('div', { class: 'quest' + (s.done ? ' done' : '') + (s.failed ? ' failed' : '') },
          h('div', { class: 't' }, `${q.tipo === 'principal' ? '★' : '•'} ${q.nome}${s.done ? ' — concluída' : s.failed ? ' — falhou' : ''}`),
          h('div', { style: { fontSize: '13px', color: '#b3a5c4' } }, q.resumo), ol));
      }
    } else if (this.jTab === 'pistas') {
      if (!g.state.clues.length) body.append(h('p', {}, 'Nenhuma pista ainda. Leia bilhetes, converse com as pessoas e investigue as casas.'));
      for (const c of g.state.clues) body.append(h('div', { class: 'clue' }, h('div', { style: { fontSize: '11px', color: '#b3a5c4' } }, `Dia ${c.dia}, ${c.hora}`), c.text));
    } else if (this.jTab === 'grupo') {
      body.append(h('p', { style: { fontSize: '14px', color: '#ddd0ea' } }, 'As escolhas mudam o que a turma pensa uns dos outros. Relações boas destravam conversas e dão bônus; relações ruins geram brigas e derrubam o moral.'));
      for (let i = 0; i < HERO_ORDER.length; i++) for (let j = i + 1; j < HERO_ORDER.length; j++) {
        const a = HERO_ORDER[i], b = HERO_ORDER[j];
        const v = rel(g, a, b);
        const desc = v >= 80 ? 'Inseparáveis' : v >= 60 ? 'Amizade firme' : v >= 40 ? 'Convivência' : v >= 25 ? 'Tensão' : 'Brigados';
        body.append(h('div', { class: 'rel-row' }, `${HEROES[a].nome} & ${HEROES[b].nome}`, bar('', v, 100), h('span', { title: desc }, v >= 60 ? '💞' : v >= 40 ? '🙂' : v >= 25 ? '😐' : '😠')));
      }
    } else {
      const s = g.state.stats;
      body.append(h('div', { class: 'stats' }, h('p', {}, `Dias sobrevividos: ${g.day()}`), h('p', {}, `Turnos: ${s.turnos}`), h('p', {}, `Zumbis derrotados: ${s.kills}`), h('p', {}, `Pessoas salvas: ${g.state.saved.length}${g.state.saved.length ? ' (' + g.state.saved.join(', ') + ')' : ''}`)));
      for (const u of g.heroes) body.append(h('p', {}, `${u.name}: nível ${u.lvl}, ${u.kills} zumbis${u.dead ? ' — não sobreviveu' : ''}`));
    }
    this.show(win('Diário', body, { close: () => this.close() }), 'journal');
  }
  journalRefresh() { this.journalRender(); }

  // ================================================================ MAPA
  map() {
    const c = h('canvas', { class: 'bigmap', width: this.g.map.W * 7, height: this.g.map.H * 7 });
    const body = h('div', {}, c, h('p', { style: { fontSize: '13px', color: '#b3a5c4' } }, '◆ amarelo: objetivos · bolinhas coloridas: a turma · vermelho: zumbis à vista. Clique no mapa para levar a câmera até lá.'));
    this.show(win('Mapa de Aimorés', body, { close: () => this.close() }), 'map');
    this.ui.hud.drawMinimap(c, true);
    c.onclick = e => { const r = c.getBoundingClientRect(); const v = this.ui.hud.miniView; this.g.S.focus(v.x0 + (e.clientX - r.left) * (c.width / r.width) / v.sc, v.z0 + (e.clientY - r.top) * (c.height / r.height) / v.sc); this.close(); };
    this.ui.hud.miniView = null;
  }

  // ================================================================ FABRICAR / COZINHAR
  craft(hero = null, stove = null) {
    this.crHero = hero || this.g.selected; this.crStove = stove;
    this.craftRender();
  }
  craftRender() {
    const g = this.g, u = this.crHero;
    const body = h('div');
    body.append(heroTabs(g, u, x => { this.crHero = x; this.craftRender(); }));
    body.append(h('p', { style: { fontSize: '13px', color: '#b3a5c4' } }, this.crStove ? `🔥 Perto de: ${this.crStove.nome}. Receitas de fogão liberadas.` : 'Receitas de fogão precisam de um fogão, fogão industrial ou churrasqueira (clique nele e escolha "Cozinhar aqui").'));
    for (const r of RECIPES) {
      const reqs = r.precisa.map(req => { const [ids, n] = req; const ok = g.haveReq(u, req); return h('span', { class: ok ? '' : 'miss' }, `${ids.split('|').map(i => ITEMS[i].nome).join(' ou ')} ×${n}`); });
      const ok = r.precisa.every(req => g.haveReq(u, req)) && (!r.fogao || this.crStove);
      const out = r.repara ? 'Recupera 50% da durabilidade da arma equipada' : `→ ${ITEMS[r.da[0]].icon} ${ITEMS[r.da[0]].nome}${r.da[1] > 1 ? ' ×' + r.da[1] : ''}`;
      const reqLine = h('div', { class: 'req' });
      reqs.forEach((e, i) => { if (i) reqLine.append(' + '); reqLine.append(e); });
      if (r.fogao) reqLine.append(' + 🔥 fogo (fósforos)');
      body.append(h('div', { class: 'recipe' },
        h('div', {}, h('div', { style: { fontWeight: 900 } }, `${r.nome} (${r.pa} PA)`), reqLine, h('div', { style: { fontSize: '12px' } }, out)),
        h('button', { class: 'btn primary', disabled: !ok, onclick: async () => { await g.craft(u, r.id, this.crStove); this.craftRender(); } }, 'Fazer')));
    }
    this.show(win('Fabricar e cozinhar', body, { close: () => this.close() }), 'craft');
  }
  craftRefresh() { this.craftRender(); }

  // ================================================================ SALVAR / CARREGAR
  save(mode = 'both') {
    const g = this.g;
    const body = h('div');
    const inGame = !!g.state && g.phase !== 'none';
    for (const slot of Save.SLOTS) {
      const meta = Save.meta(slot);
      body.append(h('div', { class: 'save-slot' },
        h('div', {}, h('div', { class: 'nm' }, slot === 'auto' ? '🔁 Salvamento automático' : `💾 Espaço ${slot}`),
          h('div', { class: 'info' }, meta ? `Dia ${meta.dia}, ${meta.hora} · ${meta.vivos} · ${new Date(meta.quando).toLocaleString('pt-BR')}` : 'Vazio')),
        inGame && slot !== 'auto' && mode !== 'load' ? h('button', { class: 'btn primary', onclick: () => { if (Save.save(g, slot)) { this.ui.toast('Jogo salvo!', 'bom'); this.save(mode); } } }, 'Salvar') : h('span'),
        meta ? h('button', { class: 'btn gold', onclick: () => { this.close(); this.ui.loadGame(slot); } }, 'Carregar') : h('span')));
    }
    body.append(h('p', { style: { fontSize: '13px', color: '#b3a5c4' } }, 'O jogo salva sozinho ao amanhecer, ao dormir e ao concluir missões. Atalhos: F5 salva rápido (espaço 1), F9 carrega.'));
    const io = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
    if (inGame) io.append(h('button', { class: 'btn', onclick: () => Save.exportFile(g) }, '⬇️ Exportar arquivo'));
    const file = h('input', { type: 'file', accept: '.json', style: { display: 'none' }, onchange: e => { const f = e.target.files[0]; if (f) f.text().then(t => { Save.importText(t); this.ui.toast('Arquivo importado para o espaço 3.', 'bom'); this.save(mode); }); } });
    io.append(h('button', { class: 'btn', onclick: () => file.click() }, '⬆️ Importar arquivo'), file);
    body.append(io);
    this.show(win(mode === 'load' ? 'Carregar jogo' : 'Salvar e carregar', body, { small: true, close: () => this.close() }), 'save');
  }

  // ================================================================ MENU / AJUDA / CONFIRMAR
  menu() {
    const ui = this.ui;
    const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
      h('button', { class: 'btn primary', onclick: () => this.close() }, 'Continuar'),
      h('button', { class: 'btn', onclick: () => this.save() }, 'Salvar / carregar'),
      h('button', { class: 'btn', onclick: () => this.help() }, 'Como jogar'),
      h('button', { class: 'btn', onclick: () => this.options() }, 'Opções'),
      h('button', { class: 'btn danger', onclick: () => this.confirm('Voltar para a tela de título? O progresso não salvo será perdido.', () => ui.toTitle()) }, 'Sair para o título'),
      /Electron/i.test(navigator.userAgent) ? h('button', { class: 'btn danger', onclick: () => this.confirm('Fechar o jogo? O progresso não salvo será perdido.', () => window.close()) }, 'Fechar o jogo') : null);
    this.show(win('Menu', body, { small: true, close: () => this.close() }), 'menu');
  }
  options() {
    const ui = this.ui, o = ui.opts;
    const row = (label, el) => h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0', fontWeight: 800 } }, label, el);
    const tog = (k) => h('button', { class: 'btn' + (o[k] ? ' on' : ''), onclick: () => { o[k] = !o[k]; ui.saveOpts(); this.options(); } }, o[k] ? 'Ligado' : 'Desligado');
    const sel = (k, vals) => { const s = h('select', { style: { fontSize: '15px', padding: '4px' }, onchange: e => { o[k] = isNaN(+e.target.value) ? e.target.value : +e.target.value; ui.saveOpts(); } }); for (const [v, n] of vals) s.append(h('option', { value: v, selected: o[k] == v }, n)); return s; };
    const body = h('div', {},
      row('Música', tog('musica')), row('Efeitos sonoros', tog('sons')),
      row('Velocidade das animações', sel('speed', [[1, 'Normal'], [1.5, 'Rápida'], [2.5, 'Muito rápida']])),
      row('Câmera segue o personagem', tog('follow')),
      row('Conversas espontâneas do grupo', tog('banter')),
      row('Qualidade gráfica', sel('qualidade', [['alta', 'Alta (sombras)'], ['baixa', 'Leve (sem sombras)']])));
    this.show(win('Opções', body, { small: true, close: () => this.close() }), 'options');
  }
  help() {
    const body = h('div', { class: 'help', html: HELP_HTML });
    this.show(win('Como jogar', body, { close: () => this.close() }), 'help');
  }
  confirm(msg, fn) {
    const body = h('div', {}, h('p', { style: { fontSize: '16px', fontWeight: 800 } }, msg),
      h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
        h('button', { class: 'btn', onclick: () => this.close() }, 'Cancelar'),
        h('button', { class: 'btn danger', onclick: () => { this.close(); fn(); } }, 'Confirmar')));
    this.show(win('Tem certeza?', body, { small: true, close: () => this.close() }), 'confirm');
  }
}

export const HELP_HTML = `
<h3>Objetivo</h3>
<p>Aimorés virou um apocalipse zumbi. Guie <b>Arthur</b>, <b>Carol</b>, <b>Daiana</b> e <b>Pablício</b>: descubram como o surto começou, ajudem (ou não) quem cruzar o caminho e encontrem uma saída antes do bombardeio. Cada recurso conta. Nem toda briga vale a pena.</p>
<h3>Turnos e Pontos de Ação (PA)</h3>
<p>Na sua vez, cada personagem tem PA (as bolinhas amarelas). Tudo custa PA: andar 1 por casa, correr 2 PA a cada 3 casas (com barulho), atacar 2–4, vasculhar 1–3, abrir porta 1, comer/beber 1, remédio 1–2, conversar 1 (em combate). Quando terminar, clique em <b>Passar turno</b>: os zumbis e as outras pessoas agem.</p>
<p><b>Exploração</b> (sem perigo por perto): o grupo segue quem você move e dá para clicar longe — o jogo passa os turnos sozinho até chegar (ou até aparecer um zumbi). Cada turno vale 5 minutos. <b>Combate</b>: cada um age separado e cada turno vale 1 minuto.</p>
<h3>Mouse e toque</h3>
<table>
<tr><td><kbd>Clique esquerdo</kbd></td><td>ação principal: andar, atacar, vasculhar, abrir porta, conversar</td></tr>
<tr><td><kbd>Clique direito</kbd> / segurar o dedo</td><td>menu com todas as opções e o custo em PA</td></tr>
<tr><td><kbd>Rodinha</kbd> / pinça</td><td>zoom</td></tr>
<tr><td>Arrastar (botão do meio ou dedo)</td><td>mover a câmera</td></tr>
</table>
<h3>Teclado</h3>
<table>
<tr><td><kbd>1</kbd>–<kbd>4</kbd> / <kbd>Tab</kbd></td><td>escolher personagem</td></tr>
<tr><td><kbd>Enter</kbd></td><td>passar turno</td></tr>
<tr><td><kbd>WASD</kbd> / setas</td><td>mover a câmera · <kbd>Q</kbd> <kbd>E</kbd> girar · <kbd>Espaço</kbd> centralizar</td></tr>
<tr><td><kbd>Shift</kbd></td><td>alternar correr</td></tr>
<tr><td><kbd>I</kbd> <kbd>C</kbd> <kbd>J</kbd> <kbd>M</kbd> <kbd>B</kbd></td><td>inventário, ficha, diário, mapa, fabricar</td></tr>
<tr><td><kbd>A</kbd> <kbd>G</kbd> <kbd>X</kbd> <kbd>H</kbd> <kbd>R</kbd> <kbd>F</kbd></td><td>atacar, mirar, defender, esconder, recarregar, lanterna</td></tr>
<tr><td><kbd>V</kbd></td><td>paredes baixas (ver dentro das casas)</td></tr>
<tr><td><kbd>F5</kbd> / <kbd>F9</kbd></td><td>salvar / carregar rápido</td></tr>
</table>
<h3>Sobrevivência</h3>
<ul>
<li><b>Fome, sede e energia</b> caem com o tempo (e mais rápido no calorão de Aimorés, ao sol). Baixas demais, tiram PA, mira e vida.</li>
<li><b>Mordidas</b> infectam. A infecção sobe devagar: febre (−1 PA), delírio, estado grave... e em 100% a pessoa vira zumbi. Antibiótico segura por um tempo; só o <b>Soro R-7</b> cura.</li>
<li><b>Sangramento</b> tira vida todo turno: use atadura ou kit médico.</li>
<li>Com vida zerada o personagem <b>cai</b>: alguém precisa levantá-lo com atadura ou kit em até 3 turnos.</li>
<li><b>Moral</b> baixo causa pânico. Comida boa, descanso, a fé da Carol e boas escolhas ajudam.</li>
<li>Durma na <b>Casa da Turma</b> ou na <b>Igreja</b> (clique numa cama) para passar a noite e recuperar energia.</li>
</ul>
<h3>Furtividade e barulho</h3>
<p>Zumbis enxergam pouco à noite, mas ouvem bem. Tiros, portas arrombadas, vidros quebrados e alarmes atraem hordas. Ataque pelas costas quem ainda não te viu: dano multiplicado (a faca é perfeita). Esconda-se perto de arbustos, carros, camas e guarda-roupas, ou no escuro. Jogue pedrinhas (clique direito no chão) para distrair.</p>
<h3>Combate</h3>
<p>Passe o mouse sobre um inimigo para ver a chance de acerto. Distância, cobertura (carros, muros, balcões), escuridão, mira e o estado do personagem mudam tudo. Economize munição: armas brancas quebram, mas são silenciosas.</p>
<h3>Dia e noite</h3>
<p>De dia a visão é boa e as pessoas circulam. À noite: mais zumbis, mais agressivos, e você só vê o que está iluminado. Use a <b>lanterna</b> (F) — mas ela também atrai olhares e gasta pilha.</p>
`;
