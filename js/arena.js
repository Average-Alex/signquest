// The Battle Arena: battle other players, on other devices, by signing.
//
// The Arena is a plaza you walk around in (plaza.js), with everyone else
// who's here walking around too. You can:
//   ⚔️ walk up to someone and challenge them (they accept or not),
//   🔎 stand on a glowing pad to join the ranked queue - you're matched with
//      someone near your rank (step off to stop looking),
//   🎉 walk up to someone and invite them to your party (up to 3) - a party
//      queues on the party pad and battles another party the same size,
//      everyone signing at once.
// The same things are buttons in the lists below the plaza too, for anyone
// who'd rather not walk.
// A match is a Sign Duel: each round everyone gets the same letter (every
// third round, a short word). Whoever signs it hits the other side - harder
// the faster they are, and the first one to sign gets a bonus. The side whose
// HP runs out loses, and ranks go up or down.
//
// It all goes through serve.py (/api/...), polled a few times a second. Only
// your name, hero, rank, and "signed it" go there; the camera and the sign
// reading stay on this device.

import { getPrediction, HoldTimer } from "./classifier.js";
import { MOTION_LETTERS } from "./config.js";
import * as progress from "./progress.js";
import { announce, flashCamera, isShowing, setGuide, show, showHooks } from "./screens.js";
import { heroImg } from "./sprites.js";
import { createPlaza } from "./plaza.js";
import { playBattleSting } from "./music.js";
import { setText } from "./pixel-emoji.js";

const $ = (id) => document.getElementById(id);
const POLL_MS = 300; // often enough that people walking around look smooth

// Ranks by rating, lowest first.
export const RANKS = [
  { min: 0, name: "Bronze", color: "#c88a4a" },
  { min: 1050, name: "Silver", color: "#a8b4c4" },
  { min: 1150, name: "Gold", color: "#e8b820" },
  { min: 1250, name: "Platinum", color: "#3fb8d0" },
  { min: 1350, name: "Diamond", color: "#a06ae0" },
  { min: 1500, name: "Champion", color: "#e8506a" },
];
export const rankOf = (rating) => [...RANKS].reverse().find((r) => rating >= r.min);
const rankBadge = (rating) => {
  const r = rankOf(rating);
  return `<span class="rank-badge" style="--rank:${r.color}">${r.name} · ${rating}</span>`;
};

const esc = (text) => String(text).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

let state = null; // the server's latest view
let polling = false;
let offline = false;
let duel = null; // the sign duel in progress, on this side: { round, i, sent, hold }
let nearby = null; // who you're standing next to in the plaza
let padQueued = false; // you joined the queue by standing on a pad (stepping off leaves it)
let padWarned = null;

const plaza = createPlaza($("plaza"), {
  onNear(o) {
    nearby = o;
    renderNear();
  },
  onPad(id) {
    if (!state) return;
    const { party, me, queued } = state;
    if (!id) {
      if (padQueued && queued) call("queue", { join: false });
      padQueued = false;
      padWarned = null;
      return;
    }
    if (queued) return;
    // The 1v1 pad is for playing alone, the party pad for parties (the leader starts the search).
    const why = id === "solo" && party
      ? "You're in a party: stand on the Party Battle pad instead (or leave your party)."
      : id === "party" && !party
        ? "Make a party first: walk up to someone and tap 🎉 Invite."
        : id === "party" && party.leader !== me.id
          ? "Your party leader stands on the pad to search for a battle."
          : null;
    if (why) {
      if (padWarned !== id) toastArena(why);
      padWarned = id;
      return;
    }
    padQueued = true;
    call("queue", { join: true }).then(() => announce("Looking for a match near your rank. Step off the pad to stop."));
  },
});


// The buttons for whoever you're standing next to.
function renderNear() {
  const el = $("plaza-action");
  const o = nearby && state?.players.find((x) => x.id === nearby.id);
  el.hidden = !o;
  if (!o) return;
  const inParty = (state.party?.members || []).some((m) => m.id === o.id);
  el.innerHTML = `<span class="arena-name">${esc(o.name)}</span>${rankBadge(o.rating)}
    <button class="btn small go" id="near-challenge" ${inParty ? "disabled" : ""}>⚔️ Challenge</button>
    <button class="btn small" id="near-invite" ${inParty ? "disabled" : ""}>🎉 Invite</button>`;
  $("near-challenge").onclick = () => call("challenge", { to: o.id }).then((r) => r.ok && toastArena(`Challenge sent to ${o.name}!`));
  $("near-invite").onclick = () => call("party/invite", { to: o.id }).then((r) => r.ok && toastArena(`Party invite sent to ${o.name}!`));
}

async function call(path, body = {}) {
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: progress.get().arenaId, ...body }),
  });
  if (!res.ok) throw new Error(`Arena server: ${res.status}`);
  const out = await res.json();
  if (out.error) toastArena(out.error);
  return out;
}

async function hello() {
  const p = progress.get();
  const out = await call("hello", { name: p.name || "Hero", look: progress.heroLook(), rating: p.rating });
  if (out.id && out.id !== p.arenaId) progress.update({ arenaId: out.id });
}

// ---------- Polling ----------

async function poll() {
  if (!isShowing("arena") && !isShowing("pvp")) {
    polling = false;
    plaza.stop();
    return;
  }
  try {
    const out = await call("state", isShowing("arena") ? { pos: plaza.pos() } : {});
    if (out.error === "hello first") await hello();
    else {
      state = out;
      offline = false;
      if (out.me && out.me.rating !== progress.get().rating && !out.match) progress.update({ rating: out.me.rating });
      render();
    }
  } catch {
    offline = true;
    render();
  }
  setTimeout(poll, POLL_MS);
}

function startPolling() {
  if (polling) return;
  polling = true;
  hello()
    .catch(() => {})
    .finally(poll);
}

showHooks.arena = () => {
  const p = progress.get();
  plaza.start(progress.heroLook(), p.equipped.hat);
  startPolling();
};

function render() {
  $("arena-offline").hidden = !offline;
  if (offline) {
    $("arena-offline").textContent = "The Arena needs the game server. Start the game with \"python serve.py\" on this computer, and friends join from the address it shows.";
    return;
  }
  if (!state) return;
  if (state.match) {
    if (!isShowing("pvp")) {
      show("pvp");
      playBattleSting();
      announce("A Sign Duel is starting!");
    }
    return renderDuel(state.match);
  }
  if (isShowing("pvp")) show("arena");
  renderLobby();
}

// ---------- The lobby ----------

function renderLobby() {
  const { me, players, party, invites, challengesIn, challengesOut, queued } = state;
  $("arena-rank").innerHTML = rankBadge(me.rating);
  const p = progress.get();
  const leader = !party || party.leader === me.id;
  $("arena-me").innerHTML = `
    <div class="arena-me-hero">${heroImg(progress.heroLook(), p.equipped.hat)}</div>
    <div>
      <p class="arena-me-name">${esc(me.name)}</p>
      ${rankBadge(me.rating)}
      <p class="arena-hint">${queued ? `🔎 Looking for someone near your rank…${padQueued ? " Step off the pad to stop." : ""}` : party ? `Your party of ${party.members.length} battles together: ${leader ? "stand on the Party Battle pad" : "your leader starts the search"}.` : "Walk up to someone to challenge them, or stand on a glowing pad to find a match."}</p>
    </div>
    <button id="arena-queue" class="btn small ${queued ? "" : "go"}" ${leader ? "" : "disabled"}>
      ${queued ? "✖ Stop looking" : party ? `🔎 Find a match for your party` : "🔎 Find a ranked match"}
    </button>`;
  $("arena-queue").onclick = () => call("queue", { join: !queued });

  // Everyone in the plaza (not the ones off in a battle).
  plaza.setOthers(players.filter((o) => o.status !== "battle"), (party?.members || []).map((m) => m.id));
  renderNear();

  // Your party.
  $("arena-party").innerHTML = party
    ? `<ul class="arena-list">${party.members
        .map((m) => `<li>${heroImg(m.look, null, "arena-face")}<span class="arena-name">${m.id === party.leader ? "👑 " : ""}${esc(m.name)}${m.id === me.id ? " (you)" : ""}</span>${rankBadge(m.rating)}</li>`)
        .join("")}</ul><button id="arena-leave-party" class="btn small">Leave party</button>`
    : `<p class="arena-hint">Tap 🎉 next to someone to team up. Parties battle other parties, all signing at once!</p>`;
  if (party) $("arena-leave-party").onclick = () => call("party/leave");

  // Requests: challenges to you, party invites, and your own challenges.
  const rows = [
    ...challengesIn.map((c) => `<li>⚔️ <span class="arena-name">${esc(c.from.name)}</span>${rankBadge(c.from.rating)} wants to battle!
      <button class="btn small go" data-accept="${c.id}">Battle!</button><button class="btn small" data-decline="${c.id}">No thanks</button></li>`),
    ...invites.map((i) => `<li>🎉 <span class="arena-name">${esc(i.from)}</span> invited you to their party
      <button class="btn small go" data-join="${i.party}">Join</button><button class="btn small" data-nojoin="${i.party}">No thanks</button></li>`),
    ...challengesOut.map((c) => `<li>⏳ Waiting for <span class="arena-name">${esc(c.to.name)}</span>… <button class="btn small" data-cancel="1">Cancel</button></li>`),
  ];
  $("arena-requests").innerHTML = rows.length ? `<ul class="arena-list">${rows.join("")}</ul>` : `<p class="arena-hint">No requests right now.</p>`;
  for (const b of $("arena-requests").querySelectorAll("button")) {
    b.onclick = () => {
      const d = b.dataset;
      if (d.accept) call("challenge/respond", { challenge: d.accept, accept: true });
      if (d.decline) call("challenge/respond", { challenge: d.decline, accept: false });
      if (d.join) call("party/join", { party: d.join });
      if (d.nojoin) call("party/decline", { party: d.nojoin });
      if (d.cancel) call("challenge/cancel");
    };
  }

  // Everyone else here.
  const inParty = new Set((party?.members || []).map((m) => m.id));
  $("arena-players").innerHTML = players.length
    ? `<ul class="arena-list">${players
        .sort((a, b) => b.rating - a.rating)
        .map((o) => {
          const busy = o.status === "battle";
          return `<li>${heroImg(o.look, null, "arena-face")}<span class="arena-name">${esc(o.name)}</span>${rankBadge(o.rating)}
            <span class="arena-status">${busy ? "⚔️ battling" : o.party > 1 ? `🎉 party of ${o.party}` : ""}</span>
            <button class="btn small" data-challenge="${o.id}" ${busy || inParty.has(o.id) ? "disabled" : ""}>⚔️ Challenge</button>
            <button class="btn small" data-invite="${o.id}" ${busy || inParty.has(o.id) ? "disabled" : ""}>🎉 Invite</button></li>`;
        })
        .join("")}</ul>`
    : `<p class="arena-hint">Nobody else is here yet. Friends on the same Wi-Fi can join from the address the game server shows.</p>`;
  for (const b of $("arena-players").querySelectorAll("button")) {
    b.onclick = () => {
      if (b.dataset.challenge) call("challenge", { to: b.dataset.challenge }).then((o) => o.ok && toastArena("Challenge sent!"));
      if (b.dataset.invite) call("party/invite", { to: b.dataset.invite }).then((o) => o.ok && toastArena("Party invite sent!"));
    };
  }
}

function toastArena(text) {
  const el = $("arena-toast");
  el.textContent = text;
  el.hidden = false;
  announce(text);
  clearTimeout(el.timer);
  el.timer = setTimeout(() => (el.hidden = true), 3000);
}

// ---------- The Sign Duel ----------

function renderDuel(m) {
  const mine = m.you, theirs = 1 - m.you;
  if (!duel || duel.match !== m.id) duel = { match: m.id, round: 0, i: 0, sent: false, hold: new HoldTimer(), seen: new Set(m.log.map((e) => `${e.round}-${e.pid}`)), over: false };
  if (m.round !== duel.round) {
    duel.round = m.round;
    duel.i = 0;
    duel.sent = false;
    duel.hold.reset();
  }
  $("pvp-round").textContent = `Round ${m.round}`;
  const side = (s, el, label) => {
    const hp = m.hp[s], max = m.max[s];
    el.innerHTML = `<p class="pvp-side-label">${label}</p>
      <div class="hp"><div class="hp-fill" style="width:${(hp / max) * 100}%"></div><span class="hp-text">${hp} / ${max}</span></div>
      <div class="pvp-fighters">${m.sides[s]
        .map((f) => `<figure class="pvp-fighter${f.signed ? " signed" : ""}">${heroImg(f.look, null, s === mine ? "" : "foe-hero")}<figcaption>${f.signed ? "✅ " : ""}${esc(f.name)}</figcaption></figure>`)
        .join("")}</div>`;
  };
  side(mine, $("pvp-side-0"), m.sides[mine].length > 1 ? "Your party" : "You");
  side(theirs, $("pvp-side-1"), m.sides[theirs].length > 1 ? "Their party" : "Them");

  // New hits since last time: numbers fly at whoever took them.
  for (const e of m.log) {
    const key = `${e.round}-${e.pid}`;
    if (duel.seen.has(key)) continue;
    duel.seen.add(key);
    popDamage(e.side === mine ? $("pvp-side-1") : $("pvp-side-0"), e.dmg, e.side === mine);
  }
  $("pvp-log").innerHTML = m.log
    .slice(-4)
    .reverse()
    .map((e) => `<li class="${e.side === mine ? "good" : "bad"}">${e.first ? "⚡ " : ""}${esc(e.name)} signed it in ${e.secs}s: ${e.dmg} damage${e.first ? " (first!)" : ""}</li>`)
    .join("");

  // The result.
  if (m.winner !== null) {
    $("pvp-result").hidden = false;
    const won = m.winner === mine;
    const why = m.left ? (won ? "The other side left the battle." : "You left the battle.") : "";
    $("pvp-result-text").innerHTML = `${won ? "🏆 You win!" : "Good battle!"}<br><small>${why} ${m.change >= 0 ? "+" : ""}${m.change ?? 0} rank points</small>`;
    if (!duel.over) {
      duel.over = true;
      announce(won ? `You win! You gained ${m.change} rank points.` : `They won this time. ${m.change} rank points.`);
    }
    return;
  }
  $("pvp-result").hidden = true;

  // Countdown, then the target.
  if (!m.target) {
    $("pvp-label").textContent = m.startsIn > 0 ? `Get ready… ${Math.ceil(m.startsIn)}` : "Get ready…";
    $("pvp-target").innerHTML = "";
    $("pvp-time-fill").style.width = "100%";
    return;
  }
  duel.target = m.target;
  duel.endsIn = m.endsIn;
  duel.endsAt = performance.now() + m.endsIn * 1000;
  $("pvp-label").textContent = duel.sent ? "✅ Signed! Waiting for the others…" : m.kind === "word" ? "💥 Word round! Spell it" : "Sign it, fast!";
  $("pvp-target").innerHTML = m.target
    .split("")
    .map((l, n) => `<span class="slot ${n < duel.i || duel.sent ? "done" : n === duel.i ? "now" : ""}${m.target.length === 1 ? " single" : ""}">${l}</span>`)
    .join("");
}

// A damage number that floats up off a side. `ours`: we hit them.
function popDamage(sideEl, dmg, ours) {
  const el = document.createElement("span");
  el.className = `pvp-dmg ${ours ? "good" : "bad"}`;
  el.textContent = `-${dmg}`;
  sideEl.parentElement.appendChild(el);
  el.style.setProperty("--x", `${sideEl.offsetLeft + sideEl.offsetWidth / 2}px`);
  setTimeout(() => el.remove(), 1200);
}

// Reading your signs, every frame while a round is on.
function duelTick(now) {
  requestAnimationFrame(duelTick);
  if (!isShowing("pvp") || !duel || !duel.target || duel.over) return;
  const left = Math.max(0, duel.endsAt - now);
  $("pvp-time-fill").style.width = `${Math.min(100, (left / ((duel.target.length > 1 ? 20 : 10) * 1000)) * 100)}%`;
  if (duel.sent || !state?.match?.target) return;
  const letter = duel.target[duel.i];
  setGuide($("pvp-guide"), letter, progress.guideFor(letter));
  const prediction = getPrediction();
  setText($("pvp-seeing"), !prediction ? "Show your hand ✋" : MOTION_LETTERS.includes(letter) ? `Draw ${letter} in the air ✍️` : `I see: ${prediction.letter}`);
  const held = duel.hold.update(letter, prediction, now);
  $("pvp-hold").style.width = `${held * 100}%`;
  if (held < 1) return;
  flashCamera("good");
  duel.hold.reset();
  duel.i++;
  $("pvp-hold").style.width = "0%";
  if (duel.i >= duel.target.length) {
    duel.sent = true;
    call("match/sign", { round: duel.round });
    announce("Signed! Waiting for the others.");
  }
  if (state?.match) renderDuel(state.match);
}
requestAnimationFrame(duelTick);

$("pvp-leave").onclick = () => {
  if (state?.match?.winner === null && !confirm("Give up this battle?")) return;
  call("match/leave").then(() => {
    duel = null;
    plaza.respawn();
    show("arena");
  });
};
$("pvp-done").onclick = () => {
  call("match/leave").then(() => {
    duel = null;
    plaza.respawn(); // back by the entrance, off the pads
    show("arena");
  });
};
showHooks.pvp = startPolling;
