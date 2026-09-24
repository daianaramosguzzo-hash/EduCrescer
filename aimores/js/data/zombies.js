// Tipos de zumbi: vida, dano, velocidade (PA), percepção, alcance e comportamento.
export const ZOMBIES = {
  comum: {
    nome: 'Zumbi comum', hp: 22, pa: 4, dano: [5, 9], prec: 72, alcance: 1, visao: 7, audicao: 1, esquiva: 0,
    mordida: 0.32, xp: 12, porta: 1, desc: 'Lento e fraco, mas nunca anda sozinho.',
  },
  corredor: {
    nome: 'Zumbi corredor', hp: 16, pa: 9, dano: [4, 8], prec: 75, alcance: 1, visao: 9, audicao: 1.2, esquiva: 10,
    mordida: 0.28, xp: 18, porta: 1, corre: true, desc: 'Era maratonista. Continua treinando.',
  },
  resistente: {
    nome: 'Zumbi bombado', hp: 62, pa: 4, dano: [12, 18], prec: 68, alcance: 1, visao: 6, audicao: 0.8, esquiva: -10,
    mordida: 0.22, xp: 35, porta: 3, empurra: true, desc: 'Muita vida e dano. Derruba portas com os ombros.',
  },
  furtivo: {
    nome: 'Espreitador', hp: 18, pa: 6, dano: [8, 13], prec: 82, alcance: 1, visao: 5, audicao: 1.5, esquiva: 15,
    mordida: 0.5, xp: 25, porta: 1, furtivo: true, emboscada: 1.6, desc: 'Fica escondido no escuro. Só aparece quando já é tarde.',
  },
  pamonheiro: {
    nome: 'Zumbi Pamonheiro', hp: 32, pa: 4, dano: [4, 7], prec: 70, alcance: 1, visao: 8, audicao: 1, esquiva: 0,
    mordida: 0.2, xp: 45, porta: 1, grito: 18, especial: true, desc: '"Pamonha, pamonha, pamonha!" O megafone atrai todos os zumbis da região.',
  },
  inchado: {
    nome: 'Zumbi Inchado', hp: 26, pa: 3, dano: [5, 8], prec: 70, alcance: 1, visao: 6, audicao: 1, esquiva: -15,
    mordida: 0.25, xp: 30, porta: 1, explode: true, especial: true, desc: 'Explode ao morrer e solta gás tóxico. Mate de longe.',
  },
  matriz: {
    nome: 'A Matriz', hp: 280, pa: 6, dano: [14, 22], prec: 78, alcance: 1, visao: 10, audicao: 2, esquiva: -5,
    mordida: 0.4, xp: 320, porta: 5, raizes: 4, brotos: 3, chefe: true, especial: true,
    desc: 'O Dr. Heitor Brotas, tomado pelo CRESCE+. Metade cientista, metade canteiro de obras.',
  },
};
