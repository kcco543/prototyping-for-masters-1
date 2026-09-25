/**
 * The yarn's answers.
 *
 * Inspired by the idea of "The Book of Answers": short, oracle-like replies
 * that fit almost any silent yes/no or "what should I do?" question.
 * These are original lines (a few with a cat's point of view), not quotes
 * from the book. Keep them short; the yarn has to write every letter!
 */

export const ANSWERS = [
  "Yes, without a doubt.",
  "Not yet. Be patient.",
  "Trust your first instinct.",
  "Let it go.",
  "Ask again after a nap.",
  "The answer is already in you.",
  "Absolutely. Go for it.",
  "Wait for a clearer sign.",
  "Follow the loose thread.",
  "It will untangle itself.",
  "Say yes to the adventure.",
  "Better not.",
  "Take the leap.",
  "Only if it makes you purr.",
  "Look at it from another angle.",
  "Soon, but not today.",
  "Keep it simple.",
  "It is worth the risk.",
  "Rest first, then decide.",
  "Someone will surprise you.",
  "The timing is right.",
  "Stop overthinking it.",
  "You will land on your feet.",
  "Be curious, not cautious.",
  "Chase it.",
  "Don't count on it.",
  "Yes, if you do it gently.",
];

/** Pick a random answer, never the same one twice in a row. */
export function pickAnswer(previous?: string) {
  let next = previous;
  while (next === previous) next = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
  return next!;
}
