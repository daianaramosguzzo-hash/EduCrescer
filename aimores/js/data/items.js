// Banco de itens de Aimorés dos Mortos.
// cat: arma | municao | comida | medicamento | sobrevivencia | material | equipamento | especial
// peso em kg, valor em "pontos de troca" (a cidade virou escambo).

export const CATS = {
  arma: { nome: 'Armas', icon: '🔪' },
  municao: { nome: 'Munição', icon: '🧨' },
  comida: { nome: 'Comida e bebida', icon: '🥫' },
  medicamento: { nome: 'Medicamentos', icon: '💊' },
  sobrevivencia: { nome: 'Sobrevivência', icon: '🔦' },
  material: { nome: 'Materiais', icon: '🪵' },
  equipamento: { nome: 'Equipamento', icon: '🎒' },
  especial: { nome: 'Itens especiais', icon: '⭐' },
};

// w: arma { tipo: 'corpo'|'distancia'|'arremesso', classe (visual), dano [min,max], prec, pa, ruido,
//           alcance, dur (durabilidade), pente, municao, furtivo (multiplicador de ataque surpresa),
//           atordoar (chance), empurrar, area }
export const ITEMS = {
  // ------------------------------------------------------------ armas brancas
  faca: { nome: 'Faca de cozinha', cat: 'arma', peso: 0.3, valor: 8, icon: '🔪',
    desc: 'Tramontina de guerra. Silenciosa e ótima para ataques pelas costas.',
    w: { tipo: 'corpo', classe: 'knife', dano: [5, 9], prec: 88, pa: 2, ruido: 1, alcance: 1, dur: 45, furtivo: 3 } },
  facao: { nome: 'Facão', cat: 'arma', peso: 0.9, valor: 16, icon: '🗡️',
    desc: 'O mesmo que o tio usava para cortar cana. Agora corta outra coisa.',
    w: { tipo: 'corpo', classe: 'machete', dano: [8, 13], prec: 82, pa: 3, ruido: 2, alcance: 1, dur: 55, furtivo: 2 } },
  taco: { nome: 'Taco de beisebol', cat: 'arma', peso: 1.1, valor: 14, icon: '🏏',
    desc: 'Ninguém em Aimorés joga beisebol. Mesmo assim, estava ali.',
    w: { tipo: 'corpo', classe: 'bat', dano: [7, 12], prec: 82, pa: 3, ruido: 3, alcance: 1, dur: 60, atordoar: 0.25, empurrar: true } },
  taco_pregos: { nome: 'Taco com pregos', cat: 'arma', peso: 1.3, valor: 20, icon: '🏏',
    desc: 'Artesanato local. Causa sangramento.',
    w: { tipo: 'corpo', classe: 'batpregos', dano: [10, 16], prec: 80, pa: 3, ruido: 3, alcance: 1, dur: 40, atordoar: 0.2, sangrar: 0.4 } },
  cano: { nome: 'Cano de ferro', cat: 'arma', peso: 1.6, valor: 9, icon: '🔧',
    desc: 'Pesado, feio e praticamente indestrutível.',
    w: { tipo: 'corpo', classe: 'pipe', dano: [6, 11], prec: 80, pa: 3, ruido: 3, alcance: 1, dur: 120, atordoar: 0.2 } },
  pe_de_cabra: { nome: 'Pé de cabra', cat: 'arma', peso: 1.4, valor: 15, icon: '🦯',
    desc: 'Abre portas trancadas com menos barulho. Abre cabeças também.',
    w: { tipo: 'corpo', classe: 'crowbar', dano: [7, 11], prec: 82, pa: 3, ruido: 2, alcance: 1, dur: 100 }, abrePorta: true },
  martelo: { nome: 'Martelo', cat: 'arma', peso: 0.8, valor: 10, icon: '🔨',
    desc: 'Bom para pregar tábuas e para argumentar com zumbis.',
    w: { tipo: 'corpo', classe: 'hammer', dano: [6, 10], prec: 86, pa: 2, ruido: 2, alcance: 1, dur: 80 }, ferramenta: true },
  machado: { nome: 'Machado', cat: 'arma', peso: 2.2, valor: 24, icon: '🪓',
    desc: 'Dano altíssimo. Derruba portas. Cansa o braço.',
    w: { tipo: 'corpo', classe: 'axe', dano: [12, 19], prec: 75, pa: 4, ruido: 3, alcance: 1, dur: 70 }, quebraPorta: true },
  rodo: { nome: 'Rodo', cat: 'arma', peso: 0.7, valor: 2, icon: '🧹',
    desc: 'Arma improvisada. Improvisada demais, na verdade.',
    w: { tipo: 'corpo', classe: 'pipe', dano: [2, 5], prec: 85, pa: 2, ruido: 2, alcance: 1, dur: 25, empurrar: true } },
  frigideira: { nome: 'Frigideira', cat: 'arma', peso: 1.0, valor: 6, icon: '🍳',
    desc: 'Faz um "PÓIN" muito satisfatório.',
    w: { tipo: 'corpo', classe: 'hammer', dano: [5, 9], prec: 84, pa: 2, ruido: 4, alcance: 1, dur: 90, atordoar: 0.35 } },

  // ------------------------------------------------------------ armas de distância
  estilingue: { nome: 'Estilingue', cat: 'arma', peso: 0.2, valor: 8, icon: '🪃',
    desc: 'Silencioso. Pode atordoar ou fazer barulho longe para distrair.',
    w: { tipo: 'distancia', classe: 'sling', dano: [2, 5], prec: 78, pa: 2, ruido: 0, alcance: 8, dur: 999, municao: 'pedrinhas', pente: 1, atordoar: 0.3 } },
  revolver: { nome: 'Revólver .38', cat: 'arma', peso: 0.9, valor: 40, icon: '🔫',
    desc: 'Seis tiros. Cada um acorda meio quarteirão.',
    w: { tipo: 'distancia', classe: 'pistol', dano: [13, 21], prec: 70, pa: 3, ruido: 14, alcance: 10, dur: 999, municao: 'mun_pistola', pente: 6, recarga: 3 } },
  pistola: { nome: 'Pistola 9mm', cat: 'arma', peso: 0.8, valor: 50, icon: '🔫',
    desc: 'Mais precisa que o revólver e com pente maior.',
    w: { tipo: 'distancia', classe: 'pistol', dano: [12, 19], prec: 76, pa: 3, ruido: 13, alcance: 11, dur: 999, municao: 'mun_pistola', pente: 12, recarga: 2 } },
  espingarda: { nome: 'Espingarda calibre 12', cat: 'arma', peso: 3.2, valor: 70, icon: '🔫',
    desc: 'Devastadora de perto, inútil de longe. Acerta quem estiver ao lado do alvo.',
    w: { tipo: 'distancia', classe: 'shotgun', dano: [20, 32], prec: 78, pa: 4, ruido: 18, alcance: 6, dur: 999, municao: 'mun_espingarda', pente: 2, recarga: 3, espalhar: true } },
  rifle: { nome: 'Rifle de caça', cat: 'arma', peso: 3.5, valor: 80, icon: '🔫',
    desc: 'Longo alcance e muita precisão. Ideal para quem sabe mirar.',
    w: { tipo: 'distancia', classe: 'rifle', dano: [20, 30], prec: 86, pa: 4, ruido: 16, alcance: 16, dur: 999, municao: 'mun_rifle', pente: 5, recarga: 3 } },
  chinelo: { nome: 'Chinelo voador', cat: 'arma', peso: 0.2, valor: 3, icon: '🩴',
    desc: 'Técnica ancestral das mães brasileiras. Humanos fogem só de ver.',
    w: { tipo: 'distancia', classe: 'sling', dano: [1, 3], prec: 92, pa: 2, ruido: 1, alcance: 6, dur: 999, atordoar: 0.6, assusta: true, pente: 0 } },

  // ------------------------------------------------------------ arremessáveis
  molotov: { nome: 'Coquetel molotov', cat: 'arma', peso: 0.6, valor: 25, icon: '🍾',
    desc: 'Incendeia uma área 3x3. Zumbis queimam, carros explodem, casas pegam fogo.',
    w: { tipo: 'arremesso', classe: 'none', dano: [10, 16], prec: 80, pa: 3, ruido: 6, alcance: 7, area: 1, fogo: true }, consumivel: true },
  rojao: { nome: 'Rojão de festa junina', cat: 'arma', peso: 0.3, valor: 12, icon: '🎆',
    desc: 'Arremesse longe: faz um barulhão e atrai os zumbis para lá. Arraiá!',
    w: { tipo: 'arremesso', classe: 'none', dano: [2, 4], prec: 90, pa: 2, ruido: 22, alcance: 10, area: 1, distrai: true }, consumivel: true },
  pedra_grande: { nome: 'Tijolo', cat: 'arma', peso: 1.5, valor: 1, icon: '🧱',
    desc: 'Arremessável. Faz barulho onde cair.',
    w: { tipo: 'arremesso', classe: 'none', dano: [3, 7], prec: 80, pa: 2, ruido: 6, alcance: 6, distrai: true }, consumivel: true },

  // ------------------------------------------------------------ munição
  mun_pistola: { nome: 'Munição de pistola', cat: 'municao', peso: 0.012, valor: 2, icon: '🔸', pilha: 99, desc: 'Serve no revólver .38 e na pistola 9mm.' },
  mun_espingarda: { nome: 'Munição de espingarda', cat: 'municao', peso: 0.04, valor: 3, icon: '🔴', pilha: 99, desc: 'Cartuchos calibre 12.' },
  mun_rifle: { nome: 'Munição de rifle', cat: 'municao', peso: 0.02, valor: 3, icon: '🔹', pilha: 99, desc: 'Balas para o rifle de caça.' },
  pedrinhas: { nome: 'Pedrinhas', cat: 'municao', peso: 0.02, valor: 0, icon: '🪨', pilha: 99, desc: 'Munição de estilingue. Tem em todo canto.' },

  // ------------------------------------------------------------ comida e bebida
  agua: { nome: "Garrafa d'água", cat: 'comida', peso: 0.5, valor: 6, icon: '💧', uso: { sede: 30 }, desc: 'Meio litro de pura vida. Em Aimorés, no calor, vale ouro.' },
  galao: { nome: "Galão d'água (5 L)", cat: 'comida', peso: 5, valor: 25, icon: '🚰', uso: { sede: 25 }, cargas: 6, desc: 'Muita água. Pesa muito também.' },
  refri: { nome: 'Refrigerante de guaraná', cat: 'comida', peso: 0.6, valor: 6, icon: '🥤', uso: { sede: 20, moral: 4, energia: 5 }, desc: 'Quente, sem gás, e mesmo assim delicioso.' },
  suco: { nome: 'Suco de caixinha', cat: 'comida', peso: 0.3, valor: 4, icon: '🧃', uso: { sede: 15, fome: 5 }, desc: 'Sabor "uva". Que uva, ninguém sabe.' },
  cafe: { nome: 'Garrafa térmica de café', cat: 'comida', peso: 1.0, valor: 9, icon: '☕', uso: { energia: 25, sede: 5, moral: 5 }, cargas: 3, desc: 'Café de coador. Combustível de professora.' },
  pao: { nome: 'Pão francês', cat: 'comida', peso: 0.1, valor: 3, icon: '🥖', uso: { fome: 14 }, desc: 'Um pouco duro. Um pouco muito duro.' },
  enlatado: { nome: 'Sardinha em lata', cat: 'comida', peso: 0.4, valor: 8, icon: '🥫', uso: { fome: 30, sede: -5 }, desc: 'Proteína que dura até o fim do mundo. Literalmente.' },
  feijoada_lata: { nome: 'Feijoada em lata', cat: 'comida', peso: 0.5, valor: 10, icon: '🥫', uso: { fome: 38, moral: 6, sede: -6 }, desc: 'A melhor coisa que já saiu de uma lata.' },
  milho: { nome: 'Milho em lata', cat: 'comida', peso: 0.3, valor: 6, icon: '🌽', uso: { fome: 18, sede: 4 }, desc: 'Dá para comer frio.' },
  miojo: { nome: 'Macarrão instantâneo', cat: 'comida', peso: 0.1, valor: 5, icon: '🍜', uso: { fome: 16, sede: -8 }, desc: 'Cru é crocante. Cozido (no fogão) é refeição.' },
  biscoito: { nome: 'Biscoito recheado', cat: 'comida', peso: 0.15, valor: 4, icon: '🍪', uso: { fome: 12, moral: 5 }, desc: 'O pacote azul. Sim, aquele.' },
  chocolate: { nome: 'Barra de chocolate', cat: 'comida', peso: 0.1, valor: 5, icon: '🍫', uso: { fome: 10, moral: 7, energia: 5 }, desc: 'Um pouco derretido. Estamos em Aimorés.' },
  banana: { nome: 'Banana', cat: 'comida', peso: 0.15, valor: 2, icon: '🍌', uso: { fome: 10, sede: 4, energia: 4 }, desc: 'Da feira. A feira acabou, a banana ficou.' },
  manga: { nome: 'Manga', cat: 'comida', peso: 0.3, valor: 3, icon: '🥭', uso: { fome: 12, sede: 8 }, desc: 'Caiu da mangueira da praça. Suculenta.' },
  pamonha: { nome: 'Pamonha', cat: 'comida', peso: 0.3, valor: 9, icon: '🫔', uso: { fome: 28, moral: 12 }, desc: 'Pamonha fresquinha, pamonha caseira. Custou caro.' },
  racao: { nome: 'Ração de cachorro', cat: 'comida', peso: 1.0, valor: 2, icon: '🦴', uso: { fome: 15, moral: -10 }, desc: 'Sabor "carne". Última opção. Última mesmo.' },
  marmita: { nome: 'Marmita de arroz e feijão', cat: 'comida', peso: 0.6, valor: 16, icon: '🍛', uso: { fome: 55, moral: 14, energia: 8 }, desc: 'Comida preparada no fogão. Tem farofa. Tem amor.' },
  macarronada: { nome: 'Macarrão cozido', cat: 'comida', peso: 0.4, valor: 10, icon: '🍝', uso: { fome: 32, moral: 6 }, desc: 'Miojo dignificado pelo fogo.' },
  cachaca: { nome: 'Cachaça artesanal', cat: 'comida', peso: 0.8, valor: 12, icon: '🍶', uso: { moral: 15, sede: -8, bebado: 6 }, desc: 'Levanta o moral, derruba a mira. Também serve de antisséptico e para molotov.' },
  arroz: { nome: 'Pacote de arroz', cat: 'material', peso: 1.0, valor: 5, icon: '🍚', desc: 'Ingrediente. Cozinhe no fogão com feijão e água.' },
  feijao: { nome: 'Pacote de feijão', cat: 'material', peso: 1.0, valor: 5, icon: '🫘', desc: 'Ingrediente. Brasileiro não sobrevive sem.' },

  // ------------------------------------------------------------ medicamentos
  atadura: { nome: 'Atadura', cat: 'medicamento', peso: 0.1, valor: 8, icon: '🩹', uso: { hp: 6, estanca: true }, desc: 'Estanca sangramentos e cura um pouco.' },
  kit_medico: { nome: 'Kit de primeiros socorros', cat: 'medicamento', peso: 0.8, valor: 30, icon: '🧰', uso: { hp: 35, estanca: true, trata: true }, desc: 'Cura bastante e trata ferimentos.' },
  dipirona: { nome: 'Dipirona', cat: 'medicamento', peso: 0.05, valor: 7, icon: '💊', uso: { hp: 4, dor: 24, moral: 3 }, desc: 'O remédio oficial do brasileiro. Tira a dor dos ferimentos por um tempo.' },
  antibiotico: { nome: 'Antibiótico', cat: 'medicamento', peso: 0.05, valor: 22, icon: '💉', uso: { infeccao: -18, segura: 40 }, desc: 'Reduz a infecção e a segura por um bom tempo. Não cura mordida.' },
  alcool: { nome: 'Álcool 70%', cat: 'medicamento', peso: 0.5, valor: 6, icon: '🧴', uso: { infeccao: -5, trata: true }, cargas: 3, desc: 'Limpa ferimentos. Também serve para molotov.' },
  vitamina: { nome: 'Vitamina C efervescente', cat: 'medicamento', peso: 0.05, valor: 5, icon: '🍊', uso: { energia: 12, moral: 3 }, desc: 'Plop, plop, fizz, fizz.' },
  remedios: { nome: 'Caixa de remédios variados', cat: 'medicamento', peso: 0.2, valor: 8, icon: '💊', uso: { hp: 10 }, desc: 'Bula em alemão. Parece que ajuda.' },
  calmante: { nome: 'Chá de camomila', cat: 'medicamento', peso: 0.1, valor: 4, icon: '🍵', uso: { moral: 12, energia: -4 }, desc: 'Acalma os nervos. Pablício precisa de um balde.' },
  insulina: { nome: 'Insulina', cat: 'especial', peso: 0.1, valor: 40, icon: '💉', desc: 'Precisa ficar gelada. O marido da Dona Graça precisa dela.', quest: true },
  soro_r7: { nome: 'Soro R-7', cat: 'especial', peso: 0.2, valor: 200, icon: '🧪', uso: { infeccao: -100, cura: true }, desc: 'Protótipo da AgroNova. Cura a infecção. Só existe um frasco.' },

  // ------------------------------------------------------------ sobrevivência
  lanterna: { nome: 'Lanterna', cat: 'sobrevivencia', peso: 0.4, valor: 14, icon: '🔦', equip: 'mao2', carga: 100, desc: 'Essencial à noite. Gasta pilha. Zumbis veem a luz de longe.' },
  pilhas: { nome: 'Pilhas', cat: 'sobrevivencia', peso: 0.05, valor: 5, icon: '🔋', desc: 'Recarrega 50% da lanterna.' },
  corda: { nome: 'Corda', cat: 'sobrevivencia', peso: 1.0, valor: 7, icon: '🪢', desc: 'Útil em resgates e para amarrar coisas.' },
  ferramentas: { nome: 'Caixa de ferramentas', cat: 'sobrevivencia', peso: 3.0, valor: 20, icon: '🧰', ferramenta: true, desc: 'Consertos, barricadas e fechaduras.' },
  combustivel: { nome: 'Galão de gasolina', cat: 'sobrevivencia', peso: 4.0, valor: 30, icon: '⛽', desc: 'Para carro, gerador ou molotov.' },
  fosforos: { nome: 'Caixa de fósforos', cat: 'sobrevivencia', peso: 0.05, valor: 4, icon: '🔥', desc: 'Acende fogo, fogão e molotov.' },
  radio_pilha: { nome: 'Rádio de pilha', cat: 'sobrevivencia', peso: 0.6, valor: 12, icon: '📻', desc: 'Sintoniza a Rádio Aimorés FM. Às vezes alguém fala.' },
  apito: { nome: 'Apito de juiz', cat: 'sobrevivencia', peso: 0.05, valor: 2, icon: '📯', desc: 'Faz barulho ao seu redor. Útil para atrair zumbis para uma armadilha.' },
  mapa: { nome: 'Mapa de Aimorés', cat: 'sobrevivencia', peso: 0.1, valor: 6, icon: '🗺️', desc: 'Revela a cidade inteira no minimapa.' },

  // ------------------------------------------------------------ materiais
  tabuas: { nome: 'Tábuas', cat: 'material', peso: 1.5, valor: 4, icon: '🪵', desc: 'Para barricadas (2 tábuas + pregos).' },
  pregos: { nome: 'Pregos', cat: 'material', peso: 0.2, valor: 3, icon: '📌', desc: 'Para barricadas e para "melhorar" tacos.' },
  fita: { nome: 'Silver tape', cat: 'material', peso: 0.2, valor: 6, icon: '🩶', desc: 'Resolve tudo. Conserta armas e faz armaduras.' },
  revistas: { nome: 'Pilha de revistas', cat: 'material', peso: 1.0, valor: 1, icon: '📰', desc: 'Com silver tape, vira armadura de revista.' },
  pano: { nome: 'Pano limpo', cat: 'material', peso: 0.1, valor: 2, icon: '🧻', desc: 'Vira atadura (com álcool) ou pavio de molotov.' },
  garrafa: { nome: 'Garrafa vazia', cat: 'material', peso: 0.3, valor: 1, icon: '🍾', desc: 'Base de molotov.' },
  bateria_carro: { nome: 'Bateria de carro', cat: 'especial', peso: 8, valor: 35, icon: '🔋', desc: 'Pesada. Liga carro, rádio ou gerador.' },
  pecas: { nome: 'Peças eletrônicas', cat: 'material', peso: 0.5, valor: 10, icon: '🔌', desc: 'Placas, fios e válvulas. Para consertar o transmissor.' },
  pecas_motor: { nome: 'Peças de motor', cat: 'material', peso: 2.0, valor: 15, icon: '⚙️', desc: 'Correia, velas e mangueiras. Para consertar o carro.' },

  // ------------------------------------------------------------ equipamento
  mochila: { nome: 'Mochila escolar', cat: 'equipamento', peso: 0.6, valor: 12, icon: '🎒', equip: 'costas', capacidade: 8, desc: '+8 kg de capacidade. Tem um estojo esquecido dentro.' },
  mochila_camping: { nome: 'Mochila de camping', cat: 'equipamento', peso: 1.2, valor: 30, icon: '🎒', equip: 'costas', capacidade: 15, desc: '+15 kg de capacidade.' },
  jaqueta_couro: { nome: 'Jaqueta de couro', cat: 'equipamento', peso: 1.8, valor: 25, icon: '🧥', equip: 'corpo', armadura: 0.15, mordida: 0.25, desc: 'Reduz dano e protege de mordidas. Esquenta no calor de Aimorés.' },
  armadura_revista: { nome: 'Armadura de revista', cat: 'equipamento', peso: 2.0, valor: 18, icon: '📚', equip: 'corpo', armadura: 0.25, mordida: 0.4, furtiv: -1, desc: 'Revistas de fofoca e silver tape. Zumbi não morde fofoca.' },
  colete: { nome: 'Colete tático', cat: 'equipamento', peso: 3.0, valor: 60, icon: '🦺', equip: 'corpo', armadura: 0.35, mordida: 0.3, desc: 'Largado no bloqueio do exército.' },
  capacete: { nome: 'Capacete de moto', cat: 'equipamento', peso: 1.2, valor: 15, icon: '⛑️', equip: 'cabeca', armadura: 0.1, critico: 0.5, desc: 'Protege a cabeça. Abafa os sons (-1 percepção).' },

  // ------------------------------------------------------------ itens especiais / missões
  bilhete_merenda: { nome: 'Bilhete da merenda', cat: 'especial', peso: 0, valor: 0, icon: '📄', nota: true, quest: true,
    desc: '"Ref.: doação de 40 pacotes do suplemento CRESCE+ para a merenda escolar. Cortesia AgroNova Biotecnologia. Obs.: não aquecer acima de 40 °C."' },
  diario_livia: { nome: 'Diário da Dra. Lívia', cat: 'especial', peso: 0.2, valor: 0, icon: '📓', nota: true, quest: true,
    desc: '"Dia 12: o Dr. Heitor insiste em testar o CRESCE+ em tecido morto. Dia 15: o rato morto do tanque 3 se mexeu. Dia 16: o rato mordeu o Heitor. Dia 17: não vou voltar lá. Deixei o crachá reserva escondido na estação."' },
  cracha: { nome: 'Crachá da AgroNova', cat: 'especial', peso: 0, valor: 0, icon: '💳', quest: true, desc: 'Abre as portas do Galpão AgroNova.' },
  hd_dados: { nome: 'HD com dados do CRESCE+', cat: 'especial', peso: 0.3, valor: 0, icon: '💾', quest: true, desc: 'Toda a pesquisa da AgroNova, incluindo a fórmula do Soro R-7.' },
  chave_deposito: { nome: 'Chave do depósito da escola', cat: 'especial', peso: 0, valor: 0, icon: '🔑', quest: true, desc: 'Um chaveiro com uma plaquinha: "DEPÓSITO — NÃO PERDER (de novo)".' },
  chave_locomotiva: { nome: 'Chave da locomotiva', cat: 'especial', peso: 0.1, valor: 0, icon: '🗝️', quest: true, desc: 'Liga a velha locomotiva da estação.' },
  chave_carro: { nome: 'Chave do Opala', cat: 'especial', peso: 0, valor: 0, icon: '🔑', quest: true, desc: 'O xodó do Seu Valdir. Ainda anda, se alguém consertar.' },
  caderneta: { nome: 'Caderneta de fiado', cat: 'especial', peso: 0.1, valor: 0, icon: '📒', quest: true, desc: 'Metade de Aimorés deve para o Seu Zé.' },
  gato: { nome: 'Bolinho (gato)', cat: 'especial', peso: 4, valor: 0, icon: '🐈', quest: true, desc: 'Gato laranja, gordo e ofendido com o apocalipse.' },
  bilhete_cofre: { nome: 'Bilhete do chefe da estação', cat: 'especial', peso: 0, valor: 0, icon: '📝', nota: true, quest: true,
    desc: '"Segredo do cofre da bilheteria: 7-4-2-1. A chave da locomotiva fica lá dentro. Não esquecer de novo. — Osvaldo, chefe da estação"' },
  foto: { nome: 'Foto amassada', cat: 'especial', peso: 0, valor: 0, icon: '🖼️', nota: true, desc: 'Uma família sorrindo na Prainha do Rio Doce. Atrás: "Volta logo, pai."' },
};

for (const [id, it] of Object.entries(ITEMS)) it.id = id;

export function itemName(id, n = 1) {
  const it = ITEMS[id];
  if (!it) return id;
  return n > 1 ? `${it.nome} ×${n}` : it.nome;
}

// ------------------------------------------------------------ tabelas de loot
// [item, peso de sorteio, [min, max]]
export const LOOT = {
  geladeira: [['agua', 5, [1, 2]], ['refri', 3, [1, 1]], ['suco', 3, [1, 2]], ['banana', 2, [1, 3]], ['manga', 2, [1, 2]], ['pao', 2, [1, 3]], ['chocolate', 1, [1, 1]], ['insulina', 0.15, [1, 1]]],
  armario_cozinha: [['enlatado', 4, [1, 2]], ['feijoada_lata', 2, [1, 1]], ['milho', 3, [1, 2]], ['miojo', 4, [1, 3]], ['biscoito', 3, [1, 2]], ['arroz', 2, [1, 1]], ['feijao', 2, [1, 1]], ['fosforos', 2, [1, 1]], ['faca', 1.5, [1, 1]], ['frigideira', 1, [1, 1]], ['cafe', 1, [1, 1]], ['garrafa', 1.5, [1, 2]], ['cachaca', 0.6, [1, 1]], ['racao', 0.5, [1, 1]]],
  banheiro: [['atadura', 4, [1, 2]], ['dipirona', 4, [1, 2]], ['remedios', 2, [1, 1]], ['alcool', 2, [1, 1]], ['antibiotico', 0.7, [1, 1]], ['calmante', 1, [1, 1]], ['vitamina', 1.5, [1, 1]], ['kit_medico', 0.4, [1, 1]], ['rodo', 0.6, [1, 1]]],
  quarto: [['mochila', 1.2, [1, 1]], ['lanterna', 1.2, [1, 1]], ['pilhas', 2, [1, 2]], ['pano', 2, [1, 2]], ['revistas', 1.5, [1, 1]], ['chocolate', 1, [1, 1]], ['foto', 0.4, [1, 1]], ['revolver', 0.18, [1, 1]], ['mun_pistola', 0.5, [3, 8]], ['radio_pilha', 0.5, [1, 1]], ['dipirona', 1, [1, 1]], ['jaqueta_couro', 0.3, [1, 1]], ['apito', 0.4, [1, 1]], ['taco', 0.4, [1, 1]]],
  sala: [['revistas', 2, [1, 1]], ['pilhas', 1.5, [1, 2]], ['chocolate', 1, [1, 1]], ['biscoito', 1, [1, 1]], ['radio_pilha', 0.6, [1, 1]], ['mapa', 0.5, [1, 1]], ['fita', 0.8, [1, 1]], ['foto', 0.3, [1, 1]]],
  garagem: [['ferramentas', 1, [1, 1]], ['combustivel', 0.8, [1, 1]], ['corda', 1.5, [1, 1]], ['tabuas', 2, [1, 3]], ['pregos', 2, [1, 2]], ['fita', 1.5, [1, 1]], ['cano', 1.2, [1, 1]], ['pe_de_cabra', 0.8, [1, 1]], ['martelo', 1, [1, 1]], ['machado', 0.4, [1, 1]], ['capacete', 0.5, [1, 1]], ['garrafa', 1, [1, 2]], ['pecas_motor', 0.4, [1, 1]]],
  quintal: [['tabuas', 2, [1, 2]], ['pedrinhas', 3, [5, 12]], ['garrafa', 2, [1, 2]], ['pedra_grande', 2, [1, 2]], ['manga', 1.5, [1, 3]], ['pano', 1, [1, 1]], ['corda', 0.6, [1, 1]]],
  lixeira: [['garrafa', 3, [1, 2]], ['pano', 1.5, [1, 1]], ['revistas', 1, [1, 1]], ['pao', 0.8, [1, 1]], ['pedrinhas', 1, [3, 6]], ['pilhas', 0.4, [1, 1]]],
  carro: [['agua', 2, [1, 1]], ['refri', 1.5, [1, 1]], ['biscoito', 1.5, [1, 1]], ['mapa', 1, [1, 1]], ['lanterna', 0.8, [1, 1]], ['ferramentas', 0.5, [1, 1]], ['combustivel', 0.4, [1, 1]], ['kit_medico', 0.4, [1, 1]], ['revolver', 0.12, [1, 1]], ['mun_pistola', 0.4, [2, 6]], ['pilhas', 1, [1, 2]], ['foto', 0.4, [1, 1]]],
  escola_sala: [['mochila', 2, [1, 1]], ['biscoito', 2, [1, 1]], ['suco', 2, [1, 1]], ['pilhas', 1, [1, 1]], ['revistas', 1, [1, 1]], ['estilingue', 0.35, [1, 1]], ['pedrinhas', 1, [4, 10]], ['apito', 0.5, [1, 1]], ['chocolate', 1, [1, 1]]],
  escola_cozinha: [['arroz', 3, [1, 2]], ['feijao', 3, [1, 2]], ['enlatado', 3, [1, 3]], ['milho', 2, [1, 3]], ['agua', 3, [1, 3]], ['galao', 1, [1, 1]], ['faca', 1, [1, 1]], ['frigideira', 1, [1, 1]], ['fosforos', 1, [1, 1]]],
  escola_secretaria: [['pilhas', 2, [1, 2]], ['fita', 2, [1, 1]], ['mapa', 1, [1, 1]], ['radio_pilha', 0.7, [1, 1]], ['kit_medico', 0.6, [1, 1]], ['atadura', 1.5, [1, 2]], ['cafe', 1, [1, 1]]],
  escola_deposito: [['agua', 3, [2, 4]], ['galao', 1.5, [1, 1]], ['enlatado', 3, [2, 4]], ['feijoada_lata', 2, [1, 2]], ['biscoito', 2, [2, 3]], ['kit_medico', 1, [1, 1]], ['tabuas', 2, [2, 3]], ['pregos', 1.5, [1, 2]], ['rodo', 1, [1, 1]]],
  mercado_prateleira: [['enlatado', 4, [1, 3]], ['feijoada_lata', 2, [1, 2]], ['milho', 3, [1, 3]], ['miojo', 3, [2, 4]], ['biscoito', 3, [1, 3]], ['chocolate', 2, [1, 2]], ['arroz', 2, [1, 2]], ['feijao', 2, [1, 2]], ['agua', 3, [1, 3]], ['refri', 2, [1, 2]], ['suco', 2, [1, 2]], ['pilhas', 1.5, [1, 3]], ['fosforos', 1.5, [1, 2]], ['racao', 0.6, [1, 1]], ['cachaca', 0.6, [1, 1]], ['alcool', 1, [1, 1]], ['fita', 0.7, [1, 1]], ['lanterna', 0.5, [1, 1]]],
  mercado_freezer: [['agua', 3, [1, 3]], ['refri', 3, [1, 2]], ['suco', 2, [1, 2]], ['insulina', 0.2, [1, 1]]],
  mercado_estoque: [['galao', 2, [1, 2]], ['agua', 3, [3, 6]], ['enlatado', 3, [3, 6]], ['feijoada_lata', 2, [1, 3]], ['arroz', 2, [2, 3]], ['feijao', 2, [2, 3]], ['pilhas', 2, [2, 4]], ['mochila_camping', 0.4, [1, 1]], ['lanterna', 1, [1, 1]], ['ferramentas', 0.5, [1, 1]]],
  caixa_registradora: [['chocolate', 2, [1, 2]], ['pilhas', 2, [1, 2]], ['fosforos', 1, [1, 1]], ['apito', 0.4, [1, 1]], ['caderneta', 0, [1, 1]]],
  escritorio: [['pilhas', 2, [1, 2]], ['fita', 1.5, [1, 1]], ['mapa', 1, [1, 1]], ['cafe', 1, [1, 1]], ['revolver', 0.3, [1, 1]], ['mun_pistola', 0.8, [4, 10]], ['radio_pilha', 0.6, [1, 1]], ['kit_medico', 0.4, [1, 1]]],
  farmacia: [['atadura', 4, [1, 3]], ['kit_medico', 2, [1, 1]], ['dipirona', 4, [2, 4]], ['antibiotico', 2, [1, 2]], ['alcool', 2, [1, 2]], ['vitamina', 2, [1, 3]], ['remedios', 3, [1, 2]], ['calmante', 2, [1, 2]], ['insulina', 0.5, [1, 1]], ['agua', 1, [1, 1]]],
  roupas: [['jaqueta_couro', 1, [1, 1]], ['mochila', 2, [1, 1]], ['mochila_camping', 0.6, [1, 1]], ['pano', 4, [1, 3]], ['capacete', 0.3, [1, 1]], ['chinelo', 1.2, [1, 1]]],
  ferramentas_loja: [['ferramentas', 2, [1, 1]], ['machado', 1, [1, 1]], ['martelo', 2, [1, 1]], ['pe_de_cabra', 1.5, [1, 1]], ['facao', 1.2, [1, 1]], ['corda', 2, [1, 2]], ['pregos', 3, [1, 3]], ['tabuas', 2, [1, 3]], ['fita', 3, [1, 2]], ['lanterna', 1.5, [1, 1]], ['pilhas', 2, [1, 3]], ['cano', 1, [1, 1]]],
  eletronicos: [['pecas', 4, [1, 2]], ['pilhas', 4, [2, 4]], ['radio_pilha', 2, [1, 1]], ['lanterna', 2, [1, 1]], ['bateria_carro', 0.2, [1, 1]]],
  restaurante: [['arroz', 2, [1, 2]], ['feijao', 2, [1, 2]], ['marmita', 1, [1, 1]], ['agua', 2, [1, 2]], ['refri', 3, [1, 2]], ['faca', 1.5, [1, 1]], ['facao', 0.4, [1, 1]], ['frigideira', 1.5, [1, 1]], ['fosforos', 1, [1, 1]], ['cachaca', 1, [1, 1]]],
  conveniencia: [['refri', 3, [1, 2]], ['agua', 3, [1, 2]], ['chocolate', 3, [1, 2]], ['biscoito', 3, [1, 2]], ['pilhas', 2, [1, 2]], ['fosforos', 2, [1, 1]], ['mapa', 1, [1, 1]], ['cachaca', 1, [1, 1]], ['rojao', 0.8, [1, 2]]],
  oficina: [['ferramentas', 2, [1, 1]], ['pecas_motor', 1.5, [1, 1]], ['combustivel', 1, [1, 1]], ['cano', 2, [1, 1]], ['pe_de_cabra', 1, [1, 1]], ['fita', 2, [1, 1]], ['bateria_carro', 0.4, [1, 1]], ['martelo', 1, [1, 1]]],
  igreja: [['pao', 2, [1, 3]], ['agua', 2, [1, 2]], ['atadura', 1, [1, 1]], ['calmante', 1, [1, 1]], ['fosforos', 1.5, [1, 1]], ['pano', 1, [1, 2]]],
  laboratorio: [['antibiotico', 2, [1, 2]], ['kit_medico', 1.5, [1, 1]], ['alcool', 2, [1, 2]], ['atadura', 2, [1, 2]], ['pecas', 1, [1, 1]], ['fita', 1, [1, 1]]],
  militar: [['mun_rifle', 3, [3, 8]], ['mun_pistola', 3, [4, 10]], ['mun_espingarda', 2, [2, 5]], ['colete', 0.6, [1, 1]], ['kit_medico', 1.5, [1, 1]], ['agua', 2, [1, 2]], ['enlatado', 2, [1, 2]], ['rojao', 0.5, [1, 1]]],
  ferro_velho: [['pecas_motor', 1.5, [1, 1]], ['bateria_carro', 0.5, [1, 1]], ['cano', 2, [1, 1]], ['tabuas', 2, [1, 2]], ['fita', 1, [1, 1]], ['combustivel', 0.4, [1, 1]], ['pe_de_cabra', 0.6, [1, 1]]],
  estacao: [['cafe', 1.5, [1, 1]], ['pilhas', 2, [1, 2]], ['mapa', 1.5, [1, 1]], ['lanterna', 1, [1, 1]], ['biscoito', 1.5, [1, 1]], ['radio_pilha', 0.8, [1, 1]]],
  ferrovia: [['combustivel', 3, [1, 1]], ['tabuas', 1, [1, 2]], ['ferramentas', 0.5, [1, 1]], ['corda', 1, [1, 1]], ['pecas_motor', 0.6, [1, 1]]],
  radio: [['pecas', 3, [1, 2]], ['pilhas', 2, [1, 3]], ['cafe', 1, [1, 1]], ['fita', 1.5, [1, 1]]],
};
