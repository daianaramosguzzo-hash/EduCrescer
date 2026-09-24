// Dados do jogo: tipos, golpes, espécies, itens.

export const TYPES = {
  normal:   { name: 'Normal',   color: '#a8a878' },
  fogo:     { name: 'Fogo',     color: '#f08030' },
  agua:     { name: 'Água',     color: '#6890f0' },
  planta:   { name: 'Planta',   color: '#78c850' },
  inseto:   { name: 'Inseto',   color: '#a8b820' },
  voador:   { name: 'Voador',   color: '#a890f0' },
  pedra:    { name: 'Pedra',    color: '#b8a038' },
  eletrico: { name: 'Elétrico', color: '#e8c020' },
  sombra:   { name: 'Sombra',   color: '#705898' },
};

// multiplicadores atacante -> defensor (padrão 1)
const CHART = {
  normal:   { pedra: 0.5, sombra: 0.5 },
  fogo:     { planta: 2, inseto: 2, agua: 0.5, pedra: 0.5, fogo: 0.5 },
  agua:     { fogo: 2, pedra: 2, planta: 0.5, agua: 0.5 },
  planta:   { agua: 2, pedra: 2, fogo: 0.5, planta: 0.5, inseto: 0.5, voador: 0.5 },
  inseto:   { planta: 2, sombra: 2, fogo: 0.5, voador: 0.5 },
  voador:   { planta: 2, inseto: 2, pedra: 0.5, eletrico: 0.5 },
  pedra:    { fogo: 2, voador: 2, inseto: 2 },
  eletrico: { agua: 2, voador: 2, planta: 0.5, eletrico: 0.5, pedra: 0.5 },
  sombra:   { sombra: 2, normal: 0.5, inseto: 0.5 },
};

export function typeMult(atk, defTypes) {
  let m = 1;
  for (const d of defTypes) m *= (CHART[atk] && CHART[atk][d] !== undefined) ? CHART[atk][d] : 1;
  return m;
}

// cat: 'dano' | 'status'
export const MOVES = {
  investida:    { name: 'Investida',        type: 'normal', pow: 40, acc: 100, pp: 35 },
  arranhao:     { name: 'Arranhão',         type: 'normal', pow: 40, acc: 100, pp: 35 },
  ataquerapido: { name: 'Ataque Rápido',    type: 'normal', pow: 40, acc: 100, pp: 30, pri: 1 },
  mordida:      { name: 'Mordida',          type: 'normal', pow: 60, acc: 100, pp: 25 },
  cabecada:     { name: 'Cabeçada',         type: 'normal', pow: 70, acc: 100, pp: 15 },
  golpecorpo:   { name: 'Golpe de Corpo',   type: 'normal', pow: 85, acc: 100, pp: 15 },
  rosnado:      { name: 'Rosnado',          type: 'normal', cat: 'status', acc: 100, pp: 40, eff: { stat: 'atk', n: -1, who: 'foe' } },
  cauda:        { name: 'Chicote de Cauda', type: 'normal', cat: 'status', acc: 100, pp: 30, eff: { stat: 'def', n: -1, who: 'foe' } },
  endurecer:    { name: 'Endurecer',        type: 'normal', cat: 'status', acc: 100, pp: 30, eff: { stat: 'def', n: 1, who: 'self' } },
  crescer:      { name: 'Crescer',          type: 'normal', cat: 'status', acc: 100, pp: 20, eff: { stat: 'atk', n: 1, who: 'self' } },
  agilidade:    { name: 'Agilidade',        type: 'normal', cat: 'status', acc: 100, pp: 20, eff: { stat: 'spd', n: 2, who: 'self' } },
  recuperar:    { name: 'Recuperar',        type: 'normal', cat: 'status', acc: 100, pp: 10, heal: 0.5 },
  brasa:        { name: 'Brasa',            type: 'fogo', pow: 40, acc: 100, pp: 25 },
  rodafogo:     { name: 'Roda de Fogo',     type: 'fogo', pow: 60, acc: 100, pp: 25 },
  lancachamas:  { name: 'Lança-Chamas',     type: 'fogo', pow: 90, acc: 100, pp: 15 },
  rajadaignea:  { name: 'Rajada Ígnea',     type: 'fogo', pow: 110, acc: 85, pp: 5 },
  jato:         { name: "Jato d'Água",      type: 'agua', pow: 40, acc: 100, pp: 25 },
  raiobolha:    { name: 'Raio Bolha',       type: 'agua', pow: 65, acc: 100, pp: 20 },
  ondaforte:    { name: 'Onda Forte',       type: 'agua', pow: 90, acc: 100, pp: 15 },
  hidrobomba:   { name: 'Hidrobomba',       type: 'agua', pow: 110, acc: 80, pp: 5 },
  chicote:      { name: 'Chicote de Cipó',  type: 'planta', pow: 45, acc: 100, pp: 25 },
  megadreno:    { name: 'Mega Dreno',       type: 'planta', pow: 45, acc: 100, pp: 15, drain: 0.5 },
  folhanavalha: { name: 'Folha Navalha',    type: 'planta', pow: 60, acc: 95, pp: 25 },
  tempestade:   { name: 'Tempestade Verde', type: 'planta', pow: 100, acc: 90, pp: 5 },
  ferrao:       { name: 'Ferrão',           type: 'inseto', pow: 40, acc: 100, pp: 35 },
  fiodeseda:    { name: 'Fio de Seda',      type: 'inseto', cat: 'status', acc: 95, pp: 40, eff: { stat: 'spd', n: -2, who: 'foe' } },
  zumbido:      { name: 'Zumbido',          type: 'inseto', pow: 65, acc: 100, pp: 15 },
  tesourax:     { name: 'Tesoura X',        type: 'inseto', pow: 80, acc: 100, pp: 15 },
  bicada:       { name: 'Bicada',           type: 'voador', pow: 35, acc: 100, pp: 35 },
  asaaerea:     { name: 'Asa Aérea',        type: 'voador', pow: 60, acc: 100, pp: 25 },
  rasante:      { name: 'Rasante',          type: 'voador', pow: 90, acc: 95, pp: 15 },
  rocha:        { name: 'Arremesso de Rocha', type: 'pedra', pow: 50, acc: 90, pp: 15 },
  deslizamento: { name: 'Deslizamento',     type: 'pedra', pow: 75, acc: 90, pp: 10 },
  gumepedra:    { name: 'Gume de Pedra',    type: 'pedra', pow: 100, acc: 80, pp: 5 },
  choque:       { name: 'Choque',           type: 'eletrico', pow: 40, acc: 100, pp: 30 },
  faisca:       { name: 'Faísca',           type: 'eletrico', pow: 65, acc: 100, pp: 20 },
  relampago:    { name: 'Relâmpago',        type: 'eletrico', pow: 90, acc: 100, pp: 15 },
  lambida:      { name: 'Lambida',          type: 'sombra', pow: 30, acc: 100, pp: 30 },
  sugarvida:    { name: 'Sugar Vida',       type: 'sombra', pow: 60, acc: 100, pp: 15, drain: 0.5 },
  bolasombria:  { name: 'Bola Sombria',     type: 'sombra', pow: 80, acc: 100, pp: 15 },
  desesperada:  { name: 'Luta Desesperada', type: 'normal', pow: 50, acc: 100, pp: 1, recoil: 0.25 },
};

// model.plan define o formato 3D gerado proceduralmente
export const SPECIES = {
  brasito: {
    name: 'Brasito', types: ['fogo'], base: { hp: 39, atk: 58, def: 43, spd: 65 }, xp: 62, catch: 45,
    evo: { lvl: 16, to: 'flamaposa' },
    learn: [[1, 'arranhao'], [1, 'rosnado'], [7, 'brasa'], [13, 'ataquerapido'], [19, 'rodafogo'], [25, 'mordida'], [31, 'lancachamas'], [40, 'rajadaignea']],
    model: { plan: 'quad', c1: '#e8603a', c2: '#f7e2c0', size: 0.62, extras: ['ears', 'flameTail', 'snout'] },
    dex: 'Uma raposinha com uma brasa na ponta da cauda. Se a chama brilha forte, está feliz e saudável.',
  },
  flamaposa: {
    name: 'Flamaposa', types: ['fogo'], base: { hp: 58, atk: 80, def: 58, spd: 80 }, xp: 142, catch: 45,
    evo: { lvl: 32, to: 'vulcaposa' },
    learn: [[1, 'arranhao'], [1, 'brasa'], [20, 'rodafogo'], [26, 'mordida'], [33, 'lancachamas'], [42, 'rajadaignea']],
    model: { plan: 'quad', c1: '#e04a2a', c2: '#fbd9a8', size: 0.9, extras: ['ears', 'flameTail', 'flameMane', 'snout'] },
    dex: 'Corre tão rápido que deixa um rastro de faíscas. Sua juba de fogo se acende quando luta.',
  },
  vulcaposa: {
    name: 'Vulcaposa', types: ['fogo'], base: { hp: 78, atk: 104, def: 80, spd: 100 }, xp: 240, catch: 45,
    learn: [[1, 'rodafogo'], [1, 'mordida'], [1, 'lancachamas'], [45, 'rajadaignea']],
    model: { plan: 'quad', c1: '#b83420', c2: '#ffcf7a', size: 1.2, extras: ['ears', 'flameTail', 'flameMane', 'horn', 'snout'] },
    dex: 'Dizem que seu rugido faz vulcões adormecidos acordarem. Protege quem ama com fogo intenso.',
  },
  pingolote: {
    name: 'Pingolote', types: ['agua'], base: { hp: 44, atk: 50, def: 65, spd: 43 }, xp: 63, catch: 45,
    evo: { lvl: 16, to: 'marolote' },
    learn: [[1, 'investida'], [1, 'cauda'], [7, 'jato'], [13, 'endurecer'], [19, 'raiobolha'], [25, 'mordida'], [31, 'ondaforte'], [40, 'hidrobomba']],
    model: { plan: 'quad', c1: '#7ec8e3', c2: '#fbe3ec', c3: '#f07aa8', size: 0.6, extras: ['gills', 'finTail'], low: true },
    dex: 'Um axolote curioso que vive em lagos limpos. Suas brânquias rosadas ficam vermelhas quando se anima.',
  },
  marolote: {
    name: 'Marolote', types: ['agua'], base: { hp: 59, atk: 68, def: 80, spd: 58 }, xp: 142, catch: 45,
    evo: { lvl: 32, to: 'tsunamolote' },
    learn: [[1, 'investida'], [1, 'jato'], [20, 'raiobolha'], [26, 'mordida'], [33, 'ondaforte'], [42, 'hidrobomba']],
    model: { plan: 'quad', c1: '#4a9fd8', c2: '#e3f2fb', c3: '#f05a90', size: 0.9, extras: ['gills', 'finTail', 'backFin'], low: true },
    dex: 'Nada contra correntezas fortes sem esforço. Brinca de criar ondas nos rios.',
  },
  tsunamolote: {
    name: 'Tsunamolote', types: ['agua'], base: { hp: 79, atk: 92, def: 100, spd: 78 }, xp: 240, catch: 45,
    learn: [[1, 'raiobolha'], [1, 'mordida'], [1, 'ondaforte'], [45, 'hidrobomba']],
    model: { plan: 'quad', c1: '#2f6fb8', c2: '#d6ecfa', c3: '#e8407a', size: 1.2, extras: ['gills', 'finTail', 'backFin', 'horn'], low: true },
    dex: 'Com um giro de cauda cria ondas gigantes. É o guardião dos grandes lagos.',
  },
  capibroto: {
    name: 'Capibroto', types: ['planta'], base: { hp: 50, atk: 52, def: 50, spd: 45 }, xp: 64, catch: 45,
    evo: { lvl: 16, to: 'capifolha' },
    learn: [[1, 'investida'], [1, 'crescer'], [7, 'chicote'], [13, 'megadreno'], [19, 'folhanavalha'], [25, 'cabecada'], [33, 'tempestade']],
    model: { plan: 'quad', c1: '#a87848', c2: '#d9b48a', c3: '#5cc043', size: 0.65, extras: ['sprout', 'roundEars', 'snoutBig'] },
    dex: 'Uma capivara tranquila com um broto na cabeça. Adora tomar sol perto da água.',
  },
  capifolha: {
    name: 'Capifolha', types: ['planta'], base: { hp: 60, atk: 70, def: 68, spd: 60 }, xp: 142, catch: 45,
    evo: { lvl: 32, to: 'capiflora' },
    learn: [[1, 'investida'], [1, 'chicote'], [20, 'folhanavalha'], [26, 'cabecada'], [34, 'tempestade']],
    model: { plan: 'quad', c1: '#946438', c2: '#d0a878', c3: '#3fae3a', size: 0.95, extras: ['sprout', 'leafBack', 'roundEars', 'snoutBig'] },
    dex: 'As folhas em suas costas crescem conforme ele fica mais forte. É calmo, mas muito teimoso.',
  },
  capiflora: {
    name: 'Capiflora', types: ['planta'], base: { hp: 80, atk: 95, def: 88, spd: 80 }, xp: 240, catch: 45,
    learn: [[1, 'folhanavalha'], [1, 'cabecada'], [1, 'megadreno'], [36, 'tempestade']],
    model: { plan: 'quad', c1: '#7a5230', c2: '#c89868', c3: '#2e9a38', c4: '#f06aa0', size: 1.25, extras: ['flowerBack', 'leafBack', 'roundEars', 'snoutBig'] },
    dex: 'A flor em suas costas perfuma florestas inteiras. Todos os seres ficam em paz perto dele.',
  },
  ratitu: {
    name: 'Ratitu', types: ['normal'], base: { hp: 30, atk: 56, def: 35, spd: 72 }, xp: 51, catch: 255,
    evo: { lvl: 18, to: 'ratanaz' },
    learn: [[1, 'investida'], [1, 'cauda'], [7, 'ataquerapido'], [14, 'mordida'], [23, 'cabecada'], [30, 'golpecorpo']],
    model: { plan: 'quad', c1: '#9a7ab8', c2: '#f0e6d0', size: 0.45, extras: ['roundEarsBig', 'thinTail', 'snout', 'teeth'] },
    dex: 'Morde qualquer coisa com seus dentes que nunca param de crescer. Vive em todo lugar.',
  },
  ratanaz: {
    name: 'Ratanaz', types: ['normal'], base: { hp: 55, atk: 81, def: 60, spd: 97 }, xp: 145, catch: 127,
    learn: [[1, 'investida'], [1, 'ataquerapido'], [1, 'mordida'], [25, 'cabecada'], [34, 'golpecorpo']],
    model: { plan: 'quad', c1: '#b48a4a', c2: '#f3e3c0', size: 0.75, extras: ['roundEarsBig', 'thinTail', 'snout', 'teeth'] },
    dex: 'Seus bigodes sentem o vento e o ajudam a manter o equilíbrio. Muito veloz.',
  },
  pardalito: {
    name: 'Pardalito', types: ['normal', 'voador'], base: { hp: 40, atk: 45, def: 40, spd: 56 }, xp: 50, catch: 255,
    evo: { lvl: 18, to: 'gavialto' },
    learn: [[1, 'investida'], [1, 'bicada'], [9, 'ataquerapido'], [15, 'asaaerea'], [25, 'agilidade'], [33, 'rasante']],
    model: { plan: 'bird', c1: '#9a6a3a', c2: '#f0dcb8', c3: '#f0a030', size: 0.45, extras: [] },
    dex: 'Canta ao amanhecer em todas as rotas. Muito curioso, segue treinadores por aí.',
  },
  gavialto: {
    name: 'Gavialto', types: ['normal', 'voador'], base: { hp: 63, atk: 65, def: 60, spd: 71 }, xp: 122, catch: 120,
    learn: [[1, 'bicada'], [1, 'ataquerapido'], [1, 'asaaerea'], [28, 'agilidade'], [36, 'rasante']],
    model: { plan: 'bird', c1: '#7a4a2a', c2: '#f3e0c0', c3: '#f0b030', size: 0.8, extras: ['crest'] },
    dex: 'Vigia seu território do alto das árvores e mergulha em alta velocidade.',
  },
  taturana: {
    name: 'Taturana', types: ['inseto'], base: { hp: 45, atk: 30, def: 35, spd: 45 }, xp: 39, catch: 255,
    evo: { lvl: 7, to: 'casulito' },
    learn: [[1, 'investida'], [1, 'fiodeseda']],
    model: { plan: 'worm', c1: '#9ad04a', c2: '#f0e060', size: 0.45, extras: ['antenna'] },
    dex: 'Come folhas o dia inteiro. Seus pelinhos amarelos assustam quem chega perto.',
  },
  casulito: {
    name: 'Casulito', types: ['inseto'], base: { hp: 50, atk: 20, def: 55, spd: 30 }, xp: 72, catch: 120,
    evo: { lvl: 10, to: 'borbolux' },
    learn: [[1, 'endurecer']],
    model: { plan: 'cocoon', c1: '#8aa05a', c2: '#d6d08a', size: 0.55, extras: [] },
    dex: 'Fica paradinho dentro do casulo, esperando o grande dia de voar.',
  },
  borbolux: {
    name: 'Borbolux', types: ['inseto', 'voador'], base: { hp: 60, atk: 70, def: 50, spd: 70 }, xp: 160, catch: 45,
    learn: [[1, 'investida'], [10, 'zumbido'], [13, 'asaaerea'], [18, 'megadreno'], [24, 'tesourax'], [30, 'rasante']],
    model: { plan: 'butterfly', c1: '#b8a0e8', c2: '#f8f0a0', c3: '#6a4aa8', size: 0.7, extras: [] },
    dex: 'Suas asas soltam um pó brilhante. Em noites de lua cheia, dança no céu.',
  },
  joanito: {
    name: 'Joanito', types: ['inseto'], base: { hp: 40, atk: 48, def: 50, spd: 55 }, xp: 56, catch: 190,
    learn: [[1, 'investida'], [5, 'ferrao'], [12, 'endurecer'], [18, 'zumbido'], [28, 'tesourax']],
    model: { plan: 'beetle', c1: '#e03a30', c2: '#222222', size: 0.45, extras: ['antenna'] },
    dex: 'Dizem que traz sorte a quem o encontra. Tem sete pintas nas costas.',
  },
  faiscatu: {
    name: 'Faiscatu', types: ['eletrico'], base: { hp: 40, atk: 58, def: 60, spd: 65 }, xp: 66, catch: 190,
    evo: { lvl: 22, to: 'trovatu' },
    learn: [[1, 'investida'], [1, 'choque'], [8, 'endurecer'], [14, 'faisca'], [21, 'agilidade'], [28, 'relampago']],
    model: { plan: 'quad', c1: '#f0c830', c2: '#fff3b8', c3: '#8a6a20', size: 0.5, extras: ['shell', 'sparkTail', 'snout', 'ears'] },
    dex: 'Um tatu que acumula eletricidade na carapaça. Quando se enrola, solta faíscas.',
  },
  trovatu: {
    name: 'Trovatu', types: ['eletrico'], base: { hp: 65, atk: 85, def: 90, spd: 80 }, xp: 160, catch: 75,
    learn: [[1, 'choque'], [1, 'faisca'], [1, 'endurecer'], [30, 'relampago']],
    model: { plan: 'quad', c1: '#d8a020', c2: '#fff0a0', c3: '#5a4010', size: 0.9, extras: ['shell', 'sparkTail', 'snout', 'ears', 'spikes'] },
    dex: 'Rola como uma bola de trovão pelos campos. Sua carapaça brilha antes das tempestades.',
  },
  pedrolho: {
    name: 'Pedrolho', types: ['pedra'], base: { hp: 40, atk: 70, def: 90, spd: 20 }, xp: 60, catch: 190,
    evo: { lvl: 22, to: 'rochedao' },
    learn: [[1, 'investida'], [1, 'endurecer'], [8, 'rocha'], [16, 'cabecada'], [22, 'deslizamento'], [32, 'gumepedra']],
    model: { plan: 'rock', c1: '#9a9088', c2: '#6a625a', size: 0.55, extras: [] },
    dex: 'Uma pedra com um olho só. Fica imóvel na trilha e muita gente tropeça nele.',
  },
  rochedao: {
    name: 'Rochedão', types: ['pedra'], base: { hp: 65, atk: 95, def: 115, spd: 35 }, xp: 150, catch: 90,
    learn: [[1, 'rocha'], [1, 'endurecer'], [1, 'cabecada'], [25, 'deslizamento'], [34, 'gumepedra']],
    model: { plan: 'rock', c1: '#8a7e70', c2: '#5c8a3a', size: 1.0, extras: ['moss'] },
    dex: 'Musgo cresce em suas costas há séculos. É tão pesado que faz o chão tremer.',
  },
  lambarito: {
    name: 'Lambarito', types: ['agua'], base: { hp: 35, atk: 40, def: 45, spd: 75 }, xp: 50, catch: 255,
    evo: { lvl: 20, to: 'pirarucao' },
    learn: [[1, 'investida'], [1, 'jato'], [12, 'raiobolha'], [18, 'mordida']],
    model: { plan: 'fish', c1: '#9cc8e8', c2: '#e8f4fa', c3: '#f0c040', size: 0.45, extras: [] },
    dex: 'Nada em cardumes nos rios. Pula para fora da água para pegar insetos.',
  },
  pirarucao: {
    name: 'Pirarucão', types: ['agua'], base: { hp: 85, atk: 100, def: 75, spd: 75 }, xp: 175, catch: 45,
    learn: [[1, 'mordida'], [1, 'raiobolha'], [22, 'ondaforte'], [30, 'golpecorpo'], [38, 'hidrobomba']],
    model: { plan: 'fish', c1: '#3a4a5a', c2: '#c84a3a', c3: '#f07040', size: 1.25, extras: ['whiskers'] },
    dex: 'Um peixe gigante das águas profundas. Suas escamas vermelhas são duras como armadura.',
  },
  estrelito: {
    name: 'Estrelito', types: ['agua'], base: { hp: 35, atk: 55, def: 55, spd: 85 }, xp: 68, catch: 200,
    learn: [[1, 'investida'], [1, 'endurecer'], [8, 'jato'], [15, 'ataquerapido'], [20, 'raiobolha'], [28, 'recuperar'], [34, 'ondaforte']],
    model: { plan: 'star', c1: '#e8a060', c2: '#f04a6a', size: 0.55, extras: [] },
    dex: 'Gira como um pião na areia da praia. A joia no centro brilha à noite.',
  },
  sirito: {
    name: 'Sirito', types: ['agua', 'pedra'], base: { hp: 40, atk: 72, def: 85, spd: 45 }, xp: 70, catch: 170,
    learn: [[1, 'arranhao'], [1, 'endurecer'], [9, 'jato'], [14, 'rocha'], [22, 'raiobolha'], [30, 'deslizamento']],
    model: { plan: 'crab', c1: '#e06a40', c2: '#f8d8b8', size: 0.5, extras: [] },
    dex: 'Anda de lado pela praia com suas pinças fortes. Esconde-se em buracos na areia.',
  },
  sombrino: {
    name: 'Sombrino', types: ['sombra'], base: { hp: 35, atk: 60, def: 35, spd: 80 }, xp: 62, catch: 190,
    evo: { lvl: 25, to: 'assombrado' },
    learn: [[1, 'lambida'], [1, 'rosnado'], [10, 'sugarvida'], [18, 'agilidade'], [24, 'bolasombria']],
    model: { plan: 'ghost', c1: '#6a4a9a', c2: '#e8e0ff', size: 0.55, extras: [] },
    dex: 'Aparece em noites sem lua. Gosta de pregar sustos, mas no fundo só quer um amigo.',
  },
  assombrado: {
    name: 'Assombrado', types: ['sombra'], base: { hp: 55, atk: 85, def: 55, spd: 100 }, xp: 150, catch: 60,
    learn: [[1, 'lambida'], [1, 'sugarvida'], [1, 'bolasombria']],
    model: { plan: 'ghost', c1: '#4a2a7a', c2: '#ffd0ff', size: 0.95, extras: ['crown'] },
    dex: 'Flutua sem fazer barulho. Sua risada ecoa por longas distâncias.',
  },
  morcegote: {
    name: 'Morcegote', types: ['sombra', 'voador'], base: { hp: 40, atk: 45, def: 35, spd: 60 }, xp: 49, catch: 255,
    evo: { lvl: 22, to: 'morcegao' },
    learn: [[1, 'lambida'], [5, 'bicada'], [10, 'mordida'], [15, 'sugarvida'], [22, 'asaaerea'], [30, 'bolasombria']],
    model: { plan: 'bat', c1: '#4a4a8a', c2: '#c8a8e8', size: 0.45, extras: [] },
    dex: 'Dorme de cabeça para baixo em cavernas. Voa usando ecos para não bater em nada.',
  },
  morcegao: {
    name: 'Morcegão', types: ['sombra', 'voador'], base: { hp: 70, atk: 75, def: 65, spd: 90 }, xp: 159, catch: 90,
    learn: [[1, 'mordida'], [1, 'sugarvida'], [1, 'asaaerea'], [30, 'bolasombria'], [36, 'rasante']],
    model: { plan: 'bat', c1: '#2e2e6a', c2: '#a878d8', size: 0.85, extras: [] },
    dex: 'Suas asas enormes cobrem a luz da lua. Caça em bandos silenciosos.',
  },
  solaris: {
    name: 'Solaris', types: ['fogo', 'voador'], base: { hp: 90, atk: 110, def: 90, spd: 100 }, xp: 270, catch: 5,
    learn: [[1, 'brasa'], [1, 'asaaerea'], [1, 'lancachamas'], [1, 'rasante'], [40, 'rajadaignea']],
    model: { plan: 'bird', c1: '#f06020', c2: '#ffd040', c3: '#ffe080', size: 1.4, extras: ['crest', 'flameWings', 'flameTail'] },
    dex: 'Ave lendária que nasce do sol da manhã. Dizem que aparece para quem nunca desiste de crescer.',
  },
};

export const DEX_ORDER = Object.keys(SPECIES);

export const ITEMS = {
  pocao:      { name: 'Poção',        price: 300,  desc: 'Recupera 20 PV de um Crescemon.', use: 'heal', amount: 20 },
  superpocao: { name: 'Super Poção',  price: 700,  desc: 'Recupera 60 PV de um Crescemon.', use: 'heal', amount: 60 },
  reviver:    { name: 'Reviver',      price: 1500, desc: 'Reanima um Crescemon desmaiado com metade dos PV.', use: 'revive' },
  elixir:     { name: 'Elixir',       price: 1200, desc: 'Restaura todos os PP dos golpes de um Crescemon.', use: 'pp' },
  orbe:       { name: 'Cresce-Orbe',  price: 200,  desc: 'Orbe para capturar Crescemon selvagens.', use: 'ball', bonus: 1 },
  superorbe:  { name: 'Super Orbe',   price: 600,  desc: 'Orbe com chance de captura maior.', use: 'ball', bonus: 1.5 },
  encomenda:  { name: 'Encomenda',    price: 0,    desc: 'Um pacote para o Prof. Ipê.', use: 'key' },
};

export const BADGES = [
  { id: 'rocha', name: 'Insígnia Rocha', color: '#9a8a70' },
  { id: 'mare', name: 'Insígnia Maré', color: '#4a9fd8' },
];
