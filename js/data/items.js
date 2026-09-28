// Todos os itens do jogo. Para criar um item novo basta acrescentar aqui.
//
// cat: recurso | comida | bebida | medico | arma | ferramenta | roupa | protecao | municao | especial
// slot (equipáveis): arma | cabeca | torso | pernas | pes | bracos | mochila
// use (consumíveis): fome, sede, vida, energia, doente (chance 0..1), devolve (item que sobra)
// weapon: kind melee|gun|bow, dmg, range, rate (s entre golpes), energy, noise (raio em m),
//         anim swing|stab|punch|pistol|rifle|bow, ammo, mag, reload (s), pellets, spread
// tool: poder de coleta { wood, stone, ore }
// model: forma do objeto na mão (js/entities/weapons.js)

export const ITEMS = {
  // ---------------- recursos ----------------
  madeira: { name: 'Madeira', icon: '🪵', cat: 'recurso', stack: 30, desc: 'Tábuas e galhos. Base de quase tudo que se constrói.' },
  pedra: { name: 'Pedra', icon: '🪨', cat: 'recurso', stack: 30, desc: 'Pedras soltas. Servem para ferramentas, fogueiras e paredes.' },
  minerio: { name: 'Minério de ferro', icon: '🟤', cat: 'recurso', stack: 20, desc: 'Precisa ser derretido numa fornalha.' },
  barra_ferro: { name: 'Barra de ferro', icon: '🔩', cat: 'recurso', stack: 20, desc: 'Metal limpo para ferramentas e armas melhores.' },
  sucata: { name: 'Sucata de metal', icon: '⚙️', cat: 'recurso', stack: 30, desc: 'Pedaços de metal tirados de carros e móveis.' },
  fibra: { name: 'Fibra vegetal', icon: '🌿', cat: 'recurso', stack: 30, desc: 'Capim trançável. Vira corda.' },
  corda: { name: 'Corda', icon: '🪢', cat: 'recurso', stack: 20, desc: 'Amarra cabos de ferramentas e armas.' },
  pano: { name: 'Pano', icon: '🧵', cat: 'recurso', stack: 30, desc: 'Retalhos de roupa e lençol.' },
  prego: { name: 'Pregos', icon: '📌', cat: 'recurso', stack: 50, desc: 'Reforçam construções e armas improvisadas.' },
  fita: { name: 'Fita adesiva', icon: '🩶', cat: 'recurso', stack: 10, desc: 'Conserta quase tudo.' },
  plastico: { name: 'Plástico', icon: '🧴', cat: 'recurso', stack: 20, desc: 'Lona e embalagens.' },
  polvora: { name: 'Pólvora', icon: '🧂', cat: 'recurso', stack: 30, desc: 'Tirada de fogos e cartuchos velhos. Faz munição.' },
  pecas: { name: 'Peças mecânicas', icon: '🔧', cat: 'recurso', stack: 20, desc: 'Molas, engrenagens e parafusos.' },
  gasolina: { name: 'Gasolina', icon: '⛽', cat: 'recurso', stack: 10, desc: 'Combustível. Ainda sem uso até o gerador ser montado.' },
  carvao: { name: 'Carvão', icon: '⚫', cat: 'recurso', stack: 30, desc: 'Restos da fogueira. Alimenta a fornalha.' },

  // ---------------- comida ----------------
  goiaba: { name: 'Goiaba', icon: '🍐', cat: 'comida', stack: 10, use: { fome: 14, sede: 4 }, desc: 'Do pé de goiaba. Mata um pouco a fome.' },
  banana: { name: 'Banana', icon: '🍌', cat: 'comida', stack: 10, use: { fome: 18, energia: 10 }, desc: 'Energia rápida.' },
  manga: { name: 'Manga', icon: '🥭', cat: 'comida', stack: 10, use: { fome: 16, sede: 8 }, desc: 'Doce e suculenta.' },
  enlatado: { name: 'Feijão enlatado', icon: '🥫', cat: 'comida', stack: 5, use: { fome: 35 }, desc: 'Comida de verdade. Dura para sempre.' },
  sardinha: { name: 'Lata de sardinha', icon: '🐟', cat: 'comida', stack: 5, use: { fome: 28, vida: 4 }, desc: 'Salgada, mas alimenta.' },
  biscoito: { name: 'Pacote de biscoito', icon: '🍪', cat: 'comida', stack: 5, use: { fome: 15, energia: 5 }, desc: 'Meio mole, mas serve.' },
  chocolate: { name: 'Barra de chocolate', icon: '🍫', cat: 'comida', stack: 5, use: { fome: 10, energia: 35 }, desc: 'Recupera muita energia.' },
  carne_crua: { name: 'Carne crua', icon: '🥩', cat: 'comida', stack: 10, use: { fome: 10, doente: 0.5, vida: -5 }, desc: 'Melhor assar na fogueira.' },
  carne_assada: { name: 'Carne assada', icon: '🍖', cat: 'comida', stack: 10, use: { fome: 40, vida: 10 }, desc: 'Alimenta bem e recupera vida.' },
  ensopado: { name: 'Ensopado', icon: '🍲', cat: 'comida', stack: 5, use: { fome: 55, sede: 15, vida: 20 }, desc: 'A melhor refeição do apocalipse.' },

  // ---------------- bebida ----------------
  garrafa_vazia: { name: 'Garrafa vazia', icon: '🍾', cat: 'recurso', stack: 5, desc: 'Encha no rio para carregar água.' },
  agua_suja: { name: 'Água do rio', icon: '💧', cat: 'bebida', stack: 5, use: { sede: 25, doente: 0.35, devolve: 'garrafa_vazia' }, desc: 'Pode fazer mal. Ferva na fogueira.' },
  agua_limpa: { name: 'Água fervida', icon: '🚰', cat: 'bebida', stack: 5, use: { sede: 35, devolve: 'garrafa_vazia' }, desc: 'Água segura para beber.' },
  agua_mineral: { name: 'Água mineral', icon: '🥛', cat: 'bebida', stack: 5, use: { sede: 40, devolve: 'garrafa_vazia' }, desc: 'Uma garrafa lacrada. Raridade.' },
  refrigerante: { name: 'Refrigerante', icon: '🥤', cat: 'bebida', stack: 5, use: { sede: 25, energia: 20 }, desc: 'Quente e sem gás. Ainda assim, uma festa.' },
  cantil: { name: 'Cantil (vazio)', icon: '🫙', cat: 'recurso', stack: 1, desc: 'Tem filtro de pano: a água que entra sai limpa. Encha no rio.' },
  cantil_cheio: { name: 'Cantil com água', icon: '🫗', cat: 'bebida', stack: 1, use: { sede: 45, devolve: 'cantil' }, desc: 'Água filtrada. Reutilizável.' },

  // ---------------- médico ----------------
  bandagem: { name: 'Bandagem', icon: '🩹', cat: 'medico', stack: 10, use: { vida: 20 }, desc: 'Estanca sangramentos. Atalho: Q.' },
  remedio: { name: 'Analgésico', icon: '💊', cat: 'medico', stack: 10, use: { vida: 12, cura: true }, desc: 'Alivia a dor e cura enjoo.' },
  cha: { name: 'Chá de ervas', icon: '🍵', cat: 'medico', stack: 5, use: { sede: 15, vida: 8, cura: true }, desc: 'Receita da vó. Cura enjoo.' },
  kit_medico: { name: 'Kit médico', icon: '🧰', cat: 'medico', stack: 3, use: { vida: 70, cura: true }, desc: 'Recupera muita vida.' },

  // ---------------- armas corpo a corpo ----------------
  punhos: { name: 'Punhos', icon: '✊', cat: 'arma', stack: 1, hidden: true, weapon: { kind: 'melee', dmg: 6, range: 1.35, rate: 0.55, energy: 2, noise: 6, anim: 'punch' } },
  faca_velha: { name: 'Faca enferrujada', icon: '🔪', cat: 'arma', slot: 'arma', stack: 1, dur: 60, model: 'faca', weapon: { kind: 'melee', dmg: 11, range: 1.45, rate: 0.5, energy: 3, noise: 6, anim: 'stab' }, desc: 'A única coisa que Arthur tinha no bolso.' },
  faca: { name: 'Faca de caça', icon: '🗡️', cat: 'arma', slot: 'arma', stack: 1, dur: 140, model: 'faca', weapon: { kind: 'melee', dmg: 18, range: 1.5, rate: 0.45, energy: 3, noise: 6, anim: 'stab' }, desc: 'Rápida e silenciosa.' },
  taco: { name: 'Taco de madeira', icon: '🏏', cat: 'arma', slot: 'arma', stack: 1, dur: 80, model: 'taco', weapon: { kind: 'melee', dmg: 17, range: 1.75, rate: 0.8, energy: 5, noise: 8, anim: 'swing', knock: 1.2 }, desc: 'Pesado, empurra os zumbis.' },
  taco_prego: { name: 'Taco com pregos', icon: '🏏', cat: 'arma', slot: 'arma', stack: 1, dur: 110, model: 'taco_prego', weapon: { kind: 'melee', dmg: 26, range: 1.75, rate: 0.8, energy: 5, noise: 8, anim: 'swing', knock: 1.3 }, desc: 'Arma improvisada e cruel.' },
  cano: { name: 'Cano de ferro', icon: '🦯', cat: 'arma', slot: 'arma', stack: 1, dur: 150, model: 'cano', weapon: { kind: 'melee', dmg: 21, range: 1.8, rate: 0.85, energy: 5, noise: 9, anim: 'swing', knock: 1.1 }, desc: 'Arma improvisada. Resistente.' },
  facao: { name: 'Facão', icon: '🗡️', cat: 'arma', slot: 'arma', stack: 1, dur: 180, model: 'facao', weapon: { kind: 'melee', dmg: 30, range: 1.7, rate: 0.65, energy: 4, noise: 7, anim: 'swing' }, tool: { wood: 1 }, desc: 'O facão da roça. Corta zumbi e mato.' },
  lanca: { name: 'Lança de madeira', icon: '🔱', cat: 'arma', slot: 'arma', stack: 1, dur: 70, model: 'lanca', weapon: { kind: 'melee', dmg: 20, range: 2.5, rate: 0.9, energy: 5, noise: 6, anim: 'stab' }, desc: 'Mantém os mortos longe.' },
  lanca_ferro: { name: 'Lança de ferro', icon: '🔱', cat: 'arma', slot: 'arma', stack: 1, dur: 160, model: 'lanca_ferro', weapon: { kind: 'melee', dmg: 32, range: 2.6, rate: 0.9, energy: 5, noise: 6, anim: 'stab' }, desc: 'Ponta de ferro forjada.' },

  // ---------------- ferramentas (também são armas) ----------------
  machado_pedra: { name: 'Machado de pedra', icon: '🪓', cat: 'ferramenta', slot: 'arma', stack: 1, dur: 70, model: 'machado_pedra', tool: { wood: 2 }, weapon: { kind: 'melee', dmg: 15, range: 1.65, rate: 0.85, energy: 5, noise: 8, anim: 'swing' }, desc: 'Corta árvores mais rápido.' },
  machado: { name: 'Machado de ferro', icon: '🪓', cat: 'ferramenta', slot: 'arma', stack: 1, dur: 200, model: 'machado', tool: { wood: 3 }, weapon: { kind: 'melee', dmg: 28, range: 1.7, rate: 0.85, energy: 5, noise: 8, anim: 'swing' }, desc: 'Ferramenta e arma de respeito.' },
  picareta_pedra: { name: 'Picareta de pedra', icon: '⛏️', cat: 'ferramenta', slot: 'arma', stack: 1, dur: 70, model: 'picareta_pedra', tool: { stone: 2, ore: 1 }, weapon: { kind: 'melee', dmg: 13, range: 1.65, rate: 0.9, energy: 5, noise: 9, anim: 'swing' }, desc: 'Quebra rochas grandes e minério.' },
  picareta: { name: 'Picareta de ferro', icon: '⛏️', cat: 'ferramenta', slot: 'arma', stack: 1, dur: 200, model: 'picareta', tool: { stone: 3, ore: 2 }, weapon: { kind: 'melee', dmg: 24, range: 1.7, rate: 0.9, energy: 5, noise: 9, anim: 'swing' }, desc: 'Minera muito mais rápido.' },
  pe_de_cabra: { name: 'Pé de cabra', icon: '🦯', cat: 'ferramenta', slot: 'arma', stack: 1, dur: 200, model: 'cano', tool: { scrap: 2 }, weapon: { kind: 'melee', dmg: 19, range: 1.7, rate: 0.8, energy: 4, noise: 8, anim: 'swing' }, desc: 'Desmonta carros e móveis com mais rendimento.' },

  // ---------------- armas de longo alcance ----------------
  arco: { name: 'Arco improvisado', icon: '🏹', cat: 'arma', slot: 'arma', stack: 1, dur: 90, model: 'arco', weapon: { kind: 'bow', dmg: 30, range: 16, rate: 1.1, energy: 4, noise: 4, anim: 'bow', ammo: 'flecha', mag: 1, reload: 0.5 }, desc: 'Silencioso. Usa flechas.' },
  pistola: { name: 'Pistola', icon: '🔫', cat: 'arma', slot: 'arma', stack: 1, dur: 250, model: 'pistola', weapon: { kind: 'gun', dmg: 34, range: 17, rate: 0.35, energy: 1, noise: 38, anim: 'pistol', ammo: 'bala_9mm', mag: 12, reload: 1.3, sound: 'gunPistol' }, desc: 'Barulhenta. Atrai zumbis por perto.' },
  espingarda: { name: 'Espingarda', icon: '🔫', cat: 'arma', slot: 'arma', stack: 1, dur: 200, model: 'espingarda', weapon: { kind: 'gun', dmg: 22, range: 11, rate: 0.95, energy: 2, noise: 50, anim: 'rifle', ammo: 'cartucho', mag: 2, reload: 1.8, pellets: 5, spread: 0.35, knock: 2.2, sound: 'gunShotgun' }, desc: 'Devastadora de perto.' },
  rifle: { name: 'Rifle de caça', icon: '🔫', cat: 'arma', slot: 'arma', stack: 1, dur: 250, model: 'rifle', weapon: { kind: 'gun', dmg: 85, range: 24, rate: 1.3, energy: 2, noise: 60, anim: 'rifle', ammo: 'bala_rifle', mag: 5, reload: 2.2, sound: 'gunRifle' }, desc: 'Um tiro, um zumbi a menos.' },

  // ---------------- munição ----------------
  flecha: { name: 'Flecha', icon: '➶', cat: 'municao', stack: 30, desc: 'Para o arco.' },
  bala_9mm: { name: 'Munição 9mm', icon: '🟡', cat: 'municao', stack: 60, desc: 'Para a pistola.' },
  cartucho: { name: 'Cartucho 12', icon: '🔴', cat: 'municao', stack: 30, desc: 'Para a espingarda.' },
  bala_rifle: { name: 'Munição de rifle', icon: '🟠', cat: 'municao', stack: 30, desc: 'Para o rifle de caça.' },

  // ---------------- roupas ----------------
  bone: { name: 'Boné', icon: '🧢', cat: 'roupa', slot: 'cabeca', stack: 1, dur: 60, stats: { def: 1 }, color: '#3b4f7a', desc: 'Protege do sol.' },
  camiseta: { name: 'Camiseta', icon: '👕', cat: 'roupa', slot: 'torso', stack: 1, dur: 60, stats: { def: 1 }, color: '#9aa3a8', desc: 'Básica.' },
  jaqueta: { name: 'Jaqueta de couro', icon: '🧥', cat: 'roupa', slot: 'torso', stack: 1, dur: 140, stats: { def: 5 }, color: '#4a3326', desc: 'Resiste a arranhões.' },
  calca: { name: 'Calça jeans', icon: '👖', cat: 'roupa', slot: 'pernas', stack: 1, dur: 100, stats: { def: 2 }, color: '#34507a', desc: 'Tecido grosso.' },
  tenis: { name: 'Tênis', icon: '👟', cat: 'roupa', slot: 'pes', stack: 1, dur: 80, stats: { def: 1, speed: 0.05 }, color: '#dddddd', desc: 'Leve. Corre mais.' },
  botas: { name: 'Botas', icon: '🥾', cat: 'roupa', slot: 'pes', stack: 1, dur: 160, stats: { def: 3 }, color: '#3a2a1c', desc: 'Firmes no barro.' },
  mochila_pequena: { name: 'Mochila escolar', icon: '🎒', cat: 'roupa', slot: 'mochila', stack: 1, stats: { slots: 4 }, color: '#2b2b33', desc: '+4 espaços no inventário.' },
  mochila_grande: { name: 'Mochila de trilha', icon: '🎒', cat: 'roupa', slot: 'mochila', stack: 1, stats: { slots: 8 }, color: '#4b5a2a', desc: '+8 espaços no inventário.' },

  // ---------------- proteção ----------------
  capacete_obra: { name: 'Capacete de obra', icon: '⛑️', cat: 'protecao', slot: 'cabeca', stack: 1, dur: 120, stats: { def: 5 }, color: '#e0b21e', desc: 'Protege a cabeça.' },
  capacete_moto: { name: 'Capacete de moto', icon: '🪖', cat: 'protecao', slot: 'cabeca', stack: 1, dur: 200, stats: { def: 8, speed: -0.02 }, color: '#202226', desc: 'Proteção total para a cabeça.' },
  armadura: { name: 'Armadura improvisada', icon: '🛡️', cat: 'protecao', slot: 'torso', stack: 1, dur: 200, stats: { def: 12, speed: -0.06 }, color: '#6e6a62', desc: 'Chapas de sucata amarradas. Pesada.' },
  colete: { name: 'Colete tático', icon: '🦺', cat: 'protecao', slot: 'torso', stack: 1, dur: 300, stats: { def: 16, speed: -0.02 }, color: '#3a4230', desc: 'Achado com a polícia. Excelente.' },
  bracos: { name: 'Braçadeiras', icon: '🧤', cat: 'protecao', slot: 'bracos', stack: 1, dur: 150, stats: { def: 4 }, color: '#5a5048', desc: 'Protege dos arranhões nos braços.' },
  caneleiras: { name: 'Caneleiras', icon: '🦵', cat: 'protecao', slot: 'pernas', stack: 1, dur: 150, stats: { def: 5, speed: -0.02 }, color: '#5a5048', desc: 'Protege as pernas das mordidas.' },

  // ---------------- especiais (história, esquemas, chaves) ----------------
  esquema_pistola: { name: 'Esquema: munição 9mm', icon: '📜', cat: 'especial', stack: 1, learn: 'bala_9mm', desc: 'Use para aprender a fazer munição 9mm.' },
  esquema_arco: { name: 'Esquema: arco', icon: '📜', cat: 'especial', stack: 1, learn: 'arco', desc: 'Use para aprender a fazer o arco e flechas.' },
  esquema_armadura: { name: 'Esquema: armadura', icon: '📜', cat: 'especial', stack: 1, learn: 'armadura', desc: 'Use para aprender a armadura improvisada.' },
  esquema_cartucho: { name: 'Esquema: cartuchos', icon: '📜', cat: 'especial', stack: 1, learn: 'cartucho', desc: 'Use para aprender a fazer cartuchos.' },
  cartao_acesso: { name: 'Crachá do posto de saúde', icon: '🪪', cat: 'especial', stack: 1, key: true, desc: 'Abre o portão do Posto de Saúde.' },
  alicate: { name: 'Alicate de corte', icon: '✂️', cat: 'especial', stack: 1, key: true, desc: 'Corta a corrente do portão da pedreira.' },
  pista_jornal: { name: 'Jornal "A Voz do Vale"', icon: '📰', cat: 'especial', stack: 1, key: true, lore: 'jornal', desc: 'Uma pista sobre o que aconteceu em Aimorés.' },
  pista_relatorio: { name: 'Relatório da farmácia', icon: '📋', cat: 'especial', stack: 1, key: true, lore: 'relatorio', desc: 'Uma pista sobre o que aconteceu em Aimorés.' },
  pista_diario: { name: 'Diário do vigia', icon: '📔', cat: 'especial', stack: 1, key: true, lore: 'diario', desc: 'Uma pista sobre o que aconteceu em Aimorés.' },
};

for (const [id, it] of Object.entries(ITEMS)) { it.id = id; it.stack = it.stack || 1; }

export const item = id => ITEMS[id];
export const SLOTS = ['arma', 'cabeca', 'torso', 'pernas', 'pes', 'bracos', 'mochila'];
export const SLOT_NAMES = { arma: 'Arma', cabeca: 'Cabeça', torso: 'Corpo', pernas: 'Pernas', pes: 'Pés', bracos: 'Braços', mochila: 'Mochila' };
export const CAT_NAMES = { recurso: 'Recurso', comida: 'Comida', bebida: 'Bebida', medico: 'Médico', arma: 'Arma', ferramenta: 'Ferramenta', roupa: 'Roupa', protecao: 'Proteção', municao: 'Munição', especial: 'Especial' };
