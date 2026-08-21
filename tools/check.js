// node tools/check.js
//
// The gate. Runs the REAL builder (src/builder.js) and the REAL physics
// constants (src/physics.js), then proves each level is actually completable:
// flood-fills the platform graph from the start point using jump arcs derived
// from the tuning, and fails if the goal, a checkpoint, a crate or a star
// can't be reached. Eyeballing level geometry does not work. This does.

import { LEVELS, HUB } from '../src/levels.js';
import { buildLevel, killPlane, FLOATING, BODY, FLORA, CRATE_STARS, TNT_R } from '../src/builder.js';
import { T, tuning, isFreeMode, hasTank } from '../src/physics.js';

const SAFETY = 0.85;          // players are not frame-perfect; demand slack
// Mirrors the default on the king in src/world.js. If you change it there,
// change it here — or better, pass `arena` explicitly in the level, which is
// what every real boss placement does.
const ENEMY_ARENA_DEFAULT = 12;

/* ------------------------------------------------------------- jump model */
// Derived per level from tuning(def.mode), so a swim or flight level is judged
// by its own numbers rather than by a runner's jump arc.
function arcs(t) {
  const H1 = t.JUMP_V ** 2 / (2 * t.GRAV);
  const H2 = t.JUMP2_V ** 2 / (2 * t.GRAV);
  /** Furthest horizontal travel that still lands `dy` above the take-off point. */
  const reach = (dy, v = t.JUMP_V, dbl = false) => {
    const h1 = v ** 2 / (2 * t.GRAV);
    const rise = dbl ? h1 + H2 : h1;
    if (dy > rise) return -1;                                // can't get up there
    const up = (v + (dbl ? t.JUMP2_V : 0)) / t.GRAV;
    const fall = Math.sqrt(Math.max(0, 2 * (rise - dy) / t.GRAV));
    return t.SPEED * (up + fall);
  };
  return { H1, H2, reach };
}

/* -------------------------------------------------------------- tank model */
// In a free mode the question is not "can you jump it" but "can you get there
// before the tank runs dry", because the tank only refills on solid ground.
// Same constants the game uses, so a level cannot pass here and strand a player.
//
// ponytail: a coarse envelope — spend fuel climbing, spend the rest gaining
// height, then glide down — not a trajectory solver. It answers "is there
// anywhere to land between here and there", which is the failure it exists to
// catch. Tighten it only if something slips through in a real playtest.
const fallTime = (h, t) => {
  const tc = t.MAXFALL / t.GRAV, hc = t.MAXFALL * tc / 2;      // to terminal speed
  return h <= hc ? Math.sqrt(2 * Math.max(0, h) / t.GRAV) : tc + (h - hc) / t.MAXFALL;
};
/** Furthest horizontal travel on ONE tankful that ends `dy` above the start. */
function tankReach(t) {
  return dy => {
    let air;
    if (t.BURN) {
      const budget = 1 / t.BURN;                                // seconds of burn
      const climb = Math.max(0, dy) / t.CLIMB;
      if (climb > budget) return -1;
      const spare = budget - climb;
      air = climb + spare + fallTime(t.CLIMB * spare, t);
    } else {
      const n = Math.floor(1 / t.STROKE_COST);                  // strokes in a lungful
      const per = t.JUMP_V ** 2 / (2 * t.GRAV);                 // height one stroke buys
      const need = Math.ceil(Math.max(0, dy) / per);
      if (need > n) return -1;
      air = n * (t.JUMP_V / t.GRAV) + fallTime(per * (n - need), t);
    }
    return t.SPEED * air;
  };
}

const rect = s => ({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - s.d / 2, z1: s.z + s.d / 2 });
/** Shortest horizontal distance between two footprints (0 if they overlap). */
function gap(a, b) {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dz = Math.max(0, a.z0 - b.z1, b.z0 - a.z1);
  return Math.hypot(dx, dz);
}
/** Shortest horizontal distance from a point to a footprint. */
function gapPt(p, r) {
  const dx = Math.max(0, r.x0 - p.x, p.x - r.x1);
  const dz = Math.max(0, r.z0 - p.z, p.z - r.z1);
  return Math.hypot(dx, dz);
}

/* ------------------------------------------------------------------ check */
let failures = 0, warnings = 0;
const fail = m => { console.log(`  ✗ ${m}`); failures++; };
const warn = m => { console.log(`  ! ${m}`); warnings++; };

// The hub is authored with the same Builder and gets the same class of mistake
// — a floating tree, a portal you cannot walk to — so it goes through the same
// gate. `def.hub` turns off only the two checks that assume a level has an end.
for (const def of [...LEVELS, HUB]) {
  const t = tuning(def.mode);
  const free = isFreeMode(t);                 // swim / jet: vertical travel is unbounded
  const { H1, H2, reach } = arcs(t);
  console.log(`\n── ${def.name}  (${def.id})${def.mode ? `  [${def.mode}]` : ''}`);
  const d = buildLevel(def);
  // Scenery colliders (tree trunks) are walls, not places you can stand.
  const plats = d.solids.filter(s => !s.scenery)
    .map(s => ({ s, r: rect(s), top: s.y, spring: s.crate?.kind === 'spring' }));

  if (!d.goal && !def.hub) fail('no goal');
  if (!def.start) fail('no start');
  if (def.killY === undefined && !d.ground) fail('needs either a ground() or an explicit killY');
  // A stroke or a thruster climbs forever. Without a roof the level is not a
  // corridor any more — you rise out of it and the goal is the only thing left.
  if (free && def.ceilY === undefined) fail(`${def.mode} levels need a ceilY (the water surface / the sky)`);

  // Movers reach their far end, so a mover connects BOTH endpoints.
  const movEnd = new Map(d.movers.map(m => [m.s, m.to]));
  const footprints = p => {
    const e = movEnd.get(p.s);
    if (!e) return [{ r: p.r, top: p.top }];
    return [{ r: p.r, top: p.top }, { r: rect({ ...p.s, x: e.x, z: e.z }), top: e.y }];
  };

  /* ---- reachability flood-fill ---- */
  const start = { x: def.start[0], y: def.start[1], z: def.start[2] };
  const seeds = plats.filter(p => gapPt(start, p.r) < 0.6 && p.top <= start.y + 0.6 && p.top > start.y - 4);
  // You start floating in a swim or flight level; only a runner needs a floor.
  if (!seeds.length && !free) fail(`start ${JSON.stringify(def.start)} has no ground under it`);

  /** How fast you leave a platform. `t.JUMP_V`, because a mode that changes
   *  the jump changes every arc drawn from it — the moon jumps higher and much
   *  slower than the running game, and judging it by T would fail every gap in
   *  the level. A spring is the exception: src/world.js bounces you at a
   *  multiple of the GLOBAL constant, so the checker must too.
   *
   *  Free modes are the other exception. Vertical travel there is unbounded and
   *  the tank pass below is what actually proves the level, so their arc model
   *  stays deliberately generous rather than pretending one stroke is a jump. */
  const launchV = p => p.spring ? T.JUMP_V * 1.35 : (free ? T.JUMP_V : t.JUMP_V);
  function edgeRatio(a, b) {
    let best = Infinity;
    for (const fa of footprints(a)) for (const fb of footprints(b)) {
      const dy = fb.top - fa.top, v = launchV(a);
      const r = Math.max(reach(dy, v), reach(dy, v, true));
      if (r <= 0) continue;
      best = Math.min(best, gap(fa.r, fb.r) / r);
    }
    return best;
  }

  // A stroke or a thruster reaches any open point, so flood-filling a jump arc
  // would only prove something that isn't in question. Everything counts as
  // reached; the geometry checks below are what carry a free-mode level.
  const reached = free ? new Set(plats) : new Set(seeds);
  const queue = free ? [] : [...seeds];
  while (queue.length) {
    const a = queue.pop();
    for (const b of plats) {
      if (reached.has(b) || edgeRatio(a, b) > 1) continue;
      reached.add(b); queue.push(b);
    }
  }

  /* ---- can you actually CROSS a free-mode level on one tankful at a time? ----
     The flood fill above deliberately gives up on free modes, and used to be
     the end of it: height was free, so everything was reachable by definition.
     It is not any more — the tank only refills with your feet on something —
     so this is the pass that proves the level still joins up. */
  if (hasTank(t)) {
    const range = tankReach(t);
    const tankEdge = (a, b) => {
      let best = Infinity;
      for (const fa of footprints(a)) for (const fb of footprints(b)) {
        const r = range(fb.top - fa.top);
        if (r > 0) best = Math.min(best, gap(fa.r, fb.r) / r);
      }
      return best;
    };
    // You start floating; the seed is whatever you can first put your feet on.
    const seed = plats.filter(p => gapPt(start, p.r) < 6 && p.top <= start.y + 2);
    const got = new Set(seed), q = [...seed];
    while (q.length) {
      const a = q.pop();
      for (const b of plats) {
        if (got.has(b) || tankEdge(a, b) > SAFETY) continue;
        got.add(b); q.push(b);
      }
    }
    const onTank = (p, hr, vUp, vDown) => [...got].some(pl =>
      footprints(pl).some(f => gapPt(p, f.r) <= hr && p.y <= f.top + vUp && p.y >= f.top - vDown));
    if (!seed.length) fail('nothing to land on near the start — the tank can never fill');
    if (d.goal && !onTank(d.goal, 3.4, 6, 6)) fail(`goal at z=${d.goal.z.toFixed(0)} is beyond refuelling range`);
    for (const c of d.checkpoints)
      if (!onTank(c, 3.0, 4, 4)) fail(`checkpoint at z=${c.z.toFixed(0)} is beyond refuelling range`);
    const dry = plats.filter(p => !got.has(p) && !p.s.crate && !p.s.moving && !p.s.scenery);
    if (dry.length)
      warn(`${dry.length} platform(s) unreachable on one tankful, e.g. ${dry.slice(0, 3).map(p => `(${p.s.x.toFixed(0)},${p.top.toFixed(1)},${p.s.z.toFixed(0)})`).join(' ')}`);
    console.log(`  tank: ${range(0).toFixed(0)}u flat / ${(t.BURN ? t.CLIMB / t.BURN : Math.floor(1 / t.STROKE_COST) * t.JUMP_V ** 2 / (2 * t.GRAV)).toFixed(0)}u up on one fill`);
  }

  const unreached = plats.filter(p => !reached.has(p) && !p.s.crate);
  if (unreached.length)
    warn(`${unreached.length} platform(s) never reachable, e.g. ${unreached.slice(0, 3).map(p => `(${p.s.x.toFixed(0)},${p.top.toFixed(1)},${p.s.z.toFixed(0)})`).join(' ')}`);

  // Bottleneck = for each reached platform, its EASIEST way in; the worst of
  // those is the hardest jump the level actually forces on you. (Doing this as
  // a post-pass matters: during the flood fill you get whichever edge happened
  // to discover the node first, which is noise.)
  let worstRatio = 0, worstDesc = '';
  for (const b of free ? [] : reached) {
    if (seeds.includes(b)) continue;
    let easiest = Infinity;
    for (const a of reached) if (a !== b) easiest = Math.min(easiest, edgeRatio(a, b));
    if (easiest > worstRatio) {
      worstRatio = easiest;
      worstDesc = `${b.s.tex} top y=${b.top.toFixed(1)} z=${b.s.z.toFixed(1)}`;
    }
  }

  // Things you must LAND on: strict — a footprint you can stand within.
  const canLand = (p, hr, vUp, vDown = 3) => [...reached].some(pl =>
    footprints(pl).some(f => gapPt(p, f.r) <= hr && p.y <= f.top + vUp && p.y >= f.top - vDown));
  // Things you only have to PASS THROUGH: model the jump envelope, because a
  // star trail arcing over a gap is mid-air by design.
  const canPass = (p, hr) => [...reached].some(pl => {
    const v = launchV(pl);
    const grav = free ? T.GRAV : t.GRAV;              // see launchV
    return footprints(pl).some(f => {
      const dy = p.y - f.top - 0.9;                   // star sits ~chest height
      if (dy > v ** 2 / (2 * grav) + H2) return false;
      if (dy < -8) return false;                      // you'd fall straight past it
      return gapPt(p, f.r) <= reach(Math.max(0, dy), v, true) * 0.5 + hr;
    });
  });

  if (d.goal && !canLand(d.goal, 3.4, H1 + H2 + 2, 4)) fail(`goal at z=${d.goal.z.toFixed(0)} is unreachable`);
  // A portal you cannot walk to is a level you cannot play.
  for (const p of d.portals || []) {
    if (!canLand(p, 3.0, H1 + 2, 3))
      fail(`portal to level ${p.level} at (${p.x},${p.z}) is unreachable`);
    if (LEVELS[p.level] === undefined) fail(`portal points at level ${p.level}, which does not exist`);
  }
  if (def.hub && (d.portals || []).length !== LEVELS.length)
    fail(`hub has ${(d.portals || []).length} portals for ${LEVELS.length} levels`);
  for (const c of d.checkpoints)
    if (!canLand(c, 2.8, H1 + 2, 3)) fail(`checkpoint at z=${c.z.toFixed(0)} is unreachable`);

  /* ---- a prop you can land on ----
   * B.prop() draws a box and gives it NO collider, which is the whole point —
   * a distant mesa must not be a platform the gate has to prove you can climb.
   * The failure mode is the mirror image: put one within reach and the player
   * jumps onto something solid-looking and drops straight through it.
   *
   * Reported from a real playtest — a moon lander parked 2.5u off the starting
   * platform, in the one level where a jump covers 8.8u. The rule in AGENTS.md
   * said "keep props off the corridor" and a rule that is only in prose is a
   * rule that gets broken.
   */
  for (const pr of d.props || []) {
    const r = rect(pr);
    let ratio = Infinity;
    for (const pl of reached) for (const f of footprints(pl)) {
      const dy = pr.y - f.top;
      // Free modes climb without limit, so an arc says nothing there; anything
      // near the play space is reachable by definition.
      if (free) { ratio = Math.min(ratio, gap(f.r, r) / 10); continue; }
      const v = launchV(pl);
      const reachable = Math.max(reach(dy, v), reach(dy, v, true));
      if (reachable > 0) ratio = Math.min(ratio, gap(f.r, r) / reachable);
    }
    if (ratio <= 1)
      fail(`prop at (${pr.x},${pr.y},${pr.z}) is within jumping reach — the player will land on it `
        + `and fall through. Move it out of reach, or use wall() so it is solid.`);
  }

  /* ---- something standing on a checkpoint ----
   * You have to touch a checkpoint to take it (world.js: near(..., 1.8, 3.2)),
   * so anything parked on one is damage you cannot avoid. A prickle is the
   * worst case — it cannot be stomped or spun — and that is exactly what got
   * shipped on the moon, at the identical coordinate.
   */
  for (const [what, at] of [...d.checkpoints.map(c => ['checkpoint', c]),
                            ...(d.goal ? [['goal', d.goal]] : [])]) {
    for (const e of d.enemies) {
      const b = BODY[e.kind];
      if (!b || e.hp) continue;                       // the boss owns his arena
      if (Math.hypot(e.x - at.x, e.z - at.z) > b.radius + 1.5) continue;
      if (Math.abs(e.y - at.y) > 2.5) continue;
      fail(`${e.kind} at (${e.x},${e.y},${e.z}) is sitting on the ${what} — you cannot take it without being hit`);
    }
  }
  // Crates ARE platforms, so reachability is exact — no modelling needed.
  const badCrates = d.crates.filter(c => !reached.has(plats.find(p => p.s.crate === c)));
  if (badCrates.length) fail(`${badCrates.length} crate(s) unreachable, e.g. ${badCrates.slice(0, 3).map(c => `(${c.x.toFixed(0)},${c.y.toFixed(1)},${c.z.toFixed(0)})`).join(' ')}`);
  const badStars = d.stars.filter(s => !canPass(s, 1.35));
  if (badStars.length) fail(`${badStars.length} star(s) unreachable, e.g. ${badStars.slice(0, 3).map(s => `(${s.x.toFixed(0)},${s.y.toFixed(1)},${s.z.toFixed(0)})`).join(' ')}`);

  // Crates FALL now when nothing holds them up, so a crate authored over thin
  // air is no longer a floating crate — it is a crate that quietly relocates
  // the moment the level loads, taking its stars somewhere you didn't put them.
  for (const c of d.crates) {
    const b = { x0: c.x - 0.9, x1: c.x + 0.9, z0: c.z - 0.9, z1: c.z + 0.9 };
    const held = d.solids.some(s => {
      if (s.crate === c || s.scenery) return false;
      const r = rect(s);
      return r.x1 > b.x0 + 0.02 && r.x0 < b.x1 - 0.02
        && r.z1 > b.z0 + 0.02 && r.z0 < b.z1 - 0.02
        && Math.abs(s.y - c.y) < 0.05;
    });
    if (!held) fail(`crate at (${c.x},${c.y},${c.z}) has nothing under it — it will fall on load`);
    // A kind nobody implements is worth nothing, wears no stencil, and takes
    // src/world.js down the first time you touch it (`CRATE[c.kind].spring`).
    if (!(c.kind in CRATE_STARS)) fail(`crate at (${c.x},${c.y},${c.z}) has unknown kind '${c.kind}'`);
  }

  // A tnt crate pays out by taking its neighbours with it, so one on its own
  // is a crate worth zero stars with a fuse drawn on it — which reads to a kid
  // as a bug in the game rather than a decision.
  for (const c of d.crates) {
    if (c.kind !== 'tnt') continue;
    const n = d.crates.filter(o => o !== c && o.kind !== 'tnt'
      && Math.hypot(o.x - c.x, o.y - c.y, o.z - c.z) <= TNT_R).length;
    if (!n) warn(`tnt at (${c.x},${c.y},${c.z}) has nothing in blast range — it is worth 0 stars`);
  }

  // Ground enemies need floor. A grumblin in mid-air is a level-design typo.
  for (const e of d.enemies) {
    if (FLOATING.has(e.kind)) continue;
    const under = d.solids.some(s => {
      const r = rect(s);
      return e.x >= r.x0 - .6 && e.x <= r.x1 + .6 && e.z >= r.z0 - .6 && e.z <= r.z1 + .6
        && Math.abs(s.y - e.y) < 0.6;
    });
    if (!under) fail(`${e.kind} at (${e.x},${e.y},${e.z}) has no floor under it`);
  }

  // A patrol that spends half its circuit inside a rock. The placed position is
  // fine and the diff looks fine — it is the SWEPT volume that clips, so the
  // only way to see it is to sweep it. Enemies pass through each other and the
  // player on purpose; passing through the level is not on purpose.
  for (const e of d.enemies) {
    const b = BODY[e.kind];
    if (!b) continue;
    const range = e.opt.range ?? b.range, bob = e.opt.bob ?? b.bob;
    const ax = e.opt.axis === 'x';
    // grumblin/flapjack/zapdrone sweep +-range/2 along `axis` (z by default);
    // prickle and jelly hold station. Bob is vertical, either side of `y`.
    const half = (BODY[e.kind].range === 0 && e.kind !== 'grumblin' ? 0 : range) / 2;
    const box = {
      x0: e.x - b.radius - (ax ? half : 0), x1: e.x + b.radius + (ax ? half : 0),
      z0: e.z - b.radius - (ax ? 0 : half), z1: e.z + b.radius + (ax ? 0 : half),
      y0: e.y - bob, y1: e.y + bob + b.height,
    };
    // A ground enemy's feet are ON its floor, so ignore whatever it stands on.
    const standing = !FLOATING.has(e.kind);
    // Depth, not contact: half the level is built out of abutting slabs and a
    // patrol that grazes one by 0.2u is invisible. 0.4u is where it starts to
    // read on screen as "that thing just went into the rock".
    const DEEP = 0.4;
    let worst = null;
    for (const s of d.solids) {
      if (s.scenery) continue;
      if (standing && Math.abs(s.y - e.y) < 0.6) continue;
      const r = rect(s);
      const pen = Math.min(
        Math.min(box.x1, r.x1) - Math.max(box.x0, r.x0),
        Math.min(box.z1, r.z1) - Math.max(box.z0, r.z0),
        Math.min(box.y1, s.y) - Math.max(box.y0, s.y - s.h));
      if (pen >= DEEP && (!worst || pen > worst.pen)) worst = { s, pen };
    }
    if (worst)
      fail(`${e.kind} at (${e.x},${e.y},${e.z}) sweeps ${worst.pen.toFixed(1)}u into the ${worst.s.tex} at (${worst.s.x},${worst.s.y},${worst.s.z})`);
  }

  /* ---- boss levels ----
   * The gate opens when the boss goes down, so the two are one mechanism and
   * either one alone is a broken level: a gate with no king never opens (the
   * goal behind it is unreachable forever), and a king with no gate is a boss
   * you can simply run past. The flood fill cannot see this — a gate is
   * `scenery`, so it isn't a platform and doesn't block a jump — which is
   * exactly why it needs its own pass.
   */
  const kings = d.enemies.filter(e => e.kind === 'king');
  const gates = d.gates || [];
  if (gates.length && !kings.length) fail(`${gates.length} gate(s) but no king to open them`);
  if (kings.length && !gates.length) fail('a king with no gate() guards nothing');
  if (kings.length > 1) fail(`${kings.length} kings — the gate opens on the first one down`);
  for (const k of kings) {
    // He is leashed to a radius around where he was placed. Unleashed he
    // wanders off the arena, and a boss in the sea is a gate that never opens.
    const r = k.opt.arena ?? ENEMY_ARENA_DEFAULT;
    const floor = d.solids.find(s => {
      const q = rect(s);
      return !s.scenery && Math.abs(s.y - k.y) < 0.4
        && k.x - r >= q.x0 - .01 && k.x + r <= q.x1 + .01
        && k.z - r >= q.z0 - .01 && k.z + r <= q.z1 + .01;
    });
    if (!floor) fail(`king at (${k.x},${k.y},${k.z}) has arena ${r} but no single floor covers that circle`);
  }

  // Nothing playable should sit at or below the kill plane.
  const killY = killPlane(def, d);
  for (const s of d.solids) if (s.y <= killY) fail(`solid top y=${s.y} is at/below the kill plane ${killY}`);

  // Scenery must stand on something — a platform top, or the world floor.
  // A tree hovering half a level up is the most obvious kind of broken.
  for (const t of d.trees) {
    const onGround = d.ground && Math.abs(t.y - d.ground.y) < 0.4;
    const onSolid = d.solids.some(s => {
      const r = rect(s);
      return t.x >= r.x0 - .2 && t.x <= r.x1 + .2 && t.z >= r.z0 - .2 && t.z <= r.z1 + .2
        && Math.abs(s.y - t.y) < 0.4;
    });
    if (!onGround && !onSolid) fail(`tree at (${t.x},${t.y},${t.z}) is floating`);
    // A kind world.js can't draw silently plants nothing at all.
    if (!FLORA.has(t.kind || 'pine')) fail(`tree at (${t.x},${t.y},${t.z}) has unknown kind '${t.kind}'`);
    // trunkSolid models a TREE TRUNK. Making kelp solid would put an invisible
    // 6u post in the water where the art is a soft frond you swim through.
    if (t.solid && (t.kind || 'pine') !== 'pine') fail(`${t.kind} at (${t.x},${t.y},${t.z}) is solid — only pines have a trunk`);
  }

  // Two platforms with the same top height that overlap in plan will z-fight:
  // coplanar faces, no depth ordering, shimmering seam. Abutting is fine.
  for (let i = 0; i < d.solids.length; i++) for (let j = i + 1; j < d.solids.length; j++) {
    const a = d.solids[i], b = d.solids[j];
    if (a.crate || b.crate || a.moving || b.moving || a.scenery || b.scenery) continue;
    if (Math.abs(a.y - b.y) > 0.02) continue;
    const ra = rect(a), rb = rect(b);
    const ox = Math.min(ra.x1, rb.x1) - Math.max(ra.x0, rb.x0);
    const oz = Math.min(ra.z1, rb.z1) - Math.max(ra.z0, rb.z0);
    if (ox > 0.01 && oz > 0.01)
      fail(`z-fight: coplanar tops at y=${a.y} overlap ${ox.toFixed(1)}x${oz.toFixed(1)}u near z=${b.z.toFixed(0)}`);
  }

  // The kill plane must sit ABOVE a visible world floor, or the player falls
  // through the scenery and vanishes underneath it before dying.
  if (d.ground && killY <= d.ground.y)
    fail(`kill plane ${killY} is at/below the world floor ${d.ground.y} — you'd sink through it`);

  const label = ([k, p]) => `${k}(${p.x.toFixed(0)},${p.y.toFixed(1)},${p.z.toFixed(0)})`;
  const pickups = [
    ...d.stars.map(s => ['star', s]), ...d.crates.map(c => ['crate', c]),
    ...d.checkpoints.map(c => ['checkpoint', c]), ...(d.goal ? [['goal', d.goal]] : []),
  ];

  // Nothing playable above the roof of a swim or flight level. The roof is the
  // only thing keeping it a corridor instead of open sky.
  if (def.ceilY !== undefined) {
    const over = pickups.filter(([, p]) => p.y > def.ceilY - 0.4);
    if (over.length) fail(`${over.length} item(s) at/above the ceiling ${def.ceilY}, e.g. ${over.slice(0, 3).map(label).join(' ')}`);
    if (def.start && def.start[1] > def.ceilY) fail(`start is above the ceiling ${def.ceilY}`);
  }

  // Content buried inside a solid: invisible and uncollectable, and the flood
  // fill can't see it because the platform it sits in is perfectly reachable.
  const inside = p => d.solids.some(s => {
    const b = rect(s);
    return p.x > b.x0 + .05 && p.x < b.x1 - .05 && p.z > b.z0 + .05 && p.z < b.z1 - .05
      && p.y > s.y - s.h + .05 && p.y < s.y - .05;
  });
  const buried = [...pickups, ...d.enemies.map(e => [e.kind, e])].filter(([, p]) => inside(p));
  if (buried.length) fail(`${buried.length} item(s) buried inside a solid, e.g. ${buried.slice(0, 3).map(label).join(' ')}`);

  if (worstRatio > SAFETY)
    warn(`tightest required jump eats ${(worstRatio * 100).toFixed(0)}% of the jump arc (want <${SAFETY * 100}%) — ${worstDesc}`);

  const totalStars = d.stars.length + d.crates.reduce((n, c) => n + (CRATE_STARS[c.kind] || 0), 0);
  // Length is a first-class number here: "the levels are too short" was the
  // headline playtest note, and star counts alone don't answer it.
  const zs = d.solids.map(s => s.z);
  const len = Math.max(...zs) - Math.min(...zs);
  console.log(`  length ${len.toFixed(0)}u  solids ${d.solids.length}  stars ${d.stars.length}  crates ${d.crates.length}  enemies ${d.enemies.length}  movers ${d.movers.length}  → ${totalStars} collectable stars`);
}

const A = arcs(T);
console.log(`\nreach (running): single ${A.reach(0).toFixed(1)}u flat / ${A.H1.toFixed(2)}u up · double ${A.reach(0, T.JUMP_V, true).toFixed(1)}u flat / ${(A.H1 + A.H2).toFixed(2)}u up`);
console.log(failures ? `\nFAIL — ${failures} error(s), ${warnings} warning(s)` : `\nPASS — ${warnings} warning(s)`);
process.exit(failures ? 1 : 0);
