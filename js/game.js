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
// Sign challenges: some turns are a riddle, a missing letter, a quick-draw,
// a "what comes next?" chain, a Word Blast (spell a word), or a Flurry (sign
// as many letters as you can in 10 seconds) instead of a plain letter.
// Trainers (and Rook) fight in the same formation as you: the trainer in
// the middle, a creature above and below, all on the field at once, each with
// its own HP. Click one to target it; group moves (💥 All) hit every one of
// them for a bit less each. On their turn, one of them attacks, in turn.
// A trainer's third creature comes in when one is beaten.
//
// ⚡ Counter-Sign: when a creature attacks, it sometimes signs a letter at you
// first (always before a big move). Sign it back in time, or tap the right
// letter, to block the hit; signing it bounces some damage back too.
//
// Wild creatures often come in packs of two or three, and a boss calls in
// two helpers when it surges at half health: click one to target it, or use
// a group move (💥 All) to hit them all. Pack members take turns attacking,
// and some turns a second one joins in.
//
// Taking too long brings a hint, then a skip button. Can't sign it? Skipping
// costs you your turn: your move doesn't fire, and it's their turn. If your
// HP runs out you're knocked out: you keep some XP and can try again.

import { getPrediction, HoldTimer } from "./classifier.js";
import {
  battleLength, BOSS_EXTRA_DAMAGE, buddyMoveBoost, CONSUMABLES, CREATURES,
  ENEMY_BIG_CHANCE, ENEMY_BIG_DAMAGE, ENEMY_HEAL_FRACTION, ENEMY_QUICK_DAMAGE,
  CHALLENGE_BONUS, CHALLENGE_CHANCE, FLURRY_MS, SPELL_BONUS, COMBO_BONUS, COMBO_MAX, creatureName, CRIT_CHANCE, effectiveness, ELEMENTS, stageOf, stagePower, buddyMoves, heroSpells, armorById,
  GROUP_POWER, isEvolved, QUICK_BONUS, QUICK_MS, TRAINER_HP, CRIT_CHANCE_FAST, CRIT_MULTIPLIER, dizzyChance, ENERGY_FAST_BONUS, ENERGY_MAX, ENERGY_PER_LETTER,
  ENERGY_START, FAST_SIGN_MS, HEAL_FRACTION, HERO_MOVES, HEX_HP_MULTIPLIER, HINT_AFTER_MS, ALPHABET,
  COUNTER_CHANCE, COUNTER_MS, COUNTER_REFLECT, MINION_HP, PACK_CHANCE, PACK_EXTRA_ATTACK, PACK_HP, monsterDamage, MOTION_LETTERS, playerMaxHp, rarityOf, POTION_HEAL, SHIELD_BLOCKS, SIGN_DAMAGE, SKIP_AFTER_MS, STAGES, TIPS, ZONES,
} from "./config.js";
import { battleResult } from "./battle-result.js";
import * as progress from "./progress.js";
import { announce, flashCamera, isShowing, renderAvatars, setGuide, setHandImage, show } from "./screens.js";
import { battleBackdropSrc } from "./biome.js";
import * as fx from "./fx.js";
import { playMusic } from "./music.js";
import { QUESTS, ROOK } from "./quests.js";
import { playLines } from "./story.js";
import { creatureImg, heroImg, itemImg } from "./sprites.js";
import { setText } from "./pixel-emoji.js";

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
  const pool = type === "review" ? (zone.dimension > 0 ? ALPHABET : [...new Set([...zone.letters, ...known])]) : zone.letters;
  return progress.weightedPick(pool, previous);
}

// ---------- Starting a battle ----------

// `foeId` is the creature you're fighting (see CREATURES in config.js), at `level`.
// `opts.owner`: a rival's or trainer's name. They fight beside their
// creatures (`opts.team`, [{ id, level }, ...], or just this one), looking
// like `opts.look`.
// opts: owner/team/look (a trainer or rival), area (which part of the zone:
// later areas bring bigger packs), pack: false (always one-on-one), trial
// (a Trial battle: see biome.js).
export function startBattle(z, s, foeId, level, onFinish, opts = {}) {
  const zone = ZONES[z];
  const stage = STAGES[s];
  const party = Boolean(opts.owner);
  const foes = opts.team || [{ id: foeId, level }];
  const targets = planTargets(z, stage.type, foes[0].level);
  const team = progress.team();
  const armor = progress.heroArmor(); // armor adds HP, power, and crits (ARMOR in config.js)
  const playerMax = Math.round(playerMaxHp(progress.level()) * (progress.heroClass().hp || 1) * (armor.hp || 1));
  battle = {
    z, s, zone, stage, team, targets, onFinish, opts,
    party, // a trainer or rival battle: several foes on the field
    foes, // the creatures (for a trainer, their whole team)
    field: [], // who's fighting on the other side (see makeFoe)
    reserve: [], // a trainer's creatures still waiting to come out
    roster: [], // everyone on the other side, for the team balls
    target: null, // the foe your attacks aim at
    actorTurn: 0, // whose turn it is next on their side
    mode: "plain", // this turn's sign challenge (see pickChallenge)
    blank: null, // for "blank": { word, index }
    quickUntil: 0,
    revealed: false, // a riddle's answer was shown by a hint
    bonus: 1,
    lastMode: "plain",
    combo: 0, // targets signed fast in a row, without hints: each adds damage
    t: 0, // which target
    i: 0, // which letter in the target
    turn: 1,
    playerHp: playerMax,
    playerMax,
    energy: Math.min(ENERGY_MAX, ENERGY_START + (progress.heroClass().energy || 0)),
    move: HERO_MOVES[0], // the move picked for this turn
    mover: null, // which buddy's move it is (null = your hero's spell)
    tab: 0, // which tab of the move picker is open (0 = you)
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
  $("battle-title").textContent = `${zone.icon} ${zone.name} · ${party ? opts.owner : stage.name}`;
  $("arena-bg").src = battleBackdropSrc(zone.id);
  $("arena").classList.remove("surge");
  $("arena").classList.toggle("party", party);
  setUpField(battle);
  // Dramatic music: Malgrath has his own theme, bosses a harder one.
  playMusic(battle.roster[0].id === "malgrath" ? "final" : stage.type === "boss" || opts.trial ? "boss" : "battle");
  renderCombo();
  $("battle-warning").hidden = true;
  const p = progress.get();
  $("hud-you-name").textContent = p.name || "Hero";
  $("hud-you-level").textContent = `Lv ${progress.level()}`;
  $("hud-you-portrait").innerHTML = heroImg(progress.heroLook(), p.equipped.hat);
  $("arena").dataset.zone = zone.id;
  // Your team: you in the middle, a buddy above and below.
  $("hero-sprite").className = "hero-sprite";
  $("hero-sprite").innerHTML = heroImg(progress.heroLook(), p.equipped.hat);
  [0, 1].forEach((n) => {
    const pet = team[n];
    $(`buddy-slot-${n}`).hidden = !pet;
    $(`buddy-slot-${n}`).innerHTML = pet ? creatureImg(pet.id, "buddy", false, stageOf(pet.level)) : "";
  });
  toggleBag(false);
  updateHp();
  updateStatus();
  setTurn("you");
  startLetter(performance.now());
  requestAnimationFrame(tick);
}

// ---------- The other side ----------

// Where foes stand: slot 1 is the middle (the big spot for a lone creature),
// 0 above and 2 below, like your team.
const SLOTS = [0, 1, 2].map((n) => ({ box: `foe-slot-${n}`, art: n === 1 ? "monster" : `foe-art-${n}` }));

// A trainer fights with spells, like you.
const TRAINER_MOVES = [
  { name: "Spark Bolt", icon: "✨", type: "attack", cost: 0, power: 1 },
  { name: "Potion", icon: "🧪", type: "heal", cost: 0 },
  { name: "Signlight Blast", icon: "🌟", type: "attack", cost: 0, power: 4 },
];

// One fighter on the other side, with its own HP and state.
function makeFoe(b, { id, level, trainer = null, share = 1 }) {
  const def = trainer
    ? { id: "trainer", name: trainer.name, look: trainer.look, catchable: false, element: null, moves: TRAINER_MOVES }
    : creature(id);
  // HP: room for your signing (with bigger moves), plus your buddies' free
  // hits. With several foes, each has less.
  const plan = planTargets(b.z, b.stage.type, level);
  const letters = plan.reduce((sum, t) => sum + t.length, 0);
  const rarityHp = trainer || b.party ? 1 : rarityOf(def).hp; // rarer creatures are tougher
  const maxHp = Math.round(letters * SIGN_DAMAGE * HEX_HP_MULTIPLIER * (b.party ? TRAINER_HP : 1) * rarityHp * share * (b.opts.trial?.hp || 1));
  return {
    def, id: def.id, level, maxHp, hp: maxHp, trainer: Boolean(trainer),
    charging: null, // a big move it's winding up (it lands on its next turn)
    healed: false, // heals at most once a battle
    stunned: false, // skips its next turn
    dizzyLast: false, // can't be dizzy two turns in a row
    phase2Done: false, // bosses surge with power at half health
    surge: false,
    out: false, // beaten
    slot: null,
    art: null, // the element that animates
    box: null, // its spot on the field
  };
}

function setUpField(b) {
  for (const slot of SLOTS) $(slot.box).hidden = true;
  if (!b.party) {
    // The creature you bumped into in the middle; any pack mates above and below.
    const mates = packMates(b);
    const share = mates.length ? PACK_HP : 1;
    b.roster = [makeFoe(b, { ...b.foes[0], share }), ...mates.map((m) => makeFoe(b, { ...m, share }))];
    place(b, b.roster[0], 1);
    b.roster.slice(1).forEach((e, n) => place(b, e, n === 0 ? 0 : 2));
    if (mates.length) announce(`A pack of ${b.roster.length}! Click one to target it, or hit them all with a group move.`);
    // Trial III: the boss's helpers are there from the start.
    if (b.opts.trial?.startHelpers) summonHelpers(b, b.roster[0]);
  } else {
    // The trainer in the middle, their first two creatures above and below.
    const look = b.opts.look || (b.opts.owner === "Rook" ? ROOK.look : null);
    const boss = makeFoe(b, { id: "trainer", level: b.foes[0].level, trainer: { name: b.opts.owner, look } });
    const creatures = b.foes.map((f) => makeFoe(b, f));
    b.roster = [boss, ...creatures];
    place(b, boss, 1);
    creatures.slice(0, 2).forEach((e, n) => place(b, e, n === 0 ? 0 : 2));
    b.reserve = creatures.slice(2);
  }
  setTarget(b.field.find((e) => !e.trainer) || b.field[0], false);
}

// Wild creatures sometimes bring friends from their zone: none for bosses,
// trials, or story fights; more often (and more of them) further up the zone.
function packMates(b) {
  const lead = b.foes[0];
  const def = creature(lead.id);
  if (b.opts.pack === false || b.opts.trial || b.stage.type === "boss" || def.kind !== "wild" || def.catchable === false) return [];
  const [two, three] = PACK_CHANCE[Math.min(PACK_CHANCE.length - 1, b.opts.area || 0)];
  const roll = Math.random();
  const count = roll < three ? 2 : roll < three + two ? 1 : 0;
  const pool = CREATURES.filter((c) => c.zone === def.zone && c.kind === "wild");
  return Array.from({ length: count }, () => ({ id: pool[Math.floor(Math.random() * pool.length)].id, level: Math.max(1, lead.level - 1) }));
}

// More than one foe on the field: targets to pick, and the formation layout.
const isMulti = (b = battle) => b.party || b.field.length > 1;

// Puts `entry` in slot `n` on the field.
function place(b, entry, n) {
  entry.slot = n;
  entry.art = $(SLOTS[n].art);
  entry.box = $(SLOTS[n].box);
  b.field = b.field.filter((e) => e.slot !== n || e === entry);
  if (!b.field.includes(entry)) b.field.push(entry);
  b.field.sort((x, y) => x.slot - y.slot);
  entry.box.hidden = false;
  $("arena").classList.toggle("party", isMulti(b)); // the three-spot formation
  // Hexbound creatures look corrupted until you break the hex. (Malgrath is
  // just like that.) A trainer's or rival's creatures aren't hexed.
  const hexed = !entry.trainer && entry.def.catchable !== false && !b.party;
  entry.hexed = hexed; // tick() makes dark motes drift off it
  entry.art.innerHTML = entry.trainer ? heroImg(entry.def.look, null, "foe-hero", true) : creatureImg(entry.id, "", hexed);
  entry.art.className = `monster${(b.stage.type === "boss" || b.opts.trial) && entry === b.roster[0] ? " boss" : ""}`;
  entry.box.querySelector(".foe-tag-name").textContent = `${entry.def.name} · Lv ${entry.level}`;
  entry.box.onclick = () => setTarget(entry);
  entry.box.onkeydown = (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setTarget(entry));
  entry.box.setAttribute("aria-label", `Target ${entry.def.name}`);
  if (!entry.trainer && entry.def.catchable !== false) progress.markSeen(entry.id);
}

const alive = (b = battle) => b.field.filter((e) => !e.out);

// Aim at `entry`: it gets the 🎯, and the panel at the top right shows it.
function setTarget(entry, say = true) {
  const b = battle;
  if (!b || !entry || entry.out) return;
  b.target = entry;
  for (const e of b.field) e.box.classList.toggle("targeted", e === entry && isMulti(b));
  const def = entry.def;
  const hexed = !entry.trainer && def.catchable !== false && !b.party;
  $("monster-name").textContent = b.party && !entry.trainer ? `${b.opts.owner}'s ${def.name}` : def.name;
  const el = ELEMENTS[def.element];
  const kind = entry.trainer ? "Signkeeper" : b.opts.team ? "Trainer" : b.party ? "Rival battle" : def.catchable === false ? "Hollow King" : "Hexbound";
  const rarity = entry.trainer || b.party || rarityOf(def).name === "Common" ? null : rarityOf(def); // common is the norm: no badge
  $("hud-foe-sub").innerHTML =
    `${rarity ? `<span class="rarity-badge" style="--rarity:${rarity.color}">${rarity.name}</span>` : ""}` +
    `${el ? `<span class="el-badge el-${def.element}">${el.icon} ${el.name}</span>` : ""}${kind} · Lv ${entry.level}` +
    (el ? `<span class="weak-to">Weak to ${weakTo(def.element).map((e) => `<span title="${ELEMENTS[e].name}">${ELEMENTS[e].icon}</span>`).join("")}</span>` : "");
  $("hud-foe-portrait").innerHTML = entry.trainer ? heroImg(def.look, null) : creatureImg(entry.id, "", hexed);
  renderTeamBalls(b);
  updateHp(b);
  if (say) {
    announce(`Targeting ${def.name}.`);
    if (!b.busy) renderMoves();
  }
}

// Up and down arrows (or clicking) pick who to target.
function cycleTarget(step) {
  const list = alive();
  if (!battle || !isMulti() || list.length < 2) return;
  const i = list.indexOf(battle.target);
  setTarget(list[(i + step + list.length) % list.length]);
}

// A trainer's team: one ball per creature, dark once beaten.
function renderTeamBalls(b) {
  const creatures = b.roster.filter((e) => !e.trainer);
  $("foe-team").hidden = !b.party || creatures.length < 2;
  $("foe-team").innerHTML = creatures.map((e) => `<span class="ball${e.out ? " out" : ""}${e.slot !== null && !e.out ? " now" : ""}"></span>`).join("");
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
    if (mode === "chain" && target === "A") return "plain";
    if (mode === "spell") {
      // Word Blast: a word with this letter in it, from here or earlier.
      const words = ZONES.slice(0, b.z + 1).flatMap((zn) => zn.words).filter((w) => w.includes(target) && w.length <= 5);
      if (!words.length) return "plain";
      b.targets[b.t] = words[Math.floor(Math.random() * words.length)];
    }
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
    battle.flurryUntil = battle.mode === "flurry" ? now + FLURRY_MS : 0;
    battle.flurryCount = 0;
  }
  battle.hinted = false;
  battle.hold.reset();
  $("hint").hidden = true;
  $("hint").classList.remove("glow");
  showGuide();
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
    chain: `What comes next? The letter after ${prevLetter(letter)}.`,
    spell: battle.i === 0 && `Word Blast! Spell ${target.split("").join(" ")} for a big hit!`,
    flurry: battle.flurryCount === 0 && `Flurry! Sign as many letters as you can in ${FLURRY_MS / 1000} seconds! First: ${letter}`,
  }[battle.mode];
  announce(said || (target.length > 1 && battle.i === 0 ? `Your turn! Spell the word ${target.split("").join(" ")}` : `Sign ${letter}`));
}

function renderTarget() {
  const target = currentTarget();
  const { mode, blank } = battle;
  $("battle-count").textContent = `Turn ${battle.turn}`;
  $("target").dataset.answer = currentLetter() || ""; // for automated tests
  $("sign-label").textContent = {
    riddle: "🧩 Riddle! Which letter?", blank: "✏️ Fill in the missing letter", quick: "⚡ Quick-draw! Sign it fast",
    chain: "🔗 What comes next?", spell: "💥 Word Blast! Spell it", flurry: "🌪️ Flurry! Sign as many as you can",
  }[mode] || "Sign this";
  $("challenge").hidden = !["riddle", "quick", "chain", "flurry"].includes(mode);
  if (mode === "riddle") $("challenge").textContent = `“${TIPS[target]}”`;
  if (mode === "chain") $("challenge").textContent = `${prevLetter(target)} → ?`;
  if (mode === "quick") renderQuick(performance.now());
  if (mode === "flurry") renderFlurry(performance.now());
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
      const hidden = (mode === "riddle" || mode === "chain") && !battle.revealed && i >= battle.i && state !== "done";
      return `<span class="slot ${state}${target.length === 1 ? " single" : ""}">${hidden ? "?" : letter}</span>`;
    })
    .join("");
}

const prevLetter = (letter) => ALPHABET[ALPHABET.indexOf(letter) - 1];

// The Flurry countdown, and how many you've signed.
function renderFlurry(now) {
  const left = Math.max(0, battle.flurryUntil - now);
  $("challenge").textContent = `⏱️ ${(left / 1000).toFixed(1)}s · ${battle.flurryCount} signed`;
}

// The Flurry's time is up: everything you signed hits at once.
function endFlurry(now) {
  const count = battle.flurryCount;
  $("battle-hold").style.width = "0%";
  $("hint").hidden = true;
  $("skip-btn").hidden = true;
  popText(count ? `🌪️ ${count} sign${count > 1 ? "s" : ""}!` : "🌪️ Time's up!", count >= 4);
  if (!count) battle.targetSlow = true;
  finishTarget(now, count, count >= 4);
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
  hexMotes(now);
  if (battle.busy || now < battle.pauseUntil) return;

  const letter = currentLetter();
  const prediction = getPrediction();
  setText($("seeing"), prediction?.partial
    ? "✋ Move your whole hand into view"
    : !prediction
      ? "Show your hand ✋"
      : MOTION_LETTERS.includes(letter)
        ? `Draw ${letter} in the air ✍️` // J and Z are movements, not a held shape
        : `I see: ${prediction.letter}`);
  const held = battle.hold.update(letter, prediction, now);
  $("battle-hold").style.width = `${held * 100}%`;
  if (battle.mode === "quick") renderQuick(now);
  if (battle.mode === "flurry") {
    renderFlurry(now);
    if (now > battle.flurryUntil) return endFlurry(now);
  }

  if (held >= 1) return letterDone(now, false);

  const waited = now - battle.letterStart;
  if (!battle.hinted && waited > HINT_AFTER_MS) showHint(true);
  if (waited > SKIP_AFTER_MS) $("skip-btn").hidden = false;
}

// Dark motes drift up off every hexed creature on the field, all battle long.
const MOTE_EVERY_MS = 900;
function hexMotes(now) {
  if (now < (battle.nextMote || 0)) return;
  battle.nextMote = now + MOTE_EVERY_MS;
  for (const e of alive()) if (e.hexed) fx.rise(fx.centerOf(e.art, 0.75), "hex", { count: 1, width: 26 });
}

// The hand picture beside the letter: full while you're learning it, faded
// once you know it a bit, then gone (progress.guideFor). Hidden on guessing
// turns (riddle, missing letter, chain) - it would give the answer away.
function showGuide(level = null) {
  const guessing = ["riddle", "blank", "chain"].includes(battle.mode) && !battle.revealed;
  const letter = currentLetter();
  setGuide($("sign-guide"), letter, level || (guessing ? "none" : progress.guideFor(letter)));
}

// Stuck on a letter for a while: the full picture comes up (and on a guessing
// turn, the answer). It counts as a miss, so that letter comes up more.
function showHint(auto) {
  if (battle.hinted) return;
  const letter = currentLetter();
  battle.hinted = true;
  battle.targetSlow = true;
  battle.hints++;
  battle.practice.add(letter);
  progress.addMiss(letter);
  // A hint gives away a riddle's answer.
  if (battle.mode === "riddle" || battle.mode === "blank" || battle.mode === "chain") {
    battle.revealed = true;
    if (battle.mode === "blank") $("target").children[battle.blank.index].textContent = letter;
    else renderTarget();
  }
  showGuide("full");
  $("sign-guide").classList.toggle("glow", auto);
  announce(`Here's how to sign ${letter}: ${TIPS[letter]}`);
}

function letterDone(now, skipped) {
  const letter = currentLetter();
  if (battle.mode === "flurry") {
    // Each sign counts, and a new letter comes up right away.
    if (skipped) return endFlurry(now);
    if (!battle.hinted) progress.addSuccess(letter);
    gainEnergy(ENERGY_PER_LETTER);
    battle.times.push(now - battle.letterStart);
    battle.flurryCount++;
    flashCamera("good");
    fx.number(at.foe(), `${battle.flurryCount}`, "good");
    battle.targets[battle.t] = nextTarget(battle.z, "letters", letter);
    battle.letterStart = now;
    battle.pauseUntil = now + PAUSE_AFTER_HIT_MS / 2;
    battle.hold.reset();
    battle.hinted = false;
    $("battle-hold").style.width = "0%";
    $("hint").hidden = true;
    renderTarget();
    showGuide();
    return;
  }
  if (skipped) return loseTurn(now);
  if (!battle.hinted) progress.addSuccess(letter);
  gainEnergy(ENERGY_PER_LETTER); // signing charges your energy
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

  finishTarget(now, target.length);
}

// Couldn't sign it: you lose your turn. Your move doesn't fire, your combo
// ends, and it's their turn.
function loseTurn(now) {
  const b = battle;
  b.busy = true;
  b.targetSlow = true;
  b.combo = 0;
  renderCombo();
  $("battle-hold").style.width = "0%";
  $("hint").hidden = true;
  $("skip-btn").hidden = true;
  popText("⏭️ Turn skipped!");
  announce("You skipped the sign, so you lose your turn.");
  renderTarget();
  renderMoves();
  renderItems();
  setTimeout(() => battle === b && !b.done && theirRound(b, false), 900);
}

// Their side's turn: one of them attacks (a boss surges first at half health),
// and sometimes a second one joins in.
function theirRound(b, fast) {
  if (battle !== b || b.done) return;
  const leader = b.roster[0];
  const boss = (b.stage.type === "boss" || b.opts.trial) && !b.party && !leader.out ? leader : null;
  const helpersOut = alive(b).length > 1;
  b.extraAttacks = (boss && helpersOut) || (alive(b).length >= 3 && Math.random() < PACK_EXTRA_ATTACK) || (b.opts.trial && helpersOut) ? 1 : 0;
  if (boss && !boss.phase2Done && boss.hp <= boss.maxHp / 2) phase2(b, boss, () => monsterTurn(fast));
  else monsterTurn(fast);
}

// Finished a letter, a whole word, or a Flurry: your move fires, with
// `letters` signs' worth of power. That ends your turn. `flurryFast`: a
// Flurry with lots of signs counts as fast.
function finishTarget(now, letters, flurryFast = false) {
  const perLetter = (now - battle.targetStart) / Math.max(1, letters);
  const fast = battle.mode === "flurry" ? flurryFast : !battle.targetSlow && perLetter < FAST_SIGN_MS;
  if (fast) gainEnergy(ENERGY_FAST_BONUS);
  battle.combo = fast ? battle.combo + 1 : 0;
  renderCombo();
  // Challenges done without a hint (or skip) hit harder.
  battle.bonus = 1;
  if (!battle.targetSlow) {
    if (battle.mode === "quick" && now <= battle.quickUntil) battle.bonus = QUICK_BONUS;
    if (battle.mode === "riddle" || battle.mode === "blank" || battle.mode === "chain") battle.bonus = CHALLENGE_BONUS;
    if (battle.mode === "spell") battle.bonus = SPELL_BONUS;
  }
  battle.busy = true;
  fireMove(letters, fast);
  renderTarget();
  renderMoves();
  renderItems();
  const b = battle;
  const downed = alive(b).filter((e) => e.hp <= 0);
  if (downed.length && alive(b).every((e) => e.hp <= 0) && !b.reserve.length) return finish(true);

  // Only the one character you picked acts. Then it's their turn.
  // (At half health, a boss first surges with dark power: phase 2.)
  const theirTurn = () => theirRound(b, fast);
  setTimeout(() => {
    if (battle !== b || b.done) return;
    if (downed.length) knockOut(b, downed, theirTurn);
    else theirTurn();
  }, ATTACK_FX_MS + 700);
}

// Beaten foes leave the field; a trainer's next creature takes the spot.
function knockOut(b, downed, next) {
  for (const e of downed) {
    e.out = true;
    restartAnimation(e.art, "faint");
    e.box.classList.remove("targeted");
  }
  popText(downed.length > 1 ? `${downed.length} knocked out!` : `${downed[0].def.name} is out!`);
  announce(`${downed.map((e) => e.def.name).join(" and ")} ${downed.length > 1 ? "are" : "is"} out of the fight!`);
  renderTeamBalls(b);
  setTimeout(() => {
    if (battle !== b || b.done) return;
    for (const e of downed) {
      const fresh = b.reserve.shift();
      if (!fresh) continue;
      place(b, fresh, e.slot);
      restartAnimation(fresh.art, "send-in");
      fx.burst(at.foe(fresh), "light", { count: 30, speed: 1.6 });
      fx.ring(at.foe(fresh), "light", { maxR: 30 });
      popText(`${b.opts.owner} sends out ${fresh.def.name}!`, true);
      announce(`${b.opts.owner} sends out ${fresh.def.name}!`);
    }
    if (b.target.out) setTarget(alive(b).find((e) => !e.trainer) || alive(b)[0], false);
    renderTeamBalls(b);
    updateHp(b);
    setTimeout(next, 900);
  }, 1000);
}

// Two of the zone's wild creatures join `boss`, in any empty spots above and
// below it. True if any came.
function summonHelpers(b, boss) {
  const pool = CREATURES.filter((c) => c.zone === b.zone.id && c.kind === "wild");
  let came = false;
  [0, 2].forEach((slot, n) => {
    if (!pool.length || b.field.some((e) => e.slot === slot && !e.out)) return;
    const helper = makeFoe(b, { id: pool[(n + b.turn) % pool.length].id, level: Math.max(1, boss.level - 2), share: MINION_HP });
    b.roster.push(helper);
    place(b, helper, slot);
    restartAnimation(helper.art, "send-in");
    if (boss.art) fx.burst(at.foe(helper), "hex", { count: 30, speed: 1.6 });
    came = true;
  });
  return came;
}

// Phase 2: Malgrath's voice cuts in, and the boss heals a little and hits harder.
function phase2(b, boss, next) {
  boss.phase2Done = true;
  boss.surge = true;
  boss.hp = Math.min(boss.maxHp, boss.hp + Math.round(boss.maxHp * 0.1));
  updateHp(b);
  $("arena").classList.add("surge");
  fx.flash("#5a1f8a", 500, 0.6);
  fx.burst(at.foe(boss), "hex", { count: 70, speed: 2.4, life: 900 });
  fx.ring(at.foe(boss), "hex", { maxR: 50, life: 600, width: 3 });
  fx.shake(8, 500);
  $("hud-foe-sub").textContent = `⚡ Powered up! · Lv ${boss.level}`;
  popText("⚡ PHASE 2!", true);
  announce(`${boss.def.name} surges with dark power!`);
  // Two helpers join the fight, above and below.
  if (!b.party) {
    setTimeout(() => {
      if (battle !== b || b.done || !summonHelpers(b, boss)) return;
      popText(`${boss.def.name} calls for help!`, true);
      announce(`${boss.def.name} calls two helpers! Pick a target, or use a group move.`);
      updateHp(b);
    }, 500);
  }
  const lines = QUESTS[b.zone.id]?.phase2 || [];
  setTimeout(() => (lines.length ? playLines(lines, next) : next()), 1400);
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
  foe: (entry = battle.target) => fx.centerOf(entry.art, 0.5),
};

// How long an attack takes from wind-up to impact (the hit lands at the end).
const ATTACK_FX_MS = 560;

// Who a move hits: everyone left for a group move (💥 All), else your target.
const isAttack = (move) => !move.type || move.type === "attack";
const spreads = (move) => Boolean(move.all) && alive().length > 1;
const targetsFor = (move) => (move.all ? alive() : [battle.target]);

// Fires the move picked for this turn. `letters` is how many letters you just signed.
function fireMove(letters, fast) {
  const { move, mover } = battle;
  battle.energy -= move.cost;
  renderEnergy();
  // A streak of fast signs makes every attack hit harder, and so does a challenge.
  const boost = (1 + Math.min(battle.combo, COMBO_MAX) * COMBO_BONUS) * battle.bonus;
  if (battle.bonus > 1) popText({ quick: `⚡ QUICK-DRAW! ×${QUICK_BONUS}`, spell: "💥 WORD BLAST!", chain: "🔗 Next in line! Bonus damage!" }[battle.mode] || "🧩 Solved! Bonus damage!", true);
  // Group moves hit everyone, a bit softer each.
  const spread = spreads(move) ? GROUP_POWER : 1;

  if (!mover) {
    // One of your hero's spells: more letters signed and stronger spells hit harder.
    flashCamera("good");
    const classPower = (progress.heroClass().power || 1) * (progress.heroArmor().power || 1); // mages, and some armor, hit harder
    strike({ from: at.hero(), attacker: $("hero-slot"), move, base: letters * SIGN_DAMAGE * move.power * spread * boost * classPower, fast, hero: true });
  } else {
    // A buddy's move.
    const pet = creature(mover.id);
    const n = battle.team.indexOf(mover);
    const el = buddyEl(n);
    const who = creatureName(pet.id, mover.level);
    flashCamera("good");
    if (isAttack(move)) {
      // Like your signing, scaled by the move's power and the buddy's level.
      const evolved = stagePower(mover.level);
      strike({ from: at.buddy(n), attacker: el, move, base: letters * SIGN_DAMAGE * move.power * buddyMoveBoost(mover.level) * evolved * spread * boost, fast, who });
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
        announce(`${who} uses ${move.name}! It will block the next hit.`);
      } else if (move.type === "heal") {
        const before = battle.playerHp;
        battle.playerHp = Math.min(battle.playerMax, before + Math.round(battle.playerMax * HEAL_FRACTION));
        const healed = battle.playerHp - before;
        setTimeout(() => {
          fx.rise(at.hero(), "heal", { count: 30 });
          fx.number(at.hero(), `+${healed}`, "good");
        }, 260);
        popText(`${move.icon} ${move.name}!`);
        announce(`${who} uses ${move.name}! You heal ${healed} HP.`);
      } else if (move.type === "stun") {
        const hit = targetsFor(move);
        for (const t of hit) {
          t.stunned = true;
          fx.projectile(at.buddy(n), at.foe(t), fx.elementOf(move), { ms: 300, size: 2 }).then(() => {
            fx.burst(at.foe(t), fx.elementOf(move), { count: 26, speed: 1.4 });
            fx.ring(at.foe(t), fx.elementOf(move), { maxR: 26 });
            fx.orbit(fx.centerOf(t.art, 0.15), { ms: 1600 });
            restartAnimation(t.art, "dizzy");
          });
        }
        popText(`${move.icon} ${move.name}!`);
        announce(`${who} uses ${move.name}! ${hit.map((t) => t.def.name).join(" and ")} ${hit.length > 1 ? "are" : "is"} stunned.`);
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

// An attack on one foe, or on all of them for a group move. Each takes its
// own type matchup. `hero`: your hero's spell (power-ups apply).
function strike({ from, attacker, move, base, fast, hero = false, who = null, delay = 0 }) {
  const classCrit = hero ? (progress.heroClass().crit || 0) + (progress.heroArmor().crit || 0) : 0; // archers (and some armor) crit more
  const crit = Math.random() < (fast ? CRIT_CHANCE_FAST : CRIT_CHANCE) + classCrit;
  let mult = crit ? CRIT_MULTIPLIER : 1;
  let big = move.power > 1;
  if (hero && battle.power) {
    mult *= 2;
    big = true;
    battle.power = false;
    updateStatus();
  }
  const hits = targetsFor(move);
  let best = 1, worst = 1;
  const amounts = hits.map((t, k) => {
    const eff = effectiveness(move.element, t.def.element);
    best = Math.max(best, eff);
    worst = Math.min(worst, eff);
    const damage = Math.round(base * mult * eff);
    attackFx({ from, attacker: k === 0 ? attacker : null, move, crit, target: t, delay: delay + k * 110 });
    hitFoe(t, damage, crit, delay + ATTACK_FX_MS + k * 110);
    return `${t.def.name} ${damage}`;
  });
  const group = hits.length > 1;
  if (big || group) setTimeout(() => popText(`${move.icon} ${move.name.toUpperCase()}!${group ? " 💥" : ""}`, true), delay);
  setTimeout(() => popText(crit ? "CRITICAL HIT!" : big || group ? `${move.icon} ${move.name.toUpperCase()}!` : `${who ? `${who}: ` : ""}Hit!`, crit || big), delay + ATTACK_FX_MS);
  // Type matchups: say the best news (or the bad news if it's all bad).
  const eff = best > 1 ? best : worst;
  if (eff !== 1) {
    setTimeout(() => {
      popText(eff > 1 ? `It's super effective! ▲` : "Not very effective... ▼", eff > 1);
      announce(eff > 1 ? "It's super effective!" : "It's not very effective.");
    }, ATTACK_FX_MS + 450 + hits.length * 110);
  }
  announce(`${who ? `${who} uses ` : ""}${move.name}!${crit ? " Critical hit!" : ""} ${group ? `Hits everyone: ${amounts.join(", ")}.` : `${amounts[0].split(" ").pop()} damage.`}`);
}

// The look of an attack, from wind-up to impact. Elemental moves fire a
// projectile; physical ones dash in. Bigger moves and crits hit harder.
function attackFx({ from, attacker, move, crit, target = battle.target, delay = 0 }) {
  const element = fx.elementOf(move);
  const power = move.power || 1;
  const scale = Math.min(2.4, 0.7 + power * 0.35) * (crit ? 1.35 : 1);
  const big = power >= 3.5;
  if (attacker) {
    restartAnimation(attacker, fx.isPhysical(move) ? "pounce" : "cast");
    fx.gather(from, element, { ms: 220, count: Math.round(10 * scale) });
  }
  const impact = () => {
    const spot = at.foe(target);
    if (crit || big) fx.hitStop(crit ? 140 : 90);
    if (crit) {
      fx.zoom(spot, 1.08);
      fx.rays(spot, "light");
    }
    if (big && !delay) fx.flash("#ffffff", 260, 0.55);
    restartAnimation(target.art, "hit");
    if (fx.isPhysical(move)) fx.slash(spot, element, { count: big || crit ? 2 : 1, len: 10 + 5 * scale });
    fx.burst(spot, element, { count: Math.round(22 * scale), speed: 1.3 * scale, life: 700 });
    fx.burst(spot, "impact", { count: Math.round(8 * scale), speed: 0.8 * scale, life: 300 });
    fx.ring(spot, element, { maxR: 16 * scale, life: 420, width: 2 + scale });
    fx.shake(3 * scale, 260 + scale * 80);
  };
  setTimeout(() => {
    if (fx.isPhysical(move)) setTimeout(impact, ATTACK_FX_MS - 220 - 40);
    else fx.projectile(from, at.foe(target), element, { ms: ATTACK_FX_MS - 220, size: Math.round(2 + scale * 1.5), arc: -10 - 8 * scale }).then(impact);
  }, 220 + delay);
}

function hitFoe(entry, damage, crit, delay) {
  const b = battle;
  entry.hp = Math.max(0, entry.hp - damage);
  setTimeout(() => {
    // Still show it if this hit just won the battle (the battle may already be wrapping up).
    if (battle && battle !== b) return;
    fx.number(at.foe(entry), `-${damage}${crit ? "!" : ""}`, crit ? "crit" : "bad");
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
  const tabs = [{ who: "You", art: heroImg(progress.heroLook(), p.equipped.hat, "tab-hero"), mover: null }].concat(
    battle.team.map((pet) => ({ who: creatureName(pet.id, pet.level), art: creatureImg(pet.id, "tab-art", false, stageOf(pet.level)), mover: pet })),
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
      battle.page = 0;
      renderMoves();
    };
    $("move-tabs").appendChild(button);
  });

  const actor = battle.mover ? buddyEl(battle.team.indexOf(battle.mover)) : $("hero-slot");
  for (const el of document.querySelectorAll(".arena .fighter")) el.classList.toggle("acting", el === actor && !battle.busy);

  const tab = tabs[battle.tab];
  const moves = tab.mover ? buddyMoves(tab.mover.id, tab.mover.level) : heroSpells(progress.beatenZones(), progress.get().equipped.armor);
  const bar = $("battle-moves");
  bar.innerHTML = "";
  // The spellbook shows BOOK_PAGE cards at a time; arrows turn the page.
  const pages = Math.max(1, Math.ceil(moves.length / BOOK_PAGE));
  battle.page = Math.min(battle.page || 0, pages - 1);
  $("book-prev").hidden = $("book-next").hidden = pages < 2;
  $("book-prev").disabled = battle.page === 0;
  $("book-next").disabled = battle.page >= pages - 1;
  $("book-page").textContent = pages > 1 ? `${battle.page + 1} / ${pages}` : "";
  moves.slice(battle.page * BOOK_PAGE, (battle.page + 1) * BOOK_PAGE).forEach((move, n) => {
    const picked = battle.move === move && battle.mover === tab.mover;
    const button = document.createElement("button");
    button.className = `move-btn spell-card${picked ? " picked" : ""} type-${move.type || "attack"} el-${move.element || "none"}`;
    button.disabled = battle.busy || battle.done || move.cost > battle.energy;
    button.setAttribute("aria-pressed", String(picked));
    const eff = isAttack(move) ? effectiveness(move.element, battle.target.def.element) : 1;
    const tag = (eff > 1 ? `<span class="move-eff up">▲ Super</span>` : eff < 1 ? `<span class="move-eff down">▼ Weak</span>` : "") +
      (move.all && isMulti() ? `<span class="move-eff all">💥 All</span>` : "");
    const el = ELEMENTS[move.element];
    button.innerHTML = `
      <span class="move-cost">${move.cost ? `${move.cost}⚡` : "Free"}</span>
      <span class="move-icon">${move.icon}</span>
      <span class="move-name">${move.name}</span>
      <span class="move-desc">${el ? `${el.icon} ` : ""}${moveDescription(move)}</span>${tag ? `<span class="move-tags">${tag}</span>` : ""}
      <span class="move-key" aria-hidden="true">${n + 1}</span>`;
    button.setAttribute("aria-label", `${tab.who}: ${move.name}. ${el ? `${el.name}. ` : ""}${moveDescription(move)}.${eff > 1 ? " Super effective!" : eff < 1 ? " Not very effective." : ""} Costs ${move.cost} energy.`);
    button.onclick = () => pickMove(move, tab.mover);
    bar.appendChild(button);
  });
}

const BOOK_PAGE = 4;
$("book-prev").onclick = () => battle && ((battle.page = Math.max(0, (battle.page || 0) - 1)), renderMoves());
$("book-next").onclick = () => battle && ((battle.page = (battle.page || 0) + 1), renderMoves());

// The elements that hit `element` extra hard ("Weak to" on the foe's panel).
const weakTo = (element) => Object.keys(ELEMENTS).filter((e) => effectiveness(e, element) > 1);

function moveDescription(move) {
  if (isAttack(move)) {
    if (spreads(move)) return `${Math.round(move.power * GROUP_POWER * 10) / 10}x to everyone`;
    return move.power > 1 ? `${move.power}x damage` : "Normal hit";
  }
  if (move.type === "stun" && spreads(move)) return "Stuns everyone";
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

// Keys: 1-3 pick a move from the open tab; left/right arrows switch tabs;
// up/down arrows pick who to target. (Letters are for signing in test mode.)
addEventListener("keydown", (e) => {
  if (!battle || !isShowing("battle")) return;
  if (/^[1-4]$/.test(e.key)) $("battle-moves").children[Number(e.key) - 1]?.click();
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
    cycleTarget(e.key === "ArrowDown" ? 1 : -1);
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    const tabs = $("move-tabs").children.length;
    battle.tab = (battle.tab + (e.key === "ArrowRight" ? 1 : tabs - 1)) % tabs;
    battle.page = 0;
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
// With several foes, they take turns: one attacks each time.
function monsterTurn(fast) {
  const b = battle;
  b.busy = true;
  const list = alive(b);
  const a = list[b.actorTurn++ % list.length];
  const dazed = !a.stunned && fast && !a.dizzyLast && Math.random() < dizzyChance(a.level);
  a.dizzyLast = dazed;
  setTurn("monster", a);
  for (const e of b.field) e.box.classList.toggle("acting", e === a);
  const name = a.def.name;
  const spot = () => at.foe(a);
  // Which of its moves it uses: usually the quick one; sometimes (from turn 2)
  // its big signature move; and once a battle, a heal if it's hurt and has one.
  const [quickMove, , bigMove] = a.def.moves;
  const healMove = a.def.moves.find((mv) => mv.type === "heal");
  // Big signature moves are telegraphed: it spends a turn charging up, and
  // the hit lands on its next turn, unless you stun it, it gets dizzy, or you shield.
  const unleashing = a.charging;
  a.charging = null;
  $("battle-warning").hidden = !b.field.some((e) => e.charging && !e.out);
  const healing = !unleashing && healMove && !a.healed && a.hp < a.maxHp * 0.4 && Math.random() < 0.5;
  const startCharge = !unleashing && !healing && b.turn >= 2 && Math.random() < ENEMY_BIG_CHANCE;
  const move = unleashing || quickMove;

  if (a.stunned) {
    a.stunned = false;
    restartAnimation(a.art, "dizzy");
    fx.orbit(fx.centerOf(a.art, 0.15), { ms: 1200 });
    popText(unleashing ? "Stunned! The charge fizzled! 💫" : "Stunned! 💫");
    announce(`${name} is stunned and can't attack!`);
  } else if (dazed) {
    restartAnimation(a.art, "dizzy");
    fx.orbit(fx.centerOf(a.art, 0.15), { ms: 1200 });
    popText(unleashing ? "Dizzy! The charge fizzled! 💫" : "Dizzy! 💫");
    announce(`You signed so fast, ${name} is too dizzy to attack!`);
  } else if (startCharge) {
    a.charging = bigMove;
    restartAnimation(a.art, "charging");
    fx.gather(spot(), "danger", { ms: 900, count: 40, radius: 40 });
    fx.gather(spot(), fx.elementOf(bigMove), { ms: 700, count: 20, radius: 30 });
    popText(`⚠️ Charging ${bigMove.name}!`, true);
    $("battle-warning").textContent = `⚠️ ${name} is charging up ${bigMove.icon} ${bigMove.name}! Shield, heal, or stun it now!`;
    $("battle-warning").hidden = false;
    announce(`Watch out! ${name} is charging ${bigMove.name}. Next time it attacks, it hits hard, unless you shield, heal, or stun it.`);
  } else if (healing) {
    a.healed = true;
    const amount = Math.round(a.maxHp * ENEMY_HEAL_FRACTION);
    a.hp = Math.min(a.maxHp, a.hp + amount);
    restartAnimation(a.art, "boost");
    fx.rise(spot(), "heal", { count: 26, width: 30 });
    popText(`${healMove.icon} ${healMove.name}!`);
    fx.number(spot(), `+${amount}`, "good");
    updateHp();
    announce(`${name} uses ${healMove.name} and heals ${amount}!`);
  } else if (b.shield > 0) {
    b.shield--;
    updateStatus();
    restartAnimation(a.art, "lunge");
    setTimeout(() => {
      fx.ring(at.hero(), "shield", { maxR: 24, life: 500, width: 3, squash: 1 });
      fx.burst(at.hero(), "shield", { count: 20, speed: 1.4, angle: Math.PI, spread: 1.6 });
      fx.shake(3, 200);
    }, 260);
    popText(`${move.icon} ${move.name}... Blocked! 🛡️`);
    announce(`${name} uses ${move.name}, but your shield blocks it!`);
  } else {
    const big = move === bigMove;
    // ⚡ Counter-Sign: it signs at you first. Get it right and the hit is blocked.
    if (big || Math.random() < COUNTER_CHANCE) {
      return counterSign(b, a, move, (result) => {
        if (battle !== b || b.done) return;
        if (result === "miss" && hitYou(b, a, move, big)) return;
        endMonsterTurn(b);
      });
    }
    if (hitYou(b, a, move, big)) return;
  }
  endMonsterTurn(b);
}

function endMonsterTurn(b) {
  setTimeout(() => {
    for (const e of b.field) e.box.classList.remove("acting");
    if (battle !== b || b.done) return;
    // A second one joins in (a boss's helper, or a big pack).
    if (b.extraAttacks > 0 && alive(b).length > 1) {
      b.extraAttacks--;
      return monsterTurn(false);
    }
    nextTurn(b);
  }, MONSTER_TURN_MS);
}

// How hard creature `a` hits you with `move`.
function enemyDamage(b, a, big) {
  const base = monsterDamage(a.level) + (b.stage.type === "boss" ? BOSS_EXTRA_DAMAGE : 0);
  return Math.max(1, Math.round((base + Math.floor(Math.random() * 5) - 2) * (big ? ENEMY_BIG_DAMAGE : ENEMY_QUICK_DAMAGE) * (a.surge ? 1.3 : 1)));
}

// The creature's attack lands on you. True if it knocked you out.
function hitYou(b, a, move, big) {
  const name = a.def.name;
  const spot = () => at.foe(a);
  const damage = enemyDamage(b, a, big);
  b.playerHp = Math.max(0, b.playerHp - damage);
  const element = fx.elementOf(move);
  popText(`${move.icon} ${move.name}!`, big);
  // The attack: a lunge, or a projectile at you, then the hit.
  const landed = () => {
    if (battle !== b) return;
    restartAnimation($("hero-sprite"), "hurt");
    if (fx.isPhysical(move)) fx.slash(at.hero(), "danger", { count: big ? 2 : 1, len: big ? 18 : 12 });
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
    restartAnimation(a.art, "lunge");
    setTimeout(landed, 260);
  } else {
    restartAnimation(a.art, "charging");
    fx.projectile(spot(), at.hero(), element, { ms: 300, size: big ? 5 : 3, arc: -14 }).then(landed);
  }
  announce(`${name} uses ${move.name}! You lose ${damage} HP.`);
  if (b.playerHp <= 0) {
    setTimeout(() => battle === b && finish(false), 900);
    return true;
  }
  return false;
}

// ⚡ The creature signs a letter at you (its hand picture). Sign it back
// before the bar runs out, or tap the right letter, to block the attack.
// done("block" | "miss").
function counterSign(b, a, move, done) {
  const known = progress.get().learned;
  const pool = [...new Set([...b.zone.letters, ...known])].filter((l) => known.includes(l) || b.zone.letters.includes(l));
  const letter = progress.weightedPick(pool);
  const others = [...pool.filter((l) => l !== letter)].sort(() => Math.random() - 0.5).slice(0, 2);
  const choices = [letter, ...others].sort(() => Math.random() - 0.5);
  const assist = Boolean(progress.get().settings.assist);
  const panel = $("counter");
  $("counter-title").textContent = `⚡ ${a.def.name} signs at you! Sign it back to block ${move.icon} ${move.name}!`;
  setHandImage($("counter-img"), letter);
  $("counter-img").alt = "The creature's sign";
  $("counter-time").hidden = assist; // Assist mode: no time limit
  restartAnimation(a.art, "charging");
  const box = $("counter-choices");
  box.innerHTML = "";
  let over = false;
  const end = (result, signed = false) => {
    if (over) return;
    over = true;
    panel.hidden = true;
    if (result === "block") {
      progress.addSuccess(letter);
      restartAnimation($("hero-sprite"), "boost");
      fx.ring(at.hero(), "shield", { maxR: 30, life: 600, width: 3, squash: 1 });
      fx.burst(at.hero(), "shield", { count: 24, speed: 1.6 });
      if (signed) {
        // Bounced back: some of the blocked damage hits the creature (but never knocks it out).
        const back = Math.min(a.hp - 1, Math.round(SIGN_DAMAGE * COUNTER_REFLECT));
        if (back > 0) {
          a.hp -= back;
          fx.projectile(at.hero(), at.foe(a), "light", { ms: 280, size: 3 }).then(() => {
            restartAnimation(a.art, "hit");
            fx.burst(at.foe(a), "light", { count: 24, speed: 1.6 });
            fx.number(at.foe(a), `-${back}`, "crit");
            updateHp();
          });
        }
        popText("⚡ COUNTER-SIGN! Bounced back!", true);
        announce(`Counter-sign! You blocked it and bounced ${back} damage back.`);
      } else {
        popText("🛡️ Blocked!", true);
        announce("You read the sign! Blocked.");
      }
    } else {
      progress.addMiss(letter);
      b.practice.add(letter);
      announce(`That sign was ${letter}.`);
    }
    done(result);
  };
  choices.forEach((l) => {
    const btn = document.createElement("button");
    btn.className = "counter-choice";
    btn.textContent = l;
    btn.onclick = () => {
      if (l === letter) end("block");
      else {
        btn.classList.add("wrong");
        popText(`That sign was ${letter}!`);
        end("miss");
      }
    };
    box.appendChild(btn);
  });
  panel.hidden = false;
  announce(`${a.def.name} signs at you! Sign it back, or tap the letter, to block.`);
  const hold = new HoldTimer();
  const start = performance.now();
  const limit = COUNTER_MS;
  const loop = (now) => {
    if (over || battle !== b) return;
    requestAnimationFrame(loop);
    const held = hold.update(letter, getPrediction(), now);
    $("counter-hold").style.width = `${held * 100}%`;
    if (held >= 1) return end("block", true);
    if (!assist) {
      const left = Math.max(0, 1 - (now - start) / limit);
      $("counter-time-fill").style.width = `${left * 100}%`;
      if (left <= 0) {
        popText(`Too slow! That was ${letter}.`);
        end("miss");
      }
    }
  };
  requestAnimationFrame(loop);
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

function setTurn(who, foe = null) {
  const banner = $("turn");
  banner.textContent = who === "you" ? "Your turn!" : `${foe.def.name}'s turn!`;
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
    battle.playerHp = item.id === "potion" ? Math.min(battle.playerMax, before + Math.round(POTION_HEAL * (progress.heroClass().potion || 1))) : battle.playerMax;
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
  // The panel at the top right shows your target; each foe has a small bar too.
  const t = b.target;
  $("monster-hp").style.width = `${(t.hp / t.maxHp) * 100}%`;
  $("monster-hp-text").textContent = `${t.hp} / ${t.maxHp}`;
  for (const e of b.field) e.box.querySelector(".mini-fill").style.width = `${(e.hp / e.maxHp) * 100}%`;
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

function finish(won) {
  if (battle.done) return;
  battle.done = true;
  battle.busy = true;
  renderItems();
  renderMoves();
  const letters = battle.times.length;
  const boss = battle.stage.type === "boss";

  const main = battle.party ? battle.field[0] : battle.roster[0]; // a trainer's first, or the creature you bumped into
  const firstCreature = battle.roster.find((e) => !e.trainer) || main;
  if (won) {
    if (battle.party) {
      // A trainer's or rival's side isn't hexed: they just give up.
      for (const e of battle.field) restartAnimation(e.art, "faint");
      popText(`${battle.opts.owner} is out of moves! VICTORY!`, true);
      fx.rays(at.foe(main), "light");
    } else if (main.def.catchable === false) {
      // Malgrath isn't hexed - he's sealed away.
      $("monster").classList.add("sealed");
      popText("SEALED AWAY!", true);
    } else {
      // The hex shatters: a flash, then the creature's real colors come back.
      // (Its pack mates and helpers scamper off.)
      for (const e of battle.roster.slice(1)) restartAnimation(e.art, "faint");
      popText("HEX BROKEN!", true);
      $("monster").classList.add("healing");
      fx.hitStop(160);
      fx.flash("#ffffff", 400, 0.8);
      fx.burst(at.foe(main), "hex", { count: 90, speed: 2.6, life: 1000, gravity: 0.05 });
      fx.ring(at.foe(main), "hex", { maxR: 60, life: 700, width: 4 });
      fx.shake(9, 450);
      const foeId = main.id;
      setTimeout(() => {
        $("monster").innerHTML = creatureImg(foeId);
        $("hud-foe-portrait").innerHTML = creatureImg(foeId);
        $("hud-foe-sub").textContent = "Freed!";
        $("monster").classList.remove("healing");
        $("monster").classList.add("healed");
        fx.rise(at.foe(main), "light", { count: 40, width: 40 });
        fx.burst(at.foe(main), "heal", { count: 30, speed: 1.2, gravity: -0.01 });
        popText("Healed! 💚");
        announce("The hex is broken! It's healed.");
      }, 450);
    }
  } else {
    $("hero-sprite").classList.add("knocked");
  }
  playMusic(won ? "victory" : "defeat");
  const result = battleResult({
    z: battle.z, s: battle.s, zone: battle.zone, won, boss, opts: battle.opts, party: battle.party,
    signs: letters, hints: battle.hints, avgSeconds: battle.times.reduce((a, b) => a + b, 0) / Math.max(1, letters) / 1000,
    foe: firstCreature.def, level: firstCreature.level, practice: [...battle.practice],
    freeId: won && !battle.party && main.def.catchable !== false && !battle.opts.trial ? main.id : null,
  });
  const { onFinish } = battle;
  setTimeout(() => onFinish(result), won ? 2200 : 1400);
}

$("skip-btn").onclick = () => battle && !battle.done && !battle.busy && letterDone(performance.now(), true);
