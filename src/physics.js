// Pure movement + collision. No THREE, no DOM — tools/check.js imports this
// directly in node to verify every level is actually completable.
//
// Solid box: {x, y, z, w, d, h}  where (x, y, z) is the centre of the TOP face
// and the box hangs `h` downward. Authoring a platform is then "put the surface
// here", which is what you actually think when placing a jump.
//
// Player position is the FEET point; the body occupies y .. y+PH.

export const T = {
  GRAV: 62, MAXFALL: 46,
  JUMP_V: 17.2,        // apex 2.39u  — clears a 2u step with room
  JUMP2_V: 14.5,       // double jump, +1.70u from wherever you fire it
  CUT: 0.45,           // release-jump-early damping
  SPEED: 10.5, ACCEL: 78, FRICTION: 62, AIR_CTRL: 0.55,
  TURN: 14,            // rad/s the model swivels to face travel
  COYOTE: 0.11, BUFFER: 0.13,
  PW: 0.78, PH: 1.45, PD: 0.78,
  SPIN_TIME: 0.40, SPIN_R: 1.5, SPIN_CD: 0.45,
  STOMP_V: -34,
  MAX_SUBSTEP: 0.35,   // never advance more than this per collision pass
};

/** Longest flat gap a full-speed running jump clears, with no safety margin. */
export const MAX_GAP = 2 * (T.JUMP_V / T.GRAV) * T.SPEED;      // ~5.8u
/** Highest step a single jump can land on. */
export const MAX_RISE = (T.JUMP_V * T.JUMP_V) / (2 * T.GRAV);  // ~2.39u

export const bounds = s => ({
  x0: s.x - s.w / 2, x1: s.x + s.w / 2,
  y0: s.y - s.h, y1: s.y,
  z0: s.z - s.d / 2, z1: s.z + s.d / 2,
});

const hitX = (p, b) => p.x + T.PW / 2 > b.x0 && p.x - T.PW / 2 < b.x1;
const hitZ = (p, b) => p.z + T.PD / 2 > b.z0 && p.z - T.PD / 2 < b.z1;
const hitY = (p, b) => p.y + T.PH > b.y0 && p.y < b.y1;

/**
 * Advance `p` (feet point) by `v` over `dt` against `solids`, resolving one
 * axis at a time. Mutates p and v. Returns what it bumped into.
 */
export function step(p, v, dt, solids) {
  const out = { grounded: false, ceiling: false, wall: false, ground: null };
  const dist = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt;
  const n = Math.max(1, Math.ceil(dist / T.MAX_SUBSTEP));
  const h = dt / n;
  for (let i = 0; i < n; i++) substep(p, v, h, solids, out);
  return out;
}

function substep(p, v, dt, solids, out) {
  // --- Y ---
  p.y += v.y * dt;
  for (const s of solids) {
    const b = s._b || (s._b = bounds(s));
    if (!hitX(p, b) || !hitZ(p, b) || !hitY(p, b)) continue;
    if (v.y <= 0) { p.y = b.y1; v.y = 0; out.grounded = true; out.ground = s; }
    else { p.y = b.y0 - T.PH; v.y = 0; out.ceiling = true; }
  }
  // --- X ---
  p.x += v.x * dt;
  for (const s of solids) {
    const b = s._b;
    if (!hitX(p, b) || !hitZ(p, b) || !hitY(p, b)) continue;
    p.x = v.x > 0 ? b.x0 - T.PW / 2 : b.x1 + T.PW / 2;
    v.x = 0; out.wall = true;
  }
  // --- Z ---
  p.z += v.z * dt;
  for (const s of solids) {
    const b = s._b;
    if (!hitX(p, b) || !hitZ(p, b) || !hitY(p, b)) continue;
    p.z = v.z > 0 ? b.z0 - T.PD / 2 : b.z1 + T.PD / 2;
    v.z = 0; out.wall = true;
  }
}

/* ---------------------------------------------------------- jump machine */
// Lives here rather than in player.js so node can drive it. `p` needs
// {vel:{y}, grounded, jumps, coyote, buffer, stomping, cutting}.

/** One frame of jump input. Returns null | 'jump' | 'jump2'. */
export function jumpStep(p, dt, pressed) {
  p.coyote = p.grounded ? T.COYOTE : Math.max(0, p.coyote - dt);
  p.buffer = pressed ? T.BUFFER : Math.max(0, p.buffer - dt);
  if (p.buffer <= 0 || p.stomping) return null;
  // Both windows are CONSUMED on use. Leaving them open re-fires the jump every
  // frame for the whole coyote window, then spends the double jump by itself
  // the moment it closes.
  if (p.coyote > 0) {
    p.vel.y = T.JUMP_V; p.jumps = 1; p.cutting = true;
    p.buffer = 0; p.coyote = 0;
    return 'jump';
  }
  if (p.jumps === 1) {
    p.vel.y = T.JUMP2_V; p.jumps = 2; p.cutting = true;
    p.buffer = 0;
    return 'jump2';
  }
  return null;
}

/** Release-early damping — only ever applied to a jump the player pressed for. */
export function jumpCut(p, dt, holding) {
  if (p.vel.y <= 0) p.cutting = false;
  if (p.cutting && !holding && p.vel.y > 0) p.vel.y *= Math.pow(T.CUT, dt * 60);
}

/** Highest solid top strictly below `fromY` under (x,z), or null. */
export function groundAt(x, z, fromY, solids) {
  let best = null;
  for (const s of solids) {
    const b = s._b || (s._b = bounds(s));
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
    if (b.y1 > fromY + 1e-6) continue;
    if (!best || b.y1 > best) best = b.y1;
  }
  return best;
}

/* ------------------------------------------------------------ self-check */
// node src/physics.js
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('physics.js')) {
  const ok = (label, cond) => { if (!cond) { console.error('FAIL ' + label); process.exit(1); } console.log('ok   ' + label); };
  const floor = [{ x: 0, y: 0, z: 0, w: 100, d: 100, h: 2 }];

  // Falls onto the floor and stops there, not through it.
  let p = { x: 0, y: 8, z: 0 }, v = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < 300; i++) { v.y = Math.max(-T.MAXFALL, v.y - T.GRAV / 60); step(p, v, 1 / 60, floor); }
  ok('lands on floor', Math.abs(p.y) < 1e-6);

  // Even at a savage dt that would tunnel a single-shot integrator.
  p = { x: 0, y: 40, z: 0 }; v = { x: 0, y: -T.MAXFALL, z: 0 };
  step(p, v, 1 / 12, floor);
  ok('no tunnelling at 12fps', p.y >= 0);

  // Jump apex matches the documented constant.
  p = { x: 0, y: 0, z: 0 }; v = { x: 0, y: T.JUMP_V, z: 0 };
  let apex = 0;
  for (let i = 0; i < 200; i++) { v.y = Math.max(-T.MAXFALL, v.y - T.GRAV / 240); step(p, v, 1 / 240, floor); apex = Math.max(apex, p.y); }
  ok(`jump apex ${apex.toFixed(2)} ~= MAX_RISE ${MAX_RISE.toFixed(2)}`, Math.abs(apex - MAX_RISE) < 0.06);

  // Walls stop horizontal travel instead of swallowing the player.
  const wall = [...floor, { x: 4, y: 6, z: 0, w: 1, d: 10, h: 6 }];
  p = { x: 0, y: 0, z: 0 }; v = { x: 40, y: 0, z: 0 };
  step(p, v, 0.25, wall);
  ok('wall blocks', p.x <= 4 - 0.5 - T.PW / 2 + 1e-6);

  ok('groundAt finds surface', groundAt(0, 0, 5, floor) === 0);

  /* --- jump machine. One press must buy exactly one jump. --- */
  const mk = () => ({ vel: { y: 0 }, grounded: true, jumps: 0, coyote: 0, buffer: 0, stomping: false, cutting: false });
  const run = (frames, pressOn, held = () => false) => {
    const p = mk(), got = [];
    for (let i = 0; i < frames; i++) {
      const f = jumpStep(p, 1 / 60, pressOn(i));
      if (f) { got.push([i, f]); p.grounded = false; }   // step() leaves the ground at once
      jumpCut(p, 1 / 60, held(i));
      p.vel.y -= T.GRAV / 60;
    }
    return got;
  };

  // Held for 20 frames while standing on the ground: still ONE jump, and the
  // double jump must not spend itself when the coyote window closes.
  let ev = run(30, i => i === 0, () => true);
  ok(`one press -> one jump (got ${JSON.stringify(ev)})`, ev.length === 1 && ev[0][1] === 'jump');

  // A second, separate press buys the double jump — and only one.
  ev = run(40, i => i === 0 || i === 12, () => true);
  ok(`two presses -> jump + jump2 (got ${ev.map(e => e[1]).join(',')})`,
    ev.length === 2 && ev[0][1] === 'jump' && ev[1][1] === 'jump2');

  // A third press buys nothing.
  ev = run(60, i => i === 0 || i === 12 || i === 24, () => true);
  ok('third press does nothing', ev.length === 2);

  // A spring bounce keeps its full height with jump NOT held; a pressed jump
  // gets damped. (This is what made the bounce crate look half-broken.)
  const spring = mk(); spring.vel.y = T.JUMP_V * 1.35; spring.cutting = false;
  for (let i = 0; i < 6; i++) jumpCut(spring, 1 / 60, false);
  ok('spring bounce ignores jump-cut', spring.vel.y === T.JUMP_V * 1.35);
  const cut = mk(); cut.vel.y = T.JUMP_V; cut.cutting = true;
  jumpCut(cut, 1 / 60, false);
  ok('pressed jump is cut on release', cut.vel.y < T.JUMP_V * 0.6);

  console.log('PASS physics');
}
