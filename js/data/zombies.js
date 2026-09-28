// Tipos de zumbi. Para criar um tipo novo basta acrescentar aqui e citá-lo
// nas regiões (js/data/regions.js).
//
// speed: andar / correr (m/s) · sight: distância de visão · hear: multiplicador da audição
// chaseTime: segundos que persegue sem ver · look: aparência (js/entities/humanModel.js)

export const ZOMBIES = {
  comum: {
    name: 'Zumbi errante', hp: 45, dmg: 9, atkRange: 1.25, atkRate: 1.5, walk: 0.9, run: 2.6, sight: 11, hear: 1,
    chaseTime: 4, xp: 12, scale: 1, loot: 'zumbi', pitch: 1,
    look: { skin: '#8a9a78', shirt: ['#6b5a48', '#56627a', '#7a4a42', '#5f6b4e', '#8a7a5a'], pants: ['#3b3b44', '#4a3f33', '#2f3e52'], hair: ['#2a2018', '#4a3a2a', '#1c1c1c', null], hunch: 0.3 },
  },
  rapido: {
    name: 'Corredor', hp: 32, dmg: 7, atkRange: 1.2, atkRate: 0.9, walk: 1.3, run: 4.9, sight: 14, hear: 1.3,
    chaseTime: 5, xp: 18, scale: 0.95, loot: 'zumbi', pitch: 1.3,
    look: { skin: '#9aa58a', shirt: ['#3c5a7a', '#7a2f2f', '#d0c8b0'], pants: ['#26303e', '#3f3a33'], hair: ['#1b1b1b', '#6a4a2a'], hunch: 0.5, thin: true },
  },
  forte: {
    name: 'Brutamontes', hp: 170, dmg: 22, atkRange: 1.55, atkRate: 2.1, walk: 0.75, run: 2.1, sight: 10, hear: 0.8,
    chaseTime: 5, xp: 45, scale: 1.3, loot: 'zumbi_forte', pitch: 0.6, knockResist: 0.8,
    look: { skin: '#7d8a6c', shirt: ['#2e4a2e', '#5a3a2a', '#3a3a3a'], pants: ['#2a2a2a', '#3b3226'], hair: [null], hunch: 0.2, bulky: true, vest: '#c67a22' },
  },
  agressivo: {
    name: 'Caçador', hp: 65, dmg: 13, atkRange: 1.3, atkRate: 1.1, walk: 1.1, run: 3.8, sight: 22, hear: 1.8,
    chaseTime: 12, xp: 28, scale: 1.02, loot: 'zumbi', pitch: 1.1, eyes: '#ff3b1f',
    look: { skin: '#7f8f70', shirt: ['#2a2a2a', '#4a1e1e'], pants: ['#1e1e24'], hair: ['#111111'], hunch: 0.55, torn: true },
  },
  chefe: {
    name: 'O Colosso', hp: 900, dmg: 34, atkRange: 2.2, atkRate: 2.3, walk: 0.95, run: 2.9, sight: 18, hear: 1.2,
    chaseTime: 30, xp: 400, scale: 1.75, loot: 'chefe', pitch: 0.45, boss: true, knockResist: 1, special: 'pancada',
    look: { skin: '#6c7a5c', shirt: ['#3a2c22'], pants: ['#26221e'], hair: [null], hunch: 0.25, bulky: true, spikes: true, vest: '#5a5a5a' },
  },
  // chefe menor do posto de saúde
  enfermeiro: {
    name: 'O Plantonista', hp: 380, dmg: 20, atkRange: 1.5, atkRate: 1.2, walk: 1.0, run: 3.6, sight: 16, hear: 1.5,
    chaseTime: 20, xp: 180, scale: 1.2, loot: 'chefe', pitch: 0.8, boss: true, knockResist: 0.7, special: 'grito',
    look: { skin: '#8c9a84', shirt: ['#cfd8d0'], pants: ['#9fb8b0'], hair: [null], hunch: 0.35, coat: true },
  },
};
for (const [id, z] of Object.entries(ZOMBIES)) z.id = id;
