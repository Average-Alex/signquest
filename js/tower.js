// 🗼 Towers to climb, one floor at a time, like a dungeon tower. Each floor is
// a battle; your highest floor is saved; lose, and you can try that floor again.
//
// Trial Towers: every zone's Trial portal opens one. Trial Wardens on most
// floors (the zone's own, joined higher up by Wardens from the zones next
// door), the zone's Trial Guardian on floors 5 and 10 (Trials I and II), and on
// the top floor, the tower's Ultimate (Trial III): the toughest fight in the
// zone. Warden floors pay 🔷 Crests, for armor (more the higher you climb); the
// boss floors teach a new spell (TOWER_SPELLS in config.js).
//
// ⏳ The Spire of Ages, in Skyhaven (hub.js): SPIRE_FLOORS floors drawing on
// every zone you can visit: Wardens from all over, a Guardian or an Ultimate
// every tenth floor (each pays a 🥚 egg), and at the very top, Aeon, the
// Keeper of the Spire.

import { BIOME_AREAS, creatureLevel, CREATURES, STAGES, TOWER_SPELLS, ZONES } from "./config.js";
import * as progress from "./progress.js";
import { announce, playStage, show } from "./screens.js";
import { creatureImg, heroImg } from "./sprites.js";

const $ = (id) => document.getElementById(id);

export const TOWER_FLOORS = 15;
const GUARDIAN_EVERY = 5;
// The boss floors: the Guardian (Trials I and II), then the Ultimate (Trial
// III). `levels`: above the zone's top creatures; `hp`: times a boss's HP.
// Each teaches a spell instead of paying Crests.
const TRIALS = [
  { tier: 1, name: "I", levels: 1, hp: 1.4 },
  { tier: 2, name: "II", levels: 4, hp: 1.9 },
  { tier: 3, name: "III", levels: 10, hp: 3.2, startHelpers: true, ultimate: true },
];
// Who holds the other floors: 0 the zone's own Warden, 1 and 2 the Wardens of
// the zones before and after it (floors 1-4, 6-9, 11-14).
const WARDEN_FLOORS = { 1: 0, 2: 0, 3: 0, 4: 0, 6: 0, 7: 1, 8: 0, 9: 1, 11: 1, 12: 2, 13: 0, 14: 2 };
// Crests for a Warden floor: more the higher it is (floors 1-4, 6-9, 11-14).
const wardenCrests = (f) => (f < 5 ? 2 : f < 10 ? 3 : 4);
const REPEAT_CRESTS = 5; // the top floor, again, once you've climbed the whole tower

// ⏳ The Spire of Ages: SPIRE_FLOORS floors, with a boss every SPIRE_BOSS_EVERY.
export const SPIRE_FLOORS = 50;
const SPIRE_BOSS_EVERY = 10;
// Its boss floors: who (a Guardian, an Ultimate, or the Keeper), how tough,
// and the egg it pays (tier 4 is a Rift egg).
const SPIRE_BOSSES = {
  10: { kind: "trial", hp: 1.5, egg: 1 },
  20: { kind: "ultimate", hp: 2.6, egg: 2, startHelpers: true },
  30: { kind: "trial", hp: 2.2, egg: 3 },
  40: { kind: "ultimate", hp: 3.2, egg: 3, startHelpers: true },
  50: { kind: "spirekeeper", hp: 4, egg: 4, startHelpers: true },
};
const spireCrests = (f) => 3 + Math.floor(f / 10);
const SPIRE_BOSS_CRESTS = 10;
const SPIRE_REPEAT_CRESTS = 12;

// Each tower's name, and its colors (sky, stone, trim).
const TOWERS = {
  meadow: { name: "Sky Garden Spire", sky: ["#8fd0f0", "#e8f6ff"], stone: "#8ab868", dark: "#5a8a44", trim: "#ff9ad5" },
  forest: { name: "Glowcap Tower", sky: ["#0e1a1a", "#1f3a34"], stone: "#3a5a4a", dark: "#24402f", trim: "#3fd0c8" },
  caves: { name: "Magma Spire", sky: ["#3a1408", "#c0441a"], stone: "#4a3a3e", dark: "#2e2226", trim: "#ffb020" },
  river: { name: "Coral Lighthouse", sky: ["#1f4a8a", "#7fc8e8"], stone: "#e0c890", dark: "#b89a60", trim: "#ff7a6a" },
  castle: { name: "Haunted Belfry", sky: ["#140e1e", "#3a2a4e"], stone: "#4a3a5a", dark: "#2e2440", trim: "#7fffa0" },
  keep: { name: "Crown Tower", sky: ["#2a2030", "#6a4bd6"], stone: "#8a7a92", dark: "#5a4e66", trim: "#ffd23f" },
  spires: { name: "Frost Spire", sky: ["#0e2a4a", "#9ad8ff"], stone: "#c8e0f4", dark: "#8ab0d0", trim: "#ffffff" },
  clouds: { name: "Storm Tower", sky: ["#2e3242", "#8a8aa0"], stone: "#6a7084", dark: "#4a5064", trim: "#ffe066" },
  void: { name: "Star Tower", sky: ["#05030e", "#2e2448"], stone: "#3a2e5a", dark: "#241a40", trim: "#c58cf0" },
  spire: { name: "Spire of Ages", sky: ["#140c34", "#5a8ad8"], stone: "#d8d0e8", dark: "#8a80a8", trim: "#ffd23f" },
};

let tower = null; // { spec, onExit, selected }

const guardianOf = (zone) => CREATURES.find((c) => c.zone === zone.id && c.kind === "trial");
const ultimateOf = (zone) => CREATURES.find((c) => c.zone === zone.id && c.kind === "ultimate");
const WARDENS = CREATURES.filter((c) => c.kind === "warden");
const zoneIndex = (id) => ZONES.findIndex((zone) => zone.id === id);
// The zone's own Warden, then its neighbours'.
function wardensFor(zone) {
  const i = Math.max(0, WARDENS.findIndex((w) => w.zone === zone.id));
  return [0, -1, 1].map((d) => WARDENS[(i + d + WARDENS.length) % WARDENS.length]);
}

// ---------- What's on each floor ----------
// A tower's "spec": its name and colors, its floors, what's on each one
// (floorInfo: who you fight, in which zone, at what level, for what), and how
// far you've climbed.

function zoneSpec(z) {
  const zone = ZONES[z];
  return {
    id: `zone:${z}`, theme: TOWERS[zone.id] || TOWERS.keep, floors: TOWER_FLOORS, roof: "🔷",
    done: () => progress.towerFloor(z),
    clear: (f) => progress.clearFloor(z, f),
    repeatCrests: REPEAT_CRESTS,
    floorInfo(f) {
      const top = creatureLevel(z, BIOME_AREAS - 1);
      if (f % GUARDIAN_EVERY === 0) {
        const trial = TRIALS[f / GUARDIAN_EVERY - 1];
        return { floor: f, z, boss: true, ultimate: Boolean(trial.ultimate), foe: trial.ultimate ? ultimateOf(zone) : guardianOf(zone), level: top + trial.levels, crests: 0, trial, spell: TOWER_SPELLS.find((sp) => sp.tower === zone.id && sp.floor === f) };
      }
      return { floor: f, z, boss: false, foe: wardensFor(zone)[WARDEN_FLOORS[f] || 0], level: Math.max(1, top + Math.round(f * 0.6) - 3), crests: wardenCrests(f) };
    },
  };
}

function spireSpec() {
  // Only zones you can get to (their letters are the ones you'll sign).
  const open = ZONES.map((zone, z) => z).filter((z) => progress.zoneUnlocked(z));
  const wardens = WARDENS.filter((w) => open.includes(zoneIndex(w.zone)));
  const bossZones = open.filter((z) => guardianOf(ZONES[z]) && ultimateOf(ZONES[z]));
  return {
    id: "spire", theme: TOWERS.spire, floors: SPIRE_FLOORS, roof: "⏳",
    done: progress.spireFloor,
    clear: progress.clearSpireFloor,
    repeatCrests: SPIRE_REPEAT_CRESTS,
    floorInfo(f) {
      const level = 4 + Math.round(f * 1.15);
      const boss = SPIRE_BOSSES[f];
      if (boss) {
        // A Guardian or an Ultimate from one of your zones (a different one each time), or the Keeper.
        const z = bossZones[(f / SPIRE_BOSS_EVERY - 1) % bossZones.length] ?? open[open.length - 1];
        const foe = boss.kind === "spirekeeper" ? CREATURES.find((c) => c.kind === "spirekeeper") : boss.kind === "ultimate" ? ultimateOf(ZONES[z]) : guardianOf(ZONES[z]);
        const trial = { tier: 3, name: "", hp: boss.hp, startHelpers: Boolean(boss.startHelpers) };
        return { floor: f, z, boss: true, ultimate: boss.kind !== "trial", keeper: boss.kind === "spirekeeper", foe, level: level + 4, crests: SPIRE_BOSS_CRESTS, trial, egg: boss.egg };
      }
      // Wardens from all over, a different one floor to floor.
      const foe = wardens[(f * 5) % wardens.length];
      return { floor: f, z: zoneIndex(foe.zone), boss: false, foe, level, crests: spireCrests(f) };
    },
  };
}

const specFor = (id) => (id === "spire" ? spireSpec() : zoneSpec(Number(id.split(":")[1])));

// The floor to fight next (the top again once you've climbed it all).
const nextFloor = (spec) => Math.min(spec.done() + 1, spec.floors);
const climbed = (spec) => spec.done() >= spec.floors;

// ---------- The tower screen ----------

export const openTower = (z, onExit) => openSpec(zoneSpec(z), onExit);
export const openSpire = (onExit) => openSpec(spireSpec(), onExit);

function openSpec(spec, onExit) {
  tower = { spec, onExit, selected: nextFloor(spec) };
  show("tower");
  render();
  $("tower-fight").focus();
  announce(`${spec.theme.name}. Floor ${nextFloor(spec)} of ${spec.floors} is next.`);
}

function render() {
  const { spec } = tower;
  const t = spec.theme;
  const done = spec.done();
  const next = nextFloor(spec);
  const screen = $("screen-tower");
  screen.style.setProperty("--tower-sky1", t.sky[0]);
  screen.style.setProperty("--tower-sky2", t.sky[1]);
  screen.style.setProperty("--tower-stone", t.stone);
  screen.style.setProperty("--tower-dark", t.dark);
  screen.style.setProperty("--tower-trim", t.trim);
  screen.classList.toggle("spire", spec.id === "spire");
  $("tower-title").textContent = `${spec.id === "spire" ? "⏳" : "🗼"} ${t.name}`;
  $("tower-crests").textContent = progress.get().crests || 0;
  $("tower-progress").textContent = climbed(spec) ? `👑 Climbed! All ${spec.floors} floors` : `Floor ${done} of ${spec.floors}`;

  // Top floor first, so the tower stands the right way up.
  const floors = [];
  for (let f = spec.floors; f >= 1; f--) {
    const info = spec.floorInfo(f);
    const state = f <= done ? "cleared" : f === next ? "next" : "locked";
    const foe = info.foe ? creatureImg(info.foe.id, "tower-foe", false, info.boss ? 3 : 2) : "";
    const tag = state === "cleared" ? "✓" : info.keeper ? "⏳ The Keeper" : info.ultimate ? "💀 Ultimate" : info.boss ? (info.trial.name ? `👑 Trial ${info.trial.name}` : "👑 Guardian") : state === "locked" ? "🔒" : "";
    floors.push(`
      <button type="button" class="tower-floor ${state}${info.boss ? " guardian" : ""}${info.ultimate ? " ultimate" : ""}${f === tower.selected ? " selected" : ""}" data-floor="${f}"
        aria-label="Floor ${f}: ${state === "locked" ? "locked" : `${info.foe?.name}, level ${info.level}`}${state === "cleared" ? ", cleared" : ""}">
        <span class="tower-num">${f}</span>
        <span class="tower-window"></span>
        <span class="tower-who">${state === "locked" && !info.boss ? "" : foe}</span>
        ${f === next && !climbed(spec) ? `<span class="tower-hero">${heroImg(progress.heroLook(), progress.get().equipped.hat)}</span>` : ""}
        <span class="tower-tag">${tag}${info.egg && state !== "cleared" ? " 🥚" : ""}</span>
        <span class="tower-window"></span>
      </button>`);
  }
  $("tower").innerHTML = `<div class="tower-roof"><span>${spec.roof}</span></div>${floors.join("")}<div class="tower-door">🚪</div>`;
  for (const el of $("tower").querySelectorAll(".tower-floor")) el.onclick = () => select(Number(el.dataset.floor));
  renderPanel();
  // Keep the floor you're on in view.
  $("tower").querySelector(".tower-floor.selected")?.scrollIntoView({ block: "center" });
}

function select(f) {
  tower.selected = f;
  for (const el of $("tower").querySelectorAll(".tower-floor")) el.classList.toggle("selected", Number(el.dataset.floor) === f);
  renderPanel();
}

// What a floor pays, the first time (or again, for the top floor).
function rewardText(spec, info, repeat) {
  if (repeat) return `+${spec.repeatCrests} 🔷 Crests`;
  if (info.spell) return `✨ a new spell, ${info.spell.icon} ${info.spell.name}!`;
  const egg = info.egg ? ` and a 🥚 ${info.egg === 4 ? "Rift" : `Raid ${["", "I", "II", "III"][info.egg]}`} egg!` : "";
  return `+${info.crests} 🔷 Crest${info.crests === 1 ? "" : "s"}${egg}`;
}

function renderPanel() {
  const { spec, selected: f } = tower;
  const info = spec.floorInfo(f);
  const done = spec.done();
  const next = nextFloor(spec);
  const canFight = f === next;
  const repeat = climbed(spec) && f === spec.floors;
  $("tower-foe-art").innerHTML = info.foe && (f <= next || info.boss) ? creatureImg(info.foe.id, "", false, info.boss ? 3 : 2) : "<span class=\"tower-mystery\">❔</span>";
  $("tower-floor-name").textContent = `Floor ${f}${info.keeper ? " · ⏳ The Top" : info.ultimate ? " · 💀 Ultimate" : info.boss ? (info.trial.name ? ` · Trial ${info.trial.name}` : " · Guardian") : ""}`;
  $("tower-foe-name").textContent = f <= next || info.boss ? `${info.foe?.name} · Lv ${info.level}` : "???";
  $("tower-foe-kind").textContent = info.keeper ? "⏳ Keeper of the Spire, with helpers" : info.ultimate ? "👑 Tower Ultimate, with helpers" : info.boss ? "🔷 Trial Guardian" : "⚔️ Trial Warden";
  $("tower-reward").textContent = f <= done && !repeat ? `✓ Cleared${info.spell ? ` · taught you ${info.spell.icon} ${info.spell.name}` : ""}` : `Reward: ${rewardText(spec, info, repeat)}`;
  $("tower-fight").disabled = !canFight;
  $("tower-fight").textContent = canFight ? (repeat ? "🔁 Fight again" : "⚔️ Fight!") : f < next ? "✓ Cleared" : "🔒 Climb up to it";
}

function fight() {
  const { spec, selected: f } = tower;
  if (f !== nextFloor(spec)) return;
  const info = spec.floorInfo(f);
  if (!info.foe) return;
  const opts = { pack: false, tower: { spec: spec.id, floor: f } };
  if (info.boss) opts.trial = { tier: info.trial.tier, name: info.trial.name, hp: info.trial.hp, startHelpers: Boolean(info.trial.startHelpers) };
  playStage(info.z, info.boss ? STAGES.length - 1 : 1, info.foe.id, info.level, opts);
}

// screens.js calls this when a tower battle is over. Returns the line for the results screen.
export function towerBattleOver(won, { spec: id, floor }) {
  if (!won) return `🗼 Floor ${floor} was too tough this time. Level up your team and climb again!`;
  const spec = specFor(id);
  const info = spec.floorInfo(floor);
  const repeat = spec.done() >= floor;
  const crests = repeat ? spec.repeatCrests : info.crests;
  spec.clear(floor);
  if (info.boss && info.trial.name) progress.beatTrial(info.z, info.trial.tier);
  if (crests) progress.addCrests(crests);
  const egg = !repeat && info.egg ? ` 🥚 You got a ${info.egg === 4 ? "🌀 Rift" : `Raid ${["", "I", "II", "III"][info.egg]}`} egg!` : "";
  if (egg) progress.addEgg(info.z, info.egg);
  const spell = !repeat && info.spell ? ` ✨ You learned a new spell: ${info.spell.icon} ${info.spell.name}! (Find it in your spellbook.)` : "";
  if (info.keeper && !repeat) return `⏳ You beat ${info.foe.name} and reached the top of the Spire of Ages! +${crests} 🔷 Crests.${egg}`;
  if (info.ultimate && !repeat && !egg) return `👑 You beat ${info.foe.name} and conquered the tower!${spell}`;
  if (spell) return `🗼 Floor ${floor} cleared!${spell}`;
  return `🗼 Floor ${floor} cleared! +${crests} 🔷 Crest${crests === 1 ? "" : "s"}${egg}${floor < spec.floors && !repeat ? ` · On to floor ${floor + 1}!` : floor === spec.floors && !repeat ? " · 👑 You climbed the whole tower!" : ""}`;
}

// Back to the tower after a battle (the results screen's "Next" button).
export const backToTower = (id) => openSpec(specFor(id), tower?.spec.id === id ? tower.onExit : null);

$("tower-fight").onclick = fight;
$("tower-back").onclick = () => {
  const exit = tower?.onExit;
  tower = null;
  exit?.();
};
