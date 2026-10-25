// ⚔️ Co-op raids, like Pokemon GO raids. Every zone has a giant raid creature
// (config.js kind "raid"). Walk up to it (biome.js visitRaid), or join a raid
// that's happening from the Arena, and everyone at that raid fights it
// together, on the zone's battlefield:
//   a short lobby gathers raiders (anyone can start it early),
//   then everyone signs letters at once. Every sign throws the raid-only
//   spell, 🌟 Unity Comet, from that raider's hero at the giant; every hit
//   comes off one shared HP pool, with RAID_TIME_S (serve.py) to bring it
//   down. It's far too strong for one player: bring friends!
//   Now and then it attacks YOU: sign the letter it shows to dodge, or lose
//   HP. Knocked out, you're back in after a few seconds.
// Winning pays coins and opens the next raid tier.
//
// The server (serve.py /api/raid/...) keeps the shared HP, who's there, and
// recent hits (so everyone sees everyone's comets fly); the camera and sign
// reading stay on this device.

import { getPrediction, HoldTimer } from "./classifier.js";
import { CREATURES, MOTION_LETTERS, TIPS, ZONES } from "./config.js";
import * as progress from "./progress.js";
import { announce, flashCamera, setGuide, show } from "./screens.js";
import { creatureImg, heroImg } from "./sprites.js";
import { playMusic } from "./music.js";
import { setHtml } from "./pixel-emoji.js";
import { battleBackdropSrc } from "./biome.js";

const $ = (id) => document.getElementById(id);
const POLL_MS = 400;
const HIT_BASE = 12; // damage for signing the letter...
const HIT_FAST = 10; // ...plus up to this much for signing it fast
const FAST_MS = 3000;
const ATTACK_EVERY = [8000, 13000]; // the raid creature attacks you every so often
const DODGE_MS = 5000; // to sign its letter and dodge
const ATTACK_HIT = 34; // three of these and you're down
const DOWN_MS = 8000; // knocked out this long
const COMET_MS = 480; // a Unity Comet's flight
// Where raiders stand on the battlefield (percent of its width and height), in joining order.
const SPOTS = [[18, 62], [30, 52], [8, 50], [32, 72], [20, 40], [6, 72], [40, 42], [42, 62]];

// Raid tiers I-III, and the Rift's (tier 4: Skyhaven's Rift bosses, the toughest).
export const RIFT_TIER = 4;
const TIER_NAMES = ["", "I", "II", "III", "Rift"];
const esc = (text) => String(text).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
let raid = null; // the raid you're in, on this side

function myId() {
  let id = progress.get().arenaId;
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    progress.update({ arenaId: id });
  }
  return id;
}

async function call(action, body = {}) {
  const res = await fetch(`/api/raid/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: myId(), ...body }) });
  if (!res.ok) throw new Error(`Raid server: ${res.status}`);
  return res.json();
}

// Join (or start) the raid on `raidId` at `tier`. Resolves false if the server
// can't be reached. `onExit` runs when you leave.
export async function openRaid({ raidId, tier, onExit }) {
  const def = CREATURES.find((c) => c.id === raidId);
  const z = ZONES.findIndex((zn) => zn.id === def?.zone);
  if (!def || z < 0) return false;
  let view;
  try {
    view = await call("join", { raid: raidId, tier, name: progress.get().name || "Hero", look: progress.heroLook() });
  } catch {
    return false;
  }
  if (view.error) return false;
  const letters = ZONES[z].letters.filter((l) => !MOTION_LETTERS.includes(l));
  raid = {
    def, z, tier, onExit, view, letters, hold: new HoldTimer(), myHp: 100, downUntil: 0, attack: null, nextAttack: 0, target: null, shownAt: 0,
    rewarded: false, lastSeq: Math.max(0, ...view.hits.map((h) => h.seq)), heroes: new Map(), seenLog: [],
  };
  const rift = def.kind === "rift";
  $("raid-title").textContent = rift ? "🌀 Rift Raid" : `⚔️ Raid ${TIER_NAMES[tier]}`;
  $("screen-raid").classList.toggle("rift", rift);
  $("raid-boss-name").textContent = def.name;
  $("raid-field").style.backgroundImage = `url(${battleBackdropSrc(def.zone)})`;
  $("raid-boss-art").innerHTML = creatureImg(def.id, "raid-art", false, 3);
  $("raid-team").innerHTML = "";
  $("raid-log").innerHTML = "";
  show("raid");
  playMusic("boss");
  nextLetter(performance.now());
  render();
  poll();
  requestAnimationFrame(tick);
  return true;
}

async function leave() {
  const r = raid;
  raid = null;
  if (!r) return;
  call("leave").catch(() => {});
  r.onExit?.();
}
$("raid-leave").onclick = leave;
$("raid-start").onclick = () => call("start").then((v) => raid && !v.error && ((raid.view = v), render()));

async function poll() {
  if (!raid) return;
  try {
    const v = await call("state");
    if (!raid) return;
    if (!v.error) raid.view = v;
    render();
  } catch {
    $("raid-phase").textContent = "Lost touch with the raid server...";
  }
  if (raid) setTimeout(poll, POLL_MS);
}

function nextLetter(now) {
  const pool = raid.letters.filter((l) => l !== raid.target);
  raid.target = pool[Math.floor(Math.random() * pool.length)];
  raid.shownAt = now;
  raid.hold.reset();
}

const myTag = () => raid.view.players.find((p) => p.me)?.tag;

// Every frame: sign to attack; dodge its attacks.
function tick(now) {
  if (!raid) return;
  requestAnimationFrame(tick);
  const v = raid.view;
  if (v.phase !== "battle") return renderSign(null, now);
  if (now < raid.downUntil) return renderSign(null, now);
  if (raid.myHp <= 0) raid.myHp = 100; // back up after being knocked out
  if (!raid.nextAttack) raid.nextAttack = now + ATTACK_EVERY[0];
  // Its attack: sign its letter to dodge.
  if (!raid.attack && now >= raid.nextAttack) {
    raid.attack = { letter: raid.letters[Math.floor(Math.random() * raid.letters.length)], until: now + DODGE_MS };
    raid.hold.reset();
    restart($("raid-boss-art"), "charging");
    announce(`${raid.def.name} attacks! Sign ${raid.attack.letter} to dodge!`);
  }
  if (raid.attack) {
    const held = raid.hold.update(raid.attack.letter, getPrediction(), now);
    if (held >= 1) {
      flashCamera("good");
      logLocal(`💨 You dodged ${raid.def.moves[2].name}!`);
      restart(heroEl(myTag()), "dodge");
      endAttack(now);
    } else if (now >= raid.attack.until) {
      flashCamera("bad");
      raid.myHp -= ATTACK_HIT;
      restart($("raid-boss-art"), "lunge");
      restart(heroEl(myTag()), "hurt");
      if (raid.myHp <= 0) {
        raid.downUntil = now + DOWN_MS;
        logLocal(`💫 ${raid.def.moves[2].name} knocked you out! Back in ${DOWN_MS / 1000} seconds...`);
      } else logLocal(`💥 ${raid.def.moves[2].name} hit you!`);
      endAttack(now);
    }
    return renderSign(held, now);
  }
  // Your attack: sign the letter to throw a Unity Comet; faster hits harder.
  const held = raid.hold.update(raid.target, getPrediction(), now);
  if (held >= 1) {
    const dmg = HIT_BASE + Math.round(HIT_FAST * Math.max(0, 1 - (now - raid.shownAt) / FAST_MS));
    flashCamera("good");
    comet(myTag(), dmg, true);
    call("hit", { dmg }).then((v) => raid && !v.error && ((raid.view = v), render())).catch(() => {});
    nextLetter(now);
  }
  renderSign(held, now);
}

function endAttack(now) {
  raid.attack = null;
  raid.nextAttack = now + ATTACK_EVERY[0] + Math.random() * (ATTACK_EVERY[1] - ATTACK_EVERY[0]);
  nextLetter(now);
}

function restart(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function renderSign(held, now) {
  const v = raid.view;
  const down = now < raid.downUntil;
  const letter = v.phase !== "battle" || down ? null : raid.attack ? raid.attack.letter : raid.target;
  $("raid-prompt").textContent =
    v.phase === "lobby" ? "Get ready to sign!" : v.phase !== "battle" ? "" : down ? `💫 Knocked out! Back in ${Math.ceil((raid.downUntil - now) / 1000)}...`
      : raid.attack ? `⚡ It's attacking you! Sign this to DODGE! (${Math.ceil((raid.attack.until - now) / 1000)}s)` : "Sign this to throw a 🌟 Unity Comet!";
  $("raid-prompt").classList.toggle("danger", Boolean(raid.attack));
  $("raid-letter").textContent = letter || "";
  $("raid-hold").style.width = `${(held || 0) * 100}%`;
  setGuide($("raid-img"), letter, letter ? progress.guideFor(letter) : "none");
  if (letter) $("raid-img").title = TIPS[letter] || "";
  $("raid-myhp-fill").style.width = `${down ? 0 : Math.max(0, raid.myHp)}%`;
  heroEl(myTag())?.classList.toggle("down", down);
}

// The raiders on the battlefield: one hero each, where they stand.
const heroEl = (tag) => raid?.heroes.get(tag);
function renderTeam() {
  const team = $("raid-team");
  const here = new Set();
  raid.view.players.forEach((p, n) => {
    here.add(p.tag);
    let el = raid.heroes.get(p.tag);
    if (!el) {
      el = document.createElement("div");
      el.className = `raid-hero${p.me ? " me" : ""}`;
      setHtml(el, `${heroImg(p.look, null, "", true)}<small>${esc(p.name)}${p.me ? " (you)" : ""}</small>`);
      team.append(el);
      raid.heroes.set(p.tag, el);
    }
    const [x, y] = SPOTS[n % SPOTS.length];
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    el.querySelector("small").dataset.dmg = p.dmg;
  });
  for (const [tag, el] of raid.heroes) if (!here.has(tag)) (el.remove(), raid.heroes.delete(tag));
}

// 🌟 Unity Comet: from a raider's hero to the giant, then a burst and the damage.
function comet(tag, dmg, mine = false) {
  const field = $("raid-field");
  const from = heroEl(tag);
  const boss = $("raid-boss-art");
  if (!from || !boss) return;
  const f = field.getBoundingClientRect(), a = from.getBoundingClientRect(), b = boss.getBoundingClientRect();
  const x0 = a.left + a.width / 2 - f.left, y0 = a.top + a.height * 0.3 - f.top;
  const x1 = b.left + b.width * 0.45 - f.left + (Math.random() - 0.5) * b.width * 0.3, y1 = b.top + b.height * 0.45 - f.top + (Math.random() - 0.5) * b.height * 0.3;
  restart(from, "cast");
  const star = document.createElement("div");
  star.className = `raid-comet${mine ? " mine" : ""}`;
  star.style.left = `${x0}px`;
  star.style.top = `${y0}px`;
  field.append(star);
  const flight = star.animate(
    [{ transform: "translate(-50%, -50%) scale(0.6)" }, { transform: `translate(calc(${x1 - x0}px - 50%), calc(${y1 - y0}px - 50%)) scale(1.1)` }],
    { duration: COMET_MS, easing: "cubic-bezier(.4,.1,.8,.6)" },
  );
  flight.onfinish = () => {
    star.remove();
    restart(boss, "hit");
    const burst = document.createElement("div");
    burst.className = "raid-burst";
    burst.style.left = `${x1}px`;
    burst.style.top = `${y1}px`;
    field.append(burst);
    const num = document.createElement("div");
    num.className = `raid-pop${mine ? " mine" : ""}`;
    num.textContent = `-${dmg}`;
    num.style.left = `${x1}px`;
    num.style.top = `${y1}px`;
    field.append(num);
    setTimeout(() => (burst.remove(), num.remove()), 900);
  };
}

function render() {
  const v = raid.view;
  renderTeam();
  // Everyone else's comets, since the last look.
  const me = myTag();
  let shown = 0;
  for (const h of v.hits) {
    if (h.seq <= raid.lastSeq) continue;
    if (h.tag !== me && shown < 6) setTimeout(() => raid && comet(h.tag, h.dmg), shown++ * 90);
  }
  raid.lastSeq = Math.max(raid.lastSeq, ...v.hits.map((h) => h.seq));
  $("raid-hp-fill").style.width = `${(v.hp / v.maxHp) * 100}%`;
  $("raid-hp-text").textContent = `${v.hp} / ${v.maxHp}`;
  $("raid-timer").textContent = v.phase === "battle" ? `⏱️ ${Math.floor(v.timeLeft / 60)}:${String(Math.floor(v.timeLeft % 60)).padStart(2, "0")}` : v.phase === "lobby" ? `⏳ ${Math.ceil(v.startsIn)}s` : "";
  const count = v.players.length;
  $("raid-phase").textContent = {
    lobby: `${count} raider${count === 1 ? "" : "s"} here. Starting in ${Math.ceil(v.startsIn)}s. ${raid.def.name} is WAY too strong alone: get friends to walk up to it too, or join from the ⚔️ Arena!`,
    battle: "",
    won: `🏆 You did it! ${raid.def.name} is beaten!`,
    lost: `⏱️ Time's up! ${raid.def.name} was too strong. Bring more friends and try again!`,
  }[v.phase];
  $("raid-phase").hidden = !$("raid-phase").textContent;
  $("raid-start").hidden = v.phase !== "lobby";
  $("raid-boss-art").classList.toggle("beaten", v.phase === "won");
  for (const line of v.log) if (!raid.seenLog.includes(line)) logLocal(line);
  raid.seenLog = v.log;
  if (v.phase === "won" && !raid.rewarded) {
    raid.rewarded = true;
    const mine = v.players.find((p) => p.me);
    if (mine?.dmg > 0) {
      progress.addEgg(raid.z, raid.tier);
      const need = progress.eggs().length > 1 ? "it waits for the incubator" : `sign ${progress.EGG_SIGNS[raid.tier]} signs to hatch it`;
      if (raid.def.kind === "rift") {
        // 🌀 A Rift boss (Skyhaven): a Rift egg, which hatches the rarest creatures.
        logLocal(`🏆 ${raid.def.name} is driven back through the Rift! You got a 🌀 Rift egg (${need})`);
      } else {
        progress.beatRaid(raid.z, raid.tier);
        logLocal(`🏆 Raid won! You got a 🥚 Raid egg (${need})${raid.tier < 3 ? ` · Raid ${TIER_NAMES[raid.tier + 1]} is open!` : " · You've beaten every raid level here!"}`);
      }
    }
  }
}

function logLocal(text) {
  const li = document.createElement("li");
  li.textContent = text;
  $("raid-log").prepend(li);
  while ($("raid-log").children.length > 5) $("raid-log").lastChild.remove();
}

// 📋 The Arena lists raids happening now, so anyone can join from there.
async function listRaids() {
  const box = $("raid-list");
  if (!$("screen-arena").hidden) {
    try {
      const { raids = [] } = await call("list");
      box.hidden = !raids.length;
      setHtml(box, `<h3>⚔️ Raids happening now</h3>${raids
        .map((r) => {
          const def = CREATURES.find((c) => c.id === r.raid);
          return `<div class="raid-row"><span>${def ? creatureImg(def.id, "raid-mini", false, 3) : ""}<b>${esc(def?.name || r.raid)}</b> · ${r.tier === RIFT_TIER ? "🌀 Rift" : `Raid ${TIER_NAMES[r.tier]}`} · ${r.players.length} raider${r.players.length === 1 ? "" : "s"} · ${r.phase === "lobby" ? `starts in ${Math.ceil(r.startsIn)}s` : "fighting now!"}</span><button class="btn small go" data-raid="${esc(r.raid)}" data-tier="${r.tier}">Join</button></div>`;
        })
        .join("")}`);
      for (const b of box.querySelectorAll("[data-raid]")) {
        b.onclick = () => openRaid({ raidId: b.dataset.raid, tier: Number(b.dataset.tier), onExit: () => show("arena") });
      }
    } catch {
      box.hidden = true;
    }
  }
  setTimeout(listRaids, 2000);
}
listRaids();
