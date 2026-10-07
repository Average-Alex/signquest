// The world map background: pixel-art islands, painted once onto a small
// canvas and scaled up. There's one map per dimension (config.js
// DIMENSIONS): the green Overworld island, and the starry floating islands
// of the Starfall Realm. Each zone gets its own kind of ground around its
// spot on the map (config.js `map`), and a dotted path joins the zones in
// order. Landmarks, labels, and the hero are HTML on top of it (screens.js),
// so they stay clickable.

import { ZONES } from "./config.js";

export const MAP_W = 192;
export const MAP_H = 120;

const GROUND = {
  meadow: { base: "#86d35a", dark: "#71c04a", specks: ["#ff7fc8", "#ffe066", "#ffffff"], rate: 0.05 },
  forest: { base: "#4ea44a", dark: "#3f923f", specks: ["#2a6e30", "#2a6e30", "#6cc24a"], rate: 0.14 },
  caves: { base: "#a39ab0", dark: "#918aa0", specks: ["#6e6480", "#c4bcd0"], rate: 0.1 },
  river: { base: "#6cc24a", dark: "#5cb03e", specks: ["#9be07a"], rate: 0.04 },
  castle: { base: "#93c25a", dark: "#80ae4a", specks: ["#c9b277", "#ffe066"], rate: 0.04 },
  spires: { base: "#cfe3f2", dark: "#b8d4ea", specks: ["#ffffff", "#c58cf0"], rate: 0.08 },
  clouds: { base: "#f2f4ff", dark: "#dfe4f8", specks: ["#ffe9a8", "#c8d0f0"], rate: 0.05 },
  void: { base: "#3a2a5e", dark: "#30224f", specks: ["#c58cf0", "#ffffff", "#7fffd4"], rate: 0.08 },
};

// Sea, shore, and path colors for each dimension.
const PALETTES = [
  { deep: "#2a7fc0", water: "#3a95d4", shallow: "#5cc4e8", wave: "#a8e0ff", sand: "#f2dc9a", cliff: "#3f7a34", path: "#f7e7b4", pathEdge: "#b9955a", islets: 2 },
  { deep: "#120a24", water: "#1c1236", shallow: "#2e2052", wave: "#ffffff", sand: "#b8a8e8", cliff: "#5a3f8a", path: "#ffe9a8", pathEdge: "#8a6ad0", islets: 5 },
];
const RIVER = "#4fb3ff";

// Repeatable "random" numbers, so the map looks the same every time.
export function hash(x, y, seed = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

// Smooth noise: random values on a grid, blended between grid points.
export function noise(x, y, size, seed) {
  const gx = x / size, gy = y / size;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const zonePoint = (zone) => ({ x: (zone.map.x / 100) * MAP_W, y: (zone.map.y / 100) * MAP_H });

// How far inside the land a pixel is: > 0 is land, < 0 is sea.
function landField(x, y, blobs, seed) {
  let f = -Infinity;
  for (const b of blobs) f = Math.max(f, 1 - Math.hypot((x - b.x) / b.rx, (y - b.y) / b.ry));
  f += (noise(x, y, 9, seed + 1) - 0.5) * 0.4 + (noise(x, y, 4, seed + 2) - 0.5) * 0.12;
  // Keep the land clear of the frame.
  const edge = Math.min(x, MAP_W - x, y, MAP_H - y);
  return Math.min(f, (edge - 5) / 14);
}

function groundFor(x, y, zones) {
  // Nearest zone, with a wobbly border between zones.
  const wx = x + (noise(x, y, 7, 3) - 0.5) * 22;
  const wy = y + (noise(x, y, 7, 4) - 0.5) * 22;
  let best = null, bestD = Infinity;
  for (const zone of zones) {
    const p = zonePoint(zone);
    const d = Math.hypot(wx - p.x, wy - p.y);
    if (d < bestD) (bestD = d), (best = zone.id);
  }
  return GROUND[best];
}

// Plot points along a gentle curve from a to b.
function curve(a, b, bend, step) {
  const mx = (a.x + b.x) / 2 - (b.y - a.y) * bend;
  const my = (a.y + b.y) / 2 + (b.x - a.x) * bend;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const points = [];
  for (let t = 0; t <= 1; t += step / len) {
    const u = 1 - t;
    points.push({ x: u * u * a.x + 2 * u * t * mx + t * t * b.x, y: u * u * a.y + 2 * u * t * my + t * t * b.y });
  }
  return points;
}

const cached = [];

export function worldMapSrc(dimension = 0) {
  if (cached[dimension]) return cached[dimension];
  const zones = ZONES.filter((z) => z.dimension === dimension);
  const pal = PALETTES[dimension];
  const seed = dimension * 31;
  const canvas = document.createElement("canvas");
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext("2d");
  const dot = (x, y, color, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };

  // The overworld is one big island; the realm is separate floating islands.
  const blobs = zones.map((zone) => ({ ...zonePoint(zone), rx: dimension ? 30 : 36, ry: dimension ? 22 : 26 }));
  if (dimension === 0) blobs.push({ x: MAP_W / 2, y: MAP_H * 0.52, rx: 46, ry: 30 });
  for (let i = 0; i < pal.islets; i++) {
    blobs.push({ x: MAP_W * (0.06 + hash(i, 1, seed) * 0.88), y: MAP_H * (0.1 + hash(i, 2, seed) * 0.8), rx: 7 + hash(i, 3, seed) * 4, ry: 5 + hash(i, 4, seed) * 3 });
  }

  const field = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const f = landField(x, y, blobs, seed);
      field[y * MAP_W + x] = f;
      let color;
      if (f < -0.2) color = pal.deep;
      else if (f < -0.05) color = pal.water;
      else if (f < 0) color = pal.shallow;
      else if (f < 0.07) color = pal.sand;
      else if (f < 0.09) color = pal.cliff;
      else {
        const g = groundFor(x, y, zones);
        color = noise(x, y, 5, 5) > 0.62 ? g.dark : g.base;
        if (hash(x, y, 6) < g.rate) color = g.specks[Math.floor(hash(x, y, 7) * g.specks.length)];
      }
      dot(x, y, color);
    }
  }

  // Waves out at sea (twinkling stars in the realm).
  for (let y = 2; y < MAP_H - 2; y++) {
    for (let x = 2; x < MAP_W - 4; x++) {
      if (field[y * MAP_W + x] >= -0.12 || field[y * MAP_W + x + 3] >= -0.12) continue;
      if (dimension === 0 && hash(x, y, 8) < 0.006) {
        dot(x, y, pal.wave, 3, 1);
        dot(x + 1, y - 1, pal.wave);
      } else if (dimension === 1 && hash(x, y, 8) < 0.012) {
        dot(x, y, hash(x, y, 9) < 0.3 ? "#c58cf0" : pal.wave);
        if (hash(x, y, 10) < 0.15) (dot(x - 1, y, pal.wave), dot(x + 1, y, pal.wave), dot(x, y - 1, pal.wave), dot(x, y + 1, pal.wave));
      }
    }
  }

  // The overworld's river, from the waterfall down to the sea.
  const riverZone = zones.find((z) => z.id === "river");
  if (riverZone) {
    const fall = zonePoint(riverZone);
    const sea = { x: MAP_W - 2, y: fall.y + 34 };
    for (const [color, ox, oy, w, h] of [[pal.water, -2, -1, 5, 3], [RIVER, -1, 0, 3, 1]]) {
      for (const p of curve({ x: fall.x, y: fall.y + 1 }, sea, -0.25, 0.5)) {
        if (field[Math.round(p.y) * MAP_W + Math.round(p.x)] < 0) continue;
        dot(p.x + ox, p.y + oy, color, w, h);
      }
    }
  }

  // Dotted path joining the zones in play order (a starlight bridge in the realm).
  zones.slice(1).forEach((zone, i) => {
    const a = zonePoint(zones[i]);
    const b = zonePoint(zone);
    curve(a, b, i % 2 ? 0.15 : -0.15, 1).forEach((p, j) => {
      if (j % 4 > 1) return;
      dot(p.x - 1, p.y, pal.pathEdge, 3, 2);
      dot(p.x - 1, p.y, pal.path, 2, 1);
    });
  });

  cached[dimension] = canvas.toDataURL();
  return cached[dimension];
}
