// Som do jogo, todo sintetizado com WebAudio (sem arquivos): efeitos com volume pela distância
// da câmera, chuva, e trilhas em loop para o título, a exploração de dia, a noite e o combate.
import { bus, clamp } from './util.js';

const GUNS = { pistol: 'pistola', shotgun: 'espingarda', rifle: 'rifle' };

export class Audio {
  constructor(scene) {
    this.S = scene;
    this.ctx = null;
    this.opts = { musica: true, sons: true };
    this.music = null;       // modo pedido: title | explore | combat | none
    this.playing = null;     // trilha tocando agora
    this.step = 0;
    this.nextT = 0;
    this.lastStep = 0;
    this.bind();
  }

  // o navegador só libera o som depois de um gesto do jogador
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.comp.connect(this.master);
    this.sfx = c.createGain(); this.sfx.connect(this.comp);
    this.mus = c.createGain(); this.mus.connect(this.comp);
    // eco curto para dar corpo
    this.verb = c.createDelay(0.5); this.verb.delayTime.value = 0.13;
    const fb = c.createGain(); fb.gain.value = 0.28;
    const vf = c.createBiquadFilter(); vf.type = 'lowpass'; vf.frequency.value = 2200;
    this.verb.connect(vf); vf.connect(fb); fb.connect(this.verb);
    const vo = c.createGain(); vo.gain.value = 0.35; vf.connect(vo); vo.connect(this.comp);
    this.verbIn = c.createGain(); this.verbIn.gain.value = 1; this.verbIn.connect(this.verb);
    const len = c.sampleRate * 1.5;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
    this.timer = setInterval(() => this.tick(), 60);
  }
  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime(this.opts.sons ? 0.9 : 0, t, 0.05);
    this.mus.gain.setTargetAtTime(this.opts.musica ? 0.32 : 0, t, 0.3);
    this.setRain(this.rainOn);
  }

  bind() {
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    bus.on('audio-opts', o => { this.opts = { ...this.opts, ...o }; this.apply(); });
    bus.on('music', m => { this.music = m; });
    bus.on('weather', w => this.setRain(w === 'chuva'));
    bus.on('sfx', (name, x, z) => this.play(name, x, z));
    bus.on('anim', (u, anim) => this.onAnim(u, anim));
    bus.on('step', (u, anim) => {
      if (u.kind !== 'hero' || !this.ctx) return;
      const now = this.ctx.currentTime;
      if (now - this.lastStep < 0.09) return;
      this.lastStep = now;
      this.noise(0.05, anim === 'run' ? 900 : 700, 1.5, anim === 'run' ? 0.11 : 0.06, 'bandpass', this.vol(u.x, u.z));
    });
    bus.on('hurt', () => this.play('oof'));
    bus.on('levelup', () => this.play('levelup'));
    bus.on('quest', q => this.play(q.tipo === 'fim' ? 'quest' : 'blip'));
    bus.on('ui', n => this.play(n || 'click'));
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button')) this.play('click'); }, true);
  }

  // volume pela distância do centro da câmera
  vol(x, z) {
    if (x === undefined || !this.S || !this.S.target) return 1;
    const d = Math.hypot(x + 0.5 - this.S.target.x, z + 0.5 - this.S.target.z);
    return clamp(1.15 - d / 26, 0.12, 1) * clamp(this.S.zoom / 1.1, 0.7, 1.15);
  }

  onAnim(u, anim) {
    if (!this.ctx) return;
    const v = this.vol(u.x, u.z);
    const zombie = u.kind === 'zombie';
    switch (anim) {
      case 'attack':
        if (zombie) { this.groan(v, u.type); this.later(0.18, () => this.play('smack', u.x, u.z)); }
        else { this.swoosh(v); }
        break;
      case 'shoot': {
        const hc = u.holdClass ? u.holdClass() : 'none';
        if (GUNS[hc]) this.gun(hc, v);
        else if (hc === 'sling') this.twang(v);
        else this.swoosh(v * 0.8);
        break;
      }
      case 'hurt': this.play(zombie ? 'squish' : 'hit', u.x, u.z); break;
      case 'die': this.play(zombie ? 'splat' : 'thud', u.x, u.z); if (zombie) this.later(0.1, () => this.groan(v * 0.7, u.type, true)); break;
      case 'eat': this.crunch(v); break;
      case 'medicine': this.play('pills', u.x, u.z); break;
      case 'pickup': this.play('pickup', u.x, u.z); break;
      case 'interact': this.play('click2', u.x, u.z); break;
      case 'celebrate': if (!zombie) this.play('yay', u.x, u.z); break;
      case 'scared': this.play('gasp', u.x, u.z); break;
      case 'vehicleIn': this.play('engine', u.x, u.z); break;
    }
  }
  later(s, fn) { setTimeout(fn, s * 1000); }

  // ------------------------------------------------------------ blocos de síntese
  env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
  }
  tone(freq, dur, type = 'sine', vol = 0.2, slide = null, when = 0, out = null, attack = 0.005) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    this.env(g, t, attack, vol, dur);
    o.connect(g); g.connect(out || this.sfx);
    o.start(t); o.stop(t + attack + dur + 0.05);
    return o;
  }
  noise(dur, freq = 1000, q = 1, vol = 0.2, type = 'bandpass', mul = 1, when = 0, slide = null, out = null) {
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = c.createGain();
    this.env(g, t, 0.004, vol * mul, dur);
    s.connect(f); f.connect(g); g.connect(out || this.sfx);
    s.start(t, Math.random() * Math.max(0, 1.4 - dur)); s.stop(t + dur + 0.05);
  }
  swoosh(v) { this.noise(0.18, 600, 2, 0.28, 'bandpass', v, 0, 3200); }
  twang(v) { this.tone(420, 0.2, 'triangle', 0.18 * v, 180); this.noise(0.08, 2000, 3, 0.1, 'bandpass', v); }
  gun(kind, v) {
    const big = kind === 'shotgun' ? 1.5 : kind === 'rifle' ? 1.2 : 1;
    this.noise(0.12 * big, 1800, 0.7, 0.9, 'lowpass', v);
    this.noise(0.35 * big, 400, 0.8, 0.6, 'lowpass', v, 0.01, 90);
    this.tone(140, 0.25 * big, 'sine', 0.55 * v, 40);
    const e = this.ctx.createGain(); e.gain.value = 0.5 * v; e.connect(this.verbIn);
    this.noise(0.4, 900, 0.6, 0.35, 'lowpass', 1, 0.02, 200, e);
    if (kind === 'shotgun') this.later(0.45, () => { this.tone(1400, 0.03, 'square', 0.06 * v); this.tone(900, 0.04, 'square', 0.06 * v, null, 0.09); });
  }
  groan(v, type, dying = false) {
    const c = this.ctx, t = c.currentTime;
    const base = type === 'resistente' || type === 'inchado' || type === 'matriz' ? 70 : type === 'corredor' ? 150 : 100;
    const f0 = base * (0.85 + Math.random() * 0.3);
    const dur = dying ? 0.9 : 0.55 + Math.random() * 0.3;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * 1.2, t); o.frequency.linearRampToValueAtTime(f0 * (dying ? 0.6 : 0.9), t + dur);
    const lfo = c.createOscillator(); lfo.frequency.value = 7 + Math.random() * 5;
    const lg = c.createGain(); lg.gain.value = f0 * 0.08; lfo.connect(lg); lg.connect(o.frequency);
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 500 + Math.random() * 200; f1.Q.value = 5;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1100; f2.Q.value = 6;
    const g = c.createGain(); this.env(g, t, 0.05, 0.5 * v, dur);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(this.sfx);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }
  crunch(v) { for (let i = 0; i < 4; i++) this.noise(0.05, 2500 + Math.random() * 1500, 2, 0.2, 'bandpass', v, i * 0.12); }

  play(name, x, z) {
    if (!this.ctx || !this.opts.sons) return;
    const v = this.vol(x, z);
    switch (name) {
      case 'click': this.tone(880, 0.04, 'triangle', 0.06); break;
      case 'click2': this.tone(520, 0.03, 'square', 0.05 * v); this.noise(0.04, 3000, 2, 0.08, 'bandpass', v, 0.03); break;
      case 'blip': this.tone(660, 0.08, 'triangle', 0.12); this.tone(990, 0.1, 'triangle', 0.12, null, 0.08); break;
      case 'pickup': this.tone(520, 0.06, 'triangle', 0.14 * v, 780); this.tone(1040, 0.08, 'triangle', 0.12 * v, null, 0.06); break;
      case 'hit': this.tone(110, 0.14, 'sine', 0.5 * v, 50); this.noise(0.08, 1200, 1, 0.3, 'lowpass', v); break;
      case 'smack': this.noise(0.1, 800, 1, 0.35, 'lowpass', v); this.tone(90, 0.1, 'sine', 0.35 * v, 45); break;
      case 'squish': this.noise(0.16, 600, 3, 0.35, 'bandpass', v, 0, 200); this.tone(160, 0.12, 'sine', 0.25 * v, 60); break;
      case 'splat': this.noise(0.3, 900, 1.5, 0.45, 'lowpass', v, 0, 120); this.tone(80, 0.25, 'sine', 0.35 * v, 35); break;
      case 'thud': this.tone(70, 0.22, 'sine', 0.5 * v, 35); this.noise(0.12, 500, 1, 0.25, 'lowpass', v); break;
      case 'oof': this.tone(260, 0.16, 'square', 0.1, 150); this.tone(130, 0.18, 'sine', 0.2, 80); break;
      case 'gasp': this.noise(0.25, 1800, 4, 0.12, 'bandpass', v, 0, 2600); break;
      case 'pills': for (let i = 0; i < 5; i++) this.tone(2400 + Math.random() * 1600, 0.02, 'square', 0.04 * v, null, i * 0.05); this.later(0.35, () => this.tone(320, 0.12, 'sine', 0.12 * v, 520)); break;
      case 'yay': [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.1 * v, null, i * 0.08)); break;
      case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.14, null, i * 0.09)); this.tone(1568, 0.5, 'sine', 0.08, null, 0.45); break;
      case 'quest': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.22, 'square', 0.06, null, i * 0.12)); [523, 659, 784].forEach(f => this.tone(f, 0.8, 'triangle', 0.08, null, 0.5)); break;
      case 'door_open': this.creak(v, 1); this.later(0.25, () => this.tone(90, 0.1, 'sine', 0.25 * v, 60)); break;
      case 'door_close': this.creak(v, 0.6); this.later(0.18, () => { this.tone(75, 0.14, 'sine', 0.45 * v, 45); this.noise(0.06, 900, 1, 0.3, 'lowpass', v); }); break;
      case 'gate': for (let i = 0; i < 3; i++) this.tone(900 + i * 220, 0.3, 'triangle', 0.05 * v, 700, i * 0.07); this.noise(0.5, 1500, 8, 0.12, 'bandpass', v, 0, 900); break;
      case 'bang': this.tone(60, 0.3, 'sine', 0.7 * v, 30); this.noise(0.2, 400, 1, 0.5, 'lowpass', v); break;
      case 'hammer': for (let i = 0; i < 3; i++) { this.tone(1900, 0.05, 'square', 0.06 * v, 1400, i * 0.22); this.noise(0.05, 700, 1, 0.3, 'lowpass', v, i * 0.22); } break;
      case 'glass': this.noise(0.4, 5000, 1, 0.4, 'highpass', v); for (let i = 0; i < 7; i++) this.tone(2500 + Math.random() * 4000, 0.08, 'sine', 0.06 * v, null, 0.03 + Math.random() * 0.35); break;
      case 'fire': this.noise(0.9, 700, 0.7, 0.5, 'lowpass', v, 0, 2400); this.tone(80, 0.5, 'sine', 0.3 * v, 40); break;
      case 'boom': this.noise(0.6, 1600, 0.6, 0.8, 'lowpass', v, 0, 80); this.tone(90, 0.6, 'sine', 0.7 * v, 25); for (let i = 0; i < 6; i++) this.tone(900 + Math.random() * 1400, 0.1, 'square', 0.04 * v, null, 0.1 + i * 0.07); break;
      case 'bell': [1, 2.76, 5.4, 8.9].forEach((m, i) => this.tone(196 * m, 3.4 / (1 + i * 0.6), 'sine', [0.35, 0.18, 0.1, 0.05][i] * Math.max(0.6, v), null, 0, null, 0.002)); break;
      case 'alarm': for (let i = 0; i < 6; i++) this.tone(i % 2 ? 1300 : 900, 0.38, 'square', 0.05 * v, i % 2 ? 900 : 1300, i * 0.4); break;
      case 'engine': for (let i = 0; i < 8; i++) this.tone(55 + i * 6, 0.25, 'sawtooth', 0.08 * v, 60 + i * 8, i * 0.2); break;
      case 'turn': this.tone(330, 0.1, 'triangle', 0.08); this.tone(247, 0.14, 'triangle', 0.08, null, 0.09); break;
      case 'danger': this.tone(155, 0.5, 'sawtooth', 0.1, 110); this.tone(160, 0.5, 'sawtooth', 0.08, 115); break;
    }
  }
  creak(v, len) {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(120 + Math.random() * 40, t); o.frequency.linearRampToValueAtTime(200 + Math.random() * 80, t + 0.3 * len);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 9;
    const g = c.createGain(); this.env(g, t, 0.03, 0.18 * v, 0.3 * len);
    o.connect(f); f.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.4 * len + 0.1);
  }

  // ------------------------------------------------------------ chuva
  setRain(on) {
    this.rainOn = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (on && !this.rain) {
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
      const g = this.ctx.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.sfx); s.start();
      this.rain = { s, g };
    }
    if (this.rain) this.rain.g.gain.setTargetAtTime(on && this.opts.sons ? 0.12 : 0, t, 0.8);
  }

  // ------------------------------------------------------------ música (sequenciador simples)
  tick() {
    if (!this.ctx) return;
    let want = this.music || 'none';
    if (want === 'explore' && this.S.env && this.S.env.night > 0.55) want = 'night';
    if (want !== this.playing) {
      this.playing = want; this.step = 0; this.nextT = this.ctx.currentTime + 0.15;
    }
    const song = SONGS[this.playing];
    if (!song) return;
    const spb = 60 / song.bpm / 4; // semicolcheia
    while (this.nextT < this.ctx.currentTime + 0.25) {
      this.seqStep(song, this.step, this.nextT);
      this.step++;
      this.nextT += spb * (this.step % 2 ? 1 + (song.swing || 0) : 1 - (song.swing || 0));
    }
  }
  seqStep(song, st, t) {
    const bar = Math.floor(st / 16) % song.chords.length;
    const s = st % 16;
    const ch = song.chords[bar];
    const root = song.root * Math.pow(2, ch[0] / 12);
    const when = t - this.ctx.currentTime;
    const out = this.mus;
    // baixo
    if (song.bass[s] !== '.') {
      const oct = song.bass[s] === 'o' ? 2 : song.bass[s] === 'f' ? 1.5 : 1;
      this.tone(root / 2 * oct, 0.2, song.bassWave || 'triangle', 0.3, null, when, out, 0.01);
    }
    // acordes
    if (song.pad && s === 0) for (const n of ch.slice(1)) this.tone(root * Math.pow(2, n / 12), 60 / song.bpm * 3.6, song.padWave || 'sine', 0.05, null, when, out, 0.25);
    if (song.stab && song.stab[s] === 'x') for (const n of ch.slice(1)) this.tone(root * Math.pow(2, n / 12), 0.12, 'square', 0.025, null, when, out, 0.005);
    // melodia
    if (song.mel) {
      const m = song.mel[(Math.floor(st / 16) % (song.mel.length)) ]?.[s];
      if (m !== undefined && m !== null) this.tone(song.root * 2 * Math.pow(2, m / 12), 0.22, song.melWave || 'triangle', 0.07, null, when, out, 0.01);
    }
    // percussão
    const d = song.drums;
    if (d) {
      if (d.k[s] === 'x') this.tone(110, 0.12, 'sine', 0.5, 40, when, out, 0.002);
      if (d.s && d.s[s] === 'x') this.noise(0.1, 1800, 0.8, 0.18, 'bandpass', 1, when, null, out);
      if (d.h && d.h[s] === 'x') this.noise(0.03, 8000, 1, 0.06, 'highpass', 1, when, null, out);
      if (d.t && d.t[s] === 'x') this.tone(220, 0.08, 'sine', 0.2, 140, when, out, 0.002);
    }
  }
}

// progressões: [semitom da raiz, notas do acorde...]
const SONGS = {
  // título: forró assombrado
  title: {
    bpm: 104, root: 146.8, swing: 0.08, bassWave: 'triangle', pad: true, padWave: 'triangle',
    chords: [[0, 0, 3, 7], [5, 0, 3, 7], [7, 0, 4, 7], [0, 0, 3, 7]],
    bass: 'x..f..x.x..f..x.',
    mel: [[12, null, 10, null, 7, null, null, 8, 7, null, 5, null, 3, null, null, null], [5, null, 7, null, 8, null, 10, null, 12, null, null, 10, 8, null, null, null],
      [11, null, 12, null, 14, null, 12, 11, 7, null, null, null, 11, null, null, null], [12, null, null, 10, 7, null, 3, null, 0, null, null, null, null, null, null, null]],
    drums: { k: 'x.......x.......', t: '...x..x....x..x.', h: 'x.x.x.x.x.x.x.x.' },
  },
  // exploração de dia: xote preguiçoso no calor
  explore: {
    bpm: 92, root: 130.8, swing: 0.1, pad: true, padWave: 'sine',
    chords: [[0, 0, 4, 7, 11], [9, 0, 3, 7], [5, 0, 4, 7], [7, 0, 4, 7, 10]],
    bass: 'x.....x.o.......',
    mel: [[null, null, 7, null, 9, null, 11, null, 12, null, null, null, 11, null, 9, null], null, [null, null, 5, null, 7, null, 9, null, 12, null, 9, null, 7, null, null, null], null],
    drums: { k: 'x.......x.......', t: '......x.......x.', h: '..x...x...x...x.' },
  },
  // noite: grave, esparso e tenso
  night: {
    bpm: 70, root: 110, pad: true, padWave: 'sine', bassWave: 'sine',
    chords: [[0, 0, 3, 7], [1, 0, 4, 7], [0, 0, 3, 6], [-2, 0, 3, 7]],
    bass: 'x...............',
    mel: [[null, null, null, null, null, null, null, null, 15, null, null, null, 14, null, null, null], null, [null, null, null, null, 13, null, null, null, null, null, null, null, 12, null, null, null], null],
    melWave: 'sine',
    drums: { k: 'x.......x.......', h: '.......x........' },
  },
  // combate: rápido e nervoso
  combat: {
    bpm: 138, root: 110, bassWave: 'sawtooth',
    chords: [[0, 0, 3, 7], [0, 0, 3, 7], [3, 0, 4, 7], [1, 0, 4, 7]],
    bass: 'x.xox.x.x.xox.x.',
    stab: '....x.......x...',
    drums: { k: 'x...x...x...x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
  },
};
