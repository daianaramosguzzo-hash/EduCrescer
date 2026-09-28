// Receitas de fabricação e construções da base.
//
// Receita: out (item), n (quantidade), needs [[item, qtd]], station (onde fabrica),
// level (nível mínimo), blueprint (precisa aprender com um esquema).
// A receita é "descoberta" quando o personagem já teve em mãos todos os ingredientes.

export const STATIONS = {
  mao: { name: 'Nas mãos', icon: '✋' },
  bancada: { name: 'Bancada', icon: '🛠️' },
  fogueira: { name: 'Fogueira', icon: '🔥' },
  fornalha: { name: 'Fornalha', icon: '🧱' },
  oficina: { name: 'Oficina', icon: '🔧' },
  medica: { name: 'Área médica', icon: '⚕️' },
};

export const CRAFT_CATS = [
  { id: 'ferramentas', name: 'Ferramentas', icon: '🪓' },
  { id: 'armas', name: 'Armas', icon: '🗡️' },
  { id: 'sobrevivencia', name: 'Sobrevivência', icon: '🔥' },
  { id: 'materiais', name: 'Materiais', icon: '🪢' },
  { id: 'roupas', name: 'Roupas e proteção', icon: '🧥' },
];

export const RECIPES = [
  // ferramentas
  { out: 'machado_pedra', cat: 'ferramentas', station: 'mao', needs: [['madeira', 3], ['pedra', 2]] },
  { out: 'picareta_pedra', cat: 'ferramentas', station: 'mao', needs: [['madeira', 3], ['pedra', 4]] },
  { out: 'faca', cat: 'ferramentas', station: 'bancada', level: 3, needs: [['barra_ferro', 1], ['madeira', 1], ['fita', 1]] },
  { out: 'machado', cat: 'ferramentas', station: 'bancada', level: 4, needs: [['barra_ferro', 3], ['madeira', 3], ['corda', 1]] },
  { out: 'picareta', cat: 'ferramentas', station: 'bancada', level: 4, needs: [['barra_ferro', 3], ['madeira', 3], ['corda', 1]] },
  { out: 'pe_de_cabra', cat: 'ferramentas', station: 'bancada', level: 3, needs: [['sucata', 6], ['fita', 1]] },

  // armas
  { out: 'taco', cat: 'armas', station: 'mao', needs: [['madeira', 5]] },
  { out: 'lanca', cat: 'armas', station: 'mao', level: 2, needs: [['madeira', 4], ['corda', 1], ['pedra', 1]] },
  { out: 'taco_prego', cat: 'armas', station: 'bancada', level: 2, needs: [['taco', 1], ['prego', 8]] },
  { out: 'facao', cat: 'armas', station: 'bancada', level: 5, needs: [['barra_ferro', 3], ['madeira', 2], ['pano', 2]] },
  { out: 'lanca_ferro', cat: 'armas', station: 'bancada', level: 5, needs: [['barra_ferro', 2], ['madeira', 4], ['corda', 2]] },
  { out: 'arco', cat: 'armas', station: 'bancada', level: 3, blueprint: true, needs: [['madeira', 6], ['corda', 3]] },
  { out: 'flecha', n: 5, cat: 'armas', station: 'bancada', level: 3, blueprint: 'arco', needs: [['madeira', 2], ['pedra', 1], ['fibra', 1]] },
  { out: 'bala_9mm', n: 6, cat: 'armas', station: 'oficina', level: 5, blueprint: true, needs: [['polvora', 2], ['sucata', 2]] },
  { out: 'cartucho', n: 4, cat: 'armas', station: 'oficina', level: 6, blueprint: true, needs: [['polvora', 3], ['sucata', 2], ['plastico', 1]] },

  // sobrevivência
  { out: 'bandagem', cat: 'sobrevivencia', station: 'mao', needs: [['pano', 2]] },
  { out: 'cantil', cat: 'sobrevivencia', station: 'mao', level: 2, needs: [['garrafa_vazia', 1], ['pano', 2], ['corda', 1]] },
  { out: 'mochila_pequena', cat: 'sobrevivencia', station: 'mao', level: 2, needs: [['pano', 8], ['corda', 2]] },
  { out: 'mochila_grande', cat: 'sobrevivencia', station: 'bancada', level: 6, needs: [['pano', 14], ['corda', 4], ['sucata', 2], ['plastico', 2]] },
  { out: 'agua_limpa', cat: 'sobrevivencia', station: 'fogueira', needs: [['agua_suja', 1]] },
  { out: 'carne_assada', cat: 'sobrevivencia', station: 'fogueira', needs: [['carne_crua', 1]] },
  { out: 'ensopado', cat: 'sobrevivencia', station: 'fogueira', level: 3, needs: [['enlatado', 1], ['agua_limpa', 1], ['banana', 1]] },
  { out: 'cha', cat: 'sobrevivencia', station: 'fogueira', level: 2, needs: [['fibra', 3], ['agua_limpa', 1]] },
  { out: 'kit_medico', cat: 'sobrevivencia', station: 'medica', level: 4, needs: [['bandagem', 3], ['remedio', 1], ['agua_limpa', 1]] },
  { out: 'remedio', n: 2, cat: 'sobrevivencia', station: 'medica', level: 4, needs: [['cha', 2], ['plastico', 1]] },

  // materiais
  { out: 'corda', cat: 'materiais', station: 'mao', needs: [['fibra', 3]] },
  { out: 'prego', n: 6, cat: 'materiais', station: 'bancada', needs: [['sucata', 1]] },
  { out: 'barra_ferro', cat: 'materiais', station: 'fornalha', needs: [['minerio', 2], ['carvao', 1]] },
  { out: 'carvao', n: 2, cat: 'materiais', station: 'fogueira', needs: [['madeira', 3]] },
  { out: 'pano', n: 2, cat: 'materiais', station: 'mao', needs: [['fibra', 4]] },

  // roupas e proteção
  { out: 'armadura', cat: 'roupas', station: 'bancada', level: 4, blueprint: true, needs: [['sucata', 10], ['corda', 3], ['pano', 4]] },
  { out: 'bracos', cat: 'roupas', station: 'bancada', level: 3, needs: [['sucata', 4], ['pano', 3], ['corda', 1]] },
  { out: 'caneleiras', cat: 'roupas', station: 'bancada', level: 3, needs: [['sucata', 5], ['pano', 3], ['corda', 1]] },
  { out: 'capacete_obra', cat: 'roupas', station: 'bancada', level: 5, needs: [['plastico', 4], ['sucata', 2], ['pano', 1]] },
];
RECIPES.forEach((r, i) => { r.id = r.out + (RECIPES.findIndex(q => q.out === r.out) === i ? '' : '_' + i); r.n = r.n || 1; r.level = r.level || 1; });

// ------------------------------------------------------------------
// Construções da base. kind: floor (piso, ocupa célula), wall (fica na borda da
// célula), object (móvel, ocupa célula). Custo sai do inventário e dos baús da base.
// tiers: evolução (parede de madeira → reforçada → pedra → avançada).
export const BUILD_CATS = [
  { id: 'estrutura', name: 'Estrutura', icon: '🧱' },
  { id: 'moveis', name: 'Móveis e estações', icon: '🛠️' },
];

export const STRUCTURES = {
  abrigo: { name: 'Abrigo improvisado', icon: '⛺', cat: 'moveis', kind: 'object', size: [2, 2], hp: 150, cost: [['madeira', 6], ['fibra', 4]], desc: 'Um teto de lona e galhos. Arthur renasce aqui se morrer.', bed: true },
  piso: { name: 'Piso', icon: '🟫', cat: 'estrutura', kind: 'floor', hp: 200, tiers: [
    { name: 'Piso de madeira', cost: [['madeira', 2]] },
    { name: 'Piso de pedra', cost: [['pedra', 3]] },
  ] },
  parede: { name: 'Parede', icon: '🧱', cat: 'estrutura', kind: 'wall', tiers: [
    { name: 'Parede de madeira', cost: [['madeira', 4]], hp: 150 },
    { name: 'Parede reforçada', cost: [['madeira', 4], ['prego', 6]], hp: 300, level: 2 },
    { name: 'Parede de pedra', cost: [['pedra', 8], ['madeira', 2]], hp: 600, level: 3 },
    { name: 'Parede avançada', cost: [['barra_ferro', 4], ['pedra', 4]], hp: 1200, level: 5 },
  ] },
  porta: { name: 'Porta', icon: '🚪', cat: 'estrutura', kind: 'wall', door: true, hp: 250, cost: [['madeira', 6], ['corda', 1]], desc: 'Abre e fecha. Zumbis não abrem portas.' },
  janela: { name: 'Janela', icon: '🪟', cat: 'estrutura', kind: 'wall', window: true, hp: 150, cost: [['madeira', 5]], desc: 'Deixa ver de fora sem deixar entrar.' },
  cerca: { name: 'Cerca de estacas', icon: '🪵', cat: 'estrutura', kind: 'wall', fence: true, hp: 120, cost: [['madeira', 3]], desc: 'Barreira baixa e barata.' },
  bau: { name: 'Baú', icon: '📦', cat: 'moveis', kind: 'object', size: [1, 1], hp: 150, cost: [['madeira', 6]], storage: 12, desc: 'Guarda 12 espaços de itens.' },
  armazem: { name: 'Armazenamento', icon: '🗄️', cat: 'moveis', kind: 'object', size: [1, 1], hp: 300, cost: [['madeira', 10], ['sucata', 4], ['prego', 6]], storage: 24, level: 3, desc: 'Armário de metal com 24 espaços.' },
  fogueira: { name: 'Fogueira', icon: '🔥', cat: 'moveis', kind: 'object', size: [1, 1], hp: 100, cost: [['madeira', 3], ['pedra', 3]], station: 'fogueira', light: true, desc: 'Cozinha, ferve água e ilumina a noite.' },
  bancada: { name: 'Bancada de trabalho', icon: '🛠️', cat: 'moveis', kind: 'object', size: [1, 1], hp: 200, cost: [['madeira', 8], ['pedra', 4]], station: 'bancada', desc: 'Libera ferramentas e armas melhores.' },
  fornalha: { name: 'Fornalha', icon: '🧱', cat: 'moveis', kind: 'object', size: [1, 1], hp: 300, cost: [['pedra', 12], ['madeira', 2]], station: 'fornalha', level: 3, light: true, desc: 'Derrete minério em barras de ferro.' },
  cama: { name: 'Cama', icon: '🛏️', cat: 'moveis', kind: 'object', size: [1, 2], hp: 150, cost: [['madeira', 6], ['pano', 4]], bed: true, level: 2, desc: 'Ponto de renascimento. Dormir passa a noite.' },
  oficina: { name: 'Oficina', icon: '🔧', cat: 'moveis', kind: 'object', size: [2, 1], hp: 300, cost: [['madeira', 10], ['sucata', 6], ['barra_ferro', 4], ['pecas', 2]], station: 'oficina', level: 5, desc: 'Fabrica munição e armas de fogo.' },
  medica: { name: 'Área médica', icon: '⚕️', cat: 'moveis', kind: 'object', size: [2, 1], hp: 200, cost: [['madeira', 6], ['pano', 6], ['remedio', 1]], station: 'medica', level: 4, desc: 'Fabrica remédios e kits médicos.' },
  coletor: { name: 'Coletor de chuva', icon: '🌧️', cat: 'moveis', kind: 'object', size: [1, 1], hp: 120, cost: [['madeira', 5], ['plastico', 3]], level: 2, collector: true, desc: 'Enche garrafas vazias com água limpa com o tempo.' },
};
for (const [id, s] of Object.entries(STRUCTURES)) { s.id = id; s.size = s.size || [1, 1]; s.level = s.level || 1; }

// custo, nome e vida de uma construção num certo nível de evolução
export function structTier(id, tier = 0) {
  const s = STRUCTURES[id];
  if (!s.tiers) return { name: s.name, cost: s.cost, hp: s.hp, level: s.level };
  const t = s.tiers[Math.min(tier, s.tiers.length - 1)];
  return { name: t.name, cost: t.cost, hp: t.hp || s.hp, level: t.level || 1 };
}
