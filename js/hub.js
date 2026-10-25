// ☁️ Skyhaven: a town on a floating island, off the edge of the Overworld map.
// No wild creatures and no quests: just a place to walk around with everyone
// else who's here (the server says where they are, a few times a second), and
// say hi with emotes. Two big things to do:
//   ⏳ The Spire of Ages (tower.js): a 50-floor tower to climb, floor by floor.
//   🌀 The Rift: now and then a Rift raid boss comes through it (one at a time,
//      on a clock everyone shares; serve.py RIFT_BOSSES). Step into the stone
//      circle to raid it with everyone else (raid.js). They're only ever met here.
// And a notice board, with which Rift bosses are coming next.

import { CREATURES } from "./config.js";
import * as progress from "./progress.js";
import { announce, show } from "./screens.js";
import { creatureSrc, heroSrc, SPRITE_SCALE, spriteCanvas } from "./sprites.js";
import { openSpire } from "./tower.js";
import { openRaid, RIFT_TIER } from "./raid.js";

const $ = (id) => document.getElementById(id);

export const HUB_W = 440;
export const HUB_H = 260;
const SCALE = 3; // real canvas pixels per game pixel
const SPEED = 72;
const POLL_MS = 400;
const EMOTE_MS = 3000;
const PEOPLE = 1.3 / SPRITE_SCALE; // game pixels per sprite pixel for people (smaller than the Arena's, so the island feels big)
export const EMOTES = ["👋", "😄", "🎉", "❤️", "😮", "⚔️"];

// The island: an oval of grass (with a wobbly edge), walkable inside.
const ISLAND = { x: 220, y: 158, rx: 208, ry: 90 };
// Landmarks: where they stand, and how close counts as "at" them.
const SPIRE = { x: 78, y: 122, door: { x: 78, y: 128 } };
const RIFT = { x: 354, y: 134, rx: 46, ry: 24 };
const FOUNTAIN = { x: 220, y: 172, r: 22 };
const PLAZA = { x: 220, y: 174, rx: 50, ry: 30 };
const BOARD = { x: 150, y: 226 };
const LAMPS = [{ x: 166, y: 150 }, { x: 274, y: 150 }, { x: 204, y: 238 }, { x: 236, y: 238 }];
const BENCHES = [{ x: 180, y: 204 }, { x: 260, y: 204 }];
const TREES = [{ x: 150, y: 96 }, { x: 296, y: 94 }, { x: 400, y: 176 }, { x: 40, y: 182 }, { x: 112, y: 232 }, { x: 330, y: 236 }, { x: 222, y: 88 }];
const STONES = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
  return { x: Math.round(RIFT.x + Math.cos(a) * (RIFT.rx - 4)), y: Math.round(RIFT.y + Math.sin(a) * (RIFT.ry - 2)) };
});
const OBSTACLES = [
  { x: FOUNTAIN.x, y: FOUNTAIN.y, r: FOUNTAIN.r },
  { x: SPIRE.x, y: SPIRE.y - 8, r: 22 },
  { x: BOARD.x, y: BOARD.y - 2, r: 9 },
  ...LAMPS.map((l) => ({ x: l.x, y: l.y - 1, r: 3 })),
  ...BENCHES.map((b) => ({ x: b.x, y: b.y - 1, r: 9 })),
  ...TREES.map((t) => ({ x: t.x, y: t.y - 1, r: 6 })),
  ...STONES.map((s) => ({ x: s.x, y: s.y - 1, r: 4 })),
];
// The island's edge wobbles a little, the same way every time.
const wobble = (a) => 1 + 0.03 * Math.sin(a * 5) + 0.02 * Math.sin(a * 11 + 1);
const islandD = (x, y) => {
  const dx = (x - ISLAND.x) / ISLAND.rx, dy = (y - ISLAND.y) / ISLAND.ry;
  return Math.hypot(dx, dy) / wobble(Math.atan2(dy, dx));
};
const inIsland = (x, y) => islandD(x, y) < 0.94;
const free = (x, y) => inIsland(x, y) && OBSTACLES.every((o) => Math.hypot(x - o.x, (y - o.y) * 1.6) > o.r);

// A steady random number for (x, y), so the ground looks the same every time.
const rand = (x, y, k = 0) => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

let hub = null; // while you're here: { me, others, rift, emote, ... }
const canvas = $("hub-canvas");
canvas.width = HUB_W * SCALE;
canvas.height = HUB_H * SCALE;
const ctx = canvas.getContext("2d");

function myId() {
  let id = progress.get().arenaId;
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    progress.update({ arenaId: id });
  }
  return id;
}

async function call(action, body = {}) {
  const res = await fetch(`/api/hub/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: myId(), ...body }) });
  if (!res.ok) throw new Error(`Skyhaven server: ${res.status}`);
  return res.json();
}

// ---------- Coming and going ----------

export function openHub() {
  const keepMe = hub?.me;
  hub = {
    me: keepMe || { x: 220, y: 238, flip: false, moving: false, goal: null },
    others: new Map(), rift: null, online: null, emote: null, emoteAt: 0, sendEmote: null, at: null, last: 0,
  };
  show("hub");
  $("hub-coins").textContent = progress.get().coins;
  renderEmotes();
  // This visit's loops stop as soon as you leave (or come back: a new visit starts its own).
  const visit = hub;
  poll(visit);
  requestAnimationFrame((t) => frame(t, visit));
  announce("Skyhaven. Walk around with everyone here. The Spire of Ages is on the left, and the Rift on the right.");
}

function leave() {
  if (!hub) return;
  call("leave").catch(() => {});
  hub = null;
}

async function poll(visit) {
  if (hub !== visit) return;
  const me = hub.me;
  try {
    const out = await call("state", { name: progress.get().name || "Hero", look: progress.heroLook(), hat: progress.get().equipped.hat, pos: { x: me.x, y: me.y, flip: me.flip }, emote: hub.sendEmote });
    if (hub !== visit) return;
    hub.sendEmote = null;
    hub.online = true;
    hub.rift = { ...out.rift, at: performance.now() };
    const next = new Map();
    for (const o of out.others || []) {
      const had = hub.others.get(o.tag);
      next.set(o.tag, { ...o, x: had ? had.x : o.pos.x, y: had ? had.y : o.pos.y, tx: o.pos.x, ty: o.pos.y, flip: o.pos.flip });
    }
    hub.others = next;
  } catch {
    if (hub === visit) hub.online = false;
  }
  if (hub === visit) setTimeout(() => poll(visit), POLL_MS);
}

// ---------- Every frame ----------

const KEY_DIRS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down" };
const keys = new Set();
addEventListener("keydown", (e) => {
  if (!hub || $("screen-hub").hidden || e.target.closest?.("input, textarea, select")) return;
  const dir = KEY_DIRS[e.key];
  if (dir) {
    keys.add(dir);
    e.preventDefault();
  }
  // 1-6: emotes.
  const n = Number(e.key);
  if (n >= 1 && n <= EMOTES.length) emote(EMOTES[n - 1]);
});
addEventListener("keyup", (e) => keys.delete(KEY_DIRS[e.key]));
addEventListener("blur", () => keys.clear());
canvas.addEventListener("pointerdown", (e) => {
  if (!hub) return;
  const r = canvas.getBoundingClientRect();
  hub.me.goal = { x: ((e.clientX - r.left) / r.width) * HUB_W, y: ((e.clientY - r.top) / r.height) * HUB_H };
});

function move(dt) {
  const me = hub.me;
  let dx = 0, dy = 0;
  if (keys.has("left")) dx -= 1;
  if (keys.has("right")) dx += 1;
  if (keys.has("up")) dy -= 1;
  if (keys.has("down")) dy += 1;
  if (dx || dy) me.goal = null;
  else if (me.goal) {
    const gx = me.goal.x - me.x, gy = me.goal.y - me.y;
    const d = Math.hypot(gx, gy);
    if (d < 2) me.goal = null;
    else (dx = gx / d), (dy = gy / d);
  }
  const len = Math.hypot(dx, dy);
  me.moving = len > 0;
  if (!len) return;
  const step = (SPEED * dt) / len;
  const nx = me.x + dx * step, ny = me.y + dy * step;
  // Slide along edges: try both, then each way alone.
  if (free(nx, ny)) (me.x = nx), (me.y = ny);
  else if (free(nx, me.y)) me.x = nx;
  else if (free(me.x, ny)) me.y = ny;
  else me.goal = null;
  if (dx) me.flip = dx < 0;
}

function frame(now, visit) {
  if (hub !== visit) return;
  if ($("screen-hub").hidden) return leave();
  requestAnimationFrame((t) => frame(t, visit));
  const dt = Math.min(0.05, (now - (hub.last || now)) / 1000);
  hub.last = now;
  move(dt);
  for (const o of hub.others.values()) {
    const k = Math.min(1, dt * 8);
    o.x += (o.tx - o.x) * k;
    o.y += (o.ty - o.y) * k;
  }
  // What you're standing at: the Spire's door, the Rift, or the notice board.
  const me = hub.me;
  const at = Math.hypot(me.x - SPIRE.door.x, me.y - SPIRE.door.y) < 16 ? "spire"
    : ((me.x - RIFT.x) / RIFT.rx) ** 2 + ((me.y - RIFT.y) / RIFT.ry) ** 2 < 0.8 ? "rift"
    : Math.hypot(me.x - BOARD.x, me.y - BOARD.y) < 18 ? "board" : null;
  if (at !== hub.at || at === "rift" || at === "board") renderAction(at);
  hub.at = at;
  $("hub-count").textContent = hub.online === false ? "📴 Offline" : `👥 ${hub.others.size + 1} here`;
  draw(now);
}

// ---------- What you can do where you're standing ----------

const riftBoss = () => (hub?.rift?.boss ? CREATURES.find((c) => c.id === hub.rift.boss) : null);
const riftLeft = (key) => Math.max(0, (hub.rift?.[key] || 0) - (performance.now() - hub.rift.at) / 1000);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const nameOf = (id) => CREATURES.find((c) => c.id === id)?.name || "???";

function renderAction(at) {
  const box = $("hub-action");
  const go = $("hub-action-go");
  box.hidden = !at;
  if (!at) return;
  if (at === "spire") {
    const floor = progress.spireFloor();
    $("hub-action-text").textContent = `⏳ The Spire of Ages · ${floor ? `you've climbed ${floor} of 50 floors` : "50 floors, each a battle"}`;
    go.hidden = false;
    go.textContent = "Enter the Spire";
    go.onclick = () => {
      leave();
      openSpire(() => openHub());
    };
    return;
  }
  if (at === "board") {
    $("hub-action-text").textContent = hub.rift
      ? `📜 Rift schedule: ${riftBoss() ? `${riftBoss().name} is out now!` : "the Rift is calm."} Next: ${(hub.rift.schedule || []).map(nameOf).join(", then ")}.`
      : "📜 The notice board needs the SignQuest server to show the Rift schedule.";
    go.hidden = true;
    return;
  }
  // The Rift.
  const boss = riftBoss();
  go.hidden = !boss;
  if (!hub.rift) $("hub-action-text").textContent = "🌀 The Rift needs the SignQuest server (serve.py), so everyone can raid together.";
  else if (boss) {
    $("hub-action-text").textContent = `🌀 ${boss.name} came through the Rift! It's open for ${clock(riftLeft("closesIn"))} more. Way too strong alone: raid it with everyone!`;
    go.textContent = "🌀 Raid it!";
    go.onclick = async () => {
      const id = boss.id;
      leave();
      const joined = await openRaid({ raidId: id, tier: RIFT_TIER, onExit: () => openHub() });
      if (!joined) {
        openHub();
        $("hub-action-text").textContent = "🌀 The Rift closed before you got in. Watch for the next one!";
      }
    };
  } else $("hub-action-text").textContent = `🌀 The Rift is calm. ${nameOf(hub.rift.next)} comes through in ${clock(riftLeft("nextIn"))}.`;
}

// ---------- Emotes ----------

function renderEmotes() {
  const box = $("hub-emotes");
  box.innerHTML = EMOTES.map((e, i) => `<button type="button" class="hub-emote" data-emote="${e}" aria-label="Emote ${e} (key ${i + 1})">${e}</button>`).join("");
  for (const b of box.querySelectorAll("button")) b.onclick = () => emote(b.dataset.emote);
}

function emote(e) {
  if (!hub) return;
  hub.emote = e;
  hub.emoteAt = performance.now();
  hub.sendEmote = e;
}

// ---------- Drawing ----------
// Everything is pixel art in the game's style: a dark 1-pixel outline round
// every object, light from the upper left (light, middle, and shadow tones).

const INK = "#2b1d2e";

// A pixel sprite from rows of letters (like sprites.js), with a dark outline
// added round it. Drawn once, then kept.
const spriteCache = new Map();
function pixelSprite(key, rows, palette) {
  if (spriteCache.has(key)) return spriteCache.get(key);
  const h = rows.length + 2, w = Math.max(...rows.map((r) => r.length)) + 2;
  const grid = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => rows[y - 1]?.[x - 1] ?? "."));
  const solid = (x, y) => grid[y]?.[x] !== undefined && grid[y][x] !== ".";
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ch = grid[y][x];
      if (ch === "." && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) ch = "K";
      if (ch === ".") continue;
      g.fillStyle = ch === "K" ? INK : palette[ch];
      g.fillRect(x, y, 1, 1);
    }
  }
  spriteCache.set(key, c);
  return c;
}

// Draws `img` with its feet (bottom middle) at (x, y).
const stand = (img, x, y) => ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height + 1));

const LAMP = pixelSprite("lamp", [
  ".YYY.",
  "YWWWY",
  "YWLWY",
  "YWWWY",
  ".YYY.",
  "..I..",
  "..I..",
  "..I..",
  "..I..",
  "..I..",
  "..I..",
  "..I..",
  "..I..",
  "..I..",
  "..I..",
  "..I..",
  ".III.",
  "IIIII",
], { Y: "#3a3a4e", W: "#ffe8a0", L: "#fffbe0", I: "#4a4a62" });

const BENCH = pixelSprite("bench", [
  "WWWWWWWWWWWWWWWW",
  "wwwwwwwwwwwwwwww",
  "................",
  "WWWWWWWWWWWWWWWW",
  "wwwwwwwwwwwwwwww",
  ".I............I.",
  ".I............I.",
], { W: "#c8945a", w: "#8a5a32", I: "#4a4a62" });

const BOARD_ART = pixelSprite("board", [
  "...RRRRRRRRRRRRRR...",
  "..RRrrrrrrrrrrrrRR..",
  ".WWWWWWWWWWWWWWWWWW.",
  ".WPPPPPW.WPPPPPW.WW.",
  ".WPpppPW.WPppPPW.WW.",
  ".WPPPPPW.WPPPPPW.WW.",
  ".WPpppPW.WWWWWWW.WW.",
  ".WPPPPPWWWPPPPPPWWW.",
  ".WWWWWWWWWPpppPPWWW.",
  ".WWWWWWWWWPPPPPPWWW.",
  ".wwwwwwwwwwwwwwwwww.",
  "...ww..........ww...",
  "...ww..........ww...",
  "...ww..........ww...",
], { R: "#c8414b", r: "#8a2a32", W: "#c8945a", w: "#8a5a32", P: "#fbf1d6", p: "#8a7a92" });

const STONE = pixelSprite("obelisk", [
  "..LL..",
  ".LLMM.",
  ".LMMD.",
  "LLMMDD",
  "LLMMDD",
  "LLMMDD",
  "LLMMDD",
  "LLMMDD",
  "LLMMDD",
  "LLMMDD",
  "LLMMDD",
  "LLMMDD",
  "LLMMDD",
  "MMMMDD",
], { L: "#b8b0d0", M: "#8a82a8", D: "#5e5878" });

// A round tree: a shaded canopy on a little trunk.
function treeSprite(variant) {
  const key = `tree${variant}`;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const rows = [];
  const R = 9 + variant;
  for (let y = 0; y < R * 2 - 2; y++) {
    let row = "";
    for (let x = 0; x < R * 2; x++) {
      const dx = (x + 0.5 - R) / R, dy = (y + 0.5 - R + 1) / (R - 1);
      const d = dx * dx + dy * dy;
      if (d > 1) row += ".";
      else row += dx + dy < -0.7 ? "H" : dx + dy > 0.55 ? "D" : (x * 3 + y * 5) % 11 === 0 ? "H" : "G";
    }
    rows.push(row);
  }
  for (let k = 0; k < 5; k++) rows.push(".".repeat(R - 2) + "TTt" + ".".repeat(R - 1));
  const s = pixelSprite(key, rows, { G: variant ? "#4f9a3c" : "#5aa848", H: "#8ad070", D: "#2e6a2e", T: "#8a5a32", t: "#5e3a1c" });
  return s;
}

// ⏳ The Spire, drawn once: a tapering marble tower with gold bands, arched
// windows, a pointed roof, and a crystal on top.
const SPIRE_ART = (() => {
  const W = 46, H = 126;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const px = (x, y, col) => ((g.fillStyle = col), g.fillRect(x, y, 1, 1));
  const cx = W / 2;
  const roofTop = 10, bodyTop = 32, base = H - 8;
  const halfAt = (y) => (y < bodyTop ? ((y - roofTop) / (bodyTop - roofTop)) * 15 : 12 + ((y - bodyTop) / (base - bodyTop)) * 6);
  for (let y = roofTop; y < base; y++) {
    const half = Math.round(halfAt(y));
    for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) {
      const t = (x - (cx - half)) / (half * 2); // 0 on the left, 1 on the right
      let col;
      if (y < bodyTop) col = t < 0.3 ? "#6a8ae0" : t < 0.75 ? "#4a6ac8" : "#2e4a9a"; // the roof's blue tiles
      else col = t < 0.28 ? "#f4f0fc" : t < 0.72 ? "#dcd4ec" : "#b0a8c8";
      if (y >= bodyTop && (y - bodyTop) % 22 < 2) col = t < 0.3 ? "#ffe066" : t < 0.75 ? "#ffd23f" : "#c9941a"; // gold bands
      if (y < bodyTop && (y + Math.floor(x / 3)) % 4 === 0) col = "#2e4a9a"; // roof tile lines
      px(x, y, col);
    }
  }
  // The roof's rim, sticking out past the walls.
  for (let x = cx - 16; x < cx + 16; x++) for (let y = bodyTop - 1; y < bodyTop + 2; y++) px(x, y, y === bodyTop + 1 ? "#c9941a" : "#ffd23f");
  // Arched windows.
  for (let k = 0; k < 3; k++) {
    const wy = bodyTop + 12 + k * 22;
    for (let y = wy; y < wy + 9; y++) for (let x = cx - 3; x < cx + 3; x++) if (!(y === wy && (x === cx - 3 || x === cx + 2))) px(x, y, y === wy + 8 ? "#b0a8c8" : "#1a1840");
  }
  // The steps at its foot.
  for (let y = base; y < H; y++) {
    const half = 20 + (y - base);
    for (let x = cx - half; x < cx + half; x++) px(x, y, (y - base) % 3 === 0 ? "#f4f0fc" : x < cx ? "#dcd4ec" : "#b0a8c8");
  }
  // The arched door.
  for (let y = base - 18; y < base; y++) for (let x = cx - 6; x < cx + 6; x++) if (!(y < base - 16 && (x < cx - 4 || x > cx + 3))) px(x, y, "#1a1028");
  // The crystal on top.
  for (const [dx, dy, col] of [[0, -9, "#ffffff"], [-1, -8, "#bff4ff"], [0, -8, "#7fe3ff"], [1, -8, "#3fa8e0"], [-1, -7, "#7fe3ff"], [0, -7, "#7fe3ff"], [1, -7, "#3fa8e0"], [-2, -6, "#bff4ff"], [-1, -6, "#7fe3ff"], [0, -6, "#7fe3ff"], [1, -6, "#3fa8e0"], [2, -6, "#3fa8e0"], [-1, -5, "#7fe3ff"], [0, -5, "#3fa8e0"], [1, -5, "#3fa8e0"], [0, -4, "#3fa8e0"]]) px(cx + dx, roofTop + 4 + dy, col);
  // Outline everything.
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
  const edges = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) edges.push([x, y]);
  for (const [x, y] of edges) px(x, y, INK);
  return c;
})();

// The island, drawn once: sky, far-off clouds and islets, the cliff under the
// island, grass, stone paths, the paved plaza, the Rift's platform, flowers.
let ground = null;
function groundCanvas() {
  if (ground) return ground;
  const c = document.createElement("canvas");
  c.width = HUB_W;
  c.height = HUB_H;
  const g = c.getContext("2d");
  const px = (x, y, col) => ((g.fillStyle = col), g.fillRect(x, y, 1, 1));

  // Sky: bands of blue, dithered where they meet.
  const SKY = ["#3a5fb8", "#4a74c8", "#5a8ad8", "#76a6e6", "#94c2f2", "#b4dcfc"];
  const band = HUB_H / SKY.length;
  for (let y = 0; y < HUB_H; y++) {
    for (let x = 0; x < HUB_W; x++) {
      const f = y / band;
      const i = Math.floor(f);
      const next = Math.min(SKY.length - 1, i + 1);
      const mix = f - i > 0.75 && (x + y) % 2 === 0;
      px(x, y, SKY[mix ? next : i]);
    }
  }
  // Far-off clouds, soft and flat.
  const cloud = (cx, cy, w, shade) => {
    for (let k = 0; k < 4; k++) {
      const bx = cx + (k - 1.5) * w * 0.32, by = cy - (k % 3 === 1 ? 4 : 0), r = w * (k % 3 === 1 ? 0.3 : 0.22);
      for (let y = Math.floor(by - r); y < by + r; y++) for (let x = Math.floor(bx - r * 1.4); x < bx + r * 1.4; x++) {
        if (((x - bx) / (r * 1.4)) ** 2 + ((y - by) / r) ** 2 > 1 || y > cy + 3) continue;
        px(x, y, y > cy ? shade : "#f4f8ff");
      }
    }
  };
  cloud(40, 34, 60, "#d4e4f8");
  cloud(400, 22, 70, "#d4e4f8");
  cloud(250, 14, 44, "#d4e4f8");
  // Little islets floating far off.
  const islet = (cx, cy, r) => {
    for (let x = cx - r; x <= cx + r; x++) {
      const t = (x - cx) / r;
      const top = cy - Math.round(2 * Math.sqrt(Math.max(0, 1 - t * t)));
      const bottom = cy + Math.round(r * 0.8 * (1 - Math.abs(t)) ** 1.3);
      for (let y = top; y <= bottom; y++) px(x, y, y <= top + 1 ? "#5aa848" : "#7a6a8a");
    }
  };
  islet(28, 72, 9);
  islet(420, 60, 7);

  // The cliff under the island: earth, then layers of rock, with a jagged bottom.
  const cliffX0 = ISLAND.x - ISLAND.rx * 1.05, cliffX1 = ISLAND.x + ISLAND.rx * 1.05;
  const edgeY = (x) => {
    for (let y = HUB_H - 1; y > 0; y--) if (islandD(x, y) < 1) return y;
    return null;
  };
  for (let x = Math.floor(cliffX0); x < cliffX1; x++) {
    const top = edgeY(x);
    if (top === null) continue;
    const t = (x - ISLAND.x) / ISLAND.rx;
    const depth = Math.round(14 + 44 * (1 - Math.min(1, Math.abs(t))) ** 1.6 + (rand(x >> 2, 9) - 0.5) * 6 + (x % 7 === 0 ? 3 : 0));
    for (let y = top - 2; y <= top + depth; y++) {
      const k = y - top;
      const lit = t < -0.2 ? 1 : t > 0.35 ? -1 : 0; // light from the left
      let col;
      if (k < 3) col = "#6e4426";
      else if (k === depth) col = INK;
      else {
        const layer = Math.floor((k + Math.round(Math.sin(x / 9) * 2)) / 6) % 3;
        col = [["#a0907e", "#8a7a6a", "#6e6054"], ["#8e7e6e", "#786a5c", "#5e5248"], ["#9a8a78", "#827464", "#665a4e"]][layer][1 - lit];
        if ((k + Math.round(Math.sin(x / 9) * 2)) % 6 === 0) col = "#5a4e46";
        if (rand(x, y, 3) > 0.97) col = "#5a4e46";
      }
      px(x, y, col);
    }
    // Vines hanging off the edge.
    if (rand(x, 4) > 0.9) for (let y = top + 1; y < top + 4 + Math.floor(rand(x, 5) * 12); y++) px(x, y, y % 3 ? "#3f8a34" : "#5aa848");
  }

  // Grass, in big soft patches of two greens, with tufts.
  for (let y = 0; y < HUB_H; y++) {
    for (let x = 0; x < HUB_W; x++) {
      const d = islandD(x, y);
      if (d >= 1) continue;
      if (d > 0.975) {
        px(x, y, INK);
        continue;
      }
      const patch = rand(Math.floor(x / 14), Math.floor(y / 9), 2) > 0.5;
      let col = patch ? "#6cbc48" : "#64b244";
      if (d > 0.93) col = y < ISLAND.y ? "#8ad070" : "#3f8a34"; // a bright rim on top, a shaded lip in front
      px(x, y, col);
    }
  }
  for (let k = 0; k < 220; k++) {
    const x = Math.floor(rand(k, 1, 7) * HUB_W), y = Math.floor(rand(k, 2, 7) * HUB_H);
    if (islandD(x, y) > 0.9) continue;
    px(x, y, "#4a9a3a");
    px(x + 2, y, "#4a9a3a");
    px(x + 1, y - 1, "#8ad070");
  }

  // Stone paths: slabs in rows, with mortar between them and a darker edge.
  const onPath = (x, y) => {
    if (islandD(x, y) > 0.92) return false;
    if (Math.abs(x - 220) < 11 && y > PLAZA.y) return true; // up from the bottom edge
    if (Math.abs(y - (SPIRE.door.y + 3)) < 7 && x > SPIRE.x && x < PLAZA.x) return true; // west to the Spire
    if (Math.abs(y - (RIFT.y + 8)) < 7 && x > PLAZA.x && x < RIFT.x) return true; // east to the Rift
    return false;
  };
  const inPlaza = (x, y) => ((x - PLAZA.x) / PLAZA.rx) ** 2 + ((y - PLAZA.y) / PLAZA.ry) ** 2 < 1;
  const inDais = (x, y) => ((x - RIFT.x) / RIFT.rx) ** 2 + ((y - RIFT.y) / RIFT.ry) ** 2 < 1;
  for (let y = 0; y < HUB_H; y++) {
    for (let x = 0; x < HUB_W; x++) {
      if (inDais(x, y) || !(onPath(x, y) || inPlaza(x, y))) continue;
      const edge = !(onPath(x - 1, y) || inPlaza(x - 1, y)) || !(onPath(x + 1, y) || inPlaza(x + 1, y)) || !(onPath(x, y - 1) || inPlaza(x, y - 1)) || !(onPath(x, y + 1) || inPlaza(x, y + 1));
      let col;
      if (edge) col = "#9a8a6e";
      else if (inPlaza(x, y)) {
        // The plaza: rings of slabs round the fountain.
        const dx = (x - PLAZA.x) / PLAZA.rx, dy = (y - PLAZA.y) / PLAZA.ry;
        const ring = Math.floor(Math.hypot(dx, dy) * 6);
        const seg = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * (6 + ring * 6));
        const ringEdge = Math.floor(Math.hypot(dx, dy) * 6 + 0.12) !== ring;
        const segEdge = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * (6 + ring * 6) + 0.08) !== seg;
        col = ringEdge || segEdge ? "#b4a486" : (ring + seg) % 2 ? "#e8dec8" : "#ddd2b8";
        if (ring === 5) col = ringEdge || segEdge ? "#a89878" : "#cfc2a4";
      } else {
        const row = Math.floor(y / 5);
        const sx = Math.floor((x + (row % 2) * 4) / 8);
        const mortar = y % 5 === 0 || (x + (row % 2) * 4) % 8 === 0;
        col = mortar ? "#b4a486" : rand(sx, row, 6) > 0.5 ? "#e8dec8" : "#ddd2b8";
        if (!mortar && y % 5 === 1) col = "#f4ecdc"; // each slab's lit top edge
      }
      px(x, y, col);
    }
  }

  // The Rift's platform: a raised ring of dark stone, its front face showing.
  for (let y = RIFT.y - RIFT.ry - 1; y < RIFT.y + RIFT.ry + 6; y++) {
    for (let x = RIFT.x - RIFT.rx - 1; x < RIFT.x + RIFT.rx + 2; x++) {
      const top = inDais(x, y);
      const face = !top && inDais(x, y - 4) && y > RIFT.y;
      if (!top && !face) {
        if (inDais(x - 1, y) || inDais(x + 1, y) || inDais(x, y - 1) || (inDais(x, y - 5) && y > RIFT.y)) px(x, y, INK);
        continue;
      }
      if (face) {
        px(x, y, (x + Math.floor(y / 2)) % 9 === 0 ? "#3a3450" : x < RIFT.x - RIFT.rx * 0.4 ? "#5e5878" : "#4a4462");
        continue;
      }
      const dx = (x - RIFT.x) / RIFT.rx, dy = (y - RIFT.y) / RIFT.ry;
      const r = Math.hypot(dx, dy);
      const seg = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 16);
      const segEdge = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 16 + 0.06) !== seg;
      px(x, y, r > 0.93 ? "#8a82a8" : segEdge || Math.abs(r - 0.66) < 0.035 ? "#3a3450" : seg % 2 ? "#6a6488" : "#625c80");
    }
  }

  // Flower beds: little clusters of four colors.
  for (const [fx, fy, hue] of [[60, 160, 0], [372, 196, 1], [90, 214, 2], [356, 222, 3], [260, 118, 1], [178, 118, 0], [300, 168, 2], [140, 170, 3]]) {
    for (let k = 0; k < 9; k++) {
      const x = fx + Math.round((rand(fx, k) - 0.5) * 16), y = fy + Math.round((rand(k, fy) - 0.5) * 7);
      if (islandD(x, y) > 0.9 || onPath(x, y) || inPlaza(x, y)) continue;
      const col = ["#ff9ad5", "#ffe066", "#ffffff", "#c58cf0"][(hue + k) % 4];
      px(x, y - 1, col);
      px(x - 1, y, col);
      px(x + 1, y, col);
      px(x, y + 1, col);
      px(x, y, "#ffd23f");
      px(x, y + 2, "#3f8a34");
    }
  }
  ground = c;
  return c;
}

function draw(now) {
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(groundCanvas(), 0, 0);
  drawVortex(now);

  const things = [];
  things.push({ y: SPIRE.y + 3, paint: () => drawSpire(now) });
  things.push({ y: FOUNTAIN.y + 8, paint: () => drawFountain(now) });
  for (const l of LAMPS) things.push({ y: l.y, paint: () => drawLamp(l, now) });
  for (const b of BENCHES) things.push({ y: b.y, paint: () => stand(BENCH, b.x, b.y) });
  TREES.forEach((t, i) => things.push({ y: t.y, paint: () => stand(treeSprite(i % 2), t.x, t.y) }));
  things.push({ y: BOARD.y, paint: () => stand(BOARD_ART, BOARD.x, BOARD.y) });
  for (const s of STONES) things.push({ y: s.y, paint: () => drawStone(s, now) });
  const boss = riftBoss();
  if (boss) things.push({ y: RIFT.y + 4, paint: () => drawBoss(boss, now) });
  const walk = (moving, speed, off = 0) => (moving ? Math.floor(now / speed + off) % 4 : 0);
  for (const o of hub.others.values()) {
    const moving = Math.hypot(o.tx - o.x, o.ty - o.y) > 0.6;
    if (moving) o.flip = o.tx < o.x;
    const f = walk(moving, 120, o.x);
    things.push({ y: o.y, x: o.x, img: spriteCanvas(heroSrc(o.look, o.hat, f, false)), flip: o.flip, person: o, lift: f % 2 ? 2 : 0 });
  }
  const me = hub.me;
  const f = walk(me.moving, 110);
  const mine = hub.emote && now - hub.emoteAt < EMOTE_MS ? hub.emote : null;
  things.push({ y: me.y, x: me.x, img: spriteCanvas(heroSrc(progress.heroLook(), progress.get().equipped.hat, f)), flip: me.flip, person: { name: "You", me: true, emote: mine }, lift: f % 2 ? 2 : 0 });
  things.sort((a, b) => a.y - b.y);
  for (const t of things) {
    if (t.paint) {
      t.paint();
      continue;
    }
    const w = t.img.width * PEOPLE, h = t.img.height * PEOPLE;
    ctx.fillStyle = "rgba(20, 30, 10, 0.25)";
    ctx.fillRect(Math.round(t.x - 5), Math.round(t.y - 1), 10, 2);
    const x = Math.round(t.x - w / 2), y = Math.round(t.y - h - (t.lift || 0));
    if (t.flip) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(t.img, 0, 0, w, h);
      ctx.restore();
    } else ctx.drawImage(t.img, x, y, w, h);
  }
  // Clouds drifting past below the island, in front of its cliff.
  for (let k = 0; k < 4; k++) {
    const x = Math.round(((now / (110 + k * 40) + k * 131) % (HUB_W + 120)) - 60), y = 238 + (k % 2) * 10;
    drawCloud(x, y, 34 + (k % 3) * 8);
  }

  // Signs and names in real pixels, on little plaques, so the text is crisp.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  plaque("SPIRE OF AGES", SPIRE.x, SPIRE.y + 13, "#ffd23f", "#4a2a8a");
  plaque(boss ? boss.name.toUpperCase() : "THE RIFT", RIFT.x, RIFT.y + RIFT.ry + 14, boss ? "#ffb0e0" : "#e0d8ff", boss ? "#7a1a6a" : "#3a3460");
  if (hub.rift) plaque(boss ? `closes in ${clock(riftLeft("closesIn"))}` : `next one in ${clock(riftLeft("nextIn"))}`, RIFT.x, RIFT.y + RIFT.ry + 22, "#ffffff", "#2b1d2e", 13);
  plaque("NOTICE BOARD", BOARD.x, BOARD.y + 8, "#fbf1d6", "#6e4426", 12);
  for (const t of things) {
    if (!t.person) continue;
    const o = t.person;
    const top = t.y - t.img.height * PEOPLE - 4;
    plaque(o.me ? "You" : o.name, t.x, top, o.me ? "#ffd23f" : "#ffffff", "rgba(43, 29, 46, 0.85)", 13);
    if (o.emote) bubble(o.emote, t.x, top - 7);
  }
}

// A text label on a dark rounded plaque, centred at (x, y) in game pixels.
function plaque(text, x, y, color, fill, size = 15) {
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 14, h = size + 9;
  const X = Math.round(x * SCALE - w / 2), Y = Math.round(y * SCALE - h / 2);
  ctx.fillStyle = INK;
  ctx.fillRect(X - 3, Y, w + 6, h);
  ctx.fillRect(X, Y - 3, w, h + 6);
  ctx.fillStyle = fill;
  ctx.fillRect(X, Y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(X, Y, w, 3);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, X + w / 2, Y + h / 2 + 1);
}

// An emote in a pixel speech bubble, above (x, y).
function bubble(emoji, x, y) {
  const X = Math.round(x * SCALE), Y = Math.round(y * SCALE);
  ctx.fillStyle = INK;
  ctx.fillRect(X - 25, Y - 46, 50, 40);
  ctx.fillRect(X - 22, Y - 49, 44, 46);
  ctx.fillRect(X - 6, Y - 6, 12, 9);
  ctx.fillStyle = "#fbf1d6";
  ctx.fillRect(X - 22, Y - 46, 44, 40);
  ctx.fillRect(X - 3, Y - 6, 6, 6);
  ctx.font = "28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, X, Y - 25);
}

// A puffy pixel cloud, its bottom at y.
function drawCloud(x, y, w) {
  const puffs = [[-0.32, 0.22], [0, 0.34], [0.3, 0.24]];
  for (const [ox, r] of puffs) {
    const cx = x + ox * w, R = r * w, cy = y - R * 0.6;
    for (let py = Math.floor(cy - R * 0.7); py <= y; py++) {
      const half = Math.floor(R * Math.sqrt(Math.max(0, 1 - ((py - cy) / (R * 0.7)) ** 2)));
      if (py > cy) {
        ctx.fillStyle = "#dbe8fa";
        ctx.fillRect(Math.round(cx - R), py, Math.round(R * 2), 1);
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.round(cx - half), py, half * 2, 1);
      }
    }
  }
}

// ⏳ The Spire, with its windows and door glowing.
function drawSpire(now) {
  stand(SPIRE_ART, SPIRE.x, SPIRE.y + 4);
  const left = Math.round(SPIRE.x - SPIRE_ART.width / 2), top = Math.round(SPIRE.y + 4 - SPIRE_ART.height + 1);
  const cx = left + SPIRE_ART.width / 2;
  for (let k = 0; k < 3; k++) {
    const lit = Math.floor(now / 600 + k) % 3 === 0;
    ctx.fillStyle = lit ? "#ffe066" : "#7fe3ff";
    ctx.fillRect(cx - 2, top + 32 + 14 + k * 22, 4, 5);
  }
  const glow = 0.5 + 0.5 * Math.sin(now / 400);
  ctx.fillStyle = `rgba(255, 210, 63, ${0.45 + glow * 0.45})`;
  ctx.fillRect(cx - 4, SPIRE.y + 4 - 8 - 15, 8, 15);
  // The crystal on top twinkles.
  if (Math.floor(now / 250) % 6 === 0) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - 3, top + 7, 1, 1);
    ctx.fillRect(cx + 3, top + 9, 1, 1);
  }
}

// 🌀 The Rift's vortex: two spiral arms turning, fast and bright when a boss is out.
function drawVortex(now) {
  const open = Boolean(riftBoss());
  const rx = RIFT.rx * 0.6, ry = RIFT.ry * 0.6;
  const turn = now / (open ? 260 : 900);
  const cols = open ? ["#2a0a3a", "#7a2ab0", "#c84ab0", "#ff9ad5"] : ["#241a40", "#3e3070", "#5a4a98", "#8a7ac8"];
  for (let y = Math.floor(RIFT.y - ry); y <= RIFT.y + ry; y++) {
    for (let x = Math.floor(RIFT.x - rx); x <= RIFT.x + rx; x++) {
      const dx = (x - RIFT.x) / rx, dy = (y - RIFT.y) / ry;
      const r = Math.hypot(dx, dy);
      if (r > 1) continue;
      const arm = ((Math.atan2(dy, dx) - r * 5 + turn) / Math.PI + 4) % 1; // two arms
      const level = r < 0.15 ? 3 : arm < 0.22 ? 2 : arm < 0.5 ? 1 : 0;
      ctx.fillStyle = r > 0.9 ? "#3a3450" : cols[level];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Sparks rising out of it.
  for (let k = 0; k < (open ? 12 : 4); k++) {
    const t = ((now / 1000 + k * 0.37) % 1.4) / 1.4;
    ctx.fillStyle = open ? "#ffd0f4" : "#c8b8ff";
    ctx.globalAlpha = 1 - t;
    ctx.fillRect(RIFT.x + Math.round(Math.sin(k * 2.3) * rx * 0.8), RIFT.y - Math.round(t * 46), 1, 2);
    ctx.globalAlpha = 1;
  }
}

function drawStone(s, now) {
  stand(STONE, s.x, s.y);
  // Its rune glows: softly, or brightly when a boss is out.
  const open = Boolean(riftBoss());
  ctx.fillStyle = open ? (Math.sin(now / 200 + s.x) > 0 ? "#ff9ad5" : "#ff4ad0") : "#a898e8";
  ctx.fillRect(s.x - 1, s.y - 11, 2, 1);
  ctx.fillRect(s.x - 1, s.y - 9, 1, 2);
  ctx.fillRect(s.x, s.y - 7, 1, 1);
}

// The Rift boss, huge, rising out of the Rift and bobbing, its shadow on the platform.
function drawBoss(boss, now) {
  const img = spriteCanvas(creatureSrc(boss.id, false, 0, 3));
  const k = 2.2 / SPRITE_SCALE;
  const w = img.width * k, h = img.height * k;
  const bob = Math.round(Math.sin(now / 500) * 3);
  ctx.fillStyle = "rgba(20, 0, 30, 0.35)";
  ctx.fillRect(Math.round(RIFT.x - w * 0.35), RIFT.y + 2, Math.round(w * 0.7), 4);
  ctx.drawImage(img, Math.round(RIFT.x - w / 2), Math.round(RIFT.y - h + 2 + bob), w, h);
}

// The fountain: a stone basin with a pillar and a bowl, water spilling over.
function drawFountain(now) {
  const { x, y } = FOUNTAIN;
  const basin = (rx, ry, cy, rim, water) => {
    for (let py = cy - ry - 1; py <= cy + ry + 4; py++) {
      for (let px = x - rx - 1; px <= x + rx + 1; px++) {
        const d = ((px - x) / rx) ** 2 + ((py - cy) / ry) ** 2;
        const front = ((px - x) / rx) ** 2 + ((py - cy - 3) / ry) ** 2 <= 1 && py > cy;
        let col = null;
        if (d <= 1) col = d > 0.55 ? (px < x ? rim[0] : rim[1]) : water ? ((px + py + Math.floor(now / 200)) % 7 === 0 ? "#bff4ff" : "#4fb3ff") : rim[1];
        else if (front) col = px < x - rx * 0.3 ? rim[1] : rim[2];
        else if (d <= 1.25 || ((px - x) / rx) ** 2 + ((py - cy - 3) / ry) ** 2 <= 1.25) col = INK;
        if (col) {
          ctx.fillStyle = col;
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }
  };
  basin(22, 9, y, ["#e8e0f4", "#c8c0d8", "#9a92b0"], true);
  // The pillar.
  ctx.fillStyle = INK;
  ctx.fillRect(x - 3, y - 18, 6, 18);
  ctx.fillStyle = "#c8c0d8";
  ctx.fillRect(x - 2, y - 18, 4, 18);
  ctx.fillStyle = "#e8e0f4";
  ctx.fillRect(x - 2, y - 18, 1, 18);
  basin(8, 3, y - 19, ["#e8e0f4", "#c8c0d8", "#9a92b0"], true);
  // Water: a jet up top, and drops falling from the bowl into the basin.
  ctx.fillStyle = "#bff4ff";
  const jet = 4 + Math.round(Math.sin(now / 150));
  ctx.fillRect(x, y - 23 - jet, 1, jet);
  for (let k = 0; k < 10; k++) {
    const t = ((now / 600 + k / 10) % 1);
    const side = k % 2 ? 1 : -1;
    ctx.fillStyle = k % 3 ? "#bff4ff" : "#ffffff";
    ctx.fillRect(Math.round(x + side * (7 + t * 5)), Math.round(y - 18 + t * t * 16), 1, 1);
  }
}

function drawLamp(l, now) {
  stand(LAMP, l.x, l.y);
  const glow = ctx.createRadialGradient(l.x, l.y - 16, 1, l.x, l.y - 16, 12);
  glow.addColorStop(0, `rgba(255, 232, 160, ${0.3 + 0.08 * Math.sin(now / 300 + l.x)})`);
  glow.addColorStop(1, "rgba(255, 232, 160, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(l.x - 12, l.y - 28, 24, 24);
}
