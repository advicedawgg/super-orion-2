# Working on Super Orion 2

Read this before touching anything. It is short on purpose.

## The two gates

```sh
node tools/check.js     # every level change
node src/physics.js     # every tuning change
```

**A change is not done until the relevant gate prints PASS.** Both run in plain node,
no browser, no deps. Between them they have already caught, on real edits:

- content placed where the player physically cannot reach it
- an enemy standing in mid-air
- two platforms overlapping by half a unit and z-fighting
- decorative trees floating with nothing under them
- a kill plane set *below* the visible world floor, so the player sank through the scenery
- a jump that re-fired every frame for the whole coyote window, stuttering the SFX and
  silently spending the double jump
- a star trail running straight through a crate row, in **both** shipped levels — invisible
  pickups that the reachability pass can't see, because the crate they are inside is itself
  perfectly reachable

None of those were visible by reading the diff.

`check.js` also prints each level's **length in world units**. That number is the point of
the whole "levels are too short" note — star counts don't answer it.

## Why the checker is trustworthy

`tools/check.js` imports **the real builder** (`src/builder.js`) and **the real tuning**
(`src/physics.js`). It does not reimplement them. If you add a builder verb, the checker
sees it for free.

Anything both the game and the checker need to agree on lives in exactly one exported
function — `crateSolid`, `trunkSolid`, `killPlane`. Add to that list rather than
duplicating a derivation. A checker that models the world separately is a checker that lies.

## Movement modes

A level can set `mode: 'swim'` or `mode: 'jet'`. A mode is **nothing but a patch on `T`**
(`MODES` in `src/physics.js`), and both the game and the checker read it through
`tuning(def.mode)` — so a mode cannot mean one thing to the player and another to
the gate.

| mode | lift | feel |
|---|---|---|
| *(none)* | jump, then double jump | the running game |
| `swim` | every press is another stroke, no limit | low gravity, sinks at 6.5u/s |
| `jet` | HOLD to thrust, climb capped at 14u/s | no jump at all |

Both new modes are **free modes**: vertical travel is unbounded. Two consequences you
cannot design around:

- `ceilY` is **required** — the water surface, or the sky. It caps the player's feet.
  Without it the level stops being a corridor, because there is nothing above you.
- The checker **does not prove reachability** in a free mode. A jump-arc flood fill
  answers a question that isn't being asked when you can swim straight up. Geometry,
  the ceiling and buried content are still enforced; the *layout* is on you.

Ground pound is disabled in free modes on purpose: `stomping` suppresses both the
stroke and the thruster until you land, so over water or a void it would take away
every means of lift you have.

Floating enemies (`flapjack`, `jelly`, `zapdrone`) are listed in `FLOATING` in
`src/builder.js` — the pure module, so the checker can tell "hovers by design" from
"placed in mid-air by mistake". Add new hovering kinds there as well as to `ENEMY`.

## Level authoring

Levels are `build(B)` functions in `src/levels.js` run against the Builder.

- `(x, y, z)` on a solid is the centre of its **top face**. It hangs `h` downward.
  You place platforms by where you land on them, which is how you actually think.
- **Write Z anchors out in full.** Chaining (`cz - 38`) is exactly how two platforms
  ended up overlapping by half a unit. The checker catches it now, but don't make it work.
- Budget from the physics, not from taste:
  - flat gap ≤ **5.8u** single / **9.2u** double → keep story gaps at **3.0–4.5**
  - step rise ≤ **2.39u** single, **4.08u** double
  - the checker warns above 85% of the theoretical arc; that's the line between
    satisfying and a seven-year-old giving up
- `ground()` is the world floor far below — **not solid**, so pits still kill. It's what
  stops the level reading as platforms in a void. `killPlane` derives from it.
- Trees are **solid by default** (you can't walk through a trunk you're standing beside).
  Backdrop trees must pass `solid = false`, or a falling player lands on one instead of dying.

## Never do this

- **Do not change the physics constants to fix a level.** Change the level. `T` in
  `src/physics.js` is what every jump the kid has already learned is calibrated to.
- Don't add a build step. three.js is vendored in `vendor/`, wired by an import map.
  The repo is the deployable artifact.
- Don't put a level's collision shape anywhere but `solids` — the checker only sees that.

## Running it

```sh
npx http-server -p 8791 -c-1      # -c-1 matters; http-server caches for an hour
```

`file://` will not work — ES modules need an origin. Debug handle is `window.__SO2`
(`{ G, world, player, cam, scene, LEVELS, THREE }`).

Playwright can drive it: dispatch `new KeyboardEvent('keydown', {code:'Space'})` to start,
then `__SO2.player.reset(new __SO2.THREE.Vector3(x, y, z))` to teleport for a screenshot.

## Assets

Textures generate into canvases at boot, so the game has zero *required* asset files.
SFX stay synthesised — a generated wav of a jump blip is worse than four lines of WebAudio
and has to be downloaded.

| Want | Do |
|---|---|
| Level music | `node tools/genmusic.js <id>` → writes `assets/audio/<id>.mp3`; add the id to `TRACKS` in `src/audio.js` |
| Real texture | drop `assets/tex/<name>.png`, add `<name>` to `REAL` in `src/art.js` |

**Everything generative here runs on one local GPU, and the two stacks cannot share it.**
MiniMax Music 3 lives in a ComfyUI instance; Krea 2 is a separate stack on its own port.
Start one, use it, stop it, start the other. Neither auto-starts.

> Paths, ports and the exact launch command are in **`AGENTS.local.md`**, which is
> gitignored — this repo is public and those notes describe a private setup.

Music gotchas, learned the hard way:

1. **`max_duration` is a ceiling, not a target,** and the `lyrics` field is what decides
   whether you get near it. With a genuinely empty `lyrics` the model calls the song
   finished after ~14 seconds no matter what you ask for.

   It is the section **tags** that buy the length — the **bodies** do nothing but get sung.
   Measured with a controlled A/B (same seed, same caption, only the bodies differing):

   | `lyrics` | result |
   |---|---|
   | `[Intro]` + `(instrumental)` | 66.0s, and audible wordless vocals |
   | `[Intro]` + nothing | 100.0s, the full ceiling |

   So `genmusic.js` now sends tags with empty bodies by default. `WORDED` is kept, and
   pinned on the tracks that shipped with it, because re-rolling music a kid already knows
   is a real cost rather than a free consistency win.
2. Use `SaveAudioMP3`, not `SaveAudioAdvanced` — the latter's `format` is a
   `COMFY_DYNAMICCOMBO_V3` with `quality` nested inside it, which the flat API prompt
   format cannot express (`Required input is missing: format.quality`).

3. **The GPU is shared with the browser.** MiniMax Music needs ~13.4 GB. If the game is open
   in Chrome, VRAM hits ~22 of 23 GB and ComfyUI thrashes weights across PCIe — a job that
   takes 2.5 minutes idle will sit at "running" for half an hour with no sampler progress.
   Check `nvidia-smi` before assuming a hang.

Always check a generated track before shipping it — `ffprobe` for duration (it lies short),
then `ffmpeg -af volumedetect` and `-af silencedetect`. A 13-second or silent track looks
exactly like a good one on disk.

### Loop points

`<audio loop>` can only restart from zero, which sounds like the CD skipped. Real game music
is intro-then-loop, so tracks go through WebAudio with native `loopStart`/`loopEnd`:

```sh
node tools/looppoints.js --preview          # analyses every mp3, writes src/music.js
node tools/looppoints.js --preview --top jungle
node tools/looppoints.js --hint=21,91 jungle    # you picked the bars; it makes them exact
```

Three things have to be right or you hear the seam, and all three bit on the first attempt:

- **Tempo, chosen on its own evidence.** This took three attempts and each failure is
  instructive. (a) Raw onset autocorrelation locked onto 99.4 BPM for a 136 BPM track — 4/3
  of the real beat — so every "bar boundary" was off-grid. (b) Letting the *loop score* pick
  among candidate tempos is backwards: it's a timbre-repeat detector, so it chose 172 BPM for
  a 124 BPM beach track because that grid exposed a tight timbre repeat. (c) An onset-comb
  score over octave candidates drifts to **half** tempo, because a sparser grid only has to
  hit the strongest downbeats to score well.
  The fix: **we asked the model for a BPM, so search ±10% of it and nothing else** — no
  half, no double. The model honours tempo requests closely (132 asked → 136 rendered,
  124 → 123, 120 → 112). Octave freedom buys nothing and costs correctness.
- **The downbeat, not the beat.** A loop starting on beat 3 is on the grid and still feels
  wrong. All four beat-phases in the bar get tried.
- **Sample-level phase.** Frame resolution is ~23 ms, audible as a flam. `loopEnd` slides up
  to a third of a beat against `loopStart` on waveform cross-correlation.

The comparison window looks **both ways**. A forward-only window silently disqualifies every
loop end within two bars of the track end — which is exactly where the best loop point tends
to be, because you want to use the whole track.

The spectral score answers "do these two moments sound alike", which is *not* the same
question as "does this phrase resolve into that one". It reliably finds a track's shortest
repeat period. **When a human picks bars by ear, believe them** and use `--hint` to snap their
choice to the downbeat grid and sample-align it.

Verify with `--preview`, which renders exactly what the game plays. An earlier hand-rolled
test file repeated a seam segment three times and introduced a discontinuity the game would
never produce — the reviewer heard it and rightly called the loop broken.

Key art is made with **Nano Banana 2** (`google/gemini-3.1-flash-image`) through the
openrouter MCP. Two gotchas, both learned the hard way:

1. The generated file is **not written anywhere you can reach directly** — it lands inside
   the MCP's own container and has to be copied out.
2. For a transparent logo, generate on flat `#00FF00` and key it out with ImageMagick,
   eroding the alpha by one pixel afterwards. The erode is not optional — without it you
   ship a visible green halo — and the key must be a global `-transparent` rather than a
   corner floodfill, or letter counters stay green.

> The exact commands, container name and which box has ImageMagick are in
> **`AGENTS.local.md`** (gitignored).

**Judging a track by ear is a human job.** An audio model was tried for "does this have
vocals" and failed its control — see `AGENTS.local.md`. Get a person to listen.

The house style is set by the Steam Deck grid art for game 1: cosmic indigo, gold stars,
Orion in a white helmet with an orange stripe, blue overalls with a white chest star,
red gloves and boots. Match it.
