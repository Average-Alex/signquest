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
// Monster/zone icons are placeholders until real art is in assets/.
export const ZONES = [
  { id: "meadow", name: "Meadow", icon: "🌼", monster: "🐸", letters: ["A", "B", "C", "D", "E"], words: ["BAD", "BED", "CAB", "DAB", "ACE"] },
  { id: "forest", name: "Forest", icon: "🌲", monster: "🦉", letters: ["F", "G", "H", "I", "K"], words: ["HIDE", "BIKE", "FIG", "DIG", "KID"] },
  { id: "caves", name: "Caves", icon: "🪨", monster: "🦇", letters: ["L", "M", "N", "O", "P"], words: ["MOP", "LION", "POND", "LAMP"] },
  { id: "river", name: "River", icon: "🌊", monster: "🐙", letters: ["Q", "R", "S", "T", "U"], words: ["SUN", "RUST", "QUIT", "TRUE"] },
  { id: "castle", name: "Castle", icon: "🏰", monster: "🐉", letters: ["V", "W", "X", "Y"], words: ["WAVY", "FOX", "YAK", "VOW"] },
];

export const STAGES = [
  { type: "letters", name: "Practice", icon: "⚔️" },
  { type: "words", name: "Words", icon: "📜" },
  { type: "boss", name: "Boss", icon: "👑" },
];

export const CHARACTERS = ["🧙", "🧝", "🧚", "🦸"];

export const SHOP = [
  { id: "hat-cap", kind: "hat", icon: "🧢", price: 20 },
  { id: "hat-top", kind: "hat", icon: "🎩", price: 40 },
  { id: "hat-grad", kind: "hat", icon: "🎓", price: 60 },
  { id: "hat-crown", kind: "hat", icon: "👑", price: 100 },
  { id: "pet-cat", kind: "pet", icon: "🐱", price: 30 },
  { id: "pet-dog", kind: "pet", icon: "🐶", price: 30 },
  { id: "pet-bunny", kind: "pet", icon: "🐰", price: 50 },
  { id: "pet-unicorn", kind: "pet", icon: "🦄", price: 80 },
  { id: "pet-dragon", kind: "pet", icon: "🐲", price: 120 },
];

// Defaults for the Settings screen.
export const DEFAULT_SETTINGS = {
  holdMs: 500, // how long a sign must be held to count
  minConfidence: 0.8, // how sure the recognizer must be
  hand: "auto", // "auto" | "right" | "left" - which hand the player signs with
  recognizer: "auto", // "auto" | "model" | "knn" | "keyboard"
};

export const SMOOTH_FRAMES = 8; // predictions averaged over this many frames
export const HINT_AFTER_MS = 8000; // hint glows after this long on one letter
export const SKIP_AFTER_MS = 16000; // skip button appears after this long
