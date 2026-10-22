// Quests and story events: each zone is a chapter of the main story.
//
// Malgrath shattered the Great Beacon. Each zone's boss swallowed one Beacon
// Shard's light, and the villagers' quests lead you to it. Along the way,
// story `events` happen as you walk into new areas: Malgrath appears and
// sends hexed creatures to ambush you, Rook (a rival Signkeeper collecting
// shards for Malgrath) challenges you, and Pip starts to remember who it is.
//
// Rook's arc: he fights you in the Forest and the River. Then Malgrath
// reveals he's holding Rook's little sister Robin hexed. At the Academy, Rook
// gives up fighting you and joins your side, all the way to the Void Rift.
//
// Each area (except the boss's, at the top) has a villager whose quest opens
// its gate. Quest types:
//   free    - free `count` hexed creatures in this area, then come back
//   find    - find a lost item hidden in this area (sign a letter to pick it
//             up), then bring it back
//   riddle  - answer a riddle by fingerspelling `word` (one of the zone's words)
//   deliver - take an item from the quest giver to `to`, another villager here
//   guard   - beat the hexed gate guard (a word battle, which opens the boss)
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
    steps: [
      {
        type: "free", npc: "fern", count: 2, title: "Free the hexed critters for Farmer Fern",
        start: [["fern", "A Signkeeper! Oh, thank goodness. A Beacon Shard crashed into Sprout Pond, and the Croak King swallowed its light."], ["fern", "Now he's hexing every critter in the meadow! Free 2 of them and come back. I'll open my garden gate."]],
        done: [["fern", "You really can break the hex! The Croak King lives at the top of the meadow, by the old pond. Go through my garden."]],
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
        type: "deliver", npc: "nana", to: "bo", item: "Nana's berry pie", title: "Bring Nana's pie to Grandpa Bo",
        start: [["nana", "Grandpa Bo fished in Sprout Pond for fifty years. He knows how to get past the Croak King's guards."], ["nana", "But he won't talk on an empty stomach! Bring him my berry pie?"]],
        done: [["bo", "Nana's pie! Alright, listen close. The king's last guard sleeps by the top gate. Scout Ivy's been watching it."]],
      },
      {
        type: "guard", npc: "ivy", title: "Beat the Croak King's gate guard",
        start: [["ivy", "Malgrath hexed this guard himself. It's the last thing between you and the Croak King."], ["ivy", "Beat it, and the shard is right there!"]],
        done: [["ivy", "You did it! The Croak King is just ahead. Go get that shard!"]],
      },
    ],
    events: [
      {
        area: 1, type: "malgrath", creature: "slime",
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
    steps: [
      {
        type: "free", npc: "rowan", count: 2, title: "Clear the trail for Professor Hoot's class",
        start: [["rowan", "The second shard hit the Owlery, where Professor Hoot teaches signing. He's hexed now, and his students are lost in these woods."], ["rowan", "Free 2 hexed creatures so the trail is safe for the kids."]],
        done: [["rowan", "Thank you. The students ran toward the Owlery. Follow the trail."]],
      },
      {
        type: "riddle", npc: "sam", word: "BIKE", title: "Prove you're a Signkeeper to Sam",
        start: [["sam", "Are you a real Signkeeper? Professor Hoot says a real one can answer any riddle with their hands."], ["sam", "What has two wheels and pedals? Sign it!"]],
        done: [["sam", "B-I-K-E! You ARE a Signkeeper! Lena knows how to help the Professor. She's up ahead."]],
      },
      {
        type: "find", npc: "lena", item: "Professor Hoot's spellbook", title: "Find Professor Hoot's spellbook",
        start: [["lena", "Professor Hoot dropped his spellbook when the hex hit. The Signkeeper Oath is inside."], ["lena", "If you sign the Oath to him, maybe he'll remember us! Please find it!"]],
        done: [["lena", "The spellbook! Here, the Oath is on the first page. Now go save the Professor!"]],
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
        area: 1, type: "rook", creature: "shadowbat",
        lines: [["rook", "Hey! Hold it right there."], ["rook", "So you're the last apprentice everyone's whispering about. I'm Rook."], ["rook", "That shard in the Owlery is mine. Let's see how good you really are!"]],
        after: [["rook", "Tch. Lucky. This isn't over, apprentice."], ["pip", "Who WAS that? Why would a Signkeeper want the shards?"]],
      },
      {
        area: 3, type: "malgrath", creature: "hobgoblin",
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
    steps: [
      {
        type: "free", npc: "mo", count: 2, title: "Take back the Echo Mine",
        start: [["mo", "The third shard fell down the old Echo Mine. Count Flap and his hexed bats took over and chased us miners out!"], ["mo", "Free 2 of them, and I'll open the mine gate."]],
        done: [["mo", "The tunnels are safer already! Count Flap is down at the very bottom, where the shard landed."]],
      },
      {
        type: "riddle", npc: "pete", word: "MOP", title: "Open the old mine door for Pete",
        start: [["pete", "Heh. This door was built by Signkeepers. It only opens for someone who can sign the answer to its riddle."], ["pete", "What do you clean a muddy floor with? Sign it!"]],
        done: [["pete", "M-O-P. The old door hasn't opened in years! In you go."]],
      },
      {
        type: "find", npc: "kit", item: "Kit's lantern", title: "Find Kit's lantern",
        start: [["kit", "I dropped my lantern when the bats swooped! It's pitch dark down here without it."], ["pip", "My antennae glow a little... but not enough. Let's find that lantern."]],
        done: [["kit", "Light! Thank you! Look, the tunnel splits here. The shard's glow is coming from the left!"]],
      },
      {
        type: "deliver", npc: "carla", to: "lou", item: "a bag of glow crystals", title: "Bring Carla's glow crystals to Lamplighter Lou",
        start: [["carla", "Lou keeps the deep lamps lit, but Malgrath's bats smashed them all. Bring him these glow crystals?"]],
        done: [["lou", "Glow crystals! Now I can light the way down to Count Flap's lair."]],
      },
      {
        type: "guard", npc: "dot", title: "Beat Count Flap's gate guard",
        start: [["dot", "Count Flap is just past this gate. His hexed guard swoops at anyone who comes near!"]],
        done: [["dot", "Wow! Count Flap is next. Bring back the light!"]],
      },
    ],
    events: [
      {
        area: 1, type: "talk",
        lines: [["pip", "Wait... I know this place. I've been somewhere like this before."], ["pip", "When the Beacon shattered, I fell. Deep, deep down into the dark. Then I woke up next to you."], ["pip", "Let's keep going. I want to remember more."]],
      },
      {
        area: 3, type: "malgrath", creature: "darkwisp",
        lines: [["malgrath", "You chase my shards like a moth chases a flame."], ["malgrath", "And your little friend glows brighter near them, doesn't it? How... interesting."], ["malgrath", "Dark Wisp! Burn them with shadow fire!"]],
        after: [["pip", "Why did he look at me like that, {name}?"], ["pip", "Never mind. Let's just get the shard."]],
      },
    ],
    phase2: [["malgrath", "Count Flap! Put out every light! DARKNESS, NOW!"], ["pip", "I'll glow as bright as I can! Keep signing!"]],
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
    steps: [
      {
        type: "free", npc: "finn", count: 2, title: "Calm the river for Fisher Finn",
        start: [["finn", "The fourth shard sank under the waterfall, and Inkzilla turned the whole river gray with hexed ink!"], ["finn", "Free 2 of the hexed creatures splashing around, and I'll open the dock gate."]],
        done: [["finn", "The water's clearing up! Inkzilla's under the big waterfall at the top."]],
      },
      {
        type: "deliver", npc: "wren", to: "cora", item: "a fishing net", title: "Bring Wren's net to Captain Cora",
        start: [["wren", "Captain Cora's boat is the only one that can sail to the waterfall. But Inkzilla shredded her net!"], ["wren", "Can you take her this one?"]],
        done: [["cora", "A new net! Splendid. Once we're through the next gate, I'll take you upriver."]],
      },
      {
        type: "riddle", npc: "tilly", word: "SUN", title: "Cross Bridgekeeper Tilly's bridge",
        start: [["tilly", "A boy in a black robe tried to cross my bridge this morning. He couldn't answer my riddle!"], ["tilly", "Let's see if you can. What shines up in the sky all day? Sign it!"]],
        done: [["tilly", "S-U-N! Sunny and correct. Cross away! That grumpy boy went up the river bank."]],
      },
      {
        type: "find", npc: "sol", item: "Captain Cora's compass", title: "Find the lost compass",
        start: [["sol", "Captain Cora dropped her compass in the reeds. Without it, nobody can find the waterfall through the ink!"]],
        done: [["sol", "The compass! Look, the needle is pointing right at the waterfall gate."]],
      },
      {
        type: "guard", npc: "ray", title: "Beat Inkzilla's gate guard",
        start: [["ray", "Inkzilla is just past the waterfall gate. Its hexed guard is really tough."], ["pip", "Bring your strongest buddies, {name}!"]],
        done: [["ray", "Amazing! Inkzilla is next. The whole river is counting on you!"]],
      },
    ],
    events: [
      {
        area: 1, type: "rook", creature: "crab",
        lines: [["rook", "YOU again! Get out of my way, apprentice."], ["rook", "I NEED that shard. You have no idea what's at stake!"]],
        after: [["rook", "...Fine. You win. But I can't stop. I CAN'T."], ["pip", "He didn't sound mean this time, {name}. He sounded scared."]],
      },
      {
        area: 3, type: "malgrath", creature: "lizardman",
        lines: [["malgrath", "Rook works for ME, little apprentice. Didn't he tell you?"], ["malgrath", "He'll bring me every shard. Or his little sister Robin stays hexed. Forever."], ["malgrath", "Now... ink beasts, take them!"]],
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
    steps: [
      {
        type: "free", npc: "juno", count: 2, title: "Help your old classmate Juno",
        start: [["juno", "{name}?! You made it out too! I've been hiding in the ruins since that night."], ["juno", "Malgrath turned our school into his fortress. Blaze, the Academy's dragon, guards the fifth shard. Free 2 hexed creatures and I'll show you the way."]],
        done: [["juno", "Just like old times! Come on, Librarian Lyle is hiding in the library."]],
      },
      {
        type: "find", npc: "lyle", item: "your old spellbook", title: "Find your old spellbook",
        start: [["lyle", "My favorite student! Your spellbook is still somewhere in these ruins."], ["lyle", "Every sign you ever learned is inside. You'll need all of them for Blaze."]],
        done: [["lyle", "There it is! Keep it close. Headmaster Ada is waiting for you upstairs."]],
      },
      {
        type: "riddle", npc: "ada", word: "YAK", title: "Pass Headmaster Ada's test",
        start: [["ada", "You've come so far. A true Signkeeper must pass one last test before facing Blaze."], ["ada", "Which hairy ox lives high in the mountains? Sign it!"]],
        done: [["ada", "Y-A-K. Well done. I always knew you'd be a great Signkeeper. Now go. Someone is waiting for you in the training yard."]],
      },
      {
        type: "deliver", npc: "nell", to: "brick", item: "a letter from Nell", title: "Bring Nell's letter to Coach Brick",
        start: [["nell", "Coach Brick is guarding the training yard all by himself. Could you bring him my letter? It says we're all safe."]],
        done: [["brick", "Nell's okay? Best news all week! The training yard gate is yours. Oh, and that Rook kid is in there."]],
      },
      {
        type: "guard", npc: "rook", title: "Beat Blaze's gate guard, with Rook",
        start: [["rook", "Blaze's gate guard is hexed. I'll keep the other creatures off you."], ["rook", "Go, partner. For Robin."]],
        done: [["rook", "That's my partner! Now go save Blaze. I'll be right behind you."]],
      },
    ],
    events: [
      {
        area: 1, type: "malgrath", creature: "wraith",
        lines: [["malgrath", "Welcome home, apprentice. Your little school is MY fortress now."], ["malgrath", "Did you really think you could just walk back in? Wraith! Haunt them!"]],
        after: [["pip", "He's turning everything we love against us. We won't let him win!"]],
      },
      {
        area: 3, type: "talk",
        lines: [["rook", "...Wait. Don't. I'm not here to fight."], ["rook", "I can't beat you. And I'm done pretending Malgrath will keep his promise."], ["rook", "He has my little sister, Robin. He said if I brought him every shard, he'd break her hex. He's lying, isn't he?"], ["pip", "He is. But we can save her, Rook. Together."], ["rook", "...Okay. I'm with you. For Robin."]],
      },
    ],
    phase2: [["malgrath", "Blaze! BURN IT ALL DOWN!"], ["rook", "Hang in there! Watch for his fire breath!"]],
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
    steps: [
      {
        type: "free", npc: "nova", count: 2, title: "Help Starkeeper Nova",
        start: [["nova", "Travelers from the island? Three shards streaked through our sky that night."], ["nova", "One froze inside the Glacier Wyrm's lair. Free 2 hexed creatures, and I'll open the crystal gate."]],
        done: [["nova", "You have a kind heart, Signkeeper. The Wyrm's lair is at the top of the Spires."]],
      },
      {
        type: "riddle", npc: "sven", word: "STAR", title: "Answer Sven's ice riddle",
        start: [["sven", "I carve the old Signkeeper riddles into the ice. Answer mine to pass."], ["sven", "What twinkles in the night sky? Sign it!"]],
        done: [["sven", "S-T-A-R. Like the shards that fell from the sky. Pass, friend."]],
      },
      {
        type: "find", npc: "mira", item: "Mira's star map", title: "Find Mira's star map",
        start: [["mira", "My star map shows the safe path through the Spires. Malgrath's blizzard blew it away!"]],
        done: [["mira", "My map! Look, it shows the way to the Wyrm's gate."]],
      },
      {
        type: "deliver", npc: "frost", to: "yuki", item: "a warm scarf", title: "Bring Frost's scarf to Yuki",
        start: [["frost", "My sister Yuki is freezing up ahead. Please bring her my scarf!"], ["rook", "...I know how that feels. Let's hurry."]],
        done: [["yuki", "So warm! Thank you! I'll open the gate for you."]],
      },
      {
        type: "guard", npc: "rook", title: "Beat the Glacier Wyrm's gate guard",
        start: [["rook", "I scouted ahead. The Wyrm froze its shard inside a glacier, and its gate guard is hexed solid."], ["rook", "You take the guard. I'll watch your back."]],
        done: [["rook", "Nice! The Wyrm's lair is right there. Two shards left after this one."]],
      },
    ],
    events: [
      {
        area: 1, type: "malgrath", creature: "frostling",
        lines: [["malgrath", "You came to MY realm? Bold. And you brought my little traitor, Rook."], ["malgrath", "Frostlings! Freeze them where they stand!"]],
        after: [["rook", "Sorry, partner. That one's on me. He's angry I switched sides."], ["pip", "We're a team now. That's what matters."]],
      },
      {
        area: 3, type: "talk",
        lines: [["pip", "{name}... I remember now. Really remember."], ["pip", "I'm not just a fox-moth. I'm the Beacon's spirit. When it shattered, I was the little light that got away."], ["pip", "When all eight shards come back together... I think I'll be whole again."]],
      },
    ],
    phase2: [["malgrath", "Glacier Wyrm! Freeze them SOLID!"], ["rook", "It's charging up! Get ready!"]],
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
    steps: [
      {
        type: "free", npc: "zephyr", count: 2, title: "Calm the storm with Zephyr",
        start: [["zephyr", "The seventh shard fell into the Storm Owl's nest, and now the whole kingdom is one big storm!"], ["zephyr", "Free 2 hexed creatures, and I'll part the clouds for you."]],
        done: [["zephyr", "Blue skies again, at least here! Princess Luna can help you reach the nest."]],
      },
      {
        type: "riddle", npc: "luna", word: "RAIN", title: "Answer Princess Luna's riddle",
        start: [["luna", "Welcome to the Cloud Kingdom. Malgrath's storm has trapped my people. Only a true Signkeeper may pass my gate."], ["luna", "What falls from clouds and makes puddles? Sign it!"]],
        done: [["luna", "R-A-I-N. Wise and brave! Go with my blessing."]],
      },
      {
        type: "deliver", npc: "gale", to: "puff", item: "a bag of sky seeds", title: "Bring Gale's sky seeds to Puff",
        start: [["gale", "Puff grows the cloud bridges, but the storm blew all the seeds away. Without bridges, nobody can reach the nest!"]],
        done: [["puff", "Sky seeds! Watch... a brand new cloud bridge! Go on across!"]],
      },
      {
        type: "find", npc: "skye", item: "Skye's wind chime", title: "Find Skye's wind chime",
        start: [["skye", "My wind chime calms the storm winds. Malgrath's lightning knocked it away!"]],
        done: [["skye", "My chime! Listen... the winds are softer already. The nest gate is just ahead."]],
      },
      {
        type: "guard", npc: "thane", title: "Beat the Storm Owl's gate guard",
        start: [["thane", "The Storm Owl guards the seventh shard. Its gate guard was hexed by Malgrath himself."]],
        done: [["thane", "Remarkable! The Storm Owl is next. The whole kingdom thanks you."]],
      },
    ],
    events: [
      {
        area: 1, type: "malgrath", creature: "harpy",
        lines: [["malgrath", "Seven shards, apprentice. You have done my work for me."], ["malgrath", "But you won't get the last one. Harpy! Blow them off my mountain!"]],
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
    steps: [
      {
        type: "free", npc: "echo", count: 2, title: "Help Echo",
        start: [["echo", "You can see me? Malgrath hexed everyone in the Rift. Most of us can't even see each other anymore."], ["echo", "Free 2 of them. Please. Then I'll show you the way in."]],
        done: [["echo", "They remember me now. Thank you. Malgrath's tower is at the very top."]],
      },
      {
        type: "find", npc: "vex", item: "the Rift key", title: "Find the Rift key",
        start: [["vex", "Malgrath hid the key to his tower somewhere in this area. Without it, nobody gets any closer."]],
        done: [["vex", "The Rift key! Let's open this thing."]],
      },
      {
        type: "riddle", npc: "sage", word: "QUEST", title: "Answer the Last Sage's riddle",
        start: [["sage", "I am the last of the old Signkeepers. I have waited a long time for you."], ["sage", "Tell me: what do you call a great journey to find something? Sign it!"]],
        done: [["sage", "Q-U-E-S-T. Yes. And yours is almost over. Be brave, child."]],
      },
      {
        type: "deliver", npc: "lumi", to: "kai", item: "a spark of Signlight", title: "Bring Lumi's spark to Kai",
        start: [["lumi", "Kai is lost in the dark up ahead. Bring him this spark of Signlight so he can find his way."]],
        done: [["kai", "Light! I can see again! Thank you. The tower gate is right here."]],
      },
      {
        type: "guard", npc: "rook", title: "Break through to Malgrath, with Rook",
        start: [["rook", "This is it, partner. Malgrath and Robin are right past this gate."], ["rook", "Beat the guard, and let's end this. Together."]],
        done: [["rook", "We did it. Now let's go get Robin back. And stop him, {name}. For all of us."]],
      },
    ],
    events: [
      {
        area: 1, type: "malgrath", creature: "voidslime",
        lines: [["malgrath", "So you made it to the Rift. Nobody has made it this far in a thousand years."], ["malgrath", "Void Slimes! Show them what the Void really is!"]],
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
    steps: [
      {
        type: "free", npc: "pim", count: 2, title: "Clear the courtyard for Page Pim",
        start: [["pim", "A visitor? Nobody's come to Crown Keep since the Beacon broke!"], ["pim", "Malgrath sealed the Queen in her throne room, and now hexed Knightlings march around the courtyard. Free 2 of them, please!"]],
        done: [["pim", "You did it! The Queen always said a Signkeeper would come. Go see Cook Basil in the kitchens."]],
      },
      {
        type: "find", npc: "basil", item: "the royal recipe book", title: "Find Cook Basil's recipe book",
        start: [["basil", "Every night I cooked for Queen Amara. Now my recipe book is lost somewhere in the gardens!"], ["basil", "It has her favorite soup in it. I want it ready for when she's free."]],
        done: [["basil", "My book! I'll start the soup right away. The Queen will be so happy."]],
      },
      {
        type: "riddle", npc: "sage", word: "CROWN", title: "Solve Scribe Odette's royal riddle",
        start: [["sage", "I write down the Queen's history. Did you know she was Deaf? She signed before anyone knew about Signlight."], ["sage", "She noticed her hands glowed when she signed. That's how Signlight was discovered!"], ["sage", "Now, a riddle: what does a queen wear on her head? Sign it!"]],
        done: [["sage", "C-R-O-W-N! The Queen would be proud of your signing."]],
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
        area: 1, type: "malgrath", creature: "knightling",
        lines: [["malgrath", "Ah, the Queen's little castle. She thought waving her hands around could hold back the dark."], ["malgrath", "Knightlings! Show this apprentice how my castle treats guests!"]],
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
