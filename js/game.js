// Battles: break a Hexbound creature's hex by signing.
//
// It's turn-based. Your turn:
//   1. Pick a move (or keep the default, Spark). Your hero has spells, and
//      each buddy has its own special move. Bigger moves cost more energy ⚡.
//   2. Sign the target (one letter, or a whole word one letter at a time).
//      Every letter you sign charges energy, so signing powers everything.
//   3. Your move fires - sometimes a critical hit, more often when you sign
//      fast. Only that one character acts each turn.
// Then it's the monster's turn and it attacks back. If you signed fast
// without a hint there's a chance it's too dizzy to attack (never two turns
// in a row); a stun move always stops it. Potions and power-ups can be used
// any time it's your turn and don't use it up.
//
// The battle lasts until the hex bar is empty (more targets keep coming if
// needed). Monsters have levels: higher ones hit harder and have more hex.
// Win, and a freed creature joins your team if it's new.
//
// Taking too long only brings a hint, then a skip button. Skipping still
// moves you on, but the monster gets its attack. If your HP runs out you're
// knocked out: you keep some XP and can try again.

import { getPrediction, HoldTimer } from "./classifier.js";
import {
  battleLength, BOSS_EXTRA_DAMAGE, buddyMoveBoost, BUDDY_XP_LOSS, BUDDY_XP_WIN, CONSUMABLES, CREATURES,
  ENEMY_BIG_CHANCE, ENEMY_BIG_DAMAGE, ENEMY_HEAL_FRACTION, ENEMY_QUICK_DAMAGE,
  CRIT_CHANCE, CRIT_CHANCE_FAST, CRIT_MULTIPLIER, dizzyChance, ENERGY_FAST_BONUS, ENERGY_MAX, ENERGY_PER_LETTER,
  ENERGY_START, FAST_SIGN_MS, HEAL_FRACTION, HERO_MOVES, HEX_HP_MULTIPLIER, HINT_AFTER_MS, LETTERS, LOOT_CHANCE,
  monsterDamage, playerMaxHp, POTION_HEAL, SHIELD_BLOCKS, SIGN_DAMAGE, SKIP_AFTER_MS, STAGES, TIPS, ZONES,
} from "./config.js";
import * as progress from "./progress.js";
import { announce, flashCamera, isShowing, renderAvatars, setHandImage, show } from "./screens.js";
import { battleBackdropSrc } from "./biome.js";
import { creatureImg, heroImg, itemImg } from "./sprites.js";

const $ = (id) => document.getElementById(id);
const PAUSE_AFTER_HIT_MS = 700; // so one held sign can't count twice
const MONSTER_TURN_MS = 1200;

const creature = (id) => CREATURES.find((c) => c.id === id);

let battle = null;

// ---------- Targets ----------

// Targets are strings: one letter ("A") or a word ("CAB"). Higher-level
// monsters get more of them planned (battleLength in config.js).
function planTargets(z, type, level) {
  const len = battleLength(level);
  if (type === "letters") return Array.from({ length: len.letters }, () => null).map(() => nextTarget(z, type));
  if (type === "words") return shuffledWords(z).slice(0, len.words);
  // Boss: review letters (weighted toward misses), then words to finish.
  return [...Array.from({ length: len.bossLetters }, () => nextTarget(z, "review")), ...shuffledWords(z).slice(0, len.bossWords)];
}

const shuffledWords = (z) => [...ZONES[z].words].sort(() => Math.random() - 0.5);

// One more target, for when the plan runs out but the hex isn't broken yet.
function nextTarget(z, type, previous) {
  const zone = ZONES[z];
  if (type === "words") return shuffledWords(z).find((w) => w !== previous) || zone.words[0];
  // Everything learned so far for review. The Starfall Realm reviews the whole alphabet.
  const pool = type === "review" ? (zone.dimension > 0 ? LETTERS : ZONES.slice(0, z + 1).flatMap((zn) => zn.letters)) : zone.letters;
  return progress.weightedPick(pool, previous);
}

// ---------- Starting a battle ----------

// `foeId` is the creature you're fighting (see CREATURES in config.js), at `level`.
export function startBattle(z, s, foeId, level, onFinish) {
  const zone = ZONES[z];
  const stage = STAGES[s];
  const foe = creature(foeId);
  const targets = planTargets(z, stage.type, level);
  const team = progress.team();
  // Room for your signing (with bigger moves), plus your buddies' free hits,
  // so leveled-up buddies only cut the battle a little short.
  const letters = targets.reduce((sum, t) => sum + t.length, 0);
  const maxHp = Math.round(letters * SIGN_DAMAGE * HEX_HP_MULTIPLIER);
  if (foe.catchable !== false) progress.markSeen(foe.id);
  const playerMax = playerMaxHp(progress.level());
  battle = {
    z, s, zone, stage, foe, level, team, targets, onFinish,
    t: 0, // which target
    i: 0, // which letter in the target
    turn: 1,
    hp: maxHp,
    maxHp,
    playerHp: playerMax,
    playerMax,
    energy: ENERGY_START,
    move: HERO_MOVES[0], // the move picked for this turn
    mover: null, // which buddy's move it is (null = your hero's spell)
    tab: 0, // which tab of the move picker is open (0 = you)
    foeHealed: false, // a wild creature heals at most once a battle
    stunned: false, // the monster skips its next turn
    dizzyLastTurn: false, // a monster can't be dizzy two turns in a row
    shield: 0, // hits left to block
    power: false, // next attack does double damage
    hold: new HoldTimer(),
    letterStart: 0,
    targetStart: 0,
    targetSlow: false, // a hint or skip during this target means no daze or energy bonus
    pauseUntil: 0,
    busy: false, // true while moves play out and during the monster's turn
    hinted: false,
    hints: 0,
    practice: new Set(),
    times: [],
    done: false,
  };

  show("battle");
  renderAvatars();
  $("battle-title").textContent = `${zone.icon} ${zone.name} · ${stage.name}`;
  $("arena-bg").src = battleBackdropSrc(zone.id);
  // Hexbound creatures look corrupted until you break the hex. (Malgrath is just like that.)
  const hexed = foe.catchable !== false;
  $("monster").innerHTML = creatureImg(foe.id, "", hexed);
  $("monster-name").textContent = foe.name;
  $("hud-foe-sub").textContent = `${foe.catchable === false ? "Hollow King" : "Hexbound"} · Lv ${level}`;
  $("hud-foe-portrait").innerHTML = creatureImg(foe.id, "", hexed);
  const p = progress.get();
  $("hud-you-name").textContent = p.name || "Hero";
  $("hud-you-level").textContent = `Lv ${progress.level()}`;
  $("hud-you-portrait").innerHTML = heroImg(p.look, p.equipped.hat);
  $("monster").className = `monster${stage.type === "boss" ? " boss" : ""}`;
  $("arena").dataset.zone = zone.id;
  // Your team: you in the middle, a buddy above and below.
  $("hero-sprite").className = "hero-sprite";
  $("hero-sprite").innerHTML = heroImg(p.look, p.equipped.hat);
  [0, 1].forEach((n) => {
    const pet = team[n];
    $(`buddy-slot-${n}`).hidden = !pet;
    $(`buddy-slot-${n}`).innerHTML = pet ? creatureImg(pet.id, "buddy") : "";
  });
  toggleBag(false);
  updateHp();
  updateStatus();
  setTurn("you");
  startLetter(performance.now());
  requestAnimationFrame(tick);
}

const currentTarget = () => battle.targets[battle.t];
const currentLetter = () => currentTarget()[battle.i];

function startLetter(now) {
  battle.letterStart = now;
  if (battle.i === 0) {
    battle.targetStart = now;
    battle.targetSlow = false;
  }
  battle.hinted = false;
  battle.hold.reset();
  $("hint").hidden = true;
  $("hint").classList.remove("glow");
  $("skip-btn").hidden = true;
  renderTarget();
  renderMoves();
  renderItems();
  const target = currentTarget();
  announce(target.length > 1 && battle.i === 0 ? `Your turn! Spell the word ${target.split("").join(" ")}` : `Sign ${currentLetter()}`);
}

function renderTarget() {
  const target = currentTarget();
  $("battle-count").textContent = `Turn ${battle.turn}`;
  $("target").innerHTML = target
    .split("")
    .map((letter, i) => {
      const state = i < battle.i ? "done" : i === battle.i && !battle.busy ? "now" : "";
      return `<span class="slot ${state}${target.length === 1 ? " single" : ""}">${letter}</span>`;
    })
    .join("");
}

function tick(now) {
  if (!battle || battle.done || !isShowing("battle")) {
    battle = null;
    return;
  }
  requestAnimationFrame(tick);
  if (battle.busy || now < battle.pauseUntil) return;

  const letter = currentLetter();
  const prediction = getPrediction();
  $("seeing").textContent = prediction ? `I see: ${prediction.letter}` : "Show your hand ✋";
  const held = battle.hold.update(letter, prediction, now);
  $("battle-hold").style.width = `${held * 100}%`;

  if (held >= 1) return letterDone(now, false);

  const waited = now - battle.letterStart;
  if (!battle.hinted && waited > HINT_AFTER_MS) showHint(true);
  if (waited > SKIP_AFTER_MS) $("skip-btn").hidden = false;
}

function showHint(auto) {
  if (battle.hinted) return;
  const letter = currentLetter();
  battle.hinted = true;
  battle.targetSlow = true;
  battle.hints++;
  battle.practice.add(letter);
  progress.addMiss(letter);
  $("hint-tip").textContent = TIPS[letter];
  setHandImage($("hint-img"), letter);
  toggleBag(false);
  $("hint").hidden = false;
  $("hint").classList.toggle("glow", auto);
  announce(`Hint for ${letter}: ${TIPS[letter]}`);
}

function letterDone(now, skipped) {
  const letter = currentLetter();
  if (skipped) battle.targetSlow = true;
  else {
    if (!battle.hinted) progress.addSuccess(letter);
    gainEnergy(ENERGY_PER_LETTER); // signing charges your energy
  }
  battle.times.push(now - battle.letterStart);
  battle.pauseUntil = now + PAUSE_AFTER_HIT_MS;
  $("battle-hold").style.width = "0%";
  $("hint").hidden = true;
  $("skip-btn").hidden = true;

  const target = currentTarget();
  battle.i++;
  if (battle.i < target.length) {
    // Next letter of a word: fill the slot, still your turn.
    flashCamera("good");
    startLetter(now + PAUSE_AFTER_HIT_MS);
    return;
  }

  // Finished a letter or a whole word: your move fires. That ends your turn.
  const perLetter = (now - battle.targetStart) / target.length;
  const fast = !battle.targetSlow && perLetter < FAST_SIGN_MS;
  if (fast) gainEnergy(ENERGY_FAST_BONUS);
  battle.busy = true;
  fireMove(target.length, fast);
  renderTarget();
  renderMoves();
  renderItems();
  if (battle.hp <= 0) return finish(true);

  // Only the one character you picked acts. Then it's the monster's turn.
  const b = battle;
  setTimeout(() => {
    if (battle !== b || b.done) return;
    monsterTurn(fast);
  }, 900);
}

// ---------- Moves and energy ----------

function gainEnergy(n) {
  battle.energy = Math.min(ENERGY_MAX, battle.energy + n);
  renderEnergy();
}

// Fires the move picked for this turn. `letters` is how many letters you just signed.
function fireMove(letters, fast) {
  const { move, mover } = battle;
  battle.energy -= move.cost;
  renderEnergy();

  if (!mover) {
    // One of your hero's spells: more letters signed and stronger spells hit harder.
    heroAttack(letters * SIGN_DAMAGE * move.power, move, fast);
  } else {
    // A buddy's special move.
    const pet = creature(mover.id);
    const el = buddyEl(battle.team.indexOf(mover));
    if (el) restartAnimation(el, move.type === "attack" ? "pounce" : "boost");
    flashCamera("good");
    if (move.type === "attack") {
      // Like your signing, scaled by the move's power and the buddy's level.
      const crit = Math.random() < (fast ? CRIT_CHANCE_FAST : CRIT_CHANCE);
      const damage = Math.round(letters * SIGN_DAMAGE * move.power * buddyMoveBoost(mover.level) * (crit ? CRIT_MULTIPLIER : 1));
      hitMonster(damage, crit, 250);
      if (move.power >= 4) restartAnimation($("arena"), "shake");
      popText(`${crit ? "CRITICAL! " : ""}${move.icon} ${move.name}!`, true);
      announce(`${pet.name} uses ${move.name}!${crit ? " Critical hit!" : ""} ${damage} damage.`);
    } else if (move.type === "shield") {
      battle.shield += 1;
      popText(`${move.icon} ${move.name}!`);
      announce(`${pet.name} uses ${move.name}! It will block the next hit.`);
    } else if (move.type === "heal") {
      const before = battle.playerHp;
      battle.playerHp = Math.min(battle.playerMax, before + Math.round(battle.playerMax * HEAL_FRACTION));
      floatText($("player-dmg"), `+${battle.playerHp - before}`, "good");
      popText(`${move.icon} ${move.name}!`);
      announce(`${pet.name} uses ${move.name}! You heal ${battle.playerHp - before} HP.`);
    } else if (move.type === "stun") {
      battle.stunned = true;
      popText(`${move.icon} ${move.name}!`);
      announce(`${pet.name} uses ${move.name}! ${battle.foe.name} is stunned.`);
    }
    updateHp();
    updateStatus();
  }

  // Back to the free spell for next turn, so nobody gets stuck.
  battle.move = HERO_MOVES[0];
  battle.mover = null;
}

function heroAttack(damage, move, fast) {
  const crit = Math.random() < (fast ? CRIT_CHANCE_FAST : CRIT_CHANCE);
  if (crit) damage *= CRIT_MULTIPLIER;
  let big = move.power > 1;
  if (battle.power) {
    damage *= 2;
    big = true;
    battle.power = false;
    updateStatus();
  }
  damage = Math.round(damage);
  restartAnimation($("hero-slot"), "pounce");
  hitMonster(damage, crit, 200);
  flashCamera("good");

  const spell = $("spell");
  spell.textContent = move.id === "nova" ? "🌟💥🌟" : move.id === "blast" ? "💥" : crit ? "🌟" : "✨";
  spell.className = `spell cast${big || crit ? " big" : ""}`;
  if (crit || move.id === "nova") restartAnimation($("arena"), "shake");
  popText(crit ? "CRITICAL HIT!" : big ? `${move.icon} ${move.name.toUpperCase()}!` : "Hit!", crit || big);
  announce(`${crit ? "Critical hit! " : ""}${move.name}! ${damage} damage.`);
  setTimeout(() => (spell.className = "spell"), 600);
}

function hitMonster(damage, crit, delay) {
  const b = battle;
  b.hp = Math.max(0, b.hp - damage);
  setTimeout(() => {
    // Still show it if this hit just won the battle (the battle may already be wrapping up).
    if (battle && battle !== b) return;
    restartAnimation($("monster"), "hit");
    floatText($("monster-dmg"), `-${damage}`, crit ? "crit" : "bad");
    updateHp(b);
  }, delay);
}

const buddyEl = (n) => $(`buddy-slot-${n}`);

// The move picker: a tab for you and each buddy, each with 3 moves. The move
// you pick stays picked even if you look at another tab.
function renderMoves() {
  const p = progress.get();
  const tabs = [{ who: "You", art: heroImg(p.look, p.equipped.hat, "tab-hero"), mover: null }].concat(
    battle.team.map((pet) => ({ who: creature(pet.id).name, art: creatureImg(pet.id, "tab-art"), mover: pet })),
  );
  if (battle.tab >= tabs.length) battle.tab = 0;
  $("move-tabs").innerHTML = "";
  tabs.forEach((tab, n) => {
    const button = document.createElement("button");
    const open = n === battle.tab;
    const hasPick = battle.mover === tab.mover;
    button.className = `move-tab${open ? " open" : ""}${hasPick ? " has-pick" : ""}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(open));
    button.innerHTML = `<span class="tab-face">${tab.art}</span><span class="tab-name">${tab.who}</span>`;
    button.onclick = () => {
      battle.tab = n;
      renderMoves();
    };
    $("move-tabs").appendChild(button);
  });

  const actor = battle.mover ? buddyEl(battle.team.indexOf(battle.mover)) : $("hero-slot");
  for (const el of document.querySelectorAll(".arena .fighter")) el.classList.toggle("acting", el === actor && !battle.busy);

  const tab = tabs[battle.tab];
  const moves = tab.mover ? creature(tab.mover.id).moves : HERO_MOVES;
  const bar = $("battle-moves");
  bar.innerHTML = "";
  moves.forEach((move, n) => {
    const picked = battle.move === move && battle.mover === tab.mover;
    const button = document.createElement("button");
    button.className = `move-btn${picked ? " picked" : ""} type-${move.type || "attack"}`;
    button.disabled = battle.busy || battle.done || move.cost > battle.energy;
    button.setAttribute("aria-pressed", String(picked));
    button.innerHTML = `
      <span class="move-icon">${move.icon}</span>
      <span class="move-text"><span class="move-name">${move.name}</span><span class="move-desc">${moveDescription(move)}</span></span>
      <span class="move-cost">${move.cost ? `${move.cost}⚡` : "Free"}</span>
      <span class="move-key" aria-hidden="true">${n + 1}</span>`;
    button.setAttribute("aria-label", `${tab.who}: ${move.name}. ${moveDescription(move)}. Costs ${move.cost} energy.`);
    button.onclick = () => pickMove(move, tab.mover);
    bar.appendChild(button);
  });
}

function moveDescription(move) {
  if (!move.type || move.type === "attack") return move.power > 1 ? `${move.power}x damage` : "Normal hit";
  return { shield: "Blocks a hit", heal: "Heals you", stun: "Skips their turn" }[move.type];
}

function pickMove(move, mover) {
  if (!battle || battle.busy || battle.done || move.cost > battle.energy) return;
  battle.move = move;
  battle.mover = mover;
  renderMoves();
  announce(`${move.name} ready. Sign to use it!`);
}

function renderEnergy(b = battle) {
  const pips = Array.from({ length: ENERGY_MAX }, (_, n) => `<span class="pip${n < b.energy ? " full" : ""}"></span>`).join("");
  $("energy").innerHTML = `<span class="energy-label">⚡ ${b.energy}</span>${pips}`;
  $("energy").setAttribute("aria-label", `Energy ${b.energy} of ${ENERGY_MAX}`);
  $("move-energy").textContent = `⚡ ${b.energy} / ${ENERGY_MAX}`;
}

// Keys: 1-3 pick a move from the open tab; left/right arrows switch tabs.
// (Letters are for signing in test mode.)
addEventListener("keydown", (e) => {
  if (!battle || !isShowing("battle")) return;
  if (/^[1-3]$/.test(e.key)) $("battle-moves").children[Number(e.key) - 1]?.click();
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    const tabs = $("move-tabs").children.length;
    battle.tab = (battle.tab + (e.key === "ArrowRight" ? 1 : tabs - 1)) % tabs;
    renderMoves();
  }
});

// The bag of potions and power-ups opens like a little pocket.
function toggleBag(open = $("bag").hidden) {
  $("bag").hidden = !open;
  $("bag-btn").setAttribute("aria-expanded", String(open));
  if (open) $("hint").hidden = true;
}
$("bag-btn").onclick = () => toggleBag();

// ---------- The monster's turn ----------

// `fast`: you signed fast without a hint, which gives a chance to daze it.
function monsterTurn(fast) {
  const b = battle;
  b.busy = true;
  const dazed = !b.stunned && fast && !b.dizzyLastTurn && Math.random() < dizzyChance(b.level);
  b.dizzyLastTurn = dazed;
  setTurn("monster");
  const name = b.foe.name;
  // Which of its moves it uses: usually the quick one; sometimes (from turn 2)
  // its big signature move; and once a battle, a heal if it's hurt and has one.
  const [quickMove, , bigMove] = b.foe.moves;
  const healMove = b.foe.moves.find((mv) => mv.type === "heal");
  const healing = healMove && !b.foeHealed && b.hp < b.maxHp * 0.4 && Math.random() < 0.5;
  const move = b.turn >= 2 && Math.random() < ENEMY_BIG_CHANCE ? bigMove : quickMove;

  if (b.stunned) {
    b.stunned = false;
    restartAnimation($("monster"), "dizzy");
    popText("Stunned! 💫");
    announce(`${name} is stunned and can't attack!`);
  } else if (dazed) {
    restartAnimation($("monster"), "dizzy");
    popText("Dizzy! 💫");
    announce(`You signed so fast, ${name} is too dizzy to attack!`);
  } else if (healing) {
    b.foeHealed = true;
    const amount = Math.round(b.maxHp * ENEMY_HEAL_FRACTION);
    b.hp = Math.min(b.maxHp, b.hp + amount);
    restartAnimation($("monster"), "boost");
    popText(`${healMove.icon} ${healMove.name}!`);
    floatText($("monster-dmg"), `+${amount}`, "good");
    updateHp();
    announce(`${name} uses ${healMove.name} and heals ${amount}!`);
  } else if (b.shield > 0) {
    b.shield--;
    updateStatus();
    restartAnimation($("monster"), "lunge");
    popText(`${move.icon} ${move.name}... Blocked! 🛡️`);
    announce(`${name} uses ${move.name}, but your shield blocks it!`);
  } else {
    const big = move === bigMove;
    const base = monsterDamage(b.level) + (b.stage.type === "boss" ? BOSS_EXTRA_DAMAGE : 0);
    const damage = Math.max(1, Math.round((base + Math.floor(Math.random() * 5) - 2) * (big ? ENEMY_BIG_DAMAGE : ENEMY_QUICK_DAMAGE)));
    b.playerHp = Math.max(0, b.playerHp - damage);
    restartAnimation($("monster"), "lunge");
    if (big) restartAnimation($("arena"), "shake");
    popText(`${move.icon} ${move.name}!`, big);
    setTimeout(() => {
      if (battle !== b) return;
      restartAnimation($("hero-sprite"), "hurt");
      floatText($("player-dmg"), `-${damage}`, big ? "crit" : "bad");
      updateHp();
    }, 250);
    announce(`${name} uses ${move.name}! You lose ${damage} HP.`);
    if (b.playerHp <= 0) return setTimeout(() => battle === b && finish(false), 700);
  }

  setTimeout(() => {
    if (battle !== b || b.done) return;
    // Next target. If the planned ones ran out, the hex isn't broken yet: keep going.
    b.t++;
    b.i = 0;
    b.turn++;
    if (b.t >= b.targets.length) {
      const type = b.stage.type === "boss" ? (b.turn % 3 === 0 ? "words" : "review") : b.stage.type;
      b.targets.push(nextTarget(b.z, type, b.targets[b.targets.length - 1]));
    }
    b.busy = false;
    setTurn("you");
    startLetter(performance.now());
  }, MONSTER_TURN_MS);
}

function setTurn(who) {
  const banner = $("turn");
  banner.textContent = who === "you" ? "Your turn!" : `${battle.foe.name}'s turn!`;
  banner.className = `turn-banner ${who === "you" ? "yours" : "theirs"}`;
}

// ---------- Potions and power-ups ----------

function renderItems() {
  const bar = $("battle-items");
  bar.innerHTML = "";
  for (const item of CONSUMABLES) {
    const count = progress.consumableCount(item.id);
    const button = document.createElement("button");
    button.className = "use-btn";
    button.innerHTML = `${itemImg(item.id)}<span class="use-count">${count}</span><span class="use-name">${item.name}</span>`;
    button.title = item.desc;
    button.setAttribute("aria-label", `${item.name}: ${item.desc}. You have ${count}.`);
    const healing = item.id === "potion" || item.id === "bigpotion";
    button.disabled =
      !count || battle.busy || battle.done ||
      (healing && battle.playerHp >= battle.playerMax) ||
      (item.id === "power" && battle.power);
    button.onclick = () => useItem(item);
    bar.appendChild(button);
  }
}

function useItem(item) {
  if (!battle || battle.busy || battle.done || !progress.useConsumable(item.id)) return;
  if (item.id === "potion" || item.id === "bigpotion") {
    const before = battle.playerHp;
    battle.playerHp = item.id === "potion" ? Math.min(battle.playerMax, before + POTION_HEAL) : battle.playerMax;
    floatText($("player-dmg"), `+${battle.playerHp - before}`, "good");
    updateHp();
    announce(`You drink a ${item.name.toLowerCase()}. +${battle.playerHp - before} HP.`);
  } else if (item.id === "shield") {
    battle.shield += SHIELD_BLOCKS;
    announce(`Shield up! It blocks the next ${SHIELD_BLOCKS} hits.`);
  } else if (item.id === "power") {
    battle.power = true;
    announce("Powered up! Your next attack hits twice as hard.");
  }
  restartAnimation($("hero-sprite"), "boost");
  updateStatus();
  renderItems();
  toggleBag(false);
}

function updateStatus() {
  const icons = [];
  if (battle.shield) icons.push(`<span class="status-icon">${itemImg("shield")}×${battle.shield}</span>`);
  if (battle.power) icons.push(`<span class="status-icon">${itemImg("power")}×2</span>`);
  $("player-status").innerHTML = icons.join("");
}

// ---------- Bits ----------

function updateHp(b = battle) {
  $("monster-hp").style.width = `${(b.hp / b.maxHp) * 100}%`;
  $("monster-hp-text").textContent = `${b.hp} / ${b.maxHp}`;
  $("player-hp").style.width = `${(b.playerHp / b.playerMax) * 100}%`;
  $("player-hp").classList.toggle("low", b.playerHp <= b.playerMax * 0.3);
  $("player-hp-text").textContent = `${b.playerHp} / ${b.playerMax}`;
  renderEnergy(b);
}

function restartAnimation(el, cls) {
  el.classList.remove("hit", "lunge", "dizzy", "hurt", "boost", "pounce", "shake");
  void el.offsetWidth;
  el.classList.add(cls);
}

function popText(text, crit = false) {
  const pop = $("pop");
  pop.textContent = text;
  pop.className = "pop";
  void pop.offsetWidth;
  pop.className = `pop show${crit ? " crit" : ""}`;
  clearTimeout(pop.timer);
  pop.timer = setTimeout(() => (pop.className = "pop"), 900);
}

function floatText(el, text, kind) {
  el.textContent = text;
  el.className = "dmg";
  void el.offsetWidth;
  el.className = `dmg show ${kind}`;
}

// Sparkles fly out from the monster when its hex breaks.
function sparkleBurst() {
  const side = document.querySelector(".fighter.monster-side");
  for (let n = 0; n < 10; n++) {
    const el = document.createElement("span");
    el.className = "sparkle";
    el.textContent = n % 3 ? "✨" : "💚";
    const angle = (n / 10) * Math.PI * 2;
    el.style.setProperty("--dx", `${Math.cos(angle) * 9}cqw`);
    el.style.setProperty("--dy", `${Math.sin(angle) * 7 - 4}cqw`);
    side.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
}

function rollLoot(boss) {
  if (!boss && Math.random() >= LOOT_CHANCE) return null;
  const table = ["potion", "potion", "potion", "potion", "potion", "shield", "shield", "power", "power", "bigpotion"];
  const id = table[Math.floor(Math.random() * table.length)];
  progress.addConsumable(id);
  return CONSUMABLES.find((c) => c.id === id);
}

function finish(won) {
  if (battle.done) return;
  battle.done = true;
  battle.busy = true;
  renderItems();
  renderMoves();
  const letters = battle.times.length;
  const boss = battle.stage.type === "boss";
  let result;

  if (won) {
    if (battle.foe.catchable === false) {
      // Malgrath isn't hexed - he's sealed away.
      $("monster").classList.add("sealed");
      popText("SEALED AWAY!", true);
    } else {
      // The hex shatters: a flash, then the creature's real colors come back.
      popText("HEX BROKEN!", true);
      $("monster").classList.add("healing");
      const foeId = battle.foe.id;
      setTimeout(() => {
        $("monster").innerHTML = creatureImg(foeId);
        $("hud-foe-portrait").innerHTML = creatureImg(foeId);
        $("hud-foe-sub").textContent = "Freed!";
        $("monster").classList.remove("healing");
        $("monster").classList.add("healed");
        sparkleBurst();
        popText("Healed! 💚");
        announce("The hex is broken! It's healed.");
      }, 450);
    }
    const avgSeconds = battle.times.reduce((a, b) => a + b, 0) / letters / 1000;
    // Stars: 3 for a fast, hint-free battle. Hints and slow signing each cost one.
    let stars = 3;
    if (battle.hints > 0) stars--;
    if (battle.hints >= 3) stars--;
    if (avgSeconds > 6) stars--;
    stars = Math.max(1, stars);
    result = {
      won: true,
      stars,
      xp: letters * 10,
      coins: stars * 5 + (boss ? 15 : 0),
      practice: [...battle.practice],
      boss,
      loot: rollLoot(boss),
      caught: battle.foe.catchable !== false && progress.catchCreature(battle.foe.id) ? battle.foe : null,
    };
  } else {
    $("hero-sprite").classList.add("knocked");
    // Every sign still counts as practice.
    result = { won: false, stars: 0, xp: letters * 5, coins: 0, practice: [...battle.practice], boss, loot: null, caught: null };
  }
  result.foe = battle.foe;
  result.level = battle.level;
  result.zone = battle.zone;
  const leveled = progress.addTeamXp(won ? BUDDY_XP_WIN : BUDDY_XP_LOSS);
  result.buddyLevels = leveled.map((id) => ({ ...creature(id), level: progress.get().creatures[id].level }));

  progress.recordStage(battle.z, battle.s, result);
  const { onFinish } = battle;
  setTimeout(() => onFinish(result), won ? 2200 : 1400);
}

$("hint-btn").onclick = () => battle && !battle.done && !battle.busy && showHint(false);
$("skip-btn").onclick = () => battle && !battle.done && !battle.busy && letterDone(performance.now(), true);
