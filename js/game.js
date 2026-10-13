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
// Elements: big moves have an element (config.js ELEMENTS). Against the
// right creature they're super effective; the move buttons say which.
// Sign challenges: some turns are a riddle, a missing letter, or a
// quick-draw instead of a plain letter, and hit harder.
// Trainers bring a team: when one creature is beaten, the next comes out.
//
// Taking too long only brings a hint, then a skip button. Skipping still
// moves you on, but the monster gets its attack. If your HP runs out you're
// knocked out: you keep some XP and can try again.

import { getPrediction, HoldTimer } from "./classifier.js";
import {
  battleLength, BOSS_EXTRA_DAMAGE, buddyMoveBoost, BUDDY_XP_LOSS, BUDDY_XP_WIN, CONSUMABLES, CREATURES,
  ENEMY_BIG_CHANCE, ENEMY_BIG_DAMAGE, ENEMY_HEAL_FRACTION, ENEMY_QUICK_DAMAGE,
  CHALLENGE_BONUS, CHALLENGE_CHANCE, COMBO_BONUS, COMBO_MAX, creatureName, CRIT_CHANCE, effectiveness, ELEMENTS, EVOLVED_POWER,
  isEvolved, QUICK_BONUS, QUICK_MS, TRAINER_HP, CRIT_CHANCE_FAST, CRIT_MULTIPLIER, dizzyChance, ENERGY_FAST_BONUS, ENERGY_MAX, ENERGY_PER_LETTER,
  ENERGY_START, FAST_SIGN_MS, HEAL_FRACTION, HERO_MOVES, HEX_HP_MULTIPLIER, HINT_AFTER_MS, LETTERS, LOOT_CHANCE,
  monsterDamage, playerMaxHp, POTION_HEAL, SHIELD_BLOCKS, SIGN_DAMAGE, SKIP_AFTER_MS, STAGES, TIPS, ZONES,
} from "./config.js";
import * as progress from "./progress.js";
import { announce, flashCamera, isShowing, renderAvatars, setHandImage, show } from "./screens.js";
import { battleBackdropSrc } from "./biome.js";
import * as fx from "./fx.js";
import { QUESTS } from "./quests.js";
import { playLines } from "./story.js";
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
  // Review: this zone's letters plus every other letter you've learned
  // (zones can be played in any order). The Starfall Realm reviews the whole alphabet.
  const known = progress.get().learned;
  const pool = type === "review" ? (zone.dimension > 0 ? LETTERS : [...new Set([...zone.letters, ...known])]) : zone.letters;
  return progress.weightedPick(pool, previous);
}

// ---------- Starting a battle ----------

// `foeId` is the creature you're fighting (see CREATURES in config.js), at `level`.
// `opts.owner`: a rival's or trainer's name, when it's their creature.
// `opts.team`: a trainer's whole team, [{ id, level }, ...], fought in order.
export function startBattle(z, s, foeId, level, onFinish, opts = {}) {
  const zone = ZONES[z];
  const stage = STAGES[s];
  const foes = opts.team || [{ id: foeId, level }];
  const targets = planTargets(z, stage.type, foes[0].level);
  const team = progress.team();
  const playerMax = playerMaxHp(progress.level());
  battle = {
    z, s, zone, stage, team, targets, onFinish, opts,
    foes,
    foeIndex: 0,
    foe: null, // set by sendOut()
    level: 0,
    hp: 0,
    maxHp: 0,
    mode: "plain", // this turn's sign challenge (see pickChallenge)
    blank: null, // for "blank": { word, index }
    quickUntil: 0,
    revealed: false, // a riddle's answer was shown by a hint
    bonus: 1,
    lastMode: "plain",
    charging: null, // a big move the monster is winding up (it lands next turn)
    combo: 0, // targets signed fast in a row, without hints: each adds damage
    phase2Done: false, // bosses surge with power at half health
    surge: false,
    t: 0, // which target
    i: 0, // which letter in the target
    turn: 1,
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
  $("battle-title").textContent = `${zone.icon} ${zone.name} · ${opts.team ? `${opts.owner}` : stage.name}`;
  $("arena-bg").src = battleBackdropSrc(zone.id);
  $("arena").classList.remove("surge");
  sendOut(battle);
  renderCombo();
  $("battle-warning").hidden = true;
  const p = progress.get();
  $("hud-you-name").textContent = p.name || "Hero";
  $("hud-you-level").textContent = `Lv ${progress.level()}`;
  $("hud-you-portrait").innerHTML = heroImg(p.look, p.equipped.hat);
  $("arena").dataset.zone = zone.id;
  // Your team: you in the middle, a buddy above and below.
  $("hero-sprite").className = "hero-sprite";
  $("hero-sprite").innerHTML = heroImg(p.look, p.equipped.hat);
  [0, 1].forEach((n) => {
    const pet = team[n];
    $(`buddy-slot-${n}`).hidden = !pet;
    $(`buddy-slot-${n}`).innerHTML = pet ? creatureImg(pet.id, "buddy", false, isEvolved(pet.level)) : "";
  });
  toggleBag(false);
  updateHp();
  updateStatus();
  setTurn("you");
  startLetter(performance.now());
  requestAnimationFrame(tick);
}

// Puts the next foe on the field (the first one, or a trainer's next creature).
function sendOut(b) {
  const { id, level } = b.foes[b.foeIndex];
  const foe = creature(id);
  b.foe = foe;
  b.level = level;
  // HP: room for your signing (with bigger moves), plus your buddies' free
  // hits, so leveled-up buddies only cut the battle a little short. A
  // trainer's creatures have less each, since there are several.
  const plan = planTargets(b.z, b.stage.type, level);
  const letters = plan.reduce((sum, t) => sum + t.length, 0);
  b.maxHp = Math.round(letters * SIGN_DAMAGE * HEX_HP_MULTIPLIER * (b.opts.team ? TRAINER_HP : 1));
  b.hp = b.maxHp;
  b.charging = null;
  b.foeHealed = false;
  b.stunned = false;
  b.dizzyLastTurn = false;
  b.phase2Done = false;
  b.surge = false;
  $("arena").classList.remove("surge");
  $("battle-warning").hidden = true;
  if (foe.catchable !== false) progress.markSeen(foe.id);
  // Hexbound creatures look corrupted until you break the hex. (Malgrath is
  // just like that.) A trainer's or rival's creatures aren't hexed.
  const hexed = foe.catchable !== false && !b.opts.owner;
  $("monster").innerHTML = creatureImg(foe.id, "", hexed);
  $("monster").className = `monster${b.stage.type === "boss" ? " boss" : ""}`;
  $("monster-name").textContent = b.opts.owner ? `${b.opts.owner}'s ${foe.name}` : foe.name;
  const el = ELEMENTS[foe.element];
  const kind = b.opts.team ? "Trainer" : b.opts.owner ? "Rival battle" : foe.catchable === false ? "Hollow King" : "Hexbound";
  $("hud-foe-sub").innerHTML = `${el ? `<span class="el-badge el-${foe.element}">${el.icon} ${el.name}</span>` : ""}${kind} · Lv ${level}`;
  $("hud-foe-portrait").innerHTML = creatureImg(foe.id, "", hexed);
  // A trainer's team: one ball per creature, dark once beaten.
  $("foe-team").hidden = b.foes.length < 2;
  $("foe-team").innerHTML = b.foes.map((_, n) => `<span class="ball${n < b.foeIndex ? " out" : ""}${n === b.foeIndex ? " now" : ""}"></span>`).join("");
  updateHp(b);
}

const currentTarget = () => battle.targets[battle.t];
const currentLetter = () => currentTarget()[battle.i];

// Some turns twist what you sign, so battles don't all feel the same.
// Only single letters get a challenge, never on the first turn, and never the
// same twist twice in a row.
function pickChallenge(b) {
  const target = b.targets[b.t];
  b.blank = null;
  if (target.length !== 1 || b.turn < 2) return "plain";
  const roll = Math.random();
  let sum = 0;
  for (const [mode, chance] of Object.entries(CHALLENGE_CHANCE)) {
    sum += chance;
    if (roll >= sum || mode === b.lastMode) continue;
    if (mode === "blank") {
      // A word from this zone (or earlier) with the letter in it.
      const words = ZONES.slice(0, b.z + 1).flatMap((zn) => zn.words).filter((w) => w.includes(target));
      if (!words.length) return "plain";
      const word = words[Math.floor(Math.random() * words.length)];
      b.blank = { word, index: word.indexOf(target) };
    }
    return mode;
  }
  return "plain";
}

function startLetter(now) {
  battle.letterStart = now;
  if (battle.i === 0) {
    battle.targetStart = now;
    battle.targetSlow = false;
    battle.mode = pickChallenge(battle);
    battle.lastMode = battle.mode;
    battle.revealed = false;
    battle.quickUntil = battle.mode === "quick" ? now + QUICK_MS : 0;
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
  const letter = currentLetter();
  const said = {
    riddle: `Riddle! Which letter is this? ${TIPS[letter]}`,
    blank: battle.blank && `Fill in the missing letter: ${battle.blank.word.split("").map((l, n) => (n === battle.blank.index ? "blank" : l)).join(" ")}`,
    quick: `Quick-draw! Sign ${letter} fast for double damage!`,
  }[battle.mode];
  announce(said || (target.length > 1 && battle.i === 0 ? `Your turn! Spell the word ${target.split("").join(" ")}` : `Sign ${letter}`));
}

function renderTarget() {
  const target = currentTarget();
  const { mode, blank } = battle;
  $("battle-count").textContent = `Turn ${battle.turn}`;
  $("target").dataset.answer = currentLetter() || ""; // for automated tests
  $("sign-label").textContent = { riddle: "🧩 Riddle! Which letter?", blank: "✏️ Fill in the missing letter", quick: "⚡ Quick-draw! Sign it fast" }[mode] || "Sign this";
  $("challenge").hidden = mode !== "riddle" && mode !== "quick";
  if (mode === "riddle") $("challenge").textContent = `“${TIPS[target]}”`;
  if (mode === "quick") renderQuick(performance.now());
  $("sign-label").className = `cmd-label${mode !== "plain" ? " challenge-label" : ""}`;
  const done = battle.i > 0;
  if (mode === "blank" && blank) {
    // The word, with a gap where the letter goes.
    $("target").innerHTML = blank.word
      .split("")
      .map((l, n) => (n === blank.index ? `<span class="slot ${done ? "done" : battle.busy ? "" : "now"}">${done ? l : "?"}</span>` : `<span class="slot given">${l}</span>`))
      .join("");
    return;
  }
  $("target").innerHTML = target
    .split("")
    .map((letter, i) => {
      const state = i < battle.i ? "done" : i === battle.i && !battle.busy ? "now" : "";
      const hidden = mode === "riddle" && !battle.revealed && i >= battle.i && state !== "done";
      return `<span class="slot ${state}${target.length === 1 ? " single" : ""}">${hidden ? "?" : letter}</span>`;
    })
    .join("");
}

// The quick-draw countdown.
function renderQuick(now) {
  const left = battle.quickUntil - now;
  const el = $("challenge");
  if (left > 0) el.textContent = `⏱️ ${(left / 1000).toFixed(1)}s for ×${QUICK_BONUS} damage!`;
  else el.textContent = "Too slow for the bonus. Keep going!";
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
  $("seeing").textContent = prediction?.partial ? "✋ Move your whole hand into view" : prediction ? `I see: ${prediction.letter}` : "Show your hand ✋";
  const held = battle.hold.update(letter, prediction, now);
  $("battle-hold").style.width = `${held * 100}%`;
  if (battle.mode === "quick") renderQuick(now);

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
  // A hint gives away a riddle's answer.
  if (battle.mode === "riddle" || battle.mode === "blank") {
    battle.revealed = true;
    if (battle.mode === "blank") $("target").children[battle.blank.index].textContent = letter;
    else renderTarget();
  }
  $("hint-tip").textContent = battle.mode === "plain" || battle.mode === "quick" ? TIPS[letter] : `It's ${letter}! ${TIPS[letter]}`;
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
  battle.combo = fast ? battle.combo + 1 : 0;
  renderCombo();
  // Challenges done without a hint (or skip) hit harder.
  battle.bonus = 1;
  if (!battle.targetSlow) {
    if (battle.mode === "quick" && now <= battle.quickUntil) battle.bonus = QUICK_BONUS;
    if (battle.mode === "riddle" || battle.mode === "blank") battle.bonus = CHALLENGE_BONUS;
  }
  battle.busy = true;
  fireMove(target.length, fast);
  renderTarget();
  renderMoves();
  renderItems();
  if (battle.hp <= 0) return battle.foeIndex < battle.foes.length - 1 ? nextFoe(battle) : finish(true);

  // Only the one character you picked acts. Then it's the monster's turn.
  // (At half health, a boss first surges with dark power: phase 2.)
  const b = battle;
  setTimeout(() => {
    if (battle !== b || b.done) return;
    if (b.stage.type === "boss" && !b.phase2Done && b.hp <= b.maxHp / 2) phase2(b, () => monsterTurn(fast));
    else monsterTurn(fast);
  }, ATTACK_FX_MS + 700);
}

// Phase 2: Malgrath's voice cuts in, and the boss heals a little and hits harder.
function phase2(b, next) {
  b.phase2Done = true;
  b.surge = true;
  b.hp = Math.min(b.maxHp, b.hp + Math.round(b.maxHp * 0.1));
  updateHp(b);
  $("arena").classList.add("surge");
  fx.flash("#5a1f8a", 500, 0.6);
  fx.burst(at.foe(), "hex", { count: 70, speed: 2.4, life: 900 });
  fx.ring(at.foe(), "hex", { maxR: 50, life: 600, width: 3 });
  fx.shake(8, 500);
  $("hud-foe-sub").textContent = `⚡ Powered up! · Lv ${b.level}`;
  popText("⚡ PHASE 2!", true);
  announce(`${b.foe.name} surges with dark power!`);
  const lines = QUESTS[b.zone.id]?.phase2 || [];
  setTimeout(() => (lines.length ? playLines(lines, next) : next()), 900);
}

// ---------- Moves and energy ----------

function gainEnergy(n) {
  battle.energy = Math.min(ENERGY_MAX, battle.energy + n);
  renderEnergy();
}

// Where things are on the field, for effects.
const at = {
  hero: () => fx.centerOf($("hero-sprite"), 0.45),
  buddy: (n) => fx.centerOf(buddyEl(n), 0.5),
  foe: () => fx.centerOf($("monster"), 0.5),
};

// How long an attack takes from wind-up to impact (the hit lands at the end).
const ATTACK_FX_MS = 560;

// Fires the move picked for this turn. `letters` is how many letters you just signed.
function fireMove(letters, fast) {
  const { move, mover } = battle;
  battle.energy -= move.cost;
  renderEnergy();
  // A streak of fast signs makes every attack hit harder, and so does a
  // challenge, and a move the foe is weak to.
  const eff = effectiveness(move.element, battle.foe.element);
  const comboBoost = (1 + Math.min(battle.combo, COMBO_MAX) * COMBO_BONUS) * battle.bonus * eff;
  if (battle.bonus > 1) popText(battle.mode === "quick" ? `⚡ QUICK-DRAW! ×${QUICK_BONUS}` : "🧩 Solved! Bonus damage!", true);
  if (eff !== 1 && (!move.type || move.type === "attack")) {
    setTimeout(() => {
      popText(eff > 1 ? "It's super effective! ▲" : "Not very effective... ▼", eff > 1);
      announce(eff > 1 ? "It's super effective!" : "It's not very effective.");
    }, ATTACK_FX_MS + 450);
  }

  if (!mover) {
    // One of your hero's spells: more letters signed and stronger spells hit harder.
    heroAttack(letters * SIGN_DAMAGE * move.power * comboBoost, move, fast);
  } else {
    // A buddy's move.
    const pet = creature(mover.id);
    const n = battle.team.indexOf(mover);
    const el = buddyEl(n);
    flashCamera("good");
    if (move.type === "attack") {
      // Like your signing, scaled by the move's power and the buddy's level.
      const crit = Math.random() < (fast ? CRIT_CHANCE_FAST : CRIT_CHANCE);
      const evolved = isEvolved(mover.level) ? EVOLVED_POWER : 1;
      const damage = Math.round(letters * SIGN_DAMAGE * move.power * buddyMoveBoost(mover.level) * evolved * comboBoost * (crit ? CRIT_MULTIPLIER : 1));
      attackFx({ from: at.buddy(n), attacker: el, move, crit });
      hitMonster(damage, crit, ATTACK_FX_MS);
      popText(`${move.icon} ${move.name}!`, true);
      if (crit) setTimeout(() => popText("CRITICAL HIT!", true), ATTACK_FX_MS);
      announce(`${creatureName(pet.id, mover.level)} uses ${move.name}!${crit ? " Critical hit!" : ""} ${damage} damage.`);
    } else {
      restartAnimation(el, "boost");
      fx.gather(at.buddy(n), fx.elementOf(move), { ms: 260 });
      if (move.type === "shield") {
        battle.shield += 1;
        setTimeout(() => {
          fx.ring(at.hero(), "shield", { maxR: 26, life: 700, width: 3, squash: 1 });
          fx.ring(at.hero(), "shield", { maxR: 16, life: 600, width: 2, squash: 1 });
          fx.burst(at.hero(), "shield", { count: 18, speed: 0.8, gravity: 0 });
        }, 260);
        popText(`${move.icon} ${move.name}!`);
        announce(`${creatureName(pet.id, mover.level)} uses ${move.name}! It will block the next hit.`);
      } else if (move.type === "heal") {
        const before = battle.playerHp;
        battle.playerHp = Math.min(battle.playerMax, before + Math.round(battle.playerMax * HEAL_FRACTION));
        const healed = battle.playerHp - before;
        setTimeout(() => {
          fx.rise(at.hero(), "heal", { count: 30 });
          fx.number(at.hero(), `+${healed}`, "good");
        }, 260);
        popText(`${move.icon} ${move.name}!`);
        announce(`${creatureName(pet.id, mover.level)} uses ${move.name}! You heal ${healed} HP.`);
      } else if (move.type === "stun") {
        battle.stunned = true;
        fx.projectile(at.buddy(n), at.foe(), fx.elementOf(move), { ms: 300, size: 2 }).then(() => {
          fx.burst(at.foe(), fx.elementOf(move), { count: 26, speed: 1.4 });
          fx.ring(at.foe(), fx.elementOf(move), { maxR: 26 });
          fx.orbit(fx.centerOf($("monster"), 0.15), { ms: 1600 });
          restartAnimation($("monster"), "dizzy");
        });
        popText(`${move.icon} ${move.name}!`);
        announce(`${creatureName(pet.id, mover.level)} uses ${move.name}! ${battle.foe.name} is stunned.`);
      }
      setTimeout(() => {
        updateHp();
        updateStatus();
      }, 300);
    }
  }

  // Back to the free spell for next turn, so nobody gets stuck.
  battle.move = HERO_MOVES[0];
  battle.mover = null;
}

// The look of an attack, from wind-up to impact. Elemental moves fire a
// projectile; physical ones dash in. Bigger moves and crits hit harder.
function attackFx({ from, attacker, move, crit }) {
  const element = fx.elementOf(move);
  const power = move.power || 1;
  const scale = Math.min(2.4, 0.7 + power * 0.35) * (crit ? 1.35 : 1);
  const big = power >= 3.5;
  restartAnimation(attacker, fx.isPhysical(move) ? "pounce" : "cast");
  fx.gather(from, element, { ms: 220, count: Math.round(10 * scale) });
  const impact = () => {
    const target = at.foe();
    if (crit || big) fx.hitStop(crit ? 140 : 90);
    if (crit) {
      fx.zoom(target, 1.08);
      fx.rays(target, "light");
    }
    if (big) fx.flash("#ffffff", 260, 0.55);
    restartAnimation($("monster"), "hit");
    fx.burst(target, element, { count: Math.round(22 * scale), speed: 1.3 * scale, life: 700 });
    fx.burst(target, "impact", { count: Math.round(8 * scale), speed: 0.8 * scale, life: 300 });
    fx.ring(target, element, { maxR: 16 * scale, life: 420, width: 2 + scale });
    fx.shake(3 * scale, 260 + scale * 80);
  };
  setTimeout(() => {
    if (fx.isPhysical(move)) setTimeout(impact, ATTACK_FX_MS - 220 - 40);
    else fx.projectile(from, at.foe(), element, { ms: ATTACK_FX_MS - 220, size: Math.round(2 + scale * 1.5), arc: -10 - 8 * scale }).then(impact);
  }, 220);
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
  attackFx({ from: at.hero(), attacker: $("hero-slot"), move, crit });
  hitMonster(damage, crit, ATTACK_FX_MS);
  flashCamera("good");
  if (big) popText(`${move.icon} ${move.name.toUpperCase()}!`, true);
  setTimeout(() => popText(crit ? "CRITICAL HIT!" : big ? `${move.icon} ${move.name.toUpperCase()}!` : "Hit!", crit || big), ATTACK_FX_MS);
  announce(`${crit ? "Critical hit! " : ""}${move.name}! ${damage} damage.`);
}

function hitMonster(damage, crit, delay) {
  const b = battle;
  b.hp = Math.max(0, b.hp - damage);
  setTimeout(() => {
    // Still show it if this hit just won the battle (the battle may already be wrapping up).
    if (battle && battle !== b) return;
    fx.number(at.foe(), `-${damage}${crit ? "!" : ""}`, crit ? "crit" : "bad");
    updateHp(b);
  }, delay);
}

// 🔥 Combo: shows once you've signed 2 or more targets fast in a row.
function renderCombo() {
  const el = $("combo");
  const n = battle.combo;
  el.hidden = n < 2;
  if (n < 2) return;
  el.textContent = `🔥 ×${n} combo${n >= COMBO_MAX ? " MAX!" : ""}`;
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
}

const buddyEl = (n) => $(`buddy-slot-${n}`);

// The move picker: a tab for you and each buddy, each with 3 moves. The move
// you pick stays picked even if you look at another tab.
function renderMoves() {
  const p = progress.get();
  const tabs = [{ who: "You", art: heroImg(p.look, p.equipped.hat, "tab-hero"), mover: null }].concat(
    battle.team.map((pet) => ({ who: creatureName(pet.id, pet.level), art: creatureImg(pet.id, "tab-art", false, isEvolved(pet.level)), mover: pet })),
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
    const eff = !move.type || move.type === "attack" ? effectiveness(move.element, battle.foe.element) : 1;
    const tag = eff > 1 ? `<span class="move-eff up">▲ Super</span>` : eff < 1 ? `<span class="move-eff down">▼ Weak</span>` : "";
    const el = ELEMENTS[move.element];
    button.innerHTML = `
      <span class="move-icon">${move.icon}</span>
      <span class="move-text"><span class="move-name">${move.name}${tag}</span><span class="move-desc">${el ? `${el.icon} ` : ""}${moveDescription(move)}</span></span>
      <span class="move-cost">${move.cost ? `${move.cost}⚡` : "Free"}</span>
      <span class="move-key" aria-hidden="true">${n + 1}</span>`;
    button.setAttribute("aria-label", `${tab.who}: ${move.name}. ${el ? `${el.name}. ` : ""}${moveDescription(move)}.${eff > 1 ? " Super effective!" : eff < 1 ? " Not very effective." : ""} Costs ${move.cost} energy.`);
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
  // Big signature moves are telegraphed: it spends a turn charging up, and
  // the hit lands next turn, unless you stun it, it gets dizzy, or you shield.
  const unleashing = b.charging;
  b.charging = null;
  $("battle-warning").hidden = true;
  const healing = !unleashing && healMove && !b.foeHealed && b.hp < b.maxHp * 0.4 && Math.random() < 0.5;
  const startCharge = !unleashing && !healing && b.turn >= 2 && Math.random() < ENEMY_BIG_CHANCE;
  const move = unleashing || quickMove;

  if (b.stunned) {
    b.stunned = false;
    restartAnimation($("monster"), "dizzy");
    fx.orbit(fx.centerOf($("monster"), 0.15), { ms: 1200 });
    popText(unleashing ? "Stunned! The charge fizzled! 💫" : "Stunned! 💫");
    announce(`${name} is stunned and can't attack!`);
  } else if (dazed) {
    restartAnimation($("monster"), "dizzy");
    fx.orbit(fx.centerOf($("monster"), 0.15), { ms: 1200 });
    popText(unleashing ? "Dizzy! The charge fizzled! 💫" : "Dizzy! 💫");
    announce(`You signed so fast, ${name} is too dizzy to attack!`);
  } else if (startCharge) {
    b.charging = bigMove;
    restartAnimation($("monster"), "charging");
    fx.gather(at.foe(), "danger", { ms: 900, count: 40, radius: 40 });
    fx.gather(at.foe(), fx.elementOf(bigMove), { ms: 700, count: 20, radius: 30 });
    popText(`⚠️ Charging ${bigMove.name}!`, true);
    $("battle-warning").textContent = `⚠️ ${name} is charging up ${bigMove.icon} ${bigMove.name}! Shield, heal, or stun it now!`;
    $("battle-warning").hidden = false;
    announce(`Watch out! ${name} is charging ${bigMove.name}. Next turn it hits hard, unless you shield, heal, or stun it.`);
  } else if (healing) {
    b.foeHealed = true;
    const amount = Math.round(b.maxHp * ENEMY_HEAL_FRACTION);
    b.hp = Math.min(b.maxHp, b.hp + amount);
    restartAnimation($("monster"), "boost");
    fx.rise(at.foe(), "heal", { count: 26, width: 30 });
    popText(`${healMove.icon} ${healMove.name}!`);
    fx.number(at.foe(), `+${amount}`, "good");
    updateHp();
    announce(`${name} uses ${healMove.name} and heals ${amount}!`);
  } else if (b.shield > 0) {
    b.shield--;
    updateStatus();
    restartAnimation($("monster"), "lunge");
    setTimeout(() => {
      fx.ring(at.hero(), "shield", { maxR: 24, life: 500, width: 3, squash: 1 });
      fx.burst(at.hero(), "shield", { count: 20, speed: 1.4, angle: Math.PI, spread: 1.6 });
      fx.shake(3, 200);
    }, 260);
    popText(`${move.icon} ${move.name}... Blocked! 🛡️`);
    announce(`${name} uses ${move.name}, but your shield blocks it!`);
  } else {
    const big = move === bigMove;
    const base = monsterDamage(b.level) + (b.stage.type === "boss" ? BOSS_EXTRA_DAMAGE : 0);
    const damage = Math.max(1, Math.round((base + Math.floor(Math.random() * 5) - 2) * (big ? ENEMY_BIG_DAMAGE : ENEMY_QUICK_DAMAGE) * (b.surge ? 1.3 : 1)));
    b.playerHp = Math.max(0, b.playerHp - damage);
    const element = fx.elementOf(move);
    popText(`${move.icon} ${move.name}!`, big);
    // The monster's attack: a lunge, or a projectile at you, then the hit.
    const landed = () => {
      if (battle !== b) return;
      restartAnimation($("hero-sprite"), "hurt");
      fx.burst(at.hero(), element, { count: big ? 40 : 20, speed: big ? 2 : 1.2 });
      fx.burst(at.hero(), "danger", { count: 8, speed: 0.8, life: 300 });
      fx.ring(at.hero(), element, { maxR: big ? 30 : 16 });
      fx.shake(big ? 10 : 4, big ? 500 : 280);
      if (big) {
        fx.hitStop(120);
        fx.flash("#e8413b", 300, 0.45);
      }
      fx.number(at.hero(), `-${damage}`, big ? "crit" : "bad");
      updateHp();
    };
    if (fx.isPhysical(move)) {
      restartAnimation($("monster"), "lunge");
      setTimeout(landed, 260);
    } else {
      restartAnimation($("monster"), "charging");
      fx.projectile(at.foe(), at.hero(), element, { ms: 300, size: big ? 5 : 3, arc: -14 }).then(landed);
    }
    announce(`${name} uses ${move.name}! You lose ${damage} HP.`);
    if (b.playerHp <= 0) return setTimeout(() => battle === b && finish(false), 900);
  }

  setTimeout(() => nextTurn(b), MONSTER_TURN_MS);
}

// Back to you, with the next target. If the planned ones ran out, the hex
// isn't broken yet: keep going.
function nextTurn(b) {
  if (battle !== b || b.done) return;
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
}

// A trainer's creature is beaten: it goes back, and the next one comes out.
// Then it's your turn again.
function nextFoe(b) {
  const out = b.foe;
  setTimeout(() => {
    if (battle !== b || b.done) return;
    restartAnimation($("monster"), "faint");
    popText(`${out.name} is out!`);
    announce(`${b.opts.owner}'s ${out.name} is out of the fight!`);
    setTimeout(() => {
      if (battle !== b || b.done) return;
      b.foeIndex++;
      sendOut(b);
      restartAnimation($("monster"), "send-in");
      fx.burst(at.foe(), "light", { count: 30, speed: 1.6 });
      fx.ring(at.foe(), "light", { maxR: 30 });
      popText(`${b.opts.owner} sends out ${b.foe.name}!`, true);
      announce(`${b.opts.owner} sends out ${b.foe.name}!${b.foeIndex === b.foes.length - 1 ? " It's their last one!" : ""}`);
      setTimeout(() => nextTurn(b), 1100);
    }, 1000);
  }, ATTACK_FX_MS + 700);
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
    fx.rise(at.hero(), "heal", { count: 30 });
    fx.number(at.hero(), `+${battle.playerHp - before}`, "good");
    updateHp();
    announce(`You drink a ${item.name.toLowerCase()}. +${battle.playerHp - before} HP.`);
  } else if (item.id === "shield") {
    battle.shield += SHIELD_BLOCKS;
    fx.ring(at.hero(), "shield", { maxR: 28, life: 700, width: 3, squash: 1 });
    announce(`Shield up! It blocks the next ${SHIELD_BLOCKS} hits.`);
  } else if (item.id === "power") {
    battle.power = true;
    fx.gather(at.hero(), "fire", { ms: 500, count: 30 });
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
  el.classList.remove("hit", "lunge", "dizzy", "hurt", "boost", "pounce", "shake", "charging", "cast", "faint", "send-in");
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
    if (battle.opts.owner) {
      // A trainer's or rival's creature isn't hexed: it just gives up.
      restartAnimation($("monster"), "faint");
      popText(battle.opts.team ? `${battle.opts.owner} is out of creatures!` : "VICTORY!", true);
      fx.rays(at.foe(), "light");
    } else if (battle.foe.catchable === false) {
      // Malgrath isn't hexed - he's sealed away.
      $("monster").classList.add("sealed");
      popText("SEALED AWAY!", true);
    } else {
      // The hex shatters: a flash, then the creature's real colors come back.
      popText("HEX BROKEN!", true);
      $("monster").classList.add("healing");
      fx.hitStop(160);
      fx.flash("#ffffff", 400, 0.8);
      fx.burst(at.foe(), "hex", { count: 90, speed: 2.6, life: 1000, gravity: 0.05 });
      fx.ring(at.foe(), "hex", { maxR: 60, life: 700, width: 4 });
      fx.shake(9, 450);
      const foeId = battle.foe.id;
      setTimeout(() => {
        $("monster").innerHTML = creatureImg(foeId);
        $("hud-foe-portrait").innerHTML = creatureImg(foeId);
        $("hud-foe-sub").textContent = "Freed!";
        $("monster").classList.remove("healing");
        $("monster").classList.add("healed");
        fx.rise(at.foe(), "light", { count: 40, width: 40 });
        fx.burst(at.foe(), "heal", { count: 30, speed: 1.2, gravity: -0.01 });
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
      coins: stars * 5 + (boss ? 15 : 0) + (battle.opts.prize || 0),
      prize: battle.opts.prize || 0,
      practice: [...battle.practice],
      boss,
      loot: rollLoot(boss),
      caught: battle.foe.catchable !== false && !battle.opts.owner && progress.catchCreature(battle.foe.id) ? battle.foe : null,
    };
  } else {
    $("hero-sprite").classList.add("knocked");
    // Every sign still counts as practice.
    result = { won: false, stars: 0, xp: letters * 5, coins: 0, practice: [...battle.practice], boss, loot: null, caught: null };
  }
  result.foe = battle.foe;
  result.level = battle.level;
  result.opts = battle.opts;
  result.zone = battle.zone;
  // Level-ups, and buddies that just reached their evolution level.
  const before = Object.fromEntries(progress.team().map((pet) => [pet.id, pet.level]));
  const leveled = progress.addTeamXp(won ? BUDDY_XP_WIN : BUDDY_XP_LOSS);
  const levelOf = (id) => progress.get().creatures[id].level;
  result.buddyLevels = leveled.map((id) => ({ ...creature(id), name: creatureName(id, levelOf(id)), level: levelOf(id) }));
  result.evolved = leveled.filter((id) => !isEvolved(before[id]) && isEvolved(levelOf(id))).map((id) => ({ id, from: creature(id).name, to: creatureName(id, levelOf(id)) }));

  progress.recordStage(battle.z, battle.s, result);
  const { onFinish } = battle;
  setTimeout(() => onFinish(result), won ? 2200 : 1400);
}

$("hint-btn").onclick = () => battle && !battle.done && !battle.busy && showHint(false);
$("skip-btn").onclick = () => battle && !battle.done && !battle.busy && letterDone(performance.now(), true);
