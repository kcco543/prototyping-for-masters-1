# WANT — A Church of Consumption

Five Swiss Style (International Typographic Style) posters for **WANT**, a
campaign that connects consumerism → overconsumption → waste through a
religious metaphor: shopping is worship, the store is a temple, and the
receipt is a *record of consumption*, not a proof of purchase.

| # | Slogan | Swiss Style reference |
| --- | --- | --- |
| 01 | Confess Your Consumption. | "the jam": giant overlapping letterforms, figure/ground |
| 02 | Every Purchase Leaves a Trace. | Kunsthaus Glarus: monospace lists overprinted on a halftone photo |
| 03 | Your Receipt Knows Your Sins. | "deep": negative space, one red word, receipt as typography |
| 04 | Consume. Confess. Repeat. | "The Scream of the Sheep": empty top, split headline, a crowd |
| 05 | The Sins of Consumption. | "deep": numbered columns, square crops, one oversized word |

The page also lists the Swiss Style elements found in the reference posters
and which poster uses each one.

## How to run

From the project root:

```bash
npm install
npm run dev
```

Open http://localhost:3000/prototypes/want-posters (or click **WANT** on the
homepage). Click a poster to view it full screen; use ← → to browse and Esc
to close.

## How it's built

- `posters.tsx` — the five posters. Every size is in `cqw` units
  (1cqw = 1% of the poster's width), so each poster scales like a printed
  proof at any size.
- `halftone.tsx` — draws "photographs" as halftone dots from small math
  functions (a planet, a landfill), since the series uses no image files.
- `fonts.ts` — Inter Tight (grotesque sans) and IBM Plex Mono.
- `posters.module.css` / `styles.module.css` — poster and page styles.

To print or export a poster, open it full screen and take a screenshot, or
use the browser's print dialog.
