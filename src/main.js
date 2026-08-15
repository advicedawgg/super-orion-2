import * as THREE from 'three';
import * as In from './input.js';
import * as Sound from './audio.js';
import { tex } from './art.js';
import { Player } from './player.js';
import { World, CRATE } from './world.js';
import { LEVELS } from './levels.js';

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

const player = new Player(scene);
let world = null;
const camPos = new THREE.Vector3(), camAim = new THREE.Vector3();

/* -------------------------------------------------------------- particles */
// Fixed pool of little cubes. Enough juice, zero allocation during play.
const bits = [];
{
  const geo = new THREE.BoxGeometry(.22, .22, .22);
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.visible = false; scene.add(m);
    bits.push({ m, v: new THREE.Vector3(), life: 0 });
  }
}
let bitCursor = 0;
function burst(at, color, n = 10, power = 7) {
  for (let i = 0; i < n; i++) {
    const b = bits[bitCursor = (bitCursor + 1) % bits.length];
    b.m.position.copy(at); b.m.visible = true;
    b.m.material.color.set(color);
    b.m.scale.setScalar(0.7 + Math.random() * 0.8);
    b.v.set(Math.random() - .5, Math.random() * .9 + .3, Math.random() - .5).multiplyScalar(power);
    b.life = 0.65 + Math.random() * 0.35;
  }
}
function updateBits(dt) {
  for (const b of bits) {
    if (b.life <= 0) continue;
    b.life -= dt;
    if (b.life <= 0) { b.m.visible = false; continue; }
    b.v.y -= 26 * dt;
    b.m.position.addScaledVector(b.v, dt);
    b.m.rotation.x += dt * 8; b.m.rotation.y += dt * 6;
    b.m.scale.setScalar(Math.max(0.01, b.life));
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
  $('hearts').innerHTML = [0, 1, 2].map(i => `<span class="${i < G.hearts ? '' : 'gone'}">❤️</span>`).join('');
  $('stars').textContent = `⭐ ${G.stars}`;
  $('lives').textContent = `🐱 ${G.lives}`;
}

const KEYCARD = `<div class="keys">
  <kbd>← →  ↑ ↓ / WASD</kbd><kbd>SPACE — jump ×2</kbd><kbd>X — spin</kbd>
  <kbd>C in the air — ground pound</kbd><kbd>P — pause</kbd><kbd>M — music</kbd><kbd>R — restart</kbd></div>`;

/* ----------------------------------------------------------------- events */
player.fire = name => Sound.sfx(name);

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
function loadLevel(i) {
  if (world) world.dispose();
  const def = LEVELS[i];
  world = new World(scene, def);
  world.fx = worldFx;
  hemi.color.set(def.sky[0]); hemi.groundColor.set(0x50603a);
  sun.color.set(def.sun);
  G.spawn.set(...def.start);
  G.runStars = 0;
  player.reset(G.spawn);
  snapCamera();
  Sound.playMusic(def.id);
  if (def.hint) toast(def.hint, true);
}

function startRun() {
  G.hearts = 3; G.lives = 5; G.stars = 0;
  G.level = 0;
  loadLevel(0);
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
  const total = world.totalStars;
  const perfect = G.runStars >= total;
  show(`<h1>LEVEL CLEAR<small>${LEVELS[G.level].name.toUpperCase()}</small></h1>
    <p class="lead">Stars this level: <b>${G.runStars} / ${total}</b>${perfect ? ' — ⭐ STAR CHAMPION!' : ''}<br>
    Total stars: <b>${G.stars}</b></p>
    <p class="go">${G.level + 1 < LEVELS.length ? 'press SPACE for the next level' : 'press SPACE'}</p>`);
}

function gameOver() {
  G.state = 'GAMEOVER'; G.timer = 0;
  Sound.playMusic('title');
  show(`<h1>OUT OF CATS<small>THAT'S OK</small></h1>
    <p class="lead">Sootie needs a nap. You collected <b>${G.stars}</b> stars.<br>Snack break, then go again?</p>
    <p class="go">press SPACE to try again</p>`);
}

function gameWin() {
  G.state = 'WON';
  Sound.sfx('win'); Sound.playMusic('title');
  if (G.stars > G.best) { G.best = G.stars; localStorage.setItem(SAVE_KEY, JSON.stringify({ best: G.best })); }
  show(`<h1>YOU DID IT<small>SUPER ORION 2</small></h1>
    <p class="lead"><b>${G.stars}</b> stars collected. Best ever: <b>${G.best}</b>.<br>
    More worlds are still being built — underwater, jetpacks, all of it.</p>
    <p class="go">press SPACE to play again</p>`);
}

function title() {
  G.state = 'TITLE';
  Sound.stopMusic();
  show(`<h1>SUPER ORION 2<small>COSMIC CANNONBALL</small></h1>
    <p class="lead">Run, jump, spin and stomp your way through ${LEVELS.length} levels.<br>
    Smash every crate. Collect every star.</p>${KEYCARD}
    <p class="go">press SPACE to start</p>`);
}

/* ---------------------------------------------------------------- camera */
const CAM_OFF = new THREE.Vector3(0, 5.4, 11.5);
function camTarget(out) {
  const yaw = LEVELS[G.level].camYaw || 0;
  const off = CAM_OFF.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  return out.copy(player.pos).add(off);
}
function snapCamera() {
  camTarget(camPos);
  camAim.copy(player.pos).setY(player.pos.y + 1.3);
  cam.position.copy(camPos); cam.lookAt(camAim);
}
function updateCamera(dt) {
  const want = camTarget(new THREE.Vector3());
  // Lead the camera along travel so you can see what you're running into.
  want.x += THREE.MathUtils.clamp(player.vel.x, -6, 6) * 0.18;
  want.z += THREE.MathUtils.clamp(player.vel.z, -6, 6) * 0.18;
  camPos.x = THREE.MathUtils.damp(camPos.x, want.x, 6, dt);
  camPos.z = THREE.MathUtils.damp(camPos.z, want.z, 6, dt);
  camPos.y = THREE.MathUtils.damp(camPos.y, want.y, player.grounded ? 4 : 2.2, dt);
  cam.position.copy(camPos);

  camAim.x = THREE.MathUtils.damp(camAim.x, player.pos.x, 8, dt);
  camAim.y = THREE.MathUtils.damp(camAim.y, player.pos.y + 1.3, 5, dt);
  camAim.z = THREE.MathUtils.damp(camAim.z, player.pos.z, 8, dt);
  cam.lookAt(camAim);

  // Keep the shadow frustum glued to the player or shadows blink out.
  const d = LEVELS[G.level].sunDir || [-0.5, 1, 0.6];
  sun.position.set(player.pos.x + d[0] * 45, player.pos.y + d[1] * 45, player.pos.z + d[2] * 45);
  sun.target.position.copy(player.pos);
  sun.target.updateMatrixWorld();
}

/* ------------------------------------------------------------------- loop */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  In.update();

  if (toastT > 0 && (toastT -= dt) <= 0) toastEl.classList.remove('on');

  switch (G.state) {
    case 'TITLE':
      if (In.hitAny()) { Sound.init(); startRun(); }
      break;
    case 'PLAY': {
      if (In.hit('pause')) { G.state = 'PAUSED'; Sound.pauseMusic(); show(`<h1>PAUSED<small>TAKE YOUR TIME</small></h1>${KEYCARD}<p class="go">press P to keep going</p>`); break; }
      if (In.hit('restart')) { respawn(); break; }
      const hit = player.update(dt, world.solids, LEVELS[G.level].camYaw || 0);
      player.riding = hit.grounded ? hit.ground : null;
      if (world.update(dt, player) === 'win') { levelClear(); break; }
      if (player.pos.y < world.killY) die(true);
      break;
    }
    case 'PAUSED':
      if (In.hit('pause')) { G.state = 'PLAY'; hideOverlay(); Sound.resumeMusic(); }
      break;
    case 'DYING':
      if ((G.timer -= dt) <= 0) G.lives > 0 ? respawn() : gameOver();
      break;
    case 'CLEAR':
      G.timer += dt;
      if (G.timer > .6 && In.hitAny()) {
        if (++G.level < LEVELS.length) { loadLevel(G.level); G.state = 'PLAY'; hideOverlay(); drawHUD(); }
        else gameWin();
      }
      break;
    case 'GAMEOVER':
    case 'WON':
      G.timer += dt;
      if (G.timer > .6 && In.hitAny()) { Sound.init(); startRun(); }
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
  const names = ['grass', 'rock', 'dirt', 'sand', 'wood', 'crate', 'ice', 'metal', 'orion'];
  const bar = $('loadbar').querySelector('i');
  for (let i = 0; i < names.length; i++) {
    tex(names[i]);
    bar.style.transform = `scaleX(${(i + 1) / names.length})`;
    await new Promise(r => setTimeout(r, 0));
  }
  In.initTouch();
  loadLevel(0);
  title();
  requestAnimationFrame(frame);
}
boot();

window.__SO2 = { G, get world() { return world; }, player, cam, scene, LEVELS, THREE };
