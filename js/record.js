// Record page: hold a sign, capture landmark samples, download as CSV for
// training. Open it with ?dev in the URL (Settings > Data recorder).

import { getLastHand, getPrediction } from "./classifier.js";
import { LETTERS } from "./config.js";
import { flatten, resolveHand } from "./features.js";
import * as progress from "./progress.js";
import { addSamples, clearSamples, countsByLetter, getSamples, onSamplesChanged, toCSV } from "./samples.js";
import { isShowing } from "./screens.js";

const $ = (id) => document.getElementById(id);
const RECORD_MS = 3000;
const SAMPLE_GAP_MS = 66; // ~15 samples per second
const WHO_KEY = "signquest.recorder";

let selected = "A";
let recording = false;

export function initRecordPage() {
  try {
    $("record-who").value = localStorage.getItem(WHO_KEY) || "";
  } catch {
    // ignore
  }
  $("record-who").oninput = (e) => {
    try {
      localStorage.setItem(WHO_KEY, e.target.value.trim());
    } catch {
      // ignore
    }
  };
  $("record-go").onclick = record;
  $("record-download").onclick = download;
  $("record-clear-letter").onclick = () => clearSamples(selected);
  $("record-clear-all").onclick = () => ($("record-clear-confirm").hidden = false);
  $("record-clear-confirm").onclick = () => {
    clearSamples();
    $("record-clear-confirm").hidden = true;
  };
  onSamplesChanged(renderCounts);
  renderCounts();
  requestAnimationFrame(livePreview);
}

function renderCounts() {
  const counts = countsByLetter();
  const grid = $("record-letters");
  grid.innerHTML = "";
  for (const letter of LETTERS) {
    const button = document.createElement("button");
    const n = counts[letter] || 0;
    button.className = `record-letter${letter === selected ? " selected" : ""}${n >= 200 ? " full" : ""}`;
    button.innerHTML = `${letter}<small>${n}</small>`;
    button.setAttribute("aria-pressed", String(letter === selected));
    button.onclick = () => {
      selected = letter;
      renderCounts();
    };
    grid.appendChild(button);
  }
  $("record-total").textContent = `${getSamples().length} samples saved on this device. Aim for 200+ per letter from several people.`;
}

// Shows what the current recognizer thinks, to check new samples are working.
function livePreview() {
  requestAnimationFrame(livePreview);
  if (!isShowing("record")) return;
  const hand = getLastHand();
  const prediction = getPrediction();
  if (!hand) $("record-live").textContent = "No hand in view";
  else {
    const which = resolveHand(hand.handedness, progress.get().settings.hand);
    $("record-live").textContent =
      `${which === "left" ? "Left" : "Right"} hand` +
      (prediction ? ` · looks like ${prediction.letter} (${Math.round(prediction.confidence * 100)}%)` : "");
  }
}

async function record() {
  if (recording) return;
  const who = $("record-who").value.trim();
  if (!who) {
    $("record-status").textContent = "Type who is signing first.";
    $("record-who").focus();
    return;
  }
  recording = true;
  $("record-go").disabled = true;
  for (const n of [3, 2, 1]) {
    $("record-status").textContent = `Sign ${selected} in ${n}…`;
    await new Promise((r) => setTimeout(r, 700));
  }

  const captured = [];
  const end = performance.now() + RECORD_MS;
  let last = 0;
  let lastHand = null;
  await new Promise((resolve) => {
    const step = (now) => {
      const hand = getLastHand();
      // Only keep new frames with a hand in them, spaced out a little.
      if (hand && hand !== lastHand && now - last >= SAMPLE_GAP_MS) {
        captured.push({
          letter: selected,
          hand: resolveHand(hand.handedness, progress.get().settings.hand),
          recorder: who,
          t: Date.now(),
          world: flatten(hand.world).map((v) => Math.round(v * 1e5) / 1e5),
        });
        last = now;
        lastHand = hand;
      }
      $("record-status").textContent = `Recording ${selected}… ${captured.length}`;
      if (now < end) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });

  if (!captured.length) $("record-status").textContent = "No hand seen. Try again with your hand in view.";
  else if (!addSamples(captured)) $("record-status").textContent = "Storage is full. Download the CSV, then clear.";
  else $("record-status").textContent = `Saved ${captured.length} samples of ${selected}.`;
  recording = false;
  $("record-go").disabled = false;
}

function download() {
  const blob = new Blob([toCSV()], { type: "text/csv" });
  const link = document.createElement("a");
  const who = ($("record-who").value.trim() || "samples").replace(/\W+/g, "_");
  link.href = URL.createObjectURL(blob);
  link.download = `signquest_${who}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
