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

export const LEVELS = [
{
  id: 'jungle', name: 'Jungle Jog', world: 1,
  sky: [0x63b8ff, 0xcdeeff], fog: [0xc4e7ff, 45, 175],
  sun: 0xfff4dd, sunDir: [-0.5, 1, 0.6], amb: 0x7690b8,
  camYaw: 0, start: [0, 1, 12],
  hint: 'SPACE to jump — jump AGAIN in the air for a double jump. X to spin!',
  build(B) {
    // The jungle floor, a long way below. Not solid: pits still kill, they now
    // just look like a drop into the canopy instead of a drop into nothing.
    // 20u down and tinted, so it never reads as more of the same ground.
    B.ground(-20, 'dirt');
    for (let z = 26; z > -204; z -= 13) {
      for (const x of [-23, -36, -52, 23, 36, 52]) {
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
    let i = 0;
    for (const [z, dx, w] of [[-29.5, 0, 7], [-40, 3, 6], [-50.5, -3, 6], [-61, 0, 7]]) {
      B.floor(dx, 0, z, w, 6, 'grass');
      B.starLine(dx, 1.3, z + 1.5, 3, [0, 0, -1.4], .8);
      i++;
    }
    B.floor(0, 0, -70.5, 12, 8, 'grass');                  // z -66.5 .. -74.5
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

    /* --- E: the run home -------------------------------------------------*/
    B.floor(0, 4.6, -170, 11, 34, 'grass');                // z -153 .. -187 (abuts)
    B.enemy('flapjack', -3, 6.7, -158, { axis: 'x', range: 8, bob: 1.8 });
    B.enemy('flapjack', 3, 6.7, -166, { axis: 'x', range: 8, bob: 1.8 });
    B.enemy('grumblin', 0, 4.6, -174, { axis: 'x', range: 9 });
    B.crateRow(-4.4, 4.6, -162, 5, 'plain', [2.2, 0, 0]);
    B.starLine(0, 5.9, -155, 12, [0, 0, -2.2]);
    for (let z = -155; z > -186; z -= 5) { B.tree(-4.6, 4.6, z, .75); B.tree(4.6, 4.6, z, .7); }
    B.goal(0, 4.6, -184);
  },
},

{
  id: 'coast', name: 'Crumble Coast', world: 1,
  sky: [0x2f9fd8, 0xffe9b8], fog: [0xffe2b0, 40, 165],
  sun: 0xffe9c4, sunDir: [0.7, 1, 0.3], amb: 0x8a94a8,
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
    B.floor(0, .6, -77, 12, 9, 'sand');                     // z -72.5 .. -81.5
    B.checkpoint(0, .6, -77);

    /* --- spring-crate ladder up the cliff -------------------------------- */
    B.floor(0, .6, -87, 10, 7, 'sand');                     // z -83.5 .. -90.5
    B.crate(0, .6, -87, 'spring');
    B.starLine(0, 3, -87, 5, [0, 1.3, -1.1]);
    B.floor(0, 6.4, -95, 8, 6, 'rock');
    B.floor(-5, 9.2, -102, 7, 6, 'rock');
    B.floor(5, 12.0, -109, 7, 6, 'rock');
    B.starLine(-5, 10.6, -102, 3, [0, .2, -1.2]);
    B.enemy('prickle', -5, 9.2, -102, {});
    B.crate(5, 12.0, -109, 'star');

    /* --- the crumbling causeway home ------------------------------------- */
    B.mover(-4, 12.0, -117, 5, 5, 1, [4, 12.0, -117], 4.4);
    B.mover(4, 12.0, -125, 5, 5, 1, [-4, 12.0, -125], 4.8);
    B.mover(0, 12.0, -133, 5, 5, 1, [0, 15.5, -133], 5.2);
    B.floor(0, 15.5, -141, 13, 10, 'sand');                 // z -136 .. -146
    B.enemy('grumblin', -3, 15.5, -139, { axis: 'x', range: 7 });
    B.enemy('grumblin', 3, 15.5, -143, { axis: 'x', range: 7 });
    B.crateRow(-4.4, 15.5, -137, 5, 'plain', [2.2, 0, 0]);
    B.crate(0, 15.5, -143, 'life');
    B.starLine(0, 16.9, -138, 6, [0, 0, -1.6]);
    B.goal(0, 15.5, -145);
  },
},
];

export const byId = id => LEVELS.find(l => l.id === id);
