// Geometria estática agrupada: milhares de peças (paredes, carros, cercas...)
// viram poucas malhas, juntando tudo que usa o mesmo material em cada pedaço
// do mapa. Também guarda os materiais e funções para montar peças com UV em metros.
import * as THREE from '../../lib/three.module.min.js';
import { mergeGeometries } from '../../lib/addons/BufferGeometryUtils.js';
import * as T from '../core/textures.js';

// "Raio-x": o que fica entre a câmera e o jogador (copas, paredes, telhados)
// é recortado num padrão pontilhado para o personagem nunca sumir de vista.
export const XRAY = { value: new THREE.Vector3(0, -100, 0) };
export function applyXray(m) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uXray = XRAY;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vXrayPos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 xw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          xw = instanceMatrix * xw;
        #endif
        vXrayPos = (modelMatrix * xw).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vXrayPos;\nuniform vec3 uXray;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          vec3 A = uXray + vec3(0.0, 0.9, 0.0);
          vec3 AB = cameraPosition - A;
          float t = dot(vXrayPos - A, AB) / dot(AB, AB);
          if (t > 0.0 && vXrayPos.y > 0.55) {
            float d = length(A + AB * t - vXrayPos);
            float k = 1.0 - smoothstep(0.8, 1.8, d);
            vec2 f = mod(floor(gl_FragCoord.xy), 4.0);
            float bayer = mod(f.x * 2.0 + f.y * 3.0 + floor(f.x * 0.5) * 5.0, 8.0) / 8.0;
            if (k * 0.92 > bayer) discard;
          }
        }`);
  };
  m.customProgramCacheKey = () => 'xray' + (prev ? '1' : '0');
  return m;
}

let MATS = null;
export function materials() {
  if (MATS) return MATS;
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...o });
  MATS = {
    plain: std({}),
    plaster: std({ map: T.plasterTex() }),
    brick: std({ map: T.brickTex() }),
    concrete: std({ map: T.concreteTex(), roughness: 0.95 }),
    wood: std({ map: T.woodTex() }),
    metal: std({ map: T.metalTex(), roughness: 0.55, metalness: 0.35 }),
    roof: std({ map: T.roofTex() }),
    foliage: std({ map: T.foliageTex(), roughness: 0.9 }),
    asphalt: std({ map: T.asphaltTex(), roughness: 0.95 }),
    paint: std({ roughness: 0.45, metalness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: '#2a3a44', roughness: 0.12, metalness: 0.6, vertexColors: true }),
    tape: std({ map: T.tapeTex(), side: THREE.DoubleSide }),
    blood: new THREE.MeshStandardMaterial({ map: T.bloodTex(), transparent: true, depthWrite: false, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }),
    debris: new THREE.MeshStandardMaterial({ map: T.debrisTex(), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }),
  };
  for (const k of ['plain', 'plaster', 'brick', 'concrete', 'wood', 'metal', 'roof', 'foliage', 'paint', 'glass']) applyXray(MATS[k]);
  return MATS;
}

// ---- geometrias com UV proporcional ao tamanho (textura repete a cada `tile` metros) ----
export function boxGeo(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // ordem das faces: +x, -x, +y, -y, +z, -z (4 vértices cada)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
  return g;
}
export function cylGeo(r1, r2, h, seg = 10, tile = 2) {
  const g = new THREE.CylinderGeometry(r1, r2, h, seg);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (Math.PI * 2 * Math.max(r1, r2)) / tile, uv.getY(i) * h / tile);
  return g;
}

const _c = new THREE.Color();
function colorize(g, color, vary = 0) {
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) {
    const k = vary ? 1 + (((i * 2654435761) >>> 0) % 1000 / 1000 - 0.5) * vary : 1;
    arr[i * 3] = _c.r * k; arr[i * 3 + 1] = _c.g * k; arr[i * 3 + 2] = _c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

// Junta peças por material e por pedaço do mapa
export class Batch {
  constructor(chunk = 55) { this.chunk = chunk; this.groups = new Map(); }
  // g: geometria (vai ser modificada) · mat: nome do material · pos/rot/scale · color
  add(g, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, color = '#ffffff', vary = 0, shadow = true, receive = true } = {}) {
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    colorize(g, color, vary);
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
    g.applyMatrix4(_m.compose(_p, _q, _s));
    const cx = Math.floor(x / this.chunk), cz = Math.floor(z / this.chunk);
    const key = `${typeof mat === 'string' ? mat : mat.uuid}|${cx}|${cz}|${shadow ? 1 : 0}`;
    let e = this.groups.get(key);
    if (!e) this.groups.set(key, e = { mat, geos: [], shadow, receive });
    e.geos.push(g);
  }
  // cria as malhas finais dentro de `parent`
  build(parent) {
    const M = materials();
    const meshes = [];
    for (const e of this.groups.values()) {
      const merged = mergeGeometries(e.geos.map(g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k); return g; }), false);
      for (const g of e.geos) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, typeof e.mat === 'string' ? M[e.mat] : e.mat);
      mesh.castShadow = e.shadow; mesh.receiveShadow = e.receive;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.groups.clear();
    return meshes;
  }
}
