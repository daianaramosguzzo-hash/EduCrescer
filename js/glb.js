// Modelos 3D importados (glTF/GLB com esqueleto e animações).
// O herói (Leo) e a Pingolote usam arquivos próprios em assets/models/. Os modelos
// recebem o mesmo acabamento do resto do jogo (sombreamento toon, luz de borda
// e contorno de desenho) e expõem a mesma interface dos modelos procedurais,
// então o resto do código não precisa saber de onde o modelo veio.
// Se um arquivo não carregar, o jogo usa o modelo procedural de antes.
import * as THREE from '../lib/three.module.min.js';
import { GLTFLoader } from '../lib/addons/GLTFLoader.js';
import { MeshoptDecoder } from '../lib/addons/meshopt_decoder.module.js';
import { clone as cloneSkinned } from '../lib/addons/SkeletonUtils.js';
import { mergeVertices } from '../lib/addons/BufferGeometryUtils.js';
import { GRADIENT, addRim } from './models.js';

// altura no jogo (unidades do mapa) e espessura do contorno de cada modelo
const DEFS = {
  // herói: modelo final texturizado e rigado no Blender (Idle, Walk, Run, Jump,
  // Attack), otimizado com gltfpack; mantém o material original com a textura
  leo: { file: 'assets/models/leo.glb', height: 1.66, outline: 0.009, fixWinding: false, keepMaterial: true, speeds: { walk: 2.6, run: 2.2 } },
  // pupilas, nariz e espinhos pequenos ficam sem contorno para não borrar o rosto
  pingolote: { file: 'assets/models/pingolote.glb', height: 0.8, outline: 0.011, noOutline: /black|darkblue|spike/i },
};
const loaded = {};

export function hasGlb(name) { return !!loaded[name]; }

// Carrega todos os modelos; nunca falha (o que não carregar fica de fora).
export async function loadGlbModels() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  await Promise.all(Object.entries(DEFS).map(async ([name, def]) => {
    try {
      const gltf = await fetchGlb(loader, def.file);
      prepare(gltf.scene, def);
      gltf.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(gltf.scene, true);
      const size = box.getSize(new THREE.Vector3());
      loaded[name] = { gltf, scale: def.height / size.y, minY: box.min.y, def };
    } catch (e) {
      console.warn('Modelo 3D não carregou, usando o procedural:', name, e && e.message);
    }
  }));
}

// Hospedagens que não servem .glb recebem uma cópia em base64 (arquivo .glb.txt)
async function fetchGlb(loader, file) {
  try { return await loader.loadAsync(file); } catch (e) {
    const r = await fetch(file + '.txt');
    if (!r.ok) throw e;
    const bin = Uint8Array.from(atob((await r.text()).trim()), c => c.charCodeAt(0));
    return await loader.parseAsync(bin.buffer, '');
  }
}

// Normais para sombreamento + normais suaves à parte para o contorno.
// Peças com poucos vértices (caixas) ficam facetadas, as arredondadas ficam lisas.
function prepare(root, def = {}) {
  root.traverse(o => {
    if (!o.isMesh || o.geometry.userData.prepared) return;
    let g = o.geometry;
    const hadNormals = !!g.attributes.normal;
    if (!g.index) g = mergeVertices(g, 1e-4);
    if (def.fixWinding !== false && signedVolume(g) < 0) flipWinding(g);
    if (!hadNormals) g.computeVertexNormals();
    g.setAttribute('onormal', g.attributes.normal.clone());
    if (!hadNormals && g.attributes.position.count < 120) {
      g = g.toNonIndexed();
      g.computeVertexNormals();
    }
    g.userData.prepared = true;
    o.geometry = g;
  });
}

// Algumas peças vêm com as faces "do avesso" (ordem dos vértices invertida):
// o volume com sinal negativo denuncia isso, e aí a ordem é corrigida
// (sem isso a peça some de frente e o contorno aparece por cima dela).
function signedVolume(g) {
  const p = g.attributes.position, idx = g.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let v = 0;
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(p, idx.getX(i)); b.fromBufferAttribute(p, idx.getX(i + 1)); c.fromBufferAttribute(p, idx.getX(i + 2));
    v += a.dot(b.cross(c));
  }
  return v / 6 < -1e-5 ? -1 : 1;
}
function flipWinding(g) {
  const idx = g.index;
  for (let i = 0; i < idx.count; i += 3) {
    const t = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, t);
  }
  idx.needsUpdate = true;
}

// contorno: casca invertida empurrada pela normal suave depois do esqueleto
function outlineMaterial(width) {
  const m = new THREE.MeshBasicMaterial({ color: '#1a1410', side: THREE.BackSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.olw = { value: width };
    sh.vertexShader = 'attribute vec3 onormal;\nuniform float olw;\n' + sh.vertexShader.replace(
      '#include <skinning_vertex>',
      `#include <skinning_vertex>
      #ifdef USE_SKINNING
        transformed += normalize((skinMatrix * vec4(onormal, 0.0)).xyz) * olw;
      #else
        transformed += normalize(onormal) * olw;
      #endif`);
  };
  m.customProgramCacheKey = () => 'glb-outline';
  return m;
}

function toonFrom(src, tint, def = {}) {
  const c = src.color ? src.color.clone() : new THREE.Color('#ffffff');
  if (tint) c.lerp(tint.color, tint.k);
  const m = new THREE.MeshToonMaterial({ color: c, gradientMap: GRADIENT, map: src.map || null, vertexColors: !!src.vertexColors, side: def.doubleSide ? THREE.DoubleSide : THREE.FrontSide });
  if (src.emissive && src.emissive.getHex()) { m.emissive = src.emissive.clone(); m.emissiveIntensity = src.emissiveIntensity ?? 1; }
  m.name = src.name;
  addRim(m, 0.28);
  return m;
}

// Instancia um modelo carregado: materiais toon próprios, contorno e mixer.
function instance(name, { tint = null, sizeMul = 1 } = {}) {
  const L = loaded[name];
  const scene = cloneSkinned(L.gltf.scene);
  const olMat = outlineMaterial(L.def.outline / (L.scale * sizeMul));
  const meshes = [];
  scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const conv = L.def.keepMaterial
      ? mats.map(m => { const c = m.clone(); c.side = THREE.DoubleSide; return c; })
      : mats.map(m => toonFrom(m, tint && tint.only && !tint.only.test(m.name || '') ? null : tint, L.def));
    o.material = Array.isArray(o.material) ? conv : conv[0];
    o.castShadow = true;
    o.receiveShadow = false;
    o.frustumCulled = false;
    if (L.def.noOutline && L.def.noOutline.test(conv[0].name || '')) { o.userData.noOutline = true; o.castShadow = false; continue; }
    const ol = o.isSkinnedMesh ? new THREE.SkinnedMesh(o.geometry, olMat) : new THREE.Mesh(o.geometry, olMat);
    if (o.isSkinnedMesh) ol.bind(o.skeleton, o.bindMatrix);
    ol.position.copy(o.position); ol.quaternion.copy(o.quaternion); ol.scale.copy(o.scale);
    ol.frustumCulled = false;
    ol.userData.noOutline = true;
    o.parent.add(ol);
  }
  const inner = new THREE.Group();
  inner.add(scene);
  inner.scale.setScalar(L.scale * sizeMul);
  inner.position.y = -L.minY * L.scale * sizeMul;
  const group = new THREE.Group();
  group.add(inner);
  const mixer = new THREE.AnimationMixer(scene);
  const clips = {};
  for (const clip of L.gltf.animations) clips[clip.name] = mixer.clipAction(clip);
  return { group, inner, scene, mixer, clips, olMat, def: L.def, height: L.def.height * sizeMul };
}

// Controla qual animação toca, com transição suave e golpes de uma vez só.
function animator(mixer, clips, speeds = {}) {
  let current = null, oneShot = null;
  const play = (name, fade = 0.2) => {
    const a = clips[name];
    if (!a || a === current) return;
    a.reset().setEffectiveTimeScale(speeds[name] || 1).setEffectiveWeight(1).play();
    if (current) current.crossFadeTo(a, fade, false);
    current = a;
  };
  mixer.addEventListener('finished', e => {
    if (e.action !== oneShot) return;
    oneShot = null;
    if (current) { current.reset().play(); e.action.crossFadeTo(current, 0.15, false); }
  });
  return {
    loop: play,
    once(name) {
      const a = clips[name];
      if (!a) return;
      a.reset().setLoop(THREE.LoopOnce, 1).setEffectiveTimeScale(speeds[name] || 1).setEffectiveWeight(1).play();
      a.clampWhenFinished = false;
      if (current) current.crossFadeTo(a, 0.1, false);
      oneShot = a;
    },
    busy: () => !!oneShot,
  };
}

// Personagem: mesma interface de makeHuman (group, head, body, update, pose).
// As animações são achadas pelo nome em português ou em inglês.
const ALIASES = {
  idle: ['Idle'], walk: ['Andar', 'Walk'], run: ['Correr', 'Run'], jump: ['Pular', 'Jump'],
  attack: ['Atacar', 'Attack'], wave: ['Acenar', 'Jump'], interact: ['Interagir', 'Idle'], point: ['Apontar', 'Attack'],
};
const ACTIONS = { pular: 'jump', jump: 'jump', interagir: 'interact', apontar: 'point', atacar: 'attack', attack: 'attack', throw: 'attack', fist: 'wave', acenar: 'wave' };
export function makeGlbHuman(name) {
  const it = instance(name);
  const clip = k => (ALIASES[k] || [k]).find(n => it.clips[n]);
  const sp = it.def.speeds || {};
  const speeds = { [clip('walk')]: sp.walk || 1.55, [clip('run')]: sp.run || 1.1 };
  const anim = animator(it.mixer, it.clips, speeds);
  anim.loop(clip('idle'), 0);
  it.mixer.update(Math.random() * 3);
  let head = null, body = null;
  it.scene.traverse(o => { if (/^head$/i.test(o.name)) head = o; if (/^chest$/i.test(o.name)) body = o; });
  const api = {
    group: it.group, head: head || it.inner, body: body || it.inner, height: it.height, glb: true, hero: true,
    update(dt, moving, speed = 1) {
      if (!anim.busy()) anim.loop(clip(moving ? (speed > 1.3 ? 'run' : 'walk') : 'idle'));
      it.mixer.update(dt);
    },
    // interface antiga: 'throw' (arremessar orbe), 'fist' (comemorar), 'rest'
    pose(n) { if (n !== 'rest') api.play(n); },
    play(n) { const key = ACTIONS[String(n).toLowerCase()] || String(n).toLowerCase(); const c = clip(key) || (it.clips[n] ? n : null); if (c) anim.once(c); },
    setExpression() {},
  };
  return api;
}

// Criatura: mesma interface de makeCreature (group, inner, height, update)
export function makeGlbCreature(name, variant = null) {
  // cada indivíduo selvagem tem leve diferença de tom (só no corpo) e tamanho
  const vq = variant === null ? 0 : Math.round((variant - 0.5) * 4) / 4;
  const tint = vq ? { color: new THREE.Color(vq > 0 ? '#7fe0ff' : '#1e4aa0'), k: Math.abs(vq) * 0.35, only: /body/i } : null;
  const it = instance(name, { tint, sizeMul: variant === null ? 1 : 0.94 + variant * 0.12 });
  const anim = animator(it.mixer, it.clips, { Andar: 1.3, Correr: 1.1 });
  anim.loop('Idle', 0);
  it.mixer.update(Math.random() * 2);
  return {
    group: it.group, inner: it.inner, height: it.height, glb: true,
    update(dt, moving = false, speed = 1) {
      if (!anim.busy()) anim.loop(moving ? (speed > 1.3 ? 'Correr' : 'Andar') : 'Idle');
      it.mixer.update(dt);
    },
    play(name) { anim.once(name); },
  };
}
