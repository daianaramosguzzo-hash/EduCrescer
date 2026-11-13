// Força Tática — efeitos: marcas de tiro, partículas, traçantes, clarão e fumaça
import * as THREE from '../../lib/three.module.min.js';
import * as TX from './textures.js';

const MAX_P = 900;

export class FX {
  constructor(scene) {
    this.scene = scene;
    // marcas de tiro
    const holeMat = new THREE.MeshBasicMaterial({ map: TX.holeTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const holeGeo = new THREE.PlaneGeometry(0.13, 0.13);
    this.holes = [];
    for (let i = 0; i < 180; i++) {
      const m = new THREE.Mesh(holeGeo, holeMat);
      m.visible = false;
      scene.add(m);
      this.holes.push(m);
    }
    this.holeIdx = 0;

    // partículas
    this.pPos = new Float32Array(MAX_P * 3);
    this.pCol = new Float32Array(MAX_P * 3);
    this.pVel = new Float32Array(MAX_P * 3);
    this.pLife = new Float32Array(MAX_P);
    this.pGrav = new Float32Array(MAX_P);
    this.pBase = new Float32Array(MAX_P * 3);
    this.pMax = new Float32Array(MAX_P);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({
      size: 0.07, vertexColors: true, map: TX.radialTexture(), transparent: true, depthWrite: false, alphaTest: 0.05,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.pIdx = 0;
    for (let i = 0; i < MAX_P; i++) this.pPos[i * 3 + 1] = -100;

    // traçantes
    this.trMax = 64;
    this.trPos = new Float32Array(this.trMax * 6);
    this.trCol = new Float32Array(this.trMax * 6);
    this.trLife = new Float32Array(this.trMax);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(this.trPos, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(this.trCol, 3));
    this.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tracers.frustumCulled = false;
    scene.add(this.tracers);
    this.trIdx = 0;

    // clarões dos tiros no mundo
    this.flashTex = TX.flashTexture();
    this.flashes = [];
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.visible = false;
      s.life = 0;
      scene.add(s);
      this.flashes.push(s);
    }
    this.flashIdx = 0;
    this.light = new THREE.PointLight(0xffc070, 0, 9, 2);
    scene.add(this.light);

    // explosões
    this.booms = [];
    this.boomTex = TX.radialTexture('rgba(255,220,150,1)', 'rgba(255,90,20,0)');
    // fumaças
    this.smokeTex = TX.smokeTexture();
    this.smokes = [];
  }

  hole(point, normal) {
    const m = this.holes[this.holeIdx];
    this.holeIdx = (this.holeIdx + 1) % this.holes.length;
    m.position.copy(point).addScaledVector(normal, 0.01);
    m.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z);
    m.rotation.z = Math.random() * 6;
    m.visible = true;
  }

  burst(point, normal, color, n = 8, speed = 2.5, grav = 6, life = 0.5) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.pIdx;
      this.pIdx = (this.pIdx + 1) % MAX_P;
      this.pPos[i * 3] = point.x; this.pPos[i * 3 + 1] = point.y; this.pPos[i * 3 + 2] = point.z;
      const r = () => (Math.random() - 0.5) * 2;
      const nx = normal ? normal.x : 0, ny = normal ? normal.y : 0, nz = normal ? normal.z : 0;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.pVel[i * 3] = (nx + r() * 0.7) * s;
      this.pVel[i * 3 + 1] = (ny + r() * 0.7 + 0.3) * s;
      this.pVel[i * 3 + 2] = (nz + r() * 0.7) * s;
      const v = 0.8 + Math.random() * 0.4;
      this.pBase[i * 3] = c.r * v; this.pBase[i * 3 + 1] = c.g * v; this.pBase[i * 3 + 2] = c.b * v;
      this.pLife[i] = life * (0.6 + Math.random() * 0.6);
      this.pMax[i] = this.pLife[i];
      this.pGrav[i] = grav;
    }
  }

  impact(point, normal, kind) {
    this.hole(point, normal);
    if (kind === 'metal') this.burst(point, normal, 0xffd070, 6, 4, 9, 0.25);
    else if (kind === 'crate') this.burst(point, normal, 0x8a5a2a, 7, 2.5, 8, 0.5);
    else this.burst(point, normal, 0xcdb48a, 9, 2.2, 5, 0.6);
  }

  blood(point, dir, head) {
    this.burst(point, dir, 0x9a0f0f, head ? 18 : 9, head ? 3 : 2, 7, 0.5);
  }

  tracer(from, to, bright = 1) {
    const i = this.trIdx;
    this.trIdx = (this.trIdx + 1) % this.trMax;
    // traçante curta perto da boca do cano, andando em direção ao alvo
    this.trPos.set([from.x, from.y, from.z, to.x, to.y, to.z], i * 6);
    this.trLife[i] = 0.06 * bright;
    this._trBright = bright;
  }

  muzzle(pos, big = 1) {
    const s = this.flashes[this.flashIdx];
    this.flashIdx = (this.flashIdx + 1) % this.flashes.length;
    s.position.copy(pos);
    s.scale.setScalar(0.35 * big);
    s.material.rotation = Math.random() * 6;
    s.visible = true;
    s.life = 0.05;
    this.light.position.copy(pos);
    this.light.intensity = 6 * big;
  }

  explosion(pos) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.boomTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.copy(pos).setY(pos.y + 0.6);
    s.scale.setScalar(0.5);
    this.scene.add(s);
    this.booms.push({ s, t: 0 });
    this.light.position.copy(pos).setY(pos.y + 1);
    this.light.intensity = 40;
    this.burst(pos, new THREE.Vector3(0, 1, 0), 0x40342a, 40, 8, 9, 1.2);
    this.burst(pos, new THREE.Vector3(0, 1, 0), 0xffb050, 30, 10, 6, 0.5);
  }

  flashBurst(pos) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.boomTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.copy(pos);
    s.scale.setScalar(1);
    this.scene.add(s);
    this.booms.push({ s, t: 0, white: true });
    this.light.position.copy(pos);
    this.light.intensity = 60;
  }

  // nuvem de fumaça (smoke = { pos, start, end } do jogo)
  addSmoke(smoke) {
    const g = new THREE.Group();
    const parts = [];
    for (let i = 0; i < 26; i++) {
      const m = new THREE.SpriteMaterial({ map: this.smokeTex, color: 0xc9cdd1, transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(m);
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 2.6;
      s.userData.target = new THREE.Vector3(Math.cos(a) * r, 0.6 + Math.random() * 2.6, Math.sin(a) * r);
      s.userData.size = 3.2 + Math.random() * 2.2;
      s.userData.spin = (Math.random() - 0.5) * 0.3;
      g.add(s);
      parts.push(s);
    }
    g.position.copy(smoke.pos);
    this.scene.add(g);
    this.smokes.push({ g, parts, smoke });
  }

  clearAll() {
    for (const h of this.holes) h.visible = false;
    for (const s of this.smokes) this.scene.remove(s.g);
    this.smokes = [];
    for (const b of this.booms) this.scene.remove(b.s);
    this.booms = [];
    this.pLife.fill(0);
    for (let i = 0; i < MAX_P; i++) this.pPos[i * 3 + 1] = -100;
  }

  update(dt, now) {
    // partículas
    for (let i = 0; i < MAX_P; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) { this.pPos[i * 3 + 1] = -100; continue; }
      this.pVel[i * 3 + 1] -= this.pGrav[i] * dt;
      this.pPos[i * 3] += this.pVel[i * 3] * dt;
      this.pPos[i * 3 + 1] = Math.max(0.01, this.pPos[i * 3 + 1] + this.pVel[i * 3 + 1] * dt);
      this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
      const f = Math.min(1, this.pLife[i] / this.pMax[i] * 2);
      this.pCol[i * 3] = this.pBase[i * 3] * f;
      this.pCol[i * 3 + 1] = this.pBase[i * 3 + 1] * f;
      this.pCol[i * 3 + 2] = this.pBase[i * 3 + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;

    for (let i = 0; i < this.trMax; i++) {
      const l = Math.max(0, this.trLife[i] -= dt);
      const c = Math.min(1, l / 0.03);
      for (let k = 0; k < 2; k++) {
        const b = k ? 0.35 : 1;
        this.trCol[i * 6 + k * 3] = c * b; this.trCol[i * 6 + k * 3 + 1] = c * 0.85 * b; this.trCol[i * 6 + k * 3 + 2] = c * 0.5 * b;
      }
    }
    this.tracers.geometry.attributes.position.needsUpdate = true;
    this.tracers.geometry.attributes.color.needsUpdate = true;

    for (const s of this.flashes) {
      if (!s.visible) continue;
      s.life -= dt;
      if (s.life <= 0) s.visible = false;
    }
    this.light.intensity *= Math.exp(-dt * 30);

    for (let i = this.booms.length - 1; i >= 0; i--) {
      const b = this.booms[i];
      b.t += dt;
      const k = b.t / (b.white ? 0.35 : 0.6);
      b.s.scale.setScalar((b.white ? 3 : 7) * Math.min(1, k * 3));
      b.s.material.opacity = Math.max(0, 1 - k);
      if (k >= 1) { this.scene.remove(b.s); this.booms.splice(i, 1); }
    }

    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const sm = this.smokes[i];
      const age = now - sm.smoke.start, left = sm.smoke.end - now;
      if (left <= 0 || sm.smoke.removed) { this.scene.remove(sm.g); this.smokes.splice(i, 1); continue; }
      const grow = Math.min(1, age / 1.3);
      const op = Math.min(1, left / 3) * Math.min(1, age * 2);
      for (const s of sm.parts) {
        s.position.copy(s.userData.target).multiplyScalar(0.3 + 0.7 * grow);
        s.scale.setScalar(s.userData.size * (0.4 + 0.6 * grow));
        s.material.opacity = 0.9 * op;
        s.material.rotation += s.userData.spin * dt;
      }
    }
  }
}
