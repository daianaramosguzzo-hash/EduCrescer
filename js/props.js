// Objetos de cenário vindos do BlenderKit (modelos CC0 simplificados no Blender):
// rochas com musgo, touceira de capim e a árvore laranja (bordo de outono).
// Cada arquivo vira geometrias prontas para instanciar, com o mesmo acabamento
// toon do jogo. Se um arquivo não carregar, o cenário usa as peças procedurais.
import * as THREE from '../lib/three.module.min.js';
import { GLTFLoader } from '../lib/addons/GLTFLoader.js';
import { MeshoptDecoder } from '../lib/addons/meshopt_decoder.module.js';
import { fetchGlb } from './glb.js';

export const PROPS = { rocks: null, grass: null, tree: null };

export async function loadProps() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const load = async (file, build) => {
    try { build(await fetchGlb(loader, 'assets/models/' + file)); } catch (e) {
      console.warn('Cenário 3D não carregou, usando o procedural:', file, e && e.message);
    }
  };
  await Promise.all([
    load('rochas.glb', g => { PROPS.rocks = parts(g).map(p => ({ geo: normalize(p.geo, { width: 1 }), map: p.map })); }),
    load('grama.glb', g => { const [p] = parts(g); PROPS.grass = { geo: normalize(p.geo, { width: 1 }), map: p.map }; }),
    load('arvore.glb', g => {
      const by = Object.fromEntries(parts(g).map(p => [p.name, p]));
      // tronco e folhas usam a mesma escala (altura da árvore inteira = 2.8)
      const fit = (lo) => {
        const t = by['trunk' + lo], l = by['leaves' + lo];
        const box = new THREE.Box3().setFromBufferAttribute(t.geo.attributes.position).union(new THREE.Box3().setFromBufferAttribute(l.geo.attributes.position));
        const k = 2.8 / (box.max.y - box.min.y);
        const m = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
        return { trunk: t.geo.applyMatrix4(m), leaves: l.geo.applyMatrix4(m) };
      };
      PROPS.tree = { hi: fit(''), lo: fit('_lo'), trunkMap: by.trunk.map, leafMap: by.leaves.map };
    }),
  ]);
}

// malhas do arquivo com a transformação aplicada (atributos quantizados viram float)
function parts(gltf) {
  const out = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const src = o.geometry, geo = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const a = src.attributes[name];
      if (!a) continue;
      const arr = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c);
      geo.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
    }
    if (src.index) geo.setIndex(Array.from(src.index.array));
    geo.applyMatrix4(o.matrixWorld);
    const map = o.material && o.material.map;
    if (map) { map.anisotropy = 4; }
    out.push({ name: o.parent && o.parent.name || o.name, geo, map });
  });
  return out;
}

// centraliza no chão (base em y = 0) e ajusta a maior largura
function normalize(geo, { width }) {
  geo.computeBoundingBox();
  const b = geo.boundingBox, k = width / Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  geo.scale(k, k, k);
  return geo;
}

// casca para o contorno: vértices empurrados pela normal suavizada
const hulls = new Map();
export function propHull(geo, d) {
  const key = geo.uuid + d;
  if (hulls.has(key)) return hulls.get(key);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const acc = new Map(), keyOf = i => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = keyOf(i), n = acc.get(k) || [0, 0, 0];
    n[0] += nor.getX(i); n[1] += nor.getY(i); n[2] += nor.getZ(i);
    acc.set(k, n);
  }
  const h = new THREE.BufferGeometry();
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const n = acc.get(keyOf(i)), l = Math.hypot(n[0], n[1], n[2]) || 1;
    arr[i * 3] = pos.getX(i) + n[0] / l * d; arr[i * 3 + 1] = pos.getY(i) + n[1] / l * d; arr[i * 3 + 2] = pos.getZ(i) + n[2] / l * d;
  }
  h.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  if (geo.index) h.setIndex(geo.index);
  hulls.set(key, h);
  return h;
}
