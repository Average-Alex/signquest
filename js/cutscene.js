// Cinematics: short animated scenes, like the opening of a movie.
//
// The opening plays the first time someone starts the game: the Great
// Beacon, Queen Amara discovering Signlight, Malgrath shattering the Beacon,
// and you escaping. Each zone has its own, the first time you walk in: the
// landmark rises into view, the hexed boss looms with its shard, and you
// arrive. Each scene is a few "shots": a background, some sprites that
// animate in, effects (stars, fog, a light beam, flying shards...), and a
// caption that types itself out. Skip ends it; click or Next moves on.
//
// Everything is drawn from the game's own sprites, so a cinematic always
// matches what you see in play (including your hero's look). A deep narrator
// reads each caption (recorded lines, see narrator.js) over an ominous drone;
// a shot waits for the voice to finish before moving on.

import { battleBackdropSrc } from "./biome.js";
import { CREATURES, ZONES } from "./config.js";
import * as progress from "./progress.js";
import { pauseMusic, resumeMusic } from "./music.js";
import { isMuted, narrationOn, rumble, setMuted, speak, startDrone, stopDrone, stopSpeaking } from "./narrator.js";
import { QUEEN } from "./quests.js";
import { creatureImg, heroImg, landmarkSrc, randomLook } from "./sprites.js";
import { worldMapSrc } from "./worldmap.js";

const $ = (id) => document.getElementById(id);
const TYPE_MS = 28; // per letter of a caption
const HOLD_MS = 2600; // after a caption finishes, before moving on by itself (no voice)
const AFTER_VOICE_MS = 900; // after the narrator finishes

// ---------- Building blocks for shots ----------

const you = () => heroImg(progress.get().look, progress.get().equipped.hat);
const buddy = () => creatureImg(progress.team()[0]?.id || "pip");
const bossOf = (zoneId) => CREATURES.find((c) => c.zone === zoneId && c.kind === "boss" && c.catchable !== false)?.id || "malgrath";
const landmark = (zoneId) => `<img class="sprite" src="${landmarkSrc(zoneId)}" alt="">`;
// A few seeded Signkeepers, so they look the same every time.
const keeper = (seed) => {
  let n = seed;
  return heroImg(randomLook(() => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648)));
};

// actor(art, x, y, width, anim, delay): x is the middle, y the feet, both in
// percent of the stage; width in percent of the stage's width.
const actor = (art, x, y, w, anim = "fade", delay = 0, extra = "") => ({ art, x, y, w, anim, delay, extra });

// ---------- The opening ----------

const OPENING = [
  {
    bg: () => worldMapSrc(0), dim: 0.55, sky: "night", zoom: "in",
    fx: ["stars", "beam"],
    actors: [actor(() => landmark("keep"), 50, 62, 22, "rise")],
    text: "Long ago, a great light shone from the tallest tower on the island: the Great Beacon.",
  },
  {
    bg: () => worldMapSrc(0), dim: 0.7, sky: "dusk",
    fx: ["sparkles"],
    actors: [actor(() => heroImg(QUEEN.look, QUEEN.hat, "", false), 50, 86, 16, "rise", 0, "glow")],
    text: "Queen Amara was Deaf. When she signed, her hands began to glow. She called the light Signlight.",
  },
  {
    bg: () => worldMapSrc(0), dim: 0.6, sky: "dusk",
    fx: ["sparkles"],
    actors: [
      actor(() => keeper(11), 25, 86, 12, "rise", 0, "glow"),
      actor(() => heroImg(QUEEN.look, QUEEN.hat, "", false), 50, 84, 14, "fade", 200, "glow"),
      actor(() => keeper(29), 75, 86, 12, "rise", 400, "glow"),
    ],
    text: "She taught everyone who wanted to learn. They became the Signkeepers, and Signlight flowed through every signing hand.",
  },
  {
    bg: () => worldMapSrc(0), dim: 0.85, sky: "night",
    fx: ["fog", "shake"],
    actors: [actor(() => creatureImg("malgrath"), 50, 88, 30, "loom", 0, "hex")],
    text: "But one Signkeeper wanted ALL the light for himself. His name was Malgrath.",
  },
  {
    bg: () => worldMapSrc(0), dim: 0.6, sky: "night",
    fx: ["stars", "beam-break", "flash", "shards", "shake"],
    actors: [actor(() => landmark("keep"), 50, 62, 22, "fade")],
    text: "One night, he shattered the Beacon. Eight Beacon Shards flew across the land.",
  },
  {
    bg: () => battleBackdropSrc("meadow"), dim: 0.25, sky: "dusk",
    fx: ["fog"],
    actors: [
      actor(() => creatureImg("puddlepup"), 35, 82, 16, "turn-hexed"),
      actor(() => creatureImg("puddlepup", "", true), 35, 82, 16, "become-hexed"),
      actor(() => creatureImg("thistlefox"), 68, 82, 16, "turn-hexed", 300),
      actor(() => creatureImg("thistlefox", "", true), 68, 82, 16, "become-hexed", 300),
    ],
    text: "Wherever a shard fell, the creatures turned wild and grumpy. They became Hexbound.",
  },
  {
    bg: () => battleBackdropSrc("castle"), dim: 0.35, sky: "dawn",
    fx: ["sparkles"],
    actors: [
      actor(() => landmark("castle"), 50, 52, 26, "fade"),
      actor(you, 42, 90, 13, "rise", 300),
      actor(() => creatureImg("pip"), 62, 80, 10, "fly-in", 1000),
    ],
    text: "Only one young apprentice escaped the Signkeeper Academy that night... You.",
  },
];

// ---------- Each zone ----------

// [establishing shot, the boss and its shard, you arriving]
const ZONE_TEXT = {
  meadow: [
    "The Meadow. Farmers grew sunflowers here, and kids flew kites over Sprout Pond.",
    "Then a Beacon Shard splashed into the pond. The Croak King swallowed its light, and his croak turned every critter purple.",
    "The first shard is waiting somewhere in this meadow.",
  ],
  forest: [
    "The Forest, where Professor Hoot taught young Signkeepers under the tallest pines.",
    "A shard crashed through the branches. Now Professor Hoot is Hexbound, and the woods have gone dark and quiet.",
    "His old lessons are still hidden in these trees.",
  ],
  caves: [
    "The Caves. Every sound echoes, and crystals glow in the dark.",
    "Count Flap carried a shard deep underground. Its light keeps him awake, grumpy, and hexed.",
    "Stay close to your buddies. It's dark down here.",
  ],
  river: [
    "The River once sparkled with Signlight, all the way from the great waterfall to the sea.",
    "Inkzilla dragged a shard under the falls and turned the whole river gray with hexed ink.",
    "Fishers, sailors, and a bridgekeeper with riddles all need a Signkeeper's help.",
  ],
  castle: [
    "The Signkeeper Academy. Your old school, in ruins.",
    "Blaze, the Academy's gentle dragon, now guards a shard for Malgrath. The school is his fortress.",
    "Somewhere in the ruins, your old classmates are hiding.",
  ],
  keep: [
    "Crown Keep, Queen Amara's castle, in the very heart of the island.",
    "Malgrath sealed the Queen behind hexed glass, and turned her loyal gryphon Aurelion into his guard.",
    "The Queen is still inside, waiting to be set free.",
  ],
  spires: [
    "The Crystal Spires. Three shards streaked through the portal and froze among the stars.",
    "The Glacier Wyrm curled around one of them. Its icy breath froze the whole realm.",
    "Stay warm, Signkeeper. And keep signing.",
  ],
  clouds: [
    "The Cloud Kingdom, floating above a sea of stars.",
    "The Storm Owl guards a shard inside a thunderstorm that never ends.",
    "Every flash of lightning is Malgrath, watching you.",
  ],
  void: [
    "The Void Rift, where the light ends.",
    "Malgrath waits at the very top with the last shard... and Rook's little sister, Robin.",
    "This is it. Everything you've learned leads here.",
  ],
};

function zoneScene(zone) {
  const [first, second, third] = ZONE_TEXT[zone.id];
  const night = zone.dimension > 0 || zone.id === "caves";
  const bg = () => battleBackdropSrc(zone.id);
  return [
    {
      bg, dim: 0.15, sky: night ? "night" : "day", zoom: "in",
      fx: night ? ["stars"] : ["sparkles"],
      actors: [actor(() => landmark(zone.id), 50, 72, zone.id === "keep" ? 30 : 26, "rise")],
      text: first,
      title: `${zone.icon} ${zone.name}`,
    },
    {
      bg, dim: 0.55, sky: "night",
      fx: ["fog", "shard-glow", "shake"],
      actors: [actor(() => creatureImg(bossOf(zone.id), "", bossOf(zone.id) !== "malgrath"), 50, 90, 32, "loom", 0, "hex")],
      text: second,
    },
    {
      bg, dim: 0.2, sky: night ? "night" : "dawn", zoom: "out",
      fx: night ? ["stars"] : ["sparkles"],
      actors: [
        actor(() => landmark(zone.id), 70, 60, 20, "fade"),
        actor(you, 30, 90, 13, "walk-in", 0),
        actor(buddy, 44, 90, 9, "walk-in", 250),
      ],
      text: third,
    },
  ];
}

const SCENES = { opening: OPENING };
for (const zone of ZONES) if (ZONE_TEXT[zone.id]) SCENES[`zone-${zone.id}`] = zoneScene(zone);

export const cutsceneIds = () => Object.keys(SCENES).map((id) => `cine-${id}`);

// ---------- Playing ----------

let playing = null; // { shots, index, onDone, typing, timer }

// Plays scene `id` once (the first time), then calls onDone.
export function playCutscene(id, onDone = () => {}, { replay = false } = {}) {
  const seenId = `cine-${id}`;
  if (!SCENES[id] || (progress.storySeen(seenId) && !replay)) return onDone();
  progress.markStorySeen(seenId);
  playing = { id, shots: SCENES[id], index: 0, onDone, typing: null, timer: null, typed: false, spoken: false };
  $("cine").hidden = false;
  $("cine-skip").focus();
  renderMute();
  pauseMusic();
  startDrone();
  showShot();
}

export const isCutscenePlaying = () => Boolean(playing);

function showShot() {
  const shot = playing.shots[playing.index];
  clearTimeout(playing.timer);
  clearInterval(playing.typing);
  stopSpeaking();
  playing.typed = false;
  playing.spoken = false;

  // Background: a picture, darkened, with a sky tint and a slow camera move.
  const stage = $("cine-stage");
  stage.className = `cine-stage sky-${shot.sky || "day"}${(shot.fx || []).includes("shake") ? " shake" : ""}`;
  $("cine-bg").src = shot.bg();
  $("cine-bg").className = `sprite cine-bg${shot.zoom ? ` zoom-${shot.zoom}` : ""}`;
  $("cine-dim").style.opacity = shot.dim ?? 0.3;

  // Actors.
  $("cine-actors").innerHTML = shot.actors
    .map((a) => `<div class="cine-actor ${a.anim} ${a.extra}" style="left:${a.x}%; top:${a.y}%; width:${a.w}%; animation-delay:${a.delay}ms">${a.art()}</div>`)
    .join("");

  // Effects, with a rumble for the big moments.
  const fx = shot.fx || [];
  $("cine-fx").innerHTML = fx.map(effect).join("");
  if (fx.includes("flash")) rumble(1000);
  else if (fx.includes("shake")) rumble(900);

  // Title card (zones), and the caption typing itself out.
  $("cine-title").hidden = !shot.title;
  $("cine-title").textContent = shot.title || "";
  const text = shot.text.replaceAll("{name}", progress.get().name || "Signkeeper");
  $("cine-live").textContent = text; // screen readers get the whole line at once
  const caption = $("cine-text");
  caption.textContent = "";
  let n = 0;
  playing.typing = setInterval(() => {
    n++;
    caption.textContent = text.slice(0, n);
    if (n >= text.length) doneTyping();
  }, TYPE_MS);
  // The narrator reads it (a beat after the picture appears).
  const shotNow = playing;
  const index = playing.index;
  setTimeout(() => {
    if (playing !== shotNow || playing.index !== index) return;
    speak(`${playing.id}-${index}`, text, () => {
      if (playing !== shotNow || playing.index !== index) return;
      playing.spoken = true;
      maybeMoveOn();
    });
  }, 350);
  $("cine-next").textContent = playing.index === playing.shots.length - 1 ? "Let's go! ▶" : "Next ▶";
  // Little dots: which shot this is.
  $("cine-dots").innerHTML = playing.shots.map((_, i) => `<span class="${i === playing.index ? "on" : ""}"></span>`).join("");
}

function doneTyping() {
  clearInterval(playing.typing);
  playing.typing = null;
  $("cine-text").textContent = $("cine-live").textContent;
  playing.typed = true;
  maybeMoveOn();
}

// Moves on by itself once the caption is shown and the narrator is done.
function maybeMoveOn() {
  if (!playing.typed || !playing.spoken) return;
  const shot = playing.shots[playing.index];
  clearTimeout(playing.timer);
  const hold = narrationOn() ? AFTER_VOICE_MS : HOLD_MS + (shot.text.length > 90 ? 1200 : 0);
  playing.timer = setTimeout(next, hold);
}

function next() {
  if (!playing) return;
  // First click finishes the caption; the next one moves on.
  if (playing.typing) return doneTyping();
  playing.index++;
  if (playing.index < playing.shots.length) showShot();
  else end();
}

function end() {
  if (!playing) return;
  clearTimeout(playing.timer);
  clearInterval(playing.typing);
  stopSpeaking();
  stopDrone();
  resumeMusic();
  const { onDone } = playing;
  playing = null;
  $("cine").hidden = true;
  $("cine-actors").innerHTML = "";
  $("cine-fx").innerHTML = "";
  onDone();
}

// Effects are plain HTML pieces animated with CSS (see style.css "Cinematics").
function effect(name) {
  const r = (i, salt) => (Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453) % 1;
  const rand = (i, salt) => Math.abs(r(i, salt));
  switch (name) {
    case "stars":
      return Array.from({ length: 40 }, (_, i) => `<span class="cine-star" style="left:${rand(i, 1) * 100}%; top:${rand(i, 2) * 55}%; animation-delay:${rand(i, 3) * 2}s"></span>`).join("");
    case "sparkles":
      return Array.from({ length: 24 }, (_, i) => `<span class="cine-spark" style="left:${10 + rand(i, 4) * 80}%; top:${40 + rand(i, 5) * 55}%; animation-delay:${rand(i, 6) * 3}s"></span>`).join("");
    case "fog":
      return `<span class="cine-fog a"></span><span class="cine-fog b"></span>`;
    case "beam":
      return `<span class="cine-beam"></span>`;
    case "beam-break":
      return `<span class="cine-beam breaking"></span>`;
    case "flash":
      return `<span class="cine-flash"></span>`;
    case "shards":
      // Eight shards burst from the tower in different directions.
      return Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2 + 0.3;
        return `<span class="cine-shard flying" style="--dx:${Math.cos(angle) * 46}vmin; --dy:${Math.sin(angle) * 30 - 6}vmin; animation-delay:${1.1 + i * 0.06}s"></span>`;
      }).join("");
    case "shard-glow":
      return `<span class="cine-shard glowing"></span>`;
    default:
      return "";
  }
}

$("cine-next").onclick = next;
$("cine-stage").onclick = next;
$("cine-skip").onclick = end;

// 🔊 / 🔇: mute the narrator and music for this and later cinematics.
function renderMute() {
  const off = isMuted() || progress.get().settings.narration === false;
  $("cine-mute").textContent = off ? "🔇" : "🔊";
  $("cine-mute").setAttribute("aria-label", off ? "Turn the narrator on" : "Turn the narrator off");
}
$("cine-mute").onclick = () => {
  const off = isMuted() || progress.get().settings.narration === false;
  if (off) {
    setMuted(false);
    progress.updateSettings({ narration: true });
    startDrone();
  } else setMuted(true);
  renderMute();
};
addEventListener("keydown", (e) => {
  if (!playing) return;
  if (e.key === "Escape") return end();
  if ((e.key === "Enter" || e.key === " ") && e.target !== $("cine-skip") && e.target !== $("cine-next")) {
    e.preventDefault();
    next();
  }
});
