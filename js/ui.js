// Interface: diálogos, menus e telas (equipe, bolsa, crescedex, loja).
import { pushHandler, popHandler, emit } from './input.js';
import { SPECIES, MOVES, ITEMS, TYPES, DEX_ORDER, BADGES } from './data.js';
import { nameOf, xpForLevel } from './creature.js';
import { sfx } from './audio.js';

const $ = s => document.querySelector(s);
let playerName = 'Cris';
export function setNames(n) { playerName = n; }
export function fmt(t) { return String(t).replace(/\{N\}/g, playerName).replace(/\{R\}/g, 'Gael'); }

export function typeBadge(t) {
  return `<span class="type" style="background:${TYPES[t].color}">${TYPES[t].name}</span>`;
}
export function hpColor(p) { return p > 0.5 ? '#3ad06a' : p > 0.2 ? '#f0c030' : '#e84a3a'; }
export function hpBar(c) {
  const p = Math.max(0, c.hp / c.maxhp);
  return `<div class="hpbar"><i style="width:${p * 100}%;background:${hpColor(p)}"></i></div>`;
}

// ---------------------------------------------------- diálogo
export function say(text, name = null, opts = {}) {
  const box = $('#dialog');
  const nameEl = $('#dialog-name');
  const txt = $('#dialog-text');
  const arrow = $('#dialog-arrow');
  box.classList.remove('hidden');
  nameEl.textContent = name || '';
  nameEl.classList.toggle('hidden', !name);
  const full = fmt(text);
  txt.textContent = '';
  arrow.classList.add('hidden');
  return new Promise(resolve => {
    let i = 0, done = false;
    const speed = opts.fast ? 6 : 22;
    const timer = setInterval(() => {
      i += 1;
      txt.textContent = full.slice(0, i);
      if (i % 3 === 0) sfx('text');
      if (i >= full.length) finish();
    }, speed);
    function finish() {
      clearInterval(timer);
      done = true;
      txt.textContent = full;
      arrow.classList.toggle('hidden', !!opts.keep);
      if (opts.auto) setTimeout(close, opts.auto);
      if (opts.keep) close();
    }
    function close() {
      popHandler(h);
      box.removeEventListener('click', click);
      if (!opts.keep) box.classList.add('hidden');
      resolve();
    }
    const h = pushHandler(a => {
      if (a !== 'a' && a !== 'b') return;
      if (!done) finish();
      else if (!opts.auto) { sfx('select'); close(); }
    });
    const click = () => h('a');
    box.addEventListener('click', click);
  });
}
export function hideDialog() { $('#dialog').classList.add('hidden'); }

// ---------------------------------------------------- lista genérica
export function list(container, items, opts = {}) {
  const cols = opts.cols || 1;
  container.innerHTML = '';
  container.classList.remove('hidden');
  if (opts.title) {
    const t = document.createElement('div');
    t.className = 'list-title';
    t.innerHTML = opts.title;
    container.appendChild(t);
  }
  const wrap = document.createElement('div');
  wrap.className = 'list' + (cols > 1 ? ' grid' : '');
  wrap.style.gridTemplateColumns = cols > 1 ? `repeat(${cols}, 1fr)` : '';
  container.appendChild(wrap);
  let desc = null;
  if (opts.desc) {
    desc = document.createElement('div');
    desc.className = 'list-desc';
    container.appendChild(desc);
  }
  let h = null;
  const els = items.map((it, i) => {
    const d = document.createElement('div');
    d.className = 'opt' + (it.disabled ? ' disabled' : '') + (it.cls ? ' ' + it.cls : '');
    d.innerHTML = typeof it === 'string' ? it : it.html;
    if (it.style) d.setAttribute('style', it.style);
    d.addEventListener('click', e => { e.stopPropagation(); if (!h) return; sel = i; render(); h('a'); });
    wrap.appendChild(d);
    return d;
  });
  let sel = Math.min(opts.start || 0, items.length - 1);
  const render = () => {
    els.forEach((e, i) => e.classList.toggle('sel', i === sel));
    if (desc) desc.innerHTML = opts.desc(sel) || '';
    if (opts.onFocus) opts.onFocus(sel);
    const el = els[sel];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  };
  render();
  return new Promise(resolve => {
    h = pushHandler(a => {
      const n = items.length;
      if (a === 'up') { sel = (sel - cols + n) % n; sfx('move'); }
      else if (a === 'down') { sel = (sel + cols) % n; sfx('move'); }
      else if (a === 'left' && cols > 1) { sel = (sel - 1 + n) % n; sfx('move'); }
      else if (a === 'right' && cols > 1) { sel = (sel + 1) % n; sfx('move'); }
      else if (a === 'a') {
        const it = items[sel];
        if (it && it.disabled) { sfx('bump'); return; }
        sfx('select');
        return done(sel);
      } else if ((a === 'b' || a === 'menu') && opts.cancel !== false) { sfx('back'); return done(-1); }
      render();
    });
    function done(v) {
      popHandler(h);
      if (!opts.keep) container.classList.add('hidden');
      resolve(v);
    }
    // alguns itens podem ser atualizados externamente
    h.el = els;
  });
}

export async function ask(text, options = ['Sim', 'Não'], name = null) {
  await say(text, name, { keep: true });
  const r = await list($('#choice'), options, { cancel: true });
  hideDialog();
  return r < 0 ? options.length - 1 : r;
}

// ---------------------------------------------------- telas
function screen(title) {
  const s = $('#screen');
  s.classList.remove('hidden');
  s.innerHTML = `<div class="screen-head"><span>${title}</span><button class="close">✕</button></div><div class="screen-body"></div>`;
  return { el: s, body: s.querySelector('.screen-body'), close: s.querySelector('.close') };
}
function closeScreen() { $('#screen').classList.add('hidden'); $('#screen').innerHTML = ''; }
function onClose(btn, h) { btn.addEventListener('click', () => h('b')); }

export function partyRow(c, extra = '') {
  const sp = SPECIES[c.sp];
  return `<div class="prow"><div class="pname">${nameOf(c)} <small>Nv. ${c.lvl}</small> ${sp.types.map(typeBadge).join('')}</div>
  ${hpBar(c)}<div class="php">${c.hp <= 0 ? '<b class="ko">DESMAIADO</b>' : ''} PV ${c.hp}/${c.maxhp} ${extra}</div></div>`;
}

export async function partyScreen(party, opts = {}) {
  const s = screen(opts.title || 'Equipe');
  const items = party.map(c => ({ html: partyRow(c), disabled: opts.disable ? opts.disable(c) : false }));
  const cont = document.createElement('div');
  s.body.appendChild(cont);
  if (opts.hint) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = opts.hint; s.body.prepend(p); }
  s.close.onclick = () => emit('b');
  const r = await list(cont, items, { cancel: opts.cancel !== false, start: opts.start || 0 });
  closeScreen();
  return r;
}

export async function summary(c) {
  const sp = SPECIES[c.sp];
  const s = screen(`${nameOf(c)} — Nv. ${c.lvl}`);
  const next = xpForLevel(c.lvl + 1);
  s.body.innerHTML = `
    <div class="sum">
      <div>${sp.types.map(typeBadge).join(' ')}</div>
      ${hpBar(c)}<div>PV ${c.hp}/${c.maxhp}</div>
      <table class="stats"><tr><td>Ataque</td><td>${c.atk}</td></tr><tr><td>Defesa</td><td>${c.def}</td></tr>
      <tr><td>Velocidade</td><td>${c.spd}</td></tr><tr><td>Exp.</td><td>${c.xp} / ${next}</td></tr></table>
      <h4>Golpes</h4>
      ${c.moves.map(m => { const mv = MOVES[m.id]; return `<div class="mv">${typeBadge(mv.type)} <b>${mv.name}</b> <small>${mv.cat === 'status' ? 'Status' : 'Poder ' + mv.pow} · PP ${m.pp}/${mv.pp}</small></div>`; }).join('')}
      <p class="dex">${sp.dex}</p>
    </div>`;
  await waitClose(s);
  closeScreen();
}

function waitClose(s) {
  return new Promise(res => {
    const h = pushHandler(a => { if (a === 'a' || a === 'b' || a === 'menu') { sfx('back'); popHandler(h); res(); } });
    s.close.onclick = () => h('b');
  });
}

export async function bagScreen(bag, filter) {
  const ids = Object.keys(bag).filter(id => bag[id] > 0 && (!filter || filter(id)));
  const s = screen('Bolsa');
  if (!ids.length) {
    s.body.innerHTML = '<p class="hint">A bolsa está vazia.</p>';
    await waitClose(s); closeScreen(); return null;
  }
  const cont = document.createElement('div');
  s.body.appendChild(cont);
  s.close.onclick = () => emit('b');
  const r = await list(cont, ids.map(id => ({ html: `<span>${ITEMS[id].name}</span><span class="qty">×${bag[id]}</span>`, cls: 'row' })), {
    desc: i => ITEMS[ids[i]] ? ITEMS[ids[i]].desc : '',
  });
  closeScreen();
  return r < 0 ? null : ids[r];
}

export async function dexScreen(state, show3d) {
  const s = screen(`Crescedex — Vistos: ${Object.keys(state.seen).length} · Capturados: ${Object.keys(state.caught).length}`);
  const cont = document.createElement('div');
  s.body.appendChild(cont);
  const items = DEX_ORDER.map((id, i) => {
    const seen = state.seen[id], caught = state.caught[id];
    const n = String(i + 1).padStart(3, '0');
    return { html: `<span>${n} ${seen ? SPECIES[id].name : '???'}</span><span>${caught ? '●' : ''}</span>`, cls: 'row' };
  });
  s.close.onclick = () => emit('b');
  await list(cont, items, {
    desc: i => {
      const id = DEX_ORDER[i];
      if (!state.seen[id]) return 'Ainda não registrado.';
      const sp = SPECIES[id];
      return `${sp.types.map(typeBadge).join(' ')}<br>${state.caught[id] ? sp.dex : 'Capture-o para ver mais informações.'}`;
    },
    onFocus: i => { if (show3d) show3d(state.seen[DEX_ORDER[i]] ? DEX_ORDER[i] : null); },
    keep: false,
  });
  if (show3d) show3d(null);
  closeScreen();
}

export async function shopScreen(ids, getMoney, buy) {
  while (true) {
    const s = screen(`Loja — Dinheiro: ₢${getMoney()}`);
    const cont = document.createElement('div');
    s.body.appendChild(cont);
    s.close.onclick = () => emit('b');
    const r = await list(cont, ids.map(id => ({ html: `<span>${ITEMS[id].name}</span><span class="qty">₢${ITEMS[id].price}</span>`, cls: 'row' })), {
      desc: i => ITEMS[ids[i]].desc,
    });
    closeScreen();
    if (r < 0) return;
    const id = ids[r];
    const max = Math.min(99, Math.floor(getMoney() / ITEMS[id].price));
    if (max <= 0) { await say('Você não tem dinheiro suficiente.', 'Vendedor'); continue; }
    const qtys = [1, 5, 10].filter(q => q <= max);
    const q = await list($('#choice'), qtys.map(q => `${q}× (₢${q * ITEMS[id].price})`).concat(['Cancelar']), { title: ITEMS[id].name });
    if (q < 0 || q >= qtys.length) continue;
    buy(id, qtys[q]);
    sfx('buy');
    await say(`Você comprou ${qtys[q]}× ${ITEMS[id].name}. Obrigado!`, 'Vendedor');
  }
}

export async function trainerCard(state) {
  const s = screen('Cartão de Treinador');
  const mins = Math.floor((state.playTime || 0) / 60);
  s.body.innerHTML = `
    <div class="card">
      <img src="assets/heroi.webp" alt="">
      <div>
        <p><b>Nome:</b> ${state.name}</p>
        <p><b>Dinheiro:</b> ₢${state.money}</p>
        <p><b>Crescedex:</b> ${Object.keys(state.caught).length}</p>
        <p><b>Tempo:</b> ${Math.floor(mins / 60)}h ${mins % 60}min</p>
        <div class="badges">${BADGES.map(b => `<span class="badge ${state.badges.includes(b.id) ? 'on' : ''}" style="--c:${b.color}" title="${b.name}">◆</span>`).join('')}</div>
        ${state.flags.campeao ? '<p class="champ">★ CAMPEÃO DA LIGA ★</p>' : ''}
      </div>
    </div>`;
  await waitClose(s);
  closeScreen();
}

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add('hidden'), 1800);
}

export function showLocation(name) {
  const el = $('#location');
  el.textContent = name;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

export function fade(on) {
  const f = $('#fade');
  f.classList.toggle('on', on);
  return new Promise(r => setTimeout(r, 320));
}
