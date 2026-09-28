// Texturas pintadas por código em canvas (nada de imagens externas).
import * as THREE from '../../lib/three.module.min.js';
import { rng, makeNoise } from './util.js';

const cache = {};
let maxAniso = 4;
export function setAnisotropy(n) { maxAniso = n; }

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// preenche com ruído colorido que emenda nas bordas
function noiseFill(ctx, w, h, base, vary, seed, scale = 8, oct = 4) {
  const n = makeNoise(seed);
  const img = ctx.createImageData(w, h);
  const [r, g, b] = base;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // ruído "periódico": média de 4 cantos para emendar
    const u = x / w, v = y / h;
    const s = (fx, fy) => n.fbm(fx * scale, fy * scale, oct);
    const val = s(u, v) * (1 - u) * (1 - v) + s(u - 1, v) * u * (1 - v) + s(u, v - 1) * (1 - u) * v + s(u - 1, v - 1) * u * v;
    const k = (val - 0.5) * vary;
    const i = (y * w + x) * 4;
    img.data[i] = r + k * 255; img.data[i + 1] = g + k * 240; img.data[i + 2] = b + k * 220; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
// desenha algo repetido nas bordas (para ladrilhar sem emenda)
function wrapDraw(w, h, x, y, fn) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) fn(x + dx, y + dy);
}

export function grassTex() {
  if (cache.grass) return cache.grass;
  const S = 512, c = canvas(S), ctx = c.getContext('2d'), r = rng(11);
  noiseFill(ctx, S, S, [86, 94, 56], 0.45, 3, 6);
  for (let i = 0; i < 9000; i++) {
    const x = r() * S, y = r() * S, l = 3 + r() * 7, a = -Math.PI / 2 + (r() - 0.5) * 1.2;
    const g = 70 + r() * 60, rr = 60 + r() * 50;
    ctx.strokeStyle = `rgba(${rr},${g + 10},${40 + r() * 20},${0.3 + r() * 0.45})`;
    ctx.lineWidth = 1 + r();
    wrapDraw(S, S, x, y, (px, py) => { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); ctx.stroke(); });
  }
  // folhas secas e manchas de terra
  for (let i = 0; i < 160; i++) {
    const x = r() * S, y = r() * S;
    ctx.fillStyle = `rgba(${110 + r() * 40},${80 + r() * 30},${40},${0.25 + r() * 0.3})`;
    wrapDraw(S, S, x, y, (px, py) => { ctx.beginPath(); ctx.ellipse(px, py, 2 + r() * 3, 1 + r() * 2, r() * 3, 0, 7); ctx.fill(); });
  }
  return (cache.grass = tex(c));
}

export function dirtTex() {
  if (cache.dirt) return cache.dirt;
  const S = 512, c = canvas(S), ctx = c.getContext('2d'), r = rng(12);
  noiseFill(ctx, S, S, [104, 84, 62], 0.5, 5, 10);
  for (let i = 0; i < 1400; i++) {
    const x = r() * S, y = r() * S, s = 1 + r() * 3.5, v = 80 + r() * 90;
    ctx.fillStyle = `rgba(${v},${v * 0.85},${v * 0.7},${0.4 + r() * 0.5})`;
    wrapDraw(S, S, x, y, (px, py) => { ctx.beginPath(); ctx.ellipse(px, py, s, s * (0.6 + r() * 0.4), r() * 3, 0, 7); ctx.fill(); });
  }
  // rachaduras de terra seca
  ctx.strokeStyle = 'rgba(50,38,28,0.35)';
  for (let i = 0; i < 60; i++) {
    let x = r() * S, y = r() * S; ctx.lineWidth = 0.6 + r();
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return (cache.dirt = tex(c));
}

export function asphaltTex() {
  if (cache.asphalt) return cache.asphalt;
  const S = 512, c = canvas(S), ctx = c.getContext('2d'), r = rng(13);
  noiseFill(ctx, S, S, [74, 74, 76], 0.16, 8, 14, 5);
  for (let i = 0; i < 5000; i++) {
    const v = 40 + r() * 80;
    ctx.fillStyle = `rgba(${v},${v},${v + 4},0.5)`;
    ctx.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  ctx.strokeStyle = 'rgba(25,25,27,0.7)';
  for (let i = 0; i < 16; i++) {
    let x = r() * S, y = r() * S; ctx.lineWidth = 0.8 + r() * 1.4;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // manchas de óleo
  for (let i = 0; i < 10; i++) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
    g.addColorStop(0, 'rgba(20,20,22,0.45)'); g.addColorStop(1, 'rgba(20,20,22,0)');
    ctx.save(); ctx.translate(r() * S, r() * S); ctx.scale(1, 0.6 + r() * 0.6); ctx.fillStyle = g; ctx.fillRect(-30, -30, 60, 60); ctx.restore();
  }
  return (cache.asphalt = tex(c));
}

export function sandTex() {
  if (cache.sand) return cache.sand;
  const S = 256, c = canvas(S), ctx = c.getContext('2d'), r = rng(14);
  noiseFill(ctx, S, S, [120, 104, 80], 0.35, 9, 8);
  for (let i = 0; i < 1500; i++) {
    const v = 90 + r() * 90;
    ctx.fillStyle = `rgba(${v},${v * 0.9},${v * 0.7},0.5)`;
    ctx.fillRect(r() * S, r() * S, 1, 1);
  }
  return (cache.sand = tex(c));
}

// reboco de parede (a cor vem da cor do vértice)
export function plasterTex() {
  if (cache.plaster) return cache.plaster;
  const S = 256, c = canvas(S), ctx = c.getContext('2d'), r = rng(15);
  noiseFill(ctx, S, S, [228, 224, 214], 0.22, 21, 6);
  // manchas de umidade e sujeira escorrendo
  for (let i = 0; i < 26; i++) {
    const x = r() * S, w = 4 + r() * 16, h = 20 + r() * 110;
    const g = ctx.createLinearGradient(0, S - h, 0, S);
    g.addColorStop(0, 'rgba(70,60,50,0)'); g.addColorStop(1, `rgba(70,60,50,${0.1 + r() * 0.25})`);
    ctx.fillStyle = g; ctx.fillRect(x, S - h, w, h);
  }
  // reboco caído mostrando tijolo
  for (let i = 0; i < 5; i++) {
    const x = r() * (S - 40), y = r() * (S - 30), w = 14 + r() * 26, h = 8 + r() * 16;
    ctx.fillStyle = 'rgba(150,80,55,0.85)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(90,50,35,0.7)'; ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + 2, y + k * 5 + 3); ctx.lineTo(x + w - 2, y + k * 5 + 3); ctx.stroke(); }
  }
  return (cache.plaster = tex(c));
}

export function brickTex() {
  if (cache.brick) return cache.brick;
  const S = 256, c = canvas(S), ctx = c.getContext('2d'), r = rng(16);
  ctx.fillStyle = '#8d8174'; ctx.fillRect(0, 0, S, S);
  const bh = 16, bw = 42;
  for (let row = 0; row < S / bh; row++) {
    const off = (row % 2) * bw / 2;
    for (let x = -bw; x < S + bw; x += bw) {
      const v = 0.8 + r() * 0.35;
      ctx.fillStyle = `rgb(${160 * v},${82 * v},${58 * v})`;
      ctx.fillRect(x + off + 1.5, row * bh + 1.5, bw - 3, bh - 3);
    }
  }
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) { const k = (r() - 0.5) * 22; img.data[i] += k; img.data[i + 1] += k; img.data[i + 2] += k; }
  ctx.putImageData(img, 0, 0);
  return (cache.brick = tex(c));
}

export function roofTex() {
  if (cache.roof) return cache.roof;
  const S = 256, c = canvas(S), ctx = c.getContext('2d'), r = rng(17);
  ctx.fillStyle = '#8a8a8a'; ctx.fillRect(0, 0, S, S);
  const th = 32, tw = 32;
  for (let row = 0; row < S / th + 1; row++) {
    for (let col = 0; col < 9; col++) {
      const x = col * tw + (row % 2) * tw / 2, y = row * th;
      const v = 0.75 + r() * 0.4;
      const g = ctx.createLinearGradient(0, y, 0, y + th);
      g.addColorStop(0, `rgb(${250 * v},${248 * v},${244 * v})`); g.addColorStop(1, `rgb(${170 * v},${166 * v},${160 * v})`);
      ctx.fillStyle = g;
      wrapDraw(S, S, x, y, (px, py) => { ctx.beginPath(); ctx.roundRect(px + 1, py, tw - 2, th - 1, 6); ctx.fill(); });
    }
  }
  // limo e sujeira
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${40 + r() * 30},${50 + r() * 30},${30},${0.12 + r() * 0.2})`;
    ctx.beginPath(); ctx.ellipse(r() * S, r() * S, 6 + r() * 20, 4 + r() * 10, r() * 3, 0, 7); ctx.fill();
  }
  return (cache.roof = tex(c));
}

export function woodTex() {
  if (cache.wood) return cache.wood;
  const S = 256, c = canvas(S), ctx = c.getContext('2d'), r = rng(18);
  const pw = 32;
  for (let i = 0; i < S / pw; i++) {
    const v = 0.8 + r() * 0.35;
    ctx.fillStyle = `rgb(${235 * v},${225 * v},${210 * v})`; ctx.fillRect(i * pw, 0, pw, S);
    for (let k = 0; k < 26; k++) {
      ctx.strokeStyle = `rgba(90,70,50,${0.12 + r() * 0.2})`; ctx.lineWidth = 0.6 + r();
      const x = i * pw + r() * pw;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + (r() - 0.5) * 6, S / 3, x + (r() - 0.5) * 6, S * 2 / 3, x, S); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(60,45,30,0.7)'; ctx.fillRect(i * pw, 0, 2, S);
    // pregos
    ctx.fillStyle = 'rgba(60,60,60,0.9)';
    for (const y of [20, S - 20]) { ctx.beginPath(); ctx.arc(i * pw + pw / 2, y, 2, 0, 7); ctx.fill(); }
  }
  return (cache.wood = tex(c));
}

export function metalTex() {
  if (cache.metal) return cache.metal;
  const S = 256, c = canvas(S), ctx = c.getContext('2d'), r = rng(19);
  noiseFill(ctx, S, S, [200, 200, 200], 0.18, 31, 5);
  // ferrugem
  for (let i = 0; i < 22; i++) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(${120 + r() * 40},${70 + r() * 20},35,${0.2 + r() * 0.3})`); g.addColorStop(1, 'rgba(120,60,25,0)');
    ctx.save(); ctx.translate(r() * S, r() * S); const s = 4 + r() * 22; ctx.scale(s, s * (0.5 + r())); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.fill(); ctx.restore();
  }
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${r() * 0.15})`; ctx.lineWidth = 0.5;
    const x = r() * S, y = r() * S; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 8); ctx.stroke();
  }
  return (cache.metal = tex(c));
}

export function concreteTex() {
  if (cache.concrete) return cache.concrete;
  const S = 256, c = canvas(S), ctx = c.getContext('2d'), r = rng(20);
  noiseFill(ctx, S, S, [168, 164, 156], 0.25, 41, 9);
  ctx.strokeStyle = 'rgba(70,68,64,0.6)'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, S, S);
  ctx.beginPath(); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2); ctx.stroke();
  for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(60,58,50,${r() * 0.2})`; ctx.beginPath(); ctx.arc(r() * S, r() * S, 2 + r() * 10, 0, 7); ctx.fill(); }
  return (cache.concrete = tex(c));
}

// folhagem: a cor vem do vértice, a textura dá o miolo das folhas
export function foliageTex() {
  if (cache.foliage) return cache.foliage;
  const S = 128, c = canvas(S), ctx = c.getContext('2d'), r = rng(21);
  ctx.fillStyle = '#c8c8c8'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 500; i++) {
    const v = 150 + r() * 105;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath(); ctx.ellipse(r() * S, r() * S, 3 + r() * 4, 1.5 + r() * 2, r() * 3, 0, 7); ctx.fill();
  }
  return (cache.foliage = tex(c));
}

// tufo de capim com transparência (sprite cruzado)
export function tuftTex() {
  if (cache.tuft) return cache.tuft;
  const S = 128, c = canvas(S), ctx = c.getContext('2d'), r = rng(22);
  for (let i = 0; i < 46; i++) {
    const x = 20 + r() * 88, h = 50 + r() * 70, lean = (r() - 0.5) * 40;
    const v = 0.7 + r() * 0.5;
    ctx.strokeStyle = `rgb(${200 * Math.min(1.2, v)},${215 * Math.min(1.15, v)},${170 * Math.min(1.2, v)})`;
    ctx.lineWidth = 2 + r() * 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, S); ctx.quadraticCurveTo(x + lean * 0.3, S - h * 0.6, x + lean, S - h); ctx.stroke();
  }
  return (cache.tuft = tex(c, { repeat: false }));
}

export function bloodTex() {
  if (cache.blood) return cache.blood;
  const S = 128, c = canvas(S), ctx = c.getContext('2d'), r = rng(23);
  ctx.fillStyle = 'rgba(95,8,8,0.9)';
  ctx.beginPath(); ctx.ellipse(64, 64, 28, 22, 0.4, 0, 7); ctx.fill();
  for (let i = 0; i < 24; i++) {
    const a = r() * 7, d = 20 + r() * 38, s = 2 + r() * 8;
    ctx.fillStyle = `rgba(${80 + r() * 40},6,6,${0.6 + r() * 0.35})`;
    ctx.beginPath(); ctx.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, s, 0, 7); ctx.fill();
  }
  return (cache.blood = tex(c, { repeat: false }));
}

// placa com texto (fachadas)
export function signTex(text, { bg = '#f2e6c8', fg = '#2a2a2a', w = 512, h = 96, font = 'bold 56px "Oswald", "Arial Narrow", Arial, sans-serif', border = '#00000055', grime = true } = {}) {
  const key = 'sign:' + text + bg + fg + w + h;
  if (cache[key]) return cache[key];
  const c = canvas(w, h), ctx = c.getContext('2d'), r = rng(text.length * 31);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = border; ctx.lineWidth = 8; ctx.strokeRect(0, 0, w, h);
  ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = parseInt(font.match(/(\d+)px/)[1]);
  while (ctx.measureText(text).width > w - 30 && size > 12) { size -= 2; ctx.font = font.replace(/\d+px/, size + 'px'); }
  ctx.fillText(text, w / 2, h / 2 + 3);
  if (grime) {
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(60,45,30,${r() * 0.25})`;
      ctx.beginPath(); ctx.arc(r() * w, r() * h, 3 + r() * 20, 0, 7); ctx.fill();
    }
  }
  return (cache[key] = tex(c, { repeat: false }));
}

// pichação/texto numa parede (fundo transparente)
export function graffitiTex(text, color = '#b31d1d') {
  const key = 'graf:' + text + color;
  if (cache[key]) return cache[key];
  const c = canvas(512, 128), ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.font = 'bold 64px "Permanent Marker", "Comic Sans MS", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.save(); ctx.translate(256, 64); ctx.rotate(-0.04); ctx.fillText(text, 0, 0); ctx.restore();
  // escorridos
  const r = rng(text.length);
  for (let i = 0; i < 10; i++) { const x = 60 + r() * 390; ctx.fillRect(x, 80, 3, 10 + r() * 30); }
  return (cache[key] = tex(c, { repeat: false }));
}

// fita zebrada de isolamento
export function tapeTex() {
  if (cache.tape) return cache.tape;
  const c = canvas(128, 16), ctx = c.getContext('2d');
  ctx.fillStyle = '#e8c21e'; ctx.fillRect(0, 0, 128, 16);
  ctx.fillStyle = '#161616';
  for (let x = -16; x < 144; x += 32) { ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x + 16, 0); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 16, 16); ctx.fill(); }
  return (cache.tape = tex(c));
}

// brilho radial (fogo, clarão do tiro, marcadores)
export function glowTex() {
  if (cache.glow) return cache.glow;
  const c = canvas(64), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return (cache.glow = tex(c, { repeat: false }));
}

export function smokeTex() {
  if (cache.smoke) return cache.smoke;
  const c = canvas(64), ctx = c.getContext('2d'), r = rng(25);
  for (let i = 0; i < 14; i++) {
    const x = 20 + r() * 24, y = 20 + r() * 24, s = 10 + r() * 12;
    const g = ctx.createRadialGradient(x, y, 0, x, y, s);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  }
  return (cache.smoke = tex(c, { repeat: false }));
}

// sombra redonda falsa sob objetos pequenos
export function blobTex() {
  if (cache.blob) return cache.blob;
  const c = canvas(64), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return (cache.blob = tex(c, { repeat: false }));
}

// papel/lixo no chão
export function debrisTex() {
  if (cache.debris) return cache.debris;
  const S = 256, c = canvas(S), ctx = c.getContext('2d'), r = rng(26);
  for (let i = 0; i < 60; i++) {
    const v = 150 + r() * 100;
    ctx.fillStyle = r() < 0.3 ? `rgba(${90 + r() * 40},${70 + r() * 30},40,0.9)` : `rgba(${v},${v},${v - 20},0.85)`;
    ctx.save(); ctx.translate(r() * S, r() * S); ctx.rotate(r() * 7);
    ctx.fillRect(-4 - r() * 8, -3 - r() * 5, 8 + r() * 12, 6 + r() * 8); ctx.restore();
  }
  return (cache.debris = tex(c, { repeat: false }));
}
