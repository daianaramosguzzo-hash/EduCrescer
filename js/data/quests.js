// Missões e história. Cada missão tem objetivos; quando todos são cumpridos a
// recompensa é entregue e as próximas missões começam.
//
// Tipos de objetivo:
//   have   { item, n }        ter o item no inventário
//   craft  { item, n }        fabricar
//   build  { struct, n }      construir na base
//   drink / eat               beber / comer qualquer coisa
//   visit  { poi }            chegar a um ponto do mapa
//   kill   { zombie?, n, poi? } matar zumbis (de um tipo / perto de um ponto)
//   loot   { container?, n }  vasculhar recipientes
//   rescue { who }            resgatar um sobrevivente (limpar a área e conversar)
//   level  { n }              chegar a um nível
//   lore   { items }          juntar pistas
// hint: dica mostrada no topo da tela · target: marcador na bússola

export const QUESTS = {
  sobreviva: {
    title: 'Sobreviva', main: true,
    desc: 'Arthur acordou sem nada. Antes de qualquer coisa, precisa do básico.',
    objectives: [
      { type: 'have', item: 'madeira', n: 5, text: 'Encontre madeira', hint: 'Encontre madeira: pegue galhos no chão ou corte árvores (botão COLETAR).', target: 'tree' },
      { type: 'craft', item: 'machado_pedra', n: 1, text: 'Construa uma ferramenta: machado de pedra', hint: 'Construa uma ferramenta: abra o CRAFTING (C) e faça um machado de pedra. Precisa de pedras.', target: 'stone' },
      { type: 'drink', text: 'Encontre água', hint: 'Encontre água: beba no rio ao sul ou ache garrafas nas casas.', target: 'water' },
      { type: 'eat', text: 'Encontre comida', hint: 'Encontre comida: frutas nos pés de goiaba e banana, ou latas nas casas.', target: 'food' },
      { type: 'build', struct: 'abrigo', n: 1, text: 'Construa um abrigo na base', hint: 'Construa um abrigo: abra CONSTRUÇÃO (B) dentro do terreno da base.', target: 'base' },
    ],
    reward: { xp: 150, items: [['enlatado', 2], ['bandagem', 2]] },
    next: ['escola', 'fortificar'],
    doneText: ['Um teto, uma ferramenta, água e comida. Dá para aguentar mais um dia.', 'A barricada de carros que fechava o caminho para o centro foi derrubada pela chuva da noite. O Centro de Aimorés está acessível.'],
  },
  fortificar: {
    title: 'Base segura', desc: 'Um abrigo não basta. Monte o essencial da base.',
    objectives: [
      { type: 'build', struct: 'fogueira', n: 1, text: 'Construa uma fogueira' },
      { type: 'build', struct: 'bau', n: 1, text: 'Construa um baú' },
      { type: 'build', struct: 'bancada', n: 1, text: 'Construa uma bancada de trabalho' },
      { type: 'build', struct: 'parede', n: 4, text: 'Levante 4 paredes' },
    ],
    reward: { xp: 120, items: [['prego', 12], ['corda', 2]] },
    next: [],
    doneText: ['A base começa a parecer um lar.'],
  },
  escola: {
    title: 'Encontre a escola', main: true,
    desc: 'No centro fica a Escola Estadual. Se alguém organizou um abrigo, deve ter sido lá.',
    objectives: [
      { type: 'visit', poi: 'escola', text: 'Chegue à Escola Estadual', hint: 'Vá até a Escola Estadual, no Centro de Aimorés.', target: 'poi:escola' },
      { type: 'loot', container: 'armario_escolar', n: 1, text: 'Vasculhe um armário da escola', target: 'poi:escola' },
    ],
    reward: { xp: 180, items: [['esquema_arco', 1]] },
    next: ['supermercado', 'carol'],
    doneText: ['Na lousa, em giz, uma mensagem: "Se alguém ler isso: estamos na igreja da praça. NÃO vão para o posto de saúde. — Carol"', 'Alguém sobreviveu. E sabe de alguma coisa.'],
  },
  carol: {
    title: 'Encontre outros sobreviventes: Carol', main: true,
    desc: 'A mensagem da lousa fala da igreja da praça.',
    objectives: [
      { type: 'visit', poi: 'igreja', text: 'Vá até a igreja da praça', target: 'poi:igreja' },
      { type: 'rescue', who: 'carol', text: 'Limpe a área e fale com Carol', target: 'poi:igreja' },
    ],
    reward: { xp: 250, unlockChar: 'carol' },
    next: ['verdade'],
    doneText: ['Carol vai para a base. Agora você pode trocar de personagem no menu 👥 SOBREVIVENTES, dentro da base.'],
  },
  supermercado: {
    title: 'Investigue o supermercado', main: true,
    desc: 'O Supermercado Bom Preço deve ter comida para semanas, se ninguém levou tudo.',
    objectives: [
      { type: 'visit', poi: 'supermercado', text: 'Entre no supermercado', target: 'poi:supermercado' },
      { type: 'loot', container: 'prateleira', n: 3, text: 'Vasculhe 3 prateleiras', target: 'poi:supermercado' },
      { type: 'kill', zombie: 'forte', n: 1, text: 'Derrote o Brutamontes do estoque', target: 'poi:supermercado' },
    ],
    reward: { xp: 260, items: [['enlatado', 3], ['agua_mineral', 2]] },
    next: ['daiana'],
    doneText: ['No estoque, um recado preso num rádio: "Oficina da Daiana, na avenida. Tem gasolina e ferramentas. Tragam munição."'],
  },
  verdade: {
    title: 'Descubra o que aconteceu em Aimorés', main: true,
    desc: 'Carol fala de um "lote de vacina" que chegou pelo trem. Junte as pistas.',
    objectives: [
      { type: 'lore', items: ['pista_jornal', 'pista_relatorio', 'pista_diario'], text: 'Junte 3 pistas (banca da praça, farmácia e estação)', target: 'lore' },
    ],
    reward: { xp: 300, items: [['cartao_acesso', 1]] },
    next: ['posto'],
    doneText: ['As pistas contam a mesma história: o trem trouxe caixas lacradas para o posto de saúde. Três dias depois, a cidade caiu.', 'Carol entrega um crachá do posto de saúde. "Se for mesmo lá, vá preparado."'],
  },
  daiana: {
    title: 'A mecânica da avenida', main: true,
    desc: 'O recado do rádio fala da oficina da Daiana, na avenida do posto.',
    objectives: [
      { type: 'level', n: 4, text: 'Chegue ao nível 4' },
      { type: 'visit', poi: 'oficina', text: 'Vá até a oficina da avenida', target: 'poi:oficina' },
      { type: 'rescue', who: 'daiana', text: 'Limpe a área e fale com Daiana', target: 'poi:oficina' },
    ],
    reward: { xp: 300, unlockChar: 'daiana', items: [['esquema_armadura', 1]] },
    next: ['pablicio'],
    doneText: ['Daiana vai para a base com suas ferramentas.', 'Ela comenta: "Tem um fazendeiro teimoso na Boa Vista que não quis sair de lá..."'],
  },
  pablicio: {
    title: 'O homem do campo', main: true,
    desc: 'Na Fazenda Boa Vista, alguém ainda resiste.',
    objectives: [
      { type: 'level', n: 5, text: 'Chegue ao nível 5' },
      { type: 'visit', poi: 'celeiro', text: 'Chegue ao celeiro da fazenda', target: 'poi:celeiro' },
      { type: 'rescue', who: 'pablicio', text: 'Limpe a área e fale com Pablício', target: 'poi:celeiro' },
    ],
    reward: { xp: 350, unlockChar: 'pablicio', items: [['alicate', 1]] },
    next: [],
    doneText: ['Pablício se junta à comunidade.', 'Ele entrega um alicate de corte: "A corrente da pedreira não vai segurar vocês. Mas o que tem lá dentro..."'],
  },
  posto: {
    title: 'O Posto de Saúde', main: true,
    desc: 'Com o crachá, o portão do posto abre. É onde tudo começou.',
    objectives: [
      { type: 'level', n: 6, text: 'Chegue ao nível 6' },
      { type: 'visit', poi: 'posto_saude', text: 'Entre no Posto de Saúde', target: 'poi:posto_saude' },
      { type: 'kill', zombie: 'enfermeiro', n: 1, text: 'Derrote O Plantonista', target: 'poi:posto_saude' },
    ],
    reward: { xp: 500, items: [['kit_medico', 2], ['colete', 1]] },
    next: ['colosso'],
    doneText: ['Na sala de vacinas, um freezer desligado e um bilhete: "O lote veio da pedreira. O que estava lá dentro não era remédio."'],
  },
  colosso: {
    title: 'O Colosso da pedreira', main: true,
    desc: 'O último elo da história está na Pedreira Velha.',
    objectives: [
      { type: 'level', n: 7, text: 'Chegue ao nível 7' },
      { type: 'visit', poi: 'pedreira', text: 'Entre na Pedreira Velha', target: 'poi:pedreira' },
      { type: 'kill', zombie: 'chefe', n: 1, text: 'Derrote O Colosso', target: 'poi:pedreira' },
    ],
    reward: { xp: 1000, items: [['rifle', 1], ['bala_rifle', 15]] },
    next: [],
    doneText: ['O Colosso caiu. Aimorés ainda está tomada, mas agora vocês sabem de onde veio o mal.', 'CONTINUA... (novas áreas e capítulos virão nas próximas versões)'],
  },
};
for (const [id, q] of Object.entries(QUESTS)) q.id = id;
export const FIRST_QUEST = 'sobreviva';

// Textos das pistas (lidos ao pegar o item)
export const LORE = {
  jornal: { title: 'A Voz do Vale — edição extra', text: '"VACINA CHEGA PELO TREM: o posto de saúde de Aimorés recebe lote experimental contra a febre do Vale. Prefeitura garante: é seguro."' },
  relatorio: { title: 'Relatório da farmácia', text: '"Dia 3: todos os vacinados com febre alta. Dia 4: agressividade, não reconhecem familiares. Dia 5: fechamos as portas. Que Deus nos ajude."' },
  diario: { title: 'Diário do vigia da estação', text: '"As caixas vieram num vagão lacrado, com escolta. Não eram da prefeitura. Carregaram tudo para o posto e um caminhão levou o resto para a pedreira."' },
};

// Falas dos sobreviventes resgatados e na base
export const TALK = {
  carol: {
    rescue: ['Graças a Deus! Achei que ninguém mais ia aparecer.', 'Eu sou a Carol, enfermeira do posto. Vi os primeiros casos... começou com a vacina.', 'Vou com você para a sua base. Lá eu cuido dos ferimentos de todo mundo.'],
    base: ['Descanse um pouco. Ferida mal cuidada vira infecção.', 'Se for sair, leve bandagens. Sempre.', 'Ainda sonho com o posto de saúde...'],
  },
  daiana: {
    rescue: ['Opa! Pensei que era mais um deles batendo na porta.', 'Daiana, mecânica. Se tiver sucata, eu faço funcionar.', 'Sua base tem bancada? Então é para lá que eu vou.'],
    base: ['Dá para reforçar essas paredes com pregos, sabia?', 'Sucata é ouro. Traz tudo que achar nos carros.', 'Um dia ainda faço aquele caminhão do posto andar.'],
  },
  pablicio: {
    rescue: ['Rapaz, você tem coragem de vir até aqui.', 'Pablício. Essa fazenda é do meu pai, do meu avô... mas sozinho não dá mais.', 'Vou com vocês. Mas quando der, eu volto para plantar.'],
    base: ['Com uma horta aqui a gente não passava fome.', 'Facão bem afiado resolve muita coisa.', 'Na roça a gente acorda antes do sol. Bora trabalhar!'],
  },
  arthur: {
    base: ['Um dia de cada vez.', 'Ainda tem muita coisa para descobrir em Aimorés.', 'A gente vai sair dessa.'],
  },
};
