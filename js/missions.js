// Zone missions: the first time you walk into a zone, someone at the
// entrance tells you about a problem, and you watch it happen (lambs bolt,
// lanterns go out, stars fall...). Then you head off down the zone's three
// branching trails (biome.js carves them) to sort it out, and come back.
// A glowing trail on the ground and an arrow show the way to whatever's next.
//
// Every zone's mission works differently, so none of them feel the same:
//   rescue  - calm something by signing its letter; it follows you home
//   fetch   - pick something up by signing; you carry it (timer: it melts
//             if you take too long, and a fresh one appears where it was)
//   station - needs something you're carrying (`needs`); sign to use it.
//             `consume` uses it up; `follower` frees someone who follows you
//   deliver - give away one of the `item`s you're carrying
//   decoy   - a fake (Coral Lagoon's bottles): signing it shows `note`
//   bell    - rung in the phase's order; ringing the wrong one starts over
//   drift   - wanders around its clearing and drifts away from you; catch it
//
// A mission is a list of phases. A phase is either a set of goals (all
// done, in any order - or in the listed order, with `ordered`), or
// `{ return: true }`: go back to the person who asked. Each goal sits in
// one of the three clearings (`at`: 0, 1, 2) and is signed with `letter`.
// `intro` lines play, then `scatter` (what you see happen: `emoji[k]` flies
// or runs from the giver to clearing k, with the camera following), then
// `afterIntro`. `start.carry`: what the giver hands you when the mission starts. `remind`: what the giver
// says if you come back too soon. Speakers: "giver", "pip", "you".

const npc = (name, hairStyle, hair, skin, outfitStyle, outfit, extra = {}) => ({
  name,
  look: { hairStyle, hair, skin, eyes: extra.eyes || "brown", outfitStyle, outfit, glasses: extra.glasses || "none" },
  hat: extra.hat || null,
});

export const MISSION_COINS = 60;
export const MISSION_XP = 60;

export const MISSIONS = {
  meadow: {
    title: "The Runaway Lambs",
    giver: npc("Shepherd Wren", "short", "brown", "s2", "tunic", "green", { hat: "hat-cap" }),
    intro: [
      ["giver", "Signkeeper! Thank goodness. I was counting my lambs when Malgrath's thunder boomed over the hill..."],
      ["giver", "Look!"],
    ],
    scatter: { emoji: ["🐑", "🐑", "🐑"], style: "run", text: "The lambs bolt down three different trails!" },
    afterIntro: [
      ["giver", "Three lambs, three trails! They're scared stiff. Sign to them gently and they'll calm down."],
      ["pip", "Then they'll follow us home! Let's go. I'll light the way."],
    ],
    phases: [
      {
        goals: [
          { id: "lamb1", kind: "rescue", at: 0, letter: "B", emoji: "🐑", name: "Puff", follower: "🐑" },
          { id: "lamb2", kind: "rescue", at: 1, letter: "C", emoji: "🐑", name: "Clover", follower: "🐑" },
          { id: "lamb3", kind: "rescue", at: 2, letter: "D", emoji: "🐑", name: "Dot", follower: "🐑" },
        ],
      },
      { return: true, lines: [["giver", "Puff! Clover! Little Dot! All three, home safe!"], ["giver", "You've got a way with animals, Signkeeper. Take this, for your trouble."]] },
    ],
    remind: "My lambs are still out there! Follow the glowing trail.",
  },

  forest: {
    title: "Relight the Lanterns",
    giver: npc("Lamplighter Lumi", "long", "white", "s4", "robe", "blue", { eyes: "green" }),
    intro: [
      ["giver", "Shh... do you hear that wind? It's not a normal wind. It's a hex-wind."],
      ["giver", "It's coming for my lanterns!"],
    ],
    scatter: { emoji: ["💨", "💨", "🫙"], style: "fly", text: "The hex-wind snuffs out two trail lanterns, and Lumi's flame jar goes tumbling away!" },
    afterIntro: [
      ["giver", "Without the lanterns, travelers get lost in the glowshrooms forever! And my flame jar rolled off down the far trail."],
      ["giver", "Find the jar first. Then carry its flame to each lantern and sign to light it."],
    ],
    phases: [
      { goals: [{ id: "jar", kind: "fetch", at: 2, letter: "F", emoji: "🫙", name: "the flame jar", item: "🔥" }], after: [["pip", "Got the flame! Now, the lanterns. Careful not to drop it!"]] },
      {
        goals: [
          { id: "lamp1", kind: "station", at: 0, letter: "G", emoji: "🏮", doneEmoji: "💡", name: "the first lantern", needs: "🔥" },
          { id: "lamp2", kind: "station", at: 1, letter: "H", emoji: "🏮", doneEmoji: "💡", name: "the second lantern", needs: "🔥" },
        ],
        after: [["pip", "Both lanterns are glowing! Let's take the flame back to Lumi."]],
      },
      { return: true, lines: [["giver", "Oh, look at them glow! The paths are safe again."], ["giver", "Here, a little something from my lamp shop."]] },
    ],
    remind: "Follow the glowing trail, Signkeeper. The forest is counting on you!",
  },

  caves: {
    title: "Too Hot to Handle",
    giver: npc("Smith Brann", "bald", "black", "s5", "tunic", "orange", { glasses: "round" }),
    intro: [
      ["giver", "Stand back, the forge is about to blow! I keep it cool with frost crystals, but..."],
      ["giver", "Oh no. Not again!"],
    ],
    scatter: { emoji: ["❄️", "❄️", "🔥"], style: "fly", text: "A lava burst flings Brann's frost crystals deep into the canyon!" },
    afterIntro: [
      ["giver", "I need two frost crystals, one at a time. But hurry back with each one: down here, they melt fast!"],
      ["pip", "A race against the heat! The trail will show us the quickest way."],
    ],
    phases: [
      { goals: [{ id: "frost1", kind: "fetch", at: 0, letter: "M", emoji: "❄️", name: "a frost crystal", item: "❄️", timer: 45 }] },
      { return: true, lines: [["giver", "Just in time! Sssss... that's one! Quick, the other one's down another trail!"]] },
      { goals: [{ id: "frost2", kind: "fetch", at: 1, letter: "P", emoji: "❄️", name: "another frost crystal", item: "❄️", timer: 45 }] },
      { return: true, lines: [["giver", "The forge is cooling down! You saved my workshop, Signkeeper."], ["giver", "Take this. Forged it myself!"]] },
    ],
    remind: "The forge is too hot! Bring me a frost crystal, quick, before it melts!",
  },

  river: {
    title: "Message in a Bottle",
    giver: npc("Keeper Marlo", "short", "white", "s3", "tunic", "blue", { hat: "hat-cap" }),
    intro: [
      ["giver", "Ahoy, Signkeeper! I keep the lighthouse, and I keep my secrets in bottles. Including a map to a sunken treasure!"],
      ["giver", "Whoa, big wave!"],
    ],
    scatter: { emoji: ["🍾", "🍾", "🍾"], style: "fly", text: "A huge wave sweeps three bottles off Marlo's shelf and down the shore trails!" },
    afterIntro: [
      ["giver", "Only one of them has my map. The others are just old notes. Here's a clue: I sealed the map with the letter S, for Sunken."],
      ["pip", "Each bottle has a letter on it. Read them carefully... or just check them all!"],
    ],
    phases: [
      {
        goals: [{ id: "map", kind: "fetch", at: 2, letter: "S", emoji: "🍾", name: "the bottle with the map", item: "🗺️" }],
        extras: [
          { id: "note1", kind: "decoy", at: 0, letter: "Q", emoji: "🍾", note: "It's a note: 'Dear diary, the crabs stole my sandwich again.' Not the map!" },
          { id: "note2", kind: "decoy", at: 1, letter: "T", emoji: "🍾", note: "It's a note: 'Shopping list: fish, more fish, a hat.' Not the map!" },
        ],
        after: [["pip", "That's the map! The bottle sealed with S. Let's bring it back to Marlo."]],
      },
      { return: true, lines: [["giver", "My map! X marks the spot. You've got sharp eyes, Signkeeper."], ["giver", "Here's your share of the treasure. Well, part of it."]] },
    ],
    remind: "Remember the clue: the map's bottle is sealed with S!",
  },

  castle: {
    title: "Gilly's Keepsakes",
    giver: npc("Ghost Gilly", "long", "white", "s1", "robe", "silver", { eyes: "gray" }),
    intro: [
      ["giver", "Boo! Oh, sorry, I'm a friendly ghost. I'm Gilly. I've lived here for three hundred years, and I keep my three keepsakes very close."],
      ["giver", "Wait... Malgrath? What are you doing with my... NO!"],
    ],
    scatter: { emoji: ["🎵", "📔", "📿"], style: "fly", text: "Malgrath's hex rips Gilly's keepsakes away and scatters them!" },
    afterIntro: [
      ["giver", "My memory is foggy, but I remember them in order. First my locket, then my music box, and last of all my diary."],
      ["giver", "Bring them back in that order, or they'll slip right through my fingers!"],
    ],
    phases: [
      {
        ordered: true,
        goals: [
          { id: "locket", kind: "fetch", at: 2, letter: "V", emoji: "📿", name: "Gilly's locket", item: "📿" },
          { id: "musicbox", kind: "fetch", at: 0, letter: "W", emoji: "🎵", name: "Gilly's music box", item: "🎵" },
          { id: "diary", kind: "fetch", at: 1, letter: "Y", emoji: "📔", name: "Gilly's diary", item: "📔" },
        ],
        wrongOrder: "This belongs to Gilly, but she remembers the {next} first. Find that one!",
        after: [["pip", "All three, in the right order! Gilly will be so happy."]],
      },
      { return: true, lines: [["giver", "My locket... my music box... my diary! I remember now. I remember everything!"], ["giver", "Thank you, Signkeeper. Please, take this. Ghosts don't need coins."]] },
    ],
    remind: "Remember the order: locket, music box, diary!",
  },

  keep: {
    title: "Royal Invitations",
    giver: npc("Herald Percy", "short", "ginger", "s2", "robe", "red", { hat: "hat-top" }),
    intro: [
      ["giver", "Hear ye! Queen Amara's grand ball is tonight! The messenger birds were just flying off with the invitations, when..."],
      ["giver", "Oh dear. Oh dear, oh dear."],
    ],
    scatter: { emoji: ["🐦", "🐦", "🐦"], style: "fly", text: "The hexed messenger birds fly off in circles, dizzy and lost!" },
    afterIntro: [
      ["giver", "The birds are useless until the hex wears off! Would you deliver the invitations? The three guests live down the three trails."],
      ["giver", "Sign the first letter of each guest's name when you hand it over. It's royal custom!"],
    ],
    start: { carry: ["✉️", "✉️", "✉️"], toast: "🎒 You got 3 royal invitations ✉️!" },
    phases: [
      {
        goals: [
          { id: "clara", kind: "deliver", at: 0, letter: "C", emoji: "💃", name: "Countess Clara", item: "✉️", thanks: "An invitation to the ball? How marvelous!" },
          { id: "rowan", kind: "deliver", at: 1, letter: "R", emoji: "🎩", name: "Lord Rowan", item: "✉️", thanks: "I shall wear my finest cape!" },
          { id: "olive", kind: "deliver", at: 2, letter: "O", emoji: "🌻", name: "Olive the gardener", item: "✉️", thanks: "Me? Invited to the ball? Oh, my!" },
        ],
        after: [["pip", "All delivered! Let's tell Herald Percy."]],
      },
      { return: true, lines: [["giver", "All three delivered? Splendid! The ball shall go on!"], ["giver", "A royal reward, for a royal favor."]] },
    ],
    remind: "There are still invitations in your bag! Follow the trail to the guests.",
  },

  spires: {
    title: "A Frozen Friend",
    giver: npc("Skater Sora", "spiky", "black", "s3", "tunic", "blue", { eyes: "gray" }),
    intro: [
      ["giver", "Pebble! Come back! Pebble's my penguin. We were sliding on the ice, and the aurora flickered purple..."],
      ["giver", "Pebble, look out!"],
    ],
    scatter: { emoji: ["🐧", "🔥"], style: "run", text: "Pebble slides away down a trail, and freezes solid in a block of hexed ice!" },
    afterIntro: [
      ["giver", "Hexed ice won't melt by itself. There's a hot spring down another trail, with warm stones that never cool down."],
      ["pip", "So: get a warm stone, thaw the ice, and bring Pebble home!"],
    ],
    phases: [
      { goals: [{ id: "stone", kind: "fetch", at: 1, letter: "S", emoji: "♨️", name: "a warm stone", item: "🔥" }], after: [["pip", "Toasty! Now to the ice block."]] },
      { goals: [{ id: "ice", kind: "station", at: 0, letter: "T", emoji: "🧊", doneEmoji: "💧", name: "the ice block", needs: "🔥", consume: true, follower: "🐧", freed: "Pebble pops out of the melting ice! Pebble waddles after you." }] },
      { return: true, lines: [["giver", "PEBBLE! You're okay!"], ["giver", "Thank you so much! Pebble says thank you too. That's what the flapping means."]] },
    ],
    remind: "Pebble's still frozen! Follow the trail.",
  },

  clouds: {
    title: "The Storm Bells",
    giver: npc("Bellkeeper Halden", "bald", "white", "s6", "robe", "purple", { glasses: "round" }),
    intro: [
      ["giver", "Up here, three storm bells keep the thunder calm. Rung in the right order, they sing the storm to sleep."],
      ["giver", "But that lightning bolt... hold on to something!"],
    ],
    scatter: { emoji: ["🔔", "🔔", "🔔"], style: "fly", text: "A lightning strike blasts the three bells off the bell tower!" },
    afterIntro: [
      ["giver", "They landed down three trails. Each bell has a letter on it. Ring them in order to spell the word HUG, and the storm will calm down."],
      ["giver", "Ring the wrong one, and you'll have to start over. Good luck!"],
    ],
    phases: [
      {
        ordered: true,
        strict: true,
        goals: [
          { id: "bellH", kind: "bell", at: 1, letter: "H", emoji: "🔔", doneEmoji: "🎶", name: "the H bell" },
          { id: "bellU", kind: "bell", at: 2, letter: "U", emoji: "🔔", doneEmoji: "🎶", name: "the U bell" },
          { id: "bellG", kind: "bell", at: 0, letter: "G", emoji: "🔔", doneEmoji: "🎶", name: "the G bell" },
        ],
        wrongOrder: "BONG! That's not the next letter of H-U-G. The storm rumbles... start again from the H bell!",
        after: [["pip", "H... U... G! Listen, the thunder's going quiet. Let's tell Halden!"]],
      },
      { return: true, lines: [["giver", "Do you hear that? Silence! The storm is asleep."], ["giver", "A hug for the sky. You did it, Signkeeper."]] },
    ],
    remind: "Ring the bells to spell H-U-G, in order!",
  },

  void: {
    title: "Fallen Stars",
    giver: npc("Stargazer Vega", "long", "black", "s5", "robe", "purple", { eyes: "green" }),
    intro: [
      ["giver", "Welcome to the Rift, Signkeeper. I map the stars from here. Every one of them has a place."],
      ["giver", "Oh no. They're falling!"],
    ],
    scatter: { emoji: ["⭐", "⭐", "⭐"], style: "fly", text: "Three stars fall out of the sky map and go drifting down the star paths!" },
    afterIntro: [
      ["giver", "Fallen stars are shy. They drift away when you get close. Corner one, then sign to it, and it'll come with you."],
      ["pip", "Star catching! This is the best mission ever."],
    ],
    phases: [
      {
        goals: [
          { id: "star1", kind: "drift", at: 0, letter: "L", emoji: "⭐", name: "a fallen star", item: "⭐" },
          { id: "star2", kind: "drift", at: 1, letter: "Q", emoji: "⭐", name: "a fallen star", item: "⭐" },
          { id: "star3", kind: "drift", at: 2, letter: "Z", emoji: "⭐", name: "a fallen star", item: "⭐" },
        ],
        after: [["pip", "Three stars! Let's take them back to Vega."]],
      },
      { return: true, lines: [["giver", "There you are, little ones. Back in your places."], ["giver", "The sky is whole again. Take this, Signkeeper. Stardust!"]] },
    ],
    remind: "The stars are still out there, drifting. Follow the trail!",
  },
};
