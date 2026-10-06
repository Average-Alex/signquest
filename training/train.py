"""Train the SignQuest letter recognizer and export it for the browser.

    python training/train.py                  # train on training/data/*.csv
    python training/train.py --epochs 150

Input: CSVs downloaded from the game's Record page (open the game with ?dev,
Settings > Data recorder), dropped into training/data/.

Output: model/weights.json, which the game loads automatically. It's just the
layer weights as JSON; js/classifier.js runs the forward pass itself.

How it's tested: if the data has 2+ different recorders, each person is held
out in turn and the model is trained on everyone else ("leave one person out").
That's the honest number - it's how well the game will work for a NEW kid. A
random split lets the same person's near-identical frames land in both train
and test, which overstates accuracy. The final exported model is then trained
on everyone.
"""

import argparse
import csv
import json
import math
import random
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import torch
from torch import nn

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "training" / "data"
OUT_PATH = ROOT / "model" / "weights.json"

LETTERS = list("ABCDEFGHIKLMNOPQRSTUVWXY")  # same order as js/config.js
LOOK_ALIKES = list("ASETMN")


def to_features(world: np.ndarray, hand: str) -> np.ndarray:
    """Python copy of toFeatures() in js/features.js - keep them identical.

    world: (21, 3) raw MediaPipe world landmarks.
    """
    pts = world - world[0]  # wrist at the origin
    size = np.linalg.norm(pts[9]) or 1.0  # wrist to middle-finger knuckle
    pts = pts / size
    if hand == "left":
        pts[:, 0] = -pts[:, 0]  # mirror lefties onto the right-hand shape
    return pts.reshape(-1).astype(np.float32)


def load_data():
    rows = []
    for path in sorted(DATA_DIR.glob("*.csv")):
        with open(path, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                if r["letter"] not in LETTERS:
                    continue
                world = np.array([float(r[f"{a}{i}"]) for i in range(21) for a in "xyz"]).reshape(21, 3)
                rows.append((to_features(world, r["hand"]), LETTERS.index(r["letter"]), r["recorder"].strip().lower()))
    if not rows:
        raise SystemExit(f"No data. Download CSVs from the Record page into {DATA_DIR}")
    x = np.stack([r[0] for r in rows])
    y = np.array([r[1] for r in rows])
    who = np.array([r[2] for r in rows])
    return x, y, who


def augment(x: torch.Tensor) -> torch.Tensor:
    """Small random tilts and jitter, so the model doesn't depend on holding
    the hand at exactly the angle it was recorded at."""
    pts = x.view(-1, 21, 3)
    angle = (torch.rand(pts.shape[0]) - 0.5) * math.radians(30)  # +/- 15 degrees in the image plane
    cos, sin = torch.cos(angle), torch.sin(angle)
    rx = pts[..., 0] * cos[:, None] - pts[..., 1] * sin[:, None]
    ry = pts[..., 0] * sin[:, None] + pts[..., 1] * cos[:, None]
    pts = torch.stack([rx, ry, pts[..., 2]], dim=-1)
    pts = pts + torch.randn_like(pts) * 0.02
    return pts.reshape(-1, 63)


def make_model() -> nn.Sequential:
    return nn.Sequential(
        nn.Linear(63, 128), nn.ReLU(), nn.Dropout(0.3),
        nn.Linear(128, 64), nn.ReLU(), nn.Dropout(0.3),
        nn.Linear(64, len(LETTERS)),
    )


def train(x: np.ndarray, y: np.ndarray, epochs: int, seed: int = 0) -> nn.Sequential:
    torch.manual_seed(seed)
    model = make_model()
    opt = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
    xt, yt = torch.from_numpy(x), torch.from_numpy(y).long()
    # Balance letters so one heavily recorded letter doesn't dominate.
    counts = torch.bincount(yt, minlength=len(LETTERS)).float().clamp(min=1)
    loss_fn = nn.CrossEntropyLoss(weight=counts.sum() / (len(LETTERS) * counts))
    model.train()
    for _ in range(epochs):
        for batch in torch.randperm(len(xt)).split(256):
            opt.zero_grad()
            loss_fn(model(augment(xt[batch])), yt[batch]).backward()
            opt.step()
    model.eval()
    return model


def predict(model: nn.Sequential, x: np.ndarray) -> np.ndarray:
    with torch.no_grad():
        return model(torch.from_numpy(x)).argmax(1).numpy()


def report(y_true: np.ndarray, y_pred: np.ndarray, title: str) -> None:
    acc = (y_true == y_pred).mean()
    print(f"\n{title}: {acc:.1%} correct ({len(y_true)} samples)")
    per_letter = []
    for i, letter in enumerate(LETTERS):
        mask = y_true == i
        if mask.any():
            per_letter.append(((y_pred[mask] == i).mean(), letter))
    worst = sorted(per_letter)[:6]
    print("  hardest letters: " + ", ".join(f"{l} {a:.0%}" for a, l in worst))

    confusions = Counter(
        (LETTERS[t], LETTERS[p]) for t, p in zip(y_true, y_pred) if t != p
    )
    if confusions:
        print("  most common mix-ups (signed -> guessed): " +
              ", ".join(f"{a}->{b} x{n}" for (a, b), n in confusions.most_common(8)))

    # The look-alike group from the plan: worth checking before placing zones.
    idx = [LETTERS.index(l) for l in LOOK_ALIKES]
    print("  look-alike confusion matrix (rows = signed, cols = guessed):")
    print("       " + "  ".join(f"{l:>3}" for l in LOOK_ALIKES))
    for i in idx:
        mask = y_true == i
        if not mask.any():
            continue
        cells = [(y_pred[mask] == j).sum() for j in idx]
        print(f"    {LETTERS[i]}  " + "  ".join(f"{c:>3}" for c in cells))


def export(model: nn.Sequential, path: Path) -> None:
    linears = [m for m in model if isinstance(m, nn.Linear)]
    layers = []
    for n, layer in enumerate(linears):
        layers.append({
            # Stored as [in][out] so the JS loop reads one row per input.
            "W": [[round(v, 6) for v in row] for row in layer.weight.detach().T.tolist()],
            "b": [round(v, 6) for v in layer.bias.detach().tolist()],
            "activation": "softmax" if n == len(linears) - 1 else "relu",
        })
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"labels": LETTERS, "layers": layers}))
    print(f"\nSaved {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=120)
    args = parser.parse_args()

    x, y, who = load_data()
    people = sorted(set(who))
    counts = Counter(LETTERS[i] for i in y)
    print(f"{len(y)} samples from {len(people)} people: {', '.join(people)}")
    missing = [l for l in LETTERS if counts[l] == 0]
    thin = [f"{l}({counts[l]})" for l in LETTERS if 0 < counts[l] < 200]
    if missing:
        print(f"  no samples yet: {' '.join(missing)}")
    if thin:
        print(f"  under 200 samples: {' '.join(thin)}")

    if len(people) >= 2:
        all_true, all_pred = [], []
        for person in people:
            test = who == person
            model = train(x[~test], y[~test], args.epochs)
            pred = predict(model, x[test])
            print(f"  held out {person}: {(pred == y[test]).mean():.1%}")
            all_true.append(y[test])
            all_pred.append(pred)
        report(np.concatenate(all_true), np.concatenate(all_pred), "Leave-one-person-out (new players)")
    else:
        print("\nOnly one person recorded - using a random 80/20 split. This OVERSTATES")
        print("accuracy for new players; record a second person for an honest number.")
        order = np.random.default_rng(0).permutation(len(y))
        cut = int(len(y) * 0.8)
        model = train(x[order[:cut]], y[order[:cut]], args.epochs)
        report(y[order[cut:]], predict(model, x[order[cut:]]), "Random split")

    export(train(x, y, args.epochs), OUT_PATH)


if __name__ == "__main__":
    main()
