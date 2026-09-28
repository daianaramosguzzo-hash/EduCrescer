// Animações feitas por código. Produzem uma "pose": rotações (em radianos, no
// espaço do personagem, que olha para +Z) de cada articulação.
//   x: + dobra para trás (braços e pernas penduradas) / + inclina para frente (tronco e cabeça)
//   y: torção · z: abertura lateral (braço direito fica em -X)
// A mesma pose serve para o modelo feito em código e para o modelo GLB do Arthur.
import { clamp, smooth } from '../core/util.js';

export const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];

export function emptyPose() {
  const p = { root: { py: 0, rx: 0, rz: 0, pz: 0 } };
  for (const j of JOINTS) p[j] = { x: 0, y: 0, z: 0 };
  return p;
}
function clearPose(p) {
  p.root.py = p.root.rx = p.root.rz = p.root.pz = 0;
  for (const j of JOINTS) { const q = p[j]; q.x = q.y = q.z = 0; }
}
const add = (p, j, x = 0, y = 0, z = 0, w = 1) => { const q = p[j]; q.x += x * w; q.y += y * w; q.z += z * w; };

// ------------------------------------------------------------------
// Locomoção (só para modelos feitos em código; o GLB usa as animações dele)
function locoHuman(p, ph, sp, t, style) {
  // sp: 0 parado · 1 andando · 2 correndo
  const walk = clamp(sp, 0, 1), run = clamp(sp - 1, 0, 1);
  const s = Math.sin(ph), c = Math.cos(ph);
  const ampL = 0.5 + run * 0.45, ampA = 0.4 + run * 0.5;
  // pernas
  add(p, 'thighL', -s * ampL * walk); add(p, 'thighR', s * ampL * walk);
  add(p, 'shinL', (0.1 + Math.max(0, c) * (0.7 + run * 0.6)) * walk);
  add(p, 'shinR', (0.1 + Math.max(0, -c) * (0.7 + run * 0.6)) * walk);
  add(p, 'footL', -0.1 * s * walk); add(p, 'footR', 0.1 * s * walk);
  // braços (menos se estiver segurando algo)
  const armK = style === 'none' ? 1 : style === 'melee' ? 0.6 : 0.25;
  add(p, 'armL', s * ampA * walk * (style === 'rifle' || style === 'bow' ? 0.2 : 1)); add(p, 'armR', -s * ampA * walk * armK);
  add(p, 'foreL', (-0.25 - run * 1.0) * walk); add(p, 'foreR', (-0.25 - run * 1.0) * walk * (style === 'none' ? 1 : 0.4));
  // corpo
  p.root.py += -Math.abs(Math.sin(ph)) * (0.035 + run * 0.05) * walk + (run * 0.02);
  add(p, 'spine', 0.05 * walk + run * 0.22, s * 0.08 * walk);
  add(p, 'chest', 0, -s * 0.12 * walk);
  add(p, 'head', -run * 0.12);
  // respiração parado
  const idle = 1 - walk;
  add(p, 'chest', Math.sin(t * 1.8) * 0.025 * idle);
  add(p, 'armL', 0, 0, 0.08 * idle + Math.sin(t * 1.8) * 0.02 * idle);
  add(p, 'armR', 0, 0, -0.08 * idle - Math.sin(t * 1.8) * 0.02 * idle);
  add(p, 'head', Math.sin(t * 0.7) * 0.03 * idle, Math.sin(t * 0.4) * 0.12 * idle);
}

function locoZombie(p, ph, sp, t, look, seed) {
  const walk = clamp(sp, 0, 1), run = clamp(sp - 1, 0, 1);
  const s = Math.sin(ph), c = Math.cos(ph);
  const hunch = look.hunch ?? 0.3;
  // corcunda e cabeça caída
  add(p, 'spine', hunch * 0.6 + run * 0.35, 0, Math.sin(t * 0.9 + seed) * 0.05);
  add(p, 'chest', hunch * 0.3);
  add(p, 'head', -0.2 - run * 0.2, Math.sin(t * 0.6 + seed) * 0.25, 0.25 + Math.sin(t * 1.3 + seed) * 0.1);
  // braços esticados para frente, balançando
  const reach = run ? 0.5 : 1.1 + Math.sin(seed) * 0.3;
  add(p, 'armL', -reach + Math.sin(t * 2.1 + seed) * 0.12 + s * 0.2 * walk, 0, 0.15);
  add(p, 'armR', -reach * (0.7 + (seed % 1) * 0.5) + Math.sin(t * 1.7 + seed * 2) * 0.12 - s * 0.2 * walk, 0, -0.15);
  add(p, 'foreL', -0.35); add(p, 'foreR', -0.5);
  add(p, 'handL', 0.3); add(p, 'handR', 0.3);
  if (run) { add(p, 'armL', s * 1.1 * run); add(p, 'armR', -s * 1.1 * run); add(p, 'foreL', -0.8 * run); add(p, 'foreR', -0.8 * run); }
  // passos arrastados (uma perna manca)
  const ampL = 0.35 + run * 0.6;
  add(p, 'thighL', -s * ampL * walk); add(p, 'thighR', s * ampL * 0.75 * walk);
  add(p, 'shinL', (0.15 + Math.max(0, c) * (0.5 + run)) * walk + 0.08);
  add(p, 'shinR', (0.1 + Math.max(0, -c) * (0.35 + run)) * walk + 0.05);
  add(p, 'footR', 0.15 * walk);
  p.root.py += -Math.abs(s) * (0.04 + run * 0.05) * walk - 0.02;
  p.root.rz += Math.sin(ph) * 0.05 * walk;
  // parado: balança o corpo
  const idle = 1 - walk;
  add(p, 'spine', 0, 0, Math.sin(t * 0.8 + seed) * 0.06 * idle);
  p.root.rz += Math.sin(t * 0.8 + seed) * 0.03 * idle;
}

// pose de "carregar" a arma quando parado/andando (sobrepõe os braços)
function carryPose(p, style, w) {
  if (style === 'pistol') {
    add(p, 'armR', -0.35, 0, -0.1, w); add(p, 'foreR', -0.9, 0, 0, w); add(p, 'handR', 0.5, 0, 0, w);
  } else if (style === 'rifle') {
    add(p, 'armR', -0.3, 0, -0.2, w); add(p, 'foreR', -1.5, 0.3, 0, w);
    add(p, 'armL', -0.9, 0, 0.1, w); add(p, 'foreL', -1.1, -0.4, 0, w);
    add(p, 'chest', 0, -0.25, 0, w);
  } else if (style === 'bow') {
    add(p, 'armL', -0.3, 0, 0.05, w); add(p, 'foreL', -0.6, 0, 0, w);
  } else if (style === 'melee') {
    add(p, 'foreR', -0.35, 0, 0, w); add(p, 'handR', 0.1, 0, 0, w);
  }
}

// ------------------------------------------------------------------
// Ações. fn(p, k, o, w): k vai de 0 a 1 ao longo da duração.
const env = (k, a = 0.08, b = 0.18) => Math.min(smooth(0, a, k), 1 - smooth(1 - b, 1, k));
export const ACTIONS = {
  // golpe diagonal (taco, machado, facão, cano)
  swing: { dur: 0.62, hit: 0.46, fn(p, k, o, w) {
    const up = smooth(0, 0.38, k) * (1 - smooth(0.4, 0.55, k));
    const down = smooth(0.38, 0.52, k) * (1 - smooth(0.7, 1, k));
    add(p, 'armR', -2.3 * up - 0.9 * down, 0, -0.35 * up + 0.1 * down, w);
    add(p, 'foreR', -1.0 * up - 0.1 * down, 0, 0, w);
    add(p, 'handR', -0.3 * up + 0.9 * down, 0, 0, w);
    add(p, 'armL', -0.6 * up - 0.3 * down, 0, 0.3 * up, w);
    add(p, 'chest', -0.1 * up + 0.2 * down, 0.45 * up - 0.45 * down, 0, w);
    add(p, 'spine', 0.2 * down, 0.15 * up - 0.2 * down, 0, w);
    add(p, 'thighL', -0.3 * down, 0, 0, w); add(p, 'shinL', 0.3 * down, 0, 0, w);
    p.root.py -= 0.04 * down * w;
  } },
  // estocada (faca, lança)
  stab: { dur: 0.48, hit: 0.4, fn(p, k, o, w) {
    const back = smooth(0, 0.3, k) * (1 - smooth(0.3, 0.42, k));
    const fwd = smooth(0.3, 0.42, k) * (1 - smooth(0.6, 1, k));
    add(p, 'armR', 0.25 * back - 1.45 * fwd, 0, -0.1, w);
    add(p, 'foreR', -1.7 * back - 0.05 * fwd, 0, 0, w);
    add(p, 'handR', 0.3 * back + 1.2 * fwd, 0, 0, w);
    add(p, 'chest', 0, 0.35 * back - 0.35 * fwd, 0, w);
    add(p, 'spine', 0.2 * fwd, 0, 0, w);
    add(p, 'thighL', -0.4 * fwd, 0, 0, w); add(p, 'shinL', 0.35 * fwd, 0, 0, w);
    add(p, 'armL', -0.3 * fwd, 0, 0.2, w);
    p.root.pz += 0.12 * fwd * w;
  } },
  punch: { dur: 0.42, hit: 0.32, fn(p, k, o, w) {
    const left = o.alt;
    const back = smooth(0, 0.22, k) * (1 - smooth(0.22, 0.32, k));
    const fwd = smooth(0.22, 0.32, k) * (1 - smooth(0.5, 1, k));
    const A = left ? 'armL' : 'armR', F = left ? 'foreL' : 'foreR', sgn = left ? -1 : 1;
    add(p, A, 0.2 * back - 1.5 * fwd, 0, 0, w); add(p, F, -1.9 * back - 0.15 * fwd, 0, 0, w);
    add(p, left ? 'armR' : 'armL', -0.6, 0, 0, w); add(p, left ? 'foreR' : 'foreL', -1.8, 0, 0, w);
    add(p, 'chest', 0, sgn * (0.3 * back - 0.4 * fwd), 0, w);
    p.root.pz += 0.08 * fwd * w;
  } },
  // tiros (a pose de mira fica enquanto "aim" > 0)
  pistol: { dur: 0.3, hit: 0.02, fn(p, k, o, w) {
    const rec = 1 - smooth(0, 0.6, k);
    add(p, 'armR', -1.5 - 0.35 * rec, 0.1, -0.05, w); add(p, 'foreR', 0.05 - 0.2 * rec, 0, 0, w); add(p, 'handR', 0, 0, 0, w);
    add(p, 'armL', -1.3, -0.3, 0, w); add(p, 'foreL', -0.4, 0, 0, w);
    add(p, 'chest', -0.05 * rec, -0.1, 0, w); add(p, 'head', -0.05 * rec, 0, 0, w);
  } },
  rifle: { dur: 0.45, hit: 0.02, fn(p, k, o, w) {
    const rec = 1 - smooth(0, 0.5, k);
    add(p, 'armR', -1.0 + 0.15 * rec, 0.2, -0.35, w); add(p, 'foreR', -1.2, 0.2, 0, w); add(p, 'handR', 0.55, 0, 0, w);
    add(p, 'armL', -1.4, -0.4, 0.1, w); add(p, 'foreL', -0.35, 0, 0, w);
    add(p, 'chest', -0.12 * rec, -0.15, 0, w); add(p, 'spine', -0.06 * rec, 0, 0, w);
    p.root.pz -= 0.06 * rec * w;
  } },
  bow: { dur: 0.7, hit: 0.55, fn(p, k, o, w) {
    const draw = smooth(0.05, 0.5, k) * (1 - smooth(0.6, 0.7, k));
    add(p, 'armL', -1.55, 0.35, 0, w); add(p, 'foreL', 0, 0, 0, w);
    add(p, 'armR', -1.45, 0.4 * draw, -0.2, w); add(p, 'foreR', -0.6 - 1.6 * draw, 0, 0, w);
    add(p, 'chest', 0, 0.4, 0, w); add(p, 'head', 0, -0.35, 0, w);
  } },
  // coleta
  chop: { dur: 0.75, hit: 0.5, fn(p, k, o, w) {
    const back = smooth(0, 0.42, k) * (1 - smooth(0.42, 0.55, k));
    const hit = smooth(0.42, 0.55, k) * (1 - smooth(0.65, 1, k));
    add(p, 'armR', -1.3 - 0.5 * back + 0.2 * hit, 0, -0.5 * back, w); add(p, 'foreR', -0.9 * back - 0.2, 0, 0, w);
    add(p, 'armL', -1.2 - 0.3 * back, 0, 0.3, w); add(p, 'foreL', -0.9, 0, 0, w);
    add(p, 'handR', 0.4 * hit + 0.2, 0, 0, w);
    add(p, 'chest', 0, 0.75 * back - 0.45 * hit, 0, w); add(p, 'spine', 0.15, 0.25 * back - 0.2 * hit, 0, w);
    add(p, 'thighL', -0.25, 0, 0, w); add(p, 'shinL', 0.2, 0, 0, w); add(p, 'thighR', 0.15, 0, 0, w);
  } },
  mine: { dur: 0.8, hit: 0.55, fn(p, k, o, w) {
    const up = smooth(0, 0.45, k) * (1 - smooth(0.45, 0.58, k));
    const dn = smooth(0.45, 0.58, k) * (1 - smooth(0.7, 1, k));
    add(p, 'armR', -2.5 * up - 1.0 * dn, 0, -0.2, w); add(p, 'foreR', -0.8 * up - 0.1 * dn, 0, 0, w);
    add(p, 'armL', -2.3 * up - 1.0 * dn, 0, 0.2, w); add(p, 'foreL', -0.8 * up - 0.2 * dn, 0, 0, w);
    add(p, 'handR', -0.3 * up + 0.8 * dn, 0, 0, w);
    add(p, 'spine', -0.15 * up + 0.45 * dn, 0, 0, w); add(p, 'head', 0.2 * dn, 0, 0, w);
    add(p, 'thighL', -0.3, 0, 0, w); add(p, 'shinL', 0.3, 0, 0, w);
    p.root.py -= 0.06 * dn * w;
  } },
  pick: { dur: 0.8, hit: 0.5, fn(p, k, o, w) {
    const e = env(k, 0.35, 0.35);
    add(p, 'spine', 0.75 * e, 0, 0, w); add(p, 'chest', 0.25 * e, 0, 0, w); add(p, 'head', -0.3 * e, 0, 0, w);
    add(p, 'thighL', -1.0 * e, 0, 0, w); add(p, 'shinL', 1.5 * e, 0, 0, w); add(p, 'footL', -0.5 * e, 0, 0, w);
    add(p, 'thighR', -0.5 * e, 0, 0, w); add(p, 'shinR', 1.3 * e, 0, 0, w); add(p, 'footR', -0.8 * e, 0, 0, w);
    add(p, 'armR', -0.9 * e, 0, 0, w); add(p, 'foreR', -0.3 * e, 0, 0, w);
    add(p, 'armL', -0.3 * e, 0, 0.2, w);
    p.root.py -= 0.3 * e * w;
  } },
  pickHigh: { dur: 0.9, hit: 0.55, fn(p, k, o, w) {
    const e = env(k, 0.35, 0.35);
    add(p, 'armR', -2.6 * e, 0, -0.2, w); add(p, 'foreR', -0.3 * e, 0, 0, w);
    add(p, 'armL', -2.0 * e, 0, 0.3, w); add(p, 'foreL', -0.6 * e, 0, 0, w);
    add(p, 'head', -0.45 * e, 0, 0, w); add(p, 'spine', -0.1 * e, 0, 0, w);
    add(p, 'footL', 0.3 * e, 0, 0, w); add(p, 'footR', 0.3 * e, 0, 0, w);
    p.root.py += 0.04 * e * w;
  } },
  search: { dur: 1.2, hit: 0.9, fn(p, k, o, w) {
    const e = env(k, 0.15, 0.15), r = Math.sin(k * 26);
    add(p, 'spine', 0.4 * e, 0, 0, w); add(p, 'head', 0.1 * e, 0, 0, w);
    add(p, 'armR', (-1.1 + 0.25 * r) * e, 0, 0, w); add(p, 'foreR', (-0.6 - 0.3 * r) * e, 0, 0, w);
    add(p, 'armL', (-1.1 - 0.25 * r) * e, 0, 0, w); add(p, 'foreL', (-0.6 + 0.3 * r) * e, 0, 0, w);
    add(p, 'thighL', -0.3 * e, 0, 0, w); add(p, 'shinL', 0.4 * e, 0, 0, w); add(p, 'shinR', 0.3 * e, 0, 0, w);
    p.root.py -= 0.06 * e * w;
  } },
  interact: { dur: 0.55, hit: 0.35, fn(p, k, o, w) {
    const e = env(k, 0.3, 0.4);
    add(p, 'armR', -1.35 * e, 0, 0, w); add(p, 'foreR', -0.2 * e, 0, 0, w); add(p, 'spine', 0.1 * e, 0, 0, w);
  } },
  build: { dur: 1.1, hit: 0.9, fn(p, k, o, w) {
    const e = env(k, 0.15, 0.15), h = Math.max(0, Math.sin(k * 30));
    add(p, 'armR', (-1.3 - 0.5 * h) * e, 0, 0, w); add(p, 'foreR', (-0.9 + 0.6 * h) * e, 0, 0, w);
    add(p, 'armL', -1.0 * e, 0, 0.2, w); add(p, 'foreL', -0.4 * e, 0, 0, w);
    add(p, 'spine', 0.35 * e, 0, 0, w);
    add(p, 'thighL', -0.6 * e, 0, 0, w); add(p, 'shinL', 0.9 * e, 0, 0, w); add(p, 'shinR', 0.6 * e, 0, 0, w);
    p.root.py -= 0.15 * e * w;
  } },
  eat: { dur: 1.3, hit: 1, fn(p, k, o, w) {
    const e = env(k, 0.2, 0.2), chew = Math.sin(k * 30) * 0.05;
    add(p, 'armR', -0.55 * e, 0, -0.15 * e, w); add(p, 'foreR', -2.3 * e, 0.3 * e, 0, w); add(p, 'handR', -0.3 * e, 0, 0, w);
    add(p, 'head', (0.12 + chew) * e, 0, 0, w);
  } },
  drink: { dur: 1.4, hit: 1, fn(p, k, o, w) {
    const e = env(k, 0.2, 0.2);
    add(p, 'armR', -0.9 * e, 0, -0.15 * e, w); add(p, 'foreR', -2.2 * e, 0.3 * e, 0, w); add(p, 'handR', -0.6 * e, 0, 0, w);
    add(p, 'head', -0.5 * e, 0, 0, w); add(p, 'chest', -0.12 * e, 0, 0, w);
  } },
  heal: { dur: 1.2, hit: 1, fn(p, k, o, w) {
    const e = env(k, 0.2, 0.2), r = Math.sin(k * 20) * 0.2;
    add(p, 'armL', -0.6 * e, 0, 0, w); add(p, 'foreL', -1.2 * e, 0, 0, w);
    add(p, 'armR', (-0.7 + r) * e, 0.3 * e, 0, w); add(p, 'foreR', -1.4 * e, 0, 0, w);
    add(p, 'head', 0.4 * e, 0, 0, w); add(p, 'spine', 0.15 * e, 0, 0, w);
  } },
  equip: { dur: 0.5, hit: 0.5, fn(p, k, o, w) {
    const back = Math.sin(Math.PI * k);
    add(p, 'armR', 0.5 * back, 0, -0.3 * back, w); add(p, 'foreR', -1.8 * back, 0, 0, w); add(p, 'chest', 0, 0.25 * back, 0, w);
  } },
  hurt: { dur: 0.35, hit: 1, fn(p, k, o, w) {
    const e = Math.sin(Math.PI * Math.min(1, k * 1.3));
    add(p, 'spine', -0.3 * e, 0, (o.side || 0.2) * e, w); add(p, 'head', -0.35 * e, 0, 0, w);
    add(p, 'armL', -0.3 * e, 0, 0.4 * e, w); add(p, 'armR', -0.3 * e, 0, -0.4 * e, w);
    p.root.pz -= 0.1 * e * w;
  } },
  wave: { dur: 1.6, hit: 1, fn(p, k, o, w) {
    const e = env(k, 0.15, 0.2);
    add(p, 'armR', -0.3 * e, 0, -2.4 * e, w); add(p, 'foreR', (-0.5 + Math.sin(k * 24) * 0.4) * e, 0, 0, w);
    add(p, 'head', 0, 0, 0.1 * e, w);
  } },
  // morte: cai de costas e fica no chão
  death: { dur: 1.1, hold: true, hit: 1, fn(p, k, o, w) {
    const f = smooth(0.1, 0.75, k), knee = Math.sin(Math.PI * Math.min(1, k * 1.4));
    const dir = o.forward ? 1 : -1;
    p.root.rx += dir * f * 1.5 * w; p.root.py += (-0.08 * knee + 0.1 * f) * w;
    add(p, 'thighL', -0.5 * knee - 0.2 * f, 0, 0.1 * f, w); add(p, 'shinL', 0.9 * knee + 0.2 * f, 0, 0, w);
    add(p, 'thighR', -0.3 * knee, 0, -0.15 * f, w); add(p, 'shinR', 0.6 * knee + 0.3 * f, 0, 0, w);
    add(p, 'armL', -0.5 * f, 0, 1.1 * f, w); add(p, 'armR', -0.3 * f, 0, -1.2 * f, w);
    add(p, 'foreL', -0.4 * f, 0, 0, w); add(p, 'foreR', -0.7 * f, 0, 0, w);
    add(p, 'head', -dir * 0.3 * f, 0.5 * f, 0, w);
  } },
  // levantar do chão (início do jogo)
  getup: { dur: 2.6, hit: 1, fn(p, k, o, w) {
    const f = 1 - smooth(0.25, 0.8, k), sit = Math.sin(Math.PI * smooth(0.2, 0.95, k));
    p.root.rx += -f * 1.5 * w; p.root.py += 0.1 * f * w - 0.25 * sit * w;
    add(p, 'thighL', -1.2 * sit, 0, 0, w); add(p, 'shinL', 1.6 * sit, 0, 0, w);
    add(p, 'thighR', -0.6 * sit - 0.3 * f, 0, 0, w); add(p, 'shinR', 1.2 * sit + 0.3 * f, 0, 0, w);
    add(p, 'spine', 0.6 * sit, 0, 0, w);
    add(p, 'armR', -0.4 * sit + 0.3 * f, 0, -0.6 * f, w); add(p, 'armL', -0.2 * sit, 0, 0.8 * f, w);
    add(p, 'head', 0.3 * sit + Math.sin(k * 9) * 0.1 * sit, Math.sin(k * 5) * 0.4 * sit, 0, w);
  } },
  // zumbis
  zattack: { dur: 0.9, hit: 0.62, fn(p, k, o, w) {
    const up = smooth(0, 0.5, k) * (1 - smooth(0.5, 0.65, k));
    const sw = smooth(0.5, 0.65, k) * (1 - smooth(0.75, 1, k));
    add(p, 'armL', -2.2 * up - 0.7 * sw, 0, 0.3 * up, w); add(p, 'armR', -2.4 * up - 0.5 * sw, 0, -0.3 * up, w);
    add(p, 'foreL', -0.6 * up, 0, 0, w); add(p, 'foreR', -0.6 * up, 0, 0, w);
    add(p, 'spine', -0.2 * up + 0.5 * sw, 0, 0, w); add(p, 'head', 0.3 * sw - 0.3 * up, 0, 0, w);
    p.root.pz += 0.25 * sw * w;
  } },
  // pancada no chão do chefe
  zslam: { dur: 1.4, hit: 0.7, fn(p, k, o, w) {
    const up = smooth(0, 0.6, k) * (1 - smooth(0.6, 0.72, k));
    const dn = smooth(0.6, 0.72, k) * (1 - smooth(0.85, 1, k));
    add(p, 'armL', -2.9 * up - 1.2 * dn, 0, 0.2, w); add(p, 'armR', -2.9 * up - 1.2 * dn, 0, -0.2, w);
    add(p, 'foreL', -0.5 * up, 0, 0, w); add(p, 'foreR', -0.5 * up, 0, 0, w);
    add(p, 'spine', -0.35 * up + 0.8 * dn, 0, 0, w);
    add(p, 'thighL', -0.5 * dn, 0, 0, w); add(p, 'shinL', 0.8 * dn, 0, 0, w); add(p, 'thighR', -0.3 * dn, 0, 0, w); add(p, 'shinR', 0.6 * dn, 0, 0, w);
    p.root.py += (0.1 * up - 0.2 * dn) * w;
  } },
  zscream: { dur: 1.0, hit: 1, fn(p, k, o, w) {
    const e = env(k, 0.2, 0.3);
    add(p, 'spine', -0.35 * e, 0, 0, w); add(p, 'head', -0.6 * e, 0, 0, w);
    add(p, 'armL', -0.4 * e, 0, 1.0 * e, w); add(p, 'armR', -0.4 * e, 0, -1.0 * e, w);
    add(p, 'foreL', -0.8 * e, 0, 0, w); add(p, 'foreR', -0.8 * e, 0, 0, w);
  } },
  zhurt: { dur: 0.4, hit: 1, fn(p, k, o, w) {
    const e = Math.sin(Math.PI * k);
    add(p, 'spine', -0.45 * e, 0, (o.side || 0.3) * e, w); add(p, 'head', -0.5 * e, 0.3 * e, 0, w);
    add(p, 'armL', 0.3 * e, 0, 0.5 * e, w); add(p, 'armR', 0.3 * e, 0, -0.5 * e, w);
    p.root.pz -= 0.18 * e * w;
  } },
};

// Controla locomoção + uma ação por vez + postura de arma
export class Animator {
  constructor({ kind = 'human', look = {}, loco = true } = {}) {
    this.kind = kind; this.look = look; this.loco = loco;
    this.pose = emptyPose();
    this.phase = Math.random() * 6; this.t = Math.random() * 10; this.seed = Math.random() * 10;
    this.speed = 0; // 0 parado, 1 andar, 2 correr
    this.action = null; this.style = 'none'; this.carry = 0;
    this.dead = false;
  }
  play(name, opts = {}) {
    const def = ACTIONS[name];
    if (!def) return null;
    const dur = (opts.dur || def.dur) / (opts.rate || 1);
    this.action = { name, def, t: 0, dur, o: opts, hitDone: false, loop: !!opts.loop };
    if (name === 'death') this.dead = true;
    return this.action;
  }
  stop() { if (this.action && !this.action.def.hold) this.action = null; }
  busy() { return !!this.action && !this.action.def.hold; }
  // devolve true no quadro em que o golpe "acerta"
  update(dt, moveSpeed) {
    this.t += dt;
    this.speed = moveSpeed;
    const cad = moveSpeed <= 0.05 ? 0 : moveSpeed <= 1 ? 7 * Math.max(0.6, moveSpeed) : 7 + (moveSpeed - 1) * 4.5;
    this.phase += dt * cad * (this.kind === 'zombie' ? (this.cadence || 0.8) : 1);
    const p = this.pose;
    clearPose(p);
    if (this.loco) {
      if (this.kind === 'zombie') locoZombie(p, this.phase, moveSpeed, this.t, this.look, this.seed);
      else locoHuman(p, this.phase, moveSpeed, this.t, this.style);
    }
    let hit = false;
    const a = this.action;
    let busyW = 0;
    if (a) {
      a.t += dt;
      let k = a.t / a.dur;
      if (a.def.hold) k = Math.min(1, k);
      if (!a.hitDone && k >= a.def.hit) { a.hitDone = true; hit = true; }
      if (k >= 1 && !a.def.hold) {
        if (a.loop) { a.t = 0; a.hitDone = false; k = 0; } else { this.action = null; }
      }
      if (this.action) {
        busyW = a.def.hold ? 1 : (a.loop ? 1 : 1);
        a.def.fn(p, Math.min(1, k), a.o, 1);
      }
    }
    // postura de arma quando não está atacando
    const wantCarry = (this.style !== 'none' && !this.dead) ? 1 : 0;
    this.carry += (wantCarry - this.carry) * Math.min(1, dt * 8);
    if (this.carry > 0.01 && !(a && this.action && ['pistol', 'rifle', 'bow', 'swing', 'stab', 'chop', 'mine'].includes(a.name))) carryPose(p, this.style, this.carry * (1 - busyW * 0.8));
    return hit;
  }
}
