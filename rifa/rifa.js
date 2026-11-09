(function () {
  const C = window.RIFA_CONFIG || {};
  const INICIO = Number.isInteger(C.numeroInicial) ? C.numeroInicial : 0;
  const FIM = Number.isInteger(C.numeroFinal) ? C.numeroFinal : 100;
  const TOTAL = FIM - INICIO + 1;
  const VALOR = Number(C.valorNumero) || 0;
  const MODO_LOCAL = !C.planilhaUrl;
  const CHAVE_LOCAL = 'rifa:' + (C.titulo || 'rifa');
  const CHAVE_ULTIMA = CHAVE_LOCAL + ':ultima';

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => String(n).padStart(2, '0');
  const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const lista = (nums) => nums.map(fmt).join(', ');

  let ocupados = {};
  const escolhidos = new Set();
  const botoes = new Map();

  // ---------- armazenamento ----------
  function lerStorage(chave, padrao) {
    try { return JSON.parse(localStorage.getItem(chave)) || padrao; } catch (e) { return padrao; }
  }
  function gravarStorage(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem armazenamento */ }
  }

  const api = {
    async listar() {
      if (MODO_LOCAL) return lerStorage(CHAVE_LOCAL, {});
      const r = await fetch(C.planilhaUrl, { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro || 'Falha ao carregar');
      return j.ocupados || {};
    },
    async reservar(dados) {
      if (MODO_LOCAL) {
        const atual = lerStorage(CHAVE_LOCAL, {});
        const conflito = dados.numeros.filter((n) => atual[n]);
        if (conflito.length) return { ok: false, erro: 'Alguns números já foram escolhidos.', conflito, ocupados: atual };
        const nome = dados.nome.split(/\s+/)[0];
        dados.numeros.forEach((n) => { atual[n] = { status: 'reservado', nome }; });
        gravarStorage(CHAVE_LOCAL, atual);
        return { ok: true, numeros: dados.numeros, ocupados: atual };
      }
      const r = await fetch(C.planilhaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita bloqueio de CORS no Apps Script
        body: JSON.stringify(dados),
      });
      return r.json();
    },
  };

  // ---------- textos da página ----------
  function preencherTextos() {
    document.title = C.titulo || 'Rifa';
    $('titulo').textContent = C.titulo || 'Rifa';
    $('premio').textContent = C.premio || '';
    $('descricao').textContent = C.descricao || '';
    $('resultado').textContent = C.resultado || '';
    $('faixa').textContent = fmt(INICIO) + ' a ' + fmt(FIM);
    $('preco').textContent = brl(VALOR);
    if (C.pix && C.pix.chave) {
      $('rodape-pix').textContent = 'Chave PIX: ' + C.pix.chave + (C.pix.nome ? ' · ' + C.pix.nome : '');
    }
    $('aviso-local').classList.toggle('hidden', !MODO_LOCAL);
  }

  // ---------- grade ----------
  function montarGrade() {
    const grade = $('grade');
    const frag = document.createDocumentFragment();
    for (let n = INICIO; n <= FIM; n++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'num';
      b.textContent = fmt(n);
      b.dataset.n = n;
      b.setAttribute('aria-pressed', 'false');
      botoes.set(n, b);
      frag.appendChild(b);
    }
    grade.appendChild(frag);
    grade.addEventListener('click', (e) => {
      const b = e.target.closest('.num');
      if (!b || b.disabled) return;
      const n = Number(b.dataset.n);
      escolhidos.has(n) ? escolhidos.delete(n) : escolhidos.add(n);
      atualizarTela();
    });
  }

  function atualizarTela() {
    let livres = 0;
    botoes.forEach((b, n) => {
      const o = ocupados[n];
      if (o) escolhidos.delete(n);
      b.disabled = !!o;
      b.classList.toggle('res', !!o && o.status !== 'pago');
      b.classList.toggle('pago', !!o && o.status === 'pago');
      b.setAttribute('aria-pressed', escolhidos.has(n) ? 'true' : 'false');
      b.title = o ? (o.status === 'pago' ? 'Pago' : 'Reservado') + (o.nome ? ' · ' + o.nome : '') : 'Livre';
      b.setAttribute('aria-label', fmt(n) + ', ' + b.title.toLowerCase());
      if (!o) livres++;
    });
    $('disponiveis').textContent = livres + ' de ' + TOTAL;
    $('barra').style.width = ((TOTAL - livres) / TOTAL) * 100 + '%';

    const qtd = escolhidos.size;
    $('carrinho').hidden = qtd === 0;
    $('carrinho-qtd').textContent = qtd + (qtd === 1 ? ' número' : ' números');
    $('carrinho-total').textContent = brl(qtd * VALOR);
  }

  async function carregar(silencioso) {
    if (!silencioso) $('status').textContent = 'Carregando…';
    try {
      ocupados = await api.listar();
      $('status').textContent = '';
    } catch (e) {
      $('status').textContent = 'Não foi possível carregar os números. Verifique a internet e toque em Atualizar.';
    }
    atualizarTela();
  }

  // ---------- reserva ----------
  const janela = $('janela');

  function chips(el, nums) {
    el.replaceChildren(...nums.map((n) => {
      const s = document.createElement('span');
      s.className = 'chip';
      s.textContent = fmt(n);
      return s;
    }));
  }

  function abrirForm() {
    const nums = [...escolhidos].sort((a, b) => a - b);
    chips($('resumo-nums'), nums);
    $('resumo-total').textContent = brl(nums.length * VALOR);
    $('erro').textContent = '';
    $('form').classList.remove('hidden');
    $('pagar').classList.add('hidden');
    const salvo = lerStorage(CHAVE_ULTIMA, null);
    if (salvo && !$('nome').value) { $('nome').value = salvo.nome || ''; $('telefone').value = salvo.telefone || ''; }
    janela.showModal();
    if (!$('nome').value) $('nome').focus();
  }

  function mascaraTelefone(v) {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  async function enviar(e) {
    e.preventDefault();
    const nome = $('nome').value.trim().replace(/\s+/g, ' ');
    const telefone = $('telefone').value.replace(/\D/g, '');
    const numeros = [...escolhidos].sort((a, b) => a - b);
    if (nome.length < 2) return mostrarErro('Digite seu nome.', 'nome');
    if (telefone.length < 10) return mostrarErro('Digite o WhatsApp com DDD.', 'telefone');
    if (!numeros.length) return janela.close();

    const btn = $('reservar');
    btn.disabled = true;
    btn.textContent = 'Reservando…';
    $('erro').textContent = '';
    try {
      const r = await api.reservar({ nome, telefone, numeros });
      if (r.ocupados) ocupados = r.ocupados;
      if (!r.ok) {
        if (r.conflito && r.conflito.length) {
          r.conflito.forEach((n) => escolhidos.delete(n));
          atualizarTela();
          const msg = (r.conflito.length === 1 ? 'O número ' : 'Os números ') + lista(r.conflito) +
            (r.conflito.length === 1 ? ' acabou de ser escolhido' : ' acabaram de ser escolhidos') + ' por outra pessoa.';
          if (!escolhidos.size) { janela.close(); $('status').textContent = msg + ' Escolha outros.'; return; }
          chips($('resumo-nums'), [...escolhidos].sort((a, b) => a - b));
          $('resumo-total').textContent = brl(escolhidos.size * VALOR);
          return mostrarErro(msg + ' Confira e tente de novo.');
        }
        return mostrarErro(r.erro || 'Não foi possível reservar.');
      }
      const reserva = { nome, telefone, numeros: r.numeros || numeros };
      gravarStorage(CHAVE_ULTIMA, reserva);
      escolhidos.clear();
      atualizarTela();
      mostrarUltima();
      mostrarPix(reserva);
    } catch (err) {
      mostrarErro('Sem conexão com a planilha. Tente de novo.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Reservar e ir para o PIX';
    }
  }

  function mostrarErro(msg, campo) {
    $('erro').textContent = msg;
    if (campo) $(campo).focus();
  }

  // ---------- PIX ----------
  function mostrarPix(reserva) {
    const nums = reserva.numeros;
    const total = nums.length * VALOR;
    $('pg-nome').textContent = reserva.nome;
    chips($('pg-nums'), nums);
    $('pg-valor').textContent = brl(total);

    const pix = C.pix || {};
    const temChave = !!pix.chave;
    $('sem-chave').classList.toggle('hidden', temChave);
    $('copiar').classList.toggle('hidden', !temChave);
    $('pg-codigo').closest('label').classList.toggle('hidden', !temChave);
    $('qr').replaceChildren();
    if (temChave) {
      const codigo = window.Pix.gerarPix({
        chave: pix.chave, nome: pix.nome, cidade: pix.cidade, valor: total,
        descricao: 'Rifa ' + nums.map(fmt).join(' '),
      });
      $('pg-codigo').value = codigo;
      const qr = window.qrcode(0, 'M');
      qr.addData(codigo);
      qr.make();
      $('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: 'QR Code do PIX' });
    }

    if (C.whatsapp) {
      const msg = 'Olá! Reservei ' + (nums.length === 1 ? 'o número ' : 'os números ') + lista(nums) +
        ' na ' + (C.titulo || 'rifa') + ', em nome de ' + reserva.nome + '. Segue o comprovante do PIX de ' + brl(total) + '.';
      $('whats').href = 'https://wa.me/' + String(C.whatsapp).replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
      $('whats').classList.remove('hidden');
    }

    $('form').classList.add('hidden');
    $('pagar').classList.remove('hidden');
    $('copiar').textContent = 'Copiar código PIX';
    if (!janela.open) janela.showModal();
  }

  async function copiar() {
    const area = $('pg-codigo');
    try {
      await navigator.clipboard.writeText(area.value);
    } catch (e) {
      area.select();
      document.execCommand('copy');
    }
    $('copiar').textContent = 'Copiado! Cole no app do banco';
  }

  function mostrarUltima() {
    const r = lerStorage(CHAVE_ULTIMA, null);
    const tem = r && Array.isArray(r.numeros) && r.numeros.length;
    $('ultima').classList.toggle('hidden', !tem);
    if (tem) $('ultima-nums').textContent = lista(r.numeros);
  }

  // ---------- início ----------
  preencherTextos();
  montarGrade();
  mostrarUltima();
  carregar();

  $('continuar').addEventListener('click', abrirForm);
  $('limpar').addEventListener('click', () => { escolhidos.clear(); atualizarTela(); });
  $('atualizar').addEventListener('click', () => carregar());
  $('form').addEventListener('submit', enviar);
  $('fechar').addEventListener('click', () => janela.close());
  janela.addEventListener('click', (e) => {
    if (e.target !== janela) return;
    const r = janela.getBoundingClientRect();
    const fora = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (fora) janela.close();
  });
  $('copiar').addEventListener('click', copiar);
  $('telefone').addEventListener('input', (e) => { e.target.value = mascaraTelefone(e.target.value); });
  $('ver-pix').addEventListener('click', () => {
    const r = lerStorage(CHAVE_ULTIMA, null);
    if (r) mostrarPix(r);
  });

  // Atualiza sozinho a cada 30 s e ao voltar para a aba.
  setInterval(() => { if (!document.hidden && !janela.open) carregar(true); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) carregar(true); });
})();
