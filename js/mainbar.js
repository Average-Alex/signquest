// The main bar along the bottom: Map, Book, Hero, Shop, Friends (the Arena,
// where other players are), Settings, and a Menu (title screen, teach the
// camera). It shows on the map, in the zones, and on the screens it opens,
// and puts you back where you were (the zone you were walking in) when you
// close the Book or the Hero screen.

import { openCalibration } from "./calibrate.js";
import { currentZone } from "./biome.js";
import { isShowing, openBook, openHeroMaker, show } from "./screens.js";

const $ = (id) => document.getElementById(id);
// (In a zone too, floating over the full-screen view.)
const BAR_SCREENS = ["map", "biome", "shop", "book", "hero", "arena", "settings"];
const ACTIVE = { map: "map", biome: "map", book: "book", hero: "hero", shop: "shop", arena: "friends", settings: "settings" };

// Where to go back to: the zone you were in, or the map.
let base = "map";
const goBack = () => (base === "biome" && currentZone() !== null ? show("biome") : show("map"));

function where() {
  if (isShowing("biome")) base = "biome";
  else if (isShowing("map")) base = "map";
}

const actions = {
  map: () => show("map"),
  book: () => openBook(goBack),
  hero: () => openHeroMaker(base === "biome" ? "biome" : "map"),
  shop: () => show("shop"),
  friends: () => show("arena"),
  settings: () => show("settings"),
  menu: () => toggleMenu(),
};

function toggleMenu(open = $("main-menu").hidden) {
  $("main-menu").hidden = !open;
  $("main-bar").querySelector('[data-bar="menu"]').setAttribute("aria-expanded", String(open));
  if (open) $("main-menu").querySelector("button")?.focus();
}

for (const button of $("main-bar").querySelectorAll("[data-bar]")) {
  button.onclick = () => {
    where();
    if (button.dataset.bar !== "menu") toggleMenu(false);
    actions[button.dataset.bar]();
  };
}
$("menu-title").onclick = () => {
  toggleMenu(false);
  show("title");
};
$("menu-camera").onclick = () => {
  toggleMenu(false);
  where();
  openCalibration(goBack);
};
$("menu-close").onclick = () => toggleMenu(false);
addEventListener("keydown", (e) => e.key === "Escape" && !$("main-menu").hidden && toggleMenu(false));

// Show the bar on its screens, with the one you're on lit up.
export function updateMainBar(name) {
  const on = BAR_SCREENS.includes(name);
  $("main-bar").hidden = !on;
  document.body.classList.toggle("has-bar", on);
  if (!on) toggleMenu(false);
  for (const button of $("main-bar").querySelectorAll("[data-bar]")) {
    const active = ACTIVE[name] === button.dataset.bar;
    button.classList.toggle("on", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
}
