// Utilidades da interface: criação de elementos, retratos e ícones.
import { HEROES } from '../data/heroes.js';
import { LOOKS } from '../sprites/looks.js';
import { paintPortrait } from '../sprites/painter.js';
import { ITEMS } from '../data/items.js';

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}

const portraitCache = new Map();
// retrato: heróis usam a arte original; NPCs e zumbis são pintados na hora
export function portraitOf(u) {
  if (!u) return '';
  if (u.kind === 'hero' && HEROES[u.id]) return HEROES[u.id].retrato;
  return lookPortrait(u.look);
}
export function lookPortrait(lookId) {
  if (portraitCache.has(lookId)) return portraitCache.get(lookId);
  const look = LOOKS[lookId];
  if (!look) return '';
  const c = document.createElement('canvas');
  c.width = 160; c.height = 160;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 160);
  grd.addColorStop(0, look.gait && look.gait !== 'human' ? '#5a7a3a' : '#6a5a8a');
  grd.addColorStop(1, look.gait && look.gait !== 'human' ? '#2a3a1a' : '#2a2038');
  const tmp = document.createElement('canvas'); tmp.width = 160; tmp.height = 160;
  paintPortrait(tmp, look);
  g.fillStyle = grd; g.fillRect(0, 0, 160, 160);
  g.drawImage(tmp, 0, 0);
  const url = c.toDataURL('image/png');
  portraitCache.set(lookId, url);
  return url;
}
export function itemIcon(id) { return ITEMS[id]?.icon || '❔'; }
export function pct(v, max) { return Math.max(0, Math.min(100, (v / max) * 100)); }
export function bar(cls, v, max, color) {
  const b = h('div', { class: 'bar ' + (cls || '') }, h('i', { style: { width: pct(v, max) + '%', background: color || null } }));
  return b;
}
