// Som feito na hora com Web Audio: efeitos, ambiente (vento, pássaros, grilos)
// e uma música discreta de exploração. Nenhum arquivo de áudio é necessário.
import { clamp, R } from './util.js';

let ctx = null, master, sfxBus, musicBus, ambBus, reverb, noiseBuf;
const vol = { master: 0.8, sfx: 0.9, music: 0.45 };
let listener = { x: 0, z: 0 };
let ambient = null, music = null;

export function audioReady() { return !!ctx; }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = vol.master;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = vol.music; musicBus.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = vol.sfx * 0.8; ambBus.connect(master);
  // reverberação curta gerada (dá corpo aos sons)
  reverb = ctx.createConvolver();
  const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  reverb.buffer = ir;
  const rvGain = ctx.createGain(); rvGain.gain.value = 0.35;
  reverb.connect(rvGain); rvGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  startAmbient();
  startMusic();
}

export function setVolumes(v) {
  Object.assign(vol, v);
  if (!ctx) return;
  master.gain.value = vol.master; sfxBus.gain.value = vol.sfx; musicBus.gain.value = vol.music; ambBus.gain.value = vol.sfx * 0.8;
}
export function getVolumes() { return { ...vol }; }
export function setListener(x, z) { listener.x = x; listener.z = z; }

// ---------- blocos básicos ----------
function out(x, z, gain = 1, wet = 0.15) {
  const g = ctx.createGain();
  let k = gain;
  let pan = 0;
  if (x != null) {
    const d = Math.hypot(x - listener.x, z - listener.z);
    k *= clamp(1 - d / 45, 0, 1) ** 1.6;
    pan = clamp((x - listener.x) / 20, -0.8, 0.8);
  }
  g.gain.value = k;
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = pan; g.connect(p); p.connect(sfxBus); } else g.connect(sfxBus);
  if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet * k; g.connect(w); w.connect(reverb); }
  return k > 0.001 ? g : null;
}
function noise(dest, t, dur, { type = 'bandpass', f = 1000, q = 1, f2 = null, a = 0.005, v = 1 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(dest);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function tone(dest, t, dur, { type = 'sine', f = 440, f2 = null, a = 0.005, v = 0.5, rel = null } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (rel ?? dur));
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + (rel ?? dur) + 0.05);
}

// ---------- efeitos ----------
const SFX = {
  step(d, t, o) { // passo: terra/grama/asfalto/madeira
    const f = { grass: 900, dirt: 700, road: 1500, wood: 500, sand: 600 }[o.surface] || 800;
    noise(d, t, 0.09, { f, q: 1.2, v: 0.35 * (o.run ? 1.3 : 1), type: 'bandpass' });
    tone(d, t, 0.05, { f: 90 + Math.random() * 20, v: 0.12 });
  },
  swing(d, t) { noise(d, t, 0.22, { f: 500, f2: 2600, q: 2, v: 0.4, a: 0.05 }); },
  hit(d, t) { // pancada em carne
    noise(d, t, 0.14, { type: 'lowpass', f: 900, v: 0.8 });
    tone(d, t, 0.14, { type: 'triangle', f: 140, f2: 60, v: 0.6 });
  },
  hitHard(d, t) { noise(d, t, 0.2, { type: 'lowpass', f: 1400, v: 0.9 }); tone(d, t, 0.2, { type: 'square', f: 110, f2: 40, v: 0.35 }); },
  chop(d, t) { // machado na madeira
    tone(d, t, 0.12, { type: 'triangle', f: 320, f2: 180, v: 0.6 });
    noise(d, t, 0.12, { f: 1800, q: 3, v: 0.5 });
    noise(d, t + 0.02, 0.25, { type: 'lowpass', f: 400, v: 0.3 });
  },
  mine(d, t) { // picareta na pedra
    tone(d, t, 0.25, { type: 'square', f: 1250, f2: 900, v: 0.18 });
    tone(d, t, 0.18, { type: 'triangle', f: 2400, v: 0.15 });
    noise(d, t, 0.1, { f: 3500, q: 2, v: 0.5 });
  },
  rustle(d, t) { noise(d, t, 0.35, { f: 2500, q: 0.6, v: 0.35, a: 0.05 }); noise(d, t + 0.12, 0.3, { f: 3200, q: 0.8, v: 0.25, a: 0.04 }); },
  pickup(d, t) { tone(d, t, 0.08, { f: 660, v: 0.25 }); tone(d, t + 0.07, 0.12, { f: 990, v: 0.2 }); },
  search(d, t) { for (let i = 0; i < 4; i++) noise(d, t + i * 0.13, 0.1, { f: 1200 + Math.random() * 1500, q: 1.5, v: 0.3 }); },
  open(d, t) { // rangido de baú/porta
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t); o.frequency.linearRampToValueAtTime(260, t + 0.2); o.frequency.linearRampToValueAtTime(150, t + 0.45);
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 900; fl.Q.value = 6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(fl); fl.connect(g); g.connect(d); o.start(t); o.stop(t + 0.55);
    noise(d, t + 0.45, 0.12, { type: 'lowpass', f: 500, v: 0.5 });
  },
  door(d, t) { SFX.open(d, t); },
  build(d, t) { for (let i = 0; i < 3; i++) { tone(d, t + i * 0.16, 0.1, { type: 'triangle', f: 420, f2: 200, v: 0.5 }); noise(d, t + i * 0.16, 0.08, { f: 2000, q: 2, v: 0.4 }); } },
  craft(d, t) { noise(d, t, 0.15, { f: 1500, q: 1, v: 0.3 }); tone(d, t + 0.12, 0.1, { type: 'triangle', f: 520, v: 0.3 }); tone(d, t + 0.25, 0.2, { f: 780, v: 0.25 }); },
  eat(d, t) { for (let i = 0; i < 3; i++) noise(d, t + i * 0.18, 0.08, { f: 1800, q: 2, v: 0.35 }); },
  drink(d, t) { for (let i = 0; i < 4; i++) tone(d, t + i * 0.16, 0.1, { f: 300 + Math.random() * 80, f2: 600, v: 0.25 }); },
  heal(d, t) { noise(d, t, 0.5, { f: 3000, q: 0.5, v: 0.2, a: 0.1 }); tone(d, t + 0.2, 0.4, { f: 520, v: 0.12 }); tone(d, t + 0.3, 0.4, { f: 780, v: 0.1 }); },
  hurt(d, t) { tone(d, t, 0.25, { type: 'sawtooth', f: 260, f2: 140, v: 0.25 }); noise(d, t, 0.15, { type: 'lowpass', f: 700, v: 0.6 }); },
  gunPistol(d, t) { noise(d, t, 0.25, { type: 'lowpass', f: 3000, v: 1 }); tone(d, t, 0.2, { type: 'square', f: 180, f2: 45, v: 0.6 }); noise(d, t + 0.02, 0.9, { type: 'lowpass', f: 600, v: 0.3, a: 0.01 }); },
  gunShotgun(d, t) { noise(d, t, 0.45, { type: 'lowpass', f: 2200, v: 1 }); tone(d, t, 0.35, { type: 'square', f: 120, f2: 35, v: 0.8 }); noise(d, t + 0.03, 1.3, { type: 'lowpass', f: 450, v: 0.4 }); },
  gunRifle(d, t) { noise(d, t, 0.3, { type: 'highpass', f: 1200, v: 0.9 }); tone(d, t, 0.25, { type: 'square', f: 220, f2: 50, v: 0.7 }); noise(d, t + 0.02, 1.4, { type: 'lowpass', f: 700, v: 0.35 }); },
  bow(d, t) { tone(d, t, 0.15, { type: 'triangle', f: 180, f2: 90, v: 0.4 }); noise(d, t, 0.2, { f: 1500, f2: 500, v: 0.3 }); },
  empty(d, t) { tone(d, t, 0.04, { type: 'square', f: 1500, v: 0.2 }); },
  reload(d, t) { noise(d, t, 0.06, { f: 2500, q: 4, v: 0.5 }); noise(d, t + 0.35, 0.08, { f: 1800, q: 4, v: 0.6 }); tone(d, t + 0.36, 0.05, { type: 'square', f: 800, v: 0.2 }); },
  break(d, t) { noise(d, t, 0.35, { type: 'lowpass', f: 1200, v: 0.8 }); for (let i = 0; i < 4; i++) tone(d, t + i * 0.05, 0.1, { type: 'triangle', f: 300 - i * 40, v: 0.3 }); },
  treeFall(d, t) { noise(d, t, 1.2, { type: 'lowpass', f: 300, v: 0.8, a: 0.2 }); tone(d, t + 0.8, 0.5, { f: 70, f2: 40, v: 0.6 }); },
  // zumbis: gemido grave com formante
  zGroan(d, t, o) {
    const base = (o.pitch || 1) * (70 + Math.random() * 40), dur = 0.8 + Math.random() * 0.8;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, t); osc.frequency.linearRampToValueAtTime(base * (0.7 + Math.random() * 0.5), t + dur);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5 + Math.random() * 6; const lg = ctx.createGain(); lg.gain.value = base * 0.08;
    lfo.connect(lg); lg.connect(osc.frequency);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 400 + Math.random() * 300; f1.Q.value = 4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f1); f1.connect(g); g.connect(d); osc.start(t); lfo.start(t); osc.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
    noise(d, t, dur * 0.9, { f: 700, q: 3, v: 0.15, a: 0.1 });
  },
  zScream(d, t, o) { // alerta / corredor
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    const f = (o.pitch || 1) * 260;
    osc.frequency.setValueAtTime(f, t); osc.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.15); osc.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.7);
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1100; fl.Q.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    osc.connect(fl); fl.connect(g); g.connect(d); osc.start(t); osc.stop(t + 0.8);
    noise(d, t, 0.6, { f: 1500, q: 1, v: 0.3 });
  },
  zAttack(d, t) { noise(d, t, 0.25, { f: 900, q: 2, v: 0.5 }); SFX.zScream(d, t, { pitch: 0.7 }); },
  zDie(d, t) { tone(d, t, 0.9, { type: 'sawtooth', f: 120, f2: 40, v: 0.3 }); noise(d, t + 0.4, 0.3, { type: 'lowpass', f: 400, v: 0.7 }); },
  boss(d, t) { tone(d, t, 1.6, { type: 'sawtooth', f: 55, f2: 35, v: 0.6, a: 0.2 }); noise(d, t, 1.4, { type: 'lowpass', f: 300, v: 0.6, a: 0.2 }); },
  levelUp(d, t) { [523, 659, 784, 1046].forEach((f, i) => tone(d, t + i * 0.1, 0.35, { type: 'triangle', f, v: 0.25 })); },
  quest(d, t) { [440, 554, 659].forEach((f, i) => tone(d, t + i * 0.12, 0.5, { type: 'triangle', f, v: 0.22 })); },
  ui(d, t) { tone(d, t, 0.05, { f: 900, v: 0.12 }); },
  uiBack(d, t) { tone(d, t, 0.06, { f: 600, v: 0.12 }); },
  denied(d, t) { tone(d, t, 0.15, { type: 'square', f: 180, v: 0.15 }); tone(d, t + 0.12, 0.2, { type: 'square', f: 140, v: 0.15 }); },
  death(d, t) { [392, 330, 262, 196].forEach((f, i) => tone(d, t + i * 0.3, 0.9, { type: 'triangle', f, v: 0.25 })); },
  fire(d, t) { for (let i = 0; i < 6; i++) noise(d, t + Math.random() * 0.8, 0.05, { f: 3000 + Math.random() * 2000, q: 3, v: 0.2 }); },
};

export function sfx(name, { x = null, z = null, vol: v = 1, wet = 0.15, ...o } = {}) {
  if (!ctx || !SFX[name]) return;
  const d = out(x, z, v, wet);
  if (!d) return;
  SFX[name](d, ctx.currentTime + 0.005, o);
}

// ---------- ambiente ----------
function startAmbient() {
  // vento: ruído filtrado com filtro que "respira"
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 0.6;
  const g = ctx.createGain(); g.gain.value = 0.12;
  s.connect(f); f.connect(g); g.connect(ambBus); s.start();
  ambient = { windF: f, windG: g, nextBird: 2, nextCricket: 0, nextDistant: 12, t: 0, night: 0, danger: 0 };
}
// chamado todo quadro com a hora do dia (0..1 noite) e perigo da região
export function updateAmbient(dt, night, danger) {
  if (!ctx || !ambient) return;
  const A = ambient; A.t += dt; A.night = night; A.danger = danger;
  const now = ctx.currentTime;
  A.windF.frequency.setTargetAtTime(380 + Math.sin(A.t * 0.13) * 180 + Math.sin(A.t * 0.37) * 90, now, 0.5);
  A.windG.gain.setTargetAtTime(0.08 + (Math.sin(A.t * 0.21) * 0.5 + 0.5) * 0.1, now, 0.8);
  A.nextBird -= dt;
  if (A.nextBird <= 0) {
    A.nextBird = (night > 0.5 ? 25 : 3) + Math.random() * 7;
    if (night < 0.6) bird();
  }
  A.nextCricket -= dt;
  if (A.nextCricket <= 0 && night > 0.4) { A.nextCricket = 0.4 + Math.random() * 0.8; cricket(night); }
  A.nextDistant -= dt;
  if (A.nextDistant <= 0) {
    A.nextDistant = 18 + Math.random() * 30;
    // sons distantes: gemido abafado, cachorro, sino, estalo
    const r = Math.random();
    const g = ctx.createGain(); g.gain.value = 0.25; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    g.connect(lp); lp.connect(reverb); lp.connect(ambBus);
    const t = now + 0.01;
    if (r < 0.45) SFX.zGroan(g, t, { pitch: 0.8 });
    else if (r < 0.65) { for (let i = 0; i < 3; i++) tone(g, t + i * 0.35, 0.12, { type: 'sawtooth', f: 520, f2: 300, v: 0.25 }); }
    else if (r < 0.8) SFX.gunRifle(g, t);
    else tone(g, t, 3, { type: 'sine', f: 196, v: 0.3, a: 0.01 });
  }
}
function bird() {
  const t0 = ctx.currentTime + 0.01, g = ctx.createGain(); g.gain.value = 0.06 + Math.random() * 0.05;
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = Math.random() * 1.6 - 0.8; g.connect(p); p.connect(ambBus); } else g.connect(ambBus);
  const f = 2200 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 5), kind = Math.random();
  for (let i = 0; i < n; i++) {
    const t = t0 + i * (0.09 + Math.random() * 0.08);
    if (kind < 0.5) tone(g, t, 0.07, { f: f * (1 + Math.random() * 0.15), f2: f * 1.4, v: 0.8 });
    else tone(g, t, 0.12, { f: f * 1.3, f2: f * 0.8, v: 0.8 });
  }
}
function cricket(night) {
  const t0 = ctx.currentTime + 0.01, g = ctx.createGain(); g.gain.value = 0.02 * night; g.connect(ambBus);
  for (let i = 0; i < 3; i++) tone(g, t0 + i * 0.05, 0.03, { f: 4200 + Math.random() * 300, v: 1 });
}

// ---------- música ----------
// acordes lentos em lá menor, com notas soltas; fica mais tensa em áreas perigosas
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62], [57, 60, 64], [50, 53, 57], [52, 55, 59], [52, 56, 59]];
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
function startMusic() {
  music = { i: 0, next: 0.5, combat: 0, intensity: 0 };
}
export function setMusicIntensity(k) { if (music) music.intensity = k; }
export function updateMusic(dt) {
  if (!ctx || !music) return;
  music.next -= dt;
  if (music.next > 0) return;
  const chord = CHORDS[music.i % CHORDS.length];
  music.i++;
  const len = 7;
  music.next = len;
  const t = ctx.currentTime + 0.05;
  const tense = music.intensity;
  // pad
  for (const n of chord) {
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(n - 12); o.detune.value = det;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500 + tense * 400; f.Q.value = 0.5;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022, t + 2.5); g.gain.linearRampToValueAtTime(0.0001, t + len + 1.5);
      o.connect(f); f.connect(g); g.connect(musicBus); const w = ctx.createGain(); w.gain.value = 0.6; g.connect(w); w.connect(reverb);
      o.start(t); o.stop(t + len + 1.6);
    }
  }
  // baixo
  tone(musicBus, t, len, { type: 'triangle', f: midi(chord[0] - 24), v: 0.06, a: 1.5 });
  // notas soltas tipo violão/piano
  const notes = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < notes; i++) {
    const n = chord[Math.floor(Math.random() * 3)] + (Math.random() < 0.5 ? 12 : 0);
    const nt = t + 0.8 + i * (1.2 + Math.random() * 1.2);
    const g = ctx.createGain(); g.gain.value = 0.9; g.connect(musicBus); const w = ctx.createGain(); w.gain.value = 0.7; g.connect(w); w.connect(reverb);
    tone(g, nt, 2.2, { type: 'triangle', f: midi(n), v: 0.05, a: 0.004 });
    tone(g, nt, 1.2, { type: 'sine', f: midi(n + 12), v: 0.015, a: 0.004 });
  }
  // pulso grave quando o perigo é alto
  if (tense > 0.4) for (let i = 0; i < 7; i++) tone(musicBus, t + i, 0.4, { type: 'sine', f: 55, f2: 45, v: 0.07 * tense });
}

export function randomPitch() { return 0.8 + R() * 0.4; }
