// SFX are synthesised — a generated wav of a jump blip is strictly worse than
// four lines of WebAudio, and never has to be downloaded. Music is a real file
// (assets/audio/<id>.mp3); if it isn't there yet the game just runs quiet.

import { LOOPS } from './music.js';

let ctx = null, bus = null, muted = false;
let musicSrc = null, musicId = null;

/** Must be called from a user gesture — browsers block audio before one. */
export function init() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  bus = ctx.createGain();
  bus.gain.value = 0.5;
  bus.connect(ctx.destination);
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
  o.connect(g).connect(bus);
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
  src.connect(f).connect(g).connect(bus);
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
  spin: () => noise(.30, .10, 500, 2600, 1.4),
  hurt: () => { tone('sawtooth', 400, 120, .28, .18); tone('square', 300, 90, .30, .10, .04); },
  checkpoint: () => [0, 1, 2].forEach(i => tone('triangle', [523, 659, 784][i], [523, 659, 784][i], .22, .15, i * .09)),
  life: () => [0, 1, 2, 3].forEach(i => tone('square', [523, 659, 784, 1047][i], [523, 659, 784, 1047][i], .18, .14, i * .07)),
  die: () => [0, 1, 2, 3].forEach(i => tone('square', [660, 550, 440, 220][i], [660, 550, 440, 220][i], .26, .16, i * .12)),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => { tone('square', f, f, .30, .15, i * .11); tone('triangle', f * 2, f * 2, .30, .07, i * .11); }),
};

export function sfx(name) { SFX[name]?.(); }

/* ------------------------------------------------------------------ music */
// Add an id here once assets/audio/<id>.mp3 exists. Missing files stay silent
// rather than throwing — the game must never fail to start over a soundtrack.
// Generated locally by tools/genmusic.js (MiniMax Music 3 on the 4090).
export const TRACKS = new Set(['jungle', 'coast', 'frost', 'reef', 'cosmic', 'title']);

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
  g.gain.value = 0.28;             // sit well under the SFX
  src.connect(g).connect(bus);
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
