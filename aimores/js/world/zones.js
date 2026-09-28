// Zonas fora da cidade (mapa-múndi): cada visita gera o lugar de novo, com recursos, casas
// para vasculhar e zumbis — verde (tranquila), amarela (perigosa) e vermelha (muito perigosa).
import { GameMap } from './map.js';
import { F, S, PROPS } from './tiles.js';
import { stamp } from './blueprint.js';
import { rollLoot } from './mapgen.js';
import { mulberry32 } from '../util.js';

export const ZONES = {
  mata: {
    nome: 'Mata do Rio Doce', perigo: 'verde', minutos: 40, x: 0.18, y: 0.72,
    desc: 'Mata fechada na beira do rio. Muita madeira, fibra e ervas. Poucos zumbis.',
    arvores: 0.1, arbustos: 0.06, rochas: 0.012, rio: true, casas: ['cabana'], zumbis: [['comum', 6]],
  },
  serra: {
    nome: 'Serra do Sossego', perigo: 'amarela', minutos: 60, x: 0.78, y: 0.22,
    desc: 'Pedreiras naturais, árvores e a casa do caseiro. Zumbis rondando a trilha.',
    arvores: 0.05, arbustos: 0.03, rochas: 0.04, piso: 'terra', casas: ['cabana'], zumbis: [['comum', 10], ['corredor', 3], ['furtivo', 1]],
  },
  fazenda: {
    nome: 'Fazenda Boa Esperança', perigo: 'amarela', minutos: 50, x: 0.3, y: 0.2,
    desc: 'Casa-sede, paiol e curral. Comida da roça, ferramentas e zumbis de chapéu de palha.',
    arvores: 0.025, arbustos: 0.02, rochas: 0.006, casas: ['cabana', 'paiol'], curral: true, loot: 'roca', zumbis: [['comum', 12], ['corredor', 2], ['resistente', 1]],
  },
  pedreira: {
    nome: 'Pedreira Abandonada', perigo: 'vermelha', minutos: 75, x: 0.62, y: 0.82,
    desc: 'Pedra e sucata de máquinas à vontade. Zumbi bombado também.',
    arvores: 0.01, arbustos: 0.01, rochas: 0.09, piso: 'brita', maquinas: 7, casas: ['paiol'], loot: 'pedreira', zumbis: [['comum', 14], ['resistente', 4], ['corredor', 4]],
  },
  quartel: {
    nome: 'Posto Militar Abandonado', perigo: 'vermelha', minutos: 90, x: 0.78, y: 0.66,
    desc: 'Barracas e caixas do exército: munição, coletes e armas. Muito perigoso.',
    arvores: 0.015, arbustos: 0.01, rochas: 0.005, piso: 'terra', militar: true, casas: ['cabana', 'cabana'], loot: 'militar', zumbis: [['comum', 16], ['resistente', 3], ['furtivo', 3], ['corredor', 4]],
  },
};
export const PERIGO_COR = { verde: '#5fb82a', amarela: '#f4c534', vermelha: '#e8433a' };

const LEG = { S: 'sofa', T: 'tv', X: 'caixas', C: 'cadeira', B: 'cama', N: 'criado', F: 'fogao', A: 'armario', G: 'geladeira', R: 'guarda_roupa', M: 'mesa', P: 'pallet', D: 'tambor', K: 'sacos', Y: 'bancada' };
const CABANA = [
  '#=####=#',
  '#Bq.#cF#',
  '#N..+.A#',
  '###+####',
  '#S.s..X#',
  '#T....C#',
  '##=!#=##',
];
const PAIOL = [
  '#########',
  '#X.g..XX#',
  '#X.....D#',
  '=.......=',
  '#D..Y..K#',
  '####/####',
];

export function generateZone(id, seed) {
  const Z = ZONES[id];
  const R = mulberry32(seed);
  const rint = (a, b) => a + Math.floor(R() * (b - a + 1));
  const W = 60, H = 60;
  const map = new GameMap(W, H);
  map.zone = id;
  const base = F[Z.piso || 'grama'];
  for (let i = 0; i < W * H; i++) map.floor[i] = base;
  // manchas de terra e grama para dar textura
  for (let k = 0; k < 40; k++) {
    const cx = rint(0, W - 1), cz = rint(0, H - 1), r = rint(2, 5);
    const f = base === F.grama ? F.terra : F.grama;
    for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) if (map.inb(x, z) && Math.hypot(x - cx, z - cz) <= r && R() < 0.8) map.floor[map.idx(x, z)] = f;
  }
  // rio
  if (Z.rio) {
    for (let z = 0; z < H; z++) {
      const x0 = W - 10 + Math.round(Math.sin(z / 7) * 2);
      for (let x = x0; x < W; x++) { const i = map.idx(x, z); if (x < x0 + 2) map.floor[i] = F.areia; else { map.floor[i] = F.agua; map.struct[i] = S.WATER; } }
    }
  }
  const free = (x, z) => map.inb(x, z) && !map.struct[map.idx(x, z)] && map.propAt[map.idx(x, z)] < 0 && map.floor[map.idx(x, z)] !== F.agua;
  const add = (type, x, z, rot = 0, extra) => {
    const [sw, sd] = PROPS[type].size;
    const w = rot % 2 ? sd : sw, d = rot % 2 ? sw : sd;
    for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) if (!free(x + dx, z + dz)) return null;
    return map.addProp(type, x, z, w, d, rot, extra);
  };
  // entrada (sul, no meio) e trilha até o centro
  const ex = W >> 1, ez = H - 3;
  (map.marks.entrada = []).push([ex, ez]);
  for (let z = ez; z > H / 2; z--) for (let dx = -1; dx <= 1; dx++) map.floor[map.idx(ex + dx + Math.round(Math.sin(z / 5)), z)] = F.terra;
  const reserved = (x, z) => Math.abs(x - ex) <= 3 && z >= ez - 4;
  // casas
  const houses = [];
  for (const kind of Z.casas || []) {
    const rows = kind === 'paiol' ? PAIOL : CABANA;
    for (let t = 0; t < 40; t++) {
      const x = rint(4, W - 16), z = rint(4, H - 18);
      let ok = true;
      for (let dz = -2; dz < rows.length + 2 && ok; dz++) for (let dx = -2; dx < rows[0].length + 2; dx++) if (!free(x + dx, z + dz) || reserved(x + dx, z + dz)) { ok = false; break; }
      if (!ok) continue;
      stamp(map, rows, x, z, { name: kind === 'paiol' ? 'Paiol' : 'Casa do caseiro', type: kind, legend: LEG, roof: 'telha', wall: kind === 'paiol' ? '#c8a878' : '#f0e0c0', trim: '#8a5a3a', lootMap: Z.loot ? { caixas: Z.loot, tambor: Z.loot, pallet: Z.loot, armario: Z.loot } : {} });
      houses.push([x, z, rows[0].length, rows.length]);
      break;
    }
  }
  // curral
  if (Z.curral) {
    const cx = rint(8, W - 20), cz = rint(28, H - 16);
    for (let x = cx; x < cx + 10; x++) for (const z of [cz, cz + 7]) if (free(x, z)) map.struct[map.idx(x, z)] = S.FENCE;
    for (let z = cz; z <= cz + 7; z++) for (const x of [cx, cx + 9]) if (free(x, z) && !(x === cx && z === cz + 3)) map.struct[map.idx(x, z)] = S.FENCE;
  }
  // militar: barricadas, sacos de areia e caixas do exército
  if (Z.militar) {
    for (let k = 0; k < 14; k++) add(R() < 0.5 ? 'sacos' : 'caixas', rint(10, W - 12), rint(8, H - 14), 0, { lootTable: Z.loot });
    for (let k = 0; k < 4; k++) add('barricada', rint(8, W - 14), rint(10, H - 16), 0);
    for (let k = 0; k < 5; k++) add('carro_pol', rint(6, W - 12), rint(8, H - 16), rint(0, 3), { cor: '#5a6a3a' });
  }
  // máquinas da pedreira (carros depenados = sucata) e tambores
  for (let k = 0; k < (Z.maquinas || 0); k++) add(R() < 0.6 ? 'sucata' : 'caminhao', rint(6, W - 12), rint(6, H - 14), rint(0, 3), { cor: '#d8a83a' });
  for (let k = 0; k < (Z.maquinas || 0); k++) add('tambor', rint(6, W - 8), rint(6, H - 10), 0, { lootTable: Z.loot });
  // natureza
  const N = W * H;
  const scatter = (type, dens) => {
    for (let k = 0; k < N * dens; k++) {
      const x = rint(1, W - 2), z = rint(1, H - 2);
      if (reserved(x, z)) continue;
      add(type, x, z);
    }
  };
  scatter('rocha', Z.rochas || 0);
  scatter('arbusto', Z.arbustos || 0);
  for (let k = 0; k < N * (Z.arvores || 0); k++) {
    const x = rint(1, W - 2), z = rint(1, H - 2);
    if (reserved(x, z)) continue;
    add(R() < 0.55 ? 'arvore' : R() < 0.5 ? 'ipe' : 'ipe_rosa', x, z);
  }
  // borda: mato fechado (árvores) — a saída fica ao sul
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const edge = x < 1 || z < 1 || x > W - 2 || z > H - 2;
    if (!edge || reserved(x, z) || map.floor[map.idx(x, z)] === F.agua) continue;
    add(R() < 0.7 ? 'arvore' : 'ipe', x, z);
  }
  add('placa', ex + 2, ez, 0, { nome: 'Trilha de volta para Aimorés', saida: true });
  for (const p of map.props) rollLoot(p, R);
  map.version++;
  return map;
}
