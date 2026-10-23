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
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from torch import nn

from hand_features import FEATURE_COUNT, hand_proportions, reshape_hand, rotation, to_features

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "training" / "data"
OUT_PATH = ROOT / "model" / "weights.json"

LETTERS = list("ABCDEFGHIKLMNOPQRSTUVWXY")  # same order as js/config.js
LOOK_ALIKES = list("ASETMN")


# Training in simulation: every recorded hand is replayed AUGMENT_COPIES more
# times as a different kid might sign it (simulate()), so the model learns the
# letter, not this exact recording.
AUGMENT_COPIES = 24
SIM_TURN = (0.8, 0.6, 0.6)  # camera turn, up to this many radians (tilt, turn, roll)
SIM_HANDS = 0.2  # other hands: overall size and each finger's length, up to +-20%
SIM_WOBBLE = 0.006  # shaky tracking: up to 6 mm of wobble on every point


def simulate(world: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """A new take of a recorded hand: someone else's hand proportions, a
    different camera angle, and shaky tracking."""
    w = reshape_hand(world, hand_proportions(rng, SIM_HANDS))
    w = w @ rotation(rng, SIM_TURN).T
    return w + rng.normal(0, rng.uniform(0, SIM_WOBBLE), w.shape)


def load_data():
    rows = []
    for path in sorted(DATA_DIR.glob("*.csv")):
        with open(path, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                if r["letter"] not in LETTERS:
                    continue
                world = np.array([float(r[f"{a}{i}"]) for i in range(21) for a in "xyz"]).reshape(21, 3)
                rows.append((world, r["hand"], LETTERS.index(r["letter"]), r["recorder"].strip().lower()))
    if not rows:
        raise SystemExit(f"No data. Download CSVs from the Record page into {DATA_DIR}")
    worlds = np.stack([r[0] for r in rows])
    hands = np.array([r[1] for r in rows])
    y = np.array([r[2] for r in rows])
    who = np.array([r[3] for r in rows])
    return worlds, hands, y, who


def featurize(worlds: np.ndarray, hands: np.ndarray, augment: bool = False, seed: int = 0):
    """Features for every sample, plus simulated new takes when training."""
    rng = np.random.default_rng(seed)
    x = [to_features(w, h) for w, h in zip(worlds, hands)]
    if augment:
        x += [to_features(simulate(w, rng), h) for _ in range(AUGMENT_COPIES) for w, h in zip(worlds, hands)]
    return np.stack(x)


def make_model() -> nn.Sequential:
    return nn.Sequential(
        nn.Linear(FEATURE_COUNT, 128), nn.ReLU(), nn.Dropout(0.3),
        nn.Linear(128, 64), nn.ReLU(), nn.Dropout(0.3),
        nn.Linear(64, len(LETTERS)),
    )


def train(worlds: np.ndarray, hands: np.ndarray, y: np.ndarray, epochs: int, seed: int = 0) -> nn.Sequential:
    torch.manual_seed(seed)
    model = make_model()
    x = featurize(worlds, hands, augment=True, seed=seed)
    y = np.concatenate([y] * (1 + AUGMENT_COPIES))
    opt = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
    xt, yt = torch.from_numpy(x), torch.from_numpy(y).long()
    # Balance letters so one heavily recorded letter doesn't dominate.
    counts = torch.bincount(yt, minlength=len(LETTERS)).float().clamp(min=1)
    loss_fn = nn.CrossEntropyLoss(weight=counts.sum() / (len(LETTERS) * counts))
    model.train()
    for _ in range(epochs):
        for batch in torch.randperm(len(xt)).split(256):
            opt.zero_grad()
            # A little noise on top, so it doesn't memorize exact numbers.
            loss_fn(model(xt[batch] + torch.randn_like(xt[batch]) * 0.01), yt[batch]).backward()
            opt.step()
    model.eval()
    return model


def predict(model: nn.Sequential, worlds: np.ndarray, hands: np.ndarray) -> np.ndarray:
    with torch.no_grad():
        return model(torch.from_numpy(featurize(worlds, hands))).argmax(1).numpy()


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
    parser.add_argument("--epochs", type=int, default=160)
    args = parser.parse_args()

    worlds, hands, y, who = load_data()
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
            model = train(worlds[~test], hands[~test], y[~test], args.epochs)
            pred = predict(model, worlds[test], hands[test])
            print(f"  held out {person}: {(pred == y[test]).mean():.1%}")
            all_true.append(y[test])
            all_pred.append(pred)
        report(np.concatenate(all_true), np.concatenate(all_pred), "Leave-one-person-out (new players)")
    else:
        print("\nOnly one person recorded - using a random 80/20 split. This OVERSTATES")
        print("accuracy for new players; record a second person for an honest number.")
        order = np.random.default_rng(0).permutation(len(y))
        cut = int(len(y) * 0.8)
        tr, te = order[:cut], order[cut:]
        model = train(worlds[tr], hands[tr], y[tr], args.epochs)
        report(y[te], predict(model, worlds[te], hands[te]), "Random split")

    export(train(worlds, hands, y, args.epochs), OUT_PATH)


if __name__ == "__main__":
    main()
