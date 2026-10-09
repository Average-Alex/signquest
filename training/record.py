"""Record ASL letters from your webcam for training, outside the game.

    python training/record.py --name alex

A window opens with your camera. Press a letter key to pick a letter, then
SPACE to record it for 3 seconds while you move your hand around a little
(closer, farther, tilted). Every take is saved right away to
training/data/<name>_<date>.csv, the same format as the game's Record page,
so train.py reads it as-is.

It saves the 21 hand points MediaPipe finds, not photos.

Keys:
    A-Y      pick a letter (J and Z need motion, so they're skipped)
    SPACE    record the current letter
    TAB      turn "go to the next letter after each take" on/off
    BACKSPACE  undo the last take
    ESC      quit

Needs: pip install mediapipe opencv-python numpy
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import re
import time
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "training" / "data"
MODEL_PATH = ROOT / "vendor" / "mediapipe" / "hand_landmarker.task"
LETTERS = list("ABCDEFGHIKLMNOPQRSTUVWXY")  # same order as js/config.js
COUNTDOWN_S = 2.0
RECORD_S = 3.0
SAMPLE_GAP_S = 0.066  # about 15 samples a second, like the game
GOAL = 200  # samples per letter per person worth aiming for
EDGE = 0.02  # same "whole hand in view" margin as handInView() in features.js
HAND_LINES = [(0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8), (5, 9), (9, 10), (10, 11),
              (11, 12), (9, 13), (13, 14), (14, 15), (15, 16), (13, 17), (17, 18), (18, 19), (19, 20), (0, 17)]


def load_tips() -> dict[str, str]:
    """The how-to hints for each letter, read from js/config.js."""
    text = (ROOT / "js" / "config.js").read_text(encoding="utf-8")
    return dict(re.findall(r'^\s+([A-Y]): "([^"]*)",', text, re.M))


def header() -> list[str]:
    return ["letter", "hand", "recorder", "timestamp"] + [f"{a}{i}" for i in range(21) for a in "xyz"]


def read_rows(path: Path) -> list[list[str]]:
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.reader(f))[1:]


def write_rows(path: Path, rows: list[list[str]]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header())
        w.writerows(rows)


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

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out_path = DATA_DIR / f"{name}_{dt.date.today().isoformat()}.csv"
    rows = read_rows(out_path)
    takes: list[int] = []  # rows added by each take, for undo
    tips = load_tips()

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

    letter = "A"
    auto_next = True
    phase, phase_start, last_sample = "idle", 0.0, 0.0
    captured: list[list[str]] = []
    message = f"Saving to {out_path.relative_to(ROOT)}"
    window = "SignQuest recorder"
    start = time.monotonic()
    print(f"Recording as '{name}'. Saving to {out_path}")

    while True:
        ok, frame = cam.read()
        if not ok:
            raise SystemExit("The camera stopped sending pictures.")
        now = time.monotonic()
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = landmarker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int((now - start) * 1000))

        view = cv2.flip(frame, 1)  # mirror the preview only, like the game
        h, w = view.shape[:2]
        hand = None
        if result.hand_landmarks:
            pts = result.hand_landmarks[0]
            whole = all(EDGE < p.x < 1 - EDGE and EDGE < p.y < 1 - EDGE for p in pts)
            hand = (pts, result.hand_world_landmarks[0], result.handedness[0][0].category_name, whole)
            xy = [(int((1 - p.x) * w), int(p.y * h)) for p in pts]
            color = (80, 220, 80) if whole else (60, 160, 255)
            for a, b in HAND_LINES:
                cv2.line(view, xy[a], xy[b], color, 3, cv2.LINE_AA)
            for p in xy:
                cv2.circle(view, p, 5, (255, 255, 255), -1, cv2.LINE_AA)

        # Record phases: countdown, then capture whole-hand frames for a few seconds.
        if phase == "countdown" and now - phase_start >= COUNTDOWN_S:
            phase, phase_start, captured = "rec", now, []
        if phase == "rec":
            if hand and hand[3] and now - last_sample >= SAMPLE_GAP_S:
                world = [round(v, 5) for p in hand[1] for v in (p.x, p.y, p.z)]
                captured.append([letter, which_hand(hand[2], args.hand), name, str(int(time.time() * 1000))] + [str(v) for v in world])
                last_sample = now
            if now - phase_start >= RECORD_S:
                phase = "idle"
                if len(captured) < 8:
                    message = f"Barely saw your hand ({len(captured)}). Try {letter} again."
                else:
                    rows += captured
                    takes.append(len(captured))
                    write_rows(out_path, rows)
                    message = f"Saved {len(captured)} samples of {letter}."
                    if auto_next:
                        letter = LETTERS[(LETTERS.index(letter) + 1) % len(LETTERS)]

        # Overlay.
        counts = {l: 0 for l in LETTERS}
        for r in rows:
            counts[r[0]] = counts.get(r[0], 0) + 1
        cv2.rectangle(view, (0, 0), (w, 92), (40, 30, 30), -1)
        put(view, letter, (14, 72), 2.4, (80, 210, 255), 5)
        put(view, tips.get(letter, ""), (100, 34), 0.6)
        put(view, f"{counts[letter]} / {GOAL} samples of {letter}    total {len(rows)}", (100, 70), 0.6, (200, 200, 200), 1)
        if phase == "countdown":
            put(view, f"Sign {letter} in {COUNTDOWN_S - (now - phase_start):.0f}...", (w // 2 - 120, h // 2), 1.2, (80, 210, 255), 3)
        elif phase == "rec":
            put(view, f"REC {len(captured)}", (w - 150, 130), 0.9, (60, 60, 255), 2)
            bar = int(w * min(1.0, (now - phase_start) / RECORD_S))
            cv2.rectangle(view, (0, h - 14), (bar, h), (60, 60, 255), -1)
            put(view, "Move a little: closer, farther, tilted", (14, h - 26), 0.6)
        else:
            status = "No hand" if not hand else ("Whole hand in view" if hand[3] else "Move your whole hand into view")
            put(view, status, (14, 122), 0.6, (80, 220, 80) if hand and hand[3] else (60, 160, 255), 1)
            put(view, message, (14, h - 44), 0.55, (230, 230, 230), 1)
            put(view, f"SPACE record   A-Y letter   TAB auto-next: {'on' if auto_next else 'off'}   BKSP undo   ESC quit",
                (14, h - 16), 0.48, (230, 230, 230), 1)
        # Progress strip: one box per letter, green once it has enough.
        box = w // len(LETTERS)
        for i, l in enumerate(LETTERS):
            x0 = i * box
            fill = (70, 160, 70) if counts[l] >= GOAL else (90, 90, 90) if counts[l] else (50, 50, 50)
            cv2.rectangle(view, (x0 + 1, 96), (x0 + box - 1, 108), (40, 200, 255) if l == letter else fill, -1)
        cv2.imshow(window, view)

        key = cv2.waitKey(1) & 0xFF
        if key == 27 or cv2.getWindowProperty(window, cv2.WND_PROP_VISIBLE) < 1:
            break
        if phase != "idle":
            continue
        if key == ord(" "):
            phase, phase_start = "countdown", now
        elif key == 9:
            auto_next = not auto_next
        elif key == 8 and takes:
            n = takes.pop()
            removed = rows[-n][0]
            del rows[-n:]
            write_rows(out_path, rows)
            message = f"Undid the last take of {removed} ({n} samples)."
        elif chr(key).upper() in LETTERS:
            letter = chr(key).upper()

    cam.release()
    cv2.destroyAllWindows()
    landmarker.close()
    print(f"Saved {len(rows)} samples to {out_path}")
    print("When you have data from a few people, run: python training/train.py")


if __name__ == "__main__":
    main()
