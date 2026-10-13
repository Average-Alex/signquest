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
// 🪧 signposts with ASL facts and tips, and ✨ coins to pick up.
//
// Walk with the arrow keys / WASD, or tap where to go (the hero finds a way
// around things). Bump into a creature to battle it:
//   ⚔️  practice battle (letters)
//   📜  word battle - shows up once you've won a practice battle here
//   👑  the boss
//
// Each area also has a villager with a quest (quests.js): rescue, find,
// riddle, deliver, or gate guard. Finishing it opens that area's gate. A
// tracker under the map says what to do next, and a compass arrow at the
// edge points the way when it's off screen.
//
// The area is generated from the zone id, so it's the same every visit. The
// ground is painted once onto a canvas; trees, rocks, creatures, and the hero
// are drawn on top every frame, sorted by how far down they stand, so you can
// walk behind things.

import { getPrediction, HoldTimer } from "./classifier.js";
import {
  BIOME_AREAS, BOSS_EXTRA_LEVELS, CHEST_COINS, CHESTS_PER_AREA, COINS_PER_AREA, CONSUMABLES, creatureLevel, CREATURES,
  GUARD_EXTRA_LEVELS, isEvolved, QUEST_COINS, SIGNPOST_TEXTS, SIGNPOSTS_PER_AREA, SPARKLE_COINS, STAGES, TIPS, TRAINER_SIGHT,
  WILD_PER_AREA, ZONES,
} from "./config.js";
import * as progress from "./progress.js";
import { announce, flashCamera, isShowing, openBook, playStage, setHandImage, show } from "./screens.js";
import { QUESTS, ROOK } from "./quests.js";
import { trainersFor } from "./trainers.js";
import { creatureSrc, decorSrc, heroImg, heroSrc, landmarkSrc, LANDMARKS, SPRITE_SCALE, spriteCanvas } from "./sprites.js";
import { playCutscene } from "./cutscene.js";
import { playMusic } from "./music.js";
import { isStoryPlaying, playLines, playScene } from "./story.js";
import { hash, noise } from "./worldmap.js";

const $ = (id) => document.getElementById(id);

const T = 8; // tile size in pixels
const TW = 80; // tiles across the whole zone
const SH = 28; // tiles down one area
const TH = SH * BIOME_AREAS; // tiles down the whole zone
const W = TW * T;
const H = TH * T;
const VIEW_W = 48 * T; // the canvas shows this much at a time
const VIEW_H = SH * T;
const HERO_SPEED = 64; // pixels per second
const CREATURE_SPEED = 14;
const TOUCH_DISTANCE = 15; // sideways, feet to feet
const TOUCH_REACH_UP = 22; // the hero is tall, so walking up into a creature from below counts sooner
const SAFE_MS = 2500; // after a battle, creatures can't start another one right away
const RESPAWN_MS = 5000;

// Tile kinds
const GROUND = 0, PATH = 1, WATER_TILE = 2, BRIDGE_TILE = 3, GATE = 4;

// Area 0 is the bottom (entrance); the last area is the top (boss).
const areaTop = (a) => (BIOME_AREAS - 1 - a) * SH; // first tile row of an area
const areaOf = (py) => Math.min(BIOME_AREAS - 1, Math.max(0, BIOME_AREAS - 1 - Math.floor(py / (SH * T))));

// ---------- Routes between zones ----------
// The zones are joined into one world you can walk across, like routes
// between towns: each pair below is linked by a path off the side of both
// maps. Zone A's right edge (in area 2) leads to zone B's left edge (in
// area 3), and back. The world map is still there for fast travel.
// [a, b, area on a's side, area on b's side] (areas default to 2 and 3).
// Crown Keep, in the middle, has roads from the Meadow and to the River.
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

// ✨ Secrets: a hidden treasure in each area, out in the wilds away from the
// path. They only show up when you're close, so you have to go looking.
const SECRET_SEE = 44; // pixels
const SECRET_COINS = [20, 45];

const THEMES = {
  meadow: {
    ground: ["#86d35a", "#77c44c"], specks: ["#ff7fc8", "#ffe066", "#ffffff"], speckRate: 0.025,
    path: ["#e8cf8a", "#d4b874"], obstacles: ["bush", "bush", "pine"], wall: "pine", density: 0.75, water: "pond",
  },
  forest: {
    ground: ["#4ea44a", "#449a40"], specks: ["#2a6e30", "#6cc24a"], speckRate: 0.05,
    path: ["#b08a5a", "#9a7448"], obstacles: ["pine"], wall: "pine", density: 0.62, water: null,
  },
  caves: {
    ground: ["#5e5470", "#544a66"], specks: ["#8a809a", "#3e3650"], speckRate: 0.05,
    path: ["#8a7a6a", "#7a6a5a"], obstacles: ["rock", "crystal", "rock"], wall: "rock", density: 0.67, water: null,
  },
  river: {
    ground: ["#6cc24a", "#5fb43f"], specks: ["#9be07a", "#ffffff"], speckRate: 0.02,
    path: ["#f2dc9a", "#e0c880"], obstacles: ["pine", "rock", "bush"], wall: "pine", density: 0.73, water: "river",
  },
  castle: {
    ground: ["#a89a8a", "#9a8c7c"], specks: ["#8a7e70", "#c4b8a8"], speckRate: 0.05,
    path: ["#c9b9a0", "#b8a890"], obstacles: ["wall", "bush"], wall: "wall", density: 0.71, water: null,
  },
  // Crown Keep: pale royal stone, a red carpet for a path, hedges, and moat ponds.
  keep: {
    ground: ["#c9bfdc", "#bdb2d2"], specks: ["#ffd23f", "#ffffff", "#a89cc4"], speckRate: 0.03,
    path: ["#c8414b", "#b3343e"], obstacles: ["wall", "bush", "bush"], wall: "wall", density: 0.72, water: "pond",
  },
  spires: {
    ground: ["#cfe3f2", "#bcd6ec"], specks: ["#ffffff", "#c58cf0"], speckRate: 0.04,
    path: ["#9ab8d6", "#88a8c8"], obstacles: ["icecrystal", "crystal", "icecrystal"], wall: "icecrystal", density: 0.69, water: "pond",
  },
  clouds: {
    ground: ["#f2f4ff", "#e2e6f8"], specks: ["#ffe9a8", "#c8d0f0"], speckRate: 0.03,
    path: ["#ffe9a8", "#f2d88a"], obstacles: ["cloud", "cloud", "bush"], wall: "cloud", density: 0.67, water: null,
  },
  void: {
    ground: ["#2a1f3d", "#241a35"], specks: ["#ffffff", "#c58cf0", "#7fffd4"], speckRate: 0.03,
    path: ["#5a3f8a", "#4e3478"], obstacles: ["voidrock", "crystal", "voidrock"], wall: "voidrock", density: 0.69, water: null,
  },
};

const WATER = ["#3a95d4", "#4fa8e0"];
const SHORE = "#f2dc9a";
const BRIDGE = ["#a8743a", "#8a5a2a"];

// One saved biome per zone, so creatures and your spot stay put while you battle.
const biomes = new Map();

// After "Start over", zones get rebuilt from the fresh progress.
export function resetBiomes() {
  biomes.clear();
  current = null;
}
let current = null; // the biome on screen
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

  // A long path that snakes side to side from the entrance (bottom) to the boss (top).
  // It's 6 tiles wide and drifts at most ~2 tiles per row, so it's always
  // easy to walk along (steeper bends left gaps too narrow for the hero).
  const pathX = (ty) => Math.max(6, Math.min(TW - 7, Math.round(TW / 2 + Math.sin(ty * 0.06 + seed) * 26 + Math.sin(ty * 0.02 + seed * 2) * 6)));
  for (let ty = 0; ty < TH; ty++) {
    const cx = pathX(ty);
    carve([ty, ty], [cx - 3, cx + 2]);
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

  // Water: a pond in each area, or a river across the middle areas.
  for (let a = 0; a < BIOME_AREAS; a++) {
    const mid = areaTop(a) + 15;
    if (theme.water === "pond") {
      const px = pathX(mid) < TW / 2 ? TW - 16 : 15;
      for (let ty = mid - 4; ty <= mid + 4; ty++)
        for (let tx = px - 8; tx <= px + 8; tx++)
          if (Math.hypot((tx - px) / 7, (ty - mid) / 3.5) < 1 && kind[at(tx, ty)] !== PATH) kind[at(tx, ty)] = WATER_TILE;
    } else if (theme.water === "river" && a > 0 && a < BIOME_AREAS - 1) {
      for (let tx = 0; tx < TW; tx++) {
        const r = mid + Math.round(Math.sin(tx * 0.2 + a) * 1.5);
        for (let ty = r - 1; ty <= r + 1; ty++) kind[at(tx, ty)] = kind[at(tx, ty)] === PATH ? BRIDGE_TILE : WATER_TILE;
      }
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

  for (let i = 0; i < kind.length; i++) if (kind[i] === WATER_TILE) blocked[i] = 1;

  // Trees, rocks, etc. on a grid of 2 x 2 tiles: a solid border, the gate
  // walls, and clumps inside.
  const decor = [];
  const BW = TW / 2, BH = TH / 2;
  const gateBlockRows = new Set(gates.map((g) => areaTop(g.area) / 2));
  for (let by = 0; by < BH; by++) {
    for (let bx = 0; bx < BW; bx++) {
      const tiles = [[2 * bx, 2 * by], [2 * bx + 1, 2 * by], [2 * bx, 2 * by + 1], [2 * bx + 1, 2 * by + 1]];
      if (tiles.some(([tx, ty]) => kind[at(tx, ty)] !== GROUND)) continue;
      let type;
      if (gateBlockRows.has(by)) type = theme.wall;
      else {
        const border = bx === 0 || by === 0 || bx === BW - 1 || by === BH - 1;
        const nearStart = by >= BH - 3 && Math.abs(bx * 2 - pathX(TH - 2)) < 8;
        const clump = noise(bx, by, 3, seed) > theme.density || hash(bx, by, seed) < 0.06;
        if (!border && (nearStart || !clump)) continue;
        type = theme.obstacles[Math.floor(hash(bx, by, seed + 1) * theme.obstacles.length)];
      }
      decor.push({ type, x: bx * 16 + 8, y: by * 16 + 16 });
      for (const [tx, ty] of tiles) blocked[at(tx, ty)] = 1;
    }
  }

  // The zone's landmark at the top, drawn big like a real building.
  const lm = LANDMARKS[zone.id];
  const landmark = { x: W / 2, y: 7 * T, w: lm.w * 2, h: lm.h * 2 };
  for (let ty = Math.floor((landmark.y - landmark.h) / T); ty < landmark.y / T; ty++)
    for (let tx = Math.floor((landmark.x - landmark.w / 2) / T); tx < Math.ceil((landmark.x + landmark.w / 2) / T); tx++)
      if (ty >= 0) blocked[at(tx, ty)] = 1;

  // Start at the entrance, at the bottom.
  const startRow = TH - 3;
  const hero = { x: pathX(startRow) * T, y: startRow * T, flip: false, moving: false, path: [], trail: [] };

  const biome = {
    z, zone, theme, kind, blocked, decor, landmark, gates, hero, exits,
    secrets: [],
    bg: paintGround(theme, kind, seed),
    creatures: [],
    chests: [],
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
    items: [], // lost things to find for quests
    dust: [], // little puffs from footsteps
    atSign: null,
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
  // and anything you need to find, up near the gate.
  const story = QUESTS[zone.id];
  story?.steps.forEach((step, a) => {
    const giver = spot(a, 400, true, step.type === "guard" ? "high" : "low");
    if (giver) biome.npcs.push({ ...story.npcs[step.npc], id: step.npc, area: a, role: "giver", ...giver });
    if (step.type === "deliver") {
      const p = spot(a, 450, true, "high");
      if (p) biome.npcs.push({ ...story.npcs[step.to], id: step.to, area: a, role: "receiver", ...p });
    }
    if (step.type === "find") {
      const p = spot(a, 500, false, "high");
      const letters = zone.letters;
      if (p) biome.items.push({ area: a, name: step.item, letter: letters[Math.floor(hash(a, 3, seed + 60) * letters.length)], ...p });
    }
  });

  // Trainers stand near the path, in the middle of their area.
  for (const t of trainersFor(z)) {
    const p = spot(t.area, 600, true);
    if (p) biome.trainers.push({ ...t, ...p, homeX: p.x, homeY: p.y, beaten: progress.trainerBeaten(t.id) });
  }

  for (const gate of gates) if (!gate.open) for (const i of gate.tiles) blocked[i] = 1;
  placeOnOpenGround(biome, hero);
  biome.reachable = floodFrom(biome, tileOf(hero.x), tileOf(hero.y - 1));

  // The boss (until beaten), a guard at each closed gate, and wild creatures.
  const wild = CREATURES.filter((c) => c.zone === zone.id && c.kind === "wild");
  if (!progress.bossBeaten(z)) {
    const boss = CREATURES.find((c) => c.zone === zone.id && c.kind === "boss");
    const level = creatureLevel(z, BIOME_AREAS - 1) + BOSS_EXTRA_LEVELS;
    biome.creatures.push({ id: boss.id, stage: 2, boss: true, area: BIOME_AREAS - 1, level, x: W / 2 + landmark.w / 2 + 22, y: landmark.y + 3 * T, home: true });
  }
  for (const gate of gates) {
    // A guard quest has a tough creature waiting by the gateway until it's beaten.
    if (story?.steps[gate.area]?.type !== "guard" || progress.questState(z, gate.area).done) continue;
    const row = areaTop(gate.area) + 6;
    biome.creatures.push({
      id: wild[gate.area % wild.length].id,
      guard: gate.area,
      stage: gate.area === 0 ? 0 : 1, // the first guard is a letter battle, later ones are words
      area: gate.area,
      level: creatureLevel(z, gate.area) + GUARD_EXTRA_LEVELS,
      x: pathX(row) * T,
      y: row * T,
      home: true,
    });
  }
  for (let a = 0; a < BIOME_AREAS; a++) for (let i = 0; i < WILD_PER_AREA; i++) spawnWild(biome, a);
  return biome;
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
      if (k === WATER_TILE) {
        c = WATER[noise(x, y, 6, seed + 5) > 0.6 ? 1 : 0];
        if (hash(x, y, seed + 6) < 0.01) c = "#a8e0ff";
        // Sandy edge where water meets land.
        if ([kindAt(x - 1, y), kindAt(x + 1, y), kindAt(x, y - 1), kindAt(x, y + 1)].some((n) => n === GROUND || n === PATH)) c = SHORE;
      } else if (k === BRIDGE_TILE) {
        c = BRIDGE[y % 4 === 0 ? 1 : 0];
      } else if (k === PATH || k === GATE) {
        c = theme.path[noise(x, y, 4, seed + 7) > 0.55 ? 1 : 0];
        if (hash(x, y, seed + 8) < 0.03) c = theme.path[1];
      } else {
        c = theme.ground[noise(x, y, 6, seed + 9) > 0.6 ? 1 : 0];
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
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// ---------- Battle backdrops ----------
// The battle field for a zone: a top-down clearing in the zone's colors, with
// dirt patches where the fighters stand, scenery around the edges (big trees
// in front), and a pond at the top in watery zones.

const FIELD_W = 320;
const FIELD_H = 180;
const backdrops = new Map();

export function battleBackdropSrc(zoneId) {
  if (backdrops.has(zoneId)) return backdrops.get(zoneId);
  const theme = THEMES[zoneId];
  const seed = [...zoneId].reduce((n, ch) => n + ch.charCodeAt(0), 0);

  // The ground, one game pixel at a time.
  const ground = document.createElement("canvas");
  ground.width = FIELD_W;
  ground.height = FIELD_H;
  const gctx = ground.getContext("2d");
  const image = gctx.createImageData(FIELD_W, FIELD_H);
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const blob = (x, y, cx, cy, rx, ry, wobble) => Math.hypot((x - cx) / rx, (y - cy) / ry) + (noise(x, y, 7, seed + wobble) - 0.5) * 0.45;
  // Where fighters stand (see .buddy-slot / .hero-slot / .monster-side in style.css):
  // your team in a column on the left, the monster on the right.
  const pads = [[58, 73, 24, 9], [77, 124, 30, 11], [58, 155, 24, 9], [240, 121, 54, 22], [306, 70, 20, 10], [170, 168, 30, 9]];
  const pond = theme.water ? { cx: 172, cy: 12, rx: 52, ry: 30 } : null;
  for (let y = 0; y < FIELD_H; y++) {
    for (let x = 0; x < FIELD_W; x++) {
      let c = theme.ground[noise(x, y, 16, seed) > 0.56 ? 1 : 0]; // big darker patches, like mown grass
      if (hash(x, y, seed + 1) < theme.speckRate) c = theme.specks[Math.floor(hash(x, y, seed + 2) * theme.specks.length)];
      for (const [i, [cx, cy, rx, ry]] of pads.entries()) {
        const d = blob(x, y, cx, cy, rx, ry, i);
        if (d < 1) c = theme.path[d < 0.8 && noise(x, y, 4, seed + 3) > 0.5 ? 1 : 0];
      }
      if (pond) {
        const d = blob(x, y, pond.cx, pond.cy, pond.rx, pond.ry, 9);
        if (d < 1.08) c = SHORE;
        if (d < 1) c = WATER[noise(x, y, 6, seed + 4) > 0.6 ? 1 : 0];
        if (d < 1 && hash(x, y, seed + 5) < 0.012) c = "#a8e0ff";
      }
      const [r, g, b] = rgb(c);
      const i = (y * FIELD_W + x) * 4;
      image.data.set([r, g, b, 255], i);
    }
  }
  gctx.putImageData(image, 0, 0);

  // Scale up and add scenery at full sprite detail.
  const canvas = document.createElement("canvas");
  canvas.width = FIELD_W * SPRITE_SCALE;
  canvas.height = FIELD_H * SPRITE_SCALE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ground, 0, 0, canvas.width, canvas.height);
  ctx.setTransform(SPRITE_SCALE, 0, 0, SPRITE_SCALE, 0, 0);

  const items = [];
  const pick = (i, salt) => theme.obstacles[Math.floor(hash(i, salt, seed) * theme.obstacles.length)];
  const inPond = (x, y) => pond && Math.hypot((x - pond.cx) / (pond.rx + 10), (y - pond.cy) / (pond.ry + 10)) < 1;
  // Back rows along the top.
  for (let x = -6; x < FIELD_W + 8; x += 15) {
    for (const [row, y0] of [[0, 18], [1, 34]]) {
      const x1 = x + (row ? 7 : 0) + hash(x, row, seed) * 6, y = y0 + hash(x, row + 2, seed) * 8;
      if (row === 1 && hash(x, 9, seed) < 0.45) continue;
      if (!inPond(x1, y - 6)) items.push({ type: pick(x, row), x: x1, y, scale: 1 });
    }
  }
  // Clumps down the sides.
  for (let y = 50; y < FIELD_H - 20; y += 14) {
    items.push({ type: pick(y, 5), x: 4 + hash(y, 6, seed) * 10, y, scale: 1 });
    items.push({ type: pick(y, 7), x: FIELD_W - 4 - hash(y, 8, seed) * 10, y, scale: 1 });
  }
  // Big scenery in front, along the bottom, partly cut off.
  for (let x = 10; x < FIELD_W; x += 34) {
    if (x < 110 || Math.abs(x - 240) < 30) continue; // keep the fighters in view
    items.push({ type: pick(x, 11), x: x + hash(x, 12, seed) * 10, y: FIELD_H + 10, scale: 2 });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const img = spriteCanvas(decorSrc(it.type));
    const w = (img.width / SPRITE_SCALE) * it.scale, h = (img.height / SPRITE_SCALE) * it.scale;
    ctx.drawImage(img, Math.round(it.x - w / 2), Math.round(it.y - h), w, h);
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
      id: wild[Math.floor(Math.random() * wild.length)].id,
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
      c.dir = Math.random() < 0.3 ? null : Math.random() * Math.PI * 2; // sometimes stand still
      c.turnAt = now + 1000 + Math.random() * 2000;
    }
    if (c.dir === null) continue;
    const nx = c.x + Math.cos(c.dir) * CREATURE_SPEED * dt;
    const ny = c.y + Math.sin(c.dir) * CREATURE_SPEED * dt;
    const inArea = ny > (areaTop(c.area) + 3) * T && ny < (areaTop(c.area) + SH - (c.area === 0 ? 5 : 1)) * T;
    if (inArea && feetFree(biome, nx, ny)) {
      c.x = nx;
      c.y = ny;
      c.flip = Math.cos(c.dir) > 0;
      c.moving = true;
    } else c.turnAt = 0;
  }
}

// Which walk-cycle frame to show: cycles while moving, feet down when still.
// `msPerFrame` sets the pace; `offset` keeps everyone from stepping in sync.
const walkFrame = (moving, now, msPerFrame, offset = 0) => (moving ? Math.floor(now / msPerFrame + offset) % 4 : 0);

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

  if (now < biome.safeUntil) return;

  // ⚔️ Trainers: beaten ones chat; anyone else who sees you wants a battle.
  const trainer = biome.trainers.find((t) => near(t, hero, 12));
  if (trainer?.beaten) return say(biome, [[trainerSpeaker(trainer), trainer.chat]]);
  const area = areaOf(hero.y);
  const watcher = biome.trainers.find(
    (t) => !t.beaten && t.area === area && now > (t.restUntil || 0) && Math.hypot(t.x - hero.x, t.y - hero.y) < TRAINER_SIGHT,
  );
  if (watcher) return spotYou(biome, watcher, now);

  // 💬 Villagers: walk up to talk.
  const villager = biome.npcs.find((v) => near(v, hero, 12));
  if (villager) return talkTo(biome, villager);

  // ✨ Lost things, once someone has asked you to find them.
  const item = biome.items.find((it) => !it.taken && !progress.questState(biome.z, it.area).have && progress.questState(biome.z, it.area).accepted && near(it, hero, 10));
  if (item) return pickUpItem(biome, item);
  for (const c of biome.creatures) {
    if (c.freed) continue; // healed creatures are friends now
    // Touching = close sideways, and the creature's feet anywhere from a bit
    // below the hero's feet up to about the hero's chest.
    const extra = c.boss ? 12 : 0;
    const dx = Math.abs(c.x - hero.x);
    const dy = c.y - hero.y; // negative when the creature is higher up
    if (dx > TOUCH_DISTANCE + extra || dy > 10 || dy < -(TOUCH_REACH_UP + extra)) continue;

    if (c.rare) toast(`🌟 A rare ${CREATURES.find((x) => x.id === c.id).name}! It's far from home.`);
    startEncounter(biome, c);
    return;
  }
}

// ---------- Trainers ----------

const trainerSpeaker = (t) => ({ name: t.name, art: () => heroImg(t.look, null, "", true) });

// ❗ A trainer spots you: you freeze, they walk over (runSpot), and battle.
function spotYou(biome, t, now) {
  biome.spotted = { t, since: now };
  keys.clear();
  biome.hero.path = [];
  biome.hero.moving = false;
  announce(`${t.name} spotted you!`);
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
  setTimeout(() => {
    $("biome-wrap").classList.remove("encounter");
    const fight = () => playStage(biome.z, creature.stage, creature.id, creature.level, { owner: creature.owner, team: creature.team, prize: creature.prize });
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

// ---------- Quests ----------

const questFor = (biome, area) => QUESTS[biome.zone.id]?.steps[area];
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
      if (step.type === "riddle") askRiddle(biome, v.area);
    });
  }

  // Already on this quest.
  if (step.type === "riddle") return askRiddle(biome, v.area);
  const ready = (step.type === "free" && state.count >= step.count) || (step.type === "find" && state.have);
  if (ready) return say(biome, step.done, () => completeQuest(biome, v.area));
  const reminders = {
    free: `Only ${step.count - state.count} more to free! They're wandering around here somewhere.`,
    find: `Have you found ${step.item} yet? It's somewhere in this area. Follow the arrow!`,
    deliver: `Please hurry! ${receiver?.name} is waiting just up the path.`,
    guard: "The guard is right by the gate. You can do it!",
  };
  return say(biome, [[giver.id, reminders[step.type]]]);
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

function pickUpItem(biome, item) {
  const giver = biome.npcs.find((v) => v.area === item.area && v.role === "giver");
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

function completeQuest(biome, area) {
  const step = questFor(biome, area);
  progress.updateQuest(biome.z, area, { done: true });
  progress.addCoins(QUEST_COINS);
  // A thank-you present too.
  const gift = CONSUMABLES[Math.floor(Math.random() * CONSUMABLES.length)];
  progress.addConsumable(gift.id);
  renderCoins();
  toast(`✅ Side quest complete: ${step.title}! +${QUEST_COINS} 🪙 and a ${gift.name}!`, 4500);
  announce(`Side quest complete! You got ${QUEST_COINS} coins and a ${gift.name}.`);
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
    else if (step.type === "find" && !state.have) goal = biome.items.find((it) => it.area === area);
    else if (step.type === "guard") goal = biome.creatures.find((c) => c.guard === area);
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
function openSignPanel(biome, { title, word, reveal = false, onDone }) {
  biome.chest = { word, i: 0, reveal, onDone, hold: new HoldTimer(), done: false };
  biome.hero.path = [];
  keys.clear();
  $("sign-title").innerHTML = title;
  $("chest-hold").style.width = "0%";
  $("chest-status").textContent = "";
  $("chest-status").className = "status";
  $("chest-panel").hidden = false;
  $("camera-video").play().catch(() => {});
  showSignLetter(biome);
  announce(`${title.replace(/<[^>]+>/g, "")} ${reveal ? "" : `Sign ${word.split("").join(" ")}.`}`);
}

function showSignLetter(biome) {
  const { word, i, reveal } = biome.chest;
  const letter = word[i];
  $("chest-big").innerHTML = word
    .split("")
    .map((l, n) => `<span class="sign-slot${n < i ? " done" : n === i ? " now" : ""}">${n < i || !reveal || n === i ? l : "?"}</span>`)
    .join("");
  $("chest-tip").textContent = TIPS[letter];
  setHandImage($("chest-img"), letter);
}

function signTick(biome, now) {
  const task = biome.chest;
  if (task.done) return;
  const held = task.hold.update(task.word[task.i], getPrediction(), now);
  $("chest-hold").style.width = `${held * 100}%`;
  if (held < 1) return;
  flashCamera("good");
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
  // Usually coins; sometimes a potion or power-up.
  let reward;
  if (Math.random() < 0.3) {
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
  // Everything below is in game pixels; the canvas has SPRITE_SCALE real pixels for each.
  ctx.setTransform(SPRITE_SCALE, 0, 0, SPRITE_SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const camX = Math.round(biome.camX), camY = Math.round(biome.camY);
  ctx.drawImage(biome.bg, camX, camY, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

  const things = [];
  const sprite = (type) => spriteCanvas(decorSrc(type));
  for (const d of biome.decor) things.push({ y: d.y, img: sprite(d.type), x: d.x });
  for (const g of biome.gates) {
    if (g.open) continue;
    for (let tx = g.minX; tx <= g.maxX; tx += 2) things.push({ y: g.y, img: sprite("gate"), x: tx * T + T });
  }
  for (const c of biome.chests) things.push({ y: c.y, img: sprite(c.open ? "chestopen" : "chest"), x: c.x, shadow: true });
  for (const s of biome.signposts) things.push({ y: s.y, img: sprite("signpost"), x: s.x, shadow: true });
  for (const c of biome.coins) if (!c.taken) things.push({ y: c.y, img: sprite("coin"), x: c.x, lift: Math.floor(now / 300 + c.x) % 3 });
  things.push({ y: biome.landmark.y, img: spriteCanvas(landmarkSrc(biome.zone.id)), x: biome.landmark.x, scale: 2 });
  for (const c of biome.creatures) {
    // Walking: step through the walk cycle. Standing: a slow breathing bob.
    const frame = walkFrame(c.moving, now, 170, c.x);
    const lift = c.moving ? frame % 2 : Math.floor(now / 400 + c.x) % 2;
    things.push({ y: c.y, img: spriteCanvas(creatureSrc(c.id, !c.freed, frame)), x: c.x, flip: c.flip, scale: c.boss ? 2 : 1, lift, shadow: true, hex: !c.freed });
  }
  // Your buddies follow a few steps behind, one after the other, in step with you.
  const hero = biome.hero;
  progress.team().forEach((pet, n) => {
    const back = hero.trail.length - 1 - (n + 1) * 8; // about 16 pixels apart
    const spot = hero.trail[Math.max(0, back)] || { x: hero.x - 12 * (n + 1), y: hero.y, flip: hero.flip };
    const frame = walkFrame(hero.moving, now, 110, n * 2 + 1);
    things.push({ y: spot.y - 0.5 - n * 0.1, img: spriteCanvas(creatureSrc(pet.id, false, frame, isEvolved(pet.level))), x: spot.x, flip: !spot.flip, shadow: true, small: true, lift: frame % 2 });
  });
  // Villagers face you and breathe gently.
  for (const v of biome.npcs) {
    const lift = Math.floor(now / 500 + v.x) % 2;
    things.push({ y: v.y, img: spriteCanvas(heroSrc(v.look, v.hat, 0, Boolean(v.wand))), x: v.x, flip: hero.x < v.x, lift, shadow: true });
  }
  // Trainers face you; they walk when they come over to battle.
  for (const t of biome.trainers) {
    const frame = walkFrame(t.moving, now, 110, t.x);
    const lift = t.moving ? frame % 2 : Math.floor(now / 500 + t.x) % 2;
    things.push({ y: t.y, img: spriteCanvas(heroSrc(t.look, null, frame, true)), x: t.x, flip: hero.x < t.x, lift, shadow: true });
  }
  // Malgrath or Rook, during a story event.
  for (const a of biome.actors) {
    const img = a.kind === "malgrath" ? creatureSrc("malgrath") : heroSrc(ROOK.look, null, 0, true);
    things.push({ y: a.y, img: spriteCanvas(img), x: a.x, flip: hero.x < a.x, lift: Math.floor(now / 350) % 2, shadow: true, hex: a.kind === "malgrath" });
  }
  const frame = walkFrame(hero.moving, now, 110);
  // A little puff of dust behind you on each step.
  if (frame !== hero.lastFrame && frame % 2) biome.dust.push({ x: hero.x + (hero.flip ? 4 : -4), y: hero.y, born: now });
  hero.lastFrame = frame;
  things.push({ y: hero.y, img: spriteCanvas(heroSrc(progress.get().look, progress.get().equipped.hat, frame)), x: hero.x, flip: hero.flip, lift: frame % 2, shadow: true });

  biome.dust = biome.dust.filter((p) => now - p.born < 350);
  for (const p of biome.dust) {
    const age = (now - p.born) / 350;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * (1 - age)})`;
    ctx.beginPath();
    ctx.ellipse(p.x - camX + (hero.flip ? age * 3 : -age * 3), p.y - 1 - camY - age * 2, 1.5 + age * 2, 1 + age, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  things.sort((a, b) => a.y - b.y);
  for (const t of things) {
    const iw = t.img.width / SPRITE_SCALE, ih = t.img.height / SPRITE_SCALE; // size in game pixels
    let w = iw * (t.scale || 1), h = ih * (t.scale || 1);
    if (t.small && iw > 12) (w = iw * 0.75), (h = ih * 0.75);
    if (t.y < camY - 4 || t.y - h > camY + VIEW_H + 4 || t.x + w / 2 < camX || t.x - w / 2 > camX + VIEW_W) continue; // off screen
    const x = Math.round(t.x - w / 2) - camX, y = Math.round(t.y - h - (t.lift || 0)) - camY;
    if (t.shadow) {
      // Hexbound creatures stand in a purple glow instead of a plain shadow.
      // Hexbound creatures cast a darker, murky shadow.
      ctx.fillStyle = t.hex ? "rgba(30,6,40,0.45)" : "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(t.x - camX, t.y - 1 - camY, w / 2.6, t.hex ? 2.5 : 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (t.flip) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(t.img, 0, 0, w, h);
      ctx.restore();
    } else ctx.drawImage(t.img, x, y, w, h);
  }

  // Markers over creatures (⚔️ / 📜 / 👑 / 💤 and level) and locked chests,
  // as HTML so they stay crisp.
  const markers = [
    ...biome.creatures.map((c) => {
      let icon = STAGES[c.stage].icon;
      if (c.freed) {
        const h = ((c.boss ? 2 : 1) * spriteCanvas(creatureSrc(c.id)).height) / SPRITE_SCALE;
        return { x: c.x, y: c.y - h - 2, html: "💚", cls: " freed" };
      }
      if (c.rare) icon = "🌟";
      const h = ((c.boss ? 2 : 1) * spriteCanvas(creatureSrc(c.id)).height) / SPRITE_SCALE;
      return { x: c.x, y: c.y - h - 2, html: `${icon}<small>${c.rare ? "Rare! " : ""}Lv ${c.level}</small>`, cls: c.boss ? " boss" : c.rare ? " rare" : "" };
    }),
    ...biome.chests.filter((c) => !c.open).map((c) => ({ x: c.x, y: c.y - 14, html: `🔐<small>${c.letter}</small>`, cls: " chest" })),
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
    // Lost things sparkle once someone has asked you to find them.
    ...biome.items
      .filter((it) => !it.taken && progress.questState(biome.z, it.area).accepted && !progress.questState(biome.z, it.area).have)
      .map((it) => ({ x: it.x, y: it.y, html: "✨", cls: " item" })),
  ];
  const labels = $("biome-labels");
  if (labels.children.length !== markers.length) labels.innerHTML = markers.map(() => `<span class="biome-label"></span>`).join("");
  markers.forEach((m, i) => {
    const el = labels.children[i];
    const left = m.x - camX, top = m.y - camY;
    el.hidden = top < -10 || top > VIEW_H || left < -10 || left > VIEW_W + 10;
    if (el.hidden) return;
    if (el.innerHTML !== m.html) el.innerHTML = m.html;
    el.className = `biome-label${m.cls}`;
    el.style.left = `${(left / VIEW_W) * 100}%`;
    el.style.top = `${(top / VIEW_H) * 100}%`;
  });

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
  const ready = (step.type === "free" && state.count >= step.count) || (step.type === "find" && state.have) || step.type === "riddle";
  return ready ? "❓" : "💬";
}

// The status line under the map: where you are and what you've found. It
// doesn't tell you what to do next: you choose.
function renderHud(biome) {
  const z = biome.z;
  const here = areaOf(biome.hero.y);
  const quests = QUESTS[biome.zone.id]?.steps || [];
  const questsDone = quests.filter((_, a) => progress.questState(z, a).done).length;
  // The quest you're on that's nearest, if any.
  const active = quests.map((step, a) => ({ step, a, state: progress.questState(z, a) })).filter((q) => q.state.accepted && !q.state.done);
  const onQuest = active.find((q) => q.a === here) || active[0];
  let doing = progress.bossBeaten(z) ? "🏆 Shard found! Free roam" : "🧭 Explore! The 👑 boss is at the top";
  if (onQuest) {
    const { step, state } = onQuest;
    doing = step.type === "free" && state.count < step.count ? `📜 ${step.title}: ${state.count} / ${step.count}` : `📜 ${step.title}`;
  }
  const opened = biome.chests.filter((c) => c.open).length;
  const beaten = biome.trainers.filter((t) => t.beaten).length;
  const secrets = biome.secrets.filter((sc) => sc.found).length;
  const html = `<span class="goal">📍 Area ${here + 1} of ${BIOME_AREAS}</span><span class="goal">${doing}</span><span class="goal">❗ Side quests ${questsDone} / ${quests.length}</span><span class="goal">🔐 Chests ${opened} / ${biome.chests.length}</span><span class="goal">✨ Secrets ${secrets} / ${biome.secrets.length}</span><span class="goal">⚔️ Trainers ${beaten} / ${biome.trainers.length}</span>`;
  if ($("biome-goals").innerHTML !== html) $("biome-goals").innerHTML = html;
}

function renderCoins() {
  $("biome-coins").textContent = progress.get().coins;
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

const cameraTarget = (biome) => ({
  x: Math.max(0, Math.min(W - VIEW_W, biome.hero.x - VIEW_W / 2)),
  y: Math.max(0, Math.min(H - VIEW_H, biome.hero.y - VIEW_H * 0.6)),
});

function frame(now) {
  if (!current || !isShowing("biome")) return;
  requestAnimationFrame(frame);
  const biome = current;
  const dt = Math.min(0.05, (now - (biome.last || now)) / 1000);
  biome.last = now;
  const talking = isStoryPlaying();
  if (biome.chest) {
    signTick(biome, now);
  } else if (biome.spotted) {
    if (!talking) runSpot(biome, now, dt);
  } else if (!talking) {
    moveHero(biome, dt);
    moveCreatures(biome, dt, now);
  }
  const target = cameraTarget(biome);
  biome.camX += (target.x - biome.camX) * Math.min(1, dt * 6);
  biome.camY += (target.y - biome.camY) * Math.min(1, dt * 6);

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
  if (!biome.chest && !biome.spotted && !isStoryPlaying() && current === biome) checkTouch(biome, now);
  if (biome === current && !biome.chest) renderHud(biome);
}

// `from`: the zone you walked in from, along a road (null from the map).
export function enterBiome(z, from = null) {
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
  const canvas = $("biome-canvas");
  canvas.width = VIEW_W * SPRITE_SCALE;
  canvas.height = VIEW_H * SPRITE_SCALE;
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
    }
    requestAnimationFrame(frame);
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
  if (!dir || !current || current.chest || current.spotted || !isShowing("biome") || e.target.closest?.("input, textarea, select")) return;
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
  if (!current || current.chest || current.spotted) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const tx = tileOf(((e.clientX - rect.left) / rect.width) * VIEW_W + current.camX);
  const ty = tileOf(((e.clientY - rect.top) / rect.height) * VIEW_H + current.camY);
  const goal = nearestReachable(current, tx, ty);
  if (goal) current.hero.path = findPath(current, tileOf(current.hero.x), tileOf(current.hero.y - 1), goal[0], goal[1]);
});
