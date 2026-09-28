// Último Refúgio: Aimorés — jogo de sobrevivência 2,5D.
// Aqui fica o "G" (o jogo): junta renderizador, mundo, jogador, zumbis,
// sistemas e interface, e roda o laço principal.
import * as THREE from '../lib/three.module.min.js';
import { $, el, esc, clamp, dist, R, bus } from './core/util.js';
import { Renderer } from './core/renderer.js';
import { input, initInput } from './core/input.js';
import { initAudio, sfx, setListener, updateAmbient, updateMusic, setMusicIntensity, setVolumes } from './core/audio.js';
import { World } from './world/world.js';
import { RIVER_Z, POND } from './world/terrain.js';
import { XRAY } from './world/batch.js';
import { loadArthur } from './entities/arthurModel.js';
import { Player, makeCharacterModel } from './entities/player.js';
import { FX } from './systems/fx.js';
import { ZombieManager } from './systems/zombies.js';
import { Interact } from './systems/interact.js';
import { Crafting } from './systems/crafting.js';
import { Building } from './systems/building.js';
import { Quests } from './systems/quests.js';
import { Survivors } from './systems/survivors.js';
import { newGameState, addItem, capacity, compact, makeStack, xpNeeded, derived, addToSlots } from './systems/state.js';
import { hasSave, saveInfo, writeSave, readSave, deleteSave, loadSettings, saveSettings } from './systems/save.js';
import { UI, makePortraits } from './ui/ui.js';
import { item } from './data/items.js';
import { CHARACTERS } from './data/characters.js';
import { REGIONS, regionAt, inBase, BASE, START_POS } from './data/regions.js';
import { SKILLS } from './data/skills.js';
import { CONTAINERS } from './data/loot.js';

const G = window.G = {
  settings: loadSettings(),
  pauses: new Set(),
  clock: 0,
  intro: false,
};

// ------------------------------------------------------------------
async function boot() {
  const canvas = $('#game');
  G.renderer = new Renderer(canvas, G.settings.quality);
  initInput(canvas);
  setVolumes({ music: G.settings.music, sfx: G.settings.sfx });
  const setLoad = (p, msg) => { $('#loading .lbar div').style.width = Math.round(p * 100) + '%'; $('#loading .lmsg').textContent = msg; };
  setLoad(0.02, 'Carregando o Arthur...');
  await loadArthur();
  G.world = new World(G.renderer.scene);
  await G.world.build((p, m) => setLoad(0.1 + p * 0.85, m));
  G.fx = new FX(G.renderer.scene, G.renderer);
  G.zombies = new ZombieManager(G);
  G.interact = new Interact(G);
  G.crafting = new Crafting(G);
  G.building = new Building(G);
  G.quests = new Quests(G);
  G.survivors = new Survivors(G);
  G.ui = new UI(G);
  G.ui.initMap();
  makePortraits(G, makeCharacterModel);
  G.ui.show(false);
  // fumaça de incêndios ao longe (atmosfera)
  for (const [x, z] of [[40, -125], [-60, 20], [130, 30], [5, 78], [-130, -140]]) G.fx.addEmitter(x, 3, z, { rate: 2.2, scale: 3.2 });
  setLoad(1, 'Pronto');
  wireEvents();
  title();
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------------
// Tela de título: câmera passeando pela cidade
function title() {
  G.mode = 'title';
  $('#loading').classList.add('hidden');
  const t = $('#title');
  t.classList.remove('hidden');
  const info = saveInfo();
  const cont = $('#btn-continue');
  cont.classList.toggle('hidden', !info);
  if (info) cont.innerHTML = `▶ Continuar <small>${esc(CHARACTERS[info.active].name)} · Nível ${info.level} · Dia ${info.day}</small>`;
  $('#btn-new').onclick = () => {
    initAudio(); sfx('ui');
    if (info) { confirmBox('Começar um jogo novo apaga o progresso salvo. Continuar?', () => startGame(null)); }
    else startGame(null);
  };
  cont.onclick = () => { initAudio(); sfx('ui'); startGame(readSave()); };
  $('#btn-help').onclick = () => { initAudio(); sfx('ui'); $('#help').classList.remove('hidden'); };
  $('#help .close').onclick = () => $('#help').classList.add('hidden');
  G.renderer.setTime(0.36);
  G.titleT = 0;
}
function confirmBox(msg, yes) {
  const b = $('#confirm');
  b.innerHTML = `<div class="cbox"><p>${esc(msg)}</p><button class="yes">Sim, começar do zero</button><button class="no">Cancelar</button></div>`;
  b.classList.remove('hidden');
  b.querySelector('.yes').onclick = () => { b.classList.add('hidden'); deleteSave(); yes(); };
  b.querySelector('.no').onclick = () => b.classList.add('hidden');
}

// ------------------------------------------------------------------
function startGame(saved) {
  const fresh = !saved;
  G.state = saved || newGameState();
  $('#title').classList.add('hidden');
  applyWorldState();
  G.player = new Player(G, G.state.chars[G.state.active]);
  G.renderer.follow(G.player.x, G.player.z, 1, true);
  G.renderer.cam.tzoom = G.renderer.cam.zoom = G.settings.zoom;
  G.survivors.refresh();
  G.ui.show(true);
  G.ui.refresh();
  G.mode = 'game';
  G.saveT = 60;
  G.knownRecipes = G.crafting.knownSet();
  if (fresh) intro();
  else G.ui.toast(`${CHARACTERS[G.state.active].female ? 'Bem-vinda' : 'Bem-vindo'} de volta, ${CHARACTERS[G.state.active].name}.`, 'info');
}

// aplica ao mundo o que está salvo (recursos, recipientes, portas, construções)
function applyWorldState() {
  const S = G.state, W = G.world;
  const byId = new Map();
  for (const n of W.nodes) byId.set(n.id, n);
  for (const [id, t] of Object.entries(S.world.nodes)) { const n = byId.get(id); if (n) { n.depletedUntil = t; G.interact.applyNodeVisual(n, false); } }
  for (const c of W.containers) { const s = S.world.containers[c.id]; if (s) { c.items = s.items; c.respawnAt = s.respawnAt; } }
  for (const d of W.doors) if (S.world.doors[d.id] != null) W.setDoor(d, S.world.doors[d.id], true);
  for (const p of W.pickups) if (S.world.pickups[p.id]) { p.taken = true; p.mesh.visible = false; }
  G.building.loadAll();
  for (const b of S.bags) makeBagMesh(b);
  G.applyLocks();
}
G.applyLocks = () => { G.world.setLocked(REGIONS.filter(r => !G.state.world.unlocked.includes(r.id)).map(r => r.id)); };
G.saveWorldDoor = d => { G.state.world.doors[d.id] = d.open; };
G.saveContainer = c => { G.state.world.containers[c.id] = { items: c.items, respawnAt: c.respawnAt }; };

// ------------------------------------------------------------------
// Introdução curta: Arthur acorda sozinho
function intro() {
  G.intro = true;
  const p = G.player;
  p.model.anim.play('death', { forward: false });
  for (let i = 0; i < 30; i++) p.model.update(0.05, 0);
  G.renderer.cam.zoom = 0.55; G.renderer.cam.tzoom = 0.55;
  const box = $('#intro');
  box.classList.remove('hidden');
  const lines = ['Aimorés, Minas Gerais.', 'Vinte e três dias depois do surto.', 'Arthur acorda sozinho no meio da rua...'];
  let i = 0;
  box.innerHTML = `<div class="itext"></div><button class="skip">Pular ▶▶</button>`;
  const txt = box.querySelector('.itext');
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    box.classList.add('hidden');
    G.renderer.cam.tzoom = G.settings.zoom;
    p.model.anim.dead = false; p.model.anim.action = null;
    p.model.anim.play('getup');
    setTimeout(() => {
      G.intro = false;
      G.ui.dialog([
        { name: 'Arthur', text: 'Onde... onde está todo mundo?', portrait: 'arthur' },
        { name: 'Arthur', text: 'Minha cabeça... Preciso me virar. Madeira, uma ferramenta, água e comida. E um lugar seguro.', portrait: 'arthur' },
        { name: '💡 Dica', text: 'Ande com WASD (ou o joystick). Aperte E (ou ✋) perto de galhos, pedras, árvores e caixas para coletar. Espaço (ou ⚔️) ataca. O terreno à esquerda é a sua base.' },
      ], () => G.ui.refreshQuests());
    }, 2600);
  };
  const next = () => {
    if (finished) return;
    if (i >= lines.length) { done(); return; }
    txt.classList.remove('on'); void txt.offsetWidth;
    txt.textContent = lines[i++]; txt.classList.add('on');
    setTimeout(next, 2300);
  };
  box.querySelector('.skip').onclick = () => { i = lines.length; done(); };
  next();
}

// ------------------------------------------------------------------
// Ações do jogo usadas pelos sistemas
G.pause = (on, key = 'x') => { if (on) G.pauses.add(key); else G.pauses.delete(key); if (on) input.releaseAll(); };
G.paused = () => G.pauses.size > 0;
G.noise = (x, z, r) => { if (r > 0) G.zombies.noise(x, z, r); };
G.giveItem = (id, n = 1, silent = false, extra = null) => {
  const ch = G.player.ch;
  const before = G.knownRecipes || new Set();
  const left = addItem(ch, id, n, extra);
  const got = n - left;
  if (got > 0) { G.ui.feed(id, got); if (!silent) sfx('pickup'); }
  if (left > 0) {
    G.ui.toast('Inventário cheio.', 'bad');
    const p = G.player;
    G.dropBag(p.x + Math.sin(p.rot) * 0.7, p.z + Math.cos(p.rot) * 0.7, [extra ? { ...extra, n: left } : makeStack(id, left)], 'Itens no chão');
  }
  G.crafting.checkDiscover(before);
  G.ui.refreshHud();
  return left;
};
G.afterItemsChanged = () => { G.crafting.checkDiscover(G.knownRecipes); G.ui.refreshHud(); G.ui.refreshQuests(); };
G.addXp = (n, small = false) => {
  const ch = G.player.ch, C = CHARACTERS[ch.id];
  n = n * (1 + (C.special.xp || 0));
  ch.xp += n;
  if (!small && n >= 5) G.fx.text(G.player.x, 2.4, G.player.z, `+${Math.round(n)} XP`, 'xp');
  while (ch.xp >= xpNeeded(ch)) {
    ch.xp -= xpNeeded(ch);
    ch.level++; ch.points++;
    const st = derived(ch);
    ch.hp = st.maxHp; ch.energy = st.maxEnergy;
    sfx('levelUp');
    G.ui.toast(`⭐ Nível ${ch.level}! +1 ponto de habilidade (K)`, 'good', 4);
    G.fx.burst(G.player.x, 1.5, G.player.z, 'spark', 30, 1.2);
    G.quests.check();
  }
  G.ui.refreshHud();
};
// mochila/itens no chão
function makeBagMesh(b) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: b.death ? '#7a3a2a' : '#5a5040', roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.35), m); body.position.y = 0.18; body.castShadow = true; g.add(body);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.37), new THREE.MeshStandardMaterial({ color: '#3a2e24' })); flap.position.y = 0.38; g.add(flap);
  if (b.death) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffcc55', transparent: true, depthWrite: false, opacity: 0.8 })); s.scale.set(0.12, 1.4, 1); s.position.y = 1.1; g.add(s); }
  g.position.set(b.x, G.world.heightAt(b.x, b.z), b.z); g.rotation.y = R() * 6;
  G.renderer.scene.add(g);
  b._mesh = g;
  b._obj = G.world.register({ kind: 'bag', x: b.x, z: b.z, r: 0.8, name: b.name, items: b.items, bag: b });
}
G.dropBag = (x, z, items, name = 'Itens', death = false) => {
  // junta com uma pilha que já está no chão ali perto
  const near = !death && G.state.bags.find(b => !b.death && Math.hypot(b.x - x, b.z - z) < 1.5);
  if (near) { for (const s of items) near.items.push(s); return near; }
  const b = { id: 'b' + Date.now() + Math.floor(R() * 1000), x, z, items, name, death, owner: G.state.active };
  G.state.bags.push(b);
  makeBagMesh(b);
  return b;
};
G.removeBag = o => {
  const b = o.bag; if (!b) return;
  G.renderer.scene.remove(b._mesh); G.world.unregister(b._obj);
  const i = G.state.bags.indexOf(b); if (i >= 0) G.state.bags.splice(i, 1);
};
G.equip = idx => {
  const p = G.player, ch = p.ch, s = ch.inv[idx];
  if (!s) return;
  const d = item(s.id);
  if (!d.slot) return;
  const old = ch.equip[d.slot];
  ch.equip[d.slot] = s; ch.inv[idx] = old || null;
  const spill = compact(ch);
  if (spill.length) G.dropBag(p.x, p.z, spill, 'Itens que não couberam');
  p.refreshEquip();
  p.model.anim.play('equip');
  sfx('pickup');
};
G.unequip = slot => {
  const p = G.player, ch = p.ch, s = ch.equip[slot];
  if (!s) return;
  ch.equip[slot] = null;
  const cap = capacity(ch);
  const i = ch.inv.findIndex((x, j) => j < cap && !x);
  if (i >= 0) ch.inv[i] = s; else G.dropBag(p.x, p.z, [s], 'Itens largados');
  const spill = compact(ch);
  if (spill.length) G.dropBag(p.x, p.z, spill, 'Itens que não couberam');
  p.refreshEquip();
  sfx('pickup');
};
// guarda recursos e comida nos baús da base
G.stashResources = (only = null) => {
  const ch = G.player.ch, cap = capacity(ch);
  const chests = only ? [only] : G.state.base.structures.filter(s => s.items).sort((a, b) => Math.hypot(a.x - G.player.x, a.z - G.player.z) - Math.hypot(b.x - G.player.x, b.z - G.player.z));
  if (!chests.length) { G.ui.toast('Construa um baú na base primeiro.', 'bad'); return; }
  let moved = 0;
  for (let i = 0; i < cap; i++) {
    const s = ch.inv[i];
    if (!s) continue;
    const d = item(s.id);
    if (!['recurso'].includes(d.cat)) continue;
    for (const c of chests) {
      const left = addToSlots(c.items, c.items.length, s.id, s.n);
      moved += s.n - left; s.n = left;
      if (!left) { ch.inv[i] = null; break; }
    }
  }
  sfx('open');
  G.ui.toast(moved ? `📦 ${moved} recursos guardados.` : 'Nada para guardar (ou baús cheios).', moved ? 'good' : 'info');
  G.afterItemsChanged(); G.ui.refresh();
};
G.quickHeal = () => {
  const p = G.player, ch = p.ch;
  if (p.busy || p.dead) return;
  const st = derived(ch);
  if (ch.hp >= st.maxHp) { G.ui.toast('Sua vida já está cheia.', 'info'); return; }
  for (const id of ['bandagem', 'remedio', 'kit_medico']) {
    const i = ch.inv.findIndex(s => s && s.id === id);
    if (i >= 0) { p.consume(i); return; }
  }
  G.ui.toast('Sem bandagens ou remédios.', 'bad'); sfx('denied');
};
G.sleep = full => {
  const ch = G.player.ch, st = derived(ch);
  const fade = $('#fade');
  fade.classList.add('on');
  setTimeout(() => {
    let mins = 60;
    if (full) { const h = (G.state.time / 60) % 24; mins = ((6 - h + 24) % 24) * 60; }
    advanceTime(mins);
    ch.hp = Math.min(st.maxHp, ch.hp + (full ? 45 : 15));
    ch.energy = st.maxEnergy;
    ch.hunger = Math.max(5, ch.hunger - (full ? 18 : 4)); ch.thirst = Math.max(5, ch.thirst - (full ? 22 : 5));
    G.save();
    fade.classList.remove('on');
    G.ui.toast(full ? '☀️ Um novo dia em Aimorés.' : 'Você descansou um pouco.', 'info');
  }, 900);
};
function advanceTime(mins) {
  G.state.time += mins;
  while (G.state.time >= 24 * 60 * G.state.day) G.state.day++;
}
G.save = (show = false) => {
  if (!G.state) return;
  const p = G.player;
  if (p) { p.ch.x = p.x; p.ch.z = p.z; p.ch.rot = p.rot; }
  const clean = JSON.parse(JSON.stringify(G.state, (k, v) => k.startsWith('_') ? undefined : v));
  const ok = writeSave(clean);
  if (show) G.ui.toast(ok ? '💾 Jogo salvo.' : 'Não foi possível salvar.', ok ? 'good' : 'bad');
  G.saveT = 60;
};
G.requestSave = () => { G.saveT = Math.min(G.saveT, 2); };
G.saveSettings = () => saveSettings(G.settings);

// alvo do objetivo atual (bússola/minimapa)
let targetCache = null, targetT = 0;
G.questTarget = () => targetCache;
function computeTarget() {
  const cur = G.quests.current();
  if (!cur || !cur.o.target) return null;
  const t = cur.o.target, p = G.player, W = G.world;
  const nearest = pred => { let b = null, bd = 1e9; for (const n of W.nodes) { if (n.depletedUntil > G.state.time || !pred(n)) continue; const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < bd) { bd = d; b = n; } } return b; };
  if (t === 'tree') return nearest(n => n.type === 'galho' || n.type === 'arvore');
  if (t === 'stone') return nearest(n => n.type === 'seixo');
  if (t === 'food') return nearest(n => ['goiabeira', 'bananeira', 'mangueira'].includes(n.type));
  if (t === 'water') { const pond = { x: POND.x + 12, z: POND.z }, river = { x: p.x, z: RIVER_Z - 3 }; return Math.hypot(pond.x - p.x, pond.z - p.z) < Math.hypot(river.x - p.x, river.z - p.z) ? pond : river; }
  if (t === 'base') return { x: (BASE.x0 + BASE.x1) / 2, z: (BASE.z0 + BASE.z1) / 2 };
  if (t === 'lore') { let b = null, bd = 1e9; for (const k of W.pickups) { if (k.taken) continue; const d = Math.hypot(k.x - p.x, k.z - p.z); if (d < bd) { bd = d; b = k; } } return b; }
  if (t.startsWith('poi:')) {
    const P0 = W.pois[t.slice(4)];
    // resgate: aponta para o sobrevivente
    return P0;
  }
  return null;
}

// ------------------------------------------------------------------
// Morte: mochila fica no local, renasce na base
bus.on('playerDied', () => {
  const p = G.player, ch = p.ch;
  G.state.stats.deaths++;
  setTimeout(() => {
    // perde parte dos itens carregados; o resto fica na mochila no chão
    const kept = [], lost = [];
    for (let i = 0; i < ch.inv.length; i++) {
      const s = ch.inv[i]; if (!s) continue;
      const d = item(s.id);
      if (d.key) continue; // itens de história ficam
      ch.inv[i] = null;
      if (R() < 0.3) { lost.push(d.icon); continue; }
      if (d.stack > 1 && s.n > 1) { const k = Math.ceil(s.n * (0.6 + R() * 0.3)); if (k < s.n) lost.push(d.icon); s.n = k; }
      kept.push(s);
    }
    if (kept.length) G.dropBag(p.x, p.z, kept, `Mochila de ${CHARACTERS[ch.id].name}`, true);
    for (const s of Object.values(ch.equip)) if (s && s.d != null) s.d = Math.max(1, Math.round(s.d * 0.8));
    const box = $('#death');
    box.innerHTML = `<div class="dbox"><h1>VOCÊ MORREU</h1><p>${esc(CHARACTERS[ch.id].name)} caiu em ${esc((regionAt(p.x, p.z) || { name: 'Aimorés' }).name)}.</p><p>Os itens que você carregava ficaram numa mochila 🎒 no local (marcada no mapa).${lost.length ? '<br>Alguns se perderam: ' + lost.slice(0, 10).join(' ') : ''}</p><p class="small">Os equipamentos ficaram com você, mas desgastados.</p><button>Renascer na base ⛺</button></div>`;
    box.classList.remove('hidden');
    box.querySelector('button').onclick = () => { box.classList.add('hidden'); respawn(); };
  }, 2200);
});
function respawn() {
  const ch = G.player.ch, st = derived(ch);
  const bed = G.state.base.structures.find(s => s.id === G.state.base.spawn);
  const x = bed ? bed.x + 1.5 : (BASE.x0 + BASE.x1) / 2, z = bed ? bed.z + 1.5 : (BASE.z0 + BASE.z1) / 2 + 6;
  ch.x = x; ch.z = z;
  ch.hp = st.maxHp * 0.5; ch.energy = st.maxEnergy; ch.hunger = Math.max(ch.hunger, 40); ch.thirst = Math.max(ch.thirst, 40); ch.sick = 0;
  for (const z of [...G.zombies.list]) { if (!z.fixed) { z.remove(); G.zombies.list.splice(G.zombies.list.indexOf(z), 1); } }
  G.player.setChar(ch);
  G.renderer.follow(x, z, 1, true);
  advanceTime(120);
  G.save();
  G.ui.refresh();
  G.ui.toast('Você acordou na base. Recupere sua mochila!', 'info', 4);
}

// ------------------------------------------------------------------
function wireEvents() {
  bus.on('zombieKilled', z => {
    if (!G.state) return;
    G.state.stats.kills++;
    G.addXp(z.def.xp);
    if (z.def.boss) G.ui.toast(`💀 ${z.def.name} foi derrotado!`, 'good', 5);
  });
  bus.on('lockedRegion', R => {
    if ((G.lockMsgT || 0) > G.clock) return;
    G.lockMsgT = G.clock + 3;
    const why = G.quests.lockReason(R).filter(x => !x.ok).map(x => x.text).join(' · ');
    G.ui.toast(`🔒 ${R.name}: área bloqueada. Precisa de: ${why}`, 'bad', 3.5);
  });
  // pontaria do mouse no chão (modo construção)
  G.pointer = null;
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), v = new THREE.Vector3();
  $('#game').addEventListener('mousemove', e => {
    if (!G.building || !G.building.mode) return;
    ray.setFromCamera({ x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }, G.renderer.camera);
    if (ray.ray.intersectPlane(plane, v)) G.pointer = { x: v.x, z: v.z, t: G.clock };
  });
  window.addEventListener('beforeunload', () => { if (G.mode === 'game' && !G.player.dead) G.save(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'game') G.save(); });
}

function handleKeys() {
  const ui = G.ui, B = G.building;
  if (input.pressed('Escape')) {
    if (!$('#dialog').classList.contains('hidden')) { ui.dialogNext && ui.dialogNext(); return; }
    if (ui.choiceClose) { ui.choiceClose(); return; }
    if (ui.menu) { ui.closeMenu(); return; }
    if (B.mode) { B.exit(); return; }
    ui.openMenu('pausa'); return;
  }
  // diálogo: espaço/enter avança
  if (!$('#dialog').classList.contains('hidden')) { if (input.anyPressed('Space', 'Enter', 'KeyE')) ui.dialogNext && ui.dialogNext(); return; }
  if (ui.choiceClose) return;
  const menus = { KeyI: 'inventario', Tab: 'inventario', KeyC: 'crafting', KeyB: 'construcao', KeyM: 'mapa', KeyJ: 'missoes', KeyK: 'habilidades', KeyP: 'sobreviventes', KeyO: 'sobreviventes' };
  for (const [k, m] of Object.entries(menus)) if (input.pressed(k)) { sfx('ui'); ui.toggleMenu(m); return; }
  if (ui.menu) return;
  if (B.mode) {
    if (input.pressed('KeyR')) B.rotate();
    if (input.anyPressed('Enter', 'Mouse0')) { B.confirm(); if (B.mode) ui.buildBar(B.mode.type); }
    if (input.pressed('Mouse2')) B.exit();
    return;
  }
  if (input.pressed('KeyQ')) G.quickHeal();
  if (input.pressed('KeyR')) G.player.reload();
}

// ------------------------------------------------------------------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  G.renderer.render();
  input.clearPressed();
}
// simula quadros sem desenhar (usado em testes automáticos)
G.simulate = (seconds, dt = 1 / 30) => { for (let t = 0; t < seconds; t += dt) step(dt); G.renderer.render(); };

function step(dt) {
  G.clock += dt;
  const Rn = G.renderer;
  if (G.mode === 'title') {
    G.titleT += dt;
    const a = G.titleT * 0.03;
    Rn.cam.zoom = Rn.cam.tzoom = 1.5;
    Rn.follow(-20 + Math.sin(a) * 60, -10 + Math.cos(a * 0.7) * 30, dt, G.titleT < 0.1);
    G.world.update(dt, 9999, 9999);
    G.fx.update(dt, Rn.camera);
    return;
  }
  if (G.mode !== 'game') return;
  const p = G.player;
  handleKeys();
  const paused = G.paused();
  if (!paused) {
    // tempo: 1 s real = 1 min do jogo (noite passa mais rápido)
    const hour = (G.state.time / 60) % 24;
    advanceTime(dt * (hour >= 20 || hour < 5 ? 1.6 : 1));
    G.inBaseSafe = inBase(p.x, p.z, 2);
    // entrada
    let inp = null;
    if (!G.intro && !G.building.mode) {
      const m = input.move();
      inp = { move: m, run: input.running() };
      // pressionar rápido também vale (quadros lentos não perdem o toque)
      if ((input.attackHeld() || input.anyPressed('Space', 'Mouse0')) && !p.busy) p.tryAttack();
      // segurar E repete só coleta; portas, baús e conversas pedem soltar o botão
      const tapE = input.anyPressed('KeyE', 'KeyF');
      const iw = input.interactHeld() || tapE;
      if (tapE) G.interactLatch = false;
      if (!iw) G.interactLatch = false;
      else if (!p.busy && !G.interactLatch && (!G.lastInteract || G.clock - G.lastInteract > 0.35)) {
        const o = G.interact.current;
        G.lastInteract = G.clock;
        G.interactLatch = !!o && !(o.kind === 'node' || o.kind === 'pickup');
        G.interact.use(o);
      }
      // zoom
      if (input.mouse.wheel) { G.settings.zoom = clamp(G.settings.zoom + input.mouse.wheel * 0.05, 0.75, 1.4); Rn.cam.tzoom = G.settings.zoom; input.mouse.wheel = 0; }
    } else if (G.building.mode) {
      const m = input.move();
      inp = { move: m, run: false };
      G.building.updateMode(dt, G.pointer && G.clock - G.pointer.t < 3 ? G.pointer : null);
      input.mouse.wheel = 0;
    }
    p.update(dt, inp);
    G.zombies.update(dt);
    G.survivors.update(dt);
    G.interact.update(dt);
    G.building.update(dt);
    G.quests.update(dt);
    // recursos voltam com o tempo
    G.respawnT = (G.respawnT || 0) - dt;
    if (G.respawnT <= 0) { G.respawnT = 5; G.interact.respawnTick(); }
    targetT -= dt;
    if (targetT <= 0) { targetT = 1; targetCache = computeTarget(); }
    // salvamento automático
    G.saveT -= dt;
    if (G.saveT <= 0 && !p.dead) G.save();
  } else {
    // pausado: personagens continuam animando
    p.model.update(0, 0);
  }
  const hour = (G.state.time / 60) % 24;
  const R0 = regionAt(p.x, p.z);
  const danger = R0 ? (R0.danger - 1) / 2 : 0;
  Rn.setTime(hour / 24, danger);
  Rn.lamp.position.set(p.x, 2.2, p.z + 0.5);
  XRAY.value.set(p.x, G.world.heightAt(p.x, p.z), p.z);
  Rn.follow(p.x, p.z, dt);
  G.world.update(dt, p.x, p.z);
  G.fx.update(dt, Rn.camera);
  setListener(p.x, p.z);
  updateAmbient(dt, Rn.night, danger);
  setMusicIntensity(Math.min(1, danger * 0.6 + (G.zombies.chasing > 0 ? 0.6 : 0)));
  updateMusic(dt);
  G.ui.update(dt);
}

boot().catch(e => {
  console.error(e);
  const l = $('#loading .lmsg'); if (l) l.textContent = 'Erro ao carregar: ' + e.message;
});
