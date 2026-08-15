# Super Orion 2 — read this first

A Crash-Bandicoot-style 3D platformer in three.js, built for the user's kid Orion.
Live at **https://orion2.advicedawg.com**, fronted by the launcher at
**https://orion.advicedawg.com** (that's `D:\dev\Oriongame`, where game 1 lives as `1.html`).

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
  (`crateSolid`, `trunkSolid`, `killPlane` in `src/builder.js`). Add to that list rather than
  duplicating a derivation. A checker that models the world separately is a checker that lies.

## Running it

```sh
npx http-server -p 8791 -c-1      # -c-1 matters; http-server caches for an hour
```

`file://` will not work — ES modules need an origin. Debug handle: `window.__SO2`.

## What to work on

See **`README.md` → Next**. In short: levels need to be much longer (the kid is good at
games), crates need to differ by more than a tint, the Crumble Coast track wants replacing,
and underwater + jetpack levels are the intended next mechanics — both are new camera rigs
on the existing engine, which is why the camera was built the way it was.

## Generating assets

Textures (Krea 2) and music (MiniMax Music 3) both run locally on the 4090 through **the same
ComfyUI on :8188** — they cannot share the GPU, so run one at a time, and neither auto-starts.
`tools/gentex.js`, `tools/genmusic.js`, `tools/looppoints.js`. AGENTS.md documents the traps;
several of them cost a wasted run each, so read that section before generating anything.
