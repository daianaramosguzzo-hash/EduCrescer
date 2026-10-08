// Força Tática — tiro tático em primeira pessoa (5 contra 5 com bots)
import * as THREE from '../../lib/three.module.min.js';
import { GRENADES, TEAM_LONG, WALL_H, CELL } from './config.js';
import * as MAP from './map.js';
import { FX } from './fx.js';
import { Game } from './game.js';
import { HUD } from './hud.js';
import { ViewModel } from './viewmodel.js';
import * as SND from './audio.js';
import * as TX from './textures.js';

const $ = (s) => document.querySelector(s);
const OPTS_KEY = 'forca-tatica-opcoes-v1';
const AUTO = new URLSearchParams(location.search).has('auto');

const opts = { team: 'auto', difficulty: 'normal', teamSize: 5, halfRounds: 8, sens: 2, volume: 0.7, voice: true, name: 'Você' };
try { Object.assign(opts, JSON.parse(localStorage.getItem(OPTS_KEY) || '{}')); } catch (e) { /* sem armazenamento */ }
const saveOpts = () => { try { localStorage.setItem(OPTS_KEY, JSON.stringify(opts)); } catch (e) { /* sem armazenamento */ } };

// ---------------------------------------------------------------- cena
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd8cdb3, 70, 260);
const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 600);
camera.rotation.order = 'YXZ';

// céu em degradê
{
  const geo = new THREE.SphereGeometry(500, 32, 16);
  const cols = [];
  const top = new THREE.Color(0x3d7bc8), hor = new THREE.Color(0xd6e4ef), low = new THREE.Color(0xd8c39a);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 500;
    const c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(low, Math.min(1, -y * 4));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  scene.add(sky);
  scene.userData.sky = sky;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.radialTexture('rgba(255,250,230,1)', 'rgba(255,240,200,0)'), fog: false, depthWrite: false, transparent: true }));
  sun.scale.setScalar(90);
  scene.userData.sun = sun;
  scene.add(sun);
}

const MAP_C = new THREE.Vector3(MAP.W * CELL / 2, 0, MAP.H * CELL / 2);
scene.add(new THREE.HemisphereLight(0xd4e6ff, 0xb39466, 1.25));
const sunLight = new THREE.DirectionalLight(0xfff0d8, 2.4);
sunLight.position.copy(MAP_C).add(new THREE.Vector3(55, 95, 35));
sunLight.target.position.copy(MAP_C);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 10, far: 260 });
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.04;
scene.add(sunLight, sunLight.target);

MAP.buildMap(scene);
buildSkyline();
const fx = new FX(scene);
const vm = new ViewModel();

// Prédios ao redor e por trás dos muros (só visual)
function buildSkyline() {
  const spots = [];
  const solid = (x, z) => !MAP.isFloor(x, z);
  for (let z = 1; z < MAP.H - 2; z += 3) for (let x = 1; x < MAP.W - 2; x += 3) {
    let ok = true;
    for (let dz = -1; dz <= 3 && ok; dz++) for (let dx = -1; dx <= 3; dx++) if (!solid(x + dx, z + dz)) { ok = false; break; }
    if (ok) spots.push([(x + 1) * CELL, (z + 1) * CELL, 3 * CELL]);
  }
  for (let i = 0; i < 44; i++) {
    const side = i % 4, k = (i / 4 | 0) / 11;
    const span = MAP.W * CELL;
    const along = -10 + k * (span + 20), out = -8 - Math.random() * 14;
    const [x, z] = side === 0 ? [along, out] : side === 1 ? [along, span - out] : side === 2 ? [out, along] : [span - out, along];
    spots.push([x, z, 8 + Math.random() * 6]);
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: TX.wallTexture() }), spots.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  spots.forEach(([x, z, w], i) => {
    const h = WALL_H + 2 + Math.random() * 7;
    m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(w, h, w * (0.8 + Math.random() * 0.4)));
    mesh.setMatrixAt(i, m);
    c.setHSL(0.09 + Math.random() * 0.03, 0.35, 0.72 + Math.random() * 0.12);
    mesh.setColorAt(i, c);
  });
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  vm.setAspect(w / h);
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- estado
let game = null, hud = null;
let paused = false;
let buyMode = false;
let spectateIdx = 0;
let deathAt = -99, killer = null;
let shake = 0;
const keys = new Set();
const mouse = { left: false, right: false, dx: 0, dy: 0 };
const locked = () => document.pointerLockElement === canvas;

// FOV do gênero (horizontal em 4:3) convertido para vertical
const vfov = (h) => 2 * Math.atan(Math.tan(h * Math.PI / 360) * 0.75) * 180 / Math.PI;

// ---------------------------------------------------------------- menu
function setupMenu() {
  $('#opt-name').value = opts.name;
  document.querySelectorAll('.seg').forEach(seg => {
    const key = seg.dataset.opt;
    const sync = () => seg.querySelectorAll('button').forEach(b => b.classList.toggle('sel', String(opts[key]) === b.dataset.v));
    seg.querySelectorAll('button').forEach(b => b.onclick = () => {
      opts[key] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v;
      sync(); saveOpts();
    });
    sync();
  });
  const bindRange = (input, out, key, fmt) => {
    input.value = opts[key];
    out.textContent = fmt(opts[key]);
    input.oninput = () => {
      opts[key] = +input.value;
      out.textContent = fmt(opts[key]);
      if (key === 'volume') SND.setVolume(opts.volume);
      syncRanges();
      saveOpts();
    };
  };
  const fs = (v) => v.toFixed(1), fv = (v) => Math.round(v * 100) + '%';
  bindRange($('#opt-sens'), $('#sens-val'), 'sens', fs);
  bindRange($('#opt-vol'), $('#vol-val'), 'volume', fv);
  bindRange($('#pause-sens'), $('#pause-sens-val'), 'sens', fs);
  bindRange($('#pause-vol'), $('#pause-vol-val'), 'volume', fv);
  function syncRanges() {
    for (const [i, o, k, f] of [['#opt-sens', '#sens-val', 'sens', fs], ['#opt-vol', '#vol-val', 'volume', fv], ['#pause-sens', '#pause-sens-val', 'sens', fs], ['#pause-vol', '#pause-vol-val', 'volume', fv]]) {
      $(i).value = opts[k]; $(o).textContent = f(opts[k]);
    }
  }
  $('#opt-voice').checked = opts.voice;
  $('#opt-voice').onchange = () => { opts.voice = $('#opt-voice').checked; SND.settings.voice = opts.voice; saveOpts(); };
  SND.settings.voice = opts.voice;
  SND.settings.volume = opts.volume;
  $('#btn-play').onclick = startGame;
  $('#btn-again').onclick = startGame;
  $('#btn-menu').onclick = quitToMenu;
  $('#btn-quit').onclick = quitToMenu;
  $('#btn-resume').onclick = resume;
  $('#btn-full').onclick = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().then(() => navigator.keyboard?.lock?.()).catch(() => {});
  };
}
setupMenu();

function startGame() {
  SND.initAudio();
  SND.setVolume(opts.volume);
  opts.name = ($('#opt-name').value || 'Você').trim().slice(0, 14);
  if (!AUTO) saveOpts();
  cleanup();
  const team = opts.team === 'auto' ? (Math.random() < 0.5 ? 'atk' : 'def') : opts.team;
  game = new Game(scene, fx, {
    team, difficulty: opts.difficulty, teamSize: opts.teamSize, halfRounds: opts.halfRounds, playerName: opts.name,
  });
  hud = new HUD(game, game.player, opts);
  wireEvents();
  game.startRound();
  $('#menu').classList.add('hidden');
  $('#end').classList.add('hidden');
  $('#pause').classList.add('hidden');
  paused = false;
  spectateIdx = 0;
  deathAt = -99;
  canvas.requestPointerLock?.();
  window.__game = game;
}

function cleanup() {
  if (!game) return;
  for (const a of game.agents) if (a.model) scene.remove(a.model.root);
  for (const d of game.drops) scene.remove(d.mesh);
  for (const g of game.grenades) scene.remove(g.mesh);
  if (game.bomb.mesh) scene.remove(game.bomb.mesh);
  fx.clearAll();
  game = null;
  if (hud) hud.closeBuy();
  hud = null;
}

function quitToMenu() {
  cleanup();
  paused = false;
  $('#hud').classList.add('hidden');
  $('#pause').classList.add('hidden');
  $('#end').classList.add('hidden');
  $('#scoreboard').classList.add('hidden');
  $('#menu').classList.remove('hidden');
  if (locked()) document.exitPointerLock();
}

function resume() {
  paused = false;
  $('#pause').classList.add('hidden');
  canvas.requestPointerLock?.();
}

const REASON = {
  elim: { atk: 'Todos os defensores foram eliminados', def: 'Todos os atacantes foram eliminados' },
  time: { def: 'O tempo acabou' },
  bomb: { atk: 'A bomba explodiu' },
  defuse: { def: 'A bomba foi desarmada' },
};

function wireEvents() {
  const g = game;
  g.on('kill', (k, v, w, hs, wb) => {
    hud.killfeed(k, v, w, hs, wb);
    if (v === g.player) { deathAt = g.time; killer = k; }
  });
  g.on('roundStart', (r) => {
    const p = g.player;
    hud.message(`RODADA ${r}`, p ? 'Aperte B para comprar' : 'Clique para trocar de jogador', p ? p.team : '', 3);
    SND.ui('start');
    deathAt = -99;
    if (hud.buyOpen()) hud.renderBuy();
  });
  g.on('live', () => { if (Math.random() < 0.6) SND.radio('Vai, vai, vai!'); });
  g.on('roundEnd', (w, reason) => {
    hud.message(`${TEAM_LONG[w]} VENCEU`, REASON[reason][w] || '', w, 5);
    const p = g.player;
    SND.ui(!p || p.team === w ? 'win' : 'lose');
    SND.radio(w === 'atk' ? 'O ataque venceu' : 'A defesa venceu');
  });
  g.on('bombPlanted', (site) => {
    hud.message('BOMBA PLANTADA', `no bomb ${site} · 40 segundos`, 'atk', 3);
    SND.radio('Bomba plantada');
  });
  g.on('bombDefused', () => SND.radio('Bomba desarmada'));
  g.on('halftime', () => {
    hud.message('INTERVALO', 'Os times trocam de lado · todos voltam a ter $800', '', 5);
    vm.key = null;
  });
  g.on('matchEnd', (w) => {
    const p = g.player;
    const title = $('#end-title');
    if (!w) { title.textContent = 'EMPATE'; title.className = ''; }
    else if (!p) { title.textContent = `${TEAM_LONG[w]} VENCEU`; title.className = ''; }
    else { const win = p.team === w; title.textContent = win ? 'VITÓRIA!' : 'DERROTA'; title.className = win ? 'win' : 'lose'; }
    $('#end-score').innerHTML = `<span class="t-atk">Ataque ${g.score.atk}</span> × <span class="t-def">${g.score.def} Defesa</span>`;
    $('#end-board').innerHTML = hud.boardHtml();
    $('#end').classList.remove('hidden');
    hud.closeBuy();
    if (locked()) document.exitPointerLock();
  });
  g.on('damage', (victim, attacker, hp) => {
    const view = viewAgent();
    if (victim !== view) return;
    if (victim === g.player) { SND.hurt(); shake = Math.min(1, shake + hp / 60); }
    if (attacker && attacker !== victim) {
      const dx = attacker.pos.x - victim.pos.x, dz = attacker.pos.z - victim.pos.z;
      const rel = Math.atan2(-dx, -dz) - victim.yaw;
      hud.damageFrom(-rel);
    }
  });
  g.on('explosion', (pos, he) => {
    const view = viewAgent();
    if (view && he) shake = Math.min(1.5, shake + Math.max(0, 1 - view.pos.distanceTo(pos) / 25));
  });
}

// ---------------------------------------------------------------- entrada
const SLOT_ORDER = ['primary', 'secondary', 'knife', 'he', 'flash', 'smoke', 'bomb'];

addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
  if (!game || paused || game.phase === 'over') return;
  if (e.repeat && e.code !== 'KeyW' && e.code !== 'KeyA' && e.code !== 'KeyS' && e.code !== 'KeyD') return;
  keys.add(e.code);
  const p = game.player;
  if (e.code === 'Tab') { hud.scoreboard(true); return; }
  if (e.ctrlKey && e.code !== 'ControlLeft' && e.code !== 'ControlRight') e.preventDefault();
  if (hud.buyOpen()) {
    if (e.code === 'Escape' || e.code === 'KeyB') { closeBuy(); return; }
    const n = +e.key;
    if (n >= 1 && n <= 9) { hud.buyKey(n); return; }
  }
  if (!p) return;
  const inp = p.input;
  switch (e.code) {
    case 'Space': inp.jump = true; e.preventDefault(); break;
    case 'KeyR': inp.reload = true; break;
    case 'KeyE': inp.usePressed = true; break;
    case 'KeyG': inp.drop = true; break;
    case 'KeyB':
      if (game.canBuy(p)) openBuy();
      else hud.message('', p.alive ? 'Só dá para comprar na sua base, no começo da rodada' : '', '', 2);
      break;
    case 'Digit1': p.equip('primary', game.time); break;
    case 'Digit2': p.equip('secondary', game.time); break;
    case 'Digit3': p.equip('knife', game.time); break;
    case 'Digit4': {
      const have = GRENADES.filter(g => p.nades[g] > 0);
      if (!have.length) break;
      const i = have.indexOf(p.cur);
      p.equip(have[(i + 1) % have.length], game.time);
      break;
    }
    case 'Digit5': p.equip('bomb', game.time); break;
    case 'KeyQ': if (p.has(p.prev)) p.equip(p.prev, game.time); break;
  }
});
addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'Tab' && hud) hud.scoreboard(false);
});
addEventListener('blur', () => { keys.clear(); mouse.left = mouse.right = false; });

canvas.addEventListener('mousedown', (e) => {
  SND.initAudio();
  if (!game || paused || game.phase === 'over') return;
  if (!locked()) { canvas.requestPointerLock?.(); return; }
  const p = game.player;
  if (!p || !p.alive) {
    if (e.button === 0) spectateIdx++;
    if (e.button === 2) spectateIdx--;
    return;
  }
  if (e.button === 0) { mouse.left = true; p.input.attackPressed = true; }
  if (e.button === 2) { mouse.right = true; p.input.attack2Pressed = true; }
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.left = false;
  if (e.button === 2) mouse.right = false;
});
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (!locked()) return;
  mouse.dx += e.movementX;
  mouse.dy += e.movementY;
});
addEventListener('wheel', (e) => {
  if (!game || !locked() || !game.player || !game.player.alive) return;
  const p = game.player;
  const have = SLOT_ORDER.filter(k => p.has(k));
  const i = have.indexOf(p.cur);
  const n = have[(i + (e.deltaY > 0 ? 1 : -1) + have.length) % have.length];
  p.equip(n, game.time);
}, { passive: true });

document.addEventListener('pointerlockchange', () => {
  if (locked()) return;
  mouse.left = mouse.right = false;
  if (buyMode) return;
  if (game && game.phase !== 'over' && $('#menu').classList.contains('hidden')) {
    paused = true;
    $('#pause').classList.remove('hidden');
    hud.scoreboard(false);
  }
});

function openBuy() {
  buyMode = true;
  hud.openBuy();
  if (locked()) document.exitPointerLock();
}
function closeBuy() {
  hud.closeBuy();
  buyMode = false;
  canvas.requestPointerLock?.();
}
$('#buy').addEventListener('mousedown', (e) => e.stopPropagation());

function playerInput() {
  const p = game.player;
  if (!p) return;
  const inp = p.input;
  if (hud.buyOpen() && !game.canBuy(p)) closeBuy();
  const k = (c) => keys.has(c);
  const fw = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0);
  const rt = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
  const fx_ = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  inp.mx = fx_ * fw + rx * rt;
  inp.mz = fz * fw + rz * rt;
  inp.duck = k('KeyC') || k('ControlLeft') || k('ControlRight');
  inp.walk = k('ShiftLeft') || k('ShiftRight');
  inp.attack = mouse.left && locked();
  inp.use = k('KeyE');
}

function applyMouse() {
  const p = game && game.player;
  if (p && p.alive && locked() && !paused) {
    const def = p.curDef();
    let zoom = 1;
    if (p.scope && def.scope) zoom = Math.tan(vfov(def.scope[p.scope - 1]) * Math.PI / 360) / Math.tan(vfov(90) * Math.PI / 360);
    const k = opts.sens * 0.022 * Math.PI / 180 * zoom;
    p.yaw -= mouse.dx * k;
    p.pitch = Math.max(-1.55, Math.min(1.55, p.pitch - mouse.dy * k));
  }
  const d = [mouse.dx, mouse.dy];
  mouse.dx = mouse.dy = 0;
  return d;
}

// ---------------------------------------------------------------- câmera
function viewAgent() {
  if (!game) return null;
  const p = game.player;
  if (p && p.alive) return p;
  if (p && game.time - deathAt < 2.2) return p;
  // observa um aliado vivo (ou qualquer um, se o time acabou)
  let list = game.agents.filter(a => a.alive && (!p || a.team === p.team));
  if (!list.length) list = game.agents.filter(a => a.alive);
  if (!list.length) return p || game.agents[0];
  spectateIdx = ((spectateIdx % list.length) + list.length) % list.length;
  return list[spectateIdx];
}

const _eye = new THREE.Vector3(), _f = new THREE.Vector3();
function updateCamera(dt) {
  if (!game) {
    // menu: câmera passeando pelo mapa
    const t = performance.now() / 1000 * 0.05;
    camera.position.set(MAP_C.x + Math.cos(t) * 30, 16, MAP_C.z + Math.sin(t) * 30);
    camera.lookAt(MAP_C.x, 0, MAP_C.z);
    camera.fov = 70;
    camera.updateProjectionMatrix();
    return null;
  }
  const p = game.player;
  const view = viewAgent();
  let fov = 90;
  shake = Math.max(0, shake - dt * 2.5);
  const sx = (Math.random() - 0.5) * shake * 0.03, sy = (Math.random() - 0.5) * shake * 0.03;
  if (view === p && p && p.alive) {
    p.eye(_eye);
    camera.position.copy(_eye);
    camera.rotation.set(p.pitch + p.recoilP * 0.3 + sy, p.yaw + p.recoilY * 0.3 + sx, 0);
    const def = p.curDef();
    if (p.scope && def.scope) fov = def.scope[p.scope - 1];
    if (p.model) p.model.root.visible = false;
  } else if (view === p && p) {
    // câmera da morte: cai devagar e olha para quem matou
    const t = Math.min(1, (game.time - deathAt) / 0.8);
    camera.position.copy(p.pos).setY(p.pos.y + 1.6 - t * 1.2);
    if (killer && killer !== p) {
      const target = killer.eye(_eye);
      const dir = target.clone().sub(camera.position);
      const yaw = Math.atan2(-dir.x, -dir.z), pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
      camera.rotation.set(pitch, yaw, 0);
    }
    if (p.model) p.model.root.visible = true;
  } else if (view) {
    if (p && p.model) p.model.root.visible = true;
    // terceira pessoa atrás de quem está sendo observado
    view.eye(_eye);
    view.forward(_f);
    const back = new THREE.Vector3(-_f.x, 0, -_f.z).normalize();
    const want = 2.6;
    const hit = MAP.raycast(_eye.x, _eye.y + 0.3, _eye.z, back.x, 0.12, back.z, want);
    const d = hit ? Math.max(0.3, hit.t - 0.3) : want;
    camera.position.set(_eye.x + back.x * d, _eye.y + 0.3 + 0.12 * d, _eye.z + back.z * d);
    camera.rotation.set(view.pitch * 0.8 - 0.05 + sy, view.yaw + sx, 0);
    if (view.model) view.model.root.visible = true;
  }
  const vf = vfov(fov);
  if (Math.abs(camera.fov - vf) > 0.01) { camera.fov = vf; camera.updateProjectionMatrix(); }
  hud.fov = vf;
  return view;
}

// ---------------------------------------------------------------- loop
SND.setOcclusionTest((pos) => !MAP.segmentClear(camera.position, new THREE.Vector3(pos.x, pos.y + 0.3, pos.z)));
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  let md = [0, 0];
  if (game && !paused && game.phase !== 'over') {
    md = applyMouse();
    playerInput();
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) game.update(h);
  } else {
    mouse.dx = mouse.dy = 0;
  }
  if (game) {
    game.animate(dt);
    fx.update(dt, game.time);
  }
  const view = updateCamera(dt);
  const sky = scene.userData.sky, sun = scene.userData.sun;
  sky.position.copy(camera.position);
  sun.position.copy(camera.position).add(new THREE.Vector3(55, 95, 35).normalize().multiplyScalar(420));
  SND.setListener(camera.position, camera.rotation.y);

  renderer.clear();
  renderer.render(scene, camera);
  if (game && view === game.player && game.player && game.player.alive) {
    vm.update(dt, game.player, game, md[0], md[1]);
    vm.render(renderer);
  }
  if (game && hud) {
    const spectating = !game.player || view !== game.player;
    hud.update(dt, view, spectating);
    const sp = $('#spectating');
    if (spectating && view && view.alive) {
      sp.classList.remove('hidden');
      sp.innerHTML = `Observando: <span class="t-${view.team}">${view.name}</span> · ${view.hp} HP · ${view.curDef().name}<small>Clique para trocar de jogador</small>`;
    } else sp.classList.add('hidden');
  }
}
requestAnimationFrame(frame);

// teste automático (?auto=1): começa uma partida só de bots
if (AUTO) {
  opts.team = 'spec';
  opts.teamSize = +(new URLSearchParams(location.search).get('size') || 5);
  opts.halfRounds = 4;
  startGame();
}
