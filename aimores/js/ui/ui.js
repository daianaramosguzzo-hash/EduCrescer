// Controlador da interface: entrada (mouse, teclado, toque), prévia de caminho, menu de contexto,
// diálogos, janelas, introdução, finais e fim de jogo.
import { $, h, portraitOf, lookPortrait } from './common.js';
import { Hud } from './hud.js';
import { Panels } from './panels.js';
import { HEROES } from '../data/heroes.js';
import { ITEMS } from '../data/items.js';
import { QUESTS } from '../data/quests.js';
import { ZOMBIES } from '../data/zombies.js';
import { PROPS, S } from '../world/tiles.js';
import { hitChance, inRange } from '../game/combat.js';
import { bus, clamp, wait } from '../util.js';
import * as Save from '../game/save.js';
import * as Story from '../game/story.js';

const OPTS_KEY = 'aimores-dos-mortos-opcoes';

export class UI {
  constructor(game, scene) {
    this.g = game; this.S = scene;
    this.opts = Object.assign({ musica: true, sons: true, speed: 1, follow: true, banter: true, qualidade: 'alta' }, this.loadOpts());
    this.hud = new Hud(game, this);
    this.panels = new Panels(game, this);
    this.mode = null;
    this.hoverCell = null;
    this.dialogOpen = false;
    this.keys = new Set();
    this.bindBus();
    this.bindInput();
  }
  loadOpts() { try { return JSON.parse(localStorage.getItem(OPTS_KEY) || '{}'); } catch (_) { return {}; } }
  saveOpts() { try { localStorage.setItem(OPTS_KEY, JSON.stringify(this.opts)); } catch (_) {} this.applyOpts(); }
  applyOpts() {
    this.g.speed = this.opts.speed || 1;
    this.S.renderer.shadowMap.enabled = this.opts.qualidade !== 'baixa';
    this.S.sun.castShadow = this.opts.qualidade !== 'baixa';
    bus.emit('audio-opts', this.opts);
  }
  toast(msg, cls) { this.hud.toast(msg, cls); }
  open(name, ...args) {
    if (this.dialogOpen) return;
    this.hideCtx();
    const map = { inv: 'inv', char: 'char', journal: 'journal', map: 'map', save: 'save', menu: 'menu', craft: 'craft', help: 'help' };
    const fn = map[name];
    if (!fn) return;
    if (this.panels.cur === fn) { this.panels.close(); return; }
    this.panels[fn](...args);
  }
  setMode(m) {
    this.mode = this.mode === m ? null : m;
    if (this.mode === 'attack') this.toast('Clique no inimigo para atacar (clique direito cancela).');
    if (this.mode && this.mode.startsWith('skill:')) this.toast('Clique num aliado para dar a ordem.');
    this.hud.dirty = true;
    this.refreshHover();
  }

  // ------------------------------------------------------------ eventos do jogo
  bindBus() {
    bus.on('dialog', (d, res) => this.showDialog(d, res));
    bus.on('loot', ({ source, hero, stash }) => this.panels.loot(source, hero, stash));
    bus.on('trade', (npc, hero, done) => this.panels.trade(npc, hero, done));
    bus.on('craft', (u, stove) => this.panels.craft(u, stove));
    bus.on('inventory', (u, target) => this.panels.inv(u, target));
    bus.on('confirm', (msg, fn) => this.panels.confirm(msg, fn));
    bus.on('note', it => { if (!this.dialogOpen) this.panels.note(it); });
    bus.on('fade', on => $('#fade').classList.toggle('on', !!on));
    bus.on('hud', () => { this.rangeDirty = true; if (this.panels.cur && ['inv', 'loot', 'char'].includes(this.panels.cur) && !this.g.busy) { /* janelas se atualizam nas próprias ações */ } });
    bus.on('select', () => { this.rangeDirty = true; this.mode = null; });
    bus.on('turn', () => { this.rangeDirty = true; this.autosaveCheck(); });
    bus.on('quest', q => { if (q.tipo === 'fim') this.autosave(); });
    bus.on('weather', w => $('#rain').classList.toggle('hidden', w !== 'chuva'));
    bus.on('gameover', () => this.gameOver());
    bus.on('ending', kind => this.ending(kind));
    bus.on('intro', () => { this.pendingIntro = true; });
    bus.on('place', name => this.toast(`📍 ${name}`));
  }
  autosaveCheck() {
    const d = this.g.day(), hh = this.g.hour();
    const key = `${d}-${hh >= 6 && hh < 12 ? 'm' : hh < 18 ? 't' : 'n'}`;
    if (this.lastAuto !== key && this.g.state.mode === 'explore') { this.lastAuto = key; this.autosave(); }
  }
  autosave() { if (this.g.phase !== 'over') Save.save(this.g, 'auto'); }

  // ------------------------------------------------------------ diálogos
  showDialog({ speaker, text, choices }, res) {
    this.dialogOpen = true;
    this.hideCtx(); this.hideTip();
    const d = $('#dialog');
    d.innerHTML = '';
    d.classList.remove('hidden');
    d.classList.toggle('narr', !!speaker.narr);
    if (!speaker.narr) {
      const pic = speaker.retrato || (speaker.look ? lookPortrait(speaker.look) : null);
      d.append(h('div', { class: 'who', style: { backgroundImage: pic ? `url(${pic})` : 'none', borderColor: speaker.cor || null } }, pic ? null : h('div', { style: { fontSize: '60px', textAlign: 'center', lineHeight: '120px' } }, '📻')));
    }
    const col = h('div');
    if (speaker.nome) col.append(h('div', { class: 'nm', style: { color: speaker.cor || '#f4c534' } }, speaker.nome));
    col.append(h('div', { class: 'tx', html: text }));
    const finish = (i) => {
      d.classList.add('hidden'); d.innerHTML = '';
      this.dialogOpen = false;
      document.removeEventListener('keydown', onKey, true);
      res(i);
    };
    const onKey = (e) => {
      if (!choices.length && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); e.stopPropagation(); finish(0); }
      const n = parseInt(e.key, 10);
      if (choices.length && n >= 1 && n <= choices.length) { e.preventDefault(); e.stopPropagation(); finish(n - 1); }
    };
    if (choices.length) {
      const ch = h('div', { class: 'ch' });
      choices.forEach((c, i) => ch.append(h('button', { onclick: () => finish(i), html: `<span class="num">${i + 1}.</span>${c}` })));
      col.append(ch);
    } else {
      col.append(h('div', { class: 'cont' }, 'Clique ou aperte Espaço para continuar ▶'));
      d.onclick = () => finish(0);
    }
    if (choices.length) d.onclick = null;
    d.append(col);
    setTimeout(() => document.addEventListener('keydown', onKey, true), 60);
  }

  // ------------------------------------------------------------ entrada
  bindInput() {
    const cv = this.S.canvas;
    const pointers = new Map();
    let drag = null, pinch = null, longT = null;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.hideCtx();
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.S.zoomGoal };
        drag = null; clearTimeout(longT);
        return;
      }
      drag = { x: e.clientX, y: e.clientY, button: e.button, moved: false, type: e.pointerType };
      if (e.pointerType === 'touch') longT = setTimeout(() => { if (drag && !drag.moved) { drag.long = true; this.openCtxAt(e.clientX, e.clientY); } }, 520);
    });
    cv.addEventListener('pointermove', e => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.S.zoomGoal = clamp(pinch.zoom * d / pinch.d, 0.55, 2.8);
        return;
      }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        const thr = drag.type === 'touch' ? 10 : 6;
        if (!drag.moved && Math.hypot(dx, dy) > thr && (drag.button === 1 || drag.button === 0)) { drag.moved = true; clearTimeout(longT); }
        if (drag.moved) {
          const k = (20 / this.S.zoom) / this.S.canvas.clientHeight;
          this.S.pan(-dx * k * 1.0, -dy * k / Math.sin(35 * Math.PI / 180) * 0.82);
          drag.x = e.clientX; drag.y = e.clientY;
          this.userPanned = true;
          return;
        }
      }
      if (e.pointerType !== 'touch') this.onHover(e.clientX, e.clientY);
    });
    const up = e => {
      pointers.delete(e.pointerId);
      clearTimeout(longT);
      if (pinch) { if (pointers.size < 2) pinch = null; drag = null; return; }
      if (!drag) return;
      const d = drag; drag = null;
      if (d.moved || d.long) return;
      if (d.button === 2) { this.openCtxAt(e.clientX, e.clientY); return; }
      if (d.button === 0) this.onClick(e.clientX, e.clientY, e.pointerType === 'touch');
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); drag = null; pinch = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); this.S.zoomBy(e.deltaY > 0 ? 0.88 : 1.13); }, { passive: false });
    cv.addEventListener('pointerleave', () => this.hideTip());
    window.addEventListener('keydown', e => this.onKey(e));
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    for (const b of document.querySelectorAll('#cam-btns button')) b.addEventListener('click', () => {
      const a = b.dataset.cam;
      if (a === 'rotl') this.S.rotate(-1); if (a === 'rotr') this.S.rotate(1);
      if (a === 'zin') this.S.zoomBy(1.2); if (a === 'zout') this.S.zoomBy(0.83);
      if (a === 'cut') { this.g.cutAll = !this.g.cutAll; b.classList.toggle('on', this.g.cutAll); this.g.updateCutaway(); }
    });
    for (const b of document.querySelectorAll('#mini-btns button')) b.addEventListener('click', () => this.open(b.dataset.ui));
  }
  onKey(e) {
    const k = e.key.toLowerCase();
    if (this.dialogOpen) return;
    if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const g = this.g;
    if (!g.state || g.phase === 'none') return;
    if (k === 'escape') { if (this.ctxOpen) this.hideCtx(); else if (this.mode) this.setMode(null); else if (this.panels.cur) this.panels.close(); else this.open('menu'); return; }
    if (k === 'f5') { e.preventDefault(); if (Save.save(g, 1)) this.toast('Salvo no espaço 1.', 'bom'); return; }
    if (k === 'f9') { e.preventDefault(); if (Save.meta(1)) this.loadGame(1); return; }
    if (this.panels.cur) {
      const map = { i: 'inv', c: 'char', j: 'journal', m: 'map', b: 'craft' };
      if (map[k] && this.panels.cur === map[k]) this.panels.close();
      return;
    }
    this.keys.add(k);
    const u = g.selected;
    if (['1', '2', '3', '4'].includes(k)) { const hh = g.heroes[+k - 1]; if (hh && !hh.dead) g.select(hh); return; }
    switch (k) {
      case 'tab': e.preventDefault(); g.selectNext(e.shiftKey ? -1 : 1); break;
      case 'enter': case 't': g.endTurn(); break;
      case 'q': this.S.rotate(-1); break;
      case 'e': this.S.rotate(1); break;
      case ' ': e.preventDefault(); if (u) this.S.focus(u.x + 0.5, u.z + 0.5); this.userPanned = false; break;
      case 'shift': g.input.run = !g.input.run; this.hud.dirty = true; this.refreshHover(); break;
      case 'i': this.open('inv'); break;
      case 'c': this.open('char'); break;
      case 'j': this.open('journal'); break;
      case 'm': this.open('map'); break;
      case 'b': this.open('craft'); break;
      case 'a': this.setMode('attack'); break;
      case 'g': if (u) g.aim(u); break;
      case 'x': if (u) g.defend(u); break;
      case 'h': if (u) g.hide(u); break;
      case 'r': if (u) g.reload(u); break;
      case 'f': if (u) g.toggleFlashlight(u); break;
      case 'v': { g.cutAll = !g.cutAll; document.querySelector('[data-cam=cut]').classList.toggle('on', g.cutAll); g.updateCutaway(); break; }
      case '+': case '=': this.S.zoomBy(1.15); break;
      case '-': this.S.zoomBy(0.87); break;
    }
  }
  // câmera por teclado (chamado a cada quadro)
  updateKeysCamera(dt) {
    if (this.dialogOpen || this.panels.cur) return;
    let dx = 0, dz = 0;
    const K = this.keys;
    if (K.has('w') || K.has('arrowup')) dz -= 1;
    if (K.has('s') || K.has('arrowdown')) dz += 1;
    if (K.has('a') && false) dx -= 1;
    if (K.has('arrowleft')) dx -= 1;
    if (K.has('d') || K.has('arrowright')) dx += 1;
    if (dx || dz) { const sp = 16 / this.S.zoom * dt; this.S.pan(dx * sp, dz * sp); this.userPanned = true; }
  }

  // ------------------------------------------------------------ clique e prévia
  pickAt(cx, cy) { return this.S.pick(cx, cy); }
  onClick(cx, cy, touch = false) {
    const g = this.g;
    if (this.dialogOpen || this.panels.cur || !g.state || g.phase !== 'player' || g.busy) return;
    const { unit, cell } = this.pickAt(cx, cy);
    if (!cell) return;
    const u = g.selected;
    if (!u) return;
    if (touch && (!this.touchSel || this.touchSel.x !== cell.x || this.touchSel.z !== cell.z || this.touchSel.unit !== unit)) {
      // no toque: primeiro toque mostra a prévia, o segundo confirma
      this.touchSel = { x: cell.x, z: cell.z, unit };
      this.onHover(cx, cy);
      return;
    }
    this.touchSel = null;
    if (this.mode === 'attack') {
      this.setMode(null);
      if (unit && g.hostile(unit)) { g.attack(u, unit); return; }
    }
    if (this.mode && this.mode.startsWith('skill:')) {
      const sid = this.mode.slice(6);
      this.setMode(null);
      if (unit && unit.kind === 'hero') { g.useSkill(u, sid, unit); return; }
      return;
    }
    if (unit && unit.kind === 'hero' && unit !== u && !unit.st.downed) { g.select(unit); return; }
    if (cell.x === u.x && cell.z === u.z && !unit) { this.openCtxAt(cx, cy); return; }
    const opts = g.optionsAt(u, cell.x, cell.z, unit);
    const first = opts.find(o => !o.disabled && !o.danger) || opts.find(o => !o.disabled);
    if (!first) return;
    if (first.danger && first.label.startsWith('Atacar') && unit && !g.hostile(unit)) { this.openCtxAt(cx, cy); return; }
    this.hideTip();
    first.fn();
  }
  openCtxAt(cx, cy) {
    const g = this.g;
    if (this.dialogOpen || this.panels.cur || !g.state || g.phase !== 'player' || g.busy) return;
    const { unit, cell } = this.pickAt(cx, cy);
    const u = g.selected;
    if (!cell || !u) return;
    if (this.mode) { this.setMode(null); return; }
    const opts = g.optionsAt(u, cell.x, cell.z, unit);
    if (!opts.length) return;
    const m = $('#ctxmenu');
    m.innerHTML = '';
    for (const o of opts) {
      m.append(h('button', { class: o.danger ? 'danger' : '', disabled: o.disabled, onclick: () => { this.hideCtx(); o.fn(); } },
        h('span', {}, o.label)));
    }
    m.classList.remove('hidden');
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(cx, innerWidth - r.width - 8) + 'px';
    m.style.top = Math.min(cy, innerHeight - r.height - 8) + 'px';
    this.ctxOpen = true;
    this.hideTip();
  }
  hideCtx() { $('#ctxmenu').classList.add('hidden'); this.ctxOpen = false; }
  hideTip() { $('#tooltip').classList.add('hidden'); this.S.showPath([]); this.S.showCursor(null); this.S.showTarget(null); }
  refreshHover() { if (this.lastMouse) this.onHover(this.lastMouse[0], this.lastMouse[1]); }
  onHover(cx, cy) {
    this.lastMouse = [cx, cy];
    const g = this.g;
    const tip = $('#tooltip');
    if (this.dialogOpen || this.panels.cur || this.ctxOpen || !g.state || !g.selected) { this.hideTip(); return; }
    const { unit, cell } = this.pickAt(cx, cy);
    if (!cell || !g.map.inb(cell.x, cell.z)) { this.hideTip(); return; }
    const u = g.selected;
    const lines = [];
    const i = g.map.idx(cell.x, cell.z);
    const known = g.map.explored[i];
    const visible = g.visible.has(i);
    this.S.showTarget(null);
    let pathDots = [];
    let curColor = '#ffffff';
    if (!known) { this.hideTip(); this.S.showCursor(cell.x, cell.z, '#555', 0); return; }
    // passar o mouse sobre um prédio conhecido mostra o lado de dentro
    const hb = g.map.buildingAt(cell.x, cell.z);
    const hid = hb ? hb.id : null;
    if (hid !== this.hoverB) { this.hoverB = hid; clearTimeout(this.hoverT); this.hoverT = setTimeout(() => { g.hoverBuilding = this.hoverB; g.updateCutaway(); }, hid === null ? 350 : 220); }
    const vu = unit && (unit.kind === 'hero' || g.unitVisible(unit)) ? unit : null;
    if (vu && vu !== u) {
      if (g.hostile(vu)) {
        const w = u.weaponStats();
        const ch = hitChance(g, u, vu, w);
        const rng = inRange(g, u, vu, w);
        const Z = vu.kind === 'zombie' ? ZOMBIES[vu.type] : null;
        const state = vu.kind === 'zombie' ? (vu.ai.state === 'hunt' ? '<span class="bad">caçando vocês</span>' : vu.ai.state === 'investigate' ? 'desconfiado' : 'distraído (ataque surpresa!)') : 'hostil';
        lines.push(`<div class="h">${vu.name}</div>`, `❤ ${Math.max(0, Math.round(vu.hp))}/${vu.maxHp} · ${state}`);
        if (Z) lines.push(`<small>${Z.desc}</small>`);
        lines.push(`Chance de acerto: <span class="ap">${ch}%</span> · dano ${w.dano[0]}–${w.dano[1]}${w.tipo !== 'corpo' && !rng ? ' <span class="bad">(fora de alcance)</span>' : ''}`);
        this.S.showTarget(vu.x, vu.z, '#ff4040');
        curColor = '#ff4040';
      } else {
        lines.push(`<div class="h">${vu.name}</div>`);
        if (vu.kind === 'hero') lines.push(`❤ ${Math.round(vu.hp)}/${vu.maxHp}${vu.st.downed ? ' · <span class="bad">caiu! precisa de ajuda</span>' : ''}`);
        else lines.push(vu.faction === 'ally' ? 'Aliado — segue o grupo' : 'Clique para conversar');
        this.S.showTarget(vu.x, vu.z, vu.kind === 'hero' ? '#4aff8a' : '#ffe04a');
        curColor = '#ffe04a';
      }
    } else {
      const b = g.map.buildingAt(cell.x, cell.z);
      const room = g.map.roomAt(cell.x, cell.z);
      const p = g.map.prop(cell.x, cell.z);
      const s = g.map.struct[i];
      let head = room && !room.out && b ? `${b.name} — ${room.nome}` : b ? b.name : room ? room.nome : g.map.floorName(cell.x, cell.z);
      if (p) head = p.nome;
      if (s === S.DOOR || s === S.GATE) { const d = g.map.doors.get(i); head = `${d.gate ? 'Portão' : 'Porta'} ${d.barricade ? 'barricada' : d.locked ? 'trancada' : d.open ? 'aberta' : 'fechada'}`; }
      if (s === S.WINDOW) { const w = g.map.windows.get(i); head = w.broken ? 'Janela quebrada (dá para pular)' : 'Janela'; }
      lines.push(`<div class="h">${head}</div>`);
      if (p && PROPS[p.type].lootChance !== undefined) lines.push(p.locked ? '🔒 Trancado' : p.searched ? (p.loot && p.loot.length ? `Já vasculhado — ainda tem ${p.loot.length} item(ns)` : 'Já vasculhado') : 'Pode ter algo útil');
      const pile = g.map.pileAt(cell.x, cell.z);
      if (pile && pile.length) lines.push(`📦 Itens no chão: ${pile.map(e => ITEMS[e.id].nome).slice(0, 3).join(', ')}${pile.length > 3 ? '...' : ''}`);
      if (!visible) lines.push('<small>(fora da vista)</small>');
      else if (g.isNight()) lines.push(g.lightLevel(cell.x, cell.z) > 0.3 ? '<small>💡 iluminado</small>' : '<small>🌑 escuro</small>');
      // caminho
      if (!g.map.blocked(cell.x, cell.z) && !(cell.x === u.x && cell.z === u.z) && g.phase === 'player' && !g.busy) {
        const path = g.pathTo(u, cell.x, cell.z);
        if (path) {
          const cost = g.moveCost(u, path, g.input.run);
          const dotColor = g.input.run ? '#ffb040' : '#8aff5a';
          for (const [x, z] of path) pathDots.push({ x, z, color: dotColor });
          lines.push(`${g.input.run ? '🏃 Correr' : '🚶 Andar'} até aqui <small>(${path.length} casa${path.length > 1 ? 's' : ''})</small>`);
          if (g.state.mode === 'combat' && cost > u.ap) lines.push('<small>⚠️ Longe: os zumbis vão agir enquanto você anda.</small>');
          curColor = dotColor;
        } else { lines.push('<span class="bad">Sem caminho</span>'); curColor = '#ff5a5a'; }
      } else {
        const opts = g.optionsAt(u, cell.x, cell.z, null);
        if (opts[0] && !(cell.x === u.x && cell.z === u.z)) lines.push(`🖱️ ${opts[0].label}`);
        if (opts.length > 1) lines.push('<small>Clique direito: mais opções</small>');
      }
    }
    if (this.mode === 'attack') lines.push('<span class="ap">⚔️ Modo ataque</span>');
    this.S.showPath(pathDots);
    this.S.showCursor(cell.x, cell.z, curColor, 0);
    tip.innerHTML = lines.join('<br>');
    tip.classList.remove('hidden');
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(cx + 18, innerWidth - r.width - 6) + 'px';
    tip.style.top = Math.min(cy + 18, innerHeight - r.height - 6) + 'px';
  }
  // alcance de movimento do personagem selecionado
  updateRange() {
    const g = this.g;
    if (!this.rangeDirty) return;
    this.rangeDirty = false;
    // sem Pontos de Ação não há "alcance do turno" para desenhar
    this.S.showRange([]);
  }
  // pontos de objetivo (minimapa e mapa)
  objectivePoints() {
    const g = this.g;
    if (!g.state) return [];
    const M = g.map.marks;
    const pts = [];
    const T = {
      'escola.ir': [32, 12], 'escola.biblioteca': M.escola_biblioteca?.[0], 'escola.decidir': M.escola_biblioteca?.[0], 'escola.escoltar': [63, 34],
      'origem.graca': M.graca?.[0], 'origem.casa_livia': M.casa_livia?.[0], 'origem.estacao': M.livia?.[0],
      'agronova.entrar': M.agronova_portao?.[0], 'agronova.provas': M.soro?.[0],
      'insulina.achar': [32, 34], 'insulina.entregar': M.casa_prepper?.[0], 'gato.achar': M.casa_infestada?.[0], 'gato.devolver': M.cotinha?.[0],
      'caderneta.achar': [7, 31], 'caderneta.devolver': M.ze?.[0], 'lobos.resolver': M.tonhao?.[0], 'juninho.convencer': M.juninho?.[0], 'juninho.bateria': [63, 80],
      'valdir.remedio': M.valdir?.[0], 'pamonheiro.derrotar': M.praca?.[0], 'oliveira.comida': M.oliveira?.[0], 'resgate.campinho': M.campinho?.[0],
      'mantimentos.estocar': [32, 37], 'prologo.radio': [9, 18], 'prologo.explorar': [8, 16], 'defesa.defender': [63, 36],
    };
    for (const [id, s] of Object.entries(g.state.quests)) {
      if (s.done || s.failed) continue;
      const step = QUESTS[id].passos[s.step]?.id;
      const p = T[id + '.' + step];
      if (p) pts.push(p);
      if (id === 'fuga') { pts.push([57, 63], [27, 84], [113, 35]); }
    }
    return pts;
  }

  // ------------------------------------------------------------ fluxo
  loadGame(slot) { bus.emit('load-game', slot); }
  toTitle() { bus.emit('to-title'); }
  async intro() {
    const g = this.g;
    await Story.scene(g, [
      ['narr', '🔥 <b>Aimorés, Minas Gerais.</b> A cidade mais quente do Vale do Rio Doce, onde o trem passa, o rio corre e a pamonha é sagrada.'],
      ['narr', 'Numa manhã de terça-feira, a TV só mostrava chiado. Os cachorros não latiam. E o Seu Lindomar, o vizinho, estava mastigando a roseira.'],
      ['daiana', 'Turma, acorda. Tem alguma coisa muito errada lá fora.'],
      ['pablicio', 'Se for o que eu tô pensando, eu vou ficar MUITO nervoso.'],
      ['arthur', 'É exatamente o que você tá pensando.'],
      ['carol', 'Calma. Primeiro a gente se junta. Depois a gente pensa. E todo mundo bebe água.'],
      ['narr', '💡 <b>Como jogar:</b> escolha qualquer personagem (clique no retrato ou use <b>1–4</b>) e clique no chão para andar até onde quiser. Clique nos móveis para vasculhar e nos zumbis para atacar. O <b>clique direito</b> mostra todas as opções. Enquanto vocês agem, o tempo passa e os zumbis também se mexem. Use <b>⏳ Esperar</b> para deixar o tempo correr.'],
    ], {});
  }
  async gameOver() {
    await wait(1500);
    const body = h('div', { class: 'ending' },
      h('h1', {}, 'Fim de jogo'),
      h('div', { class: 'story' }, 'A turma caiu. Em Aimorés, os mortos continuam andando pela Avenida Rio Doce, e o calor não dá trégua. Talvez, em outra história, as escolhas tivessem sido outras...'),
      h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center' } },
        Save.meta('auto') ? h('button', { class: 'btn gold', onclick: () => { this.panels.close(); this.loadGame('auto'); } }, 'Carregar o salvamento automático') : null,
        h('button', { class: 'btn', onclick: () => { this.panels.close(); this.toTitle(); } }, 'Voltar ao título')));
    this.panels.show(h('div', { class: 'win small' }, h('div', { class: 'win-body' }, body)), 'gameover');
  }
  ending(kind) {
    const g = this.g;
    g.phase = 'over';
    const S2 = Story.endingSummary(g, kind);
    const vivos = S2.vivos;
    const T = {
      ponte: ['A Ponte para Baixo Guandu', `O Opala do Seu Valdir atravessou a Rua da Ponte roncando feito leão. O Sargento Rocha viu o HD, pensou por três segundos e abriu a cancela. Em Baixo Guandu, os dados do CRESCE+ viraram o Soro R-7 em escala industrial, e o bombardeio foi cancelado a quarenta minutos do horário marcado. Aimorés não acabou: dormiu. E vai acordar.`],
      ponte_forcada: ['Atravessando na Marra', `Sem provas, o Opala arrebentou a cancela sob tiros e gritos. A turma chegou do outro lado viva, mas sem nada que convencesse o Comando. Às 06h00 do dia 6, clarões iluminaram o Vale do Rio Doce. Aimorés virou uma lembrança — e uma promessa de nunca esquecer.`],
      trem: ['O Último Trem', `A velha locomotiva da estação cortou o vale pelos trilhos da ferrovia, apitando como nos tempos do avô da Daiana. ${S2.cura ? 'Na bagagem, o HD com a pesquisa: em Vitória, a cura foi fabricada e o bombardeio, cancelado.' : 'Sem a pesquisa, não houve como impedir o bombardeio. Pela janela do trem, a turma viu Aimorés ficar para trás.'}`],
      helicoptero: ['Resgate no Campinho', `As hélices levantaram a poeira vermelha do Campinho do Rio Doce. ${S2.cura ? 'A fórmula do Soro R-7, transmitida pela Rádio Aimorés FM, já estava sendo fabricada. O bombardeio foi cancelado e o exército entrou na cidade com vacinas, não com bombas.' : 'O resgate chegou, mas sem a fórmula o Comando manteve o protocolo. Do alto, a turma se despediu da cidade.'}`],
      bomba: ['06h00 do Dia 6', 'O prazo acabou. Clarões no céu, um estrondo que chegou até Baixo Guandu... e silêncio. A turma não conseguiu sair a tempo. Aimorés foi apagada do mapa — mas não da memória de quem conheceu sua gente.'],
    }[kind] || ['Fim', ''];
    const epi = [];
    if (vivos.includes('Arthur')) epi.push('Arthur virou streamer de jogos de sobrevivência. Ninguém acredita que as histórias são reais — e ele adora isso.');
    if (vivos.includes('Carol')) epi.push('Carol ajudou a montar um abrigo para quem perdeu tudo. Continua lembrando todo mundo de beber água.');
    if (vivos.includes('Daiana')) epi.push('Daiana voltou para a sala de aula. A turma da recuperação passou com nota máxima — em Biologia e em Sobrevivência.');
    if (vivos.includes('Pablício')) epi.push(`Pablício ${g.state.flags.valdir_curado ? 'abriu uma oficina com o Seu Valdir' : 'aprendeu mecânica de verdade'}. Ainda sua. Ainda está de boa. Às vezes.`);
    for (const [pair, v] of Object.entries(g.state.rel)) {
      const [a, b] = pair.split('|');
      if (!vivos.includes(HEROES[a].nome) || !vivos.includes(HEROES[b].nome)) continue;
      if (v >= 80) epi.push(`${HEROES[a].nome} e ${HEROES[b].nome} ficaram inseparáveis depois de tudo.`);
      else if (v <= 20) epi.push(`${HEROES[a].nome} e ${HEROES[b].nome} nunca mais se falaram direito.`);
    }
    if (S2.mortos.length) epi.push(`Em memória de ${S2.mortos.join(', ')}.`);
    const body = h('div', { class: 'ending' },
      h('h1', {}, T[0]),
      h('div', { class: 'story' }, T[1]),
      h('div', { class: 'stats' }, h('div', {}, `☀️ ${S2.dias} dia(s)`), h('div', {}, `🧟 ${S2.kills} zumbis`), h('div', {}, `🤝 ${S2.saved} pessoa(s) salvas`), h('div', {}, `🧪 Cura: ${S2.cura ? 'sim' : 'não'}`)),
      h('div', { class: 'story' }, epi.map(t => h('p', {}, t))),
      h('button', { class: 'btn primary', onclick: () => { this.panels.close(); this.toTitle(); } }, 'Voltar ao título'));
    this.panels.show(h('div', { class: 'win' }, h('div', { class: 'win-body' }, body)), 'ending');
  }
}
