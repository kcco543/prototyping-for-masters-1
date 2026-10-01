/**
 * Three VARIABLE fonts.
 *
 * A variable font is one font file that can smoothly change its design along
 * "axes", e.g. weight (wght) from thin to black, or width (wdth) from
 * condensed to wide. Each axis has a 4-letter tag. Registered axes are
 * lowercase (wght, wdth, slnt, opsz); custom ones are UPPERCASE (SOFT, WONK…).
 *
 * In this prototype, the mouse pushes each letter along these axes:
 * `rest` is how a letter looks normally, `peak` is how it looks when the
 * cursor is right on top of it. Everything in between is blended.
 *
 * `axes: [...]` asks Next.js to include the extra axes in the font file
 * (weight is always included for variable fonts).
 */

import { Fraunces, Recursive, Roboto_Flex } from "next/font/google";

const robotoFlex = Roboto_Flex({ subsets: ["latin"], axes: ["wdth", "slnt", "GRAD", "opsz"], display: "block" });
const fraunces = Fraunces({ subsets: ["latin"], axes: ["SOFT", "WONK", "opsz"], display: "block" });
const recursive = Recursive({ subsets: ["latin"], axes: ["CASL", "CRSV", "MONO", "slnt"], display: "block" });

export type AxisRange = { tag: string; min: number; max: number };

export type FontSpec = {
  key: "flex" | "fraunces" | "recursive";
  name: string;
  family: string;
  /** Which axes the cursor plays with, and the range each one can move in */
  axes: AxisRange[];
  /** Pick the resting value of each axis (rnd gives 0–1, from the sentence's seed) */
  rest: (rnd: () => number) => Record<string, number>;
  /** Where each axis goes when the cursor is right on the letter */
  peak: (rnd: () => number) => Record<string, number>;
};

export const FONTS: FontSpec[] = [
  {
    key: "flex",
    name: "Roboto Flex",
    family: robotoFlex.style.fontFamily,
    axes: [
      { tag: "wght", min: 100, max: 1000 },
      { tag: "wdth", min: 25, max: 151 },
      { tag: "slnt", min: -10, max: 0 },
      { tag: "GRAD", min: -200, max: 150 },
    ],
    rest: (r) => ({ wght: 250 + r() * 450, wdth: 70 + r() * 60, slnt: 0, GRAD: 0 }),
    // near the cursor: black weight, squeezed or stretched, leaning, extra grade
    peak: (r) => ({ wght: 1000, wdth: r() < 0.5 ? 25 : 151, slnt: -10, GRAD: 150 }),
  },
  {
    key: "fraunces",
    name: "Fraunces",
    family: fraunces.style.fontFamily,
    axes: [
      { tag: "wght", min: 100, max: 900 },
      { tag: "SOFT", min: 0, max: 100 },
      { tag: "WONK", min: 0, max: 1 },
      { tag: "opsz", min: 9, max: 144 },
    ],
    rest: (r) => ({ wght: 150 + r() * 350, SOFT: 0, WONK: 0, opsz: 144 }),
    // near the cursor: heavy, soft and rounded, with Fraunces' quirky "wonky" letters
    peak: () => ({ wght: 900, SOFT: 100, WONK: 1, opsz: 9 }),
  },
  {
    key: "recursive",
    name: "Recursive",
    family: recursive.style.fontFamily,
    axes: [
      { tag: "wght", min: 300, max: 1000 },
      { tag: "CASL", min: 0, max: 1 },
      { tag: "MONO", min: 0, max: 1 },
      { tag: "slnt", min: -15, max: 0 },
      { tag: "CRSV", min: 0, max: 1 },
    ],
    rest: (r) => ({ wght: 350 + r() * 300, CASL: 0, MONO: r() < 0.5 ? 1 : 0, slnt: 0, CRSV: 0 }),
    // near the cursor: heavy, casual (brushy), slanted and cursive
    peak: (r) => ({ wght: 1000, CASL: 1, MONO: r() < 0.5 ? 0 : 1, slnt: -15, CRSV: 1 }),
  },
];

/** Turn axis values into the CSS `font-variation-settings` string. */
export function variationSettings(values: Record<string, number>) {
  return Object.entries(values)
    .map(([tag, v]) => `"${tag}" ${tag === "WONK" || tag === "CASL" || tag === "MONO" || tag === "CRSV" ? v.toFixed(2) : Math.round(v)}`)
    .join(", ");
}
