// Gera a Aimorés fictícia: ruas, praça, escola, supermercado, casas, lojas, posto,
// oficina, estação, galpão da AgroNova, rio Doce e a ponte para Baixo Guandu.
import { GameMap } from './map.js';
import { F, S, PROPS } from './tiles.js';
import { BP, stamp, orient } from './blueprint.js';
import { LOOT } from '../data/items.js';
import { mulberry32 } from '../util.js';

export const MAP_W = 124, MAP_H = 104;

// ------------------------------------------------------------ plantas das casas e lojas
const CASA_A = [
  '##=#####=##',
  '#RRq#KV#BN#',
  '#.Bq#bH#Bq#',
  '#.BN#b.#.q#',
  '#+###+###+#',
  '#.SSs.GIF.#',
  '=..MM.c...=',
  '#TT..Cc..X#',
  '#==#!##=###',
];
const CASA_B = [
  '##==###=#',
  '#RRq#KVH#',
  '#BB.#b..#',
  '###+##+##',
  '#SS.s..G#',
  '=..MM.cF=',
  '#TT...cA#',
  '##=#!#=##',
];
const LEG_CASA = { S: 'sofa', P: 'poltrona', T: 'tv', M: 'mesa', O: 'mesa_redonda', C: 'cadeira', B: 'cama', R: 'guarda_roupa', N: 'criado', J: 'escrivaninha', E: 'estante', G: 'geladeira', F: 'fogao', I: 'pia', A: 'armario', V: 'vaso', H: 'chuveiro', K: 'armarinho', Q: 'maquina', U: 'tanque', X: 'caixas', Y: 'bancada', Z: 'bau', L: 'lixeira', W: 'cofre' };

function loteA() {
  const rows = ['%%%%%%%%%%%%%%%', '%yyyyyyyyyyyyy%', '%yyyyyyyyyyyyy%'];
  for (const r of CASA_A) rows.push('%' + r + 'pp%');
  rows.push('%fffffffffffpp%', '%fffffffffffpp%', '%%%%%/%%%%%%//%');
  return rows;
}
function loteB() {
  const rows = ['%%%%%%%%%%%%%', '%yyyyyyyyyyy%', '%yyyyyyyyyyy%'];
  for (const r of CASA_B) rows.push('%' + r + 'pp%');
  rows.push('%fffffffffpp%', '%%%%%/%%%%//%');
  return rows;
}

const FARMACIA = [
  '##########',
  '#XXe#oJJR#',
  '#X..#o.1.#',
  '##+###+###',
  '#P......P#',
  '#P.CCC..P#',
  '#P......P#',
  '#l.......#',
  '#==!!====#',
];
const ROUPAS = [
  '##########',
  '#XXe#bKV.#',
  '#X..#b...#',
  '##+###+###',
  '#AA....AA#',
  '#l.......#',
  '#AA.CCC..#',
  '#.....AA.#',
  '#==!!====#',
];
const ELETRONICOS = [
  '##########',
  '#XXe#oJJ.#',
  '#X..#o..1#',
  '##+###$###',
  '#VV....VV#',
  '#l.......#',
  '#EE.CCC..#',
  '#l.....TT#',
  '#==!!====#',
];
const RESTAURANTE = [
  '##########',
  '#FFkAGI.X#',
  '#k.......#',
  '###+###+##',
  '#OC.OC.OC#',
  '#l.......#',
  '#OC..KKK.#',
  '#........#',
  '#==!!====#',
];
const MERCADINHO = [
  '###########',
  '#XXXe#q.RR#',
  '#X...#qB.N#',
  '#e...#.B..#',
  '###+###+###',
  '#P.P.P..FF#',
  '#P.P.P....#',
  '#P.P.P.CCC#',
  '#l......1.#',
  '#==!!=====#',
];
const FERRAMENTAS = [
  '###########',
  '#XXXe#oJJ.#',
  '#X...#o...#',
  '#X...#o.X.#',
  '###+###+###',
  '#P.P.P....#',
  '#P.P.P.YY.#',
  '#P.P.P....#',
  '#l.....CCC#',
  '#==!!=====#',
];
const CONVENIENCIA = [
  '##########',
  '#XXe#bKV.#',
  '#X..#b...#',
  '##+###+###',
  '#P..FF..P#',
  '#P......P#',
  '#P.CCC..P#',
  '#l.......#',
  '#==!!====#',
];
const BAR = [
  '##########',
  '#GGX.#bV.#',
  '#l...#b..#',
  '#KKK.###+#',
  '#........#',
  '#.O..O..O#',
  '#..O...O.#',
  '#!!=##==##',
];
const IGREJA = [
  '#############',
  '#oJJ#.AAA...#',
  '#o..#j....1.#',
  '#X..+.......#',
  '#####.......#',
  '=.BBB...BBB.=',
  '#.BBB...BBB.#',
  '=.BBB...BBB.=',
  '#.BBB...BBB.#',
  '#...........#',
  '#X.........X#',
  '#####!!!#####',
];
const ESTACAO = [
  '####=##!!##=####=####',
  '#t.........#oJJ.O.R.#',
  '#.BB...BB..#o.....1.#',
  '#..........+........#',
  '#.BB...BB..#######+##',
  '#..........#bV#qKK..#',
  '#..........+b.#q...N#',
  '#####!!!#####=#######',
];
const RADIO = [
  '###==####',
  '#oJJ#oYY#',
  '#o..+o..#',
  '#O..#o.1#',
  '##+###+##',
  '#t......#',
  '#t.SS...#',
  '#t....XX#',
  '###!!####',
];
const DEPOSITO_FERROVIA = [
  '###########',
  '#dXX..TT..#',
  '#d........#',
  '#..XX..TT.#',
  '#.........#',
  '#.Y....XX.#',
  '####!!#####',
];

function escola() {
  const E = new BP(25, 23, ' ');
  E.outline(0, 0, 24, 22, '%');
  // ala dos fundos: biblioteca, cozinha, banheiros e depósito
  E.fill(1, 1, 23, 21, '.');
  E.outline(1, 1, 23, 7, '#');
  for (const x of [7, 13, 16, 19]) E.vline(x, 1, 7, '#');
  E.set(3, 4, 'i').set(9, 4, 'k').set(14, 4, 'b').set(17, 4, 'b').set(21, 4, 'd');
  for (const x of [3, 5, 9, 11, 21]) E.set(x, 1, '=');
  E.set(4, 7, '+').set(10, 7, '+').set(14, 7, '+').set(18, 7, '+').set(21, 7, '$');
  // alas laterais: salas de aula
  E.outline(1, 7, 7, 17, '#'); E.hline(12, 1, 7, '#');
  E.outline(17, 7, 23, 17, '#'); E.hline(12, 17, 23, '#');
  E.set(4, 10, 'u').set(4, 15, 'u').set(20, 10, 'u').set(20, 15, 'u');
  E.set(7, 10, '+').set(7, 14, '+').set(17, 10, '+').set(17, 14, '+');
  for (const z of [9, 10, 14, 15]) { E.set(1, z, '='); E.set(23, z, '='); }
  // pátio com quadra
  E.fill(8, 8, 16, 16, '_');
  // ala da frente: secretaria, saguão e sala dos professores
  E.outline(1, 17, 23, 20, '#'); E.vline(8, 17, 20, '#'); E.vline(16, 17, 20, '#');
  E.set(4, 18, 'n').set(12, 18, 't').set(19, 18, 'h');
  E.set(11, 17, '&').set(12, 17, '&').set(13, 17, '&');
  E.set(8, 19, '+').set(16, 19, '+');
  E.set(11, 20, '!').set(12, 20, '!').set(13, 20, '!');
  for (const x of [3, 5, 19, 21]) E.set(x, 20, '=');
  E.fill(1, 21, 23, 21, 'f');
  E.set(11, 22, '/').set(12, 22, '/').set(13, 22, '/');
  // móveis
  E.text(2, 2, 'EE.EE').text(3, 4, 'iMM').text(2, 6, '1.C.C');           // biblioteca (1 = sobreviventes)
  E.text(8, 2, 'FF.AA').text(12, 3, 'G').text(9, 5, 'MM').text(8, 6, 'I');  // cozinha
  E.text(14, 2, 'VV').text(15, 6, 'K').text(17, 2, 'VV').text(18, 6, 'K'); // banheiros
  E.text(20, 2, 'XXX').text(20, 3, 'X.X').text(22, 6, 'X');                 // depósito
  for (const [x0, z0] of [[2, 8], [2, 13], [18, 8], [18, 13]]) {            // salas de aula
    E.text(x0, z0, 'LLLPP');
    E.text(x0, z0 + 2, 'Q.Q.Q');
    E.text(x0, z0 + 3, 'Q.Q.Q');
  }
  E.set(8, 11, 'Y').set(8, 12, 'Y').set(8, 13, 'Y');
  E.set(16, 11, 'Y').set(16, 12, 'Y').set(16, 13, 'Y');
  E.text(2, 18, 'O.JJ').text(6, 19, 'W');                                   // secretaria
  E.text(10, 19, 'BB..BB');                                                 // saguão
  E.text(18, 18, 'MM.RR').text(21, 19, 'SS');                               // professores
  E.set(3, 21, 'Z').set(21, 21, 'Z').set(7, 21, '*').set(17, 21, '*');
  return E.rows();
}
const LEG_ESCOLA = { E: 'estante', M: 'mesa', C: 'cadeira', F: 'forno', A: 'armario', G: 'geladeira', I: 'pia', V: 'vaso', K: 'armarinho', X: 'caixas', L: 'lousa', P: 'mesa_prof', Q: 'carteira', Y: 'trave', O: 'arquivo', J: 'escrivaninha', W: 'cofre', B: 'banco', R: 'armario_escola', S: 'sofa', Z: 'ipe', '*': 'arbusto' };

function supermercado() {
  const M = new BP(25, 23, ';');
  M.outline(0, 0, 24, 14, '#');
  M.fill(1, 1, 23, 13, '.');
  M.hline(5, 0, 24, '#'); M.vline(17, 0, 5, '#'); M.vline(21, 0, 5, '#');
  M.set(6, 3, 'e').set(19, 3, 'o').set(22, 3, 'b').set(12, 10, 'm');
  M.set(8, 5, '+').set(9, 5, '+').set(19, 5, '+').set(22, 5, '+');
  M.text(1, 1, 'LL.LL.LL..XX.XX').text(1, 2, 'LL.LL.LL..XX.XX');
  M.text(1, 4, 'X.X........XXX');
  M.text(18, 1, 'JJO').text(20, 2, 'W').text(22, 1, 'V').text(23, 2, 'K');
  M.text(1, 6, 'P').text(1, 7, 'P').text(1, 8, 'P');
  M.text(12, 6, 'FF.FF.FF.FF');
  for (const x of [4, 7, 10, 13, 16]) for (let z = 7; z <= 10; z++) M.set(x, z, 'G');
  for (const x of [20, 23]) for (let z = 7; z <= 9; z++) M.set(x, z, 'P');
  for (const x of [5, 9, 13, 17]) { M.set(x, 11, 'K'); M.set(x, 12, 'K'); }
  M.text(19, 12, 'CC').text(2, 12, 'C');
  M.set(11, 14, '!').set(12, 14, '!').set(13, 14, '!');
  for (const x of [2, 3, 5, 6, 8, 9, 15, 16, 18, 19, 21, 22]) M.set(x, 14, '=');
  // estacionamento
  M.fill(0, 15, 24, 22, ';');
  M.text(2, 17, 'ZZ..ZZ').text(2, 18, 'ZZ..ZZ').text(2, 19, 'ZZ..ZZ');
  M.text(18, 17, 'ZZ').text(18, 18, 'ZZ').text(18, 19, 'ZZ');
  M.set(11, 18, 'C').set(13, 20, 'C').set(24, 16, 'Q').set(0, 16, 'Q').set(12, 22, 'Q');
  M.set(1, 22, 'H').set(23, 22, 'H');
  return M.rows();
}
const LEG_MERCADO = { L: 'pallet', X: 'caixas', J: 'escrivaninha', O: 'arquivo', W: 'cofre', V: 'vaso', K: 'caixa_reg', P: 'prateleira', F: 'freezer', G: 'gondola', C: 'carrinho', Z: 'carro', Q: 'poste', H: 'lixeira' };

function oficina() {
  const O = new BP(14, 13, ' ');
  O.outline(0, 0, 13, 12, '#');
  O.fill(1, 1, 12, 11, '.');
  O.hline(4, 0, 13, '#'); O.vline(5, 0, 4, '#'); O.vline(8, 0, 4, '#');
  O.set(2, 2, 'o').set(6, 2, 'b').set(10, 2, 'd').set(6, 9, 'x');
  O.set(3, 4, '+').set(6, 4, '+').set(10, 4, '+');
  for (let x = 5; x <= 9; x++) O.set(x, 12, '/');
  O.set(2, 12, '!').set(0, 7, '=').set(13, 7, '=');
  O.text(1, 1, 'JJ.O').text(3, 3, '1');
  O.text(6, 1, 'V').text(7, 1, 'K');
  O.text(9, 1, 'XX.T').text(12, 3, 'N');
  O.text(1, 6, 'EE').text(1, 7, 'EE').text(1, 8, 'EE');
  O.text(6, 6, 'ZZ').text(6, 7, 'ZZ').text(6, 8, 'ZZ');
  O.text(11, 5, 'YY').text(12, 9, 'N').text(12, 10, 'N').text(1, 11, 'T').text(12, 7, 'X');
  return O.rows();
}
const LEG_OFICINA = { J: 'escrivaninha', O: 'arquivo', V: 'vaso', K: 'armarinho', X: 'caixas', T: 'tambor', N: 'pneus', E: 'elevador', Z: 'opala', Y: 'bancada' };

function posto() {
  const P = new BP(19, 14, 'p');
  CONVENIENCIA.forEach((r, z) => P.text(0, z, r));
  P.outline(11, 0, 18, 6, '#');
  P.fill(12, 1, 17, 5, '.');
  P.set(13, 3, 'o').set(15, 6, '!').set(18, 3, '=').set(11, 3, '=');
  P.text(12, 1, 'JJ.OXX').text(12, 5, 'SS').text(15, 3, '1').text(16, 4, '4');
  for (const [x, z] of [[5, 10], [9, 10], [13, 10], [5, 12], [9, 12], [13, 12]]) P.set(x, z, 'B');
  P.text(0, 12, 'TT').text(17, 9, 'NN').text(17, 10, 'N');
  P.set(7, 11, '2').set(11, 11, '3');
  P.set(10, 8, 'Q').set(18, 13, 'Q');
  return P.rows();
}
const LEG_POSTO = { P: 'prateleira', F: 'freezer', C: 'balcao', X: 'caixas', K: 'armarinho', V: 'vaso', B: 'bomba', J: 'escrivaninha', O: 'arquivo', T: 'tambor', N: 'pneus', S: 'sofa', Q: 'poste' };

function galpao() {
  const G = new BP(13, 20, ' ');
  G.outline(0, 0, 12, 19, '#');
  G.fill(1, 1, 11, 18, '.');
  G.vline(8, 0, 11, '#'); G.hline(6, 8, 12, '#'); G.hline(11, 0, 12, '#'); G.hline(14, 0, 12, '#');
  G.set(3, 3, 'z').set(10, 3, 'w').set(10, 8, 'o').set(2, 12, 'r').set(2, 16, 't');
  G.set(4, 11, '+').set(10, 11, '+').set(10, 6, '$').set(6, 14, '$');
  G.set(5, 19, '$').set(6, 19, '$').set(7, 19, '$');
  for (const z of [3, 8, 16]) { G.set(0, z, '='); G.set(12, z, '='); }
  G.text(2, 2, 'T.T.T').text(1, 6, 'YY.YY').text(1, 9, 'C.....C').text(1, 4, 'H').text(7, 4, 'H').text(4, 5, '1');
  G.text(9, 1, 'FF').text(11, 4, '2');
  G.text(9, 8, 'JJ').text(11, 7, 'O').text(11, 10, '3').text(9, 10, 'C');
  G.text(1, 13, 'XX........X');
  G.text(4, 16, 'KKK').text(1, 18, 'SS').text(11, 18, 'U').text(9, 16, '4');
  return G.rows();
}
const LEG_GALPAO = { T: 'tanque_lab', Y: 'bancada_lab', C: 'computador', H: 'gaiola', F: 'freezer', J: 'escrivaninha', O: 'arquivo', X: 'caixas', K: 'balcao', S: 'sofa', U: 'planta' };

// ------------------------------------------------------------ geração
export function generateMap(seed = 1) {
  const R = mulberry32(seed);
  const rint = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = arr => arr[Math.floor(R() * arr.length)];
  const map = new GameMap(MAP_W, MAP_H);
  map.floor.fill(F.grama);
  map.canopies = [];
  map.towers = [];
  map.wires = [];
  const W = MAP_W, H = MAP_H;
  const setF = (x, z, f) => { if (map.inb(x, z)) map.floor[map.idx(x, z)] = f; };
  const fillF = (x0, z0, x1, z1, f) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) setF(x, z, f); };
  const free = (x, z) => map.inb(x, z) && map.struct[map.idx(x, z)] === 0 && map.propAt[map.idx(x, z)] < 0;
  const freeRect = (x, z, w, d) => { for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) if (!free(x + dx, z + dz)) return false; return true; };
  const add = (type, x, z, rot = 0, extra) => {
    const [sw, sd] = PROPS[type].size;
    const w = rot % 2 ? sd : sw, d = rot % 2 ? sw : sd;
    if (!freeRect(x, z, w, d)) return null;
    return map.addProp(type, x, z, w, d, rot, extra);
  };
  const mark = (name, x, z) => { (map.marks[name] ||= []).push([x, z]); };
  const label = (text, x, z, kind = 'rua') => map.labels.push({ text, x, z, kind });

  // ---------------- ruas
  const HS = [
    { z0: 24, z1: 26, x0: 0, x1: W - 1, nome: 'Rua Sete de Setembro' },
    { z0: 52, z1: 55, x0: 0, x1: W - 1, nome: 'Avenida Rio Doce' },
    { z0: 72, z1: 74, x0: 0, x1: 104, nome: 'Rua da Estação' },
  ];
  const VS = [
    { x0: 16, x1: 18, z0: 0, z1: 75, nome: 'Rua das Palmeiras' },
    { x0: 46, x1: 48, z0: 0, z1: 75, nome: 'Rua do Comércio' },
    { x0: 78, x1: 80, z0: 0, z1: 75, nome: 'Rua Minas Gerais' },
    { x0: 102, x1: 104, z0: 0, z1: 89, nome: 'Rua da Ponte' },
  ];
  for (const s of HS) { fillF(s.x0, s.z0 - 1, s.x1, s.z0 - 1, F.calcada); fillF(s.x0, s.z1 + 1, Math.min(s.x1, 101), s.z1 + 1, F.calcada); }
  for (const s of VS) { fillF(s.x0 - 1, s.z0, s.x0 - 1, s.z1 - (s.x0 === 102 ? 2 : 0), F.calcada); fillF(s.x1 + 1, s.z0, s.x1 + 1, s.z1 - (s.x0 === 102 ? 2 : 0), F.calcada); }
  for (const s of HS) fillF(s.x0, s.z0, s.x1, s.z1, F.asfalto);
  for (const s of VS) fillF(s.x0, s.z0, s.x1, s.z1, F.asfalto);
  // faixas de pedestre e linhas no asfalto
  for (const h of HS) for (const v of VS) {
    if (v.x0 < h.x0 || v.x1 > h.x1 || h.z0 < v.z0 || h.z1 > v.z1) continue;
    for (let z = h.z0; z <= h.z1; z++) { setF(v.x0 - 1, z, F.faixa); setF(v.x1 + 1, z, F.faixa); }
    for (let x = v.x0; x <= v.x1; x++) { setF(x, h.z0 - 1, F.faixa); setF(x, h.z1 + 1, F.faixa); }
  }
  for (const h of HS) map.decals.push({ kind: 'linha', axis: 'x', x0: h.x0, x1: h.x1, z: (h.z0 + h.z1 + 1) / 2, skip: VS.map(v => [v.x0 - 1, v.x1 + 1]) });
  for (const v of VS) map.decals.push({ kind: 'linha', axis: 'z', z0: v.z0, z1: v.z1, x: (v.x0 + v.x1 + 1) / 2, skip: HS.map(h => [h.z0 - 1, h.z1 + 1]) });
  for (const h of HS) label(h.nome, (h.x0 + Math.min(h.x1, 100)) / 2 + 6, (h.z0 + h.z1 + 1) / 2);
  for (const v of VS) label(v.nome, (v.x0 + v.x1 + 1) / 2, v.x0 === 102 ? 64 : 38, 'rua-v');

  // ---------------- ferrovia, margem e rio Doce
  fillF(0, 84, W - 1, 87, F.brita);
  fillF(18, 84, 46, 84, F.calcada);
  map.decals.push({ kind: 'trilho', z: 85.5, x0: 0, x1: W - 1 });
  fillF(0, 88, W - 1, 89, F.grama);
  fillF(0, 90, W - 1, 91, F.areia);
  for (let z = 92; z < H; z++) for (let x = 0; x < W; x++) { setF(x, z, F.agua); map.struct[map.idx(x, z)] = S.WATER; }
  // rua da ponte cruza os trilhos e vira ponte
  fillF(101, 84, 105, 87, F.asfalto);
  fillF(102, 88, 104, 89, F.asfalto);
  for (let z = 90; z < H; z++) {
    for (let x = 102; x <= 104; x++) { setF(x, z, F.ponte); map.struct[map.idx(x, z)] = S.NONE; }
    for (const x of [101, 105]) { setF(x, z, F.ponte); map.struct[map.idx(x, z)] = S.GRADE; }
  }
  label('Rio Doce', 60, 97, 'rio');
  label('Ponte para Baixo Guandu (ES)', 103.5, 99, 'lugar');

  // ---------------- construções
  const B = (rows, x, z, opts) => stamp(map, rows, x, z, opts);
  const HOUSE_COLORS = [['#f2d78a', '#c8733a'], ['#f4b8b0', '#b8524a'], ['#a8d8e8', '#4a7aa8'], ['#bfe0a8', '#5a8a3a'], ['#f0e6d2', '#8a6a4a'], ['#e8c0e0', '#8a4a7a'], ['#f6c68a', '#b8622a'], ['#d8e0e8', '#5a6a8a']];
  const houseOpts = (name, type, i, extra = {}) => Object.assign({ name, type, legend: LEG_CASA, roof: 'telha', wall: HOUSE_COLORS[i % 8][0], trim: HOUSE_COLORS[i % 8][1], lootMap: { caixas: 'garagem' } }, extra);
  const lotDeco = (x0, z0, w, h) => {
    // quintal: churrasqueira, varal, rede, mangueira, caixas; garagem: carro
    const cells = [];
    for (let z = z0; z < z0 + h; z++) for (let x = x0; x < x0 + w; x++) { const r = map.roomAt(x, z); if (r && r.type === 'y' && free(x, z)) cells.push([x, z]); }
    const extras = ['churrasqueira', 'arvore', 'arbusto', 'caixas', 'varal', 'rede', 'tanque', 'arbusto', 'bicicleta'];
    for (let k = 0; k < 4 && cells.length; k++) {
      const [x, z] = cells.splice(Math.floor(R() * cells.length), 1)[0];
      add(pick(extras), x, z, pick([0, 1, 2, 3]));
    }
    const fcells = [];
    for (let z = z0; z < z0 + h; z++) for (let x = x0; x < x0 + w; x++) { const r = map.roomAt(x, z); if (r && r.type === 'f' && free(x, z)) fcells.push([x, z]); }
    for (let k = 0; k < 2 && fcells.length; k++) { const [x, z] = fcells.splice(Math.floor(R() * fcells.length), 1)[0]; add(pick(['arbusto', 'planta', 'arbusto']), x, z); }
  };
  const garageCar = (x, z, rot, chance = 0.55) => { if (R() < chance) add('carro', x, z, rot, { cor: carColor() }); };
  const carColor = () => pick(['#d8413a', '#3a6ad8', '#e8e4d8', '#2a2a30', '#8a8a92', '#e8c23a', '#3aa86a', '#8a3a2a', '#f08a3a']);

  // A0 — Casa da Turma (esconderijo inicial)
  const turma = B(loteA(), 0, 8, houseOpts('Casa da Turma', 'casa', 0, { info: { safehouse: true } }));
  turma.bld.safehouse = true;
  { const b = turma.bld; lotDeco(0, 8, 15, 15); }
  // baú do esconderijo e posição inicial
  add('bau', 9, 18, 0, { stash: true });
  mark('inicio', 3, 17); mark('inicio', 6, 17); mark('inicio', 7, 17); mark('inicio', 2, 17);
  mark('turma_portao', 5, 22);
  label('Casa da Turma', 7, 14, 'lugar');

  // A1 — Escola
  const esc = B(escola(), 20, 0, { name: 'Escola Estadual Rio Doce', type: 'escola', legend: LEG_ESCOLA, roof: 'laje', wall: '#f0e8d0', trim: '#2a6ab0',
    marks: { 1: 'escola_biblioteca' }, lootMap: { caixas: 'escola_deposito', armario: 'escola_cozinha', geladeira: 'escola_cozinha', forno: 'escola_cozinha', estante: 'escola_sala' },
    doorLocks: { '21,7': 'chave_deposito' }, muroFloor: 'calcada' });
  label('Escola Estadual Rio Doce', 32, 11, 'lugar');
  map.decals.push({ kind: 'quadra', x0: 28, z0: 8, x1: 37, z1: 17 });

  // A2 — Casa da Dona Cotinha e casa da Dra. Lívia
  B(loteB(), 50, 10, houseOpts('Casa da Dona Cotinha', 'casa', 5, { marks: {} }));
  lotDeco(50, 10, 13, 13);
  mark('cotinha', 55, 18);
  B(orient(loteB(), 'S', true), 64, 10, houseOpts('Casa da Dra. Lívia', 'casa', 2));
  lotDeco(64, 10, 13, 13);
  mark('casa_livia', 70, 16);
  // terreno baldio ao norte
  for (let k = 0; k < 16; k++) { const x = rint(50, 76), z = rint(0, 8); add(pick(['arvore', 'arbusto', 'arbusto', 'ipe', 'entulho']), x, z); }
  mark('terreno_baldio', 62, 4);

  // A3 — Casa infestada (onde o gato Bolinho está)
  B(orient(loteA(), 'S', true), 84, 8, houseOpts('Casa Infestada', 'casa', 7));
  lotDeco(84, 8, 15, 15);
  mark('casa_infestada', 90, 16);
  for (let k = 0; k < 10; k++) { const x = rint(82, 100), z = rint(0, 6); add(pick(['arvore', 'arbusto', 'ipe_rosa']), x, z); }

  // A4 — Campinho de terra
  fillF(107, 3, 122, 20, F.campo);
  add('trave', 107, 10, 0); add('trave', 122, 10, 0);
  for (const x of [108, 112, 116, 120]) add('banco', x, 1, 0);
  for (let k = 0; k < 6; k++) add(pick(['arvore', 'palmeira']), rint(106, 123), pick([0, 21, 22]));
  mark('campinho', 114, 12);
  map.decals.push({ kind: 'quadra', x0: 107, z0: 3, x1: 123, z1: 21, cor: '#f4f0e0' });
  label('Campinho do Rio Doce', 114.5, 12, 'lugar');

  // B0 — Bar do Tião e casa da família Oliveira
  B(orient(BAR, 'N'), 2, 28, { name: 'Bar do Tião', type: 'bar', legend: { G: 'geladeira', X: 'caixas', K: 'balcao', O: 'mesa_bar', V: 'vaso' }, roof: 'laje', wall: '#f2e04a', trim: '#2a8a4a', lootMap: { balcao: 'restaurante', caixas: 'restaurante', geladeira: 'restaurante' } });
  label('Bar do Tião', 7, 31, 'lugar');
  B(loteA(), 0, 36, houseOpts('Casa dos Oliveira', 'casa', 3));
  lotDeco(0, 36, 15, 15);
  mark('oliveira', 5, 44);

  // B1 — Supermercado
  B(supermercado(), 20, 28, { name: 'Supermercado Bom Preço', type: 'mercado', legend: LEG_MERCADO, roof: 'metal', wall: '#e8e8e2', trim: '#d8413a',
    lootMap: { caixas: 'mercado_estoque', pallet: 'mercado_estoque', arquivo: 'escritorio', escrivaninha: 'escritorio', cofre: 'escritorio' } });
  label('Supermercado Bom Preço', 32, 36, 'lugar');
  map.decals.push({ kind: 'vagas', x0: 20, z0: 44, x1: 45, z1: 48 });

  // B2 — Praça da Matriz e Igreja
  fillF(50, 28, 76, 50, F.pedra);
  const igr = B(IGREJA, 57, 28, { name: 'Igreja Matriz', type: 'igreja', legend: { J: 'escrivaninha', A: 'altar', B: 'banco_igreja', X: 'caixas' }, roof: 'telha', wall: '#f4f0e4', trim: '#d8a83a', marks: { 1: 'padre' }, lootMap: { caixas: 'igreja' } });
  map.towers.push({ kind: 'campanario', x: 63.5, z: 38.2, h: 7.5, building: igr.bld.id });
  add('sino', 62, 41);
  // canteiros e árvores
  for (const [x0, z0, x1, z1] of [[51, 29, 55, 33], [71, 29, 75, 33], [51, 44, 55, 49], [71, 44, 75, 49], [51, 36, 55, 40], [71, 36, 75, 40]]) {
    fillF(x0, z0, x1, z1, F.canteiro);
    add(pick(['ipe', 'arvore', 'palmeira']), x0 + 2, z0 + 2);
    add('arbusto', x0, z0); add('arbusto', x1, z1);
    if (R() < 0.6) add('ipe_rosa', x1 - 1, z0 + 1);
  }
  add('coreto', 62, 44);
  add('monumento', 58, 46);
  add('fonte', 67, 46);
  add('banca', 50, 41, 1);
  add('orelhao', 76, 42);
  add('pipoca', 60, 49);
  for (const [x, z, r] of [[57, 43, 0], [68, 43, 0], [57, 49, 2], [68, 49, 2], [53, 42, 1], [73, 42, 3]]) add('banco', x, z, r);
  for (const [x, z] of [[56, 41], [70, 41], [56, 50], [70, 50], [63, 50], [50, 35], [76, 35]]) add('poste', x, z);
  mark('praca', 63, 47); mark('praca', 56, 45); mark('praca', 70, 45);
  label('Praça da Matriz', 63.5, 48, 'lugar');
  label('Igreja Matriz', 63.5, 33, 'lugar');

  // B3 — Comércio: farmácia, roupas, eletrônicos, restaurante
  B(orient(FARMACIA, 'W'), 82, 28, { name: 'Farmácia Popular', type: 'farmacia', legend: { P: 'prateleira', C: 'balcao', X: 'caixas', J: 'escrivaninha', R: 'arquivo' }, roof: 'laje', wall: '#e8f4ea', trim: '#2aa84a', marks: { 1: 'graca' }, lootMap: { prateleira: 'farmacia', balcao: 'farmacia', caixas: 'farmacia' } });
  B(orient(ROUPAS, 'W'), 82, 40, { name: 'Loja Moda Rio Doce', type: 'roupas', legend: { A: 'arara', C: 'balcao', X: 'caixas', K: 'armarinho', V: 'vaso' }, roof: 'laje', wall: '#f4d8e8', trim: '#c83a7a', lootMap: { balcao: 'roupas', caixas: 'roupas' } });
  B(orient(ELETRONICOS, 'E'), 92, 28, { name: 'Eletrônica do Juninho', type: 'eletronicos', legend: { V: 'vitrine', C: 'balcao', X: 'caixas', J: 'escrivaninha', E: 'estante', T: 'tv' }, roof: 'laje', wall: '#d8e4f4', trim: '#3a5ab0', marks: { 1: 'juninho' }, lootMap: { balcao: 'eletronicos', caixas: 'eletronicos', estante: 'eletronicos', tv: 'eletronicos' } });
  B(orient(RESTAURANTE, 'E'), 92, 40, { name: 'Restaurante Sabor de Minas', type: 'restaurante', legend: { F: 'forno', A: 'armario', G: 'geladeira', I: 'pia', X: 'caixas', O: 'mesa_rest', C: 'cadeira', K: 'balcao' }, roof: 'telha', wall: '#f4e2c4', trim: '#a84a2a', lootMap: { armario: 'restaurante', geladeira: 'restaurante', caixas: 'restaurante', balcao: 'restaurante' } });
  label('Farmácia', 86, 33, 'lugar'); label('Loja de Roupas', 86, 45, 'lugar'); label('Eletrônicos', 96, 33, 'lugar'); label('Restaurante', 96, 45, 'lugar');
  add('lixeira', 91, 38); add('cacamba', 91, 50, 1); add('lixeira', 91, 39);

  // B4 — Rádio Aimorés FM
  for (let x = 106; x <= 123; x++) { map.struct[map.idx(x, 28)] = S.GRADE; map.struct[map.idx(x, 50)] = S.GRADE; }
  for (let z = 28; z <= 50; z++) { map.struct[map.idx(106, z)] = S.GRADE; map.struct[map.idx(123, z)] = S.GRADE; }
  fillF(107, 29, 122, 49, F.grama);
  for (const x of [113, 114]) { const i = map.idx(x, 28); map.struct[i] = S.GATE; map.doors.set(i, { x, z: 28, open: false, locked: false, hp: 30, maxHp: 30, barricade: 0, gate: true, axis: 'x', building: -1 }); }
  fillF(113, 29, 114, 30, F.cimento);
  B(RADIO, 109, 31, { name: 'Rádio Aimorés FM 87,9', type: 'radio', legend: { J: 'escrivaninha', Y: 'transmissor', O: 'arquivo', S: 'sofa', X: 'caixas' }, roof: 'laje', wall: '#f4f4f4', trim: '#d8413a', marks: { 1: 'radio_locutor' }, lootMap: { caixas: 'radio', arquivo: 'radio', escrivaninha: 'radio' } });
  add('antena', 119, 44);
  add('gerador', 111, 43);
  mark('radio_gerador', 111, 44);
  for (let k = 0; k < 6; k++) add(pick(['arbusto', 'arvore']), rint(107, 122), rint(41, 49));
  label('Rádio Aimorés FM', 113.5, 35, 'lugar');

  // C0 — Casa do prepper (recursos raros e armadilhas)
  B(orient(loteB(), 'N'), 1, 57, houseOpts('Casa do Seu Arlindo', 'casa', 4, { lootMap: { caixas: 'garagem', guarda_roupa: 'militar' } }));
  lotDeco(1, 57, 13, 13);
  mark('casa_prepper', 7, 63);

  // C1 — Loja de ferramentas e Mercadinho do Seu Zé
  B(orient(FERRAMENTAS, 'N'), 21, 57, { name: 'Casa das Ferramentas', type: 'ferramentas', legend: { P: 'prateleira', Y: 'bancada', C: 'balcao', X: 'caixas', J: 'escrivaninha' }, roof: 'laje', wall: '#f4e8b0', trim: '#e07a2a', lootMap: { prateleira: 'ferramentas_loja', caixas: 'ferramentas_loja', balcao: 'ferramentas_loja', bancada: 'ferramentas_loja' } });
  B(orient(MERCADINHO, 'N'), 33, 57, { name: 'Mercadinho do Seu Zé', type: 'mercadinho', legend: { P: 'prateleira', F: 'freezer', C: 'balcao', X: 'caixas', B: 'cama', R: 'guarda_roupa', N: 'criado' }, roof: 'telha', wall: '#c8e8c0', trim: '#3a8a3a', marks: { 1: 'ze' }, lootMap: { caixas: 'mercado_estoque' } });
  label('Ferramentas', 26, 62, 'lugar'); label('Mercadinho do Seu Zé', 38, 62, 'lugar');
  for (let x = 21; x <= 43; x += 3) if (R() < 0.5) add(pick(['lixeira', 'caixas', 'entulho']), x, rint(68, 70));

  // C2 — Oficina e casa do chefe da estação
  B(orient(oficina(), 'N'), 50, 57, { name: 'Oficina do Seu Valdir', type: 'oficina', legend: LEG_OFICINA, roof: 'metal', wall: '#d8d0c0', trim: '#2c5aa0', marks: { 1: 'valdir' }, lootMap: { caixas: 'oficina', bancada: 'oficina', tambor: 'oficina', arquivo: 'escritorio' } });
  label('Oficina Mecânica', 57, 63, 'lugar');
  B(orient(loteB(), 'N', true), 64, 57, houseOpts('Casa do Chefe da Estação', 'casa', 6));
  lotDeco(64, 57, 13, 13);
  mark('casa_chefe', 70, 63);

  // C3 — Posto de combustível (QG dos Lobos do Asfalto)
  B(orient(posto(), 'N'), 82, 57, { name: 'Posto Rio Doce', type: 'posto', legend: LEG_POSTO, roof: 'laje', wall: '#f4f4f0', trim: '#e8b020',
    marks: { 1: 'tonhao', 2: 'lobo', 3: 'lobo', 4: 'lobo' }, lootMap: { prateleira: 'conveniencia', caixas: 'conveniencia', balcao: 'conveniencia', freezer: 'mercado_freezer', tambor: 'oficina' } });
  map.canopies.push({ x0: 85, z0: 58, x1: 97, z1: 62, h: 3.4, color: '#f4f4f0', trim: '#e8b020' });
  label('Posto Rio Doce', 91, 60, 'lugar');

  // C4 — Galpão da AgroNova (cercado)
  for (let x = 106; x <= 123; x++) { map.struct[map.idx(x, 57)] = S.GRADE; map.struct[map.idx(x, 83)] = S.GRADE; }
  for (let z = 57; z <= 83; z++) { map.struct[map.idx(106, z)] = S.GRADE; map.struct[map.idx(123, z)] = S.GRADE; }
  fillF(107, 58, 122, 82, F.cimento);
  for (const x of [113, 114, 115]) { const i = map.idx(x, 57); map.struct[i] = S.GATE; map.doors.set(i, { x, z: 57, open: false, locked: true, key: 'corrente', hp: 60, maxHp: 60, barricade: 0, gate: true, axis: 'x', building: -1 }); }
  B(orient(galpao(), 'N'), 108, 61, { name: 'Galpão AgroNova Biotecnologia', type: 'agronova', legend: LEG_GALPAO, roof: 'metal', wall: '#e4ece4', trim: '#4caf50',
    marks: { 1: 'matriz', 2: 'soro', 3: 'hd', 4: 'agronova_recepcao' }, lootMap: { freezer: 'laboratorio', arquivo: 'laboratorio', caixas: 'laboratorio' } });
  for (const d of map.doors.values()) if (d.building === map.buildings.length - 1 && d.locked) d.key = 'cracha';
  for (let k = 0; k < 8; k++) add(pick(['tambor', 'caixas', 'pallet', 'tambor']), rint(107, 122), pick([58, 59, 81, 82]));
  add('caminhao', 118, 66, 0);
  label('AgroNova Biotecnologia', 114.5, 70, 'lugar');
  mark('agronova_portao', 114, 56);

  // D0 — Horta comunitária
  fillF(1, 77, 13, 82, F.canteiro);
  for (let x = 2; x <= 12; x += 3) for (let z = 78; z <= 81; z += 3) add(pick(['arvore', 'arbusto', 'palmeira']), x, z);
  mark('horta', 7, 80);
  label('Horta Comunitária', 7, 80, 'lugar');

  // D1 — Estação ferroviária e trem
  B(ESTACAO, 22, 76, { name: 'Estação Ferroviária de Aimorés', type: 'estacao', legend: { B: 'banco', J: 'escrivaninha', O: 'arquivo', R: 'cofre', K: 'cama', N: 'criado', V: 'vaso' }, roof: 'telha', wall: '#f0d8a8', trim: '#8a3a2a', marks: { 1: 'livia' }, lootMap: { arquivo: 'estacao', escrivaninha: 'estacao', criado: 'estacao' } });
  add('locomotiva', 24, 85, 1);
  add('vagao', 31, 85, 1);
  add('vagao', 38, 85, 1);
  for (const x of [20, 30, 40]) add('banco', x, 84, 2);
  add('placa', 45, 84);
  label('Estação Ferroviária', 32, 80, 'lugar');
  mark('locomotiva', 27, 84);

  // D2 — Ferro-velho
  for (let x = 50; x <= 76; x++) { map.struct[map.idx(x, 76)] = S.FENCE; map.struct[map.idx(x, 83)] = S.FENCE; }
  for (let z = 76; z <= 83; z++) { map.struct[map.idx(50, z)] = S.FENCE; map.struct[map.idx(76, z)] = S.FENCE; }
  fillF(51, 77, 75, 82, F.terra);
  for (const x of [62, 63]) { const i = map.idx(x, 76); map.struct[i] = S.GATE; map.doors.set(i, { x, z: 76, open: true, locked: false, hp: 25, maxHp: 25, barricade: 0, gate: true, axis: 'x', building: -1 }); }
  for (const x of [52, 55, 58, 66, 69, 72]) add('sucata', x, 78, 0, { cor: carColor() });
  for (let k = 0; k < 10; k++) add(pick(['pneus', 'tambor', 'entulho', 'pneus']), rint(51, 75), pick([77, 81, 82]));
  label('Ferro-velho do Bigode', 63, 80, 'lugar');

  // D3 — Depósito da ferrovia
  B(orient(DEPOSITO_FERROVIA, 'N'), 86, 77, { name: 'Depósito da Ferrovia', type: 'deposito', legend: { X: 'caixas', T: 'tambor', Y: 'bancada' }, roof: 'metal', wall: '#c8b8a0', trim: '#6a4a2a', lootMap: { tambor: 'ferrovia', caixas: 'garagem', bancada: 'garagem' } });

  // margem do rio: prainha, quiosque, canoa, árvores
  add('quiosque', 64, 89);
  add('canoa', 70, 90, 1);
  for (const x of [58, 61, 67, 73]) add('mesa_bar', x, 90);
  for (let x = 2; x < W - 2; x += rint(4, 7)) if (x < 98 || x > 108) add(pick(['arvore', 'palmeira', 'ipe', 'arbusto']), x, 88);
  label('Prainha do Rio Doce', 66, 90, 'lugar');

  // bloqueio do exército na ponte
  add('barricada', 102, 96, 0);
  add('sacos', 102, 95); add('sacos', 104, 95);
  add('caminhao', 102, 98, 0);
  add('cavalete', 104, 99);
  mark('sargento', 103, 94);
  mark('ponte', 103, 92);
  label('Bloqueio do Exército', 103.5, 95, 'lugar');

  // ---------------- mato nas bordas
  for (let k = 0; k < 60; k++) {
    const x = rint(0, 14), z = rint(0, 7);
    if (R() < 0.5) add(pick(['arvore', 'arbusto', 'palmeira']), x, z);
  }
  for (let z = 0; z < 84; z += 2) { if (free(0, z)) add(pick(['arvore', 'arbusto']), 0, z); }

  // ---------------- postes, fios, árvores e carros nas ruas
  const poles = [];
  const sidewalkProps = (x, z, horizontal, idx) => {
    if (!free(x, z) || map.floor[map.idx(x, z)] !== F.calcada) return;
    if (idx % 2 === 0) { const p = add('poste', x, z); if (p) poles.push(p); }
    else if (R() < 0.55) add(pick(['arvore', 'ipe', 'palmeira', 'lixeira', 'arvore']), x, z);
  };
  for (const h of HS) {
    let i = 0;
    for (let x = h.x0 + 3; x < h.x1; x += 6, i++) { sidewalkProps(x, h.z0 - 1, true, i); sidewalkProps(x + 3, h.z1 + 1, true, i + 1); }
  }
  for (const v of VS) {
    let i = 0;
    for (let z = v.z0 + 3; z < v.z1; z += 6, i++) { sidewalkProps(v.x0 - 1, z, false, i); sidewalkProps(v.x1 + 1, z + 3, false, i + 1); }
  }
  // fios entre postes vizinhos
  for (const a of poles) {
    let best = null, bd = 99;
    for (const b of poles) {
      if (b === a || b.id < a.id) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < bd && d < 13 && (a.x === b.x || a.z === b.z)) { bd = d; best = b; }
    }
    if (best) map.wires.push([a.x + 0.5, a.z + 0.5, best.x + 0.5, best.z + 0.5]);
  }
  // luzes: alguns postes ainda funcionam
  for (const p of map.props) if (p.type === 'poste') { p.lampOn = R() < 0.45; if (p.lampOn) map.lights.push({ x: p.x + 0.5, z: p.z + 0.5, kind: 'poste', r: 6, i: 1, color: '#ffd89a', flicker: R() < 0.3 }); }
  map.lights.push({ x: 103.5, z: 97, kind: 'holofote', r: 9, i: 1.2, color: '#e8f0ff' });
  map.lights.push({ x: 63.5, z: 32, kind: 'vela', r: 5, i: 0.7, color: '#ffb060' });
  map.lights.push({ x: 111, z: 68, kind: 'lab', r: 5, i: 0.8, color: '#7aff7a' });
  map.lights.push({ x: 119.5, z: 44.5, kind: 'antena', r: 3, i: 0.6, color: '#ff4040' });

  // carros abandonados, ônibus e moto
  const streetCar = () => {
    for (let tries = 0; tries < 40; tries++) {
      if (R() < 0.5) {
        const h = pick(HS); const x = rint(h.x0 + 2, Math.min(h.x1, 100) - 4); const z = R() < 0.5 ? h.z0 : h.z1 - 1;
        if (add('carro', x, z, pick([1, 3]), { cor: carColor(), batido: R() < 0.3 })) return;
      } else {
        const v = pick(VS); const z = rint(v.z0 + 2, v.z1 - 4); const x = R() < 0.5 ? v.x0 : v.x1 - 1;
        if (add('carro', x, z, pick([0, 2]), { cor: carColor(), batido: R() < 0.3 })) return;
      }
    }
  };
  for (let k = 0; k < 22; k++) streetCar();
  add('onibus', 58, 52, 1);
  add('carro_pol', 70, 53, 3, { cor: '#f4f4f4' });
  add('moto', 30, 25); add('moto', 79, 44); add('moto', 47, 66);
  add('ponto_onibus', 53, 51, 0);
  add('cacamba', 44, 69, 0);
  for (let k = 0; k < 18; k++) { const h = pick(HS); const x = rint(0, 100); const z = pick([h.z0 - 1, h.z1 + 1]); if (map.floor[map.idx(x, z)] === F.calcada && R() < 0.8) add(pick(['lixeira', 'entulho', 'caixas']), x, z); }

  // pontos de interesse para zumbis e eventos
  mark('rua', 32, 25); mark('rua', 62, 25); mark('rua', 90, 25); mark('rua', 17, 40); mark('rua', 47, 40); mark('rua', 79, 40);
  mark('rua', 30, 53); mark('rua', 62, 53); mark('rua', 95, 53); mark('rua', 17, 65); mark('rua', 47, 65); mark('rua', 79, 65); mark('rua', 60, 73); mark('rua', 103, 70);

  // ---------------- loot inicial
  for (const p of map.props) rollLoot(p, R);
  map.version++;
  return map;
}

export function rollLoot(p, R) {
  const def = PROPS[p.type];
  p.loot = [];
  if (!p.lootTable || !LOOT[p.lootTable]) return;
  const chance = def.lootChance ?? 0.5;
  if (R() > chance) return;
  const table = LOOT[p.lootTable].filter(e => e[1] > 0);
  const n = 1 + (R() < 0.45 ? 1 : 0) + (R() < 0.15 ? 1 : 0);
  let tot = 0; for (const e of table) tot += e[1];
  for (let k = 0; k < n; k++) {
    let r = R() * tot;
    for (const [id, w, [a, b]] of table) {
      r -= w;
      if (r <= 0) {
        const q = a + Math.floor(R() * (b - a + 1));
        const ex = p.loot.find(e => e.id === id);
        if (ex) ex.n += q; else p.loot.push({ id, n: q });
        break;
      }
    }
  }
}
