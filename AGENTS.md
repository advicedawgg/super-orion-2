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

None of those were visible by reading the diff.

## Why the checker is trustworthy

`tools/check.js` imports **the real builder** (`src/builder.js`) and **the real tuning**
(`src/physics.js`). It does not reimplement them. If you add a builder verb, the checker
sees it for free.

Anything both the game and the checker need to agree on lives in exactly one exported
function — `crateSolid`, `trunkSolid`, `killPlane`. Add to that list rather than
duplicating a derivation. A checker that models the world separately is a checker that lies.

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

**Everything generative here runs on the local 4090 and the two stacks cannot share it.**
MiniMax Music 3 lives in the ComfyUI on `:8188`; Krea 2 is the separate stack on `:8189`
(`D:\krea2-adapter\start_krea2_stack.bat`). Start one, use it, stop it, start the other.

```sh
cd /d/ComfyUI_windows_portable
./python_embeded/python.exe -s ComfyUI/main.py --port 8188 --use-sage-attention --disable-auto-launch
```

Music gotchas, both learned the hard way:

1. **`max_duration` is a ceiling, not a target.** With an empty `lyrics` field the model calls
   the song finished after ~14 seconds no matter what you ask for. The `[Intro]/[Theme A]/
   [Bridge]/[Outro]` structure block in `genmusic.js` is the thing that buys a full-length
   track — 94s vs 13s, everything else identical. Don't remove it to "simplify".
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

1. Output lands **inside the `mcp-openrouter` container** on Unraid. Get it out with
   `ssh unraid 'docker cp mcp-openrouter:/<file> /mnt/user/appdata/<file>'`.
2. For a transparent logo, generate on flat `#00FF00` and key it on the workspace hub
   (the only box here with ImageMagick):
   `convert in.png -alpha set -fuzz 32% -transparent "#00FF00" -channel A -morphology Erode Diamond:1 +channel -trim +repage out.png`
   The erode is not optional — without it you ship a green halo.

The house style is set by the Steam Deck grid art for game 1: cosmic indigo, gold stars,
Orion in a white helmet with an orange stripe, blue overalls with a white chest star,
red gloves and boots. Match it.
