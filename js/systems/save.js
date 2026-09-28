// Salvamento no armazenamento local do navegador (localStorage).
// Guarda personagem ativo, posição, inventários, equipamentos, níveis, XP,
// construções, recursos, áreas, missões, sobreviventes e história.
import { SAVE_VERSION, newGameState } from './state.js';

const KEY = 'ultimo-refugio-aimores-save';
const SETTINGS = 'ultimo-refugio-aimores-config';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}
export function saveInfo() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (!s) return null;
    const ch = s.chars[s.active];
    return { active: s.active, level: ch.level, day: s.day, saved: s.saved };
  } catch (e) { return null; }
}
export function writeSave(state) {
  try {
    state.saved = Date.now();
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) { console.warn('Não foi possível salvar', e); return false; }
}
export function readSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (!s) return null;
    return migrate(s);
  } catch (e) { console.warn('Save corrompido', e); return null; }
}
export function deleteSave() { try { localStorage.removeItem(KEY); } catch (e) {} }

// completa campos que versões antigas não tinham
function migrate(s) {
  const fresh = newGameState();
  for (const k of Object.keys(fresh)) if (s[k] === undefined) s[k] = fresh[k];
  for (const k of Object.keys(fresh.world)) if (s.world[k] === undefined) s.world[k] = fresh.world[k];
  for (const [id, c] of Object.entries(fresh.chars)) {
    if (!s.chars[id]) s.chars[id] = c;
    for (const k of Object.keys(c)) if (s.chars[id][k] === undefined) s.chars[id][k] = c[k];
    while (s.chars[id].inv.length < 24) s.chars[id].inv.push(null);
  }
  s.version = SAVE_VERSION;
  return s;
}

export function loadSettings() {
  const def = { music: 0.45, sfx: 0.9, quality: matchMedia('(pointer: coarse)').matches ? 'media' : 'alta', zoom: 1, hints: true };
  try { return { ...def, ...(JSON.parse(localStorage.getItem(SETTINGS)) || {}) }; } catch (e) { return def; }
}
export function saveSettings(s) { try { localStorage.setItem(SETTINGS, JSON.stringify(s)); } catch (e) {} }
