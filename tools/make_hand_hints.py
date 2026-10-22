"""Draw the letter hint pictures in assets/hands/ from our own recorded hands.

    python tools/make_hand_hints.py

Every letter is drawn from its most typical recorded sample in training/data/
(the one closest to that letter's average shape), as a cartoon hand with
arrows pointing at what matters ("thumb across palm"). Re-run it after
recording more, and the pictures follow.

Drawn mirrored, like the game's camera, so it looks like the player's own
hand on screen. Only needs numpy.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "training"))
from hand_features import FINGERS, to_features  # noqa: E402

DATA_DIR = ROOT / "training" / "data"
OUT_DIR = ROOT / "assets" / "hands"
W, H = 440, 300  # picture size
HAND_BOX = (145, 32, 150, 220)  # x, y, w, h: the middle, labels go either side
MAX_PALM_PX = 125  # biggest a palm (wrist to middle knuckle) is drawn
SKIN, SKIN_DARK, LINE, CREASE = "#eab489", "#c98a5f", "#5a3420", "#a8693f"
PAPER, INK, ACCENT = "#fff8ec", "#2b1a10", "#ff7a1a"
FONT = 'font-family="system-ui, sans-serif"'
CHAR_W = 9.5  # rough width of one bold 16px character
WRAP = 12  # characters per label line

# What to point at for each letter: (landmark, label). Landmarks: 0 wrist,
# 4 thumb tip, 8 pointer tip, 12 middle tip, 16 ring tip, 20 pinky tip.
CALLOUTS = {
    "A": [(4, "Thumb on the side")],
    "B": [(8, "Fingers straight up"), (4, "Thumb across palm")],
    "C": [(8, "Curve like a C"), (4, "Thumb curves too")],
    "D": [(8, "Pointer up"), (4, "Others touch thumb")],
    "E": [(8, "Fingertips curl down"), (4, "Thumb tucked under")],
    "F": [(4, "Pointer touches thumb"), (20, "Other fingers up")],
    "G": [(8, "Point sideways"), (4, "Thumb too")],
    "H": [(8, "Two fingers sideways")],
    "I": [(20, "Pinky up"), (4, "Fist")],
    "K": [(8, "Two fingers up"), (4, "Thumb on middle finger")],
    "L": [(8, "Pointer up"), (4, "Thumb out")],
    "M": [(4, "Thumb under 3 fingers")],
    "N": [(4, "Thumb under 2 fingers")],
    "O": [(4, "Fingertips touch thumb")],
    "P": [(8, "Point down"), (4, "Thumb on middle finger")],
    "Q": [(8, "Point down"), (4, "Thumb too")],
    "R": [(12, "Fingers crossed")],
    "S": [(4, "Thumb across front")],
    "T": [(4, "Thumb between fingers")],
    "U": [(12, "Two fingers together")],
    "V": [(8, "Two fingers apart")],
    "W": [(16, "Three fingers spread")],
    "X": [(8, "Hook your pointer")],
    "Y": [(4, "Thumb out"), (20, "Pinky out")],
    "J": [(20, "Draw a J with your pinky")],
    "Z": [(8, "Draw a Z with your pointer")],
}

# J and Z are drawn in the air: shown as the handshape they start from, with
# the path to draw (offsets in pixels from the fingertip, as the player sees it).
MOVES = {
    "J": ("I", 20, [(44, 26), (44, 62), (42, 78), (34, 90), (20, 98), (6, 94), (-2, 82)]),
    "Z": ("D", 8, [(30, 6), (88, 6), (30, 60), (88, 60)]),
}


def load_letters() -> dict[str, list[tuple[np.ndarray, str]]]:
    out: dict[str, list] = {}
    for path in sorted(DATA_DIR.glob("*.csv")):
        with open(path, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                if r["letter"] in CALLOUTS:
                    w = np.array([float(r[f"{a}{i}"]) for i in range(21) for a in "xyz"]).reshape(21, 3)
                    out.setdefault(r["letter"], []).append((w, r["hand"]))
    return out


def typical(samples: list[tuple[np.ndarray, str]]) -> np.ndarray:
    """The sample closest to the average shape (so not a blurry average)."""
    feats = np.stack([to_features(w, h) for w, h in samples])
    return samples[int(np.argmin(((feats - feats.mean(0)) ** 2).sum(1)))][0]


# ---------- Drawing ----------

def mix(a: str, b: str, t: float) -> str:
    """Blend two #rrggbb colours: t=0 gives a, t=1 gives b."""
    ca, cb = (np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)]) for c in (a, b))
    return "#" + "".join(f"{int(v):02x}" for v in ca + (cb - ca) * min(max(t, 0.0), 1.0))


def hand_svg(xy: np.ndarray, depth: np.ndarray, width: float) -> str:
    """A cartoon hand: tapered fingers with knuckle creases over a palm and
    wrist, the farthest parts drawn first (and a little darker) so nearer
    fingers overlap them. xy: (21, 2) picture points. depth: (21,), bigger =
    farther from the camera. width: finger thickness at the knuckle."""
    near, far = depth.min(), depth.max()
    shade = lambda d: mix(SKIN, SKIN_DARK, (d - near) / max(far - near, 1e-6))  # noqa: E731
    pts = lambda idx: " ".join(f"{xy[i][0]:.1f},{xy[i][1]:.1f}" for i in idx)  # noqa: E731
    edge = LINE

    # Wrist: a short forearm going away from the fingers, fading out. Left
    # off when the palm points at the camera (no clear "away" direction).
    parts = []
    down = xy[0] - xy[9]
    if np.linalg.norm(down) > width * 1.8:
        down /= np.linalg.norm(down)
        across = np.array([-down[1], down[0]]) * (np.linalg.norm(xy[5] - xy[17]) * 0.45 + width * 0.35)
        end = xy[0] + down * width * 2.4
        p = lambda v: f"{v[0]:.1f},{v[1]:.1f}"  # noqa: E731
        span = (f'gradientUnits="userSpaceOnUse" x1="{xy[0][0]:.1f}" y1="{xy[0][1]:.1f}" '
                f'x2="{end[0]:.1f}" y2="{end[1]:.1f}"')
        fading = lambda gid, colour: (f'<linearGradient id="{gid}" {span}><stop offset="0.3" stop-color="{colour}"/>'  # noqa: E731
                                      f'<stop offset="1" stop-color="{colour}" stop-opacity="0"/></linearGradient>')
        fade, edges = fading("arm", shade(far)), fading("arm-edge", edge)
        a, b, c, d = xy[0] + across, end + across * 1.1, end - across * 1.1, xy[0] - across
        parts.append((far + 1, f'<defs>{fade}{edges}</defs>'
                               f'<polygon points="{p(a)} {p(b)} {p(c)} {p(d)}" fill="url(#arm)"/>'
                               f'<polyline points="{p(a)} {p(b)}" fill="none" stroke="url(#arm-edge)" stroke-width="3"/>'
                               f'<polyline points="{p(d)} {p(c)}" fill="none" stroke="url(#arm-edge)" stroke-width="3"/>'))

    palm = (0, 1, 2, 5, 9, 13, 17)
    d = depth[list(palm)].mean()
    parts.append((d, f'<polygon points="{pts(palm)}" fill="{shade(d)}" stroke="{edge}" stroke-width="{width + 5:.1f}"/>'
                     f'<polygon points="{pts(palm)}" fill="{shade(d)}" stroke="{shade(d)}" stroke-width="{width:.1f}"/>'))

    for chain in FINGERS:
        d = depth[chain].mean()
        bones = list(zip(chain, chain[1:]))
        # Thinner toward the tip: knuckle 100%, then 88%, then 76%.
        widths = [width * (1 - 0.12 * k) for k in range(len(bones))]
        line = lambda a, b, w, c: (f'<line x1="{xy[a][0]:.1f}" y1="{xy[a][1]:.1f}" x2="{xy[b][0]:.1f}" '  # noqa: E731
                                   f'y2="{xy[b][1]:.1f}" stroke="{c}" stroke-width="{w:.1f}"/>')
        # All the outline first, then all the skin, so there are no seams at the joints.
        svg = "".join(line(a, b, w + 5, edge) for (a, b), w in zip(bones, widths))
        svg += "".join(line(a, b, w, shade(d)) for (a, b), w in zip(bones, widths))
        # Knuckle creases: short lines across the finger at the middle joints.
        for (a, b), w in zip(bones[1:], widths[1:]):
            along = xy[b] - xy[a]
            if np.linalg.norm(along) < w * 0.6:
                continue  # finger points at the camera here: no room for a crease
            across = np.array([-along[1], along[0]]) / np.linalg.norm(along) * w * 0.28
            c1, c2 = xy[a] + across, xy[a] - across
            svg += (f'<line x1="{c1[0]:.1f}" y1="{c1[1]:.1f}" x2="{c2[0]:.1f}" y2="{c2[1]:.1f}" '
                    f'stroke="{CREASE}" stroke-width="1.6"/>')
        parts.append((d, svg))

    out = ['<g stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow)">']
    out += [svg for _, svg in sorted(parts, key=lambda p: -p[0])]
    out.append("</g>")
    return "\n".join(out)


def wrap(text: str) -> list[str]:
    lines, line = [], ""
    for word in text.split():
        if line and len(line) + 1 + len(word) > WRAP:
            lines.append(line)
            line = word
        else:
            line = f"{line} {word}".strip()
    return lines + [line]


def label_svg(x: float, y: float, lines: list[str], anchor: str) -> str:
    top = y - (len(lines) - 1) * 9
    spans = "".join(f'<tspan x="{x:.0f}" y="{top + i * 18:.0f}">{t}</tspan>' for i, t in enumerate(lines))
    return (f'<text text-anchor="{anchor}" dominant-baseline="middle" {FONT} font-size="16" font-weight="700" '
            f'fill="{INK}" stroke="{PAPER}" stroke-width="4" paint-order="stroke">{spans}</text>')


def arrow_svg(start: np.ndarray, end: np.ndarray) -> str:
    """A curved orange arrow from start to end."""
    bend = (start + end) / 2 + np.array([0, -16])
    d = f"M {start[0]:.1f},{start[1]:.1f} Q {bend[0]:.1f},{bend[1]:.1f} {end[0]:.1f},{end[1]:.1f}"
    return (f'<path d="{d}" fill="none" stroke="{PAPER}" stroke-width="8" stroke-linecap="round"/>'
            f'<path d="{d}" fill="none" stroke="{ACCENT}" stroke-width="4" stroke-linecap="round" marker-end="url(#head)"/>')


def letter_svg(letter: str, world: np.ndarray) -> str:
    pts = world[:, :2] * np.array([-1, 1])  # mirrored, like the game camera
    lo, hi = pts.min(0), pts.max(0)
    bx, by, bw, bh = HAND_BOX
    palm = float(np.linalg.norm(world[9] - world[0]))
    # Fill the box, but a hand pointing at the camera looks small: don't blow
    # it up past a normal hand's size.
    s = min(bw / max(hi[0] - lo[0], 1e-6), bh / max(hi[1] - lo[1], 1e-6), MAX_PALM_PX / palm)
    xy = (pts - (lo + hi) / 2) * s + np.array([bx + bw / 2, by + bh / 2])
    # Finger thickness from the real 3D palm length, so a hand pointing at
    # the camera doesn't get stick fingers.
    body = [hand_svg(xy, world[:, 2], palm * s * 0.3)]

    # Labels sit in the margin on the same side as what they point at,
    # spaced out so they don't overlap.
    centre_x = xy[:, 0].mean()
    sides: dict[str, list] = {"left": [], "right": []}
    for idx, text in CALLOUTS[letter]:
        sides["left" if xy[idx][0] < centre_x else "right"].append((xy[idx][1], idx, text))
    for side, items in sides.items():
        last = -1e9
        for y, idx, text in sorted(items):
            y = min(max(y, last + 64, 34), H - 50)
            last = y
            lines = wrap(text)
            text_w = max(len(t) for t in lines) * CHAR_W
            if side == "left":
                body.append(label_svg(10, y, lines, "start"))
                start = np.array([10 + text_w + 8, y])
            else:
                body.append(label_svg(W - 10, y, lines, "end"))
                start = np.array([W - 10 - text_w - 8, y])
            # Stop just short of the point so the arrowhead doesn't cover it.
            gap = start - xy[idx]
            body.append(arrow_svg(start, xy[idx] + gap / max(np.linalg.norm(gap), 1) * 12))

    if letter in MOVES:
        _, tip, offsets = MOVES[letter]
        path = xy[tip] + np.array(offsets, dtype=float)
        d = "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in path)
        body.append(f'<path d="{d}" fill="none" stroke="{PAPER}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>'
                    f'<path d="{d}" fill="none" stroke="{ACCENT}" stroke-width="6" stroke-linecap="round" '
                    f'stroke-linejoin="round" stroke-dasharray="2 9" marker-end="url(#head)"/>')

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img">
<title>Handshape for {letter}</title>
<defs><marker id="head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
<path d="M0,0 L10,5 L0,10 z" fill="{ACCENT}"/></marker>
<filter id="shadow" filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><feDropShadow dx="3" dy="4" stdDeviation="3" flood-color="#5a3420" flood-opacity="0.25"/></filter>
<clipPath id="card"><rect width="{W}" height="{H}" rx="18"/></clipPath></defs>
<rect width="{W}" height="{H}" rx="18" fill="{PAPER}"/>
<g clip-path="url(#card)">
{chr(10).join(body)}
</g>
</svg>
"""


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    letters = load_letters()
    saved = 0
    for letter in CALLOUTS:
        shape = MOVES[letter][0] if letter in MOVES else letter
        if shape not in letters:
            print(f"  {letter}: no recordings of {shape}, skipped")
            continue
        (OUT_DIR / f"{letter}.svg").write_text(letter_svg(letter, typical(letters[shape])), encoding="utf-8")
        saved += 1
    print(f"Saved {saved} hint pictures to {OUT_DIR}")


if __name__ == "__main__":
    main()
