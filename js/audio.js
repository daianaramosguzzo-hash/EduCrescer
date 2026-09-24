// Áudio chiptune sintetizado (efeitos e músicas originais).
let ctx = null, master = null, musicGain = null;
let enabled = true;
let current = null, timer = null, step = 0, nextTime = 0;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.5 : 0;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.55;
    musicGain.connect(master);
  } catch (e) { ctx = null; }
}

export function setSound(on) {
  enabled = on;
  if (master) master.gain.value = on ? 0.5 : 0;
}
export function soundOn() { return enabled; }

const hz = n => 440 * Math.pow(2, (n - 69) / 12);

function tone(freq, t, dur, type = 'square', vol = 0.1, dest = master, slide = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(t, dur, vol = 0.2) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = vol;
  s.connect(g); g.connect(master);
  s.start(t);
}

export function sfx(name) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime;
  switch (name) {
    case 'text': tone(1400, t, 0.02, 'square', 0.015); break;
    case 'move': tone(900, t, 0.04, 'square', 0.04); break;
    case 'select': tone(1200, t, 0.05, 'square', 0.05); tone(1800, t + 0.04, 0.06, 'square', 0.04); break;
    case 'back': tone(700, t, 0.06, 'square', 0.05); break;
    case 'bump': tone(120, t, 0.08, 'square', 0.08); break;
    case 'door': noise(t, 0.12, 0.08); tone(300, t, 0.12, 'triangle', 0.1, master, 0.5); break;
    case 'hit': noise(t, 0.15, 0.25); tone(200, t, 0.12, 'square', 0.1, master, 0.4); break;
    case 'superhit': noise(t, 0.3, 0.35); tone(300, t, 0.25, 'sawtooth', 0.12, master, 0.3); break;
    case 'weakhit': noise(t, 0.08, 0.12); break;
    case 'faint': tone(600, t, 0.6, 'square', 0.08, master, 0.2); break;
    case 'throw': tone(500, t, 0.3, 'triangle', 0.1, master, 2.5); break;
    case 'shake': tone(220, t, 0.08, 'square', 0.08); tone(180, t + 0.1, 0.08, 'square', 0.08); break;
    case 'catch': [72, 76, 79, 84].forEach((n, i) => tone(hz(n), t + i * 0.1, 0.15, 'square', 0.07)); break;
    case 'stat': [60, 64, 67].forEach((n, i) => tone(hz(n + 12), t + i * 0.05, 0.08, 'square', 0.05)); break;
    case 'statdown': [67, 64, 60].forEach((n, i) => tone(hz(n), t + i * 0.05, 0.08, 'square', 0.05)); break;
    case 'heal': [72, 76, 79, 76, 84].forEach((n, i) => tone(hz(n), t + i * 0.13, 0.2, 'triangle', 0.1)); break;
    case 'levelup': [67, 71, 74, 79].forEach((n, i) => tone(hz(n), t + i * 0.09, 0.14, 'square', 0.06)); tone(hz(83), t + 0.36, 0.4, 'square', 0.06); break;
    case 'fanfare': [60, 64, 67, 72, 67, 72, 76].forEach((n, i) => tone(hz(n + 7), t + i * 0.12, 0.2, 'square', 0.06)); break;
    case 'badge': [72, 72, 72, 76, 79, 76, 79, 84].forEach((n, i) => tone(hz(n), t + i * 0.14, 0.22, 'square', 0.06)); break;
    case 'encounter': for (let i = 0; i < 8; i++) tone(hz(60 + (i % 2 ? 7 : 0) + i), t + i * 0.05, 0.06, 'square', 0.05); break;
    case 'run': noise(t, 0.2, 0.1); break;
    case 'buy': tone(1500, t, 0.08, 'square', 0.05); tone(2000, t + 0.08, 0.12, 'square', 0.05); break;
    case 'evolve': for (let i = 0; i < 12; i++) tone(hz(60 + i * 2), t + i * 0.08, 0.1, 'triangle', 0.08); break;
    case 'thunder': noise(t, 1.4, 0.3); tone(60, t, 1.2, 'sawtooth', 0.08, master, 0.5); break;
    case 'cry': tone(500 + Math.random() * 400, t, 0.25, 'sawtooth', 0.06, master, 0.6); tone(700, t + 0.12, 0.2, 'square', 0.04, master, 1.4); break;
  }
}

// ---------------------------------------------------- músicas (loops originais)
// cada tema: bpm, melodia e baixo em notas MIDI (0 = pausa), um passo = colcheia
const R = 0;
const THEMES = {
  title: { bpm: 112, mel: [67, R, 72, 74, 76, R, 74, 72, 74, R, 67, R, 69, 71, 72, R, 64, R, 69, 71, 72, R, 71, 69, 71, R, 74, R, 72, R, R, R],
    bass: [48, 55, 48, 55, 43, 50, 43, 50, 45, 52, 45, 52, 43, 50, 43, 50] },
  home: { bpm: 96, mel: [72, R, 76, R, 79, R, 76, R, 77, R, 74, R, 72, R, R, R, 69, R, 72, R, 76, R, 74, R, 72, R, 71, R, 72, R, R, R],
    bass: [48, R, 55, R, 53, R, 55, R, 45, R, 52, R, 43, R, 50, R] },
  town: { bpm: 104, mel: [76, 79, 84, 79, 81, 79, 76, R, 77, 81, 86, 81, 79, R, R, R, 76, 79, 84, 88, 86, 84, 81, R, 77, 76, 74, 76, 72, R, R, R],
    bass: [48, R, 55, R, 45, R, 52, R, 41, R, 48, R, 43, R, 50, R] },
  route: { bpm: 132, mel: [72, 72, 79, R, 77, 76, 74, R, 76, 77, 79, 81, 79, R, 74, R, 72, 72, 79, R, 81, 79, 77, 76, 74, 76, 77, 74, 72, R, R, R],
    bass: [48, 55, 48, 55, 41, 48, 41, 48, 43, 50, 43, 50, 48, 55, 43, 47] },
  city: { bpm: 118, mel: [79, R, 76, 77, 79, R, 84, R, 83, 81, 79, R, 76, R, R, R, 77, R, 74, 76, 77, R, 81, R, 79, 77, 76, 74, 72, R, R, R],
    bass: [48, 52, 55, 52, 48, 52, 55, 52, 43, 47, 50, 47, 43, 47, 50, 47] },
  forest: { bpm: 100, mel: [69, R, 72, R, 76, 74, 72, R, 71, R, 74, R, 72, R, 69, R, 67, R, 71, R, 74, 72, 71, R, 69, R, R, R, R, R, R, R],
    bass: [45, R, 52, R, 45, R, 52, R, 43, R, 50, R, 45, R, 40, R] },
  center: { bpm: 100, mel: [79, 76, 72, 76, 79, R, 84, R, 81, 77, 74, 77, 79, R, R, R, 79, 76, 72, 76, 79, R, 84, 86, 84, 83, 81, 79, 84, R, R, R],
    bass: [48, R, 52, R, 53, R, 55, R, 48, R, 52, R, 55, R, 48, R] },
  lab: { bpm: 108, mel: [72, 74, 76, R, 79, R, 76, R, 74, 76, 77, R, 81, R, 77, R, 76, 77, 79, R, 84, R, 79, R, 77, 76, 74, R, 72, R, R, R],
    bass: [48, R, 48, R, 53, R, 53, R, 50, R, 50, R, 55, R, 55, R] },
  gym: { bpm: 140, mel: [69, 69, 72, 69, 74, 69, 76, 74, 72, 72, 76, 72, 77, 76, 74, 72, 69, 69, 72, 69, 74, 69, 76, 79, 77, 76, 74, 72, 71, 72, 74, 76],
    bass: [45, 45, 57, 45, 45, 57, 45, 57, 41, 41, 53, 41, 43, 43, 55, 44] },
  liga: { bpm: 126, mel: [72, R, 72, 74, 76, R, 79, R, 77, R, 76, 74, 72, R, R, R, 74, R, 74, 76, 77, R, 81, R, 79, R, 77, 76, 79, R, R, R],
    bass: [48, 48, 55, 55, 53, 53, 55, 55, 50, 50, 57, 57, 55, 55, 43, 43] },
  battle: { bpm: 168, mel: [76, 75, 76, 79, 76, 75, 76, 72, 74, 73, 74, 77, 74, 73, 74, 71, 72, 71, 72, 76, 79, 81, 79, 76, 77, 79, 77, 76, 74, 72, 71, 74],
    bass: [45, 57, 45, 57, 43, 55, 43, 55, 41, 53, 41, 53, 40, 52, 44, 56] },
  trainer: { bpm: 176, mel: [69, 72, 76, 81, 80, 81, 76, 72, 71, 74, 77, 83, 81, 79, 77, 74, 72, 76, 79, 84, 83, 81, 79, 76, 77, 76, 74, 72, 71, 72, 74, 71],
    bass: [45, 45, 52, 45, 50, 50, 57, 50, 48, 48, 55, 48, 52, 52, 56, 52] },
  victory: { bpm: 120, mel: [72, 76, 79, 84, R, 79, 84, R, 81, 77, 81, 86, R, 84, 83, 84, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
    bass: [48, R, 55, R, 53, R, 55, R, 48, R, R, R, R, R, R, R] },
  credits: { bpm: 96, mel: [76, R, 79, 81, 84, R, 81, 79, 77, R, 76, 74, 76, R, R, R, 74, R, 76, 77, 79, R, 84, 83, 84, R, 86, R, 84, R, R, R],
    bass: [48, R, 55, R, 45, R, 52, R, 41, R, 48, R, 43, R, 47, R] },
};

export function playMusic(name) {
  if (!ctx) return;
  if (current === name) return;
  current = name;
  step = 0;
  nextTime = ctx.currentTime + 0.1;
  clearInterval(timer);
  if (!THEMES[name]) return;
  timer = setInterval(schedule, 50);
}
export function stopMusic() { current = null; clearInterval(timer); }

function schedule() {
  const th = THEMES[current];
  if (!th || !ctx) return;
  const stepDur = 60 / th.bpm / 2;
  while (nextTime < ctx.currentTime + 0.25) {
    const m = th.mel[step % th.mel.length];
    if (m) tone(hz(m), nextTime, stepDur * 0.9, 'square', 0.045, musicGain);
    if (step % 2 === 0) {
      const b = th.bass[(step / 2) % th.bass.length];
      if (b) tone(hz(b), nextTime, stepDur * 1.8, 'triangle', 0.11, musicGain);
    }
    if (current === 'battle' || current === 'trainer' || current === 'gym') {
      if (step % 4 === 2) noise(nextTime, 0.04, 0.05);
    }
    nextTime += stepDur;
    step++;
    if (current === 'victory' && step >= th.mel.length) { current = null; clearInterval(timer); return; }
  }
}
