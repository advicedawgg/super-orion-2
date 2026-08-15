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
| SPACE (underwater) | **Swim stroke** — tap over and over to rise; there is no limit |
| SPACE (jetpack) | **Hold to fly**, let go to drop. There is no jump in a flight level |
| X | **Spin attack** — kills most things without landing on them |
| C (in the air) | **Ground pound** — straight down, smashes crates |
| P / ESC | Pause · R restart · M music · F fullscreen |

Gamepad and touch are wired up too (Steam Deck, phone, tablet).

## The shape of it

Crash-style: the camera rides a fixed rig behind Orion and the level is a 3D corridor you run *through*,
rather than an open world you get lost in. That was a deliberate choice — it means no camera-collision
jank, a kid never ends up facing a wall, and the later underwater and jetpack levels are just different
camera rigs on the same engine.

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

**Textures** still generate into canvases at boot, so the game has zero *required* asset files. Drop-in
slot: put `assets/tex/<name>.png` in place and add `<name>` to `REAL` in `src/art.js`. Krea 2 is the
intended source.

**SFX stay synthesised on purpose.** A generated wav of a jump blip is worse than four lines of WebAudio
and has to be downloaded.

**Key art** comes from Nano Banana 2 (`google/gemini-3.1-flash-image`) via the openrouter MCP — see
`AGENTS.md` for the two extraction gotchas.

## Status

**Live at [orion2.advicedawg.com](https://orion2.advicedawg.com)**, and fronted by the launcher menu at
[orion.advicedawg.com](https://orion.advicedawg.com).

Playable end to end: **5 levels across 2 worlds, 844 collectable stars**, 4 crate types, 5 enemy types,
moving platforms, checkpoints, lives, spin/ground-pound/double-jump, **swimming and a jetpack**,
generated textures and a full generated soundtrack with real loop points.

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
   five is an educated guess.
2. **Listen to the new tracks.** Four of the five are freshly generated. The vocal-bleed fix is
   reasoned rather than heard — an audio model was tried and failed its control (`AGENTS.local.md`).
3. **A level-select screen.** Game 1 has one; here, reaching Cosmic Cannonball means playing four
   levels first, which is a lot to ask when you want to test the last one.
4. `frost.mp3` masters ~3 dB quieter than the others. Not wrong, just noticeable if you switch levels.
5. Backdrop trees are the mesh budget: Jungle Jog draws ~1470 meshes against ~800 for the others.
   Fine on a desktop GPU, and it is the first thing to instance if the Steam Deck struggles.
