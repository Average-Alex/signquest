// Storybook style: smooth, bright cartoon art for the walkable zones, instead
// of chunky pixels. Ground is painted at GROUND_SCALE pixels per game pixel
// with rounded paths, soft grass patches, and ponds sunk below a little earth
// bank with lily pads. Trees, bushes, rocks, mushrooms, and crystals are
// drawn as smooth shapes with soft outlines (decorArt). Anything without
// storybook art (buildings, fences, chests...) keeps its pixel sprite.
//
// Add ?pixel to the address to see the pixel style instead.

import { hash, noise } from "./worldmap.js";

export const STORYBOOK = !new URLSearchParams(location.search).has("pixel");
if (STORYBOOK) document.documentElement.classList.add("storybook"); // for the storybook look in style.css
export const GROUND_SCALE = 2; // canvas pixels per game pixel for the ground
const ART_SCALE = 4; // canvas pixels per game pixel for scenery (the biome's VIEW_SCALE)

// ---------- Colors ----------

function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
}
function rgbToHsl([r, g, b]) {
  (r /= 255), (g /= 255), (b /= 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb([h, s, l]) {
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
// Brighter, more saturated: the sunny cartoon look.
export function vivid(hex, sat = 1.25, light = 1.04) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb([h, Math.min(1, s * sat), Math.min(0.92, l * light)]));
}
export const shade = (hex, f) => rgbToHex(hexToRgb(hex).map((v) => v * f));
export const tint = (hex, f) => rgbToHex(hexToRgb(hex).map((v) => v + (255 - v) * f));
const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(",")},${a})`;

// ---------- Masks: smooth shapes from the tile grid ----------

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

// A smooth, slightly wobbly shape covering every tile where `want(kind)` is
// true: the tile grid is scaled up blurred and cut at half strength, so
// corners round off, and noise nudges the cut so edges look hand-drawn.
function shapeMask(grid, want, seed, { blur = 0.45, wobble = 0.12 } = {}) {
  const { TW, TH, T, kind } = grid;
  const small = canvas(TW, TH);
  const sctx = small.getContext("2d");
  const image = sctx.createImageData(TW, TH);
  for (let i = 0; i < TW * TH; i++) if (want(kind[i])) image.data.set([255, 255, 255, 255], i * 4);
  sctx.putImageData(image, 0, 0);

  const S = GROUND_SCALE, W = TW * T * S, H = TH * T * S;
  const big = canvas(W, H);
  const bctx = big.getContext("2d");
  bctx.imageSmoothingEnabled = true;
  bctx.filter = `blur(${blur * T * S}px)`;
  bctx.drawImage(small, 0, 0, W, H);
  bctx.filter = "none";
  const data = bctx.getImageData(0, 0, W, H);
  const px = data.data;
  // The wobble changes slowly, so it's worked out every STEP pixels and blended between.
  const STEP = 8, GW = Math.ceil(W / STEP) + 1, GH = Math.ceil(H / STEP) + 1;
  const cuts = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++)
    for (let gx = 0; gx < GW; gx++) cuts[gy * GW + gx] = 0.5 + (noise((gx * STEP) / S, (gy * STEP) / S, T * 1.5, seed) - 0.5) * wobble * 2;
  for (let y = 0; y < H; y++) {
    const gy = Math.floor(y / STEP), fy = (y % STEP) / STEP;
    const row0 = gy * GW, row1 = row0 + GW;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4 + 3;
      const v = px[i];
      if (v === 0 || v === 255) {
        px[i] = v; // well outside or inside: no need to work out the edge
        continue;
      }
      const gx = Math.floor(x / STEP), fx = (x % STEP) / STEP;
      const top = cuts[row0 + gx] + (cuts[row0 + gx + 1] - cuts[row0 + gx]) * fx;
      const bottom = cuts[row1 + gx] + (cuts[row1 + gx + 1] - cuts[row1 + gx]) * fx;
      const cut = top + (bottom - top) * fy;
      px[i] = Math.max(0, Math.min(1, (v / 255 - cut) * 9 + 0.5)) * 255; // a soft 1-2 pixel edge
    }
  }
  bctx.putImageData(data, 0, 0);
  return big;
}

// The mask (moved by dx, dy) filled with a color, or with whatever a painter
// function draws over the whole canvas.
function filled(mask, fill, dx = 0, dy = 0) {
  const out = canvas(mask.width, mask.height);
  const ctx = out.getContext("2d");
  if (typeof fill === "function") fill(ctx, out.width, out.height);
  else {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask, dx, dy);
  return out;
}

// The mask grown by r pixels in every direction (for outlines).
function grown(mask, r, color) {
  const out = canvas(mask.width, mask.height);
  const ctx = out.getContext("2d");
  const steps = 12;
  for (let k = 0; k < steps; k++) {
    const a = (k / steps) * Math.PI * 2;
    ctx.drawImage(mask, Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  return out;
}

const alphaAt = (maskData, W, x, y) => maskData[(Math.round(y) * W + Math.round(x)) * 4 + 3];

// ---------- Ground ----------

// grid: { TW, TH, T, kind, KINDS: {GROUND, PATH, WATER, BRIDGE, GATE, SOLID, ICE}, areaOf, areas }
export function paintStorybookGround(theme, grid, seed) {
  const { TW, TH, T, kind, KINDS } = grid;
  const S = GROUND_SCALE, W = TW * T * S, H = TH * T * S;
  const out = canvas(W, H);
  const ctx = out.getContext("2d");
  const rand = (a, b, k) => hash(a, b, seed + k);

  // 1. Grass (or whatever the ground is), area by area with soft blends, then
  //    big soft light and dark patches and little blades.
  const areaH = H / grid.areas;
  for (let a = 0; a < grid.areas; a++) {
    const colors = theme.grounds?.[grid.areas - 1 - a] || theme.ground;
    const g = ctx.createLinearGradient(0, a * areaH - T * S * 2, 0, a * areaH + T * S * 2);
    const prev = theme.grounds?.[grid.areas - a] || theme.ground;
    g.addColorStop(0, vivid(a ? prev[0] : colors[0]));
    g.addColorStop(1, vivid(colors[0]));
    ctx.fillStyle = g;
    ctx.fillRect(0, a * areaH - (a ? T * S * 2 : 0), W, areaH + (a ? T * S * 2 : 0));
  }
  const base = vivid(theme.ground[0]);
  for (let i = 0; i < (W * H) / (S * S * 900); i++) {
    const x = rand(i, 1, 30) * W, y = rand(i, 2, 31) * H, r = (8 + rand(i, 3, 32) * 26) * S;
    const light = rand(i, 4, 33) > 0.45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(light ? tint(base, 0.25) : shade(base, 0.82), light ? 0.35 : 0.3));
    g.addColorStop(1, rgba(base, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Grass blades: little curved strokes, a bit darker.
  ctx.lineCap = "round";
  for (let i = 0; i < (W * H) / (S * S * 340); i++) {
    const x = rand(i, 5, 34) * W, y = rand(i, 6, 35) * H;
    ctx.strokeStyle = rgba(shade(base, 0.72), 0.35);
    ctx.lineWidth = 0.8 * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 1 * S, y - 2 * S, x + 0.5 * S, y - 3.5 * S);
    ctx.moveTo(x + 2 * S, y);
    ctx.quadraticCurveTo(x + 2.5 * S, y - 1.5 * S, x + 3.5 * S, y - 2.5 * S);
    ctx.stroke();
  }

  // 2. Where there's no ground (sky, lava, the void): the ground is raised,
  //    with an earth cliff below its edge.
  if (theme.solid) {
    const groundMask = shapeMask(grid, (k) => k !== KINDS.SOLID, seed + 1, { wobble: 0.1 });
    // The grass so far, cut to the ground's shape.
    const grass = canvas(W, H);
    const gctx = grass.getContext("2d");
    gctx.drawImage(out, 0, 0);
    gctx.globalCompositeOperation = "destination-in";
    gctx.drawImage(groundMask, 0, 0);
    // Below everything: sky / lava / the void, with sparkles.
    ctx.fillStyle = vivid(theme.solid[0], 1.1, 1);
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < (W * H) / (S * S * 500); i++) {
      ctx.fillStyle = rgba(theme.sparkle, 0.5 + rand(i, 7, 36) * 0.5);
      ctx.beginPath();
      ctx.arc(rand(i, 8, 37) * W, rand(i, 9, 38) * H, (0.4 + rand(i, 10, 39)) * S, 0, Math.PI * 2);
      ctx.fill();
    }
    // The cliff: the ground's shape pushed down in earth colors, darker further down.
    const cliffH = 7 * S;
    for (let d = cliffH; d > 0; d -= S) ctx.drawImage(filled(groundMask, shade(vivid(theme.cliff[0], 1.1, 1.05), 1 - (d / cliffH) * 0.3)), 0, d);
    ctx.drawImage(grown(groundMask, 1.2 * S, rgba(theme.rim, 0.9)), 0, 0);
    ctx.drawImage(grass, 0, 0);
  }

  // 3. Paths: soft sandy (or stone, or carpet) shapes with a darker rim.
  const pathMask = shapeMask(grid, (k) => k === KINDS.PATH || k === KINDS.GATE, seed + 2, { blur: 0.55, wobble: 0.16 });
  const pathColor = vivid(theme.path[0], 1.15, 1.06);
  ctx.drawImage(grown(pathMask, 1.6 * S, rgba(shade(pathColor, 0.7), 0.55)), 0, S * 0.8);
  ctx.drawImage(filled(pathMask, (c, w, h) => {
    c.fillStyle = pathColor;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < (w * h) / (S * S * 700); i++) {
      const x = rand(i, 11, 40) * w, y = rand(i, 12, 41) * h, r = (5 + rand(i, 13, 42) * 14) * S;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(rand(i, 14, 43) > 0.5 ? tint(pathColor, 0.3) : shade(pathColor, 0.88), 0.45));
      g.addColorStop(1, rgba(pathColor, 0));
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Pebbles.
    for (let i = 0; i < (w * h) / (S * S * 220); i++) {
      c.fillStyle = rgba(shade(pathColor, 0.75), 0.7);
      c.beginPath();
      c.ellipse(rand(i, 15, 44) * w, rand(i, 16, 45) * h, (0.6 + rand(i, 17, 46)) * S, (0.4 + rand(i, 18, 47) * 0.6) * S, 0, 0, Math.PI * 2);
      c.fill();
    }
  }), 0, 0);

  // 4. Water: sunk below the ground, so an earth bank shows along its far
  //    (top) edge; lighter toward the middle, with shimmer and lily pads.
  const water = (want, colors, { bank, lilies, ice }) => {
    const mask = shapeMask(grid, want, seed + 3, { blur: 0.5, wobble: 0.14 });
    const maskData = mask.getContext("2d").getImageData(0, 0, W, H).data;
    ctx.drawImage(grown(mask, 1.4 * S, rgba(shade(colors.edge, 0.6), 0.85)), 0, 0);
    ctx.drawImage(filled(mask, bank), 0, 0); // the bank: seen where the water doesn't cover
    const bankH = (ice ? 2 : 6) * S;
    const surface = filled(mask, colors.deep, 0, bankH); // the water, pushed down below the bank
    const sctx = surface.getContext("2d");
    sctx.globalCompositeOperation = "destination-in";
    sctx.drawImage(mask, 0, 0); // only inside the pond
    sctx.globalCompositeOperation = "source-atop";
    // Light inner glow: the mask shrunk, blurred, lighter.
    sctx.filter = `blur(${5 * S}px)`;
    sctx.globalAlpha = 0.6;
    sctx.drawImage(filled(mask, colors.light), 0, bankH + 3 * S);
    sctx.filter = "none";
    sctx.globalAlpha = 1;
    // Shimmer strokes and lily pads, only well inside the water.
    sctx.lineCap = "round";
    for (let i = 0; i < (W * H) / (S * S * 260); i++) {
      const x = rand(i, 19, 48) * W, y = rand(i, 20, 49) * H;
      if (alphaAt(maskData, W, x, y) < 250 || alphaAt(maskData, W, x, y - bankH - 3 * S) < 250) continue;
      if (lilies && rand(i, 21, 50) < 0.22) {
        const r = (2.5 + rand(i, 22, 51) * 2) * S, a = rand(i, 23, 52) * Math.PI * 2;
        sctx.fillStyle = "#4fae4a";
        sctx.strokeStyle = "#2e6b3a";
        sctx.lineWidth = 0.6 * S;
        sctx.beginPath();
        sctx.moveTo(x, y);
        sctx.arc(x, y, r, a + 0.35, a + Math.PI * 2 - 0.35);
        sctx.closePath();
        sctx.fill();
        sctx.stroke();
        if (rand(i, 24, 53) < 0.35) {
          sctx.fillStyle = "#f7a8cf";
          sctx.beginPath();
          sctx.arc(x + r * 0.2, y - r * 0.2, r * 0.38, 0, Math.PI * 2);
          sctx.fill();
        }
      } else {
        sctx.strokeStyle = rgba("#ffffff", ice ? 0.55 : 0.4);
        sctx.lineWidth = 0.7 * S;
        sctx.beginPath();
        const len = (2 + rand(i, 25, 54) * 4) * S;
        sctx.moveTo(x - len, y);
        sctx.quadraticCurveTo(x, y - (ice ? 0 : 0.8 * S), x + len, y);
        sctx.stroke();
      }
    }
    ctx.drawImage(surface, 0, 0);
  };
  water((k) => k === KINDS.WATER || k === KINDS.BRIDGE, { deep: "#2f8fd6", light: "#7fd4f4", edge: "#2a5a40" }, {
    bank: "#9a6a3e",
    lilies: true,
  });
  if (grid.kind.some((k) => k === KINDS.ICE)) {
    water((k) => k === KINDS.ICE, { deep: "#bfe3f6", light: "#f2fbff", edge: "#7aa8c8" }, { bank: "#9cc4dc", lilies: false, ice: true });
  }

  // 5. Bridges: plank by plank over the water.
  for (let ty = 0; ty < TH; ty++) {
    for (let tx = 0; tx < TW; tx++) {
      if (kind[ty * TW + tx] !== KINDS.BRIDGE) continue;
      const x = tx * T * S, y = ty * T * S;
      for (let p = 0; p < 2; p++) {
        ctx.fillStyle = p ? "#b8834a" : "#c99257";
        ctx.strokeStyle = "#6a4422";
        ctx.lineWidth = 0.7 * S;
        roundRect(ctx, x - 0.5 * S, y + p * (T / 2) * S + 0.3 * S, T * S + S, (T / 2) * S - 0.6 * S, 1.2 * S);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  // 6. Little things on the grass: flowers, tufts, pebbles...
  if (theme.decals) {
    for (let ty = 0; ty < TH; ty++) {
      for (let tx = 0; tx < TW; tx++) {
        if (kind[ty * TW + tx] !== KINDS.GROUND || hash(tx, ty, seed + 20) >= theme.decalRate) continue;
        const name = theme.decals[Math.floor(hash(ty, tx, seed + 21) * theme.decals.length)];
        const x = (tx * T + 1 + hash(tx, ty, seed + 22) * (T - 2)) * S, y = (ty * T + 1 + hash(ty, tx, seed + 23) * (T - 2)) * S;
        drawDecal(ctx, name, x, y, S, base, hash(tx, ty, seed + 24));
      }
    }
  }
  return out;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function flower(ctx, x, y, s, petal, center) {
  ctx.fillStyle = petal;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 1.1 * s, y + Math.sin(a) * 1.1 * s, 0.9 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(x, y, 0.75 * s, 0, Math.PI * 2);
  ctx.fill();
}

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, 0.9));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawDecal(ctx, name, x, y, s, base, r) {
  ctx.lineCap = "round";
  switch (name) {
    case "tuft":
      ctx.strokeStyle = shade(base, 0.62);
      ctx.lineWidth = 0.8 * s;
      ctx.beginPath();
      for (const [dx, h] of [[-1.5, 3], [0, 4.5], [1.5, 3]]) {
        ctx.moveTo(x + dx * s, y);
        ctx.quadraticCurveTo(x + dx * 1.3 * s, y - h * 0.6 * s, x + dx * 1.8 * s, y - h * s);
      }
      ctx.stroke();
      return;
    case "flowerPink": return flower(ctx, x, y, s, "#ff8fc0", "#ffe066");
    case "flowerYellow": return flower(ctx, x, y, s, "#ffd84a", "#f08a2a");
    case "flowerWhite": return flower(ctx, x, y, s, "#ffffff", "#ffd84a");
    case "mushroom":
      ctx.fillStyle = "#f2e6c8";
      roundRect(ctx, x - 0.8 * s, y - 1.5 * s, 1.6 * s, 2 * s, 0.6 * s);
      ctx.fill();
      ctx.fillStyle = "#e5523e";
      ctx.beginPath();
      ctx.ellipse(x, y - 1.6 * s, 2.4 * s, 1.6 * s, 0, Math.PI, 0);
      ctx.fill();
      dot(ctx, x - 0.8 * s, y - 2.3 * s, 0.45 * s, "#ffffff");
      return;
    case "pebble":
      ctx.fillStyle = shade(base, 0.7);
      ctx.beginPath();
      ctx.ellipse(x, y, 1.5 * s, 1 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "snow": return flower(ctx, x, y, s * 0.7, "#ffffff", "#e8f6ff");
    case "sparkle":
    case "star": {
      ctx.fillStyle = name === "star" ? "#e8d4ff" : "#fff3b0";
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, rr = (k % 2 ? 0.6 : 2) * s;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.fill();
      return;
    }
    case "glowdot": return glow(ctx, x, y, 3 * s, r > 0.5 ? "#7ff0ff" : "#ff9cf0");
    case "lavacrack":
      ctx.strokeStyle = "#ff7a2a";
      ctx.lineWidth = 0.9 * s;
      ctx.beginPath();
      ctx.moveTo(x - 2.5 * s, y - 1 * s);
      ctx.lineTo(x - 0.5 * s, y + 0.3 * s);
      ctx.lineTo(x + 2.5 * s, y - 0.4 * s);
      ctx.stroke();
      glow(ctx, x, y, 3 * s, "#ffb040");
      return;
    case "shell": return flower(ctx, x, y, s * 0.6, "#ffd6e8", "#f4a6c8");
    case "starfish": {
      ctx.fillStyle = "#ff8a5a";
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = (k % 2 ? 0.8 : 2.2) * s;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.fill();
      return;
    }
    case "ripple":
      ctx.strokeStyle = rgba(tint(base, 0.4), 0.7);
      ctx.lineWidth = 0.6 * s;
      ctx.beginPath();
      ctx.ellipse(x, y, 2.5 * s, 1 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case "bolt":
      ctx.strokeStyle = "#ffe066";
      ctx.lineWidth = 0.9 * s;
      ctx.beginPath();
      ctx.moveTo(x + s, y - 2 * s);
      ctx.lineTo(x - 0.5 * s, y);
      ctx.lineTo(x + 0.5 * s, y);
      ctx.lineTo(x - s, y + 2 * s);
      ctx.stroke();
      return;
    case "ghostwisp": return glow(ctx, x, y, 2.5 * s, "#c8f0d8");
    case "leaf":
      ctx.fillStyle = "#e0a040";
      ctx.beginPath();
      ctx.ellipse(x, y, 1.6 * s, 0.8 * s, r * 3, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "crystalbit":
      ctx.fillStyle = "#7fe3ff";
      ctx.beginPath();
      ctx.moveTo(x, y - 2.5 * s);
      ctx.lineTo(x + s, y);
      ctx.lineTo(x - s, y);
      ctx.fill();
      return;
    case "bone":
    case "crack":
    default:
      ctx.strokeStyle = rgba(shade(base, 0.6), 0.6);
      ctx.lineWidth = 0.6 * s;
      ctx.beginPath();
      ctx.moveTo(x - 1.5 * s, y - s);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 1.2 * s, y + 1.4 * s);
      ctx.stroke();
  }
}

// ---------- Scenery ----------
// Each kind of scenery maps to a shape (tree, pine, mushroom, bush, rock,
// crystal, palm, log) and colors. It's drawn to fill the same box as its
// pixel sprite, standing on the box's bottom edge, so walking around it is
// unchanged.

const LEAF = {
  green: ["#3f9a3a", "#5cc24a", "#9be36a"],
  gold: ["#c8861e", "#f0b43a", "#ffe07a"],
  pink: ["#d05a96", "#f48cc0", "#ffc8e4"],
  light: ["#5aa83e", "#86d058", "#c4f08a"],
  teal: ["#1f8a8a", "#33bdb4", "#8ff0e0"],
  purple: ["#6a46b8", "#9670e0", "#c8b0ff"],
  dark: ["#1f5a50", "#2e7a68", "#5aae90"],
  snow: ["#2f6a5a", "#3f8a6a", "#ffffff"],
  coral: ["#e0566a", "#ff7a8a", "#ffc0c8"],
  coralblue: ["#3a7ad8", "#5aa0f0", "#a8d4ff"],
};

const ART = {
  oak: { shape: "tree", leaf: LEAF.green },
  oakgold: { shape: "tree", leaf: LEAF.gold },
  birch: { shape: "tree", leaf: LEAF.light, trunk: "#f2efe6" },
  cherry: { shape: "tree", leaf: LEAF.pink },
  voidtree: { shape: "tree", leaf: LEAF.purple, trunk: "#4a3a6a" },
  pine: { shape: "pine", leaf: LEAF.green },
  darkpine: { shape: "pine", leaf: LEAF.dark },
  snowpine: { shape: "pine", leaf: LEAF.snow, snow: true },
  bush: { shape: "bush", leaf: LEAF.green },
  fern: { shape: "bush", leaf: LEAF.light },
  flowerbush: { shape: "bush", leaf: LEAF.green, dots: "#ff8fc0" },
  rosebush: { shape: "bush", leaf: LEAF.green, dots: "#ff4f5e" },
  berrybush: { shape: "bush", leaf: LEAF.green, dots: "#4a6ae8" },
  berrybushpicked: { shape: "bush", leaf: LEAF.green },
  coral: { shape: "bush", leaf: LEAF.coral },
  coralblue: { shape: "bush", leaf: LEAF.coralblue },
  pumpkin: { shape: "pumpkin" },
  jackolantern: { shape: "pumpkin", lit: true },
  glowshroom: { shape: "mushroom", cap: "#33c4d8", spots: "#c8fbff", glow: "#7ff0ff" },
  glowshroompink: { shape: "mushroom", cap: "#e86ac8", spots: "#ffd0f4", glow: "#ff9cf0" },
  bigshroom: { shape: "mushroom", cap: "#e5523e", spots: "#ffffff" },
  rock: { shape: "rock", color: "#9aa0ae" },
  mossrock: { shape: "rock", color: "#8a9a86", moss: "#5cae4a" },
  snowrock: { shape: "rock", color: "#a8b4c4", moss: "#ffffff" },
  stormrock: { shape: "rock", color: "#6a7488" },
  lavarock: { shape: "rock", color: "#5a4442", cracks: "#ff7a2a" },
  voidrock: { shape: "rock", color: "#5a4a7a", cracks: "#c8b0ff" },
  obsidian: { shape: "crystal", color: "#3a2a4a", light: "#8a6ab0" },
  crystal: { shape: "crystal", color: "#9a6ae0", light: "#e0ccff" },
  icecrystal: { shape: "crystal", color: "#7ac8f0", light: "#e8fbff" },
  bluecrystal: { shape: "crystal", color: "#3a7ad8", light: "#a8d4ff" },
  ambercrystal: { shape: "crystal", color: "#f0a020", light: "#ffe7a0" },
  palm: { shape: "palm" },
  stump: { shape: "stump" },
  log: { shape: "log" },
};

const OUTLINE = "#2b2236";
const artCache = new Map();

// A storybook canvas for this scenery (game-pixel size w x h, drawn at
// ART_SCALE), or null if it has none.
export function decorArt(type, w, h) {
  const spec = ART[type];
  if (!spec || !STORYBOOK) return null;
  const key = `${type}:${w}x${h}`;
  if (!artCache.has(key)) {
    const c = canvas(Math.ceil(w * ART_SCALE), Math.ceil(h * ART_SCALE));
    const ctx = c.getContext("2d");
    ctx.scale(ART_SCALE, ART_SCALE);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    PAINTERS[spec.shape](ctx, w, h, spec, hash(w, h, type.length));
    artCache.set(key, c);
  }
  return artCache.get(key);
}
export const ART_PIXELS = ART_SCALE;

function blob(ctx, circles, fill, outline = OUTLINE, lw = 0.9) {
  // Outline first (each circle a bit bigger), then the fill on top: one merged shape.
  ctx.fillStyle = outline;
  for (const [x, y, r] of circles) {
    ctx.beginPath();
    ctx.arc(x, y, r + lw, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = fill;
  for (const [x, y, r] of circles) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function groundShadow(ctx, cx, y, rx) {
  ctx.fillStyle = "rgba(20,30,20,0.22)";
  ctx.beginPath();
  ctx.ellipse(cx, y - 1.2, rx, rx * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

const PAINTERS = {
  tree(ctx, w, h, { leaf, trunk = "#8a5a32" }, r) {
    const cx = w / 2;
    groundShadow(ctx, cx, h, w * 0.36);
    // Trunk.
    ctx.fillStyle = OUTLINE;
    roundRect(ctx, cx - w * 0.1 - 0.9, h * 0.55, w * 0.2 + 1.8, h * 0.45 - 0.6, 1.5);
    ctx.fill();
    ctx.fillStyle = trunk;
    roundRect(ctx, cx - w * 0.1, h * 0.55, w * 0.2, h * 0.45 - 1.5, 1.2);
    ctx.fill();
    // Canopy: a cluster of overlapping circles.
    const R = w * 0.27;
    const circles = [
      [cx, h * 0.3, R * 1.15],
      [cx - R * 0.95, h * 0.42, R],
      [cx + R * 0.95, h * 0.42, R],
      [cx - R * 0.45, h * 0.18 + r, R * 0.85],
      [cx + R * 0.5, h * 0.2, R * 0.8],
      [cx, h * 0.5, R * 0.9],
    ];
    blob(ctx, circles, leaf[1]);
    // Shade along the bottom, highlights up top.
    ctx.save();
    ctx.beginPath();
    for (const [x, y, rr] of circles) ctx.moveTo(x + rr, y), ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = leaf[0];
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.62, w * 0.5, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y, rr] of circles.slice(0, 5)) {
      ctx.fillStyle = rgba(leaf[2], 0.85);
      ctx.beginPath();
      ctx.ellipse(x - rr * 0.3, y - rr * 0.35, rr * 0.38, rr * 0.26, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  pine(ctx, w, h, { leaf, snow }) {
    const cx = w / 2;
    groundShadow(ctx, cx, h, w * 0.32);
    ctx.fillStyle = OUTLINE;
    roundRect(ctx, cx - w * 0.08 - 0.9, h * 0.78, w * 0.16 + 1.8, h * 0.22 - 0.6, 1);
    ctx.fill();
    ctx.fillStyle = "#7a4e2c";
    roundRect(ctx, cx - w * 0.08, h * 0.78, w * 0.16, h * 0.22 - 1.4, 1);
    ctx.fill();
    const tiers = 3;
    for (let t = tiers - 1; t >= 0; t--) {
      const top = h * (0.04 + t * 0.2), bottom = h * (0.42 + t * 0.2), half = w * (0.26 + t * 0.12);
      const tri = (grow) => {
        ctx.beginPath();
        ctx.moveTo(cx, top - grow);
        ctx.quadraticCurveTo(cx + half * 0.3, top + (bottom - top) * 0.4, cx + half + grow, bottom + grow * 0.6);
        ctx.quadraticCurveTo(cx, bottom + 2.2 + grow, cx - half - grow, bottom + grow * 0.6);
        ctx.quadraticCurveTo(cx - half * 0.3, top + (bottom - top) * 0.4, cx, top - grow);
      };
      ctx.fillStyle = OUTLINE;
      tri(0.9);
      ctx.fill();
      ctx.fillStyle = leaf[1];
      tri(0);
      ctx.fill();
      ctx.fillStyle = rgba(leaf[0], 0.9);
      ctx.beginPath();
      ctx.moveTo(cx, top + 1);
      ctx.quadraticCurveTo(cx + half * 0.3, top + (bottom - top) * 0.4, cx + half, bottom);
      ctx.quadraticCurveTo(cx + half * 0.4, bottom + 1.6, cx, bottom + 1.8);
      ctx.fill();
      if (snow) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(cx, top);
        ctx.quadraticCurveTo(cx + half * 0.35, top + (bottom - top) * 0.3, cx + half * 0.55, top + (bottom - top) * 0.45);
        ctx.quadraticCurveTo(cx, top + (bottom - top) * 0.35, cx - half * 0.55, top + (bottom - top) * 0.45);
        ctx.quadraticCurveTo(cx - half * 0.35, top + (bottom - top) * 0.3, cx, top);
        ctx.fill();
      } else {
        ctx.fillStyle = rgba(leaf[2], 0.7);
        ctx.beginPath();
        ctx.ellipse(cx - half * 0.3, top + (bottom - top) * 0.55, half * 0.22, (bottom - top) * 0.12, -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  bush(ctx, w, h, { leaf, dots }, r) {
    const cx = w / 2;
    groundShadow(ctx, cx, h, w * 0.42);
    const R = Math.min(w * 0.26, h * 0.42);
    const circles = [
      [cx - R * 0.9, h - R * 0.95, R * 0.9],
      [cx + R * 0.9, h - R * 0.95, R * 0.9],
      [cx, h - R * 1.25, R * 1.1],
    ];
    blob(ctx, circles, leaf[1]);
    ctx.save();
    ctx.beginPath();
    for (const [x, y, rr] of circles) ctx.moveTo(x + rr, y), ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = leaf[0];
    ctx.beginPath();
    ctx.ellipse(cx, h - 0.5, w * 0.55, R * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y, rr] of circles) {
      ctx.fillStyle = rgba(leaf[2], 0.8);
      ctx.beginPath();
      ctx.ellipse(x - rr * 0.25, y - rr * 0.4, rr * 0.4, rr * 0.24, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (dots) {
      for (let k = 0; k < 5; k++) {
        const a = k * 2.4 + r * 6, d = R * (0.35 + ((k * 37) % 10) / 16);
        const x = cx + Math.cos(a) * d * 1.3, y = h - R * 1.05 + Math.sin(a) * d * 0.6;
        dot(ctx, x, y, R * 0.2 + 0.5, OUTLINE);
        dot(ctx, x, y, R * 0.2, dots);
        dot(ctx, x - R * 0.06, y - R * 0.07, R * 0.07, "#ffffff");
      }
    }
  },

  mushroom(ctx, w, h, { cap, spots, glow: halo }) {
    const cx = w / 2;
    if (halo) glow(ctx, cx, h * 0.35, w * 0.7, halo);
    groundShadow(ctx, cx, h, w * 0.3);
    // Stem.
    ctx.fillStyle = OUTLINE;
    roundRect(ctx, cx - w * 0.15 - 0.9, h * 0.45, w * 0.3 + 1.8, h * 0.55 - 0.5, w * 0.12);
    ctx.fill();
    ctx.fillStyle = "#f4ead0";
    roundRect(ctx, cx - w * 0.15, h * 0.45, w * 0.3, h * 0.55 - 1.4, w * 0.1);
    ctx.fill();
    // Cap: a dome.
    const capH = h * 0.5, capW = w * 0.48;
    const dome = (g) => {
      ctx.beginPath();
      ctx.ellipse(cx, h * 0.5, capW + g, capH + g, 0, Math.PI, 0);
      ctx.quadraticCurveTo(cx, h * 0.6 + g, cx - capW - g, h * 0.5);
    };
    ctx.fillStyle = OUTLINE;
    dome(0.9);
    ctx.fill();
    ctx.fillStyle = cap;
    dome(0);
    ctx.fill();
    ctx.save();
    dome(0);
    ctx.clip();
    ctx.fillStyle = shade(cap, 0.78);
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.56, capW * 1.1, capH * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [dx, dy, rr] of [[-0.5, 0.45, 0.16], [0.15, 0.25, 0.2], [0.55, 0.5, 0.12], [-0.15, 0.7, 0.1]]) {
      dot(ctx, cx + dx * capW, h * 0.5 - (1 - dy) * capH * 0.85, rr * capW, spots);
    }
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(cx - capW * 0.45, h * 0.5 - capH * 0.6, capW * 0.25, capH * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  rock(ctx, w, h, { color, moss, cracks }, r) {
    const cx = w / 2;
    groundShadow(ctx, cx, h, w * 0.45);
    // A rounded boulder: a few overlapping ovals, flat where it sits.
    const ry = Math.min(h * 0.62, w * 0.42);
    const ovals = [
      [cx - w * 0.14, h - ry * 0.8, w * 0.3, ry * 0.8],
      [cx + w * 0.15, h - ry * 0.72, w * 0.28, ry * 0.72],
      [cx - w * 0.02 + (r - 0.5) * w * 0.08, h - ry * 1.0, w * 0.26, ry * 0.75],
    ];
    const shape = (g) => {
      ctx.beginPath();
      for (const [x, y, rx, rry] of ovals) {
        ctx.moveTo(x + rx + g, y);
        ctx.ellipse(x, y, rx + g, rry + g, 0, 0, Math.PI * 2);
      }
    };
    ctx.save();
    ctx.beginPath();
    ctx.rect(-2, -2, w + 4, h - 0.6 + 2); // flat bottom
    ctx.clip();
    ctx.fillStyle = OUTLINE;
    shape(0.9);
    ctx.fill();
    ctx.fillStyle = color;
    shape(0);
    ctx.fill();
    ctx.restore();
    ctx.save();
    shape(0);
    ctx.clip();
    ctx.fillStyle = shade(color, 0.75);
    ctx.beginPath();
    ctx.ellipse(cx + w * 0.2, h, w * 0.5, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tint(color, 0.4);
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.18, h * 0.38, w * 0.18, h * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();
    if (moss) {
      ctx.fillStyle = moss;
      ctx.beginPath();
      ctx.ellipse(cx - w * 0.05, h * 0.18, w * 0.35, h * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (cracks) {
      ctx.strokeStyle = cracks;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.2, h * 0.4);
      ctx.lineTo(cx, h * 0.6);
      ctx.lineTo(cx + w * 0.15, h * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  },

  crystal(ctx, w, h, { color, light }) {
    const cx = w / 2;
    glow(ctx, cx, h * 0.5, w * 0.6, light);
    groundShadow(ctx, cx, h, w * 0.38);
    const shards = [[-0.28, 0.6, 0.16, -0.25], [0.26, 0.65, 0.15, 0.22], [0, 1, 0.2, 0]];
    for (const [dx, tall, half, lean] of shards) {
      const bx = cx + dx * w, top = h - h * 0.95 * tall, hw = w * half;
      const prism = (g) => {
        ctx.beginPath();
        ctx.moveTo(bx - hw - g, h - 1 + g * 0.3);
        ctx.lineTo(bx - hw - g + lean * 4, top + hw + g * 0.2);
        ctx.lineTo(bx + lean * 4, top - g);
        ctx.lineTo(bx + hw + g + lean * 4, top + hw + g * 0.2);
        ctx.lineTo(bx + hw + g, h - 1 + g * 0.3);
        ctx.closePath();
      };
      ctx.fillStyle = OUTLINE;
      prism(0.9);
      ctx.fill();
      ctx.fillStyle = color;
      prism(0);
      ctx.fill();
      ctx.fillStyle = rgba(light, 0.8);
      ctx.beginPath();
      ctx.moveTo(bx - hw * 0.6 + lean * 4, top + hw);
      ctx.lineTo(bx + lean * 4, top + 0.8);
      ctx.lineTo(bx - hw * 0.1, h - 2);
      ctx.lineTo(bx - hw * 0.6, h - 2);
      ctx.closePath();
      ctx.fill();
    }
  },

  palm(ctx, w, h) {
    const cx = w / 2;
    groundShadow(ctx, cx, h, w * 0.32);
    const tw = Math.max(1.6, w * 0.11);
    const trunk = () => {
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.04, h - 1);
      ctx.quadraticCurveTo(cx + w * 0.14, h * 0.6, cx + w * 0.04, h * 0.32);
      ctx.stroke();
    };
    ctx.lineWidth = tw + 1.8;
    ctx.strokeStyle = OUTLINE;
    trunk();
    ctx.lineWidth = tw;
    ctx.strokeStyle = "#b9844e";
    trunk();
    // Fronds: long leaves fanning out from the top.
    const top = [cx + w * 0.04, h * 0.3];
    for (let k = 0; k < 7; k++) {
      const a = Math.PI * 1.05 + (k / 6) * Math.PI * 0.9;
      const len = w * (0.5 + (k % 2) * 0.08);
      const ex = top[0] + Math.cos(a) * len, ey = top[1] + Math.sin(a) * len * 0.45 + len * 0.28;
      const mx = (top[0] + ex) / 2, my = Math.min(top[1], ey) - len * 0.22;
      const leaf = (g) => {
        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        ctx.quadraticCurveTo(mx, my - len * 0.12 - g, ex + g * Math.cos(a), ey + g * 0.5);
        ctx.quadraticCurveTo(mx, my + len * 0.1 + g, top[0], top[1] + 1);
      };
      ctx.fillStyle = OUTLINE;
      leaf(0.9);
      ctx.fill();
      ctx.fillStyle = k % 2 ? "#3fae4a" : "#5ccc5a";
      leaf(0);
      ctx.fill();
    }
    dot(ctx, top[0] - 1.4, top[1] + 1.6, 1.5, OUTLINE);
    dot(ctx, top[0] - 1.4, top[1] + 1.6, 1.1, "#7a4e2c");
    dot(ctx, top[0] + 1.3, top[1] + 1.9, 1.5, OUTLINE);
    dot(ctx, top[0] + 1.3, top[1] + 1.9, 1.1, "#7a4e2c");
  },

  pumpkin(ctx, w, h, { lit }) {
    const cx = w / 2, R = Math.min(w * 0.42, h * 0.45);
    if (lit) glow(ctx, cx, h - R, R * 2.4, "#ffb040");
    groundShadow(ctx, cx, h, R);
    blob(ctx, [[cx - R * 0.45, h - R * 0.9, R * 0.75], [cx + R * 0.45, h - R * 0.9, R * 0.75], [cx, h - R * 0.95, R * 0.85]], "#f08a24");
    ctx.strokeStyle = "#c46412";
    ctx.lineWidth = 0.7;
    for (const dx of [-0.35, 0.35]) {
      ctx.beginPath();
      ctx.ellipse(cx + dx * R, h - R * 0.92, R * 0.25, R * 0.78, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#4a8a2a";
    roundRect(ctx, cx - 0.8, h - R * 1.95, 1.6, R * 0.35, 0.6);
    ctx.fill();
    if (lit) {
      ctx.fillStyle = "#ffe066";
      for (const dx of [-0.35, 0.35]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * R - 1, h - R * 1.05);
        ctx.lineTo(cx + dx * R + 1, h - R * 1.05);
        ctx.lineTo(cx + dx * R, h - R * 1.3);
        ctx.fill();
      }
      ctx.fillRect(cx - R * 0.4, h - R * 0.65, R * 0.8, R * 0.18);
    }
  },

  stump(ctx, w, h) {
    const cx = w / 2;
    groundShadow(ctx, cx, h, w * 0.4);
    ctx.fillStyle = OUTLINE;
    roundRect(ctx, cx - w * 0.36 - 0.9, h * 0.35, w * 0.72 + 1.8, h * 0.65 - 0.4, 2);
    ctx.fill();
    ctx.fillStyle = "#9a6a3e";
    roundRect(ctx, cx - w * 0.36, h * 0.35, w * 0.72, h * 0.65 - 1.4, 1.6);
    ctx.fill();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.35, w * 0.36 + 0.9, h * 0.14 + 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e0b47a";
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.35, w * 0.36, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b08050";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.35, w * 0.18, h * 0.07, 0, 0, Math.PI * 2);
    ctx.stroke();
  },

  log(ctx, w, h) {
    groundShadow(ctx, w / 2, h, w * 0.48);
    ctx.fillStyle = OUTLINE;
    roundRect(ctx, 0.5, h * 0.35 - 0.9, w - 1, h * 0.6 + 1.2, h * 0.3);
    ctx.fill();
    ctx.fillStyle = "#9a6a3e";
    roundRect(ctx, 1.4, h * 0.35, w - 2.8, h * 0.6 - 0.6, h * 0.28);
    ctx.fill();
    ctx.fillStyle = "#e0b47a";
    ctx.beginPath();
    ctx.ellipse(w - 3, h * 0.65, h * 0.18, h * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7a4e2c";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(4, h * 0.55);
    ctx.lineTo(w * 0.6, h * 0.55);
    ctx.stroke();
  },
};
