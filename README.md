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
| P / ESC | Pause · R restart · M mute · F fullscreen |
| O | **Sound menu** — music and effects sliders, from the title or the pause card |

Grey **iron crates** only open to a ground pound. Red **TNT crates** take everything near
them with them — including whatever was patrolling. And a **jellyfish bell** is a
trampoline; its tentacles are not.

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
| `src/audio.js` | Synthesised SFX; music loads from `assets/audio/` if present. Master bus with a music and an SFX sub-bus behind the sound menu. |
| `src/main.js` | Renderer, camera rig, game loop, HUD. |
| `tools/check.js` | **The gate.** See below. |
| `tools/vocalcheck.py` | Is anyone *singing* on a generated track? Measures it instead of guessing. |
| `tools/roll.py` | Renders a track across several seeds, measures each, keeps the cleanest. |

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

## The boss

**King Dad's Castle** is the finale: 250u of castle, then one room with one problem in it. He takes
**three stomps** (a ground pound counts), the spin bounces off him, and he telegraphs every hop with
a crouch — that crouch is the whole fight, because it is what makes "get out from under him, then
land on him" readable by a seven-year-old. Each hit shortens the gap between hops by a quarter.

The gate behind him crumbles when he goes down, and the goal is behind the gate. Those two are one
mechanism, so `tools/check.js` pairs them: a gate with no king never opens, a king with no gate
guards nothing, and a king whose `arena` circle isn't covered by a single floor can hop into the sea
and take the gate with him. The fight itself is the part the checker can't prove — that one needs a
browser and a kid.

## Funny stuff

Typed words, anywhere in the game, the way game 1 did them:

| Type | What happens |
|---|---|
| `sootie` | +3 lives |
| `shiny` | +10 stars |
| `egg` | +25 stars |
| `love` | hearts refilled |
| `daddy` | a dad joke, with a rimshot |
| `toot` | he is seven |
| `blast` | every fuse in the level, at once |
| `luna` | moon gravity, anywhere (not in the water) |

**The trap has two halves, and both of them shipped.** A cheat's letters are still live game keys:

1. A word spelled entirely from movement letters **fires itself**. The dad joke was `dad` — d-a-d,
   which is just running right, left, right, so it went off every few seconds all game.
2. A word containing **P, R, M or F** pauses, restarts, mutes or goes fullscreen mid-word. The star
   cheat was `star`; the R threw you back to the checkpoint every time you used it. (Game 1 lost
   `mum` the same way — two Ms toggle mute twice.)

`In.cheat()` now throws at boot on either, so a bad word can't ship again. It is why the fart is
spelled `toot`.

King Dad's own material is chores, not menace: he spends the fight telling you to do your homework,
brush your teeth and turn that light off. Keep it that way — the joke is that the final boss is
bedtime.

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

Playable end to end: a **hub island** you pick levels from, **10 levels across 3 worlds, 1,758
collectable stars**, 7 crate types, 8 enemy types including a **boss**, moving platforms,
checkpoints, lives, spin/ground-pound/double-jump, **swimming, a jetpack and low gravity**,
generated textures and a full generated soundtrack with real loop points.

Every level keeps a **best time** as well as a best star count, both shown on its placard on the
map. Smashing crates in quick succession runs a **combo**, which is worth nothing and is the best
part.

Levels unlock in order — clear one to open the next — and everything you have cleared stays open, so
you can go back for a better score. Your best star count per level is saved and shown on its placard.
Running out of lives puts you back on the map rather than ending a run.

| # | Level | World | Length | ⭐ | |
|---|---|---|---|---|---|
| 1 | Jungle Jog | 1 | 662u | 178 | |
| 2 | Crumble Coast | 1 | 604u | 150 | |
| 3 | Frostfizz Peaks | 1 | 623u | 180 | |
| 4 | Crystal Cavern | 2 | 581u | 159 | |
| 5 | Sunken Reef | 2 | 616u | 155 | **swim** |
| 6 | Cosmic Cannonball | 2 | 649u | 181 | **jetpack** |
| 7 | Dust Devil Dunes | 3 | 589u | 230 | TNT · hard hats |
| 8 | Lunar Leapfrog | 3 | 596u | 225 | **low gravity** |
| 9 | Skyway Scramble | 3 | 612u | 214 | movers · springs |
| 10 | King Dad's Castle | 3 | 298u | 86 | **boss** |

That is 5,830 units of level and 1,758 stars, up from 358 units in the first draft.

Every level now has its own music. The five that were borrowing — the cavern, the castle and all
three of World 3 — were generated on 2026-08-21 with MiniMax Music 3; 32 takes were screened with
`tools/vocalcheck.py` and the cleanest kept. Only the hub still borrows (jungle), which is
deliberate: it has never had a theme of its own.

World 3 (2026-08-21) went in **before** the castle rather than after it, because the castle is the
ending. Star counts jump in World 3 for one reason: `iron` crates are worth 3 and a `tnt` pays out
whatever it takes with it, so a level with fuses in it is worth more than its star trails suggest.

Three levels now borrow another level's track — the cavern and the moon take `cosmic.mp3`, the
dunes take `coast.mp3` and the sky level takes `frost.mp3`. That is the single biggest thing left
to fix, and it needs the GPU.

## Level design, in numbers

The three constants every level is spaced against, per mode, straight out of `tools/check.js`:

| mode | single jump | double jump |
|---|---|---|
| running | 5.8u flat / 2.39u up | 9.2u flat / 4.08u up |
| moon | 8.8u flat / 3.00u up | 13.9u flat / 5.12u up |

Story gaps sit at 3.0–4.5u on land and 5–7u on the moon, which is roughly half the arc either way.
The longest single gap in the game is 11u, on the moon, in Lunar Leapfrog — 79% of a double jump,
and safe precisely because of where you are standing.

## Next

The playtest list that drove the last round is done: levels are 3–4× longer with a new idea every
30–40 units, crates carry a stencil and a topper rather than a tint, the Crumble Coast track is
re-rolled, and underwater + jetpack shipped as `mode` patches on the tuning (see AGENTS.md).

What is worth doing next, in rough priority order:

1. **Get Orion to play World 3 and watch where he stops.** Three levels of new geometry that have
   only ever been proven by the checker and a scripted flythrough. Two questions in particular a
   machine cannot answer: does the moon feel *good*, or just floaty and imprecise — and is the
   hard hat readable as "don't jump on this one" the first time he meets it, or is it three lost
   hearts before the penny drops?
2. **Listen to the five new tracks, and to the loop seams.** They are measured, not heard: every
   one scores between −14.7 and −44.1 dB of vocal bleed, and their loop points come from
   `tools/looppoints.js`, but whether any of them is any GOOD is a question no tool answers.
   `node tools/looppoints.js --preview <name>` renders exactly what the game plays, seams and all.
   The dunes seam has the weakest waveform correlation of the five (0.18) and is the first one to
   check.
3. **A theme for the hub.** It is the last thing still borrowing (jungle), and it is the screen
   you see between every level.
4. **Textures for the two new surfaces.** `sandstone` and `regolith` are procedural, and regolith
   in particular took two passes to stop reading as camouflage netting. Krea 2 would do better.
5. **Mesh budget, again.** Dust Devil Dunes draws ~1200 against ~900 for the rest — cacti, even
   after they were halved. The backdrop pines are instanced now; cacti are the obvious next batch
   if the Steam Deck ever struggles.
