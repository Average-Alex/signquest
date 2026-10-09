"""Hand features shared by train.py, train_motion.py and record.py.

Python copies of js/features.js (letters) and js/motion.js (moving signs).
Keep them identical: the browser runs models trained on these numbers.
Only needs numpy.
"""

from __future__ import annotations

import math

import numpy as np

# ---------- One frame: the hand's shape (js/features.js) ----------

FINGERS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]]
TIP_PAIRS = [(4, 8), (4, 12), (4, 16), (4, 20), (8, 12), (12, 16), (16, 20), (4, 6), (4, 10), (8, 10)]
FEATURE_COUNT = 63 + 15 + len(TIP_PAIRS) + 6


def _unit(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    return v / (n if n else 1.0)


def _bend(a: np.ndarray, b: np.ndarray) -> float:
    """The angle between two directions, as 0 (same way) to 1 (opposite)."""
    return math.acos(max(-1.0, min(1.0, float(np.dot(_unit(a), _unit(b)))))) / math.pi


def to_features(world: np.ndarray, hand: str) -> np.ndarray:
    """Python copy of toFeatures() in js/features.js - keep them identical.

    world: (21, 3) raw MediaPipe world landmarks. See features.js for what
    each group of numbers means.
    """
    p = world.astype(np.float64).copy()
    if hand == "left":
        p[:, 0] = -p[:, 0]  # mirror lefties onto the right-hand shape
    wrist = p[0]
    size = float(np.linalg.norm(p[9] - wrist)) or 1.0
    up = _unit(p[9] - wrist)
    raw_across = p[5] - p[17]
    across = _unit(raw_across - up * np.dot(raw_across, up))
    facing = np.cross(across, up)

    d = p - wrist
    shape = np.stack([d @ across, d @ up, d @ facing], axis=1) / size
    curl = []
    for a, b, c, e in FINGERS:
        curl += [_bend(p[a] - wrist, p[b] - p[a]), _bend(p[b] - p[a], p[c] - p[b]), _bend(p[c] - p[b], p[e] - p[c])]
    tips = [float(np.linalg.norm(p[a] - p[b])) / size for a, b in TIP_PAIRS]
    return np.concatenate([shape.reshape(-1), curl, tips, up, facing]).astype(np.float32)


def rotation(rng: np.random.Generator) -> np.ndarray:
    """A small random camera turn (same ranges as turned() in js/classifier.js)."""
    ax, ay, az = (rng.random(3) - 0.5) * 2 * np.array([0.2, 0.2, 0.3])
    rx = np.array([[1, 0, 0], [0, math.cos(ax), -math.sin(ax)], [0, math.sin(ax), math.cos(ax)]])
    ry = np.array([[math.cos(ay), 0, math.sin(ay)], [0, 1, 0], [-math.sin(ay), 0, math.cos(ay)]])
    rz = np.array([[math.cos(az), -math.sin(az), 0], [math.sin(az), math.cos(az), 0], [0, 0, 1]])
    return rz @ ry @ rx


def turned(world: np.ndarray, rng: np.random.Generator, rot: np.ndarray | None = None) -> np.ndarray:
    """Turn the camera a little, plus a touch of jitter, so a model doesn't
    depend on holding the hand at exactly the angle it was recorded at."""
    rot = rotation(rng) if rot is None else rot
    return world @ rot.T + (rng.random(world.shape) - 0.5) * 0.002


# ---------- Moving signs: a short clip of frames (js/motion.js) ----------
#
# Every frame becomes the hand's shape (the 94 numbers above) plus where the
# wrist is in the picture and how big the hand looks. A clip is squeezed or
# stretched to MOTION_T evenly spaced frames, then each frame also gets:
#   - where the wrist is, from the middle of the picture (where you sign:
#     chin, chest...)
#   - how far the wrist has moved since the clip started, in hand-sizes
#   - how big the hand looks compared with the clip's average (moving
#     toward or away from the camera)
# so the model sees both the handshape and the path the hand draws.

MOTION_T = 20  # frames per clip after resampling
MOTION_WINDOW_MS = 1600  # how much recent movement the game looks at
MOTION_FRAME = FEATURE_COUNT + 3  # per raw frame: shape + wrist x, y + hand size
MOTION_INPUT = FEATURE_COUNT + 5  # per resampled frame: shape + place(2) + moved(2) + size(1)


def frame_vector(world: np.ndarray, image: np.ndarray, aspect: float, hand: str) -> np.ndarray:
    """One camera frame -> MOTION_FRAME numbers.

    world: (21, 3) world landmarks. image: (21, 2+) picture landmarks, 0-1.
    aspect: picture width / height, so x and y use the same units.
    """
    pts = image[:, :2].astype(np.float64) * np.array([aspect, 1.0])
    if hand == "left":
        pts[:, 0] = aspect - pts[:, 0]  # mirror lefties, same as their shape
    size = float(np.linalg.norm(pts[9] - pts[0]))
    return np.concatenate([to_features(world, hand), [pts[0, 0] - aspect / 2, pts[0, 1] - 0.5, size]]).astype(np.float32)


def clip_input(times: np.ndarray, frames: np.ndarray) -> np.ndarray:
    """Frames (n, MOTION_FRAME) at times (n,) ms -> (MOTION_T, MOTION_INPUT)."""
    times = np.asarray(times, dtype=np.float64)
    frames = np.asarray(frames, dtype=np.float64)
    target = np.linspace(times[0], times[-1], MOTION_T) if times[-1] > times[0] else np.full(MOTION_T, times[0])
    even = np.stack([np.interp(target, times, frames[:, j]) for j in range(frames.shape[1])], axis=1)
    shape, wrist, size = even[:, :FEATURE_COUNT], even[:, FEATURE_COUNT:FEATURE_COUNT + 2], even[:, -1]
    mean_size = float(size.mean()) or 1.0
    moved = (wrist - wrist[0]) / mean_size
    return np.concatenate([shape, wrist, moved, (size / mean_size)[:, None]], axis=1).astype(np.float32)


def motion_probs(net: dict, x: np.ndarray) -> np.ndarray:
    """NumPy forward pass of the model saved by train_motion.py (same math as
    js/motion.js), for the live guess in record.py and to check the export."""
    x = (x - np.array(net["mean"])) / np.array(net["std"])
    h = np.maximum(0, x @ np.array(net["frame"]["W"]) + np.array(net["frame"]["b"]))  # (T, H)
    for conv in net["convs"]:
        w = np.array(conv["W"])  # (out, in, k)
        k = w.shape[2]
        pad = np.pad(h, ((k // 2, k // 2), (0, 0)))
        h = np.maximum(0, np.stack([np.einsum("oik,ki->o", w, pad[t:t + k]) for t in range(len(h))]) + np.array(conv["b"]))
    pooled = np.concatenate([h.max(0), h.mean(0)])
    logits = pooled @ np.array(net["out"]["W"]) + np.array(net["out"]["b"])
    e = np.exp(logits - logits.max())
    return e / e.sum()
