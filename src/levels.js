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
  id: 'cavern', name: 'Crystal Cavern', world: 2,
  sky: [0x0a0716, 0x2b1a45], fog: [0x140c26, 22, 115],
  sun: 0xc2a8ff, sunDir: [-0.32, 1, 0.42], amb: 0x241a3c, sunPower: 1.45,
  camYaw: 0, camOff: [0, 5.6, 12.5], start: [0, 0, 14],
  hint: 'Down the mine! Stay on the rock — that glow underneath is lava.',
  build(B) {
    // A running level, on purpose: it sits between the ice and the reef so the
    // two free-movement levels don't land back to back. Everything here is
    // jump, spin and stomp — no new verb to learn on top of a new place.
    //
    // Lava 14u down, so a miss is a death rather than a shortcut. The whole
    // level lives between y -2 and y +16: it climbs the shaft it fell into.
    B.ground(-14, 'lava');

    /* --- A: the adit. Wide, lit, nothing to fall off ---------------------- */
    B.floor(0, 0, 4, 12, 24, 'rock');                        // z 16 .. -8
    B.wall(-8.5, 5.0, 4, 4, 24, 5, 'rock');                  // the mine walls,
    B.wall(8.5, 5.0, 4, 4, 24, 5, 'rock');                   // standable ledges
    B.weed(-5.4, 0, 9, 1.15, 'crystal');
    B.weed(5.4, 0, 1, 1.35, 'crystal');
    B.starLine(0, 1.4, 10, 4, [0, 0, -2.2]);
    B.crate(-3.6, 0, -1, 'plain');
    B.crate(3.6, 0, -1, 'plain');

    /* --- B: the first drop, and the first thing that walks ---------------- */
    B.floor(0, -1.6, -20, 12, 16, 'rock');                   // z -12 .. -28
    B.enemy('grumblin', 0, -1.6, -20, { axis: 'x', range: 8 });
    B.starLine(-3, -0.2, -16, 3, [3, 0, 0]);
    B.weed(-5.2, -1.6, -25, 1.0, 'crystal');
    B.crate(4, -1.6, -25, 'plain');

    /* --- C: three pillars over the lava. The first real jumps ------------- */
    B.box(-3, -0.8, -34.5, 5, 5, 8, 'rock');                 // z -32 .. -37
    B.box(3, 0.0, -43.5, 5, 5, 9, 'rock');                   // z -41 .. -46
    B.box(-3, 0.8, -52.5, 5, 5, 10, 'rock');                 // z -50 .. -55
    B.star(-3, 0.6, -34.5);
    B.star(3, 1.4, -43.5);
    B.star(-3, 2.2, -52.5);
    B.starLine(0, 2.6, -39, 3, [0, 0, -0.8], 1.4);           // over the first gap

    /* --- D: the lantern gallery. Checkpoint 1 ----------------------------- */
    B.floor(0, 0.8, -66, 14, 14, 'rock');                    // z -59 .. -73
    B.checkpoint(0, 0.8, -66);
    B.weed(-6, 0.8, -62, 1.5, 'crystal');
    B.weed(6, 0.8, -70, 1.3, 'crystal');
    B.crate(-4.2, 0.8, -66, 'star');
    B.crate(4.2, 0.8, -66, 'plain');
    B.enemy('prickle', 0, 0.8, -70, {});
    B.starLine(-4, 2.2, -61, 5, [2, 0, 0]);

    /* --- E: the lava lake. Two carts across it ---------------------------- */
    // Metal, not rock: what you ride has to look different from what you stand
    // on, and this is the mine — they read as ore carts on a rail.
    B.mover(-5, 0.8, -78, 6, 6, 2, [5, 0.8, -78], 5);        // z -75 .. -81
    B.mover(5, 0.8, -88, 6, 6, 2, [-5, 0.8, -88], 6);        // z -85 .. -91
    B.star(-5, 2.2, -78);
    B.star(5, 2.2, -88);
    B.starLine(0, 3.2, -83, 3, [0, 0, -1.2], 1.2);
    B.floor(0, 0.8, -100, 12, 12, 'rock');                   // z -94 .. -106
    B.enemy('grumblin', 0, 0.8, -100, { axis: 'x', range: 7 });
    B.crate(0, 0.8, -103, 'life');

    /* --- F: two narrow ledges, one spiky sitter each ---------------------- */
    B.floor(-4, 1.6, -116, 6, 12, 'rock');                   // z -110 .. -122
    B.enemy('prickle', -4, 1.6, -114, {});
    B.starLine(-4, 3.0, -118, 3, [0, 0, -1.6]);
    B.floor(4, 2.4, -132, 6, 12, 'rock');                    // z -126 .. -138
    B.enemy('prickle', 4, 2.4, -130, {});
    B.starLine(4, 3.8, -134, 3, [0, 0, -1.6]);

    /* --- G: the pumping hall. Checkpoint 2, and something that flies ------ */
    B.floor(0, 2.4, -150, 14, 16, 'rock');                   // z -142 .. -158
    B.checkpoint(0, 2.4, -150);
    B.enemy('zapdrone', 0, 6.4, -150, { axis: 'x', range: 11 });
    B.weed(-6.2, 2.4, -145, 1.4, 'crystal');
    B.weed(6.2, 2.4, -155, 1.2, 'crystal');
    B.crateRow(-2.1, 2.4, -154, 3, 'plain');
    B.starLine(-4, 3.8, -146, 5, [2, 0, 0]);

    /* --- H: the crystal staircase. Four steps, alternating sides ---------- */
    B.box(-4, 4.6, -165, 6, 6, 12, 'rock');                  // z -162 .. -168
    B.box(4, 6.8, -175, 6, 6, 14, 'rock');                   // z -172 .. -178
    B.box(-4, 9.0, -185, 6, 6, 16, 'rock');                  // z -182 .. -188
    B.box(4, 11.2, -195, 6, 6, 18, 'rock');                  // z -192 .. -198
    B.star(-4, 6.0, -165);
    B.star(4, 8.2, -175);
    B.star(-4, 10.4, -185);
    B.star(4, 12.6, -195);
    B.weed(-4, 4.6, -167, .8, 'crystal');
    B.weed(4, 11.2, -197, .9, 'crystal');

    /* --- I: the high gallery. Room to breathe, two bats ------------------- */
    B.floor(0, 11.2, -211, 14, 18, 'rock');                  // z -202 .. -220
    B.enemy('flapjack', -4, 14.6, -207, { axis: 'x', range: 7, bob: 1.4 });
    B.enemy('flapjack', 4, 14.6, -216, { axis: 'x', range: 7, bob: 1.4 });
    B.crate(0, 11.2, -206, 'star');
    B.starLine(-5, 12.6, -213, 6, [2, 0, 0]);
    B.weed(-6.4, 11.2, -218, 1.6, 'crystal');
    B.weed(6.4, 11.2, -204, 1.4, 'crystal');

    /* --- J: the fork. The safe road, or the ore shelf that pays 5 --------- */
    B.floor(-5, 11.2, -231, 8, 14, 'rock');                  // z -224 .. -238
    B.enemy('grumblin', -5, 11.2, -231, { axis: 'z', range: 8 });
    B.starLine(-5, 12.6, -227, 3, [0, 0, -2.2]);
    B.box(7, 12.8, -231, 4, 4, 16, 'rock');                  // the shelf, 4u right
    B.crate(7, 12.8, -231, 'star');
    B.floor(0, 11.2, -249, 12, 14, 'rock');                  // z -242 .. -256
    B.crate(0, 11.2, -246, 'plain');

    /* --- K: down onto the shelf. Checkpoint 3 ----------------------------- */
    B.floor(0, 8.0, -267, 12, 14, 'rock');                   // z -260 .. -274
    B.checkpoint(0, 8.0, -267);
    B.enemy('grumblin', 0, 8.0, -271, { axis: 'x', range: 8 });   // off the checkpoint
    B.weed(-5.6, 8.0, -263, 1.3, 'crystal');
    B.starLine(-4, 9.4, -271, 5, [2, 0, 0]);

    /* --- L: the stepping stones. Four pads, nothing under them ------------ */
    B.box(-3, 8.0, -280, 4, 4, 20, 'rock');                  // z -278 .. -282
    B.box(3, 8.0, -288, 4, 4, 20, 'rock');                   // z -286 .. -290
    B.box(-3, 8.0, -296, 4, 4, 20, 'rock');                  // z -294 .. -298
    B.box(3, 8.0, -304, 4, 4, 20, 'rock');                   // z -302 .. -306
    B.star(-3, 9.4, -280);
    B.star(3, 9.4, -288);
    B.star(-3, 9.4, -296);
    B.star(3, 9.4, -304);

    /* --- M: the spring shaft. Bounce back up to the rail level ------------ */
    B.floor(0, 8.0, -316, 12, 12, 'rock');                   // z -310 .. -322
    B.crate(0, 8.0, -318, 'spring');
    B.starLine(0, 11.0, -318, 4, [0, 1.1, 0]);               // straight up the shaft
    B.floor(-4, 12.0, -331, 8, 10, 'rock');                  // z -326 .. -336
    B.crate(-4, 12.0, -329, 'plain');

    /* --- N: the ore rails. Metal decking, and a drone patrolling it ------- */
    B.floor(4, 13.2, -345, 10, 10, 'metal');                 // z -340 .. -350
    B.enemy('zapdrone', 4, 16.6, -345, { axis: 'x', range: 9 });
    B.starLine(4, 14.6, -342, 4, [0, 0, -2.0]);
    B.floor(-4, 14.0, -359, 10, 10, 'metal');                // z -354 .. -364
    B.crate(-4, 14.0, -357, 'plain');
    B.starLine(-4, 15.4, -361, 3, [0, 0, -1.6]);

    /* --- O: the drone hall ------------------------------------------------ */
    B.floor(0, 14.0, -376, 14, 16, 'rock');                  // z -368 .. -384
    B.enemy('zapdrone', 0, 17.4, -376, { axis: 'x', range: 11 });
    B.enemy('grumblin', 0, 14.0, -380, { axis: 'x', range: 8 });
    B.crateRow(-2.1, 14.0, -372, 3, 'plain');
    B.weed(-6.4, 14.0, -370, 1.5, 'crystal');
    B.weed(6.4, 14.0, -382, 1.7, 'crystal');
    B.starLine(-4, 15.4, -378, 5, [2, 0, 0]);

    /* --- P: back down, two long ledges ------------------------------------ */
    B.floor(5, 11.6, -393, 8, 10, 'rock');                   // z -388 .. -398
    B.enemy('prickle', 5, 11.6, -391, {});
    B.starLine(5, 13.0, -395, 3, [0, 0, -1.6]);
    B.floor(-5, 9.2, -407, 8, 10, 'rock');                   // z -402 .. -412
    B.crate(-5, 9.2, -405, 'plain');
    B.starLine(-5, 10.6, -409, 3, [0, 0, -1.6]);

    /* --- Q: the geode. The prettiest room in the game. Checkpoint 4 ------- */
    B.floor(0, 9.2, -423, 14, 14, 'rock');                   // z -416 .. -430
    B.checkpoint(0, 9.2, -423);
    B.weed(-6.2, 9.2, -419, 1.8, 'crystal');
    B.weed(6.2, 9.2, -419, 1.6, 'crystal');
    B.weed(-6.2, 9.2, -427, 1.5, 'crystal');
    B.weed(6.2, 9.2, -427, 1.9, 'crystal');
    B.crate(-4.2, 9.2, -423, 'star');
    B.crate(4.2, 9.2, -423, 'life');
    B.starLine(-4, 10.6, -420, 5, [2, 0, 0]);
    B.enemy('flapjack', 0, 12.6, -426, { axis: 'x', range: 8, bob: 1.6 });

    /* --- R: the last climb ------------------------------------------------ */
    B.box(-4, 11.4, -438, 6, 8, 22, 'rock');                 // z -434 .. -442
    B.box(4, 13.6, -450, 6, 8, 24, 'rock');                  // z -446 .. -454
    B.box(-4, 15.8, -462, 6, 8, 26, 'rock');                 // z -458 .. -466
    B.star(-4, 12.8, -438);
    B.star(4, 15.0, -450);
    B.star(-4, 17.2, -462);

    /* --- S: the summit gallery -------------------------------------------- */
    B.floor(0, 15.8, -478, 14, 16, 'rock');                  // z -470 .. -486
    B.enemy('grumblin', 0, 15.8, -478, { axis: 'x', range: 9 });
    B.crate(-4.2, 15.8, -474, 'plain');
    B.crate(4.2, 15.8, -474, 'plain');
    B.weed(-6.4, 15.8, -483, 1.4, 'crystal');
    B.starLine(-4, 17.2, -481, 5, [2, 0, 0]);

    /* --- T: two more carts, over the deepest part of the shaft ------------ */
    B.mover(-6, 15.8, -492, 6, 6, 2, [6, 15.8, -492], 5);    // z -489 .. -495
    B.mover(6, 15.8, -502, 6, 6, 2, [-6, 15.8, -502], 6);    // z -499 .. -505
    B.star(-6, 17.2, -492);
    B.star(6, 17.2, -502);
    B.starLine(0, 18.2, -497, 3, [0, 0, -1.2], 1.2);

    /* --- U: two small landings, dropping toward the chamber --------------- */
    B.box(0, 14.6, -512, 8, 8, 26, 'rock');                  // z -508 .. -516
    B.box(0, 13.4, -524, 8, 8, 26, 'rock');                  // z -520 .. -528
    B.starLine(0, 16.0, -512, 3, [0, 0, -1.4]);
    B.crate(0, 13.4, -524, 'plain');

    /* --- V: the last chamber. Checkpoint 5 -------------------------------- */
    B.floor(0, 13.4, -539, 14, 14, 'rock');                  // z -532 .. -546
    B.checkpoint(0, 13.4, -539);
    B.enemy('zapdrone', 0, 16.8, -539, { axis: 'x', range: 11 });
    B.enemy('prickle', -4, 13.4, -543, {});
    B.crate(4.2, 13.4, -535, 'star');
    B.weed(6.4, 13.4, -543, 1.6, 'crystal');
    B.starLine(-4, 14.8, -537, 5, [2, 0, 0]);

    /* --- W: two pads up to daylight --------------------------------------- */
    B.box(-4, 14.6, -552.5, 5, 5, 28, 'rock');               // z -550 .. -555
    B.box(4, 15.8, -561.5, 5, 5, 30, 'rock');                // z -559 .. -564
    B.star(-4, 16.0, -552.5);
    B.star(4, 17.2, -561.5);

    /* --- X: the way out --------------------------------------------------- */
    B.floor(0, 15.8, -577, 16, 18, 'rock');                  // z -568 .. -586
    B.weed(-7, 15.8, -572, 2.0, 'crystal');
    B.weed(7, 15.8, -572, 2.0, 'crystal');
    B.crate(-4.2, 15.8, -573, 'star');
    B.crate(4.2, 15.8, -573, 'plain');
    B.starLine(-4, 17.2, -578, 5, [2, 0, 0]);
    B.goal(0, 15.8, -582);
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

    // Kelp beds and coral heads out on the sand either side. Never solid,
    // always at the world floor, rows 20u apart so a 600u level isn't 300
    // meshes of seaweed. The kinds cycle on a prime-length list against a
    // 2-per-row loop, so neither side ever grows the same thing twice running
    // — and NOT pines, which is what stood here until 2026-08-19.
    const BED = ['kelp', 'coral', 'kelp', 'fan', 'kelp'];
    let bi = 0;
    for (let z = 6; z > -616; z -= 20) {
      for (const x of [-27, 29]) {
        const kind = BED[bi++ % BED.length];
        // Kelp is the tall one; a coral head at kelp scale is a boulder.
        const s = (1.3 + ((Math.abs(x) * 3 + Math.abs(z) * 5) % 9) / 7) * (kind === 'kelp' ? .8 : .62);
        B.weed(x + ((z * 3) % 7) - 3, -12, z + (x % 5), s, kind);
      }
    }
    // A few heads on the sandbank itself, where you can actually swim past
    // them. Off to the corners: scenery you swim through still shouldn't sit
    // on the line the level wants you to take.
    B.weed(-6.6, 0, 9, 1.0, 'coral');
    B.weed(6.6, 0, 6, 1.2, 'fan');
    B.weed(-6.9, 0, -7, 1.1, 'kelp');
    B.weed(6.9, 0, -9, .9, 'coral');

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

{
  id: 'dunes', name: 'Dust Devil Dunes', world: 3,
  sky: [0xe07a3c, 0xffdca8], fog: [0xf0bf8a, 40, 170],
  sun: 0xffd9a0, sunDir: [-0.62, 1, 0.34], amb: 0x6b4526, sunPower: 2.3,
  camYaw: 0, start: [0, 1, 12],
  hint: 'HARD HATS bounce you off — spin them with X. And that fizzing crate? Stand back.',
  build(B) {
    // World 3 opens on a running level, the same way World 2 did: two new
    // crate kinds and a new enemy is already a lot to meet in one place, and
    // meeting them while ALSO learning a new way to move is too much.
    //
    // The valley floor is 16u down and sand-coloured. It is not solid: a miss
    // is a death, it just looks like a fall into the desert rather than a fall
    // into nothing.
    B.ground(-16, 'sand');

    // The buttes. Props, not walls — nobody should ever stand on one, and the
    // checker would otherwise spend its time proving you cannot. They sit well
    // off the corridor on both sides so they never come between the camera and
    // Orion, which is the one thing a prop cannot survive.
    for (let z = 20; z > -620; z -= 46) {
      const h = 22 + ((Math.abs(z) * 7) % 17);
      B.prop(-42 + (z % 9), -16 + h, z, 20, 26, h, 'sandstone');
      B.prop(46 + (z % 7), -16 + h * .8, z - 22, 24, 22, h * .8, 'sandstone');
    }
    // Ground cover on the valley floor, so the drop reads as a place. Spaced
    // at 30u rather than 17: a cactus is ten meshes and this loop runs the
    // length of the level, which is how the desert became the most expensive
    // thing in the game to draw.
    for (let z = 16; z > -620; z -= 30) {
      B.weed(-20 + (z % 11), -16, z, 1.5 + (Math.abs(z) % 5) / 5, 'cactus');
      B.weed(24 + (z % 8), -16, z - 9, 1.2 + (Math.abs(z) % 4) / 4, 'shrub');
    }

    /* --- A: the trailhead. Wide, flat, one hard hat with room ------------- */
    B.floor(0, 0, 4, 14, 26, 'mesa');                        // z 17 .. -9
    B.starLine(0, 1.2, 10, 5, [0, 0, -2.4]);
    B.weed(-6.2, 0, 8, 1.1, 'cactus');
    B.weed(6.2, 0, 2, 1.3, 'cactus');
    B.weed(-6.0, 0, -5, .9, 'shrub');
    // Deliberately alone on a wide floor. The first hard hat has to be a thing
    // you can walk up to, jump on, bounce off and think about.
    B.enemy('hardhat', 0, 0, -4, { axis: 'x', range: 7 });
    B.crate(-4.4, 0, -7, 'plain');
    B.crate(4.4, 0, -7, 'plain');

    /* --- B: the fizzing crate. One tnt in the middle of five -------------- */
    B.floor(0, 0, -18, 12, 10, 'mesa');                      // z -13 .. -23
    B.crate(0, 0, -18, 'tnt');
    B.crateRow(-4.2, 0, -18, 2, 'plain', [2.1, 0, 0]);       // x -4.2, -2.1
    B.crateRow(2.1, 0, -18, 2, 'plain', [2.1, 0, 0]);        // x  2.1,  4.2
    B.crate(0, 0, -20.5, 'star');                            // the payout
    B.crate(0, 0, -15.5, 'plain');
    B.starLine(-4, 2.6, -21.5, 5, [2, 0, 0]);

    /* --- C: three sandstone stacks over the valley ------------------------ */
    B.box(-3, 0.6, -30, 5, 5, 10, 'sandstone');              // z -32.5 .. -27.5
    B.box(3, 1.2, -38, 5, 5, 12, 'sandstone');               // z -40.5 .. -35.5
    B.box(-3, 1.8, -46, 5, 5, 14, 'sandstone');              // z -48.5 .. -43.5
    B.star(-3, 2.0, -30);
    B.star(3, 2.6, -38);
    B.star(-3, 3.2, -46);
    B.starLine(0, 3.4, -34, 3, [0, 0, -0.9], 1.2);
    B.starLine(0, 4.0, -42, 3, [0, 0, -0.9], 1.2);

    /* --- D: the waterhole. Checkpoint 1 ----------------------------------- */
    B.floor(0, 1.8, -59, 14, 14, 'mesa');                    // z -52 .. -66
    B.checkpoint(0, 1.8, -59);
    B.enemy('hardhat', 0, 1.8, -63, { axis: 'x', range: 8 });
    B.crate(-4.6, 1.8, -55, 'plain');
    B.crate(4.6, 1.8, -55, 'heart');                         // first heart crate
    B.weed(-6.4, 1.8, -64, 1.2, 'cactus');
    B.weed(6.4, 1.8, -64, 1.0, 'cactus');
    B.starLine(-4, 3.2, -57, 5, [2, 0, 0]);

    /* --- E: two ledges, one spiky sitter each ----------------------------- */
    B.floor(-4, 2.6, -76, 7, 12, 'mesa');                    // z -70 .. -82
    B.enemy('prickle', -4, 2.6, -73, {});
    B.starLine(-4, 4.0, -79, 3, [0, 0, -1.6]);
    B.floor(4, 3.4, -92, 7, 12, 'mesa');                     // z -86 .. -98
    B.enemy('prickle', 4, 3.4, -89, {});
    B.crate(4, 3.4, -95, 'plain');

    /* --- F: the pan. Wide, and three things walking on it ----------------- */
    B.floor(0, 3.4, -110, 16, 16, 'mesa');                   // z -102 .. -118
    B.enemy('hardhat', -5, 3.4, -108, { axis: 'z', range: 6 });
    B.enemy('grumblin', 5, 3.4, -108, { axis: 'z', range: 6 });
    B.enemy('hardhat', 0, 3.4, -115, { axis: 'x', range: 9 });
    B.starLine(-6, 4.8, -110, 7, [2, 0, 0]);
    B.crate(-6.6, 3.4, -104, 'star');
    B.crate(6.6, 3.4, -104, 'plain');
    B.weed(-7.4, 3.4, -117, 1.4, 'cactus');

    /* --- G: the powder keg. A pyramid with the fuse at the bottom --------- */
    // The tnt is the middle of the bottom row on purpose: everything above it
    // is inside the blast, so one hit takes nine crates. Put a fuse on the top
    // of a stack and it is worth exactly itself.
    B.floor(0, 3.4, -128, 12, 12, 'mesa');                   // z -122 .. -134
    B.crate(-2.1, 3.4, -128, 'plain');
    B.crate(0, 3.4, -128, 'tnt');
    B.crate(2.1, 3.4, -128, 'plain');
    B.crate(-1.05, 5.2, -128, 'plain');
    B.crate(1.05, 5.2, -128, 'star');
    B.crate(0, 7.0, -128, 'plain');
    B.crate(-4.2, 3.4, -125, 'plain');
    B.crate(4.2, 3.4, -125, 'plain');
    B.starLine(0, 9.4, -128, 3, [0, 0.9, 0]);

    /* --- H: two carts over the wash --------------------------------------- */
    // Wood, not metal: out here it reads as a plank bridge someone dragged
    // across, and what you RIDE has to look different from what you stand on.
    B.mover(-5, 3.4, -141, 6, 6, 2, [5, 3.4, -141], 5, 'wood');    // z -144 .. -138
    B.mover(5, 3.4, -152, 6, 6, 2, [-5, 3.4, -152], 6, 'wood');    // z -155 .. -149
    B.star(-5, 4.8, -141);
    B.star(5, 4.8, -152);
    B.starLine(0, 5.6, -146, 3, [0, 0, -1.2], 1.2);

    /* --- I: the shade. Checkpoint 2 --------------------------------------- */
    B.floor(0, 3.4, -164, 12, 12, 'mesa');                   // z -158 .. -170
    B.checkpoint(0, 3.4, -164);
    B.enemy('hardhat', 0, 3.4, -167, { axis: 'x', range: 8 });
    B.crate(-4.4, 3.4, -160, 'star');
    B.crate(4.4, 3.4, -160, 'plain');
    B.weed(-5.8, 3.4, -168, 1.3, 'cactus');

    /* --- J: the switchback. Three steps up the mesa ----------------------- */
    B.box(-4, 5.0, -178, 7, 8, 10, 'sandstone');             // z -182 .. -174
    B.box(4, 6.6, -190, 7, 8, 12, 'sandstone');              // z -194 .. -186
    B.box(-4, 8.2, -202, 7, 8, 14, 'sandstone');             // z -206 .. -198
    B.star(-4, 6.4, -178);
    B.star(4, 8.0, -190);
    B.star(-4, 9.6, -202);
    B.starLine(0, 7.4, -184, 3, [0, 0, -0.8], 1.0);
    B.starLine(0, 9.0, -196, 3, [0, 0, -0.8], 1.0);

    /* --- K: the high rim. Room to breathe, and something overhead --------- */
    B.floor(0, 8.2, -220, 14, 16, 'mesa');                   // z -212 .. -228
    B.enemy('flapjack', 0, 11.4, -216, { axis: 'x', range: 9, bob: 1.5 });
    B.crateRow(-2.1, 8.2, -225, 3, 'plain');
    B.starLine(-5, 9.6, -219, 6, [2, 0, 0]);
    B.weed(-6.4, 8.2, -214, 1.5, 'cactus');
    B.weed(6.4, 8.2, -226, 1.2, 'cactus');

    /* --- L: fuse and hats. The tnt does the work if you let it ------------ */
    B.floor(0, 8.2, -238, 13, 12, 'mesa');                   // z -232 .. -244
    B.crate(-2.1, 8.2, -238, 'plain');
    B.crate(0, 8.2, -238, 'tnt');
    B.crate(2.1, 8.2, -238, 'star');
    B.crate(-4.2, 8.2, -238, 'plain');
    B.crate(4.2, 8.2, -238, 'plain');
    // Far enough along z that their patrol never sweeps into the stack, close
    // enough that the blast reaches them.
    B.enemy('hardhat', -4, 8.2, -234, { axis: 'x', range: 4 });
    B.enemy('hardhat', 4, 8.2, -242, { axis: 'x', range: 4 });

    /* --- M: down the far side --------------------------------------------- */
    B.box(0, 6.6, -252, 10, 8, 12, 'sandstone');             // z -256 .. -248
    B.box(0, 5.0, -264, 10, 8, 14, 'sandstone');             // z -268 .. -260
    B.starLine(0, 8.0, -252, 3, [0, 0, -1.4]);
    B.starLine(0, 6.4, -264, 3, [0, 0, -1.4]);

    /* --- N: the slot canyon. Checkpoint 3, walls close in ----------------- */
    B.floor(0, 5.0, -279, 12, 18, 'mesa');                   // z -270 .. -288
    B.checkpoint(0, 5.0, -279);
    // Waist-and-a-bit high: a double jump gets you up there, which is the
    // point — the ledges are where the good crates are.
    B.wall(-7.5, 8.4, -279, 3, 18, 3.4, 'sandstone');        // x -9 .. -6
    B.wall(7.5, 8.4, -279, 3, 18, 3.4, 'sandstone');         // x  6 ..  9
    B.crate(-7.5, 8.4, -275, 'star');
    B.crate(7.5, 8.4, -283, 'life');
    B.enemy('prickle', 0, 5.0, -284, {});
    B.starLine(-4, 6.4, -277, 5, [2, 0, 0]);

    /* --- O: two shelves out of the canyon --------------------------------- */
    B.floor(-5, 5.8, -298, 8, 14, 'mesa');                   // z -291 .. -305
    B.enemy('hardhat', -5, 5.8, -296, { axis: 'z', range: 6 });
    B.starLine(-5, 7.2, -302, 3, [0, 0, -1.6]);
    B.floor(5, 6.6, -315, 8, 14, 'mesa');                    // z -308 .. -322
    B.crate(5, 6.6, -312, 'plain');
    B.starLine(5, 8.0, -318, 3, [0, 0, -1.6]);

    /* --- P: the lookout --------------------------------------------------- */
    B.floor(0, 6.6, -334, 15, 16, 'mesa');                   // z -326 .. -342
    B.enemy('grumblin', 0, 6.6, -330, { axis: 'x', range: 9 });
    B.enemy('hardhat', 0, 6.6, -338, { axis: 'x', range: 9 });
    B.crate(-6.2, 6.6, -340, 'heart');
    B.starLine(-5, 8.0, -334, 6, [2, 0, 0]);
    B.weed(6.6, 6.6, -328, 1.6, 'cactus');

    /* --- Q: stepping stones over the gully -------------------------------- */
    B.box(-3, 6.6, -347, 4.5, 4.5, 16, 'sandstone');         // z -349.25 .. -344.75
    B.box(3, 6.6, -355, 4.5, 4.5, 16, 'sandstone');          // z -357.25 .. -352.75
    B.box(-3, 6.6, -363, 4.5, 4.5, 16, 'sandstone');         // z -365.25 .. -360.75
    B.box(3, 6.6, -371, 4.5, 4.5, 16, 'sandstone');          // z -373.25 .. -368.75
    B.star(-3, 8.0, -347);
    B.star(3, 8.0, -355);
    B.star(-3, 8.0, -363);
    B.star(3, 8.0, -371);

    /* --- R: the wind gap --------------------------------------------------- */
    B.floor(0, 6.6, -384, 14, 16, 'mesa');                   // z -376 .. -392
    B.enemy('flapjack', -4, 9.8, -380, { axis: 'x', range: 7, bob: 1.4 });
    B.enemy('flapjack', 4, 9.8, -388, { axis: 'x', range: 7, bob: 1.4 });
    B.crate(0, 6.6, -389, 'star');
    B.starLine(-5, 8.0, -384, 6, [2, 0, 0]);

    /* --- S: the long pan. Four hats and a fuse ---------------------------- */
    B.floor(0, 6.6, -404, 16, 20, 'mesa');                   // z -394 .. -414
    B.enemy('hardhat', -5, 6.6, -398, { axis: 'x', range: 6 });
    B.enemy('hardhat', 5, 6.6, -398, { axis: 'x', range: 6 });
    B.enemy('hardhat', 0, 6.6, -411, { axis: 'x', range: 10 });
    B.crate(-2.1, 6.6, -405, 'plain');
    B.crate(0, 6.6, -405, 'tnt');
    B.crate(2.1, 6.6, -405, 'plain');
    B.crate(0, 6.6, -402.5, 'star');
    B.starLine(-6, 8.0, -404, 7, [2, 0, 0]);

    /* --- T: back up onto the rim ------------------------------------------ */
    B.box(-5, 7.8, -422, 7, 8, 18, 'sandstone');             // z -426 .. -418
    B.box(5, 9.0, -434, 7, 8, 20, 'sandstone');              // z -438 .. -430
    B.star(-5, 9.2, -422);
    B.star(5, 10.4, -434);
    B.starLine(0, 10.4, -428, 3, [0, 0, -0.8], 1.0);

    /* --- U: the last big floor. Checkpoint 4 ------------------------------ */
    B.floor(0, 9.0, -452, 14, 22, 'mesa');                   // z -441 .. -463
    B.checkpoint(0, 9.0, -452);
    B.enemy('hardhat', 0, 9.0, -447, { axis: 'x', range: 9 });
    B.enemy('prickle', -4, 9.0, -459, {});
    B.crate(4.6, 9.0, -459, 'star');
    B.crateRow(-2.1, 9.0, -455, 3, 'plain');
    B.weed(-6.4, 9.0, -443, 1.5, 'cactus');
    B.weed(6.4, 9.0, -443, 1.3, 'cactus');
    B.starLine(-5, 10.4, -450, 6, [2, 0, 0]);

    /* --- V: the chasm. Two carts, and nothing under them ------------------ */
    B.mover(-6, 9.0, -469, 6, 6, 2, [6, 9.0, -469], 5, 'wood');    // z -472 .. -466
    B.mover(6, 9.0, -480, 6, 6, 2, [-6, 9.0, -480], 6, 'wood');    // z -483 .. -477
    B.star(-6, 10.4, -469);
    B.star(6, 10.4, -480);
    B.starLine(0, 11.4, -474, 3, [0, 0, -1.2], 1.2);

    /* --- W: the far side --------------------------------------------------- */
    B.floor(0, 9.0, -492, 13, 14, 'mesa');                   // z -485 .. -499
    B.enemy('grumblin', 0, 9.0, -492, { axis: 'x', range: 8 });
    B.crate(-4.4, 9.0, -496, 'plain');
    B.crate(4.4, 9.0, -496, 'plain');
    B.starLine(-4, 10.4, -489, 5, [2, 0, 0]);

    /* --- X: the descent ---------------------------------------------------- */
    B.box(0, 7.8, -508, 10, 10, 20, 'sandstone');            // z -513 .. -503
    B.box(0, 6.6, -522, 10, 10, 22, 'sandstone');            // z -527 .. -517
    B.starLine(0, 9.2, -508, 3, [0, 0, -1.4]);
    B.crate(0, 6.6, -522, 'plain');

    /* --- Y: the last camp. Checkpoint 5 ----------------------------------- */
    B.floor(0, 6.6, -540, 15, 18, 'mesa');                   // z -531 .. -549
    B.checkpoint(0, 6.6, -540);
    B.enemy('hardhat', -5, 6.6, -536, { axis: 'x', range: 6 });
    B.enemy('hardhat', 5, 6.6, -544, { axis: 'x', range: 6 });
    B.crate(0, 6.6, -534, 'heart');
    B.starLine(-5, 8.0, -540, 6, [2, 0, 0]);
    B.weed(-7.0, 6.6, -547, 1.4, 'cactus');
    B.weed(7.0, 6.6, -533, 1.6, 'cactus');

    /* --- Z: one last fuse, one last run ----------------------------------- */
    B.floor(0, 6.6, -562, 12, 18, 'mesa');                   // z -553 .. -571
    B.crate(-2.1, 6.6, -562, 'plain');
    B.crate(0, 6.6, -562, 'tnt');
    B.crate(2.1, 6.6, -562, 'plain');
    B.crate(-1.05, 8.4, -562, 'star');
    B.crate(1.05, 8.4, -562, 'plain');
    B.crate(0, 6.6, -559, 'plain');
    B.crate(0, 6.6, -565, 'plain');
    B.starLine(-4, 8.0, -556, 5, [2, 0, 0]);

    /* --- AA: the trail's end ---------------------------------------------- */
    B.floor(0, 6.6, -585, 16, 22, 'mesa');                   // z -574 .. -596
    B.weed(-7.2, 6.6, -578, 2.0, 'cactus');
    B.weed(7.2, 6.6, -578, 1.8, 'cactus');
    B.weed(-7.2, 6.6, -593, 1.5, 'shrub');
    B.crate(-4.4, 6.6, -580, 'star');
    B.crate(4.4, 6.6, -580, 'plain');
    B.starLine(-4, 8.0, -584, 5, [2, 0, 0]);
    B.goal(0, 6.6, -590);
  },
},
{
  id: 'lunar', name: 'Lunar Leapfrog', world: 3, mode: 'moon',
  sky: [0x03040c, 0x141a38], fog: [0x0b1028, 34, 150],
  sun: 0xdfe7ff, sunDir: [-0.42, 1, 0.5], amb: 0x2c3559, sunPower: 1.95,
  // Pulled back and up. A moon jump hangs for a second and covers 14u; at the
  // running game's boom the top of the arc is off the top of the screen and
  // you land on faith.
  camYaw: 0, camOff: [0, 7.0, 14.5], start: [0, 1, 12],
  hint: 'LOW GRAVITY! You jump miles up here. Grey crates take a GROUND POUND — jump, then C.',
  build(B) {
    // `mode: 'moon'` is a patch on the tuning (MODES in src/physics.js) and
    // nothing else: run, double jump, spin and ground pound all still work and
    // still mean what they meant. It is the only new mode in the game that
    // needs no new button explained — and because the checker reads the same
    // tuning, every gap here is judged by the MOON's arc, not the earth one.
    //
    // Numbers to build to: 3.0u up on one jump, 5.1u on two, ~8.8u flat on one
    // and ~13.9u on two. Everything below is spaced against those, which is
    // why this level looks so much airier than the other six.
    B.ground(-20, 'regolith');

    // Boulders and crater rims, well off the corridor. Props: nothing here is
    // a platform and the checker should not have to prove it.
    // Pushed out to x +-50. At x +-34 the checker failed every one of them:
    // a fall from the corridor toward a boulder 25u below covers ~22u of
    // ground in this gravity, so they were all landable — and landing on a
    // prop means dropping through it. Distance is the only thing keeping
    // scenery scenery.
    for (let z = 18; z > -640; z -= 38) {
      const h = 6 + ((Math.abs(z) * 5) % 13);
      B.prop(-50 + (z % 7), -20 + h, z, 14, 16, h, 'rock');
      B.prop(54 + (z % 5), -20 + h * .7, z - 18, 16, 14, h * .7, 'rock');
    }
    // Glow on the dust below, so the drop reads as a place rather than a hole.
    for (let z = 14; z > -640; z -= 30) {
      B.weed(-16 + (z % 9), -20, z, 1.6 + (Math.abs(z) % 5) / 4, 'crystal');
      B.weed(19 + (z % 6), -20, z - 11, 1.2 + (Math.abs(z) % 4) / 4, 'crystal');
    }

    /* --- A: the landing site. Try one jump, then look at it --------------- */
    B.floor(0, 0, 4, 14, 26, 'regolith');                    // z 17 .. -9
    B.starLine(0, 1.4, 10, 5, [0, 0, -2.4]);
    // The lander. A prop, because a kid WILL try to climb it and there is
    // nothing up there — better it be scenery than a disappointment.
    // SOLID, not a prop. It stands 2.5u off the starting platform and a moon
    // jump covers 8.8u, so a kid was always going to land on it — and a prop
    // has no collider, so he fell straight through. Reported from a playtest,
    // and now `tools/check.js` fails any prop within reach rather than trusting
    // a note in AGENTS.md. Being able to climb the lander is the better game
    // anyway.
    //
    // `deck`, not `metal`: metal under this level's dim blue sun renders as a
    // black cube, and a black cube in the corner of the frame reads as a hole
    // in the world rather than as a spacecraft.
    B.wall(-12, 3.4, 8, 5, 5, 3.4, 'deck');
    B.wall(-12, 4.6, 8, 1.6, 1.6, 1.2, 'metal');
    B.weed(6.2, 0, 6, 1.3, 'crystal');
    B.weed(-6.2, 0, -6, 1.1, 'crystal');
    // The first thing you meet is a hopper, on a wide floor, on its own. It
    // moves in the one axis a platformer normally gives you for free.
    B.enemy('hopper', 0, 0, -4, { axis: 'x', range: 6 });
    B.crate(-4.4, 0, -7, 'plain');
    B.crate(4.4, 0, -7, 'plain');

    /* --- B: the grey crates. Nothing but a ground pound opens these ------- */
    B.floor(0, 0, -20, 13, 14, 'regolith');                  // z -13 .. -27
    B.crate(-3.2, 0, -20, 'iron');
    B.crate(0, 0, -20, 'iron');
    B.crate(3.2, 0, -20, 'iron');
    B.crate(0, 0, -24, 'plain');                             // …and one that isn't
    B.starLine(-4, 5.0, -20, 5, [2, 0, 0]);                  // high: this is the moon
    B.weed(-5.8, 0, -25, 1.2, 'crystal');

    /* --- C: the first proper moon jumps. 6u gaps, 2.4u steps -------------- */
    B.box(-4, 2.4, -37, 6, 7, 12, 'rock');                   // z -40.5 .. -33.5
    B.box(4, 4.8, -50, 6, 7, 14, 'rock');                    // z -53.5 .. -46.5
    B.box(-4, 7.2, -63, 6, 7, 16, 'rock');                   // z -66.5 .. -59.5
    B.star(-4, 4.0, -37);
    B.star(4, 6.4, -50);
    B.star(-4, 8.8, -63);
    B.starLine(0, 6.4, -43, 4, [0, 0, -1.1], 2.0);           // the shape of the arc
    B.starLine(0, 8.8, -56, 4, [0, 0, -1.1], 2.0);

    /* --- D: the mare. Checkpoint 1 ---------------------------------------- */
    B.floor(0, 7.2, -80, 15, 18, 'regolith');                // z -71 .. -89
    B.checkpoint(0, 7.2, -80);
    B.enemy('hopper', -4, 7.2, -76, { axis: 'x', range: 5 });
    B.enemy('hopper', 4, 7.2, -84, { axis: 'x', range: 5 });
    B.crate(-6.2, 7.2, -87, 'star');
    B.crate(6.2, 7.2, -87, 'plain');
    B.weed(-7.0, 7.2, -73, 1.6, 'crystal');
    B.weed(7.0, 7.2, -73, 1.4, 'crystal');
    B.starLine(-5, 8.6, -80, 6, [2, 0, 0]);

    /* --- E: two long shelves. This is where the gaps get moon-sized ------- */
    B.floor(-5, 7.2, -101, 8, 14, 'regolith');               // z -94 .. -108
    B.enemy('prickle', -5, 7.2, -98, {});
    B.starLine(-5, 8.6, -104, 3, [0, 0, -1.8]);
    B.floor(5, 7.2, -122, 8, 14, 'regolith');                // z -115 .. -129
    B.crate(5, 7.2, -119, 'iron');
    B.starLine(0, 11.0, -111, 5, [0, 0, -1.5], 2.4);         // right across the gap

    /* --- F: the dust bowl -------------------------------------------------- */
    B.floor(0, 7.2, -142, 16, 16, 'regolith');               // z -134 .. -150
    B.enemy('zapdrone', 0, 11.0, -138, { axis: 'x', range: 11 });
    B.enemy('hopper', 0, 7.2, -147, { axis: 'x', range: 8 });
    B.crateRow(-2.1, 7.2, -145, 3, 'plain');
    B.crate(-6.4, 7.2, -137, 'heart');
    B.starLine(-6, 8.6, -142, 7, [2, 0, 0]);

    /* --- G: the vault. Three grey crates and a fuse to open them ---------- */
    // A tnt takes iron with it, which is the shortcut — and finding that out
    // is a better reward than the three stars are.
    B.floor(0, 7.2, -162, 13, 12, 'regolith');               // z -156 .. -168
    B.crate(-2.1, 7.2, -162, 'iron');
    B.crate(0, 7.2, -162, 'tnt');
    B.crate(2.1, 7.2, -162, 'iron');
    B.crate(0, 7.2, -159, 'iron');
    B.crate(0, 7.2, -165, 'star');
    B.starLine(-5, 12.0, -162, 5, [2.5, 0, 0]);

    /* --- H: leapfrog. Small pads, long hops ------------------------------- */
    B.box(-4, 8.4, -178, 5, 5, 14, 'rock');                  // z -180.5 .. -175.5
    B.box(4, 9.6, -190, 5, 5, 16, 'rock');                   // z -192.5 .. -187.5
    B.box(-4, 10.8, -202, 5, 5, 18, 'rock');                 // z -204.5 .. -199.5
    B.star(-4, 10.0, -178);
    B.star(4, 11.2, -190);
    B.star(-4, 12.4, -202);
    B.starLine(0, 12.6, -184, 4, [0, 0, -1.2], 2.2);
    B.starLine(0, 13.8, -196, 4, [0, 0, -1.2], 2.2);

    /* --- I: the crater. Checkpoint 2, with a rim you can get onto --------- */
    B.floor(0, 10.8, -220, 15, 20, 'regolith');              // z -210 .. -230
    B.checkpoint(0, 10.8, -220);
    // 3.8u of rim. On earth that is a double jump and a prayer; here it is one
    // hop, and the level should say so somewhere you can see it.
    B.wall(-8.5, 14.6, -220, 3, 20, 3.8, 'rock');            // x -10 .. -7
    B.wall(8.5, 14.6, -220, 3, 20, 3.8, 'rock');             // x   7 .. 10
    B.crate(-8.5, 14.6, -215, 'star');
    B.crate(8.5, 14.6, -225, 'life');
    B.enemy('hopper', 0, 10.8, -224, { axis: 'x', range: 9 });
    B.weed(-6.4, 10.8, -228, 1.8, 'crystal');
    B.weed(6.4, 10.8, -212, 2.0, 'crystal');
    B.starLine(-5, 12.2, -218, 6, [2, 0, 0]);

    /* --- J: the rille. Two carts across a crack in the moon --------------- */
    B.mover(-6, 10.8, -240, 7, 7, 2, [6, 10.8, -240], 6, 'metal');   // z -243.5 .. -236.5
    B.mover(6, 10.8, -254, 7, 7, 2, [-6, 10.8, -254], 7, 'metal');   // z -257.5 .. -250.5
    B.star(-6, 12.2, -240);
    B.star(6, 12.2, -254);
    B.starLine(0, 13.6, -247, 4, [0, 0, -1.4], 1.6);

    /* --- K: the far rim ---------------------------------------------------- */
    B.floor(0, 10.8, -270, 14, 16, 'regolith');              // z -262 .. -278
    B.enemy('zapdrone', 0, 14.6, -266, { axis: 'x', range: 10 });
    B.enemy('prickle', 4, 10.8, -274, {});
    B.crate(-4.6, 10.8, -274, 'plain');
    B.starLine(-5, 12.2, -270, 6, [2, 0, 0]);

    /* --- L: the staircase. Moon steps — 3u each, one jump each ------------ */
    B.box(-4, 13.8, -290, 7, 8, 20, 'rock');                 // z -294 .. -286
    B.box(4, 16.8, -303, 7, 8, 23, 'rock');                  // z -307 .. -299
    B.box(-4, 19.8, -316, 7, 8, 26, 'rock');                 // z -320 .. -312
    B.star(-4, 15.4, -290);
    B.star(4, 18.4, -303);
    B.star(-4, 21.4, -316);
    B.starLine(0, 18.4, -296, 3, [0, 0, -1.0], 1.4);
    B.starLine(0, 21.4, -309, 3, [0, 0, -1.0], 1.4);

    /* --- M: the high plain. Checkpoint 3 ---------------------------------- */
    B.floor(0, 19.8, -336, 16, 20, 'regolith');              // z -326 .. -346
    B.checkpoint(0, 19.8, -336);
    B.enemy('hopper', -5, 19.8, -331, { axis: 'x', range: 6 });
    B.enemy('hopper', 5, 19.8, -341, { axis: 'x', range: 6 });
    B.crate(-2.1, 19.8, -336, 'iron');
    B.crate(0, 19.8, -336, 'iron');
    B.crate(2.1, 19.8, -336, 'iron');
    B.crate(0, 19.8, -344, 'heart');
    B.weed(-7.2, 19.8, -328, 1.7, 'crystal');
    B.weed(7.2, 19.8, -344, 1.9, 'crystal');
    B.starLine(-6, 21.2, -333, 7, [2, 0, 0]);

    /* --- N: the drop. Down is cheap here — you fall slowly ---------------- */
    B.box(0, 16.8, -358, 10, 10, 24, 'rock');                // z -363 .. -353
    B.box(0, 13.8, -372, 10, 10, 28, 'rock');                // z -377 .. -367
    B.starLine(0, 19.4, -358, 4, [0, -0.6, -1.2]);
    B.crate(0, 13.8, -372, 'plain');

    /* --- O: the trench. Narrow, with things hopping in it ----------------- */
    B.floor(0, 13.8, -392, 9, 22, 'regolith');               // z -381 .. -403
    B.enemy('hopper', 0, 13.8, -386, { axis: 'x', range: 5 });
    B.enemy('hopper', 0, 13.8, -398, { axis: 'x', range: 5 });
    B.wall(-6.5, 17.0, -392, 4, 22, 3.2, 'rock');            // x -8.5 .. -4.5
    B.wall(6.5, 17.0, -392, 4, 22, 3.2, 'rock');             // x  4.5 .. 8.5
    B.crate(-6.5, 17.0, -385, 'star');
    B.crate(6.5, 17.0, -399, 'plain');
    B.starLine(0, 15.2, -388, 6, [0, 0, -2.2]);

    /* --- P: the long leap. One gap, no help ------------------------------- */
    // 11u across, against a 13.9u double jump. It is the longest single gap in
    // the game, it is comfortably inside the arc, and it is only survivable
    // because of where you are standing — which is the whole joke of the level.
    B.box(0, 13.8, -414, 8, 8, 28, 'rock');                  // z -418 .. -410
    B.box(0, 13.8, -433, 8, 8, 28, 'rock');                  // z -437 .. -429
    B.star(0, 15.2, -414);
    B.star(0, 15.2, -433);
    B.starLine(0, 16.4, -419, 5, [0, 0, -1.6], 2.0);   // the arc, drawn

    /* --- Q: the observatory. Checkpoint 4 --------------------------------- */
    B.floor(0, 13.8, -452, 15, 18, 'regolith');              // z -443 .. -461
    B.checkpoint(0, 13.8, -452);
    B.enemy('zapdrone', 0, 17.6, -448, { axis: 'x', range: 11 });
    B.enemy('hopper', 0, 13.8, -457, { axis: 'x', range: 8 });
    B.wall(-13, 18.8, -452, 6, 6, 5, 'deck');                // solid — see the lander
    B.wall(-13, 20.4, -452, 2.4, 2.4, 1.6, 'metal');
    B.crate(-6.2, 13.8, -446, 'star');
    B.crate(6.2, 13.8, -446, 'plain');
    B.starLine(-5, 15.2, -452, 6, [2, 0, 0]);

    /* --- R: the spring. Straight up, on a moon ---------------------------- */
    // A spring throws you at 1.35 of the EARTH jump — src/world.js uses the
    // global constant and so does the checker — which at moon gravity is 10u
    // of air. There is a whole column of stars up there because of it.
    B.floor(0, 13.8, -474, 12, 14, 'regolith');              // z -467 .. -481
    B.crate(0, 13.8, -474, 'spring');
    B.starLine(0, 17.0, -474, 6, [0, 1.2, 0]);
    B.box(-10, 18.6, -474, 5, 6, 10, 'rock');                // z -477 .. -471
    B.crate(-10, 18.6, -474, 'star');

    /* --- S: the ridge ------------------------------------------------------ */
    B.box(4, 16.2, -493, 7, 9, 12, 'rock');                  // z -497.5 .. -488.5
    B.box(-4, 18.6, -508, 7, 9, 14, 'rock');                 // z -512.5 .. -503.5
    B.star(4, 17.6, -493);
    B.star(-4, 20.0, -508);
    B.starLine(0, 20.0, -501, 4, [0, 0, -1.2], 1.8);

    /* --- T: the last plain. Checkpoint 5 ---------------------------------- */
    B.floor(0, 18.6, -528, 16, 20, 'regolith');              // z -518 .. -538
    B.checkpoint(0, 18.6, -528);
    B.enemy('hopper', -5, 18.6, -523, { axis: 'x', range: 6 });
    B.enemy('hopper', 5, 18.6, -533, { axis: 'x', range: 6 });
    B.enemy('prickle', 0, 18.6, -534, {});     // NOT on the checkpoint at -528
    B.crate(-6.4, 18.6, -536, 'iron');
    B.crate(6.4, 18.6, -536, 'iron');
    B.weed(-7.2, 18.6, -520, 2.0, 'crystal');
    B.weed(7.2, 18.6, -520, 1.8, 'crystal');
    B.starLine(-6, 20.0, -528, 7, [2, 0, 0]);

    /* --- U: three pads home ----------------------------------------------- */
    B.box(-4, 18.6, -548, 6, 6, 16, 'rock');                 // z -551 .. -545
    B.box(4, 18.6, -560, 6, 6, 16, 'rock');                  // z -563 .. -557
    B.box(-4, 18.6, -572, 6, 6, 16, 'rock');                 // z -575 .. -569
    B.star(-4, 20.0, -548);
    B.star(4, 20.0, -560);
    B.star(-4, 20.0, -572);

    /* --- V: the flag ------------------------------------------------------- */
    B.floor(0, 18.6, -592, 16, 22, 'regolith');              // z -581 .. -603
    B.weed(-7.2, 18.6, -586, 2.2, 'crystal');
    B.weed(7.2, 18.6, -586, 2.0, 'crystal');
    B.crate(-4.4, 18.6, -586, 'star');
    B.crate(4.4, 18.6, -586, 'plain');
    B.starLine(-4, 20.0, -590, 5, [2, 0, 0]);
    B.goal(0, 18.6, -597);
  },
},
{
  id: 'skyway', name: 'Skyway Scramble', world: 3,
  sky: [0x2f7fd8, 0xdff1ff], fog: [0xdcefff, 48, 195],
  sun: 0xfff8e6, sunDir: [-0.42, 1, 0.5], amb: 0x5f7fa0, sunPower: 2.2,
  camYaw: 0, camOff: [0, 5.8, 12.2], start: [0, 1, 12],
  hint: 'Floating gardens! Blue crates BOUNCE you. Grey ones need a ground pound (C).',
  build(B) {
    // The last running level before the castle, and the one that leans hardest
    // on things that MOVE: about a third of what you stand on here is going
    // somewhere. That is deliberate — everything else in World 3 is about a
    // new verb (the spin, the moon), and this one is about timing.
    //
    // The sea is 30u down. Nothing between here and it but weather.
    B.ground(-30, 'water');

    // Weather. Clouds are pure decoration with no collider at all — see
    // B.cloud() — which is exactly what they have to be: a cloud you can land
    // on is a platform, and a platform you can see through is a lie.
    for (let z = 20; z > -620; z -= 32) {
      B.cloud(-22 + (z % 11), -9 + ((Math.abs(z) * 3) % 7), z, 2.2 + (Math.abs(z) % 4) / 3, 3.5);
      B.cloud(24 + (z % 9), -13 + ((Math.abs(z) * 5) % 9), z - 13, 2.6 + (Math.abs(z) % 3) / 2, 4.5);
      B.cloud((z % 17) - 8, -22 - ((Math.abs(z) * 7) % 6), z - 6, 3.4, 6);
    }
    // A few islands out of reach, so the sky reads as somewhere with more in
    // it than the one path you are on.
    for (let z = 6; z > -600; z -= 74) {
      B.prop(-40 + (z % 8), -4, z, 18, 20, 7, 'rock');
      B.prop(44 + (z % 6), 2, z - 36, 16, 18, 6, 'rock');
    }

    /* --- A: the first garden ---------------------------------------------- */
    B.floor(0, 0, 4, 14, 26, 'grass');                       // z 17 .. -9
    B.starLine(0, 1.2, 10, 5, [0, 0, -2.4]);
    B.tree(-5.8, 0, 8, .9);
    B.tree(5.8, 0, 2, .85);
    B.tree(-5.8, 0, -6, .8);
    B.enemy('grumblin', 0, 0, -4, { axis: 'x', range: 7 });
    B.crate(-4.4, 0, -7, 'plain');
    B.crate(4.4, 0, -7, 'plain');

    /* --- B: the first plank. Narrow, and a long way down ------------------ */
    B.floor(0, 0, -17, 6, 12, 'wood');                       // z -11 .. -23
    B.starLine(0, 1.4, -13, 5, [0, 0, -2.0]);

    /* --- C: the bouncy garden. Blue crate, first proper use --------------- */
    B.floor(0, 0, -32, 13, 14, 'grass');                     // z -25 .. -39
    B.crate(0, 0, -34, 'spring');
    B.starLine(0, 3.4, -34, 5, [0, 1.0, 0]);                 // straight up its arc
    B.tree(-5.4, 0, -28, .8);
    B.crate(-4.6, 0, -37, 'plain');
    B.crate(4.6, 0, -37, 'plain');
    B.enemy('flapjack', 0, 3.2, -30, { axis: 'x', range: 8, bob: 1.4 });

    /* --- D: the ferry ------------------------------------------------------ */
    B.mover(-5, 0, -46, 6, 6, 2, [5, 0, -46], 5, 'wood');    // z -49 .. -43
    B.star(-5, 1.4, -46);
    B.star(5, 1.4, -46);

    /* --- E: the terrace. Checkpoint 1 ------------------------------------- */
    B.floor(0, 0.8, -60, 12, 14, 'grass');                   // z -53 .. -67
    B.checkpoint(0, 0.8, -60);
    B.enemy('hardhat', 0, 0.8, -64, { axis: 'x', range: 7 });
    B.crate(-4.4, 0.8, -56, 'heart');
    B.crate(4.4, 0.8, -56, 'plain');
    B.tree(5.4, 0.8, -65, .9);
    B.starLine(-4, 2.2, -58, 5, [2, 0, 0]);

    /* --- F: the loft. A spring up to a shelf you cannot jump to ----------- */
    B.crate(0, 0.8, -62, 'spring');
    B.box(-10, 4.4, -60, 6, 8, 12, 'rock');                  // x -13 .. -7, z -64 .. -56
    B.crate(-10, 4.4, -62, 'star');
    B.starLine(-10, 5.8, -57, 3, [0, 0, -1.6]);

    /* --- G: three planks with gaps in them -------------------------------- */
    B.floor(0, 0.8, -74, 6, 8, 'wood');                      // z -70 .. -78
    B.floor(0, 0.8, -86, 6, 8, 'wood');                      // z -82 .. -90
    B.floor(0, 0.8, -98, 6, 8, 'wood');                      // z -94 .. -102
    B.star(0, 2.2, -74);
    B.star(0, 2.2, -86);
    B.star(0, 2.2, -98);
    B.starLine(0, 3.0, -80, 3, [0, 0, -0.8], 1.1);
    B.starLine(0, 3.0, -92, 3, [0, 0, -0.8], 1.1);

    /* --- H: the orchard. Wide, three tenants ------------------------------ */
    B.floor(0, 0.8, -114, 16, 18, 'grass');                  // z -105 .. -123
    B.tree(-6.4, 0.8, -108, 1.0);
    B.tree(6.4, 0.8, -108, .95);
    B.tree(-6.4, 0.8, -120, .9);
    B.enemy('grumblin', -4, 0.8, -113, { axis: 'z', range: 6 });
    B.enemy('hardhat', 4, 0.8, -113, { axis: 'z', range: 6 });
    B.enemy('flapjack', 0, 4.2, -119, { axis: 'x', range: 9, bob: 1.5 });
    B.crateRow(-2.1, 0.8, -110, 3, 'plain');
    B.starLine(-5, 2.2, -116, 6, [2, 0, 0]);

    /* --- I: the lift. A platform that goes UP, and a shelf at the top ----- */
    // Movers carry you: `player.riding` is set from whatever you were standing
    // on last frame, so a vertical one is a lift rather than a thing that
    // slides out from under you.
    B.mover(0, 0.8, -132, 6, 6, 2, [0, 5.6, -132], 6, 'wood');    // z -135 .. -129
    B.star(0, 2.2, -132);
    B.star(0, 5.0, -132);
    B.floor(0, 5.6, -146, 12, 14, 'grass');                  // z -139 .. -153
    B.crate(-4.2, 5.6, -142, 'star');
    B.crate(4.2, 5.6, -142, 'plain');
    B.tree(-5.4, 5.6, -151, .85);
    B.starLine(-4, 7.0, -148, 5, [2, 0, 0]);

    /* --- J: the grey crates. Ground pound, or go round -------------------- */
    B.floor(0, 5.6, -164, 13, 12, 'grass');                  // z -158 .. -170
    B.crate(-3.2, 5.6, -164, 'iron');
    B.crate(0, 5.6, -164, 'iron');
    B.crate(3.2, 5.6, -164, 'iron');
    B.crate(0, 5.6, -168, 'plain');
    B.starLine(-4, 9.4, -164, 5, [2, 0, 0]);

    /* --- K: two ferries, opposite ways ------------------------------------ */
    B.mover(-6, 5.6, -179, 6, 6, 2, [6, 5.6, -179], 5, 'wood');   // z -182 .. -176
    B.mover(6, 5.6, -191, 6, 6, 2, [-6, 5.6, -191], 6, 'wood');   // z -194 .. -188
    B.star(-6, 7.0, -179);
    B.star(6, 7.0, -191);
    B.starLine(0, 8.0, -185, 3, [0, 0, -1.2], 1.2);

    /* --- L: the mid-air garden. Checkpoint 2 ------------------------------ */
    B.floor(0, 5.6, -206, 15, 18, 'grass');                  // z -197 .. -215
    B.checkpoint(0, 5.6, -206);
    B.enemy('hardhat', -5, 5.6, -202, { axis: 'x', range: 6 });
    B.enemy('prickle', 5, 5.6, -210, {});
    B.tree(-6.8, 5.6, -212, 1.1);
    B.tree(6.8, 5.6, -200, 1.0);
    B.crate(0, 5.6, -213, 'heart');
    B.starLine(-5, 7.0, -206, 6, [2, 0, 0]);

    /* --- M: the powder shed ------------------------------------------------ */
    B.floor(0, 5.6, -226, 12, 12, 'grass');                  // z -220 .. -232
    B.crate(-2.1, 5.6, -226, 'plain');
    B.crate(0, 5.6, -226, 'tnt');
    B.crate(2.1, 5.6, -226, 'plain');
    B.crate(-1.05, 7.4, -226, 'star');
    B.crate(1.05, 7.4, -226, 'iron');
    B.crate(0, 9.2, -226, 'plain');
    B.crate(0, 5.6, -223, 'plain');
    B.crate(0, 5.6, -229, 'plain');

    /* --- N: the staircase of planks --------------------------------------- */
    B.floor(-4, 7.2, -242, 7, 8, 'wood');                    // z -238 .. -246
    B.floor(4, 8.8, -254, 7, 8, 'wood');                     // z -250 .. -258
    B.floor(-4, 10.4, -266, 7, 8, 'wood');                   // z -262 .. -270
    B.star(-4, 8.6, -242);
    B.star(4, 10.2, -254);
    B.star(-4, 11.8, -266);
    B.starLine(0, 10.6, -248, 3, [0, 0, -0.8], 1.0);
    B.starLine(0, 12.2, -260, 3, [0, 0, -0.8], 1.0);

    /* --- O: the high garden ------------------------------------------------ */
    B.floor(0, 10.4, -284, 16, 20, 'grass');                 // z -274 .. -294
    B.enemy('flapjack', -4, 13.8, -279, { axis: 'x', range: 8, bob: 1.5 });
    B.enemy('flapjack', 4, 13.8, -289, { axis: 'x', range: 8, bob: 1.5 });
    B.enemy('grumblin', 0, 10.4, -284, { axis: 'x', range: 9 });
    B.tree(-7.0, 10.4, -277, 1.2);
    B.tree(7.0, 10.4, -291, 1.1);
    B.crate(-6.4, 10.4, -291, 'star');
    B.starLine(-6, 11.8, -284, 7, [2, 0, 0]);

    /* --- P: the long ferry. One platform, a long way ---------------------- */
    B.mover(0, 10.4, -300, 7, 7, 2, [0, 10.4, -330], 9, 'wood');  // z -303.5 .. -296.5
    B.star(0, 11.8, -300);
    B.star(0, 11.8, -330);
    B.floor(0, 10.4, -344, 12, 14, 'grass');                 // z -337 .. -351
    B.crate(-4.2, 10.4, -340, 'plain');
    B.crate(4.2, 10.4, -340, 'heart');
    B.tree(5.4, 10.4, -349, .9);
    B.starLine(-4, 11.8, -346, 5, [2, 0, 0]);

    /* --- Q: the drop, and a spring to get back up ------------------------- */
    B.floor(0, 7.6, -364, 12, 14, 'grass');                  // z -357 .. -371
    B.crate(0, 7.6, -366, 'spring');
    B.starLine(0, 10.6, -366, 5, [0, 1.0, 0]);
    B.box(9, 11.2, -364, 6, 8, 14, 'rock');                  // x 6 .. 12, z -368 .. -360
    B.crate(9, 11.2, -364, 'star');
    B.enemy('hardhat', 0, 7.6, -369, { axis: 'x', range: 7 });

    /* --- R: the gauntlet of planks. Checkpoint 3 -------------------------- */
    B.floor(0, 7.6, -384, 6, 10, 'wood');                    // z -379 .. -389
    B.checkpoint(0, 7.6, -384);
    B.floor(-5, 7.6, -398, 6, 10, 'wood');                   // z -393 .. -403
    B.floor(5, 7.6, -412, 6, 10, 'wood');                    // z -407 .. -417
    B.star(0, 9.0, -384);
    B.star(-5, 9.0, -398);
    B.star(5, 9.0, -412);
    B.starLine(0, 9.8, -391, 3, [0, 0, -1.0], 1.1);
    B.starLine(0, 9.8, -405, 3, [0, 0, -1.0], 1.1);

    /* --- S: the last big garden ------------------------------------------- */
    B.floor(0, 7.6, -432, 16, 20, 'grass');                  // z -422 .. -442
    B.enemy('hardhat', -5, 7.6, -427, { axis: 'x', range: 6 });
    B.enemy('hardhat', 5, 7.6, -437, { axis: 'x', range: 6 });
    B.enemy('flapjack', 0, 11.0, -432, { axis: 'x', range: 10, bob: 1.6 });
    B.tree(-7.2, 7.6, -425, 1.3);
    B.tree(7.2, 7.6, -439, 1.2);
    B.crateRow(-2.1, 7.6, -424, 3, 'plain');
    B.crate(0, 7.6, -440, 'life');
    B.starLine(-6, 9.0, -434, 7, [2, 0, 0]);

    /* --- T: three lifts, each higher than the last ------------------------ */
    B.mover(-4, 7.6, -452, 6, 6, 2, [-4, 10.0, -452], 5, 'wood');   // z -455 .. -449
    B.mover(4, 10.0, -464, 6, 6, 2, [4, 12.4, -464], 5, 'wood');    // z -467 .. -461
    B.mover(-4, 12.4, -476, 6, 6, 2, [-4, 14.8, -476], 5, 'wood');  // z -479 .. -473
    B.star(-4, 9.0, -452);
    B.star(4, 11.4, -464);
    B.star(-4, 13.8, -476);

    /* --- U: the summit garden. Checkpoint 4 ------------------------------- */
    B.floor(0, 14.8, -494, 15, 18, 'grass');                 // z -485 .. -503
    B.checkpoint(0, 14.8, -494);
    B.enemy('grumblin', 0, 14.8, -490, { axis: 'x', range: 9 });
    B.enemy('prickle', -4, 14.8, -500, {});
    B.tree(-6.8, 14.8, -488, 1.2);
    B.tree(6.8, 14.8, -500, 1.1);
    B.crate(5.0, 14.8, -500, 'star');
    B.starLine(-5, 16.2, -494, 6, [2, 0, 0]);

    /* --- V: the last ferries ---------------------------------------------- */
    B.mover(-6, 14.8, -515, 6, 6, 2, [6, 14.8, -515], 5, 'wood');   // z -518 .. -512
    B.mover(6, 14.8, -527, 6, 6, 2, [-6, 14.8, -527], 6, 'wood');   // z -530 .. -524
    B.star(-6, 16.2, -515);
    B.star(6, 16.2, -527);
    B.starLine(0, 17.2, -521, 3, [0, 0, -1.2], 1.2);

    /* --- W: the fuse in the sky ------------------------------------------- */
    B.floor(0, 14.8, -542, 13, 14, 'grass');                 // z -535 .. -549
    B.crate(-2.1, 14.8, -542, 'plain');
    B.crate(0, 14.8, -542, 'tnt');
    B.crate(2.1, 14.8, -542, 'star');
    B.crate(-4.2, 14.8, -542, 'plain');
    B.crate(4.2, 14.8, -542, 'plain');
    B.crate(0, 14.8, -545, 'iron');
    B.starLine(-4, 16.2, -538, 5, [2, 0, 0]);

    /* --- X: three planks home --------------------------------------------- */
    B.floor(-4, 14.8, -560, 6, 10, 'wood');                  // z -555 .. -565
    B.floor(4, 14.8, -574, 6, 10, 'wood');                   // z -569 .. -579
    B.star(-4, 16.2, -560);
    B.star(4, 16.2, -574);
    B.starLine(0, 17.0, -567, 3, [0, 0, -1.0], 1.1);

    /* --- Y: the last garden ------------------------------------------------ */
    B.floor(0, 14.8, -596, 16, 22, 'grass');                 // z -585 .. -607
    B.tree(-7.2, 14.8, -590, 1.4);
    B.tree(7.2, 14.8, -590, 1.3);
    B.tree(-7.2, 14.8, -604, 1.1);
    B.crate(-4.4, 14.8, -590, 'star');
    B.crate(4.4, 14.8, -590, 'plain');
    B.starLine(-4, 16.2, -594, 5, [2, 0, 0]);
    B.goal(0, 14.8, -601);
  },
},
{
  id: 'castle', name: "King Dad's Castle", world: 3,
  sky: [0x2e1550, 0xff9a5c], fog: [0xf08a62, 45, 200],
  sun: 0xffd9a8, sunDir: [-0.45, 1, 0.5], amb: 0x3b2a4a,
  camYaw: 0, camOff: [0, 5.8, 13], start: [0, 0, 14],
  hint: 'The castle! Jump on King Dad THREE times — spinning just bounces off.',
  build(B) {
    // The finale. A normal running level for 250u, then one room with one
    // problem in it. The run-up is deliberately gentle: everything the kid has
    // to spend on this level should be spent in the arena.
    B.ground(-16, 'water');

    /* --- A: the causeway ------------------------------------------------- */
    B.floor(0, 0, 4, 12, 24, 'rock');                         // z 16 .. -8
    B.wall(-8.6, 2.4, 4, 4, 24, 2.4, 'rock');
    B.wall(8.6, 2.4, 4, 4, 24, 2.4, 'rock');
    B.starLine(0, 1.4, 10, 4, [0, 0, -2.2]);
    B.crate(-3.6, 0, -1, 'plain');
    B.crate(3.6, 0, -1, 'plain');

    /* --- B: the outer ward ------------------------------------------------ */
    B.floor(0, 0, -20, 12, 16, 'rock');                       // z -12 .. -28
    B.enemy('grumblin', 0, 0, -20, { axis: 'x', range: 8 });
    B.starLine(-3, 1.4, -17, 3, [3, 0, 0]);
    B.crate(4, 0, -25, 'plain');

    /* --- C: three broken steps over the sea -------------------------------- */
    B.box(-3, 0.8, -34.5, 5, 5, 10, 'rock');                  // z -32 .. -37
    B.box(3, 1.6, -43.5, 5, 5, 11, 'rock');                   // z -41 .. -46
    B.box(-3, 2.4, -52.5, 5, 5, 12, 'rock');                  // z -50 .. -55
    B.star(-3, 2.2, -34.5);
    B.star(3, 3.0, -43.5);
    B.star(-3, 3.8, -52.5);

    /* --- D: the guardroom. Checkpoint 1 ------------------------------------ */
    B.floor(0, 2.4, -66, 14, 14, 'rock');                     // z -59 .. -73
    B.checkpoint(0, 2.4, -66);
    B.crate(-4.2, 2.4, -66, 'star');
    B.crate(4.2, 2.4, -66, 'plain');
    B.enemy('prickle', 0, 2.4, -70, {});
    B.starLine(-4, 3.8, -62, 5, [2, 0, 0]);

    /* --- E: the moat. Two drawbridge sections, both moving ----------------- */
    B.mover(-5, 2.4, -78, 6, 6, 2, [5, 2.4, -78], 5);         // z -75 .. -81
    B.mover(5, 2.4, -88, 6, 6, 2, [-5, 2.4, -88], 6);         // z -85 .. -91
    B.star(-5, 3.8, -78);
    B.star(5, 3.8, -88);
    B.starLine(0, 4.8, -83, 3, [0, 0, -1.2], 1.2);
    B.floor(0, 2.4, -100, 12, 12, 'rock');                    // z -94 .. -106
    B.enemy('grumblin', 0, 2.4, -100, { axis: 'x', range: 7 });
    B.crate(0, 2.4, -103, 'life');

    /* --- F: the battlements. Bats off the parapet -------------------------- */
    B.floor(-4, 3.2, -116, 7, 12, 'rock');                    // z -110 .. -122
    B.enemy('flapjack', -4, 6.4, -116, { axis: 'x', range: 6, bob: 1.3 });
    B.starLine(-4, 4.6, -118, 3, [0, 0, -1.6]);
    B.floor(4, 4.0, -132, 7, 12, 'rock');                     // z -126 .. -138
    B.enemy('flapjack', 4, 7.2, -132, { axis: 'x', range: 6, bob: 1.3 });
    B.starLine(4, 5.4, -134, 3, [0, 0, -1.6]);

    /* --- G: the courtyard. Checkpoint 2 ------------------------------------ */
    B.floor(0, 4.0, -150, 14, 16, 'rock');                    // z -142 .. -158
    B.checkpoint(0, 4.0, -150);
    B.enemy('grumblin', 0, 4.0, -146, { axis: 'x', range: 9 });
    B.crateRow(-2.1, 4.0, -154, 3, 'plain');
    B.starLine(-4, 5.4, -147, 5, [2, 0, 0]);

    /* --- H: stepping stones across the inner moat -------------------------- */
    B.box(-3, 4.0, -164, 4, 4, 14, 'rock');                   // z -162 .. -166
    B.box(3, 4.0, -172, 4, 4, 14, 'rock');                    // z -170 .. -174
    B.box(-3, 4.0, -180, 4, 4, 14, 'rock');                   // z -178 .. -182
    B.star(-3, 5.4, -164);
    B.star(3, 5.4, -172);
    B.star(-3, 5.4, -180);

    /* --- I: the turret landing --------------------------------------------- */
    B.floor(0, 4.8, -192, 12, 12, 'rock');                    // z -186 .. -198
    B.enemy('prickle', -3, 4.8, -190, {});
    B.crate(3, 4.8, -190, 'star');
    B.starLine(-4, 6.2, -195, 5, [2, 0, 0]);

    /* --- J: the tower stair ------------------------------------------------ */
    B.box(-4, 7.0, -205.5, 6, 7, 16, 'rock');                 // z -202 .. -209
    B.box(4, 9.2, -216.5, 6, 7, 18, 'rock');                  // z -213 .. -220
    B.box(0, 11.4, -227.5, 8, 7, 20, 'rock');                 // z -224 .. -231
    B.star(-4, 8.4, -205.5);
    B.star(4, 10.6, -216.5);
    B.star(0, 12.8, -227.5);

    /* --- K: the gatehouse. Last checkpoint before the fight ---------------- */
    B.floor(0, 11.4, -242, 14, 14, 'rock');                   // z -235 .. -249
    B.checkpoint(0, 11.4, -242);
    // Two spare cats and a full pocket of stars, on purpose: the fight is the
    // hard part of the level and the kid should arrive at it stocked.
    B.crate(-4.4, 11.4, -239, 'life');
    B.crate(4.4, 11.4, -239, 'life');
    B.crate(0, 11.4, -246, 'star');
    B.starLine(-4, 12.8, -243, 5, [2, 0, 0]);

    /* --- L: THE ARENA ------------------------------------------------------
     * One slab, 34 by 34, no pits and no crates in the middle. A boss who
     * hops at you needs floor everywhere you might be standing, and anything
     * you can hide behind turns the fight into a stalemate.
     */
    B.floor(0, 11.4, -270, 34, 34, 'rock');                   // z -253 .. -287
    B.enemy('king', 0, 11.4, -272, { arena: 12 });

    // Rails down both long sides, waist high — and the real barrier at 9u,
    // because a double jump clears 4.08 and going over the side mid-fight is
    // not a mistake worth a life. The entry side stays open: backing off the
    // way you came in is a legitimate thing to do to a boss.
    for (const sx of [-1, 1]) {
      B.wall(sx * 17.8, 13.6, -270, 1.6, 34, 2.2, 'rock');
      B.barrier(sx * 17.8, 20.4, -270, 1.6, 34, 9);
    }
    // Braziers in the corners. Scenery only — crystals recoloured by tint,
    // which is what having a flora kind is for.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      B.weed(sx * 14.5, 11.4, -270 + sz * 14.5, 1.3, 'crystal');
    }
    // Stars round the edge of the arena: a reason to move while he is winding
    // up, instead of standing still waiting for the telegraph.
    B.starLine(-12, 12.8, -258, 5, [6, 0, 0]);
    B.starLine(-12, 12.8, -283, 5, [6, 0, 0]);
    B.star(-15, 12.8, -270);
    B.star(15, 12.8, -270);

    /* --- M: the gate, and what is behind it -------------------------------- */
    // Spans the whole width of the court beyond and stands 5u tall, so it can
    // be neither walked round nor jumped (a double jump is 4.08). It crumbles
    // when he goes down — that is the only way through.
    B.gate(0, 16.4, -286.4, 16, 1.6, 5);
    B.floor(0, 11.4, -294, 16, 14, 'rock');                   // z -287 .. -301
    B.weed(-6.6, 11.4, -290, 1.5, 'crystal');
    B.weed(6.6, 11.4, -290, 1.5, 'crystal');
    B.starLine(-4, 12.8, -291, 5, [2, 0, 0]);
    B.goal(0, 11.4, -296);
  },
},
];

export const byId = id => LEVELS.find(l => l.id === id);

/**
 * The hub. Not in LEVELS — you never "play" it and it has no goal; it is the
 * place you stand between levels, which is the thing the game was missing.
 * Reaching Cosmic Cannonball used to mean playing four levels first, so the
 * last level got tested least, by everyone, including the person it is for.
 *
 * `hub: true` tells tools/check.js to skip the goal and the jump-arc flood
 * fill and still run every geometry check, because this is authored the same
 * way everything else is and gets the same class of mistake.
 */
export const HUB = {
  id: 'hub', name: 'Star Island', hub: true,
  // Borrowed until the hub gets a theme of its own; `music` overrides the
  // usual "track is named after the level" rule.
  music: 'jungle',
  sky: [0x4aa8ff, 0xdff1ff], fog: [0xd6ecff, 60, 230],
  sun: 0xfff4dd, sunDir: [-0.4, 1, 0.55], amb: 0x4e6a48,
  // Ten doors do not fit on one arc at a readable size, so the island grew a
  // TERRACE and the camera came back with it. The rule the offset is solving
  // is unchanged from the seven-door version: every placard has to be legible
  // from the spawn, because a level select you have to walk around to read is
  // not a level select.
  camYaw: 0, camOff: [0, 11.5, 23], start: [0, 0, 7],
  hint: 'Walk into a ring to play that level! World 3 is up the steps.',
  build(B) {
    B.ground(-12, 'water');                         // the island sits in the sea
    // Bigger than it was: x -22..22, z -34..22. Deep at the front for the same
    // reason as before — the camera boom sits behind the spawn, and an island
    // that ends too soon puts its own cliff face across the bottom of the shot.
    // The front edge is at z 25 for a reason that is pure camera: the boom
    // sits 25u behind Orion, so at the spawn the front rail is 6u in front of
    // the lens — which is BELOW the bottom of a frustum tilted 24 degrees down,
    // and therefore out of shot. Bring the edge any closer and the rail parks
    // itself across the bottom third of the level select. (keepOrionInSight
    // does not save you here: the rail is under the sightline, not across it.)
    B.floor(0, 0, -4.5, 44, 59, 'grass');           // x -22..22, z -34 .. 25

    // The terrace. World 3 stands on it, which is the whole point: the map
    // should say "these are the new ones" before you have read a single sign,
    // and height says it better than any label.
    B.box(0, 2.2, -25, 40, 14, 8, 'rock');          // x -20..20, z -32 .. -18
    // …and one step in the middle of it, so getting up there is walking rather
    // than a jump you have to aim. A 2.2 step is exactly a single jump, which
    // is fine for a level and mean for a menu.
    B.box(0, 1.1, -16.5, 12, 3, 6, 'rock');         // x -6..6, z -18 .. -15

    /* ---- the doors ----
     * Front lawn: Worlds 1 and 2, six of them, on an arc so perspective pulls
     * the placards apart. Terrace: World 3, four of them, STAGGERED against
     * the gaps in the front row — line them up and every back placard hides
     * behind a front one from the only angle this camera has.
     */
    B.portal(-18.5, 0, -2, 0);
    B.portal(-11.2, 0, -6, 1);
    B.portal(-3.8, 0, -8.5, 2);
    B.portal(3.8, 0, -8.5, 3);
    B.portal(11.2, 0, -6, 4);
    B.portal(18.5, 0, -2, 5);
    B.portal(-13.5, 2.2, -25, 6);
    B.portal(-4.5, 2.2, -28.5, 7);
    B.portal(4.5, 2.2, -28.5, 8);
    B.portal(13.5, 2.2, -25, 9);

    // Something to look at, all of it clear of the walk between the spawn and
    // the doors. No stars out here: a star you can collect on the map that
    // counts for nothing and never comes back is a promise the hub can't keep.
    // Nothing on the centre line, ever: a tree at x 0 in front of the spawn
    // sits squarely between the camera and Orion, and it is the one occluder
    // keepOrionInSight cannot clear — a trunk collider is `scenery`, so the
    // art hanging off it was never in `solids` to be ghosted.
    for (const [x, z, s] of [[-20, 10, .95], [20, 10, .9], [-20.5, 2, .85], [20.5, 2, .8],
                             [-20, -12, .8], [20, -12, .85], [-13, 16, .75], [13, 16, .75],
                             [-20.5, 20, .7], [20.5, 20, .7]])
      B.tree(x, 0, z, s);
    // Palms up on the terrace, at its back corners, behind the placards.
    B.tree(-17.5, 2.2, -31, .85);
    B.tree(17.5, 2.2, -31, .8);
    B.wall(-20, 2.2, -8, 4, 4, 2.2, 'rock');
    B.wall(20, 2.2, -8, 4, 4, 2.2, 'rock');

    // A wall all the way round. You cannot fall off the map — there is nothing
    // to be gained by dying on the level select, and a kid who walks off the
    // edge while reading the signs has been punished for reading the signs.
    // The front rail spends most of its life between the camera and Orion and
    // is simply not drawn while it does; that is what keepOrionInSight is for.
    const R = 2.6;                                  // rail height — waist high
    B.wall(0, R, -34.75, 45, 1.5, R, 'rock');       // back
    B.wall(0, R, 25.75, 45, 1.5, R, 'rock');        // front
    // 55 deep, not 57: at 57 the side rails run INTO the back and front ones
    // and four coplanar corners z-fight. The invisible barrier below is what
    // actually seals them, so the visible rail can afford the gap.
    B.wall(-22.75, R, -4.5, 1.5, 57, R, 'rock');    // left
    B.wall(22.75, R, -4.5, 1.5, 57, R, 'rock');     // right
    // …and the part that actually holds you in. The rail is scenery: a double
    // jump clears 4.08u, and off the 2.2u terrace that is 6.3u, so the real
    // barrier goes to 9 and is invisible rather than walling the sea out.
    const H = 9;
    B.barrier(0, H, -34.75, 45, 1.5, H);
    B.barrier(0, H, 25.75, 45, 1.5, H);
    B.barrier(-22.75, H, -4.5, 1.5, 61, H);
    B.barrier(22.75, H, -4.5, 1.5, 61, H);

    // Distant palms on the water, never solid.
    for (let z = 24; z > -70; z -= 14) {
      B.tree(-38 + (z % 6), -12, z, 2.0, false);
      B.tree(39 + (z % 5), -12, z - 6, 2.2, false);
    }
  },
};
