#!/usr/bin/env python
"""Roll seeds for a track until one measures clean, then keep it.

    python tools/roll.py                       # every track that has no mp3 yet
    python tools/roll.py dunes lunar           # just these
    SEEDS=11,22,33 python tools/roll.py dunes  # your own seeds

For each seed it renders the track through tools/genmusic.js, measures the take
with the same source separation tools/vocalcheck.py uses, and stops as soon as
one lands under -14 dB. The cleanest take wins and is copied to <name>.mp3.

WHY THIS EXISTS, and the order to try things in:

1. **Reword the caption first.** Not to say "no vocals" more firmly — that has
   never worked and frost burned three re-rolls proving it. Remove the words
   that IMPLY a singer: a genre partly defined by its vocal (mariachi,
   spaghetti-western), or a sustained wash (pads, long reverb tails), which is
   also what a vocal stem looks like to source separation. Measured 2026-08-21:
   lunar sang on all six seeds at best -8.8 dB with "wide shimmering reverb
   pad" in the caption, and scored -44.1 dB on the FIRST seed once the caption
   asked for parts that are plucked or struck instead.
2. **Then roll seeds and measure**, which is what this script automates.
3. **Do not touch the autoregressive cfg.** 1.7 -> 6.0 moves the vocal
   measurement by 0.4 dB and costs 30% of the track's length. See AGENTS.md.

A take is ~3.5 minutes on a 4090 — the negative prompt is a second
MiniMaxMusic3TextEncode, so every render runs the autoregressive stage twice —
plus ~10s of demucs. Budget accordingly before starting a six-seed sweep.

`cap/<track>.txt`, if present, replaces the caption for the run. That is how a
reworded caption gets screened against the pinned one without a git stash.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.environ.get('SO2_ROOT') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(HERE, 'assets', 'audio')
sys.path.insert(0, os.path.join(HERE, 'tools'))
from vocalcheck import separate, mean_dbfs          # noqa: E402

# Comfortably inside the range every shipped track sits in (-10 to -44).
GOOD = float(os.environ.get('GOOD', -14.0))
SEEDS = [int(s) for s in os.environ['SEEDS'].split(',')] if os.environ.get('SEEDS') \
    else [4410, 1337, 8836, 6174, 7412, 2468]
# The seed decides LENGTH as well as vocal content, and a stub is unusable
# however clean it measures — the documented failure is ~14 seconds.
MIN_SECONDS = 30

LOG = os.path.join(HERE, 'roll.log')


def log(msg):
    print(msg, flush=True)
    with open(LOG, 'a', encoding='utf-8') as f:
        f.write(msg + '\n')


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'csv=p=0', path], capture_output=True, text=True).stdout
    try:
        return float(out.strip())
    except ValueError:
        return 0.0


def measure(path):
    with tempfile.TemporaryDirectory() as work:
        voc, inst = separate(path, work)
        return mean_dbfs(voc) - mean_dbfs(inst)


def roll(track):
    cap = os.path.join(HERE, 'cap', track + '.txt')
    reworded = os.path.exists(cap)
    log(f'\n== {track}  (caption: {"reworded from cap/" if reworded else "pinned in TRACKS"})')
    best = None
    for seed in SEEDS:
        cand = f'_roll_{track}_{seed}'
        env = dict(os.environ, SEED=str(seed), OUT_NAME=cand, CFG='2.6', AR='1.7')
        if reworded:
            env['CAPTION_FILE'] = cap
        t0 = time.time()
        r = subprocess.run(['node', 'tools/genmusic.js', track], cwd=HERE, env=env,
                           capture_output=True, text=True)
        path = os.path.join(AUDIO, cand + '.mp3')
        if r.returncode != 0 or not os.path.exists(path):
            log(f'  seed {seed:<6} render failed: {(r.stderr or r.stdout)[-200:]}')
            continue
        dur, ratio = duration(path), measure(path)
        log(f'  seed {seed:<6} {dur:6.1f}s  {ratio:+7.1f} dB  ({time.time() - t0:.0f}s)')
        if dur < MIN_SECONDS:
            log(f'    under {MIN_SECONDS}s — unusable, discarding')
            continue
        if best is None or ratio < best[1]:
            best = (seed, ratio, path, dur)
        if ratio <= GOOD:
            break
    if not best:
        log(f'  !! {track}: no usable take in {len(SEEDS)} seeds')
        return None
    seed, ratio, path, dur = best
    shutil.copyfile(path, os.path.join(AUDIO, track + '.mp3'))
    log(f'  -> kept seed {seed} ({ratio:+.1f} dB, {dur:.1f}s)')
    return {'seed': seed, 'ratio': round(ratio, 1), 'seconds': round(dur, 1),
            'reworded': reworded}


def main(names):
    if not names:
        import re
        src = open(os.path.join(HERE, 'tools', 'genmusic.js'), encoding='utf-8').read()
        known = re.findall(r'\n  (\w+): \{\n    seconds:', src)
        names = [n for n in known if not os.path.exists(os.path.join(AUDIO, n + '.mp3'))]
        if not names:
            print('every track already has an mp3; name one explicitly to re-roll it')
            return 0
    results = {name: r for name in names if (r := roll(name))}
    log('\n' + json.dumps(results, indent=2))
    # Pin the winners back into TRACKS by hand: a track you cannot reproduce is
    # a track you cannot fix, and the seed that won only lives here.
    log('\nNow pin each seed (and any reworded caption) into TRACKS in tools/genmusic.js,')
    log('match the loudness to the rest of the set (AGENTS.md -> Loudness), then run')
    log('tools/looppoints.js.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
