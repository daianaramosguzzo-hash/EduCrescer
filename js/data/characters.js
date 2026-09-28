// Sobreviventes jogáveis. Só um é controlado por vez; os outros ficam na base.
// Cada um tem atributos, habilidade especial, inventário, nível e equipamentos próprios.

export const CHARACTERS = {
  arthur: {
    name: 'Arthur', role: 'O sobrevivente', color: '#e8a33d', unlocked: true,
    bio: 'Acordou sozinho num Aimorés abandonado. Não sabe quanto tempo passou, só sabe que precisa continuar.',
    base: { vida: 100, energia: 100, velocidade: 1.0, dano: 1.0, defesa: 0, slots: 16 },
    special: { name: 'Determinação', desc: '+15% de experiência e a energia volta 25% mais rápido.', xp: 0.15, energyRegen: 0.25 },
    start: { arma: 'faca_velha', torso: null, items: [['bandagem', 1], ['garrafa_vazia', 1], ['biscoito', 1]] },
    model: 'glb:arthur',
    // aparência do modelo feito em código (usado se o GLB não carregar)
    look: { skin: '#e7b48e', hair: '#4a2c1a', hairStyle: 'spiky', shirt: '#9c6a3c', shirt2: '#c9c3b8', pants: '#232326', shoes: '#e8e8e8', socks: true, backpack: '#1f1f24', kid: true },
    home: [-134, -10],
  },
  carol: {
    name: 'Carol', role: 'A enfermeira', color: '#7ec4a5', female: true,
    bio: 'Enfermeira do posto de saúde. Viu tudo começar e sabe mais do que conta.',
    base: { vida: 90, energia: 115, velocidade: 1.04, dano: 0.9, defesa: 0, slots: 16 },
    special: { name: 'Cuidado médico', desc: 'Bandagens, remédios e kits curam 50% a mais.', heal: 0.5 },
    start: { arma: 'faca', torso: 'jaqueta', items: [['bandagem', 3], ['remedio', 2], ['agua_limpa', 1]] },
    look: { female: true, skin: '#d9a07a', hair: '#8a3b1e', hairStyle: 'long', shirt: '#3f7a62', shirt2: '#e8e0d0', pants: '#2f3b52', shoes: '#f0f0f0' },
    home: [-128, -2],
  },
  daiana: {
    name: 'Daiana', role: 'A mecânica', color: '#e0646a', female: true,
    bio: 'Dona da oficina da avenida. Transforma sucata em qualquer coisa.',
    base: { vida: 100, energia: 100, velocidade: 1.0, dano: 1.0, defesa: 2, slots: 18 },
    special: { name: 'Engenhosa', desc: '25% de chance de não gastar materiais ao fabricar. Ferramentas duram 30% mais.', save: 0.25, durability: 0.3 },
    start: { arma: 'pe_de_cabra', torso: null, items: [['fita', 2], ['prego', 12], ['sucata', 4]] },
    look: { female: true, skin: '#b9825e', hair: '#1a1210', hairStyle: 'ponytail', shirt: '#a33a3a', shirt2: '#5a2020', pants: '#3a4a66', shoes: '#3a2a1c', overall: false },
    home: [-138, 2],
  },
  pablicio: {
    name: 'Pablício', role: 'O homem do campo', color: '#c9a45a',
    bio: 'Fazendeiro da Boa Vista. Forte como um boi e teimoso como uma mula.',
    base: { vida: 125, energia: 90, velocidade: 0.95, dano: 1.2, defesa: 2, slots: 16 },
    special: { name: 'Força do campo', desc: '+20% de dano corpo a corpo e 40% de chance de coletar recurso extra.', melee: 0.2, gather: 0.4 },
    start: { arma: 'facao', torso: null, items: [['carne_assada', 2], ['corda', 3]] },
    look: { skin: '#8a5a3c', hair: '#2a2a2a', hairStyle: 'short', beard: true, hat: '#b08a4a', shirt: '#6a7a4a', shirt2: '#e0d8c0', pants: '#4a5a78', shoes: '#3a2a1c', big: true },
    home: [-122, -14],
  },
};
export const CHARACTER_ORDER = ['arthur', 'carol', 'daiana', 'pablicio'];
for (const [id, c] of Object.entries(CHARACTERS)) c.id = id;
