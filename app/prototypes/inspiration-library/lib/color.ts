/**
 * Colour helpers for the "By colour" view: turning a hex code into hue,
 * saturation and lightness, and sorting items into a gradient.
 *
 * WHY HSL?
 * A hex code like #d4532f says how much red, green and blue light to mix,
 * which is how screens work but not how people see colour. HSL describes
 * the same colour as:
 *   hue         where it sits on the colour wheel, 0–360° (0 red, 120 green, 240 blue)
 *   saturation  how colourful it is, 0–1 (0 is grey)
 *   lightness   how light it is, 0–1 (0 black, 1 white)
 * Sorting by hue walks round the colour wheel, which looks like a rainbow.
 */

export type Hsl = { h: number; s: number; l: number };

/** "#d4532f" → { h: 13, s: 0.64, l: 0.51 } */
export function hexToHsl(hex: string): Hsl {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l }; // a grey: no hue at all

  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

/**
 * Greys, near-whites and near-blacks have no colour worth sorting by hue (a
 * tiny tint would put a white photo among the blues), so they go together
 * after the rainbow, from light to dark.
 */
function isNeutral({ s, l }: Hsl): boolean {
  return s < 0.15 || l < 0.08 || l > 0.94;
}

/**
 * Items in gradient order: colourful ones round the colour wheel (red,
 * orange, yellow, green, blue, purple, pink), then the neutrals from white
 * to black, then items without a colour (links, or pictures that couldn't
 * be read) in their usual order.
 */
export function sortByColor<T extends { dominantColor: string | null }>(items: T[]): T[] {
  const colourful: { item: T; hsl: Hsl }[] = [];
  const neutral: { item: T; hsl: Hsl }[] = [];
  const none: T[] = [];

  for (const item of items) {
    if (!item.dominantColor) {
      none.push(item);
      continue;
    }
    const hsl = hexToHsl(item.dominantColor);
    (isNeutral(hsl) ? neutral : colourful).push({ item, hsl });
  }

  // Start the wheel just before red (at 345°), so deep pinks that wrap round
  // to 350° sit at the end next to the purples, not before the reds.
  const START = 345;
  const turn = (h: number) => (h - START + 360) % 360;
  colourful.sort((a, b) => turn(a.hsl.h) - turn(b.hsl.h) || b.hsl.l - a.hsl.l);
  neutral.sort((a, b) => b.hsl.l - a.hsl.l);

  return [...colourful.map((x) => x.item), ...neutral.map((x) => x.item), ...none];
}
