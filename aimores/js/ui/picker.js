// Tela "ESCOLHA SEU SOBREVIVENTE": no começo do jogo, na troca pela base e quando o ativo morre.
// Só um sobrevivente fica em campo; os outros descansam na base, cada um com a sua mochila e o seu nível.
import { $, h, bar } from './common.js';
import { HEROES, HERO_ORDER, SKILLS, STAT_NAMES, XP_LEVELS } from '../data/heroes.js';

// opts: { g, mode: 'start' | 'troca' | 'morte', focus, dead, onPick(id), onCancel() }
export function openPicker(opts) {
  closePicker();
  const { g, mode } = opts;
  const inGame = mode !== 'start' && g && g.state;
  const root = h('div', { id: 'picker', class: 'mode-' + mode });
  const title = mode === 'morte' ? `${opts.dead ? opts.dead.name + ' não resistiu. ' : ''}Quem assume agora?` : 'Escolha seu sobrevivente';
  const sub = mode === 'start'
    ? 'Só um vai para a rua de cada vez. Os outros ficam na Casa da Turma, a base. Cada um tem a própria mochila, o próprio nível e a própria experiência. Dá para trocar sempre que voltar para a base.'
    : mode === 'morte'
      ? 'Os itens ficaram onde caiu. Escolha quem sai da base para continuar.'
      : 'Quem ficar descansa na base. Quem assumir sai de onde estava, com a mochila, o nível e o equipamento dele(a).';
  root.append(h('div', { class: 'pk-head' },
    h('h1', {}, title),
    h('p', {}, sub),
    mode === 'troca' ? h('button', { class: 'pk-x', title: 'Fechar (Esc)', onclick: () => { closePicker(); opts.onCancel && opts.onCancel(); } }, '✕') : null));
  const row = h('div', { class: 'pk-cards' });
  for (const id of HERO_ORDER) {
    const H = HEROES[id];
    const u = inGame ? g.heroes.find(x => x.id === id) : null;
    const dead = u && u.dead;
    const isActive = u && !dead && g.active === u && !u.resting;
    const stats = h('div', { class: 'pk-stats' });
    for (const [k, n] of Object.entries(STAT_NAMES)) {
      const v = u ? u.stats[k] : H.stats[k];
      stats.append(h('div', { class: 'pk-stat', title: n }, h('span', {}, n), h('div', { class: 'pips' }, [...Array(10)].map((_, i) => h('i', { class: i < v ? 'on' : '', style: i < v ? { background: H.cor } : {} })))));
    }
    const skills = h('div', { class: 'pk-skills' }, H.skills.map(s => h('span', { title: SKILLS[s].desc(u ? Math.max(1, u.skill(s)) : 1) }, `${SKILLS[s].icon} ${SKILLS[s].nome}`)));
    let status = null;
    if (u) {
      const next = XP_LEVELS[u.lvl] ?? u.xp, prev = XP_LEVELS[u.lvl - 1] ?? 0;
      const n = u.need;
      status = h('div', { class: 'pk-status' },
        h('div', { class: 'pk-lvl' }, h('b', {}, `Nível ${u.lvl}`), h('small', {}, ` · XP ${u.xp}/${next}`)),
        bar('xp', u.xp - prev, Math.max(1, next - prev), 'linear-gradient(#9ad8ff,#2a8ad8)'),
        dead ? h('div', { class: 'pk-dead' }, '⚰️ Não sobreviveu') : h('div', { class: 'pk-needs' },
          h('span', { title: 'Vida' }, `❤ ${Math.round(u.hp)}/${u.maxHp}`),
          h('span', { title: 'Fome' }, `🍗 ${Math.round(n.fome)}`),
          h('span', { title: 'Sede' }, `💧 ${Math.round(n.sede)}`),
          h('span', { title: 'Energia' }, `⚡ ${Math.round(n.energia)}`),
          h('span', { title: 'Itens na mochila' }, `🎒 ${u.inv.length}`)),
        h('div', { class: 'pk-where' }, dead ? '' : isActive ? '★ Em campo agora' : '🏠 Descansando na base'));
    }
    const can = !dead && !isActive;
    const btnLabel = isActive ? 'JOGANDO' : dead ? '—' : 'JOGAR';
    const card = h('div', { class: 'pk-card' + (dead ? ' dead' : '') + (isActive ? ' active' : '') + (opts.focus === id ? ' focus' : ''), style: { '--cor': H.cor } },
      h('div', { class: 'pk-art', style: { backgroundImage: `url(${H.arte})` } },
        h('div', { class: 'pk-pic', style: { backgroundImage: `url(${H.retrato})` } })),
      h('div', { class: 'pk-body' },
        h('div', { class: 'pk-name' }, H.nome, h('small', {}, ` "${H.apelido}"`)),
        h('div', { class: 'pk-role' }, H.papel),
        status,
        h('p', { class: 'pk-bio' }, H.bio),
        h('div', { class: 'pk-special' }, h('b', {}, `${H.especial.icon} ${H.especial.nome}`), h('div', {}, H.especial.desc)),
        stats,
        skills),
      h('button', { class: 'pk-play', disabled: !can, onclick: () => { if (!can) return; closePicker(); opts.onPick(id); } }, btnLabel));
    row.append(card);
  }
  root.append(row);
  if (mode === 'start') root.append(h('div', { class: 'pk-foot' }, h('button', { class: 'pk-back', onclick: () => { closePicker(); opts.onCancel && opts.onCancel(); } }, '← Voltar')));
  document.body.append(root);
  const onKey = e => {
    if (e.key === 'Escape' && mode !== 'morte') { e.preventDefault(); e.stopPropagation(); closePicker(); opts.onCancel && opts.onCancel(); }
  };
  root._onKey = onKey;
  window.addEventListener('keydown', onKey, true);
  const f = root.querySelector('.pk-card.focus');
  if (f) f.scrollIntoView({ block: 'nearest', inline: 'center' });
}
export function closePicker() {
  const el = $('#picker');
  if (!el) return;
  window.removeEventListener('keydown', el._onKey, true);
  el.remove();
}
export function pickerOpen() { return !!$('#picker'); }
