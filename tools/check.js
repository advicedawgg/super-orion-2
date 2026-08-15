// node tools/check.js
//
// The gate. Runs the REAL builder (src/builder.js) and the REAL physics
// constants (src/physics.js), then proves each level is actually completable:
// flood-fills the platform graph from the start point using jump arcs derived
// from the tuning, and fails if the goal, a checkpoint, a crate or a star
// can't be reached. Eyeballing level geometry does not work. This does.

import { LEVELS } from '../src/levels.js';
import { buildLevel, killPlane } from '../src/builder.js';
import { T } from '../src/physics.js';

const SAFETY = 0.85;          // players are not frame-perfect; demand slack
const TIGHT = 0.95;           // above this fraction of theoretical reach = warn

/* ------------------------------------------------------------- jump model */
const H1 = T.JUMP_V ** 2 / (2 * T.GRAV);
const H2 = T.JUMP2_V ** 2 / (2 * T.GRAV);

/** Furthest horizontal travel that still lands `dy` above the take-off point. */
function reach(dy, v = T.JUMP_V, dbl = false) {
  const h1 = v ** 2 / (2 * T.GRAV);
  const rise = dbl ? h1 + H2 : h1;
  if (dy > rise) return -1;                                  // can't get up there
  const up = (v + (dbl ? T.JUMP2_V : 0)) / T.GRAV;
  const fall = Math.sqrt(Math.max(0, 2 * (rise - dy) / T.GRAV));
  return T.SPEED * (up + fall);
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

for (const def of LEVELS) {
  console.log(`\n── ${def.name}  (${def.id})`);
  const d = buildLevel(def);
  // Scenery colliders (tree trunks) are walls, not places you can stand.
  const plats = d.solids.filter(s => !s.scenery)
    .map(s => ({ s, r: rect(s), top: s.y, spring: s.crate?.kind === 'spring' }));

  if (!d.goal) fail('no goal');
  if (!def.start) fail('no start');
  if (def.killY === undefined && !d.ground) fail('needs either a ground() or an explicit killY');

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
  if (!seeds.length) fail(`start ${JSON.stringify(def.start)} has no ground under it`);

  /** Fraction of a's jump arc that getting to b consumes. >1 = impossible. */
  const launchV = p => p.spring ? T.JUMP_V * 1.35 : T.JUMP_V;
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

  const reached = new Set(seeds);
  const queue = [...seeds];
  while (queue.length) {
    const a = queue.pop();
    for (const b of plats) {
      if (reached.has(b) || edgeRatio(a, b) > 1) continue;
      reached.add(b); queue.push(b);
    }
  }

  const unreached = plats.filter(p => !reached.has(p) && !p.s.crate);
  if (unreached.length)
    warn(`${unreached.length} platform(s) never reachable, e.g. ${unreached.slice(0, 3).map(p => `(${p.s.x.toFixed(0)},${p.top.toFixed(1)},${p.s.z.toFixed(0)})`).join(' ')}`);

  // Bottleneck = for each reached platform, its EASIEST way in; the worst of
  // those is the hardest jump the level actually forces on you. (Doing this as
  // a post-pass matters: during the flood fill you get whichever edge happened
  // to discover the node first, which is noise.)
  let worstRatio = 0, worstDesc = '';
  for (const b of reached) {
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
    return footprints(pl).some(f => {
      const dy = p.y - f.top - 0.9;                   // star sits ~chest height
      if (dy > v ** 2 / (2 * T.GRAV) + H2) return false;
      if (dy < -8) return false;                      // you'd fall straight past it
      return gapPt(p, f.r) <= reach(Math.max(0, dy), v, true) * 0.5 + hr;
    });
  });

  if (d.goal && !canLand(d.goal, 3.4, H1 + H2 + 2, 4)) fail(`goal at z=${d.goal.z.toFixed(0)} is unreachable`);
  for (const c of d.checkpoints)
    if (!canLand(c, 2.8, H1 + 2, 3)) fail(`checkpoint at z=${c.z.toFixed(0)} is unreachable`);
  // Crates ARE platforms, so reachability is exact — no modelling needed.
  const badCrates = d.crates.filter(c => !reached.has(plats.find(p => p.s.crate === c)));
  if (badCrates.length) fail(`${badCrates.length} crate(s) unreachable, e.g. ${badCrates.slice(0, 3).map(c => `(${c.x.toFixed(0)},${c.y.toFixed(1)},${c.z.toFixed(0)})`).join(' ')}`);
  const badStars = d.stars.filter(s => !canPass(s, 1.35));
  if (badStars.length) fail(`${badStars.length} star(s) unreachable, e.g. ${badStars.slice(0, 3).map(s => `(${s.x.toFixed(0)},${s.y.toFixed(1)},${s.z.toFixed(0)})`).join(' ')}`);

  // Ground enemies need floor. A grumblin in mid-air is a level-design typo.
  for (const e of d.enemies) {
    if (e.kind === 'flapjack') continue;
    const under = d.solids.some(s => {
      const r = rect(s);
      return e.x >= r.x0 - .6 && e.x <= r.x1 + .6 && e.z >= r.z0 - .6 && e.z <= r.z1 + .6
        && Math.abs(s.y - e.y) < 0.6;
    });
    if (!under) fail(`${e.kind} at (${e.x},${e.y},${e.z}) has no floor under it`);
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

  if (worstRatio > SAFETY)
    warn(`tightest required jump eats ${(worstRatio * 100).toFixed(0)}% of the jump arc (want <${SAFETY * 100}%) — ${worstDesc}`);

  const totalStars = d.stars.length + d.crates.reduce((n, c) => n + ({ plain: 1, star: 5 }[c.kind] || 0), 0);
  console.log(`  solids ${d.solids.length}  stars ${d.stars.length}  crates ${d.crates.length}  enemies ${d.enemies.length}  movers ${d.movers.length}  → ${totalStars} collectable stars`);
}

console.log(`\nreach: single ${reach(0).toFixed(1)}u flat / ${H1.toFixed(2)}u up · double ${reach(0, T.JUMP_V, true).toFixed(1)}u flat / ${(H1 + H2).toFixed(2)}u up`);
console.log(failures ? `\nFAIL — ${failures} error(s), ${warnings} warning(s)` : `\nPASS — ${warnings} warning(s)`);
process.exit(failures ? 1 : 0);
