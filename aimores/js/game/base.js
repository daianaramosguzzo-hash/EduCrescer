// Coleta de recursos (cortar árvore, quebrar pedra, desmontar carro, colher fibra), rebrota,
// construção da base no terreno da Casa da Turma e o funcionamento das peças construídas
// (portões, baús e armário da turma, fogueira, camas, bancadas, área médica e horta).
import { PROPS } from '../world/tiles.js';
import { ITEMS } from '../data/items.js';
import { addItem, countItem, removeItem } from './units.js';
import { rng, bus } from '../util.js';

// peças que dá para construir (custo, nível mínimo do personagem, onde fazer)
export const BUILDS = [
  { id: 'parede_madeira', custo: [['madeira', 4]], nivel: 1, desc: 'Segura zumbis por um tempo. Primeira linha de defesa.' },
  { id: 'portao_madeira', custo: [['madeira', 5], ['corda', 1]], nivel: 1, desc: 'Abre e fecha. Zumbi só passa arrebentando.' },
  { id: 'fogueira', custo: [['madeira', 3], ['pedra', 3]], nivel: 1, desc: 'Cozinha, faz chá e ilumina a noite.' },
  { id: 'bau_madeira', custo: [['madeira', 6]], nivel: 1, desc: 'Guarda itens na base.' },
  { id: 'cama_palha', custo: [['fibra', 6], ['madeira', 2]], nivel: 2, desc: 'Dormir na base até de manhã.' },
  { id: 'bancada_trab', custo: [['madeira', 6], ['pedra', 2], ['corda', 1]], nivel: 2, desc: 'Libera armas, ferramentas e peças de metal.' },
  { id: 'estacas', custo: [['madeira', 3]], nivel: 2, desc: 'Machuca o zumbi que tentar derrubar.' },
  { id: 'coletor', custo: [['madeira', 4], ['pano', 2]], nivel: 3, desc: 'Junta água da chuva (e do sereno) com o tempo.' },
  { id: 'parede_pedra', custo: [['pedra', 6], ['madeira', 1]], nivel: 3, desc: 'Bem mais resistente que madeira.' },
  { id: 'parede_metal', custo: [['metal', 6]], nivel: 5, bancada: true, desc: 'A parede mais forte. Precisa de uma bancada na base.' },
  { id: 'horta', custo: [['madeira', 2], ['fibra', 2]], nivel: 2, desc: 'Canteiro para plantar sementes. Rega com água e colhe hortaliças.' },
  { id: 'area_medica', custo: [['madeira', 4], ['pano', 3], ['metal', 1]], nivel: 3, desc: 'Maca e armário de remédios: trata ferimentos e fabrica ataduras, soro e kits.' },
  { id: 'bancada_armas', custo: [['madeira', 5], ['metal', 4], ['corda', 1]], nivel: 4, bancada: true, desc: 'Armas melhores e munição. Precisa de uma bancada de trabalho na base.' },
  { id: 'armario_base', custo: [['madeira', 8], ['metal', 2]], nivel: 3, desc: 'Estoque grande da base, de todos: qualquer sobrevivente guarda e pega.' },
];

// ferramentas: multiplicador de tempo por golpe (menor = mais rápido)
const TOOLS = {
  machado: [['machado', 0.5], ['machado_pedra', 0.55], ['facao', 0.75]],
  picareta: [['picareta', 0.5], ['pe_de_cabra', 0.75], ['martelo', 0.8]],
  desmonte: [['pe_de_cabra', 0.7], ['ferramentas', 0.8], ['martelo', 0.9], ['picareta', 1]],
};
const BARE = { machado: 1.7, picareta: 1.9, desmonte: null };

export function installBase(Game) {
  Object.assign(Game.prototype, {
    // ------------------------------------------------------------ área da base
    baseArea() {
      const b = this.map.buildings.find(b => b.safehouse);
      if (!b) return null;
      return { x0: Math.max(1, b.x0 - 3), z0: Math.max(1, b.z0 - 3), x1: b.x1 + 3, z1: b.z1 + 4 };
    },
    inBase(x, z) { const a = this.baseArea(); return !!a && x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1; },

    // ------------------------------------------------------------ coleta
    toolFor(u, kind) {
      let best = null;
      for (const [id, k] of TOOLS[kind] || []) if (countItem(u, id) > 0 && (!best || k < best[1])) best = [id, k];
      if (best) return { id: best[0], mul: best[1] };
      return BARE[kind] ? { id: null, mul: BARE[kind] } : null;
    },
    gatherLeft(p) {
      const g = PROPS[p.type].gather;
      if (!g) return 0;
      p.extra = p.extra || {};
      if (p.extra.res === undefined) p.extra.res = rng.int(g.n[0], g.n[1]);
      return p.extra.res;
    },
    gatherOption(u, p) {
      const G = PROPS[p.type].gather;
      if (!G) return null;
      const left = this.gatherLeft(p);
      if (left <= 0) return { label: `${G.verbo} (já está vazio)`, disabled: true, fn: () => {} };
      const tool = G.ferramenta ? this.toolFor(u, G.ferramenta) : { id: null, mul: 1 };
      if (!tool) return { label: `${G.verbo} — precisa de pé de cabra, martelo ou ferramentas`, disabled: true, fn: () => {} };
      const how = tool.id ? ` com ${ITEMS[tool.id].nome.toLowerCase()}` : G.ferramenta ? ' na mão (devagar)' : '';
      return { label: `${G.verbo}${how} → ${ITEMS[G.item].icon} ${ITEMS[G.item].nome}`, ap: 0, fn: () => this.gather(u, p) };
    },
    async gather(u, p) {
      const G = PROPS[p.type].gather;
      if (!G || this.gatherLeft(p) <= 0) return;
      const cells = this.map.propCells(p);
      const near = cells.some(([x, z]) => Math.max(Math.abs(u.x - x), Math.abs(u.z - z)) <= 1);
      if (!near) {
        const [tx, tz] = cells.slice().sort((a, b) => Math.hypot(a[0] - u.x, a[1] - u.z) - Math.hypot(b[0] - u.x, b[1] - u.z))[0];
        if (!(await this.approach(u, tx, tz))) return;
      }
      const tool = G.ferramenta ? this.toolFor(u, G.ferramenta) : { id: null, mul: 1 };
      if (!tool) return;
      const [cx, cz] = cells[0];
      u.face = Math.atan2(cx + 0.5 - u.px, cz + 0.5 - u.pz);
      u.gather = { p, per: G.tempo * tool.mul };
      u.gatherT = u.gather.per;
      this.S.units.play(u, 'attack');
    },
    cancelGather(u) { u.gather = null; u.gatherT = 0; },
    gatherTick(u, dt) {
      const gt = u.gather;
      if (!gt) return;
      const p = gt.p;
      if (p.removed || this.gatherLeft(p) <= 0) { this.cancelGather(u); return; }
      u.gatherT -= dt;
      if (u.gatherT > 0) return;
      const G = PROPS[p.type].gather;
      // um golpe
      u.gatherT = gt.per;
      this.S.units.play(u, 'attack');
      const sound = G.item === 'madeira' ? 'thud' : G.item === 'metal' ? 'hammer' : G.item === 'pedra' ? 'bang' : 'click2';
      bus.emit('sfx', sound, p.x, p.z);
      this.noise(p.x, p.z, G.item === 'fibra' ? 1.5 : G.item === 'metal' ? 8 : 6, u);
      p.extra.res--;
      const got = [[G.item, 1]];
      for (const [id, ch] of G.extra || []) if (rng.next() < ch) got.push([id, 1]);
      const def = PROPS[p.type];
      if (def.fruta && rng.next() < 0.25) got.push([def.fruta, 1]);
      for (const [id, n] of got) { addItem(u, id, n); this.S.units.floatText(u.x, u.z, `+${n} ${ITEMS[id].icon}`, 'xp'); }
      this.gainXp(u, 1, true);
      bus.emit('hud');
      if (p.extra.res <= 0) { this.depleteNode(p); this.cancelGather(u); this.log(`${def.nome}: não sobrou nada para pegar.`, 'info'); }
    },
    depleteNode(p) {
      const def = PROPS[p.type];
      const G = def.gather;
      if (!G.vira && !G.regrow) return; // carros ficam lá, depenados
      this.map.removeProp(p);
      let stump = null;
      if (G.vira) { stump = this.map.addProp(G.vira, p.x, p.z, 1, 1, 0, { added: true }); }
      if (G.regrow) (this.state.regrow ||= []).push({ type: p.type, x: p.x, z: p.z, w: p.w, d: p.d, rot: p.rot, at: this.state.time + G.regrow * 60, stump: !!stump });
      this.S.world.rebuildChunkAt(p.x, p.z);
      this.visionDirty = true;
    },
    // a cada hora: árvores, arbustos e pedras voltam; o coletor junta água
    regrowTick() {
      if (this.zone) return;
      const list = this.state.regrow || [];
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        if (this.state.time < r.at) continue;
        if (this.unitAt(r.x, r.z)) continue;
        const cur = this.map.prop(r.x, r.z);
        if (cur && cur.type !== 'toco') { list.splice(i, 1); continue; }
        if (cur) this.map.removeProp(cur);
        this.map.addProp(r.type, r.x, r.z, r.w, r.d, r.rot, { added: true });
        list.splice(i, 1);
        this.S.world.rebuildChunkAt(r.x, r.z);
      }
      for (const p of this.map.props) {
        if (p.removed || !PROPS[p.type].coletor) continue;
        p.extra = p.extra || {};
        const add = this.state.weather.chuva ? 2 : (this.hour() >= 4 && this.hour() < 7 ? 1 : 0.34);
        p.extra.agua = Math.min(6, (p.extra.agua || 0) + add);
      }
      this.hortaTick();
    },
    // horta: o que foi plantado cresce com as horas (chuva ajuda)
    hortaTick() {
      for (const p of this.map.props) {
        if (p.removed || !PROPS[p.type].horta || !p.extra || !p.extra.cultivo) continue;
        const c = p.extra.cultivo;
        if (this.state.weather.chuva) c.pronto -= 30;
        const total = c.pronto - c.plantado, feito = this.state.time - c.plantado;
        const fase = feito >= total ? 2 : feito >= total / 2 ? 1 : 0;
        if (fase !== c.fase) { c.fase = fase; this.S.world.rebuildChunkAt(p.x, p.z); if (fase === 2 && this.active && this.inBase(this.active.x, this.active.z)) this.log('🥬 A horta está pronta para colher!', 'bom'); }
      }
    },
    async plantar(u, p) {
      if (!(await this.approach(u, p.x, p.z))) return;
      if (countItem(u, 'sementes') < 1) { this.toast('Precisa de sementes (acha em fazendas e cozinhas).', 'erro'); return; }
      const agua = this.buildStock(u, 'agua') >= 1;
      if (!agua && !this.state.weather.chuva) { this.toast('Precisa de 1 água para regar (ou espere chover).', 'erro'); return; }
      removeItem(u, 'sementes', 1);
      if (!this.state.weather.chuva) this.payBuild(u, 'agua', 1);
      const horas = u.id === 'pablicio' || u.id === 'carol' ? 7 : 8;
      p.extra.cultivo = { plantado: this.state.time, pronto: this.state.time + horas * 60, fase: 0 };
      this.S.units.play(u, 'pickup');
      this.S.world.rebuildChunkAt(p.x, p.z);
      this.gainXp(u, 4);
      this.log(`🌱 ${u.name} plantou no canteiro. Fica pronto em umas ${horas} horas.`, 'bom');
      bus.emit('hud');
    },
    async colher(u, p) {
      if (!(await this.approach(u, p.x, p.z))) return;
      const c = p.extra.cultivo;
      if (!c || (c.fase || 0) < 2) return;
      const n = rng.int(2, 3) + (u.id === 'daiana' ? 1 : 0);
      addItem(u, 'hortalicas', n);
      if (rng.next() < 0.6) addItem(u, 'sementes', 1);
      p.extra.cultivo = null;
      this.S.units.play(u, 'pickup');
      this.S.units.floatText(u.x, u.z, `+${n} 🥬`, 'xp');
      this.S.world.rebuildChunkAt(p.x, p.z);
      this.gainXp(u, 8);
      this.log(`🥬 ${u.name} colheu ${n} hortaliça(s) da horta.`, 'bom');
      bus.emit('hud');
    },
    // maca da área médica: trata os ferimentos e recupera um pouco de vida (uma vez a cada 6 horas)
    async maca(u, p) {
      if (!(await this.approach(u, p.x, p.z))) return;
      if (this.state.mode === 'combat') { this.toast('Não dá para se tratar com zumbi por perto.', 'erro'); return; }
      const last = u.st.macaAt ?? -1e9;
      if (this.state.time - last < 360) { this.toast(`A maca ajuda de novo daqui a ${Math.ceil((360 - (this.state.time - last)) / 60)} h.`, 'erro'); return; }
      u.st.macaAt = this.state.time;
      await this.S.units.play(u, 'medicine');
      const heal = Math.round((u.id === 'carol' ? 35 : 22));
      u.hp = Math.min(u.maxHp, u.hp + heal);
      u.st.bleed = 0;
      for (const w of u.wounds) w.tratado = true;
      if (u.st.infected) u.need.infeccao = Math.max(0, u.need.infeccao - 5);
      for (let i = 0; i < 20; i++) this.passMinute();
      this.S.units.floatText(u.x, u.z, `+${heal}`, 'heal');
      this.log(`⛑️ ${u.name} se tratou na área médica (+${heal} de vida, ferimentos tratados).`, 'bom');
      bus.emit('hud');
    },

    // ------------------------------------------------------------ construção
    buildLevel() { return this.selected ? this.selected.lvl || 1 : 1; },
    // custo de uma peça para quem constrói (Pablício economiza material)
    buildCost(u, b) { return b.custo.map(([id, n]) => [id, u && u.id === 'pablicio' ? Math.max(1, Math.ceil(n * 0.75)) : n]); },
    // recursos: inventário de quem constrói + baús da base
    buildStock(u, id) {
      let n = countItem(u, id);
      for (const p of this.map.props) if (!p.removed && (PROPS[p.type].stash) && this.inBase(p.x, p.z)) for (const e of p.loot || []) if (e.id === id) n += e.n;
      return n;
    },
    payBuild(u, id, n) {
      const fromInv = Math.min(n, countItem(u, id));
      if (fromInv) removeItem(u, id, fromInv);
      n -= fromInv;
      for (const p of this.map.props) {
        if (n <= 0) break;
        if (p.removed || !PROPS[p.type].stash || !this.inBase(p.x, p.z)) continue;
        for (const e of p.loot || []) { if (e.id !== id || n <= 0) continue; const k = Math.min(n, e.n); e.n -= k; n -= k; }
        p.loot = (p.loot || []).filter(e => e.n > 0);
      }
    },
    hasBench() { return this.map.props.some(p => !p.removed && PROPS[p.type].estacao === 'bancada' && p.extra && p.extra.built); },
    buildCheck(u, b) {
      if (this.buildLevel() < b.nivel) return `Nível ${b.nivel}`;
      if (b.bancada && !this.hasBench()) return 'Precisa de bancada na base';
      for (const [id, n] of this.buildCost(u, b)) if (this.buildStock(u, id) < n) return 'Faltam materiais';
      return null;
    },
    canPlace(x, z) {
      const m = this.map;
      if (!this.inBase(x, z) || !m.inb(x, z)) return false;
      const i = m.idx(x, z);
      if (m.struct[i] || m.propAt[i] >= 0 || m.blocked(x, z)) return false;
      if (m.floor[i] === 12) return false;
      if (this.units.some(o => o.alive && o.x === x && o.z === z)) return false;
      return true;
    },
    placeBuild(u, id, x, z) {
      const b = BUILDS.find(b => b.id === id);
      if (!b || !u) return false;
      const why = this.buildCheck(u, b);
      if (why) { this.toast(why, 'erro'); return false; }
      if (!this.canPlace(x, z)) { this.toast('Não dá para construir aí (só no terreno da Casa da Turma, em espaço livre).', 'erro'); return false; }
      for (const [rid, n] of this.buildCost(u, b)) this.payBuild(u, rid, n);
      const def = PROPS[id];
      const hp = Math.round(def.built * (u.id === 'pablicio' ? 1.5 : 1));
      this.map.addProp(id, x, z, 1, 1, 0, { added: true, extra: { built: true, hp, max: hp, open: false } });
      this.map.version++;
      this.S.world.rebuildChunkAt(x, z);
      if (def.luz) this.refreshLights();
      this.visionDirty = true;
      this.S.units.play(u, 'interact');
      bus.emit('sfx', 'hammer', x, z);
      this.noise(x, z, 4, u);
      this.gainXp(u, 5);
      this.log(`🔨 ${u.name} construiu: ${def.nome}.`, 'bom');
      bus.emit('hud');
      return true;
    },
    destroyBuilt(p) {
      this.map.removeProp(p);
      this.S.world.rebuildChunkAt(p.x, p.z);
      if (PROPS[p.type].luz) this.refreshLights();
      this.visionDirty = true;
      bus.emit('sfx', 'bang', p.x, p.z);
      if (this.mapHeroes.some(h => Math.hypot(h.x - p.x, h.z - p.z) < 16)) this.log(`💥 ${PROPS[p.type].nome} da base foi destruída!`, 'perigo');
    },
    async dismantle(u, p) {
      if (!(await this.approach(u, p.x, p.z))) return;
      const b = BUILDS.find(b => b.id === p.type);
      if (PROPS[p.type].stash && (p.loot || []).length) { this.toast('Esvazie o baú antes.', 'erro'); return; }
      this.map.removeProp(p);
      this.S.world.rebuildChunkAt(p.x, p.z);
      if (PROPS[p.type].luz) this.refreshLights();
      if (b) for (const [id, n] of b.custo) if (Math.floor(n / 2) > 0) addItem(u, id, Math.floor(n / 2));
      this.S.units.play(u, 'interact');
      this.log(`${u.name} desmontou: ${PROPS[p.type].nome} (metade do material voltou).`, 'info');
      this.visionDirty = true;
      bus.emit('hud');
    },
    async toggleGate(u, p) {
      if (!(await this.approach(u, p.x, p.z))) return;
      if (!p.extra.open && this.units.some(o => o.alive && o.x === p.x && o.z === p.z)) return;
      p.extra.open = !p.extra.open;
      this.S.world.rebuildChunkAt(p.x, p.z);
      this.map.version++;
      bus.emit('sfx', p.extra.open ? 'door_open' : 'door_close', p.x, p.z);
      this.S.units.play(u, 'interact');
      this.visionDirty = true;
    },
    async takeWater(u, p) {
      if (!(await this.approach(u, p.x, p.z))) return;
      const n = Math.floor(p.extra.agua || 0);
      if (n <= 0) { this.toast('O coletor ainda está vazio.', 'erro'); return; }
      p.extra.agua -= n;
      addItem(u, 'agua', n);
      this.S.units.play(u, 'pickup');
      this.log(`💧 ${u.name} pegou ${n} garrafa(s) de água do coletor.`, 'bom');
      bus.emit('hud');
    },
    // opções extras no clique direito para recursos e peças da base
    baseOptions(u, p) {
      const out = [];
      const def = PROPS[p.type];
      const gopt = this.gatherOption(u, p);
      if (gopt) out.push(gopt);
      if (p.extra && p.extra.built) {
        if (def.porta) out.push({ label: p.extra.open ? 'Fechar o portão' : 'Abrir o portão', ap: 0, fn: () => this.toggleGate(u, p) });
        if (def.estacao === 'bancada') out.push({ label: 'Usar a bancada de trabalho', ap: 0, fn: async () => { if (await this.approach(u, p.x, p.z)) bus.emit('craft', u, p); } });
        if (def.estacao === 'armas') out.push({ label: 'Usar a bancada de armas', ap: 0, fn: async () => { if (await this.approach(u, p.x, p.z)) bus.emit('craft', u, p); } });
        if (def.estacao === 'medica') {
          out.push({ label: 'Deitar na maca (trata ferimentos e recupera vida)', ap: 0, fn: () => this.maca(u, p) });
          out.push({ label: 'Fazer remédios na área médica', ap: 0, fn: async () => { if (await this.approach(u, p.x, p.z)) bus.emit('craft', u, p); } });
        }
        if (def.horta) {
          const c = p.extra.cultivo;
          if (!c) out.push({ label: `Plantar (1 semente + 1 água) — sementes: ${countItem(u, 'sementes')}`, ap: 0, disabled: countItem(u, 'sementes') < 1, fn: () => this.plantar(u, p) });
          else if ((c.fase || 0) >= 2) out.push({ label: '🥬 Colher a horta', ap: 0, fn: () => this.colher(u, p) });
          else out.push({ label: `A horta está crescendo (pronta em ~${Math.max(1, Math.ceil((c.pronto - this.state.time) / 60))} h)`, ap: 0, disabled: true, fn: () => {} });
        }
        if (def.coletor) out.push({ label: `Pegar água do coletor (${Math.floor(p.extra.agua || 0)})`, ap: 0, disabled: (p.extra.agua || 0) < 1, fn: () => this.takeWater(u, p) });
        if (def.camaBase) out.push({ label: 'Dormir até de manhã', ap: 0, fn: () => this.sleep() });
        out.push({ label: `Desmontar ${def.nome.toLowerCase()} (${Math.round(p.extra.hp)}/${p.extra.max} de resistência)`, ap: 0, fn: () => this.dismantle(u, p) });
        if (p.extra.hp < p.extra.max) out.push({ label: `Consertar (1 madeira)${u.id === 'pablicio' ? ' — Pablício conserta em dobro' : ''}`, ap: 0, disabled: this.buildStock(u, 'madeira') < 1, fn: async () => { if (!(await this.approach(u, p.x, p.z))) return; this.payBuild(u, 'madeira', 1); p.extra.hp = Math.min(p.extra.max, p.extra.hp + p.extra.max * (u.id === 'pablicio' ? 0.8 : 0.4)); this.S.units.play(u, 'interact'); bus.emit('sfx', 'hammer', p.x, p.z); this.gainXp(u, 2, true); } });
      }
      return out;
    },
  });
}
