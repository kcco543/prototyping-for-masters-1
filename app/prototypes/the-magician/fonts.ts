/**
 * The 12 "spell" typefaces.
 *
 * `next/font/local` serves each font file from this project and gives it a
 * unique CSS font-family name, available as `font.style.fontFamily`.
 *
 * The files in ./fonts are *subsets*: they only contain basic Latin
 * characters (A–Z, a–z, 0–9, punctuation). That keeps them small; the
 * original Adobe Fan Heiti file alone was 5.5 MB.
 */

import localFont from "next/font/local";

export const adobeArabicBold = localFont({ src: "./fonts/adobe-arabic-bold.woff2", display: "block" });
export const adobeArabicItalic = localFont({ src: "./fonts/adobe-arabic-italic.woff2", display: "block" });
export const adobeFanHeitiBold = localFont({ src: "./fonts/adobe-fan-heiti-bold.woff2", display: "block" });
export const adobeHebrewBoldItalic = localFont({ src: "./fonts/adobe-hebrew-bold-italic.woff2", display: "block" });
export const barlowCondensedBlack = localFont({ src: "./fonts/barlow-condensed-black.woff2", display: "block" });
export const barlowCondensedItalic = localFont({ src: "./fonts/barlow-condensed-italic.woff2", display: "block" });
export const courierStdBold = localFont({ src: "./fonts/courier-std-bold.woff2", display: "block" });
export const helveticaBoldOutline = localFont({ src: "./fonts/helvetica-bold-outline.woff2", display: "block" });
export const pixolletta = localFont({ src: "./fonts/pixolletta-8px.woff2", display: "block" });
export const plaakLight = localFont({ src: "./fonts/plaak-21-light.woff2", display: "block" });
export const sairaCondensedExtraBold = localFont({ src: "./fonts/saira-condensed-extrabold.woff2", display: "block" });
export const academyEngraved = localFont({ src: "./fonts/academy-engraved.woff2", display: "block" });
