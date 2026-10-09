// Recorta uma folha de ilustrações em grade (ex.: 3 colunas x 2 linhas) em
// arquivos .webp separados, usando o Chromium do Playwright.
// Uso: node tools/arte/recortar.js <folha.jpg> <colunas> <linhas> <pasta> <nome1,nome2,...> [margem%]
// Ex.: node tools/arte/recortar.js lideres.jpg 3 2 assets/portraits basalto,marina,jandira,tiao,ceci,luar 4
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const [src, cols, rows, outDir, names, marginPct = '4'] = process.argv.slice(2);
  const list = names.split(',');
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  const data = 'data:image/jpeg;base64,' + fs.readFileSync(src).toString('base64');
  const out = await p.evaluate(async ([data, cols, rows, n, m]) => {
    const im = new Image(); im.src = data; await im.decode();
    const cw = im.width / cols, ch = im.height / rows, res = [];
    for (let i = 0; i < n; i++) {
      const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
      // recorte quadrado no centro da célula, tirando a margem (bordas da grade)
      const side = Math.min(cw, ch) * (1 - 2 * m / 100);
      const sx = cx + (cw - side) / 2, sy = cy + (ch - side) / 2;
      const c = document.createElement('canvas'); c.width = c.height = 256;
      c.getContext('2d').drawImage(im, sx, sy, side, side, 0, 0, 256, 256);
      res.push(c.toDataURL('image/webp', 0.88));
    }
    return res;
  }, [data, +cols, +rows, list.length, +marginPct]);
  out.forEach((d, i) => fs.writeFileSync(path.join(outDir, list[i] + '.webp'), Buffer.from(d.split(',')[1], 'base64')));
  console.log('ok:', list.map(n => path.join(outDir, n + '.webp')).join(' '));
  await b.close();
})();
