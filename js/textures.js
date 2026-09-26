// Texturas procedurais (geradas em canvas) para materiais estilizados:
// tecidos, cabelo, pelos, escamas, penas, pedra e detalhes do chão.
// Todas repetem sem emendas e ficam claras (média perto do branco) para
// serem tingidas pela cor do material, preservando as cores originais.
import * as THREE from '../lib/three.module.min.js';

let ANISO = 4;
export function setTexAnisotropy(n) { ANISO = n; }

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// desenha um elemento e suas cópias nas bordas, para a textura repetir sem emenda
function wrap(w, h, x, y, pad, fn) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
    const X = x + dx, Y = y + dy;
    if (X < -pad || X > w + pad || Y < -pad || Y > h + pad) continue;
    fn(X, Y);
  }
}

const cache = new Map();
function make(name, size, draw, { color = true, repeat = 1 } = {}) {
  if (cache.has(name)) return cache.get(name);
  const c = canvas(size, size);
  const g = c.getContext('2d');
  draw(g, size, rng(name.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7)));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = ANISO;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  cache.set(name, t);
  return t;
}

function noise(g, s, r, n, alpha, size = 2) {
  for (let i = 0; i < n; i++) {
    const v = r() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${r() * alpha})`;
    g.fillRect(r() * s, r() * s, size, size);
  }
}

// ------------------------------------------------ tecidos e acessórios
export const MAT_TEX = {
  // lona/algodão grosso (jaqueta): trama, dobras suaves e costuras
  canvas: () => make('canvas', 256, (g, s, r) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 3) { g.fillStyle = 'rgba(0,0,0,0.035)'; g.fillRect(0, y, s, 1); }
    for (let x = 0; x < s; x += 3) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, 0, 1, s); }
    for (let i = 0; i < 14; i++) {
      const x = r() * s, y = r() * s, len = 40 + r() * 80, a = r() * Math.PI;
      wrap(s, s, x, y, 120, (X, Y) => {
        const gr = g.createLinearGradient(X, Y, X + Math.cos(a) * len, Y + Math.sin(a) * len);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.strokeStyle = gr; g.lineWidth = 6 + r() * 6;
        g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * len, Y + Math.sin(a) * len); g.stroke();
      });
    }
    g.setLineDash([5, 4]); g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 1.5;
    for (const y of [s * 0.25, s * 0.75]) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); }
    noise(g, s, r, 1500, 0.05);
  }),
  // pelúcia do forro (sherpa)
  fleece: () => make('fleece', 128, (g, s, r) => {
    g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      const x = r() * s, y = r() * s, rad = 2 + r() * 4;
      wrap(s, s, x, y, 8, (X, Y) => {
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.08)';
        g.beginPath(); g.arc(X, Y, rad, 0, 7); g.fill();
      });
    }
  }),
  // malha de algodão (camiseta)
  cotton: () => make('cotton', 128, (g, s, r) => {
    g.fillStyle = '#f6f6f6'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) for (let x = (y / 2) % 2; x < s; x += 2) { g.fillStyle = 'rgba(0,0,0,0.03)'; g.fillRect(x, y, 1, 1); }
    noise(g, s, r, 600, 0.05);
  }),
  // sarja/brim (bermudas e calças)
  twill: () => make('twill', 128, (g, s, r) => {
    g.fillStyle = '#eeeeee'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 1.2;
    for (let i = -s; i < s * 2; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); }
    noise(g, s, r, 800, 0.06);
  }),
  // tricô (meias)
  knit: () => make('knit', 64, (g, s) => {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 8) for (let x = 0; x < s; x += 8) {
      g.strokeStyle = 'rgba(0,0,0,0.1)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 7); g.lineTo(x + 8, y); g.stroke();
    }
  }),
  // couro / tênis
  leather: () => make('leather', 128, (g, s, r) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const x = r() * s, y = r() * s;
      wrap(s, s, x, y, 10, (X, Y) => { g.strokeStyle = 'rgba(0,0,0,0.06)'; g.beginPath(); g.arc(X, Y, 3 + r() * 5, 0, Math.PI * (0.5 + r())); g.stroke(); });
    }
    noise(g, s, r, 700, 0.05);
  }),
  // fios de cabelo em mechas
  hair: () => make('hair', 128, (g, s, r) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      const x = r() * s, w = 1 + r() * 3;
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.14)';
      g.fillRect(x, 0, w, s);
    }
    const gr = g.createLinearGradient(0, 0, 0, s);
    gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.12)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }),
  // pele com leve variação (nada de poros realistas)
  skin: () => make('skin', 64, (g, s, r) => {
    g.fillStyle = '#f8f8f8'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 30; i++) {
      const x = r() * s, y = r() * s;
      wrap(s, s, x, y, 12, (X, Y) => {
        const gr = g.createRadialGradient(X, Y, 0, X, Y, 10);
        gr.addColorStop(0, `rgba(${r() < 0.5 ? '255,210,200' : '240,240,240'},0.18)`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(X - 10, Y - 10, 20, 20);
      });
    }
  }),
  // metal levemente escovado e gasto
  metal: () => make('metal', 128, (g, s, r) => {
    g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.08})`; g.fillRect(0, y, s, 1); }
    for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(80,60,40,0.1)'; g.beginPath(); g.arc(r() * s, r() * s, 3 + r() * 8, 0, 7); g.fill(); }
  }),

  // ------------------------------------------------ peles de criaturas
  fur: () => make('fur', 128, (g, s, r) => {
    g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const x = r() * s, y = r() * s, len = 3 + r() * 6, a = Math.PI / 2 + (r() - 0.5) * 0.7;
      wrap(s, s, x, y, 10, (X, Y) => {
        g.strokeStyle = r() < 0.55 ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.4)';
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * len, Y + Math.sin(a) * len); g.stroke();
      });
    }
  }),
  scales: () => make('scales', 128, (g, s) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, s, s);
    const R = 10;
    for (let row = 0; row * R * 0.8 < s + R; row++) for (let col = -1; col * R * 2 < s + R; col++) {
      const x = col * R * 2 + (row % 2 ? R : 0), y = row * R * 0.8 * 2;
      wrap(s, s, x, y, R * 2, (X, Y) => {
        const gr = g.createRadialGradient(X, Y - R * 0.3, 1, X, Y, R);
        gr.addColorStop(0, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.8, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.18)');
        g.fillStyle = gr; g.beginPath(); g.arc(X, Y, R, 0, Math.PI); g.fill();
      });
    }
  }),
  feathers: () => make('feathers', 128, (g, s, r) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, s, s);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const x = col * 16 + (row % 2 ? 8 : 0), y = row * 16;
      wrap(s, s, x, y, 16, (X, Y) => {
        g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(X, Y + 6, 7, 10, 0, 0, Math.PI); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.beginPath(); g.moveTo(X, Y); g.lineTo(X, Y + 14); g.stroke();
      });
    }
    noise(g, s, r, 400, 0.05);
  }),
  smooth: () => make('smooth', 128, (g, s, r) => {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      const x = r() * s, y = r() * s, rad = 6 + r() * 18;
      wrap(s, s, x, y, rad, (X, Y) => {
        const gr = g.createRadialGradient(X, Y, 0, X, Y, rad);
        gr.addColorStop(0, r() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
      });
    }
  }),
  rock: () => make('rock', 256, (g, s, r) => {
    g.fillStyle = '#ececec'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      const x = r() * s, y = r() * s, rad = 10 + r() * 34;
      wrap(s, s, x, y, rad, (X, Y) => {
        const gr = g.createRadialGradient(X, Y, 0, X, Y, rad);
        gr.addColorStop(0, `rgba(${r() < 0.5 ? '0,0,0,0.1' : '255,255,255,0.25'})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
      });
    }
    // rachaduras
    for (let i = 0; i < 9; i++) {
      let x = r() * s, y = r() * s, a = r() * 6.28;
      g.strokeStyle = 'rgba(30,20,10,0.35)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { a += (r() - 0.5) * 1.2; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); }
      g.stroke();
    }
    noise(g, s, r, 3000, 0.08);
  }),
  chitin: () => make('chitin', 128, (g, s, r) => {
    g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, s, s);
    const gr = g.createLinearGradient(0, 0, s, s);
    gr.addColorStop(0, 'rgba(255,255,255,0.3)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.3)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    noise(g, s, r, 500, 0.06);
  }),
};

// ------------------------------------------------ detalhes do chão (dados lineares, média 0.5)
// Estes mapas multiplicam a cor pintada do terreno (valor 0.5 = neutro),
// adicionando detalhe fino que continua nítido de perto.
function detail(name, draw) {
  return make(name, 256, (g, s, r) => {
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, s, s);
    draw(g, s, r);
  }, { color: false });
}
export const DETAIL_TEX = {
  grass: () => detail('d_grass', (g, s, r) => {
    for (let i = 0; i < 70; i++) {
      const x = r() * s, y = r() * s, rad = 8 + r() * 26;
      wrap(s, s, x, y, rad, (X, Y) => {
        const gr = g.createRadialGradient(X, Y, 0, X, Y, rad);
        gr.addColorStop(0, `rgba(${r() < 0.5 ? '100,100,100' : '160,160,160'},0.5)`); gr.addColorStop(1, 'rgba(128,128,128,0)');
        g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
      });
    }
    for (let i = 0; i < 1400; i++) {
      const x = r() * s, y = r() * s, len = 3 + r() * 7, a = -Math.PI / 2 + (r() - 0.5) * 1.1;
      wrap(s, s, x, y, 10, (X, Y) => {
        const v = r() < 0.55 ? 88 : 178;
        g.strokeStyle = `rgba(${v},${v},${v},0.8)`; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * len, Y + Math.sin(a) * len); g.stroke();
      });
    }
    // trevos
    for (let i = 0; i < 40; i++) {
      const x = r() * s, y = r() * s;
      wrap(s, s, x, y, 6, (X, Y) => {
        g.fillStyle = 'rgba(160,160,160,0.8)';
        for (let k = 0; k < 3; k++) { const a = k * 2.1; g.beginPath(); g.arc(X + Math.cos(a) * 2.5, Y + Math.sin(a) * 2.5, 2.2, 0, 7); g.fill(); }
      });
    }
  }),
  dirt: () => detail('d_dirt', (g, s, r) => {
    for (let i = 0; i < 50; i++) {
      const x = r() * s, y = r() * s, rad = 10 + r() * 30;
      wrap(s, s, x, y, rad, (X, Y) => {
        const gr = g.createRadialGradient(X, Y, 0, X, Y, rad);
        gr.addColorStop(0, `rgba(${r() < 0.5 ? '105,105,105' : '152,152,152'},0.55)`); gr.addColorStop(1, 'rgba(128,128,128,0)');
        g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
      });
    }
    // pedrinhas com sombra e brilho
    for (let i = 0; i < 90; i++) {
      const x = r() * s, y = r() * s, w = 2 + r() * 4.5;
      wrap(s, s, x, y, 8, (X, Y) => {
        g.fillStyle = 'rgba(70,70,70,0.7)'; g.beginPath(); g.ellipse(X + 1, Y + 1.5, w, w * 0.7, 0, 0, 7); g.fill();
        g.fillStyle = 'rgba(190,190,190,0.9)'; g.beginPath(); g.ellipse(X, Y, w, w * 0.7, 0, 0, 7); g.fill();
        g.fillStyle = 'rgba(230,230,230,0.8)'; g.beginPath(); g.ellipse(X - w * 0.3, Y - w * 0.25, w * 0.35, w * 0.22, 0, 0, 7); g.fill();
      });
    }
    // raízes e rachaduras
    for (let i = 0; i < 7; i++) {
      let x = r() * s, y = r() * s, a = r() * 6.28;
      g.strokeStyle = 'rgba(80,80,80,0.7)'; g.lineWidth = 2 + r() * 1.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { a += (r() - 0.5) * 0.8; x += Math.cos(a) * 7; y += Math.sin(a) * 7; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 2500; i++) { const v = r() < 0.5 ? 100 : 160; g.fillStyle = `rgba(${v},${v},${v},0.5)`; g.fillRect(r() * s, r() * s, 1.5, 1.5); }
  }),
  sand: () => detail('d_sand', (g, s, r) => {
    for (let y = 0; y < s; y += 14) {
      g.strokeStyle = 'rgba(150,150,150,0.5)'; g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= s; x += 8) g.lineTo(x, y + Math.sin((x / s) * Math.PI * 4 + y) * 3);
      g.stroke();
    }
    for (let i = 0; i < 3000; i++) { const v = r() < 0.5 ? 108 : 158; g.fillStyle = `rgba(${v},${v},${v},0.6)`; g.fillRect(r() * s, r() * s, 1.4, 1.4); }
    for (let i = 0; i < 14; i++) {
      const x = r() * s, y = r() * s;
      wrap(s, s, x, y, 6, (X, Y) => { g.fillStyle = 'rgba(200,200,200,0.9)'; g.beginPath(); g.ellipse(X, Y, 3, 2, r() * 3, 0, 7); g.fill(); });
    }
  }),
  // chão de floresta: folhas secas e gravetos
  leaves: () => detail('d_leaves', (g, s, r) => {
    for (let i = 0; i < 160; i++) {
      const x = r() * s, y = r() * s, a = r() * 6.28, w = 4 + r() * 4;
      wrap(s, s, x, y, 10, (X, Y) => {
        g.save(); g.translate(X, Y); g.rotate(a);
        const v = r() < 0.5 ? 92 : 170;
        g.fillStyle = `rgba(${v},${v},${v},0.8)`;
        g.beginPath(); g.ellipse(0, 0, w, w * 0.45, 0, 0, 7); g.fill();
        g.strokeStyle = 'rgba(70,70,70,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-w, 0); g.lineTo(w, 0); g.stroke();
        g.restore();
      });
    }
    for (let i = 0; i < 18; i++) {
      const x = r() * s, y = r() * s, a = r() * 6.28, len = 10 + r() * 16;
      g.strokeStyle = 'rgba(75,75,75,0.8)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
  }),
  // variação de cor em grande escala (evita repetição visível)
  macro: () => make('d_macro', 128, (g, s, r) => {
    g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) {
      const x = r() * s, y = r() * s, rad = 10 + r() * 30;
      wrap(s, s, x, y, rad, (X, Y) => {
        const gr = g.createRadialGradient(X, Y, 0, X, Y, rad);
        const v = r() < 0.5 ? 90 : 170;
        gr.addColorStop(0, `rgba(${v},${v},${v},0.55)`); gr.addColorStop(1, 'rgba(128,128,128,0)');
        g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
      });
    }
  }, { color: false }),
};
