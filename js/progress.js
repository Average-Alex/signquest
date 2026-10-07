// Player progress: XP, coins, stars, learned letters, miss counts, closet,
// settings. Saved in localStorage - no accounts, nothing leaves the device.

import {
  BIOME_AREAS, BUDDY_MAX_LEVEL, buddyXpToLevel, DEFAULT_SETTINGS, STAGES, STARTER_CREATURE, STARTING_CONSUMABLES, TEAM_SIZE, ZONES,
} from "./config.js";
import { normalizeLook } from "./sprites.js";

const KEY = "signquest.v1";

function defaults() {
  return {
    name: "",
    look: normalizeLook(null), // hero maker choices, see sprites.js LOOK_OPTIONS
    xp: 0,
    coins: 0,
    stars: {}, // stageId -> best stars (1-3)
    learned: [], // letters whose learn card has been completed
    misses: {}, // letter -> miss weight, drives review mode
    owned: [], // hats
    equipped: { hat: null },
    consumables: { ...STARTING_CONSUMABLES }, // potion id -> how many
    creatures: { [STARTER_CREATURE]: { level: 1, xp: 0 } }, // every creature you've freed: id -> level/xp
    team: [STARTER_CREATURE], // up to TEAM_SIZE buddies that fight beside you
    seen: [STARTER_CREATURE], // creatures met, for the creature book
    storySeen: [], // story scenes already shown (story.js)
    trails: {}, // zone id -> { gates: gates opened, wins: [creatures beaten per area] }
    settings: { ...DEFAULT_SETTINGS },
  };
}

// Older saves bought pets in the shop. They become creatures on your team.
// (Declared before load() runs below.)
const OLD_PETS = { "pet-cat": "cat", "pet-dog": "pup", "pet-bunny": "bunny", "pet-unicorn": "unicorn", "pet-dragon": "drake" };

let state = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) {
      const base = defaults();
      const { character, ...rest } = saved; // older saves picked a fixed hero
      const loaded = {
        ...base,
        ...rest,
        look: normalizeLook(saved.look, character),
        equipped: { ...base.equipped, ...saved.equipped },
        consumables: saved.consumables || base.consumables,
        settings: { ...base.settings, ...saved.settings },
      };
      if (!saved.creatures) migratePets(loaded);
      migrateToTeam(loaded, saved);
      return loaded;
    }
  } catch (err) {
    // Storage blocked or corrupt: start fresh rather than break the game.
    console.error("Couldn't load saved progress, starting fresh:", err);
  }
  return defaults();
}

function migratePets(s) {
  for (const [petId, creatureId] of Object.entries(OLD_PETS)) {
    if (s.owned.includes(petId)) {
      s.creatures[creatureId] = { level: 1, xp: 0 };
      s.seen.push(creatureId);
    }
  }
  s.buddy = OLD_PETS[s.equipped.pet] || STARTER_CREATURE;
  s.owned = s.owned.filter((id) => !OLD_PETS[id]);
  delete s.equipped.pet;
}

// Older saves had one buddy and no Pip. Everyone gets Pip, and the old buddy
// stays on the team beside it.
function migrateToTeam(s, saved) {
  s.creatures[STARTER_CREATURE] ||= { level: 1, xp: 0 };
  if (!s.seen.includes(STARTER_CREATURE)) s.seen.unshift(STARTER_CREATURE);
  if (!Array.isArray(saved.team)) {
    s.team = [STARTER_CREATURE];
    if (s.buddy && s.buddy !== STARTER_CREATURE && s.creatures[s.buddy]) s.team.push(s.buddy);
  }
  s.team = s.team.filter((id) => s.creatures[id]).slice(0, TEAM_SIZE);
  delete s.buddy;
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

// ---------- Creatures ----------

export const hasCreature = (id) => Boolean(state.creatures[id]);
// Your buddies, as [{ id, level, xp }].
export const team = () => state.team.filter((id) => state.creatures[id]).map((id) => ({ id, ...state.creatures[id] }));
export const onTeam = (id) => state.team.includes(id);

export function markSeen(id) {
  if (!state.seen.includes(id)) {
    state.seen.push(id);
    save();
  }
}

// Returns true if it's new to your team.
export function catchCreature(id) {
  markSeen(id);
  if (hasCreature(id)) return false;
  state.creatures[id] = { level: 1, xp: 0 };
  save();
  return true;
}

export function buyCreature(creature) {
  if (hasCreature(creature.id) || state.coins < creature.price) return false;
  state.coins -= creature.price;
  return catchCreature(creature.id);
}

// Add a creature to your team. If the team is full, the one that's been on it
// longest steps out. Returns the id that left, if any.
export function addToTeam(id) {
  if (!hasCreature(id) || onTeam(id)) return null;
  state.team.push(id);
  const left = state.team.length > TEAM_SIZE ? state.team.shift() : null;
  save();
  return left;
}

// You always keep at least one buddy.
export function removeFromTeam(id) {
  if (state.team.length <= 1) return;
  state.team = state.team.filter((x) => x !== id);
  save();
}

// Gives each buddy XP. Returns the ids of buddies that leveled up.
export function addTeamXp(amount) {
  const leveled = [];
  for (const id of state.team) {
    const pet = state.creatures[id];
    if (!pet || pet.level >= BUDDY_MAX_LEVEL) continue;
    pet.xp += amount;
    let up = false;
    while (pet.level < BUDDY_MAX_LEVEL && pet.xp >= buddyXpToLevel(pet.level)) {
      pet.xp -= buddyXpToLevel(pet.level);
      pet.level++;
      up = true;
    }
    if (pet.level >= BUDDY_MAX_LEVEL) pet.xp = 0;
    if (up) leveled.push(id);
  }
  save();
  return leveled;
}

// ---------- Story ----------

export const storySeen = (id) => state.storySeen.includes(id);
export function markStorySeen(id) {
  if (!storySeen(id)) {
    state.storySeen.push(id);
    save();
  }
}
export const shardCount = () => ZONES.filter((_, z) => bossBeaten(z)).length;

// ---------- Exploring a zone: gates and wins per area ----------

export const bossBeaten = (zoneIndex) => stageStars(zoneIndex, STAGES.length - 1) > 0;

export function trail(zoneIndex) {
  const id = ZONES[zoneIndex].id;
  if (!state.trails[id]) {
    // Beat the boss before zones had gates (older saves)? Then the gates are open.
    state.trails[id] = { gates: bossBeaten(zoneIndex) ? BIOME_AREAS - 1 : 0, wins: Array(BIOME_AREAS).fill(0), chests: [] };
  }
  const t = state.trails[id];
  t.chests ||= [];
  while (t.wins.length < BIOME_AREAS) t.wins.push(0);
  return t;
}

export function openChest(zoneIndex, chestId) {
  const t = trail(zoneIndex);
  if (!t.chests.includes(chestId)) t.chests.push(chestId);
  save();
}

export function addCoins(n) {
  state.coins += n;
  save();
}

export function addAreaWin(zoneIndex, area) {
  const t = trail(zoneIndex);
  t.wins[area] = (t.wins[area] || 0) + 1;
  save();
}

export function openGate(zoneIndex, gate) {
  const t = trail(zoneIndex);
  t.gates = Math.max(t.gates, gate + 1);
  save();
}

// ---------- Potions and power-ups ----------

export const consumableCount = (id) => state.consumables[id] || 0;

export function buyConsumable(item) {
  if (state.coins < item.price) return false;
  state.coins -= item.price;
  addConsumable(item.id);
  return true;
}

export function addConsumable(id) {
  state.consumables[id] = consumableCount(id) + 1;
  save();
}

export function useConsumable(id) {
  if (!consumableCount(id)) return false;
  state.consumables[id]--;
  save();
  return true;
}

export function equip(item) {
  if (!state.owned.includes(item.id)) return;
  state.equipped[item.kind] = state.equipped[item.kind] === item.id ? null : item.id;
  save();
}
