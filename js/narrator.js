// The narrator for cinematics: a warm storyteller's voice with a little room
// echo, a low drone underneath, and a rumble when something big happens.
//
// The voice lines are recorded ahead of time (tools/make_narration.py, with a
// Microsoft neural voice) and saved in assets/narration/, so it sounds the
// same in every browser and nothing is sent anywhere while playing. A line
// only plays if its recording still matches the caption; otherwise that shot
// is silent. The echo, drone, and rumbles are made with Web Audio. Captions
// always stay on screen: the voice is extra, and Settings can turn it off.

import * as progress from "./progress.js";

const DIR = "assets/narration";
const VOICE_VOLUME = 1;
const ECHO = 0.1; // a little room echo (more sounds less human)

let manifest = null; // key -> the caption that file says
const loadManifest = () =>
  (manifest ||= fetch(`${DIR}/narration.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({})));
loadManifest();

let muted = false;
export const narrationOn = () => progress.get().settings.narration !== false && !muted;
export const isMuted = () => muted;
export function setMuted(on) {
  muted = on;
  if (on) {
    stopSpeaking();
    stopDrone();
  }
}

let current = null; // the voice line playing: { source, done }
const buffers = new Map(); // key -> decoded audio, so replays start instantly

// Plays the recorded line `key` (if it still says `text`), then calls onEnd.
// Calls onEnd straight away when there's no recording or the voice is off.
export async function speak(key, text, onEnd) {
  stopSpeaking();
  if (!narrationOn()) return onEnd();
  const a = context();
  const lines = await loadManifest();
  if (!a || lines[key] !== text) return onEnd();
  let finished = false;
  const line = {
    done() {
      if (finished) return;
      finished = true;
      onEnd();
    },
  };
  current = line;
  try {
    if (!buffers.has(key)) {
      const data = await fetch(`${DIR}/${encodeURIComponent(key)}.mp3`).then((r) => r.arrayBuffer());
      buffers.set(key, await a.ctx.decodeAudioData(data));
    }
  } catch {
    return line.done();
  }
  if (current !== line) return; // skipped while loading
  // Browsers block sound until the page has been clicked: then just carry on.
  if (a.ctx.state !== "running") return line.done();
  const source = a.ctx.createBufferSource();
  source.buffer = buffers.get(key);
  source.connect(a.voice);
  source.onended = () => line.done();
  line.source = source;
  source.start();
  // And never wait much longer than the line itself.
  setTimeout(() => line.done(), (source.buffer.duration + 1.5) * 1000);
}

export function stopSpeaking() {
  const line = current;
  current = null;
  if (line?.source) {
    line.source.onended = null;
    try {
      line.source.stop();
    } catch {
      // already stopped
    }
  }
}

// ---------- The ominous drone, and rumbles ----------

let audio = null; // { ctx, master, nodes }

function context() {
  if (!audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const master = ctx.createGain(); // the drone
    master.gain.value = 0;
    master.connect(ctx.destination);
    // The voice: straight through, plus a little room echo (a reverb made from
    // fading noise), so it sounds like it was recorded in a room.
    const voice = ctx.createGain();
    voice.gain.value = VOICE_VOLUME;
    voice.connect(ctx.destination);
    const reverb = ctx.createConvolver();
    reverb.buffer = hallEcho(ctx, 1.6);
    const wet = ctx.createGain();
    wet.gain.value = ECHO;
    voice.connect(reverb).connect(wet).connect(ctx.destination);
    audio = { ctx, master, voice, nodes: [] };
  }
  if (audio.ctx.state === "suspended") audio.ctx.resume();
  return audio;
}

// Fading stereo noise: what a big stone hall does to a voice.
function hallEcho(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return buffer;
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
