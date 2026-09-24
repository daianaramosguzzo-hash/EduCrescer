// Galeria de sprites: veja cada personagem em todas as animações e direções, troque a arma
// na mão e baixe a sprite sheet organizada (PNG + JSON) e o retrato.
import { $, h } from './common.js';
import { paintFrame, paintPortrait, ANIMS, ANIM_LABEL, DIR_LABEL } from '../sprites/painter.js';
import { LOOKS, ZOMBIE_LOOKS } from '../sprites/looks.js';
import { HEROES, HERO_ORDER } from '../data/heroes.js';
import { ZOMBIES } from '../data/zombies.js';
import { NPCS } from '../data/npcs.js';
import { buildSheet, sheetHold } from '../sprites/sheet.js';

const HOLDS = [['auto', 'Automática'], ['none', 'Mãos vazias'], ['knife', 'Faca'], ['machete', 'Facão'], ['bat', 'Taco'], ['batpregos', 'Taco com pregos'],
  ['pipe', 'Cano'], ['crowbar', 'Pé de cabra'], ['hammer', 'Martelo'], ['axe', 'Machado'], ['sling', 'Estilingue'], ['pistol', 'Revólver/pistola'],
  ['shotgun', 'Espingarda'], ['rifle', 'Rifle'], ['megaphone', 'Megafone']];

function groups() {
  const heroes = HERO_ORDER.map(id => ({ look: HEROES[id].look, nome: HEROES[id].nome, sub: HEROES[id].papel }));
  const zombies = [];
  for (const [type, looks] of Object.entries(ZOMBIE_LOOKS)) looks.forEach((l, i) => zombies.push({ look: l, nome: ZOMBIES[type]?.nome || type, sub: looks.length > 1 ? `variação ${i + 1}` : '' }));
  const seen = new Set();
  const npcs = [];
  for (const n of Object.values(NPCS)) for (const l of n.looks || [n.look]) { if (seen.has(l) || !LOOKS[l]) continue; seen.add(l); npcs.push({ look: l, nome: n.nome, sub: '' }); }
  for (const l of Object.keys(LOOKS)) if (l.startsWith('npc_') && !seen.has(l)) { seen.add(l); npcs.push({ look: l, nome: l.replace('npc_', '').replace(/_/g, ' '), sub: '' }); }
  return [['Protagonistas', heroes], ['Zumbis', zombies], ['Sobreviventes', npcs]];
}

function download(name, url) {
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
}

export function openGallery(onClose) {
  const st = { look: 'arthur', anim: 'walk', dir: 0, hold: 'auto', spin: false, t: 0, bg: 'grama' };
  const root = h('div', { id: 'gallery' });
  const list = h('div', { class: 'gal-list' });
  const stage = h('canvas', { width: 360, height: 420, class: 'gal-stage' });
  const strip = h('canvas', { class: 'gal-strip' });
  const dirs = h('canvas', { class: 'gal-dirs' });
  const info = h('div', { class: 'gal-info' });
  const animBtns = h('div', { class: 'gal-btns' });
  const dirBtns = h('div', { class: 'gal-btns' });
  const holdSel = h('select', { onchange: e => { st.hold = e.target.value; redrawStatic(); } }, HOLDS.map(([v, n]) => h('option', { value: v }, n)));
  const holdOf = () => st.hold === 'auto' ? sheetHold(st.look, st.anim) : st.hold;

  for (const [title, items] of groups()) {
    list.append(h('h4', {}, title));
    for (const it of items) {
      const b = h('button', { class: 'gal-item', 'data-look': it.look, onclick: () => { st.look = it.look; sync(); } });
      const pc = h('canvas', { width: 64, height: 64 });
      paintPortrait(pc, LOOKS[it.look]);
      b.append(pc, h('span', {}, h('b', {}, it.nome), it.sub ? h('small', {}, it.sub) : ''));
      list.append(b);
    }
  }
  for (const a of Object.keys(ANIMS)) animBtns.append(h('button', { 'data-anim': a, onclick: () => { st.anim = a; st.t = 0; sync(); } }, ANIM_LABEL[a] || a));
  DIR_LABEL.forEach((n, d) => dirBtns.append(h('button', { 'data-dir': d, onclick: () => { st.dir = d; st.spin = false; sync(); } }, n)));
  dirBtns.append(h('button', { 'data-dir': 'spin', onclick: () => { st.spin = !st.spin; sync(); } }, '🔄 Girar'));

  const bgSel = h('select', { onchange: e => { st.bg = e.target.value; } },
    [['grama', 'Fundo: grama'], ['asfalto', 'Fundo: asfalto'], ['noite', 'Fundo: noite'], ['xadrez', 'Fundo: transparente']].map(([v, n]) => h('option', { value: v }, n)));

  const dlSheet = h('button', { class: 'btn gold', onclick: () => {
    dlSheet.disabled = true; dlSheet.textContent = 'Montando...';
    setTimeout(() => {
      try {
        const { canvas, meta } = buildSheet(st.look, { sc: 0.75 });
        download(`${st.look}-spritesheet.png`, canvas.toDataURL('image/png'));
        download(`${st.look}-spritesheet.json`, URL.createObjectURL(new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' })));
      } finally { dlSheet.disabled = false; dlSheet.textContent = '⬇️ Sprite sheet completa (PNG + JSON)'; }
    }, 30);
  } }, '⬇️ Sprite sheet completa (PNG + JSON)');
  const dlAnim = h('button', { class: 'btn', onclick: () => {
    const { canvas } = buildSheet(st.look, { sc: 1, anims: [st.anim], hold: holdOf() });
    download(`${st.look}-${st.anim}.png`, canvas.toDataURL('image/png'));
  } }, '⬇️ Só esta animação (8 direções)');
  const dlPortrait = h('button', { class: 'btn', onclick: () => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    paintPortrait(c, LOOKS[st.look]);
    download(`${st.look}-retrato.png`, c.toDataURL('image/png'));
  } }, '⬇️ Retrato');

  root.append(
    h('div', { class: 'gal-head' }, h('h2', {}, 'Galeria de sprites'), h('p', {}, 'Todos os personagens são desenhados em 2,5D com 8 direções. Escolha animação, direção e arma; baixe a folha organizada para usar onde quiser.'),
      h('button', { class: 'x', onclick: () => close() }, '✕')),
    h('div', { class: 'gal-body' },
      list,
      h('div', { class: 'gal-main' },
        h('div', { class: 'gal-view' }, stage, h('div', { class: 'gal-side' }, info, h('div', { class: 'gal-row' }, holdSel, bgSel), dlSheet, dlAnim, dlPortrait)),
        h('h4', {}, 'Animação'), animBtns,
        h('h4', {}, 'Direção'), dirBtns,
        h('h4', {}, 'Quadros desta animação'), strip,
        h('h4', {}, 'As 8 direções'), dirs)));
  document.body.append(root);

  const sg = stage.getContext('2d');
  let raf = 0, last = performance.now(), lastFrame = -1, lastKey = '';
  function sync() {
    for (const b of list.querySelectorAll('.gal-item')) b.classList.toggle('on', b.dataset.look === st.look);
    for (const b of animBtns.children) b.classList.toggle('on', b.dataset.anim === st.anim);
    for (const b of dirBtns.children) b.classList.toggle('on', b.dataset.dir === 'spin' ? st.spin : +b.dataset.dir === st.dir && !st.spin);
    const A = ANIMS[st.anim];
    const H = Object.values(HEROES).find(x => x.look === st.look);
    info.innerHTML = '';
    info.append(h('div', { class: 'nm' }, H ? H.nome : (list.querySelector(`[data-look="${st.look}"] b`)?.textContent || st.look)),
      h('div', {}, `${ANIM_LABEL[st.anim]} · ${A.frames} quadros · ${A.fps} qps${A.loop ? ' · em loop' : ''}`),
      h('div', {}, `Direção: ${st.spin ? 'girando' : DIR_LABEL[st.dir]}`));
    redrawStatic();
    lastKey = '';
  }
  function bgFill(g, w, hh) {
    if (st.bg === 'xadrez') { for (let y = 0; y < hh; y += 16) for (let x = 0; x < w; x += 16) { g.fillStyle = ((x + y) / 16) % 2 ? '#3a3346' : '#2c2636'; g.fillRect(x, y, 16, 16); } return; }
    g.fillStyle = { grama: '#6f9a4e', asfalto: '#56545c', noite: '#1b2238' }[st.bg];
    g.fillRect(0, 0, w, hh);
  }
  function redrawStatic() {
    const look = LOOKS[st.look];
    const A = ANIMS[st.anim];
    const sc = 0.9 / (look.scale > 1.05 ? look.scale : 1);
    const fw = 112 * sc * (look.scale > 1.05 ? look.scale : 1), fh = 136 * sc * (look.scale > 1.05 ? look.scale : 1);
    strip.width = Math.round(fw * A.frames); strip.height = Math.round(fh);
    const g = strip.getContext('2d');
    bgFill(g, strip.width, strip.height);
    for (let f = 0; f < A.frames; f++) paintFrame(g, look, st.anim, f, st.dir, holdOf(), f * fw + fw / 2, 128 * sc * (look.scale > 1.05 ? look.scale : 1), sc);
    dirs.width = Math.round(fw * 8); dirs.height = Math.round(fh);
    const g2 = dirs.getContext('2d');
    bgFill(g2, dirs.width, dirs.height);
    for (let d = 0; d < 8; d++) paintFrame(g2, look, st.anim === 'dead' ? 'dead' : 'idle', 0, d, holdOf(), d * fw + fw / 2, 128 * sc * (look.scale > 1.05 ? look.scale : 1), sc);
  }
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    st.t += dt;
    const A = ANIMS[st.anim];
    let f = Math.floor(st.t * A.fps);
    if (A.loop) f %= A.frames; else if (f >= A.frames + 6) { st.t = 0; f = 0; } else f = Math.min(f, A.frames - 1);
    const dir = st.spin ? Math.floor(st.t / 0.7) % 8 : st.dir;
    const key = `${st.look}|${st.anim}|${f}|${dir}|${holdOf()}|${st.bg}`;
    if (key !== lastKey) {
      lastKey = key;
      const look = LOOKS[st.look];
      const sc = 2.4 / (look.scale > 1.05 ? look.scale * 1.08 : 1);
      bgFill(sg, stage.width, stage.height);
      sg.fillStyle = 'rgba(0,0,0,0.25)'; sg.beginPath(); sg.ellipse(180, 380, 60, 18, 0, 0, 7); sg.fill();
      paintFrame(sg, look, st.anim, f, dir, holdOf(), 180, 380, sc);
    }
    raf = requestAnimationFrame(loop);
  }
  const onKey = e => { if (e.key === 'Escape') close(); };
  function close() { cancelAnimationFrame(raf); root.remove(); window.removeEventListener('keydown', onKey); if (onClose) onClose(); }
  window.addEventListener('keydown', onKey);
  sync();
  raf = requestAnimationFrame(loop);
  return { close };
}
