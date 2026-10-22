// "Teach the camera your hands": a 2-minute walk through all 24 letters that
// records YOUR signs, so the recognizer (kNN, in classifier.js) knows what
// your hands look like. It doesn't need to recognize anything to work - it
// knows which letter it asked for.
//
// For each letter: wait until the whole hand is in view, a short "get
// ready", then record for a couple of seconds while the player moves their
// hand a little (closer, farther, tilted). Then on to the next letter.

import { isRunning, startCamera } from "./camera.js";
import { getLastHand } from "./classifier.js";
import { LETTERS, TIPS } from "./config.js";
import { flatten, handInView, resolveHand } from "./features.js";
import * as progress from "./progress.js";
import { addSamples, countsByLetter } from "./samples.js";
import { announce, flashCamera, isShowing, setHandImage, show } from "./screens.js";
import { setText } from "./pixel-emoji.js";

const $ = (id) => document.getElementById(id);
const READY_MS = 900;
const RECORD_MS = 2500;
const SAMPLE_GAP_MS = 66; // about 15 a second
export const ENOUGH = 25; // samples per letter that count as "done"

let state = null; // { i, phase, since, captured, last, lastHand }
let goBack = () => show("title");

export function openCalibration(back) {
  goBack = back;
  const counts = countsByLetter();
  // Start at the first letter that still needs samples (or from A to add more).
  const first = LETTERS.findIndex((l) => (counts[l] || 0) < ENOUGH);
  state = { i: first < 0 ? 0 : first, phase: "wait", since: 0, captured: [], last: 0, lastHand: null };
  show("calibrate");
  $("calib-done").hidden = true;
  $("calib-main").hidden = false;
  $("calib-start-camera").hidden = isRunning();
  showLetter();
  requestAnimationFrame(tick);
}

function showLetter() {
  const letter = LETTERS[state.i];
  $("calib-letter").textContent = letter;
  $("calib-tip").textContent = TIPS[letter];
  setHandImage($("calib-img"), letter);
  $("calib-count").textContent = `${state.i + 1} / ${LETTERS.length}`;
  $("calib-bar").style.width = "0%";
  state.phase = "wait";
  state.captured = [];
  renderChips();
  setStatus(`Sign ${letter}, with your whole hand in view.`);
  announce(`Sign ${letter}. ${TIPS[letter]}`);
}

function renderChips() {
  const counts = countsByLetter();
  $("calib-chips").innerHTML = LETTERS.map(
    (l, n) => `<span class="calib-chip${(counts[l] || 0) >= ENOUGH ? " done" : ""}${n === state.i ? " now" : ""}">${l}</span>`,
  ).join("");
}

function setStatus(text) {
  setText($("calib-status"), text);
}

function tick(now) {
  if (!state || !isShowing("calibrate")) return;
  requestAnimationFrame(tick);
  if (state.phase === "done") return;
  const hand = getLastHand();
  const whole = hand && handInView(hand.landmarks);
  const letter = LETTERS[state.i];

  if (state.phase === "wait") {
    if (!hand) return setStatus(`Sign ${letter}, with your whole hand in view.`);
    if (!whole) return setStatus("✋ Move your whole hand into the picture.");
    state.phase = "ready";
    state.since = now;
  }
  if (state.phase === "ready") {
    if (!whole) return (state.phase = "wait");
    setStatus(`Hold ${letter}... get ready!`);
    if (now - state.since >= READY_MS) {
      state.phase = "rec";
      state.since = now;
    }
    return;
  }
  // Recording: keep new frames with the whole hand in view.
  if (whole && hand !== state.lastHand && now - state.last >= SAMPLE_GAP_MS) {
    state.captured.push({
      letter,
      hand: resolveHand(hand.handedness, progress.get().settings.hand),
      recorder: "me",
      t: Date.now(),
      world: flatten(hand.world).map((v) => Math.round(v * 1e5) / 1e5),
    });
    state.last = now;
    state.lastHand = hand;
  }
  const elapsed = now - state.since;
  $("calib-bar").style.width = `${Math.min(100, (elapsed / RECORD_MS) * 100)}%`;
  setStatus(whole ? "🔴 Recording! Move your hand a little: closer, farther, tilt it." : "✋ Keep your whole hand in view!");
  if (elapsed >= RECORD_MS) finishLetter();
}

function finishLetter() {
  const letter = LETTERS[state.i];
  if (state.captured.length < 8) {
    // Barely saw the hand: try this letter again.
    showLetter();
    setStatus("I didn't see your hand much. Let's try that one again!");
    return;
  }
  if (!addSamples(state.captured)) {
    setStatus("This device's storage is full. Clear old samples on the Record page.");
    state.phase = "done";
    return;
  }
  flashCamera("good");
  announce(`Got ${letter}!`);
  setStatus(`Got ${letter}! ✅`);
  state.phase = "saved";
  setTimeout(() => {
    if (!state || state.phase !== "saved") return;
    if (state.i + 1 < LETTERS.length) {
      state.i++;
      showLetter();
    } else finish();
  }, 600);
}

function finish() {
  state.phase = "done";
  renderChips();
  $("calib-main").hidden = true;
  $("calib-done").hidden = false;
  $("calib-done-back").focus();
  announce("All done! The camera knows your hands now.");
}

$("calib-skip").onclick = () => {
  if (!state) return;
  if (state.i + 1 < LETTERS.length) {
    state.i++;
    showLetter();
  } else finish();
};
$("calib-redo").onclick = () => state && showLetter();
$("calib-back").onclick = $("calib-done-back").onclick = () => {
  state = null;
  goBack();
};
$("calib-start-camera").onclick = async () => {
  $("calib-start-camera").disabled = true;
  try {
    await startCamera($("camera-video"), $("camera-canvas"));
    $("calib-start-camera").hidden = true;
    show("calibrate"); // move the camera view into this screen
  } catch {
    setStatus("The camera didn't start. Allow it in the address bar, then try again.");
  }
  $("calib-start-camera").disabled = false;
};
