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
  (`crateSolid`, `trunkSolid`, `killPlane`, `FLOATING` in `src/builder.js`; `tuning()` in
  `src/physics.js`). Add to that list rather than duplicating a derivation. A checker that
  models the world separately is a checker that lies.
- A level's `mode` (`'swim'` / `'jet'`) is a patch on `T`, read by both the game and the
  checker through `tuning(def.mode)`. Both are **free modes** — vertical travel is unbounded,
  so they REQUIRE a `ceilY`, and the checker deliberately stops proving reachability there.
  See AGENTS.md → Movement modes.

## Running it

```sh
npx http-server -p 8791 -c-1      # -c-1 matters; http-server caches for an hour
```

`file://` will not work — ES modules need an origin. Debug handle: `window.__SO2`.

## What to work on

See **`README.md` → Next**. The previous playtest list is done: 5 levels totalling 3,154u
(was 2 levels and 358u), crates carry a stencil and a topper, the coast track is re-rolled,
and swim + jetpack shipped as `mode` patches on the tuning.

What is left is mostly **things a machine cannot check**: whether the difficulty curve
actually suits Orion, and whether the four new music tracks sound right. Both need a human.

## Generating assets

Textures (Krea 2) and music (MiniMax Music 3) both run locally on one GPU through ComfyUI —
they cannot share it, so run one stack at a time, and neither auto-starts. `tools/gentex.js`,
`tools/genmusic.js`, `tools/looppoints.js`. AGENTS.md documents the traps; several of them
cost a wasted run each, so read that section before generating anything. Paths and launch
commands are in `AGENTS.local.md`.
