// Quests: the story of each zone, area by area.
//
// Every zone is a chapter. Each area (except the boss's, at the top) has a
// villager with a quest, and finishing it opens that area's gate. Quest types:
//   free    - free `count` hexed creatures in this area, then come back
//   find    - find a lost item hidden in this area (sign a letter to pick it
//             up), then bring it back
//   riddle  - answer a riddle by fingerspelling `word` (one of the zone's words)
//   deliver - take an item from the quest giver to `to`, another villager here
//   guard   - beat the hexed gate guard (a word battle, which opens the boss)
//
// Lines are [speaker, text]. A speaker is a villager id from `npcs`, "pip", or
// "you". Villagers are drawn with the hero maker (sprites.js LOOK_OPTIONS),
// minus the wand. `{name}` is the player's name.

const npc = (name, hairStyle, hair, skin, outfitStyle, outfit, extra = {}) => ({
  name,
  look: { hairStyle, hair, skin, eyes: extra.eyes || "brown", outfitStyle, outfit, glasses: extra.glasses || "none" },
  hat: extra.hat || null,
});

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
        type: "free", npc: "fern", count: 2, title: "Save Farmer Fern's carrots",
        start: [["fern", "Oh, thank goodness, a Signkeeper! Hexed critters are stomping all over my carrots!"], ["fern", "Free 2 of them and come back. Then I'll open the garden gate for you."]],
        done: [["fern", "My carrots are saved! The garden gate's open. Watch out up ahead!"]],
      },
      {
        type: "find", npc: "milo", item: "Milo's kite", title: "Find Milo's kite",
        start: [["milo", "My kite blew away when the purple fog came! It's stuck somewhere in this field."], ["pip", "It's probably tangled up. You might have to sign to get it free!"]],
        done: [["milo", "My kite! You're the best! I'll open the gate for you."]],
      },
      {
        type: "riddle", npc: "gus", word: "CAB", title: "Answer Gatekeeper Gus's riddle",
        start: [["gus", "Halt! Nobody passes without the secret password."], ["gus", "Here's your riddle: what do you call a taxi? Sign the answer!"]],
        done: [["gus", "C-A-B. Correct! The gate is yours, young Signkeeper."]],
      },
      {
        type: "deliver", npc: "nana", to: "bo", item: "Nana's berry pie", title: "Bring Nana's pie to Grandpa Bo",
        start: [["nana", "Grandpa Bo has been stuck up the hill since the hex came. He must be so hungry!"], ["nana", "Could you bring him my berry pie? It's still warm!"]],
        done: [["bo", "Nana's berry pie! You're a lifesaver. Go on through my gate."]],
      },
      {
        type: "guard", npc: "ivy", title: "Beat the hexed gate guard",
        start: [["ivy", "The Croak King put a hexed guard on the last gate. Nobody can get past it."], ["ivy", "Beat it, and the way to the king is open!"]],
        done: [["ivy", "You did it! The Croak King and the first Beacon Shard are just ahead. Be brave!"]],
      },
    ],
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
        type: "free", npc: "rowan", count: 2, title: "Help Ranger Rowan clear the trail",
        start: [["rowan", "These woods were Professor Hoot's classroom. Now hexed creatures are everywhere."], ["rowan", "Free 2 of them and I'll trust you with the trail."]],
        done: [["rowan", "Not bad, Signkeeper! The trail is yours."]],
      },
      {
        type: "riddle", npc: "sam", word: "BIKE", title: "Answer Sam's riddle",
        start: [["sam", "I'm one of Professor Hoot's students. He always made us solve a riddle before recess!"], ["sam", "What has two wheels and pedals? Sign it!"]],
        done: [["sam", "B-I-K-E! Professor Hoot would be proud. Go ahead!"]],
      },
      {
        type: "find", npc: "lena", item: "Professor Hoot's spellbook", title: "Find Professor Hoot's spellbook",
        start: [["lena", "Professor Hoot dropped his spellbook when the hex hit him. If we find it, maybe it can help him remember us!"]],
        done: [["lena", "That's it! It still smells like old pages and owl feathers. Thank you!"]],
      },
      {
        type: "deliver", npc: "pippa", to: "wes", item: "a basket of muffins", title: "Bring Pippa's muffins to Woodcutter Wes",
        start: [["pippa", "Wes has been chopping hexed vines all day. Could you bring him these muffins?"]],
        done: [["wes", "Muffins! Just what I needed. I'll cut the vines off the gate for you."]],
      },
      {
        type: "guard", npc: "hazel", title: "Beat the hexed gate guard",
        start: [["hazel", "Professor Hoot is just past this gate, but his hexed guard won't let anyone through."], ["pip", "We'll handle it. Right, {name}?"]],
        done: [["hazel", "The guard is free! Go help the Professor!"]],
      },
    ],
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
        type: "free", npc: "mo", count: 2, title: "Help Miner Mo",
        start: [["mo", "Hexed creatures chased all us miners out of the tunnels!"], ["mo", "Free 2 of them, and I'll open the mine gate."]],
        done: [["mo", "The tunnels are safe again! In you go."]],
      },
      {
        type: "riddle", npc: "pete", word: "MOP", title: "Answer Old Miner Pete's riddle",
        start: [["pete", "Heh. These caves echo every sign. I'll only open up for someone who can answer my riddle."], ["pete", "What do you clean a muddy floor with? Sign it!"]],
        done: [["pete", "M-O-P. Ha! Right you are. Off you go."]],
      },
      {
        type: "find", npc: "kit", item: "Kit's lantern", title: "Find Kit's lantern",
        start: [["kit", "I dropped my lantern and now I can't see a thing! It rolled off somewhere down here."]],
        done: [["kit", "Light! Thank you! I'll hold it up so you can see the gate."]],
      },
      {
        type: "deliver", npc: "carla", to: "lou", item: "a bag of glow crystals", title: "Bring Carla's glow crystals to Lamplighter Lou",
        start: [["carla", "Lou keeps the tunnel lamps lit, but he ran out of glow crystals. Could you bring him these?"]],
        done: [["lou", "Glow crystals! Now I can light the way to the gate. Thank you!"]],
      },
      {
        type: "guard", npc: "dot", title: "Beat the hexed gate guard",
        start: [["dot", "Count Flap is just past this gate. His hexed guard swoops at anyone who comes near!"]],
        done: [["dot", "Wow! Count Flap is next. Good luck!"]],
      },
    ],
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
        type: "free", npc: "finn", count: 2, title: "Help Fisher Finn",
        start: [["finn", "No fish are biting, because hexed creatures keep splashing everything!"], ["finn", "Free 2 of them and I'll open the dock gate."]],
        done: [["finn", "The river's calm again! Thanks, Signkeeper."]],
      },
      {
        type: "deliver", npc: "wren", to: "cora", item: "a fishing net", title: "Bring Wren's net to Captain Cora",
        start: [["wren", "Captain Cora's boat lost its net in the fog. Can you take her this one?"]],
        done: [["cora", "A new net! Splendid. I'll open the gate for you, sailor."]],
      },
      {
        type: "riddle", npc: "tilly", word: "SUN", title: "Answer Bridgekeeper Tilly's riddle",
        start: [["tilly", "Nobody crosses my bridge without solving a riddle. Those are the rules!"], ["tilly", "What shines up in the sky all day? Sign it!"]],
        done: [["tilly", "S-U-N! Sunny and correct. Cross away!"]],
      },
      {
        type: "find", npc: "sol", item: "Captain Cora's compass", title: "Find the lost compass",
        start: [["sol", "Captain Cora dropped her compass in the reeds. Without it, nobody can find the way to the waterfall!"]],
        done: [["sol", "The compass! Look, it's pointing right at the gate."]],
      },
      {
        type: "guard", npc: "ray", title: "Beat the hexed gate guard",
        start: [["ray", "Inkzilla is just past the waterfall gate. Its hexed guard is really tough."], ["pip", "Bring your strongest buddies, {name}!"]],
        done: [["ray", "Amazing! Inkzilla is next. The river's counting on you!"]],
      },
    ],
  },

  castle: {
    npcs: {
      juno: npc("Juno", "spiky", "purple", "s4", "robe", "purple", { eyes: "purple" }),
      lyle: npc("Librarian Lyle", "bald", "white", "s1", "robe", "black", { glasses: "round" }),
      ada: npc("Headmaster Ada", "bun", "white", "s5", "robe", "blue", { glasses: "round", hat: "hat-grad" }),
      brick: npc("Coach Brick", "short", "black", "s6", "tunic", "red"),
      nell: npc("Nell", "long", "pink", "s2", "tunic", "teal"),
      rook: npc("Rook", "spiky", "black", "s3", "robe", "black", { eyes: "gray" }),
    },
    steps: [
      {
        type: "free", npc: "juno", count: 2, title: "Help your old classmate Juno",
        start: [["juno", "{name}?! You made it out too! I've been hiding in the Academy ruins since that night."], ["juno", "Hexed creatures are guarding the halls. Free 2 of them and I'll show you the way."]],
        done: [["juno", "Just like old times! Come on, this way."]],
      },
      {
        type: "find", npc: "lyle", item: "your old spellbook", title: "Find your old spellbook",
        start: [["lyle", "Ah, my favorite student! Your spellbook is still somewhere in these ruins."], ["lyle", "Find it. Every sign you ever learned is written inside."]],
        done: [["lyle", "There it is! Keep it close. You'll need it soon."]],
      },
      {
        type: "riddle", npc: "ada", word: "YAK", title: "Pass Headmaster Ada's test",
        start: [["ada", "A true Signkeeper must pass one last test before facing Blaze."], ["ada", "Which hairy ox lives high in the mountains? Sign it!"]],
        done: [["ada", "Y-A-K. Well done. I always knew you'd be a great Signkeeper."]],
      },
      {
        type: "deliver", npc: "nell", to: "brick", item: "a letter from Nell", title: "Bring Nell's letter to Coach Brick",
        start: [["nell", "Coach Brick is guarding the training yard all by himself. Could you bring him my letter? It says we're all safe."]],
        done: [["brick", "Nell's okay? That's the best news all week! The training yard gate is yours."]],
      },
      {
        type: "guard", npc: "rook", title: "Beat the hexed gate guard",
        start: [["rook", "So you're the famous last apprentice. I'm Rook."], ["rook", "Malgrath hexed the guard on Blaze's gate. I couldn't beat it alone. Let's see if you can."]],
        done: [["rook", "Huh. You're better than I thought. Go save Blaze. Maybe I'll see you around."]],
      },
    ],
  },

  spires: {
    npcs: {
      nova: npc("Starkeeper Nova", "long", "white", "s5", "robe", "blue", { eyes: "blue" }),
      sven: npc("Sven the Ice Carver", "short", "blonde", "s1", "tunic", "silver"),
      mira: npc("Mira", "bun", "blue", "s3", "robe", "teal"),
      frost: npc("Frost", "spiky", "white", "s2", "tunic", "black"),
      yuki: npc("Yuki", "curly", "pink", "s4", "tunic", "purple"),
      orin: npc("Orin", "bald", "black", "s6", "robe", "silver", { glasses: "round" }),
    },
    steps: [
      {
        type: "free", npc: "nova", count: 2, title: "Help Starkeeper Nova",
        start: [["nova", "A visitor from the island? The shards fell here and hexed everything they touched."], ["nova", "Free 2 of these poor creatures, and I'll open the crystal gate."]],
        done: [["nova", "You have a kind heart, Signkeeper. The gate is open."]],
      },
      {
        type: "riddle", npc: "sven", word: "STAR", title: "Answer Sven's riddle",
        start: [["sven", "I carve ice into riddles. Answer mine to pass."], ["sven", "What twinkles in the night sky? Sign it!"]],
        done: [["sven", "S-T-A-R. Beautiful! Pass, friend."]],
      },
      {
        type: "find", npc: "mira", item: "Mira's star map", title: "Find Mira's star map",
        start: [["mira", "My star map blew away! It's the only way to find a path through these spires."]],
        done: [["mira", "My map! Look, it shows the way to the next gate."]],
      },
      {
        type: "deliver", npc: "frost", to: "yuki", item: "a warm scarf", title: "Bring Frost's scarf to Yuki",
        start: [["frost", "My sister Yuki is freezing up ahead. Please bring her my scarf!"]],
        done: [["yuki", "So warm! Thank you! I'll open the gate for you."]],
      },
      {
        type: "guard", npc: "orin", title: "Beat the hexed gate guard",
        start: [["orin", "The Glacier Wyrm is just beyond. Its guard is frozen in a terrible hex."]],
        done: [["orin", "Extraordinary! The Wyrm awaits. Stay warm, Signkeeper."]],
      },
    ],
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
        type: "free", npc: "zephyr", count: 2, title: "Help Zephyr calm the sky",
        start: [["zephyr", "The hexed creatures here keep stirring up storms!"], ["zephyr", "Free 2 of them, and I'll part the clouds for you."]],
        done: [["zephyr", "Blue skies again! The way is clear."]],
      },
      {
        type: "riddle", npc: "luna", word: "RAIN", title: "Answer Princess Luna's riddle",
        start: [["luna", "Welcome to the Cloud Kingdom. Only those who answer my riddle may pass."], ["luna", "What falls from clouds and makes puddles? Sign it!"]],
        done: [["luna", "R-A-I-N. Wise and brave! Go with my blessing."]],
      },
      {
        type: "deliver", npc: "gale", to: "puff", item: "a bag of sky seeds", title: "Bring Gale's sky seeds to Puff",
        start: [["gale", "Puff grows the cloud gardens, but the storm blew away all the seeds. Could you bring these?"]],
        done: [["puff", "Sky seeds! The gardens will grow back. Thank you!"]],
      },
      {
        type: "find", npc: "skye", item: "Skye's wind chime", title: "Find Skye's wind chime",
        start: [["skye", "My wind chime calms the storms. The hexed winds stole it!"]],
        done: [["skye", "My chime! Listen... the winds are already softer."]],
      },
      {
        type: "guard", npc: "thane", title: "Beat the hexed gate guard",
        start: [["thane", "The Storm Owl guards the next shard. Its gate guard has been hexed by Malgrath himself."]],
        done: [["thane", "Remarkable! The Storm Owl is next. The kingdom thanks you."]],
      },
    ],
  },

  void: {
    npcs: {
      echo: npc("Echo", "long", "black", "s4", "robe", "black", { eyes: "purple" }),
      vex: npc("Vex", "spiky", "purple", "s2", "tunic", "black"),
      sage: npc("The Last Sage", "bald", "white", "s6", "robe", "purple", { glasses: "round", hat: "hat-grad" }),
      lumi: npc("Lumi", "curly", "white", "s1", "tunic", "teal"),
      kai: npc("Kai", "short", "green", "s5", "tunic", "blue"),
      rook: npc("Rook", "spiky", "black", "s3", "robe", "black", { eyes: "gray" }),
    },
    steps: [
      {
        type: "free", npc: "echo", count: 2, title: "Help Echo",
        start: [["echo", "You can see me? Malgrath hexed everyone here. Most of them can't even see each other anymore."], ["echo", "Free 2 of them. Please. Then I'll show you the way in."]],
        done: [["echo", "They remember me now. Thank you. This way."]],
      },
      {
        type: "find", npc: "vex", item: "the Rift key", title: "Find the Rift key",
        start: [["vex", "Malgrath hid the Rift key somewhere in this area. Without it, nobody gets any closer."]],
        done: [["vex", "The Rift key! Let's open this thing."]],
      },
      {
        type: "riddle", npc: "sage", word: "QUEST", title: "Answer the Last Sage's riddle",
        start: [["sage", "I have waited a long time for a Signkeeper to come."], ["sage", "Tell me: what do you call a great journey to find something? Sign it!"]],
        done: [["sage", "Q-U-E-S-T. Yes. And yours is almost over."]],
      },
      {
        type: "deliver", npc: "lumi", to: "kai", item: "a spark of Signlight", title: "Bring Lumi's spark to Kai",
        start: [["lumi", "Kai is lost in the dark up ahead. Bring him this spark of Signlight so he can find his way."]],
        done: [["kai", "Light! I can see again! Thank you. The gate is right here."]],
      },
      {
        type: "guard", npc: "rook", title: "Beat the hexed gate guard",
        start: [["rook", "Told you I'd see you around. Malgrath is right past this gate."], ["rook", "He has my little sister hexed. I can't do this alone. Help me get through?"]],
        done: [["rook", "We did it. Now go stop him, {name}. For all of us."]],
      },
    ],
  },
};
