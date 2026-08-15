// Turns a level's plain data (src/builder.js) into meshes, then runs
// everything that isn't the player: stars, crates, enemies, movers, goal.
import * as THREE from 'three';
import { tex, skyTexture } from './art.js';
import { bounds, T } from './physics.js';
import { buildLevel, killPlane, CRATE_SIZE } from './builder.js';

/* ------------------------------------------------------ geometry helpers */
const geoCache = new Map();

// Scale each face's UVs by its own world extent so texel density stays constant
// however big the box is. Without this, wide platforms look smeared.
function tiledBox(w, h, d, scale) {
  const key = `${w},${h},${d},${scale}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];  // +X -X +Y -Y +Z -Z
  for (let f = 0; f < 6; f++) {
    const [su, sv] = spans[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * su / scale, uv.getY(k) * sv / scale);
    }
  }
  uv.needsUpdate = true;
  geoCache.set(key, g);
  return g;
}

const matCache = new Map();
function surface(name) {
  if (!matCache.has(name)) matCache.set(name, new THREE.MeshLambertMaterial({ map: tex(name) }));
  return matCache.get(name);
}

function starGeometry() {
  if (geoCache.has('#star')) return geoCache.get('#star');
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? .17 : .40, a = -Math.PI / 2 + i * Math.PI / 5;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: .13, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 1 });
  g.center();
  geoCache.set('#star', g);
  return g;
}

/* ----------------------------------------------------------------- world */
export class World {
  constructor(scene, def) {
    this.def = def;
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    this.time = 0;
    this.fx = () => { };                      // main.js swaps in the real one

    scene.background = skyTexture(def.sky[0], def.sky[1]);
    scene.fog = new THREE.Fog(def.fog[0], def.fog[1], def.fog[2]);

    const data = buildLevel(def);
    this.killY = killPlane(def, data);
    this.solids = data.solids;
    this.movers = data.movers;
    this.goalPos = data.goal ? new THREE.Vector3(data.goal.x, data.goal.y, data.goal.z) : null;

    // What a fatal fall throws up. Falling into the sea splashes blue; falling
    // into a jungle canopy must not.
    this.splash = SPLASH[data.ground?.tex] ?? 0xd8d8d8;
    if (data.ground) this.addGround(data.ground, def);
    // Crates and tree trunks already have their own art; they only need colliders.
    for (const s of this.solids) if (!s.crate && !s.scenery) this.addSolidMesh(s);
    this.crates = data.crates.map(c => this.addCrate(c));
    this.stars = data.stars.map(s => this.addStar(s));
    this.enemies = data.enemies.map(e => this.addEnemy(e));
    this.checkpoints = data.checkpoints.map(c => this.addCheckpoint(c));
    for (const t of data.trees) this.addTree(t);
    if (this.goalPos) this.addGoal();

    this.totalStars = this.stars.length + this.crates.reduce((n, c) => n + (CRATE[c.kind]?.stars || 0), 0);
  }

  /* ---- construction ---- */
  addSolidMesh(s) {
    const m = new THREE.Mesh(tiledBox(s.w, s.h, s.d, 4), surface(s.tex));
    m.position.set(s.x, s.y - s.h / 2, s.z);
    m.castShadow = true; m.receiveShadow = true;
    s.mesh = m; this.group.add(m);
    return m;
  }

  addStar(p) {
    const m = new THREE.Mesh(starGeometry(), new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x7a5a00 }));
    m.position.set(p.x, p.y, p.z); m.castShadow = true;
    this.group.add(m);
    return { mesh: m, home: p.y, alive: true };
  }

  addCrate(c) {
    const info = CRATE[c.kind] || CRATE.plain;
    const s = this.solids.find(q => q.crate === c);
    const m = new THREE.Mesh(tiledBox(CRATE_SIZE, CRATE_SIZE, CRATE_SIZE, CRATE_SIZE),
      new THREE.MeshLambertMaterial({ map: tex('crate'), color: info.tint }));
    m.position.set(c.x, c.y + CRATE_SIZE / 2, c.z);
    m.castShadow = m.receiveShadow = true;
    this.group.add(m);
    return { s, mesh: m, kind: c.kind, alive: true };
  }

  addEnemy(d) {
    const proto = ENEMY[d.kind];
    const e = { kind: d.kind, ...proto, home: new THREE.Vector3(d.x, d.y, d.z), t: Math.random() * 6, alive: true, ...d.opt };
    e.mesh = proto.build();
    e.mesh.position.set(d.x, d.y, d.z);
    e.mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.group.add(e.mesh);
    e.pos = e.mesh.position;
    return e;
  }

  addCheckpoint(p) {
    const g = new THREE.Group(); g.position.set(p.x, p.y, p.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 3.2, 6), new THREE.MeshLambertMaterial({ color: 0xcfd6e4 }));
    pole.position.y = 1.6; pole.castShadow = true; g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .8),
      new THREE.MeshLambertMaterial({ color: 0x8892a6, side: THREE.DoubleSide }));
    flag.position.set(.65, 2.8, 0); g.add(flag);
    this.group.add(g);
    return { g, flag, pos: new THREE.Vector3(p.x, p.y, p.z), lit: false };
  }

  addGoal() {
    const g = new THREE.Group(); g.position.copy(this.goalPos);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, .28, 8, 24),
      new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x6b4c00 }));
    ring.position.y = 2.6; ring.castShadow = true; g.add(ring);
    const big = new THREE.Mesh(starGeometry(), new THREE.MeshLambertMaterial({ color: 0xfff0a0, emissive: 0x8a6b00 }));
    big.scale.setScalar(3); big.position.y = 2.6; g.add(big);
    this.goalMesh = { g, ring, big };
    this.group.add(g);
  }

  /** The distant world floor. Deliberately NOT added to solids — pits kill. */
  addGround(g, def) {
    const t = tex(g.tex);
    // Tinted down: anything this far below the play space should read as
    // "in shadow, a long way away", not as more of the same floor.
    const m = new THREE.Mesh(new THREE.PlaneGeometry(g.size, g.size),
      new THREE.MeshLambertMaterial({ map: t.clone(), color: 0x9fa8a2 }));
    m.material.map.repeat.set(g.size / 4, g.size / 4);
    m.material.map.needsUpdate = true;
    m.rotation.x = -Math.PI / 2;
    // Centred on the level's mid-point so the plane reaches both ends.
    const zs = this.solids.map(s => s.z);
    m.position.set(0, g.y, (Math.min(...zs) + Math.max(...zs)) / 2);
    m.receiveShadow = true;
    this.group.add(m);
    this.groundY = g.y;
  }

  addTree(t) {
    const g = new THREE.Group(); g.position.set(t.x, t.y, t.z); g.scale.setScalar(t.s);
    const trunk = new THREE.Mesh(tiledBox(.6, 3.4, .6, 2), surface('wood'));
    trunk.position.y = 1.7; g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(2.3 - i * .55, 1.9, 6),
        new THREE.MeshLambertMaterial({ color: [0x2f8b3a, 0x37a044, 0x45b551][i] }));
      leaf.position.y = 3.1 + i * 1.05; g.add(leaf);
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.rotation.y = (t.x * 7.3 + t.z * 3.1) % 6.28;   // varied but deterministic
    this.group.add(g);
  }

  /* ---- runtime ---- */
  update(dt, player) {
    this.time += dt;
    this.moveMovers(dt, player);

    for (const s of this.stars) {
      if (!s.alive) continue;
      s.mesh.rotation.y += dt * 2.4;
      s.mesh.position.y = s.home + Math.sin(this.time * 2.2 + s.home) * .16;
      if (near(player.pos, s.mesh.position, 1.35, 1.9)) {
        s.alive = false; s.mesh.visible = false;
        this.fx('star', s.mesh.position);
      }
    }

    for (const c of this.crates) if (c.alive) this.touchCrate(c, player);
    for (const e of this.enemies) if (e.alive) this.updateEnemy(e, dt, player);

    for (const cp of this.checkpoints) {
      cp.flag.rotation.y = Math.sin(this.time * 2 + cp.pos.z) * .35;
      if (!cp.lit && near(player.pos, cp.pos, 1.8, 3.2)) {
        cp.lit = true;
        cp.flag.material = cp.flag.material.clone();
        cp.flag.material.color.set(0xff5d73);
        this.fx('checkpoint', cp.pos);
      }
    }

    if (this.goalMesh) {
      this.goalMesh.ring.rotation.z += dt * .8;
      this.goalMesh.big.rotation.y += dt * 1.4;
      if (near(player.pos, this.goalPos, 2.4, 4)) return 'win';
    }
    return null;
  }

  moveMovers(dt, player) {
    for (const m of this.movers) {
      m.t += dt;
      const k = .5 - .5 * Math.cos((m.t / m.period) * Math.PI * 2);
      const nx = m.from.x + (m.to.x - m.from.x) * k;
      const ny = m.from.y + (m.to.y - m.from.y) * k;
      const nz = m.from.z + (m.to.z - m.from.z) * k;
      const dx = nx - m.s.x, dy = ny - m.s.y, dz = nz - m.s.z;
      m.s.x = nx; m.s.y = ny; m.s.z = nz; m.s._b = null;
      m.s.mesh.position.set(nx, ny - m.s.h / 2, nz);
      // Carry whoever was standing on it as of last frame.
      if (player.riding === m.s) { player.pos.x += dx; player.pos.y += dy; player.pos.z += dz; }
    }
  }

  touchCrate(c, player) {
    const p = player.pos, b = c.s._b || (c.s._b = bounds(c.s));
    const touching = p.x + T.PW / 2 > b.x0 - .3 && p.x - T.PW / 2 < b.x1 + .3
      && p.z + T.PD / 2 > b.z0 - .3 && p.z - T.PD / 2 < b.z1 + .3
      && p.y < b.y1 + .4 && p.y + T.PH > b.y0;
    if (!touching) return;
    const info = CRATE[c.kind];
    const fromAbove = p.y >= b.y1 - .25 && player.vel.y <= 0;
    if (info.spring) { if (fromAbove) { player.bounce(T.JUMP_V * 1.35); this.fx('spring', c.mesh.position); } return; }
    if (!fromAbove && !player.spinning && !player.stomping) return;
    c.alive = false; c.mesh.visible = false;
    const i = this.solids.indexOf(c.s); if (i >= 0) this.solids.splice(i, 1);
    if (player.vel.y < 0 && !player.stomping) player.bounce(T.JUMP_V * .6);
    this.fx('crate', c.mesh.position, info);
  }

  updateEnemy(e, dt, player) {
    e.t += dt;
    e.tick(e, dt);
    if (e.pos.distanceTo(player.pos) > 3.4) return;
    if (player.spinning && !e.spinProof && horiz(player.pos, e.pos) < T.SPIN_R + e.radius
      && Math.abs(player.pos.y - e.pos.y) < e.height + 1) return this.kill(e, player, 'spin');
    if (!near(player.pos, e.pos, e.radius + .55, e.height + .4)) return;
    if (player.stomping && !e.stompProof) return this.kill(e, player, 'stomp');
    const stomped = player.vel.y < 0 && player.pos.y > e.pos.y + e.height - .55;
    if (stomped && !e.stompProof) return this.kill(e, player, 'stomp');
    if (player.hurt()) this.fx('hurt', player.pos);
  }

  kill(e, player, how) {
    e.alive = false; e.mesh.visible = false;
    if (how === 'stomp') player.bounce();
    this.fx('bonk', e.pos.clone());
  }

  // Geometries and materials are cached and shared across levels, so tearing a
  // level down is just detaching its group. Nothing here owns GPU memory alone.
  dispose() { this.scene.remove(this.group); }
}

const horiz = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** Cheap capsule-ish proximity: horizontal radius + vertical span. */
function near(p, q, r, hgt) {
  if (horiz(p, q) > r) return false;
  return p.y + T.PH > q.y - .2 && p.y < q.y + hgt;
}

/** Debris colour thrown up by a fatal fall onto each kind of world floor. */
const SPLASH = {
  water: 0x8fd8f0, grass: 0x6cc24a, dirt: 0x8a5a30,
  sand: 0xe8d49a, rock: 0x9aa2b4, lava: 0xff8a3d, ice: 0xdff4ff,
};

/* ---------------------------------------------------------------- crates */
export const CRATE = {
  plain: { stars: 1, tint: 0xffffff },
  star: { stars: 5, tint: 0xffe9a8 },
  life: { stars: 0, life: 1, tint: 0xa8ffc0 },
  spring: { stars: 0, spring: true, tint: 0xa8d8ff },
};

/* --------------------------------------------------------------- enemies */
const lam = c => new THREE.MeshLambertMaterial({ color: c });

export const ENEMY = {
  // Waddles back and forth. The bread-and-butter stomp customer.
  grumblin: {
    radius: .75, height: 1.2, speed: 2.6, range: 6,
    build() {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, .9, 1.0), lam(0x4caf50));
      b.position.y = .55; g.add(b);
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(.2, .24, .1), lam(0xffffff));
        eye.position.set(s * .26, .78, .52); g.add(eye);
        const pup = new THREE.Mesh(new THREE.BoxGeometry(.09, .12, .06), lam(0x1a1a1a));
        pup.position.set(s * .26, .76, .58); g.add(pup);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(.3, .2, .5), lam(0x2e7d32));
        foot.position.set(s * .32, .1, .05); g.add(foot);
      }
      return g;
    },
    tick(e) {
      const w = e.speed / Math.max(1, e.range) * 2;     // range 0 = stand still
      const k = Math.sin(e.t * w), ax = e.axis === 'x';
      e.pos[ax ? 'x' : 'z'] = e.home[ax ? 'x' : 'z'] + k * e.range / 2;
      const fwd = Math.cos(e.t * w) > 0;
      e.mesh.rotation.y = ax ? (fwd ? Math.PI / 2 : -Math.PI / 2) : (fwd ? 0 : Math.PI);
      e.pos.y = e.home.y + Math.abs(Math.sin(e.t * 7)) * .1;
    },
  },
  // SPIKY. Can't be stomped or spun — this one you jump over. (Hi, prickleburr.)
  prickle: {
    radius: .8, height: 1.0, stompProof: true, spinProof: true, speed: 1.4, range: 0,
    build() {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.6, 0), lam(0x6d4c41));
      b.position.y = .6; g.add(b);
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2, tilt = (i % 3 - 1) * .5;
        const sp = new THREE.Mesh(new THREE.ConeGeometry(.12, .5, 4), lam(0xf0e6d2));
        sp.position.set(Math.cos(a) * .62, .6 + tilt * .5, Math.sin(a) * .62);
        sp.lookAt(sp.position.clone().multiplyScalar(3).setY(sp.position.y + tilt));
        sp.rotateX(Math.PI / 2); g.add(sp);
      }
      return g;
    },
    tick(e, dt) {
      e.mesh.rotation.y += dt * .7;
      if (e.range) e.pos.x = e.home.x + Math.sin(e.t * e.speed / e.range * 2) * e.range / 2;
    },
  },
  // Hovers and bobs. Stompable, but it's moving in three dimensions.
  flapjack: {
    radius: .7, height: 1.0, speed: 2.2, range: 5, bob: 1.4,
    build() {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.SphereGeometry(.5, 8, 6), lam(0x9b59d0));
      b.position.y = .5; g.add(b);
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(.9, .55),
          new THREE.MeshLambertMaterial({ color: 0xe4c1ff, side: THREE.DoubleSide }));
        w.position.set(s * .62, .62, 0); w.rotation.y = Math.PI / 2;
        w.name = 'wing' + (s < 0 ? 'L' : 'R'); g.add(w);
        const eye = new THREE.Mesh(new THREE.BoxGeometry(.13, .16, .08), lam(0xffffff));
        eye.position.set(s * .18, .6, .44); g.add(eye);
      }
      return g;
    },
    tick(e) {
      const k = Math.sin(e.t * e.speed / Math.max(1, e.range) * 2), ax = e.axis === 'x';
      e.pos[ax ? 'x' : 'z'] = e.home[ax ? 'x' : 'z'] + k * e.range / 2;
      e.pos.y = e.home.y + Math.sin(e.t * 2.4) * e.bob;
      for (const w of e.mesh.children)
        if (w.name?.startsWith('wing')) w.rotation.z = Math.sin(e.t * 14) * .5 * (w.name.endsWith('L') ? 1 : -1);
    },
  },
};
