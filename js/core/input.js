// Teclado, mouse e toque (joystick virtual + botões da HUD).
const keys = new Set();
const pressedQ = new Set();
const buttons = {}; // botões de toque/mouse: attack, interact, run
const stick = { x: 0, z: 0, active: false };
export const input = {
  touch: false,
  mouse: { x: 0, y: 0, down: false, wheel: 0 },
  // vetor de movimento (x = direita, z = baixo na tela)
  move() {
    let x = 0, z = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
    if (stick.active) { x += stick.x; z += stick.z; }
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    return { x, z, len: Math.min(1, l) };
  },
  running() { return keys.has('ShiftLeft') || keys.has('ShiftRight') || !!buttons.run || (stick.active && Math.hypot(stick.x, stick.z) > 0.92 && buttons.autoRun); },
  attackHeld() { return keys.has('Space') || !!buttons.attack || input.mouse.down; },
  interactHeld() { return keys.has('KeyE') || keys.has('KeyF') || !!buttons.interact; },
  // tecla apertada neste quadro (consome)
  pressed(code) { if (pressedQ.has(code)) { pressedQ.delete(code); return true; } return false; },
  anyPressed(...codes) { let r = false; for (const c of codes) if (input.pressed(c)) r = true; return r; },
  clearPressed() { pressedQ.clear(); },
  setButton(name, v) { buttons[name] = v; },
  button(name) { return !!buttons[name]; },
  releaseAll() { keys.clear(); for (const k in buttons) buttons[k] = false; input.mouse.down = false; stick.active = false; stick.x = stick.z = 0; },
  enabled: true,
};

export function initInput(canvas) {
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!e.repeat) pressedQ.add(e.code);
    keys.add(e.code);
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => input.releaseAll());
  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) { input.mouse.down = true; pressedQ.add('Mouse0'); }
    if (e.button === 2) pressedQ.add('Mouse2');
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) input.mouse.down = false; });
  canvas.addEventListener('mousemove', e => { input.mouse.x = e.clientX; input.mouse.y = e.clientY; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { input.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  // toque: a primeira vez que alguém toca, a interface de celular aparece
  window.addEventListener('touchstart', () => { if (!input.touch) { input.touch = true; document.body.classList.add('touch'); } }, { passive: true });
  if (matchMedia('(pointer: coarse)').matches) { input.touch = true; document.body.classList.add('touch'); }
}

// joystick virtual: aparece onde o dedo encosta na metade esquerda
export function initJoystick(zone, base, knob) {
  let id = null, cx = 0, cy = 0;
  const R = 56;
  const start = e => {
    const t = e.changedTouches ? e.changedTouches[0] : e;
    id = t.identifier ?? 'm';
    const rect = zone.getBoundingClientRect();
    cx = t.clientX; cy = t.clientY;
    base.style.left = (cx - rect.left) + 'px'; base.style.top = (cy - rect.top) + 'px';
    base.classList.add('on');
    stick.active = true; moveTo(t);
    e.preventDefault();
  };
  const moveTo = t => {
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    stick.x = dx / R; stick.z = dy / R;
  };
  const move = e => {
    if (id === null) return;
    const list = e.changedTouches ? [...e.changedTouches] : [e];
    const t = list.find(t => (t.identifier ?? 'm') === id);
    if (t) { moveTo(t); e.preventDefault(); }
  };
  const end = e => {
    const list = e.changedTouches ? [...e.changedTouches] : [e];
    if (!list.some(t => (t.identifier ?? 'm') === id)) return;
    id = null; stick.active = false; stick.x = stick.z = 0;
    knob.style.transform = ''; base.classList.remove('on');
  };
  zone.addEventListener('touchstart', start, { passive: false });
  zone.addEventListener('touchmove', move, { passive: false });
  zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
}

// botão de toque que fica "segurado" enquanto o dedo está nele
export function holdButton(elm, name, onPress) {
  const on = e => { buttons[name] = true; onPress && onPress(); e.preventDefault(); e.stopPropagation(); };
  const off = e => { buttons[name] = false; e && e.preventDefault(); };
  elm.addEventListener('touchstart', on, { passive: false });
  elm.addEventListener('touchend', off); elm.addEventListener('touchcancel', off);
  elm.addEventListener('mousedown', on);
  elm.addEventListener('mouseup', off); elm.addEventListener('mouseleave', () => { buttons[name] = false; });
}
