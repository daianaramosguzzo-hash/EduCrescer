// Sobreviventes: os que não estão sendo controlados ficam parados na base
// (nunca seguem o jogador). Resgates nas missões e troca de personagem na base.
import { dist, R, bus, angleTo } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { CHARACTERS, CHARACTER_ORDER } from '../data/characters.js';
import { TALK } from '../data/quests.js';
import { inBase, BASE, regionAt } from '../data/regions.js';
import { makeCharacterModel } from '../entities/player.js';
import { item } from '../data/items.js';

export class Survivors {
  constructor(G) { this.G = G; this.npcs = {}; this.rescue = {}; }
  clear() {
    for (const n of Object.values(this.npcs)) this.removeNpc(n);
    for (const n of Object.values(this.rescue)) this.removeNpc(n);
    this.npcs = {}; this.rescue = {};
  }
  removeNpc(n) { this.G.renderer.scene.remove(n.model.group); this.G.world.unregister(n.obj); }
  makeNpc(id, x, z, rot, rescue = false) {
    const G = this.G, ch = G.state.chars[id];
    const model = makeCharacterModel(id);
    if (ch.equip.arma) model.setWeapon(item(ch.equip.arma.id));
    G.renderer.scene.add(model.group);
    const n = { id, model, x, z, rot, rescue, t: R() * 5, home: { x, z }, tx: x, tz: z, gait: 0 };
    n.obj = G.world.register({ kind: 'npc', x, z, r: 1.0, name: CHARACTERS[id].name, npc: n });
    this.place(n);
    return n;
  }
  place(n) {
    n.model.group.position.set(n.x, this.G.world.heightAt(n.x, n.z), n.z);
    n.model.group.rotation.y = n.rot;
    n.obj.x = n.x; n.obj.z = n.z;
  }
  // recria os NPCs da base conforme quem está desbloqueado
  refresh() {
    const G = this.G;
    for (const n of Object.values(this.npcs)) this.removeNpc(n);
    this.npcs = {};
    for (const id of CHARACTER_ORDER) {
      const ch = G.state.chars[id];
      if (!ch.unlocked || id === G.state.active) continue;
      let x = ch.x, z = ch.z;
      if (!inBase(x, z, 2)) { [x, z] = CHARACTERS[id].home; ch.x = x; ch.z = z; }
      this.npcs[id] = this.makeNpc(id, x, z, ch.rot || 0);
    }
    // resgates pendentes
    for (const [who, site] of Object.entries(G.world.rescueSites || {})) {
      const ch = G.state.chars[who];
      const need = !ch.unlocked && G.quests.active().some(q => q.objectives.some(o => o.type === 'rescue' && o.who === who));
      if (need && !this.rescue[who]) {
        const n = this.makeNpc(who, site.x, site.z, 0, true);
        n.site = site; n.wave = null; n.ready = false;
        n.model.anim.play('pick', { loop: true, dur: 3 });
        this.rescue[who] = n;
      }
      if (!need && this.rescue[who]) { this.removeNpc(this.rescue[who]); delete this.rescue[who]; }
    }
  }
  talk(o) {
    const G = this.G, n = o.npc;
    if (n.rescue) {
      if (!G.quests.canRescue(n.id)) { G.ui.toast('Complete os objetivos anteriores da missão primeiro.', 'info'); return; }
      if (!n.ready) { G.ui.toast('Ainda tem zumbis por perto! Limpe a área.', 'bad'); return; }
      const lines = TALK[n.id].rescue.map(t => ({ name: CHARACTERS[n.id].name, text: t, portrait: n.id }));
      G.ui.dialog(lines, () => {
        this.removeNpc(n); delete this.rescue[n.id];
        const ch = G.state.chars[n.id];
        [ch.x, ch.z] = CHARACTERS[n.id].home;
        G.quests.event('rescue', { who: n.id });
        this.refresh();
      });
      return;
    }
    const lines = TALK[n.id].base;
    const opts = [{ label: '💬 ' + lines[Math.floor(R() * lines.length)], fn: () => {} }];
    if (this.canSwitch()) opts.push({ label: `🎮 Controlar ${CHARACTERS[n.id].name}`, fn: () => this.switchTo(n.id) });
    G.ui.choice(CHARACTERS[n.id].name + ' — ' + CHARACTERS[n.id].role, opts);
    n.rot = angleTo(n.x, n.z, G.player.x, G.player.z);
  }
  canSwitch() {
    const G = this.G, p = G.player;
    if (!inBase(p.x, p.z, 3)) return false;
    if (G.zombies.chasing > 0) return false;
    if (p.busy || p.dead) return false;
    return true;
  }
  switchReason() {
    const G = this.G, p = G.player;
    if (!inBase(p.x, p.z, 3)) return 'A troca só pode ser feita dentro da base.';
    if (G.zombies.chasing > 0) return 'Não dá para trocar durante um combate.';
    return null;
  }
  switchTo(id) {
    const G = this.G;
    if (!this.canSwitch() || id === G.state.active) return;
    const ch = G.state.chars[id];
    if (!ch.unlocked) return;
    const npc = this.npcs[id];
    const prev = G.state.chars[G.state.active];
    prev.x = G.player.x; prev.z = G.player.z; prev.rot = G.player.rot;
    if (npc) { ch.x = npc.x; ch.z = npc.z; ch.rot = npc.rot; }
    G.state.active = id;
    G.player.setChar(ch);
    G.knownRecipes = G.crafting.knownSet();
    G.renderer.follow(ch.x, ch.z, 1, true);
    this.refresh();
    sfx('levelUp');
    G.ui.toast(`Agora você controla ${CHARACTERS[id].name}.`, 'good');
    G.ui.refresh();
    G.requestSave();
  }
  update(dt) {
    const G = this.G, p = G.player;
    for (const n of Object.values(this.npcs)) {
      n.t -= dt;
      // anda um pouco perto de casa, conversa sozinho
      if (n.t <= 0) {
        n.t = 4 + R() * 6;
        if (R() < 0.5) { const a = R() * 6.28, d = R() * 3; n.tx = n.home.x + Math.cos(a) * d; n.tz = n.home.z + Math.sin(a) * d; if (!inBase(n.tx, n.tz, -1)) { n.tx = n.home.x; n.tz = n.home.z; } }
      }
      const dx = n.tx - n.x, dz = n.tz - n.z, d = Math.hypot(dx, dz);
      let gait = 0;
      if (d > 0.2) { const sp = 1.2; n.x += dx / d * sp * dt; n.z += dz / d * sp * dt; n.rot = Math.atan2(dx, dz); gait = 0.5; const res = G.world.col.resolve(n.x, n.z, 0.35); n.x = res.x; n.z = res.z; }
      n.model.update(dt, gait);
      const ch = G.state.chars[n.id]; ch.x = n.x; ch.z = n.z; ch.rot = n.rot;
      this.place(n);
    }
    // resgates: ao chegar, uma onda de zumbis aparece
    for (const n of Object.values(this.rescue)) {
      n.model.update(dt, 0);
      const d = dist(n.x, n.z, p.x, p.z);
      if (!n.wave && d < 16 && G.quests.canRescue(n.id)) {
        const R0 = regionAt(n.x, n.z);
        n.wave = G.zombies.spawnNear(n.x, n.z, 5, null, true, R0 ? R0.spawn.types : null);
        G.ui.toast(`${CHARACTERS[n.id].name} está ${CHARACTERS[n.id].female ? 'cercada' : 'cercado'}! Derrote os zumbis!`, 'bad', 4);
        sfx('zScream', { x: n.x, z: n.z });
      }
      if (n.wave && !n.ready && n.wave.every(z => z.dead || !G.zombies.list.includes(z))) {
        n.ready = true; n.model.anim.stop(); n.model.anim.play('wave');
        G.ui.toast(`Área limpa! Fale com ${CHARACTERS[n.id].name}.`, 'good');
      }
      if (n.ready && d < 6) n.rot = angleTo(n.x, n.z, p.x, p.z);
      this.place(n);
    }
  }
}
