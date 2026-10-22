Detailed creature art: `<creature id>.png` (ids are in `CREATURES` in
`js/config.js`). A creature with a picture here uses it everywhere; one
without keeps its built-in text sprite from `js/sprites.js`. Hexed and evolved
versions are made from the picture automatically.

How these were made:

1. Generate a picture (we used Canva's image generator) with this prompt,
   filling in the creature:

   > 16-bit pixel art game sprite of {name}, {what it looks like}. Fantasy RPG
   > creature style, full body, front-facing, centered, bold dark outline, rich
   > pixel shading with highlights and rim light, vibrant colors. Plain flat
   > white background, no text, no ground shadow, single character only.

   (Use "boss monster style" for bosses.)

2. Turn it into a game sprite:

       python tools/pixelize_creature.py picture.png assets/creatures/<id>.png --size 80 --colors 32

   Bosses: `--size 96 --colors 40`. Needs `pip install pillow`.
