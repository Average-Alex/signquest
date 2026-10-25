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
//   learn   - the giver shows you a sign (`word`), and you copy it; `move`:
//             a moving sign they teach you too (HELLO, YES...; config.js MOTION_TIPS)
//   convo   - a signed conversation: they ask, you answer with a sign
//             (a letter, or a moving sign like THANK YOU)
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
//   hide    - hide-and-seek: find `item` (`emoji`) and sign to tag it; it
//             dashes off to hide again, `hops` times in all
//   memory  - the giver signs `word` once; you sign it back from memory
//   quiz    - true or false about ASL and Deaf culture (`qs`: [[statement,
//             true/false, why], ...]); a wrong answer is explained, then asked again
//   chant   - sign `words` in order ([[word, what it is], ...]), like a
//             potion's ingredients or the lines of a spell (`icon`, `verb`)
//   guard   - beat the hexed gate guard (a word battle, which opens the boss)
//
// Every zone also has one signature quest that plays like nothing else, found
// only there (biome.js "Signature quests"):
//   garden   - Meadow: plant `count` `seed`s, wait `growMs` while they grow,
//              then pick the `crop`
//   glow     - Glowshroom Forest: light the mushrooms in the color `order`;
//              a wrong one, or the hexed decoy, puts them all out
//   (race)   - Magma Canyon: a collect quest with a `timer`
//   fish     - Coral Lagoon: cast from the dock, wait for a bite, sign fast
//   ghosts   - Haunted Hollow: the area goes dark; find `count` drifting
//              ghosts by your lantern's light
//   snowball - Aurora Glacier: snowmen pop up around you; sign before they throw
//   simon    - Thunder Peaks: echo the chime's patterns (`rounds`), longer each time
//   escort   - Crown Keep: find `item` (`emoji`), then lead it to the `goal`
//              (`goalEmoji`) while it follows you
//   stars    - Cosmic Rift: sign the stars in order to draw a constellation;
//              they spell `word`, the answer to the giver's `clue`
//
// And kinds that move and play differently (no "go fetch it"):
//   race     - race the giver to the 🚩 flag (`retry`: what they say for a rematch)
//   follow   - sneak after the giver to the hideout (`goalEmoji`); stay close,
//              and keep out of sight of the hexed eyes (`watchers`, 2 if not said)
//   defend   - protect `target` for `seconds` from `raider`s (`raiderName`),
//              which come every `every` ms; sign at each one to drive it off
//   mirror   - the giver signs (only the hand picture shows); copy it fast.
//              `rounds` signs, `need` of them right
//   match    - pair `pairs` letters with their handshapes (`prompt`), then sign them
//
// A collect quest can gather something else than sign cards (`thing`: emoji,
// name, plural, found, verb), and can be a race (`timer`: seconds to find
// them all, or they slip away; `retry`: what the giver says to try again).
// Every zone mixes its own kinds, so no two zones play the same.
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
        type: "learn", npc: "fern", word: "A", move: "HELLO", title: "Learn your first signs with Farmer Fern",
        start: [["fern", "A Signkeeper! Oh, thank goodness. A Beacon Shard crashed into Sprout Pond, and the Croak King swallowed its light."], ["fern", "My grandma taught me some signs. Hexes hate signing! First, the letter A: a fist, with your thumb on the side."], ["fern", "Then a sign that MOVES: HELLO. Flat hand at your forehead, then salute out to the side, like a friendly wave."]],
        done: [["fern", "That's it! A, for A Signkeeper, and a big HELLO! The Croak King lives at the top of the meadow, by the old pond. Go through my garden."]],
      },
      {
        type: "race", npc: "milo", title: "Race Milo to the hilltop flag",
        start: [["milo", "My kite got stuck on the hilltop flagpole when the shard fell! I drew a map to the pond on it."], ["milo", "Race you up there! First one to the 🚩 flag gets to read the map. Ready?"]],
        retry: "Rematch! On your marks...",
        done: [["milo", "Whoa, you're fast! Here's my kite. The map shows the pond, past Gatekeeper Gus. Good luck!"]],
      },
      {
        type: "riddle", npc: "gus", word: "CAB", title: "Remember Gus's lost password",
        start: [["gus", "Malgrath's fog made me forget my own gate's password! Only a real Signkeeper can sign it back."], ["gus", "The old Signkeepers wrote it as a riddle: what do you call a taxi? Sign it!"]],
        done: [["gus", "C-A-B! It's all coming back to me. Welcome back, Signkeeper."]],
      },
      {
        type: "garden", npc: "nana", count: 3, seed: "carrot seed", crop: "🥕", growMs: 25000, title: "Grow carrots in Nana Bea's garden",
        start: [["nana", "Grandpa Bo knows how to get past the Croak King's guards. But he won't say a word on an empty tummy!"], ["nana", "The hex scared off my garden. Plant three carrots for me, wait for them to grow, then pick them. Signlight makes them grow FAST."]],
        done: [["nana", "Look at these carrots! Bo is munching happily. He says the king's last guard sleeps by the top gate. Scout Ivy's been watching it."]],
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
        type: "chant", npc: "sam", icon: "🧪", verb: "Ingredient", title: "Brew Professor Hoot's wake-up potion with Sam",
        words: [["F", "a Fern leaf"], ["G", "a Glowcap mushroom"], ["H", "a drop of Honey"], ["PLEASE", "ask nicely, so it works. Flat hand on your chest, rub a circle"]],
        start: [["sam", "I'm the Professor's student! I'm brewing his wake-up potion, to clear the hex fog in the woods."], ["sam", "Each ingredient only goes in when someone signs its letter. Help me add them, in order!"]],
        done: [["sam", "*POOF* It's glowing! The fog is lifting. Lena knows how to help the Professor. She's up ahead."]],
      },
      {
        type: "match", npc: "lena", pairs: 4, prompt: "Professor Hoot's flash cards: match each letter to its handshape!", title: "Sort Professor Hoot's flash cards",
        start: [["lena", "Professor Hoot's flash cards got all mixed up when the hex hit! Letters on some, handshapes on others."], ["lena", "Match each letter to its handshape, then sign them for me. The Professor will need them when he wakes up!"]],
        done: [["lena", "All sorted! These cards will help the Professor remember who he is. Go save him!"]],
      },
      {
        type: "glow", npc: "pippa", order: ["blue", "pink", "gold"], title: "Light the glowshroom path for Pippa",
        start: [["pippa", "The hex put out the glowshrooms, and now nobody can find the way to the Owlery in the dark!"], ["pippa", "They only light up in the right order: BLUE, then PINK, then GOLD. And whatever you do, don't touch the purple-black one. It's hexed!"]],
        done: [["pippa", "The whole path is glowing! Woodcutter Wes is already heading up it to clear the vines. Go on!"]],
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
        type: "collect", npc: "pete", count: 3, timer: 75, title: "Cool the lava vents before they blow!",
        thing: { emoji: "🌋", name: "lava vent", plural: "lava vents", found: "A bubbling lava vent!", verb: "cool it down" },
        start: [["pete", "Heh. Hear that rumbling? Three lava vents around here are about to blow!"], ["pete", "Signlight cools them right down. But you'll have to be QUICK. Ready? GO!"]],
        retry: "Phew, too slow! They're bubbling up again. Once more, quick as you can!",
        done: [["pete", "Ha! Cool as a cave pool. The old Signkeeper door is safe to open now. In you go."]],
      },
      {
        type: "defend", npc: "kit", seconds: 40, target: "Kit's mine cart", raider: "🦇", raiderName: "fire bats", title: "Guard Kit's mine cart from the fire bats",
        start: [["kit", "I'm hauling the last cart of glowstones out of the mine, and fire bats keep swooping at it!"], ["kit", "Keep them off for 40 seconds! Run at each one and sign to scare it away. Three get through, and we have to start over."]],
        retry: "Here they come again! Ready?",
        done: [["kit", "We made it! These glowstones light the whole canyon. Look, the path splits at the lava falls. The shard's glow is coming from the left!"]],
      },
      {
        type: "convo", npc: "carla", title: "Answer Crystal Carla's questions",
        qa: [
          [[["carla", "Malgrath's ashcrows smashed all the canyon lamps. I can light them again, but I need a Signkeeper's help."], ["carla", "First: what letter does LAMP start with? Sign it!"]], "L", "What letter does LAMP start with?"],
          [[["carla", "Yes! Next: which letter looks like a circle? Hint: all your fingertips touch your thumb."]], "O", "Which letter looks like a circle?"],
          [[["carla", "The lamps matter most at NIGHT. Sign the letter NIGHT starts with."]], "N", "What letter does NIGHT start with?"],
          [[["carla", "They're lighting up! Before you go, tell the lamplighters THANK YOU. Fingertips at your chin, then move your hand out toward them."]], "THANK YOU", "Sign THANK YOU!"],
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
        type: "learn", npc: "finn", word: "S", move: "YES", title: "Learn S and YES with Fisher Finn",
        start: [["finn", "The fourth shard sank into the deep reef, and Inkzilla turned the whole lagoon gray with hexed ink!"], ["finn", "My boat is called the S.S. Signal. Every lagoon kid learns S first: a fist, with your thumb across the front."], ["finn", "Then nod that S fist up and down, like a head nodding. That's YES! Ready to set sail? Show me!"]],
        done: [["finn", "Strong S! The water's clearing up already. Inkzilla's out at the deep reef, past the shipwreck."]],
      },
      {
        type: "follow", npc: "wren", goalEmoji: "⛵", title: "Sneak through the reeds with Wren",
        start: [["wren", "Captain Cora's boat is hidden in the reeds, but Inkzilla's hexed eyes are watching the shore!"], ["wren", "Follow me, and stay close. If one of those eyes sees us, we have to start over."]],
        retry: "Okay, again. Quiet as a fish...",
        done: [["wren", "We made it to Captain Cora's boat, and nobody saw us! Once we're through the next gate, she'll sail you out to the reef."]],
      },
      {
        type: "mirror", npc: "tilly", rounds: 5, need: 4, title: "Copy Bridgekeeper Tilly's secret signs",
        start: [["tilly", "A boy in a black robe tried to cross my bridge this morning. Now only REAL Signkeepers may cross!"], ["tilly", "I'll sign, you copy. No letters to help you, just my hands! Get four out of five."]],
        done: [["tilly", "You read hands like a pro! Cross away. That grumpy boy went along the beach."]],
      },
      {
        type: "fish", npc: "sol", count: 3, title: "Win Sol's fishing contest",
        start: [["sol", "Captain Cora's compass needs a glowing pearl, and only the reef fish know where they are!"], ["sol", "Fish with me! Cast from the dock, wait for a bite, then sign FAST before it gets away. Catch three!"]],
        done: [["sol", "Three fish! And look, this one coughed up a glowing pearl. The compass needle is pointing right at the reef gate."]],
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
          [[["juno", "Did Malgrath scare you into giving up? Tell me NO! Two fingers and your thumb, snapping shut."]], "NO", "Sign NO!"],
        ],
        done: [["juno", "Just like old times! Malgrath turned our school into a haunted fortress, and Gourdgeist guards the fifth shard. Librarian Lyle is hiding in the library."]],
      },
      {
        type: "riddle", npc: "lyle", word: "WAX", title: "Solve Librarian Lyle's candle riddle",
        start: [["lyle", "My favorite student! I hid your old spellbook behind a riddle, so Malgrath couldn't find it."], ["lyle", "What drips down a candle, and goes hard as it cools? Sign it!"]],
        done: [["lyle", "W-A-X! Here's your spellbook. Every sign you ever learned is inside. Headmaster Ada is waiting for you upstairs."]],
      },
      {
        type: "quiz", npc: "ada", icon: "🎓", title: "Pass Headmaster Ada's final exam",
        qs: [
          ["Every country uses the same sign language.", false, "There are hundreds! ASL, British Sign Language, Japanese Sign Language, and many more."],
          ["Deaf people can be doctors, pilots, teachers, and artists.", true, "Deaf people do every kind of job there is."],
          ["To get a Deaf person's attention, you can wave or gently tap their shoulder.", true, "A wave, a tap, or flicking the lights is polite."],
        ],
        start: [["ada", "You've come so far. A true Signkeeper knows signing AND the people who sign."], ["ada", "Your final exam. True, or false?"]],
        done: [["ada", "Top marks. I always knew you'd be a great Signkeeper. Now go. Someone is waiting for you in the training yard."]],
      },
      {
        type: "ghosts", npc: "nell", count: 3, title: "Hunt the ghosts in the dark with Nell",
        start: [["nell", "Ghosts filled the training yard and blew out every candle, and Coach Brick is hiding in the shed!"], ["nell", "Take my lantern. You'll only see the ghosts close up, in its light. Sign to each one to send it home!"]],
        done: [["nell", "The lights are back on! Coach says thanks. Oh, and that Rook kid is in the training yard."]],
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
        type: "spot", npc: "nova", prompt: "Starkeeper Nova's star signals", rounds: 2, title: "Read Starkeeper Nova's star signals",
        start: [["nova", "Travelers from the island? Three shards streaked through our sky that night."], ["nova", "The Starkeepers talk across the ice with hand signals. Show me you can read them, and I'll tell you where the shard fell."]],
        done: [["nova", "A natural! One shard froze inside the Aurora Wyrm's lair, at the top of the glacier."]],
      },
      {
        type: "snowball", npc: "sven", count: 4, title: "Win Sven's snowball fight",
        start: [["sven", "Malgrath's blizzard brought my ice sculptures to life, and now they're throwing snowballs at everyone!"], ["sven", "Snowmen will pop up all around you. Run to each one and sign before it throws. Splat four, and they'll melt back into sculptures!"]],
        done: [["sven", "Ha! Back to good, quiet sculptures. You've got quick hands, friend. Pass!"]],
      },
      {
        type: "race", npc: "mira", title: "Sled race Mira across the glacier",
        start: [["mira", "My star map shows the safe path across the glacier, but the blizzard buried it. I know the way by heart, though!"], ["mira", "Race me to the flag at the end of the safe path! If you can keep up, you'll know the way too."]],
        retry: "Again! The ice is slippery, but you've got this.",
        done: [["mira", "You kept up! That's the safe path to the Wyrm's gate. Follow it up."]],
      },
      {
        type: "convo", npc: "frost", title: "Help Frost send a message to Yuki",
        qa: [
          [[["frost", "My sister Yuki is freezing up ahead, and she can't hear me over the wind. But she can SEE signs!"], ["rook", "...I know how that feels. Let's help."], ["frost", "Sign T, for TEA. I'm bringing her hot tea!"]], "T", "Sign T, for TEA!"],
          [[["frost", "She waved! Now sign S, for SOON."]], "S", "Sign S, for SOON!"],
          [[["frost", "One more: tell her SORRY it took so long. A fist on your chest, rubbing a circle."]], "SORRY", "Sign SORRY!"],
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
        type: "follow", npc: "luna", goalEmoji: "☁️", watchers: 3, title: "Sneak past the storm sentries with Princess Luna",
        start: [["luna", "Welcome to Thunder Peaks. Malgrath's storm sentries guard the way to my secret cloud bridge."], ["luna", "Follow me closely, and keep out of their sight. Those hexed eyes see everything near them!"]],
        retry: "Again, quietly. I'll lead.",
        done: [["luna", "My secret cloud bridge! Wise AND brave. Go with my blessing."]],
      },
      {
        type: "mirror", npc: "gale", rounds: 5, need: 4, title: "Copy Gale's sky-sailor signals",
        start: [["gale", "Sky sailors talk in hand signals. The wind's too loud for anything else!"], ["gale", "I'll flash you a signal, you copy it fast. Get four out of five, and you can sail with us to Puff's cloud bridge."]],
        done: [["gale", "You'd make a great sky sailor! Puff is growing a new cloud bridge for you right now."]],
      },
      {
        type: "simon", npc: "skye", rounds: ["H", "HK", "HKU", "HKUG"], title: "Echo Skye's wind chime",
        start: [["skye", "My wind chime calms the storm winds, but only if someone echoes its song!"], ["skye", "It rings a pattern of signs. Watch, then sign it back. Each time, the song gets longer!"]],
        done: [["skye", "Listen... the chime is singing on its own now, and the winds are softer already. The nest gate is just ahead."]],
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
        type: "stars", npc: "vex", word: "ORBIT", clue: "What goes around and around a planet?", title: "Draw the constellation that opens Malgrath's tower",
        start: [["vex", "Malgrath's tower opens for a constellation. Its stars are scattered all over this part of the Rift."], ["vex", "The stars spell the answer to a riddle: what goes around and around a planet? Sign them in order to join them up!"]],
        done: [["vex", "O-R-B-I-T! Look at it shine! The tower's lock is spinning open. Let's get closer."]],
      },
      {
        type: "riddle", npc: "sage", word: "QUEST", title: "Answer the Last Sage's riddle",
        start: [["sage", "I am the last of the old Signkeepers. I have waited a long time for you."], ["sage", "Tell me: what do you call a great journey to find something? Sign it!"]],
        done: [["sage", "Q-U-E-S-T. Yes. And yours is almost over. Be brave, child."]],
      },
      {
        type: "defend", npc: "lumi", seconds: 45, target: "Lumi's spark of Signlight", raider: "🌑", raiderName: "void wisps", every: 2000, title: "Protect Lumi's spark from the void wisps",
        start: [["lumi", "Kai is lost in the dark up ahead. I'm holding up a spark of Signlight to guide him home!"], ["lumi", "But void wisps want to swallow it! Keep them away until Kai finds his way. Sign at each one!"]],
        retry: "They're coming again! Help me!",
        done: [["lumi", "Kai made it home! The spark is safe. The tower gate is right here."]],
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
        type: "learn", npc: "pim", word: "C", move: "PLEASE", title: "Learn C and royal manners with Page Pim",
        start: [["pim", "A visitor? Nobody's come to Crown Keep since the Beacon broke!"], ["pim", "Every page learns C first: C for CROWN. Curve your hand like the letter C."], ["pim", "And the Queen insists on manners! PLEASE is a flat hand on your chest, rubbing a circle. Your turn!"]],
        done: [["pim", "Perfect! The Queen always said a Signkeeper would come. Go see Cook Basil in the kitchens."]],
      },
      {
        type: "escort", npc: "basil", item: "Biscuit", emoji: "🐣", goal: "nest in the royal garden", goalEmoji: "🪺", title: "Lead Biscuit, the Queen's griffin chick, home",
        start: [["basil", "Every night I cooked for Queen Amara. Now her baby griffin, Biscuit, has run off into the gardens!"], ["basil", "Find him, and sign so he trusts you. He'll follow you then. Lead him back to his nest, at the top of the garden."]],
        done: [["basil", "Biscuit's home, snug in his nest! When the Queen is free, he'll be the first one to greet her."]],
      },
      {
        type: "spot", npc: "sage", prompt: "Odette's royal signing test", rounds: 3, title: "Pass Scribe Odette's royal signing test",
        start: [["sage", "I write down the Queen's history. Did you know she was Deaf? She signed before anyone knew about Signlight."], ["sage", "She noticed her hands glowed when she signed. That's how Signlight was discovered! Now, the royal test: who's signing which letter?"]],
        done: [["sage", "Wonderful! The Queen would be proud of your eyes AND your hands."]],
      },
      {
        type: "chant", npc: "iris", icon: "👑", verb: "Oath word", title: "Recite the Royal Oath with Lady Iris",
        words: [["C", "C, for Courage"], ["R", "R, for Respect"], ["O", "O, for Open hands"], ["W", "W, for Welcome to all"], ["N", "N, for Never give up"]],
        start: [["iris", "The tower door only opens for someone who knows the Royal Oath. The Queen wrote it in signs, long ago."], ["iris", "Sign each word with me: C, R, O, W, N."]],
        done: [["iris", "CROWN! The door is open. Captain Hale is waiting by the throne room."]],
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
