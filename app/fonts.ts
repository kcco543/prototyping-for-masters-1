import { Caveat, Cinzel, Instrument_Sans, Instrument_Serif } from 'next/font/google';

// Editorial serif for the homepage's big headlines and card titles.
// It is the serif companion of Instrument Sans, so the two sit well together.
// `variable` exposes it as a CSS custom property: var(--font-display)
export const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  display: 'swap',
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display',
});

export const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  display: 'swap',
});

// Hand-lettered font, inspired by the "stay home" lettering on the cat poster.
// `variable` exposes it as a CSS custom property: var(--font-hand)
export const caveat = Caveat({
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '700'],
  variable: '--font-hand',
});

// Classical serif used by the "A Reading for Yourself" prototype.
export const cinzel = Cinzel({
  subsets: ['latin'],
  display: 'swap',
});
