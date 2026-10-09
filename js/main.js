// Startup and the title / setup screen.

import { onHand, startCamera } from "./camera.js";
import { initClassifier } from "./classifier.js";
import * as progress from "./progress.js";
import { ENOUGH, openCalibration } from "./calibrate.js";
import { initRecordPage } from "./record.js";
import { countsByLetter } from "./samples.js";
import { show } from "./screens.js";
import { playScene } from "./story.js";

const $ = (id) => document.getElementById(id);
const DEV = new URLSearchParams(location.search).has("dev");
const RECORD = new URLSearchParams(location.search).has("record");

// Any button with data-go="screen" switches to that screen.
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-go]");
  if (button) show(button.dataset.go);
});

await initClassifier();
initRecordPage();
$("open-record").hidden = !DEV && !RECORD;

// ---------- Title / setup ----------

let handSeen = false;
$("player-name").value = progress.get().name;
$("player-name").oninput = (e) => progress.update({ name: e.target.value.trim() });

$("start-camera").onclick = async () => {
  $("start-camera").disabled = true;
  $("start-camera").textContent = "Starting camera…";
  $("camera-error").hidden = true;
  $("hand-check").hidden = false;
  show("title"); // moves the camera view into the hand-check spot
  try {
    await startCamera($("camera-video"), $("camera-canvas"));
    $("start-camera").hidden = true;
  } catch (err) {
    $("hand-check").hidden = true;
    $("start-camera").disabled = false;
    $("start-camera").textContent = "📷 Try again";
    $("camera-error").hidden = false;
    $("camera-error").textContent =
      err?.name === "NotAllowedError"
        ? "The camera is blocked. Click the camera icon in the address bar and allow it."
        : "The camera didn't start. Is another app using it?";
    $("keyboard-play").hidden = !DEV;
  }
};

onHand((hand) => {
  if (!hand || handSeen) return;
  handSeen = true;
  $("hand-status").textContent = "I see your hand! ✅";
  $("hand-status").className = "status good";
  $("title-continue").disabled = false;
  $("title-continue").focus();
  // Suggest teaching the camera if it hasn't learned most letters yet.
  const counts = countsByLetter();
  $("title-calibrate").hidden = Object.values(counts).filter((n) => n >= ENOUGH).length >= 20;
});

// Off to the map. The first time, the story's intro plays over it.
function startAdventure() {
  if (!progress.get().name) progress.update({ name: "Hero" });
  show("map");
  playScene("intro");
}

$("title-continue").onclick = startAdventure;
$("title-calibrate").onclick = () => openCalibration(() => show("title"));
$("open-calibrate").onclick = () => openCalibration(() => show("settings"));

// With ?dev, holding a letter key always counts as signing it.
$("keyboard-play").onclick = startAdventure;

// Builders can skip the camera entirely with ?dev.
$("keyboard-play").hidden = !DEV;
// ?record opens the data recorder straight away, for collecting training data.
show(RECORD ? "record" : "title");
