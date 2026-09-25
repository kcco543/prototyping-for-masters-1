/**
 * Each "spell" pairs one typeface with the cat it summons.
 *
 * `traits` describe the font's personality (shown while choosing).
 * `transforms` explain the magic: which font quality became which cat
 * quality (shown after the reveal).
 *
 * The cat images are cropped from the three reference illustrations and
 * live in ./images. Each one is a square portrait with the cat centred and
 * sized to fit inside the round frame (see make-portraits.py). `portal` is
 * the background colour of each picture, shown behind it while it loads.
 */

import type { StaticImageData } from "next/image";
import * as F from "./fonts";

import scholar from "./images/scholar.webp";
import romantic from "./images/romantic.webp";
import nightLoaf from "./images/night-loaf.webp";
import showstopper from "./images/showstopper.webp";
import skyscraper from "./images/skyscraper.webp";
import stroller from "./images/stroller.webp";
import librarian from "./images/librarian.webp";
import outline from "./images/outline.webp";
import pixelSkater from "./images/pixel-skater.webp";
import avantGarde from "./images/avant-garde.webp";
import athlete from "./images/athlete.webp";
import aristocrat from "./images/aristocrat.webp";

export type Spell = {
  font: string;
  fontFamily: string;
  /** Optical size correction, because some fonts look much bigger/smaller at the same size */
  scale: number;
  traits: [string, string, string];
  cat: {
    name: string;
    image: StaticImageData;
    alt: string;
    portal: string;
  };
  transforms: [string, string][];
};

const BLUE_GREY = "#9ca5b7";
const CREAM = "#f7eede";

export const SPELLS: Spell[] = [
  {
    font: "Adobe Arabic Bold",
    fontFamily: F.adobeArabicBold.style.fontFamily,
    scale: 1.35,
    traits: ["Calligraphic", "Classic", "Warm"],
    cat: { name: "The Scholar", image: scholar, alt: "A fluffy cream and ginger long-haired cat sitting upright", portal: BLUE_GREY },
    transforms: [
      ["Brush-made curves", "a soft, fluffy mane"],
      ["Traditional serifs", "a dignified, upright pose"],
      ["Bold, warm weight", "a cosy cream-and-ginger coat"],
    ],
  },
  {
    font: "Adobe Arabic Italic",
    fontFamily: F.adobeArabicItalic.style.fontFamily,
    scale: 1.4,
    traits: ["Flowing", "Romantic", "Graceful"],
    cat: { name: "The Romantic", image: romantic, alt: "An orange cat in a striped sweater walking with a pink flower in its mouth", portal: CREAM },
    transforms: [
      ["Forward-leaning italic", "caught mid-stroll"],
      ["Looping, handwritten strokes", "a flower carried like a love letter"],
      ["Light, lyrical rhythm", "a soft pastel striped sweater"],
    ],
  },
  {
    font: "Adobe Fan Heiti Std Bold",
    fontFamily: F.adobeFanHeitiBold.style.fontFamily,
    scale: 1,
    traits: ["Solid", "Heavy", "Calm"],
    cat: { name: "The Night Loaf", image: nightLoaf, alt: "A black cat lying down with its eyes closed, smiling", portal: BLUE_GREY },
    transforms: [
      ["黑体 hēitǐ literally means “black type”", "a jet-black coat"],
      ["Dense, even strokes", "a solid, rounded loaf shape"],
      ["Steady, no-fuss forms", "a calm, sleepy smile"],
    ],
  },
  {
    font: "Adobe Hebrew Bold Italic",
    fontFamily: F.adobeHebrewBoldItalic.style.fontFamily,
    scale: 1.05,
    traits: ["Bold", "Dynamic", "Punchy"],
    cat: { name: "The Showstopper", image: showstopper, alt: "A black and white cat in a yellow striped sweater with a big curling striped tail", portal: CREAM },
    transforms: [
      ["Heavy strokes", "bold black-and-white markings"],
      ["A confident slant", "a tail that swooshes like a swash"],
      ["High contrast", "stripes in every colour"],
    ],
  },
  {
    font: "Barlow Condensed Black",
    fontFamily: F.barlowCondensedBlack.style.fontFamily,
    scale: 1,
    traits: ["Tall", "Narrow", "Heavy"],
    cat: { name: "The Skyscraper", image: skyscraper, alt: "A tall, narrow black cat standing upright with colourful patterned legs", portal: CREAM },
    transforms: [
      ["Condensed width", "a tall, narrow silhouette"],
      ["Black (the heaviest) weight", "an ink-black coat"],
      ["Upright verticals", "standing straight to attention"],
    ],
  },
  {
    font: "Barlow Condensed Italic",
    fontFamily: F.barlowCondensedItalic.style.fontFamily,
    scale: 1.05,
    traits: ["Slim", "Sleek", "On the move"],
    cat: { name: "The Stroller", image: stroller, alt: "A slender lime-green cat walking with its tail up", portal: CREAM },
    transforms: [
      ["Light, thin strokes", "a slender, lightweight body"],
      ["Italic lean", "walking forward with purpose"],
      ["Narrow letters", "long legs and a long tail"],
    ],
  },
  {
    font: "Courier Std Bold",
    fontFamily: F.courierStdBold.style.fontFamily,
    scale: 0.9,
    traits: ["Monospaced", "Typewriter", "Methodical"],
    cat: { name: "The Librarian", image: librarian, alt: "An olive-green cat wearing round glasses and a collar with a name tag", portal: CREAM },
    transforms: [
      ["Every letter the same width", "neat and orderly, lines all in a row"],
      ["Typewriter heritage", "round reading glasses"],
      ["Slab serifs", "a tidy collar with a name tag"],
    ],
  },
  {
    font: "Helvetica 75 Bold Outline",
    fontFamily: F.helveticaBoldOutline.style.fontFamily,
    scale: 1,
    traits: ["Hollow", "Modern", "Minimal"],
    cat: { name: "The Outline", image: outline, alt: "A white cat sitting, drawn with just a few grey lines", portal: BLUE_GREY },
    transforms: [
      ["Letters made only of edges", "a white cat drawn with a few lines"],
      ["Swiss, no-nonsense clarity", "clean, simple features"],
      ["Bold but empty", "a big presence in a quiet colour"],
    ],
  },
  {
    font: "Pixolletta 8px",
    fontFamily: F.pixolletta.style.fontFamily,
    scale: 0.95,
    traits: ["Pixelated", "Retro", "Digital"],
    cat: { name: "The Pixel Skater", image: pixelSkater, alt: "A boxy lilac cat with white polka dots and black sunglasses riding a skateboard", portal: CREAM },
    transforms: [
      ["8-pixel squares", "a boxy, blocky body"],
      ["Retro video-game vibe", "classic pixel “deal with it” shades"],
      ["Shapes built from dots", "a polka-dot coat"],
    ],
  },
  {
    font: "Plaak 21 Light",
    fontFamily: F.plaakLight.style.fontFamily,
    scale: 1.5,
    traits: ["Quirky", "Experimental", "Graphic"],
    cat: { name: "The Avant-Garde", image: avantGarde, alt: "A red-orange cat with a blue spiral target pattern on its chest", portal: CREAM },
    transforms: [
      ["Unusual, chiselled construction", "a spiral target on its chest"],
      ["Sharp, graphic details", "bold flat shapes and doodles"],
      ["Tall, compressed poster capitals", "a bright, loud red coat"],
    ],
  },
  {
    font: "Saira Condensed ExtraBold",
    fontFamily: F.sairaCondensedExtraBold.style.fontFamily,
    scale: 1.05,
    traits: ["Sporty", "Fast", "Squared"],
    cat: { name: "The Athlete", image: athlete, alt: "A ginger cat striding forward with its tail held high", portal: BLUE_GREY },
    transforms: [
      ["Racing-number letterforms", "a long, athletic stride"],
      ["Extra-bold power", "strong legs mid-step"],
      ["Forward energy", "a tail raised like a flag"],
    ],
  },
  {
    font: "Academy Engraved LET",
    fontFamily: F.academyEngraved.style.fontFamily,
    scale: 1.15,
    traits: ["Engraved", "Formal", "Victorian"],
    cat: { name: "The Aristocrat", image: aristocrat, alt: "A black and white tuxedo cat sitting perfectly upright", portal: BLUE_GREY },
    transforms: [
      ["Engraved capitals", "crisp black-and-white formality"],
      ["Invitation lettering", "dressed for a black-tie evening"],
      ["Old-world poise", "seated perfectly upright"],
    ],
  },
];
