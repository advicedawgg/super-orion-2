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
  BOUNCE: 14.1,        // the pop off something you landed on — 0.82 of a jump

  MAX_SUBSTEP: 0.35,   // never advance more than this per collision pass
};

/** Longest flat gap a full-speed running jump clears, with no safety margin. */
export const MAX_GAP = 2 * (T.JUMP_V / T.GRAV) * T.SPEED;      // ~5.8u
/** Highest step a single jump can land on. */
export const MAX_RISE = (T.JUMP_V * T.JUMP_V) / (2 * T.GRAV);  // ~2.39u

/* ------------------------------------------------------------------ modes */
// A movement mode is nothing but a patch on T. Both the game and tools/check.js
// get their numbers from tuning(def.mode), so a mode can never mean one thing
// to the player and another to the checker.
//
//   normal — run and jump. Everything the kid already knows.
//   swim   — low gravity, slow sink, and every press is another stroke with no
//            limit, so you climb by tapping rather than by jumping twice.
//   jet    — no jump at all: HOLD to thrust, release to fall.
//
// swim and jet are FREE modes — vertical travel is unbounded, which is why
// levels using them need a `ceilY` roof and why the checker stops trying to
// prove reachability from a jump arc (see tools/check.js).
//
// Both free modes carry a TANK (a 0..1 gauge) that only refills on solid
// ground. Without it lift is free, and a level of platforms you never have to
// land on is not a level — you swim or fly straight over the whole thing. The
// tank is deliberately generous: it is there to make a platform worth landing
// on, not to make traversal a resource-management puzzle.
export const MODES = {
  normal: {},
  // The moon. NOT a free mode: every verb the kid already has — jump, double
  // jump, spin, ground pound — still works and still means the same thing.
  // Only the numbers move, so this is the one new mode that needs no new
  // controls explained, and the checker judges it by its own arc for free
  // (`tuning(def.mode)` feeds arcs() in tools/check.js).
  //
  // The feel to aim for is HANG TIME, not height: a jump that goes about 25%
  // higher but takes twice as long to come down. Cutting GRAV alone gives you
  // a moon you cannot land on anything from, so JUMP_V comes down with it.
  moon: {
    GRAV: 26, MAXFALL: 30, JUMP_V: 12.5, JUMP2_V: 10.5,
    SPEED: 9.2, ACCEL: 58, FRICTION: 40, AIR_CTRL: 0.75,
    BOUNCE: 10.4,                     // same 0.82 of a jump, in moon money
  },
  swim: {
    GRAV: 11, MAXFALL: 6.5, JUMP_V: 8.6, SPEED: 7.8,
    ACCEL: 46, FRICTION: 34, AIR_CTRL: 1, CUT: 1,
    STROKE: true,                     // press = one stroke
    STROKE_COST: 0.125, REFILL: 0.4,  // 8 strokes a lungful; ~2.5s on the bottom
    // A bounce off a jellyfish bell. Worth more than a stroke — otherwise
    // landing on one is a punishment for aiming — and it costs no air, which
    // is what makes a line of them a route rather than an obstacle.
    BOUNCE: 11.2,
  },
  jet: {
    GRAV: 24, MAXFALL: 20, SPEED: 12,
    ACCEL: 60, FRICTION: 52, AIR_CTRL: 1,
    THRUST: 64, CLIMB: 14,            // hold-to-thrust, capped climb rate
    BURN: 0.25, REFILL: 0.5,          // 4s of burn a tank; 2s on a perch to fill
  },
};
/** Tuning for a mode. Falls back to plain running for an unknown name. */
export const tuning = mode => (MODES[mode] ? { ...T, ...MODES[mode] } : T);
/** True when vertical travel is unbounded (stroke or thrust). */
export const isFreeMode = t => !!(t.STROKE || t.THRUST);
/** True when lift is metered by the tank. */
export const hasTank = t => !!(t.BURN || t.STROKE_COST);

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

/** One frame of jump input. Returns null | 'jump' | 'jump2' | 'stroke'. */
export function jumpStep(p, dt, pressed, t = T) {
  p.coyote = p.grounded ? t.COYOTE : Math.max(0, p.coyote - dt);
  p.buffer = pressed ? t.BUFFER : Math.max(0, p.buffer - dt);
  if (p.buffer <= 0 || p.stomping) return null;
  // Swimming: a stroke is always available, so you rise by tapping. No coyote
  // window and no jump budget — both are ideas that only mean anything on land.
  // The lungful IS the limit: out of puff, you sink until you touch bottom.
  if (t.STROKE) {
    if (p.tank < t.STROKE_COST) return null;
    p.tank -= t.STROKE_COST;
    p.vel.y = t.JUMP_V; p.jumps = 0; p.cutting = false; p.buffer = 0;
    return 'stroke';
  }
  // Both windows are CONSUMED on use. Leaving them open re-fires the jump every
  // frame for the whole coyote window, then spends the double jump by itself
  // the moment it closes.
  if (p.coyote > 0) {
    p.vel.y = t.JUMP_V; p.jumps = 1; p.cutting = true;
    p.buffer = 0; p.coyote = 0;
    return 'jump';
  }
  if (p.jumps === 1) {
    p.vel.y = t.JUMP2_V; p.jumps = 2; p.cutting = true;
    p.buffer = 0;
    return 'jump2';
  }
  return null;
}

/** Release-early damping — only ever applied to a jump the player pressed for. */
export function jumpCut(p, dt, holding, t = T) {
  if (p.vel.y <= 0) p.cutting = false;
  if (p.cutting && !holding && p.vel.y > 0) p.vel.y *= Math.pow(t.CUT, dt * 60);
}

/** One frame of hold-to-thrust (jet mode). Returns true while burning. */
export function thrustStep(p, dt, holding, t) {
  if (!holding || p.stomping || p.tank <= 0) return false;
  p.tank = Math.max(0, p.tank - t.BURN * dt);
  p.vel.y = Math.min(p.vel.y + t.THRUST * dt, t.CLIMB);
  return true;
}

/**
 * Refuel. The tank fills ONLY on solid ground, which is the whole point: it is
 * what makes a platform worth landing on in a mode where lift is otherwise
 * free. Modes without a tank are pinned full so nothing else has to branch.
 */
export function tankStep(p, dt, t) {
  if (!hasTank(t)) { p.tank = 1; return; }
  if (p.grounded) p.tank = Math.min(1, p.tank + t.REFILL * dt);
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
  const mk = () => ({ vel: { y: 0 }, grounded: true, jumps: 0, coyote: 0, buffer: 0, stomping: false, cutting: false, tank: 1 });
  const run = (frames, pressOn, held = () => false, t = T) => {
    const p = mk(), got = [];
    for (let i = 0; i < frames; i++) {
      const f = jumpStep(p, 1 / 60, pressOn(i), t);
      if (f) { got.push([i, f]); p.grounded = false; }   // step() leaves the ground at once
      jumpCut(p, 1 / 60, held(i), t);
      p.vel.y -= t.GRAV / 60;
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

  /* --- modes --- */
  const sw = tuning('swim'), jet = tuning('jet');
  ok('unknown mode falls back to running', tuning('nonsense') === T);

  // Swimming: the fourth tap must work exactly like the first. On land the
  // third press buys nothing; that limit must not follow you into the water —
  // only the lungful does, and six taps is well inside it.
  ev = run(80, i => i % 14 === 0, () => false, sw);
  ok(`swim strokes don't run out inside a lungful (got ${ev.length})`,
    ev.length === 6 && ev.every(e => e[1] === 'stroke'));

  // …but the lungful IS finite, and it refills only with your feet down.
  const lung = mk(); lung.grounded = false;
  let strokes = 0;
  for (let i = 0; i < 400; i++) if (jumpStep(lung, 1 / 60, i % 12 === 0, sw)) strokes++;
  ok(`a lungful is ${strokes} strokes then nothing`, strokes === Math.floor(1 / sw.STROKE_COST));
  tankStep(lung, 1, sw);
  ok('no refill while off the bottom', lung.tank < sw.STROKE_COST);
  lung.grounded = true;
  for (let i = 0; i < 240; i++) tankStep(lung, 1 / 60, sw);
  ok('feet down refills the lungful', lung.tank === 1);

  // …and a stroke is not damped by letting go, or holding the button would be
  // the only way to swim up.
  const st = mk(); jumpStep(st, 1 / 60, true, sw);
  jumpCut(st, 1 / 60, false, sw);
  ok('swim stroke ignores jump-cut', st.vel.y === sw.JUMP_V);

  // Jetpack: hold climbs to a cap and stays there; release means you fall.
  const jp = { vel: { y: 0 }, stomping: false, tank: 1, grounded: false };
  for (let i = 0; i < 120; i++) { thrustStep(jp, 1 / 60, true, jet); jp.vel.y -= jet.GRAV / 60; }
  ok(`thrust climbs to its cap (${jp.vel.y.toFixed(1)} <= ${jet.CLIMB})`,
    jp.vel.y > 0 && jp.vel.y <= jet.CLIMB + 1e-9);
  ok('thrust off = no lift', thrustStep(jp, 1 / 60, false, jet) === false);

  // The tank runs dry after its documented burn, and a burnt-out jetpack is
  // dead until you put it on a perch. This is what stops the level being one
  // long hold of the space bar over the top of every platform in it.
  jp.tank = 1;
  let burned = 0;
  while (thrustStep(jp, 1 / 60, true, jet)) burned += 1 / 60;
  ok(`tank burns for ${burned.toFixed(1)}s (want ${(1 / jet.BURN).toFixed(1)})`,
    Math.abs(burned - 1 / jet.BURN) < 0.05);
  tankStep(jp, 1, jet);
  ok('no refuelling in mid-air', thrustStep(jp, 1 / 60, true, jet) === false);
  jp.grounded = true;
  for (let i = 0; i < 300; i++) tankStep(jp, 1 / 60, jet);
  ok('a perch refuels it', jp.tank === 1 && thrustStep(jp, 1 / 60, true, jet) === true);

  /* --- bouncing off things --- */
  // Every mode needs one, because Player.bounce() defaults to it and a mode
  // without it bounces you at `undefined`. Normal mode's value is the one the
  // game shipped with (0.82 of a jump) and must not move — every stomp the kid
  // has already learned is that height.
  ok('normal BOUNCE is unchanged at 0.82 of a jump', Math.abs(T.BOUNCE - T.JUMP_V * 0.82) < 0.02);
  for (const name of Object.keys(MODES)) {
    const m = tuning(name);
    ok(`${name} bounce ${m.BOUNCE} is worth less than a jump and more than half of one`,
      Number.isFinite(m.BOUNCE) && m.BOUNCE < m.JUMP_V * 1.35 && m.BOUNCE > m.JUMP_V * 0.6);
  }

  /* --- the moon --- */
  // It has to stay the RUNNING game: two jumps and no more, both windows
  // consumed, ground pound still legal. Only floatier.
  const mn = tuning('moon');
  ok('moon is not a free mode', !isFreeMode(mn) && !hasTank(mn));
  ev = run(90, i => i === 0 || i === 20, () => true, mn);
  ok(`moon keeps jump + jump2 and nothing more (got ${ev.map(e => e[1]).join(',')})`,
    ev.length === 2 && ev[0][1] === 'jump' && ev[1][1] === 'jump2');
  const mRise = mn.JUMP_V ** 2 / (2 * mn.GRAV), mBoth = mRise + mn.JUMP2_V ** 2 / (2 * mn.GRAV);
  ok(`moon single jump ${mRise.toFixed(2)}u clears a 2.4u step the running game can only just make`,
    mRise > MAX_RISE && mRise < MAX_RISE * 1.4);
  // Hang time, not a rocket: the whole point is that you are in the air longer,
  // not that you leave the level.
  ok(`moon hang time ${(2 * mn.JUMP_V / mn.GRAV).toFixed(2)}s is ~2x the running game`,
    2 * mn.JUMP_V / mn.GRAV > 2 * (T.JUMP_V / T.GRAV) * 1.6);
  ok('moon still has a tank pinned full', (() => {
    const m = mk(); m.grounded = false; m.tank = 0; tankStep(m, 1 / 60, mn); return m.tank === 1;
  })());

  // Running mode must be untouched by any of this.
  const land = mk(); land.grounded = false; land.tank = 0;
  tankStep(land, 1 / 60, T);
  ok('running mode has no tank to run out of', land.tank === 1);

  console.log('PASS physics');
}
