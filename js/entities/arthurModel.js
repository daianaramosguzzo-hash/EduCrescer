// Modelo 3D do Arthur (assets/models/arthur.glb): texturizado e rigado, com as
// animações Idle e Walk. Correr, atacar, coletar, comer etc. são feitos por
// código girando os ossos por cima da animação que está tocando (js/entities/anim.js).
// Se o arquivo não carregar, o jogo usa um Arthur feito em código.
import * as THREE from '../../lib/three.module.min.js';
import { GLTFLoader } from '../../lib/addons/GLTFLoader.js';
import { MeshoptDecoder } from '../../lib/addons/meshopt_decoder.module.js';
import { clone as cloneSkinned } from '../../lib/addons/SkeletonUtils.js';
import { Animator, JOINTS } from './anim.js';
import { makeWeapon, makeHandProp } from './weapons.js';
import { applyGear } from './humanModel.js';

let GLTF = null;
const HEIGHT = 1.62;

export async function loadArthur() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const file = 'assets/models/arthur.glb';
  try {
    GLTF = await loader.loadAsync(file);
  } catch (e) {
    // hospedagens que não servem .glb podem ter uma cópia em base64 (.glb.txt)
    try {
      const r = await fetch(file + '.txt');
      if (!r.ok) throw e;
      const bin = Uint8Array.from(atob((await r.text()).trim()), c => c.charCodeAt(0));
      GLTF = await loader.parseAsync(bin.buffer, '');
    } catch (e2) {
      console.warn('Modelo do Arthur não carregou; usando o modelo feito em código.', e2 && e2.message);
      GLTF = null;
    }
  }
  return !!GLTF;
}
export const hasArthurGlb = () => !!GLTF;

// nomes dos ossos do arquivo para as articulações das animações
const BONE_NAMES = {
  hips: ['hips'], spine: ['spine'], chest: ['upperchest', 'chest'], neck: ['neck'], head: ['head'],
  armL: ['upperarml'], foreL: ['forearml'], handL: ['handl'], armR: ['upperarmr'], foreR: ['forearmr'], handR: ['handr'],
  thighL: ['thighl'], shinL: ['shinl'], footL: ['footl'], thighR: ['thighr'], shinR: ['shinr'], footR: ['footr'],
};
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const q = new THREE.Quaternion(), qp = new THREE.Quaternion(), qs = new THREE.Quaternion(), v = new THREE.Vector3();

export class ArthurModel {
  constructor() {
    const scene = cloneSkinned(GLTF.scene);
    scene.traverse(o => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.side = THREE.DoubleSide;
        o.material.emissive = new THREE.Color(0, 0, 0);
        o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false;
        this.mat = o.material;
      }
    });
    this.scene = scene;
    const model = new THREE.Group(); model.add(scene);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene, true);
    const size = box.getSize(new THREE.Vector3());
    const s = HEIGHT / size.y;
    model.scale.setScalar(s);
    model.position.y = -box.min.y * s;
    this.inner = new THREE.Group(); this.inner.add(model);
    this.group = new THREE.Group(); this.group.add(this.inner);
    this.height = HEIGHT; this.scale = 1;
    this.mixer = new THREE.AnimationMixer(scene);
    this.clips = {};
    for (const c of GLTF.animations) this.clips[c.name.toLowerCase()] = this.mixer.clipAction(c);
    this.idle = this.clips.idle; this.walk = this.clips.walk || this.clips.andar; this.run = this.clips.run || this.clips.correr || null;
    this.cur = null;
    this.playLoop(this.idle, 0);
    // ossos
    const byName = {};
    scene.traverse(o => { if (o.isBone) byName[o.name.toLowerCase().replace(/[^a-z]/g, '')] = o; });
    this.bones = {};
    for (const j of JOINTS) this.bones[j] = BONE_NAMES[j].map(n => byName[n]).find(Boolean) || null;
    this.allBones = Object.values(byName);
    this.rest = new Map(this.allBones.map(b => [b, b.quaternion.clone()]));
    this.anim = new Animator({ kind: 'human', loco: false });
    this.flashT = 0;
    // pose de referência (Idle no início) para alinhar as peças presas aos ossos
    this.mixer.update(0);
    this.group.updateMatrixWorld(true);
    this.mountR = this.makeMount(this.bones.handR, new THREE.Vector3(0, -0.07, 0.015));
    this.mountL = this.makeMount(this.bones.handL, new THREE.Vector3(0, -0.07, 0.015));
    this.headMount = this.makeMount(this.bones.head, new THREE.Vector3(0, 0.13, 0.0));
    this.chestMount = this.makeMount(this.bones.chest, new THREE.Vector3(0, 0.05, 0));
    this.headR = 0.14; this.W = 0.95;
    this.hasBackpack = true;
    this.prop = null;
  }
  // um objeto preso ao osso, mas com os eixos do personagem na pose parada
  makeMount(bone, offset) {
    const m = new THREE.Group();
    if (!bone) { this.group.add(m); return m; }
    const bq = new THREE.Quaternion(), bp = new THREE.Vector3(), bs = new THREE.Vector3();
    bone.matrixWorld.decompose(bp, bq, bs);
    const gq = this.group.getWorldQuaternion(new THREE.Quaternion());
    m.quaternion.copy(bq).invert().multiply(gq);
    m.scale.setScalar(1 / bs.x);
    m.position.copy(offset).applyQuaternion(gq).applyQuaternion(bq.clone().invert()).divideScalar(bs.x);
    bone.add(m);
    return m;
  }
  playLoop(a, fade = 0.2) {
    if (!a || a === this.cur) return;
    a.reset().setEffectiveWeight(1).play();
    if (this.cur) this.cur.crossFadeTo(a, fade, false);
    this.cur = a;
  }
  setWeapon(def) {
    for (const m of [this.mountR, this.mountL]) while (m.children.length) m.remove(m.children[0]);
    const w = makeWeapon(def);
    if (w.right) this.mountR.add(w.right);
    if (w.left) this.mountL.add(w.left);
    this.anim.style = w.style; this.weaponObj = w;
    if (this.prop) this.mountR.add(this.prop);
  }
  setProp(kind) {
    if (this.prop) { this.prop.parent && this.prop.parent.remove(this.prop); this.prop = null; }
    if (this.weaponObj && this.weaponObj.right) this.weaponObj.right.visible = !kind;
    if (kind) { this.prop = makeHandProp(kind); this.mountR.add(this.prop); }
  }
  setGear(gear) { applyGear(this, { ...gear, mochila: null }, this.headR, this.W); }
  flash(color = '#ff2a1a', t = 0.12) { this.flashT = t; if (this.mat) this.mat.emissive.set(color).multiplyScalar(0.6); }
  // gira um osso em torno de um eixo do personagem
  turn(b, axis, ang) {
    if (!b || Math.abs(ang) < 1e-4) return;
    this.group.getWorldQuaternion(qs);
    b.parent.getWorldQuaternion(qp);
    v.copy(AX[axis]).applyQuaternion(qs).applyQuaternion(qp.invert());
    b.quaternion.premultiply(q.setFromAxisAngle(v, ang));
    b.updateMatrixWorld(true);
  }
  update(dt, gait) {
    for (const b of this.allBones) b.quaternion.copy(this.rest.get(b));
    const hit = this.anim.update(dt, gait);
    const dead = this.anim.dead;
    const moving = gait > 0.05 && !dead;
    this.playLoop(moving ? (gait > 1.3 && this.run ? this.run : this.walk) : this.idle);
    if (this.walk) this.walk.setEffectiveTimeScale(gait > 1 ? 1.5 + (gait - 1) * 1.2 : 1.5 * Math.max(0.6, gait));
    this.mixer.update(dead ? 0 : dt);
    this.group.updateMatrixWorld(true);
    const p = this.anim.pose;
    // corrida: inclina o corpo e abre mais os braços
    const run = Math.max(0, Math.min(1, gait - 1));
    if (run > 0 && !dead) { p.spine.x += 0.22 * run; p.foreL.x -= 0.7 * run; p.foreR.x -= 0.7 * run; }
    // a malha da jaqueta estica se o braço sobe ou abre demais
    for (const a of ['armL', 'armR']) { p[a].x = Math.max(-1.75, p[a].x * 0.85); p[a].z *= 0.6; }
    // segurando arma: a animação de andar balança menos o braço
    for (const j of JOINTS) {
      const b = this.bones[j], o = p[j];
      if (!b) continue;
      this.turn(b, 'x', o.x); this.turn(b, 'y', o.y); this.turn(b, 'z', o.z);
    }
    this.inner.position.set(0, p.root.py, p.root.pz);
    this.inner.rotation.set(p.root.rx, 0, p.root.rz);
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0 && this.mat) this.mat.emissive.set(0, 0, 0); }
    return hit;
  }
  dispose() {}
}
