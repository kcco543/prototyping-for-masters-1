# The Tower

A small catch-the-cups game. A curious cat hops onto shelves of patterned
cups. When it brushes past a cup, the cup may start to wobble and fall.
Move the hand to catch it before it hits the floor.

- Catch all 8 falling cups → the cat meows happily and you win.
- If a cup hits the floor, it shatters and the game restarts right away.

## How to run

From the project root:

```bash
npm install
npm run dev
```

Then open http://localhost:3000/prototypes/the-tower (or click **The Tower**
on the homepage).

## How to play

- **Mouse:** move the mouse over the scene. The hand follows it.
- **Touch:** drag your finger over the scene.
- Watch for a cup that **wobbles**. That's your warning that it's about to fall.

## Files

| File | What it does |
| --- | --- |
| `page.tsx` | Game logic: the cat's movement, falling cups, catching, winning and restarting |
| `art.tsx` | All the drawings (cups, shelves, background, cat, hand) as SVG shapes |
| `sound.ts` | Meow, catch, crash and rattle sounds, made with the Web Audio API (no audio files) |
| `styles.module.css` | Layout, overlays and the cat/hand animations |

## Things to tweak

At the top of `page.tsx`:

- `DROPS_PER_ROUND`: how many cups fall per round (default 8)
- `GRAVITY` / `MAX_FALL_SPEED`: how fast cups fall
- `LOOSEN_CHANCE`: how clumsy the cat is (0 to 1)

To change the cups, edit the `CUPS` list in `art.tsx`. Each cup has a shape
(`teacup`, `mug` or `bowl`), a body colour and a pattern.
