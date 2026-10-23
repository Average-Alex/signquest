// Pixel-art sprites: hero maker parts, hats, pets, potions, monsters, and
// world map landmarks.
//
// Each sprite is drawn as text: one character per pixel, looked up in a
// palette ("." is see-through). Most sprites are symmetric, so only the left
// half is written and it's mirrored to make the right half. Sprites are
// painted once onto a canvas and shown as <img> tags scaled up with
// `image-rendering: pixelated`, so they stay crisp at any size.

import { buildCritter, CRITTERS, evolveSpec } from "./critters.js";
import { BEASTS, buildBeast, STAGE_FEATS } from "./beasts.js";
import { PAINTED as PAINTED_ART } from "./painted.js";
import { armorById, CREATURES } from "./config.js";

const OUTLINE = "#2b1d2e";

// Mirror each half-row: "..KH" -> "..KHHK..".
const mirror = (rows) => rows.map((r) => r + [...r].reverse().join(""));

// ---------- Heroes ----------
// Players build their own hero from a "look": hair style and color, skin,
// eyes, outfit style and color, weapon, glasses. The body is drawn first,
// then hair, glasses, weapon, and hat on top. 16 x 24 body on a 20 x 30
// canvas: 6 rows above for tall hats and 2 columns each side for weapons.

const HEAD = mirror([
  "........",
  "........",
  "....KKKK",
  "..KKSSSS",
  ".KSSSSSS",
  ".KSSSSSS",
  ".KSSSSSS",
  ".KSSSSSS",
  ".KSSEBSS",
  ".KSSBBSS",
  ".KSSBBSS",
  ".KScSSSS",
  ".KsSSSSK",
  "..KsSSSS",
  "...KKKKK",
]);

const OUTFIT_ROWS = {
  robe: mirror([
    "...KRRTT",
    "..KRRRRT",
    ".KSKRRRT",
    ".KSKRRRR",
    "..KKrRRR",
    "..KrrRRR",
    "..KKKKKK",
    "....KPPK",
    "....KKKK",
  ]),
  tunic: mirror([
    "...KRRTT",
    "..KRRRRR",
    ".KSKRRRR",
    ".KSKrRRR",
    "..KKTTTT",
    "...KrRRR",
    "...KPPK.",
    "...KPPK.",
    "...KKKK.",
  ]),
  // Fighter: steel shoulder plates, belt, and boots over a tabard.
  armor: mirror([
    "..KMMRRT",
    ".KMmMRRR",
    ".KSKMRRR",
    ".KSKmRRR",
    "..KKMMMM",
    "...KrRRR",
    "...KMMK.",
    "...KmMK.",
    "...KKKK.",
  ]),
  // Healer: a long white robe with colored trim down the front.
  cleric: mirror([
    "...KAATT",
    "..KAAAAR",
    ".KSKAAAR",
    ".KSKAAAR",
    "..KKaAAR",
    "..KaAAAR",
    "..KKKKKK",
    "....KPPK",
    "....KKKK",
  ]),
  // Archer: a short cape over the shoulders, leather belt and boots.
  ranger: mirror([
    "..KTTRRR",
    ".KTTRRRR",
    ".KSKRRRR",
    ".KSKrRRR",
    "..KKbbbb",
    "...KrRRR",
    "...KbbK.",
    "...KbbK.",
    "...KKKK.",
  ]),
  // Monk: a wrap-over gi with a dark belt and bare feet.
  gi: mirror([
    "...KRRSS",
    "..KRRRRS",
    ".KSKRRRR",
    ".KSKrRRR",
    "..KKkkkk",
    "...KPPPP",
    "...KPPK.",
    "...KSSK.",
    "...KKKK.",
  ]),
};

// Hair is drawn over the head; "." leaves the head showing.
const HAIR_ROWS = {
  short: mirror([
    "......KK",
    "....KKHH",
    "...KHHHH",
    "..KHHHHH",
    ".KHHHHhH",
    ".KHHhHHH",
    ".KH..HH.",
    "KH......",
    "KH......",
    "KH......",
    "KH......",
  ]),
  spiky: mirror([
    "...K...K",
    "...KK.KH",
    "..KHHKHH",
    "..KHHHHH",
    ".KHHHhHH",
    ".KHhHHHH",
    ".KHH.HH.",
    ".KH.....",
  ]),
  long: mirror([
    "......KK",
    "....KKHH",
    "...KHHHH",
    "..KHHHHH",
    ".KHHHHHH",
    ".KHHhHHH",
    "KHHH.HH.",
    "KHH.....",
    "KHH.....",
    "KHH.....",
    "KHH.....",
    "KHh.....",
    "KHhK....",
    "KHhK....",
    ".KHK....",
    ".KK.....",
  ]),
  bun: mirror([
    ".....KKK",
    "....KHHH",
    "....KHHh",
    "..KKKHHH",
    ".KHHHHHH",
    ".KHHhHHH",
    ".KH.....",
    ".KH.....",
  ]),
  curly: mirror([
    "....KKKK",
    "..KKHHhH",
    ".KHHhHHH",
    "KHhHHHHh",
    "KHHHHhHH",
    "KHhHHHHH",
    "KHHH.H..",
    "KHH.....",
    "KHH.....",
    ".KH.....",
    ".KH.....",
  ]),
  bald: [],
};

const GLASSES_ROWS = {
  none: [],
  round: mirror([
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
    "..KKKKK.",
    "..K...KK",
    "..K...K.",
    "..K...K.",
    "..KKKKK.",
  ]),
};

// Weapons, held in the hero's right hand (the viewer's right). `x`, `y` is
// where each is drawn on the 20 x 30 hero canvas. The gem, crossguard and
// shield emblem take the outfit's colors.
const WEAPONS = {
  wand: {
    x: 15, y: 12,
    rows: [
      ".K.",
      "KGK",
      "KgK",
      ".K.",
      ".W.", ".W.", ".W.", ".W.", ".W.", ".W.", ".W.", ".W.", ".W.", ".W.", ".K.",
    ],
  },
  staff: {
    x: 14, y: 3,
    rows: [
      ".KKK.",
      "KGGgK",
      "KGgGK",
      "KgGGK",
      ".KKK.",
      ...Array(21).fill("..W.."),
      "..K..",
    ],
  },
  sword: {
    x: 14, y: 9,
    rows: [
      "..K..",
      ".KMK.",
      ".KMK.",
      ".KMK.",
      ".KMK.",
      ".KMK.",
      ".KMK.",
      ".KmK.",
      ".KmK.",
      "KKKKK",
      "KTTTK",
      "KKKKK",
      ".KWK.",
      ".KWK.",
      ".KTK.",
      "..K..",
    ],
    // ...and a shield on the other arm.
    shield: {
      x: 0, y: 20,
      rows: [
        "KKKKKK",
        "KMTTMK",
        "KMTTMK",
        "KMMMMK",
        ".KMmK.",
        "..KK..",
      ],
    },
  },
  bow: {
    x: 15, y: 15,
    rows: [
      "KK...",
      "KbK..",
      "y.bK.",
      "y..bK",
      "y..bK",
      "y..bK",
      "y..bK",
      "y..bK",
      "y..bK",
      "y.bK.",
      "KbK..",
      "KK...",
    ],
  },
  fists: { x: 0, y: 0, rows: [] },
};

const HERO_BASE = {
  K: OUTLINE, E: "#ffffff", c: "#f29aa6", W: "#8a5a32", P: "#3d3352",
  M: "#d4d8e4", m: "#8a90a4", A: "#f6f2ea", a: "#cfc6da", b: "#7a4a22", k: "#2a2433", y: "#e8e0d0",
};

// Everything the hero maker offers. `color` is what the swatch button shows.
export const LOOK_OPTIONS = {
  hairStyle: {
    label: "Hair",
    choices: { short: { name: "Short" }, spiky: { name: "Spiky" }, long: { name: "Long" }, bun: { name: "Bun" }, curly: { name: "Curly" }, bald: { name: "None" } },
  },
  hair: {
    label: "Hair color",
    choices: {
      black: { name: "Black", H: "#2d2a3a", h: "#16141f" },
      brown: { name: "Brown", H: "#8a5426", h: "#5e3416" },
      blonde: { name: "Blonde", H: "#ffd54a", h: "#d9a520" },
      ginger: { name: "Ginger", H: "#e8743a", h: "#b8501e" },
      white: { name: "White", H: "#f2f0f5", h: "#c8c4d4" },
      pink: { name: "Pink", H: "#ff7fc8", h: "#d9509f" },
      blue: { name: "Blue", H: "#4fa8ff", h: "#2f6bd0" },
      purple: { name: "Purple", H: "#a06ae0", h: "#6e3fb0" },
      green: { name: "Green", H: "#5cd65a", h: "#2f9a3a" },
    },
  },
  skin: {
    label: "Skin",
    choices: {
      s1: { name: "Skin 1", S: "#ffe0c4", s: "#efbf9c" },
      s2: { name: "Skin 2", S: "#f6c9a0", s: "#d9a37a" },
      s3: { name: "Skin 3", S: "#e0a878", s: "#c08658" },
      s4: { name: "Skin 4", S: "#c98d5d", s: "#a46d42" },
      s5: { name: "Skin 5", S: "#8f5a36", s: "#6e4226" },
      s6: { name: "Skin 6", S: "#5e3a22", s: "#45291a" },
    },
  },
  eyes: {
    label: "Eyes",
    choices: {
      blue: { name: "Blue", B: "#2f6be0" },
      brown: { name: "Brown", B: "#5a3a1e" },
      green: { name: "Green", B: "#3a8f3a" },
      gray: { name: "Gray", B: "#6b7280" },
      purple: { name: "Purple", B: "#7b4fe0" },
    },
  },
  outfitStyle: {
    label: "Outfit",
    choices: {
      robe: { name: "Robe" }, tunic: { name: "Tunic" }, armor: { name: "Armor" },
      ranger: { name: "Ranger" }, cleric: { name: "Cleric" }, gi: { name: "Gi" },
    },
  },
  weapon: {
    label: "Weapon",
    choices: { wand: { name: "Wand" }, staff: { name: "Staff" }, sword: { name: "Sword" }, bow: { name: "Bow" }, fists: { name: "None" } },
  },
  outfit: {
    label: "Outfit color",
    choices: {
      purple: { name: "Purple", R: "#6a4bd6", r: "#4a2fa8", T: "#f5c542", G: "#7fe3ff", g: "#2fa9d6" },
      blue: { name: "Blue", R: "#2f86c9", r: "#1d5f94", T: "#ffe066", G: "#fff27a", g: "#e0b82a" },
      green: { name: "Green", R: "#3f9a4a", r: "#276b31", T: "#d9b25a", G: "#a6f07a", g: "#4fbf3a" },
      red: { name: "Red", R: "#d6453d", r: "#9a2a24", T: "#ffe066", G: "#ffb36b", g: "#e0782a" },
      orange: { name: "Orange", R: "#f08a24", r: "#b85f12", T: "#fff2a8", G: "#ff7a8a", g: "#d64f63" },
      teal: { name: "Teal", R: "#2fb3a6", r: "#1d7a72", T: "#f5c542", G: "#c58cf0", g: "#8a5ad6" },
      pink: { name: "Pink", R: "#ff7fb0", r: "#d64f86", T: "#ffffff", G: "#7fe3ff", g: "#2fa9d6" },
      silver: { name: "Silver", R: "#8fa3c2", r: "#5f7394", T: "#e04848", G: "#ff8a8a", g: "#d63a3a" },
      black: { name: "Black", R: "#3a3448", r: "#24202e", T: "#c58cf0", G: "#c58cf0", g: "#8a5ad6" },
    },
  },
  glasses: {
    label: "Glasses",
    choices: { none: { name: "None" }, round: { name: "Glasses" } },
  },
};

// Starting looks. The first is the default for new players.
export const PRESET_LOOKS = {
  mage: { hairStyle: "short", hair: "pink", skin: "s1", eyes: "blue", outfitStyle: "robe", outfit: "purple", glasses: "none", weapon: "wand" },
  ranger: { hairStyle: "long", hair: "brown", skin: "s4", eyes: "brown", outfitStyle: "tunic", outfit: "green", glasses: "none", weapon: "bow" },
  knight: { hairStyle: "spiky", hair: "blonde", skin: "s2", eyes: "green", outfitStyle: "tunic", outfit: "silver", glasses: "none", weapon: "sword" },
  storm: { hairStyle: "curly", hair: "black", skin: "s6", eyes: "brown", outfitStyle: "robe", outfit: "blue", glasses: "round", weapon: "staff" },
};

// Old saves stored a hero emoji, then a preset id.
const OLD_HEROES = { "🧙": "mage", "🧝": "ranger", "🦸": "knight", "🧚": "storm" };

// Any saved look (or old hero) -> a complete, valid look.
export function normalizeLook(look, oldCharacter) {
  const base = PRESET_LOOKS[OLD_HEROES[oldCharacter] || oldCharacter] || PRESET_LOOKS.mage;
  const out = {};
  for (const [part, { choices }] of Object.entries(LOOK_OPTIONS)) {
    out[part] = look && choices[look[part]] ? look[part] : base[part];
  }
  return out;
}

// `rand`: pass a seeded random function to get the same look every time.
export function randomLook(rand = Math.random) {
  const pick = (obj) => {
    const keys = Object.keys(obj);
    return keys[Math.floor(rand() * keys.length)];
  };
  const look = {};
  for (const [part, { choices }] of Object.entries(LOOK_OPTIONS)) look[part] = pick(choices);
  if (rand() < 0.7) look.glasses = "none";
  if (look.hairStyle === "bald" && rand() < 0.7) look.hairStyle = "short";
  return look;
}

// ---------- Hats (drawn on the hero canvas at row `top`) ----------

const HATS = {
  "hat-cap": {
    top: 3,
    colors: { C: "#e04848", c: "#a82e2e", w: "#ffffff" },
    rows: mirror([
      "....KKKK",
      "..KKCCCC",
      ".KCCCCCC",
      ".KCCCCww",
      "KKKKKKKK",
      "Kccccccc",
      ".KKKKKKK",
    ]),
  },
  "hat-top": {
    top: 0,
    colors: { D: "#2e2a3d", d: "#4a4560", R: "#c23b5a" },
    rows: mirror([
      "...KKKKK",
      "...KDdDD",
      "...KDdDD",
      "...KDDDD",
      "...KRRRR",
      "...KRRRR",
      ".KKKKKKK",
      ".KDDDDDD",
      "..KKKKKK",
    ]),
  },
  "hat-grad": {
    top: 3,
    colors: { D: "#2e2a3d", d: "#4a4560", Y: "#f5c542" },
    rows: mirror([
      "......KY",
      "....KKDD",
      "..KKdDDD",
      "KKdDDDDD",
      "..KKDDDD",
      "...KDDDD",
      "...KKKKK",
    ]),
  },
  "hat-crown": {
    top: 4,
    colors: { Y: "#f5c542", y: "#c99418", r: "#e04848", G: "#4fb3ff" },
    rows: mirror([
      "...K..KK",
      "..KYKKYY",
      "..KYYYYY",
      "..KYrYYG",
      "..KyyYYY",
      "..KKKKKK",
    ]),
  },
};

// ---------- Pets (12 x 12) ----------

const PETS = {
  "pet-cat": {
    colors: { O: "#f29a3a", o: "#c96f1c", G: "#7ad15a", n: "#f28aa0" },
    rows: mirror([
      ".K....",
      "KOK...",
      "KOOKKK",
      "KOOOOO",
      "KOGKOO",
      "KOOOOO",
      "KOOOOn",
      ".KOOOO",
      "..KOOO",
      ".KOOOO",
      ".KOoKO",
      ".KKKKK",
    ]),
  },
  "pet-dog": {
    colors: { D: "#c98a4e", d: "#7a4a24", w: "#fbe8d0" },
    rows: mirror([
      "...KKK",
      "KKKDDD",
      "KddDDD",
      "KddKDD",
      "KddDDD",
      ".KDDwK",
      "..KDww",
      "..KDDD",
      ".KDDDD",
      ".KDDDD",
      ".KDKDD",
      ".KKKKK",
    ]),
  },
  "pet-bunny": {
    colors: { W: "#f7f4f0", p: "#f5a3b8", w: "#d8d2cc" },
    rows: mirror([
      "..K...",
      ".KWK..",
      ".KpK..",
      ".KpK..",
      ".KWKKK",
      "KWWWWW",
      "KWKWWW",
      "KWWWWp",
      ".KWWWW",
      "KwWWWW",
      "KwWKWW",
      ".KKKKK",
    ]),
  },
  "pet-unicorn": {
    colors: { W: "#f7f4f0", Y: "#f5c542", P: "#c58cf0", M: "#ff7fc8", n: "#f5a3b8" },
    rows: mirror([
      ".....K",
      "....KY",
      "....KY",
      ".K.KYY",
      "KPKKKK",
      "KWWWWW",
      "KWKWWW",
      "KWWWWW",
      "KMWWWW",
      "KMWWWn",
      ".KMWWW",
      "..KKKK",
    ]),
  },
  "pet-dragon": {
    colors: { g: "#4fbf5a", G: "#2f8a3a", y: "#f5e08a" },
    rows: mirror([
      "K.....",
      "KK.KKK",
      ".KKggg",
      ".KgKgg",
      ".Kgggg",
      "..Kggy",
      "KKKgyy",
      "KGKgyy",
      "KGGKyy",
      ".KKgyy",
      "..KgKg",
      "..KKKK",
    ]),
  },
};

// ---------- Potions and power-ups (12 x 12) ----------

const BOTTLE = mirror([
  "....KK",
  "....Kc",
  "....KK",
  "....KW",
  "...KWW",
  "..KRwR",
  ".KRRRR",
  ".KRwRR",
  ".KRRRR",
  ".KrRRR",
  "..KrRR",
  "...KKK",
]);

const CONSUMABLES = {
  potion: { rows: BOTTLE, colors: { c: "#a8743a", W: "#e8f7ff", R: "#ff4d5e", r: "#c2273a", w: "#ffc2c8" } },
  bigpotion: { rows: BOTTLE, colors: { c: "#a8743a", W: "#e8f7ff", R: "#b06aff", r: "#7a3fd0", w: "#e6ccff" } },
  shield: {
    colors: { Y: "#ffc93c", B: "#3a7fd6", W: "#e8f7ff" },
    rows: mirror([
      ".KKKKK",
      "KYYYYY",
      "KYBBBB",
      "KYBBBW",
      "KYBBWW",
      "KYBBBW",
      ".KYBBB",
      ".KYBBB",
      "..KYBB",
      "...KYB",
      "....KY",
      ".....K",
    ]),
  },
  power: {
    colors: { Y: "#ffc93c", y: "#f08a24" },
    rows: mirror([
      ".....K",
      "....KY",
      "....KY",
      "KKKKYY",
      "KYYYYY",
      ".KYYKY",
      "..KYYY",
      "..KyYY",
      ".KyYKK",
      ".KyK..",
      "KKK...",
      "......",
    ]),
  },
};

// ---------- Monsters (24 x 24) ----------

export const MONSTERS = {
  frog: {
    colors: { G: "#5cc45a", g: "#3a8f3a", y: "#e6f2a2", W: "#ffffff", r: "#d6453d" },
    rows: mirror([
      "............",
      "............",
      "...KKKK.....",
      "..KWWWWK....",
      ".KWWKKWWK...",
      ".KWWKKWWK...",
      ".KGWWWWGKKKK",
      ".KGGGGGGGGGG",
      "KGGGGGGGGGGG",
      "KGGgGGGGGGGG",
      "KGGGGGGGGGGG",
      "KGGKKKKKKKKK",
      "KGGGKrrrrrrr",
      ".KGGGKKKKKKK",
      ".KGGGGGGGGGG",
      "..KGGGyyyyyy",
      ".KGGGyyyyyyy",
      "KGGGGyyyyyyy",
      "KGGgGyyyyyyy",
      "KGGGGGyyyyyy",
      ".KGGGGGGGGGG",
      ".KKGGGGKKGGG",
      "KGGGKKKK.KKK",
      "KKKKK.......",
    ]),
  },
  owl: {
    colors: { B: "#9a6a3e", b: "#6e4626", c: "#f2dfb8", Y: "#ffd23f", O: "#f08a24" },
    rows: mirror([
      "............",
      "..KK........",
      "..KBK.......",
      "..KBBKKKKKKK",
      "..KBBBBBBBBB",
      ".KBBKKKKBBBB",
      ".KBKYYYYKBBB",
      ".KBKYKKYKBBB",
      ".KBKYKKYKBBB",
      ".KBKYYYYKBBB",
      ".KBBKKKKBBBO",
      ".KBBBBBBBBBO",
      "KbBBBBBBBBBB",
      "KbBBBBcccccc",
      "KbBBBcccKccc",
      "KbBBBccccccc",
      "KbBBBccKcccc",
      "KbBBBccccccc",
      ".KbBBBcccccc",
      ".KbBBBBccccc",
      "..KbBBBBBBBB",
      "...KKBBBBBBB",
      ".....KOKOKKK",
      "......K.K...",
    ]),
  },
  bat: {
    colors: { P: "#8a5ad6", p: "#5a3496", R: "#ff4d4d", W: "#ffffff" },
    rows: mirror([
      "............",
      "............",
      "............",
      "........K...",
      "........KK..",
      "........KPKK",
      "K.......KPPP",
      "KK.....KPPPP",
      "KpK...KPRRPP",
      "KppK.KPPRRPP",
      "KpppKKPPPPPP",
      "KppppKPPPPPP",
      "KpppppKPPKKK",
      "KppKppKPPPWP",
      "KpK.KpKPPPPP",
      "KK..KKKPPPPP",
      "K....K.KPPPP",
      ".......KPPPP",
      "........KPPP",
      "........KKKK",
      "............",
      "............",
      "............",
      "............",
    ]),
  },
  octopus: {
    colors: { O: "#ff7a8a", o: "#d64f63", W: "#ffffff" },
    rows: mirror([
      "............",
      "........KKKK",
      "......KKOOOO",
      ".....KOOOOOO",
      "....KOOOOOOO",
      "....KOoOOOOO",
      "...KOOOOOOOO",
      "...KOOWWWOOO",
      "...KOOWKKOOO",
      "...KOOWKKOOO",
      "...KOOOOOOOO",
      "...KOOOOOKKK",
      "....KOOOOOOO",
      ".....KOOOOOO",
      "...KKOOOOOOO",
      "..KOOKOOKOOK",
      ".KOOKKOOKOOK",
      ".KOK.KOOKOOK",
      "KOOK.KOK.KOK",
      "KoK..KOK.KoK",
      "KK...KoK..KK",
      "......KK....",
      "............",
      "............",
    ]),
  },
  dragon: {
    colors: { D: "#e04848", d: "#a82e2e", y: "#ffd25a", h: "#f7ead0", Y: "#ffe066", W: "#ffffff" },
    rows: mirror([
      "..K.........",
      "..KhK.......",
      "...KhK......",
      "...KhhKKKKKK",
      "...KKDDDDDDD",
      "..KDDDDDDDDD",
      ".KDDDDDDDDDD",
      ".KDKKKKDDDDD",
      ".KDKYYKDDDDD",
      ".KDKYKKDDDDD",
      ".KDDDDDDDDDD",
      ".KDDDDDdddDD",
      ".KDDDDKKKKKK",
      "..KDDKWKWKWK",
      "..KDDDKKKKKK",
      "KK.KDDDyyyyy",
      "KdKKDDyyyyyy",
      "KddKDDyyyyyy",
      "KdddKDyyyyyy",
      "KddKDDDyyyyy",
      ".KK.KDDDDDDD",
      "....KDDKKDDD",
      "...KDDK..KDD",
      "...KKKK..KKK",
    ]),
  },
};

// ---------- More creatures (24 x 24, bottom-aligned) ----------

// Pad a sprite with empty rows on top so it stands on the bottom row.
const padTop = (rows, height) => [...Array(Math.max(0, height - rows.length)).fill(".".repeat(rows[0].length)), ...rows];

const NEW_CREATURES = {
  slime: {
    colors: { G: "#5cd6c0", g: "#2fa39a", W: "#ffffff" },
    rows: padTop(mirror([
      "..........KK",
      "........KKGG",
      ".......KGGGG",
      "......KGWWGG",
      ".....KGWWGGG",
      "....KGGGGGGG",
      "....KGGGGGGG",
      "...KGGGKKGGG",
      "...KGGGKKGGG",
      "..KGGGGGGGGG",
      "..KGGGGGGGKK",
      ".KgGGGGGGGGG",
      ".KgGGGGGGGGG",
      "KggGGGGGGGGG",
      "KggggGGGGGGG",
      "KgggggggGGGG",
      ".KKggggggggg",
      "...KKKKKKKKK",
    ]), 24),
  },
  shroom: {
    colors: { R: "#e04848", r: "#a82e2e", W: "#ffffff", C: "#fbe8c8", c: "#e0c49a" },
    rows: padTop(mirror([
      "........KKKK",
      "......KKRRRR",
      ".....KRRWWRR",
      "....KRRRWWRR",
      "...KRWWRRRRR",
      "..KRRWWRRRRW",
      "..KRRRRRRRWW",
      ".KRRRRWWRRRR",
      ".KrRRRWWRRRR",
      ".KrrRRRRRRRR",
      "..KKKKKKKKKK",
      "....KCCCCCCC",
      "....KCCKCCCC",
      "....KCCKCCCC",
      "....KCcCCCKK",
      "....KCcCCCCC",
      "....KCccCCCC",
      ".....KCCCCCC",
      "....KKKKKKKK",
    ]), 24),
  },
  golem: {
    colors: { R: "#9a92a8", r: "#6e6680", Y: "#7fe3ff", M: "#5cbf4a" },
    rows: padTop(mirror([
      "......KKKKKK",
      "....KKRRRRRR",
      "...KRRRRrRRR",
      "..KRRrRRRRRR",
      "..KRRRRRRRRR",
      "..KRRKYYKRRR",
      "..KRRKYYKRRR",
      "..KRRRRRRRRR",
      ".KKRRRRRKKKK",
      "KRRKRRRRRRRR",
      "KRRKRRMMRRRR",
      "KRRKRRRRMRRR",
      "KRRKRrRRRRRR",
      ".KKKRRRRRRRR",
      "...KRRRRKKKK",
      "...KRRRK....",
      "..KKKKKK....",
    ]), 24),
  },
  crab: {
    colors: { R: "#f0603a", r: "#b8401e", W: "#ffffff" },
    rows: padTop(mirror([
      ".KKK........",
      "KRRRK.......",
      "KRKKK.......",
      "KRRRK...KKK.",
      ".KRK....KWK.",
      "..KRK...KKK.",
      "...KRK...K..",
      "....KKKKKKKK",
      "...KRRRRRRRR",
      "..KRRRRRRRRR",
      ".KRRRrRRRRRR",
      ".KRRRRRRRRKK",
      ".KrRRRRRRRRR",
      "..KrrRRRRRRR",
      "...KKKKKKKKK",
      "..K.K.K.....",
      ".K.K.K......",
    ]), 24),
  },
  ghost: {
    colors: { W: "#f2f0ff", w: "#c8c0e8", p: "#ffb3c8" },
    rows: padTop(mirror([
      "......KKKKKK",
      "....KKWWWWWW",
      "...KWWWWWWWW",
      "..KWWWWWWWWW",
      "..KWWWWWWWWW",
      ".KWWWWKKWWWW",
      ".KWWWWKKWWWW",
      ".KWWWWKKWWWW",
      ".KWWpWWWWWWW",
      ".KWWWWWWWWWK",
      "KWWWWWWWWWWW",
      "KWKWWWWWWWWW",
      "KWWWWWWWWWWW",
      ".KWWWWWWWWWW",
      ".KwWWWWWWWWW",
      ".KwWWWWWWWWW",
      ".KwwWWWWWWWW",
      ".KwwwWWWwwwW",
      ".KwKKwwwKKww",
      "..K..KKK..KK",
    ]), 24),
  },
};

// ---------- Biome scenery (16 x 16, bottom-aligned) ----------

// (The pine tree is added below, next to the world map's pine.)
export const DECOR = {
  // Locked gate between areas of a zone.
  gate: {
    colors: { W: "#b07a3e", w: "#8a5a2a", I: "#5a5466", Y: "#ffc93c" },
    rows: padTop(mirror([
      "..KKKKKK",
      ".KWWKWWK",
      "KWwWKWwK",
      "KWwWKWwK",
      "KIIIIIII",
      "KWwWKWwK",
      "KWwWKWKK",
      "KWwWKWKY",
      "KWwWKWwK",
      "KIIIIIII",
      "KWwWKWwK",
      "KWwWKWwK",
      "KKKKKKKK",
    ]), 16),
  },
  bush: {
    colors: { G: "#5cbf4a", g: "#3a8f3a" },
    rows: padTop(mirror([
      "....KKKK",
      "..KKGGGG",
      ".KGGGgGG",
      ".KGgGGGG",
      "KGGGGGGg",
      "KGGGgGGG",
      "KgGGGGGG",
      "KggGGGgG",
      ".KggGGGG",
      "..KKKKKK",
    ]), 16),
  },
  rock: {
    colors: { R: "#a39ab0", r: "#776e88", w: "#d4cee0" },
    rows: padTop(mirror([
      "....KKKK",
      "..KKRRRR",
      ".KRRRRwR",
      ".KRRRwRR",
      "KRRRRRRR",
      "KrRRRRRR",
      "KrrRRRRR",
      ".KrrrRRR",
      "..KKKKKK",
    ]), 16),
  },
  crystal: {
    colors: { C: "#c58cf0", c: "#8a5ad6", w: "#f2e0ff" },
    rows: padTop(mirror([
      "......KK",
      ".....KCw",
      ".....KCc",
      "..K..KCc",
      ".KCK.KCc",
      ".KCcKKCc",
      ".KwcKCCc",
      "KKCcKCCc",
      "KCCcKCCc",
      "KCCcKCcc",
      ".KKKKKKK",
    ]), 16),
  },
  wall: {
    colors: { S: "#b8b0c8", s: "#8a82a0" },
    rows: padTop(mirror([
      "KKKK..KK",
      "KSSK..KS",
      "KSSKKKKS",
      "KSSSSSSS",
      "KKKKKKKK",
      "KSSSKSSS",
      "KsSSKSSS",
      "KKKKKKKK",
      "KSSSSSKS",
      "KsSSSSKS",
      "KKKKKKKK",
      "KSSSKSSS",
      "KsSSKSSS",
      "KKKKKKKK",
    ]), 16),
  },
};

// ---------- World map landmarks ----------
// Built from parts so one pine can make a whole forest.

const PINE = {
  colors: { G: "#3fa34a", g: "#2a7a35", T: "#8a5a32" },
  rows: mirror([
    ".......K",
    "......KG",
    ".....KGG",
    "....KGGG",
    ".....KgG",
    "....KGgG",
    "...KGGGG",
    "..KGGGGG",
    "....KgGG",
    "...KGgGG",
    "..KGGGGG",
    ".KGGGGGG",
    ".KKKKKKK",
    "......KT",
    "......KT",
    "......KK",
  ]),
};

DECOR.pine = PINE;

// More scenery, so each zone has its own look (see THEMES in biome.js).
DECOR.oak = {
  colors: { G: "#5aa848", g: "#3c7a34", H: "#8ccf5e", T: "#8a5a32" },
  rows: mirror([
    "....KKKK",
    "..KKGGGG",
    ".KGGGHGG",
    ".KGGHGGG",
    "KGGGGGGG",
    "KGGGGGgG",
    "KgGGGGGG",
    "KggGgGGG",
    ".KgggggG",
    "..KKKKKK",
    "......KT",
    "......KT",
    ".....KKK",
  ]),
};
DECOR.oakgold = { rows: DECOR.oak.rows, colors: { G: "#e0a040", g: "#b06a2a", H: "#f6d070", T: "#7a4a2a" } };
DECOR.bigshroom = {
  colors: { A: "#c8503a", W: "#f4e8d0", L: "#ecdcb8", l: "#c8b490" },
  rows: padTop(mirror([
    "....KKKK",
    "..KKAAAA",
    ".KAAWAAA",
    "KAAAAAAW",
    "KAWWAAAA",
    "KKKKKKKK",
    ".....KlL",
    ".....KlL",
    ".....KlL",
    "....KKKK",
  ]), 16),
};
DECOR.stalagmite = {
  colors: { R: "#8a809a", r: "#5e5470", w: "#c4bcd2" },
  rows: mirror([
    "......KK",
    "......Kw",
    ".....KRw",
    ".....KRR",
    "....KrRR",
    "....KrRR",
    "...KrRRR",
    "...KrRRR",
    "..KrrRRR",
    "..KrrRRR",
    ".KrrrRRR",
    ".KKKKKKK",
  ]),
};
DECOR.pillar = {
  colors: { S: "#d8d0e0", s: "#a49cb4" },
  rows: mirror([
    "..KKKKKK",
    "..KSSSSS",
    "..KKKKKK",
    "...KsSSS",
    "...KsSSS",
    "...KsSSS",
    "...KsSSS",
    "...KsSSS",
    "...KsSSS",
    "...KsSSS",
    "..KKKKKK",
    "..KSSSSS",
    ".KKKKKKK",
  ]),
};
DECOR.brokenpillar = {
  colors: DECOR.pillar.colors,
  rows: padTop(mirror([
    "...K.KKK",
    "...KKsSS",
    "...KsSSS",
    "...KsSSS",
    "...KsSSS",
    "..KKKKKK",
    "..KSSSSS",
    ".KKKKKKK",
  ]), 16),
};
DECOR.deadtree = {
  colors: { T: "#6a5048", t: "#4a3430" },
  rows: mirror([
    "K.......",
    "KTK.....",
    ".KTK..K.",
    "..KTKKTK",
    "...KTTK.",
    "....KTTK",
    ".....KTT",
    "......Kt",
    "......Kt",
    "......Kt",
    ".....KtT",
    "....KKKK",
  ]),
};
DECOR.voidtree = { rows: DECOR.deadtree.rows, colors: { T: "#5a3f8a", t: "#3a2860" } };
DECOR.snowpine = { rows: PINE.rows, colors: { G: "#3f7a6a", g: "#eef6fa", T: "#7a5a40" } };
DECOR.hedge = {
  colors: { G: "#3f8a3a", g: "#2a6a2e", H: "#5aa848" },
  rows: padTop(mirror([
    "KKKKKKKK",
    "KHHGHGGH",
    "KGGGGGGG",
    "KGgGGGgG",
    "KGGGGGGG",
    "KgGGgGGG",
    "KggggGgg",
    "KKKKKKKK",
  ]), 16),
};
DECOR.reeds = {
  colors: { G: "#6aa04a", g: "#4a7a34", B: "#8a5a32" },
  rows: padTop(mirror([
    "...KB...",
    "...KB.K.",
    "..KGK.KB",
    "..KGK.KB",
    ".KGgKKGK",
    ".KGgKGgK",
    "KGgKKGgK",
    "KGgKGgK.",
    "KKKKKKKK",
  ]), 16),
};

// More trees, rocks, and plants, so each area of a zone can mix its own
// (THEMES `mixes` in biome.js).
DECOR.birch = { rows: DECOR.oak.rows, colors: { G: "#8cc85a", g: "#5a9a3e", H: "#b8e07a", T: "#ece8e0" } };
DECOR.cherry = { rows: DECOR.oak.rows, colors: { G: "#f4a6c8", g: "#c8709a", H: "#ffd0e4", T: "#7a4a3a" } };
DECOR.darkpine = { rows: PINE.rows, colors: { G: "#2e6a3a", g: "#1e4a2a", T: "#6a4a2a" } };
DECOR.autumnpine = { rows: PINE.rows, colors: { G: "#c8783a", g: "#9a5226", T: "#6a4a2a" } };
DECOR.mossrock = { rows: DECOR.rock.rows, colors: { R: "#7a8a6a", r: "#5a6a4a", w: "#9ab87a" } };
DECOR.snowrock = { rows: DECOR.rock.rows, colors: { R: "#e8f0f8", r: "#a8bccc", w: "#ffffff" } };
DECOR.bluecrystal = { rows: DECOR.crystal.rows, colors: { C: "#7fe3ff", c: "#3fa8d0", w: "#e8fbff" } };
DECOR.ambercrystal = { rows: DECOR.crystal.rows, colors: { C: "#ffc83a", c: "#d08a1a", w: "#fff4c0" } };
DECOR.stump = {
  colors: { W: "#d8b07a", w: "#a8804a", T: "#8a5a32", t: "#6e4426" },
  rows: padTop(mirror([
    "...KKKKK",
    "..KWWWWW",
    "..KWwwwW",
    "..KKWWWW",
    "..KTKKKK",
    "..KTtTTT",
    "..KTtTTT",
    ".KTTtTTT",
    "KTtTTtTT",
    "KKKKKKKK",
  ]), 16),
};
DECOR.fern = {
  colors: { G: "#5aa848", g: "#3c7a34" },
  rows: padTop(mirror([
    "G.......",
    ".G....G.",
    "..G..Gg.",
    "G..GGg..",
    ".GG.Gg.G",
    "...GGgG.",
    "....GgG.",
    ".....GgK",
    ".....KKK",
  ]), 16),
};

// Pieces of the little scenes in each area (villages, camps, farms... see
// SCENES in biome.js).
DECOR.tent = {
  colors: { T: "#d8a040", t: "#b07a2a", D: "#3a2a20" },
  rows: mirror([
    "..........KK",
    ".........KTT",
    "........KTTt",
    ".......KTTtT",
    "......KTTtTT",
    ".....KTTtTTT",
    "....KTTtTTTK",
    "...KTTtTTTKD",
    "..KTTtTTTKDD",
    ".KTTtTTTKDDD",
    "KKKKKKKKKKKK",
  ]),
};
DECOR.campfire = {
  colors: { O: "#e8602a", Y: "#ffc83a", W: "#fff4c0", L: "#8a5a32", l: "#5e3a1c" },
  rows: padTop(mirror([
    "......KK",
    ".....KOY",
    "....KOYY",
    "....KOYW",
    "...KOOYY",
    "..KLLKOO",
    ".KLlLLKK",
    "KLlLLLLL",
    "KKKKKKKK",
  ]), 12),
};
DECOR.well = {
  colors: { R: "#b8503a", T: "#8a5a32", S: "#a8a0b0", s: "#7a7288", B: "#3a6ab0" },
  rows: mirror([
    "...KKKKK",
    "..KRRRRR",
    ".KRRRRRR",
    "KKKKKKKK",
    "..KT....",
    "..KT....",
    "..KT...K",
    "KKKKKKKK",
    "KSSsBBBB",
    "KSsSSsSS",
    "KSSSsSSs",
    "KKKKKKKK",
  ]),
};
DECOR.fence = {
  colors: { T: "#a87a4a" },
  rows: padTop(mirror([
    "KKK.....",
    "KTKKKKKK",
    "KTTTTTTT",
    "KTKKKKKK",
    "KTK.....",
    "KTKKKKKK",
    "KTTTTTTT",
    "KTKKKKKK",
    "KKK.....",
  ]), 16),
};
DECOR.crops = {
  colors: { G: "#7ac84a", g: "#4a8a2e", D: "#8a6a42", d: "#6e5232" },
  rows: padTop([
    "..G...G...G...G.",
    ".GgG.GgG.GgG.GgG",
    "..g...g...g...g.",
    "DDDDDDDDDDDDDDDD",
    "dDdDdDdDdDdDdDdD",
    "..G...G...G...G.",
    ".GgG.GgG.GgG.GgG",
    "..g...g...g...g.",
    "DDDDDDDDDDDDDDDD",
    "dDdDdDdDdDdDdDdD",
  ], 16),
};
DECOR.wheat = { rows: DECOR.crops.rows, colors: { ...DECOR.crops.colors, G: "#e8c050", g: "#b08a2a" } };
DECOR.grave = {
  colors: { S: "#a8a0b4", s: "#7a7288", G: "#5a7a4a", g: "#3e5a34" },
  rows: padTop(mirror([
    "....KKKK",
    "...KSSSS",
    "...KSSSK",
    "...KsSKK",
    "...KsSSK",
    "...KsSSS",
    "..KKKKKK",
    ".KGGgGGG",
    ".KKKKKKK",
  ]), 16),
};
DECOR.standingstone = {
  colors: { S: "#a8a0b4", s: "#7a7288", w: "#d0cad8", R: "#a8a0b4" },
  rows: mirror([
    ".....KKK",
    "....KSSS",
    "....KSwS",
    "...KsSSS",
    "...KsSSS",
    "...KsSRS",
    "...KsSRR",
    "...KsSSS",
    "...KsSSS",
    "..KssSSS",
    "..KKKKKK",
  ]),
};
DECOR.runestone = { rows: DECOR.standingstone.rows, colors: { ...DECOR.standingstone.colors, R: "#7fe3ff" } };
DECOR.statue = {
  colors: { S: "#e0dcea", s: "#a8a0bc", P: "#9a92ac", p: "#7a7290" },
  rows: mirror([
    "......KK",
    ".....KSS",
    ".....KSS",
    "......KK",
    "....KKSS",
    "...KSSSS",
    "...KSsSS",
    "....KsSS",
    "....KsSS",
    "...KKKKK",
    "..KPPPPP",
    "..KPpPPP",
    ".KKKKKKK",
  ]),
};
DECOR.goldstatue = { rows: DECOR.statue.rows, colors: { S: "#ffd23f", s: "#c99418", P: "#a8a0b0", p: "#7a7288" } }; // the Arena's champion
DECOR.stall = {
  colors: { R: "#c8414b", W: "#f4ecdc", T: "#8a5a32", B: "#b08a5a", b: "#8a6a42", A: "#e8602a", O: "#7ac84a" },
  rows: padTop(mirror([
    "KKKKKKKK",
    "KRRWWRRW",
    "KRRWWRRW",
    "KKKKKKKK",
    ".KT.....",
    ".KT.....",
    ".KAOAKAO",
    "KKKKKKKK",
    "KBBBBBBB",
    "KBbBBBbB",
    "KKKKKKKK",
  ]), 16),
};
DECOR.berrybush = {
  colors: { G: "#5cbf4a", g: "#3a8f3a", B: "#5a5ae0" },
  rows: padTop(mirror([
    "....KKKK",
    "..KKGGGG",
    ".KGGBGGG",
    ".KGgGGBG",
    "KGBGGGGg",
    "KGGGgGBG",
    "KgGBGGGG",
    "KggGGGgG",
    ".KggGGGG",
    "..KKKKKK",
  ]), 16),
};
DECOR.berrybushpicked = { rows: DECOR.berrybush.rows, colors: { ...DECOR.berrybush.colors, B: "#5cbf4a" } };
DECOR.flowerbush = { rows: DECOR.berrybush.rows, colors: { ...DECOR.berrybush.colors, B: "#ffd84a" } };
DECOR.rosebush = { rows: DECOR.berrybush.rows, colors: { ...DECOR.berrybush.colors, G: "#4aa848", B: "#f06a8a" } };
DECOR.log = {
  colors: { L: "#8a5a32", l: "#6e4426", W: "#d8b07a", w: "#a8804a" },
  rows: padTop(mirror([
    "KKKKKKKK",
    "KWLLLLLL",
    "WwWLlLLL",
    "KWLLLLlL",
    "KKKKKKKK",
  ]), 10),
};

// ---------- Buildings ----------
// Cabins, cottages, barns, and shops are drawn by `building()` rather than by
// hand: a shingled roof (snowy in the Spires), walls of logs, timber, planks,
// or stone, framed windows with flower boxes, a plank door with a step, and a
// brick chimney. Each zone colors them its own way (BUILDING_COLORS), as
// DECOR["cabin_forest"] and so on; plain DECOR.cabin is the Meadow's.
const BUILDING_BASE = {
  R: "#b8503a", r: "#8a3a2a", Q: "#d8705a", N: "#f4f8fc",
  W: "#e8d8b8", w: "#b89c74", B: "#7a5232",
  D: "#8a5a32", d: "#5e3a1c", F: "#f4ecdc", G: "#7fc8e8", g: "#e8f8ff", Y: "#ffd23f",
  P: "#8a5a32", f: "#f08cb0", L: "#5aa848", C: "#a85a4a", c: "#7a4038", S: "#a8a0b0",
  A: "#c8414b", a: "#f4ecdc", X: "#5e3a1c",
};
const BUILDING_COLORS = {
  meadow: {},
  // Glowshroom Forest: mushroom-cap roofs and glowing windows.
  forest: { R: "#c870d8", r: "#8a4aa8", Q: "#ffd0f4", W: "#e8dcc8", w: "#b8a888", G: "#7fe3ff", g: "#e8fbff" },
  // Magma Canyon: dark stone and lava-lit windows.
  caves: { R: "#3a2a2e", r: "#241a1e", Q: "#5a3a32", W: "#8a6a5a", w: "#5a4038", G: "#ffb020", g: "#fff4c0", C: "#5a3a32", c: "#3a241e" },
  // Coral Lagoon: beach huts in pastel colors.
  river: { R: "#e8d090", r: "#c0a060", Q: "#f8ecc0", W: "#7fc8e8", w: "#4a9ac0", A: "#ff7a6a" },
  // Haunted Hollow: crooked dark houses with ghostly green windows.
  castle: { R: "#3a2a4e", r: "#241838", Q: "#5a4a6e", W: "#6a5a6a", w: "#4a3e4a", G: "#7fffa0", g: "#e0ffe8", D: "#3a2a20", d: "#241812" },
  // Crown Keep: royal purple roofs and pale stone.
  keep: { R: "#6a4bd6", r: "#4a2fa8", Q: "#8a6af0", W: "#e0dcea", w: "#a8a0bc", A: "#6a4bd6" },
  // Aurora Glacier: snowy roofs on log cabins.
  spires: { R: "#7a9ab8", r: "#5a7a98", Q: "#9abad8", W: "#a87a4a", w: "#7a5232" },
  // Thunder Peaks: slate roofs, stone walls, lamp-lit windows.
  clouds: { R: "#4a5064", r: "#2e3242", Q: "#6a7084", W: "#a8a0b0", w: "#7a7288", G: "#ffe066", g: "#fff4c0", A: "#e8b84a" },
  // Cosmic Rift: night-purple walls and starry windows.
  void: { R: "#3a2860", r: "#241848", Q: "#5a3f8a", W: "#4a3a6e", w: "#2e2448", B: "#241848", G: "#c58cf0", g: "#f2e0ff", D: "#2e2448", d: "#1a1030", f: "#c58cf0" },
};
const SNOWY = new Set(["spires"]);

function building({ w, h, roofH, wall, door = 0.5, windows = [], chimney = null, barn = false, awning = false, snow = false }) {
  const g = Array.from({ length: h }, () => Array(w).fill("."));
  const set = (x, y, ch) => {
    if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = ch;
  };
  const top = chimney !== null ? 4 : 0; // room above the roof for the chimney
  const roofBot = top + roofH;
  const wallL = 2, wallR = w - 3, wallTop = roofBot, wallBot = h - 2;
  // Walls.
  for (let y = wallTop; y <= wallBot; y++) {
    const row = y - wallTop;
    for (let x = wallL; x <= wallR; x++) {
      let ch = "W";
      if (wall === "logs") {
        if (row % 3 === 2) ch = "w";
        if ((x === wallL || x === wallR) && row % 3 !== 2) ch = "B";
      } else if (wall === "planks") {
        if ((x - wallL) % 4 === 0) ch = "w";
      } else if (wall === "stone") {
        if (row % 3 === 2 || ((x + (Math.floor(row / 3) % 2) * 3) % 6 === 0)) ch = "w";
      } else if (wall === "timber") {
        if (x === wallL || x === wallR || x === Math.floor(w / 2) || row === 0 || row === Math.floor((wallBot - wallTop) / 2)) ch = "B";
      }
      set(x, y, ch);
    }
  }
  // Roof: a trapezoid of shingles, narrower at the top, overhanging the walls.
  for (let y = top; y < roofBot; y++) {
    const row = y - top;
    const inset = Math.round((1 - row / (roofH - 1)) * w * 0.16);
    for (let x = inset; x < w - inset; x++) {
      let ch = "R";
      if (row % 3 === 2 || (row % 3 === 1 && (x + (Math.floor(row / 3) % 2) * 2) % 4 === 0)) ch = "r";
      if (row === 0) ch = "Q";
      if (snow && (row < 2 || (row === 2 && (x * 7) % 5 < 2))) ch = "N";
      if (row === roofH - 1) ch = "K";
      set(x, y, ch);
    }
  }
  // An awning over the shop front, striped.
  if (awning)
    for (let x = wallL - 1; x <= wallR + 1; x++) {
      set(x, wallTop + 1, Math.floor(x / 3) % 2 ? "A" : "a");
      set(x, wallTop + 2, Math.floor(x / 3) % 2 ? "A" : "a");
      set(x, wallTop + 3, x % 3 === 1 ? "." : "K");
    }
  // Windows: a frame, four panes with a shine, and a flower box.
  const winTop = wallTop + (awning ? 5 : 3);
  for (const wx of windows) {
    const x0 = Math.round(wx * w) - 3;
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || y === 0 || x === 6 || y === 5;
        set(x0 + x, winTop + y, edge ? "K" : x === 3 || y === 2 ? "F" : x === 1 && y === 1 ? "g" : "G");
      }
    for (let x = 0; x < 7; x++) {
      set(x0 + x, winTop + 6, x % 2 ? "L" : "f");
      set(x0 + x, winTop + 7, "P");
    }
  }
  // The door: a frame, planks, a knob, and a step.
  const dw = barn ? 12 : 7, dh = Math.min(barn ? 14 : 10, wallBot - wallTop);
  const dx0 = Math.round(door * w) - Math.floor(dw / 2);
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      const edge = x === 0 || x === dw - 1 || y === 0;
      let ch = edge ? "K" : x % 2 ? "D" : "d";
      if (barn && !edge) ch = x === y - 1 || x === dw - y || x === Math.floor(dw / 2) ? "X" : "D";
      if (!barn && x === dw - 2 && y === Math.floor(dh / 2)) ch = "Y";
      set(dx0 + x, wallBot - dh + 1 + y, ch);
    }
  for (let x = -1; x <= dw; x++) set(dx0 + x, h - 1, "S");
  // A brick chimney poking out of the roof.
  if (chimney !== null) {
    const cx0 = Math.round(chimney * w) - 2;
    for (let y = 0; y < top + Math.floor(roofH / 2); y++)
      for (let x = 0; x < 5; x++) set(cx0 + x, y, x === 0 || x === 4 || y === 0 ? "K" : y % 2 ? "C" : x % 2 ? "c" : "C");
  }
  // Outline everything against the background, and a line along the ground.
  const out = g.map((r) => r.slice());
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (g[y][x] === "." || g[y][x] === "S") continue;
      const empty = (xx, yy) => xx < 0 || yy < 0 || xx >= w || yy >= h || g[yy][xx] === ".";
      if (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1)) out[y][x] = "K";
    }
  for (let x = wallL; x <= wallR; x++) if (out[h - 2][x] !== "d" && out[h - 2][x] !== "D" && out[h - 2][x] !== "X") out[h - 2][x] = "K";
  return out.map((r) => r.join(""));
}

const BUILDINGS = {
  cottage: { w: 40, h: 36, roofH: 15, wall: "timber", door: 0.5, windows: [0.2, 0.8], chimney: 0.76 },
  cabin: { w: 34, h: 32, roofH: 13, wall: "logs", door: 0.66, windows: [0.27], chimney: 0.22 },
  barn: { w: 46, h: 40, roofH: 17, wall: "planks", door: 0.5, windows: [], barn: true, colors: { W: "#b84a3a", w: "#8a3428", R: "#5a4a4a", r: "#3e3232", Q: "#7a6a6a" } },
  shop: { w: 40, h: 36, roofH: 14, wall: "planks", door: 0.3, windows: [0.72], awning: true },
  hall: { w: 48, h: 38, roofH: 15, wall: "stone", door: 0.5, windows: [0.18, 0.82], chimney: 0.2 },
};
for (const [kind, spec] of Object.entries(BUILDINGS)) {
  for (const [zone, zc] of Object.entries(BUILDING_COLORS)) {
    const art = {
      rows: building({ ...spec, snow: SNOWY.has(zone) }),
      colors: { ...BUILDING_BASE, ...zc, ...(spec.colors || {}), ...(zone === "void" && spec.colors ? zc : {}) },
    };
    DECOR[`${kind}_${zone}`] = art;
    if (zone === "meadow") DECOR[kind] = art;
  }
}

// A stone tower with battlements and slit windows (Castle, Keep, Void).
function tower(w, h) {
  const g = Array.from({ length: h }, () => Array(w).fill("."));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const battlement = y < 4 && x % 6 >= 3;
      if (y < 4 && !battlement) continue;
      let ch = (y + 1) % 4 === 0 || (x + (Math.floor(y / 4) % 2) * 3) % 6 === 0 ? "w" : "W";
      if (y === 4) ch = "K";
      g[y][x] = ch;
    }
  const cx = Math.floor(w / 2);
  for (const sy of [9, 20]) for (let y = sy; y < sy + 6; y++) for (const x of [cx - 1, cx]) g[y][x] = y === sy ? "K" : "G";
  for (let y = h - 10; y < h - 1; y++) for (let x = cx - 3; x <= cx + 2; x++) g[y][x] = y === h - 10 || x === cx - 3 || x === cx + 2 ? "K" : x % 2 ? "D" : "d";
  const out = g.map((r) => r.slice());
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (g[y][x] === ".") continue;
      const empty = (xx, yy) => xx < 0 || yy < 0 || xx >= w || yy >= h || g[yy][xx] === ".";
      if (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1)) out[y][x] = "K";
    }
  return out.map((r) => r.join(""));
}
for (const zone of Object.keys(BUILDING_COLORS)) {
  const zc = BUILDING_COLORS[zone];
  DECOR[`tower_${zone}`] = { rows: tower(22, 46), colors: { ...BUILDING_BASE, W: "#a8a0b0", w: "#7a7288", G: "#3a2a40", ...(zone === "void" || zone === "castle" ? { W: zc.W, w: zc.w, G: zc.G } : {}) } };
}
DECOR.tower = DECOR.tower_meadow;

// A windmill: a tapered tower, a cap, and four sails.
DECOR.windmill = (() => {
  const w = 44, h = 52;
  const g = Array.from({ length: h }, () => Array(w).fill("."));
  const cx = w / 2 - 0.5;
  for (let y = 16; y < h; y++) {
    const half = 6 + ((y - 16) / (h - 16)) * 5;
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) g[y][x] = (y % 4 === 0) ? "w" : "W";
  }
  for (let y = 10; y < 17; y++) {
    const half = 2 + (y - 10);
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) g[y][x] = y % 3 === 0 ? "r" : "R";
  }
  // Sails on two diagonals, a lattice of frame and cloth.
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]])
    for (let t = 2; t < 20; t++)
      for (let k = 0; k < 4; k++) {
        // Along the spar, then out to one side of it for the cloth.
        const x = Math.round(cx + sx * t - sy * k * 0.7), y = Math.round(13 + sy * t * 0.62 + sx * k * 0.7);
        if (x >= 0 && y >= 0 && x < w && y < h && (k === 0 || t > 5)) g[y][x] = k === 0 || t % 4 === 0 || k === 3 ? "B" : "a";
      }
  for (let y = h - 9; y < h - 1; y++) for (let x = Math.round(cx) - 2; x <= Math.round(cx) + 2; x++) g[y][x] = x === Math.round(cx) - 2 || x === Math.round(cx) + 2 || y === h - 9 ? "K" : "D";
  for (let y = 24; y < 28; y++) for (let x = Math.round(cx) - 1; x <= Math.round(cx) + 1; x++) g[y][x] = y === 24 || x !== Math.round(cx) ? "K" : "G";
  g[13][Math.round(cx)] = "K";
  const out = g.map((r) => r.slice());
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (g[y][x] === "." || g[y][x] === "a" || g[y][x] === "B") continue;
      const empty = (xx, yy) => xx < 0 || yy < 0 || xx >= w || yy >= h || g[yy][xx] === ".";
      if (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1)) out[y][x] = "K";
    }
  return { rows: out.map((r) => r.join("")), colors: { ...BUILDING_BASE, W: "#e8dcc8", w: "#c4b494", a: "#f8f4ec", B: "#7a5232" } };
})();

// The Battle Arena on the world map: a colosseum with two tiers of arches
// and flags on top.
DECOR.colosseum = (() => {
  const w = 56, h = 36;
  const g = Array.from({ length: h }, () => Array(w).fill("."));
  const tier = (top, bot, x0, x1) => {
    for (let y = top; y <= bot; y++) for (let x = x0; x <= x1; x++) g[y][x] = y === top + 1 ? "w" : "W";
    // Arches: three wide, rounded at the top.
    for (let x = x0 + 3; x + 2 <= x1 - 2; x += 6)
      for (let y = top + 3; y < bot; y++) for (let k = 0; k < 3; k++) if (y > top + 3 || k === 1) g[y][x + k] = "D";
  };
  tier(18, h - 2, 1, w - 2);
  tier(9, 18, 6, w - 7);
  for (const fx of [9, 27, 46]) {
    for (let y = 1; y < 9; y++) g[y][fx] = "B";
    for (let y = 1; y < 4; y++) for (let k = 1; k <= 4 - y + 1; k++) g[y][fx + k] = fx === 27 ? "a" : "A";
  }
  const out = g.map((r) => r.slice());
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (g[y][x] === "." || g[y][x] === "B" || g[y][x] === "A" || g[y][x] === "a") continue;
      const empty = (xx, yy) => xx < 0 || yy < 0 || xx >= w || yy >= h || g[yy][xx] === ".";
      if (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1)) out[y][x] = "K";
    }
  for (let x = 1; x < w - 1; x++) out[h - 1][x] = "K";
  return { rows: out.map((r) => r.join("")), colors: { W: "#e0d4b8", w: "#b8a888", D: "#4a3a3a", A: "#c8414b", a: "#3a6ab0", B: "#7a5232" } };
})();

export const LANDMARKS = {
  // Cottage
  meadow: {
    w: 24, h: 14,
    parts: [{
      colors: { R: "#e04848", r: "#a82e2e", W: "#fbe8c8", Y: "#ffe066", D: "#8a5a32" },
      rows: mirror([
        "..........KK",
        ".........KRR",
        "........KRRR",
        ".......KRRrR",
        "......KRRRRR",
        ".....KRRrRRR",
        "....KRRRRRRR",
        "...KKKKKKKKK",
        "....KWWWWWWW",
        "....KWYYWWWW",
        "....KWYYWWKK",
        "....KWWWWWKD",
        "....KWWWWWKD",
        "....KKKKKKKK",
      ]),
    }],
  },
  // (Glowshroom Forest: replaced with glowing mushrooms below.)
  forest: {
    w: 34, h: 18,
    parts: [
      { ...PINE, x: 0, y: 2 },
      { ...PINE, x: 18, y: 2 },
      { ...PINE, x: 9, y: 0 },
    ],
  },
  // Snowy mountain with a cave
  caves: {
    w: 24, h: 15,
    parts: [{
      colors: { W: "#ffffff", w: "#cfe3f2", R: "#9a8aa8", r: "#6e5f80", D: "#1d1626" },
      rows: mirror([
        "..........KK",
        ".........KWW",
        "........KWWW",
        ".......KWRWw",
        "......KRRRWR",
        ".....KRRRRRR",
        ".....KrRRRRR",
        "....KrRRRRRR",
        "...KrRRRRRRR",
        "...KrRRRKKKK",
        "..KrRRRKDDDD",
        "..KrRRKDDDDD",
        ".KrRRRKDDDDD",
        "KrrRRRKDDDDD",
        "KKKKKKKKKKKK",
      ]),
    }],
  },
  // Waterfall over a cliff
  river: {
    w: 24, h: 12,
    parts: [{
      colors: { R: "#9a8a7a", r: "#6e5f50", B: "#4fb3ff", w: "#e8f7ff" },
      rows: mirror([
        "..KKKKKKKKKK",
        ".KRRRRKBBBBB",
        ".KRrRRKBwBBB",
        "KRRRRRKBBBwB",
        "KRRrRRKBwBBB",
        "KRRRRRKBBBBB",
        "KRrRRRKBBwBB",
        "KRRRRRKBBBBB",
        "KRRRRKwBwBBw",
        ".KKKKwwwwwww",
        "....KBBBBBBB",
        ".....KKKKKKK",
      ]),
    }],
  },
  // Castle with red cone roofs
  castle: {
    w: 24, h: 19,
    parts: [{
      colors: { R: "#d63a4a", r: "#9a2333", S: "#b8b0c8", s: "#8a82a0", Y: "#ffe066", D: "#8a5a32" },
      rows: mirror([
        "..........KK",
        ".........KRR",
        ".........KRR",
        "...K....KRRR",
        "..KRK...KRrR",
        "..KRK..KRRrR",
        ".KRRRK.KRRrR",
        ".KRrRKKRRRrR",
        "KKKKKKKKKKKK",
        ".KSSSK.KSSSS",
        ".KSYSK.KSSSS",
        ".KSSSK.KSSYY",
        ".KSSSKKKSSYY",
        ".KsSSSsSSSSS",
        ".KsSSSSSSSSS",
        ".KsSSSSSSKKK",
        ".KsSSSSSSKDD",
        ".KsSSSSSSKDD",
        ".KKKKKKKKKKK",
      ]),
    }],
  },
};

// ---------- Starfall Realm (dimension 2) ----------

const recolor = (landmark, colors) => ({ ...landmark, parts: landmark.parts.map((p) => ({ ...p, colors })) });

// Swirling portal: the Void Rift's landmark, and the way between dimensions on the map.
LANDMARKS.void = {
  w: 24, h: 23,
  parts: [{
    colors: { P: "#c58cf0", p: "#8a5ad6", V: "#3a1f6e", v: "#6a3fd0", w: "#ffffff", S: "#8a82a0", s: "#5f5874" },
    rows: mirror([
      "........KKKK",
      "......KKPPPP",
      ".....KPPpppp",
      "....KPPpVVVV",
      "...KPPpVVvvv",
      "...KPpVVvVVV",
      "..KPPpVvVVVV",
      "..KPpVVvVVww",
      "..KPpVvVVVwV",
      "..KPpVvVVwVV",
      "..KPpVvVVVVV",
      "..KPpVVvVVVV",
      "..KPPpVVvvvv",
      "...KPpVVVVVV",
      "...KPPpVVVVV",
      "....KPPpVVVV",
      ".....KPPpppp",
      "......KKPPPP",
      "........KKKK",
      "......KKKKKK",
      ".....KSSSSSS",
      "....KSsSSSSS",
      "....KKKKKKKK",
    ]),
  }],
};
// Crown Keep: a grand castle with blue roofs, a golden spire, and a big door.
LANDMARKS.keep = {
  w: 32, h: 25,
  parts: [{
    colors: { S: "#e2dcef", s: "#b0a8c8", R: "#3f5fc8", r: "#2a3f94", Y: "#ffd23f", D: "#8a5a32", W: "#fff27a" },
    rows: mirror([
      "...............Y",
      "..............KY",
      "..............KR",
      ".............KRR",
      "............KRRR",
      "...K........KRrR",
      "..KRK.......KRrR",
      "..KRK......KRRrR",
      ".KRrRK.....KKKKK",
      ".KRrRK.....KSSSS",
      "KRRrRRK....KSWSS",
      "KKKKKKK....KSWSS",
      ".KSSSK.....KSSSS",
      ".KSWSK.KK.KKSSSS",
      ".KSSSKKSKSKSSSSS",
      ".KSSSSSSSSSSSSSS",
      ".KSWSSSSSWSSSWSS",
      ".KSSSSSSSSSSSSSS",
      ".KsSSSSSSSSSSSSS",
      ".KsSSSSWSSSSSKKK",
      ".KsSSSSSSSSSKDDD",
      ".KsSSSSSSSSSKDDD",
      ".KsSSSSSSSSSKDYD",
      ".KsSSSSSSSSSKDDD",
      ".KKKKKKKKKKKKKKK",
    ]),
  }],
};
// The new worlds' landmarks: an icy peak under the aurora, a stormy peak, a
// volcano (from the mountain), a haunted Academy (from the castle), and a
// cosmic portal. (Crown Keep keeps its castle.)
LANDMARKS.spires = recolor(LANDMARKS.caves, { W: "#ffffff", w: "#7fe3a0", R: "#b8d8f0", r: "#7fa8d0", D: "#3a2a6e" });
LANDMARKS.clouds = recolor(LANDMARKS.caves, { W: "#ffe066", w: "#fff4c0", R: "#6a7084", r: "#4a5064", D: "#24283a" });
LANDMARKS.caves = recolor(LANDMARKS.caves, { W: "#ff8a2a", w: "#ffd23f", R: "#5a3a32", r: "#3a241e", D: "#ff6a2a" });
LANDMARKS.castle = recolor(LANDMARKS.castle, { R: "#4a3a5e", r: "#2e2240", S: "#7a7288", s: "#5a5468", Y: "#7fffa0", D: "#3a2a20" });
LANDMARKS.void = recolor(LANDMARKS.void, { P: "#ff7ad8", p: "#c84ab0", V: "#1a1240", v: "#3a6ab0", w: "#ffd23f", S: "#6a5a8a", s: "#4a3a6a" });

// New scenery for the realm, plus things to find while exploring.
DECOR.cloud = { rows: DECOR.bush.rows, colors: { G: "#ffffff", g: "#c8d0f0" } };
DECOR.voidrock = { rows: DECOR.rock.rows, colors: { R: "#4a3a6e", r: "#2e2448", w: "#c58cf0" } };
DECOR.icecrystal = { rows: DECOR.crystal.rows, colors: { C: "#bfe8ff", c: "#7fb8e0", w: "#ffffff" } };
// ---------- The new worlds' scenery ----------
// Glowshroom Forest (zone id forest), Magma Canyon (caves), Coral Lagoon
// (river), Haunted Hollow (castle), Aurora Glacier
// (spires), Thunder Peaks (clouds), Cosmic Rift (void).
DECOR.glowshroom = {
  colors: { A: "#3fb0d0", a: "#2a7a98", L: "#a8f4ff", S: "#e8dcc8", s: "#b8a888" },
  rows: mirror([
    "....KKKK",
    "..KKAAAA",
    ".KAAALLA",
    "KAALLAAA",
    "KAALLAAA",
    "KAAAAAAL",
    "KaAAAAAA",
    "KaaaaaaA",
    ".KKKKKKK",
    "....KSSS",
    "....KsSS",
    "....KsSS",
    "....KsSS",
    "....KsSS",
    "....KsSS",
    "....KsSS",
    "...KssSS",
    "..KKKKKK",
  ]),
};
DECOR.glowshroompink = { rows: DECOR.glowshroom.rows, colors: { ...DECOR.glowshroom.colors, A: "#c870d8", a: "#8a4aa8", L: "#ffd0f4" } };
DECOR.palm = {
  colors: { G: "#4aa848", g: "#2e7a34", T: "#b08a5a", t: "#8a6a42", C: "#7a5232" },
  rows: mirror([
    "..KKK...",
    ".KGGGK.K",
    "KGGgGGKG",
    "KGK.KGGG",
    "K..KGgGC",
    "..KGK.KT",
    "..K...KT",
    "......Kt",
    "......KT",
    "......Kt",
    "......KT",
    "......Kt",
    "......KT",
    "......Kt",
    "......KT",
    ".....KKK",
  ]),
};
DECOR.coral = {
  colors: { A: "#ff7a6a", a: "#d8504a" },
  rows: padTop(mirror([
    ".K...K..",
    "KAK.KAK.",
    "KAK.KAKK",
    ".KAKAAKA",
    "..KAAKAA",
    "...KAAAA",
    "...KAaAA",
    "..KKKKKK",
  ]), 16),
};
DECOR.coralblue = { rows: DECOR.coral.rows, colors: { A: "#7fc8f0", a: "#3a8ac0" } };
DECOR.pumpkin = {
  colors: { O: "#f08a24", o: "#c0601a", G: "#5aa848" },
  rows: padTop(mirror([
    "......KG",
    ".....KGK",
    "..KKKKKK",
    ".KOOOoOO",
    "KOOOoOOO",
    "KOOOoOOO",
    "KOOoOOOO",
    "KoOOoOOO",
    ".KoooooO",
    "..KKKKKK",
  ]), 16),
};
DECOR.jackolantern = {
  colors: { ...DECOR.pumpkin.colors, Y: "#ffd23f" },
  rows: padTop(mirror([
    "......KG",
    ".....KGK",
    "..KKKKKK",
    ".KOOOoOO",
    "KOOOYYOO",
    "KOOOoOOO",
    "KOOYOYYY",
    "KoOOoOOO",
    ".KoooooO",
    "..KKKKKK",
  ]), 16),
};
DECOR.spookytree = { rows: DECOR.deadtree.rows, colors: { T: "#5a4a6e", t: "#3a2a4e" } };
DECOR.cactus = {
  colors: { G: "#5aa848", g: "#3c7a34", F: "#f06a8a" },
  rows: padTop(mirror([
    ".....KKF",
    ".....KGG",
    ".....KGg",
    ".KK..KGg",
    "KGGK.KGg",
    "KGgK.KGg",
    "KGgKKKGg",
    ".KGGGGGg",
    "..KKKKGg",
    ".....KGg",
    ".....KGg",
    ".....KGg",
    "....KKGg",
    "....KKKK",
  ]), 16),
};
DECOR.sandrock = { rows: DECOR.rock.rows, colors: { R: "#e0c088", r: "#b89060", w: "#f4e0b0" } };
DECOR.lavarock = { rows: DECOR.rock.rows, colors: { R: "#5a3a32", r: "#3a241e", w: "#ff8a2a" } };
DECOR.obsidian = { rows: DECOR.crystal.rows, colors: { C: "#3a2a3e", c: "#241a28", w: "#ff8a2a" } };
DECOR.stormrock = { rows: DECOR.rock.rows, colors: { R: "#6a7084", r: "#4a5064", w: "#ffe066" } };
DECOR.planet = {
  colors: { P: "#c58cf0", p: "#8a5ad6", Y: "#ffd23f", y: "#c99418" },
  rows: padTop(mirror([
    "....KKKK",
    "..KKPPPP",
    ".KPPpPPP",
    ".KPPPPPp",
    "KYYYYYYY",
    "KyyyyyyY",
    ".KPPPPpP",
    ".KpPPPPP",
    "..KKpppp",
    "....KKKK",
  ]), 16),
};
DECOR.planetblue = { rows: DECOR.planet.rows, colors: { P: "#7fc8f0", p: "#3a8ac0", Y: "#ff7ad8", y: "#c84ab0" } };
LANDMARKS.forest = {
  w: 34, h: 20,
  parts: [
    { ...DECOR.glowshroompink, x: 0, y: 2 },
    { ...DECOR.glowshroompink, x: 18, y: 2 },
    { ...DECOR.glowshroom, x: 9, y: 0 },
  ],
};
LANDMARKS.river = {
  w: 32, h: 18,
  parts: [
    { ...DECOR.palm, x: 0, y: 2 },
    { ...DECOR.palm, x: 15, y: 0 },
  ],
};
const CHEST_COLORS = { W: "#b07a3e", w: "#8a5a2a", Y: "#ffc93c" };
DECOR.chest = {
  colors: CHEST_COLORS,
  rows: padTop(mirror([
    "..KKKKKK",
    ".KWWWWWW",
    "KWwwwwww",
    "KWWWWWWW",
    "KKKKKKKK",
    "KYWWWWKY",
    "KYWWWWKK",
    "KYwwwwww",
    "KKKKKKKK",
  ]), 12),
};
DECOR.chestopen = {
  colors: CHEST_COLORS,
  rows: padTop(mirror([
    ".KKKKKKK",
    "KWWWWWWW",
    "KwwwwwwW",
    "KKKKKKKK",
    "KYYYYYYY",
    "KKKKKKKK",
    "KYWWWWKY",
    "KYwwwwww",
    "KKKKKKKK",
  ]), 12),
};
DECOR.signpost = {
  colors: { P: "#d9a86a", p: "#8a5a2a", W: "#8a5a2a" },
  rows: padTop(mirror([
    "KKKKKKKK",
    "KPPPPPPP",
    "KPpPPpPP",
    "KPPPpPPp",
    "KKKKKKKK",
    "......KW",
    "......KW",
    "......KW",
    "......KK",
  ]), 12),
};
DECOR.coin = {
  colors: { Y: "#ffc93c", y: "#c99418", W: "#fff6c8" },
  rows: mirror([
    "..KK",
    ".KYY",
    "KYWY",
    "KYYY",
    "KYYy",
    ".KYy",
    "..KK",
  ]),
};

// ---------- Drawing ----------

function paint(ctx, rows, colors, x0 = 0, y0 = 0) {
  const palette = { K: OUTLINE, ...colors };
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "." || !palette[ch]) return;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    });
  });
}

const cache = new Map();
const canvases = new Map(); // data URL -> canvas, for drawing sprites onto other canvases

// Sprites are drawn at their small size, then smoothed up with Scale2x - the
// classic pixel-art upscaler from old game emulators. It rounds off the
// stair-steps on curves and diagonals but keeps hard pixel edges, so things
// still look retro, just with finer detail. Each pass doubles the size.
const SMOOTHING_PASSES = 0; // 0: chunky pixels, like old games; 1: rounder edges
export const SPRITE_SCALE = 2 ** SMOOTHING_PASSES;

function scale2x(src) {
  const w = src.width, h = src.height;
  const from = new Uint32Array(src.getContext("2d").getImageData(0, 0, w, h).data.buffer);
  const out = document.createElement("canvas");
  out.width = w * 2;
  out.height = h * 2;
  const octx = out.getContext("2d");
  const image = octx.createImageData(w * 2, h * 2);
  const to = new Uint32Array(image.data.buffer);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : from[y * w + x]); // outside = see-through
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = from[y * w + x];
      const up = at(x, y - 1), right = at(x + 1, y), left = at(x - 1, y), down = at(x, y + 1);
      const o = y * 2 * (w * 2) + x * 2;
      to[o] = left === up && left !== down && up !== right ? up : p;
      to[o + 1] = up === right && up !== left && right !== down ? right : p;
      to[o + w * 2] = down === left && down !== right && left !== up ? left : p;
      to[o + w * 2 + 1] = right === down && right !== up && down !== left ? down : p;
    }
  }
  octx.putImageData(image, 0, 0);
  return out;
}

function draw(key, width, height, paintAll) {
  if (!cache.has(key)) {
    let canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    paintAll(canvas.getContext("2d"));
    for (let i = 0; i < SMOOTHING_PASSES; i++) canvas = scale2x(canvas);
    const url = canvas.toDataURL();
    cache.set(key, url);
    canvases.set(url, canvas);
  }
  return cache.get(key);
}

// The canvas behind any sprite URL from this file (for the biome, which
// draws sprites itself instead of using <img> tags).
export const spriteCanvas = (src) => canvases.get(src);

// ---------- Painted creatures ----------
// Creatures with painted art (assets/creatures/<id>-<stage>.png, cut from
// our Canva sheets by tools/cut_creature_sheets.py) use it instead of their
// pixel art. The pictures are big; the biome draws them smoothly at the size
// a pixel creature would be.
// Off for now: only a few creatures have painted art, and a mix of painted
// and pixel creatures looks uneven. Turn on once every line has its pictures.
const USE_PAINTED = false;
const PAINTED = USE_PAINTED ? PAINTED_ART : new Set();
const PAINTED_HEIGHT = 32; // a stage-1 painted creature's height in game pixels, like a pixel beast
const STAGE_GROWTH = [1, 1.2, 1.42]; // as .sprite.evolved.stage-N in style.css
const HEX_FILTER = "hue-rotate(250deg) saturate(0.75) brightness(0.8) contrast(1.1)"; // Hexbound: corrupted colors
const paintedPath = (id, stage) => `assets/creatures/${id}-${stage}.png`;
const paintedSizes = new WeakMap(); // canvas -> its size in game pixels
for (const id of PAINTED) {
  for (const stage of [1, 2, 3]) {
    const src = paintedPath(id, stage);
    const blank = document.createElement("canvas"); // until the picture loads
    blank.width = blank.height = 1;
    canvases.set(src, blank);
    canvases.set(`${src}#hexed`, blank);
    const image = new Image();
    image.onload = () => {
      const h = PAINTED_HEIGHT * STAGE_GROWTH[stage - 1];
      const size = { w: (h * image.naturalWidth) / image.naturalHeight, h };
      for (const hexed of [false, true]) {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (hexed) ctx.filter = HEX_FILTER;
        ctx.drawImage(image, 0, 0);
        paintedSizes.set(canvas, size);
        canvases.set(hexed ? `${src}#hexed` : src, canvas);
      }
    };
    image.src = src;
  }
}

// A sprite canvas's size in game pixels, and whether to draw it smoothly
// (painted art) or with crisp pixels.
export function spriteSize(canvas) {
  const painted = paintedSizes.get(canvas);
  return painted ? { ...painted, smooth: true } : { w: canvas.width / SPRITE_SCALE, h: canvas.height / SPRITE_SCALE, smooth: false };
}

// Which art each creature uses. Some are recolors of another creature.
// Crown Keep's creatures.
const KEEP_CREATURES = {
  // A tiny knight: a steel helmet with a red plume, eyes glowing through the visor.
  knightling: {
    colors: { S: "#c8ccd8", s: "#8a90a4", R: "#e8413b", Y: "#ffd23f", B: "#3f5fc8", E: "#fff27a" },
    rows: mirror([
      "...........K",
      "..........KR",
      ".........KRR",
      "........KRRR",
      ".........KRR",
      "......KKKKKK",
      ".....KSSSSSS",
      "....KSSSSSSS",
      "...KSSSSSSSS",
      "...KSsSSSSSS",
      "...KSsKKKKKK",
      "...KSsKEEKKK",
      "...KSsKKKKKK",
      "...KSsSSSSSS",
      "....KsSSSSSS",
      ".....KKKKKKK",
      "....KYBBBBBB",
      "...KSKBBBBBY",
      "...KSKBBBBYY",
      "....KKBBBBBY",
      ".....KBBBBBB",
      "......KSSK..",
      ".....KSSSK..",
      ".....KKKKK..",
    ]),
  },

  // Aurelion, the Queen's royal gryphon: an eagle's head and wings on a golden lion's body.
  gryphon: {
    colors: { W: "#fff6e0", w: "#d8c8a8", G: "#ffc93c", g: "#c9941a", O: "#f08a24", E: "#3a7fd6" },
    rows: mirror([
      "............",
      "...........K",
      "..........KW",
      "........KKWW",
      ".......KWWWW",
      "K.....KWWWWW",
      "KK....KWWEWW",
      "KWK...KWWWWO",
      "KWWK...KWWOO",
      "KWWWK...KWOO",
      "KwWWWK.KGKKK",
      ".KwWWWKGGGGG",
      ".KwwWWKGGgGG",
      "..KwwWKGGGGG",
      "..KwwWKGGGGG",
      "...KwKGGgGGG",
      "...KKGGGGGGG",
      "....KGGGGGGG",
      "....KgGGGGGG",
      "....KgGGGGGG",
      ".....KgGGKKK",
      ".....KGGK...",
      "....KGGGK...",
      "....KKKKK...",
    ]),
  },
};

const CREATURE_ART = {
  ...MONSTERS,
  ...NEW_CREATURES,
  ...KEEP_CREATURES,
  cat: PETS["pet-cat"],
  drake: PETS["pet-dragon"],
  // Starfall Realm creatures: recolors with an icy, sky, or void look.
  frostling: { ...NEW_CREATURES.slime, colors: { G: "#bfe8ff", g: "#7fb8e0", W: "#ffffff" } },
  shardgolem: { ...NEW_CREATURES.golem, colors: { R: "#b48ce0", r: "#7a5aa8", Y: "#ff8af0", M: "#7fe3ff" } },
  icewyrm: { ...MONSTERS.dragon, colors: { D: "#7fc8f0", d: "#3a8ac0", y: "#e8f7ff", h: "#ffffff", Y: "#4f6bff", W: "#ffffff" } },
  stormowl: { ...MONSTERS.owl, colors: { B: "#6a7894", b: "#465068", c: "#d8e0f0", Y: "#7fe3ff", O: "#ffd23f" } },
  shadowbat: { ...MONSTERS.bat, colors: { P: "#4a4060", p: "#2c2638", R: "#ff4df0", W: "#ffffff" } },
  voidkraken: { ...MONSTERS.octopus, colors: { O: "#8a4fd6", o: "#5a2fa0", W: "#7fffd4" } },
};



// Every creature except Malgrath is a critter, built from shared parts so
// they all look like one family (critters.js).
// Creatures are side-view beasts (beasts.js) in their critter colors (critters.js).
for (const [id, spec] of Object.entries(CRITTERS)) CREATURE_ART[id] = BEASTS[id] ? buildBeast({ ...BEASTS[id], colors: spec.colors }) : buildCritter(spec);

// Malgrath the Hollow King, the final boss.
CREATURE_ART.malgrath = {
  colors: { Y: "#ffc93c", H: "#3a2a5e", h: "#120a24", E: "#ff4df0", R: "#c58cf0" },
  rows: padTop(mirror([
    "......Y...Y.",
    "......YY.YYY",
    "......YYYYYY",
    ".....KHHHHHH",
    "....KHHHHHHH",
    "....KHhhhhhh",
    "...KHhhEEhhh",
    "...KHhhEEhhh",
    "...KHhhhhhhh",
    "..KHHhhhhhhh",
    "..KHHHhhhhhh",
    ".KHRHHHHHHHH",
    ".KHRHHHHHHHH",
    "KHHRHHHHHHHH",
    "KHHRHHHHHHHH",
    "KHRHHHHHHHHH",
    "KHRHHHHHHHHH",
    "KRRHHHHHHHHH",
    "KKKKKKKKKKKK",
  ]), 24),
};

// Hexbound creatures: the same sprite, corrupted by Malgrath's hex. They keep
// their own colors (a forest critter still looks green), just a little dim
// and sickly; their eyes glow, dark veins with glowing specks creep across
// the body, and dark ooze drips from it. Breaking the hex brings back the
// real colors.
const HEX_OUTLINE = "#10070f";
const HEX_EYES = "#ff3a6e";
const HEX_VEIN = "#2a0f2e"; // the dark of the veins
const HEX_GLOW = "#e04cff"; // specks glowing in them
const HEX_OOZE = "#1c0a22";

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

function hexedColors(art) {
  // Critters (critters.js) mark their eyes: P glows, everything else is dimmed.
  // Older sprites don't, so there small bright bits are taken to be eyes.
  const marked = "E" in art.colors;
  const counts = {};
  let total = 0;
  for (const row of art.rows) for (const ch of row) if (ch !== ".") (counts[ch] = (counts[ch] || 0) + 1), total++;
  const out = { K: HEX_OUTLINE };
  for (const [ch, color] of Object.entries(art.colors)) {
    const [r, g, b] = rgbOf(color);
    const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (marked ? ch === "P" : light > 0.7 && (counts[ch] || 0) / total < 0.1) {
      out[ch] = HEX_EYES;
      continue;
    }
    // Their own color, a little washed out and darker: sickly, not purple.
    const grey = (r + g + b) / 3;
    out[ch] = toHex([r, g, b].map((v) => (v * 0.8 + grey * 0.2) * 0.8));
  }
  return out;
}

// Dark veins creeping across the body, with specks glowing in them.
function hexCracks(ctx, w, h, id) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const [or, og, ob] = rgbOf(HEX_OUTLINE);
  const [er, eg, eb] = rgbOf(HEX_EYES);
  const vein = rgbOf(HEX_VEIN), glow = rgbOf(HEX_GLOW);
  const at = (x, y) => (y * w + x) * 4;
  const body = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const i = at(x, y);
    if (!d[i + 3]) return false;
    if (d[i] === or && d[i + 1] === og && d[i + 2] === ob) return false;
    return !(d[i] === er && d[i + 1] === eg && d[i + 2] === eb);
  };
  let seed = [...id].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7);
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let crack = 0; crack < 3 + Math.floor(rand() * 2); crack++) {
    let x = 0, y = 0, found = false;
    for (let tries = 0; tries < 60 && !found; tries++) {
      x = Math.floor(rand() * w);
      y = Math.floor(h * 0.3 + rand() * h * 0.3);
      found = body(x, y);
    }
    for (let step = 0; found && step < 4 + Math.floor(rand() * 5); step++) {
      const i = at(x, y);
      d.set(step % 3 === 1 ? glow : vein, i);
      y++;
      x += Math.floor(rand() * 3) - 1;
      if (!body(x, y)) break;
    }
  }
  ctx.putImageData(image, 0, 0);
}

// ---------- Lighting ----------
// Gives flat sprites volume, the way a pixel artist shades by hand. Each
// pixel's distance from the sprite's edge is treated as height, so the body
// bulges like a pillow; that bump is lit from the top left and the result is
// snapped to a few flat tones (highlight, light, base, shade, deep shade),
// warm in the light and cool in the shadow. Lines inside the sprite (not its
// outer edge) become a dark shade of the colors around them instead of
// black, so faces and details look softer. Done at the sprite's own size,
// before smoothing, so it stays crisp.
const OUTLINES = new Set([OUTLINE, HEX_OUTLINE, "#1a0f2e"].map((c) => rgbOf(c).join()));
const LIGHT = [255, 244, 214];
const SHADOW = [38, 22, 70];

function shadeSprite(ctx, w, h) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const src = new Uint8ClampedArray(d);
  const at = (x, y) => (y * w + x) * 4;
  const clear = (x, y) => x < 0 || y < 0 || x >= w || y >= h || src[at(x, y) + 3] === 0;
  const line = (x, y) => !clear(x, y) && OUTLINES.has(`${src[at(x, y)]},${src[at(x, y) + 1]},${src[at(x, y) + 2]}`);
  const mix = (i, to, t) => {
    for (let k = 0; k < 3; k++) d[i + k] = src[i + k] + (to[k] - src[i + k]) * t;
  };
  // How much of the sprite each color covers: small bright spots are eye
  // shines and sparkles, left as drawn; a mostly-white body still gets shaded.
  const share = new Map();
  let solid = 0;
  for (let i = 0; i < src.length; i += 4) {
    if (!src[i + 3]) continue;
    const key = (src[i] << 16) | (src[i + 1] << 8) | src[i + 2];
    share.set(key, (share.get(key) || 0) + 1);
    solid++;
  }
  const sparkle = (i) => {
    const light = (0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]) / 255;
    return light > 0.85 && share.get((src[i] << 16) | (src[i + 1] << 8) | src[i + 2]) / solid < 0.08;
  };

  // Distance from the edge (two-pass chamfer), capped so big bodies get a
  // rounded rim and a flat middle rather than one giant cone.
  const rim = Math.max(2.5, Math.min(w, h) / 5);
  const dist = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) dist[y * w + x] = clear(x, y) ? 0 : 1e9;
  const dAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : dist[y * w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (dist[y * w + x]) dist[y * w + x] = Math.min(dist[y * w + x], dAt(x - 1, y) + 1, dAt(x, y - 1) + 1, dAt(x - 1, y - 1) + 1.4, dAt(x + 1, y - 1) + 1.4);
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--)
      if (dist[y * w + x]) dist[y * w + x] = Math.min(dist[y * w + x], dAt(x + 1, y) + 1, dAt(x, y + 1) + 1, dAt(x + 1, y + 1) + 1.4, dAt(x - 1, y + 1) + 1.4);
  // A rounded bevel: steep at the edge, flat on top.
  const height = (x, y) => {
    const t = Math.min(1, dAt(x, y) / rim);
    return Math.sqrt(1 - (1 - t) * (1 - t)) * rim;
  };
  const L = [-0.55, -0.7, 0.45];
  const flat = L[2];
  // Tone bands: how far a pixel's lighting is from facing the camera head on.
  const tone = (x, y) => {
    const gx = (height(x + 1, y) - height(x - 1, y)) / 2;
    const gy = (height(x, y + 1) - height(x, y - 1)) / 2;
    const n = [-gx, -gy, 1];
    const len = Math.hypot(...n);
    return (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / len - flat;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (clear(x, y)) continue;
      const i = at(x, y);
      if (line(x, y)) {
        // An inner line: tint it with the body colors next to it.
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => clear(x + dx, y + dy))) continue;
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !line(x + dx, y + dy)).map(([dx, dy]) => at(x + dx, y + dy));
        if (!near.length) continue;
        for (let k = 0; k < 3; k++) d[i + k] = (near.reduce((s, j) => s + src[j + k], 0) / near.length) * 0.38;
        continue;
      }
      if (sparkle(i)) continue;
      const t = tone(x, y);
      if (t > 0.3) mix(i, LIGHT, 0.34);
      else if (t > 0.1) mix(i, LIGHT, 0.16);
      else if (t < -0.35) mix(i, SHADOW, 0.46);
      else if (t < -0.12) mix(i, SHADOW, 0.26);
    }
  }
  ctx.putImageData(image, 0, 0);
}

// Hexbound creatures give off dark smoke: a soft ring just outside their
// outline, and ooze dripping off the bottom (a pulse and drifting motes are
// added by CSS and game.js).
const HEX_AURA = [40, 14, 46]; // a dark, smoky edge

function hexAura(ctx, w, h) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const ring1 = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) ring1.push((y * w + x) * 4);
  for (const i of ring1) d.set([...HEX_AURA, 110], i);
  // Ooze: a few dark drips hanging off the bottom of the body.
  const ooze = rgbOf(HEX_OOZE), shine = rgbOf(HEX_GLOW);
  let bottom = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid(x, y)) bottom = Math.max(bottom, y);
  for (let x = 2; x < w - 2; x += 3 + ((x * 7) % 3)) {
    let y = h - 1;
    while (y > 0 && !solid(x, y)) y--;
    if (y < bottom - 3) continue;
    const len = 1 + ((x * 5) % 3);
    for (let k = 1; k <= len && y + k < h; k++) d.set([...(k === len ? shine : ooze), 255], ((y + k) * w + x) * 4);
  }
  ctx.putImageData(image, 0, 0);
}

// ---------- Walking ----------
// A 4-frame walk cycle, made from any sprite: 0 feet down, 1 left foot up,
// 2 feet down, 3 right foot up. Lifting a foot moves the bottom few rows on
// one side of the sprite up a pixel. (The biome also bobs the body on steps.)
export const WALK_FRAMES = 4;

function liftFoot(ctx, w, h, frame) {
  if (frame % 2 === 0) return;
  // Lift the foot high, so every step reads clearly: 3 pixels on bigger
  // sprites, 2 on small ones.
  for (let i = 0; i < (h >= 24 ? 3 : 2); i++) liftFootOnce(ctx, w, h, frame);
}

function liftFootOnce(ctx, w, h, frame) {
  const legRows = h >= 24 ? 3 : 2;
  const top = h - legRows - 1; // includes one row above the feet
  const image = ctx.getImageData(0, top, w, legRows + 1);
  const d = image.data;
  const alpha = (x, r) => d[(r * w + x) * 4 + 3];
  // Find the middle of the feet, then lift the left or right half.
  let minX = w, maxX = -1;
  for (let r = 1; r <= legRows; r++) for (let x = 0; x < w; x++) if (alpha(x, r)) (minX = Math.min(minX, x)), (maxX = Math.max(maxX, x));
  if (maxX < 0) return;
  const mid = (minX + maxX + 1) / 2;
  const onSide = (x) => (frame === 1 ? x < mid : x >= mid);
  for (let r = 0; r < legRows; r++) {
    for (let x = 0; x < w; x++) {
      if (!onSide(x)) continue;
      const from = ((r + 1) * w + x) * 4, to = (r * w + x) * 4;
      if (r === 0 && !d[from + 3]) continue; // keep the body above where there's no foot
      for (let k = 0; k < 4; k++) d[to + k] = d[from + k];
    }
  }
  for (let x = 0; x < w; x++) if (onSide(x)) d.fill(0, (legRows * w + x) * 4, (legRows * w + x) * 4 + 4);
  ctx.putImageData(image, 0, top);
}

// ---------- Evolved ----------
// An evolved buddy: the same creature, grown up. Richer, deeper colors, a
// darker outline, and a golden glow around its edge (the sprite is shown a
// bit bigger too, with the "evolved" class).
const EVOLVED_GLOW = "#ffd23f";
const EVOLVED_OUTLINE = "#1a0f2e";

function evolvedColors(art) {
  const out = { K: EVOLVED_OUTLINE };
  for (const [ch, color] of Object.entries(art.colors)) {
    const [r, g, b] = rgbOf(color);
    const grey = (r + g + b) / 3;
    // More saturated, a touch deeper.
    out[ch] = toHex([r, g, b].map((v) => (grey + (v - grey) * 1.45) * 0.95));
  }
  return out;
}

// A 1-pixel golden outline around everything already drawn.
function glow(ctx, w, h) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const [gr, gg, gb] = rgbOf(EVOLVED_GLOW);
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const edge = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) edge.push((y * w + x) * 4);
  for (const i of edge) d.set([gr, gg, gb, 200], i);
  ctx.putImageData(image, 0, 0);
}

// An evolved buddy's art (stage 2 or 3; see evolveSpec in critters.js).
// Creatures that aren't critters just get richer colors.
const evolvedArts = new Map();
function evolvedArt(id, stage) {
  const key = `${id}:${stage}`;
  if (!evolvedArts.has(key)) {
    const element = CREATURES.find((c) => c.id === id)?.element;
    const extra = (STAGE_FEATS[element] || []).slice(0, stage - 1).flat();
    const art = BEASTS[id] && CRITTERS[id]
      ? buildBeast({ ...BEASTS[id], colors: evolveSpec(CRITTERS[id], element, stage).colors }, stage, extra)
      : CRITTERS[id] ? buildCritter(evolveSpec(CRITTERS[id], element, stage)) : { rows: CREATURE_ART[id].rows, colors: evolvedColors(CREATURE_ART[id]) };
    evolvedArts.set(key, art);
  }
  return evolvedArts.get(key);
}
// `stage` can be given as true (an old "evolved" flag): stage 2.
const stageNumber = (stage) => (stage === true ? 2 : stage || 1);

// `hexed`: draw the corrupted Hexbound version. `frame`: a walking frame.
// `stage`: the evolution stage, 1-3 (see stageOf in config.js). Stage 3
// has a golden glow around it.
export function creatureSrc(id, hexed = false, frame = 0, stage = 1) {
  stage = stageNumber(stage);
  if (PAINTED.has(id)) return hexed ? `${paintedPath(id, 1)}#hexed` : paintedPath(id, stage);
  if (stage > 1 && !hexed) {
    const art = evolvedArt(id, stage);
    const w = art.rows[0].length, h = art.rows.length;
    const pad = stage === 3 ? 1 : 0; // room for the glow
    return draw(`creature:${id}:stage${stage}:${frame}`, w + pad * 2, h + pad * 2, (ctx) => {
      paint(ctx, art.rows, art.colors, pad, pad);
      shadeSprite(ctx, w + pad * 2, h + pad * 2);
      liftFoot(ctx, w + pad * 2, h + pad * 2, frame);
      if (stage === 3) glow(ctx, w + 2, h + 2);
    });
  }
  const art = CREATURE_ART[id];
  const w = art.rows[0].length, h = art.rows.length;
  if (!hexed) {
    return draw(`creature:${id}:${frame}`, w, h, (ctx) => {
      paint(ctx, art.rows, art.colors);
      shadeSprite(ctx, w, h);
      liftFoot(ctx, w, h, frame);
    });
  }
  // One pixel of room on every side for the hex aura.
  return draw(`creature:${id}:hexed:${frame}`, w + 2, h + 2, (ctx) => {
    paint(ctx, art.rows, hexedColors(art), 1, 1);
    hexCracks(ctx, w + 2, h + 2, id);
    shadeSprite(ctx, w + 2, h + 2);
    liftFoot(ctx, w + 2, h + 2, frame);
    hexAura(ctx, w + 2, h + 2);
  });
}

// Small (12 px) creatures get a "small" class so they can be shown bigger.
// Evolved ones (`stage` 2 or 3) are shown bigger too.
export function creatureImg(id, cls = "", hexed = false, stage = 1) {
  stage = stageNumber(stage);
  const painted = PAINTED.has(id);
  const small = !painted && CREATURE_ART[id].rows.length <= 12;
  return img(creatureSrc(id, hexed, 0, stage), `creature ${small ? "small" : ""}${painted ? " painted" : ""}${stage > 1 ? ` evolved stage-${stage}` : ""}${hexed ? " hexed" : ""} ${cls}`, id);
}

// Scenery is toned down (less saturated, a little darker) so the world looks
// calmer and the creatures stand out against it.
function mute(ctx, w, h, saturation = 0.85, brightness = 0.95) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const grey = (d[i] + d[i + 1] + d[i + 2]) / 3;
    for (let k = 0; k < 3; k++) d[i + k] = (grey + (d[i + k] - grey) * saturation) * brightness;
  }
  ctx.putImageData(image, 0, 0);
}

export function decorSrc(id) {
  const art = DECOR[id];
  const w = art.rows[0].length, h = art.rows.length;
  return draw(`decor:${id}`, w, h, (ctx) => {
    paint(ctx, art.rows, art.colors);
    mute(ctx, w, h);
  });
}

const img = (src, cls, alt = "") => `<img class="sprite ${cls}" src="${src}" alt="${alt}" draggable="false">`;

// `frame`: a walking frame (see liftFoot). `wand`: villagers don't carry one.
// `look.armor`: the armor set your hero wears (ARMOR in config.js), which
// replaces the outfit with its own style and colors.
export function heroSrc(look, hatId = null, frame = 0, wand = true) {
  const armor = armorById(look?.armor);
  look = normalizeLook(look);
  return draw(`hero:${JSON.stringify(look)}:${armor.id}:${hatId}:${frame}:${wand}`, 20, 30, (ctx) => {
    const colors = { ...HERO_BASE };
    for (const part of ["hair", "skin", "eyes", "outfit"]) Object.assign(colors, LOOK_OPTIONS[part].choices[look[part]]);
    if (armor.style) Object.assign(colors, armor.colors);
    paint(ctx, HEAD, colors, 2, 6);
    paint(ctx, OUTFIT_ROWS[armor.style || look.outfitStyle], colors, 2, 6 + HEAD.length);
    paint(ctx, HAIR_ROWS[look.hairStyle], colors, 2, 6);
    paint(ctx, GLASSES_ROWS[look.glasses], colors, 2, 6);
    const weapon = WEAPONS[look.weapon];
    if (wand) paint(ctx, weapon.rows, colors, weapon.x, weapon.y);
    if (wand && weapon.shield) paint(ctx, weapon.shield.rows, colors, weapon.shield.x, weapon.shield.y);
    const hat = HATS[hatId];
    if (hat) paint(ctx, hat.rows, hat.colors, 2, hat.top);
    shadeSprite(ctx, 20, 30);
    liftFoot(ctx, 20, 30, frame);
  });
}

export function landmarkSrc(zoneId) {
  const lm = LANDMARKS[zoneId];
  return draw(`landmark:${zoneId}`, lm.w, lm.h, (ctx) => {
    for (const part of lm.parts) paint(ctx, part.rows, part.colors, part.x || 0, part.y || 0);
    mute(ctx, lm.w, lm.h, 0.88, 0.96);
  });
}

// Shop and battle icons: just the hat or potion, cropped tight.
export function itemSrc(itemId) {
  const art = HATS[itemId] || CONSUMABLES[itemId];
  const w = art.rows[0].length, h = art.rows.length;
  return draw(`item:${itemId}`, w, h, (ctx) => {
    paint(ctx, art.rows, art.colors);
    shadeSprite(ctx, w, h);
  });
}

export const heroImg = (look, hatId, cls = "", wand = true) => img(heroSrc(look, hatId, 0, wand), `hero ${cls}`, wand ? "your hero" : "");
export const itemImg = (itemId) => img(itemSrc(itemId), HATS[itemId] ? "item hat-item" : "item use-item");
