// Tipos de piso, estruturas e objetos (props) do mapa.

// ------------------------------------------------------------ pisos
export const FLOORS = [
  { id: 'grama', nome: 'Grama', mini: '#6ea84e' },            // 0
  { id: 'terra', nome: 'Terra', mini: '#a88a5c' },            // 1
  { id: 'asfalto', nome: 'Asfalto', mini: '#4a4a52' },        // 2
  { id: 'calcada', nome: 'Calçada', mini: '#b9b2a4' },        // 3
  { id: 'pedra', nome: 'Pedra portuguesa', mini: '#d8d2c4' }, // 4
  { id: 'madeira', nome: 'Piso de madeira', mini: '#b07a48' },// 5
  { id: 'ceramica', nome: 'Cerâmica', mini: '#d8c8a8' },      // 6
  { id: 'granilite', nome: 'Granilite', mini: '#c8c4bc' },    // 7
  { id: 'mercado', nome: 'Piso do mercado', mini: '#e4e2da' },// 8
  { id: 'cimento', nome: 'Cimento', mini: '#9a9890' },        // 9
  { id: 'brita', nome: 'Brita', mini: '#7a7068' },            // 10
  { id: 'areia', nome: 'Areia', mini: '#e2cf96' },            // 11
  { id: 'agua', nome: 'Rio Doce', mini: '#4a8ab0' },          // 12
  { id: 'ponte', nome: 'Ponte', mini: '#8a8a88' },            // 13
  { id: 'quadra', nome: 'Quadra', mini: '#4a8ac0' },          // 14
  { id: 'faixa', nome: 'Faixa de pedestre', mini: '#6a6a70' },// 15
  { id: 'ladrilho', nome: 'Ladrilho hidráulico', mini: '#b85a4a' }, // 16
  { id: 'lab', nome: 'Piso de laboratório', mini: '#e8eeea' },// 17
  { id: 'canteiro', nome: 'Canteiro', mini: '#4f8a3a' },      // 18
  { id: 'banheiro', nome: 'Azulejo', mini: '#a8d0d8' },       // 19
  { id: 'campo', nome: 'Terrão', mini: '#b8905a' },           // 20
  { id: 'estacionamento', nome: 'Estacionamento', mini: '#55555c' }, // 21
];
export const F = Object.fromEntries(FLOORS.map((f, i) => [f.id, i]));

// ------------------------------------------------------------ estruturas (uma por célula)
export const S = {
  NONE: 0, WALL: 1, DOOR: 2, WINDOW: 3, MURO: 4, GRADE: 5, WATER: 6, ROCK: 7, GATE: 8, FENCE: 9,
};
export const STRUCT_INFO = {
  [S.WALL]: { nome: 'Parede', blocks: true, opaque: true, cover: 2 },
  [S.DOOR]: { nome: 'Porta', door: true },
  [S.WINDOW]: { nome: 'Janela', blocks: true, opaque: false, cover: 2, window: true },
  [S.MURO]: { nome: 'Muro', blocks: true, opaque: true, cover: 2 },
  [S.GRADE]: { nome: 'Grade', blocks: true, opaque: false, cover: 1 },
  [S.WATER]: { nome: 'Rio', blocks: true, opaque: false, cover: 0 },
  [S.ROCK]: { nome: 'Pedra', blocks: true, opaque: true, cover: 2 },
  [S.GATE]: { nome: 'Portão', door: true, gate: true },
  [S.FENCE]: { nome: 'Cerca', blocks: true, opaque: false, cover: 1 },
};

// ------------------------------------------------------------ objetos
// size: [largura x, profundidade z] em células (antes da rotação)
// blocks: bloqueia passagem | opaque: bloqueia visão | cover: 0 nada, 1 meia, 2 total
// loot: tabela de loot padrão | search: PA para vasculhar | hide: dá para se esconder
export const PROPS = {
  sofa: { nome: 'Sofá', size: [2, 1], blocks: true, cover: 1, loot: 'sala', search: 2, lootChance: 0.45 },
  poltrona: { nome: 'Poltrona', size: [1, 1], blocks: true, cover: 1 },
  tv: { nome: 'Rack com TV', size: [2, 1], blocks: true, cover: 1, loot: 'sala', search: 2, lootChance: 0.5 },
  mesa: { nome: 'Mesa', size: [2, 1], blocks: true, cover: 1 },
  mesa_redonda: { nome: 'Mesa', size: [1, 1], blocks: true, cover: 1 },
  cadeira: { nome: 'Cadeira', size: [1, 1], blocks: false, cover: 0 },
  cama: { nome: 'Cama de solteiro', size: [1, 2], blocks: true, cover: 1, hide: true, loot: 'quarto', search: 2, lootChance: 0.35, rest: true },
  cama_casal: { nome: 'Cama de casal', size: [2, 2], blocks: true, cover: 1, hide: true, loot: 'quarto', search: 2, lootChance: 0.4, rest: true },
  guarda_roupa: { nome: 'Guarda-roupa', size: [2, 1], blocks: true, opaque: true, cover: 2, hide: true, loot: 'quarto', search: 3, lootChance: 0.85 },
  criado: { nome: 'Criado-mudo', size: [1, 1], blocks: true, cover: 0, loot: 'quarto', search: 1, lootChance: 0.6 },
  escrivaninha: { nome: 'Escrivaninha', size: [2, 1], blocks: true, cover: 1, loot: 'escritorio', search: 2, lootChance: 0.7 },
  estante: { nome: 'Estante de livros', size: [2, 1], blocks: true, opaque: true, cover: 2, loot: 'sala', search: 2, lootChance: 0.5 },
  geladeira: { nome: 'Geladeira', size: [1, 1], blocks: true, opaque: true, cover: 2, loot: 'geladeira', search: 1, lootChance: 0.85 },
  fogao: { nome: 'Fogão', size: [1, 1], blocks: true, cover: 1, stove: true },
  pia: { nome: 'Pia da cozinha', size: [1, 1], blocks: true, cover: 1, loot: 'armario_cozinha', search: 2, lootChance: 0.6, water: true },
  armario: { nome: 'Armário de cozinha', size: [1, 1], blocks: true, cover: 1, loot: 'armario_cozinha', search: 2, lootChance: 0.9 },
  vaso: { nome: 'Vaso sanitário', size: [1, 1], blocks: true, cover: 0 },
  chuveiro: { nome: 'Box do chuveiro', size: [1, 1], blocks: false, cover: 0, hide: true },
  armarinho: { nome: 'Armarinho do banheiro', size: [1, 1], blocks: true, cover: 0, loot: 'banheiro', search: 1, lootChance: 0.9 },
  maquina: { nome: 'Máquina de lavar', size: [1, 1], blocks: true, cover: 1, loot: 'quintal', search: 1, lootChance: 0.3 },
  tanque: { nome: 'Tanque de lavar', size: [1, 1], blocks: true, cover: 1, water: true },
  caixas: { nome: 'Caixas de papelão', size: [1, 1], blocks: true, cover: 1, loot: 'garagem', search: 2, lootChance: 0.75 },
  bancada: { nome: 'Bancada de ferramentas', size: [2, 1], blocks: true, cover: 1, loot: 'garagem', search: 2, lootChance: 0.85 },
  carro: { nome: 'Carro abandonado', size: [2, 3], blocks: true, cover: 1, loot: 'carro', search: 3, lootChance: 0.6, car: true },
  carro_pol: { nome: 'Viatura abandonada', size: [2, 3], blocks: true, cover: 1, loot: 'militar', search: 3, lootChance: 0.8, car: true },
  opala: { nome: 'Opala do Seu Valdir', size: [2, 3], blocks: true, cover: 1, car: true, vehicle: true },
  moto: { nome: 'Moto caída', size: [1, 1], blocks: true, cover: 0, loot: 'carro', search: 1, lootChance: 0.3 },
  onibus: { nome: 'Ônibus', size: [2, 6], blocks: true, opaque: true, cover: 2, loot: 'carro', search: 3, lootChance: 0.5 },
  caminhao: { nome: 'Caminhão do exército', size: [2, 4], blocks: true, opaque: true, cover: 2, loot: 'militar', search: 3, lootChance: 0.95 },
  lixeira: { nome: 'Lixeira', size: [1, 1], blocks: true, cover: 0, loot: 'lixeira', search: 1, lootChance: 0.55 },
  cacamba: { nome: 'Caçamba de entulho', size: [2, 1], blocks: true, cover: 2, hide: true, loot: 'lixeira', search: 2, lootChance: 0.6 },
  arvore: { nome: 'Mangueira', size: [1, 1], blocks: true, cover: 1, tree: 'manga' },
  ipe: { nome: 'Ipê-amarelo', size: [1, 1], blocks: true, cover: 1, tree: 'ipe' },
  ipe_rosa: { nome: 'Ipê-rosa', size: [1, 1], blocks: true, cover: 1, tree: 'ipe_rosa' },
  palmeira: { nome: 'Palmeira', size: [1, 1], blocks: true, cover: 0, tree: 'palma' },
  arbusto: { nome: 'Arbusto', size: [1, 1], blocks: false, cover: 1, hide: true, bush: true },
  poste: { nome: 'Poste', size: [1, 1], blocks: true, cover: 0, light: 'poste' },
  banco: { nome: 'Banco da praça', size: [2, 1], blocks: true, cover: 1 },
  orelhao: { nome: 'Orelhão', size: [1, 1], blocks: true, cover: 0 },
  banca: { nome: 'Banca de jornal', size: [2, 2], blocks: true, opaque: true, cover: 2, loot: 'sala', search: 2, lootChance: 0.8 },
  pipoca: { nome: 'Carrinho de pipoca', size: [1, 1], blocks: true, cover: 1, loot: 'lixeira', search: 1, lootChance: 0.5 },
  coreto: { nome: 'Coreto', size: [3, 3], blocks: true, cover: 1 },
  monumento: { nome: 'Monumento ao Pioneiro', size: [1, 1], blocks: true, opaque: true, cover: 2 },
  fonte: { nome: 'Chafariz', size: [2, 2], blocks: true, cover: 1, water: true },
  altar: { nome: 'Altar', size: [3, 1], blocks: true, cover: 1, loot: 'igreja', search: 2, lootChance: 0.8 },
  banco_igreja: { nome: 'Banco da igreja', size: [3, 1], blocks: true, cover: 1 },
  carteira: { nome: 'Carteira escolar', size: [1, 1], blocks: true, cover: 1, loot: 'escola_sala', search: 1, lootChance: 0.25 },
  mesa_prof: { nome: 'Mesa do professor', size: [2, 1], blocks: true, cover: 1, loot: 'escola_secretaria', search: 2, lootChance: 0.8 },
  lousa: { nome: 'Quadro-negro', size: [3, 1], blocks: false, cover: 0, wall: true },
  armario_escola: { nome: 'Armários de aço', size: [2, 1], blocks: true, opaque: true, cover: 2, loot: 'escola_sala', search: 2, lootChance: 0.8, hide: true },
  prateleira: { nome: 'Prateleira', size: [1, 3], blocks: true, opaque: true, cover: 2, loot: 'mercado_prateleira', search: 2, lootChance: 0.8 },
  gondola: { nome: 'Gôndola do mercado', size: [1, 4], blocks: true, opaque: true, cover: 2, loot: 'mercado_prateleira', search: 3, lootChance: 0.85 },
  caixa_reg: { nome: 'Caixa registradora', size: [1, 2], blocks: true, cover: 1, loot: 'caixa_registradora', search: 1, lootChance: 0.7 },
  freezer: { nome: 'Freezer', size: [2, 1], blocks: true, cover: 1, loot: 'mercado_freezer', search: 2, lootChance: 0.85 },
  balcao: { nome: 'Balcão', size: [3, 1], blocks: true, cover: 1, loot: 'caixa_registradora', search: 2, lootChance: 0.6 },
  arara: { nome: 'Arara de roupas', size: [2, 1], blocks: true, cover: 1, hide: true, loot: 'roupas', search: 2, lootChance: 0.7 },
  carrinho: { nome: 'Carrinho de compras', size: [1, 1], blocks: true, cover: 0 },
  pallet: { nome: 'Pallet com mercadorias', size: [2, 2], blocks: true, cover: 1, loot: 'mercado_estoque', search: 3, lootChance: 0.95 },
  bomba: { nome: 'Bomba de combustível', size: [1, 1], blocks: true, cover: 1, fuel: true },
  elevador: { nome: 'Elevador de carro', size: [2, 3], blocks: true, cover: 1 },
  pneus: { nome: 'Pilha de pneus', size: [1, 1], blocks: true, cover: 1, hide: true },
  tambor: { nome: 'Tambor de óleo', size: [1, 1], blocks: true, cover: 1, loot: 'oficina', search: 1, lootChance: 0.3 },
  sacos: { nome: 'Sacos de areia', size: [1, 1], blocks: true, cover: 1 },
  barricada: { nome: 'Barricada militar', size: [3, 1], blocks: true, cover: 2 },
  cavalete: { nome: 'Cavalete', size: [1, 1], blocks: true, cover: 0 },
  locomotiva: { nome: 'Locomotiva', size: [2, 7], blocks: true, opaque: true, cover: 2, vehicle: true },
  vagao: { nome: 'Vagão', size: [2, 7], blocks: true, opaque: true, cover: 2, loot: 'estacao', search: 3, lootChance: 0.6 },
  bancada_lab: { nome: 'Bancada de laboratório', size: [2, 1], blocks: true, cover: 1, loot: 'laboratorio', search: 2, lootChance: 0.85 },
  tanque_lab: { nome: 'Tanque de cultivo', size: [1, 1], blocks: true, opaque: true, cover: 2, glow: true },
  computador: { nome: 'Computador', size: [1, 1], blocks: true, cover: 1 },
  gaiola: { nome: 'Gaiola de testes', size: [1, 1], blocks: true, cover: 1 },
  gerador: { nome: 'Gerador', size: [2, 1], blocks: true, cover: 1 },
  transmissor: { nome: 'Transmissor da rádio', size: [2, 1], blocks: true, cover: 1 },
  antena: { nome: 'Torre da antena', size: [1, 1], blocks: true, cover: 0 },
  rede: { nome: 'Rede de dormir', size: [2, 1], blocks: false, cover: 0, rest: true },
  varal: { nome: 'Varal', size: [3, 1], blocks: false, cover: 0 },
  churrasqueira: { nome: 'Churrasqueira', size: [1, 1], blocks: true, cover: 1, stove: true },
  caixa_dagua: { nome: "Caixa d'água", size: [1, 1], blocks: true, cover: 2 },
  bicicleta: { nome: 'Bicicleta', size: [1, 1], blocks: false, cover: 0 },
  mesa_bar: { nome: 'Mesa de plástico', size: [1, 1], blocks: true, cover: 0 },
  mesa_rest: { nome: 'Mesa do restaurante', size: [1, 1], blocks: true, cover: 1 },
  forno: { nome: 'Fogão industrial', size: [2, 1], blocks: true, cover: 1, stove: true, loot: 'restaurante', search: 2, lootChance: 0.6 },
  trave: { nome: 'Trave', size: [1, 3], blocks: false, cover: 0 },
  quiosque: { nome: 'Quiosque', size: [2, 2], blocks: true, opaque: true, cover: 2, loot: 'conveniencia', search: 2, lootChance: 0.7 },
  canoa: { nome: 'Canoa', size: [1, 3], blocks: true, cover: 1 },
  bau: { nome: 'Baú do esconderijo', size: [1, 1], blocks: true, cover: 1, stash: true },
  arquivo: { nome: 'Arquivo de aço', size: [1, 1], blocks: true, opaque: true, cover: 2, loot: 'escritorio', search: 2, lootChance: 0.7 },
  cofre: { nome: 'Cofre', size: [1, 1], blocks: true, cover: 1, loot: 'escritorio', search: 3, lootChance: 1 },
  vitrine: { nome: 'Vitrine', size: [2, 1], blocks: true, cover: 1, loot: 'eletronicos', search: 2, lootChance: 0.75 },
  planta: { nome: 'Vaso de planta', size: [1, 1], blocks: true, cover: 0 },
  maca: { nome: 'Maca', size: [1, 2], blocks: true, cover: 1 },
  entulho: { nome: 'Entulho', size: [1, 1], blocks: true, cover: 1 },
  placa: { nome: 'Placa', size: [1, 1], blocks: false, cover: 0 },
  ponto_onibus: { nome: 'Ponto de ônibus', size: [2, 1], blocks: false, cover: 0 },
  sucata: { nome: 'Carro depenado', size: [2, 3], blocks: true, cover: 1, loot: 'ferro_velho', search: 3, lootChance: 0.8, car: true },
  sino: { nome: 'Sino da Matriz', size: [1, 1], blocks: true, cover: 0 },
};
for (const [k, v] of Object.entries(PROPS)) v.id = k;
