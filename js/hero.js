// Herói principal, modelado em código a partir da ficha de personagem:
// cabelo castanho espetado, olhos grandes, jaqueta marrom com capuz e punhos
// bege, camiseta CRESCER, bermuda cargo preta, meias com listras azuis, tênis
// branco e preto e mochila preta com losango marrom.
// Esqueleto em grupos (quadril, tronco, cabeça, braços, pernas), com animações
// procedurais (parado, andar, correr, pular, interagir, apontar, arremessar),
// piscar e expressões faciais. Mesma interface de makeHuman.
import * as THREE from '../lib/three.module.min.js';
import { mergeGeometries } from '../lib/addons/BufferGeometryUtils.js';
import { charMat, addOutline, GRADIENT, addRim } from './models.js';

const C = {
  skin: '#f6c7a1', skinShade: '#e9a883', blush: '#f49a86',
  hair: '#3d2414', hairLight: '#5b3820',
  jacket: '#b9743a', jacketDark: '#8e5327', rib: '#e2cda6',
  shirt: '#e8e6e1', print: '#4a4a4e', orange: '#ec7a3c',
  shorts: '#222226', shortsDark: '#141417',
  sock: '#f6f6f4', stripe: '#2f4c9c',
  shoe: '#f4f4f1', shoeBlack: '#1e1e22', sole: '#dcdcd6',
  pack: '#26272c', packLight: '#34363c', strap: '#8a5a32', metal: '#b8b4a8',
  eye: '#ffffff', iris: '#5a3a1f', pupil: '#120c08', lash: '#2a1810', brow: '#3a2213', mouth: '#8a3a2e', tongue: '#e8766a',
};

// ------------------------------------------------ geometrias auxiliares
const cache = new Map();
const cached = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };

// caixa com cantos arredondados (bolsos, mochila, solado)
function roundedBox(w, h, d, r, seg = 4) {
  return cached(`rb${w},${h},${d},${r}`, () => {
    const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
    const p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
    const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      c.set(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz));
      v.sub(c).normalize().multiplyScalar(r).add(c);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
}

// mecha de cabelo: cone achatado e curvado (a ponta dobra para trás)
function spikeGeo(bend) {
  return cached('spike' + bend, () => {
    const g = new THREE.ConeGeometry(1, 1, 7, 5);
    g.translate(0, 0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const w = 1 + 0.35 * Math.sin(y * Math.PI) ;
      p.setZ(i, p.getZ(i) * 0.55 * w + bend * y * y);
      p.setX(i, p.getX(i) * w);
    }
    g.computeVertexNormals();
    return g;
  });
}

// cápsula com raio e altura total de verdade (sem distorcer as pontas)
function capsule(r, h) { return cached(`cap${r},${h}`, () => new THREE.CapsuleGeometry(r, Math.max(0.001, h - 2 * r), 6, 14)); }

const G = {
  sphere: new THREE.SphereGeometry(1, 24, 16),
  sphereLo: new THREE.SphereGeometry(1, 14, 10),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
  cylOpen: new THREE.CylinderGeometry(1, 1, 1, 18, 1, true),
};

function M(geo, mat, pos, scale, rot) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (scale !== undefined) { if (typeof scale === 'number') m.scale.setScalar(scale); else m.scale.set(...scale); }
  if (rot) m.rotation.set(...rot);
  m.castShadow = true;
  return m;
}
const detail = m => { m.userData.noOutline = true; m.castShadow = false; return m; };
const flat = (color, extra = {}) => {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT, ...extra });
  return addRim(m, 0.25);
};

// estampa da camiseta: CRESCER com a faixa laranja
function shirtPrint() {
  return cached('print', () => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = C.print;
    g.font = '900 54px Nunito, Arial Black, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('CRESCER', 128, 46);
    g.fillStyle = C.orange;
    g.fillRect(104, 84, 40, 16);
    g.fillStyle = '#9a9a9e';
    g.fillRect(148, 84, 26, 16);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

// ------------------------------------------------ partes do corpo
function buildHead(mats) {
  const head = new THREE.Group();
  const R = 0.2;
  head.add(M(G.sphere, mats.skin, [0, 0, 0], [R, R * 0.97, R * 0.95]));
  // orelhas
  for (const s of [-1, 1]) {
    const ear = M(G.sphere, mats.skin, [s * 0.19, -0.01, -0.01], [0.04, 0.055, 0.03], [0, s * 0.3, 0]);
    head.add(ear);
    head.add(detail(M(G.sphere, mats.skinShade, [s * 0.202, -0.012, 0.0], [0.018, 0.032, 0.012], [0, s * 0.3, 0])));
  }
  // nariz
  head.add(detail(M(G.sphereLo, mats.skin, [0, -0.045, 0.19], [0.022, 0.018, 0.018])));

  // olhos grandes: branco, íris castanha, pupila e dois brilhos
  const eyes = [], closed = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(s * 0.078, 0.0, 0.168);
    eg.rotation.set(0.05, s * 0.36, 0);
    eg.scale.setScalar(1.12);
    eg.add(detail(M(G.sphere, mats.eye, [0, 0, 0], [0.043, 0.054, 0.024])));
    const iris = new THREE.Group();
    iris.position.set(-s * 0.004, -0.004, 0.017);
    iris.add(detail(M(G.sphere, mats.iris, [0, 0, 0], [0.031, 0.038, 0.012])));
    iris.add(detail(M(G.sphere, mats.pupil, [0, -0.002, 0.006], [0.017, 0.021, 0.008])));
    iris.add(detail(M(G.sphereLo, mats.eye, [s * 0.012 + 0.004, 0.015, 0.011], [0.011, 0.012, 0.004])));
    iris.add(detail(M(G.sphereLo, mats.eye, [-s * 0.012 - 0.002, -0.014, 0.011], [0.005, 0.005, 0.003])));
    eg.add(iris);
    // cílios / pálpebra superior
    const lash = detail(M(new THREE.TorusGeometry(0.044, 0.006, 6, 16, Math.PI * 0.8), mats.lash, [0, 0.004, 0.012], [1, 1.2, 1], [0, 0, Math.PI * 0.1]));
    eg.add(lash);
    head.add(eg);
    eyes.push({ g: eg, iris });
    // olho fechado (sorriso ^ ^)
    const cl = detail(M(new THREE.TorusGeometry(0.035, 0.007, 6, 14, Math.PI * 0.8), mats.lash, [s * 0.078, 0.0, 0.19], 1, [0, s * 0.36, Math.PI * 0.1]));
    cl.visible = false;
    head.add(cl);
    closed.push(cl);
  }
  // sobrancelhas grossas
  const brows = [];
  for (const s of [-1, 1]) {
    const b = new THREE.Group();
    b.position.set(s * 0.08, 0.078, 0.176);
    b.rotation.set(-0.15, s * 0.36, 0);
    const bm = detail(M(new THREE.TorusGeometry(0.05, 0.011, 6, 12, Math.PI * 0.55), mats.brow, [0, -0.04, 0], [1, 0.7, 0.8], [0, 0, Math.PI * 0.225]));
    b.add(bm);
    head.add(b);
    brows.push(b);
  }
  // bocas (uma por expressão)
  const mouthPos = [0, -0.1, 0.178];
  const mouths = {
    smile: detail(M(new THREE.TorusGeometry(0.03, 0.006, 6, 14, Math.PI * 0.7), mats.mouth, mouthPos, 1, [0.25, 0, -Math.PI / 2 - Math.PI * 0.35])),
    open: new THREE.Group(),
    o: detail(M(new THREE.TorusGeometry(0.015, 0.007, 6, 14), mats.mouth, mouthPos, [1, 1.3, 1], [0.25, 0, 0])),
    frown: detail(M(new THREE.TorusGeometry(0.025, 0.006, 6, 14, Math.PI * 0.6), mats.mouth, [0, -0.108, 0.175], 1, [0.25, 0, Math.PI * 0.2])),
    flat: detail(M(capsule(0.006, 0.04), mats.mouth, [0.01, -0.102, 0.176], 1, [0.25, 0, Math.PI / 2 + 0.2])),
  };
  const om = new THREE.Mesh(new THREE.CircleGeometry(0.034, 18, Math.PI, Math.PI), mats.mouthIn);
  om.userData.noOutline = true;
  const tongue = new THREE.Mesh(new THREE.CircleGeometry(0.02, 12, Math.PI, Math.PI), mats.tongue);
  tongue.position.set(0, -0.012, 0.001); tongue.userData.noOutline = true;
  om.add(tongue);
  mouths.open.add(om);
  mouths.open.position.set(0, -0.092, 0.183);
  mouths.open.rotation.x = -0.25;
  for (const m of Object.values(mouths)) { m.visible = false; head.add(m); }
  // bochechas rosadas
  for (const s of [-1, 1]) head.add(detail(M(G.sphereLo, mats.blush, [s * 0.125, -0.06, 0.135], [0.03, 0.017, 0.01], [0, s * 0.7, 0])));

  buildHair(head, mats);
  return { head, eyes, closed, brows, mouths };
}

// cabelo: calota que cobre topo, lados e nuca + mechas grossas espalhadas por
// toda a área do cabelo (distribuição de Fibonacci), fundidas em uma só malha
function buildHair(head, mats) {
  const parts = { dark: [], light: [] };
  let seed = 23;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const up = new THREE.Vector3(0, 1, 0), center = new THREE.Vector3(0, 0.03, -0.028);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), tw = new THREE.Quaternion();
  const clump = (d, out, len, rad, bend, light) => {
    q.setFromUnitVectors(up, out.clone().normalize());
    tw.setFromAxisAngle(up, (rnd() - 0.5) * 1.4);
    q.multiply(tw);
    const pos = d.clone().normalize().multiplyScalar(0.17).add(center);
    m4.compose(pos, q, new THREE.Vector3(rad, len, rad * (0.8 + rnd() * 0.3)));
    (light ? parts.light : parts.dark).push(spikeGeo(bend).clone().applyMatrix4(m4));
  };
  const N = 95;
  for (let i = 0; i < N; i++) {
    // ponto i da espiral de Fibonacci sobre a esfera
    const y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
    const d = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    if (d.z > 0.72 * d.y + 0.12) continue;       // rosto
    if (d.y < -0.5) continue;                     // abaixo da nuca
    if (Math.abs(d.x) > 0.75 && d.y < 0.1 && d.z > -0.4) continue; // orelhas
    const light = rnd() < 0.3;
    if (d.z > 0.2 && d.y > 0.15) {
      // franja: mechas grossas para a frente, caindo sobre a testa
      const out = new THREE.Vector3(d.x * 0.8 + (rnd() - 0.5) * 0.3, -0.15 + d.y * 0.4, 1);
      clump(d, out, 0.13 + rnd() * 0.04, 0.1 + rnd() * 0.02, -0.12, light);
    } else if (d.y > 0.45) {
      // topo: volume para cima e um pouco para trás
      const out = d.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.4, 0.5, -0.3));
      clump(d, out, 0.14 + rnd() * 0.05, 0.11 + rnd() * 0.02, 0.15, light);
    } else {
      // lados e nuca: mechas deitadas, apontando para baixo e para fora
      const out = d.clone().multiplyScalar(0.55).add(new THREE.Vector3((rnd() - 0.5) * 0.3, -0.75, -0.1));
      clump(d, out, 0.12 + rnd() * 0.04, 0.1 + rnd() * 0.02, 0.1, light);
    }
  }
  head.add(M(G.sphere, mats.hair, [0, 0.035, -0.035], [0.212, 0.207, 0.21]));
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const g = mergeGeometries(list);
    g.computeBoundingSphere();
    head.add(M(g, k === 'light' ? mats.hairLight : mats.hair));
  }
}

function buildTorso(mats) {
  const torso = new THREE.Group();
  const gap = 0.95;
  // camiseta por dentro
  torso.add(M(G.cyl, mats.shirt, [0, 0.17, 0.004], [0.15, 0.36, 0.105]));
  const print = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true, -0.62, 1.24), mats.print);
  print.position.set(0, 0.2, 0.005); print.scale.set(0.151, 0.11, 0.106);
  print.userData.noOutline = true;
  torso.add(print);
  // jaqueta aberta na frente (cilindro com uma fresta) + ombros arredondados
  const jg = new THREE.CylinderGeometry(1, 1.04, 1, 24, 1, true, gap / 2, Math.PI * 2 - gap);
  torso.add(M(jg, mats.jacketIn, [0, 0.16, 0], [0.168, 0.34, 0.118]));
  const sh = new THREE.SphereGeometry(1, 24, 8, Math.PI / 2 + gap / 2, Math.PI * 2 - gap, 0, Math.PI / 2);
  const shoulders = M(sh, mats.jacketIn, [0, 0.33, 0], [0.168, 0.07, 0.118]);
  torso.add(shoulders);
  // barra canelada e golas com zíper
  const hem = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true, gap / 2, Math.PI * 2 - gap);
  torso.add(M(hem, mats.ribIn, [0, -0.02, 0], [0.178, 0.045, 0.126]));
  for (const s of [-1, 1]) {
    const a = gap / 2 * s;
    const x = Math.sin(a) * 0.168, z = Math.cos(a) * 0.118;
    torso.add(M(capsule(0.014, 0.34), mats.jacket, [x * 1.02, 0.16, z + 0.004], [1, 1, 0.85]));
    torso.add(detail(M(G.cyl, mats.zip, [x * 0.93, 0.17, z + 0.012], [0.004, 0.33, 0.004])));
    // bolsos da jaqueta
    torso.add(detail(M(roundedBox(0.075, 0.012, 0.01, 0.004), mats.jacketDark, [s * 0.1, 0.06, 0.1], 1, [0, s * 0.45, 0])));
  }
  // capuz caído atrás do pescoço
  const hood = new THREE.Group();
  hood.position.set(0, 0.35, -0.03);
  hood.add(M(new THREE.TorusGeometry(0.1, 0.045, 10, 20, Math.PI * 1.35), mats.jacket, [0, 0, 0], [1.15, 1, 1], [Math.PI / 2, 0, Math.PI * 0.325 + Math.PI]));
  hood.add(M(new THREE.TorusGeometry(0.1, 0.028, 8, 20, Math.PI * 1.1), mats.rib, [0, 0.02, 0.01], [1.05, 0.9, 1], [Math.PI / 2, 0, Math.PI * 0.45 + Math.PI]));
  hood.add(M(G.sphere, mats.jacket, [0, -0.06, -0.12], [0.11, 0.09, 0.05]));
  torso.add(hood);
  // pescoço
  torso.add(M(G.cyl, mats.skin, [0, 0.38, 0], [0.05, 0.06, 0.05]));
  // mochila
  const pack = new THREE.Group();
  pack.position.set(0, 0.18, -0.16);
  pack.add(M(roundedBox(0.27, 0.3, 0.12, 0.045), mats.pack, [0, 0, 0]));
  pack.add(M(roundedBox(0.275, 0.13, 0.13, 0.045), mats.packLight, [0, 0.095, -0.004]));
  pack.add(M(roundedBox(0.19, 0.11, 0.04, 0.02), mats.pack, [0, -0.07, -0.07]));
  const diamond = detail(M(roundedBox(0.05, 0.05, 0.012, 0.006), mats.strap, [0, 0.08, -0.07], 1, [0, 0, Math.PI / 4]));
  pack.add(diamond);
  for (const s of [-1, 1]) {
    pack.add(detail(M(roundedBox(0.026, 0.12, 0.01, 0.004), mats.strap, [s * 0.06, 0.0, -0.072])));
    pack.add(detail(M(roundedBox(0.03, 0.018, 0.012, 0.003), mats.metal, [s * 0.06, -0.035, -0.078])));
    // alças por cima dos ombros até o peito
    pack.add(M(new THREE.TorusGeometry(0.1, 0.014, 6, 14, Math.PI * 0.75), mats.pack, [s * 0.1, 0.13, 0.1], [1, 1.1, 1], [0, Math.PI / 2, Math.PI * 0.1]));
    pack.add(M(roundedBox(0.032, 0.2, 0.014, 0.006), mats.pack, [s * 0.105, 0.02, 0.28], 1, [0.08, 0, s * 0.05]));
  }
  torso.add(pack);
  return torso;
}

function buildArm(s, mats) {
  const shoulder = new THREE.Group();
  shoulder.position.set(s * 0.18, 0.3, 0);
  shoulder.rotation.z = s * 0.1;
  shoulder.add(M(G.sphere, mats.jacket, [0, 0, 0], [0.058, 0.058, 0.058]));
  shoulder.add(M(capsule(0.054, 0.22), mats.jacket, [0, -0.09, 0]));
  const elbow = new THREE.Group();
  elbow.position.set(0, -0.19, 0);
  shoulder.add(elbow);
  elbow.add(M(capsule(0.049, 0.18), mats.jacket, [0, -0.07, 0]));
  elbow.add(M(G.cyl, mats.rib, [0, -0.155, 0], [0.047, 0.05, 0.047]));
  const hand = new THREE.Group();
  hand.position.set(0, -0.2, 0);
  elbow.add(hand);
  hand.add(M(G.sphere, mats.skin, [0, 0, 0], [0.042, 0.048, 0.036]));
  hand.add(M(G.sphere, mats.skin, [-s * 0.028, 0.01, 0.018], [0.016, 0.026, 0.016], [0.3, 0, s * 0.4]));
  // dedo indicador (usado ao apontar)
  const finger = M(capsule(0.011, 0.06), mats.skin, [0, -0.05, 0.012]);
  finger.visible = false;
  hand.add(finger);
  return { shoulder, elbow, hand, finger };
}

function buildLeg(s, mats) {
  const hip = new THREE.Group();
  hip.position.set(s * 0.085, 0, 0);
  // perna da bermuda cargo com bolso lateral
  hip.add(M(G.cyl, mats.shorts, [0, -0.1, 0], [0.088, 0.24, 0.09]));
  hip.add(M(G.cyl, mats.shortsDark, [0, -0.225, 0], [0.091, 0.02, 0.093]));
  hip.add(M(roundedBox(0.03, 0.09, 0.08, 0.01), mats.shorts, [s * 0.088, -0.14, 0]));
  hip.add(detail(M(roundedBox(0.034, 0.028, 0.082, 0.008), mats.shortsDark, [s * 0.09, -0.1, 0])));
  const knee = new THREE.Group();
  knee.position.set(0, -0.24, 0);
  hip.add(knee);
  knee.add(M(G.cyl, mats.skin, [0, -0.06, 0], [0.042, 0.13, 0.042]));
  knee.add(M(G.cyl, mats.sock, [0, -0.2, 0], [0.045, 0.17, 0.045]));
  knee.add(detail(M(G.cyl, mats.stripe, [0, -0.135, 0], [0.047, 0.013, 0.047])));
  knee.add(detail(M(G.cyl, mats.stripe, [0, -0.162, 0], [0.047, 0.013, 0.047])));
  const foot = new THREE.Group();
  foot.position.set(0, -0.29, 0);
  knee.add(foot);
  // tênis robusto: cabedal branco, painel preto, solado grosso
  foot.add(M(roundedBox(0.12, 0.04, 0.23, 0.018), mats.sole, [0, -0.072, 0.035]));
  foot.add(M(G.sphere, mats.shoe, [0, -0.028, 0.035], [0.062, 0.05, 0.112]));
  foot.add(M(G.sphere, mats.shoe, [0, -0.002, -0.02], [0.055, 0.05, 0.06]));
  for (const side of [-1, 1]) foot.add(detail(M(G.sphere, mats.shoeBlack, [side * 0.05, -0.035, 0.0], [0.016, 0.03, 0.07], [0, 0, 0])));
  foot.add(detail(M(G.sphere, mats.shoeBlack, [0, -0.02, -0.075], [0.045, 0.035, 0.02])));
  foot.add(detail(M(roundedBox(0.122, 0.012, 0.232, 0.005), mats.shoeBlack, [0, -0.088, 0.035])));
  for (let i = 0; i < 3; i++) foot.add(detail(M(roundedBox(0.05, 0.007, 0.012, 0.003), mats.shoe, [0, 0.012 - i * 0.012, 0.04 + i * 0.024], 1, [0.5, 0, 0])));
  return { hip, knee, foot };
}

// ------------------------------------------------ montagem e animação
export function makeHero(opt = {}) {
  const tm = (color, tex) => charMat(color, tex);
  const mats = {
    skin: tm(C.skin, 'skin'), skinShade: flat(C.skinShade), blush: flat(C.blush, { transparent: true, opacity: 0.55 }),
    hair: tm(C.hair, 'hair'), hairLight: tm(C.hairLight, 'hair'),
    jacket: tm(C.jacket, 'canvas'), jacketDark: flat(C.jacketDark), rib: tm(C.rib, 'knit'),
    shirt: tm(C.shirt, 'cotton'), print: new THREE.MeshToonMaterial({ map: shirtPrint(), transparent: true, alphaTest: 0.3, gradientMap: GRADIENT }),
    shorts: tm(C.shorts, 'twill'), shortsDark: flat(C.shortsDark),
    sock: tm(C.sock, 'knit'), stripe: flat(C.stripe), shoe: tm(C.shoe, 'leather'), shoeBlack: flat(C.shoeBlack), sole: flat(C.sole),
    pack: tm(C.pack, 'canvas'), packLight: tm(C.packLight, 'canvas'), strap: tm(C.strap, 'leather'), metal: flat(C.metal),
    zip: flat('#3a2a1e'),
    eye: flat(C.eye), iris: flat(C.iris), pupil: flat(C.pupil), lash: flat(C.lash), brow: tm(C.brow, 'hair'),
    mouth: flat(C.mouth), mouthIn: new THREE.MeshBasicMaterial({ color: '#5a1e1a' }), tongue: new THREE.MeshBasicMaterial({ color: C.tongue }),
  };
  // jaqueta e barra vistas por dentro na fresta da frente
  mats.jacketIn = mats.jacket.clone(); mats.jacketIn.side = THREE.DoubleSide; mats.jacketIn.onBeforeCompile = mats.jacket.onBeforeCompile;
  mats.ribIn = mats.rib.clone(); mats.ribIn.side = THREE.DoubleSide; mats.ribIn.onBeforeCompile = mats.rib.onBeforeCompile;

  const root = new THREE.Group();
  const hips = new THREE.Group();          // quadril (sobe e desce ao andar)
  hips.position.y = 0.62;
  root.add(hips);
  hips.add(M(G.cyl, mats.shorts, [0, 0.0, 0], [0.165, 0.12, 0.112]));
  hips.add(detail(M(G.cyl, mats.shortsDark, [0, 0.05, 0], [0.167, 0.02, 0.114])));
  const spine = new THREE.Group();
  spine.position.y = 0.0;
  hips.add(spine);
  spine.add(buildTorso(mats));
  const neck = new THREE.Group();
  neck.position.y = 0.4;
  spine.add(neck);
  const face = buildHead(mats);
  face.head.position.y = 0.235;
  face.head.scale.setScalar(1.22);
  neck.add(face.head);
  spine.scale.set(1.1, 1, 1.1);
  neck.scale.set(1 / 1.1, 1, 1 / 1.1); // a cabeça não herda o alargamento do tronco
  const arms = [buildArm(-1, mats), buildArm(1, mats)];
  arms.forEach(a => spine.add(a.shoulder));
  const legs = [buildLeg(-1, mats), buildLeg(1, mats)];
  legs.forEach(l => { l.hip.scale.set(1.1, 1, 1.1); hips.add(l.hip); });

  root.scale.setScalar(opt.scale || 1);
  addOutline(root, 0.011);
  root.traverse(o => { if (o.isMesh) o.castShadow = !o.userData.noOutline; });

  // ---------------- expressões
  const EXPR = {
    normal: { mouth: 'smile', brow: [0, 0], browY: 0 },
    feliz: { mouth: 'open', brow: [0.1, 0.1], browY: 0.008, closed: true },
    surpreso: { mouth: 'o', brow: [-0.1, -0.1], browY: 0.02 },
    triste: { mouth: 'frown', brow: [-0.35, -0.35], browY: -0.004 },
    bravo: { mouth: 'flat', brow: [0.45, 0.45], browY: -0.012 },
    pensativo: { mouth: 'flat', brow: [-0.2, 0.2], browY: 0.004 },
  };
  let expr = 'normal';
  const setExpression = name => {
    const e = EXPR[name] || EXPR.normal;
    expr = name;
    for (const [k, m] of Object.entries(face.mouths)) m.visible = k === e.mouth;
    face.brows.forEach((b, i) => { b.rotation.z = (i ? -1 : 1) * e.brow[i]; b.position.y = 0.078 + e.browY; });
    face.eyes.forEach(ey => { ey.g.visible = !e.closed; });
    face.closed.forEach(c => { c.visible = !!e.closed; });
  };
  setExpression('normal');

  // ---------------- animação procedural
  let phase = 0, walkAmt = 0, runAmt = 0, t = Math.random() * 10;
  let blinkT = 2 + Math.random() * 3, blinkK = 0;
  let act = null, actT = 0, exprTimer = 0;
  const ACT_LEN = { pular: 0.75, interagir: 1.2, apontar: 1.4, throw: 0.55, fist: 1.0, atacar: 0.6 };
  const lerp = THREE.MathUtils.lerp, bump = (k, a, b) => Math.max(0, Math.min(1, (k - a) / (b - a)));
  const envl = (k, i, o) => Math.min(bump(k, 0, i), 1 - bump(k, 1 - o, 1)); // entra, segura e sai

  const api = {
    group: root, head: face.head, body: spine, height: 1.62 * (opt.scale || 1), hero: true,
    setExpression,
    update(dt, moving, speed = 1) {
      t += dt;
      const running = moving && speed > 1.3;
      walkAmt = lerp(walkAmt, moving && !running ? 1 : 0, Math.min(1, dt * 10));
      runAmt = lerp(runAmt, running ? 1 : 0, Math.min(1, dt * 10));
      const mv = walkAmt + runAmt;
      phase += dt * (9.5 * walkAmt + 14 * runAmt) * (moving ? 1 : 0.5);
      const s = Math.sin(phase), c = Math.cos(phase);
      const swing = 0.55 * walkAmt + 0.95 * runAmt;
      const breathe = Math.sin(t * 2.2) * (1 - mv);

      // pernas: balanço do quadril e joelho dobrando na passada
      legs[0].hip.rotation.x = -s * swing;
      legs[1].hip.rotation.x = s * swing;
      legs[0].knee.rotation.x = Math.max(0, -c) * (0.7 * walkAmt + 1.3 * runAmt) + 0.05;
      legs[1].knee.rotation.x = Math.max(0, c) * (0.7 * walkAmt + 1.3 * runAmt) + 0.05;
      legs.forEach(l => { l.foot.rotation.x = -l.knee.rotation.x * 0.35; l.hip.rotation.z = 0; });
      // braços opostos às pernas, cotovelo mais dobrado correndo
      arms[0].shoulder.rotation.x = s * swing * 0.9;
      arms[1].shoulder.rotation.x = -s * swing * 0.9;
      arms.forEach((a, i) => {
        a.shoulder.rotation.z = (i ? 1 : -1) * (0.1 + 0.03 * breathe);
        a.shoulder.rotation.y = 0;
        a.elbow.rotation.x = -(0.15 + 0.25 * walkAmt + 1.2 * runAmt);
        a.finger.visible = false;
      });
      hips.position.y = 0.62 + Math.abs(c) * (0.03 * walkAmt + 0.055 * runAmt) - 0.01 * runAmt;
      hips.position.z = 0; hips.rotation.y = s * 0.08 * mv;
      spine.rotation.set(0.04 + 0.22 * runAmt, -s * 0.1 * mv, 0);
      spine.scale.y = 1 + breathe * 0.012;
      neck.rotation.set(-0.1 * runAmt, s * 0.05 * mv + Math.sin(t * 0.7) * 0.06 * (1 - mv), 0);

      // ações de uma vez só
      if (act) {
        actT += dt;
        const len = ACT_LEN[act], k = Math.min(1, actT / len);
        const R = arms[1], L = arms[0];
        if (act === 'pular') {
          const up = Math.sin(Math.PI * bump(k, 0.15, 0.85));
          const crouch = envl(k, 0.15, 0.2) * (1 - up);
          hips.position.y += up * 0.28 - crouch * 0.08;
          legs.forEach(l => { l.hip.rotation.x = -0.5 * up - 0.3 * crouch; l.knee.rotation.x = 1.0 * up + 0.6 * crouch; });
          L.shoulder.rotation.set(-1.2 * up, 0, -0.6 * up); R.shoulder.rotation.set(-2.2 * up, 0, 0.5 * up);
        } else if (act === 'interagir') {
          const e = envl(k, 0.25, 0.25);
          hips.position.y -= 0.2 * e;
          legs[0].hip.rotation.x = -1.1 * e; legs[0].knee.rotation.x = 1.9 * e;
          legs[1].hip.rotation.x = -0.2 * e; legs[1].knee.rotation.x = 1.5 * e;
          spine.rotation.x += 0.45 * e;
          R.shoulder.rotation.x = -1.1 * e; R.elbow.rotation.x = -0.3 * e;
          neck.rotation.x += 0.2 * e;
        } else if (act === 'apontar') {
          const e = envl(k, 0.15, 0.2);
          R.shoulder.rotation.set(-1.45 * e, 0.3 * e, 0.1);
          R.elbow.rotation.x = -0.05 * e;
          R.finger.visible = e > 0.5;
          L.shoulder.rotation.set(0.1, 0, -0.5 * e); L.elbow.rotation.x = -1.6 * e;
          neck.rotation.y += 0.25 * e;
        } else if (act === 'throw' || act === 'atacar') {
          const back = envl(k, 0.3, 0.1) * (k < 0.4 ? 1 : 0);
          const fwd = k >= 0.4 ? Math.sin(Math.PI * bump(k, 0.4, 1)) : 0;
          R.shoulder.rotation.x = -2.4 * back - 1.4 * fwd;
          R.elbow.rotation.x = -0.9 * back - 0.1 * fwd;
          spine.rotation.y += 0.35 * back - 0.3 * fwd;
          legs[0].hip.rotation.x = -0.35 * (back + fwd);
        } else if (act === 'fist') {
          const e = envl(k, 0.2, 0.2);
          R.shoulder.rotation.set(-2.6 * e, 0, 0.35 * e); R.elbow.rotation.x = -1.4 * e;
          hips.position.y += Math.sin(Math.PI * bump(k, 0.1, 0.5)) * 0.05;
        }
        if (k >= 1) { act = null; }
      }
      if (exprTimer > 0) { exprTimer -= dt; if (exprTimer <= 0) setExpression('normal'); }

      // piscar
      blinkT -= dt;
      if (blinkT <= 0) { blinkK = 0.14; blinkT = 2.2 + Math.random() * 3.5; }
      if (blinkK > 0) blinkK = Math.max(0, blinkK - dt);
      const lid = blinkK > 0 ? Math.max(0.1, Math.abs(blinkK - 0.07) / 0.07) : 1;
      face.eyes.forEach(e => { e.g.scale.y = lid; });
    },
    // interface antiga: 'throw' (arremessar orbe), 'fist' (comemorar), 'rest'
    pose(name) {
      if (name === 'rest') return;
      api.play(name);
    },
    play(name, expression) {
      const n = name === 'Atacar' ? 'atacar' : name;
      if (!ACT_LEN[n]) return;
      act = n; actT = 0;
      const ex = expression || { fist: 'feliz', pular: 'feliz', apontar: 'normal', interagir: 'feliz' }[n];
      if (ex) { setExpression(ex); exprTimer = ACT_LEN[n] + 0.4; }
    },
  };
  api.update(0.016, false);
  return api;
}
