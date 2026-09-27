// Jogo em tempo real: relógio contínuo, corpo dos personagens com colisão, controle direto
// (teclado, joystick e clique), navegação por caminho, ataque na hora e interação com o cenário.
import { S, PROPS } from '../world/tiles.js';
import { ITEMS } from '../data/items.js';
import { ZOMBIES } from '../data/zombies.js';
import { hitChance, rollDamage, unaware } from './combat.js';
import { los } from './vision.js';
import { effStat, carried, capacity, countItem, removeItem } from './units.js';
import { tickSurvival } from './survival.js';
import { updateAI } from './ai.js';
import { rng, bus, clamp } from '../util.js';
import * as Story from './story.js';

export const MIN_PER_SEC = 1;     // 1 segundo de jogo = 1 minuto em Aimorés (um dia dura 24 minutos)
export const BODY_R = 0.3;        // raio do "corpo" de cada personagem, em casas
export const ROUND = 6;           // segundos de uma rodada (recargas de habilidades, efeitos curtos)

const dist2 = (a, b) => Math.hypot(a.px - b.px, a.pz - b.pz);

export function installRealtime(Game) {
  Object.assign(Game.prototype, {
    // ------------------------------------------------------------ preparação
    rtInit() {
      for (const u of this.units) this.rtPlace(u);
      this.clockAcc = 0; this.roundAcc = 0; this.secAcc = 0; this.visT = 0; this.modeT = 0;
      this.timers = [];
      this.input = Object.assign({ run: false, move: { x: 0, z: 0 }, attack: false }, this.input || {});
    },
    rtPlace(u) {
      if (u.px === undefined || u.px === null || Math.floor(u.px) !== u.x || Math.floor(u.pz) !== u.z) { u.px = u.x + 0.5; u.pz = u.z + 0.5; }
      u.atkCd = 0;
      u.nav = null;
    },
    // agenda algo em segundos de jogo (pausa junto com o jogo)
    later(sec, fn) { this.timers.push({ t: sec, fn }); },

    // ------------------------------------------------------------ laço principal
    tick(dt) {
      if (!this.state || this.phase !== 'player') return;
      dt = Math.min(dt, 0.1) * (this.timeScale || 1);
      // agendados
      for (let i = this.timers.length - 1; i >= 0; i--) {
        const t = this.timers[i];
        t.t -= dt;
        if (t.t <= 0) { this.timers.splice(i, 1); try { t.fn(); } catch (e) { console.error(e); } }
      }
      // controle do personagem escolhido
      const u = this.selected;
      if (u && u.alive && !u.st.downed) this.rtControl(u, dt);
      // os outros (companheiros, zumbis, sobreviventes)
      updateAI(this, dt);
      // recargas
      for (const o of this.units) if (o.alive && o.atkCd > 0) o.atkCd -= dt;
      // relógio de Aimorés
      this.clockAcc += dt * MIN_PER_SEC;
      while (this.clockAcc >= 1) { this.clockAcc -= 1; this.passMinute(); if (this.phase !== 'player') return; }
      // uma vez por segundo: fogo, gás, sangramento de zumbi, quem está caído
      this.secAcc += dt;
      if (this.secAcc >= 1) { this.secAcc -= 1; this.rtSecond(); }
      // rodadas: recarga de habilidades e efeitos
      this.roundAcc += dt;
      if (this.roundAcc >= ROUND) { this.roundAcc -= ROUND; this.rtRound(); }
      // visão e modo
      this.visT -= dt;
      if (this.visionDirty && this.visT <= 0) { this.visionDirty = false; this.visT = 0.12; this.updateVision(); }
      this.modeT -= dt;
      if (this.modeT <= 0) { this.modeT = 0.5; this.updateMode(); bus.emit('hud-lite'); }
    },
    passMinute() {
      const before = this.state.time;
      this.state.time += 1;
      const h0 = Math.floor(before / 60), h1 = Math.floor(this.state.time / 60);
      this.S.setTime(this.state.time, this.state.weather);
      tickSurvival(this, 1);
      if (Math.floor(before / 1440) !== Math.floor(this.state.time / 1440)) { this.log(`☀️ Começa o dia ${this.day()} em Aimorés.`, 'info'); this.toast(`Dia ${this.day()}`); }
      if (h0 !== h1) {
        const hh = h1 % 24;
        if (hh === 18) { this.log('🌆 O sol está se pondo. À noite há mais zumbis e eles ficam mais agressivos.', 'alerta'); this.toast('Anoitecendo'); }
        if (hh === 6) this.log('🌅 Amanheceu. Os zumbis ficam mais lentos com o calor.', 'info');
        this.hourlySpawn(hh);
        this.regrowTick?.();
      }
      // histórias, conversas e eventos (podem abrir diálogos: rodam sem travar o relógio)
      if (!this.storyBusy) {
        this.storyBusy = true;
        Promise.resolve(Story.onTime(this, 1)).catch(e => console.error(e)).finally(() => { this.storyBusy = false; });
      }
      if (this.state.time % 5 === 0) {
        this.state.turn++; this.state.stats.turnos++;
        Story.onTurn(this);
        bus.emit('turn');
      }
      bus.emit('hud');
    },
    rtSecond() {
      const m = this.map;
      // fogo: queima quem estiver em cima e se apaga com o tempo
      if (m.fire.size) {
        for (const [i, t] of [...m.fire]) {
          const x = i % m.W, z = (i / m.W) | 0;
          for (const o of this.units) if (o.alive && o.x === x && o.z === z) { this.damage(o, rng.int(3, 5), null, { noBlood: true }); if (o.kind === 'zombie') o.st.burn = 3; }
          if (t - 0.2 <= 0) m.fire.delete(i); else m.fire.set(i, t - 0.2);
        }
        if (!m.fire.size) this.refreshLights();
      }
      if (m.gas.size) {
        for (const [i, t] of [...m.gas]) {
          const x = i % m.W, z = (i / m.W) | 0;
          for (const o of this.units) if (o.alive && o.kind !== 'zombie' && o.x === x && o.z === z) { this.damage(o, 2, null, { noBlood: true }); if (o.kind === 'hero') { o.need.infeccao = Math.min(100, o.need.infeccao + 2); o.st.infected = true; } }
          if (t - 0.25 <= 0) m.gas.delete(i); else m.gas.set(i, t - 0.25);
        }
      }
      for (const o of this.units) {
        if (!o.alive) continue;
        if (o.st.burn > 0) { o.st.burn--; this.damage(o, rng.int(3, 6), null, { noBlood: true }); if (!o.alive) continue; }
        if (o.st.bleedz > 0 && rng.next() < 0.5) { o.st.bleedz--; this.damage(o, 2, null); if (!o.alive) continue; }
        if (o.kind === 'hero' && o.st.downed) {
          o.st.downed--;
          if (o.st.downed <= 0) this.heroDies(o);
          else if (o.st.downed === 15) this.toast(`${o.name} vai morrer em 15 segundos!`, 'perigo');
        }
      }
      if (this.liveHeroes.length && !this.liveHeroes.some(h => !h.st.downed)) this.gameOver();
    },
    rtRound() {
      for (const h of this.liveHeroes) {
        for (const k of Object.keys(h.cd)) if (h.cd[k] > 0) h.cd[k]--;
        h.st.cmdUsed = false; h.st.stoneStun = false;
        if (h.st.panic) h.st.panic--;
        if (h.st.surto) { h.st.surto--; if (!h.st.surto) h.st.surto = 0; }
        if (h.st.protetor) h.st.protetor--;
        if (h.st.haste) h.st.haste--;
      }
      bus.emit('hud');
    },
    // velocidade de movimento (casas por segundo)
    speedOf(u) {
      if (u.kind === 'zombie') {
        const Z = ZOMBIES[u.type];
        let s = 0.3 * Z.pa;
        if (this.isNight()) s *= 1.15;
        if (this.hour() >= 12 && this.hour() < 15) s *= 0.88;
        return s;
      }
      let s = 2.9 * (0.88 + effStat(u, 'velocidade') * 0.025);
      if (u.kind === 'hero') {
        if (carried(u) > capacity(u)) s *= 0.7;
        if (u.need.infeccao >= 25) s *= 0.9;
        if (u.need.sede < 15) s *= 0.9;
        if (u.st.haste) s *= 1.25;
      }
      return s;
    },

    // ------------------------------------------------------------ corpo e colisão
    cellBlockedFor(u, cx, cz) {
      const m = this.map;
      if (!m.inb(cx, cz)) return true;
      const i = m.idx(cx, cz);
      const s = m.struct[i];
      if (s === S.DOOR || s === S.GATE) {
        const d = m.doors.get(i);
        if (!d) return true;
        if (d.open && !(d.barricade > 0)) return false;
        return true;
      }
      if (s === S.WINDOW) { const w = m.windows.get(i); return !(w && w.broken && !(w.barricade > 0)); }
      return m.blocked(cx, cz);
    },
    bodyBlocked(u, nx, nz) {
      const r = u.kind === 'zombie' ? 0.26 : BODY_R;
      for (let cz = Math.floor(nz - r); cz <= Math.floor(nz + r); cz++) {
        for (let cx = Math.floor(nx - r); cx <= Math.floor(nx + r); cx++) {
          if (!this.cellBlockedFor(u, cx, cz)) continue;
          const qx = clamp(nx, cx, cx + 1), qz = clamp(nz, cz, cz + 1);
          if ((nx - qx) ** 2 + (nz - qz) ** 2 < r * r - 1e-6) return { cell: [cx, cz] };
        }
      }
      for (const o of this.units) {
        if (o === u || !o.alive || o.px === undefined) continue;
        if (Math.abs(o.px - nx) > 0.8 || Math.abs(o.pz - nz) > 0.8) continue;
        // a turma passa uns pelos outros; zumbis se espremem
        const friendly = (u.kind === 'hero' || u.faction === 'ally') && (o.kind === 'hero' || o.faction === 'ally');
        if (friendly) continue;
        const rr = (u.kind === 'zombie' && o.kind === 'zombie') ? 0.38 : 0.55;
        const dNew = Math.hypot(o.px - nx, o.pz - nz);
        if (dNew < rr && dNew < Math.hypot(o.px - u.px, o.pz - u.pz) - 1e-4) return { unit: o };
      }
      return null;
    },
    // anda (dx, dz) em casas, deslizando nas paredes; devolve o que bloqueou (se bloqueou)
    moveBody(u, dx, dz) {
      // passos grandes (quadro lento) viram vários pequenos para não atravessar paredes
      const len = Math.hypot(dx, dz);
      if (len > 0.22) {
        const n = Math.ceil(len / 0.2);
        let hit = null;
        for (let i = 0; i < n; i++) { hit = this.moveBody(u, dx / n, dz / n) || hit; if (!u.alive) break; }
        return hit;
      }
      let hit = this.bodyBlocked(u, u.px + dx, u.pz + dz);
      if (!hit) { u.px += dx; u.pz += dz; }
      else {
        const hx = this.bodyBlocked(u, u.px + dx, u.pz);
        if (!hx && Math.abs(dx) > 1e-4) u.px += dx;
        else {
          const hz = this.bodyBlocked(u, u.px, u.pz + dz);
          if (!hz && Math.abs(dz) > 1e-4) u.pz += dz;
        }
      }
      if (Math.abs(dx) + Math.abs(dz) > 1e-5) u.face = Math.atan2(dx, dz);
      const cx = Math.floor(u.px), cz = Math.floor(u.pz);
      if (cx !== u.x || cz !== u.z) this.rtCell(u, cx, cz);
      return hit;
    },
    rtCell(u, cx, cz) {
      u.x = cx; u.z = cz;
      if (u.kind === 'hero' || u.faction === 'ally') this.visionDirty = true;
      if (u.kind !== 'hero') return;
      if (!u.st.sneak) u.st.hidden = false;
      if (u === this.selected) this.updateCutaway();
      const w = this.map.windows.get(this.map.idx(cx, cz));
      if (w && rng.next() < 0.15) { u.st.bleed = 1; this.log(`${u.name} se cortou no vidro da janela.`, 'alerta'); }
      Story.onEnter(this, u, cx, cz);
      this.checkTrap(u, cx, cz);
    },
    // porta fechada no caminho: abre (se não estiver trancada)
    tryOpenAhead(u, hit) {
      if (!hit || !hit.cell) return false;
      const [cx, cz] = hit.cell;
      const i = this.map.idx(cx, cz);
      // portão construído na base: abre para a turma
      const bp = this.map.prop(cx, cz);
      if (bp && bp.extra && bp.extra.built && PROPS[bp.type].porta && !bp.extra.open && (u.kind === 'hero' || u.faction === 'ally')) {
        bp.extra.open = true; this.S.world.rebuildChunkAt(cx, cz); this.map.version++; bus.emit('sfx', 'door_open', cx, cz); this.visionDirty = true; return true;
      }
      const d = this.map.doors.get(i);
      if (!d || d.open) return false;
      if (d.locked || d.barricade > 0) {
        if (u === this.selected && (this.lockMsgT || 0) < performance.now()) {
          this.lockMsgT = performance.now() + 2500;
          this.toast(d.barricade > 0 ? 'Porta barricada.' : 'Trancada. Use E (ou clique nela) para ver as opções.', 'erro');
        }
        return false;
      }
      d.open = true;
      this.map.version++;
      this.S.world.refreshDoor(i);
      bus.emit('sfx', d.gate ? 'gate' : 'door_open', cx, cz);
      this.noise(cx, cz, d.gate ? 3 : 2, u);
      this.visionDirty = true;
      return true;
    },

    // ------------------------------------------------------------ controle do jogador
    rtControl(u, dt) {
      const inp = this.input;
      if (u.gather) this.gatherTick(u, dt);
      const busy = this.busy > 0 || u.st.stun > 0 || u.gatherT > 0;
      if (u.st.stun > 0) u.st.stun = Math.max(0, u.st.stun - dt / 2);
      let mx = inp.move.x, mz = inp.move.z;
      const manual = Math.hypot(mx, mz) > 0.15;
      if (manual) { this.cancelNav(u, false); u.target = null; if (u.gatherT > 0) this.cancelGather(u); }
      let vx = 0, vz = 0, navDist = Infinity;
      if (!busy && manual) {
        // direções da tela → mundo (a câmera gira)
        const yaw = this.S.yaw, c = Math.cos(yaw), s = Math.sin(yaw);
        const l = Math.min(1, Math.hypot(mx, mz));
        const nx = mx / Math.hypot(mx, mz), nz = mz / Math.hypot(mx, mz);
        vx = (nx * c + nz * s) * l; vz = (-nx * s + nz * c) * l;
      } else if (!busy && u.nav) {
        const st = this.navStep(u);
        if (st) { vx = st[0]; vz = st[1]; navDist = st[2]; }
      }
      // alvo escolhido com clique: chega perto e ataca
      if (!busy && !manual && u.target) this.rtChase(u);
      // ataque segurando Espaço / botão
      if (!busy && inp.attack) this.rtAutoAttack(u);
      const moving = Math.hypot(vx, vz) > 0.05;
      const run = moving && (inp.run || (u.nav && u.nav.run)) && !u.st.sneak;
      let speed = this.speedOf(u) * (run ? 1.55 : u.st.sneak ? 0.55 : 1);
      if (moving) {
        // não passa do ponto do caminho (quadros lentos)
        const k = Math.min(1, (navDist + 0.05) / (speed * dt));
        const hit = this.moveBody(u, vx * speed * dt * k, vz * speed * dt * k);
        if (hit) this.tryOpenAhead(u, hit);
        // barulho dos passos
        u.stepAcc = (u.stepAcc || 0) + speed * dt;
        if (u.stepAcc >= 1) {
          u.stepAcc = 0;
          this.noise(u.x, u.z, run ? (u.hasPerk('pe_leve') ? 2 : 5) : u.st.sneak ? 0.4 : (u.id === 'pablicio' ? 2.2 : 1.3), u);
        }
        if (run) { u.st.ran = true; u.ranT = 1; }
        u.st.hidden = false;
      }
      if (u.ranT > 0) { u.ranT -= dt; if (u.ranT <= 0) u.st.ran = false; }
      u.rtAnim = moving ? (run ? 'run' : u.st.sneak ? 'sneak' : 'walk') : (u.st.sneak ? 'crouch' : null);
    },

    // ------------------------------------------------------------ navegação por caminho
    // vai até (x, z) — ou até ficar ao lado, com { adjacent: true } — e avisa quando chegar
    rtGoto(u, x, z, opts = {}) {
      this.cancelNav(u, false);
      const path = this.pathTo(u, x, z, { goalAdjacent: !!opts.adjacent });
      if (!path) { if (u === this.selected && !opts.quiet) this.toast('Não dá para chegar lá.', 'erro'); return Promise.resolve(false); }
      if (!path.length) return Promise.resolve(true);
      return new Promise(res => { u.nav = { path, i: 0, x, z, adjacent: !!opts.adjacent, until: opts.until, run: opts.run, res, stuck: 0, repath: 0 }; });
    },
    cancelNav(u, ok = false) {
      if (!u.nav) return;
      const r = u.nav.res; u.nav = null;
      if (r) r(ok);
    },
    // direção para o próximo ponto do caminho (vetor unitário) ou null
    navStep(u) {
      const n = u.nav;
      if (n.until && n.until()) { this.cancelNav(u, true); return null; }
      if (n.i >= n.path.length) { this.cancelNav(u, true); return null; }
      const [cx, cz] = n.path[n.i];
      const tx = cx + 0.5, tz = cz + 0.5;
      const dx = tx - u.px, dz = tz - u.pz, d = Math.hypot(dx, dz);
      if (d < 0.18) {
        n.i++;
        if (n.i >= n.path.length) { this.cancelNav(u, true); return null; }
        return this.navStep(u);
      }
      // travado? recalcula o caminho uma vez, depois desiste
      const moved = Math.hypot(u.px - (n.lx ?? u.px), u.pz - (n.lz ?? u.pz));
      n.lx = u.px; n.lz = u.pz;
      if (moved < 0.002) n.stuck++; else n.stuck = 0;
      if (n.stuck > 25) {
        if (n.repath++ < 2) {
          const p = this.pathTo(u, n.x, n.z, { goalAdjacent: n.adjacent });
          if (p && p.length) { n.path = p; n.i = 0; n.stuck = 0; return null; }
        }
        this.cancelNav(u, false);
        return null;
      }
      return [dx / d, dz / d, d];
    },
    // ações pedem para chegar perto de algo: anda até lá (a qualquer distância)
    async approach(u, x, z) {
      if (Math.max(Math.abs(u.x - x), Math.abs(u.z - z)) <= 1) return true;
      if (!this.can(u, 0)) return false;
      await this.rtGoto(u, x, z, { adjacent: true });
      return Math.max(Math.abs(u.x - x), Math.abs(u.z - z)) <= 1 && this.phase === 'player';
    },
    async walkTo(u, tx, tz, opts = {}) {
      if (!this.can(u, 0)) return;
      if (u.target) u.target = null;
      await this.rtGoto(u, tx, tz, { adjacent: !!opts.adjacent, run: opts.run ?? this.input.run });
    },

    // ------------------------------------------------------------ combate do jogador
    atkCooldown(u, w) {
      let cd = 0.2 + (w.pa || 2) * 0.22;
      if (u.st && u.st.surto) cd *= 0.7;
      if (u.st && u.st.haste) cd *= 0.8;
      return cd;
    },
    reachOf(w) { return w.tipo === 'corpo' ? 1.25 + ((w.alcance || 1) > 1 ? 1 : 0) : (w.alcance || 6) + 0.5; },
    rtInRange(u, t, w) {
      const d = dist2(u, t);
      if (d > this.reachOf(w)) return false;
      return w.tipo === 'corpo' ? true : los(this.map, u.x, u.z, t.x, t.z);
    },
    // inimigo mais perto que dá para acertar (ou o mais perto à vista)
    nearestEnemy(u, maxD = 99, needRange = null) {
      let best = null, bd = 1e9;
      for (const o of this.units) {
        if (!o.alive || !this.hostile(o) || !this.unitVisible(o)) continue;
        const d = dist2(u, o);
        if (d > maxD) continue;
        if (needRange && !this.rtInRange(u, o, needRange)) continue;
        // prefere quem está na frente
        const ang = Math.atan2(o.px - u.px, o.pz - u.pz) - (u.face || 0);
        const front = Math.cos(ang) > 0.3 ? 0 : 0.6;
        if (d + front < bd) { bd = d + front; best = o; }
      }
      return best;
    },
    rtAutoAttack(u) {
      if (u.atkCd > 0 || u.gatherT > 0) return;
      const w = u.weaponStats();
      const t = (u.target && u.target.alive && this.rtInRange(u, u.target, w)) ? u.target : this.nearestEnemy(u, 12, w);
      if (t) { this.rtStrike(u, t); return; }
      // golpe no ar (dá retorno ao apertar)
      if (w.tipo === 'corpo') { u.atkCd = this.atkCooldown(u, w); this.S.units.play(u, 'attack'); }
    },
    // alvo escolhido com clique: vai até ele e ataca até cair
    rtChase(u) {
      const t = u.target;
      if (!t || !t.alive) { u.target = null; return; }
      const w = u.weaponStats();
      if (this.rtInRange(u, t, w)) {
        if (u.nav) this.cancelNav(u, true);
        if (u.atkCd <= 0) this.rtStrike(u, t);
        return;
      }
      if (!u.nav || (u.nav.tx !== t.x || u.nav.tz !== t.z)) {
        const n = this.rtGoto(u, t.x, t.z, { adjacent: true, quiet: true, until: () => !t.alive || this.rtInRange(u, t, w) });
        if (u.nav) { u.nav.tx = t.x; u.nav.tz = t.z; }
        n.then(ok => { if (!ok && u.target === t && !u.nav && !this.rtInRange(u, t, w)) u.target = null; });
      }
    },
    rtStrike(u, t) {
      const w = u.weaponStats();
      const it = u.weapon();
      const view = this.S.units;
      if (w.tipo === 'arremesso') { u.target = null; this.throwAt(u, t.x, t.z); u.atkCd = 1; return; }
      if (w.tipo === 'distancia') {
        if (w.classe === 'sling') {
          if (it && it.id === 'estilingue' && countItem(u, 'pedrinhas') <= 0) { this.toastOnce('Sem pedrinhas para o estilingue.'); u.atkCd = 0.6; return; }
        } else if (w.pente > 0 && (u.eq.mao.loaded || 0) <= 0) {
          if (countItem(u, w.municao) > 0) this.rtReload(u);
          else this.toastOnce('Sem munição!');
          u.atkCd = 0.6;
          return;
        }
      }
      u.atkCd = this.atkCooldown(u, w);
      u.face = Math.atan2(t.px - u.px, t.pz - u.pz);
      u.st.hidden = false;
      const ch = hitChance(this, u, t, w);
      const melee = w.tipo === 'corpo';
      view.play(u, melee ? 'attack' : 'shoot');
      if (!melee) {
        if (w.classe === 'sling') { if (it && it.id === 'estilingue') removeItem(u, 'pedrinhas', 1); view.projectile(u.x, u.z, t.x, t.z, it && it.id === 'chinelo' ? '#c93b33' : '#9a9a9a', 0.4, 0.2); }
        else { u.eq.mao.loaded--; view.tracer(u.x, u.z, t.x, t.z); view.burst(u.x, u.z, '#ffd23a', 1.2); this.S.shake = 0.12; }
      }
      this.noise(u.x, u.z, w.ruido || 2, u);
      this.later(melee ? 0.16 : 0.12, () => {
        if (!t.alive || !u.alive || u.st.downed) return;
        if (melee && dist2(u, t) > this.reachOf(w) + 0.4) { view.floatText(t.x, t.z, 'Errou!', 'miss'); return; }
        if (rng.next() * 100 < ch) {
          const r = rollDamage(this, u, t, w, {});
          if (r.sneak) { this.log(`🗡️ Ataque surpresa de <b>${u.name}</b>!`, 'bom'); view.floatText(t.x, t.z, 'SURPRESA!', 'crit'); }
          this.damage(t, r.dmg, u, r);
          if (t.alive && w.atordoar && (rng.next() < w.atordoar || (w.classe === 'sling' && u.skill('estilingada') >= 2 && !u.st.stoneStun))) { t.st.stun = 1.5; u.st.stoneStun = true; view.floatText(t.x, t.z, 'Atordoado!', 'miss'); }
          if (t.alive && w.sangrar && rng.next() < w.sangrar && t.kind !== 'hero') t.st.bleedz = 4;
          if (t.alive && w.empurrar) this.knockback(t, u, 0.9);
          if (t.alive && w.assusta && t.kind === 'npc') { t.st.stun = 2; view.say(t, 'Ai! O chinelo não!'); }
          if (w.espalhar) for (const o of this.units) if (o !== t && o.alive && o !== u && this.hostile(o) && dist2(o, t) <= 1.5 && rng.next() < 0.5) this.damage(o, Math.round(r.dmg * 0.5), u);
          if (!t.alive) this.log(`✅ <b>${u.name}</b> derrubou ${t.name}.`, 'bom');
        } else view.floatText(t.x, t.z, 'Errou!', 'miss');
        if (t.kind === 'zombie' && t.alive) { t.ai.state = 'hunt'; t.ai.target = u.uid; t.ai.last = [u.x, u.z]; }
        // durabilidade das armas brancas
        if (melee && u.eq.mao && u.eq.mao.dur !== undefined) {
          u.eq.mao.dur -= u.skill('mao_na_graxa') >= 2 ? 0.5 : 1;
          if (u.eq.mao.dur <= 0) { this.log(`💔 ${ITEMS[u.eq.mao.id].nome} de ${u.name} quebrou!`, 'alerta'); this.toast(`${ITEMS[u.eq.mao.id].nome} quebrou!`, 'erro'); u.eq.mao = null; }
        }
        bus.emit('hud');
      });
    },
    rtReload(u) {
      const it = u.weapon();
      if (!it || !it.w || !it.w.pente || it.w.pente <= 1 || u.reloading) return;
      const e = u.eq.mao;
      const need = it.w.pente - (e.loaded || 0), have = countItem(u, it.w.municao);
      if (need <= 0 || have <= 0) return;
      u.reloading = true;
      this.S.units.play(u, 'interact');
      this.toast(`🔄 ${u.name} recarregando...`);
      this.later(0.6 + (it.w.recarga || 2) * 0.35, () => {
        u.reloading = false;
        if (!u.alive || u.eq.mao !== e) return;
        const n = Math.min(it.w.pente - (e.loaded || 0), countItem(u, it.w.municao));
        removeItem(u, it.w.municao, n);
        e.loaded = (e.loaded || 0) + n;
        u.atkCd = Math.max(u.atkCd, 0.1);
        bus.emit('hud');
      });
    },
    // empurrão: joga o alvo para trás
    knockback(t, from, d = 1) {
      const a = Math.atan2(t.px - from.px, t.pz - from.pz);
      const steps = 6;
      for (let i = 0; i < steps; i++) this.moveBody(t, Math.sin(a) * d / steps, Math.cos(a) * d / steps);
      this.S.units.floatText(t.x, t.z, 'Empurrão!', 'miss');
    },
    toastOnce(msg) {
      const now = performance.now();
      if (this.lastToastMsg === msg && now - (this.lastToastT || 0) < 2500) return;
      this.lastToastMsg = msg; this.lastToastT = now;
      this.toast(msg, 'erro');
    },

    // ------------------------------------------------------------ interagir (tecla E / botão ✋)
    rtInteract(u) {
      if (!u || !this.can(u, 0)) return;
      const cells = [];
      const fx = Math.round(Math.sin(u.face || 0)), fz = Math.round(Math.cos(u.face || 0));
      cells.push([u.x + fx, u.z + fz], [u.x, u.z]);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) cells.push([u.x + dx, u.z + dz]);
      const skip = /^(Andar|Correr) até aqui|^Examinar|^Atacar/;
      for (const [x, z] of cells) {
        const unit = this.unitAt(x, z);
        const target = unit && unit !== u && !this.hostile(unit) && unit.kind !== 'hero' ? unit : null;
        if (unit && unit !== u && unit.kind === 'hero' && !unit.st.downed) continue;
        const opts = this.optionsAt(u, x, z, target || (unit && unit.kind === 'hero' && unit.st.downed ? unit : null));
        const o = opts.find(o => !o.disabled && !o.danger && !skip.test(o.label));
        if (o) { o.fn(); return; }
      }
      this.toastOnce('Nada para usar aqui perto.');
    },
  });
}
