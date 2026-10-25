// Game content and tuning numbers. Anything a playtest might change lives here.

// The 24 static letters: the letter recognizer (classifier.js) knows these.
export const LETTERS = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");
// J and Z are drawn in the air, so the moving-sign recognizer (motion.js) handles them.
export const MOTION_LETTERS = ["J", "Z"];
export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
// Letters whose handshapes look a lot alike (a fist with the thumb somewhere
// different, two fingers up or pointing...). Counter-signs never offer them
// together as choices.
export const LOOK_ALIKES = [["A", "E", "M", "N", "S", "T"], ["U", "V", "R", "H"], ["G", "H", "Q", "P"], ["K", "P", "V"]];

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
// Zone ids are save keys from earlier versions (forest is now the Glowshroom
// Forest, caves Magma Canyon, river Coral Lagoon, castle Haunted Hollow,
// spires Aurora Glacier, clouds Thunder Peaks, void the
// Cosmic Rift).
export const ZONES = [
  { id: "meadow", name: "Meadow", icon: "🌼", dimension: 0, map: { x: 15, y: 74 }, letters: ["A", "B", "C", "D", "E"], words: ["BAD", "BED", "CAB", "DAB", "ACE"] },
  { id: "forest", name: "Glowshroom Forest", icon: "🍄", dimension: 0, map: { x: 24, y: 31 }, letters: ["F", "G", "H", "I", "J", "K"], words: ["HIDE", "BIKE", "FIG", "DIG", "KID", "JIG", "JAB"] },
  { id: "caves", name: "Magma Canyon", icon: "🌋", dimension: 0, map: { x: 57, y: 19 }, letters: ["L", "M", "N", "O", "P"], words: ["MOP", "LION", "POND", "LAMP"] },
  { id: "river", name: "Coral Lagoon", icon: "🐚", dimension: 0, map: { x: 85, y: 40 }, letters: ["Q", "R", "S", "T", "U"], words: ["SUN", "RUST", "QUIT", "TRUE"] },
  { id: "castle", name: "Haunted Hollow", icon: "🎃", dimension: 0, map: { x: 71, y: 71 }, letters: ["V", "W", "X", "Y", "Z"], words: ["WAVY", "FOX", "YAK", "VOW", "ZAP", "LAZY"] },
  // Starfall Realm. The Aurora Glacier drills the look-alike fist letters.
  { id: "spires", name: "Aurora Glacier", icon: "🧊", dimension: 1, map: { x: 19, y: 58 }, letters: ["A", "E", "M", "N", "S", "T"], words: ["GEMS", "FROST", "SHINE", "STAR", "MIST"] },
  { id: "clouds", name: "Thunder Peaks", icon: "⛰️", dimension: 1, map: { x: 46, y: 24 }, letters: ["G", "H", "K", "P", "Q", "R", "U", "V"], words: ["CLOUD", "STORM", "RAIN", "WIND", "SKY"] },
  { id: "void", name: "Cosmic Rift", icon: "🪐", dimension: 1, map: { x: 80, y: 70 }, letters: ALPHABET, words: ["SPACE", "COMET", "ORBIT", "MAGIC", "QUEST"] },
  // Crown Keep: Queen Amara's castle, in the middle of the island. Open any
  // time; it has no shard (the Beacon stood on its tower), so `shard: false`.
  // `tier` sets its creature levels like a zone at that spot in the list
  // (see creatureLevel), since it's added at the end.
  { id: "keep", name: "Crown Keep", icon: "👑", dimension: 0, tier: 3, shard: false, map: { x: 43, y: 63 }, letters: ["C", "R", "O", "W", "N"], words: ["CROWN", "CROW", "ROW", "WORN", "CORN"] },
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
  // Meadow
  { id: "puddlepup", name: "Puddlepup", zone: "meadow", kind: "wild", element: "water", moves: [quick("Splash", "💦"), shield("Bubble Wall", "🫧"), big("Puddle Wave", "🌊")] },
  { id: "sproutling", name: "Sproutling", zone: "meadow", kind: "wild", element: "nature", moves: [quick("Leaf Toss", "🍄"), heal("Sunshine", "💚"), big("Seed Storm", "🌧️")] },
  { id: "thistlefox", name: "Thistlefox", zone: "meadow", kind: "wild", element: "nature", moves: [quick("Bite", "🐾"), stun("Prickle", "💤", 3), big("Thistle Pounce", "🦶")] },
  { id: "petalpuff", name: "Petalpuff", zone: "meadow", kind: "wild", element: "nature", moves: [quick("Petal Toss", "🍄"), heal("Pollen Puff", "💚"), big("Blossom Storm", "🌧️")] },
  { id: "frog", name: "Croak King", zone: "meadow", kind: "boss", element: "water", moves: [quick("Splash", "💦"), stun("Croak Shout", "📢"), big("Tongue Lash", "👅", 5)] },
  // Glowshroom Forest (zone id "forest")
  { id: "shroomlet", name: "Shroomlet", zone: "forest", kind: "wild", element: "nature", moves: [quick("Spore Puff", "🍄"), heal("Glow Nap", "💚"), big("Spore Storm", "🌧️")] },
  { id: "mossnout", name: "Mossnout", zone: "forest", kind: "wild", element: "nature", moves: [quick("Snout Bump", "🐾"), shield("Moss Coat", "🛡️"), big("Root Stampede", "🌳")] },
  { id: "lumoth", name: "Lumoth", zone: "forest", kind: "wild", element: "light", moves: [quick("Dust Flutter", "✨"), stun("Glimmer Flash", "💫", 3), big("Moonbeam", "🌟")] },
  { id: "glimmerkit", name: "Glimmerkit", zone: "forest", kind: "wild", element: "light", moves: [quick("Spark Paw", "✨"), stun("Dazzle", "💫", 3), big("Prism Pounce", "🌟", 5)] },
  { id: "owl", name: "Professor Hoot", zone: "forest", kind: "boss", element: "nature", moves: [quick("Peck", "🪶"), heal("Wise Glow", "💚"), big("Hoot Blast", "🦉", 5)] },
  // Magma Canyon (zone id "caves")
  { id: "magmite", name: "Magmite", zone: "caves", kind: "wild", element: "fire", moves: [quick("Ember Toss", "🔥"), shield("Obsidian Shell", "🛡️"), big("Lava Burst", "🌋")] },
  { id: "scorchpup", name: "Scorchpup", zone: "caves", kind: "wild", element: "fire", moves: [quick("Fire Fang", "🔥"), stun("Smoke Bark", "🌫️"), big("Blaze Dash", "💥", 5)] },
  { id: "ashcrow", name: "Ashcrow", zone: "caves", kind: "wild", element: "dark", moves: [quick("Ash Peck", "🪶"), stun("Soot Cloud", "🌫️"), big("Cinder Dive", "🔥")] },
  { id: "obsidrake", name: "Obsidrake", zone: "caves", kind: "wild", element: "rock", moves: [quick("Tail Smash", "🪨"), shield("Glass Scales", "🛡️"), big("Magma Coil", "🌋", 5)] },
  { id: "bat", name: "Magmaw", zone: "caves", kind: "boss", element: "fire", moves: [quick("Magma Bite", "🔥"), stun("Eruption Roar", "📢"), big("Volcano Fury", "🌋", 5)] },
  // Coral Lagoon (zone id "river")
  { id: "coralpuff", name: "Coralpuff", zone: "river", kind: "wild", element: "water", moves: [quick("Bubble Pop", "🫧"), heal("Reef Song", "💚"), big("Coral Wave", "🌊")] },
  { id: "finnow", name: "Finnow", zone: "river", kind: "wild", element: "water", moves: [quick("Fin Slap", "💦"), shield("Bubble Wall", "🫧"), big("Tidal Leap", "🌊")] },
  { id: "shellsnap", name: "Shellsnap", zone: "river", kind: "wild", element: "rock", moves: [quick("Pinch", "🦀"), shield("Shell Up", "🛡️"), big("Crab Crush", "💥")] },
  { id: "jellybop", name: "Jellybop", zone: "river", kind: "wild", element: "water", moves: [quick("Zap Sting", "⚡"), stun("Jelly Wobble", "🌀"), big("Riptide", "🌊")] },
  { id: "octopus", name: "Inkzilla", zone: "river", kind: "boss", element: "water", moves: [quick("Tentacle Slap", "🐙"), stun("Ink Cloud", "🌫️"), big("Eight-Arm Spin", "🌀", 5)] },
  // Haunted Hollow (zone id "castle"), where the Signkeeper Academy stands
  { id: "pumpling", name: "Pumpling", zone: "castle", kind: "wild", element: "fire", moves: [quick("Seed Spit", "🎃"), shield("Pumpkin Rind", "🛡️"), big("Lantern Blast", "🔥")] },
  { id: "boolet", name: "Boolet", zone: "castle", kind: "wild", element: "dark", moves: [quick("Spooky Tap", "👻"), stun("Boo!", "📢", 3), big("Phantom Rush", "🌙")] },
  { id: "candlewick", name: "Candlewick", zone: "castle", kind: "wild", element: "fire", moves: [quick("Wax Flick", "🕯️"), heal("Warm Glow", "💚"), big("Candle Flare", "🔥")] },
  { id: "batcat", name: "Batcat", zone: "castle", kind: "wild", element: "dark", moves: [quick("Night Swipe", "🐾"), stun("Echo Screech", "🔊"), big("Shadow Pounce", "🌙", 5)] },
  { id: "dragon", name: "Gourdgeist", zone: "castle", kind: "boss", element: "dark", moves: [quick("Vine Grab", "🎃"), stun("Haunting Howl", "📢"), big("Jack o' Doom", "🔥", 5)] },
  // Shop pets
  { id: "cat", name: "Whiskers", zone: null, kind: "shop", element: "lightning", price: 60, moves: [quick("Swipe", "🐾"), heal("Catnap", "💚"), big("Pounce Storm", "⚡")] },
  { id: "drake", name: "Drake", zone: null, kind: "shop", element: "fire", price: 150, moves: [quick("Ember", "🔥"), shield("Wing Guard", "🛡️"), big("Inferno", "🔥", 5)] },
  // Crown Keep. Aurelion is Queen Amara's royal gryphon, hexed to guard her keep.
  { id: "squirepup", name: "Squirepup", zone: "keep", kind: "wild", element: "rock", moves: [quick("Shield Bash", "🪨"), shield("Guard Up", "🛡️"), big("Royal Charge", "💥")] },
  { id: "crownling", name: "Crownling", zone: "keep", kind: "wild", element: "light", moves: [quick("Royal Bump", "👑"), heal("Royal Song", "💚"), big("Crown Crash", "💥")] },
  { id: "shieldbug", name: "Shieldbug", zone: "keep", kind: "wild", element: "rock", moves: [quick("Shell Bash", "🪨"), shield("Royal Guard", "🛡️"), big("Crown Charge", "💥")] },
  { id: "griffling", name: "Griffling", zone: "keep", kind: "wild", element: "light", moves: [quick("Peck", "🪶"), heal("Gryphon Song", "💚"), big("Sun Dive", "✨")] },
  { id: "gryphon", name: "Aurelion", zone: "keep", kind: "boss", element: "lightning", moves: [quick("Talon Swipe", "🦅"), stun("Royal Screech", "📢"), big("Sky Sovereign", "⚡", 5)] },
  // Aurora Glacier (zone id "spires")
  { id: "pengling", name: "Pengling", zone: "spires", kind: "wild", element: "ice", moves: [quick("Ice Slide", "❄️"), shield("Snow Coat", "🛡️"), big("Belly Flop", "🌨️")] },
  { id: "icicub", name: "Icicub", zone: "spires", kind: "wild", element: "ice", moves: [quick("Frost Paw", "🐾"), heal("Snow Nap", "💚"), big("Avalanche", "🏔️")] },
  { id: "frostfox", name: "Frostfox", zone: "spires", kind: "wild", element: "ice", moves: [quick("Snowball", "❄️"), shield("Frost Fur", "🛡️"), big("Glacier Dash", "🏔️")] },
  { id: "aurorafin", name: "Aurorafin", zone: "spires", kind: "wild", element: "ice", moves: [quick("Aurora Ray", "✨"), stun("Glimmer Chill", "🥶"), big("Northern Lights", "🌌")] },
  { id: "icewyrm", name: "Aurora Wyrm", zone: "spires", kind: "boss", element: "ice", moves: [quick("Ice Fang", "🧊"), stun("Deep Freeze", "🥶"), big("Blizzard", "🌨️", 5)] },
  // Thunder Peaks (zone id "clouds")
  { id: "nimbling", name: "Nimbling", zone: "clouds", kind: "wild", element: "lightning", moves: [quick("Drizzle", "💧"), stun("Thunder Clap", "📢", 3), big("Downpour", "⚡")] },
  { id: "zipsparrow", name: "Zipsparrow", zone: "clouds", kind: "wild", element: "lightning", moves: [quick("Zip Peck", "⚡"), stun("Static", "📢", 3), big("Thunderdive", "⚡")] },
  { id: "voltkit", name: "Voltkit", zone: "clouds", kind: "wild", element: "lightning", moves: [quick("Spark Nip", "⚡"), stun("Static", "📢", 3), big("Bolt Dash", "⚡", 5)] },
  { id: "thunderam", name: "Thunderam", zone: "clouds", kind: "wild", element: "lightning", moves: [quick("Ram Charge", "💥"), shield("Storm Wool", "🛡️"), big("Thunder Horn", "⚡", 5)] },
  { id: "stormowl", name: "Storm Owl", zone: "clouds", kind: "boss", element: "lightning", moves: [quick("Gust", "🌬️"), shield("Static Shield", "🛡️"), big("Thunder Wing", "⚡", 5)] },
  // Cosmic Rift (zone id "void")
  { id: "starbit", name: "Starbit", zone: "void", kind: "wild", element: "light", moves: [quick("Star Toss", "⭐"), heal("Twinkle", "💚"), big("Supernova", "🌟")] },
  { id: "moonmoth", name: "Moonmoth", zone: "void", kind: "wild", element: "light", moves: [quick("Moon Dust", "🌙"), stun("Lunar Flash", "💫", 3), big("Moonbeam", "🌟")] },
  { id: "nebulynx", name: "Nebulynx", zone: "void", kind: "wild", element: "dark", moves: [quick("Comet Claw", "🐾"), shield("Nebula Cloak", "🛡️"), big("Galaxy Pounce", "🌌", 5)] },
  { id: "voidjelly", name: "Voidjelly", zone: "void", kind: "wild", element: "dark", moves: [quick("Void Sting", "🌑"), stun("Black Hole", "🌀"), big("Abyss Wave", "🌊")] },
  // The final boss. He can't join your team, and isn't in the creature book.
  { id: "malgrath", name: "Malgrath the Hollow King", zone: "void", kind: "boss", element: "dark", catchable: false, moves: [quick("Hollow Bolt", "🌑"), heal("Dark Mend", "💜"), big("Shatter", "💥", 5)] },

  // ⚔️ Raid creatures: one giant legend per zone, fought at its Raid shrine
  // once the zone's boss is beaten (biome.js RAIDS). Huge, and much tougher.
  { id: "raid-meadow", name: "Elderoot the Ancient", zone: "meadow", kind: "raid", element: "nature", catchable: false, moves: [quick("Root Lash", "🌿"), heal("Spring Bloom", "💚"), big("Forest Quake", "🌳", 6)] },
  { id: "raid-forest", name: "Sporemother", zone: "forest", kind: "raid", element: "nature", catchable: false, moves: [quick("Spore Cloud", "🍄"), stun("Dream Dust", "💤"), big("Glow Burst", "✨", 6)] },
  { id: "raid-caves", name: "Pyroclast Colossus", zone: "caves", kind: "raid", element: "fire", catchable: false, moves: [quick("Magma Fist", "🔥"), shield("Obsidian Skin", "🛡️"), big("Eruption", "🌋", 6)] },
  { id: "raid-river", name: "Abyssal Leviathan", zone: "river", kind: "raid", element: "water", catchable: false, moves: [quick("Tidal Bite", "🌊"), stun("Whirlpool", "🌀"), big("Deep Surge", "💦", 6)] },
  { id: "raid-castle", name: "Wraithlord", zone: "castle", kind: "raid", element: "dark", catchable: false, moves: [quick("Grave Chill", "👻"), heal("Soul Feast", "💜"), big("Night Terror", "🌙", 6)] },
  { id: "raid-keep", name: "Crown Colossus", zone: "keep", kind: "raid", element: "rock", catchable: false, moves: [quick("Royal Slam", "👑"), shield("Golden Guard", "🛡️"), big("Kingsfall", "💥", 6)] },
  { id: "raid-spires", name: "Frostwing Empress", zone: "spires", kind: "raid", element: "ice", catchable: false, moves: [quick("Frost Fang", "❄️"), stun("Deep Freeze", "🥶"), big("Aurora Breath", "🌌", 6)] },
  { id: "raid-clouds", name: "Thunderbird Rex", zone: "clouds", kind: "raid", element: "lightning", catchable: false, moves: [quick("Static Talon", "⚡"), stun("Thunderclap", "📢"), big("Sky Splitter", "🌩️", 6)] },
  { id: "raid-void", name: "Nebula Kraken", zone: "void", kind: "raid", element: "dark", catchable: false, moves: [quick("Star Tentacle", "🌠"), heal("Black Hole", "🕳️"), big("Supernova", "💫", 6)] },

  // 🔷 Trial Guardians: one crystal-studded guardian per zone, fought alone at
  // its Trial shrine (biome.js TRIALS). Beating one pays 🔷 Crests, which
  // unlock armor.
  { id: "trial-meadow", name: "Lumen Pegasus", zone: "meadow", kind: "trial", element: "light", catchable: false, moves: [quick("Halo Kick", "✨"), heal("Dawn Glow", "💚"), big("Radiant Charge", "🌟", 5)] },
  { id: "trial-forest", name: "Prism Sphinx", zone: "forest", kind: "trial", element: "nature", catchable: false, moves: [quick("Crystal Claw", "💎"), stun("Riddle Gaze", "💫"), big("Prism Pounce", "🌈", 5)] },
  { id: "trial-caves", name: "Cinder Warden", zone: "caves", kind: "trial", element: "fire", catchable: false, moves: [quick("Ember Wing", "🔥"), shield("Obsidian Ward", "🛡️"), big("Molten Dive", "🌋", 5)] },
  { id: "trial-river", name: "Tidecaller Medusa", zone: "river", kind: "trial", element: "water", catchable: false, moves: [quick("Crystal Sting", "💧"), stun("Tide Lock", "🌀"), big("Riptide Crown", "🌊", 5)] },
  { id: "trial-castle", name: "Lantern Warden", zone: "castle", kind: "trial", element: "dark", catchable: false, moves: [quick("Ghost Flame", "🕯️"), heal("Soul Light", "💜"), big("Lantern Doom", "🎃", 5)] },
  { id: "trial-keep", name: "Gilded Paladin", zone: "keep", kind: "trial", element: "rock", catchable: false, moves: [quick("Gold Strike", "⚔️"), shield("Aegis", "🛡️"), big("Judgment", "👑", 5)] },
  { id: "trial-spires", name: "Glacial Ninetails", zone: "spires", kind: "trial", element: "ice", catchable: false, moves: [quick("Frost Tail", "❄️"), stun("Whiteout", "🥶"), big("Nine Blizzards", "🌨️", 5)] },
  { id: "trial-clouds", name: "Tempest Griffin", zone: "clouds", kind: "trial", element: "lightning", catchable: false, moves: [quick("Volt Talon", "⚡"), stun("Gale Screech", "📢"), big("Storm Dive", "🌩️", 5)] },
  { id: "trial-void", name: "Astral Djinn", zone: "void", kind: "trial", element: "dark", catchable: false, moves: [quick("Star Palm", "🌠"), heal("Wish", "🌟"), big("Cosmic Wish", "💫", 5)] },
  // 🔷 Trial Wardens: they hold the floors of each zone's Trial Tower (tower.js). Only met there.
  { id: "warden-meadow", name: "Petal Knight", zone: "meadow", kind: "warden", element: "nature", catchable: false, moves: [quick("Petal Slash", "🌸"), heal("Pollen Mend", "💚"), big("Bloom Burst", "🌺", 4)] },
  { id: "warden-forest", name: "Glowmoth Sentinel", zone: "forest", kind: "warden", element: "nature", catchable: false, moves: [quick("Wing Gust", "🦋"), stun("Lantern Dust", "💤"), big("Glow Flare", "✨", 4)] },
  { id: "warden-caves", name: "Obsidian Imp", zone: "caves", kind: "warden", element: "fire", catchable: false, moves: [quick("Fork Jab", "🔱"), shield("Obsidian Skin", "🛡️"), big("Cinder Burst", "🔥", 4)] },
  { id: "warden-river", name: "Shellback Sentinel", zone: "river", kind: "warden", element: "water", catchable: false, moves: [quick("Trident Thrust", "🔱"), shield("Clam Guard", "🐚"), big("Riptide", "🌊", 4)] },
  { id: "warden-castle", name: "Phantom Butler", zone: "castle", kind: "warden", element: "dark", catchable: false, moves: [quick("Tray Toss", "🍽️"), stun("Spooky Bow", "👻"), big("Candle Haunt", "🕯️", 4)] },
  { id: "warden-keep", name: "Tower Knight", zone: "keep", kind: "warden", element: "rock", catchable: false, moves: [quick("Lance Jab", "⚔️"), shield("Tower Shield", "🛡️"), big("Royal Charge", "👑", 4)] },
  { id: "warden-spires", name: "Frost Sentinel", zone: "spires", kind: "warden", element: "ice", catchable: false, moves: [quick("Ice Fist", "❄️"), stun("Freezing Glare", "🥶"), big("Avalanche", "🏔️", 4)] },
  { id: "warden-clouds", name: "Storm Herald", zone: "clouds", kind: "warden", element: "lightning", catchable: false, moves: [quick("Zap Feather", "⚡"), stun("Thunder Horn", "📯"), big("Storm Dive", "🌩️", 4)] },
  { id: "warden-void", name: "Star Wraith", zone: "void", kind: "warden", element: "dark", catchable: false, moves: [quick("Star Claw", "🌠"), heal("Nebula Mend", "💜"), big("Supernova", "💥", 4)] },
  // 👑 Tower Ultimates: each Trial Tower's top floor. The toughest fight in the zone.
  { id: "ultimate-meadow", name: "Queen Bloomheart", zone: "meadow", kind: "ultimate", element: "nature", catchable: false, moves: [quick("Thorn Whip", "🌹"), heal("Royal Bloom", "💚"), big("Garden's Wrath", "🌺", 7), stun("Petal Storm", "🌸")] },
  { id: "ultimate-forest", name: "The Mycelium King", zone: "forest", kind: "ultimate", element: "nature", catchable: false, moves: [quick("Root Grab", "🌿"), stun("Spore Haze", "🍄"), big("Fungal Quake", "🌳", 7), heal("Deep Roots", "💚")] },
  { id: "ultimate-caves", name: "Infernus, Lord of Cinders", zone: "caves", kind: "ultimate", element: "fire", catchable: false, moves: [quick("Hellfire Claw", "🔥"), shield("Magma Wings", "🛡️"), big("Cataclysm", "🌋", 7), stun("Brimstone Roar", "📢")] },
  { id: "ultimate-river", name: "Thalassa, Tide Empress", zone: "river", kind: "ultimate", element: "water", catchable: false, moves: [quick("Trident Strike", "🔱"), heal("Tidal Grace", "💙"), big("Tsunami", "🌊", 7), stun("Maelstrom", "🌀")] },
  { id: "ultimate-castle", name: "The Hollow Count", zone: "castle", kind: "ultimate", element: "dark", catchable: false, moves: [quick("Fang Strike", "🦇"), heal("Night Feast", "💜"), big("Midnight Toll", "🔔", 7), stun("Hypnotic Gaze", "👁️")] },
  { id: "ultimate-keep", name: "King Aurelius the Eternal", zone: "keep", kind: "ultimate", element: "rock", catchable: false, moves: [quick("Golden Blade", "⚔️"), shield("Eternal Guard", "🛡️"), big("Crown of Ages", "👑", 7), stun("Royal Decree", "📜")] },
  { id: "ultimate-spires", name: "Glacius, the Frozen Titan", zone: "spires", kind: "ultimate", element: "ice", catchable: false, moves: [quick("Glacier Fist", "🧊"), shield("Permafrost", "🛡️"), big("Ice Age", "❄️", 7), stun("Whiteout", "🌨️")] },
  { id: "ultimate-clouds", name: "Zephyros, Storm Sovereign", zone: "clouds", kind: "ultimate", element: "lightning", catchable: false, moves: [quick("Thunder Talon", "⚡"), stun("Sky Crack", "💫"), big("Tempest", "🌩️", 7), heal("Eye of the Storm", "🌀")] },
  { id: "ultimate-void", name: "Nihil, the Void Emperor", zone: "void", kind: "ultimate", element: "dark", catchable: false, moves: [quick("Star Rend", "🌠"), heal("Event Horizon", "🕳️"), big("Big Crunch", "💥", 7), stun("Thousand Eyes", "👁️")] },
  // 🌀 Rift raid bosses: they come through the Rift in Skyhaven (hub.js), one at a time, now and then.
  // `zone`: where their letters and battlefield come from. Only met there.
  { id: "raid-rift-chronodrake", name: "Chronodrake", zone: "keep", kind: "rift", element: "rock", catchable: false, moves: [quick("Gear Gnash", "⚙️"), shield("Rewind", "⏪"), big("Time Quake", "⏳", 7)] },
  { id: "raid-rift-maw", name: "The Abyssal Maw", zone: "void", kind: "rift", element: "dark", catchable: false, moves: [quick("Devour", "👄"), stun("Dread Stare", "👁️"), big("Swallow the Stars", "🌑", 7)] },
  { id: "raid-rift-hydra", name: "Prism Hydra", zone: "spires", kind: "rift", element: "ice", catchable: false, moves: [quick("Triple Bite", "💎"), heal("Regrow", "💙"), big("Prism Breath", "🌈", 7)] },
  { id: "raid-rift-stag", name: "The Astral Stag", zone: "forest", kind: "rift", element: "light", catchable: false, moves: [quick("Star Antlers", "🦌"), heal("Moonlit Rest", "💛"), big("Constellation Charge", "🌟", 7)] },
  { id: "raid-rift-bloom", name: "Blightbloom", zone: "meadow", kind: "rift", element: "nature", catchable: false, moves: [quick("Chomp", "🌺"), stun("Sleep Pollen", "💤"), big("Overgrowth", "🌿", 7)] },
  { id: "raid-rift-seraph", name: "Voltwing Seraph", zone: "clouds", kind: "rift", element: "lightning", catchable: false, moves: [quick("Halo Zap", "⚡"), shield("Six-Wing Guard", "🛡️"), big("Judgment Bolt", "🌩️", 7)] },
  // ⏳ The top of the Spire of Ages (hub.js, tower.js).
  { id: "spire-keeper", name: "Aeon, Keeper of the Spire", zone: "void", kind: "spirekeeper", element: "light", catchable: false, moves: [quick("Orb Strike", "🔮"), heal("Turn Back Time", "⏳"), big("End of Ages", "💫", 8), stun("Frozen Moment", "⌛")] },
];
for (const c of CREATURES) c.moves[2].element = c.element;

// Group moves (💥 All) hit every foe on the field, at GROUP_POWER of their
// power each. Against a lone foe they hit it at full power.
export const GROUP_POWER = 0.6;
const GROUP_MOVES = new Set([
  "Eight-Arm Spin", "Avalanche", "Blizzard", "Spore Storm", "Inferno", "Pounce Storm", "Echo Screech", "Sky Sovereign",
  "Volcano Fury", "Coral Wave", "Spike Storm", "Northern Lights", "Supernova", "Abyss Wave", "Jack o' Doom", "Root Stampede",
]);
for (const c of CREATURES) for (const mv of c.moves) if (GROUP_MOVES.has(mv.name)) mv.all = true;

// ---------- Evolution ----------
// Buddies evolve twice, like Pokemon: stage 2 at EVOLVE_LEVEL and stage 3 at
// EVOLVE_LEVEL_3. Each stage is a new name, a whole new look (a bigger body,
// new parts like wings, horns, and flames, richer colors - see critters.js
// evolveSpec), harder hits (STAGE_POWER), and a new move (ELEMENT_MOVES).
export const EVOLVE_LEVEL = 5;
export const EVOLVE_LEVEL_3 = 10;
export const stageOf = (level) => (level >= EVOLVE_LEVEL_3 ? 3 : level >= EVOLVE_LEVEL ? 2 : 1);
export const STAGE_POWER = [1, 1.25, 1.6]; // attack power at stages 1, 2, 3
export const stagePower = (level) => STAGE_POWER[stageOf(level) - 1];
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
  shroomlet: "common", mossnout: "common", lumoth: "uncommon", glimmerkit: "rare",
  magmite: "common", scorchpup: "uncommon", ashcrow: "uncommon", obsidrake: "rare",
  coralpuff: "common", finnow: "common", shellsnap: "uncommon", jellybop: "rare",
  pumpling: "common", boolet: "common", candlewick: "uncommon", batcat: "rare",
  squirepup: "common", crownling: "common", shieldbug: "uncommon", griffling: "rare",
  pengling: "common", icicub: "common", frostfox: "uncommon", aurorafin: "rare",
  nimbling: "common", zipsparrow: "common", thunderam: "uncommon", voltkit: "rare",
  starbit: "rare", moonmoth: "rare", nebulynx: "epic", voidjelly: "legendary",
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
  // The new worlds' creatures (Glowshroom Forest, Magma Canyon, Coral Lagoon,
  // Haunted Hollow, Aurora Glacier, Thunder Peaks, Cosmic Rift).
  mossling: "mossnout", barkbeetle: "shroomlet", vinesnap: "glimmerkit", brambling: "shroomlet", snapvine: "lumoth",
  pebblit: "magmite", gemmole: "scorchpup", glowbat: "ashcrow", geodite: "obsidrake",
  bubblet: "finnow", reedcrab: "shellsnap", tidesprite: "jellybop", lilyhop: "coralpuff",
  cinderling: "pumpling", torchbug: "candlewick", kilnlizard: "boolet", drakeling: "batcat",
  prismit: "aurorafin", shiverling: "pengling", puffwing: "zipsparrow",
  shadewisp: "voidjelly", duskwing: "moonmoth", gloomfox: "nebulynx", abyssling: "starbit",
  // Crown Keep came back (it was the Sunstone Desert for a while).
  scarabite: "shieldbug", sphinxie: "griffling", dunehop: "squirepup", cactling: "crownling",
};
export const rarityOf = (c) => RARITIES[c.kind === "boss" || c.kind === "raid" || c.kind === "trial" || c.kind === "warden" || c.kind === "ultimate" || c.kind === "rift" || c.kind === "spirekeeper" ? "boss" : CREATURE_RARITY[c.id] || "common"];

export const EVOLUTIONS = {
  pip: "Lumos", puddlepup: "Puddlehound", sproutling: "Bloomling", thistlefox: "Thornfox", petalpuff: "Bloompuff", frog: "Croak Emperor",
  shroomlet: "Shroomkin", mossnout: "Mossnoot", lumoth: "Lumothra", glimmerkit: "Glimmercat", owl: "Archsage Hoot",
  magmite: "Magmass", scorchpup: "Scorchhound", ashcrow: "Ashraven", obsidrake: "Obsidragon", bat: "Magmawrath",
  coralpuff: "Coralbloom", finnow: "Finnoble", shellsnap: "Shellclaw", jellybop: "Jellyglow", octopus: "Inkzilla Prime",
  pumpling: "Pumpkid", boolet: "Booster", candlewick: "Candlefright", batcat: "Batkitty", dragon: "Grand Gourdgeist",
  squirepup: "Knightpup", crownling: "Crownlord", shieldbug: "Paladin Beetle", griffling: "Gryphling", gryphon: "Sky Monarch",
  pengling: "Penguard", icicub: "Iciclaw", frostfox: "Blizzard Fox", aurorafin: "Aurorafish", icewyrm: "Aurora Dragon",
  nimbling: "Stormling", zipsparrow: "Zapsparrow", voltkit: "Thunderkit", thunderam: "Thunderram", stormowl: "Tempest Owl",
  starbit: "Starbright", moonmoth: "Lunamoth", nebulynx: "Cosmolynx", voidjelly: "Voidjel",
  cat: "Thunderpaws", drake: "Dragonlord",
};
// Third stages.
export const EVOLUTIONS_3 = {
  pip: "Solaris", puddlepup: "Tsunamaw", sproutling: "Verdantree", thistlefox: "Briarking", petalpuff: "Blossom Queen", frog: "Croak Overlord",
  shroomlet: "Mycelord", mossnout: "Mossmammoth", lumoth: "Aurothra", glimmerkit: "Starglimmer", owl: "Grand Sage Hoot",
  magmite: "Magmagolem", scorchpup: "Infernohound", ashcrow: "Phoenix Ash", obsidrake: "Obsidian King", bat: "Magma Titan",
  coralpuff: "Reef Queen", finnow: "Leviafin", shellsnap: "Tideclaw King", jellybop: "Medusa Prime", octopus: "Krakenzilla",
  pumpling: "Jack o' Lord", boolet: "Boo Monarch", candlewick: "Wickwraith", batcat: "Nightpanther", dragon: "Pumpking",
  squirepup: "Paladog", crownling: "High Monarch", shieldbug: "Aegis Beetle", griffling: "Grand Gryphon", gryphon: "Sky Emperor",
  pengling: "Emperor Frost", icicub: "Glacier Bear", frostfox: "Glacier Fox", aurorafin: "Borealis Ray", icewyrm: "Borealis King",
  nimbling: "Tempestorm", zipsparrow: "Thunderhawk", voltkit: "Voltiger", thunderam: "Storm Titan", stormowl: "Storm Sovereign",
  starbit: "Supernova", moonmoth: "Eclipse Moth", nebulynx: "Galaxian", voidjelly: "Abyssal Medusa",
  cat: "Stormlion", drake: "Elder Dragon",
};
export const isEvolved = (level) => stageOf(level) > 1;
// A buddy's name at a given level.
export const creatureName = (id, level = 1) => {
  const c = CREATURES.find((x) => x.id === id);
  const stage = stageOf(level);
  if (stage === 3 && EVOLUTIONS_3[id]) return EVOLUTIONS_3[id];
  return stage >= 2 && EVOLUTIONS[id] ? EVOLUTIONS[id] : c.name;
};

// Evolving teaches a buddy a new move of its element: one at stage 2, and an
// ultimate at stage 3 (which hits every foe).
const mv = (name, icon, element, cost, power, all = false) => ({ name, icon, type: "attack", cost, power, element, all });
export const ELEMENT_MOVES = {
  fire: [mv("Flame Wheel", "🔥", "fire", 5, 3), mv("Inferno Nova", "💥", "fire", 9, 5.5, true)],
  water: [mv("Aqua Jet", "💦", "water", 5, 3), mv("Tsunami", "🌊", "water", 9, 5.5, true)],
  nature: [mv("Vine Lash", "🌿", "nature", 5, 3), mv("Forest Fury", "🌳", "nature", 9, 5.5, true)],
  lightning: [mv("Thunder Fang", "⚡", "lightning", 5, 3), mv("Storm Call", "🌩️", "lightning", 9, 5.5, true)],
  ice: [mv("Ice Lance", "❄️", "ice", 5, 3), mv("Absolute Zero", "🧊", "ice", 9, 5.5, true)],
  rock: [mv("Stone Edge", "🪨", "rock", 5, 3), mv("Earthquake", "💥", "rock", 9, 5.5, true)],
  light: [mv("Radiant Ray", "✨", "light", 5, 3), mv("Starfall", "🌟", "light", 9, 5.5, true)],
  dark: [mv("Shadow Claw", "🌑", "dark", 5, 3), mv("Eclipse Burst", "🌑", "dark", 9, 5.5, true)],
};
// A buddy's moves at its level: its own 3, plus what evolving taught it.
export function buddyMoves(id, level) {
  const c = CREATURES.find((x) => x.id === id);
  const extra = ELEMENT_MOVES[c.element] || [];
  return [...c.moves, ...extra.slice(0, stageOf(level) - 1)];
}

export const STARTER_CREATURE = "pip";
export const TEAM_SIZE = 2; // buddies that fight beside you

// ---------- Moves and energy ----------
// Each turn you pick one move, then sign the target to fire it. Signing is
// what charges your energy, so bigger moves have to be earned by signing.
// Spark is free, so you can never get stuck.
// Your hero's spells: the cards in your spellbook. Spark and Blast you always
// know. Each of the others is taught by one zone's boss (`zone`), and only
// that boss: you learn Frost Lance by beating the Aurora Glacier's boss, no
// matter how many other bosses you've beaten. Your armor adds its own spell
// (ARMOR `spell`); Haunted Hollow's and the Cosmic Rift's bosses teach theirs
// through their armor.
export const HERO_SPELLS = [
  { id: "spark", name: "Spark", icon: "✨", cost: 0, power: 1, zone: null },
  { id: "blast", name: "Blast", icon: "💥", cost: 3, power: 2, element: "fire", zone: null },
  { id: "leafstorm", name: "Leaf Storm", icon: "🌿", cost: 6, power: 3.2, element: "nature", all: true, zone: "meadow" },
  { id: "nova", name: "Nova", icon: "🌟", cost: 6, power: 3.5, element: "light", all: true, zone: "forest" },
  { id: "meteor", name: "Meteor", icon: "☄️", cost: 9, power: 6, element: "rock", zone: "caves" },
  { id: "tidal", name: "Tidal Wave", icon: "🌊", cost: 7, power: 4, element: "water", all: true, zone: "river" },
  { id: "frost", name: "Frost Lance", icon: "❄️", cost: 6, power: 4.2, element: "ice", zone: "spires" },
  { id: "thunder", name: "Thunder Call", icon: "⚡", cost: 7, power: 4.6, element: "lightning", zone: "clouds" },
];
export const HERO_MOVES = HERO_SPELLS.filter((sp) => !sp.zone); // always known
// 🗼 Spells taught by the Trial Towers (tower.js): beat a tower's boss floors
// (the Guardian on floors 5 and 10, the Ultimate on 15) to learn them.
// `tower`: the zone, `floor`: the floor that teaches it.
const towerSpell = (tower, floor, id, name, icon, cost, power, element, all = false) => ({ id, name, icon, cost, power, element, all, tower, floor });
export const TOWER_SPELLS = [
  towerSpell("meadow", 5, "bramble", "Bramble Lash", "🌱", 5, 3.6, "nature"),
  towerSpell("meadow", 10, "petalstorm", "Petal Tempest", "🌸", 7, 4.6, "nature", true),
  towerSpell("meadow", 15, "bloomwrath", "Bloomheart's Wrath", "🌺", 10, 9, "nature"),
  towerSpell("forest", 5, "glowburst", "Glowcap Burst", "🍄", 5, 3.6, "nature"),
  towerSpell("forest", 10, "moonbeam", "Moonmoth Beam", "🦋", 7, 5, "light"),
  towerSpell("forest", 15, "mycelsurge", "Mycelium Surge", "🌳", 10, 7.5, "nature", true),
  towerSpell("caves", 5, "cinderfork", "Cinder Fork", "🔱", 5, 3.6, "fire"),
  towerSpell("caves", 10, "obsidianrain", "Obsidian Rain", "🌋", 7, 4.6, "rock", true),
  towerSpell("caves", 15, "infernoflame", "Infernus Flame", "🔥", 10, 9, "fire"),
  towerSpell("river", 5, "shellshot", "Shell Shot", "🐚", 5, 3.6, "water"),
  towerSpell("river", 10, "tridenttide", "Trident Tide", "🔱", 7, 5, "water"),
  towerSpell("river", 15, "tsunami", "Empress Tsunami", "🌊", 10, 7.5, "water", true),
  towerSpell("castle", 5, "candlecurse", "Candle Curse", "🕯️", 5, 3.6, "dark"),
  towerSpell("castle", 10, "batswarm", "Bat Swarm", "🦇", 7, 4.6, "dark", true),
  towerSpell("castle", 15, "midnighttoll", "Midnight Toll", "🔔", 10, 9, "dark"),
  towerSpell("keep", 5, "lancecharge", "Lance Charge", "⚔️", 5, 3.6, "rock"),
  towerSpell("keep", 10, "royalsmite", "Royal Smite", "🛡️", 7, 5, "light"),
  towerSpell("keep", 15, "crownofages", "Crown of Ages", "👑", 10, 7.5, "light", true),
  towerSpell("spires", 5, "icefist", "Ice Fist", "🧊", 5, 3.6, "ice"),
  towerSpell("spires", 10, "blizzard", "Blizzard", "🌨️", 7, 4.6, "ice", true),
  towerSpell("spires", 15, "absolutezero", "Absolute Zero", "❄️", 10, 9, "ice"),
  towerSpell("clouds", 5, "staticfeather", "Static Feather", "🪶", 5, 3.6, "lightning"),
  towerSpell("clouds", 10, "chainlightning", "Chain Lightning", "⚡", 7, 4.6, "lightning", true),
  towerSpell("clouds", 15, "tempestfury", "Tempest Fury", "🌩️", 10, 9, "lightning"),
  towerSpell("void", 5, "starshard", "Star Shard", "🌠", 5, 3.6, "dark"),
  towerSpell("void", 10, "nebulaburst", "Nebula Burst", "🌌", 7, 4.6, "light", true),
  towerSpell("void", 15, "bigbang", "Big Bang", "💥", 10, 7.5, "dark", true),
];
// Armor: beat a zone's boss to win its armor set, then wear it in the Hero
// screen. Each one changes how your hero looks (`style` and `colors`), gives
// a bonus (`hp` and `power` multiply, `crit` adds), and teaches a spell.
// Armor sets: bought with 🔷 Crests (`crests`), won from Trial Guardians.
export const ARMOR = [
  { id: "tunic", name: "Traveler's Clothes", zone: null, icon: "👕", perk: "Your own outfit", style: null },
  { id: "bloom", name: "Bloom Guard", zone: "meadow", crests: 4, icon: "🌼", perk: "10% more HP", hp: 1.1, style: "ranger",
    colors: { R: "#5aa848", r: "#3c7a34", T: "#ffd84a", G: "#f08cb0", g: "#c8607a" }, spell: { id: "petal", name: "Petal Storm", icon: "🌸", cost: 5, power: 2.8, element: "nature", all: true } },
  { id: "ranger", name: "Glowcap Mail", zone: "forest", crests: 6, icon: "🍄", perk: "More critical hits", crit: 0.08, style: "ranger",
    colors: { R: "#5a4a8a", r: "#3a2e6a", T: "#7fe3ff", G: "#7fe3ff", g: "#3fb0d0" }, spell: { id: "arrows", name: "Spore Arrows", icon: "🏹", cost: 6, power: 3, element: "nature", all: true } },
  { id: "crystal", name: "Obsidian Plate", zone: "caves", crests: 8, icon: "🌋", perk: "20% more HP", hp: 1.2, style: "armor",
    colors: { R: "#3a2a2e", r: "#241a1e", T: "#ff8a2a", G: "#ffd23f", g: "#ff6a2a" }, spell: { id: "crystalcrash", name: "Lava Crash", icon: "🌋", cost: 6, power: 3.5, element: "fire" } },
  { id: "tide", name: "Coral Scale", zone: "river", crests: 10, icon: "🐚", perk: "10% more power, 10% more HP", hp: 1.1, power: 1.1, style: "armor",
    colors: { R: "#3a8ad0", r: "#22609a", T: "#7fe3ff", G: "#e8fbff", g: "#7fe3ff" }, spell: { id: "riptide", name: "Riptide", icon: "🌀", cost: 5, power: 3, element: "water" } },
  { id: "ember", name: "Phantom Plate", zone: "castle", crests: 12, icon: "🎃", perk: "15% more power", power: 1.15, style: "armor",
    colors: { R: "#4a3a5e", r: "#2e2240", T: "#f08a24", G: "#f08a24", g: "#c0601a" }, spell: { id: "dragonflame", name: "Jack o' Blast", icon: "🎃", cost: 7, power: 4, element: "dark" } },
  { id: "royal", name: "Royal Armor", zone: "keep", crests: 14, icon: "👑", perk: "25% more HP", hp: 1.25, style: "armor",
    colors: { R: "#e0dcea", r: "#a8a0bc", T: "#ffd23f", G: "#6a4bd6", g: "#4a2fa8" }, spell: { id: "decree", name: "Royal Decree", icon: "👑", cost: 7, power: 3.5, element: "light", all: true } },
  { id: "frost", name: "Aurora Plate", zone: "spires", crests: 16, icon: "🧊", perk: "20% more HP, more critical hits", hp: 1.2, crit: 0.05, style: "armor",
    colors: { R: "#bfe8ff", r: "#7fb8e0", T: "#ffffff", G: "#7fe3ff", g: "#3fa8d0" }, spell: { id: "glacier", name: "Glacier Spike", icon: "🧊", cost: 7, power: 4, element: "ice" } },
  { id: "storm", name: "Thunder Mail", zone: "clouds", crests: 18, icon: "⚡", perk: "10% more power, more critical hits", power: 1.1, crit: 0.1, style: "ranger",
    colors: { R: "#e8b84a", r: "#b88a2a", T: "#7fe3ff", G: "#fff27a", g: "#e0b82a" }, spell: { id: "skybolt", name: "Sky Bolt", icon: "🌩️", cost: 7, power: 4.2, element: "lightning" } },
  { id: "void", name: "Cosmic Plate", zone: "void", crests: 22, icon: "🪐", perk: "25% more power, 10% more HP", power: 1.25, hp: 1.1, style: "armor",
    colors: { R: "#3a2860", r: "#241848", T: "#c58cf0", G: "#c58cf0", g: "#8a5ad6" }, spell: { id: "voidrift", name: "Cosmic Burst", icon: "🪐", cost: 9, power: 5, element: "dark", all: true } },
];
export const armorById = (id) => ARMOR.find((a) => a.id === id) || ARMOR[0];
// Your spells, having beaten the bosses of `beatenZones` (zone ids), wearing `armorId`.
// `towerSpells`: ids of the Trial Tower spells you've learned (progress.towerSpells).
export function heroSpells(beatenZones, armorId, towerSpells = []) {
  const spells = [...HERO_SPELLS.filter((sp) => !sp.zone || beatenZones.includes(sp.zone)), ...TOWER_SPELLS.filter((sp) => towerSpells.includes(sp.id))];
  const armor = armorById(armorId);
  return armor.spell ? [...spells, armor.spell] : spells;
}
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
export const COUNTER_MS = 7000; // how long you have: time to read the sign, then make it (Assist mode: no time limit)
export const COUNTER_EASE = 0.15; // counters accept a sign this much less sure than normal (you're signing under pressure)
export const COUNTER_REFLECT = 1.2; // bounced back at the creature when you sign it, in letters' worth of damage

// Damage is in HP points. Each letter you sign deals SIGN_DAMAGE (times your
// move's power). Only one character acts each turn: the one whose move you pick.
export const SIGN_DAMAGE = 10;
// A buddy's attack moves hit like your signing, and get stronger as it levels up.
export const buddyMoveBoost = (level) => 1 + (level - 1) * 0.08;
// When a wild creature attacks, its quick move does a bit less than normal and
// its signature move a lot more. It can only use its signature from turn 2.
export const ENEMY_QUICK_DAMAGE = 1.1;
export const ENEMY_BIG_DAMAGE = 1.9;
export const ENEMY_BIG_CHANCE = 0.3;
export const ENEMY_HEAL_FRACTION = 0.12;
export const CRIT_CHANCE = 0.1; // normal chance of a critical hit
export const CRIT_CHANCE_FAST = 0.35; // when you signed fast without a hint
export const CRIT_MULTIPLIER = 1.5;
export const BUDDY_MAX_LEVEL = 15;
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
// Cosmic Rift boss level 50.
export const creatureLevel = (zoneIndex, area) => 1 + (ZONES[zoneIndex].tier ?? zoneIndex) * BIOME_AREAS + area;
export const GUARD_EXTRA_LEVELS = 1;
export const BOSS_EXTRA_LEVELS = 3;
// Stronger monsters hit harder...
export const monsterDamage = (level) => 7 + Math.round(level * 0.6);
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
  zoom: 1, // how much of a zone you see while exploring: 0.75 close up ... 1.5 far out (biome.js ZOOMS)
  minConfidence: 0.6, // how sure the recognizer must be that it's the target letter
  hand: "auto", // "auto" | "right" | "left" - which hand the player signs with
  recognizer: "auto", // "auto" | "model" | "knn" | "keyboard"
  narration: true, // a narrator voice (and a drone) in cinematics; captions always show
  music: true, // chiptune music on every screen (music.js)
};

// Turn-based battles: after each of your turns (one letter or one whole
// word), the monster attacks back - unless you signed fast without a hint,
// which leaves it too dizzy to attack. Damage and HP scale with levels above.
export const BOSS_EXTRA_DAMAGE = 6;
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
//   chain  - "what comes after K?": sign the next letter of the alphabet
//   spell  - Word Blast: spell a whole word instead, for a big hit (SPELL_BONUS)
//   flurry - sign as many letters as you can in FLURRY_MS; each one adds to the hit
// Harder challenges, done without a hint, hit harder.
export const CHALLENGE_CHANCE = { riddle: 0.12, blank: 0.12, quick: 0.12, chain: 0.12, spell: 0.1, flurry: 0.1 };
export const SPELL_BONUS = 1.5;
export const FLURRY_MS = 10000;
export const CHALLENGE_BONUS = 1.4; // riddle and blank
export const QUICK_MS = 4000;
export const QUICK_BONUS = 2;

// ---------- Trainers ----------
// Trainers stand by the path. Walk up to one and they ask if you want to
// battle (you can say not now); then they battle you with a team of 2-3
// creatures. Beat them for prize coins. Each one battles you once.
export const TRAINER_PRIZE = (level) => 20 + level * 3;
export const TRAINER_HP = 0.6; // each trainer creature has this much of a wild one's HP
// Packs: wild creatures often come in twos and threes, so you pick who to hit
// (or hit them all with a group move). Each pack member has PACK_HP of a lone
// creature's HP. Chances by area: [two, three] in the first area, more later.
export const PACK_CHANCE = [[0.3, 0.05], [0.4, 0.12], [0.45, 0.18], [0.5, 0.22], [0.5, 0.28], [0.5, 0.3]];
export const PACK_HP = 0.55;
// At half health a boss surges, and calls in two helpers (MINION_HP each).
export const MINION_HP = 0.35;
// Some turns, a second foe attacks too: a boss with helpers out, or a pack of three.
export const PACK_EXTRA_ATTACK = 0.4;

export const SMOOTH_FRAMES = 4; // predictions averaged over this many frames (more = steadier but slower)
export const HINT_AFTER_MS = 8000; // hint glows after this long on one letter
export const SKIP_AFTER_MS = 16000; // skip button appears after this long
