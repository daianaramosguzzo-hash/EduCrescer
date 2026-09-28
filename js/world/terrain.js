// Chão do mapa: relevo (margem do rio, lagoa), mistura de texturas pintada num
// "mapa de mistura" (grama, terra, asfalto, areia) e a água.
import * as THREE from '../../lib/three.module.min.js';
import * as T from '../core/textures.js';
import { makeNoise, clamp, smooth } from '../core/util.js';

export const EXTENT = 170;         // a pintura cobre [-170, 170]
const GROUND = 420;                // o chão vai além do mapa (borda de mata)
export const WATER_Y = -0.55;
export const RIVER_Z = 124;        // começo da água do Rio Doce
export const POND = { x: -112, z: -118, r: 11 }; // lagoa da mata

const noise = makeNoise(99);

// altura do chão
export function heightAt(x, z) {
  let h = 0;
  // margem do rio: desce até o leito
  const bank = smooth(RIVER_Z - 8, RIVER_Z + 6, z);
  h -= bank * 1.6;
  // lagoa
  const dp = Math.hypot(x - POND.x, z - POND.z);
  h -= (1 - smooth(POND.r - 3, POND.r + 3, dp)) * 1.4;
  // ondulação suave fora da cidade
  const wild = (x < -60 && z < -40) || (x > 60 && z < -60) || (x > 60 && z > 60) || Math.abs(x) > EXTENT - 8 || Math.abs(z) > EXTENT - 8;
  if (wild) h += (noise.fbm(x * 0.03, z * 0.03, 3) - 0.5) * 1.2 * (1 - bank);
  // morros fora dos limites do mapa
  const out = Math.max(Math.abs(x), Math.abs(z)) - EXTENT;
  if (out > 0 && z < RIVER_Z) h += Math.min(out * 0.25, 6) * (0.6 + noise(x * 0.05, z * 0.05) * 0.8);
  return h;
}
export const isWater = (x, z) => heightAt(x, z) < WATER_Y - 0.05;
export const isDeepWater = (x, z) => heightAt(x, z) < WATER_Y - 0.55;

// Pintura do mapa de mistura. Cores: grama (255,0,0) terra (0,255,0) asfalto (0,0,255) areia (0,0,0)
export class Splat {
  constructor(size = 1024) {
    this.size = size;
    this.c = document.createElement('canvas'); this.c.width = this.c.height = size;
    this.ctx = this.c.getContext('2d');
    this.ctx.fillStyle = 'rgb(255,0,0)'; this.ctx.fillRect(0, 0, size, size);
    this.k = size / (EXTENT * 2);
  }
  px(x) { return (x + EXTENT) * this.k; }
  style(type, a = 1) { return { grass: `rgba(255,0,0,${a})`, dirt: `rgba(0,255,0,${a})`, road: `rgba(0,0,255,${a})`, sand: `rgba(0,0,0,${a})`, mud: `rgba(60,160,0,${a})` }[type]; }
  rect(x0, z0, x1, z1, type, a = 1) { const c = this.ctx; c.fillStyle = this.style(type, a); c.fillRect(this.px(x0), this.px(z0), (x1 - x0) * this.k, (z1 - z0) * this.k); }
  circle(x, z, r, type, a = 1) { const c = this.ctx; c.fillStyle = this.style(type, a); c.beginPath(); c.arc(this.px(x), this.px(z), r * this.k, 0, 7); c.fill(); }
  line(pts, w, type, a = 1) {
    const c = this.ctx; c.strokeStyle = this.style(type, a); c.lineWidth = w * this.k; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); pts.forEach(([x, z], i) => i ? c.lineTo(this.px(x), this.px(z)) : c.moveTo(this.px(x), this.px(z))); c.stroke();
  }
  // manchas irregulares
  blotches(x0, z0, x1, z1, type, n, rmin, rmax, a, rnd) {
    for (let i = 0; i < n; i++) this.circle(x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0), rmin + rnd() * (rmax - rmin), type, a * (0.4 + rnd() * 0.6));
  }
  finish() {
    // suaviza as bordas
    const b = document.createElement('canvas'); b.width = b.height = this.size;
    const bc = b.getContext('2d'); bc.filter = 'blur(1.5px)'; bc.drawImage(this.c, 0, 0);
    const tex = new THREE.CanvasTexture(b);
    tex.colorSpace = THREE.NoColorSpace; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.flipY = true;
    this.texture = tex;
    return tex;
  }
}

export function makeGround(splatTex) {
  const seg = 210;
  const g = new THREE.PlaneGeometry(GROUND, GROUND, seg, seg);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    // UV do mapa de mistura: [-EXTENT, EXTENT] -> [0,1]
    uv.setXY(i, (x + EXTENT) / (EXTENT * 2), 1 - (z + EXTENT) / (EXTENT * 2));
  }
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: splatTex, roughness: 0.95, metalness: 0 });
  const tiles = { tGrass: T.grassTex(), tDirt: T.dirtTex(), tRoad: T.asphaltTex(), tSand: T.sandTex() };
  mat.onBeforeCompile = sh => {
    for (const [k, t] of Object.entries(tiles)) sh.uniforms[k] = { value: t };
    sh.uniforms.uWorld = { value: EXTENT * 2 };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>
        uniform sampler2D tGrass; uniform sampler2D tDirt; uniform sampler2D tRoad; uniform sampler2D tSand; uniform float uWorld;`)
      .replace('#include <map_fragment>', `
        vec4 sp = texture2D(map, clamp(vMapUv, 0.001, 0.999));
        vec2 wuv = vMapUv * uWorld;
        vec3 cg = texture2D(tGrass, wuv / 3.5).rgb;
        vec3 cd = texture2D(tDirt, wuv / 4.0).rgb;
        vec3 cr = texture2D(tRoad, wuv / 5.0).rgb;
        vec3 cs = texture2D(tSand, wuv / 3.0).rgb;
        float sand = clamp(1.0 - sp.r - sp.g - sp.b, 0.0, 1.0);
        vec3 col = cg * sp.r + cd * sp.g + cr * sp.b + cs * sand;
        // variação em grande escala para quebrar a repetição
        float mv = texture2D(tDirt, wuv * 0.013).r;
        float mv2 = texture2D(tGrass, wuv * 0.021 + 0.37).g;
        col *= 0.82 + mv * 0.35 + (mv2 - 0.3) * 0.25 * sp.r;
        diffuseColor.rgb *= col * 1.25;
      `);
  };
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// Água com ondinhas (normal map de ruído rolando)
export function makeWater() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'), img = ctx.createImageData(S, S);
  const n = makeNoise(5);
  const hgt = (x, y) => n.fbm(x / S * 8, y / S * 8, 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = hgt((x + 1) % S, y) - hgt((x - 1 + S) % S, y), dy = hgt(x, (y + 1) % S) - hgt(x, (y - 1 + S) % S);
    const i = (y * S + x) * 4;
    img.data[i] = clamp(128 + dx * 900, 0, 255); img.data[i + 1] = clamp(128 + dy * 900, 0, 255); img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const nt = new THREE.CanvasTexture(c); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.repeat.set(40, 40);
  const mat = new THREE.MeshStandardMaterial({ color: '#35524e', roughness: 0.12, metalness: 0.25, normalMap: nt, normalScale: new THREE.Vector2(0.5, 0.5), transparent: true, opacity: 0.88 });
  const g = new THREE.PlaneGeometry(GROUND, 140); g.rotateX(-Math.PI / 2);
  const river = new THREE.Mesh(g, mat);
  river.position.set(0, WATER_Y, RIVER_Z + 70 - 4);
  river.receiveShadow = true;
  const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 2.5, 32).rotateX(-Math.PI / 2), mat);
  pond.position.set(POND.x, WATER_Y, POND.z);
  const grp = new THREE.Group(); grp.add(river, pond);
  grp.userData.update = (dt) => { nt.offset.x += dt * 0.004; nt.offset.y += dt * 0.012; };
  return grp;
}
