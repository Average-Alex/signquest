// The Arena plaza: a colosseum you walk around in, with everyone else who's
// in the Arena walking around too (arena.js sends where you are and gets where
// they are, a few times a second; here they glide between updates).
//
// Warm raked sand with a duel ring painted in the middle and a gold champion's
// statue, stands full of a (still) crowd behind the wall, banners, torches on
// pillars, and flower beds along the front.
//
// Walk with the arrow keys / WASD, or tap where to go. Walk up to someone to
// challenge them or invite them to your party (arena.js shows the buttons).
// Stand on a glowing pad to join a queue - ⚔️ 1v1 Ranked or 🎉 Party Battle -
// and step off it to leave.

import { decorSrc, heroSrc, spriteCanvas } from "./sprites.js";

export const PLAZA_W = 400;
export const PLAZA_H = 240;
const SCALE = 3; // real canvas pixels per game pixel
const SPEED = 70; // pixels per second
const NEAR = 28; // this close to someone to challenge them
const TOP = 58; // the stands and the arena wall are above this
const EDGE = 8; // a stone border around the sand
const BEDS = 14; // flower beds along the front

export const PADS = [
  { id: "solo", x: 82, y: 168, r: 22, label: "1v1 RANKED", color: [232, 80, 106] },
  { id: "party", x: 318, y: 168, r: 22, label: "PARTY BATTLE", color: [63, 184, 208] },
];
const RING = { x: 200, y: 140 }; // the duel ring painted on the sand
const STATUE = { x: 200, y: 132 };
const PILLARS = [{ x: 34, y: 104 }, { x: 366, y: 104 }, { x: 140, y: 214 }, { x: 260, y: 214 }];
const OBSTACLES = [{ x: STATUE.x, y: STATUE.y - 4, r: 15 }, ...PILLARS.map((p) => ({ x: p.x, y: p.y - 3, r: 7 }))];

const free = (x, y) => x > EDGE + 4 && x < PLAZA_W - EDGE - 4 && y > TOP + 4 && y < PLAZA_H - BEDS && OBSTACLES.every((o) => Math.hypot(x - o.x, y - o.y) > o.r);

// A steady random number for (x, y), so the sand and crowd look the same every time.
const rand = (x, y, k = 0) => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

// ---------- The arena, painted once ----------

let floorCanvas = null;
function floor() {
  if (floorCanvas) return floorCanvas;
  const c = document.createElement("canvas");
  c.width = PLAZA_W;
  c.height = PLAZA_H;
  const ctx = c.getContext("2d");
  const px = (x, y, color, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  // Sand, raked in rings around the middle.
  for (let y = TOP; y < PLAZA_H; y++)
    for (let x = 0; x < PLAZA_W; x++) {
      const r = rand(x, y);
      const ringDist = Math.hypot((x - RING.x) / 1.6, y - RING.y);
      let color = r < 0.08 ? "#d2ad72" : r > 0.94 ? "#f0d6a4" : "#e4c48c";
      if (Math.round(ringDist) % 12 === 0 && rand(x, y, 2) < 0.7) color = "#d8b47a";
      px(x, y, color);
    }
  // The duel ring: a white line, then gold.
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#fff4dc";
  ctx.beginPath();
  ctx.ellipse(RING.x, RING.y, 74, 44, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#e8b820";
  ctx.beginPath();
  ctx.ellipse(RING.x, RING.y, 70, 41, 0, 0, Math.PI * 2);
  ctx.stroke();
  // The statue's pedestal.
  ctx.fillStyle = "#2b1d2e";
  ctx.beginPath();
  ctx.ellipse(STATUE.x, STATUE.y, 18, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b8b0c4";
  ctx.beginPath();
  ctx.ellipse(STATUE.x, STATUE.y - 1, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stone border down the sides.
  for (let y = TOP; y < PLAZA_H; y++)
    for (const x0 of [0, PLAZA_W - EDGE])
      for (let x = x0; x < x0 + EDGE; x++) px(x, y, (y + (x0 ? 0 : 4)) % 10 === 0 || x === x0 + (x0 ? 0 : EDGE - 1) ? "#6e6050" : "#9a8a76");
  // Flower beds along the front.
  for (let x = 0; x < PLAZA_W; x++)
    for (let y = PLAZA_H - BEDS; y < PLAZA_H; y++) {
      let color = y === PLAZA_H - BEDS ? "#6e6050" : rand(x, y, 3) < 0.5 ? "#5aa848" : "#4a9a3e";
      const f = rand(x, y, 4);
      if (y > PLAZA_H - BEDS + 2 && f < 0.07) color = ["#f06a8a", "#ffd84a", "#ffffff", "#c58cf0"][Math.floor(rand(x, y, 5) * 4)];
      px(x, y, color);
    }

  // The stands: stone tiers full of people (they sit still).
  const SKINS = ["#ffe0c4", "#f6c9a0", "#e0a878", "#c98d5d", "#8f5a36", "#5e3a22"];
  const SHIRTS = ["#d8443c", "#3a6ab0", "#e8b820", "#3faa3a", "#8a5ad6", "#f08a24", "#2fb3a6", "#f4ecdc"];
  const tiers = 4, tierH = 9, standsTop = 2;
  for (let t = 0; t < tiers; t++) {
    const y0 = standsTop + t * tierH;
    px(0, y0, t % 2 ? "#8a7a68" : "#9a8a76", PLAZA_W, tierH);
    px(0, y0 + tierH - 1, "#5e5244", PLAZA_W, 1);
    for (let x = 3 + (t % 2) * 3; x < PLAZA_W - 3; x += 6) {
      if (rand(x, t, 6) < 0.12) continue; // an empty seat now and then
      px(x, y0 + 4, SHIRTS[Math.floor(rand(x, t, 7) * SHIRTS.length)], 4, 4);
      px(x + 1, y0 + 1, SKINS[Math.floor(rand(x, t, 8) * SKINS.length)], 2, 3);
      if (rand(x, t, 9) < 0.3) px(x + 1, y0 + 1, ["#2d2a3a", "#8a5426", "#ffd54a", "#e8743a"][Math.floor(rand(x, t, 10) * 4)], 2, 1); // hair
    }
  }
  // The arena wall in front of the stands, with a gate in the middle.
  const wallTop = standsTop + tiers * tierH;
  for (let y = wallTop; y < TOP; y++)
    for (let x = 0; x < PLAZA_W; x++) {
      const brick = (y - wallTop) % 5 === 4 || (x + (Math.floor((y - wallTop) / 5) % 2) * 6) % 12 === 0;
      px(x, y, y === wallTop ? "#c8b8a0" : brick ? "#7a6a58" : "#a8977f");
    }
  px(0, TOP - 1, "#3e3428", PLAZA_W, 1);
  // The gate: a dark arch with a portcullis.
  const gx = PLAZA_W / 2 - 14, gw = 28;
  for (let y = wallTop + 1; y < TOP; y++)
    for (let x = gx; x < gx + gw; x++) {
      const dx = x - (gx + gw / 2 - 0.5), dy = y - (wallTop + 8);
      if (dy < 0 && Math.hypot(dx / (gw / 2), dy / 8) > 1) continue;
      px(x, y, (x - gx) % 5 === 2 || (y - wallTop) % 5 === 2 ? "#5a4a3a" : "#1c1420");
    }
  // Banners hanging off the wall: red and blue, trimmed in gold.
  for (let i = 0, x = 22; x < PLAZA_W - 10; x += 48, i++) {
    if (Math.abs(x - PLAZA_W / 2) < 26) continue;
    const color = i % 2 ? "#3a6ab0" : "#c8414b";
    for (let y = 0; y < 16; y++) {
      const w = y < 12 ? 10 : 10 - (y - 11) * 2; // a pointed bottom
      px(x - w / 2, wallTop + y, y === 0 ? "#e8b820" : color, w, 1);
      if (y > 0 && y < 12) px(x - 5, wallTop + y, "#e8b820"), px(x + 4, wallTop + y, "#e8b820");
    }
    px(x - 1, wallTop + 4, "#ffd23f", 2, 4); // a little crest
  }
  floorCanvas = c;
  return c;
}

// ---------- The plaza ----------

export function createPlaza(canvas, { onNear, onPad }) {
  canvas.width = PLAZA_W * SCALE;
  canvas.height = PLAZA_H * SCALE;
  const ctx = canvas.getContext("2d");
  const keys = new Set();
  const me = { x: PLAZA_W / 2, y: PLAZA_H - 24, flip: false, moving: false, goal: null };
  let look = null, hat = null;
  let others = new Map(); // id -> { ...player, x, y (drawn), tx, ty (latest) }
  let running = false;
  let last = 0;
  let near = null;
  let pad = null;

  function respawn() {
    me.x = PLAZA_W / 2 + (Math.random() - 0.5) * 60;
    me.y = PLAZA_H - 24;
    me.goal = null;
  }

  function setOthers(list, party = []) {
    const next = new Map();
    for (const o of list) {
      if (!o.pos) continue;
      const had = others.get(o.id);
      next.set(o.id, { ...o, x: had ? had.x : o.pos.x, y: had ? had.y : o.pos.y, tx: o.pos.x, ty: o.pos.y, mate: party.includes(o.id) });
    }
    others = next;
  }

  function move(dt) {
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
    // Slide along walls: try both, then each way alone.
    if (free(nx, ny)) (me.x = nx), (me.y = ny);
    else if (free(nx, me.y)) me.x = nx;
    else if (free(me.x, ny)) me.y = ny;
    else me.goal = null;
    if (dx) me.flip = dx < 0;
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    move(dt);
    // Everyone else glides toward where they were last seen.
    for (const o of others.values()) {
      const k = Math.min(1, dt * 8);
      o.x += (o.tx - o.x) * k;
      o.y += (o.ty - o.y) * k;
    }

    // Who's close enough to challenge, and which pad you're on.
    let closest = null, best = NEAR;
    for (const o of others.values()) {
      const d = Math.hypot(o.x - me.x, o.y - me.y);
      if (d < best) (best = d), (closest = o);
    }
    if ((closest?.id || null) !== (near?.id || null)) onNear(closest);
    near = closest;
    const on = PADS.find((p) => Math.hypot(p.x - me.x, (p.y - me.y) * 1.4) < p.r)?.id || null;
    if (on !== pad) onPad(on);
    pad = on;

    draw(now);
  }

  function draw(now) {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(floor(), 0, 0);
    // The pads glow (more when you're on one).
    for (const p of PADS) {
      const [r, g, b] = p.color;
      const lit = pad === p.id;
      // A gold rim, the pad's color inside, and a white inner ring.
      ctx.fillStyle = "#2b1d2e";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r + 3, p.r * 0.6 + 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8b820";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r + 1.5, p.r * 0.6 + 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgb(${Math.round(r * (lit ? 1 : 0.8))},${Math.round(g * (lit ? 1 : 0.8))},${Math.round(b * (lit ? 1 : 0.8))})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r - 5, (p.r - 5) * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // People and pillars, sorted so whoever's lower is in front.
    const things = PILLARS.map((p) => ({ y: p.y, img: spriteCanvas(decorSrc("pillar")), x: p.x, torch: true }));
    things.push({ y: STATUE.y + 2, img: spriteCanvas(decorSrc("goldstatue")), x: STATUE.x, scale: 2 });
    const walk = (moving, speed, off = 0) => (moving ? Math.floor(now / speed + off) % 4 : 0);
    for (const o of others.values()) {
      const moving = Math.hypot(o.tx - o.x, o.ty - o.y) > 0.6;
      if (moving) o.flip = o.tx < o.x;
      const f = walk(moving, 120, o.x);
      things.push({ y: o.y, x: o.x, img: spriteCanvas(heroSrc(o.look, null, f, false)), flip: o.flip, person: o, lift: f % 2 });
    }
    const f = walk(me.moving, 110);
    things.push({ y: me.y, x: me.x, img: spriteCanvas(heroSrc(look, hat, f)), flip: me.flip, person: { name: "You", me: true }, lift: f % 2 });
    things.sort((a, b) => a.y - b.y);
    for (const t of things) {
      const w = t.img.width * (t.scale || 1), h = t.img.height * (t.scale || 1); // sprites here are 1 game pixel per pixel
      if (t.person) {
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath();
        ctx.ellipse(t.x, t.y - 1, 6, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const x = Math.round(t.x - w / 2), y = Math.round(t.y - h - (t.lift || 0));
      if (t.flip) {
        ctx.save();
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(t.img, 0, 0, w, h);
        ctx.restore();
      } else ctx.drawImage(t.img, x, y, w, h);
      if (t.torch) {
        // A torch on top of the pillar, with a warm glow.
        const fx = Math.round(t.x), fy = y - 1;
        const glow = ctx.createRadialGradient(fx, fy - 2, 1, fx, fy - 2, 14);
        glow.addColorStop(0, "rgba(255, 190, 80, 0.35)");
        glow.addColorStop(1, "rgba(255, 190, 80, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(fx - 14, fy - 16, 28, 28);
        ctx.fillStyle = "#e8602a";
        ctx.fillRect(fx - 2, fy - 4, 4, 4);
        ctx.fillStyle = "#ffd23f";
        ctx.fillRect(fx - 1, fy - 6, 2, 4);
      }
    }
    // Labels in real pixels, so the text is crisp: pad names, and names over heads.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    const label = (text, x, y, color, size = 17) => {
      ctx.font = `800 ${size}px system-ui, sans-serif`; // real pixels
      ctx.strokeStyle = "#2b1d2e";
      ctx.lineWidth = 4;
      ctx.strokeText(text, x * SCALE, y * SCALE);
      ctx.fillStyle = color;
      ctx.fillText(text, x * SCALE, y * SCALE);
    };
    for (const p of PADS) label(p.label, p.x, p.y - p.r * 0.6 - 5, "#fff", 19);
    for (const t of things) {
      if (!t.person) continue;
      const o = t.person;
      const color = o.me ? "#ffd23f" : o.mate ? "#7fe3ff" : near?.id === o.id ? "#ffb0c0" : "#fff";
      label(o.me ? "You" : `${o.mate ? "★ " : ""}${o.name}`, t.x, t.y - t.img.height - 3, color);
    }
  }

  // Keys and taps.
  const KEY_DIRS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down" };
  window.addEventListener("keydown", (e) => {
    if (!running || e.target.closest?.("input, textarea, select")) return;
    const dir = KEY_DIRS[e.key];
    if (!dir) return;
    keys.add(dir);
    e.preventDefault();
  });
  window.addEventListener("keyup", (e) => keys.delete(KEY_DIRS[e.key]));
  window.addEventListener("blur", () => keys.clear());
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    me.goal = { x: ((e.clientX - r.left) / r.width) * PLAZA_W, y: ((e.clientY - r.top) / r.height) * PLAZA_H };
  });

  return {
    start(newLook, newHat) {
      look = newLook;
      hat = newHat;
      if (running) return;
      running = true;
      last = 0;
      requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      keys.clear();
    },
    pos: () => ({ x: me.x, y: me.y, flip: me.flip, moving: me.moving }),
    setOthers,
    respawn,
  };
}
