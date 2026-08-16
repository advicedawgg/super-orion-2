import * as THREE from 'three';
import * as In from './input.js';
import * as Sound from './audio.js';
import { tex } from './art.js';
import { bounds } from './physics.js';
import { Player } from './player.js';
import { World, CRATE } from './world.js';
import { LEVELS, HUB } from './levels.js';

const SAVE_KEY = 'superOrion2Save';
const $ = id => document.getElementById(id);

/* --------------------------------------------------------------- renderer */
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(58, 1, 0.3, 400);
const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x50603a, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4dd, 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 140 });
sun.shadow.bias = -0.0012;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  cam.aspect = w / h; cam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

/* ------------------------------------------------------------------ state */
const G = {
  state: 'LOADING', level: 0, hearts: 3, lives: 5, stars: 0, runStars: 0,
  spawn: new THREE.Vector3(), timer: 0, best: 0,
};
const save = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
G.best = save.best || 0;
// Best stars per level id. This is what the hub placards read, and what makes
// "go and beat your score on the reef" a thing you can do at all.
G.lv = save.lv || {};
const bestFor = id => G.lv[id] || 0;
const totalStars = () => LEVELS.reduce((n, l) => n + bestFor(l.id), 0);
const cleared = id => id in G.lv;
const allCleared = () => LEVELS.every(l => cleared(l.id));
// Progression is linear: the first is always open, and clearing one opens the
// next. Everything you have already cleared stays open, so backtracking to
// beat your score on an earlier level is always allowed.
const unlocked = i => i === 0 || cleared(LEVELS[i - 1].id);
function persist() {
  G.best = Math.max(G.best, totalStars());
  localStorage.setItem(SAVE_KEY, JSON.stringify({ best: G.best, lv: G.lv }));
}

const player = new Player(scene);
let world = null;
const camPos = new THREE.Vector3(), camAim = new THREE.Vector3();

/* -------------------------------------------------------------- particles */
// Fixed pool of little cubes. Enough juice, zero allocation during play.
const bits = [];
{
  const geo = new THREE.BoxGeometry(.22, .22, .22);
  // 150, not 90: a breath is a dozen bubbles and the reef breathes constantly,
  // so at 90 a plume would recycle itself before it reached the surface.
  for (let i = 0; i < 150; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.visible = false; scene.add(m);
    bits.push({ m, v: new THREE.Vector3(), life: 0 });
  }
}
let bitCursor = 0;
const nextBit = () => bits[bitCursor = (bitCursor + 1) % bits.length];
function burst(at, color, n = 10, power = 7) {
  for (let i = 0; i < n; i++) {
    const b = nextBit();
    b.m.position.copy(at); b.m.visible = true;
    b.m.material.color.set(color);
    b.m.material.transparent = false; b.m.material.opacity = 1;
    b.v.set(Math.random() - .5, Math.random() * .9 + .3, Math.random() - .5).multiplyScalar(power);
    b.g = 26; b.size = 0.7 + Math.random() * 0.8; b.spin = 1;
    b.life = 0.65 + Math.random() * 0.35;
  }
}
/** Same pool, opposite gravity: debris falls, a diver's breath goes up. */
function bubble(x, y, z) {
  const b = nextBit();
  b.m.position.set(x + (Math.random() - .5) * .55, y + (Math.random() - .5) * .3, z + (Math.random() - .5) * .55);
  b.m.visible = true; b.m.material.color.set(0xdff6ff);
  // Each bit owns its material, so this is a per-bubble setting, not a global.
  b.m.material.transparent = true; b.m.material.opacity = .55;
  b.v.set((Math.random() - .5) * .8, 1.0 + Math.random() * 0.8, (Math.random() - .5) * .8);
  // Barely buoyant. At debris gravity (26) flipped they accelerate to 12u/s and
  // are off the top of the screen before you see them; water is not a vacuum.
  // These rise ~4u over their life, so the plume stays around the diver.
  b.g = -0.8; b.size = 0.7 + Math.random() * 0.7; b.spin = 0;
  // Staggered lifetimes stretch the puff into a plume on the way up rather
  // than a single blob that pops all at once.
  b.life = 0.8 + Math.random() * 1.0;
}
/** A breath: a proper cloud of them, not a token puff. */
const breath = (n, x, y, z) => { for (let i = 0; i < n; i++) bubble(x, y, z); };
function updateBits(dt) {
  for (const b of bits) {
    if (b.life <= 0) continue;
    b.life -= dt;
    if (b.life <= 0) { b.m.visible = false; continue; }
    b.v.y -= b.g * dt;
    b.m.position.addScaledVector(b.v, dt);
    b.m.rotation.x += dt * 8 * b.spin; b.m.rotation.y += dt * 6 * b.spin;
    // Clamped, because a bubble outlives a spark: at life 2.2 raw it would
    // spawn as a dinner plate and shrink. Hold size, then shrink out.
    b.m.scale.setScalar(Math.min(1, Math.max(0.01, b.life)) * b.size);
  }
}

/* --------------------------------------------------------------------- UI */
const overlay = $('overlay'), card = $('card'), hud = $('hud'), toastEl = $('toast');
let toastT = 0;
function toast(msg, tip = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('tip', tip);
  toastEl.classList.add('on');
  toastT = tip ? 5 : 1.1;
}

function show(html) { card.innerHTML = html; overlay.classList.remove('hide'); hud.hidden = true; }
function hideOverlay() { overlay.classList.add('hide'); hud.hidden = false; }

function drawHUD() {
  hud.classList.toggle('hub', !!G.inHub);
  $('hearts').innerHTML = [0, 1, 2].map(i => `<span class="${i < G.hearts ? '' : 'gone'}">❤️</span>`).join('');
  // On the map the number that matters is everything you have ever collected;
  // inside a level it is what this run is worth.
  $('stars').textContent = `⭐ ${G.inHub ? totalStars() : G.stars}`;
  $('lives').textContent = `🐱 ${G.lives}`;
}

// Air / fuel. Only shown in a mode that meters lift, because in every other
// mode it is pinned full and a permanently-full bar is just noise.
const tankEl = $('tank'), tankBar = tankEl.querySelector('i');
function drawTank() {
  tankBar.style.transform = `scaleX(${player.tank})`;
  tankEl.classList.toggle('low', player.tank < 0.3);
}

// ↓ means something different depending on where you are, so the card has to
// say which — from a level it is the map, from the map it is out of the game.
const pauseCard = () => `<h1>PAUSED<small>TAKE YOUR TIME</small></h1>${KEYCARD}
  <p class="go">press P to keep going</p>
  <p class="lead">…or press ↓ ${G.inHub ? 'to leave for the games menu' : 'to go back to the map'}</p>`;

const KEYCARD = `<div class="keys">
  <kbd>← →  ↑ ↓ / WASD</kbd><kbd>SPACE — jump ×2</kbd><kbd>X — spin</kbd>
  <kbd>C in the air — ground pound</kbd><kbd>P — pause</kbd><kbd>M — music</kbd><kbd>R — restart</kbd></div>`;

/* ----------------------------------------------------------------- events */
// A stroke throws a puff of bubbles as well as a sound — underwater you should
// be able to SEE that the button did something, not just hear it.
player.fire = name => {
  Sound.sfx(name);
  if (name === 'stroke') breath(14, player.pos.x, player.pos.y + 1.5, player.pos.z);
};

function worldFx(name, at, info) {
  switch (name) {
    case 'star': G.stars++; G.runStars++; Sound.sfx('star'); burst(at, 0xffd23f, 8, 6); break;
    case 'crate':
      Sound.sfx('crate'); burst(at, 0xc08a4a, 14, 8);
      if (info?.stars) { G.stars += info.stars; G.runStars += info.stars; Sound.sfx('star'); burst(at, 0xffd23f, info.stars * 2, 7); toast(`+${info.stars} ⭐`); }
      if (info?.life) { G.lives++; Sound.sfx('life'); toast('1-UP! 🐱'); }
      break;
    case 'spring': Sound.sfx('spring'); burst(at, 0xa8d8ff, 8, 5); break;
    case 'bonk': Sound.sfx('bonk'); burst(at, 0xffffff, 12, 7); break;
    case 'hurt': damage(); break;
    case 'checkpoint': Sound.sfx('checkpoint'); toast('CHECKPOINT!'); burst(at, 0xff5d73, 16, 8); G.spawn.copy(at); break;
  }
  drawHUD();
}

function damage() {
  Sound.sfx('hurt');
  G.hearts--;
  drawHUD();
  if (G.hearts <= 0) die();
}

function die(fell = false) {
  if (G.state !== 'PLAY') return;
  G.state = 'DYING'; G.timer = 1.4;
  Sound.sfx('die');
  // A fall throws up whatever it landed in; a hearts death is a puff of Orion.
  burst(player.pos.clone().setY(player.pos.y + .7),
    fell ? world.splash : 0xffd23f, fell ? 26 : 20, fell ? 11 : 9);
  player.rig.root.visible = false;
  G.lives--;
}

/* ------------------------------------------------------------------ flow */
function loadWorld(def) {
  if (world) world.dispose();
  world = new World(scene, def);
  world.fx = worldFx;
  hemi.color.set(def.sky[0]); hemi.groundColor.set(def.amb ?? 0x50603a);
  sun.color.set(def.sun);
  sun.intensity = def.sunPower ?? 2.1;
  player.setMode(def.mode, def.ceilY ?? null);
  tankEl.classList.toggle('on', player.metered);
  tankEl.dataset.kind = def.mode || '';
  G.spawn.set(...def.start);
  G.runStars = 0;
  player.reset(G.spawn);
  snapCamera();
  Sound.playMusic(def.music || def.id);
  if (def.hint) toast(def.hint, true);
  return def;
}

/** The map. Walk into a ring to play that level. */
function enterHub() {
  G.inHub = true;
  G.hearts = 3; G.lives = 5; G.runStars = 0;
  loadWorld(HUB);
  world.labelPortals(i => {
    const open = unlocked(i);
    return {
      title: LEVELS[i].name,
      sub: !open ? '🔒 LOCKED' : cleared(LEVELS[i].id) ? `⭐ ${bestFor(LEVELS[i].id)}` : 'NEW',
      accent: open ? LEVELS[i].sky[0] : 0x55607a,
      locked: !open,
    };
  });
  G.atPortal = null;
  G.state = 'HUB'; hideOverlay(); drawHUD();
  // Announce the door that just opened, once, on the way back in.
  if (G.justUnlocked !== undefined) {
    const n = G.justUnlocked; G.justUnlocked = undefined;
    toast(`${LEVELS[n].name} unlocked!`);
    Sound.sfx('life');
  }
}

function enterLevel(i) {
  G.inHub = false;
  G.level = i;
  G.hearts = 3; G.lives = 5; G.stars = 0;
  loadWorld(LEVELS[i]);
  G.state = 'PLAY'; hideOverlay(); drawHUD();
}

function respawn() {
  G.hearts = 3;
  player.reset(G.spawn);
  snapCamera();
  G.state = 'PLAY';
  drawHUD();
}

function levelClear() {
  G.state = 'CLEAR'; G.timer = 0;
  Sound.sfx('win'); Sound.stopMusic();
  const id = LEVELS[G.level].id, total = world.totalStars;
  const prev = bestFor(id), beat = G.runStars > prev;
  // Only ever bank an improvement: replaying a level for fun must not cost you
  // the score you already have.
  const first = !(id in G.lv);          // clearing it with 0 stars still counts
  G.lv[id] = Math.max(prev, G.runStars);
  persist();
  // Clearing this for the first time is what opens the next one.
  if (first && G.level + 1 < LEVELS.length) G.justUnlocked = G.level + 1;
  const perfect = G.runStars >= total;
  show(`<h1>LEVEL CLEAR<small>${LEVELS[G.level].name.toUpperCase()}</small></h1>
    <p class="lead">Stars this level: <b>${G.runStars} / ${total}</b>${perfect ? ' — ⭐ STAR CHAMPION!' : ''}<br>
    ${beat && prev ? `New best! (was ${prev})<br>` : ''}
    Stars altogether: <b>${totalStars()}</b></p>
    <p class="go">press SPACE for the map</p>`);
}

function gameOver() {
  G.state = 'GAMEOVER'; G.timer = 0;
  Sound.stopMusic();
  show(`<h1>OUT OF CATS<small>THAT'S OK</small></h1>
    <p class="lead">Sootie needs a nap. You got <b>${G.runStars}</b> stars that go.<br>
    Nothing is lost — your best on each level is saved.</p>
    <p class="go">press SPACE for the map</p>`);
}

function gameWin() {
  G.state = 'WON'; G.timer = 0;
  Sound.sfx('win'); Sound.playMusic('title');
  persist();
  show(`<h1>YOU DID IT<small>SUPER ORION 2</small></h1>
    <p class="lead"><b>${totalStars()}</b> stars collected. Best ever: <b>${G.best}</b>.<br>
    Jungle, coast, peaks, reef and the whole sky — you cleared the lot.</p>
    <p class="go">press SPACE for the map</p>`);
}

function title() {
  G.state = 'TITLE';
  Sound.stopMusic();
  show(`<h1>SUPER ORION 2<small>COSMIC CANNONBALL</small></h1>
    <p class="lead">Run, jump, spin and stomp your way through ${LEVELS.length} levels.<br>
    Smash every crate. Collect every star.</p>${KEYCARD}
    <p class="go">press SPACE to start</p>`);
  G.sawWin = false;
}

/* ---------------------------------------------------------------- camera */
// The rig. A level can move the camera back and up — which is the whole reason
// the camera was built as an offset in the first place: underwater and flight
// levels are this same rig with a different offset, not a different camera.
const CAM_OFF = [0, 5.4, 11.5];
const camOff = new THREE.Vector3();
// Clearing the LAST level leaves G.level one past the end, and the camera keeps
// running under the win screen — so this must not be a bare LEVELS[G.level].
// It threw every frame on the WON state, which also stopped the render loop and
// froze the picture behind the card.
const shownLevel = () => LEVELS[Math.min(G.level, LEVELS.length - 1)];
function camTarget(out) {
  const def = shownLevel();
  const off = camOff.set(...(def.camOff || CAM_OFF))
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), def.camYaw || 0);
  return out.copy(player.pos).add(off);
}
/* ---- line of sight ----
 * The camera direction is FIXED per level, so sooner or later something ends
 * up between it and Orion: a lighthouse you walk round the back of, a tunnel
 * roof, and above all the flight level, where the gates span the whole
 * corridor and you are blind for most of the run. The rule is that Orion is
 * NEVER occluded.
 *
 * Shortening the boom is the usual answer and it is the wrong one here: these
 * walls are 56u wide and 4u thick, so "pull in until the line is clear" parks
 * the camera inside the wall, or a foot from Orion's back. Instead, anything
 * strictly BETWEEN the camera and Orion stops being drawn. It only ever hides
 * geometry he is already level with or past — never what he is flying toward,
 * because that is not on the segment — and it costs one slab test per solid.
 *
 * Solids are AABBs and we already have `bounds`, so this is a slab test
 * against the level rather than a raycast against meshes: no BVH, no
 * per-frame allocation, and it sees movers because they clear their own `_b`.
 */
const occluded = [];
function segmentHits(from, to, s) {
  const b = s._b || (s._b = bounds(s));
  const p = [from.x, from.y, from.z];
  const d = [to.x - from.x, to.y - from.y, to.z - from.z];
  const lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
  let t0 = 0, t1 = 1;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (p[a] < lo[a] || p[a] > hi[a]) return false; continue; }
    let u = (lo[a] - p[a]) / d[a], v = (hi[a] - p[a]) / d[a];
    if (u > v) { const k = u; u = v; v = k; }
    if (u > t0) t0 = u;
    if (v < t1) t1 = v;
    if (t0 > t1) return false;
  }
  return true;
}

/** Hide whatever is standing between the camera and Orion; restore the rest. */
function keepOrionInSight() {
  for (const s of occluded) if (s.mesh) s.mesh.visible = true;
  occluded.length = 0;
  for (const s of world.solids) {
    // Crates and tree trunks own their own meshes and are too small to blind
    // you; only the architecture is worth cutting away.
    if (!s.mesh) continue;
    if (segmentHits(camAim, cam.position, s)) { s.mesh.visible = false; occluded.push(s); }
  }
}

function snapCamera() {
  camTarget(camPos);
  camAim.copy(player.pos).setY(player.pos.y + 1.3);
  cam.position.copy(camPos); cam.lookAt(camAim);
  keepOrionInSight();
}
function updateCamera(dt) {
  const want = camTarget(new THREE.Vector3());
  // Lead the camera along travel so you can see what you're running into.
  want.x += THREE.MathUtils.clamp(player.vel.x, -6, 6) * 0.18;
  want.z += THREE.MathUtils.clamp(player.vel.z, -6, 6) * 0.18;
  camPos.x = THREE.MathUtils.damp(camPos.x, want.x, 6, dt);
  camPos.z = THREE.MathUtils.damp(camPos.z, want.z, 6, dt);
  camPos.y = THREE.MathUtils.damp(camPos.y, want.y, player.grounded ? 4 : 2.2, dt);

  camAim.x = THREE.MathUtils.damp(camAim.x, player.pos.x, 8, dt);
  camAim.y = THREE.MathUtils.damp(camAim.y, player.pos.y + 1.3, 5, dt);
  camAim.z = THREE.MathUtils.damp(camAim.z, player.pos.z, 8, dt);
  cam.position.copy(camPos);
  cam.lookAt(camAim);
  keepOrionInSight();

  // Keep the shadow frustum glued to the player or shadows blink out.
  const d = shownLevel().sunDir || [-0.5, 1, 0.6];
  sun.position.set(player.pos.x + d[0] * 45, player.pos.y + d[1] * 45, player.pos.z + d[2] * 45);
  sun.target.position.copy(player.pos);
  sun.target.updateMatrixWorld();
}

/* ------------------------------------------------------------------- loop */
let last = performance.now();
let bubbleT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  In.update();

  if (toastT > 0 && (toastT -= dt) <= 0) toastEl.classList.remove('on');

  switch (G.state) {
    case 'TITLE':
      if (In.hitAny()) { Sound.init(); enterHub(); }
      break;
    // The map. Same movement and same camera as a level — it IS a level, minus
    // a goal — so walking into a ring is the only control you have to learn.
    case 'HUB': {
      if (In.hit('pause')) {
        G.state = 'PAUSED'; Sound.pauseMusic();
        show(pauseCard());
        break;
      }
      player.update(dt, world.solids, HUB.camYaw || 0);
      const ev = world.update(dt, player);
      const at = ev && ev.portal !== undefined ? ev.portal : null;
      // Edge-triggered: standing in a locked ring must say so once, not once a
      // frame, and stepping out and back in is what asks again.
      if (at !== null && at !== G.atPortal) {
        if (!ev.locked) { Sound.sfx('checkpoint'); G.atPortal = at; enterLevel(at); break; }
        Sound.sfx('bonk');
        toast(`Finish ${LEVELS[at - 1].name} first!`);
      }
      G.atPortal = at;
      if (player.pos.y < world.killY) { player.reset(new THREE.Vector3(...HUB.start)); snapCamera(); }
      break;
    }
    case 'PLAY': {
      if (In.hit('pause')) {
        G.state = 'PAUSED'; Sound.pauseMusic();
        show(pauseCard());
        break;
      }
      if (In.hit('restart')) { respawn(); break; }
      const hit = player.update(dt, world.solids, LEVELS[G.level].camYaw || 0);
      player.riding = hit.grounded ? hit.ground : null;
      if (player.metered) drawTank();
      // A diver breathes. Idle bubbles keep the reef reading as water even when
      // you are standing still on the bottom.
      if (world.def.mode === 'swim' && (bubbleT -= dt) <= 0) {
        bubbleT = 0.45 + Math.random() * 0.45;
        breath(4, player.pos.x, player.pos.y + 1.5, player.pos.z);
      }
      if (world.update(dt, player) === 'win') { levelClear(); break; }
      if (player.pos.y < world.killY) die(true);
      break;
    }
    case 'PAUSED':
      if (In.hit('pause')) { G.state = G.inHub ? 'HUB' : 'PLAY'; hideOverlay(); Sound.resumeMusic(); }
      // ↓ while paused: from a level, back to the map — that is the "quit to
      // the level map" this game now actually has. From the map itself, out to
      // the launcher menu, which is where it used to always go.
      else if (In.hit('down')) { if (G.inHub) location.href = $('quit').href; else { Sound.resumeMusic(); enterHub(); } }
      break;
    case 'DYING':
      if ((G.timer -= dt) <= 0) G.lives > 0 ? respawn() : gameOver();
      break;
    case 'CLEAR':
      G.timer += dt;
      if (G.timer > .6 && In.hitAny()) {
        // Clearing the last one you needed earns the win card, once.
        if (allCleared() && !G.sawWin) { G.sawWin = true; gameWin(); }
        else enterHub();
      }
      break;
    case 'GAMEOVER':
    case 'WON':
      G.timer += dt;
      if (G.timer > .6 && In.hitAny()) { Sound.init(); enterHub(); }
      break;
  }

  if (world && G.state !== 'PAUSED') updateBits(dt);
  if (world) updateCamera(dt);
  renderer.render(scene, cam);
}

/* ------------------------------------------------------------------- boot */
addEventListener('keydown', e => {
  if (e.code === 'KeyM') toast(Sound.toggleMute() ? '🔇 muted' : '🔊 sound on');
  if (e.code === 'KeyF') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
});
In.cheat('sootie', () => { G.lives += 3; toast('🐱 SOOTIE SAYS HI (+3)'); Sound.sfx('life'); drawHUD(); });
In.cheat('star', () => { G.stars += 10; toast('⭐ +10'); Sound.sfx('star'); drawHUD(); });

async function boot() {
  // Painting the procedural textures costs a few hundred ms; do it up front
  // with a yield between each so the loading bar actually moves.
  const names = ['grass', 'rock', 'dirt', 'sand', 'wood', 'crate', 'ice', 'metal',
                 'deck', 'panel', 'orion', 'orionSuit'];
  const bar = $('loadbar').querySelector('i');
  for (let i = 0; i < names.length; i++) {
    tex(names[i]);
    bar.style.transform = `scaleX(${(i + 1) / names.length})`;
    await new Promise(r => setTimeout(r, 0));
  }
  In.initTouch();
  loadWorld(HUB);
  title();
  requestAnimationFrame(frame);
}
boot();

// Debug handle. `goto`/`hub` are here because a screenshot of level 4 should
// not cost four levels of play — see AGENTS.md, "Playwright can drive it".
window.__SO2 = {
  G, get world() { return world; }, player, cam, scene, LEVELS, THREE,
  goto(i) { enterLevel(i); },
  hub() { enterHub(); },
};
