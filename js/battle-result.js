// What a battle earns you, for both kinds of battle (the arena in arena/,
// and the turn-based trainer battles in game.js): stars, XP, coins, loot,
// freeing the creature, buddy XP and evolutions, and saving the stage.

import { BUDDY_XP_LOSS, BUDDY_XP_WIN, CONSUMABLES, CREATURES, creatureName, isEvolved, LOOT_CHANCE, rarityOf } from "./config.js";
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
  result.evolved = leveled.filter((id) => !isEvolved(before[id]) && isEvolved(levelOf(id))).map((id) => ({ id, from: creature(id).name, to: creatureName(id, levelOf(id)) }));
  progress.recordStage(z, s, result);
  return result;
}
