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
function — `crateSolid`, `trunkSolid`, `killPlane`, `CRATE_STARS`, `TNT_R`. Add to that
list rather than duplicating a derivation. A checker that models the world separately is
a checker that lies.

`CRATE_STARS` is the newest entry and it is there because of a bug that had been sitting
in the repo since crates existed: `world.js` and `check.js` each carried their own copy of
"what a crate is worth", so the level totals the gate printed and the totals the game paid
out were two independent numbers that happened to agree. The first new crate kind broke
that silently. One table now, in the pure module.

## Enemies

`ENEMY` in `src/world.js` is the art and the tick; `BODY` in `src/builder.js` is the size
and default patrol the checker sweeps. Both halves are needed for a new kind.

| kind | stomp | spin | notes |
|---|---|---|---|
| `grumblin` | ✔ | ✔ | the bread-and-butter patroller |
| `hardhat` | ✘ | ✔ | a grumblin in a helmet — the level that teaches X |
| `hopper` | ✔ | ✔ | hops on the spot; the timing is the problem |
| `prickle` | ✘ | ✘ | jump over it |
| `jelly` | **bounce** | ✘ | bell bounces you, tentacles sting — see below |
| `zapdrone` | ✘ | ✘ | floats, fly around it |
| `flapjack` | ✔ | ✔ | floats and bobs |
| `king` | ✔ ×3 | ✘ | the boss |

**A jellyfish has a top and a bottom, and it is the only enemy that does.** Sink onto the
bell and you bounce (at the mode's `BOUNCE`, which underwater is worth more than a stroke
and costs no air, so a line of them is a route up). Anything below the rim is tentacles
and stings. The mechanism is `bouncy` in `updateEnemy`, and the part that is easy to get
wrong is the frame AFTER the bounce: still inside its radius, no longer falling, which
reads as a sting. `e.invT = .35` is what stops that — the same field the boss uses to
avoid one stomp counting as three.

`hardhat` is the only enemy in the game that teaches a BUTTON rather than a movement, so
its silhouette carries a yellow hat on a green body: the two most different colours in the
level it appears in. Do not make it subtle.

## Movement modes

A level can set `mode: 'swim'` or `mode: 'jet'`. A mode is **nothing but a patch on `T`**
(`MODES` in `src/physics.js`), and both the game and the checker read it through
`tuning(def.mode)` — so a mode cannot mean one thing to the player and another to
the gate.

| mode | lift | feel |
|---|---|---|
| *(none)* | jump, then double jump | the running game |
| `moon` | jump, then double jump | same verbs, twice the hang time |
| `swim` | every press is another stroke | low gravity, sinks at 6.5u/s |
| `jet` | HOLD to thrust, climb capped at 14u/s | no jump at all |

**`moon` is the cheap one and the one to copy.** It adds no verb: jump, double
jump, spin and ground pound all still work and still mean the same thing, so
nothing has to be explained to the player. Only the numbers move — 3.0u up on
one jump instead of 2.39, 8.8u flat instead of 5.8, and about twice as long in
the air. Because `tools/check.js` derives its arcs from `tuning(def.mode)`, a
moon level is judged by the moon's arc for free.

That last part only became true when the moon went in: `launchV` in the checker
was hard-coded to the GLOBAL `T.JUMP_V`, which is right for every level that
existed and wrong for any non-free mode that changes the jump. It now reads
`t.JUMP_V`. Free modes keep the old permissive number on purpose — see the
comment there.

Every mode also carries a **`BOUNCE`**, the pop you get off something you landed
on. `Player.bounce()` defaults to it. It is a per-mode constant rather than a
fraction of `JUMP_V` because 0.82 of a jump is a satisfying hop on land and a
rocket underwater, where a jump is half the size. A spring crate is the
exception and stays global (`T.JUMP_V * 1.35`) in both the game and the gate.

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

**Ten doors, in two rows.** Worlds 1 and 2 stand on the lawn in an arc; World 3 stands on
a raised terrace behind them, staggered against the gaps in the front row. Line the rows
up instead and every back placard hides behind a front one, because this camera only has
the one angle. The terrace is not decoration either: it says "these are the new ones"
before you have read a single sign, and height says that better than any label.

Two camera facts the hub is built around, both learned the hard way:

- **`shownLevel()` has to return `HUB` when you are on the map.** It did not, so
  `HUB.camOff` and `HUB.sunDir` were dead data for the whole life of the hub and the
  island was framed with the boom of whichever level you last played. If the level select
  ever looks different depending on where you came from, this is why.
- **The front rail must be closer to the lens than the bottom of the frustum.** The boom
  sits 23u behind Orion and tilts ~24° down; the bottom ray reaches rail height about 7u
  out. Put the island edge nearer than that and the rail is out of shot, which is what you
  want. Put it further and it parks itself across the bottom third of the level select —
  and `keepOrionInSight` will NOT save you, because the rail is under the sightline rather
  than across it.

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

## Crate kinds

`CRATE` in `src/world.js` is the behaviour and the art; `CRATE_STARS` in
`src/builder.js` is what each one is worth, and the checker reads that. Three cues per
kind, deliberately redundant: a tint, a stencil on every face, and a topper you can read
from behind or in shadow. Tint alone was the whole difference once, and you could not tell
the bonus crate from the bouncy one.

| kind | ⭐ | what it does |
|---|---|---|
| `plain` | 1 | the crate |
| `star` | 5 | a pile of them |
| `life` | 0 | 1-UP |
| `heart` | 0 | refills one heart |
| `spring` | 0 | bounces you at 1.35 of a jump |
| `iron` | 3 | **only a ground pound opens it** |
| `tnt` | 0 | takes everything within `TNT_R` with it |

Two of those have traps in them.

**`iron` needs `player.pounding`, not `player.stomping`.** A ground pound ENDS the moment
it lands: `player.update()` clears `stomping` on the grounding frame, and `world.update()`
— which is where crates are tested — runs after it. Asking `stomping` therefore gets
`false` on the exact frame the impact happens, and the crate never opens. `poundT` is a
0.14s window set at the moment of landing, and `pounding` is the getter to ask.

**`tnt` pays out by taking its neighbours with it**, so put it in the MIDDLE of a stack —
on the bottom row of a pyramid, everything above is inside the blast. On its own it is a
crate worth zero stars with a fuse drawn on it, which reads as a bug rather than a
decision, and `check.js` warns about exactly that. The chain is a QUEUE, not recursion, so
a row of them cannot blow the stack; and the whole chain pays out as ONE `boom` event,
because fifteen crate sounds and fifteen "+1 ⭐" toasts is not fifteen times better than
one bang.

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
- **`B.prop()` is a box you can see and cannot touch** — a distant mesa, a moon boulder,
  a lander. It is not a `wall()` because a wall is a platform and the checker would then
  have to prove you can reach the top of a butte 200u off the path; it is not a
  `barrier()` because that is the opposite problem, a collider with no mesh. **Keep props
  off the corridor.** `keepOrionInSight` only ghosts things in `solids`, so a prop parked
  between the camera and Orion stays solid-looking and blinds you — and nothing in the
  gate will tell you.
- **`B.cloud()`** is decoration with no collider at all, which is what a cloud has to be:
  a cloud you can land on is a platform, and a platform you can see through is a lie. It
  is deliberately not flora — flora must stand on something (the checker fails a floating
  tree), and a cloud that has to stand on something is not a cloud. Clouds draw unlit, or
  a Lambert puff under one low sun goes grey underneath and reads as a rock in the sky.
- **Flora has kinds.** `B.tree(x,y,z,s,solid,kind)` where kind ∈ `FLORA` (`src/builder.js`):
  `pine`, `kelp`, `coral`, `fan`, `crystal`, `cactus`, `shrub`. Only a pine has a trunk you can bump into —
  `trunkSolid` models a tree — so the checker fails any other kind marked solid, and
  `B.weed(x,y,z,s,kind)` is the shorthand that can't get that wrong. Use the right one for
  the place: the reef was planted with conifers for five playtests because `B.tree` was the
  only call there was, and nobody walks to the edge of the one level it showed in.
  `world.js` draws each kind (`addKelp` / `addCoral` / `addFan` / `addCrystal`); the sway is
  nested groups plus one sine per joint, and anything pushed to `this.flora` gets ticked.
- **Flora is the mesh budget, every single time.** A cactus is ten meshes and a backdrop
  loop runs the length of the level: Dust Devil Dunes shipped its first draft at 1787
  meshes — heavier than anything else in the game — purely on cacti spaced every 17u with
  ten spines each. Five spines and a 30u spacing took 585 meshes off it and the desert
  looks identical. Count before you plant.
- **Backdrop pines are batched.** Any tree with `solid = false` and kind `pine` goes into
  one `InstancedMesh` per part instead of a four-mesh group, which is 640 draw calls off
  Jungle Jog. They also stop casting shadows, and that is not a detail you can move back:
  an InstancedMesh is culled as ONE object, so a batch spanning a 660u level is inside the
  shadow frustum somewhere for the whole level and would render all 160 trees into the
  shadow map every frame. They stand 20u below the play space. Nothing is lost.
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

## The boss

`ENEMY.king` in `src/world.js`. Everything that makes him a boss rather than a big grumblin:

- **`hp`.** `World.kill()` treats a hit as a phase change while `hp > 1`: decrement, 1.1s of
  `invT` (during which he neither takes another hit nor hurts you — without it one stomp reads
  as three), shorten `hopGap` by a quarter, and say something. Only the last hit kills.
- **The crouch.** He waits, crouches for 0.38s, then hops at where you are. The telegraph IS
  the fight; shorten it and a seven-year-old just gets hit.
- **`arena`.** A radius around where he was placed, clamped every frame — in flight, not just
  on landing. He is heavy and he lands where he likes; unleashed he goes over the side, and a
  boss in the sea is a gate that never opens. `tools/check.js` proves a single floor covers
  that whole circle.
- **`B.gate()`** is a solid tagged `scenery` (collides, isn't a platform, isn't the checker's
  reachability problem) that `openGates()` removes from `solids` before it animates. Collision
  first, art second. The checker pairs gate and king in both directions.
- He is `spinProof`. A boss you can beat from the floor without leaving it is not a boss.
- **His lines are chores.** `CHORES` / `HIT_1` / `HIT_2` / `DEFEAT` in `world.js`. The joke is
  that the final boss is bedtime — keep it homework and teeth, not menace.
- Damage does NOT reset when you die: the boss keeps his hp and his rage across a respawn,
  which is the kind thing to do to a kid on his fourth attempt.

## The clock, the combo and the magnet

Three bits of feel that all had to stay out of the way of the seven-year-old they are for.

- **The run clock** (`G.runT`) ticks in `PLAY` and nowhere else, so a pause, a death card
  or a read of the sound menu is not held against you. It is per ATTEMPT rather than per
  life: it survives a death and a checkpoint respawn, and only a fresh entry from the map
  resets it. Best times live under `tm` in the save — a SEPARATE map from `lv`, because
  `id in G.lv` is what "have you cleared this" means everywhere, including `unlocked()`,
  and it has to stay a plain membership test. The HUD number is deliberately small and
  grey, and only goes gold while you are ahead of your own record: a kid who wants to race
  can read it, a kid who doesn't should never feel chased by it.
- **The combo** counts crates smashed within 1.6s of each other and awards NOTHING. The
  chain is the reward. Make it worth stars and "smash everything", which is what a
  seven-year-old does anyway, becomes something you can do wrong.
- **The magnet** pulls a star to your chest inside 3u. It does not widen the collection
  radius — the star travels, the rule doesn't — so everything the checker proved about
  where a star can be reached from still holds. Out of range it eases back home, so a star
  you nearly touched and ran away from is where you left it when you come back.

## Easter eggs

`In.cheat(word, fn)` in `src/main.js`. **A typed cheat's letters are still live game keys**, which
breaks a word in two different ways — both of which shipped, so `cheat()` now throws at boot on
either rather than trusting anyone to remember:

- **All-movement words fire themselves.** The dad joke was `dad`: d-a-d is running right, left,
  right, so it went off every few seconds of normal play. A word needs at least one letter that
  isn't in `KEYMAP`.
- **P, R, M or F anywhere in the word** pauses, restarts, mutes or goes fullscreen as you type it.
  The star cheat was `star` — the R sent you back to the checkpoint every time. Game 1 lost `mum`
  to the two Ms.

The letter set is derived from `KEYMAP` rather than hand-listed, so remapping a control can't leave
the guard stale. It is why the fart is spelled `toot`.

Current words: `sootie` `shiny` `egg` `love` `daddy` `toot` `blast` `luna`. The last two
drive the new mechanics — `blast` sets off every fuse in the level, `luna` turns moon
gravity on and off anywhere. `luna` refuses in `swim` and `jet`: those modes meter lift
with a tank, and swapping the tuning out from under one takes the gauge, the gear and the
only way up with it.

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

### The caption DOES matter — just not the "no vocals" part (2026-08-21)

The section below is still true: saying "no singing" more firmly does nothing, and
frost proved that over three re-rolls. But it was over-generalised into "captions do
not work", and this round showed that is wrong. **Removing the words that IMPLY a
singer is a different intervention from adding words that forbid one, and it works.**

Two tracks failed their seed sweep outright while three came up clean on the first or
second seed. Both failures named something vocal-adjacent:

| track | original caption said | best of 6 seeds | reworded | result |
|---|---|---|---|---|
| dunes | "spaghetti-western", "mariachi" | −10.1 dB | genre words removed, instruments only | **−14.7 dB** |
| lunar | "wide shimmering reverb pad", "long ringing tails" | −8.8 dB (fail, all six sang) | "every part is plucked or struck, nothing sustained or washy" | **−44.1 dB, first seed** |

Two different mechanisms, and it is worth knowing which is which:

- **A genre partly defined by its vocal** (mariachi, spaghetti-western, gospel, opera)
  pulls a singer in no matter how many times the caption says not to. Describe the
  instruments instead and name no genre at all.
- **Sustained tonal wash** — pads, long reverb tails, "ambient" — is what a vocal stem
  LOOKS like to source separation, so an ambient track cannot measure clean whether or
  not anyone is singing on it. That makes `vocalcheck.py` unreliable on that kind of
  material, and it is also simply the wrong music for a platformer. Ask for parts that
  are plucked, struck or blown and the problem disappears at both ends.

So the order to try things in, cheapest first: **reword the caption to remove implied
voices → roll seeds → measure.** Not "say no vocals louder", and not the AR cfg.

### Loudness: a fresh render masters HOT

Measured across this round — the five new tracks came out at **−9.2 to −11.3 LUFS**
against **−12.6 to −16.2** for the six already in the game. Walking out of the reef and
into the castle would have been a 7 LUFS jump.

`ffmpeg -af loudnorm=print_format=json` gives you the integrated figure; the fix is a
plain `volume=<gain>dB` re-encode to **−14 LUFS**, which is the middle of the shipped
set. Use gain, not `loudnorm`'s own filter: every one of these needed attenuating, and
attenuation is transparent, where loudnorm would bring a limiter and a dynamics pass
along to solve a problem that is one multiply. Peaks land at −2 to −4 dBFS afterwards,
which is fine.

`mean_volume` is NOT the number to match on — it disagrees with perceived loudness on
material this different. Use LUFS.

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

### The autoregressive cfg is NOT the vocal knob (measured 2026-08-21)

`MiniMaxMusic3TextEncode.cfg_scale` and `KSampler.cfg` are different knobs — the
first drives the autoregressive stage that picks structure and delivery, the second
drives acoustic synthesis — and the sibling music3 project found that raising the AR
one from 1.7 to 6.0 is what finally made it honour a *genre* it had been ignoring.

That does not transfer to "stop singing". Same track, same seed 3312, same caption,
only `cfg_scale` differing:

| ar_cfg | length | vocals |
|---|---|---|
| 1.7 | 100.0s | −6.7 dB (sings) |
| 6.0 | 70.4s | −7.1 dB (sings) |

0.4 dB — noise — for 30% of the track's length. **Raising it costs real duration and
buys nothing here.** `genmusic.js` therefore keeps 1.7, and `arCfg` exists on a spec
only so the next person does not have to run this A/B again.

The conclusion the repo already had still stands and is still the only thing that
works: **the seed dominates, so roll several and measure.** What changed is that
rolling is now scripted rather than done by hand — see below.

### Rolling seeds in bulk

`tools/roll.py` renders a list of seeds for each track, measures every take with the
same source separation `vocalcheck.py` uses, keeps the cleanest, and stops early once
one lands under −14 dB. It also discards anything under 30 s, because the seed decides
LENGTH as well as vocal content and a 14-second stub is a documented failure mode.

Budget it properly before starting one: a take is **~3.5 minutes** on the 4090 (two
autoregressive passes — the negative prompt runs the AR stage a second time — plus 30
diffusion steps and a tiled decode), and ~30 s of demucs on top. Six seeds across five
tracks is two hours if none of them come up clean early.

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
