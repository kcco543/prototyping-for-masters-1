/**
 * Drawings for Wheel of Fortune, in the style of the reference image:
 * a round, black, brush-edged cat with huge yellow eyes, and a ball of
 * scribbled orange-red yarn.
 *
 * Coordinates: the cat stands on y = 0 (its "floor") and faces right.
 * The yarn ball is drawn around (0, 0) with radius BALL_R.
 */

import { memo } from "react";
import styles from "./styles.module.css";

export const INK = "#211d1b";
export const YARN = "#e0522c";
export const YARN_LIGHT = "#f79a62";
export const YARN_DARK = "#c93d24";
export const EYE = "#f2c230";
export const PAPER = "#f6f0e4";

export const BALL_R = 46;
/** Where the ball rests, relative to the cat */
export const BALL_REST: [number, number] = [218, -BALL_R];
/** Centres of the two eyes, relative to the cat */
export const EYES: [number, number][] = [
  [116, -124],
  [168, -124],
];

/** SVG filters: a brushy edge for the cat, like dry ink on paper. */
export function ArtDefs() {
  return (
    <defs>
      <filter id="brushEdge" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves={3} seed={4} result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale={9} xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <radialGradient id="glow">
        <stop offset="0%" stopColor="#fff7d6" stopOpacity={0.9} />
        <stop offset="100%" stopColor="#fff7d6" stopOpacity={0} />
      </radialGradient>
    </defs>
  );
}

type CatProps = {
  swatting: boolean;
  /** refs so the page can move the pupils every frame without re-rendering */
  pupilRefs: React.MutableRefObject<(SVGCircleElement | null)[]>;
};

export const Cat = memo(function Cat({ swatting, pupilRefs }: CatProps) {
  return (
    <g className={styles.cat}>
      {/* tail, curled along the floor */}
      <path className={styles.tail} d="M-138 -14 C-182 -8 -176 22 -128 18 C-90 14 -50 10 -16 8" stroke={INK} strokeWidth={20} fill="none" strokeLinecap="round" filter="url(#brushEdge)" />

      {/* body + head in one round shape, with two pointy ears */}
      <g className={styles.body}>
        <path
          d="M-150 -10 C-178 -84 -136 -172 -40 -182 C10 -188 42 -178 66 -170 L86 -226 L118 -180 C128 -182 142 -182 152 -180 L186 -226 L192 -160 C212 -120 208 -60 182 -30 C162 -6 122 0 82 0 L-120 0 C-140 0 -148 -4 -150 -10Z"
          fill={INK}
          filter="url(#brushEdge)"
        />
        {/* dry-brush streaks */}
        <path d="M-126 -60 C-100 -126 -40 -156 14 -160 M-104 -30 C-84 -80 -40 -110 0 -118 M-60 -16 C-30 -40 20 -52 60 -52" stroke="#3a3431" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
      </g>

      {/* eyes: yellow rings with black pupils that look around */}
      <g className={styles.eyes}>
        {EYES.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={21} fill={EYE} stroke="#b88d10" strokeWidth={1.5} />
            <circle ref={(el) => { pupilRefs.current[i] = el; }} cx={x} cy={y} r={10.5} fill={INK} />
          </g>
        ))}
      </g>

      {/* whiskers */}
      <path d="M198 -98 L240 -106 M200 -90 L242 -88 M198 -82 L236 -70" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />

      {/* front paw — this one swats the ball */}
      <g className={`${styles.paw} ${swatting ? styles.swat : ""}`}>
        <ellipse cx={128} cy={-10} rx={36} ry={17} fill={INK} filter="url(#brushEdge)" />
        <path d="M150 -4 v-7 M160 -5 v-7" stroke="#4b4440" strokeWidth={2} strokeLinecap="round" />
      </g>
    </g>
  );
});

/** A few loose strands lying on the floor around the ball (decoration). */
export function LooseStrands() {
  return (
    <g fill="none" strokeLinecap="round">
      <path d="M176 -8 C120 12 60 6 20 -2 C-20 -10 -84 8 -150 16" stroke={YARN} strokeWidth={2.4} />
      <path d="M204 -2 C172 22 120 28 72 18 C40 12 20 22 2 32" stroke={YARN_LIGHT} strokeWidth={2} />
      <path d="M256 -18 C298 2 304 22 274 28 C244 32 214 22 192 26" stroke={YARN} strokeWidth={2.2} />
    </g>
  );
}

/** The ball: a tangle of loops, like the scribbled ball in the reference. */
export const YarnBall = memo(function YarnBall() {
    // fixed "random" loops so the ball looks the same every time
    const loops = [
      [40, 30, 10, -4, 2], [34, 22, 60, 5, -3], [26, 38, 120, -6, 4], [42, 18, 150, 2, 6],
      [18, 30, 30, 10, -8], [30, 30, 80, -8, -6], [22, 14, 110, 8, 10], [38, 26, 170, 0, -2],
      [14, 22, 45, -12, 6], [28, 36, 95, 6, 0], [44, 40, 20, 0, 0],
    ];
    const colours = [YARN, YARN_DARK, YARN_LIGHT];
    return (
      <g>
        <circle r={BALL_R} fill={PAPER} />
        {loops.map(([rx, ry, rot, x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(${rot})`} fill="none" stroke={colours[i % 3]} strokeWidth={2.6} />
        ))}
      </g>
    );
});
