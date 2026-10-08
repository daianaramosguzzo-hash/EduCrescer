// Força Tática — modelos 3D feitos em código: armas e soldados
import * as THREE from '../../lib/three.module.min.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}

function box(w, h, d, m, x = 0, y = 0, z = 0, parent = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  if (parent) parent.add(mesh);
  return mesh;
}

function cyl(r, len, m, x = 0, y = 0, z = 0, parent = null, seg = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  if (parent) parent.add(mesh);
  return mesh;
}

const METAL = 0x26282b, DARK = 0x18191b, WOOD = 0x7a4a24, STEEL = 0xa9adb3;

// ---------------------------------------------------------------- armas
// Todas apontam para -z. A origem fica no punho; "muzzle" marca a boca do cano.
export function buildGun(kind, color = METAL) {
  const g = new THREE.Group();
  const body = mat(color), metal = mat(METAL), dark = mat(DARK), wood = mat(WOOD), steel = mat(STEEL);
  let muzzleZ = -0.5, muzzleY = 0.02;
  switch (kind) {
    case 'ak': {
      box(0.05, 0.075, 0.38, metal, 0, 0.02, -0.08, g);
      box(0.058, 0.06, 0.2, body, 0, 0.01, -0.33, g);
      box(0.05, 0.035, 0.16, body, 0, 0.055, -0.33, g);
      cyl(0.011, 0.24, metal, 0, 0.03, -0.53, g);
      box(0.01, 0.04, 0.01, metal, 0, 0.065, -0.62, g);
      const mag = box(0.035, 0.19, 0.065, metal, 0, -0.1, -0.13, g); mag.rotation.x = 0.4;
      box(0.045, 0.1, 0.26, body, 0, -0.03, 0.24, g).rotation.x = 0.12;
      box(0.035, 0.1, 0.045, wood, 0, -0.07, 0.04, g).rotation.x = -0.3;
      muzzleZ = -0.66; muzzleY = 0.03;
      break;
    }
    case 'm4': {
      box(0.05, 0.08, 0.34, body, 0, 0.02, -0.06, g);
      box(0.06, 0.07, 0.22, dark, 0, 0.02, -0.33, g);
      box(0.02, 0.05, 0.1, body, 0, 0.085, -0.05, g);
      box(0.015, 0.05, 0.015, body, 0, 0.075, -0.42, g);
      cyl(0.011, 0.22, metal, 0, 0.025, -0.54, g);
      cyl(0.02, 0.1, dark, 0, 0.025, -0.68, g);
      box(0.032, 0.18, 0.06, metal, 0, -0.1, -0.12, g).rotation.x = 0.15;
      box(0.04, 0.09, 0.24, dark, 0, -0.01, 0.24, g);
      box(0.035, 0.1, 0.045, dark, 0, -0.07, 0.05, g).rotation.x = -0.3;
      muzzleZ = -0.74; muzzleY = 0.025;
      break;
    }
    case 'rifleG': {
      box(0.052, 0.08, 0.4, body, 0, 0.02, -0.1, g);
      box(0.056, 0.06, 0.18, wood, 0, 0.01, -0.36, g);
      cyl(0.011, 0.22, metal, 0, 0.03, -0.55, g);
      box(0.035, 0.2, 0.065, metal, 0, -0.11, -0.14, g).rotation.x = 0.25;
      box(0.03, 0.06, 0.3, metal, 0, 0.0, 0.24, g);
      box(0.035, 0.1, 0.045, dark, 0, -0.07, 0.04, g).rotation.x = -0.3;
      muzzleZ = -0.66; muzzleY = 0.03;
      break;
    }
    case 'rifleF': {
      box(0.06, 0.12, 0.5, body, 0, 0.03, 0.02, g);
      box(0.03, 0.04, 0.32, dark, 0, 0.11, 0.0, g);
      cyl(0.011, 0.2, metal, 0, 0.03, -0.32, g);
      box(0.03, 0.16, 0.06, metal, 0, -0.09, 0.14, g);
      box(0.035, 0.1, 0.045, dark, 0, -0.07, -0.08, g).rotation.x = -0.3;
      muzzleZ = -0.43; muzzleY = 0.03;
      break;
    }
    case 'smg': {
      box(0.045, 0.07, 0.3, body, 0, 0.02, -0.08, g);
      cyl(0.01, 0.12, metal, 0, 0.025, -0.29, g);
      box(0.03, 0.17, 0.045, metal, 0, -0.08, 0.0, g);
      box(0.02, 0.04, 0.2, metal, 0, 0.0, 0.17, g);
      box(0.035, 0.09, 0.045, dark, 0, -0.06, -0.15, g).rotation.x = 0.3;
      muzzleZ = -0.36; muzzleY = 0.025;
      break;
    }
    case 'smg50': {
      box(0.07, 0.11, 0.48, body, 0, 0.0, -0.05, g);
      box(0.05, 0.03, 0.3, mat(0x222222, { transparent: true, opacity: 0.8 }), 0, 0.07, -0.05, g);
      cyl(0.012, 0.08, metal, 0, 0.01, -0.33, g);
      box(0.035, 0.09, 0.045, dark, 0, -0.08, -0.1, g).rotation.x = -0.2;
      muzzleZ = -0.38; muzzleY = 0.01;
      break;
    }
    case 'shotgun': {
      box(0.05, 0.08, 0.26, metal, 0, 0.02, -0.03, g);
      cyl(0.014, 0.5, metal, 0, 0.04, -0.4, g);
      cyl(0.012, 0.42, dark, 0, 0.005, -0.36, g);
      box(0.06, 0.055, 0.16, body, 0, 0.005, -0.32, g);
      box(0.045, 0.11, 0.3, body, 0, -0.04, 0.26, g).rotation.x = 0.15;
      muzzleZ = -0.66; muzzleY = 0.04;
      break;
    }
    case 'awp':
    case 'scout': {
      const big = kind === 'awp';
      box(0.06, 0.09, 0.5, body, 0, 0.0, -0.05, g);
      cyl(big ? 0.016 : 0.012, big ? 0.55 : 0.45, metal, 0, 0.02, big ? -0.57 : -0.52, g);
      cyl(big ? 0.028 : 0.022, 0.32, dark, 0, 0.1, -0.04, g, 10);
      cyl(big ? 0.036 : 0.028, 0.05, dark, 0, 0.1, -0.21, g, 10);
      box(0.012, 0.04, 0.02, dark, 0, 0.065, -0.04, g);
      box(0.03, 0.09, 0.07, metal, 0, -0.08, -0.08, g);
      box(0.05, 0.13, 0.32, body, 0, -0.04, 0.33, g);
      box(0.035, 0.1, 0.045, dark, 0, -0.07, 0.1, g).rotation.x = -0.35;
      muzzleZ = big ? -0.86 : -0.76; muzzleY = 0.02;
      break;
    }
    case 'pistol': {
      box(0.03, 0.04, 0.19, body, 0, 0.05, -0.06, g);
      box(0.026, 0.03, 0.15, dark, 0, 0.02, -0.06, g);
      box(0.028, 0.11, 0.045, dark, 0, -0.03, 0.01, g).rotation.x = -0.25;
      muzzleZ = -0.16; muzzleY = 0.05;
      break;
    }
    case 'deagle': {
      box(0.036, 0.055, 0.25, body, 0, 0.055, -0.08, g);
      box(0.03, 0.035, 0.18, steel, 0, 0.018, -0.07, g);
      box(0.032, 0.12, 0.05, dark, 0, -0.035, 0.015, g).rotation.x = -0.25;
      muzzleZ = -0.21; muzzleY = 0.055;
      break;
    }
    case 'knife': {
      box(0.024, 0.03, 0.11, dark, 0, 0, 0.02, g);
      box(0.04, 0.012, 0.012, metal, 0, 0, -0.04, g);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.034, 0.17), steel);
      blade.position.set(0, 0.004, -0.13);
      g.add(blade);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 4), steel);
      tip.rotation.x = -Math.PI / 2; tip.scale.set(0.3, 1, 1);
      tip.position.set(0, 0.004, -0.24);
      g.add(tip);
      muzzleZ = -0.25; muzzleY = 0;
      break;
    }
    case 'grenade': {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), body);
      s.scale.set(1, 1.25, 1);
      g.add(s);
      box(0.02, 0.025, 0.02, metal, 0, 0.05, 0, g);
      box(0.008, 0.06, 0.016, metal, 0.016, 0.03, 0, g).rotation.z = -0.25;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.002, 4, 10), steel);
      ring.position.set(-0.012, 0.066, 0);
      g.add(ring);
      muzzleZ = 0; muzzleY = 0;
      break;
    }
    case 'bomb': {
      box(0.2, 0.1, 0.13, mat(0x7a6040), 0, 0, 0, g);
      for (let i = -1; i <= 1; i++) cyl(0.022, 0.13, mat(0xb36a2e), i * 0.06, 0.04, 0, g).rotation.set(0, 0, 0);
      box(0.1, 0.012, 0.07, mat(0x1d1f22), 0.02, 0.06, 0, g);
      box(0.07, 0.004, 0.025, mat(0x55ff66, { emissive: 0x228833 }), 0.02, 0.068, -0.015, g);
      const led = box(0.012, 0.012, 0.012, mat(0xff2222, { emissive: 0xff0000 }), -0.06, 0.065, 0.03, g);
      led.name = 'led';
      box(0.205, 0.03, 0.02, mat(0x333333), 0, 0.02, 0.04, g);
      muzzleZ = 0; muzzleY = 0;
      break;
    }
    default:
      box(0.05, 0.08, 0.4, body, 0, 0, -0.1, g);
  }
  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(0, muzzleY, muzzleZ);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

// ---------------------------------------------------------------- soldados
const LOOK = {
  atk: { shirt: 0xb08850, pants: 0x5d4b33, vest: 0x5e5036, head: 0x2a2624, band: 0xc0392b, skin: 0xc8916d, boots: 0x2a2018 },
  def: { shirt: 0x3e5372, pants: 0x2c3540, vest: 0x26313d, head: 0x3d4b5c, band: 0x3fa7e0, skin: 0xd7a07f, boots: 0x15181c },
};

function pointLimb(group, from, to) {
  const dir = to.clone().sub(from);
  const len = dir.length();
  group.position.copy(from);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
  group.children[0].scale.y = len / 0.3;
  group.children[0].position.y = -len / 2;
}

export function buildSoldier(team) {
  const L = LOOK[team];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  body.add(hips);

  const legs = [];
  for (const side of [-1, 1]) {
    const thigh = new THREE.Group();
    thigh.position.x = side * 0.1;
    box(0.16, 0.48, 0.18, mat(L.pants), 0, -0.24, 0, thigh);
    const shin = new THREE.Group();
    shin.position.y = -0.48;
    box(0.14, 0.42, 0.16, mat(L.pants), 0, -0.21, 0, shin);
    box(0.15, 0.09, 0.26, mat(L.boots), 0, -0.43, -0.04, shin);
    thigh.add(shin);
    hips.add(thigh);
    legs.push({ thigh, shin });
  }

  const torso = new THREE.Group();
  hips.add(torso);
  box(0.36, 0.2, 0.22, mat(L.pants), 0, 0.05, 0, torso);
  box(0.42, 0.52, 0.24, mat(L.shirt), 0, 0.4, 0, torso);
  const vest = box(0.45, 0.4, 0.28, mat(L.vest), 0, 0.42, 0, torso);
  box(0.43, 0.06, 0.25, mat(0x2b2b2b), 0, 0.14, 0, torso);

  const head = new THREE.Group();
  head.position.y = 0.7;
  torso.add(head);
  box(0.1, 0.08, 0.1, mat(L.skin), 0, 0.02, 0, head);
  box(0.21, 0.24, 0.23, mat(L.head), 0, 0.16, 0, head);
  // rosto
  box(0.16, 0.06, 0.02, mat(L.skin), 0, 0.17, -0.115, head);
  box(0.04, 0.02, 0.01, mat(0x111111), -0.04, 0.17, -0.127, head);
  box(0.04, 0.02, 0.01, mat(0x111111), 0.04, 0.17, -0.127, head);
  let helmet = null;
  if (team === 'def') {
    helmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x45535f));
    helmet.position.y = 0.22;
    helmet.scale.set(1, 0.85, 1.05);
    head.add(helmet);
    box(0.17, 0.045, 0.03, mat(0x1b2229), 0, 0.215, -0.12, head);
  } else {
    helmet = box(0.22, 0.06, 0.24, mat(0x3b3a33), 0, 0.29, 0, head);
  }

  // braços e arma
  const shoulderR = new THREE.Vector3(0.25, 0.62, 0), shoulderL = new THREE.Vector3(-0.25, 0.62, 0);
  const gunMount = new THREE.Group();
  gunMount.position.set(0.08, 0.45, -0.28);
  torso.add(gunMount);
  const arms = [];
  for (const side of [1, -1]) {
    const arm = new THREE.Group();
    box(0.11, 0.3, 0.11, mat(L.shirt), 0, -0.15, 0, arm);
    const band = box(0.115, 0.04, 0.115, mat(L.band), 0, -0.05, 0, arm);
    band.scale.y = 1;
    torso.add(arm);
    arms.push({ arm, shoulder: side > 0 ? shoulderR : shoulderL });
  }

  root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });

  const model = {
    root, body, hips, torso, head, legs, vest, helmet, gunMount, arms, gun: null, gunKind: null,
    phase: Math.random() * 6, deadT: 0, deadDir: 1,
    setGun(kind, color) {
      if (this.gunKind === kind && this.gunColor === color) return;
      if (this.gun) gunMount.remove(this.gun);
      this.gunKind = kind; this.gunColor = color;
      this.gun = kind ? buildGun(kind, color) : null;
      if (this.gun) gunMount.add(this.gun);
      this.poseArms();
    },
    poseArms() {
      const kind = this.gunKind;
      const small = kind === 'pistol' || kind === 'deagle' || kind === 'knife' || kind === 'grenade' || kind === 'bomb';
      const grip = gunMount.position.clone();
      const fore = gunMount.position.clone().add(new THREE.Vector3(0, -0.02, small ? 0.02 : -0.3));
      if (small) grip.x += 0.02;
      pointLimb(arms[0].arm, arms[0].shoulder, grip);
      pointLimb(arms[1].arm, arms[1].shoulder, small ? grip.clone().add(new THREE.Vector3(-0.06, 0, 0.02)) : fore);
    },
  };
  return model;
}

// Atualiza pose do soldado (caminhada, agachar, mirar, morrer)
export function animateSoldier(m, a, dt) {
  const L = m.legs;
  if (!a.alive) {
    m.deadT = Math.min(1, m.deadT + dt * 2.6);
    const t = m.deadT;
    const e = t * t * (3 - 2 * t);
    m.body.rotation.x = m.deadDir * e * Math.PI / 2;
    m.body.position.y = e * 0.14;
    m.torso.rotation.x = 0;
    for (const l of L) { l.thigh.rotation.x *= 0.9; l.shin.rotation.x *= 0.9; }
    return;
  }
  m.deadT = 0;
  m.body.rotation.x = 0;
  m.body.position.y = 0;
  const speed = Math.hypot(a.vel.x, a.vel.z);
  const c = a.duck;
  m.hips.position.y = 0.95 - c * 0.36;
  const amt = Math.min(1, speed / 4);
  m.phase += dt * (2.2 + speed * 1.9) * (a.onGround ? 1 : 0.2);
  // perna em relação ao movimento (andar para trás inverte o passo)
  const fwd = -Math.sin(a.yaw) * a.vel.x - Math.cos(a.yaw) * a.vel.z;
  const dir = fwd < -0.3 ? -1 : 1;
  for (let i = 0; i < 2; i++) {
    const s = Math.sin(m.phase + i * Math.PI) * dir;
    const swing = s * 0.55 * amt;
    const crouchThigh = c * 1.25, crouchShin = -c * 2.1;
    L[i].thigh.rotation.x = crouchThigh + swing;
    L[i].shin.rotation.x = crouchShin - Math.max(0, -Math.sin(m.phase + i * Math.PI + 0.6)) * 0.9 * amt;
  }
  if (!a.onGround) { L[0].thigh.rotation.x += 0.5; L[0].shin.rotation.x -= 0.8; L[1].thigh.rotation.x += 0.2; }
  m.torso.rotation.x = a.pitch * 0.35 + c * 0.15;
  m.head.rotation.x = a.pitch * 0.45 - c * 0.1;
  m.gunMount.rotation.x = a.pitch * 0.55 - c * 0.1 + (a.vmKick || 0) * 0.3;
  m.vest.visible = a.armor > 0;
  m.helmet.visible = a.team === 'def' ? a.helmet : true;
}
