// Esqueleto, pesos e animações para o modelo do Leo (em metros, frente +z).
import * as THREE from '../../lib/three.module.min.js';

// ossos: nome, pai, posição absoluta (repouso)
export const BONES = [
  ['Hips', null, [0, 0.66, 0]],
  ['Spine', 'Hips', [0, 0.8, 0]],
  ['Chest', 'Spine', [0, 0.98, 0]],
  ['Neck', 'Chest', [0, 1.17, 0]],
  ['Head', 'Neck', [0, 1.24, 0]],
  ['UpperArm_L', 'Chest', [0.17, 1.1, 0]],
  ['Forearm_L', 'UpperArm_L', [0.235, 0.9, 0]],
  ['Hand_L', 'Forearm_L', [0.25, 0.705, 0.04]],
  ['UpperArm_R', 'Chest', [-0.17, 1.1, 0]],
  ['Forearm_R', 'UpperArm_R', [-0.24, 0.9, 0]],
  ['Hand_R', 'Forearm_R', [-0.255, 0.705, 0.04]],
  ['Thigh_L', 'Hips', [0.08, 0.63, 0]],
  ['Shin_L', 'Thigh_L', [0.085, 0.38, 0]],
  ['Foot_L', 'Shin_L', [0.095, 0.12, 0]],
  ['Thigh_R', 'Hips', [-0.08, 0.63, 0]],
  ['Shin_R', 'Thigh_R', [-0.085, 0.38, 0]],
  ['Foot_R', 'Shin_R', [-0.095, 0.12, 0]],
];
const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));

export function makeSkeleton() {
  const bones = [], byName = {};
  for (const [name, parent, pos] of BONES) {
    const b = new THREE.Bone(); b.name = name;
    const pp = parent ? BONES[BI[parent]][2] : [0, 0, 0];
    b.position.set(pos[0] - pp[0], pos[1] - pp[1], pos[2] - pp[2]);
    if (parent) byName[parent].add(b);
    bones.push(b); byName[name] = b;
  }
  bones[0].updateMatrixWorld(true); // as inversas do esqueleto usam a pose de repouso já calculada
  return { bones, byName, skeleton: new THREE.Skeleton(bones) };
}

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// pesos por regras de altura/lado (membros retos e pendurados), depois suavizados
export function skinWeights(g) {
  const p = g.attributes.position, n = p.count;
  const W = Array.from({ length: n }, () => new Map());
  const add = (i, b, w) => { if (w > 1e-4) W[i].set(BI[b], (W[i].get(BI[b]) || 0) + w); };
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(x);
    const L = x > 0 ? '_L' : '_R';
    // braço: fora da linha do tronco (ombro com transição suave)
    let arm = 0;
    if (y > 0.53 && y < 1.21) {
      const hand = y < 0.703 && (x < -0.203 || x > 0.2 || (x > 0.158 && z > 0.07));
      if (hand) arm = 1;
      else if (y < 1.0) arm = ss(0.183, 0.197, ax);
      else arm = ss(0.13, 0.2, ax) * (1 - ss(1.14, 1.21, y)) * (z > -0.14 ? 1 : 0);
    }
    const legZone = y < 0.7 && arm < 1;
    let rest = 1 - arm;
    if (arm > 0) {
      const up = ss(0.87, 0.93, y), hd = 1 - ss(0.69, 0.72, y);
      const fore = (1 - up) * (1 - hd);
      add(i, 'UpperArm' + L, arm * up); add(i, 'Forearm' + L, arm * fore); add(i, 'Hand' + L, arm * hd);
    }
    if (rest <= 0) continue;
    if (y > 1.21) { const h = ss(1.2, 1.25, y); add(i, 'Head', rest * h); add(i, 'Neck', rest * (1 - h)); continue; }
    if (z < -0.14 && y > 0.78 && y < 1.2 && ax < 0.2) { add(i, 'Chest', rest); continue; } // mochila
    if (legZone) {
      // perna: coxa / canela / pé, com transição para o quadril no alto
      const leg = 1 - ss(0.55, 0.69, y);
      const side = ss(-0.03, 0.03, x); // 0 = direita, 1 = esquerda
      const knee = ss(0.35, 0.41, y), ankle = ss(0.1, 0.15, y);
      const thigh = knee, shin = (1 - knee) * ankle, foot = 1 - ankle;
      for (const [s, ws] of [['_L', side], ['_R', 1 - side]]) {
        add(i, 'Thigh' + s, rest * leg * ws * thigh); add(i, 'Shin' + s, rest * leg * ws * shin); add(i, 'Foot' + s, rest * leg * ws * foot);
      }
      rest *= 1 - leg;
    }
    if (rest <= 0) continue;
    // tronco: quadril / coluna / peito / pescoço
    const s1 = ss(0.72, 0.8, y), s2 = ss(0.93, 1.01, y), s3 = ss(1.15, 1.2, y);
    add(i, 'Hips', rest * (1 - s1)); add(i, 'Spine', rest * s1 * (1 - s2)); add(i, 'Chest', rest * s2 * (1 - s3)); add(i, 'Neck', rest * s3);
  }
  // suavização dos pesos entre vizinhos (menos a cabeça, que é rígida)
  const idx = g.index.array, nb = Array.from({ length: n }, () => []);
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; nb[a].push(b, c); nb[b].push(a, c); nb[c].push(a, b); }
  // só mistura pesos de ossos da mesma cadeia (mão não puxa bolso, perna esquerda não puxa a direita)
  const G = [['UpperArm_L', 'Forearm_L', 'Hand_L', 'Chest'], ['UpperArm_R', 'Forearm_R', 'Hand_R', 'Chest'],
    ['Thigh_L', 'Shin_L', 'Foot_L', 'Hips'], ['Thigh_R', 'Shin_R', 'Foot_R', 'Hips'], ['Hips', 'Spine', 'Chest', 'Neck', 'Head']].map(a => new Set(a.map(b => BI[b])));
  const allowed = m => { let best = -1, bv = -1; for (const [k, v] of m) if (v > bv) { bv = v; best = k; } const s = new Set(); for (const g2 of G) if (g2.has(best)) for (const b of g2) s.add(b); return s; };
  let cur = W;
  for (let it = 0; it < 3; it++) {
    cur = cur.map((m, i) => {
      if (p.getY(i) > 1.26) return m;
      const ok = allowed(m);
      const acc = new Map(); for (const [k, v] of m) acc.set(k, v * 2);
      for (const j of nb[i]) for (const [k, v] of cur[j]) if (ok.has(k)) acc.set(k, (acc.get(k) || 0) + v / nb[i].length * 2);
      return acc;
    });
  }
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const top = [...cur[i]].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tot = top.reduce((s, e) => s + e[1], 0) || 1;
    top.forEach(([k, v], j) => { si[i * 4 + j] = k; sw[i * 4 + j] = v / tot; });
    if (!top.length) { si[i * 4] = BI.Hips; sw[i * 4] = 1; }
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
}

// ---------------- animações (amostradas a 30 quadros por segundo)
const FPS = 30;
function clip(name, dur, fn, loop = true) {
  const n = Math.round(dur * FPS) + 1;
  const tracks = {}, hipsPos = [], times = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let f = 0; f < n; f++) {
    const t = f / FPS, k = loop ? (t / dur) * Math.PI * 2 : t / dur;
    const pose = fn(k, t);
    times.push(t);
    for (const [b] of BONES) {
      const r = pose[b] || [0, 0, 0];
      q.setFromEuler(e.set(r[0], r[1], r[2], 'XYZ'));
      (tracks[b] = tracks[b] || []).push(q.x, q.y, q.z, q.w);
    }
    const hp = pose.hipsPos || [0, 0, 0];
    hipsPos.push(hp[0], 0.66 + hp[1], hp[2]);
  }
  const list = BONES.map(([b]) => new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, tracks[b]));
  list.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipsPos));
  return new THREE.AnimationClip(name, dur, list);
}
const env = (k, a, b) => ss(0, a, k) * (1 - ss(1 - b, 1, k));

export function makeClips() {
  const idle = clip('Idle', 3, k => {
    const b = Math.sin(k), b2 = Math.sin(k * 2);
    return {
      Spine: [0.015 * b, 0, 0], Chest: [0.02 * b, 0, 0], Neck: [0, 0.05 * Math.sin(k + 1), 0], Head: [0.02 * b2, 0.04 * Math.sin(k), 0.015 * b],
      UpperArm_L: [0.03 * b, 0, 0.06 + 0.02 * b], UpperArm_R: [0.03 * b, 0, -0.06 - 0.02 * b],
      Forearm_L: [-0.12, 0, 0], Forearm_R: [-0.12, 0, 0], hipsPos: [0, 0.004 * b2, 0],
    };
  });
  const gait = (name, dur, A, K, lean, arm, bob) => clip(name, dur, k => {
    const s = Math.sin(k), c = Math.cos(k);
    return {
      Hips: [0, s * 0.08, 0], Spine: [lean * 0.5, -s * 0.06, 0], Chest: [lean * 0.5, -s * 0.08, 0], Head: [-lean * 0.6, s * 0.05, 0],
      Thigh_L: [-s * A, 0, 0], Thigh_R: [s * A, 0, 0],
      Shin_L: [Math.max(0, c) * K + 0.05, 0, 0], Shin_R: [Math.max(0, -c) * K + 0.05, 0, 0],
      Foot_L: [-Math.max(0, c) * K * 0.3 + s * 0.15, 0, 0], Foot_R: [-Math.max(0, -c) * K * 0.3 - s * 0.15, 0, 0],
      UpperArm_L: [s * arm, 0, 0.08], UpperArm_R: [-s * arm, 0, -0.08],
      Forearm_L: [-0.25 - lean * 3, 0, 0], Forearm_R: [-0.25 - lean * 3, 0, 0],
      hipsPos: [0, Math.abs(Math.cos(k)) * bob - bob * 0.5, 0],
    };
  });
  const walk = gait('Andar', 1.0, 0.5, 0.75, 0.03, 0.45, 0.025);
  const run = gait('Correr', 0.62, 0.85, 1.35, 0.18, 0.8, 0.05);
  const jump = clip('Pular', 0.9, k => {
    const crouch = env(k, 0.18, 0.2) * (1 - Math.sin(Math.PI * ss(0.2, 0.8, k)));
    const up = Math.sin(Math.PI * ss(0.2, 0.8, k));
    return {
      Thigh_L: [-0.4 * up - 0.5 * crouch, 0, 0], Thigh_R: [-0.2 * up - 0.5 * crouch, 0, 0],
      Shin_L: [0.9 * up + 0.9 * crouch, 0, 0], Shin_R: [0.6 * up + 0.9 * crouch, 0, 0],
      Foot_L: [-0.3 * crouch, 0, 0], Foot_R: [-0.3 * crouch, 0, 0],
      Spine: [0.15 * crouch - 0.05 * up, 0, 0],
      UpperArm_L: [-0.7 * up, 0, 0.35 * up], UpperArm_R: [-1.2 * up, 0, -0.35 * up],
      Forearm_L: [-0.4 * up, 0, 0], Forearm_R: [-0.3 * up, 0, 0],
      hipsPos: [0, 0.3 * up - 0.1 * crouch, 0],
    };
  }, false);
  const interact = clip('Interagir', 1.3, k => {
    const e = env(k, 0.25, 0.25);
    return {
      Thigh_L: [-0.9 * e, 0, 0.08 * e], Shin_L: [1.5 * e, 0, 0], Foot_L: [-0.6 * e, 0, 0],
      Thigh_R: [-0.25 * e, 0, -0.05 * e], Shin_R: [1.2 * e, 0, 0], Foot_R: [-0.4 * e, 0, 0],
      Spine: [0.35 * e, 0, 0], Chest: [0.2 * e, 0, 0], Head: [0.15 * e, 0, 0],
      UpperArm_R: [-0.9 * e, 0, -0.1 * e], Forearm_R: [-0.3 * e, 0, 0],
      UpperArm_L: [-0.3 * e, 0, 0.15], Forearm_L: [-0.6 * e, 0, 0],
      hipsPos: [0, -0.16 * e, -0.04 * e],
    };
  }, false);
  const point = clip('Apontar', 1.5, k => {
    const e = env(k, 0.15, 0.2);
    return {
      UpperArm_R: [-1.35 * e, 0.2 * e, -0.1], Forearm_R: [-0.08 * e, 0, 0],
      UpperArm_L: [0.05 * e, 0, 0.12 * e], Forearm_L: [-0.3 * e, 0, 0],
      Chest: [0, -0.2 * e, 0], Head: [0, -0.25 * e, 0],
    };
  }, false);
  const attack = clip('Atacar', 0.65, k => {
    const back = k < 0.4 ? Math.sin(Math.PI * ss(0, 0.4, k) * 0.5) : 1 - ss(0.4, 0.55, k);
    const fwd = Math.sin(Math.PI * ss(0.4, 1, k));
    return {
      UpperArm_R: [-1.8 * back - 1.2 * fwd, 0, -0.25 * back], Forearm_R: [-0.9 * back - 0.1 * fwd, 0, 0],
      Chest: [0.1 * fwd, 0.35 * back - 0.3 * fwd, 0], Spine: [0, 0.15 * back - 0.15 * fwd, 0],
      Thigh_L: [-0.35 * (back + fwd) * 0.6, 0, 0], Shin_L: [0.3 * fwd, 0, 0],
    };
  }, false);
  const wave = clip('Acenar', 1.6, k => {
    const e = env(k, 0.15, 0.2), w = Math.sin(k * Math.PI * 8);
    return { UpperArm_L: [-0.35 * e, 0, 1.55 * e], Forearm_L: [-0.2 * e, 0, 0.9 * e + 0.35 * w * e], Head: [0, 0, -0.1 * e] };
  }, false);
  return [idle, walk, run, jump, interact, point, attack, wave];
}

// Remove triângulos que ligam partes que se movem separadamente (ex.: mão colada
// no bolso, manga colada na jaqueta): sem isso eles viram "lençóis" esticados.
export function cutBridges(g) {
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count;
  const dom = new Int16Array(n);
  for (let i = 0; i < n; i++) { let b = 0, w = -1; for (let k = 0; k < 4; k++) { const ww = sw.getComponent(i, k); if (ww > w) { w = ww; b = si.getComponent(i, k); } } dom[i] = b; }
  const G = [['UpperArm_L', 'Forearm_L', 'Hand_L', 'Chest', 'Neck'], ['UpperArm_R', 'Forearm_R', 'Hand_R', 'Chest', 'Neck'],
    ['Thigh_L', 'Shin_L', 'Foot_L', 'Hips'], ['Thigh_R', 'Shin_R', 'Foot_R', 'Hips'], ['Hips', 'Spine', 'Chest', 'Neck', 'Head']].map(a => new Set(a.map(b => BI[b])));
  const ok = (a, b) => a === b || G.some(s => s.has(a) && s.has(b));
  const idx = g.index.array, keep = [];
  let cut = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = dom[idx[t]], b = dom[idx[t + 1]], c = dom[idx[t + 2]];
    if (ok(a, b) && ok(b, c) && ok(a, c)) keep.push(idx[t], idx[t + 1], idx[t + 2]); else cut++;
  }
  return { keep, cut };
}
