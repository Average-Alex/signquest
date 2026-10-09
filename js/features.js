// Turns 21 hand landmarks into the numbers the recognizer sees.
//
// training/train.py has a Python copy of toFeatures() - if you change one,
// change the other, or the trained model will see different numbers in the
// browser than it was trained on.
//
// The features are built to describe the HANDSHAPE, not how the hand happens
// to be held:
//   - Every point is measured in the hand's own frame (wrist at the origin,
//     "up" toward the middle knuckle, "across" the palm), scaled by hand size.
//     Tilting or turning your hand doesn't change these.
//   - How bent each finger joint is (curl), which is what separates fists
//     from open hands, and X from D.
//   - Distances between fingertips, especially from the thumb tip - this is
//     what tells A, S, T, M, N, and E apart (where's the thumb?).
//   - Which way the hand points and faces in the camera's view, at lower
//     weight - the only thing that separates G from Q, H from U, K from P.

// MediaPipe labels handedness as if the image were mirrored (selfie view).
// We feed it the raw, unmirrored webcam frame, so its label is backwards:
// "Right" means the player's left hand.
export function resolveHand(mediapipeLabel, setting) {
  if (setting === "left" || setting === "right") return setting;
  return mediapipeLabel === "Right" ? "left" : "right";
}

// Finger chains: wrist-side knuckle first, fingertip last.
const FINGERS = [
  [1, 2, 3, 4], // thumb
  [5, 6, 7, 8], // index
  [9, 10, 11, 12], // middle
  [13, 14, 15, 16], // ring
  [17, 18, 19, 20], // pinky
];
const TIP_PAIRS = [[4, 8], [4, 12], [4, 16], [4, 20], [8, 12], [12, 16], [16, 20], [4, 6], [4, 10], [8, 10]];

// Feature groups and how much each counts when comparing two hands (kNN).
export const FEATURE_GROUPS = [
  { name: "shape", size: 63, weight: 1 }, // points in the hand's own frame
  { name: "curl", size: 15, weight: 2 }, // finger joint bends
  { name: "tips", size: TIP_PAIRS.length, weight: 2 }, // fingertip distances
  { name: "facing", size: 6, weight: 0.8 }, // where the hand points and faces
];
export const FEATURE_COUNT = FEATURE_GROUPS.reduce((n, g) => n + g.size, 0);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
// The angle between two directions, as 0 (same way) to 1 (opposite).
const bend = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) / Math.PI;

// world: flat array of 63 numbers (x, y, z for each of the 21 points), from
// MediaPipe's world landmarks - real-world units, so the camera's aspect
// ratio doesn't stretch the hand. hand: "left" or "right".
export function toFeatures(world, hand) {
  // Mirror left hands so lefties sign the same shape the recognizer learned.
  const p = [];
  for (let i = 0; i < 21; i++) p.push([hand === "left" ? -world[i * 3] : world[i * 3], world[i * 3 + 1], world[i * 3 + 2]]);

  // The hand's own frame.
  const wrist = p[0];
  const size = len(sub(p[9], wrist)) || 1; // wrist to middle knuckle = hand size
  const up = unit(sub(p[9], wrist));
  const rawAcross = sub(p[5], p[17]); // pinky knuckle to index knuckle
  const across = unit(sub(rawAcross, up.map((u) => u * dot(rawAcross, up))));
  const facing = cross(across, up); // out of the palm

  const out = [];
  // Shape: every point in the hand's frame.
  for (const pt of p) {
    const d = sub(pt, wrist);
    out.push(dot(d, across) / size, dot(d, up) / size, dot(d, facing) / size);
  }
  // Curl: the bend at each joint of each finger (knuckle bend measured from the palm).
  for (const [a, b, c, d] of FINGERS) {
    out.push(bend(sub(p[a], wrist), sub(p[b], p[a])), bend(sub(p[b], p[a]), sub(p[c], p[b])), bend(sub(p[c], p[b]), sub(p[d], p[c])));
  }
  // Tips: how far apart key fingertips are.
  for (const [a, b] of TIP_PAIRS) out.push(len(sub(p[a], p[b])) / size);
  // Facing: which way the hand points and the palm faces, in the camera's view.
  out.push(...up, ...facing);
  return out;
}

export function flatten(points) {
  const out = new Array(points.length * 3);
  points.forEach((p, i) => {
    out[i * 3] = p.x;
    out[i * 3 + 1] = p.y;
    out[i * 3 + 2] = p.z;
  });
  return out;
}

// Is the whole hand in the picture? (Image landmarks are 0-1 across the frame.)
export function handInView(landmarks, margin = 0.02) {
  return landmarks.every((pt) => pt.x > margin && pt.x < 1 - margin && pt.y > margin && pt.y < 1 - margin);
}
