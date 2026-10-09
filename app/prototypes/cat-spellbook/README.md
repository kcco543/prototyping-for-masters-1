# Cat Spellbook

A magical doodling page. You draw inside an enchanted storybook while three
small cats watch from its border and sometimes come over to investigate.

Built with **p5.js** (drawing and sparkles) and **Tone.js** (music-box sounds).

## How to run

From the project root:

```bash
npm install
npm run dev
```

Open http://localhost:3000/prototypes/cat-spellbook

## What you can do

**Five brushes**

| Brush | What it does |
| --- | --- |
| Magic Quill | Smooth ink whose width gently changes: thinner when you move fast |
| Paw Stamp | A trail of alternating left/right paw prints along your path |
| Yarn Brush | A soft, lazy thread that trails behind the cursor |
| Stardust | Small stars and dots, with a few sparkles that fade away |
| Cat Tail | A springy, striped stroke that swishes and overshoots like a tail |

**Tools:** six inks, a size slider, Undo, Redo, Clear (Undo brings a cleared
page back), and Save (a PNG picture). Shortcuts: ⌘/Ctrl+Z to undo, ⇧⌘Z or
Ctrl+Y to redo. Works with a mouse, trackpad, pen or finger.

**The cats** live on the page's border, never on your drawing. After you
finish a stroke, one may glance at it. Yarn and stars are especially
tempting: a cat may stroll along the bottom border, stand under them and tap
upwards. While you are drawing, they stay still and just watch.

**Sound** is off by default. Switch it on (top right) and each brush plays
quiet notes from a pentatonic scale as you draw; the higher on the page, the
higher the note.

**Cast a Spell** (the face-down deck on the tool card) makes the whole
drawing glow softly, then turns over an illustrated tarot card with a small
cat-flavoured reading. There are thirteen cards, each with its own picture.

## The look

The page is meant to feel like an old illustrated storybook, not like an
app. A few rules keep it that way:

- **Three paper objects on a dark endpaper.** The page you draw on, the tall
  tool card, and the tarot card are all parchment. Nothing else has a box
  around it: the sound switch and Undo/Redo/Clear/Save are just words.
- **A small palette.** Midnight blue, parchment, antique gold, and the two
  soft colours the cats wear (muted pink and sage). Colours are flat: no
  glossy gradients and no glow. Texture comes from paper grain instead.
- **One typeface.** IM Fell English, a 17th-century printing type, in
  regular, italic and small capitals.
- **Lines drawn "by hand".** Border lines on the page wobble very slightly,
  and the SVG pictures pass through a filter that nudges every line a
  little, so nothing is perfectly straight or perfectly round.
- **Small surprises.** Each brush icon does a tiny trick when you point at
  it, a gold star slides to the brush you pick, the top card of the deck
  lifts, the bell rings when you switch sound on, the caption under the
  page describes the brush you are holding, the full moon at the top of the
  page has ears, and one of the constellations is a cat.

## How it works

- **Strokes are data.** Every stroke is saved as a list of points or stamps
  (`brushes.ts`). Undo, redo and clear just change that list and repaint.
  Positions are stored as fractions of the page, so the drawing rescales
  when the window changes size.
- **Layers** (`sketch.ts`). The paper and its hand-ruled border are painted
  once; so is the celestial disc, which is then drawn slowly rotating. Finished strokes go
  on their own "ink" layer. Each frame only redraws those layers plus the
  few live things: the stroke in progress, sparkles and cats. This keeps
  strokes steady during animation and keeps it fast.
- **The cats** (`cats.ts`) are a small state machine:
  rest → notice → walk → tap → home. Ink is clipped to the inside of the
  frame, and the cats stand on the border, so they can't cover your drawing.
  Each cat has its own coat: cream-tipped, tabby, or starry.
- **Illustrations are code** (`art.tsx`). The icons, the back of the deck and
  the thirteen card pictures are SVG, built from a few shared pieces (a
  sitting cat, a curled-up cat, a star, a crescent), which is why they all
  look like they were drawn by the same hand. Textures (paper grain, the
  endpaper's star pattern) are tiny SVGs written into the CSS, so there are
  no image files to load.
- **The card flip** is plain CSS: the card has a front and a back placed
  back to back, and an animation turns it over.
- **Sound** (`sound.ts`). Tone.js is only loaded the first time sound is
  switched on, inside the click, so nothing audio-related runs before a user
  interaction. Notes are rate-limited so the music stays gentle.

## Files

| File | What it does |
| --- | --- |
| `page.tsx` | The interface: tool card, sound switch, spell card |
| `art.tsx` | The SVG illustrations: brush icons, deck, ornaments, the 13 card pictures |
| `sketch.ts` | The p5 sketch: page, disc, input, layers, undo/redo, spell glow |
| `brushes.ts` | The five brushes, the palette, and how each stroke is drawn |
| `cats.ts` | How the cats look and behave |
| `sound.ts` | The Tone.js instruments and scale |
| `spells.ts` | The "Cast a Spell" cards and messages (add your own) |
| `styles.module.css` | Layout, colours, textures and animations |

## Things to tweak

- `PALETTE` and `BRUSHES` in `brushes.ts`
- `SPELLS` in `spells.ts`, and their pictures in `SCENES` in `art.tsx`
- The colours at the top of `styles.module.css` (`--midnight`, `--gold`, ...)
- In `art.tsx`, the `scale` values in `InkFilters` set how wobbly the
  hand-drawn lines are (0 makes them perfectly smooth)
- `SCALE` and `VOICING` in `sound.ts` (try a different scale)
- In `cats.ts`, the `0.65` in `noticeStroke` is how often a cat notices a stroke
- In `sketch.ts`, `discAngle += dt * 0.02` is how fast the disc turns

## Notes

- The cats are simple vector drawings made for this page, in the same flat
  style and palette as the homepage cats (those are React/SVG components,
  not image files, so they can't be animated inside a p5 canvas).
- This uses p5.js 1.x (the stable line). p5's `Graphics.remove()` crashes in
  instance mode, so the offscreen layers are created once and resized.
