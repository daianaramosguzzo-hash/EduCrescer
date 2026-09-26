// Pinta o modelo por regiões (cores da ficha do herói) e gera UVs para a
// textura do rosto e da estampa da camiseta.
import * as THREE from '../../lib/three.module.min.js';

export const PAL = {
  skin: '#f3c09a', hair: '#3a2213', hairHi: '#55341c', jacket: '#bf7e3e', hood: '#c98a4a', cuff: '#e3cfa8',
  shirt: '#e6e4df', shorts: '#1d1d21', sock: '#f4f4f2', stripe: '#27407e', shoe: '#f1f1ee', shoeBlack: '#1c1c20',
  pack: '#23304f', packLight: '#2d3c60', buckle: '#8c929c', white: '#ffffff', lip: '#c9826c',
};
// caixas das texturas (metros) -> metade esquerda: rosto, metade direita: camiseta
export const FACE = { x0: -0.21, x1: 0.21, y0: 1.2, y1: 1.62 };
export const SHIRT = { x0: -0.12, x1: 0.12, y0: 0.72, y1: 1.2 };
export const EYES = [{ x: -0.097, y: 1.424 }, { x: 0.098, y: 1.424 }];
const HEADC = new THREE.Vector3(0, 1.42, -0.03);

export function region(x, y, z) {
  const ax = Math.abs(x);
  // mãos (elipsoides em volta de cada mão)
  // mãos (medidas no modelo): fora da linha dos bolsos, abaixo do punho
  if (y > 0.53 && y < 0.703 && (x < -0.203 || x > 0.2 || (x > 0.158 && z > 0.07))) return 'skin';
  // cabeça
  if (y > 1.235) {
    const d = Math.hypot(x, y - HEADC.y, z - HEADC.z);
    const ear = ax > 0.185 && y > 1.3 && y < 1.47 && z > -0.1 && z < 0.08;
    if (ear) return 'skin';
    if (y > 1.6) return 'hair';
    if (z < -0.035 && y > 1.3) return 'hair';
    if (y > 1.46 && d > 0.222) return 'hair';
    if (ax > 0.13 && y > 1.42 && z < 0.13) return 'hair';
    return 'skin';
  }
  if (y > 1.215 && z > 0.0 && ax < 0.17) return 'skin';           // queixo
  if (y > 1.15 && ax < 0.085 && z > -0.07 && z < 0.11) return 'skin'; // pescoço
  if (z < -0.14 && y > 0.8 && y < 1.115 && ax < 0.19) return 'pack';
  if (y >= 0.7 && y < 0.745 && ax > 0.185) return 'cuff';
  if (y < 0.035) return 'shoeBlack';
  if (y < 0.2) return (z < -0.04 && y < 0.15) || y < 0.06 ? 'shoeBlack' : 'shoe';
  if (y < 0.325) return 'sock';
  if (y < 0.405) return 'skin';
  if (y < 0.675) return 'shorts';
  if (z > 0.04 && x > -0.086 && x < 0.064 && y < 1.19) return 'shirt';
  return 'jacket';
}

// Suaviza as bordas entre regiões: cada vértice adota o rótulo mais comum
// entre ele e os vizinhos (algumas passadas), eliminando o serrilhado.
export function smoothLabels(g, labels, iters = 4) {
  const idx = g.index.array, n = labels.length;
  const nb = Array.from({ length: n }, () => []);
  for (let i = 0; i < idx.length; i += 3) { const a = idx[i], b = idx[i + 1], c = idx[i + 2]; nb[a].push(b, c); nb[b].push(a, c); nb[c].push(a, b); }
  let cur = labels.slice();
  for (let it = 0; it < iters; it++) {
    const nx = cur.slice();
    for (let i = 0; i < n; i++) {
      const cnt = new Map([[cur[i], 1.5]]);
      for (const j of nb[i]) cnt.set(cur[j], (cnt.get(cur[j]) || 0) + 1);
      let best = cur[i], bv = -1; for (const [k, v] of cnt) if (v > bv) { bv = v; best = k; }
      nx[i] = best;
    }
    cur = nx;
  }
  return cur;
}

// Cores por vértice + UVs + grupos: material 0 = só cores por vértice,
// material 1 = textura (rosto, camiseta e meias), sem misturar as duas.
export function paint(g) {
  const p = g.attributes.position, n = p.count;
  const labels = new Array(n);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let r = region(x, y, z);
    if (r === 'skin' && y > FACE.y0 + 0.03 && y < FACE.y1 && z > 0.02 && Math.abs(x) < 0.2) r = 'face';
    labels[i] = r;
  }
  const L = smoothLabels(g, labels, 5);
  const col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const c = new THREE.Color(), hood = new THREE.Color(PAL.hood), hi = new THREE.Color(PAL.hairHi);
  const cl = v => Math.max(0.002, Math.min(0.998, v));
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = L[i];
    let u, v;
    if (y > 1.2) { u = 0.5 * cl((x - FACE.x0) / (FACE.x1 - FACE.x0)); v = 0.5 + 0.5 * cl((y - FACE.y0) / (FACE.y1 - FACE.y0)); }
    else if (y > 0.66) { u = 0.5 + 0.5 * cl((x - SHIRT.x0) / (SHIRT.x1 - SHIRT.x0)); v = 0.5 + 0.5 * cl((y - SHIRT.y0) / (SHIRT.y1 - SHIRT.y0)); }
    else { u = 0.25; v = 0.5 * cl((y - 0.19) / 0.15); }
    const key = r === 'face' ? 'skin' : r;
    c.set(PAL[key] || '#ff00ff');
    if (r === 'hair') c.lerp(hi, Math.max(0, Math.min(1, (y - 1.62) / 0.25)) * 0.6);
    if (r === 'jacket') c.lerp(hood, Math.max(0, Math.min(1, (y - 1.1) / 0.06)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // triângulos com textura: maioria dos vértices em rosto, camiseta ou meia
  const TEX = new Set(['face', 'shirt', 'sock']);
  const idx = g.index.array, plain = [], tex = [];
  for (let t = 0; t < idx.length; t += 3) {
    const k = TEX.has(L[idx[t]]) + TEX.has(L[idx[t + 1]]) + TEX.has(L[idx[t + 2]]);
    (k >= 2 ? tex : plain).push(idx[t], idx[t + 1], idx[t + 2]);
  }
  g.setIndex([...plain, ...tex]);
  g.clearGroups();
  g.addGroup(0, plain.length, 0);
  g.addGroup(plain.length, tex.length, 1);
  return g;
}

// textura 1024x1024: rosto e camiseta no alto, meias embaixo à esquerda; o resto é branco
export function atlas() {
  const S = 512, cv = document.createElement('canvas');
  cv.width = S * 2; cv.height = S * 2;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S * 2, S * 2);
  // meias: branco com duas listras azul-marinho (v = altura)
  const by = y => S * 2 - (y - 0.19) / 0.15 * S;
  g.fillStyle = PAL.sock; g.fillRect(0, S, S, S);
  g.fillStyle = PAL.stripe; g.fillRect(0, by(0.293), S, by(0.279) - by(0.293)); g.fillRect(0, by(0.315), S, by(0.301) - by(0.315));
  const fx = x => (x - FACE.x0) / (FACE.x1 - FACE.x0) * S, fy = y => S - (y - FACE.y0) / (FACE.y1 - FACE.y0) * S;
  const k = S / (FACE.x1 - FACE.x0); // px por metro
  g.fillStyle = PAL.skin; g.fillRect(0, 0, S, S);
  // bochechas
  for (const s of [-1, 1]) {
    const gr = g.createRadialGradient(fx(s * 0.125), fy(1.345), 0, fx(s * 0.125), fy(1.345), 0.04 * k);
    gr.addColorStop(0, 'rgba(240,130,110,0.45)'); gr.addColorStop(1, 'rgba(240,130,110,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }
  // olhos: branco, íris, pupila, brilhos e contorno superior
  for (const [i, e] of EYES.entries()) {
    const cx = fx(e.x), cy = fy(e.y), rx = 0.07 * k, ry = 0.078 * k;
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip();
    const ix = cx + 0.014 * k, iy = cy + 0.006 * k, ir = 0.047 * k;
    const gi = g.createRadialGradient(ix, iy - ir * 0.3, ir * 0.1, ix, iy, ir);
    gi.addColorStop(0, '#8a5a2e'); gi.addColorStop(0.7, '#5a3418'); gi.addColorStop(1, '#2e1a0c');
    g.fillStyle = gi; g.beginPath(); g.arc(ix, iy, ir, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#120a06'; g.beginPath(); g.arc(ix, iy + 0.002 * k, ir * 0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ix - ir * 0.35, iy - ir * 0.4, ir * 0.28, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(ix + ir * 0.4, iy + ir * 0.35, ir * 0.12, 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = '#2a170c'; g.lineWidth = 0.011 * k; g.lineCap = 'round';
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    g.lineWidth = 0.004 * k; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
    // sobrancelha grossa
    const s = i ? 1 : -1;
    g.strokeStyle = '#2e1a0e'; g.lineWidth = 0.016 * k;
    g.beginPath(); g.moveTo(fx(e.x - s * 0.055), fy(1.518)); g.quadraticCurveTo(fx(e.x + s * 0.005), fy(1.55), fx(e.x + s * 0.06), fy(1.53)); g.stroke();
  }
  // boca: sorriso
  g.strokeStyle = '#8a3a2a'; g.lineWidth = 0.007 * k; g.lineCap = 'round';
  g.beginPath(); g.moveTo(fx(-0.06), fy(1.326)); g.quadraticCurveTo(fx(0), fy(1.29), fx(0.06), fy(1.326)); g.stroke();
  // camiseta com a estampa
  const sx = x => S + (x - SHIRT.x0) / (SHIRT.x1 - SHIRT.x0) * S, sy = y => S - (y - SHIRT.y0) / (SHIRT.y1 - SHIRT.y0) * S;
  g.fillStyle = PAL.shirt; g.fillRect(S, 0, S, S);
  g.save(); g.translate(sx(0.0), sy(1.03)); g.scale(1, 0.5); // a caixa é 2x mais alta que larga
  g.fillStyle = '#4a4a50'; g.font = `900 ${0.045 * S / 0.24}px Arial Black, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('CRESCER', 0, 0);
  g.restore();
  g.fillStyle = '#ec7a3c'; g.fillRect(sx(-0.03), sy(0.99), 0.035 * S / 0.24, 0.016 * S / 0.48);
  g.fillStyle = '#a8a8ac'; g.fillRect(sx(0.008), sy(0.99), 0.02 * S / 0.24, 0.016 * S / 0.48);
  return cv;
}
