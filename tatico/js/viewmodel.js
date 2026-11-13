// Força Tática — arma em primeira pessoa (cena separada, desenhada por cima)
import * as THREE from '../../lib/three.module.min.js';
import { buildGun, mat } from './models.js';
import * as TX from './textures.js';

const BASE = {
  rifle: [0.19, -0.2, -0.52], smg: [0.17, -0.18, -0.44], shotgun: [0.19, -0.2, -0.5], sniper: [0.19, -0.2, -0.52],
  pistol: [0.15, -0.16, -0.4], knife: [0.17, -0.18, -0.4], grenade: [0.17, -0.18, -0.42], bomb: [0.03, -0.25, -0.48],
};
const GLOVE = { atk: 0x3b3227, def: 0x1f262e };
const SLEEVE = { atk: 0xa07a46, def: 0x3a4d68 };

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6b5a45, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(0.5, 1, 0.3);
    this.scene.add(sun);
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.scale.setScalar(0.18);
    this.flash.visible = false;
    this.key = null;
    this.bobT = 0;
    this.swayX = 0; this.swayY = 0;
    this.shotSeen = 0;
  }

  setAspect(a) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }

  build(def, team) {
    const key = def.id + team;
    if (this.key === key) return;
    this.key = key;
    this.holder.clear();
    this.gun = buildGun(def.model, def.color);
    this.gun.traverse(o => { if (o.isMesh) o.castShadow = false; });
    this.holder.add(this.gun);
    this.type = def.type;
    const muzzle = this.gun.userData.muzzle;
    muzzle.add(this.flash);
    this.flash.position.set(0, 0, -0.03);
    // braços
    const glove = mat(GLOVE[team]), sleeve = mat(SLEEVE[team]);
    const limb = (from, to, w, m) => {
      const g = new THREE.Group();
      const len = from.distanceTo(to);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, w, len), m);
      mesh.position.z = -len / 2;
      g.add(mesh);
      g.position.copy(from);
      g.lookAt(to);
      g.rotateY(Math.PI);
      this.holder.add(g);
      return g;
    };
    const small = ['pistol', 'knife', 'grenade'].includes(def.type);
    const two = def.type !== 'knife' && def.type !== 'grenade';
    const gripR = new THREE.Vector3(0.005, -0.06, 0.04);
    const gripL = def.type === 'bomb' ? new THREE.Vector3(-0.08, -0.03, 0.02) : small ? new THREE.Vector3(-0.025, -0.06, 0.05) : new THREE.Vector3(-0.005, -0.03, -0.3);
    limb(new THREE.Vector3(0.12, -0.25, 0.32), gripR, 0.07, sleeve);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.07), glove);
    hand.position.copy(gripR).add(new THREE.Vector3(0.012, 0.01, 0));
    this.holder.add(hand);
    if (two) {
      limb(new THREE.Vector3(-0.2, -0.3, 0.25), gripL, 0.065, sleeve);
      const handL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.08), glove);
      handL.position.copy(gripL);
      this.holder.add(handL);
    }
    const b = BASE[def.type] || BASE.rifle;
    this.base = new THREE.Vector3(...b);
  }

  update(dt, a, game, mdx, mdy) {
    if (!a || !a.alive) { this.holder.visible = false; return; }
    const def = a.curDef();
    this.build(def, a.team);
    const t = game.time;
    this.holder.visible = !(a.scope > 0);
    const pos = this.base.clone();
    // a arma aponta um pouco para o centro da tela
    const rot = new THREE.Euler(0.02, 0.05, 0);

    // balanço do andar
    const speed = Math.hypot(a.vel.x, a.vel.z);
    const amt = a.onGround ? Math.min(1, speed / 5) : 0;
    this.bobT += dt * speed * 1.5;
    pos.x += Math.sin(this.bobT) * 0.012 * amt;
    pos.y += -Math.abs(Math.cos(this.bobT)) * 0.012 * amt;
    if (!a.onGround) pos.y += Math.max(-0.03, Math.min(0.03, -a.vel.y * 0.004));
    // atraso ao mexer o mouse
    this.swayX += (-mdx * 0.00025 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (mdy * 0.00025 - this.swayY) * Math.min(1, dt * 10);
    this.swayX = Math.max(-0.04, Math.min(0.04, this.swayX));
    this.swayY = Math.max(-0.04, Math.min(0.04, this.swayY));
    pos.x += this.swayX; pos.y += this.swayY;
    rot.y += this.swayX * 2; rot.x += this.swayY * 2;
    if (a.ducking) { pos.y += 0.01; pos.x -= 0.01; }

    // sacar a arma
    const deploy = def.deploy || 0.5;
    const ds = Math.max(0, Math.min(1, 1 - (a.drawEnd - t) / deploy));
    const de = 1 - Math.pow(1 - ds, 3);
    pos.y -= (1 - de) * 0.22;
    rot.x -= (1 - de) * 0.9;

    // coice do tiro
    const since = t - (a.lastShot || -10);
    if (def.type !== 'knife' && def.type !== 'grenade') {
      const k = Math.exp(-since * (def.type === 'sniper' || def.type === 'shotgun' ? 9 : 22));
      const strength = def.type === 'sniper' || def.type === 'shotgun' ? 2.2 : def.type === 'pistol' ? 1.4 : 1;
      pos.z += 0.035 * k * strength;
      rot.x += 0.07 * k * strength;
      if (a.lastShot !== this.shotSeen) { this.shotSeen = a.lastShot; this.flashT = 0.045; this.flash.material.rotation = Math.random() * 6; }
    }
    this.flashT = (this.flashT || 0) - dt;
    this.flash.visible = this.flashT > 0;

    // recarregar
    if (a.reloading) {
      const p = Math.max(0, Math.min(1, (t - a.reloadStart) / (a.reloadEnd - a.reloadStart)));
      const s = Math.sin(p * Math.PI);
      pos.y -= 0.07 * s;
      pos.x -= 0.03 * s;
      rot.z += 0.6 * s;
      rot.x -= 0.25 * s;
    }
    // faca
    if (def.type === 'knife' && a.lastAttack) {
      const p = (t - a.lastAttack) / (a.lastAttackStrong ? 0.5 : 0.3);
      if (p < 1) {
        const s = Math.sin(p * Math.PI);
        if (a.lastAttackStrong) { pos.z -= 0.12 * s; rot.x -= 0.5 * s; pos.x -= 0.05 * s; }
        else { rot.y += 1.4 * s; rot.z -= 0.6 * s; pos.x -= 0.1 * s; pos.z -= 0.06 * s; }
      }
    }
    // granada: puxa o braço para trás e arremessa
    if (def.type === 'grenade' && a.throwAt) {
      const p = 1 - Math.max(0, (a.throwAt - t) / 0.22);
      pos.y += 0.06 * p; pos.z += 0.12 * p; rot.x += 0.8 * p;
    }
    // plantando: encosta a bomba no chão
    if (def.type === 'bomb' && a.planting) {
      pos.y -= 0.08 + Math.sin(t * 30) * 0.003;
      rot.x -= 0.5;
    }
    this.holder.position.copy(pos);
    this.holder.rotation.copy(rot);
  }

  render(renderer) {
    if (!this.holder.visible) return;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
