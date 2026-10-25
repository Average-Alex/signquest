// 🥚 Raid eggs hatching. Winning a raid gives an egg (progress.addEgg); every
// sign you get right warms the egg in the incubator (progress.warmEgg). Once
// it's warm enough, maybeHatch() plays the hatching: the egg wobbles, you tap
// it to crack it open, and out comes a creature from the raid's zone.

import { CREATURES, rarityOf, stageOf } from "./config.js";
import * as progress from "./progress.js";
import { announce } from "./screens.js";
import { creatureSrc, eggSrc } from "./sprites.js";

const $ = (id) => document.getElementById(id);
const TIER_NAMES = { 1: "Raid I", 2: "Raid II", 3: "Raid III", 4: "🌀 Rift" }; // 4: from a Rift boss in Skyhaven
const TAPS_TO_CRACK = 3;
let hatching = false;

// Text for an egg counter: "🥚 7/15" (the incubator), plus how many more wait.
export function eggStatus() {
  const all = progress.eggs();
  if (!all.length) return "";
  const egg = all[0];
  return `🥚 ${Math.min(egg.warmth, egg.need)}/${egg.need}${all.length > 1 ? ` +${all.length - 1}` : ""}`;
}

export const eggTitle = () => {
  const egg = progress.eggs()[0];
  return egg ? `${TIER_NAMES[egg.tier]} egg: sign ${Math.max(0, egg.need - egg.warmth)} more signs to hatch it` : "";
};

// Plays the hatching if the incubator's egg is ready. Returns true if it started.
export function maybeHatch(onDone = () => {}) {
  if (hatching || !progress.readyEgg()) return false;
  hatching = true;
  const egg = progress.readyEgg();
  const box = document.createElement("div");
  box.className = "hatch";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Your egg is hatching");
  box.innerHTML = `
    <p class="hatch-title">🥚 Your ${TIER_NAMES[egg.tier]} egg is hatching!</p>
    <button class="hatch-egg tier-${egg.tier}" type="button" aria-label="Tap the egg"><img class="sprite" alt=""></button>
    <p class="hatch-help">Tap the egg to crack it open!</p>`;
  document.body.append(box);
  const button = box.querySelector(".hatch-egg");
  const img = button.querySelector("img");
  img.src = eggSrc(egg.tier, 0);
  button.focus();
  announce(`Your raid egg is hatching! Tap the egg to crack it open.`);
  let taps = 0;
  button.onclick = () => {
    if (taps >= TAPS_TO_CRACK) return;
    taps++;
    button.classList.remove("shake");
    void button.offsetWidth; // restart the shake
    button.classList.add("shake");
    img.src = eggSrc(egg.tier, taps);
    if (taps < TAPS_TO_CRACK) return;
    setTimeout(() => reveal(box, onDone), 500);
  };
  return true;
}

function reveal(box, onDone) {
  const born = progress.hatchEgg();
  const def = CREATURES.find((c) => c.id === born.id);
  const rarity = rarityOf(def);
  box.classList.add("hatched");
  box.innerHTML = `
    <p class="hatch-title">✨ It hatched! ✨</p>
    <img class="sprite hatch-born" src="${creatureSrc(born.id, false, 0, stageOf(born.level))}" alt="${def.name}">
    <p class="hatch-name"><b>${def.name}</b> <span class="rarity" style="color:${rarity.color}">${rarity.name}</span></p>
    <p class="hatch-help">${born.isNew ? `A new buddy, already level ${born.level}! Add it to your team from 📖 Book.` : `You already had ${def.name}, so it grew to level ${born.level}!`}</p>
    <button class="btn hatch-ok" type="button">Yay!</button>`;
  announce(`It hatched! ${def.name}, ${rarity.name}. ${born.isNew ? "A new buddy" : "It grew"}, level ${born.level}.`);
  const ok = box.querySelector(".hatch-ok");
  ok.focus();
  ok.onclick = () => {
    box.remove();
    hatching = false;
    onDone(born);
  };
}

export const isHatching = () => hatching;
