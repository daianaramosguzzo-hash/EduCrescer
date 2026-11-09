/**
 * Rifa: registro dos números numa Planilha Google.
 * Cole este código em Extensões > Apps Script da sua planilha e implante como
 * "App da Web" (Executar como: Eu; Quem pode acessar: Qualquer pessoa).
 *
 * Colunas da aba "Rifa": Data | Número | Nome | Telefone | Status
 * Status: reservado (padrão) · pago · cancelado (libera o número de novo)
 */
const ABA = 'Rifa';
const NUMERO_INICIAL = 0;
const NUMERO_FINAL = 100;

function aba_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA);
  if (!sh) {
    sh = ss.insertSheet(ABA);
    sh.appendRow(['Data', 'Número', 'Nome', 'Telefone', 'Status']);
    sh.setFrozenRows(1);
    sh.getRange('A1:E1').setFontWeight('bold');
    const regra = SpreadsheetApp.newDataValidation()
      .requireValueInList(['reservado', 'pago', 'cancelado'], true)
      .build();
    sh.getRange('E2:E1000').setDataValidation(regra);
  }
  return sh;
}

function primeiroNome_(nome) {
  return String(nome || '').trim().split(/\s+/)[0].slice(0, 20);
}

// Só o primeiro nome e o status vão para o site; telefone nunca sai da planilha.
function ocupados_(sh) {
  const linhas = sh.getDataRange().getValues().slice(1);
  const mapa = {};
  linhas.forEach(function (l) {
    if (l[1] === '' || l[1] === null) return;
    const n = Number(l[1]);
    const status = String(l[4] || 'reservado').trim().toLowerCase();
    if (!Number.isInteger(n) || status === 'cancelado') return;
    const atual = mapa[n];
    if (atual && atual.status === 'pago') return;
    mapa[n] = { status: status === 'pago' ? 'pago' : 'reservado', nome: primeiroNome_(l[2]) };
  });
  return mapa;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Impede que um nome como "=FORMULA()" vire fórmula na planilha.
function texto_(s) {
  s = String(s || '').trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function doGet() {
  return json_({ ok: true, ocupados: ocupados_(aba_()) });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const nome = String(p.nome || '').trim().slice(0, 80);
    const telefone = String(p.telefone || '').replace(/\D/g, '').slice(0, 15);
    const numeros = (p.numeros || [])
      .map(Number)
      .filter(function (n, i, a) {
        return Number.isInteger(n) && n >= NUMERO_INICIAL && n <= NUMERO_FINAL && a.indexOf(n) === i;
      });

    if (nome.length < 2 || telefone.length < 10 || !numeros.length) {
      return json_({ ok: false, erro: 'Preencha nome, telefone com DDD e escolha ao menos um número.' });
    }

    const sh = aba_();
    const ocupados = ocupados_(sh);
    const conflito = numeros.filter(function (n) { return ocupados[n]; });
    if (conflito.length) {
      return json_({ ok: false, erro: 'Alguns números já foram escolhidos.', conflito: conflito, ocupados: ocupados });
    }

    const agora = new Date();
    const linhas = numeros.map(function (n) {
      return [agora, n, texto_(nome), "'" + telefone, 'reservado'];
    });
    sh.getRange(sh.getLastRow() + 1, 1, linhas.length, 5).setValues(linhas);
    SpreadsheetApp.flush();
    return json_({ ok: true, numeros: numeros, ocupados: ocupados_(sh) });
  } catch (err) {
    return json_({ ok: false, erro: 'Erro ao registrar: ' + err });
  } finally {
    lock.releaseLock();
  }
}
