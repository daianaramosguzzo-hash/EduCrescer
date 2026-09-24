// Ações do jogador. Cada ação custa Pontos de Ação (PA).
// O menu de contexto (optionsAt) lista o que dá para fazer numa célula, com o custo.
import { ITEMS } from '../data/items.js';
import { PROPS, S, F } from '../world/tiles.js';
import { NPCS } from '../data/npcs.js';
import { ZOMBIES } from '../data/zombies.js';
import { SKILLS } from '../data/heroes.js';
import { addItem, removeItem, countItem, newItem, stackable, carried, capacity, effStat, recompute } from './units.js';
import { hitChance, rollDamage, inRange, cheb, dist, unaware } from './combat.js';
import { los, computeStaticLight } from './vision.js';
import { findPath, pathCost } from './path.js';
import { rng, bus, clamp, wait } from '../util.js';
import * as Story from './story.js';

const ADJ = (a, x, z) => Math.max(Math.abs(a.x - x), Math.abs(a.z - z)) <= 1;

export const RECIPES = [
  { id: 'marmita', nome: 'Marmita de arroz e feijão', precisa: [['arroz', 1], ['feijao', 1], ['agua', 1]], da: ['marmita', 2], fogao: true, pa: 3 },
  { id: 'macarrao', nome: 'Macarrão cozido', precisa: [['miojo', 2], ['agua', 1]], da: ['macarronada', 1], fogao: true, pa: 2 },
  { id: 'molotov', nome: 'Coquetel molotov', precisa: [['garrafa', 1], ['pano', 1], ['combustivel|cachaca|alcool', 1]], da: ['molotov', 1], pa: 2 },
  { id: 'taco_pregos', nome: 'Taco com pregos', precisa: [['taco', 1], ['pregos', 1]], da: ['taco_pregos', 1], pa: 2 },
  { id: 'armadura', nome: 'Armadura de revista', precisa: [['revistas', 2], ['fita', 1]], da: ['armadura_revista', 1], pa: 2 },
  { id: 'atadura', nome: 'Atadura improvisada', precisa: [['pano', 1], ['alcool|cachaca', 1]], da: ['atadura', 2], pa: 1 },
  { id: 'reparo', nome: 'Consertar arma branca (silver tape)', precisa: [['fita', 1]], repara: true, pa: 1 },
];

export function installActions(Game) {
  Object.assign(Game.prototype, {
    // ------------------------------------------------------------ utilidades
    can(u, cost, quiet = false) {
      const why = !u || u.dead ? 'Ninguém selecionado.' : this.phase !== 'player' ? 'Aguarde o turno dos inimigos.' : this.busy ? 'Aguarde...' :
        u.st.downed ? `${u.name} está no chão.` : u.st.stun ? `${u.name} está sem reação.` : u.ap < cost ? `PA insuficientes (precisa de ${cost}).` : null;
      if (why && !quiet) this.toast(why, 'erro');
      return !why;
    },
    async act(fn) {
      this.busy++;
      bus.emit('hud');
      try { return await fn(); }
      catch (e) { console.error(e); }
      finally {
        this.busy--;
        this.updateVision();
        this.updateMode();
        bus.emit('hud');
      }
    },
    spend(u, n) { u.ap = Math.max(0, u.ap - n); },
    view() { return this.S.units; },

    // ------------------------------------------------------------ movimento
    moveCost(u, path, run) {
      let c = 0;
      path.forEach(([x, z], k) => {
        const i = this.map.idx(x, z);
        const d = this.map.doors.get(i);
        if (d && !d.open) c += 1;
        if (this.map.windows.get(i)) c += 1;
        c += run ? (k % 3 === 2 ? 0 : 1) : 1;
      });
      return c;
    },
    async moveAlong(u, path, run, opts = {}) {
      const map = this.map, view = this.view();
      const seenBefore = new Set(this.seenEnemies().map(e => e.uid));
      let k = 0, moved = 0;
      for (const [x, z] of path) {
        const i = map.idx(x, z);
        const d = map.doors.get(i);
        if (d && !d.open) {
          if (d.locked || d.barricade) { this.toast('Porta trancada ou barricada.', 'erro'); break; }
          if (u.ap < 1) break;
          await this.openDoorRaw(u, d); this.spend(u, 1);
        }
        let cost = run ? (k % 3 === 2 ? 0 : 1) : 1;
        const win = map.windows.get(i);
        if (win) cost += 1;
        const other = this.unitAt(x, z);
        if (u.ap < cost || (other && other !== u && !(u.kind === 'hero' && this.passFriend(x, z)))) break;
        // atravessar um aliado só se der para sair da casa dele em seguida
        if (other && other !== u) {
          let j = moved + 1, need = cost + 1;
          while (j < path.length && this.unitAt(path[j][0], path[j][1])) { j++; need++; }
          if (j >= path.length || u.ap < need) break;
        }
        this.spend(u, cost); k++; moved++;
        if (!opts.sneak) u.st.hidden = false;
        u.face = Math.atan2(x - u.x, z - u.z);
        u.x = x; u.z = z;
        if (run) { u.st.ran = true; u.need.energia = Math.max(0, u.need.energia - 0.35); }
        await view.moveTo(u, x, z, (run ? 6.2 : 3.8) * (this.speed || 1), run ? 'run' : win ? 'vehicleOut' : 'walk');
        if (win && rng.next() < 0.2 && u.kind === 'hero') { u.st.bleed = 1; this.log(`${u.name} se cortou no vidro da janela.`, 'alerta'); }
        this.noise(x, z, run ? (u.hasPerk('pe_leve') ? 2 : 5) : (u.id === 'pablicio' ? 2.2 : 1.3), u);
        this.updateVision();
        if (u === this.selected) this.S.focus(x + 0.5, z + 0.5);
        await Story.onEnter(this, u, x, z);
        await this.checkTrap(u, x, z);
        if (u.dead || u.st.downed) break;
        const novos = this.seenEnemies().filter(e => !seenBefore.has(e.uid));
        const sharing = this.units.some(o => o !== u && !o.dead && !o.gone && o.x === u.x && o.z === u.z);
        if (novos.length && !opts.ignoreEnemies && !sharing) {
          const e = novos[0];
          this.say(u, rng.pick(['Opa! Zumbi!', 'Tem coisa ali!', 'Parados! Tem um ali.', 'Xiii...']).replace('Zumbi', e.kind === 'zombie' ? 'Zumbi' : 'alguém'));
          this.updateMode();
          return { moved, interrupted: true };
        }
      }
      return { moved, interrupted: false };
    },
    // andar até uma célula (no modo exploração, atravessa vários turnos)
    async walkTo(u, tx, tz, opts = {}) {
      if (!this.can(u, 1)) return;
      const run = opts.run ?? this.input.run;
      let guardTurns = 14;
      await this.act(async () => {
        for (;;) {
          const path = this.pathTo(u, tx, tz, { goalAdjacent: !!opts.adjacent });
          if (!path) { this.toast('Não dá para chegar lá.', 'erro'); return; }
          if (!path.length) return;
          const r = await this.moveAlong(u, path, run, opts);
          if (this.state.mode === 'explore' && opts.follow !== false) await this.followLeader(u);
          const arrived = opts.adjacent ? ADJ(u, tx, tz) : (u.x === tx && u.z === tz);
          if (arrived || r.interrupted || u.dead || u.st.downed) return;
          if (this.state.mode !== 'explore' || !opts.travel || guardTurns-- <= 0) return;
          if (u.ap >= 1 && r.moved > 0) continue;
          // viagem: passa o turno automaticamente enquanto está tudo calmo
          this.busy--;
          await this.endTurn();
          this.busy++;
          if (this.state.mode !== 'explore' || this.phase !== 'player') return;
        }
      });
    },
    async followLeader(leader) {
      const others = this.liveHeroes.filter(h => h !== leader && !h.st.downed && !h.st.stun && h.ap > 0 && !h.st.stay);
      const tasks = others.map(async h => {
        if (cheb(h, leader) <= 2) return;
        const path = this.pathTo(h, leader.x, leader.z, { goalAdjacent: true });
        if (!path || !path.length) return;
        await this.moveAlong(h, path, false, { ignoreEnemies: true });
      });
      await Promise.all(tasks);
    },
    async checkTrap(u, x, z) {
      const t = this.state.traps && this.state.traps[x + ',' + z];
      if (!t) return;
      delete this.state.traps[x + ',' + z];
      this.view().burst(x, z, '#ffffff', 2);
      if (t === 'lata') { this.noise(x, z, 12, u); this.log(`🥫 ${u.name} tropeçou num varal de latas! Barulhão!`, 'alerta'); this.say(u, 'Quem pendura lata no corredor?!'); }
      else if (t === 'urso') { this.damage(u, rng.int(10, 15), null); u.st.stun = 1; u.st.bleed = 1; this.log(`🪤 ${u.name} pisou numa armadilha de urso! Quem tem armadilha de urso em Aimorés?!`, 'perigo'); }
    },

    // ------------------------------------------------------------ combate
    weaponInfo(u, target) {
      const w = u.weaponStats();
      const ch = target ? hitChance(this, u, target, w) : 0;
      const range = target ? inRange(this, u, target, w) : false;
      return { w, ch, range };
    },
    async attack(u, t) {
      let w = u.weaponStats();
      const it = u.weapon();
      if (w.tipo === 'arremesso') return this.throwAt(u, t.x, t.z);
      if (w.tipo === 'distancia' && w.pente > 0 && w.classe !== 'sling' && (u.eq.mao.loaded || 0) <= 0) {
        if (countItem(u, w.municao) > 0) { this.toast('Sem munição carregada. Recarregue (R).', 'erro'); }
        else this.toast('Sem munição!', 'erro');
        return;
      }
      if (w.tipo === 'distancia' && w.municao && w.pente === 1 && countItem(u, w.municao) <= 0) { this.toast('Sem pedrinhas para o estilingue.', 'erro'); return; }
      if (w.tipo === 'distancia' && w.pente === 0 && it && it.id === 'chinelo') { /* chinelo volta sozinho */ }
      // aproxima para corpo a corpo
      if (w.tipo === 'corpo' && !ADJ(u, t.x, t.z)) {
        const path = this.pathTo(u, t.x, t.z, { goalAdjacent: true });
        if (!path) { this.toast('Não dá para chegar perto.', 'erro'); return; }
        const cost = this.moveCost(u, path, this.input.run);
        if (u.ap < cost + (w.pa || 2)) {
          // sem PA para chegar e bater: anda o que der e ataca no próximo turno
          if (!this.can(u, 1)) return;
          this.toast(`Longe demais para atacar neste turno (andar ${cost} + atacar ${w.pa} PA). Chegando mais perto...`);
        }
        await this.act(() => this.moveAlong(u, path, this.input.run, { ignoreEnemies: true }));
        if (!ADJ(u, t.x, t.z) || u.ap < (w.pa || 2)) return;
      }
      const cost = w.pa || 2;
      if (!this.can(u, cost)) return;
      if (!inRange(this, u, t, w)) { this.toast(w.tipo === 'corpo' ? 'Longe demais.' : 'Fora de alcance ou sem linha de visão.', 'erro'); return; }
      await this.act(async () => {
        this.spend(u, cost);
        const view = this.view();
        u.face = Math.atan2(t.x - u.x, t.z - u.z);
        const ch = hitChance(this, u, t, w);
        const sneak = w.tipo === 'corpo' && unaware(u, t);
        const anim = w.tipo === 'corpo' ? 'attack' : 'shoot';
        const p = view.play(u, anim);
        if (w.tipo === 'distancia') {
          if (w.classe === 'sling') {
            if (it.id === 'estilingue') removeItem(u, 'pedrinhas', 1);
            await wait(120); await view.projectile(u.x, u.z, t.x, t.z, it.id === 'chinelo' ? '#c93b33' : '#9a9a9a', 0.4, 0.25);
          } else { u.eq.mao.loaded--; await wait(90); view.tracer(u.x, u.z, t.x, t.z); view.burst(u.x, u.z, '#ffd23a', 1.2); this.S.shake = 0.12; }
        } else await wait(170);
        this.noise(u.x, u.z, w.ruido || 2, u);
        const hit = rng.next() * 100 < ch;
        if (hit) {
          const r = rollDamage(this, u, t, w, { aimed: u.st.aim > 0 });
          if (r.sneak) { this.log(`🗡️ Ataque surpresa de <b>${u.name}</b>!`, 'bom'); view.floatText(t.x, t.z, 'SURPRESA!', 'crit'); }
          this.damage(t, r.dmg, u, r);
          if (t.alive && w.atordoar && (rng.next() < w.atordoar || (w.classe === 'sling' && u.skill('estilingada') >= 2 && !u.st.stoneStun))) { t.st.stun = 1; u.st.stoneStun = true; view.floatText(t.x, t.z, 'Atordoado!', 'miss'); }
          if (t.alive && w.sangrar && rng.next() < w.sangrar && t.kind !== 'hero') t.st.bleedz = 2;
          if (t.alive && w.empurrar) { const dx = Math.sign(t.x - u.x), dz = Math.sign(t.z - u.z); const nx = t.x + dx, nz = t.z + dz; if (!this.map.blocked(nx, nz) && !this.unitAt(nx, nz)) { t.x = nx; t.z = nz; view.moveTo(t, nx, nz, 7, 'hurt'); } }
          if (t.alive && w.assusta && t.kind === 'npc') { t.st.stun = 2; view.say(t, 'Ai! O chinelo não!'); }
          if (w.espalhar) for (const o of this.units) if (o !== t && o.alive && o !== u && cheb(o, t) <= 1 && rng.next() < 0.5) { this.damage(o, Math.round(r.dmg * 0.5), u); }
          if (!t.alive) this.log(`✅ <b>${u.name}</b> derrubou ${t.name}.`, 'bom');
          else this.log(`<b>${u.name}</b> acertou ${t.name} (${r.dmg}${r.crit ? ', crítico' : ''}).`, '');
        } else {
          view.floatText(t.x, t.z, 'Errou!', 'miss');
          this.log(`${u.name} errou ${t.name}.`, '');
          if (t.kind === 'zombie' && t.alive) { t.ai.state = 'hunt'; t.ai.target = u.uid; t.ai.last = [u.x, u.z]; }
        }
        if (t.kind === 'zombie' && t.alive && hit) { t.ai.state = 'hunt'; t.ai.target = u.uid; t.ai.last = [u.x, u.z]; }
        // durabilidade
        if (u.eq.mao && u.eq.mao.dur !== undefined && w.tipo === 'corpo') {
          u.eq.mao.dur -= u.skill('mao_na_graxa') >= 2 ? 0.5 : 1;
          if (u.eq.mao.dur <= 0) { this.log(`💔 ${ITEMS[u.eq.mao.id].nome} de ${u.name} quebrou!`, 'alerta'); this.toast(`${ITEMS[u.eq.mao.id].nome} quebrou!`, 'erro'); u.eq.mao = null; }
        }
        u.st.aim = 0; u.st.hidden = false;
        await p;
      });
    },
    async reload(u) {
      const it = u.weapon();
      if (!it || !it.w || it.w.tipo !== 'distancia' || !it.w.pente || it.w.pente <= 1) { this.toast('Essa arma não precisa recarregar.', 'erro'); return; }
      const e = u.eq.mao;
      const need = it.w.pente - (e.loaded || 0);
      const have = countItem(u, it.w.municao);
      if (need <= 0) { this.toast('Já está carregada.'); return; }
      if (have <= 0) { this.toast('Sem munição no inventário.', 'erro'); return; }
      const cost = it.w.recarga || 2;
      if (!this.can(u, cost)) return;
      await this.act(async () => {
        this.spend(u, cost);
        const n = Math.min(need, have);
        removeItem(u, it.w.municao, n);
        e.loaded = (e.loaded || 0) + n;
        this.log(`🔄 ${u.name} recarregou (${e.loaded}/${it.w.pente}).`, '');
        await this.view().play(u, 'interact');
      });
    },
    async aim(u) {
      if (!this.can(u, 1)) return;
      if ((u.st.aim || 0) >= 2) { this.toast('Já está mirando o máximo.'); return; }
      await this.act(async () => { this.spend(u, 1); u.st.aim = (u.st.aim || 0) + 1; this.view().loop(u, 'aim'); this.view().floatText(u.x, u.z, `Mirando +${u.st.aim * 15}%`, 'info'); });
    },
    async defend(u) {
      if (!this.can(u, 1)) return;
      await this.act(async () => { u.ap = 0; u.st.defend = true; this.view().floatText(u.x, u.z, '🛡️ Defendendo', 'info'); this.log(`${u.name} assumiu posição de defesa (−50% de dano até o próximo turno).`, ''); });
    },
    async hide(u, free = false) {
      const cost = free ? 1 : 2;
      if (!this.can(u, cost)) return;
      const watchers = this.units.filter(z => z.alive && z.kind === 'zombie' && z.ai.state === 'hunt' && z.ai.target === u.uid && cheb(z, u) <= 6 && los(this.map, z.x, z.z, u.x, u.z));
      const adjacent = this.units.some(z => z.alive && this.hostile(z) && cheb(z, u) <= 1);
      if (adjacent) { this.toast('Impossível se esconder com inimigo colado!', 'erro'); return; }
      const spot = this.hideSpotNear(u);
      if (watchers.length && !free && !spot) { this.toast('Estão te vendo! Procure um esconderijo (arbusto, guarda-roupa, carro...).', 'erro'); return; }
      await this.act(async () => {
        this.spend(u, cost);
        u.st.hidden = true;
        for (const z of watchers) if (spot || free) { z.ai.state = 'investigate'; z.ai.target = null; z.ai.noise = { x: u.x, z: u.z, turn: this.state.turn }; }
        this.view().loop(u, 'crouch');
        this.view().floatText(u.x, u.z, spot ? `Escondido (${spot})` : 'Escondido', 'info');
      });
    },
    hideSpotNear(u) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const p = this.map.prop(u.x + dx, u.z + dz);
        if (p && PROPS[p.type].hide) return p.nome.toLowerCase();
      }
      if (this.lightLevel(u.x, u.z) < 0.2) return 'no escuro';
      return null;
    },

    // ------------------------------------------------------------ portas e janelas
    async openDoorRaw(u, d) {
      d.open = true;
      this.map.version++;
      this.S.world.refreshDoor(this.map.idx(d.x, d.z));
      bus.emit('sfx', d.gate ? 'gate' : 'door_open', d.x, d.z);
      u.face = Math.atan2(d.x - u.x, d.z - u.z);
      this.noise(d.x, d.z, d.gate ? 3 : 2, u);
      await this.view().play(u, 'interact');
      this.updateVision();
    },
    async toggleDoor(u, d) {
      if (!ADJ(u, d.x, d.z)) { if (!(await this.approach(u, d.x, d.z, 1))) return; }
      if (d.locked) { this.toast('Trancada.', 'erro'); return; }
      if (this.unitAt(d.x, d.z)) { this.toast('Tem alguém na porta.', 'erro'); return; }
      if (!this.can(u, 1)) return;
      await this.act(async () => {
        this.spend(u, 1);
        if (d.open) {
          d.open = false; this.map.version++; this.S.world.refreshDoor(this.map.idx(d.x, d.z));
          bus.emit('sfx', d.gate ? 'gate' : 'door_close', d.x, d.z);
          await this.view().play(u, 'interact');
        } else await this.openDoorRaw(u, d);
      });
    },
    async unlockDoor(u, d, how) {
      if (!ADJ(u, d.x, d.z)) { if (!(await this.approach(u, d.x, d.z, 1))) return; }
      const cost = { chave: 1, gazua: 2, pe: 3, forca: 3, machado: 4 }[how];
      if (!this.can(u, cost)) return;
      await this.act(async () => {
        this.spend(u, cost);
        u.face = Math.atan2(d.x - u.x, d.z - u.z);
        const view = this.view();
        if (how === 'chave') { d.locked = false; this.log(`🔑 ${u.name} destrancou a porta.`, 'bom'); await view.play(u, 'interact'); }
        else if (how === 'gazua') { d.locked = false; this.log(`🔧 ${u.name} abriu a fechadura na gambiarra, sem um pio.`, 'bom'); await view.play(u, 'interact'); }
        else {
          await view.play(u, 'attack');
          const str = effStat(u, 'forca');
          const ch = how === 'pe' ? 0.45 + str * 0.05 : how === 'machado' ? 0.6 + str * 0.04 : 0.1 + str * 0.06;
          this.noise(d.x, d.z, how === 'pe' ? 5 : 9, u);
          bus.emit('sfx', 'bang', d.x, d.z);
          if (rng.next() < ch) { d.locked = false; d.open = true; d.broken = how !== 'pe'; this.map.version++; this.S.world.refreshDoor(this.map.idx(d.x, d.z)); this.log(`💥 ${u.name} arrombou a porta!`, 'bom'); }
          else { this.log(`${u.name} tentou arrombar, mas a porta resistiu. (barulho!)`, 'alerta'); view.floatText(d.x, d.z, 'Resistiu!', 'miss'); }
        }
      });
    },
    async barricade(u, target, isWindow) {
      if (!ADJ(u, target.x, target.z)) { if (!(await this.approach(u, target.x, target.z, 1))) return; }
      const cost = 3 - (u.skill('mao_na_graxa') ? 1 : 0);
      if (countItem(u, 'tabuas') < 2 || countItem(u, 'pregos') < 1) { this.toast('Precisa de 2 tábuas e 1 pregos.', 'erro'); return; }
      if (!(countItem(u, 'martelo') || countItem(u, 'ferramentas'))) { this.toast('Precisa de martelo ou caixa de ferramentas.', 'erro'); return; }
      if (!isWindow && target.open) { this.toast('Feche a porta antes.', 'erro'); return; }
      if (!this.can(u, cost)) return;
      await this.act(async () => {
        this.spend(u, cost);
        removeItem(u, 'tabuas', 2); removeItem(u, 'pregos', 1);
        target.barricade = 2; target.bhp = 40;
        this.noise(target.x, target.z, 6, u);
        bus.emit('sfx', 'hammer', target.x, target.z);
        await this.view().play(u, 'attack');
        if (isWindow) { const b = this.map.building[this.map.idx(target.x, target.z)]; if (b >= 0) this.S.world.buildBuilding(this.map.buildings[b]); }
        else this.S.world.refreshDoor(this.map.idx(target.x, target.z));
        this.map.version++;
        this.log(`🪵 ${u.name} barricou a ${isWindow ? 'janela' : 'porta'}.`, 'bom');
        this.gainXp(u, 8);
      });
    },
    async unbarricade(u, d) {
      if (!ADJ(u, d.x, d.z)) { if (!(await this.approach(u, d.x, d.z, 1))) return; }
      if (!this.can(u, 2)) return;
      await this.act(async () => { this.spend(u, 2); d.barricade = 0; this.map.addPile(u.x, u.z, 'tabuas', 1); this.S.world.refreshDoor(this.map.idx(d.x, d.z)); this.map.version++; await this.view().play(u, 'interact'); });
    },
    async breakWindow(u, w) {
      if (!ADJ(u, w.x, w.z)) { if (!(await this.approach(u, w.x, w.z, 1))) return; }
      if (!this.can(u, 2)) return;
      await this.act(async () => {
        this.spend(u, 2);
        u.face = Math.atan2(w.x - u.x, w.z - u.z);
        await this.view().play(u, 'attack');
        w.broken = true; this.map.version++;
        bus.emit('sfx', 'glass', w.x, w.z);
        const b = this.map.building[this.map.idx(w.x, w.z)];
        if (b >= 0) this.S.world.buildBuilding(this.map.buildings[b]);
        this.noise(w.x, w.z, 9, u);
        this.log(`🪟 ${u.name} quebrou a janela. CRASH! (dá para pular por ela)`, 'alerta');
      });
    },
    // chega perto de uma célula (adjacente)
    async approach(u, x, z, extra = 0) {
      if (ADJ(u, x, z)) return true;
      const path = this.pathTo(u, x, z, { goalAdjacent: true });
      if (!path) { this.toast('Não dá para chegar lá.', 'erro'); return false; }
      const cost = this.moveCost(u, path, this.input.run);
      if (u.ap < cost + extra) { this.toast(`PA insuficientes (andar ${cost} + ação ${extra}).`, 'erro'); return false; }
      await this.act(() => this.moveAlong(u, path, this.input.run));
      return ADJ(u, x, z);
    },

    // ------------------------------------------------------------ vasculhar e itens
    searchCost(u, p) {
      let c = PROPS[p.type].search || 2;
      if (p.searched) return 0;
      if (u.skill('plano_de_aula')) c -= 1;
      return Math.max(1, c);
    },
    async search(u, p) {
      if (p.locked) { this.toast('Está trancado.', 'erro'); return; }
      const cells = this.map.propCells(p);
      const adj = cells.some(([x, z]) => ADJ(u, x, z));
      const cost = this.searchCost(u, p);
      if (!adj) {
        const [tx, tz] = cells.slice().sort((a, b) => Math.hypot(a[0] - u.x, a[1] - u.z) - Math.hypot(b[0] - u.x, b[1] - u.z))[0];
        if (!(await this.approach(u, tx, tz, cost))) return;
      }
      if (!this.can(u, cost)) return;
      await this.act(async () => {
        this.spend(u, cost);
        const c = cells[0];
        u.face = Math.atan2(c[0] - u.x, c[1] - u.z);
        await this.view().play(u, PROPS[p.type].car ? 'interact' : 'pickup');
        if (!p.searched) {
          p.searched = true;
          this.noise(u.x, u.z, 1.5, u);
          // olho de gamer e sorte: item extra
          const og = [0, 0.1, 0.2, 0.3][u.skill('olho_gamer')] + (effStat(u, 'sorte') - 5) * 0.02;
          if (p.lootTable && rng.next() < og) {
            const extra = { loot: [] };
            rollExtra(extra, p.lootTable);
            for (const e of extra.loot) { const ex = p.loot.find(x => x.id === e.id); if (ex) ex.n += e.n; else p.loot.push(e); }
            if (extra.loot.length) this.view().floatText(u.x, u.z, '✨ Achado extra!', 'xp');
          }
          this.gainXp(u, 2, true);
          await Story.onSearch(this, u, p);
          if (!p.loot.length) this.view().floatText(p.x, p.z, 'Nada útil.', 'miss');
        }
        bus.emit('loot', { source: p, hero: u });
      });
    },
    async pickupPile(u, x, z) {
      if (!ADJ(u, x, z) && !(u.x === x && u.z === z)) { if (!(await this.approach(u, x, z, 1))) return; }
      if (!this.can(u, 1)) return;
      await this.act(async () => {
        this.spend(u, 1);
        await this.view().play(u, 'pickup');
        bus.emit('loot', { source: { pile: true, x, z }, hero: u });
      });
    },
    lootList(src) {
      if (src.pile) return this.map.pileAt(src.x, src.z) || [];
      return src.loot || [];
    },
    takeLoot(u, src, idx, n = null) {
      const list = this.lootList(src);
      const e = list[idx];
      if (!e) return false;
      const it = ITEMS[e.id];
      const count = n ?? e.n;
      const w = (it.peso || 0) * count;
      if (carried(u) + w > capacity(u) + 8) { this.toast(`${u.name} não aguenta carregar mais.`, 'erro'); return false; }
      if (stackable(e.id)) addItem(u, e.id, count);
      else for (let i = 0; i < count; i++) { const o = newItem(e.id); if (e.dur !== undefined) o.dur = e.dur; if (e.loaded !== undefined) o.loaded = e.loaded; if (e.carga !== undefined) o.carga = e.carga; u.inv.push(o); }
      e.n -= count;
      if (e.n <= 0) list.splice(idx, 1);
      if (src.pile && !list.length) this.map.piles.delete(this.map.idx(src.x, src.z));
      if (carried(u) > capacity(u)) this.toast(`${u.name} está com peso demais (−2 PA).`, 'erro');
      Story.onItem(this, u, e.id);
      bus.emit('hud');
      return true;
    },
    putLoot(u, src, invIdx) {
      const e = u.inv[invIdx];
      if (!e) return;
      if (src.pile) this.map.addPile(src.x, src.z, e.id, e.n);
      else { const ex = src.loot.find(x => x.id === e.id && stackable(e.id)); if (ex) ex.n += e.n; else src.loot.push({ ...e }); }
      u.inv.splice(invIdx, 1);
      bus.emit('hud');
    },
    dropItem(u, invIdx) {
      const e = u.inv[invIdx];
      if (!e) return;
      this.map.addPile(u.x, u.z, e.id, e.n);
      u.inv.splice(invIdx, 1);
      bus.emit('hud');
    },
    async giveItem(u, other, invIdx, n = null) {
      const e = u.inv[invIdx];
      if (!e || !other) return;
      if (cheb(u, other) > 1) { this.toast(`Chegue perto de ${other.name} para entregar.`, 'erro'); return; }
      const cost = this.state.mode === 'combat' ? 1 : 0;
      if (cost && !this.can(u, cost)) return;
      this.spend(u, cost);
      const count = n ?? e.n;
      if (stackable(e.id)) { addItem(other, e.id, count); e.n -= count; if (e.n <= 0) u.inv.splice(invIdx, 1); }
      else { other.inv.push(e); u.inv.splice(invIdx, 1); }
      this.log(`${u.name} entregou ${ITEMS[e.id].nome} para ${other.name}.`, '');
      Story.onGive(this, u, other, e.id);
      bus.emit('hud');
    },
    equip(u, invIdx) {
      const e = u.inv[invIdx];
      if (!e) return;
      const it = ITEMS[e.id];
      const slot = it.equip || (it.cat === 'arma' ? 'mao' : null);
      if (!slot) return;
      const cost = this.state.mode === 'combat' ? (slot === 'mao' || slot === 'mao2' ? 1 : 2) : 0;
      if (cost && !this.can(u, cost)) return;
      this.spend(u, cost);
      u.inv.splice(invIdx, 1);
      if (u.eq[slot]) u.inv.push(u.eq[slot]);
      u.eq[slot] = e;
      recompute(u);
      this.log(`${u.name} equipou ${it.nome}.`, '');
      bus.emit('hud');
    },
    unequip(u, slot) {
      if (!u.eq[slot]) return;
      u.inv.push(u.eq[slot]);
      u.eq[slot] = null;
      bus.emit('hud');
    },
    toggleFlashlight(u) {
      const l = u.eq.mao2;
      if (!l || l.id !== 'lanterna') { this.toast('Equipe uma lanterna na mão secundária.', 'erro'); return; }
      if ((l.carga || 0) <= 0) { this.toast('Lanterna sem pilha. Use pilhas.', 'erro'); return; }
      u.flash = !u.flash;
      this.toast(u.flash ? '🔦 Lanterna ligada' : 'Lanterna desligada');
      this.updateVision();
      bus.emit('hud');
    },
    // usar item (comer, beber, medicamento...) em si ou num aliado colado
    async useItem(u, invIdx, target = u) {
      const e = u.inv[invIdx];
      if (!e) return;
      const it = ITEMS[e.id];
      if (it.id === 'pilhas') {
        const l = u.eq.mao2 && u.eq.mao2.id === 'lanterna' ? u.eq.mao2 : u.inv.find(x => x.id === 'lanterna');
        if (!l) { this.toast('Não tem lanterna para trocar a pilha.', 'erro'); return; }
        l.carga = Math.min(100, (l.carga || 0) + 50); removeItem(u, 'pilhas', 1); this.toast('🔋 Pilhas trocadas'); bus.emit('hud'); return;
      }
      if (it.id === 'mapa') { this.state.flags.mapa = true; removeItem(u, 'mapa', 1); this.updateVision(); this.log('🗺️ O mapa de Aimorés foi marcado no minimapa.', 'bom'); bus.emit('hud'); return; }
      if (it.id === 'radio_pilha') { await Story.radio(this, u); return; }
      if (it.id === 'apito') {
        if (!this.can(u, 1)) return;
        await this.act(async () => { this.spend(u, 1); this.noise(u.x, u.z, 12, u); this.view().say(u, 'PRIIIIIIII!'); this.log(`${u.name} apitou. Todo zumbi num raio de 12 casas ouviu.`, 'alerta'); });
        return;
      }
      if (it.cat === 'arma' || it.equip) { this.equip(u, invIdx); return; }
      if (!it.uso) { this.toast('Esse item não se usa diretamente.', 'erro'); return; }
      if (target !== u && cheb(u, target) > 1) { this.toast(`Chegue perto de ${target.name}.`, 'erro'); return; }
      const med = it.cat === 'medicamento' || it.id === 'soro_r7';
      let cost = med ? (it.id === 'kit_medico' ? 2 : 1) : 1;
      if (med && u.skill('maos_que_curam')) cost = Math.max(1, cost - 1);
      if (!this.can(u, cost)) return;
      await this.act(async () => {
        this.spend(u, cost);
        const U = it.uso;
        const t = target;
        const view = this.view();
        if (t !== u) u.face = Math.atan2(t.x - u.x, t.z - u.z);
        await view.play(u, med ? 'medicine' : 'eat');
        const k = (u.hasPerk('estomago') && !med ? 1.3 : 1);
        const heal = (med ? (1 + [0, 0.3, 0.6, 0.9][u.skill('maos_que_curam')] + (u.hasPerk('socorrista') ? 0.25 : 0)) : 1);
        const n = t.need;
        const msgs = [];
        if (U.fome) { n.fome = clamp(n.fome + U.fome * k, 0, 100); msgs.push(`fome ${U.fome > 0 ? '+' : ''}${Math.round(U.fome * k)}`); }
        if (U.sede) { n.sede = clamp(n.sede + U.sede * k, 0, 100); msgs.push(`sede ${U.sede > 0 ? '+' : ''}${Math.round(U.sede * k)}`); }
        if (U.energia) { n.energia = clamp(n.energia + U.energia, 0, 100); msgs.push(`energia ${U.energia > 0 ? '+' : ''}${U.energia}`); }
        if (U.moral) { n.moral = clamp(n.moral + U.moral, 0, 100); msgs.push(`moral ${U.moral > 0 ? '+' : ''}${U.moral}`); }
        if (U.hp) { const h = Math.round(U.hp * heal); t.hp = Math.min(t.maxHp, t.hp + h); view.floatText(t.x, t.z, `+${h}`, 'heal'); }
        if (U.estanca && t.st.bleed) { t.st.bleed = 0; msgs.push('sangramento estancado'); }
        if (U.trata) { for (const w of t.wounds) w.tratado = true; msgs.push('ferimentos tratados'); }
        if (U.dor) t.st.dor = U.dor * 5;
        if (U.segura) { t.st.segura = U.segura * 5; }
        if (U.infeccao) { n.infeccao = clamp(n.infeccao + U.infeccao, 0, 100); if (n.infeccao <= 0 && U.cura) { t.st.infected = false; t.wounds = t.wounds.filter(w => w.tipo !== 'mordida'); } }
        if (U.cura) { t.st.infected = false; n.infeccao = 0; t.wounds = t.wounds.filter(w => w.tipo !== 'mordida'); this.log(`🧪 O Soro R-7 funcionou! ${t.name} está livre da infecção.`, 'bom'); Story.flag(this, 'soro_usado', t.id || t.name); }
        if (U.bebado) { t.st.drunk = U.bebado * 5; msgs.push('mira −15% por um tempo'); }
        if (it.cargas || e.cargas) { e.cargas = (e.cargas ?? it.cargas) - 1; if (e.cargas <= 0) { u.inv.splice(u.inv.indexOf(e), 1); if (it.id === 'galao' || it.id === 'cafe') addItem(u, 'garrafa', 0); } }
        else removeItem(u, e.id, 1);
        this.log(`${it.icon} ${u.name}${t !== u ? ` → ${t.name}` : ''}: ${it.nome}${msgs.length ? ' (' + msgs.join(', ') + ')' : ''}.`, '');
        if (med && t !== u) { this.gainXp(u, 8); Story.relChange(this, u.id, t.id, 2); }
      });
    },
    // levantar aliado caído
    async revive(u, t) {
      if (!t.st.downed) return;
      const item = countItem(u, 'kit_medico') ? 'kit_medico' : countItem(u, 'atadura') ? 'atadura' : null;
      if (!item) { this.toast('Precisa de atadura ou kit médico.', 'erro'); return; }
      const cost = u.skill('maos_que_curam') >= 3 ? 2 : 3;
      if (!ADJ(u, t.x, t.z)) { if (!(await this.approach(u, t.x, t.z, cost))) return; }
      if (!this.can(u, cost)) return;
      await this.act(async () => {
        this.spend(u, cost);
        removeItem(u, item, 1);
        await this.view().play(u, 'medicine');
        t.st.downed = 0; t.hp = Math.round(t.maxHp * (item === 'kit_medico' ? 0.45 : 0.25)); t.st.bleed = 0; t.ap = 0;
        this.view().loop(t, 'idle');
        this.view().say(t, rng.pick(['Valeu... achei que era o fim.', 'Ainda não foi dessa vez!', 'Ai, ai, ai... valeu demais.']));
        this.log(`💖 ${u.name} levantou ${t.name}!`, 'bom');
        this.gainXp(u, 20);
        Story.relChange(this, u.id, t.id, 8);
      });
    },

    // ------------------------------------------------------------ arremessos e distrações
    async throwAt(u, x, z, itemId = null) {
      const e = itemId ? u.inv.find(i => i.id === itemId) || (u.eq.mao && u.eq.mao.id === itemId ? u.eq.mao : null) : u.eq.mao;
      if (!e) { this.toast('Nada para arremessar.', 'erro'); return; }
      const it = ITEMS[e.id];
      const w = it.w;
      const d = Math.hypot(x - u.x, z - u.z);
      const range = (w.alcance || 6) * (u.skill('estilingada') >= 3 ? 1.5 : 1);
      if (d > range + 0.5) { this.toast('Longe demais para arremessar.', 'erro'); return; }
      if (!this.can(u, w.pa || 2)) return;
      await this.act(async () => {
        this.spend(u, w.pa || 2);
        u.face = Math.atan2(x - u.x, z - u.z);
        const view = this.view();
        view.play(u, 'shoot');
        await wait(150);
        // pode desviar uma casa
        let tx = x, tz = z;
        const acc = w.prec + [0, 15, 25, 35][u.skill('estilingada')] - d * 2;
        if (rng.next() * 100 > acc) { tx += rng.int(-1, 1); tz += rng.int(-1, 1); }
        await view.projectile(u.x, u.z, tx, tz, it.id === 'molotov' ? '#ff8a2a' : it.id === 'rojao' ? '#ff3a6a' : '#b87a4a', 2.2, 0.55);
        if (e === u.eq.mao) { if (stackable(e.id) || (e.n || 1) <= 1) u.eq.mao = null; else e.n--; }
        else removeItem(u, e.id, 1);
        this.noise(tx, tz, w.ruido || 6, u);
        bus.emit('sfx', it.id === 'molotov' ? 'fire' : it.id === 'rojao' ? 'boom' : 'thud', tx, tz);
        if (it.id === 'molotov') {
          view.burst(tx, tz, '#ff7a1a', 4);
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (this.map.inb(tx + dx, tz + dz) && !this.map.struct[this.map.idx(tx + dx, tz + dz)]) this.map.fire.set(this.map.idx(tx + dx, tz + dz), 3);
          for (const o of this.units) if (o.alive && Math.abs(o.x - tx) <= 1 && Math.abs(o.z - tz) <= 1) { this.damage(o, rng.int(w.dano[0], w.dano[1]), u, { noBlood: true }); if (o.kind === 'zombie' && o.alive) o.st.burn = 3; }
          this.refreshLights();
          this.log(`🔥 ${u.name} jogou um molotov! A área pegou fogo.`, 'alerta');
        } else if (it.id === 'rojao') {
          view.burst(tx, tz, '#ff5ad0', 3);
          for (const o of this.units) if (o.alive && o.kind === 'zombie' && Math.abs(o.x - tx) <= 1 && Math.abs(o.z - tz) <= 1) o.st.stun = 1;
          this.log(`🎆 POW! O rojão estourou e atraiu os zumbis para lá. Arraiá!`, 'alerta');
        } else {
          const hit = this.unitAt(tx, tz);
          if (hit && hit !== u) this.damage(hit, rng.int(w.dano[0], w.dano[1]), u);
          if (it.id === 'pedra_grande') this.map.addPile(tx, tz, 'pedra_grande', 1);
          this.log(`${u.name} arremessou ${it.nome}. Barulho em outro lugar!`, '');
        }
        this.gainXp(u, 3, true);
      });
    },
    // joga uma pedrinha longe para distrair os zumbis
    async distract(u, x, z) {
      if (countItem(u, 'pedrinhas') <= 0) { this.toast('Precisa de pedrinhas.', 'erro'); return; }
      const range = 8 * (u.skill('estilingada') >= 3 ? 2 : 1);
      if (Math.hypot(x - u.x, z - u.z) > range) { this.toast(`Alcance da distração: ${range} casas.`, 'erro'); return; }
      if (!this.can(u, 1)) return;
      await this.act(async () => {
        this.spend(u, 1);
        removeItem(u, 'pedrinhas', 1);
        u.face = Math.atan2(x - u.x, z - u.z);
        this.view().play(u, 'shoot');
        await this.view().projectile(u.x, u.z, x, z, '#9a9a9a', 1.5, 0.4);
        this.noise(x, z, 6, u);
        bus.emit('sfx', 'thud', x, z);
        this.view().floatText(x, z, '*toc*', 'miss');
        this.log(`🪨 ${u.name} jogou uma pedrinha. Os zumbis por perto vão olhar para lá.`, '');
      });
    },

    // ------------------------------------------------------------ conversas e aliados
    async talk(u, npc) {
      if (!ADJ(u, npc.x, npc.z) && dist(u, npc) > 2.5) { if (!(await this.approach(u, npc.x, npc.z, 0))) return; }
      if (this.state.mode === 'combat' && !this.can(u, 1)) return;
      if (this.state.mode === 'combat') this.spend(u, 1);
      u.face = Math.atan2(npc.x - u.x, npc.z - u.z);
      npc.face = Math.atan2(u.x - npc.x, u.z - npc.z);
      await Story.talk(this, u, npc);
    },

    // ------------------------------------------------------------ cozinhar, fabricar, descansar
    haveReq(u, req) {
      const [ids, n] = req;
      return ids.split('|').some(id => countItem(u, id) >= n);
    },
    takeReq(u, req) {
      const [ids, n] = req;
      const id = ids.split('|').find(i => countItem(u, i) >= n);
      if (id === 'taco' && u.eq.mao && u.eq.mao.id === 'taco' && !u.inv.find(e => e.id === 'taco')) { u.eq.mao = null; return; }
      if (id) removeItem(u, id, n);
    },
    async craft(u, recipeId, stove = null) {
      const r = RECIPES.find(r => r.id === recipeId);
      if (!r) return;
      if (r.fogao && !stove) { this.toast('Precisa estar perto de um fogão ou churrasqueira.', 'erro'); return; }
      if (r.fogao && countItem(u, 'fosforos') <= 0) { this.toast('Precisa de fósforos para acender o fogo.', 'erro'); return; }
      for (const req of r.precisa) if (!this.haveReq(u, req)) { this.toast('Faltam ingredientes/materiais.', 'erro'); return; }
      if (r.repara && !(u.eq.mao && u.eq.mao.dur !== undefined)) { this.toast('Equipe a arma branca que quer consertar.', 'erro'); return; }
      if (!this.can(u, r.pa)) return;
      await this.act(async () => {
        this.spend(u, r.pa);
        for (const req of r.precisa) this.takeReq(u, req);
        await this.view().play(u, 'interact');
        if (r.repara) { const it = ITEMS[u.eq.mao.id]; u.eq.mao.dur = Math.min(it.w.dur, u.eq.mao.dur + Math.round(it.w.dur * 0.5)); this.log(`🩶 ${u.name} remendou a arma com silver tape.`, 'bom'); }
        else { addItem(u, r.da[0], r.da[1]); this.log(`🛠️ ${u.name} fez: ${ITEMS[r.da[0]].nome}${r.da[1] > 1 ? ' ×' + r.da[1] : ''}.`, 'bom'); }
        if (r.fogao) this.noise(u.x, u.z, 3, u);
        this.gainXp(u, 6);
      });
    },
    async drinkTap(u, p) {
      if (!(await this.approach(u, p.x, p.z, 1))) return;
      if (!this.can(u, 1)) return;
      await this.act(async () => {
        this.spend(u, 1);
        await this.view().play(u, 'eat');
        if (this.state.flags.agua_cortada) { this.toast('A torneira só cospe ar. A água da cidade acabou.', 'erro'); return; }
        u.need.sede = Math.min(100, u.need.sede + 20);
        if (rng.next() < 0.15) { u.need.energia = Math.max(0, u.need.energia - 15); this.log(`🚽 A água da torneira não caiu bem para ${u.name}...`, 'alerta'); }
        else this.log(`💧 ${u.name} bebeu água da torneira (sede +20).`, '');
      });
    },
    // dormir no esconderijo: pula horas, recupera energia (pode dar ruim)
    canSleep() {
      const b = this.map.buildings.find(b => b.safehouse || this.state.flags['refugio_' + b.id]);
      if (this.state.mode !== 'explore') return 'Não dá para dormir com perigo por perto.';
      const hs = this.liveHeroes.filter(h => !h.st.downed);
      const inside = hs.every(h => { const bb = this.map.buildingAt(h.x, h.z); return bb && (bb.safehouse || this.state.flags['refugio_' + bb.id]); });
      if (!inside) return 'Todos precisam estar dentro de um esconderijo seguro (Casa da Turma ou Igreja).';
      if (this.units.some(z => z.alive && this.hostile(z) && this.liveHeroes.some(h => Math.hypot(h.x - z.x, h.z - z.z) < 10))) return 'Tem zumbi perto demais para dormir.';
      return null;
    },
    async sleep(hours = 7) {
      const why = this.canSleep();
      if (why) { this.toast(why, 'erro'); return; }
      this.phase = 'ai';
      bus.emit('fade', true);
      await wait(700);
      const steps = hours * 12;
      let interrupted = false;
      for (let i = 0; i < steps; i++) {
        this.state.time += 5;
        for (const h of this.liveHeroes) {
          h.need.energia = Math.min(100, h.need.energia + 1.1);
          h.need.fome = Math.max(0, h.need.fome - 0.12);
          h.need.sede = Math.max(0, h.need.sede - 0.16);
          if (i % 12 === 0) h.hp = Math.min(h.maxHp, h.hp + 2);
          if (h.st.infected && !(h.st.segura > 0)) h.need.infeccao = Math.min(99, h.need.infeccao + 0.3);
        }
        if (i % 12 === 0) this.hourlySpawn(Math.floor(this.state.time / 60) % 24);
        if (i > 12 && rng.next() < 0.004 * this.diff.spawn) { interrupted = true; break; }
      }
      this.S.setTime(this.state.time, this.state.weather);
      bus.emit('fade', false);
      this.phase = 'player';
      if (interrupted) {
        this.log('💥 Um barulho acordou todo mundo! Tem zumbi forçando a porta!', 'perigo');
        this.toast('Acordaram com barulho!', 'perigo');
        await Story.nightAttack(this);
      } else {
        this.log(`😴 O grupo dormiu e acordou às ${this.clock()}.`, 'bom');
        for (const h of this.liveHeroes) h.need.moral = Math.min(100, h.need.moral + 10);
        await Story.onWake(this);
      }
      this.startPlayerTurn();
    },

    // ------------------------------------------------------------ habilidades
    async useSkill(u, id, target = null) {
      const sk = SKILLS[id];
      const r = u.skill(id);
      if (!r || !sk.ativa) return;
      if ((u.cd[id] || 0) > 0) { this.toast(`${sk.nome}: recarga ${u.cd[id]} turno(s).`, 'erro'); return; }
      if (!this.can(u, sk.pa)) return;
      const view = this.view();
      if (id === 'sumir') {
        if (this.units.some(z => z.alive && this.hostile(z) && cheb(z, u) <= 1)) { this.toast('Tem inimigo colado demais!', 'erro'); return; }
        await this.act(async () => {
          this.spend(u, sk.pa); u.cd[id] = sk.recarga[r - 1]; u.st.hidden = true;
          for (const z of this.units) if (z.kind === 'zombie' && z.ai.target === u.uid) { z.ai.state = 'investigate'; z.ai.target = null; z.ai.noise = { x: u.x + rng.int(-2, 2), z: u.z + rng.int(-2, 2), turn: this.state.turn }; }
          view.loop(u, 'crouch'); view.floatText(u.x, u.z, '🥷 Sumiu!', 'info');
          this.log(`🥷 ${u.name} simplesmente sumiu. Os zumbis ficaram confusos.`, 'bom');
        });
      } else if (id === 'fe_inabalavel') {
        await this.act(async () => {
          this.spend(u, sk.pa); u.cd[id] = sk.recarga[r - 1];
          await view.play(u, 'celebrate');
          view.say(u, rng.pick(['Calma, gente. A gente vai sair dessa. Juntos.', 'Respira fundo. Deus tá vendo e eu também.', 'Ninguém fica pra trás. Ninguém!']));
          for (const h of this.liveHeroes) if (Math.hypot(h.x - u.x, h.z - u.z) <= 5) { h.need.moral = Math.min(100, h.need.moral + [15, 25, 35][r - 1]); h.st.panic = 0; view.floatText(h.x, h.z, '💛 Moral', 'heal'); }
        });
      } else if (id === 'voz_de_comando') {
        if (!target || target === u || target.kind !== 'hero' || target.dead || target.st.downed) { this.toast('Escolha um aliado.', 'erro'); return; }
        if (u.st.cmdUsed) { this.toast('Já usou a Voz de Comando neste turno.', 'erro'); return; }
        if (Math.hypot(target.x - u.x, target.z - u.z) > 6) { this.toast('Aliado longe demais (máx. 6).', 'erro'); return; }
        await this.act(async () => {
          this.spend(u, sk.pa); u.st.cmdUsed = true;
          const bonus = [2, 3, 4][r - 1];
          target.ap += bonus;
          view.say(u, rng.pick([`${target.name}, AGORA! Vai, vai, vai!`, 'Organiza essa fila! Um de cada vez!', `Presta atenção, ${target.name}! Isso cai na prova!`]));
          view.floatText(target.x, target.z, `+${bonus} PA`, 'xp');
          this.log(`📣 ${u.name} deu uma ordem: ${target.name} ganhou +${bonus} PA.`, 'bom');
        });
      } else if (id === 'surto') {
        await this.act(async () => {
          u.cd[id] = sk.recarga[r - 1]; u.st.surto = true; u.ap += [3, 4, 5][r - 1];
          await view.play(u, 'scared');
          view.say(u, rng.pick(['EU NÃO TÔ DE BOA! AAAAAH!', 'Chega! CHEGA DE ZUMBI!', 'Vocês mexeram com o cara errado!']));
          view.flash(u, '#ff4040');
          u.need.moral = Math.max(0, u.need.moral - 15); u.need.energia = Math.max(0, u.need.energia - 15);
          this.log(`😤 ${u.name} surtou! +PA e +50% de dano corpo a corpo neste turno.`, 'alerta');
        });
      } else if (id === 'couro_grosso') {
        await this.act(async () => {
          this.spend(u, sk.pa); u.cd[id] = sk.recarga[r - 1]; u.st.protetor = true;
          view.say(u, 'Pode vir! Pode vir que eu aguento!');
          this.log(`🛡️ ${u.name} está atraindo os zumbis próximos para si.`, 'info');
        });
      }
    },

    // ------------------------------------------------------------ menu de contexto
    optionsAt(u, x, z, unit = null) {
      const map = this.map;
      const opts = [];
      if (!map.inb(x, z)) return opts;
      const t = unit || this.unitAt(x, z);
      const i = map.idx(x, z);
      const adj = ADJ(u, x, z);
      const walkCost = (goalAdj) => {
        if (goalAdj && adj) return 0;
        const p = this.pathTo(u, x, z, { goalAdjacent: goalAdj });
        return p ? this.moveCost(u, p, this.input.run) : null;
      };
      if (t && t !== u) {
        if (this.hostile(t) && this.unitVisible(t)) {
          const w = u.weaponStats();
          if (w.tipo === 'arremesso') opts.push({ label: `Arremessar ${ITEMS[u.eq.mao.id].nome}`, ap: w.pa, fn: () => this.throwAt(u, x, z) });
          else {
            const ch = hitChance(this, u, t, w);
            const mc = w.tipo === 'corpo' ? walkCost(true) : 0;
            const ok = w.tipo === 'corpo' ? mc !== null : inRange(this, u, t, w);
            opts.push({ label: `Atacar ${t.name} — ${ch}% (dano ${w.dano[0]}–${w.dano[1]})`, ap: (w.pa || 2) + (mc || 0), fn: () => this.attack(u, t), danger: true, disabled: !ok });
            if (w.tipo === 'distancia') opts.push({ label: 'Mirar (+15%)', ap: 1, fn: () => this.aim(u) });
          }
        } else if (t.kind === 'hero') {
          opts.push({ label: `Selecionar ${t.name}`, ap: 0, fn: () => this.select(t) });
          if (t.st.downed) opts.push({ label: `Levantar ${t.name}`, ap: u.skill('maos_que_curam') >= 3 ? 2 : 3, fn: () => this.revive(u, t) });
          if (u.skill('voz_de_comando')) opts.push({ label: `Voz de Comando em ${t.name}`, ap: 2, fn: () => this.useSkill(u, 'voz_de_comando', t) });
          if (cheb(u, t) <= 1) opts.push({ label: `Tratar/entregar item para ${t.name}`, ap: 0, fn: () => bus.emit('inventory', u, t) });
        } else if (t.kind === 'npc' && !t.dead) {
          opts.push({ label: `Conversar com ${t.name}`, ap: this.state.mode === 'combat' ? 1 : 0, fn: () => this.talk(u, t) });
          if (t.faction !== 'ally') opts.push({ label: `Atacar ${t.name}`, ap: u.weaponStats().pa || 2, fn: () => this.confirm(`Atacar ${t.name}? Isso pode ter consequências.`, () => this.attack(u, t)), danger: true });
        }
      }
      const corpse = this.corpseAt(x, z);
      const pile = map.pileAt(x, z);
      if (pile && pile.length) opts.push({ label: `Pegar itens do chão (${pile.length})`, ap: 1, fn: () => this.pickupPile(u, x, z) });
      const s = map.struct[i];
      if (s === S.DOOR || s === S.GATE) {
        const d = map.doors.get(i);
        if (d.knock && d.locked) opts.push({ label: 'Bater na porta', ap: 0, fn: () => Story.knock(this, u, d) });
        if (d.barricade) opts.push({ label: 'Remover barricada', ap: 2, fn: () => this.unbarricade(u, d) });
        else if (d.locked) {
          const key = d.key;
          const hasKey = key && this.liveHeroes.some(h => countItem(h, key) > 0);
          if (key === 'corrente') {
            opts.push({ label: 'Portão acorrentado — arrebentar com pé de cabra', ap: 3, fn: () => countItem(u, 'pe_de_cabra') || u.eq.mao?.id === 'pe_de_cabra' ? this.unlockDoor(u, d, 'pe') : this.toast('Precisa de um pé de cabra.', 'erro'), disabled: !(countItem(u, 'pe_de_cabra')) });
            if (u.skill('mao_na_graxa')) opts.push({ label: 'Soltar a corrente (Mão na Graxa)', ap: 2, fn: () => this.unlockDoor(u, d, 'gazua') });
          } else if (key === 'cracha') {
            opts.push({ label: hasKey ? 'Passar o crachá da AgroNova' : 'Porta com leitor de crachá (trancada)', ap: 1, fn: () => hasKey ? this.unlockDoor(u, d, 'chave') : this.toast('Precisa do crachá da AgroNova.', 'erro'), disabled: !hasKey });
          } else if (!d.knock) {
            if (hasKey) opts.push({ label: 'Destrancar com a chave', ap: 1, fn: () => this.unlockDoor(u, d, 'chave') });
            if (u.skill('mao_na_graxa')) opts.push({ label: 'Abrir a fechadura (Mão na Graxa)', ap: 2, fn: () => this.unlockDoor(u, d, 'gazua') });
            if (countItem(u, 'pe_de_cabra')) opts.push({ label: 'Forçar com pé de cabra', ap: 3, fn: () => this.unlockDoor(u, d, 'pe') });
            if (u.eq.mao && ITEMS[u.eq.mao.id].quebraPorta) opts.push({ label: 'Derrubar com o machado', ap: 4, fn: () => this.unlockDoor(u, d, 'machado') });
            opts.push({ label: 'Arrombar no chute (barulho!)', ap: 3, fn: () => this.unlockDoor(u, d, 'forca'), danger: true });
          }
        } else {
          opts.push({ label: d.open ? (d.gate ? 'Fechar portão' : 'Fechar porta') : (d.gate ? 'Abrir portão' : 'Abrir porta'), ap: 1 + (walkCost(true) || 0), fn: () => this.toggleDoor(u, d) });
          if (!d.gate && !d.open) opts.push({ label: 'Barricar porta (2 tábuas + pregos)', ap: 3, fn: () => this.barricade(u, d, false) });
        }
      }
      if (s === S.WINDOW) {
        const w = map.windows.get(i);
        if (!w.broken && !w.barricade) opts.push({ label: 'Quebrar a janela (barulho)', ap: 2, fn: () => this.breakWindow(u, w), danger: true });
        if (w.broken && !w.barricade) opts.push({ label: 'Pular a janela', ap: 2, fn: () => this.walkTo(u, x, z) });
        if (!w.barricade) opts.push({ label: 'Barricar janela (2 tábuas + pregos)', ap: 3, fn: () => this.barricade(u, w, true) });
      }
      const p = map.prop(x, z);
      if (p && !p.removed) {
        const def = PROPS[p.type];
        if (p.stash || def.stash) opts.push({ label: 'Abrir o baú do esconderijo', ap: 0, fn: async () => { if (await this.approach(u, x, z, 0)) bus.emit('loot', { source: p, hero: u, stash: true }); } });
        else if (p.locked) { if (countItem(u, 'pe_de_cabra')) opts.push({ label: 'Forçar o cofre com pé de cabra (barulho!)', ap: 5, fn: () => this.forceSafe(u, p), danger: true }); }
        else if (def.loot || p.lootTable) opts.push({ label: p.searched ? `Ver ${p.nome.toLowerCase()} (já vasculhado)` : `Vasculhar ${p.nome.toLowerCase()}`, ap: this.searchCost(u, p), fn: () => this.search(u, p) });
        if (def.stove) opts.push({ label: 'Cozinhar aqui', ap: 2, fn: async () => { if (await this.approach(u, x, z, 0)) bus.emit('craft', u, p); } });
        if (def.water && p.type !== 'fonte') opts.push({ label: 'Beber água da torneira', ap: 1, fn: () => this.drinkTap(u, p) });
        if (def.rest) opts.push({ label: 'Dormir até de manhã', ap: 0, fn: () => this.sleep() });
        for (const o of Story.propOptions(this, u, p)) opts.push(o);
        opts.push({ label: `Examinar: ${p.nome}`, ap: 0, fn: () => this.examine(p) });
      }
      if (!t && !map.blocked(x, z) && !(u.x === x && u.z === z)) {
        const c = walkCost(false);
        if (c !== null) {
          opts.unshift({ label: this.input.run ? 'Correr até aqui' : 'Andar até aqui', ap: c, fn: () => this.walkTo(u, x, z, { travel: true }) });
          if (!this.input.run) opts.push({ label: 'Correr até aqui', ap: this.moveCost(u, this.pathTo(u, x, z), true), fn: () => this.walkTo(u, x, z, { run: true, travel: true }) });
        }
        if (u.eq.mao && ITEMS[u.eq.mao.id].w?.tipo === 'arremesso') opts.push({ label: `Arremessar ${ITEMS[u.eq.mao.id].nome} aqui`, ap: ITEMS[u.eq.mao.id].w.pa, fn: () => this.throwAt(u, x, z) });
        for (const e of u.inv) if (ITEMS[e.id].w?.tipo === 'arremesso') { opts.push({ label: `Arremessar ${ITEMS[e.id].nome} aqui`, ap: ITEMS[e.id].w.pa, fn: () => this.throwAt(u, x, z, e.id) }); }
        if (countItem(u, 'pedrinhas')) opts.push({ label: 'Jogar pedrinha aqui (distrair)', ap: 1, fn: () => this.distract(u, x, z) });
      }
      if (x === u.x && z === u.z) {
        opts.push({ label: 'Esconder-se', ap: 2, fn: () => this.hide(u) });
        opts.push({ label: 'Defender (gasta os PA restantes)', ap: u.ap, fn: () => this.defend(u) });
      }
      for (const o of opts) if (o.ap === null || o.ap === undefined || Number.isNaN(o.ap)) o.ap = '?';
      return opts;
    },
    async forceSafe(u, p) {
      if (!(await this.approach(u, p.x, p.z, 5))) return;
      if (!this.can(u, 5)) return;
      await this.act(async () => {
        this.spend(u, 5);
        await this.view().play(u, 'attack');
        this.noise(p.x, p.z, 10, u);
        if (rng.next() < 0.35 + effStat(u, 'forca') * 0.05) { p.locked = false; this.log(`💥 ${u.name} arrebentou o cofre!`, 'bom'); bus.emit('loot', { source: p, hero: u }); }
        else this.log(`${u.name} amassou o cofre, mas ele não abriu. Muito barulho!`, 'alerta');
      });
    },
    examine(p) {
      const def = PROPS[p.type];
      const texts = {
        coreto: 'O coreto da praça. Já teve banda tocando dobrado em dia de festa. Hoje só tem pombo nervoso.',
        monumento: '"Ao Pioneiro, que desbravou o Vale do Rio Doce." Alguém pichou embaixo: "SAI ZUMBI".',
        orelhao: 'Um orelhão! Ninguém usava fazia anos. Continua sem funcionar.',
        locomotiva: 'A velha locomotiva da estação. Com diesel e a chave certa, ainda anda.',
        opala: 'O Opala do Seu Valdir: brilhando, lindo, e sem bateria.',
        onibus: 'O ônibus da linha Centro–Estação atravessado na avenida.',
        caminhao: 'Caminhão do exército. Tem lona rasgada e marcas de unha.',
        sino: 'O sino da Matriz. Se tocar, a cidade inteira escuta — inclusive quem não está mais vivo.',
        transmissor: 'O transmissor da rádio. Precisa de energia e de conserto.',
        tanque_lab: 'Um tanque de cultivo borbulhando uma gosma verde. Tem uma coisa se mexendo lá dentro.',
      };
      this.toast(texts[p.type] || `${def.nome}.`);
      this.log(`🔎 ${texts[p.type] || def.nome}`, 'info');
    },
    confirm(msg, fn) { bus.emit('confirm', msg, fn); },
  });
}

// sorteia itens extras de uma tabela (Olho de Gamer)
import { LOOT } from '../data/items.js';
function rollExtra(p, table) {
  const t = LOOT[table].filter(e => e[1] > 0);
  let tot = 0; for (const e of t) tot += e[1];
  let r = rng.next() * tot;
  for (const [id, w, [a, b]] of t) { r -= w; if (r <= 0) { p.loot.push({ id, n: rng.int(a, b) }); return; } }
}
