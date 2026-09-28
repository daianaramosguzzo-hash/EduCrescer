// Viagem pelo mapa-múndi: sair de Aimorés para uma zona (gerada de novo a cada visita) e voltar.
// Só o sobrevivente ativo viaja; os outros ficam na base. Viajar não gasta energia — só passa o tempo.
import { ZONES, generateZone } from '../world/zones.js';
import { computeStaticLight } from './vision.js';
import { tickSurvival } from './survival.js';
import { bus, rng, wait } from '../util.js';
import * as Save from './save.js';

export function installTravel(Game) {
  Object.assign(Game.prototype, {
    inZone() { return !!this.zone; },
    travelBlock() {
      if (this.phase !== 'player') return 'Agora não dá.';
      if (this.state.mode === 'combat') return 'Não dá para viajar com zumbi por perto.';
      if (this.fieldHeroes.some(h => h.st.downed)) return 'Levante-se antes de viajar.';
      return null;
    },
    async travel(zoneId, opts = {}) {
      const why = opts.rescue ? null : this.travelBlock();
      if (why) { this.toast(why, 'erro'); return; }
      const Z = zoneId ? ZONES[zoneId] : null;
      const minutes = Z ? Z.minutos : ZONES[this.zone.id].minutos;
      // o jogo salva sozinho antes de sair da cidade
      if (!this.zone) Save.save(this, 'auto');
      this.phase = 'travel';
      bus.emit('fade', true);
      bus.emit('hud');
      await wait(650);
      // o tempo da caminhada passa (sem gastar energia)
      if (!opts.rescue) { this.state.time += minutes; tickSurvival(this, minutes); }
      // quem viaja é só o ativo; a turma da base continua na cidade
      const act = this.active;
      const heroes = act ? [act] : [];
      if (!this.zone) {
        // guarda a cidade como está e monta a zona
        const sel = this.selected;
        this.town = { map: this.map, units: this.units.filter(u => u !== act), back: [sel.x, sel.z], fire: this.map.fire };
        const map = generateZone(zoneId, (this.state.time * 131 + rng.int(0, 99999)) >>> 0);
        const zUnits = [];
        const [ex, ez] = map.marks.entrada[0];
        this.map = map;
        this.units = heroes;
        this.zone = { id: zoneId };
        this.placeHeroes(ex, ez);
        this.populateZone(zoneId);
        this.log(`🧭 ${act.name} chegou em: <b>${Z.nome}</b> (${minutes} min de caminhada). A turma ficou na base.`, 'lugar');
      } else {
        // volta para Aimorés, no ponto de onde saiu
        const t = this.town;
        this.map = t.map;
        this.units = [...heroes, ...t.units];
        const from = ZONES[this.zone.id].nome;
        this.zone = null; this.town = null;
        if (opts.rescue) { for (const h of heroes) if (h.dead) h.gone = true; }
        else { this.placeHeroes(t.back[0], t.back[1]); this.log(`🏠 ${act.name} voltou a Aimorés, vindo de ${from}.`, 'lugar'); }
      }
      this.S.setMap(this.map);
      for (const u of this.units) if (!u.gone) this.S.units.add(u);
      for (const u of this.units) if (u.kind !== 'hero' && u.faction !== 'zombie') this.S.units.setHp(u, false);
      computeStaticLight(this.map);
      this.refreshLights();
      this.rtInit();
      const h = act && !act.dead ? act : null;
      if (h) { this.select(h); this.S.focus(h.px, h.pz, true); }
      this.updateVision();
      this.S.setTime(this.state.time, this.state.weather);
      this.phase = 'player';
      this.updateMode();
      bus.emit('map-changed');
      bus.emit('fade', false);
      bus.emit('hud');
    },
    // o ativo morreu: a turma assume da base (se foi numa zona, a história volta para Aimorés)
    async afterDeathPick(id) {
      if (this.zone) await this.travel(null, { rescue: true });
      if (this.phase === 'over-pick' || this.phase === 'travel') this.phase = 'player';
      return this.switchSurvivor(id);
    },
    placeHeroes(x, z) {
      for (const h of this.fieldHeroes.filter(u => !u.gone)) {
        const [fx, fz] = this.freeNear(x, z);
        h.x = fx; h.z = fz; h.px = fx + 0.5; h.pz = fz + 0.5; h.nav = null; h.target = null; h.gather = null; h.gatherT = 0;
      }
    },
    populateZone(id) {
      const Z = ZONES[id];
      const [ex, ez] = this.map.marks.entrada[0];
      const mul = this.diff.zombies;
      for (const [type, n] of Z.zumbis) {
        const cnt = Math.max(1, Math.round(n * mul));
        for (let i = 0; i < cnt; i++) {
          for (let t = 0; t < 30; t++) {
            const x = rng.int(3, this.map.W - 4), z = rng.int(3, this.map.H - 4);
            if (Math.hypot(x - ex, z - ez) < 14 || this.map.blocked(x, z) || this.unitAt(x, z)) continue;
            this.spawnZombie(type, x, z, { wander: 6 });
            break;
          }
        }
      }
    },
  });
}
