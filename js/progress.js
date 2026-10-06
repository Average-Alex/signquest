// Player progress: XP, coins, stars, learned letters, miss counts, closet,
// settings. Saved in localStorage - no accounts, nothing leaves the device.

import { DEFAULT_SETTINGS, STAGES, ZONES } from "./config.js";

const KEY = "signquest.v1";

function defaults() {
  return {
    name: "",
    character: "🧙",
    xp: 0,
    coins: 0,
    stars: {}, // stageId -> best stars (1-3)
    learned: [], // letters whose learn card has been completed
    misses: {}, // letter -> miss weight, drives review mode
    owned: [],
    equipped: { hat: null, pet: null },
    settings: { ...DEFAULT_SETTINGS },
  };
}

let state = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) {
      const base = defaults();
      return {
        ...base,
        ...saved,
        equipped: { ...base.equipped, ...saved.equipped },
        settings: { ...base.settings, ...saved.settings },
      };
    }
  } catch {
    // Storage blocked or corrupt: start fresh rather than break the game.
  }
  return defaults();
}

export function get() {
  return state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode / storage full: the game still works, it just won't remember.
  }
}

export function update(changes) {
  Object.assign(state, changes);
  save();
}

export function updateSettings(changes) {
  Object.assign(state.settings, changes);
  save();
}

export function reset() {
  const settings = state.settings;
  state = defaults();
  state.settings = settings;
  save();
}

export const level = () => Math.floor(state.xp / 100) + 1;
export const xpIntoLevel = () => state.xp % 100;

export function stageId(zoneIndex, stageIndex) {
  return `${ZONES[zoneIndex].id}-${stageIndex}`;
}

export function stageStars(zoneIndex, stageIndex) {
  return state.stars[stageId(zoneIndex, stageIndex)] || 0;
}

export function zoneStars(zoneIndex) {
  return STAGES.reduce((sum, _, i) => sum + stageStars(zoneIndex, i), 0);
}

export function zoneUnlocked(zoneIndex) {
  return zoneIndex === 0 || stageStars(zoneIndex - 1, STAGES.length - 1) > 0;
}

export function stageUnlocked(zoneIndex, stageIndex) {
  if (!zoneUnlocked(zoneIndex)) return false;
  return stageIndex === 0 || stageStars(zoneIndex, stageIndex - 1) > 0;
}

export function recordStage(zoneIndex, stageIndex, { stars, xp, coins }) {
  const id = stageId(zoneIndex, stageIndex);
  state.stars[id] = Math.max(state.stars[id] || 0, stars);
  state.xp += xp;
  state.coins += coins;
  save();
}

export function markLearned(letter) {
  if (!state.learned.includes(letter)) {
    state.learned.push(letter);
    save();
  }
}

// Review mode: every miss makes a letter more likely to come up again, and
// every clean success makes it a little less likely, so practice drifts
// toward whatever this kid finds hard.
export function addMiss(letter) {
  state.misses[letter] = (state.misses[letter] || 0) + 1;
  save();
}

export function addSuccess(letter) {
  if (state.misses[letter]) {
    state.misses[letter] = Math.max(0, state.misses[letter] - 0.5);
    save();
  }
}

export function weightedPick(letters, avoid = null) {
  const pool = letters.length > 1 ? letters.filter((l) => l !== avoid) : letters;
  const weights = pool.map((l) => 1 + (state.misses[l] || 0));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function buy(item) {
  if (state.owned.includes(item.id) || state.coins < item.price) return false;
  state.coins -= item.price;
  state.owned.push(item.id);
  state.equipped[item.kind] = item.id;
  save();
  return true;
}

export function equip(item) {
  if (!state.owned.includes(item.id)) return;
  state.equipped[item.kind] = state.equipped[item.kind] === item.id ? null : item.id;
  save();
}
