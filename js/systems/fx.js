// Efeitos: partículas (sangue, lascas, faíscas, poeira), manchas no chão,
// clarão e rastro de tiro, números de dano e fumaça/fogo.
import * as THREE from '../../lib/three.module.min.js';
import * as T from '../core/textures.js';
import { R } from '../core/util.js';

export class FX {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    const N = 500;
    this.N = N;
    const g = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.7 }), N);
    this.mesh.frustumCulled = false; this.mesh.count = N;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.p = Array.from({ length: N }, () => ({ life: 0 }));
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < N; i++) this.mesh.setMatrixAt(i, zero);
    scene.add(this.mesh);
    this.next = 0;
    // manchas no chão (sangue)
    this.decals = [];
    this.decalMat = new THREE.MeshBasicMaterial({ map: T.bloodTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, color: '#b0b0b0' });
    this.decalGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    // clarão de tiro
    this.flash = new THREE.PointLight('#ffcc66', 0, 12, 2);
    scene.add(this.flash);
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glowTex(), color: '#ffd080', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flashSprite.visible = false; scene.add(this.flashSprite);
    this.flashT = 0;
    this.tracers = [];
    this.texts = [];
    this.layer = document.getElementById('floaters');
    // fumaça e fogo
    this.smokeMat = new THREE.SpriteMaterial({ map: T.smokeTex(), color: '#8a8580', transparent: true, depthWrite: false, opacity: 0.5 });
    this.fireMat = new THREE.SpriteMaterial({ map: T.glowTex(), color: '#ff8a30', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.smokes = [];
    this.emitters = [];
  }
  // tipo: blood | wood | stone | leaf | spark | dust | cloth
  burst(x, y, z, type = 'blood', n = 10, power = 1) {
    const colors = { blood: ['#7a0c0c', '#a01a14', '#5a0a08'], wood: ['#a8805a', '#c8a070', '#7a5a3a'], stone: ['#9a948a', '#b8b2a8', '#6a6660'], leaf: ['#5a8a3a', '#7aa04a', '#4a6a2a'], spark: ['#ffd070', '#ffb040'], dust: ['#b8a888', '#a89878'], cloth: ['#c8c0b0', '#8a8070'], metal: ['#9aa0a6', '#6a7076'] }[type] || ['#fff'];
    for (let i = 0; i < n; i++) {
      const p = this.p[this.next]; const idx = this.next;
      this.next = (this.next + 1) % this.N;
      const a = R() * Math.PI * 2, sp = (1 + R() * 2.5) * power;
      Object.assign(p, {
        x, y, z, vx: Math.cos(a) * sp, vy: (2 + R() * 3) * power * (type === 'dust' ? 0.3 : 1), vz: Math.sin(a) * sp,
        life: 0.5 + R() * 0.6, max: 1, size: (type === 'spark' ? 0.04 : type === 'dust' ? 0.12 : 0.07) * (0.6 + R() * 0.8), rot: R() * 6, g: type === 'dust' ? -1 : 9.8, idx,
      });
      p.max = p.life;
      this.mesh.setColorAt(idx, new THREE.Color(colors[Math.floor(R() * colors.length)]));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }
  blood(x, z, size = 1) {
    const m = new THREE.Mesh(this.decalGeo, this.decalMat);
    m.position.set(x + (R() - 0.5) * 0.4, 0.04 + R() * 0.01, z + (R() - 0.5) * 0.4);
    m.rotation.y = R() * 6; m.scale.setScalar(size * (0.7 + R() * 0.6));
    this.scene.add(m);
    this.decals.push({ m, t: 60 });
    if (this.decals.length > 50) { const d = this.decals.shift(); this.scene.remove(d.m); }
  }
  muzzle(x, y, z) {
    this.flash.position.set(x, y + 0.3, z); this.flash.intensity = 30;
    this.flashSprite.position.set(x, y, z); this.flashSprite.scale.setScalar(0.9); this.flashSprite.visible = true;
    this.flashT = 0.06;
  }
  tracer(x0, y0, z0, x1, y1, z1) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffe0a0', transparent: true, opacity: 0.9 }));
    this.scene.add(l); this.tracers.push({ l, t: 0.08 });
  }
  // número flutuante (dano, +itens)
  text(x, y, z, str, cls = '') {
    if (!this.layer) return;
    const d = document.createElement('div');
    d.className = 'floater ' + cls; d.textContent = str;
    this.layer.appendChild(d);
    this.texts.push({ d, x, y, z, t: 0, dx: (R() - 0.5) * 30 });
  }
  // fumaça contínua (casas queimando ao longe, fogueiras)
  addEmitter(x, y, z, { fire = false, rate = 3, scale = 1 } = {}) { const e = { x, y, z, fire, rate, scale, acc: 0, on: true }; this.emitters.push(e); return e; }
  update(dt, camera) {
    const g = 9.8;
    for (const p of this.p) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03 && p.g > 0) { p.y = 0.03; p.vx *= 0.5; p.vz *= 0.5; p.vy = 0; }
      const k = p.life > 0 ? Math.min(1, p.life / p.max * 2) : 0;
      this.e.set(p.rot, p.rot * 0.7, 0); this.q.setFromEuler(this.e);
      this.v.set(p.x, p.y, p.z); this.s.setScalar(p.size * k);
      this.mesh.setMatrixAt(p.idx, this.m4.compose(this.v, this.q, this.s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) { this.flash.intensity = 0; this.flashSprite.visible = false; } }
    for (let i = this.tracers.length - 1; i >= 0; i--) { const t = this.tracers[i]; t.t -= dt; t.l.material.opacity = Math.max(0, t.t / 0.08); if (t.t <= 0) { this.scene.remove(t.l); t.l.geometry.dispose(); this.tracers.splice(i, 1); } }
    for (let i = this.decals.length - 1; i >= 0; i--) { const d = this.decals[i]; d.t -= dt; if (d.t < 5) d.m.material = this.decalMat; if (d.t <= 0) { this.scene.remove(d.m); this.decals.splice(i, 1); } }
    // textos
    const W = window.innerWidth, H = window.innerHeight;
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.t += dt;
      this.v.set(t.x, t.y + t.t * 1.2, t.z).project(camera);
      t.d.style.transform = `translate(${(this.v.x * 0.5 + 0.5) * W + t.dx * t.t}px, ${(-this.v.y * 0.5 + 0.5) * H}px) translate(-50%, -50%)`;
      t.d.style.opacity = String(Math.max(0, 1 - Math.max(0, t.t - 0.6) / 0.5));
      if (t.t > 1.1) { t.d.remove(); this.texts.splice(i, 1); }
    }
    // emissores de fumaça/fogo
    for (const e of this.emitters) {
      if (!e.on) continue;
      e.acc += dt * e.rate;
      while (e.acc > 1) {
        e.acc -= 1;
        const s = new THREE.Sprite(e.fire && R() < 0.6 ? this.fireMat : this.smokeMat);
        s.position.set(e.x + (R() - 0.5) * 0.3 * e.scale, e.y, e.z + (R() - 0.5) * 0.3 * e.scale);
        this.scene.add(s);
        this.smokes.push({ s, t: 0, life: s.material === this.fireMat ? 0.5 + R() * 0.3 : 3 + R() * 2, vx: 0.3 + R() * 0.3, sc: e.scale, fire: s.material === this.fireMat });
      }
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]; s.t += dt;
      const k = s.t / s.life;
      s.s.position.y += dt * (s.fire ? 1.2 : 0.9); s.s.position.x += dt * s.vx;
      s.s.scale.setScalar((s.fire ? 0.6 * (1 - k) + 0.2 : 0.5 + k * 2.5) * s.sc);
      if (k >= 1) { this.scene.remove(s.s); this.smokes.splice(i, 1); }
    }
  }
}
