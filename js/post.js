// Pós-processamento leve: MSAA, bloom discreto (só no que é muito brilhante),
// correção de cor (saturação, contraste, calor) e vinheta suave.
// Tudo num pipeline próprio de poucas passadas para rodar bem em PCs comuns.
import * as THREE from '../lib/three.module.min.js';

const QUAD_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT_FS = `
  uniform sampler2D tSrc; uniform float threshold; varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    float k = smoothstep(threshold, threshold + 0.35, l);
    gl_FragColor = vec4(c * k, 1.0);
  }`;

const BLUR_FS = `
  uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb * 0.227;
    c += texture2D(tSrc, vUv + dir * 1.385).rgb * 0.316;
    c += texture2D(tSrc, vUv - dir * 1.385).rgb * 0.316;
    c += texture2D(tSrc, vUv + dir * 3.23).rgb * 0.07;
    c += texture2D(tSrc, vUv - dir * 3.23).rgb * 0.07;
    gl_FragColor = vec4(c, 1.0);
  }`;

const FINAL_FS = `
  uniform sampler2D tScene; uniform sampler2D tBloom;
  uniform float bloom; uniform float exposure; uniform float saturation; uniform float contrast;
  uniform vec3 tint; uniform vec3 lift; uniform float vignette; uniform vec2 res;
  varying vec2 vUv;
  vec3 toSRGB(vec3 c) {
    c = max(c, 0.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec3 c = texture2D(tScene, vUv).rgb;
    c += texture2D(tBloom, vUv).rgb * bloom;
    c *= exposure;
    c = toSRGB(c);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, saturation);
    c = (c - 0.5) * contrast + 0.5;
    c = c * tint + lift;
    float d = distance(vUv, vec2(0.5));
    c *= 1.0 - vignette * smoothstep(0.42, 0.9, d);
    c += (hash(vUv * res) - 0.5) / 255.0;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;

// correção de cor por clima: leve, só para dar acabamento
export const GRADES = {
  day: { saturation: 1.1, contrast: 1.05, tint: [1.02, 1.0, 0.97], lift: [0.0, 0.004, 0.012], exposure: 1.02, bloom: 0.35, vignette: 0.22 },
  beach: { saturation: 1.1, contrast: 1.04, tint: [1.01, 1.0, 0.98], lift: [0.0, 0.006, 0.014], exposure: 1.03, bloom: 0.4, vignette: 0.2 },
  forest: { saturation: 1.06, contrast: 1.06, tint: [0.97, 1.02, 0.98], lift: [0.004, 0.012, 0.01], exposure: 1.08, bloom: 0.55, vignette: 0.3 },
  sunset: { saturation: 1.08, contrast: 1.06, tint: [1.05, 0.99, 0.94], lift: [0.012, 0.004, 0.012], exposure: 1.02, bloom: 0.5, vignette: 0.28 },
  storm: { saturation: 1.02, contrast: 1.07, tint: [0.97, 0.99, 1.04], lift: [0.006, 0.006, 0.016], exposure: 1.08, bloom: 0.5, vignette: 0.3 },
  indoor: { saturation: 1.06, contrast: 1.04, tint: [1.03, 1.0, 0.96], lift: [0.008, 0.004, 0.0], exposure: 1.04, bloom: 0.35, vignette: 0.26 },
  cave: { saturation: 1.05, contrast: 1.07, tint: [0.96, 1.0, 1.06], lift: [0.0, 0.008, 0.02], exposure: 1.12, bloom: 0.6, vignette: 0.34 },
};

export class Post {
  constructor(renderer) {
    this.r = renderer;
    this.enabled = true;
    this.samples = 4;
    this.bloomOn = true;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.bright = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, threshold: { value: 0.92 } }, vertexShader: QUAD_VS, fragmentShader: BRIGHT_FS });
    this.blur = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: QUAD_VS, fragmentShader: BLUR_FS });
    this.final = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBloom: { value: null }, bloom: { value: 0.35 }, exposure: { value: 1 },
        saturation: { value: 1.1 }, contrast: { value: 1.05 }, tint: { value: new THREE.Vector3(1, 1, 1) },
        lift: { value: new THREE.Vector3() }, vignette: { value: 0.22 }, res: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: QUAD_VS, fragmentShader: FINAL_FS,
    });
    this.grade = GRADES.day;
    this.w = 0; this.h = 0;
    this.makeTargets(1, 1);
  }

  makeTargets(w, h) {
    for (const k of ['rt', 'rtA', 'rtB']) if (this[k]) this[k].dispose();
    const opts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.samples });
    const bw = Math.max(1, Math.floor(w / 4)), bh = Math.max(1, Math.floor(h / 4));
    this.rtA = new THREE.WebGLRenderTarget(bw, bh, opts);
    this.rtB = new THREE.WebGLRenderTarget(bw, bh, opts);
    this.w = w; this.h = h;
  }

  setQuality({ enabled, samples, bloom }) {
    this.enabled = enabled;
    this.bloomOn = bloom;
    if (samples !== this.samples) { this.samples = samples; this.makeTargets(this.w || 1, this.h || 1); }
  }

  setGrade(name) { this.grade = GRADES[name] || GRADES.day; }

  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }

  render(scene, camera) {
    const r = this.r;
    if (!this.enabled) { r.setRenderTarget(null); r.render(scene, camera); return; }
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    if (size.x !== this.w || size.y !== this.h) this.makeTargets(size.x, size.y);
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    const g = this.grade, u = this.final.uniforms;
    if (this.bloomOn) {
      this.bright.uniforms.tSrc.value = this.rt.texture;
      this.pass(this.bright, this.rtA);
      for (let i = 0; i < 2; i++) {
        this.blur.uniforms.tSrc.value = this.rtA.texture;
        this.blur.uniforms.dir.value.set((1 + i) / this.rtA.width, 0);
        this.pass(this.blur, this.rtB);
        this.blur.uniforms.tSrc.value = this.rtB.texture;
        this.blur.uniforms.dir.value.set(0, (1 + i) / this.rtA.height);
        this.pass(this.blur, this.rtA);
      }
    }
    u.tScene.value = this.rt.texture;
    u.tBloom.value = this.rtA.texture;
    u.bloom.value = this.bloomOn ? g.bloom : 0;
    u.exposure.value = g.exposure;
    u.saturation.value = g.saturation;
    u.contrast.value = g.contrast;
    u.tint.value.set(...g.tint);
    u.lift.value.set(...g.lift);
    u.vignette.value = g.vignette;
    u.res.value.set(this.w, this.h);
    this.pass(this.final, null);
  }
}
