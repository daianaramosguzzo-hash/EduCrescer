// ============================================================
//  CONFIGURAÇÃO DA RIFA: edite só este arquivo.
//  Depois de salvar, faça o commit e o GitHub Pages atualiza a página.
// ============================================================
window.RIFA_CONFIG = {
  titulo: 'Rifa Solidária',
  premio: 'Descreva aqui o prêmio (ex.: uma cesta de chocolates)',
  descricao: 'Escolha seus números, reserve com seu nome e pague pelo PIX. Seu número só é confirmado depois que o pagamento for conferido.',

  // Como o ganhador será conhecido (o site não faz sorteio).
  resultado: 'O resultado sai pela Loteria Federal. Data a definir.',

  valorNumero: 10.0, // preço de cada número, em reais

  numeroInicial: 0,
  numeroFinal: 100, // se mudar, mude também NUMERO_FINAL no planilha.gs

  pix: {
    // Telefone: '+5527999999999' · CPF: só números · e-mail · ou chave aleatória
    chave: '',
    nome: '',   // nome do recebedor, como aparece no banco (até 25 letras)
    cidade: '', // cidade do recebedor (até 15 letras)
  },

  // WhatsApp de quem organiza, com DDI e DDD, só números (ex.: '5527999999999').
  // Se preencher, aparece o botão "Enviar comprovante".
  whatsapp: '',

  // Endereço do Apps Script da planilha (termina em /exec). Veja o LEIAME.md.
  // Vazio = modo de teste: as escolhas ficam salvas só no aparelho de quem abriu.
  planilhaUrl: '',
};
