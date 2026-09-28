// Regiões do mapa (inspirado em Aimorés, MG, às margens do Rio Doce).
// O mundo tem 330 x 330 m, dividido em 9 áreas de 110 m.
// danger: 1 🟢 baixo · 2 🟡 médio · 3 🔴 alto
// unlock: condições para liberar a área (todas precisam ser cumpridas)
//   level: nível do personagem · quest: missão concluída · item: item que precisa ter

export const WORLD_HALF = 165;
export const CELL = 110;

export const REGIONS = [
  {
    id: 'mata', name: 'Mata do Córrego', col: 0, row: 0, danger: 1,
    desc: 'Mata fechada com córrego, árvores e pedras. Boa para madeira e frutas.',
    spawn: { max: 7, types: { comum: 8, rapido: 1 } },
  },
  {
    id: 'saude', name: 'Posto de Saúde', col: 1, row: 0, danger: 3,
    desc: 'Onde tudo começou. O portão está trancado com um cadeado eletrônico.',
    unlock: { level: 6, item: 'cartao_acesso' },
    spawn: { max: 14, types: { comum: 4, rapido: 3, agressivo: 3, forte: 1 } },
  },
  {
    id: 'fazenda', name: 'Fazenda Boa Vista', col: 2, row: 0, danger: 2,
    desc: 'Pasto, plantação e o celeiro. Dizem que ainda tem gente por lá.',
    unlock: { level: 5, quest: 'supermercado' },
    spawn: { max: 9, types: { comum: 6, rapido: 2, forte: 1 } },
  },
  {
    id: 'bairro', name: 'Bairro São José', col: 0, row: 1, danger: 1, start: true,
    desc: 'Casas simples, ruas de terra e o terreno onde Arthur montou a base.',
    spawn: { max: 6, types: { comum: 10, rapido: 1 } },
  },
  {
    id: 'centro', name: 'Centro de Aimorés', col: 1, row: 1, danger: 2,
    desc: 'Praça, igreja, escola, farmácia e supermercado. Muito loot, muitos mortos.',
    unlock: { quest: 'sobreviva' },
    spawn: { max: 12, types: { comum: 7, rapido: 2, agressivo: 1, forte: 1 } },
  },
  {
    id: 'avenida', name: 'Avenida do Posto', col: 2, row: 1, danger: 2,
    desc: 'Posto de gasolina, oficina e lojas da saída da cidade.',
    unlock: { level: 4, quest: 'escola' },
    spawn: { max: 11, types: { comum: 6, rapido: 3, forte: 1, agressivo: 1 } },
  },
  {
    id: 'rio', name: 'Margem do Rio Doce', col: 0, row: 2, danger: 1,
    desc: 'Prainha de areia, barcos largados e água à vontade (ferva antes de beber).',
    spawn: { max: 5, types: { comum: 10 } },
  },
  {
    id: 'ferrovia', name: 'Estação Ferroviária', col: 1, row: 2, danger: 2,
    desc: 'Trilhos da ferrovia ao lado do rio. Vagões cheios de carga.',
    unlock: { level: 3, quest: 'sobreviva' },
    spawn: { max: 10, types: { comum: 6, rapido: 2, agressivo: 2 } },
  },
  {
    id: 'pedreira', name: 'Pedreira Velha', col: 2, row: 2, danger: 3,
    desc: 'Minério de ferro e o covil de algo enorme. O portão tem corrente.',
    unlock: { level: 7, item: 'alicate' },
    spawn: { max: 12, types: { comum: 4, forte: 3, agressivo: 3, rapido: 2 } },
  },
];
export const DANGER = { 1: { icon: '🟢', name: 'Baixo risco', color: '#5cc26a' }, 2: { icon: '🟡', name: 'Risco médio', color: '#e8c23a' }, 3: { icon: '🔴', name: 'Alto risco', color: '#e0483a' } };

for (const r of REGIONS) {
  r.x0 = -WORLD_HALF + r.col * CELL; r.x1 = r.x0 + CELL;
  r.z0 = -WORLD_HALF + r.row * CELL; r.z1 = r.z0 + CELL;
  r.cx = (r.x0 + r.x1) / 2; r.cz = (r.z0 + r.z1) / 2;
}
export const regionById = id => REGIONS.find(r => r.id === id);
export function regionAt(x, z) {
  const c = Math.floor((x + WORLD_HALF) / CELL), rw = Math.floor((z + WORLD_HALF) / CELL);
  return REGIONS.find(r => r.col === c && r.row === rw) || null;
}

// terreno da base (onde se pode construir); ninguém nasce aqui
export const BASE = { x0: -156, x1: -118, z0: -30, z1: 8, grid: 2 };
export const inBase = (x, z, m = 0) => x > BASE.x0 - m && x < BASE.x1 + m && z > BASE.z0 - m && z < BASE.z1 + m;
export const START_POS = { x: -112, z: -6 };
