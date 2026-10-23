// Critters: every creature in the game is built from the same parts, so
// they all look like one family: one of a few BODIES (same size, facing you,
// same eyes and outline), plus PARTS on top (ears, horns, a leaf sprout,
// wings, a tail...), in its own colors. Sprites are 24 x 24 like the rest.
//
// Pixel letters: K outline, B body, b body shade, L belly, P eye (big, 3 x 3), E the
// shine in the eye, c blush, A accent (horns, leaves, flames...), a accent shade, F a bird's
// beak and feet. "." is
// see-through. Bodies and most parts are left halves, mirrored to make the
// right half (see sprites.js).

// Each body: its rows (left half), the row where its head starts (`top`),
// the column parts on the head line up with (`ear`), and the row its eyes
// are on (`eye`; "face" parts line up with it).
export const BODIES = {
  // A round dome: slimes, wisps, blobs.
  blob: {
    top: 10, ear: 3, eye: 13,
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
      "...KBBBBPPBB",
      "..KBBBBPEPBB",
      "..KBBBBPPPBB",
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
    top: 6, ear: 3, eye: 9,
    rows: [
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
      ".....KKKKKKK",
      "....KBBBBBBB",
      "...KBBBBPPBB",
      "..KBBBBPEPBB",
      "..KBBBBPPPBB",
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
    top: 7, ear: 4, eye: 10,
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
      "....KBBBPPBB",
      "...KBBBPEPBB",
      "...KBBBPPPBB",
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
    top: 5, ear: 3, eye: 8,
    rows: [
      "............",
      "............",
      "............",
      "............",
      "............",
      "......KKKKKK",
      "....KKBBBBBB",
      "...KBBBBPPBB",
      "..KBBBBPEPBB",
      "..KBBBBPPPBB",
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
    top: 9, ear: 3, eye: 17,
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
      "..KLLLLPEPLL",
      "..KLLLLPPPLL",
      "...KLLcLLLLK",
      ".KbKKKKKKKKK",
      "KbK.KbK.KbK.",
      "KK..KK..KK..",
      "............",
    ],
  },
  // Floating, with a wavy tail and little arms: ghosts, jellies.
  ghost: {
    top: 4, ear: 3, eye: 8,
    rows: [
      "............",
      "............",
      "............",
      "............",
      "......KKKKKK",
      "....KKBBBBBB",
      "...KBBBBBBBB",
      "..KBBBBBPPBB",
      "..KBBBBPEPBB",
      "..KBBBBPPPBB",
      ".KBBBBcBBBBB",
      ".KBBBBBBBBBK",
      "KBKBBBBBBBBB",
      "KBKBBBBBLLLL",
      ".KKBBBBLLLLL",
      "..KBBBBLLLLL",
      "..KBbBBBLLLL",
      "..KBbBBBBBBB",
      "..KbbBBBBBBB",
      "..KbbbBBBBbB",
      "...KbbKbbbKb",
      "....KK.KKK.K",
      "............",
      "............",
    ],
  },
  // A round fish: fins out to the sides, a tail fin below.
  fish: {
    top: 5, ear: 3, eye: 8,
    rows: [
      "............",
      "............",
      "............",
      "............",
      "............",
      "......KKKKKK",
      "....KKBBBBBB",
      "...KBBBBPPBB",
      "..KBBBBPEPBB",
      "KKKBBBBPPPBB",
      "KAKBBBBcBBBB",
      "KAABBBBBBBKK",
      "KAABBBBBBBLL",
      "KAKBBBBBLLLL",
      "KK.KBBBBLLLL",
      "...KbBBBLLLL",
      "...KbbBBBLLL",
      "....KbbbBBBB",
      ".....KKbbbbb",
      ".......KKKKK",
      "........KAAA",
      ".......KAAaa",
      ".......KKKKK",
      "............",
    ],
  },
  // Coiled up, with a tall neck: serpents, salamanders, wyrms.
  serpent: {
    top: 2, ear: 3, eye: 5,
    rows: [
      "............",
      "............",
      "......KKKKKK",
      "....KKBBBBBB",
      "...KBBBBPPBB",
      "...KBBBPEPBB",
      "...KBBBPPPBB",
      "...KBBBcBBBB",
      "...KBBBBBBLL",
      "....KBBBBLLL",
      ".....KBBBLLL",
      ".....KBBBLLL",
      "....KBBBBLLL",
      "..KKBBBBBLLL",
      ".KBBBBBBBLLL",
      "KBBbbBBBBBLL",
      "KBbKKbBBBBBL",
      "KBbK.KbBBBBB",
      "KBbbKKbbBBBB",
      ".KBbbbbbbBBB",
      "..KKbbbbbbbb",
      "....KKKKKKKK",
      "............",
      "............",
    ],
  },
  // A sturdy beast on four legs, with a snout: bears, rams, big cats.
  quad: {
    top: 5, ear: 3, eye: 8,
    rows: [
      "............",
      "............",
      "............",
      "............",
      "............",
      ".....KKKKKKK",
      "...KKBBBBBBB",
      "..KBBBBBPPBB",
      "..KBBBBPEPBB",
      "..KBBBBPPPBB",
      ".KBBBBcBBLLL",
      ".KBBBBBBLLLL",
      ".KBBBBBBLLKK",
      "..KBBBBBLLLL",
      "...KKBBBBLLL",
      "..KBBBBBBBBB",
      ".KBBBBBBBBBB",
      ".KBbBBBBBBBB",
      ".KBbBBBBBBBB",
      ".KbbBBKBBBBB",
      ".KbbBKKbBBBB",
      ".KbbK.KbbBKK",
      ".KKKK.KKKK..",
      "............",
    ],
  },
  // A mushroom: a big spotted cap (A, spots L) over a little stalk body.
  shroom: {
    top: 1, ear: 3, eye: 10,
    rows: [
      "............",
      "......KKKKKK",
      "....KKAAAAAA",
      "...KAAALLAAA",
      "..KAAAALLAAA",
      ".KAALLAAAAAA",
      ".KAALLAAAAAL",
      "KAAAAAAAAALL",
      "KKKKKKKKKKKK",
      "...KBBBBPPBB",
      "...KBBBPEPBB",
      "...KBBBPPPBB",
      "...KBBBcBBBB",
      "...KBBBBBBBK",
      "....KBBBBBBB",
      "...KBbBBBBBB",
      "..KBbBBBBBBB",
      "..KBbBBBBBBB",
      "...KbbBBBBBB",
      "....KbbbBBBB",
      "....KKbbKBBK",
      ".....KKKKKKK",
      "............",
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
  // Faces ("face": `x`, and `dy` rows below the eyes): round cheeks, a mask,
  // a gem on the forehead.
  cheeks: { at: "face", x: 5, dy: 2, back: false, rows: ["cc", "cc"] }, // in the blush color (c)
  mask: { at: "face", x: 3, dy: -1, back: false, rows: ["aaaaa", "aaaaa"] },
  jewel: { at: "face", x: 10, dy: -3, back: false, rows: [".K", "KA", "Ka", ".K"] },
  // More heads and bodies: a star horn, coral antlers, pumpkin ribs, a cosmic ring.
  starHorn: { at: "head", dx: 6, back: true, rows: ["....K", "...KA", "KKKAA", ".KAAA", "..KAa"] },
  coral: { at: "head", dx: 1, back: true, rows: ["K..K..", "AK.AK.", "KAKAK.", ".KAAK.", "..KAAK"] },
  ribs: { at: "body", x: 6, y: 13, back: false, rows: ["b", "b", "b", "b", "b", "b", "b"] },
  ring: { at: "body", x: 0, y: 16, back: false, rows: ["KAA.........", ".KaAAA......", "..KKaaAAAAAA"] },
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
    else if (part.at === "face") stamp(part.rows, part.x, b.eye + part.dy, true);
    else stamp(part.rows, part.x, part.y, !part.side);
  };
  for (const name of parts) if (PARTS[name].back) place(name);
  stamp(b.rows, 0, 0, true);
  for (const name of parts) if (!PARTS[name].back) place(name);
  return { rows: grid.map((r) => r.join("")), colors: { ...DEFAULT_COLORS, ...colors } };
}

// ---------- Evolution ----------
// How a critter looks at evolution stage 2 or 3 (config.js stageOf): a bigger
// body, its element's parts added on, and richer colors - stage 3 in its
// element's power colors. Like Pokemon, each stage is a real change.
const BODY_UP = {
  blob: ["pup", "biped"], pup: ["pup", "biped"], bug: ["bug", "biped"], bird: ["bird", "bird"], biped: ["biped", "biped"],
  ghost: ["ghost", "ghost"], fish: ["fish", "serpent"], serpent: ["serpent", "serpent"], quad: ["quad", "quad"], shroom: ["shroom", "shroom"],
};
const ELEMENT_PARTS = {
  fire: [["flame", "tailFlame"], ["horns", "wingsBat"]],
  water: [["crest", "fins"], ["coral", "tailFluffy"]],
  nature: [["leafCrown", "tailFluffy"], ["thorns", "vines"]],
  lightning: [["antennae", "tailBolt"], ["crest", "wingsBird"]],
  ice: [["crystals", "tailFluffy"], ["horns", "wingsBird"]],
  rock: [["crystals", "gemCore"], ["horns", "bumps"]],
  light: [["crest", "tailFluffy"], ["starHorn", "wingsBird"]],
  dark: [["earsPoint", "tailBolt"], ["horns", "wingsBat"]],
};
const ELEMENT_ACCENT = {
  fire: ["#ffd23f", "#ff8a2a"], water: ["#7fe3ff", "#3fb0d0"], nature: ["#ffd84a", "#8fd06a"], lightning: ["#fff27a", "#e0b820"],
  ice: ["#ffffff", "#9fd8ff"], rock: ["#c58cf0", "#8a5ad6"], light: ["#fff4c0", "#ffd23f"], dark: ["#e04cff", "#8a2ab0"],
};
const isWings = (n) => n.startsWith("wings");
const isTail = (n) => n.startsWith("tail");

function richer(hex, amount, darken = 1) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const grey = (r + g + b) / 3;
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round((grey + (v - grey) * amount) * darken))).toString(16).padStart(2, "0")).join("");
}

export function evolveSpec(spec, element, stage) {
  if (stage < 2) return spec;
  const body = BODY_UP[spec.body][stage - 2];
  const own = spec.parts || [];
  const added = (ELEMENT_PARTS[element] || [[], []]).slice(0, stage - 1).flat();
  // One set of wings and one tail (its own, if it has them), and at most two
  // things on its head: the newest one it grew, then its own.
  const head = (n) => PARTS[n].at === "head";
  const newest = [...added].reverse().find(head);
  const ownHead = own.filter(head);
  const heads = [...new Set([newest, ...ownHead].filter(Boolean))].slice(0, 2);
  const keep = (n, list) => (isWings(n) ? !list.some(isWings) : isTail(n) ? !list.some(isTail) : true);
  const parts = [];
  for (const n of [...own, ...added]) {
    if (head(n) ? !heads.includes(n) : !keep(n, parts)) continue;
    if (!parts.includes(n)) parts.push(n);
  }
  const colors = {};
  for (const [ch, color] of Object.entries(spec.colors)) colors[ch] = /^#[0-9a-f]{6}$/i.test(color) ? richer(color, stage === 3 ? 1.35 : 1.18, ch === "b" ? 0.9 : 1) : color;
  if (stage === 3 && ELEMENT_ACCENT[element]) [colors.A, colors.a] = ELEMENT_ACCENT[element];
  return { body, parts, colors };
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
  petalpuff: { body: "blob", parts: ["petals"], colors: c("#f4a6c8", "#c8709a", "#fff0f6", "#ffe066", "#e0b820") },
  frog: { body: "blob", parts: ["crown", "spots"], colors: c("#5cbf5a", "#3a8a3a", "#e8f5c0", "#ffd23f", "#c99418") },
  // Glowshroom Forest: glowing mushrooms, moths, and moss.
  shroomlet: { body: "shroom", parts: ["cheeks"], colors: c("#f4e8d0", "#c8b490", "#7fe3ff", "#c58cf0", "#8a5ad6") },
  lumoth: { body: "bird", parts: ["wingsMoth", "antennae", "cheeks"], colors: c("#f6e8a0", "#d0b860", "#fffbe0", "#7fe3ff", "#3fb0d0") },
  mossnout: { body: "quad", parts: ["leafCrown", "spots"], colors: c("#6aa84f", "#4a7f38", "#d9ecb0", "#c58cf0", "#8a5ad6") },
  glimmerkit: { body: "pup", parts: ["earsLong", "tailFluffy", "jewel"], colors: c("#9a8ad8", "#6a5ab0", "#f2e6ff", "#7fe3ff", "#3fb0d0") },
  owl: { body: "bird", parts: ["wingsBird", "earsPoint", "glasses"], colors: c("#5a7a6a", "#3a5a4a", "#e0f0d8", "#7fe3ff", "#3fb0d0") },
  // Magma Canyon: lava, obsidian, and ash.
  magmite: { body: "blob", parts: ["flame", "bumps", "cheeks"], colors: c("#3a2a2e", "#241a1e", "#ff8a2a", "#ffd23f", "#ff6a2a", { c: "#ff6a2a" }) },
  scorchpup: { body: "quad", parts: ["earsPoint", "tailFlame", "cheeks"], colors: c("#e8603a", "#b03a20", "#ffd8a0", "#ffd23f", "#ff8a2a", { c: "#ffd23f" }) },
  ashcrow: { body: "bird", parts: ["wingsBat", "crest", "mask"], colors: c("#5a5058", "#3a3238", "#c8b8b0", "#ff8a2a", "#c83a1a", { F: "#ffb020" }) },
  obsidrake: { body: "serpent", parts: ["horns", "crest"], colors: c("#4a3a4e", "#2e2232", "#ff8a2a", "#ff6a2a", "#c83a1a") },
  bat: { body: "serpent", parts: ["horns", "crown", "tailFlame"], colors: c("#d8403a", "#a02a24", "#ffd25a", "#ffd23f", "#ff8a2a") },
  // Coral Lagoon: reef puffs, fish, crabs, and jellies.
  coralpuff: { body: "blob", parts: ["coral", "cheeks"], colors: c("#f4a6c8", "#c8709a", "#fff0f6", "#ff7a6a", "#d8504a") },
  finnow: { body: "fish", parts: ["crest"], colors: c("#5ab8d8", "#2f88b0", "#d0f0ff", "#ffd23f", "#e0a820") },
  shellsnap: { body: "bug", parts: ["antennae", "cheeks"], colors: c("#e0704a", "#a84a30", "#ffe0c8", "#ffb090", "#c86a4a") },
  jellybop: { body: "ghost", parts: ["tentacles", "jewel"], colors: c("#c8a8f0", "#9a78d0", "#f4ecff", "#7fe3ff", "#3fb0d0") },
  octopus: { body: "blob", parts: ["tentacles", "crest"], colors: c("#e87aa8", "#b84a7a", "#ffd8e8", "#ffb0d0", "#d86a98") },
  // Haunted Hollow: pumpkins, ghosts, candles, and bat-cats.
  pumpling: { body: "blob", parts: ["sprout", "ribs", "cheeks"], colors: c("#f08a24", "#c0601a", "#ffd8a0", "#5aa848", "#3c7a34", { c: "#ffd23f" }) },
  boolet: { body: "ghost", parts: ["cheeks"], colors: c("#eef0fa", "#b8bcd8", "#ffffff", "#f29aa6", "#d86a8a") },
  candlewick: { body: "biped", parts: ["flame"], colors: c("#f4ecdc", "#c8bca8", "#ffffff", "#ffd23f", "#ff8a2a") },
  batcat: { body: "pup", parts: ["wingsBat", "earsPoint", "mask"], colors: c("#4a3a5e", "#2e2240", "#d8c8f0", "#c58cf0", "#8a5ad6") },
  dragon: { body: "ghost", parts: ["crown", "ribs", "cheeks"], colors: c("#f08a24", "#c0601a", "#ffd8a0", "#7a3ac8", "#4a1a8a", { c: "#7a3ac8" }) },
  // Crown Keep: knight pups, royal blobs, shield beetles, and gryphon chicks.
  squirepup: { body: "quad", parts: ["earsPoint", "crest", "cheeks"], colors: c("#c8b090", "#9a8060", "#f4ecdc", "#e8413b", "#a82a24") },
  crownling: { body: "blob", parts: ["crown", "cheeks"], colors: c("#8a6af0", "#6a4bd6", "#f0e8ff", "#ffd23f", "#c99418") },
  shieldbug: { body: "bug", parts: ["crown", "jewel"], colors: c("#8fa3c2", "#5f7394", "#f0f0f8", "#ffd23f", "#c99418") },
  griffling: { body: "bird", parts: ["wingsBird", "crest", "cheeks"], colors: c("#f0c860", "#c89a30", "#fff4d0", "#fff4d0", "#e0c070", { F: "#ff8a2a" }) },
  gryphon: { body: "bird", parts: ["wingsBird", "crest", "crown"], colors: c("#f0c040", "#c08a20", "#fff4d0", "#ffffff", "#e0d0a0", { F: "#ff8a2a" }) },
  // Aurora Glacier: penguins, bear cubs, frost foxes, and aurora fish.
  pengling: { body: "bird", parts: ["wingsBird", "crest"], colors: c("#3a4a6a", "#24304a", "#ffffff", "#ffd23f", "#e0a820", { F: "#ff8a2a" }) },
  icicub: { body: "quad", parts: ["earsRound", "crystals"], colors: c("#e0f0ff", "#a8c8e8", "#ffffff", "#9fd8ff", "#6fb0e0") },
  frostfox: { body: "pup", parts: ["earsPoint", "tailFluffy"], colors: c("#e0f0ff", "#a8c8e8", "#ffffff", "#9fd8ff", "#6fb0e0") },
  aurorafin: { body: "fish", parts: ["crest", "jewel"], colors: c("#9fd8ff", "#6fb0e0", "#f0faff", "#7fe3a0", "#c58cf0") },
  icewyrm: { body: "serpent", parts: ["crystals", "crown"], colors: c("#7fc8f0", "#3a8ac0", "#e8f7ff", "#7fe3a0", "#c58cf0") },
  // Thunder Peaks: storm clouds, sparrows, sparky kits, and rams.
  nimbling: { body: "blob", parts: ["cloudPuff", "antennae"], colors: c("#9aa8c8", "#6a789c", "#ffffff", "#ffe066", "#d8b020") },
  zipsparrow: { body: "bird", parts: ["crest", "tailBolt", "cheeks"], colors: c("#ffe066", "#e0b820", "#fffbe0", "#3a6ab0", "#24447a", { c: "#ff6a5a" }) },
  voltkit: { body: "pup", parts: ["earsPoint", "tailBolt", "cheeks"], colors: c("#ffd84a", "#d8a020", "#fff6c8", "#ffe066", "#c89a20", { c: "#ff5a4a" }) },
  thunderam: { body: "quad", parts: ["horns", "cloudPuff"], colors: c("#e8e8f8", "#b8b8d8", "#ffffff", "#ffd23f", "#e0a820") },
  stormowl: { body: "bird", parts: ["wingsBird", "earsPoint", "crest"], colors: c("#6a7894", "#465068", "#d8e0f0", "#ffe066", "#d8b020", { F: "#ffd23f" }) },
  // Cosmic Rift: stars, moon moths, nebula cats, and void jellies.
  starbit: { body: "blob", parts: ["starHorn", "cheeks"], colors: c("#3a3a8a", "#24246a", "#c8c8ff", "#ffd23f", "#e0a820") },
  moonmoth: { body: "bird", parts: ["wingsMoth", "antennae"], colors: c("#c8c8e0", "#9898b8", "#ffffff", "#9fd8ff", "#6fb0e0") },
  nebulynx: { body: "quad", parts: ["earsPoint", "tailFluffy", "ring"], colors: c("#6a3fd0", "#4a2fa8", "#e0c8ff", "#ff7ad8", "#c84ab0") },
  voidjelly: { body: "ghost", parts: ["tentacles", "jewel"], colors: c("#2a1f4d", "#1a1236", "#8a6abf", "#e04cff", "#8a2ab0") },
  // Shop pets.
  cat: { body: "pup", parts: ["earsPoint", "tailBolt"], colors: c("#a8b0c0", "#7880a0", "#f0f2f8", "#ffe066", "#d8b020") },
  drake: { body: "pup", parts: ["wingsBird", "horns"], colors: c("#ff9a3a", "#d8602a", "#ffe7a0", "#ffe8b0", "#c8a070") },
};
