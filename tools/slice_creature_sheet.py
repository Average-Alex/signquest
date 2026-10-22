"""Cut a sheet of numbered creature pictures into game sprites.

    python tools/slice_creature_sheet.py sheet.png pup,owl,golem,... [--bosses owl,bat]

For when an image generator puts many creatures on one white sheet (with
little number labels) instead of one per picture. Each creature is found as a
blob of non-white pixels; the dark number labels are dropped, loose bits
(sparkles, bubbles) join the nearest creature, and the creatures are read in
order: top row left to right, then the next row. The ids you pass name them
in that order. Each is then made into a sprite like tools/pixelize_creature.py
does, into assets/creatures/<id>.png.
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

from pixelize_creature import cut_background, outline, reduce_palette, shrink, _pad

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "creatures"
WHITE_TOLERANCE = 30
MERGE_PX = 5  # blobs this close together are one creature (fur tufts, flames)
ATTACH_PX = 45  # small loose bits this close to a creature belong to it
SMALL = 600  # pixels: blobs under this are loose bits or labels


def find_blobs(im: Image.Image):
    """Connected groups of non-white pixels (after growing them a little, so
    nearly-touching parts join). Returns [{pixels, box, area}]."""
    w, h = im.size
    mask = im.convert("L").point(lambda v: 255 if v < 255 - WHITE_TOLERANCE else 0)
    # A colored pixel can be bright: count anything not near-white in any channel.
    rgb = im.load()
    m = mask.load()
    for y in range(h):
        for x in range(w):
            if not m[x, y] and min(rgb[x, y]) < 255 - WHITE_TOLERANCE:
                m[x, y] = 255
    grown = mask.filter(ImageFilter.MaxFilter(MERGE_PX * 2 + 1)).load()
    seen = bytearray(w * h)
    blobs = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or not grown[sx, sy]:
                continue
            queue = deque([(sx, sy)])
            seen[sy * w + sx] = 1
            pixels = []
            x0 = y0 = 10**9
            x1 = y1 = -1
            while queue:
                x, y = queue.popleft()
                if m[x, y]:
                    pixels.append((x, y))
                x0, y0, x1, y1 = min(x0, x), min(y0, y), max(x1, x), max(y1, y)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and grown[nx, ny]:
                        seen[ny * w + nx] = 1
                        queue.append((nx, ny))
            if pixels:
                blobs.append({"pixels": pixels, "box": (x0, y0, x1, y1), "area": len(pixels)})
    return blobs


def is_label(im: Image.Image, blob) -> bool:
    """Number labels: small, and dark grey (not a colored sparkle)."""
    if blob["area"] >= SMALL:
        return False
    px = im.load()
    r = g = b = 0
    for x, y in blob["pixels"]:
        cr, cg, cb = px[x, y][:3]
        r, g, b = r + cr, g + cg, b + cb
    n = blob["area"]
    r, g, b = r / n, g / n, b / n
    return max(r, g, b) < 110 and max(r, g, b) - min(r, g, b) < 30


def box_gap(a, b) -> float:
    dx = max(0, max(a[0], b[0]) - min(a[2], b[2]))
    dy = max(0, max(a[1], b[1]) - min(a[3], b[3]))
    return (dx * dx + dy * dy) ** 0.5


def solid(im: Image.Image):
    px = im.load()
    w, h = im.size
    return [[min(px[x, y]) < 255 - WHITE_TOLERANCE for x in range(w)] for y in range(h)]


def find_labels(im: Image.Image):
    """The number labels, as boxes in reading order (a two-digit number's
    digits are joined into one)."""
    global MERGE_PX
    keep, MERGE_PX = MERGE_PX, 1
    digits = sorted((b["box"] for b in find_blobs(im) if is_label(im, b)), key=lambda b: (b[1], b[0]))
    MERGE_PX = keep
    labels = []
    for d in digits:
        last = labels[-1] if labels else None
        if last and abs(d[1] - last[1]) < 8 and 0 <= d[0] - last[2] < 12:
            labels[-1] = (last[0], min(last[1], d[1]), d[2], max(last[3], d[3]))
        else:
            labels.append(d)
    rows = []
    for lab in sorted(labels, key=lambda b: b[1]):
        if rows and abs(lab[1] - rows[-1][0][1]) < 30:
            rows[-1].append(lab)
        else:
            rows.append([lab])
    return [sorted(r) for r in rows]


def valley(counts, lo, hi):
    """Where in counts[lo:hi] the fewest pixels cross: the best place to cut."""
    lo, hi = max(0, lo), min(len(counts), hi)
    return min(range(lo, hi), key=lambda i: (counts[i], abs(i - hi)))


def group_creatures(im: Image.Image, count: int):
    """One cell per number label: rows and columns are cut where the fewest
    pixels cross near each label, and the cell keeps its biggest creature
    (plus loose bits near it)."""
    w, h = im.size
    rows = find_labels(im)
    filled = solid(im)
    label_boxes = [b for r in rows for b in r]
    for x0, y0, x1, y1 in label_boxes:  # labels aren't part of any creature
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                filled[y][x] = False
    row_counts = [sum(r) for r in filled]
    tops = [0] + [valley(row_counts, r[0][1] - 45, r[0][1] + 6) for r in rows[1:]] + [h]
    creatures = []
    for i, labels in enumerate(rows):
        top, bottom = tops[i], tops[i + 1]
        col_counts = [sum(filled[y][x] for y in range(top, bottom)) for x in range(w)]
        lefts = [0] + [valley(col_counts, lab[0] - 70, lab[0] + 6) for lab in labels[1:]] + [w]
        for j in range(len(labels)):
            cell = (lefts[j], top, lefts[j + 1], bottom)
            creatures.append(biggest_in(im, filled, cell))
    if len(creatures) != count:
        raise SystemExit(f"Found {len(creatures)} labelled cells but got {count} ids.")
    return creatures


CELL_PAD = 70  # look this far past a cell's edges, so a creature reaching over it stays whole


def biggest_in(im: Image.Image, filled, cell):
    """The largest blob centered in a cell, plus loose bits centered in it
    near that blob. Blobs are found in a wider area, so a tail that pokes
    over the cut line stays with its creature, and a neighbor's wing that
    pokes in stays out."""
    w, h = im.size
    cx0, cy0, cx1, cy1 = cell
    x0, y0, x1, y1 = max(0, cx0 - CELL_PAD), max(0, cy0 - CELL_PAD // 3), min(w, cx1 + CELL_PAD), min(h, cy1 + CELL_PAD // 3)
    sub = Image.new("RGB", (x1 - x0, y1 - y0), (255, 255, 255))
    src, dst = im.load(), sub.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            if filled[y][x]:
                dst[x - x0, y - y0] = src[x, y]
    global MERGE_PX
    keep, MERGE_PX = MERGE_PX, 0
    blobs = sorted(find_blobs(sub), key=lambda b: -b["area"])
    MERGE_PX = keep
    # A blob reaching deep into the next cell is touching a neighbor: cut it
    # back to this cell instead.
    reach = CELL_PAD * 0.6
    for b in blobs:
        bx0, by0, bx1, by1 = b["box"]
        if bx0 + x0 < cx0 - reach or bx1 + x0 > cx1 + reach:
            b["pixels"] = [(x, y) for x, y in b["pixels"] if cx0 <= x + x0 < cx1]
            b["area"] = len(b["pixels"])
            xs = [x for x, _ in b["pixels"]] or [0]
            ys = [y for _, y in b["pixels"]] or [0]
            b["box"] = (min(xs), min(ys), max(xs), max(ys))
    blobs = sorted((b for b in blobs if b["area"]), key=lambda b: -b["area"])

    def centered(b):
        mx = sum(p[0] for p in b["pixels"]) / b["area"] + x0
        my = sum(p[1] for p in b["pixels"]) / b["area"] + y0
        return cx0 <= mx < cx1 and cy0 <= my < cy1

    blobs = [b for b in blobs if centered(b)]
    main = dict(blobs[0], pixels=list(blobs[0]["pixels"]))
    for bit in blobs[1:]:
        if box_gap(main["box"], bit["box"]) <= ATTACH_PX:
            main["pixels"] += bit["pixels"]
            main["box"] = tuple(f(p, q) for f, p, q in zip((min, min, max, max), main["box"], bit["box"]))
    bx0, by0, bx1, by1 = main["box"]
    return {"pixels": [(x + x0, y + y0) for x, y in main["pixels"]], "box": (bx0 + x0, by0 + y0, bx1 + x0, by1 + y0)}


def isolate(im: Image.Image, creature) -> Image.Image:
    """Just this creature's pixels, on white."""
    x0, y0, x1, y1 = creature["box"]
    out = Image.new("RGB", (x1 - x0 + 3, y1 - y0 + 3), (255, 255, 255))
    src, dst = im.load(), out.load()
    for x, y in creature["pixels"]:
        dst[x - x0 + 1, y - y0 + 1] = src[x, y][:3]
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("sheet")
    parser.add_argument("ids", help="comma-separated creature ids, in reading order")
    parser.add_argument("--bosses", default="", help="ids drawn bigger (96 px, more colors)")
    args = parser.parse_args()
    ids = args.ids.split(",")
    bosses = set(filter(None, args.bosses.split(",")))
    im = Image.open(args.sheet).convert("RGB")
    creatures = group_creatures(im, len(ids))
    if len(creatures) != len(ids):
        raise SystemExit(f"Found {len(creatures)} creatures but got {len(ids)} ids.")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for cid, c in zip(ids, creatures):
        size, colors = (96, 40) if cid in bosses else (80, 32)
        sprite = outline(_pad(reduce_palette(shrink(cut_background(isolate(im, c)), size - 2), colors), 1))
        sprite.save(OUT_DIR / f"{cid}.png")
        print(f"  {cid}: box {c['box']}")
    print(f"Saved {len(ids)} sprites to {OUT_DIR}")


if __name__ == "__main__":
    main()
