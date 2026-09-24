// Entrada unificada: teclado + controles de toque.
// Ações: up, down, left, right, a, b, menu

const held = new Set();
const handlers = [];
let worldHandler = null;

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', Space: 'a', Enter: 'a', KeyE: 'a',
  KeyX: 'b', Backspace: 'b', ShiftLeft: 'b', ShiftRight: 'b', KeyQ: 'b',
  Escape: 'menu', KeyM: 'menu', Tab: 'menu',
};

export function isHeld(a) { return held.has(a); }

export function heldDir() {
  for (const d of ['up', 'down', 'left', 'right']) if (held.has(d)) return d;
  return null;
}

export function pushHandler(fn) { handlers.push(fn); return fn; }
export function popHandler(fn) {
  const i = handlers.lastIndexOf(fn);
  if (i >= 0) handlers.splice(i, 1);
}
export function setWorldHandler(fn) { worldHandler = fn; }
export function hasModal() { return handlers.length > 0; }

export function emit(action) {
  if (handlers.length) handlers[handlers.length - 1](action);
  else if (worldHandler) worldHandler(action);
}

function press(action) {
  if (!held.has(action)) { held.add(action); emit(action); }
}
function release(action) { held.delete(action); }

export function initInput() {
  window.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (e.repeat && ['a', 'b', 'menu'].includes(a)) return;
    if (e.repeat && handlers.length) { emit(a); return; }
    press(a);
  });
  window.addEventListener('keyup', e => {
    const a = KEYMAP[e.code];
    if (a) release(a);
  });
  window.addEventListener('blur', () => held.clear());

  document.querySelectorAll('[data-act]').forEach(btn => {
    const a = btn.dataset.act;
    let repeatTimer = null;
    const down = e => {
      e.preventDefault();
      btn.classList.add('on');
      press(a);
      if (handlers.length && ['up', 'down', 'left', 'right'].includes(a)) {
        repeatTimer = setInterval(() => { if (handlers.length) emit(a); }, 220);
      }
    };
    const up = e => {
      e.preventDefault();
      btn.classList.remove('on');
      release(a);
      clearInterval(repeatTimer);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });
}
