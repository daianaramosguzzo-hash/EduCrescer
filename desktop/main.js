// Criaturas Imaginárias — versão desktop (Electron)
const { app, BrowserWindow, protocol, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Os arquivos do jogo são servidos pelo endereço app://game/, o que permite
// usar módulos JavaScript e guarda o progresso salvo sempre no mesmo lugar.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

// O Electron põe o nome do app ("Criaturas Imaginárias") no User-Agent de cada
// pedido de arquivo; cabeçalho com acento é rejeitado e o jogo abria sem CSS nem
// scripts. O User-Agent passa a usar só caracteres sem acento.
app.userAgentFallback = app.userAgentFallback.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '');

// O jogo mudou de nome (antes "Crescemon Brasa 3D"): a pasta de dados continua
// a mesma para não perder o progresso salvo de quem já jogava.
app.setPath('userData', path.join(app.getPath('appData'), 'Crescemon Brasa 3D'));

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#1a1420',
    title: 'Criaturas Imaginárias',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.loadURL('app://game/index.html');
  // links externos abrem no navegador
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  // F11 = tela cheia
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // Lê o arquivo direto (funciona dentro do app.asar). Antes usava net.fetch com
  // uma URL file://, que falha quando a pasta de instalação tem acento
  // ("Criaturas Imaginárias") e deixava o jogo sem CSS nem scripts.
  protocol.handle('app', async req => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
    if (!file.startsWith(ROOT)) return new Response('Não encontrado', { status: 404 });
    try {
      const data = await fs.promises.readFile(file);
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      return new Response(data, { headers: { 'content-type': type } });
    } catch (e) {
      return new Response('Não encontrado', { status: 404 });
    }
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit());
