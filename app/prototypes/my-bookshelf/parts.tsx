"use client";

/**
 * A Constellation of Stories — small pieces shared by both views and the
 * book page: covers, rating stars, and a few helpers.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { RATING_OUT_OF, type Book } from "./books";
import styles from "./styles.module.css";

/* ---------- Motion ---------- */

/** True if the visitor has asked their device for less motion (a system accessibility setting). */
export const prefersLessMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The same, as React state that updates if the setting changes while the page is open. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export const formatDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

/** "rated 4.5 out of 5" / "not rated yet", for screen readers and tooltips */
export const ratingWords = (rating: number | null) => (rating === null ? "not rated yet" : `rated ${rating} out of ${RATING_OUT_OF}`);

/* ---------- The cover picture (or a drawn cover) ---------- */

/** Cloth colours for drawn covers: deep, old-library bindings. Picked from the title, so a book always gets the same one. */
const CLOTH = ["#283a5e", "#5a2f3c", "#2d4a44", "#4a3a62", "#6a4a2a", "#30304f", "#3d4f3a", "#5b3048"];

function clothFor(title: string) {
  let value = 0;
  for (const letter of title) value = (value * 31 + letter.charCodeAt(0)) >>> 0;
  return CLOTH[value % CLOTH.length];
}

/**
 * A book's cover. If there's no picture, or it can't load, a cloth-bound
 * cover with a gold frame and a small star is drawn instead. (Pictures
 * uploaded to Notion come with links that stop working after one hour, so a
 * page left open for a long time can lose them.)
 */
export function Cover({ book, eager = false }: { book: Book; eager?: boolean }) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (book.cover && !broken) {
    return (
      // A plain <img>, not next/image: covers can come from any website, and
      // next/image would need every one of those websites listed in next.config.
      <img
        className={styles.coverImage}
        data-loaded={loaded || undefined}
        src={book.cover}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setBroken(true)}
        // If the picture was already in the browser's cache, onLoad can fire before React is listening
        ref={(image) => {
          if (image?.complete && image.naturalWidth > 0 && !loaded) setLoaded(true);
        }}
      />
    );
  }
  return (
    <span className={styles.drawnCover} style={{ "--cloth": clothFor(book.title) } as CSSProperties} aria-hidden="true">
      <span className={styles.drawnStar}>✦</span>
      <span className={styles.drawnTitle}>{book.title}</span>
      {book.author && <span className={styles.drawnAuthor}>{book.author}</span>}
    </span>
  );
}

/* ---------- Rating stars ---------- */

/**
 * Five faint stars with gold stars laid on top, cut to (rating ÷ 5) of their
 * width, so 4.5 shows four and a half gold stars.
 */
export function RatingStars({ rating, size = "small", tone = "night" }: { rating: number | null; size?: "small" | "large"; tone?: "night" | "paper" }) {
  const classes = `${styles.rating} ${size === "large" ? styles.ratingLarge : ""} ${tone === "paper" ? styles.ratingPaper : ""}`;
  if (rating === null) return <p className={`${classes} ${styles.unrated}`}>Not rated yet</p>;
  const share = Math.min(1, Math.max(0, rating / RATING_OUT_OF));
  const stars = "★".repeat(RATING_OUT_OF);
  return (
    <p className={classes}>
      <span className={styles.stars} aria-hidden="true">
        {stars}
        <span className={styles.starsGold} style={{ width: `${share * 100}%` }}>
          {stars}
        </span>
      </span>
      <span className={styles.ratingNumber}>
        <span className={styles.srOnly}>Rated </span>
        {rating}
        <span className={styles.srOnly}> out of {RATING_OUT_OF}</span>
      </span>
    </p>
  );
}
