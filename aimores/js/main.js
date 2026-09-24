// Aimorés dos Mortos — ponto de entrada: tela de título, novo jogo, carregar, laço de quadros.
import { Scene3D } from './render/scene.js';
import { Game, DIFF } from './game/game.js';
import { installActions } from './game/actions.js';
import { UI } from './ui/ui.js';
import { Audio } from './audio.js';
import { openGallery } from './ui/gallery.js';
import { $, h } from './ui/common.js';
import { HEROES, HERO_ORDER, SKILLS, STAT_NAMES } from './data/heroes.js';
import { bus } from './util.js';
import * as Save from './game/save.js';

installActions(Game);

const S = new Scene3D($('#gl'), $('#world-ui'));
const g = new Game(S);
const ui = new UI(g, S);
const audio = new Audio(S);
ui.applyOpts();
window.__aimores = { g, S, ui, audio, bus }; // útil para depurar no console

// ------------------------------------------------------------ tela de título
function showTitle() {
  g.phase = 'none';
  ui.panels.close();
  $('#hud').classList.add('hidden');
  $('#dialog').classList.add('hidden');
  $('#rain').classList.add('hidden');
  $('#title').classList.remove('hidden');
  $('#btn-continue').classList.toggle('hidden', !Save.any());
  bus.emit('music', 'title');
}
function renderCast() {
  const cast = $('#title-cast');
  cast.innerHTML = '';
  for (const id of HERO_ORDER) {
    const H = HEROES[id];
    cast.append(h('div', { class: 'cast', onclick: () => heroCard(id), title: 'Conhecer ' + H.nome },
      h('div', { class: 'art', style: { backgroundImage: `url(${H.arte})`, borderColor: H.cor } }),
      h('div', { class: 'nm', style: { color: H.cor } }, H.nome),
      h('div', { class: 'rl' }, H.papel)));
  }
}
function heroCard(id) {
  const H = HEROES[id];
  const stats = h('div', { class: 'stats-grid' });
  for (const [k, n] of Object.entries(STAT_NAMES)) stats.append(h('div', { class: 'stat' }, h('span', {}, n), h('div', { class: 'pips' }, [...Array(10)].map((_, i) => h('i', { class: i < H.stats[k] ? 'on' : '', style: i < H.stats[k] ? { background: H.cor } : {} })))));
  const body = h('div', { class: 'hero-card-big' },
    h('div', { class: 'art', style: { backgroundImage: `url(${H.arte})`, borderColor: H.cor } }),
    h('div', {},
      h('h2', { style: { color: H.cor } }, `${H.nome} `, h('small', {}, `"${H.apelido}" · ${H.papel}`)),
      h('p', {}, H.bio),
      h('p', {}, h('b', {}, `❤ Vida ${H.hp}`)),
      stats,
      h('h3', {}, 'Habilidades'),
      H.skills.map(s => h('div', { class: 'skill-line' }, h('b', {}, `${SKILLS[s].icon} ${SKILLS[s].nome}${SKILLS[s].ativa ? ' (ativa)' : ''}`), h('div', {}, SKILLS[s].desc(1))))));
  ui.panels.show(h('div', { class: 'win' }, h('div', { class: 'win-head' }, h('h2', {}, H.nome), h('button', { class: 'x', onclick: () => ui.panels.close() }, '✕')), h('div', { class: 'win-body' }, body)), 'herocard');
}
function chooseDifficulty() {
  const body = h('div', { class: 'diff-list' });
  const desc = {
    facil: 'Menos zumbis, fome e sede mais lentas. Para curtir a história.',
    normal: 'O apocalipse como ele é: desafiador, mas justo.',
    dificil: 'Mais zumbis, mais dano e hordas frequentes. Cada bala conta.',
  };
  for (const [k, d] of Object.entries(DIFF)) {
    body.append(h('button', { class: 'diff ' + k, onclick: () => { ui.panels.close(); startGame(() => g.newGame({ diff: k })); } },
      h('b', {}, d.nome), h('span', {}, desc[k])));
  }
  body.append(h('p', { class: 'note' }, 'Dica: o jogo salva sozinho a cada período do dia. Você também pode salvar a qualquer momento no menu 💾.'));
  ui.panels.show(h('div', { class: 'win small' }, h('div', { class: 'win-head' }, h('h2', {}, 'Dificuldade'), h('button', { class: 'x', onclick: () => ui.panels.close() }, '✕')), h('div', { class: 'win-body' }, body)), 'diff');
}

// ------------------------------------------------------------ iniciar / carregar
let starting = false;
async function startGame(fn) {
  if (starting) return;
  starting = true;
  $('#loading').classList.remove('hidden');
  $('#title').classList.add('hidden');
  $('#hud').classList.add('hidden');
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  ui.pendingIntro = false;
  try {
    g.phase = 'none';
    fn();
  } catch (e) {
    console.error(e);
    starting = false;
    $('#loading').classList.add('hidden');
    showTitle();
    ui.toast('Não foi possível iniciar: ' + e.message, 'erro');
    return;
  }
  ui.lastAuto = null;
  ui.userPanned = false;
  ui.rangeDirty = true;
  // compila os shaders antes de mostrar
  S.render(0.016);
  $('#loading').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  bus.emit('weather', g.state.weather.chuva ? 'chuva' : 'sol');
  bus.emit('music', g.state.mode === 'combat' ? 'combat' : 'explore');
  bus.emit('hud');
  starting = false;
  if (ui.pendingIntro) {
    ui.pendingIntro = false;
    await ui.intro();
    ui.autosave();
  }
}
bus.on('load-game', slot => {
  const data = Save.read(slot);
  if (!data) { ui.toast('Esse salvamento não existe.', 'erro'); return; }
  startGame(() => { g.load(data); g.toast(`Jogo carregado — Dia ${g.day()}, ${g.clock()}.`, 'bom'); });
});
bus.on('to-title', () => showTitle());
bus.on('turn', () => bus.emit('ui', 'turn'));
bus.on('mode', m => { if (m === 'combat') bus.emit('ui', 'danger'); });

$('#btn-new').addEventListener('click', () => {
  if (Save.meta('auto')) ui.panels.confirm('Começar um jogo novo? O salvamento automático atual será substituído na primeira manhã.', chooseDifficulty);
  else chooseDifficulty();
});
$('#btn-continue').addEventListener('click', () => { const s = Save.latest(); if (s !== null) bus.emit('load-game', s); });
$('#btn-load').addEventListener('click', () => ui.panels.save('load'));
$('#btn-help').addEventListener('click', () => ui.panels.help());
// no app de Windows (Electron) aparece o botão de fechar o jogo
export const IS_DESKTOP = /Electron/i.test(navigator.userAgent);
if (IS_DESKTOP) {
  document.body.classList.add('desktop');
  $('.title-buttons').append(h('button', { id: 'btn-quit', onclick: () => window.close() }, 'Sair'));
}
$('#btn-sprites').addEventListener('click', () => { $('#title').classList.add('hidden'); openGallery(() => $('#title').classList.remove('hidden')); });

// ------------------------------------------------------------ laço principal
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (g.state && g.phase !== 'none') {
    try {
      g.frameUpdate(dt);
      S.units.update(dt * (g.speed || 1), (x, z) => S.lightAt(x, z), u => g.unitVisible(u));
      // câmera acompanha quem está andando
      const sel = g.selected;
      if (sel && ui.opts.follow) {
        const v = S.units.get(sel);
        if (v && v.moves.length) { S.focus(v.pos.x, v.pos.z); ui.userPanned = false; }
      }
      ui.updateKeysCamera(dt);
      ui.updateRange();
      ui.hud.update(dt);
      S.render(dt);
    } catch (e) { console.error(e); }
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------ início
renderCast();
showTitle();
const q = new URLSearchParams(location.search);
if (q.has('novo')) startGame(() => g.newGame({ diff: q.get('novo') || 'normal', seed: q.has('semente') ? +q.get('semente') : undefined }));
requestAnimationFrame(frame);
