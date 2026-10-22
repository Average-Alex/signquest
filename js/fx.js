// Battle effects: particles, projectiles, impacts, screen shake, flashes,
// and floating damage numbers.
//
// Particles are drawn on a canvas over the battle field at 1/3 resolution and
// scaled up with `image-rendering: pixelated`, so every spark is a chunky
// pixel that matches the sprites. Positions are in those canvas pixels; use
// centerOf(element) to get one. Every move has an element (fire, water, ice,
// ...) that picks its colors, from elementOf(move).

const $ = (id) => document.getElementById(id);
const PIX = 4; // screen pixels per effect pixel (chunky, like the sprites)

const PALETTES = {
  fire: ["#fff27a", "#ffc93c", "#ff8a2a", "#e8413b", "#a82e2e"],
  water: ["#ffffff", "#bfe8ff", "#7fd0ff", "#3a95d4", "#2f6bd0"],
  ice: ["#ffffff", "#e8f7ff", "#bfe8ff", "#7fc8f0", "#4f9ad6"],
  lightning: ["#ffffff", "#fff6a8", "#ffe066", "#7fe3ff", "#4fb3ff"],
  nature: ["#f2ffc8", "#b8f07a", "#6cc24a", "#3f9a4a", "#ff9ad5"],
  rock: ["#f2e6d0", "#d4c4a8", "#a89a8a", "#7a6e64", "#4a4038"],
  dark: ["#f0d0ff", "#c58cf0", "#9b30d9", "#5a2fa0", "#2b1d2e"],
  light: ["#ffffff", "#fff6c8", "#ffe9a8", "#ffc93c", "#c58cf0"],
  impact: ["#ffffff", "#fff6c8", "#ffc93c", "#ff8a2a", "#e8e0d0"],
  heal: ["#ffffff", "#d9ffc8", "#8ee05a", "#3fc93a", "#2f9a2b"],
  shield: ["#ffffff", "#cfe8ff", "#7fb8ff", "#3a7fd6", "#2a5ab0"],
  hex: ["#ffffff", "#f0d0ff", "#c040ff", "#8a1fd0", "#3a1f5e"],
  danger: ["#ffffff", "#ffd0d0", "#ff6b5e", "#e8413b", "#8f1f1a"],
};

// Which element a move is, from its icon (and a few names).
const BY_ICON = {
  "🔥": "fire", "💦": "water", "🌊": "water", "💧": "water", "🫧": "water", "🌧️": "water", "🐙": "water",
  "❄️": "ice", "🧊": "ice", "🌨️": "ice", "🏔️": "ice", "🥶": "ice",
  "⚡": "lightning", "🌬️": "lightning", "🔊": "lightning", "📢": "lightning",
  "🍄": "nature", "🌿": "nature", "🥕": "nature", "💤": "nature", "💚": "heal", "🌈": "light",
  "🪨": "rock", "💎": "rock", "💥": "rock", "🦀": "rock", "🛡️": "shield",
  "🌑": "dark", "🌀": "dark", "🦇": "dark", "👻": "dark", "🌫️": "dark", "🌙": "dark", "🟣": "dark", "💜": "dark",
  "✨": "light", "🌟": "light", "🏮": "light", "🦄": "light", "🌤️": "light", "☁️": "light", "🪶": "light",
};
const PHYSICAL = new Set(["🐾", "🦶", "🐕", "👅", "🟢", "🦄", "🦀", "🪶", "🥕", "🦇", "🐙", "💨", "👻"]);

export function elementOf(move) {
  if (move.id === "blast") return "fire";
  if (move.id === "spark" || move.id === "nova") return "light";
  return BY_ICON[move.icon] || "impact";
}
// Physical moves dash in and hit; the rest fire a projectile.
export const isPhysical = (move) => PHYSICAL.has(move.icon);

let canvas = null;
let ctx = null;
let particles = [];
let rings = [];
let projectiles = [];
let slashes = [];
let frozenUntil = 0;
let running = false;

function arena() {
  return $("arena");
}

function fit() {
  canvas ||= $("fx");
  ctx ||= canvas.getContext("2d");
  const r = arena().getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width / PIX)), h = Math.max(1, Math.round(r.height / PIX));
  if (canvas.width !== w || canvas.height !== h) (canvas.width = w), (canvas.height = h);
}

// The middle of an element, in effect pixels. `yFrac` 0 = its top, 1 = its bottom.
export function centerOf(el, yFrac = 0.5) {
  fit();
  const a = arena().getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: (r.left - a.left + r.width / 2) / PIX, y: (r.top - a.top + r.height * yFrac) / PIX };
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const colorsFor = (element) => PALETTES[element] || PALETTES.impact;

function start() {
  if (running) return;
  running = true;
  requestAnimationFrame(loop);
}

function loop(now) {
  if (!particles.length && !rings.length && !projectiles.length && !slashes.length) {
    running = false;
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  requestAnimationFrame(loop);
  const frozen = now < frozenUntil; // hit-stop: everything holds for a moment
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const p of projectiles) {
    // (The frame time can be a hair before the projectile was made: clamp at 0.)
    if (!frozen) p.t = Math.max(0, Math.min(1, (now - p.start) / p.ms));
    const u = 1 - p.t;
    // A curve from start to end, lifted in the middle by `arc`.
    const x = u * u * p.from.x + 2 * u * p.t * p.mid.x + p.t * p.t * p.to.x;
    const y = u * u * p.from.y + 2 * u * p.t * p.mid.y + p.t * p.t * p.to.y;
    if (!frozen) {
      for (let i = 0; i < 3; i++) spawn(x, y, p.element, { speed: 0.35, life: 260, size: Math.max(1, p.size - 1), drag: 0.9 });
      p.trail.unshift({ x, y });
      p.trail.length = Math.min(p.trail.length, 10);
    }
    drawProjectile(p, x, y, now);
    if (p.t >= 1 && !p.done) {
      p.done = true;
      p.resolve();
    }
  }
  projectiles = projectiles.filter((p) => !p.done);

  for (const p of particles) {
    if (!frozen) {
      if (p.orbit) {
        p.angle += p.spin;
        p.x = p.cx + Math.cos(p.angle) * p.radius;
        p.y = p.cy + Math.sin(p.angle) * p.radius * 0.45;
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity;
      }
      p.age += 16;
    }
    const fade = 1 - p.age / p.life;
    if (fade <= 0) continue;
    ctx.globalAlpha = Math.min(1, fade * 1.6);
    ctx.fillStyle = p.color;
    const s = Math.max(1, Math.round(p.size * (p.shrink ? fade : 1)));
    ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    if (p.star && s >= 2) {
      // A little plus-shaped twinkle.
      ctx.fillRect(Math.round(p.x - s * 1.5), Math.round(p.y - 0.5), s * 3, 1);
      ctx.fillRect(Math.round(p.x - 0.5), Math.round(p.y - s * 1.5), 1, s * 3);
    }
  }
  particles = particles.filter((p) => p.age < p.life);

  for (const r of rings) {
    if (!frozen) r.age += 16;
    const t = r.age / r.life;
    if (t >= 1) continue;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = Math.max(1, r.width * (1 - t));
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.maxR * t + 2, (r.maxR * t + 2) * r.squash, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  rings = rings.filter((r) => r.age < r.life);

  for (const s of slashes) {
    if (!frozen) s.age += 16;
    const t = s.age / s.life;
    if (t >= 1 || t < 0) continue; // finished, or not started yet
    // A blade swipe: grows out fast, then thins and fades.
    const reach = s.len * Math.min(1, t * 4);
    const dx = Math.cos(s.angle) * reach, dy = Math.sin(s.angle) * reach;
    ctx.globalAlpha = 1 - t;
    ctx.lineCap = "round";
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, 4 * (1 - t));
    ctx.beginPath();
    ctx.moveTo(s.x - dx, s.y - dy);
    ctx.lineTo(s.x + dx, s.y + dy);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1, 2 * (1 - t));
    ctx.stroke();
  }
  slashes = slashes.filter((s) => s.age < s.life);
  ctx.globalAlpha = 1;
}

// A projectile's look depends on its element, with a fading comet tail behind it.
function drawProjectile(p, x, y, now) {
  const colors = colorsFor(p.element);
  p.trail.forEach((pt, i) => {
    if (!i) return;
    const k = 1 - i / p.trail.length;
    const s = Math.max(1, Math.round(p.size * k * 1.6));
    ctx.globalAlpha = k * 0.8;
    ctx.fillStyle = colors[Math.min(colors.length - 1, 1 + Math.floor((1 - k) * 3))];
    ctx.fillRect(Math.round(pt.x - s / 2), Math.round(pt.y - s / 2), s, s);
  });
  ctx.globalAlpha = 1;
  const s = p.size;
  const box = (size, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x - size), Math.round(y - size), size * 2 + 1, size * 2 + 1);
  };
  switch (p.element) {
    case "fire": {
      const flicker = Math.random() < 0.5 ? 1 : 0;
      box(s + flicker, colors[3]);
      box(s - 1 + flicker, colors[1]);
      box(Math.max(0, s - 2), colors[0]);
      break;
    }
    case "ice": {
      // A spinning diamond shard.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(now / 90);
      ctx.fillStyle = colors[3];
      ctx.fillRect(-s - 1, -s - 1, (s + 1) * 2, (s + 1) * 2);
      ctx.fillStyle = colors[0];
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      break;
    }
    case "lightning": {
      // A crackling bolt back to where it came from, redrawn every frame.
      ctx.strokeStyle = colors[1];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.from.x, p.from.y);
      for (let k = 1; k <= 6; k++) {
        const f = k / 6;
        ctx.lineTo(p.from.x + (x - p.from.x) * f + (k < 6 ? (Math.random() - 0.5) * 6 : 0), p.from.y + (y - p.from.y) * f + (k < 6 ? (Math.random() - 0.5) * 6 : 0));
      }
      ctx.stroke();
      box(s, colors[3]);
      box(Math.max(0, s - 1), colors[0]);
      break;
    }
    case "water": {
      // A bubble: a ring with a shine.
      ctx.strokeStyle = colors[2];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, s + 1, 0, Math.PI * 2);
      ctx.stroke();
      box(Math.max(0, s - 1), colors[3]);
      ctx.fillStyle = colors[0];
      ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), 1, 1);
      break;
    }
    case "dark":
    case "hex":
    case "nature": {
      // An orb with motes circling it.
      box(s, colors[3]);
      box(Math.max(0, s - 1), colors[1]);
      for (let k = 0; k < 3; k++) {
        const a = now / 70 + (k * Math.PI * 2) / 3;
        ctx.fillStyle = colors[k % 2 ? 0 : 2];
        ctx.fillRect(Math.round(x + Math.cos(a) * (s + 3)), Math.round(y + Math.sin(a) * (s + 3) * 0.7), 2, 2);
      }
      break;
    }
    default:
      box(s, colors[2]);
      box(Math.max(0, Math.floor(s / 2)), colors[0]);
      if (p.element === "light") {
        ctx.fillStyle = colors[0];
        ctx.fillRect(Math.round(x - s * 2), Math.round(y), s * 4 + 1, 1);
        ctx.fillRect(Math.round(x), Math.round(y - s * 2), 1, s * 4 + 1);
      }
  }
}

function spawn(x, y, element, o = {}) {
  const angle = (o.angle ?? Math.random() * Math.PI * 2) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2);
  const speed = (o.speed ?? 1) * (0.4 + Math.random());
  particles.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    gravity: o.gravity ?? 0.03,
    drag: o.drag ?? 0.94,
    size: o.size ?? 1 + Math.floor(Math.random() * 3) + (Math.random() < 0.25 ? 1 : 0),
    color: o.color || pick(colorsFor(element)),
    life: (o.life ?? 600) * (0.6 + Math.random() * 0.6),
    age: 0,
    star: o.star ?? Math.random() < 0.15,
    shrink: o.shrink ?? true,
  });
}

// ---------- Building blocks ----------

// An explosion of particles at a point.
export function burst(p, element, { count = 24, speed = 1.2, size, life = 650, gravity = 0.03, angle, spread } = {}) {
  fit();
  for (let i = 0; i < count; i++) spawn(p.x, p.y, element, { speed, size, life, gravity, angle, spread });
  start();
}

// An expanding ring (a shockwave).
export function ring(p, element, { maxR = 20, life = 380, width = 2, squash = 0.55, color } = {}) {
  fit();
  rings.push({ x: p.x, y: p.y, maxR, life, width, squash, age: 0, color: color || colorsFor(element)[1] });
  start();
}

// Sparks pulled in toward a point (charging up).
export function gather(p, element, { ms = 300, count = 18, radius = 26 } = {}) {
  fit();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = radius * (0.7 + Math.random() * 0.5);
    const life = ms * (0.7 + Math.random() * 0.4);
    const frames = life / 16;
    particles.push({
      x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.7,
      vx: (-Math.cos(a) * r) / frames, vy: (-Math.sin(a) * r * 0.7) / frames,
      gravity: 0, drag: 1, size: 1 + Math.floor(Math.random() * 2), color: pick(colorsFor(element)),
      life, age: 0, star: Math.random() < 0.3, shrink: false,
    });
  }
  start();
}

// A glowing orb that flies from one point to another. Resolves on impact.
export function projectile(from, to, element, { ms = 320, size = 3, arc = -18 } = {}) {
  fit();
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + arc };
  return new Promise((resolve) => {
    projectiles.push({ from, to, mid, element, ms, size, start: performance.now(), t: 0, trail: [], resolve });
    start();
  });
}

// Blade swipes across a point (physical hits). Big hits get an X of two.
export function slash(p, element, { count = 1, len = 14, life = 260 } = {}) {
  fit();
  const color = element === "impact" ? "#fff6c8" : colorsFor(element)[1];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 4 + (i % 2 ? Math.PI / 2 : 0) + (Math.random() - 0.5) * 0.4;
    slashes.push({ x: p.x + (Math.random() - 0.5) * 4, y: p.y + (Math.random() - 0.5) * 4, angle, len, life: life + i * 40, age: -i * 50, color });
  }
  start();
}

// Rays shooting out from a point (crits).
export function rays(p, element, { count = 12, speed = 3.2 } = {}) {
  fit();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    for (let k = 0; k < 4; k++) spawn(p.x, p.y, element, { angle: a, spread: 0.05, speed: speed * (0.6 + k * 0.25), size: 2, life: 380, gravity: 0, drag: 0.9, star: false });
  }
  start();
}

// Sparkles drifting upward (healing, freedom).
export function rise(p, element, { count = 22, width = 20 } = {}) {
  fit();
  for (let i = 0; i < count; i++) {
    particles.push({
      x: p.x + (Math.random() - 0.5) * width, y: p.y + Math.random() * 10,
      vx: (Math.random() - 0.5) * 0.2, vy: -0.4 - Math.random() * 0.6, gravity: -0.005, drag: 1,
      size: 1 + Math.floor(Math.random() * 2), color: pick(colorsFor(element)),
      life: 900 + Math.random() * 400, age: 0, star: Math.random() < 0.4, shrink: false,
    });
  }
  start();
}

// Little stars circling over a point (stunned or dizzy).
export function orbit(p, { count = 4, ms = 1400, radius = 10 } = {}) {
  fit();
  for (let i = 0; i < count; i++) {
    particles.push({
      orbit: true, cx: p.x, cy: p.y, radius, angle: (i / count) * Math.PI * 2, spin: 0.12,
      x: p.x, y: p.y, size: 2, color: i % 2 ? "#ffe066" : "#ffffff", life: ms, age: 0, star: true, shrink: false,
    });
  }
  start();
}

// Everything on the field holds still for a split second (makes hits feel heavy).
export function hitStop(ms = 90) {
  frozenUntil = performance.now() + ms;
  arena().classList.add("hitstop");
  setTimeout(() => arena().classList.remove("hitstop"), ms);
}

export function shake(strength = 4, ms = 320) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const s = strength;
  const frames = [0, 1, 2, 3, 4, 5].map((i) => {
    const k = 1 - i / 6;
    return { translate: `${(Math.random() - 0.5) * 2 * s * k}px ${(Math.random() - 0.5) * s * k}px` };
  });
  arena().animate([...frames, { translate: "0 0" }], { duration: ms, easing: "linear" });
}

export function flash(color = "#ffffff", ms = 220, strength = 0.7) {
  const el = $("fx-flash");
  el.style.background = color;
  el.animate([{ opacity: strength }, { opacity: 0 }], { duration: ms, easing: "ease-out" });
}

// A quick punch-in toward a point (crits and big moves).
export function zoom(p, amount = 1.07, ms = 420) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const a = arena();
  a.style.transformOrigin = `${p.x * PIX}px ${p.y * PIX}px`;
  a.animate([{ scale: "1" }, { scale: String(amount), offset: 0.25 }, { scale: "1" }], { duration: ms, easing: "ease-out" });
}

// A damage (or healing) number that pops up and falls away. Several can be on screen at once.
export function number(p, text, kind = "bad") {
  const el = document.createElement("span");
  el.className = `fx-num ${kind}`;
  el.textContent = text;
  el.style.left = `${p.x * PIX}px`;
  el.style.top = `${p.y * PIX}px`;
  el.style.setProperty("--drift", `${(Math.random() - 0.5) * 60}px`);
  arena().appendChild(el);
  setTimeout(() => el.remove(), 1100);
}
