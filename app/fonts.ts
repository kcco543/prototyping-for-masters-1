import { Caveat, Instrument_Sans } from 'next/font/google';

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
