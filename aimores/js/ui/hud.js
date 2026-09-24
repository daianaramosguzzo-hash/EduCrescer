// HUD: grupo, relógio, barra de ações, minimapa, missões, registro e avisos.
import { $, h, portraitOf, bar, pct } from './common.js';
import { HEROES, SKILLS } from '../data/heroes.js';
import { ITEMS } from '../data/items.js';
import { QUESTS } from '../data/quests.js';
import { FLOORS, S } from '../world/tiles.js';
import { countItem, carried, capacity } from '../game/units.js';
import { temperature, heatStatus } from '../game/survival.js';
import { bus, fmtTime } from '../util.js';

export class Hud {
  constructor(game, ui) {
    this.g = game; this.ui = ui;
    this.dirty = true;
    this.logOpen = false;
    bus.on('hud', () => { this.dirty = true; });
    bus.on('select', () => { this.dirty = true; });
    bus.on('log', line => this.addLog(line));
    bus.on('toast', (msg, cls) => this.toast(msg, cls));
    $('#log-toggle').onclick = () => { this.logOpen = !this.logOpen; $('#log').classList.toggle('open', this.logOpen); $('#log-toggle').textContent = this.logOpen ? '▾' : '▴'; this.renderLog(); };
    $('#minimap').addEventListener('click', e => this.miniClick(e));
    $('#tracker').addEventListener('click', () => ui.open('journal'));
    this.miniT = 0;
  }
  update(dt) {
    this.miniT -= dt;
    if (this.miniT <= 0) { this.miniT = 0.4; this.drawMinimap(); }
    if (!this.dirty) return;
    this.dirty = false;
    this.renderParty();
    this.renderTop();
    this.renderActions();
    this.renderTracker();
  }

  // ------------------------------------------------------------ grupo
  renderParty() {
    const g = this.g;
    const wrap = $('#party');
    wrap.innerHTML = '';
    for (const u of g.heroes) {
      const n = u.need;
      const warn = v => v < 25 ? 'warn' : '';
      const badges = [u.st.bleed ? '🩸' : '', u.st.infected ? '🦠' : '', u.st.hidden ? '🥷' : '', u.st.defend ? '🛡️' : '', u.st.panic ? '😱' : '', u.st.stun ? '💫' : '', u.st.downed ? '💀' : '', u.dead ? '⚰️' : ''].join('');
      const card = h('div', { class: 'hero-card' + (u.selected ? ' sel' : '') + (u.st.downed ? ' down' : '') + (u.dead ? ' dead' : ''), title: `${u.name} — clique para selecionar (${g.heroes.indexOf(u) + 1})`,
        onclick: () => { if (!u.dead) { g.select(u); } } },
        h('div', { class: 'pic', style: { backgroundImage: `url(${portraitOf(u)})`, borderColor: HEROES[u.id].cor } }),
        h('div', { class: 'info' },
          h('div', { class: 'nm' }, u.name, h('small', {}, `Nv ${u.lvl}${u.pts || u.spts || u.perkPts ? ' ⭐' : ''}`)),
          bar('hp', u.hp, u.maxHp),
          u.dead ? h('div', { class: 'mini-needs' }, 'Morreu') : h('div', { class: 'mini-needs' },
            h('span', { class: warn(n.fome), title: 'Fome' }, '🍗' + Math.round(n.fome)),
            h('span', { class: warn(n.sede), title: 'Sede' }, '💧' + Math.round(n.sede)),
            h('span', { class: warn(n.energia), title: 'Energia' }, '⚡' + Math.round(n.energia)),
            n.infeccao > 0 ? h('span', { class: 'warn', title: 'Infecção' }, '🦠' + Math.round(n.infeccao)) : null)),
        h('div', { class: 'badges' }, badges));
      wrap.append(card);
    }
  }
  // ------------------------------------------------------------ topo
  renderTop() {
    const g = this.g;
    const t = $('#topbar');
    const sel = g.selected;
    const hs = sel ? heatStatus(g, sel) : { t: temperature(g), icon: '🌤️', nome: '' };
    const night = g.isNight();
    const prazo = g.state.flags.sabe_prazo ? g.state.flags.prazo - g.state.time : null;
    const fmtPrazo = m => { const d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60); return `${d > 0 ? d + 'd ' : ''}${hh}h`; };
    t.innerHTML = '';
    t.append(
      h('span', {}, `Dia ${g.day()}`),
      h('span', { class: 'clock' }, g.clock()),
      h('span', { title: hs.nome }, `${night ? '🌙' : g.state.weather.chuva ? '🌧️' : hs.icon} ${hs.t}°C`),
      h('span', { class: 'mode ' + g.state.mode }, g.state.mode === 'combat' ? '⚔️ Combate' : '🌿 Exploração'),
      prazo !== null ? h('span', { class: 'prazo', title: 'Tempo até o bombardeio' }, `⏰ ${fmtPrazo(Math.max(0, prazo))}`) : '',
    );
    const banner = $('#phase-banner');
    if (g.phase === 'ai') { banner.textContent = g.state.mode === 'combat' ? 'Os zumbis estão agindo...' : 'O tempo passa...'; banner.classList.remove('hidden'); }
    else banner.classList.add('hidden');
  }
  // ------------------------------------------------------------ barra de ações
  renderActions() {
    const g = this.g, ui = this.ui;
    const u = g.selected;
    const bar_ = $('#actionbar');
    bar_.innerHTML = '';
    if (!u) return;
    const n = u.need;
    const needEl = (ic, label, v, color, invert = false) => h('div', { class: 'need', title: `${label}: ${Math.round(v)}` }, ic, bar('', invert ? v : v, 100, color));
    const me = h('div', { class: 'me' },
      h('div', { class: 'pic', style: { backgroundImage: `url(${portraitOf(u)})`, borderColor: HEROES[u.id].cor }, onclick: () => ui.open('char') }),
      h('div', {},
        h('div', { class: 'nm' }, u.name),
        h('div', { class: 'role' }, `${HEROES[u.id].papel} · ❤ ${Math.round(u.hp)}/${u.maxHp}`),
        bar('hp', u.hp, u.maxHp),
        h('div', { class: 'needs' },
          needEl('🍗', 'Fome (cheio = satisfeito)', n.fome, 'linear-gradient(#ffd08a,#e08a2a)'),
          needEl('💧', 'Sede', n.sede, 'linear-gradient(#8ad8ff,#2a8ad8)'),
          needEl('⚡', 'Energia', n.energia, 'linear-gradient(#fff08a,#d8b820)'),
          needEl('🙂', 'Moral', n.moral, 'linear-gradient(#f0a8d8,#b84a98)'),
          needEl('🦠', 'Infecção', n.infeccao, 'linear-gradient(#b8f07a,#4a8a1a)'))));
    // arma
    const w = u.eq.mao;
    const it = w ? ITEMS[w.id] : null;
    let sub = 'Soco';
    if (it && it.w) {
      if (it.w.tipo === 'distancia' && it.w.pente > 1) sub = `${w.loaded ?? 0}/${it.w.pente} · ${countItem(u, it.w.municao)} extra`;
      else if (it.w.municao) sub = `${countItem(u, it.w.municao)} ${ITEMS[it.w.municao].nome.toLowerCase()}`;
      else if (w.dur !== undefined) sub = `durab. ${Math.ceil(w.dur)}/${it.w.dur}`;
      else sub = it.w.tipo === 'arremesso' ? 'arremesso' : '';
    }
    const weapon = h('div', { class: 'weapon', title: 'Arma equipada — clique para o inventário (I)', onclick: () => ui.open('inv') },
      h('div', { class: 'ic' }, it ? it.icon : '👊'), h('div', {}, it ? it.nome : 'Mãos nuas'), h('small', {}, sub));
    // ações
    const busy = g.phase !== 'player' || g.busy;
    const B = (ic, title, fn, key = '', cls = '', disabled = false, extra = null) => {
      const b = h('button', { class: cls, title: title + (key ? ` (${key})` : ''), onclick: () => { if (!busy) fn(); }, disabled: busy || disabled }, ic, key ? h('span', { class: 'k' }, key) : null, extra);
      return b;
    };
    const acts = h('div', { class: 'acts' },
      B('⚔️', 'Atacar: clique num inimigo', () => ui.setMode('attack'), 'A', ui.mode === 'attack' ? 'on' : ''),
      B('🎯', 'Mirar (+15% de acerto no próximo tiro)', () => g.aim(u), 'G'),
      B('🛡️', 'Defender (−50% de dano; os zumbis agem em seguida)', () => g.defend(u), 'X'),
      B('🥷', 'Esconder-se', () => g.hide(u), 'H'),
      B('🏃', `Correr: ${g.input.run ? 'LIGADO' : 'desligado'} (mais rápido, mas faz barulho)`, () => { g.input.run = !g.input.run; this.dirty = true; ui.refreshHover(); }, 'Shift', g.input.run ? 'on' : ''),
      B('🔄', 'Recarregar', () => g.reload(u), 'R'),
      B('🎒', 'Inventário', () => ui.open('inv'), 'I'),
      B('🛠️', 'Fabricar e cozinhar', () => ui.open('craft'), 'B'),
      B('🔦', u.eq.mao2 && u.eq.mao2.id === 'lanterna' ? `Lanterna ${u.flash ? 'ligada' : 'desligada'} (${Math.round(u.eq.mao2.carga || 0)}%)` : 'Sem lanterna equipada', () => g.toggleFlashlight(u), 'F', u.eq.mao2 && u.flash && u.eq.mao2.id === 'lanterna' ? 'on' : ''),
    );
    for (const sid of HEROES[u.id].skills) {
      const sk = SKILLS[sid];
      const r = u.skill(sid);
      const cd = u.cd[sid] || 0;
      const title = `${sk.nome} (nível ${r}) — ${sk.desc(r || 1)}`;
      if (sk.ativa) acts.append(B(sk.icon, title, () => sid === 'voz_de_comando' ? ui.setMode('skill:' + sid) : g.useSkill(u, sid), '', 'skill', !r || cd > 0, cd > 0 ? h('span', { class: 'cd' }, cd) : null));
      else acts.append(h('button', { class: 'skill', title: title + ' (passiva)', disabled: true, style: { opacity: 0.75 } }, sk.icon));
    }
    const end = h('div', { class: 'end' },
      h('button', { class: busy ? 'wait' : '', onclick: () => g.endTurn(), disabled: busy, title: 'Esperar: deixa o tempo passar e os zumbis agirem (Enter)' }, busy ? 'Aguarde...' : '⏳ Esperar'),
      h('small', {}, g.state.mode === 'combat' ? 'os zumbis agem' : 'passa 5 minutos'));
    bar_.append(me, weapon, acts, end);
  }
  // ------------------------------------------------------------ missões
  renderTracker() {
    const g = this.g;
    const t = $('#tracker');
    t.innerHTML = '';
    const act = Object.entries(g.state.quests).filter(([, s]) => !s.done && !s.failed).sort((a, b) => (QUESTS[a[0]].tipo === 'principal' ? 0 : 1) - (QUESTS[b[0]].tipo === 'principal' ? 0 : 1));
    t.append(h('h4', {}, '📜 Missões'));
    if (!act.length) t.append(h('div', { class: 'q' }, h('div', { class: 's' }, 'Nenhuma missão ativa.')));
    for (const [id, s] of act.slice(0, 5)) {
      const q = QUESTS[id];
      t.append(h('div', { class: 'q' }, h('div', { class: 't' + (q.tipo === 'principal' ? '' : ' sec') }, (q.tipo === 'principal' ? '★ ' : '• ') + q.nome), h('div', { class: 's' }, q.passos[s.step]?.desc || '')));
    }
  }
  // ------------------------------------------------------------ registro
  addLog(line) {
    this.renderLog();
  }
  renderLog() {
    const el = $('#log-lines');
    const lines = this.g.state ? this.g.state.log.slice(this.logOpen ? -120 : -7) : [];
    el.innerHTML = lines.map(l => `<div class="${l.cls}"><span class="t">${l.t}</span>${l.msg}</div>`).join('');
    if (this.logOpen) $('#log').scrollTop = 1e9;
  }
  toast(msg, cls = '') {
    const el = h('div', { class: 'toast ' + cls, html: msg });
    $('#toasts').append(el);
    setTimeout(() => el.remove(), 2900);
    while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  }
  // ------------------------------------------------------------ minimapa
  drawMinimap(canvas = $('#minimap'), full = false) {
    const g = this.g;
    if (!g.map || !canvas) return;
    const m = g.map;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    let x0, z0, sc;
    if (full) { sc = Math.min(W / m.W, H / m.H); x0 = 0; z0 = 0; }
    else { sc = 3; const c = g.S.target; x0 = c.x - W / sc / 2; z0 = c.z - H / sc / 2; }
    ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, W, H);
    if (!this.baseCanvas || this.baseVersion !== this.exploredSum()) this.buildBase();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.baseCanvas, x0, z0, W / sc, H / sc, 0, 0, W, H);
    const P = (x, z) => [(x + 0.5 - x0) * sc, (z + 0.5 - z0) * sc];
    // objetivos
    for (const [qx, qz] of this.ui.objectivePoints()) {
      const [px, py] = P(qx, qz);
      ctx.fillStyle = '#f4c534'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, py - 7); ctx.lineTo(px + 5, py); ctx.lineTo(px, py + 7); ctx.lineTo(px - 5, py); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    for (const u of g.units) {
      if (u.dead || u.gone) continue;
      let col = null;
      if (u.kind === 'hero') col = HEROES[u.id].cor;
      else if (!g.unitVisible(u)) continue;
      else if (u.faction === 'zombie') col = '#ff3a3a';
      else if (u.faction === 'hostile') col = '#ff8a2a';
      else if (u.faction === 'ally') col = '#8af0ff';
      else col = '#f0f0a0';
      const [px, py] = P(u.x, u.z);
      ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, u.kind === 'hero' ? (full ? 4 : 3.5) : (full ? 2.5 : 2.5), 0, 7); ctx.fill(); ctx.stroke();
    }
    if (full) {
      ctx.font = 'bold 11px Nunito, sans-serif'; ctx.textAlign = 'center';
      for (const l of m.labels) {
        if (!m.explored[m.idx(Math.floor(l.x), Math.floor(l.z))] && l.kind === 'lugar') continue;
        const [px, py] = P(l.x - 0.5, l.z - 0.5);
        ctx.fillStyle = '#000'; ctx.fillText(l.text, px + 1, py + 1);
        ctx.fillStyle = l.kind === 'lugar' ? '#f4c534' : l.kind === 'rio' ? '#8ad8ff' : '#e8e0f0'; ctx.fillText(l.text, px, py);
      }
    } else {
      // área da câmera
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
      ctx.strokeRect(W / 2 - 18, H / 2 - 12, 36, 24);
    }
    this.miniView = { x0, z0, sc };
  }
  exploredSum() { const m = this.g.map; let s = 0; for (let i = 0; i < m.explored.length; i += 7) s += m.explored[i]; return s + m.version * 100000; }
  buildBase() {
    const m = this.g.map;
    const c = document.createElement('canvas'); c.width = m.W; c.height = m.H;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(m.W, m.H);
    const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    const floorCols = FLOORS.map(f => hex(f.mini));
    for (let i = 0; i < m.W * m.H; i++) {
      let rgb;
      if (!m.explored[i]) {
        // a turma conhece as ruas da cidade; o que tem dentro dos lugares, só vendo
        const s = m.struct[i];
        if (m.building[i] >= 0 || s === S.WALL || s === S.WINDOW || s === S.DOOR) rgb = [46, 36, 56];
        else if (s === S.MURO || s === S.GRADE || s === S.FENCE || s === S.GATE) rgb = [40, 34, 40];
        else { const f = floorCols[m.floor[i]]; rgb = [f[0] * 0.28 + 8, f[1] * 0.28 + 6, f[2] * 0.28 + 12]; }
      } else {
        const s = m.struct[i];
        if (s === S.WALL || s === S.WINDOW) rgb = [30, 24, 36];
        else if (s === S.DOOR || s === S.GATE) rgb = [200, 140, 70];
        else if (s === S.MURO) rgb = [120, 105, 95];
        else if (s === S.GRADE || s === S.FENCE) rgb = [140, 150, 150];
        else rgb = floorCols[m.floor[i]];
        if (m.propAt[i] >= 0 && m.props[m.propAt[i]].blocks) rgb = rgb.map(v => v * 0.7);
      }
      img.data.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);
    this.baseCanvas = c;
    this.baseVersion = this.exploredSum();
  }
  miniClick(e) {
    const r = e.target.getBoundingClientRect();
    const v = this.miniView; if (!v) return;
    const cx = (e.clientX - r.left) * (e.target.width / r.width), cy = (e.clientY - r.top) * (e.target.height / r.height);
    this.g.S.focus(v.x0 + cx / v.sc, v.z0 + cy / v.sc);
  }
}
