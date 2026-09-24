// Texturas procedurais (canvas): pisos, telhados, água, sangue, sombra e brilhos.
import * as THREE from '../../../lib/three.module.min.js';
import { FLOORS } from '../world/tiles.js';
import { mulberry32 } from '../util.js';

export const TILE_PX = 64;
const GUT = 4;                       // margem repetida para evitar costuras
const CELL = TILE_PX + GUT * 2;
export const ATLAS_COLS = 8;

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function noise(g, w, h, R, n, colors, size = [1, 2]) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(R() * colors.length)];
    const s = size[0] + R() * (size[1] - size[0]);
    g.fillRect(R() * w, R() * h, s, s);
  }
}

// desenha um piso 64x64 (sem emendas)
function drawFloor(id, g, R) {
  const S = TILE_PX;
  const base = (c) => { g.fillStyle = c; g.fillRect(0, 0, S, S); };
  switch (id) {
    case 'grama':
      base('#6fae4c');
      noise(g, S, S, R, 260, ['#5f9c40', '#7cbc56', '#86c65e', '#5a9540'], [1, 3]);
      g.strokeStyle = '#4f8a36'; g.lineWidth = 1;
      for (let i = 0; i < 40; i++) { const x = R() * S, y = R() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y - 3 - R() * 3); g.stroke(); }
      break;
    case 'terra': case 'campo':
      base(id === 'campo' ? '#c09058' : '#a8885a');
      noise(g, S, S, R, 220, id === 'campo' ? ['#b08048', '#caa06a', '#a87444'] : ['#98784a', '#b8986a', '#8a6a42'], [1, 3]);
      noise(g, S, S, R, 14, ['#7a6a5a', '#d8c8a8'], [2, 4]);
      break;
    case 'asfalto': case 'estacionamento':
      base('#4a4a52');
      noise(g, S, S, R, 500, ['#42424a', '#55555e', '#3c3c44', '#5c5c64'], [1, 2]);
      g.strokeStyle = '#34343a'; g.lineWidth = 1;
      if (R() < 0.7) { g.beginPath(); let x = R() * S, y = R() * S; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 18; y += (R() - 0.5) * 18; g.lineTo(x, y); } g.stroke(); }
      if (id === 'estacionamento') { g.fillStyle = '#e8e8e0'; g.fillRect(0, 0, 3, S); }
      break;
    case 'faixa':
      base('#4a4a52');
      noise(g, S, S, R, 300, ['#42424a', '#55555e'], [1, 2]);
      g.fillStyle = '#ecece4';
      for (let y = 4; y < S; y += 16) g.fillRect(0, y, S, 8);
      break;
    case 'calcada':
      base('#c4bdb0');
      noise(g, S, S, R, 200, ['#b8b0a2', '#cec8bc', '#aaa294'], [1, 2]);
      g.strokeStyle = '#9a9284'; g.lineWidth = 1.5;
      g.strokeRect(0.75, 0.75, S - 1.5, S - 1.5);
      g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.stroke();
      break;
    case 'pedra': {
      // pedra portuguesa com ondas pretas
      base('#eeeae0');
      g.fillStyle = '#2a2a2e';
      for (let y = -S; y < S * 2; y += 32) {
        g.beginPath();
        for (let x = 0; x <= S; x += 2) g.lineTo(x, y + Math.sin(x / S * Math.PI * 2) * 9);
        for (let x = S; x >= 0; x -= 2) g.lineTo(x, y + 12 + Math.sin(x / S * Math.PI * 2) * 9);
        g.fill();
      }
      g.strokeStyle = 'rgba(120,110,100,0.35)'; g.lineWidth = 1;
      for (let i = 0; i < 90; i++) { const x = R() * S, y = R() * S; g.strokeRect(x, y, 3, 3); }
      break;
    }
    case 'madeira':
      base('#b77f4b');
      for (let x = 0; x < S; x += 16) {
        g.fillStyle = ['#b0784a', '#c08852', '#a87044', '#b88048'][x / 16];
        g.fillRect(x, 0, 16, S);
        g.fillStyle = '#7a4e2a'; g.fillRect(x, 0, 1.5, S);
        const cut = R() * S; g.fillRect(x, cut, 16, 1.2);
        g.strokeStyle = 'rgba(90,50,20,0.25)';
        for (let k = 0; k < 3; k++) { g.beginPath(); const xx = x + 3 + R() * 10; g.moveTo(xx, 0); g.bezierCurveTo(xx + 2, S / 3, xx - 2, S * 2 / 3, xx, S); g.stroke(); }
      }
      break;
    case 'ceramica':
      base('#dccca8');
      for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 32) { g.fillStyle = ['#d8c8a4', '#e2d2b0', '#d2c29e'][Math.floor(R() * 3)]; g.fillRect(x + 1, y + 1, 30, 30); }
      g.fillStyle = '#b8a888'; for (const v of [0, 32]) { g.fillRect(v, 0, 1.5, S); g.fillRect(0, v, S, 1.5); }
      break;
    case 'granilite':
      base('#cac6be');
      noise(g, S, S, R, 400, ['#9a968e', '#e8e4dc', '#7a766e', '#d8c8b8', '#b8b4ac'], [1, 2.5]);
      g.fillStyle = '#a8a49c'; g.fillRect(0, 0, S, 1.2); g.fillRect(0, 0, 1.2, S);
      break;
    case 'mercado':
      base('#e8e6de');
      noise(g, S, S, R, 60, ['#dcdad2', '#f2f0ea'], [1, 3]);
      g.fillStyle = '#c8c6be'; g.fillRect(0, 0, S, 1.5); g.fillRect(0, 0, 1.5, S);
      break;
    case 'cimento':
      base('#9e9c94');
      noise(g, S, S, R, 300, ['#94928a', '#a8a69e', '#8a887f'], [1, 3]);
      g.fillStyle = 'rgba(60,55,50,0.12)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(R() * S, R() * S, 4 + R() * 10, 0, 7); g.fill(); }
      break;
    case 'brita':
      base('#7a7068');
      noise(g, S, S, R, 600, ['#6a6058', '#8a8078', '#5a5048', '#9a9088'], [1.5, 3.5]);
      break;
    case 'areia':
      base('#e4d198');
      noise(g, S, S, R, 300, ['#d8c488', '#ecdcaa', '#c8b478'], [1, 2]);
      break;
    case 'agua':
      base('#3f86b0');
      noise(g, S, S, R, 80, ['#5a9ec6', '#357aa4'], [2, 6]);
      break;
    case 'ponte':
      base('#8e8c88');
      noise(g, S, S, R, 250, ['#84827e', '#9a9894', '#7a7874'], [1, 2]);
      g.fillStyle = '#6a6864'; g.fillRect(0, 0, S, 2);
      break;
    case 'quadra':
      base('#3f7fb8');
      noise(g, S, S, R, 160, ['#3a78b0', '#4686c0'], [1, 2]);
      break;
    case 'ladrilho': {
      base('#e8dcc4');
      const cs = 32;
      for (let y = 0; y < S; y += cs) for (let x = 0; x < S; x += cs) {
        g.fillStyle = '#b54a3a';
        g.beginPath(); g.arc(x + cs / 2, y + cs / 2, 9, 0, 7); g.fill();
        g.fillStyle = '#e8dcc4'; g.beginPath(); g.arc(x + cs / 2, y + cs / 2, 4, 0, 7); g.fill();
        g.fillStyle = '#2a5a4a';
        for (const [cx, cy] of [[x, y], [x + cs, y], [x, y + cs], [x + cs, y + cs]]) { g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill(); }
      }
      g.fillStyle = '#c8b898'; for (const v of [0, 32]) { g.fillRect(v, 0, 1, S); g.fillRect(0, v, S, 1); }
      break;
    }
    case 'lab':
      base('#e4ece6');
      noise(g, S, S, R, 40, ['#d8e2dc', '#eef4f0'], [2, 4]);
      g.fillStyle = '#c4d0c8'; g.fillRect(0, 0, S, 1); g.fillRect(0, 0, 1, S);
      break;
    case 'canteiro':
      base('#5a4632');
      noise(g, S, S, R, 150, ['#4a3a28', '#6a543c'], [1, 3]);
      for (let i = 0; i < 26; i++) {
        const x = R() * S, y = R() * S;
        g.fillStyle = ['#4f9a3a', '#5aa846', '#3f8a30'][Math.floor(R() * 3)];
        g.beginPath(); g.arc(x, y, 2 + R() * 3, 0, 7); g.fill();
        if (R() < 0.35) { g.fillStyle = ['#f6d04a', '#f06a8a', '#ffffff', '#e84a3a'][Math.floor(R() * 4)]; g.beginPath(); g.arc(x, y, 1.5, 0, 7); g.fill(); }
      }
      break;
    case 'banheiro':
      base('#b8dce4');
      for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) { g.fillStyle = (x + y) % 32 ? '#aad2dc' : '#c4e4ea'; g.fillRect(x + 0.5, y + 0.5, 15, 15); }
      g.fillStyle = '#90b8c2'; for (let v = 0; v < S; v += 16) { g.fillRect(v, 0, 1, S); g.fillRect(0, v, S, 1); }
      break;
    default:
      base('#ff00ff');
  }
}

let atlasCache = null;
export function floorAtlas() {
  if (atlasCache) return atlasCache;
  const n = FLOORS.length;
  const rows = Math.ceil(n / ATLAS_COLS);
  const c2 = canvas(ATLAS_COLS * CELL, rows * CELL);
  const g2 = c2.getContext('2d');
  const tile = canvas(TILE_PX, TILE_PX);
  const tg = tile.getContext('2d');
  FLOORS.forEach((f, i) => {
    const cx = (i % ATLAS_COLS) * CELL, cy = Math.floor(i / ATLAS_COLS) * CELL;
    const R = mulberry32(1000 + i * 77);
    tg.clearRect(0, 0, TILE_PX, TILE_PX);
    drawFloor(f.id, tg, R);
    // repete a textura em volta (margem) para não aparecer costura entre pisos
    g2.save(); g2.beginPath(); g2.rect(cx, cy, CELL, CELL); g2.clip();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) g2.drawImage(tile, cx + GUT + dx * TILE_PX, cy + GUT + dy * TILE_PX);
    g2.restore();
  });
  const tex = new THREE.CanvasTexture(c2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = 4;
  atlasCache = { tex, w: c2.width, h: c2.height };
  return atlasCache;
}
// coordenadas UV do piso i no atlas
export function atlasUV(i) {
  const { w, h } = floorAtlas();
  const cx = (i % ATLAS_COLS) * CELL + GUT, cy = Math.floor(i / ATLAS_COLS) * CELL + GUT;
  return { u0: cx / w, v0: 1 - (cy + TILE_PX) / h, u1: (cx + TILE_PX) / w, v1: 1 - cy / h };
}

// ------------------------------------------------------------ telhados
const roofCache = {};
export function roofTexture(kind) {
  if (roofCache[kind]) return roofCache[kind];
  const c = canvas(128, 128), g = c.getContext('2d');
  const R = mulberry32(kind.length * 31);
  if (kind === 'telha') {
    g.fillStyle = '#c8663a'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) {
      for (let x = (y / 16) % 2 ? -8 : 0; x < 128; x += 16) {
        const col = ['#c8663a', '#d0703e', '#b85a32', '#d87a44', '#a85030'][Math.floor(R() * 5)];
        const gr = g.createLinearGradient(x, 0, x + 16, 0);
        gr.addColorStop(0, col); gr.addColorStop(0.5, '#e8904e'); gr.addColorStop(1, col);
        g.fillStyle = gr; g.beginPath(); g.ellipse(x + 8, y + 8, 8, 10, 0, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = 'rgba(80,30,10,0.45)'; g.fillRect(0, y + 14, 128, 2);
    }
    noise(g, 128, 128, R, 40, ['rgba(40,40,30,0.25)', 'rgba(90,110,60,0.25)'], [2, 5]);
  } else if (kind === 'laje') {
    g.fillStyle = '#a8a49a'; g.fillRect(0, 0, 128, 128);
    noise(g, 128, 128, R, 900, ['#9c988e', '#b4b0a6', '#8e8a80'], [1, 3]);
    g.fillStyle = 'rgba(40,40,30,0.18)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(R() * 128, R() * 128, 6 + R() * 16, 0, 7); g.fill(); }
  } else if (kind === 'metal') {
    g.fillStyle = '#9aa4ac'; g.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 8) { g.fillStyle = '#b4bec6'; g.fillRect(x, 0, 3, 128); g.fillStyle = '#7a848c'; g.fillRect(x + 6, 0, 2, 128); }
    noise(g, 128, 128, R, 60, ['rgba(140,90,50,0.35)', 'rgba(60,60,60,0.2)'], [2, 6]);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  roofCache[kind] = t;
  return t;
}

export function waterTexture() {
  const c = canvas(128, 128), g = c.getContext('2d');
  const R = mulberry32(99);
  g.fillStyle = '#3a82ae'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 70; i++) {
    const x = R() * 128, y = R() * 128, w = 8 + R() * 20;
    g.strokeStyle = R() < 0.5 ? 'rgba(160,210,235,0.55)' : 'rgba(40,100,150,0.6)';
    g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 3, x + w, y); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// sombra redonda (para personagens)
let shadowTex = null;
export function blobTexture() {
  if (shadowTex) return shadowTex;
  const c = canvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = canvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
let bloodTex = null;
export function bloodTexture() {
  if (bloodTex) return bloodTex;
  const c = canvas(128, 128), g = c.getContext('2d');
  const R = mulberry32(7);
  g.fillStyle = '#7a1414';
  g.beginPath(); g.arc(64, 64, 26, 0, 7); g.fill();
  for (let i = 0; i < 14; i++) { const a = R() * 7, d = 20 + R() * 36; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 3 + R() * 9, 0, 7); g.fill(); }
  g.fillStyle = '#5a0e0e'; g.beginPath(); g.arc(60, 60, 14, 0, 7); g.fill();
  bloodTex = new THREE.CanvasTexture(c);
  bloodTex.colorSpace = THREE.SRGBColorSpace;
  return bloodTex;
}
// placas com texto (fachadas)
export function signTexture(text, bg = '#2a58b0', fg = '#ffffff', w = 256, h = 64) {
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  g.fillStyle = fg; g.font = `bold ${Math.floor(h * 0.5)}px "Bangers", "Arial Black", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = Math.floor(h * 0.5);
  while (g.measureText(text).width > w - 16 && size > 10) { size--; g.font = `bold ${size}px "Bangers", "Arial Black", sans-serif`; }
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function toonGradient() {
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
