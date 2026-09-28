// Gerador de construções: paredes com portas e janelas, telhado (que some quando
// o jogador entra), piso, placas, pichações e o interior com móveis e recipientes.
import * as THREE from '../../lib/three.module.min.js';
import { Batch, boxGeo, materials } from './batch.js';
import * as T from '../core/textures.js';

const WALL_T = 0.22;

// spec: { x0,z0,x1,z1, h, color, band, roof:'gable'|'flat'|'none', roofColor,
//         doors:[{side, at, w, kind:'door'|'gap'|'open'}], windows:true|false, sign:{text,bg,fg,side},
//         floor:'wood'|'tile'|'concrete', graffiti:[{side,text,color}], name, parts:[...] }
export function building(W, spec) {
  const { x0, z0, x1, z1 } = spec;
  const h = spec.h || 3.0;
  const wb = new Batch(1000), rb = new Batch(1000);
  const color = spec.color || '#e0d6c2';
  const band = spec.band || null;
  const wallMat = spec.brick ? 'brick' : 'plaster';
  const rec = { ...spec, h, walls: new THREE.Group(), roof: new THREE.Group(), cut: 1, doorsList: [] };
  const sides = {
    n: { len: x1 - x0, at: t => [x0 + t, z0], along: 'x' },
    s: { len: x1 - x0, at: t => [x0 + t, z1], along: 'x' },
    w: { len: z1 - z0, at: t => [x0, z0 + t], along: 'z' },
    e: { len: z1 - z0, at: t => [x1, z0 + t], along: 'z' },
  };
  const ops = { n: [], s: [], e: [], w: [] };
  for (const d of spec.doors || []) ops[d.side].push({ a: d.at - d.w / 2, b: d.at + d.w / 2, type: d.kind || 'door', gapH: d.gapH });
  // janelas automáticas nos espaços livres
  if (spec.windows !== false) {
    for (const [sd, S] of Object.entries(sides)) {
      const step = spec.winStep || 3.2;
      for (let t = 1.6; t < S.len - 1.4; t += step) {
        const a = t - 0.6, b = t + 0.6;
        if (ops[sd].some(o => b > o.a - 0.6 && a < o.b + 0.6)) continue;
        if (W.rnd() < (spec.winChance ?? 0.75)) ops[sd].push({ a, b, type: 'window' });
      }
    }
  }
  const piece = (sd, a, b, y0, y1, collide = true, los = true, isBand = false) => {
    if (b - a < 0.02 || y1 - y0 < 0.02) return;
    const S = sides[sd];
    const L = b - a, mid = (a + b) / 2;
    const [cx, cz] = S.at(mid);
    const ext = sd === 'n' || sd === 's' ? 0 : WALL_T; // cantos: paredes em z encolhem
    const g = S.along === 'x' ? boxGeo(L, y1 - y0, WALL_T) : boxGeo(WALL_T, y1 - y0, Math.max(0.02, L - (a <= 0.01 ? ext / 2 : 0) - (b >= S.len - 0.01 ? ext / 2 : 0)));
    wb.add(g, wallMat, { x: cx, y: (y0 + y1) / 2, z: cz, color, vary: 0.04 });
    if (band && y0 < 0.9 && !isBand) {
      const bh = Math.min(0.9, y1) - y0;
      const gb = S.along === 'x' ? boxGeo(L, bh, WALL_T + 0.04) : boxGeo(WALL_T + 0.04, bh, Math.max(0.02, L - 0.1));
      wb.add(gb, 'plaster', { x: cx, y: y0 + bh / 2, z: cz, color: band });
    }
    if (collide) {
      const t = WALL_T / 2 + 0.02;
      const box = S.along === 'x' ? { type: 'box', x0: cx - L / 2, x1: cx + L / 2, z0: cz - t, z1: cz + t } : { type: 'box', x0: cx - t, x1: cx + t, z0: cz - L / 2, z1: cz + L / 2 };
      box.los = los;
      W.col.add(box);
    }
  };
  for (const [sd, S] of Object.entries(sides)) {
    const list = ops[sd].sort((p, q) => p.a - q.a);
    let cur = 0;
    for (const o of list) {
      piece(sd, cur, o.a, 0, h);
      if (o.type === 'window') {
        piece(sd, o.a, o.b, 0, 0.95, true, false);
        piece(sd, o.a, o.b, 2.15, h, false);
        const [cx, cz] = S.at((o.a + o.b) / 2);
        const L = o.b - o.a;
        const broken = W.rnd() < 0.5;
        // vidro (às vezes quebrado) e moldura
        const gg = S.along === 'x' ? boxGeo(L, 1.2, 0.04) : boxGeo(0.04, 1.2, L);
        if (!broken) wb.add(gg, 'glass', { x: cx, y: 1.55, z: cz, color: '#9ab0c0' });
        const fr = S.along === 'x' ? boxGeo(L + 0.12, 0.08, WALL_T + 0.06) : boxGeo(WALL_T + 0.06, 0.08, L + 0.12);
        wb.add(fr, 'plain', { x: cx, y: 0.97, z: cz, color: '#efe8da' });
        wb.add(fr.clone(), 'plain', { x: cx, y: 2.13, z: cz, color: '#efe8da' });
        // grade ou tábuas pregadas
        if (W.rnd() < 0.45) {
          for (let k = 0; k < 3; k++) {
            const pl = S.along === 'x' ? boxGeo(L + 0.2, 0.16, 0.05, 1) : boxGeo(0.05, 0.16, L + 0.2, 1);
            const off = S.along === 'x' ? { z: cz + (sd === 's' ? 0.14 : -0.14) } : { x: cx + (sd === 'e' ? 0.14 : -0.14) };
            wb.add(pl, 'wood', { x: cx, z: cz, ...off, y: 1.2 + k * 0.4, rx: S.along === 'z' ? (k - 1) * 0.15 : 0, rz: S.along === 'x' ? (k - 1) * 0.15 : 0, color: '#8a6a4a', vary: 0.2 });
          }
        }
      } else if (o.type === 'door' || o.type === 'open') {
        piece(sd, o.a, o.b, 2.35, h, false);
        const [cx, cz] = S.at(o.a);
        if (o.type === 'door') rec.doorsList.push(W.addDoor(cx, cz, sd, o.b - o.a, W.rnd() < 0.4));
        // soleira
        const [mx, mz] = S.at((o.a + o.b) / 2);
        const sg = S.along === 'x' ? boxGeo(o.b - o.a, 0.05, WALL_T + 0.1) : boxGeo(WALL_T + 0.1, 0.05, o.b - o.a);
        W.batch.add(sg, 'concrete', { x: mx, y: 0.02, z: mz, color: '#a8a298' });
      } else if (o.type === 'gap') {
        piece(sd, o.a, o.b, o.gapH || 3.2, h, false);
      }
      cur = o.b;
    }
    piece(sd, cur, S.len, 0, h);
  }
  // divisórias internas (rebaixam junto com as paredes)
  for (const [ax, az, bx, bz, gap] of spec.partitions || []) {
    const vx = Math.abs(ax - bx) < 0.01;
    const segs = gap ? [[ax, az, vx ? ax : gap[0], vx ? gap[0] : az], [vx ? ax : gap[1], vx ? gap[1] : az, bx, bz]] : [[ax, az, bx, bz]];
    for (const [a1, b1, a2, b2] of segs) {
      const L = vx ? Math.abs(b2 - b1) : Math.abs(a2 - a1);
      if (L < 0.05) continue;
      wb.add(boxGeo(vx ? 0.14 : L, h - 0.1, vx ? L : 0.14), wallMat, { x: (a1 + a2) / 2, y: (h - 0.1) / 2, z: (b1 + b2) / 2, color: spec.inner || '#e8e2d4' });
      W.col.add({ type: 'box', x0: Math.min(a1, a2) - 0.08, x1: Math.max(a1, a2) + 0.08, z0: Math.min(b1, b2) - 0.08, z1: Math.max(b1, b2) + 0.08 });
    }
  }
  // piso
  const fl = spec.floor || 'wood';
  const fc = { wood: '#9a7a58', tile: '#c8c0b0', concrete: '#9a968e', dirt: '#6a5a44' }[fl] || '#9a7a58';
  W.batch.add(boxGeo(x1 - x0 - 0.1, 0.06, z1 - z0 - 0.1, 1.5), fl === 'wood' ? 'wood' : 'concrete', { x: (x0 + x1) / 2, y: 0.03, z: (z0 + z1) / 2, color: fc, shadow: false });
  // telhado
  const roofColor = spec.roofColor || '#b8664a';
  const ov = 0.45;
  if (spec.roof === 'flat') {
    rb.add(boxGeo(x1 - x0 + 0.3, 0.25, z1 - z0 + 0.3), 'concrete', { x: (x0 + x1) / 2, y: h + 0.12, z: (z0 + z1) / 2, color: spec.roofColor || '#9a968e' });
    const ph = 0.6, pc = color;
    rb.add(boxGeo(x1 - x0 + 0.3, ph, 0.25), wallMat, { x: (x0 + x1) / 2, y: h + ph / 2 + 0.2, z: z0 - 0.02, color: pc });
    rb.add(boxGeo(x1 - x0 + 0.3, ph, 0.25), wallMat, { x: (x0 + x1) / 2, y: h + ph / 2 + 0.2, z: z1 + 0.02, color: pc });
    rb.add(boxGeo(0.25, ph, z1 - z0), wallMat, { x: x0 - 0.02, y: h + ph / 2 + 0.2, z: (z0 + z1) / 2, color: pc });
    rb.add(boxGeo(0.25, ph, z1 - z0), wallMat, { x: x1 + 0.02, y: h + ph / 2 + 0.2, z: (z0 + z1) / 2, color: pc });
    // caixa d'água
    if (spec.tank !== false) rb.add(new THREE.CylinderGeometry(0.7, 0.8, 1.1, 10), 'plain', { x: x0 + 1.4, y: h + 0.8, z: z0 + 1.4, color: '#3a5a8a' });
  } else if (spec.roof !== 'none') {
    const alongX = (x1 - x0) >= (z1 - z0);
    const Lr = (alongX ? x1 - x0 : z1 - z0) + ov * 2, D = alongX ? z1 - z0 : x1 - x0;
    const rh = spec.ridge || Math.min(1.8, D * 0.28);
    const half = D / 2 + ov, ang = Math.atan2(rh, D / 2), sl = half / Math.cos(ang);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (const s of [-1, 1]) {
      const off = (half / 2) * s, yy = h + rh / 2 - (ov * Math.tan(ang)) / 2;
      if (alongX) rb.add(boxGeo(Lr, 0.14, sl, 2), 'roof', { x: cx, y: yy + 0.05, z: cz + off, rx: s * ang, color: roofColor, vary: 0.06 });
      else rb.add(boxGeo(sl, 0.14, Lr, 2), 'roof', { x: cx + off, y: yy + 0.05, z: cz, rz: -s * ang, color: roofColor, vary: 0.06 });
    }
    // oitões (triângulos das pontas)
    const tri = new THREE.Shape(); tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, rh); tri.closePath();
    for (const e of [0, 1]) {
      const g = new THREE.ExtrudeGeometry(tri, { depth: WALL_T, bevelEnabled: false });
      g.translate(0, 0, -WALL_T / 2);
      if (alongX) rb.add(g, wallMat, { x: e ? x1 : x0, y: h, z: cz, ry: Math.PI / 2, color });
      else rb.add(g, wallMat, { x: cx, y: h, z: e ? z1 : z0, color });
    }
    rb.add(boxGeo(alongX ? Lr : 0.2, 0.16, alongX ? 0.2 : Lr), 'plain', { x: cx, y: h + rh + 0.06, z: cz, color: '#7a3e2a' });
  }
  // placa na fachada
  if (spec.sign) {
    const sd = spec.sign.side || (spec.doors && spec.doors[0] ? spec.doors[0].side : 's');
    const S = sides[sd];
    const [cx, cz] = S.at(S.len / 2);
    const sw = Math.min(S.len - 1, spec.sign.w || 6), sh = sw * 96 / 512 * (spec.sign.tall || 1.3);
    const tex = T.signTex(spec.sign.text, { bg: spec.sign.bg, fg: spec.sign.fg });
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
    const g = new THREE.PlaneGeometry(sw, sh);
    const mesh = new THREE.Mesh(g, m);
    const out = WALL_T / 2 + 0.03;
    const y = Math.min(h - sh / 2 - 0.1, 2.6 + sh / 2);
    if (sd === 's') { mesh.position.set(cx, y, cz + out); }
    else if (sd === 'n') { mesh.position.set(cx, y, cz - out); mesh.rotation.y = Math.PI; }
    else if (sd === 'e') { mesh.position.set(cx + out, y, cz); mesh.rotation.y = Math.PI / 2; }
    else { mesh.position.set(cx - out, y, cz); mesh.rotation.y = -Math.PI / 2; }
    mesh.castShadow = false;
    if (spec.sign.onRoof) { mesh.position.y = h + 1.1; }
    (spec.sign.onRoof ? rec.roof : rec.walls).add(mesh);
  }
  for (const gf of spec.graffiti || []) {
    const S = sides[gf.side];
    const [cx, cz] = S.at(gf.at ?? S.len / 2);
    const m = new THREE.MeshBasicMaterial({ map: T.graffitiTex(gf.text, gf.color), transparent: true, depthWrite: false, opacity: 0.85 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), m);
    const out = WALL_T / 2 + 0.02;
    if (gf.side === 's') mesh.position.set(cx, 1.5, cz + out);
    else if (gf.side === 'n') { mesh.position.set(cx, 1.5, cz - out); mesh.rotation.y = Math.PI; }
    else if (gf.side === 'e') { mesh.position.set(cx + out, 1.5, cz); mesh.rotation.y = Math.PI / 2; }
    else { mesh.position.set(cx - out, 1.5, cz); mesh.rotation.y = -Math.PI / 2; }
    rec.walls.add(mesh);
  }
  wb.build(rec.walls);
  rb.build(rec.roof);
  W.staticGroup.add(rec.walls, rec.roof);
  W.buildings.push(rec);
  return rec;
}

// ---------------- móveis (fixos, no Batch) ----------------
export const F = {
  bed(W, x, z, ry = 0) {
    W.batch.add(boxGeo(1.1, 0.35, 2.0), 'wood', { x, y: 0.2, z, ry, color: '#7a5a3a' });
    W.batch.add(boxGeo(1.0, 0.18, 1.9), 'plain', { x, y: 0.46, z, ry, color: '#d8d0c0', vary: 0.1 });
    W.batch.add(boxGeo(1.02, 0.1, 1.2), 'plain', { x: x + Math.sin(ry) * 0.3, y: 0.58, z: z + Math.cos(ry) * 0.3, ry, color: W.rnd.pick(['#6a3a3a', '#3a5a7a', '#6a6a3a']) });
    W.col.add({ type: 'circle', x, z, r: 0.8, low: true });
  },
  table(W, x, z) {
    W.batch.add(boxGeo(1.4, 0.06, 0.9), 'wood', { x, y: 0.78, z, color: '#8a6a44' });
    for (const [a, b] of [[-0.62, -0.38], [0.62, -0.38], [-0.62, 0.38], [0.62, 0.38]]) W.batch.add(boxGeo(0.06, 0.78, 0.06), 'wood', { x: x + a, y: 0.39, z: z + b, color: '#6a4a2a' });
    W.col.add({ type: 'circle', x, z, r: 0.7, low: true });
  },
  sofa(W, x, z, ry = 0) {
    const c = W.rnd.pick(['#6a4a3a', '#4a5a6a', '#7a6a4a']);
    W.batch.add(boxGeo(2.0, 0.45, 0.85), 'plain', { x, y: 0.25, z, ry, color: c });
    W.batch.add(boxGeo(2.0, 0.5, 0.2), 'plain', { x: x - Math.sin(ry) * 0.35, y: 0.7, z: z - Math.cos(ry) * 0.35, ry, color: c });
    W.col.add({ type: 'circle', x, z, r: 0.8, low: true });
  },
  rug(W, x, z, w, d, color) { W.batch.add(boxGeo(w, 0.02, d), 'plain', { x, y: 0.07, z, color, shadow: false }); },
  counter(W, x0, z0, x1, z1, color = '#8a7a6a') {
    W.batch.add(boxGeo(x1 - x0, 1.0, z1 - z0), 'wood', { x: (x0 + x1) / 2, y: 0.5, z: (z0 + z1) / 2, color });
    W.batch.add(boxGeo(x1 - x0 + 0.06, 0.05, z1 - z0 + 0.06), 'plain', { x: (x0 + x1) / 2, y: 1.02, z: (z0 + z1) / 2, color: '#d8d0c0' });
    W.col.add({ type: 'box', x0, x1, z0, z1, los: false, low: true });
  },
  // recipiente: guarda-roupa, geladeira, prateleiras...
  wardrobe(W, x, z, ry = 0) {
    W.batch.add(boxGeo(1.1, 2.0, 0.55), 'wood', { x, y: 1.0, z, ry, color: '#6a4a30' });
    W.col.add({ type: 'circle', x, z, r: 0.55, low: true });
    return W.addContainer('armario', x, z, { ry });
  },
  fridge(W, x, z, ry = 0) {
    W.batch.add(boxGeo(0.75, 1.8, 0.7), 'metal', { x, y: 0.9, z, ry, color: '#e8e6e0' });
    W.col.add({ type: 'circle', x, z, r: 0.45, low: true });
    return W.addContainer('geladeira', x, z, { ry });
  },
  kitchen(W, x, z, ry = 0) {
    W.batch.add(boxGeo(1.8, 0.9, 0.6), 'wood', { x, y: 0.45, z, ry, color: '#c8bca8' });
    W.batch.add(boxGeo(1.84, 0.05, 0.64), 'plain', { x, y: 0.92, z, ry, color: '#4a4a4a' });
    W.col.add({ type: 'circle', x, z, r: 0.7, low: true });
    return W.addContainer('cozinha', x, z, { ry });
  },
  shelf(W, x, z, ry = 0, type = 'prateleira', color = '#8a9098') {
    W.batch.add(boxGeo(2.2, 1.9, 0.55), 'metal', { x, y: 0.95, z, ry, color });
    // produtos coloridos nas prateleiras
    const alongX = Math.abs(Math.sin(ry)) < 0.5;
    for (let lvl = 0; lvl < 3; lvl++) for (let i = 0; i < 5; i++) {
      if (W.rnd() < 0.45) continue;
      const k = -0.85 + i * 0.42;
      const px = alongX ? x + k : x, pz = alongX ? z : z + k;
      W.batch.add(boxGeo(0.3, 0.3, 0.6), 'plain', { x: px, y: 0.35 + lvl * 0.6, z: pz, ry, color: W.rnd.pick(['#c83a2a', '#2a6ac8', '#e8c23a', '#3a9a4a', '#e8e0d0', '#8a3ac8']) });
    }
    W.col.add(alongX ? { type: 'box', x0: x - 1.1, x1: x + 1.1, z0: z - 0.3, z1: z + 0.3 } : { type: 'box', x0: x - 0.3, x1: x + 0.3, z0: z - 1.1, z1: z + 1.1 });
    return W.addContainer(type, x, z, { ry, r: 1.4 });
  },
  lockers(W, x, z, ry = 0) {
    W.batch.add(boxGeo(1.6, 1.9, 0.5), 'metal', { x, y: 0.95, z, ry, color: '#4a6a8a' });
    W.col.add({ type: 'circle', x, z, r: 0.6, low: true });
    return W.addContainer('armario_escolar', x, z, { ry });
  },
  toolbox(W, x, z, ry = 0) {
    W.batch.add(boxGeo(1.8, 0.9, 0.7), 'wood', { x, y: 0.45, z, ry, color: '#6a5a4a' });
    W.batch.add(boxGeo(0.6, 0.3, 0.35), 'metal', { x, y: 1.05, z, ry, color: '#c83a2a' });
    W.col.add({ type: 'circle', x, z, r: 0.8, low: true });
    return W.addContainer('ferramentas', x, z, { ry });
  },
  blackboard(W, x, z, ry, text) {
    const tex = T.signTex(text, { bg: '#26382c', fg: '#e8eee0', w: 512, h: 160, font: 'bold 34px "Permanent Marker", "Comic Sans MS", sans-serif', border: '#6a4a2a', grime: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.06), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    m.position.set(x, 1.6, z); m.rotation.y = ry;
    W.staticGroup.add(m);
  },
};
