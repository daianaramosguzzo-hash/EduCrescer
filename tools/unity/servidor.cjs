// Servidor local para o jogo e para a exportação de modelos da versão Unity.
// Uso (na pasta do projeto): node tools/unity/servidor.cjs . 8000
// Depois abra http://localhost:8000 (jogo) ou http://localhost:8000/tools/unity/exportar-modelos.html
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const port = Number(process.argv[3] || 8000);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.hdr': 'application/octet-stream', '.ktx2': 'image/ktx2',
};

// PUT /salvar/<caminho>: grava arquivos exportados dentro de CriaturasUnity/Assets/StreamingAssets
const saveRoot = path.join(root, 'CriaturasUnity', 'Assets', 'StreamingAssets');

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (req.method === 'PUT' && p.startsWith('/salvar/')) {
    const dest = path.join(saveRoot, p.slice('/salvar/'.length));
    if (!dest.startsWith(saveRoot)) { res.writeHead(403); return res.end(); }
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.concat(chunks));
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  let file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (e, data) => {
      if (e) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));
