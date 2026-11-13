// Força Tática — interface: HUD, radar, feed de abates, compra e placar
import { WEAPONS, EQUIP, BUY_MENU, GRENADES, TEAM_NAME, CELL } from './config.js';
import * as MAP from './map.js';

const $ = (s) => document.querySelector(s);
const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const DESC = {
  p9: 'Pistola do Ataque · 20 balas', p45: 'Pistola da Defesa · 12 balas', deagle: 'Um tiro na cabeça derruba',
  smg9: 'Rápida · $600 por abate', smg50: '50 balas · boa correndo', shotgun: 'Forte de perto · $900 por abate',
  galil: 'Fuzil barato do Ataque', famas: 'Fuzil barato da Defesa', ak: 'Mata com um tiro na cabeça', m4: 'Recuo mais fácil',
  scout: 'Sniper leve, precisa no pulo', awp: 'Mata com um tiro no corpo',
  kevlar: 'Protege o corpo', helmet: 'Protege corpo e cabeça', kit: 'Desarma em 5 s',
  flash: 'Cega quem olhar', smoke: 'Bloqueia a visão por 18 s', he: 'Explosão de até 98 de dano',
};

export class HUD {
  constructor(game, player, opts) {
    this.g = game;
    this.p = player;
    this.opts = opts;
    this.radarImg = MAP.radarImage(6);
    this.radar = $('#radar').getContext('2d');
    this.lastMoney = player ? player.money : 0;
    this.buyCat = 0;
    this.feed = [];
    $('#killfeed').innerHTML = '';
    $('#dmg-dirs').innerHTML = '';
    $('#hud').classList.remove('hidden');
    $('#center-msg').classList.add('hidden');
    this.msgUntil = 0;
  }

  // agente cujas informações aparecem (o jogador ou quem ele observa)
  shown() { return this.view || this.p; }

  update(dt, view, spectating) {
    const g = this.g, t = g.time;
    this.view = view;
    const a = view;
    // tempo
    const timer = $('#timer');
    timer.classList.remove('bomb', 'urgent');
    if (g.bomb.state === 'planted' && g.phase === 'live') { timer.textContent = '💣'; timer.classList.add('bomb'); }
    else if (g.phase === 'freeze') { timer.textContent = fmtTime(g.phaseEnd - t); }
    else if (g.phase === 'live') { const left = g.roundEnd - t; timer.textContent = fmtTime(left); if (left < 10) timer.classList.add('urgent'); }
    else timer.textContent = fmtTime(0);
    $('#score-atk').textContent = g.score.atk;
    $('#score-def').textContent = g.score.def;
    $('#round-no').textContent = `RODADA ${g.round} · ${g.phase === 'freeze' ? 'COMPRAS' : g.half * 2 === g.round ? 'ÚLTIMA' : `${g.round <= g.half ? '1º' : '2º'} TEMPO`}`;
    for (const team of ['atk', 'def']) {
      const el = $(`#alive-${team}`);
      const list = g.teamAgents(team);
      if (el.childElementCount !== list.length) el.innerHTML = list.map(() => '<i></i>').join('');
      list.forEach((ag, i) => {
        el.children[i].className = (ag.alive ? '' : 'dead') + (ag === this.p ? ' me' : '');
      });
    }

    if (a) {
      $('#hp').textContent = Math.max(0, a.hp);
      $('#hp').parentElement.classList.toggle('low', a.hp <= 25);
      $('#armor').textContent = a.armor;
      $('#armor-ico').textContent = a.helmet ? '⛑' : '⛨';
      const extras = [];
      if (a.slots.bomb) extras.push('<b class="bomb">BOMBA</b>');
      if (a.kit) extras.push('<b class="kit">KIT</b>');
      $('#extras').innerHTML = extras.join('');
      // dinheiro
      if (a === this.p) {
        if (a.money !== this.lastMoney) {
          const d = a.money - this.lastMoney;
          const el = $('#money-delta');
          el.textContent = (d > 0 ? '+$' : '−$') + Math.abs(d);
          el.className = d < 0 ? 'neg' : '';
          el.style.opacity = 1;
          this.deltaUntil = t + 2.5;
          this.lastMoney = a.money;
        }
        if (t > (this.deltaUntil || 0)) $('#money-delta').style.opacity = 0;
      }
      $('#money').textContent = '$' + a.money;
      $('#money-box').classList.toggle('hidden', a !== this.p && a.team !== (this.p ? this.p.team : a.team));
      $('#buy-hint').classList.toggle('hidden', !(a === this.p && g.canBuy(a)));
      // munição
      const def = a.curDef(), item = a.curItem();
      if (item && item.def.mag) {
        $('#ammo').classList.remove('hidden');
        $('#mag').textContent = item.mag;
        $('#reserve').textContent = item.reserve;
        $('#ammo .sep').style.display = '';
        $('#mag').classList.toggle('low', item.mag <= Math.ceil(item.def.mag * 0.2));
      } else if (GRENADES.includes(a.cur)) {
        $('#ammo').classList.remove('hidden');
        $('#mag').textContent = a.nades[a.cur];
        $('#reserve').textContent = '';
        $('#ammo .sep').style.display = 'none';
        $('#mag').classList.remove('low');
      } else $('#ammo').classList.add('hidden');
      $('#wname').textContent = a.reloading ? 'Recarregando…' : def.name;
      this.slots(a);
      this.crosshair(a, def);
      // cegueira e dano
      const blind = t < a.blindUntil ? Math.min(1, (a.blindUntil - t) / 2.2) * a.blindAmount : 0;
      $('#flashbang').style.opacity = a === this.p ? blind : blind * 0.6;
      $('#hurt').style.opacity = a.alive && t - a.lastHurt < 0.3 ? 0.55 : a.alive && a.hp <= 25 ? 0.25 : 0;
      $('#scope').classList.toggle('hidden', !(a.alive && a.scope > 0 && !spectating));
    }
    $('#bottom-left').style.visibility = a && a.alive ? 'visible' : 'hidden';
    $('#bottom-right').style.visibility = a && a.alive ? 'visible' : 'hidden';

    this.place(a);
    this.hints(a, spectating);
    this.drawRadar(a);
    // feed de abates some depois de alguns segundos
    for (const f of this.feed) if (t - f.t > 7) f.el.style.opacity = 0;
    while (this.feed.length && t - this.feed[0].t > 8) this.feed.shift().el.remove();
    if (t > this.msgUntil) $('#center-msg').classList.add('hidden');
    if (!$('#buy').classList.contains('hidden')) this.renderBuyInfo();
  }

  slots(a) {
    const rows = [];
    if (a.slots.primary) rows.push(['1', a.slots.primary.def.name, 'primary']);
    if (a.slots.secondary) rows.push(['2', a.slots.secondary.def.name, 'secondary']);
    rows.push(['3', 'Faca', 'knife']);
    for (const g of GRENADES) if (a.nades[g]) rows.push(['4', WEAPONS[g].name + (a.nades[g] > 1 ? ' ×' + a.nades[g] : ''), g]);
    if (a.slots.bomb) rows.push(['5', 'Bomba', 'bomb']);
    const html = rows.map(([k, n, key]) => `<div class="slot${a.cur === key ? ' cur' : ''}"><span class="k">${k}</span>${n}</div>`).join('');
    if (html !== this._slotsHtml) { $('#slots').innerHTML = html; this._slotsHtml = html; }
  }

  crosshair(a, def) {
    const el = $('#crosshair');
    el.className = def.type === 'knife' || def.type === 'bomb' ? 'knife' : def.type === 'grenade' ? 'nade' : def.type === 'sniper' && !a.scope ? 'sniper' : '';
    el.style.display = a.alive && !(a.scope > 0) ? '' : 'none';
    // a abertura mostra o espalhamento real da arma
    const inacc = this.g.inaccuracy(a, def);
    const fov = (this.fov || 74) * Math.PI / 180;
    const px = Math.tan(inacc) / Math.tan(fov / 2) * (innerHeight / 2);
    const gap = Math.round(Math.min(80, 3 + px));
    el.querySelector('.t').style.top = `${-gap - 9}px`;
    el.querySelector('.b').style.top = `${gap}px`;
    el.querySelector('.l').style.left = `${-gap - 9}px`;
    el.querySelector('.r').style.left = `${gap}px`;
  }

  place(a) {
    $('#place').textContent = a ? MAP.zoneName(a.pos.x, a.pos.z) : '';
  }

  hints(a, spectating) {
    const g = this.g, t = g.time;
    const hint = $('#hint'), prog = $('#progress');
    let text = '', bar = null, label = '', team = 'atk';
    if (a && a.alive && !spectating) {
      if (a.planting) { bar = (t - a.plantStart) / (a.plantEnd - a.plantStart); label = 'Plantando a bomba…'; }
      else if (a.defusing) { bar = (t - g.bomb.defuseStart) / (g.bomb.defuseEnd - g.bomb.defuseStart); label = a.kit ? 'Desarmando com kit…' : 'Desarmando…'; team = 'def'; }
      else if (a.cur === 'bomb' && g.phase === 'live') text = MAP.siteAt(a.pos) ? 'Segure o botão esquerdo para plantar' : 'Leve a bomba até o bomb A ou B';
      else if (a.team === 'def' && g.bomb.state === 'planted' && a.pos.distanceTo(g.bomb.pos) < 1.8) text = 'Segure E para desarmar';
      else {
        const d = g.lookDrop(a);
        if (d) text = `E: pegar ${d.item.def.name}`;
      }
    }
    if (spectating && a && a.alive && a.defusing) { bar = (t - g.bomb.defuseStart) / (g.bomb.defuseEnd - g.bomb.defuseStart); label = a.name + ' está desarmando'; team = 'def'; }
    hint.classList.toggle('hidden', !text);
    hint.textContent = text;
    prog.classList.toggle('hidden', bar === null);
    if (bar !== null) {
      prog.className = team;
      prog.querySelector('.label').textContent = label;
      prog.querySelector('i').style.width = `${Math.min(100, bar * 100)}%`;
    }
  }

  drawRadar(a) {
    const c = this.radar, g = this.g, t = g.time;
    const size = 200, s = 6 / CELL, zoom = 1.45;
    c.clearRect(0, 0, size, size);
    if (!a) return;
    const myTeam = this.p ? this.p.team : a.team;
    c.save();
    c.beginPath(); c.rect(0, 0, size, size); c.clip();
    c.translate(size / 2, size / 2);
    c.scale(zoom, zoom);
    c.rotate(a.yaw);
    c.translate(-a.pos.x * s, -a.pos.z * s);
    c.drawImage(this.radarImg, 0, 0);
    // bomba
    const b = g.bomb;
    let bpos = null;
    if (b.state === 'planted') bpos = b.pos;
    else if (b.state === 'dropped' && b.drop && (myTeam === 'atk' || b.drop.spotted)) bpos = b.drop.pos;
    else if (b.state === 'carried' && b.carrier && myTeam === 'atk') bpos = null;
    if (bpos) {
      c.fillStyle = b.state === 'planted' && Math.floor(t * 3) % 2 ? '#ff3b2f' : '#ffb04a';
      c.fillRect(bpos.x * s - 4, bpos.z * s - 3, 8, 6);
    }
    for (const o of g.agents) {
      if (!o.alive) continue;
      const ally = o.team === myTeam;
      if (!ally && !(o.spottedUntil > t)) continue;
      const x = o.pos.x * s, y = o.pos.z * s;
      c.fillStyle = ally ? (o.team === 'atk' ? '#e9a83f' : '#5daee8') : '#ff3b2f';
      c.beginPath(); c.arc(x, y, o === a ? 0 : 3.2, 0, Math.PI * 2); c.fill();
      if (ally && o.slots.bomb) { c.strokeStyle = '#ffb04a'; c.lineWidth = 1.5; c.stroke(); }
      if (o !== a) {
        c.strokeStyle = c.fillStyle; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.sin(o.yaw) * 6, y - Math.cos(o.yaw) * 6); c.stroke();
      }
    }
    c.restore();
    // você no centro
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(size / 2, size / 2 - 7); c.lineTo(size / 2 - 5, size / 2 + 5); c.lineTo(size / 2 + 5, size / 2 + 5); c.closePath(); c.fill();
  }

  killfeed(killer, victim, weapon, hs, wb) {
    const el = document.createElement('div');
    el.className = 'kf' + (killer === this.p || victim === this.p ? ' mine' : '');
    const name = (a) => `<span class="t-${a.team}">${esc(a.name)}</span>`;
    const wname = weapon === 'bomb' ? 'Bomba' : WEAPONS[weapon] ? WEAPONS[weapon].name : weapon;
    el.innerHTML = `${killer && killer !== victim ? name(killer) : ''}<span class="w">${wname}</span>${wb ? '<span class="hs">⇶</span>' : ''}${hs ? '<span class="hs">✛ HS</span>' : ''}${name(victim)}`;
    $('#killfeed').appendChild(el);
    this.feed.push({ el, t: this.g.time });
    while (this.feed.length > 6) this.feed.shift().el.remove();
  }

  message(big, small, team, dur = 4) {
    const el = $('#center-msg');
    el.className = team || '';
    el.querySelector('.big').textContent = big;
    el.querySelector('.small').textContent = small || '';
    this.msgUntil = this.g.time + dur;
  }

  damageFrom(angle) {
    const el = document.createElement('div');
    el.className = 'dmg-dir';
    el.style.transform = `rotate(${angle}rad)`;
    $('#dmg-dirs').appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = 0; });
    setTimeout(() => el.remove(), 1300);
  }

  // ------------------------------------------------ menu de compra
  openBuy() {
    $('#buy').classList.remove('hidden');
    this.renderBuy();
  }
  closeBuy() { $('#buy').classList.add('hidden'); $('#buy-msg').textContent = ''; }
  buyOpen() { return !$('#buy').classList.contains('hidden'); }

  renderBuy() {
    const cats = $('#buy-cats');
    cats.innerHTML = BUY_MENU.map((c, i) => `<button data-cat="${i}" class="${i === this.buyCat ? 'sel' : ''}"><span class="n">${i + 1}</span>${c.name}</button>`).join('');
    cats.querySelectorAll('button').forEach(b => b.onclick = () => { this.buyCat = +b.dataset.cat; this.renderBuy(); });
    this.renderBuyItems();
  }

  renderBuyItems() {
    const p = this.p, g = this.g;
    const items = BUY_MENU[this.buyCat].items;
    const box = $('#buy-items');
    box.innerHTML = items.map((id, i) => {
      const it = EQUIP[id] || WEAPONS[id];
      const price = g.priceOf(p, id);
      const other = it.team && it.team !== p.team;
      const owned = (WEAPONS[id] && WEAPONS[id].slot !== 'grenade' && p.slots[WEAPONS[id].slot] && p.slots[WEAPONS[id].slot].def.id === id)
        || (id === 'kevlar' && p.armor >= 100) || (id === 'helmet' && p.armor >= 100 && p.helmet) || (id === 'kit' && p.kit);
      const dis = other || owned || p.money < price;
      const teamTag = it.team ? ` · só ${TEAM_NAME[it.team]}` : '';
      return `<button data-id="${id}" ${dis ? 'disabled' : ''} class="${owned ? 'owned' : ''}"><span><span class="n">${i + 1}</span>${it.name}</span><span class="p">${owned ? 'Comprado' : '$' + price}</span><span class="d">${DESC[id] || ''}${teamTag}</span></button>`;
    }).join('');
    box.querySelectorAll('button').forEach(b => b.onclick = () => this.tryBuy(b.dataset.id));
    this.renderBuyInfo();
  }

  renderBuyInfo() {
    const g = this.g;
    $('#buy-money').textContent = '$' + this.p.money;
    const left = g.buyEnd - g.time;
    $('#buy-time').textContent = g.canBuy(this.p) ? `Tempo de compra: ${Math.ceil(left)} s` : 'Compras encerradas';
  }

  tryBuy(id) {
    const err = this.g.buy(this.p, id);
    $('#buy-msg').textContent = err || '';
    this.renderBuyItems();
    return !err;
  }

  buyKey(n) {
    // primeiro número escolhe a categoria, o segundo compra o item
    if (this._catPicked) {
      const id = BUY_MENU[this.buyCat].items[n - 1];
      this._catPicked = false;
      if (id) this.tryBuy(id);
      return;
    }
    if (n >= 1 && n <= BUY_MENU.length) { this.buyCat = n - 1; this._catPicked = true; this.renderBuy(); }
  }

  // ------------------------------------------------ placar
  scoreboard(show) {
    const el = $('#scoreboard');
    el.classList.toggle('hidden', !show);
    if (show) el.innerHTML = this.boardHtml();
  }

  boardHtml() {
    const g = this.g;
    const myTeam = this.p ? this.p.team : null;
    let html = '';
    for (const team of ['atk', 'def']) {
      const list = g.teamAgents(team).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      html += `<div class="sb-team ${team}"><h3><span>${TEAM_NAME[team].toUpperCase()}</span><span>${g.score[team]}</span></h3><table><tr><th>Jogador</th><th class="num">Abates</th><th class="num">Assist.</th><th class="num">Mortes</th><th class="num">${team === myTeam || !myTeam ? 'Dinheiro' : ''}</th></tr>`;
      for (const a of list) {
        const extra = a.alive && a.slots.bomb && (team === myTeam || !myTeam) ? ' 💣' : a.kit && team === myTeam ? ' 🔧' : '';
        html += `<tr class="${a.alive ? '' : 'dead'} ${a === this.p ? 'me' : ''}"><td>${esc(a.name)}${extra}</td><td class="num">${a.kills}</td><td class="num">${a.assists}</td><td class="num">${a.deaths}</td><td class="num">${team === myTeam || !myTeam ? '$' + a.money : ''}</td></tr>`;
      }
      html += '</table></div>';
    }
    html += `<div class="sb-hist">${g.history.map(w => `<i class="${w}"></i>`).join('')}</div>`;
    return html;
  }
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
