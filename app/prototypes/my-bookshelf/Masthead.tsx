/**
 * A Constellation of Stories — the title at the top of the page.
 *
 * No "use client" here: this has no buttons or state of its own, so it can
 * be drawn on the server (for the setup and error screens in page.tsx) or
 * inside the library in the browser.
 */

import type { ReactNode } from "react";
import styles from "./styles.module.css";

type Props = {
  /** "sky": floats over the star map. "shelf": at the top of the bookshelf. "plain": setup and error screens. */
  mode: "sky" | "shelf" | "plain";
  stats?: { books: number; constellations: number; meanRating: string | null; sourceName: string; chartedAt: string };
  children?: ReactNode;
};

export function Masthead({ mode, stats, children }: Props) {
  return (
    <header className={`${styles.masthead} ${mode === "sky" ? styles.mastheadSky : ""}`} data-chrome="top">
      <p className={styles.kicker}>
        <span className={styles.kickerRule} aria-hidden="true" />
        My Bookstore
        <span className={styles.kickerRule} aria-hidden="true" />
      </p>
      <h1 className={styles.title}>
        A Constellation <em className={styles.titleOf}>of</em> Stories
      </h1>
      <p className={styles.motto}>“Every book is a world. Together, they form a universe.”</p>

      {stats && (
        <p className={styles.annotation}>
          <span className={styles.annotationItem}>
            {stats.books} {stats.books === 1 ? "book" : "books"}
          </span>
          <span className={styles.annotationItem}>
            {stats.constellations} {stats.constellations === 1 ? "constellation" : "constellations"}
          </span>
          {stats.meanRating && <span className={styles.annotationItem}>mean rating ★ {stats.meanRating}</span>}
          {stats.chartedAt && (
            <span className={styles.annotationItem}>
              charted {stats.chartedAt}
              {stats.sourceName && <> from “{stats.sourceName}” in Notion</>}
            </span>
          )}
        </p>
      )}

      {mode === "sky" && (
        <>
          <p className={styles.instruction}>
            <span className={styles.forPointer}>Drag to explore. Scroll to discover. Click a book to enter its world.</span>
            <span className={styles.forTouch}>Drag to explore. Pinch to zoom. Tap a book to enter its world.</span>
          </p>
          <Legend />
        </>
      )}
      {mode === "shelf" && <p className={styles.instruction}>Every book on one shelf. Choose a cover to open its page.</p>}
      {children}
    </header>
  );
}

/** A one-line key to the chart, in the manner of an atlas margin note. */
function Legend() {
  return (
    <ul className={styles.legend} aria-label="Key to the chart">
      <li className={styles.legendItem}>
        <svg viewBox="0 0 24 10" className={styles.legendSvg} aria-hidden="true">
          <path d="M1 8 L12 2 L23 6" className={styles.legendLine} />
        </svg>
        one genre
      </li>
      <li className={styles.legendItem}>
        <svg viewBox="0 0 24 10" className={styles.legendSvg} aria-hidden="true">
          <path d="M1 9 Q12 -3 23 9" className={styles.legendAuthor} />
        </svg>
        same author
      </li>
      <li className={styles.legendItem}>
        <span className={styles.legendGlow} aria-hidden="true" />
        glow = rating
      </li>
      <li className={styles.legendItem}>
        <span className={styles.legendGreek} aria-hidden="true">
          α
        </span>
        brightest of its constellation
      </li>
    </ul>
  );
}
