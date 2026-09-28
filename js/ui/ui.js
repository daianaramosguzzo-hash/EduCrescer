// Interface: HUD (barras, minimapa, botões, dicas), menus e diálogos.
import * as THREE from '../../lib/three.module.min.js';
import { $, el, esc, clamp, fmtTime, bus } from '../core/util.js';
import { sfx, setVolumes } from '../core/audio.js';
import { input, initJoystick, holdButton } from '../core/input.js';
import { ITEMS, item, SLOTS, SLOT_NAMES, CAT_NAMES } from '../data/items.js';
import { RECIPES, CRAFT_CATS, STATIONS, STRUCTURES, BUILD_CATS, structTier } from '../data/recipes.js';
import { SKILLS, SKILL_CATS } from '../data/skills.js';
import { CHARACTERS, CHARACTER_ORDER } from '../data/characters.js';
import { REGIONS, DANGER, regionAt, inBase } from '../data/regions.js';
import { QUESTS, LORE } from '../data/quests.js';
import { capacity, derived, weaponOf, countItem, xpNeeded, compact, addToSlots, makeStack } from '../systems/state.js';
import { renderMapImage, drawWorldMap, drawMinimap } from './mapdraw.js';
import { QUALITY } from '../core/renderer.js';

const PORTRAITS = {};
const portrait = id => id === 'arthur' ? `<img src="assets/arthur.png" alt="">` : PORTRAITS[id] ? `<img class="gen" src="${PORTRAITS[id]}" alt="">` : `<span style="background:${CHARACTERS[id].color}">${CHARACTERS[id].name[0]}</span>`;

// Retratos dos sobreviventes desenhados a partir do próprio modelo 3D
export function makePortraits(G, makeModel) {
  const R = G.renderer, r = R.r;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff4e0', '#4a4038', 1.6));
  const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(1.5, 2.5, 3); scene.add(key);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
  const S = 128, dpr = r.getPixelRatio();
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const size = new THREE.Vector2(); r.getSize(size);
  for (const id of CHARACTER_ORDER) {
    if (id === 'arthur') continue;
    try {
      const m = makeModel(id);
      m.update(0.016, 0);
      scene.add(m.group);
      const hy = m.height - 0.17;
      cam.position.set(0.25, hy + 0.05, 1.25); cam.lookAt(0, hy - 0.04, 0);
      scene.background = new THREE.Color(CHARACTERS[id].color).multiplyScalar(0.55);
      r.setScissorTest(true); r.setViewport(0, 0, S, S); r.setScissor(0, 0, S, S);
      r.render(scene, cam);
      ctx.clearRect(0, 0, S, S);
      ctx.drawImage(r.domElement, 0, r.domElement.height - S * dpr, S * dpr, S * dpr, 0, 0, S, S);
      PORTRAITS[id] = c.toDataURL('image/png');
      scene.remove(m.group);
    } catch (e) { console.warn('retrato', id, e); }
  }
  r.setScissorTest(false); r.setViewport(0, 0, size.x, size.y);
}
const bar = (cls, icon, label) => `<div class="bar ${cls}" title="${label}"><i>${icon}</i><div class="track"><div class="fill"></div></div><b>0</b></div>`;

export class UI {
  constructor(G) {
    this.G = G;
    this.hud = $('#hud');
    this.panel = $('#panel');
    this.menu = null;
    this.toastEl = $('#toasts');
    this.feedEl = $('#feed');
    this.mmT = 0;
    this.sel = null;
    this.build();
  }
  build() {
    const h = this.hud;
    h.innerHTML = `
      <div id="hud-tl">
        <div class="who"><div class="portrait"></div><div><div class="name"></div><div class="lvl"></div></div></div>
        ${bar('hp', '❤️', 'Vida')}${bar('hunger', '🍖', 'Fome')}${bar('thirst', '💧', 'Sede')}${bar('energy', '⚡', 'Energia')}
        <div class="status"></div>
      </div>
      <div id="hud-quest"></div>
      <div id="hud-target" class="hidden"><div class="tname"></div><div class="track"><div class="fill"></div></div></div>
      <div id="hud-tr">
        <div class="mm-wrap"><canvas id="minimap" width="170" height="170"></canvas></div>
        <div class="region"></div><div class="clock"></div>
        <div class="tr-buttons"><button data-menu="pausa" title="Pausa (Esc)">⚙️</button></div>
      </div>
      <div id="hud-hint" class="hidden"></div>
      <div id="compass" class="hidden">➤</div>
      <div id="joy-zone"><div id="joy-base"><div id="joy-knob"></div></div></div>
      <div id="hud-actions">
        <button id="btn-attack" title="Atacar (Espaço / clique)"><span class="wicon"></span><span class="ammo"></span><svg viewBox="0 0 36 36"><circle class="dur" cx="18" cy="18" r="16"/></svg></button>
        <button id="btn-interact" title="Interagir (E)"><span class="ico">✋</span><span class="lbl"></span></button>
        <button id="btn-heal" title="Curar (Q)">🩹<small></small></button>
        <button id="btn-run" title="Correr (Shift)">🏃</button>
        <button id="btn-reload" title="Recarregar (R)">🔄</button>
      </div>
      <div id="hud-bottom">
        <div class="menu-row">
          <button data-menu="inventario" title="Inventário (I)">🎒<small>Inventário</small></button>
          <button data-menu="crafting" title="Crafting (C)">🔨<small>Crafting</small></button>
          <button data-menu="construcao" title="Construção (B)">🧱<small>Construir</small></button>
          <button data-menu="mapa" title="Mapa (M)">🗺️<small>Mapa</small></button>
          <button data-menu="missoes" title="Missões (J)">📜<small>Missões</small></button>
          <button data-menu="habilidades" title="Habilidades (K)">⭐<small>Habilid.</small><em class="badge hidden"></em></button>
          <button data-menu="sobreviventes" title="Sobreviventes (P)">👥<small>Sobrev.</small></button>
        </div>
        <div id="xpbar"><span class="lv"></span><div class="track"><div class="fill"></div></div><span class="xp"></span></div>
      </div>
      <div id="prompt" class="hidden"></div>
      <div id="progress" class="hidden"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/></svg></div>
      <div id="buildbar" class="hidden"></div>
      <div id="hurt"></div>
    `;
    h.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); sfx('ui'); this.toggleMenu(b.dataset.menu); }));
    this.mm = $('#minimap').getContext('2d');
    // botões de ação (toque e mouse)
    holdButton($('#btn-attack'), 'attack');
    holdButton($('#btn-interact'), 'interact');
    $('#btn-heal').addEventListener('click', e => { e.stopPropagation(); this.G.quickHeal(); });
    $('#btn-reload').addEventListener('click', e => { e.stopPropagation(); this.G.player.reload(); });
    $('#btn-run').addEventListener('click', e => { e.stopPropagation(); const on = !input.button('run'); input.setButton('run', on); $('#btn-run').classList.toggle('on', on); });
    initJoystick($('#joy-zone'), $('#joy-base'), $('#joy-knob'));
    $('#hud-quest').addEventListener('click', () => this.openMenu('missoes'));
    this.panel.addEventListener('mousedown', e => e.stopPropagation());
  }
  show(v) { this.hud.classList.toggle('hidden', !v); }

  // ---------------- HUD ----------------
  refresh() { this.refreshHud(); this.refreshQuests(); if (this.menu) this.renderMenu(); }
  refreshHud() {
    const G = this.G, p = G.player; if (!p) return;
    const ch = p.ch, C = CHARACTERS[ch.id], st = derived(ch);
    $('#hud-tl .portrait').innerHTML = portrait(ch.id);
    $('#hud-tl .name').textContent = C.name;
    $('#hud-tl .lvl').textContent = `Nível ${ch.level}`;
    const w = weaponOf(ch);
    $('#btn-attack .wicon').textContent = w.def.icon;
    const wd = w.def.weapon;
    $('#btn-attack .ammo').textContent = wd.ammo ? `${w.stack.a || 0}/${countItem(ch, wd.ammo)}` : '';
    const dur = w.stack && w.stack.d != null ? w.stack.d / w.def.dur : 1;
    const circ = $('#btn-attack .dur');
    circ.style.strokeDasharray = `${dur * 100.5} 100.5`;
    circ.style.stroke = dur > 0.5 ? '#8fd46a' : dur > 0.2 ? '#e8c23a' : '#e0483a';
    $('#btn-reload').classList.toggle('hidden', !wd.ammo);
    const heal = countItem(ch, 'bandagem') + countItem(ch, 'kit_medico') + countItem(ch, 'remedio');
    $('#btn-heal small').textContent = heal;
    $('#btn-heal').classList.toggle('dim', !heal);
    const badge = $('#hud-bottom .badge');
    badge.textContent = ch.points; badge.classList.toggle('hidden', !ch.points);
  }
  bars() {
    const p = this.G.player; if (!p) return;
    const ch = p.ch, st = p.stats || derived(ch);
    const set = (cls, v, max) => {
      const e = this.hud.querySelector('.bar.' + cls);
      e.querySelector('.fill').style.width = clamp(v / max * 100, 0, 100) + '%';
      e.querySelector('b').textContent = Math.ceil(v);
      e.classList.toggle('low', v / max < 0.2);
    };
    set('hp', ch.hp, st.maxHp); set('hunger', ch.hunger, 100); set('thirst', ch.thirst, 100); set('energy', ch.energy, st.maxEnergy);
    const s = [];
    if (ch.sick > 0) s.push('🤢 Enjoado');
    if (ch.hunger < 20) s.push('🍖 Faminto');
    if (ch.thirst < 20) s.push('💧 Com sede');
    if (this.G.inBaseSafe) s.push('⛺ Na base');
    this.hud.querySelector('.status').textContent = s.join('  ');
    // XP
    const need = xpNeeded(ch);
    $('#xpbar .lv').textContent = `Nv. ${ch.level}`;
    $('#xpbar .fill').style.width = clamp(ch.xp / need * 100, 0, 100) + '%';
    $('#xpbar .xp').textContent = `${Math.floor(ch.xp)}/${need} XP`;
  }
  refreshQuests() {
    const G = this.G; if (!G.state) return;
    const cur = G.quests.current();
    const box = $('#hud-quest');
    const main = cur ? cur.q : null;
    if (!main) { box.innerHTML = ''; box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    box.innerHTML = `<div class="qt">📜 ${esc(main.title)}</div>` + main.objectives.map((o, i) => {
      const done = G.quests.objDone(main, i);
      return `<div class="qo ${done ? 'done' : ''}">${done ? '☑' : '☐'} ${esc(G.quests.objText(main, i))}</div>`;
    }).join('');
    // dica no topo
    const hint = $('#hud-hint');
    if (cur && cur.o.hint && G.settings.hints) { hint.textContent = cur.o.hint; hint.classList.remove('hidden'); }
    else hint.classList.add('hidden');
  }
  setTarget(z, boss = false) { this.target = z; this.targetT = boss ? 999 : 5; }
  hurtFlash() { const e = $('#hurt'); e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }
  toast(msg, type = 'info', secs = 3) {
    const t = el('div', 'toast ' + type, esc(msg));
    this.toastEl.appendChild(t);
    while (this.toastEl.children.length > 4) this.toastEl.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, secs * 1000);
  }
  feed(id, n) {
    const d = item(id);
    // junta com uma notificação recente do mesmo item
    const ex = [...this.feedEl.children].find(e => e.dataset.id === id && !e.classList.contains('out'));
    if (ex) { ex.dataset.n = +ex.dataset.n + n; ex.querySelector('b').textContent = '+' + ex.dataset.n; clearTimeout(ex._t); ex._t = setTimeout(() => this.fadeFeed(ex), 2200); return; }
    const e = el('div', 'feed-item', `<span>${d.icon}</span> ${esc(d.name)} <b>+${n}</b>`);
    e.dataset.id = id; e.dataset.n = n;
    this.feedEl.appendChild(e);
    while (this.feedEl.children.length > 6) this.feedEl.firstChild.remove();
    e._t = setTimeout(() => this.fadeFeed(e), 2200);
  }
  fadeFeed(e) { e.classList.add('out'); setTimeout(() => e.remove(), 400); }
  progress(secs) {
    const e = $('#progress');
    e.classList.remove('hidden', 'run'); void e.offsetWidth;
    e.style.setProperty('--dur', secs + 's'); e.classList.add('run');
    clearTimeout(this._pt); this._pt = setTimeout(() => e.classList.add('hidden'), secs * 1000);
    const off = bus.on('actionCancel', () => { e.classList.add('hidden'); off(); });
  }

  update(dt) {
    const G = this.G, p = G.player;
    if (!p) return;
    this.bars();
    // minimapa
    this.mmT -= dt;
    if (this.mmT <= 0 && this.mapImg) { this.mmT = 0.12; drawMinimap(this.mm, this.mapImg, G, 170); }
    const R = regionAt(p.x, p.z);
    if (R) this.hud.querySelector('.region').innerHTML = `${DANGER[R.danger].icon} ${esc(R.name)}`;
    const hour = (G.state.time / 60) % 24;
    this.hud.querySelector('.clock').textContent = `Dia ${G.state.day} · ${fmtTime(G.state.time)} ${hour >= 6 && hour < 18 ? '☀️' : '🌙'}`;
    // alvo
    const tb = $('#hud-target');
    if (this.target) {
      this.targetT -= dt;
      const z = this.target;
      if (this.targetT <= 0 || (z.dead && this.targetT > 1.2)) this.targetT = Math.min(this.targetT, 1.2);
      if (this.targetT <= 0 || !G.zombies.list.includes(z)) { this.target = null; tb.classList.add('hidden'); }
      else {
        tb.classList.remove('hidden');
        tb.querySelector('.tname').innerHTML = `${z.def.boss ? '💀 ' : ''}${esc(z.def.name)} <b>${Math.max(0, Math.ceil(z.hp))}</b>`;
        tb.querySelector('.fill').style.width = clamp(z.hp / z.maxHp * 100, 0, 100) + '%';
        tb.classList.toggle('boss', !!z.def.boss);
      }
    }
    // rótulo de interação
    const it = G.interact.current;
    const pr = $('#prompt'), ib = $('#btn-interact');
    const lab = !p.busy && !G.building.mode ? G.interact.label(it) : null;
    if (lab) {
      const v = new THREE.Vector3(it.x, 1.9, it.z);
      const s = G.renderer.toScreen(v);
      pr.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      pr.innerHTML = `<kbd>E</kbd> <b>${esc(lab.verb)}</b> ${esc(lab.name)}`;
      pr.classList.remove('hidden');
      ib.querySelector('.ico').textContent = lab.icon; ib.querySelector('.lbl').textContent = lab.verb;
      ib.classList.add('ready');
    } else {
      pr.classList.add('hidden');
      ib.querySelector('.ico').textContent = '✋'; ib.querySelector('.lbl').textContent = '';
      ib.classList.remove('ready');
    }
    // bússola para o objetivo
    const c = $('#compass');
    const t = G.questTarget();
    if (t && !this.menu) {
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d > 14) {
        const a = Math.atan2(t.x - p.x, t.z - p.z);
        const W = window.innerWidth, H = window.innerHeight, r = Math.min(W, H) * 0.3;
        const x = W / 2 + Math.sin(a) * r, y = H / 2 + Math.cos(a) * r * 0.8;
        c.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%) rotate(${-a + Math.PI / 2}rad)`;
        c.title = `${Math.round(d)} m`;
        c.classList.remove('hidden');
      } else c.classList.add('hidden');
    } else c.classList.add('hidden');
  }

  // ---------------- diálogo e escolhas ----------------
  dialog(lines, onDone) {
    const G = this.G;
    const box = $('#dialog');
    let i = 0;
    G.pause(true, 'dialog');
    const show = () => {
      const L = lines[i];
      box.innerHTML = `${L.portrait ? `<div class="dp">${portrait(L.portrait)}</div>` : ''}<div class="dt"><div class="dn">${esc(L.name || '')}</div><div class="dx">${esc(L.text).replace(/\n/g, '<br>')}</div><div class="dm">${i < lines.length - 1 ? 'Continuar ▶' : 'Fechar ✔'}</div></div>`;
    };
    const next = () => {
      sfx('ui');
      i++;
      if (i >= lines.length) { box.classList.add('hidden'); box.onclick = null; this.dialogNext = null; G.pause(false, 'dialog'); onDone && onDone(); return; }
      show();
    };
    box.onclick = next;
    this.dialogNext = next;
    box.classList.remove('hidden');
    show();
  }
  choice(title, opts) {
    const G = this.G;
    const box = $('#choice');
    G.pause(true, 'choice');
    box.innerHTML = `<div class="ct">${esc(title)}</div>` + opts.map((o, i) => `<button data-i="${i}">${esc(o.label)}</button>`).join('') + `<button data-i="-1" class="cancel">Cancelar</button>`;
    box.classList.remove('hidden');
    const close = () => { box.classList.add('hidden'); G.pause(false, 'choice'); this.choiceClose = null; };
    this.choiceClose = close;
    box.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); sfx('ui'); close(); const k = +b.dataset.i; if (k >= 0) opts[k].fn(); });
  }

  // ---------------- construção ----------------
  buildBar(type) {
    const b = $('#buildbar');
    if (!type) { b.classList.add('hidden'); return; }
    const D = STRUCTURES[type], t = structTier(type, 0);
    b.innerHTML = `<div class="bn">${D.icon} ${esc(t.name)}</div><div class="bc">${t.cost.map(([id, n]) => `<span class="${this.G.crafting.available(id) >= n ? '' : 'miss'}">${item(id).icon} ${this.G.crafting.available(id)}/${n}</span>`).join('')}</div><div class="be"></div>
      <div class="bb"><button data-a="rot">↻ Girar <kbd>R</kbd></button><button data-a="ok" class="ok">✔ Construir <kbd>Enter</kbd></button><button data-a="x">✕ Sair <kbd>Esc</kbd></button></div>`;
    b.classList.remove('hidden');
    b.querySelectorAll('button').forEach(x => x.onclick = e => { e.stopPropagation(); const a = x.dataset.a; if (a === 'rot') this.G.building.rotate(); else if (a === 'ok') { this.G.building.confirm(); if (this.G.building.mode) this.buildBar(type); } else this.G.building.exit(); });
    b.onmousedown = e => e.stopPropagation();
  }
  buildStatus(err) { const e = $('#buildbar .be'); if (e) e.textContent = err || '✔ Pode construir aqui'; if (e) e.className = 'be ' + (err ? 'bad' : 'ok'); }

  // ---------------- menus ----------------
  toggleMenu(name, opts) { if (this.menu === name) this.closeMenu(); else this.openMenu(name, opts); }
  openMenu(name, opts = {}) {
    const G = this.G;
    if (G.player.dead && name !== 'pausa') return;
    if (G.building.mode && name !== 'pausa') G.building.exit();
    this.menu = name; this.menuOpts = opts;
    G.pause(true, 'menu');
    this.panel.classList.remove('hidden');
    this.renderMenu();
  }
  closeMenu() {
    if (!this.menu) return;
    this.menu = null; this.sel = null; this.container = null;
    this.panel.classList.add('hidden');
    this.panel.innerHTML = '';
    this.G.pause(false, 'menu');
    sfx('uiBack');
  }
  renderMenu() {
    const tabs = [['inventario', '🎒 Inventário'], ['crafting', '🔨 Crafting'], ['construcao', '🧱 Construção'], ['mapa', '🗺️ Mapa'], ['missoes', '📜 Missões'], ['habilidades', '⭐ Habilidades'], ['sobreviventes', '👥 Sobreviventes']];
    const m = this.menu;
    const isTab = tabs.some(t => t[0] === m);
    this.panel.innerHTML = `<div class="pwrap ${m}">
      <div class="phead">${isTab ? `<div class="tabs">${tabs.map(([id, t]) => `<button data-tab="${id}" class="${id === m ? 'on' : ''}">${t}</button>`).join('')}</div>` : `<div class="ptitle"></div>`}<button class="pclose" title="Fechar (Esc)">✕</button></div>
      <div class="pbody"></div></div>`;
    this.panel.querySelector('.pclose').onclick = () => this.closeMenu();
    this.panel.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { sfx('ui'); this.sel = null; this.menu = b.dataset.tab; this.menuOpts = {}; this.renderMenu(); });
    const body = this.panel.querySelector('.pbody');
    const fn = { inventario: this.mInventory, crafting: this.mCrafting, construcao: this.mBuild, mapa: this.mMap, missoes: this.mQuests, habilidades: this.mSkills, sobreviventes: this.mSurvivors, pausa: this.mPause, loot: this.mLoot }[m];
    if (fn) fn.call(this, body);
  }
  title(t) { const e = this.panel.querySelector('.ptitle'); if (e) e.textContent = t; }

  // grade de itens
  slotHtml(s, i, extra = '') {
    if (!s) return `<div class="slot empty" data-i="${i}" ${extra}></div>`;
    const d = item(s.id);
    const dur = s.d != null && d.dur ? `<div class="sd"><div style="width:${clamp(s.d / d.dur * 100, 0, 100)}%;background:${s.d / d.dur > 0.5 ? '#8fd46a' : s.d / d.dur > 0.2 ? '#e8c23a' : '#e0483a'}"></div></div>` : '';
    return `<div class="slot ${this.sel && this.sel.i === i && this.sel.where === extra ? 'sel' : ''}" data-i="${i}" ${extra} title="${esc(d.name)}"><span class="si">${d.icon}</span>${s.n > 1 ? `<span class="sn">${s.n}</span>` : ''}${s.a != null && d.weapon && d.weapon.mag > 1 ? `<span class="sa">${s.a}</span>` : ''}${dur}</div>`;
  }
  itemInfo(s) {
    const d = item(s.id);
    const lines = [];
    if (d.weapon && d.weapon.dmg) lines.push(`⚔️ Dano ${d.weapon.dmg}` + (d.weapon.pellets ? ` x${d.weapon.pellets}` : '') + ` · Alcance ${d.weapon.range} m · Barulho ${d.weapon.noise > 30 ? 'alto' : d.weapon.noise > 8 ? 'médio' : 'baixo'}`);
    if (d.weapon && d.weapon.ammo) lines.push(`Munição: ${item(d.weapon.ammo).name} (${s.a || 0}/${d.weapon.mag})`);
    if (d.tool) lines.push('🛠️ Ferramenta: ' + Object.entries(d.tool).map(([k, v]) => `${{ wood: 'madeira', stone: 'pedra', ore: 'minério', scrap: 'sucata' }[k]} ${'★'.repeat(v)}`).join(', '));
    if (d.stats) lines.push(Object.entries(d.stats).map(([k, v]) => ({ def: `🛡️ Defesa +${v}`, speed: `🏃 Velocidade ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`, slots: `🎒 +${v} espaços` }[k])).join(' · '));
    if (d.use) lines.push(Object.entries(d.use).filter(([k]) => ['fome', 'sede', 'vida', 'energia'].includes(k)).map(([k, v]) => `${{ fome: '🍖', sede: '💧', vida: '❤️', energia: '⚡' }[k]} ${v > 0 ? '+' : ''}${v}`).join('  ') + (d.use.doente ? ' · ⚠️ pode causar enjoo' : '') + (d.use.cura ? ' · cura enjoo' : ''));
    if (s.d != null && d.dur) lines.push(`Durabilidade ${Math.ceil(s.d)}/${d.dur}`);
    return `<div class="ii"><div class="iih"><span class="big">${d.icon}</span><div><div class="iin">${esc(d.name)}${s.n > 1 ? ' x' + s.n : ''}</div><div class="iic">${CAT_NAMES[d.cat] || ''}</div></div></div><div class="iid">${esc(d.desc || '')}</div>${lines.map(l => `<div class="iil">${l}</div>`).join('')}</div>`;
  }

  mInventory(body) {
    const G = this.G, p = G.player, ch = p.ch, st = derived(ch), cap = capacity(ch);
    const inBaseNow = inBase(p.x, p.z, 4);
    body.innerHTML = `<div class="inv-grid">
      <div class="equip">
        <div class="doll">${SLOTS.map(sl => { const s = ch.equip[sl]; return `<div class="eslot ${sl}" data-slot="${sl}" title="${SLOT_NAMES[sl]}">${s ? `<span class="si">${item(s.id).icon}</span>` : `<span class="ph">${SLOT_NAMES[sl]}</span>`}</div>`; }).join('')}<div class="figure">${portrait(ch.id)}</div></div>
        <div class="stats">
          <div>❤️ Vida <b>${Math.ceil(ch.hp)}/${st.maxHp}</b></div><div>⚡ Energia <b>${Math.ceil(ch.energy)}/${st.maxEnergy}</b></div>
          <div>🍖 Fome <b>${Math.ceil(ch.hunger)}</b></div><div>💧 Sede <b>${Math.ceil(ch.thirst)}</b></div>
          <div>🛡️ Defesa <b>${Math.round(st.def)}</b></div><div>⚔️ Dano <b>x${st.dmg.toFixed(2)}</b></div>
          <div>🏃 Velocidade <b>${Math.round(st.speed * 100)}%</b></div><div>🎒 Carga <b>${cap} espaços</b></div>
        </div>
      </div>
      <div class="bag">
        <div class="bagh">🎒 Inventário <small>${ch.inv.slice(0, cap).filter(Boolean).length}/${cap}</small>${inBaseNow ? '<button class="stash">📦 Guardar recursos no baú</button>' : ''}</div>
        <div class="slots">${ch.inv.map((s, i) => i < cap ? this.slotHtml(s, i, 'data-w="inv"') : '').join('')}${Array.from({ length: Math.max(0, 24 - cap) }, () => '<div class="slot locked">🔒</div>').join('')}</div>
        <div class="detail"></div>
      </div></div>`;
    const detail = body.querySelector('.detail');
    const showSel = () => {
      body.querySelectorAll('.slot, .eslot').forEach(e => e.classList.remove('sel'));
      if (!this.sel) { detail.innerHTML = '<div class="hintx">Toque num item para ver detalhes. Toque duas vezes para usar ou equipar.</div>'; return; }
      const s = this.sel.where === 'inv' ? ch.inv[this.sel.i] : ch.equip[this.sel.i];
      if (!s) { this.sel = null; detail.innerHTML = ''; return; }
      (this.sel.where === 'inv' ? body.querySelector(`.slot[data-i="${this.sel.i}"]`) : body.querySelector(`.eslot[data-slot="${this.sel.i}"]`))?.classList.add('sel');
      const d = item(s.id);
      const acts = [];
      if (this.sel.where === 'inv') {
        if (d.use) acts.push(['use', d.cat === 'bebida' ? '💧 Beber' : d.cat === 'medico' ? '🩹 Usar' : '🍴 Comer']);
        if (d.slot) acts.push(['equip', '🧤 Equipar']);
        if (d.learn) acts.push(['learn', '📖 Aprender']);
        if (d.lore) acts.push(['read', '📄 Ler']);
        if (!d.key) { acts.push(['drop1', '🗑️ Descartar 1']); if (s.n > 1) acts.push(['dropall', '🗑️ Descartar tudo']); }
      } else acts.push(['unequip', '↩️ Desequipar']);
      if (d.weapon && d.weapon.ammo && this.sel.where === 'equip') acts.push(['reload', '🔄 Recarregar']);
      detail.innerHTML = this.itemInfo(s) + `<div class="acts">${acts.map(([a, t]) => `<button data-a="${a}">${t}</button>`).join('')}</div>`;
      detail.querySelectorAll('[data-a]').forEach(b => b.onclick = () => this.invAction(b.dataset.a, s));
    };
    body.querySelectorAll('.slot[data-w="inv"]').forEach(e => {
      e.onclick = () => { sfx('ui'); const i = +e.dataset.i; if (this.sel && this.sel.where === 'inv' && this.sel.i === i && ch.inv[i]) { const d = item(ch.inv[i].id); if (d.use) this.invAction('use', ch.inv[i]); else if (d.slot) this.invAction('equip', ch.inv[i]); return; } this.sel = ch.inv[i] ? { where: 'inv', i } : null; showSel(); };
    });
    body.querySelectorAll('.eslot').forEach(e => { e.onclick = () => { sfx('ui'); const k = e.dataset.slot; if (this.sel && this.sel.where === 'equip' && this.sel.i === k) { this.invAction('unequip', ch.equip[k]); return; } this.sel = ch.equip[k] ? { where: 'equip', i: k } : null; showSel(); }; });
    const stash = body.querySelector('.stash');
    if (stash) stash.onclick = () => this.G.stashResources();
    showSel();
  }
  invAction(a, s) {
    const G = this.G, p = G.player, ch = p.ch;
    const d = item(s.id);
    const idx = ch.inv.indexOf(s);
    switch (a) {
      case 'use': this.closeMenu(); p.consume(idx); return;
      case 'equip': G.equip(idx); break;
      case 'unequip': G.unequip(this.sel.i); break;
      case 'learn': if (!ch.learned.includes(d.learn)) { ch.learned.push(d.learn); ch.inv[idx] = null; sfx('quest'); this.toast(`📖 Aprendeu: ${item(d.learn).name}`, 'good'); } else this.toast('Você já conhece esta receita.', 'info'); break;
      case 'read': { const L = LORE[d.lore]; this.closeMenu(); this.dialog([{ name: '📄 ' + L.title, text: L.text }]); return; }
      case 'drop1': case 'dropall': {
        const n = a === 'drop1' ? 1 : s.n;
        s.n -= n; if (s.n <= 0) ch.inv[idx] = null;
        G.dropBag(p.x + Math.sin(p.rot) * 0.8, p.z + Math.cos(p.rot) * 0.8, [{ ...s, n }], 'Itens largados');
        sfx('pickup');
        break;
      }
      case 'reload': p.reload(); break;
    }
    this.sel = null;
    this.refresh();
  }

  // loot de recipiente / baú / mochila
  openLoot(o) { this.container = o; this.openMenu('loot'); }
  openStorage(s) { this.container = { kind: 'storage', s, name: STRUCTURES[s.type].name, items: s.items }; this.openMenu('loot'); }
  mLoot(body) {
    const G = this.G, ch = G.player.ch, o = this.container, cap = capacity(ch);
    const storage = o.kind === 'storage';
    const items = o.items;
    this.title(`${storage ? '📦' : o.kind === 'bag' ? '🎒' : '🔍'} ${o.name || 'Recipiente'}`);
    const clen = storage ? items.length : Math.max(items.length, 1);
    body.innerHTML = `<div class="loot-grid">
      <div class="lc"><div class="bagh">${esc(o.name || '')} ${storage ? `<small>${items.filter(Boolean).length}/${items.length}</small>` : ''}</div>
        <div class="slots">${storage ? items.map((s, i) => this.slotHtml(s, i, 'data-w="c"')).join('') : (items.length ? items.map((s, i) => this.slotHtml(s, i, 'data-w="c"')).join('') : '<div class="emptytxt">Vazio. Volte mais tarde, talvez apareça algo.</div>')}</div>
        <div class="acts">${items.some(Boolean) ? '<button data-a="all">⬇️ Pegar tudo</button>' : ''}</div></div>
      <div class="li"><div class="bagh">🎒 Seu inventário <small>${ch.inv.slice(0, cap).filter(Boolean).length}/${cap}</small></div>
        <div class="slots">${ch.inv.slice(0, cap).map((s, i) => this.slotHtml(s, i, 'data-w="p"')).join('')}</div>
        <div class="acts">${storage ? '<button data-a="stash">⬆️ Guardar recursos</button>' : ''}</div>
        <div class="hintx">${storage ? 'Toque num item para mover entre o baú e o inventário.' : 'Toque num item para pegar.'}</div></div></div>`;
    const take = i => {
      const s = items[i]; if (!s) return;
      const d = item(s.id);
      const left = addToSlots(ch.inv, cap, s.id, s.n, d.stack > 1 ? null : { ...s });
      if (left === s.n) { this.toast('Inventário cheio.', 'bad'); sfx('denied'); return; }
      ch.seen[s.id] = true;
      if (left) s.n = left; else { if (storage) items[i] = null; else items.splice(i, 1); }
      sfx('pickup');
      G.afterItemsChanged();
    };
    body.querySelectorAll('.slot[data-w="c"]').forEach(e => e.onclick = () => { take(+e.dataset.i); this.renderMenu(); });
    body.querySelectorAll('.slot[data-w="p"]').forEach(e => e.onclick = () => {
      if (!storage) return;
      const i = +e.dataset.i, s = ch.inv[i]; if (!s) return;
      const d = item(s.id);
      const left = addToSlots(items, items.length, s.id, s.n, d.stack > 1 ? null : { ...s });
      if (left === s.n) { this.toast('Baú cheio.', 'bad'); sfx('denied'); return; }
      if (left) s.n = left; else ch.inv[i] = null;
      sfx('pickup'); G.afterItemsChanged(); this.renderMenu();
    });
    const all = body.querySelector('[data-a="all"]');
    if (all) all.onclick = () => { for (let i = items.length - 1; i >= 0; i--) if (items[i]) take(i); this.renderMenu(); };
    const st = body.querySelector('[data-a="stash"]');
    if (st) st.onclick = () => { G.stashResources(o.s); this.renderMenu(); };
    if (o.kind === 'bag' && !items.length) G.removeBag(o);
  }

  mCrafting(body) {
    const G = this.G, C = G.crafting, ch = G.player.ch;
    const stations = C.stationsNear();
    const cat = this.menuOpts.cat || (this.menuOpts.station && this.menuOpts.station !== 'mao' ? (RECIPES.find(r => r.station === this.menuOpts.station) || {}).cat : null) || 'ferramentas';
    const list = RECIPES.filter(r => r.cat === cat);
    const st = new Map(list.map(r => [r.id, C.status(r, stations)]));
    list.sort((a, b) => (st.get(b.id).can - st.get(a.id).can) || (st.get(b.id).known - st.get(a.id).known) || a.level - b.level);
    let sel = this.menuOpts.sel && list.find(r => r.id === this.menuOpts.sel) ? this.menuOpts.sel : (list.find(r => st.get(r.id).can) || list[0] || {}).id;
    body.innerHTML = `<div class="craft">
      <div class="cats">${CRAFT_CATS.map(c => `<button data-cat="${c.id}" class="${c.id === cat ? 'on' : ''}">${c.icon} ${c.name}</button>`).join('')}
        <div class="stations">Por perto: ${[...stations].map(s => `<span title="${STATIONS[s].name}">${STATIONS[s].icon}</span>`).join(' ')}</div></div>
      <div class="rlist">${list.map(r => { const s = st.get(r.id), d = item(r.out); return `<div class="rrow ${s.can ? 'can' : ''} ${s.known ? '' : 'unknown'} ${r.id === sel ? 'sel' : ''}" data-r="${r.id}"><span class="ri">${s.known ? d.icon : '❔'}</span><span class="rn">${s.known ? esc(d.name) : '???'}${r.n > 1 ? ' x' + r.n : ''}</span><span class="rs">${!s.known ? (r.blueprint ? '📜' : '🔍') : !s.levelOk ? 'Nv.' + r.level : !s.stationOk ? STATIONS[r.station].icon : s.can ? '✔' : ''}</span></div>`; }).join('')}</div>
      <div class="rdetail"></div></div>`;
    body.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { sfx('ui'); this.menuOpts = { ...this.menuOpts, cat: b.dataset.cat, sel: null }; this.renderMenu(); });
    body.querySelectorAll('.rrow').forEach(b => b.onclick = () => { sfx('ui'); this.menuOpts = { ...this.menuOpts, cat, sel: b.dataset.r }; this.renderMenu(); });
    const r = list.find(x => x.id === sel);
    const det = body.querySelector('.rdetail');
    if (!r) { det.innerHTML = ''; return; }
    const s = st.get(r.id), d = item(r.out);
    if (!s.known) {
      det.innerHTML = `<div class="ii"><div class="iih"><span class="big">❔</span><div><div class="iin">Receita desconhecida</div></div></div><div class="iid">${r.blueprint ? 'Encontre ou aprenda o esquema desta receita (📜) explorando Aimorés.' : 'Descubra coletando: ' + r.needs.map(([id]) => ch.seen[id] ? item(id).name : '???').join(', ') + '.'}</div></div>`;
      return;
    }
    det.innerHTML = this.itemInfo({ id: r.out, n: r.n, d: d.dur }) + `<div class="needs">${s.mats.map(m => `<div class="need ${m.have >= m.n ? 'ok' : 'miss'}"><span>${item(m.id).icon}</span> ${esc(item(m.id).name)} <b>${m.have}/${m.n}</b></div>`).join('')}</div>
      <div class="req"><span class="${s.stationOk ? 'ok' : 'miss'}">${STATIONS[r.station].icon} ${STATIONS[r.station].name}</span> <span class="${s.levelOk ? 'ok' : 'miss'}">⭐ Nível ${r.level}</span></div>
      <div class="acts"><button class="big ${s.can ? '' : 'off'}" data-a="craft">🔨 Fabricar</button></div>`;
    det.querySelector('[data-a="craft"]').onclick = () => { if (C.craft(r)) this.renderMenu(); else { const why = !s.stationOk ? `Precisa estar perto de: ${STATIONS[r.station].name}` : !s.levelOk ? `Precisa do nível ${r.level}` : 'Faltam materiais'; this.toast(why, 'bad'); } };
  }

  mBuild(body) {
    const G = this.G, ch = G.player.ch;
    const here = inBase(G.player.x, G.player.z, 6);
    body.innerHTML = `<div class="buildm">${!here ? '<div class="warn">⚠️ Você só pode construir no terreno da base (marcado no mapa com ⛺).</div>' : '<div class="hintx">Os materiais saem do inventário e dos baús da base.</div>'}
      ${BUILD_CATS.map(c => `<div class="bcat">${c.icon} ${c.name}</div><div class="blist">${Object.values(STRUCTURES).filter(s => s.cat === c.id).map(s => { const t = structTier(s.id, 0); const ok = G.crafting.hasAll(t.cost) && ch.level >= t.level; return `<div class="bitem ${ok ? 'can' : ''} ${ch.level < t.level ? 'locked' : ''}" data-s="${s.id}"><div class="bi">${s.icon}</div><div class="bn">${esc(t.name)}</div><div class="bc">${t.cost.map(([id, n]) => `<span class="${G.crafting.available(id) >= n ? '' : 'miss'}">${item(id).icon}${n}</span>`).join(' ')}</div>${ch.level < t.level ? `<div class="bl">Nível ${t.level}</div>` : ''}<div class="bd">${esc(s.desc || '')}</div></div>`; }).join('')}</div>`).join('')}</div>`;
    body.querySelectorAll('.bitem').forEach(b => b.onclick = () => {
      const id = b.dataset.s, t = structTier(id, 0);
      if (ch.level < t.level) { this.toast(`Precisa do nível ${t.level}.`, 'bad'); sfx('denied'); return; }
      if (!G.crafting.hasAll(t.cost)) { this.toast('Faltam materiais.', 'bad'); sfx('denied'); return; }
      this.closeMenu(); G.building.enter(id);
    });
  }

  mMap(body) {
    const G = this.G;
    body.innerHTML = `<div class="mapm"><div class="mapc"><canvas></canvas></div><div class="regions">${REGIONS.map(R => {
      const disc = G.state.world.discovered.includes(R.id), unl = G.state.world.unlocked.includes(R.id);
      const reasons = unl ? [] : G.quests.lockReason(R);
      return `<div class="reg ${unl ? '' : 'locked'}"><div class="rh">${DANGER[R.danger].icon} <b>${disc || unl ? esc(R.name) : '???'}</b> ${unl ? (disc ? '' : '<small>(não visitada)</small>') : '🔒'}</div><div class="rd">${disc || unl ? esc(R.desc) : 'Área ainda não explorada.'}</div>${reasons.map(x => `<div class="rq ${x.ok ? 'ok' : ''}">${x.ok ? '✔' : '✖'} ${esc(x.text)}</div>`).join('')}</div>`;
    }).join('')}<div class="legend">⛺ Base · 🎒 Mochila perdida · ❗ Objetivo · 🟢 baixo · 🟡 médio · 🔴 alto risco</div></div></div>`;
    const cv = body.querySelector('canvas');
    const wrap = body.querySelector('.mapc');
    const draw = () => { const s = Math.min(wrap.clientWidth, wrap.clientHeight) || 400; cv.width = cv.height = s; drawWorldMap(cv.getContext('2d'), this.mapImg, G, s, s); };
    requestAnimationFrame(draw);
  }

  mQuests(body) {
    const G = this.G, Q = G.quests;
    const act = Q.active().sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0));
    body.innerHTML = `<div class="quests">${act.map(q => `<div class="quest ${q.main ? 'main' : ''}"><div class="qh">${q.main ? '⭐' : '•'} ${esc(q.title)}</div><div class="qd">${esc(q.desc)}</div>${q.objectives.map((o, i) => `<div class="qo ${Q.objDone(q, i) ? 'done' : ''}">${Q.objDone(q, i) ? '☑' : '☐'} ${esc(Q.objText(q, i))}</div>`).join('')}${q.reward ? `<div class="qr">Recompensa: ${q.reward.xp ? `+${q.reward.xp} XP` : ''} ${(q.reward.items || []).map(([id, n]) => item(id).icon + (n > 1 ? 'x' + n : '')).join(' ')} ${q.reward.unlockChar ? '👥 ' + CHARACTERS[q.reward.unlockChar].name : ''}</div>` : ''}</div>`).join('') || '<div class="hintx">Nenhuma missão ativa.</div>'}
      ${G.state.quests.done.length ? `<div class="qdone"><div class="bcat">Concluídas</div>${G.state.quests.done.map(id => `<div class="qo done">☑ ${esc(QUESTS[id].title)}</div>`).join('')}</div>` : ''}</div>`;
  }

  mSkills(body) {
    const G = this.G, ch = G.player.ch;
    body.innerHTML = `<div class="skills"><div class="sp">Pontos disponíveis: <b>${ch.points}</b> <small>(1 ponto por nível)</small></div><div class="scols">${SKILL_CATS.map(c => `<div class="scol"><div class="sch">${c.icon} ${c.name}</div>${Object.values(SKILLS).filter(s => s.cat === c.id).map(s => {
      const lv = ch.skills[s.id] || 0, reqOk = !s.req || (ch.skills[s.req] || 0) > 0, can = ch.points > 0 && lv < s.max && reqOk;
      return `<div class="skill ${lv ? 'has' : ''} ${reqOk ? '' : 'locked'}"><div class="skn">${esc(s.name)} <span class="dots">${'●'.repeat(lv)}${'○'.repeat(s.max - lv)}</span></div><div class="skd">${esc(s.desc)}${!reqOk ? `<br><small>Requer: ${esc(SKILLS[s.req].name)}</small>` : ''}</div>${can ? `<button data-s="${s.id}">+ Aprender</button>` : ''}</div>`;
    }).join('')}</div>`).join('')}</div></div>`;
    body.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const id = b.dataset.s; ch.skills[id] = (ch.skills[id] || 0) + 1; ch.points--; sfx('levelUp'); G.player.refreshEquip(); this.refresh(); });
  }

  mSurvivors(body) {
    const G = this.G;
    const reason = G.survivors.switchReason();
    body.innerHTML = `<div class="survs">${reason ? `<div class="warn">ℹ️ ${esc(reason)}</div>` : '<div class="hintx">Escolha quem controlar. Os outros ficam na base.</div>'}<div class="scards">${CHARACTER_ORDER.map(id => {
      const C = CHARACTERS[id], ch = G.state.chars[id], active = G.state.active === id;
      if (!ch.unlocked) return `<div class="scard locked"><div class="sportrait">❔</div><div class="scn">???</div><div class="scr">Ainda não encontrado</div><div class="scb">Continue a história para encontrar outros sobreviventes.</div></div>`;
      const st = derived(ch);
      return `<div class="scard ${active ? 'active' : ''}" style="--c:${C.color}"><div class="sportrait">${portrait(id)}</div><div class="scn">${esc(C.name)} <small>Nv. ${ch.level}</small></div><div class="scr">${esc(C.role)}</div>
        <div class="scs">❤️ ${Math.ceil(ch.hp)}/${st.maxHp} · ⚡ ${st.maxEnergy} · 🛡️ ${Math.round(st.def)} · 🏃 ${Math.round(st.speed * 100)}%</div>
        <div class="scsp"><b>✨ ${esc(C.special.name)}:</b> ${esc(C.special.desc)}</div><div class="scb">${esc(C.bio)}</div>
        <div class="scw">${ch.equip.arma ? item(ch.equip.arma.id).icon + ' ' + esc(item(ch.equip.arma.id).name) : '✊ Punhos'}</div>
        ${active ? '<div class="tag">🎮 Controlando</div>' : `<button data-c="${id}" class="${reason ? 'off' : ''}">🎮 Controlar</button>`}</div>`;
    }).join('')}</div></div>`;
    body.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { if (reason) { this.toast(reason, 'bad'); sfx('denied'); return; } this.closeMenu(); G.survivors.switchTo(b.dataset.c); });
  }

  mPause(body) {
    const G = this.G, S = G.settings;
    this.title('⏸️ Pausa');
    body.innerHTML = `<div class="pause">
      <button data-a="resume" class="big">▶ Continuar</button>
      <button data-a="save">💾 Salvar jogo</button>
      <div class="cfg">
        <label>🎵 Música <input type="range" min="0" max="1" step="0.05" data-k="music" value="${S.music}"></label>
        <label>🔊 Efeitos <input type="range" min="0" max="1" step="0.05" data-k="sfx" value="${S.sfx}"></label>
        <label>🔍 Zoom da câmera <input type="range" min="0.75" max="1.4" step="0.05" data-k="zoom" value="${S.zoom}"></label>
        <label>🖥️ Qualidade <select data-k="quality">${Object.entries(QUALITY).map(([k, q]) => `<option value="${k}" ${S.quality === k ? 'selected' : ''}>${q.name}</option>`).join('')}</select></label>
        <label>💡 Dicas na tela <input type="checkbox" data-k="hints" ${S.hints ? 'checked' : ''}></label>
      </div>
      <div class="keys"><b>Controles</b><br>WASD/setas: andar · Shift: correr · Espaço/clique: atacar · E: interagir/coletar · Q: curar · R: recarregar (ou girar na construção)<br>I: inventário · C: crafting · B: construção · M: mapa · J: missões · K: habilidades · P: sobreviventes · Esc: pausa · roda do mouse: zoom</div>
      <button data-a="quit" class="danger">🚪 Salvar e sair para o menu</button></div>`;
    body.querySelector('[data-a="resume"]').onclick = () => this.closeMenu();
    body.querySelector('[data-a="save"]').onclick = () => { G.save(true); };
    body.querySelector('[data-a="quit"]').onclick = () => { G.save(); location.reload(); };
    body.querySelectorAll('[data-k]').forEach(inp => inp.oninput = inp.onchange = () => {
      const k = inp.dataset.k;
      S[k] = inp.type === 'checkbox' ? inp.checked : inp.tagName === 'SELECT' ? inp.value : +inp.value;
      if (k === 'music' || k === 'sfx') setVolumes({ music: S.music, sfx: S.sfx });
      if (k === 'zoom') G.renderer.cam.tzoom = S.zoom;
      if (k === 'quality') G.renderer.setQuality(S.quality);
      if (k === 'hints') this.refreshQuests();
      G.saveSettings();
    });
  }
  // prepara o mapa depois que o mundo existe
  initMap() { this.mapImg = renderMapImage(this.G.world, 720); }
}
