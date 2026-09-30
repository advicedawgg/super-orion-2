# Super Orion 2

A Crash-Bandicoot-style 3D platformer in three.js, made for the user's seven-year-old, Orion.
It also records what an AI can build unaided, so findings get measured rather than asserted.
The bar is "working and documented", not polished. Don't gold-plate.

**This repo is public.** Machine names, containers, drive letters, ports and paths go in the
gitignored `AGENTS.local.md`, never in this file or `README.md`. `README.md` → Next lists what's left.

## Run, gate, ship

```sh
npx http-server -p 8791 -c-1   # -c-1 matters: http-server otherwise caches for an hour
node tools/check.js            # after ANY level/builder change: must print PASS
node src/physics.js            # after ANY tuning/physics change: must print PASS
npx wrangler deploy            # website (orion2.advicedawg.com); .assetsignore decides what ships
git push                       # the Steam Deck install pulls from GitHub, so wrangler never reaches it
```

- `file://` won't work because ES modules need an origin. The debug handle is `window.__SO2`
  (`G, world, player, cam, scene, LEVELS, THREE`). In Playwright, send a `Space` keydown to start,
  then `__SO2.player.reset(new __SO2.THREE.Vector3(x,y,z))` to teleport.
- A change isn't done until its gate prints PASS. The gates import the real builder and tuning, so
  they catch what a diff never shows.
- The boss fight is the one thing the gate can't prove, so test it in a browser.

## Rules

- **Never change the physics constants (`T` in `src/physics.js`) to fix a level. Change the level.**
  Every jump the kid has learned is calibrated to them.
- **No build step.** three.js is vendored behind an import map, and the repo is the deployable artifact.
- If the game and the checker need to agree on something, it lives in one exported symbol in
  `src/builder.js` (`crateSolid`, `trunkSolid`, `killPlane`, `FLOATING`, `FLORA`, `BODY`,
  `CRATE_STARS`, `TNT_R`) or in `tuning()` in `src/physics.js`. Add to that set. Never duplicate
  a derivation in `check.js`.
- Collision exists only in `solids`, because the checker sees nothing else.

### Levels (`build(B)` in `src/levels.js`)

- `(x,y,z)` on a solid is the centre of its **top face**. Write Z anchors out in full. Chained
  offsets are how platforms ended up overlapping and z-fighting.
- Size gaps from the reach figures `check.js` prints. Story gaps should be about half the arc
  (3.0–4.5u when running). The checker warns above 85% of the arc, which is where a
  seven-year-old gives up.
- `mode` patches `T` through `tuning(def.mode)` for both the game and the checker. Copy `moon`:
  it only changes numbers and adds no new verb. `swim`/`jet` are free modes: they **require
  `ceilY`**, meter lift with a tank that refills only on solids, and also need local roofs over
  loose stretches, or you just ride the ceiling over everything.
- Use `roof()` for every ceiling, because a slab that casts shadows darkens the whole room.
- `B.prop()` has no collider. Keep props far from the corridor: the checker fails a reachable
  prop, but nothing catches one that sits between the camera and Orion. If it should be
  standable, make it a `wall()`.
- Only `pine` has a trunk. Use `B.weed()` for other flora. Backdrop trees need `solid=false`.
  Flora is the mesh budget, so count meshes before planting a backdrop loop.
- New enemy kinds need `ENEMY` (world.js) and `BODY` (builder.js), plus `FLOATING` if they hover.
  The checker sweeps the whole patrol path and fails any enemy that touches a checkpoint.
- Crates fall when unsupported. Support is a footprint overlap, never a centre point, or pyramids
  collapse on load. `iron` checks `player.pounding`, **not** `stomping`, which is already cleared when
  crates are tested. Put `tnt` mid-stack.

### Camera and hub

- The camera must never lose sight of Orion. `keepOrionInSight()` ghosts occluding solids. **Don't
  fix occlusion by shortening the boom**, because it parks the camera inside a 56u corridor wall.
- `HUB` is a real Builder level with `B.portal()` doors. `shownLevel()` must return `HUB` on the
  map, or it gets framed with the last level's camera. Stagger the rows of doors so no placard
  hides another. Keep the front rail nearer the lens than the frustum's bottom edge.
- `B.barrier()` (invisible, 9u) is what keeps you on the island. Don't raise the visible rail.
- Progression is linear and cleared levels stay open.

### Kid-first design (don't regress these)

- Nothing punishes. Losing all lives returns you to the map, and the boss keeps damage across deaths.
- The boss's crouch telegraph *is* the fight, so don't shorten it. His lines are bedtime chores
  (homework, teeth), never menace. He's `spinProof` and clamped to his `arena`, which the
  checker proves has a floor.
- The run clock is small and grey and only turns gold when you're ahead of your record. The crate
  combo awards **nothing**. The magnet moves the star, not the pickup radius.
- Teaching cues must be loud. The hardhat keeps a yellow hat on a green body, crates keep
  tint + stencil + topper, lava draws unlit, and landable floors stay light while structure
  stays dark.

## Assets

SFX are synthesised and textures generate at boot, so no asset file is required. Music:
`node tools/genmusic.js <id>` → `assets/audio/<id>.mp3`, plus an entry in `TRACKS` (`src/audio.js`).
Texture: `assets/tex/<name>.png`, plus an entry in `REAL` (`src/art.js`). Music (MiniMax Music 3)
and textures (Krea 2) share one local GPU and never run at once, and neither auto-starts (see
`AGENTS.local.md`). The game open in Chrome starves VRAM, so check `nvidia-smi` before calling a
job hung. Each of these traps cost a wasted run:

- `lyrics` **tags** buy length and body text gets sung, so send tags with empty bodies (the default).
- Vocals: **reword the caption to drop anything implying a singer** (vocal genres like mariachi or
  gospel, pads, reverb wash, "ambient") and describe plucked/struck/blown instruments. Then roll
  seeds (`tools/roll.py`) and measure (`tools/vocalcheck.py`, ≤ −14 dB is clean). "No vocals"
  and the AR `cfg_scale` do nothing. The seed dominates, so pin the winner in `TRACKS`.
- Before shipping, run `ffprobe`, `volumedetect` and `silencedetect`. Set **−14 LUFS** with a plain
  `volume=` gain (not `loudnorm`), matching on LUFS rather than `mean_volume`.
- Loops: `node tools/looppoints.js --preview <name>` renders what the game plays. `--after=<s>`
  skips an intro or crescendo, and `--hint=a,b` snaps bars a human picked. A bare run only cuts
  tracks with no points yet. The points in `src/music.js` were chosen by ear, so don't churn them.
  When the ear and a score disagree, the ear wins.

Key art is Nano Banana 2 via the openrouter MCP (copy the output out of its container). For a
transparent image, generate on `#00FF00`, use a global `-transparent` (not a floodfill), and
erode alpha by 1 px. House style: cosmic indigo and gold stars. Orion has a white helmet with an
orange stripe, blue overalls with a white chest star, and red gloves and boots.

A human judges whether anything is *good*. Tools only answer the measurable part.
