/**
 * Small celestial decorations for the homepage: a four-point sparkle and the
 * moon that hangs behind the cat tree.
 *
 * They are purely decorative, so they are hidden from screen readers
 * (aria-hidden) and can never be clicked (pointer-events: none in the CSS).
 */

import styles from "./Celestial.module.css";

/** A four-point star, the same shape as the sparkles in the cat tree's crystal ball. */
export function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg className={`${styles.sparkle} ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 0 Q14 10 24 12 Q14 14 12 24 Q10 14 0 12 Q10 10 12 0Z" fill="currentColor" />
    </svg>
  );
}

/**
 * The hero's backdrop: a pale lavender moon with a thin gold orbit around
 * it, a crescent and a few stars. The cat tree stands in front of it.
 */
export function HeroSky({ className = "" }: { className?: string }) {
  // [x, y, size, colour class, twinkle delay in seconds]
  const stars: [number, number, number, string, number][] = [
    [84, 96, 15, styles.gold, 0],
    [522, 66, 10, styles.navy, 1.4],
    [566, 300, 13, styles.gold, 2.6],
    [42, 380, 9, styles.navy, 0.8],
    [508, 548, 12, styles.pink, 3.2],
    [104, 566, 8, styles.gold, 2],
  ];

  return (
    <svg className={`${styles.sky} ${className}`} viewBox="0 0 600 640" aria-hidden="true" focusable="false">
      <defs>
        {/* the moon's halo: lavender light fading to nothing */}
        <radialGradient id="hero-sky-halo">
          <stop offset="0.55" stopColor="#e4def3" stopOpacity="0.9" />
          <stop offset="1" stopColor="#e4def3" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/*
        Three depths, each leaning with the cursor by a different amount
        (Celestial.module.css): the halo deepest, then the moon and its
        orbits, then the stars nearest. On a touch screen they stay still.
      */}
      <g className={styles.haloLayer}>
        {/* a soft halo that slowly changes shape, like light breathing */}
        <ellipse className={styles.halo} cx="300" cy="320" rx="292" ry="292" fill="url(#hero-sky-halo)" />
      </g>

      <g className={styles.moonLayer}>
        {/* the moon */}
        <circle className={styles.moon} cx="300" cy="320" r="232" />

        {/* two thin orbits: one solid, one dotted and slightly tilted */}
        <circle className={styles.orbit} cx="300" cy="320" r="258" />
        <ellipse className={styles.orbitDotted} cx="300" cy="320" rx="292" ry="270" transform="rotate(-18 300 320)" />

        {/* a small "planet" sitting on the dotted orbit */}
        <circle className={styles.planet} cx="548" cy="176" r="7" />

        {/* crescent moon */}
        <path className={styles.crescent} transform="rotate(-28 470 96)" d="M470 62 A34 34 0 1 0 470 130 A21 34 0 1 1 470 62Z" />
      </g>

      <g className={styles.starLayer}>
        {stars.map(([x, y, size, colour, delay], i) => (
          <path
            key={i}
            className={`${styles.star} ${colour}`}
            // each star twinkles and drifts on its own rhythm
            style={{ animationDelay: `${delay}s, ${-delay * 3}s`, animationDuration: `5.5s, ${16 + i * 3}s` }}
            transform={`translate(${x} ${y}) scale(${size / 12})`}
            d="M0 -12 Q2 -2 12 0 Q2 2 0 12 Q-2 2 -12 0 Q-2 -2 0 -12Z"
          />
        ))}
      </g>
    </svg>
  );
}
