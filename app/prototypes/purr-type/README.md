# Purr Type

A PixiJS version of the typography experiment. Type a word and it appears
in big hand-lettered letters. Every letter **purrs**: a gentle, rapid
tremble (~25 Hz, like a real cat) that rises and falls in slow
"breathing" waves. Move the mouse over the word and the letters **scatter
away**, spinning as they're knocked aside, then spring back and settle.

## How to run

From the project root:

```bash
npm install
npm run dev
```

Open http://localhost:3000/prototypes/purr-type

## How it works

- **SplitText** turns the word into one display object per letter, so each
  letter can be moved, rotated and tinted on its own.
- **Scatter physics** (every frame): each letter has an offset and a
  velocity. The mouse pushes nearby letters away (stronger when closer), a
  spring pulls them back home, and damping stops the wobble. Tune with
  `SPRING`, `DAMPING`, `PUSH` and `REACH` at the top of `page.tsx`.
- **Purr**: a tiny sine-wave tremble per letter (`PURR_HZ`, `PURR_PX`), each
  letter slightly out of step, scaled by a slow breathing curve.
- **Mouse input** uses PixiJS's event system: `app.stage.eventMode = "static"`,
  `hitArea = app.screen`, and the `globalpointermove` event.

## SplitText vs SplitBitmapText: which one, and why

You can switch engines in the app, and **Run benchmark** measures both live.

| Measured in the browser | SplitText (`Text`) | SplitBitmapText (`BitmapText`) |
| --- | --- | --- |
| Build a 5-letter word | 0.2–0.4 ms | 0.1–0.2 ms |
| Build ~170 letters | 2.4–3.6 ms | 2.6–3.1 ms |
| One frame animating ~170 letters | 0.06–0.09 ms | 0.06–0.07 ms |
| Graphics memory for the font | only the letters on screen (a few MB for one word) | ~40 MB atlas (10 × 1024² textures) for the full character set at 170 px |
| Sharpness when scaled up | re-drawn at the new resolution: always sharp | fixed atlas: softens when scaled past its size |
| Styling | everything (gradients, strokes, shadows…) | limited (solid fill to allow tinting, black shadow) |

**Picked: SplitText.**

- **Performance is a tie at this scale.** A word is a handful of letters,
  rebuilt only when you type, and each build is well under a millisecond.
  The per-frame purr and scatter are pure transforms (position/rotation),
  which cost the same for both. Within a word, SplitText draws each unique
  letter once and reuses it.
- **Quality and memory decide it.** For huge letters, BitmapText has to
  pre-draw every character at that size (about 40 MB here), and it can't
  stay sharp when the word is scaled up. SplitText draws only what's on
  screen, at exactly the right resolution.

**When to switch to SplitBitmapText:** long or many strings that change
often, like paragraphs, live counters or chat bubbles, especially at
small-to-medium sizes. Then rebuild cost dominates, and the shared atlas
pays for itself.

## Files

| File | What it does |
| --- | --- |
| `page.tsx` | PixiJS setup, both text engines, the purr/scatter physics, the benchmark |
| `styles.module.css` | Page, controls and benchmark panel |
