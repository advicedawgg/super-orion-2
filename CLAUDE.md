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
  checker through `tuning(def.mode)`. Both REQUIRE a `ceilY`, and both meter lift with a
  **tank** that only refills on solid ground — that is what stops you swimming or flying
  over the entire level. The checker proves tank range instead of jump arcs there.
  See AGENTS.md → Movement modes.
- **The camera must never lose sight of Orion.** `keepOrionInSight()` hides whatever is
  between it and him. Do not replace that with a shorter boom — the corridor walls are
  56u wide and pulling in parks the camera inside one. See AGENTS.md.

## Running it

```sh
npx http-server -p 8791 -c-1      # -c-1 matters; http-server caches for an hour
```

`file://` will not work — ES modules need an origin. Debug handle: `window.__SO2`.

## What to work on

See **`README.md` → Next**. The 2026-08-16 playtest round is done: the spin has an audible
sound, the flapjack is an actual bat rather than two spinning billboards, the camera cuts
away anything blocking Orion, the reef is a scuba dive with bubbles, both free modes meter
lift with a tank, and twelve enemies that patrolled through solid rock were found by a new
checker pass and fixed.

What is left is mostly **things a machine cannot check**: whether the difficulty curve suits
Orion, whether the tank makes the reef and the flight level better or just annoying, and
whether the re-rolled `frost.mp3` (seed 2077) still sings. All need a human.

## Generating assets

Textures (Krea 2) and music (MiniMax Music 3) both run locally on one GPU through ComfyUI —
they cannot share it, so run one stack at a time, and neither auto-starts. `tools/gentex.js`,
`tools/genmusic.js`, `tools/looppoints.js`. AGENTS.md documents the traps; several of them
cost a wasted run each, so read that section before generating anything. Paths and launch
commands are in `AGENTS.local.md`.
