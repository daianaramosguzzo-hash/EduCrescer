// Pintor procedural dos personagens em 2,5D.
// Cada personagem é um boneco 3D simples (esqueleto + roupas + volumes de cabelo)
// visto de cima em 8 direções e desenhado em estilo de desenho animado, com
// contorno escuro. As mesmas funções geram as texturas do jogo (bank.js) e as
// sprite sheets em PNG (tools/exportar-sprites.mjs).

export const INK = '#1d1520';
const TILT = 0.36;                       // inclinação da "câmera" do desenho
const CT = Math.cos(TILT), ST = Math.sin(TILT);
const PI = Math.PI, TAU = PI * 2;

// ---------------------------------------------------------------- utilidades
const shadeCache = new Map();
export function shade(hex, k) {
  const key = hex + '|' + k;
  let r = shadeCache.get(key);
  if (r) return r;
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  const n = parseInt(h, 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map(v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))));
  r = '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  shadeCache.set(key, r);
  return r;
}
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
// direção de um membro: pitch (0 = para baixo, +: para a frente), ab (para o lado)
function limbDir(pitch, ab) {
  const ca = Math.cos(ab);
  return [Math.sin(ab), -Math.cos(pitch) * ca, Math.sin(pitch) * ca];
}
function rotY(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

// ---------------------------------------------------------------- corpos (px na escala 1)
export const BODIES = {
  kid:    { headR: 16.5, headW: 1.0, headH: 1.02, neck: 3, neckW: 6.5, torsoLen: 26, shW: 10.5, tw: [10, 10, 9, 9.5], td: 6.5, belly: 0, hipW: 5, thigh: 15, shin: 14, footLen: 9, footH: 3.5, upper: 12, fore: 11, armT: 6.2, legT: 7, handR: 3.7 },
  woman:  { headR: 15.5, headW: 0.96, headH: 1.08, neck: 4.5, neckW: 6, torsoLen: 30, shW: 11, tw: [10.5, 10.5, 8.6, 10.5], td: 6.5, belly: 0, hipW: 5.2, thigh: 19, shin: 18, footLen: 10, footH: 3.4, upper: 14.5, fore: 13, armT: 6, legT: 7.6, handR: 3.5 },
  stocky: { headR: 15.5, headW: 1.02, headH: 1.05, neck: 3.5, neckW: 7, torsoLen: 30, shW: 12, tw: [12, 13, 12.5, 13], td: 8, belly: 1.5, hipW: 6, thigh: 17, shin: 16, footLen: 9.5, footH: 2.6, upper: 14, fore: 12.5, armT: 7.6, legT: 9, handR: 3.8 },
  man:    { headR: 15, headW: 1.0, headH: 1.06, neck: 4, neckW: 7.5, torsoLen: 32, shW: 12.5, tw: [12.5, 12.5, 11, 11.5], td: 7.5, belly: 0.5, hipW: 6, thigh: 18, shin: 17, footLen: 10.5, footH: 3.8, upper: 14.5, fore: 13, armT: 7.2, legT: 8.6, handR: 4 },
  big:    { headR: 16.5, headW: 1.05, headH: 1.08, neck: 3, neckW: 8, torsoLen: 33, shW: 13.5, tw: [13.5, 15, 16, 14.5], td: 9, belly: 5, hipW: 7, thigh: 18, shin: 17, footLen: 11, footH: 4, upper: 15, fore: 13.5, armT: 8.6, legT: 10, handR: 4.3 },
  thin:   { headR: 14.5, headW: 0.95, headH: 1.1, neck: 5, neckW: 5.5, torsoLen: 31, shW: 10.5, tw: [10, 9.5, 8, 8.5], td: 5.5, belly: 0, hipW: 5, thigh: 19, shin: 18.5, footLen: 10, footH: 3.4, upper: 15, fore: 13.5, armT: 5.2, legT: 6.2, handR: 3.3 },
  old:    { headR: 15, headW: 1.0, headH: 1.04, neck: 3, neckW: 7, torsoLen: 29, shW: 11.5, tw: [11.5, 12, 12.5, 12], td: 8, belly: 2.5, hipW: 5.8, thigh: 16, shin: 15, footLen: 10, footH: 3.4, upper: 13.5, fore: 12, armT: 6.6, legT: 8, handR: 3.7 },
  huge:   { headR: 14, headW: 1.1, headH: 1.0, neck: 2, neckW: 12, torsoLen: 36, shW: 19, tw: [19, 18, 15, 14], td: 11, belly: 1, hipW: 8, thigh: 18, shin: 17, footLen: 12, footH: 4.5, upper: 17, fore: 16, armT: 12.5, legT: 12, handR: 6.2 },
  bloat:  { headR: 14.5, headW: 1.08, headH: 1.0, neck: 2, neckW: 9, torsoLen: 32, shW: 13, tw: [14, 19, 22, 17], td: 13, belly: 10, hipW: 7, thigh: 15, shin: 15, footLen: 10, footH: 3.6, upper: 14, fore: 12.5, armT: 8, legT: 10, handR: 4.2 },
  boss:   { headR: 18, headW: 1.0, headH: 1.12, neck: 4, neckW: 9, torsoLen: 42, shW: 18, tw: [18, 17, 14, 15], td: 10, belly: 1, hipW: 8, thigh: 25, shin: 24, footLen: 13, footH: 4.5, upper: 22, fore: 21, armT: 9, legT: 11, handR: 6 },
};

// ---------------------------------------------------------------- animações
export const ANIMS = {
  idle:       { frames: 4, fps: 4, loop: true },
  walk:       { frames: 8, fps: 11, loop: true },
  run:        { frames: 6, fps: 13, loop: true },
  sneak:      { frames: 8, fps: 8, loop: true },
  crouch:     { frames: 2, fps: 2, loop: true },
  aim:        { frames: 2, fps: 3, loop: true },
  attack:     { frames: 6, fps: 14 },
  shoot:      { frames: 4, fps: 14 },
  hurt:       { frames: 3, fps: 10 },
  celebrate:  { frames: 6, fps: 8, loop: true },
  scared:     { frames: 4, fps: 10, loop: true },
  interact:   { frames: 4, fps: 8 },
  pickup:     { frames: 5, fps: 10 },
  eat:        { frames: 5, fps: 6 },
  medicine:   { frames: 5, fps: 6 },
  die:        { frames: 6, fps: 9 },
  dead:       { frames: 1, fps: 1 },
  vehicleIn:  { frames: 4, fps: 8 },
  vehicleOut: { frames: 4, fps: 8 },
};
// nome amigável de cada animação (para a galeria de sprites)
export const ANIM_LABEL = {
  idle: 'Parado', walk: 'Andando', run: 'Correndo', sneak: 'Esgueirando', crouch: 'Agachado',
  aim: 'Mirando', attack: 'Atacando', shoot: 'Usando arma', hurt: 'Recebendo dano',
  celebrate: 'Comemorando', scared: 'Assustado', interact: 'Interagindo', pickup: 'Pegando item',
  eat: 'Comendo', medicine: 'Medicamento', die: 'Morrendo', dead: 'Caído',
  vehicleIn: 'Entrando no veículo', vehicleOut: 'Saindo do veículo',
};
export const DIR_LABEL = ['Baixo', 'Baixo-direita', 'Direita', 'Cima-direita', 'Cima', 'Cima-esquerda', 'Esquerda', 'Baixo-esquerda'];

const MELEE_SWING = new Set(['bat', 'batpregos', 'pipe', 'axe', 'hammer', 'machete', 'crowbar']);
const LONG_GUN = new Set(['shotgun', 'rifle']);

function P0() {
  return {
    lean: 0, side: 0, twist: 0, air: 0, breath: 1, hx: 0, hz: 0,
    hy: 0, hp: 0, hr: 0,
    aL: { sw: 0.06, ab: 0.13, el: 0.22, inw: 0 },
    aR: { sw: 0.06, ab: 0.13, el: 0.22, inw: 0 },
    lL: { sw: 0, kn: 0, ab: 0.03, fp: 0 },
    lR: { sw: 0, kn: 0, ab: 0.03, fp: 0 },
    face: {}, wr: 1.2, wab: 0, whand: 'R', item: null,
    rot2d: 0, alpha: 1, scale: 1, lift: 0, muzzle: false,
  };
}
const S = Math.sin, C = Math.cos;

function holdPose(P, hold) {
  switch (hold) {
    case 'knife':
      P.aR.sw = 0.25; P.aR.el = 0.7; P.wr = 0.75; break;
    case 'bat': case 'batpregos': case 'pipe': case 'axe': case 'hammer': case 'machete': case 'crowbar':
      P.aR.sw = 0.2; P.aR.el = 1.95; P.aR.ab = 0.22; P.wr = 1.45; break;
    case 'pistol':
      P.aR.sw = 0.35; P.aR.el = 0.55; P.wr = 0.25; break;
    case 'shotgun': case 'rifle':
      P.aR.sw = 0.35; P.aR.el = 1.0; P.aR.ab = 0.08;
      P.aL.sw = 0.85; P.aL.el = 1.3; P.aL.inw = 0.95; P.wr = 1.0; P.wab = -0.75; break;
    case 'sling':
      P.aL.sw = 0.45; P.aL.el = 0.6; P.whand = 'L'; P.wr = 0.9; break;
    case 'megaphone':
      P.aR.sw = 0.3; P.aR.el = 0.6; P.wr = 0.7; break;
  }
}

function walkLegs(P, ph, amp, knee, lift = 0) {
  P.lL.sw = amp * S(ph); P.lL.kn = 0.06 + knee * Math.max(0, C(ph)) + lift;
  P.lR.sw = amp * S(ph + PI); P.lR.kn = 0.06 + knee * Math.max(0, C(ph + PI)) + lift;
  P.lL.fp = P.lL.sw > 0 ? 0.25 * P.lL.sw : 0.5 * P.lL.sw;
  P.lR.fp = P.lR.sw > 0 ? 0.25 * P.lR.sw : 0.5 * P.lR.sw;
}

// Pose de cada animação. t ∈ [0,1), f = índice do quadro.
export function poseFor(look, anim, f, hold = 'none') {
  const A = ANIMS[anim] || ANIMS.idle;
  const n = A.frames;
  const t = n > 1 ? f / n : 0;
  const ph = t * TAU;
  const gait = look.gait || 'human';
  const P = P0();
  if (look.pose) Object.assign(P.face, look.pose.face || {});
  const zombie = gait !== 'human';

  // ------ zumbis
  if (zombie && anim !== 'die' && anim !== 'dead') {
    P.face.eyes = look.face?.eyes || 'zombie';
    P.face.mouth = 'zombie';
    P.hr = 0.25; P.hp = 0.1;
    const armsUp = (P, k = 1) => {
      P.aL.sw = 1.25 * k; P.aL.el = 0.12; P.aL.ab = 0.05;
      P.aR.sw = 1.15 * k; P.aR.el = 0.2; P.aR.ab = 0.08;
    };
    if (gait === 'crawler') {
      P.lean = 1.05; P.hp = -0.5; P.hr = 0;
      const a = anim === 'walk' || anim === 'run' ? 0.35 : 0.05;
      P.lL.sw = 0.9 + a * S(ph); P.lL.kn = 1.9; P.lR.sw = 0.9 + a * S(ph + PI); P.lR.kn = 1.9;
      P.aL.sw = -0.25 + a * S(ph + PI); P.aL.el = 0.25; P.aR.sw = -0.25 + a * S(ph); P.aR.el = 0.25;
      if (anim === 'attack') { const k = [0, 0.6, 1, 1, 0.5, 0][f] || 0; P.lean = 1.05 - 0.6 * k; P.aL.sw = -0.2 + 1.6 * k; P.aR.sw = -0.2 + 1.7 * k; P.air = 6 * k; }
      if (anim === 'hurt') { P.lean = 0.7; P.hp = 0.3; }
      if (anim === 'eat') { P.aR.sw = 0.2 + 0.4 * S(ph); }
      return P;
    }
    if (anim === 'idle' || anim === 'aim' || anim === 'crouch') {
      armsUp(P, 0.8 + 0.06 * S(ph)); P.lean = 0.12; P.side = 0.05 * S(ph);
      if (gait === 'tank') { P.aL.sw = 0.35; P.aR.sw = 0.3; P.aL.ab = 0.45; P.aR.ab = 0.45; P.aL.el = 0.5; P.aR.el = 0.5; P.lL.ab = 0.12; P.lR.ab = 0.12; }
    } else if (anim === 'walk' || anim === 'sneak') {
      armsUp(P, 1 + 0.08 * S(ph)); P.lean = 0.14; P.side = 0.09 * S(ph);
      walkLegs(P, ph, 0.32, 0.45);
      P.lR.kn *= 0.3; P.lR.fp = -0.3;                     // perna que arrasta
      if (gait === 'tank') { P.aL.sw = 0.3 - 0.3 * S(ph); P.aR.sw = 0.3 + 0.3 * S(ph); P.aL.ab = 0.45; P.aR.ab = 0.45; P.aL.el = 0.6; P.aR.el = 0.6; P.lL.ab = 0.14; P.lR.ab = 0.14; P.side = 0.12 * S(ph); }
      if (gait === 'bloat') { P.side = 0.14 * S(ph); P.lean = 0.02; }
    } else if (anim === 'run') {
      P.lean = 0.42; walkLegs(P, ph, 0.8, 1.2); P.air = 3 * Math.abs(C(ph));
      P.aL.sw = 1.4 + 0.5 * S(ph); P.aL.el = 0.2; P.aR.sw = 1.4 + 0.5 * S(ph + PI); P.aR.el = 0.2; P.aL.ab = 0.3; P.aR.ab = 0.3;
      P.hr = 0.4 * S(ph);
    } else if (anim === 'attack') {
      const k = [0, 0.5, 1, 1, 0.6, 0.2][f] || 0;
      if (gait === 'tank') {
        const up = [0, 1, 1, 0, 0, 0][f], down = [0, 0, 0, 1, 1, 0.3][f];
        P.aL.sw = 0.4 + 2.4 * up + 0.8 * down; P.aR.sw = 0.4 + 2.4 * up + 0.8 * down; P.aL.el = 0.3; P.aR.el = 0.3;
        P.aL.inw = 0.4; P.aR.inw = 0.4; P.lean = -0.15 * up + 0.4 * down; P.air = 3 * up;
      } else if (look.weapon === 'megaphone') {
        P.aR.sw = 0.5 + 0.6 * k; P.aR.el = 1.4 + 0.6 * k; P.wr = 1.1; P.face.mouth = 'scream'; P.hp = -0.2 * k; P.lean = -0.1 * k;
      } else {
        armsUp(P, 1); P.lean = 0.15 + 0.35 * k; P.aL.sw = 1.2 + 0.35 * k; P.aR.sw = 1.1 + 0.4 * k;
        P.aL.inw = 0.3 * k; P.aR.inw = 0.3 * k; P.lL.sw = 0.35 * k; P.lR.sw = -0.3 * k; P.hp = 0.25 * k;
        P.face.mouth = 'bite';
      }
    } else if (anim === 'hurt') {
      const k = [1, 0.7, 0.2][f] || 0;
      armsUp(P, 0.7); P.lean = -0.3 * k; P.hp = -0.35 * k; P.aL.ab = 0.5 * k; P.aR.ab = 0.6 * k; P.face.eyes = 'squint';
    } else if (anim === 'eat' || anim === 'pickup') {
      P.lL.sw = 0.9; P.lL.kn = 1.8; P.lR.sw = 0.7; P.lR.kn = 1.6; P.lean = 0.6;
      P.aL.sw = 0.6 + 0.4 * S(ph); P.aL.el = 1.2; P.aR.sw = 0.5 + 0.4 * S(ph + PI); P.aR.el = 1.3; P.hp = 0.3;
      P.face.mouth = f % 2 ? 'bite' : 'zombie';
    } else if (anim === 'scared' || anim === 'celebrate' || anim === 'interact') {
      armsUp(P, 1.1); P.lean = 0.1; P.face.mouth = 'scream'; P.hr = 0.35 * S(ph);
    } else {
      armsUp(P, 0.8);
    }
    if (look.weapon === 'megaphone' && anim !== 'attack') { P.aR.sw = 0.3; P.aR.el = 0.6; P.wr = 0.7; }
    return P;
  }

  holdPose(P, hold);
  const swing = MELEE_SWING.has(hold);
  const longGun = LONG_GUN.has(hold);

  switch (anim) {
    case 'idle': {
      P.breath = 1 + 0.018 * S(ph);
      P.aL.sw += 0.03 * S(ph); if (hold === 'none') P.aR.sw += 0.03 * S(ph + 0.5);
      P.hp = 0.02 * S(ph);
      if (look.idleFace) Object.assign(P.face, look.idleFace);
      break;
    }
    case 'walk': {
      walkLegs(P, ph, 0.46, 0.62);
      P.lean = 0.05; P.twist = 0.08 * S(ph);
      P.aL.sw = (P.aL.el > 1 ? P.aL.sw : -0.4 * S(ph)); P.aL.el = Math.max(P.aL.el, 0.25 + 0.2 * Math.max(0, -S(ph)));
      if (hold === 'none') { P.aR.sw = 0.4 * S(ph); P.aR.el = 0.25 + 0.2 * Math.max(0, S(ph)); }
      else if (!longGun) P.aR.sw += 0.08 * S(ph);
      if (hold === 'sling') { P.aR.sw = 0.4 * S(ph); P.aR.el = 0.3; }
      break;
    }
    case 'run': {
      walkLegs(P, ph, 0.78, 1.25); P.air = 2.5 * Math.max(0, S(2 * ph));
      P.lean = 0.26; P.twist = 0.14 * S(ph);
      if (!longGun) {
        P.aL.sw = -0.75 * S(ph); P.aL.el = 1.45;
        if (hold === 'none' || hold === 'sling') { P.aR.sw = 0.75 * S(ph); P.aR.el = 1.45; }
        else { P.aR.sw = 0.3 + 0.35 * S(ph); P.aR.el = swing ? 1.9 : 1.1; }
        if (hold === 'sling') { P.aL.sw = -0.75 * S(ph); }
      }
      P.face.mouth = 'open';
      break;
    }
    case 'sneak': case 'crouch': {
      const mv = anim === 'sneak' ? 1 : 0;
      P.lean = 0.42;
      P.lL.sw = 0.75 + mv * 0.3 * S(ph); P.lL.kn = 1.45 - mv * 0.15 * Math.max(0, C(ph));
      P.lR.sw = 0.55 + mv * 0.3 * S(ph + PI); P.lR.kn = 1.35 - mv * 0.15 * Math.max(0, C(ph + PI));
      if (hold === 'none') { P.aR.sw = 0.5; P.aR.el = 0.7; P.aL.sw = 0.4; P.aL.el = 0.9; }
      P.aL.sw = Math.max(P.aL.sw, 0.4);
      P.face.eyes = 'narrow'; P.face.mouth = 'flat';
      break;
    }
    case 'aim': {
      aimPose(P, hold, 0);
      P.aR.sw += 0.02 * S(ph);
      break;
    }
    case 'shoot': {
      const rec = [0, 1, 0.5, 0.15][f] || 0;
      aimPose(P, hold, rec);
      P.muzzle = f === 1 && (hold === 'pistol' || LONG_GUN.has(hold));
      if (hold === 'sling') {
        const k = [0, 1, 0.2, 0][f] || 0;
        P.aR.sw = 1.4 - 0.2 * k; P.aR.el = 1.7 - 1.4 * k;
      }
      P.face.eyes = 'narrow';
      break;
    }
    case 'attack': {
      if (swing) {
        const R = [
          { sw: 0.2, el: 1.95, ab: 0.22, tw: 0, ln: 0, st: 0 },
          { sw: 2.45, el: 0.9, ab: 0.45, tw: -0.45, ln: -0.12, st: 0 },
          { sw: 2.75, el: 0.7, ab: 0.4, tw: -0.55, ln: -0.15, st: 0.2 },
          { sw: 1.05, el: 0.12, ab: 0.12, tw: 0.45, ln: 0.25, st: 1 },
          { sw: 0.3, el: 0.25, ab: 0.05, tw: 0.62, ln: 0.3, st: 1 },
          { sw: 0.4, el: 1.3, ab: 0.15, tw: 0.2, ln: 0.1, st: 0.4 },
        ][f];
        P.aR.sw = R.sw; P.aR.el = R.el; P.aR.ab = R.ab; P.twist = R.tw; P.lean = R.ln;
        P.wr = f === 0 ? 1.45 : 0.8;
        P.aL.sw = 0.5 + 0.4 * R.st; P.aL.el = 0.9; P.aL.ab = 0.35;
        P.lL.sw = 0.4 * R.st; P.lR.sw = -0.3 * R.st; P.lL.kn = 0.15 * R.st; P.lR.kn = 0.1;
        P.face.mouth = f >= 3 && f <= 4 ? 'yell' : 'grit'; P.face.eyes = 'narrow';
      } else {
        // facada ou soco
        const R = [
          { sw: 0.3, el: 1.3, tw: 0, ln: 0, st: 0 },
          { sw: -0.25, el: 1.75, tw: -0.35, ln: -0.05, st: 0 },
          { sw: 1.4, el: 0.05, tw: 0.4, ln: 0.22, st: 1 },
          { sw: 1.5, el: 0.02, tw: 0.45, ln: 0.25, st: 1 },
          { sw: 0.8, el: 0.7, tw: 0.2, ln: 0.1, st: 0.5 },
          { sw: 0.3, el: 1.1, tw: 0, ln: 0, st: 0 },
        ][f];
        P.aR.sw = R.sw; P.aR.el = R.el; P.aR.ab = 0.1; P.twist = R.tw; P.lean = R.ln; P.wr = 0.1;
        P.aL.sw = 0.6; P.aL.el = 1.5; P.aL.ab = 0.25;
        P.lL.sw = 0.4 * R.st; P.lR.sw = -0.3 * R.st; P.lL.kn = 0.15 * R.st;
        P.face.mouth = f >= 2 && f <= 3 ? 'yell' : 'grit'; P.face.eyes = 'narrow';
      }
      break;
    }
    case 'hurt': {
      const k = [1, 0.65, 0.2][f] || 0;
      P.lean = -0.3 * k; P.hp = -0.3 * k; P.hr = 0.15 * k;
      P.aL.sw = -0.3 * k + 0.1; P.aL.ab = 0.2 + 0.6 * k; P.aL.el = 0.5;
      if (hold === 'none') { P.aR.sw = -0.3 * k + 0.1; P.aR.ab = 0.2 + 0.6 * k; P.aR.el = 0.5; }
      P.lL.sw = -0.15 * k; P.lR.sw = 0.2 * k; P.lR.kn = 0.3 * k;
      P.face.eyes = 'squint'; P.face.mouth = 'grit';
      break;
    }
    case 'celebrate': {
      const j = Math.max(0, S(ph));
      P.air = 12 * j;
      P.lL.sw = 0.35 * j; P.lL.kn = 0.9 * j; P.lR.sw = 0.25 * j; P.lR.kn = 0.8 * j;
      P.aL.sw = 0.2; P.aL.ab = 2.35 + 0.2 * S(ph * 2); P.aL.el = 0.35 + 0.35 * Math.max(0, S(ph * 2));
      if (hold === 'none' || hold === 'sling' || hold === 'knife' || hold === 'pistol') { P.aR.sw = 0.2; P.aR.ab = 2.35 + 0.2 * S(ph * 2 + PI); P.aR.el = 0.35 + 0.35 * Math.max(0, S(ph * 2 + PI)); P.wr = 1.6; }
      if (longGun) { P.aR.sw = 2.6; P.aR.el = 0.2; P.aR.ab = 0.4; P.aL.ab = 2.2; P.wr = 0.2; P.wab = 0; }
      P.face.eyes = 'happy'; P.face.mouth = 'grin';
      break;
    }
    case 'scared': {
      P.hx = [1.2, -1.2, 1.0, -1.0][f];
      P.lL.sw = 0.25; P.lL.kn = 0.45; P.lR.sw = 0.15; P.lR.kn = 0.4; P.lean = -0.08;
      P.aL.sw = 1.2; P.aL.el = 1.9; P.aL.inw = 0.5; P.aL.ab = 0.2;
      P.aR.sw = 1.25; P.aR.el = 1.95; P.aR.inw = 0.5; P.aR.ab = 0.2;
      if (hold !== 'none') { P.aR.sw = 0.9; P.aR.el = 0.8; }
      P.wr = 0.9;
      P.face.eyes = 'wide'; P.face.mouth = f % 2 ? 'scream' : 'wavy'; P.face.sweat = true;
      break;
    }
    case 'interact': {
      const k = [0.2, 0.8, 1, 0.4][f] || 0;
      P.lean = 0.12 * k; P.aR.sw = 0.3 + 1.1 * k; P.aR.el = 0.6 - 0.45 * k; P.aR.ab = 0.05;
      P.lL.sw = 0.25 * k; P.face.mouth = 'flat';
      if (hold !== 'none' && hold !== 'sling') { P.aL.sw = 0.3 + 1.1 * k; P.aL.el = 0.6 - 0.45 * k; P.aL.ab = 0.05; }
      break;
    }
    case 'pickup': {
      const k = [0, 0.6, 1, 0.6, 0][f] || 0;
      P.lean = 0.55 * k; P.lL.sw = 0.8 * k; P.lL.kn = 1.55 * k; P.lR.sw = 0.5 * k; P.lR.kn = 1.3 * k;
      P.aL.sw = 0.2 + 0.5 * k; P.aL.el = 0.2;
      if (hold === 'none' || hold === 'sling') { P.aR.sw = 0.2 + 0.55 * k; P.aR.el = 0.15; }
      else { P.aL.sw = 0.3 + 0.7 * k; }
      if (f === 3) P.item = { hand: hold === 'none' || hold === 'sling' ? 'R' : 'L', kind: 'box' };
      P.face.eyes = f === 2 ? 'narrow' : 'open';
      break;
    }
    case 'eat': {
      const k = [0.3, 1, 1, 1, 0.3][f] || 0;
      P.aL.sw = 0.25 + 0.55 * k; P.aL.el = 0.4 + 1.75 * k; P.aL.inw = 0.45 * k; P.aL.ab = 0.1;
      P.item = { hand: 'L', kind: look.eatItem || 'food' };
      P.face.mouth = f === 2 || f === 4 ? 'chew' : f === 1 || f === 3 ? 'o' : 'smile';
      P.face.eyes = f === 2 ? 'happy' : 'open'; P.hp = 0.05;
      break;
    }
    case 'medicine': {
      const k = [0.3, 1, 1, 1, 0.3][f] || 0;
      P.aL.sw = 0.35 + 0.5 * k; P.aL.el = 0.6 + 0.3 * k; P.aL.ab = 0.2;
      P.aR.sw = 0.35 + 0.55 * k; P.aR.el = 0.8 + 0.55 * k + 0.2 * S(ph * 2); P.aR.inw = 0.55 * k; P.aR.ab = 0.12;
      P.item = { hand: 'R', kind: 'bandage' }; P.hp = 0.25 * k; P.hy = 0.25 * k;
      P.face.eyes = f === 4 ? 'happy' : 'narrow'; P.face.mouth = f === 4 ? 'smile' : 'grit';
      P.whide = true;
      break;
    }
    case 'die': case 'dead': {
      const fr = anim === 'dead' ? 5 : f;
      const k = [0.2, 0.6, 1, 1, 1, 1][fr];
      P.lean = [-0.25, 0.2, 0.1, 0, 0, 0][fr];
      P.hp = [-0.35, 0.3, 0.1, 0, 0, 0][fr];
      P.lL.sw = [0, 0.5, 0.3, 0.2, 0.15, 0.15][fr]; P.lL.kn = [0, 1.0, 0.6, 0.3, 0.2, 0.2][fr];
      P.lR.sw = [0, 0.3, 0.1, 0, -0.05, -0.05][fr]; P.lR.kn = [0.2, 0.8, 0.4, 0.2, 0.1, 0.1][fr];
      P.aL.sw = 0.3; P.aL.ab = 0.3 + 0.9 * k; P.aL.el = 0.4;
      P.aR.sw = 0.4; P.aR.ab = 0.3 + 1.0 * k; P.aR.el = 0.5;
      P.rot2d = [0, 0.12, 0.55, 1.05, 1.3, 1.36][fr];
      P.lift = [0, 3, 10, 24, 33, 35][fr];
      P.face.eyes = fr >= 3 ? 'x' : 'squint'; P.face.mouth = fr >= 3 ? 'o' : 'scream';
      P.drop = fr >= 2;
      break;
    }
    case 'vehicleIn': case 'vehicleOut': {
      const seq = anim === 'vehicleIn' ? [0, 1, 2, 3] : [3, 2, 1, 0];
      const k = seq[f] / 3;
      P.lean = 0.35 * k; P.lL.sw = 0.9 * k; P.lL.kn = 1.3 * k; P.lR.sw = 0.3 * k; P.lR.kn = 0.9 * k;
      P.aR.sw = 1.3 * Math.min(1, k * 2); P.aR.el = 0.4; P.aL.sw = 0.9 * k; P.aL.el = 0.8;
      P.scale = 1 - 0.25 * k; P.alpha = 1 - 0.85 * Math.max(0, k - 0.3) / 0.7; P.lift = -8 * k;
      break;
    }
  }
  return P;
}

function aimPose(P, hold, rec) {
  if (LONG_GUN.has(hold)) {
    P.aR.sw = 1.1 + 0.2 * rec; P.aR.el = 1.25; P.aR.ab = 0.25;
    P.aL.sw = 1.45 + 0.15 * rec; P.aL.el = 0.18; P.aL.inw = 0.55; P.aL.ab = 0.05;
    P.wr = PI / 2 - (1.1 + 1.25) + 0.1 * rec; P.wab = -0.25; P.twist = 0.25; P.lean = -0.06 * rec; P.hp = 0.15;
    P.lL.sw = 0.25; P.lR.sw = -0.15;
  } else if (hold === 'pistol') {
    P.aR.sw = 1.5 + 0.3 * rec; P.aR.el = 0.05; P.aR.ab = 0.05; P.aR.inw = 0.1;
    P.aL.sw = 1.35 + 0.25 * rec; P.aL.el = 0.35; P.aL.inw = 0.65;
    P.wr = PI / 2 - 1.55 + 0.05; P.lean = -0.05 * rec;
  } else if (hold === 'sling') {
    P.aL.sw = 1.5; P.aL.el = 0.05; P.aL.ab = 0.05; P.whand = 'L'; P.wr = 0.1;
    P.aR.sw = 1.4; P.aR.el = 1.7; P.aR.inw = 0.4;
  } else if (hold === 'megaphone') {
    P.aR.sw = 0.9; P.aR.el = 1.6; P.wr = 1.1;
  } else {
    holdPose(P, hold);
    P.lL.sw = 0.2; P.lR.sw = -0.15; P.lean = 0.08;
  }
}

// ---------------------------------------------------------------- esqueleto
function fk(B, P) {
  const legLen = B.thigh + B.shin + B.footH;
  const J = { leg: {}, arm: {} };
  for (const s of [1, -1]) {
    const lp = s > 0 ? P.lL : P.lR;
    const ab = (lp.ab || 0) * s;
    const hip = [s * B.hipW + P.hx, legLen, P.hz];
    const knee = add(hip, mul(limbDir(lp.sw, ab), B.thigh));
    const ankle = add(knee, mul(limbDir(lp.sw - lp.kn, ab), B.shin));
    const fp = lp.fp || 0;
    const fd = [Math.sin(ab) * 0.2, Math.sin(fp), Math.cos(fp)];
    const heel = add(ankle, add([0, -B.footH, 0], mul(fd, -B.footLen * 0.25)));
    const toe = add(ankle, add([0, -B.footH, 0], mul(fd, B.footLen * 0.75)));
    J.leg[s] = { hip, knee, ankle, heel, toe };
  }
  const lean = P.lean, side = P.side, tw = P.twist;
  const hc = [P.hx, legLen, P.hz];
  const u = norm([Math.sin(side), Math.cos(side) * Math.cos(lean), Math.cos(side) * Math.sin(lean)]);
  const torsoLen = B.torsoLen * P.breath;
  const sc = add(hc, mul(u, torsoLen));
  const sideV = rotY([Math.cos(side), -Math.sin(side), 0], tw);
  const shp = { 1: add(sc, mul(sideV, B.shW)), [-1]: add(sc, mul(sideV, -B.shW)) };
  const neckTop = add(sc, mul(u, B.neck));
  const hu = norm([u[0] + Math.sin(P.hr) * 0.6, u[1], u[2] + Math.sin(P.hp) * 0.8]);
  const head = add(neckTop, mul(hu, B.headR * B.headH * 0.9));
  for (const s of [1, -1]) {
    const ap = s > 0 ? P.aL : P.aR;
    const p1 = ap.sw + lean;
    const d1 = rotY(limbDir(p1, ap.ab * s), tw);
    const elbow = add(shp[s], mul(d1, B.upper));
    const p2 = p1 + ap.el;
    const ab2 = (ap.ab - (ap.inw || 0)) * s;
    const d2 = rotY(limbDir(p2, ab2), tw);
    const hand = add(elbow, mul(d2, B.fore));
    const dw = rotY(limbDir(p2 + (P.wr ?? 1.2), ab2 + (P.wab || 0) * s), tw);
    J.arm[s] = { sh: shp[s], elbow, hand, dw };
  }
  J.hc = hc; J.sc = sc; J.u = u; J.sideV = sideV; J.neckTop = neckTop; J.head = head; J.torsoLen = torsoLen;
  // encosta o pé mais baixo no chão
  let minY = Infinity;
  for (const s of [1, -1]) minY = Math.min(minY, J.leg[s].heel[1], J.leg[s].toe[1]);
  const dy = -minY + P.air;
  const shift = p => { p[1] += dy; };
  for (const s of [1, -1]) {
    const l = J.leg[s]; shift(l.hip); shift(l.knee); shift(l.ankle); shift(l.heel); shift(l.toe);
    const a = J.arm[s]; shift(a.sh); shift(a.elbow); shift(a.hand);
  }
  shift(hc); shift(sc); shift(neckTop); shift(head);
  return J;
}

// ---------------------------------------------------------------- desenho básico
function pathPoly(ctx, pts, smooth = false) {
  ctx.beginPath();
  if (!smooth || pts.length < 3) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    return;
  }
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const m2 = mid(p, q);
    ctx.quadraticCurveTo(p[0], p[1], m2[0], m2[1]);
  }
  ctx.closePath();
}
function fillStroke(ctx, fill, lw) {
  ctx.fillStyle = fill; ctx.fill();
  if (lw > 0) { ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke(); }
}
function capsule(ctx, pts, w, fill, ow) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.01, pts[0][1]);
  if (ow > 0) { ctx.strokeStyle = INK; ctx.lineWidth = w + ow * 2; ctx.stroke(); }
  ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke();
}
function circle(ctx, x, y, r, fill, lw) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); fillStroke(ctx, fill, lw);
}
function ellipse(ctx, x, y, rx, ry, rot, fill, lw) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); fillStroke(ctx, fill, lw);
}
// polígono afinado ao longo de uma linha (mechas de cabelo, lâminas)
function taperPoly(pts, w0, w1) {
  const L = [], R = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = (w0 + (w1 - w0) * (i / (n - 1 || 1))) / 2;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  return L.concat(R.reverse());
}
function convexHull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop();
  return lo.concat(up);
}

// ---------------------------------------------------------------- pintura de um quadro
// ctx: contexto 2D; (ox, oy): posição dos pés no quadro; sc: escala; dir 0..7
export function paintFrame(ctx, look, anim, f, dir, hold = 'none', ox = 56, oy = 128, sc = 1) {
  const B = look.body;
  const P = poseFor(look, anim, f, hold);
  if (look.weapon && hold === 'none' && look.gait && look.gait !== 'human') hold = look.weapon;
  const J = fk(B, P);
  const yaw = dir * PI / 4;
  const s = sc * (look.scale || 1) * P.scale;
  const V = p => rotY(p, yaw);                       // corpo → vista
  const Pj = v => [v[0] * s, -(v[1] * CT - v[2] * ST) * s];   // vista → tela (relativo aos pés)
  const PV = p => Pj(V(p));
  const ow = Math.max(1.1, 1.55 * sc * (look.scale || 1));
  const parts = [];
  const push = (depth, fn) => parts.push({ depth, fn });
  const zOf = p => V(p)[2];
  const skin = look.skin;
  const dark = z => z < -3; // membros do lado de trás ficam um pouco mais escuros
  const tone = (col, z) => dark(z) ? shade(col, -0.13) : col;

  // ---- pernas e pés
  for (const sd of [1, -1]) {
    const L = J.leg[sd];
    const zK = (zOf(L.knee) + zOf(L.ankle)) / 2;
    push(zK - 0.4 + (sd === 1 ? 0.01 : 0), () => drawLeg(ctx, look, L, PV, s, ow, tone, zK));
    const zF = zOf(L.toe);
    push(Math.max(zF, zK) - 0.1, () => drawFoot(ctx, look, L, PV, s, ow, tone, zF));
  }
  // ---- saia / vestido / jaleco longo
  if (look.bottom?.kind === 'dress' || look.coat) {
    let zs = zOf(J.hc) + 0.05;
    for (const sd of [1, -1]) zs = Math.max(zs, (zOf(J.leg[sd].knee) + zOf(J.leg[sd].ankle)) / 2 - 0.3);
    push(zs, () => drawSkirt(ctx, look, J, V, Pj, s, ow, yaw));
  }
  // ---- tronco
  const zT = zOf(J.hc) * 0.5 + zOf(J.sc) * 0.5;
  push(zT, () => drawTorso(ctx, look, J, V, Pj, s, ow, yaw, P));
  // capuz nas costas
  if (look.jacket?.hood) {
    const back = V(add(J.sc, mul(norm(cross(J.sideV, J.u)), -B.td)));
    push(back[2] + 0.2, () => drawHood(ctx, look, J, V, Pj, s, ow));
  }
  // ---- pescoço
  push(zOf(J.sc) + 0.15, () => {
    const a = PV(J.sc), b = PV(J.neckTop);
    capsule(ctx, [a, b], B.neckW * s, skin, ow);
  });
  // ---- braços
  const handInfo = {};
  for (const sd of [1, -1]) {
    const A = J.arm[sd];
    const zU = (zOf(A.sh) + zOf(A.elbow)) / 2;
    const zF = (zOf(A.elbow) + zOf(A.hand)) / 2;
    push(zU + 0.3, () => drawUpperArm(ctx, look, A, PV, s, ow, tone, zU));
    push(Math.max(zF, zU) + 0.32, () => drawForeArm(ctx, look, A, PV, s, ow, tone, zF, sd, P, hold, V, Pj));
    handInfo[sd] = { z: zOf(A.hand) };
  }
  // ---- cabeça (cabelo, orelhas, pele), rosto e mechas longas
  const hv = V(J.head);
  const hyaw = yaw + P.hy;
  const H = { c: Pj(hv), z: hv[2], R: B.headR * s, rx: B.headR * B.headW * s, ry: B.headR * B.headH * s, yaw: hyaw, pitch: P.hp, roll: P.hr * (C(yaw) >= 0 ? 1 : -1) * 0.5 };
  const hair = getHair(look);
  push(hv[2] + 0.5, () => drawHead(ctx, look, H, hair, P, ow));
  const faceVis = C(hyaw);
  if (faceVis > -0.2) push(hv[2] + B.headR * Math.max(0.3, faceVis) + 0.5, () => drawFace(ctx, look, H, P, ow));
  for (const sh of hair.sheets) {
    const pts3 = sheetPoints(sh, J, B, hyaw, yaw, V, look);
    const zm = pts3.z;
    push(zm + (sh.bias || 0.25), () => drawSheet(ctx, look, pts3.pts, Pj, s, ow, hair.color));
  }
  if (look.earrings) {
    for (const sd of [1, -1]) {
      const a = sd * 1.5;
      const z = C(a + hyaw);
      if (z > -0.35) push(hv[2] + B.headR * z + 0.7, () => drawEarring(ctx, look, H, a, ow));
    }
  }

  // ---- ordena e desenha
  parts.sort((a, b) => a.depth - b.depth);
  ctx.save();
  ctx.translate(ox, oy + P.lift * sc);
  if (P.rot2d) {
    const pivotY = -45 * s;
    const dirSign = (dir >= 1 && dir <= 3) ? 1 : (dir >= 5 && dir <= 7) ? -1 : (dir === 4 ? -1 : 1);
    ctx.translate(0, pivotY);
    ctx.rotate(-P.rot2d * dirSign);
    ctx.translate(0, -pivotY);
  }
  ctx.globalAlpha = P.alpha;
  for (const p of parts) p.fn();
  ctx.restore();
  return P;
}

// ---------------------------------------------------------------- pernas e pés
function drawLeg(ctx, look, L, PV, s, ow, tone, z) {
  const B = look.body;
  const hip = PV(L.hip), knee = PV(L.knee), ankle = PV(L.ankle);
  const bot = look.bottom || {};
  const legSkin = tone(look.skin, z);
  const lw = B.legT * s;
  if (bot.kind === 'jeans' || bot.kind === 'pants') {
    capsule(ctx, [hip, knee, ankle], lw * 1.08, tone(bot.color, z), ow);
    if (bot.cuff) capsule(ctx, [lerpP(knee, ankle, 0.88), ankle], lw * 1.12, tone(bot.cuff, z), 0);
  } else {
    capsule(ctx, [hip, knee, ankle], lw * 0.92, legSkin, ow);
    if (bot.kind === 'shorts' || bot.kind === 'dress') {
      const len = bot.len ?? 0.7;
      const pts = len <= 1 ? [hip, lerpP(hip, knee, len)] : [hip, knee, lerpP(knee, ankle, len - 1)];
      if (bot.kind === 'shorts') capsule(ctx, pts, lw * 1.38, tone(bot.color, z), ow);
    }
  }
  if (look.socks) {
    const sk = look.socks;
    const top = lerpP(ankle, knee, sk.h ?? 0.35);
    capsule(ctx, [top, ankle], lw * 0.98, tone(sk.color, z), ow);
    if (sk.stripes) {
      ctx.strokeStyle = sk.stripes; ctx.lineWidth = Math.max(1, 1.3 * s); ctx.lineCap = 'butt';
      for (const k of [0.55, 0.78]) {
        const p = lerpP(ankle, top, k);
        const dx = top[0] - ankle[0], dy = top[1] - ankle[1], l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l * lw * 0.5, ny = dx / l * lw * 0.5;
        ctx.beginPath(); ctx.moveTo(p[0] - nx, p[1] - ny); ctx.lineTo(p[0] + nx, p[1] + ny); ctx.stroke();
      }
    }
  }
}
const lerpP = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function drawFoot(ctx, look, L, PV, s, ow, tone, z) {
  const B = look.body;
  const heel = PV(L.heel), toe = PV(L.toe);
  const sh = look.shoes || { kind: 'shoe', color: '#4a3a30' };
  const w = B.footH * 2.1 * s;
  if (sh.kind === 'flipflop') {
    const h2 = [heel[0], heel[1] + 1.2 * s], t2 = [toe[0], toe[1] + 1.2 * s];
    capsule(ctx, [h2, t2], w * 0.75, tone(sh.color, z), ow);
    capsule(ctx, [heel, toe], w * 0.62, tone(look.skin, z), ow);
    ctx.strokeStyle = tone(sh.color, z); ctx.lineWidth = Math.max(1, 1.4 * s); ctx.lineCap = 'round';
    const m = lerpP(heel, toe, 0.62);
    ctx.beginPath(); ctx.moveTo(m[0] - w * 0.35, m[1] - w * 0.05); ctx.lineTo(toe[0], toe[1] - w * 0.15); ctx.lineTo(m[0] + w * 0.35, m[1] - w * 0.05); ctx.stroke();
    return;
  }
  if (sh.kind === 'barefoot') { capsule(ctx, [heel, toe], w * 0.7, tone(look.skin, z), ow); return; }
  if (sh.kind === 'boot') {
    const top = PV(add(L.ankle, [0, B.footH * 1.4, 0]));
    capsule(ctx, [top, heel, toe], w * 1.02, tone(sh.color, z), ow);
  } else capsule(ctx, [heel, toe], w, tone(sh.color, z), ow);
  if (sh.sole) {
    ctx.strokeStyle = sh.sole; ctx.lineWidth = Math.max(1, 1.5 * s); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(heel[0], heel[1] + w * 0.36); ctx.lineTo(toe[0], toe[1] + w * 0.36); ctx.stroke();
  }
  if (sh.toe) circle(ctx, toe[0], toe[1] + w * 0.05, w * 0.34, sh.toe, 0);
  if (sh.accent) {
    const m = lerpP(heel, toe, 0.45);
    ctx.strokeStyle = sh.accent; ctx.lineWidth = Math.max(1, 1.2 * s);
    ctx.beginPath(); ctx.moveTo(m[0] - w * 0.25, m[1] - w * 0.1); ctx.lineTo(m[0] + w * 0.25, m[1] + w * 0.1); ctx.stroke();
  }
}

// ---------------------------------------------------------------- tronco
function torsoFrame(J, B, t) {
  const c = add(J.hc, mul(J.u, J.torsoLen * t));
  const side = J.sideV; // já inclui a torção dos ombros
  const tw = t; // a torção cresce do quadril para os ombros
  const sideT = norm(lerp3([1, 0, 0], side, tw));
  const fwd = norm(cross(sideT, J.u));
  return { c, side: sideT, fwd };
}
const TLEV = [1.0, 0.72, 0.36, 0.0];
function torsoLevel(B, i) {
  const [wS, wC, wW, wH] = B.tw;
  return [
    { w: wS, df: B.td * 0.95, db: B.td * 0.9 },
    { w: wC, df: B.td * 1.05 + B.belly * 0.3, db: B.td },
    { w: wW, df: B.td + B.belly, db: B.td * 0.92 },
    { w: wH, df: B.td * 0.95 + B.belly * 0.45, db: B.td * 0.95 },
  ][i];
}
// ponto na superfície do tronco: t (0 quadril .. 1 ombro), phi (0 = frente)
function torsoSurface(J, B, t, phi) {
  let i = 0;
  while (i < TLEV.length - 1 && t < TLEV[i + 1]) i++;
  const t0 = TLEV[i], t1 = TLEV[Math.min(i + 1, TLEV.length - 1)];
  const k = t0 === t1 ? 0 : (t - t0) / (t1 - t0);
  const a = torsoLevel(B, i), b = torsoLevel(B, Math.min(i + 1, 3));
  const w = a.w + (b.w - a.w) * k;
  const df = a.df + (b.df - a.df) * k, db = a.db + (b.db - a.db) * k;
  const F = torsoFrame(J, B, t);
  const cz = Math.cos(phi);
  const d = cz >= 0 ? df : db;
  const p = add(F.c, add(mul(F.side, w * Math.sin(phi)), mul(F.fwd, d * cz)));
  // normal aproximada (para saber se o ponto está virado para a câmera)
  const n = norm(add(mul(F.side, Math.sin(phi) / w), mul(F.fwd, cz / d)));
  return { p, n };
}
// faixa visível da superfície (lista de pontos na tela)
function surfaceBand(J, B, V, Pj, t0, t1, ph0, ph1, steps = 8) {
  const rows = [];
  const tSteps = 5;
  for (let i = 0; i <= tSteps; i++) {
    const t = t0 + (t1 - t0) * (i / tSteps);
    let first = null, last = null;
    for (let j = 0; j <= steps; j++) {
      const ph = ph0 + (ph1 - ph0) * (j / steps);
      const { p, n } = torsoSurface(J, B, t, ph);
      const nv = V(n);
      if (nv[2] * CT + nv[1] * ST > -0.05) {
        const q = Pj(V(p));
        if (!first) first = q;
        last = q;
      }
    }
    if (first) rows.push([first, last]);
  }
  if (rows.length < 2) return null;
  return rows.map(r => r[0]).concat(rows.map(r => r[1]).reverse());
}

function drawTorso(ctx, look, J, V, Pj, s, ow, yaw, P) {
  const B = look.body;
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const t = TLEV[i];
    for (let k = 0; k < 20; k++) {
      const { p } = torsoSurface(J, B, t, (k / 20) * TAU);
      pts.push(Pj(V(p)));
    }
  }
  const hull = convexHull(pts);
  const top = look.top || { color: '#888' };
  const main = look.jacket ? look.jacket.color : top.color;
  ctx.save();
  pathPoly(ctx, hull, true);
  ctx.fillStyle = main; ctx.fill();
  ctx.clip();
  const band = (t0, t1, a, b, col, steps) => {
    const poly = surfaceBand(J, B, V, Pj, t0, t1, a, b, steps);
    if (poly) { pathPoly(ctx, poly); ctx.fillStyle = col; ctx.fill(); }
    return poly;
  };
  // sombra suave no lado de trás
  const sideShade = band(0, 1, 1.6, 4.68, shade(main, -0.12), 10);
  void sideShade;
  if (look.jacket) {
    const jk = look.jacket;
    if (jk.open !== false) {
      band(0, 0.97, -0.5, 0.5, jk.lining || shade(jk.color, 0.3), 8);
      band(0, 0.95, -0.4, 0.4, top.color, 8);
      drawPrint(ctx, look, J, B, V, Pj, s, band);
    }
    if (jk.lining) {
      band(0.9, 1.0, -1.4, -0.4, jk.lining, 6);
      band(0.9, 1.0, 0.4, 1.4, jk.lining, 6);
    }
    if (jk.zip) band(0, 0.95, -0.03, 0.03, jk.zip, 2);
  } else {
    drawPrint(ctx, look, J, B, V, Pj, s, band);
  }
  if (look.apron) band(0, 0.8, -0.75, 0.75, look.apron, 8);
  if (look.vest) { band(0, 0.98, 0.35, 1.45, look.vest, 6); band(0, 0.98, -1.45, -0.35, look.vest, 6); band(0, 0.98, 1.45, 4.83, look.vest, 8); }
  if (look.coat) { band(0, 1, 0.3, 5.98, look.coat, 12); }
  if (look.stains) {
    const r = rng(hashStr(look.id + 'st'));
    for (let i = 0; i < look.stains; i++) {
      const t = 0.1 + r() * 0.8, ph = (r() - 0.5) * 5;
      const { p, n } = torsoSurface(J, B, t, ph);
      const nv = V(n);
      if (nv[2] < 0) continue;
      const q = Pj(V(p));
      circle(ctx, q[0], q[1], (1.5 + r() * 2.8) * s, i % 3 ? '#8a1c1c' : '#5e1414', 0);
    }
  }
  // gola
  const neckCol = look.skin;
  if (top.neck === 'v') {
    const pA = torsoSurface(J, B, 1, -0.32), pB = torsoSurface(J, B, 0.8, 0), pC = torsoSurface(J, B, 1, 0.32);
    if (V(pB.n)[2] > 0.1) {
      pathPoly(ctx, [Pj(V(pA.p)), Pj(V(pB.p)), Pj(V(pC.p))]);
      ctx.fillStyle = neckCol; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = ow * 0.7; ctx.stroke();
    }
  } else if (!look.jacket || look.jacket.open !== false) {
    const poly = surfaceBand(J, B, V, Pj, 0.92, 1.0, -0.42, 0.42, 6);
    if (poly && V(torsoSurface(J, B, 0.95, 0).n)[2] > 0.05) {
      pathPoly(ctx, poly); ctx.fillStyle = neckCol; ctx.fill();
      ctx.strokeStyle = top.collar || shade(top.color, -0.25); ctx.lineWidth = 1.4 * s; ctx.stroke();
    }
  }
  // barriga
  if (B.belly > 2.5 && !look.coat) {
    ctx.strokeStyle = shade(main, -0.35); ctx.lineWidth = 1.1 * s;
    const pts2 = [];
    for (let k = -8; k <= 8; k++) {
      const ph = k * 0.11;
      const { p, n } = torsoSurface(J, B, 0.14, ph);
      if (V(n)[2] > 0) pts2.push(Pj(V(p)));
    }
    if (pts2.length > 2) { ctx.beginPath(); ctx.moveTo(pts2[0][0], pts2[0][1] - 1.5 * s); for (const q of pts2) ctx.lineTo(q[0], q[1] - 1.5 * s); ctx.stroke(); }
  }
  ctx.restore();
  pathPoly(ctx, hull, true);
  ctx.strokeStyle = INK; ctx.lineWidth = ow; ctx.stroke();
}

function drawPrint(ctx, look, J, B, V, Pj, s, band) {
  const pr = look.top?.print;
  if (!pr) return;
  if (pr === 'yeshua') {
    const rows = [['#e0524f', 0.84, 0.78, 0.5], ['#f19a86', 0.76, 0.70, 0.5], ['#e8cf96', 0.675, 0.64, 0.42], ['#34487f', 0.61, 0.55, 0.5], ['#2e8b80', 0.53, 0.47, 0.5]];
    for (const [c, a, b, w] of rows) band(b, a, -w, w, c, 6);
  } else if (pr === 'educacao') {
    const O = '#f07a2c';
    band(0.76, 0.84, -0.5, 0.42, O, 6);
    band(0.71, 0.735, -0.46, 0.3, O, 4);
    band(0.6, 0.68, -0.52, 0.45, O, 6);
    band(0.55, 0.575, -0.45, 0.38, O, 4);
  } else if (pr === 'crescer') {
    band(0.62, 0.7, -0.36, -0.14, '#e8762e', 3);
    band(0.64, 0.68, -0.12, 0.34, '#4b4b50', 4);
    band(0.6, 0.615, -0.08, 0.3, '#6c6c70', 3);
  } else if (pr === 'escola') {
    band(0.66, 0.78, 0.2, 0.42, '#2a58b0', 3);
    band(0, 1, -1.62, -1.5, '#2a58b0', 2); band(0, 1, 1.5, 1.62, '#2a58b0', 2);
  } else if (pr === 'numero') {
    band(0.5, 0.78, -0.4, 0.4, '#ffffff', 5);
    band(0.56, 0.72, -0.2, -0.04, INK, 2); band(0.56, 0.72, 0.04, 0.2, INK, 2);
  } else if (pr === 'gari') {
    band(0.5, 0.56, -1.7, 1.7, '#e6e6e6', 8); band(0.3, 0.36, -1.7, 1.7, '#e6e6e6', 8);
  } else if (pr === 'agronova') {
    band(0.68, 0.78, 0.18, 0.46, '#4caf50', 3);
  } else if (pr === 'camo') {
    const r = rng(77);
    for (let i = 0; i < 14; i++) { const t = r(), ph = (r() - 0.5) * 6; band(t, Math.min(1, t + 0.12), ph, ph + 0.5, i % 2 ? '#4d5a33' : '#6f6a45', 3); }
  } else if (pr === 'listras') {
    for (let i = 0; i < 5; i++) band(0.1 + i * 0.18, 0.18 + i * 0.18, -3.2, 3.2, look.top.stripe || '#ffffff', 10);
  } else if (pr === 'flores') {
    const r = rng(5);
    for (let i = 0; i < 12; i++) { const t = r(), ph = (r() - 0.5) * 6; band(t, Math.min(1, t + 0.07), ph, ph + 0.28, i % 2 ? '#f6d04a' : '#f28bb0', 2); }
  } else if (pr === 'cruz') {
    band(0.55, 0.75, -0.04, 0.04, '#f2f2f2', 2); band(0.66, 0.7, -0.14, 0.14, '#f2f2f2', 3);
  }
}

function drawSkirt(ctx, look, J, V, Pj, s, ow, yaw) {
  const B = look.body;
  const col = look.coat || look.bottom.color;
  const hemY = look.coat ? B.shin * 0.25 + B.footH : B.shin * 0.35 + B.footH;
  const pts = [];
  const lvls = [{ y: J.hc[1], w: B.tw[3], d: B.td + B.belly * 0.4 }, { y: hemY, w: B.tw[3] * 1.3, d: (B.td + B.belly * 0.4) * 1.3 }];
  for (const L of lvls) {
    for (let k = 0; k < 16; k++) {
      const ph = k / 16 * TAU;
      const p = [J.hc[0] + L.w * Math.sin(ph), L.y, J.hc[2] + L.d * Math.cos(ph)];
      pts.push(Pj(V(p)));
    }
  }
  const hull = convexHull(pts);
  pathPoly(ctx, hull, true);
  fillStroke(ctx, col, ow);
  if (look.coat) {
    // abertura do jaleco
    const a = Pj(V([J.hc[0], J.hc[1], J.hc[2] + B.td])), b = Pj(V([J.hc[0], hemY, J.hc[2] + B.td * 1.3]));
    if (C(yaw) > 0.2) { ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  } else if (look.bottom.pattern === 'flores') {
    const r = rng(9);
    ctx.save(); pathPoly(ctx, hull, true); ctx.clip();
    for (let i = 0; i < 10; i++) circle(ctx, hull[0][0] + (r() - 0.2) * 30 * s, hull[0][1] + (r() - 0.5) * 30 * s, 1.6 * s, i % 2 ? '#f6d04a' : '#fff4f8', 0);
    ctx.restore();
  }
}

function drawHood(ctx, look, J, V, Pj, s, ow) {
  const B = look.body;
  const jk = look.jacket;
  const back = norm(cross(J.sideV, J.u));
  const pts = [];
  for (let k = 0; k <= 12; k++) {
    const a = -PI / 2 + (k / 12) * PI;
    const p = add(add(J.sc, mul(back, -B.td * 1.05)), add(mul(J.sideV, Math.sin(a) * B.neckW * 1.25), mul(J.u, -Math.cos(a) * B.torsoLen * 0.3 + 1)));
    pts.push(Pj(V(p)));
  }
  const top1 = Pj(V(add(add(J.sc, mul(J.sideV, B.neckW * 1.3)), mul(back, -B.td * 0.4))));
  const top2 = Pj(V(add(add(J.sc, mul(J.sideV, -B.neckW * 1.3)), mul(back, -B.td * 0.4))));
  pathPoly(ctx, [top1, ...pts.reverse(), top2], true);
  fillStroke(ctx, jk.color, ow);
  pathPoly(ctx, [top1, top2, Pj(V(add(J.sc, mul(back, -B.td * 1.1))))], true);
  ctx.fillStyle = jk.lining || shade(jk.color, 0.3); ctx.fill();
}

// ---------------------------------------------------------------- braços
function drawUpperArm(ctx, look, A, PV, s, ow, tone, z) {
  const B = look.body;
  const a = PV(A.sh), b = PV(A.elbow);
  const long = look.jacket ? look.jacket.sleeves !== 'none' : look.top?.sleeves === 'long';
  const vest = look.vest || look.top?.sleeves === 'none';
  if (long) {
    const col = look.jacket?.sleeves !== 'none' && look.jacket ? look.jacket.color : look.top.color;
    capsule(ctx, [a, b], B.armT * s * 1.18, tone(col, z), ow);
    return;
  }
  capsule(ctx, [a, b], B.armT * s, tone(look.skin, z), ow);
  if (!vest) {
    const col = look.coat || look.top?.color || '#888';
    const e = lerpP(a, b, look.top?.sleeves === 'mid' ? 0.85 : 0.55);
    capsule(ctx, [a, e], B.armT * s * 1.45, tone(col, z), ow);
  }
}
function drawForeArm(ctx, look, A, PV, s, ow, tone, z, sd, P, hold, V, Pj) {
  const B = look.body;
  const e = PV(A.elbow), h = PV(A.hand);
  const long = look.jacket ? look.jacket.sleeves !== 'none' : look.top?.sleeves === 'long';
  if (long) {
    const col = look.jacket ? look.jacket.color : look.top.color;
    const cuff = lerpP(e, h, 0.82);
    capsule(ctx, [e, h], B.armT * s * 0.95, tone(look.skin, z), ow);
    capsule(ctx, [e, cuff], B.armT * s * 1.12, tone(col, z), ow);
  } else if (look.coat && look.coatSleeves) {
    capsule(ctx, [e, h], B.armT * s * 0.95, tone(look.skin, z), ow);
    capsule(ctx, [e, lerpP(e, h, 0.8)], B.armT * s * 1.12, tone(look.coat, z), ow);
  } else {
    capsule(ctx, [e, h], B.armT * s * 0.95, tone(look.skin, z), ow);
  }
  const whand = P.whand === 'L' ? 1 : -1;
  const wv = V(A.dw);
  const behind = wv[2] < -0.35;           // arma apontando para trás: desenha antes da mão
  const drawW = () => { if (hold !== 'none' && sd === whand && !P.whide) drawWeapon(ctx, hold, A, V, Pj, s, ow, P); };
  const drawI = () => { if (P.item && ((P.item.hand === 'L') === (sd === 1))) drawItem(ctx, P.item.kind, h, s, ow); };
  if (behind) drawW();
  circle(ctx, h[0], h[1], B.handR * s, tone(look.glove || look.skin, z), ow);
  if (!behind) drawW();
  drawI();
}

// ---------------------------------------------------------------- armas e itens
export const WEAPON_LEN = { knife: 15, bat: 40, batpregos: 40, pipe: 36, axe: 34, hammer: 26, machete: 30, crowbar: 34, pistol: 11, shotgun: 44, rifle: 50, sling: 11, megaphone: 16 };
function drawWeapon(ctx, kind, A, V, Pj, s, ow, P) {
  const g3 = V(A.hand), d3 = V(A.dw);
  const len = (WEAPON_LEN[kind] || 20);
  const at = k => Pj(add(g3, mul(d3, len * k)));
  const g = Pj(g3);
  const up3 = norm(sub([0, 1, 0], mul(d3, d3[1])));
  const upAt = (k, h) => Pj(add(add(g3, mul(d3, len * k)), mul(up3, h)));
  const W = x => x * s;
  switch (kind) {
    case 'knife':
      capsule(ctx, [at(-0.2), at(0.12)], W(3.2), '#5a3a22', ow * 0.8);
      pathPoly(ctx, taperPoly([at(0.1), at(0.55), at(1)], W(3.8), W(0.4)));
      fillStroke(ctx, '#d9e0e6', ow * 0.8);
      break;
    case 'machete':
      capsule(ctx, [at(-0.15), at(0.15)], W(3.2), '#3b2a20', ow * 0.8);
      pathPoly(ctx, taperPoly([at(0.14), at(0.6), at(1)], W(4.5), W(2.2)));
      fillStroke(ctx, '#c9d0d6', ow * 0.8);
      break;
    case 'bat': case 'batpregos':
      pathPoly(ctx, taperPoly([at(-0.18), at(0.3), at(1)], W(2.6), W(6.4)));
      fillStroke(ctx, '#c98f52', ow);
      circle(ctx, at(-0.2)[0], at(-0.2)[1], W(2.2), '#a86f38', ow * 0.7);
      if (kind === 'batpregos') for (const k of [0.62, 0.74, 0.86, 0.97]) {
        const a = upAt(k, 3.6), b = upAt(k, 6.5), c2 = upAt(k + 0.04, -3.6), d = upAt(k + 0.04, -6.5);
        ctx.strokeStyle = '#8d949a'; ctx.lineWidth = W(1.2); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c2[0], c2[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
      }
      break;
    case 'pipe':
      capsule(ctx, [at(-0.15), at(1)], W(3.4), '#8d969c', ow);
      break;
    case 'crowbar':
      capsule(ctx, [at(-0.1), at(0.9), upAt(1, 5)], W(3), '#b0302a', ow);
      break;
    case 'hammer': {
      capsule(ctx, [at(-0.15), at(0.85)], W(2.8), '#b98a52', ow * 0.9);
      const a = upAt(0.92, -5), b = upAt(0.92, 5);
      capsule(ctx, [a, b], W(5.5), '#6d757c', ow);
      break;
    }
    case 'axe': {
      capsule(ctx, [at(-0.12), at(1)], W(3), '#a8773f', ow * 0.9);
      const p1 = upAt(0.78, 2), p2 = upAt(0.98, 2), p3 = upAt(1.02, -9), p4 = upAt(0.72, -8);
      pathPoly(ctx, [p1, p2, p3, p4]); fillStroke(ctx, '#aeb6bc', ow);
      pathPoly(ctx, [upAt(1.0, -6), p3, p4, upAt(0.74, -5.5)]); ctx.fillStyle = '#d6dde2'; ctx.fill();
      break;
    }
    case 'pistol': {
      capsule(ctx, [at(-0.1), at(1)], W(4), '#2d2f36', ow);
      const hb = upAt(0.05, -6.5);
      capsule(ctx, [g, hb], W(3.6), '#3a3c44', ow);
      break;
    }
    case 'shotgun': case 'rifle': {
      const stock = kind === 'shotgun' ? '#8a5a30' : '#6e4a2c';
      pathPoly(ctx, taperPoly([at(-0.38), at(-0.05)], W(6), W(3.5)));
      fillStroke(ctx, stock, ow);
      capsule(ctx, [at(-0.05), at(1)], W(kind === 'shotgun' ? 3.6 : 3), '#2c2e35', ow);
      if (kind === 'shotgun') capsule(ctx, [at(0.42), at(0.62)], W(4.6), '#a0703e', ow * 0.8);
      else { capsule(ctx, [upAt(0.12, 3.5), upAt(0.35, 3.5)], W(3), '#1d1f25', ow * 0.7); capsule(ctx, [at(0.2), upAt(0.22, -6)], W(3), '#2c2e35', ow * 0.7); }
      break;
    }
    case 'sling': {
      const t = at(0.55), l = upAt(1, 3.5), r = upAt(1, -3.5);
      capsule(ctx, [at(-0.2), t], W(2.6), '#8a5a2c', ow * 0.8);
      capsule(ctx, [t, l], W(2.2), '#8a5a2c', ow * 0.8);
      capsule(ctx, [t, r], W(2.2), '#8a5a2c', ow * 0.8);
      break;
    }
    case 'megaphone': {
      pathPoly(ctx, taperPoly([at(0), at(1)], W(4), W(12)));
      fillStroke(ctx, '#f2f2ee', ow);
      const e = at(1); ellipse(ctx, e[0], e[1], W(3), W(6), Math.atan2(e[1] - g[1], e[0] - g[0]), '#d8413a', ow * 0.7);
      break;
    }
  }
  if (P.muzzle) {
    const tip = at(1.08), d = at(1.4);
    const ang = Math.atan2(d[1] - tip[1], d[0] - tip[0]);
    ctx.save(); ctx.translate(tip[0], tip[1]); ctx.rotate(ang);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = (i % 2 ? 3 : 8) * s; const a = (i / 10) * TAU; ctx.lineTo(Math.cos(a) * r * 1.4 + 5 * s, Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = '#ffd23a'; ctx.fill(); ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 1.2 * s; ctx.stroke();
    ctx.restore();
  }
}
function drawItem(ctx, kind, h, s, ow) {
  const [x, y] = h;
  switch (kind) {
    case 'food':
      ellipse(ctx, x, y - 3 * s, 5.5 * s, 3.6 * s, -0.3, '#e0a458', ow * 0.8);
      ctx.strokeStyle = '#b8732e'; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(x - 3 * s, y - 4 * s); ctx.lineTo(x - 1 * s, y - 2 * s); ctx.moveTo(x, y - 5 * s); ctx.lineTo(x + 2 * s, y - 3 * s); ctx.stroke();
      break;
    case 'can':
      ctx.beginPath(); ctx.rect(x - 3 * s, y - 8 * s, 6 * s, 8 * s); fillStroke(ctx, '#c9ced4', ow * 0.8);
      ctx.fillStyle = '#d8413a'; ctx.fillRect(x - 3 * s, y - 6 * s, 6 * s, 3 * s);
      break;
    case 'water':
      ctx.beginPath(); ctx.rect(x - 2.5 * s, y - 11 * s, 5 * s, 11 * s); fillStroke(ctx, '#bfe6f7', ow * 0.8);
      ctx.fillStyle = '#3a8fd0'; ctx.fillRect(x - 2.5 * s, y - 13 * s, 5 * s, 2 * s);
      break;
    case 'bandage':
      circle(ctx, x, y - 2 * s, 3.4 * s, '#f5f5f0', ow * 0.8);
      ctx.strokeStyle = '#f5f5f0'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(x + 2 * s, y); ctx.lineTo(x + 7 * s, y + 3 * s); ctx.stroke();
      break;
    case 'pills':
      ctx.beginPath(); ctx.rect(x - 2.5 * s, y - 7 * s, 5 * s, 7 * s); fillStroke(ctx, '#f09a2e', ow * 0.8);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 2.5 * s, y - 9 * s, 5 * s, 2 * s);
      break;
    case 'box':
      ctx.beginPath(); ctx.rect(x - 4 * s, y - 6 * s, 8 * s, 6 * s); fillStroke(ctx, '#c79a5e', ow * 0.8);
      break;
  }
}

// ---------------------------------------------------------------- cabelo
const hairCache = new Map();
function getHair(look) {
  let h = hairCache.get(look.id);
  if (!h) { h = buildHair(look); hairCache.set(look.id, h); }
  return h;
}
// blobs: {a, e, d, r}; spikes: {a, e, len, w, tilt}; sheets: faixas longas
function buildHair(look) {
  const H = look.hair || { style: 'bald' };
  const r = rng(hashStr(look.id + 'hair'));
  const blobs = [], spikes = [], sheets = [], strands = [];
  const ring = (e, n, d, rad, from = -PI, to = PI, jit = 0) => {
    for (let i = 0; i < n; i++) {
      const a = from + (to - from) * ((i + 0.5) / n) + (r() - 0.5) * jit;
      blobs.push({ a, e: e + (r() - 0.5) * jit * 0.5, d, r: rad * (1 + (r() - 0.5) * jit) });
    }
  };
  const vol = H.volume || 1;
  switch (H.style) {
    case 'messy': {
      ring(1.25, 3, 0.55 * vol, 0.55, -PI, PI, 0.4);
      ring(0.78, 7, 0.72 * vol, 0.46 * vol, -PI, PI, 0.35);
      ring(0.38, 8, 0.8 * vol, 0.4 * vol, 0.75, TAU - 0.75, 0.3);
      ring(-0.05, 6, 0.78, 0.4, PI * 0.55, PI * 1.45, 0.2);
      ring(-0.45, 4, 0.72, 0.36, PI * 0.7, PI * 1.3, 0.2);
      if (H.bangs !== false) {
        blobs.push({ a: -0.35, e: H.bangLow ?? 0.55, d: 0.82, r: 0.36 }, { a: 0.3, e: (H.bangLow ?? 0.55) + 0.05, d: 0.82, r: 0.35 }, { a: 0, e: (H.bangLow ?? 0.55) + 0.12, d: 0.82, r: 0.34 });
      }
      const nsp = H.spikes ?? 12;
      for (let i = 0; i < nsp; i++) spikes.push({ a: r() * TAU - PI, e: 0.45 + r() * 0.9, len: (0.22 + r() * 0.3) * (H.spikeLen || 1), w: 0.28 + r() * 0.14, tilt: (r() - 0.5) * 1.2 });
      if (H.strays) for (let i = 0; i < H.strays; i++) strands.push({ a: (r() - 0.5) * 2.5, e: 0.95 + r() * 0.4, len: 0.16 + r() * 0.2, curl: (r() - 0.5) * 2 });
      break;
    }
    case 'short': {
      ring(1.25, 3, 0.5, 0.56);
      ring(0.8, 7, 0.66, 0.44);
      ring(0.42, 9, 0.7, 0.4, -PI, PI, 0.1);
      ring(0.0, 5, 0.72, 0.38, PI * 0.58, PI * 1.42);
      ring(-0.4, 3, 0.68, 0.34, PI * 0.72, PI * 1.28);
      blobs.push({ a: 0, e: 0.62, d: 0.7, r: 0.38 });
      break;
    }
    case 'buzz': {
      ring(1.2, 3, 0.45, 0.6); ring(0.7, 7, 0.55, 0.5); ring(0.25, 8, 0.6, 0.44, PI * 0.35, PI * 1.65); ring(-0.3, 4, 0.58, 0.4, PI * 0.65, PI * 1.35);
      break;
    }
    case 'bob': case 'long': case 'wavy': case 'ponytail': case 'bun': case 'curly': {
      const curly = H.style === 'curly';
      ring(1.25, 3, 0.52, 0.58);
      ring(0.85, 8, 0.66, 0.48, -PI, PI, curly ? 0.4 : 0.05);
      ring(0.45, 8, 0.72, 0.44, 0.75, TAU - 0.75, curly ? 0.4 : 0.05);
      ring(0.0, 6, 0.74, 0.42, PI * 0.5, PI * 1.5, curly ? 0.4 : 0);
      ring(-0.45, 4, 0.7, 0.38, PI * 0.65, PI * 1.35);
      const part = H.part ?? 0;
      blobs.push({ a: part - 0.42, e: 0.88, d: 0.72, r: 0.42 }, { a: part + 0.42, e: 0.88, d: 0.72, r: 0.42 });
      if (curly) for (let i = 0; i < 16; i++) blobs.push({ a: r() * TAU - PI, e: 0.2 + r() * 1.1, d: 0.85, r: 0.26 + r() * 0.1 });
      if (H.style === 'bun') blobs.push({ a: PI, e: 0.75, d: 1.1, r: 0.46 });
      if (H.style === 'ponytail') sheets.push({ a0: PI - 0.25, a1: PI + 0.25, e: 0.35, drop: 2.2, flare: 0.1, wave: 0.2, bias: 0.25 });
      if (H.style === 'bob') {
        const len = H.len ?? 1.35;
        sheets.push({ a0: 0.92, a1: 1.9, e: 0.3, drop: len, flare: 0.14, wave: 0.03, bias: 0.3 });
        sheets.push({ a0: -1.9, a1: -0.92, e: 0.3, drop: len, flare: 0.14, wave: 0.03, bias: 0.3 });
        sheets.push({ a0: 1.9, a1: PI, e: 0.3, drop: len + 0.05, flare: 0.12, wave: 0.03, bias: 0.2 });
        sheets.push({ a0: PI, a1: TAU - 1.9, e: 0.3, drop: len + 0.05, flare: 0.12, wave: 0.03, bias: 0.2 });
      }
      if (H.style === 'long' || H.style === 'wavy') {
        const len = H.len ?? 3.2, wv = H.style === 'wavy' ? 0.16 : 0.03;
        sheets.push({ a0: 1.0, a1: 1.42, e: 0.25, drop: len * 0.7, flare: 0.18, wave: wv, bias: 0.35, front: true });
        sheets.push({ a0: -1.42, a1: -1.0, e: 0.25, drop: len * 0.7, flare: 0.18, wave: wv, bias: 0.35, front: true });
        sheets.push({ a0: 1.42, a1: 1.9, e: 0.25, drop: len * 0.9, flare: 0.3, wave: wv, bias: 0.1 });
        sheets.push({ a0: -1.9, a1: -1.42, e: 0.25, drop: len * 0.9, flare: 0.3, wave: wv, bias: 0.1 });
        sheets.push({ a0: 1.9, a1: PI, e: 0.3, drop: len, flare: 0.3, wave: wv, bias: 0.2 });
        sheets.push({ a0: PI, a1: TAU - 1.9, e: 0.3, drop: len, flare: 0.3, wave: wv, bias: 0.2 });
      }
      if (curly) {
        sheets.push({ a0: 0.95, a1: PI, e: 0.2, drop: H.len ?? 1.0, flare: 0.3, wave: 0.25, bias: 0.3 });
        sheets.push({ a0: PI, a1: TAU - 0.95, e: 0.2, drop: H.len ?? 1.0, flare: 0.3, wave: 0.25, bias: 0.3 });
      }
      break;
    }
    case 'horseshoe': {
      ring(0.15, 7, 0.78, 0.36, PI * 0.35, PI * 1.65);
      ring(-0.3, 4, 0.74, 0.34, PI * 0.55, PI * 1.45);
      break;
    }
    case 'hood': {
      ring(1.2, 3, 0.6, 0.62); ring(0.75, 8, 0.78, 0.52); ring(0.3, 8, 0.86, 0.48, 1.0, TAU - 1.0);
      ring(-0.2, 6, 0.86, 0.46, 1.2, TAU - 1.2); ring(-0.7, 5, 0.8, 0.44, 1.4, TAU - 1.4);
      break;
    }
    case 'sprout': { // chefe: brotos e folhas saindo da cabeça
      ring(0.9, 6, 0.7, 0.42); ring(0.3, 6, 0.74, 0.4, PI * 0.5, PI * 1.5);
      for (let i = 0; i < 9; i++) spikes.push({ a: r() * TAU - PI, e: 0.5 + r() * 1.0, len: 0.7 + r() * 0.6, w: 0.45, tilt: (r() - 0.5) * 1.4, leaf: true });
      break;
    }
  }
  return { blobs, spikes, sheets, strands, color: H.color || '#3a2418' };
}

// ponto na esfera da cabeça (em unidades de R): az a (0 = frente, + = esquerda do personagem), elevação e
function headPoint(H, a, e, d = 1) {
  const ce = Math.cos(e) * d;
  const x = H.rx / H.R * ce * Math.sin(a + H.yaw);
  const y = H.ry / H.R * Math.sin(e) * d;
  const z = ce * Math.cos(a + H.yaw);
  // rolagem leve da cabeça
  const cr = Math.cos(H.roll), sr = Math.sin(H.roll);
  const xr = x * cr - y * sr, yr = x * sr + y * cr;
  return { x: H.c[0] + xr * H.R, y: H.c[1] - (yr * CT - z * ST) * H.R, z };
}
function sheetPoints(sh, J, B, hyaw, yaw, V, look) {
  const R = B.headR;
  const n = 7;
  const pts = [];
  let zsum = 0;
  const r = rng(hashStr(look.id + sh.a0));
  const headV = V(J.head);
  const topRow = [], botRow = [];
  for (let i = 0; i <= n; i++) {
    const a = sh.a0 + (sh.a1 - sh.a0) * (i / n);
    const ce = Math.cos(sh.e);
    const lx = Math.sin(a) * ce * B.headW * 1.07, lz = Math.cos(a) * ce * 1.07;
    const ly = Math.sin(sh.e) * B.headH;
    const rot = (x, y, z) => {
      const c = Math.cos(hyaw), s = Math.sin(hyaw);
      return [x * c + z * s, y, -x * s + z * c];
    };
    const tp = rot(lx * R, ly * R, lz * R);
    const fl = 1 + sh.flare;
    const wv = Math.sin(i * 1.7 + r() * 0.5) * sh.wave * R;
    const bp = rot(lx * R * fl + wv, (ly - sh.drop) * R, lz * R * fl + wv * 0.5);
    topRow.push([headV[0] + tp[0], headV[1] + tp[1], headV[2] + tp[2]]);
    botRow.push([headV[0] + bp[0], headV[1] + bp[1], headV[2] + bp[2]]);
    zsum += headV[2] + (tp[2] + bp[2]) / 2;
  }
  // bordas laterais onduladas
  const side = (p, q) => {
    const out = [];
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      const w = Math.sin(t * PI * 2 + sh.a0) * sh.wave * R * 1.3;
      out.push([p[0] + (q[0] - p[0]) * t + w, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
    }
    return out;
  };
  pts.push(...topRow, ...side(topRow[n], botRow[n]));
  const bot = botRow.slice().reverse();
  // ponta ondulada
  for (let i = 0; i < bot.length; i++) {
    const p = bot[i];
    pts.push([p[0], p[1] - (i % 2 ? sh.wave * R * 1.5 : 0), p[2]]);
  }
  pts.push(...side(botRow[0], topRow[0]));
  return { pts, z: zsum / (n + 1) };
}
function drawSheet(ctx, look, pts3, Pj, s, ow, col) {
  const pts = pts3.map(p => Pj(p));
  pathPoly(ctx, pts, true);
  fillStroke(ctx, col, ow);
  // brilho do cabelo
  ctx.save(); ctx.clip();
  ctx.strokeStyle = shade(col, 0.18); ctx.lineWidth = 1 * s; ctx.globalAlpha = 0.7;
  const n = pts.length;
  for (let i = 2; i < 6 && i < n; i += 2) {
    const a = pts[i], b = pts[n - 1 - i];
    ctx.beginPath(); ctx.moveTo(a[0], a[1] + 4 * s); ctx.lineTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); ctx.stroke();
  }
  ctx.restore();
}
function drawHairGroup(ctx, H, list, col, ow) {
  if (!list.length) return;
  ctx.lineJoin = 'round';
  for (const pass of [0, 1]) {
    for (const it of list) {
      if (it.poly) {
        pathPoly(ctx, it.poly);
        if (pass === 0) { ctx.strokeStyle = INK; ctx.lineWidth = ow * 2; ctx.stroke(); }
        else { ctx.fillStyle = it.col || col; ctx.fill(); }
      } else {
        ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, TAU);
        if (pass === 0) { ctx.strokeStyle = INK; ctx.lineWidth = ow * 2; ctx.stroke(); }
        else { ctx.fillStyle = it.col || col; ctx.fill(); }
      }
    }
  }
}

// ---------------------------------------------------------------- cabeça
function drawHead(ctx, look, H, hair, P, ow) {
  const back = [], front = [];
  const col = hair.color;
  for (const b of hair.blobs) {
    const p = headPoint(H, b.a, b.e, b.d);
    (p.z < 0 ? back : front).push({ x: p.x, y: p.y, r: b.r * H.R });
  }
  for (const sp of hair.spikes) {
    const base = headPoint(H, sp.a, sp.e, 0.9);
    const tip = headPoint(H, sp.a + sp.tilt * 0.3, sp.e + sp.len * 0.8, 0.9 + sp.len);
    const dx = tip.x - base.x, dy = tip.y - base.y, l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l * sp.w * H.R * 0.5, ny = dx / l * sp.w * H.R * 0.5;
    const poly = [[base.x + nx, base.y + ny], [tip.x + dx * 0.1, tip.y + dy * 0.1], [base.x - nx, base.y - ny]];
    const item = { poly, col: sp.leaf ? (sp.tilt > 0 ? '#5aa83a' : '#7cc24a') : null };
    (base.z < 0 ? back : front).push(item);
  }
  // cabelo de trás
  drawHairGroup(ctx, H, back, col, ow);
  // orelhas
  const ears = [];
  for (const sd of [1, -1]) {
    const a = sd * PI / 2;
    const p = headPoint(H, a, -0.08, 0.98);
    const k = Math.abs(Math.cos(a + H.yaw));
    ears.push({ p, rx: H.R * (0.17 + 0.1 * k), ry: H.R * 0.27 });
  }
  const skin = look.skin;
  for (const e of ears) if (e.p.z <= 0.3) ellipse(ctx, e.p.x, e.p.y, e.rx, e.ry, 0, skin, ow);
  // cabeça
  ellipse(ctx, H.c[0], H.c[1], H.rx, H.ry, H.roll, skin, ow);
  if (look.jowls) {
    const p = headPoint(H, 0, -0.75, 0.9);
    ctx.save(); ctx.beginPath(); ctx.ellipse(H.c[0], H.c[1], H.rx, H.ry, H.roll, 0, TAU); ctx.clip();
    ctx.strokeStyle = shade(skin, -0.3); ctx.lineWidth = 1 * H.R / 13;
    if (p.z > 0) { ctx.beginPath(); ctx.arc(p.x, p.y - H.R * 0.1, H.R * 0.32, 0.4, PI - 0.4); ctx.stroke(); }
    ctx.restore();
  }
  if (look.stubble) {
    const r = rng(hashStr(look.id + 'stb'));
    ctx.save(); ctx.beginPath(); ctx.ellipse(H.c[0], H.c[1], H.rx, H.ry, H.roll, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(40,28,24,0.55)';
    for (let i = 0; i < 46; i++) {
      const a = (r() - 0.5) * 2.4, e = -0.35 - r() * 0.65;
      const p = headPoint(H, a, e, 1);
      if (p.z > 0.1) ctx.fillRect(p.x, p.y, 0.9 * H.R / 13, 0.9 * H.R / 13);
    }
    ctx.restore();
  }
  if (look.beard) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const a = -1.35 + 2.7 * (i / 12);
      const p = headPoint(H, a, -0.15 - Math.cos(a * 0.9) * 0.25, 1);
      if (p.z > -0.05) pts.push([p.x, p.y]);
    }
    for (let i = 12; i >= 0; i--) {
      const a = -1.35 + 2.7 * (i / 12);
      const p = headPoint(H, a, -1.05 - Math.cos(a) * 0.25, 1.06);
      if (p.z > -0.05) pts.push([p.x, p.y]);
    }
    if (pts.length > 4) { pathPoly(ctx, pts, true); fillStroke(ctx, look.beard, ow * 0.9); }
  }
  if (look.wounds) {
    const r = rng(hashStr(look.id + 'wd'));
    ctx.save(); ctx.beginPath(); ctx.ellipse(H.c[0], H.c[1], H.rx, H.ry, H.roll, 0, TAU); ctx.clip();
    for (let i = 0; i < look.wounds; i++) {
      const p = headPoint(H, (r() - 0.5) * 4, (r() - 0.3) * 1.4, 1);
      if (p.z > 0) circle(ctx, p.x, p.y, H.R * (0.1 + r() * 0.12), '#8a1f1f', 0);
    }
    ctx.restore();
  }
  for (const e of ears) if (e.p.z > 0.3) { ellipse(ctx, e.p.x, e.p.y, e.rx, e.ry, 0, skin, ow); }
  // cabelo da frente
  drawHairGroup(ctx, H, front, col, ow);
  if (look.hair?.part !== undefined && Math.cos(H.yaw + look.hair.part) > 0.2 && look.hair.style !== 'messy') {
    const a = headPoint(H, look.hair.part, 1.35, 1.02), b = headPoint(H, look.hair.part, 0.72, 1.06);
    ctx.strokeStyle = shade(col, -0.4); ctx.lineWidth = 1.1 * H.R / 13; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (const st of hair.strands) {
    const b = headPoint(H, st.a, st.e, 1.0), t = headPoint(H, st.a + st.curl * 0.2, st.e + st.len, 1.0 + st.len);
    if (b.z < -0.3) continue;
    ctx.strokeStyle = INK; ctx.lineWidth = 1.1 * H.R / 13; ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.quadraticCurveTo(t.x + st.curl * H.R * 0.25, (b.y + t.y) / 2, t.x, t.y); ctx.stroke();
  }
  drawHat(ctx, look, H, ow);
}

function drawHat(ctx, look, H, ow) {
  const hat = look.hat;
  if (!hat) return;
  if (hat.kind === 'cap') {
    const blobs = [];
    for (const e of [1.2, 0.75]) for (let i = 0; i < 7; i++) { const p = headPoint(H, -PI + (i + 0.5) / 7 * TAU, e, 0.62); blobs.push({ x: p.x, y: p.y, r: H.R * 0.5 }); }
    const vis = Math.cos(H.yaw);
    const brim = [];
    for (let i = 0; i <= 10; i++) { const a = -0.95 + 1.9 * i / 10; const p = headPoint(H, a, 0.55, 1.45); brim.push([p.x, p.y]); }
    for (let i = 10; i >= 0; i--) { const a = -0.95 + 1.9 * i / 10; const p = headPoint(H, a, 0.62, 0.95); brim.push([p.x, p.y]); }
    const drawBrim = () => { pathPoly(ctx, brim, true); fillStroke(ctx, hat.brim || shade(hat.color, -0.15), ow); };
    if (vis < 0) drawBrim();
    drawHairGroup(ctx, H, blobs, hat.color, ow);
    if (vis >= 0) drawBrim();
  } else if (hat.kind === 'straw') {
    const brim = [];
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; const p = headPoint(H, a, 0.62, 1.95); brim.push([p.x, p.y]); }
    pathPoly(ctx, brim, true); fillStroke(ctx, hat.color, ow);
    const crown = [];
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; const p = headPoint(H, a, 0.7, 0.95); crown.push([p.x, p.y]); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; const p = headPoint(H, a, 1.2, 1.05); crown.push([p.x, p.y]); }
    pathPoly(ctx, convexHull(crown), true); fillStroke(ctx, shade(hat.color, 0.1), ow);
    const band = [];
    for (let i = 0; i <= 12; i++) { const a = -PI / 2 - H.yaw + i / 12 * PI; const p = headPoint(H, a, 0.8, 1.0); band.push([p.x, p.y]); }
    ctx.strokeStyle = hat.band || '#b8322b'; ctx.lineWidth = 2.2 * H.R / 13; ctx.beginPath();
    band.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
  } else if (hat.kind === 'helmet' || hat.kind === 'beanie' || hat.kind === 'bandana') {
    const blobs = [];
    const lo = hat.kind === 'bandana' ? 0.5 : 0.35;
    for (const e of [1.25, 0.8, lo]) for (let i = 0; i < 8; i++) { const p = headPoint(H, -PI + (i + 0.5) / 8 * TAU, e, hat.kind === 'helmet' ? 0.72 : 0.62); blobs.push({ x: p.x, y: p.y, r: H.R * 0.5 }); }
    drawHairGroup(ctx, H, blobs, hat.color, ow);
    if (hat.kind === 'bandana') {
      const k = headPoint(H, PI, 0.5, 1.15);
      if (k.z < 0.2) { circle(ctx, k.x, k.y, H.R * 0.18, hat.color, ow * 0.8); }
    }
  } else if (hat.kind === 'headset') {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const a = PI / 2 - PI * i / 10; const p = headPoint(H, a, 0.9 * Math.sin(i / 10 * PI) + 0.1, 1.12); pts.push([p.x, p.y]); }
    ctx.strokeStyle = INK; ctx.lineWidth = 3.6 * H.R / 13; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    ctx.strokeStyle = hat.color; ctx.lineWidth = 1.8 * H.R / 13; ctx.stroke();
    for (const sd of [1, -1]) { const p = headPoint(H, sd * PI / 2, 0, 1.08); if (p.z > -0.4) circle(ctx, p.x, p.y, H.R * 0.26, hat.color, ow); }
  }
}

function drawEarring(ctx, look, H, a, ow) {
  const p = headPoint(H, a, -0.42, 1.0);
  const r = H.R * 0.2;
  ctx.lineWidth = 2.6 * H.R / 13; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.9, r * (0.55 + 0.45 * Math.abs(Math.sin(a + H.yaw))), r, 0, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.4 * H.R / 13; ctx.strokeStyle = look.earrings; ctx.stroke();
}

// ---------------------------------------------------------------- rosto
function drawFace(ctx, look, H, P, ow) {
  const F = Object.assign({}, look.face || {}, P.face || {});
  const R = H.R;
  const eyeR = (F.eyeSize || 0.36) * R;
  const lw = Math.max(1, 1.25 * R / 13);
  const pitchOff = -P.hp * 0.5;
  // olhos
  const eyeKind = F.eyes || 'open';
  for (const sd of [1, -1]) {
    const a = sd * (F.eyeSep || 0.43);
    const p = headPoint(H, a, 0.04 + pitchOff, 1.0);
    const vis = Math.cos(a + H.yaw);
    if (vis < -0.25) continue;
    const fx = 0.45 + 0.55 * Math.max(0, vis);
    const rx = eyeR * fx, ry = eyeR * (F.eyeTall || 1.05);
    const x = p.x, y = p.y;
    if (eyeKind === 'happy') {
      ellipse(ctx, x, y + ry * 0.25, rx * 0.85, ry * 0.55, 0, shade(look.skin, -0.08), 0);
      ctx.strokeStyle = INK; ctx.lineWidth = lw * 1.6; ctx.beginPath(); ctx.arc(x, y + ry * 0.45, rx * 0.8, PI * 1.12, PI * 1.88); ctx.stroke();
      continue;
    }
    if (eyeKind === 'closed') { ctx.strokeStyle = INK; ctx.lineWidth = lw * 1.3; ctx.beginPath(); ctx.moveTo(x - rx * 0.8, y); ctx.lineTo(x + rx * 0.8, y); ctx.stroke(); continue; }
    if (eyeKind === 'squint') {
      ctx.strokeStyle = INK; ctx.lineWidth = lw * 1.3; ctx.beginPath();
      ctx.moveTo(x - rx * 0.7 * sd, y - ry * 0.5); ctx.lineTo(x + rx * 0.5 * sd, y); ctx.lineTo(x - rx * 0.7 * sd, y + ry * 0.5); ctx.stroke(); continue;
    }
    if (eyeKind === 'x') {
      ctx.strokeStyle = INK; ctx.lineWidth = lw * 1.3; ctx.beginPath();
      ctx.moveTo(x - rx * 0.6, y - ry * 0.6); ctx.lineTo(x + rx * 0.6, y + ry * 0.6); ctx.moveTo(x + rx * 0.6, y - ry * 0.6); ctx.lineTo(x - rx * 0.6, y + ry * 0.6); ctx.stroke(); continue;
    }
    if (eyeKind === 'zombie') {
      ellipse(ctx, x, y, rx * 1.18, ry * 1.18, 0, 'rgba(60,40,70,0.55)', 0);
      ellipse(ctx, x, y, rx * 0.92, ry * 0.92, 0, F.sclera || '#f3f0c8', lw);
      if (F.pupil !== 'none') circle(ctx, x + rx * 0.2 * Math.sin(H.yaw), y + ry * 0.15, R * 0.05, F.pupilColor || '#b0231c', 0);
      continue;
    }
    const wide = eyeKind === 'wide';
    const k = wide ? 1.15 : eyeKind === 'narrow' ? 1 : 1;
    ellipse(ctx, x, y, rx * k, ry * k, 0, '#ffffff', lw);
    if (eyeKind === 'narrow') {
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = look.skin; ctx.fillRect(x - rx - 1, y - ry - 1, rx * 2 + 2, ry * 0.75);
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x - rx, y - ry * 0.25); ctx.lineTo(x + rx, y - ry * 0.25); ctx.stroke();
    }
    if (eyeKind === 'sleepy') {
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = look.skin; ctx.fillRect(x - rx - 1, y - ry - 1, rx * 2 + 2, ry * 0.9);
      ctx.restore();
    }
    const pr = (wide ? 0.042 : F.pupilR || 0.062) * R;
    const px = x + rx * 0.28 * Math.sin(H.yaw) + (F.look ? F.look[0] * rx * 0.3 : 0);
    const py = y + (F.look ? F.look[1] * ry * 0.3 : 0) + (eyeKind === 'narrow' ? ry * 0.15 : 0);
    circle(ctx, px, py, pr, INK, 0);
    if (F.lashes) {
      ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.beginPath();
      const outer = Math.sin(a + H.yaw) >= 0 ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        const ang = -PI / 2 + outer * (0.45 + i * 0.32);
        const bx = x + Math.cos(ang) * rx, by = y + Math.sin(ang) * ry;
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(ang) * R * 0.12, by + Math.sin(ang) * R * 0.12);
      }
      ctx.stroke();
    }
    if (F.bags) {
      ctx.strokeStyle = shade(look.skin, -0.35); ctx.lineWidth = lw * 0.8;
      ctx.beginPath(); ctx.arc(x, y + ry * 0.35, rx * 0.95, PI * 0.2, PI * 0.8); ctx.stroke();
    }
    if (F.brows === 'worried' || F.brows === 'angry') {
      ctx.strokeStyle = INK; ctx.lineWidth = lw * 1.3; ctx.beginPath();
      const inner = F.brows === 'worried' ? -1 : 1;
      ctx.moveTo(x - rx * 0.7 * sd, y - ry * 1.25 + inner * ry * 0.15); ctx.lineTo(x + rx * 0.7 * sd, y - ry * 1.25 - inner * ry * 0.15); ctx.stroke();
    }
    if (F.glasses) {
      ctx.strokeStyle = F.glasses; ctx.lineWidth = lw * 1.2; ctx.beginPath(); ctx.ellipse(x, y, rx * 1.15, ry * 1.1, 0, 0, TAU); ctx.stroke();
    }
  }
  if (F.glasses) {
    const a = headPoint(H, 0.18, 0.08 + pitchOff, 1.02), b = headPoint(H, -0.18, 0.08 + pitchOff, 1.02);
    if (a.z > 0 || b.z > 0) { ctx.strokeStyle = F.glasses; ctx.lineWidth = lw * 1.2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  }
  // nariz
  const np = headPoint(H, 0, -0.2 + pitchOff, 1.04);
  if (np.z > -0.1) {
    const side = Math.sin(H.yaw) >= 0 ? 1 : -1;
    ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath();
    const nr = R * (F.nose || 0.1);
    ctx.arc(np.x + side * nr * 0.3, np.y, nr, side > 0 ? -PI * 0.4 : PI * 0.4, side > 0 ? PI * 0.6 : PI * 1.4);
    ctx.stroke();
  }
  // boca
  const mp = headPoint(H, 0, -0.5 + pitchOff + (F.mouthUp || 0), 1.0);
  if (mp.z > -0.15) {
    const fx = 0.4 + 0.6 * Math.max(0, Math.cos(H.yaw));
    const mw = R * 0.34 * fx * (F.mouthW || 1);
    const x = mp.x + R * 0.12 * Math.sin(H.yaw), y = mp.y;
    const kind = F.mouth || 'smile';
    ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineCap = 'round';
    switch (kind) {
      case 'smile':
        ctx.beginPath(); ctx.arc(x, y - mw * 0.8, mw, PI * 0.28, PI * 0.72); ctx.stroke(); break;
      case 'grin': {
        ctx.beginPath(); ctx.moveTo(x - mw * 1.1, y - mw * 0.25);
        ctx.quadraticCurveTo(x, y - mw * 0.05, x + mw * 1.1, y - mw * 0.25);
        ctx.quadraticCurveTo(x, y + mw * 1.05, x - mw * 1.1, y - mw * 0.25);
        fillStroke(ctx, '#6a1f24', lw);
        ctx.save(); ctx.clip();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - mw * 1.2, y - mw * 0.4, mw * 2.4, mw * 0.42);
        ctx.fillStyle = '#e46a78'; ctx.beginPath(); ctx.ellipse(x, y + mw * 0.7, mw * 0.6, mw * 0.3, 0, 0, TAU); ctx.fill();
        ctx.restore();
        break;
      }
      case 'flat':
        ctx.beginPath(); ctx.moveTo(x - mw * 0.7, y); ctx.lineTo(x + mw * 0.7, y); ctx.stroke(); break;
      case 'wavy':
        ctx.beginPath(); ctx.moveTo(x - mw * 0.9, y);
        for (let i = 1; i <= 4; i++) ctx.lineTo(x - mw * 0.9 + i * mw * 0.45, y + (i % 2 ? -1 : 1) * mw * 0.18);
        ctx.stroke(); break;
      case 'o': case 'chew':
        ellipse(ctx, x, y, mw * (kind === 'o' ? 0.35 : 0.5), mw * (kind === 'o' ? 0.42 : 0.2), 0, '#5a1a20', lw); break;
      case 'open':
        ellipse(ctx, x, y + mw * 0.1, mw * 0.55, mw * 0.45, 0, '#5a1a20', lw); break;
      case 'yell': case 'scream': {
        const h = kind === 'scream' ? 0.95 : 0.65;
        ellipse(ctx, x, y + mw * 0.2, mw * 0.75, mw * h, 0, '#4f1219', lw);
        ctx.save(); ctx.beginPath(); ctx.ellipse(x, y + mw * 0.2, mw * 0.75, mw * h, 0, 0, TAU); ctx.clip();
        ctx.fillStyle = '#e46a78'; ctx.beginPath(); ctx.ellipse(x, y + mw * (0.2 + h * 0.8), mw * 0.5, mw * 0.35, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(x - mw, y + mw * (0.2 - h), mw * 2, mw * 0.25);
        ctx.restore(); break;
      }
      case 'grit': {
        ctx.beginPath(); ctx.rect(x - mw * 0.75, y - mw * 0.22, mw * 1.5, mw * 0.44); fillStroke(ctx, '#ffffff', lw);
        ctx.beginPath(); ctx.moveTo(x - mw * 0.75, y); ctx.lineTo(x + mw * 0.75, y);
        for (let i = -1; i <= 1; i++) { ctx.moveTo(x + i * mw * 0.35, y - mw * 0.22); ctx.lineTo(x + i * mw * 0.35, y + mw * 0.22); }
        ctx.lineWidth = lw * 0.7; ctx.stroke(); break;
      }
      case 'zombie': case 'bite': {
        const h = kind === 'bite' ? 0.75 : 0.45;
        ctx.beginPath(); ctx.moveTo(x - mw * 0.85, y - mw * 0.1);
        ctx.lineTo(x + mw * 0.85, y - mw * 0.2); ctx.lineTo(x + mw * 0.6, y + mw * h); ctx.lineTo(x - mw * 0.7, y + mw * h * 0.9); ctx.closePath();
        fillStroke(ctx, '#3a0f14', lw);
        ctx.fillStyle = '#eee8c8';
        for (let i = 0; i < 4; i++) { const tx = x - mw * 0.6 + i * mw * 0.38; ctx.beginPath(); ctx.moveTo(tx, y - mw * 0.14); ctx.lineTo(tx + mw * 0.15, y + mw * 0.12); ctx.lineTo(tx + mw * 0.3, y - mw * 0.16); ctx.fill(); }
        if (look.blood !== false) { ctx.fillStyle = '#8a1c1c'; ctx.beginPath(); ctx.ellipse(x + mw * 0.3, y + mw * (h + 0.35), mw * 0.18, mw * 0.35, 0, 0, TAU); ctx.fill(); }
        break;
      }
    }
  }
  // bigode
  if (look.mustache) {
    const m = headPoint(H, 0, -0.35 + pitchOff, 1.03);
    if (m.z > -0.1) {
      const fx = 0.45 + 0.55 * Math.max(0, Math.cos(H.yaw));
      const w = R * 0.42 * fx, h = R * 0.14;
      const x = m.x + R * 0.1 * Math.sin(H.yaw), y = m.y;
      ctx.beginPath();
      ctx.moveTo(x, y - h * 0.6);
      ctx.bezierCurveTo(x - w * 0.5, y - h * 1.2, x - w * 1.1, y - h * 0.2, x - w * 1.2, y + h * 1.2);
      ctx.bezierCurveTo(x - w * 0.8, y + h * 0.4, x - w * 0.3, y + h * 0.6, x, y + h * 0.1);
      ctx.bezierCurveTo(x + w * 0.3, y + h * 0.6, x + w * 0.8, y + h * 0.4, x + w * 1.2, y + h * 1.2);
      ctx.bezierCurveTo(x + w * 1.1, y - h * 0.2, x + w * 0.5, y - h * 1.2, x, y - h * 0.6);
      fillStroke(ctx, look.mustache, lw * 0.9);
    }
  }
  if (F.sweat) {
    for (const [a, e, k] of [[0.8, 0.5, 1], [-0.75, 0.62, 0.8], [0.95, -0.1, 0.7]]) {
      const p = headPoint(H, a, e, 1.02);
      if (p.z < 0.05) continue;
      const r = R * 0.08 * k;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - r * 2.2); ctx.quadraticCurveTo(p.x + r * 1.3, p.y, p.x, p.y + r); ctx.quadraticCurveTo(p.x - r * 1.3, p.y, p.x, p.y - r * 2.2);
      fillStroke(ctx, '#a8dcf2', lw * 0.7);
    }
  }
  if (F.blush) {
    for (const sd of [1, -1]) { const p = headPoint(H, sd * 0.62, -0.3, 1); if (p.z > 0.2) ellipse(ctx, p.x, p.y, R * 0.12, R * 0.07, 0, 'rgba(240,120,120,0.45)', 0); }
  }
}

// ---------------------------------------------------------------- retrato procedural
// Pinta um busto (cabeça e ombros) para NPCs e zumbis, que não têm arte original.
export function paintPortrait(canvas, look, dir = 0) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const B = look.body;
  const sc = (H * 0.5) / (2 * B.headR * B.headH) / (look.scale || 1);
  if (look.gait === 'crawler') {
    // quem anda agachado: pinta inteiro e recorta em volta do ponto mais alto (a cabeça)
    const tw = W * 3, th = H * 4;
    const t = document.createElement('canvas'); t.width = tw; t.height = th;
    const tg = t.getContext('2d', { willReadFrequently: true });
    paintFrame(tg, look, 'idle', 0, dir, 'none', tw / 2, th * 0.9, sc);
    const data = tg.getImageData(0, 0, tw, th).data;
    let top = -1;
    for (let y = 0; y < th && top < 0; y++) for (let x = 0; x < tw; x++) if (data[(y * tw + x) * 4 + 3] > 40) { top = y; break; }
    const hh = 2 * B.headR * B.headH * sc;
    let sx = 0, n = 0;
    for (let y = Math.max(0, top); y < Math.min(th, top + hh); y++) for (let x = 0; x < tw; x++) if (data[(y * tw + x) * 4 + 3] > 40) { sx += x; n++; }
    const cx = n ? sx / n : tw / 2;
    ctx.drawImage(t, cx - W / 2, top - H * 0.16, W, H, 0, 0, W, H);
    return;
  }
  const headCenter = (B.thigh + B.shin + B.footH + B.torsoLen + B.neck + B.headR * B.headH * 0.9) * sc * (look.scale || 1);
  paintFrame(ctx, look, 'idle', 0, dir, 'none', W / 2, H * 0.46 + headCenter, sc);
}
