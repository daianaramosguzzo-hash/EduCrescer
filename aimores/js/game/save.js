// Salvar e carregar: três espaços manuais + automático (localStorage), exportar/importar arquivo.
const KEY = 'aimores-dos-mortos-save-';
export const SLOTS = ['auto', 1, 2, 3];

function store() { try { return window.localStorage; } catch (_) { return null; } }

export function save(g, slot) {
  const ls = store();
  if (!ls) { g.toast('Não foi possível salvar neste navegador.', 'erro'); return false; }
  try {
    const data = g.serialize();
    const meta = { dia: g.day(), hora: g.clock(), vivos: g.liveHeroes.map(h => h.name).join(', '), quando: Date.now() };
    ls.setItem(KEY + slot, JSON.stringify({ meta, data }));
    return true;
  } catch (e) {
    console.error(e);
    g.toast('Erro ao salvar (espaço cheio?).', 'erro');
    return false;
  }
}
export function meta(slot) {
  const ls = store();
  if (!ls) return null;
  try { const raw = ls.getItem(KEY + slot); return raw ? JSON.parse(raw).meta : null; } catch (_) { return null; }
}
export function read(slot) {
  const ls = store();
  if (!ls) return null;
  try { const raw = ls.getItem(KEY + slot); return raw ? JSON.parse(raw).data : null; } catch (_) { return null; }
}
export function any() { return SLOTS.some(s => meta(s)); }
export function latest() {
  let best = null, t = 0;
  for (const s of SLOTS) { const m = meta(s); if (m && m.quando > t) { t = m.quando; best = s; } }
  return best;
}
export function exportFile(g) {
  const data = { meta: { dia: g.day(), hora: g.clock(), vivos: g.liveHeroes.map(h => h.name).join(', '), quando: Date.now() }, data: g.serialize() };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `aimores-dia${g.day()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function importText(text) {
  const obj = JSON.parse(text);
  if (!obj.data || !obj.meta) throw new Error('arquivo inválido');
  store()?.setItem(KEY + 3, JSON.stringify(obj));
}
