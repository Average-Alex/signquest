// Arena battle tuning. All data: change numbers here, no other code needed.
//
// How a battle works: you, Pip, and your buddies (your team, like the old
// turn-based battles) move around a top-down arena in real time against a
// Hexbound creature. You lead the team with SIGNS:
//   - Each teammate has a card with a letter. Sign it and that teammate acts:
//     its next move (attack, shield, heal, stun, or a big attack), taken in
//     turn from its own moves. The card then cools down and gets a new letter
//     from the zone (more often the ones you miss).
//   - A word from the zone is shown too. Fingerspell it, letter by letter,
//     for a TEAM COMBO: everyone uses their big move at once.
// Tapping a card also works (for when signing isn't possible right now), but
// weaker, so signing stays the goal. The creature's attacks warn you first (a
// striped ring on the ground), so you can dash out of the way. Teammates
// can't be hurt; only your HP counts.

// ---------- The arena ----------
export const ARENA_W = 320; // game pixels
export const ARENA_H = 180;
export const WALL_TOP = 30; // nobody walks above this (the back wall)
export const EDGE = 10; // or closer than this to the sides and bottom

// ---------- You and your team ----------
export const PLAYER_SPEED = 82; // game pixels per second
export const PLAYER_RADIUS = 6;
export const DASH_SPEED = 230;
export const DASH_MS = 170; // you can't be hit while dashing
export const DASH_COOLDOWN_MS = 1100;
// Where buddies walk, relative to you (behind you and to the sides).
export const FOLLOW = [[-20, -14], [-20, 14], [-36, 0], [-6, -24]];
export const FOLLOW_SPEED = 95;

// ---------- Signing ----------
export const SIGN_LOCK_MS = 400; // after one sign counts, a pause before the next (so one sign can't count twice)
export const TAP_POWER = 0.6; // tapping a card instead of signing it
// A clean sign (the recognizer is sure) hits a bit harder than a shaky one:
// x (ACCURACY_MIN + ACCURACY_RANGE x confidence).
export const ACCURACY_MIN = 0.85;
export const ACCURACY_RANGE = 0.3;
// How many good signs it takes to break a hex, by stage (0 letters, 1 words, 2 boss).
export const SIGNS_TO_WIN = [8, 12, 18];

// ---------- Moves ----------
// Moves come from the creatures (config.js CREATURES) and HERO_MOVES. Here's
// how each kind plays in the arena. `power`: damage, in "good signs".
export const MOVE_KINDS = {
  quick: { cooldownMs: 2200, power: 1 }, // an attack with power <= 2
  big: { cooldownMs: 4600, power: 2.2 }, // an attack with more power
  shield: { cooldownMs: 4200 }, // a bubble on you that blocks the next hit
  heal: { cooldownMs: 5200 }, // heals you (HEAL_FRACTION of your HP)
  stun: { cooldownMs: 4600, stunMs: 2600 }, // the creature is dizzy: no attacks
};
export const BIG_POWER_FROM = 2; // attacks with more power than this are "big"
export const COMBO_POWER = 1.4; // each teammate's hit in a TEAM COMBO, x their big move
export const DASH_STRIKE_SPEED = 260; // physical moves: the teammate dashes in and back

// ---------- Creatures ----------
export const FOE_SPEED = 34;
export const FOE_RADIUS = 9;
export const BOSS_SCALE = 1.6;
// A creature's attacks. Each one warns first, for `windupMs`, then lands.
// telegraph "ring": a striped circle on the ground where it will hit.
export const FOE_ATTACKS = {
  slam: { name: "Slam", telegraph: "ring", radius: 20, windupMs: 1000, damage: 1 },
};
export const FOE_ATTACK_EVERY_MS = [1900, 2900]; // time between attacks (random in this range)

// ---------- Assist mode (Settings) ----------
// Slower creatures, longer warnings, shorter cooldowns, gentler hits.
export const ASSIST = { foeSpeed: 0.6, windup: 1.7, cooldown: 0.7, damage: 0.6, attackEvery: 1.5 };

// ---------- Particle colors, by element ----------
export const ELEMENT_COLORS = {
  light: ["#ffffff", "#fff6c8", "#ffe066", "#ffc93c"],
  fire: ["#fff27a", "#ffc93c", "#ff8a2a", "#e8413b"],
  water: ["#ffffff", "#bfe8ff", "#7fd0ff", "#3a95d4"],
  ice: ["#ffffff", "#e8f7ff", "#bfe8ff", "#7fc8f0"],
  lightning: ["#ffffff", "#fff6a8", "#ffe066", "#7fe3ff"],
  nature: ["#f2ffc8", "#b8f07a", "#6cc24a", "#3f9a4a"],
  rock: ["#f2e6d0", "#d4c4a8", "#a89a8a", "#7a6e64"],
  dark: ["#f0d0ff", "#c58cf0", "#9b30d9", "#5a2fa0"],
  impact: ["#ffffff", "#fff6c8", "#ffc93c", "#ff8a2a"],
  heal: ["#ffffff", "#d9ffc8", "#8ee05a", "#3fc93a"],
  shield: ["#ffffff", "#cfe8ff", "#7fb8ff", "#3a7fd6"],
  hex: ["#f0d0ff", "#c040ff", "#8a1fd0", "#3a1f5e"],
  dust: ["#e8dcc0", "#cbbd9c", "#a89a7a"],
  danger: ["#ffffff", "#ffd0d0", "#ff6b5e", "#e8413b"],
};
