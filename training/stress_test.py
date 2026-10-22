"""Stress-test the letter and moving-sign models without anyone signing.

    python training/stress_test.py              # test the shipped models in model/
    python training/stress_test.py --holdout    # honest version: retrain on 80%, test the other 20%

Takes the recorded hands in training/data/ and replays them changed in ways a
new player would change them:
  - camera angle: tilted up/down, turned left/right, rolled sideways
  - hand shape: bigger/smaller hands, longer/shorter fingers (other people)
  - shaky tracking: random wobble on every point
  - left hand: the mirror image of a right hand
  - speed (moving signs): signing faster or slower

The models only ever see MediaPipe's 21 hand points, never the picture, so skin
color can't be tested here: that only changes whether MediaPipe finds the hand
in the first place. This also assumes MediaPipe places the points well at every
angle, which it does less well at steep angles in real life.

Without --holdout, the shipped models were trained on these very samples, so
the "as recorded" row is too rosy. The drop as things change is still telling.
"""

from __future__ import annotations

import argparse
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
import torch

import train as letters
import train_motion as motion
from hand_features import MOTION_WINDOW_MS, hand_proportions, reshape_hand, to_features

ROOT = Path(__file__).resolve().parent.parent
TRIALS = 3  # random variations per sample per condition
ANGLES = [0, 15, 30, 45, 60]


# ---------- Ways to change a hand ----------

def rot(axis: str, deg: float) -> np.ndarray:
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return {"x": np.array([[1, 0, 0], [0, c, -s], [0, s, c]]),
            "y": np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]]),
            "z": np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])}[axis]


def other_hand(world: np.ndarray, rng: np.random.Generator, spread: float) -> np.ndarray:
    return reshape_hand(world, hand_proportions(rng, spread))


def wobble(world: np.ndarray, rng: np.random.Generator, metres: float) -> np.ndarray:
    return world + rng.normal(0, metres, world.shape)


def mirror(world: np.ndarray) -> np.ndarray:
    out = world.copy()
    out[:, 0] = -out[:, 0]
    return out


def flip_hand(hand: str) -> str:
    return "left" if hand == "right" else "right"


# Each condition: name -> fn(world, hand, rng) -> (world, hand)
def conditions():
    c = {"as recorded": lambda w, h, r: (w, h)}
    for axis, what in (("x", "tilt up/down"), ("y", "turn left/right"), ("z", "roll sideways")):
        for deg in ANGLES[1:]:
            c[f"{what} {deg}°"] = (lambda R: lambda w, h, r: (w @ (R if r.random() < 0.5 else R.T).T, h))(rot(axis, deg))
    for spread in (0.1, 0.2, 0.3):
        c[f"other hands ±{spread:.0%}"] = (lambda s: lambda w, h, r: (other_hand(w, r, s), h))(spread)
    for mm in (3, 6, 10):
        c[f"shaky tracking {mm}mm"] = (lambda m: lambda w, h, r: (wobble(w, r, m / 1000), h))(mm)
    c["left hand"] = lambda w, h, r: (mirror(w), flip_hand(h))
    c["mixed: 25° + other hand + 4mm"] = lambda w, h, r: (
        wobble(other_hand(w @ (rot("x", (r.random() - .5) * 50) @ rot("y", (r.random() - .5) * 50)
                                 @ rot("z", (r.random() - .5) * 50)).T, r, 0.2), r, 0.004), h)
    return c


# ---------- Letters ----------

def letter_forward(net: dict, x: np.ndarray) -> np.ndarray:
    """Same math as the browser's forward pass in js/classifier.js."""
    for layer in net["layers"]:
        x = x @ np.array(layer["W"]) + np.array(layer["b"])
        if layer["activation"] == "relu":
            x = np.maximum(0, x)
    e = np.exp(x - x.max(1, keepdims=True))
    return e / e.sum(1, keepdims=True)


def letter_holdout():
    """Train on the first 80% of each letter's samples (in recording order),
    test on the last 20%, so near-identical neighbouring frames don't land on
    both sides."""
    worlds, hands, y, _ = letters.load_data()
    test = np.zeros(len(y), bool)
    for i in np.unique(y):
        idx = np.flatnonzero(y == i)
        test[idx[int(len(idx) * 0.8):]] = True
    model = letters.train(worlds[~test], hands[~test], y[~test], 120)
    lin = [m for m in model if isinstance(m, torch.nn.Linear)]
    net = {"labels": letters.LETTERS, "layers": [
        {"W": m.weight.detach().T.numpy(), "b": m.bias.detach().numpy(), "activation": "softmax" if k == len(lin) - 1 else "relu"}
        for k, m in enumerate(lin)]}
    return net, worlds[test], hands[test], y[test]


def test_letters(holdout: bool, min_conf: float):
    if holdout:
        net, worlds, hands, y = letter_holdout()
    else:
        net = json.loads((ROOT / "model" / "weights.json").read_text())
        worlds, hands, y, _ = letters.load_data()
        y = np.array([net["labels"].index(letters.LETTERS[i]) for i in y])
    labels = net["labels"]
    print(f"\n=== LETTERS: {len(y)} samples, {len(labels)} letters ===")
    print(f"  'counts' = the game would accept it ({min_conf:.0%} sure, or top guess and {min_conf - 0.15:.0%})")
    print(f"  {'condition':34} {'top guess':>9} {'counts':>7}   worst letters")
    rng = np.random.default_rng(0)
    for name, change in conditions().items():
        trials = 1 if name in ("as recorded", "left hand") else TRIALS
        xs, ys = [], []
        for _ in range(trials):
            for w, h, t in zip(worlds, hands, y):
                w2, h2 = change(w, h, rng)
                xs.append(to_features(w2, h2))
                ys.append(t)
        probs = letter_forward(net, np.stack(xs))
        ys = np.array(ys)
        right = probs.argmax(1) == ys
        sure = probs[np.arange(len(ys)), ys]
        counts = (sure >= min_conf) | (right & (sure >= min_conf - 0.15))  # HoldTimer's rule in js/classifier.js
        per = sorted((counts[ys == i].mean(), labels[i]) for i in np.unique(ys))
        worst = ", ".join(f"{l} {a:.0%}" for a, l in per[:4] if a < 0.9)
        print(f"  {name:34} {right.mean():>9.0%} {counts.mean():>7.0%}   {worst}")
        if name == "mixed: 25° + other hand + 4mm":
            mix = Counter((labels[t], labels[p]) for t, p in zip(ys, probs.argmax(1)) if t != p)
            if mix:
                print("    mix-ups here (signed -> guessed): " + ", ".join(f"{a}->{b} x{n}" for (a, b), n in mix.most_common(8)))


# ---------- Moving signs ----------

def change_clip(clip, change, rng, speed=1.0):
    """A copy of a clip with every frame changed the same way."""
    c = motion.Clip(clip.sign, clip.hand, clip.who, clip.aspect)
    seed = int(rng.integers(1 << 30))
    worlds, hands = [], []
    for w in clip.worlds:
        w2, h2 = change(w, clip.hand, np.random.default_rng(seed))  # same angle / hand for every frame
        worlds.append(w2)
        hands.append(h2)
    c.hand = hands[0]
    c.worlds = np.stack(worlds)
    c.images = clip.images.copy()
    if c.hand != clip.hand:  # left hand: mirror the path through the picture too
        c.images[:, :, 0] = 1 - c.images[:, :, 0]
    c.times = clip.times * speed
    # The game only looks at the most recent window; a slow sign gets its start cut off.
    keep = c.times >= c.times[-1] - MOTION_WINDOW_MS
    if keep.sum() >= motion.MIN_FRAMES:
        c.times, c.worlds, c.images = c.times[keep], c.worlds[keep], c.images[keep]
    return c


def motion_holdout():
    clips = motion.load_clips()
    rng = np.random.default_rng(0)
    real = Counter(c.sign for c in clips)
    clips += motion.still_clips(max(0, max(real.values()) - real.get(motion.NOTHING, 0)), rng)
    labels = sorted({c.sign for c in clips}, key=lambda s: (s == motion.NOTHING, len(s) > 1, s))
    y = np.array([labels.index(c.sign) for c in clips])
    test = np.zeros(len(y), bool)
    for i in np.unique(y):
        idx = np.flatnonzero(y == i)
        test[idx[int(len(idx) * 0.8):]] = True
    trained = motion.train([c for c, t in zip(clips, test) if not t], y[~test], len(labels), 60)
    m, mean, std = trained
    r = lambda t: t.detach().numpy()  # noqa: E731
    net = {"labels": labels, "mean": mean, "std": std,
           "frame": {"W": r(m.frame.weight.T), "b": r(m.frame.bias)},
           "convs": [{"W": r(c.weight), "b": r(c.bias)} for c in m.convs],
           "out": {"W": r(m.out.weight.T), "b": r(m.out.bias)}}
    return net, [c for c, t in zip(clips, test) if t]


def test_motion(holdout: bool, min_conf: float):
    if holdout:
        net, clips = motion_holdout()
    else:
        net = json.loads((ROOT / "model" / "motion.json").read_text())
        clips = [c for c in motion.load_clips() if c.sign in net["labels"]]
    labels = net["labels"]
    print(f"\n=== MOVING SIGNS: {len(clips)} clips, signs: {', '.join(labels)} ===")
    print(f"  {'condition':34} {'top guess':>9} {'counts':>7}   worst signs")
    rng = np.random.default_rng(0)
    conds = list(conditions().items())
    conds += [(f"signing {s}x speed", (lambda sp: ("speed", sp))(s)) for s in (0.6, 0.8, 1.25, 1.5)]
    for name, change in conds:
        speed = 1.0
        if isinstance(change, tuple):
            speed, change = 1 / change[1], conditions()["as recorded"]
        trials = 1 if name in ("as recorded", "left hand") or speed != 1.0 else TRIALS
        ys, probs = [], []
        for _ in range(trials):
            for c in clips:
                c2 = change_clip(c, change, rng, speed)
                probs.append(motion.motion_probs(net, motion.clip_to_x(c2)))
                ys.append(labels.index(c.sign))
        probs, ys = np.stack(probs), np.array(ys)
        right = probs.argmax(1) == ys
        counts = right & (probs[np.arange(len(ys)), ys] >= min_conf)
        per = sorted((counts[ys == i].mean(), labels[i]) for i in np.unique(ys))
        worst = ", ".join(f"{l} {a:.0%}" for a, l in per[:4] if a < 0.9)
        print(f"  {name:34} {right.mean():>9.0%} {counts.mean():>7.0%}   {worst}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--holdout", action="store_true", help="retrain on 80%% and test on the unseen 20%%")
    parser.add_argument("--min-conf", type=float, default=0.6, help="confidence the game needs (Settings default 0.6)")
    parser.add_argument("--only", choices=["letters", "motion"])
    args = parser.parse_args()
    if args.only != "motion":
        test_letters(args.holdout, args.min_conf)
    if args.only != "letters":
        test_motion(args.holdout, args.min_conf)


if __name__ == "__main__":
    main()
