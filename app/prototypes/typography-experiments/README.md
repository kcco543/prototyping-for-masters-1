# Typography Experiments

Type a sentence and it becomes a big typographic poster. Move the mouse
(or drag a finger) over the letters: they get **pushed away** and spring
back, and the push also **reshapes each letter** through its variable-font
axes.

## How to run

From the project root:

```bash
npm run dev
```

Open http://localhost:3000/prototypes/typography-experiments

## What you can do

- **Type a sentence** (up to 48 characters). Each sentence generates its own
  poster: palette, accent letters, resting font settings and motion are all
  picked from the sentence. **Shuffle** rerolls them.
- **Treatments**
  - **Circle**: the text wraps around a slowly turning ring, with a giant
    first letter in the middle.
  - **3D Skew**: the text sits on a tilted plane with extruded letters;
    pushed letters lift up off the plane.
  - **Wave**: the lines ripple, and each letter tilts to follow the wave.
- **Variable fonts** (each has its own set of axes for the cursor to bend):
  - **Roboto Flex**: weight `wght`, width `wdth`, slant `slnt`, grade `GRAD`
  - **Fraunces**: weight, softness `SOFT`, "wonky" letters `WONK`, optical size `opsz`
  - **Recursive**: weight, casual `CASL`, monospace `MONO`, slant, cursive `CRSV`

The top-right corner of the poster shows the live axis values of the letter
closest to the cursor.

## How the mouse repulsion works

No library, just a little physics in `page.tsx`, run every frame:

1. Each letter has a **resting spot** (worked out in `letterLayout.ts`) plus
   an **offset** and a **velocity**.
2. If the cursor is within a radius `R` of a letter, the letter is pushed
   straight away from it. The closer it is, the stronger the push:
   `(1 − distance / R)²`.
3. A **spring** pulls every letter back to its spot, and **damping**
   (friction) stops it wobbling forever.
4. The same closeness (0 = far, 1 = touching) **blends the font axes** from
   their `rest` values to their `peak` values (see `fonts.ts`).

Try changing `SPRING`, `DAMPING` and `PUSH` at the top of `page.tsx`.

## Files

| File | What it does |
| --- | --- |
| `page.tsx` | The poster, the controls and the repulsion physics |
| `letterLayout.ts` | Fits the sentence to the poster and places each letter (ring, lines) |
| `fonts.ts` | The three variable fonts and how the cursor moves their axes |
| `styles.module.css` | Poster, 3D plane, extruded letters, controls |

Note: the layout file is called `letterLayout.ts`, not `layout.ts`. In the
Next.js App Router, a file named `layout.ts` inside a route folder is treated
as the page's layout component, and the page would crash.
