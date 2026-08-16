# Super Orion 2 — Cosmic Cannonball 🚀

The 3D sequel to [Super Orion](../Oriongame) — a Crash-Bandicoot-style platformer in three.js, built for Orion.

## Run it

```sh
npx http-server -p 8791 -c-1        # -c-1 matters: http-server caches for an hour by default
```

Then open <http://127.0.0.1:8791>. **It will not work from `file://`** — ES modules need a real origin.
That's the one thing game 1 could do that this can't.

There is **no build step**. three.js is vendored in `vendor/` and wired up with an import map, so the
repo is the deployable artifact. Deploy with `npx wrangler deploy`.

## Controls

| Key | Action |
|---|---|
| ← → ↑ ↓ / WASD | Move (camera-relative) |
| SPACE | Jump — press again in the air for a **double jump** |
| SPACE (underwater) | **Swim stroke** — tap to rise. A lungful is 8 strokes; touch the bottom to refill |
| SPACE (jetpack) | **Hold to fly**, let go to drop. 4s of fuel, refilled by landing. No jump at all |
| X | **Spin attack** — kills most things without landing on them |
| C (in the air) | **Ground pound** — straight down, smashes crates |
| P / ESC | Pause · R restart · M music · F fullscreen |

Gamepad and touch are wired up too (Steam Deck, phone, tablet).

## The shape of it

Crash-style: the camera rides a fixed rig behind Orion and the level is a 3D corridor you run *through*,
rather than an open world you get lost in. That was a deliberate choice — a kid never ends up facing a
wall, and the later underwater and jetpack levels are just different camera rigs on the same engine.

A fixed rig has one failure mode, and it is not camera collision: it is **occlusion**. Walk round the
back of the lighthouse, fly past a gate that spans the whole corridor, and the thing you are steering is
behind a wall. Shortening the boom is the usual fix and it is the wrong one here — these walls are 56u
wide, so pulling in parks the camera *inside* one. Instead, anything strictly between the camera and
Orion simply stops being drawn. It only ever hides what he is already level with or past, never what he
is flying toward, and it is one slab test per solid per frame.

Art direction is "N64 shapes, 2026 lighting": chunky low-poly silhouettes and texture atlases like an
N64 character, but crisp filtering, soft shadows and real fog.

## Files

| File | What |
|---|---|
| `src/physics.js` | Tuning constants + AABB collision. **Pure** — no THREE, no DOM. `node src/physics.js` self-checks it. |
| `src/builder.js` | The level-authoring API. Also pure, so the checker runs the *real* builder. |
| `src/levels.js` | Level data. |
| `src/world.js` | Builder data → meshes; stars, crates, enemies, movers, goal. |
| `src/player.js` | Orion's model (~30 boxes, one atlas) + movement state machine. |
| `src/art.js` | Procedural textures, with a slot for generated PNGs (see below). |
| `src/audio.js` | Synthesised SFX; music loads from `assets/audio/` if present. |
| `src/main.js` | Renderer, camera rig, game loop, HUD. |
| `tools/check.js` | **The gate.** See below. |
| `tools/vocalcheck.py` | Is anyone *singing* on a generated track? Measures it instead of guessing. |

## The gate

```sh
node tools/check.js        # must print PASS before any level change is done
node src/physics.js        # must print PASS before any tuning change is done
```

`tools/check.js` imports the real builder and the real physics constants, derives the jump arc from
`JUMP_V`/`GRAV`/`SPEED`, then flood-fills the platform graph from the start point and fails if the goal,
a checkpoint, a crate or a star can't actually be reached. It caught two unreachable-content bugs and one
mid-air enemy on the very first run. Eyeballing level geometry does not work; this does.

It also warns when the level's hardest *required* jump eats more than 85% of the theoretical arc — that's
the line between "satisfying" and "a seven-year-old gives up".

Two more passes it runs:

- **Tank range** (swim/jet only). Height is free in those modes, so the flood fill used to give up on
  them entirely. It can't now: the tank only refills on solid ground, so the checker proves you can
  cross the level one tankful at a time and fails if the goal or a checkpoint is beyond refuelling range.
- **Swept patrols.** An enemy's *placed* position can be perfectly legal while half its circuit is
  inside a rock — the diff looks fine and the screen does not. This sweeps the patrol volume through
  the level and fails anything penetrating more than 0.4u. It found twelve on the first run, in all
  five levels.

**Never change the physics constants to fix a level.** Change the level.

## Assets

**Music** is generated locally by **MiniMax Music 3** through ComfyUI:

```sh
node tools/genmusic.js            # every track
node tools/genmusic.js jungle     # just one
```

Start ComfyUI first — it is not auto-started, and it **cannot share the GPU with the Krea 2 texture
stack**. Run one at a time. (Local paths and the launch command live in `AGENTS.local.md`, which is
gitignored — this repo is public.)

The non-obvious part: `max_duration` is a **ceiling, not a target**, and the `lyrics` field decides
whether you get near it. Empty lyrics → the model stops after ~14 seconds. Section *tags* buy the
length; section *bodies* buy nothing and sometimes get sung. Same seed and caption, bodies the only
difference: `(instrumental)` bodies gave 66s with audible wordless vocals, empty bodies gave the full
100s. `genmusic.js` therefore sends empty bodies by default.

The other non-obvious part: **asking for "no vocals" in the caption does not work.** Frostfizz Peaks
was re-rolled three times with progressively firmer wording and sang every time. What fixed it was a
real negative prompt (the graph had been feeding an empty one), a higher `cfg` so it bites, and
rolling seeds until one measured clean:

```sh
python tools/vocalcheck.py                      # separates a vocals stem; PASS/FAIL per track
SEED=4410 CFG=2.6 node tools/genmusic.js frost  # override for one screening run
```

Every track that shipped scores −10 dB of vocals or lower; the take that sang scored **+2.3 dB**.
An audio LLM could not answer this question — it failed its control — but source separation does.

**Textures** still generate into canvases at boot, so the game has zero *required* asset files. Drop-in
slot: put `assets/tex/<name>.png` in place and add `<name>` to `REAL` in `src/art.js`. Krea 2 is the
intended source. The flight level's `deck` and `panel` and both Orion atlases are procedural — they
tile by construction, which a generated image does not.

**SFX stay synthesised on purpose.** A generated wav of a jump blip is worse than four lines of WebAudio
and has to be downloaded.

**Key art** comes from Nano Banana 2 (`google/gemini-3.1-flash-image`) via the openrouter MCP — see
`AGENTS.md` for the two extraction gotchas.

## Status

**Live at [orion2.advicedawg.com](https://orion2.advicedawg.com)**, and fronted by the launcher menu at
[orion.advicedawg.com](https://orion.advicedawg.com).

Playable end to end: a **hub island** you pick levels from, **5 levels across 2 worlds, 844 collectable
stars**, 4 crate types, 5 enemy types, moving platforms, checkpoints, lives,
spin/ground-pound/double-jump, **swimming and a jetpack**, generated textures and a full generated
soundtrack with real loop points.

Levels unlock in order — clear one to open the next — and everything you have cleared stays open, so
you can go back for a better score. Your best star count per level is saved and shown on its placard.
Running out of lives puts you back on the map rather than ending a run.

| # | Level | Length | ⭐ | |
|---|---|---|---|---|
| 1 | Jungle Jog | 662u | 178 | |
| 2 | Crumble Coast | 604u | 150 | |
| 3 | Frostfizz Peaks | 623u | 180 | |
| 4 | Sunken Reef | 616u | 155 | **swim** |
| 5 | Cosmic Cannonball | 649u | 181 | **jetpack** |

That is 3,154 units of level, up from 358.

## Next

The playtest list that drove the last round is done: levels are 3–4× longer with a new idea every
30–40 units, crates carry a stencil and a topper rather than a tint, the Crumble Coast track is
re-rolled, and underwater + jetpack shipped as `mode` patches on the tuning (see AGENTS.md).

What is worth doing next, in rough priority order:

1. **Get Orion to play it and watch where he stops.** Five levels is a lot of new geometry that has
   only ever been proven by the checker and a scripted flythrough. The difficulty curve across the
   five is an educated guess — and the air/fuel tank is brand new, so the reef and the flight level
   need a real run more than anything else here.
2. **Listen to the new tracks.** Four of the five are freshly generated. The vocal-bleed fix is
   reasoned rather than heard — an audio model was tried and failed its control (`AGENTS.local.md`).
   `frost.mp3` was re-rolled on 2026-08-16 (seed 4410, cfg 2.6) after three takes that sang; it now
   measures cleaner than any other track in the game, but nobody has heard the new one yet.
5. Backdrop trees are the mesh budget: Jungle Jog draws ~1470 meshes against ~800 for the others.
   Fine on a desktop GPU, and it is the first thing to instance if the Steam Deck struggles.
