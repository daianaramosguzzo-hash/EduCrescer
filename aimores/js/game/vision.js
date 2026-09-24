// Linha de visão, campo de visão (sombra recursiva) e iluminação por célula.

// linha de visão entre centros de células (Bresenham); ignora as pontas
export function los(map, x0, z0, x1, z1, opaqueFn) {
  const op = opaqueFn || ((x, z) => map.opaque(x, z));
  let dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
  let err = dx - dz;
  let x = x0, z = z0;
  while (!(x === x1 && z === z1)) {
    const e2 = err * 2;
    let nx = x, nz = z;
    if (e2 > -dz) { err -= dz; nx += sx; }
    if (e2 < dx) { err += dx; nz += sz; }
    // passo diagonal entre duas quinas fechadas bloqueia
    if (nx !== x && nz !== z && op(nx, z) && op(x, nz)) return false;
    x = nx; z = nz;
    if (x === x1 && z === z1) break;
    if (op(x, z)) return false;
  }
  return true;
}
// células ao longo da linha (sem a origem)
export function lineCells(x0, z0, x1, z1) {
  const out = [];
  let dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
  let err = dx - dz, x = x0, z = z0;
  while (!(x === x1 && z === z1)) {
    const e2 = err * 2;
    if (e2 > -dz) { err -= dz; x += sx; }
    if (e2 < dx) { err += dx; z += sz; }
    out.push([x, z]);
  }
  return out;
}

// campo de visão por sombra recursiva: devolve Set de índices visíveis
const OCT = [[1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 0], [-1, 0, 0, 1], [-1, 0, 0, -1], [0, -1, -1, 0], [0, 1, -1, 0], [1, 0, 0, -1]];
export function fov(map, ox, oz, radius, out = new Set()) {
  out.add(map.idx(ox, oz));
  const r2 = radius * radius;
  for (const [xx, xy, yx, yy] of OCT) cast(map, ox, oz, 1, 1.0, 0.0, radius, r2, xx, xy, yx, yy, out);
  return out;
}
function cast(map, cx, cz, row, start, end, radius, r2, xx, xy, yx, yy, out) {
  if (start < end) return;
  let newStart = 0;
  for (let j = row; j <= radius; j++) {
    let dx = -j - 1;
    const dy = -j;
    let blocked = false;
    while (dx <= 0) {
      dx++;
      const X = cx + dx * xx + dy * xy, Z = cz + dx * yx + dy * yy;
      const lSlope = (dx - 0.5) / (dy + 0.5), rSlope = (dx + 0.5) / (dy - 0.5);
      if (start < rSlope) continue;
      if (end > lSlope) break;
      if (dx * dx + dy * dy < r2 && map.inb(X, Z)) out.add(map.idx(X, Z));
      const op = map.opaque(X, Z);
      if (blocked) {
        if (op) { newStart = rSlope; continue; }
        blocked = false; start = newStart;
      } else if (op && j < radius) {
        blocked = true;
        cast(map, cx, cz, j + 1, start, lSlope, radius, r2, xx, xy, yx, yy, out);
        newStart = rSlope;
      }
    }
    if (blocked) break;
  }
}

// luz fixa do mapa (postes acesos, holofote, velas), com sombra das paredes
export function computeStaticLight(map, extra = []) {
  map.lit.fill(0);
  for (const L of [...map.lights, ...extra]) {
    if (L.off) continue;
    const lx = Math.floor(L.x), lz = Math.floor(L.z);
    if (!map.inb(lx, lz)) continue;
    const vis = fov(map, lx, lz, Math.ceil(L.r));
    for (const i of vis) {
      const x = i % map.W, z = (i / map.W) | 0;
      const d = Math.hypot(x + 0.5 - L.x, z + 0.5 - L.z);
      if (d > L.r) continue;
      const v = (1 - d / L.r) * (L.i || 1) * 1.3;
      if (v > map.lit[i]) map.lit[i] = Math.min(1, v);
    }
  }
}
