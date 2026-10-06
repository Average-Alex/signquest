# SignQuest

A browser game where kids learn the ASL fingerspelling alphabet by signing to
a webcam. Each correct sign casts a spell in a battle. The camera checks the
sign live, so kids get instant feedback without a teacher in the room.

Built for the Congressional App Challenge.

🔒 All recognition runs in the browser. No video or pictures are uploaded or
saved, and there are no accounts.

## Run it

No install or build step needed. From this folder:

```
python -m http.server 8000
```

Then open http://localhost:8000. The camera only works on `localhost` or an
`https://` site (GitHub Pages works).

**Test mode:** open http://localhost:8000/?dev to get:
- a "Play with keyboard" button on the title screen (no camera needed)
- holding a letter key counts as signing it, anywhere in the game
- Settings > **Data recorder**

## How recognition works

1. Webcam frame → MediaPipe Hand Landmarker → 21 hand points (`js/camera.js`)
2. Normalize: wrist to the origin, divide by hand size, mirror left hands → 63
   numbers (`js/features.js`)
3. Recognizer → a probability for each of the 24 static letters (`js/classifier.js`)
4. Average the last 8 frames so the result doesn't flicker
5. Count it when the target letter is above the confidence bar and held for
   the hold time (both adjustable in Settings)

Using hand points, not raw images, keeps the model tiny and makes it far less
sensitive to skin tone, lighting, and background.

The rest of the game only calls one function:

```js
getPrediction() // -> { letter: "A", confidence: 0.93 } or null
```

The recognizer behind it is picked automatically:

| Recognizer | When it's used |
|---|---|
| Trained model | `model/weights.json` exists |
| kNN on recorded signs | no model yet, but samples were recorded on the Record page |
| Keyboard | nothing else available (or `?dev` in the URL) |

So the game is playable with your own hand as soon as you record a few signs,
before any model is trained.

## Training the model

1. Open the game with `?dev`, go to Settings > Data recorder.
2. Type who's signing, pick a letter, press Record (3 seconds). Move your hand
   around while recording: closer, farther, tilted, both hands.
3. Aim for 200+ samples per letter from several different people.
4. Download CSV → put it in `training/data/` (gitignored, since it has names).
5. `python training/train.py` (needs `torch` and `numpy`)

It prints accuracy with each person held out in turn - the honest number for
a new player - plus the most common mix-ups and a confusion matrix for the
look-alike letters A/S/E/T/M/N. Then it writes `model/weights.json`, which the
game picks up on the next reload.

If you change `toFeatures()` in `js/features.js`, change `to_features()` in
`training/train.py` to match.

## Project layout

| Path | What |
|---|---|
| `index.html` | All screens, as hidden sections |
| `css/style.css` | All styles |
| `js/config.js` | Zones, letters, words, tips, shop items, tuning numbers |
| `js/camera.js` | Webcam + MediaPipe, emits hand points each frame |
| `js/features.js` | Hand points → 63 normalized numbers |
| `js/classifier.js` | `getPrediction()`, smoothing, hold timer, model/kNN/keyboard |
| `js/game.js` | Battles: targets, hits, hints, skip, stars, rewards |
| `js/screens.js` | Screen switching, map, learn cards, results, shop, settings |
| `js/progress.js` | XP, coins, stars, miss counts, closet - saved in localStorage |
| `js/samples.js`, `js/record.js` | Recorded samples and the Record page |
| `js/main.js` | Startup and the title screen |
| `vendor/mediapipe/` | MediaPipe files, kept locally so it works offline / on school networks |
| `assets/hands/` | Your handshape reference photos (`A.jpg` ...) |
| `training/` | Training script and (private) recorded data |

## Deploy

Push to GitHub, then Settings > Pages > deploy from the `main` branch root.
Judges can play from the link; no build step.
