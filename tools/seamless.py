"""Make a texture tile, and prove it does.

    python tools/seamless.py <image.png> [output_size]

Diffusion models don't produce wrapping textures, and a visible seam every 4
world units is the most obvious thing in a 3D scene. The fix is the classic
overlap-crossfade-and-crop:

    take a strip of width B off each end, blend the tail into the head across
    that strip, then drop the now-redundant tail.

That makes the new first column literally adjacent to the new last column in
the source image, so it wraps by construction rather than by hope — and the
crossfade removes the hard edge that adjacency alone would leave.

Run inside ComfyUI's embedded python, which already has PIL and numpy:
    D:/ComfyUI_windows_portable/python_embeded/python.exe
"""
import sys
import numpy as np
from PIL import Image

BLEND = 0.16          # fraction of each axis consumed by the crossfade


def wrap_axis(a, axis, frac):
    n = a.shape[axis]
    b = max(1, int(n * frac))
    a = np.moveaxis(a, axis, 0)
    t = np.linspace(0.0, 1.0, b).reshape(-1, 1, 1)
    merged = a[n - b:] * (1.0 - t) + a[:b] * t
    out = a.copy()
    out[:b] = merged
    out = out[:n - b]
    return np.moveaxis(out, 0, axis)


def seam_ratio(a, axis):
    """Edge discontinuity vs a typical neighbouring-line difference.

    ~1.0 means the wrap is indistinguishable from any other adjacent pair.
    Large means there is still a visible seam.
    """
    a = np.moveaxis(a, axis, 0)
    seam = np.abs(a[0] - a[-1]).mean()
    typical = np.abs(np.diff(a, axis=0)).mean()
    return seam / typical if typical else float('inf')


def main():
    import os
    path = sys.argv[1]
    size = int(sys.argv[2]) if len(sys.argv) > 2 else None
    tile = '--no-tile' not in sys.argv

    src = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)

    if tile:
        before = (seam_ratio(src, 0), seam_ratio(src, 1))
        out = wrap_axis(src, 0, BLEND)
        out = wrap_axis(out, 1, BLEND)
        after = (seam_ratio(out, 0), seam_ratio(out, 1))
        # The ratio is against a TYPICAL adjacent-line difference, so a very
        # smooth texture reads as a bad ratio on a tiny absolute error. Judge
        # on the absolute seam too — 3/255 is invisible however smooth it is.
        seam_abs = max(np.abs(out[0] - out[-1]).mean(),
                       np.abs(out[:, 0] - np.moveaxis(out, 1, 0)[-1]).mean())
        ok = max(after) < 2.0 or seam_abs < 4.0
        note = (f'seam {before[0]:.1f}/{before[1]:.1f} -> {after[0]:.2f}/{after[1]:.2f} '
                f'(abs {seam_abs:.1f}/255)  {"OK" if ok else "STILL SEAMS"}')
    else:
        out, note = src, 'single tile, not wrapped'

    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    if size:
        im = im.resize((size, size), Image.LANCZOS)

    # JPEG, not PNG: these are photographic-ish and need no alpha, and a 1.2 MB
    # PNG per texture is not something to hand a kid on a phone.
    dest = os.path.splitext(path)[0] + '.jpg'
    im.save(dest, quality=88, optimize=True, subsampling=0)
    if dest != path and os.path.exists(path):
        os.remove(path)
    kb = os.path.getsize(dest) // 1024
    print(f'{note}  {im.size[0]}px  {kb}KB')


if __name__ == '__main__':
    main()
