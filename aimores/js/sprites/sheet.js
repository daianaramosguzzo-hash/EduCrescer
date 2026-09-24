// Monta a sprite sheet organizada de um visual: uma linha por animação e direção, um quadro por
// coluna, com um JSON descrevendo tamanho do quadro, ponto do pé e em que linha está cada coisa.
import { paintFrame, ANIMS, ANIM_LABEL, DIR_LABEL } from './painter.js';
import { LOOKS } from './looks.js';
import { FRAME_W, FRAME_H, FOOT_Y, frameDims } from './bank.js';
import { HEROES } from '../data/heroes.js';
import { ITEMS } from '../data/items.js';

export const SHEET_ANIMS = Object.keys(ANIMS);
const DIR_KEYS = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'];

// arma usada em cada animação da folha (heróis mostram a arma inicial ao atacar/usar arma)
export function sheetHold(lookId, anim) {
  const H = Object.values(HEROES).find(x => x.look === lookId);
  const look = LOOKS[lookId];
  const cls = H ? ITEMS[H.eq.mao]?.w?.classe : look.weapon || null;
  if (!cls) return 'none';
  const ranged = ['sling', 'pistol', 'shotgun', 'rifle'].includes(cls);
  if (anim === 'attack') return ranged ? 'none' : cls;
  if (anim === 'shoot' || anim === 'aim') return ranged ? cls : (H ? 'pistol' : cls);
  return 'none';
}

export function buildSheet(lookId, { sc = 0.75, hold = null, anims = SHEET_ANIMS, dirs = [0, 1, 2, 3, 4, 5, 6, 7], bg = null } = {}) {
  const look = LOOKS[lookId];
  const { mul } = frameDims(look);
  const fw = Math.round(FRAME_W * mul * sc), fh = Math.round(FRAME_H * mul * sc), foot = Math.round(FOOT_Y * mul * sc);
  const cols = Math.max(...anims.map(a => ANIMS[a].frames));
  const rows = anims.length * dirs.length;
  const c = document.createElement('canvas');
  c.width = cols * fw; c.height = rows * fh;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  const H = Object.values(HEROES).find(x => x.look === lookId);
  const meta = {
    personagem: H ? H.nome : lookId, id: lookId,
    quadro: { largura: fw, altura: fh, pe: { x: Math.round(fw / 2), y: foot } },
    colunas: cols, linhas: rows,
    direcoes: dirs.map(d => ({ id: DIR_KEYS[d], nome: DIR_LABEL[d] })),
    animacoes: {},
  };
  let row = 0;
  for (const a of anims) {
    const A = ANIMS[a];
    const hh = hold || sheetHold(lookId, a);
    const entry = { nome: ANIM_LABEL[a] || a, quadros: A.frames, fps: A.fps, repete: !!A.loop, arma: hh, linhas: {} };
    for (const d of dirs) {
      for (let f = 0; f < A.frames; f++) paintFrame(g, look, a, f, d, hh, f * fw + fw / 2, row * fh + foot, sc);
      entry.linhas[DIR_KEYS[d]] = row;
      row++;
    }
    meta.animacoes[a] = entry;
  }
  return { canvas: c, meta };
}
