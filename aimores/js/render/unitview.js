// Personagens na cena: planos com as tiras de sprites, sombra, anel de seleção,
// silhueta (quando atrás de paredes), balões, números de dano e efeitos.
import * as THREE from '../../../lib/three.module.min.js';
import { getStrip, frameDims, BAKE_SCALE, PX_PER_UNIT } from '../sprites/bank.js';
import { ANIMS } from '../sprites/painter.js';
import { LOOKS } from '../sprites/looks.js';
import { blobTexture, bloodTexture, glowTexture } from './textures.js';
import { bus } from '../util.js';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `uniform sampler2D map; uniform vec3 tint; uniform float flash; uniform vec3 flashColor; uniform float alpha;
varying vec2 vUv;
void main(){
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.45) discard;
  vec3 col = mix(c.rgb * tint, flashColor, flash);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;
const XRAY = `uniform sampler2D map; uniform vec3 color; varying vec2 vUv;
void main(){ vec4 c = texture2D(map, vUv); if (c.a < 0.45) discard; gl_FragColor = vec4(color, 0.55);
  #include <colorspace_fragment>
}`;

export const HERO_COLORS = { arthur: '#f0a040', carol: '#3fc8b0', daiana: '#4a8aff', pablicio: '#8ad040' };

export class UnitView {
  constructor(scene, camera, overlay) {
    this.scene = scene; this.camera = camera; this.overlay = overlay;
    this.list = new Map();
    this.pitchStretch = 1 / Math.cos(35 * Math.PI / 180);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false });
    this.bloodMat = new THREE.MeshBasicMaterial({ map: bloodTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.effects = [];
    this.floaters = [];
    this.camYaw = Math.PI / 4;
    this.v3 = new THREE.Vector3();
  }

  // ------------------------------------------------------------ criação
  add(unit) {
    const look = LOOKS[unit.look];
    const dims = frameDims(look);
    const W = dims.fw / BAKE_SCALE / PX_PER_UNIT;
    const Hh = dims.fh / BAKE_SCALE / PX_PER_UNIT * this.pitchStretch;
    const below = (dims.fh - dims.foot) / dims.fh * Hh;
    const geo = new THREE.PlaneGeometry(W, Hh);
    geo.translate(0, Hh / 2 - below, 0);
    const uni = { map: { value: null }, tint: { value: new THREE.Color(1, 1, 1) }, flash: { value: 0 }, flashColor: { value: new THREE.Color(1, 1, 1) }, alpha: { value: 1 } };
    const mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;
    const group = new THREE.Group();
    group.add(mesh);
    // silhueta atrás das paredes (heróis)
    let xray = null;
    if (unit.kind === 'hero' || unit.faction === 'ally') {
      const xm = new THREE.ShaderMaterial({ uniforms: { map: uni.map, color: { value: new THREE.Color(HERO_COLORS[unit.id] || '#ffffff') } }, vertexShader: VERT, fragmentShader: XRAY, transparent: true, depthWrite: false, depthFunc: THREE.GreaterDepth });
      xray = new THREE.Mesh(geo, xm);
      xray.renderOrder = 10;
      group.add(xray);
    }
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.shadowMat);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02;
    const ss = look.body.shW / 12 * (look.scale || 1) * 1.1;
    shadow.scale.set(ss, ss * 0.8, 1);
    group.add(shadow);
    let ring = null;
    if (unit.kind === 'hero') {
      ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 28), new THREE.MeshBasicMaterial({ color: HERO_COLORS[unit.id] || '#fff', transparent: true, opacity: 0.9, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
      group.add(ring);
    }
    group.position.set(unit.x + 0.5, 0, unit.z + 0.5);
    this.scene.add(group);
    const v = { unit, look, group, mesh, mat, uni, xray, shadow, ring, geo, anim: 'idle', loop: true, t: 0, frame: -1, dir: 0, strip: null,
      pos: new THREE.Vector3(unit.x + 0.5, 0, unit.z + 0.5), moves: [], done: null, flash: 0, hidden: false, bob: 0, alpha: 1, bubble: null, hp: null };
    this.list.set(unit.uid, v);
    this.setAnim(v, unit.dead ? 'dead' : 'idle', true);
    return v;
  }
  remove(unit) {
    const v = this.list.get(unit.uid);
    if (!v) return;
    // ninguém fica esperando uma animação que não vai mais terminar
    if (v.done) { const d = v.done; v.done = null; d(); }
    for (const m of v.moves) m.res();
    v.moves.length = 0;
    if (v.idleWaiters) { const w = v.idleWaiters; v.idleWaiters = null; w.forEach(f => f()); }
    this.scene.remove(v.group);
    v.geo.dispose(); v.mat.dispose();
    if (v.bubble) v.bubble.remove();
    if (v.hp) v.hp.remove();
    this.list.delete(unit.uid);
  }
  get(unit) { return this.list.get(unit.uid); }
  // limpa tudo (novo jogo / carregar)
  dispose() {
    for (const v of [...this.list.values()]) this.remove(v.unit);
    for (const e of this.effects) this.scene.remove(e.obj);
    this.effects.length = 0;
    for (const m of this.bloodDecals || []) { this.scene.remove(m); m.geometry.dispose(); }
    this.bloodDecals = [];
    for (const f of this.floaters) f.el?.remove?.();
    this.floaters.length = 0;
    this.overlay.innerHTML = '';
  }

  // ------------------------------------------------------------ animação
  setAnim(v, anim, loop, done) {
    if (v.done && v.done !== done) { const d = v.done; v.done = null; d(); }
    v.anim = anim; v.loop = loop; v.t = 0; v.frame = -1; v.done = done || null;
    v.strip = null;
  }
  play(unit, anim, opts = {}) {
    const v = this.get(unit);
    if (!v) return Promise.resolve();
    bus.emit('anim', unit, anim, v.hidden);
    return new Promise(res => this.setAnim(v, anim, false, () => { res(); }));
  }
  loop(unit, anim) { const v = this.get(unit); if (v && v.anim !== anim) this.setAnim(v, anim, true); }
  baseAnim(unit) {
    if (unit.dead) return 'dead';
    if (unit.st && unit.st.hidden) return 'crouch';
    if (unit.st && unit.st.aiming) return 'aim';
    if (unit.st && unit.st.scared) return 'scared';
    return 'idle';
  }
  // move para uma célula (retorna quando chega)
  moveTo(unit, x, z, speed = 3.2, anim = 'walk') {
    const v = this.get(unit);
    if (!v) return Promise.resolve();
    return new Promise(res => { v.moves.push({ x: x + 0.5, z: z + 0.5, speed, anim, res }); });
  }
  // resolve quando a unidade terminar de andar
  whenIdle(unit) {
    const v = this.get(unit);
    if (!v || !v.moves.length) return Promise.resolve();
    return new Promise(res => { (v.idleWaiters ||= []).push(res); });
  }
  snap(unit) {
    const v = this.get(unit);
    if (!v) return;
    v.pos.set(unit.x + 0.5, 0, unit.z + 0.5); v.group.position.copy(v.pos);
    // quem estava esperando esses passos não pode ficar pendurado
    if (v.moves.length) {
      const ms = v.moves.splice(0);
      for (const m of ms) m.res();
      this.setAnim(v, this.baseAnim(unit), true);
    }
    if (v.idleWaiters) { const w = v.idleWaiters; v.idleWaiters = null; w.forEach(f => f()); }
  }
  flash(unit, color = '#ffffff', amount = 1) { const v = this.get(unit); if (v) { v.flash = amount; v.uni.flashColor.value.set(color); } }
  face(unit, tx, tz) { unit.face = Math.atan2(tx - unit.x, tz - unit.z); }

  // direção da tira conforme a câmera
  dirFor(v) {
    const f = v.unit.face ?? 0;
    const fx = Math.sin(f), fz = Math.cos(f);
    const cy = this.camYaw;
    const cdx = Math.sin(cy), cdz = Math.cos(cy);
    const rx = Math.cos(cy), rz = -Math.sin(cy);
    const th = Math.atan2(fx * rx + fz * rz, fx * cdx + fz * cdz);
    return ((Math.round(th / (Math.PI / 4)) % 8) + 8) % 8;
  }

  update(dt, lightFn, visibleFn) {
    for (const v of this.list.values()) {
      const u = v.unit;
      // movimento
      if (v.moves.length) {
        const m = v.moves[0];
        const dx = m.x - v.pos.x, dz = m.z - v.pos.z;
        const d = Math.hypot(dx, dz);
        if (v.anim !== m.anim) this.setAnim(v, m.anim, true);
        const step = m.speed * dt;
        if (d <= step) {
          v.pos.set(m.x, 0, m.z); v.moves.shift(); m.res();
          if (!v.moves.length) {
            this.setAnim(v, this.baseAnim(u), true);
            if (v.idleWaiters) { const w = v.idleWaiters; v.idleWaiters = null; w.forEach(f => f()); }
          }
        } else { v.pos.x += dx / d * step; v.pos.z += dz / d * step; u.face = Math.atan2(dx, dz); }
      }
      v.group.position.copy(v.pos);
      // quadro
      const A = ANIMS[v.anim] || ANIMS.idle;
      v.t += dt;
      let f = Math.floor(v.t * A.fps);
      if (f >= A.frames) {
        if (v.loop) f = f % A.frames;
        else {
          f = A.frames - 1;
          if (v.done) { const d = v.done; v.done = null; d(); }
          if (v.anim === 'die') { this.setAnim(v, 'dead', true); f = 0; }
          else if (v.t * A.fps > A.frames + 0.2 && !v.moves.length) { this.setAnim(v, this.baseAnim(u), true); f = 0; }
        }
      }
      const dir = v.anim === 'dead' || v.anim === 'die' ? (v.deadDir ?? (v.deadDir = this.dirFor(v))) : this.dirFor(v);
      const hold = u.holdClass ? u.holdClass() : 'none';
      if (!v.strip || v.dir !== dir || v.hold !== hold || v.stripAnim !== v.anim) {
        v.strip = getStrip(v.look.id, v.anim, dir, hold);
        if (!v.strip.tex) {
          v.strip.tex = new THREE.CanvasTexture(v.strip.canvas);
          v.strip.tex.colorSpace = THREE.SRGBColorSpace;
          v.strip.tex.magFilter = THREE.LinearFilter; v.strip.tex.minFilter = THREE.LinearFilter; v.strip.tex.generateMipmaps = false;
        }
        v.uni.map.value = v.strip.tex;
        v.dir = dir; v.hold = hold; v.stripAnim = v.anim; v.frame = -1;
      }
      if (f !== v.frame) {
        v.frame = f;
        if ((v.anim === 'walk' || v.anim === 'run') && (f === 0 || f * 2 === A.frames) && v.group.visible) bus.emit('step', u, v.anim);
        const n = v.strip.frames;
        const uv = v.geo.attributes.uv;
        const u0 = f / n, u1 = (f + 1) / n;
        uv.setXY(0, u0, 1); uv.setXY(1, u1, 1); uv.setXY(2, u0, 0); uv.setXY(3, u1, 0);
        uv.needsUpdate = true;
      }
      // encarar a câmera
      v.mesh.rotation.y = this.camYaw;
      if (v.xray) v.xray.rotation.y = this.camYaw;
      // luz e visibilidade
      const vis = u.kind === 'hero' || visibleFn(u);
      v.group.visible = vis && !u.gone;
      if (vis) {
        const L = lightFn(v.pos.x, v.pos.z);
        v.uni.tint.value.setRGB(L[0], L[1], L[2]);
      }
      if (v.flash > 0) { v.flash = Math.max(0, v.flash - dt * 5); }
      v.uni.flash.value = v.flash;
      v.uni.alpha.value = v.alpha;
      if (v.ring) {
        v.ring.visible = !u.dead && !u.gone;
        const sel = u.selected;
        v.ring.material.opacity = sel ? 0.75 + Math.sin(performance.now() / 180) * 0.25 : 0.35;
        v.ring.scale.setScalar(sel ? 1.1 : 0.85);
      }
      v.shadow.visible = v.anim !== 'dead';
      if (v.xray) v.xray.visible = !u.dead;
    }
    // efeitos
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      if (e.update(e, dt)) { this.scene.remove(e.obj); this.effects.splice(i, 1); }
    }
    this.updateOverlay();
  }

  // ------------------------------------------------------------ efeitos
  blood(x, z, size = 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.bloodMat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6.28;
    m.position.set(x + 0.5 + (Math.random() - 0.5) * 0.4, 0.018 + Math.random() * 0.004, z + 0.5 + (Math.random() - 0.5) * 0.4);
    const s = (0.7 + Math.random() * 0.6) * size;
    m.scale.set(s, s, 1);
    this.scene.add(m);
    this.bloodDecals = (this.bloodDecals || []);
    this.bloodDecals.push(m);
    if (this.bloodDecals.length > 160) { const o = this.bloodDecals.shift(); this.scene.remove(o); o.geometry.dispose(); }
  }
  splash(x, y, z, color = '#b01818', n = 10) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel.push([(Math.random() - 0.5) * 3, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 3]); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.12, sizeAttenuation: true }));
    this.scene.add(pts);
    this.effects.push({ obj: pts, t: 0, update: (e, dt) => {
      const p = geo.attributes.position;
      for (let i = 0; i < n; i++) { vel[i][1] -= 9 * dt; p.setXYZ(i, p.getX(i) + vel[i][0] * dt, Math.max(0.02, p.getY(i) + vel[i][1] * dt), p.getZ(i) + vel[i][2] * dt); }
      p.needsUpdate = true;
      return e.t > 0.7;
    } });
  }
  tracer(ax, az, bx, bz, color = '#ffe07a') {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ax + 0.5, 1.1, az + 0.5), new THREE.Vector3(bx + 0.5, 1.0, bz + 0.5)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true }));
    this.scene.add(line);
    this.effects.push({ obj: line, t: 0, update: (e) => { line.material.opacity = 1 - e.t / 0.15; return e.t > 0.15; } });
  }
  projectile(ax, az, bx, bz, color = '#8a8a8a', arc = 1.5, time = 0.45) {
    return new Promise(res => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color }));
      this.scene.add(m);
      this.effects.push({ obj: m, t: 0, update: (e) => {
        const k = Math.min(1, e.t / time);
        m.position.set(ax + 0.5 + (bx - ax) * k, 1.1 + Math.sin(k * Math.PI) * arc, az + 0.5 + (bz - az) * k);
        if (k >= 1) { res(); return true; }
        return false;
      } });
    });
  }
  burst(x, z, color = '#ffb040', scale = 2.2) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.set(x + 0.5, 0.8, z + 0.5); s.scale.set(scale, scale, 1);
    this.scene.add(s);
    this.effects.push({ obj: s, t: 0, update: (e) => { s.material.opacity = 1 - e.t / 0.4; s.scale.setScalar(scale * (1 + e.t)); return e.t > 0.4; } });
  }

  // ------------------------------------------------------------ textos na tela
  screenPos(x, y, z) {
    this.v3.set(x, y, z).project(this.camera);
    const r = this.overlay.getBoundingClientRect();
    return [(this.v3.x + 1) / 2 * r.width, (1 - this.v3.y) / 2 * r.height, this.v3.z];
  }
  floatText(x, z, text, cls = '') {
    const el = document.createElement('div');
    el.className = 'floater ' + cls;
    el.textContent = text;
    this.overlay.appendChild(el);
    this.floaters.push({ el, x: x + 0.5, z: z + 0.5, t: 0, life: 1.3 });
  }
  say(unit, text, time = 3.2) {
    const v = this.get(unit);
    if (!v) return;
    if (!v.bubble) { v.bubble = document.createElement('div'); v.bubble.className = 'bubble'; this.overlay.appendChild(v.bubble); }
    v.bubble.textContent = text;
    v.bubble.style.display = 'block';
    v.bubbleT = time + text.length * 0.035;
  }
  setHp(unit, show) {
    const v = this.get(unit);
    if (!v) return;
    if (show && !v.hp) { v.hp = document.createElement('div'); v.hp.className = 'hpbar'; v.hp.innerHTML = '<i></i>'; this.overlay.appendChild(v.hp); }
    if (!show && v.hp) { v.hp.remove(); v.hp = null; }
  }
  updateOverlay() {
    const now = performance.now();
    const dt = this._last ? (now - this._last) / 1000 : 0.016;
    this._last = now;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      const [sx, sy] = this.screenPos(f.x, 2.0 + f.t * 0.8, f.z);
      f.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
      f.el.style.opacity = String(Math.min(1, 2.5 * (1 - f.t / f.life)));
      if (f.t > f.life) { f.el.remove(); this.floaters.splice(i, 1); }
    }
    for (const v of this.list.values()) {
      const topY = (v.look.scale || 1) * 2.25;
      if (v.bubble) {
        v.bubbleT -= dt;
        if (v.bubbleT <= 0 || !v.group.visible) v.bubble.style.display = 'none';
        else { const [sx, sy] = this.screenPos(v.pos.x, topY + 0.35, v.pos.z); v.bubble.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`; }
      }
      if (v.hp) {
        const u = v.unit;
        if (!v.group.visible || u.dead) v.hp.style.display = 'none';
        else {
          v.hp.style.display = 'block';
          const [sx, sy] = this.screenPos(v.pos.x, topY, v.pos.z);
          v.hp.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
          v.hp.firstChild.style.width = Math.max(0, u.hp / u.maxHp * 100) + '%';
          v.hp.classList.toggle('ally', u.faction !== 'zombie' && u.faction !== 'hostile');
        }
      }
    }
  }
}
