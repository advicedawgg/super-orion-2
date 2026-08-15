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
  frost: {
    seconds: 100, seed: 3390,
    caption: `Global Metadata: Sparkling icy mountain level theme for a children's video game. 118 BPM, A major. Purely instrumental. No vocals, no singing, no voice, no choir.
Crystalline glockenspiel and celesta lead, icy tubular bells, light pizzicato strings, soft clarinet countermelody, brushed snare and shaker, gentle timpani swells.
Crisp, wintry, adventurous and warm rather than cold, family-friendly. Clean loop, consistent tempo throughout.`,
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
  title: {
    seconds: 70, seed: 5150, structure: WORDED,   // as shipped; see jungle
    caption: `Global Metadata: Heroic cosmic main-theme fanfare for a children's space platformer. 120 BPM, D major. Instrumental, no vocals, no singing.
Big triumphant brass fanfare, sparkling celesta and glockenspiel, sweeping strings, rolling timpani, twinkling bells.
Wondrous, adventurous, uplifting, cinematic title-screen energy. Clean loop.`,
  },
};

function graph({ caption, seconds, seed, structure }, prefix) {
  return {
    1: { class_type: 'UNETLoader', inputs: { unet_name: 'minimax_music3_dit_fp16.safetensors', weight_dtype: 'default' } },
    2: { class_type: 'CLIPLoader', inputs: { clip_name: 'minimax_music3_text_encoder_pruned_int8_convrot.safetensors', type: 'minimax', device: 'default' } },
    3: { class_type: 'VAELoader', inputs: { vae_name: 'minimax_music3_dav.safetensors' } },
    4: {
      class_type: 'MiniMaxMusic3TextEncode',
      inputs: { clip: ['2', 0], caption, lyrics: structure ?? STRUCTURE, seed, max_duration: seconds, cfg_scale: 1.7, top_k: 50 },
    },
    5: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
    // seconds comes from the text encode, not the widget — the latent length
    // must match the conditioning the model actually produced.
    6: { class_type: 'EmptyMiniMaxMusic3LatentAudio', inputs: { seconds: ['4', 1], batch_size: 1 } },
    7: {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0], positive: ['4', 0], negative: ['5', 0], latent_image: ['6', 0],
        seed, steps: 30, cfg: 1.7, sampler_name: 'euler', scheduler: 'simple', denoise: 1,
      },
    },
    8: { class_type: 'VAEDecodeAudio', inputs: { samples: ['7', 0], vae: ['3', 0] } },
    // SaveAudioMP3, not SaveAudioAdvanced: the latter's `format` is a
    // COMFY_DYNAMICCOMBO_V3 whose `quality` nests inside it, which the flat
    // API prompt format can't express. This node is the same thing, flat.
    9: { class_type: 'SaveAudioMP3', inputs: { audio: ['8', 0], filename_prefix: prefix, quality: 'V0' } },
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function generate(name, spec) {
  const prefix = `so2/${name}`;
  const res = await fetch(`${HOST}/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: graph(spec, prefix) }),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`submit failed: ${JSON.stringify(body).slice(0, 600)}`);
  const id = body.prompt_id;
  console.log(`  queued ${name} (${spec.seconds}s) as ${id}`);

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
    const dest = path.join(OUT, `${name}.mp3`);
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
  for (const name of want) {
    if (!TRACKS[name]) { console.error(`no such track: ${name} (have ${Object.keys(TRACKS).join(', ')})`); process.exit(1); }
    console.log(`\n── ${name}`);
    await generate(name, TRACKS[name]);
  }
  console.log('\nRemember: add each id to TRACKS in src/audio.js or the game stays silent.');
}
