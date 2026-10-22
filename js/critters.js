// Critters: every creature in the game is built from the same parts, so
// they all look like one family: one of a few BODIES (same size, facing you,
// same eyes and outline), plus PARTS on top (ears, horns, a leaf sprout,
// wings, a tail...), in its own colors. Sprites are 24 x 24 like the rest.
//
// Pixel letters: K outline, B body, b body shade, L belly, P eye, E the
// shine in the eye, c blush, A accent (horns, leaves, flames...), a accent shade, F a bird's
// beak and feet. "." is
// see-through. Bodies and most parts are left halves, mirrored to make the
// right half (see sprites.js).

// Each body: its rows (left half), the row where its head starts (`top`),
// and the column parts on the head line up with (`ear`).
export const BODIES = {
  // A round dome: slimes, wisps, blobs.
  blob: {
    top: 10, ear: 3,
    rows: [
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      "......KKKKKK",
      "....KKBBBBBB",
      "...KBBBBBBBB",
      "..KBBBBBEPBB",
      "..KBBBBBPPBB",
      ".KBBBBcBBBBB",
      ".KBBBBBBBBBK",
      ".KBbBBBBBLLL",
      "KBbBBBBBLLLL",
      "KBbBBBBBLLLL",
      "KbbBBBBBBLLL",
      "KbbbBBBBBBBB",
      ".KbbbbbbbbBB",
      "..KKKKKKKKKK",
    ],
  },
  // Sitting on four legs, with a big head: foxes, pups, lizards, dragons.
  pup: {
    top: 6, ear: 3,
    rows: [
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      ".....KKKKKKK",
      "....KBBBBBBB",
      "...KBBBBBBBB",
      "..KBBBBBEPBB",
      "..KBBBBBPPBB",
      "..KBBBcBBBBB",
      "..KBBBBBBBLL",
      "...KBBBBBLLK",
      "....KBBBBBLL",
      ".....KKBBBBB",
      "....KBBBBLLL",
      "...KBBBBLLLL",
      "...KBbBBLLLL",
      "...KBbBBBLLL",
      "...KbbBBBBBB",
      "....KbBBKLLK",
      "....KKKKKLLK",
      "........KKKK",
    ],
  },
  // A round bird: wings at its sides, a little beak, two feet.
  bird: {
    top: 7, ear: 4,
    rows: [
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      ".......KKKKK",
      ".....KKBBBBB",
      "....KBBBBBBB",
      "...KBBBBEPBB",
      "...KBBBBPPBB",
      "...KBBBcBBBF",
      "...KBBBBBBKF",
      "...KBBBBBLLL",
      "...KBBBBLLLL",
      "...KBbBBLLLL",
      "...KBbBBLLLL",
      "...KBbbBBLLL",
      "....KbbBBBBB",
      ".....KKbbbbb",
      "......KKKKKK",
      ".......KFK..",
      "......KFFFK.",
    ],
  },
  // Standing on two feet, with stubby arms: imps, golems, sprites.
  biped: {
    top: 5, ear: 3,
    rows: [
      "............",
      "............",
      "............",
      "............",
      "............",
      "......KKKKKK",
      "....KKBBBBBB",
      "...KBBBBBBBB",
      "..KBBBBBEPBB",
      "..KBBBBBPPBB",
      "..KBBBcBBBBB",
      "..KBBBBBBBBK",
      "...KBBBBBBBB",
      "....KKBBBBBB",
      "....KbBBBLLL",
      "...KBKBBLLLL",
      "..KBBKBBLLLL",
      "..KBbKBBLLLL",
      "...KKKBBBLLL",
      "....KbBBBBBB",
      "....KbbBBKKK",
      "....KbbBK...",
      "...KbbbBK...",
      "...KKKKKK...",
    ],
  },
  // A bug or crab: a wide shell on top, a face underneath, little legs.
  bug: {
    top: 9, ear: 3,
    rows: [
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      "......KKKKKK",
      "....KKBBBBBB",
      "...KBBBBBABB",
      "..KBBBBBBBBB",
      "..KBBABBBBBB",
      ".KBBBBBBBBBB",
      ".KbbbbbbbbbB",
      ".KKKKKKKKKKK",
      "..KLLLLLEPLL",
      "..KLLLLLPPLL",
      "...KLLcLLLLK",
      ".KbKKKKKKKKK",
      "KbK.KbK.KbK.",
      "KK..KK..KK..",
      "............",
    ],
  },
};

// Parts. `rows`: a left half (mirrored), or a full-width piece if `side`
// (drawn once, not mirrored: tails). `at`: "head" sits on top of the head,
// `dx` columns in from the body's `ear` column; "body" is placed at `y`, `x`.
// `back`: drawn behind the body (else in front).
export const PARTS = {
  earsPoint: { at: "head", dx: 0, back: true, rows: ["K....", "KBK..", "KaBK.", "KaaBK", "KBBBK"] },
  earsRound: { at: "head", dx: 0, back: true, rows: [".KKK.", "KBBBK", "KBaBK", "KBBBK"] },
  earsLong: { at: "head", dx: 1, back: true, rows: ["KK..", "KBK.", "KaK.", "KaK.", "KaK.", "KBBK"] },
  horns: { at: "head", dx: 1, back: true, rows: ["...K", "..KA", ".KAA", "KAAa", "KAaK"] },
  sprout: { at: "head", dx: 5, back: true, rows: ["KK..", "KAK.", "KAAK", ".KKa", "...a"] },
  flame: { at: "head", dx: 6, back: true, rows: ["..K..", ".KAK.", "KAaAK", "KaAaK", ".KAAK"] },
  crystals: { at: "head", dx: 2, back: true, rows: ["..K...", ".KAK.K", ".KAKKA", "KAaAKA", "KAaAaA"] },
  crest: { at: "head", dx: 7, back: true, rows: ["...K", "..KA", ".KAa", "KAaA", "KAAa"] },
  antennae: { at: "head", dx: 3, back: true, rows: ["KA..", ".K..", "..K.", "..K."] },
  crown: { at: "head", dx: 5, back: false, rows: ["K.K.KK", "KAKAKA", "KAAAAA", "KKKKKK"] },
  hood: { at: "head", dx: 0, back: false, rows: [".....KKKKKKK", "...KKAAAAAAA", "..KAAaAAAAAA", ".KAAaKKKKKKK", ".KAaK.......", ".KAaK.......", ".KAaK.......", ".KAaK.......", ".KAaK......."] },
  glasses: { at: "body", x: 6, y: 9, back: false, rows: ["KKKKK..", "K...KKK", "K...K..", "KKKKK.."] },
  wingsBat: { at: "body", x: 0, y: 11, back: true, rows: ["K...", "AK..", "AAK.", "AaAK", "AAaK", "AaAK", "KAAK", ".KAK", "..KK"] },
  wingsBird: { at: "body", x: 0, y: 12, back: true, rows: ["...K", "..KA", ".KAA", "KAaA", "KAaA", "KAaA", ".KAA", "..KK"] },
  wingsMoth: { at: "body", x: 0, y: 9, back: true, rows: [".KK...", "KAAK..", "KAaAK.", "KAaaAK", "KAaAAK", ".KAAK.", "..KAAK", "...KK."] },
  fins: { at: "body", x: 0, y: 14, back: true, rows: ["..K", ".KA", "KAa", ".KA", "..K"] },
  tentacles: { at: "body", x: 1, y: 20, back: false, rows: ["KBK.KBK.KBK.", "KbK.KbK.KbK.", ".K...K...K.."] },
  bumps: { at: "body", x: 3, y: 12, back: false, rows: [".a....", "...a..", "a....."] },
  spots: { at: "body", x: 3, y: 17, back: false, rows: ["A.....", ".....A", "..A..."] },
  // Biome parts: vines and thorns (Forest), a mushroom cap, a leaf crown,
  // petals (Meadow), a cloud puff (Clouds), a gem in the chest (Caves).
  vines: { at: "body", x: 1, y: 9, back: false, rows: ["KA", "Ka", "KA", "aK", "AK", "Ka", "KA", ".K"] },
  thorns: { at: "head", dx: 1, back: true, rows: ["K...K.", "AK..AK", "aAK.aA", "aaAKaa"] },
  mushroomCap: { at: "head", dx: -3, back: false, rows: ["......KKKKKK", "....KKAAAAAA", "..KKAALLAAAA", ".KAAAAAAAALL", "KAAALLAAAAAA", "KKKKKKKKKKKK"] },
  leafCrown: { at: "head", dx: 2, back: true, rows: ["KK......", "KAAK....", ".KAaK.KK", "..KAaKAK", "...KKaaK"] },
  petals: { at: "head", dx: 4, back: true, rows: ["..KK...", ".KAAK..", "KAAaAKK", ".KAAKLK", "..KK.KK"] },
  cloudPuff: { at: "head", dx: 2, back: true, rows: ["...KKK..", "..KLLLKK", ".KLLLLLL", "KLLLLLLL"] },
  gemCore: { at: "body", x: 8, y: 16, back: false, rows: ["..KK", ".KAa", "KAaa", ".KAa", "..KK"] },
  // Tails go on one side (the creature's left, your right), behind the body.
  tailFluffy: { at: "body", side: true, x: 18, y: 13, back: true, rows: ["....KKK.", "...KAAAK", "..KAAaAK", ".KBAaAK.", "KBBBAK..", "KBBK....", ".KK....."] },
  tailFlame: { at: "body", side: true, x: 18, y: 12, back: true, rows: ["....KAK.", "...KAaAK", "...KAaAK", "..KBAAK.", ".KBBK...", "KBBK....", ".KK....."] },
  tailBolt: { at: "body", side: true, x: 19, y: 12, back: true, rows: ["...KKK", "..KAAK", ".KAAK.", "KAAAAK", ".KKAK.", "..KAK.", "...K.."] },
};

// ---------- Putting a critter together ----------

const DEFAULT_COLORS = { E: "#ffffff", P: "#2b1d2e", F: "#ffb020", c: "#f29aa6" };

// spec: { body, parts: [names], colors }. Returns { rows, colors } (full
// 24-wide rows), the same shape as the other sprites in sprites.js.
export function buildCritter({ body, parts = [], colors }) {
  const b = BODIES[body];
  const grid = Array.from({ length: 24 }, () => Array(24).fill("."));
  const stamp = (rows, x0, y0, mirrored) => {
    rows.forEach((row, dy) => {
      [...row].forEach((ch, dx) => {
        const y = y0 + dy, x = x0 + dx;
        if (ch === "." || y < 0 || y > 23) return;
        if (x >= 0 && x < 24) grid[y][x] = ch;
        if (mirrored && x >= 0 && x < 24) grid[y][23 - x] = ch;
      });
    });
  };
  const place = (name) => {
    const part = PARTS[name];
    if (part.at === "head") stamp(part.rows, b.ear + part.dx, b.top - part.rows.length + 1, true);
    else stamp(part.rows, part.x, part.y, !part.side);
  };
  for (const name of parts) if (PARTS[name].back) place(name);
  stamp(b.rows, 0, 0, true);
  for (const name of parts) if (!PARTS[name].back) place(name);
  return { rows: grid.map((r) => r.join("")), colors: { ...DEFAULT_COLORS, ...colors } };
}

// Every creature, as a critter. Colors follow their element.
const c = (B, b, L, A, a, extra = {}) => ({ B, b, L, A, a, ...extra });
export const CRITTERS = {
  // Pip, the fox-moth (and the Beacon's lost spirit).
  pip: { body: "pup", parts: ["wingsMoth", "earsPoint", "antennae", "tailFluffy"], colors: c("#f08a24", "#b85f12", "#fff4e0", "#c58cf0", "#8a5ad6") },
  // Meadow: gentle grass and pond critters.
  puddlepup: { body: "blob", parts: ["flame"], colors: c("#6fb8e8", "#3f88c0", "#d8f0ff", "#bfe8ff", "#7fc8f0") },
  sproutling: { body: "pup", parts: ["earsRound", "sprout"], colors: c("#8fd06a", "#5fa04a", "#eef8d8", "#5fc04a", "#3f8a33") },
  thistlefox: { body: "pup", parts: ["earsPoint", "tailFluffy"], colors: c("#b58ad8", "#8a5ab0", "#f2e6ff", "#8fd06a", "#5fa04a") },
  frog: { body: "blob", parts: ["crown", "spots"], colors: c("#5cbf5a", "#3a8a3a", "#e8f5c0", "#ffd23f", "#c99418") },
  // Forest: moss, bark, and embers.
  mossling: { body: "biped", parts: ["mushroomCap", "vines"], colors: c("#6aa84f", "#4a7f38", "#d9ecb0", "#c8603a", "#8a3a22") },
  barkbeetle: { body: "bug", parts: ["antennae", "vines"], colors: c("#9a6a3e", "#6e4a2a", "#e8d0a8", "#5fa04a", "#3f7a33") },
  owl: { body: "bird", parts: ["wingsBird", "earsPoint", "glasses"], colors: c("#9a6a40", "#6a4628", "#f0dcb8", "#7a5232", "#5a3a20") },
  // Caves: pebbles, gems, and glow bats.
  pebblit: { body: "blob", parts: ["bumps"], colors: c("#a8a0b0", "#7a7488", "#d8d2de", "#c8c0d0", "#8a8498") },
  gemmole: { body: "pup", parts: ["crystals"], colors: c("#8a7a6e", "#5e5248", "#d8c8b8", "#c58cf0", "#8a5ad6") },
  glowbat: { body: "bird", parts: ["wingsBat", "earsPoint"], colors: c("#6a5a9a", "#4a3a78", "#d8c8f0", "#7a6aaa", "#4a3a78", { F: "#ffe066" }) },
  bat: { body: "bird", parts: ["wingsBat", "earsPoint", "crown"], colors: c("#5a3a6a", "#3a2448", "#e0c8e8", "#c0303a", "#7a1820", { F: "#ffffff" }) },
  // River: bubbles, crabs, and tide sprites.
  bubblet: { body: "blob", parts: ["crest"], colors: c("#5ab8d8", "#2f88b0", "#d0f0ff", "#9fe0ff", "#5ab8d8") },
  reedcrab: { body: "bug", parts: ["antennae"], colors: c("#e0704a", "#a84a30", "#ffe0c8", "#ffb090", "#c86a4a") },
  tidesprite: { body: "biped", parts: ["fins", "crest"], colors: c("#4fa8c8", "#2f7898", "#e0f6ff", "#7fe3ff", "#3fb0d0") },
  octopus: { body: "blob", parts: ["tentacles", "crest"], colors: c("#e87aa8", "#b84a7a", "#ffd8e8", "#ffb0d0", "#d86a98") },
  // The Academy (Castle): fire and forge.
  cinderling: { body: "blob", parts: ["flame"], colors: c("#e8603a", "#b03a20", "#ffd8a0", "#ffd23f", "#ff8a2a") },
  torchbug: { body: "bug", parts: ["antennae", "spots"], colors: c("#7a4a2e", "#4e2e1a", "#ffe8c0", "#ffc93c", "#ff8a2a") },
  kilnlizard: { body: "pup", parts: ["crest", "tailFlame"], colors: c("#d8603a", "#a03a20", "#ffe0b0", "#ffd23f", "#ff8a2a") },
  drakeling: { body: "pup", parts: ["wingsBat", "horns"], colors: c("#e84a3a", "#a82e24", "#ffe0a0", "#ffe8b0", "#c8a070") },
  dragon: { body: "pup", parts: ["wingsBat", "horns", "tailFlame"], colors: c("#e04848", "#a82e2e", "#ffd25a", "#ffe8b0", "#ffb020") },
  // Crown Keep: royal shields and gryphon chicks.
  shieldbug: { body: "bug", parts: ["crown"], colors: c("#8fa3c2", "#5f7394", "#f0f0f8", "#ffd23f", "#c99418") },
  griffling: { body: "bird", parts: ["wingsBird", "crest"], colors: c("#f0c860", "#c89a30", "#fff4d0", "#fff4d0", "#e0c070", { F: "#ff8a2a" }) },
  gryphon: { body: "bird", parts: ["wingsBird", "crest", "crown"], colors: c("#f0c040", "#c08a20", "#fff4d0", "#ffffff", "#e0d0a0", { F: "#ff8a2a" }) },
  // Crystal Spires: frost and prisms.
  frostfox: { body: "pup", parts: ["earsPoint", "tailFluffy"], colors: c("#e0f0ff", "#a8c8e8", "#ffffff", "#9fd8ff", "#6fb0e0") },
  prismit: { body: "biped", parts: ["crystals"], colors: c("#9a8ac8", "#6a5aa0", "#e0d8f8", "#ff9ae0", "#c860c0") },
  icewyrm: { body: "pup", parts: ["crystals", "tailFluffy"], colors: c("#7fc8f0", "#3a8ac0", "#e8f7ff", "#ffffff", "#bfe8ff") },
  // Cloud Kingdom: puffs and sparks.
  puffwing: { body: "bird", parts: ["wingsBird", "antennae"], colors: c("#f0f2ff", "#c0c8e8", "#ffffff", "#ffe066", "#e0b820") },
  voltkit: { body: "pup", parts: ["earsPoint", "tailBolt"], colors: c("#ffd84a", "#d8a020", "#fff6c8", "#ffe066", "#c89a20") },
  stormowl: { body: "bird", parts: ["wingsBird", "earsPoint", "crest"], colors: c("#6a7894", "#465068", "#d8e0f0", "#ffe066", "#d8b020", { F: "#ffd23f" }) },
  // Void Rift: shadows and the deep.
  shadewisp: { body: "blob", parts: ["flame"], colors: c("#4a3a7a", "#2e2450", "#8a7ac0", "#c58cf0", "#8a5ad6") },
  duskwing: { body: "bird", parts: ["wingsBat", "earsPoint"], colors: c("#3a3460", "#24203e", "#8a84b8", "#5a4a90", "#3a3060", { F: "#e06bff" }) },
  gloomfox: { body: "pup", parts: ["horns", "tailFluffy"], colors: c("#3e3a5a", "#26223a", "#8a84b0", "#c58cf0", "#7a5aa8") },
  abyssling: { body: "blob", parts: ["tentacles", "antennae"], colors: c("#3a5aa0", "#243a70", "#7fd8e0", "#7fffd4", "#3fb0a0") },
  // More of each biome's critters.
  petalpuff: { body: "blob", parts: ["petals"], colors: c("#f4a6c8", "#c8709a", "#fff0f6", "#ffe066", "#e0b820") },
  brambling: { body: "blob", parts: ["thorns", "vines"], colors: c("#5a8a3a", "#3a6026", "#c8dca0", "#8a5a2e", "#5e3a1c") },
  snapvine: { body: "biped", parts: ["leafCrown", "vines"], colors: c("#7aa848", "#50782e", "#e0ecb8", "#3f8a33", "#2a5e22") },
  vinesnap: { body: "pup", parts: ["thorns", "vines", "tailFluffy"], colors: c("#6e9a44", "#4a6e2c", "#d8e8b0", "#8a5a2e", "#5e3a1c") },
  geodite: { body: "biped", parts: ["crystals", "gemCore"], colors: c("#8c8494", "#605a6c", "#cfc8d8", "#7fe3ff", "#3fa8d0") },
  lilyhop: { body: "pup", parts: ["petals", "earsRound"], colors: c("#5aa878", "#3a7a54", "#d8f0e0", "#f4a6c8", "#c8709a") },
  squirepup: { body: "pup", parts: ["earsPoint", "crown", "spots"], colors: c("#c8b090", "#9a8060", "#f4ecdc", "#ffd23f", "#c99418") },
  shiverling: { body: "blob", parts: ["crystals"], colors: c("#bfe4f8", "#86b8e0", "#f0faff", "#ffffff", "#9fd8ff") },
  nimbling: { body: "blob", parts: ["cloudPuff", "antennae"], colors: c("#9aa8c8", "#6a789c", "#ffffff", "#ffe066", "#d8b020") },
  // Shop pets.
  cat: { body: "pup", parts: ["earsPoint", "tailBolt"], colors: c("#a8b0c0", "#7880a0", "#f0f2f8", "#ffe066", "#d8b020") },
  drake: { body: "pup", parts: ["wingsBird", "horns"], colors: c("#ff9a3a", "#d8602a", "#ffe7a0", "#ffe8b0", "#c8a070") },
};
