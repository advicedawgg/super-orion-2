// The level-authoring API. Deliberately free of THREE and the DOM so that
// tools/check.js runs the *real* builder in node rather than a lookalike —
// a checker that models the world separately is a checker that lies.
//
// Output is plain data; src/world.js turns it into meshes.

export const CRATE_SIZE = 1.8;

/**
 * Enemy kinds that hover instead of standing on something. Lives here, in the
 * pure module, because tools/check.js fails a ground enemy placed in mid-air
 * and must not fail a jellyfish for the same reason. world.js owns how they
 * look and move; this is the only fact the checker needs.
 */
export const FLOATING = new Set(['flapjack', 'jelly', 'zapdrone']);

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
  prickle: { radius: .8, height: 1.0, range: 0, bob: 0 },
  jelly: { radius: .85, height: 1.7, range: 0, bob: 2.2 },
  zapdrone: { radius: .8, height: 1.2, range: 8, bob: .6 },
  flapjack: { radius: .7, height: 1.0, range: 5, bob: 1.4 },
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

  enemy(kind, x, y, z, opt = {}) { this.o.enemies.push({ kind, x, y, z, opt }); }
  checkpoint(x, y, z) { this.o.checkpoints.push({ x, y, z }); }
  goal(x, y, z) { this.o.goal = { x, y, z }; }
  /**
   * A tree. Solid by default — walking through a trunk you're standing next to
   * looks broken. Pass solid=false for distant backdrop trees, which must NOT
   * be solid or a falling player lands on one instead of dying.
   */
  tree(x, y, z, s = 1, solid = true) { this.o.trees.push({ x, y, z, s, solid }); }
}

/** Run a level definition's build() and return its plain data. */
export function buildLevel(def) {
  const out = { solids: [], movers: [], stars: [], crates: [], enemies: [], checkpoints: [], goal: null, trees: [], ground: null };
  def.build(new Builder(out));
  for (const c of out.crates) out.solids.push(crateSolid(c));
  for (const t of out.trees) if (t.solid) out.solids.push(trunkSolid(t));
  return out;
}
