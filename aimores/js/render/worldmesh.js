// Monta a cidade em 3D a partir do mapa: pisos, paredes, telhados, portas, móveis, fios e rio.
import * as THREE from '../../../lib/three.module.min.js';
import { Geo } from './geo.js';
import { buildProp, propHeight } from './propmesh.js';
import { floorAtlas, atlasUV, roofTexture, waterTexture, toonGradient, glowTexture, signTexture } from './textures.js';
import { S, F, PROPS } from '../world/tiles.js';

export const WALL_H = 2.4;
const WALL_T = 0.28;
const MURO_H = 1.75;
const CHUNK = 16;
const INTERIOR = '#f3ede0', INTERIOR_BASE = '#cfc6b4';

export class WorldView {
  constructor(scene, map, fow) {
    this.scene = scene; this.map = map; this.fow = fow;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.grad = toonGradient();
    this.matToon = fow.patch(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: this.grad }));
    this.matOutline = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
    this.matFloor = fow.patch(new THREE.MeshLambertMaterial({ map: floorAtlas().tex }));
    this.matDecal = fow.patch(new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.buildings = [];
    this.doors = new Map();
    this.glows = [];
    this.time = 0;
  }

  build() {
    this.buildFloors();
    this.buildDecals();
    this.buildStatic();
    for (const b of this.map.buildings) this.buildBuilding(b);
    for (const [i, d] of this.map.doors) this.buildDoor(i, d);
    this.buildWater();
    this.buildWires();
    this.buildLampGlows();
  }

  // ------------------------------------------------------------ pisos
  buildFloors() {
    const { map } = this;
    for (let cz = 0; cz < map.H; cz += CHUNK) for (let cx = 0; cx < map.W; cx += CHUNK) {
      const pos = [], uv = [], nor = [];
      for (let z = cz; z < Math.min(map.H, cz + CHUNK); z++) for (let x = cx; x < Math.min(map.W, cx + CHUNK); x++) {
        const i = map.idx(x, z);
        const f = map.floor[i];
        if (f === F.agua) continue;
        const a = atlasUV(f);
        // rotação/espelho aleatório nos pisos orgânicos
        let rot = 0;
        const h = ((x * 73856093) ^ (z * 19349663)) >>> 0;
        if ([F.grama, F.terra, F.asfalto, F.brita, F.areia, F.cimento, F.campo, F.canteiro].includes(f)) rot = h % 4;
        if (f === F.faixa) rot = (this.isStreet(x - 1, z) && this.isStreet(x + 1, z)) ? 0 : 1;
        if (f === F.estacionamento) rot = 0;
        const y = f === F.ponte ? 0.02 : 0;
        const corners = [[x, z + 1], [x + 1, z + 1], [x + 1, z], [x, z]];
        const uvs = [[a.u0, a.v0], [a.u1, a.v0], [a.u1, a.v1], [a.u0, a.v1]];
        for (let k = 0; k < rot; k++) uvs.push(uvs.shift());
        for (const t of [0, 1, 2, 0, 2, 3]) { pos.push(corners[t][0], y, corners[t][1]); uv.push(...uvs[t]); nor.push(0, 1, 0); }
      }
      if (!pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      const m = new THREE.Mesh(g, this.matFloor);
      m.receiveShadow = true;
      this.root.add(m);
    }
    // chão além das bordas do mapa
    const big = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), this.fow.patch(new THREE.MeshLambertMaterial({ color: '#4f7a3a' })));
    big.rotation.x = -Math.PI / 2; big.position.set(map.W / 2, -0.03, map.H / 2);
    this.root.add(big);
  }
  isStreet(x, z) { if (!this.map.inb(x, z)) return false; const f = this.map.floor[this.map.idx(x, z)]; return f === F.asfalto || f === F.faixa; }

  // ------------------------------------------------------------ faixas, trilhos, linhas de quadra
  buildDecals() {
    const g = new Geo(false);
    const Y = 0.015;
    const rect = (x0, z0, x1, z1, c) => g.quad([x0, Y, z1], [x1, Y, z1], [x1, Y, z0], [x0, Y, z0], c);
    for (const d of this.map.decals) {
      if (d.kind === 'linha') {
        const skip = v => d.skip.some(([a, b]) => v >= a - 0.5 && v <= b + 1.5);
        if (d.axis === 'x') for (let x = d.x0; x < d.x1; x += 2) { if (!skip(x)) rect(x + 0.2, d.z - 0.06, x + 1.2, d.z + 0.06, '#f2d23a'); }
        else for (let z = d.z0; z < d.z1; z += 2) { if (!skip(z)) rect(d.x - 0.06, z + 0.2, d.x + 0.06, z + 1.2, '#f2d23a'); }
      } else if (d.kind === 'quadra') {
        const c = d.cor || '#ffffff', t = 0.07;
        rect(d.x0 + 0.3, d.z0 + 0.3, d.x1 - 0.3, d.z0 + 0.3 + t, c); rect(d.x0 + 0.3, d.z1 - 0.3 - t, d.x1 - 0.3, d.z1 - 0.3, c);
        rect(d.x0 + 0.3, d.z0 + 0.3, d.x0 + 0.3 + t, d.z1 - 0.3, c); rect(d.x1 - 0.3 - t, d.z0 + 0.3, d.x1 - 0.3, d.z1 - 0.3, c);
        const mx = (d.x0 + d.x1) / 2; rect(mx - t / 2, d.z0 + 0.3, mx + t / 2, d.z1 - 0.3, c);
        const mz = (d.z0 + d.z1) / 2;
        for (let k = 0; k < 24; k++) { const a0 = k / 24 * Math.PI * 2, a1 = (k + 1) / 24 * Math.PI * 2; const r = 1.4; rect(Math.min(mx + Math.cos(a0) * r, mx + Math.cos(a1) * r) - 0.04, Math.min(mz + Math.sin(a0) * r, mz + Math.sin(a1) * r) - 0.04, Math.max(mx + Math.cos(a0) * r, mx + Math.cos(a1) * r) + 0.04, Math.max(mz + Math.sin(a0) * r, mz + Math.sin(a1) * r) + 0.04, c); }
      } else if (d.kind === 'vagas') {
        for (let x = d.x0 + 1; x <= d.x1; x += 2.5) rect(x, d.z0, x + 0.08, d.z0 + 2.2, '#e8e8e0');
      } else if (d.kind === 'trilho') {
        for (let x = d.x0; x < d.x1; x += 0.7) g.box(x + 0.35, 0, d.z, 0.26, 0.06, 1.7, '#6a4a2e', false);
        for (const dz of [-0.55, 0.55]) g.box((d.x0 + d.x1) / 2, 0.06, d.z + dz, d.x1 - d.x0, 0.09, 0.08, '#8a9098', false);
      }
    }
    const m = new THREE.Mesh(g.toGeometry(), this.matDecal);
    m.receiveShadow = true;
    this.root.add(m);
  }

  // ------------------------------------------------------------ móveis, árvores, muros (estáticos, por blocos)
  buildStatic() {
    const { map } = this;
    const chunks = new Map();
    const geoFor = (x, z) => {
      const k = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
      if (!chunks.has(k)) chunks.set(k, new Geo(true));
      return chunks.get(k);
    };
    for (const p of map.props) {
      if (p.removed || p.dynamic) continue;
      const g = geoFor(p.x, p.z);
      g.push();
      g.translate(p.x + p.w / 2, 0, p.z + p.d / 2);
      g.rotateY(p.rot * Math.PI / 2);
      buildProp(g, p);
      g.pop();
    }
    // muros, grades e cercas (trechos contínuos)
    this.buildBoundaries(geoFor);
    // coberturas (posto) e torres
    for (const c of map.canopies || []) {
      const g = geoFor(c.x0, c.z0);
      for (const [x, z] of [[c.x0 + 0.5, c.z0 + 0.5], [c.x1 + 0.5, c.z0 + 0.5], [c.x0 + 0.5, c.z1 + 0.5], [c.x1 + 0.5, c.z1 + 0.5]]) g.box(x, 0, z, 0.35, c.h, 0.35, '#e8e8e0');
      g.box((c.x0 + c.x1 + 1) / 2, c.h, (c.z0 + c.z1 + 1) / 2, c.x1 - c.x0 + 1.6, 0.35, c.z1 - c.z0 + 1.6, { side: c.trim, top: c.color, bottom: '#f4f4ec' });
    }
    for (const [k, g] of chunks) {
      if (!g.count) continue;
      const m = new THREE.Mesh(g.toGeometry(), this.matToon);
      m.castShadow = true; m.receiveShadow = true;
      this.root.add(m);
      if (g.ol.count) { const o = new THREE.Mesh(g.ol.toGeometry(), this.matOutline); this.root.add(o); }
    }
  }
  buildBoundaries(geoFor) {
    const map = this.map;
    const kinds = [S.MURO, S.GRADE, S.FENCE];
    const joins = (x, z) => { const t = map.structAt(x, z); return t === S.MURO || t === S.GRADE || t === S.FENCE || t === S.GATE; };
    const spec = {
      [S.MURO]: { h: MURO_H, t: 0.24, col: '#dcd2c2', top: '#a89a86' },
      [S.FENCE]: { h: 1.9, t: 0.08, col: '#a8b0b4', top: '#7a848a' },
      [S.GRADE]: { h: 1.6, t: 0.06, col: '#4a5a5a', top: '#4a5a5a' },
    };
    const seg = (g, kind, cx, cz, w, d, axis) => {
      const sp = spec[kind];
      if (kind === S.GRADE) {
        const L = axis === 'x' ? w : d;
        g.box(cx, sp.h - 0.08, cz, axis === 'x' ? w : 0.06, 0.06, axis === 'x' ? 0.06 : d, sp.col);
        g.box(cx, 0.08, cz, axis === 'x' ? w : 0.06, 0.06, axis === 'x' ? 0.06 : d, sp.col);
        const n = Math.max(1, Math.round(L / 0.2));
        for (let k = 0; k < n; k++) {
          const o = -L / 2 + (k + 0.5) * L / n;
          g.box(cx + (axis === 'x' ? o : 0), 0, cz + (axis === 'z' ? o : 0), 0.035, sp.h, 0.035, sp.col, false);
        }
      } else {
        g.box(cx, 0, cz, w, sp.h, d, { side: sp.col, top: sp.top });
        g.box(cx, 0, cz, w + 0.02, 0.32, d + 0.02, kind === S.MURO ? '#b8aa94' : '#8a949a', false);
      }
    };
    for (const kind of kinds) {
      const sp = spec[kind];
      for (const horiz of [true, false]) {
        const A = horiz ? map.H : map.W, Bn = horiz ? map.W : map.H;
        for (let a = 0; a < A; a++) {
          let start = null;
          for (let c = 0; c <= Bn; c++) {
            const x = horiz ? c : a, z = horiz ? a : c;
            const is = c < Bn && map.structAt(x, z) === kind;
            const conn = is && (horiz ? (joins(x - 1, z) || joins(x + 1, z)) : (joins(x, z - 1) || joins(x, z + 1)));
            if (conn && start === null) start = c;
            if (!conn && start !== null) {
              const e = c - 1;
              const ext = (xx, zz) => joins(xx, zz) ? 0.5 : sp.t / 2;
              if (horiz) {
                const x0 = start + 0.5 - ext(start - 1, a), x1 = e + 0.5 + ext(e + 1, a);
                seg(geoFor(start, a), kind, (x0 + x1) / 2, a + 0.5, x1 - x0, sp.t, 'x');
              } else {
                const z0 = start + 0.5 - ext(a, start - 1), z1 = e + 0.5 + ext(a, e + 1);
                seg(geoFor(a, start), kind, a + 0.5, (z0 + z1) / 2, sp.t, z1 - z0, 'z');
              }
              start = null;
            }
          }
        }
      }
      // pilares isolados
      for (let z = 0; z < map.H; z++) for (let x = 0; x < map.W; x++) {
        if (map.structAt(x, z) !== kind) continue;
        if (!(joins(x - 1, z) || joins(x + 1, z) || joins(x, z - 1) || joins(x, z + 1))) seg(geoFor(x, z), kind, x + 0.5, z + 0.5, sp.t, sp.t, 'x');
      }
    }
  }

  // ------------------------------------------------------------ prédios
  buildBuilding(b) {
    const { map } = this;
    const entry = this.buildings[b.id] || { b, cut: 0, cutTarget: 0, roofAlpha: 1, roofTarget: 1, seen: 0 };
    this.buildings[b.id] = entry;
    if (entry.group) { this.root.remove(entry.group); entry.group.traverse(o => o.geometry && o.geometry.dispose()); }
    const grp = new THREE.Group();
    const walls = new THREE.Group();
    grp.add(walls);
    const g = new Geo(true);
    g.olw = 0.03;
    const own = (x, z) => map.inb(x, z) && map.building[map.idx(x, z)] === b.id;
    const st = (x, z) => map.structAt(x, z);
    const isWallish = (x, z) => own(x, z) && [S.WALL, S.WINDOW, S.DOOR].includes(st(x, z));
    const indoor = (x, z) => own(x, z) && st(x, z) === S.NONE;
    const faceCol = (x, z, base) => indoor(x, z) ? (base ? INTERIOR_BASE : INTERIOR) : (base ? b.trim : b.wall);
    const colsFor = (x, z, axis, base) => {
      // cores das faces conforme o lado (dentro/fora)
      if (axis === 'x') return { pz: faceCol(x, z + 1, base), nz: faceCol(x, z - 1, base), px: faceCol(x + 1, z, base), nx: faceCol(x - 1, z, base), top: '#8a8274', bottom: '#555' };
      return { px: faceCol(x + 1, z, base), nx: faceCol(x - 1, z, base), pz: faceCol(x, z + 1, base), nz: faceCol(x, z - 1, base), top: '#8a8274', bottom: '#555' };
    };
    const BASE = 0.45;
    const wallBox = (cx, cz, w, d, x, z, axis, y0 = 0, y1 = WALL_H) => {
      if (y0 < BASE) {
        g.box(cx, y0, cz, w, Math.min(BASE, y1) - y0, d, colsFor(x, z, axis, true), false);
        if (y1 > BASE) g.box(cx, BASE, cz, w, y1 - BASE, d, colsFor(x, z, axis, false), false);
      } else g.box(cx, y0, cz, w, y1 - y0, d, colsFor(x, z, axis, false), false);
      g.ol.box(cx, y0 - 0.03, cz, w + 0.06, y1 - y0 + 0.06, d + 0.06, '#000', false);
    };
    const isWall = (x, z) => own(x, z) && st(x, z) === S.WALL;
    // trechos horizontais e verticais de parede (um bloco contínuo por trecho)
    const runs = (horiz) => {
      const out = [];
      const A0 = horiz ? b.z0 : b.x0, A1 = horiz ? b.z1 : b.x1, B0 = horiz ? b.x0 : b.z0, B1 = horiz ? b.x1 : b.z1;
      for (let a = A0; a <= A1; a++) {
        let start = null, key = null;
        const flush = (end) => { if (start !== null) out.push({ a, s: start, e: end }); start = null; key = null; };
        for (let c = B0; c <= B1 + 1; c++) {
          const x = horiz ? c : a, z = horiz ? a : c;
          const w = c <= B1 && isWall(x, z);
          const conn = w && (horiz ? (isWallish(x - 1, z) || isWallish(x + 1, z)) : (isWallish(x, z - 1) || isWallish(x, z + 1)));
          // lado de dentro/fora de cada face (quebra o trecho quando muda)
          const k = conn ? (horiz ? (indoor(x, z - 1) ? 1 : 0) + (indoor(x, z + 1) ? 2 : 0) : (indoor(x - 1, z) ? 1 : 0) + (indoor(x + 1, z) ? 2 : 0)) : null;
          if (conn && start !== null && k === key) continue;
          flush(c - 1);
          if (conn) { start = c; key = k; }
        }
      }
      return out;
    };
    const ext = (x, z) => isWallish(x, z) && !isWall(x, z) ? 0.5 : (isWall(x, z) ? 0.5 : WALL_T / 2);
    for (const r of runs(true)) {
      const z = r.a;
      const x0 = r.s + 0.5 - ext(r.s - 1, z), x1 = r.e + 0.5 + ext(r.e + 1, z);
      const mid = Math.floor((r.s + r.e) / 2);
      wallBox((x0 + x1) / 2, z + 0.5, x1 - x0, WALL_T, mid, z, 'x');
    }
    for (const r of runs(false)) {
      const x = r.a;
      const z0 = r.s + 0.5 - ext(x, r.s - 1), z1 = r.e + 0.5 + ext(x, r.e + 1);
      const mid = Math.floor((r.s + r.e) / 2);
      wallBox(x + 0.5, (z0 + z1) / 2, WALL_T, z1 - z0, x, mid, 'z');
    }
    for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) {
      if (!own(x, z)) continue;
      const s = st(x, z);
      const cx = x + 0.5, cz = z + 0.5;
      if (s === S.WALL) {
        const any = isWallish(x + 1, z) || isWallish(x - 1, z) || isWallish(x, z - 1) || isWallish(x, z + 1);
        if (!any) wallBox(cx, cz, WALL_T, WALL_T, x, z, 'x');
      } else if (s === S.WINDOW) {
        const win = map.windows.get(map.idx(x, z));
        const ax = win.axis;
        const w = ax === 'x' ? 1.0 : WALL_T, d = ax === 'x' ? WALL_T : 1.0;
        wallBox(cx, cz, w, d, x, z, ax, 0, 0.9);
        wallBox(cx, cz, w, d, x, z, ax, 1.95, WALL_H);
        const fw = ax === 'x' ? 1.0 : 0.1, fd = ax === 'x' ? 0.1 : 1.0;
        g.box(cx, 0.9, cz, fw + 0.02, 0.06, fd + 0.08, b.trim, false);
        g.box(cx, 1.89, cz, fw + 0.02, 0.06, fd + 0.08, b.trim, false);
        if (!win.broken) g.box(cx, 0.96, cz, ax === 'x' ? 0.96 : 0.05, 0.93, ax === 'x' ? 0.05 : 0.96, '#9fd4ea', false);
        else for (let k = 0; k < 3; k++) g.box(cx + (ax === 'x' ? (k - 1) * 0.3 : 0), 0.96, cz + (ax === 'z' ? (k - 1) * 0.3 : 0), ax === 'x' ? 0.12 : 0.04, 0.2 + k * 0.1, ax === 'x' ? 0.04 : 0.12, '#9fd4ea', false);
        if (!win.broken) { const c = ax === 'x' ? [0.03, 0.93, 0.08] : [0.08, 0.93, 0.03]; g.box(cx, 0.96, cz, c[0], c[1], c[2], b.trim, false); }
        if (win.barricade) this.planks(g, cx, cz, ax, 0.95, 1.85);
      } else if (s === S.DOOR) {
        const d0 = map.doors.get(map.idx(x, z));
        const ax = d0.axis;
        const w = ax === 'x' ? 1.0 : WALL_T, d = ax === 'x' ? WALL_T : 1.0;
        wallBox(cx, cz, w, d, x, z, ax, 2.1, WALL_H);
        const jw = ax === 'x' ? 0.08 : WALL_T + 0.04, jd = ax === 'x' ? WALL_T + 0.04 : 0.08;
        g.box(cx + (ax === 'x' ? -0.48 : 0), 0, cz + (ax === 'z' ? -0.48 : 0), jw, 2.1, jd, b.trim, false);
        g.box(cx + (ax === 'x' ? 0.48 : 0), 0, cz + (ax === 'z' ? 0.48 : 0), jw, 2.1, jd, b.trim, false);
      }
    }
    // placa na fachada
    const wm = new THREE.Mesh(g.toGeometry(), this.matToon);
    wm.castShadow = true; wm.receiveShadow = true;
    walls.add(wm);
    walls.add(new THREE.Mesh(g.ol.toGeometry(), this.matOutline));
    entry.walls = walls;
    // telhado
    const roof = this.buildRoof(b);
    grp.add(roof.group);
    entry.roof = roof;
    this.root.add(grp);
    entry.group = grp;
    walls.scale.y = 1 - entry.cut * 0.78;
    return entry;
  }
  planks(g, cx, cz, ax, y0, y1) {
    for (let k = 0; k < 3; k++) {
      const y = y0 + (y1 - y0) * (0.15 + k * 0.33);
      g.push(); g.translate(cx, y, cz); g.rotateY(ax === 'x' ? 0 : Math.PI / 2); g.rotateZ((k - 1) * 0.25);
      g.box(0, 0, 0.18, 1.1, 0.16, 0.05, '#a8773f'); g.pop();
    }
  }
  buildRoof(b) {
    const group = new THREE.Group();
    const kind = b.roof;
    const tex = roofTexture(kind);
    const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: this.grad, transparent: true, opacity: 1 });
    const matEnd = new THREE.MeshToonMaterial({ color: b.wall, gradientMap: this.grad, transparent: true, opacity: 1 });
    const matOl = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 1 });
    const mats = [mat, matEnd, matOl];
    const y = WALL_H;
    const addMesh = (geo, m) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh; };
    const single = b.rects.length === 1;
    for (const r of b.rects) {
      const x0 = r.x0 + 0.5 - WALL_T / 2 - 0.25, x1 = r.x1 + 0.5 + WALL_T / 2 + 0.25;
      const z0 = r.z0 + 0.5 - WALL_T / 2 - 0.25, z1 = r.z1 + 0.5 + WALL_T / 2 + 0.25;
      const w = x1 - x0, d = z1 - z0;
      if ((kind === 'telha' || kind === 'metal') && single) {
        const alongX = w >= d;
        const h = kind === 'telha' ? Math.min(1.7, (alongX ? d : w) * 0.28) : 0.6;
        const pos = [], uv = [], idx = [];
        const push = (p, t) => { pos.push(...p); uv.push(...t); };
        const L = alongX ? w : d, Wd = alongX ? d : w;
        const rep = [L / 2.2, Wd / 4];
        if (alongX) {
          const zm = (z0 + z1) / 2;
          push([x0, y, z1], [0, 0]); push([x1, y, z1], [rep[0], 0]); push([x1, y + h, zm], [rep[0], rep[1]]); push([x0, y + h, zm], [0, rep[1]]);
          push([x1, y, z0], [0, 0]); push([x0, y, z0], [rep[0], 0]); push([x0, y + h, zm], [rep[0], rep[1]]); push([x1, y + h, zm], [0, rep[1]]);
        } else {
          const xm = (x0 + x1) / 2;
          push([x1, y, z1], [0, 0]); push([x1, y, z0], [rep[0], 0]); push([xm, y + h, z0], [rep[0], rep[1]]); push([xm, y + h, z1], [0, rep[1]]);
          push([x0, y, z0], [0, 0]); push([x0, y, z1], [rep[0], 0]); push([xm, y + h, z1], [rep[0], rep[1]]); push([xm, y + h, z0], [0, rep[1]]);
        }
        idx.push(0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx); geo.computeVertexNormals();
        addMesh(geo, mat);
        // oitões
        const eg = new Geo(true);
        if (alongX) eg.gable((x0 + x1) / 2, y, (z0 + z1) / 2, w - 0.5, h - 0.05, d - 0.5, b.wall, b.wall);
        else { eg.push(); eg.translate((x0 + x1) / 2, 0, (z0 + z1) / 2); eg.rotateY(Math.PI / 2); eg.gable(0, y, 0, d - 0.5, h - 0.05, w - 0.5, b.wall, b.wall); eg.pop(); }
        addMesh(eg.toGeometry(), new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: this.grad, transparent: true }));
        mats.push(group.children[group.children.length - 1].material);
        const ol = new THREE.Mesh(eg.ol.toGeometry(), matOl); group.add(ol);
        // caixa d'água em algumas casas
        if (b.type === 'casa' && (b.id % 2 === 0)) {
          const cg = new Geo(true);
          cg.cyl(alongX ? x0 + w * 0.3 : (x0 + x1) / 2, y + h * 0.4, alongX ? (z0 + z1) / 2 : z0 + d * 0.3, 0.45, 0.8, 10, '#3a7ad8', 0.5, '#2a5ab0');
          const cm = addMesh(cg.toGeometry(), new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: this.grad, transparent: true }));
          mats.push(cm.material); group.add(new THREE.Mesh(cg.ol.toGeometry(), matOl));
        }
      } else {
        // laje com mureta
        const geo = new THREE.BoxGeometry(w, 0.18, d);
        const uvA = geo.attributes.uv;
        for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * w / 3, uvA.getY(i) * d / 3);
        const m = addMesh(geo, kind === 'metal' ? mat : mat);
        m.position.set((x0 + x1) / 2, y + 0.09, (z0 + z1) / 2);
        const pg = new Geo(true);
        const pc = b.wall;
        pg.box((x0 + x1) / 2, y, z0 + 0.08, w, 0.5, 0.16, { side: pc, top: b.trim });
        pg.box((x0 + x1) / 2, y, z1 - 0.08, w, 0.5, 0.16, { side: pc, top: b.trim });
        pg.box(x0 + 0.08, y, (z0 + z1) / 2, 0.16, 0.5, d, { side: pc, top: b.trim });
        pg.box(x1 - 0.08, y, (z0 + z1) / 2, 0.16, 0.5, d, { side: pc, top: b.trim });
        if (b.type !== 'escola' || r === b.rects[0]) {
          const tx = x0 + 1.3, tz = z0 + 1.3;
          if (w > 3 && d > 3) pg.cyl(tx, y + 0.18, tz, 0.5, 0.85, 10, '#3a7ad8', 0.55, '#2a5ab0');
        }
        const pm = addMesh(pg.toGeometry(), new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: this.grad, transparent: true }));
        mats.push(pm.material);
        group.add(new THREE.Mesh(pg.ol.toGeometry(), matOl));
      }
    }
    // letreiro da fachada
    const signText = { mercado: 'SUPERMERCADO BOM PREÇO', farmacia: 'FARMÁCIA', escola: 'E.E. RIO DOCE', igreja: null, oficina: 'OFICINA DO VALDIR', posto: null, eletronicos: 'ELETRÔNICOS', roupas: 'MODA RIO DOCE', restaurante: 'SABOR DE MINAS', mercadinho: 'MERCADINHO DO ZÉ', ferramentas: 'FERRAMENTAS', bar: 'BAR DO TIÃO', radio: 'RÁDIO AIMORÉS FM', agronova: 'AGRONOVA', estacao: 'ESTAÇÃO AIMORÉS' }[b.type];
    if (signText) {
      const door = b.doors.map(i => this.map.doors.get(i)).find(d => d.entrance);
      if (door) {
        const colors = { farmacia: ['#2aa84a', '#fff'], mercado: ['#d8413a', '#fff'], agronova: ['#4caf50', '#fff'], escola: ['#2a6ab0', '#fff'], bar: ['#f2e04a', '#2a2a2a'], radio: ['#d8413a', '#fff'] }[b.type] || [b.trim, '#fff'];
        const tex = signTexture(signText, colors[0], colors[1]);
        const sm = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        mats.push(sm);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), sm);
        // lado de fora da porta
        const ox = door.x + 0.5, oz = door.z + 0.5;
        let nx = 0, nz = 0;
        if (door.axis === 'x') nz = this.map.building[this.map.idx(door.x, door.z + 1)] === b.id ? -1 : 1;
        else nx = this.map.building[this.map.idx(door.x + 1, door.z)] === b.id ? -1 : 1;
        sign.position.set(ox + nx * 0.2, WALL_H + 0.35, oz + nz * 0.2);
        sign.rotation.y = Math.atan2(nx, nz);
        group.add(sign);
      }
    }
    // torres (campanário)
    for (const t of this.map.towers) {
      if (t.building !== b.id) continue;
      const tg = new Geo(true);
      tg.box(t.x, 0, t.z, 2.4, t.h, 2.4, { side: b.wall, top: b.trim });
      tg.box(t.x, t.h - 2.2, t.z, 2.5, 1.4, 2.5, { side: '#3a3a40', top: b.trim }, false);
      tg.box(t.x, t.h - 0.8, t.z, 2.6, 0.25, 2.6, b.trim);
      tg.cyl(t.x, t.h - 0.55, t.z, 1.6, 2.2, 4, '#c8663a', 0.05);
      tg.box(t.x, t.h + 1.6, t.z, 0.1, 1.0, 0.1, '#d8a83a'); tg.box(t.x, t.h + 2.2, t.z, 0.5, 0.1, 0.1, '#d8a83a');
      const tm = addMesh(tg.toGeometry(), new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: this.grad, transparent: true }));
      mats.push(tm.material); group.add(new THREE.Mesh(tg.ol.toGeometry(), matOl));
    }
    return { group, mats };
  }

  // ------------------------------------------------------------ portas
  buildDoor(i, d) {
    const map = this.map;
    const old = this.doors.get(i);
    if (old) this.root.remove(old.group);
    const b = d.building >= 0 ? map.buildings[d.building] : null;
    const group = new THREE.Group();
    const pivot = new THREE.Group();
    group.add(pivot);
    const g = new Geo(true);
    g.olw = 0.025;
    if (d.gate) {
      const h = 1.65;
      g.box(0.5, 0, 0, 1.0, 0.08, 0.06, '#3a4a4a'); g.box(0.5, h - 0.08, 0, 1.0, 0.08, 0.06, '#3a4a4a');
      for (let k = 0; k < 6; k++) g.box(0.08 + k * 0.17, 0, 0, 0.05, h, 0.05, '#4a5a5a', false);
      if (d.locked) g.box(0.95, 0.9, 0.05, 0.14, 0.18, 0.08, '#e8c23a');
    } else {
      const col = d.entrance ? (b ? b.trim : '#8a5a2a') : '#9a6a3a';
      g.box(0.46, 0, 0, 0.9, 2.05, 0.07, col);
      g.box(0.8, 1.0, 0.05, 0.06, 0.06, 0.08, '#e8c23a', false);
      g.box(0.8, 1.0, -0.05, 0.06, 0.06, 0.08, '#e8c23a', false);
      if (d.locked) g.box(0.8, 1.2, 0.06, 0.1, 0.14, 0.05, '#d83a2a', false);
    }
    if (d.barricade) for (let k = 0; k < Math.min(3, d.barricade + 1); k++) { g.push(); g.translate(0.5, 0.4 + k * 0.55, 0.1); g.rotateZ((k - 1) * 0.3); g.box(0, 0, 0, 1.2, 0.18, 0.05, '#a8773f'); g.pop(); }
    const m = new THREE.Mesh(g.toGeometry(), this.matToon);
    m.castShadow = true;
    pivot.add(m);
    pivot.add(new THREE.Mesh(g.ol.toGeometry(), this.matOutline));
    // posição: dobradiça na borda da célula
    if (d.axis === 'x') { group.position.set(d.x, 0, d.z + 0.5); group.rotation.y = 0; }
    else { group.position.set(d.x + 0.5, 0, d.z + 1); group.rotation.y = Math.PI / 2; }
    const entry = { group, pivot, d, angle: d.open ? -Math.PI / 2 * 0.95 : 0 };
    pivot.rotation.y = entry.angle;
    this.doors.set(i, entry);
    this.root.add(group);
    if (b) { const be = this.buildings[b.id]; if (be) { be.doorGroups ||= []; be.doorGroups.push(group); } }
  }
  refreshDoor(i) { const d = this.map.doors.get(i); if (d) this.buildDoor(i, d); }

  // ------------------------------------------------------------ rio, fios e lâmpadas
  buildWater() {
    const tex = waterTexture();
    tex.repeat.set(40, 10);
    this.waterTex = tex;
    const mat = this.fow.patch(new THREE.MeshLambertMaterial({ map: tex, color: '#ffffff', transparent: true, opacity: 0.94 }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(this.map.W + 80, 40), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(this.map.W / 2, -0.06, 92 + 20);
    m.receiveShadow = true;
    this.root.add(m);
    // barranco
    const bank = new THREE.Mesh(new THREE.PlaneGeometry(this.map.W + 80, 60), this.fow.patch(new THREE.MeshLambertMaterial({ color: '#3a5a6a' })));
    bank.rotation.x = -Math.PI / 2; bank.position.set(this.map.W / 2, -0.4, 120);
    this.root.add(bank);
    // pilares da ponte
    const g = new Geo(true);
    for (let z = 93; z < 104; z += 4) g.box(103.5, -3, z, 2.2, 3, 0.8, '#8a8884');
    g.box(103.5, -0.02, 97, 5.2, 0.05, 14.5, '#7a7874', false);
    const pm = new THREE.Mesh(g.toGeometry(), this.matToon); this.root.add(pm);
    this.root.add(new THREE.Mesh(g.ol.toGeometry(), this.matOutline));
  }
  buildWires() {
    const pts = [];
    for (const [x0, z0, x1, z1] of this.map.wires || []) {
      for (const off of [-0.55, 0.55]) {
        const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
        const nx = -dz / L * off, nz = dx / L * off;
        const N = 8;
        for (let k = 0; k < N; k++) {
          const t0 = k / N, t1 = (k + 1) / N;
          const sag = t => 4.75 - Math.sin(t * Math.PI) * 0.45;
          pts.push(x0 + dx * t0 + nx, sag(t0), z0 + dz * t0 + nz, x0 + dx * t1 + nx, sag(t1), z0 + dz * t1 + nz);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = this.fow.patch(new THREE.LineBasicMaterial({ color: '#1e1e22' }));
    this.root.add(new THREE.LineSegments(geo, mat));
  }
  buildLampGlows() {
    const tex = glowTexture();
    for (const L of this.map.lights) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: L.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
      const s = new THREE.Sprite(mat);
      const y = L.kind === 'poste' ? 4.15 : L.kind === 'antena' ? 15.8 : 1.5;
      const lz = L.kind === 'poste' ? L.z + 0.4 : L.z;
      s.position.set(L.x, y, lz);
      const sc = L.kind === 'poste' ? 2.2 : L.kind === 'antena' ? 1.6 : 3;
      s.scale.set(sc, sc, 1);
      s.userData.L = L;
      this.root.add(s);
      this.glows.push(s);
    }
  }

  // ------------------------------------------------------------ atualização por quadro
  update(dt, night, state) {
    this.time += dt;
    if (this.waterTex) { this.waterTex.offset.x += dt * 0.012; this.waterTex.offset.y += dt * 0.004; }
    for (const [, e] of this.doors) {
      const target = e.d.open ? -Math.PI / 2 * 0.95 : 0;
      if (Math.abs(e.angle - target) > 0.001) { e.angle += (target - e.angle) * Math.min(1, dt * 10); e.pivot.rotation.y = e.angle; }
    }
    for (const e of this.buildings) {
      if (!e) continue;
      e.cut += (e.cutTarget - e.cut) * Math.min(1, dt * 8);
      const sy = 1 - e.cut * 0.8;
      if (e.walls) e.walls.scale.y = sy;
      if (e.doorGroups) for (const dg of e.doorGroups) dg.scale.y = sy;
      e.roofAlpha += (e.roofTarget - e.roofAlpha) * Math.min(1, dt * 8);
      const vis = e.seen;
      const shadeC = vis >= 2 ? 1 : vis === 1 ? 0.38 : 0;
      for (const m of e.roof.mats) {
        m.opacity = e.roofAlpha;
        m.depthWrite = e.roofAlpha > 0.98;
        if (m.color && !m.userData.base) m.userData.base = m.color.clone();
        if (m.color && m.userData.base) m.color.copy(m.userData.base).multiplyScalar(shadeC);
      }
      e.roof.group.visible = e.roofAlpha > 0.02 && vis > 0;
    }
    for (const s of this.glows) {
      const L = s.userData.L;
      let o = night * (L.flicker ? (Math.sin(this.time * 23 + L.x) > -0.7 ? 0.9 : 0.1) : 0.9);
      if (L.off) o = 0;
      s.material.opacity = o;
    }
  }
  // altura do que ocupa uma célula (para clicar no que se vê)
  heightAt(x, z) {
    const map = this.map;
    if (!map.inb(x, z)) return 0;
    const i = map.idx(x, z);
    const s = map.struct[i];
    if (s === S.WALL || s === S.WINDOW) { const b = this.buildings[map.building[i]]; return WALL_H * (b ? 1 - b.cut * 0.8 : 1); }
    if (s === S.DOOR) { const d = map.doors.get(i); return d.open ? 0.2 : 2.0; }
    if (s === S.MURO) return MURO_H;
    if (s === S.GRADE || s === S.FENCE || s === S.GATE) return 1.5;
    const p = map.propAt[i];
    if (p >= 0) return Math.min(2.2, propHeight(map.props[p].type));
    return 0;
  }
}
