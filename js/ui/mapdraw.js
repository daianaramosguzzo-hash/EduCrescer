// Desenho do mapa (tela cheia e minimapa) a partir dos dados do mundo.
import { REGIONS, DANGER, BASE, WORLD_HALF } from '../data/regions.js';
import { EXTENT, RIVER_Z, POND } from '../world/terrain.js';

export function renderMapImage(world, size = 720) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const k = size / (EXTENT * 2);
  const P = v => (v + EXTENT) * k;
  // chão a partir da pintura do terreno
  const S = world.splat.size, data = world.splatData;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = Math.floor(x / size * S), sy = Math.floor(y / size * S), i = (sy * S + sx) * 4;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255, s = Math.max(0, 1 - r - g - b);
    const o = (y * size + x) * 4;
    img.data[o] = r * 92 + g * 122 + b * 70 + s * 176;
    img.data[o + 1] = r * 110 + g * 100 + b * 72 + s * 160;
    img.data[o + 2] = r * 62 + g * 72 + b * 76 + s * 118;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // água
  ctx.fillStyle = '#3f6a78';
  ctx.fillRect(0, P(RIVER_Z + 2), size, size);
  ctx.beginPath(); ctx.arc(P(POND.x), P(POND.z), (POND.r + 1) * k, 0, 7); ctx.fill();
  // árvores
  ctx.fillStyle = 'rgba(40,70,30,0.55)';
  for (const n of world.nodes) if (n.tree) { ctx.beginPath(); ctx.arc(P(n.x), P(n.z), 1.6 * k, 0, 7); ctx.fill(); }
  // construções
  for (const b of world.buildings) {
    ctx.fillStyle = '#b8aa98'; ctx.fillRect(P(b.x0), P(b.z0), (b.x1 - b.x0) * k, (b.z1 - b.z0) * k);
    ctx.strokeStyle = '#4a4038'; ctx.lineWidth = 1; ctx.strokeRect(P(b.x0), P(b.z0), (b.x1 - b.x0) * k, (b.z1 - b.z0) * k);
  }
  // ferrovia
  ctx.strokeStyle = '#3a3030'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(0, P(96)); ctx.lineTo(size, P(96)); ctx.stroke(); ctx.setLineDash([]);
  // terreno da base
  ctx.strokeStyle = '#e8a33d'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
  ctx.strokeRect(P(BASE.x0), P(BASE.z0), (BASE.x1 - BASE.x0) * k, (BASE.z1 - BASE.z0) * k); ctx.setLineDash([]);
  return c;
}

// mapa grande: regiões com névoa, cadeados e marcadores
export function drawWorldMap(ctx, img, G, W, H) {
  const size = Math.min(W, H);
  const ox = (W - size) / 2, oy = (H - size) / 2;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, ox, oy, size, size);
  const k = size / (EXTENT * 2);
  const P = (x, z) => [ox + (x + EXTENT) * k, oy + (z + EXTENT) * k];
  const S = G.state.world;
  for (const R of REGIONS) {
    const [x0, y0] = P(R.x0, R.z0), [x1, y1] = P(R.x1, R.z1);
    const disc = S.discovered.includes(R.id), unl = S.unlocked.includes(R.id);
    if (!disc) { ctx.fillStyle = 'rgba(14,16,20,0.72)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
    if (!unl) {
      ctx.fillStyle = 'rgba(80,10,10,0.25)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeStyle = 'rgba(230,80,60,0.8)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.strokeRect(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4); ctx.setLineDash([]);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.font = `bold ${Math.round(size / 42)}px Oswald, "Arial Narrow", sans-serif`; ctx.textAlign = 'center';
    const label = (unl ? '' : '🔒 ') + (disc || unl ? R.name : '???');
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(label, (x0 + x1) / 2 + 1, y0 + size / 30 + 1);
    ctx.fillStyle = '#f2ead8'; ctx.fillText(label, (x0 + x1) / 2, y0 + size / 30);
    ctx.font = `${Math.round(size / 48)}px sans-serif`;
    ctx.fillText(DANGER[R.danger].icon, (x0 + x1) / 2, y0 + size / 30 + size / 38);
  }
  // marcadores
  const mark = (x, z, emoji, s = 1) => { const [px, py] = P(x, z); ctx.font = `${Math.round(size / 34 * s)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(emoji, px, py); ctx.textBaseline = 'alphabetic'; };
  mark((BASE.x0 + BASE.x1) / 2, (BASE.z0 + BASE.z1) / 2, '⛺');
  for (const b of G.state.bags) mark(b.x, b.z, '🎒');
  const t = G.questTarget && G.questTarget();
  if (t) mark(t.x, t.z, '❗', 1.1);
  for (const [id, P0] of Object.entries(G.world.pois)) {
    if (['base', 'banca'].includes(id)) continue;
    const R = REGIONS.find(r => P0.x >= r.x0 && P0.x < r.x1 && P0.z >= r.z0 && P0.z < r.z1);
    if (R && !S.discovered.includes(R.id)) continue;
    const [px, py] = P(P0.x, P0.z);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.font = `${Math.round(size / 60)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(P0.name, px + 1, py + size / 50 + 1); ctx.fillStyle = '#fff8e0'; ctx.fillText(P0.name, px, py + size / 50);
    ctx.fillStyle = '#e8a33d'; ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill();
  }
  // jogador
  const p = G.player;
  const [px, py] = P(p.x, p.z);
  ctx.save(); ctx.translate(px, py); ctx.rotate(-p.rot + Math.PI);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.restore();
  return { ox, oy, size, k };
}

// minimapa circular (mostra ~60 m em volta)
export function drawMinimap(ctx, img, G, S) {
  const p = G.player;
  const range = 42;
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, 7); ctx.clip();
  const k = img.width / (EXTENT * 2);
  const sx = (p.x - range + EXTENT) * k, sy = (p.z - range + EXTENT) * k, sw = range * 2 * k;
  ctx.fillStyle = '#20241e'; ctx.fillRect(0, 0, S, S);
  ctx.drawImage(img, sx, sy, sw, sw, 0, 0, S, S);
  const m = S / (range * 2);
  const P = (x, z) => [(x - p.x + range) * m, (z - p.z + range) * m];
  // construções do jogador
  ctx.fillStyle = '#e8c070';
  for (const s of G.state.base.structures) { const [x, y] = P(s.x, s.z); if (x > -5 && x < S + 5 && y > -5 && y < S + 5) ctx.fillRect(x - 2, y - 2, 4, 4); }
  // sobreviventes
  ctx.fillStyle = '#6ad0ff';
  for (const n of Object.values(G.survivors.npcs)) { const [x, y] = P(n.x, n.z); ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
  for (const n of Object.values(G.survivors.rescue)) { const [x, y] = P(n.x, n.z); ctx.fillStyle = '#6ad0ff'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
  // zumbis por perto
  for (const z of G.zombies.list) {
    if (z.dead) continue;
    const d = Math.hypot(z.x - p.x, z.z - p.z);
    if (d > 30) continue;
    const [x, y] = P(z.x, z.z);
    ctx.fillStyle = z.def.boss ? '#ff2a7a' : (z.state === 'chase' || z.state === 'attack') ? '#ff3a2a' : '#c85a4a';
    ctx.beginPath(); ctx.arc(x, y, z.def.boss ? 5 : 3, 0, 7); ctx.fill();
  }
  // mochila de morte
  for (const b of G.state.bags) { const [x, y] = P(b.x, b.z); ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎒', Math.max(8, Math.min(S - 8, x)), Math.max(8, Math.min(S - 8, y))); }
  // alvo da missão
  const t = G.questTarget && G.questTarget();
  if (t) {
    let [x, y] = P(t.x, t.z);
    const dx = x - S / 2, dy = y - S / 2, d = Math.hypot(dx, dy), lim = S / 2 - 10;
    if (d > lim) { x = S / 2 + dx / d * lim; y = S / 2 + dy / d * lim; }
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd24a'; ctx.fillText('❗', x, y);
  }
  ctx.restore();
  // jogador
  ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(-p.rot + Math.PI);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, 7); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', S / 2, 13);
}
