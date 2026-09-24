// Motor da narrativa: missões, diálogos com escolhas, opinião e relacionamento do grupo,
// conversas espontâneas, eventos aleatórios, gatilhos por área e finais.
import { QUESTS } from '../data/quests.js';
import { DIALOGS } from '../data/dialogs.js';
import { EVENTS } from '../data/events.js';
import { BANTER } from '../data/banter.js';
import { HEROES, HERO_ORDER } from '../data/heroes.js';
import { NPCS } from '../data/npcs.js';
import { ITEMS } from '../data/items.js';
import { PROPS } from '../world/tiles.js';
import { addItem, removeItem, countItem, effStat } from './units.js';
import { rng, bus, clamp, wait } from '../util.js';

// ------------------------------------------------------------ utilidades
export function flag(g, k, v) { if (v === undefined) return g.state.flags[k]; g.state.flags[k] = v; bus.emit('hud'); return v; }
export function hero(g, id) { return g.units.find(u => u.kind === 'hero' && u.id === id && !u.dead) || null; }
export function anyHeroHas(g, id, n = 1) { return g.liveHeroes.reduce((s, h) => s + countItem(h, id), 0) >= n; }
export function takeFromParty(g, id, n = 1) {
  for (const h of g.liveHeroes) { const c = countItem(h, id); if (c > 0) { const k = Math.min(c, n); if (h.eq.mao && h.eq.mao.id === id && !h.inv.find(e => e.id === id)) h.eq.mao = null; else removeItem(h, id, k); n -= k; } if (n <= 0) break; }
  bus.emit('hud');
  return n <= 0;
}
export function giveParty(g, heroU, id, n = 1) { addItem(heroU || g.selected, id, n); g.log(`🎁 Recebido: ${ITEMS[id].icon} ${ITEMS[id].nome}${n > 1 ? ' ×' + n : ''}.`, 'bom'); bus.emit('hud'); }
export function relKey(a, b) { const i = HERO_ORDER.indexOf(a), j = HERO_ORDER.indexOf(b); return i < j ? a + '|' + b : b + '|' + a; }
export function rel(g, a, b) { return g.state.rel[relKey(a, b)] ?? 50; }
export function relChange(g, a, b, d) {
  if (!a || !b || a === b || !HEROES[a] || !HEROES[b]) return;
  const k = relKey(a, b);
  g.state.rel[k] = clamp((g.state.rel[k] ?? 50) + d, 0, 100);
}
// opinião do grupo sobre uma escolha: {carol: +2, pablicio: -1} (afeta a relação com quem falou e o moral)
function applyOpinion(g, speaker, op) {
  const parts = [];
  for (const [id, v] of Object.entries(op)) {
    const h = hero(g, id);
    if (!h) continue;
    h.need.moral = clamp(h.need.moral + v * 3, 0, 100);
    if (speaker && speaker.id !== id) relChange(g, speaker.id, id, v * 3);
    parts.push(`${h.name} ${v > 0 ? 'gostou' : 'não gostou'}`);
  }
  if (parts.length) g.log(`👥 ${parts.join(', ')}.`, 'info');
}

// ------------------------------------------------------------ caixas de diálogo
// mostra uma fala e espera a escolha (índice) — ou só "continuar"
export function ask(g, speaker, text, choices = []) {
  return new Promise(res => bus.emit('dialog', { speaker, text, choices }, res));
}
export function speakerOf(g, who, ctx) {
  if (who === 'narr' || !who) return { nome: '', narr: true };
  if (who === 'npc') { const n = ctx.npc; return { nome: n.name, look: n.look, npc: true }; }
  if (who === 'hero') { const h = ctx.hero; return { nome: h.name, retrato: HEROES[h.id].retrato, cor: HEROES[h.id].cor, hero: h.id }; }
  if (HEROES[who]) { const h = hero(g, who); if (!h) return null; return { nome: h.name, retrato: HEROES[who].retrato, cor: HEROES[who].cor, hero: who }; }
  if (NPCS[who]) return { nome: NPCS[who].nome, look: NPCS[who].look, npc: true };
  return { nome: who };
}
function fill(text, ctx) {
  return String(text).replace(/\{heroi\}/g, ctx.hero ? ctx.hero.name : '').replace(/\{npc\}/g, ctx.npc ? ctx.npc.name : '');
}
export async function say(g, who, text, ctx = {}) {
  const sp = speakerOf(g, who, ctx);
  if (!sp) return;
  await ask(g, sp, fill(text, ctx));
}
// sequência de falas [[quem, texto], ...]
export async function scene(g, lines, ctx = {}) {
  g.phaseBefore = g.phase;
  for (const [who, text] of lines) await say(g, who, text, ctx);
}

// teste de habilidade: 0..100
export function check(g, ctx, spec) {
  const h = ctx.hero;
  let score = rng.int(1, 100);
  if (spec.stat) score += (effStat(h, spec.stat) - 5) * 6;
  if (spec.skill) {
    const holder = spec.skill === 'negociadora' ? hero(g, 'daiana') : spec.skill === 'coracao_acolhedor' ? hero(g, 'carol') : h;
    if (holder) score += [0, 12, 22, 32][holder.skill(spec.skill)];
  }
  if (h.hasPerk('labia')) score += 15;
  return score >= spec.dc;
}

// ------------------------------------------------------------ diálogos
export async function runDialog(g, id, hero, npc, startNode = null) {
  const D = DIALOGS[id];
  if (!D) { g.toast(`${npc ? npc.name : ''} não tem nada a dizer.`); return; }
  const ctx = { hero, npc, g };
  const prev = g.phase;
  g.phase = 'dialog';
  bus.emit('hud');
  let node = startNode || (typeof D.start === 'function' ? D.start(g, ctx) : D.start);
  let guard = 60;
  try {
    while (node && guard-- > 0) {
      const N = D.nodes[node];
      if (!N) { console.warn('nó inexistente', id, node); break; }
      if (N.do) N.do(g, ctx);
      const sp = speakerOf(g, N.who || 'npc', ctx);
      const choices = (N.choices || []).filter(c => !c.if || c.if(g, ctx));
      if (!sp) { node = typeof N.next === 'function' ? N.next(g, ctx) : N.next; continue; }
      const text = typeof N.t === 'function' ? N.t(g, ctx) : N.t;
      const labels = choices.map(c => {
        let lab = typeof c.t === 'function' ? c.t(g, ctx) : c.t;
        if (c.tag) lab = `<span class="tag">${c.tag}</span> ` + lab;
        if (c.op) {
          const ops = Object.entries(c.op).filter(([id]) => hero(g, id)).map(([id, v]) => `<span class="op ${v > 0 ? 'pos' : 'neg'}">${HEROES[id].nome} ${v > 0 ? '👍' : '👎'}</span>`);
          if (ops.length) lab += ' ' + ops.join(' ');
        }
        return lab;
      });
      const idx = await ask(g, sp, fill(text, ctx), labels);
      if (!choices.length) { node = typeof N.next === 'function' ? N.next(g, ctx) : N.next; continue; }
      const c = choices[idx];
      if (!c) break;
      if (c.op) applyOpinion(g, hero, c.op);
      if (c.do) await c.do(g, ctx);
      if (c.check) node = check(g, ctx, c.check) ? c.check.ok : c.check.fail;
      else node = typeof c.to === 'function' ? c.to(g, ctx) : c.to;
      if (c.trade) { await new Promise(res => bus.emit('trade', ctx.npc, ctx.hero, res)); }
    }
  } finally {
    if (g.phase === 'dialog') g.phase = prev === 'dialog' ? 'player' : prev;
    bus.emit('hud');
    g.updateVision();
    g.updateMode();
  }
}
export async function talk(g, u, npc) {
  const N = NPCS[npc.npc];
  if (npc.faction === 'hostile') { g.toast(`${npc.name} não quer conversa.`, 'erro'); return; }
  await runDialog(g, N?.dialogo || npc.npc, u, npc);
}

// ------------------------------------------------------------ missões
export function Q(g, id) { return g.state.quests[id]; }
export function questStart(g, id) {
  if (g.state.quests[id]) return;
  const q = QUESTS[id];
  g.state.quests[id] = { step: 0, done: false, failed: false, vars: {} };
  g.log(`📜 Nova missão: <b>${q.nome}</b>`, 'missao');
  bus.emit('quest', { id, tipo: 'nova' });
  bus.emit('hud');
}
export function questStep(g, id) { const s = g.state.quests[id]; if (!s || s.done || s.failed) return null; return QUESTS[id].passos[s.step]?.id || null; }
export function questAdvance(g, id, fromStep = null) {
  const s = g.state.quests[id];
  if (!s || s.done || s.failed) return false;
  const q = QUESTS[id];
  if (fromStep && q.passos[s.step]?.id !== fromStep) return false;
  const passo = q.passos[s.step];
  if (passo && passo.xp) for (const h of g.liveHeroes) g.gainXp(h, passo.xp, true);
  s.step++;
  if (s.step >= q.passos.length) return questDone(g, id);
  g.log(`📜 <b>${q.nome}</b>: ${q.passos[s.step].desc}`, 'missao');
  bus.emit('quest', { id, tipo: 'passo' });
  bus.emit('hud');
  return true;
}
export function questDone(g, id) {
  const s = g.state.quests[id];
  if (!s || s.done) return false;
  const q = QUESTS[id];
  s.done = true;
  g.log(`✅ Missão concluída: <b>${q.nome}</b>${q.xp ? ` (+${q.xp} XP para o grupo)` : ''}`, 'bom');
  g.toast(`Missão concluída: ${q.nome}`, 'bom');
  if (q.xp) for (const h of g.liveHeroes) g.gainXp(h, q.xp);
  if (q.fim) q.fim(g);
  bus.emit('quest', { id, tipo: 'fim' });
  bus.emit('hud');
  return true;
}
export function questFail(g, id, why = '') {
  const s = g.state.quests[id];
  if (!s || s.done || s.failed) return;
  s.failed = true;
  g.log(`❌ Missão falhou: <b>${QUESTS[id].nome}</b>. ${why}`, 'perigo');
  bus.emit('hud');
}
export function addClue(g, id, text) {
  if (g.state.clues.find(c => c.id === id)) return;
  g.state.clues.push({ id, text, dia: g.day(), hora: g.clock() });
  g.log(`🔎 Nova pista anotada no diário.`, 'missao');
  bus.emit('hud');
}

// ------------------------------------------------------------ conversas do grupo
let banterBusy = false;
export async function banter(g, tag, extra = {}) {
  if (banterBusy || g.phase === 'dialog') return;
  const used = g.state.banter || (g.state.banter = {});
  const now = g.state.turn;
  if (g.state.lastBanter && now - g.state.lastBanter < 6 && !extra.force) return;
  const options = BANTER.filter(b => b.quando === tag && !(b.uma && used[b.id]) && (!used[b.id] || now - used[b.id] > 60) &&
    b.quem.every(id => { const h = hero(g, id); return h && !h.st.downed; }) &&
    (!b.rel || Object.entries(b.rel).every(([pair, min]) => { const [a, c] = pair.split('|'); return min >= 0 ? rel(g, a, c) >= min : rel(g, a, c) <= -min; })) &&
    (!b.se || b.se(g, extra)));
  if (!options.length) return;
  const b = rng.pick(options);
  used[b.id] = now;
  g.state.lastBanter = now;
  banterBusy = true;
  try {
    for (const [who, text] of b.falas) {
      const h = hero(g, who);
      if (!h) continue;
      g.say(h, text);
      await wait(Math.min(3800, 1400 + text.length * 32));
    }
    if (b.efeito) b.efeito(g);
  } finally { banterBusy = false; }
}

// ------------------------------------------------------------ ganchos do jogo
export function start(g) {
  const M = g.map.marks;
  // itens de missão espalhados pela cidade
  const pile = (mark, id, n = 1) => { const p = M[mark]; if (p) { const [x, z] = g.freeNear(p[0][0], p[0][1]); g.map.addPile(x, z, id, n); } };
  pile('casa_livia', 'diario_livia');
  pile('soro', 'soro_r7');
  pile('hd', 'hd_dados');
  pile('casa_infestada', 'gato');
  pile('casa_chefe', 'foto');
  // bilhete com o segredo do cofre na casa do chefe da estação
  { const b = g.map.buildings.find(b => b.name === 'Casa do Chefe da Estação'); const p = g.map.props.find(p => p.building === b?.id && p.type === 'guarda_roupa'); if (p) { p.loot = p.loot || []; p.loot.push({ id: 'bilhete_cofre', n: 1 }); } }
  // cofre da estação guarda a chave da locomotiva
  { const b = g.map.buildings.find(b => b.type === 'estacao'); const c = g.map.props.find(p => p.building === b?.id && p.type === 'cofre'); if (c) { c.loot = [{ id: 'chave_locomotiva', n: 1 }, { id: 'mun_rifle', n: 6 }]; c.locked = true; } }
  for (const p of g.map.props) if (p.type === 'cofre') p.locked = true;
  { const b = g.map.buildings.find(b => b.type === 'eletronicos'); const d = b && b.doors.map(i => g.map.doors.get(i)).find(d => d.locked); if (d) { d.knock = 'juninho'; d.key = 'nenhuma'; } }
  { const l = g.units.find(u => u.npc === 'livia'); if (l) l.ai.drop = 'cracha'; }
  // insulina garantida num freezer do supermercado
  { const b = g.map.buildings.find(b => b.type === 'mercado'); const f = g.map.props.filter(p => p.building === b?.id && p.type === 'freezer'); if (f.length) { const p = f[f.length - 1]; p.loot = p.loot || []; p.loot.push({ id: 'insulina', n: 1 }); } }
  // caderneta do Seu Zé ficou no bar
  { const b = g.map.buildings.find(b => b.type === 'bar'); const p = g.map.props.find(p => p.building === b?.id && p.type === 'balcao'); if (p) { p.loot = p.loot || []; p.loot.push({ id: 'caderneta', n: 1 }); } }
  // peças garantidas para os finais
  const sucata = g.map.props.filter(p => p.type === 'sucata');
  if (sucata[0]) { sucata[0].loot = sucata[0].loot || []; sucata[0].loot.push({ id: 'bateria_carro', n: 1 }); }
  if (sucata[1]) { sucata[1].loot = sucata[1].loot || []; sucata[1].loot.push({ id: 'pecas_motor', n: 1 }); }
  { const b = g.map.buildings.find(b => b.type === 'deposito'); const t = g.map.props.filter(p => p.building === b?.id && p.type === 'tambor'); for (const p of t.slice(0, 2)) { p.loot = [{ id: 'combustivel', n: 1 }]; } }
  { const b = g.map.buildings.find(b => b.type === 'eletronicos'); const t = g.map.props.filter(p => p.building === b?.id && (p.type === 'vitrine' || p.type === 'caixas')); if (t[0]) { t[0].loot.push({ id: 'pecas', n: 2 }); } }
  // o zelador da escola carrega a chave do depósito
  { const b = g.map.buildings.find(b => b.type === 'escola'); const cells = rng.shuffle(g.buildingCells(b.id)); const [x, z] = cells[0]; const zz = g.spawnZombie('comum', x, z, { look: 'z_comum_d' }); zz.name = 'Seu Geraldo (zelador)'; zz.ai.drop = 'chave_deposito'; }
  // baú do esconderijo começa com um pouco de comida e o rádio de pilha
  { const bau = g.map.props.find(p => p.stash || p.type === 'bau'); if (bau) bau.loot = [{ id: 'agua', n: 2 }, { id: 'pao', n: 3 }, { id: 'radio_pilha', n: 1 }, { id: 'atadura', n: 1 }]; }
  // armadilhas na casa do Seu Arlindo
  g.state.traps = {};
  { const b = g.map.buildings.find(b => b.name === 'Casa do Seu Arlindo'); if (b) { const cells = rng.shuffle(g.buildingCells(b.id)); for (let i = 0; i < 3 && cells[i]; i++) g.state.traps[cells[i][0] + ',' + cells[i][1]] = i === 0 ? 'urso' : 'lata'; } }
  g.state.flags.prazo = 5 * 1440 + 6 * 60; // bombardeio no dia 6 às 06:00
  questStart(g, 'prologo');
  bus.emit('intro');
}

export function onTurn(g) {
  // conversas espontâneas e ambiente
  const t = g.state.turn;
  const al = g.state.alarme;
  if (al && al.t > 0) { g.noise(al.x, al.z, 20); al.t--; if (al.t <= 0) { g.state.alarme = null; g.log('🔇 O alarme finalmente parou.', 'info'); } }
  if (t % 9 === 0 && g.state.mode === 'explore') banter(g, 'ocioso');
  const h = g.hour();
  if (h >= 12 && h < 15 && t % 13 === 0) banter(g, 'calor');
  if (g.state.mode === 'combat' && t % 7 === 0) banter(g, 'combate');
  const fome = g.liveHeroes.some(x => x.need.fome < 25 || x.need.sede < 25);
  if (fome && t % 11 === 0) banter(g, 'fome');
  // relação ruim gera discussões
  if (t % 17 === 0) {
    for (const [k, v] of Object.entries(g.state.rel)) if (v <= 25 && rng.next() < 0.3) { banter(g, 'briga', { par: k }); break; }
  }
  // prazo do bombardeio
  const left = g.state.flags.prazo - g.state.time;
  if (left <= 0 && !flag(g, 'fim')) { bus.emit('ending', 'bomba'); flag(g, 'fim', 'bomba'); }
  else if (left < 1440 && !flag(g, 'aviso_24h') && flag(g, 'sabe_prazo')) { flag(g, 'aviso_24h', true); g.log('⏰ Faltam menos de 24 horas para o bombardeio de Aimorés!', 'perigo'); g.toast('Menos de 24 h para o bombardeio!', 'perigo'); }
  for (const q of Object.keys(g.state.quests)) { const qq = QUESTS[q]; if (qq.turno) qq.turno(g); }
}

export async function onTime(g, minutes) {
  // eventos aleatórios
  const st = g.state;
  if (st.weather.chuva > 0) {
    st.weather.chuvaMin = (st.weather.chuvaMin || 0) + minutes;
    if (st.weather.chuvaMin >= 30) { st.weather.chuvaMin = 0; st.weather.chuva--; if (st.weather.chuva <= 0) { st.weather.chuva = 0; g.log('🌤️ A chuva parou.', 'info'); bus.emit('weather', 'sol'); } }
  }
  st.nextEvent = st.nextEvent ?? st.time + 60;
  if (st.time >= st.nextEvent && g.phase !== 'over') {
    st.nextEvent = st.time + rng.int(70, 150);
    const cands = EVENTS.filter(e => (!e.uma || !st.flags['ev_' + e.id]) && (!e.se || e.se(g)));
    let tot = 0; for (const e of cands) tot += e.peso;
    let r = rng.next() * tot;
    for (const e of cands) {
      r -= e.peso;
      if (r <= 0) { st.flags['ev_' + e.id] = true; try { await e.run(g); } catch (err) { console.error('evento', e.id, err); } break; }
    }
  }
  const h = g.hour();
  if (h >= 19 && !flag(g, 'noite_' + g.day())) { flag(g, 'noite_' + g.day(), true); banter(g, 'noite', { force: true }); }
  if (h >= 6 && h < 7 && !flag(g, 'dia_' + g.day())) { flag(g, 'dia_' + g.day(), true); if (g.day() > 1) banter(g, 'amanhecer', { force: true }); }
}

// entrar numa célula: gatilhos de área e de prédio
export async function onEnter(g, u, x, z) {
  if (u.kind !== 'hero') return;
  const b = g.map.buildingAt(x, z);
  const key = b ? 'b' + b.id : null;
  if (b && !g.state.flags['entrou_' + b.id]) {
    g.state.flags['entrou_' + b.id] = true;
    g.log(`🏠 ${b.name}`, 'lugar');
    bus.emit('place', b.name);
    // Plano de Aula: revela a planta
    const dai = hero(g, 'daiana');
    if (dai && dai.skill('plano_de_aula') >= 2) { for (let zz = b.z0; zz <= b.z1; zz++) for (let xx = b.x0; xx <= b.x1; xx++) if (g.map.building[g.map.idx(xx, zz)] === b.id) g.map.explored[g.map.idx(xx, zz)] = 1; }
    const tipo = b.type;
    banter(g, 'entrar:' + tipo, { force: true });
  }
  if (b && b.type === 'roupas' && flag(g, 'wellington_armadilha') && !flag(g, 'emboscada_feita')) {
    flag(g, 'emboscada_feita', true);
    const cells = rng.shuffle(g.buildingCells(b.id)).slice(0, 2);
    for (const [cx, cz] of cells) { const l = g.addNpc('lobo', cx, cz); g.S.units.add(l); l.faction = 'hostile'; l.ai.state = 'hunt'; g.S.units.setHp(l, true); }
    g.log('💥 EMBOSCADA! Não tinha irmã nenhuma: dois Lobos do Asfalto estavam esperando dentro da loja!', 'perigo');
    g.updateVision(); g.updateMode();
  }
  for (const q of Object.keys(g.state.quests)) { const qq = QUESTS[q]; if (qq.entrar) await qq.entrar(g, u, x, z, b); }
}
export function onKill(g, u, src) {
  if (u.ai && u.ai.drop) { g.map.addPile(u.x, u.z, u.ai.drop, 1); g.log(`🔑 ${u.name} deixou cair alguma coisa.`, 'bom'); }
  if (u.ai && u.ai.prologo) questAdvance(g, 'prologo', 'vizinho');
  if (u.kind === 'zombie' && src && src.kind === 'hero') {
    const k = g.state.stats.kills;
    if (k === 1 || k % 25 === 0) banter(g, 'matou', { force: k === 1 });
  }
  for (const q of Object.keys(g.state.quests)) { const qq = QUESTS[q]; if (qq.matou) qq.matou(g, u, src); }
}
export function onHeroDown(g, h) { banter(g, 'caiu', { force: true, quem: h.id }); }
export function onHeroDead(g, h) {
  for (const o of g.liveHeroes) relChange(g, o.id, h.id, 0);
  g.state.flags['morreu_' + h.id] = true;
}
export function onNpcDead(g, npc, src) {
  g.state.flags['morto_' + npc.npc] = true;
  for (const q of Object.keys(g.state.quests)) { const qq = QUESTS[q]; if (qq.npcMorreu) qq.npcMorreu(g, npc, src); }
  if (src && src.kind === 'hero' && npc.faction !== 'hostile') { for (const h of g.liveHeroes) h.need.moral = Math.max(0, h.need.moral - 10); const c = hero(g, 'carol'); if (c) relChange(g, 'carol', src.id, -12); }
}
export function onProvoke(g, npc) { g.state.flags['hostil_' + npc.npc] = true; }
export function onBossDead(g, u) {
  flag(g, 'matriz_morta', true);
  g.log('🌿 A Matriz caiu. O coração do surto parou de bater.', 'bom');
  g.toast('A Matriz foi derrotada!', 'bom');
  for (const h of g.liveHeroes) g.gainXp(h, 150);
  banter(g, 'chefe', { force: true });
  questAdvance(g, 'agronova', 'matriz');
}
export async function onSearch(g, u, p) {
  if (p.alarme) { p.alarme = false; g.state.alarme = { x: p.x, z: p.z, t: 4 }; g.noise(p.x, p.z, 22, u); g.log('🚨 UÍÓÓÓ-UÍÓÓÓ! O carro tinha alarme! Todo zumbi da região ouviu.', 'perigo'); banter(g, 'alarme', { force: true }); }
  for (const q of Object.keys(g.state.quests)) { const qq = QUESTS[q]; if (qq.vasculhou) await qq.vasculhou(g, u, p); }
}
export function onItem(g, u, id) {
  const it = ITEMS[id];
  if (it.nota && !g.state.clues.find(c => c.id === id)) {
    addClue(g, id, it.desc);
    setTimeout(() => bus.emit('note', it), 50);
  }
  for (const q of Object.keys(g.state.quests)) { const qq = QUESTS[q]; if (qq.pegou) qq.pegou(g, u, id); }
  if (id === 'gato') banter(g, 'gato', { force: true });
}
export function onGive(g, u, other, id) { }
export async function onWake(g) { banter(g, 'amanhecer', { force: true }); }
export async function nightAttack(g) {
  // zumbis aparecem perto da porta do esconderijo
  const b = g.map.buildings.find(b => b.safehouse);
  const doors = b ? b.doors.map(i => g.map.doors.get(i)).filter(d => d.entrance) : [];
  const d = doors[0];
  if (!d) return;
  for (let i = 0; i < 3 + rng.int(0, 2); i++) {
    const [x, z] = g.freeNear(d.x + rng.int(-3, 3), d.z + rng.int(2, 5));
    const zz = g.spawnZombie(rng.pick(['comum', 'comum', 'corredor']), x, z);
    zz.ai.state = 'investigate'; zz.ai.noise = { x: d.x, z: d.z, turn: g.state.turn };
  }
  g.updateVision(); g.updateMode();
  banter(g, 'ataque_noturno', { force: true });
}

// ------------------------------------------------------------ rádio de pilha
export async function radio(g, u) {
  const ctx = { hero: u };
  if (questStep(g, 'prologo') === 'radio') {
    await scene(g, [
      ['narr', '📻 <i>Chiiiiiiiado...</i>'],
      ['Rádio Aimorés FM', '— ...atenção, moradores de Aimorés e região. Aqui é a Rádio Aimorés FM, 87,9. A Defesa Civil pede que ninguém saia de casa.'],
      ['Rádio Aimorés FM', '— Há relatos de pessoas agressivas... mordendo... na Praça da Matriz e na Avenida Rio Doce. O exército bloqueou a ponte para Baixo Guandu.'],
      ['Rádio Aimorés FM', '— A Igreja Matriz está recebendo desabrigados. Repito: evitem a praça depois que escurecer. Evit... ah, meu Deus, ele tá entrando! Tá entrando no estúd—'],
      ['narr', '📻 <i>Silêncio. Só chiado.</i>'],
      ['pablicio', 'Gente. GENTE. Isso é zumbi. É apocalipse zumbi. Eu sempre falei que ia ter apocalipse zumbi e todo mundo riu!'],
      ['arthur', 'Ninguém riu, você que ficou falando sozinho no churrasco.'],
      ['daiana', 'Foco, turma. Primeiro: comida e água. Segundo: o Professor Tavares ficou na escola com os alunos da recuperação. A gente vai buscar eles.'],
      ['carol', 'E ninguém sai sozinho. Ninguém.'],
    ], ctx);
    questAdvance(g, 'prologo', 'radio');
    return;
  }
  if (!flag(g, 'radio_prazo') && (flag(g, 'juninho_bateria') || g.day() >= 2)) {
    flag(g, 'radio_prazo', true); flag(g, 'sabe_prazo', true);
    await scene(g, [
      ['narr', '📻 <i>Uma voz metálica, gravada, repete em loop:</i>'],
      ['Transmissão militar', '— Protocolo Vale Seguro. A área urbana de Aimorés será esterilizada às 06h00 do dia 6. A evacuação está encerrada. Repito: a área será esterilizada às 06h00 do dia 6.'],
      ['arthur', '"Esterilizada"... isso é o que eu tô pensando? Tipo... bomba?'],
      ['daiana', 'É. A gente tem até o dia 6 para sair daqui ou provar que tem cura.'],
    ], ctx);
    g.log('⏰ Prazo: a cidade será bombardeada às 06:00 do dia 6.', 'perigo');
    bus.emit('hud');
    return;
  }
  const falas = [
    '— ...se você está ouvindo isso, fique longe de lugares escuros. Eles se escondem no escuro...',
    '— ...a Igreja Matriz ainda está de portas abertas. O Padre Anselmo toca o sino ao meio-dia...',
    '— ...aqui é o Juninho, da loja de eletrônicos, testando... testando... alguém? Por favor?',
    '— ...zumbis parecem mais lentos no calor do meio-dia. Aproveitem para se mover...',
    '— ...motoqueiros armados tomaram o Posto Rio Doce. Cuidado com os Lobos do Asfalto...',
  ];
  await say(g, 'narr', `📻 <i>${rng.pick(falas)}</i>`, ctx);
}

// ------------------------------------------------------------ opções especiais em objetos
export function propOptions(g, u, p) {
  const out = [];
  for (const q of Object.keys(QUESTS)) { const qq = QUESTS[q]; if (qq.opcoes) for (const o of qq.opcoes(g, u, p) || []) out.push(o); }
  if (p.type === 'sino') out.push({ label: 'Tocar o sino (atrai zumbis para a praça)', ap: 2, fn: () => tocarSino(g, u, p) });
  if (p.type === 'cofre' && p.locked) {
    out.push({ label: 'Cofre trancado — usar o segredo', ap: 1, disabled: !anyHeroHas(g, 'bilhete_cofre'), fn: () => abrirCofre(g, u, p, 'segredo') });
    if (u.skill('mao_na_graxa')) out.push({ label: 'Arrombar o cofre (Mão na Graxa)', ap: 4, fn: () => abrirCofre(g, u, p, 'graxa') });
  }
  return out;
}
async function tocarSino(g, u, p) {
  if (!(await g.approach(u, p.x, p.z, 2))) return;
  if (!g.can(u, 2)) return;
  await g.act(async () => {
    g.spend(u, 2);
    await g.S.units.play(u, 'interact');
    g.noise(p.x, p.z, 30, u);
    g.S.shake = 0.4;
    g.log('🔔 DOOOOM... DOOOOM... O sino da Matriz ecoa pela cidade. Os zumbis estão vindo para a praça!', 'alerta');
    banter(g, 'sino', { force: true });
  });
}
async function abrirCofre(g, u, p, how) {
  if (!(await g.approach(u, p.x, p.z, how === 'graxa' ? 4 : 1))) return;
  const cost = how === 'graxa' ? 4 : 1;
  if (!g.can(u, cost)) return;
  await g.act(async () => {
    g.spend(u, cost);
    await g.S.units.play(u, 'interact');
    p.locked = false;
    g.log(how === 'graxa' ? `🔧 ${u.name} abriu o cofre no ouvido, igual filme de assalto.` : '🔢 O segredo funcionou: 7-4-2-1. O cofre abriu!', 'bom');
    bus.emit('loot', { source: p, hero: u });
  });
}

export async function knock(g, u, d) {
  if (!(await g.approach(u, d.x, d.z, 0))) return;
  const npc = g.units.find(x => x.npc === d.knock && x.alive);
  if (!npc) { g.toast('Ninguém responde.'); return; }
  g.noise(d.x, d.z, 3, u);
  await runDialog(g, NPCS[npc.npc].dialogo, u, npc);
}

// ------------------------------------------------------------ finais
export function endingSummary(g, kind) {
  const saved = (g.state.saved || []).length + (flag(g, 'escola_escoltada') ? 3 : 0) + (flag(g, 'escola_fortificada') ? 2 : 0);
  const vivos = g.liveHeroes.map(h => h.name);
  const mortos = g.heroes.filter(h => h.dead).map(h => h.name);
  const cura = anyHeroHas(g, 'hd_dados') || flag(g, 'formula_transmitida');
  return { kind, saved, vivos, mortos, cura, dias: g.day(), kills: g.state.stats.kills, rel: g.state.rel };
}
