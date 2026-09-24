// Névoa de guerra: textura com o que cada célula mostra (visível / já explorada)
// aplicada nos materiais por meio de um trecho de shader.
import * as THREE from '../../../lib/three.module.min.js';

export class Fow {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.data = new Uint8Array(W * H * 4);
    this.tex = new THREE.DataTexture(this.data, W, H, THREE.RGBAFormat);
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.needsUpdate = true;
    this.uniforms = {
      uFowTex: { value: this.tex },
      uFowSize: { value: new THREE.Vector2(W, H) },
      uFowDark: { value: new THREE.Color('#07060b') },
      uFowOn: { value: 1 },
    };
    this.cur = new Float32Array(W * H);   // visibilidade suavizada (anima a transição)
    this.target = new Uint8Array(W * H);
    this.explored = new Uint8Array(W * H);
  }
  setVisible(visSet, explored) {
    this.target.fill(0);
    for (const i of visSet) this.target[i] = 255;
    this.explored = explored;
    this.dirty = true;
  }
  revealAll() { this.target.fill(255); this.explored.fill(1); this.dirty = true; }
  update(dt) {
    if (!this.dirty) return;
    const k = Math.min(1, dt * 7);
    let moving = false;
    const d = this.data;
    for (let i = 0, n = this.W * this.H; i < n; i++) {
      const t = this.target[i];
      let c = this.cur[i];
      if (c !== t) { c += (t - c) * k; if (Math.abs(t - c) < 2) c = t; else moving = true; this.cur[i] = c; }
      d[i * 4] = c;
      d[i * 4 + 1] = this.explored[i] ? 255 : 0;
    }
    this.tex.needsUpdate = true;
    if (!moving) this.dirty = false;
  }
  // aplica o trecho de shader num material
  patch(mat) {
    const U = this.uniforms;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vFowPos;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vec4 fowWP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          fowWP = instanceMatrix * fowWP;
        #endif
        vFowPos = (modelMatrix * fowWP).xyz;`);
      sh.fragmentShader = 'varying vec3 vFowPos;\nuniform sampler2D uFowTex;\nuniform vec2 uFowSize;\nuniform vec3 uFowDark;\nuniform float uFowOn;\n' +
        sh.fragmentShader.replace(/}\s*$/, `
        if (uFowOn > 0.5) {
          vec4 fw = texture2D(uFowTex, vFowPos.xz / uFowSize);
          vec3 c0 = gl_FragColor.rgb;
          float gray = dot(c0, vec3(0.299, 0.587, 0.114));
          vec3 mem = mix(vec3(gray), c0, 0.35) * 0.38 + vec3(0.012, 0.012, 0.03);
          gl_FragColor.rgb = mix(mix(uFowDark, mem, fw.g), c0, fw.r);
        }
      }`);
    };
    mat.customProgramCacheKey = () => 'fow';
    return mat;
  }
}
