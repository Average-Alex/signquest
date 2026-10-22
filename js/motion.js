// Moving signs (J, Z, HELLO, YES...): recognizes a sign from the last
// MOTION_WINDOW_MS of hand movement, using model/motion.json from
// training/train_motion.py.
//
// The math here is a copy of frame_vector(), clip_input() and motion_probs()
// in training/hand_features.py - keep them identical, or the model sees
// different numbers than it was trained on.

import { onHand } from "./camera.js";
import { flatten, resolveHand, toFeatures } from "./features.js";
import * as progress from "./progress.js";

const MIN_FRAMES = 8; // same as the live guess in training/record.py
export const MIN_CONFIDENCE = 0.6;

let net = null;
let recent = []; // [{ t, v }] frame vectors from the last window
let aspect = 4 / 3;
let cached; // the guess for the current `recent` (undefined = not worked out yet)
let loading = null;

// Loads the model and starts watching the camera. Resolves false if there's
// no trained model yet. Safe to call more than once.
export function initMotion() {
  loading ||= load();
  return loading;
}

async function load() {
  try {
    const res = await fetch("model/motion.json");
    if (!res.ok) return false;
    net = await res.json();
  } catch {
    return false;
  }
  onHand((hand) => {
    const now = performance.now();
    if (hand) {
      const video = document.getElementById("camera-video");
      if (video?.videoHeight) aspect = video.videoWidth / video.videoHeight;
      const label = resolveHand(hand.handedness, progress.get().settings.hand);
      recent.push({ t: now, v: frameVector(flatten(hand.world), hand.landmarks, aspect, label) });
      cached = undefined;
    }
    while (recent.length && now - recent[0].t > net.windowMs) {
      recent.shift();
      cached = undefined;
    }
  });
  return true;
}

export const motionLabels = () => net?.labels || [];

// The latest guess: { sign, confidence, probs } (sign is null when it's
// "NOTHING" or not sure enough), or null while there isn't enough movement
// to judge yet. Worked out at most once per camera frame.
export function getMotionGuess() {
  if (cached === undefined) cached = guess();
  return cached;
}

function guess() {
  if (!net || recent.length < MIN_FRAMES || recent.at(-1).t - recent[0].t < net.windowMs * 0.7) return null;
  const probs = motionProbs(net, clipInput(recent.map((f) => f.t), recent.map((f) => f.v)));
  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
  const label = net.labels[best];
  return { sign: label !== "NOTHING" && probs[best] >= MIN_CONFIDENCE ? label : null, confidence: probs[best], probs };
}

// Forget the movement so far (after a sign is counted, so it can't count twice).
export function resetMotion() {
  recent = [];
  cached = undefined;
}

// ---------- The same math as training/hand_features.py ----------

// One camera frame: the hand's shape, where the wrist is in the picture,
// and how big the hand looks. landmarks: 21 {x, y} points, 0-1.
export function frameVector(world, landmarks, aspect, hand) {
  const pts = landmarks.map((p) => [hand === "left" ? aspect - p.x * aspect : p.x * aspect, p.y]);
  const size = Math.hypot(pts[9][0] - pts[0][0], pts[9][1] - pts[0][1]);
  return [...toFeatures(world, hand), pts[0][0] - aspect / 2, pts[0][1] - 0.5, size];
}

// Frames at times (ms) -> net.T evenly spaced frames, each with the shape,
// where the wrist is, how far it has moved since the start (in hand sizes),
// and how big the hand looks compared with the clip's average.
export function clipInput(times, frames, T = net.T) {
  const n = frames[0].length;
  const t0 = times[0];
  const t1 = times.at(-1);
  const even = [];
  let j = 0;
  for (let k = 0; k < T; k++) {
    const t = t1 > t0 ? t0 + ((t1 - t0) * k) / (T - 1) : t0;
    while (j < times.length - 2 && times[j + 1] < t) j++;
    const span = times[j + 1] - times[j];
    const f = times.length > 1 && span > 0 ? Math.min(1, Math.max(0, (t - times[j]) / span)) : 0;
    const a = frames[j];
    const b = frames[Math.min(j + 1, frames.length - 1)];
    even.push(a.map((v, i) => v + (b[i] - v) * f));
  }
  const meanSize = even.reduce((s, f) => s + f[n - 1], 0) / T || 1;
  return even.map((f) => {
    const wrist = [f[n - 3], f[n - 2]];
    return [
      ...f.slice(0, n - 3),
      ...wrist,
      (wrist[0] - even[0][n - 3]) / meanSize,
      (wrist[1] - even[0][n - 2]) / meanSize,
      f[n - 1] / meanSize,
    ];
  });
}

// Each frame -> hidden numbers, two passes over 5 frames at a time, then the
// strongest and average response over the clip -> one probability per sign.
export function motionProbs(model, x) {
  let h = x.map((row) => {
    const z = row.map((v, i) => (v - model.mean[i]) / model.std[i]);
    return dense(z, model.frame.W, model.frame.b, true);
  });
  for (const conv of model.convs) {
    const k = conv.W[0][0].length;
    const pad = Math.floor(k / 2);
    h = h.map((_, t) =>
      conv.b.map((bias, o) => {
        let sum = bias;
        for (let d = 0; d < k; d++) {
          const src = h[t + d - pad];
          if (!src) continue; // zero padding at the ends
          const w = conv.W[o];
          for (let i = 0; i < src.length; i++) sum += w[i][d] * src[i];
        }
        return Math.max(0, sum);
      }),
    );
  }
  const width = h[0].length;
  const pooled = new Array(width * 2).fill(0);
  for (let i = 0; i < width; i++) {
    let max = -Infinity;
    let sum = 0;
    for (const row of h) {
      max = Math.max(max, row[i]);
      sum += row[i];
    }
    pooled[i] = max;
    pooled[width + i] = sum / h.length;
  }
  const logits = dense(pooled, model.out.W, model.out.b, false);
  const top = Math.max(...logits);
  const e = logits.map((v) => Math.exp(v - top));
  const total = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / total);
}

// W is [in][out].
function dense(x, W, b, relu) {
  const out = b.slice();
  for (let i = 0; i < x.length; i++) {
    const row = W[i];
    const xi = x[i];
    if (xi === 0) continue;
    for (let o = 0; o < out.length; o++) out[o] += xi * row[o];
  }
  return relu ? out.map((v) => Math.max(0, v)) : out;
}
