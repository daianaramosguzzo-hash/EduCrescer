// Força Tática — texturas feitas em código (canvas)
import * as THREE from '../../lib/three.module.min.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function rand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function toTex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function speckle(g, w, h, n, r, colors) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(r() * colors.length) | 0];
    g.globalAlpha = 0.05 + r() * 0.12;
    const s = 1 + r() * 3;
    g.fillRect(r() * w, r() * h, s, s);
  }
  g.globalAlpha = 1;
}

// Parede de arenito: blocos, rejunte, sujeira embaixo e acabamento em cima.
// A textura cobre a altura toda da parede (v de 0 a 1).
export function wallTexture() {
  const [c, g] = canvas(256, 512);
  const r = rand(7);
  g.fillStyle = '#e2c99a';
  g.fillRect(0, 0, 256, 512);
  const rowH = 36;
  for (let y = 40, row = 0; y < 470; y += rowH, row++) {
    const off = row % 2 ? 0 : 64;
    for (let x = -off; x < 256; x += 128) {
      const l = 205 + r() * 30;
      g.fillStyle = `rgb(${l + 18},${l - 4},${l - 52})`;
      g.fillRect(x + 2, y + 2, 124, rowH - 4);
    }
    g.fillStyle = 'rgba(120,90,50,0.35)';
    g.fillRect(0, y, 256, 2);
  }
  for (let y = 40, row = 0; y < 470; y += rowH, row++) {
    const off = row % 2 ? 0 : 64;
    for (let x = -off; x < 256; x += 128) {
      g.fillStyle = 'rgba(120,90,50,0.3)';
      g.fillRect(x, y, 2, rowH);
    }
  }
  speckle(g, 256, 512, 2500, r, ['#7a5a32', '#fff4d8', '#a07a48']);
  // acabamento no topo
  g.fillStyle = '#c9ab78';
  g.fillRect(0, 0, 256, 40);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 36, 256, 4);
  // sujeira na base
  const grd = g.createLinearGradient(0, 512, 0, 400);
  grd.addColorStop(0, 'rgba(90,62,30,0.55)');
  grd.addColorStop(1, 'rgba(90,62,30,0)');
  g.fillStyle = grd;
  g.fillRect(0, 400, 256, 112);
  return toTex(c);
}

export function floorTexture() {
  const [c, g] = canvas(512, 512);
  const r = rand(11);
  g.fillStyle = '#d8bd8a';
  g.fillRect(0, 0, 512, 512);
  // manchas de areia
  for (let i = 0; i < 90; i++) {
    const x = r() * 512, y = r() * 512, rad = 20 + r() * 70;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < 0.5;
    grd.addColorStop(0, dark ? 'rgba(150,115,70,0.18)' : 'rgba(245,225,185,0.2)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // lajotas gastas
  g.strokeStyle = 'rgba(110,80,45,0.18)';
  g.lineWidth = 2;
  for (let y = 0; y < 512; y += 128) for (let x = 0; x < 512; x += 128) {
    if (r() < 0.55) g.strokeRect(x + 3, y + 3, 122, 122);
  }
  speckle(g, 512, 512, 6000, r, ['#6e5030', '#f8e8c8', '#9c7a4c', '#544030']);
  return toTex(c);
}

export function tileTexture() {
  const [c, g] = canvas(256, 256);
  const r = rand(23);
  g.fillStyle = '#9fa3a3';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) {
    const l = 150 + r() * 30;
    g.fillStyle = `rgb(${l},${l + 4},${l + 6})`;
    g.fillRect(x + 2, y + 2, 60, 60);
  }
  speckle(g, 256, 256, 1500, r, ['#555', '#ddd']);
  return toTex(c);
}

export function crateTexture(kind = 'wood') {
  const [c, g] = canvas(256, 256);
  const r = rand(kind === 'wood' ? 31 : 37);
  if (kind === 'wood') {
    g.fillStyle = '#9a6a3a';
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      const l = r() * 30;
      g.fillStyle = `rgb(${150 + l},${100 + l},${55 + l * 0.5})`;
      g.fillRect(0, y + 1, 256, 30);
      g.fillStyle = 'rgba(60,35,15,0.25)';
      for (let k = 0; k < 6; k++) g.fillRect(r() * 256, y + 4 + r() * 22, 30 + r() * 60, 1);
    }
    g.fillStyle = '#6b4522';
    g.fillRect(0, 0, 256, 22); g.fillRect(0, 234, 256, 22);
    g.fillRect(0, 0, 22, 256); g.fillRect(234, 0, 22, 256);
    g.save();
    g.translate(128, 128); g.rotate(Math.PI / 4);
    g.fillRect(-170, -11, 340, 22);
    g.restore();
    g.fillStyle = '#3a2814';
    for (const [x, y] of [[11, 11], [245, 11], [11, 245], [245, 245]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  } else {
    // contêiner de metal
    g.fillStyle = '#3f6f78';
    g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 21) {
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, 0, 4, 256);
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x + 5, 0, 3, 256);
    }
    g.fillStyle = '#2b4c53';
    g.fillRect(0, 0, 256, 14); g.fillRect(0, 242, 256, 14);
    speckle(g, 256, 256, 1800, r, ['#8a5a2a', '#203033', '#9dbac0']);
  }
  return toTex(c);
}

export function woodTexture() {
  const [c, g] = canvas(128, 128);
  const r = rand(41);
  g.fillStyle = '#5d3d22';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(30,18,8,${0.1 + r() * 0.2})`;
    g.fillRect(0, r() * 128, 128, 1 + r() * 2);
  }
  return toTex(c);
}

// Letra do bomb pintada no chão
export function siteDecal(letter) {
  const [c, g] = canvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(200,40,30,0.75)';
  g.lineWidth = 10;
  g.strokeRect(12, 12, 232, 232);
  g.fillStyle = 'rgba(200,40,30,0.8)';
  g.font = 'bold 190px Impact, Arial Black, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 128, 140);
  const t = toTex(c, false);
  return t;
}

// Placa pintada na parede
export function signTexture(text) {
  const [c, g] = canvas(256, 128);
  g.fillStyle = 'rgba(0,0,0,0)';
  g.clearRect(0, 0, 256, 128);
  g.fillStyle = 'rgba(30,30,30,0.82)';
  g.font = 'bold 76px Impact, Arial Black, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 68);
  return toTex(c, false);
}

export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const [c, g] = canvas(size, size);
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return toTex(c, false);
}

export function smokeTexture() {
  const [c, g] = canvas(128, 128);
  const r = rand(53);
  for (let i = 0; i < 26; i++) {
    const x = 64 + (r() - 0.5) * 50, y = 64 + (r() - 0.5) * 50, rad = 20 + r() * 30;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  return toTex(c, false);
}

export function flashTexture() {
  const [c, g] = canvas(128, 128);
  g.translate(64, 64);
  for (let i = 0; i < 7; i++) {
    g.rotate(Math.PI * 2 / 7 + 0.3);
    const grd = g.createLinearGradient(0, 0, 60, 0);
    grd.addColorStop(0, 'rgba(255,240,180,1)');
    grd.addColorStop(1, 'rgba(255,160,40,0)');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(0, -7); g.lineTo(60, 0); g.lineTo(0, 7); g.fill();
  }
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 30);
  grd.addColorStop(0, 'rgba(255,255,230,1)');
  grd.addColorStop(1, 'rgba(255,190,60,0)');
  g.fillStyle = grd;
  g.fillRect(-64, -64, 128, 128);
  return toTex(c, false);
}

export function holeTexture() {
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grd.addColorStop(0, 'rgba(10,8,6,1)');
  grd.addColorStop(0.25, 'rgba(25,20,15,0.95)');
  grd.addColorStop(0.45, 'rgba(70,55,40,0.5)');
  grd.addColorStop(1, 'rgba(70,55,40,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return toTex(c, false);
}

export function skyTexture() {
  const [c, g] = canvas(16, 256);
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#3d79c4');
  grd.addColorStop(0.45, '#8bb8e0');
  grd.addColorStop(0.62, '#e9dcc0');
  grd.addColorStop(1, '#d9c39a');
  g.fillStyle = grd;
  g.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
