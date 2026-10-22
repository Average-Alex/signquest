// Moving-sign test screen: sign anything and watch what js/motion.js thinks,
// live. For checking the moving-sign model before it's used in battles.
// Open it with ?motion in the URL, or with ?dev (Settings > Moving signs test).

import { isRunning, startCamera } from "./camera.js";
import { getLastHand } from "./classifier.js";
import { MOTION_TIPS } from "./config.js";
import { getMotionGuess, initMotion, motionLabels, resetMotion } from "./motion.js";
import { isShowing, show, showHooks } from "./screens.js";
import { setText } from "./pixel-emoji.js";

const $ = (id) => document.getElementById(id);
const GUESS_EVERY = 3; // frames between guesses (it's a bigger model than the letters)
const SHOW_MS = 1500; // how long a recognized sign stays up

let rows = {};
let log = [];
let shownUntil = 0;
let frame = 0;

export async function initMotionTest() {
  const ready = await initMotion();
  $("motion-start-camera").onclick = async () => {
    $("motion-start-camera").disabled = true;
    try {
      await startCamera($("camera-video"), $("camera-canvas"));
      $("motion-start-camera").hidden = true;
      show("motion"); // move the camera view into this screen
    } catch {
      setText($("motion-guess"), "The camera didn't start. Allow it in the address bar, then try again.");
    }
    $("motion-start-camera").disabled = false;
  };
  $("motion-clear").onclick = () => {
    log = [];
    renderLog();
  };
  if (!ready) {
    setText($("motion-guess"), "No moving-sign model yet. Train one with training/train_motion.py.");
    return;
  }
  buildRows();
  showHooks.motion = () => {
    $("motion-start-camera").hidden = isRunning();
    resetMotion();
    requestAnimationFrame(tick);
  };
}

function buildRows() {
  const box = $("motion-rows");
  box.innerHTML = "";
  rows = {};
  for (const sign of motionLabels()) {
    const row = document.createElement("div");
    row.className = "motion-row";
    row.innerHTML = `<b>${sign === "NOTHING" ? "(nothing)" : sign}</b><div class="motion-bar"><div class="motion-fill"></div></div><span>0%</span><small>${MOTION_TIPS[sign] || ""}</small>`;
    box.appendChild(row);
    rows[sign] = { row, fill: row.querySelector(".motion-fill"), pct: row.querySelector("span") };
  }
}

function tick(now) {
  if (!isShowing("motion")) return;
  requestAnimationFrame(tick);
  if (frame++ % GUESS_EVERY) return;

  const guess = getMotionGuess();
  const labels = motionLabels();
  labels.forEach((sign, i) => {
    const p = guess ? guess.probs[i] : 0;
    rows[sign].fill.style.width = `${p * 100}%`;
    rows[sign].pct.textContent = `${Math.round(p * 100)}%`;
    rows[sign].row.classList.toggle("top", Boolean(guess) && guess.probs[i] === Math.max(...guess.probs));
  });

  if (guess?.sign) {
    // Count it once, then start watching fresh so the same movement can't count twice.
    setText($("motion-guess"), `${guess.sign}! ${Math.round(guess.confidence * 100)}%`);
    $("motion-guess").className = "motion-guess good";
    shownUntil = now + SHOW_MS;
    log.unshift(`${guess.sign} (${Math.round(guess.confidence * 100)}%)`);
    renderLog();
    resetMotion();
  } else if (now > shownUntil) {
    $("motion-guess").className = "motion-guess";
    setText($("motion-guess"), !isRunning() ? "" : getLastHand() ? "Watching… do a sign" : "Show your hand ✋");
  }
}

function renderLog() {
  $("motion-log").textContent = log.length ? log.slice(0, 12).join(" · ") : "Nothing yet.";
}
