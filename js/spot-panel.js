// "Spot the sign": a few characters each sign a letter (their hand picture),
// and you tap the one signing the letter you're asked for. It practices
// reading signs, not just making them, and needs no camera.

import { TIPS } from "./config.js";
import { announce } from "./screens.js";

const $ = (id) => document.getElementById(id);
const shuffle = (list) => [...list].sort(() => Math.random() - 0.5);

// people: [{ name, art (HTML) }], at least 3. letters: the letters to quiz
// (the zone's). rounds: how many questions. onDone: called after the last.
export function openSpotPanel({ title, people, letters, rounds = 2, onDone }) {
  let round = 0;
  const panel = $("spot-panel");
  $("spot-title").innerHTML = title;
  panel.hidden = false;

  const ask = () => {
    const choices = shuffle(letters).slice(0, Math.min(3, letters.length));
    const answer = choices[Math.floor(Math.random() * choices.length)];
    const cast = shuffle(people).slice(0, choices.length);
    $("spot-question").innerHTML = `Who is signing <b>${answer}</b>?`;
    $("spot-status").textContent = "";
    $("spot-status").className = "status";
    const box = $("spot-choices");
    box.innerHTML = "";
    choices.forEach((letter, i) => {
      const b = document.createElement("button");
      b.className = "spot-choice";
      b.innerHTML = `<span class="spot-who">${cast[i].art}<b>${cast[i].name}</b></span><img class="spot-hand" src="assets/hands/${letter}.svg" alt="${cast[i].name}'s hand">`;
      b.setAttribute("aria-label", `${cast[i].name}`);
      b.onclick = () => {
        if (letter === answer) {
          b.classList.add("right");
          $("spot-status").textContent = `Yes! ${cast[i].name} is signing ${answer}. 🎉`;
          $("spot-status").className = "status good";
          announce(`Yes! That's ${answer}.`);
          for (const other of box.children) other.disabled = true;
          setTimeout(() => (++round < rounds ? ask() : close()), 1100);
        } else {
          b.classList.add("wrong");
          b.disabled = true;
          $("spot-status").textContent = `Not quite. That one is ${letter}. Look again: ${TIPS[answer]}`;
          announce(`Not quite, that's ${letter}. Try another one.`);
        }
      };
      box.appendChild(b);
    });
    announce(`Who is signing ${answer}? Tap them.`);
  };
  const close = () => {
    panel.hidden = true;
    onDone();
  };
  ask();
}
