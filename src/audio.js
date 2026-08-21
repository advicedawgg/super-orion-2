// SFX are synthesised — a generated wav of a jump blip is strictly worse than
// four lines of WebAudio, and never has to be downloaded. Music is a real file
// (assets/audio/<id>.mp3); if it isn't there yet the game just runs quiet.

import { LOOPS } from './music.js';

let ctx = null, bus = null, musicBus = null, sfxBus = null, muted = false;
let musicSrc = null, musicId = null;

/* ------------------------------------------------------------- volume ---
 * Two sub-busses under the master, because "the music is too loud" and "the
 * jump blip is too loud" are different complaints and a single slider can only
 * answer one of them. The master (`bus`) stays the mute switch and the overall
 * trim; MIX is the ceiling each slider scales, so 100% still sits where the
 * hand-tuned mix was — music under the SFX, not level with them.
 *
 * Saved under its own key rather than in the game save: sound settings are a
 * property of this machine, and clearing your stars must not reset them. */
const VOL_KEY = 'superOrion2Sound';
// Named VOL, not `vol`: tone()/noise() take a `vol` argument and a shadowed
// module global is how you write a slider that silently does nothing.
const MIX = { music: 0.7, sfx: 1.0 };
// Defaults reproduce the mix the game shipped with (music 0.8 * 0.7 * the 0.5
// on the source = the old 0.28), so an existing player hears no change until
// they touch a slider. Music has headroom above the default; SFX does not.
const VOL = { music: 0.8, sfx: 1.0 };
try { Object.assign(VOL, JSON.parse(localStorage.getItem(VOL_KEY) || '{}')); } catch { }

/** Current 0..1 slider positions. A copy — set them through setVol(). */
export const getVol = () => ({ ...VOL });

/** Set one slider, 0..1. Applies live, persists, returns the clamped value. */
export function setVol(kind, v) {
  v = Math.max(0, Math.min(1, Math.round(v * 100) / 100));
  VOL[kind] = v;
  applyVol();
  try { localStorage.setItem(VOL_KEY, JSON.stringify(VOL)); } catch { }
  return v;
}

function applyVol() {
  if (!ctx) return;                       // pre-init: init() applies it instead
  musicBus.gain.value = VOL.music * MIX.music;
  sfxBus.gain.value = VOL.sfx * MIX.sfx;
}

/** Must be called from a user gesture — browsers block audio before one. */
export function init() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  bus = ctx.createGain();
  bus.gain.value = 0.5;
  bus.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.connect(bus);
  sfxBus = ctx.createGain(); sfxBus.connect(bus);
  applyVol();
}

export function toggleMute() {
  muted = !muted;
  if (bus) bus.gain.value = muted ? 0 : 0.5;   // music routes through bus too
  return muted;
}
export const isMuted = () => muted;

/* ------------------------------------------------------------------ synth */
function tone(type, f0, f1, dur, vol, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol, f0, f1, q = 1, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t);
}

const SFX = {
  // Short triangle sweep + a breath of air. A square-wave siren reads as an
  // error tone, not a hop — the old one was both too harsh and too long.
  jump: () => { tone('triangle', 400, 880, .09, .17); noise(.06, .030, 900, 2400, 1.2); },
  jump2: () => { tone('triangle', 660, 1320, .10, .15); noise(.08, .040, 1500, 3600, 1.4); },
  land: () => { tone('sine', 140, 62, .09, .14); noise(.06, .040, 380, 150, 1); },
  step: () => noise(.05, .03, 700, 300, 1.5),
  star: () => { tone('triangle', 990, 990, .09, .17); tone('triangle', 1480, 1480, .16, .14, .07); },
  bonk: () => { tone('square', 420, 90, .17, .18); noise(.12, .10, 900, 250, 1.2); },
  crate: () => { noise(.20, .16, 900, 180, .8); tone('triangle', 260, 120, .14, .10); },
  spring: () => { tone('sine', 240, 1150, .22, .20); tone('sine', 360, 1550, .22, .10, .02); },
  stomp: () => tone('sawtooth', 700, 140, .18, .14),
  // Underwater: a muffled thump and a bubble, not the crisp airy hop.
  stroke: () => { tone('sine', 260, 430, .16, .13); noise(.14, .035, 320, 900, 2.4); },
  thrust: () => noise(.34, .09, 180, 620, .7),
  stompland: () => { tone('sine', 120, 45, .22, .24); noise(.18, .14, 300, 90, .7); },
  // A lone bandpassed noise sweep at .10 is a "tss" you cannot hear over the
  // music — which read as the spin having no sound at all. It needs a PITCH to
  // carry it: a rising whoosh, a low body under it, and the noise as the air.
  spin: () => {
    tone('triangle', 320, 1180, .26, .17);
    tone('sawtooth', 160, 520, .20, .07, .01);
    noise(.26, .17, 600, 3000, .8);
    tone('triangle', 1180, 700, .10, .09, .20);   // the flick out of the turn
  },
  hurt: () => { tone('sawtooth', 400, 120, .28, .18); tone('square', 300, 90, .30, .10, .04); },
  checkpoint: () => [0, 1, 2].forEach(i => tone('triangle', [523, 659, 784][i], [523, 659, 784][i], .22, .15, i * .09)),
  life: () => [0, 1, 2, 3].forEach(i => tone('square', [523, 659, 784, 1047][i], [523, 659, 784, 1047][i], .18, .14, i * .07)),
  die: () => [0, 1, 2, 3].forEach(i => tone('square', [660, 550, 440, 220][i], [660, 550, 440, 220][i], .26, .16, i * .12)),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => { tone('square', f, f, .30, .15, i * .11); tone('triangle', f * 2, f * 2, .30, .07, i * .11); }),

  /* ---- the boss ---- */
  // A heavy man leaving the ground, and a heavy man arriving.
  bosshop: () => { tone('sawtooth', 90, 240, .22, .16); noise(.18, .07, 200, 700, .8); },
  bossland: () => { tone('sine', 96, 38, .34, .26); noise(.26, .18, 260, 70, .6); tone('square', 70, 46, .22, .10, .02); },
  bosshit: () => { tone('square', 300, 140, .26, .18); tone('sawtooth', 180, 90, .3, .12, .03); noise(.2, .12, 700, 200, 1); },
  bossdown: () => [392, 349, 311, 262, 196].forEach((f, i) => { tone('sawtooth', f, f * .96, .34, .13, i * .13); tone('square', f / 2, f / 2, .34, .07, i * .13); }),
  gate: () => { noise(.7, .22, 900, 90, .5); tone('sawtooth', 150, 40, .6, .12); },
  // Dad says something. A blurt, not a word — the toast carries the joke.
  quip: () => { tone('square', 180, 150, .07, .08); tone('square', 165, 200, .07, .07, .08); },

  /* ---- easter eggs ---- */
  rimshot: () => { noise(.07, .22, 320, 180, 1.2); noise(.07, .20, 380, 200, 1.2, .1); noise(.6, .16, 5200, 3000, .5, .2); },
  // Yes, it is a fart. He is seven.
  toot: () => { tone('sawtooth', 130, 62, .42, .17); noise(.42, .10, 260, 90, 3.2); tone('square', 96, 54, .34, .07, .05); },

  /* ---- the new crates ---- */
  // A tnt chain. Two layers: the crack of the charge and the low body of it
  // rolling away after. One noise burst on its own is a hi-hat, not a bang.
  boom: () => {
    noise(.09, .30, 2600, 900, .7);
    noise(.75, .26, 420, 60, .5, .02);
    tone('sawtooth', 130, 34, .55, .17, .01);
    tone('square', 78, 30, .70, .10, .05);
  },
  // A spin that skipped off an iron crate. Bright, metallic, and deliberately
  // NOT a bonk: the kid has to be able to hear the difference between "that
  // did nothing" and "that thing is different".
  clang: () => {
    tone('square', 1450, 1180, .16, .11);
    tone('square', 2170, 1900, .22, .06, .01);
    noise(.16, .10, 5200, 2600, 2.2);
  },
  // Bouncing off a jellyfish bell. Wetter and lower than the spring crate,
  // because it happens underwater and it happens to something alive.
  boing: () => {
    tone('sine', 190, 720, .26, .17);
    tone('sine', 95, 360, .30, .09, .02);
    noise(.18, .05, 500, 1400, 2.6);
  },
  // The crate combo, `n` smashes in. Rising fifths that keep climbing — the
  // whole reward is that it does not stop going up while you keep going.
  combo: (n = 1) => {
    const f = 523 * Math.pow(1.0595, Math.min(24, n * 2));
    tone('triangle', f, f, .16, .15);
    tone('triangle', f * 1.5, f * 1.5, .20, .08, .03);
  },
};

/** `arg` reaches the recipe — only the pitched ones (`combo`) read it. */
export function sfx(name, arg) { SFX[name]?.(arg); }

/* ------------------------------------------------------------------ music */
// Add an id here once assets/audio/<id>.mp3 exists. Missing files stay silent
// rather than throwing — the game must never fail to start over a soundtrack.
// Generated locally by tools/genmusic.js (MiniMax Music 3 on the 4090).
export const TRACKS = new Set(['jungle', 'coast', 'frost', 'reef', 'cosmic', 'title',
                               'cavern', 'dunes', 'lunar', 'skyway', 'castle']);

/**
 * Play a track. Runs 0..loopEnd once — the intro — then repeats
 * loopStart..loopEnd forever, using the loop points found by
 * tools/looppoints.js. A plain <audio loop> can only restart from zero, which
 * is why this goes through WebAudio: loopStart/loopEnd are native here and the
 * seam is sample-exact with no gap.
 */
export async function playMusic(id) {
  if (musicId === id && musicSrc) return;
  stopMusic();
  // Claim the id only once we can actually play, or the pre-title loadLevel()
  // would take the name while ctx is still null and the real one would no-op.
  if (!TRACKS.has(id) || !ctx) return;
  musicId = id;

  let buf;
  try {
    const res = await fetch(`./assets/audio/${id}.mp3`);
    if (!res.ok) throw new Error(res.status);
    buf = await ctx.decodeAudioData(await res.arrayBuffer());
  } catch { return; }              // a missing soundtrack must never break the game
  if (musicId !== id) return;      // level changed while we were decoding

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const L = LOOPS[id];
  if (L) { src.loopStart = L.loopStart; src.loopEnd = L.loopEnd; }
  const g = ctx.createGain();
  g.gain.value = 0.5;              // the rest of the trim lives on musicBus
  src.connect(g).connect(musicBus);
  src.start(0);
  musicSrc = src;
}

export function stopMusic() {
  if (musicSrc) { try { musicSrc.stop(); } catch { } musicSrc.disconnect(); musicSrc = null; }
  musicId = null;
}

// A buffer source can't be paused, so pause the whole context. That's correct
// here anyway — a paused game should be silent, SFX included.
export function pauseMusic() { ctx?.suspend(); }
export function resumeMusic() { ctx?.resume(); }
