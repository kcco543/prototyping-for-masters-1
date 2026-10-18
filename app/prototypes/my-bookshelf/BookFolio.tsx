"use client";

/**
 * A Constellation of Stories — a book's own page ("entering its world").
 *
 * Designed like an opened antique book: on the left, a dark engraved plate
 * with the cover lit by its star; on the right, an ivory page with the
 * title, author, genre, rating and your review.
 *
 * It's a <dialog> opened with showModal(), which puts it above the page,
 * keeps keyboard focus inside it, and makes Esc close it.
 *
 * THE COVER'S JOURNEY (a "FLIP" animation)
 * When you click a book, the cover seems to lift off the map (or the shelf)
 * and settle onto the plate. The trick, called FLIP (First, Last, Invert,
 * Play):
 *   First   measure where the small cover was on screen,
 *   Last    open the page and measure where the big cover now is,
 *   Invert  move and shrink the big cover so it sits exactly over the small one,
 *   Play    animate it back to its real place.
 * The browser only animates a transform, which is quick and smooth.
 */

import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Book } from "./books";
import { Cover, formatDate, prefersLessMotion, RatingStars } from "./parts";
import type { ConstellationInfo, Entry } from "./sky";
import styles from "./folio.module.css";

type Props = {
  book: Book | null;
  entry: Entry | null;
  info: ConstellationInfo | null;
  /** The small cover the big one grows out of (null when stepping between books) */
  origin: HTMLElement | null;
  /** Where this book is in the list being stepped through (1 = first) */
  position: number;
  total: number;
  /** Which view it was opened from: the wording of a few buttons changes */
  from: "sky" | "shelf";
  onStep: (direction: 1 | -1) => void;
  /** Called once the page has fully closed */
  onClose: (lastId: string | null) => void;
  /** Bookshelf only: "Find in the constellation" */
  onLocate?: (id: string) => void;
};

const CLOSING_MS = 260; // keep the same as the .closing animation in folio.module.css

export function BookFolio({ book, entry, info, origin, position, total, from, onStep, onClose, onLocate }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const flipper = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const titleId = useId();
  const lastId = useRef<string | null>(null);
  if (book) lastId.current = book.id;

  // Open when a book is chosen, and play the cover's journey
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!book || !element || element.open) return;
    element.showModal();
    document.documentElement.style.overflow = "hidden"; // the page behind stays still

    const target = flipper.current;
    if (!origin || !target || prefersLessMotion()) return;
    const first = origin.getBoundingClientRect();
    const last = target.getBoundingClientRect();
    if (!first.width || !last.width) return;
    target.animate(
      [
        { transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width})` },
        { transform: "none" },
      ],
      { duration: 850, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [book, origin]);

  // Leaving the page with the folio open: give the scrolling back
  useLayoutEffect(
    () => () => {
      document.documentElement.style.overflow = "";
    },
    [],
  );

  /** Fade out, then really close. (The dialog's "close" event, below, tidies up.) */
  const close = () => {
    if (closing) return;
    if (prefersLessMotion()) {
      dialog.current?.close();
      return;
    }
    setClosing(true);
    window.setTimeout(() => dialog.current?.close(), CLOSING_MS);
  };

  /** "Find in the constellation" closes this page first, then goes to the map. */
  const locateAfter = useRef<string | null>(null);

  /** Runs however the page closed (the fade, or the browser closing it directly). */
  const tidyUp = () => {
    setClosing(false);
    document.documentElement.style.overflow = "";
    const target = locateAfter.current;
    locateAfter.current = null;
    if (target && onLocate) onLocate(target);
    else onClose(lastId.current);
  };

  const backLabel = from === "sky" ? "Back to constellation" : "Back to the shelf";
  const isBrightest = entry?.rank === 1;
  const count = info?.entries.length ?? 0;

  return (
    <dialog
      ref={dialog}
      className={`${styles.folio} ${closing ? styles.closing : ""}`}
      style={info ? ({ "--accent": info.accent } as CSSProperties) : undefined}
      aria-labelledby={titleId}
      onClose={tidyUp}
      // Esc: close with the fade instead of instantly
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      // A click on the dimmed sky around the folio lands on the <dialog> itself
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDown={(event) => {
        if (total < 2) return;
        if (event.key === "ArrowRight") onStep(1);
        if (event.key === "ArrowLeft") onStep(-1);
      }}
    >
      {book && entry && info && (
        <div className={styles.spread}>
          {/* key: a new book replays the page-turn, so stepping through books feels like leafing through a catalogue */}
          <section key={book.id} className={styles.plate} aria-label="Cover">
            <p className={styles.plateCaption}>
              Plate {info.numeral} <span className={styles.plateRule} aria-hidden="true" />
              {/* Star letters stay lower case (α, not Α), as in real star names */}
              <span className={styles.plateLetter}>{entry.letter}</span> {info.lore.genitive}
            </p>
            <div className={styles.plateStage}>
              <span className={styles.plateGlow} style={{ "--brightness": entry.brightness } as CSSProperties} aria-hidden="true" />
              <svg className={styles.plateOrbit} viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r="96" />
                <circle cx="100" cy="100" r="78" />
              </svg>
              <div ref={flipper} className={styles.plateFlip}>
                <div className={styles.plateCover}>
                  <Cover book={book} eager />
                </div>
              </div>
            </div>
            <p className={styles.plateNote}>
              {isBrightest ? (
                <>
                  The brightest star of <em>{info.lore.latin}</em>
                </>
              ) : (
                <>
                  Star {entry.rank} of {count} in <em>{info.lore.latin}</em>
                </>
              )}
            </p>
          </section>

          <article key={`${book.id}-page`} className={styles.page}>
            <header className={styles.pageHead}>
              <p className={styles.pageRunning}>A Catalogue of Stories</p>
              <p className={styles.pagePosition}>
                {from === "sky" ? `${entry.letter} · ${position} of ${total} in ${info.lore.latin}` : `${position} of ${total}`}
              </p>
              <button type="button" className={styles.closeButton} onClick={close} aria-label={backLabel}>
                <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.closeIcon}>
                  <path d="M5 5 L15 15 M15 5 L5 15" />
                </svg>
              </button>
            </header>

            <p className={styles.genre}>
              <span className={styles.genreStar} aria-hidden="true">
                ✦
              </span>
              {info.genre}
              <span className={styles.genreLatin}>
                · Constellation of {info.lore.latin}, {info.lore.epithet}
              </span>
            </p>
            <h2 id={titleId} className={styles.title}>
              {book.title}
            </h2>
            <p className={styles.author}>{book.author ? `by ${book.author}` : "Author unknown"}</p>
            <div className={styles.rating}>
              <RatingStars rating={book.rating} size="large" tone="paper" />
              {book.rating === null && <p className={styles.ratingNote}>It shines with a borrowed, middling light until it’s rated.</p>}
            </div>

            <p className={styles.ornament} aria-hidden="true">
              ✦ ❦ ✦
            </p>

            <section className={styles.review} aria-labelledby={`${titleId}-review`}>
              <h3 id={`${titleId}-review`} className={styles.label}>
                Review
              </h3>
              {book.review ? (
                // white-space: pre-line in the CSS keeps the review's line breaks from Notion
                <p className={styles.reviewText}>{book.review}</p>
              ) : (
                <p className={styles.empty}>No review written yet. This world is waiting for its first words.</p>
              )}
            </section>

            <footer className={styles.meta}>
              <span>Catalogued {formatDate(book.addedAt)}</span>
              {book.url && (
                <a className={styles.link} href={book.url} target="_blank" rel="noreferrer">
                  Open in Notion<span aria-hidden="true"> ↗</span>
                </a>
              )}
              {onLocate && (
                <button
                  type="button"
                  className={styles.locate}
                  onClick={() => {
                    locateAfter.current = book.id;
                    close();
                  }}
                >
                  <span aria-hidden="true">✦</span> Find in the constellation
                </button>
              )}
            </footer>
          </article>

          <nav className={styles.nav} aria-label="Other books">
            <button type="button" className={styles.step} onClick={() => onStep(-1)} disabled={total < 2}>
              <span aria-hidden="true">←</span> Previous
            </button>
            <button type="button" className={styles.back} onClick={close}>
              {backLabel}
            </button>
            <button type="button" className={styles.step} onClick={() => onStep(1)} disabled={total < 2}>
              Next <span aria-hidden="true">→</span>
            </button>
          </nav>
        </div>
      )}
    </dialog>
  );
}
