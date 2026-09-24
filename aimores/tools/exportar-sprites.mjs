// Exporta as sprite sheets organizadas (PNG + JSON) e os retratos pintados dos protagonistas
// para assets/sprites/. Uso (na raiz do repositório, com um servidor HTTP rodando):
//   python3 -m http.server 8123 &
//   node aimores/tools/exportar-sprites.mjs [http://localhost:8123] [escala]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const base = process.argv[2] || 'http://localhost:8123';
const sc = +(process.argv[3] || 0.75);
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sprites');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/aimores/tools/galeria-teste.html?ids=arthur`);
const result = await page.evaluate(async (sc) => {
  const { buildSheet } = await import('../js/sprites/sheet.js');
  const { paintPortrait } = await import('../js/sprites/painter.js');
  const { LOOKS } = await import('../js/sprites/looks.js');
  const files = {};
  for (const id of ['arthur', 'carol', 'daiana', 'pablicio']) {
    const { canvas, meta } = buildSheet(id, { sc });
    files[`${id}-spritesheet.png`] = canvas.toDataURL('image/png');
    files[`${id}-spritesheet.json`] = JSON.stringify(meta, null, 2);
    const c = document.createElement('canvas'); c.width = c.height = 256;
    paintPortrait(c, LOOKS[id]);
    files[`${id}-retrato-2d5.png`] = c.toDataURL('image/png');
  }
  return files;
}, sc);
for (const [name, data] of Object.entries(result)) {
  const file = path.join(out, name);
  if (data.startsWith('data:image/png;base64,')) fs.writeFileSync(file, Buffer.from(data.slice(22), 'base64'));
  else fs.writeFileSync(file, data);
  console.log('✔', path.relative(process.cwd(), file));
}
await browser.close();
