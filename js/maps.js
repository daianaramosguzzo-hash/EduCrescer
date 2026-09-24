// Mapas, personagens e roteiro da aventura.
// Legenda: . grama  , caminho  G mato alto  T árvore  W água  F cerca  f flores  S placa  = areia
// Interiores: # parede  _ piso  C balcão

const STARTER_BEATS = { brasito: 'pingolote', pingolote: 'capibroto', capibroto: 'brasito' };
export const STARTER_LINE = {
  brasito: ['brasito', 'flamaposa', 'vulcaposa'],
  pingolote: ['pingolote', 'marolote', 'tsunamolote'],
  capibroto: ['capibroto', 'capifolha', 'capiflora'],
};

function room(w, h, exitX) {
  const rows = [];
  for (let z = 0; z < h; z++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      if (z === h - 1 && x === exitX) r += '_';
      else r += (x === 0 || z === 0 || x === w - 1 || z === h - 1) ? '#' : '_';
    }
    rows.push(r);
  }
  return rows;
}

// Centro Crescemon e Loja (reutilizados em cada cidade)
function centro(id, city, back) {
  return {
    id, name: `Centro Crescemon de ${city}`, interior: true, floor: 'tile', music: 'center',
    rows: room(11, 9, 5).map((r, z) => z === 3 ? '#__CCCCC__#' : r),
    exit: { x: 5, z: 8, ...back },
    furniture: [
      { type: 'machine', x: 7, z: 1, w: 2, d: 1 }, { type: 'pc', x: 1, z: 1, w: 1, d: 1 },
      { type: 'plant', x: 9, z: 7 }, { type: 'plant', x: 1, z: 7 }, { type: 'bench', x: 8, z: 5, w: 2, d: 1 },
    ],
    npcs: [
      { id: 'enf', x: 5, z: 2, dir: 'down', look: 'enfermeira', talk: async G => {
        await G.say('Bem-vindo ao Centro Crescemon! Aqui cuidamos dos seus Crescemon até ficarem 100%.', 'Enfermeira Clara');
        const r = await G.ask('Quer que eu cuide dos seus Crescemon?', ['Sim', 'Não']);
        if (r === 0) {
          G.state.lastCenter = { map: id, x: 5, z: 4 };
          await G.healScene();
          await G.say('Pronto! Seus Crescemon estão totalmente recuperados. Volte sempre!', 'Enfermeira Clara');
        } else await G.say('Volte quando precisar!', 'Enfermeira Clara');
      } },
      { id: 'visit', x: 2, z: 5, dir: 'right', look: 'garota', talk: async G => {
        await G.say('O computador ali no canto guarda os Crescemon que não cabem na sua equipe. Você pode levar até 6!');
      } },
    ],
    pcs: [{ x: 1, z: 1 }],
  };
}

function loja(id, city, back) {
  return {
    id, name: `Loja de ${city}`, interior: true, floor: 'wood', music: 'center',
    rows: room(9, 8, 4).map((r, z) => z === 3 ? '#CCC____#' : r),
    exit: { x: 4, z: 7, ...back },
    furniture: [
      { type: 'shelf', x: 5, z: 1, w: 3, d: 1 }, { type: 'shelf', x: 6, z: 4, w: 2, d: 1 }, { type: 'plant', x: 7, z: 6 },
    ],
    npcs: [
      { id: 'vend', x: 2, z: 2, dir: 'down', look: 'vendedor', talk: async G => {
        if (id === 'loja1' && !G.flag('encomenda')) {
          await G.say('Olá! Você veio de Vila Aurora? Que sorte!', 'Vendedor');
          await G.say('Chegou uma encomenda para o Prof. Ipê. Pode levar para ele, por favor?', 'Vendedor');
          G.set('encomenda');
          G.giveItem('encomenda', 1);
          await G.say('{N} recebeu a ENCOMENDA do Prof. Ipê!');
          return;
        }
        await G.say('Bem-vindo! Posso ajudar?', 'Vendedor');
        const list = ['pocao'];
        if (G.flag('dex')) list.push('orbe');
        if (G.hasBadge('rocha')) list.push('superpocao', 'superorbe');
        if (G.hasBadge('mare') || G.flag('floresta_ok')) list.push('reviver', 'elixir');
        await G.shop(list);
        await G.say('Obrigado! Volte sempre!', 'Vendedor');
      } },
    ],
  };
}

async function rivalWalkIn(G, npcId, steps) {
  const r = G.npc(npcId);
  r.show();
  await r.walk(steps);
}

export const MAPS = {
  // ------------------------------------------------------------ CASA
  casa: {
    name: 'Sua Casa', interior: true, floor: 'wood', music: 'home',
    rows: room(9, 8, 4),
    exit: { x: 4, z: 7, to: 'aurora', tx: 5, tz: 7 },
    furniture: [
      { type: 'table', x: 4, z: 3, w: 2, d: 1 }, { type: 'tv', x: 1, z: 1, w: 1, d: 1 },
      { type: 'bed', x: 7, z: 1, w: 1, d: 2 }, { type: 'shelf', x: 3, z: 1, w: 2, d: 1 },
      { type: 'plant', x: 1, z: 6 }, { type: 'plant', x: 7, z: 6 }, { type: 'rug', x: 3, z: 5, w: 3, d: 1, walk: true },
    ],
    signs: [{ x: 1, z: 1, text: 'Está passando um programa sobre Crescemon na TV. Um treinador atravessa uma ponte com seu parceiro... Parece a hora de você começar a sua jornada!' }],
    npcs: [
      { id: 'mae', x: 6, z: 3, dir: 'left', look: 'mae', talk: async G => {
        if (G.flag('campeao')) {
          await G.say('Meu filho, o CAMPEÃO da Liga! Eu sempre soube. Descanse um pouco...', 'Mãe');
          G.healParty();
          await G.say('Seus Crescemon estão descansados!');
        } else if (!G.flag('starter')) {
          await G.say('Bom dia, {N}! Todo mundo sai de casa algum dia. É o que dizem na TV.', 'Mãe');
          await G.say('O Prof. Ipê, aqui do lado, estava procurando você. Vá lá!', 'Mãe');
        } else {
          await G.say('{N}, você está com uma carinha cansada. Descanse um pouco!', 'Mãe');
          G.healParty();
          await G.say('Seus Crescemon estão totalmente recuperados!');
          await G.say('Tome cuidado lá fora. E lembre-se: crescer é um passo de cada vez!', 'Mãe');
        }
      } },
    ],
  },

  // ------------------------------------------------------------ VILA AURORA
  aurora: {
    name: 'Vila Aurora', music: 'town', bg: 'grass',
    rows: [
      'TTTTTTTTTT,,TTTTTTTTTT',
      'TTTTTTTTTT,,TTTTTTTTTT',
      'TT..f.....,,.....f..TT',
      'TT........,,........TT',
      'TT........,,........TT',
      'TT........,,........TT',
      'TT........,,........TT',
      'TT..,,,,,,,,,,,,,,..TT',
      'TT......S.,,........TT',
      'TT........,,........TT',
      'TT.f......,,........TT',
      'TT........,,........TT',
      'TT........,,........TT',
      'TT.......,,,,,,,,.S.TT',
      'TT..f....,,.....f...TT',
      'TTFFFFF..,,.........TT',
      'TTWWWWF..,,...f.....TT',
      'TTWWWWF.............TT',
      'TTWWWWW....f........TT',
      'TTTTTTTTTTTTTTTTTTTTTT',
    ],
    buildings: [
      { x: 3, z: 3, w: 5, d: 4, style: 'house', door: 2, to: 'casa', roof: '#d84a3a' },
      { x: 13, z: 3, w: 5, d: 4, style: 'house', door: 2, to: 'casa_rival', roof: '#3a6ad0' },
      { x: 12, z: 9, w: 7, d: 4, style: 'lab', door: 2, to: 'lab', label: 'LAB' },
    ],
    signs: [
      { x: 8, z: 8, text: 'VILA AURORA — Onde tudo começa a crescer.' },
      { x: 18, z: 13, text: 'LABORATÓRIO CRESCEMON do Prof. Ipê.' },
    ],
    warps: [
      { x: 10, z: 0, to: 'rota1', tx: 10, tz: 28, dir: 'up' },
      { x: 11, z: 0, to: 'rota1', tx: 11, tz: 28, dir: 'up' },
    ],
    npcs: [
      { id: 'moca', x: 6, z: 11, dir: 'down', look: 'garota', wander: true, talk: async G => {
        await G.say('Estou aprendendo sobre tecnologia! Sabia que os Crescemon ficam mais fortes quanto mais batalham juntos com seu treinador?');
      } },
      { id: 'gordo', x: 16, z: 15, dir: 'left', look: 'garoto', wander: true, talk: async G => {
        await G.say('Tipos importam! FOGO vence PLANTA, PLANTA vence ÁGUA e ÁGUA vence FOGO. Nunca esqueça!');
      } },
      { id: 'prof_fora', x: 10, z: 9, dir: 'up', look: 'prof', hidden: true },
    ],
    triggers: [
      { x: 10, z: 2, cond: G => !G.flag('starter'), run: profStop },
      { x: 11, z: 2, cond: G => !G.flag('starter'), run: profStop },
    ],
  },

  casa_rival: {
    name: 'Casa do Gael', interior: true, floor: 'wood', music: 'home',
    rows: room(9, 8, 4),
    exit: { x: 4, z: 7, to: 'aurora', tx: 15, tz: 7 },
    furniture: [
      { type: 'table', x: 3, z: 3, w: 3, d: 1 }, { type: 'shelf', x: 1, z: 1, w: 3, d: 1 },
      { type: 'plant', x: 7, z: 1 }, { type: 'rug', x: 3, z: 5, w: 3, d: 1, walk: true },
    ],
    npcs: [
      { id: 'lia', x: 6, z: 3, dir: 'left', look: 'lia', talk: async G => {
        if (!G.flag('starter')) {
          await G.say('Oi, {N}! O Gael saiu cedinho para o laboratório do vovô. Ele estava tão ansioso!', 'Lia');
        } else {
          await G.say('Oi, {N}! Seus Crescemon parecem cansados. Deixa eu ajudar!', 'Lia');
          G.healParty();
          await G.say('Seus Crescemon estão prontos para continuar!');
          await G.say('Meu irmão vive dizendo que vai ser o melhor treinador do mundo... Mas acho que você pode surpreendê-lo!', 'Lia');
        }
      } },
    ],
  },

  // ------------------------------------------------------------ LAB
  lab: {
    name: 'Laboratório do Prof. Ipê', interior: true, floor: 'tile', music: 'lab',
    rows: room(11, 10, 5),
    exit: { x: 5, z: 9, to: 'aurora', tx: 14, tz: 13 },
    furniture: [
      { type: 'shelf', x: 1, z: 1, w: 3, d: 1 }, { type: 'shelf', x: 7, z: 1, w: 3, d: 1 },
      { type: 'table', x: 6, z: 3, w: 3, d: 1 }, { type: 'pc', x: 1, z: 4, w: 1, d: 1 },
      { type: 'machine', x: 1, z: 5, w: 1, d: 1 }, { type: 'plant', x: 9, z: 8 }, { type: 'plant', x: 1, z: 8 },
      { type: 'table', x: 8, z: 6, w: 2, d: 1 },
    ],
    signs: [{ x: 1, z: 4, text: 'Há um e-mail aberto: "Pesquisa sobre a ave lendária SOLARIS — dizem que aparece para quem vence a Liga..."' }],
    npcs: [
      { id: 'prof', x: 5, z: 1, dir: 'down', look: 'prof', talk: profTalk },
      { id: 'rival', x: 4, z: 3, dir: 'down', look: 'rival', cond: G => G.flag('metProf') && !G.flag('rival1'), talk: async G => {
        if (!G.flag('starter')) await G.say('Hehe, vai logo escolher! Eu já sei qual vou pegar!', 'Gael');
        else await G.say('Meu Crescemon parece bem mais forte que o seu!', 'Gael');
      } },
      { id: 'ajud', x: 8, z: 7, dir: 'up', look: 'garoto', talk: async G => {
        await G.say('Eu sou assistente do Prof. Ipê! Estamos estudando como os Crescemon evoluem quando treinam bastante.');
      } },
      ...['brasito', 'pingolote', 'capibroto'].map((sp, i) => ({
        id: 'orb_' + sp, x: 6 + i, z: 3, dir: 'down', orb: true,
        cond: G => G.state.starter !== sp && G.state.rivalStarter !== sp,
        talk: G => pickStarter(G, sp, 6 + i),
      })),
    ],
    triggers: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(x => ({ x, z: 7, cond: G => G.flag('starter') && !G.flag('rival1'), run: rivalBattle1 })),
  },

  // ------------------------------------------------------------ ROTA 1
  rota1: {
    name: 'Rota 1', music: 'route', bg: 'grass',
    rows: [
      'TTTTTTTTT,,TTTTTTTTT',
      'TTTTTTTTT,,TTTTTTTTT',
      'TT.......,,GGGG...TT',
      'TT..GGG..,,GGGG...TT',
      'TT..GGG..,,GGGG...TT',
      'TT..GGG..,,.......TT',
      'TT.......,,....f..TT',
      'TT..,,,,,,,.......TT',
      'TT..,.....TTTT....TT',
      'TT..,.GGG.TTTT.GG.TT',
      'TT..,.GGG......GG.TT',
      'TT..,.GGG......GG.TT',
      'TT..,,,,,,,,,,,,..TT',
      'TT.............,..TT',
      'TTGGGG.........,..TT',
      'TTGGGG..f......,..TT',
      'TTGGGG.........,..TT',
      'TT.......,,,,,,,..TT',
      'TT.......,........TT',
      'TT...TTT.,..GGGG..TT',
      'TT...TTT.,..GGGG..TT',
      'TT.......,..GGGG..TT',
      'TT..GGG..,........TT',
      'TT..GGG..,,,......TT',
      'TT..GGG....,..S...TT',
      'TT.........,......TT',
      'TT.........,,.....TT',
      'TT..........,,....TT',
      'TT...........,....TT',
      'TTTTTTTTTT,,TTTTTTTT',
    ],
    signs: [{ x: 14, z: 24, text: 'ROTA 1 — Vila Aurora ↔ Pedra-Verde.' }],
    warps: [
      { x: 10, z: 29, to: 'aurora', tx: 10, tz: 1, dir: 'down' },
      { x: 11, z: 29, to: 'aurora', tx: 11, tz: 1, dir: 'down' },
      { x: 9, z: 0, to: 'pedraverde', tx: 12, tz: 22, dir: 'up' },
      { x: 10, z: 0, to: 'pedraverde', tx: 13, tz: 22, dir: 'up' },
    ],
    items: [{ id: 'r1a', x: 17, z: 2, item: 'pocao', n: 1 }],
    npcs: [
      { id: 'amostra', x: 7, z: 26, dir: 'right', look: 'vendedor', talk: async G => {
        if (!G.flag('r1_amostra')) {
          await G.say('Olá! Trabalho na Loja de Pedra-Verde. Estou distribuindo amostras grátis!', 'Vendedor');
          G.set('r1_amostra');
          G.giveItem('pocao', 2);
          await G.say('{N} recebeu 2 POÇÕES!');
        }
        await G.say('Poções recuperam PV dos seus Crescemon. Use pela BOLSA durante a batalha!', 'Vendedor');
      } },
      { id: 'r1kid', x: 16, z: 13, dir: 'left', look: 'garoto', wander: true, talk: async G => {
        await G.say('Crescemon selvagens se escondem no MATO ALTO. Se o seu parceiro estiver fraco, volte para casa para descansar!');
      } },
    ],
    encounters: { rate: 0.12, list: [['ratitu', 2, 4, 45], ['pardalito', 2, 5, 45], ['taturana', 3, 4, 10]] },
  },

  // ------------------------------------------------------------ PEDRA-VERDE
  pedraverde: {
    name: 'Pedra-Verde', music: 'city', bg: 'grass',
    rows: [
      'TTTTTTTTTTTT,TTTTTTTTTTTTT',
      'TTTTTTTTTTTT,TTTTTTTTTTTTT',
      'TT.........,,,,.........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..,,,,,,,,,,,,,,,,,,..TT',
      'TT..........,,.....f....TT',
      'TT.f........,,..........TT',
      'TT..........,,..S.......TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..,,,,,,,,,,,,,,,,,,..TT',
      'TT..........,,..........TT',
      'TT..f.......,,.......f..TT',
      'TT.......S..,,..........TT',
      'TTRR........,,........RRTT',
      'TTRR........,,........RRTT',
      'TT..........,,..........TT',
      'TTTTTTTTTTTT,,TTTTTTTTTTTT',
    ],
    buildings: [
      { x: 3, z: 3, w: 7, d: 5, style: 'gym', door: 3, to: 'ginasio1', label: 'GINÁSIO', roof: '#8a7a6a' },
      { x: 16, z: 4, w: 5, d: 4, style: 'house', roof: '#6a9a3a' },
      { x: 4, z: 12, w: 5, d: 4, style: 'center', door: 2, to: 'centro1', label: 'CENTRO' },
      { x: 16, z: 12, w: 4, d: 4, style: 'shop', door: 1, to: 'loja1', label: 'LOJA' },
    ],
    signs: [
      { x: 9, z: 19, text: 'PEDRA-VERDE — A cidade das rochas firmes.' },
      { x: 16, z: 11, text: 'GINÁSIO DE PEDRA-VERDE — Líder: BASALTO, o treinador de rocha inabalável.' },
    ],
    warps: [
      { x: 12, z: 23, to: 'rota1', tx: 9, tz: 1, dir: 'down' },
      { x: 13, z: 23, to: 'rota1', tx: 10, tz: 1, dir: 'down' },
      { x: 12, z: 0, to: 'floresta', tx: 12, tz: 32, dir: 'up' },
    ],
    npcs: [
      { id: 'guarda', x: 12, z: 2, dir: 'down', look: 'guarda', cond: G => !G.hasBadge('rocha'), talk: async G => {
        await G.say('Alto lá! A FLORESTA SUSSURRO é perigosa. Só deixo passar quem tem a INSÍGNIA ROCHA do Ginásio daqui.', 'Guarda');
      } },
      { id: 'guarda2', x: 11, z: 2, dir: 'right', look: 'guarda', cond: G => G.hasBadge('rocha'), talk: async G => {
        await G.say('Uma Insígnia Rocha! Pode passar. Cuidado com uns tipos estranhos de preto que andam pela floresta...', 'Guarda');
      } },
      { id: 'velho', x: 7, z: 10, dir: 'down', look: 'velho', wander: true, talk: async G => {
        await G.say('O Líder BASALTO usa Crescemon de tipo PEDRA. Golpes de ÁGUA e PLANTA funcionam muito bem contra eles!', 'Seu Joaquim');
        await G.say('Se seu parceiro for de FOGO... treine bastante na Rota 1 antes, hein!', 'Seu Joaquim');
      } },
      { id: 'pvkid', x: 19, z: 18, dir: 'left', look: 'garota', wander: true, talk: async G => {
        await G.say('Quando um Crescemon desmaia, você precisa levá-lo ao CENTRO CRESCEMON. É o prédio de telhado vermelho!');
      } },
      { id: 'rival_pv', x: 12, z: 0, dir: 'down', look: 'rival', hidden: true },
    ],
    triggers: [
      { x: 12, z: 3, cond: G => G.hasBadge('rocha') && !G.flag('rival2'), run: rivalBattle2 },
    ],
  },
  centro1: centro('centro1', 'Pedra-Verde', { to: 'pedraverde', tx: 6, tz: 16 }),
  loja1: loja('loja1', 'Pedra-Verde', { to: 'pedraverde', tx: 17, tz: 16 }),

  ginasio1: {
    name: 'Ginásio de Pedra-Verde', interior: true, floor: 'stone', music: 'gym', bg: 'gym',
    rows: room(11, 14, 5),
    exit: { x: 5, z: 13, to: 'pedraverde', tx: 6, tz: 8 },
    furniture: [
      { type: 'boulder', x: 1, z: 4 }, { type: 'boulder', x: 2, z: 4 }, { type: 'boulder', x: 8, z: 4 }, { type: 'boulder', x: 9, z: 4 },
      { type: 'boulder', x: 1, z: 9 }, { type: 'boulder', x: 9, z: 9 }, { type: 'statue', x: 3, z: 11 }, { type: 'statue', x: 7, z: 11 },
    ],
    signs: [{ x: 3, z: 11, text: 'GINÁSIO DE PEDRA-VERDE. Vencedores: GAEL' }, { x: 7, z: 11, text: 'Líder: BASALTO. Dica: Pedra é forte contra Fogo, Voador e Inseto.' }],
    npcs: [
      { id: 'g1camp', x: 3, z: 7, dir: 'right', look: 'campista', sight: 5, trainer: {
        name: 'Campista Téo', party: [['pedrolho', 8], ['ratitu', 9]], money: 180,
        intro: 'Ei! Você está a mil anos de distância do Basalto! Primeiro, me vença!',
        lose: 'Uau... você é forte mesmo.',
        after: 'O Basalto é bem mais forte que eu. Boa sorte!' } },
      { id: 'basalto', x: 5, z: 2, dir: 'down', look: 'basalto', trainer: {
        name: 'Líder Basalto', party: [['pedrolho', 10], ['sirito', 11], ['pedrolho', 12]], money: 1200, leader: true,
        intro: 'Sou BASALTO, Líder do Ginásio de Pedra-Verde! Minha força é firme como rocha. Mostre-me sua determinação!',
        lose: 'Eu subestimei você... Tome, isto é a prova da sua vitória!',
        after: 'Existem muitos treinadores fortes por aí. Continue crescendo!',
        onWin: async G => {
          G.addBadge('rocha');
          await G.say('{N} recebeu a INSÍGNIA ROCHA!', null, 'badge');
          await G.say('Com ela, o guarda vai deixar você entrar na Floresta Sussurro. E a loja agora vende SUPER POÇÕES!', 'Basalto');
          G.giveItem('superpocao', 2);
          await G.say('{N} recebeu 2 SUPER POÇÕES!');
        } } },
    ],
  },

  // ------------------------------------------------------------ FLORESTA
  floresta: {
    name: 'Floresta Sussurro', music: 'forest', bg: 'forest', dark: true,
    rows: [
      'TTTTTTTTTTT,TTTTTTTTTTTT',
      'TTTTTTTTTTT,TTTTTTTTTTTT',
      'TTTTTTTTTTT,TTTTTTTTTTTT',
      'TT...GGGGG.,...GGGGG..TT',
      'TT...GGGGG.,...GGGGG..TT',
      'TT..TTTTTTT,TTTTTTT...TT',
      'TT..T.....,,......T...TT',
      'TT..T.GGG.,.GGGG..T.GGTT',
      'TT....GGG.,.GGGG....GGTT',
      'TTTTTTTTT.,.TTTTTTTTGGTT',
      'TTGGGG....,.......TTGGTT',
      'TTGGGG....,,,,....TT..TT',
      'TT..TTTTTT...,TT..TT..TT',
      'TT..TGGGGT...,TT......TT',
      'TT..TGGGGT...,TTTTTTT.TT',
      'TT....GG.....,....GGG.TT',
      'TT....GG.....,....GGG.TT',
      'TTTTTTTT..,,,,TTTTTTTTTT',
      'TT......,,,.....GGGG..TT',
      'TT.GGG..,.......GGGG..TT',
      'TT.GGG..,..TTTT.GGGG..TT',
      'TT.GGG..,..TTTT.......TT',
      'TT......,,,,,,,,,,....TT',
      'TTTTTTT.......GGG.,...TT',
      'TT.GGGG.......GGG.,...TT',
      'TT.GGGG..TTT......,...TT',
      'TT.......TTT.GGG..,...TT',
      'TT...,,,,,,,,GGG..,...TT',
      'TT...,....TTTTTTTT,...TT',
      'TT...,...........,,...TT',
      'TT...,,,,,,,,,,,,,....TT',
      'TT..........,,........TT',
      'TT..........,,........TT',
      'TTTTTTTTTTTT,,TTTTTTTTTT',
    ],
    warps: [
      { x: 12, z: 33, to: 'pedraverde', tx: 12, tz: 1, dir: 'down' },
      { x: 13, z: 33, to: 'pedraverde', tx: 12, tz: 1, dir: 'down' },
      { x: 11, z: 0, to: 'mare', tx: 11, tz: 20, dir: 'up' },
    ],
    items: [
      { id: 'fl1', x: 21, z: 11, item: 'orbe', n: 3 },
      { id: 'fl2', x: 3, z: 13, item: 'superpocao', n: 1 },
      { id: 'fl3', x: 21, z: 23, item: 'reviver', n: 1 },
    ],
    npcs: [
      { id: 'flinseto1', x: 4, z: 27, dir: 'right', look: 'inseto', sight: 4, trainer: {
        name: 'Caçador Caio', party: [['joanito', 7], ['taturana', 7]], money: 140,
        intro: 'Ei! Você também caça insetos? Vamos batalhar!', lose: 'Nããão! Meus insetinhos!',
        after: 'Taturanas viram Casulitos, e Casulitos viram lindos Borbolux!' } },
      { id: 'flinseto2', x: 14, z: 11, dir: 'left', look: 'inseto', sight: 3, trainer: {
        name: 'Caçadora Bia', party: [['casulito', 8], ['joanito', 8], ['borbolux', 10]], money: 200,
        intro: 'Meus insetos cresceram muito! Quer ver?', lose: 'Seus Crescemon cresceram mais que os meus...',
        after: 'Dizem que tem um tatu elétrico raríssimo nesta floresta.' } },
      { id: 'grunt', x: 11, z: 2, dir: 'down', look: 'sombra', sight: 1, cond: G => !G.flag('tr_grunt'), trainer: {
        name: 'Recruta Sombra', party: [['ratitu', 9], ['morcegote', 10]], money: 300,
        intro: 'Parado aí! Nós, da EQUIPE SOMBRA, estamos caçando Crescemon raros nesta floresta. Ninguém passa!',
        lose: 'Argh! Perdi para uma criança!',
        onWin: async G => {
          await G.say('Tanto faz! O CHEFE BREU vai dominar todos os Crescemon da região!', 'Recruta Sombra');
          await G.say('A Equipe Sombra ainda vai voltar!', 'Recruta Sombra');
          G.set('floresta_ok');
        } } },
      { id: 'flvelho', x: 19, z: 19, dir: 'left', look: 'velho', talk: async G => {
        await G.say('Shhh... ouça. As árvores sussurram. Dizem que só quem cuida bem dos seus Crescemon consegue atravessar a floresta.', 'Andarilho');
      } },
    ],
    encounters: { rate: 0.13, list: [['taturana', 4, 6, 25], ['casulito', 5, 7, 15], ['joanito', 5, 8, 25], ['pardalito', 5, 7, 20], ['faiscatu', 6, 8, 8], ['morcegote', 5, 7, 7]] },
  },

  // ------------------------------------------------------------ CIDADE MARÉ
  mare: {
    name: 'Cidade Maré', music: 'city', bg: 'beach',
    rows: [
      'TTTTTTTTTTTT,TTTTTTT==WWWW',
      'TTTTTTTTTTTT,TTTTTTT==WWWW',
      'TT..........,.......==WWWW',
      'TT..........,,......==WWWW',
      'TT..........,,......==WWWW',
      'TT..........,,......==WWWW',
      'TT..........,,......==WWWW',
      'TT..........,,......==WWWW',
      'TT..,,,,,,,,,,,,,,,,===WWW',
      'TT..,.......,,..f...===WWW',
      'TT..,..S....,,......==WWWW',
      'TT..,.......,,..GGGG==WWWW',
      'TT..........,,..GGGG==WWWW',
      'TT..........,,..GGGG==WWWW',
      'TT..........,,..GGGG==WWWW',
      'TT..........,,......==WWWW',
      'TT..,,,,,,,,,,..f...==WWWW',
      'TT......f..,,.......==WWWW',
      'TT.........,,.......==WWWW',
      'TTF........,,.......==WWWW',
      'TT.........,,.......==WWWW',
      'TTTTTTTTTTT,TTTTTTTTTTWWWW',
    ],
    buildings: [
      { x: 3, z: 3, w: 7, d: 5, style: 'gym', door: 3, to: 'ginasio2', label: 'GINÁSIO', roof: '#3a8ad0' },
      { x: 14, z: 3, w: 5, d: 5, style: 'center', door: 2, to: 'centro2', label: 'CENTRO' },
      { x: 3, z: 12, w: 4, d: 4, style: 'shop', door: 1, to: 'loja2', label: 'LOJA' },
    ],
    signs: [{ x: 7, z: 10, text: 'CIDADE MARÉ — Onde o mar encontra a coragem. Líder do Ginásio: MARINA.' }],
    warps: [
      { x: 11, z: 21, to: 'floresta', tx: 11, tz: 1, dir: 'down' },
      { x: 12, z: 0, to: 'rotavitoria', tx: 8, tz: 30, dir: 'up' },
    ],
    npcs: [
      { id: 'mguarda', x: 12, z: 2, dir: 'down', look: 'guarda', cond: G => !G.hasBadge('mare'), talk: async G => {
        await G.say('A ROTA VITÓRIA leva à LIGA CRESCEMON. Só treinadores com 2 insígnias podem seguir!', 'Guarda');
      } },
      { id: 'mguarda2', x: 13, z: 2, dir: 'left', look: 'guarda', cond: G => G.hasBadge('mare'), talk: async G => {
        await G.say('Duas insígnias! Pode seguir para a Liga. Ouvi dizer que o chefe da Equipe Sombra foi visto na Rota Vitória...', 'Guarda');
      } },
      { id: 'nadador1', x: 21, z: 13, dir: 'left', look: 'nadador', sight: 4, trainer: {
        name: 'Nadador Rui', party: [['lambarito', 13], ['estrelito', 14]], money: 280,
        intro: 'A praia é o meu território! Bora uma batalha?', lose: 'Fui levado pela correnteza...',
        after: 'A Marina é a melhor nadadora da cidade. E a treinadora mais forte também.' } },
      { id: 'mmoca', x: 8, z: 18, dir: 'up', look: 'garota', wander: true, talk: async G => {
        await G.say('Crescemon de ÁGUA são fracos contra PLANTA e ELÉTRICO. Faiscatu, o tatu elétrico da floresta, seria ótimo contra a Marina!');
      } },
    ],
    encounters: { rate: 0.12, list: [['sirito', 11, 14, 35], ['estrelito', 11, 14, 35], ['pardalito', 11, 13, 20], ['lambarito', 11, 13, 10]] },
  },
  centro2: centro('centro2', 'Cidade Maré', { to: 'mare', tx: 16, tz: 8 }),
  loja2: loja('loja2', 'Cidade Maré', { to: 'mare', tx: 4, tz: 16 }),

  ginasio2: {
    name: 'Ginásio de Cidade Maré', interior: true, floor: 'pool', music: 'gym', bg: 'pool',
    rows: room(13, 14, 6).map((r, z) => {
      if (z >= 4 && z <= 9) return r.slice(0, 2) + 'WWW' + r.slice(5, 8) + 'WWW' + r.slice(11);
      return r;
    }),
    exit: { x: 6, z: 13, to: 'mare', tx: 6, tz: 8 },
    furniture: [{ type: 'plant', x: 1, z: 1 }, { type: 'plant', x: 11, z: 1 }, { type: 'statue', x: 4, z: 11 }, { type: 'statue', x: 8, z: 11 }],
    signs: [{ x: 4, z: 11, text: 'GINÁSIO DE CIDADE MARÉ. Vencedores: GAEL' }, { x: 8, z: 11, text: 'Líder: MARINA. Dica: Água é fraca contra Planta e Elétrico.' }],
    npcs: [
      { id: 'g2nad', x: 5, z: 8, dir: 'right', look: 'nadador', sight: 3, trainer: {
        name: 'Nadadora Iara', party: [['estrelito', 14], ['lambarito', 14], ['sirito', 15]], money: 300,
        intro: 'Para chegar até a Marina, vai ter que passar por mim!', lose: 'Afundei...',
        after: 'A Marina treina todo dia ao nascer do sol.' } },
      { id: 'marina', x: 6, z: 2, dir: 'down', look: 'marina', trainer: {
        name: 'Líder Marina', party: [['estrelito', 16], ['sirito', 16], ['pirarucao', 18]], money: 2000, leader: true,
        intro: 'Olá! Sou MARINA, Líder do Ginásio de Cidade Maré. Minhas ondas vão levar você de volta para casa!',
        lose: 'Uau! Você é como uma tempestade! Merece esta insígnia.',
        after: 'A Liga Crescemon fica depois da Rota Vitória. Estou torcendo por você!',
        onWin: async G => {
          G.addBadge('mare');
          await G.say('{N} recebeu a INSÍGNIA MARÉ!', null, 'badge');
          await G.say('Com duas insígnias, você pode desafiar a LIGA CRESCEMON! Tome, vai precisar disto.', 'Marina');
          G.giveItem('reviver', 2);
          await G.say('{N} recebeu 2 REVIVER!');
        } } },
    ],
  },

  // ------------------------------------------------------------ ROTA VITÓRIA
  rotavitoria: {
    name: 'Rota Vitória', music: 'route', bg: 'grass',
    rows: [
      'TTTTTTTTTTTTTTTTTTTT',
      'TT................TT',
      'TT................TT',
      'TT................TT',
      'TT................TT',
      'TT................TT',
      'TT...,,,,,,,,,,...TT',
      'TTTTTTTTT,TTTTTTTTTT',
      'TTTTTTTTT,TTTTTTTTTT',
      'TT......,,,,......TT',
      'TT..GGG.,..,.GGG..TT',
      'TT..GGG.,..,.GGG..TT',
      'TT..GGG.,..,.GGG..TT',
      'TT......,,,,......TT',
      'TTTTTT....,....TTTTT',
      'TT.GGGGG..,..GGGG.TT',
      'TT.GGGGG..,..GGGG.TT',
      'TT.GGGGG..,..GGGG.TT',
      'TT........,.......TT',
      'TT..TTTT..,..TTTT.TT',
      'TT..TTTT..,..TTTT.TT',
      'TT........,.......TT',
      'TTGGGG....,,,,,...TT',
      'TTGGGG........,...TT',
      'TTGGGG..GGGG..,...TT',
      'TT......GGGG..,...TT',
      'TT......GGGG..,...TT',
      'TT......,,,,,,,...TT',
      'TT......,.........TT',
      'TT......,.........TT',
      'TT......,.........TT',
      'TTTTTTTT,TTTTTTTTTTT',
    ],
    buildings: [{ x: 5, z: 1, w: 9, d: 5, style: 'liga', door: 4, to: 'liga', label: 'LIGA' }],
    warps: [{ x: 8, z: 31, to: 'mare', tx: 12, tz: 1, dir: 'down' }],
    items: [{ id: 'rv1', x: 16, z: 18, item: 'elixir', n: 1 }, { id: 'rv2', x: 3, z: 9, item: 'superorbe', n: 3 }],
    npcs: [
      { id: 'as1', x: 7, z: 18, dir: 'right', look: 'as', sight: 3, trainer: {
        name: 'Ás Leo', party: [['gavialto', 17], ['faiscatu', 17], ['ratanaz', 18]], money: 700,
        intro: 'Quem quer chegar na Liga precisa passar pelos Ases! Prepare-se!', lose: 'Você é digno da Liga...',
        after: 'O campeão atual é bem jovem, sabia? Chegou lá antes de todo mundo.' } },
      { id: 'as2', x: 15, z: 23, dir: 'left', look: 'as', sight: 3, trainer: {
        name: 'Ás Nina', party: [['borbolux', 18], ['estrelito', 18], ['trovatu', 19]], money: 760,
        intro: 'Treinei a vida inteira para este momento. Vamos lá!', lose: 'Incrível! Que estratégia!',
        after: 'Não esqueça de curar seus Crescemon antes de entrar na Liga.' } },
      { id: 'breu', x: 9, z: 9, dir: 'down', look: 'breu', sight: 3, cond: G => !G.flag('tr_breu'), trainer: {
        name: 'Chefe Breu', party: [['sombrino', 19], ['morcegao', 20], ['ratanaz', 21]], money: 2500,
        intro: 'Então você é a criança que derrotou meu recruta na floresta. Eu sou BREU, chefe da EQUIPE SOMBRA. Vou mostrar o verdadeiro poder das sombras!',
        lose: 'Impossível... Vencido por alguém que trata os Crescemon como amigos?',
        onWin: async G => {
          await G.say('Talvez... eu tenha esquecido o que é crescer ao lado deles. A Equipe Sombra está acabada.', 'Chefe Breu');
          await G.say('Siga em frente, {N}. A Liga espera por você.', 'Chefe Breu');
        } } },
      { id: 'solaris', x: 15, z: 3, dir: 'down', creature: 'solaris', cond: G => G.flag('campeao') && !G.flag('solaris'), talk: async G => {
        await G.say('Uma luz dourada brilha intensamente... É SOLARIS, a ave lendária!');
        await G.cry('solaris');
        const r = await G.wildBattle('solaris', 35, { legendary: true });
        G.set('solaris');
        if (r === 'caught') await G.say('Incrível! Você fez amizade com a lenda!');
        else await G.say('SOLARIS voou em direção ao sol nascente...');
      } },
    ],
    encounters: { rate: 0.12, list: [['sombrino', 16, 19, 20], ['ratanaz', 17, 19, 20], ['gavialto', 17, 19, 20], ['faiscatu', 16, 19, 15], ['pedrolho', 16, 18, 15], ['morcegote', 16, 18, 10]] },
  },

  liga: {
    name: 'Liga Crescemon', interior: true, floor: 'liga', music: 'liga', bg: 'liga',
    rows: room(13, 14, 6).map((r, z) => z === 7 ? '#CC_________#' : r),
    exit: { x: 6, z: 13, to: 'rotavitoria', tx: 9, tz: 6 },
    furniture: [
      { type: 'statue', x: 3, z: 3 }, { type: 'statue', x: 9, z: 3 }, { type: 'plant', x: 1, z: 11 }, { type: 'plant', x: 11, z: 11 },
      { type: 'carpet', x: 5, z: 1, w: 3, d: 12, walk: true }, { type: 'machine', x: 1, z: 6, w: 1, d: 1 },
    ],
    signs: [{ x: 3, z: 3, text: 'LIGA CRESCEMON — "Crescer é nunca desistir."' }, { x: 9, z: 3, text: 'Salão dos Campeões: aqui ficam os nomes de quem venceu a Liga.' }],
    npcs: [
      { id: 'ligaenf', x: 1, z: 8, dir: 'up', look: 'enfermeira', talk: async G => {
        await G.say('Esta é a última parada antes do campeão. Vou curar seus Crescemon.', 'Enfermeira Clara');
        G.state.lastCenter = { map: 'liga', x: 6, z: 11 };
        await G.healScene();
        await G.say('Boa sorte, {N}!', 'Enfermeira Clara');
      } },
      { id: 'campeao', x: 6, z: 2, dir: 'down', look: 'rival', sight: 4, trainer: {
        name: 'Campeão Gael', party: 'rivalFinal', money: 5000,
        intro: 'Finalmente, {N}! Eu cheguei aqui primeiro e virei o CAMPEÃO! Enquanto você andava por aí, eu treinei sem parar. Agora eu sou o mais forte do mundo! Vamos decidir isso de uma vez!',
        lose: 'NÃO! Como assim?! Depois de tudo... eu perdi?',
        after: 'Da próxima vez eu venço. Pode apostar!',
        onWin: championEnding } },
      { id: 'prof_liga', x: 6, z: 11, dir: 'up', look: 'prof', hidden: true },
    ],
  },
};

// ================================================================= SCRIPTS

async function profStop(G) {
  G.set('metProf');
  await G.say('Ei! Espere! Não vá!', '???');
  await G.player.emote('!');
  await G.player.face('down');
  const p = G.npc('prof_fora');
  const px = G.player.x;
  p.place(px, 9, 'up');
  p.show();
  await p.walk(Array(5).fill('up'));
  await G.say('Ufa! Foi por pouco! É perigoso! Crescemon selvagens vivem no MATO ALTO!', 'Prof. Ipê');
  await G.say('Você precisa de um Crescemon parceiro para se proteger. Venha comigo até o laboratório!', 'Prof. Ipê');
  await G.fade(async () => {
    p.hide();
    await G.warp('lab', 5, 4, 'up', true);
  });
  await G.say('Vô! Cansei de esperar!', 'Gael');
  await G.say('Gael? Ah, é mesmo, pedi para você vir. Espere um pouco.', 'Prof. Ipê');
  await G.say('{N}, ali naquela mesa há três Crescemon dentro de Cresce-Orbes.', 'Prof. Ipê');
  await G.say('Quando eu era jovem, fui um treinador sério. Hoje só tenho esses três. Pode escolher um! Vá em frente!', 'Prof. Ipê');
  await G.say('Ei! Vô! E eu?', 'Gael');
  await G.say('Calma, Gael. Você também vai poder escolher. Deixe {N} escolher primeiro.', 'Prof. Ipê');
}

async function pickStarter(G, sp, col) {
  if (!G.flag('metProf')) { await G.say('Um Cresce-Orbe. Melhor não mexer sem o Prof. Ipê.'); return; }
  if (G.flag('starter')) { await G.say('O Prof. Ipê está guardando este Crescemon com carinho.'); return; }
  const info = { brasito: ['BRASITO', 'FOGO'], pingolote: ['PINGOLOTE', 'ÁGUA'], capibroto: ['CAPIBROTO', 'PLANTA'] }[sp];
  await G.showCreature(sp);
  const r = await G.ask(`Você escolhe ${info[0]}, o Crescemon de tipo ${info[1]}?`, ['Sim', 'Não'], 'Prof. Ipê');
  G.hideCreature();
  if (r !== 0) return;
  G.state.starter = sp;
  G.set('starter');
  G.giveCreature(sp, 5);
  G.seen(sp); G.caught(sp);
  await G.say(`{N} recebeu ${info[0]} do Prof. Ipê!`, null, 'fanfare');
  // rival escolhe o tipo com vantagem
  const rs = STARTER_BEATS[sp];
  G.state.rivalStarter = rs;
  const rcol = 6 + ['brasito', 'pingolote', 'capibroto'].indexOf(rs);
  await G.say('Então eu fico com esse aqui!', 'Gael');
  const rv = G.npc('rival');
  await rv.walk(['up', ...Array(rcol - 4).fill('right')]);
  await rv.face('down');
  G.refresh();
  await G.say(`O rival Gael recebeu ${G.speciesName(rs)}!`);
  await G.say('Hehe! O meu é bem mais legal que o seu!', 'Gael');
  G.state.rivalCol = rcol;
}

async function rivalBattle1(G) {
  const rv = G.npc('rival');
  await G.say('Espera aí, {N}! Vamos ver qual Crescemon é mais forte!', 'Gael');
  await G.player.face('up');
  const px = G.player.x, col = G.state.rivalCol || 6;
  const path = [];
  path.push(...Array(Math.max(0, col - 5)).fill('left'));
  path.push(...Array(4).fill('down'));
  if (px < 5) path.push(...Array(5 - px).fill('left'));
  if (px > 5) path.push(...Array(px - 5).fill('right'));
  await rv.walk(path);
  await rv.face('down');
  const won = await G.trainerBattle({
    name: 'Rival Gael', look: 'rival', party: [[G.state.rivalStarter, 5]], money: 100, rival: true, canLose: true,
    intro: '', lose: 'O quê?! Eu escolhi o Crescemon errado!', winText: 'Hahaha! Eu sou demais!',
  });
  G.set('rival1');
  if (!won) await G.say('Viu só? Eu vou ser o maior treinador do mundo!', 'Gael');
  await G.say('Vou treinar meu Crescemon até ele ficar invencível. Até mais, {N}!', 'Gael');
  const side = px === 5 ? 4 : 5;
  const hz = side > rv.x ? Array(side - rv.x).fill('right') : Array(rv.x - side).fill('left');
  await rv.walk([...hz, 'down', 'down', 'down']);
  rv.hide();
  G.healParty();
  await G.say('Seu Crescemon está cansado. Deixe-me curá-lo.', 'Prof. Ipê');
  await G.say('Seus Crescemon foram curados!');
  await G.say('{N}, se você for até PEDRA-VERDE, ao norte da Rota 1, passe na loja. Estou esperando uma encomenda.', 'Prof. Ipê');
  G.refresh();
}

async function profTalk(G) {
  if (!G.flag('starter')) {
    if (G.flag('metProf')) await G.say('Escolha um dos Crescemon na mesa, {N}!', 'Prof. Ipê');
    else await G.say('Olá! Sou o Prof. Ipê. Estou pesquisando sobre Crescemon.', 'Prof. Ipê');
    return;
  }
  if (G.flag('encomenda') && !G.flag('dex')) {
    await G.say('Ah! Minha encomenda! Obrigado, {N}!', 'Prof. Ipê');
    G.takeItem('encomenda');
    await G.say('Isto aqui é uma CRESCEDEX! Uma enciclopédia que registra todo Crescemon que você vê ou captura.', 'Prof. Ipê');
    G.set('dex');
    await G.say('{N} recebeu a CRESCEDEX!', null, 'fanfare');
    await G.say('E para capturar Crescemon selvagens, use estes CRESCE-ORBES. Enfraqueça o Crescemon antes de jogar!', 'Prof. Ipê');
    G.giveItem('orbe', 5);
    await G.say('{N} recebeu 5 CRESCE-ORBES!');
    await G.say('Meu sonho é completar a Crescedex. Conto com você! E se quiser se tornar um grande treinador, vença os Ginásios e desafie a LIGA!', 'Prof. Ipê');
    return;
  }
  if (G.flag('dex')) {
    const n = G.caughtCount();
    await G.say(`Vamos ver sua Crescedex... Você já capturou ${n} Crescemon e viu ${G.seenCount()}!`, 'Prof. Ipê');
    if (n < 5) await G.say('É só o começo! Explore o mato alto em cada rota.', 'Prof. Ipê');
    else if (n < 12) await G.say('Muito bem! Você está crescendo como treinador!', 'Prof. Ipê');
    else await G.say('Fantástico! Você é um verdadeiro pesquisador!', 'Prof. Ipê');
    return;
  }
  await G.say('Vá até PEDRA-VERDE, ao norte da Rota 1. Estou esperando uma encomenda na loja de lá.', 'Prof. Ipê');
}

async function rivalBattle2(G) {
  await G.say('Ei! {N}!', 'Gael');
  await G.player.face('up');
  const rv = G.npc('rival_pv');
  rv.place(12, 0, 'down');
  rv.show();
  await rv.walk(['down', 'down']);
  await G.say('Você também pegou a Insígnia Rocha? Hah, eu venci o Basalto primeiro! Deixa eu ver o quanto você cresceu!', 'Gael');
  const won = await G.trainerBattle({
    name: 'Rival Gael', look: 'rival', party: [['pardalito', 9], [G.state.rivalStarter, 11]], money: 400, rival: true,
    intro: '', lose: 'O quê?! Eu estava pegando leve com você!', winText: 'Hah! Continuo na frente!',
  });
  G.set('rival2');
  if (won) {
    await G.say('Tá bom, tá bom. Você é forte. Mas eu vou chegar na Liga antes de você! Tchau!', 'Gael');
    await rv.walk(['up', 'up'], true);
    rv.hide();
  }
}

async function championEnding(G) {
  await G.say('...', 'Gael');
  await G.say('Eu treinei tanto... Por que eu perdi?', 'Gael');
  const p = G.npc('prof_liga');
  p.place(6, 11, 'up');
  p.show();
  await p.walk(['up', 'up', 'up', 'up']);
  await G.say('{N}! Parabéns! Você é o novo CAMPEÃO da Liga Crescemon!', 'Prof. Ipê');
  await G.say('Gael... Você perdeu porque esqueceu de confiar e cuidar dos seus Crescemon. Sem isso, ninguém cresce de verdade.', 'Prof. Ipê');
  await G.say('...Eu entendi, vô. {N}, da próxima vez eu vou vencer do jeito certo.', 'Gael');
  await G.say('{N}, venha comigo. Vamos registrar você e seus Crescemon no SALÃO DOS CAMPEÕES!', 'Prof. Ipê');
  G.set('campeao');
  G.healParty();
  await G.credits();
  p.hide();
}

export function rivalFinalParty(G) {
  const line = STARTER_LINE[G.state.rivalStarter || 'pingolote'];
  return [['gavialto', 21], ['trovatu', 22], ['rochedao', 22], [line[1], 25]];
}
