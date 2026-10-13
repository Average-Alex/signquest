// Screen switching, plus the map, learn card, results, shop, and settings
// screens. The battle itself lives in game.js.

import { getPrediction, hasModel, HoldTimer, knnSampleCount, activeRecognizer } from "./classifier.js";
import { biomeBattleOver, enterBiome, resetBiomes, ROUTES } from "./biome.js";
import {
  BIOME_AREAS, BOSS_EXTRA_LEVELS, BUDDY_MAX_LEVEL, buddyXpToLevel, CONSUMABLES, creatureLevel, creatureName, CREATURES,
  DIMENSIONS, ELEMENTS, EVOLUTIONS, EVOLVE_LEVEL, isEvolved, SHOP, STAGES, TEAM_SIZE, TIPS, ZONES,
} from "./config.js";
import { startBattle } from "./game.js";
import * as progress from "./progress.js";
import { creatureImg, heroImg, itemImg, LANDMARKS, landmarkSrc, LOOK_OPTIONS, randomLook } from "./sprites.js";
import { playScene } from "./story.js";
import { worldMapSrc } from "./worldmap.js";

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

// Your hero, with your buddy creatures beside them.
export function renderAvatars() {
  const { look, equipped } = progress.get();
  const pets = progress.team().map((pet) => creatureImg(pet.id, "pet")).join("");
  for (const el of document.querySelectorAll("[data-avatar]")) el.innerHTML = heroImg(look, equipped.hat) + pets;
}

showHooks.title = renderAvatars;

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
  $("map-shards").textContent = `${progress.shardCount()} / ${ZONES.length}`;

  // The newest zone you can play, and which dimension's map to show.
  let newest = 0;
  ZONES.forEach((_, z) => progress.zoneUnlocked(z) && (newest = z));
  // Show the newest dimension you've reached, and never one you can't get to yet.
  if (mapDimension === null || !ZONES.some((zone, z) => zone.dimension === mapDimension && progress.zoneUnlocked(z))) {
    mapDimension = ZONES[newest].dimension;
  }
  const dim = mapDimension;

  // Map picture, then a landmark + ribbon label for each zone on top.
  const world = $("zones");
  world.className = `world dim-${dim}`;
  world.innerHTML = `<img class="sprite world-bg" src="${worldMapSrc(dim)}" alt=""><span class="world-title">${DIMENSIONS[dim].icon} ${DIMENSIONS[dim].name}</span>`;
  // Dotted trails for the roads you can walk between zones.
  const zoneById = (id) => ZONES.find((zn) => zn.id === id);
  const lines = ROUTES.map(([a, b]) => [zoneById(a), zoneById(b)])
    .filter(([a]) => a.dimension === dim)
    .map(([a, b]) => `<line x1="${a.map.x}" y1="${a.map.y}" x2="${b.map.x}" y2="${b.map.y}"/>`)
    .join("");
  world.insertAdjacentHTML("beforeend", `<svg class="routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>`);
  ZONES.forEach((zone, z) => {
    if (zone.dimension !== dim) return;
    const unlocked = progress.zoneUnlocked(z);
    const levels = `Lv ${creatureLevel(z, 0)}–${creatureLevel(z, BIOME_AREAS - 1) + BOSS_EXTRA_LEVELS}`;
    const letters = zone.letters.length > 8 ? "All letters" : zone.letters.join(" ");
    const { w, h } = LANDMARKS[zone.id];
    const button = document.createElement("button");
    button.className = `zone-pin ${zone.id}`;
    button.disabled = !unlocked;
    button.style.cssText = `left:${zone.map.x}%; top:${zone.map.y}%; --w:${w}; --h:${h}`;
    button.innerHTML = `
      <img class="sprite landmark" src="${landmarkSrc(zone.id)}" alt="">
      <span class="banner">${unlocked ? "" : "🔒 "}${zone.name}</span>
      <span class="zone-stars">${unlocked ? `★ ${progress.zoneStars(z)}/${STAGES.length * 3} · ${levels}` : letters}</span>`;
    button.setAttribute("aria-label", `${zone.name}, ${letters}, ${levels}${unlocked ? `, ${progress.zoneStars(z)} stars` : ", locked"}`);
    button.onclick = () => enterBiome(z);
    world.appendChild(button);
  });

  // A portal to the other dimension. Locked until you've beaten the
  // overworld's last boss, but you can see it - something to aim for.
  const other = dim === 0 ? 1 : 0;
  const realmStart = ZONES.findIndex((zone) => zone.dimension === 1);
  const portalOpen = progress.zoneUnlocked(realmStart);
  const portal = document.createElement("button");
  portal.className = "zone-pin portal";
  portal.disabled = !portalOpen;
  // Out on open water: the overworld's little island at the bottom right, the realm's upper left.
  portal.style.cssText = `left:${dim === 0 ? 89 : 10}%; top:${dim === 0 ? 80 : 32}%; --w:${LANDMARKS.void.w}; --h:${LANDMARKS.void.h}`;
  portal.innerHTML = `
    <img class="sprite landmark" src="${landmarkSrc("void")}" alt="">
    <span class="banner">${portalOpen ? "" : "🔒 "}${DIMENSIONS[other].icon} ${DIMENSIONS[other].name}</span>
    <span class="zone-stars">${portalOpen ? "Step through the portal!" : `Collect all ${realmStart} shards here`}</span>`;
  portal.setAttribute("aria-label", `Portal to the ${DIMENSIONS[other].name}${portalOpen ? "" : `, locked until you collect all ${realmStart} shards here`}`);
  portal.onclick = () => {
    mapDimension = other;
    showHooks.map();
    announce(`You step through the portal into the ${DIMENSIONS[other].name}!`);
  };
  world.appendChild(portal);

  // The hero stands next to the newest zone they can play (on this map).
  const here = ZONES[newest].dimension === dim ? ZONES[newest] : ZONES.find((zone) => zone.dimension === dim);
  const hero = document.createElement("span");
  hero.className = "world-hero";
  hero.style.cssText = `left:${here.map.x}%; top:${here.map.y}%; --w:${LANDMARKS[here.id].w}`;
  hero.innerHTML = heroImg(p.look, p.equipped.hat);
  world.appendChild(hero);
};
let mapDimension = null; // which dimension's map is showing

// Learn any new letters first, then fight `foeId` (a creature id) at `level`.
// `opts.owner`: whose creature it is, for rival battles (it can't be caught).
export function playStage(z, s, foeId, level, opts = {}) {
  // Zones can be visited in any order, so learn any letter this battle might
  // ask for first: the zone's letters, plus the ones in its words.
  const zone = ZONES[z];
  const needed = [...new Set([...zone.letters, ...(s > 0 ? zone.words.join("") : "")])];
  const unlearned = needed.filter((l) => !progress.get().learned.includes(l));
  if (unlearned.length) startLearn(unlearned, () => playStage(z, s, foeId, level, opts));
  else startBattle(z, s, foeId, level, (result) => showResults(z, s, result), opts);
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

// ---------- Evolution ----------
// "What? Pip is evolving!" The creature flickers between its old and new
// shapes, faster and faster, then a flash, and there it is.

function playEvolution(list, onDone) {
  const [first, ...rest] = list;
  if (!first) return onDone();
  const box = $("evolve");
  const art = $("evolve-art");
  const old = creatureImg(first.id, "evolve-old");
  const neu = creatureImg(first.id, "evolve-new", false, true);
  box.hidden = false;
  box.classList.remove("done");
  $("evolve-ok").hidden = true;
  $("evolve-text").textContent = `What? ${first.from} is evolving!`;
  announce(`What? ${first.from} is evolving!`);
  art.innerHTML = old;
  art.classList.add("glowing");
  // Swap shapes with shrinking gaps: slow, then a blur.
  let gap = 420, showingNew = false, elapsed = 0;
  const flick = () => {
    if (elapsed > 3200) {
      art.classList.remove("glowing");
      art.innerHTML = neu;
      box.classList.add("done");
      $("evolve-text").textContent = `Congratulations! ${first.from} evolved into ${first.to}! Its moves hit harder now.`;
      announce(`Congratulations! ${first.from} evolved into ${first.to}!`);
      $("evolve-ok").hidden = false;
      $("evolve-ok").focus();
      $("evolve-ok").onclick = () => {
        box.hidden = true;
        playEvolution(rest, onDone);
      };
      return;
    }
    showingNew = !showingNew;
    art.innerHTML = showingNew ? neu : old;
    elapsed += gap;
    gap = Math.max(60, gap * 0.8);
    setTimeout(flick, gap);
  };
  setTimeout(flick, 900);
}

// ---------- Results ----------

function showResults(z, s, result) {
  // Evolutions first, Pokemon-style, then the results.
  if (result.evolved?.length && !result.evolveShown) {
    result.evolveShown = true;
    return playEvolution(result.evolved, () => showResults(z, s, result));
  }
  show("results");
  const { won } = result;
  $("results-title").textContent = !won ? "Knocked out! 💫" : result.boss ? "Boss defeated! 🏆" : result.opts?.team ? `You beat ${result.opts.owner}! 🎉` : "You won! 🎉";
  $("results-stars").hidden = !won;
  $("results-stars").textContent = starsText(result.stars);
  $("results-stars").setAttribute("aria-label", `${result.stars} out of 3 stars`);
  $("results-xp").textContent = `+${result.xp} XP`;
  $("results-coins").textContent = won ? `+${result.coins} 🪙${result.prize ? ` (${result.prize} prize money!)` : ""}` : "";
  $("results-loot").hidden = !result.loot;
  if (result.loot) $("results-loot").innerHTML = `You found: ${itemImg(result.loot.id)} <b>${result.loot.name}</b>!`;
  $("results-caught").hidden = !result.caught;
  if (result.caught) $("results-caught").innerHTML = `${creatureImg(result.caught.id)}<span>The hex is broken! <b>${result.caught.name}</b> is free and joined your team! 🎉<br><small>Add it to your team in the 📖 creature book.</small></span>`;
  const levelUps = result.buddyLevels || [];
  $("results-level").hidden = !levelUps.length;
  $("results-level").textContent = levelUps.map((c) => `⬆️ ${c.name} reached level ${c.level}!`).join(" ");
  // A boss guards a Beacon Shard.
  const shard = won && result.boss;
  $("results-shard").hidden = !shard;
  if (shard) $("results-shard").textContent = `💎 You recovered a Beacon Shard! (${progress.shardCount()} of ${ZONES.length})`;
  biomeBattleOver(z, won);
  // Losing should point at what helps, not just say "you lost".
  $("results-tip").hidden = won;
  $("results-tip").textContent = "Tip: sign fast to make the monster dizzy, and use potions when your HP is low. You can buy more in the Shop.";
  $("results-practice").hidden = result.practice.length === 0;
  $("results-letters").innerHTML = result.practice.map((l) => `<span class="chip">${l}</span>`).join("");
  announce(
    (won
      ? `You won! ${result.stars} stars, ${result.xp} XP, ${result.coins} coins.${result.loot ? ` You found a ${result.loot.name}.` : ""}`
      : `Knocked out! You still get ${result.xp} XP. Try again!`) +
      (result.caught ? ` ${result.caught.name} is free and joined your team!` : "") +
      levelUps.map((c) => ` ${c.name} reached level ${c.level}!`).join(""),
  );
  // After a boss: the shard, and a piece of the story.
  if (shard) playScene(`shard-${result.zone.id}`, () => result.zone.dimension === 0 && playScene(`memory-${progress.shardCount()}`));

  $("results-again").textContent = won ? "🔁 Again" : "🔁 Try again";
  // A trainer only battles once (and a lost trainer battle restarts when they spot you again).
  $("results-again").hidden = Boolean(result.opts?.team);
  $("results-again").onclick = () => playStage(z, s, result.foe.id, result.level, result.opts);
  $("results-next").onclick = () => enterBiome(z);
}

// ---------- Shop ----------

showHooks.shop = () => {
  const p = progress.get();
  renderAvatars();
  $("shop-coins").textContent = p.coins;

  const potions = $("shop-consumables");
  potions.innerHTML = "";
  for (const item of CONSUMABLES) {
    const button = document.createElement("button");
    button.className = "shop-item";
    button.disabled = p.coins < item.price;
    button.innerHTML = `<span class="shop-icon">${itemImg(item.id)}</span><span class="shop-name">${item.name}</span><span class="small-text">${item.desc}</span>🪙 ${item.price}<span class="small-text">You have ${progress.consumableCount(item.id)}</span>`;
    button.onclick = () => {
      progress.buyConsumable(item);
      showHooks.shop();
    };
    potions.appendChild(button);
  }

  // Shop-only creatures join your team.
  const pets = $("shop-pets");
  pets.innerHTML = "";
  for (const creature of CREATURES.filter((c) => c.kind === "shop")) {
    const owned = progress.hasCreature(creature.id);
    const button = document.createElement("button");
    button.className = `shop-item${owned ? " wearing" : ""}`;
    button.disabled = owned || p.coins < creature.price;
    button.innerHTML = `<span class="shop-icon">${creatureImg(creature.id)}</span><span class="shop-name">${creature.name}</span>${owned ? "On your team ✓" : `🪙 ${creature.price}`}`;
    button.onclick = () => {
      progress.buyCreature(creature);
      showHooks.shop();
    };
    pets.appendChild(button);
  }

  for (const kind of ["hat"]) {
    const grid = $(`shop-${kind}s`);
    grid.innerHTML = "";
    for (const item of SHOP.filter((i) => i.kind === kind)) {
      const owned = p.owned.includes(item.id);
      const wearing = p.equipped[kind] === item.id;
      const button = document.createElement("button");
      button.className = `shop-item${wearing ? " wearing" : ""}`;
      button.disabled = !owned && p.coins < item.price;
      button.innerHTML = `<span class="shop-icon">${itemImg(item.id)}</span><span class="shop-name">${item.name}</span>${wearing ? "Wearing ✓" : owned ? "Wear" : `🪙 ${item.price}`}`;
      button.onclick = () => {
        if (owned) progress.equip(item);
        else progress.buy(item);
        showHooks.shop();
      };
      grid.appendChild(button);
    }
  }
};

// ---------- Creature book ----------

const zoneName = (id) => ZONES.find((zn) => zn.id === id)?.name;

showHooks.book = () => {
  const p = progress.get();
  const inBook = CREATURES.filter((c) => c.catchable !== false);
  const caught = inBook.filter((c) => progress.hasCreature(c.id)).length;
  $("book-count").textContent = `Freed ${caught} / ${inBook.length}`;
  const grid = $("book-grid");
  grid.innerHTML = "";
  for (const creature of inBook) {
    const mine = p.creatures[creature.id];
    const seen = p.seen.includes(creature.id);
    const where =
      creature.kind === "starter" ? "Your first friend" :
      creature.kind === "shop" ? "Sold in the Shop" :
      `${creature.kind === "boss" ? "Boss of" : "Lives in"} the ${zoneName(creature.zone)}`;
    const kind = (mv) => ({ attack: `${mv.power}x`, shield: "shield", heal: "heal", stun: "stun" })[mv.type];
    const moveText = (creature.moves || []).map((mv) => `<li>${mv.icon} ${mv.name} <span>${mv.cost}⚡ · ${kind(mv)}</span></li>`).join("");
    const onTeam = progress.onTeam(creature.id);
    const card = document.createElement("div");
    card.className = `book-card${mine ? "" : " unknown"}${onTeam ? " buddy" : ""}`;

    const el = ELEMENTS[creature.element];
    const elBadge = el ? `<span class="el-badge el-${creature.element}">${el.icon} ${el.name}</span>` : "";
    if (mine) {
      const maxed = mine.level >= BUDDY_MAX_LEVEL;
      const pct = maxed ? 100 : Math.round((mine.xp / buddyXpToLevel(mine.level)) * 100);
      const evolved = isEvolved(mine.level);
      const evolveNote = EVOLUTIONS[creature.id] && !evolved ? `<div class="small-text">✨ Evolves at level ${EVOLVE_LEVEL}!</div>` : "";
      card.innerHTML = `
        <div class="book-art">${creatureImg(creature.id, "", false, evolved)}</div>
        <div class="book-name">${creatureName(creature.id, mine.level)}</div>
        <div class="book-el">${elBadge}</div>
        <div class="book-level">Level ${mine.level}${maxed ? " (max)" : ""}</div>${evolveNote}
        <div class="xpbar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <ul class="book-moves">${moveText}</ul>
        <div class="small-text">${where}</div>`;
      // Your team: up to TEAM_SIZE buddies. Adding one when it's full swaps out the oldest.
      const button = document.createElement("button");
      button.className = `btn small${onTeam ? " go" : ""}`;
      button.textContent = onTeam ? "⭐ On your team" : "Add to team";
      button.disabled = onTeam && p.team.length <= 1;
      button.onclick = () => {
        if (onTeam) {
          progress.removeFromTeam(creature.id);
          announce(`${creatureName(creature.id, mine.level)} left your team.`);
        } else {
          const left = progress.addToTeam(creature.id);
          announce(`${creature.name} joined your team!${left ? ` ${CREATURES.find((c) => c.id === left).name} stepped out.` : ""}`);
        }
        showHooks.book();
      };
      button.title = onTeam ? "Tap to take it off your team" : `Your team has room for ${TEAM_SIZE}`;
      card.appendChild(button);
    } else {
      // Seen but not caught: a shadow with its name. Never seen: a mystery.
      card.innerHTML = `
        <div class="book-art silhouette">${creatureImg(creature.id)}</div>
        <div class="book-name">${seen ? creature.name : "???"}</div>
        <div class="book-el">${seen ? elBadge : ""}</div>
        <div class="small-text">${seen ? `${where}. Break its hex to free it!` : where}</div>`;
    }
    grid.appendChild(card);
  }
};

// `back` runs when you close the book (the biome needs restarting, not just showing).
let closeBook = () => show("map");
export function openBook(back) {
  closeBook = back;
  show("book");
}
$("book-back").onclick = () => closeBook();
$("map-book").onclick = () => openBook(() => show("map"));

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
  // Forget everything kept from before: the map's dimension and the zones' gates, bosses, and chests.
  mapDimension = null;
  resetBiomes();
  show("title");
};

// ---------- Hero maker ----------

// Hair style, outfit, and glasses buttons show a little hero; colors are swatches.
const SHAPE_PARTS = ["hairStyle", "outfitStyle", "glasses"];
const SWATCH_KEY = { hair: "H", skin: "S", eyes: "B", outfit: "R" };
let heroReturnTo = "title";

export function openHeroMaker(from) {
  heroReturnTo = from;
  show("hero");
}

showHooks.hero = () => {
  renderAvatars();
  renderHeroOptions();
};

function renderHeroOptions() {
  const { look } = progress.get();
  const box = $("hero-options");
  box.innerHTML = "";
  for (const [part, { label, choices }] of Object.entries(LOOK_OPTIONS)) {
    const group = document.createElement("div");
    group.className = "maker-group";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);
    group.innerHTML = `<p class="label">${label}</p>`;
    const row = document.createElement("div");
    row.className = "maker-row";
    for (const [id, choice] of Object.entries(choices)) {
      const button = document.createElement("button");
      const shape = SHAPE_PARTS.includes(part);
      button.className = shape ? "maker-shape" : "maker-swatch";
      button.setAttribute("aria-pressed", String(look[part] === id));
      button.setAttribute("aria-label", choice.name);
      button.title = choice.name;
      if (shape) button.innerHTML = heroImg({ ...look, [part]: id }) + `<span>${choice.name}</span>`;
      else button.style.background = choice[SWATCH_KEY[part]];
      button.onclick = () => {
        progress.update({ look: { ...progress.get().look, [part]: id } });
        renderAvatars();
        renderHeroOptions();
        box.querySelector(`[aria-label="${label}"] [aria-pressed=true]`)?.focus();
      };
      row.appendChild(button);
    }
    group.appendChild(row);
    box.appendChild(group);
  }
}

$("hero-random").onclick = () => {
  progress.update({ look: randomLook() });
  renderAvatars();
  renderHeroOptions();
};
$("hero-done").onclick = $("hero-back").onclick = () => show(heroReturnTo);
$("make-hero").onclick = () => openHeroMaker("title");
$("shop-look").onclick = () => openHeroMaker("shop");
