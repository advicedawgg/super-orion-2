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

**Music** is generated locally on the 4090 by **MiniMax Music 3**, through the ComfyUI instance on `:8188`:

```sh
node tools/genmusic.js            # every track
node tools/genmusic.js jungle     # just one
```

Start ComfyUI first — it is not auto-started, and it **cannot share the GPU with the Krea2 stack on
`:8189`**. Run one at a time.

```sh
cd /d/ComfyUI_windows_portable
./python_embeded/python.exe -s ComfyUI/main.py --port 8188 --use-sage-attention --disable-auto-launch
```

The non-obvious part: `max_duration` is a **ceiling, not a target**. With an empty `lyrics` field the
model decides the song is over after ~14 seconds. The `[Intro]/[Theme A]/[Bridge]/[Outro]` structure
block in `genmusic.js` is what buys a full-length track — 94s instead of 13s, everything else identical.

**Textures** still generate into canvases at boot, so the game has zero *required* asset files. Drop-in
slot: put `assets/tex/<name>.png` in place and add `<name>` to `REAL` in `src/art.js`. Krea 2 on `:8189`
is the intended source.

**SFX stay synthesised on purpose.** A generated wav of a jump blip is worse than four lines of WebAudio
and has to be downloaded.

**Key art** comes from Nano Banana 2 (`google/gemini-3.1-flash-image`) via the openrouter MCP — see
`AGENTS.md` for the two extraction gotchas.

## Status

**Live at [orion2.advicedawg.com](https://orion2.advicedawg.com)**, and fronted by the launcher menu at
[orion.advicedawg.com](https://orion.advicedawg.com).

Playable end to end: 2 levels, 98 collectable stars, 4 crate types, 3 enemy types, moving platforms,
checkpoints, lives, spin/ground-pound/double-jump, generated textures and a generated soundtrack.

## Next

From playtesting, in rough priority order:

1. **Levels need to be a lot longer.** Orion is good at games and the current two are short. This is
   the main gap — more length and more ideas per level, not just more levels.

   Concretely: Jungle Jog runs z 18 → −187, about **205 units**, which is roughly a minute of play.
   Aim for **3–4× that**, and more importantly a new *idea* every 30–40 units rather than a longer
   corridor of the same thing. The level already shows the pattern to extend — flat tutorial ground,
   then gaps, then crates and the double jump, then hazards and movers, then a run home — so add
   more distinct beats between the checkpoints instead of stretching the existing ones.

   `node tools/check.js` prints each level's solid/star/crate/enemy counts, which is the quickest way
   to see whether a level actually grew or just got longer.
2. **Crates need to differ by more than a tint.** `plain`, `star`, `life` and `spring` currently share
   one texture and only vary `tint` in `CRATE` (src/world.js), so you can't tell the bonus crate from
   the bouncy one at a glance. They want distinct faces — a star stencil, a cat, an arrow/spring —
   and ideally distinct silhouettes.
3. Replace the Crumble Coast track. The loop is clean but the piece is off, and it has faint wordless
   vocals (see the STRUCTURE note in `tools/genmusic.js`).
4. Underwater and jetpack levels — both are new camera rigs on the existing engine, which is why the
   camera was built the way it was.
