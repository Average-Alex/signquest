// Beasts: every creature drawn as a side-view animal, like a monster-collecting
// game - a fox with a snout and a bushy tail, a bird with a beak and wings, a
// fish with fins - instead of a front-facing blob.
//
// Each creature is a `spec`: a body plan (`body`: beast, bird, fish, serpent,
// biped, ghost, plant, blob), its colors, and its features (ears, tail, horns,
// wings, a mane...). buildBeast() draws it with simple shapes (ellipses,
// polygons, thick lines) onto a 32 x 32 grid of palette letters, then outlines
// it - the same { rows, colors } as every other sprite (sprites.js), so the
// hexed look, shading, and walking all still work.
//
// Creatures face left (the way foes face you in battle). Evolving makes them
// bigger and less babyish (a smaller head for the body) and adds the features
// of their element (STAGE_FEATS): horns, wings, a mane...
//
// Letters: K outline, B body, b body shade (far legs), L belly / snout,
// A accent, a accent shade, P pupil, E eye shine, F beak and talons, c blush.

const N = 32; // the grid is N x N
const GROUND = 31; // feet stand on this row

// ---------- Drawing onto the letter grid ----------

function canvas() {
  return Array.from({ length: N }, () => Array(N).fill("."));
}

function fillEllipse(g, cx, cy, rx, ry, ch) {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const dx = (x + 0.5 - cx) / Math.max(rx, 0.5), dy = (y + 0.5 - cy) / Math.max(ry, 0.5);
      if (dx * dx + dy * dy <= 1) g[y][x] = ch;
    }
}

function fillPolygon(g, pts, ch) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++)
    for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const px = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) g[y][x] = ch;
    }
}

function fillLine(g, x0, y0, x1, y1, w, ch) {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  for (let y = Math.floor(Math.min(y0, y1) - w); y <= Math.max(y0, y1) + w; y++)
    for (let x = Math.floor(Math.min(x0, x1) - w); x <= Math.max(x0, x1) + w; x++) {
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const px = x + 0.5, py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - x0) * (x1 - x0) + (py - y0) * (y1 - y0)) / (len * len)));
      if (Math.hypot(px - (x0 + t * (x1 - x0)), py - (y0 + t * (y1 - y0))) <= w / 2) g[y][x] = ch;
    }
}

const setPx = (g, x, y, ch) => {
  x = Math.round(x);
  y = Math.round(y);
  if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = ch;
};

// A dark outline all the way around.
function outline(g) {
  const out = g.map((r) => r.slice());
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (g[y][x] !== ".") continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] && g[y + dy][x + dx] !== ".")) out[y][x] = "K";
    }
  return out;
}

// ---------- One creature ----------

// `stage` 1-3. Evolved creatures are bigger, with smaller heads for their bodies.
export function buildBeast(spec, stage = 1, extraFeats = []) {
  const g = canvas();
  const size = [0.74, 0.88, 1][stage - 1];
  const headSize = [1.4, 1.24, 1.1][stage - 1];
  const feats = new Set([...(spec.feats || []), ...extraFeats]);
  // Everything is laid out for a full-size creature standing on GROUND,
  // then scaled down toward its feet for earlier stages.
  const T = (x, y) => [16 + (x - 16) * size, GROUND - (GROUND - y) * size];
  const ell = (x, y, rx, ry, ch) => {
    const [X, Y] = T(x, y);
    fillEllipse(g, X, Y, rx * size, ry * size, ch);
  };
  const poly = (pts, ch) => fillPolygon(g, pts.map((p) => T(p[0], p[1])), ch);
  const line = (x0, y0, x1, y1, w, ch) => {
    const [a, b] = T(x0, y0), [c, d] = T(x1, y1);
    fillLine(g, a, b, c, d, Math.max(1, w * size), ch);
  };
  // Head shapes are placed around the head's middle, scaled by headSize too.
  let hx = 0, hy = 0;
  const H = (dx, dy) => [hx + dx * headSize, hy + dy * headSize];
  const hEll = (dx, dy, rx, ry, ch) => ell(...H(dx, dy), rx * headSize, ry * headSize, ch);
  // The head itself (drawn last, on top): remembered, for a soft line around it.
  const head = (rx, ry) => {
    const before = g.map((r) => r.slice());
    hEll(0, 0, rx, ry, "B");
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) headMask[y][x] ||= g[y][x] !== before[y][x] || (before[y][x] === "B" && g[y][x] === "B" && inEllipse(x, y));
    function inEllipse(x, y) {
      const [cx, cy] = T(...H(0, 0));
      const dx = (x + 0.5 - cx) / (rx * headSize * size), dy = (y + 0.5 - cy) / (ry * headSize * size);
      return dx * dx + dy * dy <= 1;
    }
  };
  const headMask = Array.from({ length: N }, () => Array(N).fill(false));
  const hPoly = (pts, ch) => poly(pts.map(([dx, dy]) => H(dx, dy)), ch);

  const body = BODIES[spec.body];
  body.draw({ ell, poly, line, hEll, hPoly, H, head, feats, spec, setHead: (x, y) => ((hx = x), (hy = y)) });
  // A soft line where the head meets the body, so it doesn't melt into it.
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (!headMask[y][x] || g[y][x] !== "B") continue;
      if ([[1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => g[y + dy]?.[x + dx] === "B" && !headMask[y + dy][x + dx])) g[y][x] = "b";
    }

  // The eye: big, dark, and round with a one-pixel shine near the top, so it
  // reads as an eye and not a smudge (a little smaller once fully evolved).
  const [ex, ey] = T(...H(...body.eye));
  const eye = stage === 3 ? [".PP", "PEP", "PPP", ".PP"] : [".PP.", "PPEP", "PPPP", "PPPP", ".PP."];
  const ey0 = Math.round(ey) - 2;
  eye.forEach((row, dy) => [...row].forEach((ch, dx) => ch !== "." && setPx(g, ex - 1 + dx, ey0 + dy, ch)));
  // A little smile: a line back from the front of the mouth, curling up at the end.
  if (body.mouth) {
    const [mx, my] = T(...H(...body.mouth));
    const len = Math.max(2, Math.round(2.6 * size * headSize));
    for (let i = 0; i < len; i++) setPx(g, mx + i, my, "K");
    setPx(g, mx + len, my - 1, "K");
  }
  // Rosy cheeks, back behind the smile.
  if (!feats.has("noBlush")) setPx(g, ex - 1 + eye[0].length, ey0 + eye.length, "c"), setPx(g, ex + eye[0].length, ey0 + eye.length, "c");
  if (feats.has("glasses")) {
    for (let dx = -2; dx <= 2; dx++) setPx(g, ex + dx, ey - 2, "K"), setPx(g, ex + dx, ey + 2, "K");
    setPx(g, ex - 2, ey, "K"), setPx(g, ex + 2, ey, "K"), setPx(g, ex - 2, ey - 1, "K"), setPx(g, ex + 2, ey + 1, "K");
  }
  const colors = { ...DEFAULT_COLORS, ...spec.colors };
  // A dark eye vanishes on a dark body, so those get glowing eyes instead.
  if (luma(colors.B) < 0.3) Object.assign(colors, { P: "#fff2b8", E: "#21152a" });
  return { rows: outline(g).map((r) => r.join("")), colors };
}

function luma(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// The pupil is a shade off the outline color: the lighting (sprites.js) blends
// inner outline pixels into the fur around them, which smudged the eyes.
const DEFAULT_COLORS = { E: "#ffffff", P: "#21152a", F: "#ffb020", c: "#f29aa6" };

// ---------- Features on top of any body ----------
// `at` points come from the body: the top of the head, the middle of the back,
// and where the tail starts.

function headTop(d, ch = "A") {
  const { hEll, hPoly, feats } = d;
  if (feats.has("earsPoint")) {
    hPoly([[2, -3], [5, -10], [6, -2]], "b");
    hPoly([[-2, -3], [0, -11], [3, -3]], "B");
    hPoly([[-1, -4], [0, -8], [2, -4]], "A");
  }
  if (feats.has("earsRound")) {
    hEll(3, -5, 2.6, 2.6, "b");
    hEll(-1, -5, 2.8, 2.8, "B");
    hEll(-1, -5, 1.4, 1.4, "A");
  }
  if (feats.has("earsLong")) {
    hEll(3, -8, 1.8, 5.5, "b");
    hEll(0, -9, 2, 6, "B");
    hEll(0, -9, 0.9, 4.5, "L");
  }
  if (feats.has("horns")) {
    hPoly([[1, -4], [6, -11], [7, -9], [4, -3]], "a");
    hPoly([[-2, -4], [2, -12], [3, -10], [1, -3]], ch);
  }
  if (feats.has("antlers") || feats.has("coral")) {
    hPoly([[0, -4], [1, -9], [-2, -12], [0, -12], [2, -9], [4, -12], [5, -11], [3, -7], [2, -4]], ch);
  }
  if (feats.has("crest")) hPoly([[-1, -4], [1, -10], [3, -6], [6, -9], [6, -3]], ch);
  if (feats.has("crown")) {
    hPoly([[-3, -4], [-3, -8], [-1, -6], [1, -9], [3, -6], [5, -8], [5, -4]], "A");
  }
  if (feats.has("flame")) {
    hPoly([[-2, -4], [-1, -9], [1, -7], [2, -12], [4, -7], [5, -9], [5, -4]], "A");
    hPoly([[0, -4], [1, -7], [2, -9], [3, -6], [3, -4]], "a");
  }
  if (feats.has("sprout") || feats.has("leaf")) {
    hPoly([[0, -4], [-1, -8], [-5, -10], [-3, -6]], "A");
    hPoly([[1, -4], [3, -9], [7, -9], [4, -5]], "a");
  }
  if (feats.has("crystals")) hPoly([[-2, -4], [-1, -10], [1, -5], [2, -11], [4, -5], [6, -8], [6, -3]], ch);
  if (feats.has("star")) hPoly([[1, -12], [2, -8], [6, -8], [3, -6], [4, -2], [1, -5], [-2, -2], [-1, -6], [-4, -8], [0, -8]], "A");
  if (feats.has("cloud")) {
    hEll(1, -5, 4, 2.5, "L");
    hEll(-2, -6, 2.5, 2.2, "L");
    hEll(4, -6, 2.5, 2.2, "L");
  }
  if (feats.has("antennae")) {
    d.hPoly([[0, -4], [-2, -10], [-1, -10], [1, -4]], "b");
    hEll(-2, -11, 1.4, 1.4, "A");
    d.hPoly([[3, -4], [4, -10], [5, -10], [4, -4]], "b");
    hEll(5, -11, 1.4, 1.4, "A");
  }
  if (feats.has("petals")) {
    for (const [x, y] of [[-3, -6], [1, -9], [5, -6], [1, -4]]) hEll(x, y, 2.2, 2.2, "A");
    hEll(1, -6, 1.4, 1.4, "L");
  }
  if (feats.has("mushroomCap")) {
    hEll(1, -5, 7.5, 4, "A");
    hEll(-2, -6, 1.3, 1, "L"), hEll(3, -7, 1.5, 1.1, "L"), hEll(5, -4, 1, 0.8, "L");
  }
}

function back(d, x, y) {
  const { poly, ell, feats, line } = d;
  if (feats.has("wingsBat")) {
    poly([[x - 2, y + 2], [x + 2, y - 10], [x + 5, y - 6], [x + 8, y - 9], [x + 9, y - 1], [x + 4, y + 3]], "A");
    line(x + 2, y - 9, x + 3, y + 1, 1, "a");
    line(x + 8, y - 8, x + 5, y + 2, 1, "a");
  }
  if (feats.has("wingsBird")) {
    poly([[x - 3, y + 2], [x + 2, y - 9], [x + 9, y - 10], [x + 7, y - 6], [x + 10, y - 5], [x + 6, y - 2], [x + 8, y], [x + 3, y + 3]], "A");
    poly([[x, y + 1], [x + 3, y - 5], [x + 6, y - 4], [x + 3, y + 2]], "a");
  }
  if (feats.has("wingsMoth")) {
    ell(x + 3, y - 6, 5, 5, "A");
    ell(x + 6, y + 1, 3.5, 3.5, "a");
    ell(x + 3, y - 6, 2, 2, "L");
  }
  if (feats.has("mane")) poly([[x - 9, y + 3], [x - 8, y - 4], [x - 5, y - 1], [x - 4, y - 6], [x - 1, y - 1], [x + 1, y - 4], [x + 2, y + 3]], "A");
  if (feats.has("spikes")) for (let i = 0; i < 3; i++) poly([[x - 4 + i * 4, y + 1], [x - 2 + i * 4, y - 4], [x + i * 4, y + 1]], "A");
  if (feats.has("shell")) {
    ell(x, y + 3, 7, 5, "A");
    line(x - 5, y + 3, x + 5, y + 3, 1, "a");
    line(x, y - 1, x, y + 7, 1, "a");
  }
  if (feats.has("vines")) {
    line(x - 6, y + 2, x + 4, y + 6, 1.4, "A");
    ell(x - 2, y + 3, 1.5, 1.5, "a");
  }
  if (feats.has("gem")) {
    poly([[x - 1, y + 2], [x + 1, y - 1], [x + 3, y + 2], [x + 1, y + 5]], "A");
  }
  if (feats.has("ring")) {
    line(x - 10, y + 7, x + 8, y + 2, 1.6, "A");
    line(x - 9, y + 8, x + 9, y + 3, 1, "a");
  }
  if (feats.has("spots")) for (const [dx, dy] of [[-3, 3], [1, 5], [3, 2]]) ell(x + dx, y + dy, 1.2, 1.2, "A");
  if (feats.has("stripes")) for (const dx of [-3, 0, 3]) line(x + dx, y + 1, x + dx + 1, y + 6, 1, "b");
}

function tail(d, x, y) {
  const { poly, ell, line, feats } = d;
  if (feats.has("tailFluffy")) {
    ell(x + 4, y - 3, 3.5, 5, "B");
    ell(x + 5, y - 7, 2.5, 2.5, "L");
  }
  if (feats.has("tailFlame")) {
    line(x, y, x + 4, y - 3, 2.4, "B");
    poly([[x + 2, y - 2], [x + 4, y - 10], [x + 6, y - 6], [x + 8, y - 9], [x + 8, y - 1], [x + 5, y + 1]], "A");
    poly([[x + 4, y - 2], [x + 5, y - 6], [x + 7, y - 3]], "a");
  }
  if (feats.has("tailBolt")) poly([[x, y], [x + 4, y - 5], [x + 2, y - 6], [x + 7, y - 12], [x + 6, y - 6], [x + 8, y - 5], [x + 3, y + 1]], "A");
  if (feats.has("tailThin")) {
    line(x, y, x + 6, y - 6, 1.6, "B");
    ell(x + 6, y - 7, 1.8, 1.8, "A");
  }
  if (feats.has("tailSpiky")) {
    line(x, y, x + 8, y - 2, 2.6, "B");
    poly([[x + 2, y - 1], [x + 3, y - 5], [x + 5, y - 1]], "A");
    poly([[x + 5, y - 2], [x + 7, y - 6], [x + 8, y - 2]], "A");
    poly([[x + 7, y - 1], [x + 11, y - 4], [x + 9, y + 1]], "A");
  }
  if (feats.has("tailLeaf")) {
    line(x, y, x + 4, y - 4, 1.6, "B");
    poly([[x + 3, y - 3], [x + 6, y - 11], [x + 9, y - 6]], "A");
  }
}

// ---------- Body plans ----------
// Each one draws itself (back to front), sets where the head is, and says
// where its eye and the front of its mouth go (relative to the head).

const BODIES = {
  // Four legs, a snout, a tail: foxes, dogs, cats, bears, rams, lizards.
  beast: {
    eye: [-2, -1],
    mouth: [-6.4, 3.2],
    draw(d) {
      const { ell, line, hEll, setHead, feats } = d;
      tail(d, 22, 21);
      line(12, 24, 12, 30, 3, "b");
      line(22, 24, 22, 30, 3, "b");
      ell(17, 22, 9, 6, "B");
      ell(15, 25, 6, 2.5, "L");
      back(d, 18, 15);
      line(9, 24, 9, 30, 3.2, "B");
      line(19, 24, 19, 30, 3.2, "B");
      setHead(9, 13);
      headTop(d);
      d.head(6.4, 5.8);
      hEll(-5, 2, feats.has("longSnout") ? 3.6 : 2.8, 2.2, "L");
      hEll(-7.5, 1.2, 0.8, 0.7, "K");
    },
  },
  // Chunky, short-legged, with a big round head: bears, rams, moles.
  bear: {
    eye: [-2, -1],
    mouth: [-6.8, 3.6],
    draw(d) {
      const { ell, line, hEll, setHead } = d;
      tail(d, 24, 22);
      line(12, 26, 12, 30, 4, "b");
      line(22, 26, 22, 30, 4, "b");
      ell(17, 22, 10, 7.5, "B");
      ell(15, 25, 7, 3.4, "L");
      back(d, 18, 15);
      line(9, 26, 9, 30, 4.2, "B");
      line(19, 26, 19, 30, 4.2, "B");
      setHead(9, 14);
      headTop(d);
      d.head(7, 6.4);
      hEll(-5.5, 2.5, 2.4, 2, "L");
      hEll(-7.6, 1.8, 0.9, 0.8, "K");
    },
  },
  // Compact and round, with a little face: cats, kits, lynxes.
  cat: {
    eye: [-2, -1],
    mouth: [-5, 3],
    draw(d) {
      const { ell, line, hEll, setHead } = d;
      tail(d, 21, 24);
      line(13, 26, 13, 30, 2.6, "b");
      line(20, 26, 20, 30, 2.6, "b");
      ell(17, 24, 7.5, 5.5, "B");
      ell(15, 26, 5, 2.4, "L");
      back(d, 18, 19);
      line(11, 26, 11, 30, 2.8, "B");
      line(18, 26, 18, 30, 2.8, "B");
      setHead(10, 15);
      headTop(d);
      d.head(6.8, 6);
      hEll(-4, 2.2, 2, 1.6, "L");
      hEll(-5.6, 1.6, 0.7, 0.7, "K");
    },
  },
  // Long and low, with short legs and a long tail: lizards, salamanders, beetles.
  lizard: {
    eye: [-2, -1],
    mouth: [-7.6, 2.6],
    draw(d) {
      const { ell, line, hEll, setHead } = d;
      tail(d, 25, 25);
      line(24, 26, 30, 24, 2.6, "B");
      line(13, 27, 13, 31, 2.6, "b");
      line(22, 27, 22, 31, 2.6, "b");
      ell(18, 25, 10.5, 4.6, "B");
      ell(16, 27.5, 7, 1.8, "L");
      back(d, 18, 19);
      line(10, 27, 9, 31, 2.8, "B");
      line(19, 27, 19, 31, 2.8, "B");
      setHead(8, 20);
      headTop(d);
      d.head(6, 4.6);
      hEll(-5, 1.6, 3.4, 2, "L");
      hEll(-7.8, 0.8, 0.8, 0.7, "K");
    },
  },
  // A beast with wings and a long neck: dragons, gryphons.
  dragon: {
    eye: [-2, -1],
    mouth: [-7, 3.2],
    draw(d) {
      const { ell, line, hEll, setHead, feats } = d;
      feats.add("wingsBat");
      tail(d, 22, 22);
      line(12, 24, 12, 30, 3, "b");
      line(22, 24, 22, 30, 3, "b");
      back(d, 18, 16);
      ell(17, 22, 9, 6, "B");
      ell(14, 24, 6, 3, "L");
      line(10, 21, 8, 13, 5, "B");
      line(9, 24, 9, 30, 3.2, "B");
      line(19, 24, 19, 30, 3.2, "B");
      setHead(8, 10);
      headTop(d);
      d.head(5.8, 5.2);
      hEll(-5, 2, 3.4, 2.2, "L");
      hEll(-7.5, 1, 0.8, 0.7, "K");
    },
  },
  // A round bird with a beak, a wing, and tail feathers.
  bird: {
    eye: [-1, -1],
    draw(d) {
      const { ell, poly, line, hEll, hPoly, setHead } = d;
      poly([[22, 20], [30, 13], [31, 18], [29, 24]], "A");
      line(13, 26, 13, 31, 1.4, "F");
      line(18, 26, 18, 31, 1.4, "F");
      ell(17, 20, 8, 7, "B");
      ell(14, 23, 5, 4, "L");
      back(d, 18, 15);
      ell(19, 20, 5, 3.6, "A");
      ell(21, 21, 3, 2, "a");
      setHead(11, 11);
      headTop(d);
      d.head(5.6, 5.2);
      hPoly([[-4, 0], [-9, 1.5], [-4, 3]], "F");
    },
  },
  // A fish: a long body, fins, and a tail fin.
  fish: {
    eye: [-2, -1],
    mouth: [-5.4, 3],
    draw(d) {
      const { ell, poly, setHead } = d;
      poly([[25, 18], [31, 10], [29, 18], [31, 26]], "A");
      poly([[13, 12], [19, 6], [22, 13]], "A");
      ell(16, 18, 11, 6.5, "B");
      ell(14, 21, 8, 2.6, "L");
      back(d, 16, 12);
      poly([[14, 20], [17, 26], [20, 20]], "a");
      setHead(9, 17);
      headTop(d);
      d.ell(4, 19, 1, 0.8, "K");
    },
  },
  // A long coiled body with a tall neck: serpents, eels, wyrms.
  serpent: {
    eye: [-2, -1],
    mouth: [-7.6, 2.4],
    draw(d) {
      const { line, ell, hEll, setHead } = d;
      // The coil: thick at the middle, thinning to the tail.
      const path = [[29, 29, 2], [25, 30, 3.4], [20, 29, 4.5], [15, 27, 5], [12, 23, 4.6], [12, 18, 4], [11, 13, 3.6]];
      tail(d, 29, 29);
      for (let i = 1; i < path.length; i++) line(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1], path[i][2] * 1.6, "B");
      for (let i = 2; i < path.length - 1; i++) line(path[i - 1][0] - 1, path[i - 1][1] + 1, path[i][0] - 1, path[i][1] + 1, path[i][2] * 0.6, "L");
      back(d, 20, 24);
      setHead(9, 9);
      headTop(d);
      d.head(5.6, 4.8);
      hEll(-5, 1.6, 3.4, 2, "L");
      hEll(-7.6, 0.8, 0.8, 0.7, "K");
    },
  },
  // Standing on two legs with arms: golems, sprites, candle-folk, knights.
  biped: {
    eye: [-2, -1],
    mouth: [-6, 2.8],
    draw(d) {
      const { ell, line, hEll, setHead } = d;
      tail(d, 21, 24);
      line(13, 25, 13, 31, 3.6, "b");
      line(19, 25, 19, 31, 3.6, "B");
      line(22, 17, 24, 23, 2.8, "b");
      ell(16, 21, 7, 7.5, "B");
      ell(14, 23, 4, 5, "L");
      back(d, 19, 15);
      line(11, 18, 8, 23, 2.8, "B");
      setHead(14, 9);
      headTop(d);
      d.head(6.4, 6);
      hEll(-5, 1.8, 2.2, 1.8, "L");
    },
  },
  // Floating, with a wavy tail or tentacles: ghosts, jellies, wisps.
  ghost: {
    eye: [-3, -1],
    mouth: [-4.5, 2],
    draw(d) {
      const { ell, poly, line, feats, setHead } = d;
      if (feats.has("tentacles")) for (const x of [10, 14, 18, 22]) line(x, 22, x - 1, 29, 2.2, "B");
      else poly([[8, 19], [24, 19], [25, 26], [21, 23], [18, 28], [15, 23], [11, 27], [9, 24]], "B");
      ell(16, 16, 9, 8.5, "B");
      ell(14, 19, 5, 3.5, "L");
      back(d, 20, 10);
      ell(8, 19, 2.2, 1.6, "B");
      setHead(15, 15);
      headTop({ ...d, hEll: (dx, dy, rx, ry, ch) => d.hEll(dx, dy - 3, rx, ry, ch), hPoly: (pts, ch) => d.hPoly(pts.map(([x, y]) => [x, y - 3]), ch) });
    },
  },
  // A plant creature: a bulb body, leaves, little feet.
  plant: {
    eye: [-3, 0],
    mouth: [-4.5, 2.5],
    draw(d) {
      const { ell, poly, line, setHead } = d;
      line(12, 26, 12, 31, 2.4, "b");
      line(19, 26, 19, 31, 2.4, "b");
      poly([[22, 18], [30, 14], [26, 22]], "a");
      ell(16, 21, 9, 7.5, "B");
      ell(14, 24, 5, 3, "L");
      back(d, 18, 17);
      poly([[9, 20], [3, 18], [7, 23]], "a");
      setHead(15, 18);
      headTop({ ...d, hEll: (dx, dy, rx, ry, ch) => d.hEll(dx, dy - 4, rx, ry, ch), hPoly: (pts, ch) => d.hPoly(pts.map(([x, y]) => [x, y - 4]), ch) });
    },
  },
  // A squishy dome: slimes, lava blobs, puffs.
  blob: {
    eye: [-4, 0],
    mouth: [-5.5, 2.5],
    draw(d) {
      const { ell, setHead } = d;
      ell(16, 24, 11.5, 7.5, "B");
      ell(13, 27, 6, 2.6, "L");
      back(d, 18, 20);
      setHead(16, 22);
      headTop({ ...d, hEll: (dx, dy, rx, ry, ch) => d.hEll(dx, dy - 3, rx, ry, ch), hPoly: (pts, ch) => d.hPoly(pts.map(([x, y]) => [x, y - 3]), ch) });
    },
  },
};

// Evolving adds the features of a creature's element: one stage-2 feature,
// then more at stage 3.
export const STAGE_FEATS = {
  fire: [["tailFlame"], ["horns", "mane"]],
  water: [["crest"], ["spikes", "tailFluffy"]],
  nature: [["sprout"], ["vines", "antlers"]],
  lightning: [["tailBolt"], ["crest", "wingsBird"]],
  ice: [["crystals"], ["spikes", "wingsBird"]],
  rock: [["spikes"], ["horns", "shell"]],
  light: [["star"], ["wingsBird", "crest"]],
  dark: [["earsPoint"], ["horns", "wingsBat"]],
};

// Every creature's body plan and features (its colors are in critters.js
// CRITTERS). Malgrath keeps his own art.
const f = (body, ...feats) => ({ body, feats });
export const BEASTS = {
  pip: f("beast", "earsPoint", "tailFluffy", "wingsMoth"),
  // Meadow
  puddlepup: f("cat", "earsRound", "tailThin"),
  sproutling: f("plant", "sprout"),
  thistlefox: f("beast", "earsPoint", "tailFluffy"),
  petalpuff: f("blob", "petals"),
  frog: f("blob", "crown", "spots"),
  // Glowshroom Forest
  shroomlet: f("plant", "mushroomCap"),
  mossnout: f("bear", "earsRound", "vines"),
  lumoth: f("bird", "wingsMoth", "antennae"),
  glimmerkit: f("beast", "earsLong", "tailFluffy", "star"),
  owl: f("bird", "earsPoint", "glasses", "wingsBird"),
  // Magma Canyon
  magmite: f("blob", "flame", "spots"),
  scorchpup: f("beast", "earsPoint", "tailFlame", "longSnout"),
  ashcrow: f("bird", "crest", "wingsBird"),
  obsidrake: f("lizard", "horns", "spikes", "tailSpiky"),
  bat: f("dragon", "horns", "tailFlame"),
  // Coral Lagoon
  coralpuff: f("blob", "coral"),
  finnow: f("fish"),
  shellsnap: f("lizard", "shell"),
  jellybop: f("ghost", "tentacles", "crest"),
  octopus: f("ghost", "tentacles", "crest"),
  // Haunted Hollow
  pumpling: f("plant", "sprout", "stripes"),
  boolet: f("ghost"),
  candlewick: f("biped", "flame"),
  batcat: f("cat", "earsPoint", "wingsBat", "tailThin"),
  dragon: f("ghost", "crown", "stripes"),
  // Crown Keep
  squirepup: f("beast", "earsPoint", "crest", "tailThin"),
  crownling: f("blob", "crown"),
  shieldbug: f("lizard", "shell", "antennae"),
  griffling: f("bird", "crest", "wingsBird"),
  gryphon: f("beast", "crest", "crown", "wingsBird", "tailThin"),
  // Aurora Glacier
  pengling: f("bird", "crest"),
  icicub: f("bear", "earsRound", "crystals"),
  frostfox: f("beast", "earsPoint", "tailFluffy"),
  aurorafin: f("fish", "crest"),
  icewyrm: f("serpent", "crystals", "spikes"),
  // Thunder Peaks
  nimbling: f("blob", "cloud", "antennae"),
  zipsparrow: f("bird", "crest"),
  voltkit: f("cat", "earsPoint", "tailBolt"),
  thunderam: f("bear", "horns", "mane"),
  stormowl: f("bird", "earsPoint", "crest", "wingsBird"),
  // Cosmic Rift
  starbit: f("blob", "star"),
  moonmoth: f("bird", "wingsMoth", "antennae"),
  nebulynx: f("cat", "earsPoint", "tailFluffy", "ring"),
  voidjelly: f("ghost", "tentacles"),
  // Shop pets
  cat: f("cat", "earsPoint", "tailThin", "stripes"),
  drake: f("dragon", "horns"),
};
