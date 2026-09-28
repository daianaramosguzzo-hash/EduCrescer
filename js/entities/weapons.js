// Modelos das armas e ferramentas na mão. Tudo é montado no "espaço da mão":
// com o braço pendurado, -Y aponta para o chão e +Z para a frente do personagem.
import * as THREE from '../../lib/three.module.min.js';

const M = {};
function mat(key, color, opts = {}) {
  return (M[key] ||= new THREE.MeshStandardMaterial({ color, roughness: opts.r ?? 0.7, metalness: opts.m ?? 0, flatShading: !!opts.flat }));
}
const wood = () => mat('wood', '#8a5a34', { r: 0.8 });
const darkWood = () => mat('dwood', '#5a3a22', { r: 0.8 });
const steel = () => mat('steel', '#b9bec4', { r: 0.35, m: 0.8 });
const darkMetal = () => mat('dmetal', '#2d2f33', { r: 0.45, m: 0.6 });
const rust = () => mat('rust', '#7a5040', { r: 0.7, m: 0.4 });
const stone = () => mat('stone', '#8b8680', { r: 0.9, flat: true });
const cloth = () => mat('cloth', '#3a2e24', { r: 0.95 });
const string = () => mat('string', '#d8d0c0', { r: 0.9 });

function box(w, h, d, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; }
function cyl(r1, r2, h, m, x = 0, y = 0, z = 0, seg = 8) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); o.castShadow = true; return o; }

// armas de mão: cabo ao longo de +Y a partir da empunhadura (0,0,0)
const MELEE = {
  faca() { const g = new THREE.Group(); g.add(cyl(0.018, 0.018, 0.11, darkWood(), 0, 0.0, 0)); const b = box(0.012, 0.17, 0.035, steel(), 0, 0.14, 0.005); g.add(b); g.add(box(0.05, 0.012, 0.045, darkMetal(), 0, 0.058, 0)); return g; },
  taco() { const g = new THREE.Group(); g.add(cyl(0.022, 0.02, 0.2, cloth(), 0, 0.02, 0)); g.add(cyl(0.045, 0.024, 0.62, wood(), 0, 0.42, 0)); return g; },
  taco_prego() {
    const g = MELEE.taco();
    for (let i = 0; i < 10; i++) { const a = i * 2.1, y = 0.45 + (i % 5) * 0.06; const n = cyl(0.004, 0.004, 0.1, steel(), Math.cos(a) * 0.05, y, Math.sin(a) * 0.05, 4); n.rotation.z = Math.PI / 2; n.rotation.y = -a; g.add(n); }
    return g;
  },
  cano() { const g = new THREE.Group(); g.add(cyl(0.025, 0.025, 0.2, cloth(), 0, 0.02, 0)); g.add(cyl(0.022, 0.022, 0.75, rust(), 0, 0.4, 0)); g.add(cyl(0.03, 0.03, 0.05, darkMetal(), 0, 0.77, 0)); return g; },
  facao() { const g = new THREE.Group(); g.add(cyl(0.02, 0.022, 0.13, darkWood(), 0, 0.0, 0)); const b = box(0.01, 0.5, 0.06, steel(), 0, 0.32, 0.01); g.add(b); const tip = box(0.01, 0.06, 0.04, steel(), 0, 0.59, 0.02); tip.rotation.x = 0.5; g.add(tip); return g; },
  lanca() { const g = new THREE.Group(); g.add(cyl(0.02, 0.02, 1.8, wood(), 0, 0.35, 0)); g.add(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 5), stone())); g.children[1].position.y = 1.33; g.add(cyl(0.024, 0.024, 0.08, string(), 0, 1.22, 0)); return g; },
  lanca_ferro() { const g = new THREE.Group(); g.add(cyl(0.02, 0.02, 1.8, darkWood(), 0, 0.35, 0)); const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.26, 4), steel()); c.position.y = 1.37; g.add(c); g.add(cyl(0.025, 0.025, 0.08, darkMetal(), 0, 1.23, 0)); return g; },
  machado_pedra() { const g = new THREE.Group(); g.add(cyl(0.02, 0.022, 0.62, wood(), 0, 0.26, 0)); const h = box(0.05, 0.1, 0.17, stone(), 0, 0.52, 0.06); h.rotation.x = 0.1; g.add(h); g.add(cyl(0.026, 0.026, 0.06, string(), 0, 0.52, 0)); return g; },
  machado() { const g = new THREE.Group(); g.add(cyl(0.02, 0.022, 0.65, wood(), 0, 0.27, 0)); const h = box(0.03, 0.08, 0.1, darkMetal(), 0, 0.55, 0.03); g.add(h); const e = box(0.02, 0.17, 0.08, steel(), 0, 0.55, 0.11); g.add(e); return g; },
  picareta_pedra() { const g = new THREE.Group(); g.add(cyl(0.02, 0.022, 0.62, wood(), 0, 0.26, 0)); const h = box(0.05, 0.06, 0.42, stone(), 0, 0.54, 0); g.add(h); g.add(cyl(0.026, 0.026, 0.06, string(), 0, 0.54, 0)); return g; },
  picareta() { const g = new THREE.Group(); g.add(cyl(0.02, 0.022, 0.65, wood(), 0, 0.27, 0)); const h = box(0.035, 0.05, 0.5, darkMetal(), 0, 0.57, 0); g.add(h); for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.1, 4), steel()); t.rotation.x = s * Math.PI / 2; t.position.set(0, 0.57, s * 0.29); g.add(t); } return g; },
};

// armas de fogo: cano ao longo de -Y da mão, parte de cima para +Z
const GUNS = {
  pistola() {
    const g = new THREE.Group();
    g.add(box(0.035, 0.2, 0.045, darkMetal(), 0, -0.07, 0.07));
    const grip = box(0.032, 0.05, 0.11, mat('grip', '#1b1b1d', { r: 0.9 }), 0, 0.0, 0.02); grip.rotation.x = -0.25; g.add(grip);
    return g;
  },
  espingarda() {
    const g = new THREE.Group();
    g.add(cyl(0.022, 0.022, 0.7, darkMetal(), 0, -0.45, 0.07));
    g.add(cyl(0.022, 0.022, 0.55, darkMetal(), 0.0, -0.38, 0.03));
    g.add(box(0.05, 0.35, 0.07, darkWood(), 0, 0.12, 0.03));
    const stock = box(0.045, 0.3, 0.1, darkWood(), 0, 0.38, -0.02); stock.rotation.x = 0.15; g.add(stock);
    return g;
  },
  rifle() {
    const g = new THREE.Group();
    g.add(cyl(0.015, 0.015, 0.75, darkMetal(), 0, -0.5, 0.06));
    g.add(box(0.045, 0.45, 0.06, wood(), 0, -0.05, 0.04));
    g.add(cyl(0.022, 0.022, 0.2, darkMetal(), 0, -0.1, 0.12)); // luneta
    const stock = box(0.045, 0.32, 0.11, wood(), 0, 0.33, -0.01); stock.rotation.x = 0.12; g.add(stock);
    return g;
  },
};

// arco: vai na mão esquerda, na vertical (cordas ao longo de Z com o braço esticado)
function bow() {
  const g = new THREE.Group();
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, -0.55), new THREE.Vector3(0, -0.28, 0), new THREE.Vector3(0, 0, 0.55));
  const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.014, 5), wood());
  limb.castShadow = true; g.add(limb);
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1.1, 3), string()); s.rotation.x = Math.PI / 2; g.add(s);
  g.position.y = -0.05;
  return g;
}

// devolve { right, left } (objetos para prender nas mãos) e o estilo de pose
export function makeWeapon(itemDef) {
  if (!itemDef || !itemDef.model) return { right: null, left: null, style: 'none' };
  const id = itemDef.model;
  if (id === 'arco') return { right: null, left: bow(), style: 'bow' };
  if (GUNS[id]) {
    const g = GUNS[id]();
    return { right: g, left: null, style: id === 'pistola' ? 'pistol' : 'rifle' };
  }
  const f = MELEE[id];
  if (!f) return { right: null, left: null, style: 'none' };
  const inner = f();
  const g = new THREE.Group();
  g.add(inner);
  // cabo para frente e um pouco para baixo com o braço pendurado
  const long = ['lanca', 'lanca_ferro'].includes(id);
  inner.rotation.x = long ? Math.PI / 2 : (id === 'faca' ? 1.7 : 2.0);
  if (long) inner.position.y = 0;
  inner.position.y -= 0.05;
  return { right: g, left: null, style: 'melee' };
}

// objeto genérico na mão ao comer/beber
export function makeHandProp(kind) {
  const g = new THREE.Group();
  if (kind === 'drink') { const b = cyl(0.03, 0.03, 0.18, mat('bottle', '#6fa8c8', { r: 0.2 }), 0, -0.06, 0.03); g.add(b); }
  else if (kind === 'eat') { g.add(cyl(0.035, 0.035, 0.07, mat('can', '#b8322a', { r: 0.4, m: 0.5 }), 0, -0.06, 0.03)); }
  else if (kind === 'heal') { g.add(box(0.08, 0.04, 0.05, mat('band', '#eee8dc'), 0, -0.05, 0.02)); }
  else if (kind === 'hammer') { g.add(cyl(0.015, 0.015, 0.28, wood(), 0, 0.1, 0)); g.add(box(0.03, 0.04, 0.1, darkMetal(), 0, 0.24, 0.02)); g.rotation.x = 1.9; }
  return g;
}
