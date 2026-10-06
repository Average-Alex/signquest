// Webcam + MediaPipe Hand Landmarker. Everything runs in the browser: video
// frames never leave the device and are never saved.
//
// Other modules subscribe with onHand(callback); the callback gets, every
// frame, either null (no hand in view) or:
//   { landmarks, world, handedness }
//   landmarks:  21 {x, y, z} points in image coordinates (for drawing)
//   world:      21 {x, y, z} points in real-world units (for recognition)
//   handedness: MediaPipe's "Left"/"Right" label (see features.js - it's mirrored)

import { DrawingUtils, FilesetResolver, HandLandmarker } from "../vendor/mediapipe/vision_bundle.mjs";

const WASM_PATH = new URL("../vendor/mediapipe/wasm", import.meta.url).href;
const MODEL_PATH = new URL("../vendor/mediapipe/hand_landmarker.task", import.meta.url).href;

let landmarker = null;
let video = null;
let canvas = null;
let draw = null;
let lastVideoTime = -1;
let starting = null;
const listeners = new Set();

export function onHand(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export const isRunning = () => landmarker !== null && video !== null && !video.paused;

// Safe to call more than once; later calls wait for the first.
export function startCamera(videoEl, canvasEl) {
  if (!starting) {
    starting = start(videoEl, canvasEl).catch((err) => {
      starting = null;
      throw err;
    });
  }
  return starting;
}

async function start(videoEl, canvasEl) {
  video = videoEl;
  canvas = canvasEl;
  draw = new DrawingUtils(canvas.getContext("2d"));

  video.srcObject = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
    audio: false,
  });
  await video.play();

  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  landmarker = await createLandmarker(vision, "GPU").catch(() => createLandmarker(vision, "CPU"));
  requestAnimationFrame(loop);
}

function createLandmarker(vision, delegate) {
  // Some Chromebooks can't use the GPU path; CPU is slower but works anywhere.
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: "VIDEO",
    numHands: 1,
  });
}

function loop() {
  requestAnimationFrame(loop);
  if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;

  const result = landmarker.detectForVideo(video, performance.now());
  const handedness = result.handedness ?? result.handednesses;
  const hand = result.landmarks.length
    ? { landmarks: result.landmarks[0], world: result.worldLandmarks[0], handedness: handedness[0][0].categoryName }
    : null;

  drawHand(hand);
  for (const callback of listeners) callback(hand);
}

function drawHand(hand) {
  if (canvas.width !== video.videoWidth) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!hand) return;
  draw.drawConnectors(hand.landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#ffffff", lineWidth: 4 });
  draw.drawLandmarks(hand.landmarks, { color: "#ff4fa3", fillColor: "#ffd23f", lineWidth: 2, radius: 5 });
}
