// node tools/genmusic.js [name ...]
//
// Generates level music with MiniMax Music 3 on the local 4090, through the
// ComfyUI instance on :8188, and drops the mp3 straight into assets/audio/.
//
// Start ComfyUI first (it is NOT auto-started, and it cannot share the GPU with
// the Krea2 stack on :8189 — run one at a time):
//   cd /d/ComfyUI_windows_portable
//   ./python_embeded/python.exe -s ComfyUI/main.py --port 8188 --use-sage-attention --disable-auto-launch
//
// Graph is the stock "Text to Music (MiniMax Music 3)" template, flattened out
// of its subgraph into API form. ~3 min per 60s track.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = process.env.COMFY || 'http://127.0.0.1:8188';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'audio');

// Captions follow the model's "Global Metadata:" convention, and every one says
// instrumental — a kids' platformer must not have a singer competing with the SFX.
//
// This goes in the model's `lyrics` slot. It is NOT optional: with a genuinely
// empty lyrics field the model decides the song is over after ~14s regardless of
// max_duration, which is a ceiling and not a target.
//
// The section TAGS are the whole trick. The bodies are not, and they used to cost
// us: the model sings whatever is in the lyrics slot, and the first coast track
// had faint wordless vocals that were almost certainly it performing the word
// "instrumental". That was left alone for a while because emptying the bodies was
// assumed to risk the 14-second failure. Measured 2026-08-15, identical seed 8836
// and identical caption, only the bodies differing:
//
//     [Intro] + "(instrumental)"  ->  66.0s
//     [Intro] + nothing           ->  100.0s   (the full max_duration)
//
// So the assumption was wrong, and empty bodies are now the default. WORDED is
// kept because jungle and title were rendered with it and re-rolling music the
// kid already knows is a real cost, not a free consistency win.
const WORDED = `[Intro]
(instrumental)

[Theme A]
(instrumental)

[Theme B]
(instrumental)

[Theme A reprise]
(instrumental)

[Bridge]
(instrumental)

[Theme A final]
(instrumental)

[Outro]
(instrumental)`;

// The default: the same tags, no bodies. Pass `structure: WORDED` on a track to
// go back to the old form.
const STRUCTURE = WORDED.replace(/\(instrumental\)\n?/g, '');

// What we are steering AWAY from. Every caption in TRACKS says "no vocals" and
// for frost it sang anyway, twice, on two different seeds — because until now
// the negative conditioning was zeroed out and there was nothing to steer away
// FROM. Describe the unwanted thing positively here; that is how CFG reads it.
const NEGATIVE = `Global Metadata: A song with a lead singer. Female vocalist singing words, male vocalist singing words, pop vocal performance.
Sung lyrics, verses and a chorus with words, lead vocal melody, backing vocals, harmonised voices, choir, humming, wordless vowel singing, ooh and aah vocal pads, spoken word, rap.
The human voice is the main instrument and it is mixed loud and in front.`;

export const TRACKS = {
  // structure: WORDED pinned so a re-render reproduces the track that shipped —
  // this is music the kid already knows.
  jungle: {
    seconds: 100, seed: 7412, structure: WORDED,
    caption: `Global Metadata: Upbeat orchestral video-game platformer theme, playful jungle adventure. 132 BPM, C major. Instrumental, no vocals, no singing.
Bright marimba and xylophone lead melody, tribal hand percussion, congas and shakers, warm pizzicato strings, cheerful muted brass stabs, light flute countermelody.
Bouncy, sunny, energetic, family-friendly, classic Nintendo platformer energy. Clean loop, consistent tempo throughout.`,
  },
  // Re-rolled 2026-08-15: the 2291 take had faint wordless singing and a piece
  // that never settled. New seed, and the caption now spends three separate
  // clauses saying no voice — one mention was evidently not enough weight.
  coast: {
    seconds: 100, seed: 8836,
    caption: `Global Metadata: Breezy tropical video-game beach level theme. 124 BPM, F major. Purely instrumental. No vocals, no singing, no voice, no choir, no humming, no vocal pads.
Steel drum lead melody, bright ukulele strumming, clean surf guitar, warm brass pads, bongo and shaker groove, soft synth pad.
Relaxed but forward-moving, sunny, playful, holiday feeling. Strong memorable melody. Clean loop, consistent tempo throughout.`,
  },
  // Re-rolled three times, 2026-08-15/16, because it kept SINGING — a woman,
  // indistinct words. Rewording the caption did nothing: seeds 3390, 5821, 2077
  // and 9012 all sang with "no vocals" said seven different ways.
  //
  // What actually worked, measured with tools/vocalcheck.py (ratio = vocal-stem
  // energy over instrumental-stem energy, so lower is cleaner):
  //
  //     seed 2077, cfg 1.7, zeroed negative   +2.3 dB   sings
  //     seed 2077, cfg 1.7, real negative     +0.7 dB   sings
  //     seed 9012, cfg 2.6, real negative     +0.5 dB   sings
  //     seed 1337, cfg 3.4, real negative     -8.3 dB   borderline
  //     seed 4410, cfg 2.6, real negative    -48.7 dB   SHIPPED
  //
  // So: the seed dominates, the negative and a higher cfg help, and the only
  // reliable move is to roll several and MEASURE. Every other track scores
  // between -10 and -36 dB, so -48.7 is cleaner than anything else in the game.
  //
  // Seed also decides LENGTH: 5821 stopped at 44.7s, 2077 ran the full 100s
  // ceiling, this one lands at 66s. All are fine; check it before judging.
  frost: {
    seconds: 100, seed: 4410, cfg: 2.6,
    caption: `Global Metadata: Sparkling icy mountain level theme for a children's video game. 118 BPM, A major. Purely instrumental. No vocals, no singing, no voice, no choir, no humming, no vocal pads, no lyrics.
Crystalline glockenspiel and celesta lead, icy tubular bells, light pizzicato strings, warm french horn countermelody, brushed snare and shaker, gentle timpani swells.
Crisp, wintry, adventurous and warm rather than cold, family-friendly. Strong memorable melody. Instrumental only — every part is played, none of it is sung. Clean loop, consistent tempo throughout.`,
  },
  reef: {
    seconds: 100, seed: 6174,
    caption: `Global Metadata: Dreamy underwater coral reef level theme for a children's video game. 104 BPM, D major. Purely instrumental. No vocals, no singing, no voice, no choir.
Warm marimba melody, rolling harp arpeggios, mellow flute countermelody, deep round bass, soft mallet percussion, wide shimmering reverb pad, occasional bubbling chimes.
Floating, calm, curious, gently swaying, family-friendly. Clean loop, consistent tempo throughout.`,
  },
  cosmic: {
    seconds: 110, seed: 4271,
    caption: `Global Metadata: Driving cosmic rocket-flight finale theme for a children's space platformer. 138 BPM, E minor to E major. Purely instrumental. No vocals, no singing, no voice, no choir.
Heroic brass melody, fast arpeggiated synth, punchy timpani and taiko, soaring strings, sparkling bell accents, energetic rock drum kit.
Triumphant, urgent, high-stakes final-level energy that resolves major at the end. Clean loop, consistent tempo throughout.`,
  },
  /* ---- World 3 + the two borrowed levels, 2026-08-21 ----
   * All five screened with tools/roll.py: six seeds each, measured with
   * tools/vocalcheck.py, cleanest kept. 32 takes for five tracks.
   *
   * `cfg: 2.6` throughout — the KSampler cfg frost shipped with. `arCfg` is
   * NOT set on any of them: the A/B at the top of the file showed 6.0 buys
   * 0.4 dB of vocal reduction and costs 30% of the track's length.
   *
   * TWO of the captions below are reworded, and that is the real lesson of
   * this round. Read the note under `dunes`.
   */
  // Rendered five times against the ORIGINAL caption — which asked for
  // "spaghetti-western" and "mariachi" — and sang every time; the best of six
  // seeds was -10.1 dB, which is barely inside the threshold. The caption
  // below names no genre at all, only instruments, and seed 5150 came back at
  // -14.7 dB at the full 100s.
  //
  // This does NOT contradict the frost finding that "no vocals" wording is
  // useless. Saying "no singing" more firmly does nothing. REMOVING the words
  // that imply a singer — a genre that is partly defined by its vocal, or a
  // sustained pad — is a different intervention, and it works.
  dunes: {
    seconds: 100, seed: 5150, cfg: 2.6,
    caption: `Global Metadata: Sunbaked desert canyon level theme for a children's video game. 116 BPM, A minor lifting to A major. Purely instrumental. No vocals, no singing, no voice, no choir, no humming, no whistling.
Nylon-string acoustic guitar picking the lead melody, bright solo trumpet answering it, castanets and hand claps, shaker and low tom groove, upright bass walking underneath, tambourine.
Dusty, warm, adventurous, wide open, family-friendly. Struts along rather than races. The melody is carried by the guitar and the trumpet. Instrumental only — every part is played on an instrument, none of it is sung. Clean loop, consistent tempo throughout.`,
  },
  // The other rewrite, and the clearest result in the set. The original asked
  // for "wide shimmering reverb pad" and "long ringing tails" and sang on ALL
  // SIX seeds (best -8.8 dB, a fail). Sustained tonal energy is what a vocal
  // stem looks like to source separation, so an ambient wash cannot measure
  // clean whether or not anybody is singing on it — and it is the wrong music
  // for a platformer anyway. "Every part is plucked or struck, nothing
  // sustained or washy" got -44.1 dB on the FIRST seed tried.
  lunar: {
    seconds: 100, seed: 8836, cfg: 2.6,
    caption: `Global Metadata: Weightless moonlit low-gravity level theme for a children's space platformer. 96 BPM, F sharp minor resolving to A major. Purely instrumental. No vocals, no singing, no voice, no choir, no humming, no vocal pads, no synth pads.
Celesta and glockenspiel playing a clear stepping melody, plucked harp arpeggios, pizzicato strings, tuned bells, light brushed mallet percussion, round soft bass, occasional timpani.
Floating and full of wonder but always moving — every part is plucked or struck, nothing sustained or washy. Family-friendly. The melody is carried by the celesta. Instrumental only — none of it is sung. Clean loop, consistent tempo throughout.`,
  },
  // Clean on the first seed tried (-40.1 dB). Nothing in this caption implies
  // a voice, which is the point.
  skyway: {
    seconds: 100, seed: 6174, cfg: 2.6,
    caption: `Global Metadata: Bright airy sky-garden level theme for a children's platformer, high above the clouds. 128 BPM, G major. Purely instrumental. No vocals, no singing, no voice, no choir, no humming, no vocal pads.
Sparkling pizzicato string melody, bright flute and piccolo countermelody, rolling harp glissandi, glockenspiel accents, light kit drums with brushes, warm horn pads, wind chimes.
Breezy, buoyant, optimistic, skipping along — the feeling of being very high up on a clear day. Family-friendly. Strong memorable melody. Instrumental only — every part is played, none of it is sung. Clean loop, consistent tempo throughout.`,
  },
  // Clean on the first seed (-25.3 dB).
  cavern: {
    seconds: 100, seed: 4410, cfg: 2.6,
    caption: `Global Metadata: Deep crystal mine level theme for a children's video game, mysterious but never frightening. 108 BPM, D minor. Purely instrumental. No vocals, no singing, no voice, no choir, no humming, no vocal pads.
Vibraphone and marimba lead melody, low pizzicato strings walking underneath, tuned crystal bell tones, soft mallet toms, distant metallic pings, warm low clarinet countermelody, occasional timpani rumble.
Cavernous, glittering, curious, a little bit spooky in a fun way — echoing and spacious. Family-friendly. Instrumental only — every part is played, none of it is sung. Clean loop, consistent tempo throughout.`,
  },
  // Six seeds; the first five sang (-2.8 to -9.9) and the last came back at
  // -26.3 dB. 60s is short for a boss track but the seed decides length and
  // this is the one that did not sing.
  castle: {
    seconds: 110, seed: 2468, cfg: 2.6,
    caption: `Global Metadata: Comedic heroic final boss theme for a children's platformer — a grand castle march that takes itself slightly too seriously. 140 BPM, C minor lifting to C major. Purely instrumental. No vocals, no singing, no voice, no choir, no humming, no chanting.
Big bold brass fanfare melody, pompous low tuba and trombone counterline, marching snare and rolling timpani, crashing orchestral hits, sweeping strings, pipe organ stabs, tubular bells.
Grand, urgent, boisterous and funny rather than menacing — a villain who is secretly your dad. Resolves triumphantly major at the end. Family-friendly. Instrumental only — every part is played, none of it is sung. Clean loop, consistent tempo throughout.`,
  },
  title: {
    seconds: 70, seed: 5150, structure: WORDED,   // as shipped; see jungle
    caption: `Global Metadata: Heroic cosmic main-theme fanfare for a children's space platformer. 120 BPM, D major. Instrumental, no vocals, no singing.
Big triumphant brass fanfare, sparkling celesta and glockenspiel, sweeping strings, rolling timpani, twinkling bells.
Wondrous, adventurous, uplifting, cinematic title-screen energy. Clean loop.`,
  },
};

function graph(spec, prefix) {
  const { caption, seconds, seed, structure } = spec;
  return {
    1: { class_type: 'UNETLoader', inputs: { unet_name: 'minimax_music3_dit_fp16.safetensors', weight_dtype: 'default' } },
    2: { class_type: 'CLIPLoader', inputs: { clip_name: 'minimax_music3_text_encoder_pruned_int8_convrot.safetensors', type: 'minimax', device: 'default' } },
    3: { class_type: 'VAELoader', inputs: { vae_name: 'minimax_music3_dav.safetensors' } },
    // `cfg_scale` HERE is not the same knob as the KSampler's cfg below, and
    // the difference is the single most useful thing anyone has learned about
    // this model. This one drives the AUTOREGRESSIVE stage, which decides the
    // structure and — crucially — the VOCAL DELIVERY. The KSampler's drives
    // acoustic synthesis and cannot make the model stop singing.
    //
    // The stock template sets both to 1.7, and at 1.7 the model treats the
    // caption's genre as a suggestion: it defaults to sung pop no matter what
    // you asked for. That is what really cost frost three re-rolls and a day
    // of seed roulette while the caption was reworded seven ways — the caption
    // was never the problem, and neither, mostly, was the seed.
    //
    // Left at 1.7 by default so the six tracks that shipped still reproduce
    // exactly. Every World 3 track sets `arCfg: 6`. See the A/B in AGENTS.md.
    4: {
      class_type: 'MiniMaxMusic3TextEncode',
      inputs: { clip: ['2', 0], caption, lyrics: structure ?? STRUCTURE, seed, max_duration: seconds, cfg_scale: spec.arCfg ?? 1.7, top_k: 50 },
    },
    // The NEGATIVE prompt. This slot used to be ConditioningZeroOut — an empty
    // negative, so CFG was pushing away from nothing at all while every caption
    // in TRACKS politely asked for no vocals.
    //
    // Worth knowing how much it is actually worth, measured with
    // tools/vocalcheck.py on the SAME seed (2077): zeroed-out negative scored
    // +2.3 dB of vocals over the instrumental, this negative +0.7 dB. Real, and
    // nowhere near enough on its own — the seed dominates. It is kept because
    // it costs nothing and it helps; it is not the fix on its own.
    5: {
      class_type: 'MiniMaxMusic3TextEncode',
      inputs: { clip: ['2', 0], caption: NEGATIVE, lyrics: structure ?? STRUCTURE, seed, max_duration: seconds, cfg_scale: spec.arCfg ?? 1.7, top_k: 50 },
    },
    // seconds comes from the text encode, not the widget — the latent length
    // must match the conditioning the model actually produced.
    6: { class_type: 'EmptyMiniMaxMusic3LatentAudio', inputs: { seconds: ['4', 1], batch_size: 1 } },
    7: {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0], positive: ['4', 0], negative: ['5', 0], latent_image: ['6', 0],
        seed, steps: 30, cfg: spec.cfg ?? 1.7, sampler_name: 'euler', scheduler: 'simple', denoise: 1,
      },
    },
    // TILED, always. Plain `VAEDecodeAudio` does not throw on a long song — it
    // takes the whole ComfyUI PROCESS down with a native `Fatal Python error:
    // Aborted` inside comfy/ldm/minimax_music/dav.py, and the client just sees
    // the socket disappear. The template calls the tiled node the "low VRAM"
    // option; on a 24 GB card at full length it is the only one that survives.
    8: {
      class_type: 'VAEDecodeAudioTiled',
      inputs: { samples: ['7', 0], vae: ['3', 0], tile_size: 1536, overlap: 64 },
    },
    // SaveAudioMP3, not SaveAudioAdvanced: the latter's `format` is a
    // COMFY_DYNAMICCOMBO_V3 whose `quality` nests inside it, which the flat
    // API prompt format can't express. This node is the same thing, flat.
    9: { class_type: 'SaveAudioMP3', inputs: { audio: ['8', 0], filename_prefix: prefix, quality: 'V0' } },
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function generate(name, spec, outName = name) {
  const prefix = `so2/${outName}`;
  const res = await fetch(`${HOST}/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: graph(spec, prefix) }),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`submit failed: ${JSON.stringify(body).slice(0, 600)}`);
  const id = body.prompt_id;
  console.log(`  queued ${name} (${spec.seconds}s cap, ar_cfg ${spec.arCfg ?? 1.7}, cfg ${spec.cfg ?? 1.7}, seed ${spec.seed}) as ${id}`);

  for (let i = 0; i < 400; i++) {
    await sleep(3000);
    const h = await (await fetch(`${HOST}/history/${id}`)).json();
    const entry = h[id];
    if (!entry) { if (i % 10 === 9) console.log(`  …${(i + 1) * 3}s`); continue; }
    if (entry.status?.status_str === 'error')
      throw new Error(`run failed: ${JSON.stringify(entry.status.messages).slice(0, 800)}`);
    const out = Object.values(entry.outputs || {}).flatMap(o => o.audio || []);
    if (!out.length) throw new Error('finished with no audio output');
    const f = out[0];
    const url = `${HOST}/view?filename=${encodeURIComponent(f.filename)}&subfolder=${encodeURIComponent(f.subfolder || '')}&type=${f.type || 'output'}`;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    fs.mkdirSync(OUT, { recursive: true });
    const dest = path.join(OUT, `${outName}.mp3`);
    fs.writeFileSync(dest, buf);
    console.log(`  ✓ ${dest}  (${(buf.length / 1024).toFixed(0)} KB)`);
    return dest;
  }
  throw new Error('timed out after 20 min');
}

// Guarded so tools/looppoints.js can import TRACKS for the BPM hints without
// kicking off a two-hour render.
if (process.argv[1]?.endsWith('genmusic.js')) {
  const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TRACKS);
  // SEED=1234 overrides the pinned seed for one run, so candidates can be
  // screened by tools/vocalcheck.py without editing TRACKS between every roll.
  // Pin the winner back into TRACKS afterwards — a track you cannot reproduce
  // is a track you cannot fix.
  const seed = process.env.SEED ? Number(process.env.SEED) : null;
  const cfg = process.env.CFG ? Number(process.env.CFG) : null;
  // AR= overrides the autoregressive cfg for one run. This is the knob that
  // decides whether the model honours "purely instrumental" at all, so it is
  // the first thing to move when a track sings — before the seed, and long
  // before the caption.
  const arCfg = process.env.AR ? Number(process.env.AR) : null;
  // CAPTION_FILE / LYRICS_FILE swap the prompt for one run without editing
  // TRACKS. Screening a reworded caption against the pinned one is otherwise a
  // git-stash dance, and the whole lesson of frost is that you have to be able
  // to A/B cheaply or you end up theorising instead of measuring.
  const caption = process.env.CAPTION_FILE ? fs.readFileSync(process.env.CAPTION_FILE, 'utf8').trim() : null;
  const structure = process.env.LYRICS_FILE ? fs.readFileSync(process.env.LYRICS_FILE, 'utf8') : null;
  for (const name of want) {
    if (!TRACKS[name]) { console.error(`no such track: ${name} (have ${Object.keys(TRACKS).join(', ')})`); process.exit(1); }
    console.log(`\n── ${name}${seed ? `  (seed override ${seed})` : ''}`);
    const spec = { ...TRACKS[name], ...(seed ? { seed } : {}), ...(cfg ? { cfg } : {}),
                   ...(arCfg ? { arCfg } : {}), ...(caption ? { caption } : {}),
                   ...(structure ? { structure } : {}) };
    // OUT= writes somewhere other than <name>.mp3, so a screening roll cannot
    // overwrite a track that already shipped.
    await generate(name, spec, process.env.OUT_NAME || name);
  }
  console.log('\nRemember: add each id to TRACKS in src/audio.js or the game stays silent.');
}
