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

## How playing works

**Exploring.** Pick a zone on the map to walk around it. Use the arrow keys
or WASD, or tap where to go. Each zone is six areas tall, explored bottom to
top along a winding path, and the view scrolls with you. Creatures roam
around. Bump into one to battle it:

- ⚔️ practice battle (letters)
- 📜 word battle, once you've won a practice battle in that zone
- 💤 a gate guard: a locked gate separates each area from the next. Its guard
  wakes up after you beat 2 creatures in that area. Beat the guard to open
  the gate.
- 👑 the boss, by the zone's landmark at the very top. Once it's beaten, it's
  gone for good and the next zone opens.

Also in each area:

- 🔐 a treasure chest. Sign the letter shown to open it, for coins or a potion.
- 🪧 a signpost with a fact about ASL and Deaf culture, or a game tip.
- ✨ coins to pick up.

**Getting stronger.** Monsters have levels (shown as "Lv"). They're higher
in later areas and later zones, from Lv 1 in the Meadow up to about Lv 50.
Higher levels hit harder and take more signs to beat. Your own max HP grows
with your player level.

**The Starfall Realm.** Beating the Castle boss opens a portal on the map to
a second dimension with three harder zones: Crystal Spires (the look-alike
fist letters A, E, M, N, S, T), Cloud Kingdom, and the Void Rift (the whole
alphabet).

**The story.** Malgrath the Hollow King shattered the Great Beacon into 8
Beacon Shards, and creatures everywhere became Hexbound. You're the last
apprentice of the Signkeeper Academy, with Pip the fox-moth at your side.
Each zone's boss guards a shard. Each shard brings back one of Pip's
memories, building to the twist that Pip is the Beacon's own spirit.
Malgrath himself waits at the top of the Void Rift. The script is in
`js/story.js`. Scenes play once each: the intro, the first visit to each
zone, before each boss, and after each boss.

**Battles** are turn-based. On your turn, pick a move, then sign the target
(a letter, or a whole word one letter at a time) to fire it:

- Your hero's spells: ✨ Spark (free), 💥 Blast (3⚡, 2x damage), 🌟 Nova
  (6⚡, 3.5x damage).
- Each buddy's special move, such as a big hit, a shield, a heal, or a stun.
  Every creature has its own move and energy cost.
- Energy ⚡ comes from signing: +1 for every letter, +1 more for signing fast
  without a hint. Spark is free, so you're never stuck.

Your move can be a critical hit (more often if you signed fast). Then both
buddies get a free hit, and the monster attacks back. Sometimes signing fast
leaves it too dizzy to attack, and a stun always does. The battle lasts until
the hex bar is empty. Potions and power-ups don't use up your turn. They come
from the Shop, chests, and loot after wins. Run out of HP and you're knocked
out, but you keep some XP and can try again.

**Creatures.** Break a creature's hex the first time and it joins you. Pick up
to 2 buddies in the 📖 creature book. They fight beside you and level up after
every battle. A few rare creatures are sold in the Shop.

The numbers (HP, damage, levels, crit and dizzy chances, buddy leveling, how
fast is "fast", areas per zone, loot) and the zone and creature lists are in
`js/config.js`.

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
| `js/sprites.js` | Pixel art drawn as text grids (hero maker parts, hats, creatures, potions, landmarks), smoothed with Scale2x |
| `js/worldmap.js` | Paints the world maps (the Overworld island and the Starfall Realm) |
| `js/camera.js` | Webcam + MediaPipe, emits hand points each frame |
| `js/features.js` | Hand points → 63 normalized numbers |
| `js/classifier.js` | `getPrediction()`, smoothing, hold timer, model/kNN/keyboard |
| `js/biome.js` | The walkable area for each zone: map building, gates, chests, walking, roaming creatures |
| `js/game.js` | Turn-based battles: moves and energy, crits, buddies, the monster's attack, potions, stars, loot, freeing creatures |
| `js/story.js` | The story script and the dialogue box |
| `js/screens.js` | Screen switching, map, learn cards, results, shop, hero maker, creature book, settings |
| `js/progress.js` | XP, coins, stars, miss counts, hats, potions, creatures - saved in localStorage |
| `js/samples.js`, `js/record.js` | Recorded samples and the Record page |
| `js/main.js` | Startup and the title screen |
| `vendor/mediapipe/` | MediaPipe files, kept locally so it works offline / on school networks |
| `assets/hands/` | Your handshape reference photos (`A.jpg` ...) |
| `training/` | Training script and (private) recorded data |

## Deploy

Push to GitHub, then Settings > Pages > deploy from the `main` branch root.
Judges can play from the link; no build step.
