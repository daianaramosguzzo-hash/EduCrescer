// Sobrevivência: fome, sede, energia, moral, infecção, sangramento, calor,
// bateria da lanterna, fogo e gás tóxico a cada turno.
import { rng, clamp } from '../util.js';
import { ITEMS } from '../data/items.js';
import { LOOKS } from '../sprites/looks.js';

// temperatura de Aimorés (°C) conforme a hora — uma das cidades mais quentes de Minas
export function temperature(g) {
  const h = g.hour();
  let t = 23 + 14 * Math.max(0, Math.sin((h - 7) / 14 * Math.PI));
  if (g.state.weather.chuva) t -= 6;
  return Math.round(t);
}
export function heatStatus(g, u) {
  const t = temperature(g);
  if (t >= 33 && !g.map.indoor(u.x, u.z)) return { t, nome: 'Calor forte', icon: '🥵' };
  if (t >= 30) return { t, nome: 'Quente', icon: '☀️' };
  if (t <= 20) return { t, nome: 'Fresco', icon: '🌙' };
  return { t, nome: 'Agradável', icon: '🌤️' };
}

export function tickSurvival(g, minutes) {
  const k = g.diff.needs;
  const combat = g.state.mode === 'combat';
  for (const u of g.liveHeroes) {
    if (u.st.downed) continue;
    const n = u.need;
    const hot = temperature(g) >= 33 && !g.map.indoor(u.x, u.z);
    n.fome = clamp(n.fome - 0.046 * minutes * k, 0, 100);
    n.sede = clamp(n.sede - 0.064 * minutes * k * (hot ? 1.7 : 1), 0, 100);
    n.energia = clamp(n.energia - 0.075 * minutes * k * (combat ? 1.4 : 1) * (hot ? 1.2 : 1), 0, 100);
    // sangramento
    if (u.st.bleed) {
      const d = u.st.bleed * (combat ? 2 : 4);
      u.hp -= d;
      g.S.units.floatText(u.x, u.z, `🩸-${d}`, 'dmg-hero');
      if (rng.next() < 0.06) { u.st.bleed = 0; g.log(`O sangramento de ${u.name} parou sozinho.`, 'info'); }
    }
    // infecção
    if (u.st.infected && n.infeccao < 100) {
      if (u.st.segura > 0) u.st.segura = Math.max(0, u.st.segura - minutes);
      else {
        let rate = 0.11 * (u.hasPerk('imune') ? 0.7 : 1) * (1 - (u.stats.resistencia - 5) * 0.05);
        const before = n.infeccao;
        n.infeccao = clamp(n.infeccao + rate * minutes, 0, 100);
        for (const [lim, msg] of [[25, 'está com febre (fica mais lento).'], [50, 'está delirando. A infecção avança!'], [75, 'está em estado grave! Precisa do Soro R-7 ou de antibióticos, urgente.']]) {
          if (before < lim && n.infeccao >= lim) { g.log(`🦠 <b>${u.name}</b> ${msg}`, 'perigo'); g.toast(`${u.name}: infecção ${lim}%`, 'perigo'); }
        }
        if (n.infeccao >= 75) u.hp -= combat ? 1 : 2;
        if (n.infeccao >= 50) n.moral = Math.max(0, n.moral - 0.05 * minutes);
      }
      if (n.infeccao >= 100) { turnIntoZombie(g, u); continue; }
    }
    // fome, sede e exaustão
    if (n.fome < 5) u.hp -= Math.ceil(0.2 * minutes);
    if (n.sede < 5) u.hp -= Math.ceil(0.3 * minutes);
    if (n.energia < 3 && rng.next() < 0.25) { u.st.stun = 1; g.log(`😵 <b>${u.name}</b> desmaiou de cansaço!`, 'perigo'); }
    // moral
    let dm = 0;
    if (n.fome < 25) dm -= 0.05;
    if (n.sede < 25) dm -= 0.05;
    if (g.isNight() && !g.map.indoor(u.x, u.z)) dm -= 0.02;
    if (u.wounds.some(w => !w.tratado) && !(u.st.dor > 0)) dm -= 0.02;
    if (dm === 0) dm = n.moral < 55 ? 0.03 : 0;
    if (u.id === 'carol' && dm < 0) dm /= 2;
    n.moral = clamp(n.moral + dm * minutes, 0, 100);
    if (n.moral < 15 && !u.st.panic && rng.next() < 0.08) { u.st.panic = 2; g.log(`😱 <b>${u.name}</b> entrou em pânico! (−15% de precisão)`, 'alerta'); g.S.units.say(u, 'Não dá mais! A gente vai morrer!'); }
    // tempos de efeitos
    for (const key of ['dor', 'drunk']) if (u.st[key]) u.st[key] = Math.max(0, u.st[key] - minutes);
    // lanterna
    if (g.flashlightOn(u) && g.isNight()) {
      const l = u.eq.mao2;
      l.carga = Math.max(0, l.carga - 0.35 * minutes);
      if (l.carga <= 0) g.log(`🔦 A lanterna de ${u.name} ficou sem pilha.`, 'alerta');
    }
    if (u.hp <= 0 && !u.dead) { u.hp = 0; g.damage(u, 1, null, { noBlood: true }); }
  }
  // fogo
  for (const [i, t] of [...g.map.fire]) {
    const x = i % g.map.W, z = (i / g.map.W) | 0;
    for (const u of g.units) if (u.alive && u.x === x && u.z === z) { g.damage(u, rng.int(6, 10), null, { noBlood: true }); if (u.kind === 'zombie') u.st.burn = 2; }
    if (t - 1 <= 0) g.map.fire.delete(i); else g.map.fire.set(i, t - 1);
  }
  // gás
  for (const [i, t] of [...g.map.gas]) {
    const x = i % g.map.W, z = (i / g.map.W) | 0;
    for (const u of g.units) if (u.alive && u.kind !== 'zombie' && u.x === x && u.z === z) { g.damage(u, 3, null, { noBlood: true }); if (u.kind === 'hero') { u.need.infeccao = Math.min(100, u.need.infeccao + 4); u.st.infected = true; } }
    if (t - 1 <= 0) g.map.gas.delete(i); else g.map.gas.set(i, t - 1);
  }
}

function turnIntoZombie(g, u) {
  g.log(`🧟 A infecção venceu. <b>${u.name}</b> se transformou...`, 'perigo');
  g.heroDies(u);
  u.gone = true;
  g.S.units.remove(u);
  const zl = u.look + '_zumbi';
  if (!LOOKS[zl]) LOOKS[zl] = Object.assign({}, LOOKS[u.look], { id: zl, gait: 'zombie', skin: '#a3b58c', stains: 5, wounds: 3, face: Object.assign({}, LOOKS[u.look].face, { eyes: 'zombie', mouth: 'zombie' }) });
  const z = g.spawnZombie('comum', u.x, u.z, { look: zl });
  z.name = `${u.name} (zumbi)`;
  z.maxHp = z.hp = 35;
}
