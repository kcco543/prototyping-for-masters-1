# A Reading for Yourself

An interactive Tarot divination prototype designed for creators, designers, and engineers.

## Overview

This prototype draws from the Major Arcana to offer creative insight and reflection. Users can click to shuffle the celestial deck, flipping an authentic 3D Tarot card with tactile animations and custom interpretation prompts tailored to the craft of prototyping.

## Setup & Running

This prototype runs as part of the Next.js workspace:

```bash
npm run dev
```

Navigate to:
`http://localhost:3000/prototypes/a-reading-for-yourself`

## Restored, with gold-foil cards

This prototype was removed on 25 September 2026 (commit `c8108a0`) and
restored from git history, unchanged, so its cards could be printed in gold
foil. Its homepage card is in `app/data/projects.ts`, and its Cinzel font is
back in `app/fonts.ts`.

### The foil cards

Each of the three cards is now a `FoilTarotCard` (`FoilTarotCard.tsx`),
which wraps the shared **Grain Light Card** component
(`components/ui/grain-light-card.tsx`):

- **Move your cursor over a card:** it tilts a little in 3D, a soft
  highlight follows the cursor, and the engraved gold lines catch the light.
- **Before you reveal a card:** a slow, faint light drifts across its back.
- **Reveal it** (click or tap the card, press Enter or Space on it, or use
  the Reveal button): it lifts, tilts and turns over in 3D. One band of
  golden light sweeps across the face, then the card rests and only answers
  your cursor.
- **Reset & Deal:** the cards turn edge-on while the new spread is dealt,
  as before.

The reading itself is unchanged: the same ten cards, the three positions
(Origin, Catalyst, Horizon), revealing in order, the random draw, the
interpretations and prompts. Every card is drawn upright; this reading has
no reversed cards.

### How it's built

| Layer | What it does |
| --- | --- |
| `.tarotCardWrapper` | The hover lift and the gentle bob of the next card (as before) |
| `.shuffleLayer` | Turns the card edge-on while a new spread is dealt |
| `FoilTarotCard` | The tilt, the light and the 3D flip (Grain Light Card) |

Three separate layers, so their movements never fight over one CSS
`transform`. The card's old CSS flip (`.tarotCardInner`) is gone: Grain
Light Card turns the card over now.

- **Gold, not rainbow.** `foilColors` gives Grain Light Card a few warm
  golds and a hint of lilac instead of its default rainbow, and every
  setting (`flash`, `foil`, `glare`, `sparkle`, `maxTilt`) is turned down,
  so it reads as foil printed on paper rather than a hologram.
- **Engraved lines catch the light.** Only SVG *strokes* flash. The cards'
  frames used to be CSS borders; they're now SVG lines (`CardBackLines` and
  `CardFaceLines` in `FoilTarotCard.tsx`), plus a fine halo of rays around
  the star on the back and small diamonds on the face's frame. The text and
  glyphs are the same HTML as before, on top.
- **Card stock** is the page's own violet-black, set through Grain Light
  Card's `--glc-stock-*` / `--glc-back-*` variables.
- **Phones:** tap a card to turn it over. Swiping up or down over a card
  still scrolls the page (`touch-action: pan-y`), and tilting the phone
  tilts the cards.
- **Reduced motion:** if your device asks for less motion, the light holds
  still, cards turn over without animating, and the bob, pulse and shimmer
  are switched off.
- **Performance:** each card only animates while it's on screen and the tab
  is visible.

### Known issue (from before)

The slowly turning star chart in the background is drawn with very precise
numbers that the server and the browser round slightly differently, so the
dev tools show a "hydration mismatch" warning. It doesn't change how the
page looks or works.
