// Battles: a monster, a target letter or word, and the player's signing.
// Each correct letter casts a spell; a whole word is one big attack. Taking
// too long only brings a hint, then a skip button - nothing ever stops play.

import { getPrediction, HoldTimer } from "./classifier.js";
import { HINT_AFTER_MS, LETTERS, SKIP_AFTER_MS, STAGES, TIPS, ZONES } from "./config.js";
import * as progress from "./progress.js";
import { announce, flashCamera, isShowing, renderAvatars, setHandImage, show } from "./screens.js";

const $ = (id) => document.getElementById(id);
const PAUSE_AFTER_HIT_MS = 700; // so one held sign can't count twice

let battle = null;

// Targets are strings: one letter ("A") or a word ("CAB").
function buildTargets(z, type) {
  const zone = ZONES[z];
  const learned = ZONES.slice(0, z + 1).flatMap((zn) => zn.letters);
  const pickLetters = (pool, n) => {
    const out = [];
    for (let i = 0; i < n; i++) out.push(progress.weightedPick(pool, out[out.length - 1]));
    return out;
  };
  const pickWords = (n) => [...zone.words].sort(() => Math.random() - 0.5).slice(0, n);

  if (type === "letters") return pickLetters(zone.letters, 6);
  if (type === "words") return pickWords(2);
  // Boss: review letters (weighted toward misses), then a word to finish.
  // The last zone's boss mixes the whole alphabet.
  const isFinal = z === ZONES.length - 1;
  return [...pickLetters(isFinal ? LETTERS : learned, isFinal ? 8 : 5), ...pickWords(1)];
}

export function startBattle(z, s, onFinish) {
  const zone = ZONES[z];
  const stage = STAGES[s];
  const targets = buildTargets(z, stage.type);
  const maxHp = targets.reduce((sum, t) => sum + t.length, 0);
  battle = {
    z, s, zone, stage, targets, onFinish,
    t: 0, // which target
    i: 0, // which letter in the target
    hp: maxHp,
    maxHp,
    hold: new HoldTimer(),
    letterStart: 0,
    pauseUntil: 0,
    hinted: false,
    hints: 0,
    practice: new Set(),
    times: [],
    done: false,
  };

  show("battle");
  renderAvatars();
  $("battle-title").textContent = `${zone.icon} ${zone.name} · ${stage.name}`;
  $("monster").textContent = zone.monster;
  $("monster").className = `monster${stage.type === "boss" ? " boss" : ""}`;
  updateHp();
  startLetter(performance.now());
  requestAnimationFrame(tick);
}

const currentLetter = () => battle.targets[battle.t][battle.i];

function startLetter(now) {
  battle.letterStart = now;
  battle.hinted = false;
  battle.hold.reset();
  $("hint").hidden = true;
  $("hint").classList.remove("glow");
  $("skip-btn").hidden = true;
  renderTarget();
  const target = battle.targets[battle.t];
  announce(target.length > 1 && battle.i === 0 ? `Spell the word ${target.split("").join(" ")}` : `Sign ${currentLetter()}`);
}

function renderTarget() {
  const target = battle.targets[battle.t];
  $("battle-count").textContent = `${battle.t + 1} / ${battle.targets.length}`;
  $("target").innerHTML = target
    .split("")
    .map((letter, i) => {
      const state = i < battle.i ? "done" : i === battle.i ? "now" : "";
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
  if (now < battle.pauseUntil) return;

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
  battle.hints++;
  battle.practice.add(letter);
  progress.addMiss(letter);
  $("hint-tip").textContent = TIPS[letter];
  setHandImage($("hint-img"), letter);
  $("hint").hidden = false;
  $("hint").classList.toggle("glow", auto);
  announce(`Hint for ${letter}: ${TIPS[letter]}`);
}

function letterDone(now, skipped) {
  const letter = currentLetter();
  if (!skipped && !battle.hinted) progress.addSuccess(letter);
  battle.times.push(now - battle.letterStart);
  battle.pauseUntil = now + PAUSE_AFTER_HIT_MS;
  $("battle-hold").style.width = "0%";

  const target = battle.targets[battle.t];
  battle.i++;
  if (battle.i < target.length) {
    // Next letter of a word: fill the slot, no damage yet.
    flashCamera("good");
    startLetter(now);
    return;
  }

  // Finished a letter or a whole word: attack!
  attack(target.length, target.length > 1);
  battle.t++;
  battle.i = 0;
  if (battle.t < battle.targets.length) startLetter(now + PAUSE_AFTER_HIT_MS);
  else finish();
}

function attack(damage, big) {
  battle.hp = Math.max(0, battle.hp - damage);
  updateHp();
  flashCamera("good");

  const spell = $("spell");
  spell.textContent = big ? "🌟💥🌟" : "✨";
  spell.className = `spell cast${big ? " big" : ""}`;
  const monster = $("monster");
  monster.classList.remove("hit");
  void monster.offsetWidth; // restart the shake animation
  monster.classList.add("hit");
  const pop = $("pop");
  pop.textContent = big ? "BIG ATTACK!" : "Hit!";
  pop.className = "pop show";
  announce(big ? "Big attack!" : "Hit!");
  setTimeout(() => (spell.className = "spell"), 600);
  setTimeout(() => (pop.className = "pop"), 800);
}

function updateHp() {
  $("monster-hp").style.width = `${(battle.hp / battle.maxHp) * 100}%`;
}

function finish() {
  battle.done = true;
  $("monster").classList.add("defeated");
  const letters = battle.times.length;
  const avgSeconds = battle.times.reduce((a, b) => a + b, 0) / letters / 1000;

  // Stars: 3 for a fast, hint-free battle. Hints and slow signing each cost one.
  let stars = 3;
  if (battle.hints > 0) stars--;
  if (battle.hints >= 3) stars--;
  if (avgSeconds > 6) stars--;
  stars = Math.max(1, stars);
  const boss = battle.stage.type === "boss";
  const result = {
    stars,
    xp: letters * 10,
    coins: stars * 5 + (boss ? 15 : 0),
    practice: [...battle.practice],
    boss,
  };
  progress.recordStage(battle.z, battle.s, result);
  const { onFinish } = battle;
  setTimeout(() => onFinish(result), 1200);
}

$("hint-btn").onclick = () => battle && !battle.done && showHint(false);
$("skip-btn").onclick = () => battle && !battle.done && letterDone(performance.now(), true);
