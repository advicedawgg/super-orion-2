// One input surface for keyboard, gamepad and touch.
// Read axis.x / axis.z (-1..1, screen-relative: z>0 = toward the camera) and
// down()/hit() for buttons. Call update() once per frame, at the TOP of the
// frame, before anything reads it.

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
  KeyX: 'spin', KeyJ: 'spin', ShiftLeft: 'spin',
  // Stomp gets its OWN key. It used to be spin+down, but movement here is
  // camera-relative, so "down" is also "run toward the camera" — you could not
  // spin while backing up without slamming into the floor instead.
  KeyC: 'stomp', KeyL: 'stomp',
  Escape: 'pause', KeyP: 'pause', Enter: 'start', KeyM: 'mute', KeyR: 'restart',
  KeyO: 'options',
};

// Three independent sources; `held` is their union, rebuilt every update().
const keys = new Set(), pad = new Set(), touch = new Set();
const held = new Set(), prev = new Set();
// Keydowns latched since the last update(). Without this, a press and release
// that both land between two frames is never seen at all — the key is added
// and removed from `keys` before anything reads it. That eats fast taps,
// which is exactly what a kid mashing jump produces on a slow frame.
const latched = new Set();
const stick = { x: 0, z: 0 };
let padAxis = { x: 0, z: 0 };

export const axis = { x: 0, z: 0 };
export const down = n => held.has(n);
export const hit = n => held.has(n) && !prev.has(n);
/** First frame any confirm-ish button goes down. */
export const hitAny = () => hit('jump') || hit('start') || hit('spin');

/* ------------------------------------------------------------- keyboard */
addEventListener('keydown', e => {
  const n = KEYMAP[e.code];
  if (n) { keys.add(n); latched.add(n); e.preventDefault(); }
  typed(e.key);
});
addEventListener('keyup', e => { const n = KEYMAP[e.code]; if (n) keys.delete(n); });
addEventListener('blur', () => keys.clear());

/* --------------------------------------------------------- typed cheats */
let buf = '';
const CHEATS = new Map();
export const cheat = (word, fn) => CHEATS.set(word, fn);
function typed(k) {
  if (!/^[a-z]$/i.test(k)) return;
  buf = (buf + k.toLowerCase()).slice(-12);
  for (const [w, fn] of CHEATS) if (buf.endsWith(w)) { buf = ''; fn(); }
}

/* -------------------------------------------------------------- gamepad */
function pollPad() {
  pad.clear(); padAxis.x = padAxis.z = 0;
  const p = navigator.getGamepads?.().find(Boolean);
  if (!p) return;
  const dz = v => Math.abs(v) < 0.24 ? 0 : v;
  padAxis.x = dz(p.axes[0] || 0);
  padAxis.z = dz(p.axes[1] || 0);
  const b = i => p.buttons[i]?.pressed;
  if (b(0)) pad.add('jump');          // A
  if (b(1)) pad.add('stomp');         // B
  if (b(2) || b(3)) pad.add('spin');  // X / Y
  if (b(9)) pad.add('pause');
  if (b(0) || b(1) || b(9)) pad.add('start');
  if (b(12)) pad.add('up'); if (b(13)) pad.add('down');
  if (b(14)) pad.add('left'); if (b(15)) pad.add('right');
}

/* ---------------------------------------------------------------- touch */
export function initTouch() {
  const stickEl = document.getElementById('stick');
  if (!stickEl || !matchMedia('(pointer: coarse)').matches) return;
  document.body.classList.add('touch');

  let ptr = null, cx = 0, cy = 0, R = 1;
  const nub = stickEl.querySelector('i');
  const reset = () => { ptr = null; stick.x = stick.z = 0; nub.style.transform = ''; };
  const move = e => {
    const dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R;
    const m = Math.hypot(dx, dy) || 1, k = Math.min(1, m) / m;
    stick.x = dx * k; stick.z = dy * k;
    nub.style.transform = `translate(${stick.x * R * .55}px,${stick.z * R * .55}px)`;
  };
  stickEl.addEventListener('pointerdown', e => {
    const r = stickEl.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width * 0.42;
    ptr = e.pointerId; stickEl.setPointerCapture(ptr); move(e);
  });
  stickEl.addEventListener('pointermove', e => { if (e.pointerId === ptr) move(e); });
  for (const ev of ['pointerup', 'pointercancel']) stickEl.addEventListener(ev, reset);

  for (const [elId, name] of [['bJump', 'jump'], ['bSpin', 'spin'], ['bStomp', 'stomp'], ['bPause', 'pause']]) {
    const el = document.getElementById(elId); if (!el) continue;
    const on = () => { touch.add(name); if (name === 'jump') touch.add('start'); };
    const off = () => { touch.delete(name); if (name === 'jump') touch.delete('start'); };
    el.addEventListener('pointerdown', e => { e.preventDefault(); on(); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, off);
  }
}

/* --------------------------------------------------------------- update */
export function update() {
  prev.clear(); for (const n of held) prev.add(n);
  pollPad();
  held.clear();
  for (const s of [keys, pad, touch]) for (const n of s) held.add(n);
  // A tap that already ended still counts for exactly one frame, so hit() sees it.
  for (const n of latched) held.add(n);
  latched.clear();

  let x = (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
  let z = (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
  if (padAxis.x || padAxis.z) { x = padAxis.x; z = padAxis.z; }
  if (stick.x || stick.z) { x = stick.x; z = stick.z; }
  const m = Math.hypot(x, z);
  if (m > 1) { x /= m; z /= m; }
  axis.x = x; axis.z = z;
}
