// Orion: ~30 boxes, one 256px atlas, animated by rotating limb groups.
// Exactly how an N64 character was built, minus the skinning.
import * as THREE from 'three';
import { T, step, jumpStep, jumpCut, thrustStep, tuning, isFreeMode } from './physics.js';
import { tex } from './art.js';
import * as In from './input.js';

/* --------------------------------------------------------------- UV help */
// Canvas-space rect (origin top-left, 0..1) -> UV rect, accounting for flipY.
const q = (x, y, w, h) => [x, 1 - (y + h), x + w, 1 - y];
const HEAD_F = q(0, 0, .5, .5), HEAD_S = q(.5, 0, .5, .5);
const HAIR = q(.5, 0, .5, .17), TORSO = q(0, .5, .5, .5);
const TORSO_SIDE = q(0, .5, .05, .5), LIMB = q(.5, .5, .5, .5);
const SLEEVE = q(.5, .5, .5, .18), SHORTS = q(.5, .68, .5, .16);
const LEG = q(.5, .84, .5, .16), SHOE = q(.5, .93, .5, .07);

// BoxGeometry lays out 24 UVs as +X,-X,+Y,-Y,+Z,-Z (4 each). Retarget each
// face onto a rect of the atlas.
function mapUV(geo, faces) {
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const [u0, v0, u1, v1] = faces[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
    }
  }
  uv.needsUpdate = true;
  return geo;
}

function part(w, h, d, faces, mat) {
  return new THREE.Mesh(mapUV(new THREE.BoxGeometry(w, h, d), faces), mat);
}

/* ---------------------------------------------------------------- model */
export function buildOrion() {
  const mat = new THREE.MeshLambertMaterial({ map: tex('orion') });
  const root = new THREE.Group();          // origin = feet
  const body = new THREE.Group(); root.add(body);

  const torso = part(.62, .52, .38, [TORSO_SIDE, TORSO_SIDE, TORSO_SIDE, TORSO_SIDE, TORSO, TORSO], mat);
  torso.position.y = .71; body.add(torso);

  const head = new THREE.Group(); head.position.y = 1.20; body.add(head);
  head.add(part(.50, .46, .44, [HEAD_S, HEAD_S, HAIR, HEAD_S, HEAD_F, HEAD_S], mat));
  const tuft = part(.30, .13, .26, [HAIR, HAIR, HAIR, HAIR, HAIR, HAIR], mat);
  tuft.position.set(0, .26, -.04); tuft.rotation.z = .18; head.add(tuft);

  const limb = (x, y, w, h, d, faces) => {
    const g = new THREE.Group(); g.position.set(x, y, 0);
    const m = part(w, h, d, faces, mat); m.position.y = -h / 2; g.add(m);
    body.add(g); return g;
  };
  const F = r => [r, r, r, r, r, r];
  const armL = limb(-.40, .93, .17, .44, .17, F(SLEEVE));
  const armR = limb(.40, .93, .17, .44, .17, F(SLEEVE));
  for (const g of [armL, armR]) {
    const hand = part(.19, .13, .19, F(LIMB), mat); hand.position.y = -.50; g.add(hand);
  }

  const legL = limb(-.16, .46, .21, .34, .21, F(SHORTS));
  const legR = limb(.16, .46, .21, .34, .21, F(SHORTS));
  for (const g of [legL, legR]) {
    const shin = part(.19, .14, .19, F(LEG), mat); shin.position.y = -.41; g.add(shin);
    const shoe = part(.24, .12, .30, F(SHOE), mat); shoe.position.set(0, -.52, .04); g.add(shoe);
  }

  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, body, head, torso, armL, armR, legL, legR };
}

/* --------------------------------------------------------------- player */
export class Player {
  constructor(scene) {
    this.rig = buildOrion();
    scene.add(this.rig.root);

    // Spin-attack ribbon — two crossed translucent discs, cheap and readable.
    this.spinFx = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(T.SPIN_R * .8, .07, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: .8 }));
      m.rotation.x = Math.PI / 2; m.position.y = .5 + i * .5;
      this.spinFx.add(m);
    }
    this.spinFx.visible = false;
    this.rig.root.add(this.spinFx);

    // Jetpack burn. Two nested cones under the feet — you cannot tell you are
    // thrusting from the altitude alone, and a kid holding a button needs to
    // see that the button is doing something.
    this.jetFx = new THREE.Group();
    for (const [r, h, c, y] of [[.30, 1.5, 0xffb03a, -.75], [.17, .95, 0xfff3b0, -.48]]) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .85 }));
      m.rotation.x = Math.PI; m.position.y = y;
      this.jetFx.add(m);
    }
    this.jetFx.visible = false;
    this.rig.root.add(this.jetFx);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = Math.PI;
    this.t = T;
    this.ceilY = null;
    this.reset(new THREE.Vector3());
  }

  /** Switch movement mode (see MODES in physics.js). `ceilY` caps the FEET. */
  setMode(mode, ceilY = null) {
    this.t = tuning(mode);
    this.ceilY = ceilY;
    this.thrusting = false;
    this.jetFx.visible = false;
  }

  reset(at) {
    this.pos.copy(at); this.vel.set(0, 0, 0);
    this.grounded = false; this.coyote = 0; this.buffer = 0; this.jumps = 0;
    this.spinT = 0; this.spinCd = 0; this.hurtT = 0; this.stomping = false;
    this.squash = 0; this.stride = 0; this.airT = 0; this.cutting = false;
    this.thrusting = false; this.jetFx.visible = false;
    this.rig.root.position.copy(at);
    this.rig.root.visible = true;
  }

  get spinning() { return this.spinT > 0; }
  get invuln() { return this.hurtT > 0; }

  update(dt, solids, camYaw) {
    const t = this.t;
    const ax = In.axis.x, az = In.axis.z;
    // Stick is screen-relative; rotate it into world space by the camera yaw.
    const s = Math.sin(camYaw), c = Math.cos(camYaw);
    const wantX = ax * c + az * s, wantZ = az * c - ax * s;
    const mag = Math.min(1, Math.hypot(wantX, wantZ));

    // --- horizontal ---
    const ctrl = this.grounded ? 1 : t.AIR_CTRL;
    const tgtX = wantX * t.SPEED, tgtZ = wantZ * t.SPEED;
    const rate = (mag > .01 ? t.ACCEL : t.FRICTION) * ctrl * dt;
    this.vel.x += THREE.MathUtils.clamp(tgtX - this.vel.x, -rate, rate);
    this.vel.z += THREE.MathUtils.clamp(tgtZ - this.vel.z, -rate, rate);

    // --- lift: jump, stroke or thrust depending on the mode ---
    if (t.THRUST) {
      const was = this.thrusting;
      this.thrusting = thrustStep(this, dt, In.down('jump'), t);
      if (this.thrusting && !was) this.fire('thrust');
    } else {
      // coyote time + input buffering, the two things that make a platformer
      // feel fair rather than twitchy
      const fired = jumpStep(this, dt, In.hit('jump'), t);
      if (fired) { if (fired === 'jump2') this.squash = -.35; this.fire(fired); }
      jumpCut(this, dt, In.down('jump'), t);
    }
    this.jetFx.visible = !!this.thrusting;
    if (this.thrusting) for (const f of this.jetFx.children) f.scale.set(1, .7 + Math.random() * .6, 1);

    // --- spin / stomp ---
    this.spinCd = Math.max(0, this.spinCd - dt);
    this.spinT = Math.max(0, this.spinT - dt);
    // No ground pound while swimming or flying. `stomping` blocks both the
    // stroke and the thruster until you land, so over open water or a void it
    // takes away every means of lift you have and drops you.
    if (In.hit('stomp') && !isFreeMode(t) && !this.grounded && !this.stomping) {
      this.stomping = true; this.vel.set(0, t.STOMP_V, 0); this.fire('stomp');
    } else if (In.hit('spin') && this.spinCd === 0 && !this.stomping) {
      this.spinT = t.SPIN_TIME; this.spinCd = t.SPIN_TIME + t.SPIN_CD; this.fire('spin');
    }
    this.spinFx.visible = this.spinning;
    if (this.spinning) for (const r of this.spinFx.children) r.rotation.z += dt * 34;

    // --- integrate ---
    this.vel.y = Math.max(-t.MAXFALL, this.vel.y - t.GRAV * dt);
    const was = this.grounded;
    const hitInfo = step(this.pos, this.vel, dt, solids);
    // The roof of a swim or flight level: the water surface, or the sky. Without
    // it there is nothing at all above you and the level stops being a corridor.
    if (this.ceilY !== null && this.pos.y > this.ceilY) {
      this.pos.y = this.ceilY; this.vel.y = Math.min(this.vel.y, 0);
    }
    this.grounded = hitInfo.grounded;
    if (this.grounded) {
      this.jumps = 0;
      if (!was) { this.squash = Math.min(1, this.airT * 1.5); this.fire('land'); }
      if (this.stomping) { this.stomping = false; this.squash = 1; this.fire('stompland'); }
      this.airT = 0;
    } else this.airT += dt;

    this.hurtT = Math.max(0, this.hurtT - dt);
    this.animate(dt, mag);
    return hitInfo;
  }

  /** Overridden by main.js to route into audio/particles. */
  fire() { }

  hurt() {
    if (this.invuln) return false;
    this.hurtT = 1.2; this.vel.y = 9; this.stomping = false;
    return true;
  }

  /** Spring / stomp-bounce. Sets its own height — never subject to jump-cut. */
  bounce(v = T.JUMP_V * .82) {
    this.vel.y = v; this.jumps = 1; this.squash = .5;
    this.stomping = false; this.cutting = false; this.buffer = 0;
  }

  animate(dt, mag) {
    const r = this.rig, sp = Math.hypot(this.vel.x, this.vel.z);
    r.root.position.copy(this.pos);

    if (mag > .05) this.facing = angleTo(this.facing, Math.atan2(this.vel.x, this.vel.z), T.TURN * dt);
    r.root.rotation.y = this.spinning
      ? this.facing + (1 - this.spinT / T.SPIN_TIME) * Math.PI * 6
      : this.facing;

    this.squash = THREE.MathUtils.damp(this.squash, 0, 9, dt);
    const sq = this.squash;
    r.body.scale.set(1 + sq * .30, 1 - sq * .34, 1 + sq * .30);

    this.stride += sp * dt * 2.6;
    const run = Math.min(1, sp / T.SPEED);

    if (this.stomping) {
      r.legL.rotation.x = r.legR.rotation.x = 1.5;
      r.armL.rotation.x = r.armR.rotation.x = -2.4;
      r.body.rotation.x = .5;
    } else if (!this.grounded) {
      const up = THREE.MathUtils.clamp(this.vel.y / this.t.JUMP_V, -1, 1);
      r.legL.rotation.x = -.5 - up * .5; r.legR.rotation.x = .3 + up * .4;
      r.armL.rotation.x = r.armR.rotation.x = -1.5 - up * 1.0;
      r.armL.rotation.z = .35; r.armR.rotation.z = -.35;
      r.body.rotation.x = -up * .18;
    } else {
      const sw = Math.sin(this.stride) * run;
      r.legL.rotation.x = sw * .95; r.legR.rotation.x = -sw * .95;
      r.armL.rotation.x = -sw * .8; r.armR.rotation.x = sw * .8;
      r.armL.rotation.z = .12 + run * .18; r.armR.rotation.z = -.12 - run * .18;
      r.body.rotation.x = run * .16;
      r.body.position.y = Math.abs(Math.cos(this.stride)) * .06 * run;
      if (run < .05) {   // idle breathing
        const b = Math.sin(performance.now() / 520);
        r.body.position.y = b * .022; r.head.rotation.z = b * .05;
      } else r.head.rotation.z = 0;
    }
    if (this.spinning) { r.armL.rotation.z = 1.5; r.armR.rotation.z = -1.5; r.armL.rotation.x = r.armR.rotation.x = 0; }

    // i-frame flicker (body only — the spin ribbon owns its own visibility)
    r.body.visible = !this.invuln || Math.floor(this.hurtT * 22) % 2 === 0;
  }
}

function angleTo(a, b, max) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + THREE.MathUtils.clamp(d, -max, max);
}
