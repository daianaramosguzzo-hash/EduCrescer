// Banco de sprites: pinta sob demanda uma "tira" (quadros de uma animação em uma direção)
// e guarda em cache, com limite de memória (os menos usados são descartados).
import { paintFrame, ANIMS } from './painter.js';
import { LOOKS } from './looks.js';

export const FRAME_W = 112, FRAME_H = 136, FOOT_Y = 128;
export const BAKE_SCALE = 0.95;           // resolução das tiras no jogo
export const PX_PER_UNIT = 54;            // pixels (escala 1) por unidade do mundo

const cache = new Map();
let bytes = 0;
const LIMIT = 90 * 1024 * 1024;
let clock = 0;

export function frameDims(look) {
  const m = look.frameMul || (look.scale && look.scale > 1.05 ? look.scale * 1.08 : 1);
  return { fw: Math.round(FRAME_W * m * BAKE_SCALE), fh: Math.round(FRAME_H * m * BAKE_SCALE), foot: Math.round(FOOT_Y * m * BAKE_SCALE), mul: m };
}

// hold: classe visual da arma na mão
export function getStrip(lookId, anim, dir, hold = 'none', onEvict) {
  const key = lookId + '|' + anim + '|' + dir + '|' + hold;
  let e = cache.get(key);
  if (e) { e.used = ++clock; return e; }
  const look = LOOKS[lookId];
  const A = ANIMS[anim] || ANIMS.idle;
  const { fw, fh, foot, mul } = frameDims(look);
  const c = document.createElement('canvas');
  c.width = fw * A.frames; c.height = fh;
  const g = c.getContext('2d');
  for (let f = 0; f < A.frames; f++) {
    paintFrame(g, look, anim, f, dir, hold, f * fw + fw / 2, foot, BAKE_SCALE);
  }
  e = { key, canvas: c, frames: A.frames, fw, fh, foot, mul, used: ++clock, tex: null };
  cache.set(key, e);
  bytes += c.width * c.height * 4;
  if (bytes > LIMIT) evict(onEvict);
  return e;
}
function evict(onEvict) {
  const list = [...cache.values()].sort((a, b) => a.used - b.used);
  for (const e of list) {
    if (bytes < LIMIT * 0.75) break;
    if (clock - e.used < 60) continue;
    cache.delete(e.key);
    bytes -= e.canvas.width * e.canvas.height * 4;
    if (e.tex) e.tex.dispose();
    if (onEvict) onEvict(e);
  }
}
export function bankStats() { return { entries: cache.size, mb: (bytes / 1048576).toFixed(1) }; }
