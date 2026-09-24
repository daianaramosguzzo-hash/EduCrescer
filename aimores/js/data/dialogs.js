// Diálogos com os NPCs. Cada nó: { who, t, choices: [{ t, to, if, do, op, tag, check, trade }], next, do }
// who: 'npc' | 'hero' (quem conversa) | id de herói (só aparece se estiver vivo) | 'narr'
// op: opinião do grupo sobre a escolha (muda moral e relacionamento)
import { flag, hero, anyHeroHas, takeFromParty, giveParty, questStart, questAdvance, questDone, questStep, Q, addClue, scene } from '../game/story.js';
import { ITEMS } from './items.js';
import { countItem } from '../game/units.js';
import { rng, bus } from '../util.js';

const met = (id) => (g) => { const k = 'conheceu_' + id; const v = !!g.state.flags[k]; g.state.flags[k] = true; return v; };
const foodCount = g => g.liveHeroes.reduce((s, h) => s + h.inv.filter(e => ITEMS[e.id].cat === 'comida').reduce((a, e) => a + e.n, 0), 0);
function takeFood(g, n) {
  for (const h of g.liveHeroes) for (let i = h.inv.length - 1; i >= 0 && n > 0; i--) {
    const e = h.inv[i];
    if (ITEMS[e.id].cat !== 'comida') continue;
    const k = Math.min(e.n, n); e.n -= k; n -= k;
    if (e.n <= 0) h.inv.splice(i, 1);
  }
  bus.emit('hud');
  return n <= 0;
}
function toChurch(g, u) {
  // manda o NPC para a igreja (conta como sobrevivente salvo)
  const ig = g.map.buildings.find(b => b.type === 'igreja');
  const cells = g.buildingCells(ig.id);
  const [x, z] = cells[Math.floor(rng.next() * cells.length)];
  u.x = x; u.z = z; g.S.units.snap(u);
  u.faction = 'neutral'; u.ai.comport = 'parado';
  if (!g.state.saved.includes(u.name)) g.state.saved.push(u.name);
  flag(g, 'refugio_' + ig.id, true);
  g.log(`⛪ ${u.name} foi para a Igreja Matriz.`, 'bom');
}
function makeAlly(g, u) {
  u.faction = 'ally'; u.ai.comport = 'segue';
  u.maxAp = 7;
  g.S.units.setHp(u, true);
  g.log(`🤝 ${u.name} se juntou ao grupo e vai seguir vocês.`, 'bom');
}

export const DIALOGS = {
  // ================================================================ SEU ZÉ
  ze: {
    start: g => met('ze')(g) ? 'menu' : 'intro',
    nodes: {
      intro: { who: 'npc', t: 'Ô trem bão! Gente viva! Entra, entra, mas fecha a porta que tá entrando zumbi e pernilongo. Aqui é o Mercadinho do Zé: trinta e dois anos de fiado, e não é agora que eu vou fechar as portas.',
        choices: [
          { t: 'O senhor está bem, Seu Zé?', to: 'bem' },
          { t: 'A gente precisa de comida e água.', to: 'comida' },
          { t: 'O senhor tá VENDENDO? No apocalipse?', if: g => hero(g, 'pablicio'), to: 'vendendo' },
        ] },
      bem: { who: 'npc', t: 'Bem? Eu tenho 71 anos, pressão alta e um facão. Tô ótimo. O problema é que perdi a caderneta do fiado. Metade de Aimorés me deve, e agora metade de Aimorés tá morta. A outra metade vai ter que pagar em dobro.',
        choices: [
          { t: 'A gente acha a caderneta pro senhor.', op: { carol: 1, arthur: 1 }, to: 'caderneta_ok', if: g => !Q(g, 'caderneta') },
          { t: 'Isso não é prioridade agora, Seu Zé.', op: { pablicio: 1 }, to: 'menu' },
        ] },
      caderneta_ok: { who: 'npc', t: 'Deus te pague! Acho que esqueci no balcão do Bar do Tião, na Avenida Rio Doce, perto da Rua das Palmeiras. Eu passo lá toda sexta pra cobrar o Tião... e tomar uma, né.',
        do: g => questStart(g, 'caderneta'), next: 'menu' },
      comida: { who: 'npc', t: 'Comida eu tenho. Dinheiro não vale mais nada, então é na troca: remédio, bala de revólver, cachaça boa... Trocar é o novo pagar.', next: 'menu' },
      vendendo: { who: 'pablicio', t: 'Seu Zé, o senhor tá VENDENDO? No apocalipse zumbi?', next: 'vendendo2' },
      vendendo2: { who: 'npc', t: 'Uai, e vou fazer o quê? Dar? Se o mundo acabou, pelo menos o comércio continua. Isso aqui é Minas, sô.', next: 'menu' },
      menu: { who: 'npc', t: g => flag(g, 'ze_desconto') ? 'Freguesia de ouro! Vai levar o quê hoje? Pra vocês é preço de amigo.' : 'E aí, freguesia? Vai levar o quê hoje?',
        choices: [
          { t: 'Vamos negociar.', trade: true, to: 'menu' },
          { t: 'Achamos sua caderneta!', if: g => anyHeroHas(g, 'caderneta'), to: 'devolver' },
          { t: 'Alguma novidade na cidade?', to: 'rumores' },
          { t: 'Até mais, Seu Zé.', to: null },
        ] },
      devolver: { who: 'npc', t: 'MINHA CADERNETA! Olha aqui: o Tião me deve 43 reais, o prefeito 12, e o padre... bom, o padre deixa pra lá. Toma, leva isso. E daqui pra frente vocês têm desconto de freguês de ouro!',
        do: g => { takeFromParty(g, 'caderneta'); giveParty(g, null, 'galao', 1); giveParty(g, null, 'feijoada_lata', 3); flag(g, 'ze_desconto', true); questDone(g, 'caderneta'); }, next: 'menu' },
      rumores: { who: 'npc', t: () => rng.pick([
        'O pessoal dos Lobos do Asfalto tomou o posto. Tão cobrando pedágio até de quem passa a pé.',
        'Vi a Dra. Lívia, da AgroNova, correndo pra estação de madrugada, com uma mochila e cara de quem viu assombração.',
        'Dizem que zumbi não gosta de calor. Eu digo que ninguém gosta de calor em Aimorés.',
        'A Dona Cotinha tá atirando em tudo que se mexe. Até num pé de manga.',
        'O Seu Valdir, da oficina, tem um Opala que é um brinco. Se alguém consertar, sai dessa cidade voando.',
        'O Padre Anselmo abriu a Matriz pra quem precisar. Toca o sino ao meio-dia. Eu acho arriscado, mas quem sou eu.',
      ]), next: 'menu' },
    },
  },

  // ================================================================ DONA GRAÇA
  graca: {
    start: g => met('graca')(g) ? 'menu' : 'intro',
    nodes: {
      intro: { who: 'npc', t: 'Quem tá aí?! Eu tô armada! ...Com um termômetro. Mas tô!',
        choices: [
          { t: 'Calma, Dona Graça! Somos gente. Viva.', to: 'calma' },
          { t: 'Dona Graça, sou eu, a Carol. A senhora tá machucada?', tag: '[Acolher]', if: g => hero(g, 'carol'), to: 'carol' },
        ] },
      calma: { who: 'npc', t: 'Graças a Deus. Desculpa. Desde ontem eu não sei mais quem é gente e quem é... aquilo.', next: 'menu' },
      carol: { who: 'npc', t: 'Carol! Ô, criatura, que bom te ver! Machucada não, só com o coração na mão. Senta aí, toma uma água.', do: g => { const c = hero(g, 'carol'); if (c) c.need.moral = Math.min(100, c.need.moral + 10); }, next: 'menu' },
      menu: { who: 'npc', t: g => flag(g, 'insulina_entregue') ? 'O Arlindo tá bem, graças a vocês. O que precisarem de remédio, é só pedir.' : 'Posso ajudar com remédio, se tiverem o que trocar.',
        choices: [
          { t: 'Vamos negociar remédios.', trade: true, to: 'menu' },
          { t: 'A senhora precisa de alguma coisa?', if: g => !Q(g, 'insulina'), to: 'insulina' },
          { t: 'O que a senhora sabe da AgroNova?', if: g => questStep(g, 'origem') === 'graca', to: 'agronova' },
          { t: 'Recado do Seu Arlindo: ele tá bem!', if: g => flag(g, 'insulina_entregue') && !flag(g, 'graca_premio'), to: 'premio' },
          { t: 'Até logo, Dona Graça.', to: null },
        ] },
      insulina: { who: 'npc', t: 'Meu marido, o Arlindo, é diabético. A insulina dele acabou ontem e eu não consegui voltar pra casa. Ele tá sozinho, trancado lá com as armadilhas dele — ele é desses que se prepara pro fim do mundo, sabe? Se acharem insulina, levem pra ele. Por favor.',
        choices: [
          { t: 'Pode deixar, a gente leva.', op: { carol: 2 }, do: g => questStart(g, 'insulina'), to: 'menu' },
          { t: 'Vamos ver o que dá pra fazer.', do: g => questStart(g, 'insulina'), to: 'menu' },
        ] },
      agronova: { who: 'npc', t: 'AgroNova? A firma do galpão perto da ponte? Engraçado você perguntar... A Dra. Lívia, que trabalha lá, veio aqui três dias atrás e comprou TODO o meu antibiótico. Tava branca, tremendo. Perguntei se era pra ela e ela disse: "é pra cidade inteira, Dona Graça". Ela mora na Rua Sete de Setembro, do lado da Dona Cotinha.',
        do: g => { questAdvance(g, 'origem', 'graca'); addClue(g, 'graca_livia', 'A Dra. Lívia (AgroNova) comprou todo o antibiótico da farmácia dizendo que era "para a cidade inteira". Mora na Rua Sete de Setembro.'); }, next: 'menu' },
      premio: { who: 'npc', t: 'Ele mandou recado pelo rádio: tá bem, tá forte, e já tá reclamando da comida enlatada. Toma, leva esse kit. É o mínimo.',
        do: g => { flag(g, 'graca_premio', true); giveParty(g, null, 'kit_medico', 1); giveParty(g, null, 'antibiotico', 1); }, next: 'menu' },
    },
  },

  // ================================================================ SEU ARLINDO
  arlindo: {
    start: g => met('arlindo')(g) ? 'menu' : 'intro',
    nodes: {
      intro: { who: 'npc', t: 'PARADOS! Esse corredor tem armadilha! ...Ou tinha, se vocês já pisaram. Quem mandou vocês aqui? A Graça? Ela tá viva?!',
        choices: [{ t: 'Tá sim, escondida na farmácia.', to: 'graca' }, { t: 'A gente só estava explorando.', to: 'graca' }] },
      graca: { who: 'npc', t: 'Dez anos me preparando pro fim do mundo: comida enlatada, gerador, armadilha de urso... e eu esqueci de estocar a porcaria da insulina. Tô tremendo desde ontem.', next: 'menu' },
      menu: { who: 'npc', t: 'Precisam de alguma coisa? Dica de sobrevivência: zumbi não sobe escada. Pena que Aimorés é tudo casa térrea.',
        choices: [
          { t: 'Trouxemos insulina pro senhor.', if: g => anyHeroHas(g, 'insulina') && !flag(g, 'insulina_entregue'), to: 'entrega' },
          { t: 'A gente vai procurar insulina.', if: g => !Q(g, 'insulina'), do: g => questStart(g, 'insulina'), to: 'menu' },
          { t: 'Alguma dica de sobrevivência?', to: 'dica' },
          { t: 'Até mais, Seu Arlindo.', to: null },
        ] },
      entrega: { who: 'npc', t: 'Vocês salvaram minha vida. De verdade. Esperem aí... Toma: meu rifle de caça e a munição. E um kit médico. Não adianta ter arsenal e não ter amigo.',
        do: g => { takeFromParty(g, 'insulina'); giveParty(g, null, 'rifle', 1); giveParty(g, null, 'mun_rifle', 12); giveParty(g, null, 'kit_medico', 1); flag(g, 'insulina_entregue', true); if (Q(g, 'insulina')) { Q(g, 'insulina').step = 1; questDone(g, 'insulina'); } },
        next: 'menu' },
      dica: { who: 'npc', t: () => rng.pick([
        'Barulho atrai. Tiro atrai muito. Se precisar atirar, atira e sai de perto.',
        'Esconda-se no escuro, perto de arbusto, carro ou guarda-roupa. Eles passam do lado e não veem.',
        'Molotov: garrafa, pano e gasolina. Ou cachaça, se for das boas.',
        'Pedrinha jogada longe faz os zumbis olharem pro outro lado. Truque de pescador.',
        'Barricada: duas tábuas, pregos e um martelo. Porta barricada aguenta muita pancada.',
        'Mordida é diferente de arranhão. Mordida infecciona. Antibiótico segura, mas não cura.',
      ]), next: 'menu' },
    },
  },

  // ================================================================ DONA COTINHA
  cotinha: {
    start: g => met('cotinha')(g) ? 'menu' : 'intro',
    nodes: {
      intro: { who: 'npc', t: 'PARA AÍ! Mais um passo e eu mando chumbo! ...Ah. Vocês têm cara de gente. Zumbi não tem essa cara de assustado.',
        choices: [
          { t: 'Calma, Dona Cotinha, a gente só tá passando.', to: 'passando' },
          { t: 'A senhora tá sozinha? Precisa de alguma coisa?', tag: '[Acolher]', if: g => hero(g, 'carol'), to: 'sozinha' },
          { t: 'Que espingarda maneira!', if: g => hero(g, 'arthur'), to: 'maneira' },
        ] },
      maneira: { who: 'npc', t: 'Era do meu falecido, o Vardemar. Calibre 12, dois canos. Já derrubou três zumbis e um pé de manga.', next: 'passando' },
      sozinha: { who: 'npc', t: 'Sozinha eu tô desde que o Vardemar morreu, meu anjo. Mas agora tô sem o Bolinho também...', next: 'passando' },
      passando: { who: 'npc', t: 'Se virem um gato laranja, gordo e com cara de ofendido, é o Bolinho. Fugiu pra casa lá no fim da rua, aquela que tá cheia daqueles bichos. Ele é muito educado, não arranha ninguém. Quase ninguém.',
        choices: [
          { t: 'A gente procura o Bolinho.', op: { carol: 1, arthur: 1 }, if: g => !Q(g, 'gato'), do: g => questStart(g, 'gato'), to: null },
          { t: 'Não dá, desculpa. Temos outras prioridades.', op: { pablicio: 1, carol: -1 }, to: null },
          { t: 'Até mais.', if: g => !!Q(g, 'gato'), to: null },
        ] },
      menu: { who: 'npc', t: g => flag(g, 'cotinha_amiga') ? 'Meus heróis! O Bolinho mandou um beijo. Querem trocar alguma coisa?' : 'E então? Acharam meu Bolinho?',
        choices: [
          { t: 'Achamos o Bolinho!', if: g => anyHeroHas(g, 'gato'), to: 'devolve' },
          { t: 'Vamos trocar umas coisas.', if: g => flag(g, 'cotinha_amiga'), trade: true, to: 'menu' },
          { t: 'Ainda não. Até logo.', to: null },
        ] },
      devolve: { who: 'npc', t: 'BOLINHO! Meu bebê! Olha como ele tá magro!', next: 'devolve2' },
      devolve2: { who: 'arthur', t: 'Ele tá... exatamente do mesmo tamanho.', next: 'devolve3' },
      devolve3: { who: 'npc', t: 'Tá magro sim! Tomem, vocês merecem: a espingarda do Vardemar e os cartuchos. Eu vou pra igreja com o Bolinho. Lá tem o padre e tem café.',
        do: (g, c) => { takeFromParty(g, 'gato'); giveParty(g, null, 'espingarda', 1); giveParty(g, null, 'mun_espingarda', 8); giveParty(g, null, 'pamonha', 2); flag(g, 'cotinha_amiga', true); if (Q(g, 'gato')) { Q(g, 'gato').step = 1; questDone(g, 'gato'); } toChurch(g, c.npc); },
        next: null },
    },
  },

  // ================================================================ JUNINHO
  juninho: {
    start: g => flag(g, 'juninho_aberto') ? 'menu' : 'porta',
    nodes: {
      porta: { who: 'npc', t: 'Vai embora! Aqui não tem nada! Só... só um cara muito perigoso! Com faca! Muitas facas!',
        do: g => questStart(g, 'juninho'),
        choices: [
          { t: 'Juninho? É a professora Daiana!', if: g => hero(g, 'daiana'), to: 'daiana' },
          { t: 'Ei, a gente não vai te machucar. Você tá com fome?', tag: '[Acolher]', if: g => hero(g, 'carol'), check: { skill: 'coracao_acolhedor', dc: 40, ok: 'abre', fail: 'nao' } },
          { t: 'Mano, a gente precisa de alguém que entende de rádio. Você entende?', if: g => hero(g, 'arthur'), check: { stat: 'inteligencia', dc: 45, ok: 'abre', fail: 'nao' } },
          { t: 'ABRE ESSA PORTA, MOLEQUE!', if: g => hero(g, 'pablicio'), op: { carol: -1 }, to: 'grito' },
          { t: 'Tudo bem, a gente volta depois.', to: null },
        ] },
      daiana: { who: 'npc', t: 'Professora Daiana?! Da recuperação de Física?! ...Tá bom, tá bom. Eu abro. Mas eu passei na recuperação, tá?', next: 'abre' },
      nao: { who: 'npc', t: 'N-não sei... Voltem outra hora. Com... com biscoito, talvez.', next: null },
      grito: { who: 'npc', t: 'AAAAH! NÃO! Agora é que eu não abro mesmo! Vai gritar com zumbi!', next: null },
      abre: { who: 'narr', t: '🔓 Um clique. A porta abre uma frestinha. Um par de olhos arregalados, um fone de ouvido verde-limão e um cano de ferro aparecem.',
        do: g => { flag(g, 'juninho_aberto', true); const d = [...g.map.doors.values()].find(d => d.knock === 'juninho'); if (d) { d.locked = false; d.open = true; g.S.world.refreshDoor(g.map.idx(d.x, d.z)); } questAdvance(g, 'juninho', 'convencer'); },
        next: 'conta' },
      conta: { who: 'npc', t: 'Eu sou o Juninho. Tô trancado aqui desde anteontem. Eu tava montando um rádio amador pra ouvir o que tá acontecendo lá fora, mas preciso de uma bateria de carro pra ligar. No ferro-velho do Bigode, perto dos trilhos, deve ter.', next: 'menu' },
      menu: { who: 'npc', t: g => flag(g, 'juninho_bateria') ? 'O rádio tá funcionando! Se precisarem de alguém pra consertar transmissor, eu tô aqui.' : 'Conseguiram a bateria?',
        choices: [
          { t: 'Toma a bateria de carro.', if: g => anyHeroHas(g, 'bateria_carro') && !flag(g, 'juninho_bateria'), to: 'bateria' },
          { t: 'Vamos trocar pilhas e peças.', trade: true, to: 'menu' },
          { t: 'Vem com a gente, Juninho!', if: (g, c) => flag(g, 'juninho_bateria') && c.npc.faction !== 'ally', to: 'recrutar' },
          { t: 'Até mais.', to: null },
        ] },
      bateria: { who: 'npc', t: 'É ESSA! Pera aí... jacaré aqui, fio ali, fita... e... *chiiiiado*... PEGOU!',
        do: g => { takeFromParty(g, 'bateria_carro'); flag(g, 'juninho_bateria', true); }, next: 'bateria2' },
      bateria2: { who: 'narr', t: '📻 <i>Uma voz metálica, gravada, repete em loop:</i> — Protocolo Vale Seguro. A área urbana de Aimorés será esterilizada às 06h00 do dia 6. A evacuação está encerrada.',
        do: g => { flag(g, 'sabe_prazo', true); flag(g, 'radio_prazo', true); questDone(g, 'juninho'); g.log('⏰ Prazo: a cidade será bombardeada às 06:00 do dia 6.', 'perigo'); }, next: 'bateria3' },
      bateria3: { who: 'npc', t: 'Esterilizada... isso é bomba, né? Eu sabia! Olha: a Rádio Aimorés FM tem um transmissor potente. Se alguém consertar, dá pra falar direto com o exército. Eu sei consertar. Se precisarem, é só chamar.', next: 'menu' },
      recrutar: { who: 'npc', t: 'Sério? Eu? Tá... tá bom! Mas se aparecer zumbi eu fico atrás do grandão.', do: (g, c) => { makeAlly(g, c.npc); flag(g, 'juninho_aliado', true); }, next: null },
    },
  },

  // ================================================================ PADRE ANSELMO
  padre: {
    start: g => met('padre')(g) ? 'menu' : 'intro',
    nodes: {
      intro: { who: 'npc', t: 'Entrem, entrem! A casa de Deus está de portas abertas — mas fechem a porta depois, por favor. Deus protege, mas a tranca ajuda.', next: 'menu' },
      menu: { who: 'npc', t: g => `Temos ${g.state.saved.length} pessoa(s) abrigada(s) aqui. Em que posso ajudar?`,
        choices: [
          { t: 'Podemos trazer sobreviventes para cá?', to: 'refugio' },
          { t: 'Padre, alguém aqui pode cuidar dos nossos feridos?', if: g => !flag(g, 'cura_padre_' + g.day()), to: 'cura' },
          { t: 'Podemos rezar um minuto?', if: g => hero(g, 'carol') && !flag(g, 'reza_' + g.day()), to: 'rezar' },
          { t: 'A igreja aguenta uma noite de ataque?', if: g => g.state.saved.length >= 3 && !Q(g, 'defesa'), to: 'defesa' },
          { t: 'Até logo, padre.', to: null },
        ] },
      refugio: { who: 'npc', t: 'Tragam quem precisar. Temos água do poço, pão e um sino que eu toco ao meio-dia pra afastar os mortos. Ou atrair. Ainda não descobri. E vocês podem dormir aqui também, se quiserem.',
        do: g => { const ig = g.map.buildings.find(b => b.type === 'igreja'); flag(g, 'refugio_' + ig.id, true); }, next: 'menu' },
      cura: { who: 'npc', t: 'A Irmã Lourdes era enfermeira antes de ser freira. Irmã! ...Pronto, ela cuidou de todos. Voltem amanhã se precisarem.',
        do: g => { flag(g, 'cura_padre_' + g.day(), true); for (const h of g.liveHeroes) { h.hp = Math.min(h.maxHp, h.hp + 25); h.st.bleed = 0; for (const w of h.wounds) w.tratado = true; } g.log('⛪ A Irmã Lourdes tratou os ferimentos do grupo (+25 de vida).', 'bom'); }, next: 'menu' },
      rezar: { who: 'carol', t: 'Senhor, cuida da gente. Cuida de quem ficou pra trás. E dá paciência pro Pablício, que ele tá precisando. Amém.', next: 'rezar2' },
      rezar2: { who: 'pablicio', t: 'Amém. Ei! Como assim "paciência pro Pablício"?', do: g => { flag(g, 'reza_' + g.day(), true); for (const h of g.liveHeroes) h.need.moral = Math.min(100, h.need.moral + 20); g.log('🙏 O moral do grupo subiu (+20).', 'bom'); }, next: 'menu' },
      defesa: { who: 'npc', t: 'Com tanta gente aqui dentro, o barulho atrai os mortos. Esta noite, se vierem em bando, vamos precisar de vocês nas portas.',
        choices: [
          { t: 'Contem com a gente.', op: { carol: 2, daiana: 1 }, do: g => questStart(g, 'defesa'), to: 'menu' },
          { t: 'Não podemos prometer nada.', op: { pablicio: 1 }, to: 'menu' },
        ] },
    },
  },

  // ================================================================ SEU VALDIR
  valdir: {
    start: g => met('valdir')(g) ? 'menu' : 'intro',
    nodes: {
      intro: { who: 'npc', t: 'Ô, ô, devagar! Eu tô com febre, não tô com fome de gente. Ainda.', next: 'historia' },
      historia: { who: 'npc', t: 'Um cliente trouxe um Gol pra trocar o óleo. Tava pálido, babando... pensei que era ressaca. Me arranhou o braço. Agora eu tô aqui, suando igual tampa de panela.', next: 'historia2' },
      historia2: { who: 'pablicio', t: 'Seu Valdir, isso aí é infecção zumbi.', next: 'historia3' },
      historia3: { who: 'npc', t: 'Eu sei, sô. Por isso eu tô sentado longe da chave de roda. Se alguém me arrumar um antibiótico, eu fico devendo a vida.', do: g => questStart(g, 'valdir'), next: 'menu' },
      menu: { who: 'npc', t: g => flag(g, 'valdir_curado') ? 'E o Opala? Bateria, peças de motor e gasolina. Com isso eu... com isso a gente faz ele rodar.' : 'Conseguiram o antibiótico?',
        choices: [
          { t: 'Toma o antibiótico.', if: g => anyHeroHas(g, 'antibiotico') && !flag(g, 'valdir_curado'), op: { carol: 1 }, to: 'cura' },
          { t: 'O que o Opala precisa?', to: 'opala' },
          { t: 'Até mais, Seu Valdir.', to: null },
        ] },
      cura: { who: 'npc', t: 'Nossa... já tô sentindo o braço melhor. Vocês salvaram um mecânico. Isso vale ouro no fim do mundo. Tá vendo aquele Opala ali? É meu xodó. A chave tá aqui. Se trouxerem as peças, ele leva vocês até a ponte.',
        do: g => { takeFromParty(g, 'antibiotico'); flag(g, 'valdir_curado', true); giveParty(g, null, 'chave_carro', 1); questDone(g, 'valdir'); }, next: 'menu' },
      opala: { who: 'npc', t: 'Bateria de carro — o ferro-velho do Bigode tem. Peças de motor — tem aqui na oficina ou no ferro-velho. E um galão de gasolina, que hoje em dia só com os Lobos lá no posto ou no depósito da ferrovia. Quem conserta? Eu, se estiver bom. Ou aquele grandão ali, que tem cara de quem entende.', next: 'menu' },
    },
  },

  // ================================================================ DRA. LÍVIA
  livia: {
    start: g => met('livia')(g) ? 'menu' : 'intro',
    nodes: {
      intro: { who: 'npc', t: 'NÃO CHEGUEM PERTO! Vocês... vocês foram mordidos? Algum de vocês?',
        choices: [
          { t: 'Ninguém foi mordido. Calma.', if: g => !g.liveHeroes.some(h => h.st.infected), to: 'confissao' },
          { t: 'Um de nós foi. Por isso a gente precisa da senhora.', if: g => g.liveHeroes.some(h => h.st.infected), to: 'confissao' },
          { t: 'A gente leu seu diário. Não viemos julgar ninguém.', tag: '[Acolher]', if: g => hero(g, 'carol') && anyHeroHas(g, 'diario_livia'), to: 'confissao' },
          { t: 'Abaixa esse revólver ou eu abaixo pra você.', if: g => hero(g, 'pablicio'), op: { carol: -1, pablicio: 1 }, to: 'confissao' },
        ] },
      confissao: { who: 'npc', t: 'Tudo começou com o CRESCE+... um adubo experimental. O Dr. Heitor, meu chefe, colocou um fungo no composto: fazia o milho crescer três vezes mais rápido. Mas o fungo também reativa tecido morto.', next: 'confissao2' },
      confissao2: { who: 'npc', t: 'O rato do tanque 3 morreu e... levantou. Mordeu o Heitor. E o pior: a AgroNova distribuiu amostras do CRESCE+ de graça. Na feira, no restaurante... e na merenda da escola.', next: 'confissao3' },
      confissao3: { who: 'daiana', t: 'Na merenda. Da MINHA escola. Dos MEUS alunos.', next: 'soro' },
      soro: { who: 'npc', t: 'Eu desenvolvi um antídoto: o Soro R-7. Só existe um frasco, na sala fria do laboratório. E o HD com toda a pesquisa está no escritório do Heitor. Com a fórmula, dá pra fabricar mais. Dá pra salvar gente. Dá pra impedir que bombardeiem a cidade.',
        do: g => addClue(g, 'livia_verdade', 'O surto veio do CRESCE+, adubo experimental da AgroNova com um fungo que reanima tecido morto. Foi distribuído de graça — até na merenda da escola. O Soro R-7 (sala fria) e o HD com a pesquisa (escritório do Dr. Heitor) estão no Galpão AgroNova.'),
        choices: [
          { t: 'Como a gente entra no laboratório?', to: 'cracha' },
          { t: 'E o Dr. Heitor? Cadê ele?', to: 'heitor' },
        ] },
      heitor: { who: 'npc', t: 'O Heitor... não é mais o Heitor. O fungo tomou conta. Ele virou uma coisa enorme, cheia de raízes, que faz brotar zumbi do chão. Eu chamo de A Matriz.', next: 'heitor2' },
      heitor2: { who: 'pablicio', t: 'Por que é que em todo apocalipse tem um chefão?!', next: 'cracha' },
      cracha: { who: 'npc', t: 'Meu crachá abre todas as portas do galpão. Tomem. O portão de fora está acorrentado, vão precisar de um pé de cabra. Eu... eu não tenho coragem de voltar lá.',
        do: g => { giveParty(g, null, 'cracha', 1); questAdvance(g, 'origem', 'estacao'); },
        choices: [
          { t: 'Vem com a gente, doutora. Você conhece o laboratório.', op: { carol: 1, pablicio: -1 }, do: (g, c) => { makeAlly(g, c.npc); flag(g, 'livia_aliada', true); }, to: null },
          { t: 'Vá para a Igreja Matriz. Lá é seguro.', op: { carol: 1 }, do: (g, c) => toChurch(g, c.npc), to: null },
          { t: 'Você é responsável por tudo isso.', op: { pablicio: 1, carol: -1 }, to: 'culpa' },
        ] },
      culpa: { who: 'npc', t: 'Eu sei. Eu sei. Eu vou carregar isso pro resto da vida — se tiver resto de vida. Vou pra igreja. Boa sorte.', do: (g, c) => toChurch(g, c.npc), next: null },
      menu: { who: 'npc', t: 'Pegaram o soro? O HD? Não deixem a Matriz chegar perto. Ela ataca de longe com as raízes.', choices: [{ t: 'Estamos indo.', to: null }] },
    },
  },

  // ================================================================ TONHÃO E OS LOBOS
  tonhao: {
    start: g => met('tonhao')(g) ? 'menu' : 'intro',
    nodes: {
      intro: { who: 'npc', t: 'Olha só. Carne fresca. Ou seria... gente fresca? Aqui é território dos Lobos do Asfalto. Quem entra no posto paga pedágio.',
        do: g => questStart(g, 'lobos'),
        choices: [
          { t: 'Que pedágio?', to: 'pedagio' },
          { t: 'Vamos conversar como gente civilizada.', tag: '[Negociar]', if: g => hero(g, 'daiana'), check: { skill: 'negociadora', stat: 'inteligencia', dc: 55, ok: 'negocio_ok', fail: 'negocio_fail' } },
          { t: 'Pedágio? Eu vou pedagiar a sua cara!', if: g => hero(g, 'pablicio'), op: { arthur: 1, carol: -2, daiana: -1 }, to: 'briga' },
          { t: 'Estamos só de passagem.', to: null },
        ] },
      pedagio: { who: 'npc', t: g => `${flag(g, 'lobos_acordo') ? 'Três' : 'Cinco'} comidas por um galão de gasolina. Ou um kit médico. Preço de apocalipse. Não gostou? Tem o posto da cidade vizinha... ah não, pera, tem zumbi até lá.`, next: 'menu' },
      negocio_ok: { who: 'npc', t: 'Hmm... professora, né? Minha mãe era professora. Tá bom: três comidas por galão. E vocês podem passar pelo posto sem ninguém encher o saco.', do: g => flag(g, 'lobos_acordo', true), next: 'menu' },
      negocio_fail: { who: 'npc', t: 'Nem vem com essa lábia. Aqui não é sala de aula.', next: 'menu' },
      briga: { who: 'npc', t: 'Ah, é assim? LOBOS! PEGA ELES!', do: (g, c) => g.provoke(c.npc, c.hero), next: null },
      menu: { who: 'npc', t: 'E aí? Vai querer gasolina ou vai ficar aí suando?',
        choices: [
          { t: g => `Pagar ${flag(g, 'lobos_acordo') ? 3 : 5} comidas por um galão`, if: g => foodCount(g) >= (flag(g, 'lobos_acordo') ? 3 : 5), to: 'paga_comida' },
          { t: 'Pagar um kit médico por um galão', if: g => anyHeroHas(g, 'kit_medico'), to: 'paga_kit' },
          { t: 'Trocar outras coisas', trade: true, to: 'menu' },
          { t: 'Vocês trabalham com um tal de Wellington?', if: g => flag(g, 'wellington_mentira'), to: 'wellington' },
          { t: 'Até mais.', to: null },
        ] },
      paga_comida: { who: 'npc', t: 'Negócio fechado. Toma o galão. Cuidado pra não explodir.', do: g => { takeFood(g, flag(g, 'lobos_acordo') ? 3 : 5); giveParty(g, null, 'combustivel', 1); questDone(g, 'lobos'); }, next: 'menu' },
      paga_kit: { who: 'npc', t: 'Kit médico! Isso aqui vale mais que gasolina. Toma o galão.', do: g => { takeFromParty(g, 'kit_medico'); giveParty(g, null, 'combustivel', 1); questDone(g, 'lobos'); }, next: 'menu' },
      wellington: { who: 'npc', t: 'O Wellington? O "corretor"? Ele leva uns otários pra loja de roupas e a gente, hã... cobra o pedágio lá. Negócios. Não levem pro lado pessoal.', next: 'menu' },
    },
  },
  lobo: {
    start: 'fala',
    nodes: { fala: { who: 'npc', t: () => rng.pick(['Fala com o Tonhão. Eu só tomo conta da bomba.', 'Mexeu na gasolina sem pagar, leva chumbo.', 'Tá olhando o quê? Nunca viu motoqueiro de bandana?', 'O Tonhão tá de mau humor. Ele tá sempre de mau humor.']), next: null } },
  },

  // ================================================================ SARGENTO ROCHA
  sargento: {
    start: g => met('sargento')(g) ? 'menu' : 'intro',
    nodes: {
      intro: { who: 'npc', t: 'ALTO! Área militar. Ninguém atravessa a ponte. Ordens do Comando.', next: 'menu' },
      menu: { who: 'npc', t: g => flag(g, 'sargento_ok') ? 'Tragam um veículo. Eu abro a cancela e vocês passam. A pé, os bichos alcançam vocês no meio da ponte.' : 'Não insistam. Ninguém passa.',
        choices: [
          { t: 'Sargento, a gente tem a cura! Está tudo neste HD.', if: g => anyHeroHas(g, 'hd_dados') && !flag(g, 'sargento_ok'), to: 'cura' },
          { t: 'Tem sobreviventes na cidade! Crianças!', to: 'ordens' },
          { t: 'Quando vão bombardear a cidade?', if: g => !flag(g, 'sabe_prazo'), to: 'prazo' },
          { t: 'E se a gente conseguir provar que existe cura?', tag: '[Negociar]', if: g => hero(g, 'daiana') && !anyHeroHas(g, 'hd_dados'), to: 'provar' },
          { t: 'Até mais, sargento.', to: null },
        ] },
      cura: { who: 'npc', t: 'Se isso for verdade... o Comando precisa ver. Olha: com um veículo, eu abro a cancela e escolto vocês até Baixo Guandu. A pé, não dá — a ponte está cheia deles do outro lado.', do: g => flag(g, 'sargento_ok', true), next: 'menu' },
      ordens: { who: 'npc', t: 'Eu sei. Eu também tenho família em Baixo Guandu. Mas ordens são ordens. Sem prova de que vocês não estão infectados, ninguém passa.', next: 'menu' },
      prazo: { who: 'npc', t: 'Não posso falar... ah, que se dane. Protocolo Vale Seguro: às 06h00 do dia 6, a cidade vai ser esterilizada. Saiam antes disso. De qualquer jeito.', do: g => { flag(g, 'sabe_prazo', true); g.log('⏰ Prazo: a cidade será bombardeada às 06:00 do dia 6.', 'perigo'); }, next: 'menu' },
      provar: { who: 'npc', t: 'Tragam alguma prova concreta. Um documento, uma amostra, qualquer coisa que eu possa mandar pro Comando. Aí a gente conversa.', next: 'menu' },
    },
  },

  // ================================================================ ESCOLA
  tavares: {
    start: g => met('tavares')(g) ? (questStep(g, 'escola') === 'decidir' ? 'decidir' : 'menu') : 'intro',
    nodes: {
      intro: { who: 'npc', t: g => hero(g, 'daiana') ? 'Daiana?! Graças a Deus! Eu achei que ia morrer aqui dentro abraçado com a enciclopédia Barsa.' : 'Gente viva! Graças a Deus! Eu sou o Tavares, professor de Geografia.', next: 'situacao' },
      situacao: { who: 'npc', t: 'Tô aqui com o Kauã e a Yasmin, da recuperação. A merenda de anteontem... os meninos que comeram passaram mal, e depois... Olha isso aqui que eu achei na cozinha.',
        do: g => { giveParty(g, null, 'bilhete_merenda', 1); questAdvance(g, 'escola', 'biblioteca'); if (!Q(g, 'origem')) questStart(g, 'origem'); }, next: 'bilhete' },
      bilhete: { who: 'daiana', t: '"Suplemento CRESCE+, cortesia AgroNova"... A AgroNova é aquela firma do galpão perto da ponte.', next: 'chave' },
      chave: { who: 'npc', t: 'E tem mais: o depósito da escola tá cheio de comida, mas a chave ficou com o Seu Geraldo, o zelador. Se ele ainda for... o Seu Geraldo.', next: 'decidir' },
      decidir: { who: 'npc', t: 'E agora? A gente fica aqui ou vai com vocês?',
        choices: [
          { t: 'Vamos levar vocês até a Igreja Matriz. Fiquem colados na gente.', op: { carol: 2, daiana: 1, pablicio: -1 },
            do: g => { for (const u of g.units.filter(u => ['tavares', 'aluno1', 'aluno2'].includes(u.npc) && u.alive)) makeAlly(g, u); questAdvance(g, 'escola', 'decidir'); } , to: null },
          { t: 'Fiquem aqui e barriquem a biblioteca. A gente deixa comida.', op: { pablicio: 1, carol: -1 }, if: g => foodCount(g) >= 3,
            do: g => { takeFood(g, 3); flag(g, 'escola_fortificada', true); questStart(g, 'escola'); questDone(g, 'escola'); }, to: 'fica' },
          { t: 'Ainda não sei. A gente já volta.', to: null },
        ] },
      fica: { who: 'npc', t: 'Tá certo. A gente segura as pontas. Voltem quando puderem — e tragam notícias.', next: null },
      menu: { who: 'npc', t: 'Obrigado por tudo. Se virem o Seu Geraldo, tomem cuidado: ele sempre foi forte.', choices: [{ t: 'Pode deixar.', to: null }] },
    },
  },
  aluno: {
    start: 'fala',
    nodes: { fala: { who: 'npc', t: (g, c) => c.npc.npc === 'aluno1' ? rng.pick(['Professora, a prova de sexta foi cancelada, né? Por causa do apocalipse?', 'Eu matei um zumbi com a mochila. Ela era pesada por causa do livro de Matemática.', 'Esse grandão aí é seu segurança?']) : rng.pick(['Eu vi um zumbi comendo um pastel. Um pastel!', 'Quando isso acabar eu vou fazer Biologia. Ou fugir pra Marte.', 'Seu tênis vermelho é muito bonito, professora.']), next: null } },
  },

  // ================================================================ FAMÍLIA OLIVEIRA
  neide: {
    start: g => met('neide')(g) ? 'menu' : 'intro',
    nodes: {
      intro: { who: 'npc', t: 'Quem são vocês? Essa casa é nossa! Se vieram pegar alguma coisa, podem dar meia-volta.',
        choices: [{ t: 'Calma, a gente só está passando.', to: 'fome' }, { t: 'Vocês precisam de ajuda?', tag: '[Acolher]', if: g => hero(g, 'carol'), to: 'fome' }] },
      fome: { who: 'npc', t: 'Ajuda... Tô com três crianças lá dentro e sem comida há dois dias. Água a gente tem, do poço. Se acharem comida, a gente troca.', do: g => questStart(g, 'oliveira'), next: 'menu' },
      menu: { who: 'npc', t: g => flag(g, 'oliveira_ok') ? 'Deus abençoe vocês. Se precisarem de água, é só bater.' : 'Conseguiram alguma comida?',
        choices: [
          { t: 'Toma, três comidas para as crianças.', if: g => foodCount(g) >= 3 && !flag(g, 'oliveira_ok'), op: { carol: 2, pablicio: -1 }, to: 'da' },
          { t: 'Pode nos dar um pouco de água?', if: g => flag(g, 'oliveira_ok') && !flag(g, 'agua_oliveira_' + g.day()), to: 'agua' },
          { t: 'Desculpe, não temos nada.', to: null },
        ] },
      da: { who: 'npc', t: 'Obrigada. De verdade. Olha, uma coisa: o Seu Arlindo, marido da Dona Graça, tem um arsenal naquela casa dele. E armadilha. Cuidado onde pisa.',
        do: g => { takeFood(g, 3); flag(g, 'oliveira_ok', true); giveParty(g, null, 'agua', 3); questDone(g, 'oliveira'); g.state.saved.push('Família Oliveira'); }, next: null },
      agua: { who: 'npc', t: 'Claro. Toma, duas garrafas do poço.', do: g => { flag(g, 'agua_oliveira_' + g.day(), true); giveParty(g, null, 'agua', 2); }, next: null },
    },
  },

  // ================================================================ EVENTOS
  wellington: {
    start: 'intro',
    nodes: {
      intro: { who: 'npc', t: 'Ei! Ei, vocês! Graças a Deus! Minha irmã tá presa na Loja de Roupas, lá na Rua Minas Gerais! Tem zumbi por todo lado! Me ajudem, por favor, eu pago! Eu sou corretor de imóveis!',
        choices: [
          { t: 'Vamos lá, rápido!', op: { carol: 1 }, do: g => { flag(g, 'wellington_armadilha', true); }, to: 'vamos' },
          { t: 'Qual é o nome da sua irmã?', tag: '[Acolher]', if: g => hero(g, 'carol'), check: { skill: 'coracao_acolhedor', dc: 45, ok: 'mentira', fail: 'vamos' } },
          { t: 'Hmm. Tem alguma coisa estranha nessa história.', tag: '[Inteligência]', if: g => hero(g, 'daiana'), check: { stat: 'inteligencia', dc: 50, ok: 'mentira', fail: 'vamos' } },
          { t: 'Isso é armadilha. Clássico. Todo jogo tem essa missão.', if: g => hero(g, 'arthur'), op: { arthur: 1 }, to: 'mentira' },
        ] },
      vamos: { who: 'npc', t: 'Obrigado! Vão na frente, eu... eu cubro a retaguarda!', do: (g, c) => { flag(g, 'wellington_armadilha', true); c.npc.st.fled = true; g.log('Wellington "ficou para trás". Estranho.', 'info'); }, next: null },
      mentira: { who: 'npc', t: 'Armadilha? Eu? Que... que absurdo! ... Tá bom, tá bom! Os Lobos me pagam em gasolina pra levar gente pra loja e depenar! Não me machuquem!',
        do: g => { flag(g, 'wellington_mentira', true); addClue(g, 'wellington', 'Wellington trabalha para os Lobos do Asfalto atraindo gente para uma emboscada na loja de roupas.'); },
        choices: [
          { t: 'Some daqui. E larga esse revólver.', op: { carol: 1 }, do: (g, c) => { if (c.npc.eq.mao) { g.map.addPile(c.npc.x, c.npc.z, c.npc.eq.mao.id, 1); g.map.addPile(c.npc.x, c.npc.z, 'mun_pistola', 6); c.npc.eq.mao = null; } c.npc.gone = true; g.S.units.remove(c.npc); g.log('Wellington largou o revólver e saiu correndo.', 'bom'); }, to: null },
          { t: 'Você vai pra igreja e vai ajudar o padre. Todo dia.', op: { carol: 2, pablicio: -1 }, do: (g, c) => toChurch(g, c.npc), to: null },
        ] },
    },
  },
  kelly: {
    start: g => flag(g, 'kelly_salva') ? (met('kelly')(g) ? 'menu' : 'obrigada') : 'socorro',
    nodes: {
      socorro: { who: 'npc', t: 'SOCORRO! Tira esses bichos daqui! Eu tô com uma pizza e não tenho medo de usar!', next: null },
      obrigada: { who: 'npc', t: 'Valeu! Eu tava em cima desse carro há duas horas com uma pizza de calabresa. Ainda tá quentinha... mentira, tá gelada. Querem? Eu sou a Kelly, entregadora. Entregava, né.',
        do: g => giveParty(g, null, 'pao', 3), next: 'menu' },
      menu: { who: 'npc', t: 'E agora? Eu conheço cada atalho dessa cidade. Entregadora sabe tudo.',
        choices: [
          { t: 'Vem com a gente, Kelly.', op: { arthur: 1 }, do: (g, c) => makeAlly(g, c.npc), to: null },
          { t: 'Vá para a Igreja Matriz. Lá é mais seguro.', op: { carol: 1 }, do: (g, c) => toChurch(g, c.npc), to: null },
          { t: 'Me mostra o caminho mais seguro no mapa?', do: g => { flag(g, 'mapa', true); g.updateVision(); g.log('🗺️ A Kelly marcou os atalhos no mapa.', 'bom'); }, to: 'menu' },
        ] },
    },
  },
  toninho: {
    start: 'intro',
    nodes: {
      intro: { who: 'npc', t: 'NINGUÉM SE MEXE! Eu... eu só quero comida. Três dias sem comer. Me dá comida e ninguém se machuca.',
        choices: [
          { t: 'Toma. Come devagar.', if: g => foodCount(g) >= 1, op: { carol: 2, pablicio: -1 }, do: g => takeFood(g, 1), to: 'grato' },
          { t: 'Abaixa essa faca. Ninguém vai te deixar passar fome.', tag: '[Acolher]', if: g => hero(g, 'carol'), check: { skill: 'coracao_acolhedor', dc: 35, ok: 'grato', fail: 'ataca' } },
          { t: 'Olha o tamanho do meu braço, parceiro.', if: g => hero(g, 'pablicio'), check: { stat: 'forca', dc: 45, ok: 'foge', fail: 'ataca' } },
          { t: 'Não temos nada pra você.', op: { pablicio: 1, carol: -2 }, to: 'ataca' },
        ] },
      grato: { who: 'npc', t: 'Obrigado... Desculpa pela faca. Eu não sou assim. Eu era cobrador de ônibus. Vou pra igreja, dizem que lá tem pão.', do: (g, c) => { toChurch(g, c.npc); for (const h of g.liveHeroes) g.gainXp(h, 15, true); }, next: null },
      foge: { who: 'npc', t: 'T-tá bom! Tá bom! Eu vou embora!', do: (g, c) => { c.npc.gone = true; g.S.units.remove(c.npc); }, next: null },
      ataca: { who: 'npc', t: 'Então eu mesmo pego!', do: (g, c) => g.provoke(c.npc, c.hero), next: null },
    },
  },
};
