// Renderizador, luzes, neblina, ciclo de dia e noite e câmera 2,5D.
import * as THREE from '../../lib/three.module.min.js';
import { clamp, lerp, damp } from './util.js';
import { setAnisotropy } from './textures.js';

export const QUALITY = {
  alta: { name: 'Alta', pixel: 2, shadow: 2048, aa: true, grass: 1 },
  media: { name: 'Média', pixel: 1.25, shadow: 1024, aa: true, grass: 0.7 },
  baixa: { name: 'Baixa', pixel: 0.85, shadow: 512, aa: false, grass: 0.35 },
};

export class Renderer {
  constructor(canvas, quality = 'alta') {
    this.canvas = canvas;
    this.q = QUALITY[quality] || QUALITY.alta;
    this.qualityName = quality;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: this.q.aa, powerPreference: 'high-performance' });
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixel));
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.r.toneMappingExposure = 1.05;
    this.r.shadowMap.enabled = true;
    this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    setAnisotropy(Math.min(8, this.r.capabilities.getMaxAnisotropy()));
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#b8b4a4', 35, 95);
    this.scene.background = new THREE.Color('#b8b4a4');
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 260);
    // luzes
    this.hemi = new THREE.HemisphereLight('#dfe6ff', '#6a5a44', 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d8', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.q.shadow, this.q.shadow);
    const S = 30;
    Object.assign(this.sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 140 });
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    // lanterna do jogador à noite
    this.lamp = new THREE.PointLight('#ffd9a0', 0, 13, 1.6);
    this.scene.add(this.lamp);
    // câmera
    this.cam = { x: 0, z: 0, tx: 0, tz: 0, zoom: 1, tzoom: 1, shake: 0, height: 18.5, back: 15 };
    this.time = 0.35;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }
  setQuality(name) {
    this.q = QUALITY[name] || QUALITY.alta; this.qualityName = name;
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixel));
    this.sun.shadow.mapSize.set(this.q.shadow, this.q.shadow);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.resize();
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h;
    // telas em pé: afasta um pouco para caber mais mundo
    this.camera.fov = w < h ? 50 : 36;
    this.camera.updateProjectionMatrix();
  }
  // câmera segue o alvo suavemente
  follow(x, z, dt, snap = false) {
    const c = this.cam;
    c.tx = x; c.tz = z;
    if (snap) { c.x = x; c.z = z; }
    c.x = damp(c.x, c.tx, 5, dt); c.z = damp(c.z, c.tz, 5, dt);
    c.zoom = damp(c.zoom, c.tzoom, 6, dt);
    let sx = 0, sz = 0;
    if (c.shake > 0) { c.shake = Math.max(0, c.shake - dt * 2.5); sx = (Math.random() - 0.5) * c.shake; sz = (Math.random() - 0.5) * c.shake; }
    this.camera.position.set(c.x + sx, c.height * c.zoom, c.z + c.back * c.zoom + sz);
    this.camera.lookAt(c.x + sx, 0.6, c.z + sz + 0.6);
    // sombra do sol acompanha a câmera
    const sd = this.sunDir || new THREE.Vector3(-0.45, 1, 0.35).normalize();
    this.sun.position.set(c.x + sd.x * 60, sd.y * 60, c.z + sd.z * 60);
    this.sun.target.position.set(c.x, 0, c.z);
  }
  shake(k) { this.cam.shake = Math.max(this.cam.shake, k); }
  // hora do dia: 0..1 (0 = meia-noite, 0.5 = meio-dia)
  setTime(t, danger = 0) {
    this.time = t;
    const ang = (t - 0.25) * Math.PI * 2; // nasce às 6h, põe às 18h
    const elev = Math.sin(ang);
    const day = clamp(elev * 2.2 + 0.25, 0, 1);
    const dusk = clamp(1 - Math.abs(elev) * 3.5, 0, 1) * (elev > -0.3 ? 1 : 0);
    // direção do sol (à noite vira a lua, vinda do outro lado)
    const az = t * Math.PI * 2;
    const dir = elev > -0.05 ? new THREE.Vector3(Math.cos(az) * 0.7, Math.max(0.35, elev + 0.3), 0.45) : new THREE.Vector3(0.4, 0.9, -0.3);
    this.sunDir = dir.normalize();
    const sunCol = new THREE.Color('#fff2dc').lerp(new THREE.Color('#ff9a50'), dusk * 0.7);
    const moonCol = new THREE.Color('#8aa4d8');
    this.sun.color.copy(day > 0.02 ? sunCol : moonCol);
    this.sun.intensity = day > 0.02 ? lerp(0.5, 2.7, day) : 0.55;
    this.hemi.intensity = lerp(0.42, 1.15, day);
    this.hemi.color.set(day > 0.3 ? '#dfe6ff' : '#6a7ab0');
    this.hemi.groundColor.set(day > 0.3 ? '#6a5a44' : '#20242e');
    // neblina: amarelada de dia, azulada à noite, avermelhada ao entardecer; mais densa em áreas perigosas
    const fogDay = new THREE.Color('#c2bca8'), fogNight = new THREE.Color('#1c2230'), fogDusk = new THREE.Color('#c08a68');
    const fc = fogNight.clone().lerp(fogDay, day).lerp(fogDusk, dusk * 0.5);
    fc.lerp(new THREE.Color('#8a8a78'), danger * 0.15);
    this.scene.fog.color.copy(fc); this.scene.background.copy(fc);
    this.scene.fog.near = lerp(28, 38, day) - danger * 6; this.scene.fog.far = lerp(70, 100, day) - danger * 10;
    this.r.toneMappingExposure = lerp(0.95, 1.05, day);
    this.night = 1 - day;
    this.lamp.intensity = this.night > 0.35 ? (this.night - 0.35) * 55 : 0;
  }
  render() { this.r.render(this.scene, this.camera); }
  // posição na tela (px) de um ponto do mundo
  toScreen(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, behind: p.z > 1 };
  }
}
