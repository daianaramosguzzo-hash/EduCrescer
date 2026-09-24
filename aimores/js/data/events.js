// Eventos aleatórios durante a exploração. peso = chance relativa; se = condição; uma = só uma vez.
import { flag, hero, banter, questStart, scene } from '../game/story.js';
import { rng, bus } from '../util.js';
import { ITEMS } from './items.js';

// ponto livre a uma certa distância do grupo (fora da vista, se possível)
function spotNear(g, dmin, dmax, outOfSight = true, indoorOk = false) {
  const hs = g.liveHeroes;
  if (!hs.length) return null;
  const h = g.selected || hs[0];
  for (let t = 0; t < 60; t++) {
    const a = rng.next() * Math.PI * 2, d = dmin + rng.next() * (dmax - dmin);
    const x = Math.round(h.x + Math.cos(a) * d), z = Math.round(h.z + Math.sin(a) * d);
    if (!g.map.inb(x, z) || g.map.blocked(x, z) || g.unitAt(x, z)) continue;
    if (g.map.floor[g.map.idx(x, z)] === 12) continue;
    if (!indoorOk && g.map.indoor(x, z)) continue;
    if (outOfSight && g.visible.has(g.map.idx(x, z))) continue;
    return [x, z];
  }
  return null;
}
function spawnGroup(g, x, z, n, types = [['comum', 1]], state = 'idle') {
  const out = [];
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < 15; t++) {
      const nx = x + rng.int(-2, 2), nz = z + rng.int(-2, 2);
      if (!g.map.inb(nx, nz) || g.map.blocked(nx, nz) || g.unitAt(nx, nz)) continue;
      const u = g.spawnZombie(rng.weighted(types), nx, nz);
      u.ai.state = state;
      out.push(u);
      break;
    }
  }
  return out;
}

export const EVENTS = [
  { id: 'horda', peso: 5, se: g => g.state.mode === 'explore' && g.day() >= 1,
    async run(g) {
      const p = spotNear(g, 10, 16); if (!p) return;
      const n = rng.int(5, 8) + (g.isNight() ? 2 : 0);
      spawnGroup(g, p[0], p[1], n, [['comum', 6], ['corredor', 1], ['resistente', 0.5]]);
      g.log('🧟 Um grupo de zumbis está bloqueando uma rua por perto. Talvez seja melhor dar a volta.', 'alerta');
      banter(g, 'horda', { force: true });
    } },
  { id: 'kelly', peso: 3, uma: true, se: g => g.day() >= 1 && g.state.turn > 30 && !g.isNight(),
    async run(g) {
      const p = spotNear(g, 9, 14); if (!p) return;
      const k = g.addNpc('kelly', p[0], p[1]);
      g.S.units.add(k);
      spawnGroup(g, p[0], p[1], 4, [['comum', 1]], 'hunt').forEach(z => { z.ai.target = k.uid; z.ai.last = [k.x, k.z]; });
      g.log('📣 Alguém está gritando por socorro ali perto! "TIRA ESSES BICHOS DAQUI!"', 'alerta');
      g.S.units.say(k, 'SOCORRO! Alguém?!');
      questStart(g, 'kelly');
    } },
  { id: 'toninho', peso: 2, uma: true, se: g => g.state.turn > 60,
    async run(g) {
      const p = spotNear(g, 3, 6, false); if (!p) return;
      const t = g.addNpc('toninho', p[0], p[1]);
      g.S.units.add(t);
      g.log('🔪 Um homem magro, de olhos arregalados, aparece com uma faca na mão.', 'alerta');
      const h = g.selected;
      if (h) await g.talk(h, t);
    } },
  { id: 'wellington', peso: 2, uma: true, se: g => g.state.turn > 40 && !g.isNight(),
    async run(g) {
      const p = spotNear(g, 3, 6, false); if (!p) return;
      const w = g.addNpc('wellington', p[0], p[1]);
      g.S.units.add(w);
      const h = g.selected;
      if (h) await g.talk(h, w);
    } },
  { id: 'pamonheiro', peso: 4, uma: true, se: g => g.isNight() && g.day() >= 1,
    async run(g) {
      const pts = g.map.marks.praca || [[63, 47]];
      const [x, z] = g.freeNear(pts[0][0], pts[0][1]);
      const p = g.spawnZombie('pamonheiro', x, z, { wander: 6 });
      p.name = 'Zumbi Pamonheiro';
      spawnGroup(g, x, z, 3);
      questStart(g, 'pamonheiro');
      g.log('📢 Ao longe, um megafone chiado: "PAMOOONHA, PAMOOONHA, PAMOOONHA..." Vem da Praça da Matriz.', 'alerta');
      banter(g, 'pamonha', { force: true });
    } },
  { id: 'alarme', peso: 3, se: g => g.state.mode === 'explore',
    async run(g) {
      const p = spotNear(g, 8, 18); if (!p) return;
      g.noise(p[0], p[1], 22);
      g.state.alarme = { x: p[0], z: p[1], t: 4 };
      g.log('🚨 UÍÓÓÓ-UÍÓÓÓ! Um alarme de carro disparou por perto. Todos os zumbis da região estão indo para lá.', 'alerta');
      banter(g, 'alarme', { force: true });
    } },
  { id: 'barulho', peso: 3,
    async run(g) {
      const h = g.selected; if (!h) return;
      if (rng.next() < 0.55) {
        g.log('🐈 Um barulho na lixeira ao lado... era só um gato. O coração de todo mundo voltou para o lugar.', 'info');
        banter(g, 'gato_falso', { force: true });
        for (const x of g.liveHeroes) x.need.moral = Math.min(100, x.need.moral + 5);
      } else {
        const p = spotNear(g, 2, 4, true, true) || spotNear(g, 2, 5, false, true); if (!p) return;
        const z = g.spawnZombie('furtivo', p[0], p[1]);
        z.st.hidden = true;
        g.log('👂 Um barulho estranho vem de algum canto escuro... Ninguém viu nada. Ainda.', 'alerta');
      }
    } },
  { id: 'carro_chave', peso: 2, se: g => !g.isNight(),
    async run(g) {
      const cars = g.map.props.filter(p => p.type === 'carro' && !p.searched && g.liveHeroes.some(h => Math.hypot(h.x - p.x, h.z - p.z) < 18));
      if (!cars.length) return;
      const c = rng.pick(cars);
      c.loot = c.loot || [];
      c.loot.push({ id: rng.pick(['kit_medico', 'combustivel', 'mochila_camping', 'revolver']), n: 1 }, { id: 'agua', n: 2 });
      c.alarme = rng.next() < 0.4;
      g.log(`🚗 ${hero(g, 'arthur') ? 'O Arthur' : 'Alguém'} reparou num carro abandonado com as portas abertas e malas no banco de trás. Pode ter coisa boa.`, 'info');
      g.S.units.floatText(c.x, c.z, '✨', 'xp');
    } },
  { id: 'emboscada', peso: 3, se: g => g.state.mode === 'explore',
    async run(g) {
      const p = spotNear(g, 3, 5, true); if (!p) return;
      const zs = spawnGroup(g, p[0], p[1], rng.int(2, 3), [['comum', 3], ['corredor', 1]], 'hunt');
      const h = g.selected;
      for (const z of zs) { z.ai.target = h.uid; z.ai.last = [h.x, h.z]; }
      g.log('⚠️ Emboscada! Zumbis saíram de trás dos muros!', 'perigo');
      g.updateMode();
    } },
  { id: 'ferido', peso: 2,
    async run(g) {
      const h = rng.pick(g.liveHeroes.filter(x => !x.st.downed)); if (!h) return;
      if (rng.next() < 0.5) { g.damage(h, rng.int(3, 6), null); h.st.bleed = 1; g.log(`🩸 ${h.name} se cortou num caco de vidro escondido no mato.`, 'alerta'); }
      else { h.st.stun = 1; g.log(`🦶 ${h.name} torceu o pé num buraco da calçada. Clássico de Aimorés.`, 'alerta'); g.S.units.say(h, 'Ai! Essa calçada é pior que zumbi!'); }
    } },
  { id: 'esconderijo', peso: 2,
    async run(g) {
      const p = spotNear(g, 5, 12, false); if (!p) return;
      const loot = rng.pick([[['enlatado', 3], ['agua', 2]], [['mun_pistola', 10], ['atadura', 2]], [['kit_medico', 1], ['pilhas', 3]], [['molotov', 2], ['tabuas', 2], ['pregos', 1]]]);
      for (const [id, n] of loot) g.map.addPile(p[0], p[1], id, n);
      g.log('📦 Uma lona escondida atrás de uma caçamba... alguém guardou suprimentos por perto! Procure um brilho no chão.', 'bom');
      g.S.units.floatText(p[0], p[1], '📦', 'xp');
    } },
  { id: 'incendio', peso: 1.5,
    async run(g) {
      const p = spotNear(g, 8, 16, false); if (!p) return;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const x = p[0] + dx, z = p[1] + dz; if (g.map.inb(x, z) && !g.map.struct[g.map.idx(x, z)]) g.map.fire.set(g.map.idx(x, z), rng.int(4, 8)); }
      g.refreshLights();
      g.noise(p[0], p[1], 8);
      g.log('🔥 Um carro pegou fogo perto dali! A fumaça sobe preta. O fogo ilumina a rua (e atrai curiosos).', 'alerta');
    } },
  { id: 'saqueadores', peso: 1.5, se: g => g.day() >= 2 && !flag(g, 'lobos_derrotados') && !flag(g, 'lobos_acordo'),
    async run(g) {
      const p = spotNear(g, 7, 10, true); if (!p) return;
      for (let i = 0; i < 2; i++) {
        const [x, z] = g.freeNear(p[0] + i, p[1]);
        const l = g.addNpc('lobo', x, z);
        g.S.units.add(l);
        l.faction = 'hostile'; l.ai.state = 'hunt';
        g.S.units.setHp(l, true);
      }
      g.log('🏍️ Motos roncando! Dois Lobos do Asfalto vieram "cobrar pedágio" à força.', 'perigo');
      g.updateMode();
    } },
  { id: 'chuva', peso: 2.5, se: g => !g.state.weather.chuva,
    async run(g) {
      g.state.weather.chuva = rng.int(8, 20);
      g.S.setTime(g.state.time, g.state.weather);
      g.log('🌧️ Começou a chover forte. Refresca o calor, abafa o barulho e atrapalha a visão dos zumbis.', 'info');
      bus.emit('weather', 'chuva');
      banter(g, 'chuva', { force: true });
    } },
  { id: 'calorao', peso: 2, se: g => g.hour() >= 11 && g.hour() <= 15,
    async run(g) {
      for (const h of g.liveHeroes) h.need.sede = Math.max(0, h.need.sede - 8);
      g.log('🥵 O calorão de Aimorés bateu forte: 39 °C na sombra. Todo mundo com mais sede.', 'alerta');
      banter(g, 'calor', { force: true });
    } },
  { id: 'helicoptero', peso: 1, uma: true,
    async run(g) {
      g.log('🚁 Um helicóptero passa baixo sobre a cidade, rumo a Baixo Guandu. Não parou. Mas existe gente lá fora.', 'info');
      for (const h of g.liveHeroes) h.need.moral = Math.min(100, h.need.moral + 8);
      banter(g, 'helicoptero', { force: true });
    } },
  { id: 'caramelo', peso: 1.2, uma: true,
    async run(g) {
      g.log('🐕 Um vira-lata caramelo apareceu do nada, abanou o rabo, farejou todo mundo e foi embora. O moral do grupo subiu.', 'bom');
      for (const h of g.liveHeroes) h.need.moral = Math.min(100, h.need.moral + 10);
      banter(g, 'caramelo', { force: true });
    } },
  { id: 'apagao', peso: 1.5, se: g => g.isNight(),
    async run(g) {
      const on = g.map.lights.filter(l => l.kind === 'poste' && !l.off);
      for (const l of on) if (rng.next() < 0.3) l.off = true;
      const { computeStaticLight } = await import('../game/vision.js');
      computeStaticLight(g.map);
      g.refreshLights();
      g.log('💡 Estalo, faísca... vários postes da cidade apagaram de vez. Ficou mais escuro.', 'alerta');
    } },
  { id: 'defesa_igreja', peso: 3, uma: true, se: g => g.isNight() && g.state.quests.defesa && !g.state.quests.defesa.done,
    async run(g) {
      g.log('⛪ O sino da Matriz toca desesperado. É o sinal do padre: a horda está chegando na igreja!', 'perigo');
      banter(g, 'sino', { force: true });
    } },
];
