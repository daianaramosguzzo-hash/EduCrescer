// Gera o código PIX "copia e cola" (BR Code estático, padrão EMV do Banco Central)
// e o CRC16 que o banco usa para conferir o código.
(function () {
  function campo(id, valor) {
    return id + String(valor.length).padStart(2, '0') + valor;
  }

  // Tira acentos e caracteres fora do padrão (nome e cidade precisam ser ASCII).
  function limpar(texto, max) {
    return String(texto || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .replace(/\s+/g, ' ').trim()
      .toUpperCase()
      .slice(0, max);
  }

  function crc16(texto) {
    let crc = 0xffff;
    for (let i = 0; i < texto.length; i++) {
      crc ^= texto.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  // Telefone vira +55DDDNUMERO, e-mail fica minúsculo; CPF/CNPJ ficam só com dígitos.
  function normalizarChave(chave) {
    const c = String(chave || '').trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return c.toLowerCase();
    const compacto = c.replace(/[\s()-]/g, '');
    if (/^\+55\d{10,11}$/.test(compacto)) return compacto;
    if (c.includes('@')) return c.toLowerCase();
    if (/^[\d.\/-]+$/.test(c)) return c.replace(/\D/g, '');
    return c;
  }

  /**
   * @param {{chave:string, nome:string, cidade:string, valor?:number, descricao?:string}} o
   */
  function gerarPix(o) {
    const chave = normalizarChave(o.chave);
    let conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave);
    const desc = limpar(o.descricao, 40);
    // O campo 26 tem no máximo 99 caracteres; a descrição só entra se couber.
    if (desc && conta.length + 4 + desc.length <= 99) conta += campo('02', desc);

    let codigo =
      campo('00', '01') +
      campo('26', conta) +
      campo('52', '0000') +
      campo('53', '986') +
      (o.valor > 0 ? campo('54', Number(o.valor).toFixed(2)) : '') +
      campo('58', 'BR') +
      campo('59', limpar(o.nome, 25) || 'RECEBEDOR') +
      campo('60', limpar(o.cidade, 15) || 'BRASIL') +
      campo('62', campo('05', '***')) +
      '6304';
    return codigo + crc16(codigo);
  }

  window.Pix = { gerarPix, crc16 };
})();
