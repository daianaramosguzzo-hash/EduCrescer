// Conversas espontâneas do grupo. quando = gatilho; quem = quem precisa estar vivo;
// rel = relação mínima ({'a|b': 60}) ou máxima (valor negativo); uma = só uma vez.
export const BANTER = [
  // ---------------------------------------------------------------- começo
  { id: 'viz1', quando: 'vizinho', uma: true, quem: ['pablicio', 'carol'], falas: [
    ['pablicio', 'Aquele é o Seu Lindomar? Por que ele tá mastigando a roseira?'],
    ['carol', 'Ele não tá bem. Olha os olhos dele.'],
    ['pablicio', 'Eu tô de boa. Eu tô de boa. EU NÃO TÔ DE BOA!'],
  ] },
  { id: 'viz2', quando: 'vizinho', uma: true, quem: ['arthur', 'daiana'], falas: [
    ['arthur', 'Isso é um zumbi. Tipo, de verdade. Primeiro inimigo do jogo: o vizinho de pijama.'],
    ['daiana', 'Então a gente trata como primeiro inimigo: com cuidado e em grupo.'],
  ] },
  { id: 'mat1', quando: 'matou', uma: true, quem: ['arthur', 'pablicio'], falas: [
    ['arthur', 'Primeiro zumbi! Conquista desbloqueada.'],
    ['pablicio', 'Não tem conquista nenhuma, isso é a vida real! ...Mas foi bonito, vai.'],
  ] },
  { id: 'mat2', quando: 'matou', uma: true, quem: ['carol'], falas: [
    ['carol', 'Que Deus o tenha. De verdade dessa vez.'],
  ] },
  { id: 'mat3', quando: 'matou', quem: ['daiana', 'arthur'], falas: [
    ['daiana', 'Vinte e cinco a menos. Continuem assim, turma.'],
    ['arthur', 'Se tivesse placar, a gente tava no topo do ranking de Aimorés.'],
  ] },
  { id: 'mat4', quando: 'matou', quem: ['pablicio'], falas: [
    ['pablicio', 'Mais um! Eu tô ficando bom nisso. Isso é preocupante.'],
  ] },

  // ---------------------------------------------------------------- ócio / exploração
  { id: 'oc1', quando: 'ocioso', quem: ['arthur', 'pablicio'], falas: [
    ['arthur', 'Pablício, se isso fosse um jogo, qual seria sua classe?'],
    ['pablicio', 'Tanque. Obviamente. Aguenta pancada e sua em bicas.'],
    ['arthur', 'O suor não é mecânica de jogo.'],
    ['pablicio', 'No meu caso é.'],
  ] },
  { id: 'oc2', quando: 'ocioso', quem: ['carol', 'daiana'], falas: [
    ['carol', 'Dai, você bebeu água hoje?'],
    ['daiana', 'Bebi café.'],
    ['carol', 'Café não é água.'],
    ['daiana', 'Café é água com propósito.'],
  ] },
  { id: 'oc3', quando: 'ocioso', quem: ['daiana', 'arthur'], falas: [
    ['daiana', 'Arthur, capital do Espírito Santo.'],
    ['arthur', 'Sério? Agora?'],
    ['daiana', 'Se a gente atravessar a ponte, vai precisar saber.'],
    ['arthur', 'Vitória. Satisfeita?'],
    ['daiana', 'Muito. Ponto extra.'],
  ] },
  { id: 'oc4', quando: 'ocioso', quem: ['pablicio', 'carol'], falas: [
    ['pablicio', 'Carol, se eu virar zumbi, promete que me mata rápido?'],
    ['carol', 'Prometo que não vou deixar você virar zumbi. Bebe essa água.'],
  ] },
  { id: 'oc5', quando: 'ocioso', quem: ['arthur'], falas: [
    ['arthur', 'Sabia que em todo jogo de zumbi tem um cara que diz "eu tô bem" e tá mordido?'],
    ['arthur', '...Pablício, tira a jaqueta.'],
  ], se: g => !!g.units.find(u => u.id === 'pablicio' && !u.dead) },
  { id: 'oc6', quando: 'ocioso', quem: ['daiana', 'pablicio'], falas: [
    ['daiana', 'Aimorés tem 25 mil habitantes. Quantos a gente viu vivos?'],
    ['pablicio', 'Não faz conta agora não, pelo amor de Deus.'],
  ] },
  { id: 'oc7', quando: 'ocioso', quem: ['carol', 'arthur'], falas: [
    ['carol', 'Arthur, fecha a jaqueta. Não, abre. Tá calor. Não, fecha, tem zumbi.'],
    ['arthur', 'A jaqueta é parte da minha identidade, Carol.'],
  ] },
  { id: 'oc8', quando: 'ocioso', quem: ['pablicio', 'daiana'], falas: [
    ['pablicio', 'Sabe o que eu queria agora? Um pão de queijo.'],
    ['daiana', 'Quando isso acabar, eu pago uma fornada inteira.'],
    ['pablicio', 'Promete?'],
    ['daiana', 'Palavra de professora.'],
  ] },
  { id: 'oc9', quando: 'ocioso', quem: ['arthur', 'carol'], rel: { 'arthur|carol': 65 }, falas: [
    ['arthur', 'Carol... você acha que Deus existe mesmo? Com tudo isso?'],
    ['carol', 'Acho. Ele tá aqui. Tá no fato de a gente estar junto, cuidando um do outro.'],
    ['arthur', '...Tá. Faz sentido.'],
  ] },
  { id: 'oc10', quando: 'ocioso', quem: ['daiana', 'carol'], rel: { 'carol|daiana': 70 }, falas: [
    ['daiana', 'Obrigada por segurar a barra do grupo, Carol. Eu fico dando ordem, mas quem mantém todo mundo inteiro é você.'],
    ['carol', 'A gente é um time, Dai. Você é a cabeça, eu sou o coração.'],
    ['pablicio', 'E eu sou o quê?'],
    ['carol', 'O suor.'],
  ] },
  { id: 'oc11', quando: 'ocioso', quem: ['pablicio', 'arthur'], rel: { 'arthur|pablicio': 70 }, falas: [
    ['pablicio', 'Arthur, você é mais corajoso do que eu. Sério.'],
    ['arthur', 'Eu só finjo melhor.'],
    ['pablicio', 'É exatamente isso que é coragem, cara.'],
  ] },
  { id: 'oc12', quando: 'ocioso', quem: ['daiana'], falas: [
    ['daiana', 'Anotem: prioridade um, água. Prioridade dois, comida. Prioridade três, não morrer. Prioridade quatro, sair de Aimorés.'],
  ] },
  { id: 'oc13', quando: 'ocioso', quem: ['arthur', 'daiana'], falas: [
    ['arthur', 'Se isso fosse um jogo, a gente já devia ter achado um ponto de salvamento.'],
    ['daiana', 'Tem: a Casa da Turma e a igreja. Aprende a ler o mapa.'],
  ] },
  { id: 'oc14', quando: 'ocioso', quem: ['pablicio'], falas: [
    ['pablicio', 'Por que em Aimorés tudo é tão quente? Até o apocalipse aqui é no modo forno.'],
  ] },
  { id: 'oc15', quando: 'ocioso', quem: ['carol', 'pablicio'], falas: [
    ['carol', 'Pablício, por que você tá rezando?'],
    ['pablicio', 'Porque você disse que funciona. E porque eu vi um zumbi olhando pra mim de um jeito estranho.'],
  ] },

  // ---------------------------------------------------------------- brigas (relacionamento baixo)
  { id: 'br1', quando: 'briga', quem: ['pablicio', 'carol'], rel: { 'carol|pablicio': -25 }, falas: [
    ['pablicio', 'A gente perde tempo demais ajudando todo mundo, Carol!'],
    ['carol', 'E se fosse você lá fora, Pablício? Ia querer que alguém passasse direto?'],
    ['pablicio', '...Isso não é justo.'],
  ], efeito: g => { for (const h of g.liveHeroes) h.need.moral = Math.max(0, h.need.moral - 4); } },
  { id: 'br2', quando: 'briga', quem: ['daiana', 'pablicio'], rel: { 'daiana|pablicio': -25 }, falas: [
    ['pablicio', 'Para de dar ordem, Daiana! Isso aqui não é sala de aula!'],
    ['daiana', 'Se fosse, você tava de recuperação.'],
  ], efeito: g => { for (const h of g.liveHeroes) h.need.moral = Math.max(0, h.need.moral - 4); } },
  { id: 'br3', quando: 'briga', quem: ['arthur', 'daiana'], rel: { 'arthur|daiana': -25 }, falas: [
    ['arthur', 'Eu sei me virar sozinho, tá? Não precisa ficar vigiando.'],
    ['daiana', 'Preciso sim. Porque eu me importo.'],
  ], efeito: g => { for (const h of g.liveHeroes) h.need.moral = Math.max(0, h.need.moral - 4); } },
  { id: 'br4', quando: 'briga', quem: ['arthur', 'pablicio'], rel: { 'arthur|pablicio': -25 }, falas: [
    ['arthur', 'Pablício, dá pra andar sem fazer barulho? Você acorda zumbi de três quarteirões!'],
    ['pablicio', 'Desculpa se eu não sou um ninja de jaqueta!'],
  ], efeito: g => { for (const h of g.liveHeroes) h.need.moral = Math.max(0, h.need.moral - 4); } },

  // ---------------------------------------------------------------- combate
  { id: 'cb1', quando: 'combate', quem: ['daiana'], falas: [['daiana', 'Formação! Ninguém fica isolado!']] },
  { id: 'cb2', quando: 'combate', quem: ['pablicio'], falas: [['pablicio', 'Vem! Vem que eu tô... eu tô mais ou menos preparado!']] },
  { id: 'cb3', quando: 'combate', quem: ['arthur'], falas: [['arthur', 'Mira na cabeça! Ou no que sobrou dela!']] },
  { id: 'cb4', quando: 'combate', quem: ['carol'], falas: [['carol', 'Cuidado com as costas! Quem tá sangrando fala!']] },
  { id: 'cb5', quando: 'combate', quem: ['arthur', 'pablicio'], falas: [
    ['arthur', 'Pablício, faz aquele negócio de surtar!'],
    ['pablicio', 'Não é um "negócio", é um problema emocional sério! ...Mas tá bom.'],
  ] },

  // ---------------------------------------------------------------- necessidades e clima
  { id: 'fm1', quando: 'fome', quem: ['pablicio', 'carol'], falas: [
    ['pablicio', 'Minha barriga tá fazendo barulho de zumbi.'],
    ['carol', 'Então come alguma coisa antes que um zumbi ache que é convite.'],
  ] },
  { id: 'fm2', quando: 'fome', quem: ['daiana'], falas: [['daiana', 'Gente, parada técnica: água e comida. Ninguém raciocina com fome.']] },
  { id: 'fm3', quando: 'fome', quem: ['arthur'], falas: [['arthur', 'Eu comeria até ração de cachorro agora. Não, pera. Não comeria. Talvez.']] },
  { id: 'ca1', quando: 'calor', quem: ['pablicio', 'arthur'], falas: [
    ['pablicio', 'Tá tão quente que o zumbi tá assando.'],
    ['arthur', 'Isso explica o cheiro.'],
  ] },
  { id: 'ca2', quando: 'calor', quem: ['carol', 'arthur'], falas: [
    ['carol', 'Arthur, tira essa jaqueta, pelo amor de Deus! Tá 38 graus!'],
    ['arthur', 'Nunca.'],
  ] },
  { id: 'ca3', quando: 'calor', quem: ['daiana'], falas: [['daiana', 'Aimorés: quarenta graus à sombra e zero sombra. Bebam água, turma.']] },
  { id: 'ch1', quando: 'chuva', quem: ['carol', 'pablicio'], falas: [
    ['carol', 'Chuva! Graças a Deus, refrescou.'],
    ['pablicio', 'Zumbi derrete na chuva?'],
    ['carol', 'Não, Pablício.'],
    ['pablicio', 'Tinha que perguntar.'],
  ] },

  // ---------------------------------------------------------------- noite e dia
  { id: 'nt1', quando: 'noite', quem: ['pablicio', 'daiana'], falas: [
    ['pablicio', 'Tá escurecendo. É agora que o filme fica ruim.'],
    ['daiana', 'Lanternas prontas. À noite eles enxergam menos, mas ouvem igual. E vêm mais.'],
  ] },
  { id: 'nt2', quando: 'noite', quem: ['arthur', 'carol'], falas: [
    ['arthur', 'Nível noturno desbloqueado. Dificuldade aumentada.'],
    ['carol', 'Então vamos procurar um lugar seguro para dormir. Casa da Turma ou a igreja.'],
  ] },
  { id: 'nt3', quando: 'noite', quem: ['carol'], falas: [['carol', 'Ninguém fica na rua depois que escurecer. Ninguém.']] },
  { id: 'am1', quando: 'amanhecer', quem: ['daiana', 'arthur'], falas: [
    ['daiana', 'Bom dia, turma. Mais um dia vivos. Chamada: Arthur?'],
    ['arthur', 'Presente, infelizmente.'],
  ] },
  { id: 'am2', quando: 'amanhecer', quem: ['pablicio', 'carol'], falas: [
    ['pablicio', 'Sonhei que eu era zumbi. Acordei e fui checar se eu tava com vontade de comer cérebro.'],
    ['carol', 'E aí?'],
    ['pablicio', 'Só pão de queijo. Tô bem.'],
  ] },
  { id: 'am3', quando: 'amanhecer', quem: ['carol'], falas: [['carol', 'Obrigada por mais um dia, Senhor. Agora, café.']] },
  { id: 'at1', quando: 'ataque_noturno', quem: ['pablicio'], falas: [['pablicio', 'ACORDA TODO MUNDO! TEM ZUMBI NA PORTA! NÃO É SONHO!']] },
  { id: 'at2', quando: 'ataque_noturno', quem: ['daiana'], falas: [['daiana', 'Todo mundo de pé! Protejam a porta!']] },

  // ---------------------------------------------------------------- lugares
  { id: 'es1', quando: 'entrar:escola', quem: ['daiana', 'arthur'], uma: true, falas: [
    ['daiana', 'Minha escola... Olha o mural da feira de ciências. Ainda tem o vulcão de bicarbonato.'],
    ['arthur', 'Escola no apocalipse. Finalmente um lugar mais assustador que em dia de prova.'],
  ] },
  { id: 'me1', quando: 'entrar:mercado', quem: ['pablicio', 'carol'], uma: true, falas: [
    ['pablicio', 'O Bom Preço! Olha, promoção de sardinha!'],
    ['carol', 'Pega o que dá pra carregar. Água primeiro.'],
  ] },
  { id: 'me2', quando: 'entrar:mercado', quem: ['arthur'], uma: true, falas: [['arthur', 'Mercado vazio, luz piscando, música de elevador. Isso é o começo de todo filme de zumbi.']] },
  { id: 'ig1', quando: 'entrar:igreja', quem: ['carol'], uma: true, falas: [['carol', 'A Matriz... Aqui a gente tá seguro. Dá pra sentir.']] },
  { id: 'ig2', quando: 'entrar:igreja', quem: ['pablicio', 'arthur'], uma: true, falas: [
    ['pablicio', 'Zumbi entra em igreja?'],
    ['arthur', 'Em todo filme que eu vi, entra.'],
    ['pablicio', 'Para de ver filme!'],
  ] },
  { id: 'fa1', quando: 'entrar:farmacia', quem: ['carol'], uma: true, falas: [['carol', 'Ataduras, antibiótico, álcool. Vamos pegar tudo que der. Remédio salva mais que bala.']] },
  { id: 'po1', quando: 'entrar:posto', quem: ['pablicio', 'daiana'], uma: true, falas: [
    ['pablicio', 'Posto de gasolina. Um tiro errado aqui e a gente vira fogos de réveillon.'],
    ['daiana', 'Então ninguém atira. Deixem que eu falo.'],
  ] },
  { id: 'of1', quando: 'entrar:oficina', quem: ['pablicio'], uma: true, falas: [['pablicio', 'Cheiro de graxa! Finalmente um lugar onde eu sei o que tô fazendo.']] },
  { id: 'et1', quando: 'entrar:estacao', quem: ['arthur', 'daiana'], uma: true, falas: [
    ['arthur', 'Uma locomotiva de verdade! Será que ainda anda?'],
    ['daiana', 'O trem da Vitória-Minas passa aqui desde antes do meu avô nascer. Se tiver diesel, anda.'],
  ] },
  { id: 'ag1', quando: 'entrar:agronova', quem: ['arthur', 'pablicio'], uma: true, falas: [
    ['arthur', 'Laboratório secreto. Tanques com gosma verde. A gente tá oficialmente na fase final.'],
    ['pablicio', 'Eu quero ir embora. Eu quero MUITO ir embora.'],
  ] },
  { id: 'ag2', quando: 'entrar:agronova', quem: ['carol', 'daiana'], uma: true, falas: [
    ['carol', 'Foi aqui que tudo começou.'],
    ['daiana', 'E é aqui que vai terminar.'],
  ] },
  { id: 'ra1', quando: 'entrar:radio', quem: ['daiana', 'arthur'], uma: true, falas: [
    ['daiana', 'A Rádio Aimorés FM. Eu dei entrevista aqui na semana da feira de ciências.'],
    ['arthur', 'Eu lembro! Você falou "vulcão" umas quarenta vezes.'],
  ] },
  { id: 'ba1', quando: 'entrar:bar', quem: ['pablicio'], uma: true, falas: [['pablicio', 'Bar do Tião... Aqui eu já passei muita raiva vendo jogo. Hoje eu passaria até um jogo do Guandu contra o Aimorés pra ter essa vida de volta.']] },
  { id: 'ca_1', quando: 'entrar:casa', quem: ['arthur'], falas: [['arthur', 'Casa dos outros. Sempre me sinto um ladrão em jogo de RPG abrindo gaveta.']] },
  { id: 'ca_2', quando: 'entrar:casa', quem: ['daiana'], falas: [['daiana', 'Eu conheço essa família... Espero que tenham saído a tempo.']] },
  { id: 'ca_3', quando: 'entrar:casa', quem: ['carol'], falas: [['carol', 'Olha as fotos na parede. Era um lar. Vamos com respeito.']] },

  // ---------------------------------------------------------------- momentos da história
  { id: 'gt1', quando: 'gato', uma: true, quem: ['arthur', 'pablicio'], falas: [
    ['arthur', 'Achei o Bolinho! Ele é... enorme.'],
    ['pablicio', 'Esse gato pesa mais que minha mochila. E me olhou com desprezo.'],
  ] },
  { id: 'gf1', quando: 'gato_falso', quem: ['pablicio'], falas: [['pablicio', 'UM GATO. Eu quase morri por causa de um GATO.']] },
  { id: 'cm1', quando: 'caramelo', uma: true, quem: ['arthur', 'carol'], falas: [
    ['arthur', 'Um caramelo! O verdadeiro sobrevivente do Brasil!'],
    ['carol', 'Nem o apocalipse derruba um vira-lata caramelo.'],
  ] },
  { id: 'hl1', quando: 'helicoptero', uma: true, quem: ['daiana', 'pablicio'], falas: [
    ['pablicio', 'EI! AQUI! AQUI EMBAIXO!'],
    ['daiana', 'Não pararam... mas tem gente lá fora. Tem saída. Guardem isso.'],
  ] },
  { id: 'hd1', quando: 'horda', quem: ['arthur', 'daiana'], falas: [
    ['arthur', 'Horda à frente. Recomendo fortemente dar a volta.'],
    ['daiana', 'Concordo. Rota alternativa, turma.'],
  ] },
  { id: 'al1', quando: 'alarme', quem: ['pablicio'], falas: [['pablicio', 'Quem ainda tem alarme de carro no fim do mundo?! Desliga isso!']] },
  { id: 'pm1', quando: 'pamonha', uma: true, quem: ['arthur', 'pablicio'], falas: [
    ['arthur', 'Tô ouvindo "pamonha" no megafone. À noite. No apocalipse.'],
    ['pablicio', 'Até morto o cara continua vendendo. Isso é Minas Gerais.'],
  ] },
  { id: 'sn1', quando: 'sino', quem: ['carol'], falas: [['carol', 'O sino da Matriz... Que Deus nos proteja.']] },
  { id: 'sn2', quando: 'sino', quem: ['pablicio'], falas: [['pablicio', 'O sino chama zumbi! Eu falei que chamava!']] },
  { id: 'cai1', quando: 'caiu', quem: ['carol'], falas: [['carol', 'Aguenta! Eu tô indo! Alguém me passa uma atadura!']] },
  { id: 'cai2', quando: 'caiu', quem: ['daiana'], falas: [['daiana', 'Cubram quem caiu! Ninguém fica pra trás!']] },
  { id: 'cai3', quando: 'caiu', quem: ['pablicio'], falas: [['pablicio', 'NÃO! Ninguém morre hoje! NINGUÉM!']] },
  { id: 'ess1', quando: 'escola_salva', uma: true, quem: ['daiana', 'carol'], falas: [
    ['daiana', 'Meus alunos estão seguros...'],
    ['carol', 'Você fez isso, Dai. A gente fez.'],
  ] },
  { id: 'pr1', quando: 'provas', uma: true, quem: ['daiana', 'arthur'], falas: [
    ['daiana', 'Soro e dados. Agora a gente tem uma chance de verdade.'],
    ['arthur', 'Item lendário obtido. Hora de terminar o jogo.'],
  ] },
  { id: 'ch_1', quando: 'chefe', uma: true, quem: ['pablicio', 'arthur'], falas: [
    ['pablicio', 'A GENTE MATOU O CHEFÃO! A GENTE MATOU O CHEFÃO!'],
    ['arthur', 'Nunca duvidei. Quer dizer, duvidei muito. Mas deu certo.'],
  ] },
  { id: 'ch_2', quando: 'chefe', uma: true, quem: ['carol'], falas: [['carol', 'Descanse em paz, Dr. Heitor. Que Deus perdoe o que fizeram.']] },
];
