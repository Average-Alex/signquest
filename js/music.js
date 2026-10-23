// Music: chiptune songs, like an old handheld RPG, made live with Web Audio
// (no music files). Each screen has its own: the title, the world map, every
// zone, battles (with harder boss and final-boss themes), the shop, learning
// new signs, evolutions, and short victory and defeat jingles.
//
// A song is a key (`root`, the MIDI note of its "1"), a scale, a tempo, a
// chord for each bar, and a melody. Melodies are written as scale degrees,
// one token per 16th note: "1".."9" (and up: "10" is the octave above "3"),
// "-" holds the note, "." is a rest, and "v" / "^" move a note down / up an
// octave ("7v"). Bass, arpeggio, and drum parts follow named patterns built
// from the chords, so one melody works in any scale.
//
// Four instruments, like the old sound chips: a pulse-wave lead, a thin pulse
// arpeggio, a triangle bass, and noise drums.

import * as progress from "./progress.js";

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

// ---------- Songs ----------

const BATTLE = {
  bpm: 150, root: 69, scale: "minor", bass: "drive", arp: "up16", drums: "battle", lead: 0.5,
  chords: [1, 6, 7, 1, 1, 6, 4, 5],
  melody: [
    "5 - - - 5 . 6 . 7 - 5 - 3 - - -",
    "3 - - - 4 . 3 . 2 - 1 - 2 - - -",
    "7v - - - 2 . 4 . 7 - 6 - 5 - 4 -",
    "5 - - - - - - - 1 . 3 . 5 . 8 .",
    "8 - - - 7 . 6 . 5 - 6 - 7 - 8 -",
    "6 - - - 5 . 3 . 1 - 3 - 6 - - -",
    "4 - - - 6 . 8 . 6 - 4 - 6 - 5 -",
    "5 - - - 7v - - - 2 - 4 - 5 - 7 -",
  ],
};

const BOSS = {
  bpm: 168, root: 64, scale: "harmonic", bass: "drive16", arp: "up16", drums: "boss", lead: 0.5,
  chords: [1, 6, 4, 5, 1, 6, 2, 5],
  melody: [
    "8 - 7 - 8 - 5 - - - 3 - 5 - 8 -",
    "6 - 5 - 6 - 3 - - - 1 - 3 - 6 -",
    "4 - 3 - 4 - 6 - - - 8 - 6 - 4 -",
    "5 - - - 7v - - - 2 - - - 5 - 7 -",
    "8 - - - 9 - 8 - 7 - 8 - 5 - - -",
    "6 - - - 8 - 6 - 3 - 6 - 8 - - -",
    "9 - 8 - 7 - 6 - 4 - 6 - 9 - 8 -",
    "7 - - - - - - - 7 . 7 . 7 . 7 .",
  ],
};

const FINAL = {
  bpm: 132, root: 62, scale: "phrygian", bass: "pump", arp: "updown8", drums: "final", lead: 0.5, echo: true,
  chords: [1, 2, 1, 7, 1, 2, 6, 5],
  melody: [
    "1 - - - - - 2 - 1 - - - 7v - - -",
    "2 - - - - - 3 - 2 - - - 1 - - -",
    "1 - - - 5 - - - 4 - 3 - 2 - 1 -",
    "7v - - - - - - - 1 - 2 - 3 - 4 -",
    "5 - - - - - 6 - 5 - - - 4 - - -",
    "6 - - - - - 7 - 6 - 5 - 4 - 2 -",
    "3 - - - 4 - 3 - 2 - 1 - 2 - 3 -",
    "1 - - - - - - - . . . . . . . .",
  ],
};

const MAP = {
  bpm: 116, root: 67, scale: "major", bass: "pump", arp: "updown8", drums: "march", lead: 0.5,
  chords: [1, 5, 6, 4, 1, 5, 4, 5],
  melody: [
    "1 - 3 - 5 - - - 8 - 7 - 5 - - -",
    "5 - 4 - 2 - - - 7v - 2 - 5 - - -",
    "6 - 5 - 3 - - - 1 - 3 - 6 - - -",
    "4 - 5 - 6 - 8 - 6 - 5 - 4 - - -",
    "1 - 3 - 5 - - - 8 - 9 - 10 - - -",
    "9 - 8 - 7 - - - 5 - 7 - 9 - - -",
    "8 - 6 - 4 - - - 6 - 8 - 6 - 4 -",
    "5 - - - - - - - 5 . 6 . 7 . . .",
  ],
};

const TITLE = {
  bpm: 88, root: 65, scale: "major", bass: "long", arp: "updown8", drums: "none", lead: 0.5, echo: true,
  chords: [1, 6, 4, 5],
  melody: [
    "5 - - - 3 - - - 1 - - - 3 - 5 -",
    "6 - - - 5 - - - 3 - - - - - - -",
    "4 - - - 6 - - - 8 - - - 7 - 6 -",
    "5 - - - - - - - - - - - . . . .",
  ],
};

const SHOP = {
  bpm: 126, root: 72, scale: "major", bass: "walk", arp: "none", drums: "soft", lead: 0.25,
  chords: [1, 6, 2, 5],
  melody: [
    "1 . 3 . 5 . 3 . 6 . 5 . 3 . 1 .",
    "6v . 1 . 3 . 1 . 5 . 3 . 1 . . .",
    "2 . 4 . 6 . 4 . 7 . 6 . 4 . 2 .",
    "5 . 7 . 9 . 7 . 5 - - - . . . .",
  ],
};

const LEARN = {
  bpm: 80, root: 72, scale: "major", bass: "long", arp: "slow", drums: "none", lead: 0.25, echo: true,
  chords: [1, 4, 6, 5],
  melody: [
    "5 - - - - - - - 3 - - - - - - -",
    "4 - - - - - - - 6 - - - - - - -",
    "3 - - - - - - - 1 - - - - - - -",
    "2 - - - - - - - 5v - - - - - - -",
  ],
};

const EVOLVE = {
  bpm: 132, root: 67, scale: "lydian", bass: "long", arp: "up16", drums: "none", lead: 0.25, echo: true,
  chords: [1, 2, 1, 2],
  melody: [
    "1 . 3 . 5 . 8 . 5 . 3 . 5 . 8 .",
    "2 . 4 . 6 . 9 . 6 . 4 . 6 . 9 .",
    "1 . 3 . 5 . 8 . 10 . 8 . 10 . 12 .",
    "9 - - - - - - - 8 - - - - - - -",
  ],
};

const VICTORY = {
  bpm: 140, root: 72, scale: "major", bass: "long", arp: "up16", drums: "none", lead: 0.5, once: true,
  chords: [1, 1, 4, 1],
  melody: [
    "5 . 5 . 5 . 5 - - - 3 - - - 4 -",
    "5 - 4 - 5 - - - - - - - . . . .",
    "6 . 6 . 6 . 6 - - - 8 - - - 6 -",
    "8 - - - - - - - - - - - . . . .",
  ],
};

const DEFEAT = {
  bpm: 76, root: 64, scale: "minor", bass: "long", arp: "none", drums: "none", lead: 0.5, once: true,
  chords: [4, 1],
  melody: [
    "5 - - - 4 - - - 3 - - - 2 - - -",
    "1 - - - - - - - - - - - . . . .",
  ],
};

// Exploring: one melody, played in a different key, scale, and tempo for each
// zone, so the Meadow sounds sunny and the Cosmic Rift sounds eerie.
const EXPLORE_MELODY = [
  "3 - - - 2 - 1 - 2 - - - 3 - 5 -",
  "4 - - - 6 - - - 5 - - - - - - -",
  "3 - - - 2 - 1 - 2 - 3 - 1 - - -",
  "7v - - - 2 - - - 5 - - - - - - -",
  "6 - - - 5 - 6 - 8 - - - 6 - 5 -",
  "4 - - - 3 - 4 - 6 - - - 5 - 4 -",
  "3 - - - 2 - 3 - 4 - - - 2 - - -",
  "5 - - - - - - - 7v - - - - - - -",
];
const explore = (bpm, root, scale, extra = {}) => ({
  bpm, root, scale, bass: "pump", arp: "updown8", drums: "soft", lead: 0.5,
  chords: [1, 4, 1, 5, 6, 4, 2, 5], melody: EXPLORE_MELODY, ...extra,
});

const SONGS = {
  title: TITLE, map: MAP, battle: BATTLE, boss: BOSS, final: FINAL, shop: SHOP, learn: LEARN,
  evolve: EVOLVE, victory: VICTORY, defeat: DEFEAT,
  "explore-meadow": explore(108, 72, "major"),
  "explore-forest": explore(92, 62, "dorian", { arp: "up16" }),
  "explore-caves": explore(76, 69, "minor", { drums: "none", arp: "slow", echo: true }),
  "explore-river": explore(104, 67, "major", { arp: "up16", bass: "walk" }),
  "explore-castle": explore(112, 64, "minor", { drums: "march" }),
  "explore-keep": explore(100, 65, "major", { drums: "march", bass: "walk" }),
  "explore-spires": explore(84, 71, "lydian", { arp: "up16", drums: "none", echo: true }),
  "explore-clouds": explore(90, 65, "lydian", { echo: true }),
  "explore-void": explore(70, 61, "phrygian", { drums: "none", arp: "slow", echo: true }),
};

// Parse melodies once, and check every bar is 16 steps.
for (const [name, song] of Object.entries(SONGS)) {
  song.bars = song.melody.map((bar) => bar.trim().split(/\s+/));
  song.bars.forEach((bar, i) => bar.length !== 16 && console.warn(`music: ${name} bar ${i + 1} has ${bar.length} steps`));
}

// ---------- Patterns built from the chord ----------

// Chord tones for a bar, as scale degrees: root, third, fifth, octave.
const tones = (chord) => [chord, chord + 2, chord + 4, chord + 7];

const BASS = {
  drive: (s, c) => (s % 2 ? null : { deg: s % 8 === 6 ? c + 7 : c, len: 2 }),
  drive16: (s, c) => ({ deg: s % 4 === 2 ? c + 7 : c, len: 1 }),
  pump: (s, c) => (s % 4 === 0 ? { deg: c, len: 3 } : s % 4 === 2 ? { deg: c + 4, len: 2 } : null),
  walk: (s, c) => (s % 4 === 0 ? { deg: tones(c)[[0, 1, 2, 1][s / 4]], len: 4 } : null),
  long: (s, c) => (s === 0 ? { deg: c, len: 16 } : null),
};
const ARP = {
  up16: (s, c) => ({ deg: tones(c)[s % 4], len: 1 }),
  updown8: (s, c) => (s % 2 ? null : { deg: tones(c)[[0, 1, 2, 3, 2, 1, 0, 1][s / 2]], len: 2 }),
  slow: (s, c) => (s % 4 === 0 ? { deg: tones(c)[[0, 1, 2, 1][s / 4]], len: 4 } : null),
  none: () => null,
};
// k = kick, s = snare, h = hi-hat.
const DRUMS = {
  battle: (s) => [s === 0 || s === 8 || s === 10 ? "k" : null, s === 4 || s === 12 ? "s" : null, s % 2 === 0 ? "h" : null],
  boss: (s) => [s % 4 === 0 || s === 6 || s === 14 ? "k" : null, s === 4 || s === 12 ? "s" : null, "h"],
  final: (s) => [s === 0 || s === 3 || s === 8 || s === 11 ? "k" : null, s === 12 ? "s" : null, s % 2 === 0 ? "h" : null],
  march: (s) => [s === 0 || s === 8 ? "k" : null, s === 4 || s === 12 || s === 14 ? "s" : null, s % 4 === 2 ? "h" : null],
  soft: (s) => [s === 0 ? "k" : null, null, s % 4 === 2 ? "h" : null],
  none: () => [],
};

// ---------- Sound ----------

let ctx = null;
let master = null;
let noise = null;
const waves = {};
let song = null; // { name, def, step, next, bus, echo }
let timer = null;
let paused = false;
let wanted = null; // the song for the current screen (kept even while music is off)

const VOLUME = 0.32;
const enabled = () => progress.get().settings.music !== false;

function audio() {
  if (ctx) return ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  ctx = new Ctx();
  master = ctx.createGain();
  master.gain.value = VOLUME;
  master.connect(ctx.destination);
  // Pulse waves of different widths: the classic handheld sound.
  for (const duty of [0.5, 0.25, 0.125]) {
    const n = 32;
    const real = new Float32Array(n), imag = new Float32Array(n);
    for (let i = 1; i < n; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
    waves[duty] = ctx.createPeriodicWave(real, imag);
  }
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

// Browsers only allow sound after a click: start then.
for (const ev of ["pointerdown", "keydown"]) {
  addEventListener(ev, () => {
    if (!ctx) {
      if (wanted) startSong(wanted);
    } else if (ctx.state === "suspended") ctx.resume();
  });
}

const midiOf = (def, token, base) => {
  const m = /^(\d+)([v^]*)$/.exec(token);
  if (!m) return null;
  const idx = Number(m[1]) - 1;
  const scale = SCALES[def.scale];
  let semis = scale[((idx % 7) + 7) % 7] + 12 * Math.floor(idx / 7);
  for (const ch of m[2]) semis += ch === "v" ? -12 : 12;
  return base + semis;
};
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function tone(dest, wave, midi, t, dur, volume, { vibrato = false, type } = {}) {
  const o = ctx.createOscillator();
  if (type) o.type = type;
  else o.setPeriodicWave(waves[wave]);
  o.frequency.value = hz(midi);
  if (vibrato && dur > 0.35) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(hz(midi) * 0.012, t + 0.3);
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(volume, t + 0.008);
  g.gain.setValueAtTime(volume * 0.8, t + Math.max(0.01, dur - 0.04));
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function drum(dest, kind, t) {
  if (kind === "k") {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.18);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  const snare = kind === "s";
  filter.type = snare ? "bandpass" : "highpass";
  filter.frequency.value = snare ? 1800 : 7000;
  const len = snare ? 0.13 : 0.035;
  g.gain.setValueAtTime(snare ? 0.3 : 0.07, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  src.connect(filter).connect(g).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + len + 0.01);
}

function scheduleStep(s, t) {
  const def = song.def;
  const stepDur = 60 / def.bpm / 4;
  const barIndex = Math.floor(s / 16) % def.bars.length;
  const i = s % 16;
  const bar = def.bars[barIndex];
  const chord = def.chords[barIndex % def.chords.length];
  const leadOut = song.echo || song.bus;

  // Melody: a note, held through the "-" after it.
  const token = bar[i];
  const midi = token && midiOf(def, token, def.root);
  if (midi !== null && midi !== undefined) {
    let len = 1;
    while (i + len < 16 && bar[i + len] === "-") len++;
    tone(leadOut, def.lead, midi, t, len * stepDur * 0.95, 0.13, { vibrato: true });
  }
  const b = BASS[def.bass](i, chord);
  if (b) tone(song.bus, null, midiOf(def, String(b.deg), def.root - 24), t, b.len * stepDur * 0.9, 0.32, { type: "triangle" });
  const a = ARP[def.arp](i, chord);
  if (a) tone(leadOut, 0.125, midiOf(def, String(a.deg), def.root - 12), t, a.len * stepDur * 0.8, 0.045);
  for (const d of DRUMS[def.drums](i)) if (d) drum(song.bus, d, t);
}

function tick() {
  if (!song || paused) return;
  const def = song.def;
  const stepDur = 60 / def.bpm / 4;
  const total = def.bars.length * 16;
  while (song.next < ctx.currentTime + 0.15) {
    if (def.once && song.step >= total) {
      if (!song.ending) {
        song.ending = true;
        const finished = song;
        setTimeout(() => song === finished && stopSong(), 1500);
      }
      return;
    }
    scheduleStep(song.step, song.next);
    song.step++;
    song.next += stepDur;
  }
}

function startSong(name) {
  if (!audio()) return;
  if (ctx.state === "suspended") ctx.resume();
  fadeOut();
  const def = SONGS[name];
  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(master);
  let echo = null;
  if (def.echo) {
    // A soft echo for dreamy and spooky places.
    echo = ctx.createGain();
    const delay = ctx.createDelay();
    const feedback = ctx.createGain();
    delay.delayTime.value = (60 / def.bpm) * 0.75;
    feedback.gain.value = 0.32;
    echo.connect(bus);
    echo.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(bus);
  }
  song = { name, def, step: 0, next: ctx.currentTime + 0.08, bus, echo };
  clearInterval(timer);
  timer = setInterval(tick, 25);
  tick();
}

function fadeOut() {
  if (!song) return;
  const { bus } = song;
  bus.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  setTimeout(() => bus.disconnect(), 1200);
  song = null;
}

function stopSong() {
  fadeOut();
  clearInterval(timer);
  timer = null;
}

// ---------- What the rest of the game calls ----------

// Plays song `name` (keeps it going if it's already playing).
export function playMusic(name) {
  if (!SONGS[name]) return;
  wanted = name;
  if (!enabled() || paused) return;
  if (song?.name === name) return;
  if (!ctx && !navigator.userActivation?.hasBeenActive) return; // starts on the first click
  startSong(name);
}

// Cinematics have their own sound: pause the music, then carry on.
export function pauseMusic() {
  paused = true;
  stopSong();
}
export function resumeMusic() {
  paused = false;
  if (wanted && enabled() && !SONGS[wanted].once) startSong(wanted);
}

// Settings: music on or off.
export function musicSettingChanged() {
  if (enabled() && wanted && !SONGS[wanted].once) startSong(wanted);
  else if (!enabled()) stopSong();
}

// The "battle!" sting as a battle starts (with the screen flash): a quick
// rising run on the pulse lead over a whoosh of noise. Deeper for bosses.
export function playBattleSting(boss = false) {
  if (!enabled() || !audio()) return;
  if (ctx.state === "suspended") ctx.resume();
  const t = ctx.currentTime + 0.01;
  const base = boss ? 45 : 57; // MIDI note of the first one
  [0, 4, 7, 12, 16, 19, 24].forEach((step, i) => {
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(waves[0.25]);
    osc.frequency.value = 440 * 2 ** ((base + step - 69) / 12);
    const gain = ctx.createGain();
    const at = t + i * 0.045;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.45, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.01, at + 0.09);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + 0.1);
  });
  const whoosh = ctx.createBufferSource();
  whoosh.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(400, t);
  band.frequency.exponentialRampToValueAtTime(4000, t + 0.35);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.55, t + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  whoosh.connect(band).connect(gain).connect(master);
  whoosh.start(t);
  whoosh.stop(t + 0.6);
}

// Which song goes with which screen (battles, zones, and results pick their own).
const SCREEN_SONGS = { title: "title", map: "map", shop: "shop", hero: "shop", learn: "learn", calibrate: "learn", arena: "shop", pvp: "battle" };
export function musicForScreen(screen) {
  if (SCREEN_SONGS[screen]) playMusic(SCREEN_SONGS[screen]);
}

export const songNames = () => Object.keys(SONGS);
