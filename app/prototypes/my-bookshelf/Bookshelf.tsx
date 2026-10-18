"use client";

/**
 * A Constellation of Stories — the bookshelf (the "Browse" view).
 *
 * The practical way in: every book as a cover in a clean grid, with its
 * title, author, genre and rating. It uses the same books as the star map,
 * and shares the chosen genre with it, so switching views keeps your place.
 *
 *   - the genre filter (a pill slides to the chosen genre), a search box and
 *     a sort menu, with the books gliding to their new places,
 *   - covers that tilt gently towards the mouse, with a soft shine,
 *   - a click opens the book's page (BookFolio.tsx).
 *
 * Two browser features do most of the animation work:
 *
 *   VIEW TRANSITIONS  When the filter changes, the browser takes a snapshot of
 *                     the page before and after, and smoothly moves each book
 *                     from its old spot to its new one. Each book needs its
 *                     own `view-transition-name` so the browser can match it up.
 *                     (Browsers without it just switch instantly.)
 *   CSS variables     The tilt sets --rx / --ry (rotation) on the cover as the
 *                     mouse moves; the CSS turns them into a 3D rotation.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { flushSync } from "react-dom";
import type { Book } from "./books";
import { Cover, prefersLessMotion, RatingStars } from "./parts";
import { plainText, type Catalogue, type ConstellationInfo } from "./sky";
import styles from "./shelf.module.css";

type Order = "recent" | "rating" | "title";

const ORDERS: Record<Order, string> = {
  recent: "Recently added",
  rating: "Highest rated",
  title: "Title A–Z",
};

/**
 * Makes a change with a View Transition, if the browser has them and the
 * visitor hasn't asked for less motion. `flushSync` makes React update the
 * page right away, inside the transition, so the "after" snapshot is right.
 */
function smoothly(change: () => void) {
  if (prefersLessMotion() || typeof document.startViewTransition !== "function") {
    change();
    return;
  }
  document.startViewTransition(() => flushSync(change));
}

/** A name the browser uses to match each book up before and after a change. */
const transitionName = (id: string) => `book-${id.replace(/[^a-zA-Z0-9-]/g, "")}`;

type Props = {
  /** Every book, in Notion's order (newest first) */
  books: Book[];
  catalogue: Catalogue;
  genre: string | null;
  onGenre: (key: string | null) => void;
  openId: string | null;
  onOpenBook: (id: string, origin: HTMLElement | null, list: string[]) => void;
};

export function Bookshelf({ books, catalogue, genre, onGenre, openId, onOpenBook }: Props) {
  const [order, setOrder] = useState<Order>("recent");
  const [query, setQuery] = useState("");
  // The first time the shelf appears, the books rise in one after another. Only then.
  const [firstLoad, setFirstLoad] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setFirstLoad(false), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  // The books to show: filtered by genre and search, then sorted
  const shown = useMemo(() => {
    const wanted = plainText(query);
    const list = books.filter((book) => {
      if (genre !== null && (book.genre?.name.trim() ?? "") !== genre) return false;
      if (!wanted) return true;
      return plainText(book.title).includes(wanted) || plainText(book.author).includes(wanted);
    });
    if (order === "rating") list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    if (order === "title") list.sort((a, b) => a.title.localeCompare(b.title));
    return list; // "recent" keeps Notion's order: newest first
  }, [books, genre, query, order]);

  const chosen = genre !== null ? catalogue.byKey.get(genre) : null;

  return (
    <section className={styles.shelf} aria-label="Bookshelf">
      <div className={styles.controls}>
        <GenreFilter constellations={catalogue.constellations} total={books.length} current={genre} onChoose={(next) => smoothly(() => onGenre(next))} />
        <div className={styles.controlsEnd}>
          <label className={styles.search}>
            <span className={styles.srOnly}>Search the shelf by title or author</span>
            <svg viewBox="0 0 20 20" className={styles.searchIcon} aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="M12.6 12.6 17 17" />
            </svg>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Title or author"
              value={query}
              // No glide while typing: it would hold back the letters until each animation ends
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className={styles.sort}>
            <span className={styles.sortLabel}>Sort</span>
            <select className={styles.sortSelect} value={order} onChange={(event) => smoothly(() => setOrder(event.target.value as Order))}>
              {(Object.keys(ORDERS) as Order[]).map((key) => (
                <option key={key} value={key}>
                  {ORDERS[key]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* The number of books in the chosen genre, shown, and read out by screen readers when it changes */}
      <p className={styles.summary} role="status">
        {chosen ? (
          <>
            <span className={styles.summaryNumeral}>Constellation {chosen.numeral}</span> {chosen.genre}: {shown.length}{" "}
            {shown.length === 1 ? "book" : "books"}
          </>
        ) : (
          <>
            All {shown.length} {shown.length === 1 ? "book" : "books"}
          </>
        )}
        {query.trim() && <> matching “{query.trim()}”</>}
      </p>

      {shown.length === 0 ? (
        <p className={styles.nothing}>No books on this shelf match “{query.trim()}”. Try another title or author, or choose All Books.</p>
      ) : (
        <ul className={styles.grid}>
          {shown.map((book, index) => {
            const entry = catalogue.entries.get(book.id);
            const info = entry ? catalogue.byKey.get(entry.key) : undefined;
            return (
              <li
                key={book.id}
                className={`${styles.gridItem} ${firstLoad ? styles.rise : ""}`}
                style={{ viewTransitionName: transitionName(book.id), "--i": Math.min(index, 14) } as CSSProperties}
              >
                <BookCard
                  book={book}
                  info={info}
                  designation={entry?.designation ?? ""}
                  isOpen={openId === book.id}
                  onOpen={(origin) =>
                    onOpenBook(
                      book.id,
                      origin,
                      shown.map((item) => item.id),
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------- Genre filter: buttons with a highlight that slides to the chosen one ---------- */

function GenreFilter({
  constellations,
  total,
  current,
  onChoose,
}: {
  constellations: ConstellationInfo[];
  total: number;
  current: string | null;
  onChoose: (genre: string | null) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const highlight = useRef<HTMLSpanElement>(null);

  // Move the highlight under the chosen button. Measured after every change,
  // and whenever the row changes size (window resized, fonts loaded…).
  useLayoutEffect(() => {
    const place = () => {
      const chosen = row.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!chosen || !highlight.current) return;
      highlight.current.style.setProperty("--x", `${chosen.offsetLeft}px`);
      highlight.current.style.setProperty("--w", `${chosen.offsetWidth}px`);
      // From now on the pill shows which button is chosen (see .filterRow[data-ready] in the CSS)
      row.current?.setAttribute("data-ready", "");
    };
    place();
    const watcher = new ResizeObserver(place);
    if (row.current) watcher.observe(row.current);
    return () => watcher.disconnect();
  }, [current]);

  const choose = (genre: string | null, button: HTMLButtonElement) => {
    // On a phone the row scrolls sideways: bring the chosen button into view
    button.scrollIntoView({ behavior: prefersLessMotion() ? "auto" : "smooth", block: "nearest", inline: "nearest" });
    if (genre !== current) onChoose(genre);
  };

  return (
    <div className={styles.filterScroller}>
      <div ref={row} className={styles.filterRow} role="group" aria-label="Filter by genre">
        <span ref={highlight} className={styles.filterHighlight} aria-hidden="true" />
        <button type="button" className={styles.filterButton} aria-pressed={current === null} onClick={(event) => choose(null, event.currentTarget)}>
          All Books <span className={styles.filterCount}>{total}</span>
        </button>
        {constellations.map((info) => (
          <button
            key={info.key || "uncharted"}
            type="button"
            className={styles.filterButton}
            style={{ "--accent": info.accent } as CSSProperties}
            aria-pressed={current === info.key}
            onClick={(event) => choose(info.key, event.currentTarget)}
          >
            <span className={styles.filterStar} aria-hidden="true">
              ✦
            </span>
            {info.genre} <span className={styles.filterCount}>{info.entries.length}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- One book in the grid ---------- */

type CardProps = {
  book: Book;
  info: ConstellationInfo | undefined;
  designation: string;
  isOpen: boolean;
  onOpen: (origin: HTMLElement | null) => void;
};

function BookCard({ book, info, designation, isOpen, onOpen }: CardProps) {
  const cover = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  /*
    The 3D tilt. Where is the mouse over the cover, from -0.5 (left/top) to
    0.5 (right/bottom)? Turn that into a small rotation: the cover leans
    away from the mouse, like tilting a real book towards the light. A soft
    shine (--gx, --gy) follows the mouse too. Only for a mouse: touch
    screens have nothing to hover with.
  */
  const tilt = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || prefersLessMotion()) return;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const element = cover.current;
      if (!element) return;
      const box = element.getBoundingClientRect();
      const x = Math.min(0.5, Math.max(-0.5, (clientX - box.left) / box.width - 0.5));
      const y = Math.min(0.5, Math.max(-0.5, (clientY - box.top) / box.height - 0.5));
      element.style.setProperty("--ry", `${(x * 16).toFixed(2)}deg`);
      element.style.setProperty("--rx", `${(-y * 12).toFixed(2)}deg`);
      element.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
      element.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
    });
  };

  const settle = () => {
    cancelAnimationFrame(frame.current);
    for (const name of ["--rx", "--ry", "--gx", "--gy"]) cover.current?.style.removeProperty(name);
  };

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    // The whole card is clickable: the title's button stretches over it (see .cardButton::after)
    <article
      className={styles.card}
      style={info ? ({ "--accent": info.accent } as CSSProperties) : undefined}
      data-open={isOpen || undefined}
      onPointerMove={tilt}
      onPointerLeave={settle}
    >
      <div ref={cover} className={styles.cardCover}>
        <Cover book={book} />
      </div>
      <div className={styles.cardText}>
        <p className={styles.cardGenre}>
          <span className={styles.cardStar} aria-hidden="true">
            ✦
          </span>
          {info?.genre ?? "Uncatalogued"}
        </p>
        <h2 className={styles.cardTitle}>
          <button
            type="button"
            className={styles.cardButton}
            data-book-button={book.id}
            aria-haspopup="dialog"
            onClick={() => {
              settle();
              onOpen(cover.current);
            }}
          >
            {book.title}
          </button>
        </h2>
        {book.author && <p className={styles.cardAuthor}>{book.author}</p>}
        <RatingStars rating={book.rating} />
        {designation && <p className={styles.cardDesignation}>{designation}</p>}
      </div>
    </article>
  );
}
