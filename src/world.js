// Turns a level's plain data (src/builder.js) into meshes, then runs
// everything that isn't the player: stars, crates, enemies, movers, goal.
import * as THREE from 'three';
import { tex, skyTexture, crateFace, signTexture } from './art.js';
import { bounds, T } from './physics.js';
import { buildLevel, killPlane, CRATE_SIZE, BODY } from './builder.js';

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

/** What a platform wears on top vs down its sides. `cap` adds the overhang. */
const SURFACE = {
  grass: { top: 'grass', side: 'dirt', cap: true },
  sand: { top: 'sand', side: 'rock', cap: true },
  dirt: { top: 'dirt', side: 'rock', cap: true },
  rock: { top: 'rock', side: 'rock' },
  ice: { top: 'ice', side: 'rock', cap: true },
  metal: { top: 'metal', side: 'metal' },
  // No `cap`: the turf overhang is a grass/dirt idea and a plate edge is a
  // plate edge. Deck wears panel down its sides, so a pad reads as a walkway
  // bolted onto structure rather than a floating slab of chequer plate.
  deck: { top: 'deck', side: 'panel' },
  panel: { top: 'panel', side: 'panel' },
};
const CAP = 0.45;   // thickness of the turf layer
const LIP = 0.18;   // how far it overhangs the cliff face

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
    this.gates = (data.gates || []).map(g => this.addGate(g));
    this.flora = [];                          // sway pivots; see addKelp
    for (const t of data.trees) this.addTree(t);
    this.portals = (data.portals || []).map(p => this.addPortal(p));
    if (this.goalPos) this.addGoal();

    this.totalStars = this.stars.length + this.crates.reduce((n, c) => n + (CRATE[c.kind]?.stars || 0), 0);
  }

  /* ---- construction ---- */
  // One texture on all six faces reads as a "texture cube". A real platform is
  // grass on top and rock down the cliff face, with the turf overhanging the
  // edge a little — which is also what the key art shows.
  addSolidMesh(s) {
    const set = SURFACE[s.tex] || { top: s.tex, side: s.tex };

    // s.mesh is a Group anchored at the solid's TOP-CENTRE, matching how
    // solids are defined, so movers can just copy their position onto it.
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);

    if (set.cap && s.h >= 1.5) {
      const bodyH = s.h - CAP;
      // Clones of the shared surface materials, not the shared instances:
      // keepOrionInSight ghosts occluders by rewriting the slab's materials,
      // and a flag on the cached instance would ghost the whole level.
      const body = new THREE.Mesh(tiledBox(s.w, bodyH, s.d, 4), surface(set.side).clone());
      body.position.y = -CAP - bodyH / 2;

      // Only overhang on sides with nothing next to them. Two platforms that
      // abut — which is how levels avoid leaving a crack you fall through —
      // would otherwise overlap by a full lip with coplanar top faces, and
      // z-fight along the join.
      const o = this.freeSides(s);
      const cw = s.w + o.xm + o.xp, cd = s.d + o.zm + o.zp;
      const cap = new THREE.Mesh(tiledBox(cw, CAP, cd, 4), surface(set.top).clone());
      cap.position.set((o.xp - o.xm) / 2, -CAP / 2, (o.zp - o.zm) / 2);
      g.add(body, cap);
    } else {
      // BoxGeometry groups are +X,-X,+Y,-Y,+Z,-Z — top face only gets `top`.
      // Two clones for the six slots — same per-mesh reason as the branch above.
      const sc = surface(set.side).clone(), tc = surface(set.top).clone();
      const m = new THREE.Mesh(tiledBox(s.w, s.h, s.d, 4), [sc, sc, tc, sc, sc, sc]);
      m.position.y = -s.h / 2;
      g.add(m);
    }
    // A ceiling still RECEIVES shadow; it just must not cast one. See B.roof().
    g.traverse(o => { if (o.isMesh) { o.castShadow = !s.noShadow; o.receiveShadow = true; } });
    s.mesh = g; this.group.add(g);
    return g;
  }

  /** How far the turf cap may overhang on each side: 0 where a neighbour sits
   *  at the same height, LIP/2 where the edge is open air. */
  freeSides(s) {
    const L = LIP / 2;
    const out = { xm: L, xp: L, zm: L, zp: L };
    const b = { x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - s.d / 2, z1: s.z + s.d / 2 };
    for (const o of this.solids) {
      if (o === s || o.crate || o.scenery || Math.abs(o.y - s.y) > 0.02) continue;
      const c = { x0: o.x - o.w / 2, x1: o.x + o.w / 2, z0: o.z - o.d / 2, z1: o.z + o.d / 2 };
      const zOver = Math.min(b.z1, c.z1) - Math.max(b.z0, c.z0) > 0.05;
      const xOver = Math.min(b.x1, c.x1) - Math.max(b.x0, c.x0) > 0.05;
      if (zOver) {
        if (c.x0 - b.x1 < LIP && c.x0 >= b.x1 - 0.05) out.xp = 0;
        if (b.x0 - c.x1 < LIP && c.x1 <= b.x0 + 0.05) out.xm = 0;
      }
      if (xOver) {
        if (c.z0 - b.z1 < LIP && c.z0 >= b.z1 - 0.05) out.zp = 0;
        if (b.z0 - c.z1 < LIP && c.z1 <= b.z0 + 0.05) out.zm = 0;
      }
    }
    return out;
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
    // Stencil on all five faces you can see, and a topper for the silhouette.
    // Children of the crate mesh, so smashing it takes them with it.
    for (const f of faceDecals(c.kind)) m.add(f);
    const top = topper(c.kind);
    if (top) m.add(top);
    this.group.add(m);
    // settling=true on the first frame so an authored stack validates itself,
    // and so a crate placed over nothing falls instead of hanging there.
    return { s, mesh: m, kind: c.kind, alive: true, vy: 0, settling: true };
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

  /** A doorway in the hub. Not solid — you walk INTO it, that is the input. */
  addPortal(p) {
    const g = new THREE.Group(); g.position.set(p.x, p.y, p.z);
    const accent = 0xffd23f;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, .22, 8, 22),
      new THREE.MeshLambertMaterial({ color: accent, emissive: 0x5a4300 }));
    ring.position.y = 2.1; ring.castShadow = true; g.add(ring);
    // The eye of the portal. Additive-ish and unlit so it glows in any level's
    // lighting, and double-sided because you can walk round the back of it.
    const eye = new THREE.Mesh(new THREE.CircleGeometry(1.6, 22),
      new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: .45, side: THREE.DoubleSide }));
    eye.position.y = 2.1; g.add(eye);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, .35, 12), surface('rock'));
    base.position.y = .17; base.castShadow = base.receiveShadow = true; g.add(base);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.5),
      new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide }));
    sign.position.y = 4.5; g.add(sign);
    this.group.add(g);
    return { g, ring, eye, sign, level: p.level, signY: 4.5, locked: false,
             pos: new THREE.Vector3(p.x, p.y, p.z) };
  }

  /**
   * Fill in the placards. main.js owns the save file, so it hands us a lookup
   * rather than World reaching into localStorage — the same reason the fx
   * callback exists.
   */
  labelPortals(info) {
    for (const p of this.portals) {
      const { title, sub, accent, locked } = info(p.level);
      p.locked = !!locked;
      p.sign.material.map?.dispose();
      p.sign.material.map = signTexture(title, sub, accent);
      p.sign.material.needsUpdate = true;
      p.ring.material = p.ring.material.clone();
      p.ring.material.color.set(accent);
      p.eye.material = p.eye.material.clone();
      p.eye.material.color.set(accent);
      // A shut door should look shut from across the island, before you have
      // walked over and read the sign: dark, still, and barely there.
      p.eye.material.opacity = locked ? .12 : .45;
      p.ring.material.emissive?.set(locked ? 0x000000 : 0x5a4300);
    }
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
    // Centred on the level's mid-point, and always long enough to reach both
    // ends of it — a fixed 420 stops short once a level runs past ~400u, and
    // the world floor visibly ending mid-level is worse than not having one.
    const zs = this.solids.map(s => s.z);
    const z0 = Math.min(...zs), z1 = Math.max(...zs);
    const size = Math.max(g.size, (z1 - z0) + 200);
    // Tinted down: anything this far below the play space should read as
    // "in shadow, a long way away", not as more of the same floor. Lava is the
    // exception — it is the light source, not a lit surface, so it takes an
    // unlit material at full brightness. Shaded like rock in a cave lit by one
    // dim sun it came out mud brown, and mud does not read as "do not land".
    const molten = g.tex === 'lava';
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
      molten ? new THREE.MeshBasicMaterial({ map: t.clone() })
             : new THREE.MeshLambertMaterial({ map: t.clone(), color: 0x9fa8a2 }));
    m.material.map.repeat.set(size / 4, size / 4);
    m.material.map.needsUpdate = true;
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, g.y, (z0 + z1) / 2);
    m.receiveShadow = !molten;             // nothing casts a shadow onto lava
    this.group.add(m);
    this.groundY = g.y;
  }

  /* ---- flora ----
   * `kind` picks the shape. A pine is a pine; underwater it is kelp or coral,
   * because the reef used to be planted with conifers — the backdrop of the
   * one level nobody walks to the edge of, which is exactly the kind of thing
   * that survives five playtests.
   *
   * Everything here is deterministic in (x,z): the same plant is the same
   * plant on every load, so a screenshot is reproducible and nothing pops.
   */
  addTree(t) {
    const g = new THREE.Group(); g.position.set(t.x, t.y, t.z); g.scale.setScalar(t.s);
    const seed = Math.abs(t.x * 7.3 + t.z * 3.1);
    const rnd = k => ((Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;

    if (t.kind === 'kelp') this.addKelp(g, rnd);
    else if (t.kind === 'coral') this.addCoral(g, rnd);
    else if (t.kind === 'fan') this.addFan(g, rnd);
    else if (t.kind === 'crystal') this.addCrystal(g, rnd);
    else this.addPine(g);

    g.rotation.y = seed % 6.28;                      // varied but deterministic
    // A sea fan is a flat blade: spun to a random angle, half of them are
    // edge-on and read as a pink stick. Face it at the CAMERA — which in this
    // game is a fixed rig looking up +Z, so that is +Z, not "inward toward the
    // corridor". Facing the corridor is what makes it edge-on from the camera.
    if (t.kind === 'fan') g.rotation.y = (rnd(11) - .5) * .9;
    this.group.add(g);
  }

  /** Reef colours die in the teal fog under a dim underwater sun, so everything
   *  down here carries its own faint glow. Cheap: no light, just emissive. */
  reefMat(color, extra = {}) {
    return new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: .28, ...extra });
  }

  addPine(g) {
    const trunk = new THREE.Mesh(tiledBox(.6, 3.4, .6, 2), surface('wood'));
    trunk.position.y = 1.7; g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(2.3 - i * .55, 1.9, 6),
        new THREE.MeshLambertMaterial({ color: [0x2f8b3a, 0x37a044, 0x45b551][i] }));
      leaf.position.y = 3.1 + i * 1.05; g.add(leaf);
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  /**
   * A kelp stalk: blades stacked in NESTED groups, so one sway angle per joint
   * compounds up the plant and the tip travels furthest — a whole frond from
   * one sine per segment, instead of animating a skeleton. `this.flora` is what
   * update() ticks; a plant that never sways is not in it.
   *
   * No cast shadow. Sixty stalks of soft blades throwing 2048px shadow maps
   * across the sand costs more than it reads underwater, where the light is
   * scattered and nothing has a hard shadow anyway.
   */
  addKelp(g, rnd) {
    const n = 4 + Math.floor(rnd(1) * 3);            // 4..6 joints
    const tint = [0x2c6e3f, 0x357f46, 0x46934a, 0x2f6d55][Math.floor(rnd(2) * 4)];
    let node = g;
    for (let i = 0; i < n; i++) {
      const joint = new THREE.Group();
      joint.position.y = i === 0 ? 0 : 1.55;
      // Every joint is a sway pivot. Lower ones barely move; the tip whips.
      this.flora.push({ node: joint, amp: .07 + i * .045, phase: rnd(i + 3) * 6.28, speed: .8 + rnd(i + 9) * .5 });
      const mat = this.reefMat(tint);
      const blade = new THREE.Mesh(tiledBox(.5, 1.6, .22, 2), mat);
      blade.position.y = .8;
      blade.receiveShadow = true;
      joint.add(blade);
      // Two leaves per joint, one off each side, flattened into fronds. One
      // small cone per joint left a bare stick with a thorn on it at any
      // distance — which is what the first pass looked like from the corridor.
      for (const sgn of [-1, 1]) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(.62, 2.1, 4), mat);
        leaf.position.set(sgn * .62, 1.0 + (sgn > 0 ? .35 : 0), (i % 2 ? .18 : -.18));
        leaf.rotation.z = -sgn * 1.15;
        leaf.scale.set(1, 1, .3);                    // a frond, not a spike
        leaf.receiveShadow = true;
        joint.add(leaf);
      }
      node.add(joint); node = joint;
    }
  }

  /** Staghorn coral: a stubby stalk and three or four blunt arms. Rigid — it
   *  is limestone — so it is deliberately NOT in `this.flora`. */
  addCoral(g, rnd) {
    const tint = [0xff7d6b, 0xff9d4f, 0xe0567f, 0xb96bff][Math.floor(rnd(1) * 4)];
    const mat = this.reefMat(tint);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.55, .8, 1.5, 6), mat);
    base.position.y = .75; g.add(base);
    const arms = 3 + Math.floor(rnd(2) * 2);
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * 6.28 + rnd(i + 4) * .6;
      const len = 1.6 + rnd(i + 7) * 1.4;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(.2, .42, len, 5), mat);
      arm.position.set(Math.cos(a) * .55, 1.4 + len * .38, Math.sin(a) * .55);
      arm.rotation.z = -Math.cos(a) * .5; arm.rotation.x = Math.sin(a) * .5;
      g.add(arm);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(.3, 6, 5), mat);
      tip.position.set(Math.cos(a) * (.55 + len * .28), 1.4 + len * .78, Math.sin(a) * (.55 + len * .28));
      g.add(tip);
    }
    // Receives, never casts. Underwater light is scattered — nothing down here
    // has a hard shadow — and a 6-sided coral cast a black hexagon on the sand
    // that read as a hole in the sea floor.
    g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  }

  /** A sea fan: a lobed blade on a short stem, ribbed on both faces. Wider
   *  than it is tall and low on its stem — a tall half-disc on a stalk is a
   *  mushroom, which is what the first two passes at this looked like. */
  addFan(g, rnd) {
    const tint = [0xff6f9a, 0xffb03a, 0x7fe3d0][Math.floor(rnd(1) * 3)];
    const mat = this.reefMat(tint, { side: THREE.DoubleSide });
    const rib = this.reefMat(tint, { side: THREE.DoubleSide, emissiveIntensity: .5 });
    const pivot = new THREE.Group(); g.add(pivot);
    this.flora.push({ node: pivot, amp: .12, phase: rnd(2) * 6.28, speed: .7 + rnd(3) * .4 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.14, .24, .8, 5), mat);
    stem.position.y = .4; pivot.add(stem);
    // Two blades 20° apart: one flat circle is invisible edge-on, and crossing
    // them any wider turns the fan into a dome.
    for (const a of [-.18, .18]) {
      // 5 segments, not 7: the straight chords read as lobes.
      const blade = new THREE.Mesh(new THREE.CircleGeometry(1.5, 5, 0, Math.PI), mat);
      blade.position.y = .72; blade.rotation.y = a;
      blade.scale.set(1.15, .8, 1);                  // wider than tall
      pivot.add(blade);
    }
    // Ribs on the FRONT of the blade, a shade brighter. Behind it they were
    // simply invisible, and a blank lobe is a leaf, not coral.
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(tiledBox(.09, 1.25, .09, 2), rib);
      const a = -1.0 + i * .5;
      r.position.set(Math.sin(a) * .72, .72 + Math.cos(a) * .5, .14);
      r.rotation.z = -a;
      pivot.add(r);
    }
    pivot.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  }

  /**
   * A crystal cluster: a few tapered spires out of one base, glowing. The
   * cavern's only light source that isn't the sun, and the reason a dark level
   * is still readable — put them where you want the eye to go.
   *
   * Emissive rather than a real light: sixty PointLights would cost more than
   * the rest of the level put together, and this reads the same at N64 scale.
   */
  addCrystal(g, rnd) {
    const tint = [0x8f6bff, 0x4ec5f1, 0xff6fd0, 0x6fffc8][Math.floor(rnd(1) * 4)];
    const mat = new THREE.MeshLambertMaterial({
      color: tint, emissive: tint, emissiveIntensity: .95,
      transparent: true, opacity: .9,
    });
    const n = 3 + Math.floor(rnd(2) * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + rnd(i + 5) * .8;
      const h = 1.4 + rnd(i + 11) * 2.4;
      // 4 sides, no cap taper: a chunky faceted spike, not a cone.
      const sp = new THREE.Mesh(new THREE.ConeGeometry(.34 + rnd(i + 17) * .22, h, 4), mat);
      const lean = .12 + rnd(i + 23) * .3;
      sp.position.set(Math.cos(a) * .55, h * .45, Math.sin(a) * .55);
      sp.rotation.set(Math.sin(a) * lean, a, -Math.cos(a) * lean);
      g.add(sp);
    }
    // A dark base so the spires grow out of the rock rather than off it.
    const base = new THREE.Mesh(new THREE.SphereGeometry(.85, 7, 4),
      new THREE.MeshLambertMaterial({ color: 0x2a2340 }));
    base.scale.y = .45; g.add(base);
    g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  }

  /* ---- runtime ---- */
  update(dt, player) {
    this.time += dt;
    this.moveMovers(dt, player);
    // A crumbling gate: it sinks into its own lintel and is gone. Cheap, and
    // it reads as "that opened" from anywhere in the arena.
    for (const gt of this.gates) {
      if (!gt.falling || gt.t >= 1) continue;
      gt.t = Math.min(1, gt.t + dt * 1.1);
      gt.g.position.y = gt.s.y - gt.t * (gt.s.h + 1.2);
      gt.g.rotation.z = gt.t * .12;
      if (gt.t >= 1) gt.g.visible = false;
    }
    // The current. One sine per joint, and nesting does the rest.
    for (const f of this.flora) f.node.rotation.z = Math.sin(this.time * f.speed + f.phase) * f.amp;

    for (const s of this.stars) {
      if (!s.alive) continue;
      s.mesh.rotation.y += dt * 2.4;
      s.mesh.position.y = s.home + Math.sin(this.time * 2.2 + s.home) * .16;
      if (near(player.pos, s.mesh.position, 1.35, 1.9)) {
        s.alive = false; s.mesh.visible = false;
        this.fx('star', s.mesh.position);
      }
    }

    this.settleCrates(dt);
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

    for (const p of this.portals) {
      if (!p.locked) {                      // a locked door does not beckon
        p.ring.rotation.z += dt * .55;
        p.sign.position.y = p.signY + Math.sin(this.time * 1.8 + p.level) * .13;
        p.eye.scale.setScalar(1 + Math.sin(this.time * 2.4 + p.level) * .04);
      }
      // Report the touch either way; main.js decides what a locked one means,
      // because whether it is open is a save-file question, not a world one.
      if (near(player.pos, p.pos, 2.1, 3.4)) return { portal: p.level, locked: p.locked };
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
      m.s.mesh.position.set(nx, ny, nz);      // group is anchored at top-centre
      // Carry whoever was standing on it as of last frame.
      if (player.riding === m.s) { player.pos.x += dx; player.pos.y += dy; player.pos.z += dz; }
    }
  }

  /** Highest solid top that could hold `s` up, or null for nothing under it. */
  supportUnder(s) {
    const b = bounds(s);
    let best = null;
    for (const o of this.solids) {
      if (o === s) continue;
      const ob = o._b || (o._b = bounds(o));
      // Must OVERLAP in plan, not merely contain the centre point: a pyramid's
      // upper crates straddle the gap between the two below them, so a centre
      // test says "nothing under me" and drops the whole stack on level load.
      if (ob.x1 <= b.x0 + 0.02 || ob.x0 >= b.x1 - 0.02) continue;
      if (ob.z1 <= b.z0 + 0.02 || ob.z0 >= b.z1 - 0.02) continue;
      if (ob.y1 > b.y0 + 0.02) continue;               // and be below our feet
      if (best === null || ob.y1 > best) best = ob.y1;
    }
    return best;
  }

  /**
   * Crates fall when what they were sitting on stops existing. Smash the bottom
   * of a stack and the rest used to hang in mid-air, which is the one thing a
   * crate must never do — the whole point of a stack is that it is a stack.
   *
   * Only crates flagged `settling` are tested, and a crate stops being restless
   * the moment it lands, so the usual per-frame cost is nothing.
   */
  settleCrates(dt) {
    for (const c of this.crates) {
      if (!c.alive || !c.settling) continue;
      const s = c.s;
      const rest = this.supportUnder(s);
      const floor = rest === null ? -Infinity : rest + CRATE_SIZE;
      if (s.y <= floor + 0.02) { c.vy = 0; c.settling = false; s.y = Math.max(s.y, floor); continue; }
      c.vy -= 62 * dt;                                  // same gravity the player falls at
      let y = s.y + c.vy * dt;
      if (y <= floor) { y = floor; c.vy = 0; c.settling = false; }
      s.y = y; s._b = null;
      c.mesh.position.y = y - CRATE_SIZE / 2;
      // Into the void: a crate that falls out of the level is gone, not a
      // collider sitting a mile below the kill plane waiting to be landed on.
      if (y < this.killY) {
        c.alive = false; c.settling = false; c.mesh.visible = false;
        const i = this.solids.indexOf(s); if (i >= 0) this.solids.splice(i, 1);
      }
    }
  }

  /** Anything resting above the gap a smashed crate left has to look again. */
  disturbCrates(fromY) {
    for (const c of this.crates) if (c.alive && c.s.y > fromY) c.settling = true;
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
    this.disturbCrates(c.s.y - CRATE_SIZE);
    if (player.vel.y < 0 && !player.stomping) player.bounce(T.JUMP_V * .6);
    this.fx('crate', c.mesh.position, info);
  }

  updateEnemy(e, dt, player) {
    e.t += dt;
    // The player goes to the tick because the boss chases; every other tick
    // ignores the argument.
    e.tick(e, dt, player, this);
    // Just been stomped: he is flashing, and for that beat he neither hurts you
    // nor counts another hit. Without it one stomp reads as three and the
    // fight is over before the kid has seen it.
    if (e.invT > 0) { e.invT -= dt; return; }
    if (e.pos.distanceTo(player.pos) > 3.4 + (e.radius || 0)) return;
    if (player.spinning && !e.spinProof && horiz(player.pos, e.pos) < T.SPIN_R + e.radius
      && Math.abs(player.pos.y - e.pos.y) < e.height + 1) return this.kill(e, player, 'spin');
    if (!near(player.pos, e.pos, e.radius + .55, e.height + .4)) return;
    if (player.stomping && !e.stompProof) return this.kill(e, player, 'stomp');
    const stomped = player.vel.y < 0 && player.pos.y > e.pos.y + e.height - .55;
    if (stomped && !e.stompProof) return this.kill(e, player, 'stomp');
    if (player.hurt()) this.fx('hurt', player.pos);
  }

  kill(e, player, how) {
    // A boss has `hp`. Every hit but the last is a phase change, not a death:
    // he flashes, he speeds up, and he has something to say about it.
    if (e.hp > 1) {
      e.hp--;
      e.invT = 1.1;
      e.hopGap *= 0.74;                      // rage: hops come faster each time
      if (how === 'stomp') player.bounce();
      this.fx('bosshit', e.pos.clone(), { hp: e.hp, say: e.onHit && e.onHit(e) });
      return;
    }
    e.alive = false; e.mesh.visible = false;
    if (how === 'stomp') player.bounce();
    if (e.hp) { this.openGates(); this.fx('bossdown', e.pos.clone(), { say: e.onDown && e.onDown(e) }); return; }
    this.fx('bonk', e.pos.clone());
  }

  /* ---- the boss gate ---- */
  addGate(s) {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    const bar = surface('metal');
    const lintel = new THREE.Mesh(tiledBox(s.w, .9, s.d, 4), bar);
    lintel.position.y = -.45; g.add(lintel);
    // Bars, not a slab: you can see the goal through it, which is the whole
    // point of a locked door in a kid's game — it has to promise something.
    const n = Math.max(3, Math.round(s.w / 1.6));
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, s.h - .9, 7), bar);
      b.position.set(-s.w / 2 + (i + .5) * (s.w / n), -.9 - (s.h - .9) / 2, 0);
      g.add(b);
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.group.add(g);
    return { s, g, falling: false, t: 0 };
  }

  /** Boss down: every gate drops out of the world and stops colliding. */
  openGates() {
    for (const gt of this.gates) {
      if (gt.falling) continue;
      gt.falling = true;
      const i = this.solids.indexOf(gt.s);
      if (i >= 0) this.solids.splice(i, 1);   // collision goes FIRST, then the art
    }
    if (this.gates.length) this.fx('gate', this.gates[0].g.position.clone());
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
  deck: 0xc2ccd9, panel: 0x59647a,
};

/* ---------------------------------------------------------------- crates */
// Three cues, deliberately redundant: a tint, a stencil on every face, and a
// topper you can read from behind or in shadow. Tint alone was the whole
// difference once, and you could not tell the bonus crate from the bouncy one.
export const CRATE = {
  plain: { stars: 1, tint: 0xffffff },
  star: { stars: 5, tint: 0xffe9a8 },
  life: { stars: 0, life: 1, tint: 0xa8ffc0 },
  spring: { stars: 0, spring: true, tint: 0xa8d8ff },
};

/* ---- crate face stencils ---- */
const F = CRATE_SIZE / 2 + 0.012;      // just proud of the face, no z-fighting
const decalMat = new Map();
/** Five stencil planes (4 sides + top) for a crate kind; [] for plain. */
function faceDecals(kind) {
  const map = crateFace(kind);
  if (!map) return [];
  if (!decalMat.has(kind))
    decalMat.set(kind, new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
  const mat = decalMat.get(kind);
  if (!geoCache.has('#decal'))
    geoCache.set('#decal', new THREE.PlaneGeometry(CRATE_SIZE * .74, CRATE_SIZE * .74));
  const geo = geoCache.get('#decal');
  return [
    [[0, 0, F], [0, 0, 0]], [[0, 0, -F], [0, Math.PI, 0]],
    [[F, 0, 0], [0, Math.PI / 2, 0]], [[-F, 0, 0], [0, -Math.PI / 2, 0]],
    [[0, F, 0], [-Math.PI / 2, 0, 0]],
  ].map(([p, r]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p); m.rotation.set(...r);
    return m;
  });
}

/* ---- crate toppers ---- */
// Built once per kind and cloned; clone() shares geometry and material.
const TOPPER = {
  // Deliberately NOT spinning, unlike a collectable star: the camera sits
  // behind you, so a star held face-on always reads, and a spinning one is
  // edge-on — a gold sliver — for half of every turn.
  star() {
    const m = new THREE.Mesh(starGeometry(), new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x7a5a00 }));
    m.scale.setScalar(1.4); m.position.y = CRATE_SIZE / 2 + .44;
    return m;
  },
  life() {
    const g = new THREE.Group(), mat = lam(0x2b2431);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.24, .46, 4), mat);
      ear.position.set(s * .44, CRATE_SIZE / 2 + .21, .1);
      ear.rotation.y = Math.PI / 4; ear.rotation.z = s * .2;
      g.add(ear);
    }
    const tail = new THREE.Mesh(new THREE.TorusGeometry(.3, .07, 5, 9, Math.PI * 1.25), mat);
    tail.position.set(0, CRATE_SIZE / 2 - .1, -F - .18);
    tail.rotation.set(0, Math.PI / 2, -.5);
    g.add(tail);
    return g;
  },
  spring() {
    const g = new THREE.Group(), coil = lam(0xc9d6e8);
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(.34 - i * .04, .065, 5, 12), coil);
      t.position.y = CRATE_SIZE / 2 + .06 + i * .1;
      t.rotation.x = Math.PI / 2;
      g.add(t);
    }
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(.52, .52, .1, 10), lam(0x6fb7e8));
    plate.position.y = CRATE_SIZE / 2 + .33;
    g.add(plate);
    return g;
  },
};
const topperProto = new Map();
function topper(kind) {
  if (!TOPPER[kind]) return null;
  if (!topperProto.has(kind)) {
    const t = TOPPER[kind]();
    t.traverse(o => { if (o.isMesh) o.castShadow = true; });
    topperProto.set(kind, t);
  }
  return topperProto.get(kind).clone();
}

/* --------------------------------------------------------------- enemies */
const lam = c => new THREE.MeshLambertMaterial({ color: c });
const pick = a => a[Math.floor(Math.random() * a.length)];

/* King Dad's material. He is not a demon lord; he is a dad at 7:30pm, and
 * every line he has is a chore. That is the joke — keep it chores. */
const CHORES = [
  'HAVE YOU DONE YOUR HOMEWORK?',
  'GO AND BRUSH YOUR TEETH!',
  'TIDY YOUR ROOM!',
  "SCREEN TIME'S UP!",
  'PUT YOUR SHOES AWAY!',
  'EAT YOUR VEGETABLES!',
  'ONE MORE EPISODE. THEN BED.',
  'WHO LEFT ALL THE LIGHTS ON?',
  'BECAUSE I SAID SO!',
  'DID YOU FEED THE CAT?',
  'WASH YOUR HANDS!',
  'STOP JUMPING ON THE FURNITURE!',
];
const HIT_1 = ['OW! RIGHT, NO PUDDING.', "THAT'S ONE. I'M COUNTING.", 'I JUST HOOVERED IN HERE!'];
const HIT_2 = ["DON'T MAKE ME COUNT TO THREE!", "TWO… I'M TELLING YOUR MUM.", 'MY BACK! MY ACTUAL BACK!'];
const DEFEAT = [
  'ALL RIGHT, ALL RIGHT — TEN MORE MINUTES.',
  'FINE. YOU WIN. PIZZA FOR TEA.',
  "OK, BUT YOU'RE STILL BRUSHING YOUR TEETH.",
];

export const ENEMY = {
  // Waddles back and forth. The bread-and-butter stomp customer.
  grumblin: {
    ...BODY.grumblin, speed: 2.6,
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
    ...BODY.prickle, stompProof: true, spinProof: true, speed: 1.4,
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
  // Underwater. All sting and no weak spot — this one you swim around.
  // Floats, so it must also be in FLOATING (src/builder.js) or the checker
  // fails it for standing in mid-water.
  jelly: {
    ...BODY.jelly, stompProof: true, spinProof: true, speed: 1.1,
    build() {
      const g = new THREE.Group();
      const bell = new THREE.Mesh(
        new THREE.SphereGeometry(.62, 10, 6, 0, Math.PI * 2, 0, Math.PI * .6),
        new THREE.MeshLambertMaterial({
          color: 0xff8ad8, emissive: 0x5a1040, transparent: true, opacity: .82, side: THREE.DoubleSide,
        }));
      bell.position.y = 1.05; bell.name = 'bell'; g.add(bell);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const t = new THREE.Mesh(new THREE.CylinderGeometry(.05, .02, .95, 4), lam(0xffc2ec));
        t.position.set(Math.cos(a) * .33, .55, Math.sin(a) * .33);
        t.name = 'tent'; g.add(t);
      }
      return g;
    },
    tick(e) {
      e.pos.y = e.home.y + Math.sin(e.t * e.speed) * e.bob;
      const k = Math.sin(e.t * 2.6);
      for (const c of e.mesh.children) {
        if (c.name === 'tent') c.rotation.x = k * .28;
        else if (c.name === 'bell') c.scale.set(1 - k * .1, 1 + k * .18, 1 - k * .1);
      }
    },
  },
  // Flight levels. Crackles, patrols, and cannot be attacked — fly around it.
  zapdrone: {
    ...BODY.zapdrone, stompProof: true, spinProof: true, speed: 3.2,
    build() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(.55, 0), lam(0x8892a6));
      body.position.y = .6; g.add(body);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.19, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xff4d4d, emissive: 0x8a0000 }));
      eye.position.set(0, .6, .46); g.add(eye);
      for (const s of [-1, 1]) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(.52, .05, 5, 12),
          new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: .75 }));
        arc.position.y = .6; arc.rotation.y = s * Math.PI / 4; arc.name = 'arc'; g.add(arc);
      }
      return g;
    },
    tick(e, dt) {
      const k = Math.sin(e.t * e.speed / Math.max(1, e.range) * 2), ax = e.axis === 'x';
      e.pos[ax ? 'x' : 'z'] = e.home[ax ? 'x' : 'z'] + k * e.range / 2;
      e.pos.y = e.home.y + Math.sin(e.t * 1.8) * e.bob;
      for (const c of e.mesh.children) if (c.name === 'arc') c.rotation.z += dt * 6;
    },
  },
  /* ---- the boss ----
   * King Dad, from game 1: bald, short black beard, a crown, and a TV remote he
   * points at you like a sceptre. Three stomps — a ground pound counts, since
   * that is a stomp with commitment. The spin bounces off him: a boss you can
   * beat from the floor without ever leaving it is not a boss.
   *
   * He does not patrol: he WAITS, telegraphs with a crouch, then hops at where
   * you are. The crouch is the whole fight — it is what makes "get out from
   * under him, then land on him" a thing a seven-year-old can read. Each hit
   * shortens the gap between hops by a quarter, so he gets angrier and the
   * fight has a shape.
   *
   * `arena` clamps him to a radius around where he was placed. He is heavy and
   * he lands where he likes; without it he walks off the edge, and a boss in a
   * pit is a gate that never opens.
   */
  king: {
    ...BODY.king, spinProof: true, stompProof: false, hp: 3, hopGap: 2.1, arena: 12,
    build() {
      const g = new THREE.Group();
      const gown = lam(0x2f6fd0), trim = lam(0x1e4d94), skin = lam(0xf0c9a0);
      const hair = lam(0x241a14);
      // WIDE rather than tall. He has to read as twice the kid without his head
      // leaving stomping range — BODY.king.height is 2.6, so the stomp window
      // opens 2.05 above his feet and anything much over 3 is a head you can
      // see and cannot land on.
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.55, 1.5), gown);
      body.position.y = 1.05; body.name = 'body'; g.add(body);
      const hem = new THREE.Mesh(new THREE.BoxGeometry(2.5, .38, 1.62), trim);
      hem.position.y = .36; g.add(hem);
      const collar = new THREE.Mesh(new THREE.BoxGeometry(1.5, .22, 1.15), trim);
      collar.position.y = 1.86; g.add(collar);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.32, 1.1, 1.2), skin);
      head.position.y = 2.48; head.name = 'head'; g.add(head);
      // Bald on top, short black beard under. Orion specified this in game 1,
      // and it is the only reason the shape reads as Dad rather than as a king.
      const beard = new THREE.Mesh(new THREE.BoxGeometry(1.18, .58, 1.12), hair);
      beard.position.y = 2.02; g.add(beard);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(.24, .3, .26), skin);
      nose.position.set(0, 2.48, .66); g.add(nose);
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(.3, .32, .1), lam(0xffffff));
        eye.position.set(sx * .34, 2.66, .6); g.add(eye);
        const pup = new THREE.Mesh(new THREE.BoxGeometry(.13, .16, .08), lam(0x1a1a1a));
        pup.position.set(sx * .34, 2.63, .66); g.add(pup);
        // Angry eyebrows do more for "boss" than any amount of geometry.
        const brow = new THREE.Mesh(new THREE.BoxGeometry(.42, .13, .13), hair);
        brow.position.set(sx * .34, 2.92, .62); brow.rotation.z = -sx * .3; g.add(brow);
        const ear = new THREE.Mesh(new THREE.BoxGeometry(.14, .3, .3), skin);
        ear.position.set(sx * .72, 2.48, 0); g.add(ear);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(.44, 1.15, .44), gown);
        arm.position.set(sx * 1.32, 1.15, .1); arm.name = 'arm' + (sx < 0 ? 'L' : 'R'); g.add(arm);
        const hand = new THREE.Mesh(new THREE.BoxGeometry(.34, .3, .34), skin);
        hand.position.set(sx * 1.32, .52, .12); g.add(hand);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(.62, .32, .95), lam(0x8d5fbf));
        foot.position.set(sx * .58, .16, .2); g.add(foot);          // slippers
      }
      // The crown: four points, because five is a lot of triangles for a hat.
      const band = new THREE.Mesh(new THREE.CylinderGeometry(.72, .72, .3, 10), lam(0xffd23f));
      band.position.y = 3.12; g.add(band);
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2;
        const pt = new THREE.Mesh(new THREE.ConeGeometry(.2, .5, 4), lam(0xffd23f));
        pt.position.set(Math.cos(a) * .58, 3.45, Math.sin(a) * .58); g.add(pt);
      }
      // The sceptre of dads everywhere.
      const remote = new THREE.Mesh(new THREE.BoxGeometry(.26, .72, .2), lam(0x23242a));
      remote.position.set(1.32, .95, .42); remote.rotation.x = -.35; g.add(remote);
      const btn = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, .07), lam(0xff4d4d));
      btn.position.set(1.32, 1.2, .56); g.add(btn);
      return g;
    },
    tick(e, dt, player, world) {
      // First frame: pick up the fight state. Everything here is per-instance,
      // because ENEMY entries are shared prototypes and two levels must not
      // share one boss's rage.
      if (e.st === undefined) { e.st = 'wait'; e.cd = 1.4; e.vy = 0; e.sayT = 4; }

      // Always face the kid. A boss with his back to you is a boss you can't read.
      const dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z;
      const want = Math.atan2(dx, dz);
      e.mesh.rotation.y += ((want - e.mesh.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 6);

      const body = e.mesh.getObjectByName('body');
      if (e.st === 'wait') {
        e.cd -= dt;
        body.scale.set(1, 1 + Math.sin(e.t * 3) * .04, 1);          // breathing
        if (e.cd <= 0) { e.st = 'crouch'; e.cd = .38; }
        // Chores, on a timer. This is the joke and it is the whole reason the
        // arena is quiet between hops.
        if ((e.sayT -= dt) <= 0) { e.sayT = 5.5 + Math.random() * 3; world.fx('quip', e.pos, { say: pick(CHORES) }); }
      } else if (e.st === 'crouch') {
        e.cd -= dt;
        body.scale.set(1.18, .72, 1.18);                            // the telegraph
        if (e.cd <= 0) {
          e.st = 'air'; e.vy = 12.5;
          const m = Math.hypot(dx, dz) || 1;
          // Lead the hop at the kid, but cap it: a boss that lands exactly on
          // you every time is not a fight, it is a tax.
          e.hx = (dx / m) * Math.min(7.5, m * 1.15);
          e.hz = (dz / m) * Math.min(7.5, m * 1.15);
          world.fx('bosshop', e.pos);
        }
      } else {
        body.scale.set(.92, 1.12, .92);
        e.vy -= 26 * dt;
        e.pos.y += e.vy * dt;
        e.pos.x += e.hx * dt * 1.2;
        e.pos.z += e.hz * dt * 1.2;
        if (e.pos.y <= e.home.y) {
          e.pos.y = e.home.y; e.st = 'wait'; e.cd = e.hopGap;
          world.fx('bossland', e.pos.clone());
        }
      }

      // The arena leash. Clamped every frame, in flight as well as on landing,
      // so a hop aimed past the wall lands against it instead of over it.
      const ox = e.pos.x - e.home.x, oz = e.pos.z - e.home.z;
      const r = Math.hypot(ox, oz);
      if (r > e.arena) { e.pos.x = e.home.x + ox / r * e.arena; e.pos.z = e.home.z + oz / r * e.arena; }

      // Flashing while invulnerable, so a hit that landed is visible.
      e.mesh.visible = !(e.invT > 0) || Math.floor(e.invT * 20) % 2 === 0;
    },
    onHit: e => e.hp === 2 ? pick(HIT_1) : pick(HIT_2),
    onDown: () => pick(DEFEAT),
  },
  // Hovers and bobs. Stompable, but it's moving in three dimensions.
  //
  // Was a purple ball with two flat rectangles stuck to its sides, spun about
  // their own centres — which is not flapping, it is a propeller, and it read
  // as exactly that. A wing has to be HINGED at the shoulder and it has to have
  // a wing's outline, so the shape is a scalloped membrane on a pivot group and
  // the flap sweeps forward as it comes down, the way a real one does.
  flapjack: {
    ...BODY.flapjack, speed: 2.2,
    build() {
      const g = new THREE.Group();
      const skin = lam(0x9b59d0), dark = lam(0x6d3a99);
      const body = new THREE.Mesh(new THREE.SphereGeometry(.42, 10, 8), skin);
      body.position.y = .5; body.scale.set(1, 1.1, .92); g.add(body);
      const snout = new THREE.Mesh(new THREE.ConeGeometry(.17, .3, 7), skin);
      snout.position.set(0, .46, .38); snout.rotation.x = Math.PI / 2; g.add(snout);
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(.13, .34, 5), dark);
        ear.position.set(s * .19, .86, -.02); ear.rotation.z = s * .34; g.add(ear);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(.085, 7, 5), lam(0xfff3b0));
        eye.position.set(s * .16, .59, .34); g.add(eye);
        const pup = new THREE.Mesh(new THREE.SphereGeometry(.04, 6, 4), lam(0x1a1a1a));
        pup.position.set(s * .16, .59, .40); g.add(pup);
        const fang = new THREE.Mesh(new THREE.ConeGeometry(.035, .1, 4), lam(0xffffff));
        fang.position.set(s * .07, .34, .38); fang.rotation.x = Math.PI; g.add(fang);

        // The pivot IS the shoulder: rotate the group, not the membrane, or the
        // wing spins in place instead of beating.
        const pivot = new THREE.Group();
        pivot.position.set(s * .3, .62, 0);
        pivot.name = 'wing' + (s < 0 ? 'L' : 'R');
        const memb = new THREE.Mesh(wingGeometry(),
          new THREE.MeshLambertMaterial({ color: 0xe4c1ff, side: THREE.DoubleSide }));
        // Canted, not upright and not flat. Upright is what made the old wings
        // billboards — tilting a plane that already faces you is a spin, not a
        // beat. Dead flat solves that but then the camera sees them edge-on and
        // they vanish to slivers. ~60° keeps real area on screen AND a real
        // hinge, which is the whole difference.
        memb.rotation.x = -1.05;
        memb.scale.x = s;                              // one shape, mirrored
        pivot.add(memb);
        g.add(pivot);
      }
      return g;
    },
    tick(e, dt) {
      const k = Math.sin(e.t * e.speed / Math.max(1, e.range) * 2), ax = e.axis === 'x';
      e.pos[ax ? 'x' : 'z'] = e.home[ax ? 'x' : 'z'] + k * e.range / 2;
      e.pos.y = e.home.y + Math.sin(e.t * 2.4) * e.bob;
      // Deliberately NOT turned to face travel, unlike the ground patrollers:
      // these mostly run along x, and side-on the wings point at the camera and
      // foreshorten to nothing. Facing the camera is what keeps the beat legible
      // — the same reason the crate-top star doesn't spin. It banks instead.
      e.mesh.rotation.z = -k * .18;
      // Downstroke fast, recovery slow — an even sine reads as a machine.
      const beat = Math.sin(e.t * 9);
      const flap = Math.sign(beat) * Math.pow(Math.abs(beat), .6);
      for (const w of e.mesh.children) {
        if (!w.name?.startsWith('wing')) continue;
        const s = w.name.endsWith('L') ? 1 : -1;
        w.rotation.z = s * (flap * .62 + .16);
        w.rotation.y = s * flap * .22;                 // sweeps forward as it drops
      }
      e.mesh.children[0].position.y = .5 - flap * .06;  // body lifts on the beat
    },
  },
};

/* ---- the bat wing ----
 * Built once and shared. Three scallops along the trailing edge and a thumb
 * claw at the leading tip: the outline is the whole reason it reads as a wing
 * rather than a paddle, and it costs one Shape.
 */
function wingGeometry() {
  if (geoCache.has('#wing')) return geoCache.get('#wing');
  const s = new THREE.Shape();
  s.moveTo(0, .06);
  s.lineTo(.34, .24);            // leading edge, out to the wrist
  s.lineTo(.92, .30);            // …and on to the thumb
  s.lineTo(.86, .14);
  s.quadraticCurveTo(.74, .02, .62, -.10);   // scallop 1
  s.quadraticCurveTo(.56, .04, .44, -.14);   // scallop 2
  s.quadraticCurveTo(.36, .00, .24, -.18);   // scallop 3
  s.quadraticCurveTo(.14, -.06, 0, -.10);
  s.closePath();
  const g = new THREE.ShapeGeometry(s, 6);
  geoCache.set('#wing', g);
  return g;
}
