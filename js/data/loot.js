// Tabelas de loot. Cada recipiente sorteia "rolls" entradas pelo peso (w),
// com quantidade entre min e max. Recipientes voltam a ter itens depois de
// "respawn" minutos do jogo. Assim cada casa, carro e armário muda a cada visita.

export const LOOT = {
  // caixas de madeira e lixeiras na rua
  caixa: { rolls: [1, 3], table: [
    { item: 'madeira', min: 1, max: 4, w: 10 }, { item: 'pano', min: 1, max: 3, w: 8 }, { item: 'prego', min: 2, max: 6, w: 5 },
    { item: 'sucata', min: 1, max: 2, w: 5 }, { item: 'corda', min: 1, max: 1, w: 3 }, { item: 'garrafa_vazia', min: 1, max: 1, w: 4 },
    { item: 'fita', min: 1, max: 1, w: 2 }, { item: 'plastico', min: 1, max: 2, w: 3 }, { item: 'biscoito', min: 1, max: 1, w: 2 },
  ] },
  lixeira: { rolls: [1, 2], empty: 0.25, table: [
    { item: 'plastico', min: 1, max: 2, w: 8 }, { item: 'garrafa_vazia', min: 1, max: 1, w: 8 }, { item: 'pano', min: 1, max: 2, w: 6 },
    { item: 'sucata', min: 1, max: 1, w: 3 }, { item: 'biscoito', min: 1, max: 1, w: 1 },
  ] },
  // dentro das casas
  armario: { rolls: [1, 3], table: [
    { item: 'pano', min: 1, max: 3, w: 10 }, { item: 'camiseta', w: 3 }, { item: 'calca', w: 2 }, { item: 'tenis', w: 2 }, { item: 'bone', w: 2 },
    { item: 'bandagem', min: 1, max: 2, w: 4 }, { item: 'remedio', w: 2 }, { item: 'fita', w: 2 }, { item: 'corda', w: 2 },
    { item: 'mochila_pequena', w: 1 }, { item: 'polvora', min: 1, max: 2, w: 1 }, { item: 'jaqueta', w: 1 },
  ] },
  geladeira: { rolls: [1, 2], empty: 0.2, table: [
    { item: 'agua_mineral', w: 3 }, { item: 'refrigerante', w: 4 }, { item: 'carne_crua', min: 1, max: 2, w: 3 },
    { item: 'enlatado', w: 3 }, { item: 'garrafa_vazia', w: 3 }, { item: 'chocolate', w: 1 },
  ] },
  cozinha: { rolls: [1, 3], table: [
    { item: 'enlatado', w: 5 }, { item: 'sardinha', w: 4 }, { item: 'biscoito', w: 4 }, { item: 'garrafa_vazia', w: 4 },
    { item: 'faca', w: 1 }, { item: 'plastico', w: 3 }, { item: 'agua_mineral', w: 1 },
  ] },
  // carros (porta-malas / porta-luvas)
  carro: { rolls: [1, 3], table: [
    { item: 'sucata', min: 1, max: 3, w: 10 }, { item: 'pecas', min: 1, max: 2, w: 5 }, { item: 'gasolina', w: 3 }, { item: 'fita', w: 3 },
    { item: 'refrigerante', w: 3 }, { item: 'chocolate', w: 2 }, { item: 'bandagem', w: 2 }, { item: 'bala_9mm', min: 2, max: 6, w: 1 },
    { item: 'cano', w: 1 }, { item: 'pe_de_cabra', w: 1 }, { item: 'mochila_pequena', w: 1 },
  ] },
  // mercado e farmácia
  prateleira: { rolls: [2, 4], table: [
    { item: 'enlatado', min: 1, max: 2, w: 8 }, { item: 'sardinha', min: 1, max: 2, w: 7 }, { item: 'biscoito', min: 1, max: 2, w: 7 },
    { item: 'refrigerante', w: 5 }, { item: 'agua_mineral', w: 5 }, { item: 'chocolate', w: 4 }, { item: 'plastico', min: 1, max: 3, w: 4 },
    { item: 'garrafa_vazia', w: 3 },
  ] },
  farmacia: { rolls: [1, 3], table: [
    { item: 'bandagem', min: 1, max: 3, w: 10 }, { item: 'remedio', min: 1, max: 2, w: 8 }, { item: 'kit_medico', w: 1 },
    { item: 'agua_mineral', w: 3 }, { item: 'plastico', w: 3 }, { item: 'pano', min: 1, max: 2, w: 4 },
  ] },
  armario_escolar: { rolls: [1, 3], table: [
    { item: 'mochila_pequena', w: 3 }, { item: 'biscoito', w: 5 }, { item: 'refrigerante', w: 3 }, { item: 'pano', min: 1, max: 2, w: 5 },
    { item: 'fita', w: 3 }, { item: 'taco', w: 2 }, { item: 'bone', w: 2 }, { item: 'plastico', w: 3 },
  ] },
  // oficina, posto e ferrovia
  ferramentas: { rolls: [2, 4], table: [
    { item: 'sucata', min: 2, max: 4, w: 10 }, { item: 'prego', min: 4, max: 10, w: 8 }, { item: 'pecas', min: 1, max: 2, w: 6 }, { item: 'fita', w: 5 },
    { item: 'barra_ferro', min: 1, max: 2, w: 3 }, { item: 'pe_de_cabra', w: 2 }, { item: 'cano', w: 2 }, { item: 'capacete_obra', w: 1 },
    { item: 'gasolina', w: 3 }, { item: 'esquema_cartucho', w: 0.4 },
  ] },
  vagao: { rolls: [2, 4], table: [
    { item: 'madeira', min: 3, max: 8, w: 8 }, { item: 'minerio', min: 2, max: 5, w: 6 }, { item: 'sucata', min: 2, max: 4, w: 6 },
    { item: 'barra_ferro', min: 1, max: 2, w: 3 }, { item: 'corda', min: 1, max: 3, w: 4 }, { item: 'polvora', min: 1, max: 3, w: 2 },
    { item: 'mochila_grande', w: 0.5 }, { item: 'esquema_pistola', w: 0.5 },
  ] },
  // caixa militar/policial (rara)
  militar: { rolls: [2, 3], table: [
    { item: 'bala_9mm', min: 4, max: 12, w: 8 }, { item: 'cartucho', min: 2, max: 6, w: 5 }, { item: 'kit_medico', w: 3 }, { item: 'pistola', w: 2 },
    { item: 'colete', w: 1 }, { item: 'capacete_moto', w: 1 }, { item: 'espingarda', w: 1 }, { item: 'polvora', min: 2, max: 4, w: 3 },
  ] },
  // fazenda
  celeiro: { rolls: [1, 3], table: [
    { item: 'fibra', min: 2, max: 5, w: 8 }, { item: 'corda', min: 1, max: 2, w: 6 }, { item: 'carne_crua', min: 1, max: 3, w: 5 },
    { item: 'madeira', min: 2, max: 5, w: 6 }, { item: 'facao', w: 1 }, { item: 'cartucho', min: 2, max: 4, w: 2 }, { item: 'botas', w: 2 },
  ] },
  mochila_largada: { rolls: [2, 4], table: [
    { item: 'bandagem', w: 5 }, { item: 'enlatado', w: 5 }, { item: 'agua_mineral', w: 4 }, { item: 'corda', w: 3 }, { item: 'bala_9mm', min: 3, max: 8, w: 2 },
    { item: 'faca', w: 1 }, { item: 'chocolate', w: 3 }, { item: 'esquema_pistola', w: 0.3 },
  ] },
  // corpos
  cadaver: { rolls: [1, 2], empty: 0.2, table: [
    { item: 'pano', min: 1, max: 2, w: 8 }, { item: 'bandagem', w: 3 }, { item: 'biscoito', w: 3 }, { item: 'bala_9mm', min: 1, max: 4, w: 2 },
    { item: 'faca_velha', w: 1 }, { item: 'garrafa_vazia', w: 3 }, { item: 'fita', w: 2 },
  ] },
  zumbi: { rolls: [1, 1], empty: 0.55, table: [
    { item: 'pano', min: 1, max: 2, w: 10 }, { item: 'sucata', w: 3 }, { item: 'biscoito', w: 2 }, { item: 'bandagem', w: 2 }, { item: 'bala_9mm', min: 1, max: 3, w: 1 },
  ] },
  zumbi_forte: { rolls: [2, 3], table: [
    { item: 'pano', min: 2, max: 3, w: 6 }, { item: 'sucata', min: 1, max: 3, w: 6 }, { item: 'barra_ferro', w: 2 }, { item: 'kit_medico', w: 1 },
    { item: 'cartucho', min: 1, max: 3, w: 2 }, { item: 'capacete_obra', w: 1 },
  ] },
  chefe: { rolls: [4, 5], table: [
    { item: 'barra_ferro', min: 2, max: 4, w: 5 }, { item: 'kit_medico', w: 4 }, { item: 'bala_rifle', min: 3, max: 8, w: 4 }, { item: 'colete', w: 2 },
    { item: 'espingarda', w: 2 }, { item: 'cartucho', min: 3, max: 6, w: 3 }, { item: 'mochila_grande', w: 2 },
  ] },
};

// Tipos de recipiente: nome, ação, tabela, tempo (s) e respawn (min do jogo)
export const CONTAINERS = {
  caixa: { name: 'Caixa de madeira', verb: 'ABRIR', loot: 'caixa', time: 1.0, respawn: 600 },
  lixeira: { name: 'Lixeira', verb: 'VASCULHAR', loot: 'lixeira', time: 1.2, respawn: 400 },
  armario: { name: 'Guarda-roupa', verb: 'ABRIR', loot: 'armario', time: 1.2, respawn: 900 },
  geladeira: { name: 'Geladeira', verb: 'ABRIR', loot: 'geladeira', time: 1.0, respawn: 900 },
  cozinha: { name: 'Armário de cozinha', verb: 'ABRIR', loot: 'cozinha', time: 1.0, respawn: 900 },
  carro: { name: 'Carro abandonado', verb: 'VASCULHAR', loot: 'carro', time: 2.0, respawn: 1200 },
  prateleira: { name: 'Prateleira', verb: 'VASCULHAR', loot: 'prateleira', time: 1.4, respawn: 900 },
  farmacia: { name: 'Prateleira da farmácia', verb: 'VASCULHAR', loot: 'farmacia', time: 1.4, respawn: 1000 },
  armario_escolar: { name: 'Armário escolar', verb: 'ABRIR', loot: 'armario_escolar', time: 1.1, respawn: 900 },
  ferramentas: { name: 'Caixa de ferramentas', verb: 'ABRIR', loot: 'ferramentas', time: 1.3, respawn: 1000 },
  vagao: { name: 'Vagão de carga', verb: 'VASCULHAR', loot: 'vagao', time: 2.2, respawn: 1400 },
  militar: { name: 'Caixa militar', verb: 'ABRIR', loot: 'militar', time: 1.6, respawn: 2400 },
  celeiro: { name: 'Baú do celeiro', verb: 'ABRIR', loot: 'celeiro', time: 1.2, respawn: 900 },
  mochila_largada: { name: 'Mochila abandonada', verb: 'VASCULHAR', loot: 'mochila_largada', time: 1.0, respawn: 3000 },
  cadaver: { name: 'Corpo', verb: 'REVISTAR', loot: 'cadaver', time: 1.5, respawn: 2000 },
};

// Nós de recurso (árvores, pedras, plantas, móveis)
// tool: tipo de poder de ferramenta usado · hits: golpes até esgotar · yield: item por golpe
// needTool: precisa de ferramenta para coletar · respawn em minutos do jogo
export const NODES = {
  arvore: { name: 'Árvore', verb: 'CORTAR', tool: 'wood', hits: 6, yield: [['madeira', 1, 2]], bonus: [['fibra', 0.2]], respawn: 1440, anim: 'chop', sound: 'chop', xp: 3 },
  pinheiro: { name: 'Eucalipto', verb: 'CORTAR', tool: 'wood', hits: 7, yield: [['madeira', 1, 2]], respawn: 1440, anim: 'chop', sound: 'chop', xp: 3 },
  galho: { name: 'Galhos secos', verb: 'PEGAR', pickup: true, yield: [['madeira', 1, 2]], respawn: 600, anim: 'pick', sound: 'pickup', xp: 1 },
  seixo: { name: 'Pedras soltas', verb: 'PEGAR', pickup: true, yield: [['pedra', 1, 2]], respawn: 600, anim: 'pick', sound: 'pickup', xp: 1 },
  rocha: { name: 'Rocha', verb: 'MINERAR', tool: 'stone', needTool: true, hits: 6, yield: [['pedra', 1, 3]], respawn: 1800, anim: 'mine', sound: 'mine', xp: 4 },
  minerio: { name: 'Veio de minério', verb: 'MINERAR', tool: 'ore', needTool: true, hits: 7, yield: [['minerio', 1, 2]], bonus: [['pedra', 0.5]], respawn: 2400, anim: 'mine', sound: 'mine', xp: 8 },
  capim: { name: 'Capim alto', verb: 'COLHER', hits: 2, yield: [['fibra', 1, 2]], respawn: 720, anim: 'pick', sound: 'rustle', xp: 1 },
  goiabeira: { name: 'Pé de goiaba', verb: 'COLHER', hits: 2, yield: [['goiaba', 1, 2]], respawn: 900, anim: 'pickHigh', sound: 'rustle', xp: 2 },
  bananeira: { name: 'Bananeira', verb: 'COLHER', hits: 2, yield: [['banana', 1, 2]], bonus: [['fibra', 0.5]], respawn: 900, anim: 'pickHigh', sound: 'rustle', xp: 2 },
  mangueira: { name: 'Mangueira', verb: 'COLHER', hits: 3, yield: [['manga', 1, 2]], respawn: 1000, anim: 'pickHigh', sound: 'rustle', xp: 2 },
  movel: { name: 'Móveis velhos', verb: 'DESMONTAR', tool: 'scrap', hits: 4, yield: [['madeira', 1, 2]], bonus: [['pano', 0.4], ['prego', 0.4]], respawn: 3000, anim: 'chop', sound: 'break', xp: 2 },
  sucata_carro: { name: 'Carcaça de carro', verb: 'DESMONTAR', tool: 'scrap', hits: 5, yield: [['sucata', 1, 2]], bonus: [['pecas', 0.2]], respawn: 3000, anim: 'chop', sound: 'mine', xp: 3 },
};
