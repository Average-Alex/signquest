// Pixel-art sprites: hero maker parts, hats, pets, potions, monsters, and
// world map landmarks.
//
// Each sprite is drawn as text: one character per pixel, looked up in a
// palette ("." is see-through). Most sprites are symmetric, so only the left
// half is written and it's mirrored to make the right half. Sprites are
// painted once onto a canvas and shown as <img> tags scaled up with
// `image-rendering: pixelated`, so they stay crisp at any size.

const OUTLINE = "#2b1d2e";

// Mirror each half-row: "..KH" -> "..KHHK..".
const mirror = (rows) => rows.map((r) => r + [...r].reverse().join(""));

// ---------- Heroes ----------
// Players build their own hero from a "look": hair style and color, skin,
// eyes, outfit style and color, glasses. The body is drawn first, then hair,
// glasses, hat, and wand on top. 16 x 24 body on a 20 x 30 canvas: 6 rows
// above for tall hats and 2 columns each side for the wand.

const HEAD = mirror([
  "........",
  "........",
  "....KKKK",
  "..KKSSSS",
  ".KSSSSSS",
  ".KSSSSSS",
  ".KSSSSSS",
  ".KSSSSSS",
  ".KSEEESS",
  ".KSEBBSS",
  ".KSEBBSS",
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

// Wand in the hero's right hand (the viewer's right).
const WAND = [
  ".K.",
  "KGK",
  "KgK",
  ".K.",
  ".W.", ".W.", ".W.", ".W.", ".W.", ".W.", ".W.", ".W.", ".W.", ".W.", ".K.",
];

const HERO_BASE = { K: OUTLINE, E: "#ffffff", c: "#f29aa6", W: "#8a5a32", P: "#3d3352" };

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
    choices: { robe: { name: "Robe" }, tunic: { name: "Tunic" } },
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
  mage: { hairStyle: "short", hair: "pink", skin: "s1", eyes: "blue", outfitStyle: "robe", outfit: "purple", glasses: "none" },
  ranger: { hairStyle: "long", hair: "brown", skin: "s4", eyes: "brown", outfitStyle: "tunic", outfit: "green", glasses: "none" },
  knight: { hairStyle: "spiky", hair: "blonde", skin: "s2", eyes: "green", outfitStyle: "tunic", outfit: "silver", glasses: "none" },
  storm: { hairStyle: "curly", hair: "black", skin: "s6", eyes: "brown", outfitStyle: "robe", outfit: "blue", glasses: "round" },
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
LANDMARKS.spires = recolor(LANDMARKS.caves, { W: "#ffffff", w: "#cfe3f2", R: "#b8d8f0", r: "#7fa8d0", D: "#3a2a6e" });
LANDMARKS.clouds = recolor(LANDMARKS.castle, { R: "#4f8aff", r: "#2f5ad0", S: "#ffffff", s: "#d0d8f0", Y: "#ffe066", D: "#c9b277" });

// New scenery for the realm, plus things to find while exploring.
DECOR.cloud = { rows: DECOR.bush.rows, colors: { G: "#ffffff", g: "#c8d0f0" } };
DECOR.voidrock = { rows: DECOR.rock.rows, colors: { R: "#4a3a6e", r: "#2e2448", w: "#c58cf0" } };
DECOR.icecrystal = { rows: DECOR.crystal.rows, colors: { C: "#bfe8ff", c: "#7fb8e0", w: "#ffffff" } };
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
const SMOOTHING_PASSES = 1;
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
  // A royal beetle with a little gold crown and a jeweled shell.
  crownbug: {
    colors: { P: "#9a5ae0", p: "#6a3aa8", Y: "#ffd23f", k: "#2a2040", W: "#ffffff" },
    rows: mirror([
      "............",
      "............",
      "........K..K",
      "........KYKY",
      "........KYYY",
      "........KKKK",
      ".......KkWkk",
      ".......Kkkkk",
      "......KKKKKK",
      ".....KPYPPPK",
      "....KPPPPPPK",
      "...KPPPYPPPK",
      "...KPPPPPPPK",
      "..KPYPPPPPPK",
      "..KPPPPPYPPK",
      "..KPPPPPPPPK",
      "..KpPPPYPPPK",
      "...KpPPPPPPK",
      "...KppPPPPPK",
      "....KppppppK",
      ".....KKKKKKK",
      "....K.K..K..",
      "...K..K..K..",
      "............",
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
  gloop: { ...NEW_CREATURES.slime, colors: { G: "#b06aff", g: "#7a3fd0", W: "#f2e0ff" } },
  splash: { ...MONSTERS.frog, colors: { G: "#4fb3ff", g: "#2a7fc0", y: "#d4f0ff", W: "#ffffff", r: "#ff7a8a" } },
  bunny: PETS["pet-bunny"],
  pup: PETS["pet-dog"],
  unicorn: PETS["pet-unicorn"],
  cat: PETS["pet-cat"],
  drake: PETS["pet-dragon"],
  // Starfall Realm creatures: recolors with an icy, sky, or void look.
  frostling: { ...NEW_CREATURES.slime, colors: { G: "#bfe8ff", g: "#7fb8e0", W: "#ffffff" } },
  shardgolem: { ...NEW_CREATURES.golem, colors: { R: "#b48ce0", r: "#7a5aa8", Y: "#ff8af0", M: "#7fe3ff" } },
  icewyrm: { ...MONSTERS.dragon, colors: { D: "#7fc8f0", d: "#3a8ac0", y: "#e8f7ff", h: "#ffffff", Y: "#4f6bff", W: "#ffffff" } },
  puffcap: { ...NEW_CREATURES.shroom, colors: { R: "#ff9ad5", r: "#d9609f", W: "#ffffff", C: "#fff4e0", c: "#e8d4b8" } },
  skyhop: { ...PETS["pet-bunny"], colors: { W: "#dfe8ff", p: "#9ab8ff", w: "#b8c4e8" } },
  stormowl: { ...MONSTERS.owl, colors: { B: "#6a7894", b: "#465068", c: "#d8e0f0", Y: "#7fe3ff", O: "#ffd23f" } },
  voidghost: { ...NEW_CREATURES.ghost, colors: { W: "#8a6ac0", w: "#5a3f8a", p: "#ff7ad9" } },
  shadowbat: { ...MONSTERS.bat, colors: { P: "#4a4060", p: "#2c2638", R: "#ff4df0", W: "#ffffff" } },
  voidkraken: { ...MONSTERS.octopus, colors: { O: "#8a4fd6", o: "#5a2fa0", W: "#7fffd4" } },
};

// Pip, the fox-moth who travels with you (and the Beacon's lost spirit).
CREATURE_ART.pip = {
  colors: { O: "#f08a24", o: "#b85f12", W: "#fff4e0", M: "#c58cf0", m: "#8a5ad6", L: "#ffe066", l: "#ffb020" },
  rows: padTop(mirror([
    "...L........",
    "..KlK.......",
    "...K........",
    "....K..K....",
    ".....KKOK...",
    "......KOOK..",
    "......KOoOKK",
    ".....KOOOOOO",
    ".KK..KOOOOOO",
    "KMMK.KOKKOOO",
    "KMmMKKOKKOOW",
    "KMmmMKOOOOWW",
    "KMmMmKOOOWWK",
    "KMmmMKKOOWWW",
    ".KMmMK.KOOWW",
    "..KMK..KOOOO",
    "...K...KOOOO",
    ".......KOoOO",
    ".......KOKOO",
    ".......KKKKK",
  ]), 24),
};

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

// Hexbound creatures: the same sprite, corrupted by Malgrath's hex. Their
// colors are drained and darkened toward a sickly purple, small bright spots
// (their eyes) glow red, and jagged hex cracks run across the body. Breaking
// the hex brings back the real colors.
const HEX_OUTLINE = "#14091c";
const HEX_EYES = "#ff3355";
const HEX_CRACK = "#b04ae8";
const HEX_TINT = [58, 26, 84];

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

function hexedColors(art) {
  // How much of the creature each color covers: small bright bits are eyes.
  const counts = {};
  let total = 0;
  for (const row of art.rows) for (const ch of row) if (ch !== ".") (counts[ch] = (counts[ch] || 0) + 1), total++;
  const out = { K: HEX_OUTLINE };
  for (const [ch, color] of Object.entries(art.colors)) {
    const [r, g, b] = rgbOf(color);
    const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (light > 0.7 && (counts[ch] || 0) / total < 0.1) {
      out[ch] = HEX_EYES;
      continue;
    }
    const grey = (r + g + b) / 3;
    out[ch] = toHex([r, g, b].map((v, i) => (v * 0.35 + grey * 0.65) * 0.55 * 0.85 + HEX_TINT[i] * 0.45 * 0.85));
  }
  return out;
}

// Two jagged cracks, running down from the upper half of the body.
function hexCracks(ctx, w, h, id) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const [or, og, ob] = rgbOf(HEX_OUTLINE);
  const [er, eg, eb] = rgbOf(HEX_EYES);
  const [cr, cg, cb] = rgbOf(HEX_CRACK);
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
  for (let crack = 0; crack < 2; crack++) {
    let x = 0, y = 0, found = false;
    for (let tries = 0; tries < 60 && !found; tries++) {
      x = Math.floor(rand() * w);
      y = Math.floor(h * 0.3 + rand() * h * 0.3);
      found = body(x, y);
    }
    for (let step = 0; found && step < 4 + Math.floor(rand() * 5); step++) {
      const i = at(x, y);
      d.set([cr, cg, cb], i);
      y++;
      x += Math.floor(rand() * 3) - 1;
      if (!body(x, y)) break;
    }
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
  // Bigger sprites lift their foot 2 pixels, so the step shows at game size.
  for (let i = 0; i < (h >= 24 ? 2 : 1); i++) liftFootOnce(ctx, w, h, frame);
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

// `hexed`: draw the corrupted Hexbound version. `frame`: a walking frame.
// `evolved`: the evolved version (see EVOLUTIONS in config.js).
export function creatureSrc(id, hexed = false, frame = 0, evolved = false) {
  const art = CREATURE_ART[id];
  const w = art.rows[0].length, h = art.rows.length;
  if (evolved && !hexed) {
    // One pixel of room on every side for the glow.
    return draw(`creature:${id}:evolved:${frame}`, w + 2, h + 2, (ctx) => {
      paint(ctx, art.rows, evolvedColors(art), 1, 1);
      liftFoot(ctx, w + 2, h + 2, frame);
      glow(ctx, w + 2, h + 2);
    });
  }
  if (!hexed) {
    return draw(`creature:${id}:${frame}`, w, h, (ctx) => {
      paint(ctx, art.rows, art.colors);
      liftFoot(ctx, w, h, frame);
    });
  }
  return draw(`creature:${id}:hexed:${frame}`, w, h, (ctx) => {
    paint(ctx, art.rows, hexedColors(art));
    hexCracks(ctx, w, h, id);
    liftFoot(ctx, w, h, frame);
  });
}

// Small (12 px) creatures get a "small" class so they can be shown bigger.
export function creatureImg(id, cls = "", hexed = false, evolved = false) {
  const small = CREATURE_ART[id].rows.length <= 12;
  return img(creatureSrc(id, hexed, 0, evolved), `creature ${small ? "small" : ""}${evolved ? " evolved" : ""} ${cls}`, id);
}

export function decorSrc(id) {
  const art = DECOR[id];
  return draw(`decor:${id}`, art.rows[0].length, art.rows.length, (ctx) => paint(ctx, art.rows, art.colors));
}

const img = (src, cls, alt = "") => `<img class="sprite ${cls}" src="${src}" alt="${alt}" draggable="false">`;

// `frame`: a walking frame (see liftFoot). `wand`: villagers don't carry one.
export function heroSrc(look, hatId = null, frame = 0, wand = true) {
  look = normalizeLook(look);
  return draw(`hero:${JSON.stringify(look)}:${hatId}:${frame}:${wand}`, 20, 30, (ctx) => {
    const colors = { ...HERO_BASE };
    for (const part of ["hair", "skin", "eyes", "outfit"]) Object.assign(colors, LOOK_OPTIONS[part].choices[look[part]]);
    paint(ctx, HEAD, colors, 2, 6);
    paint(ctx, OUTFIT_ROWS[look.outfitStyle], colors, 2, 6 + HEAD.length);
    paint(ctx, HAIR_ROWS[look.hairStyle], colors, 2, 6);
    paint(ctx, GLASSES_ROWS[look.glasses], colors, 2, 6);
    if (wand) paint(ctx, WAND, colors, 15, 12);
    const hat = HATS[hatId];
    if (hat) paint(ctx, hat.rows, hat.colors, 2, hat.top);
    liftFoot(ctx, 20, 30, frame);
  });
}

export function landmarkSrc(zoneId) {
  const lm = LANDMARKS[zoneId];
  return draw(`landmark:${zoneId}`, lm.w, lm.h, (ctx) => {
    for (const part of lm.parts) paint(ctx, part.rows, part.colors, part.x || 0, part.y || 0);
  });
}

// Shop and battle icons: just the hat or potion, cropped tight.
export function itemSrc(itemId) {
  const art = HATS[itemId] || CONSUMABLES[itemId];
  return draw(`item:${itemId}`, art.rows[0].length, art.rows.length, (ctx) => paint(ctx, art.rows, art.colors));
}

export const heroImg = (look, hatId, cls = "", wand = true) => img(heroSrc(look, hatId, 0, wand), `hero ${cls}`, wand ? "your hero" : "");
export const itemImg = (itemId) => img(itemSrc(itemId), HATS[itemId] ? "item hat-item" : "item use-item");
