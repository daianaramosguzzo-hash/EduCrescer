// Construtor de geometria mesclada com cores por vértice e contorno (casco invertido).
import * as THREE from '../../../lib/three.module.min.js';

const tmpV = new THREE.Vector3();
const tmpN = new THREE.Vector3();
const colorCache = new Map();
function col(c) {
  if (c instanceof THREE.Color) return c;
  let v = colorCache.get(c);
  if (!v) { v = new THREE.Color(c); colorCache.set(c, v); }
  return v;
}

export class Geo {
  constructor(withOutline = true) {
    this.pos = []; this.nor = []; this.col = [];
    this.m = new THREE.Matrix4();
    this.nm = new THREE.Matrix3();
    this.stack = [];
    this.ol = withOutline ? new Geo(false) : null;
    this.olw = 0.035;
  }
  get count() { return this.pos.length / 3; }
  push() { this.stack.push(this.m.clone()); if (this.ol) this.ol.push(); return this; }
  pop() { this.m.copy(this.stack.pop()); this.nm.getNormalMatrix(this.m); if (this.ol) this.ol.pop(); return this; }
  translate(x, y, z) { this.m.multiply(new THREE.Matrix4().makeTranslation(x, y, z)); this.nm.getNormalMatrix(this.m); if (this.ol) this.ol.translate(x, y, z); return this; }
  rotateY(a) { this.m.multiply(new THREE.Matrix4().makeRotationY(a)); this.nm.getNormalMatrix(this.m); if (this.ol) this.ol.rotateY(a); return this; }
  rotateX(a) { this.m.multiply(new THREE.Matrix4().makeRotationX(a)); this.nm.getNormalMatrix(this.m); if (this.ol) this.ol.rotateX(a); return this; }
  rotateZ(a) { this.m.multiply(new THREE.Matrix4().makeRotationZ(a)); this.nm.getNormalMatrix(this.m); if (this.ol) this.ol.rotateZ(a); return this; }
  scale(x, y, z) { this.m.multiply(new THREE.Matrix4().makeScale(x, y, z)); this.nm.getNormalMatrix(this.m); if (this.ol) this.ol.scale(x, y, z); return this; }

  vert(x, y, z, nx, ny, nz, c) {
    tmpV.set(x, y, z).applyMatrix4(this.m);
    tmpN.set(nx, ny, nz).applyMatrix3(this.nm).normalize();
    this.pos.push(tmpV.x, tmpV.y, tmpV.z);
    this.nor.push(tmpN.x, tmpN.y, tmpN.z);
    const cc = col(c);
    this.col.push(cc.r, cc.g, cc.b);
  }
  tri(a, b, c, color) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    this.vert(a[0], a[1], a[2], nx, ny, nz, color);
    this.vert(b[0], b[1], b[2], nx, ny, nz, color);
    this.vert(c[0], c[1], c[2], nx, ny, nz, color);
  }
  quad(a, b, c, d, color) { this.tri(a, b, c, color); this.tri(a, c, d, color); }

  // caixa: base centrada em (cx, y0, cz). colors: string ou {top, bottom, side, px, nx, pz, nz}
  box(cx, y0, cz, w, h, d, colors, outline = true) {
    const c = typeof colors === 'object' && !(colors instanceof THREE.Color) ? colors : { side: colors, top: colors, bottom: colors };
    const side = c.side || c.top;
    const x0 = cx - w / 2, x1 = cx + w / 2, y1 = y0 + h, z0 = cz - d / 2, z1 = cz + d / 2;
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], c.px || side);  // leste
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], c.nx || side);  // oeste
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], c.top || side); // topo
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], c.bottom || side);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], c.pz || side);  // sul
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], c.nz || side);  // norte
    if (outline && this.ol) { const t = this.olw; this.ol.box(cx, y0 - t, cz, w + t * 2, h + t * 2, d + t * 2, '#000000', false); }
    return this;
  }
  // cilindro (ou tronco de cone) vertical
  cyl(cx, y0, cz, r, h, seg, color, rTop = r, colorTop = color, outline = true) {
    const y1 = y0 + h;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r];
      const q0 = [cx + Math.cos(a0) * rTop, y1, cz + Math.sin(a0) * rTop], q1 = [cx + Math.cos(a1) * rTop, y1, cz + Math.sin(a1) * rTop];
      this.quad(p1, p0, q0, q1, color);
      if (rTop > 0.001) this.tri([cx, y1, cz], q1, q0, colorTop);
      this.tri([cx, y0, cz], p0, p1, color);
    }
    if (outline && this.ol) { const t = this.olw; this.ol.cyl(cx, y0 - t, cz, r + t, h + t * 2, seg, '#000000', rTop > 0.001 ? rTop + t : 0, '#000000', false); }
    return this;
  }
  // esfera achatada de baixo polígono
  blob(cx, cy, cz, rx, ry, rz, color, detail = 1, outline = true, jitter = 0, seed = 1) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const map = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3);
      if (!map.has(key)) map.set(key, 1 + (rnd() - 0.5) * jitter);
      const k = map.get(key);
      p.setXYZ(i, cx + p.getX(i) * rx * k, cy + p.getY(i) * ry * k, cz + p.getZ(i) * rz * k);
    }
    for (let i = 0; i < p.count; i += 3) {
      this.tri([p.getX(i), p.getY(i), p.getZ(i)], [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)], [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)], color);
    }
    g.dispose();
    if (outline && this.ol) { const t = this.olw; this.ol.blob(cx, cy, cz, rx + t, ry + t, rz + t, '#000000', detail, false, jitter, seed); }
    return this;
  }
  // prisma triangular (telhado de duas águas) ao longo de x
  gable(cx, y0, cz, w, h, d, colorSide, colorEnd, outline = true) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, cz], [x0, y1, cz], colorSide);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, cz], [x1, y1, cz], colorSide);
    this.tri([x1, y0, z1], [x1, y0, z0], [x1, y1, cz], colorEnd);
    this.tri([x0, y0, z0], [x0, y0, z1], [x0, y1, cz], colorEnd);
    if (outline && this.ol) { const t = this.olw; this.ol.gable(cx, y0 - t, cz, w + 2 * t, h + 2 * t, d + 2 * t, '#000000', '#000000', false); }
    return this;
  }
  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}
