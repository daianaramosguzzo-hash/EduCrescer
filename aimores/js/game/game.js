// Núcleo do jogo: estado, turnos com Pontos de Ação, modo exploração/combate, visão do grupo,
// iluminação, ruído, tempo, experiência, ferimentos e salvamento.
import { generateMap, rollLoot } from '../world/mapgen.js';
import { S, F, PROPS } from '../world/tiles.js';
import { HEROES, HERO_ORDER, XP_LEVELS } from '../data/heroes.js';
import { ZOMBIES } from '../data/zombies.js';
import { NPCS } from '../data/npcs.js';
import { ITEMS } from '../data/items.js';
import { Unit, makeHero, makeZombie, turnAp, visionRange, recompute, addItem, resetUid, peekUid } from './units.js';
import { fov, computeStaticLight, los } from './vision.js';
import { findPath, reachable, passCost } from './path.js';
import { rng, bus, clamp, fmtTime, wait } from '../util.js';
import { runAI } from './ai.js';
import { tickSurvival, temperature } from './survival.js';
import * as Story from './story.js';

export const DIFF = {
  facil: { nome: 'Fácil', zombies: 0.7, zdmg: 0.8, needs: 0.8, spawn: 0.6 },
  normal: { nome: 'Normal', zombies: 1, zdmg: 1, needs: 1, spawn: 1 },
  dificil: { nome: 'Difícil', zombies: 1.35, zdmg: 1.2, needs: 1.2, spawn: 1.4 },
};

export class Game {
  constructor(scene) {
    this.S = scene;
    this.phase = 'none';
    this.busy = 0;
    this.selected = null;
    this.visible = new Set();
    this.input = { run: false, target: null };
    this.speed = 1;
  }
  get heroes() { return this.units.filter(u => u.kind === 'hero'); }
  get liveHeroes() { return this.units.filter(u => u.kind === 'hero' && !u.dead); }
  get diff() { return DIFF[this.state.diffKey] || DIFF.normal; }
  unitAt(x, z) { return this.units.find(u => u.x === x && u.z === z && !u.dead && !u.gone) || null; }
  corpseAt(x, z) { return this.units.find(u => u.x === x && u.z === z && u.dead && !u.gone) || null; }
  occupied = (x, z) => !!this.unitAt(x, z);
  isNight() { return this.S.env.night > 0.55; }
  hour() { return (this.state.time / 60) % 24; }
  day() { return Math.floor(this.state.time / 1440) + 1; }
  clock() { return fmtTime(this.state.time); }

  // ------------------------------------------------------------ início
  newGame({ seed = Date.now() % 100000, diff = 'normal' } = {}) {
    rng.seed(seed * 7 + 3);
    resetUid(1);
    this.state = {
      version: 1, seed, diffKey: diff, time: 7 * 60 + 10, turn: 1, mode: 'explore',
      flags: {}, quests: {}, rel: {}, rep: {}, log: [], weather: { chuva: 0 }, cds: {},
      stats: { kills: 0, turnos: 0, salvos: 0 }, saved: [], clues: [], notes: [], rngState: 0, uidNext: 1,
    };
    for (let i = 0; i < HERO_ORDER.length; i++) for (let j = i + 1; j < HERO_ORDER.length; j++) this.state.rel[HERO_ORDER[i] + '|' + HERO_ORDER[j]] = 55;
    this.map = generateMap(seed);
    this.units = [];
    const starts = this.map.marks.inicio;
    HERO_ORDER.forEach((id, i) => this.units.push(makeHero(id, starts[i][0], starts[i][1])));
    this.spawnNpcs();
    this.spawnInitialZombies();
    this.afterLoad();
    Story.start(this);
  }

  afterLoad() {
    this.S.setMap(this.map);
    for (const u of this.units) if (!u.gone) this.S.units.add(u);
    for (const u of this.units) if (u.kind !== 'hero' && u.faction !== 'zombie') this.S.units.setHp(u, false);
    computeStaticLight(this.map);
    this.refreshLights();
    const h = this.liveHeroes[0];
    this.select(h);
    this.S.focus(h.x + 0.5, h.z + 0.5, true);
    this.updateVision();
    this.phase = 'player';
    this.S.setTime(this.state.time, this.state.weather);
    bus.emit('hud');
  }

  spawnNpcs() {
    const M = this.map.marks;
    const place = (npcId, mark, idx = 0, extra = {}) => {
      const pts = M[mark];
      if (!pts || !pts.length) return null;
      let [x, z] = pts[Math.min(idx, pts.length - 1)];
      [x, z] = this.freeNear(x, z);
      return this.addNpc(npcId, x, z, extra);
    };
    place('ze', 'ze'); place('graca', 'graca'); place('cotinha', 'cotinha'); place('juninho', 'juninho');
    place('padre', 'padre'); place('valdir', 'valdir'); place('livia', 'livia'); place('tonhao', 'tonhao');
    place('lobo', 'lobo', 0); place('lobo', 'lobo', 1); place('lobo', 'lobo', 2);
    place('sargento', 'sargento'); place('arlindo', 'casa_prepper');
    place('tavares', 'escola_biblioteca'); place('aluno1', 'escola_biblioteca'); place('aluno2', 'escola_biblioteca');
    place('neide', 'oliveira'); place('jorge', 'oliveira');
  }
  addNpc(npcId, x, z, extra = {}) {
    const N = NPCS[npcId];
    const look = N.looks ? N.looks[Math.floor(rng.next() * N.looks.length)] : N.look;
    const arma = N.armas ? N.armas[Math.floor(rng.next() * N.armas.length)] : N.arma;
    const u = new Unit({ kind: 'npc', faction: N.faccao, look, name: N.nome, x, z, hp: N.hp, maxHp: N.hp, maxAp: 6, stats: N.stats || {}, npc: npcId, id: npcId, face: rng.next() * 6.28 });
    if (arma) { u.eq.mao = { id: arma, n: 1 }; if (ITEMS[arma].w?.pente) u.eq.mao.loaded = ITEMS[arma].w.pente; }
    u.ai = { state: 'idle', comport: N.comport, home: [x, z] };
    Object.assign(u, extra);
    this.units.push(u);
    return u;
  }
  freeNear(x, z, avoidProps = true) {
    for (let r = 0; r < 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const nx = x + dx, nz = z + dz;
      if (!this.map.inb(nx, nz) || this.map.blocked(nx, nz) || this.unitAt(nx, nz)) continue;
      return [nx, nz];
    }
    return [x, z];
  }
  // células internas livres de um prédio
  buildingCells(bid) {
    const b = this.map.buildings[bid]; const out = [];
    for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) if (this.map.building[this.map.idx(x, z)] === bid && this.map.struct[this.map.idx(x, z)] === 0 && !this.map.blocked(x, z) && !this.unitAt(x, z)) out.push([x, z]);
    return out;
  }
  spawnZombie(type, x, z, extra = {}) {
    const u = makeZombie(type, x, z, extra);
    this.units.push(u);
    if (this.S.units && this.phase !== 'none') this.S.units.add(u);
    return u;
  }
  spawnInitialZombies() {
    const k = this.diff.zombies;
    const byName = n => this.map.buildings.find(b => b.name.startsWith(n));
    const inB = (name, n, type = 'comum') => {
      const b = byName(name); if (!b) return;
      const cells = rng.shuffle(this.buildingCells(b.id));
      const cnt = Math.max(n > 0 ? 1 : 0, Math.round(n * k));
      for (let i = 0; i < cnt && cells.length; i++) { const [x, z] = cells.pop(); this.spawnZombie(type, x, z, { wander: 3 }); }
    };
    const near = (x, z, n, type = 'comum', spread = 3) => {
      const cnt = Math.max(1, Math.round(n * k));
      for (let i = 0; i < cnt; i++) {
        for (let t = 0; t < 12; t++) {
          const nx = x + rng.int(-spread, spread), nz = z + rng.int(-spread, spread);
          if (this.map.inb(nx, nz) && !this.map.blocked(nx, nz) && !this.unitAt(nx, nz) && this.map.floor[this.map.idx(nx, nz)] !== F.agua) { this.spawnZombie(type, nx, nz); break; }
        }
      }
    };
    inB('Escola', 6); inB('Supermercado', 6); inB('Supermercado', 1, 'resistente');
    inB('Casa Infestada', 5); inB('Casa Infestada', 1, 'furtivo');
    inB('Farmácia', 2); inB('Restaurante', 2); inB('Loja Moda', 2); inB('Eletrônica', 2);
    inB('Oficina', 2); inB('Estação', 2); inB('Rádio', 2); inB('Bar do Tião', 3); inB('Casa da Dra', 2); inB('Casa do Chefe', 2);
    inB('Galpão AgroNova', 4); inB('Galpão AgroNova', 1, 'furtivo'); inB('Depósito da Ferrovia', 2); inB('Mercadinho', 1);
    for (const [x, z] of this.map.marks.rua || []) near(x, z, rng.int(1, 3));
    near(114, 12, 3); near(114, 12, 1, 'corredor', 6);
    near(63, 80, 3); near(63, 80, 1, 'resistente', 5);
    near(114, 72, 3, 'comum', 6); near(114, 72, 1, 'resistente', 4);
    near(7, 80, 2); near(63, 46, 3, 'comum', 5); near(62, 4, 2);
    near(40, 25, 1, 'corredor', 4); near(90, 53, 1, 'corredor', 4); near(30, 73, 1, 'inchado', 3); near(95, 25, 1, 'inchado', 3);
    near(22, 60, 1, 'furtivo', 1);
    // chefe no laboratório
    const mz = this.map.marks.matriz;
    if (mz) { const [x, z] = mz[0]; const b = this.spawnZombie('matriz', x, z, { wander: 0 }); b.ai.home = [x, z]; b.ai.boss = true; }
    // o vizinho do prólogo, no jardim da frente da Casa da Turma
    const v = this.spawnZombie('comum', 4, 21, { look: 'z_comum_c', wander: 1 });
    v.name = 'Seu Lindomar (vizinho)'; v.ai.prologo = true;
  }

  // ------------------------------------------------------------ registro e mensagens
  log(msg, cls = '') {
    const line = { t: this.clock(), msg, cls };
    this.state.log.push(line);
    if (this.state.log.length > 120) this.state.log.shift();
    bus.emit('log', line);
  }
  toast(msg, cls = '') { bus.emit('toast', msg, cls); }
  say(u, text) { if (u && this.S.units) this.S.units.say(u, text); if (u) this.log(`<b>${u.name}:</b> ${text}`, 'fala'); }

  // ------------------------------------------------------------ seleção
  select(u) {
    if (!u || u.kind !== 'hero' || u.dead) return;
    for (const h of this.heroes) h.selected = false;
    u.selected = true;
    this.selected = u;
    this.S.focus(u.x + 0.5, u.z + 0.5);
    this.updateCutaway();
    bus.emit('select', u);
    bus.emit('hud');
  }
  selectNext(dir = 1) {
    const hs = this.liveHeroes.filter(h => !h.st.downed);
    if (!hs.length) return;
    const i = hs.indexOf(this.selected);
    this.select(hs[(i + dir + hs.length) % hs.length]);
  }

  // ------------------------------------------------------------ visão, luz e mapa escondido
  flashlightOn(h) {
    const l = h.eq.mao2;
    return l && l.id === 'lanterna' && (l.carga || 0) > 0 && h.flash && !h.dead;
  }
  lightLevel(x, z) {
    const m = this.map;
    if (!m.inb(x, z)) return 0;
    const i = m.idx(x, z);
    const day = 1 - this.S.env.night;
    let l = m.indoor(x, z) ? day * 0.8 : day;
    l = Math.max(l, m.lit[i]);
    for (const [fi] of m.fire) { const fx = fi % m.W, fz = (fi / m.W) | 0; const d = Math.hypot(fx - x, fz - z); if (d < 5) l = Math.max(l, 1 - d / 5); }
    for (const h of this.liveHeroes) {
      if (!this.flashlightOn(h) || h.st.downed) continue;
      const dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz);
      if (d < 0.5) { l = Math.max(l, 0.6); continue; }
      if (d > 9.5) continue;
      const cos = (dx * Math.sin(h.face) + dz * Math.cos(h.face)) / d;
      if (cos > 0.8) l = Math.max(l, 1 - d / 12);
    }
    return l;
  }
  updateVision() {
    const m = this.map;
    const vis = new Set();
    for (const h of this.units) {
      if (h.dead || h.gone) continue;
      if (!(h.kind === 'hero' || h.faction === 'ally')) continue;
      const R = h.kind === 'hero' ? visionRange(h) : 8;
      const cells = fov(m, h.x, h.z, R);
      const dark = 2.6 + (h.hasPerk && h.hasPerk('noturno') ? 2 : 0);
      for (const i of cells) {
        const x = i % m.W, z = (i / m.W) | 0;
        const d = Math.hypot(x - h.x, z - h.z);
        if (d <= dark || this.lightLevel(x, z) > 0.2) { vis.add(i); m.explored[i] = 1; }
      }
    }
    if (this.state.flags.mapa) for (let i = 0; i < m.explored.length; i++) if (m.struct[i] || m.floor[i] !== F.grama || m.building[i] >= 0) m.explored[i] = m.explored[i] || 1;
    this.visible = vis;
    this.S.fow.setVisible(vis, m.explored);
    // prédios vistos (telhados)
    const seenNow = new Set();
    for (const i of vis) { const b = m.building[i]; if (b >= 0) seenNow.add(b); }
    for (const e of this.S.world.buildings) {
      if (!e) continue;
      if (seenNow.has(e.b.id)) e.seen = 2;
      else if (e.seen === 2) e.seen = 1;
      else if (!e.seen) { const bb = e.b; if (m.explored[m.idx(bb.x0, bb.z0)] || m.explored[m.idx(bb.x1, bb.z1)]) e.seen = 1; }
    }
    this.updateCutaway();
  }
  unitVisible(u) {
    if (u.kind === 'hero') return true;
    if (u.gone) return false;
    const i = this.map.idx(u.x, u.z);
    if (!this.visible.has(i)) return false;
    if (u.kind === 'zombie' && u.st.hidden && !u.dead) {
      // espreitador: só aparece de perto ou na luz forte
      const near = this.liveHeroes.some(h => Math.max(Math.abs(h.x - u.x), Math.abs(h.z - u.z)) <= 2);
      if (!near && this.lightLevel(u.x, u.z) < 0.6) return false;
    }
    return true;
  }
  seenEnemies() { return this.units.filter(u => u.alive && this.hostile(u) && this.unitVisible(u)); }
  hostile(u) { return u.faction === 'zombie' || u.faction === 'hostile'; }
  unitVisibleTo(a, b) { return Math.hypot(a.x - b.x, a.z - b.z) < 10 && los(this.map, a.x, a.z, b.x, b.z); }
  updateCutaway() {
    if (!this.S.world) return;
    const inside = new Set();
    for (const h of this.liveHeroes) { const b = this.map.buildingAt(h.x, h.z); if (b) inside.add(b.id); }
    const sel = this.selected ? this.map.buildingAt(this.selected.x, this.selected.z) : null;
    for (const e of this.S.world.buildings) {
      if (!e) continue;
      const cut = this.cutAll || (sel && sel.id === e.b.id) || (this.hoverBuilding === e.b.id);
      e.cutTarget = cut ? 1 : 0;
      e.roofTarget = inside.has(e.b.id) || cut ? 0 : 1;
    }
  }
  refreshLights() {
    this.lightSources = [...this.map.lights.filter(l => !l.off)];
    for (const [fi] of this.map.fire) this.lightSources.push({ x: fi % this.map.W + 0.5, z: ((fi / this.map.W) | 0) + 0.5, kind: 'fogo', r: 6, i: 1.2, color: '#ff8a2a' });
  }
  frameUpdate(dt) {
    // luzes dinâmicas perto da câmera e lanternas
    const flashes = this.liveHeroes.filter(h => this.flashlightOn(h) && !h.st.downed).map(h => ({ x: h.x, z: h.z, dirX: Math.sin(h.face), dirZ: Math.cos(h.face) }));
    this.S.setLights(this.lightSources || [], flashes, this.S.target.x, this.S.target.z);
  }

  // ------------------------------------------------------------ ruído
  // barulho em (x,z) com raio r: zumbis que ouvem vão investigar
  noise(x, z, r, src = null) {
    if (r <= 0) return;
    for (const u of this.units) {
      if (u.dead || u.gone || u.kind !== 'zombie') continue;
      const Z = ZOMBIES[u.type];
      const d = Math.hypot(u.x - x, u.z - z);
      let rr = r * (Z.audicao || 1);
      if (this.map.indoor(u.x, u.z) !== this.map.indoor(x, z)) rr *= 0.7;
      if (d <= rr) {
        u.ai.noise = { x, z, turn: this.state.turn };
        if (u.ai.state === 'idle' || u.ai.state === 'wander') u.ai.state = 'investigate';
        if (u.st.hidden && ZOMBIES[u.type].furtivo && d < 4) u.ai.state = 'investigate';
      }
    }
    // humanos neutros se assustam com tiros
    if (r >= 12) for (const u of this.units) if (u.kind === 'npc' && u.alive && Math.hypot(u.x - x, u.z - z) < r * 0.6) u.ai.alert = 2;
  }

  // ------------------------------------------------------------ modo (exploração x combate)
  updateMode() {
    let threat = false;
    for (const u of this.units) {
      if (!u.alive || !this.hostile(u)) continue;
      let dmin = 99;
      for (const h of this.liveHeroes) dmin = Math.min(dmin, Math.hypot(h.x - u.x, h.z - u.z));
      if (u.faction === 'hostile' && dmin < 14 && this.unitVisible(u)) threat = true;
      if (u.kind === 'zombie' && ((u.ai.state === 'hunt' && dmin < 16) || (this.unitVisible(u) && dmin < 10))) threat = true;
      if (threat) break;
    }
    const mode = threat ? 'combat' : 'explore';
    if (mode !== this.state.mode) {
      this.state.mode = mode;
      if (mode === 'combat') { this.log('⚔️ Perigo por perto! Modo de combate: cada turno vale 1 minuto.', 'alerta'); bus.emit('music', 'combat'); }
      else { this.log('🌿 A área parece calma. Modo de exploração.', 'info'); bus.emit('music', 'explore'); }
      bus.emit('mode', mode);
    }
    return mode;
  }

  // ------------------------------------------------------------ turnos
  async endTurn() {
    if (this.phase !== 'player' || this.busy) return;
    this.phase = 'ai';
    bus.emit('hud');
    for (const h of this.liveHeroes) {
      if (h.st.downed) continue;
      // descanso com PA sobrando
      if (h.ap > 0) h.need.energia = Math.min(100, h.need.energia + h.ap * 0.25);
    }
    try { await runAI(this); } catch (e) { console.error(e); }
    await this.advanceTime();
    this.startPlayerTurn();
  }
  startPlayerTurn() {
    this.state.turn++;
    this.state.stats.turnos++;
    for (const h of this.liveHeroes) {
      h.st.defend = false; h.st.aim = 0; h.st.ran = false; h.st.surto = false; h.st.protetor = false; h.st.cmdUsed = false; h.st.stoneStun = false;
      for (const k of Object.keys(h.cd)) if (h.cd[k] > 0) h.cd[k]--;
      if (h.st.downed) {
        h.st.downed--;
        if (h.st.downed <= 0) this.heroDies(h);
        continue;
      }
      h.ap = turnAp(h) + (h.st.bonusAp || 0);
      h.st.bonusAp = 0;
      if (h.st.stun) h.st.stun--;
      if (h.st.panic) h.st.panic--;
    }
    if (!this.liveHeroes.some(h => !h.st.downed)) { this.gameOver(); return; }
    if (!this.selected || this.selected.dead || this.selected.st.downed) this.select(this.liveHeroes.find(h => !h.st.downed));
    this.phase = 'player';
    this.updateVision();
    this.updateMode();
    Story.onTurn(this);
    bus.emit('hud');
    bus.emit('turn');
  }
  async advanceTime() {
    const minutes = this.state.mode === 'combat' ? 1 : 5;
    const before = this.state.time;
    this.state.time += minutes;
    const h0 = Math.floor(before / 60), h1 = Math.floor(this.state.time / 60);
    this.S.setTime(this.state.time, this.state.weather);
    tickSurvival(this, minutes);
    if (Math.floor(before / 1440) !== Math.floor(this.state.time / 1440)) {
      this.log(`☀️ Começa o dia ${this.day()} em Aimorés.`, 'info');
      this.toast(`Dia ${this.day()}`);
    }
    if (h0 !== h1) {
      const hh = h1 % 24;
      if (hh === 18) { this.log('🌆 O sol está se pondo. À noite há mais zumbis e eles ficam mais agressivos.', 'alerta'); this.toast('Anoitecendo'); }
      if (hh === 6) this.log('🌅 Amanheceu. Os zumbis ficam mais lentos com o calor.', 'info');
      this.hourlySpawn(hh);
    }
    await Story.onTime(this, minutes);
    // luzes de fogo mudam
    this.refreshLights();
    bus.emit('hud');
  }
  hourlySpawn(hh) {
    const night = hh >= 19 || hh < 5;
    const alive = this.units.filter(u => u.kind === 'zombie' && u.alive).length;
    const cap = Math.round((night ? 110 : 85) * this.diff.zombies);
    if (alive >= cap) return;
    const n = Math.round((night ? rng.int(3, 5) : rng.int(0, 2)) * this.diff.spawn);
    for (let i = 0; i < n; i++) {
      // nas bordas ou em lugares escuros, longe do grupo
      for (let t = 0; t < 20; t++) {
        const edge = rng.int(0, 3);
        let x = edge === 0 ? rng.int(1, 5) : edge === 1 ? rng.int(this.map.W - 6, this.map.W - 2) : rng.int(1, this.map.W - 2);
        let z = edge === 2 ? rng.int(1, 5) : edge === 3 ? rng.int(84, 90) : rng.int(1, 86);
        if (this.map.blocked(x, z) || this.unitAt(x, z) || this.map.floor[this.map.idx(x, z)] === F.agua) continue;
        if (this.liveHeroes.some(h => Math.hypot(h.x - x, h.z - z) < 14)) continue;
        const type = rng.weighted([['comum', 10], ['corredor', night ? 3 : 1], ['resistente', 1], ['furtivo', night ? 2 : 0.5], ['inchado', 0.7]]);
        const z0 = this.spawnZombie(type, x, z);
        // à noite vêm em direção à cidade
        if (night) { z0.ai.state = 'investigate'; z0.ai.noise = { x: rng.int(20, 100), z: rng.int(20, 70), turn: this.state.turn }; }
        break;
      }
    }
  }

  // ------------------------------------------------------------ dano, morte e experiência
  damage(target, amount, src, opts = {}) {
    if (target.dead) return;
    target.hp -= amount;
    const view = this.S.units;
    view.flash(target, opts.crit ? '#ffe040' : '#ffffff');
    view.floatText(target.x, target.z, (opts.crit ? '💥' : '') + '-' + amount, opts.crit ? 'crit' : target.kind === 'hero' ? 'dmg-hero' : 'dmg');
    if (target.kind !== 'hero') view.setHp(target, true);
    if (!opts.noBlood) { view.blood(target.x, target.z, amount > 12 ? 1.2 : 0.8); view.splash(target.x + 0.5, 1.0, target.z + 0.5, target.kind === 'zombie' ? '#6a1010' : '#b01818', 8); }
    if (target.st.hidden && !opts.keepHidden) target.st.hidden = false;
    if (target.kind === 'npc' && src && src.kind === 'hero' && target.faction !== 'hostile') this.provoke(target, src);
    if (target.hp <= 0) {
      if (target.kind === 'hero') {
        if (!target.st.downed) {
          target.hp = 0; target.st.downed = 3; target.ap = 0;
          view.play(target, 'die').then(() => {});
          this.log(`💀 <b>${target.name}</b> caiu! Leve atadura ou kit médico até ${target.name} em até 3 turnos.`, 'perigo');
          this.toast(`${target.name} caiu!`, 'perigo');
          Story.onHeroDown(this, target);
          if (this.selected === target) this.selectNext();
        } else this.heroDies(target);
      } else this.kill(target, src, opts);
    } else if (target.kind !== 'hero' || !target.st.downed) {
      view.play(target, 'hurt');
      if (target.kind === 'hero') bus.emit('hurt', target);
    }
    bus.emit('hud');
  }
  kill(u, src, opts = {}) {
    u.dead = true; u.hp = 0;
    this.S.units.play(u, 'die');
    this.S.units.setHp(u, false);
    if (u.kind === 'zombie') {
      const Z = ZOMBIES[u.type];
      this.state.stats.kills++;
      if (src && src.kind === 'hero') {
        src.kills++;
        this.gainXp(src, Z.xp);
        for (const h of this.liveHeroes) if (h !== src) this.gainXp(h, Math.round(Z.xp * 0.25), true);
      }
      if (Z.explode) this.gasCloud(u.x, u.z);
      if (u.ai.boss) Story.onBossDead(this, u);
      if (u.type === 'pamonheiro') Story.flag(this, 'pamonheiro_morto', true);
      if (rng.next() < 0.18) this.map.addPile(u.x, u.z, rng.pick(['pedrinhas', 'pano', 'pilhas', 'biscoito', 'garrafa']), 1);
    } else if (u.kind === 'npc') {
      this.log(`☠️ ${u.name} morreu.`, 'perigo');
      Story.onNpcDead(this, u, src);
      // larga o que tinha
      if (u.eq.mao) this.map.addPile(u.x, u.z, u.eq.mao.id, 1);
      if (NPCS[u.npc]?.loja) for (const [id, n] of NPCS[u.npc].loja.itens.slice(0, 3)) this.map.addPile(u.x, u.z, id, Math.ceil(n / 2));
      if (src && src.kind === 'hero') this.gainXp(src, 25);
    }
    Story.onKill(this, u, src);
  }
  heroDies(h) {
    h.dead = true; h.st.downed = 0; h.hp = 0;
    this.S.units.loop(h, 'dead');
    this.log(`⚰️ <b>${h.name}</b> não resistiu. O grupo nunca mais será o mesmo.`, 'perigo');
    this.toast(`${h.name} morreu`, 'perigo');
    for (const o of this.liveHeroes) o.need.moral = Math.max(0, o.need.moral - 35);
    // os itens ficam no chão
    for (const e of h.inv) this.map.addPile(h.x, h.z, e.id, e.n);
    for (const k of Object.keys(h.eq)) if (h.eq[k]) this.map.addPile(h.x, h.z, h.eq[k].id, 1);
    h.inv = []; for (const k of Object.keys(h.eq)) h.eq[k] = null;
    Story.onHeroDead(this, h);
    if (!this.liveHeroes.length) this.gameOver();
    else if (this.selected === h) this.selectNext();
  }
  gameOver() {
    this.phase = 'over';
    bus.emit('gameover');
  }
  provoke(npc, hero) {
    if (npc.faction === 'hostile') return;
    const group = npc.npc === 'tonhao' || npc.npc === 'lobo' ? this.units.filter(u => u.npc === 'tonhao' || u.npc === 'lobo') : [npc];
    for (const u of group) { if (u.alive) { u.faction = 'hostile'; u.ai.state = 'hunt'; u.ai.target = hero.uid; this.S.units.setHp(u, true); } }
    this.log(`😡 ${npc.name} agora é hostil ao grupo!`, 'perigo');
    Story.onProvoke(this, npc);
  }
  gasCloud(x, z) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (this.map.inb(x + dx, z + dz)) this.map.gas.set(this.map.idx(x + dx, z + dz), 3);
    this.S.units.burst(x, z, '#a8ff40', 3.5);
    this.log('🤢 O Zumbi Inchado explodiu numa nuvem de gás tóxico!', 'alerta');
    for (const u of this.units) if (u.alive && Math.abs(u.x - x) <= 1 && Math.abs(u.z - z) <= 1 && u.kind !== 'zombie') {
      this.damage(u, rng.int(5, 9), null);
      if (u.kind === 'hero') { u.need.infeccao = Math.min(100, u.need.infeccao + 8); u.st.infected = true; }
    }
  }
  gainXp(h, n, quiet = false) {
    if (!h || h.kind !== 'hero' || h.dead) return;
    const intBonus = 1 + (h.stats.inteligencia - 5) * 0.03;
    const dai = this.heroes.find(x => x.id === 'daiana' && !x.dead);
    const bonus = dai && dai.skill('plano_de_aula') >= 3 ? 1.1 : 1;
    n = Math.round(n * intBonus * bonus);
    h.xp += n;
    if (!quiet) this.S.units.floatText(h.x, h.z, `+${n} XP`, 'xp');
    while (h.lvl < XP_LEVELS.length && h.xp >= XP_LEVELS[h.lvl]) {
      h.lvl++;
      h.pts += 1; h.spts += 1;
      if (h.lvl % 2 === 0) h.perkPts += 1;
      recompute(h);
      h.hp = Math.min(h.maxHp, h.hp + 10);
      this.log(`⭐ <b>${h.name}</b> subiu para o nível ${h.lvl}! Abra a ficha (C) para distribuir pontos.`, 'bom');
      this.toast(`${h.name}: nível ${h.lvl}!`, 'bom');
      this.S.units.play(h, 'celebrate');
      bus.emit('levelup', h);
    }
    bus.emit('hud');
  }

  // ------------------------------------------------------------ caminhos
  pathTo(u, x, z, opts = {}) {
    return findPath(this.map, u.x, u.z, x, z, { occupied: this.occupied, allowDoors: u.kind === 'hero', ...opts });
  }
  reach(u, budget) {
    return reachable(this.map, u.x, u.z, budget, { occupied: this.occupied, allowDoors: true });
  }

  // ------------------------------------------------------------ salvar e carregar
  serialize() {
    const m = this.map;
    const doors = [...m.doors].map(([i, d]) => [i, d.open ? 1 : 0, d.locked ? 1 : 0, d.hp, d.barricade, d.key || null]);
    const wins = [...m.windows].map(([i, w]) => [i, w.broken ? 1 : 0, w.barricade]);
    const props = m.props.map(p => [p.searched ? 1 : 0, p.loot || [], p.removed ? 1 : 0, p.extra || null, p.locked ? 1 : 0]);
    const explored = btoa(String.fromCharCode(...compressBits(m.explored)));
    const units = this.units.map(u => {
      const o = {};
      for (const k of Object.keys(u)) if (!['selected'].includes(k)) o[k] = u[k];
      return o;
    });
    return {
      v: 1, state: this.state, units, uidNext: peekUid(), rng: rng.state(),
      map: { doors, wins, props, explored, piles: [...m.piles], fire: [...m.fire], gas: [...m.gas], lightsOff: m.lights.map(l => l.off ? 1 : 0), extraProps: m.props.filter(p => p.added).map(p => ({ type: p.type, x: p.x, z: p.z, w: p.w, d: p.d, rot: p.rot })) },
      selected: this.selected ? this.selected.uid : null,
    };
  }
  load(data) {
    this.state = data.state;
    this.map = generateMap(this.state.seed);
    const m = this.map;
    for (const [i, open, locked, hp, bar, key] of data.map.doors) { const d = m.doors.get(i); if (d) { d.open = !!open; d.locked = !!locked; d.hp = hp; d.barricade = bar; d.key = key; } }
    for (const [i, broken, bar] of data.map.wins) { const w = m.windows.get(i); if (w) { w.broken = !!broken; w.barricade = bar; } }
    for (const ep of data.map.extraProps || []) { const p = m.addProp(ep.type, ep.x, ep.z, ep.w, ep.d, ep.rot); p.added = true; }
    data.map.props.forEach(([searched, loot, removed, extra, locked], i) => { const p = m.props[i]; if (!p) return; p.searched = !!searched; p.loot = loot; p.locked = !!locked; if (extra) p.extra = extra; if (removed) m.removeProp(p); });
    const bits = Uint8Array.from(atob(data.map.explored), c => c.charCodeAt(0));
    decompressBits(bits, m.explored);
    m.piles = new Map(data.map.piles);
    m.fire = new Map(data.map.fire);
    m.gas = new Map(data.map.gas || []);
    (data.map.lightsOff || []).forEach((o, i) => { if (m.lights[i]) m.lights[i].off = !!o; });
    resetUid(1);
    this.units = data.units.map(o => { const u = new Unit(o); Object.assign(u, o); return u; });
    resetUid(data.uidNext);
    rng.setState(data.rng);
    this.afterLoad();
    const sel = this.units.find(u => u.uid === data.selected);
    if (sel && !sel.dead) this.select(sel);
    this.updateMode();
    bus.emit('hud');
  }
}

function compressBits(arr) {
  const out = new Uint8Array(Math.ceil(arr.length / 8));
  for (let i = 0; i < arr.length; i++) if (arr[i]) out[i >> 3] |= 1 << (i & 7);
  return out;
}
function decompressBits(bits, arr) { for (let i = 0; i < arr.length; i++) arr[i] = (bits[i >> 3] >> (i & 7)) & 1; }
