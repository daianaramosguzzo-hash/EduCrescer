// Controla a população de zumbis: nascem longe da vista conforme o perigo da
// região, somem quando ficam muito longe, e reagem aos barulhos.
import { dist, dist2, R, weighted, bus } from '../core/util.js';
import { Zombie } from '../entities/zombie.js';
import { REGIONS, regionAt, inBase } from '../data/regions.js';

export class ZombieManager {
  constructor(G) {
    this.G = G;
    this.list = [];
    this.spawnT = 2; this.flowT = 0;
    this.fixedAlive = {};
    this.waves = [];
  }
  near(x, z, r) {
    const out = [], r2 = r * r;
    for (const zb of this.list) if (dist2(x, z, zb.x, zb.z) < r2) out.push(zb);
    return out;
  }
  aliveCount() { let n = 0; for (const z of this.list) if (!z.dead) n++; return n; }
  spawn(type, x, z, opts = {}) {
    const zb = new Zombie(this.G, type, x, z, opts);
    this.list.push(zb);
    return zb;
  }
  // nasce perto de um ponto (reforços, ondas)
  spawnNear(x, z, n, type = null, wake = false, types = null) {
    const G = this.G, out = [];
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 12; k++) {
        const a = R() * Math.PI * 2, d = 6 + R() * 8;
        const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
        if (G.world.blockedAt(px, pz, 0.6) || G.world.isWater(px, pz)) continue;
        const t = type || (types ? weighted(Object.entries(types).map(([id, w]) => ({ id, w }))).id : 'comum');
        out.push(this.spawn(t, px, pz, { wake, home: { x: px, z: pz } }));
        break;
      }
    }
    return out;
  }
  noise(x, z, radius) {
    for (const zb of this.list) {
      if (zb.dead) continue;
      const r = radius * zb.def.hear;
      if (dist2(x, z, zb.x, zb.z) < r * r) zb.hear(x, z, radius);
    }
  }
  clear() { for (const z of this.list) z.remove(); this.list = []; this.fixedAlive = {}; }

  update(dt) {
    const G = this.G, p = G.player;
    if (!p) return;
    this.flowT -= dt;
    if (this.flowT <= 0) { this.flowT = 0.25; G.world.flow.update(p.x, p.z); }
    let chasing = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const z = this.list[i];
      const d = dist(z.x, z.z, p.x, p.z);
      z.update(dt, d > 45);
      if (!z.dead && (z.state === 'chase' || z.state === 'attack')) chasing++;
      // limpa corpos antigos e zumbis longe demais
      const gone = (z.dead && z.deadT > 80) || (!z.dead && !z.fixed && d > 90 && z.state !== 'chase');
      if (gone) {
        if (z.fixed && !z.dead) this.fixedAlive[z.fixed.id] = null;
        z.remove(); this.list.splice(i, 1);
      }
    }
    this.chasing = chasing;
    // novos zumbis
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = 1.2; this.populate(); }
    this.fixed();
  }
  populate() {
    const G = this.G, p = G.player;
    if (G.intro) return;
    const night = G.renderer.night > 0.6 ? 1.4 : 1;
    // conta por região perto do jogador
    for (const Rg of REGIONS) {
      // só regiões perto (centro da região a menos de 110 m)
      const cx = Math.max(Rg.x0, Math.min(p.x, Rg.x1)), cz = Math.max(Rg.z0, Math.min(p.z, Rg.z1));
      if (dist(cx, cz, p.x, p.z) > 55) continue;
      let n = 0;
      for (const z of this.list) if (!z.dead && !z.fixed && z.x >= Rg.x0 && z.x < Rg.x1 && z.z >= Rg.z0 && z.z < Rg.z1) n++;
      const max = Math.round(Rg.spawn.max * night * (G.difficulty || 1));
      if (n >= max) continue;
      if (this.aliveCount() > 42) return;
      // ponto longe da vista
      const pts = G.world.spawns[Rg.id];
      for (let k = 0; k < 6; k++) {
        const sp = pts[Math.floor(R() * pts.length)];
        const d = dist(sp.x, sp.z, p.x, p.z);
        if (d < 30 || d > 62) continue;
        if (inBase(sp.x, sp.z, 12)) continue;
        const t = weighted(Object.entries(Rg.spawn.types).map(([id, w]) => ({ id, w }))).id;
        this.spawn(t, sp.x, sp.z);
        break;
      }
    }
  }
  // zumbis fixos (chefes, o Brutamontes do mercado)
  fixed() {
    const G = this.G, p = G.player, S = G.state;
    for (const f of G.world.fixedSpawns) {
      if (this.fixedAlive[f.id]) continue;
      const deadAt = S.world.fixedDead[f.id];
      if (deadAt != null && (f.respawn >= 99999 || S.time < deadAt + f.respawn)) continue;
      if (dist(f.x, f.z, p.x, p.z) > 40) continue;
      if (G.world.lockedRegions.has(f.region)) continue;
      const z = this.spawn(f.type, f.x, f.z, { fixed: f });
      this.fixedAlive[f.id] = z;
      if (f.boss) { G.ui.toast(`⚠️ ${z.def.name} está por perto!`, 'bad'); G.ui.setTarget(z, true); }
    }
  }
}

bus.on('zombieKilled', z => {
  if (z.fixed) {
    const G = z.G;
    G.state.world.fixedDead[z.fixed.id] = G.state.time;
    z.G.zombies.fixedAlive[z.fixed.id] = null;
  }
});
