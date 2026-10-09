"""Record ASL signs from your webcam for training, outside the game.

    python training/record.py --name alex

A window opens with your camera. Every point on your hand leaves a trail as
it moves, so you can see the path a sign draws.

STILL letters (A-Y): pick one with its key, press SPACE, and hold the sign
for 3 seconds while moving your hand a little (closer, farther, tilted).
Saved to training/data/<name>_<date>.csv for train.py.

MOVING signs (keys 1-9, 0): press SPACE to record 5 goes in a row. Each go:
"get ready" (hand still), then "GO!" - do the sign once, in about 1.5
seconds. Saved to training/data/motion/<name>_<date>.csv for
train_motion.py.

Keys:
    A-Y        pick a still letter (J and Z are moving signs: keys 1 and 2)
    1-9, 0     pick a moving sign (see the list on screen)
    SPACE      record
    TAB        turn "go to the next sign after each take" on/off
    BACKSPACE  undo the last take
    ESC        quit

It saves the 21 hand points MediaPipe finds, not photos.
Needs: pip install mediapipe opencv-python numpy
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
import time
from collections import deque
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision

from hand_features import MOTION_WINDOW_MS, clip_input, frame_vector, motion_probs

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "training" / "data"
MOTION_DIR = DATA_DIR / "motion"
MODEL_PATH = ROOT / "vendor" / "mediapipe" / "hand_landmarker.task"
MOTION_MODEL = ROOT / "model" / "motion.json"
LETTERS = list("ABCDEFGHIKLMNOPQRSTUVWXY")  # same order as js/config.js
# Moving signs, one hand each. Key -> (sign, how to do it).
MOTION = {
    "1": ("J", "Pinky up (I), then swoop it down and curve it toward you."),
    "2": ("Z", "Index finger out. Draw a Z in the air."),
    "3": ("HELLO", "Flat hand at your forehead. Salute out to the side."),
    "4": ("YES", "Fist (S). Nod it up and down, like a head nodding."),
    "5": ("NO", "Index + middle finger snap down onto your thumb, twice."),
    "6": ("THANK YOU", "Flat hand, fingertips at your chin. Move it out toward the camera."),
    "7": ("PLEASE", "Flat hand on your chest. Rub it in a circle."),
    "8": ("SORRY", "Fist (A) on your chest. Rub it in a circle."),
    "9": ("BYE", "Open hand facing the camera. Fold the fingers down and up (wave)."),
    "0": ("NOTHING", "Not a sign: rest, fidget, scratch, hold a still letter. Helps it ignore you."),
}
MOTION_SIGNS = [s for s, _ in MOTION.values()]
COUNTDOWN_S = 2.0
RECORD_S = 3.0
SAMPLE_GAP_S = 0.066  # still letters: about 15 samples a second, like the game
READY_S = 1.0  # moving signs: hand still before each go
GO_S = MOTION_WINDOW_MS / 1000  # moving signs: one go at the sign
GOES = 5  # moving-sign clips per SPACE
GOAL = 200  # still samples per letter per person worth aiming for
MOTION_GOAL = 40  # clips per moving sign per person
EDGE = 0.02  # same "whole hand in view" margin as handInView() in features.js
TRAIL_S = 0.7
HAND_LINES = [(0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8), (5, 9), (9, 10), (10, 11),
              (11, 12), (9, 13), (13, 14), (14, 15), (15, 16), (13, 17), (17, 18), (18, 19), (19, 20), (0, 17)]
# Trail colour per finger (BGR): wrist, thumb, index, middle, ring, pinky.
FINGER_COLORS = [(255, 255, 255), (80, 80, 255), (60, 200, 255), (90, 230, 90), (255, 200, 60), (255, 110, 220)]
POINT_FINGER = [0] + [1 + (i - 1) // 4 for i in range(1, 21)]


def load_tips() -> dict[str, str]:
    """The how-to hints for each letter, read from js/config.js."""
    text = (ROOT / "js" / "config.js").read_text(encoding="utf-8")
    return dict(re.findall(r'^\s+([A-Y]): "([^"]*)",', text, re.M))


STILL_HEADER = ["letter", "hand", "recorder", "timestamp"] + [f"{a}{i}" for i in range(21) for a in "xyz"]
MOTION_HEADER = (["clip", "sign", "hand", "recorder", "t", "aspect"] + [f"{a}{i}" for i in range(21) for a in "xyz"]
                 + [f"{a}{i}" for i in range(21) for a in "uv"])


class Store:
    """Rows of one CSV file. New rows are appended; undo rewrites the file."""

    def __init__(self, path: Path, header: list[str]):
        self.path, self.header = path, header
        self.rows: list[list[str]] = []
        if path.exists():
            with open(path, newline="", encoding="utf-8") as f:
                self.rows = list(csv.reader(f))[1:]

    def add(self, rows: list[list[str]]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        new = not self.path.exists()
        with open(self.path, "a", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            if new:
                w.writerow(self.header)
            w.writerows(rows)
        self.rows += rows

    def drop_last(self, n: int) -> None:
        del self.rows[-n:]
        with open(self.path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(self.header)
            w.writerows(self.rows)


def which_hand(label: str, setting: str) -> str:
    """Same as resolveHand() in features.js. MediaPipe is given the raw
    (unmirrored) camera frame, so its Left/Right label is flipped."""
    if setting in ("left", "right"):
        return setting
    return "left" if label == "Right" else "right"


def put(img, text, xy, scale=0.7, color=(255, 255, 255), thick=2):
    cv2.putText(img, text, xy, cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), thick + 3, cv2.LINE_AA)
    cv2.putText(img, text, xy, cv2.FONT_HERSHEY_SIMPLEX, scale, color, thick, cv2.LINE_AA)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--name", help="who is signing (used to test on people the model hasn't seen)")
    parser.add_argument("--hand", choices=["auto", "left", "right"], default="auto")
    parser.add_argument("--camera", type=int, default=0, help="camera number, if you have more than one")
    args = parser.parse_args()
    name = (args.name or input("Who is signing? ")).strip().lower() or "unknown"
    name = re.sub(r"[^\w-]+", "_", name)

    day = dt.date.today().isoformat()
    still = Store(DATA_DIR / f"{name}_{day}.csv", STILL_HEADER)
    moving = Store(MOTION_DIR / f"{name}_{day}.csv", MOTION_HEADER)
    takes: list[tuple[Store, int]] = []  # for undo
    tips = load_tips()
    tips.update({s: t for s, t in MOTION.values()})
    motion_net = json.loads(MOTION_MODEL.read_text()) if MOTION_MODEL.exists() else None

    landmarker = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=mp_tasks.BaseOptions(model_asset_path=str(MODEL_PATH)),
        running_mode=vision.RunningMode.VIDEO,
        num_hands=1,
        min_hand_detection_confidence=0.6,
        min_hand_presence_confidence=0.6,
        min_tracking_confidence=0.6,
    ))
    cam = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW) if hasattr(cv2, "CAP_DSHOW") else cv2.VideoCapture(args.camera)
    cam.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cam.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    if not cam.isOpened():
        raise SystemExit("Couldn't open the camera. Close other apps using it (like the game in the browser) and try again.")

    sign = "A"
    auto_next = True
    phase, phase_start, last_sample, goes_left = "idle", 0.0, 0.0, 0
    captured: list[list[str]] = []
    trail: deque = deque()  # (time, [(x, y) per point])
    recent: deque = deque()  # (ms, frame_vector) for the live moving-sign guess
    guess, frame_no = "", 0
    message = f"Saving as '{name}' in training/data"
    window = "SignQuest recorder"
    start = time.monotonic()
    print(f"Recording as '{name}'. Still letters -> {still.path}\nMoving signs -> {moving.path}")

    def next_sign(s: str) -> str:
        group = MOTION_SIGNS if s in MOTION_SIGNS else LETTERS
        return group[(group.index(s) + 1) % len(group)]

    while True:
        ok, frame = cam.read()
        if not ok:
            raise SystemExit("The camera stopped sending pictures.")
        now = time.monotonic()
        ms = (now - start) * 1000
        frame_no += 1
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = landmarker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(ms))

        view = cv2.flip(frame, 1)  # mirror the preview only, like the game
        h, w = view.shape[:2]
        aspect = w / h
        is_motion = sign in MOTION_SIGNS
        hand = None
        if result.hand_landmarks:
            pts = result.hand_landmarks[0]
            whole = all(EDGE < p.x < 1 - EDGE and EDGE < p.y < 1 - EDGE for p in pts)
            world = np.array([(p.x, p.y, p.z) for p in result.hand_world_landmarks[0]])
            image = np.array([(p.x, p.y) for p in pts])
            label = which_hand(result.handedness[0][0].category_name, args.hand)
            hand = (pts, world, image, label, whole)
            trail.append((now, [(int((1 - p.x) * w), int(p.y * h)) for p in pts]))
            if motion_net:
                recent.append((ms, frame_vector(world, image, aspect, label)))
        while trail and now - trail[0][0] > TRAIL_S:
            trail.popleft()
        while recent and ms - recent[0][0] > MOTION_WINDOW_MS:
            recent.popleft()

        # Trails: every point leaves a fading line behind it.
        for k in range(1, len(trail)):
            fade = 1 - (now - trail[k][0]) / TRAIL_S
            for i in range(21):
                color = tuple(int(c * fade) for c in FINGER_COLORS[POINT_FINGER[i]])
                cv2.line(view, trail[k - 1][1][i], trail[k][1][i], color, 1 + int(2 * fade), cv2.LINE_AA)
        if hand:
            xy = trail[-1][1]
            color = (80, 220, 80) if hand[4] else (60, 160, 255)
            for a, b in HAND_LINES:
                cv2.line(view, xy[a], xy[b], color, 3, cv2.LINE_AA)
            for i, p in enumerate(xy):
                cv2.circle(view, p, 5, FINGER_COLORS[POINT_FINGER[i]], -1, cv2.LINE_AA)

        # Live guess for moving signs, once a model has been trained.
        if motion_net and frame_no % 3 == 0:
            guess = ""
            if len(recent) >= 8 and recent[-1][0] - recent[0][0] > MOTION_WINDOW_MS * 0.7:
                probs = motion_probs(motion_net, clip_input(np.array([t for t, _ in recent]), np.stack([v for _, v in recent])))
                best = int(probs.argmax())
                if motion_net["labels"][best] != "NOTHING" and probs[best] >= 0.6:
                    guess = f"{motion_net['labels'][best]} {probs[best]:.0%}"

        # ----- Recording -----
        if phase == "countdown" and now - phase_start >= COUNTDOWN_S:
            phase, phase_start, captured = "rec", now, []
        if phase == "rec":  # still letter
            if hand and hand[4] and now - last_sample >= SAMPLE_GAP_S:
                captured.append([sign, hand[3], name, str(int(time.time() * 1000))] + [str(round(v, 5)) for v in hand[1].reshape(-1)])
                last_sample = now
            if now - phase_start >= RECORD_S:
                phase = "idle"
                if len(captured) < 8:
                    message = f"Barely saw your hand ({len(captured)}). Try {sign} again."
                else:
                    still.add(captured)
                    takes.append((still, len(captured)))
                    message = f"Saved {len(captured)} samples of {sign}."
                    if auto_next:
                        sign = next_sign(sign)
        if phase == "ready" and now - phase_start >= READY_S:
            phase, phase_start, captured = "go", now, []
            clip_id = f"{name}-{int(time.time() * 1000)}"
        if phase == "go":  # moving sign: every frame with a hand in it
            if hand:
                t = round((now - phase_start) * 1000)
                captured.append([clip_id, sign, hand[3], name, str(t), f"{aspect:.4f}"]
                                + [str(round(v, 5)) for v in hand[1].reshape(-1)]
                                + [str(round(v, 5)) for v in hand[2].reshape(-1)])
            if now - phase_start >= GO_S:
                if len(captured) < 8:
                    message = f"Barely saw your hand in that go ({len(captured)} frames)."
                else:
                    moving.add(captured)
                    takes.append((moving, len(captured)))
                    message = f"Saved a go at {sign}."
                goes_left -= 1
                if goes_left > 0:
                    phase, phase_start = "ready", now
                else:
                    phase = "idle"
                    if auto_next:
                        sign = next_sign(sign)

        # ----- Overlay -----
        if is_motion:
            clips = {}
            for r in moving.rows:
                clips.setdefault(r[1], set()).add(r[0])
            counts = {s: len(clips.get(s, ())) for s in MOTION_SIGNS}
            group, goal, unit = MOTION_SIGNS, MOTION_GOAL, "goes"
        else:
            counts = {l: 0 for l in LETTERS}
            for r in still.rows:
                counts[r[0]] = counts.get(r[0], 0) + 1
            group, goal, unit = LETTERS, GOAL, "samples"
        cv2.rectangle(view, (0, 0), (w, 92), (40, 30, 30), -1)
        big = sign if len(sign) == 1 else sign.title()
        put(view, big, (14, 66), 2.2 if len(sign) == 1 else 1.0, (80, 210, 255), 5 if len(sign) == 1 else 3)
        x_text = 100 if len(sign) == 1 else 20 + cv2.getTextSize(big, cv2.FONT_HERSHEY_SIMPLEX, 1.0, 3)[0][0] + 16
        put(view, tips.get(sign, ""), (x_text, 30), 0.5)
        put(view, f"{counts[sign]} / {goal} {unit} of {sign}", (x_text, 66), 0.6, (200, 200, 200), 1)
        box = w // len(group)
        for i, s in enumerate(group):
            fill = (70, 160, 70) if counts[s] >= goal else (90, 90, 90) if counts[s] else (50, 50, 50)
            cv2.rectangle(view, (i * box + 1, 96), (i * box + box - 1, 108), (40, 200, 255) if s == sign else fill, -1)
        if is_motion:
            for i, (key, (s, _)) in enumerate(MOTION.items()):
                put(view, f"{key} {s.title()}", (w - 130, 136 + i * 20), 0.45, (80, 210, 255) if s == sign else (220, 220, 220), 1)
        if guess:
            put(view, f"Looks like: {guess}", (14, 150), 0.8, (90, 230, 90), 2)

        if phase == "countdown":
            put(view, f"Sign {sign} in {COUNTDOWN_S - (now - phase_start):.0f}...", (w // 2 - 120, h // 2), 1.2, (80, 210, 255), 3)
        elif phase == "rec":
            put(view, f"REC {len(captured)}", (w - 150, 136), 0.9, (60, 60, 255), 2)
            cv2.rectangle(view, (0, h - 14), (int(w * min(1.0, (now - phase_start) / RECORD_S)), h), (60, 60, 255), -1)
            put(view, "Move a little: closer, farther, tilted", (14, h - 26), 0.6)
        elif phase == "ready":
            put(view, f"Get ready... ({GOES - goes_left + 1} of {GOES})", (w // 2 - 150, h // 2), 1.0, (80, 210, 255), 3)
        elif phase == "go":
            put(view, f"GO! {sign}", (w // 2 - 80, h // 2), 1.6, (60, 60, 255), 4)
            cv2.rectangle(view, (0, h - 14), (int(w * min(1.0, (now - phase_start) / GO_S)), h), (60, 60, 255), -1)
        else:
            status = "No hand" if not hand else ("Whole hand in view" if hand[4] else "Move your whole hand into view")
            put(view, status, (14, 122), 0.6, (80, 220, 80) if hand and hand[4] else (60, 160, 255), 1)
            put(view, message, (14, h - 44), 0.55, (230, 230, 230), 1)
            put(view, f"SPACE record  A-Y letters  1-0 moving signs  TAB auto-next: {'on' if auto_next else 'off'}  BKSP undo  ESC quit",
                (10, h - 16), 0.42, (230, 230, 230), 1)
        cv2.imshow(window, view)

        key = cv2.waitKey(1) & 0xFF
        if key == 27 or cv2.getWindowProperty(window, cv2.WND_PROP_VISIBLE) < 1:
            break
        if phase != "idle":
            continue
        if key == ord(" "):
            if is_motion:
                phase, phase_start, goes_left = "ready", now, GOES
            else:
                phase, phase_start = "countdown", now
        elif key == 9:
            auto_next = not auto_next
        elif key == 8 and takes:
            store, n = takes.pop()
            removed = store.rows[-n][1 if store is moving else 0]
            store.drop_last(n)
            message = f"Undid the last take of {removed}."
        elif chr(key) in MOTION:
            sign = MOTION[chr(key)][0]
        elif chr(key).upper() in LETTERS:
            sign = chr(key).upper()

    cam.release()
    cv2.destroyAllWindows()
    landmarker.close()
    print(f"Saved {len(still.rows)} still samples and {len({r[0] for r in moving.rows})} moving clips.")
    print("Train with: python training/train.py (letters) and python training/train_motion.py (moving signs)")


if __name__ == "__main__":
    main()
