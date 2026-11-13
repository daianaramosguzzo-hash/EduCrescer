// Força Tática — regras, economia e armas
// As medidas do jogo são em metros. As armas e o movimento seguem os números
// clássicos do gênero (que usa polegadas como unidade), convertidos com U.
export const U = 0.0254;

export const CELL = 3;        // tamanho de cada quadrado do mapa (m)
export const WALL_H = 6;      // altura das paredes

export const PLAYER = {
  radius: 16 * U,
  height: 72 * U,
  crouchHeight: 54 * U,
  eye: 64 * U,
  crouchEye: 46 * U,
  jump: 301.99 * U,
  gravity: 800 * U,
  accel: 5.5,
  airAccel: 12,
  friction: 5.2,
  stopSpeed: 80 * U,
  stepHeight: 18 * U,
  airWish: 30 * U,
  walkMul: 0.52,
  crouchMul: 0.34,
  crouchSpeed: 8,   // velocidade de abaixar/levantar (fração por segundo)
};

export const RULES = {
  startMoney: 800,
  maxMoney: 16000,
  freeze: 6,
  buyTime: 20,
  roundTime: 115,
  postRound: 6,
  bombTimer: 40,
  plantTime: 3.2,
  defuseTime: 10,
  defuseKitTime: 5,
  ffMul: 0.33,       // dano em aliados
};

export const REWARD = {
  winElim: 3250,
  winTime: 3250,
  winBomb: 3500,
  winDefuse: 3500,
  lossBase: 1400,
  lossStep: 500,
  lossMaxSteps: 4,   // 1400 → 3400
  plant: 300,
  defuse: 300,
  plantTeamBonus: 800,
  teamkill: -300,
};

export const EQUIP = {
  kevlar: { id: 'kevlar', name: 'Colete', price: 650 },
  helmet: { id: 'helmet', name: 'Colete + Capacete', price: 1000 },
  kit: { id: 'kit', name: 'Kit de desarme', price: 400, team: 'def' },
};

export const TEAM_NAME = { atk: 'Ataque', def: 'Defesa' };
export const TEAM_LONG = { atk: 'O ATAQUE', def: 'A DEFESA' };

// ---------------------------------------------------------------- recuo
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Padrão de spray: para cada tiro, o deslocamento acumulado [pitch, yaw] em
// radianos. É sempre o mesmo para cada arma, então dá para aprender a compensar.
function pattern(n, { up, climb, sway, period = 6, seed = 1, side = 1 }) {
  const r = rng(seed);
  const pts = [[0, 0]];
  let p = 0, y = 0;
  for (let i = 1; i < n; i++) {
    if (i <= climb) {
      p += up * (1.15 - 0.55 * i / climb);
      y += (r() - 0.5) * up * 0.4;
    } else {
      p += up * 0.1 * r();
      y += side * sway * Math.sin((i - climb) / period * Math.PI) + (r() - 0.5) * sway * 0.35;
    }
    pts.push([p, y]);
  }
  return pts;
}

const sp = (stand, crouch, move, air, shot, max) => ({ stand, crouch, move, air, shot, max });

// ---------------------------------------------------------------- armas
// damage: dano base · pen: quanto atravessa o colete (fração que vai para a vida)
// rangeMod: perda de dano a cada 12,7 m · interval: tempo entre tiros (s)
// speed: velocidade máxima carregando a arma · reward: dinheiro por abate
export const WEAPONS = {
  knife: {
    id: 'knife', name: 'Faca', slot: 'knife', type: 'knife', price: 0,
    damage: 40, altDamage: 65, range: 1.7, altRange: 1.4, interval: 0.4, altInterval: 1.0,
    speed: 250 * U, reward: 1500, deploy: 0.5, model: 'knife',
  },
  // pistolas
  p9: {
    id: 'p9', name: 'P9', slot: 'secondary', type: 'pistol', team: 'atk', price: 200,
    damage: 30, pen: 0.47, rangeMod: 0.85, interval: 0.15, auto: false,
    mag: 20, reserve: 120, reload: 2.2, speed: 240 * U, reward: 300, deploy: 0.6,
    spread: sp(0.006, 0.0045, 0.03, 0.12, 0.014, 0.05),
    recoil: pattern(20, { up: 0.012, climb: 6, sway: 0.004, seed: 3 }),
    sound: { lp: 5200, decay: 0.12, thump: 140, gain: 0.55 }, model: 'pistol', color: 0x2b2b2e,
  },
  p45: {
    id: 'p45', name: 'P45', slot: 'secondary', type: 'pistol', team: 'def', price: 200,
    damage: 35, pen: 0.505, rangeMod: 0.79, interval: 0.17, auto: false,
    mag: 12, reserve: 24, reload: 2.2, speed: 240 * U, reward: 300, deploy: 0.6,
    spread: sp(0.005, 0.004, 0.028, 0.12, 0.016, 0.05),
    recoil: pattern(12, { up: 0.014, climb: 5, sway: 0.004, seed: 5 }),
    sound: { lp: 4200, decay: 0.13, thump: 120, gain: 0.55 }, model: 'pistol', color: 0x3a3d42,
  },
  deagle: {
    id: 'deagle', name: 'Magnum .50', slot: 'secondary', type: 'pistol', price: 700,
    damage: 63, pen: 0.93, rangeMod: 0.81, interval: 0.225, auto: false,
    mag: 7, reserve: 35, reload: 2.2, speed: 230 * U, reward: 300, deploy: 0.7,
    spread: sp(0.006, 0.005, 0.06, 0.2, 0.055, 0.09),
    recoil: pattern(7, { up: 0.04, climb: 7, sway: 0.01, seed: 9 }),
    sound: { lp: 2600, decay: 0.32, thump: 80, gain: 0.9 }, model: 'deagle', color: 0x8d8f94, pen2: 1,
  },
  // pesadas
  smg9: {
    id: 'smg9', name: 'SMG-9', slot: 'primary', type: 'smg', price: 1250,
    damage: 26, pen: 0.6, rangeMod: 0.87, interval: 0.07, auto: true,
    mag: 30, reserve: 120, reload: 2.1, speed: 240 * U, reward: 600, deploy: 0.8,
    spread: sp(0.009, 0.007, 0.022, 0.15, 0.004, 0.03),
    recoil: pattern(30, { up: 0.007, climb: 8, sway: 0.004, seed: 11 }),
    sound: { lp: 4600, decay: 0.1, thump: 150, gain: 0.5 }, model: 'smg', color: 0x26282b,
  },
  smg50: {
    id: 'smg50', name: 'SMG-50', slot: 'primary', type: 'smg', price: 2350,
    damage: 26, pen: 0.69, rangeMod: 0.86, interval: 0.067, auto: true,
    mag: 50, reserve: 100, reload: 3.3, speed: 230 * U, reward: 300, deploy: 0.9,
    spread: sp(0.008, 0.0065, 0.022, 0.15, 0.003, 0.028),
    recoil: pattern(50, { up: 0.006, climb: 10, sway: 0.004, period: 8, seed: 13 }),
    sound: { lp: 4800, decay: 0.1, thump: 140, gain: 0.5 }, model: 'smg50', color: 0x2f3a2c,
  },
  shotgun: {
    id: 'shotgun', name: 'Escopeta 12', slot: 'primary', type: 'shotgun', price: 1050,
    damage: 26, pellets: 9, pelletSpread: 0.055, pen: 0.5, rangeMod: 0.7, interval: 0.88, auto: false,
    mag: 7, reserve: 32, reload: 2.9, speed: 220 * U, reward: 900, deploy: 0.9,
    spread: sp(0.012, 0.01, 0.03, 0.12, 0.0, 0.0),
    recoil: pattern(7, { up: 0.05, climb: 7, sway: 0.01, seed: 15 }),
    sound: { lp: 2200, decay: 0.35, thump: 70, gain: 1.0 }, model: 'shotgun', color: 0x3b2a1e,
  },
  // fuzis
  galil: {
    id: 'galil', name: 'Fuzil G', slot: 'primary', type: 'rifle', team: 'atk', price: 1800,
    damage: 30, pen: 0.775, rangeMod: 0.98, interval: 0.09, auto: true,
    mag: 35, reserve: 90, reload: 3.0, speed: 215 * U, reward: 300, deploy: 1.0,
    spread: sp(0.0055, 0.0042, 0.1, 0.3, 0.005, 0.035),
    recoil: pattern(35, { up: 0.0105, climb: 9, sway: 0.0055, seed: 17, side: -1 }),
    sound: { lp: 3600, decay: 0.16, thump: 100, gain: 0.7 }, model: 'rifleG', color: 0x4a3f2a,
  },
  famas: {
    id: 'famas', name: 'Fuzil F', slot: 'primary', type: 'rifle', team: 'def', price: 2050,
    damage: 30, pen: 0.7, rangeMod: 0.96, interval: 0.09, auto: true,
    mag: 25, reserve: 90, reload: 3.3, speed: 220 * U, reward: 300, deploy: 1.0,
    spread: sp(0.0052, 0.004, 0.1, 0.3, 0.005, 0.035),
    recoil: pattern(25, { up: 0.0100, climb: 8, sway: 0.005, seed: 19 }),
    sound: { lp: 4000, decay: 0.15, thump: 110, gain: 0.65 }, model: 'rifleF', color: 0x3c4148,
  },
  ak: {
    id: 'ak', name: 'AK-47', slot: 'primary', type: 'rifle', team: 'atk', price: 2700,
    damage: 36, pen: 0.775, rangeMod: 0.98, interval: 0.1, auto: true,
    mag: 30, reserve: 90, reload: 2.43, speed: 215 * U, reward: 300, deploy: 1.0, pen2: 1,
    spread: sp(0.0048, 0.0036, 0.12, 0.35, 0.006, 0.04),
    recoil: pattern(30, { up: 0.0135, climb: 9, sway: 0.0075, seed: 21, side: -1 }),
    sound: { lp: 3000, decay: 0.2, thump: 85, gain: 0.8 }, model: 'ak', color: 0x6b4423,
  },
  m4: {
    id: 'm4', name: 'M4A1', slot: 'primary', type: 'rifle', team: 'def', price: 2900,
    damage: 33, pen: 0.7, rangeMod: 0.97, interval: 0.09, auto: true,
    mag: 30, reserve: 90, reload: 3.1, speed: 225 * U, reward: 300, deploy: 1.0, pen2: 1,
    spread: sp(0.0044, 0.0033, 0.11, 0.33, 0.005, 0.036),
    recoil: pattern(30, { up: 0.0115, climb: 9, sway: 0.006, seed: 23 }),
    sound: { lp: 3800, decay: 0.17, thump: 95, gain: 0.72 }, model: 'm4', color: 0x2a2c2f,
  },
  scout: {
    id: 'scout', name: 'Sniper Leve', slot: 'primary', type: 'sniper', price: 1700,
    damage: 88, pen: 0.85, rangeMod: 0.98, interval: 1.25, auto: false,
    mag: 10, reserve: 90, reload: 3.7, speed: 230 * U, scopedSpeed: 220 * U, reward: 300, deploy: 1.1, pen2: 1,
    spread: sp(0.0015, 0.0012, 0.12, 0.25, 0.0, 0.0), noScope: 0.05, scope: [40, 15],
    recoil: pattern(10, { up: 0.03, climb: 10, sway: 0.004, seed: 25 }),
    sound: { lp: 3200, decay: 0.3, thump: 90, gain: 0.85 }, model: 'scout', color: 0x3d4a3a,
  },
  awp: {
    id: 'awp', name: 'Sniper .338', slot: 'primary', type: 'sniper', price: 4750,
    damage: 115, pen: 0.97, rangeMod: 0.99, interval: 1.46, auto: false,
    mag: 5, reserve: 30, reload: 3.7, speed: 200 * U, scopedSpeed: 100 * U, reward: 100, deploy: 1.25, pen2: 2,
    spread: sp(0.0012, 0.001, 0.18, 0.4, 0.0, 0.0), noScope: 0.09, scope: [40, 15],
    recoil: pattern(5, { up: 0.05, climb: 5, sway: 0.004, seed: 27 }),
    sound: { lp: 2000, decay: 0.45, thump: 60, gain: 1.1 }, model: 'awp', color: 0x3f5a3a,
  },
  // granadas
  he: {
    id: 'he', name: 'Granada HE', slot: 'grenade', type: 'grenade', price: 300, max: 1,
    speed: 245 * U, reward: 300, deploy: 0.6, model: 'grenade', color: 0x4f6b3a, fuse: 1.6,
  },
  flash: {
    id: 'flash', name: 'Granada de luz', slot: 'grenade', type: 'grenade', price: 200, max: 2,
    speed: 245 * U, reward: 300, deploy: 0.6, model: 'grenade', color: 0xb8bcc4, fuse: 1.6,
  },
  smoke: {
    id: 'smoke', name: 'Granada de fumaça', slot: 'grenade', type: 'grenade', price: 300, max: 1,
    speed: 245 * U, reward: 300, deploy: 0.6, model: 'grenade', color: 0x8fa7b8, fuse: 1.4,
  },
  bomb: {
    id: 'bomb', name: 'Bomba', slot: 'bomb', type: 'bomb', price: 0,
    speed: 250 * U, deploy: 0.5, model: 'bomb',
  },
};

export const GRENADES = ['he', 'flash', 'smoke'];

// Ordem e categorias do menu de compras
export const BUY_MENU = [
  { name: 'Pistolas', items: ['p9', 'p45', 'deagle'] },
  { name: 'Pesadas', items: ['shotgun', 'smg9', 'smg50'] },
  { name: 'Fuzis', items: ['galil', 'famas', 'ak', 'm4', 'scout', 'awp'] },
  { name: 'Equipamento', items: ['kevlar', 'helmet', 'kit'] },
  { name: 'Granadas', items: ['flash', 'smoke', 'he'] },
];

export const DIFFICULTY = {
  facil:   { name: 'Fácil',   reaction: 0.6,  turn: 5,  err: 0.07,  errMin: 0.03,  head: 0.12, control: 0.3,  fov: 1.9, burst: 3 },
  normal:  { name: 'Normal',  reaction: 0.38, turn: 8,  err: 0.045, errMin: 0.014, head: 0.3,  control: 0.6,  fov: 2.2, burst: 4 },
  dificil: { name: 'Difícil', reaction: 0.24, turn: 13, err: 0.028, errMin: 0.006, head: 0.5,  control: 0.85, fov: 2.5, burst: 6 },
};

export const BOT_NAMES = [
  'Tatu', 'Jaguar', 'Sabiá', 'Bugio', 'Cutia', 'Gavião', 'Lobo', 'Tucano', 'Onça', 'Arara',
  'Quati', 'Tamanduá', 'Carcará', 'Seriema', 'Jacaré', 'Anta', 'Preá', 'Sagui',
];
