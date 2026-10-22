"""Turn a generated creature picture into a game sprite.

    python tools/pixelize_creature.py picture.jpg assets/creatures/slime.png
    python tools/pixelize_creature.py picture.jpg out.png --size 64 --colors 28

The creature art in assets/creatures/ was generated as pixel-art pictures on
a plain white background (see assets/creatures/README.md). This:
  1. cuts out the white background (flood fill from the edges, so white
     inside the creature, like eye shines, stays)
  2. crops to the creature and shrinks it to SIZE x SIZE, averaging each
     block of pixels (which also cleans up JPEG noise)
  3. reduces it to a small palette, like real pixel art
  4. adds a crisp dark outline around the outside
Needs Pillow: pip install pillow
"""

from __future__ import annotations

import argparse
from collections import deque

from PIL import Image

OUTLINE = (26, 18, 38, 255)


def cut_background(im: Image.Image, tolerance: int = 46) -> Image.Image:
    """Clear every near-white pixel connected to the picture's edge."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    near_white = lambda x, y: all(c >= 255 - tolerance for c in px[x, y])  # noqa: E731
    clear = [[False] * w for _ in range(h)]
    queue = deque((x, y) for x in range(w) for y in (0, h - 1)) + deque((x, y) for y in range(h) for x in (0, w - 1))
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or clear[y][x] or not near_white(x, y):
            continue
        clear[y][x] = True
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    out = rgb.convert("RGBA")
    o = out.load()
    for y in range(h):
        for x in range(w):
            if clear[y][x]:
                o[x, y] = (0, 0, 0, 0)
    return out


def shrink(im: Image.Image, size: int) -> Image.Image:
    """Crop to the creature, pad to a square, and average down to size x size
    (colors weighted by coverage, so the cut-out edge doesn't go grey)."""
    im = im.crop(im.getbbox())
    side = max(im.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(im, ((side - im.width) // 2, side - im.height))  # stand on the bottom edge
    alpha = square.getchannel("A")
    rgb = Image.composite(square.convert("RGB"), Image.new("RGB", square.size), alpha)
    small_rgb = rgb.resize((size, size), Image.BOX)
    small_a = alpha.resize((size, size), Image.BOX)
    out = Image.new("RGBA", (size, size))
    o, c, a = out.load(), small_rgb.load(), small_a.load()
    for y in range(size):
        for x in range(size):
            cover = a[x, y]
            if cover < 110:
                o[x, y] = (0, 0, 0, 0)
            else:
                o[x, y] = tuple(min(255, round(v * 255 / cover)) for v in c[x, y]) + (255,)
    return out


def reduce_palette(im: Image.Image, colors: int) -> Image.Image:
    alpha = im.getchannel("A")
    q = im.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert("RGBA")
    q.putalpha(alpha.point(lambda v: 255 if v else 0))
    return q


def outline(im: Image.Image) -> Image.Image:
    w, h = im.size
    px = im.load()
    solid = lambda x, y: 0 <= x < w and 0 <= y < h and px[x, y][3] > 0  # noqa: E731
    edge = [(x, y) for y in range(h) for x in range(w)
            if not solid(x, y) and any(solid(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge:
        px[x, y] = OUTLINE
    return im


def pixelize(src: str, dest: str, size: int = 64, colors: int = 28) -> None:
    im = cut_background(Image.open(src))
    # One pixel of room on every side for the outline.
    sprite = outline(_pad(reduce_palette(shrink(im, size - 2), colors), 1))
    sprite.save(dest)


def _pad(im: Image.Image, n: int) -> Image.Image:
    out = Image.new("RGBA", (im.width + 2 * n, im.height + 2 * n), (0, 0, 0, 0))
    out.paste(im, (n, n))
    return out


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("src")
    parser.add_argument("dest")
    parser.add_argument("--size", type=int, default=64)
    parser.add_argument("--colors", type=int, default=28)
    args = parser.parse_args()
    pixelize(args.src, args.dest, args.size, args.colors)
    print(f"Saved {args.dest}")
