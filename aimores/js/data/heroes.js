// Os quatro protagonistas: atributos, habilidades próprias, equipamento inicial e biografias.
// atributos de 1 a 10: forca, velocidade, precisao, resistencia, furtividade, inteligencia, sorte

export const STAT_NAMES = {
  forca: 'Força', velocidade: 'Velocidade', precisao: 'Precisão', resistencia: 'Resistência',
  furtividade: 'Furtividade', inteligencia: 'Inteligência', sorte: 'Sorte',
};
export const STAT_DESC = {
  forca: 'Dano corpo a corpo, capacidade de carga e arrombar portas.',
  velocidade: 'Fôlego: quanto o personagem faz antes de os zumbis agirem.',
  precisao: 'Chance de acerto, principalmente à distância.',
  resistencia: 'Vida máxima, resistência a infecção e a mordidas.',
  furtividade: 'Passar despercebido pelos zumbis e ataques surpresa.',
  inteligencia: 'Visão, vasculhar melhor e experiência ganha.',
  sorte: 'Acertos críticos e itens melhores.',
};

export const HEROES = {
  arthur: {
    id: 'arthur', nome: 'Arthur', apelido: 'Tutu', look: 'arthur', cor: '#f0a040',
    retrato: 'assets/retratos/arthur.png', arte: 'assets/arte/arthur.webp',
    papel: 'Batedor furtivo',
    bio: 'O mais novo da turma. Rápido, silencioso e dono de um conhecimento enciclopédico de jogos de zumbi que, finalmente, serve para alguma coisa. Não tira a jaqueta marrom nem no calor de Aimorés.',
    hp: 70,
    stats: { forca: 3, velocidade: 9, precisao: 7, resistencia: 4, furtividade: 9, inteligencia: 6, sorte: 8 },
    skills: ['sumir', 'olho_gamer', 'estilingada'],
    eq: { mao: 'estilingue', costas: 'mochila' },
    inv: [['pedrinhas', 18], ['chocolate', 1], ['biscoito', 1]],
  },
  carol: {
    id: 'carol', nome: 'Carol', apelido: 'Carol', look: 'carol', cor: '#3fc8b0',
    retrato: 'assets/retratos/carol.png', arte: 'assets/arte/carol.webp',
    papel: 'Cuidadora do grupo',
    bio: 'Calma, fé inabalável e mãos que cuidam. Quando todo mundo entra em pânico, é a Carol quem lembra de respirar, de beber água e de não deixar ninguém para trás. Enfrenta o apocalipse de chinelo.',
    hp: 85,
    stats: { forca: 5, velocidade: 5, precisao: 5, resistencia: 8, furtividade: 5, inteligencia: 7, sorte: 6 },
    skills: ['maos_que_curam', 'fe_inabalavel', 'coracao_acolhedor'],
    eq: { mao: 'faca' },
    inv: [['atadura', 2], ['dipirona', 2], ['agua', 1], ['chinelo', 1]],
  },
  daiana: {
    id: 'daiana', nome: 'Daiana', apelido: 'Dai', look: 'daiana', cor: '#4a8aff',
    retrato: 'assets/retratos/daiana.png', arte: 'assets/arte/daiana.webp',
    papel: 'Líder e estrategista',
    bio: 'Professora da Escola Estadual Rio Doce. Organiza a fuga do apocalipse como organiza uma feira de ciências: com lista, cronograma e voz de comando. Conhece a cidade inteira, e a cidade inteira conhece a Daiana.',
    hp: 80,
    stats: { forca: 5, velocidade: 6, precisao: 7, resistencia: 6, furtividade: 6, inteligencia: 9, sorte: 6 },
    skills: ['voz_de_comando', 'plano_de_aula', 'negociadora'],
    eq: { mao: 'taco', mao2: 'lanterna' },
    inv: [['agua', 1], ['cafe', 1]],
  },
  pablicio: {
    id: 'pablicio', nome: 'Pablício', apelido: 'Pabli', look: 'pablicio', cor: '#8ad040',
    retrato: 'assets/retratos/pablicio.png', arte: 'assets/arte/pablicio.webp',
    papel: 'Força bruta e gambiarras',
    bio: 'Forte como um touro e nervoso como um chihuahua. Entende de motor, de gambiarra e de monstros de videogame. Sua mais que qualquer um em Aimorés, o que, em Aimorés, é um feito.',
    hp: 110,
    stats: { forca: 9, velocidade: 4, precisao: 4, resistencia: 8, furtividade: 2, inteligencia: 6, sorte: 4 },
    skills: ['surto', 'mao_na_graxa', 'couro_grosso'],
    eq: { mao: 'martelo' },
    inv: [['fita', 1], ['biscoito', 2], ['refri', 1]],
  },
};
export const HERO_ORDER = ['arthur', 'carol', 'daiana', 'pablicio'];

// ------------------------------------------------------------ habilidades (níveis 1 a 3)
export const SKILLS = {
  sumir: { nome: 'Sombra Mirim', hero: 'arthur', ativa: true, pa: 1, recarga: [5, 4, 3], icon: '🥷',
    desc: r => `Ativa: some das vistas na hora, mesmo sem esconderijo, se nenhum inimigo estiver colado. Recarga de ${[5, 4, 3][r - 1]} rodadas. Passiva: +${r} de Furtividade.` },
  olho_gamer: { nome: 'Olho de Gamer', hero: 'arthur', icon: '🎮',
    desc: r => `Passiva: destaca móveis com itens num raio de ${[6, 8, 10][r - 1]} casas e dá ${[10, 20, 30][r - 1]}% de chance de achar um item a mais ao vasculhar.` },
  estilingada: { nome: 'Estilingada Certeira', hero: 'arthur', icon: '🎯',
    desc: r => `Passiva: +${[15, 25, 35][r - 1]}% de precisão com estilingue e arremessos.${r >= 2 ? ' A primeira pedrada de cada rodada sempre atordoa.' : ''}${r >= 3 ? ' Distrações vão duas vezes mais longe.' : ''}` },
  maos_que_curam: { nome: 'Mãos que Curam', hero: 'carol', icon: '🩹',
    desc: r => `Passiva: medicamentos curam ${[30, 60, 90][r - 1]}% a mais e são aplicados mais rápido.${r >= 3 ? ' Levanta um aliado caído bem mais rápido.' : ''}` },
  fe_inabalavel: { nome: 'Fé Inabalável', hero: 'carol', ativa: true, pa: 2, recarga: [6, 5, 4], icon: '🙏',
    desc: r => `Ativa: palavra de ânimo, +${[15, 25, 35][r - 1]} de moral para quem estiver a até 5 casas e fim do pânico. Passiva: o moral da Carol cai pela metade.` },
  coracao_acolhedor: { nome: 'Coração Acolhedor', hero: 'carol', icon: '💛',
    desc: r => `Passiva: +${[10, 20, 30][r - 1]} em acalmar e convencer pessoas. Libera respostas [Acolher] nas conversas.` },
  voz_de_comando: { nome: 'Voz de Comando', hero: 'daiana', ativa: true, pa: 2, recarga: [1, 1, 1], icon: '📣',
    desc: r => `Ativa: "Organiza a turma!" Um aliado a até 6 casas ganha fôlego extra (+${[2, 3, 4][r - 1]}): faz mais coisas antes de os zumbis agirem. Uma vez por rodada.` },
  plano_de_aula: { nome: 'Plano de Aula', hero: 'daiana', icon: '📋',
    desc: r => `Passiva: vasculha mais rápido.${r >= 2 ? ' Ao entrar num prédio, a planta dele aparece no mapa.' : ''}${r >= 3 ? ' O grupo ganha 10% a mais de experiência.' : ''}` },
  negociadora: { nome: 'Negociadora', hero: 'daiana', icon: '🤝',
    desc: r => `Passiva: trocas ${[15, 25, 35][r - 1]}% melhores e respostas [Negociar] nas conversas.${r >= 3 ? ' Pode convencer humanos hostis a recuar.' : ''}` },
  surto: { nome: 'Surto Nervoso', hero: 'pablicio', ativa: true, pa: 0, recarga: [8, 7, 6], icon: '😤',
    desc: r => `Ativa: fôlego extra (+${[3, 4, 5][r - 1]}) e +50% de dano corpo a corpo nesta rodada. Depois, −15 de moral e de energia. Passiva: com menos de 40% de vida, +25% de dano.` },
  mao_na_graxa: { nome: 'Mão na Graxa', hero: 'pablicio', icon: '🔧',
    desc: r => `Passiva: abre fechaduras sem barulho, conserta veículos, geradores e rádios e barrica mais rápido.${r >= 2 ? ' Armas brancas gastam metade da durabilidade.' : ''}${r >= 3 ? ' Improvisa peças com sucata.' : ''}` },
  couro_grosso: { nome: 'Couro Grosso', hero: 'pablicio', ativa: true, pa: 1, recarga: [3, 3, 2], icon: '🛡️',
    desc: r => `Passiva: −${[10, 20, 30][r - 1]}% de dano recebido. Ativa: "Pode vir!" Zumbis próximos passam a atacar o Pablício nesta rodada.` },
};

// ------------------------------------------------------------ vantagens (escolhidas a cada 2 níveis)
export const PERKS = {
  pe_leve: { nome: 'Pé Leve', desc: 'Correr não faz barulho extra.' },
  mao_firme: { nome: 'Mão Firme', desc: '+10% de precisão com armas de fogo.' },
  estomago: { nome: 'Estômago de Avestruz', desc: 'Comida e bebida rendem 30% a mais.' },
  sangue_frio: { nome: 'Sangue Frio', desc: 'O moral não cai ao ver zumbis ou mortes.' },
  mula: { nome: 'Mula de Carga', desc: '+6 kg de capacidade.' },
  maratonista: { nome: 'Maratonista', desc: 'Mais fôlego: faz mais coisas antes de os zumbis agirem.' },
  acougueiro: { nome: 'Braço Pesado', desc: '+2 de dano corpo a corpo.' },
  olho_vivo: { nome: 'Olho Vivo', desc: '+2 casas de visão.' },
  labia: { nome: 'Lábia', desc: '+15 em testes de conversa.' },
  casca_grossa: { nome: 'Casca Grossa', desc: '+15 de vida máxima.' },
  sortudo: { nome: 'Nasceu Virado pra Lua', desc: '+2 de Sorte.' },
  socorrista: { nome: 'Socorrista', desc: 'Medicamentos curam 25% a mais.' },
  noturno: { nome: 'Coruja', desc: 'Enxerga 2 casas a mais no escuro.' },
  imune: { nome: 'Sistema Imunológico de Ferro', desc: 'A infecção avança 30% mais devagar.' },
};

export const XP_LEVELS = [0, 100, 250, 460, 720, 1040, 1420, 1880, 2420, 3050, 3800];
