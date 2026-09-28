// Objetos do cenário. Os fixos vão para a geometria agrupada (Batch); os que
// mudam (árvores cortadas, pedras quebradas, portas) usam malhas instanciadas.
import * as THREE from '../../lib/three.module.min.js';
import { mergeGeometries } from '../../lib/addons/BufferGeometryUtils.js';
import { boxGeo, cylGeo, materials, applyXray } from './batch.js';
import * as T from '../core/textures.js';

// ------------------------------------------------------------------
// Conjunto de instâncias: cada instância tem posição/rotação/escala próprias
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export class Pool {
  constructor(geo, mat, cap, { shadow = true, receive = true } = {}) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.count = 0; this.mesh.castShadow = shadow; this.mesh.receiveShadow = receive;
    this.mesh.frustumCulled = false;
    this.data = [];
  }
  add(x, y, z, { ry = 0, rx = 0, rz = 0, s = 1, sy = null, color = null } = {}) {
    const i = this.mesh.count++;
    const d = { x, y, z, rx, ry, rz, s, sy: sy ?? s, visible: true, off: [0, 0, 0], tilt: [0, 0] };
    this.data[i] = d;
    this.write(i);
    if (color) this.mesh.setColorAt(i, new THREE.Color(color));
    return i;
  }
  write(i) {
    const d = this.data[i];
    _e.set(d.rx + d.tilt[0], d.ry, d.rz + d.tilt[1]); _q.setFromEuler(_e);
    _p.set(d.x + d.off[0], d.y + d.off[1], d.z + d.off[2]);
    const k = d.visible ? 1 : 0;
    _s.set(d.s * k, d.sy * k, d.s * k);
    this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  set(i, props) { Object.assign(this.data[i], props); this.write(i); }
  finish() { if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; this.mesh.computeBoundingSphere(); }
}

// junta geometrias (com cor por vértice) numa só
const _c = new THREE.Color();
export function merged(parts) {
  const gs = parts.map(([g, color, m]) => {
    g = g.index ? g.toNonIndexed() : g;
    if (m) g.applyMatrix4(m);
    const n = g.attributes.position.count, arr = new Float32Array(n * 3);
    _c.set(color || '#ffffff');
    for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    return g;
  });
  const out = mergeGeometries(gs, false);
  out.computeVertexNormals();
  return out;
}
export const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.clone(), new THREE.Vector3(sx, sy, sz));
};

// ------------------------------------------------------------------
// Árvores (instanciadas). Cada espécie tem tronco, copa e (opcional) frutas.
function blobCanopy(clusters, seed = 1) {
  const parts = [];
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (const [x, y, z, rad] of clusters) {
    const g = new THREE.IcosahedronGeometry(rad, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 0.85 + r() * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.85, p.getZ(i) * k); }
    parts.push([g, '#ffffff', M4(x, y, z)]);
  }
  return merged(parts);
}
export class Trees {
  constructor(parent) {
    const M = materials();
    const bark = applyXray(new THREE.MeshStandardMaterial({ map: T.woodTex(), color: '#6e5238', roughness: 0.95 }));
    const leaf = applyXray(new THREE.MeshStandardMaterial({ map: T.foliageTex(), vertexColors: true, roughness: 0.85, flatShading: true }));
    this.species = {};
    const def = (name, trunkGeo, canopyGeo, cap, fruitGeo = null, fruitColor = null) => {
      const sp = { trunk: new Pool(trunkGeo, bark, cap), canopy: new Pool(canopyGeo, leaf, cap) };
      if (fruitGeo) sp.fruit = new Pool(fruitGeo, new THREE.MeshStandardMaterial({ color: fruitColor, roughness: 0.5 }), cap, { shadow: false });
      parent.add(sp.trunk.mesh, sp.canopy.mesh); if (sp.fruit) parent.add(sp.fruit.mesh);
      this.species[name] = sp;
    };
    const trunk = (h, r0, r1, branches = []) => {
      const parts = [[new THREE.CylinderGeometry(r1, r0, h, 7), '#ffffff', M4(0, h / 2, 0)]];
      for (const [y, a, l, rz] of branches) parts.push([new THREE.CylinderGeometry(r1 * 0.5, r1 * 0.8, l, 5), '#ffffff', M4(Math.sin(a) * l * 0.4, y + l * 0.35, Math.cos(a) * l * 0.4, Math.cos(a) * rz, 0, -Math.sin(a) * rz)]);
      return merged(parts);
    };
    // árvore comum de copa larga
    def('arvore', trunk(3.2, 0.32, 0.2, [[2.2, 0.5, 1.4, 0.7], [2.5, 2.8, 1.2, 0.8], [2.0, 4.5, 1.1, 0.7]]),
      blobCanopy([[0, 4.3, 0, 1.9], [1.3, 3.8, 0.3, 1.4], [-1.2, 3.9, -0.4, 1.5], [0.2, 3.7, 1.3, 1.3], [-0.3, 3.8, -1.3, 1.3], [0.3, 5.3, 0.1, 1.2]], 3), 900);
    // eucalipto: fino e alto
    def('pinheiro', trunk(6.5, 0.24, 0.14, [[4.5, 1, 1.2, 0.6], [5.2, 3.5, 1.0, 0.6]]),
      blobCanopy([[0, 6.8, 0, 1.3], [0.5, 6.0, 0.3, 1.1], [-0.5, 7.4, -0.2, 1.0], [0.1, 5.4, -0.5, 1.0]], 7), 500);
    // mangueira: copa enorme e escura, com mangas
    def('mangueira', trunk(2.6, 0.4, 0.28, [[1.8, 0.8, 1.5, 0.8], [2.0, 3.5, 1.5, 0.8]]),
      blobCanopy([[0, 3.9, 0, 2.3], [1.6, 3.4, 0.5, 1.7], [-1.6, 3.5, -0.4, 1.8], [0.3, 3.4, 1.6, 1.6], [-0.4, 3.5, -1.7, 1.6], [0, 4.9, 0, 1.5]], 11), 120,
      merged(Array.from({ length: 9 }, (_, i) => [new THREE.SphereGeometry(0.13, 6, 5), '#ffffff', M4(Math.cos(i * 2.4) * 1.9, 2.6 + (i % 3) * 0.3, Math.sin(i * 2.4) * 1.9, 0, 0, 0, 1, 1.3, 1)])), '#d9a22a');
    // goiabeira: pequena, com goiabas
    def('goiabeira', trunk(1.6, 0.14, 0.1, [[1.0, 1, 0.8, 0.8], [1.2, 3.8, 0.8, 0.8]]),
      blobCanopy([[0, 2.2, 0, 1.2], [0.7, 1.9, 0.3, 0.9], [-0.7, 2.0, -0.2, 0.9], [0, 2.8, 0, 0.8]], 13), 160,
      merged(Array.from({ length: 8 }, (_, i) => [new THREE.SphereGeometry(0.09, 6, 5), '#ffffff', M4(Math.cos(i * 2.4) * 1.0, 1.7 + (i % 3) * 0.3, Math.sin(i * 2.4) * 1.0)])), '#a8c24a');
    // bananeira: folhas longas
    {
      const parts = [];
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2;
        const g = new THREE.PlaneGeometry(0.55, 1.9, 1, 3);
        const p = g.attributes.position;
        for (let k = 0; k < p.count; k++) { const y = p.getY(k); p.setZ(k, -Math.pow((y + 0.95) / 1.9, 2) * 0.6); }
        parts.push([g, '#ffffff', M4(Math.sin(a) * 0.8, 2.6, Math.cos(a) * 0.8, -1.0, a, 0)]);
        parts.push([g.clone(), '#ffffff', M4(Math.sin(a) * 0.8, 2.6, Math.cos(a) * 0.8, -1.0 + Math.PI, a + Math.PI, 0)]);
      }
      const leafG = merged(parts);
      const trunkG = merged([[new THREE.CylinderGeometry(0.14, 0.2, 2.6, 7), '#ffffff', M4(0, 1.3, 0)]]);
      def('bananeira', trunkG, leafG, 200, merged([[new THREE.CylinderGeometry(0.18, 0.1, 0.5, 6), '#ffffff', M4(0.25, 1.9, 0.15, 0, 0, 0.3)]]), '#c9c23a');
      this.species.bananeira.canopy.mesh.material = applyXray(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, map: T.foliageTex() }));
    }
    // palmeira (enfeite da praça)
    {
      const parts = [];
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2;
        const g = new THREE.PlaneGeometry(0.5, 2.6, 1, 4);
        const p = g.attributes.position;
        for (let k = 0; k < p.count; k++) { const y = p.getY(k); p.setZ(k, -Math.pow((y + 1.3) / 2.6, 2) * 1.2); }
        parts.push([g, '#ffffff', M4(Math.sin(a) * 1.2, 6.4, Math.cos(a) * 1.2, -1.2, a, 0)]);
      }
      def('palmeira', trunk(6.4, 0.22, 0.18), merged(parts), 80);
      this.species.palmeira.canopy.mesh.material = this.species.bananeira.canopy.mesh.material;
    }
  }
  add(sp, x, y, z, s = 1, ry = 0, color = '#6f8f3a') {
    const S = this.species[sp];
    const t = S.trunk.add(x, y, z, { ry, s });
    S.canopy.add(x, y, z, { ry, s, color });
    if (S.fruit) S.fruit.add(x, y, z, { ry, s });
    return { sp, i: t };
  }
  // estados: 'full' | 'stump' | 'nofruit'
  setState(h, st) {
    const S = this.species[h.sp];
    if (st === 'stump') {
      S.trunk.set(h.i, { sy: S.trunk.data[h.i].s * 0.12 });
      S.canopy.set(h.i, { visible: false });
      if (S.fruit) S.fruit.set(h.i, { visible: false });
    } else if (st === 'nofruit') {
      if (S.fruit) S.fruit.set(h.i, { visible: false });
    } else {
      S.trunk.set(h.i, { sy: S.trunk.data[h.i].s, visible: true });
      S.canopy.set(h.i, { visible: true });
      if (S.fruit) S.fruit.set(h.i, { visible: true });
    }
  }
  // balanço ao levar um golpe
  shake(h, amt) {
    const S = this.species[h.sp];
    const t = [amt * 0.6, amt];
    S.trunk.set(h.i, { tilt: t }); S.canopy.set(h.i, { tilt: t }); if (S.fruit) S.fruit.set(h.i, { tilt: t });
  }
  finish() { for (const S of Object.values(this.species)) for (const p of [S.trunk, S.canopy, S.fruit]) if (p) p.finish(); }
}

// ------------------------------------------------------------------
// Pedras, minério, galhos, seixos, capim e arbustos (instanciados)
export class Nature {
  constructor(parent) {
    const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, map: T.concreteTex() });
    const rockG = (seed, detail = 0) => {
      const g = new THREE.DodecahedronGeometry(1, detail);
      const p = g.attributes.position; let s = seed;
      const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < p.count; i++) { const k = 0.75 + r() * 0.45; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); }
      return merged([[g, '#ffffff', M4(0, 0.35, 0)]]);
    };
    this.rock = new Pool(rockG(5), rockMat, 400);
    this.rock2 = new Pool(rockG(9), rockMat, 400);
    // minério: pedra com manchas de ferro
    const oreParts = [[rockG(21), '#8a837a']];
    for (let i = 0; i < 7; i++) oreParts.push([new THREE.DodecahedronGeometry(0.22, 0), '#9a4a2a', M4(Math.cos(i * 2.2) * 0.62, 0.35 + Math.sin(i * 1.7) * 0.25, Math.sin(i * 2.2) * 0.62)]);
    this.ore = new Pool(merged(oreParts), rockMat, 120);
    // seixos no chão
    const pebbles = merged(Array.from({ length: 5 }, (_, i) => [new THREE.DodecahedronGeometry(0.12 + (i % 3) * 0.04, 0), '#9a948a', M4(Math.cos(i * 2.5) * 0.25, 0.06, Math.sin(i * 2.5) * 0.25)]));
    this.pebble = new Pool(pebbles, rockMat, 400, { shadow: false });
    // galhos secos
    const stickMat = new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.95 });
    this.stick = new Pool(merged(Array.from({ length: 5 }, (_, i) => [new THREE.CylinderGeometry(0.03, 0.04, 0.9 - i * 0.08, 5), '#ffffff', M4((i - 2) * 0.12, 0.05, (i % 2) * 0.1, Math.PI / 2, i * 0.7, 0)])), stickMat, 400, { shadow: false });
    // capim alto (fibra)
    const tuftMat = new THREE.MeshStandardMaterial({ map: T.tuftTex(), alphaTest: 0.4, side: THREE.DoubleSide, vertexColors: true, roughness: 0.9 });
    const tall = merged([0, 1, 2].map(i => [new THREE.PlaneGeometry(1.5, 1.2), '#ffffff', M4(0, 0.6, 0, 0, i * Math.PI / 3, 0)]));
    this.tall = new Pool(tall, tuftMat, 400, { shadow: false });
    // capim decorativo (muitos, sem colisão)
    const small = merged([0, 1].map(i => [new THREE.PlaneGeometry(0.8, 0.5), '#ffffff', M4(0, 0.25, 0, 0, i * Math.PI / 2, 0)]));
    this.grass = new Pool(small, tuftMat, 9000, { shadow: false });
    // arbustos decorativos
    const leaf = new THREE.MeshStandardMaterial({ map: T.foliageTex(), vertexColors: true, roughness: 0.85, flatShading: true });
    this.bush = new Pool(blobCanopy([[0, 0.45, 0, 0.7], [0.5, 0.35, 0.2, 0.5], [-0.45, 0.35, -0.1, 0.5]], 17), leaf, 700);
    for (const p of [this.rock, this.rock2, this.ore, this.pebble, this.stick, this.tall, this.grass, this.bush]) parent.add(p.mesh);
  }
  finish() { for (const p of [this.rock, this.rock2, this.ore, this.pebble, this.stick, this.tall, this.grass, this.bush]) p.finish(); }
}

// ------------------------------------------------------------------
// Construtores de peças fixas (vão para o Batch)
const CAR_COLORS = ['#8a2a22', '#2a4a7a', '#d8d4c8', '#3a3a3e', '#6a7a3a', '#b8902a', '#5a2a4a', '#9aa0a8', '#1e5a52'];
export function car(W, x, z, ry, { color = null, burned = false, kind = 'car' } = {}) {
  const B = W.batch, r = W.rnd;
  const c = burned ? '#2a2522' : (color || r.pick(CAR_COLORS));
  const s = Math.sin(ry), co = Math.cos(ry);
  const P = (lx, lz) => [x + lx * co + lz * s, z - lx * s + lz * co];
  const add = (g, mat, lx, y, lz, col, extra = {}) => { const [px, pz] = P(lx, lz); B.add(g, mat, { x: px, y, z: pz, ry, color: col, ...extra }); };
  let L = 4.2, Wd = 1.8;
  if (kind === 'car') {
    add(boxGeo(1.8, 0.62, 4.2, 1), 'paint', 0, 0.55, 0, c);
    add(boxGeo(1.6, 0.55, 2.1, 1), 'paint', 0, 1.13, -0.25, c);
    add(boxGeo(1.62, 0.42, 1.9, 1), 'glass', 0, 1.13, -0.25, burned ? '#111' : '#8aa0b0');
    add(boxGeo(1.84, 0.18, 0.3, 1), 'plain', 0, 0.42, 2.08, '#222');
    add(boxGeo(1.84, 0.18, 0.3, 1), 'plain', 0, 0.42, -2.08, '#222');
  } else if (kind === 'truck') {
    L = 7; Wd = 2.3;
    add(boxGeo(2.3, 1.6, 2.1, 1), 'paint', 0, 1.3, 2.4, c);
    add(boxGeo(2.32, 0.6, 1.0, 1), 'glass', 0, 1.7, 2.9, '#6a7a88');
    add(boxGeo(2.4, 2.4, 4.6, 2), 'metal', 0, 1.7, -1.1, burned ? '#2a2522' : '#c8c0b0');
  } else if (kind === 'bus') {
    L = 10; Wd = 2.5;
    add(boxGeo(2.5, 2.6, 10, 2), 'paint', 0, 1.65, 0, c);
    add(boxGeo(2.52, 0.8, 9.6, 2), 'glass', 0, 2.2, 0, '#5a6a78');
  } else if (kind === 'ambulance') {
    L = 5.2; Wd = 2.1;
    add(boxGeo(2.1, 1.1, 1.6, 1), 'paint', 0, 0.95, 1.8, '#e8e8e8');
    add(boxGeo(2.1, 2.2, 3.6, 1), 'paint', 0, 1.5, -0.8, '#eeeeee');
    add(boxGeo(2.12, 0.3, 3.62, 1), 'plain', 0, 1.2, -0.8, '#c83030');
    add(boxGeo(1.9, 0.4, 0.8, 1), 'glass', 0, 1.3, 2.1, '#6a7a88');
  } else if (kind === 'police') {
    add(boxGeo(1.8, 0.62, 4.2, 1), 'paint', 0, 0.55, 0, '#e8e8e8');
    add(boxGeo(1.6, 0.55, 2.1, 1), 'paint', 0, 1.13, -0.25, '#1a1a2a');
    add(boxGeo(1.62, 0.42, 1.9, 1), 'glass', 0, 1.13, -0.25, '#303844');
    add(boxGeo(0.9, 0.12, 0.25, 1), 'plain', 0, 1.47, -0.25, '#2050c0');
  }
  // rodas
  const wr = kind === 'car' || kind === 'police' ? 0.34 : 0.48;
  for (const [lx, lz] of [[-Wd / 2, L * 0.32], [Wd / 2, L * 0.32], [-Wd / 2, -L * 0.32], [Wd / 2, -L * 0.32]]) {
    const [px, pz] = P(lx, lz);
    if (burned && r() < 0.5) continue;
    B.add(new THREE.CylinderGeometry(wr, wr, 0.25, 10), 'plain', { x: px, y: wr, z: pz, rz: Math.PI / 2, ry, color: '#1c1c1c' });
  }
  // colisão: círculos ao longo do comprimento
  const n = Math.max(2, Math.round(L / 1.8));
  for (let i = 0; i < n; i++) {
    const lz = -L / 2 + Wd / 2 + (L - Wd) * i / (n - 1);
    const [px, pz] = P(0, lz);
    W.col.add({ type: 'circle', x: px, z: pz, r: Wd / 2 + 0.05, los: kind !== 'car' && kind !== 'police', low: kind === 'car' || kind === 'police' });
  }
  if (!burned && r() < 0.35) W.decal('debris', x + (r() - 0.5) * 3, z + (r() - 0.5) * 3, 1.5 + r() * 1.5);
  return { x, z, L, Wd };
}

export function lampPost(W, x, z) {
  W.batch.add(cylGeo(0.07, 0.1, 5.5, 6), 'metal', { x, y: 2.75, z, color: '#6a6e72' });
  W.batch.add(boxGeo(1.2, 0.08, 0.1), 'metal', { x: x + 0.55, y: 5.4, z, color: '#6a6e72' });
  W.batch.add(boxGeo(0.4, 0.12, 0.25), 'plain', { x: x + 1.05, y: 5.32, z, color: '#2a2a2a' });
  W.col.add({ type: 'circle', x, z, r: 0.15, los: false, low: true });
}
export function utilityPole(W, x, z) {
  W.batch.add(cylGeo(0.13, 0.16, 8, 7), 'concrete', { x, y: 4, z, color: '#b8b4aa' });
  W.batch.add(boxGeo(1.6, 0.12, 0.12), 'wood', { x, y: 7.4, z, color: '#6a5038' });
  W.col.add({ type: 'circle', x, z, r: 0.2, los: false, low: true });
}
export function bench(W, x, z, ry) {
  const s = Math.sin(ry), c = Math.cos(ry);
  W.batch.add(boxGeo(1.8, 0.08, 0.45), 'wood', { x, y: 0.45, z, ry, color: '#8a6a44' });
  W.batch.add(boxGeo(1.8, 0.4, 0.07), 'wood', { x: x - s * 0.22, y: 0.7, z: z - c * 0.22, ry, color: '#8a6a44' });
  for (const k of [-0.75, 0.75]) W.batch.add(boxGeo(0.08, 0.45, 0.45), 'metal', { x: x + c * k, y: 0.22, z: z - s * k, ry, color: '#3a3a3a' });
  W.col.add({ type: 'circle', x, z, r: 0.5, los: false, low: true });
}
export function sawhorse(W, x, z, ry) {
  W.batch.add(boxGeo(1.8, 0.22, 0.06, 1), 'tape', { x, y: 0.8, z, ry, color: '#ffffff' });
  W.batch.add(boxGeo(1.8, 0.16, 0.06, 1), 'tape', { x, y: 0.4, z, ry, color: '#ffffff' });
  const s = Math.sin(ry), c = Math.cos(ry);
  for (const k of [-0.8, 0.8]) W.batch.add(boxGeo(0.07, 1.0, 0.4), 'wood', { x: x + c * k, y: 0.5, z: z - s * k, ry, color: '#7a6a5a' });
}
export function sandbags(W, x, z, ry, len = 3) {
  const s = Math.sin(ry), c = Math.cos(ry);
  for (let row = 0; row < 3; row++) for (let i = 0; i < len * 2; i++) {
    const k = -len / 2 + (i + (row % 2) * 0.5) * 0.5;
    if (k > len / 2) continue;
    W.batch.add(new THREE.CapsuleGeometry(0.16, 0.3, 2, 6), 'plain', { x: x + c * k, y: 0.16 + row * 0.26, z: z - s * k, rz: Math.PI / 2, ry, sy: 1, sz: 0.8, color: '#9a8a62', vary: 0.1 });
  }
}
export function concreteBlock(W, x, z, ry) {
  W.batch.add(boxGeo(2, 0.9, 0.6), 'concrete', { x, y: 0.45, z, ry, color: '#bab4a8' });
}
export function tires(W, x, z) {
  for (let i = 0; i < 3; i++) W.batch.add(new THREE.TorusGeometry(0.34, 0.14, 6, 12), 'plain', { x, y: 0.14 + i * 0.26, z, rx: Math.PI / 2, color: '#1e1e1e' });
  W.col.add({ type: 'circle', x, z, r: 0.5, low: true });
}
export function crate(W, x, z, ry = 0, s = 1) {
  W.batch.add(boxGeo(0.9 * s, 0.8 * s, 0.9 * s, 1), 'wood', { x, y: 0.4 * s, z, ry, color: '#b8966a' });
  W.col.add({ type: 'circle', x, z, r: 0.55 * s, low: true });
}
export function trashPile(W, x, z) {
  const r = W.rnd;
  for (let i = 0; i < 5; i++) W.batch.add(new THREE.SphereGeometry(0.28 + r() * 0.15, 6, 5), 'plain', { x: x + (r() - 0.5) * 1.2, y: 0.18, z: z + (r() - 0.5) * 1.2, sy: 0.7, color: r() < 0.5 ? '#1e1e22' : '#2a3a2a' });
  W.decal('debris', x, z, 2.2);
}
export function dumpster(W, x, z, ry) {
  W.batch.add(boxGeo(1.8, 1.2, 1.1), 'metal', { x, y: 0.65, z, ry, color: '#2e5a3a' });
  W.batch.add(boxGeo(1.85, 0.08, 1.15), 'plain', { x, y: 1.28, z, ry, rx: 0.1, color: '#1e3a26' });
  W.col.add({ type: 'circle', x, z, r: 0.8, low: true });
}
// barreira de madeira (tábuas cruzadas)
export function woodBarricade(W, x, z, ry, len = 3) {
  const s = Math.sin(ry), c = Math.cos(ry);
  for (let i = 0; i < 3; i++) W.batch.add(boxGeo(len, 0.22, 0.06, 1), 'wood', { x, y: 0.5 + i * 0.4, z, ry, rz: (i - 1) * 0.15, color: '#8a6a4a', vary: 0.2 });
  for (const k of [-len / 2 + 0.2, len / 2 - 0.2]) W.batch.add(boxGeo(0.12, 1.5, 0.12), 'wood', { x: x + c * k, y: 0.75, z: z - s * k, ry, color: '#6a5038' });
}
export function fence(W, x0, z0, x1, z1, { h = 1.2, color = '#7a6048', gapEvery = 0, collide = true } = {}) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
  const n = Math.max(1, Math.round(L / 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    W.batch.add(boxGeo(0.1, h, 0.1), 'wood', { x, y: h / 2, z, color, vary: 0.2 });
  }
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  for (const y of [h * 0.35, h * 0.8]) W.batch.add(boxGeo(L, 0.08, 0.04, 2), 'wood', { x: mx, y, z: mz, ry, color, vary: 0.15 });
  if (collide) segCollider(W, x0, z0, x1, z1, 0.15, true);
}
// muro de reboco baixo
export function lowWall(W, x0, z0, x1, z1, { h = 1.3, color = '#d8cfbf' } = {}) {
  const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
  W.batch.add(boxGeo(L, h, 0.2), 'plaster', { x: (x0 + x1) / 2, y: h / 2, z: (z0 + z1) / 2, ry, color, vary: 0.05 });
  W.batch.add(boxGeo(L, 0.08, 0.26), 'concrete', { x: (x0 + x1) / 2, y: h + 0.04, z: (z0 + z1) / 2, ry, color: '#a8a298' });
  segCollider(W, x0, z0, x1, z1, 0.12, true);
}
// colisor ao longo de um segmento (caixa se alinhado, círculos se inclinado)
export function segCollider(W, x0, z0, x1, z1, t, low = false) {
  if (Math.abs(x0 - x1) < 0.01 || Math.abs(z0 - z1) < 0.01) {
    W.col.add({ type: 'box', x0: Math.min(x0, x1) - t, x1: Math.max(x0, x1) + t, z0: Math.min(z0, z1) - t, z1: Math.max(z0, z1) + t, low });
  } else {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 0.4);
    for (let i = 0; i <= n; i++) W.col.add({ type: 'circle', x: x0 + (x1 - x0) * i / n, z: z0 + (z1 - z0) * i / n, r: t + 0.05, low });
  }
}
// barraca de camping
export function tent(W, x, z, ry, color = '#3a6a4a') {
  const g = new THREE.ConeGeometry(1.6, 1.6, 4);
  W.batch.add(g, 'plain', { x, y: 0.8, z, ry: ry + Math.PI / 4, sx: 1, sz: 1.4, color });
  W.col.add({ type: 'circle', x, z, r: 1.3, low: true });
}
export function campfireRing(W, x, z) {
  for (let i = 0; i < 8; i++) W.batch.add(new THREE.DodecahedronGeometry(0.16, 0), 'concrete', { x: x + Math.cos(i * 0.785) * 0.55, y: 0.1, z: z + Math.sin(i * 0.785) * 0.55, color: '#7a7670' });
  for (let i = 0; i < 3; i++) W.batch.add(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 5), 'plain', { x, y: 0.1, z, rz: Math.PI / 2, ry: i * 1, color: '#2a2018' });
}
// corpo caído (pode ser revistado)
export function corpse(W, x, z, ry) {
  const s = Math.sin(ry), c = Math.cos(ry);
  const r = W.rnd, cloth = r.pick(['#4a4a52', '#6a4a3a', '#3a4a5a', '#7a6a5a']);
  const at = (k) => [x + s * k, z + c * k];
  let [px, pz] = at(0.1); W.batch.add(new THREE.CapsuleGeometry(0.18, 0.5, 2, 8), 'plain', { x: px, y: 0.18, z: pz, rx: Math.PI / 2, ry, sx: 1.1, sz: 0.7, color: cloth });
  [px, pz] = at(0.72); W.batch.add(new THREE.SphereGeometry(0.13, 8, 6), 'plain', { x: px, y: 0.14, z: pz, color: '#b89a82' });
  [px, pz] = at(-0.62); W.batch.add(new THREE.CapsuleGeometry(0.08, 0.6, 2, 6), 'plain', { x: px + c * 0.12, y: 0.1, z: pz - s * 0.12, rx: Math.PI / 2, ry, color: '#2a2a30' });
  W.batch.add(new THREE.CapsuleGeometry(0.08, 0.6, 2, 6), 'plain', { x: px - c * 0.12, y: 0.1, z: pz + s * 0.12, rx: Math.PI / 2, ry: ry + 0.2, color: '#2a2a30' });
  W.decal('blood', x, z, 1.8);
}
// trilhos da ferrovia
export function railway(W, x0, x1, z) {
  for (let x = x0; x < x1; x += 0.9) W.batch.add(boxGeo(0.25, 0.12, 2.6), 'wood', { x, y: 0.06, z, color: '#5a4636' });
  for (const dz of [-0.72, 0.72]) {
    for (let x = x0; x < x1; x += 20) W.batch.add(boxGeo(Math.min(20, x1 - x), 0.14, 0.09), 'metal', { x: x + Math.min(20, x1 - x) / 2, y: 0.18, z: z + dz, color: '#6a5a50' });
  }
}
export function wagon(W, x, z, color = '#7a3a2a') {
  W.batch.add(boxGeo(12, 3.0, 2.9, 2), 'metal', { x, y: 2.0, z, color });
  W.batch.add(boxGeo(12.2, 0.3, 3.0, 2), 'plain', { x, y: 0.55, z, color: '#2a2a2a' });
  for (const k of [-4.5, -3.3, 3.3, 4.5]) for (const dz of [-0.72, 0.72]) W.batch.add(new THREE.CylinderGeometry(0.42, 0.42, 0.15, 10), 'plain', { x: x + k, y: 0.45, z: z + dz, rx: Math.PI / 2, color: '#222' });
  W.col.add({ type: 'box', x0: x - 6, x1: x + 6, z0: z - 1.45, z1: z + 1.45 });
}
export function boat(W, x, z, ry) {
  W.batch.add(new THREE.CapsuleGeometry(0.8, 2.6, 3, 8), 'wood', { x, y: 0.1, z, rx: Math.PI / 2, ry, sy: 1, sz: 0.5, color: '#5a7a8a' });
  W.col.add({ type: 'circle', x, z, r: 1.0, low: true });
}
export function hayBale(W, x, z, ry = 0) {
  W.batch.add(new THREE.CylinderGeometry(0.65, 0.65, 1.2, 12), 'plain', { x, y: 0.65, z, rz: Math.PI / 2, ry, color: '#c8a85a', vary: 0.15 });
  W.col.add({ type: 'circle', x, z, r: 0.8, low: true });
}
export function gasPump(W, x, z) {
  W.batch.add(boxGeo(0.7, 1.7, 0.5), 'metal', { x, y: 0.85, z, color: '#d8d4c8' });
  W.batch.add(boxGeo(0.72, 0.3, 0.52), 'plain', { x, y: 1.55, z, color: '#c82a2a' });
  W.col.add({ type: 'circle', x, z, r: 0.5 });
}
export function coreto(W, x, z) {
  W.batch.add(new THREE.CylinderGeometry(4, 4.2, 0.6, 8), 'concrete', { x, y: 0.3, z, color: '#d8d0c0' });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; W.batch.add(cylGeo(0.12, 0.12, 3, 6), 'plaster', { x: x + Math.cos(a) * 3.6, y: 2.1, z: z + Math.sin(a) * 3.6, color: '#f0ebe0' }); }
  W.batch.add(new THREE.ConeGeometry(4.6, 1.8, 8), 'roof', { x, y: 4.5, z, ry: Math.PI / 8, color: '#b8704a' });
  W.col.add({ type: 'circle', x, z, r: 4.1, los: false, low: true });
}
// cabine de ônibus / banca de jornal
export function kiosk(W, x, z, ry, color = '#2a5a7a') {
  W.batch.add(boxGeo(2.4, 2.4, 1.8), 'metal', { x, y: 1.2, z, ry, color });
  W.batch.add(boxGeo(2.8, 0.12, 2.3), 'metal', { x, y: 2.5, z, ry, color: '#d8d4c8' });
  W.col.add({ type: 'circle', x, z, r: 1.3 });
}
// ponto de ônibus
export function busStop(W, x, z, ry) {
  const s = Math.sin(ry), c = Math.cos(ry);
  for (const k of [-1.3, 1.3]) W.batch.add(cylGeo(0.06, 0.06, 2.4, 6), 'metal', { x: x + c * k, y: 1.2, z: z - s * k - 0.4, color: '#5a6a72' });
  W.batch.add(boxGeo(3.0, 0.08, 1.4), 'metal', { x, y: 2.42, z: z - 0.1, ry, color: '#3a5a6a' });
  W.batch.add(boxGeo(2.6, 1.3, 0.05), 'glass', { x, y: 1.4, z: z - 0.7, ry, color: '#9ab0c0' });
  W.batch.add(boxGeo(2.2, 0.08, 0.4), 'wood', { x, y: 0.5, z: z - 0.45, ry, color: '#8a6a44' });
  W.col.add({ type: 'box', x0: x - 1.4, x1: x + 1.4, z0: z - 0.8, z1: z - 0.5, low: true, los: false });
}
// pilha de lenha/tábuas
export function woodPile(W, x, z) {
  for (let i = 0; i < 6; i++) W.batch.add(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 6), 'wood', { x, y: 0.12 + Math.floor(i / 3) * 0.22, z: z + (i % 3 - 1) * 0.25, rz: Math.PI / 2, color: '#8a6a44' });
  W.col.add({ type: 'circle', x, z, r: 0.8, low: true });
}
// tanque/silo
export function silo(W, x, z) {
  W.batch.add(cylGeo(2.4, 2.4, 8, 14), 'metal', { x, y: 4, z, color: '#b8bcc0' });
  W.batch.add(new THREE.ConeGeometry(2.6, 1.6, 14), 'metal', { x, y: 8.8, z, color: '#9aa0a4' });
  W.col.add({ type: 'circle', x, z, r: 2.5 });
}
