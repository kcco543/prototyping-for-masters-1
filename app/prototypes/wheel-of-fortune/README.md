# Wheel of Fortune

A little yarn oracle. Silently think of a question, then tap the cat. It
swats its ball of yarn, the ball rolls away unravelling, and the loose
thread writes out your answer in joined-up handwriting, one letter at a
time. Tap **Ask another question** and the yarn winds itself back up.

## How to run

From the project root:

```bash
npm install
npm run dev
```

Open http://localhost:3000/prototypes/wheel-of-fortune (or click
**Wheel of Fortune** on the homepage).

You can also focus the cat with **Tab** and press **Enter** or **Space**.

## How the yarn writing works

1. **A single-stroke font.** Normal fonts are outlines (every letter has an
   inside and an outside edge), which a thread can't trace. `glyphs.ts`
   holds a *single-line* cursive font, EMS Allure, where each letter is
   the path a pen would travel.
2. **One continuous thread.** `thread.ts` lays the answer out on a few
   centred lines and joins every pen stroke into one long line. Wherever a
   pen would normally lift (between words, dotting an *i*, crossing a
   *t*), it adds a gently sagging loop of slack yarn instead.
3. **Unravelling.** Each frame, `page.tsx` reveals the thread up to a
   certain distance (using the SVG `stroke-dashoffset` trick) and moves the
   ball to that exact point. The ball spins as it rolls and shrinks as the
   yarn is used up. The cat's eyes follow the ball.

## Files

| File | What it does |
| --- | --- |
| `page.tsx` | Phases (idle → swat → writing → answered → rewinding) and the animation loop |
| `thread.ts` | Turns a sentence into one continuous yarn path |
| `glyphs.ts` | The single-stroke cursive letters (EMS Allure) |
| `answers.ts` | The list of answers; add or edit your own here |
| `art.tsx` | The cat and the yarn ball, drawn in SVG |
| `styles.module.css` | Layout and the cat's little animations (breathing, blinking, swatting) |

## Credits

- Style inspired by a "Playful Cat" illustration (used as a visual
  reference only; the artwork here is drawn from scratch).
- The answers are inspired by the idea of *The Book of Answers*, but they
  are original lines.
- **EMS Allure** font: Sheldon B. Michaels, derived from *Allura* by Rob
  Leuschke (TypeSETit). SVG conversion by Windell H. Oskay (Evil Mad
  Scientist Laboratories). SIL Open Font License 1.1. Extracted from the
  MIT-licensed `hersheytext` package.
