# Grain Light Card

A holographic card, like a foil trading card or a special-edition tarot card.
Its engraved lines flash with rainbow light as the light crosses them. Tilt it
with your mouse (or your phone), and click or tap it to turn it over.

- **Address:** <http://localhost:3000/prototypes/grain-light-card>
- **Card shown:** tarot card 0, The Fool, with a patterned back

## Run it

```bash
npm run dev
```

Then open the address above. Open **Show controls** at the bottom to change:

| Control | What it does |
| --- | --- |
| Side | Show the front or the back (clicking the card does the same) |
| Theme | Pearl card (Light) or black lacquer card (Dark) |
| Flash | How strongly the lines lying across the light flash |
| Foil | A gentle rainbow on every line, all the time |
| Glare | The soft highlight that follows your pointer |
| Sparkle | Glitter around the highlight |
| Tilt | How far the card leans, in degrees |
| Auto sweep | When nobody touches the card, the light slowly circles it |

## Files

| File | What it does |
| --- | --- |
| `../../../components/ui/grain-light-card.tsx` | **The card component**, reusable anywhere in the project |
| `GrainLightCardDemo.tsx` | The demo: The Fool's line art, the back's pattern, and the controls |
| `page.tsx` | The page: the "back home" button and the demo |
| `styles.module.css` | The page and the control panel's styles |

## Using the card somewhere else

```tsx
import { GrainLightCard } from "@/components/ui/grain-light-card";

<GrainLightCard
  label="Membership card"
  width="min(300px, 70vw)"
  front={<svg viewBox="0 0 280 480" fill="none" stroke="var(--glc-line)" strokeWidth={0.6}>…</svg>}
  back={<svg viewBox="0 0 280 480">…</svg>} // optional: makes it flippable
/>
```

- **Draw with strokes.** Only lines (strokes) flash. Shapes that were
  turned into filled outlines, which is common in exported icons, don't.
- **Colours to draw with:** `var(--glc-line)`, `var(--glc-line-strong)` and
  `var(--glc-ink)`. They switch with the card's Light and Dark theme.
- **A filled shape hides the lines behind it.** Fill it with
  `var(--glc-stock-2)` so it blends into the card.
- Pictures and `<text>` show as they are, without the flash.
- It's a client component (`"use client"`) and needs nothing but React.
- **`foilColors`** (optional) replaces the rainbow the light cycles through,
  e.g. a few golds for a printed-foil look. Leave it out for the rainbow.
  (Added for the gold cards in `../a-reading-for-yourself`.)

**Used in:** this demo, and the three cards of *A Reading for Yourself*
(`../a-reading-for-yourself/FoilTarotCard.tsx`).

## How the component was added

The component was written for projects set up with **shadcn/ui** and
**Tailwind CSS**. This project uses neither, and that's fine:

- **TypeScript:** already set up (`tsconfig.json`).
- **Where it lives: `components/ui/`.** shadcn puts components in
  `components/ui`, and other components written for shadcn import from
  `@/components/ui/…`. In this project, `@/` means the project's top folder
  (`"@/*": ["./*"]` in `tsconfig.json`), so the component sits in the top
  folder's `components/ui/`. That keeps the demo's import line working
  unchanged, and gives future shadcn-style components a predictable home.
  (This project's own shared pieces, like the "back home" button, stay in
  `app/components/`.)
- **Tailwind was not installed.** The card itself doesn't use Tailwind: it
  carries its own CSS. Only the demo's control panel did. Installing Tailwind
  would add its style reset to the whole site and could change how the other
  prototypes look, so instead each Tailwind class in the demo was replaced by
  a class in `styles.module.css` that looks the same.
- **shadcn's theme colours** (`--foreground`, `--ring`) are optional for the
  card: without them it uses its own defaults. The control panel's colours
  are defined at the top of `styles.module.css`.
- **No packages to install, no images or icons needed:** the artwork is
  line-art SVG drawn in code.

If you ever want real Tailwind and shadcn in this project, run
`npx shadcn@latest init` in the top folder: it installs Tailwind, creates
`components.json` and `components/ui`, and adds the theme colours to
`app/styles/globals.css`. Check every prototype afterwards, because
Tailwind's reset applies to all pages.
