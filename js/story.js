// The story: SignQuest - The Shattered Beacon.
//
// Long ago the Great Beacon lit the land with Signlight, the magic that flows
// through signing hands. Malgrath the Hollow King shattered it into 8 Beacon
// Shards, and every creature a shard touched became Hexbound. You're the last
// apprentice of the Signkeeper Academy. With Pip - a fox-moth who turns out
// to be the Beacon's own spirit - you sign to break the hexes, free the
// creatures, and win back a shard from each zone's boss. The last one is
// Malgrath himself, in the Void Rift.
//
// Scenes play as dialogue boxes, once each: the intro, the first time you
// enter each zone, before each boss, and after each boss (a shard, and one of
// Pip's memories coming back). `{name}` is replaced with the player's name.

import * as progress from "./progress.js";
import { ROOK } from "./quests.js";
import { creatureImg, heroImg } from "./sprites.js";

const $ = (id) => document.getElementById(id);

const SPEAKERS = {
  narrator: { name: "", art: () => `<span class="story-scroll" aria-hidden="true">📜</span>` },
  pip: { name: "Pip", art: () => creatureImg("pip") },
  malgrath: { name: "Malgrath", art: () => creatureImg("malgrath") },
  rook: { name: "Rook", art: () => heroImg(ROOK.look, ROOK.hat) },
  you: { name: () => progress.get().name || "You", art: () => heroImg(progress.get().look, progress.get().equipped.hat) },
};

const SCENES = {
  intro: [
    ["narrator", "Long ago, the Great Beacon lit up the whole land. Its magic was called Signlight, and it flowed through the hands of people who sign."],
    ["narrator", "The greatest signers were the Signkeepers. They could shape Signlight into shields, bridges, and spells."],
    ["narrator", "Then Malgrath the Hollow King broke free. In one night, he shattered the Beacon into 8 Beacon Shards."],
    ["narrator", "Wherever a shard fell, creatures became Hexbound: wild, grumpy, and glowing purple."],
    ["pip", "Psst! Down here! I'm Pip. You're from the Signkeeper Academy, right? The last apprentice who got out?"],
    ["pip", "Then you know the old magic! When you sign, the hex cracks. Free a Hexbound creature and it'll want to join your team."],
    ["pip", "Every big spell needs energy, and signing is what charges it. The more you sign, the stronger you get!"],
    ["pip", "The first shard fell in the Meadow. Come on, {name}, let's go get it. I'll fight right beside you!"],
  ],

  // The first time you walk into each zone.
  "zone-meadow": [
    ["pip", "This is the Meadow. See the creatures glowing purple? That's the hex. Bump into one and sign to break it!"],
    ["pip", "Locked gates block the path. The people who live here can open them. Look for anyone with a ❗ over their head and help them out!"],
    ["pip", "At the very top, the Croak King is guarding our first Beacon Shard."],
  ],
  "zone-forest": [
    ["pip", "The Forest is so dark without the Beacon. Professor Hoot used to teach young Signkeepers here."],
    ["pip", "Now he's Hexbound too. Let's find him and bring him back."],
  ],
  "zone-caves": [
    ["pip", "Listen. The Caves echo every sign. Count Flap is hiding a shard deep inside."],
    ["pip", "Careful, the creatures here are tougher. Save up energy for your big spells!"],
  ],
  "zone-river": [
    ["pip", "The River used to sparkle with Signlight. Now look at it, all dull and gray."],
    ["pip", "Inkzilla dragged a shard under the waterfall. We'll need a strong team for this one."],
  ],
  "zone-castle": [
    ["pip", "The Signkeeper Academy... your old school. It's in ruins."],
    ["pip", "Blaze, the Academy's guardian dragon, has the last shard on the island. He used to protect everyone here."],
  ],
  "zone-spires": [
    ["pip", "Whoa... the Starfall Realm! Three shards flew all the way here through the portal."],
    ["pip", "It's so cold. These creatures are stronger than anything on the island. Malgrath must be close."],
  ],
  "zone-clouds": [
    ["pip", "The Cloud Kingdom floats right above the Void Rift. I can feel Malgrath watching us."],
    ["malgrath", "Turn back, little Signkeeper. Your signs are no match for a storm."],
    ["pip", "Don't listen to him, {name}. The Storm Owl has the next shard!"],
  ],
  "zone-void": [
    ["malgrath", "So. You came all the way to my Rift."],
    ["malgrath", "Every creature here is mine. Every one of them will stand in your way."],
    ["pip", "One more shard, {name}. Malgrath has it. We can do this!"],
  ],

  // Just before each boss fight.
  "boss-frog": [["pip", "There's the Croak King! The shard is making his hex extra strong. Charge up and use your big spells!"]],
  "boss-owl": [
    ["pip", "Professor Hoot! It's us! ...He doesn't remember."],
    ["pip", "Let's break the hex and bring him back!"],
  ],
  "boss-bat": [
    ["malgrath", "You think a few signs can stop ME? Count Flap, crush them!"],
    ["pip", "Ignore him. Keep signing!"],
  ],
  "boss-octopus": [["pip", "Inkzilla! Watch out for the ink. Pick buddies with shields or heals for this one."]],
  "boss-dragon": [
    ["malgrath", "The Academy is MINE now. And so is its dragon."],
    ["pip", "Blaze, please remember us!"],
  ],
  "boss-icewyrm": [["pip", "The Glacier Wyrm! Stay warm and keep signing!"]],
  "boss-stormowl": [["malgrath", "Last warning. Turn back, or the storm takes you."]],
  "boss-malgrath": [
    ["malgrath", "I was the greatest Signkeeper who ever lived. And I will take ALL the Signlight for myself!"],
    ["pip", "Signlight is for everyone. That's the whole point!"],
    ["pip", "{name}, this is it. Every sign you've learned, right now!"],
  ],

  // After each boss: a shard, and one of Pip's memories comes back.
  "shard-meadow": [
    ["pip", "You did it! The Croak King is free, and you found a Beacon Shard! That's 1 of 8!"],
    ["pip", "Whoa... when the shard glowed, I remembered something. A tall tower made of light. I think I've been there before."],
  ],
  "shard-forest": [
    ["pip", "Shard 2! Professor Hoot is himself again!"],
    ["pip", "And I remember... voices. Lots of kids signing and laughing. The Academy!"],
  ],
  "shard-caves": [
    ["pip", "Shard 3!"],
    ["pip", "I remember Malgrath's face now. He was holding the Beacon, and it started to crack."],
  ],
  "shard-river": [
    ["pip", "Shard 4! We're halfway there!"],
    ["pip", "I remember falling. A tiny piece of light, falling through the night sky..."],
  ],
  "shard-castle": [
    ["pip", "Shard 5! Blaze is free, and the Academy is ours again!"],
    ["pip", "I remember Malgrath now. He was a Signkeeper here, long ago. He wanted all the Signlight for himself."],
    ["rook", "And the last 3 shards flew through a portal. Robin is somewhere on the other side. Look at the map!"],
  ],
  "shard-spires": [["pip", "Shard 6! Now that I remember who I am, I can feel the last shards calling me."], ["rook", "Two more. Hang on, Robin."]],
  "shard-clouds": [["pip", "Shard 7! Only one left, and Malgrath has it. He's waiting at the top of the Void Rift."], ["rook", "With Robin. Let's go."]],
  "shard-void": [
    ["narrator", "With your last sign, the hex around Malgrath shatters. He shrinks into a shadow and is sealed away."],
    ["pip", "All 8 shards! Hold them up, {name}!"],
    ["narrator", "The shards fly together. The Great Beacon shines again, and Signlight flows across both worlds."],
    ["rook", "ROBIN! The hex is gone! She's okay, {name}! She's okay!"],
    ["pip", "You did it, Signkeeper. Every creature is free, because you learned to sign."],
    ["narrator", "But far across the stars, one tiny light flickers on..."],
    ["narrator", "To be continued?"],
  ],
};

let playing = null; // { lines, index, onDone }

// Plays a scene once (later calls skip straight to onDone). Pass
// { replay: true } to play it again anyway.
export function playScene(id, onDone = () => {}, { replay = false } = {}) {
  if (!SCENES[id] || (progress.storySeen(id) && !replay)) return onDone();
  progress.markStorySeen(id);
  playing = { lines: SCENES[id], index: 0, onDone };
  $("story").hidden = false;
  showLine();
  $("story-next").focus();
}

export const sceneIds = () => Object.keys(SCENES);

// Plays any lines, any time (villagers talking, for example). A speaker can
// be a SPEAKERS key or an object { name, art: () => html }.
export function playLines(lines, onDone = () => {}) {
  playing = { lines, index: 0, onDone };
  $("story").hidden = false;
  showLine();
  $("story-next").focus();
}

function showLine() {
  const [who, text] = playing.lines[playing.index];
  const speaker = typeof who === "string" ? SPEAKERS[who] : who;
  const name = typeof speaker.name === "function" ? speaker.name() : speaker.name;
  $("story-portrait").innerHTML = speaker.art();
  $("story-portrait").className = `story-portrait ${typeof who === "string" ? who : "npc"}`;
  $("story-name").textContent = name;
  $("story-name").hidden = !name;
  $("story-text").textContent = text.replaceAll("{name}", progress.get().name || "Signkeeper");
  const last = playing.index === playing.lines.length - 1;
  $("story-next").textContent = last ? "Let's go! ▶" : "Next ▶";
  // Restart the little fade-in.
  $("story-text").classList.remove("in");
  void $("story-text").offsetWidth;
  $("story-text").classList.add("in");
}

function next() {
  if (!playing) return;
  playing.index++;
  if (playing.index < playing.lines.length) return showLine();
  end();
}

function end() {
  const { onDone } = playing;
  playing = null;
  $("story").hidden = true;
  onDone();
}

$("story-next").onclick = next;
$("story-skip").onclick = () => playing && end();
addEventListener("keydown", (e) => {
  if (!playing || (e.key !== "Enter" && e.key !== " ")) return;
  if (e.target === $("story-next") || e.target === $("story-skip")) return; // the button handles its own click
  e.preventDefault();
  next();
});

export const isStoryPlaying = () => Boolean(playing);
