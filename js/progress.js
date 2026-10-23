// Player progress: XP, coins, stars, learned letters, miss counts, closet,
// settings. Saved in localStorage - no accounts. (In the Battle Arena, your
// name, hero, and rank are shared with the players there; see arena.js.)

import {
  armorById, ARMOR, BIOME_AREAS, BUDDY_MAX_LEVEL, buddyXpToLevel, DEFAULT_CLASS, DEFAULT_SETTINGS, HERO_CLASSES, RENAMED_CREATURES, STAGES, STARTER_CREATURE, STARTING_CONSUMABLES,
  TEAM_SIZE, ZONES,
} from "./config.js";
import { normalizeLook } from "./sprites.js";

const KEY = "signquest.v1";

function defaults() {
  return {
    name: "",
    look: normalizeLook(null), // hero maker choices, see sprites.js LOOK_OPTIONS
    heroClass: DEFAULT_CLASS, // see HERO_CLASSES in config.js
    xp: 0,
    coins: 0,
    stars: {}, // stageId -> best stars (1-3)
    learned: [], // letters whose learn card has been completed
    misses: {}, // letter -> miss weight, drives review mode
    signed: {}, // letter -> times signed without help (the hand picture fades as this grows)
    owned: [], // hats
    equipped: { hat: null, armor: "tunic" }, // armor: see ARMOR in config.js
    consumables: { ...STARTING_CONSUMABLES }, // potion id -> how many
    creatures: { [STARTER_CREATURE]: { level: 1, xp: 0 } }, // every creature you've freed: id -> level/xp
    team: [STARTER_CREATURE], // up to TEAM_SIZE buddies that fight beside you
    seen: [STARTER_CREATURE], // creatures met, for the creature book
    storySeen: [], // story scenes already shown (story.js)
    trainers: [], // trainers beaten (trainers.js)
    trails: {}, // zone id -> { gates: gates opened, wins: [creatures beaten per area] }
    settings: { ...DEFAULT_SETTINGS },
    arenaId: null, // who you are to the Arena server (arena.js)
    rating: 1000, // your Arena rank points
  };
}

// Older saves bought pets in the shop. They become creatures on your team.
// (Declared before load() runs below.)
const OLD_PETS = { "pet-cat": "cat", "pet-dog": "thistlefox", "pet-bunny": "sproutling", "pet-unicorn": "drakeling", "pet-dragon": "drake" };

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
      // The old default (80%) was too strict for target-aware checking.
      if (!saved.settingsVersion && loaded.settings.minConfidence === 0.8) loaded.settings.minConfidence = DEFAULT_SETTINGS.minConfidence;
      // The old default hold (0.5 s) made signing feel sluggish.
      if ((saved.settingsVersion || 0) < 3 && loaded.settings.holdMs === 500) loaded.settings.holdMs = DEFAULT_SETTINGS.holdMs;
      loaded.settingsVersion = 3;
      if (!saved.creatures) migratePets(loaded);
      migrateRoster(loaded);
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

// Creatures replaced by the classic RPG roster (RENAMED_CREATURES in
// config.js): a freed one becomes its replacement, keeping the higher level.
function migrateRoster(s) {
  for (const [oldId, newId] of Object.entries(RENAMED_CREATURES)) {
    const had = s.creatures[oldId];
    if (had) {
      if (!s.creatures[newId] || s.creatures[newId].level < had.level) s.creatures[newId] = had;
      delete s.creatures[oldId];
    }
    s.team = s.team.map((id) => (id === oldId ? newId : id)).filter((id, i, all) => all.indexOf(id) === i);
    s.seen = s.seen.map((id) => (id === oldId ? newId : id)).filter((id, i, all) => all.indexOf(id) === i);
  }
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
// Your hero class (HERO_CLASSES in config.js), with its perks.
export const heroClass = () => HERO_CLASSES[state.heroClass] || HERO_CLASSES[DEFAULT_CLASS];
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

// Go anywhere in the Overworld, in any order. The portal to the Starfall
// Realm opens once you've collected all of the Overworld's shards; there the
// zones open one after another, leading up to Malgrath.
export function zoneUnlocked(zoneIndex) {
  const zone = ZONES[zoneIndex];
  if (zone.dimension === 0) return true;
  const first = ZONES.findIndex((zn) => zn.dimension === zone.dimension);
  if (zoneIndex > first) return bossBeaten(zoneIndex - 1);
  return ZONES.every((zn, z) => zn.dimension >= zone.dimension || zn.shard === false || bossBeaten(z));
}

// Any battle in an open zone, in any order (bosses included).
export const stageUnlocked = (zoneIndex) => zoneUnlocked(zoneIndex);

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
  state.signed ||= {};
  state.signed[letter] = (state.signed[letter] || 0) + 1;
  if (state.misses[letter]) state.misses[letter] = Math.max(0, state.misses[letter] - 0.5);
  save();
}

// How much of the hand picture to show for a letter: "full" while you're
// learning it, "faded" once you've signed it a few times, then "none". Misses
// bring it back.
export const GUIDE_FULL_UNTIL = 3;
export const GUIDE_FADED_UNTIL = 7;
export function guideFor(letter) {
  const known = (state.signed?.[letter] || 0) - (state.misses[letter] || 0) * 2;
  return known < GUIDE_FULL_UNTIL ? "full" : known < GUIDE_FADED_UNTIL ? "faded" : "none";
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
export const shardCount = () => ZONES.filter((zone, z) => zone.shard !== false && bossBeaten(z)).length;

// ---------- Exploring a zone: gates and wins per area ----------

export const bossBeaten = (zoneIndex) => stageStars(zoneIndex, STAGES.length - 1) > 0;
// Ids of the zones whose bosses you've beaten (each one teaches its own spell: HERO_SPELLS).
export const beatenZones = () => ZONES.filter((zone, z) => bossBeaten(z)).map((zone) => zone.id);

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

// One villager quest per area (quests.js). State: { accepted, count, have, done }.
export function questState(zoneIndex, area) {
  const t = trail(zoneIndex);
  t.quests ||= {};
  // Gates you opened before quests existed count as done.
  t.quests[area] ||= { accepted: area < t.gates, count: 0, have: false, done: area < t.gates };
  return t.quests[area];
}

export function updateQuest(zoneIndex, area, changes) {
  Object.assign(questState(zoneIndex, area), changes);
  save();
}

// 🏛️ Trials beaten in a zone (0 to 3; biome.js TRIALS).
export const trialTier = (zoneIndex) => trail(zoneIndex).trials || 0;
export function beatTrial(zoneIndex, tier) {
  const t = trail(zoneIndex);
  t.trials = Math.max(t.trials || 0, tier);
  save();
}

export function openChest(zoneIndex, chestId) {
  const t = trail(zoneIndex);
  if (!t.chests.includes(chestId)) t.chests.push(chestId);
  save();
}

// ---------- Trainers ----------

export const trainerBeaten = (id) => (state.trainers || []).includes(id);
export function beatTrainer(id) {
  state.trainers ||= [];
  if (!state.trainers.includes(id)) state.trainers.push(id);
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

// ---------- Armor ----------
// You win a zone's armor set by beating its boss (so older saves have theirs).
export function ownsArmor(id) {
  const armor = armorById(id);
  return !armor.zone || bossBeaten(ZONES.findIndex((zn) => zn.id === armor.zone));
}
export const ownedArmor = () => ARMOR.filter((a) => ownsArmor(a.id));
export const heroArmor = () => armorById(state.equipped.armor);
export function wearArmor(id) {
  if (!ownsArmor(id)) return;
  state.equipped.armor = id;
  save();
}
// Your hero's look, wearing your armor (sprites.js heroSrc).
export const heroLook = () => ({ ...state.look, armor: state.equipped.armor });
