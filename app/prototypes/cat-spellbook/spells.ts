/**
 * Messages revealed by "Cast a Spell".
 * Each borrows a card from the tarot's Major Arcana and gives it a small,
 * cat-flavoured reading.
 *
 * `art` names the little illustration drawn on the card (see SCENES in
 * art.tsx). To add your own card: { card, numeral, art, message }, reusing
 * one of the existing illustrations or drawing a new one in art.tsx.
 */

export type SpellArt =
  | "fool"
  | "magician"
  | "priestess"
  | "empress"
  | "strength"
  | "hermit"
  | "wheel"
  | "hanged"
  | "temperance"
  | "star"
  | "moon"
  | "sun"
  | "world";

export type Spell = { card: string; numeral: string; art: SpellArt; message: string };

export const SPELLS: Spell[] = [
  { card: "The Fool", numeral: "0", art: "fool", message: "Leap first. Cats rarely check the height of the shelf, and they land well anyway." },
  { card: "The Magician", numeral: "I", art: "magician", message: "Everything you need is already on the table. Try not to knock it off." },
  { card: "The High Priestess", numeral: "II", art: "priestess", message: "Sit very still and watch. The answer is hiding where the curtain moves." },
  { card: "The Empress", numeral: "III", art: "empress", message: "Make something soft today, and let someone curl up in it." },
  { card: "Strength", numeral: "VIII", art: "strength", message: "Gentle paws open more doors than loud ones." },
  { card: "The Hermit", numeral: "IX", art: "hermit", message: "A quiet box of your own is not loneliness. It is a lantern." },
  { card: "Wheel of Fortune", numeral: "X", art: "wheel", message: "The yarn rolls where it likes. Follow it a little way and see." },
  { card: "The Hanged One", numeral: "XII", art: "hanged", message: "Look at it upside down, from the back of the sofa. It may make more sense." },
  { card: "Temperance", numeral: "XIV", art: "temperance", message: "A little play, a little nap. The spell is in the mixture." },
  { card: "The Star", numeral: "XVII", art: "star", message: "Hope comes back quietly, like a cat at dawn, as if it had never left." },
  { card: "The Moon", numeral: "XVIII", art: "moon", message: "Not everything in the dark is a monster. Most of it is just furniture." },
  { card: "The Sun", numeral: "XIX", art: "sun", message: "Find the warm patch on the floor and stay in it as long as it lasts." },
  { card: "The World", numeral: "XXI", art: "world", message: "You have drawn a full circle. Stretch, and begin the next one." },
];

/** Pick a random spell, never the same one twice in a row. */
export function pickSpell(previous?: Spell | null): Spell {
  let next = previous ?? null;
  while (!next || next === previous) next = SPELLS[Math.floor(Math.random() * SPELLS.length)];
  return next;
}
