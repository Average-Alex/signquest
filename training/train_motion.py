"""Train the recognizer for MOVING signs (J, Z, and words like HELLO) and
export it for the browser.

    python training/train_motion.py
    python training/train_motion.py --epochs 80

Input: clips recorded with training/record.py (keys 1-9 and 0), saved in
training/data/motion/. Each clip is one go at a sign: every frame has the
hand's 21 points, so the model sees both the handshape and the path the hand
draws through the air.

Output: model/motion.json, which the game loads automatically
(js/motion.js runs the forward pass itself).

Like train.py, if 2+ people recorded, each is held out in turn - the honest
number for a new player.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from torch import nn

from hand_features import (MOTION_INPUT, MOTION_T, MOTION_WINDOW_MS, clip_input, frame_vector, motion_probs,
                           rotation, turned)

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "training" / "data"
MOTION_DIR = DATA_DIR / "motion"
OUT_PATH = ROOT / "model" / "motion.json"
NOTHING = "NOTHING"
AUGMENT_COPIES = 8  # varied copies of every clip per training run
MIN_FRAMES = 6


class Clip:
    def __init__(self, sign, hand, who, aspect):
        self.sign, self.hand, self.who, self.aspect = sign, hand, who, aspect
        self.times, self.worlds, self.images = [], [], []


def load_clips() -> list[Clip]:
    clips: dict[str, Clip] = {}
    for path in sorted(MOTION_DIR.glob("*.csv")):
        with open(path, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                key = f"{path.name}/{r['clip']}"
                if key not in clips:
                    clips[key] = Clip(r["sign"], r["hand"], r["recorder"].strip().lower(), float(r["aspect"]))
                c = clips[key]
                c.times.append(float(r["t"]))
                c.worlds.append([float(r[f"{a}{i}"]) for i in range(21) for a in "xyz"])
                c.images.append([float(r[f"{a}{i}"]) for i in range(21) for a in "uv"])
    out = []
    for c in clips.values():
        if len(c.times) < MIN_FRAMES:
            continue
        c.times = np.array(c.times)
        c.worlds = np.array(c.worlds).reshape(-1, 21, 3)
        c.images = np.array(c.images).reshape(-1, 21, 2)
        out.append(c)
    return out


def still_clips(n: int, rng: np.random.Generator) -> list[Clip]:
    """Fake "nothing" clips from the still letter samples in training/data:
    a letter held still (with a little wobble) isn't a moving sign. Those
    files only have world points, so a picture position is made up."""
    rows = []
    for path in sorted(DATA_DIR.glob("*.csv")):
        with open(path, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                rows.append((np.array([float(r[f"{a}{i}"]) for i in range(21) for a in "xyz"]).reshape(21, 3),
                             r["hand"], r["recorder"].strip().lower()))
    out = []
    for k in rng.choice(len(rows), size=min(n, len(rows)), replace=False) if rows else []:
        world, hand, who = rows[k]
        c = Clip(NOTHING, hand, who, 4 / 3)
        frames = 24
        c.times = np.linspace(0, MOTION_WINDOW_MS, frames)
        start = np.array([0.4 + rng.random() * 0.5, 0.35 + rng.random() * 0.4])
        drift = (rng.random(2) - 0.5) * 0.04
        scale = 1.5 + rng.random() * 1.5
        c.worlds = np.stack([world + (rng.random(world.shape) - 0.5) * 0.002 for _ in range(frames)])
        c.images = np.stack([start + drift * t / frames + world[:, :2] * scale for t in range(frames)])
        out.append(c)
    return out


def clip_to_x(c: Clip, rng: np.random.Generator | None = None) -> np.ndarray:
    """Clip -> model input. With rng: a varied copy (cropped a little at the
    ends, camera turned, picture shifted and zoomed)."""
    times, worlds, images = c.times, c.worlds, c.images
    if rng is not None:
        dur = times[-1] - times[0]
        keep = (times >= times[0] + rng.random() * 0.15 * dur) & (times <= times[-1] - rng.random() * 0.15 * dur)
        if keep.sum() >= MIN_FRAMES:
            times, worlds, images = times[keep], worlds[keep], images[keep]
        rot = rotation(rng)
        worlds = np.stack([turned(w, rng, rot) for w in worlds])
        zoom = 0.9 + rng.random() * 0.2
        images = (images - 0.5) * zoom + 0.5 + (rng.random(2) - 0.5) * 0.1
    frames = np.stack([frame_vector(w, i, c.aspect, c.hand) for w, i in zip(worlds, images)])
    return clip_input(times, frames)


class MotionNet(nn.Module):
    """Each frame -> 64 numbers, two passes that look at 5 frames at a time
    (catching the movement), then the strongest and average response over the
    whole clip -> one score per sign."""

    def __init__(self, n_out: int, hidden: int = 64):
        super().__init__()
        self.frame = nn.Linear(MOTION_INPUT, hidden)
        self.convs = nn.ModuleList([nn.Conv1d(hidden, hidden, 5, padding=2) for _ in range(2)])
        self.drop = nn.Dropout(0.3)
        self.out = nn.Linear(2 * hidden, n_out)

    def forward(self, x):  # (batch, T, MOTION_INPUT)
        h = torch.relu(self.frame(x)).transpose(1, 2)
        for conv in self.convs:
            h = torch.relu(conv(h))
        return self.out(self.drop(torch.cat([h.amax(2), h.mean(2)], 1)))


def train(clips: list[Clip], y: np.ndarray, n_labels: int, epochs: int, seed: int = 0):
    rng = np.random.default_rng(seed)
    torch.manual_seed(seed)
    x = np.stack([clip_to_x(c) for c in clips] + [clip_to_x(c, rng) for _ in range(AUGMENT_COPIES) for c in clips])
    y = np.concatenate([y] * (1 + AUGMENT_COPIES))
    mean = x.reshape(-1, MOTION_INPUT).mean(0)
    std = np.maximum(x.reshape(-1, MOTION_INPUT).std(0), 1e-3)
    xt = torch.from_numpy(((x - mean) / std).astype(np.float32))
    yt = torch.from_numpy(y).long()
    model = MotionNet(n_labels)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
    counts = torch.bincount(yt, minlength=n_labels).float().clamp(min=1)
    loss_fn = nn.CrossEntropyLoss(weight=counts.sum() / (n_labels * counts))
    model.train()
    for _ in range(epochs):
        for batch in torch.randperm(len(xt)).split(64):
            opt.zero_grad()
            loss_fn(model(xt[batch] + torch.randn_like(xt[batch]) * 0.02), yt[batch]).backward()
            opt.step()
    model.eval()
    return model, mean, std


def predict(trained, clips: list[Clip]) -> np.ndarray:
    model, mean, std = trained
    x = np.stack([clip_to_x(c) for c in clips])
    with torch.no_grad():
        return model(torch.from_numpy(((x - mean) / std).astype(np.float32))).argmax(1).numpy()


def report(y_true, y_pred, labels, title):
    print(f"\n{title}: {(y_true == y_pred).mean():.1%} correct ({len(y_true)} clips)")
    per = sorted(((y_pred[y_true == i] == i).mean(), l) for i, l in enumerate(labels) if (y_true == i).any())
    print("  per sign: " + ", ".join(f"{l} {a:.0%}" for a, l in per))
    mixups = Counter((labels[t], labels[p]) for t, p in zip(y_true, y_pred) if t != p)
    if mixups:
        print("  mix-ups (signed -> guessed): " + ", ".join(f"{a}->{b} x{n}" for (a, b), n in mixups.most_common(8)))


def export(trained, labels: list[str], path: Path, check: list[Clip]) -> None:
    model, mean, std = trained
    r = lambda t: np.round(t.detach().numpy().astype(np.float64), 6).tolist()  # noqa: E731
    net = {
        "labels": labels,
        "T": MOTION_T,
        "windowMs": MOTION_WINDOW_MS,
        "mean": np.round(mean, 6).tolist(),
        "std": np.round(std, 6).tolist(),
        "frame": {"W": r(model.frame.weight.T), "b": r(model.frame.bias)},  # W: [in][out]
        "convs": [{"W": r(c.weight), "b": r(c.bias)} for c in model.convs],  # W: [out][in][k]
        "out": {"W": r(model.out.weight.T), "b": r(model.out.bias)},
    }
    # Make sure the plain-math version (same as the browser's) agrees.
    with torch.no_grad():
        for c in check[:5]:
            x = clip_to_x(c)
            want = torch.softmax(model(torch.from_numpy(((x - mean) / std).astype(np.float32))[None]), 1)[0].numpy()
            got = motion_probs(net, x)
            assert np.abs(want - got).max() < 1e-3, "exported model doesn't match"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(net))
    print(f"\nSaved {path} ({path.stat().st_size // 1024} KB)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=60)
    args = parser.parse_args()

    clips = load_clips()
    if not clips:
        raise SystemExit("No clips yet. Record some with: python training/record.py  (keys 1-9 and 0)")
    rng = np.random.default_rng(0)
    real = Counter(c.sign for c in clips)
    # Top up "nothing" with held-still letters, so a still hand isn't read as a word.
    n_still = max(0, max(real.values()) - real.get(NOTHING, 0))
    clips += still_clips(n_still, rng)
    labels = sorted({c.sign for c in clips}, key=lambda s: (s == NOTHING, len(s) > 1, s))
    if len(labels) < 2:
        raise SystemExit("Record at least two different moving signs first.")
    y = np.array([labels.index(c.sign) for c in clips])
    who = np.array([c.who for c in clips])
    people = sorted({c.who for c in clips if c.sign in real})

    counts = Counter(c.sign for c in clips)
    print(f"{len(clips)} clips from {len(people)} people: {', '.join(people)}")
    print("  " + "  ".join(f"{l}({counts[l]})" for l in labels))
    thin = [l for l in labels if counts[l] < 40]
    if thin:
        print(f"  under 40 clips: {' '.join(thin)}")

    if len(people) >= 2:
        trues, preds = [], []
        for person in people:
            test = who == person
            trained = train([c for c, t in zip(clips, test) if not t], y[~test], len(labels), args.epochs)
            pred = predict(trained, [c for c, t in zip(clips, test) if t])
            print(f"  held out {person}: {(pred == y[test]).mean():.1%}")
            trues.append(y[test])
            preds.append(pred)
        report(np.concatenate(trues), np.concatenate(preds), labels, "Leave-one-person-out (new players)")
    else:
        print("\nOnly one person recorded - testing on 20% of the clips held back. Record a")
        print("second person for an honest number for new players.")
        order = rng.permutation(len(clips))
        cut = int(len(clips) * 0.8)
        tr, te = order[:cut], order[cut:]
        trained = train([clips[i] for i in tr], y[tr], len(labels), args.epochs)
        report(y[te], predict(trained, [clips[i] for i in te]), labels, "Held-back clips")

    export(train(clips, y, len(labels), args.epochs), labels, OUT_PATH, clips)


if __name__ == "__main__":
    main()
