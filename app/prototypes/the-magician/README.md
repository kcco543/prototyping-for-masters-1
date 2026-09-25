# The Magician

Summon a cat through typography.

1. **Choose a spell.** Scroll the mouse wheel over the stage to cycle the
   word "cat" through 12 typefaces, each with its own personality. You can
   also swipe (on touch screens), press the ↑ ↓ arrow keys, use the ↑ ↓
   buttons, or tap a font in the list.
2. **Reveal.** The letters float away in a puff of sparkles, and the cat
   that matches the font appears. The page explains which qualities of the
   font turned into which qualities of the cat.

## How to run

From the project root:

```bash
npm install
npm run dev
```

Open http://localhost:3000/prototypes/the-magician (or click
**The Magician** on the homepage).

## Font → cat pairings

| Typeface | Personality | Cat |
| --- | --- | --- |
| Adobe Arabic Bold | Calligraphic, classic, warm | The Scholar (fluffy longhair) |
| Adobe Arabic Italic | Flowing, romantic, graceful | The Romantic (walking with a flower) |
| Adobe Fan Heiti Std Bold | Solid, heavy, calm | The Night Loaf (black cat; 黑体 means "black type") |
| Adobe Hebrew Bold Italic | Bold, dynamic, punchy | The Showstopper (striped sweater and swooshing tail) |
| Barlow Condensed Black | Tall, narrow, heavy | The Skyscraper (tall black cat) |
| Barlow Condensed Italic | Slim, sleek, on the move | The Stroller (slender green cat walking) |
| Courier Std Bold | Monospaced, typewriter, methodical | The Librarian (round glasses) |
| Helvetica 75 Bold Outline | Hollow, modern, minimal | The Outline (white cat drawn with lines) |
| Pixolletta 8px | Pixelated, retro, digital | The Pixel Skater (pixel sunglasses, boxy body) |
| Plaak 21 Light | Quirky, experimental, graphic | The Avant-Garde (spiral target) |
| Saira Condensed ExtraBold | Sporty, fast, squared | The Athlete (striding ginger cat) |
| Academy Engraved LET | Engraved, formal, Victorian | The Aristocrat (tuxedo cat) |

## Files

| File | What it does |
| --- | --- |
| `page.tsx` | The interaction: wheel, swipe and keyboard input, plus the choose → casting → revealed phases |
| `spells.ts` | The 12 font + cat pairings and their descriptions |
| `fonts.ts` | Loads the 12 font files with `next/font/local` |
| `fonts/` | The font files, subset to basic Latin characters to keep them small |
| `images/` | The cats as square, circle-ready portraits cropped from the three reference illustrations |
| `make-portraits.py` | The script that made those portraits (see below) |
| `sound.ts` | The tick and "spell" sounds (Web Audio API, no audio files) |
| `styles.module.css` | Layout, stage, and all the animations |

## Adding a new spell

1. Put a `.woff2`, `.ttf` or `.otf` file in `fonts/` and add a line for it in `fonts.ts`.
2. Put a cat image in `images/`.
3. Add an entry to the `SPELLS` list in `spells.ts`.

## How the cat portraits were made

`make-portraits.py` (Python + OpenCV) turns each crop into a portrait that
fits the round frame:

1. **Removes watermark text** from the Shutterstock illustration. It finds
   the greyish watermark pixels inside hand-marked zones and refills each
   one with the colour most common among its clean neighbours, which keeps
   edges crisp. It also redraws the top of one leg the watermark crossed.
2. **Finds the cat**: all pixels that differ from the background, plus
   nearby parts (a flower, a skateboard, tail stripes).
3. **Erases neighbouring cats** that poke into the picture.
4. **Fits the cat in the circle**: it computes the smallest circle around
   the cat, then scales and centres the image so that circle is 90% of the
   frame. The cat can never touch or cross the edge.

To run it again you need Python with `opencv-python-headless` and `numpy`:

```bash
python make-portraits.py <folder with 3.webp, 4.jpg, 5.jpg> images <debug folder>
```

## ⚠️ Licensing note

Some fonts and images here are licensed for personal/local use only:

- **Adobe Arabic, Adobe Fan Heiti, Adobe Hebrew and Courier Std** came
  bundled with Adobe InDesign.
- **Academy Engraved LET** is a macOS system font.
- **Plaak** is a trial version.
- **Helvetica 75 Bold Outline** came from a free-font download site.
- The cat illustrations are other artists' work, and one of them is a
  watermarked Shutterstock preview. The visible watermark text has been
  removed from the crops, but that doesn't change the licence: the image
  still needs to be licensed before it's published.

Fine for a class prototype on your own computer. Before publishing the site
or pushing it to a public repository, check each license or swap in openly
licensed fonts and images. Barlow Condensed and Saira Condensed are both
under the SIL Open Font License, which does allow this.
