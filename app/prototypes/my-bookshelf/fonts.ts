/**
 * A Constellation of Stories — the literary serif.
 *
 * Cormorant Garamond: a tall, high-contrast Garamond, for the headings, book
 * titles, constellation names and the small spaced capitals of the star
 * chart. It's available to the CSS as var(--font-cormorant).
 *
 * Interface text (buttons, the search box, numbers) uses Instrument Sans,
 * the quiet sans-serif shared with the rest of the site (see app/fonts.ts).
 */

import { Cormorant_Garamond } from "next/font/google";

export const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-cormorant",
});
