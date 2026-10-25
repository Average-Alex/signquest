// What a battle earns you, for both kinds of battle (the arena in arena/,
// and the turn-based trainer battles in game.js): stars, XP, coins, loot,
// freeing the creature, buddy XP and evolutions, and saving the stage.

import { ARMOR, BUDDY_MAX_LEVEL, BUDDY_XP_LOSS, BUDDY_XP_WIN, buddyXpToLevel, CONSUMABLES, CREATURES, creatureName, ELEMENT_MOVES, LOOT_CHANCE, rarityOf, stageOf, ZONES } from "./config.js";
import * as progress from "./progress.js";

const creature = (id) => CREATURES.find((c) => c.id === id);

function rollLoot(boss) {
  if (!boss && Math.random() >= LOOT_CHANCE) return null;
  const table = ["potion", "potion", "potion", "potion", "potion", "shield", "shield", "power", "power", "bigpotion"];
  const id = table[Math.floor(Math.random() * table.length)];
  progress.addConsumable(id);
  return CONSUMABLES.find((c) => c.id === id);
}

// `signs`: how many signs you made. `hints`: how many hints you needed.
// `avgSeconds`: average time per sign. `foe`: the (first) creature's
// definition, at `level`. `freeId`: the creature to free on a win (null for
// trainers and Malgrath). `party`: a trainer or rival battle.
export function battleResult({ z, s, zone, won, signs, hints, avgSeconds, boss, foe, level, freeId, party, practice, opts }) {
  // Where you and your buddies were before, for the results screen's XP bars.
  const heroBefore = { level: progress.level(), pct: progress.xpIntoLevel() };
  const petsBefore = progress.team().map((pet) => ({ id: pet.id, level: pet.level, pct: xpPct(pet.id) }));
  const armorWon = null; // (armor is bought with 🔷 Crests from Trials now)
  let result;
  if (won) {
    // Stars: 3 for a fast, hint-free battle. Hints and slow signing each cost one.
    let stars = 3;
    if (hints > 0) stars--;
    if (hints >= 3) stars--;
    if (avgSeconds > 6) stars--;
    stars = Math.max(1, stars);
    const bonus = party ? 1 : rarityOf(foe).reward; // rarer creatures pay more
    result = {
      won: true,
      stars,
      xp: Math.round(signs * 10 * bonus),
      coins: Math.round((stars * 5 + (boss ? 15 : 0)) * bonus) + (opts.prize || 0),
      prize: opts.prize || 0,
      practice,
      boss,
      loot: rollLoot(boss),
      caught: freeId && progress.catchCreature(freeId) ? creature(freeId) : null,
    };
  } else {
    // Every sign still counts as practice.
    result = { won: false, stars: 0, xp: signs * 5, coins: 0, practice, boss, loot: null, caught: null };
  }
  result.foe = foe;
  result.level = level;
  result.opts = opts;
  result.zone = zone;
  // Level-ups, and buddies that just reached their evolution level.
  const before = Object.fromEntries(progress.team().map((pet) => [pet.id, pet.level]));
  const leveled = progress.addTeamXp(won ? BUDDY_XP_WIN : BUDDY_XP_LOSS);
  const levelOf = (id) => progress.get().creatures[id].level;
  result.buddyLevels = leveled.map((id) => ({ ...creature(id), name: creatureName(id, levelOf(id)), level: levelOf(id) }));
  // Evolutions: a buddy that just reached its next stage, and the move it learned.
  result.evolved = leveled
    .filter((id) => stageOf(levelOf(id)) > stageOf(before[id]))
    .map((id) => {
      const fromStage = stageOf(before[id]), toStage = stageOf(levelOf(id));
      const move = (ELEMENT_MOVES[creature(id).element] || [])[toStage - 2];
      return { id, fromStage, toStage, from: creatureName(id, before[id]), to: creatureName(id, levelOf(id)), move };
    });
  progress.recordStage(z, s, result);
  result.armor = armorWon && progress.ownsArmor(armorWon.id) ? armorWon : null;
  // Everyone's portrait on the results screen: level and XP bar, before and after.
  result.portraits = [
    { hero: true, name: progress.get().name || "You", before: heroBefore, after: { level: progress.level(), pct: progress.xpIntoLevel() } },
    ...petsBefore.map((b) => ({ id: b.id, name: creatureName(b.id, levelOf(b.id)), stage: stageOf(levelOf(b.id)), before: b, after: { level: levelOf(b.id), pct: xpPct(b.id) } })),
  ];
  return result;
}

// How far a buddy is through its level, in %.
function xpPct(id) {
  const pet = progress.get().creatures[id];
  return pet.level >= BUDDY_MAX_LEVEL ? 100 : Math.round((pet.xp / buddyXpToLevel(pet.level)) * 100);
}
