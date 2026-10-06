// Screen switching, plus the map, learn card, results, shop, and settings
// screens. The battle itself lives in game.js.

import { getPrediction, hasModel, HoldTimer, knnSampleCount, activeRecognizer } from "./classifier.js";
import { CHARACTERS, SHOP, STAGES, TIPS, ZONES } from "./config.js";
import { startBattle } from "./game.js";
import * as progress from "./progress.js";

const $ = (id) => document.getElementById(id);
const showHooks = {};

export function show(name) {
  for (const screen of document.querySelectorAll(".screen")) screen.hidden = screen.id !== `screen-${name}`;
  const screen = $(`screen-${name}`);

  // Move the one shared camera view into this screen, if it has a spot for it.
  const slot = screen.querySelector(".camera-slot");
  const camera = $("camera");
  (slot || $("camera-home")).appendChild(camera);
  if (slot) $("camera-video").play().catch(() => {});

  showHooks[name]?.();
  screen.querySelector("h1, h2")?.focus({ preventScroll: true });
}

export const isShowing = (name) => !$(`screen-${name}`).hidden;

// Every on-screen event is also announced for screen readers.
export function announce(text) {
  $("announce").textContent = text;
}

export function flashCamera(kind) {
  const flash = $("camera-flash");
  flash.className = `camera-flash ${kind}`;
  void flash.offsetWidth; // restart the animation
  flash.classList.add("on");
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => flash.classList.remove("on"), 700);
}

export function renderAvatars() {
  const { character, equipped } = progress.get();
  const hat = SHOP.find((i) => i.id === equipped.hat)?.icon || "";
  const pet = SHOP.find((i) => i.id === equipped.pet)?.icon || "";
  for (const el of document.querySelectorAll("[data-avatar]")) {
    el.innerHTML = `<span class="hat">${hat}</span><span class="hero">${character}</span><span class="pet">${pet}</span>`;
  }
}

export function setHandImage(img, letter) {
  // Reference photos go in assets/hands/A.jpg etc. Missing ones just hide.
  img.hidden = true;
  img.onload = () => (img.hidden = false);
  img.onerror = () => (img.hidden = true);
  img.alt = `Handshape for ${letter}`;
  img.src = `assets/hands/${letter}.jpg`;
}

const starsText = (n, max = 3) => "⭐".repeat(n) + "☆".repeat(max - n);

// ---------- World map ----------

showHooks.map = () => {
  const p = progress.get();
  renderAvatars();
  $("map-name").textContent = p.name || "Hero";
  $("map-level").textContent = progress.level();
  $("map-xp").style.width = `${progress.xpIntoLevel()}%`;
  $("map-coins").textContent = p.coins;
  $("zone-panel").hidden = true;

  $("zones").innerHTML = "";
  ZONES.forEach((zone, z) => {
    const unlocked = progress.zoneUnlocked(z);
    const button = document.createElement("button");
    button.className = `zone ${zone.id}`;
    button.disabled = !unlocked;
    button.innerHTML = `
      <span class="zone-icon">${unlocked ? zone.icon : "🔒"}</span>
      <span class="zone-name">${zone.name}</span>
      <span class="zone-letters">${zone.letters.join(" ")}</span>
      <span class="zone-stars">${starsText(progress.zoneStars(z), STAGES.length * 3).replace(/☆/g, "·")}</span>`;
    button.setAttribute("aria-label", `${zone.name}, letters ${zone.letters.join(", ")}${unlocked ? `, ${progress.zoneStars(z)} stars` : ", locked"}`);
    button.onclick = () => openZone(z);
    $("zones").appendChild(button);
  });
};

function openZone(z) {
  const zone = ZONES[z];
  $("zone-panel-title").textContent = `${zone.icon} ${zone.name}`;
  $("zone-panel-letters").innerHTML = zone.letters.map((l) => `<span class="chip">${l}</span>`).join("");
  $("zone-panel-stages").innerHTML = "";
  STAGES.forEach((stage, s) => {
    const button = document.createElement("button");
    const unlocked = progress.stageUnlocked(z, s);
    button.className = "btn stage";
    button.disabled = !unlocked;
    button.innerHTML = `${unlocked ? stage.icon : "🔒"} ${stage.name}<br><small>${starsText(progress.stageStars(z, s))}</small>`;
    button.onclick = () => playStage(z, s);
    $("zone-panel-stages").appendChild(button);
  });
  $("zone-panel").hidden = false;
  $("zone-panel-stages").querySelector("button:not(:disabled)")?.focus();
}

$("zone-panel-close").onclick = () => ($("zone-panel").hidden = true);

// Learn any new letters first, then fight.
export function playStage(z, s) {
  const unlearned = ZONES[z].letters.filter((l) => !progress.get().learned.includes(l));
  if (s === 0 && unlearned.length) startLearn(unlearned, () => playStage(z, s));
  else startBattle(z, s, (result) => showResults(z, s, result));
}

// ---------- Learn card ----------

let learn = null;

function startLearn(letters, onDone) {
  learn = { letters, index: 0, onDone, hold: new HoldTimer(), shownAt: 0, done: false };
  show("learn");
  showLearnCard();
  requestAnimationFrame(learnTick);
}

function showLearnCard() {
  const letter = learn.letters[learn.index];
  $("learn-count").textContent = `${learn.index + 1} / ${learn.letters.length}`;
  $("learn-letter").textContent = letter;
  $("learn-tip").textContent = TIPS[letter];
  setHandImage($("learn-img"), letter);
  $("learn-status").textContent = "Your turn! Make the sign.";
  $("learn-status").className = "status";
  $("learn-hold").style.width = "0%";
  $("learn-skip").hidden = true;
  learn.hold.reset();
  learn.shownAt = performance.now();
  learn.done = false;
  announce(`New sign: ${letter}. ${TIPS[letter]}`);
}

function learnTick(now) {
  if (!learn || !isShowing("learn")) return (learn = null);
  requestAnimationFrame(learnTick);
  if (learn.done) return;

  const letter = learn.letters[learn.index];
  const held = learn.hold.update(letter, getPrediction(), now);
  $("learn-hold").style.width = `${held * 100}%`;
  if (now - learn.shownAt > 15000) $("learn-skip").hidden = false;
  if (held >= 1) finishLearnCard(true);
}

function finishLearnCard(gotIt) {
  const letter = learn.letters[learn.index];
  learn.done = true;
  progress.markLearned(letter);
  if (gotIt) {
    $("learn-status").textContent = "Got it! ✅";
    $("learn-status").className = "status good";
    flashCamera("good");
    announce(`Got it! That's ${letter}.`);
  }
  setTimeout(() => {
    if (!learn) return;
    learn.index++;
    if (learn.index < learn.letters.length) showLearnCard();
    else {
      const { onDone } = learn;
      learn = null;
      onDone();
    }
  }, gotIt ? 1000 : 0);
}

$("learn-skip").onclick = () => learn && !learn.done && finishLearnCard(false);

// ---------- Results ----------

function showResults(z, s, result) {
  show("results");
  $("results-title").textContent = result.boss ? "Boss defeated! 🏆" : "You won! 🎉";
  $("results-stars").textContent = starsText(result.stars);
  $("results-stars").setAttribute("aria-label", `${result.stars} out of 3 stars`);
  $("results-xp").textContent = `+${result.xp} XP`;
  $("results-coins").textContent = `+${result.coins} 🪙`;
  $("results-practice").hidden = result.practice.length === 0;
  $("results-letters").innerHTML = result.practice.map((l) => `<span class="chip">${l}</span>`).join("");
  announce(`You won! ${result.stars} stars, ${result.xp} XP, ${result.coins} coins.`);

  $("results-again").onclick = () => playStage(z, s);
  const next = s + 1 < STAGES.length ? [z, s + 1] : z + 1 < ZONES.length ? [z + 1, 0] : null;
  $("results-next").hidden = !next;
  if (next) $("results-next").onclick = () => playStage(...next);
}

// ---------- Shop ----------

showHooks.shop = () => {
  const p = progress.get();
  renderAvatars();
  $("shop-coins").textContent = p.coins;
  for (const kind of ["hat", "pet"]) {
    const grid = $(`shop-${kind}s`);
    grid.innerHTML = "";
    for (const item of SHOP.filter((i) => i.kind === kind)) {
      const owned = p.owned.includes(item.id);
      const wearing = p.equipped[kind] === item.id;
      const button = document.createElement("button");
      button.className = `shop-item${wearing ? " wearing" : ""}`;
      button.disabled = !owned && p.coins < item.price;
      button.innerHTML = `<span class="shop-icon">${item.icon}</span>${wearing ? "Wearing ✓" : owned ? "Wear" : `🪙 ${item.price}`}`;
      button.onclick = () => {
        if (owned) progress.equip(item);
        else progress.buy(item);
        showHooks.shop();
      };
      grid.appendChild(button);
    }
  }
};

// ---------- Settings ----------

showHooks.settings = () => {
  const s = progress.get().settings;
  $("set-hold").value = s.holdMs;
  $("set-conf").value = s.minConfidence;
  $("set-hand").value = s.hand;
  $("set-recognizer").value = s.recognizer;
  $("reset-confirm").hidden = true;
  updateSettingsText();
};

function updateSettingsText() {
  const s = progress.get().settings;
  $("hold-value").textContent = `${(s.holdMs / 1000).toFixed(1)} s`;
  $("conf-value").textContent = `${Math.round(s.minConfidence * 100)}%`;
  const names = { model: "trained model", knn: `your ${knnSampleCount()} recorded signs`, keyboard: "keyboard (no camera)" };
  $("recognizer-info").textContent =
    `Using: ${names[activeRecognizer()]}.` + (hasModel() ? "" : " No trained model yet (model/weights.json).");
}

$("set-hold").oninput = (e) => (progress.updateSettings({ holdMs: Number(e.target.value) }), updateSettingsText());
$("set-conf").oninput = (e) => (progress.updateSettings({ minConfidence: Number(e.target.value) }), updateSettingsText());
$("set-hand").onchange = (e) => progress.updateSettings({ hand: e.target.value });
$("set-recognizer").onchange = (e) => (progress.updateSettings({ recognizer: e.target.value }), updateSettingsText());
$("reset-btn").onclick = () => ($("reset-confirm").hidden = false);
$("reset-confirm").onclick = () => {
  progress.reset();
  show("title");
};

export function renderCharacterPick(onPick) {
  const row = $("character-pick");
  row.innerHTML = "";
  for (const character of CHARACTERS) {
    const button = document.createElement("button");
    button.className = "pick";
    button.textContent = character;
    button.setAttribute("aria-pressed", String(progress.get().character === character));
    button.onclick = () => {
      progress.update({ character });
      renderCharacterPick(onPick);
      onPick?.();
    };
    row.appendChild(button);
  }
}
