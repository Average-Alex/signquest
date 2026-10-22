// The arena's HUD: HP bars, names and status badges, the match timer, a card
// for each teammate (who, the letter to sign with its hand picture, the move
// they'll do next, cooldown, and how close your sign is to counting), the
// word to spell for a team combo, floating numbers and banners, and what the
// camera sees. It's HTML over the canvas, so text stays big and crisp.

import { ARENA_H, ARENA_W } from "./config.js";

const $ = (id) => document.getElementById(id);

export function setNames(you, foe, foeSub) {
  $("arena-you-name").textContent = you;
  $("arena-foe-name").textContent = foe;
  $("arena-foe-sub").innerHTML = foeSub;
}

export function setHp(side, hp, max) {
  const pct = Math.max(0, hp / max) * 100;
  $(`arena-${side}-hp`).style.width = `${pct}%`;
  $(`arena-${side}-hp`).classList.toggle("low", pct < 30);
  $(`arena-${side}-hp-text`).textContent = `${Math.ceil(Math.max(0, hp))} / ${max}`;
}

// Little badges under an HP bar ("🛡️ SHIELD", "💫 DIZZY"). Only redrawn when they change.
export function setBadges(side, badges) {
  const el = $(`arena-${side}-badges`);
  const html = badges.map((b) => `<span class="arena-badge">${b}</span>`).join("");
  if (el.innerHTML !== html) el.innerHTML = html;
}

export function setTimer(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const text = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  if ($("arena-timer").textContent !== text) $("arena-timer").textContent = text;
}

export const setSeeing = (text) => $("arena-seeing").textContent !== text && ($("arena-seeing").textContent = text);

const handPicture = (img, sign) => {
  img.hidden = false;
  img.onerror = () => (img.hidden = true);
  img.src = `assets/hands/${sign}.svg`;
};

// One card per teammate. `onTap(i)` makes teammate i act (the no-sign fallback).
export function buildCards(team, onTap) {
  const box = $("arena-cards");
  box.innerHTML = "";
  team.forEach((member, i) => {
    const b = document.createElement("button");
    b.className = "arena-card";
    b.innerHTML =
      `<span class="arena-card-who">${member.portrait}<b>${member.name}</b></span>` +
      `<span class="arena-card-hand-box"><img class="arena-card-hand" alt=""></span>` +
      `<b class="arena-card-sign"></b><span class="arena-card-move"></span><span class="arena-card-key">${i + 1}</span>`;
    b.onclick = () => onTap(i);
    box.appendChild(b);
  });
}

// team: [{ name, sign, move, coolUntil, coolMs, hold }]
export function renderCards(team, now) {
  const buttons = $("arena-cards").children;
  team.forEach((member, i) => {
    const b = buttons[i];
    const cooling = now < member.coolUntil;
    const key = `${member.sign}|${member.move.name}`;
    if (b.dataset.key !== key) {
      b.dataset.key = key;
      b.querySelector(".arena-card-sign").textContent = member.sign;
      b.querySelector(".arena-card-move").textContent = `${member.move.icon} ${member.move.name}`;
      handPicture(b.querySelector(".arena-card-hand"), member.sign);
      b.setAttribute("aria-label", `${member.name}: sign ${member.sign} for ${member.move.name}, or tap`);
    }
    b.classList.toggle("cooling", cooling);
    b.disabled = cooling;
    b.style.setProperty("--cool", cooling ? (member.coolUntil - now) / member.coolMs : 0);
    b.style.setProperty("--hold", cooling ? 0 : member.hold);
  });
}

// The word to fingerspell for a team combo: done letters lit, the next one
// with its hand picture.
export function renderWord(word, done, hold) {
  const box = $("arena-word");
  const key = `${word}|${done}`;
  if (box.dataset.key !== key) {
    box.dataset.key = key;
    box.querySelector(".arena-word-letters").innerHTML = [...word]
      .map((l, i) => `<span class="arena-word-letter${i < done ? " done" : i === done ? " next" : ""}">${l}</span>`)
      .join("");
    const next = word[done];
    const img = box.querySelector(".arena-word-hand");
    if (next) handPicture(img, next);
    else img.hidden = true;
  }
  box.style.setProperty("--hold", hold);
}

export function setDash(ready) {
  $("arena-dash").classList.toggle("cooling", !ready);
}

// A floating number or word at an arena position (game pixels).
// kind: "dmg", "weak", "crit", "hurt", "heal", "info".
export function pop(text, x, y, kind = "dmg") {
  const el = document.createElement("span");
  el.className = `arena-pop ${kind}`;
  el.textContent = text;
  el.style.left = `${(x / ARENA_W) * 100}%`;
  el.style.top = `${(y / ARENA_H) * 100}%`;
  el.style.setProperty("--drift", `${(Math.random() - 0.5) * 40}px`);
  $("arena-pops").appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

// A big banner across the middle ("HEX BROKEN!").
export function banner(text, kind = "") {
  const el = document.createElement("div");
  el.className = `arena-banner ${kind}`;
  el.textContent = text;
  $("arena-pops").appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

export function clearPops() {
  $("arena-pops").innerHTML = "";
}
