// Turns 21 hand landmarks into the 63 numbers the recognizer sees.
//
// training/train.py has a Python copy of toFeatures() - if you change one,
// change the other, or the trained model will see different numbers in the
// browser than it was trained on.

// MediaPipe labels handedness as if the image were mirrored (selfie view).
// We feed it the raw, unmirrored webcam frame, so its label is backwards:
// "Right" means the player's left hand.
export function resolveHand(mediapipeLabel, setting) {
  if (setting === "left" || setting === "right") return setting;
  return mediapipeLabel === "Right" ? "left" : "right";
}

// world: flat array of 63 numbers (x, y, z for each of the 21 points), from
// MediaPipe's world landmarks - real-world units, so the camera's aspect
// ratio doesn't stretch the hand.
export function toFeatures(world, hand) {
  const wx = world[0], wy = world[1], wz = world[2];
  // Point 9 is the middle-finger knuckle; wrist-to-knuckle is the hand's size.
  const size = Math.hypot(world[27] - wx, world[28] - wy, world[29] - wz) || 1;
  const out = new Array(63);
  for (let i = 0; i < 63; i += 3) {
    const x = (world[i] - wx) / size;
    // Mirror left hands so lefties sign the same shape the model learned.
    out[i] = hand === "left" ? -x : x;
    out[i + 1] = (world[i + 1] - wy) / size;
    out[i + 2] = (world[i + 2] - wz) / size;
  }
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
