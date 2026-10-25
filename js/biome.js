// Biomes: a walkable pixel-art area for each zone, top-down like an RPG town.
//
// A zone is BIOME_AREAS screens tall and wider than the screen; you explore
// it bottom to top along a snaking path, and the view scrolls with you. A
// locked gate separates each area from the next, and a villager's quest
// opens it (see below). The boss waits by the zone's landmark at
// the very top, and is gone for good once beaten. Monsters get stronger
// (higher level) the further up you go.
//
// Also around each area: 🔐 treasure chests you open by signing a letter,
// 🪧 signposts with ASL facts and tips, and ✨ coins to pick up. Each area
// has its own little scene off the path (a village, a camp, a farm...; see
// SCENES) with something to do there, and a side trail blocked by a 🪨
// boulder - sign to smash it, and there's a big chest at the end.
//
// Walk with the arrow keys / WASD, or tap where to go (the hero finds a way
// around things). Bump into a creature to battle it:
//   ⚔️  practice battle (letters)
//   📜  word battle - shows up once you've won a practice battle here
//   👑  the boss
//
// 🗼 Every zone has a Trial portal by the entrance, to its Trial Tower
// (tower.js): floors of Trial Wardens, with the crystal Trial Guardian on
// every fifth, climbed on your own for 🔷 Crests, which buy armor. ⚔️ And a
// raid creature to fight together with other players (raid.js), and a 🌀
// Moving Signs shrine for moving signs.
//
// 🎯 Each zone also has a mission (missions.js): someone at the entrance
// shows you a problem, and you head down the zone's three branching trails
// (carved below, each to its own clearing) to fix it and come back. A glowing
// trail on the ground, with an arrow, leads to whatever's next.
//
// Each area also has a villager with a quest (quests.js lists the kinds:
// learn a sign, chat, spot the sign, chase, collect sign cards, free, find,
// riddle, deliver, gate guard). A tracker under the map says what to do
// next, and a compass arrow at the edge points the way when it's off screen.
// Townsfolk wander about too, and stop for a chat.
//
// The area is generated from the zone id, so it's the same every visit. The
// ground is painted once onto a canvas; trees, rocks, creatures, and the hero
// are drawn on top every frame, sorted by how far down they stand, so you can
// walk behind things.

import { getPrediction, HoldTimer } from "./classifier.js";
import {
  BIOME_AREAS, BOSS_EXTRA_LEVELS, CHEST_COINS, CHESTS_PER_AREA, COINS_PER_AREA, CONSUMABLES, creatureLevel, CREATURES,
  GUARD_EXTRA_LEVELS, stageOf, QUEST_COINS, RARITIES, rarityOf, SIGNPOST_TEXTS, SIGNPOSTS_PER_AREA, SPARKLE_COINS, STAGES, TIPS, MOTION_TIPS,
  WILD_PER_AREA, ZONES,
} from "./config.js";
import * as progress from "./progress.js";
import { announce, flashCamera, isShowing, openBook, playStage, setGuide, show } from "./screens.js";
import { QUESTS, ROOK } from "./quests.js";
import { openSpotPanel } from "./spot-panel.js";
import { trainersFor } from "./trainers.js";
import { creatureSrc, DECOR, decorSrc, heroImg, heroSrc, landmarkSrc, LANDMARKS, portalSrc, SPRITE_SCALE, spriteCanvas, spriteSize } from "./sprites.js";
import { playCutscene } from "./cutscene.js";
import { playBattleSting, playMusic } from "./music.js";
import { isStoryPlaying, playLines, playScene } from "./story.js";
import { hash, noise } from "./worldmap.js";
import { setHtml } from "./pixel-emoji.js";
import { MISSION_COINS, MISSION_XP, MISSIONS } from "./missions.js";
import { openRaid } from "./raid.js";
import { openTower, TOWER_FLOORS } from "./tower.js";
import { eggStatus, eggTitle, isHatching, maybeHatch } from "./eggs.js";

const $ = (id) => document.getElementById(id);

const T = 8; // tile size in pixels
const TW = 80; // tiles across the whole zone
const SH = 28; // tiles down one area
const TH = SH * BIOME_AREAS; // tiles down the whole zone
const W = TW * T;
const H = TH * T;
// The canvas shows this much at a time: one area tall times the View setting
// (zoom), and as wide as the screen's shape (fitView), so the zone fills the
// whole screen.
let VIEW_W = 48 * T;
let VIEW_H = SH * T;
// The View setting (Settings, or - and + while exploring): how much you see.
export const ZOOMS = [0.75, 1, 1.25, 1.5];
let barRoom = 0; // game pixels the main bar covers at the bottom: the camera can scroll that far past the zone's edge
const ZOOM_NAMES = ["Close up", "Normal", "Far", "Very far"];
// Real canvas pixels per game pixel. 4, so buddies drawn at 3/4 size still
// land on whole pixels (any other size would drop rows and squash faces).
const VIEW_SCALE = 4;
const HERO_SPEED = 64; // pixels per second
const CREATURE_SPEED = 14;
const RUNNER_SPEED = 50; // a runaway critter (chase quests): a bit slower than you
const RUNNER_SCARE = 60; // it runs once you're this close
const FOLK_SPEED = 10; // townsfolk stroll
const FOLK_ROAM = 28; // ...staying this close to home
const TOUCH_DISTANCE = 15; // sideways, feet to feet
const TOUCH_REACH_UP = 22; // the hero is tall, so walking up into a creature from below counts sooner
const SAFE_MS = 2500; // after a battle, creatures can't start another one right away
const RESPAWN_MS = 5000;

// Tile kinds
// SOLID: rock walls, open sky or the void, where there's no ground at all.
// ICE: a frozen lake you can walk across.
const GROUND = 0, PATH = 1, WATER_TILE = 2, BRIDGE_TILE = 3, GATE = 4, SOLID = 5, ICE_TILE = 6;

// Area 0 is the bottom (entrance); the last area is the top (boss).
const areaTop = (a) => (BIOME_AREAS - 1 - a) * SH; // first tile row of an area
const areaOf = (py) => Math.min(BIOME_AREAS - 1, Math.max(0, BIOME_AREAS - 1 - Math.floor(py / (SH * T))));

// ---------- Routes between zones ----------
// The zones are joined into one world you can walk across, like routes
// between towns: each pair below is linked by a path off the side of both
// maps. Zone A's right edge (in area 2) leads to zone B's left edge (in
// area 3), and back. The world map is still there for fast travel.
// [a, b, area on a's side, area on b's side] (areas default to 2 and 3).
// Crown Keep, in the middle, has roads from the Meadow and to the Coral Lagoon.
const ROUTES = [
  ["meadow", "forest"], ["forest", "caves"], ["caves", "river"], ["river", "castle"], ["castle", "meadow"],
  ["meadow", "keep", 4, 1], ["keep", "river", 1, 1],
  ["spires", "clouds"], ["clouds", "void"],
];
const exitRow = (area) => areaTop(area) + 9;

function exitsFor(zoneId) {
  const out = [];
  for (const [a, b, aArea = 2, bArea = 3] of ROUTES) {
    if (a === zoneId) out.push({ side: "right", area: aArea, to: ZONES.findIndex((zn) => zn.id === b) });
    if (b === zoneId) out.push({ side: "left", area: bArea, to: ZONES.findIndex((zn) => zn.id === a) });
  }
  return out.map((e) => ({ ...e, y: exitRow(e.area) * T + T - 1 }));
}

// ⚔️ Raid tiers (raid.js has the HP and coins); you open each by winning the one before.
const RAID_TIERS = ["I", "II", "III"];

// 🌀 Motion Trials: a second shrine, near the entrance of every zone, for
// moving signs (J, Z, HELLO, THANK YOU...): sign `count` of them in a row,
// each within `seconds`. Open from the start, so you practice moving signs early.
const MOTION_TRIALS = [
  { tier: 1, name: "I", count: 3, seconds: 12, coins: 40 },
  { tier: 2, name: "II", count: 4, seconds: 9, coins: 70 },
  { tier: 3, name: "III", count: 5, seconds: 7, coins: 110 },
];
const MOTION_SIGNS = ["J", "Z", "HELLO", "YES", "NO", "THANK YOU", "PLEASE", "SORRY", "BYE"];

// 🎯 Zone missions (missions.js) are off: they all played the same way (something
// scatters down three trails, and you fetch it back). Each zone's villagers
// and its signature quest are what you do there now.
const MISSIONS_ON = false;

// ✨ Secrets: a hidden treasure in each area, out in the wilds away from the
// path. They only show up when you're close, so you have to go looking.
const SECRET_SEE = 44; // pixels
const SECRET_COINS = [20, 45];

// Each zone has its own landscape:
//   shape: how the path runs (PATH_SHAPES).
//   open: "caverns" or "islands" - the map starts as solid rock / sky / void
//     (`solid` colors, with a `cliff` face under the ground's edge), and only
//     the path and the open areas off it are ground.
//   clearings: open glades off the path (the Glowshroom Forest), with nothing growing in them.
//   formal: a straight avenue lined with `lining` (hedges by default). ruins: broken walls along the path (Haunted Hollow).
//   swap: scene pieces this world has its own version of (palms for oaks...).
//   water: "pond", "river" (streams across the map), "fountains" (ponds on
//     both sides of the avenue), "ice" (frozen lakes you can walk on).
//   decals: little things painted on the ground (DECALS), this often per tile.
//   mixes: the trees and rocks in each area, from the entrance up (instead of
//     `obstacles` everywhere). grounds: each area's ground colors (null: `ground`).
const THEMES = {
  meadow: {
    shape: "wind", ground: ["#81ba59", "#74ae4d"], specks: ["#869f5f", "#5f7f45"], speckRate: 0.02,
    path: ["#d2bc83", "#c0a970"], obstacles: ["oak", "oak", "bush", "oakgold"], wall: "bush", density: 0.85, water: "pond",
    decals: ["tuft", "tuft", "flowerPink", "flowerYellow", "flowerWhite"], decalRate: 0.22,
    mixes: [["oak", "bush", "flowerbush"], ["oakgold", "oak", "stump"], ["birch", "bush", "rosebush"], ["cherry", "oak", "flowerbush"], ["oak", "rock", "bush", "stump"], ["birch", "oakgold", "bush"]],
    grounds: [null, ["#9cba5a", "#90ae4e"], null, ["#7cbc60", "#70b054"], null, ["#94b85a", "#88ac4e"]],
  },
  // Glowshroom Forest: giant glowing mushrooms on dark teal moss, glowing spores.
  forest: {
    shape: "zigzag", ground: ["#2f5a5a", "#2a5252"], specks: ["#3fb0d0", "#244848"], speckRate: 0.03,
    path: ["#5a4a7a", "#4e406c"], obstacles: ["glowshroom", "glowshroompink", "darkpine"], wall: "glowshroom", density: 0.79, water: null,
    clearings: true, decals: ["glowdot", "glowdot", "mushroom", "tuft"], decalRate: 0.18,
    swap: { oak: "glowshroompink", pine: "glowshroom", bush: "fern", berrybushpicked: "fern", log: "stump" },
    mixes: [["glowshroom", "glowshroompink", "darkpine", "fern"], ["glowshroom", "glowshroom", "fern", "bigshroom"], ["glowshroompink", "darkpine", "stump"],
      ["glowshroom", "bigshroom", "mossrock", "fern"], ["glowshroompink", "glowshroom", "darkpine"], ["glowshroom", "glowshroompink"]],
    grounds: [null, ["#2a5458", "#264c50"], null, ["#344e62", "#2e4658"], ["#2c5a50", "#28524a"], null],
  },
  // Magma Canyon: black rock paths over a sea of lava, obsidian and lava rocks.
  caves: {
    shape: "wind", open: "caverns", ground: ["#5a3a32", "#4e322c"], specks: ["#7a4a3a", "#3a241e"], speckRate: 0.05,
    path: ["#8a6a5a", "#7a5a4a"], obstacles: ["obsidian", "lavarock", "lavarock"], wall: "lavarock", density: 0.81, water: null,
    solid: ["#e8602a", "#f07a2a"], cliff: ["#3a241e", "#2a1812"], rim: "#1a0e0a", sparkle: "#ffd23f",
    decals: ["lavacrack", "lavacrack", "pebble"], decalRate: 0.14,
    swap: { oak: "obsidian", pine: "lavarock", bush: "lavarock", berrybushpicked: "lavarock", tent: "tent", log: "lavarock" },
    mixes: [["obsidian", "lavarock"], ["lavarock", "obsidian", "deadtree"], ["obsidian", "obsidian", "lavarock"], ["deadtree", "lavarock"], ["obsidian", "lavarock", "ambercrystal"], ["obsidian", "lavarock"]],
    grounds: [null, ["#5e3e36", "#52362e"], ["#4a3430", "#40302a"], ["#62403a", "#563832"], null, null],
  },
  // Coral Lagoon: sandy islands in a turquoise sea, palm trees and coral.
  river: {
    shape: "wind", open: "islands", beach: true, ground: ["#f0dca0", "#e8d090"], specks: ["#f8ecc0", "#d8c080"], speckRate: 0.03,
    path: ["#b08a5a", "#9a7448"], obstacles: ["palm", "palm", "coral", "rock"], wall: "palm", density: 0.83, water: null,
    solid: ["#3aa6d8", "#46b0e0"], cliff: ["#7fd0e8", "#6ac4e0"], rim: "#ffffff", sparkle: "#e8fbff",
    decals: ["shell", "starfish", "ripple", "ripple"], decalRate: 0.12,
    swap: { oak: "palm", pine: "palm", bush: "coral", berrybushpicked: "coralblue", log: "rock" },
    mixes: [["palm", "coral", "rock"], ["palm", "coralblue", "palm"], ["coral", "coralblue", "rock"], ["palm", "palm", "coral"], ["palm", "rock", "coralblue"], ["palm", "coral"]],
  },
  // Haunted Hollow: dark mossy ground, crooked trees, pumpkins and graves.
  castle: {
    shape: "steps", ground: ["#4a4458", "#423c50"], specks: ["#5a5468", "#3a3448"], speckRate: 0.05,
    path: ["#6a5a4a", "#5a4a3a"], obstacles: ["spookytree", "pumpkin", "grave", "jackolantern"], wall: "wall", density: 0.82, water: null,
    ruins: true, decals: ["ghostwisp", "crack", "bone", "crack"], decalRate: 0.14,
    swap: { oak: "spookytree", pine: "spookytree", bush: "pumpkin", berrybushpicked: "jackolantern", log: "grave" },
    mixes: [["spookytree", "pumpkin", "grave"], ["jackolantern", "spookytree", "rock"], ["grave", "grave", "spookytree"], ["pumpkin", "jackolantern", "spookytree"], ["brokenpillar", "spookytree", "grave"], ["spookytree", "jackolantern"]],
    grounds: [null, ["#4e4054", "#463a4c"], null, ["#424a50", "#3c4448"], null, ["#4a3e58", "#423650"]],
  },
  // Crown Keep: royal lawns, a red carpet up a straight avenue lined with
  // hedges, fountains, pillars, and rose bushes.
  keep: {
    shape: "straight", ground: ["#9cc27a", "#92b870"], specks: ["#b4d494"], speckRate: 0.02,
    path: ["#c8414b", "#b3343e"], obstacles: ["oak", "pillar", "bush"], wall: "wall", density: 0.83, water: "fountains",
    formal: true, decals: ["flowerPink", "flowerYellow", "flowerWhite", "tuft"], decalRate: 0.12,
    mixes: [["oak", "pillar", "bush"], ["cherry", "rosebush"], ["oak", "flowerbush", "pillar"], ["birch", "bush", "rosebush"], ["cherry", "pillar", "flowerbush"], ["oak", "rosebush"]],
  },
  // Aurora Glacier: snow, frozen lakes, snowy pines and ice crystals.
  spires: {
    shape: "zigzag", ground: ["#c2d4e2", "#b3c8db"], specks: ["#c6d2dc", "#7fe3a0"], speckRate: 0.025,
    path: ["#9ab8d6", "#88a8c8"], obstacles: ["snowpine", "icecrystal", "snowpine"], wall: "icecrystal", density: 0.83, water: "ice",
    decals: ["snow", "snow", "pebble"], decalRate: 0.12,
    swap: { oak: "snowpine", pine: "snowpine", bush: "snowrock", berrybushpicked: "icecrystal", log: "snowrock" },
    mixes: [["snowpine", "icecrystal"], ["icecrystal", "snowrock"], ["snowpine", "snowrock", "bluecrystal"], ["darkpine", "snowrock"], ["bluecrystal", "icecrystal"], ["snowpine", "icecrystal"]],
    grounds: [null, ["#c8dcec", "#bcd2e4"], null, ["#bccede", "#b0c4d6"], null, null],
  },
  // Thunder Peaks: rocky mountain islands in a stormy sky, lightning crystals.
  clouds: {
    shape: "wind", open: "islands", ground: ["#7a8478", "#707a6e"], specks: ["#8a948a", "#5a6458"], speckRate: 0.04,
    path: ["#a89878", "#988868"], obstacles: ["stormrock", "ambercrystal", "darkpine"], wall: "stormrock", density: 0.83, water: null,
    solid: ["#2e3a56", "#34405e"], cliff: ["#4a5064", "#3a4054"], rim: "#1a2034", sparkle: "#ffe066",
    decals: ["bolt", "pebble", "tuft"], decalRate: 0.1,
    swap: { oak: "darkpine", pine: "darkpine", bush: "stormrock", berrybushpicked: "ambercrystal", log: "stormrock" },
    mixes: [["stormrock", "ambercrystal"], ["darkpine", "stormrock"], ["ambercrystal", "stormrock", "darkpine"], ["stormrock", "stormrock", "ambercrystal"], ["darkpine", "ambercrystal"], ["stormrock"]],
  },
  // Cosmic Rift: purple islands over a starry abyss, planets and star crystals.
  void: {
    shape: "zigzag", open: "islands", ground: ["#3a2a5a", "#32244e"], specks: ["#4e3d74", "#8a6abf"], speckRate: 0.03,
    path: ["#6a4fa0", "#5a4290"], obstacles: ["planet", "crystal", "voidtree"], wall: "voidrock", density: 0.83, water: null,
    solid: ["#0b0814", "#0e0a19"], cliff: ["#3a2c5a", "#2c2046"], rim: "#05030a", sparkle: "#c8b0ff",
    decals: ["star", "star", "crack"], decalRate: 0.12,
    swap: { oak: "voidtree", pine: "voidtree", bush: "voidrock", berrybushpicked: "planetblue", log: "voidrock" },
    mixes: [["planet", "crystal", "voidtree"], ["voidtree", "planetblue"], ["crystal", "ambercrystal", "planet"], ["voidrock", "planetblue", "bluecrystal"], ["voidtree", "crystal"], ["planet", "planetblue"]],
  },
};

// How the path runs from the entrance (bottom) to the boss (top). It's 6
// tiles wide and drifts at most ~2 tiles per row, so it's always easy to walk
// along (steeper bends left gaps too narrow for the hero).
const clampX = (x) => Math.max(6, Math.min(TW - 7, Math.round(x)));
const STEP_ROWS = 14; // "steps": a hall turns every this many rows
const stepX = (seg, seed) => clampX(12 + hash(seg, 1, seed) * (TW - 24));
const PATH_SHAPES = {
  // Snakes gently side to side.
  wind: (seed) => (ty) => clampX(TW / 2 + Math.sin(ty * 0.06 + seed) * 26 + Math.sin(ty * 0.02 + seed * 2) * 6),
  // Straight slopes that switch back, like a trail up a hill.
  zigzag: (seed) => (ty) => {
    const t = ((ty + seed * 7) % 56) / 56;
    return clampX(TW / 2 + (Math.abs(t * 2 - 1) * 2 - 1) * 24);
  },
  // Straight up, with sharp turns (build() carves the halls across).
  steps: (seed) => (ty) => stepX(Math.floor((ty + STEP_ROWS / 2) / STEP_ROWS), seed),
  // One straight avenue up the middle.
  straight: () => () => TW / 2,
};

// ---------- Scenes ----------
// Each area (but the top one) has a little scene beside the path, so every
// stretch of a zone looks different. A scene is SCENE_W x SCENE_H tiles of
// cleared ground with pieces of scenery placed on it ([decor, x, y]: the
// piece's top-left tile; it stands on its bottom two rows), and one thing to
// do (`prop`, at `at`):
//   well: toss in WELL_COST coins and sign a letter for a prize
//   fire: warm up by the campfire, signing two letters, for team XP
//   berries: pick them for a potion
//   stone: sign the word glowing on it for coins and a power-up
const SCENE_W = 22, SCENE_H = 10;
const WELL_COST = 5;
const FIRE_XP = 40;
const STONE_COINS = 30;
const PROPS = {
  well: { decor: "well", icon: "🪙" },
  fire: { decor: "campfire", icon: "🔥" },
  berries: { decor: "berrybush", used: "berrybushpicked", icon: "🫐" },
  stone: { decor: "runestone", icon: "✨" },
  statue: { decor: "statue", icon: "✨" },
};
// Buildings (cabin, cottage, shop, barn, hall, tower) come in each zone's
// own colors (see building() in sprites.js).
const SCENES = {
  village: { pieces: [["cottage", 0, 3], ["cabin", 8, 2], ["shop", 16, 3], ["fence", 1, 8], ["fence", 3, 8], ["bush", 20, 8]], prop: "well", at: [10, 6] },
  hamlet: { pieces: [["cabin", 0, 3], ["cabin", 7, 2], ["cabin", 16, 4], ["log", 13, 8], ["log", 2, 8], ["pine", 13, 1]], prop: "fire", at: [10, 7] },
  farmstead: {
    pieces: [["barn", 0, 4], ["windmill", 16, 4], ["crops", 7, 2], ["crops", 9, 2], ["wheat", 7, 5], ["wheat", 9, 5], ["fence", 7, 8], ["fence", 13, 8]],
    prop: "berries", at: [12, 6],
  },
  market: { pieces: [["shop", 0, 3], ["shop", 6, 3], ["stall", 13, 2], ["stall", 16, 2], ["stall", 19, 2], ["bush", 20, 8]], prop: "well", at: [15, 7] },
  outpost: { pieces: [["tower", 0, 4], ["hall", 5, 4], ["tower", 19, 4], ["rock", 13, 8], ["brokenpillar", 17, 8]], prop: "statue", at: [14, 5] },
  camp: { pieces: [["tent", 1, 1], ["tent", 13, 0], ["log", 5, 6], ["log", 11, 6], ["rock", 16, 6], ["cabin", 17, 4]], prop: "fire", at: [8, 4] },
  garden: { pieces: [["cottage", 15, 3], ["bush", 2, 1], ["bush", 4, 1], ["bush", 11, 1], ["bush", 2, 6], ["bush", 11, 6], ["berrybushpicked", 5, 6]], prop: "statue", at: [7, 3] },
  grove: { pieces: [["berrybushpicked", 2, 1], ["oak", 5, 0], ["berrybushpicked", 13, 2], ["oak", 15, 0], ["bush", 3, 6], ["log", 12, 6], ["cabin", 17, 4]], prop: "berries", at: [8, 4] },
  stones: { pieces: [["standingstone", 4, 0], ["standingstone", 12, 0], ["standingstone", 1, 4], ["standingstone", 15, 4], ["standingstone", 5, 6], ["standingstone", 11, 6]], prop: "stone", at: [8, 3] },
  ruins: { pieces: [["pillar", 1, 0], ["brokenpillar", 4, 1], ["wall", 11, 0], ["brokenpillar", 14, 0], ["pillar", 16, 4], ["rock", 2, 6], ["brokenpillar", 12, 6], ["tower", 19, 4]], prop: "statue", at: [8, 3] },
  graveyard: { pieces: [["hall", 15, 4], ["grave", 1, 0], ["grave", 4, 0], ["grave", 9, 0], ["grave", 1, 5], ["grave", 4, 5], ["grave", 9, 5], ["deadtree", 12, 7]], prop: "stone", at: [6, 2] },
  crystals: { pieces: [["crystal", 2, 1], ["crystal", 5, 0], ["crystal", 11, 0], ["crystal", 14, 1], ["crystal", 3, 6], ["crystal", 13, 6]], prop: "stone", at: [8, 3] },
  mine: { pieces: [["tent", 1, 0], ["cabin", 14, 3], ["rock", 20, 7], ["crystal", 11, 7], ["log", 4, 6], ["stalagmite", 20, 1]], prop: "fire", at: [8, 4] },
};
// The scene in each area of a zone, from the entrance up.
const ZONE_SCENES = {
  meadow: ["village", "farmstead", "hamlet", "garden", "stones"],
  forest: ["hamlet", "camp", "grove", "village", "stones"],
  caves: ["mine", "market", "outpost", "hamlet", "ruins"],
  river: ["village", "market", "camp", "hamlet", "grove"],
  castle: ["graveyard", "village", "ruins", "outpost", "graveyard"],
  keep: ["market", "outpost", "village", "garden", "camp"],
  spires: ["hamlet", "camp", "village", "crystals", "outpost"],
  clouds: ["outpost", "village", "camp", "crystals", "stones"],
  void: ["outpost", "graveyard", "hamlet", "ruins", "crystals"],
};
// The side trail in each area: TRAIL_LEN tiles long, 4 wide, ending in a nook
// fenced in by scenery, with a boulder across the trail.
const TRAIL_LEN = 12;
const NOOK_RX = 4, NOOK_RY = 3;

// Little things painted on the ground. d / l: a bit darker / lighter than the ground.
const DECALS = {
  tuft: { rows: ["d.d", ".d."] },
  flowerPink: { rows: [".p.", "pyp", ".p."], colors: { p: "#f08cb0", y: "#ffe066" } },
  flowerYellow: { rows: [".y.", "yoy", ".y."], colors: { y: "#ffd84a", o: "#e08a2a" } },
  flowerWhite: { rows: [".w.", "wyw", ".w."], colors: { w: "#f6f6f0", y: "#ffd84a" } },
  mushroom: { rows: [".rr.", "rwrr", ".ss."], colors: { r: "#d0503a", w: "#ffffff", s: "#efe0c0" } },
  leaf: { rows: ["oo.", ".oO"], colors: { o: "#c0782e", O: "#e0a040" } },
  pebble: { rows: [".l", "ld", "dd"] },
  crystalbit: { rows: [".w", "cC", "cC"], colors: { c: "#3fa8d0", C: "#7fe3ff", w: "#e8fbff" } },
  bone: { rows: ["w...w", ".www.", "w...w"], colors: { w: "#e8e0d0" } },
  crack: { rows: ["d..", ".d.", ".dd", "...d"] },
  snow: { rows: [".w.", "w.w", ".w."], colors: { w: "#ffffff" } },
  sparkle: { rows: [".y.", "yWy", ".y."], colors: { y: "#ffe9a8", W: "#ffffff" } },
  star: { rows: [".s.", "sSs", ".s."], colors: { s: "#6e52a8", S: "#e0c8ff" } },
  glowdot: { rows: [".c.", "cCc", ".c."], colors: { c: "#3fb0d0", C: "#a8f4ff" } },
  lavacrack: { rows: ["o..", ".oO", "..o"], colors: { o: "#ff6a2a", O: "#ffd23f" } },
  shell: { rows: [".w.", "wpw"], colors: { w: "#fff0f6", p: "#f4a6c8" } },
  starfish: { rows: [".o.", "ooo", "o.o"], colors: { o: "#ff8a5a" } },
  ripple: { rows: ["lll.", ".lll"] },
  bolt: { rows: [".y", "y.", ".y"], colors: { y: "#ffe066" } },
  ghostwisp: { rows: [".g", "gg"], colors: { g: "#c8f0d8" } },
};

const WATER = ["#357eb0", "#448ebc"];
const SHORE = "#ddca92";
const BRIDGE = ["#a8743a", "#8a5a2a"];

// One saved biome per zone, so creatures and your spot stay put while you battle.
const biomes = new Map();

// After "Start over", zones get rebuilt from the fresh progress.
export function resetBiomes() {
  biomes.clear();
  current = null;
}
let current = null; // the biome on screen
// For testing with ?dev: the biome on screen, from the browser console.
if (new URLSearchParams(location.search).has("dev")) (window.signquestDebug ||= {}).biome = () => current;
const keys = new Set();
let pendingToast = null; // shown when you come back from a battle

// ---------- Building a biome ----------

function build(z) {
  const zone = ZONES[z];
  const theme = THEMES[zone.id];
  const seed = z * 17 + 3;
  const trail = progress.trail(z);
  const kind = new Uint8Array(TW * TH);
  const blocked = new Uint8Array(TW * TH);
  const at = (tx, ty) => ty * TW + tx;
  const carve = (rows, cols) => {
    for (let ty = rows[0]; ty <= rows[1]; ty++)
      for (let tx = Math.max(1, cols[0]); tx <= Math.min(TW - 2, cols[1]); tx++) kind[at(tx, ty)] = PATH;
  };

  // Caverns and islands: no ground at all, until it's carved out below.
  if (theme.open) kind.fill(SOLID);
  const open = (tx, ty) => {
    if (tx >= 0 && ty >= 0 && tx < TW && ty < TH && kind[at(tx, ty)] === SOLID) kind[at(tx, ty)] = GROUND;
  };
  // A round patch with a wobbly edge: open ground (caverns, islands), or a
  // glade (`clear`) where nothing grows.
  const clear = new Uint8Array(TW * TH);
  const blob = (cx, cy, rx, ry) => {
    for (let ty = Math.floor(cy - ry - 2); ty <= cy + ry + 2; ty++)
      for (let tx = Math.floor(cx - rx - 2); tx <= cx + rx + 2; tx++) {
        if (tx < 0 || ty < 0 || tx >= TW || ty >= TH) continue;
        if (Math.hypot((tx - cx) / rx, (ty - cy) / ry) > 0.8 + noise(tx, ty, 3, seed + 40) * 0.4) continue;
        open(tx, ty);
        clear[at(tx, ty)] = 1;
      }
  };

  // The path from the entrance (bottom) to the boss (top).
  const pathX = PATH_SHAPES[theme.shape](seed);
  for (let ty = 0; ty < TH; ty++) {
    const cx = pathX(ty);
    carve([ty, ty], [cx - 3, cx + 2]);
    // A strip of ground along the path in caverns (and a beach, where islands
    // have `beach`); otherwise on islands the path is a bridge.
    if (theme.open === "caverns" || theme.beach) for (let tx = cx - 5; tx <= cx + 4; tx++) open(tx, ty);
  }
  // Castle halls: where the path turns, a hall runs across to the next stretch.
  if (theme.shape === "steps")
    for (let row = STEP_ROWS / 2; row < TH; row += STEP_ROWS) {
      const [x0, x1] = [pathX(row - 1), pathX(row)].sort((m, n) => m - n);
      carve([row - 3, row + 2], [x0 - 3, x1 + 2]);
    }

  // The main walkway so far (the path, and the castle's halls): mission trails may cross it.
  const mainTile = Uint8Array.from(kind, (k) => (k === PATH ? 1 : 0));

  // Open ground off the path (caverns, islands, the forest's glades): a few
  // patches in each area, just touching the path, on alternating sides.
  if (theme.open || theme.clearings) {
    for (let a = 0; a < BIOME_AREAS; a++) {
      [7, 14, 21].forEach((dy, k) => {
        if (theme.clearings && k === 1) return;
        const cy = areaTop(a) + dy;
        const side = (a + k) % 2 ? 1 : -1;
        let cx = pathX(cy) + side * 10;
        if (cx < 10 || cx > TW - 11) cx = pathX(cy) - side * 10;
        const big = theme.open ? 1 + hash(a, k, seed + 41) * 0.4 : 0.9;
        blob(cx, cy, 9 * big, (theme.open ? 6 : 5) * big);
      });
    }
    // Room at the top for the landmark and the boss.
    if (theme.open) blob(TW / 2, 6, 18, 8);
  }
  // Side roads to the neighboring zones, right out to the edge of the map.
  const exits = exitsFor(zone.id);
  for (const e of exits) {
    const row = exitRow(e.area);
    for (let ty = row - 2; ty <= row + 1; ty++) {
      const [from, to] = e.side === "right" ? [pathX(ty) - 2, TW - 1] : [0, pathX(ty) + 1];
      for (let tx = from; tx <= to; tx++) kind[at(tx, ty)] = PATH;
    }
  }
  // Clearings: in front of each gate for its guard, and at the top for the
  // landmark and boss (with a road over to it from the path).
  for (let a = 0; a < BIOME_AREAS - 1; a++) {
    const row = areaTop(a) + 4;
    carve([areaTop(a) + 2, areaTop(a) + 7], [pathX(row) - 5, pathX(row) + 4]);
  }
  carve([2, 10], [TW / 2 - 11, TW / 2 + 10]);
  carve([9, 11], [Math.min(pathX(10), TW / 2) - 2, Math.max(pathX(10), TW / 2) + 1]);

  // Scenes: one in each area but the top, beside the path on the roomier side.
  const fence = new Uint8Array(TW * TH); // tiles that must get scenery (around the nooks)
  const nookTile = new Uint8Array(TW * TH);
  const sceneTile = new Uint8Array(TW * TH); // under a scene: side trails keep out
  const scenePieces = [];
  const props = [];
  const sceneIds = ZONE_SCENES[zone.id] || [];
  for (let a = 0; a < BIOME_AREAS - 1 && a < sceneIds.length; a++) {
    const scene = SCENES[sceneIds[a]];
    const top = areaTop(a) + 11;
    const cx = pathX(top + 4);
    const right = cx <= TW - 5 - SCENE_W - 2;
    const left0 = right ? cx + 5 : cx - 5 - SCENE_W;
    for (let ty = top - 1; ty < top + SCENE_H; ty++)
      for (let tx = Math.min(left0, cx) - 1; tx <= Math.max(left0 + SCENE_W, cx); tx++) {
        if (tx < 1 || tx > TW - 2) continue;
        open(tx, ty);
        sceneTile[at(tx, ty)] = 1;
        if (kind[at(tx, ty)] === GROUND) clear[at(tx, ty)] = 1;
      }
    // Pieces are laid out for the right side; on the left they're mirrored.
    const place = (piece, x, y) => {
      const base = theme.swap?.[piece] || piece; // this world's own trees and plants
      const id = DECOR[`${base}_${zone.id}`] ? `${base}_${zone.id}` : base; // this zone's colors
      const w = Math.ceil(DECOR[id].rows[0].length / T);
      const tx = right ? left0 + x : left0 + SCENE_W - x - w;
      return { type: id, tx, ty: top + y, w, x: (tx + w / 2) * T, y: (top + y + 2) * T };
    };
    for (const [id, x, y] of scene.pieces) scenePieces.push(place(id, x, y));
    const prop = PROPS[scene.prop];
    const pp = place(prop.decor, ...scene.at);
    const id = `prop-${a}`;
    props.push({ ...pp, kind: scene.prop, id, area: a, used: trail.chests.includes(id) });
  }

  // Side trails: off the path near the bottom of each area, to a nook. Tried
  // a few rows and both sides (the side away from the scene first), and only
  // where it won't run into another path.
  const boulders = [];
  const nooks = [];
  const sceneRight = props.map((pr) => pr.x > pathX(tileOf(pr.y)) * T);
  for (let a = 0; a < BIOME_AREAS - 1; a++) {
    const tries = [];
    for (const dy of [22, 24, 20, 18, 4]) for (const right of sceneRight[a] ? [false, true] : [true, false]) tries.push([areaTop(a) + dy, right]);
    for (const [row, right] of tries) {
      const rows = [row, row + 1, row + 2, row + 3];
      // The trail starts right at the edge of the path.
      const x0 = right ? Math.max(...rows.map(pathX)) + 3 : Math.min(...rows.map(pathX)) - 4 - TRAIL_LEN; // tiles x0 .. x0 + TRAIL_LEN
      const nx = right ? x0 + TRAIL_LEN + NOOK_RX : x0 - NOOK_RX; // the nook's middle
      const ny = row + 2;
      // Room for the scenery all around the nook, inside the map.
      if (nx - NOOK_RX * 1.3 < 2 || nx + NOOK_RX * 1.3 > TW - 3 || ny + NOOK_RY * 1.8 > TH - 2) continue;
      let crosses = false;
      for (let ty = row - 2; ty <= row + 5 && !crosses; ty++)
        for (let tx = Math.floor(Math.min(x0, nx - NOOK_RX * 1.3)); tx <= Math.max(x0 + TRAIL_LEN, nx + NOOK_RX * 1.3); tx++) {
          const k = kind[at(tx, ty)];
          if (((k === PATH || k === GATE) && Math.abs(tx - pathX(ty)) > 3) || sceneTile[at(tx, ty)]) crosses = true;
        }
      if (crosses) continue;
      carve([row, row + 3], [x0, x0 + TRAIL_LEN]);
      for (const ty of rows) for (let tx = x0; tx <= x0 + TRAIL_LEN; tx++) open(tx, ty);
      // The nook, and scenery all around it and along the trail.
      for (let ty = Math.floor(ny - NOOK_RY * 1.8); ty <= ny + NOOK_RY * 1.8; ty++)
        for (let tx = Math.floor(nx - NOOK_RX * 1.8); tx <= nx + NOOK_RX * 1.8; tx++) {
          if (tx < 1 || ty < 0 || tx > TW - 2 || ty >= TH) continue;
          const d = Math.hypot((tx - nx) / NOOK_RX, (ty - ny) / NOOK_RY);
          if (d < 1) {
            kind[at(tx, ty)] = GROUND;
            nookTile[at(tx, ty)] = 1;
          } else if (d < 1.8 && kind[at(tx, ty)] !== PATH) fence[at(tx, ty)] = 1;
        }
      for (let tx = x0; tx <= x0 + TRAIL_LEN; tx++) for (const ty of [row - 2, row - 1, row + 4, row + 5]) if (ty >= 0 && ty < TH && !fence[at(tx, ty)]) fence[at(tx, ty)] = 2; // edges with gaps
      const bx = right ? x0 + 4 : x0 + TRAIL_LEN - 7; // the boulder covers 4 x 4 tiles of the trail
      const id = `boulder-${a}`;
      boulders.push({ id, area: a, tx: bx, ty: row, x: (bx + 2) * T, y: (row + 4) * T, broken: trail.chests.includes(id), letter: zone.letters[(a * 2 + 1) % zone.letters.length] });
      nooks.push({ area: a, x: nx * T + T / 2, y: ny * T + T - 1 });
      break;
    }
  }

  // Mission trails (missions.js): three winding trails off the path, each to
  // its own clearing, lined with scenery. Tried one per area from the
  // entrance up, on either side, wherever one fits without touching a scene,
  // a nook, a road, or another trail.
  const missionSpots = [];
  const missionTiles = new Uint8Array(TW * TH);
  const corridor = (cx, cy, r, each) => {
    for (let ty = Math.floor(cy - r); ty <= Math.ceil(cy + r); ty++)
      for (let tx = Math.floor(cx - r); tx <= Math.ceil(cx + r); tx++) each(tx, ty, Math.hypot(tx - cx, ty - cy));
  };
  // The trail's middle line: out from the path for `len` tiles, a bend up or
  // down `rise` tiles, then on into the clearing.
  const trailRoute = (a, row, side, len, rise) => {
    const sx = pathX(row) + side * 3;
    const x1 = sx + side * len;
    const ey = row + rise, ex = x1 + side * 5;
    if (ey - 4 < areaTop(a) + 3 || ey + 4 > areaTop(a) + SH - 2 || ex - 6 < 1 || ex + 6 > TW - 2) return null;
    const vdir = Math.sign(rise);
    const pts = [];
    const line = (x0, y0, xa, ya) => {
      const n = Math.ceil(Math.hypot(xa - x0, ya - y0) * 2);
      for (let i = 0; i <= n; i++) pts.push([x0 + ((xa - x0) * i) / n, y0 + ((ya - y0) * i) / n]);
    };
    const bend = (x0, y0, qx, qy, xa, ya) => {
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        pts.push([(1 - t) ** 2 * x0 + 2 * (1 - t) * t * qx + t * t * xa, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * qy + t * t * ya]);
      }
    };
    line(sx, row, x1 - side * 2, row);
    bend(x1 - side * 2, row, x1, row, x1, row + vdir * 2);
    line(x1, row + vdir * 2, x1, ey - vdir * 2);
    bend(x1, ey - vdir * 2, x1, ey, x1 + side * 2, ey);
    line(x1 + side * 2, ey, ex, ey);
    return { pts, tx: ex, ty: ey };
  };
  // Room for it? The trail itself (and its clearing) can't touch a scene, a
  // nook or its fence, another trail, or a road; the scenery lining it can
  // share space with other scenery.
  const trailFits = (route) => {
    let ok = true;
    const farPath = (tx, ty) => {
      const k = kind[at(tx, ty)];
      return (k === PATH || k === GATE || k === BRIDGE_TILE) && !mainTile[at(tx, ty)] && Math.abs(tx - pathX(ty)) > 5;
    };
    const check = (tx, ty, inner) => {
      if (!ok) return;
      if (tx < 1 || ty < 0 || tx > TW - 2 || ty >= TH) return (ok = false);
      const n = at(tx, ty);
      if (sceneTile[n] || nookTile[n] || missionTiles[n] || farPath(tx, ty) || (inner && fence[n])) ok = false;
    };
    for (const [x, y] of route.pts) {
      if (Math.abs(x - pathX(Math.round(y))) <= 4) continue; // still on the main path
      corridor(x, y, 3.6, (tx, ty, d) => d <= 3.6 && check(tx, ty, d <= 2));
    }
    corridor(route.tx, route.ty, 7, (tx, ty) => {
      const d = Math.hypot((tx - route.tx) / 4, (ty - route.ty) / 3);
      if (d < 1.7) check(tx, ty, d < 1.1);
    });
    return ok;
  };
  const carveTrail = (route) => {
    const wide = theme.open === "caverns" || theme.beach; // a strip of ground along it, like the main path
    for (const [x, y] of route.pts) {
      corridor(x, y, 3.6, (tx, ty, d) => {
        if (tx < 1 || ty < 0 || tx > TW - 2 || ty >= TH) return;
        const n = at(tx, ty);
        if (wide && d <= 3.2) open(tx, ty);
        if (d <= 1.6 && kind[n] !== GATE) kind[n] = PATH;
        missionTiles[n] = 1;
      });
    }
    for (const [x, y] of route.pts)
      corridor(x, y, 3.6, (tx, ty, d) => {
        // (2: a trail's edge, lined with trees that have gaps between them.)
        if (tx >= 1 && ty >= 0 && tx <= TW - 2 && ty < TH && d > 2.2 && kind[at(tx, ty)] === GROUND && Math.abs(tx - pathX(ty)) > 4 && !fence[at(tx, ty)]) fence[at(tx, ty)] = 2;
      });
    // The clearing at the end.
    corridor(route.tx, route.ty, 7, (tx, ty) => {
      if (tx < 1 || ty < 0 || tx > TW - 2 || ty >= TH) return;
      const n = at(tx, ty);
      const d = Math.hypot((tx - route.tx) / 4, (ty - route.ty) / 3);
      if (d < 1) {
        open(tx, ty);
        if (kind[n] !== PATH) kind[n] = GROUND;
        nookTile[n] = 1;
        clear[n] = 1;
        fence[n] = 0;
      } else if (d < 1.7 && kind[n] === GROUND && !nookTile[n]) fence[n] = 1;
      missionTiles[n] = 1;
    });
    missionSpots.push({ x: route.tx * T + T / 2, y: route.ty * T + T - 1 });
  };
  if (MISSIONS[zone.id]) {
    // One trail per area from the entrance up, trying every row, a few
    // lengths, and bends either way - in an order that differs per zone, so
    // the trails don't all look alike.
    for (let pass = 0; pass < 2 && missionSpots.length < 3; pass++) {
      for (let a = 0; a < BIOME_AREAS - 1 && missionSpots.length < 3; a++) {
        if (pass === 0 && missionSpots.some((sp) => areaOf(sp.y) === a)) continue;
        const tries = [];
        for (let off = 5; off <= SH - 4; off++)
          for (const side of [-1, 1])
            for (const len of [8, 11, 14, 17])
              for (const rise of [-7, -6, -5, -4, -3, 3, 4, 5, 6, 7]) tries.push([off, side, len, rise, hash(off * 31 + len, rise * 7 + side, seed + a)]);
        tries.sort((m, n) => m[4] - n[4]);
        for (const [off, side, len, rise] of tries) {
          const route = trailRoute(a, areaTop(a) + off, side, len, rise);
          if (route && trailFits(route)) {
            carveTrail(route);
            break;
          }
        }
      }
    }
  }

  // Water: ponds, streams, fountains, or frozen lakes (never on a scene or nook).
  const pool = (px, py, rx, ry, tile) => {
    for (let ty = Math.floor(py - ry); ty <= py + ry; ty++)
      for (let tx = Math.floor(px - rx); tx <= px + rx; tx++)
        if (tx > 0 && tx < TW - 1 && Math.hypot((tx - px) / rx, (ty - py) / ry) < 1 && kind[at(tx, ty)] === GROUND && !clear[at(tx, ty)] && !fence[at(tx, ty)] && !nookTile[at(tx, ty)]) kind[at(tx, ty)] = tile;
  };
  for (let a = 0; a < BIOME_AREAS; a++) {
    const mid = areaTop(a) + 15;
    const far = pathX(mid) < TW / 2 ? TW - 16 : 15; // the side away from the path
    if (theme.water === "pond") pool(far, mid, 7, 3.5, WATER_TILE);
    else if (theme.water === "fountains" && a < BIOME_AREAS - 1) {
      pool(TW / 2 - 13, mid, 4, 2.5, WATER_TILE);
      pool(TW / 2 + 12, mid, 4, 2.5, WATER_TILE);
    } else if (theme.water === "ice") {
      pool(far, mid - 2, 11, 5, ICE_TILE);
      if (a % 2) pool(TW - far, mid + 7, 7, 3, ICE_TILE);
    } else if (theme.water === "river" && a > 0 && a < BIOME_AREAS - 1) {
      // A wide stream winding across, with a bridge where the path crosses.
      for (let tx = 0; tx < TW; tx++) {
        const r = mid + Math.round(Math.sin(tx * 0.12 + a) * 3);
        const half = 2 + Math.round(noise(tx, a, 5, seed + 30));
        for (let ty = r - half; ty <= r + half; ty++) {
          if (clear[at(tx, ty)] || fence[at(tx, ty)] || nookTile[at(tx, ty)]) continue;
          kind[at(tx, ty)] = kind[at(tx, ty)] === PATH ? BRIDGE_TILE : WATER_TILE;
        }
      }
      pool(far, mid - 8, 6, 3, WATER_TILE);
    }
  }

  // Gates: the top two rows of each area (except the last) are a wall, with
  // a gate where the path goes through.
  const gates = [];
  for (let a = 0; a < BIOME_AREAS - 1; a++) {
    const tiles = [];
    for (let ty = areaTop(a); ty < areaTop(a) + 2; ty++)
      for (let tx = 0; tx < TW; tx++)
        if (kind[at(tx, ty)] === PATH) {
          kind[at(tx, ty)] = GATE;
          tiles.push(at(tx, ty));
        }
    const xs = tiles.map((i) => i % TW);
    // Gateways are always open: go anywhere. (Quests are optional now.)
    gates.push({ area: a, tiles, minX: Math.min(...xs), maxX: Math.max(...xs), y: (areaTop(a) + 2) * T, open: true });
  }

  for (let i = 0; i < kind.length; i++) if (kind[i] === WATER_TILE || kind[i] === SOLID) blocked[i] = 1;

  // Trees, rocks, etc. on a grid of 2 x 2 tiles: a solid border, the gate
  // walls, and clumps inside.
  const decor = [];
  const BW = TW / 2, BH = TH / 2;
  const gateBlockRows = new Set(gates.map((g) => areaTop(g.area) / 2));
  const clumped = new Set(); // blocks with a clump tree: the next one leaves a gap
  for (let by = 0; by < BH; by++) {
    for (let bx = 0; bx < BW; bx++) {
      const tiles = [[2 * bx, 2 * by], [2 * bx + 1, 2 * by], [2 * bx, 2 * by + 1], [2 * bx + 1, 2 * by + 1]];
      if (tiles.some(([tx, ty]) => kind[at(tx, ty)] !== GROUND)) continue;
      let type;
      const fromPath = bx * 2 - pathX(by * 2 + 1); // from the middle of the path, in tiles
      const pick = (list) => list[Math.floor(hash(bx, by, seed + 1) * list.length)];
      const mix = theme.mixes?.[areaOf(by * 2 * T)] || theme.obstacles; // this area's trees and rocks
      const glade = tiles.some(([tx, ty]) => clear[at(tx, ty)] || nookTile[at(tx, ty)]);
      if (gateBlockRows.has(by)) type = theme.wall;
      else if (tiles.some(([tx, ty]) => fence[at(tx, ty)]) && !tiles.some(([tx, ty]) => nookTile[at(tx, ty)])) {
        // Trail edges get trees with gaps, so the woods feel open.
        if (tiles.every(([tx, ty]) => fence[at(tx, ty)] !== 1) && hash(bx, by, seed + 13) < 0.5) continue;
        type = pick(mix);
      }
      else if (theme.formal && !glade && (fromPath === -8 || fromPath === 6)) {
        // Hedges (or palms) along the avenue, with a gap now and then to walk through.
        if (by % 5 === 0) continue;
        type = theme.lining || "hedge";
      } else {
        const border = bx === 0 || by === 0 || bx === BW - 1 || by === BH - 1;
        const nearStart = by >= BH - 3 && Math.abs(bx * 2 - pathX(TH - 2)) < 8;
        // Trees and rocks grow in clumps where the noise is high, with gaps
        // inside each clump and only a few loners, so there's room to walk.
        const clump = (noise(bx, by, 3, seed) > theme.density && hash(bx, by, seed + 11) > 0.45) || hash(bx, by, seed) < 0.025;
        // Broken walls and pillars just off the castle's halls.
        const ruin = theme.ruins && Math.abs(fromPath) >= 5 && Math.abs(fromPath) <= 7 && hash(bx, by, seed + 3) < 0.45;
        const lawn = theme.formal && Math.abs(fromPath) < 16;
        if (!border && !ruin && (nearStart || !clump || glade || lawn)) continue;
        // Room to walk: no clump tree right beside or below another one.
        if (!border && !ruin) {
          if (clumped.has(by * BW + bx - 1) || clumped.has((by - 1) * BW + bx)) continue;
          clumped.add(by * BW + bx);
        }
        type = ruin ? (hash(bx, by, seed + 4) < 0.5 ? "wall" : "brokenpillar") : pick(mix);
      }
      // Off the grid by a few pixels, so the trees and rocks look scattered, not planted
      // in rows (the gate walls and hedges stay lined up).
      const tidy = gateBlockRows.has(by) || type === theme.lining || type === "hedge";
      const jx = tidy ? 0 : Math.round((hash(bx, by, seed + 7) - 0.5) * 7);
      const jy = tidy ? 0 : Math.round((hash(by, bx, seed + 8) - 0.5) * 5);
      decor.push({ type, x: bx * 16 + 8 + jx, y: by * 16 + 16 + jy });
      for (const [tx, ty] of tiles) blocked[at(tx, ty)] = 1;
    }
  }

  // The scenes' pieces, and their props, stand on their bottom two rows.
  for (const pc of [...scenePieces, ...props]) {
    if (!pc.kind) decor.push({ type: pc.type, x: pc.x, y: pc.y });
    for (let ty = pc.ty; ty < pc.ty + 2; ty++) for (let tx = pc.tx; tx < pc.tx + pc.w; tx++) blocked[at(tx, ty)] = 1;
  }
  // The fence around each nook is solid even where the scenery leaves a gap.
  for (let i = 0; i < fence.length; i++) if (fence[i] === 1 && !nookTile[i] && kind[i] !== PATH) blocked[i] = 1;
  for (const b of boulders) if (!b.broken) blockBoulder(blocked, b, 1);

  // The zone's landmark at the top, drawn big like a real building.
  const lm = LANDMARKS[zone.id];
  const landmark = { x: W / 2, y: 7 * T, w: lm.w * 2, h: lm.h * 2 };
  for (let ty = Math.floor((landmark.y - landmark.h) / T); ty < landmark.y / T; ty++)
    for (let tx = Math.floor((landmark.x - landmark.w / 2) / T); tx < Math.ceil((landmark.x + landmark.w / 2) / T); tx++)
      if (ty >= 0) blocked[at(tx, ty)] = 1;

  // The Trial shrine, beside the landmark (across from the boss).
  const trialSpot = { x: landmark.x - landmark.w / 2 - 22, y: landmark.y + 2 * T };

  // Start at the entrance, at the bottom.
  const startRow = TH - 3;
  const hero = { x: pathX(startRow) * T, y: startRow * T, flip: false, moving: false, path: [], trail: [] };

  const biome = {
    z, zone, theme, kind, blocked, decor, landmark, gates, hero, exits,
    secrets: [],
    waiting: [], // villagers who show up once the quest before theirs is done
    guardSpots: {}, // where each gate's guard stands (it shows up when you take the quest)
    bg: paintGround(theme, kind, seed),
    creatures: [],
    chests: [],
    props, // the thing to do in each area's scene
    boulders, // across the side trails
    signposts: [],
    coins: [],
    reachable: null,
    camX: 0,
    camY: 0,
    safeUntil: 0,
    nextSpawn: 0,
    fighting: null,
    chest: null, // the sign panel that's open (a chest, an item, or a riddle)
    npcs: [], // villagers (quests.js)
    actors: [], // Malgrath or Rook, while a story event plays
    trainers: [], // trainers.js: they battle you when they spot you
    spotted: null, // { t, since }: a trainer who just spotted you
    items: [], // lost things (find quests) and sign cards (collect quests)
    runners: [], // runaway critters (chase quests)
    folk: [], // townsfolk who wander about and chat
    spotOpen: false, // the spot-the-sign panel is up
    dust: [], // little puffs from footsteps
    atSign: null,
    trial: trialSpot, // 🏛️ the Trial shrine
    mission: null, // the zone's mission (missions.js), if there's room for its trails
    cinematic: false, // the mission's opening is playing
    camFocus: null, // where the camera looks instead of at you, during the opening
    guide: null, // the glowing trail to the mission's next goal
  };

  // Chests, signposts, and coins go on open ground you can reach once every
  // gate is open (so they can be past gates you haven't opened yet).
  const everywhere = floodFrom(biome, tileOf(hero.x), tileOf(hero.y - 1), true);
  // `half`: "low" = near where you come into the area, "high" = near its gate.
  const spot = (a, salt, nearPath, half = null) => {
    const rows = half === "low" ? [SH / 2, SH - 4] : half === "high" ? [6, SH / 2] : [4, SH - 4];
    for (let i = 0; i < 300; i++) {
      const tx = 2 + Math.floor(hash(i, salt, seed + a) * (TW - 4));
      const ty = areaTop(a) + rows[0] + Math.floor(hash(salt, i, seed + a) * (rows[1] - rows[0]));
      const n = at(tx, ty);
      if (!everywhere[n] || kind[n] !== GROUND || blocked[n]) continue;
      const fromPath = Math.abs(tx - pathX(ty));
      if (nearPath ? fromPath < 3 || fromPath > 5 : fromPath < 8) continue;
      return { x: tx * T + T / 2, y: ty * T + T - 1 };
    }
    return null;
  };
  for (const n of nooks) {
    const id = `nook-${n.area}`;
    biome.chests.push({ x: n.x, y: n.y, id, big: true, letter: zone.letters[(n.area * 3) % zone.letters.length], open: trail.chests.includes(id) });
  }
  for (let a = 0; a < BIOME_AREAS; a++) {
    for (let i = 0; i < CHESTS_PER_AREA; i++) {
      const p = spot(a, 100 + i, false);
      const id = `${a}-${i}`;
      const letters = zone.letters;
      if (p) biome.chests.push({ ...p, id, letter: letters[Math.floor(hash(a, i, seed + 50) * letters.length)], open: trail.chests.includes(id) });
    }
    for (let i = 0; i < SIGNPOSTS_PER_AREA; i++) {
      const p = spot(a, 200 + i, true);
      if (p) biome.signposts.push({ ...p, text: SIGNPOST_TEXTS[Math.floor(hash(z, a * 7 + i, 99) * SIGNPOST_TEXTS.length)] });
    }
    for (let i = 0; i < COINS_PER_AREA; i++) {
      const p = spot(a, 300 + i, false);
      if (p) biome.coins.push(p);
    }
    const secret = spot(a, 700, false);
    if (secret) biome.secrets.push({ ...secret, id: `secret-${a}`, found: trail.chests.includes(`secret-${a}`) });
  }

  // Villagers: the quest giver near where you come in; whoever you deliver to,
  // and anything you need to find, up near the gate. They show up one at a
  // time: each area's villagers wait (biome.waiting) until you've finished the
  // quest before theirs.
  const story = QUESTS[zone.id];
  story?.steps.forEach((step, a) => {
    const turn = a === 0 || progress.questState(z, a - 1).done || progress.questState(z, a).accepted;
    const people = turn ? biome.npcs : biome.waiting;
    const giver = spot(a, 400, true, step.type === "guard" ? "high" : "low");
    if (giver) people.push({ ...story.npcs[step.npc], id: step.npc, area: a, role: "giver", ...giver });
    if (step.type === "deliver") {
      const p = spot(a, 450, true, "high");
      if (p) people.push({ ...story.npcs[step.to], id: step.to, area: a, role: "receiver", ...p });
    }
    const state = progress.questState(z, a);
    const letters = zone.letters;
    if (step.type === "find") {
      const p = spot(a, 500, false, "high");
      if (p) biome.items.push({ area: a, kind: "lost", name: step.item, letter: letters[Math.floor(hash(a, 3, seed + 60) * letters.length)], ...p });
    }
    if (step.type === "collect") {
      for (let k = 0; k < step.count; k++) {
        const p = spot(a, 520 + k * 7, false);
        if (p) biome.items.push({ area: a, kind: "card", emoji: thingOf(step).emoji, letter: letters[(k + a) % letters.length], taken: k < state.count, ...p });
      }
    }
    if (step.type === "hide") {
      // Hide-and-seek: each time you find it, it dashes off to the next spot.
      const hops = [];
      for (let k = 0; k < step.hops + 3 && hops.length < step.hops; k++) {
        const p = spot(a, 560 + k * 9, false, k % 2 ? "high" : "low");
        if (p) hops.push(p);
      }
      if (hops.length) biome.items.push({ area: a, kind: "hider", name: step.item, emoji: step.emoji, letter: letters[(a * 5 + 2) % letters.length], taken: state.have, hops, ...hops[Math.min(state.count, hops.length - 1)] });
    }
    placeSignature(biome, step, a, state, spot, letters);
    if (step.type === "chase") {
      const p = spot(a, 540, false);
      if (p) biome.runners.push({ area: a, id: step.critter, letter: letters[(a * 3 + 1) % letters.length], caught: state.have, flip: false, moving: false, ...p });
    }
  });

  // ⚔️ The raid creature, in the first area by the path: easy to find, open to everyone.
  biome.raid = spot(0, 960, true, "high") || spot(0, 967, true) || { x: hero.x - 40, y: hero.y - 40 };
  // 🔷 The Trial portal, by the path right where you come in.
  biome.trial = spot(0, 980, true, "low") || spot(0, 987, true) || biome.trial;

  // 🌀 The Motion Trial shrine, in the first area.
  biome.motionTrial = spot(0, 905, true, "high") || spot(0, 911, true) || { x: hero.x + 40, y: hero.y - 30 };

  // Townsfolk, one in each area, by the path near where you come in.
  (story?.folk || []).forEach((f, k) => {
    const a = k % (BIOME_AREAS - 1);
    const p = spot(a, 800 + k * 13, true, "low");
    if (p) biome.folk.push({ ...f, area: a, homeX: p.x, homeY: p.y, dir: null, turnAt: 0, flip: false, moving: false, said: 0, ...p });
  });

  // Trainers stand near the path, in the middle of their area.
  for (const t of trainersFor(z)) {
    const p = spot(t.area, 600, true);
    if (p) biome.trainers.push({ ...t, ...p, homeX: p.x, homeY: p.y, beaten: progress.trainerBeaten(t.id) });
  }

  // 🎯 The zone's mission: whoever asks for help, a few steps from the
  // entrance, and the goals out in the trail clearings.
  const missionDef = MISSIONS_ON ? MISSIONS[zone.id] : null;
  const needSpots = missionDef ? Math.max(...missionDef.phases.flatMap((ph) => [...(ph.goals || []), ...(ph.extras || [])]).map((g) => g.at)) + 1 : 0;
  if (missionDef && missionSpots.length >= needSpots) {
    let giverAt = null;
    const gy = TH - 7, gx = pathX(gy) + 5;
    for (let r = 0; r < 10 && !giverAt; r++)
      for (let dy = -r; dy <= r && !giverAt; dy++)
        for (let dx = -r; dx <= r && !giverAt; dx++) {
          const tx = gx + dx, ty = gy + dy, n = at(tx, ty);
          if (tx > 1 && tx < TW - 2 && ty < TH - 1 && everywhere[n] && kind[n] === GROUND && !blocked[n] && Math.abs(tx - pathX(ty)) >= 4) giverAt = { x: tx * T + T / 2, y: ty * T + T - 1 };
        }
    const goals = missionDef.phases.flatMap((ph, phase) =>
      [...(ph.goals || []), ...(ph.extras || []).map((g) => ({ ...g, extra: true }))].map((g) => ({ ...g, phase, ...missionSpots[g.at], homeX: missionSpots[g.at].x, homeY: missionSpots[g.at].y })),
    );
    biome.mission = { def: missionDef, spots: missionSpots, giver: { ...missionDef.giver, ...(giverAt || { x: hero.x + 24, y: hero.y - 16 }) }, goals, fx: null, deadline: 0 };
    // Something you were carrying against the clock is gone when you come back.
    const st = progress.missionState(z);
    for (const g of goals) {
      if (g.timer && st.done.includes(g.id) && st.phase === g.phase + 1 && st.carry.includes(g.item)) {
        st.carry.splice(st.carry.indexOf(g.item), 1);
        progress.updateMission(z, { phase: g.phase, done: st.done.filter((id) => id !== g.id), carry: st.carry });
      }
    }
  }

  for (const gate of gates) if (!gate.open) for (const i of gate.tiles) blocked[i] = 1;
  placeOnOpenGround(biome, hero);
  biome.reachable = floodFrom(biome, tileOf(hero.x), tileOf(hero.y - 1));

  // The boss (until beaten), a guard at each closed gate, and wild creatures.
  const wild = CREATURES.filter((c) => c.zone === zone.id && c.kind === "wild");
  spawnBoss(biome);
  for (const gate of gates) {
    // A guard quest has a tough creature waiting by the gateway until it's beaten.
    if (story?.steps[gate.area]?.type !== "guard" || progress.questState(z, gate.area).done) continue;
    const row = areaTop(gate.area) + 6;
    biome.guardSpots[gate.area] = { x: pathX(row) * T, y: row * T };
    if (progress.questState(z, gate.area).accepted) spawnGateGuard(biome, gate.area);
  }
  // Hexed creatures guarding what quests you've taken are after.
  story?.steps.forEach((step, a) => spawnKeeper(biome, a));
  for (let a = 0; a < BIOME_AREAS; a++) for (let i = 0; i < WILD_PER_AREA; i++) spawnWild(biome, a);
  return biome;
}

// A boulder blocks 4 x 4 tiles of its trail (`on` 1), until it's smashed (0).
function blockBoulder(blocked, b, on) {
  for (let ty = b.ty; ty < b.ty + 4; ty++) for (let tx = b.tx; tx < b.tx + 4; tx++) blocked[ty * TW + tx] = on;
}

// Paints straight into pixel memory - much faster than drawing each pixel.
function paintGround(theme, kind, seed) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(W, H);
  const px = image.data;
  const rgb = new Map();
  const toRgb = (hex) => {
    if (!rgb.has(hex)) rgb.set(hex, [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
    return rgb.get(hex);
  };
  const kindAt = (x, y) => kind[Math.floor(Math.min(H - 1, Math.max(0, y)) / T) * TW + Math.floor(Math.min(W - 1, Math.max(0, x)) / T)];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = kindAt(x, y);
      let c;
      if (k === SOLID) {
        c = solidColor(theme, kindAt, x, y, seed);
      } else if (k === ICE_TILE) {
        c = ICE[noise(x, y, 8, seed + 12) > 0.55 ? 1 : 0];
        if (noise(x, y, 3, seed + 13) > 0.78) c = ICE_CRACK;
        if (hash(x, y, seed + 14) < 0.006) c = "#ffffff";
        if ([kindAt(x - 1, y), kindAt(x + 1, y), kindAt(x, y - 1), kindAt(x, y + 1)].some((n) => n !== ICE_TILE)) c = ICE_EDGE;
      } else if (k === WATER_TILE) {
        c = WATER[noise(x, y, 6, seed + 5) > 0.6 ? 1 : 0];
        if (hash(x, y, seed + 6) < 0.01) c = "#96c6e0";
        // Sandy edge where water meets land.
        if ([kindAt(x - 1, y), kindAt(x + 1, y), kindAt(x, y - 1), kindAt(x, y + 1)].some((n) => n === GROUND || n === PATH)) c = SHORE;
      } else if (k === BRIDGE_TILE) {
        c = BRIDGE[y % 4 === 0 ? 1 : 0];
      } else if (k === PATH || k === GATE) {
        c = theme.path[noise(x, y, 4, seed + 7) > 0.55 ? 1 : 0];
        if (hash(x, y, seed + 8) < 0.03) c = theme.path[1];
      } else {
        c = (theme.grounds?.[areaOf(y)] || theme.ground)[noise(x, y, 6, seed + 9) > 0.6 ? 1 : 0];
        if (hash(x, y, seed + 10) < theme.speckRate) c = theme.specks[Math.floor(hash(x, y, seed + 11) * theme.specks.length)];
      }
      const [r, g, b] = toRgb(c);
      const i = (y * W + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = 255;
    }
  }
  paintDecals(theme, kind, px, seed);
  ctx.putImageData(image, 0, 0);
  return canvas;
}

const ICE = ["#d8ecf8", "#cce4f4"];
const ICE_CRACK = "#a8cce4";
const ICE_EDGE = "#9cc0dc";

// Where there's no ground: rock, sky, or the void. Just under the ground's
// edge is a cliff face, so the ground looks raised (islands look like they're
// floating); a dark rim outlines the edge, and the rest has the odd sparkle.
const CLIFF = 6; // pixels
function solidColor(theme, kindAt, x, y, seed) {
  const ground = (n) => n !== SOLID;
  for (let d = 1; d <= CLIFF; d++)
    if (ground(kindAt(x, y - d))) return d === 1 ? theme.rim : theme.cliff[(x + (d > 3 ? 1 : 0)) % 3 === 0 ? 1 : 0];
  if ([kindAt(x - 1, y), kindAt(x + 1, y), kindAt(x, y - 1), kindAt(x, y + 1)].some(ground)) return theme.rim;
  if (hash(x, y, seed + 15) < 0.004) return theme.sparkle;
  return theme.solid[noise(x, y, 10, seed + 16) > 0.62 ? 1 : 0];
}

// Little flowers, pebbles, and such, here and there on open ground.
function paintDecals(theme, kind, px, seed) {
  if (!theme.decals) return;
  for (let ty = 0; ty < TH; ty++) {
    for (let tx = 0; tx < TW; tx++) {
      if (kind[ty * TW + tx] !== GROUND || hash(tx, ty, seed + 20) >= theme.decalRate) continue;
      const decal = DECALS[theme.decals[Math.floor(hash(ty, tx, seed + 21) * theme.decals.length)]];
      const w = decal.rows[0].length, h = decal.rows.length;
      const x0 = tx * T + Math.floor(hash(tx, ty, seed + 22) * (T - w));
      const y0 = ty * T + Math.floor(hash(ty, tx, seed + 23) * (T - h));
      decal.rows.forEach((row, dy) => {
        [...row].forEach((ch, dx) => {
          if (ch === ".") return;
          const i = ((y0 + dy) * W + x0 + dx) * 4;
          if (ch === "d" || ch === "l") {
            const f = ch === "d" ? 0.78 : 1.18;
            for (let k = 0; k < 3; k++) px[i + k] = Math.min(255, px[i + k] * f);
          } else px.set([1, 3, 5].map((j) => parseInt(decal.colors[ch].slice(j, j + 2), 16)), i);
        });
      });
    }
  }
}

// ---------- Battle backdrops ----------
// Each zone has its own battleground (ARENAS): what the floor is (grass,
// rock, stone tiles, snow, a cloud or void platform over the sky), what's
// along the back (a cave wall, castle battlements, a stream), the scenery
// around the edges and in front, and a touch of atmosphere (light through
// the trees, darkness in the caves, falling snow, stars). Fighters stand on
// worn patches: your team in a column on the left, the foe on the right.

const FIELD_W = 320;
const FIELD_H = 180;
const backdrops = new Map();

const ARENAS = {
  meadow: { floor: "grass", pads: true, pond: true, back: ["oak", "oakgold", "bush", "flowerbush"], sides: ["oak", "flowerbush", "bush"], front: ["oak", "flowerbush"], house: "cottage", decals: 0.06 },
  forest: { floor: "grass", pads: true, back: ["glowshroom", "glowshroompink", "darkpine", "glowshroom"], backRows: 3, sides: ["glowshroom", "glowshroompink", "fern"], front: ["glowshroom", "glowshroompink"], overlay: "glow", decals: 0.06 },
  caves: { floor: "rock", wall: "lava", back: ["obsidian", "lavarock", "obsidian"], sides: ["obsidian", "lavarock"], front: ["obsidian", "lavarock"], overlay: "embers" },
  river: { floor: "grass", pads: true, sea: true, back: ["palm", "coral", "palm", "coralblue"], sides: ["palm", "coral"], front: ["palm", "palm"], decals: 0.05 },
  castle: { floor: "grass", pads: true, back: ["spookytree", "grave", "jackolantern", "pumpkin"], sides: ["spookytree", "grave", "pumpkin"], front: ["spookytree", "jackolantern"], house: "cottage", overlay: "fog", decals: 0.04 },
  keep: { floor: "tiles", tiles: ["#dcd6e6", "#ccc4da", "#a49cb4"], carpet: true, back: ["pillar", "hedge", "pillar", "rosebush"], sides: ["pillar", "hedge"], front: ["pillar", "rosebush"] },
  spires: { floor: "snow", pond: "ice", back: ["snowpine", "icecrystal", "bluecrystal"], sides: ["snowpine", "snowrock", "icecrystal"], front: ["snowpine", "icecrystal"], overlay: "aurora" },
  clouds: { floor: "sky", back: ["stormrock", "ambercrystal", "darkpine"], sides: ["stormrock"], front: ["stormrock", "darkpine"], overlay: "storm" },
  void: { floor: "void", back: ["planet", "crystal", "voidtree"], sides: ["planetblue", "crystal"], front: ["voidtree", "planet"], overlay: "stars" },
};

export function battleBackdropSrc(zoneId) {
  if (backdrops.has(zoneId)) return backdrops.get(zoneId);
  const theme = THEMES[zoneId];
  const arena = ARENAS[zoneId] || ARENAS.meadow;
  const seed = [...zoneId].reduce((n, ch) => n + ch.charCodeAt(0), 0);

  // The ground, one game pixel at a time.
  const ground = document.createElement("canvas");
  ground.width = FIELD_W;
  ground.height = FIELD_H;
  const gctx = ground.getContext("2d");
  const image = gctx.createImageData(FIELD_W, FIELD_H);
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const blob = (x, y, cx, cy, rx, ry, wobble) => Math.hypot((x - cx) / rx, (y - cy) / ry) + (noise(x, y, 7, seed + wobble) - 0.5) * 0.45;
  // Where fighters stand (see .buddy-slot / .hero-slot / .monster-side in style.css).
  const pads = [[58, 73, 24, 9], [77, 124, 30, 11], [58, 155, 24, 9], [240, 121, 54, 22], [306, 70, 20, 10], [170, 168, 30, 9]];
  const pond = arena.pond ? { cx: 172, cy: 12, rx: 52, ry: 30 } : null;
  const WALL_H = 40; // a cave or castle wall across the top
  // The floating platform (clouds, void): one big island under everyone.
  const platform = (x, y) => blob(x, y, 162, 116, 150, 64, 4);
  const sky = arena.floor === "sky" ? ["#2e3a56", "#34405e"] : ["#0b0814", "#120c22"]; // a stormy sky, or the void

  for (let y = 0; y < FIELD_H; y++) {
    for (let x = 0; x < FIELD_W; x++) {
      let c = theme.ground[noise(x, y, 16, seed) > 0.56 ? 1 : 0]; // big darker patches, like mown grass
      if (hash(x, y, seed + 1) < theme.speckRate) c = theme.specks[Math.floor(hash(x, y, seed + 2) * theme.specks.length)];
      if (arena.floor === "tiles") {
        // Big flagstones with dark grout.
        const tx = Math.floor((x + (Math.floor(y / 20) % 2) * 12) / 24), ty = Math.floor(y / 20);
        c = hash(tx, ty, seed) < 0.3 ? arena.tiles[1] : arena.tiles[0];
        if (y % 20 === 0 || (x + (Math.floor(y / 20) % 2) * 12) % 24 === 0) c = arena.tiles[2];
      }
      if (arena.floor === "snow" && hash(x, y, seed + 3) < 0.01) c = "#ffffff";
      if (arena.pads) {
        for (const [i, [cx, cy, rx, ry]] of pads.entries()) {
          const d = blob(x, y, cx, cy, rx, ry, i);
          if (d < 1) c = theme.path[d < 0.8 && noise(x, y, 4, seed + 3) > 0.5 ? 1 : 0];
        }
      }
      if (arena.carpet && y > 104 && y < 138 && x > 40 && x < 290) c = y < 107 || y > 135 ? "#e8b84a" : (x + y) % 9 === 0 ? "#b3343e" : "#c8414b";
      if (pond) {
        const d = blob(x, y, pond.cx, pond.cy, pond.rx, pond.ry, 9);
        if (d < 1.08) c = arena.pond === "ice" ? "#9cc0dc" : SHORE;
        if (d < 1) c = arena.pond === "ice" ? (noise(x, y, 5, seed) > 0.7 ? "#a8cce4" : "#d8ecf8") : WATER[noise(x, y, 6, seed + 4) > 0.6 ? 1 : 0];
        if (d < 1 && hash(x, y, seed + 5) < 0.012) c = arena.pond === "ice" ? "#ffffff" : "#96c6e0";
      }
      if (arena.sea) {
        // The sea along the back, with foam where the waves reach the sand.
        const edge = 30 + Math.sin(x * 0.07 + seed) * 4;
        if (y < edge + 2) c = "#ffffff";
        if (y < edge) c = noise(x, y, 8, seed + 4) > 0.6 ? "#46b0e0" : "#3aa6d8";
        if (y < edge && hash(x, y, seed + 6) < 0.012) c = "#e8fbff";
      }
      if (arena.stream) {
        // A stream across the back, behind everyone.
        const mid = 22 + Math.sin(x * 0.05 + seed) * 5;
        if (Math.abs(y - mid) < 13) c = SHORE;
        if (Math.abs(y - mid) < 11) c = WATER[noise(x, y, 6, seed + 4) > 0.6 ? 1 : 0];
        if (Math.abs(y - mid) < 11 && hash(x, y, seed + 6) < 0.01) c = "#96c6e0";
      }
      if (arena.floor === "sky" || arena.floor === "void") {
        const d = platform(x, y);
        if (d >= 1) {
          // Off the edge: sky (or the void), with the platform's cliff just under it.
          const above = platform(x, y - 10);
          c = above < 1 ? (arena.floor === "sky" ? "#4a5064" : "#3a2c5a") : sky[noise(x, y, 18, seed) > 0.6 ? 1 : 0];
          if (above >= 1 && hash(x, y, seed + 7) < (arena.floor === "void" ? 0.006 : 0.002)) c = arena.floor === "void" ? "#c8b0ff" : "#ffe066";
        }
      }
      if (arena.wall && y < WALL_H) {
        if (arena.wall === "lava") {
          // A lava fall across the back, glowing at its edge.
          c = y > WALL_H - 6 ? "#3a241e" : noise(x, y, 6, seed) > 0.55 ? "#ffb020" : (x + y * 2) % 7 === 0 ? "#ffd23f" : "#f06a2a";
          if (y === WALL_H - 1) c = "#1a0e0a";
        } else if (arena.wall === "cave") {
          // A rock wall, lit a little at its foot.
          c = y > WALL_H - 8 ? "#4a3f5c" : noise(x, y, 8, seed) > 0.6 ? "#2a2236" : "#221b2e";
          if (y === WALL_H - 1 || (y > WALL_H - 8 && hash(x, y, seed) < 0.05)) c = "#140f1c";
        } else {
          // Castle battlements: bricks, with gaps along the top.
          const brick = (y + 1) % 6 === 0 || (x + (Math.floor(y / 6) % 2) * 6) % 12 === 0;
          c = brick ? "#7a7288" : y < 8 && x % 20 > 11 ? null : "#a8a0b0";
          if (y === WALL_H - 1) c = "#2b1d2e";
          if (c === null) c = theme.ground[0];
        }
      }
      const [r, g, b] = rgb(c);
      image.data.set([r, g, b, 255], (y * FIELD_W + x) * 4);
    }
  }
  gctx.putImageData(image, 0, 0);
  // Little flowers and such on grass.
  if (arena.decals && theme.decals) {
    for (let i = 0; i < FIELD_W * FIELD_H * arena.decals / 64; i++) {
      const decal = DECALS[theme.decals[Math.floor(hash(i, 1, seed) * theme.decals.length)]];
      const x0 = Math.floor(hash(i, 2, seed) * (FIELD_W - 4)), y0 = 44 + Math.floor(hash(i, 3, seed) * (FIELD_H - 50));
      decal.rows.forEach((row, dy) => [...row].forEach((ch, dx) => {
        if (ch === "." || ch === "d" || ch === "l") return;
        gctx.fillStyle = decal.colors[ch];
        gctx.fillRect(x0 + dx, y0 + dy, 1, 1);
      }));
    }
  }

  // Scale up and add scenery at full sprite detail.
  const canvas = document.createElement("canvas");
  canvas.width = FIELD_W * SPRITE_SCALE;
  canvas.height = FIELD_H * SPRITE_SCALE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ground, 0, 0, canvas.width, canvas.height);
  ctx.setTransform(SPRITE_SCALE, 0, 0, SPRITE_SCALE, 0, 0);

  const items = [];
  const pick = (list, i, salt) => list[Math.floor(hash(i, salt, seed) * list.length)];
  const inPond = (x, y) => pond && Math.hypot((x - pond.cx) / (pond.rx + 10), (y - pond.cy) / (pond.ry + 10)) < 1;
  const onPlatform = (x, y) => !(arena.floor === "sky" || arena.floor === "void") || platform(x, y) < 0.92;
  const floating = arena.floor === "sky" || arena.floor === "void";
  const backY = arena.wall ? WALL_H + 2 : arena.stream || arena.sea ? 44 : floating ? 66 : 18; // floating: along the platform's top edge
  // Back rows along the top (on the wall's foot, or past the stream).
  for (let x = -6; x < FIELD_W + 8; x += 15) {
    for (let row = 0; row < (arena.backRows || 2); row++) {
      const x1 = x + (row % 2 ? 7 : 0) + hash(x, row, seed) * 6, y = backY + row * 14 + hash(x, row + 2, seed) * 8;
      if (row > 0 && hash(x, 9 + row, seed) < 0.45) continue;
      if (!inPond(x1, y - 6) && onPlatform(x1, y)) items.push({ type: pick(arena.back, x, row), x: x1, y, scale: 1 });
    }
  }
  if (arena.house) items.push({ type: arena.house, x: 34, y: 46, scale: 1 });
  // Clumps down the sides.
  for (let y = 54; y < FIELD_H - 20; y += 14) {
    for (const [x, salt] of [[4 + hash(y, 6, seed) * 10, 5], [FIELD_W - 4 - hash(y, 8, seed) * 10, 7]]) if (onPlatform(x, y)) items.push({ type: pick(arena.sides, y, salt), x, y, scale: 1 });
  }
  // Big scenery in front, along the bottom, partly cut off.
  for (let x = 10; x < FIELD_W; x += 34) {
    if (x < 110 || Math.abs(x - 240) < 30) continue; // keep the fighters in view
    items.push({ type: pick(arena.front, x, 11), x: x + hash(x, 12, seed) * 10, y: FIELD_H + 10, scale: 2 });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const id = DECOR[`${it.type}_${zoneId}`] ? `${it.type}_${zoneId}` : it.type; // this zone's buildings
    const img = spriteCanvas(decorSrc(id));
    const w = (img.width / SPRITE_SCALE) * it.scale, h = (img.height / SPRITE_SCALE) * it.scale;
    ctx.drawImage(img, Math.round(it.x - w / 2), Math.round(it.y - h), w, h);
  }

  // Atmosphere over everything.
  if (arena.overlay === "rays") {
    // Light coming down through the trees.
    for (const x of [70, 150, 230]) {
      const grad = ctx.createLinearGradient(x, 0, x + 40, FIELD_H);
      grad.addColorStop(0, "rgba(255, 244, 192, 0.28)");
      grad.addColorStop(1, "rgba(255, 244, 192, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 22, 0);
      ctx.lineTo(x + 70, FIELD_H);
      ctx.lineTo(x + 30, FIELD_H);
      ctx.fill();
    }
  } else if (arena.overlay === "dark") {
    // Dark at the edges of the cave, with crystals glowing.
    const grad = ctx.createRadialGradient(FIELD_W / 2, FIELD_H * 0.6, 40, FIELD_W / 2, FIELD_H * 0.6, 200);
    grad.addColorStop(0, "rgba(10, 6, 20, 0)");
    grad.addColorStop(1, "rgba(10, 6, 20, 0.55)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    for (const it of items.filter((i) => /crystal/.test(i.type))) {
      const glowGrad = ctx.createRadialGradient(it.x, it.y - 6, 1, it.x, it.y - 6, 16);
      glowGrad.addColorStop(0, "rgba(127, 227, 255, 0.35)");
      glowGrad.addColorStop(1, "rgba(127, 227, 255, 0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(it.x - 16, it.y - 22, 32, 32);
    }
  } else if (arena.overlay === "glow") {
    // Glowing spores drifting in the dark under the mushrooms.
    ctx.fillStyle = "rgba(10, 30, 40, 0.25)";
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    for (let i = 0; i < 60; i++) {
      const x = hash(i, 31, seed) * FIELD_W, y = hash(i, 32, seed) * FIELD_H;
      const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, 4);
      glowGrad.addColorStop(0, "rgba(168, 244, 255, 0.9)");
      glowGrad.addColorStop(1, "rgba(168, 244, 255, 0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(x - 4, y - 4, 8, 8);
    }
  } else if (arena.overlay === "embers") {
    // Heat and drifting embers.
    const grad = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    grad.addColorStop(0, "rgba(255, 120, 40, 0.25)");
    grad.addColorStop(1, "rgba(60, 10, 0, 0.2)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = i % 3 ? "#ff8a2a" : "#ffd23f";
      ctx.fillRect(Math.floor(hash(i, 41, seed) * FIELD_W), Math.floor(hash(i, 42, seed) * FIELD_H), 1, 1);
    }
  } else if (arena.overlay === "fog") {
    // Night, with low fog curling around.
    ctx.fillStyle = "rgba(20, 10, 40, 0.3)";
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    for (let i = 0; i < 14; i++) {
      const x = hash(i, 51, seed) * FIELD_W, y = FIELD_H * 0.4 + hash(i, 52, seed) * FIELD_H * 0.6;
      const fog = ctx.createRadialGradient(x, y, 2, x, y, 40);
      fog.addColorStop(0, "rgba(200, 240, 216, 0.22)");
      fog.addColorStop(1, "rgba(200, 240, 216, 0)");
      ctx.fillStyle = fog;
      ctx.fillRect(x - 40, y - 40, 80, 80);
    }
  } else if (arena.overlay === "aurora") {
    // The northern lights across the top, and snowflakes.
    for (const [y0, color] of [[6, "127, 227, 160"], [16, "197, 140, 240"]]) {
      const band = ctx.createLinearGradient(0, y0 - 8, 0, y0 + 10);
      band.addColorStop(0, `rgba(${color}, 0)`);
      band.addColorStop(0.5, `rgba(${color}, 0.45)`);
      band.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = band;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (let x = 0; x <= FIELD_W; x += 20) ctx.lineTo(x, y0 + Math.sin(x * 0.03 + y0) * 6);
      ctx.lineTo(FIELD_W, y0 + 14);
      ctx.lineTo(0, y0 + 14);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    for (let i = 0; i < 60; i++) ctx.fillRect(Math.floor(hash(i, 21, seed) * FIELD_W), Math.floor(hash(i, 22, seed) * FIELD_H), 1, 1);
  } else if (arena.overlay === "storm") {
    // A lightning bolt in the stormy sky.
    ctx.strokeStyle = "#fff4c0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(250, 0);
    for (const [x, y] of [[238, 12], [246, 14], [232, 30]]) ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 230, 102, 0.6)";
    for (let i = 0; i < 30; i++) ctx.fillRect(Math.floor(hash(i, 61, seed) * FIELD_W), Math.floor(hash(i, 62, seed) * FIELD_H), 1, 1);
  } else if (arena.overlay === "snow" || arena.overlay === "stars") {
    // Snowflakes in the air (or twinkles in the void).
    ctx.fillStyle = arena.overlay === "snow" ? "rgba(255, 255, 255, 0.85)" : "rgba(200, 176, 255, 0.7)";
    for (let i = 0; i < 70; i++) ctx.fillRect(Math.floor(hash(i, 21, seed) * FIELD_W), Math.floor(hash(i, 22, seed) * FIELD_H), 1, 1);
  }

  backdrops.set(zoneId, canvas.toDataURL());
  return backdrops.get(zoneId);
}

// ---------- Tiles, walking, and finding a way ----------

const tileOf = (px) => Math.floor(px / T);

function walkable(biome, px, py) {
  if (px < 0 || py < 0 || px >= W || py >= H) return false;
  return !biome.blocked[tileOf(py) * TW + tileOf(px)];
}

// A character's feet are a small box at (x, y) = bottom middle.
const feetFree = (biome, x, y) =>
  walkable(biome, x - 4, y - 3) && walkable(biome, x + 3, y - 3) && walkable(biome, x - 4, y - 1) && walkable(biome, x + 3, y - 1);

// Every tile you can walk to from (sx, sy). `ignoreGates` treats gates as open.
function floodFrom(biome, sx, sy, ignoreGates = false) {
  const gateTiles = new Set(ignoreGates ? biome.gates.flatMap((g) => g.tiles) : []);
  const seen = new Uint8Array(TW * TH);
  const queue = [sy * TW + sx];
  seen[sy * TW + sx] = 1;
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi], x = cur % TW, y = Math.floor(cur / TW);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, n = ny * TW + nx;
      if (nx < 0 || ny < 0 || nx >= TW || ny >= TH || seen[n]) continue;
      if (biome.blocked[n] && !gateTiles.has(n)) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  return seen;
}

// Move a character to the nearest spot where its feet fit, if they don't already.
function placeOnOpenGround(biome, who) {
  if (feetFree(biome, who.x, who.y)) return;
  for (let r = 1; r < 12; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = Math.round(who.x / T) * T + dx * T, y = Math.round(who.y / T) * T + dy * T;
        if (feetFree(biome, x, y)) return Object.assign(who, { x, y });
      }
}

// Shortest walk between tiles (breadth-first search), as a list of points.
function findPath(biome, sx, sy, gx, gy) {
  const prev = new Int32Array(TW * TH).fill(-1);
  const start = sy * TW + sx, goal = gy * TW + gx;
  prev[start] = start;
  const queue = [start];
  for (let qi = 0; qi < queue.length && prev[goal] === -1; qi++) {
    const cur = queue[qi], x = cur % TW, y = Math.floor(cur / TW);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, n = ny * TW + nx;
      if (nx < 0 || ny < 0 || nx >= TW || ny >= TH || prev[n] !== -1 || biome.blocked[n]) continue;
      prev[n] = cur;
      queue.push(n);
    }
  }
  if (prev[goal] === -1) return [];
  const points = [];
  for (let n = goal; n !== start; n = prev[n]) points.unshift({ x: (n % TW) * T + T / 2, y: Math.floor(n / TW) * T + T - 1 });
  return points;
}

// Nearest open tile to a tapped spot that the hero can actually reach.
function nearestReachable(biome, tx, ty) {
  for (let r = 0; r < 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = tx + dx, y = ty + dy;
        if (x >= 0 && y >= 0 && x < TW && y < TH && biome.reachable[y * TW + x]) return [x, y];
      }
  return null;
}

// ---------- Creatures ----------

// Now and then, a rare creature from another zone wanders in. Explore to find them!
const RARE_CHANCE = 0.08;

// Common creatures turn up often, legendary ones hardly ever (RARITIES in config.js).
function pickByRarity(list) {
  const total = list.reduce((sum, c) => sum + rarityOf(c).weight, 0);
  let r = Math.random() * total;
  for (const c of list) if ((r -= rarityOf(c).weight) < 0) return c;
  return list[list.length - 1];
}

function spawnWild(biome, area) {
  const local = CREATURES.filter((c) => c.zone === biome.zone.id && c.kind === "wild");
  const rare = CREATURES.filter((c) => c.kind === "wild" && c.zone !== biome.zone.id && ZONES.find((zn) => zn.id === c.zone).dimension === biome.zone.dimension);
  const isRare = Math.random() < RARE_CHANCE && rare.length;
  const wild = isRare ? rare : local;
  const wordsOpen = progress.stageStars(biome.z, 0) > 0;
  const top = areaTop(area) + 3;
  const bottom = areaTop(area) + SH - (area === 0 ? 6 : 2); // not right by the entrance
  for (let tries = 0; tries < 300; tries++) {
    const tx = 2 + Math.floor(Math.random() * (TW - 4));
    const ty = top + Math.floor(Math.random() * (bottom - top));
    const x = tx * T + T / 2, y = ty * T + T - 1;
    if (!feetFree(biome, x, y) || Math.hypot(x - biome.hero.x, y - biome.hero.y) < 60) continue;
    biome.creatures.push({
      id: pickByRarity(wild).id,
      stage: wordsOpen && Math.random() < 0.5 ? 1 : 0,
      area,
      level: creatureLevel(biome.z, area) + (isRare ? 2 : 0),
      rare: Boolean(isRare),
      x, y, dir: Math.random() * Math.PI * 2, turnAt: 0,
    });
    return;
  }
}

function moveCreatures(biome, dt, now) {
  for (const c of biome.creatures) {
    c.moving = false;
    if (c.home) continue; // guards and the boss stay put
    if (now > c.turnAt) {
      c.dir = Math.random() < 0.7 ? null : Math.random() * Math.PI * 2; // mostly stand still
      c.turnAt = now + 2000 + Math.random() * 3000;
    }
    if (c.dir === null) continue;
    const nx = c.x + Math.cos(c.dir) * CREATURE_SPEED * dt;
    const ny = c.y + Math.sin(c.dir) * CREATURE_SPEED * dt;
    // They never walk into you: battles only start when you walk into them.
    const h = biome.hero;
    if (Math.hypot(nx - h.x, ny - h.y) < 30 && Math.hypot(nx - h.x, ny - h.y) < Math.hypot(c.x - h.x, c.y - h.y)) {
      c.turnAt = 0;
      continue;
    }
    const inArea = ny > (areaTop(c.area) + 3) * T && ny < (areaTop(c.area) + SH - (c.area === 0 ? 5 : 1)) * T;
    if (inArea && feetFree(biome, nx, ny)) {
      c.x = nx;
      c.y = ny;
      c.flip = Math.cos(c.dir) > 0;
      c.moving = true;
    } else c.turnAt = 0;
  }
}

// A runaway critter (chase quests) runs from you once its quest is on,
// turning aside around obstacles, but stays in its own area.
function moveRunners(biome, dt) {
  const h = biome.hero;
  for (const r of biome.runners) {
    r.moving = false;
    if (r.caught || !progress.questState(biome.z, r.area).accepted) continue;
    const dx = r.x - h.x, dy = r.y - h.y;
    if (Math.hypot(dx, dy) > RUNNER_SCARE) continue;
    for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) {
      const a = Math.atan2(dy, dx) + turn;
      const nx = r.x + Math.cos(a) * RUNNER_SPEED * dt, ny = r.y + Math.sin(a) * RUNNER_SPEED * dt;
      const inArea = ny > (areaTop(r.area) + 3) * T && ny < (areaTop(r.area) + SH - 2) * T;
      if (inArea && feetFree(biome, nx, ny)) {
        r.x = nx;
        r.y = ny;
        r.flip = Math.cos(a) > 0;
        r.moving = true;
        break;
      }
    }
  }
}

// Townsfolk mostly stand about, taking a few steps now and then.
function moveFolk(biome, dt, now) {
  for (const f of biome.folk) {
    f.moving = false;
    if (now > f.turnAt) {
      f.dir = Math.random() < 0.8 ? null : Math.random() * Math.PI * 2;
      f.turnAt = now + 2500 + Math.random() * 3500;
    }
    if (f.dir === null) continue;
    if (Math.hypot(f.x - f.homeX, f.y - f.homeY) > FOLK_ROAM) f.dir = Math.atan2(f.homeY - f.y, f.homeX - f.x);
    const nx = f.x + Math.cos(f.dir) * FOLK_SPEED * dt, ny = f.y + Math.sin(f.dir) * FOLK_SPEED * dt;
    if (feetFree(biome, nx, ny)) {
      f.x = nx;
      f.y = ny;
      f.flip = Math.cos(f.dir) < 0;
      f.moving = true;
    } else f.turnAt = 0;
  }
}

// Which walk-cycle frame to show: cycles while moving, feet down when still.
// `msPerFrame` sets the pace; `offset` keeps everyone from stepping in sync.
const walkFrame = (moving, now, msPerFrame, offset = 0) => (moving ? Math.floor(now / msPerFrame + offset) % 4 : 0);
// How a walker moves: it bounces up 2 pixels on every step, and leans
// forward the way it's heading while it walks (1 = leaning right, -1 = left).
// Standing still: no bounce, no lean.
const stepLift = (frame) => (frame % 2 ? 2 : 0);
const lean = (moving, headingRight) => (moving ? (headingRight ? 1 : -1) : 0);

// ---------- The hero ----------

function moveHero(biome, dt) {
  const hero = biome.hero;
  let dx = 0, dy = 0;
  if (keys.has("left")) dx--;
  if (keys.has("right")) dx++;
  if (keys.has("up")) dy--;
  if (keys.has("down")) dy++;

  if (dx || dy) hero.path = []; // keys win over a tapped route
  else if (hero.path.length) {
    const next = hero.path[0];
    const ddx = next.x - hero.x, ddy = next.y - hero.y;
    const d = Math.hypot(ddx, ddy);
    if (d < 1.5) hero.path.shift();
    else (dx = ddx / d), (dy = ddy / d);
  }

  hero.moving = Boolean(dx || dy);
  if (!hero.moving) return;
  const step = (HERO_SPEED * dt) / Math.hypot(dx, dy);
  hero.dirX = dx;
  hero.dirY = dy;
  // Try each direction on its own, so you slide along walls.
  if (feetFree(biome, hero.x + dx * step, hero.y)) hero.x += dx * step;
  if (feetFree(biome, hero.x, hero.y + dy * step)) hero.y += dy * step;
  if (dx) hero.flip = dx < 0;
  // Breadcrumbs every 2 pixels walked, so buddies follow at a steady distance.
  const last = hero.trail[hero.trail.length - 1];
  if (!last || Math.hypot(hero.x - last.x, hero.y - last.y) >= 2) hero.trail.push({ x: hero.x, y: hero.y, flip: hero.flip });
  if (hero.trail.length > 40) hero.trail.shift();
}

const near = (a, b, dist) => Math.abs(a.x - b.x) < dist && b.y - a.y < 8 && a.y - b.y < dist + 6;

function checkTouch(biome, now) {
  const hero = biome.hero;

  // ✨ Coins: walk over them.
  for (const coin of biome.coins) {
    if (!coin.taken && near(coin, hero, 8)) {
      coin.taken = true;
      progress.addCoins(SPARKLE_COINS);
      renderCoins();
      floatText(`+${SPARKLE_COINS} 🪙`, coin);
    }
  }

  // ✨ Secrets: walk onto one to dig it up.
  for (const sc of biome.secrets) {
    if (!sc.found && near(sc, hero, 8)) {
      sc.found = true;
      progress.openChest(biome.z, sc.id);
      if (Math.random() < 0.5) {
        const coins = SECRET_COINS[0] + Math.floor(Math.random() * (SECRET_COINS[1] - SECRET_COINS[0]));
        progress.addCoins(coins);
        renderCoins();
        toast(`✨ You found a secret stash! +${coins} 🪙`);
      } else {
        const item = CONSUMABLES[1 + Math.floor(Math.random() * (CONSUMABLES.length - 1))];
        progress.addConsumable(item.id);
        toast(`✨ You found a secret stash: a ${item.name}!`);
      }
      floatText("✨", sc);
      announce("You found a secret!");
    }
  }

  // 🛣️ Walk off the side of the map on a road to go to the next zone.
  const exit = biome.exits.find((e) => Math.abs(hero.y - e.y) < 3 * T && (e.side === "left" ? hero.x < 1.5 * T : hero.x > W - 1.5 * T));
  if (exit) return takeRoute(biome, exit);

  // 🪧 Signposts: read one when you walk up to it.
  const sign = biome.signposts.find((s) => near(s, hero, 12));
  if (sign && sign !== biome.atSign) toast(`🪧 ${sign.text}`, 6000);
  biome.atSign = sign || null;

  // 🔐 Chests: sign the letter to open.
  const chest = biome.chests.find((c) => !c.open && near(c, hero, 9));
  if (chest && now > biome.safeUntil) return openChestPanel(biome, chest);

  // 🪨 Boulders: sign to smash. Scene props: see SCENES.
  const boulder = biome.boulders.find((b) => !b.broken && Math.abs(b.x - hero.x) < 22 && Math.abs(b.y - 16 - hero.y) < 22);
  if (boulder && now > biome.safeUntil) return smashBoulder(biome, boulder);
  const prop = biome.props.find((pr) => !pr.used && near(pr, hero, 15));
  if (prop && now > biome.safeUntil) return useProp(biome, prop);

  if (now < biome.safeUntil) return;

  // 🏛️ The Trial shrine.
  if (near(biome.trial, hero, 18)) return visitTrial(biome);
  if (near(biome.raid, hero, 18)) return visitRaid(biome);
  if (near(biome.motionTrial, hero, 14)) return visitMotionTrial(biome);

  // ⚔️ Trainers: walk up to one and they ask if you want to battle (you can
  // say not now). Beaten ones just chat.
  const trainer = biome.trainers.find((t) => near(t, hero, 14) && now > (t.restUntil || 0));
  if (trainer?.beaten) return say(biome, [[trainerSpeaker(trainer), trainer.chat]]);
  if (trainer) return askToBattle(biome, trainer, now);

  // 🎯 The mission: its giver, and its goals out in the clearings.
  if (biome.mission) {
    if (near(biome.mission.giver, hero, 12)) return talkToMissionGiver(biome);
    const goal = missionActive(biome) && missionGoals(biome).find((g) => near(g, hero, 12));
    if (goal) return touchGoal(biome, goal);
  }

  // 💬 Villagers: walk up to talk.
  const villager = biome.npcs.find((v) => near(v, hero, 12));
  if (villager) return talkTo(biome, villager);

  // 🗣️ Townsfolk: walk up for a chat.
  const local = biome.folk.find((f) => near(f, hero, 11));
  if (local) return say(biome, [[folkSpeaker(local), local.lines[local.said++ % local.lines.length]]]);

  // ✨ Lost things and 🃏 sign cards, once someone has asked you to find them.
  const item = biome.items.find((it) => !it.taken && itemWanted(biome, it) && near(it, hero, 10));
  if (item) return pickUpItem(biome, item);

  // 🐾 A runaway critter: catch it.
  const runner = biome.runners.find((r) => !r.caught && progress.questState(biome.z, r.area).accepted && near(r, hero, 12));
  if (runner) return catchRunner(biome, runner);
  for (const c of biome.creatures) {
    if (c.freed) continue; // healed creatures are friends now
    // Touching = close sideways, and the creature's feet anywhere from a bit
    // below the hero's feet up to about the hero's chest.
    const extra = c.boss ? 12 : 0;
    const dx = Math.abs(c.x - hero.x);
    const dy = c.y - hero.y; // negative when the creature is higher up
    if (dx > TOUCH_DISTANCE + extra || dy > 10 || dy < -(TOUCH_REACH_UP + extra)) continue;
    // Only when you're walking toward it: no surprise battles.
    if (!hero.moving || (hero.dirX || 0) * (c.x - hero.x) + (hero.dirY || 0) * (c.y - hero.y) <= 0) continue;

    const def = CREATURES.find((x) => x.id === c.id);
    const rarity = rarityOf(def);
    if (c.rare) toast(`🧭 A wandering ${def.name}! It's far from home.`);
    else if (!c.boss && rarity.weight <= RARITIES.epic.weight) toast(`✨ ${rarity.name} creature! A ${def.name} appears!`);
    startEncounter(biome, c);
    return;
  }
}

// ---------- Trainers ----------

const trainerSpeaker = (t) => ({ name: t.name, art: () => heroImg(t.look, null, "", true) });

// ❗ A trainer spots you: you freeze, they walk over (runSpot), and battle.
// A trainer asks if you want to battle. Battle: they step up and it starts.
// Not now: they leave you be for a while.
const ASK_AGAIN_MS = 15000;
function askToBattle(biome, t, now) {
  keys.clear();
  biome.hero.path = [];
  biome.hero.moving = false;
  biome.asking = t;
  const box = $("biome-ask");
  $("biome-ask-text").textContent = `${t.name}: "${t.ask || "Hey! Want to have a sign battle?"}"`;
  box.hidden = false;
  $("biome-ask-yes").focus();
  announce(`${t.name} asks: want to battle?`);
  const close = () => {
    box.hidden = true;
    biome.asking = null;
  };
  $("biome-ask-yes").onclick = () => {
    close();
    biome.spotted = { t, since: performance.now() - 900 }; // they step up, then it starts
  };
  $("biome-ask-no").onclick = () => {
    close();
    t.restUntil = performance.now() + ASK_AGAIN_MS;
    bumpBack(biome, performance.now());
  };
}

function runSpot(biome, now, dt) {
  const { t, since } = biome.spotted;
  if (now - since < 900) return; // the ❗ pops up first
  const hero = biome.hero;
  const dx = hero.x - t.x, dy = hero.y - t.y;
  const d = Math.hypot(dx, dy);
  if (d > 17) {
    const step = Math.min(d - 16, HERO_SPEED * dt);
    t.x += (dx / d) * step;
    t.y += (dy / d) * step;
    t.moving = true;
    return;
  }
  t.moving = false;
  biome.spotted = null;
  playLines([[trainerSpeaker(t), t.before]], () =>
    startEncounter(biome, {
      id: t.team[0].id,
      level: t.team[0].level,
      stage: progress.stageStars(biome.z, 0) > 0 ? 1 : 0,
      owner: t.name,
      team: t.team,
      prize: t.prize,
      look: t.look,
      trainer: t,
    }),
  );
}

function takeRoute(biome, exit) {
  const to = ZONES[exit.to];
  if (!progress.zoneUnlocked(exit.to)) {
    toast(`🔒 A wall of hex blocks the road to the ${to.name}. It isn't open yet!`);
    biome.hero.x += exit.side === "left" ? 2 * T : -2 * T;
    biome.hero.path = [];
    keys.clear();
    return;
  }
  // A quick fade, then you're on the matching road in the next zone.
  current = null;
  keys.clear();
  $("biome-wrap").classList.add("travel");
  announce(`Walking to the ${to.name}...`);
  setTimeout(() => {
    $("biome-wrap").classList.remove("travel");
    enterBiome(exit.to, biome.z);
  }, 450);
}

function bumpBack(biome, now) {
  biome.safeUntil = now + SAFE_MS;
  biome.hero.path = [];
  if (feetFree(biome, biome.hero.x, biome.hero.y + 10)) biome.hero.y += 10;
}

function startEncounter(biome, creature) {
  biome.fighting = creature;
  biome.hero.path = [];
  keys.clear();
  current = null; // stops the loop
  $("biome-wrap").classList.add("encounter");
  playBattleSting(creature.boss);
  setTimeout(() => {
    $("biome-wrap").classList.remove("encounter");
    const fight = () => playStage(biome.z, creature.stage, creature.id, creature.level, {
      owner: creature.owner, team: creature.team, prize: creature.prize, look: creature.look,
      area: creature.area, trial: creature.trial,
      pack: creature.guard !== undefined || creature.event ? false : undefined, // gate guards and story fights are one-on-one
    });
    if (creature.boss) playScene(`boss-${creature.id}`, fight);
    else fight();
  }, 600);
}

// screens.js calls this when a battle that started here is over.
export function biomeBattleOver(z, won) {
  const biome = biomes.get(z);
  const c = biome?.fighting;
  if (!c) return;
  biome.fighting = null;
  biome.safeUntil = performance.now() + SAFE_MS;
  biome.nextSpawn = performance.now() + RESPAWN_MS;
  if (c.trainer) {
    // Back to their spot. Beaten: they're done battling. Not: they'll spot you again in a bit.
    const t = c.trainer;
    t.x = t.homeX;
    t.y = t.homeY;
    if (won) {
      progress.beatTrainer(t.id);
      t.beaten = true;
    } else t.restUntil = performance.now() + 10000;
    pendingLines = { lines: [[trainerSpeaker(t), won ? t.after : "Ha! Train up and come find me again!"]] };
    return;
  }
  if (c.event) {
    biome.actors = [];
    const lost = c.event.type === "rook" ? [["rook", "Too slow, apprentice! See you around."]] : [["pip", "We'll get stronger. Malgrath won't win!"]];
    pendingLines = { lines: won ? c.event.after || [] : lost };
    return;
  }
  if (!won) return;

  // Freed creatures stay for a while, healed and happy (no more battles), then wander off.
  c.freed = true;
  c.freedUntil = performance.now() + 25000;
  if (!c.boss) c.home = false;
  if (c.boss) {
    pendingToast = `🏆 You beat ${CREATURES.find((x) => x.id === c.id).name}! The ${biome.zone.name} is safe.`;
  } else if (c.keeper !== undefined) {
    // A quest's keeper: what it guarded is free to take.
    progress.updateQuest(z, c.keeper, { keeperBeaten: true });
    pendingToast = "🛡️ The guard is freed, and it lets you through!";
  } else if (c.guard !== undefined) {
    // The guard quest is done: the villager thanks you, and the gate opens.
    const step = QUESTS[biome.zone.id].steps[c.guard];
    pendingLines = { lines: step.done, after: () => completeQuest(biome, c.guard) };
  } else {
    progress.addAreaWin(z, c.area);
    // A rescue quest here? Count it.
    const step = QUESTS[biome.zone.id]?.steps[c.area];
    const state = progress.questState(z, c.area);
    if (step?.type === "free" && state.accepted && !state.done) {
      progress.updateQuest(z, c.area, { count: state.count + 1 });
      const giver = biome.npcs.find((v) => v.area === c.area && v.role === "giver");
      pendingToast = state.count >= step.count ? `❓ That's ${step.count}! Go back to ${giver.name}.` : `🐾 Freed ${state.count} of ${step.count}!`;
    }
  }
}

// ---------- 🏛️ Trials ----------

// ⚔️ Raids: each zone's legendary raid creature (config.js kind "raid")
// stands by the path in the zone's first area, open to anyone, anytime.
// Walk up to it to start (or join) a co-op raid (raid.js): everyone at the
// same raid fights it together, and it's far too strong to beat alone.
// Winning a tier opens the next one (RAID_TIERS).
const raidOf = (biome) => CREATURES.find((c) => c.zone === biome.zone.id && c.kind === "raid");

function raidMarker(biome) {
  const tier = Math.min(progress.raidTier(biome.z), RAID_TIERS.length - 1);
  const raid = raidOf(biome);
  return { x: biome.raid.x, y: biome.raid.y - 52, html: `<small>⚔️ Raid ${RAID_TIERS[tier]}: ${raid?.name || ""}</small>`, cls: " chest trial" };
}

function visitRaid(biome) {
  const tierIndex = Math.min(progress.raidTier(biome.z), RAID_TIERS.length - 1);
  const raid = raidOf(biome);
  bumpBack(biome, performance.now());
  if (!raid) return;
  const trial = { tier: tierIndex + 1, name: RAID_TIERS[tierIndex] };
  keys.clear();
  biome.hero.path = [];
  biome.hero.moving = false;
  biome.asking = { name: "Raid" };
  const box = $("biome-ask");
  const label = $("biome-ask-yes").textContent;
  $("biome-ask-yes").textContent = "⚔️ Raid!";
  $("biome-ask-text").textContent = `⚔️ RAID ${trial.name}: ${raid.name}, a giant legend! It's WAY too strong to beat alone: everyone who walks up to it (or joins from the Arena) fights it with you. Win a 🥚 Raid ${trial.name} egg, which hatches into a rare creature! Ready?`;
  box.hidden = false;
  $("biome-ask-yes").focus();
  announce(`Raid ${trial.name}. ${raid.name}. Ready?`);
  const close = () => {
    box.hidden = true;
    $("biome-ask-yes").textContent = label;
    biome.asking = null;
  };
  $("biome-ask-yes").onclick = async () => {
    close();
    const z = biome.z;
    const joined = await openRaid({ raidId: raid.id, tier: trial.tier, onExit: () => enterBiome(z) });
    if (!joined) return toast("⚔️ Raids need the SignQuest server (serve.py), so friends can join you.", 5000);
    current = null; // the zone waits while you raid
  };
  $("biome-ask-no").onclick = () => {
    close();
    bumpBack(biome, performance.now());
  };
}

// 🗼 Trials: the portal opens the zone's Trial Tower (tower.js), to climb on your own, for Crests.
function trialMarker(biome) {
  const floor = progress.towerFloor(biome.z);
  const text = floor >= TOWER_FLOORS ? "🗼 Trial Tower: 👑 climbed" : `🗼 Trial Tower · Floor ${floor + 1}/${TOWER_FLOORS}`;
  return { x: biome.trial.x, y: biome.trial.y - 58, html: `<small>${text}</small>`, cls: " chest trial" };
}

function visitTrial(biome) {
  bumpBack(biome, performance.now());
  keys.clear();
  biome.hero.path = [];
  biome.hero.moving = false;
  const z = biome.z;
  current = null; // the zone waits while you climb
  openTower(z, () => enterBiome(z));
}

// ---------- 🌀 Moving-Sign Challenges ----------

function motionTrialMarker(biome) {
  const tier = progress.motionTier(biome.z);
  const text = tier >= MOTION_TRIALS.length ? "👑 Mastered" : `Moving Signs ${MOTION_TRIALS[tier].name}`;
  return { x: biome.motionTrial.x, y: biome.motionTrial.y - 26, html: `🌀<small>${text}</small>`, cls: " chest trial" };
}

function visitMotionTrial(biome) {
  const tier = progress.motionTier(biome.z);
  bumpBack(biome, performance.now());
  if (tier >= MOTION_TRIALS.length) return toast(`🌀 You've mastered every Moving-Sign Challenge here! 👑`, 4000);
  const trial = MOTION_TRIALS[tier];
  keys.clear();
  biome.hero.path = [];
  biome.asking = { name: "Moving-Sign Challenge" };
  $("biome-ask-text").textContent = `🌀 Moving-Sign Challenge ${trial.name}: sign ${trial.count} moving signs in a row, ${trial.seconds} seconds each. Win ${trial.coins} 🪙. Ready?`;
  const label = $("biome-ask-yes").textContent;
  $("biome-ask-yes").textContent = "🌀 Start!";
  $("biome-ask").hidden = false;
  $("biome-ask-yes").focus();
  announce(`Moving-Sign Challenge ${trial.name}. Sign ${trial.count} moving signs. Ready?`);
  const close = () => {
    $("biome-ask").hidden = true;
    $("biome-ask-yes").textContent = label;
    biome.asking = null;
  };
  $("biome-ask-yes").onclick = () => {
    close();
    // A random run of different moving signs.
    const signs = [...MOTION_SIGNS].sort(() => Math.random() - 0.5).slice(0, trial.count);
    const next = (k) => {
      if (k >= signs.length) {
        progress.beatMotionTrial(biome.z, trial.tier);
        progress.addCoins(trial.coins);
        renderCoins();
        toast(`🌀 Moving-Sign Challenge ${trial.name} complete! +${trial.coins} 🪙`, 4500);
        return announce(`Moving-Sign Challenge complete! You got ${trial.coins} coins.`);
      }
      openSignPanel(biome, {
        title: `🌀 Moving-Sign Challenge ${trial.name} · ${k + 1} of ${signs.length}: sign <b>${signs[k]}</b>!`, word: [signs[k]], limit: trial.seconds * 1000,
        onDone: () => next(k + 1),
        onFail: () => toast(`🌀 Out of time! Walk back to the shrine to try Moving-Sign Challenge ${trial.name} again.`, 4500),
      });
    };
    next(0);
  };
  $("biome-ask-no").onclick = () => {
    close();
    bumpBack(biome, performance.now());
  };
}

// ---------- Quests ----------

const questFor = (biome, area) => QUESTS[biome.zone.id]?.steps[area];
// A quest answer as signs: a moving word (HELLO, THANK YOU...) is one sign; anything else is spelled.
const asSigns = (word) => (word.length > 1 && MOTION_TIPS[word] ? [word] : word);
const shown = (word) => (word.length > 1 && MOTION_TIPS[word] ? word : word.split("").join(" "));
// What a collect quest gathers (`step.thing`): sign cards, unless the zone says otherwise.
const thingOf = (step) => ({ emoji: "🃏", name: "sign card", plural: "sign cards", ...step.thing });
// Quests done right there with the giver.
const HERE_QUESTS = ["riddle", "learn", "convo", "spot", "memory", "quiz", "chant", "simon", "mirror", "match"];
let pendingLines = null; // villager lines to play when you come back from a battle

// Turn quest lines into speakers the story box understands.
function speak(biome, lines) {
  const people = QUESTS[biome.zone.id].npcs;
  return lines.map(([who, text]) => {
    const v = people[who];
    return [v ? { name: v.name, art: () => heroImg(v.look, v.hat, "", Boolean(v.wand)) } : who, text];
  });
}

// Pause and play some lines, then carry on.
function say(biome, lines, after) {
  keys.clear();
  biome.hero.path = [];
  playLines(speak(biome, lines), () => {
    bumpBack(biome, performance.now());
    after?.();
  });
}

function talkTo(biome, v) {
  const step = questFor(biome, v.area);
  const state = progress.questState(biome.z, v.area);
  const giver = biome.npcs.find((n) => n.area === v.area && n.role === "giver");
  const receiver = biome.npcs.find((n) => n.area === v.area && n.role === "receiver");

  if (state.done) return say(biome, [[v.id, "Thanks again, Signkeeper! Good luck out there."]]);

  if (v.role === "receiver") {
    if (state.have) return say(biome, step.done, () => completeQuest(biome, v.area));
    return say(biome, [[v.id, `Oh, hello! I'm ${v.name}. I'm stuck up here until the hex is gone.`]]);
  }

  if (!state.accepted) {
    return say(biome, step.start, () => {
      progress.updateQuest(biome.z, v.area, { accepted: true, have: step.type === "deliver" });
      toast(`📜 New quest: ${step.title}`);
      if (step.type === "deliver") toast(`🎒 You got ${step.item}! Bring it to ${receiver.name}.`, 4000);
      if (step.timer) startRace(biome, v.area);
      if (step.type === "guard") spawnGateGuard(biome, v.area);
      if (RUN_QUESTS.includes(step.type)) startRun(biome, v.area);
      if (spawnKeeper(biome, v.area)) toast(`🛡️ Careful! A hexed creature is guarding it. Beat it first.`, 4500);
      startActivity(biome, v.area);
    });
  }

  // Already on this quest.
  if (startActivity(biome, v.area)) return;
  if (questReady(biome, v.area)) return say(biome, step.done, () => completeQuest(biome, v.area));
  // A race, a sneak, or a defense that didn't work out: try again.
  if (RUN_QUESTS.includes(step.type) && !state.have) {
    if (biome.run?.area === v.area) return say(biome, [[giver.id, "Go, go, go!"]]);
    return say(biome, [[giver.id, step.retry || "Let's try that again. Ready?"]], () => startRun(biome, v.area));
  }
  // A race you ran out of time on: try again.
  if (step.timer && biome.race?.area !== v.area) return say(biome, [[giver.id, step.retry || "Let's try that again. Ready? GO!"]], () => startRace(biome, v.area));
  const runner = biome.runners.find((r) => r.area === v.area);
  const thing = thingOf(step);
  const reminders = {
    free: `Only ${step.count - state.count} more to free! They're wandering around here somewhere.`,
    find: `Have you found ${step.item} yet? It's somewhere in this area. Follow the arrow!`,
    deliver: `Please hurry! ${receiver?.name} is waiting just up the path.`,
    guard: "The guard is right by the gate. You can do it!",
    collect: `${step.count - state.count} more ${step.count - state.count === 1 ? thing.name : thing.plural} to go! Look for ${thing.emoji}.`,
    chase: `${runner ? CREATURES.find((c) => c.id === runner.id).name : "It"} is still running loose! Corner it, then sign to calm it down.`,
    hide: `${step.item} is still hiding somewhere around here! Follow the arrow, and look for ${step.emoji}.`,
    garden: `The ${step.seed}s need planting, then a little time to grow. Come back when they're ready to pick!`,
    glow: `Remember the order: ${step.order?.join(", then ")}. And stay away from the hexed one!`,
    fish: `Stand on the dock and cast! ${need(step) - state.count} more to catch.`,
    ghosts: `${need(step) - state.count} ghosts are still drifting in the dark. Keep your lantern close!`,
    snowball: `Watch out, they're popping up all around! ${need(step) - state.count} more to splat.`,
    escort: state.following ? `${step.item} is right behind you. Lead him to the ${step.goal}!` : `${step.item} is hiding somewhere around here. Follow the arrow!`,
    stars: `${step.clue} Sign the stars in the right order. ${state.count} of ${need(step)} connected.`,
  };
  return say(biome, [[giver.id, reminders[step.type]]]);
}

// 👑 The zone's boss shows up by its landmark once every quest here is done
// (until it's beaten). Returns true if it just showed up.
const allQuestsDone = (biome) => (QUESTS[biome.zone.id]?.steps || []).every((_, a) => progress.questState(biome.z, a).done);
function spawnBoss(biome) {
  if (progress.bossBeaten(biome.z) || !allQuestsDone(biome) || biome.creatures.some((c) => c.boss)) return false;
  const boss = CREATURES.find((c) => c.zone === biome.zone.id && c.kind === "boss");
  if (!boss) return false;
  const level = creatureLevel(biome.z, BIOME_AREAS - 1) + BOSS_EXTRA_LEVELS;
  const { landmark } = biome;
  biome.creatures.push({ id: boss.id, stage: 2, boss: true, area: BIOME_AREAS - 1, level, x: W / 2 + landmark.w / 2 + 22, y: landmark.y + 3 * T, home: true });
  return true;
}

// ⚔️ A gate's guard, standing in the gateway (once you've taken its quest).
function spawnGateGuard(biome, area) {
  const at = biome.guardSpots[area];
  if (!at || biome.creatures.some((c) => c.guard === area)) return;
  const wild = CREATURES.filter((c) => c.zone === biome.zone.id && c.kind === "wild");
  biome.creatures.push({
    id: wild[area % wild.length].id,
    guard: area,
    stage: area === 0 ? 0 : 1, // the first guard is a letter battle, later ones are words
    area,
    level: creatureLevel(biome.z, area) + GUARD_EXTRA_LEVELS,
    ...at,
    home: true,
  });
}

// 🛡️ Keepers: a hexed creature stands guard by what a quest is after (a lost
// thing, the cards, the glowshroom path, Biscuit, the constellation). Beat it,
// and you can take it. Returns true if one showed up.
const KEEPER_QUESTS = ["find", "collect", "glow", "escort", "stars"];
const keeperOf = (biome, area) => biome.creatures.find((c) => c.keeper === area && !c.freed);
function spawnKeeper(biome, area) {
  const step = questFor(biome, area);
  const state = progress.questState(biome.z, area);
  if (!KEEPER_QUESTS.includes(step?.type) || !state.accepted || state.done || state.keeperBeaten || biome.creatures.some((c) => c.keeper === area)) return false;
  const target = biome.items.find((it) => it.area === area && !it.taken && it.kind !== "nest" && (step.type !== "stars" || it.k === 0));
  if (!target) return false;
  // Stand right beside it, on open ground.
  const at = [[14, 0], [-14, 0], [0, 10], [10, 8], [-10, 8]].map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy })).find((p) => feetFree(biome, p.x, p.y)) || { x: target.x + 14, y: target.y };
  const wild = CREATURES.filter((c) => c.zone === biome.zone.id && c.kind === "wild");
  biome.creatures.push({ id: wild[(area + 1) % wild.length].id, keeper: area, stage: 0, area, level: creatureLevel(biome.z, area) + 1, ...at, home: true });
  return true;
}

// ⏱️ Races: a collect quest with a `timer` (seconds). Run out of time, and
// everything you gathered goes back; talk to the giver to try again.
function startRace(biome, area) {
  const step = questFor(biome, area);
  progress.updateQuest(biome.z, area, { count: 0 });
  for (const it of biome.items) if (it.area === area && it.kind === "card") it.taken = false;
  biome.race = { area, until: performance.now() + step.timer * 1000 };
  toast(`⏱️ Go! ${step.timer} seconds to find ${step.count} ${thingOf(step).plural}!`, 3500);
}

function questClock(biome, now) {
  signatureClock(biome, now);
  const race = biome.race;
  if (!race || now < race.until) return;
  biome.race = null;
  const step = questFor(biome, race.area);
  const state = progress.questState(biome.z, race.area);
  if (state.done || state.count >= step.count) return;
  progress.updateQuest(biome.z, race.area, { count: 0 });
  for (const it of biome.items) if (it.area === race.area && it.kind === "card") it.taken = false;
  const giver = biome.npcs.find((v) => v.area === race.area && v.role === "giver");
  toast(`⏱️ Time's up! The ${thingOf(step).plural} slipped away. Talk to ${giver.name} to try again.`, 5000);
}

// Is the quest in `area` ready to hand in to its giver?
function questReady(biome, area) {
  const step = questFor(biome, area);
  const state = progress.questState(biome.z, area);
  if (COUNT_QUESTS.includes(step.type)) return state.count >= need(step);
  return ["find", "chase", "hide", "escort", ...RUN_QUESTS].includes(step.type) && state.have;
}

// Quests that happen right there with the giver: a riddle, a lesson, a
// signed conversation, or spot-the-sign. Starts it and returns true.
function startActivity(biome, area) {
  const step = questFor(biome, area);
  const finish = () => say(biome, step.done, () => completeQuest(biome, area));
  const giver = biome.npcs.find((n) => n.area === area && n.role === "giver");
  if (step.type === "riddle") askRiddle(biome, area);
  else if (step.type === "learn") {
    // The giver shows you a sign (its hand picture and how to make it); you copy it.
    // `move`: a moving sign they teach you too, like HELLO.
    const signs = [...step.word.split(""), ...(step.move ? [step.move] : [])];
    openSignPanel(biome, { title: `📖 ${giver.name} shows you how to sign <b>${signs.join(", then ")}</b>. Copy it!`, word: signs, onDone: finish });
  } else if (step.type === "convo") converse(biome, area, 0, finish);
  else if (step.type === "spot") {
    biome.spotOpen = true;
    keys.clear();
    biome.hero.path = [];
    const people = Object.values(QUESTS[biome.zone.id].npcs).map((v) => ({ name: v.name, art: heroImg(v.look, v.hat, "", Boolean(v.wand)) }));
    openSpotPanel({
      title: `👀 ${step.prompt}`, people, letters: biome.zone.letters, rounds: step.rounds || 2,
      onDone: () => {
        biome.spotOpen = false;
        finish();
      },
    });
  } else if (step.type === "memory") {
    // The giver signs a sequence; you sign it back from memory.
    const shown = step.word.split("").join(" · ");
    say(biome, [[giver.id, `Watch closely... ${shown}`], [giver.id, "Now sign it back to me, in the same order. No peeking!"]], () =>
      openSignPanel(biome, { title: `🧠 From memory: <b>${step.word.split("").map(() => "_").join(" ")}</b>`, word: step.word, reveal: true, onDone: finish }),
    );
  } else if (step.type === "simon") simon(biome, area, 0, finish);
  else if (step.type === "mirror") mirror(biome, area, 0, 0, finish);
  else if (step.type === "match") matchGame(biome, area, finish);
  else if (step.type === "quiz") quiz(biome, area, 0, finish);
  else if (step.type === "chant") chant(biome, area, 0, finish);
  else return false;
  return true;
}

// 🔔 Simon says: the chime rings a pattern (step.rounds, longer each time);
// echo it back from memory.
function simon(biome, area, k, finish) {
  const step = questFor(biome, area);
  if (k >= step.rounds.length) return finish();
  const giver = biome.npcs.find((n) => n.area === area && n.role === "giver");
  const pattern = step.rounds[k];
  say(biome, [[giver.id, `🔔 Round ${k + 1} of ${step.rounds.length}. The chime rings: ${pattern.split("").join(" · ")}`]], () =>
    openSignPanel(biome, { title: `🔔 Echo the chime: <b>${pattern.split("").map(() => "_").join(" ")}</b>`, word: pattern, reveal: true, onDone: () => simon(biome, area, k + 1, finish) }),
  );
}

// 🪞 Mirror: the giver signs (you only see the hand picture); copy it fast.
// `rounds` signs; get `need` of them right.
function mirror(biome, area, k, wins, finish) {
  const step = questFor(biome, area);
  const giver = biome.npcs.find((n) => n.area === area && n.role === "giver");
  const rounds = step.rounds || 5, needed = step.need || 4;
  if (k >= rounds) {
    if (wins >= needed) return finish();
    return say(biome, [[giver.id, `${wins} of ${rounds}! So close. Let's go again!`]], () => mirror(biome, area, 0, 0, finish));
  }
  const pool = biome.zone.letters.filter((l) => !MOTION_TIPS[l]);
  const letter = pool[Math.floor(Math.random() * pool.length)];
  openSignPanel(biome, {
    title: `🪞 ${giver.name} signs this. Copy it! (${k + 1} of ${rounds} · ${wins} right)`, word: letter, picture: true, limit: MIRROR_MS,
    onDone: () => mirror(biome, area, k + 1, wins + 1, finish),
    onFail: () => mirror(biome, area, k + 1, wins, finish),
  });
}

// 🃏 Match: flip cards to pair each letter with its handshape, then sign them.
function matchGame(biome, area, finish) {
  const step = questFor(biome, area);
  const pool = biome.zone.letters.filter((l) => !MOTION_TIPS[l]).sort(() => Math.random() - 0.5);
  const letters = pool.slice(0, step.pairs || 4);
  const cards = [...letters.map((l) => ({ l, hand: false })), ...letters.map((l) => ({ l, hand: true }))].sort(() => Math.random() - 0.5);
  keys.clear();
  biome.hero.path = [];
  biome.spotOpen = true;
  const panel = document.createElement("div");
  panel.className = "card chest-panel match-panel";
  panel.innerHTML = `<p class="chest-title">🃏 ${step.prompt || "Match each letter to its handshape!"}</p><div class="match-grid"></div><p class="status" aria-live="polite">Flip two cards.</p>`;
  $("biome-wrap").append(panel);
  const grid = panel.querySelector(".match-grid");
  let open = [], matched = 0, busy = false;
  cards.forEach((card) => {
    const btn = document.createElement("button");
    btn.className = "match-card";
    btn.type = "button";
    btn.setAttribute("aria-label", "A face-down card");
    btn.innerHTML = "❔";
    card.btn = btn;
    btn.onclick = () => {
      if (busy || card.done || open.includes(card)) return;
      btn.innerHTML = card.hand ? `<img src="assets/hands/${card.l}.svg" alt="Handshape for ${card.l}">` : `<b>${card.l}</b>`;
      btn.classList.add("up");
      open.push(card);
      if (open.length < 2) return;
      const [a, b] = open;
      open = [];
      if (a.l === b.l && a.hand !== b.hand) {
        a.done = b.done = true;
        a.btn.classList.add("done");
        b.btn.classList.add("done");
        matched++;
        panel.querySelector(".status").textContent = `A match! ${matched} of ${letters.length}.`;
        if (matched === letters.length) {
          setTimeout(() => {
            panel.remove();
            biome.spotOpen = false;
            openSignPanel(biome, { title: `🃏 All matched! Now sign them: <b>${letters.join(" ")}</b>`, word: letters.join(""), onDone: finish });
          }, 700);
        }
      } else {
        busy = true;
        panel.querySelector(".status").textContent = "Not a pair. Try again!";
        setTimeout(() => {
          for (const c of [a, b]) {
            c.btn.innerHTML = "❔";
            c.btn.classList.remove("up");
          }
          busy = false;
        }, 900);
      }
    };
    grid.append(btn);
  });
}

// A true-or-false quiz (step.qs: [[statement, true/false, why], ...]). A wrong
// answer gets explained, and you try that one again.
function quiz(biome, area, k, finish) {
  const step = questFor(biome, area);
  if (k >= step.qs.length) return finish();
  const giver = biome.npcs.find((n) => n.area === area && n.role === "giver");
  const [statement, answer, why] = step.qs[k];
  keys.clear();
  biome.hero.path = [];
  biome.asking = { name: giver.name };
  const box = $("biome-ask"), yes = $("biome-ask-yes"), no = $("biome-ask-no");
  const labels = [yes.textContent, no.textContent];
  $("biome-ask-text").textContent = `${step.icon || "❓"} ${giver.name} (${k + 1} of ${step.qs.length}): True or false? ${statement}`;
  yes.textContent = "✅ True";
  no.textContent = "❌ False";
  box.hidden = false;
  yes.focus();
  announce(`True or false? ${statement}`);
  const pick = (guess) => {
    box.hidden = true;
    biome.asking = null;
    [yes.textContent, no.textContent] = labels;
    if (guess === answer) say(biome, [[giver.id, `${answer ? "True" : "False"}! ${why}`]], () => quiz(biome, area, k + 1, finish));
    else say(biome, [[giver.id, `Not quite! ${why} Let's try that one again.`]], () => quiz(biome, area, k, finish));
  };
  yes.onclick = () => pick(true);
  no.onclick = () => pick(false);
}

// A chant: sign a list of words in order (step.words: [[word, what it is], ...]),
// like the ingredients of a potion or the lines of a spell.
function chant(biome, area, k, finish) {
  const step = questFor(biome, area);
  if (k >= step.words.length) return finish();
  const [word, what] = step.words[k];
  openSignPanel(biome, { title: `${step.icon || "✨"} ${step.verb || "Sign"} ${k + 1} of ${step.words.length}: ${what}. Sign <b>${shown(word)}</b>!`, word: asSigns(word), onDone: () => chant(biome, area, k + 1, finish) });
}

// ---------- 🌟 Signature quests: each kind is played in one zone only ----------
//   garden   (Meadow)       plant seeds, wait while they grow, then harvest
//   glow     (Glowshroom)   light the mushrooms in the color `order` you're told;
//                           a wrong one (or the hexed decoy) puts them all out
//   fish     (Coral Lagoon) cast from the dock, wait for a bite, sign fast
//   ghosts   (Haunted)      the area goes dark: hunt drifting ghosts by lantern light
//   snowball (Aurora)       snowmen pop up around you; sign before they throw
//   simon    (Thunder)      echo the wind chime's patterns, longer each time
//   escort   (Crown Keep)   find the runaway chick, then lead it home to the nest
//   stars    (Cosmic Rift)  sign the stars in the right order to draw a constellation
//                           (they spell the answer to the giver's riddle)
// (Magma Canyon's is the lava-vent race: a collect quest with a `timer`.)
//
// And some kinds that move and play differently from "go get it":
//   race     race the villager to the 🚩 flag (they know the way, and they're quick)
//   follow   sneak after your guide to the hideout; stay close, and keep out of
//            sight of the hexed eyes 👁️ on patrol, or it's back to the start
//   defend   hexed critters rush at something; sign to drive them off, and
//            hold out for `seconds` (3 get through and you start over)
//   mirror   the villager signs (just the hand picture); copy each one fast
//   match    a memory game: pair each letter with its handshape, then sign them

const LIGHT_R = 46; // how far your lantern reaches in the dark (game pixels)
const RACE_SPEED = HERO_SPEED * 0.84; // your rival in a race: nearly as quick as you
const GUIDE_SPEED = 34; // a guide sneaking ahead of you
const FOLLOW_NEAR = 54; // the guide only moves on while you're this close...
const FOLLOW_LOST = 150; // ...and loses you this far behind
const WATCH_SEE = 24; // a hexed eye spots you this close
const RAIDER_SPEED = 11; // hexed critters rushing in (defend)
const RAID_SIGN_MS = 3500; // to drive one off once you reach it
const MIRROR_MS = 6000; // to copy each sign in a mirror quest
const RUN_QUESTS = ["race", "follow", "defend"]; // they start when you take them (or try again)
const SHROOM_COLORS = { blue: "#7fe3ff", pink: "#ff8ad8", gold: "#ffd23f", green: "#7fffa0", hexed: "#b04ae8" };
const SNOWMAN_MS = 4500; // a snowman throws if you don't get to it in time...
const SNOWBALL_SIGN_MS = 4000; // ...or sign fast enough once you're there
const BITE_SIGN_MS = 4500;
const need = (step) => (step.type === "glow" ? step.order.length : step.type === "stars" ? step.word.length : step.count);
const COUNT_QUESTS = ["free", "collect", "garden", "glow", "fish", "ghosts", "snowball", "stars"];
const randomLetter = (biome) => biome.zone.letters[Math.floor(Math.random() * biome.zone.letters.length)];

// Where a signature quest's things go, when the zone is built.
function placeSignature(biome, step, a, state, spot, letters) {
  const L = (k) => letters[(a * 7 + k * 3) % letters.length];
  if (step.type === "garden") {
    for (let k = 0; k < step.count; k++) {
      const p = spot(a, 580 + k * 7, false);
      if (p) biome.items.push({ area: a, kind: "plot", k, letter: L(k), taken: state.plots?.[k] === "picked", ...p });
    }
  } else if (step.type === "glow") {
    [...step.order, "hexed"].forEach((color, k) => {
      const p = spot(a, 600 + k * 7, false);
      if (p) biome.items.push({ area: a, kind: "shroom", color, letter: L(k), taken: step.order.indexOf(color) > -1 && step.order.indexOf(color) < state.count, ...p });
    });
  } else if (step.type === "fish") {
    const p = spot(a, 620, true);
    if (p) biome.items.push({ area: a, kind: "dock", letter: L(0), ...p });
  } else if (step.type === "ghosts") {
    for (let k = 0; k < step.count; k++) {
      const p = spot(a, 640 + k * 7, false);
      if (p) biome.items.push({ area: a, kind: "ghost", letter: L(k), taken: k < state.count, homeX: p.x, homeY: p.y, ...p });
    }
  } else if (step.type === "escort") {
    const p = spot(a, 660, false, "low"), nest = spot(a, 670, false, "high");
    if (p && nest) {
      biome.items.push({ area: a, kind: "chick", name: step.item, emoji: step.emoji, letter: L(0), taken: Boolean(state.following || state.have), ...p });
      biome.items.push({ area: a, kind: "nest", emoji: step.goalEmoji, letter: L(1), ...nest });
    }
  } else if (step.type === "race") {
    const p = spot(a, 720, false, "high");
    if (p) biome.items.push({ area: a, kind: "flag", letter: L(0), ...p });
  } else if (step.type === "follow") {
    const end = spot(a, 730, false, "high");
    if (end) biome.items.push({ area: a, kind: "den", emoji: step.goalEmoji, letter: L(1), ...end });
    for (let k = 0; k < (step.watchers ?? 2); k++) {
      const p = spot(a, 740 + k * 9, false);
      if (p) biome.items.push({ area: a, kind: "watcher", homeX: p.x, homeY: p.y, phase: k * 2.1, ...p });
    }
  } else if (step.type === "stars") {
    step.word.split("").forEach((letter, k) => {
      const p = spot(a, 680 + k * 9, false);
      if (p) biome.items.push({ area: a, kind: "star", letter, k, taken: k < state.count, ...p });
    });
  }
}

// Walked up to one of a signature quest's things. Returns true if it handled it.
function touchSignature(biome, item) {
  const step = questFor(biome, item.area);
  const state = progress.questState(biome.z, item.area);
  const giver = biome.npcs.find((v) => v.area === item.area && v.role === "giver");
  const now = performance.now();
  const add = (n = 1) => {
    const count = progress.questState(biome.z, item.area).count + n;
    progress.updateQuest(biome.z, item.area, { count });
    return count;
  };

  if (item.kind === "plot") {
    const plots = { ...(state.plots || {}) };
    const planted = plots[item.k];
    if (planted == null) {
      return openSignPanel(biome, {
        title: `🌱 An empty garden bed. Sign <b>${item.letter}</b> to plant a ${step.seed}.`, word: item.letter,
        onDone: () => {
          plots[item.k] = Date.now();
          progress.updateQuest(biome.z, item.area, { plots });
          toast(`🌱 Planted! It'll take about ${Math.round(step.growMs / 1000)} seconds to grow.`, 4000);
        },
      });
    }
    const left = planted + step.growMs - Date.now();
    if (left > 0) {
      toast(`🌿 Still growing... about ${Math.ceil(left / 1000)} more seconds.`, 2500);
      return bumpBack(biome, now);
    }
    return openSignPanel(biome, {
      title: `${step.crop} It's ready! Sign <b>${item.letter}</b> to pick it.`, word: item.letter,
      onDone: () => {
        item.taken = true;
        plots[item.k] = "picked";
        progress.updateQuest(biome.z, item.area, { plots });
        const count = add();
        toast(count >= step.count ? `${step.crop} That's the whole harvest! Bring it to ${giver.name}.` : `${step.crop} Picked ${count} of ${step.count}!`, 4000);
      },
    });
  }

  if (item.kind === "shroom") {
    const name = item.color === "hexed" ? "purple-black" : item.color;
    return openSignPanel(biome, {
      title: `🍄 A ${name} glowshroom. Sign <b>${item.letter}</b> to light it.`, word: item.letter,
      onDone: () => {
        const next = step.order[state.count];
        if (item.color === next) {
          item.taken = true;
          const count = add();
          toast(count >= step.order.length ? `✨ The whole path is glowing! Go tell ${giver.name}.` : `✨ The ${item.color} one glows! Next: ${step.order[count]}.`, 4000);
          return;
        }
        for (const it of biome.items) if (it.area === item.area && it.kind === "shroom") it.taken = false;
        progress.updateQuest(biome.z, item.area, { count: 0 });
        toast(item.color === "hexed" ? `💜 That one was hexed! Every glow went out. Start again with ${step.order[0]}.` : `💨 Wrong order! The glow fades. Start again with ${step.order[0]}.`, 4500);
      },
    });
  }

  if (item.kind === "dock") {
    if (biome.fishing) return true;
    biome.fishing = { item, biteAt: now + 2000 + Math.random() * 3500 };
    toast("🎣 You cast your line... wait for a bite! (Stay by the dock.)", 3000);
    return true;
  }

  if (item.kind === "ghost") {
    return openSignPanel(biome, {
      title: `👻 Caught in your lantern light! Sign <b>${item.letter}</b> to send it home.`, word: item.letter,
      onDone: () => {
        item.taken = true;
        const count = add();
        toast(count >= step.count ? `🏮 That's every ghost! Go tell ${giver.name}.` : `👻 Whoosh! ${count} of ${step.count} sent home.`, 4000);
      },
    });
  }

  if (item.kind === "snowman") {
    return openSignPanel(biome, {
      title: `⛄ Sign <b>${item.letter}</b> before it throws!`, word: item.letter, limit: SNOWBALL_SIGN_MS,
      onDone: () => {
        biome.items = biome.items.filter((it) => it !== item);
        const count = add();
        toast(count >= step.count ? `💥 SPLAT! You won the snowball fight! Go tell ${giver.name}.` : `💥 SPLAT! ${count} of ${step.count}!`, 3500);
      },
      onFail: () => {
        biome.items = biome.items.filter((it) => it !== item);
        toast("❄️ Whumpf! You got snowballed. Get the next one!", 3000);
      },
    });
  }

  if (item.kind === "chick") {
    return openSignPanel(biome, {
      title: `${item.emoji} There you are, ${item.name}! Sign <b>${item.letter}</b> so he trusts you.`, word: item.letter,
      onDone: () => {
        item.taken = true;
        progress.updateQuest(biome.z, item.area, { following: true });
        toast(`${item.emoji} ${item.name} is following you! Lead him to the ${step.goalEmoji} ${step.goal}.`, 4500);
      },
    });
  }

  if (item.kind === "nest") {
    if (!state.following || state.have) return bumpBack(biome, now);
    return openSignPanel(biome, {
      title: `${item.emoji} Home at last! Sign <b>${item.letter}</b> to tuck ${step.item} in.`, word: item.letter,
      onDone: () => {
        progress.updateQuest(biome.z, item.area, { have: true, following: false });
        toast(`${step.emoji} ${step.item} is home safe! Go tell ${giver.name}.`, 4000);
      },
    });
  }

  if (item.kind === "raider") {
    return openSignPanel(biome, {
      title: `${item.emoji} Sign <b>${item.letter}</b> to drive it off!`, word: item.letter, limit: RAID_SIGN_MS,
      onDone: () => {
        biome.items = biome.items.filter((it) => it !== item);
        floatText("💨", item);
      },
      onFail: () => toast(`${item.emoji} Too slow! It's still coming!`, 2000),
    });
  }
  // The flag, the hideout, and the eyes are just there to see.
  if (["flag", "den", "watcher"].includes(item.kind)) return true;

  if (item.kind === "star") {
    if (item.k !== state.count) {
      biome.starMisses = (biome.starMisses || 0) + 1;
      // After a couple of wrong stars, a hint: the next letter.
      toast(biome.starMisses >= 2 ? `⭐ Not that one yet. Hint: the next star is ${step.word[state.count]}.` : "⭐ That star doesn't come next. What word do the stars spell?", 3500);
      return bumpBack(biome, now);
    }
    return openSignPanel(biome, {
      title: `⭐ Sign <b>${item.letter}</b> to connect this star.`, word: item.letter,
      onDone: () => {
        item.taken = true;
        biome.starMisses = 0;
        const count = add();
        toast(count >= step.word.length ? `✨ The constellation lights up: ${step.word}! Go tell ${giver.name}.` : `⭐ Connected ${count} of ${step.word.length}!`, 4000);
      },
    });
  }
  return false;
}

// 🏁 Races, sneaking after a guide, and defending start when you take the
// quest (or try again). One runs at a time (biome.run).
function startRun(biome, area) {
  const step = questFor(biome, area);
  const giver = biome.npcs.find((v) => v.area === area && v.role === "giver");
  const now = performance.now();
  if (!giver) return;
  giver.homeX ??= giver.x;
  giver.homeY ??= giver.y;
  const route = (to) => findPath(biome, tileOf(giver.x), tileOf(giver.y - 1), tileOf(to.x), tileOf(to.y - 1));
  if (step.type === "race") {
    const flag = biome.items.find((it) => it.area === area && it.kind === "flag");
    if (!flag) return;
    biome.run = { type: "race", area, giver, flag, go: now + 3000, path: route(flag) };
    toast(`🏁 Race ${giver.name} to the 🚩 flag! Ready... 3... 2... 1...`, 2900);
  } else if (step.type === "follow") {
    const den = biome.items.find((it) => it.area === area && it.kind === "den");
    if (!den) return;
    biome.run = { type: "follow", area, giver, den, path: route(den) };
    toast(`👣 Follow ${giver.name}, and stay close! Keep away from the 👁️ hexed eyes.`, 4500);
  } else if (step.type === "defend") {
    biome.run = { type: "defend", area, at: { x: giver.x, y: giver.y }, until: now + step.seconds * 1000, hp: 3, next: now + 1500 };
    toast(`🛡️ Protect ${step.target} for ${step.seconds} seconds! Walk into the ${step.raiderName} and sign to drive them off.`, 5000);
  }
}

function endRun(biome, won, message) {
  const run = biome.run;
  if (!run) return;
  biome.run = null;
  biome.items = biome.items.filter((it) => it.kind !== "raider");
  if (run.giver) {
    run.giver.x = run.giver.homeX;
    run.giver.y = run.giver.homeY;
    run.giver.moving = false;
  }
  const step = questFor(biome, run.area);
  if (!won) return toast(message, 5000);
  progress.updateQuest(biome.z, run.area, { have: true });
  toast(message, 3500);
  say(biome, step.done, () => completeQuest(biome, run.area));
}

// Walk someone along a route, `speed` pixels a second. True once they're there.
function walkRoute(who, path, speed, dt) {
  let left = speed * dt;
  while (left > 0 && path.length) {
    const t = path[0];
    const dx = t.x - who.x, dy = t.y - who.y, d = Math.hypot(dx, dy);
    if (d <= left) {
      who.x = t.x;
      who.y = t.y;
      path.shift();
      left -= d;
    } else {
      who.x += (dx / d) * left;
      who.y += (dy / d) * left;
      who.flip = dx < 0;
      left = 0;
    }
  }
  who.moving = path.length > 0;
  return !path.length;
}

function runClock(biome, now) {
  const run = biome.run;
  const hero = biome.hero;
  // Hexed eyes always patrol, back and forth.
  for (const w of biome.items) if (w.kind === "watcher") w.x = w.homeX + Math.sin(now / 900 + w.phase) * 30;
  if (!run) return;
  const dt = Math.min(0.05, (now - (run.last || now)) / 1000);
  run.last = now;
  const step = questFor(biome, run.area);
  if (run.type === "race") {
    if (now < run.go) return;
    if (!run.started) {
      run.started = true;
      toast("🏁 GO!", 1200);
    }
    if (near(run.flag, hero, 14)) return endRun(biome, true, `🏆 You beat ${run.giver.name} to the flag!`);
    if (walkRoute(run.giver, run.path, RACE_SPEED, dt)) endRun(biome, false, `🏁 ${run.giver.name} got there first! Talk to them for a rematch.`);
  } else if (run.type === "follow") {
    const d = Math.hypot(hero.x - run.giver.x, hero.y - run.giver.y);
    const spotted = biome.items.find((w) => w.kind === "watcher" && w.area === run.area && Math.hypot(w.x - hero.x, w.y - hero.y) < WATCH_SEE);
    if (spotted) return endRun(biome, false, `👁️ Spotted! The hexed eye saw you. Talk to ${run.giver.name} to try again.`);
    if (d > FOLLOW_LOST) return endRun(biome, false, `👣 ${run.giver.name} lost you! Talk to them to try again.`);
    if (d > FOLLOW_NEAR) {
      run.giver.moving = false; // waits for you to catch up
      return;
    }
    if (walkRoute(run.giver, run.path, GUIDE_SPEED, dt)) endRun(biome, true, `${step.goalEmoji} You made it to the hideout, unseen!`);
  } else if (run.type === "defend") {
    if (now >= run.until) return endRun(biome, true, `🛡️ You held them off! ${step.target} is safe.`);
    if (now >= run.next) {
      run.next = now + (step.every || 2200);
      for (let tries = 0; tries < 12; tries++) {
        const angle = Math.random() * Math.PI * 2, dist = 80 + Math.random() * 30;
        const x = run.at.x + Math.cos(angle) * dist, y = run.at.y + Math.sin(angle) * dist * 0.7;
        if (feetFree(biome, x, y)) {
          biome.items.push({ area: run.area, kind: "raider", emoji: step.raider, letter: randomLetter(biome), x, y });
          break;
        }
      }
    }
    for (const r of biome.items.filter((it) => it.kind === "raider")) {
      const dx = run.at.x - r.x, dy = run.at.y - r.y, d = Math.hypot(dx, dy);
      if (d < 8) {
        biome.items = biome.items.filter((it) => it !== r);
        run.hp--;
        if (run.hp <= 0) return endRun(biome, false, `💥 They got through! Talk to ${biome.npcs.find((v) => v.area === run.area && v.role === "giver").name} to try again.`);
        toast(`💥 A ${step.raiderName.replace(/s$/, "")} got through! ${"❤️".repeat(run.hp)} left`, 2500);
      } else {
        r.x += (dx / d) * RAIDER_SPEED * dt;
        r.y += (dy / d) * RAIDER_SPEED * dt;
      }
    }
  }
}

// Every frame: fish biting, ghosts drifting, snowmen popping up, the chick following.
function signatureClock(biome, now) {
  runClock(biome, now);
  const hero = biome.hero;
  // 🎣 A bite! Sign fast, before it gets away.
  const fishing = biome.fishing;
  if (fishing) {
    if (!near(fishing.item, hero, 26)) {
      biome.fishing = null;
      toast("🎣 You reeled in your line.", 2000);
    } else if (now >= fishing.biteAt) {
      biome.fishing = null;
      const step = questFor(biome, fishing.item.area);
      const giver = biome.npcs.find((v) => v.area === fishing.item.area && v.role === "giver");
      const fish = ["🐟", "🐠", "🐡"][Math.floor(Math.random() * 3)];
      const letter = randomLetter(biome);
      openSignPanel(biome, {
        title: `${fish} BITE! Sign <b>${letter}</b> fast to reel it in!`, word: letter, limit: BITE_SIGN_MS,
        onDone: () => {
          const count = progress.questState(biome.z, fishing.item.area).count + 1;
          progress.updateQuest(biome.z, fishing.item.area, { count });
          toast(count >= step.count ? `${fish} What a catch! That's ${step.count}. Go show ${giver.name}.` : `${fish} Caught one! ${count} of ${step.count}. Cast again!`, 4000);
        },
        onFail: () => toast("💨 It got away! Cast again.", 3000),
      });
      return;
    }
  }
  const here = areaOf(hero.y);
  const step = questFor(biome, here);
  const state = step && progress.questState(biome.z, here);
  if (!step || !state.accepted || state.done) return;
  // 👻 Ghosts drift about near where they haunt.
  if (step.type === "ghosts") {
    for (const g of biome.items) {
      if (g.kind !== "ghost" || g.taken || g.area !== here) continue;
      if (!g.goal || Math.hypot(g.goal.x - g.x, g.goal.y - g.y) < 2) g.goal = { x: g.homeX + (Math.random() - 0.5) * 50, y: g.homeY + (Math.random() - 0.5) * 30 };
      const dx = g.goal.x - g.x, dy = g.goal.y - g.y, d = Math.hypot(dx, dy) || 1;
      if (feetFree(biome, g.x + (dx / d) * 0.25, g.y + (dy / d) * 0.25)) (g.x += (dx / d) * 0.25), (g.y += (dy / d) * 0.25);
      else g.goal = null;
    }
  }
  // ⛄ Snowmen pop up around you; get to one and sign before it throws.
  if (step.type === "snowball" && state.count < step.count) {
    const snowman = biome.items.find((it) => it.kind === "snowman");
    if (snowman && now > snowman.until && biome.chest == null) {
      biome.items = biome.items.filter((it) => it !== snowman);
      toast("❄️ Whumpf! A snowball got you. Get the next one!", 3000);
      biome.nextSnow = now + 2000;
    } else if (!snowman && now > (biome.nextSnow || 0)) {
      for (let tries = 0; tries < 12; tries++) {
        const angle = Math.random() * Math.PI * 2, dist = 26 + Math.random() * 16;
        const x = hero.x + Math.cos(angle) * dist, y = hero.y + Math.sin(angle) * dist * 0.7;
        if (areaOf(y) === here && feetFree(biome, x, y)) {
          biome.items.push({ area: here, kind: "snowman", letter: randomLetter(biome), x, y, until: now + SNOWMAN_MS });
          biome.nextSnow = now + 2500;
          break;
        }
      }
    }
  }
}

// The dark of the ghost hunt, and the lines of the constellation.
function drawSignature(biome, ctx, camX, camY) {
  const hero = biome.hero;
  for (let area = 0; area < BIOME_AREAS; area++) {
    const step = questFor(biome, area);
    if (step?.type !== "stars") continue;
    const count = progress.questState(biome.z, area).count;
    const stars = biome.items.filter((it) => it.kind === "star" && it.area === area).sort((a, b) => a.k - b.k);
    const at = (s) => [s.x - camX, s.y - 6 - camY];
    // The lines joined so far: a soft glow, then a bright core.
    for (const [width, color] of [[4, "rgba(255, 224, 102, 0.25)"], [1.5, "rgba(255, 244, 192, 0.95)"]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      stars.slice(0, count).forEach((s, i) => (i ? ctx.lineTo(...at(s)) : ctx.moveTo(...at(s))));
      ctx.stroke();
    }
    // Every star twinkles where it is: joined ones bright gold, the rest pale.
    for (const s of stars) {
      const [x, y] = at(s);
      const lit = s.k < count;
      ctx.fillStyle = lit ? "rgba(255, 224, 102, 0.35)" : "rgba(200, 210, 255, 0.18)";
      ctx.beginPath();
      ctx.arc(x, y, lit ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = lit ? "#fff4c0" : "#c8d0ff";
      ctx.fillRect(x - 0.5, y - 2.5, 1, 5);
      ctx.fillRect(x - 2.5, y - 0.5, 5, 1);
    }
  }
  if (biome.run?.type === "follow") {
    ctx.strokeStyle = "rgba(255, 74, 110, 0.55)";
    ctx.lineWidth = 1;
    for (const w of biome.items) {
      if (w.kind !== "watcher" || w.area !== biome.run.area) continue;
      ctx.beginPath();
      ctx.ellipse(w.x - camX, w.y - 2 - camY, WATCH_SEE, WATCH_SEE * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const here = areaOf(hero.y);
  const step = questFor(biome, here);
  const state = step && progress.questState(biome.z, here);
  if (step?.type === "ghosts" && state.accepted && !state.done) {
    const hx = hero.x - camX, hy = hero.y - 8 - camY;
    const dark = ctx.createRadialGradient(hx, hy, LIGHT_R * 0.45, hx, hy, LIGHT_R);
    dark.addColorStop(0, "rgba(10, 4, 22, 0)");
    dark.addColorStop(1, "rgba(10, 4, 22, 0.93)");
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

// What floats over each quest thing on the map.
function signatureMarker(biome, it, hero) {
  const step = questFor(biome, it.area);
  const state = progress.questState(biome.z, it.area);
  const label = (emoji, text = it.letter) => ({ x: it.x, y: it.y, html: `${emoji}<small>${text}</small>`, cls: " item" });
  switch (it.kind) {
    case "plot": {
      const planted = state.plots?.[it.k];
      if (planted == null) return label("🟫");
      const grown = (Date.now() - planted) / step.growMs;
      return grown >= 1 ? label(step.crop) : label(grown < 0.5 ? "🌱" : "🌿", `${Math.ceil(((1 - grown) * step.growMs) / 1000)}s`);
    }
    case "shroom":
      return { x: it.x, y: it.y, html: `🍄<small style="color:${SHROOM_COLORS[it.color]}">${it.letter}</small>`, cls: " item" };
    case "dock":
      return label(biome.fishing?.item === it ? "🎣" : "⚓", biome.fishing?.item === it ? "..." : it.letter);
    case "ghost":
      return Math.hypot(it.x - hero.x, it.y - hero.y) < LIGHT_R - 4 ? label("👻") : { x: it.x, y: it.y, html: "", cls: " item" };
    case "snowman":
      return label("⛄");
    case "chick":
      return label(it.emoji);
    case "nest":
      return label(it.emoji, state.following ? it.letter : "");
    case "star":
      return label(it.k < state.count ? "🌟" : "⭐");
    case "flag":
      return label("🚩", "");
    case "den":
      return label(it.emoji, "");
    case "watcher":
      return label("👁️", "");
    case "raider":
      return label(it.emoji);
    default:
      return null;
  }
}

// A signed conversation: the giver asks, you answer with a sign, a few times.
// step.qa: [[lines asking, answer to sign, short question for the panel], ...]
function converse(biome, area, k, finish) {
  const step = questFor(biome, area);
  if (k >= step.qa.length) return finish();
  const [lines, answer, question] = step.qa[k];
  say(biome, lines, () =>
    openSignPanel(biome, { title: `💬 ${question}`, word: asSigns(answer), reveal: !MOTION_TIPS[answer], onDone: () => converse(biome, area, k + 1, finish) }),
  );
}

// Riddles are answered by fingerspelling the word.
function askRiddle(biome, area) {
  const step = questFor(biome, area);
  openSignPanel(biome, {
    title: `🧩 Sign the answer: <b>${step.word.split("").map(() => "_").join(" ")}</b>`,
    word: step.word,
    reveal: true,
    onDone: () => say(biome, step.done, () => completeQuest(biome, area)),
  });
}

// Is someone looking for this item right now?
function itemWanted(biome, it) {
  const state = progress.questState(biome.z, it.area);
  if (!state.accepted || state.done) return false;
  if (it.kind === "nest") return Boolean(state.following) && !state.have;
  return it.kind === "card" || SIGNATURE_KINDS.includes(it.kind) || !state.have;
}

const SIGNATURE_KINDS = ["plot", "shroom", "dock", "ghost", "snowman", "chick", "nest", "star", "flag", "den", "watcher", "raider"];

function pickUpItem(biome, item) {
  const keeper = keeperOf(biome, item.area);
  if (keeper && item.kind !== "snowman" && item.kind !== "dock" && item.kind !== "ghost") {
    toast(`🛡️ A hexed ${CREATURES.find((c) => c.id === keeper.id).name} is guarding it! Beat it first.`, 3500);
    return bumpBack(biome, performance.now());
  }
  if (SIGNATURE_KINDS.includes(item.kind)) return touchSignature(biome, item);
  const giver = biome.npcs.find((v) => v.area === item.area && v.role === "giver");
  const step = questFor(biome, item.area);
  if (item.kind === "card") {
    const thing = thingOf(step);
    return openSignPanel(biome, {
      title: `${thing.emoji} ${thing.found || `A ${thing.name}!`} Sign <b>${item.letter}</b> to ${thing.verb || "collect it"}.`,
      word: item.letter,
      onDone: () => {
        item.taken = true;
        const count = progress.questState(biome.z, item.area).count + 1;
        progress.updateQuest(biome.z, item.area, { count });
        if (count >= step.count && biome.race?.area === item.area) biome.race = null; // made it in time!
        toast(count >= step.count ? `${thing.emoji} That's all ${step.count}! Go tell ${giver.name}.` : `${thing.emoji} ${count} of ${step.count}!`, 4000);
      },
    });
  }
  if (item.kind === "hider") {
    return openSignPanel(biome, {
      title: `${item.emoji} Found you, ${item.name}! Sign <b>${item.letter}</b> to tag them.`,
      word: item.letter,
      onDone: () => {
        const count = progress.questState(biome.z, item.area).count + 1;
        if (count < item.hops.length) {
          progress.updateQuest(biome.z, item.area, { count });
          Object.assign(item, item.hops[count]); // off to the next hiding spot
          toast(`${item.emoji} ${item.name} giggles and dashes off to hide again! (${count} of ${item.hops.length})`, 4000);
        } else {
          item.taken = true;
          progress.updateQuest(biome.z, item.area, { count, have: true });
          toast(`${item.emoji} Caught ${item.name} for good! Go tell ${giver.name}.`, 4000);
        }
      },
    });
  }
  openSignPanel(biome, {
    title: `✨ You found ${item.name}! It's stuck. Sign <b>${item.letter}</b> to pull it free.`,
    word: item.letter,
    onDone: () => {
      item.taken = true;
      progress.updateQuest(biome.z, item.area, { have: true });
      toast(`🎒 Got ${item.name}! Bring it back to ${giver.name}.`, 4000);
    },
  });
}

function catchRunner(biome, r) {
  const giver = biome.npcs.find((v) => v.area === r.area && v.role === "giver");
  const name = CREATURES.find((c) => c.id === r.id).name;
  openSignPanel(biome, {
    title: `🐾 You caught up with ${name}! Sign <b>${r.letter}</b> to calm it down.`,
    word: r.letter,
    onDone: () => {
      r.caught = true;
      progress.updateQuest(biome.z, r.area, { have: true });
      toast(`🐾 ${name} calmed down! Go tell ${giver.name}.`, 4000);
    },
  });
}

const folkSpeaker = (f) => ({ name: f.name, art: () => heroImg(f.look, f.hat, "", false) });

function completeQuest(biome, area) {
  const step = questFor(biome, area);
  progress.updateQuest(biome.z, area, { done: true });
  progress.addCoins(QUEST_COINS);
  // A thank-you present too.
  const gift = CONSUMABLES[Math.floor(Math.random() * CONSUMABLES.length)];
  progress.addConsumable(gift.id);
  renderCoins();
  toast(`✅ Side quest complete: ${step.title}! +${QUEST_COINS} 🪙 and a ${gift.name}!`, 4500);
  if (spawnBoss(biome)) {
    const boss = CREATURES.find((c) => c.zone === biome.zone.id && c.kind === "boss");
    setTimeout(() => toast(`👑 Every quest is done! ${boss.name} has appeared at the top of the ${biome.zone.name}!`, 6000), 4800);
  }
  const next = biome.waiting.filter((v) => v.area === area + 1);
  if (next.length) {
    biome.npcs.push(...next);
    biome.waiting = biome.waiting.filter((v) => v.area !== area + 1);
    setTimeout(() => toast(`❗ ${next[0].name} needs your help, up the path!`, 4500), 4800);
  }
  announce(`Side quest complete! You got ${QUEST_COINS} coins and a ${gift.name}.`);
}

// ---------- 🎯 Missions (missions.js) ----------
// The opening: the giver explains, then you watch what went wrong - each
// thing flies or runs off to its clearing with the camera following - then
// the giver says what to do. After that, the mission's goals show up in the
// clearings, and a glowing trail leads to whatever's next.

const missionState = (biome) => progress.missionState(biome.z);
const missionPhase = (biome) => biome.mission?.def.phases[missionState(biome).phase];
const missionActive = (biome) => Boolean(biome.mission) && missionState(biome).started && !missionState(biome).finished;
const giverSpeaker = (biome) => ({ name: biome.mission.giver.name, art: () => heroImg(biome.mission.giver.look, biome.mission.giver.hat, "", false) });
const missionLines = (biome, lines) => lines.map(([who, text]) => [who === "giver" ? giverSpeaker(biome) : who, text.replaceAll("{name}", progress.get().name || "Signkeeper")]);

function startMissionIntro(biome) {
  if (biome.cinematic) return;
  biome.cinematic = true;
  keys.clear();
  biome.hero.path = [];
  $("biome-wrap").classList.add("cinematic");
  biome.camFocus = { x: biome.mission.giver.x, y: biome.mission.giver.y };
  biome.mission.fx = { k: -1, waitUntil: performance.now() + 900, intro: true };
}

// Steps through the opening, one frame at a time.
function runScatter(biome, now) {
  const m = biome.mission, fx = m.fx;
  if (!fx || now < fx.waitUntil) return;
  if (fx.intro) {
    fx.intro = false;
    fx.waitUntil = Infinity;
    say(biome, missionLines(biome, m.def.intro), () => {
      toast(m.def.scatter.text, 5000);
      fx.waitUntil = performance.now() + 300;
    });
    return;
  }
  const tokens = m.def.scatter.emoji;
  if (fx.token && now < fx.token.start + fx.token.dur) return; // still on its way
  if (fx.token && !fx.token.landed) {
    fx.token.landed = true;
    floatText("💫", fx.token.to);
    fx.waitUntil = now + 550;
    return;
  }
  fx.k++;
  if (fx.k < tokens.length && fx.k < m.spots.length) {
    const from = { x: m.giver.x, y: m.giver.y - 8 }, to = m.spots[fx.k];
    const run = m.def.scatter.style === "run";
    const route = run ? findPath(biome, tileOf(from.x), tileOf(from.y + 8) , tileOf(to.x), tileOf(to.y)) : [];
    const length = run && route.length ? route.length * T : Math.hypot(to.x - from.x, to.y - from.y);
    fx.token = { emoji: tokens[fx.k], from, to, route, start: now, dur: Math.max(900, Math.min(3200, (length / (run ? 150 : 210)) * 1000)), run, landed: false };
    return;
  }
  // All done: back to you, and what to do about it.
  fx.token = null;
  biome.camFocus = null;
  fx.waitUntil = Infinity;
  setTimeout(() => say(biome, missionLines(biome, m.def.afterIntro), () => {
    biome.mission.fx = null;
    biome.cinematic = false;
    $("biome-wrap").classList.remove("cinematic");
    const carry = m.def.start?.carry || [];
    progress.updateMission(biome.z, { started: true, carry: [...carry] });
    toast(`🎯 New mission: ${m.def.title}`, 4000);
    if (m.def.start?.toast) setTimeout(() => toast(m.def.start.toast, 4000), 1500);
    announce(`New mission: ${m.def.title}. Follow the glowing trail.`);
  }), 700);
}

// Where a flying or running thing is during the opening.
function tokenAt(token, now) {
  const t = Math.min(1, (now - token.start) / token.dur);
  if (token.run && token.route.length) {
    const i = Math.min(token.route.length - 1, Math.floor(t * token.route.length));
    const hop = Math.abs(Math.sin(t * token.route.length * 0.9)) * 3;
    return { x: token.route[i].x, y: token.route[i].y - hop };
  }
  const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const arc = Math.sin(t * Math.PI) * Math.min(60, Math.hypot(token.to.x - token.from.x, token.to.y - token.from.y) * 0.35);
  return { x: token.from.x + (token.to.x - token.from.x) * ease, y: token.from.y + (token.to.y - token.from.y) * ease - arc };
}

// The goals you can walk up to right now (the current phase's, not done yet).
function missionGoals(biome) {
  const st = missionState(biome);
  return biome.mission.goals.filter((g) => g.phase === st.phase && !st.done.includes(g.id));
}

// The next thing to do: the next goal (in order, if the phase has one; else
// the nearest), or the giver when it's time to go back.
function missionTarget(biome) {
  const ph = missionPhase(biome);
  if (!ph || ph.return) return biome.mission.giver;
  const goals = missionGoals(biome);
  if (ph.ordered) return goals.find((g) => !g.extra) || null;
  const h = biome.hero;
  return goals.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0] || biome.mission.giver;
}

function talkToMissionGiver(biome) {
  const st = missionState(biome), m = biome.mission;
  if (!st.started) return startMissionIntro(biome);
  if (st.finished) return say(biome, [[giverSpeaker(biome), "Thanks again, Signkeeper! I'll never forget it."]]);
  const ph = missionPhase(biome);
  if (!ph.return) return say(biome, [[giverSpeaker(biome), m.def.remind]]);
  // Back with everything: they take what you brought, and the next phase starts (or it's all done).
  say(biome, missionLines(biome, ph.lines), () => {
    const next = st.phase + 1;
    progress.updateMission(biome.z, { phase: next, carry: [], followers: [] });
    m.deadline = 0;
    if (next >= m.def.phases.length) return finishMission(biome);
    toast("🎯 Mission: on to the next part! Follow the glowing trail.", 4000);
  });
}

function finishMission(biome) {
  const m = biome.mission;
  progress.updateMission(biome.z, { finished: true });
  progress.addCoins(MISSION_COINS);
  progress.addTeamXp(MISSION_XP);
  const gift = CONSUMABLES[Math.floor(Math.random() * CONSUMABLES.length)];
  progress.addConsumable(gift.id);
  renderCoins();
  floatText(`+${MISSION_COINS} 🪙`, m.giver);
  toast(`🏆 Mission complete: ${m.def.title}! +${MISSION_COINS} 🪙, +${MISSION_XP} team XP, and a ${gift.name}!`, 5500);
  announce(`Mission complete! You got ${MISSION_COINS} coins, team experience, and a ${gift.name}.`);
}

// Finish a goal: mark it done, then move on if that was the phase's last one.
function goalDone(biome, g, changes = {}) {
  const st = missionState(biome);
  progress.updateMission(biome.z, { done: [...st.done, g.id], ...changes });
  const ph = missionPhase(biome);
  if (ph.goals.every((goal) => missionState(biome).done.includes(goal.id))) {
    progress.updateMission(biome.z, { phase: st.phase + 1 });
    if (ph.after) say(biome, missionLines(biome, ph.after));
  }
}

const carryName = (biome, item) => biome.mission.goals.find((g) => g.item === item && g.kind !== "deliver")?.name || item;

function touchGoal(biome, g) {
  const now = performance.now();
  const st = missionState(biome), ph = missionPhase(biome);
  const m = biome.mission;
  // Out of order?
  if (ph.ordered && !g.extra) {
    const next = missionGoals(biome).find((goal) => !goal.extra);
    if (next && next !== g) {
      bumpBack(biome, now);
      if (ph.strict) {
        // Bells: the wrong one undoes the ones you'd rung.
        progress.updateMission(biome.z, { done: st.done.filter((id) => !ph.goals.some((goal) => goal.id === id)) });
        $("biome-wrap").classList.remove("hexflash");
        void $("biome-wrap").offsetWidth;
        $("biome-wrap").classList.add("hexflash");
      }
      return toast(ph.wrongOrder.replace("{next}", next.name), 5000);
    }
  }
  const sign = (title, onDone) => openSignPanel(biome, { title, word: g.letter, onDone });
  switch (g.kind) {
    case "rescue":
      return sign(`${g.emoji} ${g.name} is scared stiff! Sign <b>${g.letter}</b>, gently, to calm it down.`, () => {
        goalDone(biome, g, { followers: [...missionState(biome).followers, g.follower] });
        toast(`${g.emoji} ${g.name} calms down, and follows you!`, 3500);
      });
    case "fetch":
    case "drift":
      return sign(`${g.emoji} You found ${g.name}! Sign <b>${g.letter}</b> to pick it up.`, () => {
        if (g.timer) m.deadline = performance.now() + g.timer * 1000;
        goalDone(biome, g, { carry: [...missionState(biome).carry, g.item] });
        toast(g.timer ? `${g.item} Got it! Hurry back before it melts! ⏱️ ${g.timer}s` : `🎒 You've got ${g.name}!`, 4000);
      });
    case "decoy":
      return sign(`${g.emoji} A bottle, sealed with the letter <b>${g.letter}</b>. Sign it to open it.`, () => {
        progress.updateMission(biome.z, { done: [...missionState(biome).done, g.id] });
        say(biome, [["pip", g.note]]);
      });
    case "station": {
      if (g.needs && !st.carry.includes(g.needs)) {
        bumpBack(biome, now);
        return toast(`${g.emoji} You'll need ${carryName(biome, g.needs)} first!`, 4000);
      }
      return sign(`${g.emoji} Sign <b>${g.letter}</b> to use ${carryName(biome, g.needs)} on ${g.name}.`, () => {
        const s2 = missionState(biome);
        const carry = [...s2.carry];
        if (g.consume) carry.splice(carry.indexOf(g.needs), 1);
        goalDone(biome, g, { carry, followers: g.follower ? [...s2.followers, g.follower] : s2.followers });
        toast(g.freed || `${g.doneEmoji || "✨"} ${g.name[0].toUpperCase()}${g.name.slice(1)} is glowing again!`, 4500);
      });
    }
    case "deliver": {
      if (!st.carry.includes(g.item)) {
        bumpBack(biome, now);
        return toast(`${g.item} You don't have anything for ${g.name}.`, 3500);
      }
      return sign(`${g.emoji} It's ${g.name}! Sign <b>${g.letter}</b>, their first letter, as you hand over the invitation.`, () => {
        const carry = [...missionState(biome).carry];
        carry.splice(carry.indexOf(g.item), 1);
        goalDone(biome, g, { carry });
        say(biome, [[{ name: g.name, art: () => `<span class="story-emoji">${g.emoji}</span>` }, g.thanks]]);
      });
    }
    case "bell":
      return sign(`${g.emoji} ${g.name[0].toUpperCase()}${g.name.slice(1)}! Sign <b>${g.letter}</b> to ring it.`, () => {
        goalDone(biome, g);
        floatText("🎶", g);
        toast(`🔔 DING! ${g.letter}...`, 2500);
      });
  }
}

// Fallen stars drift around their clearings, and away from you.
const STAR_FLEE = 48, STAR_SPEED = 26, STAR_WANDER = 9, STAR_ROAM = 30;
function moveMission(biome, dt, now) {
  if (!missionActive(biome)) return;
  const h = biome.hero;
  for (const g of missionGoals(biome)) {
    if (g.kind !== "drift") continue;
    const dx = g.x - h.x, dy = g.y - h.y, d = Math.hypot(dx, dy);
    let vx, vy;
    if (d < STAR_FLEE) [vx, vy] = [(dx / (d || 1)) * STAR_SPEED, (dy / (d || 1)) * STAR_SPEED];
    else {
      if (!g.wanderTo || now > g.wanderUntil) {
        g.wanderTo = { x: g.homeX + (Math.random() - 0.5) * STAR_ROAM * 1.4, y: g.homeY + (Math.random() - 0.5) * STAR_ROAM };
        g.wanderUntil = now + 2500;
      }
      const wx = g.wanderTo.x - g.x, wy = g.wanderTo.y - g.y, wd = Math.hypot(wx, wy) || 1;
      [vx, vy] = [(wx / wd) * STAR_WANDER, (wy / wd) * STAR_WANDER];
    }
    const nx = g.x + vx * dt, ny = g.y + vy * dt;
    // It stays in its clearing (so you can corner it), on open ground.
    if (Math.hypot(nx - g.homeX, (ny - g.homeY) * 1.3) < STAR_ROAM && feetFree(biome, nx, ny)) Object.assign(g, { x: nx, y: ny });
  }
}

// Carrying something that melts: when time's up, it's gone, and a fresh one
// waits where you found it.
function missionClock(biome, now) {
  const m = biome.mission;
  if (!m?.deadline || now < m.deadline) return;
  m.deadline = 0;
  const st = missionState(biome);
  const g = m.goals.find((goal) => goal.timer && st.done.includes(goal.id) && st.phase === goal.phase + 1);
  if (!g) return;
  const carry = [...st.carry];
  if (carry.includes(g.item)) carry.splice(carry.indexOf(g.item), 1);
  progress.updateMission(biome.z, { phase: g.phase, done: st.done.filter((id) => id !== g.id), carry });
  toast(`💧 Oh no, it melted! There's another one where you found it. Faster this time!`, 4500);
}

// The glowing trail: dots along the walk to the next goal, and an arrow by your feet.
function drawGuide(biome, ctx, now, camX, camY) {
  if (!missionActive(biome) || biome.cinematic) return;
  const target = missionTarget(biome);
  if (!target) return;
  const h = biome.hero;
  const key = `${tileOf(h.x)},${tileOf(h.y - 1)}>${tileOf(target.x)},${tileOf(target.y)}`;
  if (!biome.guide || (biome.guide.key !== key && now - biome.guide.at > 250)) {
    const tx = Math.max(0, Math.min(TW - 1, tileOf(target.x))), ty = Math.max(0, Math.min(TH - 1, tileOf(target.y)));
    const goal = biome.blocked[ty * TW + tx] ? nearestReachable(biome, tx, ty) || [tx, ty] : [tx, ty];
    biome.guide = { key, at: now, route: findPath(biome, tileOf(h.x), tileOf(h.y - 1), goal[0], goal[1]) };
  }
  const route = biome.guide.route;
  if (route.length < 3) return;
  // Dots that ripple along toward the goal, fading out further ahead.
  const ripple = (now / 140) % 3;
  for (let i = 2; i < Math.min(route.length, 46); i += 3) {
    const p = route[i];
    const fade = 1 - i / 46;
    const pulse = Math.abs(((i / 3) % 3) - ripple) < 0.6 ? 1.35 : 1;
    const glow = ctx.createRadialGradient(p.x - camX, p.y - 3 - camY, 0, p.x - camX, p.y - 3 - camY, 6 * pulse);
    glow.addColorStop(0, `rgba(255, 236, 140, ${0.55 * fade})`);
    glow.addColorStop(1, "rgba(255, 236, 140, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - camX - 7, p.y - 10 - camY, 14, 14);
    ctx.fillStyle = `rgba(43, 29, 46, ${0.7 * fade})`;
    ctx.beginPath();
    ctx.arc(p.x - camX, p.y - 3 - camY, 2.9 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 210, 63, ${fade})`;
    ctx.beginPath();
    ctx.arc(p.x - camX, p.y - 3 - camY, 2.1 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // The arrow: just ahead of your feet, pointing along the trail.
  const ahead = route[Math.min(4, route.length - 1)];
  const angle = Math.atan2(ahead.y - h.y, ahead.x - h.x);
  const bob = Math.sin(now / 180) * 2;
  const ax = h.x - camX + Math.cos(angle) * (13 + bob), ay = h.y - 4 - camY + Math.sin(angle) * (9 + bob);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = "#2b1d2e";
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-4, -5.5);
  ctx.lineTo(-1.5, 0);
  ctx.lineTo(-4, 5.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.moveTo(5.2, 0);
  ctx.lineTo(-2.8, -3.8);
  ctx.lineTo(-0.8, 0);
  ctx.lineTo(-2.8, 3.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// HTML markers: the giver, the goals, whatever's following you, what you're
// carrying, and the opening's flying things.
function missionMarkers(biome, now) {
  const m = biome.mission;
  if (!m) return [];
  const st = missionState(biome), h = biome.hero;
  const out = [];
  const ph = missionPhase(biome);
  const icon = !st.started ? "❗" : st.finished ? "💬" : ph?.return ? "❓" : "🎯";
  out.push({ x: m.giver.x, y: m.giver.y - 31, html: `<span class="npc-icon">${icon}</span><small>${m.giver.name}</small>`, cls: " npc mission-giver" });
  if (m.fx?.token) {
    const p = tokenAt(m.fx.token, now);
    if (!m.fx.token.landed) biome.camFocus = p;
    out.push({ x: p.x, y: p.y, html: m.fx.token.emoji, cls: " item mission-fx" });
  }
  if (!st.started) return out;
  const next = missionTarget(biome);
  for (const g of m.goals) {
    const done = st.done.includes(g.id);
    if (done) {
      if (g.doneEmoji) out.push({ x: g.homeX, y: g.homeY - 4, html: g.doneEmoji, cls: " item mission-done" });
      continue;
    }
    if (g.phase < st.phase || st.finished) continue;
    const now_ = g.phase === st.phase;
    // Later phases' goals show faintly, so you can see what's coming (a dark lantern...).
    const cls = now_ ? (g === next ? " item mission-goal next" : " item mission-goal") : " item mission-goal later";
    out.push({ x: g.x, y: g.y - 4, html: `${g.emoji}<small>${now_ ? g.letter : "…"}</small>`, cls });
  }
  // Followers trot along behind you (after your buddies).
  const team = progress.team().length;
  st.followers.forEach((f, n) => {
    const back = h.trail.length - 1 - (team + n + 1) * 8;
    const spot = h.trail[Math.max(0, back)] || { x: h.x - 12 * (team + n + 1), y: h.y };
    const hop = h.moving ? Math.abs(Math.sin(now / 110 + n)) * 2 : 0;
    out.push({ x: spot.x, y: spot.y - hop, html: f, cls: " item mission-follower" });
  });
  // What you're carrying floats above your head (with the clock, if it melts).
  if (st.carry.length) {
    const left = m.deadline ? Math.max(0, Math.ceil((m.deadline - now) / 1000)) : null;
    out.push({ x: h.x, y: h.y - 40, html: `${st.carry.join("")}${left !== null ? `<small class="${left <= 10 ? "hurry" : ""}">⏱️ ${left}s</small>` : ""}`, cls: " item mission-carry" });
  }
  return out;
}

// The mission's chip in the status bar.
function missionChip(biome) {
  const m = biome.mission;
  if (!m) return "";
  const st = missionState(biome);
  if (!st.started) return `<span class="goal mission">🎯 Talk to ${m.giver.name}</span>`;
  if (st.finished) return "";
  const ph = missionPhase(biome);
  if (ph.return) return `<span class="goal mission">🎯 ${m.def.title}: go back to ${m.giver.name}</span>`;
  const done = ph.goals.filter((g) => st.done.includes(g.id)).length;
  return `<span class="goal mission">🎯 ${m.def.title}: ${done} / ${ph.goals.length}</span>`;
}

// ---------- Story events ----------
// The first time you walk into an area, its event (quests.js) plays:
// Malgrath appears and sends a hexed creature at you, Rook challenges you, or
// there's just a scene.

const eventId = (biome, ev) => `event-${biome.zone.id}-${ev.area}`;

function checkEvents(biome) {
  const area = areaOf(biome.hero.y);
  const ev = (QUESTS[biome.zone.id]?.events || []).find((e) => e.area === area && !progress.storySeen(eventId(biome, e)));
  if (ev) runEvent(biome, ev);
}

function runEvent(biome, ev) {
  progress.markStorySeen(eventId(biome, ev));
  const hero = biome.hero;
  keys.clear();
  hero.path = [];
  // Whoever speaks shows up a few steps away, on either side of you.
  const speakers = new Set([...ev.lines.map(([who]) => who), ev.type]);
  const side = hero.x < W / 2 ? 1 : -1;
  biome.actors = [];
  if (speakers.has("malgrath")) {
    biome.actors.push({ kind: "malgrath", x: hero.x + side * 34, y: hero.y - 16 });
    $("biome-wrap").classList.remove("hexflash");
    void $("biome-wrap").offsetWidth;
    $("biome-wrap").classList.add("hexflash");
  }
  if (speakers.has("rook")) biome.actors.push({ kind: "rook", x: hero.x - side * 30, y: hero.y - 6 });

  say(biome, ev.lines, () => {
    if (!ev.creature) {
      biome.actors = [];
      if (ev.after) say(biome, ev.after);
      return;
    }
    // Malgrath vanishes as his creature attacks; Rook stays to watch his.
    if (ev.type === "malgrath") biome.actors = [];
    const z = biome.z;
    const rival = ev.type === "rook";
    startEncounter(biome, {
      id: ev.creature,
      stage: rival && progress.stageStars(z, 0) > 0 ? 1 : 0,
      level: creatureLevel(z, ev.area) + (rival ? 2 : 1),
      owner: rival ? "Rook" : null,
      event: ev,
    });
  });
}

// Where the current quest wants you to go (for the compass arrow).
// The compass points to the nearest thing one of your accepted side quests
// needs. No accepted quests: no compass - go wherever you like.
function questTarget(biome) {
  if (missionActive(biome)) return missionTarget(biome);
  const h = biome.hero;
  const dist = (t) => Math.hypot(t.x - h.x, t.y - h.y);
  const goals = [];
  for (let area = 0; area < BIOME_AREAS; area++) {
    const step = questFor(biome, area);
    const state = progress.questState(biome.z, area);
    if (!step || !state.accepted || state.done) continue;
    const giver = biome.npcs.find((v) => v.area === area && v.role === "giver");
    let goal = giver;
    if (step.type === "deliver") goal = biome.npcs.find((v) => v.area === area && v.role === "receiver");
    else if ((step.type === "find" || step.type === "hide") && !state.have) goal = biome.items.find((it) => it.area === area);
    else if (step.type === "escort" && !state.have) goal = biome.items.find((it) => it.area === area && it.kind === (state.following ? "nest" : "chick"));
    else if (step.type === "race" && !state.have) goal = biome.items.find((it) => it.area === area && it.kind === "flag");
    else if (step.type === "follow" && biome.run?.area === area) goal = biome.run.giver;
    else if (step.type === "defend" && biome.run?.area === area) goal = biome.items.filter((it) => it.kind === "raider").sort((x, y) => dist(x) - dist(y))[0] || null;
    else if (["garden", "glow", "fish", "stars"].includes(step.type) && state.count < need(step)) {
      const left = biome.items.filter((it) => it.area === area && !it.taken && (step.type !== "stars" || it.k === state.count));
      goal = left.sort((x, y) => dist(x) - dist(y))[0] || giver;
    } else if ((step.type === "ghosts" || step.type === "snowball") && state.count < need(step)) goal = null; // you have to look for them
    else if (step.type === "guard") goal = biome.creatures.find((c) => c.guard === area);
    else if (step.type === "collect" && state.count < step.count) {
      const cards = biome.items.filter((it) => it.area === area && it.kind === "card" && !it.taken);
      goal = cards.sort((x, y) => dist(x) - dist(y))[0] || giver;
    } else if (step.type === "chase" && !state.have) goal = biome.runners.find((r) => r.area === area) || giver;
    else if (step.type === "free" && state.count < step.count) {
      const wild = biome.creatures.filter((c) => c.area === area && !c.home && !c.freed);
      goal = wild.sort((x, y) => dist(x) - dist(y))[0] || giver;
    }
    if (goal) goals.push(goal);
  }
  return goals.sort((x, y) => dist(x) - dist(y))[0] || null;
}

// ---------- ✋ The sign panel: chests, lost things, and riddles ----------

// Sign `word` (one letter or several, in order) to finish. `reveal`: letters
// show up as you sign them (for riddles); otherwise they're shown from the start.
// `limit`: milliseconds to finish in (a fish bites, a snowman's about to
// throw), or `onFail` runs instead.
// `word`: letters to sign in order ("CAB"), or a list of signs, which can
// include moving signs (["THANK YOU"], ["A", "HELLO"]; see MOTION_TIPS).
// `picture`: show only the hand picture, not the letter (mirror quests).
function openSignPanel(biome, { title, word, reveal = false, onDone, limit = 0, onFail = null, picture = false }) {
  const steps = Array.isArray(word) ? word : word.split("");
  biome.chest = { word: steps, i: 0, reveal, onDone, hold: new HoldTimer(), done: false, limit, onFail, picture, started: performance.now() };
  biome.hero.path = [];
  keys.clear();
  $("sign-title").innerHTML = title;
  $("chest-hold").style.width = "0%";
  $("chest-status").textContent = "";
  $("chest-status").className = "status";
  $("chest-panel").hidden = false;
  $("camera-video").play().catch(() => {});
  showSignLetter(biome);
  announce(`${title.replace(/<[^>]+>/g, "")} ${reveal ? "" : `Sign ${steps.join(", ")}.`}`);
}

function showSignLetter(biome) {
  const { word, i, reveal, picture } = biome.chest;
  const letter = word[i];
  const moving = letter?.length > 1; // a whole moving sign, like HELLO
  if (picture) {
    // Mirror: just the hand picture to copy.
    $("chest-big").innerHTML = `<span class="sign-slot now">${biome.chest.done ? letter : "?"}</span>`;
    $("chest-tip").textContent = "";
    return setGuide($("chest-img"), letter, "full");
  }
  $("chest-big").innerHTML = word
    .map((l, n) => `<span class="sign-slot${l.length > 1 ? " sign-word" : ""}${n < i ? " done" : n === i ? " now" : ""}">${n < i || !reveal || n === i ? l : "?"}</span>`)
    .join("");
  $("chest-tip").textContent = MOTION_TIPS[letter] || TIPS[letter] || "";
  // The hand picture fades away as you learn the letter (not on riddles: it'd give it away).
  setGuide($("chest-img"), letter, reveal || moving ? "none" : progress.guideFor(letter));
}

function signTick(biome, now) {
  const task = biome.chest;
  if (task.done) return;
  if (task.limit) {
    const left = task.started + task.limit - now;
    if (left <= 0) {
      task.done = true;
      $("chest-status").textContent = "Too slow! ⏱️";
      $("chest-status").className = "status bad";
      setTimeout(() => {
        closeChestPanel(biome);
        task.onFail?.();
      }, 700);
      return;
    }
    $("chest-status").textContent = `⏱️ ${Math.ceil(left / 1000)}s`;
  }
  const held = task.hold.update(task.word[task.i], getPrediction(), now);
  $("chest-hold").style.width = `${held * 100}%`;
  if (held < 1) return;
  flashCamera("good");
  progress.warmEgg(); // 🥚 every sign warms your raid egg
  renderCoins();
  task.i++;
  task.hold.reset();
  $("chest-hold").style.width = "0%";
  if (task.i < task.word.length) return showSignLetter(biome);
  task.done = true;
  showSignLetter(biome);
  $("chest-status").textContent = task.word.length > 1 ? "That's right! 🎉" : "Got it! 🎉";
  $("chest-status").className = "status good";
  setTimeout(() => {
    closeChestPanel(biome);
    task.onDone();
  }, 900);
}

function smashBoulder(biome, b) {
  openSignPanel(biome, {
    title: `🪨 A boulder blocks the trail! Sign <b>${b.letter}</b> to smash it!`,
    word: b.letter,
    onDone: () => {
      b.broken = true;
      progress.openChest(biome.z, b.id);
      blockBoulder(biome.blocked, b, 0);
      biome.reachable = floodFrom(biome, tileOf(biome.hero.x), tileOf(biome.hero.y - 1));
      floatText("💥", { x: b.x, y: b.y - 16 });
      toast("💥 Smashed! Follow the trail to see where it goes.");
      announce("You smashed the boulder. Follow the trail.");
    },
  });
}

// The thing to do in an area's scene (see SCENES).
function useProp(biome, pr) {
  const letters = biome.zone.letters;
  const letter = (k) => letters[(pr.area * 3 + k) % letters.length];
  const used = (text) => {
    pr.used = true;
    progress.openChest(biome.z, pr.id);
    renderCoins();
    toast(text);
    announce(text.replace(/^\S+ /, ""));
  };
  if (pr.kind === "berries") {
    progress.addConsumable("potion");
    floatText("🫐", pr);
    return used("🫐 You picked berries and made a Potion!");
  }
  if (pr.kind === "well") {
    if (progress.get().coins < WELL_COST) {
      biome.safeUntil = performance.now() + 4000;
      return toast(`🪙 A wishing well! Bring ${WELL_COST} coins to make a wish.`);
    }
    return openSignPanel(biome, {
      title: `🪙 A wishing well! Sign <b>${letter(0)}</b> and toss in ${WELL_COST} coins to make a wish.`,
      word: letter(0),
      onDone: () => {
        progress.addCoins(-WELL_COST);
        const item = CONSUMABLES[1 + Math.floor(Math.random() * (CONSUMABLES.length - 1))];
        progress.addConsumable(item.id);
        used(`🪙 Your wish came true: a ${item.name}!`);
      },
    });
  }
  if (pr.kind === "fire") {
    const word = letter(0) + letter(1);
    return openSignPanel(biome, {
      title: `🔥 Rest by the campfire and practice with your team: sign <b>${word.split("").join(" ")}</b>!`,
      word,
      onDone: () => {
        const up = progress.addTeamXp(FIRE_XP);
        used(`🔥 Your team practiced by the fire: +${FIRE_XP} XP${up.length ? " - and leveled up!" : "!"}`);
      },
    });
  }
  // Glowing stones and statues: sign the word on them.
  const words = biome.zone.words;
  const word = words[pr.area % words.length];
  openSignPanel(biome, {
    title: `✨ Letters glow on the ${pr.kind}. Sign <b>${word}</b> to wake it!`,
    word,
    onDone: () => {
      progress.addCoins(STONE_COINS);
      progress.addConsumable("power");
      used(`✨ The ${pr.kind} glows! You got ${STONE_COINS} coins and a Power-up!`);
    },
  });
}

function openChestPanel(biome, chest) {
  openSignPanel(biome, {
    title: `🔐 Sign <b>${chest.letter}</b> to open the chest!`,
    word: chest.letter,
    onDone: () => openChest(biome, chest),
  });
}

function openChest(biome, chest) {
  chest.open = true;
  progress.openChest(biome.z, chest.id);
  // Usually coins; sometimes a potion or power-up. A big chest has both, and more.
  let reward;
  if (chest.big) {
    const coins = CHEST_COINS[1] * 2;
    const item = CONSUMABLES[1 + Math.floor(Math.random() * (CONSUMABLES.length - 1))];
    progress.addCoins(coins);
    progress.addConsumable(item.id);
    renderCoins();
    reward = `${coins} coins and a ${item.name}`;
  } else if (Math.random() < 0.3) {
    const item = CONSUMABLES[Math.floor(Math.random() * CONSUMABLES.length)];
    progress.addConsumable(item.id);
    reward = `a ${item.name}`;
  } else {
    const coins = CHEST_COINS[0] + Math.floor(Math.random() * (CHEST_COINS[1] - CHEST_COINS[0] + 1));
    progress.addCoins(coins);
    renderCoins();
    reward = `${coins} coins`;
  }
  toast(`🔓 You opened the chest and got ${reward}! 🎉`);
  announce(`You opened the chest and got ${reward}!`);
}

function closeChestPanel(biome) {
  $("chest-panel").hidden = true;
  $("chest-status").className = "status";
  biome.chest = null;
  bumpBack(biome, performance.now());
  $("biome-canvas").focus?.();
}

$("chest-cancel").onclick = () => current?.chest && closeChestPanel(current);

// ---------- Drawing ----------

function draw(biome, now) {
  const ctx = $("biome-canvas").getContext("2d");
  // Everything below is in game pixels; the canvas has VIEW_SCALE real pixels for each.
  ctx.setTransform(VIEW_SCALE, 0, 0, VIEW_SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const camX = Math.round(biome.camX), camY = Math.round(biome.camY);
  ctx.fillStyle = "#0d0b16"; // past the zone's bottom edge (under the main bar)
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.drawImage(biome.bg, camX, camY, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

  const things = [];
  const sprite = (type) => spriteCanvas(decorSrc(type));
  for (const d of biome.decor) things.push({ y: d.y, img: sprite(d.type), x: d.x });
  for (const g of biome.gates) {
    if (g.open) continue;
    for (let tx = g.minX; tx <= g.maxX; tx += 2) things.push({ y: g.y, img: sprite("gate"), x: tx * T + T });
  }
  for (const c of biome.chests) things.push({ y: c.y, img: sprite(c.open ? "chestopen" : "chest"), x: c.x, shadow: true, scale: c.big ? 1.5 : 1 });
  for (const pr of biome.props) {
    const look = PROPS[pr.kind];
    things.push({ y: pr.y, img: sprite(pr.used && look.used ? look.used : look.decor), x: pr.x });
  }
  for (const b of biome.boulders) if (!b.broken) things.push({ y: b.y, img: sprite("rock"), x: b.x, scale: 2 });
  for (const s of biome.signposts) things.push({ y: s.y, img: sprite("signpost"), x: s.x, shadow: true });
  for (const c of biome.coins) if (!c.taken) things.push({ y: c.y, img: sprite("coin"), x: c.x });
  things.push({ y: biome.landmark.y, img: spriteCanvas(landmarkSrc(biome.zone.id)), x: biome.landmark.x, scale: 2 });
  const raid = raidOf(biome);
  if (raid) things.push({ y: biome.raid.y, img: spriteCanvas(creatureSrc(raid.id, false, 0, 3)), x: biome.raid.x, scale: 1.25, shadow: true });
  things.push({ y: biome.trial.y, img: spriteCanvas(portalSrc(Math.floor(performance.now() / 140))), x: biome.trial.x, scale: 1.4 });
  things.push({ y: biome.motionTrial.y, img: sprite("crystal"), x: biome.motionTrial.x, scale: 1.6, shadow: true });
  for (const c of biome.creatures) {
    // Walking: step through the walk cycle. Standing: a slow breathing bob.
    const frame = walkFrame(c.moving, now, 170, c.x);
    const lift = stepLift(frame);
    things.push({ y: c.y, img: spriteCanvas(creatureSrc(c.id, !c.freed, frame)), x: c.x, flip: c.flip, scale: c.boss ? 1.5 : 0.75, lift, tilt: lean(c.moving, c.flip), shadow: true, hex: !c.freed }); // 32 px creatures, drawn 3/4 size (bosses 1.5x)
  }
  // Your buddies follow a few steps behind, one after the other, in step with you.
  const hero = biome.hero;
  progress.team().forEach((pet, n) => {
    const back = hero.trail.length - 1 - (n + 1) * 8; // about 16 pixels apart
    const spot = hero.trail[Math.max(0, back)] || { x: hero.x - 12 * (n + 1), y: hero.y, flip: hero.flip };
    const frame = walkFrame(hero.moving, now, 110, n * 2 + 1);
    things.push({ y: spot.y - 0.5 - n * 0.1, img: spriteCanvas(creatureSrc(pet.id, false, frame, stageOf(pet.level))), x: spot.x, flip: !spot.flip, shadow: true, small: true, lift: stepLift(frame), tilt: lean(hero.moving, !spot.flip) });
  });
  // Runaway critters (chase quests) until they're caught.
  for (const r of biome.runners) {
    if (r.caught) continue;
    const frame = walkFrame(r.moving, now, 90, r.x);
    things.push({ y: r.y, img: spriteCanvas(creatureSrc(r.id, false, frame)), x: r.x, flip: r.flip, lift: stepLift(frame), tilt: lean(r.moving, r.flip), shadow: true, small: true });
  }
  // Townsfolk stroll about.
  for (const f of biome.folk) {
    const frame = walkFrame(f.moving, now, 150, f.x);
    const lift = stepLift(frame);
    things.push({ y: f.y, img: spriteCanvas(heroSrc(f.look, f.hat, frame, false)), x: f.x, flip: f.moving ? f.flip : hero.x < f.x, lift, tilt: lean(f.moving, !f.flip), shadow: true });
  }
  // 👥 Other players exploring this zone.
  for (const o of biome.others?.values() || []) {
    const frame = walkFrame(o.moving, now, 110, o.x);
    things.push({ y: o.y, img: spriteCanvas(heroSrc(o.look, o.hat, frame, false)), x: o.x, flip: o.flip, lift: stepLift(frame), tilt: lean(o.moving, !o.flip), shadow: true });
  }
  // The mission's giver faces you too.
  const mission = biome.mission;
  if (mission) things.push({ y: mission.giver.y, img: spriteCanvas(heroSrc(mission.giver.look, mission.giver.hat, 0, false)), x: mission.giver.x, flip: hero.x < mission.giver.x, shadow: true });
  // Villagers face you.
  for (const v of biome.npcs) {
    const frame = v.moving ? walkFrame(true, now, 110, v.x) : 0;
    things.push({ y: v.y, img: spriteCanvas(heroSrc(v.look, v.hat, frame, Boolean(v.wand))), x: v.x, flip: v.moving ? v.flip : hero.x < v.x, lift: stepLift(frame), shadow: true });
  }
  // Trainers face you; they walk when they come over to battle.
  for (const t of biome.trainers) {
    const frame = walkFrame(t.moving, now, 110, t.x);
    const lift = stepLift(frame);
    things.push({ y: t.y, img: spriteCanvas(heroSrc(t.look, null, frame, true)), x: t.x, flip: hero.x < t.x, lift, tilt: lean(t.moving, hero.x >= t.x), shadow: true });
  }
  // Malgrath or Rook, during a story event.
  for (const a of biome.actors) {
    const img = a.kind === "malgrath" ? creatureSrc("malgrath") : heroSrc(ROOK.look, null, 0, true);
    things.push({ y: a.y, img: spriteCanvas(img), x: a.x, flip: hero.x < a.x, shadow: true, hex: a.kind === "malgrath" });
  }
  const frame = walkFrame(hero.moving, now, 110);
  // A little puff of dust behind you on each step.
  if (frame !== hero.lastFrame && frame % 2) biome.dust.push({ x: hero.x + (hero.flip ? 4 : -4), y: hero.y, born: now });
  hero.lastFrame = frame;
  things.push({ y: hero.y, img: spriteCanvas(heroSrc(progress.heroLook(), progress.get().equipped.hat, frame)), x: hero.x, flip: hero.flip, lift: stepLift(frame), tilt: lean(hero.moving, !hero.flip), shadow: true });

  biome.dust = biome.dust.filter((p) => now - p.born < 350);
  for (const p of biome.dust) {
    const age = (now - p.born) / 350;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * (1 - age)})`;
    ctx.beginPath();
    ctx.ellipse(p.x - camX + (hero.flip ? age * 3 : -age * 3), p.y - 1 - camY - age * 2, 1.5 + age * 2, 1 + age, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawGuide(biome, ctx, now, camX, camY);

  things.sort((a, b) => a.y - b.y);
  for (const t of things) {
    const { w: iw, h: ih, smooth } = spriteSize(t.img); // size in game pixels
    let w = iw * (t.scale || 1), h = ih * (t.scale || 1);
    if (t.small && iw > 12) (w = iw * 0.75), (h = ih * 0.75);
    if (t.y < camY - 4 || t.y - h > camY + VIEW_H + 4 || t.x + w / 2 < camX || t.x - w / 2 > camX + VIEW_W) continue; // off screen
    const x = Math.round(t.x - w / 2) - camX, y = Math.round(t.y - h - (t.lift || 0)) - camY;
    if (t.shadow) {
      // Hexbound creatures cast a darker, murky shadow.
      ctx.fillStyle = t.hex ? "rgba(30,6,40,0.45)" : "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(t.x - camX, t.y - 1 - camY, w / 2.6, t.hex ? 2.5 : 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.imageSmoothingEnabled = smooth; // painted creatures are drawn smoothly
    // Leaning forward while walking: tip the sprite a little around its feet.
    if (t.tilt) {
      ctx.save();
      ctx.translate(t.x - camX, t.y - camY);
      ctx.rotate(t.tilt * 0.08);
      ctx.translate(-(t.x - camX), -(t.y - camY));
    }
    if (t.flip) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(t.img, 0, 0, w, h);
      ctx.restore();
    } else ctx.drawImage(t.img, x, y, w, h);
    if (t.tilt) ctx.restore();
  }
  ctx.imageSmoothingEnabled = false;
  drawSignature(biome, ctx, camX, camY);

  // Markers over creatures (⚔️ / 📜 / 👑 / 💤 and level) and locked chests,
  // as HTML so they stay crisp.
  const markers = [
    ...biome.creatures.map((c) => {
      let icon = STAGES[c.stage].icon;
      const h = (c.boss ? 1.5 : 0.75) * spriteSize(spriteCanvas(creatureSrc(c.id))).h;
      if (c.freed) return { x: c.x, y: c.y - h - 2, html: "💚", cls: " freed" };
      if (c.rare) icon = "🧭";
      // Rare and rarer creatures show their rarity, in its color.
      const rarity = rarityOf(CREATURES.find((x) => x.id === c.id));
      const showRarity = !c.boss && !c.rare && rarity.weight <= RARITIES.rare.weight;
      const tag = c.rare ? "Wanderer! " : showRarity ? `${rarity.name}! ` : "";
      const color = showRarity ? ` style="color:${rarity.color}"` : "";
      return { x: c.x, y: c.y - h - 2, html: `${icon}<small${color}>${tag}Lv ${c.level}</small>`, cls: c.boss ? " boss" : c.rare ? " rare" : "" };
    }),
    ...biome.chests.filter((c) => !c.open).map((c) => ({ x: c.x, y: c.y - (c.big ? 20 : 14), html: `🔐<small>${c.letter}</small>`, cls: " chest" })),
    ...biome.boulders.filter((b) => !b.broken).map((b) => ({ x: b.x, y: b.y - 34, html: `🪨<small>${b.letter}</small>`, cls: " chest" })),
    ...biome.props.filter((pr) => !pr.used).map((pr) => ({ x: pr.x, y: pr.y - 22, html: PROPS[pr.kind].icon, cls: " chest" })),
    // ❗ has a quest for you, ❓ come back (it's done), 💬 just chatting.
    ...biome.npcs.map((v) => ({ x: v.x, y: v.y - 31, html: `<span class="npc-icon">${npcIcon(biome, v)}</span><small>${v.name}</small>`, cls: " npc" })),
    // Road signs to the next zones.
    ...biome.exits.map((e) => ({
      x: e.side === "left" ? 7 * T : W - 7 * T,
      y: e.y - 14,
      html: `<small>${e.side === "left" ? "⬅" : ""} ${ZONES[e.to].icon} ${ZONES[e.to].name}${progress.zoneUnlocked(e.to) ? "" : " 🔒"} ${e.side === "right" ? "➡" : ""}</small>`,
      cls: " road",
    })),
    // Secrets glint only when you're close.
    ...biome.secrets
      .filter((sc) => !sc.found)
      .map((sc) => ({ x: sc.x, y: sc.y - 4, html: Math.hypot(sc.x - hero.x, sc.y - hero.y) < SECRET_SEE ? "✨" : "", cls: " item secret" })),
    // ❗ when a trainer spots you; ⚔️ for ones still waiting to battle.
    ...biome.trainers.map((t) =>
      biome.spotted?.t === t
        ? { x: t.x, y: t.y - 31, html: `<span class="npc-icon">❗</span>`, cls: " alert" }
        : { x: t.x, y: t.y - 31, html: `<span class="npc-icon">${t.beaten ? "💬" : "⚔️"}</span><small>${t.name}</small>`, cls: " npc" },
    ),
    // Lost things sparkle, and sign cards glow, once someone has asked you to find them.
    ...biome.items
      .filter((it) => !it.taken && itemWanted(biome, it))
      // (Someone playing hide-and-seek only peeks out when you're close.)
      .map((it) => signatureMarker(biome, it, hero) || { x: it.x, y: it.y, html: it.kind === "card" ? `${it.emoji}<small>${it.letter}</small>` : it.kind === "hider" ? (Math.hypot(it.x - hero.x, it.y - hero.y) < 56 ? it.emoji : "") : "✨", cls: " item" }),
    // A chick you're leading home follows right behind you.
    ...biome.items
      .filter((it) => it.kind === "chick" && progress.questState(biome.z, it.area).following)
      .map((it) => {
        const spot = hero.trail[Math.max(0, hero.trail.length - 1 - (progress.team().length + 1) * 8)] || hero;
        return { x: spot.x, y: spot.y - 2, html: it.emoji, cls: " item" };
      }),
    // Runaway critters, once you've been asked to catch them.
    ...biome.runners
      .filter((r) => !r.caught && progress.questState(biome.z, r.area).accepted)
      .map((r) => ({ x: r.x, y: r.y - 20, html: "💨", cls: " item" })),
    // 🏛️ The Trial shrine: sealed until the boss is beaten.
    trialMarker(biome),
    raidMarker(biome),
    motionTrialMarker(biome),
    // Townsfolk: their names.
    ...biome.folk.map((f) => ({ x: f.x, y: f.y - 31, html: `<small>${f.name}</small>`, cls: " npc folk" })),
    // Other players' names (typed by them, so escaped).
    ...[...(biome.others?.values() || [])].map((o) => ({ x: o.x, y: o.y - 31, html: `<small>👤 ${escapeHtml(o.name)}</small>`, cls: " npc player" })),
    ...missionMarkers(biome, now),
  ];
  placeLabels(markers, camX, camY);

  // Compass: an arrow at the edge pointing to the current goal when it's off screen.
  const goal = questTarget(biome);
  const compass = $("biome-compass");
  const gx = goal ? goal.x - camX : 0, gy = goal ? goal.y - 12 - camY : 0;
  const offScreen = goal && (gx < 0 || gx > VIEW_W || gy < 0 || gy > VIEW_H);
  compass.hidden = !offScreen;
  if (offScreen) {
    const cx = VIEW_W / 2, cy = VIEW_H / 2;
    const angle = Math.atan2(gy - cy, gx - cx);
    // Slide along from the middle toward the goal until hitting the edge (with a margin).
    const scale = Math.min(Math.abs((VIEW_W / 2 - 18) / Math.cos(angle) || Infinity), Math.abs((VIEW_H / 2 - 18) / Math.sin(angle) || Infinity));
    compass.style.left = `${((cx + Math.cos(angle) * scale) / VIEW_W) * 100}%`;
    compass.style.top = `${((cy + Math.sin(angle) * scale) / VIEW_H) * 100}%`;
    compass.style.setProperty("--angle", `${angle}rad`);
  }
}

function npcIcon(biome, v) {
  const step = questFor(biome, v.area);
  const state = progress.questState(biome.z, v.area);
  if (state.done) return "💬";
  if (v.role === "receiver") return state.have ? "❓" : "💬";
  if (!state.accepted) return "❗";
  const here = HERE_QUESTS.includes(step.type); // done right there with them
  return here || questReady(biome, v.area) ? "❓" : "💬";
}

// The status line under the map: where you are and what you've found. It
// doesn't tell you what to do next: you choose.
function renderHud(biome) {
  const z = biome.z;
  const here = areaOf(biome.hero.y);
  const quests = QUESTS[biome.zone.id]?.steps || [];
  // The quest you're on that's nearest, if any.
  const active = quests.map((step, a) => ({ step, a, state: progress.questState(z, a) })).filter((q) => q.state.accepted && !q.state.done);
  const onQuest = active.find((q) => q.a === here) || active[0];
  let doing = "";
  if (onQuest) {
    const { step, state } = onQuest;
    doing = COUNT_QUESTS.includes(step.type) && state.count < need(step) ? `📜 ${step.title} · ${state.count}/${need(step)}` : `📜 ${step.title}`;
    if (biome.race?.area === onQuest.a) doing += ` · ⏱️ ${Math.max(0, Math.ceil((biome.race.until - performance.now()) / 1000))}s`;
    const run = biome.run;
    if (run?.area === onQuest.a && run.type === "defend") doing += ` · ⏱️ ${Math.max(0, Math.ceil((run.until - performance.now()) / 1000))}s · ${"❤️".repeat(run.hp)}`;
    if (run?.area === onQuest.a && run.type === "race" && performance.now() < run.go) doing += ` · ${Math.ceil((run.go - performance.now()) / 1000)}...`;
  }
  const mission = missionChip(biome);
  setHtml($("biome-goals"), `${mission}${doing ? `<span class="goal">${doing}</span>` : ""}`);
}

// Markers as HTML over the canvas, so they stay crisp: [{ x, y, html, cls }] in game pixels.
function placeLabels(markers, camX, camY) {
  const labels = $("biome-labels");
  if (labels.children.length !== markers.length) labels.innerHTML = markers.map(() => `<span class="biome-label"></span>`).join("");
  markers.forEach((m, i) => {
    const el = labels.children[i];
    const left = m.x - camX, top = m.y - camY;
    el.hidden = top < -10 || top > VIEW_H || left < -10 || left > VIEW_W + 10;
    if (el.hidden) return;
    setHtml(el, m.html);
    el.className = `biome-label${m.cls}`;
    el.style.left = `${(left / VIEW_W) * 100}%`;
    el.style.top = `${(top / VIEW_H) * 100}%`;
  });
}

function renderCoins() {
  $("biome-coins").textContent = progress.get().coins;
  const egg = $("biome-egg");
  egg.textContent = eggStatus();
  egg.title = eggTitle();
  egg.hidden = !egg.textContent;
}

// A little "+3 🪙" that floats up from where something happened.
function floatText(text, at) {
  const el = document.createElement("span");
  el.className = "biome-float";
  el.textContent = text;
  el.style.left = `${((at.x - current.camX) / VIEW_W) * 100}%`;
  el.style.top = `${((at.y - 10 - current.camY) / VIEW_H) * 100}%`;
  $("biome-wrap").appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ---------- Loop, screen, and input ----------

// Size the view to the screen: as tall as an area, and as wide as the
// screen's shape allows (up to the whole zone's width).
function fitView() {
  const zoom = ZOOMS.includes(progress.get().settings.zoom) ? progress.get().settings.zoom : 1;
  VIEW_H = Math.round(SH * T * zoom);
  const wrap = $("biome-wrap");
  const aspect = (wrap.clientWidth || innerWidth) / (wrap.clientHeight || innerHeight);
  VIEW_W = Math.round(Math.min(W, Math.max(12 * T, VIEW_H * aspect)));
  const canvas = $("biome-canvas");
  canvas.width = VIEW_W * VIEW_SCALE;
  canvas.height = VIEW_H * VIEW_SCALE;
  const bar = $("main-bar");
  barRoom = bar && !bar.hidden && wrap.clientHeight ? Math.ceil(((bar.offsetHeight + 16) / wrap.clientHeight) * VIEW_H) : 0;
}
// ⛶ Full screen on and off.
$("biome-fullscreen").onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
};
addEventListener("resize", refitView);
// Re-size the view now (the window changed, or the View setting did).
export function refitView() {
  if (!current || $("screen-biome").hidden) return;
  fitView();
  const target = cameraTarget(current);
  current.camX = target.x;
  current.camY = target.y;
  draw(current, performance.now());
}

// - and + while exploring: zoom out and in.
addEventListener("keydown", (e) => {
  const step = { "-": 1, _: 1, "=": -1, "+": -1 }[e.key];
  if (!step || !current || current.chest || !isShowing("biome") || e.target.closest?.("input, textarea, select")) return;
  const now = ZOOMS.indexOf(progress.get().settings.zoom);
  const next = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (now < 0 ? 1 : now) + step))];
  progress.updateSettings({ zoom: next });
  refitView();
  toast(`🔍 View: ${ZOOM_NAMES[ZOOMS.indexOf(next)]}`, 1500);
});

const cameraTarget = (biome) => {
  const look = biome.camFocus || biome.hero; // the mission's opening points the camera elsewhere
  return {
    x: Math.max(0, Math.min(W - VIEW_W, look.x - VIEW_W / 2)),
    y: Math.max(0, Math.min(H - VIEW_H + barRoom, look.y - VIEW_H * 0.6)),
  };
};

// The loop runs while the biome is on screen; showing it again resumes it
// (screens.js calls this from show("biome")).
let looping = false;
export function startLoop() {
  if (looping || !current) return;
  looping = true;
  current.last = 0;
  requestAnimationFrame(frame);
}
// The zone you're walking around in (or were, before opening the book, shop...).
export const currentZone = () => current?.z ?? null;

function frame(now) {
  if (!current || !isShowing("biome")) {
    looping = false;
    return;
  }
  requestAnimationFrame(frame);
  const biome = current;
  const dt = Math.min(0.05, (now - (biome.last || now)) / 1000);
  biome.last = now;
  const talking = isStoryPlaying() || biome.cinematic;
  if (biome.cinematic) {
    if (!isStoryPlaying()) runScatter(biome, now);
  } else if (biome.chest) {
    signTick(biome, now);
  } else if (biome.spotted) {
    if (!talking) runSpot(biome, now, dt);
  } else if (isHatching()) {
    // 🥚 Everything waits while an egg hatches.
  } else if (!talking && !biome.spotOpen && !biome.asking && progress.readyEgg()) {
    keys.clear();
    biome.hero.path = [];
    biome.hero.moving = false;
    maybeHatch(() => renderCoins());
  } else if (!talking && !biome.spotOpen) {
    moveHero(biome, dt);
    moveCreatures(biome, dt, now);
    moveRunners(biome, dt);
    moveFolk(biome, dt, now);
    moveMission(biome, dt, now);
  }
  // Other players glide toward where the server last saw them.
  for (const o of biome.others?.values() || []) {
    const k = Math.min(1, dt * 8);
    o.moving = Math.hypot(o.tx - o.x, o.ty - o.y) > 0.6;
    if (o.moving) o.flip = o.tx < o.x;
    o.x += (o.tx - o.x) * k;
    o.y += (o.ty - o.y) * k;
  }
  const target = cameraTarget(biome);
  const follow = biome.cinematic ? 3.5 : 6; // a slower, smoother pan during the opening
  biome.camX += (target.x - biome.camX) * Math.min(1, dt * follow);
  biome.camY += (target.y - biome.camY) * Math.min(1, dt * follow);

  if (now > biome.nextSpawn) {
    for (let a = 0; a < BIOME_AREAS; a++) {
      if (biome.creatures.filter((c) => c.area === a && !c.home && !c.freed).length < WILD_PER_AREA) {
        spawnWild(biome, a);
        break;
      }
    }
    biome.nextSpawn = now + RESPAWN_MS;
  }
  biome.creatures = biome.creatures.filter((c) => !c.freed || now < c.freedUntil);
  draw(biome, now);
  if (!biome.chest && !biome.spotted && !talking && current === biome) checkEvents(biome);
  if (!biome.chest && !talking && current === biome) missionClock(biome, now);
  if (!biome.chest && !talking && current === biome) questClock(biome, now);
  if (!biome.chest && !biome.spotted && !biome.asking && !biome.spotOpen && !biome.cinematic && !isStoryPlaying() && current === biome) checkTouch(biome, now);
  if (biome === current && !biome.chest) renderHud(biome);
}

// `from`: the zone you walked in from, along a road (null from the map).
// ---------- 👥 Other players in the same zone ----------
// A few times a second, tell the server where you are in this zone and get
// back everyone else here (serve.py: the same as Skyhaven, one room per zone).
// Players are told apart by a short tag; nobody's private id is shared.
const PRESENCE_MS = 400;
let presenceBusy = false;
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function playerId() {
  let id = progress.get().arenaId;
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    progress.update({ arenaId: id });
  }
  return id;
}

async function sendPresence() {
  const biome = current;
  if (!biome || presenceBusy || !isShowing("biome")) return;
  presenceBusy = true;
  const p = progress.get();
  try {
    const res = await fetch("/api/hub/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: playerId(), room: `zone:${biome.zone.id}`, name: p.name || "Hero", look: progress.heroLook(), hat: p.equipped.hat, pos: { x: biome.hero.x, y: biome.hero.y, flip: biome.hero.flip } }),
    });
    const out = await res.json();
    const next = new Map();
    for (const o of out.others || []) {
      const had = biome.others?.get(o.tag);
      next.set(o.tag, { ...o, x: had ? had.x : o.pos.x, y: had ? had.y : o.pos.y, tx: o.pos.x, ty: o.pos.y, flip: had ? had.flip : o.pos.flip, moving: false });
    }
    biome.others = next;
  } catch {
    // No server (the game opened as a file, or offline): explore on your own.
  }
  presenceBusy = false;
}
setInterval(sendPresence, PRESENCE_MS);

export function enterBiome(z, from = null) {
  current = null; // the old loop stops; this one starts once the zone's opening has played
  if (!biomes.has(z)) biomes.set(z, build(z));
  const biome = biomes.get(z);
  biome.last = 0;
  const road = from !== null && biome.exits.find((e) => e.to === from);
  if (road) {
    // Arrive a few steps in from the edge, on the road back.
    const hero = biome.hero;
    hero.x = road.side === "left" ? 4 * T : W - 4 * T;
    hero.y = road.y;
    hero.flip = road.side === "right";
    hero.path = [];
    hero.trail = [];
    biome.spotted = null;
    biome.asking = null;
    $("biome-ask").hidden = true;
    biome.safeUntil = performance.now() + SAFE_MS; // a moment to look around before anything jumps you
  }
  biome.safeUntil = Math.max(biome.safeUntil, performance.now() + 800);
  const target = cameraTarget(biome);
  biome.camX = target.x;
  biome.camY = target.y;
  show("biome");
  playMusic(`explore-${biome.zone.id}`);
  $("chest-panel").hidden = true;
  biome.chest = null;
  fitView();
  $("biome-title").textContent = `${biome.zone.icon} ${biome.zone.name}`;
  $("biome-labels").innerHTML = "";
  renderHud(biome);
  renderCoins();
  draw(biome, performance.now());
  // The first visit to a zone starts with its cinematic, then Pip.
  playCutscene(`zone-${biome.zone.id}`, () => playScene(`zone-${biome.zone.id}`, () => {
    current = biome;
    biome.last = 0;
    if (pendingToast) {
      toast(pendingToast);
      pendingToast = null;
    }
    if (pendingLines) {
      const { lines, after } = pendingLines;
      pendingLines = null;
      say(biome, lines, after);
    } else if (biome.mission && !progress.missionState(biome.z).started) startMissionIntro(biome);
    startLoop();
  }));
}

function toast(text, ms = 3500) {
  const el = $("biome-toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(el.timer);
  el.timer = setTimeout(() => (el.hidden = true), ms);
}

const KEY_DIRS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down" };

addEventListener("keydown", (e) => {
  const dir = KEY_DIRS[e.key];
  if (!dir || !current || current.chest || current.spotted || current.asking || !isShowing("biome") || e.target.closest?.("input, textarea, select")) return;
  keys.add(dir);
  e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(KEY_DIRS[e.key]));
addEventListener("blur", () => keys.clear());

$("biome-book").onclick = () => {
  const z = current?.z ?? 0;
  current = null;
  openBook(() => enterBiome(z));
};

$("biome-canvas").addEventListener("pointerdown", (e) => {
  if (!current || current.chest || current.spotted || current.asking) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const tx = tileOf(((e.clientX - rect.left) / rect.width) * VIEW_W + current.camX);
  const ty = tileOf(((e.clientY - rect.top) / rect.height) * VIEW_H + current.camY);
  const goal = nearestReachable(current, tx, ty);
  if (goal) current.hero.path = findPath(current, tileOf(current.hero.x), tileOf(current.hero.y - 1), goal[0], goal[1]);
});
