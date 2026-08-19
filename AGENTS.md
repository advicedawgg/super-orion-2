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
| `swim` | every press is another stroke | low gravity, sinks at 6.5u/s |
| `jet` | HOLD to thrust, climb capped at 14u/s | no jump at all |

Both metered modes carry a **tank** — a 0..1 gauge that only refills with your feet on solid ground
(`tankStep`). Swimming spends 0.125 a stroke (8 strokes a lungful); the jetpack burns 0.25 a second
(4 seconds of thrust). Without it, lift is free and a level of platforms you never have to land on is
not a level: you swim or fly over the whole thing, which is exactly what the first playtest said.

The tank is deliberately generous. It exists to make a platform worth landing on, not to turn
traversal into resource management, and both shipped levels cleared the new checker pass unchanged.

Both new modes are **free modes**: vertical travel is unbounded. Two consequences you
cannot design around:

- `ceilY` is **required** — the water surface, or the sky. It caps the player's feet.
  Without it the level stops being a corridor, because there is nothing above you.
- The checker does not prove reachability from a **jump arc** in a free mode — that
  question isn't being asked when you can swim straight up. It proves **tank range**
  instead: can you get from the start to the goal one tankful at a time, refuelling
  only on solids. That is a real gate and it will fail a level with a long stretch of
  nothing to land on.
- A ceiling is still your job. `ceilY` alone is not enough when the roof is 26 and the
  content tops out at 12 — you just ride the ceiling over the lot. Both free levels now
  hang local roofs over their loosest beats for exactly that reason.

Ground pound is disabled in free modes on purpose: `stomping` suppresses both the
stroke and the thruster until you land, so over water or a void it would take away
every means of lift you have.

Floating enemies (`flapjack`, `jelly`, `zapdrone`) are listed in `FLOATING` in
`src/builder.js` — the pure module, so the checker can tell "hovers by design" from
"placed in mid-air by mistake". Add new hovering kinds there as well as to `ENEMY`.

Their size and default patrol live in `BODY`, also in `src/builder.js`, and `ENEMY` in
`world.js` spreads them in. The checker needs those numbers to **sweep the patrol path
through the level**: an enemy's placed position can be perfectly legal while half its
circuit is inside a rock. That check found twelve on its first run, across all five
levels, including a flapjack that had been flying through a ledge since it was written.
Placement is not the same question as path.

## The camera never loses sight of Orion

The rig is fixed per level, so occlusion is guaranteed rather than possible — the back of the
lighthouse, a tunnel roof, and every full-corridor gate in the flight level. `keepOrionInSight()`
in `main.js` ghosts any solid strictly between the camera and Orion.

Do NOT "fix" this by shortening the boom. That was tried: the corridor walls are 56u wide and 4u
thick, so pulling in until the line is clear puts the camera inside the wall, or a foot from Orion's
back. Ghosting the occluder keeps the full boom and never hides what he is flying toward, because
what is ahead of him is not on the segment.

Consequence worth knowing: the occluder is ghosted, not hidden. It stays
`visible`, and its per-mesh material clone is written with `colorWrite`/`depthWrite = false` —
invisible to the camera, and writing no depth either, so it cannot occlude anything behind it.
The shadow-map pass, though, gates on object/material `visible` + `castShadow`, NOT on
`colorWrite`/`depthWrite`, so the slab keeps casting its shadow and there is no pop. The cost:
the slab's fragments still run and write nothing, and each solid carries one cloned Lambert
material instead of the shared cache instance.

## The hub

`HUB` in `src/levels.js` is the map you stand on between levels — authored with the same
Builder, checked by the same gate (`def.hub` only turns off "must have a goal" and the
jump-arc flood fill). `B.portal(x, y, z, level)` is a doorway; walking into it plays that
level. It borrows jungle's music via `music: 'jungle'`, which overrides the usual
"track is named after the level" rule; give it its own theme when there is one.

**Progression is linear.** `unlocked(i)` in `main.js` is `i === 0 || cleared(i - 1)`: the
first level is always open, clearing one opens the next, and everything already cleared
stays open so you can go back and beat your score. A locked ring is dark and still, its
placard says LOCKED, and walking into it bonks and names the level you owe. That check is
edge-triggered on `G.atPortal` — standing in a locked ring must complain once, not once a
frame.

A level ends by returning you to the map, best stars per level are saved under `lv` in the
save file, and running out of lives is not a game over any more — it drops you back on the
map with your bests intact. `G.inHub` is what tells the HUD, the pause card and ↓ which
world they are in.

**You cannot leave the island.** The visible stone rail is 2.6u and decorative; a double
jump clears 4.08u, and off the 2.2u outcrops that is 6.3u. The thing that actually holds
you in is `B.barrier()` at 9u — a collider with no mesh, using the same `scenery` flag tree
trunks already use, so world.js skips drawing it and check.js skips treating it as a
platform. Raising the *visible* rail that high would wall the sea out instead.

## Crates fall

A crate with nothing under it drops until something catches it (`settleCrates` in
`world.js`). Smash the bottom of a stack and the rest comes down, which is the entire point
of a stack; before this they hung in mid-air.

Support is a footprint OVERLAP test, not a centre-point test. A pyramid's upper crates
straddle the gap between the two below them, so a centre test says "nothing under me" and
drops the whole pyramid the moment the level loads. Only crates flagged `settling` are
tested and they stop being restless once they land, so the usual cost is nothing.

`check.js` now fails a crate authored over thin air, because "floating crate" has stopped
being a visible mistake and become a crate that silently relocates on load.

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
- `roof()` is a `wall()` that casts no shadow. Use it for every ceiling. A slab hanging
  over the play space is lit from above, so it drops the whole room into shadow — the
  first pass at enclosing the flight level made it almost unplayably dark, and the level
  you enclosed to stop the player flying over it became a level nobody could see.
- Surfaces come from `SURFACE` in `world.js`. `deck` (tread plate) and `panel` (riveted
  plating) are the flight level's set. Keep floors light and structure dark: which
  surfaces you can LAND on has to be readable at a glance, which is the actual job the
  ice pads were doing before they were an ice rink in a space station.
- Trees are **solid by default** (you can't walk through a trunk you're standing beside).
  Backdrop trees must pass `solid = false`, or a falling player lands on one instead of dying.
- **Flora has kinds.** `B.tree(x,y,z,s,solid,kind)` where kind ∈ `FLORA` (`src/builder.js`):
  `pine`, `kelp`, `coral`, `fan`, `crystal`. Only a pine has a trunk you can bump into —
  `trunkSolid` models a tree — so the checker fails any other kind marked solid, and
  `B.weed(x,y,z,s,kind)` is the shorthand that can't get that wrong. Use the right one for
  the place: the reef was planted with conifers for five playtests because `B.tree` was the
  only call there was, and nobody walks to the edge of the one level it showed in.
  `world.js` draws each kind (`addKelp` / `addCoral` / `addFan` / `addCrystal`); the sway is
  nested groups plus one sine per joint, and anything pushed to `this.flora` gets ticked.
- **Lava ground draws unlit.** `ground(y, 'lava')` gets a MeshBasicMaterial at full
  brightness — it is the light source, not a lit surface. Shaded like rock in a cave lit by
  one dim sun it came out mud brown, and mud does not read as "do not land here".

## Sound

`src/audio.js` runs a master bus (`bus`, which is also the mute switch) with a **music** and an
**SFX** sub-bus under it. `MIX` is the ceiling each slider scales; the defaults reproduce the mix
the game shipped with, so an existing player hears no change until they move something. Positions
live in their own localStorage key (`superOrion2Sound`) — not the game save, because clearing
your stars must not reset the volume.

The menu is the `OPTIONS` state in `src/main.js`: **O** from the title or the pause card, arrows
or the d-pad to set, drag the bar on a touchscreen, O again to go back. It brings the audio
context up and puts a track on, because a volume slider you cannot hear is a slider you cannot
set. Note `tone()`/`noise()` take a `vol` ARGUMENT — the module-level object is `VOL` in capitals
for exactly that reason.

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
exactly like a good one on disk. Also match the level: a fresh render can master 4 dB hotter
than the rest of the soundtrack, which is jarring when the level changes.

### "No vocals" is not a request the model honours

It is the single most expensive failure here — frost was re-rolled **three times** across two
days and sang every time, because the fix being attempted was always "word the caption more
firmly". Captions do not work. What does:

1. **A real negative prompt.** The graph used to feed `ConditioningZeroOut` as the negative, so
   CFG was steering away from *nothing*. `NEGATIVE` in `genmusic.js` now describes a song with a
   lead singer, positively, which is how CFG reads a negative.
2. **A higher `cfg`** so that negative actually bites (frost ships at 2.6, not 1.7).
3. **Rolling several seeds and MEASURING.** The seed dominates everything else. On identical
   settings, one seed scored +0.5 dB of vocals and another -48.7 dB.

`SEED=1234 CFG=2.6 node tools/genmusic.js frost` overrides both for one run, for exactly this.
Pin the winner back into `TRACKS` — a track you cannot reproduce is a track you cannot fix.

### Checking for vocals IS automatable — with the right tool

```sh
python tools/vocalcheck.py            # every track; prints PASS/FAIL
```

It separates a vocals stem from an instrumental stem and reports the ratio. Every track that
shipped scores -10 dB or lower; the take that sang scored **+2.3 dB**. That is not a close call,
and it passes the control the earlier attempt failed.

The earlier attempt failed because it asked an *audio LLM* "does this have vocals" — fed the
known-singing coast take as a control, it said no. That experiment is written up in
`AGENTS.local.md` and its conclusion, "get a person to listen", was too broad: source separation
answers this question reliably. **A human is still the only judge of whether a track is any
good** — that part stands.

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

**Judging whether a track is GOOD is a human job.** Whether it has a singer on it is not —
`tools/vocalcheck.py` answers that, see above. Get a person to listen for the rest.

The house style is set by the Steam Deck grid art for game 1: cosmic indigo, gold stars,
Orion in a white helmet with an orange stripe, blue overalls with a white chest star,
red gloves and boots. Match it.
