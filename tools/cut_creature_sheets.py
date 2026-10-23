"""Cut creature evolution sheets into the game's creature pictures.

    python tools/cut_creature_sheets.py SHEETS_DIR

Each sheet is a picture named after a creature (e.g. scorchpup.png): one
creature in three evolution stages, left to right, on a plain white
background (our own art, generated in Canva). This finds the three
creatures, takes the white background away (only the white that touches the
edges, so white bellies and eye shines stay), trims each one, and saves them
facing left - the way foes face you in battle - as
assets/creatures/<id>-1.png, -2.png, and -3.png, each CREATURE_HEIGHT pixels
tall (the game makes later stages bigger itself). Then it lists the painted
creatures in js/painted.js.

Needs Pillow, numpy, and scipy.
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "creatures"
CREATURE_HEIGHT = 256  # each stage's picture height, in pixels
WHITE = 236  # brighter than this on every channel counts as background white


def remove_background(rgb: np.ndarray) -> np.ndarray:
    """Alpha mask: background = near-white pixels connected to the image edge."""
    h, w, _ = rgb.shape
    white = (rgb >= WHITE).all(axis=2)
    bg = np.zeros((h, w), bool)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if white[y, x] and not bg[y, x]:
                bg[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if white[y, x] and not bg[y, x]:
                bg[y, x] = True
                queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                queue.append((ny, nx))
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # Soften the very edge a little, so it isn't jagged.
    edge = np.zeros_like(bg)
    edge[1:-1, 1:-1] = ~bg[1:-1, 1:-1] & (bg[:-2, 1:-1] | bg[2:, 1:-1] | bg[1:-1, :-2] | bg[1:-1, 2:])
    alpha[edge] = 170
    return alpha


def split_creatures(alpha: np.ndarray, count: int = 3) -> list[np.ndarray]:
    """One mask per creature, left to right: the `count` biggest connected
    shapes, with each small loose bit (a spark, a floating flame) joined to
    the nearest of them."""
    labels, n = ndimage.label(alpha > 0)
    if n < count:
        return []
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
    big = [int(i) + 1 for i in np.argsort(sizes)[::-1][:count]]
    centers = {i: c for i, c in zip(range(1, n + 1), ndimage.center_of_mass(alpha > 0, labels, range(1, n + 1)))}
    big.sort(key=lambda i: centers[i][1])
    owner = {i: i for i in big}
    for i in range(1, n + 1):
        if i not in owner:
            owner[i] = min(big, key=lambda b: np.hypot(*(np.subtract(centers[i], centers[b]))))
    lookup = np.zeros(n + 1, int)
    for i, b in owner.items():
        lookup[i] = b
    owned = lookup[labels]
    return [(owned == b) for b in big]


def cut(sheet_path: Path) -> None:
    creature = sheet_path.stem
    img = Image.open(sheet_path).convert("RGB")
    rgb = np.array(img)
    alpha = remove_background(rgb)
    masks = split_creatures(alpha)
    if len(masks) != 3:
        print(f"  {creature}: found {len(masks)} creatures, not 3 - skipped")
        return
    pieces = []
    for mask in masks:
        rows = np.where(mask.any(axis=1))[0]
        cols = np.where(mask.any(axis=0))[0]
        top, bottom, left, right = rows.min(), rows.max() + 1, cols.min(), cols.max() + 1
        own = np.where(mask, alpha, 0)[top:bottom, left:right]
        rgba = np.dstack([rgb[top:bottom, left:right], own]).astype(np.uint8)
        pieces.append(Image.fromarray(rgba, "RGBA"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for stage, piece in enumerate(pieces, 1):
        scale = CREATURE_HEIGHT / piece.height
        size = (max(1, round(piece.width * scale)), CREATURE_HEIGHT)
        piece.resize(size, Image.LANCZOS).save(OUT_DIR / f"{creature}-{stage}.png", optimize=True)
    print(f"  {creature}: saved stages 1-3")


def write_manifest() -> None:
    """js/painted.js: the creatures that have all three painted stages."""
    ids = sorted(
        p.stem[:-2] for p in OUT_DIR.glob("*-1.png")
        if all((OUT_DIR / f"{p.stem[:-2]}-{n}.png").exists() for n in (2, 3))
    )
    listed = "".join(f'\n  "{i}",' for i in ids)
    (ROOT / "js" / "painted.js").write_text(
        "// The creatures with painted art in assets/creatures/<id>-<stage>.png.\n"
        "// Made by tools/cut_creature_sheets.py - don't edit by hand.\n"
        f"export const PAINTED = new Set([{listed}\n]);\n",
        encoding="utf-8",
    )
    print(f"  js/painted.js: {len(ids)} painted creatures")


def main():
    sheets = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "training" / "sheets"
    for path in sorted(sheets.glob("*.png")):
        cut(path)
    write_manifest()


if __name__ == "__main__":
    main()
