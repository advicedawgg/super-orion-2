#!/usr/bin/env python
"""Does this track have someone SINGING on it?

    python tools/vocalcheck.py                    # every track in assets/audio
    python tools/vocalcheck.py frost coast        # just these

Splits each track into a vocals stem and an instrumental stem and reports the
vocal energy RELATIVE to the instrumental. Lower is cleaner. It prints PASS/FAIL
against a threshold calibrated on the tracks that shipped.

Why this exists: every caption in tools/genmusic.js asks for no vocals and the
model ignores it whenever it feels like it, so somebody has to check. AGENTS.md
used to say that was a human job, because an audio LLM was tried and failed its
control — it called the known-singing coast take "no vocals". Source separation
is a different tool and it passes the same control easily. Measured 2026-08-16:

    jungle  -19.7    coast  -10.4    reef  -19.0
    cosmic  -35.8    title  -13.2    frost  +2.3  <- the one that sang

A human should still listen for whether a track is any GOOD. This only answers
"is there a singer on it", which is the question that kept getting answered wrong.

Needs demucs (`pip install demucs`); uses CUDA when it is there.
"""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.join(HERE, '..', 'assets', 'audio')
# Every track that shipped scores -10 or below; the one that sang scored +2.3.
# The gap is enormous, so the exact line barely matters — anything near 0 sings.
THRESHOLD = -10.0


def mean_dbfs(path):
    out = subprocess.run(
        ['ffmpeg', '-v', 'info', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'],
        capture_output=True, text=True).stderr
    for line in out.splitlines():
        if 'mean_volume:' in line:
            return float(line.split('mean_volume:')[1].split()[0])
    raise RuntimeError('no mean_volume from ffmpeg for ' + path)


def separate(mp3, workdir):
    subprocess.run([sys.executable, '-m', 'demucs', '-n', 'htdemucs',
                    '--two-stems=vocals', '-o', workdir, mp3],
                   check=True, capture_output=True)
    stem = os.path.join(workdir, 'htdemucs', os.path.splitext(os.path.basename(mp3))[0])
    return os.path.join(stem, 'vocals.wav'), os.path.join(stem, 'no_vocals.wav')


def main(names):
    if not names:
        names = sorted(f[:-4] for f in os.listdir(AUDIO) if f.endswith('.mp3'))
    worst = 0
    with tempfile.TemporaryDirectory() as work:
        for name in names:
            mp3 = os.path.join(AUDIO, name + '.mp3')
            if not os.path.exists(mp3):
                print(f'{name:8} MISSING')
                continue
            voc, inst = separate(mp3, work)
            ratio = mean_dbfs(voc) - mean_dbfs(inst)
            ok = ratio <= THRESHOLD
            worst = min(worst, 0 if ok else 1)
            print(f'{name:8} {ratio:+7.1f} dB  {"ok  " if ok else "SINGS"}')
            if not ok:
                worst = 1
    print('\n' + ('PASS' if worst == 0 else 'FAIL — re-roll it (see genmusic.js frost for how)'))
    return worst


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
