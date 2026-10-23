// Creature Clash: a turn-based battle against another player in the Arena,
// played like the creature battles in the zones, in the Colosseum.
//
// Each side stands in formation: the hero in the middle, their buddies above
// and below (in a party battle, the party's heroes instead). Players take
// turns. On your turn you pick a move from your hero's spellbook or a buddy's
// moves, tap the foe to aim it at (or pick a 💥 group move that hits them
// all), then sign the letter (every 4th turn, a word) to use it. Every hero
// and buddy has their own HP: a knocked-out buddy can't use its moves, and a
// side loses when its heroes are down. Signing earns energy for bigger
// moves. Moves with an element can be super effective, or weak, against the
// buddy they hit. Shield blocks the next move, Heal heals whoever is hurt
// most, and Stun makes the other side skip a turn.
//
// serve.py runs the rules (so nobody can cheat by editing their page); this
// file draws the battle and reads your signs. arena.js polls the server and
// calls renderClash() with what it says.

import { getPrediction, HoldTimer } from "./classifier.js";
import { buddyMoves, CREATURES, creatureName, effectiveness, ELEMENTS, GROUP_POWER, heroSpells, MOTION_LETTERS, stageOf } from "./config.js";
import { colosseumSrc } from "./colosseum.js";
import * as progress from "./progress.js";
import { announce, flashCamera, isShowing, setGuide } from "./screens.js";
import { creatureImg, heroImg } from "./sprites.js";
import { setText } from "./pixel-emoji.js";

const $ = (id) => document.getElementById(id);
const BOOK_PAGE = 4; // moves per spellbook page
const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// What you bring to a Creature Clash: your hero's spells and your team's
// buddies with their moves. arena.js sends it to the server when you join.
export function clashLoadout() {
  const p = progress.get();
  const move = (mv, id) => ({ id: id || mv.id || mv.name, name: mv.name, icon: mv.icon, type: mv.type || "attack", cost: mv.cost || 0, power: mv.power || 1, element: mv.element || "", all: Boolean(mv.all) });
  return {
    spells: heroSpells(progress.shardCount(), p.equipped.armor).map((sp) => move(sp)),
    buddies: progress.team().slice(0, 2).map((pet) => {
      const c = CREATURES.find((x) => x.id === pet.id);
      return {
        id: pet.id, name: creatureName(pet.id, pet.level), element: c?.element || "", level: pet.level, stage: stageOf(pet.level),
        moves: buddyMoves(pet.id, pet.level).map((mv) => move(mv, mv.name)),
      };
    }),
  };
}

let clash = null; // this side's view of the battle in progress
let send = null; // arena.js's call() to the server
let leave = null; // arena.js: back to the Arena

export function initClash({ call, back }) {
  send = call;
  leave = back;
}

// The left (you) or right (them) slot elements, top to bottom.
const slots = (side) => [0, 1, 2].map((n) => $(`clash-${side === "left" ? "l" : "r"}${n}`));

export function renderClash(m) {
  if (!clash || clash.match !== m.id) {
    clash = { match: m.id, round: 0, tab: 0, page: 0, pick: { who: "hero", id: null }, aim: null, slotOf: new Map(), i: 0, sent: false, hold: new HoldTimer(), seen: new Set(m.log.map(logKey)), over: false };
    $("clash-bg").src = colosseumSrc();
    drawFormations(m);
  }
  if (m.round !== clash.round) {
    clash.round = m.round;
    clash.i = 0;
    clash.sent = false;
    clash.hold.reset();
  }
  clash.m = m;
  const mine = m.you, theirs = 1 - m.you;
  $("clash-count").textContent = `Turn ${m.round}`;

  // HP panels.
  const hud = (s, who) => {
    const hp = m.hp[s], max = m.max[s];
    const lead = m.sides[s][0];
    const pet = m.loadouts[s][0]?.buddies?.[0];
    $(`clash-${who}-face`).innerHTML = heroImg(lead.look, null);
    $(`clash-${who}-name`).textContent = m.sides[s].length > 1 ? `${lead.name}'s party` : lead.name;
    $(`clash-${who}-hp`).style.width = `${(hp / max) * 100}%`;
    $(`clash-${who}-hp-text`).textContent = `${hp} / ${max}`;
    const el = pet && ELEMENTS[pet.element];
    const energy = m.energies[s].reduce((a, b) => a + b, 0);
    $(`clash-${who}-sub`).innerHTML = [
      el ? `<span class="el-badge el-${pet.element}">${el.icon} ${el.name}</span>` : "",
      s === mine ? `<span class="clash-sub-energy" aria-label="Energy ${m.energy}">${Array.from({ length: 10 }, (_, n) => `<i class="${n < m.energy ? "full" : ""}"></i>`).join("")}</span>` : `<span>⚡ ${energy}</span>`,
      m.shield[s] ? `<span>🛡️ ×${m.shield[s]}</span>` : "",
      m.skip[s] ? `<span>💫 Stunned</span>` : "",
    ].join(" ");
  };
  hud(mine, "you");
  hud(theirs, "foe");
  drawHealth(m);

  // Whose turn: a banner, and a gold ring under the hero whose turn it is.
  const activeSide = m.sides[0].some((f) => f.id === m.active) ? 0 : 1;
  const activeName = m.sides[activeSide].find((f) => f.id === m.active)?.name || "";
  const banner = $("clash-banner");
  banner.textContent = m.winner !== null ? "" : m.yourTurn ? "Your turn!" : `${activeName}'s turn!`;
  banner.className = `turn-banner ${activeSide === mine ? "yours" : "theirs"}`;
  for (const el of [...slots("left"), ...slots("right")]) el.classList.remove("acting");
  const heroSlot = (s, k) => {
    const n = m.sides[s].length === 1 ? 1 : [1, 0, 2][k];
    return slots(s === mine ? "left" : "right")[n];
  };
  if (m.winner === null) heroSlot(activeSide, m.sides[activeSide].findIndex((f) => f.id === m.active))?.classList.add("acting");

  // New moves since last time: animate them.
  for (const e of m.log) {
    const key = logKey(e);
    if (clash.seen.has(key)) continue;
    clash.seen.add(key);
    animate(m, e);
  }
  $("clash-log").innerHTML = m.log.slice(-3).reverse().map((e) => `<li class="${e.side === mine ? "good" : "bad"}">${logLine(e)}</li>`).join("");

  // The result.
  if (m.winner !== null) {
    $("clash-result").hidden = false;
    $("clash-label").textContent = "Battle over!";
    $("clash-target").innerHTML = "";
    clash.target = null;
    const won = m.winner === mine;
    const why = m.left ? (won ? "The other side left the battle." : "You left the battle.") : "";
    $("clash-result-text").innerHTML = `${won ? "🏆 You win!" : "Good battle!"}<br><small>${why} ${m.change >= 0 ? "+" : ""}${m.change ?? 0} rank points</small>`;
    if (!clash.over) {
      clash.over = true;
      announce(won ? `You win the Creature Clash! You gained ${m.change} rank points.` : `They won this time. ${m.change} rank points.`);
    }
    renderMoves();
    return;
  }
  $("clash-result").hidden = true;

  // What to sign.
  clash.endsAt = performance.now() + m.endsIn * 1000;
  clash.total = m.kind === "word" ? 25 : 15;
  if (!m.target) {
    clash.target = null;
    $("clash-label").textContent = m.startsIn > 0 ? `${m.yourTurn ? "Your turn" : `${activeName}'s turn`}… ${Math.ceil(m.startsIn)}` : "Get ready…";
    $("clash-target").innerHTML = "";
  } else if (m.resolved) {
    clash.target = null;
    $("clash-label").textContent = "…";
  } else {
    clash.target = m.target;
    $("clash-label").textContent = m.yourTurn
      ? clash.sent ? "✅ Signed!" : `Your turn! Pick a move, tap a foe to aim, then sign ${m.kind === "word" ? "the word" : "it"}`
      : `${activeName} is signing…`;
    $("clash-target").innerHTML = m.target
      .split("")
      .map((l, n) => `<span class="slot ${n < clash.i || clash.sent ? "done" : n === clash.i && m.yourTurn ? "now" : ""}${m.target.length === 1 ? " single" : ""}">${l}</span>`)
      .join("");
  }
  renderMoves();
}

// Put everyone on the field: your side on the left, theirs on the right.
// Each fighter's slot is remembered by their key (see clash_fighters in serve.py).
function drawFormations(m) {
  clash.slotOf.clear();
  for (const [s, side] of [[m.you, "left"], [1 - m.you, "right"]]) {
    const els = slots(side);
    for (const el of els) {
      el.innerHTML = "";
      el.onclick = el.onkeydown = null;
      el.removeAttribute("tabindex");
      el.removeAttribute("role");
    }
    const fighters = m.sides[s];
    const foe = side === "right";
    const bar = `<span class="clash-hp" aria-hidden="true"><i></i></span>`;
    const hero = (f) => `${heroImg(f.look, null, foe ? "foe-hero" : "")}<span class="clash-name">${esc(f.name)}</span>${bar}`;
    const place = (el, key, html) => {
      el.innerHTML = html;
      clash.slotOf.set(key, el);
      if (!foe) return;
      // Tap (or press Enter on) a foe to aim at it.
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.onclick = () => aimAt(key);
      el.onkeydown = (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), aimAt(key));
    };
    if (fighters.length === 1) {
      // One player: their hero in the middle, their buddies above and below.
      place(els[1], `${fighters[0].id}:hero`, hero(fighters[0]));
      (m.loadouts[s][0]?.buddies || []).forEach((b, n) => {
        const known = CREATURES.some((c) => c.id === b.id);
        if (known) place(els[n === 0 ? 0 : 2], `${fighters[0].id}:${n}`, `${creatureImg(b.id, "", false, b.stage)}<span class="clash-name">${esc(b.name)} · Lv ${b.level}</span>${bar}`);
      });
    } else {
      // A party: its heroes in formation.
      fighters.forEach((f, k) => place(els[[1, 0, 2][k]], `${f.id}:hero`, hero(f)));
    }
  }
}

const standing = (m, side) => (m.fighters || []).filter((f) => f.side === side && f.hp > 0);

// Who your attacks aim at: your pick if they're still standing, else their
// first buddy (like in the zones), else their hero.
function aimed(m) {
  const foes = standing(m, 1 - m.you);
  return foes.find((f) => f.key === clash.aim) || foes.find((f) => f.who !== "hero") || foes[0];
}

function aimAt(key) {
  const m = clash?.m;
  const f = m?.fighters?.find((x) => x.key === key);
  if (!f || f.hp <= 0) return;
  clash.aim = key;
  announce(`Aiming at ${f.name}.`);
  renderClash(m);
}

// Everyone's own HP bar, knocked-out fighters greyed out, and the 🎯 on your aim.
function drawHealth(m) {
  const target = aimed(m);
  for (const f of m.fighters || []) {
    const el = clash.slotOf.get(f.key);
    if (!el) continue;
    const fill = el.querySelector(".clash-hp i");
    if (fill) fill.style.width = `${(f.hp / f.max) * 100}%`;
    el.classList.toggle("out", f.hp <= 0);
    el.classList.toggle("targeted", f.side !== m.you && f === target && m.winner === null);
    if (f.side !== m.you) el.setAttribute("aria-label", `${f.name}: ${f.hp} of ${f.max} HP${f.hp <= 0 ? ", knocked out" : ""}. Tap to aim.`);
  }
}

// One move landing: the user dashes forward, the other side shakes, numbers fly.
function animate(m, e) {
  const ours = e.side === m.you;
  const userSlot = clash.slotOf.get(`${e.pid}:${e.who ?? "hero"}`) || clash.slotOf.get(`${e.pid}:hero`);
  const hits = (e.hits || []).map((h) => ({ ...h, slot: clash.slotOf.get(h.key) }));
  const targetSlots = hits.length ? hits.map((h) => h.slot) : [slots(ours ? "right" : "left")[1]];
  const restart = (el, cls) => {
    if (!el) return;
    el.classList.remove("pounce", "pounce-left", "clash-hit", "clash-boost");
    void el.offsetWidth;
    el.classList.add(cls);
  };
  if (e.skipped) return pop(`💫 ${e.name} is stunned!`);
  if (e.timeout) return pop(`⏰ ${e.name} ran out of time!`);
  const name = `${e.icon || ""} ${e.move}!`;
  if (e.type === "shield" || e.type === "heal") {
    restart(userSlot, "clash-boost");
    pop(name);
    if (e.heal) number(clash.slotOf.get(e.healed) || userSlot, `+${e.heal}`, "good");
    return;
  }
  restart(userSlot, ours ? "pounce" : "pounce-left");
  pop(e.type === "stun" ? `${name} 💫` : name, e.dmg >= 25);
  setTimeout(() => {
    for (const slot of targetSlots) restart(slot, "clash-hit");
    if (e.type === "stun") return;
    if (e.blocked) return pop("Blocked! 🛡️");
    for (const h of hits) number(h.slot, `-${h.dmg}`, h.dmg >= 25 ? "big" : "");
    const knocked = hits.filter((h) => h.out).map((h) => m.fighters?.find((f) => f.key === h.key)?.name).filter(Boolean);
    if (knocked.length) setTimeout(() => pop(`${knocked.join(" & ")} ${knocked.length > 1 ? "are" : "is"} knocked out!`, true), 450);
    else if (e.eff > 1) setTimeout(() => pop("It's super effective! ▲", true), 450);
    else if (e.eff < 1) setTimeout(() => pop("Not very effective… ▼"), 450);
  }, 300);
}

function pop(text, big = false) {
  const el = $("clash-pop");
  el.textContent = text;
  el.className = "pop";
  void el.offsetWidth;
  el.className = `pop show${big ? " crit" : ""}`;
  clearTimeout(el.timer);
  el.timer = setTimeout(() => (el.className = "pop"), 1100);
  announce(text);
}

function number(slot, text, kind) {
  if (!slot) return;
  const el = document.createElement("span");
  el.className = `clash-dmg ${kind}`;
  el.textContent = text;
  const field = $("clash-field").getBoundingClientRect();
  const r = slot.getBoundingClientRect();
  el.style.left = `${r.left - field.left + r.width / 2}px`;
  el.style.top = `${r.top - field.top}px`;
  $("clash-field").appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

const logKey = (e) => `${e.turn}-${e.pid}-${e.skipped ? "s" : e.timeout ? "t" : "m"}`;

function logLine(e) {
  const who = esc(e.name);
  if (e.skipped) return `💫 ${who} was stunned and skipped a turn`;
  if (e.timeout) return `⏰ ${who} ran out of time`;
  const user = e.user ? `${esc(e.user)} used` : `${who} cast`;
  const move = `${e.icon || ""} ${esc(e.move)}`;
  if (e.type === "shield") return `${user} ${move}: shield up!`;
  if (e.type === "heal") return `${user} ${move}: +${e.heal} HP`;
  if (e.type === "stun") return `${user} ${move}: they skip a turn!`;
  if (e.blocked) return `${user} ${move}... blocked!`;
  const hit = e.all ? "everyone" : esc(clash?.m?.fighters?.find((f) => f.key === e.hits?.[0]?.key)?.name || "them");
  return `${user} ${move} on ${hit}: ${e.dmg} damage${e.eff > 1 ? ". Super effective!" : e.eff < 1 ? ". Not very effective..." : ""}`;
}

// ---------- Your moves: a tab for your hero and each buddy, like in battles ----------

function myLoadout() {
  const m = clash.m;
  const k = m.sides[m.you].findIndex((f) => f.id === progress.get().arenaId);
  return m.loadouts[m.you][Math.max(0, k)];
}

function renderMoves() {
  const m = clash?.m;
  if (!m) return;
  const lo = myLoadout();
  if (!lo) return;
  const tabs = [{ who: "hero", name: "You", art: heroImg(progress.heroLook(), progress.get().equipped.hat, "tab-hero"), moves: lo.spells }].concat(
    (lo.buddies || []).map((b, n) => ({ who: String(n), name: b.name, art: CREATURES.some((c) => c.id === b.id) ? creatureImg(b.id, "tab-art", false, b.stage) : "", moves: b.moves })),
  );
  const me = m.sides[m.you].find((f) => f.id === progress.get().arenaId) || m.sides[m.you][0];
  // A knocked-out buddy can't use its moves.
  const out = (who) => (m.fighters || []).some((f) => f.key === `${me.id}:${who}` && f.hp <= 0);
  if (clash.tab >= tabs.length) clash.tab = 0;
  if (!clash.pick.id) clash.pick = { who: "hero", id: lo.spells[0]?.id };
  $("clash-tabs").innerHTML = tabs
    .map((t, n) => `<button class="move-tab${n === clash.tab ? " open" : ""}${clash.pick.who === t.who ? " has-pick" : ""}${out(t.who) ? " out" : ""}" role="tab" aria-selected="${n === clash.tab}" data-tab="${n}">
      <span class="tab-face">${t.art}</span><span class="tab-name">${esc(t.name)}</span></button>`)
    .join("");
  for (const b of $("clash-tabs").querySelectorAll("button")) {
    b.onclick = () => {
      clash.tab = Number(b.dataset.tab);
      clash.page = 0;
      renderMoves();
    };
  }
  $("clash-energy").textContent = `⚡ ${m.energy} / 10`;

  const tab = tabs[clash.tab];
  const target = aimed(m);
  // If the picked move can't be afforded anymore, go back to the free spell.
  const picked = findPick(tabs);
  if (!picked || picked.cost > m.energy || out(clash.pick.who)) clash.pick = { who: "hero", id: lo.spells[0]?.id };
  const pages = Math.max(1, Math.ceil(tab.moves.length / BOOK_PAGE));
  clash.page = Math.min(clash.page, pages - 1);
  $("clash-prev").hidden = $("clash-next").hidden = pages < 2;
  $("clash-prev").disabled = clash.page === 0;
  $("clash-next").disabled = clash.page >= pages - 1;
  $("clash-page").textContent = pages > 1 ? `${clash.page + 1} / ${pages}` : "";
  const busy = !m.yourTurn || clash.sent || m.winner !== null || out(tab.who);
  $("clash-moves").innerHTML = tab.moves
    .slice(clash.page * BOOK_PAGE, (clash.page + 1) * BOOK_PAGE)
    .map((mv) => {
      const on = clash.pick.who === tab.who && clash.pick.id === mv.id;
      const attack = mv.type === "attack";
      const group = attack && mv.all && standing(m, 1 - m.you).length > 1;
      const eff = attack && !group && mv.element ? effectiveness(mv.element, target?.element) : 1;
      const tag = group ? `<span class="move-eff all">💥 All</span>` : eff > 1 ? `<span class="move-eff up">▲ Super</span>` : eff < 1 ? `<span class="move-eff down">▼ Weak</span>` : "";
      const el = ELEMENTS[mv.element];
      const desc = group ? `${Math.round(mv.power * GROUP_POWER * 10) / 10}x to everyone` : attack ? (mv.power > 1 ? `${mv.power}x damage` : "Normal hit") : { shield: "Blocks a move", heal: "Heals your most hurt", stun: "Skips their turn" }[mv.type];
      return `<button class="move-btn spell-card${on ? " picked" : ""} type-${mv.type} el-${mv.element || "none"}" data-id="${esc(mv.id)}" aria-pressed="${on}" ${busy || mv.cost > m.energy ? "disabled" : ""}>
        <span class="move-cost">${mv.cost ? `${mv.cost}⚡` : "Free"}</span>
        <span class="move-icon">${mv.icon || "✨"}</span>
        <span class="move-name">${esc(mv.name)}</span>
        <span class="move-desc">${el ? `${el.icon} ` : ""}${desc}</span>${tag ? `<span class="move-tags">${tag}</span>` : ""}</button>`;
    })
    .join("");
  for (const b of $("clash-moves").querySelectorAll("button")) {
    b.onclick = () => {
      clash.pick = { who: tab.who, id: b.dataset.id };
      renderMoves();
      announce(`${tab.moves.find((mv) => mv.id === b.dataset.id)?.name} ready. Sign to use it!`);
    };
  }
}

function findPick(tabs) {
  const t = tabs.find((x) => x.who === clash.pick.who);
  return t?.moves.find((mv) => mv.id === clash.pick.id);
}

$("clash-prev").onclick = () => clash && ((clash.page = Math.max(0, clash.page - 1)), renderMoves());
$("clash-next").onclick = () => clash && ((clash.page += 1), renderMoves());

// ---------- Reading your signs, every frame ----------

function tick(now) {
  requestAnimationFrame(tick);
  if (!isShowing("clash") || !clash?.m) return;
  const m = clash.m;
  const left = Math.max(0, clash.endsAt - now);
  $("clash-time-fill").style.width = clash.target ? `${Math.min(100, (left / (clash.total * 1000)) * 100)}%` : "100%";
  if (!m.yourTurn || !clash.target || clash.sent || m.winner !== null) {
    $("clash-guide").hidden = true;
    setText($("clash-seeing"), m.yourTurn ? "Get ready…" : "Watch out…");
    return;
  }
  const letter = clash.target[clash.i];
  setGuide($("clash-guide"), letter, progress.guideFor(letter));
  const prediction = getPrediction();
  setText($("clash-seeing"), !prediction ? "Show your hand ✋" : MOTION_LETTERS.includes(letter) ? `Draw ${letter} in the air ✍️` : `I see: ${prediction.letter}`);
  const held = clash.hold.update(letter, prediction, now);
  $("clash-hold").style.width = `${held * 100}%`;
  if (held < 1) return;
  flashCamera("good");
  clash.hold.reset();
  clash.i++;
  $("clash-hold").style.width = "0%";
  if (clash.i >= clash.target.length) {
    clash.sent = true;
    send("match/sign", { round: m.round, move: { ...clash.pick, target: aimed(m)?.key } });
  }
  renderClash(m);
}
requestAnimationFrame(tick);

$("clash-leave").onclick = () => {
  if (clash?.m?.winner === null && !confirm("Give up this battle?")) return;
  clash = null;
  leave();
};
$("clash-done").onclick = () => {
  clash = null;
  leave();
};
