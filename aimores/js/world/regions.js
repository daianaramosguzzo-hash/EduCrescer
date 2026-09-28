// Regiões de Aimorés com nível de perigo (verde: tranquilo, amarela: perigoso, vermelha: muito perigoso).
// A base (Casa da Turma) é o centro seguro. A primeira região que contém a casa vale.
export const REGIOES = [
  { id: 'base', nome: 'Casa da Turma (base)', perigo: 'base', r: [0, 7, 15, 23], desc: 'O centro seguro da turma: construa, guarde, durma e troque de sobrevivente.' },
  { id: 'escola', nome: 'Escola Estadual Rio Doce', perigo: 'amarela', r: [18, 0, 45, 23], desc: 'Salas de aula, biblioteca e zumbis de uniforme.' },
  { id: 'saude', nome: 'Unidade de Saúde', perigo: 'amarela', r: [52, 0, 68, 9], rotulo: 'baixo', desc: 'Remédios, ataduras e kits médicos — e quem veio buscar atendimento e não saiu.' },
  { id: 'norte', nome: 'Bairro Alto (casas)', perigo: 'amarela', r: [46, 0, 104, 23], desc: 'Casas de família, quintais e a Casa Infestada.' },
  { id: 'campinho', nome: 'Rádio e Campinho', perigo: 'amarela', r: [104, 0, 123, 52], desc: 'A Rádio Aimorés FM e o campinho de terra.' },
  { id: 'bar', nome: 'Rua do Bar do Tião', perigo: 'verde', r: [0, 24, 17, 52], desc: 'O bar do Tião e a casa dos Oliveira. Relativamente calmo.' },
  { id: 'mercado', nome: 'Supermercado Bom Preço', perigo: 'vermelha', r: [18, 24, 46, 52], desc: 'Muita comida e muitos zumbis lá dentro.' },
  { id: 'centro', nome: 'Centro (Praça e Igreja Matriz)', perigo: 'vermelha', r: [47, 24, 80, 52], desc: 'O coração da cidade — e do surto. Cuidado com o Pamonheiro.' },
  { id: 'comercio', nome: 'Comércio (farmácia e lojas)', perigo: 'amarela', r: [81, 24, 103, 52], desc: 'Farmácia, loja de roupas, eletrônicos e restaurante.' },
  { id: 'rua_ze', nome: 'Rua do Mercadinho', perigo: 'amarela', r: [0, 53, 48, 73], desc: 'Mercadinho do Seu Zé, Casa das Ferramentas e a casa do Seu Arlindo.' },
  { id: 'posto', nome: 'Oficina e Posto Rio Doce', perigo: 'vermelha', r: [49, 53, 105, 73], desc: 'A oficina do Valdir e o posto dos Lobos do Asfalto.' },
  { id: 'agronova', nome: 'Galpão AgroNova', perigo: 'vermelha', r: [106, 53, 123, 90], desc: 'Onde tudo começou. O lugar mais perigoso da cidade.' },
  { id: 'rural', nome: 'Área rural e Horta Comunitária', perigo: 'verde', r: [0, 74, 19, 90], desc: 'Hortas, mato e poucas ameaças.' },
  { id: 'ferrovia', nome: 'Estação e ferrovia', perigo: 'amarela', r: [20, 74, 50, 90], desc: 'A estação, o trem e os trilhos.' },
  { id: 'ferro_velho', nome: 'Ferro-velho e depósito', perigo: 'amarela', r: [51, 74, 105, 90], desc: 'Sucata para a base e zumbis grandes.' },
  { id: 'rio', nome: 'Beira do Rio Doce', perigo: 'verde', r: [0, 91, 123, 103], desc: 'Pedras, mato e água. O rio corre devagar.' },
];
export const PERIGO_NOME = { base: 'Seguro', verde: 'Tranquilo', amarela: 'Perigoso', vermelha: 'Muito perigoso' };
export const PERIGO_COR2 = { base: '#4ab8f0', verde: '#5fb82a', amarela: '#f4c534', vermelha: '#e8433a' };

export function regionAt(x, z) {
  for (const g of REGIOES) { const [x0, z0, x1, z1] = g.r; if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return g; }
  return null;
}
