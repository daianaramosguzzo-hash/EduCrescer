// Exporta os modelos procedurais do jogo (pessoas, criaturas, orbes e o cenário
// de cada mapa) para .glb, para a versão Unity usar exatamente as mesmas formas.
// Convenções de nomes que a Unity entende:
//   __contorno   casca de contorno (desenhada com o material de contorno)
//   __semsombra  peça que não projeta sombra
//   agua         superfície de água (recebe o shader de água da Unity)
//   terreno      chão pintado do mapa
import * as THREE from 'three';
import { GLTFExporter } from './lib/exporters/GLTFExporter.js';
import { makeHuman, makeCreature, makeOrb, LOOKS } from '../../js/models.js';
import { SPECIES } from '../../js/data.js';
import { MAPS } from '../../js/maps.js';
import { World } from '../../js/world.js';
import { SKIES } from '../../js/env.js';
import { loadGlbModels } from '../../js/glb.js';
import { loadProps } from '../../js/props.js';

const log = msg => { document.querySelector('#log').textContent += msg + '\n'; console.log(msg); };
const exporter = new GLTFExporter();

async function put(path, body) {
  const r = await fetch('/salvar/' + path, { method: 'PUT', body });
  if (!r.ok) throw new Error('falha ao gravar ' + path);
}

// peças animadas por código: o nome leva os ângulos originais (ordem XYZ do three.js),
// para a Unity recompor a rotação exatamente como o jogo faz (ex.: "asa_d@0.3000,0,0.2000")
const ANIMATED = /^(perna|braco|cabeca|corpo|interno|asa|garra|borboleta|cauda|giro|redemoinho|segmento|chama|brilho)/;

function mark(root) {
  root.traverse(o => {
    if (ANIMATED.test(o.name) && !o.name.includes('@')) {
      const r = o.rotation;
      o.name += '@' + [r.x, r.y, r.z].map(v => +v.toFixed(4)).join(',');
    }
    if (!o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const base = o.name || 'malha';
    if (m && m.isMeshBasicMaterial && m.side === THREE.BackSide) o.name = base + '__contorno';
    else if (!o.castShadow && !/^(agua|terreno)/.test(base)) o.name = base + '__semsombra';
  });
  root.updateMatrixWorld(true);
}

async function exportGlb(root, path) {
  mark(root);
  const buf = await exporter.parseAsync(root, { binary: true, onlyVisible: true });
  await put('Modelos/' + path, buf);
  return buf.byteLength;
}

// ------------------------------------------------ pessoas
function nameHumanParts(model) {
  const root = model.group, body = root.children[0];
  body.name = 'corpo';
  // tira a aura dos líderes (a Unity faz as partículas)
  for (const c of [...root.children]) if (c !== body) root.remove(c);
  let legs = 0, arms = 0;
  for (const c of body.children) {
    if (c.isMesh) continue;
    const y = c.position.y;
    if (Math.abs(y - 0.45) < 0.02) c.name = 'perna_' + legs++;
    else if (Math.abs(y - 0.87) < 0.02) c.name = 'braco_' + arms++;
    else if (Math.abs(y - 1.12) < 0.02) c.name = 'cabeca';
  }
}

async function exportPeople(manifest) {
  for (const [id, look] of Object.entries(LOOKS)) {
    if (look.hero) continue;
    const m = makeHuman(look);
    nameHumanParts(m);
    m.group.name = 'pessoa_' + id;
    const n = await exportGlb(m.group, `Pessoas/${id}.glb`);
    manifest.pessoas[id] = { lider: look.leader || null, escala: look.scale || 1 };
    log(`pessoa ${id} (${(n / 1024).toFixed(0)} KB)`);
  }
}

// ------------------------------------------------ criaturas
async function exportCreatures(manifest) {
  for (const [id, s] of Object.entries(SPECIES)) {
    const spec = s.model;
    if (spec.glb) { manifest.criaturas[id] = { glb: spec.glb, altura: null }; continue; }
    const m = makeCreature(spec);
    m.group.name = 'criatura_' + id;
    const n = await exportGlb(m.group, `Criaturas/${id}.glb`);
    manifest.criaturas[id] = { altura: +m.height.toFixed(3), flutua: m.inner.name === 'interno_flutua' };
    log(`criatura ${id} (${(n / 1024).toFixed(0)} KB)`);
  }
}

async function exportObjects() {
  const orb = makeOrb('#e03a3a'); orb.name = 'orbe';
  await exportGlb(orb, 'Objetos/orbe.glb');
  const sup = makeOrb('#3a6ad0'); sup.name = 'superorbe';
  await exportGlb(sup, 'Objetos/superorbe.glb');
  log('orbes');
}

// ------------------------------------------------ mapas
const G = {
  state: { starter: null, rivalStarter: null, flags: {}, badges: [], party: [] },
  flag: () => false, hasBadge: () => false,
};

async function exportMaps(manifest) {
  const world = new World({ capabilities: { getMaxAnisotropy: () => 8 } });
  world.player = { x: -999, z: -999, group: new THREE.Group() };
  world.quality = { density: 1, shadow: 2048 };
  for (const id of Object.keys(MAPS)) {
    const map = MAPS[id];
    try { world.load(map, G); } catch (e) { log(`mapa ${id}: ERRO ${e.message}`); continue; }
    // criaturas selvagens e itens no chão ficam por conta da Unity
    for (const w of world.wilds) world.mapGroup.remove(w.group);
    for (const it of map.items || []) if (it._mesh) { world.mapGroup.remove(it._mesh); it._mesh = null; }
    if (world.terrain) world.terrain.name = 'terreno';
    world.mapGroup.traverse(o => {
      if (!o.isMesh || o === world.terrain) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && m.isMeshToonMaterial && m.transparent && (o.geometry.type === 'PlaneGeometry' || o.isInstancedMesh)) o.name = 'agua';
    });
    world.mapGroup.name = 'mapa_' + id;
    const n = await exportGlb(world.mapGroup, `Mapas/${id}.glb`);
    manifest.mapas.push(id);
    log(`mapa ${id} (${(n / 1024 / 1024).toFixed(1)} MB)`);
  }
}

async function run(which) {
  for (const b of document.querySelectorAll('button')) b.disabled = true;
  const t0 = performance.now();
  const manifest = { pessoas: {}, criaturas: {}, mapas: [] };
  try {
    await Promise.all([loadGlbModels(), loadProps()]);
    if (which !== 'mapas') { await exportPeople(manifest); await exportCreatures(manifest); await exportObjects(); }
    if (which !== 'pers') await exportMaps(manifest);
    if (which === 'tudo') {
      await put('Modelos/manifesto.json', JSON.stringify(manifest, null, 1));
      await put('Dados/ceus.json', JSON.stringify(SKIES, null, 1));
    }
    log(`PRONTO em ${((performance.now() - t0) / 1000).toFixed(0)} s`);
    window.exportDone = true;
  } catch (e) {
    log('ERRO: ' + (e.stack || e.message));
    window.exportError = e.message;
  }
  for (const b of document.querySelectorAll('button')) b.disabled = false;
}

document.querySelector('#tudo').onclick = () => run('tudo');
document.querySelector('#pers').onclick = () => run('pers');
document.querySelector('#mapas').onclick = () => run('mapas');
window.runExport = run;
