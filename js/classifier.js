// Sign recognition. The rest of the game only needs:
//
//   getPrediction() -> { letter, confidence, probs } or null (no hand)
//                      ({ partial: true } when the hand is only half in view)
//   new HoldTimer().update(target, prediction, now) -> 0..1 (1 = held long enough)
//
// MediaPipe finds the hand and its 21 points. Deciding WHICH letter that is
// happens here, with one of these ("auto" picks the best one available):
//   model:    the trained neural net in model/weights.json (training/train.py)
//   knn:      nearest neighbours over signs recorded on this device - the
//             "Teach the camera" screen or the Record page. No training step.
//   keyboard: hold a letter key to "sign" it - for building and testing the
//             game without a camera. Also always on with ?dev in the URL.
//
// Checking is target-aware: the game always knows which letter you're trying
// to sign, so HoldTimer asks "how sure are we it's THAT letter?" rather than
// "which of the 24 is it?". That's both kinder and much more reliable.

import { onHand } from "./camera.js";
import { ALPHABET, LETTERS, MOTION_LETTERS, SMOOTH_FRAMES } from "./config.js";
import { FEATURE_COUNT, FEATURE_GROUPS, flatten, handInView, resolveHand, toFeatures } from "./features.js";
import * as progress from "./progress.js";
import { getMotionGuess, MIN_CONFIDENCE as MOTION_MIN_CONFIDENCE, motionLabels, resetMotion } from "./motion.js";
import { getSamples, onSamplesChanged } from "./samples.js";

const DEV = new URLSearchParams(location.search).has("dev");
const KNN_K = 9;
const MAX_PER_LETTER = 400; // samples kept per letter for kNN (keeps it fast)
const AUGMENT_COPIES = 2; // extra slightly-turned copies of each sample

let model = null; // { labels, layers: [{ W: [in][out], b: [out], activation }] }
let knn = null; // { features: Float32Array[], labels: index into LETTERS }
let history = []; // recent probability vectors, for smoothing
let latest = null;
let lastHandSeen = null;
const keysDown = [];

// Each feature group's weight, applied once so plain distances use it.
const WEIGHTS = new Float32Array(FEATURE_COUNT);
{
  let i = 0;
  for (const g of FEATURE_GROUPS) for (let k = 0; k < g.size; k++) WEIGHTS[i++] = Math.sqrt(g.weight);
}
const weighted = (features) => Float32Array.from(features, (v, i) => v * WEIGHTS[i]);

export async function initClassifier() {
  try {
    const response = await fetch(new URL("../model/weights.json", import.meta.url));
    if (response.ok) {
      const loaded = await response.json();
      // A model trained on older features won't fit the new ones.
      if (loaded.layers?.[0]?.W?.length === FEATURE_COUNT) model = loaded;
    }
  } catch {
    // No trained model yet - kNN or keyboard will be used.
  }
  rebuildKnn();
  onSamplesChanged(rebuildKnn);
  onHand(handleHand);

  addEventListener("keydown", (e) => {
    const key = e.key.toUpperCase();
    if (e.target.closest?.("input, textarea, select") || !ALPHABET.includes(key)) return;
    if (!keysDown.includes(key)) keysDown.push(key);
  });
  addEventListener("keyup", (e) => {
    const i = keysDown.indexOf(e.key.toUpperCase());
    if (i >= 0) keysDown.splice(i, 1);
  });
  addEventListener("blur", () => (keysDown.length = 0));
}

export function getPrediction() {
  if ((DEV || activeRecognizer() === "keyboard") && keysDown.length) {
    const letter = keysDown[keysDown.length - 1];
    return { letter, confidence: 0.95, probs: LETTERS.map((l) => (l === letter ? 0.95 : 0)), keyboard: true };
  }
  return latest;
}

// The most recent hand from the camera (null if none) - for recording.
export const getLastHand = () => lastHandSeen;

export function activeRecognizer() {
  const choice = progress.get().settings.recognizer;
  if (choice === "model" && model) return "model";
  if (choice === "knn" && knn) return "knn";
  if (choice === "keyboard") return "keyboard";
  return model ? "model" : knn ? "knn" : "keyboard";
}

export const hasModel = () => model !== null;
export const knnSampleCount = () => (knn ? knn.count : 0);

// ---------- kNN over recorded samples ----------

// Turn the camera a little: rotate the raw points by small random angles.
// Shape features don't change, but "facing" does - so the recognizer learns
// that a slightly tilted hand is still the same letter.
function turned(world) {
  const r = () => (Math.random() - 0.5) * 2;
  const ax = r() * 0.2, ay = r() * 0.2, az = r() * 0.3; // radians: about +/-11, +/-11, +/-17 degrees
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay), Math.cos(az), Math.sin(az)];
  const out = new Array(63);
  for (let i = 0; i < 63; i += 3) {
    let x = world[i], y = world[i + 1], z = world[i + 2];
    [y, z] = [y * cx - z * sx, y * sx + z * cx];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    [x, y] = [x * cz - y * sz, x * sz + y * cz];
    out[i] = x + (Math.random() - 0.5) * 0.002;
    out[i + 1] = y + (Math.random() - 0.5) * 0.002;
    out[i + 2] = z + (Math.random() - 0.5) * 0.002;
  }
  return out;
}

function rebuildKnn() {
  const byLetter = {};
  for (const s of getSamples()) if (LETTERS.includes(s.letter)) (byLetter[s.letter] ||= []).push(s);
  const features = [];
  const labels = [];
  let count = 0;
  for (const [letter, list] of Object.entries(byLetter)) {
    // Keep it fast: an even spread of at most MAX_PER_LETTER samples per letter.
    const step = Math.max(1, list.length / MAX_PER_LETTER);
    for (let i = 0; i < list.length; i += step) {
      const s = list[Math.floor(i)];
      const label = LETTERS.indexOf(letter);
      features.push(weighted(toFeatures(s.world, s.hand)));
      labels.push(label);
      for (let k = 0; k < AUGMENT_COPIES; k++) {
        features.push(weighted(toFeatures(turned(s.world), s.hand)));
        labels.push(label);
      }
      count++;
    }
  }
  knn = count ? { features, labels, count } : null;
  history = [];
}

function knnProbs(features) {
  const q = weighted(features);
  // Keep the K closest samples (simple insertion into a short sorted list).
  const nearest = []; // [distance, labelIndex]
  const { features: all, labels } = knn;
  for (let n = 0; n < all.length; n++) {
    const f = all[n];
    let d = 0;
    for (let i = 0; i < FEATURE_COUNT; i++) {
      const diff = f[i] - q[i];
      d += diff * diff;
    }
    if (nearest.length < KNN_K || d < nearest[nearest.length - 1][0]) {
      let i = nearest.length;
      while (i > 0 && nearest[i - 1][0] > d) i--;
      nearest.splice(i, 0, [d, labels[n]]);
      if (nearest.length > KNN_K) nearest.pop();
    }
  }
  // Closer neighbours get a bigger vote; votes become probabilities.
  const probs = new Array(LETTERS.length).fill(0);
  let total = 0;
  for (const [d, label] of nearest) {
    const vote = 1 / (Math.sqrt(d) + 0.05);
    probs[label] += vote;
    total += vote;
  }
  return probs.map((p) => p / total);
}

// ---------- Every camera frame ----------

function handleHand(hand) {
  lastHandSeen = hand;
  const kind = activeRecognizer();
  if (!hand || kind === "keyboard") {
    history = [];
    latest = null;
    return;
  }
  // Half a hand gives wild guesses: ask for the whole hand instead.
  if (!handInView(hand.landmarks)) {
    history = [];
    latest = { letter: null, confidence: 0, probs: null, partial: true };
    return;
  }

  const features = toFeatures(flatten(hand.world), resolveHand(hand.handedness, progress.get().settings.hand));
  history.push(kind === "model" ? modelProbs(features) : knnProbs(features));
  if (history.length > SMOOTH_FRAMES) history.shift();

  // Average the last few frames so the answer doesn't flicker.
  const avg = new Array(LETTERS.length).fill(0);
  for (const probs of history) probs.forEach((p, i) => (avg[i] += p / history.length));
  let best = 0;
  for (let i = 1; i < avg.length; i++) if (avg[i] > avg[best]) best = i;
  latest = { letter: LETTERS[best], confidence: avg[best], probs: avg };
}

// Plain-JS forward pass of the exported dense net. It's three small layers,
// so this is fast enough per frame and avoids shipping a 1 MB+ ML library.
export function forward(net, input) {
  let a = input;
  for (const layer of net.layers) {
    const out = layer.b.slice();
    for (let i = 0; i < a.length; i++) {
      const ai = a[i];
      if (ai === 0) continue;
      const row = layer.W[i];
      for (let j = 0; j < out.length; j++) out[j] += ai * row[j];
    }
    if (layer.activation === "relu") {
      for (let j = 0; j < out.length; j++) if (out[j] < 0) out[j] = 0;
    } else if (layer.activation === "softmax") {
      const max = Math.max(...out);
      let sum = 0;
      for (let j = 0; j < out.length; j++) sum += out[j] = Math.exp(out[j] - max);
      for (let j = 0; j < out.length; j++) out[j] /= sum;
    }
    a = out;
  }
  return a;
}

function modelProbs(features) {
  const out = forward(model, features);
  // Re-order into LETTERS order in case the model's label order differs.
  const probs = new Array(LETTERS.length).fill(0);
  model.labels.forEach((letter, i) => {
    const j = LETTERS.indexOf(letter);
    if (j >= 0) probs[j] = out[i];
  });
  return probs;
}

// How sure we are the hand is showing `target` right now (0..1).
export function targetConfidence(target, prediction) {
  if (!prediction || prediction.partial) return 0;
  if (prediction.probs && LETTERS.includes(target)) return prediction.probs[LETTERS.indexOf(target)] || 0;
  return prediction.letter === target ? prediction.confidence : 0;
}

// Tracks how long the target letter has been held. update() returns 0-1;
// 1 means it's been held long enough to count.
// J and Z are drawn in the air, not held: they count as soon as the
// moving-sign recognizer sees them (the bar shows how close it is).
export class HoldTimer {
  constructor() {
    this.since = null;
  }

  update(target, prediction, now) {
    if (MOTION_LETTERS.includes(target) && !prediction?.keyboard) return this.updateMoving(target);
    const { holdMs, minConfidence } = progress.get().settings;
    const sure = targetConfidence(target, prediction);
    // It counts if we're sure enough it's the target, or it's our top guess and nearly sure enough.
    const ok = sure >= minConfidence || (prediction?.letter === target && sure >= minConfidence - 0.15);
    if (ok) {
      if (this.since === null) this.since = now;
      return holdMs > 0 ? Math.min(1, (now - this.since) / holdMs) : 1;
    }
    this.since = null;
    return 0;
  }

  updateMoving(target) {
    const guess = getMotionGuess();
    if (guess?.sign === target) {
      resetMotion(); // so the same movement can't count for the next letter too
      return 1;
    }
    const i = motionLabels().indexOf(target);
    return guess && i >= 0 ? Math.min(0.95, guess.probs[i] / MOTION_MIN_CONFIDENCE) : 0;
  }

  reset() {
    this.since = null;
  }
}
