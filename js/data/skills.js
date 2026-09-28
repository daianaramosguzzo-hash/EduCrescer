// Árvore de habilidades. Cada nível de personagem dá 1 ponto.
// Cada habilidade tem até "max" níveis; "req" exige outra habilidade antes.

export const SKILL_CATS = [
  { id: 'combate', name: 'Combate', icon: '⚔️' },
  { id: 'sobrevivencia', name: 'Sobrevivência', icon: '❤️' },
  { id: 'coleta', name: 'Coleta', icon: '🪓' },
  { id: 'crafting', name: 'Crafting', icon: '🛠️' },
  { id: 'exploracao', name: 'Exploração', icon: '🧭' },
];

export const SKILLS = {
  forca: { cat: 'combate', name: 'Braço forte', max: 3, desc: '+10% de dano corpo a corpo por nível.', melee: 0.1 },
  pontaria: { cat: 'combate', name: 'Pontaria', max: 3, desc: '+12% de dano com armas de fogo e arco por nível.', ranged: 0.12, req: 'forca' },
  couro: { cat: 'combate', name: 'Couro grosso', max: 3, desc: '+3 de defesa por nível.', def: 3 },
  vitalidade: { cat: 'sobrevivencia', name: 'Vitalidade', max: 3, desc: '+15 de vida máxima por nível.', hp: 15 },
  estomago: { cat: 'sobrevivencia', name: 'Estômago forte', max: 2, desc: 'Fome e sede caem 12% mais devagar por nível e água suja não faz mal no nível 2.', decay: 0.12 },
  folego: { cat: 'sobrevivencia', name: 'Fôlego', max: 3, desc: '+15 de energia máxima por nível.', energy: 15 },
  lenhador: { cat: 'coleta', name: 'Lenhador', max: 3, desc: '+20% de chance de madeira extra por nível.', wood: 0.2 },
  minerador: { cat: 'coleta', name: 'Minerador', max: 3, desc: '+20% de chance de pedra e minério extra por nível.', stone: 0.2 },
  catador: { cat: 'coleta', name: 'Catador', max: 3, desc: '+15% de chance de item extra ao vasculhar por nível.', loot: 0.15 },
  artesao: { cat: 'crafting', name: 'Artesão', max: 3, desc: '+15% de durabilidade nas ferramentas e armas que fabricar.', dura: 0.15 },
  engenhoso: { cat: 'crafting', name: 'Econômico', max: 2, desc: '10% de chance por nível de não gastar material ao fabricar.', save: 0.1, req: 'artesao' },
  construtor: { cat: 'crafting', name: 'Construtor', max: 2, desc: 'Construções da base com +25% de resistência por nível.', build: 0.25 },
  passos: { cat: 'exploracao', name: 'Passos leves', max: 3, desc: 'Faz 15% menos barulho por nível; zumbis te notam mais tarde.', stealth: 0.15 },
  mochileiro: { cat: 'exploracao', name: 'Mochileiro', max: 2, desc: '+2 espaços no inventário por nível.', slots: 2 },
  corredor: { cat: 'exploracao', name: 'Corredor', max: 2, desc: '+5% de velocidade e corrida gasta menos energia.', speed: 0.05, req: 'passos' },
};
for (const [id, s] of Object.entries(SKILLS)) s.id = id;

// experiência necessária para passar do nível n para n+1
export const xpForLevel = n => Math.round(100 * Math.pow(n, 1.45));
export const MAX_LEVEL = 30;
