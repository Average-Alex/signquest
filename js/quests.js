// Quests and story events: each zone is a chapter of the main story.
//
// Malgrath shattered the Great Beacon. Each zone's boss swallowed one Beacon
// Shard's light, and the villagers' quests lead you to it. Along the way,
// story `events` happen as you walk into new areas: Malgrath appears and
// sends hexed creatures to ambush you, Rook (a rival Signkeeper collecting
// shards for Malgrath) challenges you, and Pip starts to remember who it is.
//
// Rook's arc: he fights you in the Glowshroom Forest and the Coral Lagoon.
// Then Malgrath reveals he's holding Rook's little sister Robin hexed. At the
// Academy in Haunted Hollow, Rook gives up fighting you and joins your side,
// all the way to the Cosmic Rift.
//
// Zone ids are save keys from before the worlds were redone: forest is the
// Glowshroom Forest, caves Magma Canyon, river Coral Lagoon, castle Haunted
// Hollow, spires Aurora Glacier, clouds Thunder Peaks, and void the Cosmic Rift.
//
// Each area (except the boss's, at the top) has a villager with a quest.
// Each zone mixes them up (never the same kind twice in a row), and ends
// with the gate guard, a mini-boss before the boss. Quest types:
//   learn   - the giver shows you a sign (`word`), and you copy it
//   convo   - a signed conversation: they ask, you answer with a sign
//             (`qa`: [[lines asking, answer, short question], ...])
//   spot    - spot the sign: tap who's signing the letter they ask for
//             (reading signs, not just making them; `rounds` questions)
//   chase   - a runaway `critter` runs from you; catch it and sign to calm it
//   collect - find `count` sign cards hidden in this area (sign each one)
//   free    - free `count` hexed creatures in this area, then come back
//   find    - find a lost item hidden in this area (sign a letter to pick it
//             up), then bring it back
//   riddle  - answer a riddle by fingerspelling `word` (one of the zone's words)
//   deliver - take an item from the quest giver to `to`, another villager here
//   guard   - beat the hexed gate guard (a word battle, which opens the boss)
//
// `folk`: townsfolk who wander about and chat.
//
// Event types (play once, the first time you walk into `area`):
//   malgrath - he appears, says `lines`, then sends a hexed `creature` at you
//   rook     - Rook appears and challenges you to a battle with his `creature`
//   talk     - just a scene (Pip remembering, Rook joining you, ...)
// `after` lines play once the event (and any battle) is over. `phase2` lines
// play in the middle of the boss battle, when the boss surges with dark power.
//
// Lines are [speaker, text]: a villager id from `npcs`, "pip", "malgrath",
// "rook", or "you". Villagers are drawn with the hero maker (sprites.js
// LOOK_OPTIONS), minus the wand. `{name}` is the player's name.

const npc = (name, hairStyle, hair, skin, outfitStyle, outfit, extra = {}) => ({
  name,
  look: { hairStyle, hair, skin, eyes: extra.eyes || "brown", outfitStyle, outfit, glasses: extra.glasses || "none" },
  hat: extra.hat || null,
});

// Townsfolk: people who wander around each zone and stop for a chat.
const folk = (name, hairStyle, hair, skin, outfitStyle, outfit, extra, lines) => ({ ...npc(name, hairStyle, hair, skin, outfitStyle, outfit, extra), lines });

// Rook, the rival. He's drawn like a villager but carries a wand (he's a Signkeeper too).
export const ROOK = { name: "Rook", look: { hairStyle: "spiky", hair: "black", skin: "s3", eyes: "gray", outfitStyle: "robe", outfit: "black", glasses: "none" }, hat: null, wand: true };

// Queen Amara of Crown Keep: Deaf, and the very first Signkeeper. She found
// that Signlight flows through signing hands, and built the Great Beacon on
// her castle's tallest tower.
export const QUEEN = npc("Queen Amara", "long", "black", "s5", "robe", "purple", { eyes: "brown", hat: "hat-crown" });

export const QUESTS = {
  meadow: {
    npcs: {
      fern: npc("Farmer Fern", "bun", "ginger", "s3", "tunic", "green", { hat: "hat-cap" }),
      milo: npc("Milo", "spiky", "brown", "s5", "tunic", "orange"),
      gus: npc("Gatekeeper Gus", "bald", "black", "s2", "robe", "silver", { glasses: "round", hat: "hat-top" }),
      nana: npc("Nana Bea", "bun", "white", "s4", "robe", "pink", { glasses: "round" }),
      bo: npc("Grandpa Bo", "short", "white", "s6", "tunic", "blue"),
      ivy: npc("Scout Ivy", "long", "blonde", "s1", "tunic", "red", { eyes: "green" }),
    },
    folk: [
      folk("Kite Kid Tam", "spiky", "ginger", "s2", "tunic", "orange", {}, ["Did you know? Lots of Deaf kids learn ASL as their first language!", "My kite got stuck in the purple fog. I'll wait till it clears."]),
      folk("Beekeeper Lu", "bun", "blonde", "s4", "robe", "green", { hat: "hat-cap" }, ["The bees don't like the hex either. They buzz in circles.", "In ASL, you can sign FARM by brushing your chin. Neat, right?"]),
      folk("Old Hob", "bald", "white", "s5", "tunic", "blue", { glasses: "round" }, ["When I was a boy, the Beacon lit up the whole sky.", "Sign slowly and clearly. Fast isn't always better!"]),
      folk("Daisy", "long", "brown", "s3", "robe", "pink", {}, ["I'm picking flowers for Nana Bea. Want one?", "Fingerspelling is how you sign names and new words."]),
    ],
    steps: [
      {
        type: "learn", npc: "fern", word: "A", title: "Learn your first sign with Farmer Fern",
        start: [["fern", "A Signkeeper! Oh, thank goodness. A Beacon Shard crashed into Sprout Pond, and the Croak King swallowed its light."], ["fern", "My grandma taught me some signs. Hexes hate signing! Let me show you the letter A. Make a fist, with your thumb on the side."]],
        done: [["fern", "That's it! A, for A Signkeeper! The Croak King lives at the top of the meadow, by the old pond. Go through my garden."]],
      },
      {
        type: "find", npc: "milo", item: "Milo's kite", title: "Find Milo's kite",
        start: [["milo", "My kite flew right over Sprout Pond when the shard fell! I drew a map on it. Then the purple fog blew it away."], ["pip", "A map to the pond? We need that kite!"]],
        done: [["milo", "My kite! See the map? The pond is past Gatekeeper Gus. Good luck!"]],
      },
      {
        type: "riddle", npc: "gus", word: "CAB", title: "Remember Gus's lost password",
        start: [["gus", "Malgrath's fog made me forget my own gate's password! Only a real Signkeeper can sign it back."], ["gus", "The old Signkeepers wrote it as a riddle: what do you call a taxi? Sign it!"]],
        done: [["gus", "C-A-B! It's all coming back to me. Welcome back, Signkeeper."]],
      },
      {
        type: "spot", npc: "nana", prompt: "Nana Bea's signing game!", rounds: 2, title: "Play Nana Bea's signing game",
        start: [["nana", "Grandpa Bo knows how to get past the Croak King's guards. But first, a little game!"], ["nana", "My friends will each sign a letter. You tell me who's signing the one I ask for. Watch their hands!"]],
        done: [["nana", "Sharp eyes! Bo says the king's last guard sleeps by the top gate. Scout Ivy's been watching it."]],
      },
      {
        type: "guard", npc: "ivy", title: "Beat the Croak King's gate guard",
        start: [["ivy", "Malgrath hexed this guard himself. It's the last thing between you and the Croak King."], ["ivy", "Beat it, and the shard is right there!"]],
        done: [["ivy", "You did it! The Croak King is just ahead. Go get that shard!"]],
      },
    ],
    events: [
      {
        area: 1, type: "malgrath", creature: "puddlepup",
        lines: [["malgrath", "So. The last little apprentice."], ["malgrath", "That shard in the pond is MINE. You'll never reach it."], ["malgrath", "Hexlings! Get them!"]],
        after: [["pip", "That was Malgrath! He's the one who shattered the Beacon."], ["pip", "We have to get to that shard before he does!"]],
      },
      {
        area: 3, type: "talk",
        lines: [["pip", "Do you feel that? The air is buzzing. The shard must be close."], ["pip", "It's funny... every time we get near one, I feel a little warmer. Like I'm waking up."]],
      },
    ],
    phase2: [["malgrath", "Croak King! Use the shard's power! CRUSH THEM!"], ["pip", "He's getting stronger! Watch for his big attacks!"]],
  },

  forest: {
    npcs: {
      rowan: npc("Ranger Rowan", "long", "brown", "s4", "tunic", "green", { eyes: "green" }),
      sam: npc("Sam", "curly", "black", "s6", "robe", "blue", { glasses: "round" }),
      lena: npc("Lena", "long", "blonde", "s1", "robe", "purple", { eyes: "blue" }),
      pippa: npc("Pippa the Baker", "bun", "brown", "s2", "tunic", "pink"),
      wes: npc("Woodcutter Wes", "short", "ginger", "s3", "tunic", "red", { hat: "hat-cap" }),
      hazel: npc("Hazel", "bun", "purple", "s5", "robe", "teal"),
    },
    folk: [
      folk("Camper Nico", "short", "black", "s5", "tunic", "green", {}, ["The owls stopped hooting when the hex came.", "Keep your hand where the camera can see it, and the magic works better!"]),
      folk("Mushroom Maya", "curly", "brown", "s3", "robe", "orange", {}, ["Every mushroom here glows. The hexed ones glow PURPLE.", "Practice a little every day. That's how my brother learned to sign!"]),
      folk("Woodsman Abe", "short", "ginger", "s2", "tunic", "red", { hat: "hat-cap" }, ["Watch your step, the roots are tricky here.", "Deaf people have their own culture, with art, stories, and jokes!"]),
      folk("Robin's Friend Pia", "bun", "black", "s4", "tunic", "teal", {}, ["Have you seen Robin? She had a black robe like her big brother.", "I hope Robin is okay..."]),
    ],
    steps: [
      {
        type: "chase", npc: "rowan", critter: "mossnout", title: "Catch the mossnout who took Rowan's lantern",
        start: [["rowan", "The second shard hit the Owlery, up in the biggest glowshroom, where Professor Hoot teaches signing. He's hexed now, and his students are lost among the mushrooms."], ["rowan", "And a cheeky mossnout just ran off with my glow lantern! Catch him, and sign to calm him down?"]],
        done: [["rowan", "My lantern! And the little guy says sorry. The students ran toward the Owlery. Follow the trail."]],
      },
      {
        type: "riddle", npc: "sam", word: "BIKE", title: "Prove you're a Signkeeper to Sam",
        start: [["sam", "Are you a real Signkeeper? Professor Hoot says a real one can answer any riddle with their hands."], ["sam", "What has two wheels and pedals? Sign it!"]],
        done: [["sam", "B-I-K-E! You ARE a Signkeeper! Lena knows how to help the Professor. She's up ahead."]],
      },
      {
        type: "collect", npc: "lena", count: 3, title: "Gather the pages of Professor Hoot's spellbook",
        start: [["lena", "Professor Hoot's spellbook burst open when the hex hit. The Signkeeper Oath is in there!"], ["lena", "Three pages blew around this part of the glowing woods. Each one has a sign on it. Can you collect them?"]],
        done: [["lena", "All three pages! Here, the Oath is on the first one. Now go save the Professor!"]],
      },
      {
        type: "deliver", npc: "pippa", to: "wes", item: "a basket of muffins", title: "Bring Pippa's muffins to Woodcutter Wes",
        start: [["pippa", "Wes has been chopping through Malgrath's hexed vines all night to reach the Owlery. Bring him these muffins?"]],
        done: [["wes", "Muffins! Just what I needed. One more chop... there! The way to the Owlery is clear."]],
      },
      {
        type: "guard", npc: "hazel", title: "Beat the Owlery's gate guard",
        start: [["hazel", "A boy in a black robe went past here! He said he was taking the Owlery's shard."], ["hazel", "The gate guard is still hexed, so he couldn't get through. Beat it before he comes back!"]],
        done: [["hazel", "The guard is free! Professor Hoot is just ahead. Hurry!"]],
      },
    ],
    events: [
      {
        area: 1, type: "rook", creature: "batcat",
        lines: [["rook", "Hey! Hold it right there."], ["rook", "So you're the last apprentice everyone's whispering about. I'm Rook."], ["rook", "That shard in the Owlery is mine. Let's see how good you really are!"]],
        after: [["rook", "Tch. Lucky. This isn't over, apprentice."], ["pip", "Who WAS that? Why would a Signkeeper want the shards?"]],
      },
      {
        area: 3, type: "malgrath", creature: "shroomlet",
        lines: [["malgrath", "Reading old spellbooks? How sweet."], ["malgrath", "The Owlery belongs to me now. Spores, smother them!"]],
        after: [["pip", "His hex gets stronger the closer we get to a shard. We have to hurry!"]],
      },
    ],
    phase2: [["malgrath", "Hoot, you old fool! Use the shard! FIGHT!"], ["pip", "Professor, it's us! Remember your students!"]],
  },

  caves: {
    npcs: {
      mo: npc("Miner Mo", "short", "black", "s3", "tunic", "orange", { hat: "hat-cap" }),
      pete: npc("Old Miner Pete", "bald", "white", "s2", "tunic", "silver", { glasses: "round" }),
      kit: npc("Kit", "spiky", "blue", "s5", "tunic", "teal"),
      carla: npc("Crystal Carla", "long", "purple", "s1", "robe", "purple", { eyes: "purple" }),
      lou: npc("Lamplighter Lou", "curly", "brown", "s6", "robe", "black"),
      dot: npc("Dot", "bun", "pink", "s4", "tunic", "red"),
    },
    folk: [
      folk("Tunnel Tess", "short", "brown", "s4", "tunic", "orange", { hat: "hat-cap" }, ["My boots melted a little on the lava rocks. Worth it!", "In loud mines, workers use hand signs too!"]),
      folk("Gem Polisher Gil", "bald", "black", "s6", "robe", "silver", { glasses: "round" }, ["This obsidian hums when someone signs nearby.", "M, N, and S look a lot alike. Watch where the thumb goes!"]),
      folk("Little Ozzy", "spiky", "blonde", "s1", "tunic", "blue", {}, ["I'm not scared of the dark! ...Okay, a little.", "Magmaw lives in the volcano at the top. Be careful!"]),
      folk("Granny Gem", "bun", "white", "s3", "robe", "purple", {}, ["My grandson Kit is somewhere in this canyon.", "A smile is part of signing too. Faces matter in ASL!"]),
    ],
    steps: [
      {
        type: "free", npc: "mo", count: 2, title: "Take back the canyon mine",
        start: [["mo", "The third shard fell into the volcano at the end of Magma Canyon. Magmaw woke up hexed, and his lava critters chased us miners out!"], ["mo", "Free 2 of them, and I'll open the mine gate."]],
        done: [["mo", "The canyon's safer already! Magmaw is up in the volcano, where the shard landed."]],
      },
      {
        type: "spot", npc: "pete", prompt: "Old Pete's door code", rounds: 2, title: "Help Pete read the door code",
        start: [["pete", "Heh. This door was built by Signkeepers. It opens when you point out the right signer."], ["pete", "My old crew will each sign a letter. Tell the door who's signing the one it asks for!"]],
        done: [["pete", "Ha! The old door hasn't opened in years! In you go."]],
      },
      {
        type: "find", npc: "kit", item: "Kit's lantern", title: "Find Kit's lantern",
        start: [["kit", "I dropped my lantern when the ashcrows swooped! The smoke is so thick without it."], ["pip", "My antennae glow a little... but not enough. Let's find that lantern."]],
        done: [["kit", "Light! Thank you! Look, the path splits at the lava falls. The shard's glow is coming from the left!"]],
      },
      {
        type: "convo", npc: "carla", title: "Answer Crystal Carla's questions",
        qa: [
          [[["carla", "Malgrath's ashcrows smashed all the canyon lamps. I can light them again, but I need a Signkeeper's help."], ["carla", "First: what letter does LAMP start with? Sign it!"]], "L", "What letter does LAMP start with?"],
          [[["carla", "Yes! Next: which letter looks like a circle? Hint: all your fingertips touch your thumb."]], "O", "Which letter looks like a circle?"],
          [[["carla", "Last one! The lamps matter most at NIGHT. Sign the letter NIGHT starts with."]], "N", "What letter does NIGHT start with?"],
        ],
        done: [["carla", "The lamps are glowing! Lou can light the way up to Magmaw's volcano now."]],
      },
      {
        type: "guard", npc: "dot", title: "Beat Magmaw's gate guard",
        start: [["dot", "Magmaw is just past this gate. His hexed guard blasts lava at anyone who comes near!"]],
        done: [["dot", "Wow! Magmaw is next. Cool him down!"]],
      },
    ],
    events: [
      {
        area: 1, type: "talk",
        lines: [["pip", "Wait... I know this place. I've been somewhere like this before."], ["pip", "When the Beacon shattered, I fell. Deep, deep down into the dark. Then I woke up next to you."], ["pip", "Let's keep going. I want to remember more."]],
      },
      {
        area: 3, type: "malgrath", creature: "ashcrow",
        lines: [["malgrath", "You chase my shards like a moth chases a flame."], ["malgrath", "And your little friend glows brighter near them, doesn't it? How... interesting."], ["malgrath", "Ashcrows! Swarm them!"]],
        after: [["pip", "Why did he look at me like that, {name}?"], ["pip", "Never mind. Let's just get the shard."]],
      },
    ],
    phase2: [["malgrath", "Magmaw! ERUPT! Bury them in lava!"], ["pip", "It's getting so hot! Keep signing!"]],
  },

  river: {
    npcs: {
      finn: npc("Fisher Finn", "short", "brown", "s4", "tunic", "blue", { hat: "hat-cap" }),
      wren: npc("Wren", "long", "ginger", "s2", "tunic", "teal", { eyes: "green" }),
      cora: npc("Captain Cora", "bun", "black", "s6", "robe", "red", { hat: "hat-top" }),
      tilly: npc("Bridgekeeper Tilly", "curly", "green", "s3", "robe", "orange"),
      sol: npc("Sol", "spiky", "blonde", "s1", "tunic", "pink"),
      ray: npc("Ray", "short", "blue", "s5", "tunic", "silver"),
    },
    folk: [
      folk("Swimmer Bea", "long", "blonde", "s2", "tunic", "teal", {}, ["The water was so clear before the ink.", "R is just two fingers crossed, like you're making a wish!"]),
      folk("Raft Builder Jun", "short", "black", "s4", "tunic", "orange", {}, ["I'm building a raft to follow Inkzilla. Maybe tomorrow.", "Some Deaf people feel music through the floor. Cool, right?"]),
      folk("Fisher Gran", "bun", "white", "s5", "robe", "blue", { glasses: "round" }, ["The fish all hid in the coral.", "Signing T: tuck your thumb between your first two fingers."]),
      folk("Pebble", "curly", "ginger", "s3", "tunic", "green", {}, ["I skip stones! My record is six!", "My cousin is Deaf. We sign under water. It's the best!"]),
    ],
    steps: [
      {
        type: "learn", npc: "finn", word: "S", title: "Learn the sign for S with Fisher Finn",
        start: [["finn", "The fourth shard sank into the deep reef, and Inkzilla turned the whole lagoon gray with hexed ink!"], ["finn", "My boat is called the S.S. Signal. Every lagoon kid learns S first: a fist, with your thumb across the front. Try it!"]],
        done: [["finn", "Strong S! The water's clearing up already. Inkzilla's out at the deep reef, past the shipwreck."]],
      },
      {
        type: "deliver", npc: "wren", to: "cora", item: "a fishing net", title: "Bring Wren's net to Captain Cora",
        start: [["wren", "Captain Cora's boat is the only one that can sail to the deep reef. But Inkzilla shredded her net!"], ["wren", "Can you take her this one?"]],
        done: [["cora", "A new net! Splendid. Once we're through the next gate, I'll sail you out to the reef."]],
      },
      {
        type: "chase", npc: "tilly", critter: "finnow", title: "Catch the finnow stealing Tilly's planks",
        start: [["tilly", "A boy in a black robe tried to cross my bridge this morning. And now a finnow keeps stealing my planks!"], ["tilly", "Catch him, and sign to calm him down. Then my bridge is all yours."]],
        done: [["tilly", "He was just cold and lonely. Cross away! That grumpy boy went along the beach."]],
      },
      {
        type: "find", npc: "sol", item: "Captain Cora's compass", title: "Find the lost compass",
        start: [["sol", "Captain Cora dropped her compass in the reeds. Without it, nobody can find the reef through the ink!"]],
        done: [["sol", "The compass! Look, the needle is pointing right at the reef gate."]],
      },
      {
        type: "guard", npc: "ray", title: "Beat Inkzilla's gate guard",
        start: [["ray", "Inkzilla is just past the reef gate. Its hexed guard is really tough."], ["pip", "Bring your strongest buddies, {name}!"]],
        done: [["ray", "Amazing! Inkzilla is next. The whole lagoon is counting on you!"]],
      },
    ],
    events: [
      {
        area: 1, type: "rook", creature: "shellsnap",
        lines: [["rook", "YOU again! Get out of my way, apprentice."], ["rook", "I NEED that shard. You have no idea what's at stake!"]],
        after: [["rook", "...Fine. You win. But I can't stop. I CAN'T."], ["pip", "He didn't sound mean this time, {name}. He sounded scared."]],
      },
      {
        area: 3, type: "malgrath", creature: "jellybop",
        lines: [["malgrath", "Rook works for ME, little apprentice. Didn't he tell you?"], ["malgrath", "He'll bring me every shard. Or his little sister Robin stays hexed. Forever."], ["malgrath", "Now... jellybops, sting them!"]],
        after: [["pip", "His sister?! THAT'S why Rook is doing this!"], ["pip", "{name}, we have to help them both."]],
      },
    ],
    phase2: [["malgrath", "Inkzilla! Drown them in the dark!"], ["pip", "The ink is everywhere! Use a shield or a heal!"]],
  },

  castle: {
    npcs: {
      juno: npc("Juno", "spiky", "purple", "s4", "robe", "purple", { eyes: "purple" }),
      lyle: npc("Librarian Lyle", "bald", "white", "s1", "robe", "black", { glasses: "round" }),
      ada: npc("Headmaster Ada", "bun", "white", "s5", "robe", "blue", { glasses: "round", hat: "hat-grad" }),
      brick: npc("Coach Brick", "short", "black", "s6", "tunic", "red"),
      nell: npc("Nell", "long", "pink", "s2", "tunic", "teal"),
      rook: { ...ROOK },
    },
    folk: [
      folk("Student Ravi", "short", "black", "s4", "robe", "blue", {}, ["Our classroom is haunted now. Ugh.", "Remember the Signkeeper rule: sign with kindness!"]),
      folk("Student Wen", "bun", "black", "s2", "robe", "purple", { glasses: "round" }, ["I was studying the letter V when it all happened.", "V is a peace sign! Two fingers up and apart."]),
      folk("Janitor Mop", "bald", "brown", "s6", "tunic", "silver", {}, ["Somebody has to sweep up all these cobwebs.", "Y is the hang loose sign. Thumb and pinky out!"]),
      folk("Cook Pat", "curly", "white", "s3", "tunic", "red", { hat: "hat-cap" }, ["Gourdgeist ate all the pumpkin pie. ALL of it.", "W has three fingers up, like a little crown."]),
    ],
    steps: [
      {
        type: "convo", npc: "juno", title: "Catch up with your old classmate Juno",
        qa: [
          [[["juno", "{name}?! You made it out too! I've been hiding in the ruins since that night."], ["juno", "Is it really you? Prove it! Sign the first letter of our school's motto: WE SIGN TOGETHER."]], "W", "First letter of WE SIGN TOGETHER?"],
          [[["juno", "It IS you! Okay, what's the last letter of the alphabet? You have to draw it in the air!"]], "Z", "The last letter of the alphabet?"],
        ],
        done: [["juno", "Just like old times! Malgrath turned our school into a haunted fortress, and Gourdgeist guards the fifth shard. Librarian Lyle is hiding in the library."]],
      },
      {
        type: "find", npc: "lyle", item: "your old spellbook", title: "Find your old spellbook",
        start: [["lyle", "My favorite student! Your spellbook is still somewhere in these ruins."], ["lyle", "Every sign you ever learned is inside. You'll need all of them for Gourdgeist."]],
        done: [["lyle", "There it is! Keep it close. Headmaster Ada is waiting for you upstairs."]],
      },
      {
        type: "riddle", npc: "ada", word: "YAK", title: "Pass Headmaster Ada's test",
        start: [["ada", "You've come so far. A true Signkeeper must pass one last test before facing Gourdgeist."], ["ada", "Which hairy ox lives high in the mountains? Sign it!"]],
        done: [["ada", "Y-A-K. Well done. I always knew you'd be a great Signkeeper. Now go. Someone is waiting for you in the training yard."]],
      },
      {
        type: "spot", npc: "nell", prompt: "Coach Brick's warm-up drill", rounds: 3, title: "Do Coach Brick's warm-up drill",
        start: [["nell", "Coach Brick is guarding the training yard all by himself. He won't let anyone in without his warm-up drill!"], ["nell", "The team signs letters, and you shout out who signed which. Ready?"]],
        done: [["nell", "Coach says you pass! The training yard gate is yours. Oh, and that Rook kid is in there."]],
      },
      {
        type: "guard", npc: "rook", title: "Beat Gourdgeist's gate guard, with Rook",
        start: [["rook", "Gourdgeist's gate guard is hexed. I'll keep the other creatures off you."], ["rook", "Go, partner. For Robin."]],
        done: [["rook", "That's my partner! Now go save Gourdgeist. I'll be right behind you."]],
      },
    ],
    events: [
      {
        area: 1, type: "malgrath", creature: "candlewick",
        lines: [["malgrath", "Welcome home, apprentice. Your little school is MY fortress now."], ["malgrath", "Did you really think you could just walk back in? Candlewicks! Burn them out!"]],
        after: [["pip", "He's turning everything we love against us. We won't let him win!"]],
      },
      {
        area: 3, type: "talk",
        lines: [["rook", "...Wait. Don't. I'm not here to fight."], ["rook", "I can't beat you. And I'm done pretending Malgrath will keep his promise."], ["rook", "He has my little sister, Robin. He said if I brought him every shard, he'd break her hex. He's lying, isn't he?"], ["pip", "He is. But we can save her, Rook. Together."], ["rook", "...Okay. I'm with you. For Robin."]],
      },
    ],
    phase2: [["malgrath", "Gourdgeist! HAUNT THEM!"], ["rook", "Hang in there! Watch out for his Jack o' Doom!"]],
  },

  spires: {
    npcs: {
      nova: npc("Starkeeper Nova", "long", "white", "s5", "robe", "blue", { eyes: "blue" }),
      sven: npc("Sven the Ice Carver", "short", "blonde", "s1", "tunic", "silver"),
      mira: npc("Mira", "bun", "blue", "s3", "robe", "teal"),
      frost: npc("Frost", "spiky", "white", "s2", "tunic", "black"),
      yuki: npc("Yuki", "curly", "pink", "s4", "tunic", "purple"),
      rook: { ...ROOK },
    },
    folk: [
      folk("Skater Lars", "spiky", "white", "s1", "tunic", "blue", {}, ["The ice sings when Signlight touches it.", "Keep your hands warm, signing is easier that way!"]),
      folk("Ice Fisher Ana", "long", "black", "s4", "robe", "teal", { hat: "hat-cap" }, ["I haven't caught a fish since the blizzard.", "E: curl your fingertips down and tuck your thumb under."]),
      folk("Crystal Kid Bo", "short", "blonde", "s2", "tunic", "purple", {}, ["The northern lights make rainbows in the ice.", "Did you know? ASL is different from British Sign Language!"]),
      folk("Elder Svea", "bun", "white", "s5", "robe", "silver", { glasses: "round" }, ["The Wyrm was gentle once. The hex made it cruel.", "Patience, young Signkeeper. Every sign gets easier."]),
    ],
    steps: [
      {
        type: "chase", npc: "nova", critter: "frostfox", title: "Catch the frostfox that froze Nova's telescope",
        start: [["nova", "Travelers from the island? Three shards streaked through our sky that night."], ["nova", "A frostfox froze my telescope solid and skated off! Catch it, and sign to calm it down?"]],
        done: [["nova", "Thank you, Signkeeper. One shard froze inside the Aurora Wyrm's lair, at the top of the glacier."]],
      },
      {
        type: "riddle", npc: "sven", word: "STAR", title: "Answer Sven's ice riddle",
        start: [["sven", "I carve the old Signkeeper riddles into the ice. Answer mine to pass."], ["sven", "What twinkles in the night sky? Sign it!"]],
        done: [["sven", "S-T-A-R. Like the shards that fell from the sky. Pass, friend."]],
      },
      {
        type: "collect", npc: "mira", count: 3, title: "Find the pieces of Mira's star map",
        start: [["mira", "My star map shows the safe path across the glacier. Malgrath's blizzard tore it into three pieces!"]],
        done: [["mira", "My map, all back together! Look, it shows the way to the Wyrm's gate."]],
      },
      {
        type: "convo", npc: "frost", title: "Help Frost send a message to Yuki",
        qa: [
          [[["frost", "My sister Yuki is freezing up ahead, and she can't hear me over the wind. But she can SEE signs!"], ["rook", "...I know how that feels. Let's help."], ["frost", "Sign T, for TEA. I'm bringing her hot tea!"]], "T", "Sign T, for TEA!"],
          [[["frost", "She waved! Now sign S, for SOON."]], "S", "Sign S, for SOON!"],
        ],
        done: [["frost", "She signed back THANK YOU! She'll open the gate for you."]],
      },
      {
        type: "guard", npc: "rook", title: "Beat the Aurora Wyrm's gate guard",
        start: [["rook", "I scouted ahead. The Wyrm froze its shard inside a glacier, and its gate guard is hexed solid."], ["rook", "You take the guard. I'll watch your back."]],
        done: [["rook", "Nice! The Wyrm's lair is right there. Two shards left after this one."]],
      },
    ],
    events: [
      {
        area: 1, type: "malgrath", creature: "frostfox",
        lines: [["malgrath", "You came to MY realm? Bold. And you brought my little traitor, Rook."], ["malgrath", "Frostfoxes! Freeze them where they stand!"]],
        after: [["rook", "Sorry, partner. That one's on me. He's angry I switched sides."], ["pip", "We're a team now. That's what matters."]],
      },
      {
        area: 3, type: "talk",
        lines: [["pip", "{name}... I remember now. Really remember."], ["pip", "I'm not just a fox-moth. I'm the Beacon's spirit. When it shattered, I was the little light that got away."], ["pip", "When all eight shards come back together... I think I'll be whole again."]],
      },
    ],
    phase2: [["malgrath", "Aurora Wyrm! Freeze them SOLID!"], ["rook", "It's charging up! Get ready!"]],
  },

  clouds: {
    npcs: {
      zephyr: npc("Zephyr", "spiky", "white", "s2", "robe", "blue"),
      luna: npc("Princess Luna", "long", "purple", "s5", "robe", "pink", { hat: "hat-crown" }),
      gale: npc("Gale", "short", "blue", "s3", "tunic", "teal"),
      puff: npc("Puff", "curly", "white", "s1", "tunic", "pink"),
      skye: npc("Skye", "bun", "blonde", "s4", "tunic", "blue"),
      thane: npc("Sir Thane", "short", "black", "s6", "tunic", "silver", { hat: "hat-top" }),
    },
    folk: [
      folk("Glider Kit", "spiky", "ginger", "s3", "tunic", "teal", {}, ["I can glide all the way to the next peak!", "Sky sailors invented hand signals because the wind is so loud."]),
      folk("Rain Maker Oona", "long", "purple", "s5", "robe", "blue", {}, ["I make the gentle rain. The Storm Owl makes the angry kind.", "P is like K, but pointing down."]),
      folk("Cloud Baker Bun", "curly", "white", "s2", "tunic", "pink", { hat: "hat-cap" }, ["Cloud bread! It's mostly air, but it's delicious.", "G and H point sideways. G uses one finger, H uses two."]),
      folk("Weather Watcher Wil", "short", "black", "s6", "robe", "silver", { glasses: "round" }, ["The storm gets worse near the nest.", "Q is like G, but pointing down at the ground."]),
    ],
    steps: [
      {
        type: "spot", npc: "zephyr", prompt: "Zephyr's cloud signals", rounds: 2, title: "Read Zephyr's cloud signals",
        start: [["zephyr", "The seventh shard fell into the Storm Owl's nest, and now the whole mountain range is one big storm!"], ["zephyr", "We sky sailors talk with hand signals, since you can't hear anything in a storm. Show me you can read them!"]],
        done: [["zephyr", "A natural! I'll part the clouds for you. Princess Luna can help you reach the nest."]],
      },
      {
        type: "riddle", npc: "luna", word: "RAIN", title: "Answer Princess Luna's riddle",
        start: [["luna", "Welcome to Thunder Peaks. Malgrath's storm has trapped my people. Only a true Signkeeper may pass my gate."], ["luna", "What falls from clouds and makes puddles? Sign it!"]],
        done: [["luna", "R-A-I-N. Wise and brave! Go with my blessing."]],
      },
      {
        type: "deliver", npc: "gale", to: "puff", item: "a bag of sky seeds", title: "Bring Gale's sky seeds to Puff",
        start: [["gale", "Puff grows the cloud bridges, but the storm blew all the seeds away. Without bridges, nobody can reach the nest!"]],
        done: [["puff", "Sky seeds! Watch... a brand new cloud bridge! Go on across!"]],
      },
      {
        type: "collect", npc: "skye", count: 3, title: "Find the bells of Skye's wind chime",
        start: [["skye", "My wind chime calms the storm winds. Malgrath's lightning knocked off all three bells!"]],
        done: [["skye", "All my bells! Listen... the winds are softer already. The nest gate is just ahead."]],
      },
      {
        type: "guard", npc: "thane", title: "Beat the Storm Owl's gate guard",
        start: [["thane", "The Storm Owl guards the seventh shard. Its gate guard was hexed by Malgrath himself."]],
        done: [["thane", "Remarkable! The Storm Owl is next. The whole mountain thanks you."]],
      },
    ],
    events: [
      {
        area: 1, type: "malgrath", creature: "zipsparrow",
        lines: [["malgrath", "Seven shards, apprentice. You have done my work for me."], ["malgrath", "But you won't get the last one. Zipsparrows! Knock them off my peaks!"]],
        after: [["pip", "He's scared. I can feel it. We're getting close!"]],
      },
      {
        area: 3, type: "talk",
        lines: [["malgrath", "Rook. Look who I have."], ["rook", "ROBIN! Let her go!"], ["malgrath", "Bring me the shards, and maybe I will. Choose, Rook."], ["rook", "...I choose my friends. And we're coming for you."], ["pip", "Hold on, Robin! We're almost there!"]],
      },
    ],
    phase2: [["malgrath", "Storm Owl! Bring down the LIGHTNING!"], ["rook", "It's charging! Shield up, partner!"]],
  },

  void: {
    npcs: {
      echo: npc("Echo", "long", "black", "s4", "robe", "black", { eyes: "purple" }),
      vex: npc("Vex", "spiky", "purple", "s2", "tunic", "black"),
      sage: npc("The Last Sage", "bald", "white", "s6", "robe", "purple", { glasses: "round", hat: "hat-grad" }),
      lumi: npc("Lumi", "curly", "white", "s1", "tunic", "teal"),
      kai: npc("Kai", "short", "green", "s5", "tunic", "blue"),
      rook: { ...ROOK },
    },
    folk: [
      folk("Star Child Io", "long", "white", "s1", "robe", "purple", {}, ["I was born out here among the stars. It's not scary to me.", "The Beacon's light can reach even here!"]),
      folk("Drifter Rex", "spiky", "black", "s4", "tunic", "black", {}, ["I got lost here years ago. Signing kept me brave.", "Sign the whole alphabet and you can spell ANY word!"]),
      folk("Moon Monk Tao", "bald", "black", "s5", "robe", "teal", { glasses: "round" }, ["Breathe in. Sign slowly. Breathe out.", "The hexes are weakest when you sign with a calm heart."]),
      folk("Comet Rider Zia", "bun", "pink", "s3", "tunic", "orange", {}, ["Wheee! Oh, hi! I'm surfing on comets!", "You've come so far, Signkeeper. You can do this!"]),
    ],
    steps: [
      {
        type: "free", npc: "echo", count: 2, title: "Help Echo",
        start: [["echo", "You can see me? Malgrath hexed everyone in the Rift. Most of us can't even see each other anymore."], ["echo", "Free 2 of them. Please. Then I'll show you the way in."]],
        done: [["echo", "They remember me now. Thank you. Malgrath's tower is at the very top."]],
      },
      {
        type: "collect", npc: "vex", count: 3, title: "Find the three pieces of the Rift key",
        start: [["vex", "Malgrath broke the key to his tower into three pieces and hid them in this area. Without it, nobody gets any closer."]],
        done: [["vex", "All three pieces! Let's open this thing."]],
      },
      {
        type: "riddle", npc: "sage", word: "QUEST", title: "Answer the Last Sage's riddle",
        start: [["sage", "I am the last of the old Signkeepers. I have waited a long time for you."], ["sage", "Tell me: what do you call a great journey to find something? Sign it!"]],
        done: [["sage", "Q-U-E-S-T. Yes. And yours is almost over. Be brave, child."]],
      },
      {
        type: "chase", npc: "lumi", critter: "voidjelly", title: "Catch the voidjelly that swallowed Lumi's spark",
        start: [["lumi", "Kai is lost in the dark up ahead. I had a spark of Signlight to guide him, but a voidjelly gobbled it up!"], ["lumi", "Catch it, and sign so it lets the spark go?"]],
        done: [["lumi", "The spark! Kai can see again. The tower gate is right here."]],
      },
      {
        type: "guard", npc: "rook", title: "Break through to Malgrath, with Rook",
        start: [["rook", "This is it, partner. Malgrath and Robin are right past this gate."], ["rook", "Beat the guard, and let's end this. Together."]],
        done: [["rook", "We did it. Now let's go get Robin back. And stop him, {name}. For all of us."]],
      },
    ],
    events: [
      {
        area: 1, type: "malgrath", creature: "voidjelly",
        lines: [["malgrath", "So you made it to the Rift. Nobody has made it this far in a thousand years."], ["malgrath", "Voidjellies! Show them the dark between the stars!"]],
        after: [["pip", "Stay close, everyone. The shards are calling me. The last one is right up there."]],
      },
      {
        area: 3, type: "talk",
        lines: [["pip", "{name}, whatever happens up there... thank you. For learning the old signs. For never giving up on me."], ["rook", "Hey. No goodbyes. We're ALL walking out of here. Robin too."], ["pip", "...Right. Let's go!"]],
      },
    ],
    phase2: [["malgrath", "ENOUGH! I will take EVERY last bit of Signlight myself!"], ["rook", "He's at full power! Give it everything you've got!"], ["pip", "Signlight is for everyone. That's what makes it strong!"]],
  },

  // Crown Keep, in the middle of the island. Malgrath sealed Queen Amara in
  // her throne room behind hexed glass, and hexed her royal gryphon Aurelion
  // to guard the keep. The Beacon used to shine from the top of its tower.
  keep: {
    npcs: {
      pim: npc("Page Pim", "short", "ginger", "s2", "tunic", "blue"),
      basil: npc("Cook Basil", "bald", "brown", "s4", "tunic", "silver", { hat: "hat-cap" }),
      sage: npc("Royal Scribe Odette", "bun", "white", "s1", "robe", "teal", { glasses: "round" }),
      iris: npc("Lady Iris", "long", "pink", "s3", "robe", "pink"),
      otto: npc("Guard Otto", "spiky", "black", "s6", "tunic", "silver"),
      hale: npc("Captain Hale", "short", "white", "s5", "tunic", "red", { hat: "hat-top" }),
    },
    folk: [
      folk("Squire Tom", "short", "brown", "s3", "tunic", "red", {}, ["I'm training to be a knight. And a Signkeeper!", "The Queen signs every royal speech in ASL."]),
      folk("Royal Gardener Rose", "bun", "ginger", "s4", "robe", "green", { hat: "hat-cap" }, ["The roses wilted when the Queen was sealed away.", "N: tuck your thumb under two fingers. M: under three!"]),
      folk("Jester Jojo", "curly", "purple", "s2", "tunic", "pink", {}, ["Why did the Signkeeper cross the moat? To get to the other SIGN! Ha!", "O: all your fingertips touch your thumb, like a circle."]),
      folk("Stable Hand Ed", "short", "black", "s6", "tunic", "orange", {}, ["Aurelion the gryphon used to let me feed him apples.", "R: cross your fingers, like you're making a wish."]),
    ],
    steps: [
      {
        type: "learn", npc: "pim", word: "C", title: "Learn the royal C with Page Pim",
        start: [["pim", "A visitor? Nobody's come to Crown Keep since the Beacon broke!"], ["pim", "Every page learns C first: C for CROWN. Curve your hand like the letter C. Your turn!"]],
        done: [["pim", "Perfect! The Queen always said a Signkeeper would come. Go see Cook Basil in the kitchens."]],
      },
      {
        type: "find", npc: "basil", item: "the royal recipe book", title: "Find Cook Basil's recipe book",
        start: [["basil", "Every night I cooked for Queen Amara. Now my recipe book is lost somewhere in the gardens!"], ["basil", "It has her favorite soup in it. I want it ready for when she's free."]],
        done: [["basil", "My book! I'll start the soup right away. The Queen will be so happy."]],
      },
      {
        type: "spot", npc: "sage", prompt: "Odette's royal signing test", rounds: 3, title: "Pass Scribe Odette's royal signing test",
        start: [["sage", "I write down the Queen's history. Did you know she was Deaf? She signed before anyone knew about Signlight."], ["sage", "She noticed her hands glowed when she signed. That's how Signlight was discovered! Now, the royal test: who's signing which letter?"]],
        done: [["sage", "Wonderful! The Queen would be proud of your eyes AND your hands."]],
      },
      {
        type: "deliver", npc: "iris", to: "otto", item: "the castle key", title: "Bring the castle key to Guard Otto",
        start: [["iris", "Guard Otto is holding the tower door shut all by himself. He needs this key to lock the hexed knights out!"]],
        done: [["otto", "The key! Now I can finally rest my arms. Captain Hale is up by the throne room."]],
      },
      {
        type: "guard", npc: "hale", title: "Beat the throne room guard for Captain Hale",
        start: [["hale", "The guard at the throne room door is hexed. Beyond it, Aurelion, the Queen's own gryphon, waits by the tower."], ["hale", "He's not evil. He's hexed. Free him, and the Queen's prison breaks with him."]],
        done: [["hale", "Splendid! Aurelion is just ahead. Be gentle with him, Signkeeper."]],
      },
    ],
    events: [
      {
        area: 1, type: "malgrath", creature: "shieldbug",
        lines: [["malgrath", "Ah, the Queen's little castle. She thought waving her hands around could hold back the dark."], ["malgrath", "Shieldbugs! Show this apprentice how my castle treats guests!"]],
        after: [["pip", "Waving her hands?! Signing is a real language. Queen Amara was Deaf, and she was the greatest Signkeeper ever!"]],
      },
      {
        area: 3, type: "talk",
        lines: [["pip", "{name}, look up! See the empty stand at the top of the tower? That's where the Great Beacon used to shine."], ["pip", "This place feels... familiar. Like I've been up that tower before."]],
      },
    ],
    phase2: [["malgrath", "Aurelion! Remember who your master is NOW!"], ["pip", "Aurelion, it's us! Fight the hex! The Queen needs you!"]],
  },
};
