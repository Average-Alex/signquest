// Trainers: other young Signkeepers who stand by the path, Pokemon-style.
// Walk into one's line of sight and they spot you (❗), walk right up, and
// challenge you with a team of 2 or 3 creatures, one after another. Beat them
// for prize coins. Each trainer battles you once; after that they just chat.
//
// Areas 1-4 of every zone have one trainer (area 0 is for warming up, and the
// boss waits in the last area). Everything here is made from the zone's
// index, so the same trainers are always in the same places.

import { BIOME_AREAS, creatureLevel, CREATURES, TRAINER_PRIZE, ZONES } from "./config.js";
import { randomLook } from "./sprites.js";
import { hash } from "./worldmap.js";

// [title, name] per zone. The title says what kind of trainer they are.
const PEOPLE = {
  meadow: [["Picnicker", "Rosie"], ["Bug Catcher", "Tim"], ["Kite Flyer", "Mae"], ["Farmhand", "Jo"]],
  forest: [["Camper", "Leo"], ["Mushroom Fan", "Ivy"], ["Moth Catcher", "Ash"], ["Glow Scout", "Rey"]],
  caves: [["Hiker", "Gus"], ["Miner", "Dot"], ["Firefighter", "Opal"], ["Volcano Scout", "Kip"]],
  river: [["Surfer", "Kai"], ["Swimmer", "Nia"], ["Sailor", "Finn"], ["Diver", "Lu"]],
  castle: [["Ghost Hunter", "Ben"], ["Bard", "Lyra"], ["Student", "Theo"], ["Night Owl", "Ada"]],
  spires: [["Skater", "Ivo"], ["Aurora Watcher", "Wren"], ["Climber", "Pax"], ["Ice Mage", "Bea"]],
  clouds: [["Storm Chaser", "Zed"], ["Weather Witch", "Nell"], ["Glider", "Bo"], ["Mountaineer", "Ula"]],
  void: [["Star Gazer", "Orion"], ["Rift Walker", "Vex"], ["Astronaut", "Sol"], ["Comet Rider", "Juno"]],
  keep: [["Jester", "Lolo"], ["Knight", "Gwen"], ["Royal Archer", "Tamsin"], ["Duke", "Reginald"]],
};

const BEFORE = [
  "Hey! You're the new Signkeeper, right? Let's see how fast you can sign!",
  "Our eyes met! That means we battle. Them's the rules!",
  "My creatures and I trained all morning. Ready?",
  "Halt! Nobody walks this path without a battle!",
  "I've been waiting for someone strong. Is it you?",
  "My team has a type advantage on you. Probably. Let's find out!",
];
const AFTER = [
  "Whoa, your signing is SO fast!",
  "Aww, I lost. I need to practice my letters more.",
  "You're the real deal, Signkeeper!",
  "Okay, okay, you win! Nice moves.",
];
const CHAT = [
  "Tip: check which moves say ▲ Super. They hit way harder!",
  "Tip: Fire beats Nature, Water beats Fire, Nature beats Water.",
  "Tip: quick-draw turns do DOUBLE damage if you sign fast!",
  "Tip: buddies evolve at level 5, and again at level 10. Keep them on your team!",
  "Malgrath's hex is everywhere. Good luck up ahead!",
  "I'm going to train until I can beat you. Just wait!",
];

// A seeded random number generator, so a trainer always looks the same.
function seeded(seed) {
  let n = seed;
  return () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
}

export function trainersFor(z) {
  const zone = ZONES[z];
  // Their creatures: this zone's wild ones, plus some from earlier zones in the same dimension.
  const pool = CREATURES.filter((c) => c.kind === "wild" && ZONES.findIndex((zn) => zn.id === c.zone) <= z && ZONES.find((zn) => zn.id === c.zone).dimension === zone.dimension);
  const local = pool.filter((c) => c.zone === zone.id);
  const out = [];
  for (let area = 1; area < BIOME_AREAS - 1; area++) {
    const [title, name] = PEOPLE[zone.id][(area - 1) % 4];
    const size = area <= 2 ? 2 : 3;
    const level = creatureLevel(z, area);
    const team = [];
    for (let i = 0; i < size; i++) {
      // Mostly local creatures, with the last one sometimes from further back.
      const from = i < size - 1 || hash(z, area, 7) < 0.5 ? local : pool;
      const c = from[Math.floor(hash(z * 9 + area, i, 31) * from.length)];
      team.push({ id: c.id, level: level + (i === size - 1 ? 1 : 0) });
    }
    out.push({
      id: `${zone.id}-${area}`,
      area,
      title,
      name: `${title} ${name}`,
      look: randomLook(seeded(z * 101 + area * 7 + 1)),
      team,
      prize: TRAINER_PRIZE(level),
      before: BEFORE[Math.floor(hash(z, area, 11) * BEFORE.length)],
      after: AFTER[Math.floor(hash(z, area, 13) * AFTER.length)],
      chat: CHAT[Math.floor(hash(z, area, 17) * CHAT.length)],
    });
  }
  return out;
}
