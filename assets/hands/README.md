Handshape pictures for learn cards and hints: `A.svg`, `B.svg`, ... `Y.svg`
(no J or Z).

They're drawn from our own recorded hands, not photos:

    python tools/make_hand_hints.py

Each one is the most typical recorded sample of that letter in
`training/data/`, drawn as a cartoon hand (mirrored, like the game's camera)
with arrows pointing at what matters. Edit `CALLOUTS` in that script to change
the labels, and re-run it after recording more to redraw them.

Any letter without a picture just shows the tip text.
