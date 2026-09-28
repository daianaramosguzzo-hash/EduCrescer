// Personagens feitos em código (sobreviventes e zumbis).
// Cada personagem vira UMA malha com esqueleto (SkinnedMesh): todas as peças
// (cabeça, braços, roupas...) são presas rigidamente a um osso. Assim cada
// personagem custa uma chamada de desenho só, e dá para ter dezenas de zumbis.
import * as THREE from '../../lib/three.module.min.js';
import { mergeGeometries } from '../../lib/addons/BufferGeometryUtils.js';
import { Animator, JOINTS } from './anim.js';
import { makeWeapon, makeHandProp } from './weapons.js';
import { rng } from '../core/util.js';

const PARENT = {
  hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  armL: 'chest', foreL: 'armL', handL: 'foreL', armR: 'chest', foreR: 'armR', handR: 'foreR',
  thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR',
};

function proportions(look) {
  const P = {
    hipY: 0.93, spine: 0.1, chest: 0.2, neck: 0.27, head: 0.07,
    shX: 0.2, shY: 0.23, upper: 0.27, fore: 0.25, hipX: 0.095, thigh: 0.43, shin: 0.42,
    W: 1, headR: 0.125, limb: 1,
  };
  if (look.kid) Object.assign(P, { hipY: 0.8, spine: 0.09, chest: 0.17, neck: 0.23, head: 0.065, shX: 0.17, shY: 0.2, upper: 0.23, fore: 0.21, hipX: 0.085, thigh: 0.37, shin: 0.36, W: 0.9, headR: 0.135 });
  if (look.big) { P.W = 1.18; P.limb = 1.15; }
  if (look.thin) { P.W = 0.86; P.limb = 0.85; }
  if (look.bulky) { P.W = 1.35; P.limb = 1.35; P.headR = 0.12; }
  if (look.female) { P.W *= 0.93; P.limb *= 0.9; }
  return P;
}

function jointOffsets(P) {
  return {
    hips: [0, P.hipY, 0], spine: [0, P.spine, 0], chest: [0, P.chest, 0], neck: [0, P.neck, 0], head: [0, P.head, 0],
    armL: [P.shX * P.W, P.shY, 0], foreL: [0, -P.upper, 0], handL: [0, -P.fore, 0],
    armR: [-P.shX * P.W, P.shY, 0], foreR: [0, -P.upper, 0], handR: [0, -P.fore, 0],
    thighL: [P.hipX * P.W, -0.03, 0], shinL: [0, -P.thigh, 0], footL: [0, -P.shin, 0],
    thighR: [-P.hipX * P.W, -0.03, 0], shinR: [0, -P.thigh, 0], footR: [0, -P.shin, 0],
  };
}

const tmpC = new THREE.Color();
// Monta a geometria do corpo com cores por vértice e pesos de osso
function buildGeometry(look, seed = 1) {
  const r = rng(seed);
  const P = proportions(look);
  const off = jointOffsets(P);
  const wpos = {};
  for (const j of JOINTS) {
    const p = PARENT[j] ? wpos[PARENT[j]] : [0, 0, 0];
    wpos[j] = [p[0] + off[j][0], p[1] + off[j][1], p[2] + off[j][2]];
  }
  const boneIndex = Object.fromEntries(JOINTS.map((j, i) => [j, i]));
  const parts = [];
  const add = (geo, joint, pos, color, { rot = null, scale = null } = {}) => {
    if (scale) geo.scale(scale[0], scale[1], scale[2]);
    if (rot) { geo.rotateX(rot[0] || 0); geo.rotateY(rot[1] || 0); geo.rotateZ(rot[2] || 0); }
    const w = wpos[joint];
    geo.translate(w[0] + pos[0], w[1] + pos[1], w[2] + pos[2]);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    tmpC.set(color);
    for (let i = 0; i < n; i++) {
      // leve variação por vértice para não ficar "plástico"
      const v = 0.94 + ((i * 7919) % 13) / 13 * 0.1;
      col[i * 3] = tmpC.r * v; col[i * 3 + 1] = tmpC.g * v; col[i * 3 + 2] = tmpC.b * v;
      si[i * 4] = boneIndex[joint]; sw[i * 4] = 1;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    parts.push(geo);
  };
  const W = P.W, L = P.limb;
  const cap = (rad, len) => new THREE.CapsuleGeometry(rad, len, 3, 9);
  const sph = (rad, ws = 10, hs = 8) => new THREE.SphereGeometry(rad, ws, hs);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r1, r2, h, s = 9) => new THREE.CylinderGeometry(r1, r2, h, s);

  const skin = look.skin, shirt = look.shirt, shirt2 = look.shirt2 || shirt, pants = look.pants, shoes = look.shoes || '#2a2a2a';
  const zombie = !!look.zombie;
  const sleeveLong = look.sleeves !== 'short';
  const blood = '#3e0a08', blood2 = '#561210';

  // quadril e barriga
  add(sph(0.17), 'hips', [0, 0.02, 0], pants, { scale: [1.05 * W, 0.62, 0.72 * Math.max(1, W * 0.9)] });
  add(cyl(0.165 * W, 0.165 * W, 0.04, 12), 'hips', [0, 0.1, 0], '#2a211b', { scale: [1, 1, 0.72] }); // cinto
  add(cap(0.15, 0.12), 'spine', [0, 0.08, 0], shirt, { scale: [1.05 * W, 1, 0.72 * Math.max(1, W * 0.9)] });
  // peito
  add(cap(0.168, 0.14), 'chest', [0, 0.1, 0], shirt, { scale: [1.18 * W, 1, 0.75 * Math.max(1, W * 0.9)] });
  if (look.shirt2 && !look.coat) {
    // camiseta aparecendo na frente da jaqueta aberta
    add(box(0.14 * W, 0.34, 0.05), 'chest', [0, 0.02, 0.1 * Math.max(1, W * 0.9)], shirt2);
  }
  if (look.vest) add(cap(0.176, 0.12), 'chest', [0, 0.08, 0], look.vest, { scale: [1.2 * W, 0.95, 0.8 * Math.max(1, W * 0.9)] });
  if (look.coat) {
    add(cyl(0.2 * W, 0.24 * W, 0.55, 12), 'spine', [0, -0.12, 0], shirt, { scale: [1, 1, 0.75] });
  }
  if (look.backpack) {
    add(box(0.3 * W, 0.36, 0.14), 'chest', [0, 0.04, -0.2 * Math.max(1, W * 0.9)], look.backpack);
    add(box(0.24 * W, 0.16, 0.06), 'chest', [0, -0.04, -0.28 * Math.max(1, W * 0.9)], '#6a4a30');
  }
  // gola / capuz
  add(cyl(0.085, 0.1, 0.06, 10), 'chest', [0, 0.26, -0.01], look.hood ? shirt : shirt2);
  if (look.hood) add(sph(0.12, 10, 6), 'chest', [0, 0.25, -0.1], shirt, { scale: [1.2, 0.5, 0.7] });
  // pescoço e cabeça
  add(cyl(0.05, 0.055, 0.1), 'neck', [0, 0.02, 0], skin);
  const hr = P.headR;
  add(sph(hr, 14, 11), 'head', [0, hr * 0.95, 0.005], skin, { scale: [0.93, 1.02, 0.98] });
  add(sph(hr * 0.72, 10, 6), 'head', [0, hr * 0.55, 0.035], skin, { scale: [1.0, 0.7, 0.9] }); // queixo
  add(box(0.028, 0.04, 0.03), 'head', [0, hr * 0.85, hr * 0.97], skin); // nariz
  add(sph(0.025, 6, 5), 'head', [hr * 0.93, hr * 0.95, 0], skin); add(sph(0.025, 6, 5), 'head', [-hr * 0.93, hr * 0.95, 0], skin); // orelhas
  const eyeC = zombie ? (look.eyeColor || '#d8d2a8') : '#1a1410';
  for (const s of [-1, 1]) {
    add(sph(zombie ? 0.021 : 0.019, 6, 5), 'head', [s * hr * 0.36, hr * 1.02, hr * 0.86], eyeC);
    if (!zombie) add(sph(0.012, 5, 4), 'head', [s * hr * 0.36 + s * 0.004, hr * 1.06, hr * 0.93], '#ffffff');
    add(box(0.05, 0.012, 0.015), 'head', [s * hr * 0.38, hr * 1.2, hr * 0.86], look.hair || '#333', { rot: [0, 0, s * (zombie ? 0.3 : -0.12)] });
  }
  add(box(0.05, zombie ? 0.03 : 0.012, 0.01), 'head', [0, hr * 0.62, hr * 0.88], zombie ? '#2a0e0c' : '#8a4a3a'); // boca
  // cabelo
  const hair = look.hair;
  if (hair) {
    const st = look.hairStyle || 'short';
    add(sph(hr * 1.06, 12, 8, 0), 'head', [0, hr * 1.12, -0.012], hair, { scale: [1, 0.78, 1.02] });
    if (st === 'spiky') {
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2, rr = hr * 0.55;
        const c = new THREE.ConeGeometry(0.045, 0.12, 5);
        add(c, 'head', [Math.cos(a) * rr, hr * 1.62, Math.sin(a) * rr - 0.01], hair, { rot: [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7] });
      }
      add(new THREE.ConeGeometry(0.05, 0.14, 5), 'head', [0.02, hr * 1.75, 0.02], hair);
      add(box(hr * 1.4, 0.05, 0.06), 'head', [0, hr * 1.42, hr * 0.78], hair, { rot: [0.5, 0, 0.1] }); // franja
    } else if (st === 'long') {
      add(box(hr * 1.9, hr * 1.9, 0.08), 'head', [0, hr * 0.55, -hr * 0.72], hair);
      add(box(0.05, hr * 1.6, hr * 1.2), 'head', [hr * 0.9, hr * 0.7, -0.02], hair); add(box(0.05, hr * 1.6, hr * 1.2), 'head', [-hr * 0.9, hr * 0.7, -0.02], hair);
    } else if (st === 'ponytail') {
      add(cap(0.045, 0.2), 'head', [0, hr * 0.8, -hr * 1.15], hair, { rot: [0.5, 0, 0] });
    }
  }
  if (look.hat) {
    add(cyl(hr * 1.75, hr * 1.75, 0.02, 14), 'head', [0, hr * 1.55, 0], look.hat);
    add(cyl(hr * 0.95, hr * 1.05, hr * 0.7, 12), 'head', [0, hr * 1.85, 0], look.hat);
  }
  if (look.beard) add(sph(hr * 0.7, 9, 6), 'head', [0, hr * 0.5, hr * 0.35], look.hair, { scale: [1.05, 0.8, 0.9] });

  // braços
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    add(sph(0.075 * L, 8, 6), 'arm' + s, [0, -0.02, 0], shirt);
    add(cap(0.053 * L, P.upper * 0.62), 'arm' + s, [0, -P.upper * 0.48, 0], shirt);
    add(cap(0.045 * L, P.fore * 0.62), 'fore' + s, [0, -P.fore * 0.44, 0], sleeveLong ? shirt : skin);
    if (sleeveLong) add(cyl(0.05 * L, 0.05 * L, 0.05), 'fore' + s, [0, -P.fore * 0.82, 0], look.cuff || shirt2);
    add(sph(0.05 * L, 8, 6), 'hand' + s, [0, -0.045, 0.005], skin, { scale: [0.85, 1.15, 0.7] });
    add(box(0.02, 0.05, 0.03), 'hand' + s, [sx * 0.035, -0.035, 0.025], skin); // polegar
    // pernas
    add(cap(0.078 * L, P.thigh * 0.62), 'thigh' + s, [0, -P.thigh * 0.48, 0], pants);
    const shorts = look.shorts;
    add(cap(0.06 * L, P.shin * 0.6), 'shin' + s, [0, -P.shin * 0.46, 0], shorts ? skin : pants);
    if (look.socks) add(cyl(0.052, 0.052, 0.12), 'shin' + s, [0, -P.shin * 0.83, 0], '#e8e8ec');
    if (look.socks) add(cyl(0.053, 0.053, 0.02), 'shin' + s, [0, -P.shin * 0.8, 0], '#3a5aa8');
    add(box(0.11 * L, 0.08, 0.24), 'foot' + s, [0, -0.035, 0.05], shoes);
    add(box(0.115 * L, 0.025, 0.25), 'foot' + s, [0, -0.07, 0.05], '#d8d8d0');
  }

  // detalhes de zumbi
  if (zombie) {
    const spots = [['chest', 0.1], ['spine', 0.05], ['armR', -0.15], ['foreL', -0.1], ['thighL', -0.15], ['head', 0.08]];
    for (let i = 0; i < 6; i++) {
      const [j, y] = spots[Math.floor(r() * spots.length)];
      const a = r() * Math.PI * 2, rad = j === 'chest' || j === 'spine' ? 0.15 * W : j === 'head' ? hr * 0.9 : 0.055;
      add(sph(0.04 + r() * 0.05, 6, 4), j, [Math.sin(a) * rad, y + (j === 'head' ? hr * 0.7 : 0), Math.abs(Math.cos(a)) * rad * 0.9], r() < 0.5 ? blood : blood2, { scale: [1, 1.3, 0.3] });
    }
    if (look.torn) for (let i = 0; i < 4; i++) {
      const j = r() < 0.5 ? 'chest' : 'spine';
      add(sph(0.05 + r() * 0.03, 6, 4), j, [(r() - 0.5) * 0.25, 0.05 + r() * 0.1, 0.12 * W], skin, { scale: [1, 1.2, 0.35] });
    }
    // costelas/ferida
    add(box(0.09, 0.05, 0.02), 'chest', [0.06 * W, 0.0, 0.13 * Math.max(1, W * 0.9)], '#6a1a14');
    if (look.spikes) {
      for (let i = 0; i < 7; i++) {
        const c = new THREE.ConeGeometry(0.03, 0.28 + r() * 0.2, 5);
        add(c, 'chest', [(r() - 0.5) * 0.35 * W, 0.05 + r() * 0.2, -0.18 * W], '#5a5550', { rot: [-1.0 - r() * 0.5, 0, (r() - 0.5) * 0.8] });
      }
    }
  }
  const geo = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  geo.computeBoundingSphere();
  geo.boundingSphere.radius = 2.4;
  return { geo, offsets: off, P };
}

const geoCache = new Map();

// Cria um personagem. look: aparência · opts.kind 'human' | 'zombie'
export class HumanModel {
  constructor(look, { kind = 'human', seed = 1, height = null } = {}) {
    this.kind = kind;
    const key = JSON.stringify(look) + ':' + (kind === 'zombie' ? seed % 5 : 0);
    let built = geoCache.get(key);
    if (!built) { built = buildGeometry(look, seed); geoCache.set(key, built); }
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
    this.mat.emissive = new THREE.Color(0, 0, 0);
    const bones = {};
    const list = [];
    for (const j of JOINTS) {
      const b = new THREE.Bone(); b.name = j;
      b.position.fromArray(built.offsets[j]);
      bones[j] = b; list.push(b);
      if (PARENT[j]) bones[PARENT[j]].add(b);
    }
    this.mesh = new THREE.SkinnedMesh(built.geo, this.mat);
    this.mesh.add(bones.hips);
    this.mesh.bind(new THREE.Skeleton(list));
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = true;
    this.bones = bones;
    this.inner = new THREE.Group();
    this.inner.add(this.mesh);
    this.group = new THREE.Group();
    this.group.add(this.inner);
    const natural = built.P.hipY + built.P.spine + built.P.chest + built.P.neck + built.P.head + built.P.headR * 2;
    this.scale = height ? height / natural : 1;
    this.inner.scale.setScalar(this.scale);
    this.height = natural * this.scale;
    this.anim = new Animator({ kind, look });
    this.flashT = 0;
    // pontos de fixação nas mãos
    this.mountR = new THREE.Group(); this.mountR.position.set(0, -0.06, 0.01); bones.handR.add(this.mountR);
    this.mountL = new THREE.Group(); this.mountL.position.set(0, -0.06, 0.01); bones.handL.add(this.mountL);
    this.headMount = new THREE.Group(); this.headMount.position.set(0, built.P.headR * 0.95, 0); bones.head.add(this.headMount);
    this.chestMount = new THREE.Group(); this.chestMount.position.set(0, 0.08, 0); bones.chest.add(this.chestMount);
    this.weapon = null; this.prop = null;
    this.headR = built.P.headR; this.W = built.P.W;
  }
  setWeapon(def) {
    for (const m of [this.mountR, this.mountL]) while (m.children.length) m.remove(m.children[0]);
    const w = makeWeapon(def);
    if (w.right) this.mountR.add(w.right);
    if (w.left) this.mountL.add(w.left);
    this.anim.style = w.style;
    this.weaponObj = w;
    if (this.prop) this.mountR.add(this.prop);
  }
  setProp(kind) {
    if (this.prop) { this.prop.parent && this.prop.parent.remove(this.prop); this.prop = null; }
    if (this.weaponObj && this.weaponObj.right) this.weaponObj.right.visible = !kind;
    if (kind) { this.prop = makeHandProp(kind); this.mountR.add(this.prop); }
  }
  // capacete, colete e mochila por cima do modelo
  setGear(gear) { applyGear(this, gear, this.headR, this.W); }
  flash(color = '#ff2a1a', t = 0.12) { this.flashT = t; this.mat.emissive.set(color); }
  update(dt, gait) {
    const hit = this.anim.update(dt, gait);
    const p = this.anim.pose;
    for (const j of JOINTS) { const q = p[j]; this.bones[j].rotation.set(q.x, q.y, q.z); }
    this.inner.position.set(0, p.root.py * this.scale, p.root.pz * this.scale);
    this.inner.rotation.set(p.root.rx, 0, p.root.rz);
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.mat.emissive.set(0, 0, 0); }
    return hit;
  }
  dispose() { this.mat.dispose(); }
}

// ---- equipamento visível (usado também pelo modelo GLB do Arthur) ----
const gearMats = {};
const gm = c => (gearMats[c] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.1 }));
export function applyGear(model, gear = {}, headR = 0.125, W = 1) {
  if (!model._gear) model._gear = {};
  const G = model._gear;
  const set = (slot, id, build, parent) => {
    if (G[slot] && G[slot].id === id) return;
    if (G[slot]) { G[slot].obj.parent && G[slot].obj.parent.remove(G[slot].obj); G[slot] = null; }
    if (!id || !parent) return;
    const obj = build();
    if (!obj) return;
    parent.add(obj); G[slot] = { id, obj };
  };
  set('cabeca', gear.cabeca, () => {
    const g = new THREE.Group();
    const c = gear.cabecaColor || '#555';
    if (gear.cabeca === 'bone') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.08, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), gm(c)); cap.position.y = headR * 0.25; g.add(cap);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.4, 0.015, headR * 1.0), gm(c)); brim.position.set(0, headR * 0.3, headR * 1.0); g.add(brim);
    } else {
      const h = new THREE.Mesh(new THREE.SphereGeometry(headR * (gear.cabeca === 'capacete_moto' ? 1.3 : 1.18), 14, 8, 0, Math.PI * 2, 0, gear.cabeca === 'capacete_moto' ? Math.PI * 0.62 : Math.PI / 2), gm(c));
      h.position.y = headR * (gear.cabeca === 'capacete_moto' ? 0 : 0.2); g.add(h);
      if (gear.cabeca === 'capacete_obra') { const b = new THREE.Mesh(new THREE.CylinderGeometry(headR * 1.35, headR * 1.35, 0.015, 14), gm(c)); b.position.y = headR * 0.22; g.add(b); }
      if (gear.cabeca === 'capacete_moto') { const v = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.5, headR * 0.5, 0.02), gm('#1a2630')); v.position.set(0, 0, headR * 1.22); g.add(v); }
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }, model.headMount);
  set('torso', gear.torso === 'armadura' || gear.torso === 'colete' ? gear.torso : null, () => {
    const g = new THREE.Group();
    const c = gear.torsoColor || '#555';
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.4 * W, 0.36, 0.3 * Math.max(1, W * 0.9)), gm(c)); v.position.y = -0.04; g.add(v);
    if (gear.torso === 'armadura') for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3 * W, 0.08, 0.02), gm('#8a8478')); p.position.set(0, 0.08 - i * 0.11, 0.16 * Math.max(1, W * 0.9)); p.rotation.z = (i - 1) * 0.08; g.add(p); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }, model.chestMount);
  set('mochila', gear.mochila, () => {
    const g = new THREE.Group();
    const big = gear.mochila === 'mochila_grande';
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3 * W, big ? 0.5 : 0.36, big ? 0.2 : 0.14), gm(gear.mochilaColor || '#333')); b.position.set(0, big ? 0.02 : 0, -0.22 * Math.max(1, W * 0.9)); g.add(b);
    if (big) { const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34 * W, 8), gm('#7a6a4a')); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.3, -0.22 * Math.max(1, W * 0.9)); g.add(roll); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }, model.chestMount);
}
