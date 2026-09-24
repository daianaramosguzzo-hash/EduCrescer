// Cena 3D: renderizador, câmera isométrica (zoom, rotação em 90°, seguir), luzes do dia e da
// noite (postes, fogo, lanternas), realces de células e seleção por clique.
import * as THREE from '../../../lib/three.module.min.js';
import { Fow } from './fow.js';
import { WorldView } from './worldmesh.js';
import { UnitView } from './unitview.js';
import { clamp, lerp } from '../util.js';

export const PITCH = 35 * Math.PI / 180;
const VIEW = 20;

export class Scene3D {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#07060b');
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    this.overlay = overlay;
    this.target = new THREE.Vector3(10, 0, 10);
    this.targetGoal = this.target.clone();
    this.yaw = Math.PI / 4; this.yawGoal = this.yaw;
    this.zoom = 1.25; this.zoomGoal = this.zoom;
    this.shake = 0;
    // luzes
    this.hemi = new THREE.HemisphereLight('#dff0ff', '#6a7a4a', 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff4e0', 2.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 140;
    this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.points = [];
    for (let i = 0; i < 8; i++) { const p = new THREE.PointLight('#ffd89a', 0, 8, 1.4); p.position.set(0, -50, 0); this.scene.add(p); this.points.push(p); }
    this.spots = [];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.SpotLight('#fff2cc', 0, 11, 0.55, 0.55, 1.1);
      s.position.set(0, -50, 0); this.scene.add(s); this.scene.add(s.target); this.spots.push(s);
    }
    this.env = { night: 0, ambient: [1, 1, 1] };
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hl = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setMap(map) {
    if (this.world) { this.scene.remove(this.world.root); }
    this.map = map;
    this.fow = new Fow(map.W, map.H);
    this.world = new WorldView(this.scene, map, this.fow);
    this.world.build();
    if (this.units) for (const v of [...this.units.list.values()]) this.units.remove(v.unit);
    this.units = new UnitView(this.scene, this.camera, this.overlay);
    this.buildHighlights();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    this.updateCamera(0);
  }

  // ------------------------------------------------------------ câmera
  focus(x, z, instant = false) {
    this.targetGoal.set(x, 0, z);
    if (instant) this.target.copy(this.targetGoal);
  }
  pan(dx, dz) {
    // movimento relativo à tela
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this.targetGoal.x += dx * c + dz * s;
    this.targetGoal.z += -dx * s + dz * c;
    this.clampTarget();
  }
  clampTarget() { if (!this.map) return; this.targetGoal.x = clamp(this.targetGoal.x, 0, this.map.W); this.targetGoal.z = clamp(this.targetGoal.z, 0, this.map.H); }
  rotate(dir) { this.yawGoal += dir * Math.PI / 2; }
  zoomBy(f) { this.zoomGoal = clamp(this.zoomGoal * f, 0.55, 2.8); }
  updateCamera(dt) {
    const k = dt ? Math.min(1, dt * 6) : 1;
    this.target.lerp(this.targetGoal, k);
    this.yaw = lerp(this.yaw, this.yawGoal, dt ? Math.min(1, dt * 7) : 1);
    this.zoom = lerp(this.zoom, this.zoomGoal, dt ? Math.min(1, dt * 8) : 1);
    const D = 90;
    const off = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(this.yaw) * Math.cos(PITCH)).multiplyScalar(D);
    const shake = this.shake > 0 ? this.shake : 0;
    this.camera.position.copy(this.target).add(off);
    if (shake) { this.camera.position.x += (Math.random() - 0.5) * shake; this.camera.position.y += (Math.random() - 0.5) * shake; this.shake = Math.max(0, this.shake - dt * 1.5); }
    this.camera.lookAt(this.target.x, this.target.y + 0.8, this.target.z);
    const halfH = VIEW / 2 / this.zoom;
    this.camera.top = halfH; this.camera.bottom = -halfH;
    this.camera.left = -halfH * this.aspect; this.camera.right = halfH * this.aspect;
    this.camera.updateProjectionMatrix();
    if (this.units) this.units.camYaw = this.yaw;
  }

  // ------------------------------------------------------------ dia e noite
  // minutos do dia → luzes do ambiente
  setTime(min, weather = {}) {
    const h = (min / 60) % 24;
    const P = [
      [0, '#0e1430', 0.08, '#1a2448', '#0a0c18', 0.22, '#7a8ad8', 0.25, 1],
      [4.8, '#0e1430', 0.08, '#1a2448', '#0a0c18', 0.22, '#7a8ad8', 0.25, 1],
      [5.8, '#f08a5a', 0.9, '#f0b890', '#4a3a3a', 0.55, '#ffb070', 0.9, 0.45],
      [7.0, '#fff0d8', 1.8, '#e0f0ff', '#6a7a4a', 1.0, '#fff0d8', 1.8, 0],
      [12, '#fffaf0', 2.2, '#e6f4ff', '#7a8a5a', 1.1, '#fffaf0', 2.2, 0],
      [16.5, '#ffe8c0', 1.9, '#e0ecff', '#7a7a5a', 1.0, '#ffe8c0', 1.9, 0],
      [17.8, '#ff9a4a', 1.2, '#f0a878', '#5a3a3a', 0.7, '#ff9a4a', 1.2, 0.3],
      [18.8, '#a04a6a', 0.35, '#5a3a6a', '#2a1a2a', 0.35, '#c06a8a', 0.4, 0.75],
      [19.6, '#0e1430', 0.08, '#1a2448', '#0a0c18', 0.22, '#7a8ad8', 0.25, 1],
      [24, '#0e1430', 0.08, '#1a2448', '#0a0c18', 0.22, '#7a8ad8', 0.25, 1],
    ];
    let a = P[0], b = P[1];
    for (let i = 0; i < P.length - 1; i++) if (h >= P[i][0] && h <= P[i + 1][0]) { a = P[i]; b = P[i + 1]; break; }
    const t = (h - a[0]) / Math.max(0.001, b[0] - a[0]);
    const mixC = (c1, c2) => new THREE.Color(c1).lerp(new THREE.Color(c2), t);
    const sunCol = mixC(a[1], b[1]);
    const rain = weather.chuva ? 0.55 : 1;
    this.sun.color.copy(sunCol);
    this.sun.intensity = lerp(a[2], b[2], t) * rain;
    this.hemi.color.copy(mixC(a[3], b[3]));
    this.hemi.groundColor.copy(mixC(a[4], b[4]));
    this.hemi.intensity = lerp(a[5], b[5], t) * (weather.chuva ? 0.8 : 1);
    const night = lerp(a[8], b[8], t);
    this.env.night = night;
    // direção do sol/lua
    const dayT = clamp((h - 6) / 12, 0, 1);
    const ang = night > 0.5 ? 0.9 : Math.PI * (0.15 + dayT * 0.7);
    this.sunDir = new THREE.Vector3(Math.cos(ang) * 0.7, Math.sin(ang) * 0.9 + 0.35, 0.45).normalize();
    // luz ambiente aproximada para os sprites
    const sp = mixC(a[6], b[6]);
    const k = lerp(a[7], b[7], t) * rain;
    const amb = 0.38 + 0.62 * Math.min(1, k / 1.8);
    this.env.ambient = [clamp(sp.r * 0.35 + amb * 0.75, 0.16, 1.1), clamp(sp.g * 0.35 + amb * 0.75, 0.16, 1.1), clamp(sp.b * 0.35 + amb * 0.75, 0.24, 1.1)];
    if (night > 0.6) this.env.ambient = [0.22, 0.25, 0.42];
    this.renderer.toneMappingExposure = 1;
  }
  // luzes dinâmicas: fontes = [{x, z, color, i, r, kind}], lanternas = [{x, z, dirX, dirZ}]
  setLights(sources, flashlights, focusX, focusZ) {
    const sorted = sources.filter(s => s.on !== false).map(s => ({ s, d: Math.hypot(s.x - focusX, s.z - focusZ) })).sort((a, b) => a.d - b.d);
    this.activePoints = [];
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const e = sorted[i];
      if (e && e.d < 30 && this.env.night > 0.15) {
        const s = e.s;
        p.color.set(s.color); p.distance = s.r * 1.4;
        const fl = s.flicker ? (Math.sin(performance.now() / 43 + s.x) > -0.7 ? 1 : 0.15) : s.kind === 'fogo' ? 0.8 + Math.random() * 0.4 : 1;
        p.intensity = s.i * 5.5 * this.env.night * fl;
        p.position.set(s.x, s.kind === 'poste' ? 4.1 : 1.4, s.z + (s.kind === 'poste' ? 0.4 : 0));
        this.activePoints.push({ x: s.x, z: s.z, r: s.r, i: s.i * this.env.night * fl, c: p.color });
      } else { p.intensity = 0; p.position.y = -50; }
    }
    this.activeSpots = [];
    for (let i = 0; i < this.spots.length; i++) {
      const s = this.spots[i];
      const f = flashlights[i];
      if (f && this.env.night > 0.1) {
        s.intensity = 18 * Math.max(0.4, this.env.night);
        s.position.set(f.x + 0.5, 1.45, f.z + 0.5);
        s.target.position.set(f.x + 0.5 + f.dirX * 6, 0, f.z + 0.5 + f.dirZ * 6);
        this.activeSpots.push(f);
      } else { s.intensity = 0; s.position.y = -50; }
    }
  }
  // luz (rgb) sobre um ponto, para colorir os sprites
  lightAt(x, z) {
    const a = this.env.ambient;
    let r = a[0], g = a[1], b = a[2];
    for (const p of this.activePoints || []) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < p.r) { const k = (1 - d / p.r) * p.i * 1.2; r += p.c.r * k; g += p.c.g * k; b += p.c.b * k; }
    }
    for (const f of this.activeSpots || []) {
      const dx = x - (f.x + 0.5), dz = z - (f.z + 0.5);
      const d = Math.hypot(dx, dz);
      if (d < 9 && d > 0.2) {
        const cos = (dx * f.dirX + dz * f.dirZ) / d;
        if (cos > 0.8) { const k = (1 - d / 9) * 0.9 * this.env.night; r += k; g += k * 0.95; b += k * 0.8; }
      } else if (d <= 0.2) { r += 0.35 * this.env.night; g += 0.33 * this.env.night; b += 0.3 * this.env.night; }
    }
    return [Math.min(r, 1.25), Math.min(g, 1.25), Math.min(b, 1.25)];
  }

  // ------------------------------------------------------------ realces (alcance, caminho, cursor)
  buildHighlights() {
    const max = 900;
    const geo = new THREE.PlaneGeometry(0.92, 0.92);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.28, depthWrite: false });
    this.range = new THREE.InstancedMesh(geo, mat, max);
    this.range.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.range.count = 0; this.range.renderOrder = 2; this.range.frustumCulled = false;
    this.scene.add(this.range);
    const dotGeo = new THREE.CircleGeometry(0.13, 12); dotGeo.rotateX(-Math.PI / 2);
    this.dots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false }), 120);
    this.dots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(120 * 3), 3);
    this.dots.count = 0; this.dots.renderOrder = 3; this.dots.frustumCulled = false;
    this.scene.add(this.dots);
    const cur = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.02, 1));
    this.cursor = new THREE.LineSegments(cur, new THREE.LineBasicMaterial({ color: '#ffffff' }));
    this.cursor.visible = false;
    this.scene.add(this.cursor);
    this.targetRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 30), new THREE.MeshBasicMaterial({ color: '#ff4040', transparent: true, depthWrite: false }));
    this.targetRing.rotation.x = -Math.PI / 2; this.targetRing.visible = false;
    this.scene.add(this.targetRing);
    this.aoe = new THREE.Mesh(new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff7a1e', transparent: true, opacity: 0.3, depthWrite: false }));
    this.aoe.visible = false; this.scene.add(this.aoe);
  }
  showRange(cells) { // [{x, z, color}]
    const m = new THREE.Matrix4(), c = new THREE.Color();
    const n = Math.min(cells.length, this.range.instanceMatrix.count);
    for (let i = 0; i < n; i++) {
      const e = cells[i];
      m.makeTranslation(e.x + 0.5, 0.03, e.z + 0.5);
      this.range.setMatrixAt(i, m);
      this.range.setColorAt(i, c.set(e.color));
    }
    this.range.count = n;
    this.range.instanceMatrix.needsUpdate = true;
    if (this.range.instanceColor) this.range.instanceColor.needsUpdate = true;
  }
  showPath(cells) {
    const m = new THREE.Matrix4(), c = new THREE.Color();
    const n = Math.min(cells.length, 120);
    for (let i = 0; i < n; i++) {
      const e = cells[i];
      m.makeTranslation(e.x + 0.5, 0.05, e.z + 0.5);
      this.dots.setMatrixAt(i, m);
      this.dots.setColorAt(i, c.set(e.color));
    }
    this.dots.count = n;
    this.dots.instanceMatrix.needsUpdate = true;
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
  }
  showCursor(x, z, color = '#ffffff', h = 0) {
    if (x === null) { this.cursor.visible = false; return; }
    this.cursor.visible = true;
    this.cursor.position.set(x + 0.5, 0.04 + h, z + 0.5);
    this.cursor.material.color.set(color);
  }
  showTarget(x, z, color = '#ff4040') {
    if (x === null) { this.targetRing.visible = false; return; }
    this.targetRing.visible = true; this.targetRing.position.set(x + 0.5, 0.05, z + 0.5);
    this.targetRing.material.color.set(color);
  }
  showAoe(x, z, r = 1) {
    if (x === null) { this.aoe.visible = false; return; }
    this.aoe.visible = true; this.aoe.position.set(x + 0.5, 0.06, z + 0.5); this.aoe.scale.setScalar((r * 2 + 1) / 3);
  }

  // ------------------------------------------------------------ seleção por clique
  // devolve a célula que o jogador vê sob o cursor (considerando paredes e objetos altos)
  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const ray = this.raycaster.ray;
    // unidades primeiro
    let unitHit = null;
    if (this.units) {
      const meshes = [];
      for (const v of this.units.list.values()) if (v.group.visible && !v.unit.dead) meshes.push(v.mesh);
      const hits = this.raycaster.intersectObjects(meshes, false);
      for (const h of hits) {
        const v = [...this.units.list.values()].find(v => v.mesh === h.object);
        if (!v) continue;
        // confere o alfa do sprite (clicou no desenho e não no vazio)
        if (h.uv && v.strip) {
          const c = v.strip.canvas; const ctx = c.getContext('2d', { willReadFrequently: true });
          const px = Math.floor((v.frame + h.uv.x) * v.strip.fw), py = Math.floor((1 - h.uv.y) * v.strip.fh);
          try { if (ctx.getImageData(px, py, 1, 1).data[3] < 40) continue; } catch (_) {}
        }
        unitHit = v.unit; break;
      }
    }
    let cell = null;
    if (this.world) {
      for (const hgt of [2.3, 1.8, 1.3, 0.8, 0.4]) {
        if (Math.abs(ray.direction.y) < 1e-4) break;
        const t = (hgt - ray.origin.y) / ray.direction.y;
        const p = ray.origin.clone().addScaledVector(ray.direction, t);
        const x = Math.floor(p.x), z = Math.floor(p.z);
        if (this.world.heightAt(x, z) >= hgt - 0.05) { cell = { x, z, h: hgt }; break; }
      }
      if (!cell) {
        const t = -ray.origin.y / ray.direction.y;
        const p = ray.origin.clone().addScaledVector(ray.direction, t);
        cell = { x: Math.floor(p.x), z: Math.floor(p.z), h: 0 };
      }
    }
    return { unit: unitHit, cell };
  }

  render(dt) {
    this.updateCamera(dt);
    // sol acompanha a câmera
    if (this.sunDir) {
      this.sun.position.copy(this.target).addScaledVector(this.sunDir, 60);
      this.sun.target.position.copy(this.target);
      const snap = 1;
      this.sun.position.x = Math.round(this.sun.position.x / snap) * snap; this.sun.target.position.x = Math.round(this.sun.target.position.x / snap) * snap;
    }
    if (this.fow) this.fow.update(dt);
    if (this.world) this.world.update(dt, this.env.night);
    this.renderer.render(this.scene, this.camera);
  }
}
