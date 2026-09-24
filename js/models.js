// Modelos 3D procedurais (estilo cartoon) para humanos e Crescemon.
import * as THREE from '../lib/three.module.min.js';

// ---------- materiais toon ----------
const gradient = (() => {
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

export const GRADIENT = gradient;

const matCache = new Map();
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...stripOpts(opts) });
  if (!opts.unique) matCache.set(key, m);
  return m;
}
function stripOpts(o) { const r = { ...o }; delete r.unique; return r; }

const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x1a1410, side: THREE.BackSide });

const geo = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  sphereLow: new THREE.SphereGeometry(1, 12, 8),
  hemi: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  cone: new THREE.ConeGeometry(1, 1, 12),
  box: new THREE.BoxGeometry(1, 1, 1),
  torus: new THREE.TorusGeometry(1, 0.28, 8, 20),
  dodeca: new THREE.DodecahedronGeometry(1, 0),
};

function mesh(g, mat, pos, scale, rot) {
  const m = new THREE.Mesh(g, mat);
  if (pos) m.position.set(...pos);
  if (scale !== undefined) {
    if (typeof scale === 'number') m.scale.setScalar(scale); else m.scale.set(...scale);
  }
  if (rot) m.rotation.set(...rot);
  m.castShadow = true;
  return m;
}

// Contorno "inverted hull" para visual de desenho animado
export function addOutline(root, thickness = 0.018) {
  const list = [];
  root.traverse(o => { if (o.isMesh && !o.userData.noOutline && o.material !== OUTLINE_MAT) list.push(o); });
  for (const o of list) {
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const ws = new THREE.Vector3();
    o.updateWorldMatrix(true, false);
    o.getWorldScale(ws);
    const minS = Math.min(ws.x, ws.y, ws.z) * o.geometry.boundingSphere.radius;
    const f = 1 + Math.min(0.25, thickness / Math.max(0.01, minS));
    const ol = new THREE.Mesh(o.geometry, OUTLINE_MAT);
    ol.scale.setScalar(f);
    ol.userData.noOutline = true;
    o.add(ol);
  }
}

// Texto em textura (logo da camiseta, placas)
export function textTexture(lines, opts = {}) {
  const w = opts.w || 256, h = opts.h || 128;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = opts.bg || '#9a9a9a';
  g.fillRect(0, 0, w, h);
  if (opts.draw) opts.draw(g, w, h);
  g.fillStyle = opts.fg || '#333';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const arr = Array.isArray(lines) ? lines : [lines];
  arr.forEach((ln, i) => {
    g.font = `bold ${opts.size || 40}px sans-serif`;
    g.fillText(ln, w / 2 + (opts.dx || 0), h / 2 + (i - (arr.length - 1) / 2) * (opts.size || 40) * 1.1 + (opts.dy || 0));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- HUMANOS ----------
export function makeHuman(o = {}) {
  const opt = {
    skin: '#f6c9a0', hair: '#3b2415', hairStyle: 'short', shirt: '#6a8ac8', pants: '#3a3a5a',
    shorts: false, shoes: '#6a4a3a', socks: null, sockStripe: null, jacket: null, lining: null,
    coat: false, dress: null, hat: null, logo: null, scale: 1, ...o,
  };
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = toon(opt.skin);
  const hairM = toon(opt.hair);

  // pernas
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.095, 0.45, 0);
    const shoe = mesh(geo.sphere, toon(opt.shoes), [0, -0.4, 0.035], [0.085, 0.06, 0.13]);
    const sole = mesh(geo.sphere, toon('#8a8a8a'), [0, -0.425, 0.035], [0.088, 0.03, 0.132]);
    leg.add(sole, shoe);
    if (opt.shorts) {
      if (opt.socks) {
        leg.add(mesh(geo.cyl, toon(opt.socks), [0, -0.3, 0], [0.052, 0.14, 0.052]));
        if (opt.sockStripe) {
          const st = toon(opt.sockStripe);
          leg.add(mesh(geo.cyl, st, [0, -0.25, 0], [0.054, 0.018, 0.054]));
          leg.add(mesh(geo.cyl, st, [0, -0.285, 0], [0.054, 0.018, 0.054]));
        }
      }
      leg.add(mesh(geo.cyl, skin, [0, -0.17, 0], [0.047, 0.16, 0.047]));
      leg.add(mesh(geo.cyl, toon(opt.pants), [0, -0.04, 0], [0.085, 0.2, 0.085]));
    } else if (!opt.dress) {
      leg.add(mesh(geo.cyl, toon(opt.pants), [0, -0.18, 0], [0.06, 0.4, 0.06]));
    } else {
      leg.add(mesh(geo.cyl, skin, [0, -0.2, 0], [0.045, 0.36, 0.045]));
    }
    body.add(leg);
    legs.push(leg);
  }

  // quadril e tronco
  if (opt.dress) {
    body.add(mesh(geo.cone, toon(opt.dress), [0, 0.5, 0], [0.26, 0.38, 0.2]));
  } else {
    body.add(mesh(geo.box, toon(opt.pants), [0, 0.48, 0], [0.34, 0.12, 0.22]));
  }
  let torsoMat = toon(opt.dress || opt.shirt);
  if (opt.logo) {
    const tex = textTexture([opt.logo], {
      bg: opt.shirt, fg: '#3a3a3a', size: 34, dy: -10, w: 256, h: 256,
      draw: (g) => {
        // pequeno emblema laranja de "sol nascente"
        g.fillStyle = '#e8743a';
        g.beginPath(); g.arc(78, 150, 26, Math.PI, 0); g.fill();
        g.fillRect(52, 156, 52, 6); g.fillRect(56, 166, 44, 5); g.fillRect(62, 175, 32, 4);
      },
    });
    const logoMat = new THREE.MeshToonMaterial({ map: tex, gradientMap: gradient });
    torsoMat = [torsoMat, torsoMat, torsoMat, torsoMat, logoMat, torsoMat];
  }
  const torso = mesh(geo.box, torsoMat, [0, 0.71, 0], [0.36, 0.38, 0.22]);
  body.add(torso);

  if (opt.jacket || opt.coat) {
    const jc = toon(opt.coat ? '#f4f4f0' : opt.jacket);
    const ln = toon(opt.coat ? '#e0e0dc' : (opt.lining || opt.jacket));
    const len = opt.coat ? 0.62 : 0.43;
    const cy = 0.9 - len / 2;
    for (const side of [-1, 1]) {
      body.add(mesh(geo.box, jc, [side * 0.135, cy, 0.005], [0.12, len, 0.25]));
      body.add(mesh(geo.box, ln, [side * 0.078, cy, 0.128], [0.022, len, 0.012]));
    }
    body.add(mesh(geo.box, jc, [0, cy, -0.115], [0.38, len, 0.04]));
    // capuz / gola
    const hood = mesh(geo.torus, jc, [0, 0.93, -0.05], [0.14, 0.11, 0.2], [Math.PI / 2 + 0.25, 0, 0]);
    body.add(hood);
    if (!opt.coat) body.add(mesh(geo.torus, ln, [0, 0.935, -0.02], [0.12, 0.09, 0.12], [Math.PI / 2 + 0.25, 0, 0]));
  }

  // braços
  const arms = [];
  const sleeve = toon(opt.coat ? '#f4f4f0' : (opt.jacket || opt.dress || opt.shirt));
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.235, 0.87, 0);
    arm.add(mesh(geo.sphere, sleeve, [0, -0.02, 0], 0.07));
    arm.add(mesh(geo.cyl, sleeve, [0, -0.17, 0], [0.058, 0.32, 0.058]));
    if (opt.lining && opt.jacket) arm.add(mesh(geo.cyl, toon(opt.lining), [0, -0.33, 0], [0.06, 0.03, 0.06]));
    arm.add(mesh(geo.sphere, skin, [0, -0.38, 0], 0.052));
    arm.rotation.z = side * 0.08;
    body.add(arm);
    arms.push(arm);
  }

  // cabeça
  const head = new THREE.Group();
  head.position.set(0, 1.12, 0);
  body.add(mesh(geo.cyl, skin, [0, 0.95, 0], [0.06, 0.1, 0.06]));
  head.add(mesh(geo.sphere, skin, [0, 0, 0], [0.26, 0.25, 0.25]));
  head.add(mesh(geo.sphere, skin, [-0.25, -0.01, 0], [0.05, 0.065, 0.045]));
  head.add(mesh(geo.sphere, skin, [0.25, -0.01, 0], [0.05, 0.065, 0.045]));
  // olhos grandes de desenho
  const white = toon('#ffffff');
  const black = toon('#111111');
  for (const side of [-1, 1]) {
    const eye = mesh(geo.sphere, white, [side * 0.092, 0.025, 0.2], [0.085, 0.09, 0.06]);
    head.add(eye);
    const pupil = mesh(geo.sphere, black, [side * 0.088, 0.02, 0.258], [0.02, 0.022, 0.012]);
    pupil.userData.noOutline = true;
    head.add(pupil);
  }
  const nose = mesh(geo.sphere, toon(shade(opt.skin, -0.08)), [0, -0.04, 0.245], [0.022, 0.028, 0.02]);
  nose.userData.noOutline = true;
  head.add(nose);
  const smile = mesh(new THREE.TorusGeometry(0.055, 0.009, 6, 16, Math.PI), black, [0.01, -0.095, 0.225], 1, [0, 0, Math.PI]);
  smile.userData.noOutline = true;
  head.add(smile);

  buildHair(head, opt, hairM);
  if (opt.hat) {
    head.add(mesh(geo.hemi, toon(opt.hat), [0, 0.06, 0], [0.275, 0.24, 0.275]));
    head.add(mesh(geo.cyl, toon(opt.hat), [0, 0.07, 0.2], [0.17, 0.02, 0.14]));
  }
  body.add(head);

  root.scale.setScalar(opt.scale);
  addOutline(root, 0.012);

  let phase = 0;
  const api = {
    group: root, head, body,
    update(dt, moving, speed = 1) {
      if (moving) phase += dt * 11 * speed; else phase *= 0.8;
      const s = Math.sin(phase);
      const amp = moving ? 0.65 : 0;
      legs[0].rotation.x = s * amp;
      legs[1].rotation.x = -s * amp;
      arms[0].rotation.x = -s * amp * 0.9;
      arms[1].rotation.x = s * amp * 0.9;
      body.position.y = moving ? Math.abs(Math.cos(phase)) * 0.04 : 0;
    },
    pose(name) {
      if (name === 'throw') { arms[1].rotation.x = -2.6; }
      else if (name === 'fist') { arms[1].rotation.x = -1.2; arms[1].rotation.z = 0.9; }
      else { arms[0].rotation.set(0, 0, -0.08); arms[1].rotation.set(0, 0, 0.08); }
    },
  };
  return api;
}

function buildHair(head, opt, hairM) {
  const st = opt.hairStyle;
  if (st === 'bald') {
    head.add(mesh(geo.torus, hairM, [0, -0.02, -0.02], [0.24, 0.24, 0.3], [Math.PI / 2, 0, 0]));
    return;
  }
  const cap = mesh(geo.hemi, hairM, [0, 0.04, -0.02], [0.28, 0.27, 0.28], [-0.35, 0, 0]);
  head.add(cap);
  head.add(mesh(geo.sphere, hairM, [0, -0.02, -0.1], [0.25, 0.24, 0.2]));
  if (st === 'messy') {
    // franja
    const bangs = [[-0.14, 0.15, 0.17], [-0.05, 0.17, 0.2], [0.05, 0.17, 0.2], [0.14, 0.14, 0.17]];
    for (const [x, y, z] of bangs) head.add(mesh(geo.sphere, hairM, [x, y, z], [0.075, 0.07, 0.06]));
    // mechas bagunçadas
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 18; i++) {
      const th = rnd() * Math.PI * 2;
      const ph = 0.15 + rnd() * 1.25;
      const dir = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
      if (dir.z > 0.55 && dir.y < 0.6) continue;
      const cn = mesh(geo.cone, hairM, [0, 0, 0], [0.065, 0.16, 0.065]);
      cn.position.copy(dir.clone().multiplyScalar(0.25)).add(new THREE.Vector3(0, 0.03, -0.02));
      cn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      head.add(cn);
    }
  } else if (st === 'spiky') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 1.4 - Math.PI * 0.2;
      const dir = new THREE.Vector3(Math.cos(a) * 0.6, 0.75, -Math.sin(a) * 0.6 - 0.1).normalize();
      const cn = mesh(geo.cone, hairM, [0, 0, 0], [0.09, 0.26, 0.09]);
      cn.position.copy(dir.clone().multiplyScalar(0.24));
      cn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      head.add(cn);
    }
    head.add(mesh(geo.sphere, hairM, [0, 0.16, 0.16], [0.18, 0.07, 0.08]));
  } else if (st === 'long') {
    head.add(mesh(geo.box, hairM, [0, -0.2, -0.13], [0.46, 0.4, 0.14]));
    head.add(mesh(geo.sphere, hairM, [0, 0.16, 0.16], [0.2, 0.07, 0.08]));
  } else if (st === 'bun') {
    head.add(mesh(geo.sphere, hairM, [0, 0.26, -0.12], 0.1));
  } else {
    head.add(mesh(geo.sphere, hairM, [0, 0.16, 0.16], [0.19, 0.07, 0.08]));
  }
}

export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}

// ---------- PERSONAGENS DO JOGO ----------
export const HERO_LOOK = {
  skin: '#f4c7a1', hair: '#3a2314', hairStyle: 'messy', shirt: '#9c9c9c', logo: 'CRESCER',
  jacket: '#9b6231', lining: '#dcc38e', pants: '#1c1c1c', shorts: true, socks: '#f8f8f8',
  sockStripe: '#3a5a9a', shoes: '#f4f4f4',
};

export const LOOKS = {
  heroi: HERO_LOOK,
  mae: { hair: '#6a3a20', hairStyle: 'bun', dress: '#e87a8a', shoes: '#8a3a4a' },
  prof: { hair: '#d8d8d8', hairStyle: 'short', shirt: '#8a6a4a', coat: true, pants: '#5a4a3a', skin: '#e8b890' },
  rival: { hair: '#2a3a8a', hairStyle: 'spiky', shirt: '#6a3aa0', pants: '#2a2a3a', shoes: '#222' },
  lia: { hair: '#2a3a8a', hairStyle: 'long', dress: '#f0c040', shoes: '#886' },
  enfermeira: { hair: '#f08aa8', hairStyle: 'bun', dress: '#fafafa', hat: '#fafafa', shoes: '#f08aa8' },
  vendedor: { hair: '#3a2a1a', shirt: '#3a6ad0', pants: '#2a2a4a', hat: '#3a6ad0' },
  garoto: { hair: '#7a4a1a', hairStyle: 'spiky', shirt: '#e0a030', pants: '#3a5a8a', shorts: true, socks: '#fff' },
  garota: { hair: '#c86a2a', hairStyle: 'long', dress: '#7ad0a0', shoes: '#4a8a6a' },
  inseto: { hair: '#4a3a1a', shirt: '#9ad04a', pants: '#8a6a3a', shorts: true, hat: '#e0c040', socks: '#fff' },
  campista: { hair: '#2a1a0a', shirt: '#a0703a', pants: '#5a6a3a', hat: '#6a7a3a' },
  basalto: { hair: '#2a1a0a', hairStyle: 'spiky', shirt: '#8a7a6a', pants: '#5a4a3a', jacket: '#6a5a4a', skin: '#c8906a' },
  marina: { hair: '#f0a040', hairStyle: 'long', dress: '#3aa0e0', shoes: '#fff' },
  nadador: { hair: '#1a1a1a', shirt: '#f4c7a1', pants: '#2a6ad0', shorts: true, skin: '#e8a878' },
  sombra: { hair: '#1a1a1a', shirt: '#2a2a2a', pants: '#1a1a1a', hat: '#1a1a1a', logo: 'S', shoes: '#111' },
  breu: { hair: '#1a1a1a', shirt: '#3a1a4a', pants: '#1a1a1a', jacket: '#1a1a1a', lining: '#8a2a2a', shoes: '#111', skin: '#e0b090' },
  velho: { hair: '#bbbbbb', hairStyle: 'bald', shirt: '#7a8a5a', pants: '#6a5a4a', skin: '#e0a880' },
  guarda: { hair: '#1a1a1a', shirt: '#3a4a8a', pants: '#2a2a4a', hat: '#2a3a7a' },
  as: { hair: '#c02a2a', hairStyle: 'spiky', shirt: '#f0f0f0', pants: '#2a2a2a', jacket: '#c02a2a', lining: '#fff' },
  sombra2: { hair: '#1a1a1a', hairStyle: 'long', dress: '#2a2a2e', hat: '#1a1a1a', shoes: '#111' },
  nyx: { hair: '#8a3aff', hairStyle: 'long', dress: '#1a1028', shoes: '#3a1a5a', skin: '#f0d0c0' },
  grafite: { hair: '#1a1a1a', hairStyle: 'bald', shirt: '#4a4a4a', pants: '#2a2a2a', jacket: '#2a2a2a', lining: '#8a2a2a', skin: '#c8906a', scale: 1.15, shoes: '#111' },
  vulto: { hair: '#f0f0f0', hairStyle: 'spiky', shirt: '#2a2a3a', coat: true, pants: '#1a1a2a', shoes: '#111', skin: '#e0c0a8' },
  eclipse: { hair: '#f0e8ff', hairStyle: 'long', dress: '#3a0a5a', hat: '#1a0a2a', shoes: '#1a0a2a', skin: '#f4dcd0' },
};

// ---------- CRESCEMON ----------
export function makeCreature(spec) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const c1 = toon(spec.c1), c2 = toon(spec.c2 || '#ffffff');
  const c3 = toon(spec.c3 || shade(spec.c1, -0.2));
  const c4 = toon(spec.c4 || '#ffe060');
  const ex = new Set(spec.extras || []);
  const anim = { flames: [], wings: [], float: false, spin: null, tail: null };

  const eyes = (parent, x, y, z, r = 0.075, spread = 0.12) => {
    for (const side of [-1, 1]) {
      parent.add(mesh(geo.sphere, toon('#ffffff'), [x + side * spread, y, z], [r, r * 1.1, r * 0.7]));
      const p = mesh(geo.sphere, toon('#111'), [x + side * spread * 0.95, y + r * 0.1, z + r * 0.6], [r * 0.45, r * 0.55, r * 0.3]);
      p.userData.noOutline = true;
      parent.add(p);
      const sh = mesh(geo.sphere, toon('#ffffff'), [x + side * spread * 0.95 + 0.012, y + r * 0.35, z + r * 0.8], r * 0.15);
      sh.userData.noOutline = true;
      parent.add(sh);
    }
  };
  const flameOuter = new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.92 });
  const flameMid = new THREE.MeshBasicMaterial({ color: 0xff9a2a });
  const flameCore = new THREE.MeshBasicMaterial({ color: 0xffe25a });
  const flame = (parent, pos, s = 1) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    // chama em forma de gota: esfera + cone, em três camadas
    const layers = [[flameOuter, 0.1, 0.24, 0], [flameMid, 0.075, 0.18, 0.02], [flameCore, 0.045, 0.11, 0.04]];
    for (const [mat, r, h, dz] of layers) {
      const ball = mesh(geo.sphereLow, mat, [0, r * s, dz * s], r * s);
      const tip = mesh(geo.cone, mat, [0, (r + h / 2) * s, dz * s], [r * 0.95 * s, h * s, r * 0.95 * s]);
      for (const m of [ball, tip]) { m.userData.noOutline = true; m.castShadow = false; g.add(m); }
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const t = mesh(geo.cone, flameOuter, [Math.cos(a) * 0.06 * s, 0.16 * s, Math.sin(a) * 0.06 * s], [0.035 * s, 0.14 * s, 0.035 * s], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]);
      t.userData.noOutline = true; t.castShadow = false;
      g.add(t);
    }
    g.userData.seed = Math.random() * 10;
    parent.add(g);
    anim.flames.push(g);
    return g;
  };

  const plan = spec.plan;
  if (plan === 'quad') {
    const low = spec.low;
    const by = low ? 0.3 : spec.tall ? 0.62 : 0.42;
    inner.add(mesh(geo.sphere, c1, [0, by, 0], low ? [0.34, 0.24, 0.48] : [0.32, 0.3, 0.44]));
    inner.add(mesh(geo.sphere, c2, [0, by - 0.06, 0.08], low ? [0.27, 0.18, 0.38] : [0.25, 0.23, 0.34]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const lx = sx * (low ? 0.24 : 0.17), lz = sz * 0.24;
      inner.add(mesh(geo.cyl, c1, [lx, by / 2 - 0.02, lz], [0.07, by, 0.07], low ? [0, 0, sx * 0.6] : undefined));
      inner.add(mesh(geo.sphere, c2, [lx * (low ? 1.3 : 1), 0.04, lz + 0.03], [0.08, 0.05, 0.1]));
    }
    const head = new THREE.Group();
    head.position.set(0, low ? by + 0.14 : by + 0.3, low ? 0.46 : 0.38);
    inner.add(head);
    head.add(mesh(geo.sphere, c1, [0, 0, 0], low ? [0.3, 0.22, 0.24] : [0.26, 0.25, 0.24]));
    eyes(head, 0, 0.04, 0.19, low ? 0.06 : 0.07, low ? 0.15 : 0.11);
    if (ex.has('snout')) {
      head.add(mesh(geo.sphere, c2, [0, -0.07, 0.2], [0.11, 0.08, 0.13]));
      head.add(mesh(geo.sphere, toon('#222'), [0, -0.04, 0.32], 0.028));
    }
    if (ex.has('snoutBig')) {
      head.add(mesh(geo.sphere, toon(shade(spec.c1, -0.1)), [0, -0.06, 0.18], [0.17, 0.13, 0.15]));
      head.add(mesh(geo.sphere, toon('#2a1a10'), [0, 0, 0.32], [0.06, 0.03, 0.02]));
    }
    if (!ex.has('snout') && !ex.has('snoutBig')) {
      const sm = mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14, Math.PI), toon('#222'), [0, -0.06, 0.225], 1, [0, 0, Math.PI]);
      sm.userData.noOutline = true;
      head.add(sm);
    }
    if (ex.has('teeth')) head.add(mesh(geo.box, toon('#fff'), [0, -0.14, 0.25], [0.06, 0.06, 0.02]));
    if (ex.has('ears')) for (const s of [-1, 1]) {
      head.add(mesh(geo.cone, c1, [s * 0.14, 0.24, -0.02], [0.08, 0.2, 0.06], [0, 0, -s * 0.3]));
      head.add(mesh(geo.cone, c2, [s * 0.135, 0.22, 0.01], [0.045, 0.13, 0.03], [0, 0, -s * 0.3]));
    }
    if (ex.has('roundEars')) for (const s of [-1, 1]) head.add(mesh(geo.sphere, c1, [s * 0.18, 0.2, -0.05], [0.06, 0.06, 0.04]));
    if (ex.has('roundEarsBig')) for (const s of [-1, 1]) {
      head.add(mesh(geo.sphere, c1, [s * 0.2, 0.22, -0.02], [0.13, 0.13, 0.04]));
      head.add(mesh(geo.sphere, toon('#f4b0c0'), [s * 0.2, 0.22, 0.01], [0.09, 0.09, 0.03]));
    }
    if (ex.has('gills')) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const g = mesh(geo.cone, c3, [s * (0.28 + i * 0.01), 0.12 - i * 0.1, -0.05], [0.045, 0.2, 0.045]);
      g.rotation.z = -s * (0.9 + i * 0.35);
      head.add(g);
    }
    if (ex.has('sprout')) {
      head.add(mesh(geo.cyl, c3, [0, 0.3, 0], [0.02, 0.14, 0.02]));
      head.add(mesh(geo.sphere, c3, [-0.08, 0.38, 0], [0.1, 0.03, 0.05], [0, 0, 0.4]));
      head.add(mesh(geo.sphere, c3, [0.08, 0.38, 0], [0.1, 0.03, 0.05], [0, 0, -0.4]));
    }
    if (ex.has('horn')) head.add(mesh(geo.cone, toon('#f0e0c0'), [0, 0.27, 0.08], [0.05, 0.18, 0.05], [0.3, 0, 0]));
    if (ex.has('flameMane')) for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      flame(inner, [Math.cos(a) * 0.2, by + 0.22 + Math.sin(a) * 0.08, 0.25 + Math.sin(a) * 0.1], 0.7);
    }
    if (ex.has('leafBack')) for (let i = 0; i < 3; i++) {
      inner.add(mesh(geo.sphere, c3, [(i - 1) * 0.12, by + 0.3, -0.05 - i * 0.05], [0.07, 0.16, 0.03], [0.4, 0, (i - 1) * 0.5]));
    }
    if (ex.has('flowerBack')) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        inner.add(mesh(geo.sphere, c4, [Math.cos(a) * 0.17, by + 0.38, -0.05 + Math.sin(a) * 0.17], [0.12, 0.04, 0.08], [0, -a, 0]));
      }
      inner.add(mesh(geo.sphere, toon('#ffe040'), [0, by + 0.42, -0.05], [0.09, 0.06, 0.09]));
    }
    if (ex.has('shell')) {
      inner.add(mesh(geo.hemi, c3, [0, by + 0.02, -0.02], [0.35, 0.34, 0.47]));
      for (let i = -2; i <= 2; i++) inner.add(mesh(geo.torus, c1, [0, by + 0.02, i * 0.12], [0.32 - Math.abs(i) * 0.04, 0.32 - Math.abs(i) * 0.04, 0.12], [0, 0, 0]));
    }
    if (ex.has('spikes')) for (let i = 0; i < 4; i++) inner.add(mesh(geo.cone, toon('#fff0a0'), [0, by + 0.35, 0.15 - i * 0.14], [0.06, 0.16, 0.06], [-0.3, 0, 0]));
    if (ex.has('backFin')) inner.add(mesh(geo.cone, c3, [0, by + 0.26, -0.05], [0.03, 0.3, 0.25]));

    if (ex.has('antlers')) for (const sx of [-1, 1]) {
      const ant = toon(spec.c3);
      head.add(mesh(geo.cyl, ant, [sx * 0.15, 0.36, -0.02], [0.03, 0.36, 0.03], [0, 0, -sx * 0.45]));
      head.add(mesh(geo.cyl, ant, [sx * 0.3, 0.52, -0.02], [0.022, 0.26, 0.022], [0, 0, -sx * 1.05]));
      head.add(mesh(geo.cyl, ant, [sx * 0.22, 0.62, 0.02], [0.02, 0.22, 0.02], [0.25, 0, -sx * 0.2]));
      const fl = toon(spec.c4 || '#ffd23a', { emissive: spec.c4 || '#ffd23a', emissiveIntensity: 0.2 });
      for (const [fx, fy, fz, r] of [[0.42, 0.6, -0.02, 0.07], [0.25, 0.75, 0.04, 0.08], [0.33, 0.68, 0.06, 0.05], [0.14, 0.56, 0, 0.05], [0.47, 0.5, 0.02, 0.05]]) {
        head.add(mesh(geo.sphereLow, fl, [sx * fx, fy, fz], r));
      }
    }
    if (ex.has('spots')) for (let i = 0; i < 10; i++) {
      const a = i * 2.39, z = -0.34 + (i / 9) * 0.62;
      const k = Math.sqrt(Math.max(0.05, 1 - (z / 0.44) ** 2));
      const x = Math.cos(a) * 0.3 * k, y = by + Math.abs(Math.sin(a)) * 0.28 * k + 0.02;
      inner.add(mesh(geo.sphere, toon(spec.c3), [x, y, z], [0.055, 0.045, 0.055]));
    }
    if (ex.has('longSnout')) {
      head.add(mesh(geo.cyl, c1, [0, -0.08, 0.34], [0.055, 0.34, 0.055], [Math.PI / 2 - 0.25, 0, 0]));
      head.add(mesh(geo.sphere, toon('#222'), [0, -0.12, 0.5], 0.03));
    }
    if (ex.has('mane')) for (let i = 0; i < 5; i++) inner.add(mesh(geo.cone, toon(spec.c3), [0, by + 0.28 - i * 0.02, 0.25 - i * 0.1], [0.06, 0.2, 0.05], [-0.4, 0, 0]));
    if (ex.has('stripe')) inner.add(mesh(geo.sphere, toon(spec.c3), [0, by + 0.05, 0.05], [0.33, 0.1, 0.35], [0.5, 0, 0]));
    if (ex.has('mask')) for (const sx of [-1, 1]) head.add(mesh(geo.sphere, toon('#4a3a2a'), [sx * 0.11, 0.03, 0.17], [0.09, 0.06, 0.04]));
    if (ex.has('sparksBody')) {
      const y = new THREE.MeshBasicMaterial({ color: 0xfff080 });
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05;
        inner.add(mesh(geo.box, y, [Math.cos(a) * 0.42, by + 0.2 + Math.sin(i) * 0.12, Math.sin(a) * 0.5], [0.03, 0.16, 0.03], [0, a, 0.8]));
      }
    }

    // cauda
    const tail = new THREE.Group();
    tail.position.set(0, by + 0.05, -0.42);
    inner.add(tail);
    anim.tail = tail;
    if (ex.has('flameTail')) {
      tail.add(mesh(geo.cyl, c1, [0, 0.12, -0.05], [0.05, 0.3, 0.05], [-0.6, 0, 0]));
      tail.add(mesh(geo.sphere, c2, [0, 0.26, -0.13], 0.08));
      flame(tail, [0, 0.3, -0.14], 1.1);
    } else if (ex.has('finTail')) {
      tail.add(mesh(geo.sphere, c1, [0, 0.02, -0.18], [0.05, 0.16, 0.26]));
    } else if (ex.has('bushTail')) {
      tail.add(mesh(geo.sphere, c1, [0, 0.12, -0.2], [0.12, 0.13, 0.26], [-0.5, 0, 0]));
      tail.add(mesh(geo.sphere, c2, [0, 0.22, -0.4], [0.08, 0.08, 0.1]));
    } else if (ex.has('thinTail')) {
      tail.add(mesh(geo.cyl, toon('#f4b0c0'), [0, 0.1, -0.2], [0.02, 0.5, 0.02], [-1.0, 0, 0]));
    } else if (ex.has('sparkTail')) {
      const y = new THREE.MeshBasicMaterial({ color: 0xffe040 });
      for (let i = 0; i < 3; i++) {
        const b = mesh(geo.box, y, [(i % 2 ? 0.05 : -0.05), 0.08 + i * 0.1, -0.05 - i * 0.05], [0.04, 0.14, 0.04], [0, 0, i % 2 ? 0.8 : -0.8]);
        tail.add(b);
      }
    } else {
      tail.add(mesh(geo.sphere, c1, [0, 0.03, -0.05], 0.09));
    }
  } else if (plan === 'bird' || plan === 'bat') {
    const bat = plan === 'bat';
    anim.float = bat;
    const by = bat ? 0.75 : 0.45;
    inner.add(mesh(geo.sphere, c1, [0, by, 0], [0.26, 0.3, 0.26]));
    inner.add(mesh(geo.sphere, c2, [0, by - 0.05, 0.08], [0.2, 0.23, 0.2]));
    const head = new THREE.Group();
    head.position.set(0, by + 0.32, 0.06);
    inner.add(head);
    head.add(mesh(geo.sphere, c1, [0, 0, 0], 0.2));
    eyes(head, 0, 0.03, 0.15, 0.06, 0.085);
    if (!bat) {
      if (ex.has('bigBeak')) {
        head.add(mesh(geo.cone, c3, [0, -0.04, 0.34], [0.1, 0.34, 0.1], [Math.PI / 2 + 0.12, 0, 0]));
        head.add(mesh(geo.cone, toon(spec.c4 || '#ffd23a'), [0, 0.0, 0.2], [0.09, 0.08, 0.09], [Math.PI / 2, 0, 0]));
      } else if (ex.has('longBeak')) {
        head.add(mesh(geo.cone, c3, [0, -0.03, 0.36], [0.022, 0.36, 0.022], [Math.PI / 2, 0, 0]));
      } else head.add(mesh(geo.cone, c3, [0, -0.04, 0.25], [0.05, 0.14, 0.05], [Math.PI / 2, 0, 0]));
      if (ex.has('crest')) for (let i = 0; i < 3; i++) head.add(mesh(geo.cone, c3, [0, 0.2, -0.04 - i * 0.07], [0.04, 0.18, 0.04], [-0.4 - i * 0.3, 0, 0]));
    } else {
      for (const s of [-1, 1]) {
        head.add(mesh(geo.cone, c1, [s * 0.12, 0.2, 0], [0.08, 0.22, 0.05], [0, 0, -s * 0.3]));
        head.add(mesh(geo.cone, toon('#fff'), [s * 0.04, -0.1, 0.16], [0.015, 0.05, 0.015], [Math.PI, 0, 0]));
      }
    }
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(s * 0.22, by + 0.1, 0);
      if (bat) {
        w.add(mesh(geo.cone, c1, [s * 0.3, 0, 0], [0.18, 0.55, 0.02], [0, 0, s * Math.PI / 2]));
        w.add(mesh(geo.cone, c2, [s * 0.28, -0.05, 0.005], [0.12, 0.45, 0.015], [0, 0, s * Math.PI / 2]));
      } else {
        w.add(mesh(geo.sphere, c1, [s * 0.1, -0.05, -0.02], [0.09, 0.22, 0.2], [0, 0, s * 0.3]));
        if (ex.has('flameWings')) {
          w.children[0].scale.set(0.12, 0.4, 0.3);
          w.children[0].position.x = s * 0.3;
          w.children[0].rotation.z = s * 1.2;
          for (let i = 0; i < 3; i++) flame(w, [s * (0.2 + i * 0.18), 0.05 + i * 0.05, -0.05], 1.1);
        }
      }
      inner.add(w);
      anim.wings.push({ g: w, side: s });
    }
    if (!bat) {
      const tl = ex.has('longTail') ? 0.6 : 0.25;
      for (let i = -1; i <= 1; i++) inner.add(mesh(geo.cone, i === 0 && spec.c4 ? toon(spec.c4) : c3, [i * 0.07, by - 0.05 - tl * 0.2, -0.3 - tl * 0.35], [0.05, tl, 0.03], [-1.9, i * 0.3, 0]));
      if (ex.has('flameTail')) flame(inner, [0, by, -0.4], 1.6);
      for (const s of [-1, 1]) inner.add(mesh(geo.cyl, toon('#e0a030'), [s * 0.08, 0.12, 0.02], [0.02, 0.24, 0.02]));
    }
  } else if (plan === 'fish') {
    anim.float = true;
    const by = 0.55;
    inner.add(mesh(geo.sphere, c1, [0, by, 0], [0.22, 0.3, 0.45]));
    inner.add(mesh(geo.sphere, c2, [0, by - 0.08, 0.05], [0.18, 0.2, 0.36]));
    inner.add(mesh(geo.cone, c3, [0, by, -0.52], [0.04, 0.28, 0.25], [Math.PI / 2, 0, 0]));
    inner.add(mesh(geo.cone, c3, [0, by + 0.3, -0.05], [0.03, 0.22, 0.2]));
    for (const s of [-1, 1]) inner.add(mesh(geo.cone, c3, [s * 0.2, by - 0.1, 0.1], [0.02, 0.15, 0.1], [0, 0, s * 2.2]));
    eyes(inner, 0, by + 0.08, 0.38, 0.07, 0.12);
    if (ex.has('whiskers')) for (const s of [-1, 1]) inner.add(mesh(geo.cyl, c3, [s * 0.12, by - 0.12, 0.45], [0.012, 0.3, 0.012], [0.3, 0, s * 1.1]));
    anim.tail = inner.children[2];
  } else if (plan === 'star') {
    anim.float = true;
    const star = new THREE.Group();
    star.position.set(0, 0.6, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const arm = mesh(geo.cone, c1, [Math.sin(a) * 0.22, Math.cos(a) * 0.22, 0], [0.13, 0.36, 0.08]);
      arm.rotation.z = -a;
      star.add(arm);
    }
    star.add(mesh(geo.sphere, c1, [0, 0, 0], [0.2, 0.2, 0.1]));
    const gem = mesh(geo.sphere, toon(spec.c2, { emissive: spec.c2, emissiveIntensity: 0.4 }), [0, -0.03, 0.08], [0.09, 0.09, 0.05]);
    star.add(gem);
    eyes(star, 0, 0.1, 0.08, 0.045, 0.06);
    inner.add(star);
    anim.spin = star;
  } else if (plan === 'crab') {
    const by = 0.3;
    inner.add(mesh(geo.sphere, c1, [0, by, 0], [0.34, 0.18, 0.26]));
    inner.add(mesh(geo.sphere, c2, [0, by - 0.06, 0.02], [0.3, 0.12, 0.23]));
    for (const s of [-1, 1]) {
      inner.add(mesh(geo.cyl, c1, [s * 0.1, by + 0.2, 0.15], [0.025, 0.2, 0.025]));
      inner.add(mesh(geo.sphere, toon('#fff'), [s * 0.1, by + 0.32, 0.15], 0.06));
      const p = mesh(geo.sphere, toon('#111'), [s * 0.1, by + 0.33, 0.2], 0.025);
      p.userData.noOutline = true;
      inner.add(p);
      const claw = new THREE.Group();
      claw.position.set(s * 0.42, by + 0.12, 0.2);
      claw.add(mesh(geo.sphere, c1, [0, 0, 0], [0.14, 0.12, 0.12]));
      claw.add(mesh(geo.cone, c1, [0, 0.12, 0.08], [0.05, 0.16, 0.05], [0.6, 0, 0]));
      claw.add(mesh(geo.cone, c1, [0, -0.06, 0.12], [0.04, 0.12, 0.04], [1.9, 0, 0]));
      inner.add(claw);
      anim.wings.push({ g: claw, side: s, claw: true });
      for (let i = 0; i < 3; i++) inner.add(mesh(geo.cyl, c1, [s * 0.35, by - 0.12, -0.12 + i * 0.1], [0.025, 0.25, 0.025], [0, 0, s * 1.0]));
    }
  } else if (plan === 'ghost') {
    anim.float = true;
    const gm = toon(spec.c1, { transparent: true, opacity: 0.9 });
    inner.add(mesh(geo.sphere, gm, [0, 0.8, 0], [0.34, 0.32, 0.32]));
    inner.add(mesh(geo.cone, gm, [0, 0.45, -0.1], [0.3, 0.5, 0.26], [Math.PI + 0.35, 0, 0]));
    for (const s of [-1, 1]) inner.add(mesh(geo.sphere, gm, [s * 0.34, 0.7, 0.05], [0.1, 0.07, 0.07]));
    for (const s of [-1, 1]) {
      inner.add(mesh(geo.sphere, toon(spec.c2), [s * 0.12, 0.88, 0.26], [0.1, 0.13, 0.06]));
      const p = mesh(geo.sphere, toon('#111'), [s * 0.11, 0.86, 0.31], [0.04, 0.06, 0.02]);
      p.userData.noOutline = true;
      inner.add(p);
    }
    inner.add(mesh(geo.sphere, toon('#2a0a2a'), [0, 0.7, 0.29], [0.1, 0.06, 0.03]));
    if (ex.has('tentacles')) {
      const tm = toon(spec.c2, { transparent: true, opacity: 0.85 });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        inner.add(mesh(geo.cyl, tm, [Math.cos(a) * 0.2, 0.38, Math.sin(a) * 0.2], [0.025, 0.45, 0.025], [Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2]));
      }
    }
    if (ex.has('cap')) {
      inner.add(mesh(geo.cone, toon('#e02a2a'), [0, 1.18, -0.05], [0.2, 0.42, 0.2], [-0.35, 0, 0.1]));
      inner.add(mesh(geo.sphere, toon('#e02a2a'), [0, 1.05, 0], [0.26, 0.08, 0.26]));
    }
    if (ex.has('whirl')) for (let i = 0; i < 3; i++) {
      const w = mesh(geo.torus, toon('#c8d8e8', { transparent: true, opacity: 0.6 }), [0, 0.18 + i * 0.12, -0.05], [0.28 - i * 0.07, 0.28 - i * 0.07, 0.12], [Math.PI / 2, 0, 0]);
      w.userData.noOutline = true;
      inner.add(w);
      anim.whirls = anim.whirls || [];
      anim.whirls.push(w);
    }
    if (ex.has('crown')) for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      inner.add(mesh(geo.cone, toon('#f0c030'), [Math.cos(a) * 0.15, 1.15, Math.sin(a) * 0.15], [0.05, 0.16, 0.05]));
    }
  } else if (plan === 'worm') {
    for (let i = 0; i < 4; i++) {
      const r = 0.17 - i * 0.02;
      inner.add(mesh(geo.sphere, c1, [0, r, -i * 0.24], r));
      inner.add(mesh(geo.sphere, toon(spec.c2), [0, r * 1.8, -i * 0.24], [0.05, 0.03, 0.05]));
    }
    const head = mesh(geo.sphere, c1, [0, 0.28, 0.22], 0.2);
    inner.add(head);
    eyes(inner, 0, 0.32, 0.38, 0.055, 0.08);
    for (const s of [-1, 1]) {
      inner.add(mesh(geo.cyl, toon('#5a3a1a'), [s * 0.07, 0.52, 0.22], [0.012, 0.16, 0.012], [0, 0, -s * 0.3]));
      inner.add(mesh(geo.sphere, toon(spec.c2), [s * 0.1, 0.6, 0.22], 0.03));
    }
    anim.tail = inner;
  } else if (plan === 'cocoon') {
    inner.add(mesh(geo.sphere, c1, [0, 0.45, 0], [0.24, 0.45, 0.24]));
    for (let i = 0; i < 3; i++) inner.add(mesh(geo.torus, toon(spec.c2), [0, 0.25 + i * 0.18, 0], [0.22 - Math.abs(i - 1) * 0.02, 0.22 - Math.abs(i - 1) * 0.02, 0.1], [Math.PI / 2, 0, 0]));
    for (const s of [-1, 1]) {
      const e = mesh(geo.box, toon('#111'), [s * 0.08, 0.62, 0.2], [0.08, 0.02, 0.02]);
      e.userData.noOutline = true;
      inner.add(e);
    }
  } else if (plan === 'butterfly') {
    anim.float = true;
    const by = 0.8;
    inner.add(mesh(geo.sphere, toon('#3a2a5a'), [0, by, 0], [0.08, 0.25, 0.08]));
    const head = mesh(geo.sphere, toon('#3a2a5a'), [0, by + 0.3, 0.02], 0.12);
    inner.add(head);
    eyes(inner, 0, by + 0.32, 0.11, 0.05, 0.06);
    for (const s of [-1, 1]) {
      inner.add(mesh(geo.cyl, toon('#3a2a5a'), [s * 0.06, by + 0.48, 0.02], [0.01, 0.18, 0.01], [0, 0, -s * 0.4]));
      const w = new THREE.Group();
      w.position.set(s * 0.05, by + 0.05, -0.05);
      const wm = toon(spec.c1, { side: THREE.DoubleSide });
      w.add(mesh(geo.sphere, wm, [s * 0.3, 0.15, 0], [0.3, 0.25, 0.02], [0, 0, s * 0.3]));
      w.add(mesh(geo.sphere, wm, [s * 0.22, -0.18, 0], [0.2, 0.16, 0.02], [0, 0, -s * 0.4]));
      w.add(mesh(geo.sphere, toon(spec.c2), [s * 0.32, 0.18, 0.02], [0.1, 0.08, 0.01]));
      w.add(mesh(geo.sphere, toon(spec.c3), [s * 0.45, 0.28, 0.02], [0.06, 0.05, 0.01]));
      inner.add(w);
      anim.wings.push({ g: w, side: s, butterfly: true });
    }
    if (ex.has('glow')) {
      const gl = mesh(geo.sphere, new THREE.MeshBasicMaterial({ color: spec.c2 || '#fff4a0' }), [0, by - 0.25, -0.04], [0.09, 0.12, 0.09]);
      inner.add(gl);
      anim.glow = gl;
    }
  } else if (plan === 'beetle') {
    inner.add(mesh(geo.hemi, c1, [0, 0.1, -0.02], [0.32, 0.3, 0.36]));
    const dark = toon(spec.c2);
    inner.add(mesh(geo.box, dark, [0, 0.25, -0.02], [0.015, 0.25, 0.7], [0, 0, 0]));
    const spots = [[0.14, 0.3, 0.1], [-0.14, 0.3, 0.1], [0.18, 0.22, -0.15], [-0.18, 0.22, -0.15], [0.08, 0.36, -0.1], [-0.08, 0.36, -0.1]];
    for (const p of spots) inner.add(mesh(geo.sphere, dark, p, [0.05, 0.03, 0.05]));
    inner.add(mesh(geo.sphere, dark, [0, 0.18, 0.34], [0.17, 0.14, 0.12]));
    eyes(inner, 0, 0.2, 0.44, 0.05, 0.075);
    for (const s of [-1, 1]) {
      inner.add(mesh(geo.cyl, dark, [s * 0.07, 0.36, 0.38], [0.012, 0.16, 0.012], [0.4, 0, -s * 0.4]));
      for (let i = 0; i < 3; i++) inner.add(mesh(geo.cyl, dark, [s * 0.3, 0.05, -0.12 + i * 0.14], [0.018, 0.16, 0.018], [0, 0, s * 1.1]));
    }
  } else if (plan === 'rock') {
    const rm = toon(spec.c1);
    inner.add(mesh(geo.dodeca, rm, [0, 0.42, 0], [0.4, 0.38, 0.36]));
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(s * 0.45, 0.4, 0.05);
      arm.add(mesh(geo.dodeca, rm, [0, 0, 0], 0.16));
      arm.add(mesh(geo.dodeca, rm, [s * 0.08, -0.15, 0.05], 0.12));
      inner.add(arm);
      anim.wings.push({ g: arm, side: s, claw: true });
    }
    inner.add(mesh(geo.sphere, toon('#fff'), [0, 0.5, 0.31], [0.13, 0.12, 0.06]));
    const p = mesh(geo.sphere, toon('#111'), [0, 0.5, 0.36], [0.05, 0.06, 0.02]);
    p.userData.noOutline = true;
    inner.add(p);
    inner.add(mesh(geo.box, toon(spec.c2), [0, 0.66, 0.3], [0.26, 0.05, 0.05], [0.2, 0, 0]));
    if (ex.has('moss')) inner.add(mesh(geo.sphere, toon('#5c9a3a'), [0, 0.72, -0.05], [0.3, 0.1, 0.26]));
    if (ex.has('flameTop')) flame(inner, [0, 0.74, -0.05], 1.4);
    if (ex.has('lava')) for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      const l = mesh(geo.box, new THREE.MeshBasicMaterial({ color: 0xff6a1a }), [Math.cos(a) * 0.36, 0.3 + (i % 3) * 0.12, Math.sin(a) * 0.3], [0.04, 0.2, 0.03], [0, a, 0.5]);
      l.userData.noOutline = true;
      inner.add(l);
    }
  } else if (plan === 'serpent') {
    const segs = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const r = 0.16 - i * 0.011;
      const seg = mesh(geo.sphere, c1, [Math.sin(i * 0.9) * 0.16, r, 0.28 - i * 0.12], [r, r, r * 1.25]);
      seg.userData.i = i;
      inner.add(seg);
      segs.push(seg);
      if (ex.has('bands') && i % 2 === 1) {
        const b = mesh(geo.sphere, toon(spec.c3), [0, 0, 0], [1.03, 0.5, 0.45]);
        b.position.y = 0.1;
        seg.add(b);
      }
      if (ex.has('glowSpots') && i % 2 === 0) {
        const gs = mesh(geo.sphere, new THREE.MeshBasicMaterial({ color: spec.c4 || '#8af0ff' }), [0, 0.9, 0], 0.22);
        gs.userData.noOutline = true;
        seg.add(gs);
      }
      if (ex.has('fins') && i % 2 === 0 && i < 8) seg.add(mesh(geo.cone, c3, [0, 1.1, 0], [0.18, 0.9, 0.5]));
      if (ex.has('sparks') && i % 3 === 1) {
        const sp = mesh(geo.box, new THREE.MeshBasicMaterial({ color: 0xfff060 }), [0.9, 0.6, 0], [0.15, 0.7, 0.15], [0, 0, 0.8]);
        sp.userData.noOutline = true;
        seg.add(sp);
      }
    }
    inner.add(mesh(geo.sphere, c1, [0, 0.36, 0.36], [0.13, 0.14, 0.13]));
    inner.add(mesh(geo.sphere, c1, [0, 0.55, 0.42], [0.12, 0.13, 0.12]));
    const head = new THREE.Group();
    head.position.set(0, 0.74, 0.5);
    inner.add(head);
    head.add(mesh(geo.sphere, c1, [0, 0, 0], [0.2, 0.16, 0.25]));
    head.add(mesh(geo.sphere, c2, [0, -0.07, 0.07], [0.15, 0.07, 0.19]));
    eyes(head, 0, 0.07, 0.14, 0.055, 0.1);
    if (ex.has('horn')) head.add(mesh(geo.cone, toon(spec.c4 || '#f0e0c0'), [0, 0.2, -0.04], [0.05, 0.24, 0.05], [-0.5, 0, 0]));
    if (ex.has('whiskers')) for (const sx of [-1, 1]) head.add(mesh(geo.cyl, c3, [sx * 0.16, -0.06, 0.16], [0.012, 0.36, 0.012], [0.3, 0, sx * 1.2]));
    if (ex.has('fins')) for (const sx of [-1, 1]) head.add(mesh(geo.cone, c3, [sx * 0.2, 0.05, -0.05], [0.06, 0.2, 0.12], [0, 0, -sx * 1.2]));
    anim.segs = segs;
  } else if (plan === 'mushroom') {
    inner.add(mesh(geo.cyl, c2, [0, 0.25, 0], [0.18, 0.5, 0.18]));
    eyes(inner, 0, 0.32, 0.17, 0.06, 0.08);
    for (const sx of [-1, 1]) inner.add(mesh(geo.sphere, c2, [sx * 0.21, 0.22, 0.04], [0.06, 0.08, 0.06]));
    const capM = ex.has('glow') ? toon(spec.c1, { emissive: spec.c1, emissiveIntensity: 0.35 }) : c1;
    inner.add(mesh(geo.hemi, capM, [0, 0.45, 0], [0.44, 0.36, 0.44]));
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9, d = i === 0 ? 0 : 0.28;
      const h = 0.36 * Math.sqrt(Math.max(0, 1 - (d / 0.44) ** 2));
      inner.add(mesh(geo.sphere, toon(spec.c3), [Math.cos(a) * d, 0.45 + h, Math.sin(a) * d], [0.07, 0.03, 0.07], [Math.sin(a) * d * 1.5, 0, -Math.cos(a) * d * 1.5]));
    }
  } else if (plan === 'crystal') {
    anim.float = true;
    const cm = toon(spec.c1, { emissive: spec.c1, emissiveIntensity: 0.3 });
    const core = mesh(new THREE.OctahedronGeometry(1, 0), cm, [0, 0.6, 0], [0.22, 0.42, 0.22]);
    inner.add(core);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.4;
      inner.add(mesh(new THREE.OctahedronGeometry(1, 0), toon(spec.c2), [Math.cos(a) * 0.3, 0.45, Math.sin(a) * 0.3], [0.08, 0.2, 0.08], [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4]));
    }
    eyes(inner, 0, 0.66, 0.18, 0.05, 0.07);
    if (ex.has('sparks')) for (let i = 0; i < 4; i++) {
      const sp = mesh(geo.box, new THREE.MeshBasicMaterial({ color: 0xfff080 }), [Math.cos(i * 1.6) * 0.45, 0.7 + (i % 2) * 0.2, Math.sin(i * 1.6) * 0.3], [0.03, 0.18, 0.03], [0, 0, 0.9]);
      sp.userData.noOutline = true;
      inner.add(sp);
    }
    anim.spin = core;
  }

  const s = spec.size * 1.6;
  inner.scale.setScalar(s);
  addOutline(root, 0.02);
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });

  let t = Math.random() * 10;
  const baseY = anim.float ? 0.12 : 0;
  return {
    group: root,
    inner,
    height: (anim.float ? 1.1 : 0.9) * s,
    update(dt) {
      t += dt;
      inner.position.y = baseY + (anim.float ? Math.sin(t * 2.4) * 0.07 : 0);
      inner.scale.y = s * (1 + Math.sin(t * 3) * 0.02);
      for (const f of anim.flames) {
        f.scale.set(1 + Math.sin(t * 20 + f.userData.seed) * 0.08, 1 + Math.sin(t * 17 + f.userData.seed) * 0.15, 1 + Math.cos(t * 19 + f.userData.seed) * 0.08);
      }
      for (const w of anim.wings) {
        if (w.claw) w.g.rotation.z = Math.sin(t * 3) * 0.2 * w.side;
        else if (w.butterfly) w.g.rotation.y = w.side * Math.sin(t * 8) * 0.6;
        else w.g.rotation.z = w.side * (0.2 + Math.sin(t * (anim.float ? 14 : 4)) * 0.4);
      }
      if (anim.tail) anim.tail.rotation.y = Math.sin(t * 4) * 0.25;
      if (anim.spin) anim.spin.rotation.z = Math.sin(t * 1.5) * 0.4;
      if (anim.segs) for (const sg of anim.segs) sg.position.x = Math.sin(t * 2.6 + sg.userData.i * 0.9) * 0.16;
      if (anim.glow) anim.glow.scale.setScalar(0.09 * (1 + Math.max(0, Math.sin(t * 4)) * 0.6));
      if (anim.whirls) anim.whirls.forEach((w, i) => { w.rotation.z = t * (4 + i); });
    },
  };
}

// Orbe de captura
export function makeOrb(color = '#e03a3a') {
  const g = new THREE.Group();
  const top = mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(color), [0, 0, 0], 0.12);
  const bot = mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#f4f4f4'), [0, 0, 0], 0.12);
  const band = mesh(geo.cyl, toon('#222'), [0, 0, 0], [0.122, 0.02, 0.122]);
  const btn = mesh(geo.cyl, toon('#fff'), [0, 0, 0.115], [0.035, 0.02, 0.035], [Math.PI / 2, 0, 0]);
  g.add(top, bot, band, btn);
  addOutline(g, 0.01);
  return g;
}
