/**
 * The Cat Spellbook's illustrations, written as SVG.
 *
 * Everything on the page that isn't the p5 drawing itself is drawn here:
 * the brush icons, the back of the tarot deck, the little ornaments, and
 * the thirteen scenes shown on the "Cast a Spell" cards.
 *
 * Two things make simple SVG shapes feel hand-drawn:
 *  1. Round line caps and joins everywhere, like a soft pen.
 *  2. The "ink" filters in <InkFilters />. They nudge every line by a
 *     tiny, uneven amount, so nothing is perfectly straight or perfectly
 *     round. Shapes opt in with filter="url(#spellbook-ink)".
 *
 * The scenes are built from a few reusable pieces (a sitting cat, a curled
 * cat, a star, a crescent...) so that all thirteen cards look like they
 * were drawn by the same hand.
 */

import { useId, type ReactNode } from "react";
import { INK, type BrushId } from "./brushes";
import type { SpellArt } from "./spells";
import styles from "./styles.module.css";

const LINE = INK.midnight;
const GOLD = INK.gold;
const CREAM = INK.parchment;
const PAPER = "#f8f2e4"; // a shade lighter than the card, for the picture window

/** Round to 2 decimals, so the server and the browser print identical numbers. */
const r2 = (n: number) => Math.round(n * 100) / 100;
const RAD = Math.PI / 180;

/* ---------- Small building blocks ---------- */

/** The outline of a four-pointed star centred on (x, y). */
function starPath(x: number, y: number, r: number) {
  const k = r2(r * 0.3);
  return `M${x} ${r2(y - r)} L${r2(x + k)} ${r2(y - k)} L${r2(x + r)} ${y} L${r2(x + k)} ${r2(y + k)} L${x} ${r2(y + r)} L${r2(x - k)} ${r2(y + k)} L${r2(x - r)} ${y} L${r2(x - k)} ${r2(y - k)} Z`;
}

/** The outline of a crescent moon centred on (x, y), open towards the right. */
function crescentPath(x: number, y: number, r: number) {
  const tipX = r2(x + r * 0.64);
  const top = r2(y - r * 0.77);
  const bottom = r2(y + r * 0.77);
  const inner = r2(r * 0.8);
  return `M${tipX} ${top} A${r} ${r} 0 1 0 ${tipX} ${bottom} A${inner} ${inner} 0 1 1 ${tipX} ${top} Z`;
}

function Star({ x, y, r, color = GOLD }: { x: number; y: number; r: number; color?: string }) {
  return <path d={starPath(x, y, r)} fill={color} stroke="none" />;
}

/** The infinity sign that floats over the Magician and Strength. */
function Lemniscate({ x, y }: { x: number; y: number }) {
  return <path d={`M${x} ${y} c-4 -6 -13 -6 -13 0 c0 6 9 6 13 0 c4 -6 13 -6 13 0 c0 6 -9 6 -13 0 Z`} stroke={GOLD} />;
}

/** A goblet standing on (x, y). */
function Goblet({ x, y, s = 1, rotate = 0 }: { x: number; y: number; s?: number; rotate?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`}>
      <path d="M-9 -27 H9 C9 -17 5 -13 0 -13 C-5 -13 -9 -17 -9 -27 Z" fill={CREAM} />
      <path d="M-8.2 -22 H8.2" stroke={GOLD} />
      <path d="M0 -13 V-3" />
      <path d="M-6.5 0 C-6.5 -4.4 6.5 -4.4 6.5 0 Z" fill={CREAM} />
    </g>
  );
}

/* ---------- The cats ---------- */

type Tone = "rose" | "sage" | "night";
const COAT: Record<Tone, string> = { rose: INK.pink, sage: INK.sage, night: INK.midnight };
/** The night cat is drawn in gold line, the others in midnight ink. */
const lineOf = (tone: Tone) => (tone === "night" ? GOLD : LINE);

/** A tail: a thick line in the coat colour, with a slightly thicker outline underneath. */
function Tail({ d, tone }: { d: string; tone: Tone }) {
  return (
    <>
      <path d={d} stroke={lineOf(tone)} strokeWidth="5.6" />
      <path d={d} stroke={COAT[tone]} strokeWidth="2.8" />
    </>
  );
}

/** A cat's face, centred on (x, y). */
function CatHead({ x, y, s = 1, tone, asleep = false, upsideDown = false }: { x: number; y: number; s?: number; tone: Tone; asleep?: boolean; upsideDown?: boolean }) {
  const line = lineOf(tone);
  return (
    <g transform={`translate(${x} ${y}) scale(${s} ${upsideDown ? -s : s})`} stroke={line}>
      <path d="M-13 -3 L-14 -16 L-5 -10 C-2 -11 2 -11 5 -10 L14 -16 L13 -3 C16 5 10 13 0 13 C-10 13 -16 5 -13 -3 Z" fill={COAT[tone]} />
      {asleep ? (
        <path d="M-7.6 0.4 q2.4 2.2 4.8 0 M2.8 0.4 q2.4 2.2 4.8 0" strokeWidth="1.1" />
      ) : (
        <>
          <circle cx="-5" cy="0" r="1.5" fill={line} stroke="none" />
          <circle cx="5" cy="0" r="1.5" fill={line} stroke="none" />
        </>
      )}
      <path d="M-1.4 4.3 h2.8 l-1.4 1.8 Z" fill={tone === "rose" ? LINE : INK.pink} stroke="none" />
      <path d="M0 6.1 q-1.8 2 -3.6 0.5 M0 6.1 q1.8 2 3.6 0.5" strokeWidth="0.9" />
      <path d="M-9.5 5 l-7 -1.5 M-9.5 7 l-7 1 M9.5 5 l7 -1.5 M9.5 7 l7 1" strokeWidth="0.7" />
    </g>
  );
}

/** A cat sitting and facing us. (x, y) is where it sits. */
function SitCat({ x, y, s = 1, tone, tailLeft = false }: { x: number; y: number; s?: number; tone: Tone; tailLeft?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={lineOf(tone)}>
      <g transform={tailLeft ? "scale(-1 1)" : undefined}>
        <Tail d="M13 -4 C27 -3 30 -17 22 -24" tone={tone} />
      </g>
      <path d="M-9 -29 C-18 -19 -18 -5 -14 0 H14 C18 -5 18 -19 9 -29 Z" fill={COAT[tone]} />
      <path d="M-4 0 V-11 M4 0 V-11" strokeWidth="1.1" />
      <CatHead x={0} y={-39} tone={tone} />
    </g>
  );
}

/** A cat sitting with its back to us, looking up at the sky. */
function SitCatBack({ x, y, s = 1, tone }: { x: number; y: number; s?: number; tone: Tone }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={lineOf(tone)}>
      <Tail d="M11 -4 C25 -3 28 -15 21 -21" tone={tone} />
      <path
        d="M-13 0 C-18 -10 -15 -24 -8 -30 C-13 -35 -13 -42 -12 -51 L-4.5 -45 C-1.5 -46 1.5 -46 4.5 -45 L12 -51 C13 -42 13 -35 8 -30 C15 -24 18 -10 13 0 Z"
        fill={COAT[tone]}
      />
    </g>
  );
}

/** A cat curled up asleep. (x, y) is the middle of the floor underneath it. */
function CurledCat({ x, y, s = 1, tone }: { x: number; y: number; s?: number; tone: Tone }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={lineOf(tone)}>
      <ellipse cx="3" cy="-11" rx="23" ry="11" fill={COAT[tone]} />
      <path d="M12 -1.5 C7 -9 14 -18 23 -15" strokeWidth="1.1" />
      <Tail d="M24 -8 C28 3 6 2 -7 -1.5" tone={tone} />
      <CatHead x={-14} y={-12} s={0.85} tone={tone} asleep />
    </g>
  );
}

/* ---------- The thirteen card scenes ---------- */

/** The arched window every scene is drawn inside (the picture is 120 × 132). */
const ARCH = "M9 126 V54 C9 26 31 7 60 7 C89 7 111 26 111 54 V126 Z";
const ARCH_INNER = "M12.5 126 V54 C12.5 28 33 10.5 60 10.5 C87 10.5 107.5 28 107.5 54 V126";

/** A laurel sprig for Strength (drawn on the left; mirrored for the right). */
const SPRIG = (
  <>
    <path d="M27 114 C20 98 21 78 30 60" strokeWidth="1" />
    {(
      [
        [24, 104],
        [21.8, 92],
        [22.6, 80],
        [26, 69],
      ] as const
    ).map(([nx, ny]) =>
      [-130, -50].map((angle) => {
        const cx = r2(nx + Math.cos(angle * RAD) * 5);
        const cy = r2(ny + Math.sin(angle * RAD) * 5);
        return <ellipse key={`${ny}${angle}`} cx={cx} cy={cy} rx="5" ry="2.2" transform={`rotate(${angle} ${cx} ${cy})`} fill={INK.sage} strokeWidth="0.8" />;
      }),
    )}
    <ellipse cx="31.5" cy="56" rx="5" ry="2.2" transform="rotate(-65 31.5 56)" fill={INK.sage} strokeWidth="0.8" />
  </>
);

/** The oval wreath for The World: leaves placed around an ellipse. */
const WREATH = Array.from({ length: 22 }, (_, i) => {
  const a = (i / 22) * Math.PI * 2 + Math.PI / 22;
  const cx = r2(60 + Math.cos(a) * 31);
  const cy = r2(66 + Math.sin(a) * 40);
  // lean each leaf along the oval, tilting alternately in and out like a laurel
  const along = Math.atan2(40 * Math.cos(a), -31 * Math.sin(a)) / RAD;
  const tilt = r2(along + (i % 2 === 0 ? 24 : -24));
  return <ellipse key={i} cx={cx} cy={cy} rx="5.2" ry="2.3" transform={`rotate(${tilt} ${cx} ${cy})`} fill={INK.sage} strokeWidth="0.8" />;
});

/** Sun rays: alternately long and short, all the way round. */
const SUN_RAYS = Array.from({ length: 12 }, (_, i) => {
  const a = i * 30 * RAD;
  const far = i % 2 === 0 ? 27 : 22.5;
  return `M${r2(60 + Math.cos(a) * 18)} ${r2(42 + Math.sin(a) * 18)} L${r2(60 + Math.cos(a) * far)} ${r2(42 + Math.sin(a) * far)}`;
}).join(" ");

/** The glow around the Hermit's box: short rays fanning upwards. */
const LANTERN_RAYS = [-155, -133, -112, -90, -68, -47, -25]
  .map((deg) => {
    const a = deg * RAD;
    return `M${r2(60 + Math.cos(a) * 31)} ${r2(76 + Math.sin(a) * 31)} L${r2(60 + Math.cos(a) * 38)} ${r2(76 + Math.sin(a) * 38)}`;
  })
  .join(" ");

/**
 * One scene per card. `night: true` paints the window midnight blue, and
 * that scene's lines are then drawn in cream and gold instead of ink.
 */
const SCENES: Record<SpellArt, { night?: boolean; art: ReactNode }> = {
  /* 0 — a cat on a high shelf, about to leap for a star */
  fool: {
    art: (
      <>
        <Star x={84} y={30} r={3} />
        <Star x={24} y={100} r={2.5} />
        <Star x={48} y={112} r={2} />
        <path d="M62 58 C80 44 97 64 98 94" stroke={GOLD} strokeDasharray="0.5 5" strokeWidth="1.8" />
        <Star x={98} y={106} r={6.5} />
        <path d="M8 72 H58 V76.5 H8" fill={CREAM} />
        <path d="M20 76.5 V90 L33 76.5" />
        <SitCat x={38} y={72} s={0.82} tone="rose" tailLeft />
      </>
    ),
  },

  /* I — everything is on the table, and a cat is eyeing it */
  magician: {
    art: (
      <>
        <Lemniscate x={60} y={30} />
        <Star x={28} y={48} r={2.5} />
        <Star x={93} y={44} r={2.5} />
        <CatHead x={60} y={68} s={1.15} tone="sage" />
        <path d="M12 86 H108 V102 q-8 9 -16 0 q-8 9 -16 0 q-8 9 -16 0 q-8 9 -16 0 q-8 9 -16 0 q-8 9 -16 0 Z" fill={INK.pink} />
        <path d="M47 86 c0 -6.5 9 -6.5 9 0 Z M64 86 c0 -6.5 9 -6.5 9 0 Z" fill={INK.sage} />
        <Goblet x={26} y={86} s={0.85} />
        <circle cx="96" cy="77" r="7" fill={CREAM} />
        <Star x={96} y={77} r={4.5} />
        <path d="M82 86 L87 61" />
        <Star x={87.6} y={56} r={4.5} />
        <Star x={36} y={96} r={2.2} color={CREAM} />
        <Star x={60} y={98} r={2.6} color={CREAM} />
        <Star x={84} y={96} r={2.2} color={CREAM} />
      </>
    ),
  },

  /* II — a cat sitting very still in front of the veil */
  priestess: {
    art: (
      <>
        <path d={crescentPath(58, 26, 9)} fill={GOLD} stroke="none" />
        <Star x={76} y={25} r={2.5} />
        <Star x={40} y={36} r={2} />
        <path d="M29 50 H91 V100 q-5.17 5 -10.33 0 q-5.17 5 -10.33 0 q-5.17 5 -10.33 0 q-5.17 5 -10.33 0 q-5.17 5 -10.33 0 q-5.17 5 -10.35 0 Z" fill={INK.sage} fillOpacity="0.45" />
        <path d="M39.3 50 C37.5 68 41 84 39.3 100 M49.7 50 C48 68 51.5 84 49.7 100 M70.3 50 C72 68 68.5 84 70.3 100 M80.7 50 C78.5 66 86 86 80.7 100" strokeWidth="0.9" />
        <Star x={85} y={107} r={3} />
        <path d="M18 46 V108 H29 V46 M15 41 H32 V46 H15 Z M15 108 H32 V112 H15 Z" fill={PAPER} />
        <path d="M91 46 V108 H102 V46 M88 41 H105 V46 H88 Z M88 108 H105 V112 H88 Z" fill={PAPER} />
        <path d="M10 112 H110" />
        <SitCat x={60} y={112} s={0.85} tone="rose" />
      </>
    ),
  },

  /* III — a crown, a cushion, and someone curled up in it */
  empress: {
    art: (
      <>
        <path d="M46 44 L43 27 L52 36 L60 23 L68 36 L77 27 L74 44 Z" fill={GOLD} />
        <path d="M47.5 40 H72.5" strokeWidth="0.8" />
        <circle cx="43" cy="25" r="1.7" fill={PAPER} />
        <circle cx="60" cy="21" r="1.7" fill={PAPER} />
        <circle cx="77" cy="25" r="1.7" fill={PAPER} />
        <Star x={28} y={52} r={3} />
        <Star x={92} y={52} r={3} />
        <Star x={20} y={74} r={2} />
        <Star x={100} y={74} r={2} />
        <Star x={60} y={58} r={2} />
        <path d="M20 104 C16 92 28 89 60 89 C92 89 104 92 100 104 C104 117 92 120 60 120 C28 120 16 117 20 104 Z" fill={INK.pink} />
        <path d="M19.5 104 l-6 -3 M19.5 104 l-6.5 1 M19.5 104 l-5 4.5 M100.5 104 l6 -3 M100.5 104 l6.5 1 M100.5 104 l5 4.5" strokeWidth="1" />
        <Star x={36} y={112} r={2} color={CREAM} />
        <Star x={60} y={114} r={2.4} color={CREAM} />
        <Star x={84} y={112} r={2} color={CREAM} />
        <CurledCat x={60} y={103} s={1.15} tone="sage" />
      </>
    ),
  },

  /* VIII — one gentle paw between two laurel sprigs */
  strength: {
    art: (
      <>
        <Lemniscate x={60} y={32} />
        {SPRIG}
        <g transform="translate(120 0) scale(-1 1)">{SPRIG}</g>
        <path d="M60 102 C45 103 41 90 47 83 C51 78 56 81 60 81 C64 81 69 78 73 83 C79 90 75 103 60 102 Z" fill={INK.pink} />
        <ellipse cx="41" cy="70" rx="5.5" ry="7" transform="rotate(-22 41 70)" fill={INK.pink} />
        <ellipse cx="53" cy="60" rx="5.5" ry="7.5" transform="rotate(-8 53 60)" fill={INK.pink} />
        <ellipse cx="67" cy="60" rx="5.5" ry="7.5" transform="rotate(8 67 60)" fill={INK.pink} />
        <ellipse cx="79" cy="70" rx="5.5" ry="7" transform="rotate(22 79 70)" fill={INK.pink} />
        <Star x={60} y={115} r={3} />
      </>
    ),
  },

  /* IX — a cat in a box that glows like a lantern */
  hermit: {
    art: (
      <>
        <Star x={60} y={23} r={6} />
        <Star x={26} y={48} r={2.2} />
        <Star x={94} y={48} r={2.2} />
        <path d={LANTERN_RAYS} stroke={GOLD} />
        <CatHead x={60} y={75} s={1.1} tone="night" />
        <path d="M33 86 H87 L84 116 H36 Z" fill={CREAM} />
        <path d="M33 86 L20 78 M87 86 L100 78 M60 86 V98" />
        <path d="M46 86 c0 -6 8.5 -6 8.5 0 Z M65.5 86 c0 -6 8.5 -6 8.5 0 Z" fill={INK.midnight} stroke={GOLD} />
        <Star x={60} y={106} r={3.5} />
        <path d="M12 116 H108" />
      </>
    ),
  },

  /* X — a ball of yarn, rolling where it likes */
  wheel: {
    art: (
      <>
        <Star x={60} y={19} r={3} />
        <Star x={97} y={56} r={3} />
        <Star x={23} y={56} r={3} />
        <circle cx="86" cy="30" r="1.2" fill={GOLD} stroke="none" />
        <circle cx="34" cy="30" r="1.2" fill={GOLD} stroke="none" />
        <circle cx="26" cy="82" r="1.2" fill={GOLD} stroke="none" />
        <circle cx="60" cy="56" r="27" fill={INK.pink} />
        <path d="M36 44 C50 35 73 39 85 51 M33.5 56 C48 47 75 51 86.5 63 M37 69 C50 60 71 64 80 74 M50 31 C44 47 48 68 58 82.5 M66 30 C60 45 64 68 74 79" strokeWidth="1" />
        <path d="M80 74 C95 86 93 102 77 103 C63 104 56 96 44 104 C37 109 28 108 23 101" />
        <Star x={100} y={112} r={2.4} />
      </>
    ),
  },

  /* XII — the view from upside down, over the back of the sofa */
  hanged: {
    art: (
      <>
        <Star x={32} y={27} r={2.5} />
        <Star x={90} y={25} r={2} />
        <Tail d="M68 38 C68 26 79 27 77 15" tone="rose" />
        <path d="M12 46 C12 39 18 37 25 37 H95 C102 37 108 39 108 46 V126 H12 Z" fill={INK.sage} />
        {[
          [30, 104],
          [60, 104],
          [90, 104],
          [22, 86],
          [98, 86],
          [45, 118],
          [75, 118],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.1" fill={LINE} stroke="none" />
        ))}
        <path d="M34 37 C34 53 45 60 60 60 C75 60 86 53 86 37 Z" fill={INK.pink} />
        <path d="M35.5 42 V72 a3.6 3.6 0 0 0 7.2 0 V42" fill={INK.pink} />
        <path d="M77.3 42 V72 a3.6 3.6 0 0 0 7.2 0 V42" fill={INK.pink} />
        <CatHead x={60} y={75} s={1.15} tone="rose" upsideDown />
      </>
    ),
  },

  /* XIV — a little play (the yarn), a little nap (the cat), mixed */
  temperance: {
    art: (
      <>
        <Star x={32} y={30} r={2.5} />
        <Star x={66} y={24} r={2} />
        <circle cx="88" cy="38" r="8.5" fill={INK.pink} />
        <path d="M81 34 C86 33 92 36 95.5 41 M80 40 C85 38 91 41 93 46" strokeWidth="0.8" />
        <path d="M93 45 C99 52 92 56 97 64" strokeWidth="1" />
        <path d="M58 43 C68 46 62 64 74 72 C81 76 82 80 82 86" stroke={GOLD} strokeWidth="1.2" />
        <path d="M61 41.5 C72 45 66 62 77 69.5 C84.5 74 85.5 80 85.5 86" stroke={GOLD} strokeWidth="1.2" />
        <Goblet x={34} y={58} rotate={40} />
        <path d="M10 112 H110" />
        <Goblet x={83} y={112} />
        <CurledCat x={38} y={112} s={0.72} tone="sage" />
      </>
    ),
  },

  /* XVII — a cat on a hill at night, looking up at one great star */
  star: {
    night: true,
    art: (
      <>
        <path d={starPath(60, 40, 22)} fill={GOLD} stroke="none" />
        <path d={starPath(60, 40, 11)} fill={GOLD} stroke="none" transform="rotate(45 60 40)" />
        <Star x={30} y={36} r={3.5} />
        <Star x={90} y={36} r={3.5} />
        <Star x={23} y={60} r={3} />
        <Star x={97} y={60} r={3} />
        <Star x={38} y={74} r={2.4} />
        <Star x={82} y={74} r={2.4} />
        <Star x={60} y={78} r={2.4} />
        <path d="M6 116 Q60 98 114 116 V130 H6 Z" fill={INK.sage} stroke={GOLD} strokeWidth="1" />
        <SitCatBack x={60} y={110} s={0.95} tone="night" />
      </>
    ),
  },

  /* XVIII — a dark room where the "monsters" are a lamp and a chair */
  moon: {
    night: true,
    art: (
      <>
        <path d={crescentPath(58, 38, 19)} fill={GOLD} stroke="none" />
        <path d="M43.5 37 q2.2 2 4.4 0" stroke={LINE} strokeWidth="1" />
        <Star x={88} y={30} r={2.5} />
        <Star x={30} y={46} r={2} />
        {[
          [34, 64],
          [86, 62],
          [46, 72],
          [74, 70],
        ].map(([dx, dy]) => (
          <path key={`${dx}-${dy}`} d={`M${dx} ${dy - 3} q2.6 3.6 0 5.2 q-2.6 -1.6 0 -5.2 Z`} fill={GOLD} stroke="none" />
        ))}
        <path d="M10 112 H110" />
        <path d="M27 112 V82 M21 112 H33 M19 82 L22.5 68 H31.5 L35 82 Z M30 82 v5" />
        <path d="M82 112 V98 H102 V112 M84.5 98 V82 C84.5 74 99.5 74 99.5 82 V98" />
        <circle cx="89.5" cy="86" r="1" fill={GOLD} stroke="none" />
        <circle cx="94.5" cy="86" r="1" fill={GOLD} stroke="none" />
        <SitCat x={57} y={112} s={0.82} tone="sage" />
      </>
    ),
  },

  /* XIX — a smiling sun, and a cat asleep in the patch of light it makes */
  sun: {
    art: (
      <>
        <path d={SUN_RAYS} stroke={GOLD} strokeWidth="1.6" />
        <circle cx="60" cy="42" r="13.5" fill={GOLD} strokeWidth="1" />
        <path d="M54.6 40 q1.8 1.8 3.6 0 M61.8 40 q1.8 1.8 3.6 0 M56.5 46 q3.5 3 7 0" strokeWidth="1" />
        <path d="M24 122 L44 94 H102 L82 122 Z" fill={GOLD} fillOpacity="0.28" stroke="none" />
        <path d="M73 94 L53 122 M34 108 H92" stroke={PAPER} strokeWidth="1.2" />
        <path d="M10 122 H110" strokeWidth="1" />
        <CurledCat x={64} y={116} s={0.95} tone="rose" />
      </>
    ),
  },

  /* XXI — a full circle: a cat inside a laurel wreath */
  world: {
    art: (
      <>
        {WREATH}
        <Star x={60} y={25} r={5} />
        <Star x={60} y={107} r={5} />
        <Star x={19} y={114} r={2.6} />
        <Star x={101} y={114} r={2.6} />
        <SitCat x={60} y={93} s={0.8} tone="rose" />
      </>
    ),
  },
};

/** The illustration on the front of a spell card. */
export function SpellArtwork({ art, className }: { art: SpellArt; className?: string }) {
  // Each drawing needs its own clip-path id (ids must be unique on a page)
  const clipId = `spell-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const scene = SCENES[art];
  return (
    <svg className={className} viewBox="0 0 120 132" aria-hidden="true">
      <clipPath id={clipId}>
        <path d={ARCH} />
      </clipPath>
      <g fill="none" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#spellbook-ink)">
        <path d={ARCH} fill={scene.night ? INK.midnight : PAPER} stroke="none" />
        <g clipPath={`url(#${clipId})`} stroke={scene.night ? CREAM : LINE}>
          {scene.art}
        </g>
        <path d={ARCH} stroke={GOLD} strokeWidth="1.2" />
        <path d={ARCH_INNER} stroke={scene.night ? GOLD : LINE} strokeWidth="0.5" opacity="0.6" />
      </g>
    </svg>
  );
}

/* ---------- The back of the deck ---------- */

const BACK_DOTS = Array.from({ length: 12 }, (_, i) => {
  const a = i * 30 * RAD;
  return <circle key={i} cx={r2(30 + Math.cos(a) * 17.5)} cy={r2(48 + Math.sin(a) * 17.5)} r={i % 3 === 0 ? 1 : 0.6} />;
});

/** The pattern on the back of every card: a crescent holding a star, ringed by dots. */
export function CardBack({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 96" aria-hidden="true">
      <g fill="none" stroke={GOLD} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" filter="url(#spellbook-ink-fine)">
        <rect x="4" y="4" width="52" height="88" rx="3" />
        <rect x="6.6" y="6.6" width="46.8" height="82.8" rx="2" strokeWidth="0.4" />
        <g fill={GOLD} stroke="none">
          <path d={crescentPath(28.5, 48, 9.5)} />
          <path d={starPath(35, 48, 3.6)} />
          {BACK_DOTS}
          <path d={starPath(30, 17, 3)} />
          <path d={starPath(30, 79, 3)} />
          <path d={starPath(13, 13.5, 1.8)} />
          <path d={starPath(47, 13.5, 1.8)} />
          <path d={starPath(13, 82.5, 1.8)} />
          <path d={starPath(47, 82.5, 1.8)} />
        </g>
      </g>
    </svg>
  );
}

/* ---------- Brush icons ---------- */

const BRUSH_ICONS: Record<BrushId, ReactNode> = {
  quill: (
    <>
      <path d="M11.5 21.5 C8.5 14 13.5 6 26.5 4 C27.5 14.5 20 23 11.5 21.5 Z" />
      <path d="M4.5 28.5 C9.5 23 16 15.5 23.5 8" />
      <path d="M14.5 18.2 L19 18 M17.6 14.6 L22.2 14" />
    </>
  ),
  paw: (
    <>
      <path d="M16 26.5 C9.5 27 8 21 11 18.5 C13 16.8 14.5 17.6 16 17.6 C17.5 17.6 19 16.8 21 18.5 C24 21 22.5 27 16 26.5 Z" />
      <ellipse cx="7.6" cy="13.4" rx="2.2" ry="2.9" transform="rotate(-20 7.6 13.4)" />
      <ellipse cx="12.6" cy="8.6" rx="2.2" ry="3" transform="rotate(-6 12.6 8.6)" />
      <ellipse cx="19.4" cy="8.6" rx="2.2" ry="3" transform="rotate(6 19.4 8.6)" />
      <ellipse cx="24.4" cy="13.4" rx="2.2" ry="2.9" transform="rotate(20 24.4 13.4)" />
    </>
  ),
  yarn: (
    <>
      <circle cx="14" cy="15" r="9.5" />
      <path d="M6.5 10.5 C12 11 18 15 20.5 21.5 M4.8 15.5 C10.5 14.5 16.5 18 17.5 23.5 M10.5 6.3 C15 8.5 20.5 12.5 22.5 18" />
      <path d="M21.5 21 C25 25 27.5 22 29 26.5" />
    </>
  ),
  stardust: (
    <>
      <path d="M13.5 3.5 L15.6 11.9 L24 14 L15.6 16.1 L13.5 24.5 L11.4 16.1 L3 14 L11.4 11.9 Z" />
      <path d="M24.5 20.5 L25.4 23.6 L28.5 24.5 L25.4 25.4 L24.5 28.5 L23.6 25.4 L20.5 24.5 L23.6 23.6 Z" />
      <circle cx="25" cy="7" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  tail: (
    <>
      <path d="M7 27.5 C5.5 17 10.5 11.5 16 14 C21.5 16.5 25.5 12.5 22.5 5" />
      <path d="M9.3 17.6 L12.4 19.8 M14.6 12.8 L15.4 16.6 M20.2 12.4 L23 15 M21.4 7.4 L24.9 6.6" />
    </>
  ),
};

export function BrushIcon({ brush }: { brush: BrushId }) {
  return (
    <svg className={styles.icon} viewBox="0 0 32 32" aria-hidden="true">
      <g filter="url(#spellbook-ink-fine)">{BRUSH_ICONS[brush]}</g>
    </svg>
  );
}

/* ---------- Ornaments ---------- */

/** The little line-and-star beside the title. */
export function Flourish({ flip = false }: { flip?: boolean }) {
  return (
    <svg className={`${styles.flourish} ${flip ? styles.flourishFlip : ""}`} viewBox="0 0 56 12" aria-hidden="true">
      <path d="M2 6 C14 4.6 26 5.4 36 6" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <circle cx="40.5" cy="6" r="1" fill="currentColor" />
      <path d={starPath(49, 6, 5)} fill="currentColor" />
    </svg>
  );
}

/** A crescent between two stars: sits on the border at the top of the tool card. */
export function Crest() {
  return (
    <svg className={styles.crest} viewBox="0 0 64 14" aria-hidden="true">
      <g fill="currentColor">
        <path d={crescentPath(30.5, 7, 5.5)} />
        <path d={starPath(15, 7, 3)} />
        <path d={starPath(49, 7, 3)} />
        <circle cx="6" cy="7" r="0.9" />
        <circle cx="58" cy="7" r="0.9" />
      </g>
    </svg>
  );
}

/** The sound switch's music-box bell. The two small arcs appear when sound is on. */
export function Bell() {
  return (
    <svg className={styles.bell} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4 C8 4 6.5 7.5 6.5 11.5 C6.5 14.5 5.5 16 4.5 17.5 H19.5 C18.5 16 17.5 14.5 17.5 11.5 C17.5 7.5 16 4 12 4 Z M12 4 V2.6 M10.3 20 a1.8 1.8 0 0 0 3.4 0" />
      <path className={styles.bellWaves} d="M20.6 7.4 C21.9 9 21.9 11 20.9 12.6 M3.4 7.4 C2.1 9 2.1 11 3.1 12.6" />
    </svg>
  );
}

/** The two filters that give the drawings their slightly wobbly, hand-inked line. Put this on the page once. */
export function InkFilters() {
  return (
    <svg className={styles.defs} aria-hidden="true" focusable="false">
      <defs>
        {/* for the big card scenes */}
        <filter id="spellbook-ink" filterUnits="userSpaceOnUse" x="-10" y="-10" width="140" height="152" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* for the small icons and the card back: a finer, gentler wobble */}
        <filter id="spellbook-ink-fine" filterUnits="userSpaceOnUse" x="-6" y="-6" width="72" height="108" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.14" numOctaves="2" seed="9" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
