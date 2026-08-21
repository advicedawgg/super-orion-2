# Super Orion 2 — read this first

A Crash-Bandicoot-style 3D platformer in three.js, built for the user's kid Orion.
Live at **https://orion2.advicedawg.com**, fronted by the launcher menu at
**https://orion.advicedawg.com** (that's game 1's repo, which also hosts game 1 itself).

**This repo is public.** Anything naming a machine, a container or a drive letter goes in
`AGENTS.local.md`, which is gitignored — not in here, `AGENTS.md` or `README.md`.

**`AGENTS.md` is the working manual — read it before editing anything.** This file is only
the part you must not miss.

## The gates. Non-negotiable.

```sh
node tools/check.js     # after ANY level change
node src/physics.js     # after ANY tuning change
```

A change is not done until the relevant one prints PASS. Both are plain node — no browser,
no deps. They are not ceremony: between them they have already caught unreachable content,
an enemy standing in mid-air, two platforms overlapping by half a unit and z-fighting, 30
floating trees, a kill plane below the visible world floor, and a jump that re-fired every
frame for the whole coyote window. None of those were visible in the diff.

## Rules that will bite you

- **Never change the physics constants (`T` in `src/physics.js`) to fix a level.** Change the
  level. Every jump the kid has already learned is calibrated to those numbers.
- **No build step.** three.js is vendored in `vendor/` behind an import map; the repo is the
  deployable artifact. Don't add a bundler.
- Levels are `build(B)` functions in `src/levels.js`. `(x,y,z)` on a solid is the centre of
  its **top face**. Write Z anchors out in full — chaining them is how platforms silently
  overlapped and z-fought.
- Anything the game and the checker must agree on lives in exactly ONE exported function
  (`crateSolid`, `trunkSolid`, `killPlane`, `FLOATING`, `FLORA`, `CRATE_STARS`, `TNT_R` in
  `src/builder.js`; `tuning()` in `src/physics.js`). Add to that list rather than duplicating
  a derivation. A checker that models the world separately is a checker that lies.
- A level's `mode` is a patch on `T`, read by both the game and the checker through
  `tuning(def.mode)`. `'moon'` is the cheap kind — it adds no verb, only numbers, so the
  checker judges it by its own arc for free. `'swim'` and `'jet'` are **free modes**: both
  REQUIRE a `ceilY`, and both meter lift with a **tank** that only refills on solid ground,
  which is what stops you swimming or flying over the entire level. The checker proves tank
  range instead of jump arcs there. See AGENTS.md → Movement modes.
- **`B.prop()` has no collider and `keepOrionInSight` cannot ghost it.** Distant scenery
  only — a prop between the camera and Orion blinds you, and no gate will catch it.
- **The camera must never lose sight of Orion.** `keepOrionInSight()` hides whatever is
  between it and him. Do not replace that with a shorter boom — the corridor walls are
  56u wide and pulling in parks the camera inside one. See AGENTS.md.

- The game is **hub-shaped**: `HUB` in `src/levels.js` is a real Builder level with
  `B.portal()` doorways, and levels return you to it. Unlocking is linear (clear one,
  open the next) and cleared levels stay open for backtracking.
- **You cannot leave the hub.** The stone rail is decorative; `B.barrier()` at 9u is
  what stops a double jump. Don't "fix" an escape by raising the visible rail.
- **Crates fall** when unsupported. Support is a footprint overlap, never a centre
  point, or every pyramid collapses on load.

## Running it

```sh
npx http-server -p 8791 -c-1      # -c-1 matters; http-server caches for an hour
```

`file://` will not work — ES modules need an origin. Debug handle: `window.__SO2`.

## What is newest (2026-08-21)

**World 3**, three levels, inserted before the castle so the castle stays the ending:

| # | level | what's new in it |
|---|---|---|
| 7 | **Dust Devil Dunes** | `tnt` crates, the `hardhat` enemy, `heart` crates |
| 8 | **Lunar Leapfrog** | `mode: 'moon'` — low gravity, `iron` crates, the `hopper` |
| 9 | **Skyway Scramble** | movers and springs as the whole idea; `B.cloud()` |

Ten levels now, so **the hub grew a terrace**: Worlds 1–2 on the lawn, World 3 up the steps,
staggered so no placard hides behind another. Read AGENTS.md → The hub before touching it;
both of its camera rules were learned by breaking them.

Also: a **run clock** with best times per level, a **crate combo**, a **star magnet**, camera
**shake**, and backdrop pines are now **instanced** (640 draw calls off Jungle Jog).

**Every level has its own music now.** Five tracks generated the same day; only the hub still
borrows. Two things that round taught, both in AGENTS.md → Assets: the autoregressive cfg is a
GENRE knob and does nothing about singing, and **rewording a caption to remove implied voices**
(a vocal genre, a sustained pad) is what actually stops it — lunar went from singing on all six
seeds to −44.1 dB on the first. A fresh render also masters ~4 LUFS hotter than the rest of the
soundtrack and has to be attenuated to −14 LUFS.

Two real bugs fixed on the way, both worth knowing about:

- `shownLevel()` never returned `HUB`, so `HUB.camOff` and `HUB.sunDir` had never once been
  used — the map was always framed with the last level's camera.
- The checker's `launchV` was hard-coded to the global `T.JUMP_V`, which is only correct for
  a mode that doesn't change the jump. It reads `t.JUMP_V` now.

**Jellyfish bounce.** Land on the bell and you spring off it; the tentacles still sting. See
AGENTS.md → Enemies for the invulnerability window that makes it work.

**Playtest fixes (2026-08-21).** Two bug classes the kid found are now gate failures:
a `B.prop()` within jumping reach (no collider — he landed on the moon lander and fell
through it), and an enemy standing on a checkpoint (unavoidable damage; a prickle was at
the identical coordinate as one, and the same pass found a grumblin that had been sitting
on a Crystal Cavern checkpoint since it was written). `tools/looppoints.js` also scores
the **loudness step** across a seam now — dunes looped out of a crescendo, which neither
the spectral nor the waveform score can see. See AGENTS.md.

The boss is the one thing in the repo the gate cannot fully prove — `tools/check.js` pairs the
king with his gate and proves his arena, but the fight itself needs a browser. See AGENTS.md →
The boss.

## What to work on

See **`README.md` → Next**. What is left is mostly **things a machine cannot check**: whether
the difficulty curve across ten levels suits Orion, whether the moon feels good or floaty and
vague, and whether the five new tracks are any good. They are measured, not heard.

## Generating assets

Textures (Krea 2) and music (MiniMax Music 3) both run locally on one GPU through ComfyUI —
they cannot share it, so run one stack at a time, and neither auto-starts. `tools/gentex.js`,
`tools/genmusic.js`, `tools/looppoints.js`. AGENTS.md documents the traps; several of them
cost a wasted run each, so read that section before generating anything. Paths and launch
commands are in `AGENTS.local.md`.
