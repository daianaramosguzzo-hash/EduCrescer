// Exporta os mapas de js/maps.js e os dados de js/data.js para JSON, para a versão Unity.
// As funções (falas, condições, eventos) não viram JSON: cada objeto que tinha
// funções ganha a lista "_fn" com o nome delas, para a Unity saber que existem.
// Uso: node tools/unity/exportar-mapas.mjs
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'CriaturasUnity', 'Assets', 'StreamingAssets', 'Dados');
mkdirSync(join(out, 'Mapas'), { recursive: true });

const { MAPS } = await import(pathToFileURL(join(root, 'js', 'maps.js')));
const { SPECIES, MOVES, ITEMS, TYPES, BADGES } = await import(pathToFileURL(join(root, 'js', 'data.js')));

function plain(v) {
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') {
    const o = {}, fns = [], src = {};
    for (const [k, x] of Object.entries(v)) {
      if (k.startsWith('_')) continue;
      if (typeof x === 'function') { fns.push(k); src[k] = x.toString(); }
      else o[k] = plain(x);
    }
    // o código-fonte das funções vai junto: a Unity tira dele as falas simples
    if (fns.length) { o._fn = fns; o._src = src; }
    return o;
  }
  return v;
}

const ids = [];
for (const [id, m] of Object.entries(MAPS)) {
  const data = plain({ id, ...m });
  writeFileSync(join(out, 'Mapas', id + '.json'), JSON.stringify(data, null, 1));
  ids.push(id);
}
writeFileSync(join(out, 'mapas.json'), JSON.stringify({ ids }, null, 1));
writeFileSync(join(out, 'especies.json'), JSON.stringify(plain({ list: Object.entries(SPECIES).map(([id, s]) => ({ id, ...s })) }), null, 1));
writeFileSync(join(out, 'golpes.json'), JSON.stringify(plain({ list: Object.entries(MOVES).map(([id, s]) => ({ id, ...s })) }), null, 1));
writeFileSync(join(out, 'itens.json'), JSON.stringify(plain({ list: Object.entries(ITEMS).map(([id, s]) => ({ id, ...s })) }), null, 1));
writeFileSync(join(out, 'tipos.json'), JSON.stringify(plain({ types: TYPES, badges: BADGES }), null, 1));
// os roteiros da história rodam na Unity pelo interpretador Jint: vai o próprio maps.js
copyFileSync(join(root, 'js', 'maps.js'), join(out, 'maps.js'));
console.log(`${ids.length} mapas exportados para ${out}`);
