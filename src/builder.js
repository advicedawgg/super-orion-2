// The level-authoring API. Deliberately free of THREE and the DOM so that
// tools/check.js runs the *real* builder in node rather than a lookalike —
// a checker that models the world separately is a checker that lies.
//
// Output is plain data; src/world.js turns it into meshes.

export const CRATE_SIZE = 1.8;

/**
 * What each crate kind is WORTH. Here, in the pure module, because both
 * src/world.js (which pays it out) and tools/check.js (which counts a level's
 * total) need the same number — and for two years they each had their own
 * copy, so a new kind was worth 5 stars in the game and 0 in the gate.
 *
 * `tnt` is worth nothing itself: it pays out by taking its neighbours with it.
 */
export const CRATE_STARS = { plain: 1, star: 5, iron: 3, life: 0, heart: 0, spring: 0, tnt: 0 };

/** How far a tnt crate reaches. The game blows crates up with it and the
 *  checker uses it to refuse a fuse it cannot see the point of. */
export const TNT_R = 4.6;

/**
 * Enemy kinds that hover instead of standing on something. Lives here, in the
 * pure module, because tools/check.js fails a ground enemy placed in mid-air
 * and must not fail a jellyfish for the same reason. world.js owns how they
 * look and move; this is the only fact the checker needs.
 */
export const FLOATING = new Set(['flapjack', 'jelly', 'zapdrone']);

/**
 * The flora kinds src/world.js can draw. Only 'pine' has a trunk you can bump
 * into; the underwater ones are soft scenery you swim straight through, which
 * is why `tree()` refuses to make them solid. Here, in the pure module, so the
 * checker can reject a typo'd kind instead of the game drawing nothing.
 */
export const FLORA = new Set(['pine', 'kelp', 'coral', 'fan', 'crystal', 'cactus', 'shrub']);

/**
 * How big each enemy is and how far it moves when the level doesn't say.
 * Here, in the pure module, because tools/check.js needs the same numbers to
 * sweep a patrol path through the level and catch a bat that spends half its
 * circuit inside a rock — which is invisible in the diff and obvious on screen.
 * src/world.js spreads these into ENEMY and owns the art and the tick.
 *
 * `range` is the FULL sweep (the tick moves +-range/2) along `axis`, and `bob`
 * is the vertical amplitude either side of the placed y.
 */
export const BODY = {
  grumblin: { radius: .75, height: 1.2, range: 6, bob: 0 },
  // A grumblin in a hard hat: the stomp bounces off the helmet, so this one
  // is the level teaching you the X button. Taller than a grumblin by the
  // height of the hat, which is the whole reason you can't land on it.
  hardhat: { radius: .78, height: 1.45, range: 6, bob: 0 },
  // Hops on the spot instead of walking. `bob` is its hop height, which the
  // swept-patrol pass reads as vertical travel — the same field a jellyfish
  // uses, because to the checker "moves up and down" is one question.
  hopper: { radius: .7, height: 1.05, range: 4, bob: 1.6 },
  prickle: { radius: .8, height: 1.0, range: 0, bob: 0 },
  jelly: { radius: .85, height: 1.7, range: 0, bob: 2.2 },
  zapdrone: { radius: .8, height: 1.2, range: 8, bob: .6 },
  flapjack: { radius: .7, height: 1.0, range: 5, bob: 1.4 },
  // The boss. range/bob 0: he does not patrol a line, he hops at YOU, and the
  // swept-patrol pass would otherwise sweep a circuit he never walks. What
  // keeps him honest is `arena` (see the king in world.js), which clamps him to
  // a radius around where he was placed — a boss that can leave the arena can
  // fall out of it, and a dead-and-gone boss is a gate that never opens.
  king: { radius: 1.15, height: 2.6, range: 0, bob: 0 },
};

/** Crate collider, derived in ONE place so the game and the checker agree. */
export const crateSolid = c => ({
  x: c.x, y: c.y + CRATE_SIZE, z: c.z,
  w: CRATE_SIZE, d: CRATE_SIZE, h: CRATE_SIZE, tex: 'crate', crate: c,
});

/**
 * Trunk collider for a solid tree. Runs the FULL height of the tree, not just
 * the visible trunk, so you can't perch on a branchless stump. Tagged
 * `scenery` so the checker doesn't treat it as a platform.
 */
export const trunkSolid = t => ({
  x: t.x, y: t.y + 6.2 * t.s, z: t.z,
  w: 0.85 * t.s, d: 0.85 * t.s, h: 6.2 * t.s, tex: 'wood', scenery: true,
});

/**
 * The height a fall becomes a death. Derived in ONE place so the game and the
 * checker agree — and so it can never be set BELOW a visible world floor,
 * which makes you sink through the scenery before dying.
 */
export const killPlane = (def, data) =>
  data.ground ? data.ground.y + 1.2 : (def.killY ?? -20);

class Builder {
  constructor(out) { this.o = out; }

  /** Solid box. (x,y,z) is the centre of the TOP face; it hangs `h` down. */
  box(x, y, z, w, d, h = 2, tex = 'grass') {
    const s = { x, y, z, w, d, h, tex };
    this.o.solids.push(s);
    return s;
  }
  /** Ground slab: a box thick enough that you never see under it. */
  floor(x, y, z, w, d, tex = 'grass') { return this.box(x, y, z, w, d, 6, tex); }
  /** A straight run of ground between two Z values. */
  path(x, y, z0, z1, w = 8, tex = 'grass') {
    return this.floor(x, y, (z0 + z1) / 2, w, Math.abs(z1 - z0), tex);
  }
  wall(x, y, z, w, d, h, tex = 'rock') { return this.box(x, y, z, w, d, h, tex); }
  /**
   * A ceiling. Solid like any other box, but it does NOT cast a shadow — a slab
   * hanging over the whole play space blacks out everything under it, and the
   * level you enclosed to stop the player flying over it becomes a level nobody
   * can see. The shadow is worth less than the room.
   */
  roof(x, y, z, w, d, h, tex = 'rock') {
    const s = this.box(x, y, z, w, d, h, tex);
    s.noShadow = true;
    return s;
  }

  /**
   * An invisible wall: the collider of wall(), with no mesh and no standing on
   * top. `scenery` is the flag tree trunks already use for exactly this, so
   * src/world.js skips drawing it and tools/check.js skips treating it as a
   * platform — both for free.
   *
   * Use it where the visible fence is waist-high on purpose. A rail you can
   * see over is a rail a double jump clears (4.08u), and raising the real one
   * to beat that walls the view in.
   */
  barrier(x, y, z, w, d, h) {
    const s = this.box(x, y, z, w, d, h, 'rock');
    s.scenery = true;
    return s;
  }

  /** Platform sliding between here and `to`. period = seconds per round trip. */
  mover(x, y, z, w, d, h, to, period = 4, tex = 'metal') {
    const s = this.box(x, y, z, w, d, h, tex);
    s.moving = true;
    this.o.movers.push({ s, from: { x, y, z }, to: { x: to[0], y: to[1], z: to[2] }, period, t: 0 });
    return s;
  }

  star(x, y, z) { this.o.stars.push({ x, y, z }); }
  /** `n` stars in a line; `arc` bows them upward like a jump path. */
  starLine(x, y, z, n, stepv = [0, 0, -2], arc = 0) {
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0;
      this.star(x + stepv[0] * i, y + stepv[1] * i + Math.sin(t * Math.PI) * arc, z + stepv[2] * i);
    }
  }
  /** (x,y,z) is the ground the crate SITS on; it occupies y .. y+1.8. */
  crate(x, y, z, kind = 'plain') { this.o.crates.push({ x, y, z, kind }); }
  crateRow(x, y, z, n, kind = 'plain', stepv = [2.1, 0, 0]) {
    for (let i = 0; i < n; i++) this.crate(x + stepv[0] * i, y + stepv[1] * i, z + stepv[2] * i, kind);
  }
  /**
   * The world floor far below the play space — jungle canopy, sea, lava.
   * NOT solid: pits still kill. It exists so the level reads as a place you
   * are running above, instead of platforms floating in a void. Put killY
   * just under it so a fall visibly ends *in* something.
   */
  ground(y, tex = 'grass', size = 420) { this.o.ground = { y, tex, size }; }

  /** A doorway into level `level` (an index into LEVELS). Hub world only. */
  portal(x, y, z, level) { this.o.portals.push({ x, y, z, level }); }

  /**
   * A box you can SEE and cannot touch: a distant mesa, a moon boulder, the
   * spire of a tower off the side of the corridor.
   *
   * It is not a `wall()` because a wall is a platform — the checker would then
   * have to prove you can reach the top of a butte 200u off the path, and the
   * honest answer is that you should not be able to get near it. It is not a
   * `barrier()` either: that has the opposite problem, a collider with no mesh.
   *
   * Rule: keep props OFF the corridor. `keepOrionInSight` only ghosts things in
   * `solids`, so a prop parked between the camera and Orion stays solid-looking
   * and blinds you.
   */
  prop(x, y, z, w, d, h, tex = 'rock') { this.o.props.push({ x, y, z, w, d, h, tex }); }

  /**
   * A cloud. Pure decoration with no collider at all, which is why it is not
   * a `tree`: flora has to stand on something (the checker fails a floating
   * one), and a cloud that has to stand on something is not a cloud.
   *
   * `drift` is how far it slides sideways, in units, over ~40 seconds.
   */
  cloud(x, y, z, s = 1, drift = 0) { this.o.clouds.push({ x, y, z, s, drift }); }

  enemy(kind, x, y, z, opt = {}) { this.o.enemies.push({ kind, x, y, z, opt }); }
  /**
   * The boss gate. A solid wall that CRUMBLES when the boss goes down, so the
   * goal behind it is unreachable until then.
   *
   * Tagged `scenery` on purpose: that is the flag that says "collides, but is
   * not a platform and is not the checker's business", which is exactly right
   * for a wall that opens itself. The checker instead pairs it with the boss —
   * a gate with no king never opens, and a king with no gate guards nothing.
   */
  gate(x, y, z, w, d, h) {
    const s = this.box(x, y, z, w, d, h, 'metal');
    s.scenery = true; s.gate = true;
    this.o.gates.push(s);
    return s;
  }
  checkpoint(x, y, z) { this.o.checkpoints.push({ x, y, z }); }
  goal(x, y, z) { this.o.goal = { x, y, z }; }
  /**
   * A tree. Solid by default — walking through a trunk you're standing next to
   * looks broken. Pass solid=false for distant backdrop trees, which must NOT
   * be solid or a falling player lands on one instead of dying.
   *
   * `kind` picks the art (see FLORA and world.js `addTree`). Everything that
   * isn't a 'pine' is soft-bodied scenery — kelp bends, coral is brittle — and
   * `trunkSolid` models a tree trunk, so the checker fails a solid one.
   */
  tree(x, y, z, s = 1, solid = true, kind = 'pine') { this.o.trees.push({ x, y, z, s, solid, kind }); }
  /** Soft scenery — kelp, coral, a crystal cluster. Never solid, so this is
   *  the honest spelling of it for everything that isn't a tree. */
  weed(x, y, z, s = 1, kind = 'kelp') { this.tree(x, y, z, s, false, kind); }
}

/** Run a level definition's build() and return its plain data. */
export function buildLevel(def) {
  const out = { solids: [], movers: [], stars: [], crates: [], enemies: [], checkpoints: [], goal: null, trees: [], ground: null, portals: [], gates: [], clouds: [], props: [] };
  def.build(new Builder(out));
  for (const c of out.crates) out.solids.push(crateSolid(c));
  for (const t of out.trees) if (t.solid) out.solids.push(trunkSolid(t));
  return out;
}
