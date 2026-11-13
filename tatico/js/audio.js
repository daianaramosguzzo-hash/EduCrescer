// Força Tática — sons sintetizados com Web Audio (tiros, passos, bomba, rádio)
let ctx = null, master = null, noiseBuf = null;
let listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
let occlusion = () => false;
export const settings = { volume: 0.7, voice: true };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return; }
  master = ctx.createGain();
  master.gain.value = settings.volume;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setVolume(v) {
  settings.volume = v;
  if (master) master.gain.value = v;
}

export function setListener(pos, yaw) {
  listener.x = pos.x; listener.y = pos.y; listener.z = pos.z;
  listener.rx = Math.cos(yaw); listener.rz = -Math.sin(yaw);
}

export function setOcclusionTest(fn) { occlusion = fn; }

// Saída posicionada: volume pela distância, lado pelo pan e abafado atrás de parede
function spatial(pos, ref = 6, maxD = 80) {
  const out = ctx.createGain();
  if (!pos) { out.connect(master); return { node: out, gain: 1, far: 0 }; }
  const dx = pos.x - listener.x, dy = pos.y - listener.y, dz = pos.z - listener.z;
  const d = Math.hypot(dx, dy, dz);
  if (d > maxD) return null;
  let gain = 1 / (1 + Math.pow(d / ref, 1.6));
  const pan = ctx.createStereoPanner();
  pan.pan.value = d > 0.5 ? Math.max(-1, Math.min(1, (dx * listener.rx + dz * listener.rz) / d)) * 0.8 : 0;
  let last = pan;
  const blocked = d > 2 && occlusion(pos);
  if (blocked) {
    gain *= 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    pan.connect(lp); last = lp;
  }
  out.gain.value = gain;
  out.connect(pan);
  last.connect(master);
  return { node: out, gain, far: Math.min(1, d / maxD) };
}

function noise(dest, t0, dur, { type = 'lowpass', freq = 3000, q = 0.7, vol = 1, attack = 0.002, sweep = null }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.05);
}

function tone(dest, t0, dur, { freq = 440, end = null, type = 'sine', vol = 0.3, attack = 0.005 }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (end) o.frequency.exponentialRampToValueAtTime(end, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export function gunshot(w, pos) {
  if (!ctx) return;
  const s = spatial(pos, 10, 140);
  if (!s) return;
  const t = ctx.currentTime;
  const p = w.sound || { lp: 3000, decay: 0.2, thump: 90, gain: 0.7 };
  const lp = p.lp * (1 - s.far * 0.75);
  noise(s.node, t, p.decay, { freq: lp, vol: p.gain, q: 0.8 });
  noise(s.node, t, p.decay * 2.2, { freq: lp * 0.35, vol: p.gain * 0.35 });
  tone(s.node, t, p.decay * 0.9, { freq: p.thump * 2, end: p.thump * 0.6, vol: p.gain * 0.6 });
}

export function knifeSwing(pos, hitSomething) {
  if (!ctx) return;
  const s = spatial(pos, 4, 25); if (!s) return;
  const t = ctx.currentTime;
  noise(s.node, t, 0.16, { type: 'bandpass', freq: 1800, sweep: 5000, q: 2, vol: 0.4, attack: 0.04 });
  if (hitSomething) noise(s.node, t + 0.05, 0.08, { freq: 900, vol: 0.6 });
}

export function step(pos, crouchOrLand = false) {
  if (!ctx) return;
  const s = spatial(pos, 3.5, 30); if (!s) return;
  const t = ctx.currentTime;
  noise(s.node, t, crouchOrLand ? 0.12 : 0.07, { type: 'bandpass', freq: 500 + Math.random() * 300, q: 1.2, vol: crouchOrLand ? 0.7 : 0.45 });
  noise(s.node, t + 0.01, 0.05, { type: 'highpass', freq: 3500, vol: 0.06 });
}

export function reloadSound(pos, phase) {
  if (!ctx) return;
  const s = spatial(pos, 3, 20); if (!s) return;
  const t = ctx.currentTime;
  noise(s.node, t, 0.06, { type: 'bandpass', freq: phase ? 2600 : 1600, q: 3, vol: 0.5 });
  noise(s.node, t + 0.04, 0.05, { type: 'bandpass', freq: phase ? 3800 : 2200, q: 4, vol: 0.35 });
}

export function dryFire() {
  if (!ctx) return;
  noise(master, ctx.currentTime, 0.04, { type: 'bandpass', freq: 3000, q: 5, vol: 0.4 });
}

export function hitSound(kind) {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (kind === 'helmet') {
    tone(master, t, 0.35, { freq: 2400, end: 2100, type: 'triangle', vol: 0.25 });
    noise(master, t, 0.08, { type: 'highpass', freq: 4000, vol: 0.3 });
  } else if (kind === 'head') {
    noise(master, t, 0.12, { type: 'bandpass', freq: 1200, q: 1.5, vol: 0.7 });
    tone(master, t, 0.1, { freq: 300, end: 120, vol: 0.3 });
  } else if (kind === 'kill') {
    tone(master, t, 0.09, { freq: 880, type: 'square', vol: 0.06 });
  } else {
    noise(master, t, 0.07, { type: 'bandpass', freq: 600, q: 1.2, vol: 0.45 });
  }
}

export function hurt() {
  if (!ctx) return;
  const t = ctx.currentTime;
  noise(master, t, 0.15, { freq: 500, vol: 0.6 });
  tone(master, t, 0.12, { freq: 160, end: 80, vol: 0.3 });
}

export function impact(pos, metal) {
  if (!ctx) return;
  const s = spatial(pos, 3, 30); if (!s) return;
  const t = ctx.currentTime;
  if (metal) tone(s.node, t, 0.12, { freq: 1800 + Math.random() * 1500, type: 'triangle', vol: 0.12 });
  noise(s.node, t, 0.05, { type: 'bandpass', freq: 2500, q: 1, vol: 0.18 });
}

export function bounce(pos) {
  if (!ctx) return;
  const s = spatial(pos, 4, 30); if (!s) return;
  tone(s.node, ctx.currentTime, 0.08, { freq: 900 + Math.random() * 400, type: 'triangle', vol: 0.18 });
}

export function explosion(pos) {
  if (!ctx) return;
  const s = spatial(pos, 18, 200); if (!s) return;
  const t = ctx.currentTime;
  noise(s.node, t, 1.6, { freq: 900, sweep: 120, vol: 1.2, attack: 0.005 });
  noise(s.node, t, 0.3, { freq: 4000, vol: 0.6 });
  tone(s.node, t, 1.0, { freq: 90, end: 30, vol: 0.9 });
}

export function flashPop(pos) {
  if (!ctx) return;
  const s = spatial(pos, 10, 120); if (!s) return;
  const t = ctx.currentTime;
  noise(s.node, t, 0.4, { type: 'highpass', freq: 1500, vol: 0.9 });
  tone(s.node, t, 0.2, { freq: 200, end: 60, vol: 0.5 });
}

export function smokePop(pos) {
  if (!ctx) return;
  const s = spatial(pos, 8, 60); if (!s) return;
  noise(s.node, ctx.currentTime, 2.5, { freq: 1200, sweep: 300, vol: 0.35, attack: 0.1 });
}

let ringNode = null;
export function flashRing(amount) {
  if (!ctx || amount < 0.15) return;
  const t = ctx.currentTime;
  if (ringNode) try { ringNode.stop(); } catch (e) { /* já parou */ }
  const o = ctx.createOscillator();
  o.frequency.value = 3400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12 * amount, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1 + amount * 3);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + 1.2 + amount * 3);
  ringNode = o;
}

export function bombBeep(pos, urgent) {
  if (!ctx) return;
  const s = spatial(pos, 12, 90); if (!s) return;
  tone(s.node, ctx.currentTime, 0.09, { freq: urgent ? 2900 : 2500, type: 'square', vol: 0.12 });
}

export function plantTick(pos) {
  if (!ctx) return;
  const s = spatial(pos, 4, 30); if (!s) return;
  tone(s.node, ctx.currentTime, 0.05, { freq: 1300, type: 'square', vol: 0.08 });
}

export function defuseTick(pos) {
  if (!ctx) return;
  const s = spatial(pos, 4, 30); if (!s) return;
  noise(s.node, ctx.currentTime, 0.05, { type: 'bandpass', freq: 3000, q: 4, vol: 0.3 });
}

export function ui(kind) {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (kind === 'buy') { tone(master, t, 0.08, { freq: 660, type: 'triangle', vol: 0.15 }); tone(master, t + 0.06, 0.1, { freq: 990, type: 'triangle', vol: 0.15 }); }
  else if (kind === 'deny') tone(master, t, 0.15, { freq: 180, type: 'square', vol: 0.08 });
  else if (kind === 'pickup') noise(master, t, 0.08, { type: 'bandpass', freq: 2000, q: 2, vol: 0.4 });
  else if (kind === 'start') {
    [523, 659, 784].forEach((f, i) => tone(master, t + i * 0.09, 0.18, { freq: f, type: 'triangle', vol: 0.12 }));
  } else if (kind === 'win') {
    [523, 659, 784, 1046].forEach((f, i) => tone(master, t + i * 0.12, 0.3, { freq: f, type: 'triangle', vol: 0.14 }));
  } else if (kind === 'lose') {
    [392, 330, 262].forEach((f, i) => tone(master, t + i * 0.15, 0.35, { freq: f, type: 'triangle', vol: 0.14 }));
  }
}

// Rádio: frases faladas pela voz do navegador (se houver)
export function radio(text) {
  if (!settings.voice || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.rate = 1.15;
    u.pitch = 0.8;
    u.volume = Math.min(1, settings.volume + 0.2);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) { /* sem voz */ }
}
