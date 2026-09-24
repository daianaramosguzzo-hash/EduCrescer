// Missões principais e secundárias. Os ganchos (turno, entrar, vasculhou, pegou, matou,
// opcoes, npcMorreu) são chamados pelo motor da história (game/story.js).
import { questAdvance, questDone, questStart, questStep, questFail, flag, hero, anyHeroHas, takeFromParty, giveParty, scene, banter, Q, addClue } from '../game/story.js';
import { countItem } from '../game/units.js';
import { bus, rng } from '../util.js';
import { ITEMS } from './items.js';

const inBuilding = (g, u, type) => { const b = g.map.buildingAt(u.x, u.z); return b && (b.type === type || b.name === type); };
const stashFood = g => { const bau = g.map.props.find(p => p.stash || p.type === 'bau'); if (!bau || !bau.loot) return 0; return bau.loot.reduce((s, e) => s + (ITEMS[e.id]?.cat === 'comida' ? e.n : 0), 0); };

export const QUESTS = {
  // ================================================================ PRINCIPAIS
  prologo: {
    nome: 'Acordando no Apocalipse', tipo: 'principal', xp: 60,
    resumo: 'Uma manhã quente em Aimorés. A TV só mostra chiado e tem alguém gemendo no jardim.',
    passos: [
      { id: 'explorar', desc: 'Pegue suprimentos: vasculhe a geladeira e a pia da cozinha da Casa da Turma.', xp: 15 },
      { id: 'vizinho', desc: 'Tem alguém no jardim da frente... parece o Seu Lindomar, o vizinho. Vá ver — e se defenda.', xp: 30 },
      { id: 'radio', desc: 'Pegue o rádio de pilha no baú do esconderijo (na sala) e use-o no inventário.', xp: 15 },
    ],
    vasculhou(g, u, p) {
      const s = Q(g, 'prologo');
      if (questStep(g, 'prologo') !== 'explorar') return;
      const b = g.map.buildings[p.building];
      if (!b || !b.safehouse) return;
      if (['geladeira', 'armario', 'pia'].includes(p.type)) { s.vars.n = (s.vars.n || 0) + 1; if (s.vars.n >= 2) questAdvance(g, 'prologo', 'explorar'); }
    },
    turno(g) {
      if (questStep(g, 'prologo') === 'vizinho') { const v = g.units.find(u => u.ai && u.ai.prologo); if (!v || v.dead) questAdvance(g, 'prologo', 'vizinho'); }
      if (questStep(g, 'prologo') === 'vizinho' && !flag(g, 'viu_vizinho')) {
        const v = g.units.find(u => u.ai && u.ai.prologo);
        if (v && g.unitVisible(v)) { flag(g, 'viu_vizinho', true); banter(g, 'vizinho', { force: true }); }
      }
    },
    fim(g) { questStart(g, 'mantimentos'); questStart(g, 'escola'); },
  },
  mantimentos: {
    nome: 'Despensa Cheia', tipo: 'principal', xp: 120,
    resumo: 'Ninguém sobrevive ao apocalipse (nem ao calor de Aimorés) de barriga vazia.',
    passos: [{ id: 'estocar', desc: 'Junte pelo menos 12 comidas ou bebidas no baú da Casa da Turma (o baú já tem algumas). O Supermercado Bom Preço e o Mercadinho do Seu Zé são boas apostas.' }],
    turno(g) { if (questStep(g, 'mantimentos') === 'estocar' && stashFood(g) >= 12) questDone(g, 'mantimentos'); },
  },
  escola: {
    nome: 'Aula de Sobrevivência', tipo: 'principal', xp: 150,
    resumo: 'O Professor Tavares ficou na Escola Estadual Rio Doce com dois alunos da recuperação.',
    passos: [
      { id: 'ir', desc: 'Vá até a Escola Estadual Rio Doce, na Rua Sete de Setembro.', xp: 20 },
      { id: 'biblioteca', desc: 'Encontre o Professor Tavares e os alunos na biblioteca (fundos da escola).', xp: 40 },
      { id: 'decidir', desc: 'Decida com o Professor Tavares o que fazer com os sobreviventes.' },
      { id: 'escoltar', desc: 'Leve o Professor Tavares, o Kauã e a Yasmin em segurança até a Igreja Matriz, na praça.' },
    ],
    entrar(g, u, x, z, b) { if (b && b.type === 'escola' && questStep(g, 'escola') === 'ir') questAdvance(g, 'escola', 'ir'); },
    turno(g) {
      if (questStep(g, 'escola') !== 'escoltar') return;
      const grupo = g.units.filter(u => ['tavares', 'aluno1', 'aluno2'].includes(u.npc));
      const vivos = grupo.filter(u => u.alive);
      if (!vivos.length) { questFail(g, 'escola', 'Ninguém da escola sobreviveu.'); return; }
      const igreja = g.map.buildings.find(b => b.type === 'igreja');
      if (vivos.every(u => g.map.building[g.map.idx(u.x, u.z)] === igreja.id)) {
        for (const u of vivos) { u.faction = 'neutral'; u.ai.comport = 'parado'; g.state.saved.push(u.name); }
        flag(g, 'escola_escoltada', vivos.length);
        flag(g, 'refugio_' + igreja.id, true);
        g.log(`⛪ ${vivos.length} sobrevivente(s) da escola chegaram à Igreja Matriz.`, 'bom');
        questDone(g, 'escola');
        banter(g, 'escola_salva', { force: true });
      }
    },
    npcMorreu(g, npc) { if (['tavares', 'aluno1', 'aluno2'].includes(npc.npc)) g.log(`💔 ${npc.name} não resistiu.`, 'perigo'); },
    fim(g) { if (!Q(g, 'origem')) questStart(g, 'origem'); },
  },
  origem: {
    nome: 'Cresce, Cresce, Aimorés', tipo: 'principal', xp: 200,
    resumo: 'Um bilhete da merenda fala de um tal "suplemento CRESCE+" doado pela AgroNova. Coincidência demais.',
    passos: [
      { id: 'graca', desc: 'Pergunte à Dona Graça, na Farmácia Popular (Rua Minas Gerais), sobre a AgroNova.', xp: 30 },
      { id: 'casa_livia', desc: 'Investigue a casa da Dra. Lívia, na Rua Sete de Setembro (ao lado da casa da Dona Cotinha).', xp: 40 },
      { id: 'estacao', desc: 'Encontre a Dra. Lívia escondida na Estação Ferroviária, perto do rio.', xp: 60 },
    ],
    turno(g) {
      if (questStep(g, 'origem') === 'casa_livia' && anyHeroHas(g, 'diario_livia')) questAdvance(g, 'origem', 'casa_livia');
    },
    pegou(g, u, id) { if (id === 'diario_livia' && questStep(g, 'origem') === 'casa_livia') questAdvance(g, 'origem', 'casa_livia'); },
    fim(g) { questStart(g, 'agronova'); questStart(g, 'fuga'); },
  },
  agronova: {
    nome: 'O Galpão da AgroNova', tipo: 'principal', xp: 300,
    resumo: 'A cura e as provas estão no laboratório da AgroNova, perto da ponte. E alguma coisa enorme também.',
    passos: [
      { id: 'entrar', desc: 'Entre no complexo da AgroNova. O portão está acorrentado: pé de cabra ou o Pablício resolvem.', xp: 40 },
      { id: 'provas', desc: 'Pegue o Soro R-7 (sala fria) e o HD com a pesquisa (escritório do Dr. Heitor). Use o crachá nas portas.', xp: 80 },
    ],
    entrar(g, u, x, z) { if (questStep(g, 'agronova') === 'entrar' && x >= 107 && x <= 122 && z >= 58 && z <= 82) questAdvance(g, 'agronova', 'entrar'); },
    turno(g) { if (questStep(g, 'agronova') === 'provas' && anyHeroHas(g, 'soro_r7') && anyHeroHas(g, 'hd_dados')) questDone(g, 'agronova'); },
    fim(g) { banter(g, 'provas', { force: true }); },
  },
  fuga: {
    nome: 'Fuga de Aimorés', tipo: 'principal', xp: 0,
    resumo: 'O exército vai "esterilizar" a cidade. Há três jeitos de sair: pela ponte, pelos trilhos ou pelo céu.',
    passos: [
      { id: 'escolher', desc: 'Escolha uma saída: ① consertar o Opala do Seu Valdir (bateria, peças de motor e gasolina) e seguir para a ponte; ② ligar a locomotiva da estação (chave do cofre da bilheteria e 2 galões de combustível); ③ consertar o transmissor da Rádio Aimorés FM (2 peças eletrônicas e gasolina para o gerador) e chamar resgate.' },
    ],
    opcoes(g, u, p) {
      if (!Q(g, 'fuga')) return [];
      const out = [];
      if (p.type === 'opala') {
        const mech = hero(g, 'pablicio') || flag(g, 'valdir_curado');
        const ok = flag(g, 'opala_ok');
        if (!ok) out.push({ label: 'Consertar o Opala (bateria + peças de motor + gasolina)', ap: 6, disabled: !(mech && anyHeroHas(g, 'bateria_carro') && anyHeroHas(g, 'pecas_motor') && anyHeroHas(g, 'combustivel')), fn: () => consertarOpala(g, u, p) });
        else out.push({ label: '🚗 Todo mundo para o Opala! Rumo à ponte!', ap: 0, fn: () => finalPonte(g, u) });
      }
      if (p.type === 'locomotiva') {
        const ok = anyHeroHas(g, 'chave_locomotiva') && anyHeroHas(g, 'combustivel', 2);
        out.push({ label: '🚂 Ligar a locomotiva e fugir pelos trilhos (chave + 2 galões)', ap: 4, disabled: !ok, fn: () => finalTrem(g, u) });
      }
      if (p.type === 'transmissor') {
        const tec = hero(g, 'daiana') || hero(g, 'pablicio') || flag(g, 'juninho_aliado');
        const ok = anyHeroHas(g, 'pecas', 2) && (flag(g, 'gerador_ok') || anyHeroHas(g, 'combustivel'));
        if (!flag(g, 'transmitiu')) out.push({ label: '📡 Consertar o transmissor e pedir resgate (2 peças + gasolina no gerador)', ap: 6, disabled: !(tec && ok), fn: () => transmitir(g, u) });
      }
      return out;
    },
  },
  resgate: {
    nome: 'Esperando o Helicóptero', tipo: 'principal', xp: 0,
    resumo: 'O resgate vem buscar quem estiver no Campinho do Rio Doce. Só precisa estar vivo até lá.',
    passos: [{ id: 'campinho', desc: 'Leve o grupo até o Campinho do Rio Doce e aguente até o helicóptero chegar.' }],
    turno(g) {
      if (questStep(g, 'resgate') !== 'campinho') return;
      const inField = g.liveHeroes.filter(h => !h.st.downed && h.x >= 106 && h.z <= 22);
      const s = Q(g, 'resgate');
      if (inField.length && inField.length === g.liveHeroes.filter(h => !h.st.downed).length) {
        s.vars.t = (s.vars.t || 0) + 1;
        const left = 10 - s.vars.t;
        if (s.vars.t === 1) { g.log('🚁 Estão todos no campinho. O helicóptero chega em 10 rodadas. Aguentem!', 'alerta'); spawnHorde(g, 114, 12, 6); }
        if (left > 0 && s.vars.t % 3 === 0) { g.log(`🚁 O barulho das hélices se aproxima... faltam ${left} rodadas.`, 'alerta'); spawnHorde(g, 114, 12, 3); }
        if (left <= 0) { flag(g, 'fim', 'helicoptero'); bus.emit('ending', 'helicoptero'); }
      }
    },
  },

  // ================================================================ SECUNDÁRIAS
  insulina: {
    nome: 'Insulina para o Seu Arlindo', tipo: 'secundaria', xp: 120,
    resumo: 'A Dona Graça precisa de insulina para o marido, que ficou em casa.',
    passos: [
      { id: 'achar', desc: 'Encontre insulina (freezers do supermercado, farmácias, geladeiras).', xp: 30 },
      { id: 'entregar', desc: 'Leve a insulina ao Seu Arlindo, na casa dele (Avenida Rio Doce, perto da Rua das Palmeiras). Cuidado: a casa tem armadilhas!' },
    ],
    turno(g) { if (questStep(g, 'insulina') === 'achar' && anyHeroHas(g, 'insulina')) questAdvance(g, 'insulina', 'achar'); },
  },
  gato: {
    nome: 'Cadê o Bolinho?', tipo: 'secundaria', xp: 100,
    resumo: 'O gato da Dona Cotinha fugiu para a Casa Infestada. Ela jura que ele é "muito educado".',
    passos: [
      { id: 'achar', desc: 'Encontre o Bolinho na Casa Infestada (Rua Sete de Setembro, lado leste).', xp: 30 },
      { id: 'devolver', desc: 'Devolva o Bolinho para a Dona Cotinha.' },
    ],
    turno(g) { if (questStep(g, 'gato') === 'achar' && anyHeroHas(g, 'gato')) questAdvance(g, 'gato', 'achar'); },
  },
  caderneta: {
    nome: 'A Caderneta do Fiado', tipo: 'secundaria', xp: 80,
    resumo: 'Metade de Aimorés deve para o Seu Zé. Ele quer a caderneta de volta — apocalipse não perdoa dívida.',
    passos: [
      { id: 'achar', desc: 'Encontre a caderneta de fiado do Seu Zé (ele acha que esqueceu no balcão do Bar do Tião).', xp: 20 },
      { id: 'devolver', desc: 'Devolva a caderneta ao Seu Zé, no mercadinho.' },
    ],
    turno(g) { if (questStep(g, 'caderneta') === 'achar' && anyHeroHas(g, 'caderneta')) questAdvance(g, 'caderneta', 'achar'); },
  },
  lobos: {
    nome: 'Pedágio dos Lobos', tipo: 'secundaria', xp: 100,
    resumo: 'Os Lobos do Asfalto tomaram o posto e todo o combustível da cidade.',
    passos: [{ id: 'resolver', desc: 'Consiga combustível com os Lobos do Asfalto no Posto Rio Doce: pague, negocie, engane ou lute.' }],
    npcMorreu(g, npc) { if (npc.npc === 'tonhao' && questStep(g, 'lobos') === 'resolver') { flag(g, 'lobos_derrotados', true); questDone(g, 'lobos'); } },
  },
  juninho: {
    nome: 'O Garoto do Rádio', tipo: 'secundaria', xp: 120,
    resumo: 'Tem alguém trancado no escritório da loja de eletrônicos. E ele sabe mexer com rádio.',
    passos: [
      { id: 'convencer', desc: 'Convença o Juninho a abrir a porta do escritório (Eletrônica do Juninho, Rua da Ponte).', xp: 30 },
      { id: 'bateria', desc: 'Leve uma bateria de carro para o Juninho ligar o rádio amador (o ferro-velho deve ter).' },
    ],
  },
  valdir: {
    nome: 'A Febre do Mecânico', tipo: 'secundaria', xp: 100,
    resumo: 'Seu Valdir foi arranhado por um "cliente estranho" e está com febre na oficina.',
    passos: [{ id: 'remedio', desc: 'Leve um antibiótico para o Seu Valdir, na Oficina Mecânica (Avenida Rio Doce).' }],
  },
  pamonheiro: {
    nome: 'Pamonha, Pamonha, Pamonha', tipo: 'secundaria', xp: 120,
    resumo: 'Tem um zumbi com megafone e chapéu de palha gritando na praça. Todo zumbi da cidade atende o chamado.',
    passos: [{ id: 'derrotar', desc: 'Derrote o Zumbi Pamonheiro (Praça da Matriz, à noite).' }],
    matou(g, u) { if (u.type === 'pamonheiro') { questDone(g, 'pamonheiro'); giveParty(g, null, 'pamonha', 3); } },
  },
  oliveira: {
    nome: 'A Família Oliveira', tipo: 'secundaria', xp: 80,
    resumo: 'A família da Dona Neide está sem comida há dois dias.',
    passos: [{ id: 'comida', desc: 'Leve 3 comidas para a Dona Neide, na Casa dos Oliveira (Avenida Rio Doce).' }],
  },
  kelly: {
    nome: 'Entrega Especial', tipo: 'secundaria', xp: 90,
    resumo: 'Uma entregadora está cercada por zumbis em cima de um carro.',
    passos: [{ id: 'salvar', desc: 'Salve a entregadora: acabe com os zumbis em volta dela.' }],
    turno(g) {
      if (questStep(g, 'kelly') !== 'salvar') return;
      const k = g.units.find(u => u.npc === 'kelly');
      if (!k || k.dead) { questFail(g, 'kelly', 'Não deu tempo.'); return; }
      const perto = g.units.filter(z => z.alive && z.kind === 'zombie' && Math.hypot(z.x - k.x, z.z - k.z) < 6);
      if (!perto.length) { questDone(g, 'kelly'); flag(g, 'kelly_salva', true); }
    },
  },
  defesa: {
    nome: 'Noite na Matriz', tipo: 'secundaria', xp: 200,
    resumo: 'Uma horda está vindo para a igreja, onde estão os refugiados.',
    passos: [{ id: 'defender', desc: 'Defenda a Igreja Matriz: sobreviva por 8 rodadas perto da igreja e não deixe os refugiados morrerem.' }],
    turno(g) {
      if (questStep(g, 'defesa') !== 'defender') return;
      const s = Q(g, 'defesa');
      const igreja = g.map.buildings.find(b => b.type === 'igreja');
      const perto = g.liveHeroes.some(h => Math.hypot(h.x - 63, h.z - 38) < 12);
      if (!perto) return;
      s.vars.t = (s.vars.t || 0) + 1;
      if (s.vars.t === 1 || s.vars.t === 4) spawnHorde(g, 63, 48, 5);
      if (s.vars.t >= 8) { questDone(g, 'defesa'); flag(g, 'igreja_defendida', true); for (const h of g.liveHeroes) h.need.moral = Math.min(100, h.need.moral + 20); }
      void igreja;
    },
  },
};

// ------------------------------------------------------------ finais
function spawnHorde(g, x, z, n) {
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < 20; t++) {
      const a = rng.next() * 6.28, d = 9 + rng.next() * 5;
      const nx = Math.round(x + Math.cos(a) * d), nz = Math.round(z + Math.sin(a) * d);
      if (!g.map.inb(nx, nz) || g.map.blocked(nx, nz) || g.unitAt(nx, nz)) continue;
      const zz = g.spawnZombie(rng.weighted([['comum', 6], ['corredor', 2], ['resistente', 1]]), nx, nz);
      zz.ai.state = 'investigate'; zz.ai.noise = { x, z, turn: g.state.turn };
      break;
    }
  }
  g.updateMode();
}
async function consertarOpala(g, u, p) {
  if (!(await g.approach(u, p.x, p.z, 6))) return;
  if (!g.can(u, 6)) return;
  await g.act(async () => {
    g.spend(u, 6);
    takeFromParty(g, 'bateria_carro'); takeFromParty(g, 'pecas_motor'); takeFromParty(g, 'combustivel');
    await g.S.units.play(u, 'interact');
    g.noise(p.x, p.z, 10, u);
    flag(g, 'opala_ok', true);
    await scene(g, [
      ['narr', '🔧 Uma hora de graxa, palavrões e silver tape depois...'],
      ['narr', '<i>VRRRUM... VRUM VRUM VRUUUUM!</i> O motor do Opala ronca como um leão de seis cilindros.'],
      ['pablicio', 'ELE LIGOU! EU CONSERTEI UM OPALA NO APOCALIPSE! Alguém filma isso!'],
      ['daiana', 'Todo mundo no carro. A ponte fica no fim da Rua da Ponte.'],
    ], { hero: u });
  });
}
async function finalPonte(g, u) {
  const fora = g.liveHeroes.filter(h => !h.st.downed && Math.hypot(h.x - u.x, h.z - u.z) > 5);
  if (fora.length) { g.toast(`Espere o grupo todo perto do carro (${fora.map(h => h.name).join(', ')}).`, 'erro'); return; }
  for (const h of g.liveHeroes) await g.S.units.play(h, 'vehicleIn');
  const cura = anyHeroHas(g, 'hd_dados');
  flag(g, 'fim', cura ? 'ponte' : 'ponte_forcada');
  bus.emit('ending', cura ? 'ponte' : 'ponte_forcada');
}
async function finalTrem(g, u) {
  const fora = g.liveHeroes.filter(h => !h.st.downed && Math.hypot(h.x - u.x, h.z - u.z) > 6);
  if (fora.length) { g.toast(`Espere o grupo todo perto da locomotiva (${fora.map(h => h.name).join(', ')}).`, 'erro'); return; }
  if (!g.can(u, 4)) return;
  takeFromParty(g, 'combustivel', 2);
  await scene(g, [
    ['narr', '🚂 A velha locomotiva tosse fumaça preta, estremece... e começa a andar.'],
    ['arthur', 'A gente tá fugindo de zumbi de TREM. Isso é o melhor dia da minha vida. Quer dizer, o pior. Os dois.'],
  ], { hero: u });
  flag(g, 'fim', 'trem');
  bus.emit('ending', 'trem');
}
async function transmitir(g, u) {
  const p = g.map.props.find(pp => pp.type === 'transmissor');
  if (!(await g.approach(u, p.x, p.z, 6))) return;
  if (!g.can(u, 6)) return;
  await g.act(async () => {
    g.spend(u, 6);
    takeFromParty(g, 'pecas', 2);
    if (!flag(g, 'gerador_ok')) { takeFromParty(g, 'combustivel'); flag(g, 'gerador_ok', true); }
    await g.S.units.play(u, 'interact');
    flag(g, 'transmitiu', true);
    const cura = anyHeroHas(g, 'hd_dados');
    if (cura) flag(g, 'formula_transmitida', true);
    await scene(g, [
      ['narr', '📡 O gerador ruge. As luzes do painel acendem uma a uma.'],
      ['daiana', 'Alô, alô! Aqui é Aimorés, Minas Gerais. Tem sobrevivente aqui! Repito: TEM GENTE VIVA EM AIMORÉS!'],
      cura ? ['daiana', 'E tem mais: a gente tem a fórmula da cura. Soro R-7. Vou ler devagar, anotem...'] : ['daiana', 'Por favor, cancelem o bombardeio. Tem crianças aqui!'],
      ['Rádio do Exército', '— Aimorés, aqui é o Comando. Recebido. Mandem o grupo para o campo de futebol. Helicóptero a caminho.'],
      ['carol', 'Obrigada, meu Deus. Obrigada.'],
    ], { hero: u });
    questStart(g, 'resgate');
    g.noise(p.x, p.z, 20, u);
  });
}
