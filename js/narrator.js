// The narrator for cinematics: a deep, slow, ominous voice, with a low drone
// underneath and a rumble when something big happens.
//
// The voice is the browser's own text-to-speech (no recordings). It picks the
// deepest-sounding English voice it can find - Edge's natural "Christopher" /
// "Guy" / "Davis" voices sound best - then slows it down and lowers the pitch.
// Edge's "Online" voices are made on Microsoft's servers, so only the fixed
// story captions are ever spoken: never names, and nothing from the camera. The drone and rumbles are made
// with Web Audio oscillators. Captions always stay on screen: the voice is
// extra, and Settings can turn it off.

import * as progress from "./progress.js";

const synth = window.speechSynthesis || null;
// Best first. Names vary by browser and computer; anything English and male-ish is next.
const PREFERRED = [
  "Microsoft Christopher Online", "Microsoft Guy Online", "Microsoft Davis Online", "Microsoft Andrew Online",
  "Microsoft Eric Online", "Microsoft Roger Online", "Google UK English Male", "Daniel", "Arthur", "Alex", "Fred",
  "Microsoft George", "Microsoft David", "Microsoft Mark",
];
const MALE_HINT = /male|man|guy|david|mark|george|daniel|arthur|fred|alex|christopher|davis|eric|roger|andrew|james|ryan/i;
const PITCH = 0.55; // lower = deeper
const RATE = 0.82; // slower = more dramatic

let voice = null;
function pickVoice() {
  if (!synth) return null;
  const voices = synth.getVoices().filter((v) => /^en/i.test(v.lang));
  for (const name of PREFERRED) {
    const v = voices.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return voices.find((v) => MALE_HINT.test(v.name) && !/female/i.test(v.name)) || voices[0] || null;
}
if (synth) {
  voice = pickVoice();
  synth.addEventListener?.("voiceschanged", () => (voice = pickVoice()));
}

export const narrationOn = () => progress.get().settings.narration !== false && !muted;
let muted = false;
export const isMuted = () => muted;
export function setMuted(on) {
  muted = on;
  if (on) {
    stopSpeaking();
    stopDrone();
  }
}

// Speaks `text`, then calls onEnd (also if speech isn't available, or is off).
export function speak(text, onEnd) {
  if (!synth || !narrationOn()) return onEnd();
  stopSpeaking();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang || "en-US";
  u.pitch = PITCH;
  u.rate = RATE;
  u.volume = 1;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(guard);
    onEnd();
  };
  u.onend = finish;
  u.onerror = finish;
  // Some browsers never fire onend: don't wait forever.
  const guard = setTimeout(finish, 2500 + text.length * 110);
  synth.speak(u);
}

export function stopSpeaking() {
  synth?.cancel();
}

// ---------- The ominous drone, and rumbles ----------

let audio = null; // { ctx, master, nodes }

function context() {
  if (!audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    audio = { ctx, master, nodes: [] };
  }
  if (audio.ctx.state === "suspended") audio.ctx.resume();
  return audio;
}

// Two low, slightly out-of-tune notes through a slowly breathing filter.
export function startDrone() {
  if (!narrationOn()) return;
  const a = context();
  if (!a || a.nodes.length) return;
  const { ctx, master } = a;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 220;
  filter.Q.value = 6;
  filter.connect(master);
  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 0.08;
  lfoDepth.gain.value = 120;
  lfo.connect(lfoDepth).connect(filter.frequency);
  const notes = [[55, "sawtooth"], [55.6, "sawtooth"], [82.4, "sine"], [41.2, "triangle"]].map(([f, type]) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.connect(filter);
    return o;
  });
  [lfo, ...notes].forEach((o) => o.start());
  a.nodes = [lfo, ...notes];
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0.09, ctx.currentTime, 1.2);
}

export function stopDrone() {
  if (!audio || !audio.nodes.length) return;
  const { ctx, master, nodes } = audio;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
  audio.nodes = [];
  setTimeout(() => nodes.forEach((o) => o.stop()), 1500);
}

// A deep boom that falls away: for flashes, shakes, and Malgrath.
export function rumble(delayMs = 0) {
  if (!narrationOn()) return;
  const a = context();
  if (!a) return;
  const { ctx } = a;
  const t = ctx.currentTime + delayMs / 1000;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 1.7);
}
