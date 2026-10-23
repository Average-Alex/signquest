// The Colosseum: the pixel-art battle backdrop for Creature Clash in the
// Arena. It's painted once onto a small canvas (320 x 180 game pixels, the
// same size as the zone backdrops) and shown scaled up with crisp pixels.
//
// From the top: sky, the curved stone stands (empty: a crowd there looked
// like the back row of creatures was standing on people), arches along the
// arena wall, banners in the two sides' colors, and the sand
// floor with a ring painted in the middle.

import { hash } from "./worldmap.js";

const W = 320, H = 180;
let cached = null;

export function colosseumSrc() {
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const px = (x, y, color, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };

  // Sky.
  for (let y = 0; y < 30; y++) px(0, y, y < 12 ? "#7fc8ff" : y < 22 ? "#9fd8ff" : "#bfe6ff", W, 1);
  for (let i = 0; i < 6; i++) {
    const cx = hash(i, 1, 7) * W, cy = 4 + hash(i, 2, 7) * 14;
    px(cx, cy, "#ffffff", 14, 3);
    px(cx + 3, cy - 2, "#ffffff", 8, 2);
  }

  // The stands: rows of stone steps, curving down a little toward the edges.
  const STONE = ["#c9b9a0", "#b8a890", "#a8987e"];
  const curve = (x) => Math.round(Math.pow((x - W / 2) / (W / 2), 2) * 10);
  for (let x = 0; x < W; x++) {
    const dip = curve(x);
    for (let y = 26 + dip; y < 92 + dip; y++) {
      const row = Math.floor((y - dip - 26) / 6);
      const edge = (y - dip - 26) % 6 === 0;
      px(x, y, edge ? "#8a7a64" : STONE[row % 3]);
    }
  }
  // The arena wall: a band of stone with dark arches, and a gold trim.
  const wallTop = 92;
  for (let x = 0; x < W; x++) {
    const dip = curve(x);
    for (let y = wallTop + dip - 2; y < 120; y++) px(x, y, y < wallTop + dip ? "#e8b820" : (x + y) % 9 === 0 ? "#9a8c7c" : "#b0a08a");
  }
  for (let x = 8; x < W - 8; x += 26) {
    const dip = curve(x + 6), top = wallTop + dip + 6;
    for (let y = top; y < 118; y++) {
      const r = y - top;
      const half = r < 4 ? Math.round(Math.sqrt(16 - (4 - r) ** 2) * 1.5) : 6;
      px(x + 6 - half, y, "#3a2e2a", half * 2, 1);
    }
  }
  // Banners: blue on the left (your side), red on the right (theirs).
  for (const [x, a, b] of [[36, "#3a6fd6", "#2a4fa8"], [84, "#3a6fd6", "#2a4fa8"], [W - 92, "#d6453d", "#9a2a24"], [W - 44, "#d6453d", "#9a2a24"]]) {
    const top = wallTop + curve(x) - 18;
    px(x + 5, top - 4, "#5e4a3a", 1, 22); // pole
    px(x, top, a, 10, 14);
    px(x, top, b, 10, 2);
    px(x + 3, top + 5, "#ffd23f", 4, 4); // emblem
    px(x, top + 14, a, 4, 3);
    px(x + 6, top + 14, a, 4, 3);
  }

  // The sand floor, with darker sand speckles and a painted ring.
  for (let y = 118; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = hash(x >> 2, y >> 2, 11);
      px(x, y, hash(x, y, 12) < 0.05 ? "#c8a46a" : n > 0.6 ? "#e8cc8e" : "#f0d8a0");
    }
  }
  for (let y = 0; y < 2; y++) px(0, 118 + y, "#8a7a64", W, 1); // the wall's shadow line
  ctx.strokeStyle = "#d8b878";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(W / 2, 150, 92, 22, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Two starting marks, one for each side.
  for (const x of [84, W - 84]) {
    ctx.beginPath();
    ctx.ellipse(x, 150, 16, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  cached = c.toDataURL();
  return cached;
}
