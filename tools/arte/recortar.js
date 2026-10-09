// Recorta uma folha de ilustrações em grade (ex.: 3 colunas x 2 linhas) em
// arquivos .webp separados, usando o Chromium do Playwright.
// Uso: node tools/arte/recortar.js <folha.jpg> <colunas> <linhas> <pasta> <nome1,nome2,...> [margem%] [transparente]
// Ex.: node tools/arte/recortar.js lideres.jpg 3 2 assets/portraits basalto,marina,jandira,tiao,ceci,luar 2
//      node tools/arte/recortar.js insignias.jpg 3 2 assets/badges rocha,mare,chama,raio,folha,lua 2 transparente
// "transparente" apaga o fundo branco que encosta nas bordas de cada recorte.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const [src, cols, rows, outDir, names, marginPct = '4', alpha = ''] = process.argv.slice(2);
  const list = names.split(',');
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  const data = 'data:image/jpeg;base64,' + fs.readFileSync(src).toString('base64');
  const out = await p.evaluate(async ([data, cols, rows, n, m, key]) => {
    const im = new Image(); im.src = data; await im.decode();
    const cw = im.width / cols, ch = im.height / rows, res = [];
    for (let i = 0; i < n; i++) {
      const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
      // recorte quadrado no centro da célula, tirando a margem (bordas da grade)
      const side = Math.min(cw, ch) * (1 - 2 * m / 100);
      const sx = cx + (cw - side) / 2, sy = cy + (ch - side) / 2;
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      g.drawImage(im, sx, sy, side, side, 0, 0, 256, 256);
      if (key) {
        // inundação a partir das bordas: pixels quase brancos ligados à borda viram transparentes
        const d = g.getImageData(0, 0, 256, 256), a = d.data, seen = new Uint8Array(256 * 256), st = [];
        const white = j => a[j * 4] > 228 && a[j * 4 + 1] > 228 && a[j * 4 + 2] > 228;
        for (let k = 0; k < 256; k++) st.push(k, 255 * 256 + k, k * 256, k * 256 + 255);
        while (st.length) { const j = st.pop(); if (seen[j] || !white(j)) continue; seen[j] = 1; a[j * 4 + 3] = 0; const x = j % 256, y = (j / 256) | 0;
          if (x > 0) st.push(j - 1); if (x < 255) st.push(j + 1); if (y > 0) st.push(j - 256); if (y < 255) st.push(j + 256); }
        // borda suave: pixels claros vizinhos do fundo ficam semitransparentes
        for (let j = 0; j < 256 * 256; j++) if (!seen[j] && a[j * 4 + 3] && (seen[j - 1] || seen[j + 1] || seen[j - 256] || seen[j + 256])) { const l = (a[j * 4] + a[j * 4 + 1] + a[j * 4 + 2]) / 3; if (l > 200) a[j * 4 + 3] = 140; }
        g.putImageData(d, 0, 0);
      }
      res.push(c.toDataURL('image/webp', 0.88));
    }
    return res;
  }, [data, +cols, +rows, list.length, +marginPct, alpha === 'transparente']);
  out.forEach((d, i) => fs.writeFileSync(path.join(outDir, list[i] + '.webp'), Buffer.from(d.split(',')[1], 'base64')));
  console.log('ok:', list.map(n => path.join(outDir, n + '.webp')).join(' '));
  await b.close();
})();
