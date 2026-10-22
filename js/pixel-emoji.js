// Pixel emoji: every emoji on screen is swapped for a tiny pixel-art version
// of itself, so icons match the sprites instead of looking pasted in.
//
// Each emoji is drawn small (CELL px) with the system's emoji font, its
// colors snapped to a few steps, and given the sprites' dark outline; then
// shown scaled up with crisp pixels. A watcher swaps emoji in any text that
// appears on the page, so nothing else needs to know about it.
//
// Text that's rewritten every frame should go through setText / setHtml, so
// it only changes (and gets pixelated) when it's actually different.

const CELL = 16; // drawing size; the icon is CELL + 2 with its outline
const OUTLINE = [43, 29, 46];
const STEP = 40; // color snapping: fewer colors, more pixel-art
// Emoji (with any variation selectors and joined parts), plus a few symbols
// that render as emoji on most systems.
const EMOJI = /(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}][\u{FE0F}\u{20E3}]?(?:\u{200D}[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}][\u{FE0F}]?)*)/gu;
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "OPTION", "SELECT", "TITLE", "NOSCRIPT"]);

const cache = new Map();

// A data URL of the pixel version of `emoji`.
export function pixelEmojiSrc(emoji) {
  if (cache.has(emoji)) return cache.get(emoji);
  const draw = document.createElement("canvas");
  draw.width = draw.height = CELL;
  const ctx = draw.getContext("2d", { willReadFrequently: true });
  ctx.font = `${CELL - 3}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, CELL / 2, CELL / 2 + 1);
  const src = ctx.getImageData(0, 0, CELL, CELL).data;

  const out = document.createElement("canvas");
  out.width = out.height = CELL + 2;
  const octx = out.getContext("2d");
  const image = octx.createImageData(CELL + 2, CELL + 2);
  const d = image.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < CELL && y < CELL && src[(y * CELL + x) * 4 + 3] > 110;
  const snap = (v) => Math.min(255, Math.round(v / STEP) * STEP);
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (!solid(x, y)) continue;
      const i = (y * CELL + x) * 4, o = ((y + 1) * (CELL + 2) + x + 1) * 4;
      const a = src[i + 3] / 255; // undo the font's soft edges
      d.set([snap(src[i] / a), snap(src[i + 1] / a), snap(src[i + 2] / a), 255], o);
    }
  }
  // The outline: every empty pixel touching the icon.
  for (let y = -1; y <= CELL; y++) {
    for (let x = -1; x <= CELL; x++) {
      if (solid(x, y)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => solid(x + dx, y + dy))) d.set([...OUTLINE, 255], ((y + 1) * (CELL + 2) + x + 1) * 4);
    }
  }
  octx.putImageData(image, 0, 0);
  const url = out.toDataURL();
  cache.set(emoji, url);
  return url;
}

// Swap the emoji in one text node for pixel images.
function swapText(node) {
  const text = node.nodeValue;
  EMOJI.lastIndex = 0;
  if (!EMOJI.test(text)) return;
  const parent = node.parentNode;
  if (!parent || SKIP.has(parent.nodeName) || parent.closest?.("[data-keep-emoji]")) return;
  const frag = document.createDocumentFragment();
  let last = 0;
  text.replace(EMOJI, (emoji, offset) => {
    if (offset > last) frag.appendChild(document.createTextNode(text.slice(last, offset)));
    const img = document.createElement("img");
    img.className = "px-emoji";
    img.src = pixelEmojiSrc(emoji);
    img.alt = emoji;
    img.draggable = false;
    frag.appendChild(img);
    last = offset + emoji.length;
    return emoji;
  });
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  parent.replaceChild(frag, node);
}

function swapAll(root) {
  if (root.nodeType === Node.TEXT_NODE) return swapText(root);
  if (root.nodeType !== Node.ELEMENT_NODE || SKIP.has(root.nodeName)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(swapText);
}

// Start swapping: everything on the page now, and anything that shows up later.
export function startPixelEmoji() {
  swapAll(document.body);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") swapText(r.target);
      else r.addedNodes.forEach(swapAll);
    }
  }).observe(document.body, { childList: true, characterData: true, subtree: true });
}

// For text rewritten every frame: only touch the page when it changes.
export function setText(el, text) {
  if (el._text === text) return;
  el._text = text;
  el._html = undefined;
  el.textContent = text;
}

export function setHtml(el, html) {
  if (el._html === html) return;
  el._html = html;
  el._text = undefined;
  el.innerHTML = html;
}
