// Aimorés dos Mortos — versão desktop para Windows (Electron)
const { app, BrowserWindow, protocol, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Os arquivos são servidos por app://game/ (módulos JavaScript funcionam e o progresso salvo
// fica sempre no mesmo lugar). A raiz é a do repositório, porque o jogo usa lib/three.module.min.js.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const ROOT = path.join(__dirname, '..', '..');
const START = 'app://game/aimores/index.html';

// pasta dos salvamentos sem acento no nome (%APPDATA%\AimoresDosMortos)
app.setPath('userData', path.join(app.getPath('appData'), 'AimoresDosMortos'));
// o nome do app entra no User-Agent; com "é" os cabeçalhos das requisições ficam inválidos
// e o CSS/JS do jogo não carregam. Deixa só caracteres ASCII.
app.userAgentFallback = app.userAgentFallback.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

// uma janela só: abrir o atalho de novo traz o jogo para a frente
const gotLock = app.requestSingleInstanceLock();

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#07060b',
    title: 'Aimorés dos Mortos',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadURL(START);
  // links externos abrem no navegador
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://game/')) { e.preventDefault(); shell.openExternal(url); } });
  // F11 ou Alt+Enter = tela cheia
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
  // "Exportar arquivo" do jogo: pergunta onde salvar
  win.webContents.session.on('will-download', (e, item) => {
    item.setSaveDialogOptions({ title: 'Exportar salvamento', defaultPath: path.join(app.getPath('documents'), item.getFilename()) });
  });
  // se o jogo travar, oferece recarregar em vez de ficar com a tela preta
  win.webContents.on('render-process-gone', async () => {
    const r = await dialog.showMessageBox(win, { type: 'error', title: 'Aimorés dos Mortos', message: 'O jogo parou de responder.', detail: 'O salvamento automático guarda o progresso a cada período do dia.', buttons: ['Recarregar', 'Fechar'] });
    if (r.response === 0) win.loadURL(START); else app.quit();
  });
  win.on('closed', () => { win = null; });
}

if (!gotLock) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(start);
}

function start() {
  Menu.setApplicationMenu(null);
  // lê os arquivos direto (funciona dentro do app.asar) e define o tipo de cada um,
  // sem depender do registro do Windows
  protocol.handle('app', async req => {
    try {
      const { pathname } = new URL(req.url);
      const file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
      if (!file.startsWith(ROOT)) return new Response('Não encontrado', { status: 404 });
      const data = await fs.promises.readFile(file);
      return new Response(data, { headers: { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' } });
    } catch (e) {
      return new Response('Não encontrado', { status: 404 });
    }
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}

app.on('window-all-closed', () => app.quit());
