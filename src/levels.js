// Level data. Each build(B) runs once against the Builder in src/builder.js.
//
// Geometry rule of thumb, from src/physics.js:
//   flat gap  <= 5.8u for a running jump   -> keep story gaps at 3.0-4.5
//   step rise <= 2.4u for a single jump    -> anything higher needs the double
// `node tools/check.js` enforces both, plus floating scenery, coplanar
// z-fighting and unreachable content. Trust it over your eyeballs.
//
// Z anchors are written out in full rather than chained off each other. The
// chained version (`cz - 38`) is how two platforms silently ended up
// overlapping by half a unit and shimmering.
//
// A level may set `mode: 'swim'` or `mode: 'jet'` (see MODES in src/physics.js).
// Both are FREE modes - vertical travel is unbounded - so they require a `ceilY`
// and the checker deliberately stops trying to prove reachability from a jump arc.

export const LEVELS = [
{
  id: 'jungle', name: 'Jungle Jog', world: 1,
  sky: [0x63b8ff, 0xcdeeff], fog: [0xc4e7ff, 45, 175],
  sun: 0xfff4dd, sunDir: [-0.5, 1, 0.6], amb: 0x50603a,
  camYaw: 0, start: [0, 1, 12],
  hint: 'SPACE to jump — jump AGAIN in the air for a double jump. X to spin!',
  build(B) {
    // The jungle floor, a long way below. Not solid: pits still kill, they now
    // just look like a drop into the canopy instead of a drop into nothing.
    // 20u down and tinted, so it never reads as more of the same ground.
    B.ground(-20, 'dirt');
    // Rows 22u apart, five columns: a forest that reads dense through the fog
    // without putting four meshes every 13u down a 660u level. The Steam Deck
    // is the machine this has to hold 60fps on.
    for (let z = 26; z > -664; z -= 22) {
      for (const x of [-24, -38, -54, 25, 41]) {
        const s = 1.6 + ((Math.abs(x) * 3 + Math.abs(z) * 7) % 11) / 9;   // 1.6 .. 2.7
        B.tree(x + ((z * 5) % 9) - 4, -20, z + (x % 7), s, false);   // backdrop: never solid
      }
    }

    /* --- A: flat ground, learn to run and bonk --------------------------- */
    B.floor(0, 0, -2, 14, 40, 'grass');                    // z 18 .. -22
    B.starLine(0, 1.2, 6, 6, [0, 0, -2.4]);
    B.enemy('grumblin', -2.5, 0, -6, { axis: 'x', range: 7 });
    B.enemy('grumblin', 3, 0, -15, { axis: 'x', range: 6 });
    B.crateRow(-3, 0, -19, 3, 'plain');
    B.crate(3, 0, -19, 'star');
    for (let z = 16; z > -22; z -= 6) { B.tree(-5.9, 0, z, .85); B.tree(5.9, 0, z, .8); }

    /* --- B: the gaps. 6-deep slabs on a 10.5 pitch = 4.5u gaps ----------- */
    // Written out rather than looped: four identical hops was the dullest 44u
    // in the level, so each slab now carries something the last one didn't and
    // the run finishes by stepping UP instead of across.
    B.floor(0, 0, -29.5, 7, 6, 'grass');                   // z -32.5 .. -26.5
    B.starLine(0, 1.3, -28, 3, [0, 0, -1.4], .8);
    B.floor(3, 0, -40, 6, 6, 'grass');                     // z -43 .. -37
    B.starLine(3, 1.3, -38.5, 3, [0, 0, -1.4], .8);
    B.enemy('grumblin', 3, 0, -40, { axis: 'x', range: 3 });  // a landing pad with a tenant
    B.floor(-3, 0, -50.5, 6, 6, 'grass');                  // z -53.5 .. -47.5
    B.starLine(-3, 1.3, -48.5, 3, [0, 0, -1.4], .8);
    B.crate(-3, 0, -52.5, 'star');                         // back of the pad, not the landing spot
    B.floor(0, 1.2, -60, 7, 6, 'grass');                   // z -63 .. -57 — 3.5u gap, and it rises
    B.starLine(0, 2.5, -58.5, 3, [0, 0, -1.4], .9);
    B.floor(0, 0, -70.5, 12, 8, 'grass');                  // z -74.5 .. -66.5
    B.checkpoint(0, 0, -70.5);

    /* --- C: crates, the spring, and the double jump ---------------------- */
    B.floor(0, 0, -78, 10, 7, 'dirt');                     // z -74.5 .. -81.5 (abuts)
    B.crateRow(-2.2, 0, -78, 3, 'plain', [2.2, 0, 0]);
    B.crate(2.5, 0, -80, 'spring');
    B.starLine(2.5, 3.2, -80, 4, [0, .9, -1.2]);           // inside the spring's arc

    B.floor(0, 2.0, -87.5, 8, 6, 'rock');                  // single jump up
    B.floor(0, 4.6, -97, 7, 6, 'rock');                    // +2.6 — needs the double
    B.starLine(0, 6.0, -95, 4, [0, .35, -1.3]);
    B.enemy('flapjack', 0, 3.6, -92, { axis: 'x', range: 7 });
    B.floor(0, 4.6, -107, 9, 7, 'rock');
    B.crate(-2.4, 4.6, -107, 'star');
    B.crate(2.4, 4.6, -107, 'life');

    /* --- D: spikes, and platforms that move ------------------------------ */
    B.floor(0, 4.6, -119, 11, 13, 'dirt');                 // z -112.5 .. -125.5
    B.enemy('prickle', -2.6, 4.6, -116, {});
    B.enemy('prickle', 2.6, 4.6, -120, {});
    B.enemy('grumblin', 0, 4.6, -123, { axis: 'x', range: 8 });
    B.wall(-6.4, 7.6, -119, 1.2, 13, 3, 'rock');
    B.wall(6.4, 7.6, -119, 1.2, 13, 3, 'rock');

    B.mover(0, 4.6, -132, 5, 5, 1, [8, 4.6, -132], 5);
    B.mover(0, 4.6, -140, 5, 5, 1, [-8, 4.6, -140], 5.6);
    B.starLine(0, 6.0, -132, 2, [0, 0, -8]);
    B.floor(0, 4.6, -149, 12, 8, 'grass');                 // z -145 .. -153
    B.checkpoint(0, 4.6, -149);

    /* --- E: the trampoline drop into the deep jungle ---------------------- */
    // Everything so far has been a climb, and the level has to give the height
    // back. A staircase of abutting slabs would give it back for free — 35u of
    // running downhill. So the way down is four spring pads on ruined stumps
    // over open air, each lower than the last, and the BOUNCE is what carries
    // you between them. The stumps run all the way to the jungle floor at
    // y=-20 so they read as columns rather than floating discs.
    B.box(0, 3.0, -158, 3.4, 3.4, 23, 'dirt');             // z -159.7 .. -156.3
    B.crate(0, 3.0, -158, 'spring');
    B.box(-3, 1.4, -166, 3.4, 3.4, 21.4, 'dirt');          // z -167.7 .. -164.3
    B.crate(-3, 1.4, -166, 'spring');
    B.box(2, 0.2, -174, 3.4, 3.4, 20.2, 'dirt');           // z -175.7 .. -172.3
    B.crate(2, 0.2, -174, 'spring');
    B.box(-1, -1.0, -182, 3.4, 3.4, 19, 'dirt');           // z -183.7 .. -180.3
    B.crate(-1, -1.0, -182, 'spring');
    // Steer the last bounce right instead of forward and the detour pays 5.
    // It sits beside the landing floor, so the way back is a walk, not a leap.
    B.box(7, -0.6, -183, 3.6, 3.6, 19.4, 'rock');          // z -184.8 .. -181.2
    B.crate(7, -0.6, -183, 'star');
    B.starLine(0, 6.4, -159.5, 3, [-1.5, 0, -2.5], 1.8);   // one arc per bounce
    B.starLine(-2.5, 4.8, -167.5, 3, [2.25, 0, -2.5], 1.8);
    B.starLine(2, 3.6, -175.5, 3, [-1.5, 0, -2.5], 1.6);
    B.starLine(-1, 2.4, -183.5, 3, [.5, 0, -2], 1.4);
    B.enemy('flapjack', -1, 5.0, -162, { axis: 'x', range: 6, bob: 1.4 });
    B.enemy('flapjack', 2, 3.0, -177, { axis: 'x', range: 6, bob: 1.5 });

    B.floor(0, -1.4, -196, 14, 16, 'dirt');                // z -204 .. -188
    // Solid ground between the bounce and the bridge, and the only thing
    // standing between a missed plank and replaying the whole descent.
    B.checkpoint(0, -1.4, -198);
    B.enemy('grumblin', -3, -1.4, -192, { axis: 'x', range: 7 });
    B.enemy('grumblin', 3, -1.4, -200, { axis: 'x', range: 7 });
    B.crateRow(-3.15, -1.4, -195, 3, 'plain', [2.1, 0, 0]);
    B.star(0, -0.1, -191);
    B.star(0, -0.1, -202);
    B.tree(-6.2, -1.4, -191, .8);
    B.tree(6.2, -1.4, -198, .75);

    /* --- F: the rope bridge. Narrow planks, and a long way down ----------- */
    // 4-wide planks on a 9u pitch = 4.0u gaps, sagging in the middle so the
    // bridge reads as a bridge and not as six identical tiles.
    B.floor(0, -1.9, -208.5, 4, 5, 'dirt');                // z -211 .. -206
    B.floor(-2, -2.6, -217.5, 4, 5, 'dirt');               // z -220 .. -215
    B.floor(2, -3.1, -226.5, 5.4, 5, 'dirt');              // z -229 .. -224, wide enough to stand
    // The loose plank: the one that slides out from under you. One moving piece
    // inside a static set piece, so the bridge isn't six of the same tile.
    B.mover(-2, -3.1, -235.5, 4, 5, 1, [2, -3.1, -235.5], 4.6, 'dirt');   // z -238 .. -233
    B.floor(2, -2.6, -244.5, 4, 5, 'dirt');                // z -247 .. -242
    B.floor(0, -1.9, -253.5, 4, 5, 'dirt');                // z -256 .. -251
    B.crate(2, -3.1, -226.5, 'star');                      // the bridge's one payout
    B.starLine(-1, -0.6, -211.6, 3, [0, 0, -1.4], 1.1);    // arc over gap 1
    B.starLine(0, -1.8, -229.6, 3, [0, 0, -1.4], 1.1);     // arc over gap 3
    B.starLine(1, -1.3, -247.6, 3, [0, 0, -1.4], 1.1);     // arc over gap 5
    B.enemy('flapjack', 0, -0.4, -222, { axis: 'x', range: 7, bob: 1.6 });
    B.enemy('flapjack', 0, -1.0, -240, { axis: 'x', range: 7, bob: 1.6 });

    B.floor(0, -1.4, -264, 13, 14, 'grass');               // z -271 .. -257
    B.checkpoint(0, -1.4, -266);
    B.tree(-5.7, -1.4, -260, .8);
    B.tree(5.7, -1.4, -267, .75);

    /* --- G: the spring tower up to the canopy ----------------------------- */
    // The ledge is 5.0u above the floor — over the double jump, so the spring
    // crate is the only way up and the kid has to work that out.
    B.floor(0, -1.4, -276, 11, 10, 'dirt');                // z -281 .. -271 (abuts)
    B.crate(0, -1.4, -277, 'spring');
    B.tree(-4.6, -1.4, -273, .8);
    B.starLine(0, 1.6, -278, 5, [0, .9, -1.6]);            // inside the spring's arc
    B.floor(0, 3.6, -285.5, 8, 7, 'rock');                 // z -289 .. -282
    B.floor(-4, 6.0, -294, 7, 7, 'rock');                  // z -297.5 .. -290.5
    B.floor(4, 8.4, -302, 7, 7, 'rock');                   // z -305.5 .. -298.5
    B.star(-4, 7.3, -294);
    B.enemy('flapjack', 0, 8.6, -292, { axis: 'x', range: 6, bob: 1.4 });

    /* --- H: the branch, and the flock that patrols it --------------------- */
    // NOT more gapped planks. F is already the gapped-plank set piece and doing
    // it again 100u later with different numbers is the same beat twice. This
    // one is a single continuous branch you have to stay ON, narrowing as it
    // goes, while the flock dips across it — the gate is the bob, not the gap,
    // so there is always a window and you can stomp your way through instead.
    B.floor(0, 10.8, -310, 8, 8, 'rock');                  // z -314 .. -306
    B.checkpoint(0, 10.8, -310);                           // banked at the top of the tower
    B.floor(0, 10.8, -322, 3.2, 16, 'wood');               // beam 1: z -330 .. -314
    B.floor(0, 10.8, -333.5, 7, 7, 'rock');                // the knot: z -337 .. -330
    B.floor(-7, 10.8, -333.5, 7, 3, 'wood');               // dead-end limb: x -10.5 .. -3.5
    B.crate(-9.5, 10.8, -333.5, 'life');                   // right out at the tip of it
    B.starLine(-5.5, 12.1, -333.5, 2, [-1.6, 0, 0]);
    B.floor(0, 10.8, -346.5, 2.6, 19, 'wood');             // beam 2: z -356 .. -337, narrower
    B.starLine(0, 12.1, -316, 6, [0, 0, -2.6]);
    B.starLine(0, 12.1, -339, 6, [0, 0, -2.6]);
    B.enemy('flapjack', 0, 12.6, -318, { axis: 'x', range: 5, bob: 1.8 });
    B.enemy('flapjack', 0, 12.6, -326, { axis: 'x', range: 5, bob: 1.8 });
    B.enemy('flapjack', 0, 12.6, -342, { axis: 'x', range: 5, bob: 1.8 });
    B.enemy('flapjack', 0, 12.6, -351, { axis: 'x', range: 5, bob: 1.8 });

    // The fork: straight on past a prickle, or out left along two tiny slabs
    // for the 5-star crate. Both land back on the same wide slab. The safe slab
    // is centred on the beam you arrive from — off-centre, you land 1u from a
    // 10u drop through no fault of your own.
    B.floor(1, 10.8, -362.5, 9, 7, 'dirt');                // safe:  z -366 .. -359
    B.enemy('prickle', 4, 10.8, -362.5, {});
    B.floor(-8, 10.8, -359, 4, 4, 'rock');                 // risky: z -361 .. -357
    B.floor(-8, 10.8, -366, 4, 4, 'rock');                 // risky: z -368 .. -364
    B.crate(-8, 10.8, -366, 'star');
    B.starLine(-8, 12.1, -358, 2, [0, 0, -1.6]);
    B.floor(-1, 10.8, -373, 15, 6, 'dirt');                // z -376 .. -370, both paths

    /* --- I: the chicane down out of the canopy ---------------------------- */
    B.floor(-4, 9.2, -381, 5, 6, 'rock');                  // z -384 .. -378
    B.floor(4, 7.6, -389, 5, 6, 'rock');                   // z -392 .. -386
    B.floor(-4, 6.0, -397, 5, 6, 'rock');                  // z -400 .. -394
    B.floor(4, 4.4, -405, 5, 6, 'rock');                   // z -408 .. -402
    B.star(-4, 10.5, -381);
    B.star(4, 8.9, -389);
    B.star(-4, 7.3, -397);
    B.star(4, 5.7, -405);
    // Sweeps the whole width of the chicane, so the metronome has to be broken.
    B.enemy('flapjack', 0, 8.6, -393, { axis: 'x', range: 8, bob: 1.4 });

    B.floor(0, 4.4, -415, 13, 12, 'grass');                // z -421 .. -409
    B.checkpoint(0, 4.4, -414);
    B.enemy('grumblin', 0, 4.4, -418, { axis: 'x', range: 8 });
    B.crate(-5, 4.4, -412, 'life');
    B.tree(-5.8, 4.4, -420, .8);
    B.tree(5.8, 4.4, -412, .7);

    /* --- J: the mover chain over the wide void ---------------------------- */
    // Four rides, and the third one goes UP instead of across.
    B.mover(0, 4.4, -427, 5, 5, 1, [7, 4.4, -427], 5);
    B.mover(7, 4.4, -435, 5, 5, 1, [-7, 4.4, -435], 6);
    B.mover(-7, 4.4, -443, 5, 5, 1, [-7, 8.0, -443], 5.4);
    B.mover(-7, 8.0, -451, 5, 5, 1, [0, 8.0, -451], 5.8);
    B.star(0, 6.0, -427);
    B.star(7, 6.0, -435);
    B.star(-7, 6.0, -443);
    B.star(-7, 9.6, -451);
    B.enemy('flapjack', 4, 6.6, -439, { axis: 'x', range: 6, bob: 1.5 });

    B.floor(0, 8.0, -461, 12, 12, 'rock');                 // z -467 .. -455
    B.enemy('grumblin', 0, 8.0, -458, { axis: 'x', range: 8 });

    /* --- K: the prickle gauntlet, funnelled by rock walls ----------------- */
    // Walls both sides so there is no walking around it: spikes are for going
    // over or squeezing past, never for spinning.
    B.floor(0, 8.0, -477, 7, 12, 'rock');                  // z -483 .. -471
    B.wall(-4.6, 11.0, -477, 1.4, 12, 3, 'rock');
    B.wall(4.6, 11.0, -477, 1.4, 12, 3, 'rock');
    B.enemy('prickle', -2, 8.0, -473, {});
    B.enemy('prickle', 2, 8.0, -477, {});
    B.enemy('prickle', -2, 8.0, -481, {});
    B.star(2, 9.3, -473);
    B.star(-2, 9.3, -477);
    B.star(2, 9.3, -481);

    B.floor(0, 8.0, -490, 7, 10, 'rock');                  // z -495 .. -485
    B.wall(-4.6, 11.0, -490, 1.4, 10, 3, 'rock');
    B.wall(4.6, 11.0, -490, 1.4, 10, 3, 'rock');
    B.enemy('prickle', 2, 8.0, -487, {});
    B.enemy('grumblin', 0, 8.0, -492, { axis: 'x', range: 5 });
    B.star(-2, 9.3, -490);

    B.floor(0, 8.0, -503, 12, 12, 'rock');                 // z -509 .. -497
    B.checkpoint(0, 8.0, -502);

    /* --- L: the crate pyramid, and a bonus alcove off to the side --------- */
    B.floor(0, 8.0, -518, 13, 14, 'dirt');                 // z -525 .. -511
    B.crateRow(-3.15, 8.0, -518, 4, 'plain', [2.1, 0, 0]);
    B.crateRow(-2.1, 9.8, -518, 3, 'plain', [2.1, 0, 0]);
    B.crateRow(-1.05, 11.6, -518, 2, 'plain', [2.1, 0, 0]);
    B.crate(0, 13.4, -518, 'life');                        // the top of the pyramid
    B.tree(-5.8, 8.0, -514, .8);
    B.tree(5.8, 8.0, -523, .75);

    B.floor(-12, 8.0, -520, 6, 6, 'rock');                 // alcove: z -523 .. -517
    B.starLine(-12, 9.3, -518, 2, [0, 0, -2]);
    B.crate(-12, 8.0, -522, 'star');

    B.floor(0, 8.0, -532, 11, 10, 'dirt');                 // z -537 .. -527
    B.enemy('grumblin', -3, 8.0, -530, { axis: 'x', range: 7 });
    B.enemy('grumblin', 3, 8.0, -535, { axis: 'x', range: 7 });
    B.starLine(0, 9.3, -530, 2, [0, 0, -3]);

    /* --- M: the ruins. The staircase that isn't all there ----------------- */
    // Six even steps down would be E's staircase again. Here two of the steps
    // have fallen away, so the descent is three steps, one 5.5u leap across the
    // collapsed span, and a landing — with a lower ledge off to the right that
    // takes the leap out of it and pays 5 stars for going the long way.
    B.floor(0, 8.0, -543, 9, 8, 'rock');                   // z -547 .. -539
    B.enemy('grumblin', 0, 8.0, -543, { axis: 'x', range: 6 });
    B.floor(0, 6.4, -551, 8, 5, 'rock');                   // z -553.5 .. -548.5
    B.floor(-3, 4.8, -558, 7, 5, 'rock');                  // z -560.5 .. -555.5
    B.floor(3, 1.6, -568.5, 7, 5, 'rock');                 // z -571 .. -566, across the span
    B.floor(0, 0.0, -576.5, 9, 7, 'rock');                 // z -580 .. -573 (abuts the arena)
    B.floor(8, 3.2, -562, 5, 5, 'rock');                   // the long way round
    B.crate(8, 3.2, -562, 'star');
    B.star(0, 9.3, -545);
    B.star(0, 7.7, -551);
    B.star(-3, 6.1, -558);
    B.starLine(-1.5, 6.4, -561.5, 3, [1.5, 0, -2], 1.2);   // bows over the collapsed span
    B.star(3, 2.9, -568.5);
    B.star(0, 1.3, -576.5);
    B.enemy('flapjack', -3, 6.4, -554, { axis: 'x', range: 6, bob: 1.4 });
    B.enemy('flapjack', 7, 7.0, -562, { axis: 'x', range: 6, bob: 1.4 });   // guards the detour

    B.floor(0, 0.0, -589, 18, 18, 'rock');                 // the arena: z -598 .. -580
    B.checkpoint(0, 0.0, -582);
    B.wall(-8.2, 3.0, -584, 1.4, 8, 3, 'rock');            // broken pillars
    B.wall(8.2, 3.0, -594, 1.4, 8, 3, 'rock');
    B.enemy('grumblin', -4, 0.0, -585, { axis: 'x', range: 5 });   // range clears the pillar
    B.enemy('grumblin', 4, 0.0, -593, { axis: 'x', range: 5 });
    B.enemy('prickle', 0, 0.0, -589, {});
    B.enemy('flapjack', 0, 2.2, -589, { axis: 'x', range: 10, bob: 1.6 });
    B.crateRow(-3.15, 0.0, -596, 4, 'plain', [2.1, 0, 0]);
    B.starLine(0, 1.3, -584, 3, [0, 0, -2.5]);
    B.tree(-8.2, 0.0, -595, .9);

    /* --- N: the victory lap, and the star arc into the goal --------------- */
    // Three steps and three stars was 36u of nothing at the point the level is
    // supposed to be celebrating. Same geometry, but the first step is a lap
    // full of grumblins to spin through and the last gap is a real 4u jump.
    B.floor(0, 0.0, -606, 10, 12, 'rock');                 // z -612 .. -600
    B.enemy('grumblin', -3, 0.0, -604, { axis: 'x', range: 4 });
    B.enemy('grumblin', 3, 0.0, -609, { axis: 'x', range: 4 });
    B.starLine(0, 1.3, -603, 4, [0, 0, -2.4]);
    B.floor(0, 2.4, -618, 9, 8, 'rock');                   // z -622 .. -614 (double jump)
    B.crate(-3, 2.4, -619, 'star');                        // off the racing line
    B.star(0, 3.7, -616);
    B.floor(0, 4.8, -630, 9, 8, 'rock');                   // z -634 .. -626
    B.star(0, 6.1, -630);
    B.floor(0, 4.8, -643, 12, 10, 'grass');                // z -648 .. -638
    B.starLine(0, 6.2, -635, 5, [0, 0, -1.6], 1.8);        // the last arc, over a real gap
    B.enemy('flapjack', 5, 6.4, -644, { axis: 'x', range: 6, bob: 1.5 });
    B.tree(-5, 4.8, -646, .85);
    B.tree(5, 4.8, -640, .8);
    B.goal(0, 4.8, -643);
  },
},

{
  id: 'coast', name: 'Crumble Coast', world: 1,
  sky: [0x2f9fd8, 0xffe9b8], fog: [0xffe2b0, 40, 165],
  sun: 0xffe9c4, sunDir: [0.7, 1, 0.3], amb: 0x50603a,
  camYaw: 0, start: [0, 1, 12],
  hint: 'Blue crates are springboards. Bounce!',
  build(B) {
    B.ground(-11, 'water');                                 // the sea, 11-26u down

    /* --- the beach ------------------------------------------------------- */
    B.floor(0, 0, 1, 13, 30, 'sand');                       // z 16 .. -14
    B.starLine(0, 1.2, 8, 5, [0, 0, -2.4]);
    B.enemy('grumblin', 0, 0, -4, { axis: 'x', range: 9 });
    B.crate(-4, 0, -10, 'plain'); B.crate(4, 0, -10, 'plain');
    for (let z = 14; z > -14; z -= 7) { B.tree(-5.4, 0, z, .7); B.tree(5.4, 0, z, .65); }

    /* --- stepping stones out into the water. 5-deep on a 9.5 pitch ------- */
    let z = -20;
    for (let i = 0; i < 6; i++) {
      const dx = Math.sin(i * 1.35) * 4.2;
      B.floor(dx, 0.6 + (i % 2) * .8, z, 5, 5, 'rock');
      B.star(dx, 2.2 + (i % 2) * .8, z);
      if (i === 2) B.enemy('flapjack', dx, 3.4, z - 4, { axis: 'x', range: 6 });
      z -= 9.5;
    }
    // Six identical hops would be a corridor, so the last gap is not one: a
    // jellyfish rises through it on a slow bob — the first thing on this coast
    // that cannot be stomped, and a look ahead at the tide-pool channel. The
    // star sits at the top of the arc, over its head, marking the safe line.
    B.enemy('jelly', -0.7, 2.0, -62.75, { bob: 2.2 });
    B.star(-0.7, 4.2, -62.75);
    B.floor(0, .6, -77, 12, 9, 'sand');                     // z -72.5 .. -81.5
    B.checkpoint(0, .6, -77);

    /* --- A: the tide pools ----------------------------------------------- */
    // Low slabs in shallow water. A fork off to the left pays a 5-star crate
    // for two tiny stones over open sea; the main line stays on the pitch.
    B.floor(0, 0.6, -86, 11, 9, 'sand');                    // z -81.5 .. -90.5 (abuts)
    B.starLine(0, 1.8, -83, 4, [0, 0, -2.0]);
    B.enemy('grumblin', 0, 0.6, -87, { axis: 'x', range: 8 });

    B.floor(-3.5, 1.0, -95.5, 5, 5, 'rock');                // z -93 .. -98
    B.floor(3.5, 1.4, -104, 5, 5, 'rock');                  // z -101.5 .. -106.5
    B.floor(-3.5, 1.0, -112.5, 5, 5, 'rock');               // z -110 .. -115
    B.star(-3.5, 2.6, -95.5);
    B.star(3.5, 3.0, -104);
    B.star(-3.5, 2.6, -112.5);

    // the risky fork
    B.floor(-11, 1.0, -99.5, 4, 4, 'rock');                 // z -97.5 .. -101.5
    B.floor(-11, 1.0, -108, 4, 5, 'rock');                  // z -105.5 .. -110.5
    B.crate(-11, 1.0, -108, 'star');
    B.starLine(-11, 2.4, -102, 3, [0, 0, -1.6]);
    B.enemy('jelly', 0, 2.5, -108, { bob: 2.2 });
    B.enemy('jelly', -7, 2.5, -117, { bob: 2.0 });

    /* --- B: the spring channel ------------------------------------------- */
    // A launch pad, a springboard on its lip, and a 9u channel. The width is
    // chosen, not decorative: a running double jump off the lip reaches 8.6u
    // and falls in the sea, the bounce reaches 11.2u. The spring is the bridge.
    B.floor(0, 1.4, -121, 10, 8, 'rock');                   // z -117 .. -125
    B.crate(0, 1.4, -124, 'spring');
    B.starLine(0, 4.6, -127, 4, [0, 0.9, -1.8]);            // inside the bounce arc
    B.floor(0, 2.6, -139, 13, 10, 'sand');                  // z -134 .. -144
    B.starLine(0, 4.0, -135, 3, [0, 0, -2.0]);
    B.enemy('grumblin', -3, 2.6, -138, { axis: 'x', range: 7 });
    // CP1 was 62u back at the sandbar, so missing the channel replayed the tide
    // pools and the fork. This is the level's tightest jump; it gets a flag.
    B.checkpoint(0, 2.6, -142);

    /* --- C: the cliff climb ---------------------------------------------- */
    // Five zig-zag ledges, 2.4u apiece — every one of them a double jump.
    B.floor(-4, 5.0, -148, 7, 6, 'rock');                   // z -145 .. -151
    B.floor(4, 7.4, -157, 7, 6, 'rock');                    // z -154 .. -160
    B.floor(-4, 9.8, -166, 7, 6, 'rock');                   // z -163 .. -169
    B.floor(4, 12.2, -175, 7, 6, 'rock');                   // z -172 .. -178
    B.floor(-4, 14.6, -184, 7, 6, 'rock');                  // z -181 .. -187
    B.starLine(-4, 6.4, -147, 2, [0, 0, -1.6]);
    B.starLine(4, 8.8, -156, 2, [0, 0, -1.6]);
    B.starLine(-4, 11.2, -165, 2, [0, 0, -1.6]);
    B.starLine(4, 13.6, -174, 2, [0, 0, -1.6]);
    B.starLine(-4, 16.0, -183, 2, [0, 0, -1.6]);
    B.enemy('prickle', -4, 9.8, -167, {});
    B.enemy('flapjack', 0, 10.5, -161, { axis: 'x', range: 7, bob: 1.6 });
    B.enemy('grumblin', 4, 12.2, -175, { axis: 'x', range: 5 });
    B.floor(13, 12.2, -175, 4, 5, 'rock');                  // alcove off the ledge
    B.crate(13, 12.2, -175, 'life');

    /* --- D: the clifftop arena + checkpoint ------------------------------- */
    B.floor(0, 14.6, -195, 14, 12, 'rock');                 // z -189 .. -201
    B.checkpoint(0, 14.6, -195);
    B.enemy('grumblin', -3.5, 14.6, -192, { axis: 'x', range: 6 });
    B.enemy('grumblin', 3.5, 14.6, -198, { axis: 'x', range: 6 });
    // NOT on the flag: a prickle sharing the checkpoint's square means touching
    // the checkpoint costs you a heart, which reads as the flag hurting you.
    B.enemy('prickle', -4.5, 14.6, -196, {});
    B.crateRow(-4.2, 14.6, -199.5, 5, 'plain', [2.1, 0, 0]);
    B.starLine(0, 16.0, -191, 2, [0, 0, -1.8]);
    B.tree(-6.4, 14.6, -191, .8);
    B.tree(6.4, 14.6, -199, .75);

    /* --- E: the wooden pier ----------------------------------------------- */
    // Deck, mover, post, mover, and a last mover that lifts you a storey.
    B.floor(0, 14.6, -207, 10, 8, 'dirt');                  // z -203 .. -211
    B.mover(-5, 14.6, -216, 5, 5, 1, [5, 14.6, -216], 4.4, 'dirt');
    B.floor(0, 14.6, -224, 6, 5, 'dirt');                   // z -221.5 .. -226.5
    B.mover(5, 14.6, -233, 5, 5, 1, [-5, 14.6, -233], 4.8, 'dirt');
    B.mover(0, 14.6, -241, 5, 5, 1, [6, 18.0, -241], 5.2, 'dirt');
    B.floor(6, 18.0, -251, 9, 7, 'dirt');                   // z -247.5 .. -254.5
    B.star(-5, 16.0, -216);
    B.star(5, 16.0, -233);
    B.star(0, 16.0, -241);
    B.starLine(0, 16.0, -205, 2, [0, 0, -1.8]);
    B.star(0, 16.0, -224);
    B.enemy('flapjack', 0, 17.0, -228, { axis: 'x', range: 8, bob: 1.8 });
    B.enemy('grumblin', 6, 18.0, -251, { axis: 'x', range: 6 });
    B.checkpoint(2.5, 18.0, -253);                          // banked before the stairs

    /* --- F: down the stairs into the sea cave ----------------------------- */
    // Six abutting steps. Running down them was 30u of nothing, so the descent
    // now has to be steered: the stars swing you left and right, two grumblins
    // stand in the way to bounce off on the way past, a flapjack crosses the
    // flight, and a stone hangs off the edge over open sea with a 5-star crate
    // on it — a hop out and a hop back onto the step below.
    for (const [z, y] of [[-259, 16.4], [-264, 14.8], [-269, 13.2],
                          [-274, 11.6], [-279, 10.0], [-284, 8.4]])
      B.floor(3, y, z, 9, 5, 'rock');
    B.star(0, 17.8, -259); B.star(6, 16.2, -264); B.star(0, 14.6, -269);
    B.star(6, 13.0, -274); B.star(0, 11.4, -279); B.star(6, 9.8, -284);
    B.enemy('grumblin', 3, 14.8, -264, { axis: 'x', range: 6 });
    B.enemy('grumblin', 3, 10.0, -279, { axis: 'x', range: 6 });
    B.enemy('flapjack', 3, 15.4, -271.5, { axis: 'x', range: 8, bob: 1.4 });
    B.floor(11.5, 9.2, -278, 3.5, 5, 'rock');               // z -280.5 .. -275.5
    B.crate(11.5, 9.2, -278, 'star');

    // The cave ribs are 1.6u fins, not 4u shelves. At 4u wide their tops were a
    // road two steps above the floor that ran the whole length of the gauntlet,
    // and taking it skipped every prickle below.
    B.floor(0, 8.4, -294.5, 12, 16, 'dirt');                // z -286.5 .. -302.5 (abuts)
    B.wall(-6.8, 11.0, -294.5, 1.6, 16, 6, 'rock');
    B.wall(6.8, 11.0, -294.5, 1.6, 16, 6, 'rock');
    B.enemy('prickle', -3, 8.4, -290, {});
    B.enemy('prickle', 3, 8.4, -294, {});
    B.enemy('prickle', -3, 8.4, -298, {});
    B.enemy('grumblin', 3, 8.4, -301, { axis: 'x', range: 5 });
    B.star(3, 9.8, -290);
    B.star(-3, 9.8, -294);
    B.star(3, 9.8, -298);

    B.floor(0, 8.4, -312, 12, 10, 'dirt');                  // z -307 .. -317
    B.wall(-6.8, 11.0, -312, 1.6, 10, 6, 'rock');
    B.wall(6.8, 11.0, -312, 1.6, 10, 6, 'rock');
    B.checkpoint(0, 8.4, -312);
    B.crate(-3, 8.4, -309, 'plain');
    B.crate(3, 8.4, -309, 'plain');
    B.crate(0, 8.4, -315, 'star');

    /* --- G: back out into the daylight ------------------------------------ */
    B.floor(-4, 10.8, -323, 7, 6, 'rock');                  // z -320 .. -326
    B.floor(4, 13.2, -332, 7, 6, 'rock');                   // z -329 .. -335
    B.floor(0, 15.6, -341, 10, 7, 'sand');                  // z -337.5 .. -344.5
    B.starLine(-4, 12.2, -322, 2, [0, 0, -1.6]);
    B.starLine(4, 14.6, -331, 2, [0, 0, -1.6]);

    /* --- H: the windy causeway -------------------------------------------- */
    // A chicane, not a corridor. Five identical slabs on an identical pitch is
    // the same jump five times; these swing wider, narrow as they go and step
    // up and down, so the fourth one is the hardest and none of them is the
    // third one again. The long jump gets a bowed star arc and a flapjack in it.
    B.floor(-3, 15.6, -350, 4.5, 6, 'sand');                // z -347 .. -353
    B.floor(3, 16.8, -359, 4, 6, 'sand');                   // z -356 .. -362  +1.2
    B.floor(-4, 15.6, -368, 3.5, 6, 'sand');                // z -365 .. -371  -1.2
    B.floor(4, 17.2, -377.5, 3.5, 5, 'sand');               // z -380 .. -375  +1.6, the long one
    B.floor(-3, 15.6, -387, 5, 7, 'sand');                  // z -390.5 .. -383.5
    B.star(-3, 17.0, -350);
    B.star(3, 18.2, -359);
    B.star(-4, 17.0, -368);
    B.starLine(-2.5, 17.6, -371.5, 4, [1.8, 0, -1.2], 1.6); // over the long gap
    B.star(-3, 17.0, -387);
    B.enemy('flapjack', 0, 17.6, -355, { axis: 'x', range: 7, bob: 1.6 });
    B.enemy('flapjack', 0, 18.8, -373, { axis: 'x', range: 7, bob: 1.6 });
    B.enemy('flapjack', 0, 17.6, -383, { axis: 'x', range: 7, bob: 1.6 });

    B.floor(0, 15.6, -396, 11, 8, 'sand');                  // z -392 .. -400
    B.checkpoint(0, 15.6, -393);                            // after the causeway, not before
    B.crate(-3, 15.6, -395, 'plain');
    B.crate(3, 15.6, -395, 'plain');
    B.crate(0, 15.6, -398, 'life');

    // the flock: a 6u gap with three flapjacks and a star arc across it
    B.floor(0, 15.6, -410, 9, 8, 'sand');                   // z -406 .. -414
    B.starLine(0, 16.6, -401, 5, [0, 0, -1.2], 1.6);
    B.enemy('flapjack', -2, 17.4, -403, { bob: 1.4 });
    B.enemy('flapjack', 2, 17.8, -404.5, { bob: 1.6 });
    B.enemy('flapjack', 0, 18.4, -402, { axis: 'x', range: 5, bob: 1.2 });

    /* --- I: the crumbling arch -------------------------------------------- */
    // Up one side, a crate on the crown, and a run back down the other.
    B.floor(0, 18.0, -420, 6, 6, 'rock');                   // z -417 .. -423
    B.floor(0, 20.4, -428, 6, 5, 'rock');                   // z -425.5 .. -430.5
    B.floor(0, 22.8, -436, 6, 5, 'rock');                   // z -433.5 .. -438.5
    B.floor(0, 24.0, -444, 9, 8, 'rock');                   // the crown, z -440 .. -448
    // The way down is NOT the way up mirrored — the blocks step sideways, so
    // you steer the descent instead of falling down three of the same block.
    B.floor(3, 21.6, -453, 6, 5, 'rock');                   // z -450.5 .. -455.5
    B.floor(-3, 19.2, -461, 6, 5, 'rock');                  // z -458.5 .. -463.5
    B.floor(0, 16.8, -469, 9, 6, 'rock');                   // z -466 .. -472
    B.star(0, 19.4, -420);
    B.star(0, 21.8, -428);
    B.star(0, 24.2, -436);
    B.starLine(-3, 25.4, -442, 3, [0, 0, -2.0]);            // off the crate at x=0
    B.crate(0, 24.0, -444, 'star');
    B.enemy('prickle', 3, 24.0, -445, {});
    B.enemy('flapjack', 0, 22.4, -457, { axis: 'x', range: 8, bob: 1.6 });
    B.star(3, 23.0, -453);
    B.star(-3, 20.6, -461);
    B.starLine(0, 18.2, -468, 2, [0, 0, -1.8]);

    /* --- J: the crate pyramid + checkpoint --------------------------------- */
    B.floor(0, 16.8, -480, 14, 12, 'sand');                 // z -474 .. -486
    B.checkpoint(0, 16.8, -480);
    B.crateRow(-1.9, 16.8, -483, 3, 'plain', [1.9, 0, 0]);
    B.crate(-0.95, 18.6, -483, 'plain');
    B.crate(0.95, 18.6, -483, 'plain');
    B.crate(0, 20.4, -483, 'star');                         // the capstone
    B.starLine(0, 18.2, -476, 2, [0, 0, -1.6]);
    B.tree(-6.4, 16.8, -477, .8);

    /* --- K: the lighthouse approach ---------------------------------------- */
    B.floor(0, 16.8, -494, 12, 12, 'rock');                 // z -488 .. -500
    B.enemy('grumblin', 0, 16.8, -496, { axis: 'x', range: 6 });
    B.starLine(0, 18.2, -490, 2, [0, 0, -1.8]);
    // The second dare. "Two stones out to sea for a star crate" was already
    // spent at the tide pools, so this one is vertical: the high stone sits
    // 5.2u up, which no jump off this shelf reaches. The springboard is the
    // only door, and the payoff is the only thing standing on it.
    B.crate(5, 16.8, -497, 'spring');
    B.floor(10, 22.0, -499, 4, 4, 'rock');                  // z -501 .. -497
    B.crate(10, 22.0, -499, 'star');
    B.starLine(6.2, 20.0, -497.6, 3, [0.9, 1.15, -0.3]);    // up the bounce

    B.floor(0, 16.8, -508, 10, 8, 'rock');                  // z -504 .. -512
    B.floor(-4, 16.8, -518, 5, 8, 'rock');                  // z -514 .. -522
    B.floor(4, 16.8, -528, 5, 8, 'rock');                   // z -524 .. -532
    B.starLine(-4, 18.2, -516, 2, [0, 0, -1.8]);
    B.starLine(4, 18.2, -526, 2, [0, 0, -1.8]);
    B.enemy('prickle', -4, 16.8, -520, {});

    // The ferry. The pier already spent "slider, slider, slider-that-lifts", so
    // this is the other thing a mover can be: one platform that travels 10u
    // ALONG the level and rises to lighthouse height on the way. 21u of open
    // water, no jump crosses it, you get on and you wait — which is a change of
    // rhythm right before the climb, not a fourth slider.
    B.mover(0, 16.8, -538, 6, 6, 1, [0, 20.4, -548], 6.0);
    B.star(0, 18.2, -538);
    B.star(0, 21.8, -548);

    /* --- L: up the lighthouse --------------------------------------------- */
    // The finale was the SOFTEST part of the level — 8x8 slabs on 2.0 steps,
    // every hop under a third of the jump arc, after a causeway that asked for
    // three quarters of it. So the spiral is now 6x5 ledges, every step +2.4
    // (a double jump, no exceptions), gaps 4.5 -> 5 -> 5 tightening as you go
    // round, 40u of open sea under all of it, and a flapjack working the dark
    // side of the tower. The grumblin moved down to the rock, where there is
    // actually room to fight it.
    B.floor(0, 20.4, -558, 12, 10, 'rock');                 // the rock, z -553 .. -563
    B.checkpoint(0, 20.4, -555);                            // the last 100u ran unchecked
    B.enemy('grumblin', 0, 20.4, -560, { axis: 'x', range: 8 });
    B.floor(-8, 22.8, -570, 6, 5, 'rock');                  // z -572.5 .. -567.5
    B.floor(-8, 25.2, -580, 6, 5, 'rock');                  // z -582.5 .. -577.5
    B.floor(0, 27.6, -590, 6, 5, 'rock');                   // z -592.5 .. -587.5
    B.floor(7, 30.0, -580.5, 6, 7, 'rock');                 // z -584 .. -577, abuts the tower
    B.wall(0, 32.4, -579, 8, 8, 42, 'rock');                // the tower, out of the sea
    B.crate(-8, 25.2, -581, 'life');                        // back corner, off the jump line
    B.enemy('flapjack', -8, 25.0, -575, { axis: 'x', range: 6, bob: 1.6 });
    B.starLine(-8, 24.2, -569, 2, [0, 0, -1.8]);
    B.starLine(-8, 26.6, -578, 2, [0, 0, -1.8]);
    B.starLine(0, 29.0, -589, 2, [0, 0, -1.8]);
    B.starLine(7, 31.4, -579, 2, [0, 0, -1.8]);
    B.goal(0, 32.4, -579);

    // Distant palms on the far shore, at sea level and never solid.
    for (let tz = 8; tz > -590; tz -= 26) {
      B.tree(-33 + (tz % 5), -11, tz, 1.9, false);
      B.tree(34 + (tz % 7), -11, tz + 9, 2.2, false);
    }
  },
},

{
  id: 'frost', name: 'Frostfizz Peaks', world: 1,
  sky: [0x8ec7ee, 0xffffff], fog: [0xe4f3ff, 28, 125],
  sun: 0xffffff, sunDir: [-0.4, 1, 0.55], amb: 0x46586e,
  camYaw: 0, start: [0, 1, 12],
  hint: 'Blue crates are springboards — bounce off one, then DOUBLE JUMP at the top to clear the cliff!',
  build(B) {
    // The snowfield far below. Not solid — a fall still kills, it just ends in
    // white instead of nothing.
    B.ground(-24, 'ice');
    // Almost no trees: pines only survive down at the snow line, and only as
    // backdrop. Rows 20u apart in z, never solid, always at the world floor.
    for (const z of [14, -6, -26, -46, -66]) {
      for (const x of [-30, -44, 30, 44]) B.tree(x + ((z * 3) % 7) - 3, -24, z + (x % 5), 1.8, false);
    }

    /* --- A: the gentle snowy approach ------------------------------------ */
    B.floor(0, 0, 2, 14, 32, 'ice');                        // z 18 .. -14
    B.starLine(0, 1.2, 9, 5, [0, 0, -2.4]);                 // z 9 .. -0.6
    B.enemy('grumblin', -2.5, 0, -1, { axis: 'x', range: 7 });
    B.enemy('grumblin', 3, 0, -8, { axis: 'x', range: 6 });
    B.crateRow(-3.2, 0, -12, 3, 'plain', [2.1, 0, 0]);
    B.wall(-8.6, 2.4, 8, 3.4, 7, 4, 'rock');                // rock outcrops, not trees
    B.wall(8.6, 2.4, -4, 3.4, 7, 4, 'rock');

    /* --- B: ice bridges over the chasm -----------------------------------
       The slabs get NARROWER and the gaps get WIDER as you cross: 3.5, 3.25,
       3.75, 4.25, 3.75. Four identical 4.5u gaps made the level's very first
       jump its widest one, which is the ramp upside down. */
    B.floor(0, 0, -21, 6, 7, 'ice');                        // z -17.5 .. -24.5
    B.floor(3.5, 0, -31, 6, 6.5, 'ice');                    // z -27.75 .. -34.25
    B.floor(-3.5, 0, -41, 6, 6, 'ice');                     // z -38 .. -44
    B.floor(0, 0, -51, 5.5, 5.5, 'ice');                    // z -48.25 .. -53.75
    B.starLine(0, 1.5, -14.5, 3, [0, 0, -1.2], 1.1);
    B.starLine(1.2, 1.5, -25, 3, [0.9, 0, -1.1], 1.1);
    B.starLine(2.3, 1.5, -34.7, 3, [-1.9, 0, -1.2], 1.1);
    B.starLine(-2.6, 1.5, -44.5, 3, [1.0, 0, -1.3], 1.1);
    B.enemy('flapjack', 0, 2.8, -26, { axis: 'x', range: 7, bob: 1.4 });
    B.enemy('flapjack', 0, 2.8, -46, { axis: 'x', range: 7, bob: 1.4 });

    /* --- C: the far ledge, checkpoint 1 ---------------------------------- */
    B.floor(0, 0, -61.5, 12, 8, 'ice');                     // z -57.5 .. -65.5
    B.checkpoint(0, 0, -61.5);
    B.wall(-8.5, 2.6, -61.5, 3, 8, 4, 'rock');
    B.wall(8.5, 2.6, -61.5, 3, 8, 4, 'rock');

    /* --- D: spring-crate launch up the cliff face ------------------------ */
    B.floor(0, 0, -73, 10, 8, 'ice');                       // z -69 .. -77
    B.crate(0, 0, -74, 'spring');
    B.crate(-3.6, 0, -71, 'plain');
    B.crate(3.6, 0, -71, 'plain');
    B.starLine(0, 3.0, -75.5, 4, [0, 1.0, -1.0]);           // the spring's arc
    B.floor(0, 6.2, -84, 9, 7, 'rock');                     // 6.2 up: spring only
    B.floor(-4, 8.6, -93, 7, 6, 'rock');                    // z -96 .. -90
    B.starLine(-4, 10.0, -92, 3, [0, 0, -1.6]);

    /* --- E: the chairlift. Movers that slide AND rise -------------------- */
    B.mover(-4, 8.6, -102, 5, 5, 1, [4, 12.0, -102], 5);
    B.mover(4, 12.0, -111, 5, 5, 1, [-4, 15.4, -111], 5.4);
    B.mover(-4, 15.4, -120, 5, 5, 1, [4, 18.8, -120], 5.8);
    B.star(-4, 10.0, -102); B.star(4, 13.4, -102);
    B.star(4, 13.4, -111);  B.star(-4, 16.8, -111);
    B.star(-4, 16.8, -120); B.star(4, 20.2, -120);
    B.enemy('flapjack', 0, 14.2, -106, { axis: 'x', range: 8, bob: 1.6 });
    B.floor(4, 18.8, -129, 12, 8, 'rock');                  // z -125 .. -133
    B.checkpoint(4, 18.8, -129);                            // checkpoint 2 — top of the lift

    /* --- F: the wind tunnel. Narrow slabs, snowbirds over the gaps -------
       5-wide, two birds: this is where narrow slabs are TAUGHT. The 5-wide
       version with three birds is the last gauntlet (Q), 350u later. */
    B.floor(1, 18.8, -138, 5, 6, 'ice');                    // z -135 .. -141
    B.floor(7, 18.8, -148.5, 5, 6, 'ice');                  // z -145.5 .. -151.5
    B.floor(1, 18.8, -159, 5, 6, 'ice');                    // z -156 .. -162
    B.floor(7, 18.8, -169.5, 5, 6, 'ice');                  // z -166.5 .. -172.5
    B.wall(-3.4, 20.9, -138, 2.2, 7, 3, 'rock');
    B.wall(11.4, 20.9, -148.5, 2.2, 7, 3, 'rock');
    B.wall(-3.4, 20.9, -159, 2.2, 7, 3, 'rock');
    B.wall(11.4, 20.9, -169.5, 2.2, 7, 3, 'rock');
    B.starLine(2.5, 20.2, -142, 3, [1.3, 0, -1.2], 1.0);
    B.starLine(5.5, 20.2, -152.5, 3, [-1.3, 0, -1.2], 1.0);
    B.starLine(2.5, 20.2, -163, 3, [1.3, 0, -1.2], 1.0);
    B.enemy('flapjack', 4, 20.8, -143, { axis: 'x', range: 7, bob: 1.5 });
    B.enemy('flapjack', 4, 20.8, -164.5, { axis: 'x', range: 7, bob: 1.5 });

    /* --- G: the frozen spike field, funnelled by rock -------------------- */
    B.floor(4, 18.8, -183, 14, 16, 'ice');                  // z -175 .. -191
    B.wall(-4.6, 21.8, -183, 2.2, 16, 3, 'rock');
    B.wall(12.6, 21.8, -183, 2.2, 16, 3, 'rock');
    B.enemy('prickle', 0, 18.8, -178, {});
    B.enemy('prickle', 7.5, 18.8, -180.5, {});
    B.enemy('prickle', 1.5, 18.8, -184, {});
    B.enemy('prickle', 8.5, 18.8, -187, {});
    B.enemy('grumblin', 4, 18.8, -189.5, { axis: 'x', range: 8 });
    B.starLine(4, 20.2, -177, 4, [0, 0, -2.4]);             // z -177 .. -184.2

    /* --- H: checkpoint 3, and a fork. The risky side pays 5 --------------
       The second stepping stone hangs 3u out over the chasm, so the 5-star
       crate costs a jump out and a jump back. Parked next to the ledge it
       was free money, which is not a fork. */
    B.floor(4, 18.8, -198, 12, 10, 'ice');                  // z -193 .. -203
    B.checkpoint(4, 18.8, -198);
    B.floor(-5, 20.0, -199, 4, 4, 'ice');                   // x -7 .. -3
    B.floor(-12, 21.2, -204, 4, 4, 'ice');                  // x -14 .. -10, 3u of air between
    B.star(-5, 21.4, -199);
    B.star(-8.5, 22.6, -202);                               // marks the jump out
    B.crate(-12, 21.2, -204, 'star');
    B.floor(4, 18.8, -209, 10, 8, 'ice');                   // z -205 .. -213

    /* --- I: the ferry. The one platform in the level that travels in Z ----
       The chairlift (E) was three movers sliding sideways and rising; doing
       that again with different numbers is the same beat twice. This one
       carries you FORWARD down the level, you ride it out and back to raid a
       perch hanging over the void, and the stars are strung along the ride so
       standing still costs you. */
    B.mover(4, 18.8, -218, 6, 6, 1, [4, 18.8, -230], 6.4);
    B.star(4, 20.2, -218); B.star(4, 20.2, -224); B.star(4, 20.2, -230);
    B.enemy('flapjack', 4, 21.0, -225, { axis: 'x', range: 6, bob: 1.4 });
    B.floor(-6, 18.8, -230, 5, 5, 'ice');                   // the raid: 4.5u off the ferry
    B.crate(-6, 18.8, -230, 'star');
    B.star(-1, 20.2, -230);
    B.mover(4, 18.8, -238, 5, 5, 1, [6, 23.4, -238], 5.4);  // the lift onto the shoulder
    B.floor(6, 23.4, -246, 12, 9, 'rock');                  // z -241.5 .. -250.5
    B.checkpoint(6, 23.4, -246);                            // checkpoint 4 — after the movers

    /* --- J: the shoulder. A wide arena, three enemies at once ------------ */
    B.floor(6, 23.4, -263, 20, 20, 'ice');                  // z -253 .. -273
    B.wall(-5.6, 26.4, -263, 2.2, 20, 3, 'rock');
    B.wall(17.6, 26.4, -263, 2.2, 20, 3, 'rock');
    B.enemy('grumblin', 1, 23.4, -257, { axis: 'x', range: 8 });
    B.enemy('grumblin', 10, 23.4, -266, { axis: 'x', range: 9 });
    B.enemy('prickle', 5, 23.4, -261, {});
    B.starLine(6, 24.8, -255, 4, [0, 0, -2.2]);             // z -255 .. -261.6
    B.crateRow(-1, 23.4, -270, 4, 'plain', [2.1, 0, 0]);
    B.crate(12, 23.4, -270, 'life');

    /* --- K: the crate pyramid -------------------------------------------- */
    B.floor(6, 23.4, -281, 12, 12, 'ice');                  // z -275 .. -287
    B.crateRow(3.9, 23.4, -281, 3, 'plain', [2.1, 0, 0]);
    B.crateRow(4.95, 25.2, -281, 2, 'plain', [2.1, 0, 0]);
    B.crate(6.0, 27.0, -281, 'star');

    /* --- L: the long descent -------------------------------------------
       Was six identical steps over 51u — the exact "longer corridor" the
       rebuild exists to kill. Same downhill run, but step three splits into
       two narrow slabs (pick a side at speed), a stash hangs off the side of
       step four, and a snowbird crosses the lane you are sprinting down. */
    B.floor(6, 21.4, -292, 10, 6, 'ice');                   // z -289 .. -295
    B.floor(6, 19.4, -301, 10, 6, 'ice');                   // z -298 .. -304
    B.floor(2, 17.4, -310, 5, 6, 'ice');                    // the split: x -0.5 .. 4.5
    B.floor(10, 17.4, -310, 5, 6, 'ice');                   // x 7.5 .. 12.5, 3u of air between
    B.floor(6, 15.4, -319, 10, 6, 'ice');                   // z -316 .. -322
    B.floor(-5, 15.4, -319, 5, 5, 'ice');                   // the stash, 3.5u out over the drop
    B.crate(-5, 15.4, -319, 'star');
    B.floor(6, 13.4, -328, 10, 6, 'ice');                   // z -325 .. -331
    B.floor(6, 11.4, -337, 10, 6, 'ice');                   // z -334 .. -340
    B.starLine(6, 22.8, -292, 2, [0, -2, -9]);
    B.star(2, 18.8, -310); B.star(10, 18.8, -310);          // both sides of the split pay
    B.star(-1, 16.8, -319);                                 // marks the hop to the stash
    B.starLine(6, 16.8, -319, 3, [0, -2, -9]);
    B.enemy('flapjack', 6, 21.0, -297, { axis: 'x', range: 9, bob: 1.2 });
    B.enemy('grumblin', 6, 19.4, -301, { axis: 'x', range: 6 });
    B.enemy('grumblin', 6, 13.4, -328, { axis: 'x', range: 6 });
    B.enemy('prickle', 9.2, 11.4, -337, {});                // off the fast line; punishes drift

    /* --- M: checkpoint 5, then the split ---------------------------------
       Was a third zig-zag chicane (after F and Q) with a spike parked on the
       edge of a 4-wide slab you land on blind. Now it is a real choice that
       runs for 35u: a wide low lane you can fight your way down, or a narrow
       line of stones climbing over the void with the 5-star crate on it.
       Both lanes come out on the same ledge, so picking wrong costs nothing
       but stars. */
    B.floor(6, 11.4, -348, 14, 12, 'ice');                  // z -342 .. -354
    B.checkpoint(6, 11.4, -348);                            // checkpoint 5
    // the safe lane: two wide ice legs, one 4u gap, a patroller and a spike
    B.floor(1, 11.4, -363, 7, 14, 'ice');                   // x -2.5 .. 4.5, z -356 .. -370
    B.floor(1, 11.4, -381, 7, 14, 'ice');                   // x -2.5 .. 4.5, z -374 .. -388
    B.enemy('grumblin', 1, 11.4, -362, { axis: 'x', range: 5 });
    B.enemy('prickle', 2.8, 11.4, -380, {});                // 5u of clear lane beside it
    B.starLine(1, 12.8, -358, 4, [0, 0, -2.6]);
    B.starLine(1, 12.8, -369.5, 3, [0, 0, -1.6], 0.9);      // the arc over the gap
    B.starLine(1, 12.8, -377, 4, [0, 0, -2.6]);
    // the star lane: four stones climbing over the chasm, the 5-crate on top
    B.floor(11, 13.6, -359, 5, 6, 'ice');                   // x 8.5 .. 13.5, z -356 .. -362
    B.floor(11, 15.8, -368, 5, 6, 'ice');                   // z -365 .. -371
    B.floor(11, 15.8, -377, 5, 6, 'ice');                   // z -374 .. -380
    B.floor(11, 13.6, -386, 5, 6, 'ice');                   // z -383 .. -389
    B.crate(12.5, 15.8, -377, 'star');
    B.star(11, 15.0, -359); B.star(11, 17.2, -368);
    B.star(9.6, 17.2, -377); B.star(11, 15.0, -386);
    B.starLine(11, 17.0, -363.5, 3, [0, 0, -1.2], 0.8);
    B.enemy('flapjack', 11, 17.4, -372.5, { axis: 'x', range: 5, bob: 1.3 });

    /* --- N: the second spring, up onto the summit ridge ------------------ */
    B.floor(10, 11.4, -397, 12, 10, 'ice');                 // z -392 .. -402
    B.crate(10, 11.4, -398, 'spring');
    B.starLine(10, 14.4, -399.5, 4, [0, 1.0, -1.0]);
    B.floor(10, 17.6, -408, 10, 8, 'rock');                 // z -404 .. -412
    B.crateRow(6.5, 17.6, -409, 3, 'plain', [2.1, 0, 0]);
    B.crate(14, 17.6, -406, 'star');

    /* --- O: the summit arena ---------------------------------------------
       J was already "flat plateau, two grumblins and a spike, walled in rock".
       This one goes vertical: three ice pillars up the middle. The stars and
       the 1-UP are all up on them, and the tall pillar is 4.4u — over the
       double jump, so it can only be taken by climbing the short one first
       while the ground patrols hunt you. The floor is the safe way through;
       the climb is the paid one. */
    B.floor(10, 17.6, -426, 18, 24, 'ice');                 // z -414 .. -438
    B.wall(-0.6, 20.6, -426, 2.2, 24, 3, 'rock');
    B.wall(20.6, 20.6, -426, 2.2, 24, 3, 'rock');
    B.box(10, 19.8, -419, 4, 4, 2.2, 'ice');                // x 8 .. 12, the step up
    B.box(10, 22.0, -427, 4, 4, 4.4, 'ice');                // the tall one
    B.box(10, 19.8, -435, 4, 4, 2.2, 'ice');                // and back down
    B.crate(10, 22.0, -427, 'life');
    B.star(10, 21.2, -419); B.star(10, 21.2, -435);
    B.starLine(10, 19.0, -414.5, 2, [0, 0, -1.8]);
    B.enemy('grumblin', 4, 17.6, -419, { axis: 'x', range: 6 });   // lanes clear of the pillars
    B.enemy('grumblin', 16, 17.6, -430, { axis: 'x', range: 6 });
    B.enemy('prickle', 14, 17.6, -434, {});
    B.enemy('flapjack', 10, 20.4, -431, { axis: 'x', range: 10, bob: 1.4 });

    /* --- P: the ice elevator, and a narrow ledge over the drop ----------- */
    B.mover(10, 17.6, -444, 6, 6, 1, [10, 22.6, -444], 5.2);
    B.floor(10, 22.6, -453, 6, 6, 'rock');                  // z -456 .. -450
    B.floor(4, 22.6, -462, 6, 6, 'rock');                   // z -465 .. -459
    B.starLine(7, 24.0, -457, 3, [-1.0, 0, -1.0], 1.0);
    B.floor(6, 22.6, -474, 14, 12, 'ice');                  // z -468 .. -480
    B.checkpoint(6, 22.6, -474);                            // checkpoint 6 — before the gauntlet

    /* --- Q: the last gauntlet --------------------------------------------
       Was seven identical slabs on a 9 pitch across 74u — one idea repeated
       until it stopped being an idea. Now it is three movements: three
       zig-zag slabs with birds over the gaps, then a springboard fired
       SIDEWAYS across the chasm onto a perch 4.8u up (double jump tops out at
       4.08 — the spring is the only way over), then the long drop back down
       to the finish line. */
    B.floor(6, 22.6, -487, 5, 6, 'ice');                    // z -484 .. -490
    B.floor(11, 22.6, -496, 5, 6, 'ice');                   // z -493 .. -499
    B.floor(6, 22.6, -505, 5, 6, 'ice');                    // z -502 .. -508
    B.enemy('prickle', 4.7, 22.6, -487, {});                // lands you on the open side
    B.enemy('prickle', 12.3, 22.6, -496, {});
    B.enemy('flapjack', 8.5, 24.8, -492, { axis: 'x', range: 6, bob: 1.5 });
    B.enemy('flapjack', 8.5, 24.8, -501, { axis: 'x', range: 6, bob: 1.5 });
    B.starLine(8, 24.0, -491.5, 3, [1.0, 0, -1.0], 1.0);
    B.starLine(9, 24.0, -500.5, 3, [-1.0, 0, -1.0], 1.0);
    // the launch pad and the perch it throws you onto
    B.floor(6, 22.6, -515, 7, 7, 'ice');                    // x 2.5 .. 9.5, z -511.5 .. -518.5
    B.crate(6, 22.6, -516, 'spring');
    B.enemy('prickle', 8.3, 22.6, -517, {});                // overshoot the landing, wear it
    B.starLine(6, 25.2, -517, 5, [0, 0.7, -1.2]);           // the whole bounce, onto the ledge
    B.floor(6, 27.4, -526, 7, 6, 'rock');                   // +4.8: spring only, z -523 .. -529
    B.crate(9, 27.4, -526, 'star');
    // and the drop home
    B.starLine(7.5, 26.0, -531, 3, [1.0, -0.6, -1.0]);
    B.floor(11, 22.6, -538, 5, 8, 'ice');                   // x 8.5 .. 13.5, z -534 .. -542
    B.enemy('flapjack', 9, 25.6, -531, { axis: 'x', range: 6, bob: 1.4 });
    B.starLine(10, 24.0, -543, 3, [-0.7, 0, -1.0], 0.9);
    B.floor(8, 22.6, -552, 14, 12, 'ice');                  // z -546 .. -558
    B.checkpoint(8, 22.6, -552);                            // checkpoint 7 — the gauntlet is banked

    /* --- R: the switchback. The path doubles back on itself as it climbs -- */
    B.floor(2, 22.6, -566, 16, 7, 'ice');                   // z -562.5 .. -569.5
    B.enemy('grumblin', 2, 22.6, -566, { axis: 'x', range: 12 });
    B.starLine(-4, 24.0, -566, 4, [2.2, 0, 0]);
    B.floor(-6, 25.0, -576, 8, 8, 'rock');                  // the hairpin, x -10 .. -2
    B.crate(-6, 25.0, -577, 'plain');
    B.floor(6, 27.4, -586, 16, 7, 'rock');                  // z -582.5 .. -589.5
    B.enemy('grumblin', 6, 27.4, -586, { axis: 'x', range: 12 });
    B.starLine(0, 28.8, -586, 4, [2.2, 0, 0]);

    /* --- S: the summit. Two rock steps, one last spring, the peak -------- */
    B.floor(8, 29.8, -596, 9, 8, 'rock');                   // z -592 .. -600
    B.floor(8, 32.2, -606, 8, 8, 'rock');                   // z -602 .. -610
    B.crate(8, 32.2, -606, 'spring');
    B.starLine(8, 34.8, -607.5, 4, [0, 0.9, -1.0]);
    B.floor(8, 37.0, -615, 12, 10, 'ice');                  // z -610 .. -620
    B.crate(4, 37.0, -613, 'star');
    B.crate(12, 37.0, -613, 'life');
    B.starLine(8, 38.4, -612, 3, [0, 0, -1.6]);
    B.goal(8, 37.0, -617);
  },
},

{
  id: 'reef', name: 'Sunken Reef', world: 2, mode: 'swim', ceilY: 26,
  sky: [0x03323d, 0x0b7d8a], fog: [0x0a5b6a, 12, 92],
  sun: 0x7fc9c6, sunDir: [-0.35, 1, 0.4], amb: 0x0c2f38,
  camYaw: 0, camOff: [0, 5.4, 13], start: [0, 3, 14],
  hint: 'Underwater! Tap SPACE over and over to swim UP.',
  build(B) {
    // Swim mode: gravity is 11, you sink at 6.5 and every tap is another 8.6
    // upward, so height is free. This level is therefore built as a VOLUME —
    // the reef wall you go over, the shelf you go down through, the tower you
    // go up inside — and ceilY 26 is the water surface that keeps it a level.
    B.ground(-12, 'sand');                                   // the deep sand, 12u down

    // Kelp beds out on the sand either side. Never solid, always at the world
    // floor, rows 20u apart so a 600u level isn't 300 meshes of seaweed.
    for (let z = 6; z > -616; z -= 20) {
      for (const x of [-27, 29]) {
        const s = 1.3 + ((Math.abs(x) * 3 + Math.abs(z) * 5) % 9) / 7;   // 1.3 .. 2.5
        B.tree(x + ((z * 3) % 7) - 3, -12, z + (x % 5), s, false);
      }
    }

    /* --- A: the sandbank. Learn the stroke ------------------------------- */
    B.floor(0, 0, 2, 16, 24, 'sand');                        // z 14 .. -10
    B.starLine(0, 2.2, 10, 3, [0, 0, -2.4]);
    B.starLine(0, 3.0, -2, 3, [0, 1.4, -1.9]);               // rises: tap to follow it
    B.crate(-4.5, 0, -6, 'plain');
    B.crate(4.5, 0, -6, 'plain');
    B.enemy('flapjack', 0, 4.2, -6, { axis: 'x', range: 7, bob: 1.4 });

    /* --- B: over the reef wall ------------------------------------------- */
    B.wall(0, 9, -18, 22, 4, 9, 'rock');                     // y 0..9, z -20 .. -16
    B.starLine(0, 10.5, -14, 3, [0, 0, -3.0], 2.6);          // arc over the top
    B.floor(0, 1.2, -28, 14, 12, 'sand');                    // z -34 .. -22
    B.enemy('grumblin', 0, 1.2, -28, { axis: 'x', range: 6 });
    B.starLine(-4, 2.6, -25, 2, [0, 0, -2.2]);
    B.crate(5, 1.2, -26, 'star');

    /* --- C: coral pillars, a staircase you swim up ----------------------- */
    B.box(-5, 3.5, -40, 5, 5, 4.0, 'rock');
    B.box(4, 7.0, -47, 5, 5, 7.5, 'rock');
    B.box(-4, 10.5, -54, 5, 5, 11.0, 'rock');
    B.box(5, 14.0, -61, 5, 5, 14.5, 'rock');
    B.star(-5, 5.1, -40);
    B.star(4, 8.6, -47);
    B.star(-4, 12.1, -54);
    B.star(5, 15.6, -61);
    B.enemy('jelly', 0, 8, -44, { bob: 3.2 });
    B.enemy('jelly', 0, 11, -51, { bob: 3.6 });
    // A staircase with 12u of open water above it is not a staircase — you rise
    // past the lot. An overhang keeps the climb in the pillars where it belongs.
    B.roof(0, 22, -51, 26, 30, 4, 'rock');                   // overhang: y 18 .. 22

    /* --- D: a shelf with a hole in it. Go DOWN ---------------------------- */
    B.floor(-8, 12, -76, 10, 16, 'rock');                    // x -13 .. -3
    B.floor(8, 12, -76, 10, 16, 'rock');                     // x 3 .. 13 — the hole is x -3..3
    B.enemy('prickle', -8, 12, -71, {});
    B.enemy('prickle', 8, 12, -73, {});
    B.floor(0, 1.5, -76, 14, 14, 'sand');                    // the chamber below
    B.starLine(0, 10.5, -74, 3, [0, -2.8, -1.3]);            // down through the hole
    B.crateRow(-3.2, 1.5, -80, 3, 'plain', [2.1, 0, 0]);
    B.crate(-5.5, 1.5, -72, 'life');
    B.checkpoint(8, 12, -80);

    /* --- E: the jelly corridor ------------------------------------------- */
    B.floor(0, 2.4, -102, 11, 24, 'sand');                   // z -114 .. -90
    B.wall(-6.5, 12, -102, 2, 24, 10, 'rock');
    B.wall(6.5, 12, -102, 2, 24, 10, 'rock');
    B.starLine(0, 5.4, -92, 4, [0, 0, -6.0]);
    B.enemy('jelly', -2.5, 7, -95, { bob: 3.6 });
    B.enemy('jelly', 2.5, 8, -102, { bob: 4.0 });
    B.enemy('jelly', -2, 6.5, -109, { bob: 3.2 });

    /* --- F: the wreck, and the alcove beside it -------------------------- */
    B.box(0, 6, -132, 12, 26, 6, 'metal');                   // hull deck at y=6
    B.wall(-2, 16, -126, 1.4, 1.4, 10, 'metal');             // masts
    B.wall(2, 15, -138, 1.4, 1.4, 9, 'metal');
    B.crateRow(-4.2, 6, -122, 2, 'plain', [2.1, 0, 0]);
    B.crate(4, 6, -122, 'plain');
    B.enemy('prickle', -3, 6, -134, {});
    B.enemy('prickle', 3, 6, -140, {});
    B.starLine(0, 7.6, -128, 3, [0, 0, -3.4]);
    B.floor(-14, 1.0, -132, 8, 12, 'sand');                  // bonus alcove on the sand
    B.starLine(-13, 2.6, -127, 2, [0, 0, -2.0]);
    B.crate(-16, 1.0, -134, 'star');
    B.enemy('jelly', -10, 5, -132, { bob: 3.0 });

    /* --- G: the arches ---------------------------------------------------- */
    B.floor(0, 0, -169, 26, 36, 'sand');                     // z -187 .. -151
    B.box(-6, 8, -156, 3, 4, 8, 'rock');
    B.box(6, 8, -156, 3, 4, 8, 'rock');
    B.box(0, 11, -156, 15, 4, 3, 'rock');
    B.star(0, 4, -156);
    B.box(-9, 9, -168, 3, 4, 9, 'rock');
    B.box(3, 9, -168, 3, 4, 9, 'rock');
    B.box(-3, 12, -168, 15, 4, 3, 'rock');
    B.star(-3, 4.5, -168);
    B.box(-2, 9.5, -180, 3, 4, 9.5, 'rock');
    B.box(10, 9.5, -180, 3, 4, 9.5, 'rock');
    B.box(4, 12.5, -180, 15, 4, 3, 'rock');
    B.star(4, 5, -180);
    B.starLine(-6, 8.0, -160, 4, [2.0, -0.6, -1.8]);         // weaves down into arch two
    // The arches only mean anything if you have to go THROUGH one. The shelf
    // hangs at 13.5, so the two low crowns (11) still leave a swimmable slot
    // over the top and the tall one (12.5) does not — some you thread, some you
    // skim, which is a choice rather than a corridor.
    B.roof(0, 17.5, -169, 26, 36, 4, 'rock');                // shelf: y 13.5 .. 17.5
    B.enemy('grumblin', -6, 0, -174, { axis: 'x', range: 8 });
    B.enemy('grumblin', 6, 0, -184, { axis: 'x', range: 7 });
    B.checkpoint(0, 0, -185);                                // 134u from the last one otherwise

    /* --- H: the chimney. Straight up ------------------------------------- */
    B.box(-6, 3, -192, 6, 6, 3, 'rock');
    B.box(4, 7, -196, 6, 6, 7, 'rock');
    B.box(-5, 11, -200, 6, 6, 11, 'rock');
    B.box(5, 15, -204, 6, 6, 15, 'rock');
    B.box(-4, 19, -206, 6, 6, 19, 'rock');
    B.star(-6, 4.6, -192);
    B.star(4, 8.6, -196);
    B.star(-5, 12.6, -200);
    B.star(5, 16.6, -204);
    B.star(-4, 20.6, -206);
    B.enemy('jelly', 0, 10, -198, { bob: 5.0 });
    B.floor(0, 21, -214, 14, 10, 'rock');                    // z -219 .. -209
    B.checkpoint(0, 21, -214);
    B.crate(-4, 21, -217, 'plain');
    B.crate(4, 21, -217, 'life');

    /* --- I: the mover chain over the deep -------------------------------- */
    B.mover(-6, 21, -224, 6, 6, 1.2, [6, 21, -224], 5.0);
    B.mover(6, 21, -232, 6, 6, 1.2, [-6, 21, -232], 5.4);
    B.mover(0, 21, -240, 6, 6, 1.2, [0, 14, -240], 6.0);     // this one drops as well
    B.star(0, 22.6, -224);
    B.star(0, 22.6, -232);
    B.enemy('jelly', 0, 12, -228, { bob: 4.0 });
    B.enemy('jelly', -4, 13, -236, { bob: 4.5 });
    B.floor(0, 14, -250, 14, 12, 'rock');                    // z -256 .. -244

    /* --- J: the sentry drop. Wait for the sweep, then dive --------------- */
    // Was five identical shelves you could just fall down: 40u where nothing
    // happened. Now the sides are closed by coral massifs so "swim wide" is not
    // an answer, and the only way down is through two sentries sweeping the
    // full width. You sit on a perch, watch the arc, and go when it's past.
    B.wall(-16, 14, -276, 8, 40, 26, 'rock');                // x -20 .. -12, down to the seabed
    B.wall(16, 14, -276, 8, 40, 26, 'rock');                 // x  12 ..  20
    B.box(-7, 12.0, -262, 7, 6, 2, 'rock');                  // three perches, alternating
    B.box(7, 8.5, -274, 7, 6, 2, 'rock');
    B.box(-7, 5.0, -286, 7, 6, 2, 'rock');
    B.crate(9, 8.5, -274, 'star');                           // out on the exposed end of perch two
    B.starLine(-7, 13.6, -259, 2, [0, 0, -2.4]);
    B.starLine(0, 11.0, -266, 3, [2.6, -1.2, -2.0]);         // the dive line, first sweep
    B.starLine(0, 7.0, -278, 3, [-2.6, -1.0, -2.2]);         // …and the second
    B.star(-7, 6.6, -286);
    B.enemy('zapdrone', 0, 10.5, -268, { axis: 'x', range: 20 });
    B.enemy('zapdrone', 0, 6.0, -280, { axis: 'x', range: 18 });   // clears perch two's deck
    B.enemy('flapjack', 0, 13.0, -258, { axis: 'x', range: 8, bob: 1.6 });

    /* --- K: the arena. Three at once ------------------------------------- */
    B.floor(0, 2.4, -309, 22, 26, 'sand');                   // z -322 .. -296 (abuts)
    B.wall(-11.5, 8, -309, 2, 26, 6, 'rock');
    B.wall(11.5, 8, -309, 2, 26, 6, 'rock');
    B.enemy('grumblin', -5, 2.4, -302, { axis: 'x', range: 9 });
    B.enemy('grumblin', 5, 2.4, -312, { axis: 'x', range: 9 });
    B.enemy('prickle', 0, 2.4, -318, {});
    B.crateRow(-3.9, 2.4, -306, 4, 'plain', [2.6, 0, 0]);
    B.starLine(-8, 3.8, -300, 2, [0, 0, -2.2]);
    B.starLine(8, 3.8, -314, 2, [0, 0, -2.2]);
    B.roof(0, 16, -309, 22, 26, 4, 'rock');                  // lid: fight the arena, don't float over it

    /* --- L: the fork. Low tunnel pays, high road is safe ------------------ */
    B.floor(0, 2.4, -334, 12, 22, 'sand');                   // z -345 .. -323
    B.box(0, 12, -334, 16, 22, 2.5, 'rock');                 // the tunnel roof
    B.crate(0, 2.4, -338, 'star');
    B.crate(-3.5, 2.4, -332, 'star');
    B.enemy('prickle', 3.5, 2.4, -330, {});
    B.enemy('jelly', 0, 6, -342, { bob: 2.0 });
    B.box(0, 15, -334, 10, 22, 2, 'rock');                   // the high road
    B.starLine(0, 16.6, -326, 4, [0, 0, -4.2]);
    B.floor(0, 6, -352, 16, 12, 'rock');                     // z -358 .. -346
    B.checkpoint(0, 6, -352);

    /* --- M: the flapjack flock over the void ----------------------------- */
    B.box(-5, 7, -366, 5, 5, 7, 'rock');
    B.box(5, 8, -374, 5, 5, 8, 'rock');
    B.box(-5, 9, -382, 5, 5, 9, 'rock');
    B.box(5, 10, -390, 5, 5, 10, 'rock');
    B.enemy('flapjack', 0, 10.0, -364, { axis: 'x', range: 6, bob: 1.6 });
    B.enemy('flapjack', 0, 12.0, -372, { axis: 'x', range: 6, bob: 1.8 });
    B.enemy('flapjack', 0, 12.5, -380, { axis: 'x', range: 6, bob: 1.8 });
    B.enemy('flapjack', 0, 12.0, -388, { axis: 'x', range: 6, bob: 1.6 });
    B.starLine(0, 13, -366, 3, [0, 0, -10.0], 2.4);
    B.roof(0, 20, -378, 26, 40, 4, 'rock');                  // roof: the flock is the gate, so you can't rise over it

    /* --- N: the springboard launch --------------------------------------- */
    // A spring bounce is fixed at 23.2 up, which under swim gravity is a 24u
    // rocket — so it fires from the seabed and very nearly reaches the surface.
    // The star column runs the WHOLE flight; a trail that stopped at y=12 left
    // three quarters of the launch unmarked.
    B.floor(0, 0, -400, 14, 14, 'sand');                     // z -407 .. -393, the seabed
    B.crate(0, 0, -400, 'spring');
    B.crate(-5, 0, -397, 'plain');
    B.starLine(0, 3.4, -400, 7, [0, 3.2, -0.5]);             // 3.4 .. 22.6, the whole way up
    B.enemy('jelly', 0, 12, -404, { bob: 4.0 });             // hanging in the flight path
    B.floor(0, 19, -412, 12, 10, 'rock');                    // z -417 .. -407
    B.crate(-3, 19, -412, 'star');                           // the ledge pays for the launch
    B.crate(3, 19, -412, 'plain');
    B.enemy('prickle', 0, 19, -415, {});

    /* --- O: the chicane, dropping as it zigzags -------------------------- */
    B.box(-6, 16.0, -424, 5, 7, 4, 'ice');
    B.box(6, 14.5, -432, 5, 7, 4, 'ice');
    B.box(-6, 13.0, -440, 5, 7, 4, 'ice');
    B.box(6, 11.5, -448, 5, 7, 4, 'ice');
    B.box(-6, 10.0, -456, 5, 7, 4, 'ice');
    B.star(-6, 17.6, -424);
    B.star(6, 16.1, -432);
    B.star(-6, 14.6, -440);
    B.star(6, 13.1, -448);
    B.star(-6, 11.6, -456);
    B.enemy('jelly', 0, 14, -428, { bob: 3.4 });
    B.enemy('jelly', 0, 12, -444, { bob: 3.4 });
    B.enemy('jelly', 0, 11, -452, { bob: 3.0 });

    /* --- P: inside the coral tower. Swim up the shaft -------------------- */
    B.wall(-8, 22, -476, 3, 22, 22, 'rock');                 // z -487 .. -465
    B.wall(8, 22, -476, 3, 22, 22, 'rock');
    B.wall(0, 22, -486, 13, 3, 22, 'rock');                  // back wall, abuts both sides
    B.box(-4, 6, -476, 5, 6, 2, 'rock');                     // alcove ledges up the shaft
    B.box(4, 12, -478, 5, 6, 2, 'rock');
    B.box(-4, 18, -474, 5, 6, 2, 'rock');
    B.starLine(0, 5, -476, 5, [0, 3.8, 0]);                  // straight up the middle
    B.enemy('jelly', 0, 11, -477, { bob: 4.5 });             // the shaft is not a free climb
    B.enemy('jelly', 2.5, 17, -472, { bob: 3.0 });
    B.crate(4, 12, -478, 'plain');
    B.crate(-4, 18, -474, 'life');
    B.floor(0, 22, -492, 14, 8, 'rock');                     // z -496 .. -488
    B.checkpoint(0, 22, -492);

    /* --- Q: the crate pyramid -------------------------------------------- */
    B.floor(0, 8, -508, 18, 18, 'sand');                     // z -517 .. -499
    B.crateRow(-3.15, 8, -508, 4, 'plain', [2.1, 0, 0]);
    B.crateRow(-2.1, 9.8, -508, 3, 'plain', [2.1, 0, 0]);
    B.crate(-1.05, 11.6, -508, 'plain');
    B.crate(1.05, 11.6, -508, 'star');
    B.starLine(-7, 9.4, -504, 2, [0, 0, -2.2]);
    B.enemy('grumblin', -6, 8, -502, { axis: 'x', range: 6 });
    B.enemy('grumblin', 6, 8, -514, { axis: 'x', range: 6 });

    /* --- R: the last ride ------------------------------------------------ */
    // Beat I was already three sliders crossing in x with a jelly underneath;
    // doing it again with bigger numbers is the same beat twice. This one is a
    // single FERRY that travels down the corridor in Z while it climbs — the
    // only platform in the level that carries you forward — and the hazards are
    // parked in its path so you have to move around its deck as it goes.
    B.mover(0, 12, -528, 9, 8, 1.2, [0, 20, -552], 9.0);
    B.star(0, 13.4, -528);
    B.star(0, 15.4, -534);
    B.star(0, 17.4, -540);
    B.star(0, 19.4, -546);
    B.enemy('jelly', 0, 15, -536, { bob: 3.6 });
    B.enemy('jelly', -3, 17, -544, { bob: 3.4 });
    B.enemy('flapjack', 3, 18, -549, { axis: 'x', range: 8, bob: 1.6 });
    B.box(-11, 16, -540, 5, 5, 2, 'rock');                   // step OFF the ferry for this
    B.crate(-12, 16, -540, 'star');
    B.crate(-9.9, 16, -540, 'life');                         // the only life in the last 140u
    B.floor(0, 20, -562, 14, 12, 'rock');                    // z -568 .. -556
    B.checkpoint(0, 20, -562);                               // the gauntlet is next — bank it here

    /* --- S: the prickle gauntlet, funnelled ------------------------------ */
    // Walls to y=25 under a ceiling of 26 left a 1u slot you could skim the
    // whole gauntlet through, and even sealed, a prickle is only 1u tall — in
    // swim mode you float over it. So the roof hangs down to y=22 in four
    // baffles: under one your head is inside the prickle's band and the only
    // way past is AROUND it, with the star on its far side.
    B.floor(0, 20, -580, 9, 24, 'rock');                     // z -592 .. -568 (abuts)
    B.wall(-6.5, 26, -580, 4, 24, 6, 'rock');                // sealed to the surface
    B.wall(6.5, 26, -580, 4, 24, 6, 'rock');
    B.box(0, 26, -572, 9, 2.5, 4, 'rock');                   // baffles: y 22 .. 26
    B.box(0, 26, -577, 9, 2.5, 4, 'rock');
    B.box(0, 26, -582, 9, 2.5, 4, 'rock');
    B.box(0, 26, -587, 9, 2.5, 4, 'rock');
    B.enemy('prickle', -2, 20, -572, {});
    B.enemy('prickle', 2, 20, -577, {});
    B.enemy('prickle', -2, 20, -582, {});
    B.enemy('prickle', 2, 20, -587, {});
    B.star(2, 21.4, -572);
    B.star(-2, 21.4, -577);
    B.star(2, 21.4, -582);
    B.star(-2, 21.4, -587);

    /* --- T: up to the surface -------------------------------------------- */
    B.floor(0, 20, -598.5, 14, 13, 'rock');                  // z -605 .. -592 (abuts)
    B.box(-4, 22.5, -608, 6, 6, 3, 'rock');
    B.box(4, 24.5, -614, 6, 6, 5, 'rock');
    B.starLine(0, 22, -606, 3, [0, 1.1, -2.6]);
    B.goal(4, 24.5, -614);
  },
},

{
  id: 'cosmic', name: 'Cosmic Cannonball', world: 2, mode: 'jet',
  sky: [0x150a33, 0x7b3fd4], fog: [0x241046, 55, 250],
  // sunDir z must be POSITIVE, like every other level: the camera sits behind
  // the player looking down -z, so a sun at -z backlights everything you fly
  // toward and the whole level reads as black silhouettes. amb is the bounce
  // light on those camera-facing faces — too dark here and the walls you have
  // to thread disappear against the sky.
  sun: 0xcfd8ff, sunDir: [0.35, 1, 0.45], amb: 0x4a3782,
  camYaw: 0, camOff: [0, 6, 14], start: [0, 1, 12], ceilY: 40,
  hint: 'HOLD SPACE to fly! Let go to drop. X spins — smash the sealed gates.',
  build(B) {
    // The jetpack has no jump: you hold to climb (capped at 14u/s) and let go
    // to fall. So the level is a CORRIDOR OF WALLS rather than a chain of
    // platforms — gates to thread, lintels to duck, columns to weave, plugs to
    // smash, and five perches to land on. ceilY 40 is the sky, and the only
    // reason it stays a course instead of open air.
    B.ground(-26, 'panel');                                  // the station deck, far below

    // A wall across the whole corridor with windows punched in it. `holes` is
    // [centreX, halfWidth, y0, y1] in LEFT-TO-RIGHT order; the piers between
    // them run floor-to-sky and the lintels hang from the sky, because a gate
    // you can simply climb over is not a gate — with a jetpack the player will
    // find that out before you do. Every slab ABUTS its neighbour and never
    // overlaps, so the coplanar tops can't z-fight.
    const SKY = 40, EDGE = 28;
    const gate = (z, holes, tex = 'metal', d = 4) => {
      let x = -EDGE;
      for (const [cx, hw, y0, y1] of holes) {
        if (cx - hw - x > 0.01) B.wall((x + cx - hw) / 2, SKY, z, cx - hw - x, d, SKY, tex);
        if (y0 > 0.01) B.wall(cx, y0, z, hw * 2, d, y0, tex);                 // sill
        if (y1 < SKY - 0.01) B.wall(cx, SKY, z, hw * 2, d, SKY - y1, tex);    // lintel
        x = cx + hw;
      }
      if (EDGE - x > 0.01) B.wall((x + EDGE) / 2, SKY, z, EDGE - x, d, SKY, tex);
    };
    // A hole plugged with a 2x2 stack of crates. The gaps left round the stack
    // are 0.7u — narrower than Orion — so the only way through is X. Pays for
    // itself in stars; there is always an open bypass hole in the same wall.
    const plug = (z, cx, y, kinds) => {
      kinds.forEach((k, i) => B.crate(cx + (i % 2 ? 0.9 : -0.9), y + (i > 1 ? 1.8 : 0), z, k));
      return [cx, 2.5, y, y + 4.4];
    };

    /* --- A: the launch bay. Learn that HOLDING is what flies -------------- */
    B.floor(0, 0, 1, 18, 30, 'metal');                       // z 16 .. -14
    B.wall(-10, 6, 2, 2, 24, 6, 'metal');                    // bay rails
    B.wall(10, 6, 2, 2, 24, 6, 'metal');
    B.starLine(0, 1.4, 8, 2, [0, 0, -2.4]);
    B.crateRow(-5.6, 0, 11, 2, 'plain', [2.6, 0, 0]);
    B.crate(5.5, 0, 11, 'star');
    // The climb runs unbroken from the pad into the first hole: let go
    // anywhere along it and you can see exactly which star you dropped.
    B.starLine(0, 2.2, -2, 5, [0, 2.2, -3.6]);               // (0,2.2,-2) .. (0,11,-16.4)

    /* --- B: three slot gates, the hole moving centre-left-right ----------- */
    gate(-24, [[0, 5, 7, 19]]);
    B.starLine(0, 12, -20, 2, [0, 0, -4]);
    B.star(-3, 12.5, -28); B.star(-7, 13.3, -32);            // the line ACROSS to gate two
    gate(-40, [[-11, 5, 9, 21]]);
    B.starLine(-11, 14, -36, 2, [0, 0, -4]);
    B.star(-7, 13.6, -44); B.star(0, 13.3, -48);
    gate(-56, [[11, 5, 8, 20]]);
    B.star(7, 13, -52); B.star(11, 13, -56); B.star(7, 12, -60);
    B.enemy('zapdrone', 0, 14, -32, { axis: 'x', range: 10 });
    B.enemy('zapdrone', -11, 16, -48, { axis: 'x', range: 12 });

    /* --- C: the column forest. Weave, don't climb ------------------------- */
    B.wall(-9, 30, -66, 5, 5, 30, 'panel');
    B.wall(9, 13, -66, 5, 5, 13, 'panel');
    B.wall(-9, 13, -78, 5, 5, 13, 'panel');
    B.wall(9, 30, -78, 5, 5, 30, 'panel');
    B.wall(0, 30, -90, 5, 5, 30, 'panel');                    // the three-wide pinch
    B.wall(-13, 13, -90, 5, 5, 13, 'panel');
    B.wall(13, 13, -90, 5, 5, 13, 'panel');
    B.wall(-9, 30, -102, 5, 5, 30, 'panel');
    B.wall(9, 13, -102, 5, 5, 13, 'panel');
    // One continuous weave rather than two trails with a hole in the middle.
    B.star(2, 11, -64); B.star(0, 11, -70); B.star(-2, 11, -76);
    B.star(-4, 11, -82); B.star(-6, 11, -88); B.star(-6, 11, -94);
    B.star(-3, 11, -100);
    B.enemy('flapjack', 0, 16, -70, { axis: 'x', range: 9, bob: 2 });
    B.enemy('flapjack', 0, 16, -96, { axis: 'x', range: 9, bob: 2 });
    // A forest you can climb over is not a forest. The tall columns top out at
    // 30 and the sky is 40, so without this you hold SPACE, sit at the ceiling
    // and the whole weave is decoration. Same trick as the L baffles.
    B.roof(0, SKY, -84, 56, 52, 10, 'panel');                 // roof: y 30 .. 40

    /* --- D: perch one. Land, smash, save --------------------------------- */
    B.floor(0, 10, -112, 16, 12, 'metal');                   // z -118 .. -106
    B.checkpoint(0, 10, -112);
    B.crateRow(-4.2, 10, -110, 2, 'plain', [2.1, 0, 0]);
    B.crate(0, 10, -115, 'life');
    B.starLine(6, 12, -107, 3, [0, 0, -2.4]);

    /* --- E: the underdeck. A roof at y=10 means you fly LOW or not at all -- */
    B.floor(0, 2, -143, 26, 34, 'metal');                    // z -160 .. -126
    B.wall(0, 44, -143, 56, 34, 34, 'metal');                // roof: y 10 .. 44, wall to wall
    B.starLine(0, 5, -129, 6, [0, 0, -6]);                   // -129 .. -159, right through
    B.crateRow(-5.25, 2, -134, 3, 'plain', [2.1, 0, 0]);
    B.crate(0, 2, -150, 'star');
    B.enemy('zapdrone', 0, 6, -138, { axis: 'x', range: 9 });
    B.enemy('zapdrone', 0, 6, -152, { axis: 'x', range: 9 });

    /* --- F: the staircase of pads, climbing out of the underdeck ---------- */
    B.floor(0, 6, -170, 10, 9, 'metal');                     // z -174.5 .. -165.5
    B.floor(-8, 12, -181, 9, 9, 'deck');                      // z -185.5 .. -176.5
    B.floor(8, 18, -192, 9, 9, 'deck');                       // z -196.5 .. -187.5
    B.floor(-8, 24, -203, 9, 9, 'deck');                      // z -207.5 .. -198.5
    B.star(0, 8.5, -170); B.star(-8, 14.5, -181);
    B.star(0, 16, -186.5); B.star(8, 20.5, -192); B.star(-8, 26.5, -203);
    B.crate(5, 18, -190, 'plain');
    // Off in the corner, not dead centre of the pad under its own star — the
    // landing has to have a safe half or it is a coin flip you can't see.
    B.enemy('prickle', 11, 18, -194, {});
    B.enemy('flapjack', 0, 14.4, -178, { axis: 'x', range: 8, bob: 1.6 });
    B.enemy('zapdrone', 0, 20, -195, { axis: 'x', range: 12 });
    B.roof(0, SKY, -185, 56, 44, 10, 'panel');                // roof: climb the pads, not past them

    /* --- G: perch two, high up ------------------------------------------- */
    B.floor(0, 29, -214, 16, 12, 'metal');                   // z -220 .. -208
    B.checkpoint(0, 29, -214);
    B.crate(4.5, 29, -211, 'star');
    B.crate(-4.5, 29, -217, 'life');
    B.starLine(-6, 31, -210, 3, [0, 0, -2.5]);

    /* --- H: over, under, over, under. Four bars across the sky ------------ */
    B.wall(0, 44, -224, 56, 5, 26, 'panel');                  // y 18 .. 44 — go UNDER
    B.wall(0, 18, -236, 56, 5, 18, 'panel');                  // y 0 .. 18  — go OVER
    B.wall(0, 44, -248, 56, 5, 24, 'panel');                  // y 20 .. 44 — UNDER
    B.wall(0, 22, -260, 56, 5, 22, 'panel');                  // y 0 .. 22  — OVER
    B.starLine(-3, 12.5, -224, 2, [6, 0, 0]);
    B.starLine(-3, 20.5, -236, 2, [6, 0, 0]);
    B.starLine(-3, 15, -248, 2, [6, 0, 0]);
    B.starLine(-3, 24.5, -260, 2, [6, 0, 0]);
    B.enemy('zapdrone', 0, 12, -230, { axis: 'x', range: 14 });
    B.enemy('zapdrone', 0, 24, -242, { axis: 'x', range: 14 });
    B.enemy('flapjack', 0, 14, -254, { axis: 'x', range: 10, bob: 2 });

    /* --- I: the seals. Smash the plug on the line, or swing wide ---------- */
    // Every other wall in the level is a hole you thread. These three are
    // BLOCKED on the flight line, and X is the only thing that opens them —
    // the fast route is the paying route, the clean route is the long way.
    gate(-272, [plug(-272, -2, 10, ['plain', 'plain', 'plain', 'star']), [12, 5, 8, 20]], 'deck');
    B.star(-2, 12.5, -267); B.star(-2, 12.5, -277);
    B.star(12, 13, -267); B.star(12, 13, -277);
    gate(-288, [[-13, 5, 14, 26], plug(-288, 3, 12, ['plain', 'plain', 'plain', 'plain'])], 'deck');
    B.star(3, 14.5, -283); B.star(3, 14.5, -293);
    B.star(-13, 19, -283); B.star(-13, 19, -293);
    gate(-304, [plug(-304, -3, 16, ['plain', 'plain', 'plain', 'life']), [13, 5, 6, 18]], 'deck');
    B.star(-3, 18.5, -299); B.star(-3, 18.5, -309);
    B.star(13, 11, -299); B.star(13, 11, -309);
    B.enemy('zapdrone', 5, 16, -280, { axis: 'x', range: 16 });
    B.enemy('flapjack', -6, 20, -296, { axis: 'x', range: 10, bob: 2 });
    B.enemy('zapdrone', 5, 12, -312, { axis: 'x', range: 16 });
    B.star(6, 14, -315); B.star(0, 15, -321);                // down onto perch three

    /* --- J: perch three, and a bonus alcove out to the left --------------- */
    B.floor(0, 12, -332, 16, 12, 'metal');                   // z -338 .. -326
    B.checkpoint(0, 12, -332);
    B.crate(-4, 12, -330, 'plain');
    B.crate(0, 12, -335, 'life');
    B.star(0, 15, -329);
    B.floor(-22, 22, -340, 10, 10, 'deck');                   // the risky detour
    B.crate(-22, 22, -342, 'star');
    B.star(-12, 18, -336);
    B.starLine(-22, 24.5, -337, 2, [0, 0, -3]);
    B.enemy('zapdrone', -11, 18, -340, { axis: 'z', range: 10 });

    /* --- K: the mover chain. Three slide, one is a lift ------------------- */
    B.mover(-9, 16, -358, 7, 7, 1.2, [9, 16, -358], 5);
    B.mover(9, 18, -370, 7, 7, 1.2, [-9, 24, -370], 5.6);
    B.mover(-9, 22, -382, 7, 7, 1.2, [9, 28, -382], 6);
    B.mover(0, 26, -394, 8, 8, 1.2, [0, 14, -394], 5.2);
    B.star(0, 19, -358); B.star(0, 22, -370);
    B.star(6, 24, -376); B.star(0, 26, -382); B.star(0, 29, -394);
    B.enemy('zapdrone', 0, 20, -376, { axis: 'x', range: 14 });
    B.roof(0, SKY, -377, 56, 52, 10, 'panel');                // roof: ride the movers, don't overfly them

    /* --- L: the chicane. Baffles off alternate walls, floor to sky -------- */
    // Was two side walls you could simply fly over the top of, which made the
    // "narrow" slabs decoration. Now each baffle seals half the corridor for
    // its full height, so the opening really does swap sides every 12u.
    gate(-406, [[14, 14, 0, SKY]], 'panel', 5);               // open x 0 .. 28
    gate(-418, [[-14, 14, 0, SKY]], 'panel', 5);              // open x -28 .. 0
    gate(-430, [[14, 14, 4, SKY]], 'panel', 5);               // open right, over a sill
    gate(-442, [[-14, 14, 6, SKY]], 'panel', 5);              // open left, higher sill
    B.floor(12, 8, -412, 10, 7, 'deck');                      // z -415.5 .. -408.5
    B.floor(-12, 12, -424, 10, 7, 'deck');
    B.floor(12, 16, -436, 10, 7, 'deck');
    B.floor(-12, 20, -448, 10, 7, 'deck');
    B.star(14, 10.5, -406); B.star(12, 10, -412);
    B.star(-14, 14, -418); B.star(-12, 14, -424);
    B.star(14, 18, -430); B.star(12, 18, -436);
    B.star(-14, 22, -442); B.star(-12, 22, -448);
    B.crate(9, 8, -412, 'plain');
    B.crate(-15, 20, -448, 'star');                          // the far corner of the last baffle
    B.enemy('grumblin', 13.5, 8, -412, { axis: 'x', range: 5 });
    B.enemy('prickle', -15, 12, -424, {});
    B.enemy('flapjack', 14, 20, -430, { axis: 'x', range: 10, bob: 2 });
    B.enemy('grumblin', 12, 16, -436, { axis: 'x', range: 6 });

    /* --- M: perch four, the last safe ground ------------------------------ */
    B.floor(0, 18, -460, 16, 14, 'metal');                   // z -467 .. -453
    B.checkpoint(0, 18, -460);
    B.crateRow(-4.2, 18, -457, 2, 'plain', [2.1, 0, 0]);
    B.crate(4.5, 18, -457, 'life');
    B.starLine(-6, 20.5, -456, 2, [0, 0, -2.5]);

    /* --- N: the swarm. Nothing to thread — the problem is traffic --------- */
    // The spires that used to live here were the column forest again with
    // different numbers. This is the one room in the level with no geometry
    // puzzle at all: a sealed hall, drones at every altitude including two
    // coming straight down the corridor at you, and the loot on the deck so
    // you have to go down where they are to get it.
    B.floor(0, 4, -505, 34, 60, 'metal');                    // z -535 .. -475
    B.wall(-30, SKY, -505, 4, 60, SKY, 'panel');              // sealed hall
    B.wall(30, SKY, -505, 4, 60, SKY, 'panel');
    B.wall(-9, 26, -492, 7, 7, 22, 'panel');                  // two pillars, for cover
    B.wall(9, 30, -518, 7, 7, 26, 'panel');
    B.starLine(0, 9, -478, 3, [-2, 0, -6]);                  // round the first pillar
    B.starLine(-4, 10, -498, 3, [4, 0, -6]);
    B.starLine(2, 9, -516, 4, [-4, 0, -5]);                  // round the second
    B.crate(-4, 4, -500, 'star');
    B.crate(4, 4, -514, 'life');
    B.crateRow(-2, 4, -526, 2, 'plain', [2.1, 0, 0]);
    B.enemy('zapdrone', -8, 10, -482, { axis: 'z', range: 8 });    // head-on, clear of the pillar
    B.enemy('zapdrone', 8, 20, -498, { axis: 'z', range: 18 });    // head-on, higher
    B.enemy('zapdrone', 0, 28, -510, { axis: 'x', range: 20 });
    B.enemy('zapdrone', -10, 15, -522, { axis: 'x', range: 18 });
    // The hall was sealed on the sides and open to the sky, so the traffic was
    // avoidable by flying over all of it. Now it is a hall.
    B.roof(0, SKY, -505, 56, 60, 10, 'panel');                // roof: y 30 .. 40
    B.enemy('flapjack', 6, 8, -530, { axis: 'x', range: 12, bob: 2.4 });

    /* --- N2: the launch ledge. Save BEFORE the climb, not after ----------- */
    // Without this the run from perch four to the goal is 186u of the hardest
    // third of the level on one life bar.
    B.floor(0, 10, -541, 12, 8, 'metal');                    // z -545 .. -537
    B.checkpoint(0, 10, -541);
    B.star(0, 12.5, -538);

    /* --- O: the ascent. Four windows spiralling up to the roof ------------ */
    gate(-548, [[-6, 5, 8, 20]]);
    B.starLine(-6, 13, -546, 2, [0, 0, -4]);
    gate(-562, [[6, 5, 13, 25]]);
    B.starLine(6, 18, -560, 2, [0, 0, -4]);
    gate(-576, [[-6, 5, 18, 30]]);
    B.starLine(-6, 23, -574, 2, [0, 0, -4]);
    gate(-590, [[5, 5, 22, 34]]);
    B.starLine(5, 27, -588, 2, [0, 0, -4]);
    B.enemy('zapdrone', 0, 16, -556, { axis: 'x', range: 16 });
    B.enemy('zapdrone', 0, 26, -584, { axis: 'x', range: 16 });

    /* --- P: the last gate, the summit, and home --------------------------- */
    gate(-606, [[0, 6, 12, 30]]);
    B.star(0, 18, -606);
    B.floor(0, 22, -620, 18, 12, 'metal');                   // z -626 .. -614
    B.star(0, 25, -611);
    B.floor(0, 24, -638, 22, 20, 'metal');                   // the summit, z -648 .. -628
    B.wall(-16, 36, -638, 5, 24, 36, 'metal');               // finish pylons
    B.wall(16, 36, -638, 5, 24, 36, 'metal');
    B.starLine(0, 27, -629, 7, [0, 0, -2.6], 4);             // the victory arc
    B.crateRow(-3.15, 24, -634, 4, 'plain', [2.1, 0, 0]);    // crate pyramid
    B.crate(-2.1, 25.8, -634, 'plain');
    B.crate(0, 25.8, -634, 'star');
    B.crate(2.1, 25.8, -634, 'plain');
    B.crate(0, 27.6, -634, 'life');
    B.enemy('flapjack', 0, 28, -618, { axis: 'x', range: 8, bob: 2 });
    B.enemy('zapdrone', 0, 30, -630, { axis: 'x', range: 12 });
    B.goal(0, 24, -646);
  },
},
];

export const byId = id => LEVELS.find(l => l.id === id);
