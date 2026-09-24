// Crescemon — Versão Brasa 3D
import * as THREE from '../lib/three.module.min.js';
import { SPECIES, ITEMS, MOVES } from './data.js';
import { createCreature, healFull, nameOf, reviveUid } from './creature.js';
import { makeHuman, makeCreature, HERO_LOOK, LOOKS } from './models.js';
import { World, DIRS } from './world.js';
import { MAPS, rivalFinalParty } from './maps.js';
import { BattleScene, Battle, buildTrainerParty } from './battle.js';
import * as UI from './ui.js';
import { initInput, heldDir, isHeld, setWorldHandler, hasModal, pushHandler, popHandler } from './input.js';
import { initAudio, sfx, playMusic, setSound, soundOn, stopMusic } from './audio.js';

const $ = s => document.querySelector(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
const SAVE_KEY = 'crescemon-brasa-save-v1';

// ------------------------------------------------ renderer
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const world = new World(renderer);
const bs = new BattleScene();
const heroModel = makeHuman(HERO_LOOK);
world.setPlayerModel(heroModel);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  for (const cam of [world.camera, bs.camera]) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
  // em telas em pé, afasta um pouco a câmera de batalha
  // em tela em pé, a câmera fica atrás do nosso Crescemon (inimigo aparece acima)
  if (w < h) { bs.baseCam.set(-4.4, 4.2, 8.4); bs.lookTarget.set(0.3, -1.1, 0.2); }
  else { bs.baseCam.set(0.2, 1.9, 6.4); bs.lookTarget.set(0.3, 0.7, 0); }
  applyCamFov();
}
function applyCamFov() {
  const portrait = window.innerWidth < window.innerHeight;
  world.camera.fov = world.camMode === 'cima' ? (portrait ? 55 : 45) : (portrait ? 64 : 52);
  world.camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------ estado
let state = null;
let mode = 'title'; // title | world | battle
let busy = false;
let turnHold = 0;
let bumpCd = 0;
let lastTime = performance.now();
let preview = null;

function newState(name) {
  return {
    v: 1, name, party: [], box: [], bag: {}, money: 3000, flags: {}, badges: [],
    seen: {}, caught: {}, map: 'casa', x: 2, z: 5, dir: 'up', starter: null, rivalStarter: null,
    lastCenter: { map: 'casa', x: 4, z: 5 }, playTime: 0, sound: true, camMode: 'terceira',
  };
}

function save(silent) {
  try {
    state.map = world.map ? currentMapId : state.map;
    state.x = world.player.x; state.z = world.player.z; state.dir = world.player.dir;
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    if (!silent) UI.toast('Jogo salvo!');
    return true;
  } catch (e) { if (!silent) UI.toast('Não foi possível salvar.'); return false; }
}
function loadSave() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}

// ------------------------------------------------ API para os scripts
let currentMapId = 'casa';
const G = {
  get state() { return state; },
  get name() { return state.name; },
  get world() { return world; },
  pendingEvos: new Set(),
  say: async (t, name, sound) => { if (sound) sfx(sound); await UI.say(t, name); },
  ask: (t, opts, name) => UI.ask(t, opts, name),
  flag: f => !!state.flags[f],
  set: (f, v = true) => { state.flags[f] = v; },
  hasBadge: b => state.badges.includes(b),
  addBadge: b => { if (!state.badges.includes(b)) state.badges.push(b); },
  giveItem: (id, n = 1) => { state.bag[id] = (state.bag[id] || 0) + n; },
  takeItem: (id, n = 1) => { state.bag[id] = Math.max(0, (state.bag[id] || 0) - n); },
  seen: sp => { state.seen[sp] = true; },
  caught: sp => { state.seen[sp] = true; state.caught[sp] = true; },
  seenCount: () => Object.keys(state.seen).length,
  caughtCount: () => Object.keys(state.caught).length,
  speciesName: sp => SPECIES[sp].name,
  addCreature(c) {
    c.hp = Math.max(0, Math.min(c.maxhp, Math.round(c.hp)));
    if (state.party.length < 6) { state.party.push(c); return 'party'; }
    state.box.push(c); return 'box';
  },
  giveCreature(sp, lvl) { return G.addCreature(createCreature(sp, lvl)); },
  healParty() { for (const c of state.party) healFull(c); },
  async healScene() {
    sfx('heal');
    await wait(1300);
    G.healParty();
  },
  npc: id => world.npcs.get(id),
  player: {
    get x() { return world.player.x; },
    get z() { return world.player.z; },
    face: d => world.player.face(d),
    emote: ch => { sfx('select'); return world.player.emote(ch); },
    walk: dirs => world.player.walk(dirs),
  },
  refresh: () => world.refreshNpcs(G),
  wait,
  cry: () => sfx('cry'),
  async fade(fn) { await UI.fade(true); await fn(); await UI.fade(false); },
  warp: (m, x, z, dir, noFade) => warpTo(m, x, z, dir, noFade),
  battleBg() { const m = MAPS[currentMapId]; return m.bg || (m.interior ? 'indoor' : 'grass'); },
  async shop(list) {
    await UI.shopScreen(list, () => state.money, (id, n) => { state.money -= ITEMS[id].price * n; G.giveItem(id, n); });
  },
  async showCreature(sp) { showPreview(sp); await wait(50); },
  hideCreature() { showPreview(null); },
  async wildBattle(sp, lvl, opts = {}) {
    const c = createCreature(sp, lvl);
    return runBattle({ wild: c, legendary: opts.legendary });
  },
  async trainerBattle(t) {
    if (t.intro) await UI.say(t.intro, t.name);
    const spec = t.party === 'rivalFinal' ? rivalFinalParty(G) : t.party;
    const party = buildTrainerParty(spec);
    const r = await runBattle({ trainer: { ...t, party } });
    return r === 'win';
  },
  credits: () => rollCredits(),
  isBusy: () => busy || mode !== 'world' || hasModal(),
};
window.G = G;

// ------------------------------------------------ batalha
async function runBattle(opts) {
  const wasBusy = busy;
  if (!state.party.some(c => c.hp > 0)) return 'lose';
  busy = true;
  sfx('encounter');
  stopMusic();
  const fl = $('#flash');
  fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  await wait(900);
  mode = 'battle';
  fl.classList.remove('go');
  const battle = new Battle(G, bs);
  const result = await battle.run(opts);
  await UI.fade(true);
  mode = 'world';
  playMusic(MAPS[currentMapId].music);
  const canLose = opts.trainer && opts.trainer.canLose;
  if (result === 'lose' && !canLose) {
    await whiteout();
  } else if (result === 'lose' && canLose) {
    G.healParty();
  }
  await UI.fade(false);
  busy = wasBusy;
  return result;
}

async function whiteout() {
  const lc = state.lastCenter || { map: 'casa', x: 4, z: 5 };
  G.healParty();
  await warpTo(lc.map, lc.x, lc.z, lc.map === 'casa' ? 'down' : 'up', true);
  await UI.fade(false);
  if (lc.map === 'casa') await UI.say('Que susto, {N}! Você e seus Crescemon precisam descansar. Pronto, estão novinhos em folha!', 'Mãe');
  else await UI.say('Seus Crescemon desmaiaram... Nós cuidamos deles. Tome mais cuidado lá fora!', 'Enfermeira Clara');
}

// ------------------------------------------------ mapas
async function warpTo(mapId, x, z, dir, noFade) {
  if (!noFade) { sfx('door'); await UI.fade(true); }
  currentMapId = mapId;
  state.map = mapId;
  const map = MAPS[mapId];
  world.load(map, G);
  world.player.place(x, z, dir || 'down');
  state.x = x; state.z = z;
  playMusic(map.music);
  if (!noFade) await UI.fade(false);
  if (map.name && !map.interior) UI.showLocation(map.name);
  save(true);
}

async function runScript(fn) {
  busy = true;
  try { await fn(G); }
  catch (e) { console.error(e); }
  finally {
    UI.hideDialog();
    world.refreshNpcs(G);
    busy = false;
  }
}

function frontOf(a) {
  const [dx, dz] = DIRS[a.dir];
  return [a.x + dx, a.z + dz, dx, dz];
}

async function talkTo(npc) {
  const def = npc.def;
  const opp = { up: 'down', down: 'up', left: 'right', right: 'left' }[world.player.dir];
  if (!def.orb && !def.creature) npc.face(opp);
  if (def.trainer) {
    if (!G.flag('tr_' + def.id)) await trainerFlow(npc, false);
    else await UI.say(def.trainer.after || def.trainer.lose || '...', def.trainer.name);
    return;
  }
  if (def.talk) await def.talk(G);
}

async function trainerFlow(npc, spotted) {
  const def = npc.def;
  if (spotted) {
    sfx('select');
    await npc.emote('!');
    // caminha até o jogador
    const [dx, dz] = DIRS[npc.dir];
    const dist = Math.abs(world.player.x - npc.x) + Math.abs(world.player.z - npc.z);
    for (let i = 1; i < dist; i++) await npc.startMove(npc.dir, 1);
    const opp = { up: 'down', down: 'up', left: 'right', right: 'left' }[npc.dir];
    world.player.face(opp);
    void dx; void dz;
  }
  const won = await G.trainerBattle({ ...def.trainer, look: def.look });
  if (won) {
    G.set('tr_' + def.id);
    if (def.trainer.onWin) await def.trainer.onWin(G);
  }
}

async function fightWild(w) {
  const p = world.player;
  if (!state.party.some(c => c.hp > 0)) {
    w.cooldown = 8;
    await UI.say('Seus Crescemon estão sem energia! Cure-os antes de batalhar.');
    return;
  }
  const dx = w.x - p.x, dz = w.z - p.z;
  if (Math.abs(dx) + Math.abs(dz) === 1) {
    p.face(dx > 0 ? 'right' : dx < 0 ? 'left' : dz > 0 ? 'down' : 'up');
    w.face(dx > 0 ? 'left' : dx < 0 ? 'right' : dz > 0 ? 'up' : 'down');
  }
  sfx('cry');
  await w.emote('!');
  await G.wildBattle(w.sp, w.lvl);
  world.removeWild(w);
}

world.onWildContact = w => {
  if (mode !== 'world' || busy || hasModal() || world.player.moving) return;
  runScript(() => fightWild(w));
};

async function interact() {
  const p = world.player;
  const [fx, fz, dx, dz] = frontOf(p);
  const map = world.map;
  const wild = world.wildAt(fx, fz);
  if (wild) return runScript(() => fightWild(wild));
  let npc = world.npcAt(fx, fz);
  if (!npc && world.tile(fx, fz) === 'C') npc = world.npcAt(fx + dx, fz + dz);
  if (npc) return runScript(() => talkTo(npc));
  const item = (map.items || []).find(it => it.x === fx && it.z === fz && !G.flag('it_' + it.id));
  if (item) return runScript(async () => {
    G.set('it_' + item.id);
    G.giveItem(item.item, item.n);
    world.refreshNpcs(G);
    sfx('fanfare');
    await UI.say(`{N} encontrou ${item.n > 1 ? item.n + '× ' : ''}${ITEMS[item.item].name}!`);
  });
  const pc = (map.pcs || []).find(c => c.x === fx && c.z === fz);
  if (pc) return runScript(pcMenu);
  const sign = (map.signs || []).find(s => s.x === fx && s.z === fz);
  if (sign) return runScript(() => UI.say(sign.text));
  if (world.tile(fx, fz) === 'W') return runScript(() => UI.say('A água está azul e calma. Seria legal nadar... um dia.'));
}

async function onStepEnd() {
  const p = world.player;
  const map = world.map;
  state.steps = (state.steps || 0) + 1;
  // saídas
  const wp = (map.warps || []).find(w => w.x === p.x && w.z === p.z);
  if (wp) { busy = true; await warpTo(wp.to, wp.tx, wp.tz, wp.dir); busy = false; return; }
  const door = world.isDoor(p.x, p.z);
  if (door) {
    busy = true;
    const inner = MAPS[door.to];
    await warpTo(door.to, inner.exit.x, inner.exit.z - 1, 'up');
    busy = false;
    return;
  }
  if (map.exit && map.exit.x === p.x && map.exit.z === p.z) {
    busy = true;
    await warpTo(map.exit.to, map.exit.tx, map.exit.tz, 'down');
    busy = false;
    return;
  }
  const tr = (map.triggers || []).find(t => t.x === p.x && t.z === p.z && (!t.cond || t.cond(G)));
  if (tr) return runScript(tr.run);
  const spot = world.trainerSpotting(G);
  if (spot) return runScript(() => trainerFlow(spot, true));
}

function setCamMode(m) {
  world.camMode = m;
  if (state) state.camMode = m;
  world.snapCamera = true;
  lockKey = null;
  applyCamFov();
}

// ------------------------------------------------ menus
async function startMenu() {
  busy = true;
  let sel = 0;
  while (true) {
    const opts = [];
    if (G.flag('dex')) opts.push(['CRESCEDEX', dexMenu]);
    if (state.party.length) opts.push(['EQUIPE', partyMenu]);
    opts.push(['BOLSA', bagMenu]);
    opts.push([state.name.toUpperCase(), () => UI.trainerCard(state)]);
    opts.push(['SALVAR', async () => { if (save(false)) await UI.say('{N} salvou o jogo.'); }]);
    opts.push([`SOM: ${soundOn() ? 'LIGADO' : 'DESLIGADO'}`, async () => { setSound(!soundOn()); state.sound = soundOn(); }]);
    opts.push([`CÂMERA: ${world.camMode === 'cima' ? 'DE CIMA' : '3ª PESSOA'}`, async () => {
      setCamMode(world.camMode === 'cima' ? 'terceira' : 'cima');
    }]);
    opts.push(['FECHAR', null]);
    const r = await UI.list($('#start-menu'), opts.map(o => o[0]), { start: sel });
    if (r < 0 || !opts[r][1]) break;
    sel = r;
    await opts[r][1]();
  }
  busy = false;
}

async function partyMenu() {
  let start = 0;
  while (true) {
    const i = await UI.partyScreen(state.party, { title: 'Equipe', start });
    if (i < 0) return;
    start = i;
    const c = state.party[i];
    const r = await UI.list($('#choice'), ['RESUMO', 'MOVER', 'CANCELAR'], { title: nameOf(c) });
    if (r === 0) await UI.summary(c);
    else if (r === 1) {
      const j = await UI.partyScreen(state.party, { title: `Mover ${nameOf(c)} para...`, start: i });
      if (j >= 0 && j !== i) { [state.party[i], state.party[j]] = [state.party[j], state.party[i]]; start = j; }
    }
  }
}

async function bagMenu() {
  while (true) {
    const id = await UI.bagScreen(state.bag);
    if (!id) return;
    const it = ITEMS[id];
    if (!['heal', 'revive', 'pp'].includes(it.use)) { await UI.say(it.use === 'ball' ? 'Use orbes durante uma batalha contra Crescemon selvagens!' : it.desc); continue; }
    if (!state.party.length) { await UI.say('Você não tem Crescemon.'); continue; }
    const t = await UI.partyScreen(state.party, { title: `Usar ${it.name} em...` });
    if (t < 0) continue;
    const c = state.party[t];
    if (it.use === 'heal') {
      if (c.hp <= 0 || c.hp >= c.maxhp) { await UI.say('Não vai ter efeito.'); continue; }
      const b = c.hp; c.hp = Math.min(c.maxhp, c.hp + it.amount);
      sfx('heal'); await UI.say(`${nameOf(c)} recuperou ${c.hp - b} PV!`);
    } else if (it.use === 'revive') {
      if (c.hp > 0) { await UI.say('Não vai ter efeito.'); continue; }
      c.hp = Math.floor(c.maxhp / 2);
      sfx('heal'); await UI.say(`${nameOf(c)} foi reanimado!`);
    } else {
      for (const m of c.moves) m.pp = MOVES[m.id].pp;
      sfx('heal'); await UI.say(`Os PP de ${nameOf(c)} foram restaurados!`);
    }
    G.takeItem(id);
  }
}

async function dexMenu() {
  $('#screen').classList.add('dex');
  await UI.dexScreen(state, sp => showPreview(sp));
  $('#screen').classList.remove('dex');
  showPreview(null);
}

async function pcMenu() {
  sfx('select');
  await UI.say('{N} ligou o computador. Sistema de Armazenamento de Crescemon acessado.');
  while (true) {
    const r = await UI.list($('#choice'), ['RETIRAR', 'DEPOSITAR', 'SAIR'], { title: `Caixa: ${state.box.length}` });
    if (r === 0) {
      if (!state.box.length) { await UI.say('Não há Crescemon guardados.'); continue; }
      if (state.party.length >= 6) { await UI.say('Sua equipe está cheia!'); continue; }
      const i = await UI.partyScreen(state.box, { title: 'Retirar qual?' });
      if (i >= 0) { const c = state.box.splice(i, 1)[0]; healFull(c); state.party.push(c); await UI.say(`${nameOf(c)} entrou na equipe.`); }
    } else if (r === 1) {
      if (state.party.length <= 1) { await UI.say('Você precisa ficar com pelo menos um Crescemon!'); continue; }
      const i = await UI.partyScreen(state.party, { title: 'Depositar qual?' });
      if (i < 0) continue;
      const rest = state.party.filter((_, k) => k !== i);
      if (!rest.some(c => c.hp > 0)) { await UI.say('Você precisa ter um Crescemon capaz de lutar na equipe!'); continue; }
      const c = state.party.splice(i, 1)[0];
      state.box.push(c);
      await UI.say(`${nameOf(c)} foi guardado no computador.`);
    } else return;
  }
}

// ------------------------------------------------ prévia 3D (inset)
const pv = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(35, 1, 0.1, 50), model: null };
pv.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a9a, 1.4));
const pvSun = new THREE.DirectionalLight(0xffffff, 1.3);
pvSun.position.set(2, 4, 5);
pv.scene.add(pvSun);
pv.scene.background = new THREE.Color(0xeaf4ff);
function showPreview(sp) {
  const el = $('#preview');
  if (pv.model) { pv.scene.remove(pv.model.group); pv.model = null; }
  if (!sp) { el.classList.add('hidden'); preview = null; return; }
  pv.model = makeCreature(SPECIES[sp].model);
  pv.scene.add(pv.model.group);
  const h = pv.model.height;
  pv.cam.position.set(0, h * 0.7 + 0.3, h * 2.2 + 1.4);
  pv.cam.lookAt(0, h * 0.45, 0);
  el.classList.remove('hidden');
  el.querySelector('.pv-name').textContent = SPECIES[sp].name;
  preview = sp;
}
const pvCanvas = $('#preview canvas');
const pvCtx = pvCanvas.getContext('2d');

// ------------------------------------------------ loop
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (state && mode !== 'title') state.playTime = (state.playTime || 0) + dt;
  bumpCd -= dt;

  // prévia primeiro (copiada para o canvas 2D), depois a cena principal
  if (preview && pv.model) {
    pv.model.update(dt);
    pv.model.group.rotation.y += dt * 0.8;
    const size = 256;
    const W = canvas.width, H = canvas.height;
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, size / renderer.getPixelRatio(), size / renderer.getPixelRatio());
    renderer.setScissor(0, 0, size / renderer.getPixelRatio(), size / renderer.getPixelRatio());
    pv.cam.aspect = 1; pv.cam.updateProjectionMatrix();
    renderer.render(pv.scene, pv.cam);
    pvCtx.clearRect(0, 0, 256, 256);
    pvCtx.drawImage(canvas, 0, H - size, size, size, 0, 0, 256, 256);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W / renderer.getPixelRatio(), H / renderer.getPixelRatio());
  }

  if (mode === 'world' && state) {
    updateMovement(dt);
    world.update(dt, busy || hasModal());
    renderer.render(world.scene, world.camera);
  } else if (mode === 'battle' || mode === 'intro') {
    bs.update(dt);
    renderer.render(bs.scene, bs.camera);
  } else if (mode === 'title') {
    bs.update(dt);
    const portrait = window.innerWidth < window.innerHeight;
    bs.camera.position.set(Math.sin(now / 3000) * 1.2, portrait ? 2.6 : 1.9, portrait ? 10 : 6.4);
    bs.camera.lookAt(0, 0.7, 0);
    renderer.render(bs.scene, bs.camera);
  }
  requestAnimationFrame(loop);
}

// Em terceira pessoa, as direções são relativas à câmera: cima = frente,
// esquerda/direita = virar e andar, baixo = dar meia-volta.
// A direção escolhida fica travada enquanto a tecla estiver pressionada.
const CLOCK = ['up', 'right', 'down', 'left'];
const REL_OFF = { up: 0, right: 1, down: 2, left: 3 };
let lockKey = null, lockAbs = null;
function absDir(rel) {
  if (world.camMode === 'cima') return rel;
  if (rel !== lockKey) {
    lockKey = rel;
    lockAbs = CLOCK[(CLOCK.indexOf(world.player.dir) + REL_OFF[rel]) % 4];
  }
  return lockAbs;
}

function updateMovement(dt) {
  const p = world.player;
  if (busy || hasModal() || p.moving) return;
  const rel = heldDir();
  if (!rel) { turnHold = 0; lockKey = null; return; }
  const d = absDir(rel);
  if (p.dir !== d && !p.justMoved) {
    p.face(d);
    turnHold = world.camMode === 'cima' ? 0.09 : 0.2;
    return;
  }
  if (turnHold > 0) { turnHold -= dt; return; }
  const [dx, dz] = DIRS[d];
  const nx = p.x + dx, nz = p.z + dz;
  const wild = world.wildAt(nx, nz);
  if (wild) { p.face(d); runScript(() => fightWild(wild)); return; }
  if (world.blocked(nx, nz, p)) {
    p.face(d);
    p.justMoved = false;
    if (bumpCd <= 0) { sfx('bump'); bumpCd = 0.35; }
    return;
  }
  const run = isHeld('b');
  p.justMoved = true;
  p.startMove(d, run ? 1.9 : 1).then(async () => {
    await onStepEnd();
    setTimeout(() => { if (!p.moving) p.justMoved = !!heldDir(); }, 0);
  });
}

setWorldHandler(a => {
  if (mode !== 'world' || busy || world.player.moving) return;
  if (a === 'a') interact();
  else if (a === 'menu') startMenu();
});

// ------------------------------------------------ abertura
async function intro() {
  mode = 'intro';
  bs.setup('indoor');
  bs.scene.background = new THREE.Color(0x1a1a2a);
  const prof = makeHuman(LOOKS.prof);
  prof.group.position.set(0, 0.12, 1.4);
  prof.group.scale.setScalar(1.5);
  prof.group.rotation.y = -0.15;
  bs.scene.add(prof.group);
  bs.trainerModel = prof;
  playMusic('home');
  await UI.fade(false);
  await UI.say('Olá, olá! Desculpe a demora. Bem-vindo ao mundo dos CRESCEMON!', 'Prof. Ipê');
  await UI.say('Meu nome é IPÊ. Todos me chamam de Professor Crescemon.', 'Prof. Ipê');
  const mon = makeCreature(SPECIES.capibroto.model);
  mon.group.position.set(1.6, 0.12, 1.8);
  mon.group.rotation.y = -0.6;
  bs.scene.add(mon.group);
  bs.ally = mon;
  sfx('cry');
  await UI.say('Este mundo é habitado por criaturas chamadas CRESCEMON!', 'Prof. Ipê');
  await UI.say('Para algumas pessoas, os Crescemon são bichinhos de estimação. Outras os usam para batalhas.', 'Prof. Ipê');
  await UI.say('Eu estudo os Crescemon como profissão. E descobri que eles crescem junto com quem cuida deles!', 'Prof. Ipê');
  bs.scene.remove(mon.group); bs.ally = null;
  bs.scene.remove(prof.group);
  const hero = makeHuman(HERO_LOOK);
  hero.group.position.set(0, 0.12, 1.6);
  hero.group.scale.setScalar(1.5);
  hero.group.rotation.y = -0.2;
  bs.scene.add(hero.group);
  bs.trainerModel = hero;
  await UI.say('E você é {N}, certo? De casaco marrom e cheio de energia!', 'Prof. Ipê');
  hero.pose('fist');
  await wait(300);
  bs.scene.remove(hero.group);
  const rival = makeHuman(LOOKS.rival);
  rival.group.position.set(0, 0.12, 1.6);
  rival.group.scale.setScalar(1.5);
  bs.scene.add(rival.group);
  bs.trainerModel = rival;
  await UI.say('Este é meu neto, GAEL. Ele é seu rival desde que vocês eram pequenos.', 'Prof. Ipê');
  bs.scene.remove(rival.group);
  bs.scene.add(hero.group);
  hero.pose('rest');
  await UI.say('{N}! Sua própria lenda Crescemon está prestes a começar!', 'Prof. Ipê');
  await UI.say('Um mundo de sonhos e aventuras com Crescemon espera por você! Vamos lá!', 'Prof. Ipê');
  await UI.fade(true);
  bs.clear();
  bs.scene.remove(hero.group);
}

// ------------------------------------------------ créditos
async function rollCredits() {
  const el = $('#credits');
  el.classList.remove('hidden');
  const party = state.party.map(c => `<div class="hof">${nameOf(c)} — Nv. ${c.lvl}</div>`).join('');
  el.innerHTML = `<div class="roll">
    <h1>SALÃO DOS CAMPEÕES</h1>
    <img src="assets/heroi.webp" alt="">
    <h2>${state.name}</h2>${party}
    <p class="gap">Parabéns por vencer a Liga Crescemon!</p>
    <h3>CRESCEMON — VERSÃO BRASA 3D</h3>
    <p>Um jogo de fã inspirado nas clássicas aventuras de monstrinhos de bolso.</p>
    <p>Personagens, criaturas, mapas e músicas originais.</p>
    <h3>Elenco</h3><p>${state.name} — Herói</p><p>Gael — Rival e Campeão</p><p>Prof. Ipê — Pesquisador</p>
    <p>Basalto & Marina — Líderes de Ginásio</p><p>Chefe Breu — Equipe Sombra</p>
    <h3>Feito com</h3><p>Three.js · Web Audio · muito carinho</p>
    <p class="gap">EduCrescer</p>
    <h2>Obrigado por jogar!</h2>
    <p>Continue explorando... dizem que uma ave lendária foi vista na Rota Vitória.</p>
  </div>`;
  playMusic('credits');
  await wait(600);
  await new Promise(res => {
    let can = false;
    setTimeout(() => { can = true; }, 4000);
    const roll = el.querySelector('.roll');
    roll.addEventListener('animationend', finish);
    const h = pushHandler(a => { if (can && (a === 'a' || a === 'b')) finish(); });
    function finish() { popHandler(h); res(); }
  });
  el.classList.add('hidden');
  el.innerHTML = '';
  playMusic(MAPS[currentMapId].music);
  save(true);
}

// ------------------------------------------------ tela de título
function titleScene() {
  bs.setup('grass');
  const mons = ['brasito', 'pingolote', 'capibroto'];
  mons.forEach((sp, i) => {
    const m = makeCreature(SPECIES[sp].model);
    m.group.position.set(-1.6 + i * 1.6, 0.12, 0.6 + (i === 1 ? -0.6 : 0));
    m.group.rotation.y = (1 - i) * 0.35;
    bs.scene.add(m.group);
    bs[['ally', 'foe', 'heroModel'][i]] = m;
  });
}

async function startGame(fromSave) {
  initAudio();
  $('#title').classList.add('hidden');
  if (fromSave) {
    state = fromSave;
    for (const c of [...state.party, ...state.box]) reviveUid(c);
    setSound(state.sound !== false);
    setCamMode(state.camMode || 'terceira');
    UI.setNames(state.name);
    await UI.fade(true);
    mode = 'world';
    await warpTo(state.map, state.x, state.z, state.dir, true);
    await UI.fade(false);
    UI.toast('Bem-vindo de volta, ' + state.name + '!');
    return;
  }
  const name = ($('#name-input').value || '').trim().slice(0, 10) || 'Cris';
  state = newState(name);
  UI.setNames(name);
  setCamMode('terceira');
  await UI.fade(true);
  bs.clear();
  await intro();
  mode = 'world';
  await warpTo('casa', 2, 5, 'up', true);
  await UI.fade(false);
  UI.showLocation('Vila Aurora');
  await runScript(async () => {
    await UI.say('Seu quarto em Vila Aurora. Hoje é o dia em que tudo começa!');
    await UI.say('Controles: CIMA anda para frente, ESQUERDA/DIREITA viram, BAIXO dá meia-volta. Z/Espaço (A) interage, X (B) corre e ESC (☰) abre o menu.');
    await UI.say('Crescemon selvagens aparecem no mato alto. Chegue perto de um e toque em A (ou esbarre nele) para batalhar e tentar capturar! A câmera pode ser trocada no menu.');
  });
}

function setupTitle() {
  titleScene();
  playMusic('title');
  const saved = loadSave();
  const cont = $('#btn-continue');
  if (saved) {
    cont.classList.remove('hidden');
    cont.textContent = `Continuar (${saved.name} · ${saved.badges.length} insígnias)`;
    cont.onclick = () => startGame(saved);
  }
  let armed = false;
  $('#btn-new').onclick = () => {
    // com jogo salvo, pede um segundo toque para confirmar (sem janelas do navegador)
    if (saved && !armed) {
      armed = true;
      $('#btn-new').textContent = 'Apagar save e começar? Toque de novo';
      return;
    }
    startGame(null);
  };
  $('#name-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-new').click(); });
  document.addEventListener('pointerdown', () => { initAudio(); playMusic(mode === 'title' ? 'title' : MAPS[currentMapId].music); }, { once: true });
}

initInput();
setupTitle();
requestAnimationFrame(loop);
