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

// Centro de Criaturas e Loja (reutilizados em cada cidade)
function centro(id, city, back) {
  return {
    id, name: `Centro de Criaturas de ${city}`, interior: true, floor: 'tile', music: 'center',
    rows: room(11, 9, 5).map((r, z) => z === 3 ? '#__CCCCC__#' : r),
    exit: { x: 5, z: 8, ...back },
    furniture: [
      { type: 'machine', x: 7, z: 1, w: 2, d: 1 }, { type: 'pc', x: 1, z: 1, w: 1, d: 1 },
      { type: 'plant', x: 9, z: 7 }, { type: 'plant', x: 1, z: 7 }, { type: 'bench', x: 8, z: 5, w: 2, d: 1 },
    ],
    npcs: [
      { id: 'enf', x: 5, z: 2, dir: 'down', look: 'enfermeira', talk: async G => {
        await G.say('Bem-vindo ao Centro de Criaturas! Aqui cuidamos das suas criaturas até ficarem 100%.', 'Enfermeira Clara');
        const r = await G.ask('Quer que eu cuide das suas criaturas?', ['Sim', 'Não']);
        if (r === 0) {
          G.state.lastCenter = { map: id, x: 5, z: 4 };
          await G.healScene();
          await G.say('Pronto! Suas criaturas estão totalmente recuperadas. Volte sempre!', 'Enfermeira Clara');
        } else await G.say('Volte quando precisar!', 'Enfermeira Clara');
      } },
      { id: 'visit', x: 2, z: 5, dir: 'right', look: 'garota', talk: async G => {
        await G.say('O computador ali no canto guarda as criaturas que não cabem na sua equipe. Você pode levar até 6!');
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
        if (G.flag('campeao')) list.push('ultraorbe');
        await G.shop(list);
        await G.say('Obrigado! Volte sempre!', 'Vendedor');
      } },
    ],
  };
}

// Recruta da Equipe Sombra: some do mapa depois de derrotado
function grunt(id, x, z, dir, sight, party, money, intro, lose, look = 'sombra', extraCond = null) {
  return {
    id, x, z, dir, look, sight,
    cond: G => (!extraCond || extraCond(G)) && !G.flag('tr_' + id),
    trainer: { name: look === 'sombra2' ? 'Recruta Sombra' : 'Recruta Sombra', party, money, intro, lose },
  };
}

// Encontro com um lendário: se não for capturado, ele continua lá para nova tentativa
function legend(sp, lvl, intro, need) {
  return async G => {
    if (need && !G.flag(need.flag)) { await G.say(need.msg); return; }
    await G.say(intro);
    await G.cry(sp);
    const r = await G.wildBattle(sp, lvl, { legendary: true });
    if (r === 'caught') {
      G.set('lend_' + sp);
      await G.say(`Incrível! ${G.speciesName(sp)} decidiu seguir você!`, null, 'fanfare');
      const all = ['solaris', 'abissal', 'iperion', 'trovonca'].every(k => G.flag('lend_' + k));
      if (all && !G.flag('lendas4')) {
        G.set('lendas4');
        await G.say('As 4 criaturas lendárias estão com você! Sol, mar, floresta e trovão, finalmente em paz.');
      }
    } else if (r !== 'lose') {
      await G.say(`${G.speciesName(sp)} recuou para recuperar as forças... Volte para tentar de novo!`);
    }
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
    signs: [{ x: 1, z: 1, text: 'Está passando um programa sobre criaturas na TV. Um treinador atravessa uma ponte com seu parceiro... Parece a hora de você começar a sua jornada!' }],
    npcs: [
      { id: 'mae', x: 6, z: 3, dir: 'left', look: 'mae', talk: async G => {
        if (G.flag('campeao')) {
          await G.say('Meu filho, o CAMPEÃO da Liga! Eu sempre soube. Descanse um pouco...', 'Mãe');
          G.healParty();
          await G.say('Suas criaturas estão descansadas!');
        } else if (!G.flag('starter')) {
          await G.say('Bom dia, {N}! Todo mundo sai de casa algum dia. É o que dizem na TV.', 'Mãe');
          await G.say('O Prof. Ipê, aqui do lado, estava procurando você. Vá lá!', 'Mãe');
        } else {
          await G.say('{N}, você está com uma carinha cansada. Descanse um pouco!', 'Mãe');
          G.healParty();
          await G.say('Suas criaturas estão totalmente recuperadas!');
          await G.say('Tome cuidado lá fora. E lembre-se: crescer é um passo de cada vez!', 'Mãe');
        }
      } },
    ],
  },

  // ------------------------------------------------------------ VILA AURORA
  aurora: {
    sky: 'day', name: 'Vila Aurora', music: 'town', bg: 'grass',
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
      { x: 18, z: 13, text: 'LABORATÓRIO DE CRIATURAS do Prof. Ipê.' },
    ],
    warps: [
      { x: 10, z: 0, to: 'rota1', tx: 10, tz: 28, dir: 'up' },
      { x: 11, z: 0, to: 'rota1', tx: 11, tz: 28, dir: 'up' },
    ],
    npcs: [
      { id: 'moca', x: 6, z: 11, dir: 'down', look: 'garota', wander: true, talk: async G => {
        await G.say('Estou aprendendo sobre tecnologia! Sabia que as criaturas ficam mais fortes quanto mais batalham juntos com seu treinador?');
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
          await G.say('Oi, {N}! Suas criaturas parecem cansadas. Deixa eu ajudar!', 'Lia');
          G.healParty();
          await G.say('Suas criaturas estão prontas para continuar!');
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
        else await G.say('Minha criatura parece bem mais forte que a sua!', 'Gael');
      } },
      { id: 'ajud', x: 8, z: 7, dir: 'up', look: 'garoto', talk: async G => {
        await G.say('Eu sou assistente do Prof. Ipê! Estamos estudando como as criaturas evoluem quando treinam bastante.');
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
    sky: 'day', name: 'Rota 1', music: 'route', bg: 'grass',
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
        await G.say('Poções recuperam PV das suas criaturas. Use pela BOLSA durante a batalha!', 'Vendedor');
      } },
      { id: 'r1kid', x: 16, z: 13, dir: 'left', look: 'garoto', wander: true, talk: async G => {
        await G.say('Criaturas selvagens se escondem no MATO ALTO. Se o seu parceiro estiver fraco, volte para casa para descansar!');
      } },
    ],
    encounters: { rate: 0.12, list: [['ratitu', 2, 4, 35], ['pardalito', 2, 5, 35], ['taturana', 3, 4, 10], ['cutiara', 2, 4, 15], ['tucanito', 3, 5, 8]] },
  },

  // ------------------------------------------------------------ PEDRA-VERDE
  pedraverde: {
    sky: 'day', name: 'Pedra-Verde', music: 'city', bg: 'grass',
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
        await G.say('O Líder BASALTO usa criaturas de tipo PEDRA. Golpes de ÁGUA e PLANTA funcionam muito bem contra eles!', 'Seu Joaquim');
        await G.say('Se seu parceiro for de FOGO... treine bastante na Rota 1 antes, hein!', 'Seu Joaquim');
      } },
      { id: 'pvkid', x: 19, z: 18, dir: 'left', look: 'garota', wander: true, talk: async G => {
        await G.say('Quando uma criatura desmaia, você precisa levá-la ao CENTRO DE CRIATURAS. É o prédio de telhado vermelho!');
      } },
      { id: 'rival_pv', x: 12, z: 0, dir: 'down', look: 'rival', hidden: true },
      grunt('pvgrunt', 15, 9, 'left', 3, [['ratitu', 7], ['morcegote', 8]], 160,
        'Ei, você! Esta cidade está sendo vigiada pela EQUIPE SOMBRA. Esqueça que me viu... depois de perder!',
        'Grr! O Chefe Breu não vai gostar nada disso...'),
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
    sky: 'forest', name: 'Floresta Sussurro', music: 'forest', bg: 'forest', dark: true,
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
      'TT....GG.....,....GGG.,,',
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
      { x: 23, z: 15, to: 'santuario', tx: 1, tz: 18, dir: 'right' },
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
        intro: 'Meus insetos cresceram muito! Quer ver?', lose: 'Suas criaturas cresceram mais que as minhas...',
        after: 'Dizem que tem um tatu elétrico raríssimo nesta floresta.' } },
      { id: 'grunt', x: 11, z: 2, dir: 'down', look: 'sombra', sight: 1, cond: G => !G.flag('tr_grunt'), trainer: {
        name: 'Recruta Sombra', party: [['ratitu', 9], ['morcegote', 10]], money: 300,
        intro: 'Parado aí! Nós, da EQUIPE SOMBRA, estamos caçando criaturas raras nesta floresta. Ninguém passa!',
        lose: 'Argh! Perdi para uma criança!',
        onWin: async G => {
          await G.say('Tanto faz! O CHEFE BREU vai dominar todas as criaturas da região!', 'Recruta Sombra');
          await G.say('A Equipe Sombra ainda vai voltar!', 'Recruta Sombra');
          G.set('floresta_ok');
        } } },
      { id: 'florestal', x: 22, z: 15, dir: 'left', look: 'guarda', cond: G => !G.flag('campeao'), talk: async G => {
        await G.say('Esta trilha leva ao SANTUÁRIO DA FLORESTA, onde vive um guardião lendário. Só o campeão da Liga pode passar.', 'Guarda-florestal');
      } },
      { id: 'florestal2', x: 21, z: 14, dir: 'down', look: 'guarda', cond: G => G.flag('campeao'), talk: async G => {
        await G.say('Campeão! A Equipe Sombra entrou no Santuário. Proteja IPÊRION, por favor!', 'Guarda-florestal');
      } },
      { id: 'flvelho', x: 19, z: 19, dir: 'left', look: 'velho', talk: async G => {
        await G.say('Shhh... ouça. As árvores sussurram. Dizem que só quem cuida bem das suas criaturas consegue atravessar a floresta.', 'Andarilho');
      } },
    ],
    encounters: { rate: 0.13, list: [['taturana', 4, 6, 20], ['casulito', 5, 7, 12], ['joanito', 5, 8, 18], ['pardalito', 5, 7, 14], ['faiscatu', 6, 8, 7], ['morcegote', 5, 7, 6], ['fungito', 5, 7, 12], ['vagalumi', 6, 8, 8], ['jiboinha', 6, 8, 8], ['preguito', 6, 7, 6], ['micolumi', 5, 7, 6]] },
  },

  // ------------------------------------------------------------ CIDADE MARÉ
  mare: {
    sky: 'beach', name: 'Cidade Maré', music: 'city', bg: 'beach',
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
      { x: 15, z: 17, w: 4, d: 3, style: 'cave', door: 1, to: 'gruta' },
    ],
    signs: [{ x: 7, z: 10, text: 'CIDADE MARÉ — Onde o mar encontra a coragem. Líder do Ginásio: MARINA.' }],
    warps: [
      { x: 11, z: 21, to: 'floresta', tx: 11, tz: 1, dir: 'down' },
      { x: 12, z: 0, to: 'rotavitoria', tx: 8, tz: 30, dir: 'up' },
    ],
    npcs: [
      { id: 'mguarda', x: 12, z: 2, dir: 'down', look: 'guarda', cond: G => !G.hasBadge('mare'), talk: async G => {
        await G.say('A ROTA VITÓRIA leva à LIGA DAS CRIATURAS. Só treinadores com 2 insígnias podem seguir!', 'Guarda');
      } },
      { id: 'mguarda2', x: 13, z: 2, dir: 'left', look: 'guarda', cond: G => G.hasBadge('mare'), talk: async G => {
        await G.say('Duas insígnias! Pode seguir pela Rota Vitória. A Liga fica lá, mas só aceita quem tem 6 insígnias: os outros ginásios ficam a leste. E dizem que o chefe da Equipe Sombra foi visto por lá...', 'Guarda');
      } },
      { id: 'nyx', x: 13, z: 10, dir: 'left', look: 'nyx', sight: 3, cond: G => !G.flag('tr_nyx'), trainer: {
        name: 'Admin Nyx', party: [['aguaviva', 15], ['jiboinha', 16], ['morcegote', 17]], money: 900,
        intro: 'Hmm? Uma criança atrapalhando meus planos? Sou NYX, Admin da EQUIPE SOMBRA. Estamos procurando a entrada da GRUTA ABISSAL... e você não vai nos impedir.',
        lose: 'Que irritante... Você tem talento, admito.',
        onWin: async G => {
          await G.say('A gruta está selada por enquanto. Mas quando a Rainha acordar... nenhum lendário vai escapar.', 'Admin Nyx');
          await G.say('Rainha? O Chefe Breu não é o líder? Hmph. Você não sabe de nada.', 'Admin Nyx');
        } } },
      { id: 'pescador', x: 16, z: 20, dir: 'up', look: 'nadador', cond: G => !G.flag('campeao'), talk: async G => {
        await G.say('Esta é a GRUTA ABISSAL. Dizem que uma serpente lendária dorme lá dentro. É perigoso demais... só deixo o campeão da Liga entrar.', 'Pescador');
      } },
      { id: 'nadador1', x: 21, z: 13, dir: 'left', look: 'nadador', sight: 4, trainer: {
        name: 'Nadador Rui', party: [['lambarito', 13], ['estrelito', 14]], money: 280,
        intro: 'A praia é o meu território! Bora uma batalha?', lose: 'Fui levado pela correnteza...',
        after: 'A Marina é a melhor nadadora da cidade. E a treinadora mais forte também.' } },
      { id: 'mmoca', x: 8, z: 18, dir: 'up', look: 'garota', wander: true, talk: async G => {
        await G.say('Criaturas de ÁGUA são fracas contra PLANTA e ELÉTRICO. Faiscatu, o tatu elétrico da floresta, seria ótimo contra a Marina!');
      } },
    ],
    encounters: { rate: 0.12, list: [['sirito', 11, 14, 22], ['estrelito', 11, 14, 22], ['pardalito', 11, 13, 10], ['lambarito', 11, 13, 8], ['sapito', 11, 14, 14], ['aguaviva', 11, 13, 10], ['ariranhito', 12, 14, 10], ['papagaia', 12, 14, 8], ['manatino', 12, 13, 5]] },
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
        after: 'A Liga das Criaturas fica depois da Rota Vitória. Estou torcendo por você!',
        onWin: async G => {
          G.addBadge('mare');
          await G.say('{N} recebeu a INSÍGNIA MARÉ!', null, 'badge');
          await G.say('Tome, vai precisar disto. Dizem que há mais quatro ginásios depois da Rota Vitória!', 'Marina');
          G.giveItem('reviver', 2);
          await G.say('{N} recebeu 2 REVIVER!');
        } } },
    ],
  },

  // ------------------------------------------------------------ ROTA VITÓRIA
  rotavitoria: {
    sky: 'sunset', name: 'Rota Vitória', music: 'route', bg: 'grass',
    rows: [
      'TTTTTTTTTTTTTTTTTTTT',
      'TT................TT',
      'TT................TT',
      'TT................TT',
      'TT.................,',
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
      ',,........,.......TT',
      'TTGGGG....,,,,,...TT',
      'TTGGGG........,...TT',
      'TTGGGG..GGGG..,...TT',
      'TT......GGGG..,...TT',
      'TT......GGGG..,...TT',
      'TT......,,,,,,,.S.TT',
      'TT......,,,,,,,,,,,,',
      'TT......,.........TT',
      'TT......,.........TT',
      'TTTTTTTT,TTTTTTTTTTT',
    ],
    buildings: [{ x: 5, z: 1, w: 9, d: 5, style: 'liga', door: 4, to: 'liga', label: 'LIGA' }],
    warps: [
      { x: 8, z: 31, to: 'mare', tx: 12, tz: 1, dir: 'down' }, { x: 0, z: 21, to: 'pico', tx: 14, tz: 20, dir: 'left' },
      { x: 19, z: 28, to: 'rota_sertao', tx: 1, tz: 6, dir: 'right' }, { x: 19, z: 4, to: 'neblina', tx: 12, tz: 1, dir: 'down' },
    ],
    signs: [{ x: 16, z: 27, text: 'LESTE: ROTA DO SERTÃO e os quatro ginásios do interior. A Liga exige 6 insígnias!' }],
    items: [{ id: 'rv1', x: 16, z: 18, item: 'elixir', n: 1 }, { id: 'rv2', x: 3, z: 9, item: 'superorbe', n: 3 }],
    npcs: [
      { id: 'ligaguarda', x: 9, z: 6, dir: 'down', look: 'guarda', cond: G => G.state.badges.length < 6, talk: async G => {
        const n = G.state.badges.length;
        await G.say(`A LIGA DAS CRIATURAS só aceita treinadores com 6 insígnias. Você tem ${n}. Os outros ginásios ficam a leste, depois da ROTA DO SERTÃO!`, 'Guarda da Liga');
      } },
      { id: 'as1', x: 7, z: 18, dir: 'right', look: 'as', sight: 3, trainer: {
        name: 'Ás Leo', party: [['gavialto', 17], ['faiscatu', 17], ['ratanaz', 18]], money: 700,
        intro: 'Quem quer chegar na Liga precisa passar pelos Ases! Prepare-se!', lose: 'Você é digno da Liga...',
        after: 'O campeão atual é bem jovem, sabia? Chegou lá antes de todo mundo.' } },
      { id: 'as2', x: 15, z: 23, dir: 'left', look: 'as', sight: 3, trainer: {
        name: 'Ás Nina', party: [['borbolux', 18], ['estrelito', 18], ['trovatu', 19]], money: 760,
        intro: 'Treinei a vida inteira para este momento. Vamos lá!', lose: 'Incrível! Que estratégia!',
        after: 'Não esqueça de curar suas criaturas antes de entrar na Liga.' } },
      { id: 'breu', x: 9, z: 9, dir: 'down', look: 'breu', sight: 3, cond: G => !G.flag('tr_breu'), trainer: {
        name: 'Chefe Breu', party: [['sombrino', 19], ['morcegao', 20], ['ratanaz', 21]], money: 2500,
        intro: 'Então você é a criança que derrotou meu recruta na floresta. Eu sou BREU, chefe da EQUIPE SOMBRA. Vou mostrar o verdadeiro poder das sombras!',
        lose: 'Impossível... Vencido por alguém que trata as criaturas como amigas?',
        onWin: async G => {
          await G.say('Talvez... eu tenha esquecido o que é crescer ao lado deles. A Equipe Sombra está acabada.', 'Chefe Breu');
          await G.say('Siga em frente, {N}. A Liga espera por você.', 'Chefe Breu');
        } } },
      grunt('rvgrunt1', 8, 12, 'down', 2, [['jiboinha', 17], ['sacirola', 18]], 420,
        'A Equipe Sombra controla esta rota! Volte para casa, pirralho!', 'Como assim eu perdi?!', 'sombra2'),
      grunt('rvgrunt2', 10, 16, 'down', 3, [['guarazito', 17], ['fungito', 18], ['morcegote', 18]], 440,
        'Ninguém chega até o Chefe Breu sem passar por mim!', 'Ai... o Chefe vai me colocar pra limpar a base inteira...'),
      { id: 'alpinista', x: 1, z: 21, dir: 'right', look: 'campista', cond: G => !G.flag('campeao'), talk: async G => {
        await G.say('Esta trilha sobe até o PICO TROVÃO. As tempestades lá em cima são terríveis. Só o campeão da Liga pode subir.', 'Alpinista');
      } },
      { id: 'alpinista2', x: 2, z: 20, dir: 'down', look: 'campista', cond: G => G.flag('campeao'), talk: async G => {
        await G.say('Vi gente de preto subindo o Pico Trovão, com máquinas estranhas... Cuidado lá em cima, campeão!', 'Alpinista');
      } },
      { id: 'eclipse', x: 15, z: 3, dir: 'down', look: 'eclipse', sight: 3, cond: G => G.flag('campeao') && !G.flag('tr_eclipse'), trainer: {
        name: 'Rainha Eclipse', party: [['assombrado', 50], ['medusombra', 50], ['jiboiao', 51], ['boitata', 51], ['magmarocha', 52], ['morcegao', 53]], money: 8000,
        intro: 'Então você é o novo campeão. Eu sou ECLIPSE, a verdadeira RAINHA da Equipe Sombra. Breu era só um fantoche. Com os 4 lendários, vou apagar o sol e trazer uma noite que nunca termina! Saia do meu caminho!',
        lose: 'Impossível... A luz... venceu a sombra?',
        onWin: async G => {
          await G.say('Suas criaturas lutam com o coração... As minhas só lutavam por medo.', 'Rainha Eclipse');
          await G.say('Talvez uma noite eterna não fizesse ninguém crescer. A Equipe Sombra está acabada. De verdade, desta vez.', 'Rainha Eclipse');
          G.set('sombra_fim');
        } } },
      { id: 'solaris', x: 15, z: 1, dir: 'down', creature: 'solaris', cond: G => G.flag('campeao') && !G.flag('lend_solaris'),
        talk: legend('solaris', 54, 'Uma luz dourada brilha intensamente... É SOLARIS, a ave lendária do sol nascente!',
          { flag: 'tr_eclipse', msg: 'Uma barreira de sombras envolve Solaris... A Rainha Eclipse está por perto!' }) },
    ],
    encounters: { rate: 0.12, list: [['sombrino', 16, 19, 12], ['ratanaz', 17, 19, 12], ['gavialto', 17, 19, 12], ['faiscatu', 16, 19, 10], ['pedrolho', 16, 18, 10], ['morcegote', 16, 18, 6], ['guarazito', 16, 19, 12], ['cristalito', 16, 18, 8], ['carvaozinho', 16, 18, 8], ['colibrinho', 17, 19, 8], ['tamandito', 17, 19, 8], ['sacirola', 17, 19, 6], ['poraquinho', 16, 18, 6]] },
  },

  // ------------------------------------------------------------ PÓS-LIGA: SANTUÁRIO DA FLORESTA
  santuario: {
    sky: 'forest', name: 'Santuário da Floresta', music: 'forest', bg: 'forest', dark: true,
    rows: [
      'TTTTTTTTTTTTTTTTTT',
      'TTTTTT......TTTTTT',
      'TTTT..........TTTT',
      'TTT....ffff....TTT',
      'TTT...f....f...TTT',
      'TTT....ffff....TTT',
      'TTTT....,,....TTTT',
      'TTTTTTTT,,TTTTTTTT',
      'TTGGGG..,,..GGGGTT',
      'TTGGGG..,,..GGGGTT',
      'TTGGG...,,...GGGTT',
      'TT......,,......TT',
      'TT..TT..,,..TT..TT',
      'TT..TT..,,..TT..TT',
      'TTGGGG..,,..GGGGTT',
      'TTGGGG..,,..GGGGTT',
      'TT......,,......TT',
      'TT..............TT',
      ',,,,,,,,,,......TT',
      'TT..............TT',
      'TT....GGGGGG....TT',
      'TTTTTTTTTTTTTTTTTT',
    ],
    warps: [{ x: 0, z: 18, to: 'floresta', tx: 22, tz: 15, dir: 'left' }],
    items: [{ id: 'sa1', x: 15, z: 11, item: 'ultraorbe', n: 2 }],
    npcs: [
      { id: 'anciã', x: 13, z: 17, dir: 'left', look: 'velho', talk: async G => {
        await G.say('IPÊRION floresce uma vez por ano, como os ipês amarelos. Onde ele pisa, a floresta renasce.', 'Guardiã do Santuário');
        await G.say('Aqueles brutamontes da Equipe Sombra querem prendê-lo numa máquina. Não deixe!', 'Guardiã do Santuário');
      } },
      grunt('sgrunt2', 4, 17, 'right', 4, [['jiboiao', 42], ['fungalhao', 43]], 900,
        'O Santuário agora pertence à Equipe Sombra!', 'Eu só queria colher cogumelos...', 'sombra2'),
      grunt('sgrunt1', 9, 7, 'down', 4, [['guaralobo', 43], ['medusombra', 43], ['morcegao', 44]], 950,
        'Nenhum passo a mais! O Admin Grafite está trabalhando.', 'Como?! Nossas defesas...'),
      { id: 'grafite', x: 8, z: 7, dir: 'down', look: 'grafite', sight: 4, cond: G => !G.flag('tr_grafite'), trainer: {
        name: 'Admin Grafite', party: [['rochedao', 44], ['magmarocha', 45], ['cristalord', 46]], money: 3000,
        intro: 'HAH! Eu sou GRAFITE, o Admin mais forte da Equipe Sombra! A Rainha quer Ipêrion, e eu vou entregar. Vou te esmagar como pedra!',
        lose: 'Minhas rochas... quebraram?!',
        onWin: async G => { await G.say('Tá bom, tá bom! Estou indo embora! A Rainha vai ficar furiosa...', 'Admin Grafite'); } } },
      { id: 'iperion', x: 8, z: 4, dir: 'down', creature: 'iperion', cond: G => !G.flag('lend_iperion'),
        talk: legend('iperion', 52, 'Pétalas douradas caem do céu... IPÊRION, o guardião lendário da floresta, olha para você!') },
    ],
    encounters: { rate: 0.12, list: [['fungito', 42, 45, 16], ['vagalumi', 42, 45, 14], ['jiboiao', 43, 46, 10], ['preguito', 42, 45, 12], ['colibrilho', 43, 46, 10], ['borbolux', 42, 45, 14], ['saparrao', 43, 45, 10], ['micolumi', 42, 45, 8]] },
  },

  // ------------------------------------------------------------ PÓS-LIGA: GRUTA ABISSAL
  gruta: {
    name: 'Gruta Abissal', interior: true, floor: 'cave', music: 'forest', bg: 'cave',
    rows: room(15, 14, 7).map((r, z) => ({
      1: '#____WWWWW____#', 2: '#___WWWWWWW___#', 3: '#___WWWWWWW___#', 4: '#____WWWWW____#',
    }[z] || r)),
    exit: { x: 7, z: 13, to: 'mare', tx: 16, tz: 20 },
    furniture: [
      ...[1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13].map(x => ({ type: 'boulder', x, z: 7 })),
      { type: 'boulder', x: 1, z: 1 }, { type: 'boulder', x: 13, z: 1 }, { type: 'boulder', x: 1, z: 12 }, { type: 'boulder', x: 13, z: 12 },
    ],
    npcs: [
      grunt('ggrunt1', 3, 10, 'right', 3, [['medusombra', 42], ['poraquao', 43]], 900,
        'A Admin Nyx está acordando a serpente! Não atrapalhe!', 'Glub... perdi...', 'sombra2'),
      grunt('ggrunt2', 11, 10, 'left', 3, [['assombrado', 43], ['ariranhao', 43]], 900,
        'Você chegou tarde, campeão!', 'Eu devia ter ficado na praia...'),
      { id: 'nyx2', x: 7, z: 7, dir: 'down', look: 'nyx', sight: 4, cond: G => !G.flag('tr_nyx2'), trainer: {
        name: 'Admin Nyx', party: [['medusombra', 45], ['assombrado', 46], ['poraquao', 47]], money: 3200,
        intro: 'Você de novo... Desta vez a gruta está aberta, e ABISSAL será da Rainha. As profundezas vão engolir você!',
        lose: 'Outra vez... Por que você sempre vence?',
        onWin: async G => { await G.say('A Rainha Eclipse espera na Rota Vitória, perto de Solaris. Vá, se tiver coragem.', 'Admin Nyx'); } } },
      { id: 'abissal', x: 7, z: 5, dir: 'down', creature: 'abissal', cond: G => !G.flag('lend_abissal'),
        talk: legend('abissal', 52, 'A água do lago se agita... ABISSAL, a serpente lendária das profundezas, se ergue diante de você!') },
    ],
  },

  // ------------------------------------------------------------ PÓS-LIGA: PICO TROVÃO
  pico: {
    sky: 'storm', name: 'Pico Trovão', music: 'route', bg: 'grass',
    rows: [
      'TTTTTTTTTTTTTTTT',
      'TTTTRR....RRTTTT',
      'TTTR........RTTT',
      'TTTR...,,...RTTT',
      'TTTTR..,,..RTTTT',
      'TTTTTR.,,.RTTTTT',
      'TTTTTTR,,RTTTTTT',
      'TTTTTTR,,RTTTTTT',
      'TTTTRR.,,..RRTTT',
      'TTTR...,,....RTT',
      'TTR..GG,,GGG..TT',
      'TTR..GG,,GGG..TT',
      'TT...GG,,GGG..TT',
      'TT.....,,.....TT',
      'TTRR...,,...RRTT',
      'TTR....,,,,,..TT',
      'TT..GGG....,..TT',
      'TT..GGG....,..TT',
      'TT..GGG....,..TT',
      'TTR........,..TT',
      'TT.........,,,,,',
      'TTRR..........TT',
      'TTTTRRR....RRRTT',
      'TTTTTTTTTTTTTTTT',
    ],
    warps: [{ x: 15, z: 20, to: 'rotavitoria', tx: 1, tz: 21, dir: 'right' }],
    items: [{ id: 'pi1', x: 3, z: 21, item: 'elixir', n: 2 }],
    npcs: [
      grunt('pgrunt2', 3, 13, 'right', 3, [['cristalito', 42], ['poraquinho', 43], ['trovatu', 43]], 900,
        'A máquina do Dr. Vulto vai sugar toda a energia dos raios!', 'Levei um choque de derrota...'),
      grunt('pgrunt1', 8, 7, 'down', 4, [['colibrilho', 43], ['magmarocha', 44]], 950,
        'O cume está interditado pela Equipe Sombra!', 'Brr... que frio aqui em cima...', 'sombra2'),
      { id: 'vulto', x: 7, z: 7, dir: 'down', look: 'vulto', sight: 4, cond: G => !G.flag('tr_vulto'), trainer: {
        name: 'Dr. Vulto', party: [['cristalord', 46], ['trovatu', 46], ['colibrilho', 47], ['poraquao', 48]], money: 3400,
        intro: 'Fascinante! Um campeão no meu laboratório a céu aberto. Sou o DR. VULTO, cientista da Equipe Sombra. Com a energia de TROVONÇA, minha máquina vai escurecer o céu. Vamos testar você primeiro!',
        lose: 'Os cálculos... estavam errados?',
        onWin: async G => { await G.say('Minha máquina queimou... Ciência sem coração não leva a lugar nenhum, afinal.', 'Dr. Vulto'); } } },
      { id: 'trovonca', x: 8, z: 2, dir: 'down', creature: 'trovonca', cond: G => !G.flag('lend_trovonca'),
        talk: legend('trovonca', 52, 'Um raio cai bem na sua frente! Das faíscas surge TROVONÇA, a onça lendária das tempestades!') },
    ],
    encounters: { rate: 0.12, list: [['cristalito', 42, 45, 18], ['poraquinho', 42, 45, 14], ['trovatu', 43, 46, 14], ['carvaozinho', 42, 45, 14], ['gavialto', 43, 46, 12], ['rochedao', 44, 46, 10], ['guaralobo', 44, 47, 10], ['colibrilho', 43, 46, 8]] },
  },

  liga: {
    name: 'Liga das Criaturas', interior: true, floor: 'liga', music: 'liga', bg: 'liga',
    rows: room(13, 14, 6).map((r, z) => z === 7 ? '#CC_________#' : r),
    exit: { x: 6, z: 13, to: 'rotavitoria', tx: 9, tz: 6 },
    furniture: [
      { type: 'statue', x: 3, z: 3 }, { type: 'statue', x: 9, z: 3 }, { type: 'plant', x: 1, z: 11 }, { type: 'plant', x: 11, z: 11 },
      { type: 'carpet', x: 5, z: 1, w: 3, d: 12, walk: true }, { type: 'machine', x: 1, z: 6, w: 1, d: 1 },
    ],
    signs: [{ x: 3, z: 3, text: 'LIGA DAS CRIATURAS — "Crescer é nunca desistir."' }, { x: 9, z: 3, text: 'Salão dos Campeões: aqui ficam os nomes de quem venceu a Liga.' }],
    npcs: [
      { id: 'ligaenf', x: 1, z: 8, dir: 'up', look: 'enfermeira', talk: async G => {
        await G.say('Esta é a última parada antes do campeão. Vou curar suas criaturas.', 'Enfermeira Clara');
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

  // ================================================================ REGIÃO NOVA: 4 GINÁSIOS
  // Rota Vitória (leste) → Sertão → Vila Mandacaru (FOGO) → Chapada → Cidade Relâmpago (ELÉTRICO)
  // → Igarapés → Vila Igarapé (PLANTA) → Pantanal → Vila Neblina (SOMBRA) → volta à Rota Vitória

  // ------------------------------------------------------------ ROTA DO SERTÃO (caatinga)
  rota_sertao: {
    sky: 'caatinga', name: 'Rota do Sertão', music: 'route', bg: 'grass',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTT..TTTT....TTTT..TTTT',
      'TT....GGGG......GGGG..TT',
      'TT..RRGGGG..==..GGGG..TT',
      'TT....GGGG..==......R.TT',
      'TT..........==........TT',
      ',,,,,,,,,,,,,,,,,,,,,,,,',
      'TT....S.....==........TT',
      'TT.GGGGG....==..GGGGG.TT',
      'TT.GGGGG..R.==..GGGGG.TT',
      'TT.GGGGG....==..GGGGG.TT',
      'TT......T.......T.....TT',
      'TT..R.....GGGG.....R..TT',
      'TT........GGGG........TT',
      'TTTT..TTTT....TTTT..TTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 0, z: 6, to: 'rotavitoria', tx: 18, tz: 28, dir: 'left' },
      { x: 23, z: 6, to: 'mandacaru', tx: 1, tz: 12, dir: 'right' },
    ],
    signs: [{ x: 6, z: 7, text: 'ROTA DO SERTÃO — Leste: VILA MANDACARU. Beba água, o sol aqui não perdoa!' }],
    items: [{ id: 'rs1', x: 21, z: 12, item: 'superpocao', n: 2 }],
    npcs: [
      { id: 'rsvaq', x: 9, z: 5, dir: 'down', look: 'vaqueiro', sight: 3, trainer: {
        name: 'Vaqueiro Zé', party: [['seriemito', 20], ['calanguito', 21]], money: 420,
        intro: 'Ô de casa! Aqui no sertão a gente batalha de sol a sol. Bora?', lose: 'Oxente! Você é bom mesmo!',
        after: 'A Líder JANDIRA cria criaturas de FOGO. Leve criaturas de ÁGUA e PEDRA!' } },
      { id: 'rscamp', x: 15, z: 7, dir: 'up', look: 'campista', sight: 3, trainer: {
        name: 'Campista Rosa', party: [['mandacarito', 21], ['jabutinho', 20], ['quatizinho', 21]], money: 440,
        intro: 'Estou acampando para ver a flor do mandacaru abrir. Enquanto isso... batalha!', lose: 'Que batalha quente!',
        after: 'Dizem que a MULAFLAMA galopa por aqui em noites de lua. Nunca vi, mas acredito!' } },
    ],
    encounters: { rate: 0.12, list: [['calanguito', 19, 22, 14], ['mandacarito', 19, 22, 12], ['carcarazinho', 19, 22, 10], ['seriemito', 19, 22, 12], ['jabutinho', 19, 21, 10], ['quatizinho', 19, 22, 10], ['miquito', 20, 22, 6], ['tamandito', 20, 22, 6], ['guarazito', 20, 22, 6], ['mulaflama', 22, 23, 1]] },
  },

  // ------------------------------------------------------------ VILA MANDACARU (caatinga) — GINÁSIO DE FOGO
  mandacaru: {
    sky: 'caatinga', name: 'Vila Mandacaru', music: 'city', bg: 'grass',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT......................TT',
      'TTT....................TTT',
      'TT......................TT',
      'TT......................TT',
      'TT......................TT',
      'TT......................TT',
      'TT..,,,,,,,,,,,,,,,,,,..TT',
      'TT..........,,..........TT',
      'TT........S.,,..======R.TT',
      'TT.R........,,..======..TT',
      'TT..........,,..........TT',
      ',,,,,,,,,,,,,,,,,,,,,,,,,,',
      'TT.======...,,..........TT',
      'TT.======...,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,S.........TT',
      'TT.......R..,,..........TT',
      'TT..........,,..........TT',
      'TT..,,,,,,,,,,,,,,,,,,..TT',
      'TT..........,,..........TT',
      'TTT....................TTT',
      'TT.R.................R..TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    buildings: [
      { x: 3, z: 2, w: 7, d: 5, style: 'gym', door: 3, to: 'ginasio3', label: 'GINÁSIO', roof: '#c8502a' },
      { x: 16, z: 2, w: 5, d: 5, style: 'center', door: 2, to: 'centro3', label: 'CENTRO' },
      { x: 4, z: 15, w: 4, d: 4, style: 'shop', door: 1, to: 'loja3', label: 'LOJA' },
      { x: 16, z: 15, w: 5, d: 4, style: 'house', roof: '#c87a4a' },
    ],
    signs: [
      { x: 10, z: 9, text: 'VILA MANDACARU — Onde o sol do sertão aquece os corações.' },
      { x: 14, z: 16, text: 'GINÁSIO DE MANDACARU — Líder: JANDIRA, a vaqueira das chamas.' },
    ],
    warps: [
      { x: 0, z: 12, to: 'rota_sertao', tx: 22, tz: 6, dir: 'left' },
      { x: 25, z: 12, to: 'rota_chapada', tx: 1, tz: 6, dir: 'right' },
    ],
    npcs: [
      { id: 'mdvelha', x: 8, z: 10, dir: 'down', look: 'velho', wander: true, talk: async G => {
        await G.say('Aqui chove pouco, mas quando chove o sertão inteiro fica verde. As criaturas daqui aprenderam a esperar.', 'Seu Chico');
      } },
      { id: 'mdkid', x: 19, z: 13, dir: 'left', look: 'garoto', wander: true, talk: async G => {
        await G.say('A JANDIRA doma até carcará! Criaturas de ÁGUA e PEDRA aguentam bem o fogo dela.');
      } },
      { id: 'mdmoca', x: 15, z: 20, dir: 'up', look: 'garota', talk: async G => {
        await G.say('Depois do ginásio, siga para o leste. A ROTA DA CHAPADA vive coberta de tempestades!');
      } },
    ],
  },
  centro3: centro('centro3', 'Vila Mandacaru', { to: 'mandacaru', tx: 18, tz: 7 }),
  loja3: loja('loja3', 'Vila Mandacaru', { to: 'mandacaru', tx: 5, tz: 19 }),

  ginasio3: {
    name: 'Ginásio de Mandacaru', interior: true, floor: 'lava', music: 'gym', bg: 'gym',
    rows: room(11, 14, 5),
    exit: { x: 5, z: 13, to: 'mandacaru', tx: 6, tz: 7 },
    furniture: [
      { type: 'brazier', x: 1, z: 1 }, { type: 'brazier', x: 9, z: 1 }, { type: 'brazier', x: 1, z: 6 }, { type: 'brazier', x: 9, z: 6 },
      { type: 'cactus', x: 1, z: 10 }, { type: 'cactus', x: 9, z: 10 }, { type: 'statue', x: 3, z: 11 }, { type: 'statue', x: 7, z: 11 },
    ],
    signs: [{ x: 3, z: 11, text: 'GINÁSIO DE MANDACARU. Vencedores: GAEL' }, { x: 7, z: 11, text: 'Líder: JANDIRA. Dica: Fogo é fraco contra Água e Pedra.' }],
    npcs: [
      { id: 'g3vaq', x: 3, z: 8, dir: 'right', look: 'vaqueiro', sight: 4, trainer: {
        name: 'Vaqueiro Tonho', party: [['calanguito', 22], ['carcarazinho', 22]], money: 460,
        intro: 'Para chegar na Jandira, tem que aguentar o calor!', lose: 'Arre égua, que força!',
        after: 'A Jandira nunca foge de um desafio.' } },
      { id: 'g3fog', x: 7, z: 5, dir: 'left', look: 'as', sight: 3, trainer: {
        name: 'Fogueteira Bia', party: [['miquito', 23], ['carvaozinho', 23], ['brasito', 23]], money: 480,
        intro: 'Minhas criaturas brilham como fogos de São João!', lose: 'Apagaram meus fogos...',
        after: 'Siga em frente. A Jandira está esperando.' } },
      { id: 'jandira', x: 5, z: 2, dir: 'down', look: 'jandira', trainer: {
        name: 'Líder Jandira', party: [['carcarazinho', 24], ['calangrao', 25], ['micoleao', 27]], money: 2800, leader: true,
        intro: 'Eita, que coragem! Sou JANDIRA, Líder do Ginásio de Mandacaru. Aqui no sertão o fogo forja os fortes. Vamos ver se você aguenta o calor!',
        lose: 'Que batalha arretada! Você mereceu, visse? Tome a sua insígnia.',
        after: 'Depois da chapada fica Cidade Relâmpago. Leve criaturas de PEDRA ou PLANTA para lá!',
        onWin: async G => {
          G.addBadge('chama');
          await G.say('{N} recebeu a INSÍGNIA CHAMA!', null, 'badge');
          await G.say('Guarde isso também. Vai ajudar nas próximas batalhas.', 'Jandira');
          G.giveItem('elixir', 2);
          await G.say('{N} recebeu 2 ELIXIRES!');
        } } },
    ],
  },

  // ------------------------------------------------------------ ROTA DA CHAPADA (tempestade elétrica)
  rota_chapada: {
    sky: 'chapada', name: 'Rota da Chapada', music: 'route', bg: 'grass',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTT..TTTT....TTTT..TTTT',
      'TT...GGGG.R.R..GGGGG..TT',
      'TT.R.GGGG..R...GGGGG.RTT',
      'TT...GGGGR.....GGGGG..TT',
      'TT....................TT',
      ',,,,,,,,,,,,,,,,,,,,,,,,',
      'TT....S...............TT',
      'TT..GGGGG...TT........TT',
      'TT..GGGGG.R...GGGGGG..TT',
      'TT..GGGGG..R..GGGGGG..TT',
      'TT..GGGGG...R.GGGGGG.RTT',
      'TT.R..........GGGGGG..TT',
      'TT....................TT',
      'TTTT..TTTT....TTTT..TTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 0, z: 6, to: 'mandacaru', tx: 24, tz: 12, dir: 'left' },
      { x: 23, z: 6, to: 'relampago', tx: 1, tz: 12, dir: 'right' },
    ],
    signs: [{ x: 6, z: 7, text: 'ROTA DA CHAPADA — Leste: CIDADE RELÂMPAGO. Não fique debaixo das árvores durante as tempestades!' }],
    items: [{ id: 'rc1', x: 20, z: 13, item: 'superorbe', n: 3 }],
    npcs: [
      { id: 'rcalp', x: 10, z: 5, dir: 'down', look: 'campista', sight: 3, trainer: {
        name: 'Alpinista Beto', party: [['pedrolho', 25], ['ourizito', 25], ['ararinha', 26]], money: 520,
        intro: 'Escalei cada pedra desta chapada! Agora é a sua vez de subir... na batalha!', lose: 'Escorreguei feio...',
        after: 'Quando os raios caem, os OURIZITOS acendem os espinhos. É lindo de ver!' } },
      { id: 'rcele', x: 16, z: 7, dir: 'up', look: 'eletricista', sight: 3, trainer: {
        name: 'Eletricista Duda', party: [['besourito', 26], ['bugiozap', 26], ['poraquinho', 26]], money: 540,
        intro: 'Estou consertando a torre de energia. Uma batalha para esquentar os fios!', lose: 'Deu curto-circuito!',
        after: 'O Líder TIÃO inventou metade das máquinas de Cidade Relâmpago.' } },
    ],
    encounters: { rate: 0.13, list: [['ourizito', 23, 26, 12], ['bugiozap', 23, 26, 10], ['besourito', 23, 26, 12], ['ararinha', 23, 26, 10], ['faiscatu', 23, 26, 8], ['pedrolho', 23, 26, 8], ['cristalito', 24, 26, 6], ['poraquinho', 24, 26, 6], ['seriemito', 23, 25, 8]] },
  },

  // ------------------------------------------------------------ CIDADE RELÂMPAGO (chapada) — GINÁSIO ELÉTRICO
  relampago: {
    sky: 'chapada', name: 'Cidade Relâmpago', music: 'city', bg: 'grass',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT......................TT',
      'TT......................TT',
      'TT......................TT',
      'TT......................TT',
      'TT......................TT',
      'TT......................TT',
      'TT..,,,,,,,,,,,,,,,,,,..TT',
      'TT..........,,..........TT',
      'TT.RR.....S.,,..GGGGG...TT',
      'TT..........,,..GGGGGRR.TT',
      'TT..........,,..........TT',
      ',,,,,,,,,,,,,,,,,,,,,,,,,,',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,S.........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..,,,,,,,,,,,,,,,,,,..TT',
      'TT..........,,..........TT',
      'TT......R........R......TT',
      'TT......................TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    buildings: [
      { x: 3, z: 2, w: 7, d: 5, style: 'gym', door: 3, to: 'ginasio4', label: 'GINÁSIO', roof: '#e0b020' },
      { x: 16, z: 2, w: 5, d: 5, style: 'center', door: 2, to: 'centro4', label: 'CENTRO' },
      { x: 4, z: 15, w: 4, d: 4, style: 'shop', door: 1, to: 'loja4', label: 'LOJA' },
      { x: 16, z: 15, w: 5, d: 4, style: 'house', roof: '#5a6aa0' },
    ],
    signs: [
      { x: 10, z: 9, text: 'CIDADE RELÂMPAGO — A cidade que nunca fica sem energia.' },
      { x: 14, z: 16, text: 'GINÁSIO DE RELÂMPAGO — Líder: TIÃO, o inventor dos trovões.' },
    ],
    warps: [
      { x: 0, z: 12, to: 'rota_chapada', tx: 22, tz: 6, dir: 'left' },
      { x: 25, z: 12, to: 'rota_igarape', tx: 1, tz: 6, dir: 'right' },
    ],
    npcs: [
      { id: 'rlprof', x: 8, z: 10, dir: 'down', look: 'vendedor', wander: true, talk: async G => {
        await G.say('Os raios da chapada carregam as baterias da cidade inteira. Até as criaturas daqui vivem eletrizadas!', 'Engenheira Sol');
      } },
      { id: 'rlkid', x: 19, z: 13, dir: 'left', look: 'garoto', wander: true, talk: async G => {
        await G.say('Criaturas ELÉTRICAS são fracas contra PEDRA e aguentam pouco golpe de PLANTA. O Tião odeia quando alguém descobre isso!');
      } },
      { id: 'rival_rl', x: 12, z: 10, dir: 'down', look: 'rival', sight: 3, cond: G => G.hasBadge('chama') && !G.flag('tr_rival_rl'), trainer: {
        name: 'Rival Gael', rival: true, money: 1500, party: G => [['gavialto', 28], ['rochedao', 28], ['trovatu', 28], [STARTER_LINE[G.state.rivalStarter || 'pingolote'][1], 30]],
        intro: 'Ei, {N}! Você também veio atrás das novas insígnias? Eu já tenho a Chama! Vamos ver quem cresceu mais desde a última vez!',
        lose: 'Hmpf... Você está ficando forte demais. Mas o campeão vai ser EU!',
        after: 'Nos vemos na Liga, {N}. Vou treinar como nunca!' } },
    ],
    encounters: { rate: 0.1, list: [['ourizito', 24, 26, 10], ['besourito', 24, 26, 10], ['bugiozap', 24, 26, 8]] },
  },
  centro4: centro('centro4', 'Cidade Relâmpago', { to: 'relampago', tx: 18, tz: 7 }),
  loja4: loja('loja4', 'Cidade Relâmpago', { to: 'relampago', tx: 5, tz: 19 }),

  ginasio4: {
    name: 'Ginásio de Relâmpago', interior: true, floor: 'metal', music: 'gym', bg: 'gym',
    rows: room(11, 14, 5),
    exit: { x: 5, z: 13, to: 'relampago', tx: 6, tz: 7 },
    furniture: [
      { type: 'coil', x: 1, z: 1 }, { type: 'coil', x: 9, z: 1 }, { type: 'coil', x: 1, z: 5 }, { type: 'coil', x: 9, z: 5 },
      { type: 'coil', x: 1, z: 9 }, { type: 'coil', x: 9, z: 9 }, { type: 'statue', x: 3, z: 11 }, { type: 'statue', x: 7, z: 11 },
    ],
    signs: [{ x: 3, z: 11, text: 'GINÁSIO DE RELÂMPAGO. Vencedores: GAEL' }, { x: 7, z: 11, text: 'Líder: TIÃO. Dica: Elétrico é fraco contra Pedra; Planta resiste bem.' }],
    npcs: [
      { id: 'g4inv', x: 3, z: 7, dir: 'right', look: 'eletricista', sight: 4, trainer: {
        name: 'Inventor Caio', party: [['ourizito', 26], ['faiscatu', 27]], money: 520,
        intro: 'Minha nova invenção: uma batalha em alta voltagem!', lose: 'Queimou o fusível...',
        after: 'O Tião diz que toda falha é só um protótipo.' } },
      { id: 'g4ele', x: 7, z: 4, dir: 'left', look: 'eletricista', sight: 3, trainer: {
        name: 'Eletricista Nina', party: [['besourito', 27], ['poraquinho', 27], ['bugiozap', 28]], money: 560,
        intro: 'Cuidado com os fios desencapados... e comigo!', lose: 'Fiquei sem sinal!',
        after: 'Vai lá. O Tião adora um desafio.' } },
      { id: 'tiao', x: 5, z: 2, dir: 'down', look: 'tiao', trainer: {
        name: 'Líder Tião', party: [['ourigado', 29], ['bugiovolt', 29], ['ararajuba', 30], ['trovatu', 31]], money: 3200, leader: true,
        intro: 'Opa! Um visitante! Sou TIÃO, Líder do Ginásio de Relâmpago e inventor nas horas vagas. Minhas criaturas são movidas a raio. Preparado para levar um choque de realidade?',
        lose: 'Incrível! Nem minhas contas previam isso. Você merece a INSÍGNIA RAIO!',
        after: 'Depois da cidade começa a floresta dos igarapés. Muito verde, muita água... muita vida!',
        onWin: async G => {
          G.addBadge('raio');
          await G.say('{N} recebeu a INSÍGNIA RAIO!', null, 'badge');
          await G.say('E leve estes orbes que eu mesmo aperfeiçoei!', 'Tião');
          G.giveItem('superorbe', 5);
          await G.say('{N} recebeu 5 SUPER ORBES!');
        } } },
    ],
  },

  // ------------------------------------------------------------ ROTA DOS IGARAPÉS (Amazônia)
  rota_igarape: {
    sky: 'amazonia', name: 'Rota dos Igarapés', music: 'forest', bg: 'grass',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTT..TTTT....TTTT..TTTT',
      'TT..GGGGG..WW..GGGGGG.TT',
      'TT..GGGGGT.WW..GGGGGG.TT',
      'TT..GGGGG..WW..GGGGGG.TT',
      'TT....................TT',
      ',,,,,,,,,,,,,,,,,,,,,,,,',
      'TT....S...............TT',
      'TT.GGGGGG.WWWW.......TTT',
      'TT.GGGGGG.WWWW.GGGGGG.TT',
      'TT.GGGGGG.WWWW.GGGGGG.TT',
      'TT.GGGGGG.WWWW.GGGGGG.TT',
      'TT.GGGGGGTWWWWTGGGGGG.TT',
      'TT........WWWW........TT',
      'TTTT..TTTT....TTTT..TTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 0, z: 6, to: 'relampago', tx: 24, tz: 12, dir: 'left' },
      { x: 23, z: 6, to: 'igarape', tx: 1, tz: 12, dir: 'right' },
    ],
    signs: [{ x: 6, z: 7, text: 'ROTA DOS IGARAPÉS — Leste: VILA IGARAPÉ. Respeite a floresta: ela é a casa de milhares de criaturas.' }],
    items: [{ id: 'ri1', x: 20, z: 13, item: 'reviver', n: 1 }],
    npcs: [
      { id: 'rimat', x: 9, z: 5, dir: 'down', look: 'mateiro', sight: 3, trainer: {
        name: 'Mateiro Joca', party: [['acaizinho', 29], ['antinha', 29], ['uirapuru', 30]], money: 600,
        intro: 'Conheço cada trilha desta mata. Duvido que você me vença aqui!', lose: 'A mata escolheu você...',
        after: 'Se ouvir o canto do UIRAPURU, fique quietinho. Dá sorte!' } },
      { id: 'ribot', x: 16, z: 7, dir: 'up', look: 'botanica', sight: 3, trainer: {
        name: 'Botânica Lina', party: [['orquidinha', 29], ['castanhito', 30], ['guaraninho', 30]], money: 620,
        intro: 'Estou catalogando as plantas da Amazônia. Quer ver as mais fortes?', lose: 'Você entende de natureza!',
        after: 'A Líder CECI é a guardiã desta floresta. Criaturas de FOGO e VOADOR funcionam contra ela.' } },
    ],
    encounters: { rate: 0.13, list: [['vitorinha', 27, 30, 10], ['acaizinho', 27, 30, 12], ['botinho', 27, 30, 8], ['castanhito', 27, 30, 10], ['guaraninho', 27, 30, 10], ['oncinha', 28, 30, 5], ['antinha', 27, 30, 10], ['uirapuru', 29, 30, 3], ['orquidinha', 27, 30, 8], ['maracujito', 27, 30, 8], ['preguito', 27, 30, 6]] },
  },

  // ------------------------------------------------------------ VILA IGARAPÉ (Amazônia) — GINÁSIO DE PLANTA
  igarape: {
    sky: 'amazonia', name: 'Vila Igarapé', music: 'city', bg: 'grass',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT......................TT',
      'TT......................TT',
      'TT......................TT',
      'TT......................TT',
      'TT......................TT',
      'TT......................TT',
      'TT..,,,,,,,,,,,,,,,,,,..TT',
      'TT..........,,..WWWWWW..TT',
      'TT.Tf.....S.,,..WWWWWW..TT',
      'TT..........,,..WWWWWW..TT',
      'TT..........,,..........TT',
      ',,,,,,,,,,,,,,,,,,,,,,,,,,',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,S.........TT',
      'TT......f...,,........f.TT',
      'TT..........,,..........TT',
      'TT..,,,,,,,,,,,,,,,,,,..TT',
      'TT.WWWW.....,,..........TT',
      'TT.WWWW........T......T.TT',
      'TT......................TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    buildings: [
      { x: 3, z: 2, w: 7, d: 5, style: 'gym', door: 3, to: 'ginasio5', label: 'GINÁSIO', roof: '#3a8a3a' },
      { x: 16, z: 2, w: 5, d: 5, style: 'center', door: 2, to: 'centro5', label: 'CENTRO' },
      { x: 4, z: 15, w: 4, d: 4, style: 'shop', door: 1, to: 'loja5', label: 'LOJA' },
      { x: 16, z: 15, w: 5, d: 4, style: 'house', roof: '#8a5a3a' },
    ],
    signs: [
      { x: 10, z: 9, text: 'VILA IGARAPÉ — Onde o rio e a floresta crescem juntos.' },
      { x: 14, z: 16, text: 'GINÁSIO DE IGARAPÉ — Líder: CECI, a guardiã da floresta.' },
    ],
    warps: [
      { x: 0, z: 12, to: 'rota_igarape', tx: 22, tz: 6, dir: 'left' },
      { x: 25, z: 12, to: 'rota_pantano', tx: 1, tz: 6, dir: 'right' },
    ],
    npcs: [
      { id: 'igpesc', x: 15, z: 11, dir: 'up', look: 'nadador', talk: async G => {
        await G.say('O boto-cor-de-rosa aparece no rio quando tem festa na vila. Já vi um BOTINHO pular três vezes seguidas!', 'Pescador Raimundo');
      } },
      { id: 'igvo', x: 8, z: 10, dir: 'down', look: 'velho', wander: true, talk: async G => {
        await G.say('Cada árvore desta floresta guarda uma história. A CASTANHEIRA mais velha tem mais de quinhentos anos!', 'Vô Benedito');
      } },
      { id: 'igmenina', x: 19, z: 20, dir: 'left', look: 'garota', wander: true, talk: async G => {
        await G.say('Depois daqui, a trilha entra no PANTANAL. Dizem que lá é sempre noite... e que a Equipe Sombra voltou a aparecer!');
      } },
    ],
  },
  centro5: centro('centro5', 'Vila Igarapé', { to: 'igarape', tx: 18, tz: 7 }),
  loja5: loja('loja5', 'Vila Igarapé', { to: 'igarape', tx: 5, tz: 19 }),

  ginasio5: {
    name: 'Ginásio de Igarapé', interior: true, floor: 'jungle', music: 'gym', bg: 'gym',
    rows: room(11, 14, 5),
    exit: { x: 5, z: 13, to: 'igarape', tx: 6, tz: 7 },
    furniture: [
      { type: 'tree', x: 1, z: 1 }, { type: 'tree', x: 9, z: 1 }, { type: 'tree', x: 1, z: 6 }, { type: 'tree', x: 9, z: 6 },
      { type: 'plant', x: 1, z: 10 }, { type: 'plant', x: 9, z: 10 }, { type: 'statue', x: 3, z: 11 }, { type: 'statue', x: 7, z: 11 },
    ],
    signs: [{ x: 3, z: 11, text: 'GINÁSIO DE IGARAPÉ. Vencedores: GAEL' }, { x: 7, z: 11, text: 'Líder: CECI. Dica: Planta é fraca contra Fogo, Voador e Inseto.' }],
    npcs: [
      { id: 'g5bot', x: 3, z: 8, dir: 'right', look: 'botanica', sight: 4, trainer: {
        name: 'Botânica Flora', party: [['maracujina', 31], ['vitorinha', 30]], money: 620,
        intro: 'As plantas deste ginásio foram plantadas pela Ceci. E eu cuido delas!', lose: 'Murchei...',
        after: 'A Ceci conversa com as árvores. Sério!' } },
      { id: 'g5mat', x: 7, z: 5, dir: 'left', look: 'mateiro', sight: 3, trainer: {
        name: 'Mateiro Davi', party: [['acaizeiro', 31], ['oncinha', 31], ['castanhito', 31]], money: 660,
        intro: 'Na floresta, quem não se adapta não cresce. Vamos lá!', lose: 'Você cresceu mais rápido que bambu!',
        after: 'Boa sorte com a guardiã.' } },
      { id: 'ceci', x: 5, z: 2, dir: 'down', look: 'ceci', trainer: {
        name: 'Líder Ceci', party: [['vitoriao', 33], ['castanhal', 33], ['guaranazao', 34], ['acaizeiro', 35]], money: 3600, leader: true,
        intro: 'Seja bem-vindo à floresta. Eu sou CECI, Líder do Ginásio de Igarapé. Minhas criaturas crescem com a chuva e com o sol. Mostre o que você aprendeu com as suas!',
        lose: 'A floresta sorriu para você hoje. Receba a INSÍGNIA FOLHA.',
        after: 'Cuide da natureza, e ela sempre vai cuidar de você.',
        onWin: async G => {
          G.addBadge('folha');
          await G.say('{N} recebeu a INSÍGNIA FOLHA!', null, 'badge');
          await G.say('Estas sementes curam qualquer cansaço. Quer dizer... estas POÇÕES!', 'Ceci');
          G.giveItem('superpocao', 4);
          await G.say('{N} recebeu 4 SUPER POÇÕES!');
        } } },
    ],
  },

  // ------------------------------------------------------------ ROTA DO PANTANAL (pântano noturno)
  rota_pantano: {
    sky: 'pantano', name: 'Rota do Pantanal', music: 'forest', bg: 'grass', dark: true,
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTT..TTTT....TTTT..TTTT',
      'TT..GGGG.WWWWW.GGGGG..TT',
      'TT.TGGGG.WWWWW.GGGGGWWTT',
      'TT..GGGG.WWWWW......WWTT',
      'TT....................TT',
      ',,,,,,,,,,,,,,,,,,,,,,,,',
      'TT....S...............TT',
      'TT.GGGGG.WWWWW.......TTT',
      'TT.GGGGG.WWWWW.GGGGGG.TT',
      'TT.GGGGG.WWWWW.GGGGGG.TT',
      'TT.GGGGG.WWWWW.GGGGGG.TT',
      'TT......T.....TGGGGGG.TT',
      'TT....................TT',
      'TTTT..TTTT....TTTT..TTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 0, z: 6, to: 'igarape', tx: 24, tz: 12, dir: 'left' },
      { x: 23, z: 6, to: 'neblina', tx: 1, tz: 12, dir: 'right' },
    ],
    signs: [{ x: 6, z: 7, text: 'ROTA DO PANTANAL — Leste: VILA NEBLINA. À noite, os olhos brilhando no brejo podem ser de jacaré...' }],
    items: [{ id: 'rp1', x: 20, z: 13, item: 'ultraorbe', n: 1 }],
    npcs: [
      grunt('rpgrunt1', 9, 5, 'down', 3, [['jiboiao', 32], ['morcegao', 33]], 700,
        'A Equipe Sombra voltou! Estamos atrás do BOITATÁ, a cobra de fogo do pantanal!', 'O quê?! Mas a Rainha disse que seria fácil...', 'sombra2'),
      grunt('rpgrunt2', 16, 7, 'up', 3, [['boitatinha', 33], ['medusombra', 33], ['sombrino', 33]], 720,
        'Ninguém atrapalha a caçada da Equipe Sombra. Nem uma criança!', 'Vou avisar a Admin Nyx... ela não vai gostar.'),
    ],
    encounters: { rate: 0.13, list: [['jacarezito', 31, 34, 10], ['piranhinha', 31, 34, 10], ['corujito', 31, 34, 10], ['boitatinha', 32, 34, 6], ['curupirito', 32, 34, 6], ['urutau', 33, 34, 4], ['sapito', 31, 34, 8], ['morcegote', 31, 34, 8], ['sombrino', 31, 34, 8], ['orquidinha', 31, 34, 6], ['jiboinha', 31, 34, 6]] },
  },

  // ------------------------------------------------------------ VILA NEBLINA (pântano) — GINÁSIO DE SOMBRA
  neblina: {
    sky: 'pantano', name: 'Vila Neblina', music: 'city', bg: 'grass', dark: true,
    rows: [
      'TTTTTTTTTTTT,,TTTTTTTTTTTT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..,,,,,,,,,,,,,,,,,,..TT',
      'TT..........,,..........TT',
      'TT.T......S.,,..WWWWWW..TT',
      'TT..........,,..WWWWWW..TT',
      'TT..........,,..........TT',
      ',,,,,,,,,,,,,,,,,,,,,,,,TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..........,,S.........TT',
      'TT..........,,..........TT',
      'TT..........,,..........TT',
      'TT..,,,,,,,,,,,,,,,,,,..TT',
      'TT.WWWWW....,,..........TT',
      'TT.WWWWW.T.....T......T.TT',
      'TT......................TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    buildings: [
      { x: 3, z: 2, w: 7, d: 5, style: 'gym', door: 3, to: 'ginasio6', label: 'GINÁSIO', roof: '#4a3a6a' },
      { x: 16, z: 2, w: 5, d: 5, style: 'center', door: 2, to: 'centro6', label: 'CENTRO' },
      { x: 4, z: 15, w: 4, d: 4, style: 'shop', door: 1, to: 'loja6', label: 'LOJA' },
      { x: 16, z: 15, w: 5, d: 4, style: 'house', roof: '#3a3a5a' },
    ],
    signs: [
      { x: 10, z: 9, text: 'VILA NEBLINA — Aqui a lua é a nossa lanterna.' },
      { x: 14, z: 16, text: 'GINÁSIO DE NEBLINA — Líder: LUAR, a voz das sombras. Norte: atalho para a ROTA VITÓRIA.' },
    ],
    warps: [
      { x: 0, z: 12, to: 'rota_pantano', tx: 22, tz: 6, dir: 'left' },
      { x: 12, z: 0, to: 'rotavitoria', tx: 18, tz: 4, dir: 'up' },
      { x: 13, z: 0, to: 'rotavitoria', tx: 18, tz: 4, dir: 'up' },
    ],
    npcs: [
      { id: 'nbvelha', x: 8, z: 10, dir: 'down', look: 'velho', wander: true, talk: async G => {
        await G.say('Aqui as pessoas contam histórias de CURUPIRA, BOITATÁ e MULA SEM CABEÇA. As crianças morrem de medo... e de vontade de ver!', 'Dona Cida');
      } },
      { id: 'nbkid', x: 19, z: 13, dir: 'left', look: 'garoto', wander: true, talk: async G => {
        await G.say('Criaturas de SOMBRA são fracas contra SOMBRA e INSETO. A Luar sempre sorri quando alguém descobre isso.');
      } },
      { id: 'nbguia', x: 14, z: 3, dir: 'down', look: 'guarda', talk: async G => {
        await G.say('Esta trilha ao norte é um atalho direto para a ROTA VITÓRIA e a LIGA. Com seis insígnias, a Liga aceita o seu desafio!', 'Guarda');
      } },
    ],
  },
  centro6: centro('centro6', 'Vila Neblina', { to: 'neblina', tx: 18, tz: 7 }),
  loja6: loja('loja6', 'Vila Neblina', { to: 'neblina', tx: 5, tz: 19 }),

  ginasio6: {
    name: 'Ginásio de Neblina', interior: true, floor: 'dark', music: 'gym', bg: 'cave',
    rows: room(11, 14, 5),
    exit: { x: 5, z: 13, to: 'neblina', tx: 6, tz: 7 },
    furniture: [
      { type: 'lantern', x: 1, z: 1 }, { type: 'lantern', x: 9, z: 1 }, { type: 'lantern', x: 1, z: 5 }, { type: 'lantern', x: 9, z: 5 },
      { type: 'lantern', x: 1, z: 9 }, { type: 'lantern', x: 9, z: 9 }, { type: 'statue', x: 3, z: 11 }, { type: 'statue', x: 7, z: 11 },
    ],
    signs: [{ x: 3, z: 11, text: 'GINÁSIO DE NEBLINA. Vencedores: GAEL' }, { x: 7, z: 11, text: 'Líder: LUAR. Dica: Sombra é fraca contra Sombra e Inseto.' }],
    npcs: [
      { id: 'g6med', x: 3, z: 7, dir: 'right', look: 'medium', sight: 4, trainer: {
        name: 'Médium Vera', party: [['assombrado', 34], ['urutau', 34]], money: 700,
        intro: 'Os espíritos me contaram que você viria... e que ia perder!', lose: 'Os espíritos erraram...',
        after: 'A Luar enxerga o que ninguém vê.' } },
      { id: 'g6cac', x: 7, z: 4, dir: 'left', look: 'mateiro', sight: 3, trainer: {
        name: 'Caçador Noturno Ivo', party: [['jacarezito', 34], ['piranhao', 35], ['corujao', 35]], money: 740,
        intro: 'No escuro, eu vejo tudo. Você consegue dizer o mesmo?', lose: 'Fui pego de surpresa!',
        after: 'Siga as lanternas até a Luar.' } },
      { id: 'luar', x: 5, z: 2, dir: 'down', look: 'luar', trainer: {
        name: 'Líder Luar', party: [['corujao', 36], ['orquinoite', 37], ['curupirao', 37], ['jacarezao', 38], ['boitata', 39]], money: 4200, leader: true,
        intro: 'Shhh... escute a névoa. Sou LUAR, Líder do Ginásio de Neblina. As sombras não são más: são só o lugar onde a luz descansa. Vamos ver se a sua luz aguenta a minha noite?',
        lose: 'Sua luz é mais forte do que eu imaginava. A INSÍGNIA LUA é sua.',
        after: 'Com seis insígnias, a Liga espera por você. O atalho ao norte leva direto até lá.',
        onWin: async G => {
          G.addBadge('lua');
          await G.say('{N} recebeu a INSÍGNIA LUA!', null, 'badge');
          await G.say('Seis insígnias! Agora você pode desafiar a LIGA DAS CRIATURAS. Leve isto... vai precisar.', 'Luar');
          G.giveItem('ultraorbe', 2);
          await G.say('{N} recebeu 2 ULTRA ORBES!');
        } } },
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
  await G.say('Ufa! Foi por pouco! É perigoso! Criaturas selvagens vivem no MATO ALTO!', 'Prof. Ipê');
  await G.say('Você precisa de uma criatura parceira para se proteger. Venha comigo até o laboratório!', 'Prof. Ipê');
  await G.fade(async () => {
    p.hide();
    await G.warp('lab', 5, 4, 'up', true);
  });
  await G.say('Vô! Cansei de esperar!', 'Gael');
  await G.say('Gael? Ah, é mesmo, pedi para você vir. Espere um pouco.', 'Prof. Ipê');
  await G.say('{N}, ali naquela mesa há três criaturas dentro de orbes.', 'Prof. Ipê');
  await G.say('Quando eu era jovem, fui um treinador sério. Hoje só tenho esses três. Pode escolher um! Vá em frente!', 'Prof. Ipê');
  await G.say('Ei! Vô! E eu?', 'Gael');
  await G.say('Calma, Gael. Você também vai poder escolher. Deixe {N} escolher primeiro.', 'Prof. Ipê');
}

async function pickStarter(G, sp, col) {
  if (!G.flag('metProf')) { await G.say('Um orbe. Melhor não mexer sem o Prof. Ipê.'); return; }
  if (G.flag('starter')) { await G.say('O Prof. Ipê está guardando esta criatura com carinho.'); return; }
  const info = { brasito: ['BRASITO', 'FOGO'], pingolote: ['PINGOLOTE', 'ÁGUA'], capibroto: ['CAPIBROTO', 'PLANTA'] }[sp];
  await G.showCreature(sp);
  const r = await G.ask(`Você escolhe ${info[0]}, a criatura de tipo ${info[1]}?`, ['Sim', 'Não'], 'Prof. Ipê');
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
  await G.say('Espera aí, {N}! Vamos ver qual criatura é mais forte!', 'Gael');
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
    intro: '', lose: 'O quê?! Eu escolhi a criatura errada!', winText: 'Hahaha! Eu sou demais!',
  });
  G.set('rival1');
  if (!won) await G.say('Viu só? Eu vou ser o maior treinador do mundo!', 'Gael');
  await G.say('Vou treinar minha criatura até ela ficar invencível. Até mais, {N}!', 'Gael');
  const side = px === 5 ? 4 : 5;
  const hz = side > rv.x ? Array(side - rv.x).fill('right') : Array(rv.x - side).fill('left');
  await rv.walk([...hz, 'down', 'down', 'down']);
  rv.hide();
  G.healParty();
  await G.say('Sua criatura está cansada. Deixe-me curá-la.', 'Prof. Ipê');
  await G.say('Suas criaturas foram curadas!');
  await G.say('{N}, se você for até PEDRA-VERDE, ao norte da Rota 1, passe na loja. Estou esperando uma encomenda.', 'Prof. Ipê');
  G.refresh();
}

async function profTalk(G) {
  if (!G.flag('starter')) {
    if (G.flag('metProf')) await G.say('Escolha uma das criaturas na mesa, {N}!', 'Prof. Ipê');
    else await G.say('Olá! Sou o Prof. Ipê. Estou pesquisando sobre criaturas.', 'Prof. Ipê');
    return;
  }
  if (G.flag('encomenda') && !G.flag('dex')) {
    await G.say('Ah! Minha encomenda! Obrigado, {N}!', 'Prof. Ipê');
    G.takeItem('encomenda');
    await G.say('Isto aqui é uma CRIATURADEX! Uma enciclopédia que registra toda criatura que você vê ou captura.', 'Prof. Ipê');
    G.set('dex');
    await G.say('{N} recebeu a CRIATURADEX!', null, 'fanfare');
    await G.say('E para capturar criaturas selvagens, use estes ORBES. Enfraqueça a criatura antes de jogar!', 'Prof. Ipê');
    G.giveItem('orbe', 5);
    await G.say('{N} recebeu 5 ORBES!');
    await G.say('Meu sonho é completar a Criaturadex. Conto com você! E se quiser se tornar um grande treinador, vença os Ginásios e desafie a LIGA!', 'Prof. Ipê');
    return;
  }
  if (G.flag('campeao')) {
    const n = ['solaris', 'abissal', 'iperion', 'trovonca'].filter(k => G.flag('lend_' + k)).length;
    await G.say(`Lendários protegidos por você: ${n} de 4.`, 'Prof. Ipê');
    if (n < 4) await G.say('Ipêrion no Santuário da Floresta, Abissal na Gruta Abissal, Trovonça no Pico Trovão e Solaris na Rota Vitória. A Equipe Sombra não pode pegá-los!', 'Prof. Ipê');
    else await G.say('Todos os 4! Você é uma lenda, {N}!', 'Prof. Ipê');
  }
  if (G.flag('dex')) {
    const n = G.caughtCount();
    await G.say(`Vamos ver sua Criaturadex... Você já capturou ${n} criaturas e viu ${G.seenCount()}!`, 'Prof. Ipê');
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
  await G.say('{N}! Parabéns! Você é o novo CAMPEÃO da Liga das Criaturas!', 'Prof. Ipê');
  await G.say('Gael... Você perdeu porque esqueceu de confiar e cuidar das suas criaturas. Sem isso, ninguém cresce de verdade.', 'Prof. Ipê');
  await G.say('...Eu entendi, vô. {N}, da próxima vez eu vou vencer do jeito certo.', 'Gael');
  await G.say('{N}, venha comigo. Vamos registrar você e suas criaturas no SALÃO DOS CAMPEÕES!', 'Prof. Ipê');
  G.set('campeao');
  G.healParty();
  await G.credits();
  await G.say('{N}, notícias urgentes! A Equipe Sombra voltou, agora comandada pela misteriosa RAINHA ECLIPSE!', 'Prof. Ipê');
  await G.say('Ela quer capturar as 4 criaturas LENDÁRIAS para cobrir o mundo com uma noite sem fim!', 'Prof. Ipê');
  await G.say('IPÊRION, no Santuário da Floresta, a leste da Floresta Sussurro. ABISSAL, na Gruta Abissal, na praia de Cidade Maré.', 'Prof. Ipê');
  await G.say('TROVONÇA, no Pico Trovão, a oeste da Rota Vitória. E SOLARIS, aqui mesmo na Rota Vitória!', 'Prof. Ipê');
  await G.say('Os guardas liberaram os caminhos para você. Leve estas ULTRA ORBES. Conto com você!', 'Prof. Ipê');
  G.giveItem('ultraorbe', 5);
  await G.say('{N} recebeu 5 ULTRA ORBES!', null, 'fanfare');
  G.set('posjogo');
  p.hide();
}

export function rivalFinalParty(G) {
  const line = STARTER_LINE[G.state.rivalStarter || 'pingolote'];
  return [['gavialto', 40], ['trovatu', 40], ['rochedao', 41], ['oncapintada', 41], ['carcarasa', 42], [line[2], 44]];
}
