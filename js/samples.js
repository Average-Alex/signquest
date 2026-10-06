// Recorded sign samples from the Record page: used to train the real model
// (download as CSV) and directly by the kNN recognizer, so the game is
// playable with your own hand before any model is trained.
//
// Each sample keeps the RAW world landmarks, not features, so changing the
// normalization in features.js never forces you to re-record.

const KEY = "signquest.samples";
let samples = load();
const listeners = new Set();

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export const getSamples = () => samples;

export function onSamplesChanged(callback) {
  listeners.add(callback);
}

function changed() {
  for (const callback of listeners) callback(samples);
}

// Returns false if storage is full (localStorage holds roughly 8-10k samples).
export function addSamples(newSamples) {
  const next = samples.concat(newSamples);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  samples = next;
  changed();
  return true;
}

export function clearSamples(letter = null) {
  samples = letter ? samples.filter((s) => s.letter !== letter) : [];
  try {
    localStorage.setItem(KEY, JSON.stringify(samples));
  } catch {
    // ignore
  }
  changed();
}

export function countsByLetter() {
  const counts = {};
  for (const s of samples) counts[s.letter] = (counts[s.letter] || 0) + 1;
  return counts;
}

// Columns: letter, hand, recorder, timestamp, x0, y0, z0, ... x20, y20, z20
export function toCSV() {
  const header = ["letter", "hand", "recorder", "timestamp"];
  for (let i = 0; i < 21; i++) header.push(`x${i}`, `y${i}`, `z${i}`);
  const rows = samples.map((s) => [s.letter, s.hand, csvSafe(s.recorder), s.t, ...s.world].join(","));
  return [header.join(","), ...rows].join("\n") + "\n";
}

const csvSafe = (text) => String(text || "unknown").replace(/[,\n"]/g, " ");
