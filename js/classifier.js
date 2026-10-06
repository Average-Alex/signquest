// Sign recognition. The rest of the game only needs:
//
//   getPrediction() -> { letter, confidence } or null (no hand / not sure)
//
// Recognizers, best first ("auto" picks the best one available):
//   model:    the trained neural net in model/weights.json (training/train.py)
//   knn:      nearest neighbours over samples recorded on the Record page -
//             no training step, so it works as soon as you record some signs
//   keyboard: hold a letter key to "sign" it - for building and testing the
//             game without a camera. Also always on with ?dev in the URL.

import { onHand } from "./camera.js";
import { LETTERS, SMOOTH_FRAMES } from "./config.js";
import { flatten, resolveHand, toFeatures } from "./features.js";
import * as progress from "./progress.js";
import { getSamples, onSamplesChanged } from "./samples.js";

const DEV = new URLSearchParams(location.search).has("dev");
const KNN_K = 7;

let model = null; // { labels, layers: [{ W: [in][out], b: [out], activation }] }
let knn = null; // { features: number[][], labels: index into LETTERS }
let history = []; // recent probability vectors, for smoothing
let latest = null;
let lastHandSeen = null;
const keysDown = [];

export async function initClassifier() {
  try {
    const response = await fetch(new URL("../model/weights.json", import.meta.url));
    if (response.ok) model = await response.json();
  } catch {
    // No trained model yet - kNN or keyboard will be used.
  }
  rebuildKnn();
  onSamplesChanged(rebuildKnn);
  onHand(handleHand);

  addEventListener("keydown", (e) => {
    const key = e.key.toUpperCase();
    if (e.target.closest?.("input, textarea, select") || !LETTERS.includes(key)) return;
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
    return { letter: keysDown[keysDown.length - 1], confidence: 0.95 };
  }
  return latest;
}

// The most recent hand from the camera (null if none) - for the Record page.
export const getLastHand = () => lastHandSeen;

export function activeRecognizer() {
  const choice = progress.get().settings.recognizer;
  if (choice === "model" && model) return "model";
  if (choice === "knn" && knn) return "knn";
  if (choice === "keyboard") return "keyboard";
  return model ? "model" : knn ? "knn" : "keyboard";
}

export const hasModel = () => model !== null;
export const knnSampleCount = () => (knn ? knn.features.length : 0);

function rebuildKnn() {
  const samples = getSamples().filter((s) => LETTERS.includes(s.letter));
  knn = samples.length
    ? {
        features: samples.map((s) => toFeatures(s.world, s.hand)),
        labels: samples.map((s) => LETTERS.indexOf(s.letter)),
      }
    : null;
}

function handleHand(hand) {
  lastHandSeen = hand;
  const kind = activeRecognizer();
  if (!hand || kind === "keyboard") {
    history = [];
    latest = null;
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
  latest = { letter: LETTERS[best], confidence: avg[best] };
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

function knnProbs(features) {
  // Keep the K closest samples (simple insertion into a short sorted list).
  const nearest = []; // [distance, labelIndex]
  const { features: all, labels } = knn;
  for (let n = 0; n < all.length; n++) {
    const f = all[n];
    let d = 0;
    for (let i = 0; i < 63; i++) {
      const diff = f[i] - features[i];
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

// Tracks how long the target letter has been held. update() returns 0-1;
// 1 means it's been held long enough to count.
export class HoldTimer {
  constructor() {
    this.since = null;
  }

  update(target, prediction, now) {
    const { holdMs, minConfidence } = progress.get().settings;
    if (prediction && prediction.letter === target && prediction.confidence >= minConfidence) {
      if (this.since === null) this.since = now;
      return Math.min(1, (now - this.since) / holdMs);
    }
    this.since = null;
    return 0;
  }

  reset() {
    this.since = null;
  }
}
