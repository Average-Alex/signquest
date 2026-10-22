// Game content and tuning numbers. Anything a playtest might change lives here.

// The 24 static letters: the letter recognizer (classifier.js) knows these.
export const LETTERS = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");
// J and Z are drawn in the air, so the moving-sign recognizer (motion.js) handles them.
export const MOTION_LETTERS = ["J", "Z"];
export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Short handshape tips for learn cards and hints. Keep them short: the
// youngest players are 6.
export const TIPS = {
  A: "Make a fist. Thumb rests on the side.",
  B: "Flat hand, fingers up. Thumb folds across your palm.",
  C: "Curve your hand like the letter C.",
  D: "Point one finger up. The others touch your thumb.",
  E: "Curl your fingertips down. Thumb tucks under them.",
  F: "Touch your pointer finger to your thumb. Other fingers up.",
  G: "Point your pointer finger and thumb sideways.",
  H: "Point two fingers sideways, together.",
  I: "Make a fist. Pinky finger up.",
  J: "Make an I, then draw a J in the air with your pinky.",
  K: "Two fingers up in a V. Thumb touches the middle finger.",
  L: "Pointer finger up, thumb out. An L!",
  M: "Tuck your thumb under three fingers.",
  N: "Tuck your thumb under two fingers.",
  O: "All your fingertips touch your thumb. An O!",
  P: "Like K, but pointing down.",
  Q: "Like G, but pointing down.",
  R: "Cross your middle finger over your pointer finger.",
  S: "Make a fist. Thumb goes across the front.",
  T: "Tuck your thumb between your first two fingers.",
  U: "Two fingers up, together.",
  V: "Two fingers up, apart. Peace sign!",
  W: "Three fingers up, spread out.",
  X: "Bend your pointer finger into a hook.",
  Y: "Thumb and pinky out. Hang loose!",
  Z: "Point your pointer finger. Draw a Z in the air.",
};

// Moving signs (js/motion.js), and how to do each. Same wording as the
// recorder (training/record.py).
export const MOTION_TIPS = {
  J: "Pinky up (I), then swoop it down and curve it toward you.",
  Z: "Index finger out. Draw a Z in the air.",
  HELLO: "Flat hand at your forehead. Salute out to the side.",
  YES: "Fist (S). Nod it up and down, like a head nodding.",
  NO: "Index + middle finger snap down onto your thumb, twice.",
  "THANK YOU": "Flat hand, fingertips at your chin. Move it out toward the camera.",
  PLEASE: "Flat hand on your chest. Rub it in a circle.",
  SORRY: "Fist (A) on your chest. Rub it in a circle.",
  BYE: "Open hand facing the camera. Fold the fingers down and up (wave).",
  NOTHING: "Not a sign: resting, fidgeting, or a still letter.",
};

// Each zone teaches its letters, then has three stages: practice battle,
// word battle, boss. Words only use letters from this zone and earlier ones.
// Map landmarks are pixel sprites in sprites.js; each zone's creatures are in
// CREATURES below. `map` is where the zone sits on the world map, in percent
// of the map's width and height.
// `dimension` 0 is the overworld island; beating the overworld's last boss
// opens a portal to dimension 1, the Starfall Realm, with harder review zones.
// No word uses J or Z (those letters move, and the game only reads still signs).
export const ZONES = [
  { id: "meadow", name: "Meadow", icon: "🌼", dimension: 0, map: { x: 21, y: 68 }, letters: ["A", "B", "C", "D", "E"], words: ["BAD", "BED", "CAB", "DAB", "ACE"] },
  { id: "forest", name: "Forest", icon: "🌲", dimension: 0, map: { x: 25, y: 30 }, letters: ["F", "G", "H", "I", "J", "K"], words: ["HIDE", "BIKE", "FIG", "DIG", "KID", "JIG", "JAB"] },
  { id: "caves", name: "Caves", icon: "🪨", dimension: 0, map: { x: 53, y: 24 }, letters: ["L", "M", "N", "O", "P"], words: ["MOP", "LION", "POND", "LAMP"] },
  { id: "river", name: "River", icon: "🌊", dimension: 0, map: { x: 79, y: 36 }, letters: ["Q", "R", "S", "T", "U"], words: ["SUN", "RUST", "QUIT", "TRUE"] },
  { id: "castle", name: "Castle", icon: "🏰", dimension: 0, map: { x: 70, y: 70 }, letters: ["V", "W", "X", "Y", "Z"], words: ["WAVY", "FOX", "YAK", "VOW", "ZAP", "LAZY"] },
  // Starfall Realm. Crystal Spires drills the look-alike fist letters.
  { id: "spires", name: "Crystal Spires", icon: "💎", dimension: 1, map: { x: 24, y: 64 }, letters: ["A", "E", "M", "N", "S", "T"], words: ["GEMS", "FROST", "SHINE", "STAR", "MIST"] },
  { id: "clouds", name: "Cloud Kingdom", icon: "☁️", dimension: 1, map: { x: 50, y: 28 }, letters: ["G", "H", "K", "P", "Q", "R", "U", "V"], words: ["CLOUD", "STORM", "RAIN", "WIND", "SKY"] },
  { id: "void", name: "Void Rift", icon: "🌀", dimension: 1, map: { x: 77, y: 62 }, letters: ALPHABET, words: ["SPACE", "COMET", "ORBIT", "MAGIC", "QUEST"] },
  // Crown Keep: Queen Amara's castle, in the middle of the island. Open any
  // time; it has no shard (the Beacon stood on its tower), so `shard: false`.
  // `tier` sets its creature levels like a zone at that spot in the list
  // (see creatureLevel), since it's added at the end.
  { id: "keep", name: "Crown Keep", icon: "👑", dimension: 0, tier: 3, shard: false, map: { x: 45, y: 66 }, letters: ["C", "R", "O", "W", "N"], words: ["CROWN", "CROW", "ROW", "WORN", "CORN"] },
];
// The zones that hold a Beacon Shard.
export const SHARD_ZONES = ZONES.filter((zone) => zone.shard !== false);

export const DIMENSIONS = [
  { name: "Overworld", icon: "🏝️" },
  { name: "Starfall Realm", icon: "🌌" },
];

export const STAGES = [
  { type: "letters", name: "Practice", icon: "⚔️" },
  { type: "words", name: "Words", icon: "📜" },
  { type: "boss", name: "Boss", icon: "👑" },
];

// Potions and power-ups: used up in battle. Art lives in sprites.js under the
// same id. Using one doesn't cost your turn.
export const CONSUMABLES = [
  { id: "potion", name: "Potion", desc: "Heals 40 HP", price: 15 },
  { id: "bigpotion", name: "Big potion", desc: "Heals all HP", price: 35 },
  { id: "shield", name: "Shield", desc: "Blocks 2 hits", price: 25 },
  { id: "power", name: "Power-up", desc: "Next attack hits twice as hard", price: 30 },
];
export const STARTING_CONSUMABLES = { potion: 2, shield: 1, power: 1 };
export const POTION_HEAL = 40;
export const SHIELD_BLOCKS = 2;

// Hats: bought once, worn. Art lives in sprites.js under the same id.
export const SHOP = [
  { id: "hat-cap", kind: "hat", name: "Cap", price: 20 },
  { id: "hat-top", kind: "hat", name: "Top hat", price: 40 },
  { id: "hat-grad", kind: "hat", name: "Grad cap", price: 60 },
  { id: "hat-crown", kind: "hat", name: "Crown", price: 100 },
];

// ---------- Elements ----------
// Every creature has an element, and so do big moves. Like rock-paper-
// scissors: a move hits SUPER hard against the elements it beats, and only
// weakly against its own element and the ones that beat it. Quick moves,
// helper moves, and Spark have no element, so they always hit normally.
export const ELEMENTS = {
  fire: { name: "Fire", icon: "🔥", beats: ["nature", "ice"] },
  water: { name: "Water", icon: "💧", beats: ["fire", "rock"] },
  nature: { name: "Nature", icon: "🌿", beats: ["water", "rock"] },
  lightning: { name: "Storm", icon: "⚡", beats: ["water", "ice"] },
  ice: { name: "Ice", icon: "❄️", beats: ["nature", "water"] },
  rock: { name: "Rock", icon: "🪨", beats: ["fire", "lightning"] },
  light: { name: "Light", icon: "✨", beats: ["dark"] },
  dark: { name: "Shadow", icon: "🌑", beats: ["light"] },
};
export const SUPER_EFFECTIVE = 1.6;
export const NOT_EFFECTIVE = 0.6;
// How well a move of element `attack` hits a creature of element `defend`.
export function effectiveness(attack, defend) {
  if (!ELEMENTS[attack] || !ELEMENTS[defend]) return 1;
  if (ELEMENTS[attack].beats.includes(defend)) return SUPER_EFFECTIVE;
  if (attack === defend || ELEMENTS[defend].beats.includes(attack)) return NOT_EFFECTIVE;
  return 1;
}

// ---------- Creatures ----------
// Every creature in the game, in creature-book order. They're all critters
// born from their zone's element, drawn from shared parts (critters.js). Wild ones roam their
// zone's biome, put under a hex by Malgrath (see story.js). Each zone's boss
// waits by its landmark, guarding a Beacon Shard. A few can only be bought in
// the Shop. Breaking a creature's hex the first time makes it join your team.
// Art: sprites.js.
//
// Every creature has 3 `moves`, like your hero's spells: a quick attack, a
// helper move, and a big signature attack. Your buddies' moves cost energy
// (see "Moves and energy" below); wild creatures use theirs on you.
// Move types:
//   attack - hits for `power` x a normal signed hit (buddies hit harder as they level up)
//   shield - blocks the monster's next hit
//   heal   - heals you (HEAL_FRACTION of your max HP)
//   stun   - the monster skips its next turn
const m = (name, icon, type, cost, power = 1) => ({ name, icon, type, cost, power });
const quick = (name, icon) => m(name, icon, "attack", 2, 1.5);
const big = (name, icon, power = 4) => m(name, icon, "attack", 7, power);
const shield = (name, icon) => m(name, icon, "shield", 3);
const heal = (name, icon) => m(name, icon, "heal", 4);
const stun = (name, icon, cost = 4) => m(name, icon, "stun", cost);
export const CREATURES = [
  { id: "pip", name: "Pip", zone: null, kind: "starter", element: "light", moves: [quick("Ember Nip", "🔥"), stun("Lantern Flash", "🏮", 3), big("Beacon Beam", "🌟")] },
  { id: "puddlepup", name: "Puddlepup", zone: "meadow", kind: "wild", element: "water", moves: [quick("Splash", "💦"), shield("Bubble Wall", "🫧"), big("Puddle Wave", "🌊")] },
  { id: "sproutling", name: "Sproutling", zone: "meadow", kind: "wild", element: "nature", moves: [quick("Leaf Toss", "🍄"), heal("Sunshine", "💚"), big("Seed Storm", "🌧️")] },
  { id: "thistlefox", name: "Thistlefox", zone: "meadow", kind: "wild", element: "nature", moves: [quick("Bite", "🐾"), stun("Prickle", "💤", 3), big("Thistle Pounce", "🦶")] },
  { id: "petalpuff", name: "Petalpuff", zone: "meadow", kind: "wild", element: "nature", moves: [quick("Petal Toss", "🍄"), heal("Pollen Puff", "💚"), big("Blossom Storm", "🌧️")] },
  { id: "frog", name: "Croak King", zone: "meadow", kind: "boss", element: "water", moves: [quick("Splash", "💦"), stun("Croak Shout", "📢"), big("Tongue Lash", "👅", 5)] },
  { id: "mossling", name: "Mossling", zone: "forest", kind: "wild", element: "nature", moves: [quick("Moss Bonk", "🍄"), shield("Bark Skin", "🛡️"), big("Overgrow", "🌧️")] },
  { id: "barkbeetle", name: "Barkbeetle", zone: "forest", kind: "wild", element: "rock", moves: [quick("Horn Poke", "🪨"), shield("Shell Up", "🛡️"), big("Log Roll", "💥")] },
  { id: "vinesnap", name: "Vinesnap", zone: "forest", kind: "wild", element: "nature", moves: [quick("Thorn Bite", "🐾"), stun("Vine Snare", "🌀"), big("Thicket Pounce", "🦶")] },
  { id: "brambling", name: "Brambling", zone: "forest", kind: "wild", element: "nature", moves: [quick("Thorn Jab", "🌿"), shield("Bramble Wall", "🛡️"), big("Briar Burst", "💥")] },
  { id: "snapvine", name: "Snapvine", zone: "forest", kind: "wild", element: "nature", moves: [quick("Vine Whip", "🌿"), stun("Tangle", "🌀"), big("Overgrowth", "🌧️")] },
  { id: "owl", name: "Professor Hoot", zone: "forest", kind: "boss", element: "lightning", moves: [quick("Peck", "🪶"), heal("Wise Glow", "💚"), big("Hoot Blast", "🦉", 5)] },
  { id: "pebblit", name: "Pebblit", zone: "caves", kind: "wild", element: "rock", moves: [quick("Pebble Toss", "🪨"), shield("Stone Skin", "🛡️"), big("Rock Slide", "💥")] },
  { id: "gemmole", name: "Gemmole", zone: "caves", kind: "wild", element: "rock", moves: [quick("Dig", "🐾"), stun("Gem Flash", "💎"), big("Crystal Crash", "💥")] },
  { id: "glowbat", name: "Glowbat", zone: "caves", kind: "wild", element: "dark", moves: [quick("Wing Flap", "🦇"), stun("Echo Screech", "🔊"), big("Night Dive", "🌙")] },
  { id: "geodite", name: "Geodite", zone: "caves", kind: "wild", element: "rock", moves: [quick("Gem Punch", "💎"), shield("Crystal Skin", "🛡️"), big("Geode Smash", "💥")] },
  { id: "bat", name: "Count Flap", zone: "caves", kind: "boss", element: "dark", moves: [quick("Wing Flap", "🦇"), stun("Echo Screech", "🔊"), big("Night Dive", "🌙", 5)] },
  { id: "bubblet", name: "Bubblet", zone: "river", kind: "wild", element: "water", moves: [quick("Bubble", "🫧"), heal("Splash Heal", "💧"), big("Tidal Leap", "🌊")] },
  { id: "reedcrab", name: "Reedcrab", zone: "river", kind: "wild", element: "rock", moves: [quick("Pinch", "🦀"), shield("Shell Up", "🛡️"), big("Crab Crush", "💥")] },
  { id: "tidesprite", name: "Tidesprite", zone: "river", kind: "wild", element: "water", moves: [quick("Water Jet", "💧"), stun("Whirlpool", "🌀"), big("Riptide", "🌊")] },
  { id: "lilyhop", name: "Lilyhop", zone: "river", kind: "wild", element: "water", moves: [quick("Lily Splash", "💦"), heal("Pond Nap", "💚"), big("Leap Splash", "🌊")] },
  { id: "octopus", name: "Inkzilla", zone: "river", kind: "boss", element: "water", moves: [quick("Tentacle Slap", "🐙"), stun("Ink Cloud", "🌫️"), big("Eight-Arm Spin", "🌀", 5)] },
  { id: "cinderling", name: "Cinderling", zone: "castle", kind: "wild", element: "fire", moves: [quick("Fire Flick", "🔥"), stun("Smoke Puff", "🌫️"), big("Flame Burst", "🔥", 5)] },
  { id: "torchbug", name: "Torchbug", zone: "castle", kind: "wild", element: "fire", moves: [quick("Glow Zap", "🔥"), heal("Warm Glow", "💚"), big("Torch Swarm", "🔥")] },
  { id: "kilnlizard", name: "Kiln Lizard", zone: "castle", kind: "wild", element: "fire", moves: [quick("Tail Whip", "🐾"), shield("Hot Scales", "🛡️"), big("Kiln Blast", "🔥", 5)] },
  { id: "drakeling", name: "Drakeling", zone: "castle", kind: "wild", element: "fire", moves: [quick("Claw", "🐾"), shield("Wing Guard", "🛡️"), big("Flame Breath", "🔥", 5)] },
  { id: "dragon", name: "Blaze", zone: "castle", kind: "boss", element: "fire", moves: [quick("Claw", "🐾"), stun("Smoke Screen", "🌫️"), big("Fire Breath", "🔥", 5)] },
  { id: "frostfox", name: "Frostfox", zone: "spires", kind: "wild", element: "ice", moves: [quick("Snowball", "❄️"), shield("Frost Fur", "🛡️"), big("Avalanche", "🏔️")] },
  { id: "prismit", name: "Prismit", zone: "spires", kind: "wild", element: "rock", moves: [quick("Shard Toss", "💎"), stun("Prism Flash", "✨"), big("Crystal Crash", "💥")] },
  { id: "shiverling", name: "Shiverling", zone: "spires", kind: "wild", element: "ice", moves: [quick("Ice Chip", "❄️"), stun("Chill", "🥶"), big("Frost Burst", "🌨️")] },
  { id: "icewyrm", name: "Glacier Wyrm", zone: "spires", kind: "boss", element: "ice", moves: [quick("Ice Fang", "🧊"), stun("Deep Freeze", "🥶"), big("Blizzard", "🌨️", 5)] },
  { id: "puffwing", name: "Puffwing", zone: "clouds", kind: "wild", element: "lightning", moves: [quick("Gust", "🌬️"), heal("Cloud Nap", "💚"), big("Thunder Puff", "⚡")] },
  { id: "voltkit", name: "Voltkit", zone: "clouds", kind: "wild", element: "lightning", moves: [quick("Spark Nip", "⚡"), stun("Static", "📢", 3), big("Bolt Dash", "⚡", 5)] },
  { id: "nimbling", name: "Nimbling", zone: "clouds", kind: "wild", element: "lightning", moves: [quick("Drizzle", "💧"), stun("Thunder Clap", "📢", 3), big("Downpour", "⚡")] },
  { id: "stormowl", name: "Storm Owl", zone: "clouds", kind: "boss", element: "lightning", moves: [quick("Gust", "🌬️"), shield("Static Shield", "🛡️"), big("Thunder Wing", "⚡", 5)] },
  { id: "cat", name: "Whiskers", zone: null, kind: "shop", element: "lightning", price: 60, moves: [quick("Swipe", "🐾"), heal("Catnap", "💚"), big("Pounce Storm", "⚡")] },
  { id: "drake", name: "Drake", zone: null, kind: "shop", element: "fire", price: 150, moves: [quick("Ember", "🔥"), shield("Wing Guard", "🛡️"), big("Inferno", "🔥", 5)] },
  { id: "shieldbug", name: "Shieldbug", zone: "keep", kind: "wild", element: "rock", moves: [quick("Shell Bash", "🪨"), shield("Royal Guard", "🛡️"), big("Crown Charge", "💥")] },
  { id: "griffling", name: "Griffling", zone: "keep", kind: "wild", element: "light", moves: [quick("Peck", "🪶"), heal("Royal Song", "💚"), big("Sun Dive", "✨")] },
  { id: "squirepup", name: "Squirepup", zone: "keep", kind: "wild", element: "rock", moves: [quick("Shield Bash", "🪨"), shield("Guard Up", "🛡️"), big("Royal Charge", "💥")] },
  // Crown Keep. Aurelion is Queen Amara's royal gryphon, hexed to guard her keep.
  { id: "gryphon", name: "Aurelion", zone: "keep", kind: "boss", element: "lightning", moves: [quick("Talon Swipe", "🦅"), stun("Royal Screech", "📢"), big("Sky Sovereign", "⚡", 5)] },
  { id: "shadewisp", name: "Shadewisp", zone: "void", kind: "wild", element: "dark", moves: [quick("Shadow Tap", "🌑"), shield("Fade Out", "🛡️"), big("Void Wave", "🌀")] },
  { id: "duskwing", name: "Duskwing", zone: "void", kind: "wild", element: "dark", moves: [quick("Bite", "🦇"), stun("Night Screech", "🔊"), big("Eclipse", "🌑")] },
  { id: "gloomfox", name: "Gloomfox", zone: "void", kind: "wild", element: "dark", moves: [quick("Shadow Bite", "🌑"), shield("Gloom Cloak", "🛡️"), big("Night Howl", "🌙")] },
  { id: "abyssling", name: "Abyssling", zone: "void", kind: "wild", element: "water", moves: [quick("Grab", "🐙"), stun("Void Grip", "🌀"), big("Abyss Crush", "💥")] },
  // The final boss. He can't join your team, and isn't in the creature book.
  { id: "malgrath", name: "Malgrath the Hollow King", zone: "void", kind: "boss", element: "dark", catchable: false, moves: [quick("Hollow Bolt", "🌑"), heal("Dark Mend", "💜"), big("Shatter", "💥", 5)] },
];
for (const c of CREATURES) c.moves[2].element = c.element;

// Group moves (💥 All) hit every foe on the field, at GROUP_POWER of their
// power each. Against a lone foe they hit it at full power.
export const GROUP_POWER = 0.6;
const GROUP_MOVES = new Set([
  "Slime Wave", "Mushroom Rain", "Gloop Flood", "Eight-Arm Spin", "Fire Breath", "Avalanche", "Blizzard",
  "Spore Storm", "Void Wave", "Inferno", "Pounce Storm", "Eclipse", "Echo Screech", "Sky Sovereign",
]);
for (const c of CREATURES) for (const mv of c.moves) if (GROUP_MOVES.has(mv.name)) mv.all = true;

// ---------- Evolution ----------
// Buddies evolve when they reach EVOLVE_LEVEL: a new name, a bigger, brighter
// look, and harder-hitting moves.
export const EVOLVE_LEVEL = 5;
export const EVOLVED_POWER = 1.25; // evolved buddies' attacks hit this much harder
// Rarity: how often a wild creature turns up, how tough it is, and how much
// it pays. `weight`: its share of wild encounters in its zone. `hp`: foe HP
// multiplier. `reward`: coin and XP multiplier for beating it. Bosses and
// creatures not listed in CREATURE_RARITY are their own tier / common.
export const RARITIES = {
  common: { name: "Common", color: "#c9ccd6", weight: 60, hp: 1, reward: 1 },
  uncommon: { name: "Uncommon", color: "#6fdc6a", weight: 28, hp: 1.05, reward: 1.25 },
  rare: { name: "Rare", color: "#4fb3ff", weight: 10, hp: 1.1, reward: 1.6 },
  epic: { name: "Epic", color: "#c58cf0", weight: 3, hp: 1.2, reward: 2.2 },
  legendary: { name: "Legendary", color: "#ffc93c", weight: 1, hp: 1.3, reward: 3 },
  boss: { name: "Boss", color: "#ff6b5e", weight: 0, hp: 1, reward: 1 },
};
export const CREATURE_RARITY = {
  pip: "legendary",
  puddlepup: "common", sproutling: "common", thistlefox: "uncommon", petalpuff: "common",
  mossling: "common", barkbeetle: "uncommon", vinesnap: "rare", brambling: "common", snapvine: "uncommon",
  pebblit: "common", gemmole: "uncommon", glowbat: "rare", geodite: "uncommon",
  bubblet: "common", reedcrab: "uncommon", tidesprite: "rare", lilyhop: "common",
  cinderling: "common", torchbug: "uncommon", kilnlizard: "rare", drakeling: "epic",
  shieldbug: "uncommon", griffling: "rare", squirepup: "common",
  frostfox: "uncommon", prismit: "rare", shiverling: "common",
  puffwing: "uncommon", voltkit: "rare", nimbling: "common",
  shadewisp: "rare", duskwing: "epic", gloomfox: "epic", abyssling: "legendary",
  cat: "rare", drake: "epic",
};
// Creatures from older versions, and the critter that replaced each one
// (progress.js moves saves over, keeping levels).
export const RENAMED_CREATURES = {
  bunny: "sproutling", shroom: "barkbeetle", pup: "thistlefox", gloop: "glowbat", splash: "bubblet",
  ghost: "torchbug", unicorn: "drakeling", crownbug: "griffling", puffcap: "puffwing", skyhop: "voltkit",
  voidghost: "shadewisp", slime: "puddlepup", bandit: "sproutling", wolf: "thistlefox", goblin: "mossling",
  hobgoblin: "barkbeetle", spider: "vinesnap", skeleton: "pebblit", golem: "gemmole", darkwisp: "glowbat",
  lizardman: "bubblet", crab: "reedcrab", basilisk: "tidesprite", fireimp: "cinderling", wraith: "torchbug",
  mimic: "kilnlizard", dragonling: "drakeling", knightling: "shieldbug", gargoyle: "griffling",
  frostling: "frostfox", shardgolem: "prismit", harpy: "puffwing", thunderhawk: "voltkit",
  voidslime: "shadewisp", shadowbat: "duskwing", shadowknight: "gloomfox", voidkraken: "abyssling",
  emberfox: "vinesnap",
};
export const rarityOf = (c) => RARITIES[c.kind === "boss" ? "boss" : CREATURE_RARITY[c.id] || "common"];

export const EVOLUTIONS = {
  pip: "Lumos", puddlepup: "Puddlehound", sproutling: "Bloomling", thistlefox: "Thornfox", frog: "Croak Emperor",
  mossling: "Mossgiant", barkbeetle: "Oakbeetle", vinesnap: "Thornjaw", brambling: "Briarback", snapvine: "Vinelord", petalpuff: "Bloompuff", geodite: "Geodon", lilyhop: "Lilyleap", squirepup: "Knightpup", shiverling: "Glacieling", nimbling: "Stormling", owl: "Archsage Hoot",
  pebblit: "Boulderling", gemmole: "Geodemole", glowbat: "Lumibat", bat: "Duke Flap",
  bubblet: "Bubblord", reedcrab: "Tidecrab", tidesprite: "Tidecaller", octopus: "Inkzilla Prime",
  cinderling: "Infernling", torchbug: "Beaconbug", kilnlizard: "Forge Lizard", drakeling: "Wyvern", dragon: "Infernus",
  shieldbug: "Paladin Beetle", griffling: "Gryphling", gryphon: "Sky Monarch",
  frostfox: "Blizzard Fox", prismit: "Prismight", icewyrm: "Glacier King",
  puffwing: "Stormwing", voltkit: "Thunderkit", stormowl: "Tempest Owl",
  shadewisp: "Shade Lantern", duskwing: "Eclipse Wing", gloomfox: "Nightfox", abyssling: "Abyss Lord",
  cat: "Thunderpaws", drake: "Dragonlord",
};
export const isEvolved = (level) => level >= EVOLVE_LEVEL;
// A buddy's name at a given level.
export const creatureName = (id, level = 1) => {
  const c = CREATURES.find((x) => x.id === id);
  return isEvolved(level) && EVOLUTIONS[id] ? EVOLUTIONS[id] : c.name;
};

export const STARTER_CREATURE = "pip";
export const TEAM_SIZE = 2; // buddies that fight beside you

// ---------- Moves and energy ----------
// Each turn you pick one move, then sign the target to fire it. Signing is
// what charges your energy, so bigger moves have to be earned by signing.
// Spark is free, so you can never get stuck.
export const HERO_MOVES = [
  { id: "spark", name: "Spark", icon: "✨", cost: 0, power: 1 },
  { id: "blast", name: "Blast", icon: "💥", cost: 3, power: 2, element: "fire" },
  { id: "nova", name: "Nova", icon: "🌟", cost: 6, power: 3.5, element: "light", all: true },
];
export const ENERGY_START = 2;
export const ENERGY_MAX = 10;
export const ENERGY_PER_LETTER = 1; // for every letter you sign
export const ENERGY_FAST_BONUS = 1; // extra when you sign a target fast, without a hint
export const HEAL_FRACTION = 0.3;
// Monster "hex" HP has room for bigger moves and your buddies' hits, so they
// don't cut the signing practice short. If the planned signs run out first,
// the battle keeps going with more.
export const HEX_HP_MULTIPLIER = 1.6;

// Hero classes: each gives one small perk, and picking one dresses your hero
// to match (you can still change any part of the look). Perks: `hp` and
// `power` multiply your max HP and your own attacks, `crit` adds to your
// critical-hit chance, `potion` multiplies how much a potion heals, and
// `energy` is extra energy at the start of a battle.
export const HERO_CLASSES = {
  fighter: { name: "Fighter", icon: "🗡️", trait: "Strong · Brave", perk: "20% more HP", look: { outfitStyle: "armor", weapon: "sword" }, hp: 1.2 },
  mage: { name: "Mage", icon: "🔮", trait: "Smart · Curious", perk: "Your spells hit 15% harder", look: { outfitStyle: "robe", weapon: "staff" }, power: 1.15 },
  archer: { name: "Archer", icon: "🏹", trait: "Fast · Precise", perk: "More critical hits", look: { outfitStyle: "ranger", weapon: "bow" }, crit: 0.1 },
  healer: { name: "Healer", icon: "💚", trait: "Kind · Patient", perk: "Potions heal 50% more", look: { outfitStyle: "cleric", weapon: "staff" }, potion: 1.5 },
  monk: { name: "Monk", icon: "🥋", trait: "Focused · Calm", perk: "Start battles with 2 extra energy", look: { outfitStyle: "gi", weapon: "fists" }, energy: 2 },
};
export const DEFAULT_CLASS = "mage";

// ⚡ Counter-Sign: when a creature attacks, it sometimes signs a letter at you
// as it winds up (always for its big moves). Sign it back in time (or tap the
// right letter) to block the hit; signing it also bounces some damage back.
export const COUNTER_CHANCE = 0.5;
export const COUNTER_MS = 4500; // how long you have (Assist mode: no time limit)
export const COUNTER_REFLECT = 1.2; // bounced back at the creature when you sign it, in letters' worth of damage

// Damage is in HP points. Each letter you sign deals SIGN_DAMAGE (times your
// move's power). Only one character acts each turn: the one whose move you pick.
export const SIGN_DAMAGE = 10;
// A buddy's attack moves hit like your signing, and get stronger as it levels up.
export const buddyMoveBoost = (level) => 1 + (level - 1) * 0.08;
// When a wild creature attacks, its quick move does a bit less than normal and
// its signature move a lot more. It can only use its signature from turn 2.
export const ENEMY_QUICK_DAMAGE = 0.9;
export const ENEMY_BIG_DAMAGE = 1.6;
export const ENEMY_BIG_CHANCE = 0.25;
export const ENEMY_HEAL_FRACTION = 0.12;
export const CRIT_CHANCE = 0.1; // normal chance of a critical hit
export const CRIT_CHANCE_FAST = 0.35; // when you signed fast without a hint
export const CRIT_MULTIPLIER = 1.5;
export const BUDDY_MAX_LEVEL = 10;
export const BUDDY_XP_WIN = 25;
export const BUDDY_XP_LOSS = 10;
export const buddyXpToLevel = (level) => 40 + level * 20; // XP needed to go from `level` to the next

// ---------- Exploring a zone (biome.js) ----------
// Each zone is a tall area, several screens high, explored bottom to top. A
// locked gate separates each area from the next; finishing the villager's
// quest there opens it (quests.js). The boss waits at the very top and is
// gone for good once beaten.
export const BIOME_AREAS = 6;
export const QUEST_COINS = 15; // for finishing a villager's quest
export const WILD_PER_AREA = 3; // creatures roaming each area at once

// Things to find while exploring, per area.
export const CHESTS_PER_AREA = 1; // 🔐 sign the letter shown to open it
export const CHEST_COINS = [15, 30]; // min, max (or a potion/power-up instead, sometimes)
export const COINS_PER_AREA = 4; // ✨ sparkles you walk over
export const SPARKLE_COINS = 3;

// Signposts 🪧: real facts about ASL and Deaf culture, plus game tips.
export const SIGNPOST_TEXTS = [
  "ASL is its own language, with its own grammar. It isn't English on the hands!",
  "Fingerspelling is for names, and for words that don't have their own sign.",
  "J and Z are the only ASL letters that move. Every other letter is a still handshape.",
  "Your face is part of ASL! Raised eyebrows can turn a sentence into a yes-or-no question.",
  "Different countries have different sign languages. British Sign Language is very different from ASL.",
  "ASL is related to French Sign Language.",
  "Gallaudet University in Washington, D.C. is a university for Deaf and hard of hearing students.",
  "Tip: hold each sign steady until the bar fills up.",
  "Tip: if a letter is hard, press 💡 Hint to see the handshape.",
  "Tip: higher-level monsters hit harder. Keep a potion ready!",
  "Tip: your buddy levels up after every battle. Pick one in your 📖 book.",
  "Tip: A, E, M, N, S, and T all start from a fist. Watch where your thumb goes!",
  "Tip: moves marked ▲ Super hit extra hard. Fire beats Nature, Water beats Fire, Nature beats Water!",
  "Tip: trainers battle anyone who walks into their sight. Watch for the ❗",
  "Tip: buddies evolve at level 5 and get stronger!",
];
export const SIGNPOSTS_PER_AREA = 1;

// ---------- Getting stronger ----------
// Monsters have levels: higher in later areas of a zone, and higher again in
// later zones. Meadow area 1 is level 1, the Castle boss level 32, and the
// Void Rift boss level 50.
export const creatureLevel = (zoneIndex, area) => 1 + (ZONES[zoneIndex].tier ?? zoneIndex) * BIOME_AREAS + area;
export const GUARD_EXTRA_LEVELS = 1;
export const BOSS_EXTRA_LEVELS = 2;
// Stronger monsters hit harder...
export const monsterDamage = (level) => 6 + Math.round(level * 0.5);
// ...and take more signs to beat.
export const battleLength = (level) => ({
  letters: Math.min(12, 4 + Math.floor(level / 3)), // letter battles
  words: Math.min(4, 2 + Math.floor(level / 8)), // word battles
  bossLetters: Math.min(12, 5 + Math.floor(level / 3)), // bosses: review letters, then words
  bossWords: 1 + Math.floor(level / 10),
});
// You get tougher as your player level goes up (from XP), up to a point -
// late-game monsters still need fast signing and potions.
export const playerMaxHp = (playerLevel) => Math.min(250, 97 + playerLevel * 3);

// Defaults for the Settings screen.
export const DEFAULT_SETTINGS = {
  holdMs: 150, // how long a sign must be held to count (short: signs should feel near-instant)
  minConfidence: 0.6, // how sure the recognizer must be that it's the target letter
  hand: "auto", // "auto" | "right" | "left" - which hand the player signs with
  recognizer: "auto", // "auto" | "model" | "knn" | "keyboard"
  narration: true, // a narrator voice (and a drone) in cinematics; captions always show
  music: true, // chiptune music on every screen (music.js)
};

// Turn-based battles: after each of your turns (one letter or one whole
// word), the monster attacks back - unless you signed fast without a hint,
// which leaves it too dizzy to attack. Damage and HP scale with levels above.
export const BOSS_EXTRA_DAMAGE = 4;
export const FAST_SIGN_MS = 3000; // per letter, to count as "fast"
// 🔥 Combo: each target in a row signed fast (no hint) adds damage, up to a max.
export const COMBO_BONUS = 0.1;
export const COMBO_MAX = 5;
// Signing fast gives a CHANCE to daze the monster (never two turns in a
// row), and tougher monsters shake it off more often.
export const dizzyChance = (level) => Math.max(0.15, 0.45 - level * 0.012);
export const LOOT_CHANCE = 0.4; // chance of a potion/power-up after a win (bosses always drop one)

// ---------- Sign challenges ----------
// To keep battles fresh, some turns twist what you sign (game.js):
//   riddle - a clue about the handshape instead of the letter: which is it?
//   blank  - a word with a missing letter: sign the one that fits
//   quick  - quick-draw: sign it within QUICK_MS for double damage
// Harder challenges, done without a hint, hit harder.
export const CHALLENGE_CHANCE = { riddle: 0.18, blank: 0.18, quick: 0.18 };
export const CHALLENGE_BONUS = 1.4; // riddle and blank
export const QUICK_MS = 4000;
export const QUICK_BONUS = 2;

// ---------- Trainers ----------
// Pokemon-style: trainers stand by the path. Walk into their line of sight and
// they spot you (❗), walk over, and battle you with a team of 2-3 creatures.
// Beat them for prize coins. Each one battles you once.
export const TRAINER_SIGHT = 56; // pixels
export const TRAINER_PRIZE = (level) => 20 + level * 3;
export const TRAINER_HP = 0.6; // each trainer creature has this much of a wild one's HP

export const SMOOTH_FRAMES = 4; // predictions averaged over this many frames (more = steadier but slower)
export const HINT_AFTER_MS = 8000; // hint glows after this long on one letter
export const SKIP_AFTER_MS = 16000; // skip button appears after this long
