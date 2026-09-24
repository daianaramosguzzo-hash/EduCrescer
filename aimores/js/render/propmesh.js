// Modelos 3D procedurais (caixas, cilindros e bolhas) de cada objeto do mapa.
// Cada função desenha o objeto centrado na origem, virado para +z, no tamanho do catálogo.
import { PROPS } from '../world/tiles.js';

const WOOD = '#9a6a3c', WOOD_D = '#7a4e2a', WOOD_L = '#c09060';
const METAL = '#9aa2a8', METAL_D = '#5a6268', WHITE = '#f2f0ea', BLACK = '#2a2a2e';
const GLASS = '#34495e';

export const PROP_H = {
  guarda_roupa: 2.0, estante: 2.0, geladeira: 1.85, armario_escola: 1.9, prateleira: 1.9, gondola: 1.7,
  carro: 1.4, carro_pol: 1.6, opala: 1.35, onibus: 2.8, caminhao: 2.8, locomotiva: 3.2, vagao: 3.0, sucata: 1.2,
  arvore: 3.4, ipe: 3.4, ipe_rosa: 3.3, palmeira: 4.2, poste: 5.2, antena: 16, coreto: 3.4, monumento: 3.2,
  banca: 2.2, orelhao: 2.1, quiosque: 2.6, tanque_lab: 2.2, cacamba: 1.2, caixa_dagua: 2.2, sino: 1.2,
};
export function propHeight(type) { return PROP_H[type] ?? 0.9; }

function rnd(seed) { let s = (seed * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

export function buildProp(g, p) {
  const def = PROPS[p.type];
  const [sw, sd] = def.size;
  const R = rnd(p.id + 11);
  const f = B[p.type];
  if (!f) { g.box(0, 0, 0, sw * 0.8, 0.8, sd * 0.8, '#ff00ff'); return; }
  f(g, sw, sd, R, p);
}

const car = (g, w, d, R, p, style = 'carro') => {
  const c = p.cor || '#d8413a';
  const crashed = p.batido;
  if (crashed) g.rotateY((R() - 0.5) * 0.35);
  const bw = w * 0.82, bd = d * 0.92;
  const wheel = (x, z) => { g.push(); g.translate(x, 0.26, z); g.rotateZ(Math.PI / 2); g.cyl(0, -0.12, 0, 0.26, 0.24, 8, '#1e1e22'); g.pop(); };
  if (style !== 'sucata') for (const [x, z] of [[-bw / 2, bd * 0.3], [bw / 2, bd * 0.3], [-bw / 2, -bd * 0.3], [bw / 2, -bd * 0.3]]) wheel(x, z);
  else { g.box(-bw / 3, 0, bd * 0.3, 0.3, 0.3, 0.3, '#8a8a88'); g.box(bw / 3, 0, -bd * 0.3, 0.3, 0.3, 0.3, '#8a8a88'); }
  const y0 = style === 'sucata' ? 0.25 : 0.22;
  g.box(0, y0, 0, bw, 0.55, bd, { side: c, top: c });
  const cabD = style === 'opala' ? bd * 0.45 : bd * 0.52;
  const win = style === 'sucata' ? '#2a2420' : GLASS;
  g.box(0, y0 + 0.55, -bd * 0.04, bw * 0.9, 0.48, cabD, { top: c, px: win, nx: win, pz: win, nz: win });
  if (style !== 'sucata') {
    g.box(-bw * 0.32, y0 + 0.25, bd / 2 + 0.01, 0.28, 0.14, 0.04, '#fff6c8', false);
    g.box(bw * 0.32, y0 + 0.25, bd / 2 + 0.01, 0.28, 0.14, 0.04, '#fff6c8', false);
    g.box(-bw * 0.32, y0 + 0.28, -bd / 2 - 0.01, 0.26, 0.12, 0.04, '#d81e1e', false);
    g.box(bw * 0.32, y0 + 0.28, -bd / 2 - 0.01, 0.26, 0.12, 0.04, '#d81e1e', false);
  } else {
    g.box(0.2, y0 + 0.55, 0.6, 0.3, 0.1, 0.4, '#6a3a1e', false);
  }
  if (style === 'viatura') {
    g.box(0, y0 + 0.55, -bd * 0.2, bw * 0.95, 0.2, 0.5, { side: '#1a1a22' });
    g.box(-0.25, y0 + 1.03, -bd * 0.04, 0.4, 0.12, 0.22, '#e83a3a'); g.box(0.25, y0 + 1.03, -bd * 0.04, 0.4, 0.12, 0.22, '#3a6ae8');
  }
  if (crashed) g.box(0, y0 + 0.3, bd / 2 - 0.2, bw * 0.7, 0.3, 0.3, '#3a3a3e', false);
};
const tree = (g, R, leaf, trunkH = 1.5, size = 1) => {
  g.cyl(0, 0, 0, 0.16, trunkH + 0.3, 6, '#6a4a2e', 0.11);
  const n = 3 + Math.floor(R() * 2);
  for (let i = 0; i < n; i++) {
    const a = R() * 6.28, d = i === 0 ? 0 : 0.45 * size;
    const r = (0.75 + R() * 0.35) * size;
    g.blob(Math.cos(a) * d, trunkH + 0.55 + R() * 0.5 * size, Math.sin(a) * d, r, r * 0.82, r, leaf[i % leaf.length], 1, true, 0.25, Math.floor(R() * 1000) + 1);
  }
};

const B = {
  // ---------------- casa
  sofa: (g, w, d, R) => {
    const c = ['#b8412e', '#3a6aa8', '#6a8a3a', '#8a5a9a'][Math.floor(R() * 4)];
    g.box(0, 0, 0.05, w * 0.92, 0.42, d * 0.8, c);
    g.box(0, 0.42, -d * 0.3, w * 0.92, 0.42, d * 0.22, c);
    g.box(-w * 0.44, 0.42, 0.05, w * 0.08, 0.2, d * 0.8, c); g.box(w * 0.44, 0.42, 0.05, w * 0.08, 0.2, d * 0.8, c);
  },
  poltrona: (g, w, d, R) => { const c = '#8a6a4a'; g.box(0, 0, 0, 0.8, 0.4, 0.8, c); g.box(0, 0.4, -0.3, 0.8, 0.45, 0.2, c); },
  tv: (g, w, d) => { g.box(0, 0, 0, w * 0.9, 0.5, d * 0.5, WOOD_D); g.box(0, 0.5, -0.05, w * 0.6, 0.55, 0.08, BLACK); g.box(0, 0.54, 0.0, w * 0.54, 0.47, 0.02, '#3a4a6a', false); },
  mesa: (g, w, d) => { g.box(0, 0.72, 0, w * 0.9, 0.08, d * 0.8, WOOD); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.box(x * w * 0.4, 0, z * d * 0.33, 0.08, 0.72, 0.08, WOOD_D, false); },
  mesa_redonda: (g) => { g.cyl(0, 0.72, 0, 0.42, 0.07, 10, WOOD); g.cyl(0, 0, 0, 0.06, 0.72, 6, WOOD_D); },
  cadeira: (g) => { g.box(0, 0.42, 0, 0.42, 0.06, 0.42, WOOD); g.box(0, 0.42, -0.2, 0.42, 0.5, 0.05, WOOD); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.box(x * 0.17, 0, z * 0.17, 0.05, 0.42, 0.05, WOOD_D, false); },
  cama: (g, w, d, R) => {
    g.box(0, 0, 0, w * 0.9, 0.35, d * 0.95, WOOD);
    g.box(0, 0.35, 0.05, w * 0.86, 0.14, d * 0.88, ['#e8e0f0', '#f0d8c8', '#d8e8f0'][Math.floor(R() * 3)]);
    g.box(0, 0.35, -d * 0.38, w * 0.6, 0.18, 0.28, WHITE);
    g.box(0, 0, -d * 0.47, w * 0.9, 0.9, 0.07, WOOD_D);
  },
  cama_casal: (g, w, d, R) => B.cama(g, w, d, R),
  guarda_roupa: (g, w, d) => { g.box(0, 0, 0, w * 0.94, 2.0, d * 0.6, WOOD_L); g.box(0, 0.1, d * 0.3, 0.02, 1.8, 0.02, WOOD_D, false); g.box(-0.1, 1.0, d * 0.31, 0.04, 0.2, 0.03, '#d8c8a0', false); g.box(0.1, 1.0, d * 0.31, 0.04, 0.2, 0.03, '#d8c8a0', false); },
  criado: (g) => { g.box(0, 0, 0, 0.5, 0.55, 0.45, WOOD_L); g.box(0, 0.55, 0, 0.18, 0.28, 0.18, '#f0d890'); },
  escrivaninha: (g, w, d) => { g.box(0, 0.72, 0, w * 0.9, 0.07, d * 0.7, WOOD); g.box(-w * 0.3, 0, 0, w * 0.28, 0.72, d * 0.66, WOOD_D); g.box(w * 0.4, 0, 0, 0.06, 0.72, d * 0.66, WOOD_D, false); g.box(w * 0.1, 0.79, -0.1, 0.4, 0.3, 0.05, '#2a2a2e'); },
  estante: (g, w, d, R) => {
    g.box(0, 0, 0, w * 0.94, 2.0, d * 0.45, WOOD_D);
    for (let s = 0; s < 4; s++) for (let i = 0; i < 6; i++) g.box(-w * 0.4 + i * w * 0.16, 0.12 + s * 0.48, d * 0.08, w * 0.12, 0.34, d * 0.26, ['#b8412e', '#3a6aa8', '#e8c23a', '#4a8a3a', '#f0f0e0'][Math.floor(R() * 5)], false);
  },
  geladeira: (g) => { g.box(0, 0, 0, 0.72, 1.8, 0.68, '#eef0ee'); g.box(0, 1.2, 0.35, 0.72, 0.02, 0.01, '#9aa0a0', false); g.box(-0.25, 0.6, 0.35, 0.04, 0.45, 0.04, METAL_D, false); },
  fogao: (g) => { g.box(0, 0, 0, 0.72, 0.85, 0.62, '#f0f0ec'); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.cyl(x * 0.17, 0.85, z * 0.14, 0.09, 0.03, 8, BLACK, 0.09, BLACK, false); g.box(0, 0.2, 0.32, 0.5, 0.4, 0.02, '#2a2a2e', false); },
  pia: (g) => { g.box(0, 0, 0, 0.85, 0.88, 0.6, '#e8e4dc'); g.box(0, 0.88, 0, 0.9, 0.05, 0.62, '#b8bcc0'); g.box(0, 0.93, -0.22, 0.05, 0.25, 0.05, METAL, false); },
  armario: (g) => { g.box(0, 0, 0, 0.85, 0.88, 0.6, WOOD_L); g.box(0, 0.88, 0, 0.88, 0.05, 0.62, '#d8d0c0'); g.box(0, 1.3, -0.12, 0.85, 0.6, 0.36, WOOD_L); },
  vaso: (g) => { g.box(0, 0, 0.05, 0.38, 0.4, 0.5, WHITE); g.box(0, 0.4, -0.2, 0.4, 0.35, 0.16, WHITE); },
  chuveiro: (g) => { g.box(0, 0, 0, 0.9, 0.05, 0.9, '#a8d0d8', false); g.box(0, 1.9, -0.35, 0.18, 0.06, 0.18, METAL); g.box(0, 1.7, -0.42, 0.05, 0.25, 0.05, METAL, false); },
  armarinho: (g) => { g.box(0, 0, 0, 0.6, 0.85, 0.45, '#e8e4dc'); g.box(0, 0.85, 0, 0.62, 0.05, 0.47, '#d8d8d0'); g.box(0, 1.2, -0.18, 0.5, 0.55, 0.12, '#bcd8e8'); },
  maquina: (g) => { g.box(0, 0, 0, 0.7, 0.9, 0.65, '#f4f4f2'); g.cyl(0, 0.9, 0.05, 0.22, 0.02, 10, '#8ab0c8', 0.22, '#8ab0c8', false); },
  tanque: (g) => { g.box(0, 0, 0, 0.75, 0.85, 0.6, '#c8c4bc'); g.box(0, 0.85, 0, 0.7, 0.05, 0.55, '#9aa0a8', false); },
  caixas: (g, w, d, R) => { g.box(-0.12, 0, 0, 0.55, 0.45, 0.5, '#c9985c'); g.box(0.15, 0, 0.12, 0.45, 0.4, 0.45, '#b8884c'); g.box(0, 0.45, 0, 0.45, 0.35, 0.42, '#d2a468'); },
  bancada: (g, w, d) => { g.box(0, 0, 0, w * 0.92, 0.9, d * 0.6, '#6a5a4a'); g.box(0, 0.9, -d * 0.25, w * 0.92, 0.9, 0.05, '#8a7a6a'); g.box(-0.4, 0.9, 0, 0.35, 0.15, 0.22, '#c83a2a'); g.box(0.4, 1.2, -d * 0.22, 0.05, 0.4, 0.05, METAL, false); },
  bau: (g) => { g.box(0, 0, 0, 0.85, 0.55, 0.55, '#8a5a2a'); g.box(0, 0.55, 0, 0.87, 0.14, 0.57, '#6a4220'); g.box(0, 0.35, 0.28, 0.14, 0.14, 0.03, '#e8c23a', false); },
  arquivo: (g) => { g.box(0, 0, 0, 0.55, 1.35, 0.6, '#7a848c'); for (let i = 0; i < 4; i++) g.box(0, 0.12 + i * 0.32, 0.3, 0.2, 0.04, 0.02, '#c8c8c8', false); },
  cofre: (g) => { g.box(0, 0, 0, 0.7, 0.8, 0.65, '#3a3e44'); g.cyl(0, 0.4, 0.33, 0.09, 0.03, 8, '#c8a83a', 0.09, '#c8a83a', false); },
  planta: (g, w, d, R) => { g.cyl(0, 0, 0, 0.22, 0.4, 8, '#b85a3a', 0.28); g.blob(0, 0.75, 0, 0.35, 0.4, 0.35, '#4a9a3a', 1, true, 0.3, 3); },
  // ---------------- cozinha industrial / restaurante / bar
  forno: (g, w, d) => { g.box(0, 0, 0, w * 0.9, 0.9, d * 0.7, '#9aa2a8'); g.box(0, 0.9, 0, w * 0.9, 0.05, d * 0.7, BLACK, false); g.box(0, 0.2, d * 0.36, w * 0.8, 0.45, 0.02, '#4a4e54', false); },
  mesa_rest: (g, w, d, R) => { g.box(0, 0.72, 0, 0.8, 0.06, 0.8, '#e8e0d0'); g.box(0, 0.78, 0, 0.84, 0.01, 0.84, ['#d8413a', '#3a8a4a', '#e8c23a'][Math.floor(R() * 3)], false); g.cyl(0, 0, 0, 0.06, 0.72, 6, METAL_D); },
  mesa_bar: (g, w, d, R) => { const c = ['#f2f2f2', '#e8c23a', '#d8413a'][Math.floor(R() * 3)]; g.box(0, 0.7, 0, 0.7, 0.05, 0.7, c); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.box(x * 0.3, 0, z * 0.3, 0.05, 0.7, 0.05, c, false); },
  balcao: (g, w, d) => { g.box(0, 0, 0, w * 0.95, 1.0, d * 0.6, '#b88a5a'); g.box(0, 1.0, 0, w * 0.97, 0.06, d * 0.66, '#e8e0d0'); g.box(w * 0.3, 1.06, 0, 0.35, 0.25, 0.3, BLACK); },
  // ---------------- escola
  carteira: (g) => { g.box(0, 0.68, 0.08, 0.6, 0.05, 0.42, '#d8b880'); g.box(0, 0, 0.08, 0.05, 0.68, 0.05, METAL_D, false); g.box(0, 0.4, -0.25, 0.4, 0.05, 0.35, '#3a6aa8'); g.box(0, 0.4, -0.42, 0.4, 0.4, 0.04, '#3a6aa8'); g.box(0, 0, -0.25, 0.05, 0.4, 0.05, METAL_D, false); },
  mesa_prof: (g, w, d) => { g.box(0, 0.74, 0, w * 0.85, 0.06, d * 0.65, WOOD); g.box(0, 0, 0, w * 0.8, 0.74, d * 0.6, WOOD_D); g.box(0.3, 0.8, 0, 0.3, 0.12, 0.22, '#e84a3a'); },
  lousa: (g, w, d) => { g.box(0, 0.8, -d * 0.44, w * 0.9, 1.1, 0.06, '#2a4a36'); g.box(0, 0.78, -d * 0.4, w * 0.9, 0.05, 0.1, WOOD, false); },
  armario_escola: (g, w, d) => { g.box(0, 0, 0, w * 0.94, 1.9, d * 0.55, '#6a8aa0'); for (let i = 0; i < 4; i++) g.box(-w * 0.35 + i * w * 0.23, 0.3, d * 0.28, 0.02, 1.4, 0.01, '#4a6a80', false); },
  trave: (g, w, d) => { g.box(0, 0, -d * 0.45, 0.1, 2.1, 0.1, WHITE); g.box(0, 0, d * 0.45, 0.1, 2.1, 0.1, WHITE); g.box(0, 2.0, 0, 0.1, 0.1, d * 0.95, WHITE); },
  // ---------------- mercado e lojas
  prateleira: (g, w, d, R) => {
    g.box(0, 0, 0, w * 0.7, 1.9, d * 0.95, '#c8ccd0');
    for (let s = 0; s < 4; s++) for (let i = 0; i < 5; i++) g.box(0, 0.12 + s * 0.45, -d * 0.4 + i * d * 0.2, w * 0.74, 0.28, d * 0.15, ['#d8413a', '#e8c23a', '#3a8ad8', '#4aa84a', '#f08a3a', '#ffffff'][Math.floor(R() * 6)], false);
  },
  gondola: (g, w, d, R) => {
    g.box(0, 0, 0, w * 0.8, 1.7, d * 0.97, '#e8e8e4');
    for (let s = 0; s < 3; s++) for (let i = 0; i < 7; i++) for (const sd of [-1, 1]) g.box(sd * w * 0.3, 0.15 + s * 0.52, -d * 0.43 + i * d * 0.14, w * 0.25, 0.3, d * 0.11, ['#d8413a', '#e8c23a', '#3a8ad8', '#4aa84a', '#f08a3a', '#ffffff', '#8a4a2a'][Math.floor(R() * 7)], false);
  },
  caixa_reg: (g, w, d) => { g.box(0, 0, 0, w * 0.7, 0.9, d * 0.9, '#d8d8d4'); g.box(0, 0.9, -d * 0.25, 0.35, 0.3, 0.3, '#2a2a2e'); g.box(0, 0.9, 0.2, 0.6, 0.02, 0.9, BLACK, false); },
  freezer: (g, w, d) => { g.box(0, 0, 0, w * 0.92, 0.85, d * 0.8, '#f2f4f6'); g.box(0, 0.85, 0, w * 0.88, 0.04, d * 0.74, '#9ad0e8'); g.box(0, 0.3, d * 0.41, w * 0.6, 0.12, 0.01, '#3a8ad8', false); },
  arara: (g, w, d, R) => {
    g.box(-w * 0.42, 0, 0, 0.05, 1.5, 0.05, METAL, false); g.box(w * 0.42, 0, 0, 0.05, 1.5, 0.05, METAL, false); g.box(0, 1.45, 0, w * 0.88, 0.05, 0.05, METAL, false);
    for (let i = 0; i < 7; i++) g.box(-w * 0.36 + i * w * 0.12, 0.6, 0, 0.1, 0.8, 0.45, ['#e84a8a', '#3a6aa8', '#f2f2f2', '#2a2a2e', '#e8c23a'][Math.floor(R() * 5)]);
  },
  carrinho: (g) => { g.box(0, 0.3, 0, 0.55, 0.45, 0.8, METAL); g.box(0, 0, 0, 0.5, 0.05, 0.7, METAL_D, false); g.box(0, 0.75, -0.42, 0.55, 0.05, 0.05, '#d8413a', false); },
  pallet: (g, w, d, R) => { g.box(0, 0, 0, w * 0.9, 0.15, d * 0.9, WOOD_L); for (let i = 0; i < 4; i++) g.box((i % 2 - 0.5) * w * 0.42, 0.15, (Math.floor(i / 2) - 0.5) * d * 0.42, w * 0.4, 0.5 + R() * 0.5, d * 0.4, ['#c9985c', '#e8e0c8', '#d8413a'][i % 3]); },
  vitrine: (g, w, d) => { g.box(0, 0, 0, w * 0.9, 0.9, d * 0.6, '#3a3e48'); g.box(0, 0.9, 0, w * 0.9, 0.35, d * 0.6, '#a8d8f0'); g.box(-0.3, 0.95, 0, 0.3, 0.2, 0.2, BLACK, false); g.box(0.3, 0.95, 0, 0.25, 0.15, 0.2, '#e84a3a', false); },
  // ---------------- rua e praça
  lixeira: (g) => { g.cyl(0, 0, 0, 0.26, 0.8, 8, '#e87a1e', 0.3); g.cyl(0, 0.8, 0, 0.32, 0.06, 8, '#b85a14'); },
  cacamba: (g, w, d) => { g.box(0, 0, 0, w * 0.9, 1.1, d * 0.8, '#e8a01e'); g.box(0, 1.1, 0, w * 0.8, 0.2, d * 0.7, '#6a5a4a', false); },
  arvore: (g, w, d, R) => tree(g, R, ['#3f7f36', '#4f9a3e', '#44883a'], 1.4, 1.05),
  ipe: (g, w, d, R) => tree(g, R, ['#f2c418', '#e8b010', '#f6d44a'], 1.5, 0.95),
  ipe_rosa: (g, w, d, R) => tree(g, R, ['#f07ab0', '#e060a0', '#f89ac8'], 1.5, 0.95),
  palmeira: (g, w, d, R) => {
    const lean = (R() - 0.5) * 0.3;
    for (let i = 0; i < 5; i++) g.cyl(lean * i * 0.25, i * 0.75, 0, 0.14 - i * 0.012, 0.78, 6, i % 2 ? '#8a6a44' : '#9a7a50', 0.13 - i * 0.012);
    const tx = lean * 1.25, ty = 3.8;
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28; g.push(); g.translate(tx, ty, 0); g.rotateY(a); g.rotateX(0.5); g.blob(0, 0, 0.8, 0.22, 0.08, 0.95, k % 2 ? '#3f8f3a' : '#56a846', 0, true, 0, k + 1); g.pop(); }
    g.blob(tx, ty, 0, 0.2, 0.2, 0.2, '#7a5a30', 0);
  },
  arbusto: (g, w, d, R) => { g.blob(-0.1, 0.35, 0, 0.42, 0.38, 0.4, '#4a8f3a', 1, true, 0.3, 7); g.blob(0.2, 0.3, 0.12, 0.3, 0.28, 0.3, '#5aa846', 1, true, 0.3, 9); if (R() < 0.4) g.blob(0.05, 0.62, 0.2, 0.08, 0.08, 0.08, ['#f06a8a', '#f6d04a', '#ffffff'][Math.floor(R() * 3)], 0, false); },
  poste: (g) => {
    g.box(0, 0, 0, 0.2, 5.2, 0.2, '#b8b4ac');
    g.box(0, 4.7, 0, 1.4, 0.1, 0.1, '#8a867e');
    g.box(0, 4.2, 0.45, 0.08, 0.08, 0.9, '#8a867e');
    g.box(0, 4.08, 0.9, 0.3, 0.12, 0.2, '#4a4a50');
    g.cyl(0.5, 3.6, -0.1, 0.18, 0.5, 8, '#7a7e84');
  },
  banco: (g, w, d) => { g.box(0, 0.42, 0, w * 0.9, 0.08, d * 0.45, '#8a5a2a'); g.box(0, 0.5, -d * 0.2, w * 0.9, 0.4, 0.06, '#8a5a2a'); g.box(-w * 0.38, 0, 0, 0.1, 0.42, d * 0.4, '#5a5a5e'); g.box(w * 0.38, 0, 0, 0.1, 0.42, d * 0.4, '#5a5a5e'); },
  banco_igreja: (g, w, d) => { g.box(0, 0.42, 0.05, w * 0.95, 0.07, d * 0.45, WOOD_D); g.box(0, 0.42, -d * 0.2, w * 0.95, 0.6, 0.07, WOOD_D); g.box(0, 0.8, -d * 0.35, w * 0.95, 0.05, 0.15, WOOD, false); for (const x of [-1, 1]) g.box(x * w * 0.46, 0, 0, 0.06, 0.9, d * 0.6, WOOD); },
  orelhao: (g) => {
    g.box(0, 0, 0, 0.1, 1.2, 0.1, '#6a6a6a');
    g.push(); g.translate(0, 1.2, 0.08);
    g.blob(0, 0.45, 0, 0.55, 0.6, 0.5, '#f07a1e', 1, true, 0, 5);
    g.pop();
    g.box(0, 1.25, 0.25, 0.3, 0.45, 0.12, '#3a6ad8', false);
  },
  banca: (g, w, d) => { g.box(0, 0, 0, w * 0.85, 1.9, d * 0.8, '#3a8a4a'); g.box(0, 1.9, 0.1, w * 0.95, 0.12, d * 0.95, '#2a6a3a'); g.box(0, 0.8, d * 0.41, w * 0.7, 0.8, 0.02, '#f2f2e8', false); },
  pipoca: (g) => { g.box(0, 0.3, 0, 0.7, 0.8, 0.5, '#d8413a'); g.box(0, 1.1, 0, 0.6, 0.5, 0.45, '#fff8c8'); g.box(0, 1.6, 0, 0.8, 0.08, 0.6, '#f2f2f2'); g.cyl(-0.3, 0, 0.2, 0.15, 0.1, 6, BLACK); },
  coreto: (g) => {
    g.cyl(0, 0, 0, 1.5, 0.5, 8, '#e8e0d0', 1.5, '#d8c8a8');
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28 + 0.39; g.box(Math.cos(a) * 1.3, 0.5, Math.sin(a) * 1.3, 0.14, 2.1, 0.14, WHITE); }
    g.cyl(0, 2.6, 0, 1.65, 0.12, 8, '#e84a3a', 1.65, '#e84a3a');
    g.cyl(0, 2.72, 0, 1.6, 0.8, 8, '#e84a3a', 0.08, '#c83a2a');
  },
  monumento: (g) => { g.box(0, 0, 0, 0.95, 0.5, 0.95, '#d8d0c0'); g.cyl(0, 0.5, 0, 0.35, 2.4, 4, '#c8c0b0', 0.08); g.blob(0, 3.05, 0, 0.15, 0.15, 0.15, '#c8a83a', 0); },
  fonte: (g, w, d) => { g.cyl(0, 0, 0, w * 0.48, 0.45, 12, '#d8d0c0'); g.cyl(0, 0.44, 0, w * 0.42, 0.02, 12, '#5ab0d8', w * 0.42, '#5ab0d8', false); g.cyl(0, 0.45, 0, 0.12, 0.8, 6, '#c8c0b0'); g.cyl(0, 1.25, 0, 0.35, 0.1, 8, '#d8d0c0'); },
  ponto_onibus: (g, w, d) => { g.box(-w * 0.42, 0, -0.3, 0.08, 2.2, 0.08, METAL_D); g.box(w * 0.42, 0, -0.3, 0.08, 2.2, 0.08, METAL_D); g.box(0, 2.2, -0.1, w * 0.95, 0.08, 0.8, '#3a6aa8'); g.box(0, 0.45, -0.3, w * 0.8, 0.07, 0.35, '#8a8a8e'); },
  placa: (g) => { g.box(0, 0, 0, 0.08, 2.2, 0.08, METAL); g.box(0, 1.8, 0, 0.9, 0.45, 0.05, '#2a6ab0'); },
  entulho: (g, w, d, R) => { for (let i = 0; i < 4; i++) g.box((R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5, 0.3 + R() * 0.3, 0.15 + R() * 0.3, 0.3 + R() * 0.3, ['#9a8a7a', '#b85a3a', '#7a7a7a'][i % 3]); },
  caixa_dagua: (g) => { g.cyl(0, 0, 0, 0.5, 0.9, 10, '#3a7ad8', 0.55); g.cyl(0, 0.9, 0, 0.58, 0.12, 10, '#2a5ab0'); },
  bicicleta: (g) => { g.push(); g.rotateZ(1.4); g.cyl(0, -0.02, 0.4, 0.3, 0.04, 10, BLACK); g.cyl(0, -0.02, -0.4, 0.3, 0.04, 10, BLACK); g.pop(); g.box(0, 0.12, 0, 0.1, 0.06, 0.8, '#d8413a'); },
  // ---------------- veículos
  carro: (g, w, d, R, p) => car(g, w, d, R, p),
  carro_pol: (g, w, d, R, p) => car(g, w, d, R, Object.assign({}, p, { cor: '#f4f4f4' }), 'viatura'),
  opala: (g, w, d, R, p) => car(g, w, d, R, Object.assign({}, p, { cor: '#3a1e1a' }), 'opala'),
  sucata: (g, w, d, R, p) => car(g, w, d, R, Object.assign({}, p, { cor: '#8a5a3a' }), 'sucata'),
  moto: (g) => { g.push(); g.rotateZ(1.35); g.cyl(0, -0.05, 0.35, 0.26, 0.1, 10, BLACK); g.cyl(0, -0.05, -0.35, 0.26, 0.1, 10, BLACK); g.box(0, -0.2, 0, 0.3, 0.4, 0.7, '#d8413a'); g.pop(); },
  onibus: (g, w, d) => {
    g.box(0, 0.3, 0, w * 0.95, 2.4, d * 0.97, { side: '#f2f2ee', top: '#dcdcd8' });
    g.box(0, 1.35, 0, w * 0.97, 0.7, d * 0.9, { side: GLASS, top: '#dcdcd8' }, false);
    g.box(0, 0.6, 0, w * 0.97, 0.25, d * 0.97, '#2a8ad8', false);
    for (const z of [-1, 1]) for (const x of [-1, 1]) { g.push(); g.translate(x * w * 0.46, 0.35, z * d * 0.33); g.rotateZ(Math.PI / 2); g.cyl(0, -0.12, 0, 0.35, 0.24, 8, BLACK); g.pop(); }
  },
  caminhao: (g, w, d) => {
    const olive = '#56603a';
    g.box(0, 0.4, d * 0.34, w * 0.92, 1.3, d * 0.28, { side: olive, pz: GLASS });
    g.box(0, 0.5, -d * 0.12, w * 0.95, 0.3, d * 0.66, '#3e4630');
    g.box(0, 0.8, -d * 0.12, w * 0.95, 1.7, d * 0.66, { side: '#6a7448', top: '#6a7448' });
    for (const z of [0.3, -0.05, -0.35]) for (const x of [-1, 1]) { g.push(); g.translate(x * w * 0.46, 0.4, z * d); g.rotateZ(Math.PI / 2); g.cyl(0, -0.14, 0, 0.4, 0.28, 8, BLACK); g.pop(); }
  },
  locomotiva: (g, w, d) => {
    g.box(0, 0.5, 0, w * 0.9, 2.2, d * 0.98, { side: '#b83a2a', top: '#4a4a50' });
    g.box(0, 1.3, 0, w * 0.92, 0.25, d * 0.98, '#e8c23a', false);
    g.box(0, 2.7, d * 0.3, w * 0.8, 0.5, d * 0.25, '#b83a2a');
    g.box(0, 1.8, d * 0.47, w * 0.6, 0.5, 0.05, GLASS, false);
    for (let i = -3; i <= 3; i++) g.box(0, 0, i * d * 0.13, w * 0.95, 0.5, 0.3, '#2a2a2e', false);
  },
  vagao: (g, w, d, R) => {
    g.box(0, 0.55, 0, w * 0.92, 2.3, d * 0.96, { side: ['#7a4a2a', '#5a6a7a', '#8a6a2a'][Math.floor(R() * 3)], top: '#5a5a5a' });
    g.box(0, 0.9, 0, w * 0.94, 1.5, d * 0.3, '#4a3a2a', false);
    for (let i = -3; i <= 3; i++) g.box(0, 0, i * d * 0.13, w * 0.95, 0.55, 0.3, '#2a2a2e', false);
  },
  // ---------------- oficina, posto e ferro-velho
  elevador: (g, w, d) => { g.box(-w * 0.42, 0, 0, 0.18, 1.7, 0.18, '#d8413a'); g.box(w * 0.42, 0, 0, 0.18, 1.7, 0.18, '#d8413a'); g.box(0, 0.1, 0, w * 0.85, 0.1, d * 0.9, '#6a6e74'); g.box(0, 1.6, 0, w * 0.9, 0.1, 0.2, '#d8413a'); },
  pneus: (g, w, d, R) => { for (let i = 0; i < 3 + Math.floor(R() * 2); i++) g.cyl((R() - 0.5) * 0.1, i * 0.22, (R() - 0.5) * 0.1, 0.35, 0.2, 10, '#1e1e22', 0.35, '#2a2a2e'); },
  tambor: (g, w, d, R) => { const c = ['#2a6ab0', '#d8413a', '#3a8a3a', '#e8a01e'][Math.floor(R() * 4)]; g.cyl(0, 0, 0, 0.3, 0.9, 10, c); g.cyl(0, 0.3, 0, 0.31, 0.04, 10, '#2a2a2e', 0.31, '#2a2a2e', false); },
  bomba: (g) => { g.box(0, 0, 0, 0.6, 0.15, 0.6, '#c8c8c0'); g.box(0, 0.15, 0, 0.5, 1.55, 0.4, '#e8b020'); g.box(0, 1.1, 0.21, 0.36, 0.3, 0.02, '#2a2a2e', false); g.box(0.3, 0.6, 0, 0.08, 0.5, 0.08, BLACK, false); },
  sacos: (g) => { for (let i = 0; i < 3; i++) g.blob(0, 0.15 + i * 0.25, 0, 0.45, 0.14, 0.3, '#b8a070', 1, true, 0.1, i + 2); },
  barricada: (g, w, d) => { for (let k = 0; k < 3; k++) for (let i = 0; i < 5; i++) g.blob(-w * 0.4 + i * w * 0.2, 0.15 + k * 0.26, 0, 0.35, 0.14, 0.3, '#a89060', 1, true, 0.1, i + k * 5 + 1); g.box(0, 0.8, 0, w * 0.9, 0.3, 0.1, '#6a7448', false); },
  cavalete: (g) => { g.box(0, 0.6, 0, 1.0, 0.25, 0.08, '#e8e8e8'); g.box(-0.2, 0.62, 0.04, 0.2, 0.22, 0.02, '#e83a2a', false); g.box(0.2, 0.62, 0.04, 0.2, 0.22, 0.02, '#e83a2a', false); g.box(-0.4, 0, 0, 0.08, 0.6, 0.3, '#5a5a5a'); g.box(0.4, 0, 0, 0.08, 0.6, 0.3, '#5a5a5a'); },
  gerador: (g, w, d) => { g.box(0, 0, 0, w * 0.85, 0.9, d * 0.7, '#e8b020'); g.box(-0.3, 0.9, 0, 0.3, 0.3, 0.3, '#3a3a3e'); g.box(0.4, 0.3, d * 0.36, 0.3, 0.3, 0.02, BLACK, false); },
  // ---------------- laboratório, rádio
  bancada_lab: (g, w, d, R) => { g.box(0, 0, 0, w * 0.92, 0.92, d * 0.7, '#e8ecec'); g.box(0, 0.92, 0, w * 0.94, 0.05, d * 0.72, '#2a2e34'); for (let i = 0; i < 3; i++) g.cyl(-0.5 + i * 0.5, 0.97, 0, 0.07, 0.25, 6, ['#7aff7a', '#ff7aff', '#7ad8ff'][i], 0.03); },
  tanque_lab: (g) => { g.cyl(0, 0, 0, 0.42, 0.25, 10, '#5a6268'); g.cyl(0, 0.25, 0, 0.38, 1.6, 10, '#7aff9a', 0.38, '#9affba'); g.cyl(0, 1.85, 0, 0.42, 0.25, 10, '#5a6268'); g.blob(0, 1.0, 0, 0.18, 0.28, 0.18, '#3a6a2a', 1, false, 0.3, 4); },
  computador: (g) => { g.box(0, 0, 0, 0.8, 0.75, 0.6, '#d8d8d8'); g.box(0, 0.75, -0.1, 0.5, 0.4, 0.05, '#2a2a2e'); g.box(0, 0.79, -0.07, 0.44, 0.32, 0.01, '#3ad86a', false); },
  gaiola: (g) => { g.box(0, 0, 0, 0.7, 0.7, 0.6, '#c8ccd0'); g.box(0, 0.05, 0, 0.6, 0.55, 0.5, '#3a3e44', false); },
  maca: (g, w, d) => { g.box(0, 0.7, 0, w * 0.8, 0.1, d * 0.9, '#e8eef0'); for (const z of [-1, 1]) g.box(0, 0, z * d * 0.38, 0.08, 0.7, 0.08, METAL, false); },
  transmissor: (g, w, d) => { g.box(0, 0, 0, w * 0.9, 1.6, d * 0.6, '#5a6268'); for (let i = 0; i < 6; i++) g.box(-w * 0.35 + i * w * 0.14, 1.1, d * 0.31, 0.08, 0.08, 0.02, i % 2 ? '#3ad86a' : '#e8c23a', false); g.box(0, 0.4, d * 0.31, w * 0.7, 0.4, 0.02, '#2a2a2e', false); },
  antena: (g) => { g.box(0, 0, 0, 0.9, 0.3, 0.9, '#8a8a8a'); for (let i = 0; i < 8; i++) g.box(0, 0.3 + i * 1.9, 0, 0.5 - i * 0.04, 1.9, 0.5 - i * 0.04, i % 2 ? '#e83a2a' : '#f2f2f2'); },
  // ---------------- quintal
  rede: (g, w, d) => { g.box(-w * 0.45, 0, 0, 0.1, 1.2, 0.1, WOOD_D); g.box(w * 0.45, 0, 0, 0.1, 1.2, 0.1, WOOD_D); g.blob(0, 0.6, 0, w * 0.38, 0.12, 0.3, '#e84a3a', 1, true, 0, 3); },
  varal: (g, w, d, R) => { g.box(-w * 0.45, 0, 0, 0.06, 1.7, 0.06, METAL); g.box(w * 0.45, 0, 0, 0.06, 1.7, 0.06, METAL); for (let i = 0; i < 5; i++) g.box(-w * 0.35 + i * w * 0.17, 1.15, 0, 0.3, 0.5, 0.02, ['#f2f2f2', '#3a6aa8', '#e84a8a', '#e8c23a'][Math.floor(R() * 4)], false); },
  churrasqueira: (g) => { g.box(0, 0, 0, 0.9, 0.9, 0.7, '#b85a3a'); g.box(0, 0.9, -0.2, 0.9, 0.9, 0.3, '#a84a2a'); g.box(0, 1.8, -0.2, 0.3, 0.8, 0.3, '#a84a2a'); },
  quiosque: (g, w, d) => { g.box(0, 0, 0, w * 0.8, 1.1, d * 0.8, '#e8c090'); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.box(x * w * 0.45, 0, z * d * 0.45, 0.1, 2.2, 0.1, WOOD_D); g.cyl(0, 2.2, 0, w * 0.75, 0.6, 6, '#c8a860', 0.1, '#b89850'); },
  canoa: (g, w, d) => { g.blob(0, 0.15, 0, 0.4, 0.2, d * 0.46, '#8a5a2a', 1, true, 0, 2); g.box(0, 0.22, 0, 0.5, 0.05, 0.1, WOOD_D, false); },
  altar: (g, w, d) => { g.box(0, 0, 0, w * 0.9, 1.0, d * 0.6, '#f2ecd8'); g.box(0, 1.0, 0, w * 0.95, 0.06, d * 0.7, '#d8a83a'); g.box(0, 1.06, -0.1, 0.08, 0.6, 0.08, '#d8a83a'); g.box(0, 1.46, -0.1, 0.35, 0.08, 0.08, '#d8a83a'); for (const x of [-1, 1]) { g.cyl(x * w * 0.3, 1.06, 0, 0.05, 0.3, 6, WHITE); } },
  sino: (g) => { g.cyl(0, 0, 0, 0.35, 0.15, 8, '#8a7a5a'); g.cyl(0, 0.15, 0, 0.32, 0.6, 10, '#c8a83a', 0.14); },
};
