"use client";

/**
 * A Constellation of Stories — the whole library, in the browser.
 *
 * page.tsx reads the books from Notion on the server and hands them to this
 * component. From here on everything happens in the browser, with only the
 * finished list of books (never the Notion token).
 *
 * It holds what both views share:
 *   - which view is showing: the star map ("Constellation · Explore") or the
 *     bookshelf ("Bookshelf · Browse"). The address remembers it (#bookshelf),
 *     so refreshing the page keeps your view;
 *   - the chosen genre, so switching views keeps your place;
 *   - which book's page is open (BookFolio.tsx).
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import BackHome from "../../components/back-home/BackHome";
import { BookFolio } from "./BookFolio";
import type { Book } from "./books";
import { Bookshelf } from "./Bookshelf";
import { Masthead } from "./Masthead";
import { SAMPLE_BOOKS } from "./sample-books";
import { catalogue as makeCatalogue } from "./sky";
import { SkyMap, type SkyMemory } from "./SkyMap";
import { Starfield } from "./Starfield";
import styles from "./styles.module.css";

type ViewMode = "sky" | "shelf";

type OpenBook = {
  id: string;
  /** The ids to step through with Previous / Next */
  list: string[];
  /** The small cover the page's big cover grows out of */
  origin: HTMLElement | null;
  from: ViewMode;
};

type Props = {
  books: Book[];
  /** The database's name in Notion */
  sourceName: string;
  /** When the books were read from Notion, ready to show ("17 October 2026, 14:02") */
  chartedAt: string;
  /** Anything to show under the title (a heads-up about missing properties, the sample-books note…) */
  notice?: ReactNode;
};

export function Library({ books, sourceName, chartedAt, notice }: Props) {
  const catalogue = useMemo(() => makeCatalogue(books), [books]);
  const [view, setView] = useState<ViewMode>("sky");
  const [genre, setGenre] = useState<string | null>(null);
  const [open, setOpen] = useState<OpenBook | null>(null);
  const [locateId, setLocateId] = useState<string | null>(null);
  const parallax = useRef({ x: 0, y: 0 });
  const memory = useRef<SkyMemory | null>(null);

  // Arriving at …/my-bookshelf#bookshelf opens the bookshelf (and the browser's Back / Forward follow the address)
  useEffect(() => {
    const follow = () => setView(window.location.hash === "#bookshelf" ? "shelf" : "sky");
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);

  // If the chosen genre has gone (renamed in Notion, then refreshed), show everything
  useEffect(() => {
    if (genre !== null && !catalogue.byKey.has(genre)) setGenre(null);
  }, [catalogue, genre]);

  const changeView = (next: ViewMode) => {
    if (next === view) return;
    setView(next);
    window.history.replaceState(window.history.state, "", next === "shelf" ? "#bookshelf" : window.location.pathname + window.location.search);
    window.scrollTo(0, 0);
  };

  const openFrom = (from: ViewMode) => (id: string, origin: HTMLElement | null, list: string[]) => setOpen({ id, origin, list, from });

  const step = (direction: 1 | -1) =>
    setOpen((current) => {
      if (!current || current.list.length < 2) return current;
      const index = current.list.indexOf(current.id);
      return { ...current, id: current.list[(index + direction + current.list.length) % current.list.length], origin: null };
    });

  /** The page closed: put keyboard focus back on the book (on the map or on the shelf). */
  const closed = (lastId: string | null) => {
    const from = open?.from;
    setOpen(null);
    if (!lastId) return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-book-button="${CSS.escape(lastId)}"]`)?.focus({ preventScroll: from === "sky" });
    });
  };

  /** "Find in the constellation" from the bookshelf: switch to the map and fly to the book. */
  const locate = (id: string) => {
    setOpen(null);
    changeView("sky");
    setLocateId(id);
  };

  const entry = open ? (catalogue.entries.get(open.id) ?? null) : null;
  const info = entry ? (catalogue.byKey.get(entry.key) ?? null) : null;

  const ratings = books.flatMap((book) => (book.rating === null ? [] : [book.rating]));
  const stats = {
    books: books.length,
    constellations: catalogue.constellations.length,
    meanRating: ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : null,
    sourceName,
    chartedAt,
  };

  return (
    <div className={`${styles.library} ${view === "sky" ? styles.atSky : styles.atShelf}`} data-library="">
      <Starfield parallax={parallax} />
      <div className={styles.vignette} aria-hidden="true" />

      <div className={styles.topBar} data-chrome="top">
        <BackHome accent="#c6a76b" surface="#162034" ink="#f1e8d8" />
        <ViewToggle view={view} onChange={changeView} />
      </div>

      <Masthead mode={view} stats={stats}>
        {notice}
      </Masthead>

      <main className={styles.main}>
        {view === "sky" ? (
          <SkyMap
            catalogue={catalogue}
            genre={genre}
            onGenre={setGenre}
            openId={open?.id ?? null}
            onOpenBook={openFrom("sky")}
            locateId={locateId}
            onLocated={() => setLocateId(null)}
            parallax={parallax}
            memory={memory}
          />
        ) : (
          <Bookshelf books={books} catalogue={catalogue} genre={genre} onGenre={setGenre} openId={open?.id ?? null} onOpenBook={openFrom("shelf")} />
        )}
      </main>

      <BookFolio
        book={entry?.book ?? null}
        entry={entry}
        info={info}
        origin={open?.origin ?? null}
        position={open ? open.list.indexOf(open.id) + 1 : 0}
        total={open?.list.length ?? 0}
        from={open?.from ?? view}
        onStep={step}
        onClose={closed}
        onLocate={open?.from === "shelf" ? locate : undefined}
      />

      {view === "shelf" && (
        <footer className={styles.footer}>
          Books come from a Notion database through the Notion API (version 2026-03-11). Changes in Notion appear here within about a minute.
        </footer>
      )}

      {/* The paper grain sits over everything, very faintly, like an old printed chart */}
      <div className={styles.grain} aria-hidden="true" />
    </div>
  );
}

/* ---------- Constellation · Explore / Bookshelf · Browse ---------- */

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (view: ViewMode) => void }) {
  return (
    <div className={styles.toggle} role="group" aria-label="View">
      <button type="button" className={styles.toggleButton} aria-pressed={view === "sky"} onClick={() => onChange("sky")}>
        <svg viewBox="0 0 24 24" className={styles.toggleIcon} aria-hidden="true">
          <path d="M4 17 L9 8 L15 12 L20 5" className={styles.toggleIconLine} />
          <circle cx="4" cy="17" r="1.8" />
          <circle cx="9" cy="8" r="2.2" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="20" cy="5" r="2" />
        </svg>
        <span className={styles.toggleText}>
          <span className={styles.toggleName}>Constellation</span>
          <span className={styles.toggleHint}>Explore</span>
        </span>
      </button>
      <button type="button" className={styles.toggleButton} aria-pressed={view === "shelf"} onClick={() => onChange("shelf")}>
        <svg viewBox="0 0 24 24" className={styles.toggleIcon} aria-hidden="true">
          <rect x="3.5" y="4" width="4" height="16" rx="0.8" />
          <rect x="9.5" y="6" width="4" height="14" rx="0.8" />
          <rect x="15.5" y="3" width="4.5" height="17" rx="0.8" transform="rotate(8 17.75 11.5)" />
        </svg>
        <span className={styles.toggleText}>
          <span className={styles.toggleName}>Bookshelf</span>
          <span className={styles.toggleHint}>Browse</span>
        </span>
      </button>
    </div>
  );
}

/* ---------- Before Notion is connected: a preview with sample books ---------- */

export function SamplePreview() {
  const [showing, setShowing] = useState(false);

  if (!showing) {
    return (
      <button type="button" className={styles.sampleButton} onClick={() => setShowing(true)}>
        Preview with sample books
      </button>
    );
  }

  return (
    <div className={styles.sampleLayer}>
      <Library
        books={SAMPLE_BOOKS}
        sourceName=""
        chartedAt=""
        notice={
          <p className={styles.sampleNote}>
            These are sample books, not yours. They only appear here, before Notion is connected.
            <button type="button" className={styles.sampleHide} onClick={() => setShowing(false)}>
              Back to setup
            </button>
          </p>
        }
      />
    </div>
  );
}
