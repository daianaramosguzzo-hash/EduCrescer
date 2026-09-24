// Aparência de cada personagem desenhado pelo pintor (painter.js).
// Os quatro protagonistas seguem as ilustrações de referência em assets/arte/.
import { BODIES } from './painter.js';

const b = (name, over = {}) => Object.assign({}, BODIES[name], over);

export const LOOKS = {
  // ------------------------------------------------------------ protagonistas
  // Arthur: cabelo castanho-escuro bagunçado, jaqueta marrom com forro bege e capuz,
  // camiseta cinza "CRESCER", bermuda preta longa, meias brancas listradas, tênis branco.
  arthur: {
    id: 'arthur', body: b('kid'), skin: '#f3c6a0',
    hair: { style: 'messy', color: '#3b2419', volume: 1.12, bangLow: 0.5, spikes: 14 },
    face: { mouth: 'smile', eyeSize: 0.42, eyeSep: 0.46 },
    top: { kind: 'tee', color: '#9d9d9f', print: 'crescer', neck: 'v' },
    jacket: { color: '#a96a30', lining: '#dcc08c', hood: true },
    bottom: { kind: 'shorts', color: '#1f1f24', len: 1.12 },
    socks: { color: '#fbfbfb', stripes: '#2f4f9a', h: 0.42 },
    shoes: { kind: 'sneaker', color: '#f2f2f2', sole: '#ffffff', accent: '#9aa6bb' },
  },
  // Carol: cabelo castanho liso na altura do queixo, repartido ao meio, camiseta branca
  // "YESHUA" colorida, short vermelho e chinelo vermelho.
  carol: {
    id: 'carol', body: b('stocky'), skin: '#f2c4a2',
    hair: { style: 'bob', color: '#7c4b2f', part: 0, len: 1.45 },
    face: { mouth: 'smile', eyeSize: 0.37 },
    top: { kind: 'tee', color: '#fbfbf7', print: 'yeshua', collar: '#d9d9d2' },
    bottom: { kind: 'shorts', color: '#dd5147', len: 0.5 },
    shoes: { kind: 'flipflop', color: '#c93b33' },
  },
  // Daiana: cabelo longo, escuro e ondulado, pele morena, argolas douradas, cílios,
  // sorriso aberto, camiseta azul "EDUCAÇÃO", calça jeans e tênis vermelho.
  daiana: {
    id: 'daiana', body: b('woman'), skin: '#d49b72',
    hair: { style: 'wavy', color: '#2a1912', part: 0.28, len: 3.6 },
    face: { mouth: 'grin', eyeSize: 0.35, eyeTall: 1.15, lashes: true },
    earrings: '#e2b43a',
    top: { kind: 'tee', color: '#2459c4', print: 'educacao', collar: '#1a3f8f' },
    bottom: { kind: 'jeans', color: '#4b6fa8' },
    shoes: { kind: 'sneaker', color: '#d23b30', sole: '#f4f4f4', toe: '#f7f7f7' },
  },
  // Pablício: cabelo preto bagunçado, bigode grosso, barba por fazer, olheiras, suor,
  // camiseta verde-escura, barriga, calça jeans e sapato marrom.
  pablicio: {
    id: 'pablicio', body: b('big'), skin: '#efbd9c',
    hair: { style: 'messy', color: '#211815', volume: 0.92, bangLow: 0.62, spikes: 9, spikeLen: 0.8, strays: 6 },
    face: { mouth: 'flat', eyeSize: 0.4, bags: true, sweat: true, pupilR: 0.055 },
    mustache: '#1f1512', stubble: true, jowls: true,
    top: { kind: 'tee', color: '#2f4a2c', collar: '#243a22' },
    bottom: { kind: 'jeans', color: '#4f6fa0' },
    shoes: { kind: 'shoe', color: '#6e4a33', sole: '#3e2a1e' },
  },

  // ------------------------------------------------------------ zumbis
  z_comum_a: { // funcionário de escritório
    id: 'z_comum_a', gait: 'zombie', body: b('man'), skin: '#9db38a',
    hair: { style: 'short', color: '#4a3a2a' }, wounds: 3, stains: 5,
    top: { kind: 'shirt', color: '#dfe6ee', sleeves: 'long' }, vest: null,
    bottom: { kind: 'pants', color: '#3d4150' }, shoes: { kind: 'shoe', color: '#2a2320', sole: '#111' },
  },
  z_comum_b: { // senhora de vestido florido
    id: 'z_comum_b', gait: 'zombie', body: b('old'), skin: '#a7b893',
    hair: { style: 'curly', color: '#b9b2a6', len: 0.6 }, wounds: 2, stains: 4,
    top: { kind: 'tee', color: '#6fa0c8', print: 'flores' },
    bottom: { kind: 'dress', color: '#6fa0c8', pattern: 'flores' }, shoes: { kind: 'flipflop', color: '#3a6fb0' },
  },
  z_comum_c: { // tiozão de regata e bermuda
    id: 'z_comum_c', gait: 'zombie', body: b('big', { belly: 6 }), skin: '#a2b58b',
    hair: { style: 'horseshoe', color: '#5a5048' }, mustache: '#4a4038', wounds: 3, stains: 4,
    top: { kind: 'tank', color: '#f0efe6', sleeves: 'none' },
    bottom: { kind: 'shorts', color: '#3564a8', len: 0.8 }, shoes: { kind: 'flipflop', color: '#2e7d4f' },
  },
  z_comum_d: { // gari de uniforme laranja
    id: 'z_comum_d', gait: 'zombie', body: b('man'), skin: '#98ae88',
    hair: { style: 'buzz', color: '#2a211c' }, wounds: 2, stains: 3,
    top: { kind: 'tee', color: '#f07a24', print: 'gari', sleeves: 'short' },
    bottom: { kind: 'pants', color: '#f07a24' }, shoes: { kind: 'boot', color: '#2b2b2b' },
  },
  z_comum_e: { // moça de uniforme de escola
    id: 'z_comum_e', gait: 'zombie', body: b('woman'), skin: '#a6b890',
    hair: { style: 'ponytail', color: '#3a2618', part: 0 }, wounds: 2, stains: 4,
    top: { kind: 'tee', color: '#f4f4f4', print: 'escola' },
    bottom: { kind: 'jeans', color: '#3c5f98' }, shoes: { kind: 'sneaker', color: '#2a2a2a', sole: '#eee' },
  },
  z_corredor: { // maratonista
    id: 'z_corredor', gait: 'runner', body: b('thin'), skin: '#b3bf97',
    hair: { style: 'short', color: '#6a4a2a' }, hat: { kind: 'cap', color: '#e8e03a' }, wounds: 2, stains: 3,
    top: { kind: 'tank', color: '#f6d33a', print: 'numero', sleeves: 'none' },
    bottom: { kind: 'shorts', color: '#1f5fb0', len: 0.35 }, socks: { color: '#fff', h: 0.2 },
    shoes: { kind: 'sneaker', color: '#e8473a', sole: '#fff' }, face: { eyes: 'zombie', pupilColor: '#ff3a2a' },
  },
  z_resistente: { // bombado da academia
    id: 'z_resistente', gait: 'tank', body: b('huge'), skin: '#8ea878', scale: 1.12,
    hair: { style: 'buzz', color: '#1e1914' }, wounds: 4, stains: 6, beard: '#2a221c',
    top: { kind: 'tank', color: '#3a3a44', sleeves: 'none' },
    bottom: { kind: 'shorts', color: '#b0302a', len: 0.9 }, shoes: { kind: 'sneaker', color: '#fff', sole: '#ddd' },
  },
  z_furtivo: { // espreitador de moletom
    id: 'z_furtivo', gait: 'crawler', body: b('thin'), skin: '#c9cfc0',
    hair: { style: 'hood', color: '#34343c' }, wounds: 2, stains: 3,
    top: { kind: 'hoodie', color: '#34343c', sleeves: 'long' },
    bottom: { kind: 'pants', color: '#26262c' }, shoes: { kind: 'barefoot' },
    face: { eyes: 'zombie', sclera: '#fff8a0', pupil: 'none' },
  },
  z_pamonheiro: { // vendedor de pamonha com megafone
    id: 'z_pamonheiro', gait: 'zombie', body: b('old'), skin: '#a9b690', weapon: 'megaphone',
    hair: { style: 'short', color: '#8a8278' }, hat: { kind: 'straw', color: '#e7c86a', band: '#c23a2a' }, mustache: '#8a8278', wounds: 2, stains: 3,
    top: { kind: 'shirt', color: '#f5f0dc', sleeves: 'short' }, apron: '#6bb04a',
    bottom: { kind: 'pants', color: '#7a6048' }, shoes: { kind: 'flipflop', color: '#7a4a2a' },
  },
  z_inchado: { // inchado de gás tóxico
    id: 'z_inchado', gait: 'bloat', body: b('bloat'), skin: '#b7c46a',
    hair: { style: 'horseshoe', color: '#4a4a30' }, wounds: 6, stains: 2,
    top: { kind: 'tee', color: '#c9c28a', sleeves: 'short' },
    bottom: { kind: 'shorts', color: '#5a5a3a', len: 0.8 }, shoes: { kind: 'barefoot' },
    face: { eyes: 'zombie', sclera: '#e9f06a' },
  },
  z_matriz: { // chefe: o cientista virou planta
    id: 'z_matriz', gait: 'tank', body: b('boss'), skin: '#7fa05a', scale: 1.25,
    hair: { style: 'sprout', color: '#3f7a2a' }, wounds: 5, stains: 5,
    top: { kind: 'shirt', color: '#8fbf6a', sleeves: 'long' }, coat: '#e9eee4', coatSleeves: true,
    bottom: { kind: 'pants', color: '#3a4a2a' }, shoes: { kind: 'shoe', color: '#2a2a20' },
    face: { eyes: 'zombie', sclera: '#d8ff6a', pupilColor: '#2a6a1a', glasses: '#c9c9c9' },
  },

  // ------------------------------------------------------------ NPCs
  npc_ze: { // Seu Zé do Mercadinho
    id: 'npc_ze', body: b('old'), skin: '#e2b08c',
    hair: { style: 'horseshoe', color: '#d8d4cc' }, mustache: '#d8d4cc',
    face: { mouth: 'smile', eyeSize: 0.27 },
    top: { kind: 'shirt', color: '#e9d27a', sleeves: 'short' }, apron: '#3f6ea8',
    bottom: { kind: 'pants', color: '#6a5a48' }, shoes: { kind: 'flipflop', color: '#3b3b3b' },
  },
  npc_graca: { // Dona Graça, farmacêutica
    id: 'npc_graca', body: b('old'), skin: '#c98e68',
    hair: { style: 'bun', color: '#9a948c', part: 0 },
    face: { mouth: 'smile', glasses: '#6a3a2a', eyeSize: 0.26 },
    top: { kind: 'shirt', color: '#8fc4d8' }, coat: '#fbfbfb', coatSleeves: true,
    bottom: { kind: 'pants', color: '#556070' }, shoes: { kind: 'shoe', color: '#f4f4f4', sole: '#ccc' },
  },
  npc_cotinha: { // Dona Cotinha, a senhora da espingarda
    id: 'npc_cotinha', body: b('old', { torsoLen: 27 }), skin: '#f0c7a8', weapon: 'shotgun',
    hair: { style: 'curly', color: '#e8e4ea', len: 0.5 },
    face: { mouth: 'flat', glasses: '#8a2a5a', brows: 'angry', eyeSize: 0.27 },
    top: { kind: 'tee', color: '#c57fb4', print: 'flores' }, bottom: { kind: 'dress', color: '#c57fb4', pattern: 'flores' },
    shoes: { kind: 'shoe', color: '#6a3a4a' },
  },
  npc_tonhao: { // Tonhão, líder dos Lobos do Asfalto
    id: 'npc_tonhao', body: b('huge', { tw: [16, 15, 13, 12.5] }), skin: '#b88462', weapon: 'shotgun',
    hair: { style: 'bald' }, beard: '#2a1d16', hat: { kind: 'bandana', color: '#b8262a' },
    face: { mouth: 'flat', brows: 'angry', eyeSize: 0.25 },
    top: { kind: 'tank', color: '#2a2a2e', sleeves: 'none' }, vest: '#5a3a24',
    bottom: { kind: 'jeans', color: '#2f3a52' }, shoes: { kind: 'boot', color: '#3a2a20' },
  },
  npc_lobo_a: {
    id: 'npc_lobo_a', body: b('man'), skin: '#e0ae8a', weapon: 'pistol',
    hair: { style: 'short', color: '#1e1814' }, hat: { kind: 'bandana', color: '#b8262a' },
    face: { mouth: 'flat', brows: 'angry' }, stubble: true,
    top: { kind: 'tee', color: '#40404a' }, vest: '#5a3a24',
    bottom: { kind: 'jeans', color: '#2f3a52' }, shoes: { kind: 'boot', color: '#2a2a2a' },
  },
  npc_lobo_b: {
    id: 'npc_lobo_b', body: b('thin'), skin: '#9a6a4c', weapon: 'bat',
    hair: { style: 'buzz', color: '#16110e' }, hat: { kind: 'cap', color: '#b8262a', brim: '#1e1e1e' },
    face: { mouth: 'grin', brows: 'angry' },
    top: { kind: 'tee', color: '#c23030' }, bottom: { kind: 'jeans', color: '#262a36' }, shoes: { kind: 'sneaker', color: '#1e1e1e', sole: '#ddd' },
  },
  npc_juninho: { // adolescente gamer da loja de eletrônicos
    id: 'npc_juninho', body: b('kid', { torsoLen: 28, thigh: 17, shin: 16 }), skin: '#8d5a3c',
    hair: { style: 'curly', color: '#1c130e', len: 0.3 }, hat: { kind: 'headset', color: '#3fd07a' },
    face: { mouth: 'grin' },
    top: { kind: 'hoodie', color: '#6a3fb0', sleeves: 'long' }, bottom: { kind: 'jeans', color: '#2a3550' },
    shoes: { kind: 'sneaker', color: '#3fd07a', sole: '#fff' },
  },
  npc_padre: { // Padre Anselmo
    id: 'npc_padre', body: b('old'), skin: '#e8b898',
    hair: { style: 'short', color: '#cfcac2' }, face: { mouth: 'smile', glasses: '#333', eyeSize: 0.26 },
    top: { kind: 'shirt', color: '#222228', sleeves: 'long', print: 'cruz' },
    bottom: { kind: 'pants', color: '#222228' }, shoes: { kind: 'shoe', color: '#111' },
  },
  npc_sargento: { // Sargento Rocha, do bloqueio da ponte
    id: 'npc_sargento', body: b('man'), skin: '#6e4630', weapon: 'rifle',
    hair: { style: 'buzz', color: '#111' }, hat: { kind: 'helmet', color: '#56603a' },
    face: { mouth: 'flat', brows: 'angry' },
    top: { kind: 'shirt', color: '#5f6b40', sleeves: 'long', print: 'camo' },
    bottom: { kind: 'pants', color: '#56603a' }, shoes: { kind: 'boot', color: '#1e1e1a' },
  },
  npc_valdir: { // Seu Valdir, mecânico
    id: 'npc_valdir', body: b('man', { belly: 2 }), skin: '#c4906c',
    hair: { style: 'short', color: '#3a3a3a' }, mustache: '#3a3a3a', hat: { kind: 'cap', color: '#2c5aa0', brim: '#1f3f73' },
    face: { mouth: 'smile' }, glove: '#3a3a3a',
    top: { kind: 'shirt', color: '#2c5aa0', sleeves: 'short' }, bottom: { kind: 'pants', color: '#2c5aa0' },
    shoes: { kind: 'boot', color: '#2a2020' }, stains: 0,
  },
  npc_tecnica: { // Dra. Lívia, técnica do laboratório
    id: 'npc_tecnica', body: b('woman'), skin: '#f1cdb3',
    hair: { style: 'ponytail', color: '#b5652a', part: 0.2 }, face: { mouth: 'flat', glasses: '#333' },
    top: { kind: 'tee', color: '#4caf50', print: 'agronova' }, coat: '#f7f7f7', coatSleeves: true,
    bottom: { kind: 'pants', color: '#3a3a44' }, shoes: { kind: 'sneaker', color: '#eee', sole: '#fff' },
  },
  npc_wellington: { // o "Tom Cruz" de Aimorés, lábia de sobra
    id: 'npc_wellington', body: b('man'), skin: '#e7b894',
    hair: { style: 'short', color: '#c79a3a' }, face: { mouth: 'grin' },
    top: { kind: 'shirt', color: '#f2f2f2', sleeves: 'long' }, jacket: { color: '#c83a64', open: true, lining: '#e87aa0' },
    bottom: { kind: 'pants', color: '#e8e2d2' }, shoes: { kind: 'shoe', color: '#f4f4f4', sole: '#ccc' },
  },
  npc_sobrevivente_a: {
    id: 'npc_sobrevivente_a', body: b('man'), skin: '#7a4e36',
    hair: { style: 'buzz', color: '#15100c' }, face: { mouth: 'flat' },
    top: { kind: 'tee', color: '#e2a93a' }, bottom: { kind: 'jeans', color: '#3c5a8a' }, shoes: { kind: 'sneaker', color: '#fff', sole: '#ddd' },
  },
  npc_sobrevivente_b: {
    id: 'npc_sobrevivente_b', body: b('woman'), skin: '#edc4a4',
    hair: { style: 'ponytail', color: '#e2c060', part: 0 }, face: { mouth: 'flat', lashes: true },
    top: { kind: 'tee', color: '#e2658a' }, bottom: { kind: 'shorts', color: '#39597f', len: 0.6 }, shoes: { kind: 'sneaker', color: '#fff', sole: '#ddd' },
  },
  npc_sobrevivente_c: {
    id: 'npc_sobrevivente_c', body: b('stocky'), skin: '#b07650',
    hair: { style: 'curly', color: '#1c120c', len: 0.8 }, face: { mouth: 'smile', lashes: true },
    top: { kind: 'tee', color: '#5ab0a0', print: 'listras', stripe: '#e8f6f2' }, bottom: { kind: 'jeans', color: '#44507a' }, shoes: { kind: 'flipflop', color: '#e2b43a' },
  },
  npc_estudante: {
    id: 'npc_estudante', body: b('kid', { torsoLen: 28, thigh: 17, shin: 16 }), skin: '#e9bc98',
    hair: { style: 'short', color: '#5a3a22' }, face: { mouth: 'flat' },
    top: { kind: 'tee', color: '#f4f4f4', print: 'escola' }, bottom: { kind: 'jeans', color: '#3c5f98' }, shoes: { kind: 'sneaker', color: '#222', sole: '#eee' },
  },
  npc_estudante_b: {
    id: 'npc_estudante_b', body: b('kid', { torsoLen: 28, thigh: 17, shin: 16 }), skin: '#8a5a3e',
    hair: { style: 'long', color: '#1a120c', part: 0.1, len: 2.2 }, face: { mouth: 'smile', lashes: true },
    top: { kind: 'tee', color: '#f4f4f4', print: 'escola' }, bottom: { kind: 'jeans', color: '#3c5f98' }, shoes: { kind: 'sneaker', color: '#e8e8e8', sole: '#fff' },
  },
  npc_professor: { // Professor Tavares
    id: 'npc_professor', body: b('thin'), skin: '#dcae8a',
    hair: { style: 'short', color: '#6a6a6a' }, beard: '#6a6a6a', face: { mouth: 'flat', glasses: '#222' },
    top: { kind: 'shirt', color: '#a8c6e0', sleeves: 'long' }, bottom: { kind: 'pants', color: '#5a4a3a' }, shoes: { kind: 'shoe', color: '#3a2a1e' },
  },
};

// Conjunto de looks por tipo de zumbi (variações de roupa para o zumbi comum)
export const ZOMBIE_LOOKS = {
  comum: ['z_comum_a', 'z_comum_b', 'z_comum_c', 'z_comum_d', 'z_comum_e'],
  corredor: ['z_corredor'],
  resistente: ['z_resistente'],
  furtivo: ['z_furtivo'],
  pamonheiro: ['z_pamonheiro'],
  inchado: ['z_inchado'],
  matriz: ['z_matriz'],
};

for (const [k, v] of Object.entries(LOOKS)) { v.id = k; if (!v.top) v.top = { color: '#888' }; }
