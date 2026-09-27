// Criaturas Imaginárias — versão desktop (Electron)
const { app, BrowserWindow, protocol, net, Menu, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// Os arquivos do jogo são servidos pelo endereço app://game/, o que permite
// usar módulos JavaScript e guarda o progresso salvo sempre no mesmo lugar.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const ROOT = path.join(__dirname, '..');

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
  protocol.handle('app', req => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
    if (!file.startsWith(ROOT)) return new Response('Não encontrado', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit());
