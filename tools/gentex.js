// node tools/gentex.js [name ...]
//
// Generates the world textures with Krea 2 Turbo on the local 4090, through
// the ComfyUI instance on :8188, then makes them tile seamlessly and drops
// them into assets/tex/.
//
// ComfyUI is shared with MiniMax Music and they use the SAME port — start one
// at a time:
//   cd /d/ComfyUI_windows_portable
//   ./python_embeded/python.exe -s ComfyUI/main.py --port 8188 --disable-auto-launch
//
// Graph and sampler settings are lifted from the working Krea2 adapter at
// D:\krea2-adapter\krea2_openai_adapter.py, so they are known-good.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOST = process.env.COMFY || 'http://127.0.0.1:8188';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'tex');
const PY = 'D:/ComfyUI_windows_portable/python_embeded/python.exe';

const UNET = 'krea2_turbo_fp8_scaled.safetensors';
const CLIP = 'Huihui-Qwen3-VL-4B-Instruct-abliterated-fp8_scaled.safetensors';
const VAE = 'qwen_image_vae.safetensors';

// House style, appended to every prompt. Flat even lighting matters: the game
// lights these itself, so any baked highlight or shadow fights the real one.
const STYLE = `Stylised low-poly video-game texture, seamless repeating tile, top-down orthographic view, `
  + `flat even lighting with no baked shadows and no baked highlights, no vignette, `
  + `bright saturated cheerful colours, clean crisp detail, hand-painted look, `
  + `no text, no watermark, no border, no objects, fills the entire frame edge to edge`;

export const TEXTURES = {
  grass: { seed: 1101, prompt: `Lush bright green grass lawn from directly above, short even blades, subtle patches of lighter yellow-green and darker forest green, tiny scattered clover. ${STYLE}` },
  dirt:  { seed: 1102, prompt: `Rich brown packed earth soil from directly above, fine grain, a few small embedded pebbles and dry twigs, warm chocolate and tan tones. ${STYLE}` },
  rock:  { seed: 1103, prompt: `Grey stone cliff rock face, chunky angular faceted blocks with dark crevices between them, cool blue-grey and light silver tones. ${STYLE}` },
  sand:  { seed: 1104, prompt: `Golden tropical beach sand from directly above, fine even grain with gentle ripple lines, warm cream and honey tones, a few tiny shell fragments. ${STYLE}` },
  wood:  { seed: 1105, prompt: `Warm timber planks seen from directly above, straight vertical grain, visible knots, honey and chestnut brown tones, subtle plank divisions. ${STYLE}` },
  ice:   { seed: 1106, prompt: `Pale blue glacier ice surface from directly above, glossy frozen sheet with fine internal cracks and frosted patches, cyan and white tones. ${STYLE}` },
  metal: { seed: 1107, prompt: `Brushed steel diamond-plate metal panel from directly above, raised tread pattern, cool grey and silver tones, light industrial wear. ${STYLE}` },
  water: { seed: 1108, prompt: `Tropical shallow ocean water from directly above, gentle caustic ripples, turquoise and deep teal tones, clean stylised waves. ${STYLE}` },
  // The crate maps one tile per face, so it must NOT be made seamless — it is
  // a single object texture, not a repeating surface.
  crate: {
    seed: 1109, tile: false,
    prompt: `Wooden shipping crate face, square timber panel framed by four thick planks around the border with a bold X of two diagonal planks across the middle, `
      + `warm honey-brown wood grain, chunky and cartoonish. Stylised low-poly video-game texture, flat even lighting, no baked shadows, `
      + `bright saturated colours, fills the entire frame edge to edge, no text, no watermark`,
  },
};

const SIZE = 1024;

const graph = (prompt, seed) => ({
  4: { class_type: 'UNETLoader', inputs: { unet_name: UNET, weight_dtype: 'default' } },
  5: { class_type: 'CLIPLoader', inputs: { clip_name: CLIP, type: 'krea2' } },
  6: { class_type: 'VAELoader', inputs: { vae_name: VAE } },
  7: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['5', 0] } },
  8: { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['5', 0] } },
  9: { class_type: 'EmptySD3LatentImage', inputs: { width: SIZE, height: SIZE, batch_size: 1 } },
  10: {
    class_type: 'KSampler',
    inputs: {
      model: ['4', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ['9', 0],
      seed, steps: 8, cfg: 1.0, sampler_name: 'euler', scheduler: 'simple', denoise: 1.0,
    },
  },
  11: { class_type: 'VAEDecode', inputs: { samples: ['10', 0], vae: ['6', 0] } },
  12: { class_type: 'SaveImage', inputs: { images: ['11', 0], filename_prefix: 'so2tex/tex' } },
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function generate(name, spec) {
  const res = await fetch(`${HOST}/prompt`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: graph(spec.prompt, spec.seed) }),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`submit failed: ${JSON.stringify(body).slice(0, 700)}`);
  const id = body.prompt_id;

  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    const h = await (await fetch(`${HOST}/history/${id}`)).json();
    const entry = h[id];
    if (!entry) continue;
    if (entry.status?.status_str === 'error')
      throw new Error(`run failed: ${JSON.stringify(entry.status.messages).slice(0, 900)}`);
    const imgs = Object.values(entry.outputs || {}).flatMap(o => o.images || []);
    if (!imgs.length) throw new Error('finished with no image output');
    const f = imgs[0];
    const url = `${HOST}/view?filename=${encodeURIComponent(f.filename)}&subfolder=${encodeURIComponent(f.subfolder || '')}&type=${f.type || 'output'}`;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    fs.mkdirSync(OUT, { recursive: true });
    const dest = path.join(OUT, `${name}.png`);
    fs.writeFileSync(dest, buf);
    return dest;
  }
  throw new Error('timed out');
}

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TEXTURES);
for (const name of want) {
  const spec = TEXTURES[name];
  if (!spec) { console.error(`no such texture: ${name} (have ${Object.keys(TEXTURES).join(', ')})`); process.exit(1); }
  process.stdout.write(`${name.padEnd(7)} … `);
  const dest = await generate(name, spec);
  // Make it wrap (unless it's a single-tile object texture), prove it wrapped,
  // and convert to jpg — seamless.py does all three and removes the png.
  const args = [path.join(ROOT, 'tools', 'seamless.py'), dest, String(SIZE)];
  if (spec.tile === false) args.push('--no-tile');
  console.log(execFileSync(PY, args, { encoding: 'utf8' }).trim());
}
console.log(`\nAdd the names to REAL in src/art.js or the game keeps using the procedural ones.`);
