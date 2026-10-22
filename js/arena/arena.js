// Arena battles: real time, top-down. You and your team (Pip and your
// buddies) move around the arena; you walk (arrows / WASD, the on-screen
// stick, or a controller) and dash out of the way of the creature's attacks,
// which always warn you first. You lead your team by signing: see config.js.
//
// Positions are in game pixels on an ARENA_W x ARENA_H field; the canvas has
// SPRITE_SCALE real pixels for each, so sprites keep their detail. Physics
// runs in fixed 1/60 s steps, so speed is the same on every computer.

import { battleResult } from "../battle-result.js";
import { zoneTheme } from "../biome.js";
import { getPrediction, HoldTimer, targetConfidence } from "../classifier.js";
import {
  BOSS_EXTRA_DAMAGE, buddyMoveBoost, creatureName, CREATURES, effectiveness, ELEMENTS, EVOLVED_POWER, HEAL_FRACTION, HERO_MOVES, isEvolved,
  monsterDamage, playerMaxHp, rarityOf, SIGN_DAMAGE, STAGES, ZONES,
} from "../config.js";
import { elementOf, isPhysical } from "../fx.js";
import { playMusic } from "../music.js";
import * as progress from "../progress.js";
import { QUESTS, ROOK, ROOK_ALLY, ROOK_JOINED_EVENT } from "../quests.js";
import { announce, isShowing, show } from "../screens.js";
import { creatureImg, creatureSrc, decorSrc, heroImg, heroSrc, SPRITE_SCALE, spriteCanvas, WALK_FRAMES } from "../sprites.js";
import { hash, noise } from "../worldmap.js";
import * as C from "./config.js";
import * as hud from "./hud.js";

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const STEP = 1 / 60;
const DEV = new URLSearchParams(location.search).has("dev");
const creature = (id) => CREATURES.find((c) => c.id === id);

let A = null; // the battle in progress

// ---------- Starting ----------

// Same arguments as game.js startBattle, for a battle against one creature.
export function startArena(z, s, foeId, level, onFinish, opts = {}) {
  const zone = ZONES[z];
  const stage = STAGES[s];
  const def = creature(foeId);
  const boss = stage.type === "boss";
  const signsToWin = C.SIGNS_TO_WIN[Math.min(s, C.SIGNS_TO_WIN.length - 1)];
  const foeMax = Math.round(SIGN_DAMAGE * signsToWin * rarityOf(def).hp);
  const heroMax = Math.round(playerMaxHp(progress.level()) * (progress.heroClass().hp || 1));
  // The letters this battle practices: the zone's, plus its words' after the first stage.
  const pool = [...new Set([...zone.letters, ...(s > 0 ? zone.words.join("") : "")])];
  const now = performance.now();

  A = {
    z, s, zone, stage, def, boss, level, onFinish, opts, pool,
    assist: Boolean(progress.get().settings.assist),
    start: now, last: now, acc: 0, slowUntil: 0, done: false,
    perSign: foeMax / signsToWin,
    hero: { x: 76, y: 112, hp: heroMax, max: heroMax, dashUntil: 0, dashReadyAt: 0, dashDir: [1, 0], hurtUntil: 0, flip: false, moving: false, shield: false },
    foe: {
      x: 250, y: 100, hp: foeMax, max: foeMax, hexed: def.catchable !== false, flashUntil: 0, moving: false, flip: true,
      scale: boss ? C.BOSS_SCALE : 1, attack: null, nextAttackAt: now + 1800, stunnedUntil: 0,
    },
    team: [],
    bolts: [],
    parts: [],
    lockUntil: 0,
    signed: 0,
    taps: 0,
    practice: new Set(),
    word: "",
    wordDone: 0,
    wordTimer: new HoldTimer(),
    wordHold: 0,
  };
  A.team = makeTeam();
  newWord();
  hud.buildCards(A.team, (i) => act(i, false));
  hud.clearPops();

  const el = ELEMENTS[def.element];
  const rarity = rarityOf(def);
  const sub = `${rarity.name !== "Common" ? `<span class="rarity-badge" style="--rarity:${rarity.color}">${rarity.name}</span>` : ""}` +
    `${el ? `<span class="el-badge el-${def.element}">${el.icon} ${el.name}</span>` : ""}Lv ${level}`;
  hud.setNames(progress.get().name || "You", def.name, sub);
  $("arena-title").textContent = `${zone.icon} ${zone.name} · ${stage.name}`;
  show("arena");
  playMusic(def.id === "malgrath" ? "final" : boss ? "boss" : "battle");
  announce(`A Hexbound ${def.name} appears! Sign the letter on a teammate's card to make them act. Spell the word for a team combo. Move with the arrow keys and dash with Shift.`);
  hud.banner(boss ? `BOSS: ${def.name}!` : "Break the hex!");
  requestAnimationFrame(frame);
}

// You, each buddy on your team (Pip and up to TEAM_SIZE in all), then your
// story allies.
function makeTeam() {
  const { look, equipped } = progress.get();
  const team = [{
    kind: "hero", name: "You", portrait: heroImg(look, equipped.hat, "arena-card-art"),
    moves: HERO_MOVES.map((mv) => ({ ...mv, type: "attack" })), element: null, power: progress.heroClass().power || 1,
  }];
  progress.team().forEach((pet, i) => {
    const evolved = isEvolved(pet.level);
    const def = creature(pet.id);
    team.push({
      kind: "buddy", id: pet.id, evolved, name: creatureName(pet.id, pet.level),
      portrait: creatureImg(pet.id, "arena-card-art", false, evolved),
      moves: def.moves, element: def.element, power: buddyMoveBoost(pet.level) * (evolved ? EVOLVED_POWER : 1),
      follow: C.FOLLOW[i % C.FOLLOW.length], x: A.hero.x - 20, y: A.hero.y + (i ? 14 : -14), flip: false, moving: false, strike: null,
    });
  });
  // Story allies: this zone's guide, and Rook once he's on your side.
  const allies = [];
  const guide = QUESTS[A.zone.id]?.guide;
  if (guide) allies.push({ ...QUESTS[A.zone.id].npcs[guide.npc], ...guide, wand: false });
  if (progress.storySeen(ROOK_JOINED_EVENT)) allies.push({ ...ROOK, ...ROOK_ALLY, name: "Rook", wand: true });
  for (const ally of allies) {
    const n = team.length - 1;
    team.push({
      kind: "ally", name: ally.name, look: ally.look, hat: ally.hat, wand: ally.wand,
      portrait: heroImg(ally.look, ally.hat, "arena-card-art", ally.wand),
      moves: ally.moves, element: ally.element, power: 1,
      follow: C.FOLLOW[n % C.FOLLOW.length], x: A.hero.x - 24, y: A.hero.y + (n % 2 ? 16 : -16), flip: false, moving: false, strike: null,
    });
  }
  team.forEach((m, i) => Object.assign(m, { moveIndex: 0, coolUntil: 0, coolMs: 1, hold: 0, timer: new HoldTimer(), sign: null }, { sign: pickSign(team, i) }));
  return team;
}

// A card's letter: one of the zone's, picked more often the more you've
// missed it, and not one another card (or the last one here) already shows.
function pickSign(team, i, old = null) {
  const taken = team.filter((m, j) => j !== i).map((m) => m.sign);
  const choices = A.pool.filter((l) => !taken.includes(l) && l !== old);
  return progress.weightedPick(choices.length ? choices : A.pool, old);
}

// The word to spell for a team combo: one of the zone's words you've learned
// all the letters of, or else a few of its letters.
function newWord() {
  const learned = progress.get().learned;
  const words = A.zone.words.filter((w) => [...w].every((l) => learned.includes(l) || A.pool.includes(l)) && w !== A.word);
  A.word = words.length ? words[Math.floor(Math.random() * words.length)] : [0, 1, 2].map(() => A.pool[Math.floor(Math.random() * A.pool.length)]).join("");
  A.wordDone = 0;
  A.wordTimer.reset();
}

const kindOf = (move) => (move.type === "attack" ? (move.power > C.BIG_POWER_FROM ? "big" : "quick") : move.type);
const nextMove = (m) => m.moves[m.moveIndex % m.moves.length];
const posOf = (m) => (m.kind === "hero" ? A.hero : m);

// ---------- Input ----------

const keys = new Set();
const stick = { x: 0, y: 0 };

addEventListener("keydown", (e) => {
  if (!A || !isShowing("arena") || e.target.closest?.("input, textarea, select")) return;
  keys.add(e.key);
  if (e.key === "Shift" || e.key === " ") {
    e.preventDefault();
    dash();
  }
  if (["1", "2", "3", "4"].includes(e.key)) act(Number(e.key) - 1, false);
  if (e.key.startsWith("Arrow")) e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.key));
addEventListener("blur", () => keys.clear());

// With ?dev, letter keys "sign" (classifier.js), so WASD can't also walk.
const KEY_MOVE = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], ...(DEV ? {} : { a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1], A: [-1, 0], D: [1, 0], W: [0, -1], S: [0, 1] }) };

function inputDir() {
  let x = stick.x, y = stick.y;
  for (const k of keys) if (KEY_MOVE[k]) (x += KEY_MOVE[k][0]), (y += KEY_MOVE[k][1]);
  const pad = navigator.getGamepads?.()[0];
  if (pad) {
    if (Math.abs(pad.axes[0]) > 0.25) x += pad.axes[0];
    if (Math.abs(pad.axes[1]) > 0.25) y += pad.axes[1];
    if (pad.buttons[0]?.pressed) dash();
  }
  const len = Math.hypot(x, y);
  return len > 1 ? [x / len, y / len] : [x, y];
}

// The on-screen stick (touch screens): drag from its middle.
function setUpStick() {
  const base = $("arena-stick");
  const knob = base.querySelector(".knob");
  let id = null;
  const move = (e) => {
    const r = base.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) (dx /= len), (dy /= len);
    stick.x = dx;
    stick.y = dy;
    knob.style.translate = `${dx * 35}% ${dy * 35}%`;
  };
  base.addEventListener("pointerdown", (e) => {
    id = e.pointerId;
    base.setPointerCapture(id);
    move(e);
  });
  base.addEventListener("pointermove", (e) => e.pointerId === id && move(e));
  const end = () => {
    id = null;
    stick.x = stick.y = 0;
    knob.style.translate = "0 0";
  };
  base.addEventListener("pointerup", end);
  base.addEventListener("pointercancel", end);
}
setUpStick();
$("arena-dash").onclick = () => dash();
$("arena-word").onclick = () => spellNext(false); // tapping the word is the no-sign fallback
$("arena-flee").onclick = () => {
  A = null;
  show("map");
};

function dash() {
  const now = performance.now();
  const h = A?.hero;
  if (!h || A.done || now < h.dashReadyAt) return;
  const [x, y] = inputDir();
  const dir = x || y ? [x, y] : [h.flip ? -1 : 1, 0];
  const len = Math.hypot(...dir);
  h.dashDir = [dir[0] / len, dir[1] / len];
  h.dashUntil = now + C.DASH_MS;
  h.dashReadyAt = now + C.DASH_COOLDOWN_MS;
}

// ---------- Signing ----------

function checkSigns(now) {
  const pred = getPrediction();
  hud.setSeeing(pred?.partial ? "✋ Whole hand in view" : pred ? `I see: ${pred.letter}` : "Show your hand ✋");
  if (now < A.lockUntil) return;
  // Everything this sign counts for (a card, the next letter of the word, or both).
  const ready = [];
  A.team.forEach((m, i) => {
    m.hold = now < m.coolUntil ? 0 : m.timer.update(m.sign, pred, now);
    if (m.hold >= 1) ready.push(i);
  });
  const next = A.word[A.wordDone];
  A.wordHold = next ? A.wordTimer.update(next, pred, now) : 0;
  const spelled = A.wordHold >= 1;
  if (!ready.length && !spelled) return;
  const confidence = (letter) => targetConfidence(letter, pred) || 0.8;
  if (ready.length) act(ready[0], true, confidence(A.team[ready[0]].sign));
  if (spelled) spellNext(true);
}

// Teammate i does its next move. `signed`: you signed it (or tapped the card).
function act(i, signed, confidence = 1) {
  const now = performance.now();
  const m = A?.team[i];
  if (!m || A.done || now < m.coolUntil || (signed && now < A.lockUntil)) return;
  lockSigns(now);
  const move = nextMove(m);
  const accuracy = signed ? C.ACCURACY_MIN + C.ACCURACY_RANGE * Math.min(1, confidence) : C.TAP_POWER;
  perform(m, move, accuracy, signed);
  const p = posOf(m);
  if (signed) {
    A.signed++;
    progress.addSuccess(m.sign);
    hud.pop(`✓ ${m.sign}`, p.x, p.y - 34, "info");
    announce(`${m.sign}! ${m.name}: ${move.name}!`);
  } else {
    A.taps++;
    A.practice.add(m.sign);
    progress.addMiss(m.sign);
  }
  const coolMs = C.MOVE_KINDS[kindOf(move)].cooldownMs * (A.assist ? C.ASSIST.cooldown : 1);
  m.coolUntil = now + coolMs;
  m.coolMs = coolMs;
  m.moveIndex++;
  m.sign = pickSign(A.team, i, m.sign);
  m.timer.reset();
}

// The next letter of the word. Spell it all for a TEAM COMBO.
function spellNext(signed) {
  const now = performance.now();
  if (!A || A.done || !A.word[A.wordDone]) return;
  const letter = A.word[A.wordDone];
  lockSigns(now);
  if (signed) {
    A.signed++;
    progress.addSuccess(letter);
  } else {
    A.taps++;
    A.practice.add(letter);
  }
  A.wordDone++;
  hud.pop(`${letter}!`, A.hero.x, A.hero.y - 40, "info");
  if (A.wordDone >= A.word.length) teamCombo(signed);
}

function lockSigns(now) {
  A.lockUntil = now + C.SIGN_LOCK_MS;
  for (const m of A.team) m.timer.reset();
  A.wordTimer.reset();
}

// ---------- Moves ----------

// `mult`: how well it was signed (or a tap, or a combo).
function perform(m, move, mult, signed = true) {
  const now = performance.now();
  const kind = kindOf(move);
  const p = posOf(m);
  const f = A.foe;
  const look = elementOf(move);
  if (kind === "quick" || kind === "big") {
    const element = move.element || m.element;
    const eff = effectiveness(element, A.def.element);
    const damage = A.perSign * C.MOVE_KINDS[kind].power * m.power * mult * eff;
    const hit = { damage, eff, look, big: kind === "big", signed };
    if (m.kind === "buddy" && isPhysical(move)) m.strike = { ...hit, back: false };
    else A.bolts.push({ x: p.x + (m.flip ? -6 : 6), y: p.y - 12, ...hit, speed: kind === "big" ? 190 : 230, size: kind === "big" ? 2 : 1, life: 2200 });
    burst(p.x, p.y - 12, look, kind === "big" ? 16 : 8, 1.2);
  } else if (kind === "shield") {
    A.hero.shield = true;
    burst(A.hero.x, A.hero.y - 12, "shield", 18, 1.2);
    hud.pop("🛡️ SHIELD!", A.hero.x, A.hero.y - 40, "info");
  } else if (kind === "heal") {
    const amount = Math.round(A.hero.max * HEAL_FRACTION * (signed ? 1 : C.TAP_POWER));
    A.hero.hp = Math.min(A.hero.max, A.hero.hp + amount);
    for (let k = 0; k < 16; k++) puff(A.hero.x + (Math.random() - 0.5) * 16, A.hero.y - Math.random() * 16, "heal", -30);
    hud.pop(`+${amount}`, A.hero.x, A.hero.y - 34, "heal");
  } else if (kind === "stun") {
    f.stunnedUntil = now + C.MOVE_KINDS.stun.stunMs * (signed ? 1 : C.TAP_POWER);
    f.attack = null; // knocked out of its wind-up
    burst(f.x, f.y - 16 * f.scale, look, 14, 1);
    hud.pop("💫 DIZZY!", f.x, f.y - 36 * f.scale, "info");
  }
}

// Everyone uses their strongest attack, one after another.
function teamCombo(signed) {
  hud.banner(`TEAM COMBO! ${A.word}`, "big");
  announce(`You spelled ${A.word}! Team combo!`);
  A.team.forEach((m, k) => {
    const strongest = m.moves.filter((mv) => mv.type === "attack").sort((a, b) => b.power - a.power)[0];
    setTimeout(() => A && !A.done && perform(m, { ...strongest, power: Math.max(strongest.power, C.BIG_POWER_FROM + 1) }, C.COMBO_POWER * (signed ? 1 : C.TAP_POWER)), 250 * k);
  });
  setTimeout(() => A && newWord(), 900);
}

function hitFoe({ damage, eff, look, big, signed }) {
  const f = A.foe;
  const now = performance.now();
  if (A.done) return;
  const amount = Math.max(1, Math.round(damage));
  f.hp = Math.max(0, f.hp - amount);
  f.flashUntil = now + 90;
  burst(f.x, f.y - 12 * f.scale, look, big ? 30 : 18, big ? 2.4 : 1.8);
  hud.pop(String(amount), f.x, f.y - 30 * f.scale, big ? "crit" : signed ? "dmg" : "weak");
  if (eff > 1) hud.pop("SUPER EFFECTIVE!", f.x, f.y - 46 * f.scale, "info");
  else if (eff < 1) hud.pop("not very effective", f.x, f.y - 46 * f.scale, "weak");
  shake(big ? 4 : 2, big ? 220 : 150);
  if (f.hp <= 0) finish(true);
}

// ---------- The creature ----------

function foeThink(now, dt) {
  const f = A.foe, h = A.hero;
  f.moving = false;
  if (now < f.stunnedUntil) return;
  if (f.attack) {
    // Winding up: stand still, then land the attack.
    if (now >= f.attack.lands) landAttack(f.attack, now);
    return;
  }
  // Keep a little distance and drift around the hero.
  const dx = h.x - f.x, dy = h.y - f.y;
  const dist = Math.hypot(dx, dy) || 1;
  const want = 70;
  if (Math.abs(dist - want) > 8) {
    const dir = dist > want ? 1 : -1;
    const speed = C.FOE_SPEED * (A.assist ? C.ASSIST.foeSpeed : 1) * dt;
    moveCircle(f, (dx / dist) * dir * speed, (dy / dist) * dir * speed, C.FOE_RADIUS * f.scale);
    f.moving = true;
  }
  f.flip = dx < 0;
  if (now >= f.nextAttackAt) {
    const kind = C.FOE_ATTACKS.slam;
    const windup = kind.windupMs * (A.assist ? C.ASSIST.windup : 1);
    f.attack = { kind, x: h.x, y: h.y, r: kind.radius * (A.boss ? 1.3 : 1), starts: now, lands: now + windup };
  }
}

function landAttack(attack, now) {
  const f = A.foe, h = A.hero;
  f.attack = null;
  const [lo, hi] = C.FOE_ATTACK_EVERY_MS;
  f.nextAttackAt = now + (lo + Math.random() * (hi - lo)) * (A.assist ? C.ASSIST.attackEvery : 1);
  burst(attack.x, attack.y, "danger", 18, 1.6);
  shake(3, 200);
  const inside = Math.hypot((h.x - attack.x) / attack.r, (h.y - attack.y) / (attack.r * 0.6)) < 1;
  if (!inside || now < h.dashUntil) {
    if (Math.hypot(h.x - attack.x, h.y - attack.y) < attack.r * 1.8) hud.pop("DODGED!", h.x, h.y - 30, "info");
    return;
  }
  if (h.shield) {
    h.shield = false;
    burst(h.x, h.y - 12, "shield", 24, 1.8);
    hud.pop("BLOCKED!", h.x, h.y - 30, "info");
    return;
  }
  const damage = Math.round(monsterDamage(A.level) * attack.kind.damage * (A.boss ? BOSS_EXTRA_DAMAGE : 1) * (A.assist ? C.ASSIST.damage : 1));
  h.hp = Math.max(0, h.hp - damage);
  h.hurtUntil = now + 300;
  hud.pop(`-${damage}`, h.x, h.y - 28, "hurt");
  announce(`${A.def.name} uses ${attack.kind.name}! You lose ${damage} HP.`);
  shake(5, 260);
  if (h.hp <= 0) finish(false);
}

// ---------- Movement and collision ----------

// Fixed obstacles: four bits of scenery around the middle.
const OBSTACLES = [[110, 66], [210, 66], [110, 150], [210, 150]];
const OBSTACLE_R = 6;

// Move a round thing, sliding along walls and obstacles instead of sticking.
function moveCircle(o, dx, dy, r) {
  o.x = Math.min(C.ARENA_W - C.EDGE - r, Math.max(C.EDGE + r, o.x + dx));
  o.y = Math.min(C.ARENA_H - C.EDGE, Math.max(C.WALL_TOP + r, o.y + dy));
  for (const [ox, oy] of OBSTACLES) {
    const ddx = o.x - ox, ddy = o.y - oy;
    const d = Math.hypot(ddx, ddy);
    const min = r + OBSTACLE_R;
    if (d < min && d > 0) {
      o.x = ox + (ddx / d) * min;
      o.y = oy + (ddy / d) * min;
    }
  }
}

// Move toward a point at `speed`; true once there.
function walkTo(o, tx, ty, speed, dt, r) {
  const dx = tx - o.x, dy = ty - o.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return true;
  const stepLen = Math.min(d, speed * dt);
  moveCircle(o, (dx / d) * stepLen, (dy / d) * stepLen, r);
  if (Math.abs(dx) > 0.5) o.flip = dx < 0;
  return false;
}

function step(dt, now) {
  const h = A.hero, f = A.foe;
  if (!A.done) {
    const dashing = now < h.dashUntil;
    const [x, y] = dashing ? h.dashDir : inputDir();
    const speed = dashing ? C.DASH_SPEED : C.PLAYER_SPEED;
    h.moving = Boolean(x || y);
    if (x) h.flip = x < 0;
    moveCircle(h, x * speed * dt, y * speed * dt, C.PLAYER_RADIUS);
    if (dashing && Math.random() < 0.7) puff(h.x, h.y, "dust");
    foeThink(now, dt);
  }
  // Buddies follow you, or dash in for a physical move and come back.
  for (const m of A.team) {
    if (m.kind === "hero") continue;
    const s = m.strike;
    const homeX = h.x + m.follow[0] * (h.flip ? -1 : 1), homeY = h.y + m.follow[1];
    if (s && !s.back) {
      m.moving = true;
      if (walkTo(m, f.x - (f.x > m.x ? 12 : -12), f.y, C.DASH_STRIKE_SPEED, dt, 5)) {
        s.back = true;
        hitFoe(s);
      }
      if (Math.random() < 0.6) puff(m.x, m.y, "dust");
    } else {
      const there = walkTo(m, homeX, homeY, s ? C.DASH_STRIKE_SPEED : C.FOLLOW_SPEED, dt, 5);
      m.moving = !there;
      if (there && s) m.strike = null;
    }
  }
  // Bolts home in on the creature.
  for (const b of A.bolts) {
    const tx = f.x, ty = f.y - 12 * f.scale;
    const dx = tx - b.x, dy = ty - b.y;
    const d = Math.hypot(dx, dy) || 1;
    b.x += (dx / d) * b.speed * dt;
    b.y += (dy / d) * b.speed * dt;
    b.life -= dt * 1000;
    if (Math.random() < 0.8) puff(b.x, b.y, b.look);
    if (d < C.FOE_RADIUS * f.scale + 3) {
      b.life = 0;
      hitFoe(b);
    }
  }
  A.bolts = A.bolts.filter((b) => b.life > 0);
  for (const p of A.parts) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy = p.vy * 0.92 + (p.gravity || 0) * dt;
    p.age += dt * 1000;
  }
  A.parts = A.parts.filter((p) => p.age < p.life);
}

// ---------- Particles ----------

const colorsOf = (element) => C.ELEMENT_COLORS[element] || C.ELEMENT_COLORS.impact;

function burst(x, y, element, count, speed) {
  const colors = colorsOf(element);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU, v = (20 + Math.random() * 60) * speed;
    A.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, age: 0, life: 300 + Math.random() * 400, color: colors[Math.floor(Math.random() * colors.length)], size: 1 + Math.floor(Math.random() * 2) });
  }
}

function puff(x, y, element, rise = -8) {
  const colors = colorsOf(element);
  A.parts.push({ x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 3, vx: (Math.random() - 0.5) * 12, vy: rise - Math.random() * 10, age: 0, life: 260 + Math.random() * 300, color: colors[Math.floor(Math.random() * colors.length)], size: 1 + Math.floor(Math.random() * 2) });
}

function shake(px, ms) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const frames = [0, 1, 2, 3, 4].map((i) => ({ translate: `${(Math.random() - 0.5) * 2 * px * (1 - i / 5)}px ${(Math.random() - 0.5) * px * (1 - i / 5)}px` }));
  $("arena-stage").animate([...frames, { translate: "0 0" }], { duration: ms });
}

// ---------- Drawing ----------

const grounds = new Map();

// The zone's ground with court lines, and its wall of scenery along the back.
function groundFor(zoneId) {
  if (grounds.has(zoneId)) return grounds.get(zoneId);
  const theme = zoneTheme(zoneId);
  const seed = [...zoneId].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const small = document.createElement("canvas");
  small.width = C.ARENA_W;
  small.height = C.ARENA_H;
  const g = small.getContext("2d");
  const image = g.createImageData(C.ARENA_W, C.ARENA_H);
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let y = 0; y < C.ARENA_H; y++) {
    for (let x = 0; x < C.ARENA_W; x++) {
      let c = theme.ground[noise(x, y, 16, seed) > 0.56 ? 1 : 0];
      if (hash(x, y, seed + 1) < theme.speckRate) c = theme.specks[Math.floor(hash(x, y, seed + 2) * theme.specks.length)];
      image.data.set([...rgb(c), 255], (y * C.ARENA_W + x) * 4);
    }
  }
  g.putImageData(image, 0, 0);
  // Court lines, faint like chalk.
  g.strokeStyle = theme.path[0];
  g.globalAlpha = 0.55;
  g.lineWidth = 1;
  const top = C.WALL_TOP + 4, left = C.EDGE + 6, right = C.ARENA_W - C.EDGE - 6, bottom = C.ARENA_H - C.EDGE - 2;
  g.strokeRect(left + 0.5, top + 0.5, right - left, bottom - top);
  g.beginPath();
  g.moveTo(C.ARENA_W / 2 + 0.5, top);
  g.lineTo(C.ARENA_W / 2 + 0.5, bottom);
  g.stroke();
  g.beginPath();
  g.arc(C.ARENA_W / 2 + 0.5, (top + bottom) / 2, 20, 0, TAU);
  g.stroke();
  g.globalAlpha = 1;

  const canvas = document.createElement("canvas");
  canvas.width = C.ARENA_W * SPRITE_SCALE;
  canvas.height = C.ARENA_H * SPRITE_SCALE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
  ctx.setTransform(SPRITE_SCALE, 0, 0, SPRITE_SCALE, 0, 0);
  // A neat row of the zone's wall scenery along the back.
  const wall = spriteCanvas(decorSrc(theme.wall));
  const ww = wall.width / SPRITE_SCALE, wh = wall.height / SPRITE_SCALE;
  for (let x = 0; x < C.ARENA_W + ww; x += ww - 1) ctx.drawImage(wall, x - ww / 2, C.WALL_TOP - wh + 2, ww, wh);
  const out = { canvas, obstacle: spriteCanvas(decorSrc(theme.obstacles[0])) };
  grounds.set(zoneId, out);
  return out;
}

function drawSprite(ctx, img, x, y, scale = 1, flip = false, flash = false) {
  const w = (img.width / SPRITE_SCALE) * scale, h = (img.height / SPRITE_SCALE) * scale;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y - h));
  if (flip) ctx.scale(-1, 1); // mirrored around its middle
  if (flash) ctx.filter = "brightness(2.6)";
  ctx.drawImage(img, -w / 2, 0, w, h);
  ctx.restore();
}

function shadow(ctx, x, y, w) {
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(x, y - 1, w, w * 0.35, 0, 0, TAU);
  ctx.fill();
}

// The warning for an attack: a striped ring where it will land, filling up
// as it gets closer. Stripes and a dashed edge (not just red), so it's clear
// to everyone, and it doesn't flash.
function drawRing(ctx, a, now) {
  const t = Math.min(1, (now - a.starts) / (a.lands - a.starts));
  const rx = a.r, ry = a.r * 0.6;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(a.x, a.y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = "rgba(232, 65, 59, 0.16)";
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1.5;
  for (let k = -rx * 2; k < rx * 2; k += 6) {
    ctx.beginPath();
    ctx.moveTo(a.x + k - ry, a.y - ry);
    ctx.lineTo(a.x + k + ry, a.y + ry);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(a.x, a.y, rx * t, ry * t, 0, 0, TAU);
  ctx.fillStyle = "rgba(232, 65, 59, 0.35)";
  ctx.fill();
  ctx.restore();
  ctx.setLineDash([3, 2]);
  ctx.strokeStyle = "#ff5a4e";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(a.x, a.y, rx, ry, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Little stars circling a dizzy creature's head.
function drawDizzy(ctx, x, y, now) {
  for (let k = 0; k < 3; k++) {
    const a = now / 300 + (k * TAU) / 3;
    ctx.fillStyle = k % 2 ? "#ffffff" : "#ffe066";
    ctx.fillRect(Math.round(x + Math.cos(a) * 9), Math.round(y + Math.sin(a) * 3), 2, 2);
  }
}

function draw(now) {
  const canvas = $("arena-canvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const ground = groundFor(A.zone.id);
  ctx.drawImage(ground.canvas, 0, 0);
  ctx.setTransform(SPRITE_SCALE, 0, 0, SPRITE_SCALE, 0, 0);

  const f = A.foe, h = A.hero;
  if (f.attack) drawRing(ctx, f.attack, now);

  // Everything standing up, sorted by where its feet are.
  const things = OBSTACLES.map(([x, y]) => ({ y, draw: () => drawSprite(ctx, ground.obstacle, x, y + 2) }));
  const { look, equipped } = progress.get();
  things.push({
    y: h.y,
    draw: () => {
      shadow(ctx, h.x, h.y, 6);
      const blink = now < h.hurtUntil && Math.floor(now / 100) % 2; // under 3 flashes a second
      const frame = h.moving ? Math.floor(now / 110) % WALK_FRAMES : 0;
      if (!blink) drawSprite(ctx, spriteCanvas(heroSrc(look, equipped.hat, frame)), h.x, h.y, 1, h.flip, now < h.hurtUntil);
      if (h.shield) {
        ctx.strokeStyle = `rgba(127, 184, 255, ${0.6 + 0.2 * Math.sin(now / 250)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(h.x, h.y - 14, 13, 17, 0, 0, TAU);
        ctx.stroke();
      }
    },
  });
  for (const m of A.team) {
    if (m.kind === "hero") continue;
    things.push({
      y: m.y,
      draw: () => {
        shadow(ctx, m.x, m.y, 6);
        const frame = m.moving ? Math.floor(now / 120) % WALK_FRAMES : 0;
        const img = m.kind === "ally" ? heroSrc(m.look, m.hat, frame, m.wand) : creatureSrc(m.id, false, frame, m.evolved);
        drawSprite(ctx, spriteCanvas(img), m.x, m.y, m.kind === "ally" ? 1 : 0.8, m.flip);
      },
    });
  }
  things.push({
    y: f.y,
    draw: () => {
      shadow(ctx, f.x, f.y, 9 * f.scale);
      if (f.attack) {
        // Charging up: a slow glow around it.
        ctx.fillStyle = `rgba(232, 65, 59, ${0.35 + 0.25 * Math.sin(now / 160)})`;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y - 1, 12 * f.scale, 4 * f.scale, 0, 0, TAU);
        ctx.fill();
      }
      const frame = f.moving ? Math.floor(now / 160) % WALK_FRAMES : 0;
      drawSprite(ctx, spriteCanvas(creatureSrc(A.def.id, f.hexed, frame)), f.x, f.y, f.scale, f.flip, now < f.flashUntil);
      if (now < f.stunnedUntil) drawDizzy(ctx, f.x, f.y - 26 * f.scale, now);
    },
  });
  things.sort((a, b) => a.y - b.y);
  for (const t of things) t.draw();

  for (const b of A.bolts) {
    const colors = colorsOf(b.look);
    const s = 3 * b.size;
    ctx.fillStyle = colors[3];
    ctx.fillRect(Math.round(b.x) - s, Math.round(b.y) - s, s * 2, s * 2);
    ctx.fillStyle = colors[1];
    ctx.fillRect(Math.round(b.x) - s + 1, Math.round(b.y) - s + 1, s * 2 - 2, s * 2 - 2);
    ctx.fillStyle = colors[0];
    ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2);
  }
  for (const p of A.parts) {
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ---------- The loop ----------

function frame() {
  if (!A || !isShowing("arena")) {
    A = null;
    return;
  }
  requestAnimationFrame(frame);
  // One clock for everything (the frame's own timestamp can be a little
  // behind performance.now(), which the battle's start time came from).
  const now = performance.now();
  const scale = now < A.slowUntil ? 0.3 : 1; // slow motion on the final hit
  A.acc += Math.max(0, Math.min(100, now - A.last)) * scale;
  A.last = now;
  while (A.acc >= STEP * 1000) {
    step(STEP, now);
    A.acc -= STEP * 1000;
  }
  if (!A.done) checkSigns(now);
  draw(now);
  hud.setHp("you", A.hero.hp, A.hero.max);
  hud.setHp("foe", A.foe.hp, A.foe.max);
  hud.setBadges("you", A.hero.shield ? ["🛡️ SHIELD"] : []);
  hud.setBadges("foe", now < A.foe.stunnedUntil ? ["💫 DIZZY"] : []);
  hud.renderCards(A.team.map((m) => ({ ...m, move: nextMove(m) })), now);
  hud.renderWord(A.word, A.wordDone, A.wordHold);
  hud.setDash(now >= A.hero.dashReadyAt);
  if (!A.done) hud.setTimer(now - A.start);
}

// ---------- Winning and losing ----------

function finish(won) {
  if (A.done) return;
  const b = A;
  b.done = true;
  const now = performance.now();
  const f = b.foe;
  f.attack = null;
  if (won) {
    b.slowUntil = now + 700;
    if (b.def.catchable === false) {
      hud.banner("SEALED AWAY!", "big");
    } else {
      hud.banner("HEX BROKEN!", "big");
      setTimeout(() => {
        f.hexed = false;
        burst(f.x, f.y - 12 * f.scale, "hex", 50, 2.4);
        burst(f.x, f.y - 12 * f.scale, "light", 30, 1.4);
        announce(`The hex is broken! ${b.def.name} is free.`);
      }, 500);
    }
  } else {
    hud.banner("Knocked out!", "sad");
    announce("You're knocked out. Keep practicing, you'll get it!");
  }
  playMusic(won ? "victory" : "defeat");
  const signs = b.signed + b.taps;
  const result = battleResult({
    z: b.z, s: b.s, zone: b.zone, won, boss: b.boss, opts: b.opts, party: false,
    signs, hints: b.taps, avgSeconds: (now - b.start) / 1000 / Math.max(1, signs),
    foe: b.def, level: b.level, practice: [...b.practice],
    freeId: won && b.def.catchable !== false ? b.def.id : null,
  });
  setTimeout(() => {
    if (A === b) A = null;
    b.onFinish(result);
  }, won ? 2200 : 1600);
}
