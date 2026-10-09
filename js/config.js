// Game content and tuning numbers. Anything a playtest might change lives here.

// The 24 static letters. J and Z involve motion, so they're left out of v1.
export const LETTERS = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");

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
  { id: "forest", name: "Forest", icon: "🌲", dimension: 0, map: { x: 25, y: 30 }, letters: ["F", "G", "H", "I", "K"], words: ["HIDE", "BIKE", "FIG", "DIG", "KID"] },
  { id: "caves", name: "Caves", icon: "🪨", dimension: 0, map: { x: 53, y: 24 }, letters: ["L", "M", "N", "O", "P"], words: ["MOP", "LION", "POND", "LAMP"] },
  { id: "river", name: "River", icon: "🌊", dimension: 0, map: { x: 79, y: 36 }, letters: ["Q", "R", "S", "T", "U"], words: ["SUN", "RUST", "QUIT", "TRUE"] },
  { id: "castle", name: "Castle", icon: "🏰", dimension: 0, map: { x: 70, y: 70 }, letters: ["V", "W", "X", "Y"], words: ["WAVY", "FOX", "YAK", "VOW"] },
  // Starfall Realm. Crystal Spires drills the look-alike fist letters.
  { id: "spires", name: "Crystal Spires", icon: "💎", dimension: 1, map: { x: 24, y: 64 }, letters: ["A", "E", "M", "N", "S", "T"], words: ["GEMS", "FROST", "SHINE", "STAR", "MIST"] },
  { id: "clouds", name: "Cloud Kingdom", icon: "☁️", dimension: 1, map: { x: 50, y: 28 }, letters: ["G", "H", "K", "P", "Q", "R", "U", "V"], words: ["CLOUD", "STORM", "RAIN", "WIND", "SKY"] },
  { id: "void", name: "Void Rift", icon: "🌀", dimension: 1, map: { x: 77, y: 62 }, letters: LETTERS, words: ["SPACE", "COMET", "ORBIT", "MAGIC", "QUEST"] },
];

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

// ---------- Creatures ----------
// Every creature in the game, in creature-book order. Wild ones roam their
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
  { id: "pip", name: "Pip", zone: null, kind: "starter", moves: [quick("Ember Nip", "🔥"), stun("Lantern Flash", "🏮", 3), big("Beacon Beam", "🌟")] },
  { id: "slime", name: "Blobby", zone: "meadow", kind: "wild", moves: [quick("Bounce", "🟢"), shield("Bubble Wall", "🫧"), big("Slime Wave", "🌊")] },
  { id: "bunny", name: "Hopper", zone: "meadow", kind: "wild", moves: [quick("Nibble", "🥕"), heal("Carrot Snack", "💚"), big("Hop Kick", "🦶")] },
  { id: "frog", name: "Croak King", zone: "meadow", kind: "boss", moves: [quick("Splash", "💦"), stun("Croak Shout", "📢"), big("Tongue Lash", "👅", 5)] },
  { id: "shroom", name: "Shroomy", zone: "forest", kind: "wild", moves: [quick("Cap Bonk", "🍄"), stun("Sleepy Spores", "💤"), big("Mushroom Rain", "🌧️")] },
  { id: "pup", name: "Pepper", zone: "forest", kind: "wild", moves: [quick("Tail Whip", "🐕"), stun("Big Bark", "📢", 3), big("Zoomies", "💨")] },
  { id: "owl", name: "Professor Hoot", zone: "forest", kind: "boss", moves: [quick("Peck", "🪶"), heal("Wise Glow", "💚"), big("Hoot Blast", "🦉", 5)] },
  { id: "golem", name: "Rocky", zone: "caves", kind: "wild", moves: [quick("Pebble Toss", "🪨"), shield("Stone Skin", "🛡️"), big("Rock Slam", "💥")] },
  { id: "gloop", name: "Gloop", zone: "caves", kind: "wild", moves: [quick("Goo Ball", "🟣"), shield("Goo Shield", "🛡️"), big("Gloop Flood", "🌊")] },
  { id: "bat", name: "Count Flap", zone: "caves", kind: "boss", moves: [quick("Wing Flap", "🦇"), stun("Echo Screech", "🔊"), big("Night Dive", "🌙", 5)] },
  { id: "crab", name: "Snips", zone: "river", kind: "wild", moves: [quick("Pinch", "🦀"), shield("Shell Up", "🛡️"), big("Crab Crush", "💥")] },
  { id: "splash", name: "Splash", zone: "river", kind: "wild", moves: [quick("Bubble", "🫧"), heal("Splash Heal", "💧"), big("Tidal Leap", "🌊")] },
  { id: "octopus", name: "Inkzilla", zone: "river", kind: "boss", moves: [quick("Tentacle Slap", "🐙"), stun("Ink Cloud", "🌫️"), big("Eight-Arm Spin", "🌀", 5)] },
  { id: "ghost", name: "Boo", zone: "castle", kind: "wild", moves: [quick("Boo!", "👻"), shield("Spooky Fade", "🌫️"), big("Haunt", "🌙")] },
  { id: "unicorn", name: "Sparkle", zone: "castle", kind: "wild", moves: [quick("Horn Poke", "🦄"), heal("Rainbow Heal", "🌈"), big("Star Gallop", "✨")] },
  { id: "dragon", name: "Blaze", zone: "castle", kind: "boss", moves: [quick("Claw", "🐾"), stun("Smoke Screen", "🌫️"), big("Fire Breath", "🔥", 5)] },
  { id: "frostling", name: "Frostling", zone: "spires", kind: "wild", moves: [quick("Snowball", "❄️"), shield("Frost Armor", "🛡️"), big("Avalanche", "🏔️")] },
  { id: "shardgolem", name: "Shard Golem", zone: "spires", kind: "wild", moves: [quick("Shard Toss", "💎"), shield("Crystal Wall", "🛡️"), big("Crystal Crash", "💥")] },
  { id: "icewyrm", name: "Glacier Wyrm", zone: "spires", kind: "boss", moves: [quick("Ice Fang", "🧊"), stun("Deep Freeze", "🥶"), big("Blizzard", "🌨️", 5)] },
  { id: "puffcap", name: "Puffcap", zone: "clouds", kind: "wild", moves: [quick("Puff", "💨"), stun("Dream Dust", "✨"), big("Spore Storm", "🍄")] },
  { id: "skyhop", name: "Sky Hopper", zone: "clouds", kind: "wild", moves: [quick("Cloud Kick", "☁️"), heal("Cloud Hop", "💚"), big("Sky Dive", "🌤️")] },
  { id: "stormowl", name: "Storm Owl", zone: "clouds", kind: "boss", moves: [quick("Gust", "🌬️"), shield("Static Shield", "🛡️"), big("Thunder Wing", "⚡", 5)] },
  { id: "voidghost", name: "Wisp", zone: "void", kind: "wild", moves: [quick("Shadow Tap", "🌑"), shield("Fade Out", "🛡️"), big("Void Wave", "🌀")] },
  { id: "shadowbat", name: "Shadow Flap", zone: "void", kind: "wild", moves: [quick("Bite", "🦇"), stun("Night Screech", "🔊"), big("Eclipse", "🌑")] },
  { id: "voidkraken", name: "Void Kraken", zone: "void", kind: "wild", moves: [quick("Grab", "🐙"), stun("Void Grip", "🌀"), big("Abyss Crush", "💥")] },
  { id: "cat", name: "Whiskers", zone: null, kind: "shop", price: 60, moves: [quick("Swipe", "🐾"), heal("Catnap", "💚"), big("Pounce Storm", "⚡")] },
  { id: "drake", name: "Drake", zone: null, kind: "shop", price: 150, moves: [quick("Ember", "🔥"), shield("Wing Guard", "🛡️"), big("Inferno", "🔥", 5)] },
  // The final boss. He can't join your team, and isn't in the creature book.
  { id: "malgrath", name: "Malgrath the Hollow King", zone: "void", kind: "boss", catchable: false, moves: [quick("Hollow Bolt", "🌑"), heal("Dark Mend", "💜"), big("Shatter", "💥", 5)] },
];
export const STARTER_CREATURE = "pip";
export const TEAM_SIZE = 2; // buddies that fight beside you

// ---------- Moves and energy ----------
// Each turn you pick one move, then sign the target to fire it. Signing is
// what charges your energy, so bigger moves have to be earned by signing.
// Spark is free, so you can never get stuck.
export const HERO_MOVES = [
  { id: "spark", name: "Spark", icon: "✨", cost: 0, power: 1 },
  { id: "blast", name: "Blast", icon: "💥", cost: 3, power: 2 },
  { id: "nova", name: "Nova", icon: "🌟", cost: 6, power: 3.5 },
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
// locked gate separates each area from the next. Its guard sleeps until you
// beat some creatures in that area; beat the guard to open the gate. The boss
// waits at the very top and is gone for good once beaten.
export const BIOME_AREAS = 6;
export const WINS_TO_WAKE_GUARD = 2;
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
];
export const SIGNPOSTS_PER_AREA = 1;

// ---------- Getting stronger ----------
// Monsters have levels: higher in later areas of a zone, and higher again in
// later zones. Meadow area 1 is level 1, the Castle boss level 32, and the
// Void Rift boss level 50.
export const creatureLevel = (zoneIndex, area) => 1 + zoneIndex * BIOME_AREAS + area;
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
  holdMs: 500, // how long a sign must be held to count
  minConfidence: 0.8, // how sure the recognizer must be
  hand: "auto", // "auto" | "right" | "left" - which hand the player signs with
  recognizer: "auto", // "auto" | "model" | "knn" | "keyboard"
};

// Turn-based battles: after each of your turns (one letter or one whole
// word), the monster attacks back - unless you signed fast without a hint,
// which leaves it too dizzy to attack. Damage and HP scale with levels above.
export const BOSS_EXTRA_DAMAGE = 4;
export const FAST_SIGN_MS = 3000; // per letter, to count as "fast"
// Signing fast gives a CHANCE to daze the monster (never two turns in a
// row), and tougher monsters shake it off more often.
export const dizzyChance = (level) => Math.max(0.15, 0.45 - level * 0.012);
export const LOOT_CHANCE = 0.4; // chance of a potion/power-up after a win (bosses always drop one)

export const SMOOTH_FRAMES = 8; // predictions averaged over this many frames
export const HINT_AFTER_MS = 8000; // hint glows after this long on one letter
export const SKIP_AFTER_MS = 16000; // skip button appears after this long
